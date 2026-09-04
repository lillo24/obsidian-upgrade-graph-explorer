import { describe, expect, it } from 'vitest';

import {
  classifyFolderSpatialDraftScope,
  resolveFolderSpatialRules,
} from './resolution';
import type { FolderSpatialRule } from './types';

const parent: FolderSpatialRule = {
  folderKey: 'Theory',
  behavior: 'pull',
  scope: { kind: 'subtree', includeRootFiles: true, excludedSubtrees: [] },
  anchor: { x: 1, y: 0 },
  strength: 75,
};
const child: FolderSpatialRule = {
  folderKey: 'Theory/Language',
  behavior: 'place',
  scope: { kind: 'exact' },
  anchor: { x: -1, y: -1 },
};

describe('folder spatial rule resolution', () => {
  it('assigns each document to its most-specific winning rule', () => {
    const result = resolveFolderSpatialRules({
      rules: [parent, child],
      folderKeyByNodeKey: new Map([
        ['root', 'Theory'],
        ['other', 'Theory/Math'],
        ['child', 'Theory/Language'],
        ['outside', 'Elsewhere'],
      ]),
    });
    expect(result.pullGroups[0]?.memberNodeKeys).toEqual(['other', 'root']);
    expect(result.placeGroups[0]?.memberNodeKeys).toEqual(['child']);
    expect(result.winningRuleByNodeKey.get('child')).toBe(child);
    expect(result.winningRuleByNodeKey.has('outside')).toBe(false);
    expect([...result.membershipCountByRuleFolderKey]).toEqual([
      ['Theory', 2],
      ['Theory/Language', 1],
    ]);
  });

  it('keeps filtered or renamed-away rules inactive without deleting them', () => {
    const result = resolveFolderSpatialRules({
      rules: [parent, child],
      folderKeyByNodeKey: new Map([['outside', 'Elsewhere']]),
    });
    expect(result.inactiveRules).toEqual([
      { rule: parent, reason: 'no-visible-members' },
      { rule: child, reason: 'no-visible-members' },
    ]);
  });

  it('is independent of rule and node input order', () => {
    const folders = new Map([
      ['z', 'Theory/Language'],
      ['a', 'Theory/Math'],
    ]);
    const forward = resolveFolderSpatialRules({
      rules: [parent, child],
      folderKeyByNodeKey: folders,
    });
    const reverse = resolveFolderSpatialRules({
      rules: [child, parent],
      folderKeyByNodeKey: new Map([...folders].reverse()),
    });
    expect(reverse.pullGroups).toEqual(forward.pullGroups);
    expect(reverse.placeGroups).toEqual(forward.placeGroups);
  });

  it('classifies included, excluded, child-owned, and unrelated visible nodes', () => {
    const draft = {
      ...parent,
      scope: {
        kind: 'subtree' as const,
        includeRootFiles: false,
        excludedSubtrees: ['Theory/Archive'],
      },
    };
    const result = classifyFolderSpatialDraftScope({
      confirmedRules: [parent, child],
      draftRule: draft,
      folderKeyByNodeKey: new Map([
        ['root', 'Theory'],
        ['included', 'Theory/Math'],
        ['excluded', 'Theory/Archive/Old'],
        ['child', 'Theory/Language'],
        ['outside', 'Elsewhere'],
      ]),
    });
    expect([...result.stateByNodeKey]).toEqual([
      ['child', 'shadowed-by-child'],
      ['excluded', 'excluded-candidate'],
      ['included', 'active-member'],
      ['outside', 'outside-root'],
      ['root', 'excluded-candidate'],
    ]);
    expect(result.owningRuleFolderKeyByNodeKey.get('child')).toBe(
      'Theory/Language',
    );
  });
});
