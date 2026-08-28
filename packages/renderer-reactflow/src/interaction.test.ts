import { describe, expect, it } from 'vitest';

import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from './component-maps';
import {
  applyRendererHighlight,
  applyRendererInteractionState,
} from './highlight';
import { prepareRendererGraph } from './prepare';
import { rendererTestProjection } from './test-fixture';

describe('renderer interaction helpers', () => {
  it('highlights the direct incident neighborhood and de-emphasizes the rest', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });
    const highlighted = applyRendererHighlight(graph, {
      kind: 'node',
      id: 'projection-section',
    });

    expect(
      highlighted.nodes.filter((node) =>
        node.className?.includes('is-highlighted'),
      ),
    ).toHaveLength(3);
    expect(
      highlighted.edges.every((edge) =>
        edge.className?.includes('is-highlighted'),
      ),
    ).toBe(true);
  });

  it('highlights an edge and only its endpoints during hover', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });
    const edge = graph.edges[0];
    if (edge?.data === undefined) throw new Error('Fixture edge is missing.');
    const highlighted = applyRendererHighlight(graph, {
      kind: 'edge',
      id: edge.data.projectionEdgeId,
    });

    expect(
      highlighted.edges.filter((candidate) =>
        candidate.className?.includes('is-highlighted'),
      ),
    ).toHaveLength(1);
    expect(
      highlighted.nodes
        .filter((node) => node.className?.includes('is-highlighted'))
        .map(({ id }) => id)
        .sort(),
    ).toEqual([edge.source, edge.target].sort());
  });

  it('removes temporary de-emphasis on pointer leave', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });

    expect(applyRendererHighlight(graph, null)).toBe(graph);
    expect(
      applyRendererHighlight(graph, null).nodes.some((node) =>
        node.className?.includes('is-deemphasized'),
      ),
    ).toBe(false);
  });

  it('keeps node or keyboard selection visible without fading unrelated content', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });
    const selected = applyRendererInteractionState(graph, null, {
      kind: 'node',
      id: 'projection-section',
    });

    expect(
      selected.nodes.find(
        (node) => node.data.projectionNodeId === 'projection-section',
      )?.selected,
    ).toBe(true);
    expect(
      selected.nodes.some((node) =>
        node.className?.includes('is-deemphasized'),
      ),
    ).toBe(false);
    expect(
      selected.edges.some((edge) =>
        edge.className?.includes('is-deemphasized'),
      ),
    ).toBe(false);
  });

  it('keeps edge selection after hover leaves and clears it with pane semantics', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });
    const edge = graph.edges[0];
    if (edge?.data === undefined) throw new Error('Fixture edge is missing.');
    const selected = applyRendererInteractionState(graph, null, {
      kind: 'edge',
      id: edge.data.projectionEdgeId,
    });

    expect(selected.edges.find(({ id }) => id === edge.id)?.selected).toBe(
      true,
    );
    expect(
      selected.edges.some((candidate) =>
        candidate.className?.includes('is-deemphasized'),
      ),
    ).toBe(false);
    expect(applyRendererInteractionState(graph, null, null)).toBe(graph);
  });

  it('moves persistent selection between nodes without adding hover classes', () => {
    const graph = prepareRendererGraph(rendererTestProjection(), {
      layoutMode: 'structure',
    });
    const projectionNodeIds = graph.nodes.map(
      ({ data }) => data.projectionNodeId,
    );
    const firstId = projectionNodeIds[0];
    const secondId = projectionNodeIds[1];
    if (firstId === undefined || secondId === undefined) {
      throw new Error('Fixture needs two projected nodes.');
    }
    const first = applyRendererInteractionState(graph, null, {
      kind: 'node',
      id: firstId,
    });
    const second = applyRendererInteractionState(graph, null, {
      kind: 'node',
      id: secondId,
    });

    expect(
      first.nodes
        .filter(({ selected }) => selected)
        .map(({ data }) => data.projectionNodeId),
    ).toEqual([firstId]);
    expect(
      second.nodes
        .filter(({ selected }) => selected)
        .map(({ data }) => data.projectionNodeId),
    ).toEqual([secondId]);
    expect(
      second.nodes.some((node) => node.className?.includes('is-deemphasized')),
    ).toBe(false);
  });

  it('keeps custom component maps stable at module scope', () => {
    const nodeTypes = GRAPH_NODE_TYPES;
    const edgeTypes = GRAPH_EDGE_TYPES;

    expect(GRAPH_NODE_TYPES).toBe(nodeTypes);
    expect(GRAPH_EDGE_TYPES).toBe(edgeTypes);
    expect(Object.keys(GRAPH_NODE_TYPES).sort()).toEqual([
      'diagnostic',
      'entity',
    ]);
    expect(Object.keys(GRAPH_EDGE_TYPES)).toEqual(['graph']);
  });
});
