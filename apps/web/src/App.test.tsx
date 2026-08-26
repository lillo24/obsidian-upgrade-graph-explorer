import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('diagnostic explorer shell', () => {
  it('renders the validated synthetic report and local-only workflow', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Diagnostic Explorer');
    expect(markup).toContain('Load Diagnostic Report');
    expect(markup).toContain('Load Synthetic Sample');
    expect(markup).toContain('Canonical Hierarchy');
    expect(markup).toContain('Compatibility Probes');
    expect(markup).toContain('Nothing is uploaded');
    expect(markup).not.toContain('React Flow');
  });
});
