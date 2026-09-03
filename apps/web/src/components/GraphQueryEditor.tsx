import { memo } from 'react';

export interface GraphQueryEditorState {
  readonly activeQuery: string;
  readonly queryDraft: string;
  readonly queryIssue: string | undefined;
  readonly onDraftChange: (draft: string) => void;
  readonly onApply: () => void;
  readonly onClear: () => void;
  readonly onResetDraft: () => void;
}

export const GraphQueryEditor = memo(function GraphQueryEditor({
  activeQuery,
  queryDraft,
  queryIssue,
  onDraftChange,
  onApply,
  onClear,
  onResetDraft,
  idPrefix,
  compact = false,
}: GraphQueryEditorState & {
  readonly idPrefix: string;
  readonly compact?: boolean;
}) {
  const dirty = queryDraft !== activeQuery;
  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      className={`advanced-graph-query${compact ? ' advanced-graph-query--compact' : ''}`}
    >
      <div className="advanced-graph-query__heading">
        <h4 id={`${idPrefix}-heading`}>Advanced query</h4>
        {dirty ? <span>Draft not applied</span> : null}
      </div>
      <label htmlFor={`${idPrefix}-input`}>
        Query
        <textarea
          autoComplete="off"
          aria-describedby={`${idPrefix}-help${queryIssue === undefined ? '' : ` ${idPrefix}-error`}`}
          aria-invalid={queryIssue === undefined ? undefined : true}
          id={`${idPrefix}-input`}
          name={`${idPrefix}-query`}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder={'path:"notes" AND (sections OR level<=3)'}
          rows={compact ? 2 : 3}
          spellCheck={false}
          value={queryDraft}
        />
      </label>
      <p id={`${idPrefix}-help`}>
        {compact
          ? 'QUERY1: AND, OR, NOT. path:"notes" contains text; path="Notes/Foo.md" matches an exact, case-sensitive source path.'
          : 'Use path, title, text, kind, or level with explicit AND, OR, NOT, and parentheses. path:"notes" contains text; path="Notes/Foo.md" matches one exact, case-sensitive source path. Text searches paths and section titles, not Markdown body content.'}
      </p>
      {queryIssue === undefined ? null : (
        <p className="graph-filter-error" id={`${idPrefix}-error`}>
          {queryIssue}
        </p>
      )}
      <div className="advanced-graph-query__actions">
        <button onClick={onApply} type="button">
          Apply query
        </button>
        <button
          disabled={activeQuery.length === 0 && queryDraft.length === 0}
          onClick={onClear}
          type="button"
        >
          Clear query
        </button>
        {dirty ? (
          <button onClick={onResetDraft} type="button">
            Reset draft
          </button>
        ) : null}
      </div>
    </section>
  );
});
