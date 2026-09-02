import { memo, useCallback, useEffect, useRef, useState } from 'react';

import type { EntityKind } from '@icarus-graph-explorer/core';
import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';
import type {
  ReferenceResolutionStatus,
  SectionHeadingLevel,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import type { GraphPresentationMode } from '@icarus-graph-explorer/view-state';

import {
  ALL_REFERENCE_STATUSES,
  USER_FILTERABLE_ENTITY_KINDS,
  type GraphStateAction,
} from '../graph-state';
import type { SavedGraphFilter } from '../persistence/saved-filters';
import { activeGraphFilterCount } from './graph-filter-count';
import { activateGraphFiltersEscape } from './graph-filters-overlay';

interface GraphFiltersProps {
  readonly contained: boolean;
  readonly open: boolean;
  readonly pathScopes: readonly string[];
  readonly rendererMode?: GraphPresentationMode;
  readonly state: ViewProjectionState;
  readonly savedFilters: readonly SavedGraphFilter[];
  readonly savedFiltersStatus: string;
  readonly savedFiltersWritable: boolean;
  readonly onAction: (action: GraphStateAction) => void;
  readonly onApplySavedFilter: (query: string) => void;
  readonly onDeleteSavedFilter: (name: string) => string | undefined;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaveCurrentQuery: (name: string) => string | undefined;
}

const ENTITY_LABELS: Readonly<Record<Exclude<EntityKind, 'block'>, string>> = {
  document: 'Documents',
  section: 'Sections',
};

const STATUS_LABELS: Readonly<Record<ReferenceResolutionStatus, string>> = {
  resolved: 'Resolved',
  unresolved: 'Unresolved',
  ambiguous: 'Ambiguous',
  invalid: 'Invalid',
};

const HEADING_LIMIT_OPTIONS = [
  1, 2, 3, 4, 5, 6,
] as const satisfies readonly SectionHeadingLevel[];

export const GraphFilters = memo(function GraphFilters({
  contained,
  onAction,
  onApplySavedFilter,
  onDeleteSavedFilter,
  onOpenChange,
  onSaveCurrentQuery,
  open,
  pathScopes,
  rendererMode = 'structure',
  savedFilters,
  savedFiltersStatus,
  savedFiltersWritable,
  state,
}: GraphFiltersProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filters = state.filters;
  const activeQuery = filters?.query ?? '';
  const previousActiveQuery = useRef(activeQuery);
  const [queryDraft, setQueryDraft] = useState(activeQuery);
  const [queryIssue, setQueryIssue] = useState<string>();
  const [savedFilterName, setSavedFilterName] = useState('');
  const [savedFilterIssue, setSavedFilterIssue] = useState<string>();
  const queryDirty = queryDraft !== activeQuery;
  const displayedReferenceStatuses =
    rendererMode === 'global' && filters?.referenceStatuses === undefined
      ? (['resolved'] as const)
      : filters?.referenceStatuses;
  const activeCount = activeGraphFilterCount(state);
  const closeAndRestoreFocus = useCallback(() => {
    onOpenChange(false);
    queueMicrotask(() => triggerRef.current?.focus());
  }, [onOpenChange]);

  useEffect(() => {
    if (!open || triggerRef.current === null || typeof window === 'undefined') {
      return;
    }
    return activateGraphFiltersEscape(
      {
        trigger: triggerRef.current,
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      () => onOpenChange(false),
    );
  }, [onOpenChange, open]);

  useEffect(() => {
    const previous = previousActiveQuery.current;
    previousActiveQuery.current = activeQuery;
    setQueryDraft((current) => (current === previous ? activeQuery : current));
    setQueryIssue(undefined);
  }, [activeQuery]);

  const applyQueryDraft = useCallback(() => {
    if (queryDraft.trim().length === 0) {
      setQueryDraft('');
      setQueryIssue(undefined);
      onAction({ type: 'set-query', query: null });
      return;
    }
    const parsed = parseGraphQuery(queryDraft);
    if (!parsed.valid) {
      const first = parsed.issues[0];
      setQueryIssue(
        first === undefined
          ? 'The graph query is invalid.'
          : `Character ${first.position + 1}: ${first.message}`,
      );
      return;
    }
    setQueryDraft(parsed.canonical);
    setQueryIssue(undefined);
    onAction({ type: 'set-query', query: parsed.canonical });
  }, [onAction, queryDraft]);

  const clearQuery = useCallback(() => {
    setQueryDraft('');
    setQueryIssue(undefined);
    onAction({ type: 'set-query', query: null });
  }, [onAction]);

  const saveCurrentQuery = useCallback(() => {
    const error = onSaveCurrentQuery(savedFilterName);
    setSavedFilterIssue(error);
    if (error === undefined) setSavedFilterName('');
  }, [onSaveCurrentQuery, savedFilterName]);

  return (
    <div className="graph-filters">
      <button
        aria-controls="graph-filters-panel"
        aria-expanded={open}
        aria-label={
          activeCount === 0
            ? 'Filters, no active filter groups'
            : `Filters, ${activeCount} active filter ${activeCount === 1 ? 'group' : 'groups'}`
        }
        className="graph-filters__trigger"
        id="graph-filters-trigger"
        onClick={() => onOpenChange(!open)}
        ref={triggerRef}
        type="button"
      >
        <span>Filters</span>
        {activeCount === 0 ? null : (
          <span aria-hidden="true" className="graph-filters__badge">
            {activeCount}
          </span>
        )}
      </button>
      {open ? (
        <section
          aria-labelledby="graph-filters-heading"
          className={`graph-filters__panel${
            contained ? ' graph-filters__panel--contained' : ''
          }`}
          data-graph-scroll-container
          id="graph-filters-panel"
        >
          <div className="graph-filters__heading">
            <h3 id="graph-filters-heading">Filters</h3>
            <button onClick={closeAndRestoreFocus} type="button">
              Close
            </button>
          </div>
          <div className="graph-filters__body">
            <label className="graph-filter-scope" htmlFor="graph-path-scope">
              Path Scope
              <select
                autoComplete="off"
                id="graph-path-scope"
                name="graph-path-scope"
                onChange={(event) =>
                  onAction({
                    type: 'set-path-scope',
                    pathPrefix:
                      event.currentTarget.value.length === 0
                        ? null
                        : event.currentTarget.value,
                  })
                }
                value={filters?.pathPrefixes?.[0] ?? ''}
              >
                <option value="">All Paths</option>
                {pathScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}/
                  </option>
                ))}
              </select>
            </label>
            {rendererMode === 'global' ? (
              <p className="graph-filter-note">
                All Network always displays files only. Entity and heading
                controls remain saved for Hierarchy.
              </p>
            ) : (
              <>
                <fieldset>
                  <legend>Entity Content</legend>
                  {USER_FILTERABLE_ENTITY_KINDS.map((entityKind) => (
                    <label key={entityKind}>
                      <input
                        checked={
                          filters?.entityKinds?.includes(entityKind) ?? true
                        }
                        name={`graph-entity-${entityKind}`}
                        onChange={(event) =>
                          onAction({
                            type: 'toggle-entity-kind',
                            entityKind,
                            enabled: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      {ENTITY_LABELS[entityKind]}
                    </label>
                  ))}
                  <label>
                    <input
                      checked={state.disclosure.includeBlocks}
                      name="include-blocks"
                      onChange={(event) =>
                        onAction({
                          type: 'set-include-blocks',
                          includeBlocks: event.currentTarget.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Blocks
                  </label>
                </fieldset>
                <label
                  className="heading-limit-control"
                  htmlFor="heading-depth"
                >
                  Heading limit
                  <select
                    aria-describedby="heading-depth-description"
                    autoComplete="off"
                    id="heading-depth"
                    name="heading-depth"
                    onChange={(event) =>
                      onAction({
                        type: 'set-heading-limit',
                        maxSectionLevel:
                          event.currentTarget.value === ''
                            ? null
                            : (Number(
                                event.currentTarget.value,
                              ) as SectionHeadingLevel),
                      })
                    }
                    value={state.disclosure.maxSectionLevel ?? ''}
                  >
                    <option value="">No limit</option>
                    {HEADING_LIMIT_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {'#'.repeat(level)}
                      </option>
                    ))}
                  </select>
                  <span
                    className="visually-hidden"
                    id="heading-depth-description"
                  >
                    Limits sections by literal Markdown heading level. Hierarchy
                    depth separately controls how many section-tree levels are
                    automatically visible.
                  </span>
                </label>
              </>
            )}
            <fieldset>
              <legend>Reference Status</legend>
              {ALL_REFERENCE_STATUSES.map((status) => (
                <label key={status}>
                  <input
                    checked={
                      displayedReferenceStatuses?.includes(status) ?? true
                    }
                    name={`graph-status-${status}`}
                    onChange={(event) =>
                      onAction({
                        type: 'toggle-reference-status',
                        status,
                        enabled: event.currentTarget.checked,
                      })
                    }
                    type="checkbox"
                  />
                  {STATUS_LABELS[status]}
                </label>
              ))}
            </fieldset>
            <section
              aria-labelledby="advanced-query-heading"
              className="advanced-graph-query"
            >
              <div className="advanced-graph-query__heading">
                <h4 id="advanced-query-heading">Advanced query</h4>
                {queryDirty ? <span>Draft not applied</span> : null}
              </div>
              <label htmlFor="advanced-graph-query">
                Query
                <textarea
                  aria-describedby={
                    queryIssue === undefined
                      ? 'advanced-graph-query-help'
                      : 'advanced-graph-query-help advanced-graph-query-error'
                  }
                  aria-invalid={queryIssue === undefined ? undefined : true}
                  id="advanced-graph-query"
                  onChange={(event) => {
                    setQueryDraft(event.currentTarget.value);
                    setQueryIssue(undefined);
                  }}
                  placeholder={'path:"notes" AND (sections OR level<=3)'}
                  rows={3}
                  spellCheck={false}
                  value={queryDraft}
                />
              </label>
              <p id="advanced-graph-query-help">
                Use path, title, text, kind, or level with explicit AND, OR,
                NOT, and parentheses. Text searches paths and section titles,
                not Markdown body content.
              </p>
              {queryIssue === undefined ? null : (
                <p
                  className="graph-filter-error"
                  id="advanced-graph-query-error"
                >
                  {queryIssue}
                </p>
              )}
              <div className="advanced-graph-query__actions">
                <button onClick={applyQueryDraft} type="button">
                  Apply query
                </button>
                <button
                  disabled={activeQuery.length === 0 && queryDraft.length === 0}
                  onClick={clearQuery}
                  type="button"
                >
                  Clear query
                </button>
              </div>
              <section
                aria-labelledby="saved-filters-heading"
                className="saved-graph-filters"
              >
                <h4 id="saved-filters-heading">Saved Filters</h4>
                <p>{savedFiltersStatus}</p>
                <label htmlFor="saved-filter-name">
                  Name
                  <input
                    autoComplete="off"
                    id="saved-filter-name"
                    maxLength={64}
                    onChange={(event) => {
                      setSavedFilterName(event.currentTarget.value);
                      setSavedFilterIssue(undefined);
                    }}
                    value={savedFilterName}
                  />
                </label>
                <button
                  disabled={!savedFiltersWritable || activeQuery.length === 0}
                  onClick={saveCurrentQuery}
                  type="button"
                >
                  Save current query
                </button>
                {savedFilterIssue === undefined ? null : (
                  <p className="graph-filter-error" role="alert">
                    {savedFilterIssue}
                  </p>
                )}
                {savedFilters.length === 0 ? (
                  <p>No saved filters for this workspace.</p>
                ) : (
                  <ul>
                    {savedFilters.map((savedFilter) => (
                      <li key={savedFilter.name}>
                        <span>
                          <strong>{savedFilter.name}</strong>
                          <code>{savedFilter.query}</code>
                        </span>
                        <span>
                          <button
                            onClick={() => {
                              setQueryDraft(savedFilter.query);
                              setQueryIssue(undefined);
                              onApplySavedFilter(savedFilter.query);
                            }}
                            type="button"
                          >
                            Apply
                          </button>
                          <button
                            disabled={!savedFiltersWritable}
                            onClick={() => {
                              setSavedFilterIssue(
                                onDeleteSavedFilter(savedFilter.name),
                              );
                            }}
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
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
});
