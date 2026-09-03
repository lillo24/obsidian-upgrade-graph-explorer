import { describe, expect, it } from 'vitest';

import { buildGlobalGraph, reconcileGlobalGraph } from './graph';
import {
  deriveGlobalSpatialMetadata,
  folderKeyFromWorkspacePath,
  mapProjectionToGlobal,
  referenceDegreeSizeBoost,
} from './mapping';
import {
  customGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE,
} from './settings';
import { globalTestProjection } from './test-fixture';

describe('production Global mapping', () => {
  it('preserves the exact legacy curve at the default influence', () => {
    const expectedLegacyBoost = Math.min(4, Math.log2(3) * 0.48);
    expect(
      referenceDegreeSizeBoost(2, DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE),
    ).toBe(expectedLegacyBoost);
    const mapped = mapProjectionToGlobal(
      globalTestProjection(),
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
    );
    expect(
      mapped.nodes.find(({ key }) => key === 'entity:doc-a')?.attributes.size,
    ).toBe(4.5 + expectedLegacyBoost);
  });

  it('scales degree monotonically from none to a bounded strong influence', () => {
    const degrees = [0, 1, 2, 10, 100, 1_000];
    const none = degrees.map((degree) => referenceDegreeSizeBoost(degree, 0));
    const ordinary = degrees.map((degree) =>
      referenceDegreeSizeBoost(degree, DEFAULT_REFERENCE_DEGREE_SIZE_INFLUENCE),
    );
    const strong = degrees.map((degree) =>
      referenceDegreeSizeBoost(degree, 100),
    );

    expect(none).toEqual([0, 0, 0, 0, 0, 0]);
    expect(
      ordinary.every(
        (value, index) => index === 0 || value >= ordinary[index - 1]!,
      ),
    ).toBe(true);
    expect(
      strong.every(
        (value, index) => index === 0 || value >= strong[index - 1]!,
      ),
    ).toBe(true);
    expect(strong[3]).toBeGreaterThan(ordinary[3]!);
    expect(strong.at(-1)).toBeLessThanOrEqual(6);
  });

  it('uses occurrence-weighted degree for documents and keeps diagnostics separate', () => {
    const base = globalTestProjection();
    const document = base.nodes[0]!;
    const diagnostic = {
      id: 'diagnostic:missing',
      kind: 'reference-target' as const,
      status: 'unresolved' as const,
      rawTarget: 'Missing',
      referenceIds: ['reference:missing'],
      candidateEntityIds: [],
      reasons: [],
    };
    const projection = {
      ...base,
      nodes: [document, base.nodes[1]!, diagnostic],
      edges: [
        {
          ...base.edges[0]!,
          referenceIds: ['r1', 'r2', 'r3', 'r4'],
        },
      ],
    };
    const withInfluence = (referenceDegreeSizeInfluence: number) =>
      mapProjectionToGlobal(projection, {
        folderClustering: true,
        spacingPreset: 'normal',
        custom: {
          ...customGlobalLayoutSettings('normal'),
          referenceDegreeSizeInfluence,
        },
      });
    const none = withInfluence(0);
    const ordinary = withInfluence(50);
    const strong = withInfluence(100);
    const size = (input: typeof none, key: string) =>
      input.nodes.find((node) => node.key === key)!.attributes.size;

    expect(size(none, document.id)).toBe(4.5);
    expect(size(ordinary, document.id)).toBe(
      4.5 + referenceDegreeSizeBoost(4, 50),
    );
    expect(size(strong, document.id)).toBeGreaterThan(
      size(ordinary, document.id),
    );
    expect(size(none, diagnostic.id)).toBe(2.79);
    expect(size(strong, diagnostic.id)).toBe(2.79);
  });

  it('derives normalized root and nested folder metadata without graph edges', () => {
    expect(folderKeyFromWorkspacePath('Root.md')).toBe('.');
    expect(folderKeyFromWorkspacePath('alpha/nested/A.md')).toBe(
      'alpha/nested',
    );
    expect(() => folderKeyFromWorkspacePath('../outside.md')).toThrow(
      'invalid workspace path',
    );

    const projection = globalTestProjection();
    const metadata = deriveGlobalSpatialMetadata(projection);
    expect(metadata.folderKeyByProjectionNodeId.get('entity:doc-a')).toBe(
      'alpha',
    );
    expect(metadata.folderKeyByProjectionNodeId.get('entity:doc-root')).toBe(
      '.',
    );
    expect(
      mapProjectionToGlobal(projection, DEFAULT_GLOBAL_LAYOUT_SETTINGS).edges,
    ).toHaveLength(projection.edges.length);
  });

  it('rejects headings and hierarchy edges at the renderer boundary', () => {
    const projection = globalTestProjection();
    const document = projection.nodes[0]!;
    if (document.kind !== 'entity')
      throw new Error('Expected document fixture.');
    expect(() =>
      mapProjectionToGlobal(
        {
          ...projection,
          nodes: [
            ...projection.nodes,
            {
              ...document,
              id: 'entity:section',
              entityId: 'section',
              entityKind: 'section',
              title: 'Heading',
            },
          ],
        },
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      ),
    ).toThrow('Global must remain documents-only');
    expect(() =>
      mapProjectionToGlobal(
        {
          ...projection,
          edges: [
            ...projection.edges,
            {
              id: 'hierarchy',
              kind: 'hierarchy',
              sourceNodeId: 'entity:doc-a',
              targetNodeId: 'entity:doc-b',
            },
          ],
        },
        DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      ),
    ).toThrow('hierarchy edge');
  });

  it('preserves stable coordinates and selection keys across path moves', () => {
    const initial = mapProjectionToGlobal(
      globalTestProjection(),
      DEFAULT_GLOBAL_LAYOUT_SETTINGS,
    );
    const graph = buildGlobalGraph(initial);
    graph.mergeNodeAttributes('entity:doc-a', { x: 42, y: -8 });
    const movedProjection = {
      ...globalTestProjection(),
      nodes: globalTestProjection().nodes.map((node) =>
        node.kind === 'entity' && node.entityId === 'doc-a'
          ? { ...node, sourcePath: 'moved/A.md' }
          : node,
      ),
    };
    const reconciliation = reconcileGlobalGraph(
      graph,
      mapProjectionToGlobal(movedProjection, DEFAULT_GLOBAL_LAYOUT_SETTINGS),
    );

    expect(reconciliation.nodesUpdated).toBe(1);
    expect(graph.hasNode('entity:doc-a')).toBe(true);
    expect(graph.getNodeAttributes('entity:doc-a')).toMatchObject({
      x: 42,
      y: -8,
      folderKey: 'moved',
    });
  });
});
