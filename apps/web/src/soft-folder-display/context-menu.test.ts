import { describe, expect, it } from 'vitest';
import { buildFocusSchematicSoftFolderDisplayTree } from '@icarus-graph-explorer/focus-schematic-layout';

import {
  applySoftFolderDisplayMenuAction,
  softFolderDisplayMenuActions,
} from './context-menu';

const visibleFiles = [
  { fileId: 'outer', exactFolderKey: 'A' },
  { fileId: 'move', exactFolderKey: 'A/B' },
  { fileId: 'stay', exactFolderKey: 'A/B' },
  { fileId: 'c1', exactFolderKey: 'A/C' },
  { fileId: 'c2', exactFolderKey: 'A/C' },
];

describe('Soft folder display context actions', () => {
  it('C8 moves one File one displayed level and offers exact restore', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    const actions = softFolderDisplayMenuActions(tree, {
      kind: 'file',
      fileId: 'move',
    });
    expect(actions.map(({ id }) => id)).toEqual([
      'move-file-up',
      'restore-file',
      'reset-display',
    ]);
    const result = applySoftFolderDisplayMenuAction(
      tree,
      { kind: 'file', fileId: 'move' },
      'move-file-up',
    );
    expect(result).toEqual({
      kind: 'intent',
      value: {
        fileParentOverrides: [{ fileId: 'move', displayParentFolderKey: 'A' }],
        flattenedFolderKeys: [],
      },
    });
  });

  it('C9 flattens only one layer or the current displayed siblings', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'folder', folderKey: 'A/B' },
        'flatten-folder',
      ),
    ).toMatchObject({
      value: { flattenedFolderKeys: ['A/B'] },
    });
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'folder', folderKey: 'A/B' },
        'flatten-siblings',
      ),
    ).toMatchObject({
      value: { flattenedFolderKeys: ['A/B', 'A/C'] },
    });
  });

  it('C12 disables root/exact actions and exposes reset after intent', () => {
    const exact = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    expect(
      softFolderDisplayMenuActions(exact, { kind: 'folder', folderKey: '.' })
        .slice(0, 2)
        .every(({ disabledReason }) => disabledReason !== undefined),
    ).toBe(true);
    expect(
      softFolderDisplayMenuActions(exact, {
        kind: 'file',
        fileId: 'move',
      }).find(({ id }) => id === 'restore-file')?.disabledReason,
    ).toBeDefined();
    const changed = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles,
      intent: {
        fileParentOverrides: [{ fileId: 'move', displayParentFolderKey: 'A' }],
        flattenedFolderKeys: [],
      },
    });
    expect(
      softFolderDisplayMenuActions(changed, {
        kind: 'file',
        fileId: 'move',
      }).find(({ id }) => id === 'reset-display')?.disabledReason,
    ).toBeUndefined();
  });
});
