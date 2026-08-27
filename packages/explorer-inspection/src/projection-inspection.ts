import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  ProjectedEntityNode,
  ProjectedNode,
  ProjectedReferenceTargetNode,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { describeEntity, describeReference } from './descriptors';
import { inspectEntity } from './entity-inspection';
import type {
  EntityDescriptor,
  ProjectedDiagnosticInspection,
  ProjectedEdgeInspection,
  ProjectedNodeInspection,
  ProjectedOccurrenceInspection,
  ReferenceOccurrenceDescriptor,
} from './types';
import type { InspectionWorkspace } from './workspace';

function requireProjectedNode(
  projection: ViewProjection,
  nodeId: string,
): ProjectedNode {
  const node = projection.nodes.find((candidate) => candidate.id === nodeId);
  if (node === undefined) {
    throw new Error(`Projection is missing node "${nodeId}" for inspection.`);
  }
  return node;
}

function requireProjectedEntity(
  projection: ViewProjection,
  nodeId: string,
): ProjectedEntityNode {
  const node = requireProjectedNode(projection, nodeId);
  if (node.kind !== 'entity') {
    throw new Error(
      `Projected node "${nodeId}" is diagnostic, not a canonical entity.`,
    );
  }
  return node;
}

function inspectDiagnosticNode(
  workspace: InspectionWorkspace,
  node: ProjectedReferenceTargetNode,
): ProjectedDiagnosticInspection {
  return {
    kind: 'diagnostic',
    projectionNodeId: node.id,
    status: node.status,
    rawTarget: node.rawTarget,
    reasons: [...node.reasons],
    occurrences: describeReferencesInSourceOrder(workspace, node.referenceIds),
    candidates: node.candidateEntityIds
      .map((entityId) => describeEntity(workspace, entityId))
      .sort(compareEntityDescriptors),
  };
}

export function inspectProjectedNode(
  workspace: InspectionWorkspace,
  projection: ViewProjection,
  nodeId: string,
): ProjectedNodeInspection {
  const node = requireProjectedNode(projection, nodeId);
  if (node.kind === 'reference-target') {
    return inspectDiagnosticNode(workspace, node);
  }
  return {
    kind: 'entity',
    projectionNodeId: node.id,
    entity: inspectEntity(workspace, node.entityId),
    role: node.role,
    focusDistance: node.focusDistance,
    hiddenDescendantCount: node.hiddenDescendantCount,
    internalRelationships: describeReferencesInSourceOrder(
      workspace,
      node.internalReferenceIds,
    ),
  };
}

function projectedTargetDescriptor(
  workspace: InspectionWorkspace,
  projection: ViewProjection,
  nodeId: string,
): EntityDescriptor | ProjectedDiagnosticInspection {
  const node = requireProjectedNode(projection, nodeId);
  return node.kind === 'entity'
    ? describeEntity(workspace, node.entityId)
    : inspectDiagnosticNode(workspace, node);
}

function inspectOccurrence(
  workspace: InspectionWorkspace,
  referenceId: string,
  projectedSourceEntityId: EntityId,
  projectedTargetEntityId: EntityId | undefined,
): ProjectedOccurrenceInspection {
  const occurrence = describeReference(workspace, referenceId);
  const exactTarget =
    occurrence.resolution.status === 'resolved'
      ? occurrence.resolution.target.entityId
      : undefined;
  return {
    occurrence,
    sourceRolledUp: occurrence.source.entityId !== projectedSourceEntityId,
    targetRolledUp:
      exactTarget !== undefined &&
      projectedTargetEntityId !== undefined &&
      exactTarget !== projectedTargetEntityId,
  };
}

function compareEntityDescriptors(
  left: EntityDescriptor,
  right: EntityDescriptor,
): number {
  return (
    left.sourcePath.localeCompare(right.sourcePath) ||
    (left.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER) ||
    left.sourceSpan.start.line - right.sourceSpan.start.line ||
    left.sourceSpan.start.column - right.sourceSpan.start.column ||
    left.entityId.localeCompare(right.entityId)
  );
}

function compareOccurrences(
  left: ReferenceOccurrenceDescriptor,
  right: ReferenceOccurrenceDescriptor,
): number {
  return (
    left.source.sourcePath.localeCompare(right.source.sourcePath) ||
    (left.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER) -
      (right.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER) ||
    left.sourceSpan.start.line - right.sourceSpan.start.line ||
    left.sourceSpan.start.column - right.sourceSpan.start.column ||
    left.referenceId.localeCompare(right.referenceId)
  );
}

function describeReferencesInSourceOrder(
  workspace: InspectionWorkspace,
  referenceIds: readonly string[],
): readonly ReferenceOccurrenceDescriptor[] {
  return referenceIds
    .map((referenceId) => describeReference(workspace, referenceId))
    .sort(compareOccurrences);
}

export function inspectProjectedEdge(
  workspace: InspectionWorkspace,
  projection: ViewProjection,
  edgeId: string,
): ProjectedEdgeInspection {
  const edge = projection.edges.find((candidate) => candidate.id === edgeId);
  if (edge === undefined) {
    throw new Error(`Projection is missing edge "${edgeId}" for inspection.`);
  }
  const sourceNode = requireProjectedEntity(projection, edge.sourceNodeId);
  const projectedSource = describeEntity(workspace, sourceNode.entityId);
  if (edge.kind === 'hierarchy') {
    const targetNode = requireProjectedEntity(projection, edge.targetNodeId);
    return {
      kind: 'hierarchy',
      projectionEdgeId: edge.id,
      parent: projectedSource,
      child: describeEntity(workspace, targetNode.entityId),
    };
  }
  const targetNode = requireProjectedNode(projection, edge.targetNodeId);
  const targetEntityId =
    targetNode.kind === 'entity' ? targetNode.entityId : undefined;
  return {
    kind: 'reference',
    projectionEdgeId: edge.id,
    status: edge.status,
    projectedSource,
    projectedTarget: projectedTargetDescriptor(
      workspace,
      projection,
      edge.targetNodeId,
    ),
    occurrences: describeReferencesInSourceOrder(
      workspace,
      edge.referenceIds,
    ).map(({ referenceId }) =>
      inspectOccurrence(
        workspace,
        referenceId,
        sourceNode.entityId,
        targetEntityId,
      ),
    ),
  };
}
