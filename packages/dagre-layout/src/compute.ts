import dagre from '@dagrejs/dagre';

import type {
  DagreLayoutEdge,
  DagreLayoutInput,
  DagreLayoutMode,
  DagreLayoutOutput,
} from './types';
import {
  validateDagreLayoutInput,
  validateDagreLayoutOutput,
} from './validation';

export function dagreGraphSettings(mode: DagreLayoutMode) {
  return {
    rankdir: mode === 'structure' ? ('TB' as const) : ('LR' as const),
    ranker: 'network-simplex' as const,
    nodesep: mode === 'structure' ? 48 : 38,
    ranksep: mode === 'structure' ? 82 : 92,
    marginx: 28,
    marginy: 28,
  };
}

export function dagreEdgeSettings(kind: DagreLayoutEdge['kind']) {
  return {
    minlen: kind === 'hierarchy' ? 1 : 2,
    weight: kind === 'hierarchy' ? 8 : 1,
  };
}

export function computeDagreLayout(
  inputValue: DagreLayoutInput,
): DagreLayoutOutput {
  const input = validateDagreLayoutInput(inputValue);
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph(dagreGraphSettings(input.mode));
  for (const node of input.nodes) {
    graph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const edge of input.edges) {
    graph.setEdge(edge.source, edge.target, dagreEdgeSettings(edge.kind));
  }
  dagre.layout(graph);
  const output: DagreLayoutOutput = {
    positions: input.nodes.map((node) => {
      const position = graph.node(node.id) as
        { readonly x: number; readonly y: number } | undefined;
      if (position === undefined) {
        throw new Error('Dagre did not return complete node positions.');
      }
      return {
        id: node.id,
        x: position.x - node.width / 2,
        y: position.y - node.height / 2,
      };
    }),
  };
  return validateDagreLayoutOutput(input, output);
}
