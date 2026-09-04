import type {
  LocalLayoutEdge,
  LocalLayoutPosition,
  LocalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { resolveLocalDensityFit } from '@icarus-graph-explorer/renderer-sigma/core';
import {
  createNormalizationFunction,
  matrixFromCamera,
  multiplyVec2,
} from 'sigma/utils';

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

export interface PositionedNode extends LocalLayoutPosition {
  readonly size: number;
  readonly kind: string;
}

export interface SpacingScene {
  readonly rootKey: string;
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly LocalLayoutEdge[];
}

export interface GeometryMetrics {
  readonly medianNearestNeighbor: number;
  readonly p10NearestNeighbor: number;
  readonly p90NearestNeighbor: number;
  readonly medianReferenceEdge: number;
  readonly medianHierarchyEdge: number;
  readonly medianRootRadius: number;
  readonly p90RootRadius: number;
  readonly maximumRootRadius: number;
  readonly boundingWidth: number;
  readonly boundingHeight: number;
  readonly robustExtent: number;
  readonly representativeDiameter: number;
}

export interface ScreenMetrics {
  readonly cameraRatio: number;
  readonly medianNearestNeighborPx: number;
  readonly medianConnectedEdgePx: number;
  readonly p90RootRadiusPx: number;
  readonly occupancyWidthPx: number;
  readonly occupancyHeightPx: number;
  readonly medianNodeRadiusPx: number;
  readonly nearestNeighborPerNodeDiameter: number;
  readonly connectedEdgePerNodeDiameter: number;
  readonly p90RootRadiusPerNodeDiameter: number;
  readonly nodeRadiusPerNearestNeighbor: number;
}

export interface TopologyMetrics {
  readonly nodes: number;
  readonly edges: number;
  readonly components: number;
  readonly documentNodes: number;
  readonly sectionNodes: number;
  readonly blockNodes: number;
  readonly diagnosticNodes: number;
  readonly hierarchyEdges: number;
  readonly referenceEdges: number;
}

export interface CandidateRatios {
  readonly B0: 1;
  readonly B1: number;
  readonly B2: number;
  readonly B3: number;
  readonly B4: number;
}

export function productionDensityRatio(scene: SpacingScene): number {
  const decision = resolveLocalDensityFit(
    {
      rootNodeKey: scene.rootKey,
      nodes: scene.nodes.map(({ key, size }) => ({
        key,
        attributes: { size },
      })),
      edges: scene.edges,
    },
    scene.nodes,
  );
  if (decision.fallback) {
    throw new Error(
      `Production density policy rejected diagnostic scene: ${decision.fallbackReason ?? 'unknown reason'}`,
    );
  }
  return decision.ratio;
}

export const PRIMARY_VIEWPORT: Dimensions = { width: 1200, height: 800 };
export const SMALL_VIEWPORT: Dimensions = { width: 720, height: 480 };
export const SIGMA_STAGE_PADDING = 24;

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function byKey(scene: SpacingScene): ReadonlyMap<string, PositionedNode> {
  return new Map(scene.nodes.map((node) => [node.key, node]));
}

function nearestDistances(nodes: readonly PositionedNode[]): readonly number[] {
  return nodes.map((node, index) => {
    let nearest = Number.POSITIVE_INFINITY;
    for (let otherIndex = 0; otherIndex < nodes.length; otherIndex += 1) {
      if (index === otherIndex) continue;
      nearest = Math.min(nearest, distance(node, nodes[otherIndex]!));
    }
    return Number.isFinite(nearest) ? nearest : 0;
  });
}

function edgeDistances(
  scene: SpacingScene,
  kind?: 'hierarchy' | 'reference',
): readonly number[] {
  const nodes = byKey(scene);
  return scene.edges
    .filter((edge) => kind === undefined || edge.kind === kind)
    .map((edge) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (source === undefined || target === undefined) {
        throw new Error(
          `Spacing metric edge ${edge.key} has a missing endpoint.`,
        );
      }
      return distance(source, target);
    });
}

export function topologyMetrics(scene: SpacingScene): TopologyMetrics {
  const adjacency = new Map(
    scene.nodes.map(({ key }) => [key, new Set<string>()]),
  );
  for (const edge of scene.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  const unseen = new Set(adjacency.keys());
  let components = 0;
  while (unseen.size > 0) {
    components += 1;
    const first = unseen.values().next().value as string;
    const pending = [first];
    unseen.delete(first);
    while (pending.length > 0) {
      const key = pending.pop()!;
      for (const neighbor of adjacency.get(key) ?? []) {
        if (!unseen.delete(neighbor)) continue;
        pending.push(neighbor);
      }
    }
  }
  const kinds = (kind: string) =>
    scene.nodes.filter((node) => node.kind === kind).length;
  return {
    nodes: scene.nodes.length,
    edges: scene.edges.length,
    components,
    documentNodes: kinds('document'),
    sectionNodes: kinds('section'),
    blockNodes: kinds('block'),
    diagnosticNodes: kinds('diagnostic'),
    hierarchyEdges: scene.edges.filter(({ kind }) => kind === 'hierarchy')
      .length,
    referenceEdges: scene.edges.filter(({ kind }) => kind === 'reference')
      .length,
  };
}

export function geometryMetrics(scene: SpacingScene): GeometryMetrics {
  const nearest = nearestDistances(scene.nodes);
  const references = edgeDistances(scene, 'reference');
  const hierarchy = edgeDistances(scene, 'hierarchy');
  const root = scene.nodes.find(({ key }) => key === scene.rootKey);
  if (root === undefined)
    throw new Error('Spacing scene omitted its root node.');
  const rootRadii = scene.nodes.map((node) => distance(root, node));
  const xs = scene.nodes.map(({ x }) => x);
  const ys = scene.nodes.map(({ y }) => y);
  const representativeDiameter = percentile(
    scene.nodes.map(({ size }) => size * 2),
    0.5,
  );
  const medianNearestNeighbor = percentile(nearest, 0.5);
  const p90RootRadius = percentile(rootRadii, 0.9);
  return {
    medianNearestNeighbor: round(medianNearestNeighbor),
    p10NearestNeighbor: round(percentile(nearest, 0.1)),
    p90NearestNeighbor: round(percentile(nearest, 0.9)),
    medianReferenceEdge: round(percentile(references, 0.5)),
    medianHierarchyEdge: round(percentile(hierarchy, 0.5)),
    medianRootRadius: round(percentile(rootRadii, 0.5)),
    p90RootRadius: round(p90RootRadius),
    maximumRootRadius: round(Math.max(...rootRadii)),
    boundingWidth: round(Math.max(...xs) - Math.min(...xs)),
    boundingHeight: round(Math.max(...ys) - Math.min(...ys)),
    robustExtent: round(p90RootRadius * 2),
    representativeDiameter: round(representativeDiameter),
  };
}

function extent(scene: SpacingScene) {
  const xs = scene.nodes.map(({ x }) => x);
  const ys = scene.nodes.map(({ y }) => y);
  return {
    x: [Math.min(...xs), Math.max(...xs)] as [number, number],
    y: [Math.min(...ys), Math.max(...ys)] as [number, number],
  };
}

export function screenPositions(
  scene: SpacingScene,
  cameraRatio: number,
  viewport: Dimensions = PRIMARY_VIEWPORT,
  padding = SIGMA_STAGE_PADDING,
): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  if (
    !Number.isFinite(cameraRatio) ||
    cameraRatio <= 0 ||
    !Number.isFinite(viewport.width) ||
    viewport.width <= padding * 2 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= padding * 2
  ) {
    throw new Error(
      'Spacing screen transform requires a positive camera ratio and a viewport larger than its padding.',
    );
  }
  if (scene.nodes.length === 0) {
    throw new Error('Spacing screen transform requires at least one node.');
  }
  const graphExtent = extent(scene);
  const normalization = createNormalizationFunction(graphExtent);
  const graphDimensions = {
    width: graphExtent.x[1] - graphExtent.x[0] || 1,
    height: graphExtent.y[1] - graphExtent.y[0] || 1,
  };
  const matrix = matrixFromCamera(
    { x: 0.5, y: 0.5, ratio: cameraRatio, angle: 0 },
    viewport,
    graphDimensions,
    padding,
  );
  return new Map(
    scene.nodes.map((node) => {
      const framed = normalization(node);
      const clip = multiplyVec2(matrix, framed);
      return [
        node.key,
        {
          x: ((1 + clip.x) * viewport.width) / 2,
          y: ((1 - clip.y) * viewport.height) / 2,
        },
      ] as const;
    }),
  );
}

export function screenMetrics(
  scene: SpacingScene,
  cameraRatio: number,
  viewport: Dimensions = PRIMARY_VIEWPORT,
): ScreenMetrics {
  const positions = screenPositions(scene, cameraRatio, viewport);
  const screenNodes = scene.nodes.map((node) => {
    const position = positions.get(node.key);
    if (position === undefined) {
      throw new Error(`Spacing screen transform omitted node ${node.key}.`);
    }
    return { ...node, ...position };
  });
  const screenScene: SpacingScene = { ...scene, nodes: screenNodes };
  const nearest = nearestDistances(screenNodes);
  const connected = edgeDistances(screenScene);
  const root = screenNodes.find(({ key }) => key === scene.rootKey);
  if (root === undefined)
    throw new Error('Spacing scene omitted its root node.');
  const rootRadii = screenNodes.map((node) => distance(root, node));
  const xs = screenNodes.map(({ x }) => x);
  const ys = screenNodes.map(({ y }) => y);
  const apparentRadii = scene.nodes.map(
    ({ size }) => size / Math.sqrt(cameraRatio),
  );
  const representativeDiameter = percentile(apparentRadii, 0.5) * 2;
  const medianNearestNeighbor = percentile(nearest, 0.5);
  if (scene.nodes.length > 1 && medianNearestNeighbor <= 0) {
    throw new Error(
      'Spacing density requires a positive median nearest-neighbor distance.',
    );
  }
  return {
    cameraRatio: round(cameraRatio),
    medianNearestNeighborPx: round(medianNearestNeighbor, 2),
    medianConnectedEdgePx: round(percentile(connected, 0.5), 2),
    p90RootRadiusPx: round(percentile(rootRadii, 0.9), 2),
    occupancyWidthPx: round(Math.max(...xs) - Math.min(...xs), 2),
    occupancyHeightPx: round(Math.max(...ys) - Math.min(...ys), 2),
    medianNodeRadiusPx: round(percentile(apparentRadii, 0.5), 2),
    nearestNeighborPerNodeDiameter: round(
      medianNearestNeighbor / representativeDiameter,
      4,
    ),
    connectedEdgePerNodeDiameter: round(
      percentile(connected, 0.5) / representativeDiameter,
      4,
    ),
    p90RootRadiusPerNodeDiameter: round(
      percentile(rootRadii, 0.9) / representativeDiameter,
      4,
    ),
    nodeRadiusPerNearestNeighbor: round(
      medianNearestNeighbor === 0
        ? 0
        : percentile(apparentRadii, 0.5) / medianNearestNeighbor,
      4,
    ),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function medianThree(left: number, middle: number, right: number): number {
  return [left, middle, right].sort((a, b) => a - b)[1]!;
}

/** Diagnostic-only formulas. SPACING1A does not make these product policy. */
export function candidateRatios(
  baseline: ScreenMetrics,
  nodeCount: number,
  bounds: readonly [number, number] = [0.7, 1.4],
): CandidateRatios {
  const targetEdgePx = Math.min(180, 80 + 20 * Math.sqrt(nodeCount));
  const targetNearestPerDiameter = 30 / Math.sqrt(nodeCount);
  const targetRadiusPx = Math.min(720, 200 + 70 * Math.sqrt(nodeCount));
  const B1 = baseline.medianConnectedEdgePx / targetEdgePx;
  // With screen-referenced sizes, distance/diameter changes by 1/sqrt(ratio).
  const B2 = Math.pow(
    baseline.nearestNeighborPerNodeDiameter / targetNearestPerDiameter,
    2,
  );
  const B3 = baseline.p90RootRadiusPx / targetRadiusPx;
  return {
    B0: 1,
    B1: round(clamp(B1, bounds[0], bounds[1])),
    B2: round(clamp(B2, bounds[0], bounds[1])),
    B3: round(clamp(B3, bounds[0], bounds[1])),
    B4: round(clamp(medianThree(B1, B2, B3), bounds[0], bounds[1])),
  };
}

export function sceneFromLayout(
  request: Omit<LocalLayoutRequest, 'requestId'>,
  positions: readonly LocalLayoutPosition[],
): SpacingScene {
  const positionByKey = new Map(
    positions.map((position) => [position.key, position]),
  );
  return {
    rootKey: request.rootKey,
    nodes: request.nodes.map((node) => {
      const position = positionByKey.get(node.key);
      if (position === undefined) {
        throw new Error(`Local layout result omitted node ${node.key}.`);
      }
      return { ...node, ...position };
    }),
    edges: request.edges,
  };
}

export function uniformlyScaleScene(
  scene: SpacingScene,
  factor: number,
): SpacingScene {
  return {
    ...scene,
    nodes: scene.nodes.map((node) => ({
      ...node,
      x: node.x * factor,
      y: node.y * factor,
    })),
  };
}

export function maximumScreenDelta(
  left: SpacingScene,
  right: SpacingScene,
  cameraRatio: number,
  viewport: Dimensions = PRIMARY_VIEWPORT,
): number {
  const leftPositions = screenPositions(left, cameraRatio, viewport);
  const rightPositions = screenPositions(right, cameraRatio, viewport);
  return round(
    Math.max(
      ...[...leftPositions].map(([key, point]) =>
        distance(point, rightPositions.get(key)!),
      ),
    ),
    8,
  );
}

export function maximumRelativeGeometryError(
  scene: SpacingScene,
  cameraRatio: number,
): number {
  const base = screenPositions(scene, 1);
  const candidate = screenPositions(scene, cameraRatio);
  let maximum = 0;
  for (let left = 0; left < scene.nodes.length; left += 1) {
    for (let right = left + 1; right < scene.nodes.length; right += 1) {
      const leftKey = scene.nodes[left]!.key;
      const rightKey = scene.nodes[right]!.key;
      const before = distance(base.get(leftKey)!, base.get(rightKey)!);
      const after = distance(candidate.get(leftKey)!, candidate.get(rightKey)!);
      if (before === 0) continue;
      const expected = before / cameraRatio;
      maximum = Math.max(maximum, Math.abs(after / expected - 1));
    }
  }
  return round(maximum, 8);
}
