import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import {
  createGlobalConvergenceDegreeIndex,
  createGlobalConvergencePolicy,
  GLOBAL_CONVERGENCE_BATCH_ITERATIONS,
  globalConvergenceMacroStepIsStable,
  measureGlobalConvergenceMovement,
  nextGlobalConvergenceStableMacroStepCount,
  validateGlobalConvergencePolicy,
} from './global-convergence';
import {
  createGlobalFolderMacroPolicy,
  deriveGlobalFolderMacroSnapshot,
  validateGlobalFolderMacroPolicy,
} from './global-folder-macro';
import { stableHash32 } from './deterministic';
import {
  resolveGlobalPhysicsSettings,
  validateGlobalLayoutSettings,
} from './settings';
import type {
  GlobalConvergenceMovement,
  GlobalFolderPriorMetrics,
  GlobalLayoutFailure,
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalLayoutSettings,
  GlobalLayoutWorkerResponse,
  GlobalRendererInput,
} from './types';

export const GLOBAL_LAYOUT_SCHEMA_VERSION = 2 as const;

type LayoutGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; folderKey?: string },
  { weight: number }
>;

export interface GlobalLayoutComputeOptions {
  readonly now?: () => number;
  readonly maxWallTimeMs?: number;
  readonly assignBatch?: (
    graph: LayoutGraph,
    iterations: number,
    request: GlobalLayoutRequest,
  ) => void;
}

export class GlobalLayoutMaxWallTimeError extends Error {
  readonly code = 'max-wall-time' as const;

  constructor(
    readonly limitMs: number,
    readonly computeMs: number,
    readonly iterationsCompleted: number,
    readonly macroStepsCompleted: number,
    readonly finalMovement: GlobalConvergenceMovement,
  ) {
    super(
      `Global layout exceeded the ${limitMs} ms safety limit after ${iterationsCompleted} completed iterations.`,
    );
    this.name = 'GlobalLayoutMaxWallTimeError';
  }
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Global layout ${label} must be finite.`);
  }
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Global layout ${label} must be positive and finite.`);
  }
}

export function validateGlobalLayoutRequest(
  request: GlobalLayoutRequest,
): void {
  if (request.schemaVersion !== GLOBAL_LAYOUT_SCHEMA_VERSION) {
    throw new Error('Unsupported Global layout request schema version.');
  }
  if (!Number.isSafeInteger(request.requestId) || request.requestId < 1) {
    throw new Error('Global layout requestId must be a positive safe integer.');
  }
  if (!plainRecord(request.policy) || !plainRecord(request.macro)) {
    throw new Error(
      'Global layout request requires policy and macro identities.',
    );
  }
  validateGlobalLayoutSettings(request.settings);
  validateGlobalConvergencePolicy(request.policy, request.nodes.length);
  validateGlobalFolderMacroPolicy({
    policy: request.macro,
    nodes: request.nodes,
    settings: request.settings,
  });
  if (request.algorithm !== request.macro.algorithm) {
    throw new Error('Global layout algorithm does not match its macro policy.');
  }
  const nodeKeys = new Set<string>();
  for (const node of request.nodes) {
    if (node.key.length === 0 || nodeKeys.has(node.key)) {
      throw new Error('Global layout has an invalid or duplicate node key.');
    }
    nodeKeys.add(node.key);
    finite(node.x, `node ${node.key} x`);
    finite(node.y, `node ${node.key} y`);
    finitePositive(node.size, `node ${node.key} size`);
    if (node.folderKey !== undefined && node.folderKey.length === 0) {
      throw new Error(
        `Global layout node ${node.key} has an empty folder key.`,
      );
    }
  }
  const edgeKeys = new Set<string>();
  for (const edge of request.edges) {
    if (edge.key.length === 0 || edgeKeys.has(edge.key)) {
      throw new Error('Global layout has an invalid or duplicate edge key.');
    }
    edgeKeys.add(edge.key);
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(`Global layout edge ${edge.key} has a missing endpoint.`);
    }
    finitePositive(edge.weight, `edge ${edge.key} weight`);
  }
}

function buildGraph(request: GlobalLayoutRequest): LayoutGraph {
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

function graphPositions(graph: LayoutGraph): readonly GlobalLayoutPosition[] {
  return graph
    .mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function assignForceAtlas2Batch(
  graph: LayoutGraph,
  iterations: number,
  request: GlobalLayoutRequest,
): void {
  const settings = resolveGlobalPhysicsSettings(request.settings);
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

function macroSnapshot(
  graph: LayoutGraph,
  request: GlobalLayoutRequest,
): readonly GlobalLayoutPosition[] {
  return deriveGlobalFolderMacroSnapshot({
    nodes: request.nodes,
    positions: graphPositions(graph),
    settings: request.settings,
    policy: request.macro,
  });
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function metrics(
  positions: readonly GlobalLayoutPosition[],
  request: GlobalLayoutRequest,
  inputPositions: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >,
): GlobalFolderPriorMetrics {
  const byKey = new Map(positions.map((position) => [position.key, position]));
  const folders = new Map<string, GlobalLayoutPosition[]>();
  for (const node of request.nodes) {
    const position = byKey.get(node.key);
    if (position === undefined || node.folderKey === undefined) continue;
    const folder = folders.get(node.folderKey) ?? [];
    folder.push(position);
    folders.set(node.folderKey, folder);
  }
  const summaries = [...folders]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => ({
      key,
      values,
      x: mean(values.map(({ x }) => x)),
      y: mean(values.map(({ y }) => y)),
    }));
  const within = summaries.flatMap((folder) =>
    folder.values.map((position) => distance(position, folder)),
  );
  const crossFolder: number[] = [];
  pairLoop: for (let left = 0; left < summaries.length; left += 1) {
    for (let right = left + 1; right < summaries.length; right += 1) {
      crossFolder.push(distance(summaries[left]!, summaries[right]!));
      if (crossFolder.length >= 10_000) break pairLoop;
    }
  }
  const folderByNode = new Map(
    request.nodes.map((node) => [node.key, node.folderKey] as const),
  );
  const crossReferences = request.edges.flatMap((edge) => {
    const source = byKey.get(edge.source);
    const target = byKey.get(edge.target);
    const sourceFolder = folderByNode.get(edge.source);
    const targetFolder = folderByNode.get(edge.target);
    return source !== undefined &&
      target !== undefined &&
      sourceFolder !== undefined &&
      targetFolder !== undefined &&
      sourceFolder !== targetFolder
      ? [distance(source, target)]
      : [];
  });
  return {
    meanWithinFolderDistance: Number(mean(within).toFixed(6)),
    meanCrossFolderDistance: Number(mean(crossFolder).toFixed(6)),
    meanCrossFolderReferenceLength: Number(mean(crossReferences).toFixed(6)),
    meanDisplacementFromInput: Number(
      mean(
        positions.map((position) => {
          const initial = inputPositions.get(position.key);
          return initial === undefined ? 0 : distance(position, initial);
        }),
      ).toFixed(6),
    ),
  };
}

function roundedMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Global layout clock returned an invalid elapsed time.');
  }
  return Number(value.toFixed(3));
}

export function computeGlobalLayout(
  request: GlobalLayoutRequest,
  options: GlobalLayoutComputeOptions = {},
): GlobalLayoutResult {
  validateGlobalLayoutRequest(request);
  const now = options.now ?? (() => performance.now());
  const maxWallTimeMs = options.maxWallTimeMs ?? request.policy.maxWallTimeMs;
  const assignBatch = options.assignBatch ?? assignForceAtlas2Batch;
  finitePositive(maxWallTimeMs, 'maxWallTimeMs');
  const started = now();
  finite(started, 'clock start');
  const graph = buildGraph(request);
  const inputPositions = new Map(
    request.nodes.map((node) => [node.key, { x: node.x, y: node.y }]),
  );
  if (graph.order <= 1) {
    const positions =
      graph.order === 0 ? [] : [{ key: graph.nodes()[0]!, x: 0, y: 0 }];
    return {
      schemaVersion: 2,
      kind: 'result',
      requestId: request.requestId,
      algorithm: request.algorithm,
      policyVersion: request.policy.version,
      macroVersion: request.macro.version,
      stopReason: 'degenerate',
      iterationsCompleted: 0,
      macroStepsCompleted: 0,
      stableMacroSteps: 0,
      finalMacroStepIterations: 0,
      finalMovement: null,
      computeMs: roundedMilliseconds(now() - started),
      folderPriorMs: 0,
      positions,
      metrics: metrics(positions, request, inputPositions),
    };
  }
  const degreeByKey = createGlobalConvergenceDegreeIndex(
    request.nodes.map(({ key }) => key),
    request.edges,
  );
  let priorStarted = now();
  let previousFrame = macroSnapshot(graph, request);
  let folderPriorMs = now() - priorStarted;
  let iterationsCompleted = 0;
  let macroStepsCompleted = 0;
  let stableMacroSteps = 0;
  let finalMacroStepIterations = 0;
  let finalMovement: GlobalConvergenceMovement | null = null;
  let computeMs = 0;
  let stopReason: GlobalLayoutResult['stopReason'] = 'max-iterations';
  while (iterationsCompleted < request.policy.maxIterations) {
    const batchIterations = Math.min(
      request.policy.batchIterations,
      request.policy.maxIterations - iterationsCompleted,
    );
    assignBatch(graph, batchIterations, request);
    iterationsCompleted += batchIterations;
    macroStepsCompleted += 1;
    finalMacroStepIterations = batchIterations;
    priorStarted = now();
    const currentFrame = macroSnapshot(graph, request);
    folderPriorMs += now() - priorStarted;
    finalMovement = measureGlobalConvergenceMovement({
      before: previousFrame,
      after: currentFrame,
      degreeByKey,
    });
    previousFrame = currentFrame;
    stableMacroSteps = nextGlobalConvergenceStableMacroStepCount({
      previousStableMacroSteps: stableMacroSteps,
      batchIterations,
      movement: finalMovement,
    });
    const elapsedMs = now() - started;
    computeMs = roundedMilliseconds(elapsedMs);
    if (
      batchIterations === GLOBAL_CONVERGENCE_BATCH_ITERATIONS &&
      stableMacroSteps >= request.policy.stableMacroStepsRequired
    ) {
      stopReason = 'stable';
      break;
    }
    if (iterationsCompleted >= request.policy.maxIterations) break;
    if (elapsedMs > maxWallTimeMs) {
      throw new GlobalLayoutMaxWallTimeError(
        maxWallTimeMs,
        computeMs,
        iterationsCompleted,
        macroStepsCompleted,
        finalMovement,
      );
    }
  }
  if (finalMovement === null) {
    throw new Error('Global convergence completed without movement evidence.');
  }
  const positions = previousFrame.map((position) => ({
    key: position.key,
    x: Number(position.x.toFixed(8)),
    y: Number(position.y.toFixed(8)),
  }));
  return {
    schemaVersion: 2,
    kind: 'result',
    requestId: request.requestId,
    algorithm: request.algorithm,
    policyVersion: request.policy.version,
    macroVersion: request.macro.version,
    stopReason,
    iterationsCompleted,
    macroStepsCompleted,
    stableMacroSteps,
    finalMacroStepIterations,
    finalMovement,
    computeMs,
    folderPriorMs: roundedMilliseconds(folderPriorMs),
    positions,
    metrics: metrics(positions, request, inputPositions),
  };
}

export function createGlobalLayoutFailure(
  request: GlobalLayoutRequest,
  error: unknown,
): GlobalLayoutFailure {
  if (error instanceof GlobalLayoutMaxWallTimeError) {
    return {
      schemaVersion: 2,
      kind: 'error',
      requestId: request.requestId,
      code: error.code,
      policyVersion: request.policy.version,
      macroVersion: request.macro.version,
      iterationsCompleted: error.iterationsCompleted,
      macroStepsCompleted: error.macroStepsCompleted,
      finalMovement: error.finalMovement,
      computeMs: error.computeMs,
      message: error.message,
    };
  }
  return {
    schemaVersion: 2,
    kind: 'error',
    requestId: request.requestId,
    code: 'layout-error',
    policyVersion: request.policy.version,
    macroVersion: request.macro.version,
    iterationsCompleted: 0,
    macroStepsCompleted: 0,
    finalMovement: null,
    computeMs: 0,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function createGlobalLayoutRequest(
  input: GlobalRendererInput,
  settings: GlobalLayoutSettings,
  _legacyIterations?: number,
  _legacyAlgorithm?: 'reference-only' | 'chunked-prior' | 'offset-field',
): Omit<GlobalLayoutRequest, 'requestId'> {
  void _legacyIterations;
  void _legacyAlgorithm;
  validateGlobalLayoutSettings(settings);
  const nodes = input.nodes.map(({ key, attributes }) => ({
    key,
    x: attributes.x,
    y: attributes.y,
    size: attributes.size,
    ...(attributes.folderKey === null
      ? {}
      : { folderKey: attributes.folderKey }),
  }));
  const macro = createGlobalFolderMacroPolicy(nodes, settings);
  return {
    schemaVersion: 2,
    algorithm: macro.algorithm,
    policy: createGlobalConvergencePolicy(nodes.length),
    macro,
    settings,
    nodes,
    edges: input.edges.map(({ key, source, target, attributes }) => ({
      key,
      source,
      target,
      weight: Math.max(1, attributes.referenceCount),
    })),
  };
}

export function globalLayoutPositionsFromInput(
  input: GlobalRendererInput,
): readonly GlobalLayoutPosition[] {
  return input.nodes.map(({ key, attributes }) => ({
    key,
    x: attributes.x,
    y: attributes.y,
  }));
}

export function reconcileGlobalAutomaticPositions(
  input: GlobalRendererInput,
  previous: readonly GlobalLayoutPosition[],
): readonly GlobalLayoutPosition[] {
  const previousByKey = new Map(previous.map((value) => [value.key, value]));
  return input.nodes.map(({ key, attributes }) => {
    const position = previousByKey.get(key);
    return position === undefined
      ? { key, x: attributes.x, y: attributes.y }
      : { key, x: position.x, y: position.y };
  });
}

export function createGlobalLayoutRequestFromAutomaticPositions(
  input: GlobalRendererInput,
  settings: GlobalLayoutSettings,
  iterationsOrPositions: number | readonly GlobalLayoutPosition[],
  legacyPositions?: readonly GlobalLayoutPosition[],
  _legacyAlgorithm?: 'reference-only' | 'chunked-prior' | 'offset-field',
): Omit<GlobalLayoutRequest, 'requestId'> {
  void _legacyAlgorithm;
  const automaticPositions =
    typeof iterationsOrPositions === 'number'
      ? legacyPositions
      : iterationsOrPositions;
  if (automaticPositions === undefined) {
    throw new Error('Global layout warm start requires automatic positions.');
  }
  return createGlobalLayoutRequest(
    warmGlobalRendererInput(input, automaticPositions),
    settings,
  );
}

export function warmGlobalRendererInput(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
): GlobalRendererInput {
  const byKey = new Map(positions.map((value) => [value.key, value]));
  if (byKey.size !== input.nodes.length) {
    throw new Error('Cached Global layout does not match the projected nodes.');
  }
  return {
    ...input,
    nodes: input.nodes.map((node) => {
      const position = byKey.get(node.key);
      if (
        position === undefined ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        throw new Error(
          `Cached Global layout omitted or invalidated node ${node.key}.`,
        );
      }
      return {
        ...node,
        attributes: { ...node.attributes, x: position.x, y: position.y },
      };
    }),
  };
}

export function globalLayoutFingerprint(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
): string {
  const value = JSON.stringify({
    schemaVersion: request.schemaVersion,
    algorithm: request.algorithm,
    policy: request.policy,
    macro: request.macro,
    settings: resolveGlobalPhysicsSettings(request.settings),
    nodes: [...request.nodes]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((node): readonly string[] => [node.key, node.folderKey ?? '']),
    edges: [...request.edges]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map((edge): readonly (string | number)[] => [
        edge.key,
        edge.source,
        edge.target,
        edge.weight,
      ]),
  });
  return `global-layout-v2-${stableHash32(value).toString(16).padStart(8, '0')}`;
}

function validatePositions(value: unknown, request: GlobalLayoutRequest): void {
  if (!Array.isArray(value))
    throw new Error('Global layout positions must be an array.');
  const expected = new Set(request.nodes.map(({ key }) => key));
  const received = new Set<string>();
  for (const position of value) {
    if (
      !plainRecord(position) ||
      typeof position.key !== 'string' ||
      !expected.has(position.key) ||
      received.has(position.key) ||
      typeof position.x !== 'number' ||
      !Number.isFinite(position.x) ||
      typeof position.y !== 'number' ||
      !Number.isFinite(position.y)
    ) {
      throw new Error('Global layout result contains an invalid position.');
    }
    received.add(position.key);
  }
  if (received.size !== expected.size) {
    throw new Error('Global layout result omitted one or more nodes.');
  }
}

function validateMovement(
  value: unknown,
  request: GlobalLayoutRequest,
): asserts value is GlobalConvergenceMovement {
  if (!plainRecord(value)) {
    throw new Error('Global layout movement must be an object.');
  }
  for (const field of [
    'scale',
    'rawCentroidDrift',
    'normalizedCentroidDrift',
  ] as const) {
    if (
      typeof value[field] !== 'number' ||
      !Number.isFinite(value[field]) ||
      value[field] < 0
    ) {
      throw new Error(`Global layout movement ${field} must be non-negative.`);
    }
  }
  if (
    Number(value.scale) < request.policy.scaleFloor ||
    Math.abs(
      Number(value.normalizedCentroidDrift) -
        Number(value.rawCentroidDrift) / Number(value.scale),
    ) > 1e-10
  ) {
    throw new Error(
      'Global layout movement scale or centroid drift is invalid.',
    );
  }
  const degreeByKey = createGlobalConvergenceDegreeIndex(
    request.nodes.map(({ key }) => key),
    request.edges,
  );
  const expectedCounts = {
    all: request.nodes.length,
    degree0: 0,
    degree1: 0,
    degree2Plus: 0,
    lowDegree: 0,
  };
  for (const degree of degreeByKey.values()) {
    if (degree === 0) expectedCounts.degree0 += 1;
    else if (degree === 1) expectedCounts.degree1 += 1;
    else expectedCounts.degree2Plus += 1;
  }
  expectedCounts.lowDegree = expectedCounts.degree0 + expectedCounts.degree1;
  for (const field of [
    'all',
    'degree0',
    'degree1',
    'degree2Plus',
    'lowDegree',
  ] as const) {
    const distribution = value[field];
    if (
      !plainRecord(distribution) ||
      distribution.count !== expectedCounts[field]
    ) {
      throw new Error(`Global layout movement ${field} is invalid.`);
    }
    const metrics = [distribution.p50, distribution.p90, distribution.maximum];
    if (expectedCounts[field] === 0) {
      if (metrics.some((entry) => entry !== null)) {
        throw new Error(`Global layout movement ${field} must be empty.`);
      }
      continue;
    }
    for (const metric of ['p50', 'p90', 'maximum'] as const) {
      const entry = distribution[metric];
      if (
        entry !== null &&
        (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0)
      ) {
        throw new Error(
          `Global layout movement ${field}.${metric} is invalid.`,
        );
      }
    }
    if (
      Number(distribution.p50) > Number(distribution.p90) ||
      Number(distribution.p90) > Number(distribution.maximum)
    ) {
      throw new Error(`Global layout movement ${field} is not ordered.`);
    }
  }
}

export function validateGlobalLayoutWorkerResponse(
  value: unknown,
  request: GlobalLayoutRequest,
): GlobalLayoutWorkerResponse {
  if (!plainRecord(value) || value.schemaVersion !== 2) {
    throw new Error('Expected a schema-v2 Global layout response.');
  }
  if (value.requestId !== request.requestId) {
    throw new Error(`Expected Global layout request ${request.requestId}.`);
  }
  if (
    value.policyVersion !== request.policy.version ||
    value.macroVersion !== request.macro.version
  ) {
    throw new Error(
      'Global layout response has an unexpected policy identity.',
    );
  }
  if (
    typeof value.computeMs !== 'number' ||
    !Number.isFinite(value.computeMs) ||
    value.computeMs < 0 ||
    !Number.isSafeInteger(value.iterationsCompleted) ||
    !Number.isSafeInteger(value.macroStepsCompleted)
  ) {
    throw new Error('Global layout response has invalid lifecycle counters.');
  }
  const expectedIterations = Math.min(
    Number(value.macroStepsCompleted) * GLOBAL_CONVERGENCE_BATCH_ITERATIONS,
    request.policy.maxIterations,
  );
  if (value.iterationsCompleted !== expectedIterations) {
    throw new Error('Global layout response has inconsistent macro counters.');
  }
  if (value.kind === 'error') {
    if (
      (value.code !== 'max-wall-time' && value.code !== 'layout-error') ||
      typeof value.message !== 'string' ||
      value.message.length === 0
    ) {
      throw new Error('Global layout error response is malformed.');
    }
    if (value.code === 'max-wall-time') {
      if (value.macroStepsCompleted === 0 || value.finalMovement === null) {
        throw new Error('Global layout timeout omitted completed evidence.');
      }
      validateMovement(value.finalMovement, request);
    } else if (
      value.iterationsCompleted !== 0 ||
      value.macroStepsCompleted !== 0 ||
      value.finalMovement !== null
    ) {
      throw new Error(
        'Global layout failure must not look like partial success.',
      );
    }
    return value as unknown as GlobalLayoutWorkerResponse;
  }
  if (
    value.kind !== 'result' ||
    value.algorithm !== request.algorithm ||
    typeof value.folderPriorMs !== 'number' ||
    !Number.isFinite(value.folderPriorMs) ||
    value.folderPriorMs < 0 ||
    !Number.isSafeInteger(value.stableMacroSteps) ||
    !Number.isSafeInteger(value.finalMacroStepIterations)
  ) {
    throw new Error('Global layout result has an invalid lifecycle shape.');
  }
  if (
    Number(value.stableMacroSteps) < 0 ||
    Number(value.stableMacroSteps) > Number(value.macroStepsCompleted)
  ) {
    throw new Error('Global layout result has an invalid stable-step count.');
  }
  validatePositions(value.positions, request);
  if (value.stopReason === 'degenerate') {
    if (
      request.nodes.length > 1 ||
      value.iterationsCompleted !== 0 ||
      value.macroStepsCompleted !== 0 ||
      value.stableMacroSteps !== 0 ||
      value.finalMacroStepIterations !== 0 ||
      value.finalMovement !== null
    ) {
      throw new Error('Global layout degenerate result is inconsistent.');
    }
  } else {
    validateMovement(value.finalMovement, request);
    const expectedFinalStep =
      ((Number(value.iterationsCompleted) - 1) %
        GLOBAL_CONVERGENCE_BATCH_ITERATIONS) +
      1;
    if (value.finalMacroStepIterations !== expectedFinalStep) {
      throw new Error('Global layout final macro-step size is inconsistent.');
    }
    if (value.stopReason === 'stable') {
      if (
        value.finalMacroStepIterations !==
          GLOBAL_CONVERGENCE_BATCH_ITERATIONS ||
        Number(value.stableMacroSteps) <
          request.policy.stableMacroStepsRequired ||
        !globalConvergenceMacroStepIsStable(value.finalMovement)
      ) {
        throw new Error('Global layout stable result is inconsistent.');
      }
    } else if (
      value.stopReason !== 'max-iterations' ||
      value.iterationsCompleted !== request.policy.maxIterations
    ) {
      throw new Error('Global layout result has an invalid stop reason.');
    }
  }
  if (!plainRecord(value.metrics)) {
    throw new Error('Global layout result metrics must be an object.');
  }
  for (const field of [
    'meanWithinFolderDistance',
    'meanCrossFolderDistance',
    'meanCrossFolderReferenceLength',
    'meanDisplacementFromInput',
  ] as const) {
    if (
      typeof value.metrics[field] !== 'number' ||
      !Number.isFinite(value.metrics[field]) ||
      value.metrics[field] < 0
    ) {
      throw new Error(`Global layout metric ${field} must be finite.`);
    }
  }
  return value as unknown as GlobalLayoutWorkerResponse;
}
