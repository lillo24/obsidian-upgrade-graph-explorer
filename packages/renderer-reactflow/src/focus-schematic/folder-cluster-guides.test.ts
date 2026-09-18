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
  preCompressionFolders: folders,
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
  it('covers every named immediate File once while leaving workspace-root Files ungrouped', () => {
    const displayTree = tree([
      { fileId: 'root', exactFolderKey: '.' },
      { fileId: 'a1', exactFolderKey: 'A' },
      { fileId: 'a2', exactFolderKey: 'A' },
      { fileId: 'single', exactFolderKey: 'Deep/Named' },
    ]);
    const nodes = [
      node('root', -600, 0),
      node('a1', 0, 0),
      node('a2', 180, 0),
      node('single', 700, 0),
    ];
    const direct = focusSchematicFolderClusterGuides(displayTree, nodes, {
      directFoldersOnly: true,
    });
    expect(direct.filter(({ folderKey }) => folderKey === 'A')).toHaveLength(1);
    expect(
      direct.filter(({ folderKey }) => folderKey === 'Deep/Named'),
    ).toHaveLength(1);
    expect(
      direct.flatMap(({ memberModuleIds }) => memberModuleIds).sort(),
    ).toEqual(['a1', 'a2', 'single']);
    expect(
      direct.some(({ memberModuleIds }) => memberModuleIds.includes('root')),
    ).toBe(false);

    const nested = focusSchematicFolderClusterGuides(displayTree, nodes);
    expect(
      nested.find(({ folderKey }) => folderKey === 'Deep/Named'),
    ).toMatchObject({ shape: 'singleton', memberModuleIds: ['single'] });
  });

  it('D1-D3 renders named singleton Direct guides from pre-compression parents', () => {
    const chain = tree([{ fileId: 'only', exactFolderKey: 'A/B/C' }]);
    const chainGuides = focusSchematicFolderClusterGuides(
      chain,
      [node('only', 0, 0)],
      { directFoldersOnly: true },
    );
    expect(chainGuides).toHaveLength(1);
    expect(chainGuides[0]).toMatchObject({
      folderKey: 'A/B/C',
      label: 'C',
      shape: 'singleton',
      memberModuleIds: ['only'],
    });

    const parentAndChild = tree([
      { fileId: 'parent-file', exactFolderKey: 'Folder2' },
      { fileId: 'child-file', exactFolderKey: 'Folder2/Folder1' },
    ]);
    const guides = focusSchematicFolderClusterGuides(
      parentAndChild,
      [node('parent-file', 0, 0), node('child-file', 340, 0)],
      { directFoldersOnly: true },
    );
    expect(
      guides.map(({ folderKey, memberModuleIds }) => ({
        folderKey,
        memberModuleIds,
      })),
    ).toEqual([
      { folderKey: 'Folder2', memberModuleIds: ['parent-file'] },
      {
        folderKey: 'Folder2/Folder1',
        memberModuleIds: ['child-file'],
      },
    ]);
    expect(
      hitTestFocusSchematicFolderGuideRegion(guides, {
        x: guides[1]!.x + guides[1]!.width / 2,
        y: guides[1]!.y + guides[1]!.height / 2,
      })?.folderKey,
    ).toBe('Folder2/Folder1');
  });

  it('D4-D6 reflects promotion, flattening, and genuine root placement in Direct guides', () => {
    const promoted = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [{ fileId: 'promoted', exactFolderKey: 'A/B/C' }],
      intent: {
        fileParentOverrides: [
          { fileId: 'promoted', displayParentFolderKey: 'A/B' },
        ],
        flattenedFolderKeys: [],
      },
    });
    expect(
      focusSchematicFolderClusterGuides(promoted, [node('promoted', 0, 0)], {
        directFoldersOnly: true,
      })[0]?.folderKey,
    ).toBe('A/B');

    const flattened = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        { fileId: 'one', exactFolderKey: 'A/B' },
        { fileId: 'two', exactFolderKey: 'A/B' },
      ],
      intent: {
        fileParentOverrides: [],
        flattenedFolderKeys: ['A/B'],
      },
    });
    expect(
      focusSchematicFolderClusterGuides(
        flattened,
        [node('one', 0, 0), node('two', 140, 0)],
        { directFoldersOnly: true },
      )[0]?.folderKey,
    ).toBe('A');

    const root = tree([{ fileId: 'root-file', exactFolderKey: '.' }]);
    expect(
      focusSchematicFolderClusterGuides(root, [node('root-file', 0, 0)], {
        directFoldersOnly: true,
      }),
    ).toEqual([]);
    expect(
      focusSchematicFolderClusterGuides(root, [node('root-file', 0, 0)], {
        directFoldersOnly: true,
        includeWorkspaceRootGroup: true,
      })[0],
    ).toMatchObject({
      folderKey: '.',
      root: true,
      label: 'Workspace root',
    });
  });

  it('renders Direct-only guides from direct Files without ancestor wrappers or tree mutation', () => {
    const displayTree = tree([
      { fileId: 'outer-1', exactFolderKey: 'A' },
      { fileId: 'outer-2', exactFolderKey: 'A' },
      { fileId: 'inner-1', exactFolderKey: 'A/B' },
      { fileId: 'inner-2', exactFolderKey: 'A/B' },
    ]);
    const before = JSON.stringify(displayTree);
    const nodes = [
      node('outer-1', 0, 0),
      node('outer-2', 140, 0),
      node('inner-1', 320, 0),
      node('inner-2', 460, 0),
    ];
    const nested = focusSchematicFolderClusterGuides(displayTree, nodes);
    const direct = focusSchematicFolderClusterGuides(displayTree, nodes, {
      directFoldersOnly: true,
    });
    const nestedParent = nested.find(({ folderKey }) => folderKey === 'A')!;
    const directParent = direct.find(({ folderKey }) => folderKey === 'A')!;
    const directChild = direct.find(({ folderKey }) => folderKey === 'A/B')!;
    expect(nestedParent.memberModuleIds).toEqual([
      'inner-1',
      'inner-2',
      'outer-1',
      'outer-2',
    ]);
    expect(directParent.memberModuleIds).toEqual(['outer-1', 'outer-2']);
    expect(directChild.memberModuleIds).toEqual(['inner-1', 'inner-2']);
    expect(JSON.stringify(displayTree)).toBe(before);
    expect(focusSchematicFolderClusterGuides(displayTree, nodes)).toEqual(
      nested,
    );
    expect(
      hitTestFocusSchematicFolderGuideRegion(direct, {
        x: directChild.x + directChild.width / 2,
        y: directChild.y + directChild.height / 2,
      })?.folderKey,
    ).toBe('A/B');
  });

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

  it('L1 anchors a diagonal hull label to its actual upper horizontal segment', () => {
    const displayTree = tree([
      { fileId: 'lower-left', exactFolderKey: 'A' },
      { fileId: 'top-left', exactFolderKey: 'A' },
      { fileId: 'top-right', exactFolderKey: 'A' },
    ]);
    const [guide] = focusSchematicFolderClusterGuides(displayTree, [
      node('lower-left', -100, 180),
      node('top-left', 100, 0),
      node('top-right', 240, 0),
    ]);
    expect(guide?.shape).toBe('hull');
    expect(guide!.labelX).toBeGreaterThan(guide!.x + 150);
    expect(guide!.labelY).toBeCloseTo(guide!.y - 9, 8);
  });

  it('L2 accounts for rounded-corner trim on a rectangular capsule label', () => {
    const displayTree = tree([
      { fileId: 'left', exactFolderKey: 'A' },
      { fileId: 'right', exactFolderKey: 'A' },
    ]);
    const [guide] = focusSchematicFolderClusterGuides(displayTree, [
      node('left', 0, 0),
      node('right', 140, 0),
    ]);
    expect(guide?.shape).toBe('capsule');
    expect(guide!.labelX).toBeCloseTo(guide!.x + guide!.radius + 12, 8);
  });

  it('L3 retains the rectangle anchor fallback for a singleton guide', () => {
    const displayTree = tree([
      { fileId: 'only', exactFolderKey: 'NamedFolder' },
    ]);
    const [guide] = focusSchematicFolderClusterGuides(
      displayTree,
      [node('only', 40, 60)],
      { directFoldersOnly: true },
    );
    expect(guide?.shape).toBe('singleton');
    expect(guide!.labelX).toBe(guide!.x + 12);
    expect(guide!.labelY).toBe(guide!.y - 9);
  });

  it('L4 keeps rounded hull geometry and label anchors stable under input permutation', () => {
    const displayTree = tree([
      { fileId: 'a', exactFolderKey: 'A' },
      { fileId: 'b', exactFolderKey: 'A' },
      { fileId: 'c', exactFolderKey: 'A' },
    ]);
    const nodes = [node('a', -100, 180), node('b', 100, 0), node('c', 240, 0)];
    const first = focusSchematicFolderClusterGuides(displayTree, nodes);
    const second = focusSchematicFolderClusterGuides(
      displayTree,
      [...nodes].reverse(),
    );
    expect(second).toEqual(first);
  });

  it('L5 rejects a split immediate named folder instead of duplicating its label', () => {
    const displayTree = tree([
      { fileId: 'a1', exactFolderKey: 'A' },
      { fileId: 'a2', exactFolderKey: 'A' },
      { fileId: 'a3', exactFolderKey: 'A' },
      { fileId: 'a4', exactFolderKey: 'A' },
    ]);
    expect(() =>
      focusSchematicFolderClusterGuides(displayTree, [
        node('a1', 0, 0),
        node('a2', 140, 0),
        node('a3', 800, 120),
        node('a4', 940, 120),
      ]),
    ).toThrow('split immediate named folder "A"');
  });

  it('FOCUS1/FOCUS5 excludes Focus from immediate and ancestor guide membership', () => {
    const displayTree = tree([
      { fileId: 'focus', exactFolderKey: 'Pattern/Response' },
      { fileId: 'a', exactFolderKey: 'Pattern/Response' },
      { fileId: 'b', exactFolderKey: 'Pattern/Response' },
      { fileId: 'language', exactFolderKey: 'Pattern/Language' },
    ]);
    const nodes = [
      node('a', 0, 0),
      node('b', 140, 0),
      node('language', 280, 0),
      node('focus', 900, 500),
    ];
    const direct = focusSchematicFolderClusterGuides(displayTree, nodes, {
      directFoldersOnly: true,
      focusModuleId: 'focus',
    });
    const nested = focusSchematicFolderClusterGuides(displayTree, nodes, {
      focusModuleId: 'focus',
    });
    expect(
      direct.find(({ folderKey }) => folderKey === 'Pattern/Response')
        ?.memberModuleIds,
    ).toEqual(['a', 'b']);
    for (const guide of nested)
      expect(guide.memberModuleIds).not.toContain('focus');
    expect(
      nested.find(({ folderKey }) => folderKey === 'Pattern')?.memberModuleIds,
    ).toEqual(['a', 'b', 'language']);
  });

  it('FOCUS6 prunes a Focus-only folder from guide presentation', () => {
    expect(
      focusSchematicFolderClusterGuides(
        tree([{ fileId: 'focus', exactFolderKey: 'Only' }]),
        [node('focus', 0, 0)],
        { focusModuleId: 'focus' },
      ),
    ).toEqual([]);
  });

  it('N1/N2 constructs exact deep logical membership in Nested but only immediate membership in Direct', () => {
    const displayTree = tree([
      { fileId: 'focus', exactFolderKey: 'PatternTheory/ResponseBehaviour' },
      {
        fileId: 'god',
        exactFolderKey: 'PatternTheory/PatternInstances/GeneralPattern',
      },
      {
        fileId: 'relativity',
        exactFolderKey:
          'PatternTheory/PatternInstances/GeneralPattern/Philosophy',
      },
      {
        fileId: 'foundational',
        exactFolderKey: 'PatternTheory/PatternInstances/Underlying',
      },
      { fileId: 'language', exactFolderKey: 'PatternTheory/Language' },
      { fileId: 'symbols', exactFolderKey: 'PatternTheory/Language' },
      {
        fileId: 'emotions',
        exactFolderKey: 'PatternTheory/ResponseBehaviour',
      },
      {
        fileId: 'body',
        exactFolderKey: 'PatternTheory/ResponseBehaviour',
      },
      {
        fileId: 'rationale',
        exactFolderKey: 'PatternTheory/ResponseBehaviour',
      },
    ]);
    const nodes = [
      node('god', 0, 0),
      node('relativity', 150, 0),
      node('foundational', 330, 0),
      node('language', 0, 250),
      node('symbols', 150, 250),
      node('emotions', 330, 250),
      node('body', 480, 250),
      node('rationale', 630, 250),
      node('focus', 1200, 900),
    ];
    const nested = focusSchematicFolderClusterGuides(displayTree, nodes, {
      focusModuleId: 'focus',
    });
    const direct = focusSchematicFolderClusterGuides(displayTree, nodes, {
      directFoldersOnly: true,
      focusModuleId: 'focus',
    });
    const nestedMembers = (folderKey: string) =>
      nested.find((guide) => guide.folderKey === folderKey)?.memberModuleIds;
    expect(
      nestedMembers('PatternTheory/PatternInstances/GeneralPattern/Philosophy'),
    ).toEqual(['relativity']);
    expect(
      nestedMembers('PatternTheory/PatternInstances/GeneralPattern'),
    ).toEqual(['god', 'relativity']);
    expect(nestedMembers('PatternTheory/PatternInstances/Underlying')).toEqual([
      'foundational',
    ]);
    expect(nestedMembers('PatternTheory/PatternInstances')).toEqual([
      'foundational',
      'god',
      'relativity',
    ]);
    expect(nestedMembers('PatternTheory')).toEqual([
      'body',
      'emotions',
      'foundational',
      'god',
      'language',
      'rationale',
      'relativity',
      'symbols',
    ]);
    expect(
      direct.find(
        ({ folderKey }) =>
          folderKey === 'PatternTheory/PatternInstances/GeneralPattern',
      )?.memberModuleIds,
    ).toEqual(['god']);
    expect(direct.some(({ folderKey }) => folderKey === 'PatternTheory')).toBe(
      false,
    );
  });

  it('N8 always renders a Context-style named singleton in Direct and Nested', () => {
    const displayTree = tree([
      { fileId: 'context', exactFolderKey: 'Z/Theory/Neuroscience' },
    ]);
    const nodes = [node('context', 0, 0)];
    for (const directFoldersOnly of [true, false])
      expect(
        focusSchematicFolderClusterGuides(displayTree, nodes, {
          directFoldersOnly,
        }),
      ).toEqual([
        expect.objectContaining({
          folderKey: 'Z/Theory/Neuroscience',
          memberModuleIds: ['context'],
          regionCount: 1,
        }),
      ]);
  });

  it('LR3 rejects far same-folder islands that would hide direct identity', () => {
    const displayTree = tree([
      { fileId: 'a1', exactFolderKey: 'A' },
      { fileId: 'a2', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'B' },
      { fileId: 'b2', exactFolderKey: 'B' },
    ]);
    expect(() =>
      focusSchematicFolderClusterGuides(displayTree, [
        node('a1', 0, 0),
        node('b1', 260, 0),
        node('b2', 390, 0),
        node('a2', 680, 0),
      ]),
    ).toThrow('split immediate named folder "A"');
  });

  it('renders every retained Nested parent as one logical region', () => {
    const displayTree = manualTree([
      folder('.', null, 0, [], ['A'], ['one', 'two']),
      folder('A', '.', 1, [], ['A/B'], ['one', 'two']),
      folder('A/B', 'A', 2, ['one', 'two'], [], ['one', 'two']),
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('one', 0, 0),
      node('two', 150, 0),
    ]);
    expect(guides.map(({ folderKey }) => folderKey)).toEqual(['A', 'A/B']);
    expect(guides[0]).toMatchObject({
      memberModuleIds: ['one', 'two'],
      regionCount: 1,
    });
  });

  it('renders retained manual one-child chains without geometry suppression', () => {
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
    expect(guides.map(({ folderKey }) => folderKey)).toEqual([
      'A',
      'A/B',
      'A/B/C',
    ]);
    for (const guide of guides)
      expect(guide).toMatchObject({
        memberModuleIds: ['one', 'two'],
        regionCount: 1,
      });
  });

  it('fails explicitly when an unpacked retained parent remains spatially split', () => {
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
    expect(() =>
      focusSchematicFolderClusterGuides(displayTree, [
        node('principles-are-malleable', 0, 0),
        node('cure-companion', 140, 0),
        node('far-one', 760, 0),
        node('far-two', 900, 0),
      ]),
    ).toThrow('split Nested named folder "Integrating the ideas"');
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

  it('rejects a disconnected logical parent instead of dropping its far child', () => {
    const displayTree = tree([
      { fileId: 'b1', exactFolderKey: 'A/B' },
      { fileId: 'b2', exactFolderKey: 'A/B' },
      { fileId: 'c1', exactFolderKey: 'A/C' },
      { fileId: 'c2', exactFolderKey: 'A/C' },
      { fileId: 'd1', exactFolderKey: 'A/D' },
      { fileId: 'd2', exactFolderKey: 'A/D' },
    ]);
    expect(() =>
      focusSchematicFolderClusterGuides(displayTree, [
        node('b1', 0, 0),
        node('b2', 130, 0),
        node('c1', 300, 0),
        node('c2', 430, 0),
        node('d1', 900, 0),
        node('d2', 1030, 0),
      ]),
    ).toThrow('split Nested named folder "A"');
  });

  it('LR8 keeps a singleton immediate child guide and useful ancestor geometry', () => {
    const displayTree = manualTree([
      folder('.', null, 0, [], ['A'], ['outer', 'inner']),
      folder('A', '.', 1, ['outer'], ['A/B'], ['outer', 'inner']),
      folder('A/B', 'A', 2, ['inner'], [], ['inner']),
    ]);
    const guides = focusSchematicFolderClusterGuides(displayTree, [
      node('outer', 0, 0),
      node('inner', 150, 0),
    ]);
    expect(guides.map(({ folderKey }) => folderKey)).toEqual(['A', 'A/B']);
    expect(guides[0]).toMatchObject({
      directVisualUnitCount: 2,
      memberModuleIds: ['inner', 'outer'],
    });
    expect(guides[1]).toMatchObject({
      directVisualUnitCount: 1,
      memberModuleIds: ['inner'],
      shape: 'singleton',
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
      { includeWorkspaceRootGroup: true },
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

  it('HT5 rejects disconnected immediate regions before hit testing', () => {
    const displayTree = tree([
      { fileId: 'a1', exactFolderKey: 'A' },
      { fileId: 'a2', exactFolderKey: 'A' },
      { fileId: 'a3', exactFolderKey: 'A' },
      { fileId: 'a4', exactFolderKey: 'A' },
      { fileId: 'b1', exactFolderKey: 'B' },
      { fileId: 'b2', exactFolderKey: 'B' },
    ]);
    expect(() =>
      focusSchematicFolderClusterGuides(displayTree, [
        node('a1', 0, 0),
        node('a2', 130, 0),
        node('b1', 260, 0),
        node('b2', 390, 0),
        node('a3', 680, 0),
        node('a4', 810, 0),
      ]),
    ).toThrow('split immediate named folder "A"');
  });
});
