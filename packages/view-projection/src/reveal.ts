import type { EntityId } from '@icarus-graph-explorer/core';

import type { SectionHeadingLevel, ViewProjectionState } from './types';
import type { ProjectionWorkspace } from './workspace';

function sortedIds(ids: ReadonlySet<EntityId>): readonly EntityId[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

/**
 * Returns renderer-independent disclosure state that makes one canonical entity
 * structurally visible. Focus and filters are intentionally left to the caller.
 */
export function revealEntityInViewState(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  entityId: EntityId,
): ViewProjectionState {
  const target = workspace.requireEntity(entityId);
  const expanded = new Set(state.disclosure.expandedEntityIds);
  const collapsed = new Set(state.disclosure.collapsedEntityIds);
  let requiredHeadingLevel: SectionHeadingLevel | undefined =
    target.kind === 'section'
      ? (target.level as SectionHeadingLevel)
      : undefined;

  let ancestor = workspace.parent(target.id);
  while (ancestor !== undefined) {
    expanded.add(ancestor.id);
    collapsed.delete(ancestor.id);
    if (ancestor.kind === 'section') {
      requiredHeadingLevel = Math.max(
        requiredHeadingLevel ?? 1,
        ancestor.level,
      ) as SectionHeadingLevel;
    }
    ancestor = workspace.parent(ancestor.id);
  }

  const currentHeadingLevel = state.disclosure.maxSectionLevel;
  const widenedHeadingLevel =
    currentHeadingLevel !== undefined &&
    requiredHeadingLevel !== undefined &&
    requiredHeadingLevel > currentHeadingLevel
      ? requiredHeadingLevel
      : currentHeadingLevel;

  return {
    ...state,
    disclosure: {
      ...state.disclosure,
      expandedEntityIds: sortedIds(expanded),
      collapsedEntityIds: sortedIds(collapsed),
      includeBlocks:
        target.kind === 'block' ? true : state.disclosure.includeBlocks,
      ...(widenedHeadingLevel === undefined
        ? {}
        : { maxSectionLevel: widenedHeadingLevel }),
    },
  };
}
