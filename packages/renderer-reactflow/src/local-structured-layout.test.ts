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
  LOCAL_STRUCTURED_DIAGNOSTIC_NODE_DIMENSIONS,
  LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS,
  mapProjectionToReactFlow,
} from './mapping';
import { rendererTestProjection } from './test-fixture';

function localMapping() {
  return mapProjectionToReactFlow(
    rendererTestProjection(),
    'local-structured',
    { visualVariant: 'local-structured', rootEntityId: 'document-a' },
  );
}

describe('Local Structured schematic preparation', () => {
  it('maps the same projection once with compact, opt-in dimensions and root emphasis', () => {
    const projection = rendererTestProjection();
    const mapped = localMapping();
    const standard = mapProjectionToReactFlow(projection, 'focus');
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
      width: LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS.document.width,
      height: LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS.document.height,
      data: { root: true, visualVariant: 'local-structured' },
    });
    expect(root?.className).toContain('graph-node--local-root');
    expect(section).toMatchObject({
      width: LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS.section.width,
      height: LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS.section.height,
    });
    expect(diagnostic).toMatchObject({
      width: LOCAL_STRUCTURED_DIAGNOSTIC_NODE_DIMENSIONS.width,
      height: LOCAL_STRUCTURED_DIAGNOSTIC_NODE_DIMENSIONS.height,
    });
    expect(mapped.edges[0]).toMatchObject({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      data: { visualVariant: 'local-structured' },
    });
    const standardRoot = standard.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-document',
    );
    expect(standardRoot).toMatchObject({ width: 200, height: 80 });
    expect(standardRoot?.className).not.toContain('local-structured');
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
