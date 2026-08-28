import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';

import { App } from './App';
import { GraphExplorer } from './components/GraphExplorer';
import { activateMaximizedGraphMode } from './components/maximized-graph-mode';
import sampleReport from './sample-report.json';

const validation = validateObsidianDiagnosticReport(sampleReport);
if (!validation.valid) throw new Error('The web sample report must be valid.');
const report = validation.value;
const storage = {
  getItem: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

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
    expect(markup).toContain('Search');
    expect(markup).toContain('Graph Filters');
    expect(markup).toContain('Documents');
    expect(markup).toContain('Focus Selected');
    expect(markup).toContain('Inspector');
    expect(markup).toContain('Maximize Graph');
    expect(markup).toContain(
      '<details class="diagnostic-evidence"><summary>Inspect diagnostic evidence</summary>',
    );
    expect(markup).not.toContain('Local-first · Read-only');
    expect(markup).not.toContain('KG9 · Durable Local View');
    expect(markup).not.toContain('<h2>Knowledge Graph</h2>');
    expect(markup).not.toContain('class="app-footer"');
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
    expect(maximizedMarkup).toContain(
      'graph-workspace graph-workspace--maximized',
    );
    expect(maximizedMarkup).toContain(
      'aria-pressed="true" type="button">Exit Maximize</button>',
    );
    expect(maximizedMarkup).toContain('Graph Filters');
    expect(maximizedMarkup).toContain('Focus Selected');
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
