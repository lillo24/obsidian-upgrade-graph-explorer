import { describe, expect, it } from 'vitest';

import {
  computeGlobalSpatialInfluence,
  createGlobalSpatialInfluenceRequest,
  globalSpatialInfluenceFingerprint,
  validateGlobalSpatialInfluenceWorkerResponse,
} from './spatial-influence';
import { resolveFolderSpatialRules } from '@icarus-graph-explorer/spatial-overrides';
import { GlobalSpatialInfluenceCache } from './spatial-influence-cache';
import type {
  GlobalRendererInput,
  GlobalSpatialInfluenceRequest,
} from './types';

function request(
  algorithm: GlobalSpatialInfluenceRequest['algorithm'] = 'interleaved-centroid',
  strength = 75,
): GlobalSpatialInfluenceRequest {
  return {
    schemaVersion: 1,
    requestId: 1,
    algorithm,
    algorithmVersion: 1,
    baseLayoutFingerprint: 'base-v1-test',
    iterations: 24,
    globalLayoutSettings: {
      folderClustering: false,
      spacingPreset: 'normal',
    },
    nodes: [
      { key: 'a', x: -4, y: -1, size: 1 },
      { key: 'b', x: -3, y: 1, size: 1 },
      { key: 'c', x: 1, y: 0, size: 1 },
      { key: 'd', x: 4, y: 1, size: 1 },
      { key: 'e', x: 5, y: -1, size: 1 },
    ],
    edges: [
      { key: 'ab', source: 'a', target: 'b', weight: 1 },
      { key: 'bc', source: 'b', target: 'c', weight: 3 },
      { key: 'cd', source: 'c', target: 'd', weight: 2 },
      { key: 'de', source: 'd', target: 'e', weight: 1 },
    ],
    attractors: [
      {
        ruleFolderKey: 'affected',
        memberNodeKeys: ['a', 'b'],
        targetX: 6,
        targetY: 0,
        strength,
      },
    ],
  };
}

function point(
  result: ReturnType<typeof computeGlobalSpatialInfluence>,
  key: string,
) {
  return result.positions.find((position) => position.key === key)!;
}

describe('Global soft folder attractor', () => {
  it('serializes only dynamic winning intent and excludes fixed rules', () => {
    const input: GlobalRendererInput = {
      projectionIssues: [],
      nodes: [
        {
          key: 'a',
          attributes: {
            x: 0,
            y: 1,
            size: 2,
            color: '#000',
            label: 'private label',
            nodeKind: 'document',
            entityId: 'private entity',
            sourcePath: 'private/path.md',
            status: null,
            folderKey: 'Parent',
            revealableDescendantCount: 0,
          },
        },
        {
          key: 'b',
          attributes: {
            x: 2,
            y: 1,
            size: 1,
            color: '#000',
            label: 'child',
            nodeKind: 'document',
            entityId: 'child entity',
            sourcePath: 'Parent/Child/b.md',
            status: null,
            folderKey: 'Parent/Child',
            revealableDescendantCount: 0,
          },
        },
      ],
      edges: [],
    };
    const pull = {
      folderKey: 'Parent',
      behavior: 'pull',
      scope: { kind: 'subtree', includeRootFiles: true, excludedSubtrees: [] },
      anchor: { x: 1, y: 0 },
      strength: 75,
    } as const;
    const place = {
      folderKey: 'Parent/Child',
      behavior: 'place',
      scope: { kind: 'exact' },
      anchor: { x: -1, y: 0 },
    } as const;
    const folders = new Map([
      ['a', 'Parent'],
      ['b', 'Parent/Child'],
    ]);
    const make = (fixedX: number, pullX = 1) =>
      createGlobalSpatialInfluenceRequest(
        input,
        { folderClustering: false, spacingPreset: 'normal' },
        5,
        [
          { key: 'a', x: 0, y: 1 },
          { key: 'b', x: 2, y: 1 },
        ],
        'base',
        resolveFolderSpatialRules({
          rules: [
            { ...pull, anchor: { x: pullX, y: 0 } },
            { ...place, anchor: { x: fixedX, y: 0 } },
          ],
          folderKeyByNodeKey: folders,
        }),
      );
    const first = make(-1);
    expect(first.attractors).toMatchObject([
      { ruleFolderKey: 'Parent', memberNodeKeys: ['a'], strength: 75 },
    ]);
    expect(Object.keys(first.nodes[0]!).sort()).toEqual([
      'key',
      'size',
      'x',
      'y',
    ]);
    expect(JSON.stringify(first)).not.toContain('private/path.md');
    expect(globalSpatialInfluenceFingerprint(make(0.5))).toBe(
      globalSpatialInfluenceFingerprint(first),
    );
    const custom = first.globalLayoutSettings.custom!;
    expect(
      globalSpatialInfluenceFingerprint({
        ...first,
        globalLayoutSettings: {
          ...first.globalLayoutSettings,
          custom: {
            ...custom,
            nodeSize: custom.nodeSize + 1,
            referenceDegreeSizeInfluence:
              custom.referenceDegreeSizeInfluence + 0.1,
            linkThickness: custom.linkThickness + 0.1,
            labelThreshold: custom.labelThreshold + 1,
          },
        },
      }),
    ).toBe(globalSpatialInfluenceFingerprint(first));
    expect(globalSpatialInfluenceFingerprint(make(-1, -1))).not.toBe(
      globalSpatialInfluenceFingerprint(first),
    );
  });

  it('is deterministic and input-order independent', () => {
    const first = computeGlobalSpatialInfluence(request());
    const reordered = request();
    const second = computeGlobalSpatialInfluence({
      ...reordered,
      nodes: [...reordered.nodes].reverse(),
      edges: [...reordered.edges].reverse(),
      attractors: reordered.attractors.map((item) => ({
        ...item,
        memberNodeKeys: [...item.memberNodeKeys].reverse(),
      })),
    });
    expect(second.positions).toEqual(first.positions);
    expect(second.metrics).toEqual(first.metrics);
    expect(
      first.positions.every(
        ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
      ),
    ).toBe(true);
  });

  it('makes strength zero an exact no-pull path', () => {
    const input = request('interleaved-centroid', 0);
    const result = computeGlobalSpatialInfluence(input);
    expect(result.positions).toEqual(
      [...input.nodes]
        .map(({ key, x, y }) => ({ key, x, y }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    );
    expect(result.forceAtlasMs).toBe(0);
    expect(result.attractorMs).toBe(0);
  });

  it('selects interleaved influence from measurable dynamicity evidence', () => {
    const interleaved = computeGlobalSpatialInfluence(
      request('interleaved-centroid'),
    );
    const moveThenRelax = computeGlobalSpatialInfluence(
      request('move-then-relax'),
    );
    expect(interleaved.metrics.meanTargetError).toBeLessThan(
      moveThenRelax.metrics.meanTargetError,
    );
    expect(interleaved.metrics.meanAffectedDisplacement).toBeGreaterThan(0);
    expect(interleaved.metrics.meanUnaffectedDisplacement).toBeGreaterThan(0);
    expect(
      interleaved.metrics.meanCrossBoundaryReferenceLength,
    ).toBeGreaterThan(0);
    const baseDistance = Math.hypot(-4 - -3, -1 - 1);
    const finalDistance = Math.hypot(
      point(interleaved, 'a').x - point(interleaved, 'b').x,
      point(interleaved, 'a').y - point(interleaved, 'b').y,
    );
    expect(finalDistance).not.toBeCloseTo(baseDistance, 4);
  });

  it('fingerprints dynamic intent but ignores request ids', () => {
    const template = request();
    expect(globalSpatialInfluenceFingerprint(template)).toBe(
      globalSpatialInfluenceFingerprint(template),
    );
    expect(
      globalSpatialInfluenceFingerprint({
        ...template,
        attractors: template.attractors.map((item) => ({
          ...item,
          strength: 25,
        })),
      }),
    ).not.toBe(globalSpatialInfluenceFingerprint(template));
  });

  it('validates results and rejects malformed or stale output', () => {
    const result = computeGlobalSpatialInfluence(request());
    expect(
      validateGlobalSpatialInfluenceWorkerResponse(
        result,
        1,
        request().nodes.map(({ key }) => key),
      ),
    ).toEqual(result);
    expect(() =>
      validateGlobalSpatialInfluenceWorkerResponse(result, 2, ['a']),
    ).toThrow('request 2');
  });

  it('keeps a bounded copy-on-read dynamic cache', () => {
    const cache = new GlobalSpatialInfluenceCache(2);
    cache.set('a', [{ key: 'a', x: 1, y: 2 }]);
    cache.set('b', [{ key: 'b', x: 2, y: 3 }]);
    expect(cache.get('a')).toEqual([{ key: 'a', x: 1, y: 2 }]);
    cache.set('c', [{ key: 'c', x: 3, y: 4 }]);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2);
  });
});
