import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import {
  applyNetworkPhysicsPullIteration,
  ContinuousNetworkSimulation,
  createAllNetworkPhysicsSeed,
  createFocusNetworkPhysicsSeed,
  NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT,
  type NetworkPhysicsAttractor,
  type NetworkPhysicsFrameResponse,
  type NetworkPhysicsSeed,
} from '@icarus-graph-explorer/renderer-sigma/physics';
import {
  createGlobalConvergencePolicy,
  createGlobalFolderMacroPolicy,
  createLocalConvergencePolicy,
} from '@icarus-graph-explorer/renderer-sigma/core';

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
const PULL_STRENGTH = 70;

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

function pullCadenceTrial(
  value: Fixture,
  publishQuantum: number,
  attractors: readonly NetworkPhysicsAttractor[],
) {
  const graph = buildGraph(value);
  let frames = 0;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    assign(graph, 1);
    applyNetworkPhysicsPullIteration(graph, attractors);
    if ((iteration + 1) % publishQuantum === 0 || iteration === 47) frames += 1;
  }
  return { publishQuantum, frames, positions: positions(graph) };
}

function productionPullScenarios(value: Fixture) {
  const firstGroup = value.nodes.slice(0, 60).map(({ key }) => key);
  const secondGroup = value.nodes.slice(60, 120).map(({ key }) => key);
  const firstCenter = {
    x: mean(value.nodes.slice(0, 60).map(({ x }) => x)),
    y: mean(value.nodes.slice(0, 60).map(({ y }) => y)),
  };
  return [
    {
      id: 'near-single-group',
      attractors: [
        {
          ruleFolderKey: 'near',
          memberNodeKeys: firstGroup,
          targetX: firstCenter.x + 0.25,
          targetY: firstCenter.y - 0.25,
          strength: PULL_STRENGTH,
        },
      ],
    },
    {
      id: 'far-single-group',
      attractors: [
        {
          ruleFolderKey: 'far',
          memberNodeKeys: firstGroup,
          targetX: 500,
          targetY: -400,
          strength: PULL_STRENGTH,
        },
      ],
    },
    {
      id: 'displaced-multiple-groups',
      attractors: [
        {
          ruleFolderKey: 'left',
          memberNodeKeys: firstGroup,
          targetX: -42,
          targetY: 18,
          strength: 65,
        },
        {
          ruleFolderKey: 'right',
          memberNodeKeys: secondGroup,
          targetX: 44,
          targetY: -16,
          strength: 80,
        },
      ],
    },
  ] as const;
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
  const sessionGeneration = `analysis:${value.id}`;
  const simulationGeneration = `analysis:${value.id}:simulation`;
  if (mode === 'focus') {
    return createFocusNetworkPhysicsSeed({
      request: {
        schemaVersion: 2,
        rootKey: 'n0',
        policy: createLocalConvergencePolicy(value.nodes.length),
        settings: {
          hierarchyWeight: 1,
          referenceWeight: 1,
          scalingRatio: 1.35,
        },
        nodes: value.nodes.map((node) => ({
          ...node,
          size: 4,
          kind: 'document' as const,
        })),
        edges: value.edges.map((edge) => ({
          ...edge,
          kind: 'reference' as const,
        })),
      },
      positions: value.nodes,
      sessionGeneration,
      simulationGeneration,
    });
  }
  const nodes = value.nodes.map((node) => ({
    ...node,
    size: 4,
    folderKey: 'analysis',
  }));
  const settings = {
    folderClustering: false,
    spacingPreset: 'normal',
  } as const;
  return createAllNetworkPhysicsSeed({
    request: {
      schemaVersion: 2,
      algorithm: 'reference-only',
      policy: createGlobalConvergencePolicy(nodes.length),
      macro: createGlobalFolderMacroPolicy(nodes, settings),
      settings,
      nodes,
      edges: value.edges,
    },
    dynamicPositions: value.nodes,
    attractors,
    constraintEligibleNodeKeys: new Set(value.nodes.map(({ key }) => key)),
    sessionGeneration,
    simulationGeneration,
  });
}

function lifecycleTrial(input: {
  readonly id: string;
  readonly fixture: Fixture;
  readonly mode: 'focus' | 'all';
  readonly attractors?: readonly NetworkPhysicsAttractor[];
  readonly hotTurns?: number;
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
  for (let index = 0; index < (input.hotTurns ?? 12); index += 1) {
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
    inProcessSimulationFramesPerSecond:
      hotMs === 0
        ? null
        : Number(((hotFrames.length / hotMs) * 1_000).toFixed(2)),
    meanNeighborFrameMovement: mean(neighborFrameMovements),
    maximumNeighborFrameMovement: Math.max(0, ...neighborFrameMovements),
    meanJsonEstimatedFrameBytes:
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
  const pullCadence = productionPullScenarios(
    values.find(({ id }) => id === 'medium-mixed')!,
  ).map((scenario) => {
    const runs = PUBLIC_QUANTA.map((quantum) =>
      pullCadenceTrial(
        values.find(({ id }) => id === 'medium-mixed')!,
        quantum,
        scenario.attractors,
      ),
    );
    const reference = runs[0]!.positions;
    return {
      id: scenario.id,
      runs: runs.map(({ publishQuantum, frames, positions: output }) => ({
        publishQuantum,
        frames,
        maximumDifferenceFromQuantum1: maximumPositionDifference(
          reference,
          output,
        ),
      })),
    };
  });
  const scale = [100, 500, 1_000, 5_000].map((count) => {
    const graph = buildGraph(scaleFixture(count));
    for (let warmup = 0; warmup < 3; warmup += 1) assign(graph, 4);
    const assignSamples: number[] = [];
    const arrayToMapSamples: number[] = [];
    for (let sample = 0; sample < 12; sample += 1) {
      const started = performance.now();
      assign(graph, 4);
      assignSamples.push(performance.now() - started);
      const positionSnapshot = positions(graph);
      const adoptionStarted = performance.now();
      new Map(
        positionSnapshot.map((position) => [position.key, position] as const),
      );
      arrayToMapSamples.push(performance.now() - adoptionStarted);
    }
    const output = positions(graph);
    const p50Ms = percentile(assignSamples, 0.5);
    const messageBytes = Buffer.byteLength(JSON.stringify(output));
    const theoreticalCallsPerSecond = p50Ms === 0 ? null : 1_000 / p50Ms;
    return {
      nodes: count,
      edges: graph.size,
      iterations: 4,
      warmupSamples: 3,
      measuredSamples: assignSamples.length,
      assignFourIterationP50Ms: Number(p50Ms.toFixed(3)),
      assignFourIterationP95Ms: Number(
        percentile(assignSamples, 0.95).toFixed(3),
      ),
      theoreticalIterationsPerSecondFromP50:
        p50Ms === 0 ? null : Number(((4 / p50Ms) * 1_000).toFixed(2)),
      theoreticalCallsPerSecond:
        theoreticalCallsPerSecond === null
          ? null
          : Number(theoreticalCallsPerSecond.toFixed(2)),
      jsonEstimatedPositionBytes: messageBytes,
      theoreticalJsonBytesPerSecond:
        theoreticalCallsPerSecond === null
          ? null
          : Math.round(messageBytes * theoreticalCallsPerSecond),
      arrayToMapP50Ms: Number(percentile(arrayToMapSamples, 0.5).toFixed(3)),
      arrayToMapP95Ms: Number(percentile(arrayToMapSamples, 0.95).toFixed(3)),
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
  const scale500 = scaleFixture(500);
  const scale100 = scaleFixture(100);
  const largeReleaseInputs = [
    {
      id: 'focus-supported-release-100',
      fixture: scale100,
      mode: 'focus' as const,
    },
    {
      id: 'all-supported-release-100',
      fixture: scale100,
      mode: 'all' as const,
    },
    {
      id: 'all-supported-release-100-pull',
      fixture: scale100,
      mode: 'all' as const,
      attractors: [
        {
          ruleFolderKey: 'supported-left',
          memberNodeKeys: scale100.nodes.slice(0, 40).map(({ key }) => key),
          targetX: -42,
          targetY: 18,
          strength: 70,
        },
      ],
    },
    {
      id: 'focus-large-release-500',
      fixture: scale500,
      mode: 'focus' as const,
    },
    { id: 'all-large-release-500', fixture: scale500, mode: 'all' as const },
    {
      id: 'all-large-release-500-pull',
      fixture: scale500,
      mode: 'all' as const,
      attractors: [
        {
          ruleFolderKey: 'large-left',
          memberNodeKeys: scale500.nodes.slice(0, 160).map(({ key }) => key),
          targetX: -42,
          targetY: 18,
          strength: 70,
        },
      ],
    },
    {
      id: 'focus-large-release-1000',
      fixture: scaleFixture(1_000),
      mode: 'focus' as const,
    },
    {
      id: 'all-large-release-1000',
      fixture: scaleFixture(1_000),
      mode: 'all' as const,
    },
    {
      id: 'all-large-release-5000',
      fixture: scaleFixture(5_000),
      mode: 'all' as const,
    },
  ];
  const largeRelease = largeReleaseInputs.map((input) => {
    const { finalPositions, ...result } = lifecycleTrial({
      ...input,
      hotTurns: 2,
    });
    void finalPositions;
    return result;
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
    schemaVersion: 2,
    generatedBy: 'pnpm analyze:physics1',
    productionSupportedNodeLimit: NETWORK_PHYSICS_SUPPORTED_NODE_LIMIT,
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
    pullPublicationIndependence: {
      liveReferenceIterations: 4,
      strength: PULL_STRENGTH,
      scenarios: pullCadence,
      accepted: pullCadence.every(({ runs }) =>
        runs.every(
          ({ maximumDifferenceFromQuantum1 }) =>
            maximumDifferenceFromQuantum1 === 0,
        ),
      ),
      note: 'The production group-centroid Pull function is applied per physical iteration, so publish cadence does not enter the simulation. This does not claim numerical identity with the static Pull pipeline.',
    },
    productionLifecycle: lifecycle,
    retainedSimulationLargeReleaseProbe: {
      results: largeRelease,
      limitation:
        'Direct retained-simulation probe only; it does not measure browser Worker transport, structured cloning, requestAnimationFrame adoption, Sigma, or rendering.',
    },
    placeComposition: {
      simulationTarget: TARGET,
      fixedTranslation: { x: 18, y: -10 },
      displayedTarget: { x: TARGET.x + 18, y: TARGET.y - 10 },
      targetInversionError: 0,
      fixedTranslationApplications: 1,
      simulationSeedIncludesPlace: false,
    },
    assignScaleMicrobenchmark: scale,
    scaleTimingLimitations:
      'Warm repeated synchronous public assign(graph, 4) samples. No Worker scheduling, structured-clone measurement, client validation/coalescing, Sigma adoption, rendering, or sustained displayed-frame distribution is measured.',
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
        pullPublicationIndependence:
          report.pullPublicationIndependence.accepted,
        lifecycle: lifecycle.map(
          ({ id, finalState, failure, targetError }) => ({
            id,
            finalState,
            failure,
            targetError,
          }),
        ),
        largeRelease: largeRelease.map(
          ({ id, finalState, failure, coolingIterations, coolingMs }) => ({
            id,
            finalState,
            failure,
            coolingIterations,
            coolingMs,
          }),
        ),
        assignScaleMicrobenchmark: scale,
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
