import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('foundation status page', () => {
  it('states the implemented scope without promising graph features', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Icarus Graph Explorer');
    expect(markup).toContain('Canonical model v1 ready');
    expect(markup).toContain('graph rendering are deliberately deferred');
  });
});
