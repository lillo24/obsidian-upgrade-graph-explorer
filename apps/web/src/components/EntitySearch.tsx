import { memo, useDeferredValue, useMemo, useState } from 'react';

import {
  searchEntities,
  type InspectionWorkspace,
} from '@icarus-graph-explorer/explorer-inspection';
import type { EntityId } from '@icarus-graph-explorer/core';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';

interface EntitySearchProps {
  readonly workspace: InspectionWorkspace;
  readonly onNavigate: (entityId: EntityId, origin: string) => void;
  readonly performance?: PerformanceInstrumentation;
}

export const EntitySearch = memo(function EntitySearch({
  onNavigate,
  performance,
  workspace,
}: EntitySearchProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => {
    const search = () =>
      searchEntities(workspace, deferredQuery, { limit: 30 });
    return performance === undefined
      ? search()
      : performance.measure('search', 'searches', search);
  }, [deferredQuery, performance, workspace]);
  const hasQuery = deferredQuery.trim().length > 0;
  const pending = query !== deferredQuery;

  return (
    <section className="entity-search" aria-labelledby="entity-search-title">
      <h3 id="entity-search-title">Search</h3>
      <div className="entity-search__control" role="search">
        <label className="visually-hidden" htmlFor="canonical-entity-search">
          Find documents, headings, paths, or blocks
        </label>
        <input
          autoComplete="off"
          id="canonical-entity-search"
          name="canonical-entity-search"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Example: document, heading, or path…"
          type="search"
          value={query}
        />
      </div>
      <p
        className={hasQuery ? 'entity-search__status' : 'visually-hidden'}
        aria-live="polite"
        aria-atomic="true"
      >
        {pending
          ? 'Updating results…'
          : hasQuery
            ? `${results.length} canonical result${results.length === 1 ? '' : 's'}`
            : 'Search includes entities hidden by disclosure and graph filters.'}
      </p>
      {!hasQuery ? null : results.length === 0 ? (
        <p className="entity-search__empty">
          No canonical entity matches this exact, prefix, or substring query.
        </p>
      ) : (
        <ul className="entity-search__results">
          {results.map(({ entity, match }) => (
            <li key={entity.entityId}>
              <button
                onClick={() => onNavigate(entity.entityId, 'Search Result')}
                type="button"
              >
                <span className={`kind-tag kind-${entity.kind}`}>
                  {entity.kind}
                </span>
                <strong>{entity.displayName}</strong>
                <span title={entity.sourcePath} translate="no">
                  {entity.sourcePath}
                </span>
                <small>{match.replaceAll('-', ' ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
