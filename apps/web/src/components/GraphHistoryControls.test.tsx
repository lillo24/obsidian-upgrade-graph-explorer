import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GraphHistoryControls } from './GraphHistoryControls';

describe('graph history controls', () => {
  it('renders compact labeled arrows with native disabled state and shortcuts', () => {
    const markup = renderToStaticMarkup(
      <GraphHistoryControls
        canGoBack={false}
        canGoForward
        onBack={() => undefined}
        onForward={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Graph navigation history"');
    expect(markup).toContain('aria-label="Back in graph history" disabled=""');
    expect(markup).toContain('title="Back in graph history (Alt+Left)"');
    expect(markup).toContain('aria-label="Forward in graph history"');
    expect(markup).not.toContain(
      'aria-label="Forward in graph history" disabled=""',
    );
    expect(markup).toContain('title="Forward in graph history (Alt+Right)"');
    expect(markup).toContain('<span aria-hidden="true">←</span>');
    expect(markup).toContain('<span aria-hidden="true">→</span>');
  });
});
