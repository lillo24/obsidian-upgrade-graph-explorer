import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphQueryEditor } from './GraphQueryEditor';

describe('controlled QUERY1 editor', () => {
  it('keeps compact errors and icon actions without visible draft clutter', () => {
    const markup = renderToStaticMarkup(
      <GraphQueryEditor
        activeQuery="kind:document"
        queryDraft="title:"
        queryIssue="Character 7: expected value"
        onDraftChange={() => undefined}
        onApply={() => undefined}
        onClear={() => undefined}
        onResetDraft={() => undefined}
        idPrefix="test-query"
        compact
      />,
    );
    expect(markup).toContain('id="test-query-input"');
    expect(markup).toContain('aria-describedby="test-query-error"');
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).not.toContain('>Reset draft</button>');
    expect(markup).not.toContain('Draft not applied');
    expect(markup).not.toContain('Advanced query');
    expect(markup).not.toContain('test-query-help');
    expect(markup).not.toContain('QUERY1:');
    expect(markup).toContain('class="advanced-graph-query__icon-actions"');
    expect(markup).toContain('aria-label="Apply query" title="Apply query"');
    expect(markup).toContain('aria-label="Clear query" title="Clear query"');
    expect(markup).not.toContain('>Apply query</button>');
    expect(markup).not.toContain('>Clear query</button>');
  });
  it('retains dirty-draft controls in Hierarchy', () => {
    const markup = renderToStaticMarkup(
      <GraphQueryEditor
        activeQuery="kind:document"
        queryDraft="title:"
        queryIssue={undefined}
        onDraftChange={() => undefined}
        onApply={() => undefined}
        onClear={() => undefined}
        onResetDraft={() => undefined}
        idPrefix="hierarchy"
      />,
    );
    expect(markup).toContain('>Reset draft</button>');
    expect(markup).toContain('Draft not applied');
  });
  it('omits Reset draft for a clean editor and disables empty Clear', () => {
    const markup = renderToStaticMarkup(
      <GraphQueryEditor
        activeQuery=""
        queryDraft=""
        queryIssue={undefined}
        onDraftChange={() => undefined}
        onApply={() => undefined}
        onClear={() => undefined}
        onResetDraft={() => undefined}
        idPrefix="test-query"
      />,
    );
    expect(markup).not.toContain('Reset draft');
    expect(markup).toContain('Advanced query');
    expect(markup).toContain('aria-describedby="test-query-help"');
    expect(markup).toContain(
      '<button disabled="" type="button">Clear query</button>',
    );
  });

  it('keeps an empty compact editor labelled, without a dangling description', () => {
    const markup = renderToStaticMarkup(
      <GraphQueryEditor
        activeQuery=""
        queryDraft=""
        queryIssue={undefined}
        onDraftChange={() => undefined}
        onApply={() => undefined}
        onClear={() => undefined}
        onResetDraft={() => undefined}
        idPrefix="network-query"
        compact
      />,
    );
    expect(markup).toContain('for="network-query-input"');
    expect(markup).not.toContain('aria-describedby');
    expect(markup).toContain(
      'aria-label="Clear query" title="Clear query" disabled=""',
    );
    expect(markup).not.toContain('Draft not applied');
  });
});
