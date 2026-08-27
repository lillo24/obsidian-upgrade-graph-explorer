import { memo } from 'react';

import type { EntityKind } from '@icarus-graph-explorer/core';
import type {
  ReferenceResolutionStatus,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  ALL_ENTITY_KINDS,
  ALL_REFERENCE_STATUSES,
  type GraphStateAction,
} from '../graph-state';

interface GraphFiltersProps {
  readonly pathScopes: readonly string[];
  readonly state: ViewProjectionState;
  readonly onAction: (action: GraphStateAction) => void;
}

const ENTITY_LABELS: Readonly<Record<EntityKind, string>> = {
  document: 'Documents',
  section: 'Sections',
  block: 'Blocks',
};

const STATUS_LABELS: Readonly<Record<ReferenceResolutionStatus, string>> = {
  resolved: 'Resolved',
  unresolved: 'Unresolved',
  ambiguous: 'Ambiguous',
  invalid: 'Invalid',
};

export const GraphFilters = memo(function GraphFilters({
  onAction,
  pathScopes,
  state,
}: GraphFiltersProps) {
  const filters = state.filters;
  const activeCount =
    (filters?.pathPrefixes === undefined ? 0 : 1) +
    (filters?.entityKinds === undefined ? 0 : 1) +
    (filters?.referenceStatuses === undefined ? 0 : 1);

  return (
    <details className="graph-filters">
      <summary>
        Graph Filters
        <span>{activeCount === 0 ? 'All' : `${activeCount} active`}</span>
      </summary>
      <div className="graph-filters__body">
        <label className="graph-filter-scope" htmlFor="graph-path-scope">
          Path Scope
          <select
            aria-label="Path Scope"
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
          {ALL_ENTITY_KINDS.map((entityKind) => (
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
        </fieldset>
        <fieldset>
          <legend>Reference Status</legend>
          {ALL_REFERENCE_STATUSES.map((status) => (
            <label key={status}>
              <input
                checked={filters?.referenceStatuses?.includes(status) ?? true}
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
        <p>
          Entity filters select content matches. Structural ancestors may remain
          as context. Search remains global.
        </p>
      </div>
    </details>
  );
});
