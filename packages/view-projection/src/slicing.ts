import type { EntityId } from '@icarus-graph-explorer/core';

import { entityNodeId, hierarchyEdgeId } from './ids';
import {
  matchesCanonicalEntityFilters,
  matchesProjectedText,
  referenceStatusAllowed,
  type PreparedViewProjectionFilters,
} from './filter-plan';
import {
  countProjectionOperation,
  type ProjectionInstrumentation,
} from './instrumentation';
import type {
  FocusProjectionState,
  ProjectedEdge,
  ProjectedEntityNode,
  ProjectedHierarchyEdge,
  ProjectedNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ProjectionEdgeId,
  ProjectionIssue,
  ProjectionNodeId,
  ViewProjection,
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
  instrumentation?: ProjectionInstrumentation,
): void {
  let steps = 0;
  let parent = workspace.parent(entityId);
  while (parent !== undefined) {
    steps += 1;
    const node = available.get(parent.id);
    if (node !== undefined) retainedNodeIds.add(node.id);
    parent = workspace.parent(parent.id);
  }
  countProjectionOperation(instrumentation, 'ancestorWalkSteps', steps);
}

function hierarchyFor(
  workspace: ProjectionWorkspace,
  retainedEntityNodes: readonly ProjectedEntityNode[],
  instrumentation?: ProjectionInstrumentation,
): readonly ProjectedHierarchyEdge[] {
  countProjectionOperation(instrumentation, 'hierarchyEdgesRebuilt');
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
  instrumentation?: ProjectionInstrumentation,
): ViewProjection {
  countProjectionOperation(instrumentation, 'nodeSorts');
  countProjectionOperation(instrumentation, 'edgeSorts');
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

function issuesWithFilterDiagnostics(
  projection: ViewProjection,
  plan: PreparedViewProjectionFilters,
): readonly ProjectionIssue[] {
  if (plan.issues.length === 0) return projection.issues;
  return [...projection.issues, ...plan.issues].sort(
    (left, right) =>
      compareText(left.code, right.code) ||
      compareText(left.subject, right.subject),
  );
}

function allReferenceStatusesAllowed(
  plan: PreparedViewProjectionFilters,
): boolean {
  const statuses = plan.referenceStatuses;
  return (
    statuses === undefined ||
    (statuses.has('resolved') &&
      statuses.has('unresolved') &&
      statuses.has('ambiguous') &&
      statuses.has('invalid'))
  );
}

export function applyFilters(
  workspace: ProjectionWorkspace,
  projection: ViewProjection,
  plan: PreparedViewProjectionFilters,
  instrumentation?: ProjectionInstrumentation,
): ViewProjection {
  const issues = issuesWithFilterDiagnostics(projection, plan);
  if (plan.invalid) {
    return { nodes: [], edges: [], issues };
  }

  if (!plan.hasEntityVisibilityFilter) {
    if (allReferenceStatusesAllowed(plan) && issues === projection.issues) {
      return projection;
    }
    const keptReferenceEdgeIds = new Set<ProjectionEdgeId>();
    for (const edge of projection.edges) {
      if (
        edge.kind === 'reference' &&
        referenceStatusAllowed(edge.status, plan)
      ) {
        keptReferenceEdgeIds.add(edge.id);
      }
    }
    const diagnosticIds = new Set(
      projection.edges.flatMap((edge) =>
        edge.kind === 'reference' && keptReferenceEdgeIds.has(edge.id)
          ? [edge.sourceNodeId, edge.targetNodeId]
          : [],
      ),
    );
    const nodes: ProjectedNode[] = [];
    for (const node of projection.nodes) {
      if (node.kind === 'reference-target') {
        if (diagnosticIds.has(node.id)) nodes.push(node);
        continue;
      }
      nodes.push(
        !referenceStatusAllowed('resolved', plan) &&
          node.internalReferenceIds.length > 0
          ? { ...node, internalReferenceIds: [] }
          : node,
      );
    }
    return {
      nodes,
      edges: projection.edges.filter(
        (edge) =>
          edge.kind === 'hierarchy' || keptReferenceEdgeIds.has(edge.id),
      ),
      issues,
    };
  }

  const availableEntities = entityNodeMap(projection);
  const eligibleEntityNodeIds = new Set<ProjectionNodeId>();
  const contentEntityNodeIds = new Set<ProjectionNodeId>();
  let entityFilterEvaluations = 0;
  for (const node of availableEntities.values()) {
    if (node.role !== 'content') continue;
    entityFilterEvaluations += 1;
    const entity = workspace.entity(node.entityId);
    if (entity === undefined || !matchesCanonicalEntityFilters(entity, plan)) {
      continue;
    }
    eligibleEntityNodeIds.add(node.id);
    if (matchesProjectedText(node, plan)) {
      contentEntityNodeIds.add(node.id);
    }
  }
  countProjectionOperation(
    instrumentation,
    'entityFilterEvaluations',
    entityFilterEvaluations,
  );

  const nodesById = nodeMap(projection);
  const supportingSourceNodeIds = new Set<ProjectionNodeId>();
  const keptReferenceEdgeIds = new Set<ProjectionEdgeId>();
  for (const edge of projection.edges) {
    if (
      edge.kind !== 'reference' ||
      !referenceStatusAllowed(edge.status, plan)
    ) {
      continue;
    }
    const target = nodesById.get(edge.targetNodeId);
    if (target?.kind === 'reference-target') {
      const rawTargetMatch =
        plan.hasProjectedTextFilter &&
        target.rawTarget.toLowerCase().includes(plan.projectedText);
      if (contentEntityNodeIds.has(edge.sourceNodeId)) {
        keptReferenceEdgeIds.add(edge.id);
      } else if (
        rawTargetMatch &&
        eligibleEntityNodeIds.has(edge.sourceNodeId)
      ) {
        supportingSourceNodeIds.add(edge.sourceNodeId);
        keptReferenceEdgeIds.add(edge.id);
      }
      continue;
    }
    if (
      contentEntityNodeIds.has(edge.sourceNodeId) &&
      contentEntityNodeIds.has(edge.targetNodeId)
    ) {
      keptReferenceEdgeIds.add(edge.id);
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
      instrumentation,
    );
  }

  const retainedDiagnosticNodeIds = new Set<ProjectionNodeId>();
  for (const edge of projection.edges) {
    if (edge.kind === 'reference' && keptReferenceEdgeIds.has(edge.id)) {
      retainedDiagnosticNodeIds.add(edge.sourceNodeId);
      retainedDiagnosticNodeIds.add(edge.targetNodeId);
    }
  }

  const nodes: ProjectedNode[] = [];
  for (const node of projection.nodes) {
    if (node.kind === 'reference-target') {
      if (retainedDiagnosticNodeIds.has(node.id)) nodes.push(node);
      continue;
    }
    if (!retainedEntityNodeIds.has(node.id)) continue;
    const isContent = contentEntityNodeIds.has(node.id);
    const keepInternal = isContent && referenceStatusAllowed('resolved', plan);
    const internalReferenceIds = keepInternal ? node.internalReferenceIds : [];
    const role = isContent ? ('content' as const) : ('context' as const);
    const focusDistance = isContent ? node.focusDistance : null;
    if (
      internalReferenceIds === node.internalReferenceIds &&
      role === node.role &&
      focusDistance === node.focusDistance
    ) {
      nodes.push(node);
    } else {
      nodes.push({ ...node, internalReferenceIds, role, focusDistance });
    }
  }

  return {
    nodes,
    edges: projection.edges.filter((edge) =>
      edge.kind === 'hierarchy'
        ? retainedEntityNodeIds.has(edge.sourceNodeId) &&
          retainedEntityNodeIds.has(edge.targetNodeId)
        : keptReferenceEdgeIds.has(edge.id),
    ),
    issues,
  };
}
