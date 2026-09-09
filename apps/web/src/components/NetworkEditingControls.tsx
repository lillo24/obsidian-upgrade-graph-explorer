import type { ExplorationScope } from '../exploration-model';
import type { NetworkEditingState } from '../network-editing';

export function NetworkEditingControls({
  arrangeDisabledReason,
  failure,
  onDone,
  onArrange,
  onRetry,
  scope,
  state,
  status,
}: {
  readonly arrangeDisabledReason?: string;
  readonly failure?: string;
  readonly onDone: () => void;
  readonly onArrange: () => void;
  readonly onRetry: () => void;
  readonly scope: ExplorationScope;
  readonly state: NetworkEditingState;
  readonly status?: string;
}) {
  if (scope !== 'all' && status === undefined && failure === undefined)
    return null;

  return (
    <div
      aria-label="Network movement"
      className={`control-group network-editing-controls${state.phase === 'editing' ? ' network-editing-controls--active' : ''}`}
      role="group"
    >
      {scope === 'all' ? (
        <button
          aria-pressed={state.phase === 'editing'}
          disabled={arrangeDisabledReason !== undefined}
          onClick={() => onArrange()}
          title={arrangeDisabledReason}
          type="button"
        >
          Arrange Folders
        </button>
      ) : null}
      {state.phase === 'editing' ? (
        <>
          <button onClick={onDone} type="button">
            Done
          </button>
          <small className="network-editing-controls__meaning">
            Edits saved Pull and Place folder rules.
          </small>
        </>
      ) : null}
      {status === undefined ? null : (
        <small
          aria-atomic="true"
          aria-live="polite"
          className="network-editing-controls__status"
          role="status"
        >
          {status}
        </small>
      )}
      {failure === undefined ? null : (
        <span className="network-editing-controls__failure" role="alert">
          <small>{failure}</small>
          <button onClick={onRetry} type="button">
            Retry Move
          </button>
        </span>
      )}
    </div>
  );
}
