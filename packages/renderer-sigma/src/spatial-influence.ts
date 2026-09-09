import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import {
  computeAutomaticGraphFrame,
  targetFromNormalizedAnchor,
  type ResolvedFolderSpatialRules,
  type SpatialPosition,
} from '@icarus-graph-explorer/spatial-overrides';

import { stableHash32 } from './deterministic';
import {
  globalLayoutSettingsFromPhysics,
  resolveGlobalPhysicsSettings,
  resolveGlobalLayoutSettings,
  validateGlobalLayoutSettings,
} from './settings';
import { SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN } from './spatial';
import type {
  GlobalLayoutEdge,
  GlobalRendererInput,
  GlobalSpatialInfluenceAlgorithm,
  GlobalSpatialInfluenceAttractor,
  GlobalSpatialInfluenceMetrics,
  GlobalSpatialInfluenceNode,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
  GlobalSpatialInfluenceWorkerResponse,
} from './types';

type InfluenceGraph = MultiDirectedGraph<
  { x: number; y: number; size: number },
  { weight: number }
>;

const SCHEMA_VERSION = 1 as const;
const ALGORITHM_VERSION = 1 as const;
const MAX_ITERATIONS = 1_000;
const INTERLEAVED_CHUNKS = 6;

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
}

function validateRequest(request: GlobalSpatialInfluenceRequest): void {
  if (
    request.schemaVersion !== SCHEMA_VERSION ||
    request.algorithmVersion !== ALGORITHM_VERSION
  ) {
    throw new Error(
      'Unsupported spatial-influence request schema or algorithm version.',
    );
  }
  if (!Number.isSafeInteger(request.requestId) || request.requestId < 1) {
    throw new Error(
      'Spatial-influence requestId must be a positive safe integer.',
    );
  }
  if (
    request.algorithm !== 'interleaved-centroid' &&
    request.algorithm !== 'move-then-relax'
  ) {
    throw new Error('Unsupported spatial-influence algorithm.');
  }
  if (
    !Number.isInteger(request.iterations) ||
    request.iterations < 1 ||
    request.iterations > MAX_ITERATIONS
  ) {
    throw new Error(
      `Spatial-influence iterations must be an integer from 1 to ${MAX_ITERATIONS}.`,
    );
  }
  if (request.baseLayoutFingerprint.length === 0) {
    throw new Error('Spatial influence requires a base-layout fingerprint.');
  }
  validateGlobalLayoutSettings(request.globalLayoutSettings);
  const nodeKeys = new Set<string>();
  for (const node of request.nodes) {
    if (node.key.length === 0 || nodeKeys.has(node.key)) {
      throw new Error('Spatial influence requires unique non-empty node keys.');
    }
    nodeKeys.add(node.key);
    finite(node.x, `Spatial node ${node.key} x`);
    finite(node.y, `Spatial node ${node.key} y`);
    finite(node.size, `Spatial node ${node.key} size`);
    if (node.size <= 0)
      throw new Error(`Spatial node ${node.key} size must be positive.`);
  }
  const edgeKeys = new Set<string>();
  for (const edge of request.edges) {
    if (
      edge.key.length === 0 ||
      edgeKeys.has(edge.key) ||
      !nodeKeys.has(edge.source) ||
      !nodeKeys.has(edge.target)
    ) {
      throw new Error(
        `Spatial edge ${edge.key} is duplicate or has a missing endpoint.`,
      );
    }
    edgeKeys.add(edge.key);
    finite(edge.weight, `Spatial edge ${edge.key} weight`);
    if (edge.weight <= 0)
      throw new Error(`Spatial edge ${edge.key} weight must be positive.`);
  }
  const claimedMembers = new Set<string>();
  const roots = new Set<string>();
  for (const attractor of request.attractors) {
    if (
      attractor.ruleFolderKey.length === 0 ||
      roots.has(attractor.ruleFolderKey)
    ) {
      throw new Error(
        'Spatial attractors require unique non-empty rule roots.',
      );
    }
    roots.add(attractor.ruleFolderKey);
    finite(attractor.targetX, 'Spatial attractor targetX');
    finite(attractor.targetY, 'Spatial attractor targetY');
    if (
      !Number.isInteger(attractor.strength) ||
      attractor.strength < 0 ||
      attractor.strength > 100 ||
      attractor.memberNodeKeys.length === 0
    ) {
      throw new Error(
        'Spatial attractors require members and integer strength from 0 to 100.',
      );
    }
    for (const key of attractor.memberNodeKeys) {
      if (!nodeKeys.has(key) || claimedMembers.has(key)) {
        throw new Error(
          'Spatial attractor members must exist and have one winning rule.',
        );
      }
      claimedMembers.add(key);
    }
  }
}

function buildGraph(request: GlobalSpatialInfluenceRequest): InfluenceGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number },
    { weight: number }
  >();
  for (const node of [...request.nodes].sort((a, b) =>
    a.key.localeCompare(b.key),
  )) {
    graph.addNode(node.key, { x: node.x, y: node.y, size: node.size });
  }
  for (const edge of [...request.edges].sort((a, b) =>
    a.key.localeCompare(b.key),
  )) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

function graphScale(graph: InfluenceGraph): number {
  if (graph.order === 0) return 1;
  let centerX = 0;
  let centerY = 0;
  graph.forEachNode((_key, node) => {
    centerX += node.x / graph.order;
    centerY += node.y / graph.order;
  });
  let squared = 0;
  graph.forEachNode((_key, node) => {
    squared += (node.x - centerX) ** 2 + (node.y - centerY) ** 2;
  });
  return Math.max(1, Math.sqrt(squared / graph.order));
}

function centroid(
  graph: InfluenceGraph,
  memberNodeKeys: readonly string[],
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const key of memberNodeKeys) {
    const node = graph.getNodeAttributes(key);
    x += node.x / memberNodeKeys.length;
    y += node.y / memberNodeKeys.length;
  }
  return { x, y };
}

/**
 * A pull step is a shared centroid translation. The gain is 0.55 × normalized
 * strength and the per-chunk distance is capped at 0.60 × graph RMS scale ×
 * normalized strength. Thus strength 0 is inert and strength 100 remains soft.
 */
function applyAttractors(
  graph: InfluenceGraph,
  attractors: readonly GlobalSpatialInfluenceAttractor[],
  mode: 'chunk' | 'initial',
): void {
  const scale = graphScale(graph);
  for (const attractor of [...attractors].sort((a, b) =>
    a.ruleFolderKey.localeCompare(b.ruleFolderKey),
  )) {
    const strength = attractor.strength / 100;
    if (strength === 0) continue;
    const current = centroid(graph, attractor.memberNodeKeys);
    const dx = attractor.targetX - current.x;
    const dy = attractor.targetY - current.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) continue;
    const gain = 0.55 * strength;
    const cap = scale * (mode === 'chunk' ? 0.6 : 0.9) * strength;
    const multiplier = Math.min(gain, cap / distance);
    for (const key of attractor.memberNodeKeys) {
      const node = graph.getNodeAttributes(key);
      graph.mergeNodeAttributes(key, {
        x: node.x + dx * multiplier,
        y: node.y + dy * multiplier,
      });
    }
  }
}

function assignForceAtlas2(
  graph: InfluenceGraph,
  request: GlobalSpatialInfluenceRequest,
  iterations: number,
): void {
  if (graph.order < 2 || iterations === 0) return;
  const settings = resolveGlobalLayoutSettings(request.globalLayoutSettings);
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

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

function computeMetrics(
  graph: InfluenceGraph,
  request: GlobalSpatialInfluenceRequest,
): GlobalSpatialInfluenceMetrics {
  const base = new Map(request.nodes.map((node) => [node.key, node] as const));
  const baseCenter = request.nodes.reduce(
    (center, node) => ({
      x: center.x + node.x / Math.max(1, request.nodes.length),
      y: center.y + node.y / Math.max(1, request.nodes.length),
    }),
    { x: 0, y: 0 },
  );
  const baseScale = Math.max(
    1,
    Math.sqrt(
      mean(
        request.nodes.map(
          (node) => (node.x - baseCenter.x) ** 2 + (node.y - baseCenter.y) ** 2,
        ),
      ),
    ),
  );
  const affected = new Set(
    request.attractors.flatMap((item) => item.memberNodeKeys),
  );
  const targetErrors = request.attractors.map(
    (attractor) =>
      distance(centroid(graph, attractor.memberNodeKeys), {
        x: attractor.targetX,
        y: attractor.targetY,
      }) / baseScale,
  );
  const affectedDisplacements: number[] = [];
  const unaffectedDisplacements: number[] = [];
  graph.forEachNode((key, node) => {
    const displacement = distance(node, base.get(key)!);
    (affected.has(key) ? affectedDisplacements : unaffectedDisplacements).push(
      displacement,
    );
  });
  const referenceLengths: number[] = [];
  const crossBoundaryLengths: number[] = [];
  for (const edge of request.edges) {
    const length = distance(
      graph.getNodeAttributes(edge.source),
      graph.getNodeAttributes(edge.target),
    );
    referenceLengths.push(length);
    if (affected.has(edge.source) !== affected.has(edge.target)) {
      crossBoundaryLengths.push(length);
    }
  }
  return {
    meanTargetError: rounded(mean(targetErrors)),
    maxTargetError: rounded(Math.max(0, ...targetErrors)),
    meanAffectedDisplacement: rounded(mean(affectedDisplacements)),
    meanUnaffectedDisplacement: rounded(mean(unaffectedDisplacements)),
    meanCrossBoundaryReferenceLength: rounded(mean(crossBoundaryLengths)),
    meanReferenceLength: rounded(mean(referenceLengths)),
  };
}

export function computeGlobalSpatialInfluence(
  request: GlobalSpatialInfluenceRequest,
  now: () => number = () => performance.now(),
): GlobalSpatialInfluenceResult {
  validateRequest(request);
  const graph = buildGraph(request);
  const started = now();
  let forceAtlasMs = 0;
  let attractorMs = 0;
  const hasEffectiveAttractor = request.attractors.some(
    ({ strength }) => strength > 0,
  );
  if (!hasEffectiveAttractor) {
    // Strength zero is an exact no-pull path and must preserve the base layer.
  } else if (request.algorithm === 'move-then-relax') {
    const attractorStarted = now();
    applyAttractors(graph, request.attractors, 'initial');
    attractorMs += now() - attractorStarted;
    const forceStarted = now();
    assignForceAtlas2(graph, request, request.iterations);
    forceAtlasMs += now() - forceStarted;
  } else {
    const chunks = Math.min(INTERLEAVED_CHUNKS, request.iterations);
    const baseIterations = Math.floor(request.iterations / chunks);
    let remainder = request.iterations % chunks;
    for (let index = 0; index < chunks; index += 1) {
      const iterations = baseIterations + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      const forceStarted = now();
      assignForceAtlas2(graph, request, iterations);
      forceAtlasMs += now() - forceStarted;
      const attractorStarted = now();
      applyAttractors(graph, request.attractors, 'chunk');
      attractorMs += now() - attractorStarted;
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'result',
    requestId: request.requestId,
    algorithm: request.algorithm,
    computeMs: Number((now() - started).toFixed(3)),
    forceAtlasMs: Number(forceAtlasMs.toFixed(3)),
    attractorMs: Number(attractorMs.toFixed(3)),
    positions: graph
      .mapNodes((key, node) => ({ key, x: node.x, y: node.y }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    metrics: computeMetrics(graph, request),
  };
}

export function createGlobalSpatialInfluenceRequest(
  input: GlobalRendererInput,
  globalLayoutSettings: GlobalSpatialInfluenceRequest['globalLayoutSettings'],
  iterations: number,
  baseAutomaticPositions: readonly SpatialPosition[],
  baseLayoutFingerprint: string,
  resolved: ResolvedFolderSpatialRules,
  algorithm: GlobalSpatialInfluenceAlgorithm = 'interleaved-centroid',
): Omit<GlobalSpatialInfluenceRequest, 'requestId'> {
  const byKey = new Map(
    baseAutomaticPositions.map((item) => [item.key, item] as const),
  );
  const documentKeys = input.nodes.flatMap((node) =>
    node.attributes.nodeKind === 'document' ? [node.key] : [],
  );
  const frame = computeAutomaticGraphFrame(
    baseAutomaticPositions,
    documentKeys,
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    algorithm,
    algorithmVersion: ALGORITHM_VERSION,
    baseLayoutFingerprint,
    iterations,
    globalLayoutSettings: globalLayoutSettingsFromPhysics(
      resolveGlobalPhysicsSettings(globalLayoutSettings),
    ),
    nodes: input.nodes.map(({ key, attributes }) => {
      const position = byKey.get(key);
      if (position === undefined) {
        throw new Error(`Base automatic positions omitted node ${key}.`);
      }
      return { key, x: position.x, y: position.y, size: attributes.size };
    }),
    edges: input.edges.map(({ key, source, target, attributes }) => ({
      key,
      source,
      target,
      weight: Math.max(1, attributes.referenceCount),
    })),
    attractors: resolved.pullGroups.map((group) => {
      const target = targetFromNormalizedAnchor(
        frame,
        group.rule.anchor,
        SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
      );
      return {
        ruleFolderKey: group.rule.folderKey,
        memberNodeKeys: group.memberNodeKeys,
        targetX: target.x,
        targetY: target.y,
        strength: group.rule.strength!,
      };
    }),
  };
}

function stableNode(
  node: GlobalSpatialInfluenceNode,
): readonly (string | number)[] {
  return [node.key, node.x, node.y, node.size];
}

function stableEdge(edge: GlobalLayoutEdge): readonly (string | number)[] {
  return [edge.key, edge.source, edge.target, edge.weight];
}

export function globalSpatialInfluenceFingerprint(
  request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
): string {
  const stable = JSON.stringify({
    schemaVersion: request.schemaVersion,
    algorithmVersion: request.algorithmVersion,
    algorithm: request.algorithm,
    baseLayoutFingerprint: request.baseLayoutFingerprint,
    iterations: request.iterations,
    globalLayoutSettings: globalLayoutSettingsFromPhysics(
      resolveGlobalPhysicsSettings(request.globalLayoutSettings),
    ),
    nodes: [...request.nodes]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(stableNode),
    edges: [...request.edges]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(stableEdge),
    attractors: [...request.attractors]
      .sort((a, b) => a.ruleFolderKey.localeCompare(b.ruleFolderKey))
      .map((item) => [
        item.ruleFolderKey,
        [...item.memberNodeKeys].sort(),
        item.targetX,
        item.targetY,
        item.strength,
      ]),
  });
  return `global-spatial-v1-${stableHash32(stable).toString(16).padStart(8, '0')}`;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGlobalSpatialInfluenceWorkerResponse(
  value: unknown,
  requestId: number,
  expectedNodeKeys: readonly string[],
): GlobalSpatialInfluenceWorkerResponse {
  if (!plainRecord(value) || value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('Expected a schema-v1 spatial-influence response.');
  }
  if (value.requestId !== requestId) {
    throw new Error(`Expected spatial-influence request ${requestId}.`);
  }
  if (value.kind === 'error') {
    if (typeof value.message !== 'string' || value.message.length === 0) {
      throw new Error('Spatial-influence error response requires a message.');
    }
    return value as unknown as GlobalSpatialInfluenceWorkerResponse;
  }
  if (
    value.kind !== 'result' ||
    (value.algorithm !== 'interleaved-centroid' &&
      value.algorithm !== 'move-then-relax')
  ) {
    throw new Error(
      'Spatial-influence response has an unsupported kind or algorithm.',
    );
  }
  for (const field of ['computeMs', 'forceAtlasMs', 'attractorMs'] as const) {
    if (
      typeof value[field] !== 'number' ||
      !Number.isFinite(value[field]) ||
      value[field] < 0
    ) {
      throw new Error(`Spatial-influence ${field} must be non-negative.`);
    }
  }
  if (!Array.isArray(value.positions))
    throw new Error('Spatial positions must be an array.');
  const expected = new Set(expectedNodeKeys);
  const received = new Set<string>();
  for (const position of value.positions) {
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
      throw new Error('Spatial-influence result contains an invalid position.');
    }
    received.add(position.key);
  }
  if (received.size !== expected.size)
    throw new Error('Spatial-influence result omitted nodes.');
  if (!plainRecord(value.metrics))
    throw new Error('Spatial-influence metrics must be an object.');
  for (const field of [
    'meanTargetError',
    'maxTargetError',
    'meanAffectedDisplacement',
    'meanUnaffectedDisplacement',
    'meanCrossBoundaryReferenceLength',
    'meanReferenceLength',
  ] as const) {
    if (
      typeof value.metrics[field] !== 'number' ||
      !Number.isFinite(value.metrics[field]) ||
      value.metrics[field] < 0
    ) {
      throw new Error(
        `Spatial-influence metric ${field} must be non-negative.`,
      );
    }
  }
  return value as unknown as GlobalSpatialInfluenceWorkerResponse;
}
