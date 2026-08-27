import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import sampleReport from './sample-report.json';

describe('provenance-first graph explorer shell', () => {
  it('bundles a deterministic stable-identity sample for reload persistence QA', () => {
    expect(sampleReport.identity).toEqual({ stability: 'stable' });
    expect(
      sampleReport.snapshot.entities.every(({ id }) =>
        id.startsWith('stable:'),
      ),
    ).toBe(true);
  });

  it('renders the validated synthetic report, canonical find, filters, and inspector', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Graph Explorer');
    expect(markup).toContain('Load Diagnostic Report');
    expect(markup).toContain('Load Synthetic Sample');
    expect(markup).toContain('Canonical Hierarchy');
    expect(markup).toContain('Compatibility Probes');
    expect(markup).toContain('Nothing is uploaded');
    expect(markup).toContain('Knowledge Graph');
    expect(markup).toContain('Find Hidden Entities');
    expect(markup).toContain('Graph Filters');
    expect(markup).toContain('Provenance Inspector');
    expect(markup).toContain('no Markdown source text');
    expect(markup).toContain('Documents');
    expect(markup).toContain('Focus Selected');
  });
});
