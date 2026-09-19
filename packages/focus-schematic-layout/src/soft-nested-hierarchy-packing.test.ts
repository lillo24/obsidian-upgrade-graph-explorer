import { describe, expect, it } from 'vitest';

import type { FocusSchematicLayoutCandidate } from '@icarus-graph-explorer/focus-schematic';

import { applyFocusSchematicSoftFolderCohesion } from './soft-folder-cohesion';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  projectFocusSchematicSoftFolderGroupingTree,
} from './soft-folder-display';
import {
  applyFocusSchematicSoftNestedHierarchyPacking,
  measureFocusSchematicSoftFolderCoverage,
  measureFocusSchematicSoftNestedHierarchy,
} from './soft-nested-hierarchy-packing';

const ids = {
  focus: 'response/focus',
  god: 'general/god',
  relativity: 'philosophy/relativity',
  foundational: 'underlying/foundational',
  language: 'language/language',
  symbols: 'language/symbols',
  emotions: 'response/emotions',
  body: 'response/body',
  rationale: 'response/rationale',
} as const;

const files = [
  { fileId: ids.focus, exactFolderKey: 'PatternTheory/ResponseBehaviour' },
  {
    fileId: ids.god,
    exactFolderKey: 'PatternTheory/PatternInstances/GeneralPattern',
  },
  {
    fileId: ids.relativity,
    exactFolderKey: 'PatternTheory/PatternInstances/GeneralPattern/Philosophy',
  },
  {
    fileId: ids.foundational,
    exactFolderKey: 'PatternTheory/PatternInstances/Underlying',
  },
  { fileId: ids.language, exactFolderKey: 'PatternTheory/Language' },
  { fileId: ids.symbols, exactFolderKey: 'PatternTheory/Language' },
  {
    fileId: ids.emotions,
    exactFolderKey: 'PatternTheory/ResponseBehaviour',
  },
  { fileId: ids.body, exactFolderKey: 'PatternTheory/ResponseBehaviour' },
  {
    fileId: ids.rationale,
    exactFolderKey: 'PatternTheory/ResponseBehaviour',
  },
] as const;

function candidate(): FocusSchematicLayoutCandidate {
  const moduleIds = Object.values(ids);
  return {
    modelSchemaVersion: 1,
    rootModuleId: ids.focus,
    modules: moduleIds.map((moduleId, index) => ({
      moduleId,
      x: moduleId === ids.focus ? -60 : 500 + index * 420,
      y: moduleId === ids.focus ? -40 : (index % 3) * 360,
      width: 120,
      height: 80,
    })),
    nodes: moduleIds.map((moduleId, index) => ({
      projectionNodeId: `node:${moduleId}`,
      moduleId,
      x: moduleId === ids.focus ? -40 : 520 + index * 420,
      y: moduleId === ids.focus ? -20 : (index % 3) * 360 + 20,
      width: 80,
      height: 40,
    })),
    routes: [],
  };
}

function groupingTree() {
  const semantic = buildFocusSchematicSoftFolderDisplayTree({
    visibleFiles: files,
  });
  return {
    semantic,
    grouping: projectFocusSchematicSoftFolderGroupingTree(semantic, {
      excludedFileIds: [ids.focus],
    }),
  };
}

function members(folderKey: string) {
  const { grouping } = groupingTree();
  return grouping.folders.find((folder) => folder.folderKey === folderKey)
    ?.descendantFileIds;
}

function sparseNestedFixture(deep = false) {
  const sparseFiles = [
    { fileId: 'focus', exactFolderKey: 'Other' },
    { fileId: 'direct', exactFolderKey: deep ? 'Grand/Parent' : 'Parent' },
    {
      fileId: 'c1',
      exactFolderKey: deep ? 'Grand/Parent/Child' : 'Parent/Child',
    },
    {
      fileId: 'c2',
      exactFolderKey: deep ? 'Grand/Parent/Child' : 'Parent/Child',
    },
    {
      fileId: 'c3',
      exactFolderKey: deep ? 'Grand/Parent/Child' : 'Parent/Child',
    },
    ...(deep
      ? [
          { fileId: 's1', exactFolderKey: 'Grand/SiblingSubtree' },
          { fileId: 's2', exactFolderKey: 'Grand/SiblingSubtree' },
        ]
      : []),
  ];
  const rectangles = [
    { moduleId: 'focus', x: -1_000, y: 360, width: 120, height: 80 },
    { moduleId: 'direct', x: 0, y: 350, width: 100, height: 100 },
    { moduleId: 'c1', x: 172, y: 0, width: 200, height: 100 },
    { moduleId: 'c2', x: 488, y: 0, width: 100, height: 800 },
    { moduleId: 'c3', x: 172, y: 700, width: 200, height: 100 },
    ...(deep
      ? [
          { moduleId: 's1', x: 1_200, y: 300, width: 100, height: 100 },
          { moduleId: 's2', x: 1_200, y: 472, width: 100, height: 100 },
        ]
      : []),
  ];
  const semantic = buildFocusSchematicSoftFolderDisplayTree({
    visibleFiles: sparseFiles,
  });
  const grouping = projectFocusSchematicSoftFolderGroupingTree(semantic, {
    excludedFileIds: ['focus'],
  });
  const sparseCandidate: FocusSchematicLayoutCandidate = {
    modelSchemaVersion: 1,
    rootModuleId: 'focus',
    modules: rectangles,
    nodes: rectangles.map((rectangle) => ({
      projectionNodeId: `node:${rectangle.moduleId}`,
      moduleId: rectangle.moduleId,
      x: rectangle.x + 10,
      y: rectangle.y + 10,
      width: Math.max(20, rectangle.width - 20),
      height: Math.max(20, rectangle.height - 20),
    })),
    routes: [],
  };
  return { candidate: sparseCandidate, grouping };
}

describe('Focus-neutral nested Soft hierarchy packing', () => {
  it('N1/N4/N5 retains exact logical memberships and excludes Focus everywhere', () => {
    const { semantic, grouping } = groupingTree();
    expect(
      semantic.files.find(({ fileId }) => fileId === ids.focus)?.exactFolderKey,
    ).toBe('PatternTheory/ResponseBehaviour');
    expect(grouping.files.some(({ fileId }) => fileId === ids.focus)).toBe(
      false,
    );
    expect(
      members('PatternTheory/PatternInstances/GeneralPattern/Philosophy'),
    ).toEqual([ids.relativity]);
    expect(members('PatternTheory/PatternInstances/GeneralPattern')).toEqual([
      ids.god,
      ids.relativity,
    ]);
    expect(members('PatternTheory/PatternInstances/Underlying')).toEqual([
      ids.foundational,
    ]);
    expect(members('PatternTheory/PatternInstances')).toEqual(
      [ids.god, ids.relativity, ids.foundational].sort(),
    );
    expect(members('PatternTheory')).toEqual(
      Object.values(ids)
        .filter((id) => id !== ids.focus)
        .sort(),
    );
    for (const folder of grouping.folders)
      expect(folder.descendantFileIds).not.toContain(ids.focus);
  });

  it('N3/N6 packs rigid child subtrees into one blocker-free region and keeps Focus fixed', () => {
    const { grouping } = groupingTree();
    const before = candidate();
    const cohesive = applyFocusSchematicSoftFolderCohesion(
      before,
      grouping,
      ids.focus,
    ).candidate;
    const packed = applyFocusSchematicSoftNestedHierarchyPacking(
      cohesive,
      grouping,
    );
    expect(
      packed.candidate.modules.find(({ moduleId }) => moduleId === ids.focus),
    ).toEqual(before.modules.find(({ moduleId }) => moduleId === ids.focus));
    expect(packed.evidence).toMatchObject({
      nestedParentContainmentViolationCount: 0,
      nestedFolderSplitViolationCount: 0,
      nestedGuideBlockerViolationCount: 0,
    });
    expect(
      measureFocusSchematicSoftNestedHierarchy(packed.candidate, grouping),
    ).toMatchObject({
      nestedParentContainmentViolationCount: 0,
      nestedFolderSplitViolationCount: 0,
      nestedGuideBlockerViolationCount: 0,
    });
    for (const module of packed.candidate.modules) {
      const beforeModule = before.modules.find(
        ({ moduleId }) => moduleId === module.moduleId,
      )!;
      const beforeNode = before.nodes.find(
        ({ moduleId }) => moduleId === module.moduleId,
      )!;
      const afterNode = packed.candidate.nodes.find(
        ({ moduleId }) => moduleId === module.moduleId,
      )!;
      expect(afterNode.x - module.x).toBeCloseTo(
        beforeNode.x - beforeModule.x,
        9,
      );
      expect(afterNode.y - module.y).toBeCloseTo(
        beforeNode.y - beforeModule.y,
        9,
      );
    }
  });

  it.each([
    ['N17 sparse parent', false],
    ['N18 deep sparse parent and sibling subtree', true],
  ] as const)(
    '%s reproduces a blocker-free split and repairs it with rigid occupied geometry',
    (_label, deep) => {
      const fixture = sparseNestedFixture(deep);
      const before = measureFocusSchematicSoftNestedHierarchy(
        fixture.candidate,
        fixture.grouping,
      );
      expect(before).toMatchObject({
        nestedParentContainmentViolationCount: 0,
        nestedGuideBlockerViolationCount: 0,
      });
      expect(before.nestedFolderSplitViolationCount).toBeGreaterThan(0);
      expect(before.nestedFolderMaxRegionCount).toBeGreaterThan(1);
      expect(before.nestedClosestInterIslandGap).not.toBeNull();

      const childBefore = fixture.candidate.modules
        .filter(({ moduleId }) => /^c\d$/.test(moduleId))
        .map(({ moduleId, x, y }) => ({ moduleId, x, y }));
      const packed = applyFocusSchematicSoftNestedHierarchyPacking(
        fixture.candidate,
        fixture.grouping,
      );
      expect(packed.evidence).toMatchObject({
        postCohesionNestedFolderSplitViolationCount:
          before.nestedFolderSplitViolationCount,
        postNestedNestedFolderSplitViolationCount: 0,
        nestedFolderSplitViolationCount: 0,
        nestedGuideBlockerViolationCount: 0,
        nestedFirstSplitStage: 'post-cohesion',
      });
      expect(
        measureFocusSchematicSoftNestedHierarchy(
          packed.candidate,
          fixture.grouping,
        ),
      ).toMatchObject({
        nestedParentContainmentViolationCount: 0,
        nestedFolderSplitViolationCount: 0,
        nestedGuideBlockerViolationCount: 0,
        nestedFolderMaxRegionCount: 1,
      });
      const childAfter = packed.candidate.modules
        .filter(({ moduleId }) => /^c\d$/.test(moduleId))
        .map(({ moduleId, x, y }) => ({ moduleId, x, y }));
      const beforeOrigin = childBefore[0]!;
      const afterOrigin = childAfter[0]!;
      expect(
        childAfter.map(({ moduleId, x, y }) => ({
          moduleId,
          x: x - afterOrigin.x,
          y: y - afterOrigin.y,
        })),
      ).toEqual(
        childBefore.map(({ moduleId, x, y }) => ({
          moduleId,
          x: x - beforeOrigin.x,
          y: y - beforeOrigin.y,
        })),
      );
    },
  );

  it('N16 is deterministic under module and node input-order permutation', () => {
    const { grouping } = groupingTree();
    const original = candidate();
    const reversed: FocusSchematicLayoutCandidate = {
      ...original,
      modules: [...original.modules].reverse(),
      nodes: [...original.nodes].reverse(),
    };
    const pack = (value: FocusSchematicLayoutCandidate) =>
      applyFocusSchematicSoftNestedHierarchyPacking(
        applyFocusSchematicSoftFolderCohesion(value, grouping, ids.focus)
          .candidate,
        grouping,
      ).candidate;
    const normalize = (value: FocusSchematicLayoutCandidate) => ({
      modules: [...value.modules].sort((left, right) =>
        left.moduleId.localeCompare(right.moduleId),
      ),
      nodes: [...value.nodes].sort((left, right) =>
        left.projectionNodeId.localeCompare(right.projectionNodeId),
      ),
    });
    expect(normalize(pack(reversed))).toEqual(normalize(pack(original)));
  });

  it('N8-N10 audits named singleton coverage separately from root and filtered exemptions', () => {
    const semantic = buildFocusSchematicSoftFolderDisplayTree({
      visibleFiles: [
        { fileId: 'focus', exactFolderKey: 'Other' },
        { fileId: 'context', exactFolderKey: 'Z/Theory/Neuroscience' },
        { fileId: 'roadmap', exactFolderKey: '.' },
      ],
    });
    const grouping = projectFocusSchematicSoftFolderGroupingTree(semantic, {
      excludedFileIds: ['focus'],
    });
    expect(
      grouping.files.find(({ fileId }) => fileId === 'context'),
    ).toMatchObject({ directDisplayParentFolderKey: 'Z/Theory/Neuroscience' });
    expect(
      measureFocusSchematicSoftFolderCoverage(grouping, {
        focusExemptFileCount: 1,
        filteredBridgeExemptFileCount: 1,
        nested: true,
      }),
    ).toEqual({
      groupableVisibleFileCount: 1,
      workspaceRootExemptFileCount: 1,
      focusExemptFileCount: 1,
      filteredBridgeExemptFileCount: 1,
      immediateFolderCoveredFileCount: 1,
      missingImmediateFolderGuideCount: 0,
      nestedAncestorCoverageViolationCount: 0,
    });
  });
});
