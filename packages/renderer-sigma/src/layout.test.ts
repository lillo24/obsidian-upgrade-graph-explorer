import { describe, expect, it } from 'vitest';

import { GlobalLayoutCache } from './layout-cache';
import {
  computeGlobalLayout,
  createGlobalLayoutRequest,
  globalLayoutFingerprint,
  warmGlobalRendererInput,
} from './layout';
import { mapProjectionToGlobal } from './mapping';
import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  withFolderClusteringStrength,
  resolveGlobalLayoutSettings,
  validateGlobalLayoutSettings,
} from './settings';
import { globalTestProjection } from './test-fixture';

function request(
  algorithm: 'reference-only' | 'chunked-prior' | 'offset-field',
) {
  const settings = {
    ...DEFAULT_GLOBAL_LAYOUT_SETTINGS,
    folderClustering: algorithm !== 'reference-only',
  };
  return {
    ...createGlobalLayoutRequest(
      mapProjectionToGlobal(globalTestProjection(), settings),
      settings,
      20,
      algorithm,
    ),
    requestId: 1,
  } as const;
}

function positionDistance(
  positions: readonly {
    readonly key: string;
    readonly x: number;
    readonly y: number;
  }[],
  leftKey: string,
  rightKey: string,
): number {
  const left = positions.find(({ key }) => key === leftKey)!;
  const right = positions.find(({ key }) => key === rightKey)!;
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function referencePullRequest(linkForce: number) {
  const settings = {
    folderClustering: false,
    spacingPreset: 'normal' as const,
    custom: {
      ...customGlobalLayoutSettings('normal'),
      linkForce,
    },
  };
  return {
    schemaVersion: 1 as const,
    requestId: 1,
    algorithm: 'reference-only' as const,
    iterations: 200,
    settings,
    nodes: [
      { key: 'root', x: 0, y: 0, size: 1 },
      { key: 'reference', x: 8, y: 1, size: 1 },
      { key: 'other', x: -5, y: 3, size: 1 },
    ],
    edges: [
      {
        key: 'reference-edge',
        source: 'root',
        target: 'reference',
        weight: 4,
      },
      {
        key: 'ordinary-edge',
        source: 'root',
        target: 'other',
        weight: 1,
      },
    ],
  };
}

describe('Global folder-aware layout', () => {
  it('maps weak, default, and strong Reference Pull to increasing Global attraction', () => {
    const weak = computeGlobalLayout(referencePullRequest(0.25));
    const normal = computeGlobalLayout(referencePullRequest(1));
    const strong = computeGlobalLayout(referencePullRequest(2));
    const weakDistance = positionDistance(weak.positions, 'root', 'reference');
    const normalDistance = positionDistance(
      normal.positions,
      'root',
      'reference',
    );
    const strongDistance = positionDistance(
      strong.positions,
      'root',
      'reference',
    );

    expect(normalDistance).toBeLessThan(weakDistance);
    expect(strongDistance).toBeLessThan(normalDistance);
  });

  it('keeps Off reference-only and changes positions rather than edges when On', () => {
    const baseline = computeGlobalLayout(request('reference-only'));
    const clustered = computeGlobalLayout(request('chunked-prior'));
    expect(baseline.algorithm).toBe('reference-only');
    expect(clustered.algorithm).toBe('chunked-prior');
    expect(clustered.positions).not.toEqual(baseline.positions);
    expect(clustered.positions).toHaveLength(
      request('chunked-prior').nodes.length,
    );
  });

  it('is deterministic and compares both documented soft-prior candidates', () => {
    const chunked = computeGlobalLayout(request('chunked-prior'));
    const repeated = computeGlobalLayout(request('chunked-prior'));
    const offset = computeGlobalLayout(request('offset-field'));
    expect(chunked.positions).toEqual(repeated.positions);
    expect(chunked.metrics).toEqual(repeated.metrics);
    expect(offset.positions).not.toEqual(chunked.positions);
    expect(chunked.metrics.meanCrossFolderReferenceLength).toBeGreaterThan(0);
    expect(offset.metrics.meanCrossFolderReferenceLength).toBeGreaterThan(0);
  });

  it.each([0, 100])(
    'keeps folder strength %i finite, deterministic, and topology-neutral',
    (strength) => {
      const base = request('chunked-prior');
      const settings = withFolderClusteringStrength(base.settings, strength);
      const configured = { ...base, settings };
      const first = computeGlobalLayout(configured);
      const repeated = computeGlobalLayout(configured);

      expect(repeated.positions).toEqual(first.positions);
      expect(
        first.positions.every(
          ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
        ),
      ).toBe(true);
      expect(configured.edges).toEqual(base.edges);
    },
  );

  it('keeps strong cross-folder reference edges influential at maximum strength', () => {
    const base = request('chunked-prior');
    const settings = withFolderClusteringStrength(base.settings, 100);
    const ordinary = computeGlobalLayout({ ...base, settings });
    const strong = computeGlobalLayout({
      ...base,
      settings,
      edges: base.edges.map((edge) =>
        edge.key === 'edge-ac' ? { ...edge, weight: 40 } : edge,
      ),
    });

    expect(strong.positions).not.toEqual(ordinary.positions);
    expect(strong.metrics.meanCrossFolderReferenceLength).toBeGreaterThan(0);
  });

  it('validates presets and every custom bound', () => {
    for (const preset of ['compact', 'normal', 'spacious'] as const) {
      expect(
        resolveGlobalLayoutSettings({
          folderClustering: true,
          spacingPreset: preset,
        }).spacingPreset,
      ).toBe(preset);
      expect(customGlobalLayoutSettings(preset).nodeSize).toBeGreaterThan(0);
    }
    expect(() =>
      validateGlobalLayoutSettings({
        ...DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        custom: {
          ...customGlobalLayoutSettings('normal'),
          folderCohesion: 2,
        },
      }),
    ).toThrow('folderCohesion');
  });

  it('fingerprints topology, folder and settings but not warm-seed coordinates', () => {
    const base = request('chunked-prior');
    const movedSeed = {
      ...base,
      nodes: base.nodes.map((node) => ({ ...node, x: node.x + 99 })),
    };
    const movedFolder = {
      ...base,
      nodes: base.nodes.map((node, index) =>
        index === 0 ? { ...node, folderKey: 'renamed' } : node,
      ),
    };
    const changedSettings = {
      ...base,
      settings: { ...base.settings, spacingPreset: 'spacious' as const },
    };
    expect(globalLayoutFingerprint(movedSeed)).toBe(
      globalLayoutFingerprint(base),
    );
    expect(globalLayoutFingerprint(movedFolder)).not.toBe(
      globalLayoutFingerprint(base),
    );
    expect(globalLayoutFingerprint(changedSettings)).not.toBe(
      globalLayoutFingerprint(base),
    );
  });

  it('fingerprints only settings and topology consumed by current physics', () => {
    const baselineSettings = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
      custom: customGlobalLayoutSettings('normal'),
    };
    const makeRequest = (settings: typeof baselineSettings) =>
      createGlobalLayoutRequest(
        mapProjectionToGlobal(globalTestProjection(), settings),
        settings,
        20,
      );
    const baseline = makeRequest(baselineSettings);
    for (const [key, value] of [
      ['nodeSize', 8],
      ['referenceDegreeSizeInfluence', 90],
      ['linkThickness', 1.8],
      ['labelThreshold', 13],
    ] as const) {
      const visual = makeRequest({
        ...baselineSettings,
        custom: { ...baselineSettings.custom, [key]: value },
      });
      expect(globalLayoutFingerprint(visual), key).toBe(
        globalLayoutFingerprint(baseline),
      );
      expect(visual.edges.map(({ weight }) => weight)).toEqual(
        baseline.edges.map(({ weight }) => weight),
      );
    }
    for (const [key, value] of [
      ['linkForce', 1.4],
      ['folderCohesion', 0.12],
      ['withinFolderSpacing', 1.8],
      ['betweenFolderSpacing', 5],
    ] as const) {
      const physics = makeRequest({
        ...baselineSettings,
        custom: { ...baselineSettings.custom, [key]: value },
      });
      expect(globalLayoutFingerprint(physics), key).not.toBe(
        globalLayoutFingerprint(baseline),
      );
    }
    expect(
      globalLayoutFingerprint({
        ...baseline,
        settings: { ...baselineSettings, folderClustering: false },
        algorithm: 'reference-only',
      }),
    ).not.toBe(globalLayoutFingerprint(baseline));
  });

  it('keeps transported node size inert while ForceAtlas2 adjustSizes is disabled', () => {
    const baseline = request('chunked-prior');
    const resized = {
      ...baseline,
      nodes: baseline.nodes.map((node, index) => ({
        ...node,
        size: node.size + index + 100,
      })),
    };

    expect(computeGlobalLayout(resized).positions).toEqual(
      computeGlobalLayout(baseline).positions,
    );
    expect(globalLayoutFingerprint(resized)).toBe(
      globalLayoutFingerprint(baseline),
    );
  });

  it('provides exact memory-only LRU hits and bounded eviction', () => {
    const cache = new GlobalLayoutCache(2);
    const positions = [{ key: 'a', x: 1, y: 2 }] as const;
    cache.set('one', positions);
    cache.set('two', positions);
    expect(cache.get('one')).toEqual(positions);
    cache.set('three', positions);
    expect(cache.get('two')).toBeUndefined();
    expect(cache.get('one')).toEqual(positions);
    expect(cache.size).toBe(2);
  });

  it('warms a remounted renderer from an exact cached position set', () => {
    const input = mapProjectionToGlobal(
      globalTestProjection(),
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
    );
    const positions = input.nodes.map((node, index) => ({
      key: node.key,
      x: index + 20,
      y: index - 20,
    }));

    const warmed = warmGlobalRendererInput(input, positions);

    expect(
      warmed.nodes.map(({ attributes }) => [attributes.x, attributes.y]),
    ).toEqual(positions.map(({ x, y }) => [x, y]));
    expect(() => warmGlobalRendererInput(input, positions.slice(1))).toThrow(
      'does not match the projected nodes',
    );
  });
});
