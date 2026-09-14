import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {
  applyNetworkPhysicsPullIteration,
  ContinuousNetworkSimulation,
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsAttractor,
  type NetworkPhysicsPosition,
  type NetworkPhysicsSeed,
} from '@icarus-graph-explorer/renderer-sigma/physics';
import {
  createGlobalFolderMacroPolicy,
  deriveGlobalFolderMacroSnapshot,
  resolveGlobalPhysicsSettings,
} from '@icarus-graph-explorer/renderer-sigma/core';

type Position = NetworkPhysicsPosition;
type Node = Position & { readonly folderKey: string };
type Edge = {
  readonly key: string;
  readonly source: string;
  readonly target: string;
  readonly weight: number;
};
type Fixture = {
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly coreKeys: readonly string[];
  readonly isolateKeys: readonly string[];
  readonly componentKeys: readonly (readonly string[])[];
};
type Candidate =
  'unbounded-baseline' | 'A1-node-stabilization' | 'B-centroid-stabilization';
type PhysicsGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; constraintEligible: boolean },
  { weight: number }
>;

const HOT_TURNS = 256;
const HOT_ITERATIONS = 4;
const PRESETTLE_ITERATIONS = 640;
const TARGET_OFFSET = { x: 34, y: -24 } as const;

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function centroid(
  values: readonly { readonly x: number; readonly y: number }[],
) {
  return {
    x: mean(values.map(({ x }) => x)),
    y: mean(values.map(({ y }) => y)),
  };
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function createFixture(): Fixture {
  const coreKeys = Array.from(
    { length: 80 },
    (_, index) => `core-${String(index).padStart(3, '0')}`,
  );
  const componentKeys = Array.from({ length: 10 }, (_, component) =>
    Array.from(
      { length: 3 },
      (_, index) => `component-${String(component).padStart(2, '0')}-${index}`,
    ),
  );
  const isolateKeys = Array.from(
    { length: 190 },
    (_, index) => `isolate-${String(index).padStart(3, '0')}`,
  );
  const keys = [...coreKeys, ...componentKeys.flat(), ...isolateKeys];
  const nodes = keys.map((key, index) => {
    const angle = index * 2.399963229728653;
    const radius = 4 + Math.sqrt(index + 1) * 0.72;
    return {
      key,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      folderKey: `folder-${index % 8}`,
    };
  });
  const coreEdges = coreKeys.flatMap((source, index) => [
    {
      key: `core-ring-${index}`,
      source,
      target: coreKeys[(index + 1) % coreKeys.length]!,
      weight: 1,
    },
    {
      key: `core-chord-${index}`,
      source,
      target: coreKeys[(index * 17 + 23) % coreKeys.length]!,
      weight: 1,
    },
  ]);
  const componentEdges = componentKeys.flatMap((keys, component) => [
    {
      key: `component-${component}-0`,
      source: keys[0]!,
      target: keys[1]!,
      weight: 1,
    },
    {
      key: `component-${component}-1`,
      source: keys[1]!,
      target: keys[2]!,
      weight: 1,
    },
  ]);
  if (nodes.length !== 300) {
    throw new Error(
      `MOVE300B fixture must contain 300 nodes, found ${nodes.length}.`,
    );
  }
  return {
    nodes,
    edges: [...coreEdges, ...componentEdges],
    coreKeys,
    isolateKeys,
    componentKeys,
  };
}

function seedPositions(
  fixture: Fixture,
  settled: readonly Position[],
  folderClustering: boolean,
): readonly Position[] {
  const settings = resolveGlobalPhysicsSettings({
    folderClustering,
    spacingPreset: 'normal',
  });
  return deriveGlobalFolderMacroSnapshot({
    nodes: fixture.nodes,
    positions: settled,
    settings,
    policy: createGlobalFolderMacroPolicy(fixture.nodes, settings),
  });
}

function attractors(
  fixture: Fixture,
  kind: 'none' | 'one-pull' | 'cross-component-pull',
): readonly NetworkPhysicsAttractor[] {
  if (kind === 'none') return [];
  const members =
    kind === 'one-pull'
      ? fixture.coreKeys.slice(0, 20)
      : [...fixture.coreKeys.slice(0, 20), ...fixture.componentKeys[0]!];
  return [
    {
      ruleFolderKey: kind,
      memberNodeKeys: members,
      targetX: 46,
      targetY: 18,
      strength: 70,
    },
  ];
}

function buildGraph(
  fixture: Fixture,
  initial: readonly Position[],
): PhysicsGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; constraintEligible: boolean },
    { weight: number }
  >();
  for (const position of initial) {
    graph.addNode(position.key, {
      x: position.x,
      y: position.y,
      size: 1,
      constraintEligible: true,
    });
  }
  for (const edge of fixture.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

function graphPositions(graph: PhysicsGraph): readonly Position[] {
  return graph
    .mapNodes((key, node) => ({ key, x: node.x, y: node.y }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function assign(graph: PhysicsGraph): void {
  forceAtlas2.assign(graph, {
    iterations: 1,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: false,
      edgeWeightInfluence: 1,
      scalingRatio: 1.15,
      strongGravityMode: false,
      gravity: 1,
    },
  });
}

function presettle(fixture: Fixture): readonly Position[] {
  const graph = buildGraph(fixture, fixture.nodes);
  forceAtlas2.assign(graph, {
    iterations: PRESETTLE_ITERATIONS,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: false,
      edgeWeightInfluence: 1,
      scalingRatio: 1.15,
      strongGravityMode: false,
      gravity: 1,
    },
  });
  return graphPositions(graph);
}

function activeKeys(
  fixture: Fixture,
  pull: readonly NetworkPhysicsAttractor[],
): ReadonlySet<string> {
  const active = new Set(fixture.coreKeys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const attractor of pull) {
      if (
        attractor.strength <= 0 ||
        !attractor.memberNodeKeys.some((key) => active.has(key))
      ) {
        continue;
      }
      for (const key of attractor.memberNodeKeys) {
        const component = fixture.componentKeys.find((keys) =>
          keys.includes(key),
        );
        for (const coupled of component ?? [key]) {
          if (!active.has(coupled)) {
            active.add(coupled);
            changed = true;
          }
        }
      }
    }
  }
  return active;
}

function reassertPositions(
  graph: PhysicsGraph,
  positions: ReadonlyMap<string, Position>,
): void {
  for (const [key, position] of positions) {
    graph.mergeNodeAttributes(key, { x: position.x, y: position.y });
  }
}

function recenterComponents(
  graph: PhysicsGraph,
  components: readonly (readonly string[])[],
  initialCentroids: readonly { readonly x: number; readonly y: number }[],
): void {
  components.forEach((keys, index) => {
    const current = centroid(keys.map((key) => graph.getNodeAttributes(key)));
    const initial = initialCentroids[index]!;
    for (const key of keys) {
      const node = graph.getNodeAttributes(key);
      graph.mergeNodeAttributes(key, {
        x: node.x + initial.x - current.x,
        y: node.y + initial.y - current.y,
      });
    }
  });
}

function measure(
  fixture: Fixture,
  initial: ReadonlyMap<string, Position>,
  currentValues: readonly Position[],
  target: { readonly x: number; readonly y: number },
  draggedKey: string,
) {
  const current = new Map(currentValues.map((value) => [value.key, value]));
  const graphCenter = centroid(currentValues);
  const isolateRadii = fixture.isolateKeys.map((key) =>
    distance(current.get(key)!, graphCenter),
  );
  const isolateDisplacements = fixture.isolateKeys.map((key) =>
    distance(initial.get(key)!, current.get(key)!),
  );
  const componentDrift = fixture.componentKeys.map((keys) =>
    distance(
      centroid(keys.map((key) => initial.get(key)!)),
      centroid(keys.map((key) => current.get(key)!)),
    ),
  );
  const coreCenter = centroid(fixture.coreKeys.map((key) => current.get(key)!));
  const coreRadii = fixture.coreKeys.map((key) =>
    distance(current.get(key)!, coreCenter),
  );
  const coreMotion = fixture.coreKeys
    .slice(1)
    .map((key) => distance(initial.get(key)!, current.get(key)!));
  return {
    isolateRadius: {
      p50: rounded(percentile(isolateRadii, 0.5)),
      p90: rounded(percentile(isolateRadii, 0.9)),
      maximum: rounded(Math.max(...isolateRadii)),
    },
    isolateDisplacement: {
      p50: rounded(percentile(isolateDisplacements, 0.5)),
      p90: rounded(percentile(isolateDisplacements, 0.9)),
      maximum: rounded(Math.max(...isolateDisplacements)),
    },
    disconnectedComponentCentroidDrift: {
      mean: rounded(mean(componentDrift)),
      p90: rounded(percentile(componentDrift, 0.9)),
      maximum: rounded(Math.max(...componentDrift)),
    },
    connectedCoreRadius: {
      mean: rounded(mean(coreRadii)),
      p90: rounded(percentile(coreRadii, 0.9)),
    },
    draggedComponentMotion: {
      mean: rounded(mean(coreMotion)),
      maximum: rounded(Math.max(...coreMotion)),
    },
    targetError: rounded(distance(current.get(draggedKey)!, target)),
  };
}

function manualTrial(input: {
  readonly fixture: Fixture;
  readonly initial: readonly Position[];
  readonly pull: readonly NetworkPhysicsAttractor[];
  readonly candidate: Candidate;
}) {
  const graph = buildGraph(input.fixture, input.initial);
  const initial = new Map(input.initial.map((value) => [value.key, value]));
  const target = {
    x: initial.get(input.fixture.coreKeys[0]!)!.x + TARGET_OFFSET.x,
    y: initial.get(input.fixture.coreKeys[0]!)!.y + TARGET_OFFSET.y,
  };
  const active = activeKeys(input.fixture, input.pull);
  const stabilized = new Map(
    input.initial
      .filter(({ key }) => !active.has(key))
      .map((value) => [value.key, value]),
  );
  const stabilizedComponents = [
    ...input.fixture.componentKeys.filter((keys) =>
      keys.every((key) => !active.has(key)),
    ),
    ...input.fixture.isolateKeys
      .filter((key) => !active.has(key))
      .map((key) => [key]),
  ];
  const componentCentroids = stabilizedComponents.map((keys) =>
    centroid(keys.map((key) => initial.get(key)!)),
  );
  const checkpoints = new Map<number, ReturnType<typeof measure>>();
  const turnTimes: number[] = [];
  checkpoints.set(
    0,
    measure(
      input.fixture,
      initial,
      graphPositions(graph),
      target,
      input.fixture.coreKeys[0]!,
    ),
  );
  for (let turn = 1; turn <= HOT_TURNS; turn += 1) {
    const started = performance.now();
    for (let iteration = 0; iteration < HOT_ITERATIONS; iteration += 1) {
      graph.mergeNodeAttributes(input.fixture.coreKeys[0]!, target);
      if (input.candidate === 'A1-node-stabilization') {
        reassertPositions(graph, stabilized);
      }
      assign(graph);
      applyNetworkPhysicsPullIteration(graph, input.pull);
      if (input.candidate === 'A1-node-stabilization') {
        reassertPositions(graph, stabilized);
      } else if (input.candidate === 'B-centroid-stabilization') {
        recenterComponents(graph, stabilizedComponents, componentCentroids);
      }
      graph.mergeNodeAttributes(input.fixture.coreKeys[0]!, target);
    }
    turnTimes.push(performance.now() - started);
    if ([1, 16, 64, HOT_TURNS].includes(turn)) {
      checkpoints.set(
        turn,
        measure(
          input.fixture,
          initial,
          graphPositions(graph),
          target,
          input.fixture.coreKeys[0]!,
        ),
      );
    }
  }
  return {
    candidate: input.candidate,
    activeNodeCount: active.size,
    stabilizedNodeCount: stabilized.size,
    checkpointMetrics: Object.fromEntries(checkpoints),
    hotTurnMs: {
      p50: rounded(percentile(turnTimes, 0.5)),
      p95: rounded(percentile(turnTimes, 0.95)),
    },
  };
}

function productionTrial(input: {
  readonly fixture: Fixture;
  readonly initial: readonly Position[];
  readonly pull: readonly NetworkPhysicsAttractor[];
  readonly folderClustering: boolean;
  readonly draggedNodeKey?: string;
}) {
  const settings = resolveGlobalPhysicsSettings({
    folderClustering: input.folderClustering,
    spacingPreset: 'normal',
  });
  const seed: NetworkPhysicsSeed = {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode: 'all',
    sessionGeneration: 'move300b-analysis',
    simulationGeneration: 'move300b-analysis-simulation',
    nodes: input.initial.map((position) => ({
      ...position,
      size: 1,
      constraintEligible: true,
    })),
    edges: input.fixture.edges,
    settings: {
      edgeWeightInfluence: settings.linkForce,
      scalingRatio: Math.max(0.1, settings.withinFolderSpacing),
      strongGravityMode: false,
      gravity: 1,
      barnesHutThreshold: 1_000,
    },
    attractors: input.pull,
    automaticFolderFieldPolicy: input.folderClustering
      ? 'seeded-output-relaxation'
      : 'none',
  };
  const simulation = new ContinuousNetworkSimulation(seed);
  const initial = new Map(input.initial.map((value) => [value.key, value]));
  const draggedKey = input.draggedNodeKey ?? input.fixture.coreKeys[0]!;
  const target = {
    x: initial.get(draggedKey)!.x + TARGET_OFFSET.x,
    y: initial.get(draggedKey)!.y + TARGET_OFFSET.y,
  };
  simulation.handle({
    schemaVersion: 1,
    kind: 'begin',
    sessionGeneration: seed.sessionGeneration,
    simulationGeneration: seed.simulationGeneration,
    gestureId: 'move300b-analysis-gesture',
    sequence: 0,
    nodeKey: draggedKey,
    target,
  });
  const checkpoints = new Map<number, ReturnType<typeof measure>>();
  const turnTimes: number[] = [];
  checkpoints.set(
    0,
    measure(input.fixture, initial, simulation.positions(), target, draggedKey),
  );
  for (let turn = 1; turn <= HOT_TURNS; turn += 1) {
    const started = performance.now();
    const result = simulation.advance();
    turnTimes.push(performance.now() - started);
    if (result.failure !== undefined) {
      throw new Error(
        `Production drift trial failed: ${result.failure.message}`,
      );
    }
    if ([1, 16, 64, HOT_TURNS].includes(turn)) {
      checkpoints.set(
        turn,
        measure(
          input.fixture,
          initial,
          simulation.positions(),
          target,
          draggedKey,
        ),
      );
    }
  }
  simulation.handle({
    schemaVersion: 1,
    kind: 'end',
    sessionGeneration: seed.sessionGeneration,
    simulationGeneration: seed.simulationGeneration,
    gestureId: 'move300b-analysis-gesture',
    sequence: 1,
    nodeKey: draggedKey,
    reason: 'released',
  });
  let coolingFrames = 0;
  let coolingIterations = 0;
  let failure: string | null = null;
  const coolingStarted = performance.now();
  while (simulation.hasScheduledWork && coolingFrames < 300) {
    const result = simulation.advance();
    coolingFrames += result.frame === undefined ? 0 : 1;
    coolingIterations =
      result.frame?.iterationsCompleted ??
      result.failure?.iterationsCompleted ??
      coolingIterations;
    failure = result.failure?.code ?? null;
    if (failure !== null) break;
  }
  const coolingMs = performance.now() - coolingStarted;
  const finalMetrics = measure(
    input.fixture,
    initial,
    simulation.positions(),
    target,
    draggedKey,
  );
  const scheduledWorkAfterRelease = simulation.hasScheduledWork;
  const postSleepAdvance = simulation.advance();
  return {
    checkpointMetrics: Object.fromEntries(checkpoints),
    hotTurnMs: {
      p50: rounded(percentile(turnTimes, 0.5)),
      p95: rounded(percentile(turnTimes, 0.95)),
    },
    release: {
      state: simulation.state,
      failure,
      coolingFrames,
      coolingIterations,
      coolingMs: rounded(coolingMs),
      scheduledWorkAfterRelease,
      postSleepAdvanceWasEmpty:
        postSleepAdvance.frame === undefined &&
        postSleepAdvance.failure === undefined,
      finalMetrics,
    },
  };
}

function layoutAudit(fixture: Fixture, positions: readonly Position[]) {
  const byKey = new Map(positions.map((position) => [position.key, position]));
  const folders = new Map<string, Position[]>();
  for (const node of fixture.nodes) {
    const values = folders.get(node.folderKey) ?? [];
    values.push(byKey.get(node.key)!);
    folders.set(node.folderKey, values);
  }
  const folderCentroids = [...folders.values()].map(centroid);
  const withinFolder = [...folders.values()].flatMap((values) => {
    const center = centroid(values);
    return values.map((value) => distance(value, center));
  });
  const betweenFolders: number[] = [];
  for (let left = 0; left < folderCentroids.length; left += 1) {
    for (let right = left + 1; right < folderCentroids.length; right += 1) {
      betweenFolders.push(
        distance(folderCentroids[left]!, folderCentroids[right]!),
      );
    }
  }
  const graphCenter = centroid(positions);
  const isolateRadii = fixture.isolateKeys.map((key) =>
    distance(byKey.get(key)!, graphCenter),
  );
  return {
    meanWithinFolderDistance: rounded(mean(withinFolder)),
    meanFolderCentroidSeparation: rounded(mean(betweenFolders)),
    degreeZeroRadiusP90: rounded(percentile(isolateRadii, 0.9)),
    meanReferenceEdgeLength: rounded(
      mean(
        fixture.edges.map((edge) =>
          distance(byKey.get(edge.source)!, byKey.get(edge.target)!),
        ),
      ),
    ),
  };
}

function main(): void {
  const fixture = createFixture();
  const settled = presettle(fixture);
  const scenarios = [
    {
      id: 'unclustered-no-pull',
      folderClustering: false,
      pull: 'none' as const,
    },
    { id: 'clustered-no-pull', folderClustering: true, pull: 'none' as const },
    {
      id: 'clustered-one-pull',
      folderClustering: true,
      pull: 'one-pull' as const,
    },
    {
      id: 'clustered-cross-component-pull',
      folderClustering: true,
      pull: 'cross-component-pull' as const,
    },
  ].map((scenario) => {
    const initial = seedPositions(fixture, settled, scenario.folderClustering);
    const pull = attractors(fixture, scenario.pull);
    return {
      ...scenario,
      production: productionTrial({
        fixture,
        initial,
        pull,
        folderClustering: scenario.folderClustering,
      }),
      candidates: (
        [
          'unbounded-baseline',
          'A1-node-stabilization',
          'B-centroid-stabilization',
        ] as const
      ).map((candidate) => manualTrial({ fixture, initial, pull, candidate })),
    };
  });
  const baseline = scenarios[0]!.candidates[0]!;
  const baselineStart = baseline.checkpointMetrics[0]!.isolateRadius.p90;
  const baselineEnd = baseline.checkpointMetrics[HOT_TURNS]!.isolateRadius.p90;
  const baselineRadiusProgression = [0, 1, 16, 64, HOT_TURNS].map(
    (turn) => baseline.checkpointMetrics[turn]!.isolateRadius.p90,
  );
  const baselineMonotonicExpansion = baselineRadiusProgression.every(
    (value, index) =>
      index === 0 || value > baselineRadiusProgression[index - 1]!,
  );
  if (baselineEnd <= baselineStart * 1.1) {
    throw new Error(
      `Unbounded production analogue did not reproduce material isolate expansion (${baselineStart} -> ${baselineEnd}).`,
    );
  }
  if (!baselineMonotonicExpansion) {
    throw new Error(
      'Unbounded production analogue did not expand monotonically.',
    );
  }
  const clustered = seedPositions(fixture, settled, true);
  const unclustered = seedPositions(fixture, settled, false);
  const isolatedFileProduction = productionTrial({
    fixture,
    initial: unclustered,
    pull: [],
    folderClustering: false,
    draggedNodeKey: fixture.isolateKeys[0]!,
  });
  const report = {
    schemaVersion: 1,
    generatedBy: 'pnpm analyze:network-physics-drift',
    fixture: {
      nodes: fixture.nodes.length,
      connectedCoreNodes: fixture.coreKeys.length,
      isolates: fixture.isolateKeys.length,
      disconnectedComponents: fixture.componentKeys.length,
      disconnectedComponentSize: fixture.componentKeys[0]!.length,
      edges: fixture.edges.length,
      hotTurns: HOT_TURNS,
      iterationsPerTurn: HOT_ITERATIONS,
      presettleIterations: PRESETTLE_ITERATIONS,
    },
    m2HandoffAudit: {
      unclustered: layoutAudit(fixture, unclustered),
      clustered: layoutAudit(fixture, clustered),
      note: 'M2 is applied once to the seed snapshot only; no candidate feeds it back into FA2.',
    },
    scenarios,
    isolatedFileProduction,
    acceptance: {
      baselineMaterialExpansion: true,
      baselineMonotonicExpansion,
      baselineRadiusProgression,
      thresholdRatio: 1.1,
      observedRatio: rounded(baselineEnd / baselineStart),
      productionUnrelatedIsolatesExact: scenarios.every(
        ({ production }) =>
          production.checkpointMetrics[HOT_TURNS]!.isolateDisplacement
            .maximum === 0 &&
          production.release.finalMetrics.isolateDisplacement.maximum === 0,
      ),
      productionReleasedToSleep:
        scenarios.every(
          ({ production }) =>
            production.release.state === 'sleeping' &&
            production.release.failure === null &&
            !production.release.scheduledWorkAfterRelease &&
            production.release.postSleepAdvanceWasEmpty,
        ) &&
        isolatedFileProduction.release.state === 'sleeping' &&
        isolatedFileProduction.release.failure === null &&
        isolatedFileProduction.release.coolingFrames === 0,
    },
  };
  if (!report.acceptance.productionReleasedToSleep) {
    throw new Error(
      'A production isolate-heavy scenario did not release to sleep.',
    );
  }
  if (!report.acceptance.productionUnrelatedIsolatesExact) {
    throw new Error(
      'Production moved an unrelated isolate during hold or cooling.',
    );
  }
  const outputDirectory = fileURLToPath(
    new URL('../../../output/physics1/', import.meta.url),
  );
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = `${outputDirectory}component-drift-analysis.json`;
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        fixture: report.fixture,
        acceptance: report.acceptance,
        m2HandoffAudit: report.m2HandoffAudit,
        isolatedFileProduction: {
          targetError:
            isolatedFileProduction.checkpointMetrics[HOT_TURNS]!.targetError,
          unrelatedCoreMotionMaximum:
            isolatedFileProduction.checkpointMetrics[HOT_TURNS]!
              .draggedComponentMotion.maximum,
          release: isolatedFileProduction.release,
        },
        scenarios: scenarios.map(({ id, candidates, production }) => ({
          id,
          production: {
            isolateRadiusP90Start:
              production.checkpointMetrics[0]!.isolateRadius.p90,
            isolateRadiusP90End:
              production.checkpointMetrics[HOT_TURNS]!.isolateRadius.p90,
            componentDriftP90:
              production.checkpointMetrics[HOT_TURNS]!
                .disconnectedComponentCentroidDrift.p90,
            hotTurnMs: production.hotTurnMs,
            isolateDisplacementMaximum:
              production.checkpointMetrics[HOT_TURNS]!.isolateDisplacement
                .maximum,
            release: {
              state: production.release.state,
              failure: production.release.failure,
              coolingFrames: production.release.coolingFrames,
              coolingMs: production.release.coolingMs,
              finalIsolateDisplacementMaximum:
                production.release.finalMetrics.isolateDisplacement.maximum,
              postSleepAdvanceWasEmpty:
                production.release.postSleepAdvanceWasEmpty,
            },
          },
          candidates: candidates.map((candidate) => ({
            candidate: candidate.candidate,
            activeNodeCount: candidate.activeNodeCount,
            isolateRadiusP90End:
              candidate.checkpointMetrics[HOT_TURNS]!.isolateRadius.p90,
            componentDriftP90:
              candidate.checkpointMetrics[HOT_TURNS]!
                .disconnectedComponentCentroidDrift.p90,
            coreMotionMean:
              candidate.checkpointMetrics[HOT_TURNS]!.draggedComponentMotion
                .mean,
            targetError: candidate.checkpointMetrics[HOT_TURNS]!.targetError,
            hotTurnMs: candidate.hotTurnMs,
          })),
        })),
        outputPath,
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
    `MOVE300B component-drift analysis failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
