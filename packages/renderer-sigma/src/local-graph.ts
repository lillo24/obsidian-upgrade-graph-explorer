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

export interface LocalGraphReconciliationPlan {
  readonly reconciliation: LocalGraphReconciliation;
  readonly changed: boolean;
  readonly apply: () => void;
}

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

export function planLocalGraphReconciliation(
  graph: LocalGraph,
  input: LocalRendererInput,
): LocalGraphReconciliationPlan {
  const nextNodes = new Map(input.nodes.map((node) => [node.key, node]));
  const nextEdges = new Map(input.edges.map((edge) => [edge.key, edge]));
  const edgeKeysToRemove = graph.edges().filter((key) => !nextEdges.has(key));
  const nodesToAdd: LocalRendererInput['nodes'][number][] = [];
  const nodesToUpdate: {
    readonly key: string;
    readonly attributes: LocalNodeAttributes;
  }[] = [];
  const edgesToAdd: LocalRendererInput['edges'][number][] = [];
  const edgesToUpdate: {
    readonly key: string;
    readonly attributes: LocalEdgeAttributes;
  }[] = [];
  const replacementEdgeKeys = new Set<string>();
  const nodeKeysToRemove = graph.nodes().filter((key) => !nextNodes.has(key));

  for (const node of input.nodes) {
    if (!graph.hasNode(node.key)) {
      nodesToAdd.push(node);
      continue;
    }
    const previous = graph.getNodeAttributes(node.key);
    if (sameNode(previous, node.attributes)) continue;
    nodesToUpdate.push({
      key: node.key,
      attributes: { ...node.attributes, x: previous.x, y: previous.y },
    });
  }
  for (const edge of input.edges) {
    if (
      graph.hasEdge(edge.key) &&
      graph.source(edge.key) === edge.source &&
      graph.target(edge.key) === edge.target
    ) {
      if (!sameEdge(graph.getEdgeAttributes(edge.key), edge.attributes)) {
        edgesToUpdate.push({ key: edge.key, attributes: edge.attributes });
      }
      continue;
    }
    if (graph.hasEdge(edge.key)) {
      replacementEdgeKeys.add(edge.key);
    }
    edgesToAdd.push(edge);
  }

  const reconciliation: LocalGraphReconciliation = {
    nodesAdded: nodesToAdd.length,
    nodesUpdated: nodesToUpdate.length,
    nodesRemoved: nodeKeysToRemove.length,
    edgesAdded: edgesToAdd.length,
    edgesUpdated: edgesToUpdate.length,
    edgesRemoved: edgeKeysToRemove.length + replacementEdgeKeys.size,
  };
  const changed = Object.values(reconciliation).some((count) => count > 0);

  return {
    reconciliation,
    changed,
    apply: () => {
      for (const key of edgeKeysToRemove) graph.dropEdge(key);
      for (const { key } of edgesToAdd) {
        if (replacementEdgeKeys.has(key)) graph.dropEdge(key);
      }
      for (const node of nodesToAdd) graph.addNode(node.key, node.attributes);
      for (const node of nodesToUpdate) {
        graph.replaceNodeAttributes(node.key, node.attributes);
      }
      for (const edge of edgesToAdd) {
        graph.addDirectedEdgeWithKey(
          edge.key,
          edge.source,
          edge.target,
          edge.attributes,
        );
      }
      for (const edge of edgesToUpdate) {
        graph.replaceEdgeAttributes(edge.key, edge.attributes);
      }
      for (const key of nodeKeysToRemove) graph.dropNode(key);
    },
  };
}

export function reconcileLocalGraph(
  graph: LocalGraph,
  input: LocalRendererInput,
): LocalGraphReconciliation {
  const plan = planLocalGraphReconciliation(graph, input);
  plan.apply();
  return plan.reconciliation;
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
