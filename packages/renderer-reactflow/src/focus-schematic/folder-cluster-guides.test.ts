import { describe, expect, it } from 'vitest';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  type FocusSchematicSoftFolderDisplayNode,
  type FocusSchematicSoftFolderDisplayTree,
} from '@icarus-graph-explorer/focus-schematic-layout';

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

const manualTree = (
  folders: readonly FocusSchematicSoftFolderDisplayNode[],
): FocusSchematicSoftFolderDisplayTree => ({
  rootFolderKey: '.',
  folders,
  files: [],
  reconciledIntent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  automaticallyCompressedFolderKeys: [],
});

const folder = (
  folderKey: string,
  displayParentFolderKey: string | null,
  displayDepth: number,
  directFileIds: readonly string[],
  childFolderKeys: readonly string[],
  descendantFileIds: readonly string[],
): FocusSchematicSoftFolderDisplayNode => ({
  folderKey,
  displayParentFolderKey,
  displayDepth,
  directFileIds,
  childFolderKeys,
  descendantFileIds,
  suppressedAncestorFolderKeys: [],
  provenance: ['exact'],
});

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

  it('LR3 suppresses far same-folder islands that each contain one File', () => {
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
    expect(guides.filter(({ folderKey }) => folderKey === 'A')).toEqual([]);
  });

  it('LR1 suppresses a parent region around one useful child guide', () => {
    const displayTree = manualTree([
      folder('.', null, 0, [], ['A'], ['one', 'two']),
      folder('A', '.', 1, [], ['A/B'], ['one', 'two']),
      folder('A/B', 'A', 2, ['one', 'two'], [], ['one', 'two']),
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('one', 0, 0),
      node('two', 150, 0),
    ]);
    expect(guides.map(({ folderKey }) => folderKey)).toEqual(['A/B']);
    expect(guides[0]?.suppressedAncestorFolderKeys).toEqual(['A']);
  });

  it('LR6 recursively suppresses local one-child guide chains', () => {
    const displayTree = manualTree([
      folder('.', null, 0, [], ['A'], ['one', 'two']),
      folder('A', '.', 1, [], ['A/B'], ['one', 'two']),
      folder('A/B', 'A', 2, [], ['A/B/C'], ['one', 'two']),
      folder('A/B/C', 'A/B', 3, ['one', 'two'], [], ['one', 'two']),
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('one', 0, 0),
      node('two', 150, 0),
    ]);
    expect(guides.map(({ folderKey }) => folderKey)).toEqual(['A/B/C']);
    expect(guides[0]).toMatchObject({
      directVisualUnitCount: 2,
      suppressedAncestorFolderKeys: ['A', 'A/B'],
    });
  });

  it('LR2/LR9 regresses the screenshot wrapper and hit-tests only the surviving child', () => {
    const displayTree = tree([
      {
        fileId: 'principles-are-malleable',
        exactFolderKey: 'Integrating the ideas/Cure Framework',
      },
      {
        fileId: 'cure-companion',
        exactFolderKey: 'Integrating the ideas/Cure Framework',
      },
      {
        fileId: 'far-one',
        exactFolderKey: 'Integrating the ideas/Other',
      },
      {
        fileId: 'far-two',
        exactFolderKey: 'Integrating the ideas/Other',
      },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('principles-are-malleable', 0, 0),
      node('cure-companion', 140, 0),
      node('far-one', 760, 0),
      node('far-two', 900, 0),
    ]);
    expect(
      guides.filter(({ folderKey }) => folderKey === 'Integrating the ideas'),
    ).toEqual([]);
    const cure = guides.find(
      ({ folderKey }) => folderKey === 'Integrating the ideas/Cure Framework',
    )!;
    expect(cure).toMatchObject({
      memberModuleIds: ['cure-companion', 'principles-are-malleable'],
      suppressedAncestorFolderKeys: ['Integrating the ideas'],
    });
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: cure.x + cure.width / 2,
        y: cure.y + cure.height / 2,
      })?.folderKey,
    ).toBe('Integrating the ideas/Cure Framework');
  });

  it('LR4 keeps a parent that locally groups one File and one child guide', () => {
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
    expect(guides.find(({ folderKey }) => folderKey === 'A')).toMatchObject({
      directVisualUnitCount: 2,
    });
    expect(guides.map(({ folderKey }) => folderKey)).toContain('A/B');
  });

  it('LR5 keeps a parent that locally groups two child guides', () => {
    const displayTree = tree([
      { fileId: 'b1', exactFolderKey: 'A/B' },
      { fileId: 'b2', exactFolderKey: 'A/B' },
      { fileId: 'c1', exactFolderKey: 'A/C' },
      { fileId: 'c2', exactFolderKey: 'A/C' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('b1', 0, 0),
      node('b2', 130, 0),
      node('c1', 300, 0),
      node('c2', 430, 0),
    ]);
    expect(guides.find(({ folderKey }) => folderKey === 'A')).toMatchObject({
      directVisualUnitCount: 2,
    });
  });

  it('LR7/LR10 keeps only a useful mixed island deterministically', () => {
    const displayTree = tree([
      { fileId: 'b1', exactFolderKey: 'A/B' },
      { fileId: 'b2', exactFolderKey: 'A/B' },
      { fileId: 'c1', exactFolderKey: 'A/C' },
      { fileId: 'c2', exactFolderKey: 'A/C' },
      { fileId: 'd1', exactFolderKey: 'A/D' },
      { fileId: 'd2', exactFolderKey: 'A/D' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('b1', 0, 0),
      node('b2', 130, 0),
      node('c1', 300, 0),
      node('c2', 430, 0),
      node('d1', 900, 0),
      node('d2', 1030, 0),
    ]);
    const parent = guides.filter(({ folderKey }) => folderKey === 'A');
    expect(parent).toHaveLength(1);
    expect(parent[0]).toMatchObject({
      directVisualUnitCount: 2,
      memberModuleIds: ['b1', 'b2', 'c1', 'c2'],
      regionIndex: 0,
      regionCount: 1,
    });
    expect(
      guides.find(({ folderKey }) => folderKey === 'A/D')
        ?.suppressedAncestorFolderKeys,
    ).toContain('A');
    expect(
      focusSchematicFolderClusterGuides(displayTree, [
        node('b1', 0, 0),
        node('b2', 130, 0),
        node('c1', 300, 0),
        node('c2', 430, 0),
        node('d1', 900, 0),
        node('d2', 1030, 0),
      ]),
    ).toEqual(guides);
  });

  it('LR8 passes a suppressed child File unit into useful ancestor geometry', () => {
    const displayTree = manualTree([
      folder('.', null, 0, [], ['A'], ['outer', 'inner']),
      folder('A', '.', 1, ['outer'], ['A/B'], ['outer', 'inner']),
      folder('A/B', 'A', 2, ['inner'], [], ['inner']),
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('outer', 0, 0),
      node('inner', 150, 0),
    ]);
    expect(guides.map(({ folderKey }) => folderKey)).toEqual(['A']);
    expect(guides[0]).toMatchObject({
      directVisualUnitCount: 2,
      memberModuleIds: ['inner', 'outer'],
    });
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
      { fileId: 'a3', exactFolderKey: 'A' },
      { fileId: 'a4', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'B' },
      { fileId: 'b2', exactFolderKey: 'B' },
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('a1', 0, 0),
      node('a2', 130, 0),
      node('b1', 260, 0),
      node('b2', 390, 0),
      node('a3', 680, 0),
      node('a4', 810, 0),
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
