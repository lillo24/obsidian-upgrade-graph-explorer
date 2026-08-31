import { describe, expect, it } from 'vitest';

import { buildGlobalGraph, reconcileGlobalGraph } from './graph';
import {
  deriveGlobalSpatialMetadata,
  folderKeyFromWorkspacePath,
  mapProjectionToGlobal,
} from './mapping';
import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from './settings';
import { globalTestProjection } from './test-fixture';

describe('production Global mapping', () => {
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
