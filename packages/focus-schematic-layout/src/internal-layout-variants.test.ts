import { describe, expect, it } from 'vitest';

import { buildEndpointFixture } from './endpoint-fixtures';
import {
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  FOLDER_FIXTURES,
  INTERNAL_LAYOUT_FIXTURES,
} from './folder-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import type {
  FocusSchematicEndpointOrderPolicy,
  FocusSchematicInternalLayoutVariant,
} from './types';

const allFixtures = [
  ...FOLDER_FIXTURES,
  ...DIRECTIONAL_FOLDER_BAND_FIXTURES,
  ...INTERNAL_LAYOUT_FIXTURES,
];

function fixture(id: string) {
  const value = allFixtures.find((item) => item.id === id);
  if (value === undefined) throw new Error(`Missing fixture ${id}.`);
  return value;
}

function runSpec(
  spec: (typeof allFixtures)[number],
  variant: FocusSchematicInternalLayoutVariant,
  endpointOrderPolicy: FocusSchematicEndpointOrderPolicy = 'crossing-optimized',
  enabled = true,
) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: enabled,
  });
  const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
    endpointOrderPolicy,
    internalLayoutVariant: variant,
  });
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/${variant} failed: ${attempt.reason}`);
  return { input, attempt };
}

function run(
  id: string,
  variant: FocusSchematicInternalLayoutVariant,
  endpointOrderPolicy?: FocusSchematicEndpointOrderPolicy,
) {
  return runSpec(fixture(id), variant, endpointOrderPolicy);
}

function rootModuleMetrics(
  result: ReturnType<typeof run>['attempt']['result'],
) {
  const value = result.internalLayoutEvidence.moduleMetrics.find(
    ({ moduleId }) => moduleId === result.candidate.rootModuleId,
  );
  if (value === undefined) throw new Error('Missing root module metrics.');
  return value;
}

describe('HIER4A-FIX2 internal File-module layout bakeoff', () => {
  it('keeps product Folder Bands Off on the exact Current oracle', () => {
    const spec = fixture('DB12');
    const current = runSpec(spec, 'current', 'crossing-optimized', false);
    for (const variant of ['vertical-spine', 'adaptive-compass'] as const) {
      const comparison = runSpec(spec, variant, 'crossing-optimized', false);
      expect(comparison.attempt.result.candidate).toEqual(
        current.attempt.result.candidate,
      );
      expect(comparison.attempt.result.internalLayoutEvidence.variant).toBe(
        'current',
      );
      expect(comparison.attempt.configId).toBe(current.attempt.configId);
    }
  });

  it('keeps both candidates finite, contained, deterministic, and hard-gate safe', () => {
    const inherited = ['DB5', 'DB11', 'DB12', 'DB14', 'DB19', 'FB4'];
    for (const id of [
      ...INTERNAL_LAYOUT_FIXTURES.map(({ id }) => id),
      ...inherited,
    ])
      for (const variant of ['vertical-spine', 'adaptive-compass'] as const) {
        const first = run(id, variant);
        const second = run(id, variant);
        const result = first.attempt.result;
        expect(second.attempt.result, `${id}/${variant}/cold`).toEqual(result);
        expect(result.quality.moduleOverlapPairs, `${id}/${variant}`).toEqual(
          [],
        );
        expect(result.quality.nodeOverlapPairs, `${id}/${variant}`).toEqual([]);
        expect(result.quality.nodeOutsideModuleIds, `${id}/${variant}`).toEqual(
          [],
        );
        expect(
          result.quality.exactEndpointCrossingCount,
          `${id}/${variant}/crossings`,
        ).toBeLessThanOrEqual(
          result.folderBandQuality.baselineExactEndpointCrossingCount,
        );
        expect(
          result.quality.adjacentRankOrderInversionCount,
          `${id}/${variant}/inversions`,
        ).toBeLessThanOrEqual(
          result.folderBandQuality.baselineAdjacentRankOrderInversionCount,
        );
        expect(
          result.internalLayoutEvidence.metrics.internalHierarchyCrossingCount,
          `${id}/${variant}/hierarchy`,
        ).toBe(0);
        expect(
          new Set(result.candidate.nodes.map((node) => node.projectionNodeId))
            .size,
        ).toBe(result.candidate.nodes.length);
      }
  }, 30_000);

  it('makes Vertical Spine a File-centered above/below grammar', () => {
    for (const id of ['VS1', 'VS2', 'VS3', 'VS4', 'VS5', 'VS6', 'VS7']) {
      const result = run(id, 'vertical-spine').attempt.result;
      const root = rootModuleMetrics(result);
      expect(root.branchesLeftOfFile, id).toBe(0);
      expect(root.branchesRightOfFile, id).toBe(0);
      if (root.topLevelBranchCount >= 2) {
        expect(root.branchesAboveFile, id).toBeGreaterThan(0);
        expect(root.branchesBelowFile, id).toBeGreaterThan(0);
      }
    }
    const variable = rootModuleMetrics(
      run('VS6', 'vertical-spine').attempt.result,
    );
    expect(variable.branchesAboveFile).not.toBe(variable.branchesBelowFile);
    expect(variable.packedExtentImbalance).toBeLessThan(
      variable.packedExtentAboveFile + variable.packedExtentBelowFile,
    );
    expect(
      run('VS5', 'vertical-spine', 'document-order').attempt.result
        .internalLayoutEvidence.metrics.internalSourceOrderDeviation,
    ).toBe(0);
  });

  it('keeps Compass bounded, central, non-duplicating, and honest about width', () => {
    const simple = rootModuleMetrics(
      run('CP1', 'adaptive-compass').attempt.result,
    );
    expect(simple.branchesLeftOfFile).toBeGreaterThan(0);
    expect(simple.branchesRightOfFile).toBeGreaterThan(0);

    const mixedResult = run('CP2', 'adaptive-compass').attempt.result;
    const mixed = rootModuleMetrics(mixedResult);
    expect(mixed.branchesLeftOfFile + mixed.branchesRightOfFile).toBe(0);
    expect(
      mixedResult.candidate.nodes.filter(({ projectionNodeId }) =>
        String(projectionNodeId).includes('Focus-Mixed'),
      ),
    ).toHaveLength(1);

    const many = run('CP3', 'adaptive-compass').attempt.result
      .internalLayoutEvidence;
    expect(many.completeCompassAssignmentsEvaluated).toBeLessThanOrEqual(
      many.compassAssignmentCap * many.jointFolderRoundLimit,
    );
    expect(many.localRelocationSweeps).toBeLessThanOrEqual(
      many.compassLocalRelocationSweepLimit * many.jointFolderRoundLimit,
    );

    const compassWidth = rootModuleMetrics(
      run('CP4', 'adaptive-compass').attempt.result,
    ).width;
    const spineWidth = rootModuleMetrics(
      run('CP4', 'vertical-spine').attempt.result,
    ).width;
    expect(compassWidth).toBeGreaterThan(spineWidth);
  });

  it('includes a fair case where Compass materially shortens exact endpoints', () => {
    const spine = run('CP5', 'vertical-spine').attempt.result
      .internalLayoutEvidence.metrics;
    const compass = run('CP5', 'adaptive-compass').attempt.result
      .internalLayoutEvidence.metrics;
    expect(compass.totalPrimaryReferenceManhattanSpan).toBeLessThan(
      spine.totalPrimaryReferenceManhattanSpan,
    );
    expect(compass.totalPrimaryReferenceVerticalSpan).toBeLessThan(
      spine.totalPrimaryReferenceVerticalSpan,
    );
  });

  it('shows DB12 was a Current-layout artifact and replaces its blocked oracle', () => {
    const current = run('DB12', 'current').attempt.result;
    const spine = run('DB12', 'vertical-spine').attempt.result;
    expect(current.folderBandPlan.rootBalance?.topologyOverride).not.toBeNull();
    expect(spine.folderBandPlan.rootBalance?.topologyOverride).toBeNull();
    expect(spine.folderBandPlan.rootBalance?.aboveFolderKeys).toHaveLength(1);
    expect(spine.folderBandPlan.rootBalance?.belowFolderKeys).toHaveLength(1);

    for (const variant of ['vertical-spine', 'adaptive-compass'] as const) {
      const blocked = run('DB19', variant).attempt.result.folderBandPlan
        .rootBalance;
      expect(blocked?.topologyOverride?.reason, variant).toBe('crossing-guard');
      expect(blocked?.topologyOverride?.evidence).toMatchObject({
        baselineCrossings: 0,
        candidateCrossings: 1,
      });
    }

    // Tiny exhaustive oracle: either legal H1/H2 visual order leaves one
    // adjacent-rank side reversed when Amber and Blue straddle Root.
    const balancedSideOrders = [
      {
        leftTargets: ['H2', 'H1'],
        rightTargets: ['H1', 'H2'],
      },
      {
        leftTargets: ['H1', 'H2'],
        rightTargets: ['H2', 'H1'],
      },
    ];
    const legalBranchOrders = [
      ['H1', 'H2'],
      ['H2', 'H1'],
    ];
    const inversions = (
      visual: readonly string[],
      targets: readonly string[],
    ) => Number(visual.indexOf(targets[0]!) > visual.indexOf(targets[1]!));
    expect(
      Math.min(
        ...balancedSideOrders.flatMap(({ leftTargets, rightTargets }) =>
          legalBranchOrders.map(
            (visual) =>
              inversions(visual, leftTargets) +
              inversions(visual, rightTargets),
          ),
        ),
      ),
    ).toBeGreaterThan(0);
  });

  it('keeps secondary-only changes byte-identical for each candidate', () => {
    const withSecondary = fixture('DB16');
    const withoutSecondary = {
      ...withSecondary,
      id: 'DB160' as `DB${number}`,
      references: withSecondary.references.slice(0, -1),
    };
    for (const variant of ['vertical-spine', 'adaptive-compass'] as const) {
      const before = runSpec(withoutSecondary, variant).attempt.result;
      const after = runSpec(withSecondary, variant).attempt.result;
      expect(after.candidate, variant).toEqual(before.candidate);
      expect(after.folderBandPlan, variant).toEqual(before.folderBandPlan);
    }
  });

  it('is insensitive to fixture-array order and JSON worker-boundary cloning', () => {
    const spec = fixture('VS4');
    const permuted = {
      ...spec,
      id: 'VS40' as `VS${number}`,
      documents: [...spec.documents].reverse(),
      entities: [...(spec.entities ?? [])].reverse(),
      references: [...spec.references].reverse(),
    };
    for (const variant of ['vertical-spine', 'adaptive-compass'] as const) {
      const original = runSpec(spec, variant).attempt.result;
      const reversed = runSpec(permuted, variant).attempt.result;
      expect(reversed.candidate, variant).toEqual(original.candidate);
      expect(reversed.folderBandPlan, variant).toEqual(original.folderBandPlan);

      const clonedInput = JSON.parse(
        JSON.stringify(
          layoutInput(buildEndpointFixture(spec), {
            ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
            directionalFolderBandsEnabled: true,
          }),
        ),
      );
      const cloned = computeFocusSchematicComputedLayoutAttempt(clonedInput, {
        endpointOrderPolicy: 'crossing-optimized',
        internalLayoutVariant: variant,
      });
      expect(cloned.status).toBe('success');
      if (cloned.status === 'success')
        expect(cloned.result.candidate, variant).toEqual(original.candidate);
    }
  });
});
