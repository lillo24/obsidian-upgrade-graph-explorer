import { describe, expect, it } from 'vitest';

import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

import {
  buildGlobalGraph,
  createNeighborhoodIndex,
  reconcileGlobalGraph,
} from './graph';
import { deterministicPosition, mapProjectionToGlobal } from './mapping';

const PROJECTION: ViewProjection = {
  nodes: [
    {
      id: '["entity","document-a"]',
      kind: 'entity',
      entityId: 'document-a',
      entityKind: 'document',
      sourcePath: 'a.md',
      sourceStartLine: 1,
      title: null,
      revealableDescendantCount: 2,
      internalReferenceIds: [],
      role: 'content',
      focusDistance: null,
    },
    {
      id: '["entity","document-b"]',
      kind: 'entity',
      entityId: 'document-b',
      entityKind: 'document',
      sourcePath: 'b.md',
      sourceStartLine: 1,
      title: null,
      revealableDescendantCount: 0,
      internalReferenceIds: [],
      role: 'content',
      focusDistance: null,
    },
  ],
  edges: [
    {
      id: 'reference-a-b',
      kind: 'reference',
      sourceNodeId: '["entity","document-a"]',
      targetNodeId: '["entity","document-b"]',
      status: 'resolved',
      referenceIds: ['reference-1', 'reference-2'],
    },
  ],
  issues: [],
};

describe('global renderer mapping', () => {
  it('preserves stable projection keys and aggregated provenance counts', () => {
    const input = mapProjectionToGlobal(PROJECTION);

    expect(input.nodes.map((node) => node.key)).toEqual(
      PROJECTION.nodes.map((node) => node.id),
    );
    expect(input.edges).toEqual([
      expect.objectContaining({
        key: 'reference-a-b',
        source: '["entity","document-a"]',
        target: '["entity","document-b"]',
        attributes: expect.objectContaining({ referenceCount: 2 }),
      }),
    ]);
  });

  it('uses reproducible non-zero positions derived only from stable keys', () => {
    const first = deterministicPosition('["entity","document-a"]');
    const second = deterministicPosition('["entity","document-a"]');

    expect(first).toEqual(second);
    expect(Math.abs(first.x) + Math.abs(first.y)).toBeGreaterThan(0);
  });

  it('rejects duplicate keys and missing endpoints loudly', () => {
    expect(() =>
      mapProjectionToGlobal({
        ...PROJECTION,
        nodes: [...PROJECTION.nodes, PROJECTION.nodes[0]!],
      }),
    ).toThrow(/duplicate node ID/);
    expect(() =>
      mapProjectionToGlobal({
        ...PROJECTION,
        edges: [
          {
            ...PROJECTION.edges[0]!,
            targetNodeId: 'missing',
          },
        ],
      }),
    ).toThrow(/missing endpoint/);
  });
});

describe('derived Graphology lifecycle', () => {
  it('indexes direct neighbors in both directions', () => {
    const input = mapProjectionToGlobal(PROJECTION);
    const neighborhoods = createNeighborhoodIndex(input);

    expect(neighborhoods.get('["entity","document-a"]')).toEqual(
      new Set(['["entity","document-b"]']),
    );
    expect(neighborhoods.get('["entity","document-b"]')).toEqual(
      new Set(['["entity","document-a"]']),
    );
  });

  it('mutates a mounted graph by stable key while retaining existing positions', () => {
    const input = mapProjectionToGlobal(PROJECTION);
    const graph = buildGlobalGraph(input);
    graph.setNodeAttribute('["entity","document-a"]', 'x', 42);
    const changed = mapProjectionToGlobal({
      ...PROJECTION,
      nodes: [
        {
          ...(PROJECTION.nodes[0]! as Extract<
            ViewProjection['nodes'][number],
            { kind: 'entity' }
          >),
          revealableDescendantCount: 4,
        },
        PROJECTION.nodes[1]!,
      ],
      edges: [],
    });

    const result = reconcileGlobalGraph(graph, changed);

    expect(result.edgesRemoved).toBe(1);
    expect(graph.size).toBe(0);
    expect(graph.getNodeAttribute('["entity","document-a"]', 'x')).toBe(42);
    expect(
      graph.getNodeAttribute(
        '["entity","document-a"]',
        'revealableDescendantCount',
      ),
    ).toBe(4);
  });

  it('handles node add/remove, reference-only, and filtered projection updates without replacing the graph', () => {
    const original = mapProjectionToGlobal(PROJECTION);
    const graph = buildGlobalGraph(original);
    const filtered = mapProjectionToGlobal({
      nodes: [PROJECTION.nodes[0]!],
      edges: [],
      issues: [],
    });
    const filteredResult = reconcileGlobalGraph(graph, filtered);

    expect(filteredResult).toEqual(
      expect.objectContaining({ nodesRemoved: 1, edgesRemoved: 1 }),
    );
    expect(graph.order).toBe(1);

    const restored = reconcileGlobalGraph(graph, original);
    expect(restored).toEqual(
      expect.objectContaining({ nodesAdded: 1, edgesAdded: 1 }),
    );
    expect(graph.order).toBe(2);

    const referenceOnly = {
      ...original,
      edges: original.edges.map((edge) => ({
        ...edge,
        attributes: { ...edge.attributes, referenceCount: 3 },
      })),
    };
    const referenceResult = reconcileGlobalGraph(graph, referenceOnly);
    expect(referenceResult.nodesUpdated).toBe(0);
    expect(referenceResult.edgesUpdated).toBe(1);
  });
});
