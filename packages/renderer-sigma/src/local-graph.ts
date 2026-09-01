import { MultiDirectedGraph } from 'graphology';

import type {
  LocalEdgeAttributes,
  LocalGraphReconciliation,
  LocalNodeAttributes,
  LocalRendererInput,
} from './local-types';

export type LocalGraph = MultiDirectedGraph<
  LocalNodeAttributes,
  LocalEdgeAttributes
>;

export function buildLocalGraph(input: LocalRendererInput): LocalGraph {
  const graph = new MultiDirectedGraph<
    LocalNodeAttributes,
    LocalEdgeAttributes
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

function sameNode(
  current: LocalNodeAttributes,
  next: LocalNodeAttributes,
): boolean {
  return (
    current.size === next.size &&
    current.color === next.color &&
    current.label === next.label &&
    current.nodeKind === next.nodeKind &&
    current.entityId === next.entityId &&
    current.sourcePath === next.sourcePath &&
    current.status === next.status &&
    current.root === next.root &&
    current.revealableDescendantCount === next.revealableDescendantCount
  );
}

function sameEdge(
  current: LocalEdgeAttributes,
  next: LocalEdgeAttributes,
): boolean {
  return (
    current.size === next.size &&
    current.color === next.color &&
    current.edgeKind === next.edgeKind &&
    current.weight === next.weight &&
    current.referenceCount === next.referenceCount
  );
}

export function reconcileLocalGraph(
  graph: LocalGraph,
  input: LocalRendererInput,
): LocalGraphReconciliation {
  const nextNodes = new Map(input.nodes.map((node) => [node.key, node]));
  const nextEdges = new Map(input.edges.map((edge) => [edge.key, edge]));
  let nodesAdded = 0;
  let nodesUpdated = 0;
  let nodesRemoved = 0;
  let edgesAdded = 0;
  let edgesUpdated = 0;
  let edgesRemoved = 0;

  graph.forEachEdge((key) => {
    if (nextEdges.has(key)) return;
    graph.dropEdge(key);
    edgesRemoved += 1;
  });
  for (const node of input.nodes) {
    if (!graph.hasNode(node.key)) {
      graph.addNode(node.key, node.attributes);
      nodesAdded += 1;
      continue;
    }
    const previous = graph.getNodeAttributes(node.key);
    if (sameNode(previous, node.attributes)) continue;
    graph.replaceNodeAttributes(node.key, {
      ...node.attributes,
      x: previous.x,
      y: previous.y,
    });
    nodesUpdated += 1;
  }
  for (const edge of input.edges) {
    if (
      graph.hasEdge(edge.key) &&
      graph.source(edge.key) === edge.source &&
      graph.target(edge.key) === edge.target
    ) {
      if (!sameEdge(graph.getEdgeAttributes(edge.key), edge.attributes)) {
        graph.replaceEdgeAttributes(edge.key, edge.attributes);
        edgesUpdated += 1;
      }
      continue;
    }
    if (graph.hasEdge(edge.key)) {
      graph.dropEdge(edge.key);
      edgesRemoved += 1;
    }
    graph.addDirectedEdgeWithKey(
      edge.key,
      edge.source,
      edge.target,
      edge.attributes,
    );
    edgesAdded += 1;
  }
  graph.forEachNode((key) => {
    if (nextNodes.has(key)) return;
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

export function createLocalNeighborhoodIndex(
  input: LocalRendererInput,
): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map(
    input.nodes.map((node) => [node.key, new Set<string>()]),
  );
  for (const edge of input.edges) {
    result.get(edge.source)?.add(edge.target);
    result.get(edge.target)?.add(edge.source);
  }
  return result;
}
