import { memo, useRef, useState, type ReactNode } from 'react';

import type {
  FocusAppearance,
  TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  customGlobalLayoutSettings,
  folderClusteringStrength,
  GLOBAL_LAYOUT_CUSTOM_RANGES,
  type GlobalLayoutCustomSettings,
  type GlobalLayoutSettings,
  type GlobalSpacingPreset,
  withFolderClusteringStrength,
  withGlobalSpacingPreset,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import {
  graphSettingsTabForKey,
  type GraphSettingsTab,
} from './graph-settings-tabs';

interface GraphSettingsProps {
  readonly densityFramingStrength: number;
  readonly showExperimentalAllHierarchy?: boolean;
  readonly onShowExperimentalAllHierarchyChange?: (show: boolean) => void;
  readonly children?: ReactNode;
  readonly focusAppearance: FocusAppearance;
  readonly globalLayoutSettings: GlobalLayoutSettings;
  readonly open: boolean;
  readonly onFocusAppearanceChange: (appearance: FocusAppearance) => void;
  readonly onDensityFramingStrengthChange: (strength: number) => void;
  readonly onGlobalLayoutSettingsChange: (
    settings: GlobalLayoutSettings,
  ) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onTrackpadZoomModeChange: (mode: TrackpadZoomMode) => void;
  readonly onResetSandbox: () => void;
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
  densityFramingStrength,
  showExperimentalAllHierarchy = false,
  onShowExperimentalAllHierarchyChange,
  children,
  focusAppearance,
  globalLayoutSettings,
  onDensityFramingStrengthChange,
  onFocusAppearanceChange,
  onGlobalLayoutSettingsChange,
  onOpenChange,
  onTrackpadZoomModeChange,
  onResetSandbox,
  open,
  trackpadZoomMode,
  warning,
}: GraphSettingsProps) {
  const [activeTab, setActiveTab] = useState<GraphSettingsTab>('preferences');
  const [advancedLayoutOpen, setAdvancedLayoutOpen] = useState(false);
  const [experimentalOpen, setExperimentalOpen] = useState(false);
  const folderStrength = folderClusteringStrength(globalLayoutSettings);
  const preferencesTabRef = useRef<HTMLButtonElement>(null);
  const sandboxTabRef = useRef<HTMLButtonElement>(null);
  const sourceTabRef = useRef<HTMLButtonElement>(null);
  const changePreset = (spacingPreset: GlobalSpacingPreset) => {
    onGlobalLayoutSettingsChange(
      withGlobalSpacingPreset(globalLayoutSettings, spacingPreset),
    );
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
    const nextRef =
      nextTab === 'preferences'
        ? preferencesTabRef
        : nextTab === 'sandbox'
          ? sandboxTabRef
          : sourceTabRef;
    nextRef.current?.focus();
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
              aria-controls="graph-settings-preferences-panel"
              aria-selected={activeTab === 'preferences'}
              id="graph-settings-preferences-tab"
              onClick={() => setActiveTab('preferences')}
              onKeyDown={(event) => {
                if (!handleTabKey(event.key)) return;
                event.preventDefault();
              }}
              ref={preferencesTabRef}
              role="tab"
              tabIndex={activeTab === 'preferences' ? 0 : -1}
              type="button"
            >
              Preferences
            </button>
            <button
              aria-controls="graph-settings-sandbox-panel"
              aria-selected={activeTab === 'sandbox'}
              id="graph-settings-sandbox-tab"
              onClick={() => setActiveTab('sandbox')}
              onKeyDown={(event) => {
                if (!handleTabKey(event.key)) return;
                event.preventDefault();
              }}
              ref={sandboxTabRef}
              role="tab"
              tabIndex={activeTab === 'sandbox' ? 0 : -1}
              type="button"
            >
              Sandbox
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
              aria-labelledby="graph-settings-preferences-tab"
              hidden={activeTab !== 'preferences'}
              id="graph-settings-preferences-panel"
              role="tabpanel"
            >
              <section
                aria-labelledby="graph-interaction-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="graph-interaction-settings-heading">Interaction</h3>
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
              aria-labelledby="graph-settings-sandbox-tab"
              hidden={activeTab !== 'sandbox'}
              id="graph-settings-sandbox-panel"
              role="tabpanel"
            >
              <p className="graph-settings__sandbox-note">
                Controls for experimenting with graph presentation and choosing
                useful defaults.
              </p>
              <section
                aria-labelledby="graph-appearance-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="graph-appearance-settings-heading">
                  Focus Root appearance
                </h3>
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
                <h3 id="global-layout-settings-heading">All Network Layout</h3>
                <p className="global-layout-scope-note">
                  Applies to Scope = All, Layout = Network. Changes appear when
                  you return to All + Network.
                </p>
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
                <label
                  className="global-layout-strength"
                  htmlFor="global-folder-clustering-strength"
                >
                  <span>
                    <strong>Folder clustering strength</strong>
                    <output>{folderStrength}%</output>
                  </span>
                  <input
                    aria-valuetext={`${folderStrength} percent`}
                    disabled={!globalLayoutSettings.folderClustering}
                    id="global-folder-clustering-strength"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      onGlobalLayoutSettingsChange(
                        withFolderClusteringStrength(
                          globalLayoutSettings,
                          Number(event.currentTarget.value),
                        ),
                      )
                    }
                    step="1"
                    type="range"
                    value={folderStrength}
                  />
                  <small>
                    <span>Weak</span>
                    <span>Strong</span>
                  </small>
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
                <button
                  aria-controls="global-layout-advanced-controls"
                  aria-expanded={advancedLayoutOpen}
                  className="graph-settings__disclosure"
                  onClick={() => setAdvancedLayoutOpen((current) => !current)}
                  type="button"
                >
                  <span aria-hidden="true">
                    {advancedLayoutOpen ? '▾' : '▸'}
                  </span>{' '}
                  Advanced controls
                </button>
                {advancedLayoutOpen ? (
                  <GlobalCustomLayoutControls
                    onChange={changeCustom}
                    settings={
                      globalLayoutSettings.custom ??
                      customGlobalLayoutSettings(
                        globalLayoutSettings.spacingPreset,
                      )
                    }
                  />
                ) : null}
              </section>
              <section
                aria-labelledby="focus-density-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="focus-density-settings-heading">
                  Focus Network Density Framing
                </h3>
                <label
                  className="global-layout-strength"
                  htmlFor="focus-density-framing-strength"
                >
                  <span>
                    <strong>Strength</strong>
                    <output htmlFor="focus-density-framing-strength">
                      {densityFramingStrength}%
                    </output>
                  </span>
                  <input
                    aria-valuetext={`${densityFramingStrength} percent`}
                    id="focus-density-framing-strength"
                    max="100"
                    min="0"
                    onChange={(event) =>
                      onDensityFramingStrengthChange(
                        Number(event.currentTarget.value),
                      )
                    }
                    step="1"
                    type="range"
                    value={densityFramingStrength}
                  />
                  <small>
                    <span>Legacy</span>
                    <span>Auto</span>
                  </small>
                </label>
                <p className="global-layout-scope-note">
                  Changes automatic Focus Network framing only. Manual pan and
                  zoom remain authoritative until Fit.
                </p>
              </section>
              <section className="graph-settings__section">
                <button
                  aria-controls="graph-experimental-controls"
                  aria-expanded={experimentalOpen}
                  className="graph-settings__disclosure"
                  onClick={() => setExperimentalOpen((current) => !current)}
                  type="button"
                >
                  <span aria-hidden="true">{experimentalOpen ? '▾' : '▸'}</span>{' '}
                  Experimental
                </button>
                {experimentalOpen ? (
                  <div id="graph-experimental-controls">
                    <label className="graph-settings__check">
                      <input
                        checked={showExperimentalAllHierarchy}
                        onChange={(event) =>
                          onShowExperimentalAllHierarchyChange?.(
                            event.currentTarget.checked,
                          )
                        }
                        type="checkbox"
                      />
                      <span>
                        <strong>Show All Hierarchy</strong>
                        <small>
                          Exposes the whole-vault Hierarchy layout. Focus
                          Hierarchy remains available normally.
                        </small>
                      </span>
                    </label>
                  </div>
                ) : null}
              </section>
              <section className="graph-settings__section graph-settings__reset">
                <button onClick={onResetSandbox} type="button">
                  Reset Sandbox
                </button>
                <small>
                  Restores only graph-presentation experiments. Preferences,
                  source configuration, and saved views stay unchanged.
                </small>
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

export function GlobalCustomLayoutControls({
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
    <div
      className="global-layout-custom-controls"
      id="global-layout-advanced-controls"
    >
      <section aria-labelledby="global-layout-advanced-layout-heading">
        <h4 id="global-layout-advanced-layout-heading">Layout</h4>
        <GlobalCustomRange
          controlKey="linkForce"
          label="Reference pull"
          onChange={onChange}
          settings={settings}
          step={0.05}
        />
        <GlobalCustomRange
          controlKey="betweenFolderSpacing"
          label="Folder separation"
          onChange={onChange}
          settings={settings}
          step={0.1}
        />
      </section>
      <section aria-labelledby="global-layout-advanced-visual-heading">
        <h4 id="global-layout-advanced-visual-heading">Visual</h4>
        <GlobalCustomRange
          controlKey="nodeSize"
          label="Base node size"
          onChange={onChange}
          settings={settings}
          step={0.25}
        />
        <GlobalCustomRange
          controlKey="referenceDegreeSizeInfluence"
          label="Link influence on node size"
          onChange={onChange}
          output={`${settings.referenceDegreeSizeInfluence}%`}
          settings={settings}
          step={1}
          valueText={`${settings.referenceDegreeSizeInfluence} percent`}
        >
          <small>
            <span>None</span>
            <span>Strong</span>
          </small>
        </GlobalCustomRange>
        <GlobalCustomRange
          controlKey="linkThickness"
          label="Link thickness"
          onChange={onChange}
          settings={settings}
          step={0.05}
        />
        <GlobalCustomRange
          controlKey="labelThreshold"
          label="Label threshold"
          onChange={onChange}
          settings={settings}
          step={0.25}
        />
      </section>
    </div>
  );
}

function GlobalCustomRange({
  children,
  controlKey,
  label,
  onChange,
  output,
  settings,
  step,
  valueText,
}: {
  readonly children?: ReactNode;
  readonly controlKey: keyof GlobalLayoutCustomSettings;
  readonly label: string;
  readonly onChange: (
    key: keyof GlobalLayoutCustomSettings,
    value: number,
  ) => void;
  readonly output?: ReactNode;
  readonly settings: GlobalLayoutCustomSettings;
  readonly step: number;
  readonly valueText?: string;
}) {
  const id = `global-layout-${controlKey}`;
  return (
    <label htmlFor={id}>
      <span>
        {label} <output htmlFor={id}>{output ?? settings[controlKey]}</output>
      </span>
      <input
        {...(valueText === undefined ? {} : { 'aria-valuetext': valueText })}
        id={id}
        max={GLOBAL_LAYOUT_CUSTOM_RANGES[controlKey].max}
        min={GLOBAL_LAYOUT_CUSTOM_RANGES[controlKey].min}
        onChange={(event) =>
          onChange(controlKey, Number(event.currentTarget.value))
        }
        step={step}
        type="range"
        value={settings[controlKey]}
      />
      {children}
    </label>
  );
}
