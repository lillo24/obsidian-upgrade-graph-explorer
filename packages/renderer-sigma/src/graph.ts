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

export interface GlobalGraphReconciliationPlan {
  readonly reconciliation: GlobalGraphReconciliation;
  readonly changed: boolean;
  readonly apply: () => void;
}

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
    current.folderKey === next.folderKey &&
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

export function planGlobalGraphReconciliation(
  graph: GlobalGraph,
  input: GlobalRendererInput,
  options: { readonly preservePositions?: boolean } = {},
): GlobalGraphReconciliationPlan {
  const nodes = new Map(input.nodes.map((node) => [node.key, node]));
  const edges = new Map(input.edges.map((edge) => [edge.key, edge]));
  const edgeKeysToRemove = graph.edges().filter((key) => !edges.has(key));
  const nodesToAdd: GlobalRendererInput['nodes'][number][] = [];
  const nodesToUpdate: {
    readonly key: string;
    readonly attributes: GlobalNodeAttributes;
  }[] = [];
  const edgesToAdd: GlobalRendererInput['edges'][number][] = [];
  const edgesToUpdate: {
    readonly key: string;
    readonly attributes: GlobalEdgeAttributes;
  }[] = [];
  const replacementEdgeKeys = new Set<string>();
  const nodeKeysToRemove = graph.nodes().filter((key) => !nodes.has(key));

  for (const node of input.nodes) {
    if (graph.hasNode(node.key)) {
      const previous = graph.getNodeAttributes(node.key);
      const preservePositions = options.preservePositions !== false;
      if (sameNodeAttributes(previous, node.attributes, preservePositions)) {
        continue;
      }
      nodesToUpdate.push({
        key: node.key,
        attributes: preservePositions
          ? { ...node.attributes, x: previous.x, y: previous.y }
          : node.attributes,
      });
    } else {
      nodesToAdd.push(node);
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
        edgesToUpdate.push({ key: edge.key, attributes: edge.attributes });
      } else {
        replacementEdgeKeys.add(edge.key);
        edgesToAdd.push(edge);
      }
    } else {
      edgesToAdd.push(edge);
    }
  }

  const reconciliation: GlobalGraphReconciliation = {
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

export function reconcileGlobalGraph(
  graph: GlobalGraph,
  input: GlobalRendererInput,
  options: { readonly preservePositions?: boolean } = {},
): GlobalGraphReconciliation {
  const plan = planGlobalGraphReconciliation(graph, input, options);
  plan.apply();
  return plan.reconciliation;
}

export function createGlobalNeighborhoodIndex(
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

/** Weighted reference degree used only by the automatic display-size reducer. */
export function createGlobalReferenceDegreeIndex(
  input: GlobalRendererInput,
): ReadonlyMap<string, number> {
  const degrees = new Map(input.nodes.map(({ key }) => [key, 0]));
  for (const edge of input.edges) {
    const weight = Math.max(1, edge.attributes.referenceCount);
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + weight);
    degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + weight);
  }
  return degrees;
}
