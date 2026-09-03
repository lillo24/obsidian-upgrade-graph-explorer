import { describe, expect, it } from 'vitest';
import {
  createNetworkExplorerFolders,
  flattenNetworkExplorerRows,
  revealNetworkExplorerNode,
} from './network-explorer-folders';
import type { NetworkExplorerNode } from './network-explorer-model';

function file(sourcePath: string, id = sourcePath): NetworkExplorerNode {
  return {
    id,
    sourcePath,
    entityId: id,
    name: sourcePath.split('/').at(-1)!,
    secondary: sourcePath,
    glyph: '▰',
    kindLabel: 'File',
    focusRoot: false,
    focusDistance: null,
  };
}

describe('projection-scoped source folders', () => {
  const nodes = [
    file('Main.md'),
    file('One/Two/Three/Four/A.md'),
    file('One/Two/B.md'),
    file('One/C.md'),
  ];
  const tree = createNetworkExplorerFolders(nodes);

  it('defaults folder depth 1/2 open and 3+ closed, without counting root', () => {
    const rows = flattenNetworkExplorerRows(tree, new Map());
    expect(
      rows
        .filter((row) => row.kind === 'folder')
        .map((row) => [row.folder.path, row.level, row.expanded]),
    ).toEqual([
      ['One', 1, true],
      ['One/Two', 2, true],
      ['One/Two/Three', 3, false],
    ]);
    expect(
      rows.some(
        (row) =>
          row.kind === 'node' &&
          row.node.sourcePath === 'Main.md' &&
          row.level === 1,
      ),
    ).toBe(true);
    expect(
      rows.some(
        (row) => row.kind === 'node' && row.node.sourcePath?.endsWith('A.md'),
      ),
    ).toBe(false);
    const opened = flattenNetworkExplorerRows(
      tree,
      new Map([['One/Two/Three', true]]),
    );
    expect(
      opened.find((row) => row.kind === 'folder' && row.folder.depth === 4),
    ).toMatchObject({ expanded: false });
  });

  it('preserves path-keyed user overrides through temporary projection removal', () => {
    const overrides = new Map([
      ['One', false],
      ['One/Two/Three', true],
    ]);
    expect(
      flattenNetworkExplorerRows(tree, overrides).map((row) => row.id),
    ).toEqual(['folder:One', 'node:Main.md']);
    expect(
      flattenNetworkExplorerRows(
        createNetworkExplorerFolders([file('Main.md')]),
        overrides,
      ),
    ).toHaveLength(1);
    expect(
      flattenNetworkExplorerRows(
        createNetworkExplorerFolders(nodes),
        overrides,
      ),
    ).toEqual(flattenNetworkExplorerRows(tree, overrides));
    expect([...overrides]).toEqual([
      ['One', false],
      ['One/Two/Three', true],
    ]);
  });

  it('opens only selected-node ancestors and keeps unrelated folder choices', () => {
    const model = {
      ...tree,
      nodeById: new Map(nodes.map((node) => [node.id, node])),
    };
    const state = new Map([
      ['One', false],
      ['Unrelated', false],
    ]);
    const revealed = revealNetworkExplorerNode(state, model, nodes[1]!.id);
    expect(revealed.get('One')).toBe(true);
    expect(revealed.get('One/Two/Three')).toBe(true);
    expect(revealed.get('One/Two/Three/Four')).toBe(true);
    expect(revealed.get('Unrelated')).toBe(false);
    expect(revealNetworkExplorerNode(revealed, model, nodes[1]!.id)).toBe(
      revealed,
    );
    expect(revealNetworkExplorerNode(state, model, 'missing')).toBe(state);
    expect(state.get('One')).toBe(false);
  });

  it('keeps diagnostics at root even when their raw target resembles a path', () => {
    const diagnostic: NetworkExplorerNode = {
      id: 'missing',
      name: 'Fake/folder/Missing',
      secondary: 'unresolved',
      glyph: '○',
      kindLabel: 'Diagnostic',
      focusRoot: false,
      focusDistance: null,
    };
    const tree = createNetworkExplorerFolders([diagnostic, file('Real/A.md')]);
    expect([...tree.folderByPath.keys()]).toEqual(['Real']);
    expect(flattenNetworkExplorerRows(tree, new Map()).at(-1)).toMatchObject({
      kind: 'node',
      node: diagnostic,
      level: 1,
      parentFolderId: undefined,
    });
  });

  it('traverses thousands of files and very deep folder paths iteratively', () => {
    const nodes = Array.from({ length: 5001 }, (_, index) =>
      file(`One/Two/File-${index}.md`),
    );
    const deepPath = `${Array.from({ length: 400 }, (_, i) => `Level-${i}`).join('/')}/Deep.md`;
    nodes.push(file(deepPath));
    const tree = createNetworkExplorerFolders(nodes);
    const allOpen = new Map(
      [...tree.folderByPath.keys()].map((path) => [path, true]),
    );
    const rows = flattenNetworkExplorerRows(tree, allOpen);
    expect(rows.filter((row) => row.kind === 'node')).toHaveLength(5002);
    expect(
      rows.some(
        (row) =>
          row.kind === 'node' &&
          row.node.sourcePath === deepPath &&
          row.level === 401,
      ),
    ).toBe(true);
  });
});
