import {
  computeGlobalLayout,
  localConvergenceMaxIterations,
  resolveGlobalPhysicsSettings,
} from '@icarus-graph-explorer/renderer-sigma/core';
import type {
  GlobalLayoutPosition,
  LocalLayoutPosition,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { ConvergenceFixture } from './convergence-fixtures';
import {
  measureDisplacement,
  measureLayoutQuality,
  percentile,
  type ConvergenceAlignment,
  type ConvergencePosition,
  type DisplacementMetrics,
  type LayoutQualityMetrics,
} from './convergence-metrics';

type DiagnosticGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; folderKey?: string },
  { weight: number }
>;

export type BatchGraphForm = 'reuse' | 'rebuild';
export type CandidateGuard =
  'all-p90' | 'low-degree-p90' | 'bounded-low-degree-maximum';
export type CandidateStopReason =
  'stable' | 'max-iterations' | 'max-wall-time' | 'degenerate';

export interface BatchSnapshot {
  readonly iterationsCompleted: number;
  readonly batchIterations: number;
  readonly batchMs: number;
  readonly positions: readonly ConvergencePosition[];
  readonly movement: DisplacementMetrics;
}

export interface BatchRun {
  readonly form: BatchGraphForm;
  readonly batchSize: number;
  readonly requestedIterations: number;
  readonly iterationsCompleted: number;
  readonly computeMs: number;
  readonly positions: readonly ConvergencePosition[];
  readonly snapshots: readonly BatchSnapshot[];
}

export interface ProductionDriftEvidence {
  readonly fixtureId: string;
  readonly currentBudget: number;
  readonly a: readonly ConvergencePosition[];
  readonly b: readonly ConvergencePosition[];
  readonly c: readonly ConvergencePosition[];
  readonly aToB: DisplacementMetrics;
  readonly bToC: DisplacementMetrics;
}

export interface PublicBatchComparison {
  readonly fixtureId: string;
  readonly totalIterations: number;
  readonly batchSize: number;
  readonly form: BatchGraphForm;
  readonly oneShotMs: number;
  readonly batchedMs: number;
  readonly overheadPercent: number;
  readonly endpointDivergence: DisplacementMetrics;
  readonly residualProbe: DisplacementMetrics;
  readonly finalQuality: LayoutQualityMetrics;
  readonly referenceQuality: LayoutQualityMetrics;
  readonly snapshots: readonly Omit<BatchSnapshot, 'positions'>[];
}

export interface CandidateEvaluation {
  readonly fixtureId: string;
  readonly batchSize: number;
  readonly threshold: number;
  readonly stableBatchesRequired: number;
  readonly guard: CandidateGuard;
  readonly maxIterations: number;
  readonly maxWallTimeMs: number;
  readonly stopReason: CandidateStopReason;
  readonly iterationsCompleted: number;
  readonly batchesCompleted: number;
  readonly stableBatches: number;
  readonly computeMs: number;
  readonly finalMovement: DisplacementMetrics | null;
  readonly probeMovement: DisplacementMetrics | null;
  readonly finalPositions: readonly ConvergencePosition[];
  readonly probePositions: readonly ConvergencePosition[] | null;
}

export interface FolderQualityMetrics {
  readonly scale: number;
  readonly meanWithinFolderDistance: number;
  readonly meanFolderCentroidDistance: number;
  readonly meanCrossFolderReferenceLength: number;
}

export interface GlobalFolderMacroEvidence {
  readonly fixtureId: string;
  readonly current: {
    readonly positions: readonly ConvergencePosition[];
    readonly quality: FolderQualityMetrics;
  };
  readonly g1RepeatedWholeRun: {
    readonly positions: readonly ConvergencePosition[];
    readonly movement: DisplacementMetrics;
    readonly quality: FolderQualityMetrics;
  };
  readonly g3PureFa2Tail: {
    readonly positions: readonly ConvergencePosition[];
    readonly movement: DisplacementMetrics;
    readonly quality: FolderQualityMetrics;
    readonly tailIterations: number;
  };
}

function alignment(fixture: ConvergenceFixture): ConvergenceAlignment {
  return fixture.mode === 'focus'
    ? { kind: 'root', rootKey: fixture.request.rootKey }
    : { kind: 'centroid' };
}

export function fixturePositions(
  fixture: ConvergenceFixture,
): readonly ConvergencePosition[] {
  return fixture.request.nodes
    .map(({ key, x, y }) => ({ key, x, y }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function fixtureEdges(fixture: ConvergenceFixture) {
  return fixture.request.edges.map(({ source, target }) => ({
    source,
    target,
  }));
}

function positionsByKey(
  positions: readonly ConvergencePosition[],
): ReadonlyMap<string, ConvergencePosition> {
  return new Map(
    positions.map((position) => [position.key, position] as const),
  );
}

function buildGraph(
  fixture: ConvergenceFixture,
  positions: readonly ConvergencePosition[],
): DiagnosticGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; folderKey?: string },
    { weight: number }
  >();
  const byKey = positionsByKey(positions);
  for (const node of fixture.request.nodes) {
    const position = byKey.get(node.key);
    if (position === undefined) {
      throw new Error(
        `Convergence graph rebuild omitted node ${node.key} for ${fixture.id}.`,
      );
    }
    graph.addNode(node.key, {
      x: position.x,
      y: position.y,
      size: node.size,
      ...('folderKey' in node && node.folderKey !== undefined
        ? { folderKey: node.folderKey }
        : {}),
    });
  }
  if (fixture.mode === 'focus') {
    for (const edge of fixture.request.edges) {
      const weight =
        edge.weight *
        (edge.kind === 'hierarchy'
          ? fixture.request.settings.hierarchyWeight
          : fixture.request.settings.referenceWeight);
      graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
        weight,
      });
    }
  } else {
    for (const edge of fixture.request.edges) {
      graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
        weight: edge.weight,
      });
    }
  }
  return graph;
}

function assignBatch(
  graph: DiagnosticGraph,
  fixture: ConvergenceFixture,
  iterations: number,
): void {
  if (graph.order < 2 || iterations === 0) return;
  if (fixture.mode === 'focus') {
    forceAtlas2.assign(graph, {
      iterations,
      getEdgeWeight: 'weight',
      settings: {
        ...forceAtlas2.inferSettings(graph),
        barnesHutOptimize: graph.order >= 600,
        edgeWeightInfluence: 1,
        scalingRatio: fixture.request.settings.scalingRatio,
        strongGravityMode: true,
        gravity: 0.08,
      },
    });
    return;
  }
  const settings = resolveGlobalPhysicsSettings(fixture.request.settings);
  forceAtlas2.assign(graph, {
    iterations,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order >= 1_000,
      edgeWeightInfluence: settings.linkForce,
      scalingRatio: Math.max(0.1, settings.withinFolderSpacing),
    },
  });
}

function graphPositions(
  graph: DiagnosticGraph,
): readonly ConvergencePosition[] {
  return graph
    .mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function acceptedPositions(
  fixture: ConvergenceFixture,
  positions: readonly ConvergencePosition[],
): readonly ConvergencePosition[] {
  if (fixture.mode === 'global') return positions;
  const root = positions.find(({ key }) => key === fixture.request.rootKey);
  if (root === undefined) {
    throw new Error(
      `Convergence Local result omitted root ${fixture.request.rootKey}.`,
    );
  }
  return positions.map((position) => ({
    key: position.key,
    x: position.key === fixture.request.rootKey ? 0 : position.x - root.x,
    y: position.key === fixture.request.rootKey ? 0 : position.y - root.y,
  }));
}

export function runPublicBatches(input: {
  readonly fixture: ConvergenceFixture;
  readonly start: readonly ConvergencePosition[];
  readonly totalIterations: number;
  readonly batchSize: number;
  readonly form: BatchGraphForm;
}): BatchRun {
  if (
    !Number.isInteger(input.totalIterations) ||
    input.totalIterations < 1 ||
    !Number.isInteger(input.batchSize) ||
    input.batchSize < 1
  ) {
    throw new Error('Convergence batches require positive integer budgets.');
  }
  let rawPositions: readonly ConvergencePosition[] = [...input.start];
  let acceptedBefore = acceptedPositions(input.fixture, rawPositions);
  let graph = buildGraph(input.fixture, rawPositions);
  let iterationsCompleted = 0;
  let computeMs = 0;
  const snapshots: BatchSnapshot[] = [];
  while (iterationsCompleted < input.totalIterations) {
    const batchIterations = Math.min(
      input.batchSize,
      input.totalIterations - iterationsCompleted,
    );
    const started = performance.now();
    if (input.form === 'rebuild' && iterationsCompleted > 0) {
      graph = buildGraph(input.fixture, rawPositions);
    }
    assignBatch(graph, input.fixture, batchIterations);
    const batchMs = performance.now() - started;
    computeMs += batchMs;
    iterationsCompleted += batchIterations;
    rawPositions = graphPositions(graph);
    const acceptedAfter = acceptedPositions(input.fixture, rawPositions);
    snapshots.push({
      iterationsCompleted,
      batchIterations,
      batchMs,
      positions: acceptedAfter,
      movement: measureDisplacement({
        before: acceptedBefore,
        after: acceptedAfter,
        edges: fixtureEdges(input.fixture),
        alignment: alignment(input.fixture),
      }),
    });
    acceptedBefore = acceptedAfter;
  }
  return {
    form: input.form,
    batchSize: input.batchSize,
    requestedIterations: input.totalIterations,
    iterationsCompleted,
    computeMs,
    positions: acceptedBefore,
    snapshots,
  };
}

function productionPass(
  fixture: ConvergenceFixture,
  start: readonly ConvergencePosition[],
  requestId: number,
): readonly ConvergencePosition[] {
  const byKey = positionsByKey(start);
  if (fixture.mode === 'focus') {
    return runPublicBatches({
      fixture: {
        ...fixture,
        request: {
          ...fixture.request,
          nodes: fixture.request.nodes.map((node) => {
            const position = byKey.get(node.key);
            if (position === undefined) {
              throw new Error(
                `Production drift omitted Local node ${node.key}.`,
              );
            }
            return { ...node, x: position.x, y: position.y };
          }),
        },
      },
      start,
      totalIterations: fixture.currentBudget,
      batchSize: fixture.currentBudget,
      form: 'reuse',
    }).positions;
  }
  const result = computeGlobalLayout({
    ...fixture.request,
    requestId,
    nodes: fixture.request.nodes.map((node) => {
      const position = byKey.get(node.key);
      if (position === undefined) {
        throw new Error(`Production drift omitted Global node ${node.key}.`);
      }
      return { ...node, x: position.x, y: position.y };
    }),
  });
  return result.positions;
}

export function productionDrift(
  fixture: ConvergenceFixture,
): ProductionDriftEvidence {
  const seed = fixturePositions(fixture);
  const a = productionPass(fixture, seed, 1);
  const b = productionPass(fixture, a, 2);
  const c = productionPass(fixture, b, 3);
  return {
    fixtureId: fixture.id,
    currentBudget: fixture.currentBudget,
    a,
    b,
    c,
    aToB: measureDisplacement({
      before: a,
      after: b,
      edges: fixtureEdges(fixture),
      alignment: alignment(fixture),
    }),
    bToC: measureDisplacement({
      before: b,
      after: c,
      edges: fixtureEdges(fixture),
      alignment: alignment(fixture),
    }),
  };
}

export function publicBatchComparison(input: {
  readonly fixture: ConvergenceFixture;
  readonly totalIterations: number;
  readonly batchSize: number;
  readonly form: BatchGraphForm;
}): PublicBatchComparison {
  if (
    input.fixture.mode === 'global' &&
    input.fixture.request.algorithm !== 'reference-only'
  ) {
    throw new Error(
      'Pure public-batch comparison cannot skip a Global folder-prior macro-step.',
    );
  }
  const start = fixturePositions(input.fixture);
  const oneShot = runPublicBatches({
    fixture: input.fixture,
    start,
    totalIterations: input.totalIterations,
    batchSize: input.totalIterations,
    form: 'reuse',
  });
  const batched = runPublicBatches({ ...input, start });
  const probe = runPublicBatches({
    fixture: input.fixture,
    start: batched.positions,
    totalIterations: input.batchSize,
    batchSize: input.batchSize,
    form: 'rebuild',
  });
  const metricsInput = {
    edges: fixtureEdges(input.fixture),
    alignment: alignment(input.fixture),
  } as const;
  return {
    fixtureId: input.fixture.id,
    totalIterations: input.totalIterations,
    batchSize: input.batchSize,
    form: input.form,
    oneShotMs: oneShot.computeMs,
    batchedMs: batched.computeMs,
    overheadPercent:
      oneShot.computeMs === 0
        ? 0
        : ((batched.computeMs - oneShot.computeMs) / oneShot.computeMs) * 100,
    endpointDivergence: measureDisplacement({
      before: oneShot.positions,
      after: batched.positions,
      ...metricsInput,
    }),
    residualProbe: measureDisplacement({
      before: batched.positions,
      after: probe.positions,
      ...metricsInput,
    }),
    finalQuality: measureLayoutQuality({
      positions: batched.positions,
      ...metricsInput,
    }),
    referenceQuality: measureLayoutQuality({
      positions: oneShot.positions,
      ...metricsInput,
    }),
    snapshots: batched.snapshots.map((snapshot) => ({
      iterationsCompleted: snapshot.iterationsCompleted,
      batchIterations: snapshot.batchIterations,
      batchMs: snapshot.batchMs,
      movement: snapshot.movement,
    })),
  };
}

export function deterministicIterationCap(
  mode: ConvergenceFixture['mode'],
  nodeCount: number,
): number {
  if (mode === 'focus') {
    return localConvergenceMaxIterations(nodeCount);
  }
  return nodeCount <= 1_000 ? 640 : nodeCount <= 5_000 ? 120 : 80;
}

export function diagnosticWallTimeLimitMs(
  mode: ConvergenceFixture['mode'],
): number {
  return mode === 'focus' ? 60_000 : 90_000;
}

function batchStable(
  fixture: ConvergenceFixture,
  movement: DisplacementMetrics,
  threshold: number,
  guard: CandidateGuard,
): boolean {
  const allP90 = movement.all.p90;
  if (allP90 === null || allP90 > threshold) return false;
  if (
    fixture.mode === 'global' &&
    movement.normalizedCentroidDrift > threshold
  ) {
    return false;
  }
  if (guard === 'all-p90' || movement.lowDegree.count === 0) return true;
  if (guard === 'low-degree-p90') {
    return (
      movement.lowDegree.p90 !== null && movement.lowDegree.p90 <= threshold
    );
  }
  return (
    movement.lowDegree.maximum !== null &&
    movement.lowDegree.maximum <= threshold * 2
  );
}

export function evaluateCandidate(input: {
  readonly fixture: ConvergenceFixture;
  readonly curve: BatchRun;
  readonly threshold: number;
  readonly stableBatchesRequired: number;
  readonly guard: CandidateGuard;
  readonly maxIterations: number;
  readonly maxWallTimeMs: number;
}): CandidateEvaluation {
  if (
    !Number.isFinite(input.threshold) ||
    input.threshold <= 0 ||
    !Number.isInteger(input.stableBatchesRequired) ||
    input.stableBatchesRequired < 1
  ) {
    throw new Error('Convergence candidate has invalid stability bounds.');
  }
  if (input.fixture.request.nodes.length < 2) {
    return {
      fixtureId: input.fixture.id,
      batchSize: input.curve.batchSize,
      threshold: input.threshold,
      stableBatchesRequired: input.stableBatchesRequired,
      guard: input.guard,
      maxIterations: input.maxIterations,
      maxWallTimeMs: input.maxWallTimeMs,
      stopReason: 'degenerate',
      iterationsCompleted: 0,
      batchesCompleted: 0,
      stableBatches: 0,
      computeMs: 0,
      finalMovement: null,
      probeMovement: null,
      finalPositions: fixturePositions(input.fixture),
      probePositions: null,
    };
  }
  let stableBatches = 0;
  let computeMs = 0;
  let stopIndex = -1;
  let stopReason: CandidateStopReason = 'max-iterations';
  for (let index = 0; index < input.curve.snapshots.length; index += 1) {
    const snapshot = input.curve.snapshots[index]!;
    if (snapshot.iterationsCompleted > input.maxIterations) break;
    computeMs += snapshot.batchMs;
    if (computeMs > input.maxWallTimeMs) {
      stopIndex = index;
      stopReason = 'max-wall-time';
      break;
    }
    if (snapshot.batchIterations === input.curve.batchSize) {
      stableBatches = batchStable(
        input.fixture,
        snapshot.movement,
        input.threshold,
        input.guard,
      )
        ? stableBatches + 1
        : 0;
    }
    stopIndex = index;
    if (stableBatches >= input.stableBatchesRequired) {
      stopReason = 'stable';
      break;
    }
  }
  if (stopIndex < 0) {
    throw new Error(
      `Convergence curve for ${input.fixture.id} has no accepted batch.`,
    );
  }
  const final = input.curve.snapshots[stopIndex]!;
  const probe = input.curve.snapshots[stopIndex + 1];
  return {
    fixtureId: input.fixture.id,
    batchSize: input.curve.batchSize,
    threshold: input.threshold,
    stableBatchesRequired: input.stableBatchesRequired,
    guard: input.guard,
    maxIterations: input.maxIterations,
    maxWallTimeMs: input.maxWallTimeMs,
    stopReason,
    iterationsCompleted: final.iterationsCompleted,
    batchesCompleted: stopIndex + 1,
    stableBatches,
    computeMs,
    finalMovement: final.movement,
    probeMovement: stopReason === 'stable' ? (probe?.movement ?? null) : null,
    finalPositions: final.positions,
    probePositions:
      stopReason === 'stable' && probe !== undefined ? probe.positions : null,
  };
}

export function movementCurve(
  fixture: ConvergenceFixture,
  batchSize: number,
): BatchRun {
  const maxIterations = deterministicIterationCap(
    fixture.mode,
    fixture.request.nodes.length,
  );
  const capped = runPublicBatches({
    fixture,
    start: fixturePositions(fixture),
    totalIterations: maxIterations,
    batchSize,
    form: 'reuse',
  });
  const probe = runPublicBatches({
    fixture,
    start: capped.positions,
    totalIterations: batchSize,
    batchSize,
    form: 'reuse',
  });
  return {
    ...capped,
    requestedIterations: maxIterations + batchSize,
    iterationsCompleted: maxIterations + batchSize,
    computeMs: capped.computeMs + probe.computeMs,
    positions: probe.positions,
    snapshots: [
      ...capped.snapshots,
      ...probe.snapshots.map((snapshot) => ({
        ...snapshot,
        iterationsCompleted: maxIterations + snapshot.iterationsCompleted,
      })),
    ],
  };
}

export function evidenceDerivedThresholds(
  curves: readonly {
    readonly fixture: ConvergenceFixture;
    readonly curve: BatchRun;
  }[],
): readonly number[] {
  const lateMovement = curves.flatMap(({ fixture, curve }) =>
    curve.snapshots.flatMap((snapshot) =>
      snapshot.iterationsCompleted >= fixture.currentBudget &&
      snapshot.iterationsCompleted <=
        deterministicIterationCap(fixture.mode, fixture.request.nodes.length)
        ? [snapshot.movement.all.p90 ?? 0]
        : [],
    ),
  );
  if (lateMovement.length === 0) {
    throw new Error(
      'Convergence threshold derivation has no late-batch evidence.',
    );
  }
  const candidates = [0.25, 0.5, 0.75].map((fraction) =>
    Number(percentile(lateMovement, fraction).toPrecision(3)),
  );
  return [...new Set(candidates)].sort((left, right) => left - right);
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export function folderQuality(
  fixture: ConvergenceFixture,
  positions: readonly ConvergencePosition[],
): FolderQualityMetrics {
  if (fixture.mode !== 'global') {
    throw new Error('Folder quality requires a Global convergence fixture.');
  }
  const byKey = positionsByKey(positions);
  const centroid = {
    x: mean(positions.map(({ x }) => x)),
    y: mean(positions.map(({ y }) => y)),
  };
  const scale = Math.max(
    1e-6,
    Math.sqrt(
      mean(
        positions.map(
          (position) =>
            (position.x - centroid.x) ** 2 + (position.y - centroid.y) ** 2,
        ),
      ),
    ),
  );
  const folders = new Map<string, ConvergencePosition[]>();
  for (const node of fixture.request.nodes) {
    if (node.folderKey === undefined) continue;
    const position = byKey.get(node.key);
    if (position === undefined) {
      throw new Error(`Folder quality omitted node ${node.key}.`);
    }
    const members = folders.get(node.folderKey) ?? [];
    members.push(position);
    folders.set(node.folderKey, members);
  }
  const folderCentroids = [...folders.values()].map((members) => ({
    x: mean(members.map(({ x }) => x)),
    y: mean(members.map(({ y }) => y)),
    members,
  }));
  const within = folderCentroids.flatMap((folder) =>
    folder.members.map(
      (member) => Math.hypot(member.x - folder.x, member.y - folder.y) / scale,
    ),
  );
  const between: number[] = [];
  for (let left = 0; left < folderCentroids.length; left += 1) {
    for (let right = left + 1; right < folderCentroids.length; right += 1) {
      between.push(
        Math.hypot(
          folderCentroids[left]!.x - folderCentroids[right]!.x,
          folderCentroids[left]!.y - folderCentroids[right]!.y,
        ) / scale,
      );
    }
  }
  const crossReferences = fixture.request.edges.flatMap((edge) => {
    const sourceNode = fixture.request.nodes.find(
      ({ key }) => key === edge.source,
    );
    const targetNode = fixture.request.nodes.find(
      ({ key }) => key === edge.target,
    );
    if (
      sourceNode?.folderKey === undefined ||
      targetNode?.folderKey === undefined ||
      sourceNode.folderKey === targetNode.folderKey
    ) {
      return [];
    }
    return [
      Math.hypot(
        byKey.get(edge.source)!.x - byKey.get(edge.target)!.x,
        byKey.get(edge.source)!.y - byKey.get(edge.target)!.y,
      ) / scale,
    ];
  });
  return {
    scale,
    meanWithinFolderDistance: mean(within),
    meanFolderCentroidDistance: mean(between),
    meanCrossFolderReferenceLength: mean(crossReferences),
  };
}

export function globalFolderMacroEvidence(
  fixture: ConvergenceFixture,
  tailIterations = 96,
): GlobalFolderMacroEvidence {
  if (
    fixture.mode !== 'global' ||
    fixture.request.algorithm !== 'chunked-prior'
  ) {
    throw new Error(
      'Global folder macro evidence requires chunked-prior input.',
    );
  }
  const seed = fixturePositions(fixture);
  const current = productionPass(fixture, seed, 20_001);
  const repeated = productionPass(fixture, current, 20_002);
  const pureTail = runPublicBatches({
    fixture: {
      ...fixture,
      request: {
        ...fixture.request,
        algorithm: 'reference-only',
        settings: { ...fixture.request.settings, folderClustering: false },
      },
    },
    start: current,
    totalIterations: tailIterations,
    batchSize: 32,
    form: 'reuse',
  }).positions;
  const edges = fixtureEdges(fixture);
  const centroidAlignment = { kind: 'centroid' } as const;
  return {
    fixtureId: fixture.id,
    current: {
      positions: current,
      quality: folderQuality(fixture, current),
    },
    g1RepeatedWholeRun: {
      positions: repeated,
      movement: measureDisplacement({
        before: current,
        after: repeated,
        edges,
        alignment: centroidAlignment,
      }),
      quality: folderQuality(fixture, repeated),
    },
    g3PureFa2Tail: {
      positions: pureTail,
      movement: measureDisplacement({
        before: current,
        after: pureTail,
        edges,
        alignment: centroidAlignment,
      }),
      quality: folderQuality(fixture, pureTail),
      tailIterations,
    },
  };
}

export function positionsEqual(
  left: readonly GlobalLayoutPosition[] | readonly LocalLayoutPosition[],
  right: readonly GlobalLayoutPosition[] | readonly LocalLayoutPosition[],
): boolean {
  if (left.length !== right.length) return false;
  const rightByKey = positionsByKey(right);
  return left.every((position) => {
    const match = rightByKey.get(position.key);
    return match?.x === position.x && match.y === position.y;
  });
}
