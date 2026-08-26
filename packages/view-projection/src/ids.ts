import type { EntityId } from '@icarus-graph-explorer/core';

import type {
  DiagnosticReferenceStatus,
  ProjectionEdgeId,
  ProjectionNodeId,
  ReferenceResolutionStatus,
} from './types';

function tupleId(parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}

export function entityNodeId(entityId: EntityId): ProjectionNodeId {
  return tupleId(['entity', entityId]);
}

export function diagnosticTargetNodeId(
  sourceNodeId: ProjectionNodeId,
  status: DiagnosticReferenceStatus,
  rawTarget: string,
  candidateEntityIds: readonly EntityId[],
): ProjectionNodeId {
  return tupleId([
    'reference-target',
    sourceNodeId,
    status,
    rawTarget,
    [...candidateEntityIds].sort(),
  ]);
}

export function hierarchyEdgeId(
  sourceNodeId: ProjectionNodeId,
  targetNodeId: ProjectionNodeId,
): ProjectionEdgeId {
  return tupleId(['hierarchy', sourceNodeId, targetNodeId]);
}

export function referenceEdgeId(
  sourceNodeId: ProjectionNodeId,
  targetNodeId: ProjectionNodeId,
  status: ReferenceResolutionStatus,
): ProjectionEdgeId {
  return tupleId(['reference', sourceNodeId, targetNodeId, status]);
}
