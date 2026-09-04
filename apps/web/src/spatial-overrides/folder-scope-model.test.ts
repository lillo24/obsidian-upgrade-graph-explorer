import { describe, expect, it } from 'vitest';

import {
  createFolderScopeTree,
  findFolderScopeTreeNode,
} from './folder-scope-model';

describe('full-workspace spatial folder scope tree', () => {
  it('keeps query-hidden, root-file, folder-only, and deeply nested folders authorable', () => {
    const paths = [
      'root.md',
      'Theory/visible.md',
      'Theory/Hidden/deep.md',
      'Theory/FolderOnly/Child/file.md',
    ];
    const tree = createFolderScopeTree({
      documentPaths: paths,
      visibleDocumentPaths: new Set(['Theory/visible.md']),
      rules: [],
    });
    expect(tree.directFileCount).toBe(1);
    expect(tree.totalFileCount).toBe(4);
    expect(tree.visibleFileCount).toBe(1);
    expect(findFolderScopeTreeNode(tree, 'Theory/Hidden')).toMatchObject({
      totalFileCount: 1,
      visibleFileCount: 0,
    });
    expect(findFolderScopeTreeNode(tree, 'Theory/FolderOnly')).toMatchObject({
      directFileCount: 0,
      totalFileCount: 1,
    });
  });

  it('scales iteratively through more than one hundred sibling folders', () => {
    const paths = Array.from(
      { length: 120 },
      (_, index) =>
        `Collection/Folder-${String(index).padStart(3, '0')}/file.md`,
    );
    const tree = createFolderScopeTree({
      documentPaths: paths,
      visibleDocumentPaths: new Set(paths.slice(0, 4)),
      rules: [],
    });
    const collection = findFolderScopeTreeNode(tree, 'Collection');
    expect(collection?.children).toHaveLength(120);
    expect(collection?.visibleFileCount).toBe(4);
  });

  it('builds and freezes a deep folder chain without recursive traversal', () => {
    const sourcePath = `${Array.from({ length: 180 }, (_, index) => `D${index}`).join('/')}/file.md`;
    const tree = createFolderScopeTree({
      documentPaths: [sourcePath],
      visibleDocumentPaths: new Set(),
      rules: [],
    });
    let current = tree;
    for (let depth = 0; depth < 180; depth += 1) {
      expect(current.children).toHaveLength(1);
      current = current.children[0]!;
      expect(Object.isFrozen(current)).toBe(true);
    }
  });
});
