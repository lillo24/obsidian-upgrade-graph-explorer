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
      aria-label={compact ? 'Query' : undefined}
      aria-labelledby={compact ? undefined : `${idPrefix}-heading`}
      className={`advanced-graph-query${compact ? ' advanced-graph-query--compact' : ''}`}
    >
      {compact ? null : (
        <div className="advanced-graph-query__heading">
          <h4 id={`${idPrefix}-heading`}>Advanced query</h4>
          {dirty ? <span>Draft not applied</span> : null}
        </div>
      )}
      <label
        className="advanced-graph-query__label"
        htmlFor={`${idPrefix}-input`}
      >
        Query
      </label>
      <div className="advanced-graph-query__input-row">
        <textarea
          autoComplete="off"
          aria-describedby={
            [
              compact ? undefined : `${idPrefix}-help`,
              queryIssue === undefined ? undefined : `${idPrefix}-error`,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-invalid={queryIssue === undefined ? undefined : true}
          id={`${idPrefix}-input`}
          name={`${idPrefix}-query`}
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder={'path:"notes" AND (sections OR level<=3)'}
          rows={compact ? 2 : 3}
          spellCheck={false}
          value={queryDraft}
        />
        {compact ? (
          <div className="advanced-graph-query__icon-actions">
            <button
              aria-label="Apply query"
              title="Apply query"
              onClick={onApply}
              type="button"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            </button>
            <button
              aria-label="Clear query"
              title="Clear query"
              disabled={activeQuery.length === 0 && queryDraft.length === 0}
              onClick={onClear}
              type="button"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
      {compact ? null : (
        <p id={`${idPrefix}-help`}>
          {
            'Use path, title, text, kind, or level with explicit AND, OR, NOT, and parentheses. path:"notes" contains text; path="Notes/Foo.md" matches one exact, case-sensitive source path. Text searches paths and section titles, not Markdown body content.'
          }
        </p>
      )}
      {queryIssue === undefined ? null : (
        <p className="graph-filter-error" id={`${idPrefix}-error`}>
          {queryIssue}
        </p>
      )}
      {!compact ? (
        <div className="advanced-graph-query__actions">
          <>
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
          </>
          {dirty ? (
            <button onClick={onResetDraft} type="button">
              Reset draft
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});
