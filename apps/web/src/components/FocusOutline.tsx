import { memo, useEffect, useRef, type CSSProperties } from 'react';

import type { EntityId } from '@icarus-graph-explorer/core';

import type {
  FocusOutlineModel,
  FocusOutlineRowStatus,
} from '../focus-outline-model';

interface FocusOutlineProps {
  readonly model: FocusOutlineModel;
  readonly onClose: () => void;
  readonly onSetHeadingHidden: (entityId: EntityId, hidden: boolean) => void;
  readonly onShowAll: () => void;
}

function statusLabel(status: FocusOutlineRowStatus): string {
  switch (status) {
    case 'visible':
      return 'Visible';
    case 'hidden':
      return 'Hidden';
    case 'hidden-by-ancestor':
      return 'Hidden by parent';
    case 'not-disclosed':
      return 'Not disclosed';
  }
}

export const FocusOutline = memo(function FocusOutline({
  model,
  onClose,
  onSetHeadingHidden,
  onShowAll,
}: FocusOutlineProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButtonRef.current?.focus(), []);

  return (
    <aside
      aria-label="Focus Outline"
      className="focus-outline"
      data-graph-history-shortcuts="off"
    >
      <header className="focus-outline__heading">
        <div>
          <h3>Focus Outline</h3>
          <p title={model.sourcePath}>{model.sourcePath}</p>
        </div>
        <button
          aria-label="Close Focus Outline"
          className="focus-outline__close"
          onClick={onClose}
          ref={closeButtonRef}
          title="Close Focus Outline"
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="focus-outline__toolbar">
        <button
          disabled={model.hiddenEntityIds.length === 0}
          onClick={onShowAll}
          type="button"
        >
          Show all
        </button>
        <span>
          {model.hiddenEntityIds.length === 0
            ? 'No hidden Headings'
            : `${model.hiddenEntityIds.length} hidden`}
        </span>
      </div>
      {model.rows.length === 0 ? (
        <p className="focus-outline__empty">This File has no Headings.</p>
      ) : (
        <div aria-label="Headings" className="focus-outline__tree" role="tree">
          {model.rows.map((row) => {
            const hiddenByAncestor = row.status === 'hidden-by-ancestor';
            const hidden = row.status === 'hidden';
            const label = hidden
              ? `Show Heading ${row.title}`
              : hiddenByAncestor
                ? `Heading ${row.title} is hidden by parent`
                : `Hide Heading ${row.title}`;
            return (
              <div
                aria-level={row.depth}
                className={`focus-outline__row focus-outline__row--${row.status}`}
                key={row.entityId}
                role="treeitem"
                style={{ '--focus-outline-depth': row.depth } as CSSProperties}
              >
                <span className="focus-outline__row-copy">
                  <strong title={row.title}>{row.title}</strong>
                  <small>
                    H{row.headingLevel} · {statusLabel(row.status)}
                    {hiddenByAncestor && row.explicitlyHidden
                      ? ' · also explicitly hidden'
                      : ''}
                  </small>
                </span>
                <button
                  aria-label={label}
                  aria-pressed={hidden || hiddenByAncestor}
                  disabled={hiddenByAncestor}
                  onClick={() =>
                    onSetHeadingHidden(row.entityId, !row.explicitlyHidden)
                  }
                  title={
                    hiddenByAncestor
                      ? 'Restore the hidden parent first.'
                      : hidden
                        ? 'Show this Heading according to current disclosure settings.'
                        : 'Hide this Heading and its descendants from the graph.'
                  }
                  type="button"
                >
                  <span aria-hidden="true">
                    {hidden || hiddenByAncestor ? '○' : '●'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
});
