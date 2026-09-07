import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareFocusSchematicLayouts } from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  ENDPOINT_FIXTURES,
  FOLDER_FIXTURES,
  FOLDER_STABILITY_PAIRS,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  type EndpointFixtureSpec,
  type FocusSchematicComputedLayoutAttempt,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
type Profile = 'fixtures' | 'stability' | 'performance' | 'all';

function profileFromArgs(): Profile {
  const index = process.argv.indexOf('--profile');
  const value = index < 0 ? 'all' : process.argv[index + 1];
  if (!['fixtures', 'stability', 'performance', 'all'].includes(value ?? ''))
    throw new Error('Expected --profile fixtures|stability|performance|all.');
  return value as Profile;
}

function inputFor(spec: EndpointFixtureSpec, enabled: boolean) {
  return createLayoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: enabled,
  });
}

function success(
  attempt: FocusSchematicComputedLayoutAttempt,
): Extract<FocusSchematicComputedLayoutAttempt, { status: 'success' }> {
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return attempt;
}

function bounds(candidate: {
  readonly modules: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
}) {
  if (candidate.modules.length === 0) return { height: 0, area: 0 };
  const left = Math.min(...candidate.modules.map(({ x }) => x));
  const right = Math.max(...candidate.modules.map(({ x, width }) => x + width));
  const top = Math.min(...candidate.modules.map(({ y }) => y));
  const bottom = Math.max(
    ...candidate.modules.map(({ y, height }) => y + height),
  );
  return { height: bottom - top, area: (right - left) * (bottom - top) };
}

function hardGates(
  attempt: Extract<FocusSchematicComputedLayoutAttempt, { status: 'success' }>,
) {
  const endpoint = attempt.result.quality;
  const folder = attempt.result.folderBandQuality;
  const plan = attempt.result.folderBandPlan;
  const balance = plan.rootBalance;
  const optimization = plan.optimization;
  const balanceOverride = balance?.topologyOverride ?? null;
  const balanceOverrideProofValid =
    balanceOverride === null ||
    (balanceOverride.reason === 'crossing-guard'
      ? balanceOverride.evidence.candidateCrossings >
        balanceOverride.evidence.baselineCrossings
      : balanceOverride.evidence.candidateInversions >
        balanceOverride.evidence.baselineInversions);
  const failures = [
    ...(endpoint.moduleOverlapPairs.length > 0 ? ['module-overlap'] : []),
    ...(endpoint.nodeOverlapPairs.length > 0 ? ['node-overlap'] : []),
    ...(endpoint.nodeOutsideModuleIds.length > 0 ? ['node-outside'] : []),
    ...(endpoint.invalidLaneTransitionEdgeIds.length > 0
      ? ['lane-transition']
      : []),
    ...(folder.finalExactEndpointCrossingCount >
    folder.baselineExactEndpointCrossingCount
      ? ['crossing-regression']
      : []),
    ...(folder.finalAdjacentRankOrderInversionCount >
    folder.baselineAdjacentRankOrderInversionCount
      ? ['inversion-regression']
      : []),
    ...(plan.enabled &&
    plan.modulePlacements.some(
      ({ status, distanceToOwnBand }) =>
        status === 'inside-own-band' && distanceToOwnBand !== 0,
    )
      ? ['false-satisfaction']
      : []),
    ...(plan.enabled &&
    plan.summary.exceptionModuleCount !== plan.exceptions.length
      ? ['exception-coverage']
      : []),
    ...(plan.enabled && balance === null ? ['missing-root-balance'] : []),
    ...(plan.enabled && optimization === null
      ? ['missing-joint-optimization']
      : []),
    ...(optimization !== null &&
    (optimization.jointRoundLimit !== 2 ||
      optimization.jointRounds !==
        optimization.folderOrderCandidatesEvaluated * 2)
      ? ['unbounded-joint-optimization']
      : []),
    ...(!plan.enabled && balance !== null ? ['disabled-root-balance'] : []),
    ...(balance !== null &&
    balance.packedExtentImbalance > balance.bestUnconstrainedImbalance + 1e-6 &&
    balanceOverride === null
      ? ['unexplained-root-imbalance']
      : []),
    ...(!balanceOverrideProofValid ? ['invalid-root-balance-proof'] : []),
  ];
  return { passed: failures.length === 0, failures };
}

function summarize(
  spec: EndpointFixtureSpec,
  enabled: boolean,
  profileName?: string,
  endpointOrderPolicy:
    'document-order' | 'crossing-optimized' = 'crossing-optimized',
) {
  const started = performance.now();
  const first = success(
    computeFocusSchematicComputedLayoutAttempt(inputFor(spec, enabled), {
      endpointOrderPolicy,
    }),
  );
  const elapsedMs = performance.now() - started;
  const second = success(
    computeFocusSchematicComputedLayoutAttempt(inputFor(spec, enabled), {
      endpointOrderPolicy,
    }),
  );
  const folder = first.result.folderBandQuality;
  const optimization = first.result.folderBandPlan.optimization;
  return {
    fixtureId: spec.id,
    fixtureLabel: spec.label,
    ...(profileName === undefined ? {} : { profileName }),
    mode: enabled ? ('on' as const) : ('off' as const),
    visibleFolders: folder.visibleFolderCount,
    visibleFiles: folder.visibleModuleCount,
    satisfiedFiles: folder.folderBandSatisfiedModuleCount,
    exceptions: folder.folderBandExceptionModuleCount,
    satisfactionRatio: folder.folderBandSatisfactionRatio,
    exceptionReasons: first.result.folderBandPlan.exceptions.reduce<
      Record<string, number>
    >((counts, exception) => {
      counts[exception.reason] = (counts[exception.reason] ?? 0) + 1;
      return counts;
    }, {}),
    rootBalance:
      first.result.folderBandPlan.rootBalance === null
        ? null
        : {
            aboveFolders:
              first.result.folderBandPlan.rootBalance.aboveFolderKeys,
            belowFolders:
              first.result.folderBandPlan.rootBalance.belowFolderKeys,
            abovePackedExtent:
              first.result.folderBandPlan.rootBalance.abovePackedExtent,
            belowPackedExtent:
              first.result.folderBandPlan.rootBalance.belowPackedExtent,
            packedExtentImbalance:
              first.result.folderBandPlan.rootBalance.packedExtentImbalance,
            bestUnconstrainedImbalance:
              first.result.folderBandPlan.rootBalance
                .bestUnconstrainedImbalance,
            topologyOverrideReason:
              first.result.folderBandPlan.rootBalance.topologyOverride
                ?.reason ?? null,
          },
    endpointOrderPolicy: optimization?.endpointOrderPolicy ?? null,
    primaryReferenceVerticalSpan:
      optimization === null
        ? null
        : {
            total:
              optimization.selectedCandidate.metrics
                .totalPrimaryReferenceVerticalSpan,
            mean: optimization.selectedCandidate.metrics
              .meanPrimaryReferenceVerticalSpan,
            p95: optimization.selectedCandidate.metrics
              .p95PrimaryReferenceVerticalSpan,
            maximum:
              optimization.selectedCandidate.metrics
                .maximumPrimaryReferenceVerticalSpan,
          },
    visualSiblingOrderDeviationFromSource:
      optimization?.selectedCandidate.metrics
        .visualSiblingOrderDeviationFromSource ?? null,
    visuallyReorderedBranchCount:
      optimization?.visuallyReorderedBranchCount ?? null,
    jointOptimizer:
      optimization === null
        ? null
        : {
            folderPartitionsEvaluated: optimization.folderPartitionsEvaluated,
            folderOrderCandidatesEvaluated:
              optimization.folderOrderCandidatesEvaluated,
            candidateLocalHeadingReorderSweeps:
              optimization.candidateLocalHeadingReorderSweeps,
            rankOrderSweeps: optimization.rankOrderSweeps,
            jointRounds: optimization.jointRounds,
            crossingMetricEvaluations: optimization.crossingMetricEvaluations,
          },
    nearestRejectedCandidate: optimization?.nearestRejectedCandidate ?? null,
    hardGates: hardGates(first),
    deterministic:
      JSON.stringify(first.result) === JSON.stringify(second.result),
    exactEndpointCrossings: {
      baseline: folder.baselineExactEndpointCrossingCount,
      final: folder.finalExactEndpointCrossingCount,
    },
    adjacentRankInversions: {
      baseline: folder.baselineAdjacentRankOrderInversionCount,
      final: folder.finalAdjacentRankOrderInversionCount,
    },
    endpointVerticalError: {
      baselineMean: folder.baselineMeanEndpointVerticalError,
      finalMean: folder.finalMeanEndpointVerticalError,
      baselineP95: folder.baselineP95EndpointVerticalError,
      finalP95: folder.finalP95EndpointVerticalError,
    },
    rankFolderFragments: folder.rankFolderFragmentCount,
    meanDistanceToOwnBand: folder.meanDistanceToOwnBand,
    p95DistanceToOwnBand: folder.p95DistanceToOwnBand,
    maximumDistanceToOwnBand: folder.maximumDistanceToOwnBand,
    totalExceptionDistance: folder.totalExceptionDistance,
    maximumExceptionDistance: folder.maximumExceptionDistance,
    rootFolderOffset: folder.rootFolderMeanAbsoluteOffset,
    meanModuleDisplacement: folder.meanFolderModuleDisplacement,
    p95ModuleDisplacement: folder.p95FolderModuleDisplacement,
    maximumModuleDisplacement: folder.maximumFolderModuleDisplacement,
    ...bounds(first.result.candidate),
    runtimeMs: Number(elapsedMs.toFixed(3)),
    phases: first.timings,
  };
}

function generatedFolderFixture(
  seed: number,
  moduleCount: number,
  folderCount: number,
  singletonBias = 0,
): EndpointFixtureSpec {
  const folderKeys = Array.from(
    { length: Math.max(1, folderCount - 1) },
    (_, index) => `folder-${seed}-${index + 1}`,
  );
  const documents = [
    { id: 'Focus', path: 'root/Focus.md' },
    ...Array.from({ length: moduleCount - 1 }, (_, index) => {
      const unique = index < singletonBias;
      const folder = unique
        ? `singleton-${seed}-${index}`
        : folderKeys[(index * 17 + seed * 13) % folderKeys.length]!;
      return {
        id: `Seed-${seed}-${index + 1}`,
        path: `${folder}/N-${index + 1}.md`,
      };
    }),
  ];
  const nearCount = Math.max(1, Math.min(120, Math.floor(moduleCount / 2)));
  const references = documents.slice(1).map((document, index) =>
    index < nearCount
      ? { sourceEntityId: 'Focus', targetEntityId: document.id }
      : {
          sourceEntityId: documents[1 + (index % nearCount)]!.id,
          targetEntityId: document.id,
        },
  );
  return {
    id: `FB${4000 + seed}`,
    label: `generated directional folder seed ${seed}`,
    authored:
      'Deterministic exact-folder corpus with singleton and repeated folders.',
    expectation:
      'Categorical ownership, explicit exceptions, and hard graph gates remain deterministic.',
    inspect: 'Aggregate evidence only.',
    rootDocumentId: 'Focus',
    documents,
    references,
    hops: 2,
  };
}

function generatedHeadingFixture(
  seed: number,
  headingCount: number,
): EndpointFixtureSpec {
  const documents = [
    { id: 'Focus', path: 'root/Focus.md' },
    ...Array.from({ length: headingCount }, (_, index) => ({
      id: `Target-${seed}-${index + 1}`,
      path: `folder-${(index % 6) + 1}/Target-${index + 1}.md`,
    })),
  ];
  return {
    id: `DB${5000 + seed}`,
    label: `${headingCount} reorderable Heading stress`,
    authored: 'Deterministic synthetic sibling-Heading stress topology.',
    expectation:
      'Adjacent branch refinement remains bounded at large sibling counts.',
    inspect: 'Aggregate joint-optimizer timing and candidate accounting.',
    rootDocumentId: 'Focus',
    documents,
    entities: Array.from({ length: headingCount }, (_, index) => ({
      id: `Focus-H${index + 1}`,
      kind: 'section' as const,
      documentId: 'Focus',
      parentId: 'Focus',
      line: index * 2 + 2,
      title: `Focus-H${index + 1}`,
    })),
    references: documents.slice(1).map((document, index) => ({
      sourceEntityId: `Focus-H${headingCount - index}`,
      targetEntityId: document.id,
    })),
    hops: 1,
  };
}

function fixtureEvidence(specs: readonly EndpointFixtureSpec[]) {
  return specs.flatMap((spec) => [
    summarize(spec, false),
    summarize(spec, true),
  ]);
}

function stabilityEvidence() {
  return FOLDER_STABILITY_PAIRS.map((pair) => {
    const beforeFixture = buildEndpointFixture(pair.before);
    const afterFixture = buildEndpointFixture(pair.after);
    const before = success(
      computeFocusSchematicComputedLayoutAttempt(
        createLayoutInput(beforeFixture, {
          ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
          directionalFolderBandsEnabled: true,
        }),
      ),
    );
    const after = success(
      computeFocusSchematicComputedLayoutAttempt(
        createLayoutInput(afterFixture, {
          ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
          directionalFolderBandsEnabled: true,
        }),
      ),
    );
    const beforeBands = new Map(
      before.result.folderBandPlan.bands.map(({ folderKey, centerY }) => [
        folderKey,
        centerY,
      ]),
    );
    const sharedBandDisplacement = after.result.folderBandPlan.bands.flatMap(
      ({ folderKey, centerY }) => {
        const previous = beforeBands.get(folderKey);
        return previous === undefined ? [] : [Math.abs(centerY - previous)];
      },
    );
    return {
      id: pair.id,
      moduleStability: compareFocusSchematicLayouts({
        beforeModel: beforeFixture.model,
        beforeLayout: before.result.candidate,
        afterModel: afterFixture.model,
        afterLayout: after.result.candidate,
      }),
      meanSharedBandCenterDisplacement:
        sharedBandDisplacement.length === 0
          ? null
          : sharedBandDisplacement.reduce((sum, value) => sum + value, 0) /
            sharedBandDisplacement.length,
      folderOrderBefore: before.result.folderBandPlan.folderOrder,
      folderOrderAfter: after.result.folderBandPlan.folderOrder,
      geometryByteIdentical:
        JSON.stringify(before.result.candidate) ===
        JSON.stringify(after.result.candidate),
      planByteIdentical:
        JSON.stringify(before.result.folderBandPlan) ===
        JSON.stringify(after.result.folderBandPlan),
    };
  });
}

function revision2Hashes() {
  return ENDPOINT_FIXTURES.map((spec) => {
    const attempt = success(
      computeFocusSchematicComputedLayoutAttempt(inputFor(spec, false)),
    );
    return {
      fixtureId: spec.id,
      sha256: createHash('sha256')
        .update(JSON.stringify(attempt.result.candidate))
        .digest('hex'),
    };
  });
}

const profile = profileFromArgs();
const fixedRows =
  profile === 'stability'
    ? []
    : fixtureEvidence([
        ...FOLDER_FIXTURES,
        ...DIRECTIONAL_FOLDER_BAND_FIXTURES,
      ]);
const requiredPerformanceFixture = (
  id: string,
  collection: readonly EndpointFixtureSpec[],
) => {
  const fixture = collection.find((item) => item.id === id);
  if (fixture === undefined)
    throw new Error(`Missing directional folder performance fixture ${id}.`);
  return fixture;
};
const performanceProfiles = [
  { profileName: 'small', spec: generatedFolderFixture(1, 18, 6) },
  { profileName: 'medium', spec: generatedFolderFixture(7, 64, 12) },
  {
    profileName: '500-module hub',
    spec: generatedFolderFixture(23, 500, 8),
  },
  {
    profileName: 'many singleton folders',
    spec: generatedFolderFixture(41, 48, 20, 18),
  },
  {
    profileName: 'few large folders',
    spec: generatedFolderFixture(53, 96, 3),
  },
  {
    profileName: 'mixed singleton/repeated',
    spec: generatedFolderFixture(67, 80, 14, 8),
  },
  {
    profileName: 'contradictory folder-order constraints',
    spec: requiredPerformanceFixture('DB3', DIRECTIONAL_FOLDER_BAND_FIXTURES),
  },
  {
    profileName: 'endpoint-rich fan',
    spec: requiredPerformanceFixture('FB12', FOLDER_FIXTURES),
  },
  {
    profileName: '20 reorderable Headings',
    spec: generatedHeadingFixture(71, 20),
  },
  {
    profileName: '100 Heading stress',
    spec: generatedHeadingFixture(73, 100),
  },
];
const generatedRows =
  profile === 'performance' || profile === 'all'
    ? performanceProfiles.flatMap(({ profileName, spec }) => [
        summarize(spec, false, profileName),
        summarize(spec, true, profileName),
      ])
    : [];
const allRows = [...fixedRows, ...generatedRows];
const policyComparisonRows =
  profile === 'fixtures' || profile === 'all'
    ? ['FB4', 'DB5', 'DB11', 'DB12'].flatMap((id) => {
        const spec = [
          ...FOLDER_FIXTURES,
          ...DIRECTIONAL_FOLDER_BAND_FIXTURES,
        ].find((item) => item.id === id);
        if (spec === undefined)
          throw new Error(`Missing policy fixture ${id}.`);
        return (['document-order', 'crossing-optimized'] as const).map(
          (endpointOrderPolicy) =>
            summarize(
              spec,
              true,
              `policy comparison · ${endpointOrderPolicy}`,
              endpointOrderPolicy,
            ),
        );
      })
    : [];
const allHardGatesPass = allRows.every(
  ({ hardGates, deterministic }) => hardGates.passed && deterministic,
);
const report = {
  schemaVersion: 4,
  profile,
  modes: ['off', 'on'],
  decisionState: allHardGatesPass
    ? 'REQUIRES_GRAPHICAL_REVIEW'
    : 'DIRECTIONAL_BANDS_REQUIRE_REDESIGN',
  rejectedPrototype:
    'The previous 0/25/50/75/100 directional pull is retained only in branch history as experimental evidence.',
  revision2CandidateHashes:
    profile === 'fixtures' || profile === 'all' ? revision2Hashes() : [],
  fixtureRows: fixedRows,
  policyComparisonRows,
  generatedRows,
  stabilityRows:
    profile === 'fixtures' || profile === 'performance'
      ? []
      : stabilityEvidence(),
  aggregate: {
    allHardGatesPass,
    onCases: allRows.filter(({ mode }) => mode === 'on').length,
    totalVisibleFilesOn: allRows
      .filter(({ mode }) => mode === 'on')
      .reduce((sum, row) => sum + row.visibleFiles, 0),
    totalExceptionsOn: allRows
      .filter(({ mode }) => mode === 'on')
      .reduce((sum, row) => sum + row.exceptions, 0),
  },
};
const output = `${JSON.stringify(report, null, 2)}\n`;
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
  const requested =
    process.argv[outIndex + 1] ??
    'output/hier4a-directional-folder-bands-benchmark.json';
  const target = resolve(repositoryRoot, requested);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, output, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ target, decisionState: report.decisionState, aggregate: report.aggregate })}\n`,
  );
} else process.stdout.write(output);
