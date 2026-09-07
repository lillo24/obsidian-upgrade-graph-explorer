import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  FOLDER_FIXTURES,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  INTERNAL_LAYOUT_FIXTURES,
  type EndpointFixtureSpec,
  type FocusSchematicInternalLayoutVariant,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const defaultOutput = resolve(
  repositoryRoot,
  'output/hier4a-fix2-internal-layout-benchmark.json',
);

const variants = ['current', 'vertical-spine', 'adaptive-compass'] as const;

const requiredIds = [
  'DB5',
  'DB6',
  'DB11',
  'DB12',
  'DB14',
  'DB16',
  'DB18',
  'DB19',
  'FB4',
  'VS2',
  'VS6',
  'CP1',
  'CP3',
  'CP4',
  'CP5',
] as const;

const fixtures = [
  ...FOLDER_FIXTURES,
  ...DIRECTIONAL_FOLDER_BAND_FIXTURES,
  ...INTERNAL_LAYOUT_FIXTURES,
];

function requiredFixture(id: string): EndpointFixtureSpec {
  const fixture = fixtures.find((item) => item.id === id);
  if (fixture === undefined) throw new Error(`Missing FIX2 fixture ${id}.`);
  return fixture;
}

function run(
  spec: EndpointFixtureSpec,
  variant: FocusSchematicInternalLayoutVariant,
) {
  const input = createLayoutInput(buildEndpointFixture(spec), {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: true,
  });
  const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
    endpointOrderPolicy: 'crossing-optimized',
    internalLayoutVariant: variant,
  });
  if (attempt.status !== 'success')
    throw new Error(`${spec.id}/${variant} failed: ${attempt.reason}`);
  return attempt;
}

function row(
  spec: EndpointFixtureSpec,
  variant: FocusSchematicInternalLayoutVariant,
) {
  const first = run(spec, variant);
  const second = run(spec, variant);
  const result = first.result;
  const internal = result.internalLayoutEvidence;
  const root = internal.moduleMetrics.find(
    ({ moduleId }) => moduleId === result.candidate.rootModuleId,
  );
  if (root === undefined)
    throw new Error(`${spec.id}/${variant} omitted root module metrics.`);
  const hardGateFailures = [
    ...(result.quality.moduleOverlapPairs.length > 0 ? ['module overlap'] : []),
    ...(result.quality.nodeOverlapPairs.length > 0 ? ['node overlap'] : []),
    ...(result.quality.nodeOutsideModuleIds.length > 0
      ? ['node outside module']
      : []),
    ...(result.quality.exactEndpointCrossingCount >
    result.folderBandQuality.baselineExactEndpointCrossingCount
      ? ['crossing regression']
      : []),
    ...(result.quality.adjacentRankOrderInversionCount >
    result.folderBandQuality.baselineAdjacentRankOrderInversionCount
      ? ['rank-order inversion regression']
      : []),
    ...(internal.metrics.internalHierarchyCrossingCount > 0
      ? ['internal hierarchy crossing']
      : []),
  ];
  return {
    fixtureId: spec.id,
    fixtureLabel: spec.label,
    variant,
    deterministic:
      JSON.stringify(first.result) === JSON.stringify(second.result),
    hardGates: {
      passed: hardGateFailures.length === 0,
      failures: hardGateFailures,
    },
    exactEndpointCrossings: result.quality.exactEndpointCrossingCount,
    adjacentRankOrderInversions: result.quality.adjacentRankOrderInversionCount,
    folderExceptions: result.folderBandPlan.exceptions.length,
    folderBandSatisfaction:
      result.folderBandQuality.folderBandSatisfactionRatio,
    rootBandImbalance:
      result.folderBandPlan.rootBalance?.packedExtentImbalance ?? 0,
    rootBandTopologyOverride:
      result.folderBandPlan.rootBalance?.topologyOverride?.reason ?? null,
    primaryReferenceManhattanSpan: {
      total: internal.metrics.totalPrimaryReferenceManhattanSpan,
      mean: internal.metrics.meanPrimaryReferenceManhattanSpan,
      p95: internal.metrics.p95PrimaryReferenceManhattanSpan,
    },
    primaryReferenceVerticalSpan: {
      total: internal.metrics.totalPrimaryReferenceVerticalSpan,
      mean: internal.metrics.meanPrimaryReferenceVerticalSpan,
    },
    internalHierarchyCrossings: internal.metrics.internalHierarchyCrossingCount,
    internalSourceOrderDeviation: internal.metrics.internalSourceOrderDeviation,
    internalBranchMovement: internal.metrics.totalInternalBranchMovement,
    rootModule: {
      width: root.width,
      height: root.height,
      area: root.area,
      branchesAbove: root.branchesAboveFile,
      branchesBelow: root.branchesBelowFile,
      branchesLeft: root.branchesLeftOfFile,
      branchesRight: root.branchesRightOfFile,
      packedVerticalImbalance: root.packedExtentImbalance,
    },
    search: {
      verticalSpinePlacementCandidateCap:
        internal.verticalSpinePlacementCandidateCap,
      compassAssignmentCap: internal.compassAssignmentCap,
      compassLocalRelocationSweepLimit:
        internal.compassLocalRelocationSweepLimit,
      jointFolderRoundLimit: internal.jointFolderRoundLimit,
      completeCompassAssignmentsEvaluated:
        internal.completeCompassAssignmentsEvaluated,
      placementCandidatesEvaluated: internal.placementCandidatesEvaluated,
      localRelocationSweeps: internal.localRelocationSweeps,
      jointFolderRounds: internal.jointFolderRounds,
    },
    runtimeMs: first.timings.totalMs,
  };
}

export function buildInternalLayoutBenchmarkReport() {
  const rows = requiredIds.flatMap((id) => {
    const spec = requiredFixture(id);
    return variants.map((variant) => row(spec, variant));
  });
  const byVariant = Object.fromEntries(
    variants.map((variant) => {
      const values = rows.filter((row) => row.variant === variant);
      return [
        variant,
        {
          cases: values.length,
          allHardGatesPass: values.every(({ hardGates }) => hardGates.passed),
          allDeterministic: values.every(({ deterministic }) => deterministic),
          totalCrossings: values.reduce(
            (sum, value) => sum + value.exactEndpointCrossings,
            0,
          ),
          totalFolderExceptions: values.reduce(
            (sum, value) => sum + value.folderExceptions,
            0,
          ),
          totalPrimaryManhattanSpan: values.reduce(
            (sum, value) => sum + value.primaryReferenceManhattanSpan.total,
            0,
          ),
          totalRootModuleArea: values.reduce(
            (sum, value) => sum + value.rootModule.area,
            0,
          ),
          totalRuntimeMs: values.reduce(
            (sum, value) => sum + value.runtimeMs,
            0,
          ),
        },
      ];
    }),
  );
  return {
    schemaVersion: 1,
    decision: 'INTERNAL_LAYOUT_REQUIRES_GRAPHICAL_REVIEW' as const,
    note: 'Metrics are evidence only. Current, Vertical Spine, and Adaptive Compass remain development variants until explicit graphical selection.',
    constants: {
      compassAssignmentCap: 64,
      compassLocalRelocationSweepLimit: 4,
      jointFolderRoundLimit: 2,
    },
    aggregate: {
      allHardGatesPass: rows.every(({ hardGates }) => hardGates.passed),
      allDeterministic: rows.every(({ deterministic }) => deterministic),
      rowCount: rows.length,
      byVariant,
    },
    rows,
  };
}

export async function writeInternalLayoutBenchmark(
  outputPath = defaultOutput,
): Promise<string> {
  const resolved = isAbsolute(outputPath)
    ? outputPath
    : resolve(repositoryRoot, outputPath);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(
    resolved,
    `${JSON.stringify(buildInternalLayoutBenchmarkReport(), null, 2)}\n`,
    'utf8',
  );
  return resolved;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const outputIndex = process.argv.indexOf('--out');
  const output =
    outputIndex < 0
      ? defaultOutput
      : (process.argv[outputIndex + 1] ?? defaultOutput);
  const path = await writeInternalLayoutBenchmark(output);
  process.stdout.write(`Generated ${path}\n`);
}
