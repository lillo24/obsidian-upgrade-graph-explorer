import { describe, expect, it } from 'vitest';
import { buildFocusSchematicSoftFolderDisplayTree } from '@icarus-graph-explorer/focus-schematic-layout';

import type { GraphFlowNode } from '../types';
import {
  focusSchematicFolderClusterGuides,
  hitTestFocusSchematicFolderGuideRegion,
} from './folder-cluster-guides';

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
    expect(child.label).toBe('B');
    expect(child.parentLabel).toBe('A');
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
    expect(inner.depth).toBe(4);
    expect(inner.depthStyle).toBe('3+');
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

  it('HT1-HT6 hits actual guide shapes with depth, area, and stable tie-breaks', () => {
    const displayTree = tree([
      { fileId: 'outer', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'A/B' },
      { fileId: 'b2', exactFolderKey: 'A/B' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('outer', 0, 0),
      node('b1', 160, 0),
      node('b2', 300, 0),
    ]);
    const child = guides.find(({ folderKey }) => folderKey === 'A/B')!;
    const overlapPoint = {
      x: child.x + child.width / 2,
      y: child.y + child.height / 2,
    };
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, overlapPoint)?.folderKey,
    ).toBe('A/B');
    const parent = guides.find(({ folderKey }) => folderKey === 'A')!;
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: parent.x + 30,
        y: parent.y + parent.height / 2,
      })?.folderKey,
    ).toBe('A');
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: child.x - 1,
        y: child.y - 1,
      }),
    ).not.toBe(child);
    expect(hitTestFocusSchematicFolderGuideRegion([], overlapPoint)).toBeNull();

    const sameDepth = [
      { ...child, folderKey: 'Z', area: child.area + 1 },
      { ...child, folderKey: 'A', area: child.area },
    ];
    expect(
      hitTestFocusSchematicFolderGuideRegion(sameDepth, overlapPoint)
        ?.folderKey,
    ).toBe('A');
    const sameArea = sameDepth.map((guide) => ({ ...guide, area: 1 }));
    expect(
      hitTestFocusSchematicFolderGuideRegion(sameArea, overlapPoint)?.folderKey,
    ).toBe('A');
  });

  it('HT1 respects a singleton rounded corner rather than its loose bounds', () => {
    const guides = focusSchematicFolderClusterGuides(
      tree([{ fileId: 'root', exactFolderKey: '.' }]),
      [node('root', 0, 0)],
    );
    const guide = guides[0]!;
    expect(guide.shape).toBe('singleton');
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: guide.x + guide.width / 2,
        y: guide.y + guide.height / 2,
      }),
    ).toBe(guide);
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: guide.x + 1,
        y: guide.y + 1,
      }),
    ).toBeNull();
  });

  it('HT4 chooses a displayed depth 3+ guide', () => {
    const displayTree = tree([
      { fileId: 'a', exactFolderKey: 'A' },
      { fileId: 'b', exactFolderKey: 'A/B' },
      { fileId: 'c', exactFolderKey: 'A/B/C' },
      { fileId: 'd1', exactFolderKey: 'A/B/C/D' },
      { fileId: 'd2', exactFolderKey: 'A/B/C/D' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('a', 0, 0),
      node('b', 160, 0),
      node('c', 320, 0),
      node('d1', 480, 0),
      node('d2', 640, 0),
    ]);
    const deepest = guides.find(({ folderKey }) => folderKey === 'A/B/C/D')!;
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: deepest.x + deepest.width / 2,
        y: deepest.y + deepest.height / 2,
      })?.folderKey,
    ).toBe('A/B/C/D');
  });

  it('HT5 resolves disconnected regions to the same folder target', () => {
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
    ]).filter(({ folderKey }) => folderKey === 'A');
    expect(guides).toHaveLength(2);
    for (const guide of guides)
      expect(
        hitTestFocusSchematicFolderGuideRegion(guides, {
          x: guide.x + guide.width / 2,
          y: guide.y + guide.height / 2,
        })?.folderKey,
      ).toBe('A');
  });
});
