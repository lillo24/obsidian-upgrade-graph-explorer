import { memo, useState, type SyntheticEvent } from 'react';

import type { DiagnosticLookups } from '@icarus-graph-explorer/diagnostics-obsidian';
import type { AddressableEntity } from '@icarus-graph-explorer/core';

interface EntityBranchProps {
  readonly entity: AddressableEntity;
  readonly lookups: DiagnosticLookups;
}

const EntityBranch = memo(function EntityBranch({
  entity,
  lookups,
}: EntityBranchProps) {
  const [expanded, setExpanded] = useState(false);
  const children = lookups.childrenByParentId.get(entity.id) ?? [];
  const label = lookups.labelByEntityId.get(entity.id) ?? entity.id;
  if (children.length === 0) {
    return (
      <li className="tree-leaf">
        <span className={`kind-tag kind-${entity.kind}`}>{entity.kind}</span>
        <span className="breakable">{label}</span>
      </li>
    );
  }
  function onToggle(event: SyntheticEvent<HTMLDetailsElement>): void {
    setExpanded(event.currentTarget.open);
  }
  return (
    <li className="tree-branch">
      <details onToggle={onToggle}>
        <summary>
          <span className={`kind-tag kind-${entity.kind}`}>{entity.kind}</span>
          <span className="breakable">{label}</span>
          <span className="child-count">{children.length}</span>
        </summary>
        {expanded ? (
          <ul>
            {children.map((child) => (
              <EntityBranch entity={child} key={child.id} lookups={lookups} />
            ))}
          </ul>
        ) : null}
      </details>
    </li>
  );
});

export const HierarchyPanel = memo(function HierarchyPanel({
  documentIds,
  lookups,
}: {
  readonly documentIds: readonly string[];
  readonly lookups: DiagnosticLookups;
}) {
  return (
    <section
      className="panel hierarchy-panel"
      aria-labelledby="hierarchy-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Source Structure</p>
          <h2 id="hierarchy-title">Canonical Hierarchy</h2>
        </div>
        <span className="panel-count">{documentIds.length} documents</span>
      </div>
      {documentIds.length === 0 ? (
        <p className="empty-state">No hierarchy labels match this search.</p>
      ) : (
        <ul className="tree-root">
          {documentIds.map((id) => {
            const entity = lookups.entityById.get(id);
            return entity === undefined ? null : (
              <EntityBranch entity={entity} key={id} lookups={lookups} />
            );
          })}
        </ul>
      )}
    </section>
  );
});
