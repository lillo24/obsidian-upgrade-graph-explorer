import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  LOCAL_CONVERGENCE_ALL_P90_THRESHOLD,
  LOCAL_CONVERGENCE_BATCH_ITERATIONS,
  LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED,
} from '@icarus-graph-explorer/renderer-sigma/local-convergence';

import {
  convergenceFixtures,
  type ConvergenceFixture,
} from './convergence-fixtures';
import {
  deterministicIterationCap,
  diagnosticWallTimeLimitMs,
  evaluateCandidate,
  evidenceDerivedThresholds,
  fixturePositions,
  globalFolderMacroEvidence,
  movementCurve,
  positionsEqual,
  productionDrift,
  publicBatchComparison,
  runPublicBatches,
  type CandidateEvaluation,
  type CandidateGuard,
} from './convergence-candidates';
import {
  measureDisplacement,
  percentile,
  roundEvidence,
  type ConvergenceAlignment,
  type ConvergencePosition,
} from './convergence-metrics';

const BATCH_SIZES = [20, 32, 40] as const;
const STABLE_BATCH_COUNTS = [2, 3, 4] as const;
const GUARDS = [
  'all-p90',
  'low-degree-p90',
  'bounded-low-degree-maximum',
] as const satisfies readonly CandidateGuard[];
const LONG_RUN_ITERATIONS = 1_000;
const ACCEPTED_EVIDENCE_THRESHOLDS = [0.000672, 0.00204, 0.00512] as const;

interface CandidateWithReference {
  readonly evaluation: CandidateEvaluation;
  readonly referenceP90: number;
}

interface VisualState {
  readonly title: string;
  readonly positions: readonly ConvergencePosition[];
}

interface VisualCase {
  readonly fixture: ConvergenceFixture;
  readonly states: readonly VisualState[];
  readonly probeFrom: readonly ConvergencePosition[];
  readonly probeTo: readonly ConvergencePosition[];
  readonly note: string;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function cv(values: readonly number[]): number {
  const average = mean(values);
  if (values.length === 0 || average === 0) return 0;
  return (
    Math.sqrt(mean(values.map((value) => (value - average) ** 2))) / average
  );
}

function fixtureAlignment(fixture: ConvergenceFixture): ConvergenceAlignment {
  return fixture.mode === 'focus'
    ? { kind: 'root', rootKey: fixture.request.rootKey }
    : { kind: 'centroid' };
}

function fixtureEdges(fixture: ConvergenceFixture) {
  return fixture.request.edges.map(({ source, target }) => ({
    source,
    target,
  }));
}

function representativeBatchCases(fixtures: readonly ConvergenceFixture[]) {
  const completeIds = new Set([
    'focus-five-star',
    'focus-root-weak-and-isolated',
    'global-small-connected',
  ]);
  const broaderIds = new Set([
    'focus-fifty-mixed',
    'focus-long-chain',
    'focus-hierarchy-heavy',
    'focus-reference-heavy',
    'global-small-isolates',
    'global-medium-mixed',
    'global-folder-off-reference-only',
  ]);
  return fixtures.flatMap((fixture) => {
    if (
      fixture.mode === 'global' &&
      fixture.request.algorithm !== 'reference-only'
    ) {
      return [];
    }
    const totals = completeIds.has(fixture.id)
      ? [60, 100, 160, 320, 640, 1_000]
      : broaderIds.has(fixture.id)
        ? [fixture.currentBudget, 160, 320]
        : [];
    return totals.flatMap((totalIterations) =>
      BATCH_SIZES.flatMap((batchSize) =>
        (['reuse', 'rebuild'] as const).map((form) => ({
          fixture,
          totalIterations,
          batchSize,
          form,
        })),
      ),
    );
  });
}

function candidateKey(evaluation: CandidateEvaluation): string {
  return [
    evaluation.batchSize,
    evaluation.threshold,
    evaluation.stableBatchesRequired,
    evaluation.guard,
  ].join('|');
}

function aggregateCandidates(rows: readonly CandidateWithReference[]) {
  const groups = new Map<string, CandidateWithReference[]>();
  for (const row of rows) {
    const key = candidateKey(row.evaluation);
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }
  return [...groups.values()]
    .map((values) => {
      const first = values[0]!.evaluation;
      const stable = values.filter(
        ({ evaluation }) => evaluation.stopReason === 'stable',
      );
      const probes = stable.flatMap(({ evaluation }) =>
        evaluation.probeMovement?.all.p90 === null ||
        evaluation.probeMovement === null
          ? []
          : [evaluation.probeMovement.all.p90],
      );
      const lowDegreeProbeMaximums = stable.flatMap(({ evaluation }) =>
        evaluation.probeMovement?.lowDegree.maximum === null ||
        evaluation.probeMovement === null
          ? []
          : [evaluation.probeMovement.lowDegree.maximum],
      );
      return {
        batchSize: first.batchSize,
        threshold: first.threshold,
        stableBatchesRequired: first.stableBatchesRequired,
        guard: first.guard,
        fixtures: values.length,
        stable: stable.length,
        maxIterations: values.filter(
          ({ evaluation }) => evaluation.stopReason === 'max-iterations',
        ).length,
        maxWallTime: values.filter(
          ({ evaluation }) => evaluation.stopReason === 'max-wall-time',
        ).length,
        meanIterations: mean(
          values.map(({ evaluation }) => evaluation.iterationsCompleted),
        ),
        p90Iterations: percentile(
          values.map(({ evaluation }) => evaluation.iterationsCompleted),
          0.9,
        ),
        falseEarlyStops: stable.filter(
          ({ evaluation }) =>
            (evaluation.probeMovement?.all.p90 ?? Number.POSITIVE_INFINITY) >
            evaluation.threshold,
        ).length,
        probeP90Median: percentile(probes, 0.5),
        probeP90Maximum: probes.length === 0 ? null : Math.max(...probes),
        lowDegreeProbeMaximumP90: percentile(lowDegreeProbeMaximums, 0.9),
        referenceP90Median: percentile(
          values.map(({ referenceP90 }) => referenceP90),
          0.5,
        ),
        referenceP90Maximum: Math.max(
          ...values.map(({ referenceP90 }) => referenceP90),
        ),
      };
    })
    .sort(
      (left, right) =>
        left.batchSize - right.batchSize ||
        left.threshold - right.threshold ||
        left.stableBatchesRequired - right.stableBatchesRequired ||
        left.guard.localeCompare(right.guard),
    );
}

function stripCandidatePositions(value: CandidateEvaluation) {
  return {
    fixtureId: value.fixtureId,
    batchSize: value.batchSize,
    threshold: value.threshold,
    stableBatchesRequired: value.stableBatchesRequired,
    guard: value.guard,
    maxIterations: value.maxIterations,
    maxWallTimeMs: value.maxWallTimeMs,
    stopReason: value.stopReason,
    iterationsCompleted: value.iterationsCompleted,
    batchesCompleted: value.batchesCompleted,
    stableBatches: value.stableBatches,
    computeMs: value.computeMs,
    finalMovement: value.finalMovement,
    probeMovement: value.probeMovement,
  };
}

function alignmentNormalizedPositions(
  fixture: ConvergenceFixture,
  positions: readonly ConvergencePosition[],
): readonly ConvergencePosition[] {
  let x = 0;
  let y = 0;
  if (fixture.mode === 'focus') {
    const root = positions.find(({ key }) => key === fixture.request.rootKey);
    if (root === undefined) {
      throw new Error(`Visual case ${fixture.id} omitted its root.`);
    }
    x = root.x;
    y = root.y;
  } else {
    x = mean(positions.map((position) => position.x));
    y = mean(positions.map((position) => position.y));
  }
  return positions.map((position) => ({
    key: position.key,
    x: position.x - x,
    y: position.y - y,
  }));
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svgCase(value: VisualCase): string {
  const width = 260;
  const height = 220;
  const padding = 18;
  const normalizedStates = value.states.map((state) => ({
    ...state,
    positions: alignmentNormalizedPositions(value.fixture, state.positions),
  }));
  const normalizedProbeFrom = alignmentNormalizedPositions(
    value.fixture,
    value.probeFrom,
  );
  const normalizedProbeTo = alignmentNormalizedPositions(
    value.fixture,
    value.probeTo,
  );
  const all = [
    ...normalizedStates.flatMap(({ positions }) => positions),
    ...normalizedProbeFrom,
    ...normalizedProbeTo,
  ];
  const minimumX = Math.min(...all.map(({ x }) => x));
  const maximumX = Math.max(...all.map(({ x }) => x));
  const minimumY = Math.min(...all.map(({ y }) => y));
  const maximumY = Math.max(...all.map(({ y }) => y));
  const scale = Math.min(
    (width - padding * 2) / Math.max(1e-6, maximumX - minimumX),
    (height - padding * 2) / Math.max(1e-6, maximumY - minimumY),
  );
  const point = (position: ConvergencePosition) => ({
    x: padding + (position.x - minimumX) * scale,
    y: height - padding - (position.y - minimumY) * scale,
  });
  const degrees = new Map<string, number>(
    value.fixture.request.nodes.map(({ key }) => [key, 0] as const),
  );
  for (const edge of value.fixture.request.edges) {
    degrees.set(edge.source, degrees.get(edge.source)! + 1);
    degrees.set(edge.target, degrees.get(edge.target)! + 1);
  }
  const stateSvg = normalizedStates
    .map((state) => {
      const byKey = new Map(
        state.positions.map((position) => [position.key, position] as const),
      );
      const edgeSvg = value.fixture.request.edges
        .map((edge) => {
          const source = point(byKey.get(edge.source)!);
          const target = point(byKey.get(edge.target)!);
          return `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"/>`;
        })
        .join('');
      const nodeSvg = state.positions
        .map((position) => {
          const screen = point(position);
          const degree = degrees.get(position.key) ?? 0;
          const fill =
            degree === 0 ? '#d66c5c' : degree === 1 ? '#d6a44f' : '#4c91a8';
          return `<circle cx="${screen.x}" cy="${screen.y}" r="${degree <= 1 ? 4 : 3}" fill="${fill}"/>`;
        })
        .join('');
      return `<figure><figcaption>${xml(state.title)}</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(value.fixture.id)} ${xml(state.title)}"><g class="edges">${edgeSvg}</g>${nodeSvg}</svg></figure>`;
    })
    .join('');
  const fromByKey = new Map(
    normalizedProbeFrom.map((position) => [position.key, position] as const),
  );
  const probeArrows = normalizedProbeTo
    .map((after) => {
      const before = point(fromByKey.get(after.key)!);
      const next = point(after);
      return `<line class="arrow" x1="${before.x}" y1="${before.y}" x2="${next.x}" y2="${next.y}" marker-end="url(#arrowhead)"/>`;
    })
    .join('');
  const probeNodes = normalizedProbeFrom
    .map((position) => {
      const screen = point(position);
      return `<circle cx="${screen.x}" cy="${screen.y}" r="3" fill="#4c91a8"/>`;
    })
    .join('');
  return `<section><h2>${xml(value.fixture.id)}</h2><p>${xml(value.note)}</p><div class="panels">${stateSvg}<figure><figcaption>hidden post-stop probe</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(value.fixture.id)} post-stop probe"><defs><marker id="arrowhead" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" fill="#7f5aa2"/></marker></defs>${probeNodes}${probeArrows}</svg></figure></div></section>`;
}

function comparisonHtml(cases: readonly VisualCase[]): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CONVERGENCE1A ForceAtlas2 comparison</title><style>
body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#24313a;background:#f7f8fa}h1{margin-bottom:6px}section{margin:26px 0;padding:18px;background:white;border:1px solid #d8dee4;border-radius:10px}.panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}figure{margin:0;border:1px solid #e1e5e8;border-radius:8px;padding:8px}figcaption{font-weight:650;margin-bottom:5px}svg{width:100%;height:auto;background:#fbfcfd}.edges line{stroke:#c4cbd1;stroke-width:1}.arrow{stroke:#7f5aa2;stroke-width:1.5;opacity:.8}.legend span{display:inline-block;margin-right:15px}.dot{width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}</style></head><body><h1>CONVERGENCE1A ForceAtlas2 batch-convergence evidence</h1><p>Synthetic deterministic fixtures; shared per-fixture extents. Long-run frames are comparison references, not mathematical truth. Purple arrows show one unaccepted public probe batch.</p><p class="legend"><span><i class="dot" style="background:#4c91a8"></i>degree ≥2</span><span><i class="dot" style="background:#d6a44f"></i>degree 1</span><span><i class="dot" style="background:#d66c5c"></i>degree 0</span></p>${cases.map(svgCase).join('')}</body></html>\n`;
}

function main(): void {
  const outputDirectory = fileURLToPath(
    new URL('../../../output/convergence1a/', import.meta.url),
  );
  const fixtures = convergenceFixtures();
  const drift = fixtures.map(productionDrift);
  const eligible = fixtures.filter(
    (fixture) =>
      fixture.mode === 'focus' ||
      fixture.request.algorithm === 'reference-only',
  );
  const curves = eligible.flatMap((fixture) =>
    BATCH_SIZES.map((batchSize) => ({
      fixture,
      curve: movementCurve(fixture, batchSize),
    })),
  );
  const observedThresholds = evidenceDerivedThresholds(curves);
  const thresholds = ACCEPTED_EVIDENCE_THRESHOLDS;
  const longReferences = new Map(
    eligible.map((fixture) => [
      fixture.id,
      runPublicBatches({
        fixture,
        start: fixturePositions(fixture),
        totalIterations: LONG_RUN_ITERATIONS,
        batchSize: LONG_RUN_ITERATIONS,
        form: 'reuse',
      }).positions,
    ]),
  );
  const evaluated: CandidateWithReference[] = [];
  for (const { fixture, curve } of curves) {
    const maxIterations = deterministicIterationCap(
      fixture.mode,
      fixture.request.nodes.length,
    );
    for (const threshold of thresholds) {
      for (const stableBatchesRequired of STABLE_BATCH_COUNTS) {
        for (const guard of GUARDS) {
          const evaluation = evaluateCandidate({
            fixture,
            curve,
            threshold,
            stableBatchesRequired,
            guard,
            maxIterations,
            maxWallTimeMs: diagnosticWallTimeLimitMs(fixture.mode),
          });
          const reference = longReferences.get(fixture.id)!;
          const divergence = measureDisplacement({
            before: reference,
            after: evaluation.finalPositions,
            edges: fixtureEdges(fixture),
            alignment: fixtureAlignment(fixture),
          });
          evaluated.push({
            evaluation,
            referenceP90: divergence.all.p90 ?? 0,
          });
        }
      }
    }
  }
  const selectedPolicy = {
    batchSize: LOCAL_CONVERGENCE_BATCH_ITERATIONS,
    threshold: LOCAL_CONVERGENCE_ALL_P90_THRESHOLD,
    stableBatchesRequired: LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED,
    guard: 'bounded-low-degree-maximum' as const,
  };
  const selectedEvaluations = new Map(
    evaluated
      .filter(
        ({ evaluation }) =>
          evaluation.batchSize === selectedPolicy.batchSize &&
          evaluation.threshold === selectedPolicy.threshold &&
          evaluation.stableBatchesRequired ===
            selectedPolicy.stableBatchesRequired &&
          evaluation.guard === selectedPolicy.guard,
      )
      .map(({ evaluation }) => [evaluation.fixtureId, evaluation]),
  );
  const comparisons = representativeBatchCases(fixtures).map(
    publicBatchComparison,
  );
  const formEquivalence = [
    'focus-root-weak-and-isolated',
    'global-small-connected',
  ].map((fixtureId) => {
    const fixture = fixtures.find(({ id }) => id === fixtureId)!;
    const start = fixturePositions(fixture);
    const reused = runPublicBatches({
      fixture,
      start,
      totalIterations: 320,
      batchSize: 32,
      form: 'reuse',
    });
    const rebuilt = runPublicBatches({
      fixture,
      start,
      totalIterations: 320,
      batchSize: 32,
      form: 'rebuild',
    });
    return {
      fixtureId,
      identicalCoordinates: positionsEqual(reused.positions, rebuilt.positions),
      rebuiltOverheadPercent:
        reused.computeMs === 0
          ? 0
          : ((rebuilt.computeMs - reused.computeMs) / reused.computeMs) * 100,
      endpointMovement: measureDisplacement({
        before: reused.positions,
        after: rebuilt.positions,
        edges: fixtureEdges(fixture),
        alignment: fixtureAlignment(fixture),
      }),
    };
  });
  const deterministicRepeats = [
    'focus-five-star',
    'focus-root-weak-and-isolated',
    'global-small-connected',
  ].map((fixtureId) => {
    const fixture = fixtures.find(({ id }) => id === fixtureId)!;
    const run = () =>
      runPublicBatches({
        fixture,
        start: fixturePositions(fixture),
        totalIterations: 320,
        batchSize: 32,
        form: 'reuse',
      }).positions;
    return { fixtureId, exact: positionsEqual(run(), run()) };
  });
  const folderMacros = fixtures
    .filter(
      (fixture) =>
        fixture.mode === 'global' &&
        fixture.request.algorithm === 'chunked-prior',
    )
    .map((fixture) => globalFolderMacroEvidence(fixture));
  const endpointPerIteration = eligible.map((fixture) => {
    const values = BATCH_SIZES.map((batchSize) => {
      const curve = curves.find(
        (value) =>
          value.fixture.id === fixture.id &&
          value.curve.batchSize === batchSize,
      )!.curve;
      const snapshot = curve.snapshots.find(
        (value) => value.iterationsCompleted >= fixture.currentBudget,
      )!;
      return {
        batchSize,
        endpointP90: snapshot.movement.all.p90 ?? 0,
        perIterationP90:
          (snapshot.movement.all.p90 ?? 0) / snapshot.batchIterations,
      };
    });
    return {
      fixtureId: fixture.id,
      values,
      endpointCoefficientOfVariation: cv(
        values.map(({ endpointP90 }) => endpointP90),
      ),
      perIterationCoefficientOfVariation: cv(
        values.map(({ perIterationP90 }) => perIterationP90),
      ),
    };
  });

  const visualIds = [
    'focus-five-star',
    'focus-root-weak-and-isolated',
    'focus-long-chain',
    'global-small-connected',
  ];
  const visualCases: VisualCase[] = visualIds.map((fixtureId) => {
    const fixture = fixtures.find(({ id }) => id === fixtureId)!;
    const current = drift.find((value) => value.fixtureId === fixtureId)!;
    const candidate = selectedEvaluations.get(fixtureId)!;
    const reference = longReferences.get(fixtureId)!;
    return {
      fixture,
      states: [
        { title: 'current fixed budget', positions: current.a },
        {
          title: `diagnostic policy (${candidate.stopReason}, ${candidate.iterationsCompleted} iters)`,
          positions: candidate.finalPositions,
        },
        { title: '1,000-iteration one-shot reference', positions: reference },
      ],
      probeFrom: candidate.finalPositions,
      probeTo: candidate.probePositions ?? candidate.finalPositions,
      note: 'The diagnostic candidate is accepted before, not after, the probe batch.',
    };
  });
  const folderFixture = fixtures.find(
    ({ id }) => id === 'global-folder-on-chunked-prior',
  )!;
  if (folderFixture.mode !== 'global') {
    throw new Error('Expected the folder-prior visual fixture to be Global.');
  }
  const folderEvidence = folderMacros.find(
    ({ fixtureId }) => fixtureId === folderFixture.id,
  )!;
  const folderProbe = runPublicBatches({
    fixture: {
      ...folderFixture,
      request: {
        ...folderFixture.request,
        algorithm: 'reference-only',
        settings: {
          ...folderFixture.request.settings,
          folderClustering: false,
        },
      },
    },
    start: folderEvidence.g3PureFa2Tail.positions,
    totalIterations: 32,
    batchSize: 32,
    form: 'reuse',
  }).positions;
  visualCases.push({
    fixture: folderFixture,
    states: [
      {
        title: 'current folder-prior macro-run',
        positions: folderEvidence.current.positions,
      },
      {
        title: 'G3 pure-FA2 tail (examined, not adopted)',
        positions: folderEvidence.g3PureFa2Tail.positions,
      },
      {
        title: 'G1 repeated whole macro-run',
        positions: folderEvidence.g1RepeatedWholeRun.positions,
      },
    ],
    probeFrom: folderEvidence.g3PureFa2Tail.positions,
    probeTo: folderProbe,
    note: 'Global keeps its current lifecycle in the recommendation; G1 and G3 reveal the two result-affecting risks for a later macro-step task.',
  });

  const aggregate = aggregateCandidates(evaluated);
  const selectedAggregate = aggregate.find(
    (value) =>
      value.batchSize === selectedPolicy.batchSize &&
      value.threshold === selectedPolicy.threshold &&
      value.stableBatchesRequired === selectedPolicy.stableBatchesRequired &&
      value.guard === selectedPolicy.guard,
  )!;
  const result = {
    schemaVersion: 1,
    generatedBy: 'pnpm analyze:forceatlas2-convergence',
    dependencyVersions: {
      graphology: '0.26.0',
      graphologyForceAtlas2: '0.10.1',
    },
    productionChanged: true,
    fixtures: fixtures.map((fixture) => ({
      id: fixture.id,
      mode: fixture.mode,
      description: fixture.description,
      nodes: fixture.request.nodes.length,
      edges: fixture.request.edges.length,
      currentBudget: fixture.currentBudget,
      algorithm:
        fixture.mode === 'focus'
          ? 'local-forceatlas2'
          : fixture.request.algorithm,
    })),
    currentDrift: drift.map((value) => ({
      fixtureId: value.fixtureId,
      currentBudget: value.currentBudget,
      aToB: value.aToB,
      bToC: value.bToC,
    })),
    publicBatchComparisons: comparisons,
    batchingForms: formEquivalence,
    deterministicRepeats,
    movementCurves: curves.map(({ fixture, curve }) => ({
      fixtureId: fixture.id,
      batchSize: curve.batchSize,
      maxIterations: deterministicIterationCap(
        fixture.mode,
        fixture.request.nodes.length,
      ),
      snapshots: curve.snapshots.map((snapshot) => ({
        iterationsCompleted: snapshot.iterationsCompleted,
        batchIterations: snapshot.batchIterations,
        batchMs: snapshot.batchMs,
        movement: snapshot.movement,
      })),
    })),
    endpointVersusIterationNormalized: endpointPerIteration,
    thresholdDerivation: {
      source:
        'p25/p50/p75 of all endpoint normalized p90 movements at or beyond each fixture current budget and before its deterministic cap',
      candidates: thresholds,
      observedWithProductionRawFrameParity: observedThresholds,
      note: 'The accepted CONVERGENCE1A thresholds stay fixed; removing intermediate rounding changes the re-observed quantiles but does not retune local-fa2-convergence-v1.',
    },
    candidateGrid: evaluated.map(({ evaluation, referenceP90 }) => ({
      ...stripCandidatePositions(evaluation),
      referenceP90,
    })),
    candidateAggregate: aggregate,
    selectedDiagnosticPolicy: {
      ...selectedPolicy,
      aggregate: selectedAggregate,
      note: 'CONVERGENCE1B uses this accepted policy in production; diagnostics import the production metric and policy primitives.',
    },
    globalFolderMacroSteps: folderMacros,
    hardLimits: {
      focus: [
        { nodes: '<=100', currentIterations: 160, maximumIterations: 1_000 },
        { nodes: '101-500', currentIterations: 100, maximumIterations: 600 },
        { nodes: '>500', currentIterations: 60, maximumIterations: 240 },
      ],
      global: [
        { nodes: '<=1000', currentIterations: 100, maximumIterations: 640 },
        { nodes: '1001-5000', currentIterations: 30, maximumIterations: 120 },
        { nodes: '>5000', currentIterations: 20, maximumIterations: 80 },
      ],
      diagnosticWallTimeMs: { focus: 60_000, global: 90_000 },
      wallTimeInterpretation:
        'diagnostic safety only; a future production timeout must not be cached as deterministic settled geometry',
    },
    safetyOmissions: [
      'The exhaustive 20/32/40 × 60/100/160/320/640/1000 batching matrix is limited to three small representative fixtures.',
      'Broader fixtures use current/160/320 totals; no uncontrolled multi-minute large-graph matrix is run.',
      'Global chunked-prior is evaluated only after complete macro-steps; no mid-prior displacement is treated as convergence.',
    ],
  };
  mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = `${outputDirectory}convergence-results.json`;
  const htmlPath = `${outputDirectory}convergence-comparison.html`;
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  writeFileSync(htmlPath, comparisonHtml(visualCases), 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        fixtures: fixtures.length,
        comparisons: comparisons.length,
        candidatePolicies: aggregate.length,
        evidenceDerivedThresholds: thresholds,
        observedRawFrameThresholds: observedThresholds,
        selectedDiagnosticPolicy: selectedPolicy,
        selectedAggregate: {
          stable: selectedAggregate.stable,
          fixtures: selectedAggregate.fixtures,
          falseEarlyStops: selectedAggregate.falseEarlyStops,
          meanIterations: roundEvidence(selectedAggregate.meanIterations, 2),
          probeP90Median: roundEvidence(selectedAggregate.probeP90Median),
          probeP90Maximum: roundEvidence(selectedAggregate.probeP90Maximum),
          lowDegreeProbeMaximumP90: roundEvidence(
            selectedAggregate.lowDegreeProbeMaximumP90,
          ),
        },
        drift: {
          aToBP90Median: roundEvidence(
            percentile(
              drift.map((value) => value.aToB.all.p90 ?? 0),
              0.5,
            ),
          ),
          lowDegreeMaximumP90: roundEvidence(
            percentile(
              drift.map((value) => value.aToB.lowDegree.maximum ?? 0),
              0.9,
            ),
          ),
        },
        publicBatchEndpointP90Median: roundEvidence(
          percentile(
            comparisons.map(
              (comparison) => comparison.endpointDivergence.all.p90 ?? 0,
            ),
            0.5,
          ),
        ),
        jsonPath,
        htmlPath,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `ForceAtlas2 convergence analysis failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
}
