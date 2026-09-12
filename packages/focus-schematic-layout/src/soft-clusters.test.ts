import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import {
  compareFocusSchematicSoftInternalVariants,
  computeFocusSchematicSoftClusterLayoutAttempt,
  FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
} from './soft-clusters';
import {
  SOFT_ADAPTIVE_COMPASS_FIXTURES,
  SOFT_CLUSTER_FIXTURES,
  createSoftClusterMultiplicityFixture,
} from './soft-cluster-fixtures';
import {
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  FOLDER_FIXTURES,
} from './folder-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import type { EndpointFixtureSpec } from './endpoint-fixtures';
import type {
  FocusSchematicSoftClusterOptions,
  FocusSchematicSoftFolderDisplayIntent,
} from './types';

function run(
  spec: EndpointFixtureSpec,
  strength: 0 | 25 | 50 | 75 | 100 = 50,
  displayIntent: FocusSchematicSoftFolderDisplayIntent = {
    fileParentOverrides: [],
    flattenedFolderKeys: [],
  },
  options: Omit<
    FocusSchematicSoftClusterOptions,
    'strength' | 'displayIntent'
  > = {},
) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    ...options,
    strength,
    displayIntent,
  });
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/${strength} failed: ${attempt.reason}`);
  return { input, attempt };
}

const mixedScopeFixture: EndpointFixtureSpec = {
  id: 'SC25',
  label: 'mixed per-folder Soft scope',
  authored: 'Synthetic exact-folder hierarchy for HIER4B-FIX2.',
  expectation: 'Only explicitly promoted branches share a Soft spatial group.',
  inspect: 'Compare exact, one-child, sibling, and mixed-granularity grouping.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'LanguageParent', path: 'Language/Parent.md' },
    { id: 'PragmaticsA', path: 'Language/Pragmatics/A.md' },
    { id: 'PragmaticsB', path: 'Language/Pragmatics/B.md' },
    { id: 'GrammarA', path: 'Language/Grammar/A.md' },
    { id: 'GrammarB', path: 'Language/Grammar/B.md' },
    { id: 'PatternA', path: 'Pattern Theory/A/A.md' },
    { id: 'PatternB', path: 'Pattern Theory/B/B.md' },
  ],
  references: [
    { sourceEntityId: 'Focus', targetEntityId: 'LanguageParent' },
    { sourceEntityId: 'Focus', targetEntityId: 'PragmaticsA' },
    { sourceEntityId: 'PragmaticsA', targetEntityId: 'PragmaticsB' },
    { sourceEntityId: 'Focus', targetEntityId: 'GrammarA' },
    { sourceEntityId: 'GrammarA', targetEntityId: 'GrammarB' },
    { sourceEntityId: 'Focus', targetEntityId: 'PatternA' },
    { sourceEntityId: 'Focus', targetEntityId: 'PatternB' },
  ],
  hops: 2,
};

function fixture(id: `SC${number}`) {
  const value = SOFT_CLUSTER_FIXTURES.find((item) => item.id === id);
  if (value === undefined) throw new Error(`Missing fixture ${id}.`);
  return value;
}

function adaptiveFixture(id: `AC-S${number}`) {
  const value = SOFT_ADAPTIVE_COMPASS_FIXTURES.find((item) => item.id === id);
  if (value === undefined) throw new Error(`Missing fixture ${id}.`);
  return value;
}

describe('HIER4B Soft Folder Clusters', () => {
  it('owns the complete SC1-SC24 fixture inventory', () => {
    expect(SOFT_CLUSTER_FIXTURES.map(({ id }) => id)).toEqual(
      Array.from({ length: 24 }, (_, index) => `SC${index + 1}`),
    );
  });

  it('uses a fixed two-round schedule, anchors the root File, and clears overlaps', () => {
    for (const id of [
      'SC3',
      'SC7',
      'SC11',
      'SC14',
      'SC21',
      'SC22',
      'SC24',
    ] as const) {
      const { input, attempt } = run(fixture(id));
      const root = input.model.modules.find(
        ({ id: moduleId }) => moduleId === input.model.rootModuleId,
      )!;
      const file = attempt.result.candidate.nodes.find(
        ({ projectionNodeId }) =>
          projectionNodeId === root.documentProjectionNodeId,
      )!;
      expect(file.x + file.width / 2).toBeCloseTo(0, 8);
      expect(file.y + file.height / 2).toBeCloseTo(0, 8);
      expect(attempt.evidence.fixedIterationSchedule).toEqual(
        FOCUS_SCHEMATIC_SOFT_CLUSTER_ITERATION_SCHEDULE,
      );
      expect(attempt.evidence.runtime.iterationCount).toBe(54);
      expect(attempt.evidence.runtime.jointRoundCount).toBe(2);
      expect(attempt.evidence.metrics.overlapCount).toBe(0);
    }
  }, 30_000);

  it('is byte-deterministic and independent of input document ordering', () => {
    const spec = fixture('SC15');
    const first = run(spec).attempt;
    const second = run(spec).attempt;
    const permuted = run({
      ...spec,
      documents: [...spec.documents].reverse(),
    }).attempt;
    const fullyPermuted = run({
      ...spec,
      documents: [...spec.documents].reverse(),
      references: [...spec.references].reverse(),
    }).attempt;
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(second.result.candidate),
    );
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(permuted.result.candidate),
    );
    expect(JSON.stringify(first.result.candidate)).toBe(
      JSON.stringify(fullyPermuted.result.candidate),
    );
  });

  it('makes strength zero exactly independent of exact folder identity', () => {
    const spec = fixture('SC2');
    const changed: EndpointFixtureSpec = {
      ...spec,
      documents: spec.documents.map((document, index) => ({
        ...document,
        path: `mutated-${index}/${document.id}.md`,
      })),
    };
    const before = run(spec, 0).attempt;
    const after = run(changed, 0).attempt;
    expect(before.evidence.folderInfluenceEnabled).toBe(false);
    expect(JSON.stringify(before.result.candidate)).toBe(
      JSON.stringify(after.result.candidate),
    );
  });

  it('keeps strength zero geometry independent of manual display intent', () => {
    const exact = run(mixedScopeFixture, 0).attempt;
    const promoted = run(mixedScopeFixture, 0, {
      fileParentOverrides: [
        { fileId: 'PragmaticsA', displayParentFolderKey: 'Language' },
      ],
      flattenedFolderKeys: ['Pattern Theory/A'],
    }).attempt;
    expect(promoted.evidence.folderInfluenceEnabled).toBe(false);
    expect(promoted.result.candidate).toEqual(exact.result.candidate);
  });

  it.each([0, 25, 50, 75, 100] as const)(
    'uses the same nested display hierarchy at strength %i',
    (strength) => {
      const displayIntent = {
        fileParentOverrides: [
          { fileId: 'PragmaticsA', displayParentFolderKey: 'Language' },
        ],
        flattenedFolderKeys: ['Pattern Theory/A'],
      } as const;
      const result = run(mixedScopeFixture, strength, displayIntent).attempt;
      expect(
        result.result.internalLayoutEvidence.softClusterPolicyEvidence,
      ).toMatchObject({
        displayIntent,
        strength,
        hierarchyForcePolicy: 'normalized-decay',
      });
      expect(result.evidence).toMatchObject({
        fileParentOverrideCount: 1,
        flattenedFolderCount: 1,
        hierarchyForcePolicy: 'normalized-decay',
        maximumPerFileFolderWeight: 1,
      });
    },
    20_000,
  );

  it('keeps singleton folders force-free and improves repeated-folder cohesion at full strength', () => {
    const singleton0 = run(fixture('SC6'), 0).attempt;
    const singleton100 = run(fixture('SC6'), 100).attempt;
    expect(JSON.stringify(singleton0.result.candidate)).toBe(
      JSON.stringify(singleton100.result.candidate),
    );

    const loose = run(fixture('SC16'), 0).attempt.evidence.metrics;
    const cohesive = run(fixture('SC16'), 100).attempt.evidence.metrics;
    expect(cohesive.repeatedFolderRmsRadiusMean).not.toBeNull();
    expect(cohesive.repeatedFolderRmsRadiusMean!).toBeLessThan(
      loose.repeatedFolderRmsRadiusMean!,
    );
  });

  it('excludes filtered bridge identity from folder centroids', () => {
    const result = run(fixture('SC13')).attempt;
    expect(result.evidence.metrics.repeatedFolderCount).toBe(1);
    expect(result.evidence.metrics.repeatedFolderModuleCount).toBe(2);
    expect(result.result.candidate.modules).toHaveLength(4);
  });

  it('caps multiplicity influence after the documented logarithmic saturation', () => {
    const twenty = run(createSoftClusterMultiplicityFixture(20)).attempt;
    const hundred = run(createSoftClusterMultiplicityFixture(100)).attempt;
    expect(JSON.stringify(twenty.result.candidate)).toBe(
      JSON.stringify(hundred.result.candidate),
    );
  });

  it('gives secondary relationships zero geometry influence', () => {
    const spec = fixture('SC20');
    const baseline = run(spec).attempt;
    const secondaryReferenceIds = new Set(
      baseline.result.endpointPlan.connections
        .filter(({ role }) => role === 'secondary')
        .flatMap(({ referenceIds }) => referenceIds),
    );
    expect(secondaryReferenceIds.size).toBeGreaterThan(0);
    const withoutSecondary: EndpointFixtureSpec = {
      ...spec,
      references: spec.references.filter(
        (_, index) => !secondaryReferenceIds.has(`SC20-reference-${index + 1}`),
      ),
    };
    const changed = run(withoutSecondary).attempt;
    expect(JSON.stringify(baseline.result.candidate)).toBe(
      JSON.stringify(changed.result.candidate),
    );
  });

  it('owns AC-S1 through AC-S8 and uses all four regions only when demanded', () => {
    expect(SOFT_ADAPTIVE_COMPASS_FIXTURES.map(({ id }) => id)).toEqual(
      Array.from({ length: 8 }, (_, index) => `AC-S${index + 1}`),
    );
    const adaptive = run(adaptiveFixture('AC-S1')).attempt;
    expect(adaptive.evidence.compass).toMatchObject({
      demandPolicy: 'spatial-cardinal',
      spatialDemandSummary: 'dominant-cardinal',
      topBranchCount: 1,
      bottomBranchCount: 1,
      leftBranchCount: 1,
      rightBranchCount: 1,
      demandedBranchCount: 4,
      demandMatchedBranchCount: 4,
    });
    const vertical = run(adaptiveFixture('AC-S1'), 50, undefined, {
      internalLayoutVariant: 'vertical-spine',
    }).attempt;
    expect(vertical.evidence.compass.leftBranchCount).toBe(0);
    expect(vertical.evidence.compass.rightBranchCount).toBe(0);
    expect(vertical.evidence.compass.topBranchCount).toBe(2);
    expect(vertical.evidence.compass.bottomBranchCount).toBe(2);
  });

  it('uses spatial demand for vertical, horizontal, mixed, and neutral cases', () => {
    const vertical = run(adaptiveFixture('AC-S2')).attempt.evidence.compass;
    expect(vertical.topBranchCount).toBe(1);
    expect(vertical.bottomBranchCount).toBe(1);
    expect(vertical.leftBranchCount + vertical.rightBranchCount).toBe(0);

    const horizontal = run(adaptiveFixture('AC-S3')).attempt.evidence.compass;
    expect(horizontal.leftBranchCount).toBe(1);
    expect(horizontal.rightBranchCount).toBe(1);

    const mixed = run(adaptiveFixture('AC-S4')).attempt;
    const vector = run(adaptiveFixture('AC-S4'), 50, undefined, {
      spatialDemandSummary: 'aggregate-vector',
    }).attempt;
    expect(mixed.evidence.compass.topBranchCount).toBe(1);
    expect(vector.evidence.compass.rightBranchCount).toBe(1);
    expect(mixed.result.quality.exactEndpointCrossingCount).toBe(0);
    expect(vector.result.quality.exactEndpointCrossingCount).toBe(0);
    expect(
      mixed.result.internalLayoutEvidence.metrics
        .totalPrimaryReferenceManhattanSpan,
    ).toBeLessThan(
      vector.result.internalLayoutEvidence.metrics
        .totalPrimaryReferenceManhattanSpan,
    );
    expect(mixed.evidence.metrics.boundsArea).toBeLessThan(
      vector.evidence.metrics.boundsArea,
    );

    const perturbedInput = {
      ...run(adaptiveFixture('AC-S4')).input,
      nodeDimensions: run(adaptiveFixture('AC-S4')).input.nodeDimensions.map(
        (dimension, index) =>
          index === 0
            ? { ...dimension, width: dimension.width + 0.0001 }
            : dimension,
      ),
    };
    const perturbed =
      computeFocusSchematicSoftClusterLayoutAttempt(perturbedInput);
    expect(perturbed.status).toBe('success');
    if (perturbed.status === 'success')
      expect(perturbed.evidence.compass.topBranchCount).toBe(1);

    const neutral = run(adaptiveFixture('AC-S5')).attempt.evidence.compass;
    expect(neutral.demandedBranchCount).toBe(0);
    expect(neutral.leftBranchCount + neutral.rightBranchCount).toBe(0);
  });

  it('lets crossing quality override lateral demand and retains useful pass 2 adaptation', () => {
    const guarded = run(adaptiveFixture('AC-S6')).attempt;
    expect(guarded.result.quality.exactEndpointCrossingCount).toBe(0);
    expect(guarded.evidence.compass).toMatchObject({
      demandOverriddenByCrossingCount: 1,
      pass2ExactEndpointCrossingBeforeCount: 1,
      pass2ExactEndpointCrossingAfterCount: 0,
    });
    expect(
      guarded.evidence.compass.topBranchCount +
        guarded.evidence.compass.bottomBranchCount,
    ).toBeGreaterThan(0);

    const adaptive = run(adaptiveFixture('AC-S8')).attempt.evidence.compass;
    expect(adaptive.pass1ToPass2BranchRegionChangeCount).toBe(3);
    expect(adaptive.pass2DemandMatchedAfterCount).toBeGreaterThan(
      adaptive.pass2DemandMatchedBeforeCount,
    );
    expect(adaptive.pass2ExactEndpointCrossingAfterCount).toBeLessThan(
      adaptive.pass2ExactEndpointCrossingBeforeCount,
    );
    expect(adaptive.pass2PrimaryManhattanSpanAfter).toBeLessThan(
      adaptive.pass2PrimaryManhattanSpanBefore,
    );
  });

  it('distinguishes legitimate macro movement from a semantic internal no-op', () => {
    const noOp = run(adaptiveFixture('AC-S7'));
    const noOpDiagnostic = compareFocusSchematicSoftInternalVariants(
      noOp.input,
    );
    expect(noOpDiagnostic).toMatchObject({
      internalRegionAssignmentDifferenceCount: 0,
      internalNodeGeometryDifferenceCount: 0,
      moduleBoundsDifferenceCount: 0,
      macroFileCenterTotalDisplacement: 0,
      macroFileCenterMaximumDisplacement: 0,
      initialInternalGeometryIdentical: true,
      finalGeometryIdentical: true,
      semanticNoOpSatisfied: true,
    });

    const changed = run(adaptiveFixture('AC-S1'));
    const changedDiagnostic = compareFocusSchematicSoftInternalVariants(
      changed.input,
    );
    expect(changedDiagnostic.internalRegionAssignmentDifferenceCount).toBe(2);
    expect(
      changedDiagnostic.internalNodeGeometryDifferenceCount,
    ).toBeGreaterThan(0);
    expect(changedDiagnostic.moduleBoundsDifferenceCount).toBeGreaterThan(0);
    expect(changedDiagnostic.macroFileCenterTotalDisplacement).toBeGreaterThan(
      0,
    );
    expect(changedDiagnostic.semanticNoOpSatisfied).toBe(true);
  });

  it('keeps four-side File attachments correct after spatial Heading placement', () => {
    const result = run(adaptiveFixture('AC-S1')).attempt.result;
    expect(
      new Set(
        result.attachments
          .filter(({ endpoint }) => endpoint === 'target')
          .map(({ side }) => side),
      ),
    ).toEqual(new Set(['top', 'bottom', 'left', 'right']));
    expect(
      result.attachments.every(({ kind }) => kind === 'visible-node'),
    ).toBe(true);
  });

  it('recomputes disclosure, reroot, and every Soft strength deterministically', () => {
    const expandedSpec = adaptiveFixture('AC-S1');
    const collapsedSpec: EndpointFixtureSpec = {
      ...expandedSpec,
      id: 'AC-S11',
      collapsedEntityIds: ['Focus'],
      expandedEntityIds: [],
    };
    const expanded = run(expandedSpec).attempt;
    const collapsed = run(collapsedSpec).attempt;
    const restored = run(expandedSpec).attempt;
    expect(restored.result.candidate).toEqual(expanded.result.candidate);
    expect(collapsed.evidence.compass.demandedBranchCount).toBe(0);

    const rerootedSpec: EndpointFixtureSpec = {
      ...expandedSpec,
      id: 'AC-S12',
      rootDocumentId: 'LeftTarget262',
    };
    const rerooted = run(rerootedSpec).attempt;
    expect(run(rerootedSpec).attempt.result.candidate).toEqual(
      rerooted.result.candidate,
    );
    expect(rerooted.result.candidate.rootModuleId).toBe('LeftTarget262');
    expect(rerooted.result.quality.moduleOverlapPairs).toEqual([]);

    for (const strength of [0, 25, 50, 75, 100] as const) {
      const first = run(expandedSpec, strength).attempt;
      const second = run(expandedSpec, strength).attempt;
      expect(second.result.candidate, String(strength)).toEqual(
        first.result.candidate,
      );
      expect(first.evidence.compass.demandPolicy).toBe('spatial-cardinal');
      expect(first.result.quality.moduleOverlapPairs).toEqual([]);
    }
  }, 30_000);

  it('separates Soft algorithm and variant cache identities', () => {
    const adaptive = run(adaptiveFixture('AC-S1')).attempt;
    const repeated = run(adaptiveFixture('AC-S1')).attempt;
    const vertical = run(adaptiveFixture('AC-S1'), 50, undefined, {
      internalLayoutVariant: 'vertical-spine',
    }).attempt;
    expect(adaptive.configId).toContain('HIER4Bv4');
    expect(repeated.configId).toBe(adaptive.configId);
    expect(repeated.result.candidate).toEqual(adaptive.result.candidate);
    expect(vertical.configId).not.toBe(adaptive.configId);
    expect(vertical.result.candidate).not.toEqual(adaptive.result.candidate);
  });

  it('keeps the merged Directional Adaptive oracle byte-identical', () => {
    const expected = new Map([
      [
        'DB5',
        'd1a29e0f58549855c30f77e0453f163aac1ced1cccc00e203905a2db1df7768c',
      ],
      [
        'DB11',
        'fda189a732b2e00746699e2635e10ab58e2fc73a8a1c46d183abfd400a2106d5',
      ],
      [
        'DB12',
        '71a889c446f481ce6c373ddd0ceca16d87aedd108981a6574abb4572ddd4c946',
      ],
      [
        'FB4',
        '3dae4397884d3046e6ecc68f80944b69708dc0c91acb390e2d088347c6a11415',
      ],
      [
        'DB14',
        'b1d2beb1cd353fca6c0f35fa700489a9de208bcf6cb6d013830a41dd0a0b1f1b',
      ],
      [
        'DB19',
        'a8d2a3165d57039888d3f72b7dc814341ada73240ec30339a036b658118ba0f8',
      ],
    ]);
    const fixtures = [...FOLDER_FIXTURES, ...DIRECTIONAL_FOLDER_BAND_FIXTURES];
    for (const [id, hash] of expected) {
      const spec = fixtures.find((item) => item.id === id)!;
      const input = layoutInput(buildEndpointFixture(spec), {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: true,
      });
      const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
        endpointOrderPolicy: 'crossing-optimized',
        internalLayoutVariant: 'adaptive-compass',
      });
      expect(attempt.status, id).toBe('success');
      if (attempt.status !== 'success') continue;
      const payload = JSON.stringify({
        candidate: attempt.result.candidate,
        attachments: attempt.result.attachments,
        folderBandPlan: attempt.result.folderBandPlan,
        quality: attempt.result.quality,
      });
      expect(createHash('sha256').update(payload).digest('hex'), id).toBe(hash);
    }
  });
});
