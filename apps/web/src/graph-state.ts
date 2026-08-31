import type { EntityId, EntityKind } from '@icarus-graph-explorer/core';
import {
  documentOnlyProjectionState,
  type FocusProjectionState,
  type ReferenceResolutionStatus,
  type SectionHeadingLevel,
  type StructuralDepth,
  type ViewProjectionFilters,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export const ALL_ENTITY_KINDS = [
  'document',
  'section',
  'block',
] as const satisfies readonly EntityKind[];

export const USER_FILTERABLE_ENTITY_KINDS = [
  'document',
  'section',
] as const satisfies readonly Exclude<EntityKind, 'block'>[];

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
  | { readonly type: 'set-depth'; readonly depth: StructuralDepth }
  | {
      readonly type: 'set-heading-limit';
      readonly maxSectionLevel: SectionHeadingLevel | null;
    }
  | { readonly type: 'set-include-blocks'; readonly includeBlocks: boolean }
  | { readonly type: 'enter-focus'; readonly entityId: EntityId }
  | { readonly type: 'exit-focus' }
  | { readonly type: 'set-focus-hops'; readonly hops: 1 | 2 | 3 }
  | {
      readonly type: 'set-focus-direction';
      readonly direction: FocusProjectionState['direction'];
    }
  | { readonly type: 'set-path-scope'; readonly pathPrefix: string | null }
  | { readonly type: 'set-query'; readonly query: string | null }
  | {
      readonly type: 'toggle-entity-kind';
      readonly entityKind: Exclude<EntityKind, 'block'>;
      readonly enabled: boolean;
    }
  | {
      readonly type: 'toggle-reference-status';
      readonly status: ReferenceResolutionStatus;
      readonly enabled: boolean;
    }
  | { readonly type: 'apply-navigation'; readonly state: ViewProjectionState }
  | { readonly type: 'replace-state'; readonly state: ViewProjectionState }
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
    filters.referenceStatuses !== undefined ||
    filters.query !== undefined;
  return normalizeGraphState({
    disclosure: state.disclosure,
    ...(state.focus === undefined ? {} : { focus: state.focus }),
    ...(hasFilters ? { filters } : {}),
  });
}

function withoutFilter(
  filters: ViewProjectionFilters,
  key: keyof ViewProjectionFilters,
): ViewProjectionFilters {
  const next = { ...filters };
  delete next[key];
  return next;
}

function sameEntityKinds(
  left: readonly EntityKind[],
  right: readonly EntityKind[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

/**
 * Normalizes legacy duplicate Blocks state at the web boundary. Blocks remain
 * internally eligible in entityKinds while disclosure.includeBlocks is the
 * single user-facing opt-in that decides whether they can be projected.
 */
export function normalizeGraphState(
  state: ViewProjectionState,
): ViewProjectionState {
  const current = state.filters?.entityKinds;
  if (current === undefined) return state;
  const allowed = new Set<EntityKind>([...current, 'block']);
  const normalized = ALL_ENTITY_KINDS.filter((kind) => allowed.has(kind));
  const entityKinds =
    normalized.length === ALL_ENTITY_KINDS.length ? undefined : normalized;
  if (entityKinds !== undefined && sameEntityKinds(current, entityKinds)) {
    return state;
  }
  const nextFilters =
    entityKinds === undefined
      ? withoutFilter(state.filters ?? {}, 'entityKinds')
      : { ...(state.filters ?? {}), entityKinds };
  const hasFilters =
    nextFilters.pathPrefixes !== undefined ||
    nextFilters.text !== undefined ||
    nextFilters.entityKinds !== undefined ||
    nextFilters.referenceStatuses !== undefined ||
    nextFilters.query !== undefined;
  return {
    disclosure: state.disclosure,
    ...(state.focus === undefined ? {} : { focus: state.focus }),
    ...(hasFilters ? { filters: nextFilters } : {}),
  };
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
    case 'set-heading-limit': {
      const disclosure = { ...state.disclosure };
      if (action.maxSectionLevel === null) {
        delete disclosure.maxSectionLevel;
      } else {
        disclosure.maxSectionLevel = action.maxSectionLevel;
      }
      return { ...state, disclosure };
    }
    case 'set-include-blocks':
      return normalizeGraphState({
        ...state,
        disclosure: {
          ...state.disclosure,
          includeBlocks: action.includeBlocks,
        },
      });
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
    case 'set-query': {
      const current = state.filters?.query;
      if (current === (action.query ?? undefined)) return state;
      return withFilters(state, (filters) =>
        action.query === null
          ? withoutFilter(filters, 'query')
          : { ...filters, query: action.query },
      );
    }
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
    case 'replace-state':
      return normalizeGraphState(action.state);
    case 'reset-view':
      return initialGraphState();
  }
}
