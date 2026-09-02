import { useId } from 'react';

import type { ExplorationLayout, ExplorationScope } from '../exploration-model';

export function ExplorationControls({
  focusDisabledReason,
  focusedRootLabel,
  layout,
  networkDisabledReason,
  onLayoutChange,
  onScopeChange,
  scope,
}: {
  readonly focusDisabledReason?: string;
  readonly focusedRootLabel?: string;
  readonly layout: ExplorationLayout;
  readonly networkDisabledReason?: string;
  readonly onLayoutChange: (layout: ExplorationLayout) => void;
  readonly onScopeChange: (scope: ExplorationScope) => void;
  readonly scope: ExplorationScope;
}) {
  const focusExplanationId = useId();
  const networkExplanationId = useId();
  const focusDisabled = scope === 'all' && focusDisabledReason !== undefined;
  const networkDisabled =
    scope === 'all' && networkDisabledReason !== undefined;
  return (
    <>
      <div aria-label="Scope" className="control-group" role="group">
        <span>Scope</span>
        <button
          aria-pressed={scope === 'all'}
          onClick={() => onScopeChange('all')}
          type="button"
        >
          All
        </button>
        <button
          {...(focusDisabled
            ? {
                'aria-describedby': focusExplanationId,
                title: focusDisabledReason,
              }
            : {})}
          aria-pressed={scope === 'focus'}
          disabled={focusDisabled}
          onClick={() => onScopeChange('focus')}
          type="button"
        >
          Focus
        </button>
        {scope === 'focus' && focusedRootLabel !== undefined ? (
          <span className="focus-root-label">Focused: {focusedRootLabel}</span>
        ) : null}
      </div>
      {focusDisabledReason === undefined ? null : (
        <span className="visually-hidden" id={focusExplanationId}>
          {focusDisabledReason}
        </span>
      )}
      <div aria-label="Layout" className="control-group" role="group">
        <span>Layout</span>
        <button
          {...(networkDisabled
            ? {
                'aria-describedby': networkExplanationId,
                title: networkDisabledReason,
              }
            : {})}
          aria-pressed={layout === 'network'}
          disabled={networkDisabled}
          onClick={() => onLayoutChange('network')}
          type="button"
        >
          Network
        </button>
        <button
          aria-pressed={layout === 'hierarchy'}
          onClick={() => onLayoutChange('hierarchy')}
          type="button"
        >
          Hierarchy
        </button>
      </div>
      {networkDisabledReason === undefined ? null : (
        <span className="visually-hidden" id={networkExplanationId}>
          {networkDisabledReason}
        </span>
      )}
    </>
  );
}
