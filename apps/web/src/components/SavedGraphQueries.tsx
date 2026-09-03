import { memo, useCallback, useState } from 'react';
import type { SavedGraphFilter } from '../persistence/saved-filters';

export interface SavedGraphQueriesState {
  readonly activeQuery: string;
  readonly savedFilters: readonly SavedGraphFilter[];
  readonly savedFiltersStatus: string;
  readonly savedFiltersWritable: boolean;
  readonly onApplySavedFilter: (query: string) => void;
  readonly onDeleteSavedFilter: (name: string) => string | undefined;
  readonly onSaveCurrentQuery: (name: string) => string | undefined;
}

/** Shared presentation only: all reads/writes use GraphExplorer's existing registry. */
export const SavedGraphQueries = memo(function SavedGraphQueries({
  activeQuery,
  savedFilters,
  savedFiltersStatus,
  savedFiltersWritable,
  onApplySavedFilter,
  onDeleteSavedFilter,
  onSaveCurrentQuery,
  idPrefix,
}: SavedGraphQueriesState & { readonly idPrefix: string }) {
  const [name, setName] = useState('');
  const [issue, setIssue] = useState<string>();
  const save = useCallback(() => {
    const error = onSaveCurrentQuery(name);
    setIssue(error);
    if (error === undefined) setName('');
  }, [name, onSaveCurrentQuery]);

  return (
    <section
      aria-labelledby={`${idPrefix}-heading`}
      className="saved-graph-filters"
    >
      <h4 id={`${idPrefix}-heading`}>Saved queries</h4>
      <p>{savedFiltersStatus}</p>
      <label htmlFor={`${idPrefix}-name`}>
        Name
        <input
          autoComplete="off"
          id={`${idPrefix}-name`}
          maxLength={64}
          onChange={(event) => {
            setName(event.currentTarget.value);
            setIssue(undefined);
          }}
          value={name}
        />
      </label>
      <button
        disabled={!savedFiltersWritable || activeQuery.length === 0}
        onClick={save}
        type="button"
      >
        Save current query
      </button>
      {issue === undefined ? null : (
        <p className="graph-filter-error" role="alert">
          {issue}
        </p>
      )}
      {savedFilters.length === 0 ? (
        <p>No saved queries for this workspace.</p>
      ) : (
        <ul>
          {savedFilters.map((filter) => (
            <li key={filter.name}>
              <span>
                <strong>{filter.name}</strong>
                <code>{filter.query}</code>
              </span>
              <span>
                <button
                  onClick={() => onApplySavedFilter(filter.query)}
                  type="button"
                >
                  Apply
                </button>
                <button
                  disabled={!savedFiltersWritable}
                  onClick={() => setIssue(onDeleteSavedFilter(filter.name))}
                  type="button"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
