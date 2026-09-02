import type { EntityId } from '@icarus-graph-explorer/core';

import type { DisclosureResult } from './disclosure';
import {
  matchesCanonicalEntityFilters,
  type PreparedViewProjectionFilters,
} from './filter-plan';
import {
  countProjectionOperation,
  type ProjectionInstrumentation,
} from './instrumentation';
import type { ProjectionWorkspace } from './workspace';

/** Candidate universe produced by the same one-action disclosure calculation. */
export function candidateVisibleEntityIds(
  disclosure: DisclosureResult,
): ReadonlySet<EntityId> {
  const available = new Set(disclosure.visibleEntityIds);
  for (const candidateIds of disclosure.revealableDescendantIdsByEntityId.values()) {
    for (const entityId of candidateIds) available.add(entityId);
  }
  return available;
}

/**
 * Computes DISC1 candidate retention from canonical predicates without
 * rebuilding a hypothetical projection. Projected-text matching cannot use
 * this path and remains on the exact legacy projection/filter oracle.
 */
export function retainDirectCandidateEntities(
  workspace: ProjectionWorkspace,
  disclosure: DisclosureResult,
  plan: PreparedViewProjectionFilters,
  instrumentation?: ProjectionInstrumentation,
): ReadonlySet<EntityId> {
  if (plan.invalid) return new Set<EntityId>();
  const available = candidateVisibleEntityIds(disclosure);
  const retained = new Set<EntityId>();
  let evaluations = 0;
  for (const entity of workspace.entities()) {
    if (!available.has(entity.id)) continue;
    evaluations += 1;
    if (matchesCanonicalEntityFilters(entity, plan)) retained.add(entity.id);
  }
  countProjectionOperation(
    instrumentation,
    'entityFilterEvaluations',
    evaluations,
  );

  let ancestorWalkSteps = 0;
  for (const entityId of [...retained]) {
    let parent = workspace.parent(entityId);
    while (parent !== undefined) {
      ancestorWalkSteps += 1;
      if (available.has(parent.id)) retained.add(parent.id);
      parent = workspace.parent(parent.id);
    }
  }
  countProjectionOperation(
    instrumentation,
    'ancestorWalkSteps',
    ancestorWalkSteps,
  );
  return retained;
}
