import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import { createLocalConvergenceDegreeIndex } from './local-convergence';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import { LocalLayoutCache } from './local-layout-cache';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
} from './local-layout';
import {
  mapProjectionToLocalTopology,
  seedLocalRendererInput,
} from './local-mapping';
import { localTestProjection } from './local-test-fixture';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  LocalConvergenceDistribution,
  LocalConvergenceMovement,
  LocalLayoutPosition,
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalLayoutService,
} from './local-types';

const noop = () => undefined;

function subsetProjection(projection: ViewProjection): ViewProjection {
  const kept = new Set(['entity:root', 'entity:heading', 'entity:neighbor']);
  return {
    ...projection,
    nodes: projection.nodes.filter(({ id }) => kept.has(id)),
    edges: projection.edges.filter(
      ({ sourceNodeId, targetNodeId }) =>
        kept.has(sourceNodeId) && kept.has(targetNodeId),
    ),
  };
}

function graphPositions(renderer: SigmaTestRenderer) {
  return renderer.graph
    .nodes()
    .map((key) => ({
      key,
      x: renderer.graph.getNodeAttribute(key, 'x') as number,
      y: renderer.graph.getNodeAttribute(key, 'y') as number,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function zeroDistribution(count: number): LocalConvergenceDistribution {
  return count === 0
    ? { count: 0, p50: null, p90: null, maximum: null }
    : { count, p50: 0, p90: 0, maximum: 0 };
}

function zeroMovement(
  request: Omit<LocalLayoutRequest, 'requestId'>,
): LocalConvergenceMovement {
  const degrees = createLocalConvergenceDegreeIndex(
    request.nodes.map(({ key }) => key),
    request.edges,
  );
  const counts = { degree0: 0, degree1: 0, degree2Plus: 0 };
  for (const degree of degrees.values()) {
    if (degree === 0) counts.degree0 += 1;
    else if (degree === 1) counts.degree1 += 1;
    else counts.degree2Plus += 1;
  }
  return {
    scale: 1,
    all: zeroDistribution(request.nodes.length),
    degree0: zeroDistribution(counts.degree0),
    degree1: zeroDistribution(counts.degree1),
    degree2Plus: zeroDistribution(counts.degree2Plus),
    lowDegree: zeroDistribution(counts.degree0 + counts.degree1),
  };
}

function result(
  request: Omit<LocalLayoutRequest, 'requestId'>,
  requestId: number,
  offset: number,
): LocalLayoutResult {
  return {
    schemaVersion: 2,
    kind: 'result',
    requestId,
    stopReason: 'stable',
    policyVersion: 'local-fa2-convergence-v1',
    iterationsCompleted: 96,
    batchesCompleted: 3,
    stableBatches: 3,
    finalMovement: zeroMovement(request),
    computeMs: 1,
    positions: request.nodes
      .map(({ key }, index) => ({
        key,
        x: key === request.rootKey ? 0 : offset + index,
        y: key === request.rootKey ? 0 : -offset - index,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
  };
}

function canvas(input: {
  readonly cache: LocalLayoutCache;
  readonly layoutRequestKey: number;
  readonly layoutService: LocalLayoutService;
  readonly projection: ViewProjection;
}) {
  return LocalGraphCanvas({
    projection: input.projection,
    rootEntityId: 'root',
    layoutRequestKey: input.layoutRequestKey,
    layoutService: input.layoutService,
    layoutCache: input.cache,
    onFailure: noop,
    onSelectionChange: noop,
    onViewportObservation: noop,
    selection: null,
    trackpadZoomMode: 'pinch-zoom',
  });
}

describe('Local bounded-convergence canvas adoption and cache', () => {
  beforeEach(() => {
    SigmaTestRenderer.instances = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('adopts one result on a miss and restores an older fingerprint exactly', async () => {
    const full = localTestProjection();
    const subset = subsetProjection(full);
    let projection = full;
    let requestId = 0;
    const accepted: LocalLayoutPosition[][] = [];
    const layout = vi.fn(
      async (request: Omit<LocalLayoutRequest, 'requestId'>) => {
        const value = result(request, ++requestId, requestId * 10);
        accepted.push([...value.positions]);
        return value;
      },
    );
    const layoutService = { layout, dispose: noop };
    const cache = new LocalLayoutCache();
    const harness = new CanvasTestHarness(() =>
      canvas({
        cache,
        layoutRequestKey: 0,
        layoutService,
        projection,
      }),
    );
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    projection = subset;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    projection = full;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    expect(graphPositions(SigmaTestRenderer.instances[0]!)).toEqual(
      accepted[0],
    );
    harness.destroy();
  });

  it('uses an initial exact cache hit without creating worker work', async () => {
    const projection = localTestProjection();
    const seeded = seedLocalRendererInput(
      mapProjectionToLocalTopology(projection, 'root'),
    );
    const template = createLocalLayoutRequest(seeded);
    const cached = result(template, 1, 40).positions;
    const cache = new LocalLayoutCache();
    cache.set(localLayoutFingerprint(template), cached);
    const layout = vi.fn();
    const layoutService = { layout, dispose: noop } as LocalLayoutService;
    const harness = new CanvasTestHarness(() =>
      canvas({
        cache,
        layoutRequestKey: 0,
        layoutService,
        projection,
      }),
    );
    await harness.flush();
    expect(layout).not.toHaveBeenCalled();
    expect(graphPositions(SigmaTestRenderer.instances[0]!)).toEqual(cached);
    harness.destroy();
  });

  it('evicts on explicit relayout, warm-starts current positions, and preserves them on failure', async () => {
    const projection = localTestProjection();
    const cache = new LocalLayoutCache();
    let layoutRequestKey = 0;
    let fail = false;
    const requests: Omit<LocalLayoutRequest, 'requestId'>[] = [];
    const layout = vi.fn(
      async (request: Omit<LocalLayoutRequest, 'requestId'>) => {
        requests.push(request);
        if (fail) throw new Error('max-wall-time');
        return result(request, requests.length, 25);
      },
    );
    const layoutService = { layout, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      canvas({
        cache,
        layoutRequestKey,
        layoutService,
        projection,
      }),
    );
    await harness.flush();
    const renderer = SigmaTestRenderer.instances[0]!;
    const accepted = graphPositions(renderer);
    fail = true;
    layoutRequestKey += 1;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    expect(
      requests[1]!.nodes
        .map(({ key, x, y }) => ({ key, x, y }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    ).toEqual(accepted);
    expect(graphPositions(renderer)).toEqual(accepted);
    const fingerprint = localLayoutFingerprint(
      createLocalLayoutRequest(
        seedLocalRendererInput(
          mapProjectionToLocalTopology(projection, 'root'),
        ),
      ),
    );
    expect(cache.get(fingerprint)).toBeUndefined();
    harness.destroy();
  });

  it('retains surviving automatic positions and seeds only new topology nodes', async () => {
    const full = localTestProjection();
    let projection = subsetProjection(full);
    const cache = new LocalLayoutCache();
    const requests: Omit<LocalLayoutRequest, 'requestId'>[] = [];
    const results: LocalLayoutResult[] = [];
    const layout = vi.fn(
      async (request: Omit<LocalLayoutRequest, 'requestId'>) => {
        requests.push(request);
        const value = result(request, requests.length, requests.length * 10);
        results.push(value);
        return value;
      },
    );
    const layoutService = { layout, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      canvas({
        cache,
        layoutRequestKey: 0,
        layoutService,
        projection,
      }),
    );
    await harness.flush();
    projection = full;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    const prior = new Map(
      results[0]!.positions.map((position) => [position.key, position]),
    );
    for (const node of requests[1]!.nodes) {
      const previous = prior.get(node.key);
      if (previous !== undefined) {
        expect({ x: node.x, y: node.y }).toEqual({
          x: previous.x,
          y: previous.y,
        });
      }
    }
    const seeded = seedLocalRendererInput(
      mapProjectionToLocalTopology(full, 'root'),
    );
    const seedByKey = new Map(
      seeded.nodes.map(({ key, attributes }) => [key, attributes]),
    );
    for (const node of requests[1]!.nodes.filter(
      ({ key }) => !prior.has(key),
    )) {
      expect({ x: node.x, y: node.y }).toEqual({
        x: seedByKey.get(node.key)!.x,
        y: seedByKey.get(node.key)!.y,
      });
    }
    harness.destroy();
  });
});
