import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphQueryEditor } from './GraphQueryEditor';

describe('controlled QUERY1 editor', () => {
  it('uses placement-specific IDs, invalid-draft context and non-destructive Reset draft', () => {
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
    expect(markup).toContain(
      'aria-describedby="test-query-help test-query-error"',
    );
    expect(markup).toContain('aria-invalid="true"');
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
    expect(markup).toContain(
      '<button disabled="" type="button">Clear query</button>',
    );
  });
});
