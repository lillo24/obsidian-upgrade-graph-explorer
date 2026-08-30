import { computeDagreLayout } from '@icarus-graph-explorer/dagre-layout/compute';

import {
  applyRendererLayoutPositions,
  createRendererLayoutInput,
  fallbackRendererGraph,
} from './layout';
import type {
  GraphFlowEdge,
  GraphFlowNode,
  GraphLayoutMode,
  LayoutEngine,
  RendererGraph,
} from './types';

export function layoutRendererGraph(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  mode: GraphLayoutMode,
  layoutEngine: LayoutEngine = computeDagreLayout,
): RendererGraph {
  try {
    const output = layoutEngine(createRendererLayoutInput(nodes, edges, mode));
    return applyRendererLayoutPositions(nodes, edges, mode, output);
  } catch (error: unknown) {
    return fallbackRendererGraph(
      nodes,
      edges,
      mode,
      error instanceof Error ? error.message : String(error),
    );
  }
}
