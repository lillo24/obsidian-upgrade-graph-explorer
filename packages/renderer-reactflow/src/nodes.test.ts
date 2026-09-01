import { describe, expect, it } from 'vitest';

import { entityDisclosurePresentation } from './nodes';

describe('entity disclosure presentation', () => {
  it('describes a positive Expand action in terms of what it reveals', () => {
    expect(
      entityDisclosurePresentation({
        isExpanded: false,
        revealableDescendantCount: 3,
        title: 'Nested',
        visibleDescendantCount: 0,
      }),
    ).toEqual({
      action: 'expand',
      ariaLabel: 'Expand Nested; reveals 3 descendants',
      count: 3,
      symbol: '+',
    });
  });

  it('describes Collapse using the final visible descendant count', () => {
    expect(
      entityDisclosurePresentation({
        isExpanded: true,
        revealableDescendantCount: 0,
        title: 'Nested',
        visibleDescendantCount: 3,
      }),
    ).toEqual({
      action: 'collapse',
      ariaLabel: 'Collapse Nested; hides 3 visible descendants',
      count: 3,
      symbol: '−',
    });
  });

  it('suppresses zero-action controls even when disclosure intent survives', () => {
    expect(
      entityDisclosurePresentation({
        isExpanded: false,
        revealableDescendantCount: 0,
        title: 'Nested',
        visibleDescendantCount: 0,
      }),
    ).toBeNull();
  });
});
