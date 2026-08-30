import { MultiDirectedGraph } from 'graphology';

import type {
  GlobalEdgeAttributes,
  GlobalGraphReconciliation,
  GlobalNodeAttributes,
  GlobalRendererInput,
} from './types';

export type GlobalGraph = MultiDirectedGraph<
  GlobalNodeAttributes,
  GlobalEdgeAttributes
>;

function sameNodeAttributes(
  current: GlobalNodeAttributes,
  next: GlobalNodeAttributes,
  preservePositions: boolean,
): boolean {
  return (
    (preservePositions || (current.x === next.x && current.y === next.y)) &&
    current.size === next.size &&
    current.color === next.color &&
    current.label === next.label &&
    current.nodeKind === next.nodeKind &&
    current.entityId === next.entityId &&
    current.sourcePath === next.sourcePath &&
    current.status === next.status &&
    current.revealableDescendantCount === next.revealableDescendantCount
  );
}

function sameEdgeAttributes(
  current: GlobalEdgeAttributes,
  next: GlobalEdgeAttributes,
): boolean {
  return (
    current.size === next.size &&
    current.color === next.color &&
    current.edgeKind === next.edgeKind &&
    current.status === next.status &&
    current.referenceCount === next.referenceCount
  );
}

export function buildGlobalGraph(input: GlobalRendererInput): GlobalGraph {
  const graph = new MultiDirectedGraph<
    GlobalNodeAttributes,
    GlobalEdgeAttributes
  >();
  for (const node of input.nodes) graph.addNode(node.key, node.attributes);
  for (const edge of input.edges) {
    graph.addDirectedEdgeWithKey(
      edge.key,
      edge.source,
      edge.target,
      edge.attributes,
    );
  }
  return graph;
}

export function reconcileGlobalGraph(
  graph: GlobalGraph,
  input: GlobalRendererInput,
  options: { readonly preservePositions?: boolean } = {},
): GlobalGraphReconciliation {
  const nodes = new Map(input.nodes.map((node) => [node.key, node]));
  const edges = new Map(input.edges.map((edge) => [edge.key, edge]));
  let nodesAdded = 0;
  let nodesUpdated = 0;
  let nodesRemoved = 0;
  let edgesAdded = 0;
  let edgesUpdated = 0;
  let edgesRemoved = 0;

  graph.forEachEdge((key) => {
    if (edges.has(key)) return;
    graph.dropEdge(key);
    edgesRemoved += 1;
  });

  for (const node of input.nodes) {
    if (graph.hasNode(node.key)) {
      const previous = graph.getNodeAttributes(node.key);
      const preservePositions = options.preservePositions !== false;
      if (sameNodeAttributes(previous, node.attributes, preservePositions)) {
        continue;
      }
      graph.replaceNodeAttributes(
        node.key,
        preservePositions
          ? { ...node.attributes, x: previous.x, y: previous.y }
          : node.attributes,
      );
      nodesUpdated += 1;
    } else {
      graph.addNode(node.key, node.attributes);
      nodesAdded += 1;
    }
  }

  for (const edge of input.edges) {
    if (graph.hasEdge(edge.key)) {
      if (
        graph.source(edge.key) === edge.source &&
        graph.target(edge.key) === edge.target
      ) {
        if (
          sameEdgeAttributes(graph.getEdgeAttributes(edge.key), edge.attributes)
        ) {
          continue;
        }
        graph.replaceEdgeAttributes(edge.key, edge.attributes);
        edgesUpdated += 1;
      } else {
        graph.dropEdge(edge.key);
        graph.addDirectedEdgeWithKey(
          edge.key,
          edge.source,
          edge.target,
          edge.attributes,
        );
        edgesRemoved += 1;
        edgesAdded += 1;
      }
    } else {
      graph.addDirectedEdgeWithKey(
        edge.key,
        edge.source,
        edge.target,
        edge.attributes,
      );
      edgesAdded += 1;
    }
  }

  graph.forEachNode((key) => {
    if (nodes.has(key)) return;
    graph.dropNode(key);
    nodesRemoved += 1;
  });

  return {
    nodesAdded,
    nodesUpdated,
    nodesRemoved,
    edgesAdded,
    edgesUpdated,
    edgesRemoved,
  };
}

export function createNeighborhoodIndex(
  input: GlobalRendererInput,
): ReadonlyMap<string, ReadonlySet<string>> {
  const mutable = new Map<string, Set<string>>(
    input.nodes.map((node) => [node.key, new Set<string>()]),
  );
  for (const edge of input.edges) {
    mutable.get(edge.source)?.add(edge.target);
    mutable.get(edge.target)?.add(edge.source);
  }
  return mutable;
}
