import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import type { TauriSourceProvider } from '@icarus-graph-explorer/source-provider-tauri';

import { App } from './App';
import { GraphExplorer } from './components/GraphExplorer';
import { GraphSettings } from './components/GraphSettings';
import { activateMaximizedGraphMode } from './components/maximized-graph-mode';
import { GRAPH_PREFERENCES_STORAGE_KEY } from './preferences/graph-preferences';
import sampleReport from './sample-report.json';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('The web sample report must be valid.');
const report = validation.value;
const storage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};
const desktopProvider = {
  selectVaultDirectory: async () => undefined,
} as TauriSourceProvider;

describe('graph-first explorer shell', () => {
  it('bundles a deterministic stable-identity sample for reload persistence QA', () => {
    expect(sampleReport.identity).toEqual({ stability: 'stable' });
    expect(
      sampleReport.snapshot.entities.every(({ id }) =>
        id.startsWith('stable:'),
      ),
    ).toBe(true);
  });

  it('renders compact report controls and keeps diagnostics available without product milestone chrome', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Graph Explorer');
    expect(markup).toContain('Open Report');
    expect(markup).toContain('Sample');
    expect(markup).toContain('Synthetic Sample');
    expect(markup).toContain('Canonical Hierarchy');
    expect(markup).toContain('Compatibility Probes');
    expect(markup).toContain('Nothing is uploaded');
    expect(markup).not.toContain('Open Vault');
    expect(markup).toContain('Search');
    expect(markup).toContain('Graph Filters');
    expect(markup).toContain('Documents');
    expect(markup).toContain('Focus Selected');
    expect(markup).toContain('Inspector');
    expect(markup).toContain('aria-label="Fit graph to view"');
    expect(markup).toContain('aria-label="Maximize graph"');
    expect(markup).not.toContain('>Maximize Graph</button>');
    expect(markup).toContain(
      '<details class="diagnostic-evidence"><summary>Inspect diagnostic evidence</summary>',
    );
    expect(markup).not.toContain('Local-first · Read-only');
    expect(markup).not.toContain('KG9 · Durable Local View');
    expect(markup).not.toContain('<h2>Knowledge Graph</h2>');
    expect(markup).not.toContain('class="app-footer"');
  });

  it('shows live Open Vault only when a Tauri source provider is available', () => {
    const markup = renderToStaticMarkup(
      <App desktopSourceProvider={desktopProvider} />,
    );

    expect(markup).toContain('Open Vault');
    expect(markup).toContain('Open Report');
    expect(markup).toContain('Sample');
    expect(markup).toContain('Desktop vaults are read locally');
    expect(markup).not.toContain('Rescan Vault');
  });

  it('starts with the inspector closed and renders the maximized shell without replacing graph controls', () => {
    const normalMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized={false}
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={storage}
      />,
    );
    const maximizedMarkup = renderToStaticMarkup(
      <GraphExplorer
        identityStability="stable"
        maximized
        onMaximizedChange={() => undefined}
        snapshot={report.snapshot}
        storage={storage}
      />,
    );

    expect(normalMarkup).toContain(
      'aria-pressed="false" type="button">Inspector</button>',
    );
    expect(normalMarkup).toContain('aria-label="Heading limit"');
    expect(normalMarkup).toContain('value="" selected="">No limit</option>');
    expect(normalMarkup).toContain('<option value="1">#</option>');
    expect(normalMarkup).not.toContain('Provenance Inspector');
    expect(normalMarkup).not.toContain('graph-stage--inspector-open');
    expect(normalMarkup).toContain('aria-label="Fit graph to view"');
    expect(normalMarkup).toContain('aria-label="Open Settings"');
    expect(normalMarkup).toContain('data-trackpad-zoom-mode="scroll-zoom"');
    expect(normalMarkup).not.toContain('class="graph-floating-controls"');
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
    expect(maximizedMarkup).toContain(
      'aria-controls="graph-tools-panel" aria-expanded="false"',
    );
    expect(maximizedMarkup).toContain(
      'class="graph-tools-surface" hidden="" id="graph-tools-panel"',
    );
    expect(maximizedMarkup.match(/class="entity-search"/g)).toHaveLength(1);
    expect(maximizedMarkup).toContain('aria-label="Open Inspector"');
    expect(maximizedMarkup).toContain('Graph Filters');
    expect(maximizedMarkup).toContain('Focus Selected');
  });

  it('uses one shared settings UI and hydrates the global trackpad choice', () => {
    const settingsMarkup = renderToStaticMarkup(
      <GraphSettings
        onOpenChange={() => undefined}
        onTrackpadZoomModeChange={() => undefined}
        open
        trackpadZoomMode="pinch-zoom"
        warning="Preference is session-only."
      />,
    );
    expect(settingsMarkup).toContain('<legend>Trackpad zoom</legend>');
    expect(settingsMarkup).toContain('Scroll to zoom');
    expect(settingsMarkup).toContain('Pinch to zoom');
    expect(settingsMarkup).toContain(
      'type="radio" name="trackpad-zoom-mode" checked="" value="pinch-zoom"',
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
              ? '{"trackpadZoomMode":"pinch-zoom"}'
              : null,
        }}
      />,
    );
    expect(persistedMarkup).toContain('data-trackpad-zoom-mode="pinch-zoom"');
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
