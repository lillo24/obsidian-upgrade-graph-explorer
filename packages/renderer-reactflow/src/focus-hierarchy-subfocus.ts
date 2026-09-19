import type { GraphFlowEdge, GraphFlowNode, RendererGraph } from './types';

export interface FocusHierarchySubfocusTarget {
  readonly entityId: string;
  readonly kind: 'section' | 'block';
}

export interface FocusHierarchySubfocusPresentation {
  readonly targetFound: boolean;
  readonly primaryNodeIds: ReadonlySet<string>;
  readonly contextNodeIds: ReadonlySet<string>;
  readonly primaryEdgeIds: ReadonlySet<string>;
  readonly contextEdgeIds: ReadonlySet<string>;
}

const EMPTY_PRESENTATION: FocusHierarchySubfocusPresentation = {
  targetFound: false,
  primaryNodeIds: new Set(),
  contextNodeIds: new Set(),
  primaryEdgeIds: new Set(),
  contextEdgeIds: new Set(),
};

function addClass(className: string | undefined, value: string): string {
  return `${className ?? ''} ${value}`.trim();
}

/**
 * Derives presentation-only tiers from the exact rendered graph. Structural
 * descendants follow rendered hierarchy edges; reference emphasis never
 * expands past the first precise opposite endpoint.
 */
export function deriveFocusHierarchySubfocusPresentation(
  graph: RendererGraph,
  target: FocusHierarchySubfocusTarget,
): FocusHierarchySubfocusPresentation {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const anchor = graph.nodes.find(
    (node) =>
      node.type === 'entity' &&
      node.data.entityId === target.entityId &&
      node.data.entityKind === target.kind,
  );
  if (anchor === undefined) return EMPTY_PRESENTATION;

  const hierarchyChildren = new Map<string, string[]>();
  const hierarchyParents = new Map<string, string[]>();
  const hierarchyEdgeByEndpoints = new Map<string, GraphFlowEdge>();
  for (const edge of graph.edges) {
    if (edge.data?.kind !== 'hierarchy') continue;
    hierarchyEdgeByEndpoints.set(`${edge.source}\0${edge.target}`, edge);
    const children = hierarchyChildren.get(edge.source) ?? [];
    children.push(edge.target);
    hierarchyChildren.set(edge.source, children);
    const parents = hierarchyParents.get(edge.target) ?? [];
    parents.push(edge.source);
    hierarchyParents.set(edge.target, parents);
  }

  const contentPrimaryNodeIds = new Set<string>([anchor.id]);
  if (target.kind === 'section') {
    const queue = [anchor.id];
    for (let index = 0; index < queue.length; index += 1) {
      for (const childId of hierarchyChildren.get(queue[index]!) ?? []) {
        const child = nodeById.get(childId);
        if (child?.type !== 'entity' || contentPrimaryNodeIds.has(childId))
          continue;
        contentPrimaryNodeIds.add(childId);
        queue.push(childId);
      }
    }
  }

  const primaryNodeIds = new Set(contentPrimaryNodeIds);
  const primaryEdgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (
      edge.data?.kind === 'hierarchy' &&
      contentPrimaryNodeIds.has(edge.source) &&
      contentPrimaryNodeIds.has(edge.target)
    ) {
      primaryEdgeIds.add(edge.id);
      continue;
    }
    if (
      edge.data?.kind === 'reference' &&
      (contentPrimaryNodeIds.has(edge.source) ||
        contentPrimaryNodeIds.has(edge.target))
    ) {
      primaryEdgeIds.add(edge.id);
      primaryNodeIds.add(edge.source);
      primaryNodeIds.add(edge.target);
    }
  }

  const contextNodeIds = new Set<string>();
  const contextEdgeIds = new Set<string>();
  const ancestorQueue = [anchor.id];
  const visitedAncestors = new Set(ancestorQueue);
  for (let index = 0; index < ancestorQueue.length; index += 1) {
    const childId = ancestorQueue[index]!;
    for (const parentId of hierarchyParents.get(childId) ?? []) {
      const parent = nodeById.get(parentId);
      if (parent?.type !== 'entity') continue;
      const edge = hierarchyEdgeByEndpoints.get(`${parentId}\0${childId}`);
      if (edge !== undefined && !primaryEdgeIds.has(edge.id))
        contextEdgeIds.add(edge.id);
      if (!primaryNodeIds.has(parentId)) contextNodeIds.add(parentId);
      if (!visitedAncestors.has(parentId)) {
        visitedAncestors.add(parentId);
        ancestorQueue.push(parentId);
      }
    }
  }

  const contextModuleIds = new Set<string>();
  for (const nodeId of primaryNodeIds) {
    const node = nodeById.get(nodeId);
    if (
      node?.type === 'entity' &&
      node.data.focusSchematicModuleId !== undefined
    )
      contextModuleIds.add(node.data.focusSchematicModuleId);
  }
  for (const node of graph.nodes) {
    if (
      node.type === 'module' &&
      contextModuleIds.has(node.data.moduleId) &&
      !primaryNodeIds.has(node.id)
    )
      contextNodeIds.add(node.id);
  }

  return {
    targetFound: true,
    primaryNodeIds,
    contextNodeIds,
    primaryEdgeIds,
    contextEdgeIds,
  };
}

/** Applies stable tier classes without changing graph membership or geometry. */
export function applyFocusHierarchySubfocus(
  graph: RendererGraph,
  target: FocusHierarchySubfocusTarget | null | undefined,
): RendererGraph {
  if (target === null || target === undefined) return graph;
  const presentation = deriveFocusHierarchySubfocusPresentation(graph, target);
  if (!presentation.targetFound) return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((node): GraphFlowNode => {
      const tier = presentation.primaryNodeIds.has(node.id)
        ? 'is-subfocus-primary'
        : presentation.contextNodeIds.has(node.id)
          ? 'is-subfocus-context'
          : 'is-subfocus-dimmed';
      return {
        ...node,
        className: addClass(node.className, tier),
        ...(tier === 'is-subfocus-primary'
          ? { zIndex: Math.max(node.zIndex ?? 0, 3) }
          : {}),
      } as GraphFlowNode;
    }),
    edges: graph.edges.map((edge): GraphFlowEdge => ({
      ...edge,
      className: addClass(
        edge.className,
        presentation.primaryEdgeIds.has(edge.id)
          ? 'is-subfocus-primary'
          : presentation.contextEdgeIds.has(edge.id)
            ? 'is-subfocus-context'
            : 'is-subfocus-dimmed',
      ),
    })),
  };
}
