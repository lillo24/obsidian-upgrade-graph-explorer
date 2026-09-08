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
import type {
  GlobalDensityQaDiagnostics,
  LocalDensityQaDiagnostics,
} from '@icarus-graph-explorer/renderer-sigma/types';

import type {
  FocusHierarchyImplementation,
  GraphPreferences,
} from '../preferences/graph-preferences';

import {
  graphSettingsTabForKey,
  type GraphSettingsTab,
} from './graph-settings-tabs';

interface GraphSettingsProps {
  readonly allNetworkDensityQaDiagnostics?: GlobalDensityQaDiagnostics;
  readonly allNetworkDensityFramingStrength: number;
  readonly focusNetworkDensityQaDiagnostics?: LocalDensityQaDiagnostics;
  readonly focusNetworkDensityFramingStrength: number;
  readonly focusHierarchyImplementation?: FocusHierarchyImplementation;
  readonly onFocusHierarchyImplementationChange?: (
    implementation: FocusHierarchyImplementation,
  ) => void;
  readonly modularFocusInternalLayout?: GraphPreferences['modularFocusInternalLayout'];
  readonly onModularFocusInternalLayoutChange?: (
    layout: GraphPreferences['modularFocusInternalLayout'],
  ) => void;
  readonly modularFocusHeadingOrder?: GraphPreferences['modularFocusHeadingOrder'];
  readonly onModularFocusHeadingOrderChange?: (
    order: GraphPreferences['modularFocusHeadingOrder'],
  ) => void;
  readonly modularFolderStripsVisible?: GraphPreferences['modularFolderStripsVisible'];
  readonly onModularFolderStripsVisibleChange?: (visible: boolean) => void;
  readonly modularConnectionStyle?: GraphPreferences['modularConnectionStyle'];
  readonly onModularConnectionStyleChange?: (
    style: GraphPreferences['modularConnectionStyle'],
  ) => void;
  readonly showExperimentalAllHierarchy?: boolean;
  readonly onShowExperimentalAllHierarchyChange?: (show: boolean) => void;
  readonly children?: ReactNode;
  readonly focusAppearance: FocusAppearance;
  readonly globalLayoutSettings: GlobalLayoutSettings;
  readonly open: boolean;
  readonly onFocusAppearanceChange: (appearance: FocusAppearance) => void;
  readonly onAllNetworkDensityFramingStrengthChange: (strength: number) => void;
  readonly onFocusNetworkDensityFramingStrengthChange: (
    strength: number,
  ) => void;
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

function DensityQaDiagnostics({
  diagnostics,
  unavailableMessage,
}: {
  readonly diagnostics:
    GlobalDensityQaDiagnostics | LocalDensityQaDiagnostics | undefined;
  readonly unavailableMessage: string;
}) {
  return (
    <div aria-atomic="true" aria-live="polite" className="focus-density-qa">
      <h4>Temporary QA diagnostics</h4>
      {diagnostics === undefined ? (
        <p>{unavailableMessage}</p>
      ) : (
        <dl>
          <div>
            <dt>Raw decision ratio</dt>
            <dd>{diagnostics.rawDecisionRatio.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Effective ratio</dt>
            <dd>{diagnostics.effectiveRatio.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Sigma camera ratio</dt>
            <dd>{diagnostics.cameraRatio.toFixed(4)}</dd>
          </div>
          <div>
            <dt>Fallback</dt>
            <dd>{diagnostics.fallback ? 'Yes' : 'No'}</dd>
          </div>
          {diagnostics.fallbackReason === undefined ? null : (
            <div>
              <dt>Fallback reason</dt>
              <dd>{diagnostics.fallbackReason}</dd>
            </div>
          )}
          {'nodeCount' in diagnostics ? (
            <>
              <div>
                <dt>Nodes</dt>
                <dd>{diagnostics.nodeCount}</dd>
              </div>
              <div>
                <dt>Edges</dt>
                <dd>{diagnostics.edgeCount}</dd>
              </div>
              <div>
                <dt>Isolated nodes</dt>
                <dd>{diagnostics.isolatedNodeCount}</dd>
              </div>
            </>
          ) : null}
        </dl>
      )}
      <p>Runtime only; never saved or used as layout input.</p>
    </div>
  );
}

export const GraphSettings = memo(function GraphSettings({
  allNetworkDensityQaDiagnostics,
  allNetworkDensityFramingStrength,
  focusNetworkDensityQaDiagnostics,
  focusNetworkDensityFramingStrength,
  focusHierarchyImplementation = 'classic',
  onFocusHierarchyImplementationChange,
  modularFocusInternalLayout = 'adaptive-compass',
  onModularFocusInternalLayoutChange,
  modularFocusHeadingOrder = 'crossing-optimized',
  onModularFocusHeadingOrderChange,
  modularFolderStripsVisible = true,
  onModularFolderStripsVisibleChange,
  modularConnectionStyle = 'direct',
  onModularConnectionStyleChange,
  showExperimentalAllHierarchy = false,
  onShowExperimentalAllHierarchyChange,
  children,
  focusAppearance,
  globalLayoutSettings,
  onAllNetworkDensityFramingStrengthChange,
  onFocusNetworkDensityFramingStrengthChange,
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
  const customSettings =
    globalLayoutSettings.custom ??
    customGlobalLayoutSettings(globalLayoutSettings.spacingPreset);
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
                aria-labelledby="network-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="network-settings-heading">Network</h3>
                <p className="global-layout-scope-note">
                  Shared by Scope = All and Scope = Focus when Layout = Network.
                  Hierarchy layouts are unchanged.
                </p>
                <NetworkSharedControls
                  onChange={changeCustom}
                  settings={customSettings}
                />
              </section>
              <section
                aria-labelledby="global-layout-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="global-layout-settings-heading">All Network</h3>
                <p className="global-layout-scope-note">
                  Folder physics apply only to Scope = All, Layout = Network.
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
                  Advanced All Network controls
                </button>
                {advancedLayoutOpen ? (
                  <GlobalCustomLayoutControls
                    onChange={changeCustom}
                    settings={customSettings}
                  />
                ) : null}
              </section>
              <section
                aria-labelledby="network-density-settings-heading"
                className="graph-settings__section"
              >
                <h3 id="network-density-settings-heading">Network Density</h3>
                <div className="graph-settings__scope-group">
                  <h4>All Network Density</h4>
                  <label
                    className="global-layout-strength"
                    htmlFor="all-density-framing-strength"
                  >
                    <span>
                      <strong>Strength</strong>
                      <output htmlFor="all-density-framing-strength">
                        {allNetworkDensityFramingStrength}%
                      </output>
                    </span>
                    <input
                      aria-valuetext={`${allNetworkDensityFramingStrength} percent`}
                      id="all-density-framing-strength"
                      max="150"
                      min="0"
                      onChange={(event) =>
                        onAllNetworkDensityFramingStrengthChange(
                          Number(event.currentTarget.value),
                        )
                      }
                      step="1"
                      type="range"
                      value={allNetworkDensityFramingStrength}
                    />
                    <small>
                      <span>Legacy</span>
                      <span>Auto</span>
                      <span>Stronger</span>
                    </small>
                  </label>
                  <p className="global-layout-scope-note">
                    Camera-only framing for Scope = All, Layout = Network.
                  </p>
                  <DensityQaDiagnostics
                    diagnostics={allNetworkDensityQaDiagnostics}
                    unavailableMessage="Open All Network to read its live density camera."
                  />
                </div>
                <div className="graph-settings__scope-group">
                  <h4>Focus Network Density</h4>
                  <label
                    className="global-layout-strength"
                    htmlFor="focus-density-framing-strength"
                  >
                    <span>
                      <strong>Strength</strong>
                      <output htmlFor="focus-density-framing-strength">
                        {focusNetworkDensityFramingStrength}%
                      </output>
                    </span>
                    <input
                      aria-valuetext={`${focusNetworkDensityFramingStrength} percent`}
                      id="focus-density-framing-strength"
                      max="150"
                      min="0"
                      onChange={(event) =>
                        onFocusNetworkDensityFramingStrengthChange(
                          Number(event.currentTarget.value),
                        )
                      }
                      step="1"
                      type="range"
                      value={focusNetworkDensityFramingStrength}
                    />
                    <small>
                      <span>Legacy</span>
                      <span>Auto</span>
                      <span>Stronger</span>
                    </small>
                  </label>
                  <p className="global-layout-scope-note">
                    Camera-only framing for Scope = Focus, Layout = Network.
                  </p>
                  <DensityQaDiagnostics
                    diagnostics={focusNetworkDensityQaDiagnostics}
                    unavailableMessage="Open Focus Network to read its live density camera."
                  />
                </div>
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
                    <fieldset className="graph-settings__choice-group">
                      <legend>Focus Hierarchy implementation</legend>
                      <label>
                        <input
                          checked={focusHierarchyImplementation === 'classic'}
                          name="focus-hierarchy-implementation"
                          onChange={() =>
                            onFocusHierarchyImplementationChange?.('classic')
                          }
                          type="radio"
                          value="classic"
                        />
                        <span>
                          <strong>Classic</strong>
                          <small>Current Focus Hierarchy renderer.</small>
                        </span>
                      </label>
                      <label>
                        <input
                          checked={
                            focusHierarchyImplementation === 'modular-preview'
                          }
                          name="focus-hierarchy-implementation"
                          onChange={() =>
                            onFocusHierarchyImplementationChange?.(
                              'modular-preview',
                            )
                          }
                          type="radio"
                          value="modular-preview"
                        />
                        <span>
                          <strong>Modular preview</strong>
                          <small>
                            New File-module layout with exact File/Heading/Block
                            endpoints. Experimental until HIER3C.
                          </small>
                        </span>
                      </label>
                    </fieldset>
                    <fieldset
                      className="graph-settings__choice-group"
                      disabled={
                        focusHierarchyImplementation !== 'modular-preview'
                      }
                    >
                      <legend>Internal layout</legend>
                      <label>
                        <input
                          checked={
                            modularFocusInternalLayout === 'adaptive-compass'
                          }
                          name="modular-focus-internal-layout"
                          onChange={() =>
                            onModularFocusInternalLayoutChange?.(
                              'adaptive-compass',
                            )
                          }
                          type="radio"
                          value="adaptive-compass"
                        />
                        <span>
                          <strong>Adaptive Compass</strong>
                          <small>
                            Places structural branches around each File using
                            exact endpoint demand.
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          checked={
                            modularFocusInternalLayout === 'vertical-spine'
                          }
                          name="modular-focus-internal-layout"
                          onChange={() =>
                            onModularFocusInternalLayoutChange?.(
                              'vertical-spine',
                            )
                          }
                          type="radio"
                          value="vertical-spine"
                        />
                        <span>
                          <strong>Vertical Spine</strong>
                          <small>
                            Keeps structural branches above and below each File.
                          </small>
                        </span>
                      </label>
                    </fieldset>
                    <fieldset
                      className="graph-settings__choice-group"
                      disabled={
                        focusHierarchyImplementation !== 'modular-preview'
                      }
                    >
                      <legend>Heading order</legend>
                      <label>
                        <input
                          checked={
                            modularFocusHeadingOrder === 'crossing-optimized'
                          }
                          name="modular-focus-heading-order"
                          onChange={() =>
                            onModularFocusHeadingOrderChange?.(
                              'crossing-optimized',
                            )
                          }
                          type="radio"
                          value="crossing-optimized"
                        />
                        <span>
                          <strong>Crossing optimized</strong>
                          <small>
                            Reorders visual branches when that reduces exact
                            endpoint crossings.
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          checked={
                            modularFocusHeadingOrder === 'document-order'
                          }
                          name="modular-focus-heading-order"
                          onChange={() =>
                            onModularFocusHeadingOrderChange?.('document-order')
                          }
                          type="radio"
                          value="document-order"
                        />
                        <span>
                          <strong>Document order</strong>
                          <small>
                            Uses Markdown source order for visual branches.
                          </small>
                        </span>
                      </label>
                    </fieldset>
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
                    <fieldset
                      className="graph-settings__choice-group"
                      disabled={
                        focusHierarchyImplementation !== 'modular-preview'
                      }
                    >
                      <legend>Folder strips</legend>
                      <label>
                        <input
                          checked={modularFolderStripsVisible}
                          name="modular-folder-strips"
                          onChange={(event) =>
                            onModularFolderStripsVisibleChange?.(
                              event.currentTarget.checked,
                            )
                          }
                          type="checkbox"
                        />
                        <span>
                          <strong>Show folder strips</strong>
                          <small>
                            Shows the exact directional folder-band plan without
                            changing layout.
                          </small>
                        </span>
                      </label>
                    </fieldset>
                    <fieldset
                      className="graph-settings__choice-group"
                      disabled={
                        focusHierarchyImplementation !== 'modular-preview'
                      }
                    >
                      <legend>Connection style</legend>
                      <label>
                        <input
                          checked={modularConnectionStyle === 'direct'}
                          name="modular-connection-style"
                          onChange={() =>
                            onModularConnectionStyleChange?.('direct')
                          }
                          type="radio"
                          value="direct"
                        />
                        <span>
                          <strong>Direct</strong>
                          <small>
                            Draws one straight path between exact endpoints.
                          </small>
                        </span>
                      </label>
                      <label>
                        <input
                          checked={modularConnectionStyle === 'electronic'}
                          name="modular-connection-style"
                          onChange={() =>
                            onModularConnectionStyleChange?.('electronic')
                          }
                          type="radio"
                          value="electronic"
                        />
                        <span>
                          <strong>Electronic</strong>
                          <small>
                            Uses the existing stepped connector appearance.
                          </small>
                        </span>
                      </label>
                    </fieldset>
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
        <h4 id="global-layout-advanced-layout-heading">All-only controls</h4>
        <GlobalCustomRange
          controlKey="betweenFolderSpacing"
          label="Folder separation"
          onChange={onChange}
          settings={settings}
          step={0.1}
        />
      </section>
      <section aria-labelledby="global-layout-advanced-visual-heading">
        <h4 id="global-layout-advanced-visual-heading">All-only visual</h4>
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
      </section>
    </div>
  );
}

export function NetworkSharedControls({
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
    <div className="global-layout-custom-controls" id="network-shared-controls">
      <GlobalCustomRange
        controlKey="linkForce"
        idPrefix="network-setting"
        label="Reference Pull"
        onChange={onChange}
        settings={settings}
        step={0.05}
      >
        <small>
          <span>Weak</span>
          <span>Strong</span>
        </small>
      </GlobalCustomRange>
      <GlobalCustomRange
        controlKey="nodeSize"
        idPrefix="network-setting"
        label="Base node size"
        onChange={onChange}
        settings={settings}
        step={0.25}
      />
      <GlobalCustomRange
        controlKey="linkThickness"
        idPrefix="network-setting"
        label="Link thickness"
        onChange={onChange}
        settings={settings}
        step={0.05}
      />
      <GlobalCustomRange
        controlKey="labelThreshold"
        idPrefix="network-setting"
        label="Label threshold"
        onChange={onChange}
        settings={settings}
        step={0.25}
      />
    </div>
  );
}

function GlobalCustomRange({
  children,
  controlKey,
  idPrefix = 'global-layout',
  label,
  onChange,
  output,
  settings,
  step,
  valueText,
}: {
  readonly children?: ReactNode;
  readonly controlKey: keyof GlobalLayoutCustomSettings;
  readonly idPrefix?: string;
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
  const id = `${idPrefix}-${controlKey}`;
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
