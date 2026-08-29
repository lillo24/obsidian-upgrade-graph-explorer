import { memo, useCallback, useEffect, useRef } from 'react';

import type { EntityKind } from '@icarus-graph-explorer/core';
import type {
  ReferenceResolutionStatus,
  SectionHeadingLevel,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  ALL_REFERENCE_STATUSES,
  USER_FILTERABLE_ENTITY_KINDS,
  type GraphStateAction,
} from '../graph-state';
import { activateGraphFiltersEscape } from './graph-filters-overlay';

interface GraphFiltersProps {
  readonly contained: boolean;
  readonly open: boolean;
  readonly pathScopes: readonly string[];
  readonly state: ViewProjectionState;
  readonly onAction: (action: GraphStateAction) => void;
  readonly onOpenChange: (open: boolean) => void;
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

export function activeGraphFilterCount(state: ViewProjectionState): number {
  const filters = state.filters;
  const visibleEntityKinds = filters?.entityKinds?.filter(
    (kind): kind is Exclude<EntityKind, 'block'> => kind !== 'block',
  );
  const entityContentActive =
    state.disclosure.includeBlocks ||
    (visibleEntityKinds !== undefined && visibleEntityKinds.length < 2);
  return (
    (filters?.pathPrefixes === undefined ? 0 : 1) +
    (entityContentActive ? 1 : 0) +
    (state.disclosure.maxSectionLevel === undefined ? 0 : 1) +
    (filters?.referenceStatuses === undefined ? 0 : 1)
  );
}

export const GraphFilters = memo(function GraphFilters({
  contained,
  onAction,
  onOpenChange,
  open,
  pathScopes,
  state,
}: GraphFiltersProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const filters = state.filters;
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
            <fieldset>
              <legend>Entity Content</legend>
              {USER_FILTERABLE_ENTITY_KINDS.map((entityKind) => (
                <label key={entityKind}>
                  <input
                    checked={filters?.entityKinds?.includes(entityKind) ?? true}
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
            <label className="heading-limit-control" htmlFor="heading-depth">
              Heading Depth
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
              <span className="visually-hidden" id="heading-depth-description">
                Limits sections by Markdown heading level. Top-Level instead
                means direct structural sections.
              </span>
            </label>
            <fieldset>
              <legend>Reference Status</legend>
              {ALL_REFERENCE_STATUSES.map((status) => (
                <label key={status}>
                  <input
                    checked={
                      filters?.referenceStatuses?.includes(status) ?? true
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
          </div>
        </section>
      ) : null}
    </div>
  );
});
