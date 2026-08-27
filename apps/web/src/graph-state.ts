import type { EntityId, EntityKind } from '@icarus-graph-explorer/core';
import {
  documentOnlyProjectionState,
  type FocusProjectionState,
  type ReferenceResolutionStatus,
  type ViewProjectionFilters,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export const ALL_ENTITY_KINDS = [
  'document',
  'section',
  'block',
] as const satisfies readonly EntityKind[];

export const ALL_REFERENCE_STATUSES = [
  'resolved',
  'unresolved',
  'ambiguous',
  'invalid',
] as const satisfies readonly ReferenceResolutionStatus[];

export type GraphStateAction =
  | {
      readonly type: 'toggle-entity';
      readonly entityId: EntityId;
      readonly currentlyOpen: boolean;
    }
  | { readonly type: 'set-depth'; readonly depth: 0 | 1 }
  | { readonly type: 'set-include-blocks'; readonly includeBlocks: boolean }
  | { readonly type: 'enter-focus'; readonly entityId: EntityId }
  | { readonly type: 'exit-focus' }
  | { readonly type: 'set-focus-hops'; readonly hops: 1 | 2 | 3 }
  | {
      readonly type: 'set-focus-direction';
      readonly direction: FocusProjectionState['direction'];
    }
  | { readonly type: 'set-path-scope'; readonly pathPrefix: string | null }
  | {
      readonly type: 'toggle-entity-kind';
      readonly entityKind: EntityKind;
      readonly enabled: boolean;
    }
  | {
      readonly type: 'toggle-reference-status';
      readonly status: ReferenceResolutionStatus;
      readonly enabled: boolean;
    }
  | { readonly type: 'apply-navigation'; readonly state: ViewProjectionState }
  | { readonly type: 'reset-view' };

export function initialGraphState(): ViewProjectionState {
  return documentOnlyProjectionState();
}

function withoutId(ids: readonly EntityId[], entityId: EntityId): EntityId[] {
  return ids.filter((id) => id !== entityId);
}

function withId(ids: readonly EntityId[], entityId: EntityId): EntityId[] {
  return [...new Set([...ids, entityId])].sort();
}

function updatedFilterValues<T extends string>(
  current: readonly T[] | undefined,
  all: readonly T[],
  value: T,
  enabled: boolean,
): readonly T[] | undefined {
  const values = new Set(current ?? all);
  if (enabled) values.add(value);
  else values.delete(value);
  const sorted = all.filter((candidate) => values.has(candidate));
  return sorted.length === all.length ? undefined : sorted;
}

function withFilters(
  state: ViewProjectionState,
  update: (filters: ViewProjectionFilters) => ViewProjectionFilters,
): ViewProjectionState {
  const filters = update(state.filters ?? {});
  const hasFilters =
    filters.pathPrefixes !== undefined ||
    filters.text !== undefined ||
    filters.entityKinds !== undefined ||
    filters.referenceStatuses !== undefined;
  return {
    disclosure: state.disclosure,
    ...(state.focus === undefined ? {} : { focus: state.focus }),
    ...(hasFilters ? { filters } : {}),
  };
}

function withoutFilter(
  filters: ViewProjectionFilters,
  key: keyof ViewProjectionFilters,
): ViewProjectionFilters {
  const next = { ...filters };
  delete next[key];
  return next;
}

export function graphStateReducer(
  state: ViewProjectionState,
  action: GraphStateAction,
): ViewProjectionState {
  switch (action.type) {
    case 'toggle-entity':
      return {
        ...state,
        disclosure: {
          ...state.disclosure,
          expandedEntityIds: action.currentlyOpen
            ? withoutId(state.disclosure.expandedEntityIds, action.entityId)
            : withId(state.disclosure.expandedEntityIds, action.entityId),
          collapsedEntityIds: action.currentlyOpen
            ? withId(state.disclosure.collapsedEntityIds, action.entityId)
            : withoutId(state.disclosure.collapsedEntityIds, action.entityId),
        },
      };
    case 'set-depth':
      return {
        ...state,
        disclosure: { ...state.disclosure, defaultDepth: action.depth },
      };
    case 'set-include-blocks':
      return {
        ...state,
        disclosure: {
          ...state.disclosure,
          includeBlocks: action.includeBlocks,
        },
      };
    case 'enter-focus':
      return {
        ...state,
        focus: {
          rootEntityId: action.entityId,
          hops: state.focus?.hops ?? 1,
          direction: state.focus?.direction ?? 'both',
          hierarchyContext: 'ancestors',
        },
      };
    case 'exit-focus': {
      return {
        disclosure: state.disclosure,
        ...(state.filters === undefined ? {} : { filters: state.filters }),
      };
    }
    case 'set-focus-hops':
      return state.focus === undefined
        ? state
        : { ...state, focus: { ...state.focus, hops: action.hops } };
    case 'set-focus-direction':
      return state.focus === undefined
        ? state
        : {
            ...state,
            focus: { ...state.focus, direction: action.direction },
          };
    case 'set-path-scope':
      return withFilters(state, (filters) =>
        action.pathPrefix === null
          ? withoutFilter(filters, 'pathPrefixes')
          : { ...filters, pathPrefixes: [action.pathPrefix] },
      );
    case 'toggle-entity-kind':
      return withFilters(state, (filters) => {
        const entityKinds = updatedFilterValues(
          filters.entityKinds,
          ALL_ENTITY_KINDS,
          action.entityKind,
          action.enabled,
        );
        return entityKinds === undefined
          ? withoutFilter(filters, 'entityKinds')
          : { ...filters, entityKinds };
      });
    case 'toggle-reference-status':
      return withFilters(state, (filters) => {
        const referenceStatuses = updatedFilterValues(
          filters.referenceStatuses,
          ALL_REFERENCE_STATUSES,
          action.status,
          action.enabled,
        );
        return referenceStatuses === undefined
          ? withoutFilter(filters, 'referenceStatuses')
          : { ...filters, referenceStatuses };
      });
    case 'apply-navigation':
      return action.state;
    case 'reset-view':
      return initialGraphState();
  }
}
