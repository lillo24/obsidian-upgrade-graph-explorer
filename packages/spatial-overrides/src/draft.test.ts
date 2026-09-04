import { describe, expect, it } from 'vitest';

import {
  createFolderSpatialRuleDraft,
  folderSpatialRuleDraftIsDirty,
  folderSpatialRuleDraftScope,
  folderSpatialRuleFromDraft,
  nearestExcludedFolder,
  setFolderSpatialDraftAnchor,
  setFolderSpatialDraftBehavior,
  setFolderSpatialDraftRootFiles,
  setFolderSpatialDraftScopePreset,
  setFolderSpatialDraftStrength,
  toggleFolderSpatialDraftSubtree,
} from './draft';

describe('folder spatial rule draft', () => {
  it('defaults an unruled folder to Dynamic pull, This folder, and strength 70', () => {
    const draft = createFolderSpatialRuleDraft({
      folderKey: 'Theory',
      defaultAnchor: { x: 0.25, y: -0.5 },
    });
    expect(folderSpatialRuleFromDraft(draft)).toEqual({
      folderKey: 'Theory',
      behavior: 'pull',
      scope: { kind: 'exact' },
      anchor: { x: 0.25, y: -0.5 },
      strength: 70,
    });
  });

  it('loads migrated Place/exact rules without changing their target', () => {
    const confirmed = {
      folderKey: 'Theory',
      behavior: 'place',
      scope: { kind: 'exact' },
      anchor: { x: -1, y: 0.75 },
    } as const;
    const draft = createFolderSpatialRuleDraft({
      folderKey: 'Theory',
      confirmedRule: confirmed,
      defaultAnchor: { x: 0, y: 0 },
    });
    expect(folderSpatialRuleFromDraft(draft)).toEqual(confirmed);
    expect(folderSpatialRuleDraftIsDirty(draft, confirmed)).toBe(false);
  });

  it('compares an unruled draft against its captured default target', () => {
    const draft = createFolderSpatialRuleDraft({
      folderKey: 'Theory',
      defaultAnchor: { x: 0.1, y: -0.2 },
    });
    const baseline = folderSpatialRuleFromDraft(draft);
    expect(folderSpatialRuleDraftIsDirty(draft, baseline)).toBe(false);
    expect(
      folderSpatialRuleDraftIsDirty(
        setFolderSpatialDraftAnchor(draft, { x: 0.3, y: -0.2 }),
        baseline,
      ),
    ).toBe(true);
  });

  it('restores the last Pull strength after Place and validates integer bounds', () => {
    const initial = setFolderSpatialDraftStrength(
      createFolderSpatialRuleDraft({
        folderKey: '.',
        defaultAnchor: { x: 0, y: 0 },
      }),
      83,
    );
    const placed = setFolderSpatialDraftBehavior(initial, 'place');
    expect(folderSpatialRuleFromDraft(placed)).not.toHaveProperty('strength');
    expect(setFolderSpatialDraftBehavior(placed, 'pull').strength).toBe(83);
    for (const invalid of [-1, 1.5, 101]) {
      expect(() => setFolderSpatialDraftStrength(initial, invalid)).toThrow(
        'integer',
      );
    }
  });

  it('maps presets exactly and preserves Custom choices while switching', () => {
    let draft = createFolderSpatialRuleDraft({
      folderKey: 'Theory',
      defaultAnchor: { x: 0, y: 0 },
    });
    draft = setFolderSpatialDraftRootFiles(draft, false);
    draft = toggleFolderSpatialDraftSubtree(draft, 'Theory/Archive');
    const custom = folderSpatialRuleDraftScope(draft);
    expect(custom).toEqual({
      kind: 'subtree',
      includeRootFiles: false,
      excludedSubtrees: ['Theory/Archive'],
    });
    expect(
      folderSpatialRuleDraftScope(
        setFolderSpatialDraftScopePreset(draft, 'subtree'),
      ),
    ).toEqual({
      kind: 'subtree',
      includeRootFiles: true,
      excludedSubtrees: [],
    });
    expect(
      folderSpatialRuleDraftScope(
        setFolderSpatialDraftScopePreset(
          setFolderSpatialDraftScopePreset(draft, 'exact'),
          'custom',
        ),
      ),
    ).toEqual(custom);
  });

  it('keeps exclusions minimal and reenables the nearest blocking ancestor', () => {
    let draft = createFolderSpatialRuleDraft({
      folderKey: 'Theory',
      defaultAnchor: { x: 0, y: 0 },
    });
    draft = toggleFolderSpatialDraftSubtree(draft, 'Theory/A/B');
    draft = toggleFolderSpatialDraftSubtree(draft, 'Theory/A');
    expect(draft.customScope.excludedSubtrees).toEqual(['Theory/A']);
    expect(nearestExcludedFolder(draft, 'Theory/A/B/C')).toBe('Theory/A');
    draft = toggleFolderSpatialDraftSubtree(draft, 'Theory/A/B/C');
    expect(draft.customScope.excludedSubtrees).toEqual([]);
  });
});
