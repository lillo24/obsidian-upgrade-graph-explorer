import { describe, expect, it } from 'vitest';

import {
  buildEndpointFixture,
  type EndpointFixtureSpec,
} from './endpoint-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { NESTED_DIRECTIONAL_FOLDER_FIXTURES } from './directional-folder-hierarchy-fixtures';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import { FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION } from './worker-protocol';
import { handleFocusSchematicLayoutWorkerRequest } from './worker-runtime';

function spec(id: `ND${number}`): EndpointFixtureSpec {
  const value = NESTED_DIRECTIONAL_FOLDER_FIXTURES.find(
    (fixture) => fixture.id === id,
  );
  if (value === undefined) throw new Error(`Missing ${id}.`);
  return value;
}

function run(
  id: `ND${number}`,
  hierarchy: 'flat' | 'nested-one-level' = 'nested-one-level',
  fixture: EndpointFixtureSpec = spec(id),
) {
  const input = layoutInput(buildEndpointFixture(fixture), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: true,
    directionalFolderHierarchy: hierarchy,
  });
  const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
    endpointOrderPolicy: 'crossing-optimized',
    internalLayoutVariant: 'adaptive-compass',
  });
  if (attempt.status !== 'success') throw new Error(`${id}: ${attempt.reason}`);
  return { input, result: attempt.result };
}

function hierarchy(id: `ND${number}`) {
  const result = run(id).result;
  if (result.folderBandPlan.hierarchy === undefined)
    throw new Error(`${id} did not produce a nested hierarchy.`);
  return { result, plan: result.folderBandPlan.hierarchy };
}

function parentFor(id: `ND${number}`, folderKey: string) {
  const value = hierarchy(id);
  const parent = value.plan.parentContainers.find(
    (candidate) => candidate.folderKey === folderKey,
  );
  if (parent === undefined)
    throw new Error(`${id} has no parent ${folderKey}.`);
  return { ...value, parent };
}

function expectContained(id: `ND${number}`) {
  const { result, plan } = hierarchy(id);
  const modules = new Map(
    result.candidate.modules.map((module) => [module.moduleId, module]),
  );
  const top = new Map(plan.topLevelUnits.map((unit) => [unit.id, unit]));
  const internals = new Map(plan.internalUnits.map((unit) => [unit.id, unit]));
  const parents = new Map(
    plan.parentContainers.map((parent) => [parent.id, parent]),
  );
  for (const placement of plan.modulePlacements) {
    const module = modules.get(placement.moduleId)!;
    const owner =
      internals.get(placement.displayUnitId) ??
      top.get(placement.displayUnitId)!;
    expect(module.y, placement.moduleId).toBeGreaterThanOrEqual(owner.topY);
    expect(module.y + module.height, placement.moduleId).toBeLessThanOrEqual(
      owner.bottomY,
    );
    if (placement.parentContainerId !== null) {
      const parent = parents.get(placement.parentContainerId)!;
      expect(module.x, placement.moduleId).toBeGreaterThanOrEqual(parent.x);
      expect(module.x + module.width, placement.moduleId).toBeLessThanOrEqual(
        parent.x + parent.width,
      );
      expect(module.y, placement.moduleId).toBeGreaterThanOrEqual(parent.topY);
      expect(module.y + module.height, placement.moduleId).toBeLessThanOrEqual(
        parent.bottomY,
      );
    }
  }
  expect(result.folderBandPlan.exceptions).toEqual([]);
}

describe('HIER4A-PATCH2 one-level nested Directional Folder Bands', () => {
  it('ND1 lifts a sole singleton child without changing exact provenance', () => {
    const { plan } = hierarchy('ND1');
    expect(plan.parentContainers).toEqual([]);
    expect(plan.summary.simplifiedSingletonChildCount).toBe(1);
    expect(plan.topLevelUnits.map(({ folderKey }) => folderKey)).toContain('A');
    expect(
      plan.modulePlacements.find(({ moduleId }) => moduleId === 'Only'),
    ).toEqual(
      expect.objectContaining({
        exactFolderKey: 'A/B',
        displayedFolderKey: 'A',
        provenance: 'automatic-directional-singleton-simplification',
      }),
    );
    expectContained('ND1');
  });

  it('ND2 keeps a sole multi-File child and an unlabeled direct unit', () => {
    const { plan, parent } = parentFor('ND2', 'A');
    const units = plan.internalUnits.filter(
      ({ parentContainerId }) => parentContainerId === parent.id,
    );
    expect(units).toHaveLength(2);
    expect(
      units.find(({ kind }) => kind === 'direct-parent')?.label,
    ).toBeNull();
    expect(units.find(({ kind }) => kind === 'child-band')).toEqual(
      expect.objectContaining({ folderKey: 'A/B', label: 'B' }),
    );
    expectContained('ND2');
  });

  it('ND3 preserves both singleton sibling child folders', () => {
    const { plan, parent } = parentFor('ND3', 'A');
    expect(
      plan.internalUnits
        .filter(
          ({ parentContainerId, kind }) =>
            parentContainerId === parent.id && kind === 'child-band',
        )
        .map(({ folderKey }) => folderKey)
        .sort(),
    ).toEqual(['A/B', 'A/C']);
    expect(plan.summary.simplifiedSingletonChildCount).toBe(0);
    expectContained('ND3');
  });

  it('ND4 contains direct Files and both child bands in one atomic parent', () => {
    const { plan, parent } = parentFor('ND4', 'A');
    expect(parent.moduleIds).toHaveLength(5);
    expect(parent.internalUnitIds).toHaveLength(3);
    expect(plan.topLevelUnits.find(({ id }) => id === parent.id)?.kind).toBe(
      'parent-container',
    );
    expectContained('ND4');
  });

  it('ND5 suppresses a redundant outer wrapper', () => {
    const { plan } = hierarchy('ND5');
    expect(plan.parentContainers).toEqual([]);
    expect(plan.topLevelUnits).toContainEqual(
      expect.objectContaining({ kind: 'standalone-band', folderKey: 'A/B' }),
    );
    expectContained('ND5');
  });

  it('ND6 uses bounded parent-local ordering without escaping containment', () => {
    const { plan, parent } = parentFor('ND6', 'A');
    expect(parent.internalUnitIds).toHaveLength(2);
    expect(plan.summary.parentLocalOrderingSweepCount).toBeGreaterThanOrEqual(
      4,
    );
    expect(plan.summary.topLevelOrderingCandidateCount).toBeGreaterThan(1);
    expect(plan.summary.parentLocalOrderingChangeCount).toBeGreaterThan(0);
    expectContained('ND6');
  });

  it('ND7 accepts topology crossings while keeping every File contained', () => {
    const { result } = hierarchy('ND7');
    expect(result.folderBandPlan.summary.satisfactionRatio).toBe(1);
    expect(result.folderBandPlan.exceptions).toEqual([]);
    expect(result.quality.exactEndpointCrossingCount).toBeGreaterThan(0);
    expectContained('ND7');
  });

  it('ND8 keeps the root exact band independent and full-path keyed', () => {
    const { plan } = hierarchy('ND8');
    expect(plan.rootBandFolderKey).toBe('A/B');
    expect(plan.topLevelUnits).toContainEqual(
      expect.objectContaining({
        kind: 'root-band',
        folderKey: 'A/B',
        centerY: 0,
      }),
    );
    expect(
      plan.parentContainers.some(({ folderKey }) => folderKey === 'A'),
    ).toBe(false);
    expectContained('ND8');
  });

  it('ND9 groups two non-root siblings without inserting the root sibling', () => {
    const { plan, parent } = parentFor('ND9', 'A');
    expect(parent.moduleIds).toEqual(['C1', 'D1']);
    expect(parent.moduleIds).not.toContain('Focus');
    expect(plan.rootBandFolderKey).toBe('A/B');
    expectContained('ND9');
  });

  it('ND10 exposes short nested labels and normalized full metadata', () => {
    const { plan, parent } = parentFor('ND10', 'A');
    expect(parent.label).toBe('A');
    expect(parent.fullLabel).toBe('A');
    expect(plan.internalUnits).toContainEqual(
      expect.objectContaining({
        folderKey: 'A/B',
        label: 'B',
        fullLabel: 'A/B',
      }),
    );
  });

  it('ND11 selects the deepest meaningful parent and never nests a parent', () => {
    const { plan } = hierarchy('ND11');
    expect(plan.maximumNestedDepth).toBe(1);
    expect(plan.summary.maximumNestedDepth).toBe(1);
    expect(plan.parentContainers.map(({ folderKey }) => folderKey)).toContain(
      'A/B',
    );
    expect(
      plan.internalUnits.some(({ parentContainerId }) =>
        plan.parentContainers.some(({ id }) => id === parentContainerId),
      ),
    ).toBe(true);
    expectContained('ND11');
  });

  it('ND12 recomputes child and parent height from disclosed Compass modules', () => {
    const { result, plan, parent } = parentFor('ND12', 'A');
    const bBand = plan.internalUnits.find(
      ({ folderKey }) => folderKey === 'A/B',
    )!;
    const bModules = result.candidate.modules.filter(({ moduleId }) =>
      ['B1', 'B2'].includes(moduleId),
    );
    expect(bBand.height).toBeGreaterThan(
      Math.max(...bModules.map(({ height }) => height)),
    );
    expect(parent.height).toBeGreaterThan(bBand.height);
    expectContained('ND12');
  });

  it('ND13 materializes and dematerializes deterministically across hide/restore', () => {
    const original = run('ND13');
    const base = spec('ND13');
    const hidden: EndpointFixtureSpec = {
      ...base,
      documents: base.documents.filter(({ id }) => id !== 'B2'),
      references: base.references.filter(
        ({ sourceEntityId, targetEntityId }) =>
          sourceEntityId !== 'B2' && targetEntityId !== 'B2',
      ),
    };
    const reduced = run('ND13', 'nested-one-level', hidden);
    const restored = run('ND13');
    expect(reduced.result.folderBandPlan.hierarchy?.parentContainers).toEqual(
      [],
    );
    expect(
      reduced.result.folderBandPlan.hierarchy?.summary
        .simplifiedSingletonChildCount,
    ).toBe(1);
    expect(restored.result.candidate).toEqual(original.result.candidate);
    expect(restored.result.folderBandPlan).toEqual(
      original.result.folderBandPlan,
    );
  });

  it('ND14 recomputes root exclusion after reroot', () => {
    const { input, result } = run('ND14');
    const plan = result.folderBandPlan.hierarchy!;
    expect(plan.rootBandFolderKey).toBe('A/B');
    expect(
      result.candidate.modules.find(
        ({ moduleId }) => moduleId === input.model.rootModuleId,
      )!.y +
        result.candidate.modules.find(
          ({ moduleId }) => moduleId === input.model.rootModuleId,
        )!.height /
          2,
    ).toBe(0);
    expectContained('ND14');
  });

  it('ND15 gives a secondary-only relationship zero hierarchy influence', () => {
    const after = run('ND15');
    const base = spec('ND15');
    const before = run('ND15', 'nested-one-level', {
      ...base,
      references: base.references.filter(
        ({ sourceEntityId, targetEntityId }) =>
          sourceEntityId !== 'B1' || targetEntityId !== 'C1',
      ),
    });
    expect(after.result.candidate).toEqual(before.result.candidate);
    expect(after.result.folderBandPlan.hierarchy).toEqual(
      before.result.folderBandPlan.hierarchy,
    );
  });

  it('keeps Flat on the unchanged accepted solver path', () => {
    for (const fixture of NESTED_DIRECTIONAL_FOLDER_FIXTURES) {
      const first = run(fixture.id as `ND${number}`, 'flat', fixture).result;
      const second = run(fixture.id as `ND${number}`, 'flat', fixture).result;
      expect(first.candidate, fixture.id).toEqual(second.candidate);
      expect(first.folderBandPlan.hierarchy, fixture.id).toBeUndefined();
    }
  }, 30_000);

  it('is cold deterministic, input-permutation deterministic, and worker-identical', () => {
    const fixture = spec('ND4');
    const cold = run('ND4', 'nested-one-level', fixture);
    expect(run('ND4', 'nested-one-level', fixture).result).toEqual(cold.result);
    const permutedAttempt = computeFocusSchematicComputedLayoutAttempt(
      {
        ...cold.input,
        model: {
          ...cold.input.model,
          modules: [...cold.input.model.modules].reverse(),
          relationships: [...cold.input.model.relationships]
            .reverse()
            .map((relationship) => ({
              ...relationship,
              referenceIds: [...relationship.referenceIds].reverse(),
              visibleEndpointGroups: [...relationship.visibleEndpointGroups]
                .reverse()
                .map((group) => ({
                  ...group,
                  referenceIds: [...group.referenceIds].reverse(),
                })),
            })),
          parentCandidates: [...cold.input.model.parentCandidates].reverse(),
        },
        projection: {
          ...cold.input.projection,
          nodes: [...cold.input.projection.nodes].reverse(),
          edges: [...cold.input.projection.edges].reverse(),
        },
      },
      {
        endpointOrderPolicy: 'crossing-optimized',
        internalLayoutVariant: 'adaptive-compass',
      },
    );
    expect(permutedAttempt.status).toBe('success');
    if (permutedAttempt.status !== 'success') return;
    expect(permutedAttempt.result).toEqual(cold.result);
    const response = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'layout',
        input: cold.input,
        policies: {
          macroLayout: 'directional-bands',
          softFolderStrength: 50,
          softFolderDisplayIntent: {
            fileParentOverrides: [],
            flattenedFolderKeys: [],
          },
          endpointOrderPolicy: 'crossing-optimized',
          internalLayoutVariant: 'adaptive-compass',
        },
      },
      () => 0,
    );
    expect(response.kind).toBe('success');
    if (response.kind === 'success')
      expect(response.result).toEqual(cold.result);
  }, 30_000);
});
