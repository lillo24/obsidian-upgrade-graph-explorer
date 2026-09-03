import {
  validateDagreLayoutOutput,
  type DagreLayoutInput,
  type DagreLayoutOutput,
} from '@icarus-graph-explorer/dagre-layout';

import type {
  GraphFlowEdge,
  GraphFlowNode,
  GraphLayoutMode,
  RendererGraph,
} from './types';
import {
  HIERARCHY_NODE_CLEARANCE,
  nodeRectangle,
  RectangleOccupancy,
} from './geometry';

function nodeDimensions(node: GraphFlowNode) {
  const width = node.width;
  const height = node.height;
  if (width === undefined || height === undefined) {
    throw new Error(`Renderer node ${node.id} is missing fixed dimensions.`);
  }
  return { id: node.id, width, height };
}

export function createRendererLayoutInput(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  mode: GraphLayoutMode,
): DagreLayoutInput {
  const entityNodes = nodes.filter((node) => node.type === 'entity');
  const entityIds = new Set(entityNodes.map((node) => node.id));
  return {
    mode,
    nodes: entityNodes.map(nodeDimensions),
    edges: edges
      .filter(
        (edge) => entityIds.has(edge.source) && entityIds.has(edge.target),
      )
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.data?.kind ?? 'reference',
      })),
  };
}

function positionDiagnostics(
  positions: Map<string, { x: number; y: number }>,
  diagnostics: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  nodeById: ReadonlyMap<string, GraphFlowNode>,
  mode: GraphLayoutMode,
): void {
  const occupied = new RectangleOccupancy();
  for (const [id, position] of positions) {
    const node = nodeById.get(id);
    if (node === undefined)
      throw new Error('Hierarchy layout returned an unknown node.');
    occupied.add(nodeRectangle({ ...node, position }));
  }
  const fallbackX = occupied.right + 92;
  const nextSourceY = new Map<string, number>();
  const incomingByTarget = new Map<string, GraphFlowEdge>();
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!incomingByTarget.has(edge.target)) {
      incomingByTarget.set(edge.target, edge);
    }
  }
  const ordered = [...diagnostics].sort(
    (a, b) =>
      (incomingByTarget.get(a.id)?.source ?? '').localeCompare(
        incomingByTarget.get(b.id)?.source ?? '',
      ) || a.id.localeCompare(b.id),
  );
  for (const diagnostic of ordered) {
    const incoming = incomingByTarget.get(diagnostic.id);
    const source =
      incoming === undefined ? undefined : nodeById.get(incoming.source);
    const sourcePosition =
      source === undefined ? undefined : positions.get(source.id);
    const sourceKey = sourcePosition === undefined ? '' : source!.id;
    const rectangle = {
      ...nodeRectangle(diagnostic),
      x:
        sourcePosition === undefined
          ? fallbackX
          : sourcePosition.x +
            source!.width! +
            (mode === 'structure' ? 72 : 92),
      y: nextSourceY.get(sourceKey) ?? sourcePosition?.y ?? 0,
    };
    // Bounded downward lane search skips occupied bottoms. A new outer column
    // is guaranteed clear after 32 blocked candidates, even on dense vaults.
    for (let attempt = 0; attempt < 32; attempt++) {
      const collisions = occupied.collisions(rectangle);
      if (collisions.length === 0) break;
      rectangle.y =
        Math.max(...collisions.map((other) => other.y + other.height)) +
        HIERARCHY_NODE_CLEARANCE;
      if (attempt === 31)
        rectangle.x = occupied.right + HIERARCHY_NODE_CLEARANCE;
    }
    occupied.add(rectangle);
    positions.set(diagnostic.id, { x: rectangle.x, y: rectangle.y });
    nextSourceY.set(sourceKey, rectangle.y + rectangle.height + 20);
  }
}

export function applyRendererLayoutPositions(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  mode: GraphLayoutMode,
  outputValue: DagreLayoutOutput,
): RendererGraph {
  const input = createRendererLayoutInput(nodes, edges, mode);
  const output = validateDagreLayoutOutput(input, outputValue);
  const positions = new Map(
    output.positions.map(({ id, x, y }) => [id, { x, y }] as const),
  );
  const diagnosticNodes = nodes.filter((node) => node.type === 'diagnostic');
  positionDiagnostics(
    positions,
    diagnosticNodes,
    edges,
    new Map(nodes.map((node) => [node.id, node])),
    mode,
  );
  return {
    nodes: nodes.map((node) => {
      const position = positions.get(node.id);
      if (position === undefined)
        throw new Error('Hierarchy layout omitted a mapped node.');
      return { ...node, position };
    }),
    edges: [...edges],
    layoutWarning: null,
  };
}

export function fallbackRendererGraph(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  mode: GraphLayoutMode,
  message: string,
): RendererGraph {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return {
    nodes: nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % columns) * 280,
        y: Math.floor(index / columns) * 170,
      },
    })),
    edges: [...edges],
    layoutWarning: `Automatic ${mode} layout failed: ${message} A deterministic grid is shown instead.`,
  };
}
