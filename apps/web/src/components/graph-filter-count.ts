import type { EntityKind } from '@icarus-graph-explorer/core';
import type { ViewProjectionState } from '@icarus-graph-explorer/view-projection';

/** Counts active filter groups using only controls visible to the user. */
export function activeGraphFilterCount(state: ViewProjectionState): number {
  const filters = state.filters;
  const visibleEntityKinds = filters?.entityKinds?.filter(
    (kind): kind is Exclude<EntityKind, 'block'> => kind !== 'block',
  );
  const entityContentActive =
    state.disclosure.includeBlocks ||
    (visibleEntityKinds !== undefined && visibleEntityKinds.length < 2);
  return (
    (filters?.pathPrefixes === undefined ? 0 : 1) +
    (entityContentActive ? 1 : 0) +
    (state.disclosure.maxSectionLevel === undefined ? 0 : 1) +
    (filters?.referenceStatuses === undefined ? 0 : 1)
  );
}
