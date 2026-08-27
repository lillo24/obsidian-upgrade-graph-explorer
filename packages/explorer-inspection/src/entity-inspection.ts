import type { EntityId, Reference } from '@icarus-graph-explorer/core';

import { describeEntity, describeReference } from './descriptors';
import type {
  AmbiguousCandidateMentionInspection,
  BacklinkInspection,
  EntityInspection,
  OutgoingReferenceInspection,
} from './types';
import type { InspectionWorkspace } from './workspace';

function referenceOrder(left: Reference, right: Reference): number {
  const leftStart = left.sourceSpan.start;
  const rightStart = right.sourceSpan.start;
  return (
    leftStart.line - rightStart.line ||
    leftStart.column - rightStart.column ||
    (leftStart.offset ?? Number.MAX_SAFE_INTEGER) -
      (rightStart.offset ?? Number.MAX_SAFE_INTEGER) ||
    left.id.localeCompare(right.id)
  );
}

export function inspectEntity(
  workspace: InspectionWorkspace,
  entityId: EntityId,
): EntityInspection {
  workspace.requireEntity(entityId);
  const descendants = workspace.descendants(entityId);
  const subtreeIds = new Set([entityId, ...descendants.map(({ id }) => id)]);

  const outgoingReferences: OutgoingReferenceInspection[] = [
    ...subtreeIds,
  ].flatMap((sourceEntityId) =>
    workspace.referencesFrom(sourceEntityId).map((reference) => ({
      occurrence: describeReference(workspace, reference.id),
      sourceIsDescendant: sourceEntityId !== entityId,
    })),
  );
  outgoingReferences.sort(
    (left, right) =>
      left.occurrence.source.sourcePath.localeCompare(
        right.occurrence.source.sourcePath,
      ) ||
      left.occurrence.sourceSpan.start.line -
        right.occurrence.sourceSpan.start.line ||
      left.occurrence.sourceSpan.start.column -
        right.occurrence.sourceSpan.start.column ||
      left.occurrence.referenceId.localeCompare(right.occurrence.referenceId),
  );

  const backlinks: BacklinkInspection[] = [...subtreeIds].flatMap(
    (targetEntityId) =>
      workspace.resolvedReferencesTo(targetEntityId).map((reference) => ({
        occurrence: describeReference(workspace, reference.id),
        target: describeEntity(workspace, targetEntityId),
        targetIsDescendant: targetEntityId !== entityId,
      })),
  );
  backlinks.sort(
    (left, right) =>
      left.occurrence.source.sourcePath.localeCompare(
        right.occurrence.source.sourcePath,
      ) ||
      referenceOrder(
        workspace.requireReference(left.occurrence.referenceId),
        workspace.requireReference(right.occurrence.referenceId),
      ),
  );

  const ambiguousReferences = new Map<string, Reference>();
  for (const candidateEntityId of subtreeIds) {
    for (const reference of workspace.ambiguousReferencesForCandidate(
      candidateEntityId,
    )) {
      ambiguousReferences.set(reference.id, reference);
    }
  }
  const ambiguousCandidateMentions: AmbiguousCandidateMentionInspection[] = [
    ...ambiguousReferences.values(),
  ]
    .sort(referenceOrder)
    .map((reference) => {
      if (reference.resolution.status !== 'ambiguous') {
        throw new Error(
          `Ambiguous candidate index contains non-ambiguous reference "${reference.id}".`,
        );
      }
      const relevantCandidates = reference.resolution.candidateEntityIds
        .filter((candidateId) => subtreeIds.has(candidateId))
        .map((candidateId) => describeEntity(workspace, candidateId));
      return {
        occurrence: describeReference(workspace, reference.id),
        relevantCandidates,
      };
    });

  return {
    entity: describeEntity(workspace, entityId),
    descendantCount: descendants.length,
    outgoingReferences,
    backlinks,
    ambiguousCandidateMentions,
  };
}
