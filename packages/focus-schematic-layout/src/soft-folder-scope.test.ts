import { describe, expect, it } from 'vitest';

import {
  canonicalFocusSchematicSoftFolderScopeOverrides,
  groupFocusSchematicSoftFolders,
  promoteFocusSchematicSoftFolderGroup,
  promoteFocusSchematicSoftFolderGroupWithSiblings,
  reconcileFocusSchematicSoftFolderScopeOverrides,
  resetFocusSchematicSoftFolderGroup,
  resolveFocusSchematicSoftFolderGroup,
  validateFocusSchematicSoftFolderScopeOverrides,
} from './soft-folder-scope';

describe('Soft folder spatial scope', () => {
  const folders = [
    'Language',
    'Language/Grammar',
    'Language/Pragmatics',
    'Pattern Theory/A',
    'Pattern Theory/B',
  ];

  it('defaults to exact groups and canonicalizes sparse ancestor overrides', () => {
    expect(resolveFocusSchematicSoftFolderGroup('Language/Grammar', [])).toBe(
      'Language/Grammar',
    );
    expect(
      canonicalFocusSchematicSoftFolderScopeOverrides([
        {
          exactFolderKey: 'Pattern Theory/B',
          spatialGroupKey: 'Pattern Theory',
        },
        {
          exactFolderKey: 'Language/Pragmatics',
          spatialGroupKey: 'Language',
        },
      ]),
    ).toEqual([
      {
        exactFolderKey: 'Language/Pragmatics',
        spatialGroupKey: 'Language',
      },
      {
        exactFolderKey: 'Pattern Theory/B',
        spatialGroupKey: 'Pattern Theory',
      },
    ]);
  });

  it('rejects duplicates, identities, non-ancestors, malformed keys, and absolute paths', () => {
    const invalid = [
      [
        { exactFolderKey: 'A/B', spatialGroupKey: 'A' },
        { exactFolderKey: 'A/B', spatialGroupKey: '.' },
      ],
      [{ exactFolderKey: 'A/B', spatialGroupKey: 'A/B' }],
      [{ exactFolderKey: 'A/B', spatialGroupKey: 'C' }],
      [{ exactFolderKey: '/private/A', spatialGroupKey: '.' }],
      [{ exactFolderKey: 'A\\B', spatialGroupKey: '.' }],
    ];
    for (const value of invalid)
      expect(validateFocusSchematicSoftFolderScopeOverrides(value).valid).toBe(
        false,
      );
  });

  it('promotes only one effective group and naturally merges parent-direct Files', () => {
    const promoted = promoteFocusSchematicSoftFolderGroup(
      [],
      folders,
      'Language/Pragmatics',
    );
    expect(
      groupFocusSchematicSoftFolders(folders, promoted).find(
        ({ spatialGroupKey }) => spatialGroupKey === 'Language',
      ),
    ).toEqual({
      spatialGroupKey: 'Language',
      exactFolderKeys: ['Language', 'Language/Pragmatics'],
    });
    expect(
      resolveFocusSchematicSoftFolderGroup('Language/Grammar', promoted),
    ).toBe('Language/Grammar');
  });

  it('promotes siblings explicitly and supports repeated group promotion', () => {
    const siblings = promoteFocusSchematicSoftFolderGroupWithSiblings(
      [],
      folders,
      'Language/Pragmatics',
    );
    expect(
      siblings.filter(({ spatialGroupKey }) => spatialGroupKey === 'Language'),
    ).toEqual([
      { exactFolderKey: 'Language/Grammar', spatialGroupKey: 'Language' },
      { exactFolderKey: 'Language/Pragmatics', spatialGroupKey: 'Language' },
    ]);
    const root = promoteFocusSchematicSoftFolderGroup(
      siblings,
      folders,
      'Language',
    );
    expect(
      folders
        .filter((folder) => folder.startsWith('Language'))
        .map((folder) => resolveFocusSchematicSoftFolderGroup(folder, root)),
    ).toEqual(['.', '.', '.']);
  });

  it('supports mixed granularity and resets a merged group', () => {
    let overrides = promoteFocusSchematicSoftFolderGroupWithSiblings(
      [],
      folders,
      'Pattern Theory/A',
    );
    expect(groupFocusSchematicSoftFolders(folders, overrides)).toEqual([
      { spatialGroupKey: 'Language', exactFolderKeys: ['Language'] },
      {
        spatialGroupKey: 'Language/Grammar',
        exactFolderKeys: ['Language/Grammar'],
      },
      {
        spatialGroupKey: 'Language/Pragmatics',
        exactFolderKeys: ['Language/Pragmatics'],
      },
      {
        spatialGroupKey: 'Pattern Theory',
        exactFolderKeys: ['Pattern Theory/A', 'Pattern Theory/B'],
      },
    ]);
    overrides = resetFocusSchematicSoftFolderGroup(
      overrides,
      folders,
      'Pattern Theory',
    );
    expect(overrides).toEqual([]);
  });

  it('drops stale exact folders without migrating renamed identities', () => {
    expect(
      reconcileFocusSchematicSoftFolderScopeOverrides(
        [
          { exactFolderKey: 'Gone/Child', spatialGroupKey: 'Gone' },
          {
            exactFolderKey: 'Language/Grammar',
            spatialGroupKey: 'Language',
          },
        ],
        folders,
      ),
    ).toEqual([
      { exactFolderKey: 'Language/Grammar', spatialGroupKey: 'Language' },
    ]);
  });
});
