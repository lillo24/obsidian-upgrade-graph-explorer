import { memo, useRef, useState, type ReactNode } from 'react';

import type {
  FocusAppearance,
  TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  customGlobalLayoutSettings,
  GLOBAL_LAYOUT_CUSTOM_RANGES,
  type GlobalLayoutCustomSettings,
  type GlobalLayoutSettings,
  type GlobalSpacingPreset,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import {
  graphSettingsTabForKey,
  type GraphSettingsTab,
} from './graph-settings-tabs';

interface GraphSettingsProps {
  readonly children?: ReactNode;
  readonly focusAppearance: FocusAppearance;
  readonly globalLayoutSettings: GlobalLayoutSettings;
  readonly open: boolean;
  readonly onFocusAppearanceChange: (appearance: FocusAppearance) => void;
  readonly onGlobalLayoutSettingsChange: (
    settings: GlobalLayoutSettings,
  ) => void;
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
  children,
  focusAppearance,
  globalLayoutSettings,
  onFocusAppearanceChange,
  onGlobalLayoutSettingsChange,
  onOpenChange,
  onTrackpadZoomModeChange,
  open,
  trackpadZoomMode,
  warning,
}: GraphSettingsProps) {
  const [activeTab, setActiveTab] = useState<GraphSettingsTab>('graph');
  const graphTabRef = useRef<HTMLButtonElement>(null);
  const sourceTabRef = useRef<HTMLButtonElement>(null);
  const changePreset = (spacingPreset: GlobalSpacingPreset) => {
    onGlobalLayoutSettingsChange({
      ...globalLayoutSettings,
      spacingPreset,
      ...(globalLayoutSettings.custom === undefined
        ? {}
        : { custom: customGlobalLayoutSettings(spacingPreset) }),
    });
  };
  const changeCustom = (
    key: keyof GlobalLayoutCustomSettings,
    value: number,
  ) => {
    const custom =
      globalLayoutSettings.custom ??
      customGlobalLayoutSettings(globalLayoutSettings.spacingPreset);
    onGlobalLayoutSettingsChange({
      ...globalLayoutSettings,
      custom: { ...custom, [key]: value },
    });
  };
  const handleTabKey = (key: string) => {
    const nextTab = graphSettingsTabForKey(activeTab, key);
    if (nextTab === undefined) return false;
    setActiveTab(nextTab);
    (nextTab === 'graph' ? graphTabRef : sourceTabRef).current?.focus();
    return true;
  };
  return (
    <div className="graph-settings">
      <button
        aria-controls="graph-settings-popover"
        aria-expanded={open}
        aria-label={open ? 'Close Settings' : 'Open Settings'}
        className="graph-settings__trigger"
        onClick={() => onOpenChange(!open)}
        title="Settings"
        type="button"
      >
        <SettingsIcon />
      </button>
      {open ? (
        <section
          aria-labelledby="graph-settings-heading"
          className="graph-settings__popover"
          data-graph-history-shortcuts="off"
          id="graph-settings-popover"
        >
          <div className="graph-settings__heading">
            <h2 id="graph-settings-heading">Settings</h2>
            <button onClick={() => onOpenChange(false)} type="button">
              Close
            </button>
          </div>
          <div
            aria-label="Settings sections"
            className="graph-settings__tabs"
            role="tablist"
          >
            <button
              aria-controls="graph-settings-graph-panel"
              aria-selected={activeTab === 'graph'}
              id="graph-settings-graph-tab"
              onClick={() => setActiveTab('graph')}
              onKeyDown={(event) => {
                if (!handleTabKey(event.key)) return;
                event.preventDefault();
              }}
              ref={graphTabRef}
              role="tab"
              tabIndex={activeTab === 'graph' ? 0 : -1}
              type="button"
            >
              Graph
            </button>
            <button
              aria-controls="graph-settings-source-panel"
              aria-selected={activeTab === 'source'}
              id="graph-settings-source-tab"
              onClick={() => setActiveTab('source')}
              onKeyDown={(event) => {
                if (!handleTabKey(event.key)) return;
                event.preventDefault();
              }}
              ref={sourceTabRef}
              role="tab"
              tabIndex={activeTab === 'source' ? 0 : -1}
              type="button"
            >
              Source &amp; Diagnostics
            </button>
          </div>
          <div className="graph-settings__sections" data-graph-scroll-container>
            <div
              aria-labelledby="graph-settings-graph-tab"
              hidden={activeTab !== 'graph'}
              id="graph-settings-graph-panel"
              role="tabpanel"
            >
              <section
                aria-labelledby="graph-appearance-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="graph-appearance-settings-heading">Graph Appearance</h3>
                <fieldset>
                  <legend>Focus Root</legend>
                  <label>
                    <input
                      checked={focusAppearance === 'outline'}
                      name="focus-appearance"
                      onChange={() => onFocusAppearanceChange('outline')}
                      type="radio"
                      value="outline"
                    />
                    <span>
                      <strong>Outline</strong>
                      <small>
                        A strong geometric boundary around the root.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      checked={focusAppearance === 'inverted'}
                      name="focus-appearance"
                      onChange={() => onFocusAppearanceChange('inverted')}
                      type="radio"
                      value="inverted"
                    />
                    <span>
                      <strong>Inverted</strong>
                      <small>
                        A dark root card with high-contrast content.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      checked={focusAppearance === 'minimal'}
                      name="focus-appearance"
                      onChange={() => onFocusAppearanceChange('minimal')}
                      type="radio"
                      value="minimal"
                    />
                    <span>
                      <strong>Minimal</strong>
                      <small>A quiet corner marker and title accent.</small>
                    </span>
                  </label>
                </fieldset>
              </section>
              <section
                aria-labelledby="global-layout-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="global-layout-settings-heading">Global Layout</h3>
                <label className="graph-settings__check">
                  <input
                    checked={globalLayoutSettings.folderClustering}
                    name="global-folder-clustering"
                    onChange={(event) =>
                      onGlobalLayoutSettingsChange({
                        ...globalLayoutSettings,
                        folderClustering: event.currentTarget.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>Folder clustering</strong>
                    <small>
                      Adds a soft spatial preference without creating graph
                      links.
                    </small>
                  </span>
                </label>
                <fieldset>
                  <legend>Spacing</legend>
                  {(['compact', 'normal', 'spacious'] as const).map(
                    (preset) => (
                      <label key={preset}>
                        <input
                          checked={
                            globalLayoutSettings.spacingPreset === preset
                          }
                          name="global-spacing-preset"
                          onChange={() => changePreset(preset)}
                          type="radio"
                          value={preset}
                        />
                        <span>
                          {preset.slice(0, 1).toUpperCase() + preset.slice(1)}
                        </span>
                      </label>
                    ),
                  )}
                </fieldset>
                <label className="graph-settings__check">
                  <input
                    checked={globalLayoutSettings.custom !== undefined}
                    name="global-custom-layout"
                    onChange={(event) =>
                      onGlobalLayoutSettingsChange({
                        folderClustering: globalLayoutSettings.folderClustering,
                        spacingPreset: globalLayoutSettings.spacingPreset,
                        ...(event.currentTarget.checked
                          ? {
                              custom: customGlobalLayoutSettings(
                                globalLayoutSettings.spacingPreset,
                              ),
                            }
                          : {}),
                      })
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>Custom controls</strong>
                    <small>Expose a bounded product-level subset.</small>
                  </span>
                </label>
                {globalLayoutSettings.custom === undefined ? null : (
                  <GlobalCustomLayoutControls
                    onChange={changeCustom}
                    settings={globalLayoutSettings.custom}
                  />
                )}
              </section>
              <section
                aria-labelledby="graph-interaction-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="graph-interaction-settings-heading">
                  Graph Interaction
                </h3>
                <fieldset>
                  <legend>Trackpad Zoom</legend>
                  <label>
                    <input
                      checked={trackpadZoomMode === 'scroll-zoom'}
                      name="trackpad-zoom-mode"
                      onChange={() => onTrackpadZoomModeChange('scroll-zoom')}
                      type="radio"
                      value="scroll-zoom"
                    />
                    <span>
                      <strong>Scroll to Zoom</strong>
                      <small>
                        Two-finger scrolling zooms toward the pointer.
                      </small>
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
                      <strong>Pinch to Zoom</strong>
                      <small>Two-finger scrolling pans; pinching zooms.</small>
                    </span>
                  </label>
                </fieldset>
              </section>
            </div>
            <div
              aria-labelledby="graph-settings-source-tab"
              hidden={activeTab !== 'source'}
              id="graph-settings-source-panel"
              role="tabpanel"
            >
              {children}
            </div>
            {warning === undefined ? null : (
              <p className="graph-settings__warning" role="alert">
                {warning}
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
});

function GlobalCustomLayoutControls({
  onChange,
  settings,
}: {
  readonly onChange: (
    key: keyof GlobalLayoutCustomSettings,
    value: number,
  ) => void;
  readonly settings: GlobalLayoutCustomSettings;
}) {
  return (
    <div className="global-layout-custom-controls">
      {(
        [
          ['linkForce', 'Reference pull', 0.05],
          ['folderCohesion', 'Folder tendency', 0.005],
          ['betweenFolderSpacing', 'Folder separation', 0.1],
          ['nodeSize', 'Node size', 0.25],
          ['linkThickness', 'Link thickness', 0.05],
          ['labelThreshold', 'Label threshold', 0.25],
        ] as const
      ).map(([key, label, step]) => (
        <label key={key}>
          <span>
            {label} <output>{settings[key]}</output>
          </span>
          <input
            max={GLOBAL_LAYOUT_CUSTOM_RANGES[key].max}
            min={GLOBAL_LAYOUT_CUSTOM_RANGES[key].min}
            onChange={(event) =>
              onChange(key, Number(event.currentTarget.value))
            }
            step={step}
            type="range"
            value={settings[key]}
          />
        </label>
      ))}
    </div>
  );
}
