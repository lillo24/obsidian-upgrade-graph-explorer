import { describe, expect, it } from 'vitest';

import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from './component-maps';
import { applyRendererHighlight } from './highlight';
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
