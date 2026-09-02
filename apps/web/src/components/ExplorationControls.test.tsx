import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExplorationControls } from './ExplorationControls';

describe('Exploration controls', () => {
  it('renders accessible Scope and Layout groups', () => {
    const markup = renderToStaticMarkup(
      <ExplorationControls
        layout="hierarchy"
        onLayoutChange={() => undefined}
        onScopeChange={() => undefined}
        scope="focus"
        focusedRootLabel="Associated Value"
      />,
    );

    expect(markup).toContain('aria-label="Scope"');
    expect(markup).toContain('aria-label="Layout"');
    expect(markup).toContain('>Focused: Associated Value</span>');
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Focus</button>',
    );
    expect(markup).toContain(
      '<button aria-pressed="true" type="button">Hierarchy</button>',
    );
  });

  it('explains why Focus is disabled without a focusable selection', () => {
    const markup = renderToStaticMarkup(
      <ExplorationControls
        focusDisabledReason="Select a file first."
        layout="network"
        onLayoutChange={() => undefined}
        onScopeChange={() => undefined}
        scope="all"
      />,
    );

    expect(markup).toContain('disabled=""');
    expect(markup).toContain('title="Select a file first."');
    expect(markup).toContain('Select a file first.</span>');
  });
});
