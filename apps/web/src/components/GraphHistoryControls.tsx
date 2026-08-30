import { memo } from 'react';

export const GraphHistoryControls = memo(function GraphHistoryControls({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly onBack: () => void;
  readonly onForward: () => void;
}) {
  return (
    <div
      aria-label="Graph navigation history"
      className="graph-history-controls"
      role="group"
    >
      <button
        aria-label="Back in graph history"
        disabled={!canGoBack}
        onClick={onBack}
        title="Back in graph history (Alt+Left)"
        type="button"
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        aria-label="Forward in graph history"
        disabled={!canGoForward}
        onClick={onForward}
        title="Forward in graph history (Alt+Right)"
        type="button"
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
});
