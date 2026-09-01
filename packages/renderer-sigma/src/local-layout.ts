import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { stableHash32 } from './deterministic';
import type {
  LocalLayoutEdge,
  LocalLayoutNode,
  LocalLayoutPosition,
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalLayoutSettings,
  LocalLayoutWorkerResponse,
  LocalRendererInput,
} from './local-types';

const LOCAL_LAYOUT_SCHEMA_VERSION = 1 as const;
const MAX_LOCAL_LAYOUT_ITERATIONS = 1_000;

export const DEFAULT_LOCAL_LAYOUT_SETTINGS: LocalLayoutSettings = {
  hierarchyWeight: 6,
  referenceWeight: 1,
  scalingRatio: 1.35,
};

type LayoutGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; kind: string },
  { weight: number }
>;

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
  if (
    !Number.isInteger(request.iterations) ||
    request.iterations < 1 ||
    request.iterations > MAX_LOCAL_LAYOUT_ITERATIONS
  ) {
    throw new Error(
      `Local layout iterations must be an integer from 1 to ${MAX_LOCAL_LAYOUT_ITERATIONS}.`,
    );
  }
  finitePositive(request.settings.hierarchyWeight, 'hierarchyWeight');
  finitePositive(request.settings.referenceWeight, 'referenceWeight');
  finitePositive(request.settings.scalingRatio, 'scalingRatio');
  const nodeKeys = new Set<string>();
  for (const node of request.nodes) {
    if (node.key.length === 0 || nodeKeys.has(node.key)) {
      throw new Error('Local layout has an invalid or duplicate node key.');
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

export function computeLocalLayout(
  request: LocalLayoutRequest,
  now: () => number = () => performance.now(),
): LocalLayoutResult {
  validateLocalLayoutRequest(request);
  const graph = buildGraph(request);
  const started = now();
  if (graph.order > 1) {
    forceAtlas2.assign(graph, {
      iterations: request.iterations,
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
  const root = graph.getNodeAttributes(request.rootKey);
  const positions = graph
    .mapNodes((key, attributes) => ({
      key,
      x: Number((attributes.x - root.x).toFixed(8)),
      y: Number((attributes.y - root.y).toFixed(8)),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
    kind: 'result',
    requestId: request.requestId,
    computeMs: Number((now() - started).toFixed(3)),
    positions,
  };
}

export function createLocalLayoutRequest(
  input: LocalRendererInput,
  iterations: number,
  settings: LocalLayoutSettings = DEFAULT_LOCAL_LAYOUT_SETTINGS,
): Omit<LocalLayoutRequest, 'requestId'> {
  return {
    schemaVersion: LOCAL_LAYOUT_SCHEMA_VERSION,
    rootKey: input.rootNodeKey,
    iterations,
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
    iterations: request.iterations,
    settings: request.settings,
    nodes: [...request.nodes]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableNode),
    edges: [...request.edges]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableEdge),
  });
  return `local-layout-v1-${stableHash32(stable).toString(16).padStart(8, '0')}`;
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateLocalLayoutWorkerResponse(
  value: unknown,
  requestId: number,
  expectedNodeKeys: readonly string[],
): LocalLayoutWorkerResponse {
  if (
    !plainRecord(value) ||
    value.schemaVersion !== LOCAL_LAYOUT_SCHEMA_VERSION
  ) {
    throw new Error('Expected a schema-v1 Local layout response.');
  }
  if (value.requestId !== requestId) {
    throw new Error(
      `Expected Local layout request ${requestId}, received ${String(value.requestId)}.`,
    );
  }
  if (value.kind === 'error') {
    if (typeof value.message !== 'string' || value.message.length === 0) {
      throw new Error('Local layout error response requires a message.');
    }
    return value as unknown as LocalLayoutWorkerResponse;
  }
  if (value.kind !== 'result' || !Array.isArray(value.positions)) {
    throw new Error('Local layout response has an unsupported result shape.');
  }
  if (
    typeof value.computeMs !== 'number' ||
    !Number.isFinite(value.computeMs) ||
    value.computeMs < 0
  ) {
    throw new Error('Local layout result computeMs must be non-negative.');
  }
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
      throw new Error('Local layout result contains an invalid position.');
    }
    received.add(position.key);
  }
  if (received.size !== expected.size) {
    throw new Error('Local layout result omitted one or more nodes.');
  }
  return value as unknown as LocalLayoutWorkerResponse;
}
