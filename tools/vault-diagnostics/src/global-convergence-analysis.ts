import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeGlobalLayout,
  createGlobalConvergencePolicy,
  createGlobalFolderMacroPolicy,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  deterministicGlobalPosition,
} from '@icarus-graph-explorer/renderer-sigma/core';
import type {
  GlobalLayoutEdge,
  GlobalLayoutNode,
  GlobalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/types';

import {
  convergeGlobalMacroCandidate,
  currentFixedBaseline,
  globalMacroFixtures,
  globalMacroQuality,
  runGlobalMacroCandidate,
  type GlobalMacroCandidateId,
  type GlobalMacroQuality,
} from './global-convergence-candidates';

const CANDIDATES = ['M0', 'M1', 'M2', 'M3'] as const;
const DURATION_STEPS = [3, 5, 8, 12] as const;
const QUALITY_FIELDS = [
  'meanWithinFolderDistance',
  'meanFolderCentroidDistance',
  'meanCrossFolderReferenceLength',
  'meanReferenceLength',
  'meanFolderDirectionDisplacement',
] as const satisfies readonly (keyof GlobalMacroQuality)[];
const DURATION_FIELDS = [
  'meanWithinFolderDistance',
  'meanFolderCentroidDistance',
  'meanCrossFolderReferenceLength',
  'meanFolderDirectionDisplacement',
] as const satisfies readonly (keyof GlobalMacroQuality)[];

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function relativeSpread(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return (maximum - minimum) / Math.max(0.05, Math.abs(mean(values)));
}

function ratio(value: number, baseline: number): number | null {
  return baseline === 0 ? (value === 0 ? 1 : null) : value / baseline;
}

function within(
  value: number | null | undefined,
  minimum: number,
  maximum: number,
): boolean {
  return value != null && value >= minimum && value <= maximum;
}

function roundedQuality(value: GlobalMacroQuality): GlobalMacroQuality {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, round(entry)]),
  ) as unknown as GlobalMacroQuality;
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function candidateDescription(candidate: GlobalMacroCandidateId): string {
  switch (candidate) {
    case 'M0':
      return 'Repeat the current one-application prior after every 32-iteration FA2 batch.';
    case 'M1':
      return 'Apply the current prior only during the first five macro-steps, then run a pure FA2 tail.';
    case 'M2':
      return 'Run pure FA2 and derive each macro snapshot through one fixed one-application folder field without feeding the correction back.';
    case 'M3':
      return 'Freeze one five-equivalent target from the starting semantic frame and couple each FA2 batch back toward it with gain 0.32.';
  }
}

function table(headers: readonly string[], rows: readonly string[][]): string {
  return `<table><thead><tr>${headers.map((value) => `<th>${xml(value)}</th>`).join('')}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${xml(value)}</td>`).join('')}</tr>`,
    )
    .join('')}</tbody></table>`;
}

function overlaySvg(
  values: readonly {
    readonly label: string;
    readonly color: string;
    readonly positions: readonly { key: string; x: number; y: number }[];
  }[],
): string {
  const all = values.flatMap(({ positions }) => positions);
  const minimumX = Math.min(...all.map(({ x }) => x));
  const maximumX = Math.max(...all.map(({ x }) => x));
  const minimumY = Math.min(...all.map(({ y }) => y));
  const maximumY = Math.max(...all.map(({ y }) => y));
  const spanX = Math.max(1e-6, maximumX - minimumX);
  const spanY = Math.max(1e-6, maximumY - minimumY);
  const point = (value: { x: number; y: number }) => ({
    x: 24 + ((value.x - minimumX) / spanX) * 552,
    y: 24 + ((value.y - minimumY) / spanY) * 312,
  });
  return `<svg viewBox="0 0 600 360" role="img" aria-label="Folder macro duration overlay">${values
    .flatMap(({ label, color, positions }) => [
      `<text x="12" y="${348 - values.findIndex((entry) => entry.label === label) * 15}" fill="${color}">${xml(label)}</text>`,
      ...positions.map((value) => {
        const mapped = point(value);
        return `<circle cx="${round(mapped.x, 3)}" cy="${round(mapped.y, 3)}" r="2.5" fill="${color}" opacity="0.72"><title>${xml(`${label}: ${value.key}`)}</title></circle>`;
      }),
    ])
    .join('')}</svg>`;
}

function productionBenchmarks() {
  return [100, 500, 1_000, 5_000, 5_001].map((nodeCount) => {
    const settings = {
      ...DEFAULT_GLOBAL_LAYOUT_SETTINGS,
      folderClustering: true,
    };
    const nodes: GlobalLayoutNode[] = Array.from(
      { length: nodeCount },
      (_, index) => ({
        key: `benchmark-node-${index}`,
        ...deterministicGlobalPosition(`benchmark-node-${index}`),
        size: 4.5,
        folderKey: `synthetic/folder-${Math.floor(index / 50)}`,
      }),
    );
    const edges: GlobalLayoutEdge[] = Array.from(
      { length: nodeCount - 1 },
      (_, index) => ({
        key: `benchmark-edge-${index}`,
        source: `benchmark-node-${Math.max(0, Math.floor(index / 2))}`,
        target: `benchmark-node-${index + 1}`,
        weight: 1,
      }),
    );
    const macro = createGlobalFolderMacroPolicy(nodes, settings);
    const request: GlobalLayoutRequest = {
      schemaVersion: 2,
      requestId: 1,
      algorithm: macro.algorithm,
      policy: createGlobalConvergencePolicy(nodeCount),
      macro,
      settings,
      nodes,
      edges,
    };
    const started = performance.now();
    try {
      const result = computeGlobalLayout(request);
      return {
        nodeCount,
        edgeCount: edges.length,
        status: 'result' as const,
        stopReason: result.stopReason,
        iterationsCompleted: result.iterationsCompleted,
        macroStepsCompleted: result.macroStepsCompleted,
        finalMacroStepIterations: result.finalMacroStepIterations,
        computeMs: result.computeMs,
        folderPriorMs: result.folderPriorMs,
        observedWallMs: round(performance.now() - started, 3),
        finalP90: round(result.finalMovement?.all.p90 ?? 0),
        lowDegreeMaximum: round(result.finalMovement?.lowDegree.maximum ?? 0),
      };
    } catch (error: unknown) {
      return {
        nodeCount,
        edgeCount: edges.length,
        status: 'error' as const,
        observedWallMs: round(performance.now() - started, 3),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

function main(): void {
  const fixtures = globalMacroFixtures();
  const folderFixtures = fixtures.filter(
    ({ category }) => category === 'folder',
  );
  const baselines = new Map(
    folderFixtures.map((fixture) => {
      const result = currentFixedBaseline(fixture);
      return [
        fixture.id,
        {
          positions: result.positions,
          quality: globalMacroQuality(fixture.request, result.positions),
        },
      ] as const;
    }),
  );

  const duration = CANDIDATES.map((candidate) => {
    const fixtureEvidence = folderFixtures.map((fixture) => {
      const run = runGlobalMacroCandidate({
        fixture,
        candidate,
        macroSteps: DURATION_STEPS.at(-1)!,
        presettleIterations: 640,
      });
      const samples = DURATION_STEPS.map((macroSteps) => {
        const frame = run.frames[macroSteps - 1]!;
        return { macroSteps, quality: roundedQuality(frame.quality) };
      });
      const spreads = Object.fromEntries(
        DURATION_FIELDS.map((field) => [
          field,
          round(relativeSpread(samples.map(({ quality }) => quality[field]))),
        ]),
      ) as Record<(typeof DURATION_FIELDS)[number], number>;
      return { fixtureId: fixture.id, samples, spreads };
    });
    const spreadValues = fixtureEvidence.flatMap(({ spreads }) =>
      Object.values(spreads),
    );
    return {
      candidate,
      description: candidateDescription(candidate),
      maximumRelativeSpread: round(Math.max(...spreadValues)),
      medianRelativeSpread: round(median(spreadValues)),
      fixtures: fixtureEvidence,
    };
  });

  const convergence = CANDIDATES.map((candidate) => {
    const results = fixtures.map((fixture) => {
      const result = convergeGlobalMacroCandidate({ fixture, candidate });
      const baseline = baselines.get(fixture.id)?.quality;
      return {
        fixtureId: fixture.id,
        category: fixture.category,
        stopReason: result.stopReason,
        iterationsCompleted: result.iterationsCompleted,
        macroStepsCompleted: result.macroStepsCompleted,
        stableSteps: result.stableSteps,
        finalP90: round(result.finalMovement?.all.p90 ?? 0),
        lowDegreeMaximum: round(result.finalMovement?.lowDegree.maximum ?? 0),
        normalizedCentroidDrift: round(
          result.finalMovement?.normalizedCentroidDrift ?? 0,
        ),
        hiddenProbeP90: round(result.hiddenProbeMovement?.all.p90 ?? 0),
        hiddenProbeLowDegreeMaximum: round(
          result.hiddenProbeMovement?.lowDegree.maximum ?? 0,
        ),
        computeMs: round(result.computeMs, 3),
        folderPriorMs: round(result.folderPriorMs, 3),
        quality: roundedQuality(result.finalQuality),
        baselineRatios:
          baseline === undefined
            ? null
            : Object.fromEntries(
                QUALITY_FIELDS.map((field) => [
                  field,
                  ratio(result.finalQuality[field], baseline[field]) === null
                    ? null
                    : round(
                        ratio(result.finalQuality[field], baseline[field])!,
                      ),
                ]),
              ),
      };
    });
    const falseEarlyStops = results.filter(
      ({ stopReason, hiddenProbeP90, hiddenProbeLowDegreeMaximum }) =>
        stopReason === 'stable' &&
        (hiddenProbeP90 > 0.00512 || hiddenProbeLowDegreeMaximum > 0.01024),
    ).length;
    return {
      candidate,
      stable: results.filter(({ stopReason }) => stopReason === 'stable')
        .length,
      capped: results.filter(
        ({ stopReason }) => stopReason === 'max-iterations',
      ).length,
      falseEarlyStops,
      maximumComputeMs: round(
        Math.max(...results.map(({ computeMs }) => computeMs)),
        3,
      ),
      fixtures: results,
    };
  });

  const determinism = CANDIDATES.map((candidate) => ({
    candidate,
    exact: fixtures.every((fixture) => {
      const first = runGlobalMacroCandidate({
        fixture,
        candidate,
        macroSteps: 5,
      }).frames.at(-1)!.positions;
      const second = runGlobalMacroCandidate({
        fixture,
        candidate,
        macroSteps: 5,
      }).frames.at(-1)!.positions;
      return JSON.stringify(first) === JSON.stringify(second);
    }),
  }));

  const candidateDecisions = CANDIDATES.map((candidate) => {
    const candidateDuration = duration.find(
      (value) => value.candidate === candidate,
    )!;
    const candidateConvergence = convergence.find(
      (value) => value.candidate === candidate,
    )!;
    const byId = (fixtureId: string) =>
      candidateConvergence.fixtures.find(
        (value) => value.fixtureId === fixtureId,
      )!;
    const weak = byId('two-folders-weak');
    const strong = byId('two-folders-strong');
    const lowPull = byId('low-reference-pull');
    const highPull = byId('high-reference-pull');
    const compact = byId('preset-compact');
    const normal = byId('preset-normal');
    const spacious = byId('preset-spacious');
    const lowCohesion = byId('low-cohesion');
    const highCohesion = byId('high-cohesion');
    const qualityPreserved = candidateConvergence.fixtures
      .filter(({ category }) => category === 'folder')
      .every(({ baselineRatios }) =>
        baselineRatios === null
          ? false
          : within(baselineRatios.meanWithinFolderDistance, 0.75, 1.25) &&
            within(baselineRatios.meanFolderCentroidDistance, 0.75, 1.25) &&
            within(baselineRatios.meanReferenceLength, 0.75, 1.25),
      );
    const checks = {
      durationIndependence: candidateDuration.maximumRelativeSpread <= 0.05,
      convergenceStability:
        candidateConvergence.stable >= Math.ceil((fixtures.length * 2) / 3) &&
        candidateConvergence.falseEarlyStops === 0,
      folderQualityPreserved: qualityPreserved,
      referenceTopologyPreserved:
        strong.quality.meanCrossFolderReferenceLength <
          weak.quality.meanCrossFolderReferenceLength &&
        highPull.quality.meanCrossFolderReferenceLength <
          lowPull.quality.meanCrossFolderReferenceLength,
      settingsRemainOrdered:
        compact.quality.meanWithinFolderDistance <
          normal.quality.meanWithinFolderDistance &&
        normal.quality.meanWithinFolderDistance <
          spacious.quality.meanWithinFolderDistance &&
        highCohesion.quality.meanWithinFolderDistance <
          lowCohesion.quality.meanWithinFolderDistance,
      practicalPerformance: candidateConvergence.maximumComputeMs < 5_000,
      deterministic:
        determinism.find((value) => value.candidate === candidate)?.exact ===
        true,
      explainableConvergenceCandidate: candidate !== 'M0',
    };
    return {
      candidate,
      checks,
      passes: Object.values(checks).every(Boolean),
    };
  });
  const passingCandidates = candidateDecisions
    .filter(({ passes }) => passes)
    .map(({ candidate }) => candidate);
  const passingCandidate =
    passingCandidates.length === 1 ? passingCandidates[0]! : null;
  const performance = productionBenchmarks();

  const report = {
    schemaVersion: 1,
    generatedBy: 'pnpm analyze:global-convergence',
    privateDataUsed: false,
    currentMacroSemantics: {
      radialFactor:
        'r = 1 - folderCohesion + (withinFolderSpacing - 1) * 0.012',
      oneApplication:
        "x' = folderCentroid + r * (x - folderCentroid) + folderDirection * folderCohesion * 0.16 * betweenFolderSpacing * graphScale",
      fiveSameFrameApplications:
        'within offsets multiply by r^5; with fixed scale, centroid translation is five times the one-application displacement',
      selectedFixedField:
        'M2 applies one current prior transform to each output snapshot without feeding it back into the FA2 graph.',
      interleaving:
        'Production M0 recomputes scale and folder centroids after each FA2 chunk, so exact composition is nonlinear and references can react between applications.',
    },
    fixtures: fixtures.map(({ id, description, category, request }) => ({
      id,
      description,
      category,
      nodes: request.nodes.length,
      edges: request.edges.length,
      settings: request.settings,
    })),
    forcedMacroSteps: DURATION_STEPS,
    duration,
    convergence,
    determinism,
    decisionPolicy: {
      maximumDurationSpread: 0.05,
      minimumStableFixtureFraction: '2/3',
      falseEarlyStops: 0,
      baselineQualityRatio: [0.75, 1.25],
      maximumDiagnosticComputeMs: 5_000,
      note: 'A deterministic max-iterations result is an accepted bounded outcome; it is not itself a gate failure.',
    },
    candidateDecisions,
    passingCandidates,
    passingCandidate,
    performance,
  };

  const outputDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../output/convergence1c',
  );
  mkdirSync(outputDirectory, { recursive: true });
  const jsonPath = resolve(outputDirectory, 'global-macro-results.json');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const baselineFixture = folderFixtures.find(
    ({ id }) => id === 'folder-baseline',
  )!;
  const baseline = baselines.get(baselineFixture.id)!;
  const m2Run = runGlobalMacroCandidate({
    fixture: baselineFixture,
    candidate: 'M2',
    macroSteps: 12,
    presettleIterations: 640,
  });
  const durationRows = duration.map((value) => [
    value.candidate,
    value.description,
    value.maximumRelativeSpread.toFixed(5),
    value.medianRelativeSpread.toFixed(5),
  ]);
  const convergenceRows = convergence.map((value) => [
    value.candidate,
    String(value.stable),
    String(value.capped),
    String(value.falseEarlyStops),
    String(
      determinism.find(({ candidate }) => candidate === value.candidate)?.exact,
    ),
    String(
      candidateDecisions.find(({ candidate }) => candidate === value.candidate)
        ?.passes,
    ),
  ]);
  const decisionRows = candidateDecisions.flatMap((value) =>
    Object.entries(value.checks).map(([check, pass]) => [
      value.candidate,
      check,
      String(pass),
    ]),
  );
  const performanceRows = performance.map((value) => [
    String(value.nodeCount),
    String(value.edgeCount),
    value.status,
    value.status === 'result' ? value.stopReason : value.message,
    value.status === 'result' ? String(value.iterationsCompleted) : '—',
    String(value.observedWallMs),
  ]);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CONVERGENCE1C Global macro comparison</title><style>body{font:14px system-ui;margin:24px;color:#1f2630;background:#f6f7f9}h1,h2{color:#172033}table{border-collapse:collapse;width:100%;margin:12px 0 28px;background:white}th,td{border:1px solid #ccd2dc;padding:8px;text-align:left;vertical-align:top}th{background:#e8edf5}code{background:#e8edf5;padding:2px 4px}svg{width:min(900px,100%);height:auto;background:white;border:1px solid #ccd2dc}.pass{color:#116b3a;font-weight:700}.fail{color:#9b2c2c;font-weight:700}</style></head><body><h1>CONVERGENCE1C Global folder-macro comparison</h1><p>Synthetic/private-safe evidence. Forced duration checks start from a 640-iteration pure-FA2 presettle so remaining differences isolate macro semantics.</p><h2>Candidate duration spread</h2>${table(['Candidate', 'Definition', 'Maximum relative spread', 'Median relative spread'], durationRows)}<h2>Convergence and determinism</h2>${table(['Candidate', 'Stable fixtures', 'Capped fixtures', 'False early stops', 'Exact rerun', 'Passes gate'], convergenceRows)}<h2>Decision</h2><p class="${passingCandidate === null ? 'fail' : 'pass'}">${passingCandidate === null ? 'No single candidate passed every gate.' : `${passingCandidate} is the only candidate that passed every gate.`}</p>${table(['Candidate', 'Check', 'Pass'], decisionRows)}<h2>Production performance</h2>${table(['Nodes', 'Edges', 'Status', 'Stop/reason', 'Iterations', 'Observed ms'], performanceRows)}<h2>Folder-baseline overlay</h2><p>M0 is the current fixed 100-iteration/five-prior baseline. M2 samples show one fixed output field at forced 3/5/8/12 macro durations.</p>${overlaySvg([{ label: 'M0 fixed baseline', color: '#1f77b4', positions: baseline.positions }, ...DURATION_STEPS.map((step, index) => ({ label: `M2 ${step} steps`, color: ['#2ca02c', '#9467bd', '#ff7f0e', '#d62728'][index]!, positions: m2Run.frames[step - 1]!.positions }))])}<p>Machine-readable detail: <code>global-macro-results.json</code>.</p></body></html>`;
  const htmlPath = resolve(outputDirectory, 'global-macro-comparison.html');
  writeFileSync(htmlPath, html, 'utf8');

  console.log(
    JSON.stringify(
      {
        fixtures: fixtures.length,
        folderFixtures: folderFixtures.length,
        duration: duration.map(
          ({ candidate, maximumRelativeSpread, medianRelativeSpread }) => ({
            candidate,
            maximumRelativeSpread,
            medianRelativeSpread,
          }),
        ),
        convergence: convergence.map(({ candidate, stable, capped }) => ({
          candidate,
          stable,
          capped,
        })),
        candidateDecisions,
        passingCandidates,
        passingCandidate,
        performance,
        jsonPath,
        htmlPath,
      },
      null,
      2,
    ),
  );
}

main();
