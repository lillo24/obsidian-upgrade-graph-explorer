export interface EntitySearchDisclosureState {
  readonly query: string;
  readonly resultsOpen: boolean;
}

export type EntitySearchDisclosureAction =
  | { readonly type: 'change-query'; readonly query: string }
  | { readonly type: 'dismiss-results' }
  | { readonly type: 'reopen-results' };

export const INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE: EntitySearchDisclosureState =
  {
    query: '',
    resultsOpen: false,
  };

export function entitySearchDisclosureReducer(
  state: EntitySearchDisclosureState,
  action: EntitySearchDisclosureAction,
): EntitySearchDisclosureState {
  switch (action.type) {
    case 'change-query':
      return {
        query: action.query,
        resultsOpen: action.query.trim().length > 0,
      };
    case 'dismiss-results':
      return state.resultsOpen ? { ...state, resultsOpen: false } : state;
    case 'reopen-results':
      return state.query.trim().length > 0 && !state.resultsOpen
        ? { ...state, resultsOpen: true }
        : state;
  }
}
