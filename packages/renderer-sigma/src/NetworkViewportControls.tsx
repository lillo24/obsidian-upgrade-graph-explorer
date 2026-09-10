import { useCallback } from 'react';

interface NetworkViewportControlsProps {
  readonly label: string;
  readonly maximized: boolean | undefined;
  readonly onFit: () => void;
  readonly onMaximizedChange: ((maximized: boolean) => void) | undefined;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}

function ZoomInIcon() {
  return (
    <svg
      aria-hidden="true"
      className="network-viewport-control__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="network-viewport-control__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function FitGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="network-viewport-control__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="8.5" cy="12.5" r="1.7" />
      <circle cx="15.5" cy="9.5" r="1.7" />
      <path d="m10 12 4-2" />
    </svg>
  );
}

function MaximizeGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="network-viewport-control__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
    </svg>
  );
}

function RestoreGraphIcon() {
  return (
    <svg
      aria-hidden="true"
      className="network-viewport-control__icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4" />
    </svg>
  );
}

/** Renderer-local chrome avoids coupling Sigma to the React Flow package. */
export function NetworkViewportControls({
  label,
  maximized,
  onFit,
  onMaximizedChange,
  onZoomIn,
  onZoomOut,
}: NetworkViewportControlsProps) {
  const maximizeLabel = maximized === true ? 'Restore graph' : 'Maximize graph';
  const toggleMaximized = useCallback(
    () => onMaximizedChange?.(maximized !== true),
    [maximized, onMaximizedChange],
  );
  return (
    <div aria-label={label} className="network-viewport-controls" role="group">
      <button
        aria-label="Zoom in"
        onClick={onZoomIn}
        title="Zoom in"
        type="button"
      >
        <ZoomInIcon />
      </button>
      <button
        aria-label="Zoom out"
        onClick={onZoomOut}
        title="Zoom out"
        type="button"
      >
        <ZoomOutIcon />
      </button>
      <button
        aria-label="Fit graph to view"
        onClick={onFit}
        title="Fit graph to view"
        type="button"
      >
        <FitGraphIcon />
      </button>
      {onMaximizedChange === undefined ? null : (
        <button
          aria-label={maximizeLabel}
          aria-pressed={maximized === true}
          onClick={toggleMaximized}
          title={maximizeLabel}
          type="button"
        >
          {maximized === true ? <RestoreGraphIcon /> : <MaximizeGraphIcon />}
        </button>
      )}
    </div>
  );
}
