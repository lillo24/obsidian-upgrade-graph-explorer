import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { ViewProjectionState } from '@icarus-graph-explorer/view-projection';

import { initialGraphState, normalizeGraphState } from '../graph-state';
import type { SavedGraphFilter } from '../persistence/saved-filters';
import { activeGraphFilterCount } from './graph-filter-count';
import { GraphFilters } from './GraphFilters';

function renderFilters(
  state: ViewProjectionState,
  options: {
    readonly contained?: boolean;
    readonly open?: boolean;
    readonly savedFilters?: readonly SavedGraphFilter[];
    readonly savedFiltersWritable?: boolean;
  } = {},
): string {
  return renderToStaticMarkup(
    <GraphFilters
      contained={options.contained ?? false}
      onAction={() => undefined}
      onApplySavedFilter={() => undefined}
      onDeleteSavedFilter={() => undefined}
      onOpenChange={() => undefined}
      onSaveCurrentQuery={() => undefined}
      open={options.open ?? false}
      pathScopes={['folder-a', 'folder-b']}
      savedFilters={options.savedFilters ?? []}
      savedFiltersStatus="Saved Filters are stored for this stable workspace."
      savedFiltersWritable={options.savedFiltersWritable ?? true}
      state={state}
    />,
  );
}

describe('graph Filters controls', () => {
  it('renders a compact controlled trigger while the panel is closed', () => {
    const markup = renderFilters(normalizeGraphState(initialGraphState()));

    expect(markup).toContain('aria-controls="graph-filters-panel"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('>Filters<');
    expect(markup).not.toContain('id="graph-filters-panel"');
    expect(markup).not.toContain('<details');
  });

  it('keeps every visibility group inside the labeled floating panel', () => {
    const markup = renderFilters(normalizeGraphState(initialGraphState()), {
      open: true,
    });

    expect(markup).toContain(
      'class="graph-filters__panel" data-graph-scroll-container="true"',
    );
    expect(markup).toContain('aria-labelledby="graph-filters-heading"');
    expect(markup).toContain('>Path Scope<');
    expect(markup).toContain('<legend>Entity Content</legend>');
    expect(markup).toContain('>Heading limit<');
    expect(markup).toContain('<option value="" selected="">No limit</option>');
    expect(markup).toContain('<option value="6">######</option>');
    expect(markup).toContain(
      'Limits sections by literal Markdown heading level. Structure separately controls how many section-tree levels are automatically visible.',
    );
    expect(markup).toContain('<legend>Reference Status</legend>');
    expect(markup).toContain('>Advanced query<');
    expect(markup).toContain('<textarea');
    expect(markup).toContain('id="advanced-graph-query-help"');
    expect(markup).toContain('>Saved Filters<');
    expect(markup).toContain('>Save current query<');
    expect(markup.match(/Blocks/gu)).toHaveLength(1);
    expect(markup).not.toContain('Structural ancestors may remain');
  });

  it('uses the contained presentation inside maximized Tools', () => {
    const markup = renderFilters(normalizeGraphState(initialGraphState()), {
      contained: true,
      open: true,
    });

    expect(markup).toContain(
      'graph-filters__panel graph-filters__panel--contained',
    );
  });

  it('keeps confirmed presets applicable when registry writes are disabled', () => {
    const markup = renderFilters(normalizeGraphState(initialGraphState()), {
      open: true,
      savedFilters: [{ name: 'Sections', query: 'kind:section' }],
      savedFiltersWritable: false,
    });

    expect(markup).toContain('<button type="button">Apply</button>');
    expect(markup).toContain(
      '<button disabled="" type="button">Delete</button>',
    );
  });

  it('counts active user-visible groups instead of hidden implementation fields', () => {
    const initial = normalizeGraphState(initialGraphState());
    const configured: ViewProjectionState = {
      ...initial,
      disclosure: {
        ...initial.disclosure,
        defaultDepth: 3,
        includeBlocks: true,
        maxSectionLevel: 3,
      },
      filters: {
        pathPrefixes: ['folder-a'],
        entityKinds: ['document', 'section', 'block'],
        referenceStatuses: ['resolved'],
        query: 'kind:section',
      },
    };

    expect(activeGraphFilterCount(initial)).toBe(0);
    expect(activeGraphFilterCount(configured)).toBe(5);
    expect(renderFilters(configured)).toContain(
      'aria-label="Filters, 5 active filter groups"',
    );
  });
});
