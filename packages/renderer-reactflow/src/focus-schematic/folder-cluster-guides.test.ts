import { describe, expect, it } from 'vitest';
import { buildFocusSchematicSoftFolderDisplayTree } from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';
import { focusSchematicFolderClusterGuides } from './folder-cluster-guides';

const node = (
  moduleId: string,
  x: number,
  y: number,
  width = 120,
  height = 80,
): GraphFlowNode =>
  ({
    id: `module-${moduleId}`,
    type: 'module',
    position: { x, y },
    width,
    height,
    measured: { width, height },
    data: { projectionNodeId: null, moduleId, root: false },
  }) as GraphFlowNode;

const tree = (
  files: readonly {
    readonly fileId: string;
    readonly exactFolderKey: string;
  }[],
) => buildFocusSchematicSoftFolderDisplayTree({ visibleFiles: files });

describe('nested Soft folder guides', () => {
  it('G1-G3 contains child guides inside labeled parents with direct Files', () => {
    const displayTree = tree([
      { fileId: 'outer', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'A/B' },
      { fileId: 'b2', exactFolderKey: 'A/B' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('outer', 0, 20),
      node('b1', 180, 0),
      node('b2', 320, 0),
    ]);
    const parent = guides.find(({ folderKey }) => folderKey === 'A')!;
    const child = guides.find(({ folderKey }) => folderKey === 'A/B')!;
    expect(parent.label).toBe('A');
    expect(child.label).toBe('A/B');
    expect(parent.memberModuleIds).toEqual(['b1', 'b2', 'outer']);
    expect(parent.x).toBeLessThanOrEqual(child.x);
    expect(parent.y).toBeLessThanOrEqual(child.y);
    expect(parent.x + parent.width).toBeGreaterThanOrEqual(
      child.x + child.width,
    );
    expect(parent.y + parent.height).toBeGreaterThanOrEqual(
      child.y + child.height,
    );
  });

  it('G4 splits truthful same-folder islands around another folder', () => {
    const displayTree = tree([
      { fileId: 'a1', exactFolderKey: 'A' },
      { fileId: 'a2', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'B' },
      { fileId: 'b2', exactFolderKey: 'B' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('a1', 0, 0),
      node('b1', 260, 0),
      node('b2', 390, 0),
      node('a2', 680, 0),
    ]);
    const a = guides.filter(({ folderKey }) => folderKey === 'A');
    expect(a).toHaveLength(2);
    expect(a.map(({ memberModuleIds }) => memberModuleIds)).toEqual([
      ['a1'],
      ['a2'],
    ]);
  });

  it('G5 grows deep nesting by fixed padding rather than exponentially', () => {
    const displayTree = tree([
      { fileId: 'a', exactFolderKey: 'A' },
      { fileId: 'b', exactFolderKey: 'A/B' },
      { fileId: 'c', exactFolderKey: 'A/B/C' },
      { fileId: 'd1', exactFolderKey: 'A/B/C/D' },
      { fileId: 'd2', exactFolderKey: 'A/B/C/D' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('a', 0, 0),
      node('b', 130, 0),
      node('c', 260, 0),
      node('d1', 390, 0),
      node('d2', 520, 0),
    ]);
    const outer = guides.find(({ folderKey }) => folderKey === 'A')!;
    const inner = guides.find(({ folderKey }) => folderKey === 'A/B/C/D')!;
    expect(outer.width - inner.width).toBeLessThanOrEqual(6 * 2 * 24 + 520);
  });

  it('G8 carries auto-compressed ancestry into the surviving guide context', () => {
    const displayTree = tree([
      { fileId: 'outer', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'A/B/C' },
      { fileId: 'b2', exactFolderKey: 'A/B/C' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('outer', 0, 0),
      node('b1', 160, 0),
      node('b2', 300, 0),
    ]);
    expect(
      guides.find(({ folderKey }) => folderKey === 'A/B/C')
        ?.suppressedAncestorFolderKeys,
    ).toContain('A/B');
  });

  it('G6 remains deterministic from renderer-only inputs', () => {
    const displayTree = tree([
      { fileId: 'a', exactFolderKey: 'A' },
      { fileId: 'b', exactFolderKey: 'A' },
    ]);
    const nodes = [node('a', 0, 0), node('b', 150, 0)];
    expect(focusSchematicFolderClusterGuides(displayTree, nodes)).toEqual(
      focusSchematicFolderClusterGuides(displayTree, nodes),
    );
  });
});
