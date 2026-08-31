import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';

import { buildBaseProjection } from './base-projection';
import type { DisclosureResult } from './disclosure';
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
    return { ...node, revealableDescendantCount };
  });
  return { ...projection, nodes };
}

function hasEntityVisibilityFilter(state: ViewProjectionState): boolean {
  return (
    state.filters?.pathPrefixes !== undefined ||
    state.filters?.entityKinds !== undefined ||
    (state.filters?.text?.trim().length ?? 0) > 0 ||
    state.filters?.query !== undefined
  );
}

function preparedQuery(filters: ViewProjectionState['filters']) {
  if (filters?.query === undefined) return undefined;
  return parseGraphQuery(filters.query);
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

export function projectView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  const base = buildBaseProjection(workspace, state.disclosure);
  const focused = applyFocus(workspace, base.projection, state.focus);
  const query = preparedQuery(state.filters);
  const filtered = applyFilters(workspace, focused, state.filters, query);
  let finalized = filtered;
  if (
    state.focus === undefined &&
    base.disclosure.revealableDescendantIdsByEntityId.size > 0
  ) {
    if (hasEntityVisibilityFilter(state)) {
      const candidateBase = buildBaseProjection(
        workspace,
        expandAllCandidateOwners(state.disclosure, base.disclosure),
      ).projection;
      const candidateFiltered = applyFilters(
        workspace,
        candidateBase,
        state.filters,
        query,
      );
      const retainedCandidateEntityIds = new Set(
        candidateFiltered.nodes.flatMap((node) =>
          node.kind === 'entity' ? [node.entityId] : [],
        ),
      );
      finalized = withActionableDisclosureCounts(
        filtered,
        retainedCandidateEntityIds,
        base.disclosure,
      );
    } else {
      finalized = withActionableDisclosureCounts(
        filtered,
        undefined,
        base.disclosure,
      );
    }
  }
  // Focus reachability depends on reference endpoint roll-up, which expansion
  // can change non-locally. Suppress speculative Expand controls in Focus;
  // final hierarchy edges still provide exact Collapse counts to the renderer.
  const validation = validateViewProjection(workspace, finalized);
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

export function projectSnapshot(
  snapshot: KnowledgeSnapshot,
  state: ViewProjectionState,
): ViewProjection {
  return projectView(createProjectionWorkspace(snapshot), state);
}
