import {
  createGlobalConvergencePolicy,
  createGlobalFolderMacroPolicy,
  customGlobalLayoutSettings,
  deterministicGlobalPosition,
  deriveGlobalFolderMacroSnapshot,
  resolveGlobalPhysicsSettings,
} from '@icarus-graph-explorer/renderer-sigma/core';
import type {
  GlobalLayoutEdge,
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutSettings,
  ResolvedGlobalPhysicsSettings,
} from '@icarus-graph-explorer/renderer-sigma/types';
import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { globalConvergenceFixtures } from './convergence-fixtures';
import {
  measureDisplacement,
  type DisplacementMetrics,
} from './convergence-metrics';

export type GlobalMacroCandidateId = 'M0' | 'M1' | 'M2' | 'M3';

export interface GlobalMacroFixture {
  readonly id: string;
  readonly description: string;
  readonly category: 'reference-only' | 'folder';
  readonly request: Omit<GlobalLayoutRequest, 'requestId'>;
}

export interface GlobalMacroQuality {
  readonly scale: number;
  readonly meanWithinFolderDistance: number;
  readonly meanFolderCentroidDistance: number;
  readonly meanCrossFolderReferenceLength: number;
  readonly meanReferenceLength: number;
  readonly meanFolderDirectionDisplacement: number;
}

export interface GlobalMacroFrame {
  readonly macroStep: number;
  readonly batchIterations: number;
  readonly positions: readonly GlobalLayoutPosition[];
  readonly quality: GlobalMacroQuality;
}

export interface GlobalMacroRun {
  readonly candidate: GlobalMacroCandidateId;
  readonly fixtureId: string;
  readonly presettleIterations: number;
  readonly frames: readonly GlobalMacroFrame[];
  readonly computeMs: number;
  readonly folderPriorMs: number;
}

export interface GlobalMacroConvergenceResult {
  readonly candidate: GlobalMacroCandidateId;
  readonly fixtureId: string;
  readonly stopReason: 'stable' | 'max-iterations' | 'degenerate';
  readonly iterationsCompleted: number;
  readonly macroStepsCompleted: number;
  readonly stableSteps: number;
  readonly finalMovement: DisplacementMetrics | null;
  readonly hiddenProbeMovement: DisplacementMetrics | null;
  readonly finalPositions: readonly GlobalLayoutPosition[];
  readonly finalQuality: GlobalMacroQuality;
  readonly computeMs: number;
  readonly folderPriorMs: number;
}

type CandidateGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; folderKey?: string },
  { weight: number }
>;

interface FolderSummary {
  readonly key: string;
  readonly nodes: readonly string[];
  readonly x: number;
  readonly y: number;
}

const MACRO_BATCH_ITERATIONS = 32;
const CURRENT_PRIOR_APPLICATIONS = 5;
const FROZEN_TARGET_GAIN = 0.32;

function stableHash32(value: string, seed = 2_166_136_261): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function folderDirection(folderKey: string): { x: number; y: number } {
  const angle = (stableHash32(folderKey) / 0xffff_ffff) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function graphCentroid(graph: CandidateGraph): { x: number; y: number } {
  if (graph.order === 0) throw new Error('Global macro graph requires a node.');
  let x = 0;
  let y = 0;
  graph.forEachNode((_key, attributes) => {
    x += attributes.x;
    y += attributes.y;
  });
  return { x: x / graph.order, y: y / graph.order };
}

function graphScale(graph: CandidateGraph): number {
  const centroid = graphCentroid(graph);
  let squared = 0;
  graph.forEachNode((_key, attributes) => {
    squared +=
      (attributes.x - centroid.x) ** 2 + (attributes.y - centroid.y) ** 2;
  });
  return Math.max(1e-6, Math.sqrt(squared / graph.order));
}

function summarizeFolders(graph: CandidateGraph): readonly FolderSummary[] {
  const folders = new Map<string, { nodes: string[]; x: number; y: number }>();
  graph.forEachNode((key, attributes) => {
    if (attributes.folderKey === undefined) return;
    const folder = folders.get(attributes.folderKey) ?? {
      nodes: [],
      x: 0,
      y: 0,
    };
    folder.nodes.push(key);
    folder.x += attributes.x;
    folder.y += attributes.y;
    folders.set(attributes.folderKey, folder);
  });
  return [...folders]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, folder]) => ({
      key,
      nodes: folder.nodes.sort((left, right) => left.localeCompare(right)),
      x: folder.x / folder.nodes.length,
      y: folder.y / folder.nodes.length,
    }));
}

function buildGraph(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
): CandidateGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; folderKey?: string },
    { weight: number }
  >();
  for (const node of request.nodes) graph.addNode(node.key, { ...node });
  for (const edge of request.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

function positions(graph: CandidateGraph): readonly GlobalLayoutPosition[] {
  return graph
    .mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function assignForceAtlas2(
  graph: CandidateGraph,
  iterations: number,
  settings: ResolvedGlobalPhysicsSettings,
): void {
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

/** Current one-application transform used by production chunked-prior. */
function applyCurrentPrior(
  graph: CandidateGraph,
  settings: ResolvedGlobalPhysicsSettings,
): void {
  const folders = summarizeFolders(graph);
  if (
    !settings.folderClustering ||
    folders.length === 0 ||
    settings.folderCohesion === 0
  ) {
    return;
  }
  const scale = Math.max(1, graphScale(graph));
  const radialFactor =
    1 - settings.folderCohesion + (settings.withinFolderSpacing - 1) * 0.012;
  const separation =
    settings.folderCohesion * 0.16 * settings.betweenFolderSpacing * scale;
  for (const folder of folders) {
    const direction = folderDirection(folder.key);
    for (const node of folder.nodes) {
      const attributes = graph.getNodeAttributes(node);
      graph.mergeNodeAttributes(node, {
        x:
          folder.x +
          (attributes.x - folder.x) * radialFactor +
          direction.x * separation,
        y:
          folder.y +
          (attributes.y - folder.y) * radialFactor +
          direction.y * separation,
      });
    }
  }
}

/**
 * M2 applies one fixed total-prior field only to each output snapshot. The
 * working FA2 graph never receives the correction, so another convergence
 * check cannot multiply folder strength.
 */
function fixedTotalField(
  graph: CandidateGraph,
  settings: ResolvedGlobalPhysicsSettings,
): readonly GlobalLayoutPosition[] {
  const layoutSettings = globalLayoutSettingsFromResolved(settings);
  const nodes = graph.mapNodes((key, attributes) => ({
    key,
    ...(attributes.folderKey === undefined
      ? {}
      : { folderKey: attributes.folderKey }),
  }));
  return deriveGlobalFolderMacroSnapshot({
    nodes,
    positions: positions(graph),
    settings: layoutSettings,
    policy: createGlobalFolderMacroPolicy(nodes, layoutSettings),
  });
}

function globalLayoutSettingsFromResolved(
  settings: ResolvedGlobalPhysicsSettings,
): GlobalLayoutSettings {
  return {
    folderClustering: settings.folderClustering,
    spacingPreset: 'normal',
    custom: {
      ...customGlobalLayoutSettings('normal'),
      folderCohesion: settings.folderCohesion,
      linkForce: settings.linkForce,
      withinFolderSpacing: settings.withinFolderSpacing,
      betweenFolderSpacing: settings.betweenFolderSpacing,
    },
  };
}

function alignFrozenTarget(
  graph: CandidateGraph,
  frozenTarget: ReadonlyMap<string, GlobalLayoutPosition>,
): void {
  const currentCentroid = graphCentroid(graph);
  const targets = [...frozenTarget.values()];
  const targetCentroid = {
    x: mean(targets.map(({ x }) => x)),
    y: mean(targets.map(({ y }) => y)),
  };
  graph.forEachNode((key, attributes) => {
    const target = frozenTarget.get(key);
    if (target === undefined) {
      throw new Error(`Frozen Global macro target omitted ${key}.`);
    }
    const targetX = currentCentroid.x + target.x - targetCentroid.x;
    const targetY = currentCentroid.y + target.y - targetCentroid.y;
    graph.mergeNodeAttributes(key, {
      x: attributes.x + (targetX - attributes.x) * FROZEN_TARGET_GAIN,
      y: attributes.y + (targetY - attributes.y) * FROZEN_TARGET_GAIN,
    });
  });
}

function requestNodeByKey(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
): ReadonlyMap<string, (typeof request.nodes)[number]> {
  return new Map(request.nodes.map((node) => [node.key, node] as const));
}

export function globalMacroQuality(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
  values: readonly GlobalLayoutPosition[],
): GlobalMacroQuality {
  if (values.length === 0)
    throw new Error('Global macro quality requires nodes.');
  const byKey = new Map(values.map((value) => [value.key, value] as const));
  const nodes = requestNodeByKey(request);
  const centroid = {
    x: mean(values.map(({ x }) => x)),
    y: mean(values.map(({ y }) => y)),
  };
  const scale = Math.max(
    1e-6,
    Math.sqrt(
      mean(
        values.map(
          (value) => (value.x - centroid.x) ** 2 + (value.y - centroid.y) ** 2,
        ),
      ),
    ),
  );
  const folders = new Map<string, GlobalLayoutPosition[]>();
  for (const node of request.nodes) {
    if (node.folderKey === undefined) continue;
    const value = byKey.get(node.key);
    if (value === undefined)
      throw new Error(`Quality omitted node ${node.key}.`);
    const members = folders.get(node.folderKey) ?? [];
    members.push(value);
    folders.set(node.folderKey, members);
  }
  const folderCentroids = [...folders]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, members]) => ({
      key,
      members,
      x: mean(members.map(({ x }) => x)),
      y: mean(members.map(({ y }) => y)),
    }));
  const within = folderCentroids.flatMap((folder) =>
    folder.members.map(
      (member) => Math.hypot(member.x - folder.x, member.y - folder.y) / scale,
    ),
  );
  const between: number[] = [];
  for (let left = 0; left < folderCentroids.length; left += 1) {
    for (let right = left + 1; right < folderCentroids.length; right += 1) {
      const a = folderCentroids[left]!;
      const b = folderCentroids[right]!;
      between.push(Math.hypot(a.x - b.x, a.y - b.y) / scale);
    }
  }
  const referenceLengths = request.edges.map((edge) => {
    const source = byKey.get(edge.source)!;
    const target = byKey.get(edge.target)!;
    return Math.hypot(source.x - target.x, source.y - target.y) / scale;
  });
  const crossReferences = request.edges.flatMap((edge) => {
    const sourceNode = nodes.get(edge.source);
    const targetNode = nodes.get(edge.target);
    if (
      sourceNode?.folderKey === undefined ||
      targetNode?.folderKey === undefined ||
      sourceNode.folderKey === targetNode.folderKey
    ) {
      return [];
    }
    const source = byKey.get(edge.source)!;
    const target = byKey.get(edge.target)!;
    return [Math.hypot(source.x - target.x, source.y - target.y) / scale];
  });
  const directionDisplacement = folderCentroids.map((folder) => {
    const direction = folderDirection(folder.key);
    return (
      ((folder.x - centroid.x) * direction.x +
        (folder.y - centroid.y) * direction.y) /
      scale
    );
  });
  return {
    scale,
    meanWithinFolderDistance: mean(within),
    meanFolderCentroidDistance: mean(between),
    meanCrossFolderReferenceLength: mean(crossReferences),
    meanReferenceLength: mean(referenceLengths),
    meanFolderDirectionDisplacement: mean(directionDisplacement),
  };
}

function candidateOutput(
  candidate: GlobalMacroCandidateId,
  graph: CandidateGraph,
  settings: ResolvedGlobalPhysicsSettings,
): readonly GlobalLayoutPosition[] {
  return candidate === 'M2'
    ? fixedTotalField(graph, settings)
    : positions(graph);
}

export function runGlobalMacroCandidate(input: {
  readonly fixture: GlobalMacroFixture;
  readonly candidate: GlobalMacroCandidateId;
  readonly macroSteps: number;
  readonly presettleIterations?: number;
  readonly batchIterations?: readonly number[];
}): GlobalMacroRun {
  if (!Number.isSafeInteger(input.macroSteps) || input.macroSteps < 0) {
    throw new Error('Global macro step count must be a non-negative integer.');
  }
  const presettleIterations = input.presettleIterations ?? 0;
  const settings = resolveGlobalPhysicsSettings(input.fixture.request.settings);
  const graph = buildGraph(input.fixture.request);
  const started = performance.now();
  if (presettleIterations > 0) {
    assignForceAtlas2(graph, presettleIterations, settings);
  }
  const frozenTarget = new Map(
    fixedTotalField(graph, settings).map(
      (value) => [value.key, value] as const,
    ),
  );
  const frames: GlobalMacroFrame[] = [];
  let folderPriorMs = 0;
  const batchIterations =
    input.batchIterations ??
    Array.from({ length: input.macroSteps }, () => MACRO_BATCH_ITERATIONS);
  if (
    batchIterations.length !== input.macroSteps ||
    batchIterations.some(
      (iterations) =>
        !Number.isSafeInteger(iterations) ||
        iterations < 1 ||
        iterations > MACRO_BATCH_ITERATIONS,
    )
  ) {
    throw new Error(
      'Each Global macro-step must declare between 1 and 32 FA2 iterations.',
    );
  }
  for (let index = 0; index < input.macroSteps; index += 1) {
    const iterations = batchIterations[index]!;
    assignForceAtlas2(graph, iterations, settings);
    const priorStarted = performance.now();
    if (settings.folderClustering) {
      if (input.candidate === 'M0') applyCurrentPrior(graph, settings);
      else if (input.candidate === 'M1' && index < CURRENT_PRIOR_APPLICATIONS) {
        applyCurrentPrior(graph, settings);
      } else if (input.candidate === 'M3') {
        alignFrozenTarget(graph, frozenTarget);
      }
    }
    folderPriorMs += performance.now() - priorStarted;
    const output = candidateOutput(input.candidate, graph, settings);
    frames.push({
      macroStep: index + 1,
      batchIterations: iterations,
      positions: output,
      quality: globalMacroQuality(input.fixture.request, output),
    });
  }
  return {
    candidate: input.candidate,
    fixtureId: input.fixture.id,
    presettleIterations,
    frames,
    computeMs: performance.now() - started,
    folderPriorMs,
  };
}

export function globalConvergenceMaxIterations(nodeCount: number): number {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 1) {
    throw new Error(
      'Global convergence node count must be a positive integer.',
    );
  }
  return nodeCount <= 1_000 ? 640 : nodeCount <= 5_000 ? 120 : 80;
}

function stableMovement(movement: DisplacementMetrics): boolean {
  return (
    movement.all.p90 !== null &&
    movement.all.p90 <= 0.00512 &&
    (movement.lowDegree.count === 0 ||
      (movement.lowDegree.maximum !== null &&
        movement.lowDegree.maximum <= 0.01024)) &&
    movement.normalizedCentroidDrift <= 0.00512
  );
}

export function convergeGlobalMacroCandidate(input: {
  readonly fixture: GlobalMacroFixture;
  readonly candidate: GlobalMacroCandidateId;
}): GlobalMacroConvergenceResult {
  const nodeCount = input.fixture.request.nodes.length;
  const maxIterations = globalConvergenceMaxIterations(nodeCount);
  if (nodeCount === 1) {
    const value = [{ key: input.fixture.request.nodes[0]!.key, x: 0, y: 0 }];
    return {
      candidate: input.candidate,
      fixtureId: input.fixture.id,
      stopReason: 'degenerate',
      iterationsCompleted: 0,
      macroStepsCompleted: 0,
      stableSteps: 0,
      finalMovement: null,
      hiddenProbeMovement: null,
      finalPositions: value,
      finalQuality: globalMacroQuality(input.fixture.request, value),
      computeMs: 0,
      folderPriorMs: 0,
    };
  }
  const fullSteps = Math.floor(maxIterations / MACRO_BATCH_ITERATIONS);
  const partialIterations = maxIterations % MACRO_BATCH_ITERATIONS;
  const acceptedBatches = [
    ...Array.from({ length: fullSteps }, () => MACRO_BATCH_ITERATIONS),
    ...(partialIterations === 0 ? [] : [partialIterations]),
  ];
  const maxSteps = acceptedBatches.length;
  const run = runGlobalMacroCandidate({
    fixture: input.fixture,
    candidate: input.candidate,
    macroSteps: maxSteps + 1,
    batchIterations: [...acceptedBatches, MACRO_BATCH_ITERATIONS],
  });
  const initialGraph = buildGraph(input.fixture.request);
  const settings = resolveGlobalPhysicsSettings(input.fixture.request.settings);
  let previous = candidateOutput(input.candidate, initialGraph, settings);
  let stableSteps = 0;
  let finalMovement: DisplacementMetrics | null = null;
  let acceptedStep = maxSteps;
  let stopReason: GlobalMacroConvergenceResult['stopReason'] = 'max-iterations';
  for (let index = 0; index < maxSteps; index += 1) {
    const frame = run.frames[index]!;
    const movement = measureDisplacement({
      before: previous,
      after: frame.positions,
      edges: input.fixture.request.edges,
      alignment: { kind: 'centroid' },
    });
    finalMovement = movement;
    const full = frame.batchIterations === MACRO_BATCH_ITERATIONS;
    stableSteps = full && stableMovement(movement) ? stableSteps + 1 : 0;
    previous = frame.positions;
    if (stableSteps >= 3) {
      acceptedStep = index + 1;
      stopReason = 'stable';
      break;
    }
  }
  const finalFrame = run.frames[acceptedStep - 1]!;
  const probeFrame = run.frames[acceptedStep]!;
  const hiddenProbeMovement = probeFrame
    ? measureDisplacement({
        before: finalFrame.positions,
        after: probeFrame.positions,
        edges: input.fixture.request.edges,
        alignment: { kind: 'centroid' },
      })
    : null;
  return {
    candidate: input.candidate,
    fixtureId: input.fixture.id,
    stopReason,
    iterationsCompleted: Math.min(
      maxIterations,
      acceptedStep * MACRO_BATCH_ITERATIONS,
    ),
    macroStepsCompleted: acceptedStep,
    stableSteps,
    finalMovement,
    hiddenProbeMovement,
    finalPositions: finalFrame.positions,
    finalQuality: finalFrame.quality,
    computeMs: run.computeMs,
    folderPriorMs: run.folderPriorMs,
  };
}

function settings(input: {
  readonly folderClustering: boolean;
  readonly preset?: 'compact' | 'normal' | 'spacious';
  readonly folderCohesion?: number;
  readonly linkForce?: number;
}): GlobalLayoutSettings {
  const preset = input.preset ?? 'normal';
  return {
    folderClustering: input.folderClustering,
    spacingPreset: preset,
    custom: {
      ...customGlobalLayoutSettings(preset),
      ...(input.folderCohesion === undefined
        ? {}
        : { folderCohesion: input.folderCohesion }),
      ...(input.linkForce === undefined ? {} : { linkForce: input.linkForce }),
    },
  };
}

function connectedEdges(count: number): GlobalLayoutEdge[] {
  const edges: GlobalLayoutEdge[] = [];
  for (let index = 1; index < count; index += 1) {
    edges.push({
      key: `edge-${edges.length}`,
      source: `node-${Math.max(0, Math.floor((index - 1) / 2))}`,
      target: `node-${index}`,
      weight: index % 5 === 0 ? 2 : 1,
    });
  }
  return edges;
}

function folderEdges(
  sizes: readonly number[],
  cross: readonly { source: number; target: number; weight: number }[],
): GlobalLayoutEdge[] {
  const edges: GlobalLayoutEdge[] = [];
  let start = 0;
  for (const size of sizes) {
    for (let offset = 1; offset < size; offset += 1) {
      edges.push({
        key: `edge-${edges.length}`,
        source: `node-${start}`,
        target: `node-${start + offset}`,
        weight: 1,
      });
      if (offset > 1) {
        edges.push({
          key: `edge-${edges.length}`,
          source: `node-${start + offset - 1}`,
          target: `node-${start + offset}`,
          weight: 1,
        });
      }
    }
    start += size;
  }
  for (const edge of cross) {
    edges.push({
      key: `edge-${edges.length}`,
      source: `node-${edge.source}`,
      target: `node-${edge.target}`,
      weight: edge.weight,
    });
  }
  return edges;
}

function fixture(input: {
  readonly id: string;
  readonly description: string;
  readonly folderSizes?: readonly number[];
  readonly rootLevelNodes?: number;
  readonly connectedNodes?: number;
  readonly cross?: readonly {
    source: number;
    target: number;
    weight: number;
  }[];
  readonly layoutSettings: GlobalLayoutSettings;
}): GlobalMacroFixture {
  const folderSizes = input.folderSizes ?? [];
  const folderNodeCount = folderSizes.reduce(
    (total, value) => total + value,
    0,
  );
  const nodeCount = Math.max(
    1,
    folderNodeCount + (input.rootLevelNodes ?? 0),
    input.connectedNodes ?? 0,
  );
  let folder = 0;
  let folderEnd = folderSizes[0] ?? 0;
  const nodes = Array.from({ length: nodeCount }, (_, index) => {
    while (index >= folderEnd && folder + 1 < folderSizes.length) {
      folder += 1;
      folderEnd += folderSizes[folder] ?? 0;
    }
    const key = `node-${index}`;
    return {
      key,
      ...deterministicGlobalPosition(key),
      size: 4.5,
      ...(index < folderNodeCount
        ? { folderKey: `synthetic/folder-${folder}` }
        : {}),
    };
  });
  const edges =
    folderSizes.length === 0
      ? connectedEdges(input.connectedNodes ?? nodeCount)
      : folderEdges(folderSizes, input.cross ?? []);
  return {
    id: input.id,
    description: input.description,
    category: input.layoutSettings.folderClustering
      ? 'folder'
      : 'reference-only',
    request: {
      schemaVersion: 2,
      algorithm: input.layoutSettings.folderClustering
        ? 'chunked-prior'
        : 'reference-only',
      policy: createGlobalConvergencePolicy(nodeCount),
      macro: input.layoutSettings.folderClustering
        ? {
            version: 'global-folder-fixed-field-v1',
            algorithm: 'chunked-prior',
            priorApplications: 1,
            feedback: 'output-only',
          }
        : {
            version: 'global-folder-none-v1',
            algorithm: 'reference-only',
            priorApplications: 0,
            feedback: 'output-only',
          },
      settings: input.layoutSettings,
      nodes,
      edges,
    },
  };
}

export function globalMacroFixtures(): readonly GlobalMacroFixture[] {
  const convergence1aReferenceFixtures = globalConvergenceFixtures()
    .slice(0, 3)
    .map((value) => ({
      id: value.id,
      description: value.description,
      category: 'reference-only' as const,
      request: value.request,
    }));
  const weakBridge = [{ source: 11, target: 12, weight: 1 }];
  const strongBridge = [{ source: 11, target: 12, weight: 24 }];
  const mixedCross = [
    { source: 7, target: 8, weight: 1 },
    { source: 15, target: 16, weight: 2 },
    { source: 23, target: 24, weight: 1 },
    { source: 3, target: 29, weight: 3 },
  ];
  return [
    ...convergence1aReferenceFixtures,
    fixture({
      id: 'folder-baseline',
      description: 'Three balanced folders at normal settings',
      folderSizes: [10, 10, 10],
      cross: mixedCross,
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'two-folders-weak',
      description: 'Two folders with one weak cross-folder reference',
      folderSizes: [12, 12],
      cross: weakBridge,
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'two-folders-strong',
      description: 'Two folders with one strong cross-folder reference',
      folderSizes: [12, 12],
      cross: strongBridge,
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'four-folders-mixed',
      description: 'Four folders with mixed cross connectivity',
      folderSizes: [8, 8, 8, 8],
      cross: mixedCross,
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'imbalanced-folders',
      description: 'One large folder plus three small folders',
      folderSizes: [24, 5, 5, 5],
      cross: [
        { source: 2, target: 25, weight: 1 },
        { source: 10, target: 31, weight: 1 },
        { source: 20, target: 36, weight: 2 },
      ],
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'folder-isolates',
      description: 'Three folders plus root-level isolates',
      folderSizes: [8, 8, 8],
      rootLevelNodes: 6,
      cross: [{ source: 4, target: 12, weight: 1 }],
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'root-level-files',
      description: 'Folder members mixed with root-level files',
      folderSizes: [9, 9, 9],
      rootLevelNodes: 9,
      cross: mixedCross,
      layoutSettings: settings({ folderClustering: true }),
    }),
    fixture({
      id: 'one-folder',
      description: 'All files in one folder',
      folderSizes: [28],
      layoutSettings: settings({ folderClustering: true }),
    }),
    ...(['compact', 'normal', 'spacious'] as const).map((preset) =>
      fixture({
        id: `preset-${preset}`,
        description: `${preset} folder spacing`,
        folderSizes: [10, 10, 10],
        cross: mixedCross,
        layoutSettings: settings({ folderClustering: true, preset }),
      }),
    ),
    fixture({
      id: 'low-cohesion',
      description: 'Low folder cohesion',
      folderSizes: [10, 10, 10],
      cross: mixedCross,
      layoutSettings: settings({
        folderClustering: true,
        folderCohesion: 0.03,
      }),
    }),
    fixture({
      id: 'high-cohesion',
      description: 'High folder cohesion',
      folderSizes: [10, 10, 10],
      cross: mixedCross,
      layoutSettings: settings({
        folderClustering: true,
        folderCohesion: 0.16,
      }),
    }),
    fixture({
      id: 'low-reference-pull',
      description: 'Low reference pull',
      folderSizes: [10, 10, 10],
      cross: mixedCross,
      layoutSettings: settings({ folderClustering: true, linkForce: 0.25 }),
    }),
    fixture({
      id: 'high-reference-pull',
      description: 'High reference pull',
      folderSizes: [10, 10, 10],
      cross: mixedCross,
      layoutSettings: settings({ folderClustering: true, linkForce: 2 }),
    }),
  ];
}

export function currentFixedBaseline(fixture: GlobalMacroFixture) {
  const graph = buildGraph(fixture.request);
  const settings = resolveGlobalPhysicsSettings(fixture.request.settings);
  const iterations =
    graph.order <= 1_000 ? 100 : graph.order <= 5_000 ? 30 : 20;
  const chunks = Math.min(5, iterations);
  const base = Math.floor(iterations / chunks);
  let remainder = iterations % chunks;
  for (let index = 0; index < chunks; index += 1) {
    assignForceAtlas2(graph, base + (remainder > 0 ? 1 : 0), settings);
    remainder = Math.max(0, remainder - 1);
    applyCurrentPrior(graph, settings);
  }
  return { positions: positions(graph) };
}
