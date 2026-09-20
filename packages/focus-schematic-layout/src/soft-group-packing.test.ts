import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import {
  countFocusSchematicSoftRadialSpreadSafetyViolations,
  createFocusSchematicSoftCompoundBodies,
  packFocusSchematicSoftFolderGroups,
  radialSpreadOverlapInterval,
  type FocusSchematicSoftCompoundBody,
} from './soft-group-packing';
import { SOFT_CLUSTER_FIXTURES } from './soft-cluster-fixtures';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  projectFocusSchematicSoftFolderGroupingTree,
} from './soft-folder-display';
import { measureFocusSchematicSoftNestedHierarchy } from './soft-nested-hierarchy-packing';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';

const point = (rectangle: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

function baseLayout(id: string) {
  const spec = SOFT_CLUSTER_FIXTURES.find((fixture) => fixture.id === id)!;
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input);
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  const policy =
    attempt.result.internalLayoutEvidence.softClusterPolicyEvidence!;
  const tree = buildFocusSchematicSoftFolderDisplayTree({
    visibleFiles: input.model.modules
      .filter(({ presentation }) => presentation !== 'filtered')
      .map(({ id: fileId, folderKey: exactFolderKey }) => ({
        fileId,
        exactFolderKey,
      })),
    intent: policy.displayIntent,
  });
  return { input, attempt, tree };
}

function intervalBody(
  id: string,
  centerX: number,
  rectangleX: number,
): FocusSchematicSoftCompoundBody {
  const rectangle = {
    moduleId: id,
    x: rectangleX,
    y: -20,
    width: 40,
    height: 40,
  };
  return {
    id,
    kind: 'named-folder',
    folderKey: id,
    memberModuleIds: [id],
    center: { x: centerX, y: 0 },
    rectangles: [rectangle],
    envelope: rectangle,
    anchored: false,
  };
}

describe('Soft structural folder-group packing', () => {
  it('finds the exact continuous interval where affine radial spread becomes unsafe', () => {
    const left = intervalBody('left', -100, 100);
    const right = intervalBody('right', 100, -100);
    const unsafe = radialSpreadOverlapInterval(
      left,
      left.rectangles[0]!,
      right,
      right.rectangles[0]!,
    );
    expect(unsafe).not.toBeNull();
    expect(unsafe!.minimumScale).toBeCloseTo(1.72, 8);
    expect(unsafe!.maximumScale).toBeCloseTo(2.28, 8);

    const safeRight = intervalBody('safe-right', 100, 260);
    expect(
      radialSpreadOverlapInterval(
        left,
        left.rectangles[0]!,
        safeRight,
        safeRight.rectangles[0]!,
      ),
    ).toBeNull();

    expect(
      radialSpreadOverlapInterval(
        { ...left, anchored: true },
        left.rectangles[0]!,
        right,
        right.rectangles[0]!,
      ),
    ).toBeNull();
  });

  it('packs deliberately colliding SC14 compounds rigidly and anchors Focus', () => {
    const { input, attempt, tree } = baseLayout('SC14');
    const beforeBodies = createFocusSchematicSoftCompoundBodies(
      input,
      attempt.result.candidate,
      tree,
    );
    const named = beforeBodies.filter(({ kind }) => kind === 'named-folder');
    const namedModuleIds = new Set(
      named.flatMap(({ memberModuleIds }) => memberModuleIds),
    );
    const translationByModule = new Map<string, { x: number; y: number }>();
    for (const body of named) {
      const delta = { x: 220 - body.center.x, y: -body.center.y };
      for (const moduleId of body.memberModuleIds)
        translationByModule.set(moduleId, delta);
    }
    const shifted = {
      ...attempt.result.candidate,
      modules: attempt.result.candidate.modules.map((module) => {
        const delta = translationByModule.get(module.moduleId);
        return delta === undefined
          ? module
          : { ...module, x: module.x + delta.x, y: module.y + delta.y };
      }),
      nodes: attempt.result.candidate.nodes.map((node) => {
        const delta = translationByModule.get(node.moduleId);
        return delta === undefined
          ? node
          : { ...node, x: node.x + delta.x, y: node.y + delta.y };
      }),
    };
    const shiftedBodies = createFocusSchematicSoftCompoundBodies(
      input,
      shifted,
      tree,
    );
    expect(
      countFocusSchematicSoftRadialSpreadSafetyViolations(shiftedBodies),
    ).toBeGreaterThan(0);

    const packed = packFocusSchematicSoftFolderGroups(input, shifted, tree);
    const finalBodies = createFocusSchematicSoftCompoundBodies(
      input,
      packed.candidate,
      tree,
    );
    expect(
      countFocusSchematicSoftRadialSpreadSafetyViolations(finalBodies),
    ).toBe(0);
    expect(packed.evidence.groupPackingCorrectionCount).toBeGreaterThan(0);
    expect(packed.evidence.radialSpreadSafetyViolationCount).toBe(0);

    const originalRoot = shifted.modules.find(
      ({ moduleId }) => moduleId === input.model.rootModuleId,
    );
    const packedRoot = packed.candidate.modules.find(
      ({ moduleId }) => moduleId === input.model.rootModuleId,
    );
    expect(packedRoot).toEqual(originalRoot);

    for (const before of shiftedBodies.filter(({ memberModuleIds }) =>
      memberModuleIds.some((moduleId) => namedModuleIds.has(moduleId)),
    )) {
      const after = finalBodies.find(({ id }) => id === before.id)!;
      const firstBefore = point(before.rectangles[0]!);
      const firstAfter = point(after.rectangles[0]!);
      for (let index = 1; index < before.rectangles.length; index += 1) {
        const memberBefore = point(before.rectangles[index]!);
        const memberAfter = point(after.rectangles[index]!);
        expect(memberAfter.x - firstAfter.x).toBeCloseTo(
          memberBefore.x - firstBefore.x,
          9,
        );
        expect(memberAfter.y - firstAfter.y).toBeCloseTo(
          memberBefore.y - firstBefore.y,
          9,
        );
      }
    }
  });

  it('preserves the legitimate SC23 same-folder topology split exactly', () => {
    const { input, attempt, tree } = baseLayout('SC23');
    const before = createFocusSchematicSoftCompoundBodies(
      input,
      attempt.result.candidate,
      tree,
    );
    const split = before.find(
      ({ kind, memberModuleIds }) =>
        kind === 'named-folder' && memberModuleIds.length > 1,
    )!;
    const first = point(split.rectangles[0]!);
    const second = point(split.rectangles[1]!);
    const separation = Math.hypot(second.x - first.x, second.y - first.y);
    expect(separation).toBeGreaterThan(0);

    const repeat = packFocusSchematicSoftFolderGroups(
      input,
      attempt.result.candidate,
      tree,
    );
    const after = createFocusSchematicSoftCompoundBodies(
      input,
      repeat.candidate,
      tree,
    ).find(({ id }) => id === split.id)!;
    const afterFirst = point(after.rectangles[0]!);
    const afterSecond = point(after.rectangles[1]!);
    expect(afterSecond.x - afterFirst.x).toBeCloseTo(second.x - first.x, 9);
    expect(afterSecond.y - afterFirst.y).toBeCloseTo(second.y - first.y, 9);
  });

  it('reports one anchored body and deterministic zero-violation evidence', () => {
    const { attempt } = baseLayout('SC14');
    expect(attempt.evidence.groupPacking).toMatchObject({
      anchoredGroupCount: 1,
      radialSpreadSafetyViolationCount: 0,
    });
    expect(attempt.evidence.preGroupMetrics.boundsArea).toBeGreaterThan(0);
    expect(attempt.evidence.metrics.boundsArea).toBeGreaterThan(0);
    expect(baseLayout('SC14').attempt.result.candidate).toEqual(
      attempt.result.candidate,
    );
  });

  it('partitions one Nested top-level subtree and translates every descendant rigidly', () => {
    const { input, attempt, tree: semanticTree } = baseLayout('SC29');
    const tree = projectFocusSchematicSoftFolderGroupingTree(semanticTree, {
      excludedFileIds: [input.model.rootModuleId],
    });
    const before = attempt.result.candidate;
    const bodies = createFocusSchematicSoftCompoundBodies(input, before, tree, {
      folderScopeMode: 'nested',
    });
    const named = bodies.filter(({ kind }) => kind === 'named-folder');
    const nonRootModuleIds = before.modules
      .map(({ moduleId }) => moduleId)
      .filter((moduleId) => moduleId !== input.model.rootModuleId)
      .sort();
    expect(named).toHaveLength(1);
    expect(named[0]!.memberModuleIds).toEqual(nonRootModuleIds);
    expect(bodies.some(({ kind }) => kind === 'ungrouped-module')).toBe(false);
    expect(
      new Set(bodies.flatMap(({ memberModuleIds }) => memberModuleIds)).size,
    ).toBe(before.modules.length);

    const namedIds = new Set(named[0]!.memberModuleIds);
    const root = before.modules.find(
      ({ moduleId }) => moduleId === input.model.rootModuleId,
    )!;
    const shifted = {
      ...before,
      modules: before.modules.map((module) =>
        namedIds.has(module.moduleId)
          ? {
              ...module,
              x: module.x - named[0]!.center.x,
              y: module.y - named[0]!.center.y,
            }
          : module,
      ),
      nodes: before.nodes.map((node) =>
        namedIds.has(node.moduleId)
          ? {
              ...node,
              x: node.x - named[0]!.center.x,
              y: node.y - named[0]!.center.y,
            }
          : node,
      ),
    };
    const packed = packFocusSchematicSoftFolderGroups(input, shifted, tree, {
      folderScopeMode: 'nested',
    });
    expect(
      packed.candidate.modules.find(
        ({ moduleId }) => moduleId === input.model.rootModuleId,
      ),
    ).toEqual(root);
    const translations = nonRootModuleIds.map((moduleId) => {
      const first = shifted.modules.find(
        (module) => module.moduleId === moduleId,
      )!;
      const second = packed.candidate.modules.find(
        (module) => module.moduleId === moduleId,
      )!;
      return { x: second.x - first.x, y: second.y - first.y };
    });
    for (const translation of translations.slice(1)) {
      expect(translation.x).toBeCloseTo(translations[0]!.x, 8);
      expect(translation.y).toBeCloseTo(translations[0]!.y, 8);
    }
    expect(
      measureFocusSchematicSoftNestedHierarchy(packed.candidate, tree),
    ).toMatchObject({
      nestedParentContainmentViolationCount: 0,
      nestedFolderSplitViolationCount: 0,
      nestedGuideBlockerViolationCount: 0,
    });
  });
});
