import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FocusOutline } from './FocusOutline';

describe('Focus Outline drawer', () => {
  it('renders accessible visibility controls and preserves hidden-by-parent meaning', () => {
    const markup = renderToStaticMarkup(
      <FocusOutline
        model={{
          documentEntityId: 'doc',
          sourcePath: 'Language.md',
          hiddenEntityIds: ['h1', 'h1-child'],
          rows: [
            {
              entityId: 'h1',
              title: 'Grammar',
              depth: 1,
              headingLevel: 1,
              status: 'hidden',
              explicitlyHidden: true,
            },
            {
              entityId: 'h1-child',
              title: 'Syntax',
              depth: 2,
              headingLevel: 2,
              status: 'hidden-by-ancestor',
              explicitlyHidden: true,
            },
            {
              entityId: 'h2',
              title: 'Semantics',
              depth: 1,
              headingLevel: 1,
              status: 'visible',
              explicitlyHidden: false,
            },
          ],
        }}
        onClose={() => undefined}
        onSetHeadingHidden={() => undefined}
        onShowAll={() => undefined}
      />,
    );
    expect(markup).toContain('aria-label="Focus Outline"');
    expect(markup).toContain('aria-label="Close Focus Outline"');
    expect(markup).toContain('aria-label="Show Heading Grammar"');
    expect(markup).toContain('aria-label="Heading Syntax is hidden by parent"');
    expect(markup).toContain('aria-label="Hide Heading Semantics"');
    expect(markup).toContain('Hidden by parent · also explicitly hidden');
    expect(markup).toContain('role="tree"');
    expect(markup).toContain('aria-level="2"');
    expect(markup).toContain('data-graph-history-shortcuts="off"');
    expect(markup).not.toContain('Block');
  });
});
