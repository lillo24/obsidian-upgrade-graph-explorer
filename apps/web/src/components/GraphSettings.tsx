import { memo } from 'react';

import type { TrackpadZoomMode } from '@icarus-graph-explorer/renderer-reactflow';

interface GraphSettingsProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onTrackpadZoomModeChange: (mode: TrackpadZoomMode) => void;
  readonly trackpadZoomMode: TrackpadZoomMode;
  readonly warning?: string;
}

function SettingsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="graph-shell-icon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
      <path d="m19 13.4 1.6 1.2-1.8 3.1-2-.8c-.5.4-1 .7-1.6.9l-.3 2.2h-3.7l-.3-2.2a7 7 0 0 1-1.6-.9l-2 .8-1.8-3.1L7 13.4a7 7 0 0 1 0-1.8l-1.6-1.2 1.8-3.1 2 .8c.5-.4 1-.7 1.6-.9l.3-2.2h3.7l.3 2.2c.6.2 1.1.5 1.6.9l2-.8 1.8 3.1-1.6 1.2a7 7 0 0 1 0 1.8Z" />
    </svg>
  );
}

export const GraphSettings = memo(function GraphSettings({
  onOpenChange,
  onTrackpadZoomModeChange,
  open,
  trackpadZoomMode,
  warning,
}: GraphSettingsProps) {
  return (
    <div className="graph-settings">
      <button
        aria-controls="graph-settings-popover"
        aria-expanded={open}
        aria-label={open ? 'Close Settings' : 'Open Settings'}
        className="graph-settings__trigger"
        onClick={() => onOpenChange(!open)}
        title="Graph settings"
        type="button"
      >
        <SettingsIcon />
      </button>
      {open ? (
        <section
          aria-labelledby="graph-settings-heading"
          className="graph-settings__popover"
          id="graph-settings-popover"
        >
          <div className="graph-settings__heading">
            <h2 id="graph-settings-heading">Settings</h2>
            <button onClick={() => onOpenChange(false)} type="button">
              Close
            </button>
          </div>
          <fieldset>
            <legend>Trackpad zoom</legend>
            <label>
              <input
                checked={trackpadZoomMode === 'scroll-zoom'}
                name="trackpad-zoom-mode"
                onChange={() => onTrackpadZoomModeChange('scroll-zoom')}
                type="radio"
                value="scroll-zoom"
              />
              <span>
                <strong>Scroll to zoom</strong>
                <small>Two-finger scrolling zooms toward the pointer.</small>
              </span>
            </label>
            <label>
              <input
                checked={trackpadZoomMode === 'pinch-zoom'}
                name="trackpad-zoom-mode"
                onChange={() => onTrackpadZoomModeChange('pinch-zoom')}
                type="radio"
                value="pinch-zoom"
              />
              <span>
                <strong>Pinch to zoom</strong>
                <small>Two-finger scrolling pans; pinching zooms.</small>
              </span>
            </label>
          </fieldset>
          {warning === undefined ? null : (
            <p className="graph-settings__warning" role="alert">
              {warning}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
});
