import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import {
  resolveGlobalLayoutSettings,
  validateGlobalLayoutSettings,
} from './settings';
import type {
  GlobalFolderPriorAlgorithm,
  GlobalFolderPriorMetrics,
  GlobalLayoutEdge,
  GlobalLayoutNode,
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalLayoutWorkerResponse,
  GlobalRendererInput,
} from './types';
import { stableHash32 } from './deterministic';

type LayoutGraph = MultiDirectedGraph<
  { x: number; y: number; size: number; folderKey?: string },
  { weight: number }
>;

const MAX_LAYOUT_ITERATIONS = 1_000;
const LAYOUT_SCHEMA_VERSION = 1 as const;

function folderDirection(folderKey: string): { x: number; y: number } {
  const angle = (stableHash32(folderKey) / 0xffff_ffff) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function validateFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Global layout ${label} must be finite.`);
  }
}

function validateRequest(request: GlobalLayoutRequest): void {
  if (request.schemaVersion !== LAYOUT_SCHEMA_VERSION) {
    throw new Error('Unsupported Global layout request schema version.');
  }
  if (!Number.isSafeInteger(request.requestId) || request.requestId < 1) {
    throw new Error('Global layout requestId must be a positive safe integer.');
  }
  if (
    !Number.isInteger(request.iterations) ||
    request.iterations < 1 ||
    request.iterations > MAX_LAYOUT_ITERATIONS
  ) {
    throw new Error(
      `Global layout iterations must be an integer from 1 to ${MAX_LAYOUT_ITERATIONS}.`,
    );
  }
  if (
    request.algorithm !== 'reference-only' &&
    request.algorithm !== 'chunked-prior' &&
    request.algorithm !== 'offset-field'
  ) {
    throw new Error('Global layout request has an unsupported algorithm.');
  }
  validateGlobalLayoutSettings(request.settings);
  const nodeKeys = new Set<string>();
  for (const node of request.nodes) {
    if (node.key.length === 0 || nodeKeys.has(node.key)) {
      throw new Error(`Global layout has an invalid or duplicate node key.`);
    }
    nodeKeys.add(node.key);
    validateFinite(node.x, `node ${node.key} x`);
    validateFinite(node.y, `node ${node.key} y`);
    validateFinite(node.size, `node ${node.key} size`);
    if (node.size <= 0) {
      throw new Error(`Global layout node ${node.key} size must be positive.`);
    }
    if (node.folderKey !== undefined && node.folderKey.length === 0) {
      throw new Error(
        `Global layout node ${node.key} has an empty folder key.`,
      );
    }
  }
  const edgeKeys = new Set<string>();
  for (const edge of request.edges) {
    if (edge.key.length === 0 || edgeKeys.has(edge.key)) {
      throw new Error(`Global layout has an invalid or duplicate edge key.`);
    }
    edgeKeys.add(edge.key);
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(`Global layout edge ${edge.key} has a missing endpoint.`);
    }
    validateFinite(edge.weight, `edge ${edge.key} weight`);
    if (edge.weight <= 0) {
      throw new Error(
        `Global layout edge ${edge.key} weight must be positive.`,
      );
    }
  }
}

function buildLayoutGraph(request: GlobalLayoutRequest): LayoutGraph {
  const graph = new MultiDirectedGraph<
    { x: number; y: number; size: number; folderKey?: string },
    { weight: number }
  >();
  for (const node of request.nodes) {
    graph.addNode(node.key, {
      x: node.x,
      y: node.y,
      size: node.size,
      ...(node.folderKey === undefined ? {} : { folderKey: node.folderKey }),
    });
  }
  for (const edge of request.edges) {
    graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
      weight: edge.weight,
    });
  }
  return graph;
}

interface FolderSummary {
  readonly key: string;
  readonly nodes: readonly string[];
  readonly x: number;
  readonly y: number;
}

function summarizeFolders(graph: LayoutGraph): readonly FolderSummary[] {
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

function graphScale(graph: LayoutGraph): number {
  if (graph.order === 0) return 1;
  let x = 0;
  let y = 0;
  graph.forEachNode((_key, attributes) => {
    x += attributes.x;
    y += attributes.y;
  });
  x /= graph.order;
  y /= graph.order;
  let squared = 0;
  graph.forEachNode((_key, attributes) => {
    squared += (attributes.x - x) ** 2 + (attributes.y - y) ** 2;
  });
  return Math.max(1, Math.sqrt(squared / graph.order));
}

function applyChunkedFolderPrior(
  graph: LayoutGraph,
  cohesion: number,
  withinFolderSpacing: number,
  betweenFolderSpacing: number,
): void {
  const folders = summarizeFolders(graph);
  if (folders.length === 0 || cohesion === 0) return;
  const scale = graphScale(graph);
  const radialFactor = 1 - cohesion + (withinFolderSpacing - 1) * 0.012;
  const separation = cohesion * 0.16 * betweenFolderSpacing * scale;
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

function applyFolderOffsetField(
  graph: LayoutGraph,
  cohesion: number,
  betweenFolderSpacing: number,
): void {
  const folders = summarizeFolders(graph);
  if (folders.length === 0 || cohesion === 0) return;
  const scale = graphScale(graph);
  const strength = Math.min(0.72, cohesion * 4);
  for (const folder of folders) {
    const direction = folderDirection(folder.key);
    const targetX = direction.x * betweenFolderSpacing * scale;
    const targetY = direction.y * betweenFolderSpacing * scale;
    const offsetX = (targetX - folder.x) * strength;
    const offsetY = (targetY - folder.y) * strength;
    for (const node of folder.nodes) {
      const attributes = graph.getNodeAttributes(node);
      graph.mergeNodeAttributes(node, {
        x: attributes.x + offsetX,
        y: attributes.y + offsetY,
      });
    }
  }
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
  graph: LayoutGraph,
  request: GlobalLayoutRequest,
  inputPositions: ReadonlyMap<
    string,
    { readonly x: number; readonly y: number }
  >,
): GlobalFolderPriorMetrics {
  const folders = summarizeFolders(graph);
  const within: number[] = [];
  for (const folder of folders) {
    for (const node of folder.nodes) {
      within.push(distance(graph.getNodeAttributes(node), folder));
    }
  }
  const crossFolder: number[] = [];
  const maxPairs = 10_000;
  pairLoop: for (let left = 0; left < folders.length; left += 1) {
    for (let right = left + 1; right < folders.length; right += 1) {
      const a = folders[left];
      const b = folders[right];
      if (a !== undefined && b !== undefined) crossFolder.push(distance(a, b));
      if (crossFolder.length >= maxPairs) break pairLoop;
    }
  }
  const crossReferences: number[] = [];
  for (const edge of request.edges) {
    const source = graph.getNodeAttributes(edge.source);
    const target = graph.getNodeAttributes(edge.target);
    if (
      source.folderKey !== undefined &&
      target.folderKey !== undefined &&
      source.folderKey !== target.folderKey
    ) {
      crossReferences.push(distance(source, target));
    }
  }
  const displacements = graph.mapNodes((key, attributes) => {
    const input = inputPositions.get(key);
    return input === undefined ? 0 : distance(attributes, input);
  });
  return {
    meanWithinFolderDistance: Number(mean(within).toFixed(6)),
    meanCrossFolderDistance: Number(mean(crossFolder).toFixed(6)),
    meanCrossFolderReferenceLength: Number(mean(crossReferences).toFixed(6)),
    meanDisplacementFromInput: Number(mean(displacements).toFixed(6)),
  };
}

function assignForceAtlas2(
  graph: LayoutGraph,
  iterations: number,
  request: GlobalLayoutRequest,
): void {
  const settings = resolveGlobalLayoutSettings(request.settings);
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

export function computeGlobalLayout(
  request: GlobalLayoutRequest,
  now: () => number = () => performance.now(),
): GlobalLayoutResult {
  validateRequest(request);
  const graph = buildLayoutGraph(request);
  const inputPositions = new Map(
    request.nodes.map((node) => [node.key, { x: node.x, y: node.y }]),
  );
  const settings = resolveGlobalLayoutSettings(request.settings);
  const started = now();
  let folderPriorMs = 0;

  if (request.algorithm === 'chunked-prior' && settings.folderClustering) {
    const chunkCount = Math.min(5, request.iterations);
    const base = Math.floor(request.iterations / chunkCount);
    let remainder = request.iterations % chunkCount;
    for (let index = 0; index < chunkCount; index += 1) {
      const iterations = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      assignForceAtlas2(graph, iterations, request);
      const priorStarted = now();
      applyChunkedFolderPrior(
        graph,
        settings.folderCohesion,
        settings.withinFolderSpacing,
        settings.betweenFolderSpacing,
      );
      folderPriorMs += now() - priorStarted;
    }
  } else {
    assignForceAtlas2(graph, request.iterations, request);
    if (request.algorithm === 'offset-field' && settings.folderClustering) {
      const priorStarted = now();
      applyFolderOffsetField(
        graph,
        settings.folderCohesion,
        settings.betweenFolderSpacing,
      );
      folderPriorMs += now() - priorStarted;
    }
  }

  const positions = graph
    .mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    kind: 'result',
    requestId: request.requestId,
    algorithm: request.algorithm,
    computeMs: Number((now() - started).toFixed(3)),
    folderPriorMs: Number(folderPriorMs.toFixed(3)),
    positions,
    metrics: metrics(graph, request, inputPositions),
  };
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGlobalLayoutWorkerResponse(
  value: unknown,
  requestId: number,
  expectedNodeKeys: readonly string[],
): GlobalLayoutWorkerResponse {
  if (!plainRecord(value) || value.schemaVersion !== LAYOUT_SCHEMA_VERSION) {
    throw new Error('Expected a schema-v1 Global layout response.');
  }
  if (value.requestId !== requestId) {
    throw new Error(
      `Expected Global layout request ${requestId}, received ${String(value.requestId)}.`,
    );
  }
  if (value.kind === 'error') {
    if (typeof value.message !== 'string' || value.message.length === 0) {
      throw new Error('Global layout error response requires a message.');
    }
    return value as unknown as GlobalLayoutWorkerResponse;
  }
  if (value.kind !== 'result') {
    throw new Error('Global layout response has an unsupported kind.');
  }
  if (
    value.algorithm !== 'reference-only' &&
    value.algorithm !== 'chunked-prior' &&
    value.algorithm !== 'offset-field'
  ) {
    throw new Error('Global layout result has an unsupported algorithm.');
  }
  for (const field of ['computeMs', 'folderPriorMs'] as const) {
    if (
      typeof value[field] !== 'number' ||
      !Number.isFinite(value[field]) ||
      value[field] < 0
    ) {
      throw new Error(`Global layout result ${field} must be non-negative.`);
    }
  }
  if (!Array.isArray(value.positions)) {
    throw new Error('Global layout result positions must be an array.');
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
      throw new Error('Global layout result contains an invalid position.');
    }
    received.add(position.key);
  }
  if (received.size !== expected.size) {
    throw new Error('Global layout result omitted one or more nodes.');
  }
  if (!plainRecord(value.metrics)) {
    throw new Error('Global layout result metrics must be a plain object.');
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
      throw new Error(`Global layout metric ${field} must be non-negative.`);
    }
  }
  return value as unknown as GlobalLayoutWorkerResponse;
}

export function createGlobalLayoutRequest(
  input: GlobalRendererInput,
  settings: GlobalLayoutRequest['settings'],
  iterations: number,
  algorithm: GlobalFolderPriorAlgorithm = settings.folderClustering
    ? 'chunked-prior'
    : 'reference-only',
): Omit<GlobalLayoutRequest, 'requestId'> {
  validateGlobalLayoutSettings(settings);
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    algorithm,
    iterations,
    settings,
    nodes: input.nodes.map(({ key, attributes }) => ({
      key,
      x: attributes.x,
      y: attributes.y,
      size: attributes.size,
      ...(attributes.folderKey === null
        ? {}
        : { folderKey: attributes.folderKey }),
    })),
    edges: input.edges.map(({ key, source, target, attributes }) => ({
      key,
      source,
      target,
      weight: Math.max(1, attributes.referenceCount),
    })),
  };
}

/** Applies an exact memory-cache hit before a remounted Sigma session draws. */
export function warmGlobalRendererInput(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
): GlobalRendererInput {
  const byKey = new Map(
    positions.map((position) => [position.key, position] as const),
  );
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
        attributes: {
          ...node.attributes,
          x: position.x,
          y: position.y,
        },
      };
    }),
  };
}

function stableNode(node: GlobalLayoutNode): readonly (string | number)[] {
  return [node.key, node.size, node.folderKey ?? ''];
}

function stableEdge(edge: GlobalLayoutEdge): readonly (string | number)[] {
  return [edge.key, edge.source, edge.target, edge.weight];
}

export function globalLayoutFingerprint(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
): string {
  const value = JSON.stringify({
    schemaVersion: request.schemaVersion,
    algorithm: request.algorithm,
    iterations: request.iterations,
    settings: validateGlobalLayoutSettings(request.settings),
    nodes: [...request.nodes]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableNode),
    edges: [...request.edges]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(stableEdge),
  });
  return `global-layout-v1-${stableHash32(value).toString(16).padStart(8, '0')}`;
}
