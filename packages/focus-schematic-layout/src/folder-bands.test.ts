import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildEndpointFixture, ENDPOINT_FIXTURES } from './endpoint-fixtures';
import { computeFocusSchematicComputedLayoutAttempt } from './endpoint-facing';
import {
  validateFocusSchematicFolderBandLayout,
  validateSerializedFocusSchematicFolderBandPlan,
} from './folder-bands';
import {
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  FOLDER_FIXTURES,
  FOLDER_STABILITY_PAIRS,
} from './folder-fixtures';
import { FOCUS_SCHEMATIC_LAYOUT_SETTINGS } from './settings';
import { layoutInput } from './test-helpers';
import { FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION } from './worker-protocol';
import { handleFocusSchematicLayoutWorkerRequest } from './worker-runtime';

type FolderFixtureId = `FB${number}` | `DB${number}`;

function runSpec(
  spec: (typeof FOLDER_FIXTURES)[number],
  enabled: boolean,
  endpointOrderPolicy:
    'document-order' | 'crossing-optimized' = 'crossing-optimized',
) {
  const input = layoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: enabled,
  });
  const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
    endpointOrderPolicy,
    internalLayoutVariant: 'current',
  });
  if (attempt.status !== 'success')
    throw new Error(
      `${spec.id}/${enabled ? 'on' : 'off'} failed: ${attempt.reason}`,
    );
  return { input, attempt };
}

function run(
  fixtureId: FolderFixtureId,
  enabled: boolean,
  endpointOrderPolicy:
    'document-order' | 'crossing-optimized' = 'crossing-optimized',
) {
  const spec = [...FOLDER_FIXTURES, ...DIRECTIONAL_FOLDER_BAND_FIXTURES].find(
    ({ id }) => id === fixtureId,
  );
  if (spec === undefined)
    throw new Error(`Missing folder fixture ${fixtureId}.`);
  return runSpec(spec, enabled, endpointOrderPolicy);
}

function centerY(rectangle: { readonly y: number; readonly height: number }) {
  return rectangle.y + rectangle.height / 2;
}

const REVISION_2_CANDIDATE_HASHES: Readonly<Record<string, string>> = {
  EP1: '6902e21dc209a7ee8858358a9de2122dbb2344327f83ec3720b66ca7609d216a',
  EP2: 'da1fa22cd3dac9d5e4481cb98b70fa54b96d3fd7382c66771fd4960b0bc855ca',
  EP3: '5487b7e164cbd5f449b86bfd3d4d7d7da963cc855808257bbf43a07fa1158c6c',
  EP4: '6c90ac11468fe23a10b13a8c1d07adf6286409dc635cce130adab10bf447502c',
  EP5: '2b4a8f7d5138c108e25063eb87d3c6005bc84d8d6aa35cbbdca17debf7a2f09b',
  EP6: 'ada438e34ad5b57ad36a2b65f8a68fbffb4728f0728482a06718d1dec257a8bd',
  EP7: '71f9fba2ada42b87d66bdd6c6307761cd5e551a6e0b5c6142173320f572990b4',
  EP8: 'aadd5ee8897d817e88d0e16a75bc7dea4d9a184747323906bdfab19de7078260',
  EP9: '2a7b7d74ed0d19f35f9814aef8e4dcc783fe92f36c240b84e57d36589d8ae8ea',
  EP10: '6d820cd4c5cc20bc60d41225dd7213cdf3b71bf9d316ab33b20e879a151ad655',
  EP11: '8c8a83fbd6b1261090ab0e3734e4ab5deb9945ced609bf3d98050121e878f95c',
  EP12: '8d3b4e35d1766265bf6b24bca30edec260f672d3748ed53e45966b69788fb6f4',
  EP13: 'ecf742ec16116bc0e377b8bde5f145c676dd3c3a4175d0470190be3087859ddb',
  EP14: 'f1971f22585b2dcbd83c6565a8ae807b73e65530c0c7442cfa1076d35eaa9729',
  EP15: 'cf036c18467f6fca337d7456ca4ade2ce9f5ecf322a69feccf0d9f4f1954f342',
  EP16: '1c33993bb3eba14884137f46aa9107b4df59ffbd619d2ffd672c961634d2bd36',
  EP17: '6479a653d95db3e7fd46b39bfbf772c92ed4b55cf641d884445f50eb3af3a8ac',
  EP18: '6f975ade4e247e23af3e183c4be6222c9b94acc71cfe1d9e18d03909791c8eac',
  EP19: 'f1971f22585b2dcbd83c6565a8ae807b73e65530c0c7442cfa1076d35eaa9729',
  EP20: 'a45f9f06c043ce15bd688eb983ea7bb914aeed42687db10ee50f696a0145295f',
  EP21: '69b7c1ee3b8796cde2f0feef9c8a6ccb816108a77d70df2db731192b1e924ddb',
  EP22: 'b50dca5b47693a0cf2432966292419500807612a490d2fe4e373cb8cb8a88801',
  EP23: '779459c2eb4fa6d1600e84cd7609fecc120e868c3fb709287f4ab18a7916e504',
  EP24: '6912f7db6a5419ee9500010168bd6f1f204d334de93c09c87d7593c629d442fa',
  EP25: '836eaa0044001d5b3d50c16e745be732d2edb6d9afb6825ac96d13fe2f4ad10b',
  EP26: 'e806157eab2c53a3299d4507c18026f7d51a4eda5a6a738ed01df59a31b4bc7d',
};

describe('HIER4A categorical Directional Folder Bands', () => {
  it('keeps Off byte-identical to the accepted revision-2 endpoint corpus', () => {
    for (const spec of ENDPOINT_FIXTURES) {
      const input = layoutInput(buildEndpointFixture(spec), {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: false,
      });
      const attempt = computeFocusSchematicComputedLayoutAttempt(input);
      expect(attempt.status, spec.id).toBe('success');
      if (attempt.status !== 'success') continue;
      expect(attempt.result.folderBandPlan.enabled).toBe(false);
      expect(attempt.result.folderBandPlan.bands).toEqual([]);
      expect(attempt.result.folderBandPlan.rootBalance).toBeNull();
      expect(
        createHash('sha256')
          .update(JSON.stringify(attempt.result.candidate))
          .digest('hex'),
        spec.id,
      ).toBe(REVISION_2_CANDIDATE_HASHES[spec.id]);
    }
  });

  it('gives every visible exact folder and File one categorical On record', () => {
    for (const spec of [
      ...FOLDER_FIXTURES,
      ...DIRECTIONAL_FOLDER_BAND_FIXTURES,
    ]) {
      const first = run(spec.id as FolderFixtureId, true);
      const second = run(spec.id as FolderFixtureId, true);
      expect(first.attempt.result, spec.id).toEqual(second.attempt.result);
      const { folderBandPlan: plan, folderBandQuality: quality } =
        first.attempt.result;
      const visibleModules = first.input.model.modules.filter(
        ({ presentation }) => presentation !== 'filtered',
      );
      const visibleFolders = new Set(
        visibleModules.map(({ folderKey }) => folderKey),
      );
      expect(plan.enabled, spec.id).toBe(true);
      expect(plan.rootBalance, spec.id).not.toBeNull();
      expect(plan.bands, spec.id).toHaveLength(visibleFolders.size);
      expect(plan.modulePlacements, spec.id).toHaveLength(
        visibleModules.length,
      );
      expect(plan.folderOrder, spec.id).toEqual(
        plan.bands.map(({ folderKey }) => folderKey),
      );
      expect(
        plan.modulePlacements.every(
          ({ status, distanceToOwnBand, exceptionId }) =>
            status === 'inside-own-band'
              ? distanceToOwnBand === 0 && exceptionId === null
              : distanceToOwnBand > 0 && exceptionId !== null,
        ),
        spec.id,
      ).toBe(true);
      expect(
        quality.finalExactEndpointCrossingCount,
        spec.id,
      ).toBeLessThanOrEqual(quality.baselineExactEndpointCrossingCount);
      expect(
        quality.finalAdjacentRankOrderInversionCount,
        spec.id,
      ).toBeLessThanOrEqual(quality.baselineAdjacentRankOrderInversionCount);
      const root = first.attempt.result.candidate.modules.find(
        ({ moduleId }) => moduleId === first.input.model.rootModuleId,
      );
      expect(root === undefined ? null : centerY(root), spec.id).toBe(0);
    }
  }, 30_000);

  it('treats singleton, nested, and root exact folders as real bands', () => {
    const singletons = run('FB9', true).attempt.result.folderBandPlan;
    expect(singletons.bands).toHaveLength(3);
    expect(singletons.bands.filter(({ singleton }) => singleton)).toHaveLength(
      3,
    );

    const manySingletons = run('DB1', true).attempt.result.folderBandPlan;
    expect(manySingletons.bands).toHaveLength(5);
    expect(manySingletons.modulePlacements).toHaveLength(5);

    const nested = run('FB6', true).attempt.result.folderBandPlan;
    expect(nested.folderOrder).toEqual(
      expect.arrayContaining([
        'root',
        'science',
        'science/cog',
        'science/neuro',
      ]),
    );
    const rootBand = nested.bands.find(({ root }) => root);
    expect(rootBand?.centerY).toBe(0);
  });

  it('fully bands the safe case and evaluates FB4 topology tension without a presumed block', () => {
    const safe = run('FB3', true).attempt.result.folderBandPlan;
    expect(safe.exceptions).toEqual([]);
    expect(safe.summary.satisfactionRatio).toBe(1);

    const tension = run('FB4', true).attempt.result.folderBandPlan;
    expect(tension.exceptions).toEqual([]);
    expect(tension.rootBalance?.aboveFolderKeys.length).toBeGreaterThan(0);
    expect(tension.rootBalance?.belowFolderKeys.length).toBeGreaterThan(0);
    expect(tension.rootBalance?.topologyOverride).toBeNull();
    expect(tension.optimization?.nearestRejectedCandidate).not.toBeNull();
  });

  it('keeps exact intervals disjoint and large enough for their rank capacity', () => {
    for (const fixtureId of ['FB6', 'DB1', 'DB2', 'DB5'] as const) {
      const bands = run(fixtureId, true).attempt.result.folderBandPlan.bands;
      for (let index = 0; index < bands.length; index += 1) {
        const band = bands[index]!;
        expect(
          band.height,
          `${fixtureId}/${band.folderKey}`,
        ).toBeGreaterThanOrEqual(band.requiredHeight);
        if (index > 0)
          expect(
            bands[index - 1]!.bottomY,
            `${fixtureId}/${bands[index - 1]!.folderKey}/${band.folderKey}`,
          ).toBeLessThan(band.topY);
      }
    }
  });

  it('keeps filtered bridge folder identity out of the plan', () => {
    for (const fixtureId of ['FB8', 'DB8'] as const) {
      const { folderBandPlan } = run(fixtureId, true).attempt.result;
      expect(folderBandPlan.modulePlacements).not.toContainEqual(
        expect.objectContaining({ moduleId: expect.stringMatching(/Hidden/) }),
      );
      expect(JSON.stringify(folderBandPlan)).not.toContain('private');
    }
  });

  it('uses explicit topology exceptions and proof for every outside module', () => {
    for (const fixtureId of ['FB4', 'DB3', 'FB18'] as const) {
      const plan = run(fixtureId, true).attempt.result.folderBandPlan;
      for (const exception of plan.exceptions) {
        const placement = plan.modulePlacements.find(
          ({ moduleId }) => moduleId === exception.moduleId,
        );
        expect(placement?.status).toBe('exception-outside-own-band');
        expect(placement?.exceptionId).toBe(exception.id);
        if (exception.reason === 'crossing-guard')
          expect(exception.evidence.candidateCrossings).toBeGreaterThan(
            exception.evidence.baselineCrossings,
          );
        if (exception.reason === 'rank-order-inversion-guard')
          expect(exception.evidence.candidateInversions).toBeGreaterThan(
            exception.evidence.baselineInversions,
          );
      }
    }
  });

  it('keeps FB18 modules inside their exact bands without soft-pull drift', () => {
    const result = run('FB18', true).attempt.result;
    expect(result.folderBandPlan.exceptions).toEqual([]);
    expect(result.folderBandQuality.folderBandSatisfactionRatio).toBe(1);
    expect(
      result.folderBandPlan.modulePlacements.every(
        ({ status, distanceToOwnBand }) =>
          status === 'inside-own-band' && distanceToOwnBand === 0,
      ),
    ).toBe(true);
  });

  it('reassigns FB16 to the new exact folder and restores hidden bands exactly', () => {
    const folderMove = FOLDER_STABILITY_PAIRS.find(({ id }) => id === 'FS5')!;
    const before = runSpec(folderMove.before, true).attempt.result
      .folderBandPlan;
    const after = runSpec(folderMove.after, true).attempt.result.folderBandPlan;
    expect(
      before.modulePlacements.find(({ moduleId }) => moduleId === 'Moving'),
    ).toEqual(
      expect.objectContaining({
        folderKey: 'amber',
        status: 'inside-own-band',
      }),
    );
    expect(
      after.modulePlacements.find(({ moduleId }) => moduleId === 'Moving'),
    ).toEqual(
      expect.objectContaining({ folderKey: 'blue', status: 'inside-own-band' }),
    );

    const hidden = DIRECTIONAL_FOLDER_BAND_FIXTURES.find(
      ({ id }) => id === 'DB6',
    )!;
    const visible = { ...hidden };
    delete visible.filters;
    const first = runSpec(visible as typeof hidden, true).attempt.result;
    const filtered = runSpec(hidden, true).attempt.result;
    const restored = runSpec(visible as typeof hidden, true).attempt.result;
    expect(filtered.folderBandPlan.folderOrder).not.toContain('blue');
    expect(restored.folderBandPlan).toEqual(first.folderBandPlan);
    expect(restored.candidate).toEqual(first.candidate);
  });

  it('anchors the newly focused exact folder at the center after reroot', () => {
    const reroot = FOLDER_STABILITY_PAIRS.find(({ id }) => id === 'FS8')!;
    const before = runSpec(reroot.before, true).attempt.result.folderBandPlan;
    const after = runSpec(reroot.after, true).attempt.result.folderBandPlan;
    expect(before.bands.find(({ root }) => root)?.folderKey).toBe('root');
    expect(after.bands.find(({ root }) => root)).toEqual(
      expect.objectContaining({ folderKey: 'science', centerY: 0 }),
    );
  });

  it('balances root partitions by packed height unless topology overrides it', () => {
    const balanced = run('DB9', true).attempt.result.folderBandPlan
      .rootBalance!;
    expect(balanced.aboveFolderKeys).toHaveLength(1);
    expect(balanced.belowFolderKeys).toHaveLength(1);
    expect(balanced.topologyOverride).toBeNull();

    const unequal = run('DB10', true).attempt.result.folderBandPlan
      .rootBalance!;
    const unequalSides = [unequal.aboveFolderKeys, unequal.belowFolderKeys];
    expect(
      unequalSides.some((side) => side.length === 1 && side[0] === 'tall'),
    ).toBe(true);
    expect(
      unequalSides.some(
        (side) =>
          side.length === 2 &&
          side.includes('short-a') &&
          side.includes('short-b'),
      ),
    ).toBe(true);
    expect(unequal.topologyOverride).toBeNull();

    const guarded = run('DB11', true, 'document-order').attempt.result
      .folderBandPlan.rootBalance!;
    expect(
      guarded.aboveFolderKeys.length === 0 ||
        guarded.belowFolderKeys.length === 0,
    ).toBe(true);
    expect(guarded.packedExtentImbalance).toBeGreaterThan(
      guarded.bestUnconstrainedImbalance,
    );
    expect(guarded.topologyOverride?.reason).toMatch(
      /crossing-guard|rank-order-inversion-guard/,
    );
    const proof = guarded.topologyOverride!;
    expect(
      proof.evidence.candidateCrossings > proof.evidence.baselineCrossings ||
        proof.evidence.candidateInversions > proof.evidence.baselineInversions,
    ).toBe(true);

    const optimized = run('DB11', true, 'crossing-optimized').attempt.result
      .folderBandPlan.rootBalance!;
    expect(optimized.aboveFolderKeys).toHaveLength(1);
    expect(optimized.belowFolderKeys).toHaveLength(1);
    expect(optimized.topologyOverride).toBeNull();
  });

  it('jointly fixes DB11 and DB5 only in crossing-optimized visual order', () => {
    const documentDb11 = run('DB11', true, 'document-order').attempt.result;
    const optimizedDb11 = run('DB11', true, 'crossing-optimized').attempt
      .result;
    expect(
      documentDb11.folderBandPlan.rootBalance?.topologyOverride,
    ).not.toBeNull();
    expect(
      optimizedDb11.folderBandPlan.optimization?.selectedCandidate.metrics
        .visualSiblingOrderDeviationFromSource,
    ).toBeGreaterThan(0);
    expect(
      optimizedDb11.folderBandPlan.optimization?.visuallyReorderedBranchCount,
    ).toBeGreaterThanOrEqual(2);
    expect(
      optimizedDb11.folderBandQuality.finalExactEndpointCrossingCount,
    ).toBeLessThanOrEqual(
      documentDb11.folderBandQuality.finalExactEndpointCrossingCount,
    );

    const documentDb5 = run('DB5', true, 'document-order').attempt.result;
    const optimizedDb5 = run('DB5', true, 'crossing-optimized').attempt.result;
    expect(documentDb5.folderBandPlan.exceptions.length).toBeGreaterThan(0);
    expect(optimizedDb5.folderBandPlan.exceptions).toEqual([]);
    expect(
      optimizedDb5.folderBandPlan.rootBalance?.aboveFolderKeys,
    ).toHaveLength(1);
    expect(
      optimizedDb5.folderBandPlan.rootBalance?.belowFolderKeys,
    ).toHaveLength(1);
  });

  it('records the neutral DB12 pressure produced by the Current M0 baseline', () => {
    const result = run('DB12', true, 'crossing-optimized').attempt.result;
    const balance = result.folderBandPlan.rootBalance!;
    expect(
      balance.aboveFolderKeys.length === 0 ||
        balance.belowFolderKeys.length === 0,
    ).toBe(true);
    expect(balance.topologyOverride?.reason).toMatch(
      /crossing-guard|rank-order-inversion-guard/,
    );
    expect(
      balance.topologyOverride?.evidence.candidateCrossings,
    ).toBeGreaterThan(
      balance.topologyOverride?.evidence.baselineCrossings ?? 0,
    );
    expect(result.folderBandPlan.optimization?.endpointOrderPolicy).toBe(
      'crossing-optimized',
    );
    expect(result.folderBandPlan.optimization?.internalLayoutVariant).toBe(
      'current',
    );
    expect(result.folderBandPlan.optimization?.folderPartitionsEvaluated).toBe(
      4,
    );

    const replacement = run('DB19', true).attempt.result.folderBandPlan;
    expect(replacement.rootBalance?.topologyOverride?.reason).toBe(
      'crossing-guard',
    );
  });

  it('applies late root-balance, endpoint-span, source-order, and boundedness objectives', () => {
    const db13 = run('DB13', true).attempt.result.folderBandPlan;
    expect(db13.rootBalance?.aboveFolderKeys).toHaveLength(1);
    expect(db13.rootBalance?.belowFolderKeys).toHaveLength(1);

    const db14 = run('DB14', true).attempt.result.folderBandPlan.optimization!;
    expect(
      db14.selectedCandidate.metrics.totalPrimaryReferenceVerticalSpan,
    ).toBeLessThan(
      db14.nearestRejectedCandidate!.metrics.totalPrimaryReferenceVerticalSpan,
    );
    expect(db14.nearestRejectedCandidate?.rejectionReason).toBe(
      'longer total primary endpoint span',
    );

    const db15 = run('DB15', true).attempt.result.folderBandPlan.optimization!;
    expect(
      db15.selectedCandidate.metrics.visualSiblingOrderDeviationFromSource,
    ).toBe(0);

    const db17 = run('DB17', true).attempt.result.folderBandPlan.optimization!;
    expect(db17.jointRoundLimit).toBe(2);
    expect(db17.jointRounds).toBe(db17.folderOrderCandidatesEvaluated * 2);
    expect(db17.visuallyReorderedBranchCount).toBeGreaterThanOrEqual(2);
    expect(db17.folderPartitionsEvaluated).toBeLessThanOrEqual(64);

    const db18 = run('DB18', true).attempt.result.folderBandPlan;
    expect(db18.bands.find(({ root }) => root)?.folderKey).toBe('blue');
  });

  it('keeps secondary-only joint order and folder geometry byte-identical', () => {
    const withSecondary = DIRECTIONAL_FOLDER_BAND_FIXTURES.find(
      ({ id }) => id === 'DB16',
    )!;
    const withoutSecondary = {
      ...withSecondary,
      references: withSecondary.references.slice(0, -1),
    };
    const before = runSpec(withoutSecondary, true).attempt.result;
    const after = runSpec(withSecondary, true).attempt.result;
    expect(after.candidate).toEqual(before.candidate);
    expect(after.folderBandPlan).toEqual(before.folderBandPlan);
  });

  it('is byte-identical across input permutation and the production worker boundary', () => {
    const input = run('DB11', true, 'crossing-optimized').input;
    const policies = {
      macroLayout: 'directional-bands',
      softFolderStrength: 50,
      softFolderScopeOverrides: [],
      endpointOrderPolicy: 'crossing-optimized',
      internalLayoutVariant: 'adaptive-compass',
    } as const;
    const baseline = computeFocusSchematicComputedLayoutAttempt(
      input,
      policies,
    );
    expect(baseline.status).toBe('success');
    if (baseline.status !== 'success') return;
    const permuted = computeFocusSchematicComputedLayoutAttempt(
      {
        ...input,
        model: {
          ...input.model,
          modules: [...input.model.modules].reverse(),
          relationships: [...input.model.relationships]
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
          parentCandidates: [...input.model.parentCandidates].reverse(),
        },
        projection: {
          ...input.projection,
          nodes: [...input.projection.nodes].reverse(),
          edges: [...input.projection.edges].reverse(),
        },
      },
      policies,
    );
    expect(permuted.status).toBe('success');
    if (permuted.status !== 'success') return;
    expect(permuted.result).toEqual(baseline.result);

    const worker = handleFocusSchematicLayoutWorkerRequest(
      {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'layout',
        input,
        policies,
      },
      () => 0,
    );
    expect(worker.kind).toBe('success');
    if (worker.kind !== 'success') return;
    expect(worker.result).toEqual(baseline.result);
  });

  it('rebalances previously same-sided two-folder cases', () => {
    for (const fixtureId of ['FB9', 'FB16', 'DB4'] as const) {
      const balance = run(fixtureId, true).attempt.result.folderBandPlan
        .rootBalance!;
      expect(balance.aboveFolderKeys.length, fixtureId).toBeGreaterThan(0);
      expect(balance.belowFolderKeys.length, fixtureId).toBeGreaterThan(0);
      expect(balance.topologyOverride, fixtureId).toBeNull();
    }
  });

  it('keeps document-order local geometry and limits optimized changes to node Y', () => {
    for (const fixtureId of ['FB1', 'FB11', 'FB13', 'DB5'] as const) {
      const baseline = run(fixtureId, false).attempt.result.candidate;
      const selected = run(fixtureId, true, 'document-order').attempt.result
        .candidate;
      const beforeModule = new Map(
        baseline.modules.map((module) => [module.moduleId, module]),
      );
      const afterModule = new Map(
        selected.modules.map((module) => [module.moduleId, module]),
      );
      for (const node of selected.nodes) {
        const before = baseline.nodes.find(
          ({ projectionNodeId }) => projectionNodeId === node.projectionNodeId,
        )!;
        const beforeOwner = beforeModule.get(node.moduleId)!;
        const afterOwner = afterModule.get(node.moduleId)!;
        expect({ x: node.x, width: node.width, height: node.height }).toEqual({
          x: before.x,
          width: before.width,
          height: before.height,
        });
        expect(node.x - afterOwner.x).toBe(before.x - beforeOwner.x);
        expect(node.y - afterOwner.y).toBeCloseTo(before.y - beforeOwner.y, 10);
      }
    }

    const baseline = run('DB11', false).attempt.result.candidate;
    const optimized = run('DB11', true, 'crossing-optimized').attempt.result
      .candidate;
    for (const node of optimized.nodes) {
      const before = baseline.nodes.find(
        ({ projectionNodeId }) => projectionNodeId === node.projectionNodeId,
      )!;
      expect({ x: node.x, width: node.width, height: node.height }).toEqual({
        x: before.x,
        width: before.width,
        height: before.height,
      });
    }
  });

  it('keeps secondary-only plans, exceptions, and geometry byte-identical', () => {
    const pair = FOLDER_STABILITY_PAIRS.find(({ id }) => id === 'FS6')!;
    const results = [pair.before, pair.after].map((spec) => {
      const input = layoutInput(buildEndpointFixture(spec), {
        ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: true,
      });
      const attempt = computeFocusSchematicComputedLayoutAttempt(input);
      if (attempt.status !== 'success') throw new Error(attempt.reason);
      return attempt.result;
    });
    expect(results[1]!.folderBandPlan).toEqual(results[0]!.folderBandPlan);
    expect(results[1]!.candidate).toEqual(results[0]!.candidate);
  });

  it('rejects non-boolean mode values before layout', () => {
    const input = layoutInput(buildEndpointFixture(FOLDER_FIXTURES[0]!), {
      ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: true,
    });
    const invalid = {
      ...input,
      settings: { ...input.settings, directionalFolderBandsEnabled: 50 },
    };
    expect(
      computeFocusSchematicComputedLayoutAttempt(
        invalid as unknown as typeof input,
      ).status,
    ).toBe('failure');
  });

  it('rejects mutated plans and any non-Y geometry change', () => {
    const baseline = run('FB1', false);
    const selected = run('FB1', true);
    const { result } = selected.attempt;
    expect(
      validateSerializedFocusSchematicFolderBandPlan(
        selected.input,
        result.modulePlan,
        result.candidate,
        { ...result.folderBandPlan, rootFolderKey: 'wrong-folder' },
      ).valid,
    ).toBe(false);
    const firstModule = result.candidate.modules[0]!;
    const changed = {
      ...result.candidate,
      modules: result.candidate.modules.map((module) =>
        module.moduleId === firstModule.moduleId
          ? { ...module, x: module.x + 1 }
          : module,
      ),
    };
    expect(
      validateFocusSchematicFolderBandLayout(
        selected.input,
        result.modulePlan,
        result.endpointPlan,
        baseline.attempt.result.candidate,
        result.folderBandPlan,
        changed,
      ).valid,
    ).toBe(false);
  });
});
