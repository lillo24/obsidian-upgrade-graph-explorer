import type { EntityId } from '@icarus-graph-explorer/core';

import { entityNodeId, hierarchyEdgeId } from './ids';
import type {
  FocusProjectionState,
  ProjectedEdge,
  ProjectedEntityNode,
  ProjectedHierarchyEdge,
  ProjectedNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ProjectionIssue,
  ProjectionNodeId,
  ViewProjection,
  ViewProjectionFilters,
} from './types';
import type { ProjectionWorkspace } from './workspace';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function nodeMap(
  projection: ViewProjection,
): Map<ProjectionNodeId, ProjectedNode> {
  return new Map(projection.nodes.map((node) => [node.id, node]));
}

function entityNodeMap(
  projection: ViewProjection,
): Map<EntityId, ProjectedEntityNode> {
  return new Map(
    projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.entityId, node] as const] : [],
    ),
  );
}

function addVisibleAncestors(
  workspace: ProjectionWorkspace,
  entityId: EntityId,
  available: ReadonlyMap<EntityId, ProjectedEntityNode>,
  retainedNodeIds: Set<ProjectionNodeId>,
): void {
  let parent = workspace.parent(entityId);
  while (parent !== undefined) {
    const node = available.get(parent.id);
    if (node !== undefined) retainedNodeIds.add(node.id);
    parent = workspace.parent(parent.id);
  }
}

function hierarchyFor(
  workspace: ProjectionWorkspace,
  retainedEntityNodes: readonly ProjectedEntityNode[],
): readonly ProjectedHierarchyEdge[] {
  const retainedByEntityId = new Map(
    retainedEntityNodes.map((node) => [node.entityId, node]),
  );
  return retainedEntityNodes
    .flatMap((node) => {
      let parent = workspace.parent(node.entityId);
      while (parent !== undefined) {
        const parentNode = retainedByEntityId.get(parent.id);
        if (parentNode !== undefined) {
          return [
            {
              id: hierarchyEdgeId(parentNode.id, node.id),
              kind: 'hierarchy' as const,
              sourceNodeId: parentNode.id,
              targetNodeId: node.id,
            },
          ];
        }
        parent = workspace.parent(parent.id);
      }
      return [];
    })
    .sort((left, right) => compareText(left.id, right.id));
}

function sortedProjection(
  nodes: readonly ProjectedNode[],
  edges: readonly ProjectedEdge[],
  issues: readonly ProjectionIssue[],
): ViewProjection {
  return {
    nodes: [...nodes].sort((left, right) => compareText(left.id, right.id)),
    edges: [...edges].sort((left, right) => compareText(left.id, right.id)),
    issues: [...issues].sort(
      (left, right) =>
        compareText(left.code, right.code) ||
        compareText(left.subject, right.subject),
    ),
  };
}

export function applyFocus(
  workspace: ProjectionWorkspace,
  projection: ViewProjection,
  focus: FocusProjectionState | undefined,
): ViewProjection {
  if (focus === undefined) return projection;

  const rootEntity = workspace.entity(focus.rootEntityId);
  if (rootEntity === undefined) {
    return sortedProjection(
      [],
      [],
      [
        ...projection.issues,
        {
          code: 'unknown-focus-root',
          subject: focus.rootEntityId,
          message: `Focus root "${focus.rootEntityId}" is not present in the canonical snapshot.`,
        },
      ],
    );
  }

  const nodesById = nodeMap(projection);
  const rootNodeId = entityNodeId(rootEntity.id);
  if (!nodesById.has(rootNodeId)) {
    return sortedProjection(
      [],
      [],
      [
        ...projection.issues,
        {
          code: 'hidden-focus-root',
          subject: focus.rootEntityId,
          message: `Focus root "${focus.rootEntityId}" is hidden by structural disclosure.`,
        },
      ],
    );
  }

  const referenceEdges = projection.edges.filter(
    (edge): edge is ProjectedReferenceEdge => edge.kind === 'reference',
  );
  const incoming = new Map<ProjectionNodeId, ProjectedReferenceEdge[]>();
  const outgoing = new Map<ProjectionNodeId, ProjectedReferenceEdge[]>();
  for (const edge of referenceEdges) {
    const from = outgoing.get(edge.sourceNodeId) ?? [];
    from.push(edge);
    outgoing.set(edge.sourceNodeId, from);
    const to = incoming.get(edge.targetNodeId) ?? [];
    to.push(edge);
    incoming.set(edge.targetNodeId, to);
  }

  const distance = new Map<ProjectionNodeId, number>([[rootNodeId, 0]]);
  const queue: ProjectionNodeId[] = [rootNodeId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (current === undefined) continue;
    const currentDistance = distance.get(current);
    if (currentDistance === undefined || currentDistance >= focus.hops)
      continue;
    if (nodesById.get(current)?.kind === 'reference-target') continue;

    const neighbors: ProjectionNodeId[] = [];
    if (focus.direction !== 'incoming') {
      for (const edge of outgoing.get(current) ?? []) {
        neighbors.push(edge.targetNodeId);
      }
    }
    if (focus.direction !== 'outgoing') {
      for (const edge of incoming.get(current) ?? []) {
        neighbors.push(edge.sourceNodeId);
      }
    }
    for (const neighbor of [...new Set(neighbors)].sort(compareText)) {
      if (distance.has(neighbor)) continue;
      distance.set(neighbor, currentDistance + 1);
      queue.push(neighbor);
    }
  }

  const contentNodeIds = new Set(distance.keys());
  const availableEntities = entityNodeMap(projection);
  const retainedEntityNodeIds = new Set<ProjectionNodeId>();
  for (const nodeId of contentNodeIds) {
    const node = nodesById.get(nodeId);
    if (node?.kind !== 'entity') continue;
    retainedEntityNodeIds.add(node.id);
    addVisibleAncestors(
      workspace,
      node.entityId,
      availableEntities,
      retainedEntityNodeIds,
    );
  }

  if (focus.hierarchyContext === 'ancestors-and-children') {
    const directChildren = new Map<ProjectionNodeId, ProjectionNodeId[]>();
    for (const edge of projection.edges) {
      if (edge.kind !== 'hierarchy') continue;
      const children = directChildren.get(edge.sourceNodeId) ?? [];
      children.push(edge.targetNodeId);
      directChildren.set(edge.sourceNodeId, children);
    }
    for (const nodeId of contentNodeIds) {
      for (const childId of directChildren.get(nodeId) ?? []) {
        retainedEntityNodeIds.add(childId);
      }
    }
  }

  const entityNodes = projection.nodes.flatMap((node) => {
    if (node.kind !== 'entity' || !retainedEntityNodeIds.has(node.id))
      return [];
    const contentDistance = distance.get(node.id);
    const isContent = contentDistance !== undefined;
    return [
      {
        ...node,
        internalReferenceIds: isContent ? node.internalReferenceIds : [],
        role: isContent ? ('content' as const) : ('context' as const),
        focusDistance: contentDistance ?? null,
      },
    ];
  });
  const referenceEdgesToKeep = referenceEdges.filter(
    (edge) =>
      contentNodeIds.has(edge.sourceNodeId) &&
      contentNodeIds.has(edge.targetNodeId),
  );
  const retainedDiagnosticNodeIds = new Set(
    referenceEdgesToKeep.flatMap((edge) => [
      edge.sourceNodeId,
      edge.targetNodeId,
    ]),
  );
  const diagnosticNodes = projection.nodes.filter(
    (node): node is ProjectedReferenceTargetNode =>
      node.kind === 'reference-target' &&
      retainedDiagnosticNodeIds.has(node.id),
  );

  return sortedProjection(
    [...entityNodes, ...diagnosticNodes],
    [...hierarchyFor(workspace, entityNodes), ...referenceEdgesToKeep],
    projection.issues,
  );
}

function normalizedPathPrefix(prefix: string): boolean {
  return (
    prefix.length > 0 &&
    !prefix.startsWith('/') &&
    !prefix.includes('\\') &&
    !/^[A-Za-z]:\//u.test(prefix) &&
    prefix
      .split('/')
      .every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
  );
}

function pathMatches(path: string, prefixes: ReadonlySet<string>): boolean {
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

function textMatchesEntity(node: ProjectedEntityNode, text: string): boolean {
  return (
    node.sourcePath.toLowerCase().includes(text) ||
    (node.title?.toLowerCase().includes(text) ?? false)
  );
}

export function applyFilters(
  workspace: ProjectionWorkspace,
  projection: ViewProjection,
  filters: ViewProjectionFilters | undefined,
): ViewProjection {
  if (filters === undefined) return projection;

  const issues: ProjectionIssue[] = [...projection.issues];
  const validPathPrefixes = new Set<string>();
  if (filters.pathPrefixes !== undefined) {
    for (const prefix of [...new Set(filters.pathPrefixes)].sort(compareText)) {
      if (normalizedPathPrefix(prefix)) {
        validPathPrefixes.add(prefix);
      } else {
        issues.push({
          code: 'invalid-path-prefix',
          subject: prefix,
          message: `Path prefix "${prefix}" is not a normalized workspace-relative path prefix.`,
        });
      }
    }
  }

  const statuses =
    filters.referenceStatuses === undefined
      ? undefined
      : new Set(filters.referenceStatuses);
  const statusAllowed = (status: ProjectedReferenceEdge['status']): boolean =>
    statuses === undefined || statuses.has(status);
  const hasEntityFilter =
    filters.pathPrefixes !== undefined ||
    filters.entityKinds !== undefined ||
    (filters.text?.trim().length ?? 0) > 0;

  if (!hasEntityFilter) {
    const referenceEdges = projection.edges.filter(
      (edge): edge is ProjectedReferenceEdge =>
        edge.kind === 'reference' && statusAllowed(edge.status),
    );
    const diagnosticIds = new Set(
      referenceEdges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
    );
    const nodes: ProjectedNode[] = [];
    for (const node of projection.nodes) {
      if (node.kind === 'reference-target') {
        if (diagnosticIds.has(node.id)) nodes.push(node);
        continue;
      }
      nodes.push(
        statuses !== undefined && !statuses.has('resolved')
          ? { ...node, internalReferenceIds: [] }
          : node,
      );
    }
    return sortedProjection(
      nodes,
      [
        ...projection.edges.filter((edge) => edge.kind === 'hierarchy'),
        ...referenceEdges,
      ],
      issues,
    );
  }

  const availableEntities = entityNodeMap(projection);
  const entityKinds =
    filters.entityKinds === undefined
      ? undefined
      : new Set(filters.entityKinds);
  const normalizedText = filters.text?.trim().toLowerCase() ?? '';
  const eligibleEntityNodeIds = new Set<ProjectionNodeId>();
  const contentEntityNodeIds = new Set<ProjectionNodeId>();
  for (const node of availableEntities.values()) {
    if (node.role !== 'content') continue;
    const pathAllowed =
      filters.pathPrefixes === undefined ||
      pathMatches(node.sourcePath, validPathPrefixes);
    const kindAllowed =
      entityKinds === undefined || entityKinds.has(node.entityKind);
    if (!pathAllowed || !kindAllowed) continue;
    eligibleEntityNodeIds.add(node.id);
    if (
      normalizedText.length === 0 ||
      textMatchesEntity(node, normalizedText)
    ) {
      contentEntityNodeIds.add(node.id);
    }
  }

  const nodesById = nodeMap(projection);
  const referenceEdges = projection.edges.filter(
    (edge): edge is ProjectedReferenceEdge => edge.kind === 'reference',
  );
  const supportingSourceNodeIds = new Set<ProjectionNodeId>();
  const keptReferenceEdges: ProjectedReferenceEdge[] = [];
  for (const edge of referenceEdges) {
    if (!statusAllowed(edge.status)) continue;
    const target = nodesById.get(edge.targetNodeId);
    if (target?.kind === 'reference-target') {
      const rawTargetMatch =
        normalizedText.length > 0 &&
        target.rawTarget.toLowerCase().includes(normalizedText);
      if (contentEntityNodeIds.has(edge.sourceNodeId)) {
        keptReferenceEdges.push(edge);
      } else if (
        rawTargetMatch &&
        eligibleEntityNodeIds.has(edge.sourceNodeId)
      ) {
        supportingSourceNodeIds.add(edge.sourceNodeId);
        keptReferenceEdges.push(edge);
      }
      continue;
    }
    if (
      contentEntityNodeIds.has(edge.sourceNodeId) &&
      contentEntityNodeIds.has(edge.targetNodeId)
    ) {
      keptReferenceEdges.push(edge);
    }
  }

  const retainedEntityNodeIds = new Set([
    ...contentEntityNodeIds,
    ...supportingSourceNodeIds,
  ]);
  for (const node of availableEntities.values()) {
    if (!retainedEntityNodeIds.has(node.id)) continue;
    addVisibleAncestors(
      workspace,
      node.entityId,
      availableEntities,
      retainedEntityNodeIds,
    );
  }

  const entityNodes = [...availableEntities.values()].flatMap((node) => {
    if (!retainedEntityNodeIds.has(node.id)) return [];
    const isContent = contentEntityNodeIds.has(node.id);
    const keepInternal =
      isContent && (statuses === undefined || statuses.has('resolved'));
    return [
      {
        ...node,
        internalReferenceIds: keepInternal ? node.internalReferenceIds : [],
        role: isContent ? ('content' as const) : ('context' as const),
        focusDistance: isContent ? node.focusDistance : null,
      },
    ];
  });
  const diagnosticIds = new Set(
    keptReferenceEdges.flatMap((edge) => [
      edge.sourceNodeId,
      edge.targetNodeId,
    ]),
  );
  const diagnosticNodes = projection.nodes.filter(
    (node): node is ProjectedReferenceTargetNode =>
      node.kind === 'reference-target' && diagnosticIds.has(node.id),
  );

  return sortedProjection(
    [...entityNodes, ...diagnosticNodes],
    [...hierarchyFor(workspace, entityNodes), ...keptReferenceEdges],
    issues,
  );
}
