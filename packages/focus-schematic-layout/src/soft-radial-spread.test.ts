import { describe, expect, it } from 'vitest';

import {
  buildEndpointFixture,
  type EndpointFixtureSpec,
} from './endpoint-fixtures';
import { validateFocusSchematicComputedLayout } from './endpoint-facing';
import {
  countFocusSchematicSoftRadialSpreadSafetyViolations,
  createFocusSchematicSoftCompoundBodies,
} from './soft-group-packing';
import { SOFT_CLUSTER_FIXTURES } from './soft-cluster-fixtures';
import { computeFocusSchematicSoftClusterLayoutAttempt } from './soft-clusters';
import {
  buildFocusSchematicSoftFolderDisplayTree,
  projectFocusSchematicSoftFolderGroupingTree,
} from './soft-folder-display';
import { measureFocusSchematicSoftNestedHierarchy } from './soft-nested-hierarchy-packing';
import { applyFocusSchematicSoftRadialSpread } from './soft-radial-spread';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';

const center = (rectangle: {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

function layoutFromSpec(spec: EndpointFixtureSpec, strength = 50) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength,
  });
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
  return { input, result: attempt.result, tree, evidence: attempt.evidence };
}

function baseLayout(id: string, strength = 50) {
  return layoutFromSpec(
    SOFT_CLUSTER_FIXTURES.find((fixture) => fixture.id === id)!,
    strength,
  );
}

function moduleCenter(
  result: ReturnType<typeof baseLayout>['result'],
  moduleId: string,
) {
  return center(
    result.candidate.modules.find((module) => module.moduleId === moduleId)!,
  );
}

function delta(
  before: ReturnType<typeof baseLayout>['result'],
  after: ReturnType<typeof baseLayout>['result'],
  moduleId: string,
) {
  const first = moduleCenter(before, moduleId);
  const second = moduleCenter(after, moduleId);
  return { x: second.x - first.x, y: second.y - first.y };
}

function expectNoModuleOverlaps(
  result: ReturnType<typeof baseLayout>['result'],
) {
  const modules = result.candidate.modules;
  for (let left = 0; left < modules.length; left += 1)
    for (let right = left + 1; right < modules.length; right += 1) {
      const a = modules[left]!;
      const b = modules[right]!;
      expect(
        a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y,
        `${a.moduleId} overlaps ${b.moduleId}`,
      ).toBe(false);
    }
}

describe('Soft folder-group radial post-layout spread', () => {
  it('proves SC14 safe over the continuous scale domain for both workspace-root modes', () => {
    const { input, result, tree } = baseLayout('SC14');
    const off = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    );
    const on = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
      { includeWorkspaceRootGroup: true },
    );
    expect(countFocusSchematicSoftRadialSpreadSafetyViolations(off)).toBe(0);
    expect(countFocusSchematicSoftRadialSpreadSafetyViolations(on)).toBe(0);
    expect(
      off
        .filter(({ folderKey }) => folderKey?.startsWith('folder-'))
        .map(({ folderKey, memberModuleIds }) => ({
          folderKey,
          memberModuleIds,
        })),
    ).toEqual([
      {
        folderKey: 'folder-0',
        memberModuleIds: ['Target1', 'Target4', 'Target7'],
      },
      { folderKey: 'folder-1', memberModuleIds: ['Target2', 'Target5'] },
      { folderKey: 'folder-2', memberModuleIds: ['Target3', 'Target6'] },
    ]);
  });

  it('keeps every SC14 group rigid and overlap-free at every integer slider value', () => {
    const { input, result, tree } = baseLayout('SC14');
    const bodies = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    );
    for (let spacing = 0; spacing <= 100; spacing += 1) {
      const spread = applyFocusSchematicSoftRadialSpread(
        input,
        result,
        spacing,
      );
      expect(validateFocusSchematicComputedLayout(input, spread).valid).toBe(
        true,
      );
      expectNoModuleOverlaps(spread);
      for (const body of bodies) {
        const first = delta(result, spread, body.memberModuleIds[0]!);
        for (const moduleId of body.memberModuleIds.slice(1)) {
          const current = delta(result, spread, moduleId);
          expect(current.x).toBeCloseTo(first.x, 9);
          expect(current.y).toBeCloseTo(first.y, 9);
        }
      }
    }
  }, 30_000);

  it('keeps 71/72/73 structurally identical and changes only smooth group translation', () => {
    const { input, result, tree } = baseLayout('SC14');
    const body = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    ).find(({ folderKey }) => folderKey === 'folder-0')!;
    const values = [71, 72, 73].map((spacing) =>
      applyFocusSchematicSoftRadialSpread(input, result, spacing),
    );
    const translations = values.map((value) =>
      delta(result, value, body.memberModuleIds[0]!),
    );
    expect(translations[1]!.x - translations[0]!.x).toBeCloseTo(
      translations[2]!.x - translations[1]!.x,
      8,
    );
    expect(translations[1]!.y - translations[0]!.y).toBeCloseTo(
      translations[2]!.y - translations[1]!.y,
      8,
    );
    for (const value of values) {
      expect(value.internalLayoutEvidence).toBe(result.internalLayoutEvidence);
      expect(value.endpointPlan).toBe(result.endpointPlan);
      expect(value.internalLanePlan).toBe(result.internalLanePlan);
    }
  });

  it('preserves the legitimate SC23 topology split while translating its folder rigidly', () => {
    const { input, result, tree } = baseLayout('SC23');
    const shared = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    ).find(({ folderKey }) => folderKey === 'shared')!;
    const beforeA = moduleCenter(result, 'SharedA');
    const beforeB = moduleCenter(result, 'SharedB');
    expect(
      Math.hypot(beforeB.x - beforeA.x, beforeB.y - beforeA.y),
    ).toBeGreaterThan(0);
    const spread = applyFocusSchematicSoftRadialSpread(input, result, 100);
    const afterA = moduleCenter(spread, 'SharedA');
    const afterB = moduleCenter(spread, 'SharedB');
    expect(afterB.x - afterA.x).toBeCloseTo(beforeB.x - beforeA.x, 9);
    expect(afterB.y - afterA.y).toBeCloseTo(beforeB.y - beforeA.y, 9);
    expect(shared.memberModuleIds).toEqual(['SharedA', 'SharedB']);
  });

  it('keeps Focus neutral while its former named-folder siblings spread rigidly', () => {
    const { input, result, tree } = baseLayout('SC27');
    const anchored = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    ).find(({ anchored: fixed }) => fixed)!;
    expect(anchored).toMatchObject({
      id: 'focus-anchor',
      kind: 'focus-anchor',
      folderKey: null,
      memberModuleIds: ['Focus'],
    });
    const named = createFocusSchematicSoftCompoundBodies(
      input,
      result.candidate,
      tree,
    ).find(({ memberModuleIds }) => memberModuleIds.includes('B'))!;
    expect(named.memberModuleIds).toEqual(['B', 'C']);
    const spread = applyFocusSchematicSoftRadialSpread(input, result, 100);
    expect(moduleCenter(spread, 'Focus')).toEqual(
      moduleCenter(result, 'Focus'),
    );
    expect(delta(result, spread, 'B')).toEqual(delta(result, spread, 'C'));
    expect(delta(result, spread, 'B')).not.toEqual({ x: 0, y: 0 });
  });

  it('keeps Workspace-root grouping presentation-only without grouping Focus', () => {
    const source = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC2')!;
    const fixture: EndpointFixtureSpec = {
      ...source,
      documents: source.documents.map((document) =>
        ['Focus', 'A1', 'A2'].includes(document.id)
          ? { ...document, path: `${document.id}.md` }
          : document,
      ),
    };
    const { input, result } = layoutFromSpec(fixture);
    const off = applyFocusSchematicSoftRadialSpread(input, result, 100);
    const on = applyFocusSchematicSoftRadialSpread(input, result, 100, {
      includeWorkspaceRootGroup: true,
    });
    expect(moduleCenter(on, 'Focus')).toEqual(moduleCenter(result, 'Focus'));
    expect(delta(result, on, 'A1').x).toBeCloseTo(delta(result, on, 'A2').x, 9);
    expect(delta(result, on, 'A1').y).toBeCloseTo(delta(result, on, 'A2').y, 9);
    expect(delta(result, on, 'A1')).not.toEqual({ x: 0, y: 0 });
    expect(
      off.candidate.modules.find((module) => module.moduleId === 'A1'),
    ).not.toEqual(
      result.candidate.modules.find((module) => module.moduleId === 'A1'),
    );
  });

  it('preserves the complete SC29 Nested hierarchy at every strength and integer spacing value', () => {
    for (const strength of [0, 25, 50, 75, 100]) {
      const { input, result, tree, evidence } = baseLayout('SC29', strength);
      const grouping = projectFocusSchematicSoftFolderGroupingTree(tree, {
        excludedFileIds: [input.model.rootModuleId],
      });
      const focusBefore = moduleCenter(result, 'Focus');
      expect(evidence.nestedHierarchy).toMatchObject({
        nestedParentContainmentViolationCount: 0,
        nestedFolderSplitViolationCount: 0,
        nestedGuideBlockerViolationCount: 0,
      });
      expect(evidence.coverage).toMatchObject({
        missingImmediateFolderGuideCount: 0,
        nestedAncestorCoverageViolationCount: 0,
      });
      for (let spacing = 0; spacing <= 100; spacing += 1) {
        const spread = applyFocusSchematicSoftRadialSpread(
          input,
          result,
          spacing,
        );
        expect(validateFocusSchematicComputedLayout(input, spread).valid).toBe(
          true,
        );
        expectNoModuleOverlaps(spread);
        expect(moduleCenter(spread, 'Focus')).toEqual(focusBefore);
        expect(
          measureFocusSchematicSoftNestedHierarchy(spread.candidate, grouping),
        ).toMatchObject({
          nestedParentContainmentViolationCount: 0,
          nestedFolderSplitViolationCount: 0,
          nestedGuideBlockerViolationCount: 0,
        });
      }
    }
  }, 30_000);

  it.each(['SC30', 'SC31'] as const)(
    '%s keeps the FIX6 hierarchy safe at every integer spacing value',
    (id) => {
      const { input, result, tree, evidence } = baseLayout(id);
      const grouping = projectFocusSchematicSoftFolderGroupingTree(tree, {
        excludedFileIds: [input.model.rootModuleId],
      });
      expect(evidence.nestedHierarchy).toMatchObject({
        postNestedNestedFolderSplitViolationCount: 0,
        postGroupNestedFolderSplitViolationCount: 0,
        nestedFolderSplitViolationCount: 0,
      });
      for (let spacing = 0; spacing <= 100; spacing += 1) {
        const spread = applyFocusSchematicSoftRadialSpread(
          input,
          result,
          spacing,
        );
        expect(validateFocusSchematicComputedLayout(input, spread).valid).toBe(
          true,
        );
        expectNoModuleOverlaps(spread);
        expect(
          measureFocusSchematicSoftNestedHierarchy(spread.candidate, grouping),
        ).toMatchObject({
          nestedParentContainmentViolationCount: 0,
          nestedFolderSplitViolationCount: 0,
          nestedGuideBlockerViolationCount: 0,
        });
      }
    },
    30_000,
  );
});
