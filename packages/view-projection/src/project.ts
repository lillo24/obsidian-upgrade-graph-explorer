import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';

import { buildBaseProjection } from './base-projection';
import { retainDirectCandidateEntities } from './candidate-eligibility';
import type {
  DisclosureCalculationOptions,
  DisclosureResult,
} from './disclosure';
import { prepareViewProjectionFilters } from './filter-plan';
import {
  countProjectionOperation,
  measureProjectionPhase,
  type ProjectionInstrumentation,
} from './instrumentation';
import { applyFilters, applyFocus } from './slicing';
import type {
  ProjectedNode,
  StructuralDisclosureState,
  ViewProjection,
  ViewProjectionState,
} from './types';
import { validateViewProjection } from './validation';
import {
  createProjectionWorkspace,
  type ProjectionWorkspace,
} from './workspace';

function withActionableDisclosureCounts(
  projection: ViewProjection,
  retainedCandidateEntityIds: ReadonlySet<string> | undefined,
  disclosure: DisclosureResult,
): ViewProjection {
  const nodes: ProjectedNode[] = projection.nodes.map((node) => {
    if (node.kind !== 'entity') return node;
    const candidates =
      disclosure.revealableDescendantIdsByEntityId.get(node.entityId) ?? [];
    const revealableDescendantCount =
      retainedCandidateEntityIds === undefined
        ? candidates.length
        : candidates.filter((entityId) =>
            retainedCandidateEntityIds.has(entityId),
          ).length;
    return revealableDescendantCount === node.revealableDescendantCount
      ? node
      : { ...node, revealableDescendantCount };
  });
  return { ...projection, nodes };
}

function expandAllCandidateOwners(
  state: StructuralDisclosureState,
  disclosure: DisclosureResult,
): StructuralDisclosureState {
  const owners = new Set(disclosure.revealableDescendantIdsByEntityId.keys());
  return {
    ...state,
    expandedEntityIds: [
      ...new Set([...state.expandedEntityIds, ...owners]),
    ].sort(),
    collapsedEntityIds: state.collapsedEntityIds.filter(
      (entityId) => !owners.has(entityId),
    ),
  };
}

/** Internal seam for projection-only disclosure policies such as Focus depth. */
export function projectViewWithDisclosurePolicy(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  disclosureOptions?: DisclosureCalculationOptions,
  instrumentation?: ProjectionInstrumentation,
): ViewProjection {
  countProjectionOperation(instrumentation, 'baseProjectionBuilds');
  countProjectionOperation(
    instrumentation,
    'canonicalReferencesScanned',
    workspace.references().length,
  );
  const base = measureProjectionPhase(instrumentation, 'base-projection', () =>
    buildBaseProjection(workspace, state.disclosure, disclosureOptions),
  );
  const focused = measureProjectionPhase(instrumentation, 'focus-slice', () =>
    applyFocus(workspace, base.projection, state.focus),
  );
  countProjectionOperation(instrumentation, 'filterPreparations');
  const filterPlan = measureProjectionPhase(
    instrumentation,
    'filter-preparation',
    () => prepareViewProjectionFilters(state.filters),
  );
  countProjectionOperation(instrumentation, 'primaryFilterApplications');
  const filtered = measureProjectionPhase(
    instrumentation,
    'primary-filter',
    () => applyFilters(workspace, focused, filterPlan, instrumentation),
  );
  let finalized = filtered;
  if (
    state.focus === undefined &&
    base.disclosure.revealableDescendantIdsByEntityId.size > 0
  ) {
    if (filterPlan.hasEntityVisibilityFilter) {
      if (!filterPlan.hasProjectedTextFilter) {
        countProjectionOperation(instrumentation, 'candidateDirectPlans');
        const retainedCandidateEntityIds = measureProjectionPhase(
          instrumentation,
          'candidate-direct-plan',
          () =>
            retainDirectCandidateEntities(
              workspace,
              base.disclosure,
              filterPlan,
              instrumentation,
            ),
        );
        finalized = measureProjectionPhase(
          instrumentation,
          'actionable-count-finalization',
          () =>
            withActionableDisclosureCounts(
              filtered,
              retainedCandidateEntityIds,
              base.disclosure,
            ),
        );
      } else {
        countProjectionOperation(instrumentation, 'candidateLegacyFallbacks');
        countProjectionOperation(
          instrumentation,
          'candidateBaseProjectionBuilds',
        );
        countProjectionOperation(
          instrumentation,
          'canonicalReferencesScanned',
          workspace.references().length,
        );
        const candidateBase = measureProjectionPhase(
          instrumentation,
          'candidate-legacy-base',
          () =>
            buildBaseProjection(
              workspace,
              expandAllCandidateOwners(state.disclosure, base.disclosure),
              disclosureOptions,
            ).projection,
        );
        countProjectionOperation(
          instrumentation,
          'legacyCandidateFilterApplications',
        );
        const candidateFiltered = measureProjectionPhase(
          instrumentation,
          'candidate-legacy-filter',
          () =>
            applyFilters(workspace, candidateBase, filterPlan, instrumentation),
        );
        const retainedCandidateEntityIds = new Set(
          candidateFiltered.nodes.flatMap((node) =>
            node.kind === 'entity' ? [node.entityId] : [],
          ),
        );
        finalized = measureProjectionPhase(
          instrumentation,
          'actionable-count-finalization',
          () =>
            withActionableDisclosureCounts(
              filtered,
              retainedCandidateEntityIds,
              base.disclosure,
            ),
        );
      }
    } else {
      finalized = measureProjectionPhase(
        instrumentation,
        'actionable-count-finalization',
        () =>
          withActionableDisclosureCounts(filtered, undefined, base.disclosure),
      );
    }
  }
  // Focus reachability depends on reference endpoint roll-up, which expansion
  // can change non-locally. Suppress speculative Expand controls in Focus;
  // final hierarchy edges still provide exact Collapse counts to the renderer.
  countProjectionOperation(instrumentation, 'validationRuns');
  const validation = measureProjectionPhase(instrumentation, 'validation', () =>
    validateViewProjection(workspace, finalized),
  );
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Projection invariant failure${
        first === undefined ? '.' : `: ${first.path} ${first.message}`
      }`,
    );
  }
  return validation.value;
}

export function projectView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  instrumentation?: ProjectionInstrumentation,
): ViewProjection {
  return projectViewWithDisclosurePolicy(
    workspace,
    state,
    undefined,
    instrumentation,
  );
}

export function projectSnapshot(
  snapshot: KnowledgeSnapshot,
  state: ViewProjectionState,
  instrumentation?: ProjectionInstrumentation,
): ViewProjection {
  return projectView(
    createProjectionWorkspace(snapshot),
    state,
    instrumentation,
  );
}
