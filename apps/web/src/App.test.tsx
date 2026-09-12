import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  createDiagnosticLookups,
  summarizeDiagnosticReport,
  validateObsidianDiagnosticReport,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import { createRuntimePerformanceRecorder } from '@icarus-graph-explorer/performance';
import {
  createPersistedWorkspaceView,
  serializePersistedWorkspaceView,
} from '@icarus-graph-explorer/view-state';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { DEFAULT_GLOBAL_LAYOUT_SETTINGS } from '@icarus-graph-explorer/renderer-sigma/settings';

import { App } from './App';
import { DeveloperSettingsSection } from './components/DeveloperSettingsSection';
import { DiagnosticEvidenceContent } from './components/DiagnosticEvidenceContent';
import { DiagnosticEvidenceDialog } from './components/DiagnosticEvidenceDialog';
import { retainGraphSelection } from './components/controlled-selection';
import { GraphExplorer } from './components/GraphExplorer';
import { GraphSettings } from './components/GraphSettings';
import { SourceSettingsSection } from './components/SourceSettingsSection';
import { WorkspaceNotice } from './components/WorkspaceNotice';
import { activateMaximizedGraphMode } from './components/maximized-graph-mode';
import { GRAPH_PREFERENCES_STORAGE_KEY } from './preferences/graph-preferences';
import {
  buildReferenceViews,
  filterReferenceViews,
  matchingHierarchyDocumentIds,
} from './report-view';
import sampleReport from './sample-report.json';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('The web sample report must be valid.');
const report = validation.value;
const diagnosticLookups = createDiagnosticLookups(report.snapshot);
const diagnosticSummary = summarizeDiagnosticReport(report);
const referenceViews = buildReferenceViews(report, diagnosticLookups);
const storage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};
describe('graph-first explorer shell', () => {
  it('retains controlled selection identity when a renderer echoes it', () => {
    const current = { kind: 'node', id: 'entity:source' } as const;
    expect(retainGraphSelection(current, { ...current })).toBe(current);
    expect(
      retainGraphSelection(current, { kind: 'node', id: 'entity:target' }),
    ).toEqual({ kind: 'node', id: 'entity:target' });
  });

  it('bundles a deterministic stable-identity sample for reload persistence QA', () => {
    expect(sampleReport.identity).toEqual({ stability: 'stable' });
    expect(
      sampleReport.snapshot.entities.every(({ id }) =>
        id.startsWith('stable:'),
      ),
    ).toBe(true);
  });

  it('renders an edge-to-edge graph workspace without permanent app or diagnostic chrome', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Graph Explorer');
    expect(markup).toContain('class="visually-hidden" id="workspace-title"');
    expect(markup).not.toContain('class="app-bar"');
    expect(markup).not.toContain('class="diagnostic-shell"');
    expect(markup).toContain('class="workspace-main" id="main-content"');
    expect(markup).toContain(
      'class="graph-workspace" aria-label="Knowledge graph workspace"',
    );
    expect(markup).not.toContain('workspace-notice-stack');
    expect(markup).not.toContain('Open Report');
    expect(markup).not.toContain('Synthetic Sample');
    expect(markup).not.toContain('Canonical Hierarchy');
    expect(markup).not.toContain('Compatibility Probes');
    expect(markup).not.toContain('Open Vault');
    expect(markup).toContain('Search');
    expect(markup).toContain('>Filters<');
    expect(markup).toContain('aria-label="Graph navigation history"');
    expect(markup).toContain('aria-label="Back in graph history" disabled=""');
    expect(markup).toContain(
      'aria-label="Forward in graph history" disabled=""',
    );
    expect(markup).toContain('aria-label="Scope"');
    expect(markup).toContain('aria-label="Saved Views"');
    expect(markup).toContain('>Reset current view</button>');
    expect(markup).not.toContain('Reset saved view');
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">All</button>',
    );
    expect(markup).toContain('aria-label="Layout"');
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Network</button>',
    );
    expect(markup).not.toContain('aria-label="Hierarchy depth"');
    expect(markup).not.toContain('>Hierarchy</button>');
    expect(markup).not.toContain('>Documents</button>');
    expect(markup).not.toContain('>Top-Level</button>');
    expect(markup).not.toContain('Focus Selected');
    expect(markup).not.toContain('aria-label="Focus controls"');
    expect(markup).toContain('aria-label="Open Inspector"');
    expect(markup).not.toContain('>Inspector</button>');
    expect(markup).toContain('Loading All Network');
    expect(markup).toContain('The graph was fitted for this source load.');
    expect(markup).not.toContain('aria-label="Fit graph to view"');
    expect(markup).not.toContain('>Maximize Graph</button>');
    expect(markup).not.toContain('diagnostic-evidence');
    expect(markup).not.toContain('Filter Evidence');
    expect(markup).not.toContain('Local-first · Read-only');
    expect(markup).not.toContain('KG9 · Durable Local View');
    expect(markup).not.toContain('<h2>Knowledge Graph</h2>');
    expect(markup).not.toContain('class="app-footer"');
  });

  it('keeps source actions in Settings and exposes Open Vault only for desktop', () => {
    const sharedProps = {
      currentSourceName: 'report.json',
      currentStatus: 'Ready',
      entityCount: 3,
      live: false,
      markdownFileCount: 2,
      onOpenVault: () => undefined,
      onReportChange: () => undefined,
      onRescanVault: () => undefined,
      onResetLocalIdentity: () => undefined,
      onUseSample: () => undefined,
      opening: false,
      reportIsSample: false,
      rescanDisabled: false,
    } as const;
    const browserMarkup = renderToStaticMarkup(
      <SourceSettingsSection {...sharedProps} desktopAvailable={false} />,
    );
    const desktopMarkup = renderToStaticMarkup(
      <SourceSettingsSection {...sharedProps} desktopAvailable />,
    );

    expect(browserMarkup).not.toContain('Open Vault');
    expect(browserMarkup).toContain('for="report-file">Open Report</label>');
    expect(browserMarkup).toContain('id="report-file"');
    expect(browserMarkup).toContain('Use Synthetic Sample');
    expect(browserMarkup).toContain('Sources are read locally');
    expect(browserMarkup).not.toContain('Rescan Vault');
    expect(browserMarkup).not.toContain('>Recovery</h4>');
    expect(desktopMarkup).toContain('Open Vault');
    expect(desktopMarkup).toContain('Open Report');
  });

  it('shows live source status, disabled actions, and recovery only when supplied', () => {
    const markup = renderToStaticMarkup(
      <SourceSettingsSection
        currentSourceName="Knowledge Vault"
        currentStatus="Paused"
        desktopAvailable
        entityCount={82}
        live
        markdownFileCount={21}
        onOpenVault={() => undefined}
        onReportChange={() => undefined}
        onRescanVault={() => undefined}
        onResetLocalIdentity={() => undefined}
        onUseSample={() => undefined}
        opening
        recoveryLabel="Reset Local Identity for This Vault"
        reportIsSample={false}
        rescanDisabled
        sourceDetail="Live updates are paused."
        sourceWarning="Stable identity could not be saved."
      />,
    );

    expect(markup).toContain('Knowledge Vault');
    expect(markup).toContain('<dd>Paused</dd>');
    expect(markup).toContain('Rescan Vault</button>');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('>Recovery</h4>');
    expect(markup).toContain('Reset Local Identity for This Vault');
    expect(markup).toContain('Stable identity could not be saved.');
    expect(markup).not.toContain('C:\\');
  });

  it('renders important source errors as non-layout workspace notices', () => {
    const markup = renderToStaticMarkup(
      <div className="workspace-notice-stack">
        <WorkspaceNotice tone="error">
          The current source was preserved.
        </WorkspaceNotice>
      </div>,
    );

    expect(markup).toContain('class="workspace-notice-stack"');
    expect(markup).toContain('workspace-notice--error" role="alert"');
    expect(markup).toContain('The current source was preserved.');
  });

  it('starts with the inspector closed and renders the maximized shell without replacing graph controls', () => {
    const normalMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"showExperimentalAllHierarchy":true}'
              : null,
        }}
      />,
    );
    const maximizedMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"showExperimentalAllHierarchy":true}'
              : null,
        }}
      />,
    );

    expect(normalMarkup).toContain('class="graph-inspector-toggle"');
    expect(normalMarkup).toContain('aria-label="Open Inspector"');
    expect(normalMarkup).not.toContain('>Inspector</button>');
    expect(normalMarkup).not.toContain('Heading Depth');
    expect(normalMarkup).toContain('class="graph-inspector-handle"');
    expect(normalMarkup).toContain(
      '<span aria-hidden="true">‹</span></button>',
    );
    expect(normalMarkup).not.toContain('Provenance Inspector');
    expect(normalMarkup).not.toContain('graph-stage--inspector-open');
    expect(normalMarkup).toContain('Laying out graph…');
    expect(normalMarkup).not.toContain('aria-label="Fit graph to view"');
    expect(normalMarkup).toContain('aria-label="Open Settings"');
    expect(normalMarkup).toContain('data-trackpad-zoom-mode="scroll-zoom"');
    expect(normalMarkup).not.toContain('class="graph-floating-controls"');
    expect(
      normalMarkup.match(/aria-label="Back in graph history"/g),
    ).toHaveLength(1);
    expect(
      normalMarkup.match(/aria-label="Forward in graph history"/g),
    ).toHaveLength(1);
    expect(normalMarkup).toContain(
      'aria-label="Maximize graph" aria-pressed="false"',
    );
    expect(normalMarkup).not.toContain('react-flow__controls-fitview');
    expect(maximizedMarkup).toContain(
      'graph-workspace graph-workspace--maximized',
    );
    expect(maximizedMarkup).toContain(
      'aria-label="Restore graph" aria-pressed="true"',
    );
    expect(maximizedMarkup).toContain('class="graph-floating-controls"');
    expect(
      maximizedMarkup.match(/aria-label="Back in graph history"/g),
    ).toHaveLength(1);
    expect(
      maximizedMarkup.match(/aria-label="Forward in graph history"/g),
    ).toHaveLength(1);
    expect(maximizedMarkup).toContain(
      'aria-controls="graph-tools-panel" aria-expanded="false"',
    );
    expect(maximizedMarkup).toContain(
      'class="graph-tools-surface" hidden="" id="graph-tools-panel"',
    );
    expect(maximizedMarkup.match(/class="entity-search"/g)).toHaveLength(1);
    expect(maximizedMarkup).toContain('aria-label="Open Inspector"');
    expect(maximizedMarkup).toContain('class="graph-inspector-handle"');
    expect(maximizedMarkup).toContain('>Filters<');
    expect(maximizedMarkup).not.toContain('Focus Selected');
    expect(maximizedMarkup).not.toContain('aria-label="Focus controls"');
  });

  it('hydrates and exposes an exact persisted structural depth', () => {
    const workspace = createProjectionWorkspace(report.snapshot);
    const persisted = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace,
        state: {
          ...documentOnlyProjectionState(),
          disclosure: {
            ...documentOnlyProjectionState().disclosure,
            defaultDepth: 3,
          },
        },
      }),
    );
    const markup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"showExperimentalAllHierarchy":true}'
              : key.includes('view')
                ? persisted
                : null,
        }}
      />,
    );

    expect(markup).toContain('<option value="3" selected="">3 levels</option>');
    expect(markup).not.toContain('aria-pressed="true">3 levels</button>');
  });

  it('uses one shared settings UI and hydrates the global trackpad choice', () => {
    const settingsMarkup = renderToStaticMarkup(
      <GraphSettings
        allNetworkDensityFramingStrength={100}
        focusNetworkDensityFramingStrength={100}
        focusAppearance="inverted"
        globalLayoutSettings={DEFAULT_GLOBAL_LAYOUT_SETTINGS}
        onAllNetworkDensityFramingStrengthChange={() => undefined}
        onFocusNetworkDensityFramingStrengthChange={() => undefined}
        onFocusAppearanceChange={() => undefined}
        onGlobalLayoutSettingsChange={() => undefined}
        onOpenChange={() => undefined}
        onResetSandbox={() => undefined}
        onTrackpadZoomModeChange={() => undefined}
        open
        trackpadZoomMode="pinch-zoom"
        warning="Preference is session-only."
      >
        <SourceSettingsSection
          currentSourceName="Synthetic Sample"
          currentStatus="Ready"
          desktopAvailable={false}
          entityCount={3}
          live={false}
          markdownFileCount={2}
          onOpenVault={() => undefined}
          onReportChange={() => undefined}
          onRescanVault={() => undefined}
          onResetLocalIdentity={() => undefined}
          onUseSample={() => undefined}
          opening={false}
          reportIsSample
          rescanDisabled={false}
        />
        <DeveloperSettingsSection onOpenDiagnosticEvidence={() => undefined} />
      </GraphSettings>,
    );
    expect(settingsMarkup).toContain('>Preferences</button>');
    expect(settingsMarkup).toContain('>Sandbox</button>');
    expect(settingsMarkup).toContain('>Focus Root appearance</h3>');
    expect(settingsMarkup).toContain('>Network</h3>');
    expect(settingsMarkup).toContain('>All Network</h3>');
    expect(settingsMarkup).toContain('Reference Pull');
    expect(settingsMarkup).toContain('Base node size');
    expect(settingsMarkup).toContain('Link thickness');
    expect(settingsMarkup).toContain('Label threshold');
    expect(settingsMarkup).toContain('>Folder clustering</strong>');
    expect(settingsMarkup).toContain('<legend>Spacing</legend>');
    expect(settingsMarkup).toContain('data-graph-history-shortcuts="off"');
    expect(settingsMarkup).toContain('<legend>Focus Root</legend>');
    expect(settingsMarkup).toContain('>Outline</strong>');
    expect(settingsMarkup).toContain('>Inverted</strong>');
    expect(settingsMarkup).toContain('>Minimal</strong>');
    expect(settingsMarkup).toContain('<legend>Trackpad Zoom</legend>');
    expect(settingsMarkup).toContain('Scroll to Zoom');
    expect(settingsMarkup).toContain('Pinch to Zoom');
    expect(settingsMarkup.indexOf('>Source</h3>')).toBeLessThan(
      settingsMarkup.indexOf('>Developer</h3>'),
    );
    expect(settingsMarkup.indexOf('>Interaction</h3>')).toBeLessThan(
      settingsMarkup.indexOf('Focus Root appearance'),
    );
    expect(settingsMarkup.indexOf('Focus Root appearance')).toBeLessThan(
      settingsMarkup.indexOf('>Source</h3>'),
    );
    expect(settingsMarkup).toContain('role="tablist"');
    expect(settingsMarkup).toContain('>Source &amp; Diagnostics</button>');
    expect(settingsMarkup).toContain('All Network Density');
    expect(settingsMarkup).toContain('Focus Network Density');
    expect(settingsMarkup).toContain('>Reset Sandbox</button>');
    expect(settingsMarkup).toContain('Open Diagnostic Evidence');
    expect(settingsMarkup).toContain(
      'type="radio" name="trackpad-zoom-mode" checked="" value="pinch-zoom"',
    );
    expect(settingsMarkup).toContain(
      'type="radio" name="focus-appearance" checked="" value="inverted"',
    );
    expect(settingsMarkup).toContain(
      'class="graph-settings__warning" role="alert"',
    );

    const persistedMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"trackpadZoomMode":"pinch-zoom","showExperimentalAllHierarchy":true}'
              : null,
        }}
      />,
    );
    expect(persistedMarkup).toContain('data-trackpad-zoom-mode="pinch-zoom"');
    expect(persistedMarkup).toContain('data-focus-appearance="inverted"');
  });

  it('restores All Network lazily while keeping hierarchy depth out of its topology', () => {
    const workspace = createProjectionWorkspace(report.snapshot);
    const persisted = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace,
        state: documentOnlyProjectionState(),
        rendererMode: 'global',
        viewports: {
          global: {
            anchorEntityId: report.snapshot.entities.find(
              ({ kind }) => kind === 'document',
            )!.id,
            ratio: 0.32,
          },
        },
      }),
    );
    const markup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY ? null : persisted,
        }}
      />,
    );

    expect(markup).toContain(
      '<button aria-pressed="true" type="button">All</button>',
    );
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Network</button>',
    );
    expect(markup).toContain('Loading All Network…');
    expect(markup).not.toContain('aria-label="Hierarchy depth"');
    expect(markup).toContain('aria-label="Open Network Explorer"');
    expect(markup).toContain('class="graph-network-explorer-handle"');
    expect(markup).not.toContain('class="network-explorer"');
  });

  it('restores an explicit Local presentation lazily with scale-up recovery controls', () => {
    const workspace = createProjectionWorkspace(report.snapshot);
    const root = report.snapshot.entities.find(
      ({ kind }) => kind === 'document',
    )!;
    const persisted = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace,
        state: {
          ...documentOnlyProjectionState(),
          disclosure: {
            ...documentOnlyProjectionState().disclosure,
            expandedEntityIds: [root.id],
          },
          focus: {
            rootEntityId: root.id,
            hops: 1,
            direction: 'both',
            hierarchyContext: 'ancestors-and-children',
          },
        },
        presentationMode: 'local',
        viewports: {
          local: { anchorEntityId: root.id, freeRatio: 0.48 },
        },
      }),
    );
    const markup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY ? null : persisted,
        }}
      />,
    );

    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Focus</button>',
    );
    expect(markup).toContain('Loading Focus Network…');
    expect(markup).toContain('aria-label="Layout"');
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Network</button>',
    );
    expect(markup).toContain(
      '<button aria-pressed="false" type="button">Hierarchy</button>',
    );
    expect(markup).toContain('aria-label="Hierarchy depth"');
    expect(markup).toContain('aria-label="Open Network Explorer"');
    expect(markup).toContain('class="graph-network-explorer-handle"');
    expect(markup).not.toContain('>Back to Global</button>');
    expect(markup).not.toContain('>Open in Structure</button>');
  });

  it('restores a legacy focused Structure checkpoint as Focus Hierarchy', () => {
    const workspace = createProjectionWorkspace(report.snapshot);
    const root = report.snapshot.entities.find(
      ({ kind }) => kind === 'document',
    )!;
    const persisted = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace,
        state: {
          ...documentOnlyProjectionState(),
          focus: {
            rootEntityId: root.id,
            hops: 1,
            direction: 'both',
            hierarchyContext: 'ancestors-and-children',
          },
        },
        presentationMode: 'structure',
      }),
    );
    const markup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"localLayoutMode":"free"}'
              : persisted,
        }}
      />,
    );

    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Focus</button>',
    );
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Hierarchy</button>',
    );
    expect(markup).toContain('Loading Focus Hierarchy…');
    expect(markup).toContain(
      'The saved focused hierarchy was restored as Focus with Hierarchy layout.',
    );
  });

  it('restores Local Structured from the existing preference and keeps projection work isolated', () => {
    const workspace = createProjectionWorkspace(report.snapshot);
    const root = report.snapshot.entities.find(
      ({ kind }) => kind === 'document',
    )!;
    const persisted = serializePersistedWorkspaceView(
      createPersistedWorkspaceView({
        workspace,
        state: {
          ...documentOnlyProjectionState(),
          focus: {
            rootEntityId: root.id,
            hops: 1,
            direction: 'both',
            hierarchyContext: 'ancestors-and-children',
          },
        },
        presentationMode: 'local',
        viewports: {
          local: {
            anchorEntityId: root.id,
            freeRatio: 0.48,
            structuredZoom: 0.92,
          },
        },
      }),
    );
    let clock = 0;
    const performance = createRuntimePerformanceRecorder({
      now: () => ++clock,
      markNextPaint: () => undefined,
    });
    const markup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        performance={performance}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: (key) =>
            key === GRAPH_PREFERENCES_STORAGE_KEY
              ? '{"localLayoutMode":"structured"}'
              : persisted,
        }}
      />,
    );
    const operations = performance.snapshot().operations;

    expect(markup).toContain('Loading Focus Hierarchy…');
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Hierarchy</button>',
    );
    expect(operations['local-projections']).toBe(1);
    expect(operations['global-projections']).toBe(0);
    expect(operations['global-layouts']).toBe(0);
    expect(operations['local-layouts']).toBe(0);
  });

  it('renders diagnostic evidence in a labeled, internally scrollable dialog', () => {
    const markup = renderToStaticMarkup(
      <DiagnosticEvidenceDialog onClose={() => undefined}>
        <DiagnosticEvidenceContent
          deferredSearch=""
          hierarchyDocumentIds={matchingHierarchyDocumentIds(
            report,
            diagnosticLookups,
            '',
          )}
          lookups={diagnosticLookups}
          onSearchChange={() => undefined}
          onStatusFilterChange={() => undefined}
          referenceViews={referenceViews}
          report={report}
          search=""
          statusFilter="all"
          summary={diagnosticSummary}
          visibleReferences={filterReferenceViews(referenceViews, 'all', '')}
        />
      </DiagnosticEvidenceDialog>,
    );

    expect(markup).toContain(
      '<dialog aria-labelledby="diagnostic-evidence-title"',
    );
    expect(markup).toContain('>Diagnostic Evidence</h2>');
    expect(markup).toContain(
      'class="diagnostic-dialog__body" data-graph-scroll-container="true"',
    );
    expect(markup).toContain('Filter Evidence');
    expect(markup).toContain('Canonical Hierarchy');
    expect(markup).toContain('References');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('Compatibility Probes');
  });

  it('keeps successful persistence status visually hidden and exposes storage failures', () => {
    const successMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={storage}
      />,
    );
    const failureMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={{
          ...storage,
          getItem: () => {
            throw new Error('storage denied');
          },
        }}
      />,
    );

    expect(successMarkup).toContain(
      '<p class="visually-hidden" aria-live="polite" aria-atomic="true">View persistence is active for this stable workspace.</p>',
    );
    expect(successMarkup).not.toContain('class="graph-alert"');
    expect(failureMarkup).toContain('class="graph-alert" role="alert"');
    expect(failureMarkup).toContain('storage denied');
  });

  it('locks scrolling in maximized mode, exits on Escape, and restores scrolling on cleanup', () => {
    const listeners: Array<(event: KeyboardEvent) => void> = [];
    const bodyStyle = { overflow: 'scroll' };
    let exits = 0;
    const cleanup = activateMaximizedGraphMode(
      {
        bodyStyle,
        addKeydownListener: (listener) => listeners.push(listener),
        removeKeydownListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
      },
      () => {
        exits += 1;
      },
    );

    expect(bodyStyle.overflow).toBe('hidden');
    listeners[0]?.({ key: 'Enter' } as KeyboardEvent);
    expect(exits).toBe(0);
    listeners[0]?.({ key: 'Escape' } as KeyboardEvent);
    expect(exits).toBe(1);
    cleanup();
    expect(bodyStyle.overflow).toBe('scroll');
    expect(listeners).toHaveLength(0);
  });
});
