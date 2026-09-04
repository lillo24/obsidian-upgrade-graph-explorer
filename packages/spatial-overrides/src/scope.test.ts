import { describe, expect, it } from 'vitest';

import {
  folderDepth,
  folderScopeIncludesFolder,
  isFolderDescendantOf,
  normalizeExcludedSubtrees,
} from './scope';

describe('hierarchical folder scope', () => {
  it('uses segment-safe descendant and depth semantics', () => {
    expect(isFolderDescendantOf('Theory/A', 'Theory')).toBe(true);
    expect(isFolderDescendantOf('Theory-Old', 'Theory')).toBe(false);
    expect(isFolderDescendantOf('Theory', 'Theory')).toBe(false);
    expect(isFolderDescendantOf('Theory', '.')).toBe(true);
    expect(isFolderDescendantOf('.', '.')).toBe(false);
    expect(folderDepth('.')).toBe(0);
    expect(folderDepth('Theory/A')).toBe(2);
  });

  it('supports exact, subtree root-file, root-dot, and exclusions', () => {
    expect(
      folderScopeIncludesFolder('Theory', { kind: 'exact' }, 'Theory'),
    ).toBe(true);
    expect(
      folderScopeIncludesFolder('Theory', { kind: 'exact' }, 'Theory/A'),
    ).toBe(false);
    const scope = {
      kind: 'subtree',
      includeRootFiles: false,
      excludedSubtrees: ['Theory/Archive'],
    } as const;
    expect(folderScopeIncludesFolder('Theory', scope, 'Theory')).toBe(false);
    expect(folderScopeIncludesFolder('Theory', scope, 'Theory/Live')).toBe(
      true,
    );
    expect(
      folderScopeIncludesFolder('Theory', scope, 'Theory/Archive/Old'),
    ).toBe(false);
    expect(
      folderScopeIncludesFolder(
        '.',
        {
          kind: 'subtree',
          includeRootFiles: true,
          excludedSubtrees: ['Archive'],
        },
        '.',
      ),
    ).toBe(true);
  });

  it('sorts valid exclusions and rejects duplicates, redundancy, and outsiders', () => {
    expect(
      normalizeExcludedSubtrees('Theory', ['Theory/Z', 'Theory/A']),
    ).toEqual(['Theory/A', 'Theory/Z']);
    expect(() =>
      normalizeExcludedSubtrees('Theory', ['Theory/A', 'Theory/A']),
    ).toThrow('Duplicate');
    expect(() =>
      normalizeExcludedSubtrees('Theory', ['Theory/A', 'Theory/A/B']),
    ).toThrow('redundant');
    expect(() => normalizeExcludedSubtrees('Theory', ['Other'])).toThrow(
      'strict descendant',
    );
  });
});
