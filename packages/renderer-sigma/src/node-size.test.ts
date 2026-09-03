import { describe, expect, it } from 'vitest';
import { mapProjectionToGlobal } from './mapping';
import { mapProjectionToLocalTopology } from './local-mapping';
import { globalTestProjection } from './test-fixture';
import { localTestProjection } from './local-test-fixture';
import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
} from './settings';
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
} from './local-layout';
import { applyNetworkNodeSizeScale } from './node-size';
import { resolveGlobalNodeStyle } from './style';
import { resolveGlobalLayoutSettings } from './settings';

describe('per-File Network sizing composition', () => {
  it('leaves All diagnostics unchanged and composes group color with custom size', () => {
    const base = globalTestProjection();
    const diagnostic = localTestProjection().nodes.find(
      (node) => node.kind === 'reference-target',
    )!;
    const projection = { ...base, nodes: [...base.nodes, diagnostic] };
    const auto = mapProjectionToGlobal(projection);
    const custom = mapProjectionToGlobal(
      projection,
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      new Map([
        ['doc-a', { sizeScale: 2 }],
        [diagnostic.id, { sizeScale: 2 }],
      ]),
    );
    expect(custom.nodes.at(-1)).toEqual(auto.nodes.at(-1));
    const attributes = custom.nodes.find(
      ({ key }) => key === 'entity:doc-a',
    )!.attributes;
    const style = resolveGlobalNodeStyle(attributes, {
      hovered: false,
      selected: false,
      relatedToHover: true,
      lod: 'near',
      settings: resolveGlobalLayoutSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS),
      visualGroup: { groupName: 'Group', color: 'violet', accent: '#7c3aed' },
    });
    expect(style.size).toBe(attributes.size);
    expect(style.color).toBe('#7c3aed');
  });
  it.each([0.5, 1, 1.5, 2.5])(
    'multiplies the VISUAL1A automatic size by %s, preserving topology',
    (sizeScale) => {
      const projection = globalTestProjection();
      const automatic = mapProjectionToGlobal(projection);
      const custom = mapProjectionToGlobal(
        projection,
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        new Map([['doc-a', { sizeScale }]]),
      );
      expect(custom.nodes.map(({ key }) => key)).toEqual(
        automatic.nodes.map(({ key }) => key),
      );
      expect(custom.edges).toEqual(automatic.edges);
      expect(
        custom.nodes.find(({ key }) => key === 'entity:doc-a')!.attributes.size,
      ).toBe(
        automatic.nodes.find(({ key }) => key === 'entity:doc-a')!.attributes
          .size * sizeScale,
      );
      expect(custom.nodes.filter(({ key }) => key !== 'entity:doc-a')).toEqual(
        automatic.nodes.filter(({ key }) => key !== 'entity:doc-a'),
      );
    },
  );

  it('applies a safe final cap after high degree/global size and preserves Auto exactly', () => {
    const base = globalTestProjection();
    const projection = {
      ...base,
      edges: base.edges.map((edge) =>
        edge.kind === 'reference'
          ? {
              ...edge,
              referenceIds: Array.from({ length: 10000 }, (_, i) => `r${i}`),
            }
          : edge,
      ),
    };
    const settings = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
      custom: {
        ...customGlobalLayoutSettings('normal'),
        nodeSize: 9,
        referenceDegreeSizeInfluence: 100,
      },
    };
    const auto = mapProjectionToGlobal(projection, settings);
    const scaled = mapProjectionToGlobal(
      projection,
      settings,
      new Map([['doc-a', { sizeScale: 2.5 }]]),
    );
    expect(
      auto.nodes.find(({ key }) => key === 'entity:doc-a')!.attributes.size,
    ).toBe(15);
    expect(
      scaled.nodes.find(({ key }) => key === 'entity:doc-a')!.attributes.size,
    ).toBe(24);
    expect(mapProjectionToGlobal(projection, settings, new Map())).toEqual(
      auto,
    );
    expect(applyNetworkNodeSizeScale(2, 0.5)).toBe(2);
    expect(() => applyNetworkNodeSizeScale(4, Infinity)).toThrow('Invalid');
  });

  it('shares multipliers with Focus, keeps root emphasis, and ignores non-File entries', () => {
    const projection = localTestProjection();
    const auto = mapProjectionToLocalTopology(projection, 'root');
    const overrides = new Map(
      projection.nodes.map((node) => [
        node.kind === 'entity' ? node.entityId : node.id,
        { sizeScale: 0.5 },
      ]),
    );
    const custom = mapProjectionToLocalTopology(projection, 'root', overrides);
    const sizes = Object.fromEntries(
      custom.nodes.map((node) => [node.key, node.attributes.size]),
    );
    expect(sizes).toEqual({
      'entity:root': 8.4,
      'entity:heading': 4.7,
      'entity:block': 3.1,
      'entity:neighbor': 3.2,
      'diagnostic:missing': 3.8,
    });
    expect(
      custom.nodes.filter(
        ({ attributes }) => attributes.nodeKind !== 'document',
      ),
    ).toEqual(
      auto.nodes.filter(({ attributes }) => attributes.nodeKind !== 'document'),
    );
    expect(custom.edges).toEqual(auto.edges);
    const larger = mapProjectionToLocalTopology(
      projection,
      'root',
      new Map([['root', { sizeScale: 2 }]]),
    );
    expect(larger.nodes[0]!.attributes.size).toBe(16.8);
  });

  it('makes final sizes part of both layout requests/fingerprints', () => {
    const all = (sizeScale: number) =>
      createGlobalLayoutRequest(
        mapProjectionToGlobal(
          globalTestProjection(),
          DEFAULT_GLOBAL_LAYOUT_SETTINGS,
          new Map([['doc-a', { sizeScale }]]),
        ),
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
        1,
      );
    const focus = (sizeScale: number) =>
      createLocalLayoutRequest(
        mapProjectionToLocalTopology(
          localTestProjection(),
          'root',
          new Map([['neighbor', { sizeScale }]]),
        ),
        1,
      );
    expect(globalLayoutFingerprint(all(1))).not.toBe(
      globalLayoutFingerprint(all(2)),
    );
    expect(localLayoutFingerprint(focus(1))).not.toBe(
      localLayoutFingerprint(focus(2)),
    );
    expect(all(2).nodes.find(({ key }) => key === 'entity:doc-a')!.size).toBe(
      all(1).nodes.find(({ key }) => key === 'entity:doc-a')!.size * 2,
    );
    expect(
      focus(2).nodes.find(({ key }) => key === 'entity:neighbor')!.size,
    ).toBe(12.8);
  });
});
