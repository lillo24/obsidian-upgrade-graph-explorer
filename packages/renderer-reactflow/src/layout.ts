import {
  validateDagreLayoutOutput,
  type DagreLayoutInput,
  type DagreLayoutOutput,
} from '@icarus-graph-explorer/dagre-layout';

import { DIAGNOSTIC_NODE_DIMENSIONS } from './mapping';
import type {
  GraphFlowEdge,
  GraphFlowNode,
  GraphLayoutMode,
  RendererGraph,
} from './types';

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
  const sourceCounts = new Map<string, number>();
  const incomingByTarget = new Map<string, GraphFlowEdge>();
  for (const edge of edges) {
    if (!incomingByTarget.has(edge.target)) {
      incomingByTarget.set(edge.target, edge);
    }
  }
  for (const diagnostic of diagnostics) {
    const incoming = incomingByTarget.get(diagnostic.id);
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
    positions.set(diagnostic.id, {
      x:
        sourcePosition.x +
        (source.width ?? 224) +
        (mode === 'structure' ? 72 : 92),
      y:
        sourcePosition.y +
        sourceIndex * (DIAGNOSTIC_NODE_DIMENSIONS.height + 20),
    });
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
    nodes: nodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
    })),
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
