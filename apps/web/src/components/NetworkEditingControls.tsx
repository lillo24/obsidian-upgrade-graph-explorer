import type { ExplorationScope } from '../exploration-model';
import type {
  NetworkEditingState,
  NetworkEditingTool,
} from '../network-editing';

export function NetworkEditingControls({
  arrangeDisabledReason,
  failure,
  onDone,
  onEnter,
  onRetry,
  onToolChange,
  scope,
  state,
  status,
}: {
  readonly arrangeDisabledReason?: string;
  readonly failure?: string;
  readonly onDone: () => void;
  readonly onEnter: () => void;
  readonly onRetry: () => void;
  readonly onToolChange: (tool: NetworkEditingTool) => void;
  readonly scope: ExplorationScope;
  readonly state: NetworkEditingState;
  readonly status?: string;
}) {
  if (state.phase === 'off') {
    return (
      <div className="control-group network-editing-controls">
        <button
          aria-label="Edit Network layout"
          className="network-editing-controls__pencil"
          onClick={onEnter}
          title="Edit Network layout"
          type="button"
        >
          <span aria-hidden="true">✎</span>
        </button>
      </div>
    );
  }

  return (
    <div
      aria-label="Edit Network layout"
      className="control-group network-editing-controls network-editing-controls--active"
      role="group"
    >
      <button
        aria-pressed={state.tool === 'move-file'}
        onClick={() => onToolChange('move-file')}
        type="button"
      >
        Move Files
      </button>
      {scope === 'all' ? (
        <button
          aria-pressed={state.tool === 'arrange-folder'}
          disabled={arrangeDisabledReason !== undefined}
          onClick={() => onToolChange('arrange-folder')}
          title={arrangeDisabledReason}
          type="button"
        >
          Arrange Folders
        </button>
      ) : null}
      <button onClick={onDone} type="button">
        Done
      </button>
      <small className="network-editing-controls__meaning">
        {state.tool === 'move-file'
          ? 'Temporary movement — positions are not saved.'
          : 'Edits saved Pull and Place folder rules.'}
      </small>
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
