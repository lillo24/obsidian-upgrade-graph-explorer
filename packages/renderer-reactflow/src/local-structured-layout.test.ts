import { describe, expect, it } from 'vitest';

import { rendererNodeId } from './ids';
import {
  applyLocalStructuredPositions,
  LocalStructuredLayoutCache,
  localStructuredGraphPositions,
  localStructuredLayoutFingerprint,
  seedLocalStructuredGraph,
} from './local-structured-layout';
import {
  COMPACT_HIERARCHY_DIAGNOSTIC_NODE_DIMENSIONS,
  COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS,
  DIAGNOSTIC_NODE_DIMENSIONS,
  ENTITY_NODE_DIMENSIONS,
  mapProjectionToReactFlow,
} from './mapping';
import { rendererTestProjection } from './test-fixture';

function localMapping() {
  return mapProjectionToReactFlow(
    rendererTestProjection(),
    'local-structured',
    { visualVariant: 'extended', rootEntityId: 'document-a' },
  );
}

describe('Local Structured schematic preparation', () => {
  it('keeps Local Structured geometry independent from extended card density', () => {
    const projection = rendererTestProjection();
    const mapped = localMapping();
    const compact = mapProjectionToReactFlow(projection, 'structure', {
      visualVariant: 'compact-schematic',
    });
    const root = mapped.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-document',
    );
    const section = mapped.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-section',
    );
    const diagnostic = mapped.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-diagnostic',
    );

    expect(mapped.nodes).toHaveLength(projection.nodes.length);
    expect(mapped.edges).toHaveLength(projection.edges.length);
    expect(root).toMatchObject({
      width: ENTITY_NODE_DIMENSIONS.document.width,
      height: ENTITY_NODE_DIMENSIONS.document.height,
      data: { root: true, visualVariant: 'extended' },
    });
    expect(root?.className).toContain('graph-node--local-root');
    expect(section).toMatchObject({
      width: ENTITY_NODE_DIMENSIONS.section.width,
      height: ENTITY_NODE_DIMENSIONS.section.height,
    });
    expect(diagnostic).toMatchObject({
      width: DIAGNOSTIC_NODE_DIMENSIONS.width,
      height: DIAGNOSTIC_NODE_DIMENSIONS.height,
    });
    expect(mapped.edges[0]).toMatchObject({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: { visualVariant: 'extended' },
    });
    const compactRoot = compact.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-document',
    );
    expect(compactRoot).toMatchObject({
      width: COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS.document.width,
      height: COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS.document.height,
    });
    expect(
      compact.nodes.find(
        (node) => node.data.projectionNodeId === 'projection-diagnostic',
      ),
    ).toMatchObject(COMPACT_HIERARCHY_DIAGNOSTIC_NODE_DIMENSIONS);
    expect(compactRoot?.className).toContain('compact-schematic');
  });

  it('creates a deterministic, complete, finite, root-normalized immediate seed', () => {
    const mapped = localMapping();
    const rootId = rendererNodeId('projection-document');
    const first = seedLocalStructuredGraph(mapped.nodes, mapped.edges, rootId);
    const second = seedLocalStructuredGraph(mapped.nodes, mapped.edges, rootId);

    expect(second).toEqual(first);
    expect(first.nodes).toHaveLength(mapped.nodes.length);
    expect(first.nodes.find(({ id }) => id === rootId)?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(
      first.nodes.every(
        ({ position }) =>
          Number.isFinite(position.x) && Number.isFinite(position.y),
      ),
    ).toBe(true);
    expect(
      first.nodes.find(
        (node) => node.data.projectionNodeId === 'projection-section',
      )!.position.x,
    ).toBeGreaterThan(0);
  });

  it('keys only exact layout topology/dimensions and applies cached positions safely', () => {
    const mapped = localMapping();
    const rootId = rendererNodeId('projection-document');
    const seed = seedLocalStructuredGraph(mapped.nodes, mapped.edges, rootId);
    const fingerprint = localStructuredLayoutFingerprint(
      mapped.nodes,
      mapped.edges,
    );
    const relabeled = mapped.nodes.map((node) =>
      node.type === 'entity'
        ? {
            ...node,
            data: { ...node.data, title: 'Private label changed' },
          }
        : node,
    );
    const changedEdges = mapped.edges.map((edge, index) =>
      index === 0 ? { ...edge, id: `${edge.id}-changed` } : edge,
    );

    expect(localStructuredLayoutFingerprint(relabeled, mapped.edges)).toBe(
      fingerprint,
    );
    expect(
      localStructuredLayoutFingerprint(mapped.nodes, changedEdges),
    ).not.toBe(fingerprint);
    const compact = mapProjectionToReactFlow(
      rendererTestProjection(),
      'local-structured',
      { visualVariant: 'compact-schematic', rootEntityId: 'document-a' },
    );
    expect(
      localStructuredLayoutFingerprint(compact.nodes, compact.edges),
    ).not.toBe(fingerprint);
    expect(
      applyLocalStructuredPositions(
        mapped.nodes,
        mapped.edges,
        localStructuredGraphPositions(seed),
        rootId,
      ),
    ).toEqual(seed);
    expect(() =>
      applyLocalStructuredPositions(
        mapped.nodes,
        mapped.edges,
        localStructuredGraphPositions(seed).slice(1),
        rootId,
      ),
    ).toThrow(/cover every mapped node/);
  });

  it('keeps exact coordinates in a bounded memory-only cache', () => {
    const cache = new LocalStructuredLayoutCache(2);
    cache.set('a', [{ id: 'a', x: 1, y: 2 }]);
    cache.set('b', [{ id: 'b', x: 3, y: 4 }]);
    cache.set('c', [{ id: 'c', x: 5, y: 6 }]);

    expect(cache.get('a')).toBeUndefined();
    const hit = cache.get('b');
    expect(hit).toEqual([{ id: 'b', x: 3, y: 4 }]);
    expect(hit).not.toBe(cache.get('b'));
  });
});
