import type {
  GraphFlowEdge,
  GraphFlowNode,
  GraphSelection,
  RendererGraph,
} from './types';

export interface HighlightedRendererGraph extends RendererGraph {
  readonly nodes: readonly GraphFlowNode[];
  readonly edges: readonly GraphFlowEdge[];
}

export function applyRendererHighlight(
  graph: RendererGraph,
  active: GraphSelection | null,
): HighlightedRendererGraph {
  if (active === null) return graph;

  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();
  if (active.kind === 'edge') {
    const edge = graph.edges.find(
      (candidate) => candidate.data?.projectionEdgeId === active.id,
    );
    if (edge !== undefined) {
      highlightedEdgeIds.add(edge.id);
      highlightedNodeIds.add(edge.source);
      highlightedNodeIds.add(edge.target);
    }
  } else {
    const node = graph.nodes.find(
      (candidate) => candidate.data.projectionNodeId === active.id,
    );
    if (node !== undefined) {
      highlightedNodeIds.add(node.id);
      for (const edge of graph.edges) {
        if (edge.source === node.id || edge.target === node.id) {
          highlightedEdgeIds.add(edge.id);
          highlightedNodeIds.add(edge.source);
          highlightedNodeIds.add(edge.target);
        }
      }
    }
  }

  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      className: `${node.className ?? ''}${
        highlightedNodeIds.has(node.id) ? ' is-highlighted' : ' is-deemphasized'
      }`,
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      className: `${edge.className ?? ''}${
        highlightedEdgeIds.has(edge.id) ? ' is-highlighted' : ' is-deemphasized'
      }`,
    })),
  };
}

/**
 * Applies persistent React Flow selection independently from transient hover
 * emphasis. Selection never creates neighborhood de-emphasis.
 */
export function applyRendererInteractionState(
  graph: RendererGraph,
  hovered: GraphSelection | null,
  selection: GraphSelection | null,
): HighlightedRendererGraph {
  const highlighted = applyRendererHighlight(graph, hovered);
  if (selection === null) return highlighted;

  return {
    ...highlighted,
    nodes: highlighted.nodes.map((node) => ({
      ...node,
      selected:
        selection.kind === 'node' &&
        node.data.projectionNodeId === selection.id,
    })),
    edges: highlighted.edges.map((edge) => ({
      ...edge,
      selected:
        selection.kind === 'edge' &&
        edge.data?.projectionEdgeId === selection.id,
    })),
  };
}
