import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  SavedGraphQueries,
  type SavedGraphQueriesState,
} from './SavedGraphQueries';
import { SavedQueriesPopover } from './SavedQueriesPopover';

const state: SavedGraphQueriesState = {
  activeQuery: 'kind:document',
  savedFilters: [{ name: 'Files', query: 'kind:document' }],
  savedFiltersStatus: 'Available locally.',
  savedFiltersWritable: true,
  onApplySavedFilter: () => undefined,
  onDeleteSavedFilter: () => undefined,
  onSaveCurrentQuery: () => undefined,
};

describe('shared Saved queries presentation', () => {
  it('keeps Network management behind a labelled nonmodal trigger', () => {
    const markup = renderToStaticMarkup(<SavedQueriesPopover {...state} />);
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-label="Saved queries"');
    expect(markup).toContain('title="Saved queries"');
    expect(markup).toContain('network-explorer__saved-queries-icon');
    expect(markup).not.toContain('>Saved queries</button>');
    expect(markup).not.toContain('Save current query');
  });

  it('reuses the registry entries with placement-specific labels and management actions', () => {
    const markup = renderToStaticMarkup(
      <SavedGraphQueries {...state} idPrefix="network-saved-queries" />,
    );
    expect(markup).toContain('id="network-saved-queries-heading"');
    expect(markup).toContain('for="network-saved-queries-name"');
    expect(markup).toContain('Available locally.');
    expect(markup).toContain(
      '<strong>Files</strong><code>kind:document</code>',
    );
    expect(markup).toContain('>Save current query</button>');
    expect(markup).toContain('<button type="button">Apply</button>');
    expect(markup).toContain('<button type="button">Delete</button>');
  });

  it('retains read-only apply and guards writes or saving an empty active query', () => {
    const readOnly = renderToStaticMarkup(
      <SavedGraphQueries
        {...state}
        savedFiltersWritable={false}
        idPrefix="test"
      />,
    );
    expect(readOnly).toContain('<button type="button">Apply</button>');
    expect(readOnly).toContain(
      '<button disabled="" type="button">Delete</button>',
    );
    expect(readOnly).toContain(
      '<button disabled="" type="button">Save current query</button>',
    );
    const empty = renderToStaticMarkup(
      <SavedGraphQueries
        {...state}
        activeQuery=""
        savedFilters={[]}
        idPrefix="empty"
      />,
    );
    expect(empty).toContain('No saved queries for this workspace.');
    expect(empty).toContain(
      '<button disabled="" type="button">Save current query</button>',
    );
  });
});
