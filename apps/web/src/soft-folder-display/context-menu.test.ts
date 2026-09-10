import { describe, expect, it } from 'vitest';
import { buildFocusSchematicSoftFolderDisplayTree } from '@icarus-graph-explorer/focus-schematic-layout';

import {
  applySoftFolderDisplayMenuAction,
  softFolderDisplayMenuItems,
} from './context-menu';

const visibleFiles = [
  { fileId: 'outer', exactFolderKey: 'A' },
  { fileId: 'move', exactFolderKey: 'A/B' },
  { fileId: 'stay', exactFolderKey: 'A/B' },
  { fileId: 'c1', exactFolderKey: 'A/C' },
  { fileId: 'c2', exactFolderKey: 'A/C' },
];

const ids = (
  items: ReturnType<typeof softFolderDisplayMenuItems>,
): readonly string[] =>
  items.map((item) => ('kind' in item ? 'separator' : item.id));

describe('Soft folder display context actions', () => {
  it('MC1-MC3 composes a File menu with one strong separator and its current folder actions', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    const items = softFolderDisplayMenuItems(tree, {
      kind: 'file',
      fileId: 'move',
    });
    expect(ids(items)).toEqual([
      'file:move-up',
      'file:restore-exact',
      'separator',
      'folder:flatten',
      'folder:flatten-siblings',
    ]);
    expect(items[2]).toEqual({ kind: 'separator', emphasis: 'strong' });
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'file', fileId: 'move' },
        'folder:flatten',
      ),
    ).toMatchObject({ value: { flattenedFolderKeys: ['A/B'] } });
  });

  it('MC4 targets a promoted File current displayed folder', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles,
      intent: {
        fileParentOverrides: [{ fileId: 'move', displayParentFolderKey: 'A' }],
        flattenedFolderKeys: [],
      },
    });
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'file', fileId: 'move' },
        'folder:flatten',
      ),
    ).toMatchObject({ value: { flattenedFolderKeys: ['A'] } });
  });

  it('MC5-MC6 omits folder actions and divider for top-level Files', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [{ fileId: 'top', exactFolderKey: '.' }],
    });
    expect(
      ids(softFolderDisplayMenuItems(tree, { kind: 'file', fileId: 'top' })),
    ).toEqual(['file:move-up', 'file:restore-exact']);
  });

  it('MC5 uses the surviving displayed parent after singleton compression', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        { fileId: 'outer', exactFolderKey: 'A' },
        { fileId: 'only', exactFolderKey: 'A/B/C' },
      ],
    });
    expect(
      tree.files.find(({ fileId }) => fileId === 'only')
        ?.displayParentFolderKey,
    ).toBe('A');
    expect(
      ids(
        softFolderDisplayMenuItems(tree, {
          kind: 'file',
          fileId: 'only',
        }),
      ),
    ).toContain('folder:flatten');
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'file', fileId: 'only' },
        'folder:flatten',
      ),
    ).toMatchObject({ value: { flattenedFolderKeys: ['A'] } });
  });

  it('FM1-FM3 folder targets receive folder actions only', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    expect(
      ids(
        softFolderDisplayMenuItems(tree, {
          kind: 'folder',
          folderKey: 'A/B',
        }),
      ),
    ).toEqual(['folder:flatten', 'folder:flatten-siblings', 'folder:reset']);
    expect(
      applySoftFolderDisplayMenuAction(
        tree,
        { kind: 'folder', folderKey: 'A/B' },
        'folder:flatten-siblings',
      ),
    ).toMatchObject({ value: { flattenedFolderKeys: ['A/B', 'A/C'] } });
  });

  it('FM4 preserves File promotion and exact restore', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    const result = applySoftFolderDisplayMenuAction(
      tree,
      { kind: 'file', fileId: 'move' },
      'file:move-up',
    );
    expect(result).toEqual({
      kind: 'intent',
      value: {
        fileParentOverrides: [{ fileId: 'move', displayParentFolderKey: 'A' }],
        flattenedFolderKeys: [],
      },
    });
    if (result.kind !== 'intent') throw new Error('Expected display intent.');
    const moved = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles,
      intent: result.value,
    });
    expect(
      applySoftFolderDisplayMenuAction(
        moved,
        { kind: 'file', fileId: 'move' },
        'file:restore-exact',
      ),
    ).toMatchObject({ value: { fileParentOverrides: [] } });
  });

  it('FM5 keeps disabled explanations on direct root actions', () => {
    const tree = buildFocusSchematicSoftFolderDisplayTree({ visibleFiles });
    const rootItems = softFolderDisplayMenuItems(tree, {
      kind: 'folder',
      folderKey: '.',
    });
    expect(
      rootItems
        .slice(0, 2)
        .every(
          (item) => !('kind' in item) && item.disabledReason !== undefined,
        ),
    ).toBe(true);
  });
});
