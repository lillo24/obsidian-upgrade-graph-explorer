import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('structural graph explorer shell', () => {
  it('renders the validated synthetic report and projection controls', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Graph Explorer');
    expect(markup).toContain('Load Diagnostic Report');
    expect(markup).toContain('Load Synthetic Sample');
    expect(markup).toContain('Canonical Hierarchy');
    expect(markup).toContain('Compatibility Probes');
    expect(markup).toContain('Nothing is uploaded');
    expect(markup).toContain('Structural Graph');
    expect(markup).toContain('Documents');
    expect(markup).toContain('Focus Selected');
  });
});
