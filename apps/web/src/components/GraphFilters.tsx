import { memo, useCallback, useEffect, useRef, useState } from 'react';

import type { EntityKind } from '@icarus-graph-explorer/core';
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
import {
  GraphQueryEditor,
  type GraphQueryEditorState,
} from './GraphQueryEditor';
import { activeGraphFilterCount } from './graph-filter-count';
import { activateGraphFiltersOverlay } from './graph-filters-overlay';

interface GraphFiltersProps {
  readonly queryEditor: GraphQueryEditorState;
  readonly queryInNetworkExplorer: boolean;
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
  queryEditor,
  queryInNetworkExplorer,
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
  const panelRef = useRef<HTMLElement>(null);
  const filters = state.filters;
  const activeQuery = filters?.query ?? '';
  const [savedFilterName, setSavedFilterName] = useState('');
  const [savedFilterIssue, setSavedFilterIssue] = useState<string>();
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
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (
      !open ||
      panel === null ||
      trigger === null ||
      typeof window === 'undefined'
    ) {
      return;
    }
    return activateGraphFiltersOverlay(
      {
        trigger,
        panelContains: (target) =>
          target instanceof Node && panel.contains(target),
        triggerContains: (target) =>
          target instanceof Node && trigger.contains(target),
        addKeydownListener: (listener) =>
          window.addEventListener('keydown', listener, true),
        removeKeydownListener: (listener) =>
          window.removeEventListener('keydown', listener, true),
        addPointerdownListener: (listener) =>
          window.addEventListener('pointerdown', listener, true),
        removePointerdownListener: (listener) =>
          window.removeEventListener('pointerdown', listener, true),
        queueFocus: (callback) => queueMicrotask(callback),
      },
      () => onOpenChange(false),
    );
  }, [onOpenChange, open]);

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
          ref={panelRef}
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
                All Network displays files only. Entity and heading controls
                remain saved for Hierarchy; Advanced query still applies to
                files.
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
            {queryInNetworkExplorer ? (
              <p className="graph-filter-note">
                Advanced query is edited in Network Explorer.
              </p>
            ) : (
              <GraphQueryEditor {...queryEditor} idPrefix="filters-query" />
            )}
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
          </div>
        </section>
      ) : null}
    </div>
  );
});
