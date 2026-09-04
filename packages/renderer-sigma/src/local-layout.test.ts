import { describe, expect, it } from 'vitest';

import { createLocalConvergencePolicy } from './local-convergence';
import { LocalLayoutCache } from './local-layout-cache';
import {
  computeLocalLayout,
  createLocalLayoutFailure,
  createLocalLayoutRequest,
  LocalLayoutMaxWallTimeError,
  localLayoutFingerprint,
  validateLocalLayoutWorkerResponse,
  warmLocalRendererInput,
  type LocalLayoutComputeOptions,
} from './local-layout';
import { mapProjectionToLocal } from './local-mapping';
import { localTestProjection } from './local-test-fixture';
import type {
  LocalLayoutEdge,
  LocalLayoutRequest,
  LocalRendererInput,
} from './local-types';

function directRequest(input?: {
  readonly nodeCount?: number;
  readonly edges?: readonly LocalLayoutEdge[];
}): LocalLayoutRequest {
  const nodeCount = input?.nodeCount ?? 2;
  return {
    schemaVersion: 2,
    requestId: 1,
    rootKey: 'node-0',
    policy: createLocalConvergencePolicy(nodeCount),
    settings: {
      hierarchyWeight: 6,
      referenceWeight: 1,
      scalingRatio: 1.35,
    },
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      key: `node-${index}`,
      kind: 'document' as const,
      x: index,
      y: index % 3,
      size: 1,
    })),
    edges: input?.edges ?? [],
  };
}

function noTimeout(
  assignBatch: NonNullable<LocalLayoutComputeOptions['assignBatch']>,
): LocalLayoutComputeOptions {
  return { assignBatch, maxWallTimeMs: 60_000, now: () => 0 };
}

function mixedEdgeRequest(referenceWeight: number): LocalLayoutRequest {
  return {
    ...directRequest({
      nodeCount: 3,
      edges: [
        {
          key: 'hierarchy-edge',
          source: 'node-0',
          target: 'node-1',
          kind: 'hierarchy',
          weight: 1,
        },
        {
          key: 'reference-edge',
          source: 'node-0',
          target: 'node-2',
          kind: 'reference',
          weight: 1,
        },
      ],
    }),
    settings: {
      hierarchyWeight: 6,
      referenceWeight,
      scalingRatio: 1.35,
    },
  };
}

describe('Local bounded ForceAtlas2 layout contract', () => {
  it('maps weak, default, and strong Reference Pull to Local reference attraction only', () => {
    const weakRequest = mixedEdgeRequest(0.25);
    const defaultRequest = mixedEdgeRequest(1);
    const strongRequest = mixedEdgeRequest(2);
    const attraction = [weakRequest, defaultRequest, strongRequest].map(
      (request) => {
        let hierarchyWeight: number | undefined;
        let referenceWeight: number | undefined;
        computeLocalLayout(
          request,
          noTimeout((graph) => {
            hierarchyWeight ??= graph.getEdgeAttribute(
              'hierarchy-edge',
              'weight',
            );
            referenceWeight ??= graph.getEdgeAttribute(
              'reference-edge',
              'weight',
            );
          }),
        );
        return { hierarchyWeight, referenceWeight };
      },
    );

    expect(attraction).toEqual([
      { hierarchyWeight: 6, referenceWeight: 0.25 },
      { hierarchyWeight: 6, referenceWeight: 1 },
      { hierarchyWeight: 6, referenceWeight: 2 },
    ]);
    expect(
      [weakRequest, defaultRequest, strongRequest].map(
        ({ settings }) => settings.hierarchyWeight,
      ),
    ).toEqual([6, 6, 6]);
  });

  it('settles a representative graph before cap and root-normalizes once', () => {
    const request = createLocalLayoutRequest(
      mapProjectionToLocal(localTestProjection(), 'root'),
    );
    const result = computeLocalLayout({ ...request, requestId: 1 });

    expect(result.stopReason).toBe('stable');
    expect(result.stableBatches).toBeGreaterThanOrEqual(3);
    expect(result.iterationsCompleted).toBeLessThan(
      request.policy.maxIterations,
    );
    expect(result.finalMovement?.all.p90).toBeLessThanOrEqual(0.00512);
    expect(result.positions).toHaveLength(request.nodes.length);
    expect(result.positions.find(({ key }) => key === request.rootKey)).toEqual(
      { key: request.rootKey, x: 0, y: 0 },
    );
    expect(
      result.positions.every(
        ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
      ),
    ).toBe(true);
  });

  it('returns a single root as an exact zero-iteration degenerate result', () => {
    const request = directRequest({ nodeCount: 1 });
    const result = computeLocalLayout(request, {
      now: () => 0,
      assignBatch: () => {
        throw new Error('ForceAtlas2 must not run for one node.');
      },
    });
    expect(result).toMatchObject({
      stopReason: 'degenerate',
      iterationsCompleted: 0,
      batchesCompleted: 0,
      stableBatches: 0,
      finalMovement: null,
      positions: [{ key: 'node-0', x: 0, y: 0 }],
    });
  });

  it('runs two-node and disconnected graphs through the ordinary lifecycle', () => {
    const twoNode = computeLocalLayout(directRequest());
    const disconnected = computeLocalLayout(directRequest({ nodeCount: 4 }));
    for (const result of [twoNode, disconnected]) {
      expect(result.stopReason).toMatch(/stable|max-iterations/);
      expect(result.iterationsCompleted).toBeGreaterThan(0);
      expect(result.finalMovement).not.toBeNull();
      expect(
        result.positions.every(
          ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
        ),
      ).toBe(true);
    }
  });

  it('reuses one Graphology graph and labels the final partial cap batch honestly', () => {
    const request = directRequest({ nodeCount: 501 });
    const graphs: object[] = [];
    const iterations: number[] = [];
    const result = computeLocalLayout(
      request,
      noTimeout((graph, batchIterations) => {
        graphs.push(graph);
        iterations.push(batchIterations);
        graph.forEachNode((key, attributes) => {
          if (key !== request.rootKey) {
            graph.setNodeAttribute(key, 'x', -attributes.x || 1);
          }
        });
      }),
    );
    expect(new Set(graphs).size).toBe(1);
    expect(iterations).toEqual([32, 32, 32, 32, 32, 32, 32, 16]);
    expect(result).toMatchObject({
      stopReason: 'max-iterations',
      iterationsCompleted: 240,
      batchesCompleted: 8,
    });
    expect(result.stableBatches).toBeLessThan(3);
  });

  it('lets the low-degree maximum delay otherwise stable all-node p90', () => {
    const nodeCount = 21;
    const edges: LocalLayoutEdge[] = [];
    for (let index = 0; index < nodeCount - 1; index += 1) {
      edges.push({
        key: `ring-${index}`,
        source: `node-${index}`,
        target: `node-${(index + 1) % (nodeCount - 1)}`,
        kind: 'reference',
        weight: 1,
      });
    }
    const request = directRequest({ nodeCount, edges });
    let calls = 0;
    const result = computeLocalLayout(
      request,
      noTimeout((graph) => {
        calls += 1;
        if (calls === 1) {
          graph.setNodeAttribute(`node-${nodeCount - 1}`, 'x', 100);
        }
      }),
    );
    expect(result.stopReason).toBe('stable');
    expect(result.batchesCompleted).toBe(4);
    expect(result.iterationsCompleted).toBe(128);
  });

  it('rounds only the final root-aligned output boundary', () => {
    const request = directRequest();
    let calls = 0;
    const result = computeLocalLayout(
      request,
      noTimeout((graph) => {
        calls += 1;
        if (calls !== 1) return;
        graph.setNodeAttribute('node-0', 'x', 0.123456789123);
        graph.setNodeAttribute('node-0', 'y', -0.987654321987);
        graph.setNodeAttribute('node-1', 'x', 2.111111119999);
        graph.setNodeAttribute('node-1', 'y', 3.222222229999);
      }),
    );
    expect(result.positions).toEqual([
      { key: 'node-0', x: 0, y: 0 },
      { key: 'node-1', x: 1.98765433, y: 4.20987655 },
    ]);
  });

  it('is deterministic for the same request', () => {
    const template = createLocalLayoutRequest(
      mapProjectionToLocal(localTestProjection(), 'root'),
    );
    const first = computeLocalLayout({ ...template, requestId: 1 });
    const second = computeLocalLayout({ ...template, requestId: 2 });
    expect(second.positions).toEqual(first.positions);
    expect(second.stopReason).toBe(first.stopReason);
    expect(second.iterationsCompleted).toBe(first.iterationsCompleted);
  });

  it('aborts only between batches with structured non-success evidence', () => {
    const request = directRequest();
    let clockCalls = 0;
    let thrown: unknown;
    try {
      computeLocalLayout(request, {
        assignBatch: () => undefined,
        maxWallTimeMs: 2_000,
        now: () => (clockCalls++ === 0 ? 0 : 2_001),
      });
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LocalLayoutMaxWallTimeError);
    const failure = createLocalLayoutFailure(request, thrown);
    expect(failure).toMatchObject({
      kind: 'error',
      code: 'max-wall-time',
      iterationsCompleted: 32,
      batchesCompleted: 1,
      computeMs: 2_001,
    });
    expect(failure.finalMovement).not.toBeNull();
    expect('positions' in failure).toBe(false);
    expect(validateLocalLayoutWorkerResponse(failure, request)).toEqual(
      failure,
    );
  });

  it('accepts a terminal stable batch before applying the between-batch timeout', () => {
    const request = directRequest();
    let clockCalls = 0;
    const result = computeLocalLayout(request, {
      assignBatch: () => undefined,
      maxWallTimeMs: 2_000,
      now: () => (clockCalls++ < 3 ? 0 : 2_001),
    });
    expect(result).toMatchObject({
      stopReason: 'stable',
      iterationsCompleted: 96,
      batchesCompleted: 3,
      stableBatches: 3,
      computeMs: 2_001,
    });
  });

  it('validates stable, cap, and degenerate results against the request policy', () => {
    const stableRequest = {
      ...createLocalLayoutRequest(
        mapProjectionToLocal(localTestProjection(), 'root'),
      ),
      requestId: 1,
    };
    const stable = computeLocalLayout(stableRequest);
    expect(validateLocalLayoutWorkerResponse(stable, stableRequest)).toEqual(
      stable,
    );

    const capRequest = directRequest({ nodeCount: 501 });
    const capped = computeLocalLayout(
      capRequest,
      noTimeout((graph) => {
        graph.forEachNode((key, attributes) => {
          if (key !== capRequest.rootKey) {
            graph.setNodeAttribute(key, 'x', -attributes.x || 1);
          }
        });
      }),
    );
    expect(validateLocalLayoutWorkerResponse(capped, capRequest)).toEqual(
      capped,
    );

    const degenerateRequest = directRequest({ nodeCount: 1 });
    const degenerate = computeLocalLayout(degenerateRequest);
    expect(
      validateLocalLayoutWorkerResponse(degenerate, degenerateRequest),
    ).toEqual(degenerate);
  });

  it('rejects malformed policy, counters, thresholds, movement, and node sets', () => {
    const request = {
      ...createLocalLayoutRequest(
        mapProjectionToLocal(localTestProjection(), 'root'),
      ),
      requestId: 1,
    };
    const result = computeLocalLayout(request);
    expect(() =>
      validateLocalLayoutWorkerResponse(
        { ...result, policyVersion: 'other' },
        request,
      ),
    ).toThrow(/policy version/);
    expect(() =>
      validateLocalLayoutWorkerResponse(
        { ...result, iterationsCompleted: result.iterationsCompleted + 1 },
        request,
      ),
    ).toThrow(/batch counters/);
    expect(() =>
      validateLocalLayoutWorkerResponse(
        {
          ...result,
          finalMovement: {
            ...result.finalMovement!,
            all: { ...result.finalMovement!.all, p90: 1, maximum: 1 },
          },
        },
        request,
      ),
    ).toThrow(/thresholds/);
    expect(() =>
      validateLocalLayoutWorkerResponse(
        { ...result, finalMovement: null },
        request,
      ),
    ).toThrow(/inconsistent/);
    expect(() =>
      validateLocalLayoutWorkerResponse(
        { ...result, positions: result.positions.slice(1) },
        request,
      ),
    ).toThrow(/omitted/);
  });
});

describe('Local convergence cache and fingerprint', () => {
  it('versions policy identity while excluding seed coordinates and timeout', () => {
    const request = createLocalLayoutRequest(
      mapProjectionToLocal(localTestProjection(), 'root'),
    );
    const moved = {
      ...request,
      nodes: request.nodes.map((node) => ({
        ...node,
        x: node.x + 50,
        y: node.y - 20,
      })),
    };
    const changed = {
      ...request,
      policy: { ...request.policy, maxIterations: 999 },
    };
    expect(localLayoutFingerprint(request)).toMatch(/^local-layout-v2-/);
    expect(localLayoutFingerprint(moved)).toBe(localLayoutFingerprint(request));
    expect(localLayoutFingerprint(changed as typeof request)).not.toBe(
      localLayoutFingerprint(request),
    );
  });

  it('keeps exact results in a bounded memory-only LRU', () => {
    const cache = new LocalLayoutCache(2);
    cache.set('a', [{ key: 'a', x: 0, y: 0 }]);
    cache.set('b', [{ key: 'b', x: 1, y: 1 }]);
    cache.get('a');
    cache.set('c', [{ key: 'c', x: 2, y: 2 }]);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toEqual([{ key: 'a', x: 0, y: 0 }]);
  });

  it('warms a remounted renderer from an exact cached position set', () => {
    const input: LocalRendererInput = mapProjectionToLocal(
      localTestProjection(),
      'root',
    );
    const positions = input.nodes.map((node, index) => ({
      key: node.key,
      x: index + 10,
      y: index - 10,
    }));
    const warmed = warmLocalRendererInput(input, positions);
    expect(
      warmed.nodes.map(({ attributes }) => [attributes.x, attributes.y]),
    ).toEqual(positions.map(({ x, y }) => [x, y]));
    expect(() => warmLocalRendererInput(input, positions.slice(1))).toThrow(
      'does not match the projected nodes',
    );
  });
});
