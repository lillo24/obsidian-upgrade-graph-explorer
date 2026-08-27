import type { EntityId } from '@icarus-graph-explorer/core';
import {
  documentOnlyProjectionState,
  type FocusProjectionState,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

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
    };

export function initialGraphState(): ViewProjectionState {
  return documentOnlyProjectionState();
}

function withoutId(ids: readonly EntityId[], entityId: EntityId): EntityId[] {
  return ids.filter((id) => id !== entityId);
}

function withId(ids: readonly EntityId[], entityId: EntityId): EntityId[] {
  return [...new Set([...ids, entityId])].sort();
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
  }
}
