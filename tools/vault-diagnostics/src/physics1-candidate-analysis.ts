import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {
  ContinuousNetworkSimulation,
  NETWORK_PHYSICS_SCHEMA_VERSION,
  type NetworkPhysicsAttractor,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsSeed,
} from '@icarus-graph-explorer/renderer-sigma/physics';

type Position = {
  readonly key: string;
  readonly x: number;
  readonly y: number;
};
type Fixture = {
  readonly id: string;
  readonly nodes: readonly Position[];
  readonly edges: readonly {
    key: string;
    source: string;
    target: string;
    weight: number;
  }[];
};

const PUBLIC_QUANTA = [1, 2, 4, 8] as const;
const TARGET = { x: 38, y: -27 } as const;
const PULL_STRENGTH = 0.7;

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function seededPosition(index: number, count: number): Position {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  return {
    key: `n${index}`,
    x: Math.cos(angle) * (9 + (index % 7)) + ((index * 17) % 5),
    y: Math.sin(angle) * (9 + (index % 11)) - ((index * 13) % 7),
  };
}

function fixture(
  id: string,
  count: number,
  pairs: readonly (readonly [number, number, number?])[],
): Fixture {
  return {
    id,
    nodes: Array.from({ length: count }, (_, index) =>
      seededPosition(index, count),
    ),
    edges: pairs.map(([source, target, weight = 1], index) => ({
      key: `e${index}`,
      source: `n${source}`,
      target: `n${target}`,
      weight,
    })),
  };
}

function ringPairs(count: number): readonly (readonly [number, number])[] {
  return Array.from(
    { length: count },
    (_, index) => [index, (index + 1) % count] as const,
  );
}

function fixtures(): readonly Fixture[] {
  return [
    fixture(
      'chain',
      10,
      Array.from({ length: 9 }, (_, index) => [index, index + 1]),
    ),
    fixture(
      'star',
      12,
      Array.from({ length: 11 }, (_, index) => [0, index + 1]),
    ),
    fixture('weak-link', 8, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4, 0.05],
      [4, 5],
      [5, 6],
      [6, 7],
    ]),
    fixture('one-isolate', 8, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ]),
    fixture('multiple-isolates', 10, [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]),
    fixture('medium-mixed', 180, [
      ...ringPairs(172),
      ...Array.from(
        { length: 160 },
        (_, index) => [index, (index * 19 + 37) % 172] as const,
      ),
    ]),
  ];
}

type PhysicsGraph = MultiDirectedGraph<
  { x: number; y: number; size: number },
  { weight: number }
>;

function buildGraph(value: Fixture): PhysicsGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number },
    { weight: number }
  >();
  for (const node of value.nodes) graph.addNode(node.key, { ...node, size: 4 });
  for (const edge of value.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

function positions(graph: PhysicsGraph): readonly Position[] {
  return graph.mapNodes((key, attributes) => ({
    key,
    x: attributes.x,
    y: attributes.y,
  }));
}

function assign(graph: PhysicsGraph, iterations: number): void {
  forceAtlas2.assign(graph, {
    iterations,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order >= 600,
      edgeWeightInfluence: 1,
      scalingRatio: 1.35,
      strongGravityMode: true,
      gravity: 0.08,
    },
  });
}

function setTarget(graph: PhysicsGraph): void {
  graph.mergeNodeAttributes('n0', TARGET);
}

function distance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function hardConstraintTrial(value: Fixture, quantum: number) {
  const graph = buildGraph(value);
  const neighborKey = value.edges.find(
    ({ source, target }) => source === 'n0' || target === 'n0',
  );
  const reactingKey =
    neighborKey === undefined
      ? 'n1'
      : neighborKey.source === 'n0'
        ? neighborKey.target
        : neighborKey.source;
  const reactingBefore = { ...graph.getNodeAttributes(reactingKey) };
  let maximumDriftBeforeReassertion = 0;
  for (let completed = 0; completed < 48; completed += quantum) {
    setTarget(graph);
    assign(graph, Math.min(quantum, 48 - completed));
    maximumDriftBeforeReassertion = Math.max(
      maximumDriftBeforeReassertion,
      distance(graph.getNodeAttributes('n0'), TARGET),
    );
    setTarget(graph);
  }
  const reactingAfter = graph.getNodeAttributes(reactingKey);
  return {
    fixtureId: value.id,
    quantum,
    publishedTargetError: distance(graph.getNodeAttributes('n0'), TARGET),
    maximumDriftBeforeReassertion,
    reactingNodeDisplacement: distance(reactingBefore, reactingAfter),
  };
}

function rmsRadius(graph: PhysicsGraph): number {
  const values = positions(graph);
  const center = {
    x: values.reduce((sum, value) => sum + value.x, 0) / values.length,
    y: values.reduce((sum, value) => sum + value.y, 0) / values.length,
  };
  return Math.max(
    1e-6,
    Math.sqrt(
      values.reduce(
        (sum, value) =>
          sum + (value.x - center.x) ** 2 + (value.y - center.y) ** 2,
        0,
      ) / values.length,
    ),
  );
}

function applyPullIteration(graph: PhysicsGraph): void {
  const scale = rmsRadius(graph);
  const gain = 1 - (1 - 0.55 * PULL_STRENGTH) ** (1 / 4);
  const cap = (0.6 * scale * PULL_STRENGTH) / 4;
  for (const key of graph.nodes()) {
    const attributes = graph.getNodeAttributes(key);
    const dx = -attributes.x;
    const dy = -attributes.y;
    const length = Math.hypot(dx, dy);
    const applied = Math.min(length * gain, cap);
    if (length > 0) {
      graph.mergeNodeAttributes(key, {
        x: attributes.x + (dx / length) * applied,
        y: attributes.y + (dy / length) * applied,
      });
    }
  }
}

function pullCadenceTrial(value: Fixture, publishQuantum: number) {
  const graph = buildGraph(value);
  let frames = 0;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    assign(graph, 1);
    applyPullIteration(graph);
    if ((iteration + 1) % publishQuantum === 0 || iteration === 47) frames += 1;
  }
  return { publishQuantum, frames, positions: positions(graph) };
}

function maximumPositionDifference(
  left: readonly Position[],
  right: readonly Position[],
): number {
  const rightByKey = new Map(right.map((value) => [value.key, value]));
  return Math.max(
    ...left.map((value) => distance(value, rightByKey.get(value.key)!)),
  );
}

function simulationSeed(
  value: Fixture,
  mode: 'focus' | 'all',
  attractors: readonly NetworkPhysicsAttractor[] = [],
): NetworkPhysicsSeed {
  return {
    schemaVersion: NETWORK_PHYSICS_SCHEMA_VERSION,
    kind: 'initialize',
    mode,
    sessionGeneration: `analysis:${value.id}`,
    simulationGeneration: `analysis:${value.id}:simulation`,
    ...(mode === 'focus' ? { rootKey: 'n0' } : {}),
    nodes: value.nodes.map((node) => ({
      ...node,
      size: 4,
      constraintEligible: true,
    })),
    edges: value.edges,
    settings:
      mode === 'focus'
        ? {
            edgeWeightInfluence: 1,
            scalingRatio: 1.35,
            strongGravityMode: true,
            gravity: 0.08,
            barnesHutThreshold: 600,
          }
        : {
            edgeWeightInfluence: 1,
            scalingRatio: 1,
            strongGravityMode: false,
            gravity: 1,
            barnesHutThreshold: 1_000,
          },
    attractors,
  };
}

function lifecycleTrial(input: {
  readonly id: string;
  readonly fixture: Fixture;
  readonly mode: 'focus' | 'all';
  readonly attractors?: readonly NetworkPhysicsAttractor[];
}) {
  const seed = simulationSeed(input.fixture, input.mode, input.attractors);
  const simulation = new ContinuousNetworkSimulation(seed);
  const beforeNeighbor = simulation
    .positions()
    .find(({ key }) => key === 'n1')!;
  const target = { x: 38, y: -27 };
  simulation.handle({
    schemaVersion: 1,
    kind: 'begin',
    sessionGeneration: seed.sessionGeneration,
    simulationGeneration: seed.simulationGeneration,
    gestureId: 'analysis-gesture',
    sequence: 0,
    nodeKey: 'n0',
    target,
  });
  const hotFrames: NetworkPhysicsFrameResponse[] = [];
  const started = performance.now();
  for (let index = 0; index < 12; index += 1) {
    const frame = simulation.advance().frame;
    if (frame !== undefined) hotFrames.push(frame);
  }
  const hotMs = performance.now() - started;
  const finalHot = hotFrames.at(-1)!;
  const constrained = finalHot.positions.find(({ key }) => key === 'n0')!;
  const afterNeighbor = finalHot.positions.find(({ key }) => key === 'n1')!;
  const neighborFrameMovements = hotFrames.slice(1).map((frame, index) => {
    const before = hotFrames[index]!.positions.find(({ key }) => key === 'n1')!;
    const after = frame.positions.find(({ key }) => key === 'n1')!;
    return distance(before, after);
  });
  simulation.handle({
    schemaVersion: 1,
    kind: 'end',
    sessionGeneration: seed.sessionGeneration,
    simulationGeneration: seed.simulationGeneration,
    gestureId: 'analysis-gesture',
    sequence: 1,
    nodeKey: 'n0',
    reason: 'released',
  });
  let coolingFrames = 0;
  let coolingIterations = 0;
  let failure: string | undefined;
  const coolingStarted = performance.now();
  while (simulation.hasScheduledWork && coolingFrames < 300) {
    const result = simulation.advance();
    coolingFrames += result.frame === undefined ? 0 : 1;
    coolingIterations = result.frame?.iterationsCompleted ?? coolingIterations;
    failure = result.failure?.code;
    if (failure !== undefined) break;
  }
  const coolingMs = performance.now() - coolingStarted;
  const messageBytes = hotFrames.reduce(
    (total, frame) => total + Buffer.byteLength(JSON.stringify(frame)),
    0,
  );
  return {
    id: input.id,
    mode: input.mode,
    nodes: input.fixture.nodes.length,
    edges: input.fixture.edges.length,
    targetError: distance(constrained, target),
    neighborResponse: distance(beforeNeighbor, afterNeighbor),
    neighborDistanceToTargetChange:
      distance(beforeNeighbor, target) - distance(afterNeighbor, target),
    hotIterations: finalHot.iterationsCompleted,
    hotFrames: hotFrames.length,
    hotMs: Number(hotMs.toFixed(3)),
    hotIterationsPerSecond:
      hotMs === 0
        ? null
        : Number(((finalHot.iterationsCompleted / hotMs) * 1_000).toFixed(2)),
    publishedFramesPerSecond:
      hotMs === 0
        ? null
        : Number(((hotFrames.length / hotMs) * 1_000).toFixed(2)),
    meanNeighborFrameMovement: mean(neighborFrameMovements),
    maximumNeighborFrameMovement: Math.max(0, ...neighborFrameMovements),
    meanPublishedMessageBytes:
      hotFrames.length === 0 ? 0 : Math.round(messageBytes / hotFrames.length),
    coolingFrames,
    coolingIterations,
    coolingMs: Number(coolingMs.toFixed(3)),
    finalState: simulation.state,
    failure: failure ?? null,
    finalPositions: simulation.positions(),
  };
}

function scaleFixture(count: number): Fixture {
  const connected = Math.max(2, count - Math.max(1, Math.floor(count * 0.01)));
  const pairs = [
    ...ringPairs(connected),
    ...Array.from(
      { length: Math.max(0, connected - 2) },
      (_, index) => [index, (index * 47 + 23) % connected] as const,
    ),
  ];
  return fixture(`scale-${count}`, count, pairs);
}

function main(): void {
  const values = fixtures();
  const hardConstraint = values.flatMap((value) =>
    PUBLIC_QUANTA.map((quantum) => hardConstraintTrial(value, quantum)),
  );
  const pullRuns = PUBLIC_QUANTA.map((quantum) =>
    pullCadenceTrial(
      values.find(({ id }) => id === 'medium-mixed')!,
      quantum,
    ),
  );
  const pullReference = pullRuns[0]!.positions;
  const pullCadence = pullRuns.map(
    ({ publishQuantum, frames, positions: output }) => ({
      publishQuantum,
      frames,
      maximumDifferenceFromQuantum1: maximumPositionDifference(
        pullReference,
        output,
      ),
    }),
  );
  const scale = [100, 500, 1_000, 5_000].map((count) => {
    const graph = buildGraph(scaleFixture(count));
    const started = performance.now();
    assign(graph, 4);
    const elapsedMs = performance.now() - started;
    const output = positions(graph);
    const adoptionStarted = performance.now();
    new Map(output.map((position) => [position.key, position]));
    const mainThreadAdoptionMs = performance.now() - adoptionStarted;
    const messageBytes = Buffer.byteLength(JSON.stringify(output));
    const publishedFramesPerSecond = elapsedMs === 0 ? null : 1_000 / elapsedMs;
    return {
      nodes: count,
      edges: graph.size,
      iterations: 4,
      workerStepMs: Number(elapsedMs.toFixed(3)),
      iterationsPerSecond:
        elapsedMs === 0 ? null : Number(((4 / elapsedMs) * 1_000).toFixed(2)),
      publishedFramesPerSecond:
        publishedFramesPerSecond === null
          ? null
          : Number(publishedFramesPerSecond.toFixed(2)),
      messageBytes,
      messageBytesPerSecond:
        publishedFramesPerSecond === null
          ? null
          : Math.round(messageBytes * publishedFramesPerSecond),
      mainThreadAdoptionMs: Number(mainThreadAdoptionMs.toFixed(3)),
      finite: output.every(
        ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
      ),
    };
  });
  const medium = values.find(({ id }) => id === 'medium-mixed')!;
  const leftMembers = Array.from({ length: 60 }, (_, index) => `n${index}`);
  const rightMembers = Array.from(
    { length: 60 },
    (_, index) => `n${index + 60}`,
  );
  const lifecycleInputs = [
    ...values.slice(0, 5).map((value) => ({
      id: `focus-${value.id}`,
      fixture: value,
      mode: 'focus' as const,
    })),
    { id: 'all-pull-off', fixture: medium, mode: 'all' as const },
    {
      id: 'all-pull-on',
      fixture: medium,
      mode: 'all' as const,
      attractors: [
        {
          ruleFolderKey: 'left',
          memberNodeKeys: leftMembers,
          targetX: -42,
          targetY: 0,
          strength: 70,
        },
      ],
    },
    {
      id: 'all-competing-pulls-cross-references',
      fixture: medium,
      mode: 'all' as const,
      attractors: [
        {
          ruleFolderKey: 'left',
          memberNodeKeys: leftMembers,
          targetX: 40,
          targetY: -18,
          strength: 65,
        },
        {
          ruleFolderKey: 'right',
          memberNodeKeys: rightMembers,
          targetX: -40,
          targetY: 18,
          strength: 65,
        },
      ],
    },
  ];
  const lifecycle = lifecycleInputs.map((input) => {
    const first = lifecycleTrial(input);
    const second = lifecycleTrial(input);
    const deterministicMaximumDifference = maximumPositionDifference(
      first.finalPositions,
      second.finalPositions,
    );
    const { finalPositions, ...result } = first;
    void finalPositions;
    return { ...result, deterministicMaximumDifference };
  });
  const selected = hardConstraint
    .filter(({ quantum }) => quantum === 1)
    .every(
      ({ publishedTargetError, reactingNodeDisplacement }) =>
        publishedTargetError === 0 && reactingNodeDisplacement > 0,
    );
  if (!selected) {
    throw new Error(
      'No public ForceAtlas2 candidate passed the PHYSICS1 gate.',
    );
  }
  const report = {
    schemaVersion: 1,
    generatedBy: 'pnpm analyze:physics1',
    dependencyVersions: {
      graphology: '0.26.0',
      graphologyForceAtlas2: '0.10.1',
    },
    candidateA: {
      api: 'public FA2LayoutSupervisor start/stop/kill/isRunning',
      accepted: false,
      reason:
        'The public supervisor has no step, frame, or supported moving hard-constraint command. The package implementation recognizes an undocumented fixed attribute, which PHYSICS1 forbids relying on.',
    },
    candidateB: {
      api: 'public forceAtlas2.assign on one retained Graphology graph',
      comparedIterationQuanta: PUBLIC_QUANTA,
      selectedIterationQuantum: 1,
      accepted: true,
      reason:
        'One public physical iteration is the smallest supported boundary at which the moving target can be reasserted. Published frames are exact, and adjacent nodes react on every fixture.',
      hardConstraint,
    },
    pullCadence: {
      canonicalIterationsPerLegacyPullStep: 4,
      strength: PULL_STRENGTH,
      runs: pullCadence,
      accepted: pullCadence.every(
        ({ maximumDifferenceFromQuantum1 }) =>
          maximumDifferenceFromQuantum1 === 0,
      ),
      note: 'Pull is applied per physical iteration; publish cadence does not enter the simulation.',
    },
    productionLifecycle: lifecycle,
    placeComposition: {
      simulationTarget: TARGET,
      fixedTranslation: { x: 18, y: -10 },
      displayedTarget: { x: TARGET.x + 18, y: TARGET.y - 10 },
      targetInversionError: 0,
      fixedTranslationApplications: 1,
      simulationSeedIncludesPlace: false,
    },
    scale,
    scaleTimingIsInformationalOnly: true,
    decision: 'candidate-b-public-assign-single-iteration',
  };
  const outputDirectory = fileURLToPath(
    new URL('../../../output/physics1/', import.meta.url),
  );
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = `${outputDirectory}candidate-analysis.json`;
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify(
      {
        decision: report.decision,
        pullCadence: report.pullCadence.accepted,
        lifecycle: lifecycle.map(
          ({ id, finalState, failure, targetError }) => ({
            id,
            finalState,
            failure,
            targetError,
          }),
        ),
        scale,
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
    `PHYSICS1 candidate analysis failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
