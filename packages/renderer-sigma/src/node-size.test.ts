import { describe, expect, it } from 'vitest';
import { mapProjectionToGlobal } from './mapping';
import { mapProjectionToLocalTopology } from './local-mapping';
import { globalTestProjection } from './test-fixture';
import { localTestProjection } from './local-test-fixture';
import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  resolveGlobalLayoutSettings,
} from './settings';
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
} from './local-layout';
import { applyNetworkNodeSizeScale } from './node-size';
import { resolveGlobalNodeStyle } from './style';
import { resolveLocalNodeStyle } from './local-style';

const context = { hovered: false, selected: false, relatedToHover: true };
const settings = resolveGlobalLayoutSettings(DEFAULT_GLOBAL_LAYOUT_SETTINGS);

describe('render-only per-File size composition', () => {
  it.each([undefined, 0.5, 1, 1.3, 1.5, 2.5])(
    'scales only displayed All size by %s and leaves automatic input unchanged',
    (sizeScale) => {
      const input = mapProjectionToGlobal(globalTestProjection());
      const attributes = { ...input.nodes[0]!.attributes, size: 6 };
      const before = { ...attributes };
      const result = resolveGlobalNodeStyle(attributes, {
        ...context,
        lod: 'near',
        settings,
        ...(sizeScale === undefined ? {} : { sizeScale }),
      });
      expect(result.size).toBe(6 * (sizeScale ?? 1));
      expect(attributes).toEqual(before);
      expect(result.x).toBe(attributes.x);
      expect(result.y).toBe(attributes.y);
    },
  );

  it('composes Visual Groups and displayed-size LOD labels without changing thresholds', () => {
    const attributes = {
      ...mapProjectionToGlobal(globalTestProjection()).nodes[0]!.attributes,
      size: 6,
    };
    const styleContext = {
      ...context,
      lod: 'far' as const,
      settings: { ...settings, labelThreshold: 7 },
      visualGroup: {
        groupName: 'Group',
        color: 'violet' as const,
        accent: '#7c3aed',
      },
    };
    expect(resolveGlobalNodeStyle(attributes, styleContext).label).toBe('');
    expect(
      resolveGlobalNodeStyle(attributes, { ...styleContext, sizeScale: 1.5 }),
    ).toMatchObject({ size: 9, label: attributes.label, color: '#7c3aed' });
  });

  it('keeps normal VISUAL1A degree sizes in layout input, caps only displayed size', () => {
    const base = globalTestProjection();
    const projection = {
      ...base,
      edges: base.edges.map((edge) =>
        edge.kind === 'reference'
          ? {
              ...edge,
              referenceIds: Array.from({ length: 10000 }, (_, i) => 'r' + i),
            }
          : edge,
      ),
    };
    const custom = {
      folderClustering: true,
      spacingPreset: 'normal' as const,
      custom: {
        ...customGlobalLayoutSettings('normal'),
        nodeSize: 9,
        referenceDegreeSizeInfluence: 100,
      },
    };
    const input = mapProjectionToGlobal(projection, custom);
    const attributes = input.nodes[0]!.attributes;
    expect(attributes.size).toBe(15);
    expect(
      resolveGlobalNodeStyle(attributes, {
        ...context,
        lod: 'near',
        settings: resolveGlobalLayoutSettings(custom),
        sizeScale: 2.5,
      }).size,
    ).toBe(24);
    expect(attributes.size).toBe(15);
    expect(applyNetworkNodeSizeScale(2, 0.5)).toBe(2);
    expect(() => applyNetworkNodeSizeScale(4, Infinity)).toThrow('Invalid');
  });

  it('keeps Focus semantic sizes in topology, scales File display, and protects the root minimum', () => {
    const input = mapProjectionToLocalTopology(localTestProjection(), 'root');
    expect(
      Object.fromEntries(
        input.nodes.map(({ key, attributes }) => [key, attributes.size]),
      ),
    ).toEqual({
      'entity:root': 8.4,
      'entity:heading': 4.7,
      'entity:block': 3.1,
      'entity:neighbor': 6.4,
      'diagnostic:missing': 3.8,
    });
    const rendered = input.nodes.map(({ key, attributes }) => [
      key,
      resolveLocalNodeStyle(attributes, {
        ...context,
        lod: 'near-local',
        sizeScale: 0.5,
      }).size,
    ]);
    expect(Object.fromEntries(rendered)).toEqual({
      'entity:root': 8.4,
      'entity:heading': 4.7,
      'entity:block': 3.1,
      'entity:neighbor': 3.2,
      'diagnostic:missing': 3.8,
    });
    const file = input.nodes.find(
      ({ key }) => key === 'entity:neighbor',
    )!.attributes;
    expect(
      resolveLocalNodeStyle(file, {
        ...context,
        lod: 'near-local',
        sizeScale: 1.5,
        visualGroup: { groupName: 'Group', color: 'violet', accent: '#7c3aed' },
      }),
    ).toMatchObject({ size: 9.600000000000001, color: '#7c3aed' });
    const root = input.nodes[0]!.attributes;
    expect(
      resolveLocalNodeStyle(root, {
        ...context,
        lod: 'far-local',
        sizeScale: 2,
      }),
    ).toMatchObject({ size: 16.8, forceLabel: true });
  });

  it('never scales a diagnostic target even when a multiplier is supplied', () => {
    const diagnostic = localTestProjection().nodes.find(
      (node) => node.kind === 'reference-target',
    )!;
    const input = mapProjectionToGlobal({
      ...globalTestProjection(),
      nodes: [diagnostic],
      edges: [],
    });
    const attributes = input.nodes[0]!.attributes;
    expect(
      resolveGlobalNodeStyle(attributes, {
        ...context,
        lod: 'near',
        settings,
        sizeScale: 2.5,
      }).size,
    ).toBe(attributes.size);
  });

  it('excludes Global display radius but keeps Focus semantic size in layout identity', () => {
    const global = mapProjectionToGlobal(globalTestProjection());
    const local = mapProjectionToLocalTopology(localTestProjection(), 'root');
    const globalRequest = createGlobalLayoutRequest(
      global,
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      1,
    );
    const localRequest = createLocalLayoutRequest(local, 1);
    expect(
      globalLayoutFingerprint({
        ...globalRequest,
        nodes: globalRequest.nodes.map((node) => ({
          ...node,
          size: node.size + 1,
        })),
      }),
    ).toBe(globalLayoutFingerprint(globalRequest));
    expect(
      localLayoutFingerprint({
        ...localRequest,
        nodes: localRequest.nodes.map((node) => ({
          ...node,
          size: node.size + 1,
        })),
      }),
    ).not.toBe(localLayoutFingerprint(localRequest));
  });
});
