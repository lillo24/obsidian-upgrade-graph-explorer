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

describe('Global folder-aware layout', () => {
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
