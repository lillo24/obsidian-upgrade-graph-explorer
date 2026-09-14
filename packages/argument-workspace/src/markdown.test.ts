import { describe, expect, it } from 'vitest';

import { formatTheorySourceLocator } from './markdown';
import type { TheorySourceReference } from './types';

function source(
  values: Partial<TheorySourceReference> = {},
): TheorySourceReference {
  return {
    id: 'SRC-FORMAT',
    path: 'Theory/Note.md',
    label: 'Readable alias',
    role: 'basis',
    ...values,
  };
}

describe('theory source locator formatting', () => {
  it('preserves a complete authored wikilink without duplicating selectors', () => {
    expect(
      formatTheorySourceLocator(
        source({
          heading: 'Structured heading',
          originalWikilink: '[[Note#Authored heading|Authored alias]]',
        }),
      ),
    ).toBe('[[Note#Authored heading|Authored alias]]');
  });

  it('constructs heading and block fragments with a readable alias', () => {
    expect(
      formatTheorySourceLocator(
        source({ heading: 'Parent#Child', block: 'block-1' }),
      ),
    ).toBe('[[Theory/Note#Parent#Child#^block-1|Readable alias]]');
    expect(formatTheorySourceLocator(source({ block: 'block-2' }))).toBe(
      '[[Theory/Note#^block-2|Readable alias]]',
    );
  });
});
