import { describe, expect, it } from 'vitest';

import {
  entitySearchDisclosureReducer,
  INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE,
} from './entity-search-disclosure';

describe('canonical search result disclosure', () => {
  it('opens for non-empty typing and closes when the query is cleared', () => {
    const open = entitySearchDisclosureReducer(
      INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE,
      { type: 'change-query', query: '  Source  ' },
    );
    expect(open).toEqual({ query: '  Source  ', resultsOpen: true });

    expect(
      entitySearchDisclosureReducer(open, {
        type: 'change-query',
        query: '   ',
      }),
    ).toEqual({ query: '   ', resultsOpen: false });
  });

  it('dismisses results without clearing the query and reopens on demand', () => {
    const queried = entitySearchDisclosureReducer(
      INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE,
      { type: 'change-query', query: 'Target' },
    );
    const dismissed = entitySearchDisclosureReducer(queried, {
      type: 'dismiss-results',
    });

    expect(dismissed).toEqual({ query: 'Target', resultsOpen: false });
    expect(
      entitySearchDisclosureReducer(dismissed, {
        type: 'reopen-results',
      }),
    ).toEqual({ query: 'Target', resultsOpen: true });
  });

  it('does not open an empty query', () => {
    expect(
      entitySearchDisclosureReducer(INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE, {
        type: 'reopen-results',
      }),
    ).toBe(INITIAL_ENTITY_SEARCH_DISCLOSURE_STATE);
  });
});
