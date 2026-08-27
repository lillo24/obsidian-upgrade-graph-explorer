import dagre from '@dagrejs/dagre';

import { DIAGNOSTIC_NODE_DIMENSIONS } from './mapping';
import type {
  GraphFlowEdge,
  GraphFlowNode,
  GraphLayoutMode,
  LayoutEngine,
  LayoutInputNode,
  RendererGraph,
} from './types';

const dagreLayout: LayoutEngine = ({ mode, nodes, edges }) => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: mode === 'structure' ? 'TB' : 'LR',
    ranker: 'network-simplex',
    nodesep: mode === 'structure' ? 48 : 38,
    ranksep: mode === 'structure' ? 82 : 92,
    marginx: 28,
    marginy: 28,
  });
  for (const node of nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target, {
      minlen: edge.kind === 'hierarchy' ? 1 : 2,
      weight: edge.kind === 'hierarchy' ? 8 : 1,
    });
  }
  dagre.layout(graph);
  return new Map(
    nodes.map((node) => {
      const position = graph.node(node.id) as
        { readonly x: number; readonly y: number } | undefined;
      if (position === undefined) {
        throw new Error(
          `Dagre returned no position for renderer node ${node.id}.`,
        );
      }
      return [
        node.id,
        {
          x: position.x - node.width / 2,
          y: position.y - node.height / 2,
        },
      ];
    }),
  );
};

function nodeDimensions(node: GraphFlowNode): LayoutInputNode {
  const width = node.width;
  const height = node.height;
  if (width === undefined || height === undefined) {
    throw new Error(`Renderer node ${node.id} is missing fixed dimensions.`);
  }
  return { id: node.id, width, height };
}

function fallbackPositions(nodes: readonly GraphFlowNode[]) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return new Map(
    nodes.map((node, index) => [
      node.id,
      { x: (index % columns) * 280, y: Math.floor(index / columns) * 170 },
    ]),
  );
}

function positionDiagnostics(
  positions: Map<string, { x: number; y: number }>,
  diagnostics: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  nodeById: ReadonlyMap<string, GraphFlowNode>,
  mode: GraphLayoutMode,
): void {
  const sourceCounts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    const incoming = edges.find((edge) => edge.target === diagnostic.id);
    const source =
      incoming === undefined ? undefined : nodeById.get(incoming.source);
    const sourcePosition =
      source === undefined ? undefined : positions.get(source.id);
    const sourceIndex =
      incoming === undefined ? 0 : (sourceCounts.get(incoming.source) ?? 0);
    if (incoming !== undefined)
      sourceCounts.set(incoming.source, sourceIndex + 1);
    if (source === undefined || sourcePosition === undefined) {
      positions.set(diagnostic.id, {
        x: sourceIndex * (DIAGNOSTIC_NODE_DIMENSIONS.width + 36),
        y: sourceIndex * (DIAGNOSTIC_NODE_DIMENSIONS.height + 24),
      });
      continue;
    }
    if (mode === 'structure') {
      positions.set(diagnostic.id, {
        x: sourcePosition.x + (source.width ?? 224) + 72,
        y:
          sourcePosition.y +
          sourceIndex * (DIAGNOSTIC_NODE_DIMENSIONS.height + 20),
      });
    } else {
      positions.set(diagnostic.id, {
        x: sourcePosition.x + (source.width ?? 224) + 92,
        y:
          sourcePosition.y +
          sourceIndex * (DIAGNOSTIC_NODE_DIMENSIONS.height + 20),
      });
    }
  }
}

export function layoutRendererGraph(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  mode: GraphLayoutMode,
  layoutEngine: LayoutEngine = dagreLayout,
): RendererGraph {
  const entityNodes = nodes.filter((node) => node.type === 'entity');
  const diagnosticNodes = nodes.filter((node) => node.type === 'diagnostic');
  const entityIds = new Set(entityNodes.map((node) => node.id));
  const topologyEdges = edges
    .filter((edge) => entityIds.has(edge.source) && entityIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.data?.kind ?? 'reference',
    }));

  let positions: Map<string, { x: number; y: number }>;
  let layoutWarning: string | null = null;
  try {
    positions = new Map(
      layoutEngine({
        mode,
        nodes: entityNodes.map(nodeDimensions),
        edges: topologyEdges,
      }),
    );
    positionDiagnostics(
      positions,
      diagnosticNodes,
      edges,
      new Map(nodes.map((node) => [node.id, node])),
      mode,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    layoutWarning = `Automatic ${mode} layout failed: ${message} A deterministic grid is shown instead.`;
    positions = fallbackPositions(nodes);
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges: [...edges],
    layoutWarning,
  };
}
