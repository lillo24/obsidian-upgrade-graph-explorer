import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import {
  createLocalConvergenceDegreeIndex,
  createLocalConvergencePolicy,
  LOCAL_CONVERGENCE_BATCH_ITERATIONS,
  LOCAL_CONVERGENCE_MAX_WALL_TIME_MS,
  LOCAL_CONVERGENCE_POLICY_VERSION,
  LOCAL_CONVERGENCE_SCALE_FLOOR,
  LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED,
  localConvergenceBatchIsStable,
  measureLocalConvergenceMovement,
  nextLocalConvergenceStableBatchCount,
  rootAlignLocalConvergenceFrame,
  validateLocalConvergencePolicy,
} from './local-convergence';
import { stableHash32 } from './deterministic';
import type {
  LocalConvergenceDistribution,
  LocalConvergenceMovement,
  LocalLayoutEdge,
  LocalLayoutFailure,
  LocalLayoutNode,
  LocalLayoutPosition,
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalLayoutSettings,
  LocalLayoutWorkerResponse,
  LocalRendererInput,
} from './local-types';

export const LOCAL_LAYOUT_SCHEMA_VERSION = 2 as const;

export const DEFAULT_LOCAL_LAYOUT_SETTINGS: LocalLayoutSettings = {
  hierarchyWeight: 6,
  referenceWeight: 1,
  scalingRatio: 1.35,
};

type LayoutGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; kind: string },
  { weight: number }
>;

export interface LocalLayoutComputeOptions {
  readonly now?: () => number;
  readonly maxWallTimeMs?: number;
  /** Test seam; production always uses the public ForceAtlas2 assign call. */
  readonly assignBatch?: (
    graph: LayoutGraph,
    iterations: number,
    request: LocalLayoutRequest,
  ) => void;
}

export class LocalLayoutMaxWallTimeError extends Error {
  readonly code = 'max-wall-time' as const;

  constructor(
    readonly limitMs: number,
    readonly computeMs: number,
    readonly iterationsCompleted: number,
    readonly batchesCompleted: number,
    readonly finalMovement: LocalConvergenceMovement,
  ) {
    super(
      `Local layout exceeded the ${limitMs} ms safety limit after ${iterationsCompleted} completed iterations.`,
    );
    this.name = 'LocalLayoutMaxWallTimeError';
  }
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Local layout ${label} must be positive and finite.`);
  }
}

export function validateLocalLayoutRequest(request: LocalLayoutRequest): void {
  if (request.schemaVersion !== LOCAL_LAYOUT_SCHEMA_VERSION) {
    throw new Error('Unsupported Local layout request schema version.');
  }
  if (!Number.isSafeInteger(request.requestId) || request.requestId < 1) {
    throw new Error('Local layout requestId must be a positive safe integer.');
  }
  if (!Array.isArray(request.nodes) || request.nodes.length === 0) {
    throw new Error('Local layout request requires at least one node.');
  }
  if (!plainRecord(request.policy)) {
    throw new Error('Local layout request requires a convergence policy.');
  }
  validateLocalConvergencePolicy(request.policy, request.nodes.length);
  finitePositive(request.settings.hierarchyWeight, 'hierarchyWeight');
  finitePositive(request.settings.referenceWeight, 'referenceWeight');
  finitePositive(request.settings.scalingRatio, 'scalingRatio');
  const nodeKeys = new Set<string>();
  for (const node of request.nodes) {
    if (node.key.length === 0 || nodeKeys.has(node.key)) {
      throw new Error('Local layout has an invalid or duplicate node key.');
    }
    if (
      node.kind !== 'document' &&
      node.kind !== 'section' &&
      node.kind !== 'block' &&
      node.kind !== 'diagnostic'
    ) {
      throw new Error(`Local layout node ${node.key} has an invalid kind.`);
    }
    nodeKeys.add(node.key);
    finitePositive(node.size, `node ${node.key} size`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new Error(`Local layout node ${node.key} position must be finite.`);
    }
  }
  if (!nodeKeys.has(request.rootKey)) {
    throw new Error('Local layout rootKey must identify an input node.');
  }
  const edgeKeys = new Set<string>();
  for (const edge of request.edges) {
    if (edge.key.length === 0 || edgeKeys.has(edge.key)) {
      throw new Error('Local layout has an invalid or duplicate edge key.');
    }
    edgeKeys.add(edge.key);
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(`Local layout edge ${edge.key} has a missing endpoint.`);
    }
    if (edge.kind !== 'hierarchy' && edge.kind !== 'reference') {
      throw new Error(`Local layout edge ${edge.key} has an invalid kind.`);
    }
    finitePositive(edge.weight, `edge ${edge.key} weight`);
  }
}

function buildGraph(request: LocalLayoutRequest): LayoutGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; kind: string },
    { weight: number }
  >();
  for (const node of request.nodes) graph.addNode(node.key, { ...node });
  for (const edge of request.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight:
        edge.weight *
        (edge.kind === 'hierarchy'
          ? request.settings.hierarchyWeight
          : request.settings.referenceWeight),
    });
  }
  return graph;
}

function assignForceAtlas2Batch(
  graph: LayoutGraph,
  iterations: number,
  request: LocalLayoutRequest,
): void {
  forceAtlas2.assign(graph, {
    iterations,
    getEdgeWeight: 'weight',
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order >= 600,
      edgeWeightInfluence: 1,
      scalingRatio: request.settings.scalingRatio,
      strongGravityMode: true,
      gravity: 0.08,
    },
  });
}

function graphPositions(graph: LayoutGraph): readonly LocalLayoutPosition[] {
  return graph
    .mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function roundFinalPositions(
  positions: readonly LocalLayoutPosition[],
  rootKey: string,
): readonly LocalLayoutPosition[] {
  return rootAlignLocalConvergenceFrame(positions, rootKey).map((position) => ({
    key: position.key,
    x: position.key === rootKey ? 0 : Number(position.x.toFixed(8)),
    y: position.key === rootKey ? 0 : Number(position.y.toFixed(8)),
  }));
}

function roundedMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Local layout clock returned an invalid elapsed time.');
  }
  return Number(value.toFixed(3));
}

export function computeLocalLayout(
  request: LocalLayoutRequest,
  options: LocalLayoutComputeOptions = {},
): LocalLayoutResult {
  validateLocalLayoutRequest(request);
  const maxWallTimeMs =
    options.maxWallTimeMs ?? LOCAL_CONVERGENCE_MAX_WALL_TIME_MS;
  finitePositive(maxWallTimeMs, 'maxWallTimeMs');
  const now = options.now ?? (() => performance.now());
  const assignBatch = options.assignBatch ?? assignForceAtlas2Batch;
  const started = now();
  if (!Number.isFinite(started)) {
    throw new Error('Local layout clock returned an invalid start time.');
  }
  const graph = buildGraph(request);
  const degreeByKey = createLocalConvergenceDegreeIndex(
    request.nodes.map(({ key }) => key),
    request.edges,
  );
  if (graph.order === 1) {
    const computeMs = roundedMilliseconds(now() - started);
    return {
      schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
      kind: 'result',
      requestId: request.requestId,
      stopReason: 'degenerate',
      policyVersion: LOCAL_CONVERGENCE_POLICY_VERSION,
      iterationsCompleted: 0,
      batchesCompleted: 0,
      stableBatches: 0,
      finalMovement: null,
      computeMs,
      positions: roundFinalPositions(graphPositions(graph), request.rootKey),
    };
  }

  let previousFrame = graphPositions(graph);
  let iterationsCompleted = 0;
  let batchesCompleted = 0;
  let stableBatches = 0;
  let finalMovement: LocalConvergenceMovement | null = null;
  let computeMs = 0;
  let stopReason: LocalLayoutResult['stopReason'] = 'max-iterations';
  while (iterationsCompleted < request.policy.maxIterations) {
    const batchIterations = Math.min(
      request.policy.batchIterations,
      request.policy.maxIterations - iterationsCompleted,
    );
    assignBatch(graph, batchIterations, request);
    iterationsCompleted += batchIterations;
    batchesCompleted += 1;
    const currentFrame = graphPositions(graph);
    finalMovement = measureLocalConvergenceMovement({
      before: previousFrame,
      after: currentFrame,
      rootKey: request.rootKey,
      degreeByKey,
    });
    previousFrame = currentFrame;
    const elapsedMs = now() - started;
    computeMs = roundedMilliseconds(elapsedMs);
    stableBatches = nextLocalConvergenceStableBatchCount({
      previousStableBatches: stableBatches,
      batchIterations,
      movement: finalMovement,
    });
    if (
      stableBatches >= request.policy.stableBatchesRequired &&
      batchIterations === LOCAL_CONVERGENCE_BATCH_ITERATIONS
    ) {
      stopReason = 'stable';
      break;
    }
    // The safety limit gates another batch; it does not discard a terminal one.
    if (iterationsCompleted >= request.policy.maxIterations) break;
    if (elapsedMs > maxWallTimeMs) {
      throw new LocalLayoutMaxWallTimeError(
        maxWallTimeMs,
        computeMs,
        iterationsCompleted,
        batchesCompleted,
        finalMovement,
      );
    }
  }
  if (finalMovement === null) {
    throw new Error('Local convergence completed without movement evidence.');
  }
  return {
    schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
    kind: 'result',
    requestId: request.requestId,
    stopReason,
    policyVersion: LOCAL_CONVERGENCE_POLICY_VERSION,
    iterationsCompleted,
    batchesCompleted,
    stableBatches,
    finalMovement,
    computeMs,
    positions: roundFinalPositions(previousFrame, request.rootKey),
  };
}

export function createLocalLayoutFailure(
  request: LocalLayoutRequest,
  error: unknown,
): LocalLayoutFailure {
  if (error instanceof LocalLayoutMaxWallTimeError) {
    return {
      schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
      kind: 'error',
      requestId: request.requestId,
      code: error.code,
      policyVersion: LOCAL_CONVERGENCE_POLICY_VERSION,
      iterationsCompleted: error.iterationsCompleted,
      batchesCompleted: error.batchesCompleted,
      finalMovement: error.finalMovement,
      computeMs: error.computeMs,
      message: error.message,
    };
  }
  return {
    schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
    kind: 'error',
    requestId: request.requestId,
    code: 'layout-error',
    policyVersion: LOCAL_CONVERGENCE_POLICY_VERSION,
    iterationsCompleted: 0,
    batchesCompleted: 0,
    finalMovement: null,
    computeMs: 0,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function createLocalLayoutRequest(
  input: LocalRendererInput,
  settings: LocalLayoutSettings = DEFAULT_LOCAL_LAYOUT_SETTINGS,
): Omit<LocalLayoutRequest, 'requestId'> {
  return {
    schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
    rootKey: input.rootNodeKey,
    policy: createLocalConvergencePolicy(input.nodes.length),
    settings,
    nodes: input.nodes.map(({ key, attributes }) => ({
      key,
      kind: attributes.nodeKind,
      x: attributes.x,
      y: attributes.y,
      size: attributes.size,
    })),
    edges: input.edges.map(({ key, source, target, attributes }) => ({
      key,
      source,
      target,
      kind: attributes.edgeKind,
      weight: attributes.weight,
    })),
  };
}

/** Applies an exact memory-cache hit before a remounted Sigma session draws. */
export function warmLocalRendererInput(
  input: LocalRendererInput,
  positions: readonly LocalLayoutPosition[],
): LocalRendererInput {
  const byKey = new Map(
    positions.map((position) => [position.key, position] as const),
  );
  if (byKey.size !== input.nodes.length) {
    throw new Error('Cached Local layout does not match the projected nodes.');
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
          `Cached Local layout omitted or invalidated node ${node.key}.`,
        );
      }
      return {
        ...node,
        attributes: {
          ...node.attributes,
          x: position.x,
          y: position.y,
        },
      };
    }),
  };
}

function stableNode(node: LocalLayoutNode): readonly (string | number)[] {
  return [node.key, node.kind, node.size];
}

function stableEdge(edge: LocalLayoutEdge): readonly (string | number)[] {
  return [edge.key, edge.source, edge.target, edge.kind, edge.weight];
}

export function localLayoutFingerprint(
  request: Omit<LocalLayoutRequest, 'requestId'>,
): string {
  const stable = JSON.stringify({
    schemaVersion: request.schemaVersion,
    rootKey: request.rootKey,
    policy: request.policy,
    settings: request.settings,
    nodes: [...request.nodes]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableNode),
    edges: [...request.edges]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableEdge),
  });
  return `local-layout-v2-${stableHash32(stable).toString(16).padStart(8, '0')}`;
}

function validateDistribution(
  value: unknown,
  label: string,
  expectedCount: number,
): asserts value is LocalConvergenceDistribution {
  if (
    !plainRecord(value) ||
    value.count !== expectedCount ||
    !Number.isSafeInteger(value.count)
  ) {
    throw new Error(`Local layout ${label} distribution has an invalid count.`);
  }
  const values = [value.p50, value.p90, value.maximum];
  if (expectedCount === 0) {
    if (values.some((entry) => entry !== null)) {
      throw new Error(`Local layout ${label} empty distribution must be null.`);
    }
    return;
  }
  if (
    values.some(
      (entry) =>
        typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0,
    )
  ) {
    throw new Error(`Local layout ${label} distribution must be finite.`);
  }
  const [p50, p90, maximum] = values as [number, number, number];
  if (p50 > p90 || p90 > maximum) {
    throw new Error(`Local layout ${label} distribution is not ordered.`);
  }
}

function validateMovement(
  value: unknown,
  request: LocalLayoutRequest,
): asserts value is LocalConvergenceMovement {
  if (
    !plainRecord(value) ||
    typeof value.scale !== 'number' ||
    !Number.isFinite(value.scale) ||
    value.scale < LOCAL_CONVERGENCE_SCALE_FLOOR
  ) {
    throw new Error('Local layout movement has an invalid scale.');
  }
  const degreeByKey = createLocalConvergenceDegreeIndex(
    request.nodes.map(({ key }) => key),
    request.edges,
  );
  const counts = { degree0: 0, degree1: 0, degree2Plus: 0 };
  for (const degree of degreeByKey.values()) {
    if (degree === 0) counts.degree0 += 1;
    else if (degree === 1) counts.degree1 += 1;
    else counts.degree2Plus += 1;
  }
  validateDistribution(value.all, 'all-node', request.nodes.length);
  validateDistribution(value.degree0, 'degree-0', counts.degree0);
  validateDistribution(value.degree1, 'degree-1', counts.degree1);
  validateDistribution(value.degree2Plus, 'degree-2+', counts.degree2Plus);
  validateDistribution(
    value.lowDegree,
    'low-degree',
    counts.degree0 + counts.degree1,
  );
}

function validateCounters(input: {
  readonly iterationsCompleted: unknown;
  readonly batchesCompleted: unknown;
  readonly request: LocalLayoutRequest;
}): void {
  if (
    !Number.isSafeInteger(input.iterationsCompleted) ||
    (input.iterationsCompleted as number) < 0 ||
    !Number.isSafeInteger(input.batchesCompleted) ||
    (input.batchesCompleted as number) < 0
  ) {
    throw new Error('Local layout response has invalid lifecycle counters.');
  }
  const expectedIterations = Math.min(
    (input.batchesCompleted as number) * LOCAL_CONVERGENCE_BATCH_ITERATIONS,
    input.request.policy.maxIterations,
  );
  if (input.iterationsCompleted !== expectedIterations) {
    throw new Error('Local layout response has inconsistent batch counters.');
  }
}

function validatePositions(value: unknown, request: LocalLayoutRequest): void {
  if (!Array.isArray(value)) {
    throw new Error('Local layout result positions must be an array.');
  }
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
      throw new Error('Local layout result contains an invalid position.');
    }
    if (
      position.key === request.rootKey &&
      (position.x !== 0 || position.y !== 0)
    ) {
      throw new Error(
        'Local layout result root must be exactly at the origin.',
      );
    }
    received.add(position.key);
  }
  if (received.size !== expected.size) {
    throw new Error('Local layout result omitted one or more nodes.');
  }
}

export function validateLocalLayoutWorkerResponse(
  value: unknown,
  request: LocalLayoutRequest,
): LocalLayoutWorkerResponse {
  if (
    !plainRecord(value) ||
    value.schemaVersion !== LOCAL_LAYOUT_SCHEMA_VERSION
  ) {
    throw new Error('Expected a schema-v2 Local layout response.');
  }
  if (value.requestId !== request.requestId) {
    throw new Error(
      `Expected Local layout request ${request.requestId}, received ${String(value.requestId)}.`,
    );
  }
  if (value.policyVersion !== request.policy.version) {
    throw new Error('Local layout response has an unexpected policy version.');
  }
  if (
    typeof value.computeMs !== 'number' ||
    !Number.isFinite(value.computeMs) ||
    value.computeMs < 0
  ) {
    throw new Error('Local layout response computeMs must be non-negative.');
  }
  validateCounters({
    iterationsCompleted: value.iterationsCompleted,
    batchesCompleted: value.batchesCompleted,
    request,
  });

  if (value.kind === 'error') {
    if (typeof value.message !== 'string' || value.message.length === 0) {
      throw new Error('Local layout error response requires a message.');
    }
    if (value.code !== 'max-wall-time' && value.code !== 'layout-error') {
      throw new Error('Local layout error response has an invalid code.');
    }
    if (value.code === 'max-wall-time') {
      if (value.batchesCompleted === 0 || value.finalMovement === null) {
        throw new Error(
          'Local layout timeout must describe its last completed batch.',
        );
      }
      validateMovement(value.finalMovement, request);
    } else if (
      value.iterationsCompleted !== 0 ||
      value.batchesCompleted !== 0 ||
      value.finalMovement !== null
    ) {
      throw new Error(
        'Local layout computation failure must not look partial.',
      );
    }
    return value as unknown as LocalLayoutWorkerResponse;
  }

  if (value.kind !== 'result') {
    throw new Error('Local layout response has an unsupported result shape.');
  }
  if (
    !Number.isSafeInteger(value.stableBatches) ||
    (value.stableBatches as number) < 0 ||
    (value.stableBatches as number) > (value.batchesCompleted as number)
  ) {
    throw new Error('Local layout result has an invalid stable-batch count.');
  }
  validatePositions(value.positions, request);
  if (value.stopReason === 'degenerate') {
    if (
      request.nodes.length !== 1 ||
      value.iterationsCompleted !== 0 ||
      value.batchesCompleted !== 0 ||
      value.stableBatches !== 0 ||
      value.finalMovement !== null
    ) {
      throw new Error('Local layout degenerate result is inconsistent.');
    }
  } else if (value.stopReason === 'stable') {
    if (
      request.nodes.length < 2 ||
      value.iterationsCompleted !==
        (value.batchesCompleted as number) *
          LOCAL_CONVERGENCE_BATCH_ITERATIONS ||
      (value.stableBatches as number) <
        LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED ||
      value.finalMovement === null
    ) {
      throw new Error('Local layout stable result is inconsistent.');
    }
    validateMovement(value.finalMovement, request);
    if (!localConvergenceBatchIsStable(value.finalMovement)) {
      throw new Error('Local layout stable result exceeds its thresholds.');
    }
  } else if (value.stopReason === 'max-iterations') {
    if (
      request.nodes.length < 2 ||
      value.iterationsCompleted !== request.policy.maxIterations ||
      value.batchesCompleted !==
        Math.ceil(
          request.policy.maxIterations / LOCAL_CONVERGENCE_BATCH_ITERATIONS,
        ) ||
      (value.stableBatches as number) >=
        LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED ||
      value.finalMovement === null
    ) {
      throw new Error('Local layout max-iterations result is inconsistent.');
    }
    validateMovement(value.finalMovement, request);
  } else {
    throw new Error('Local layout result has an invalid stop reason.');
  }
  return value as unknown as LocalLayoutWorkerResponse;
}
