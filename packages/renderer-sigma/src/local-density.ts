import type { LocalLayoutPosition } from './local-types';
import {
  NETWORK_DENSITY_REFERENCE_FRAME,
  canonicalScreenNodes,
  clamp,
  distance,
  median,
  percentile,
  round,
} from './network-density-core';

export const LOCAL_DENSITY_REFERENCE_FRAME = NETWORK_DENSITY_REFERENCE_FRAME;

export const LOCAL_DENSITY_RATIO_BOUNDS = {
  minimum: 0.7,
  maximum: 1.4,
} as const;

/**
 * SPACING1A's accepted B4 camera policy. Units are canonical screen pixels at
 * ratio 1; keeping them together makes later visual tuning auditable.
 */
export const LOCAL_DENSITY_TARGETS = {
  connectedEdgeBasePx: 80,
  connectedEdgePerSqrtNodePx: 20,
  connectedEdgeMaximumPx: 180,
  nearestNeighborPerDiameter: 30,
  rootRadiusBasePx: 200,
  rootRadiusPerSqrtNodePx: 70,
  rootRadiusMaximumPx: 720,
} as const;

export interface LocalDensityDecision {
  readonly ratio: number;
  readonly connectedEdgeSignal: number;
  readonly nearestNeighborSignal: number;
  readonly rootRadiusSignal: number;
  readonly fallback: boolean;
  readonly fallbackReason?: string;
}

export interface LocalDensityInput {
  readonly rootNodeKey: string;
  readonly nodes: readonly {
    readonly key: string;
    readonly attributes: { readonly size: number };
  }[];
  readonly edges: readonly {
    readonly source: string;
    readonly target: string;
  }[];
}

interface DensityNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

const FALLBACK_DECISION: LocalDensityDecision = {
  ratio: 1,
  connectedEdgeSignal: 1,
  nearestNeighborSignal: 1,
  rootRadiusSignal: 1,
  fallback: true,
};

function fallback(reason: string): LocalDensityDecision {
  return { ...FALLBACK_DECISION, fallbackReason: reason };
}

/**
 * Resolves the production Focus Fit ratio from accepted Local coordinates.
 * Sigma 3.0.3 normalization utilities intentionally define the reference
 * frame so this policy measures the same auto-rescaled scene Sigma renders.
 */
export function resolveLocalDensityFit(
  input: LocalDensityInput,
  positions: readonly LocalLayoutPosition[],
): LocalDensityDecision {
  if (input.nodes.length < 2) {
    return fallback('At least two nodes are required for density metrics.');
  }
  if (input.edges.length === 0) {
    return fallback(
      'At least one connected edge is required for density metrics.',
    );
  }
  const positionsByKey = new Map(
    positions.map((position) => [position.key, position]),
  );
  if (
    positionsByKey.size !== positions.length ||
    positions.length !== input.nodes.length
  ) {
    return fallback('Accepted positions must match Local nodes exactly.');
  }
  const nodes: DensityNode[] = [];
  for (const node of input.nodes) {
    const position = positionsByKey.get(node.key);
    if (
      position === undefined ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(node.attributes.size) ||
      node.attributes.size <= 0
    ) {
      return fallback(
        'Local density input contains invalid coordinates or sizes.',
      );
    }
    nodes.push({
      key: node.key,
      x: position.x,
      y: position.y,
      size: node.attributes.size,
    });
  }
  const nodesByKey = new Map(nodes.map((node) => [node.key, node]));
  if (nodesByKey.size !== nodes.length || !nodesByKey.has(input.rootNodeKey)) {
    return fallback('Local density input has duplicate nodes or no root.');
  }
  const screenNodes = canonicalScreenNodes(nodes);
  if (screenNodes === undefined) {
    return fallback('Sigma normalization produced invalid screen coordinates.');
  }
  const screenByKey = new Map(screenNodes.map((node) => [node.key, node]));
  const nearest: number[] = [];
  for (let index = 0; index < screenNodes.length; index += 1) {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let other = 0; other < screenNodes.length; other += 1) {
      if (index === other) continue;
      const candidate = distance(screenNodes[index]!, screenNodes[other]!);
      if (candidate === 0) {
        return fallback('Local density input contains duplicate coordinates.');
      }
      nearestDistance = Math.min(nearestDistance, candidate);
    }
    nearest.push(nearestDistance);
  }
  const connected: number[] = [];
  for (const edge of input.edges) {
    const source = screenByKey.get(edge.source);
    const target = screenByKey.get(edge.target);
    if (source === undefined || target === undefined) {
      return fallback('Local density edge has a missing endpoint.');
    }
    const edgeDistance = distance(source, target);
    if (edgeDistance <= 0) {
      return fallback('Local density edge has zero geometric length.');
    }
    connected.push(edgeDistance);
  }
  const root = screenByKey.get(input.rootNodeKey)!;
  const rootRadii = screenNodes.map((node) => distance(root, node));
  const representativeDiameter = percentile(
    screenNodes.map(({ size }) => size * 2),
    0.5,
  );
  const medianNearestNeighbor = percentile(nearest, 0.5);
  const medianConnectedEdge = percentile(connected, 0.5);
  const p90RootRadius = percentile(rootRadii, 0.9);
  if (
    !Number.isFinite(representativeDiameter) ||
    representativeDiameter <= 0 ||
    !Number.isFinite(medianNearestNeighbor) ||
    medianNearestNeighbor <= 0 ||
    !Number.isFinite(medianConnectedEdge) ||
    medianConnectedEdge <= 0 ||
    !Number.isFinite(p90RootRadius) ||
    p90RootRadius <= 0
  ) {
    return fallback('Local density metrics are non-finite or unusable.');
  }
  const nodeCount = screenNodes.length;
  const sqrtNodeCount = Math.sqrt(nodeCount);
  const connectedEdgeTarget = Math.min(
    LOCAL_DENSITY_TARGETS.connectedEdgeMaximumPx,
    LOCAL_DENSITY_TARGETS.connectedEdgeBasePx +
      LOCAL_DENSITY_TARGETS.connectedEdgePerSqrtNodePx * sqrtNodeCount,
  );
  const nearestTarget =
    LOCAL_DENSITY_TARGETS.nearestNeighborPerDiameter / sqrtNodeCount;
  const rootRadiusTarget = Math.min(
    LOCAL_DENSITY_TARGETS.rootRadiusMaximumPx,
    LOCAL_DENSITY_TARGETS.rootRadiusBasePx +
      LOCAL_DENSITY_TARGETS.rootRadiusPerSqrtNodePx * sqrtNodeCount,
  );
  const connectedEdgeSignal = medianConnectedEdge / connectedEdgeTarget;
  const nearestNeighborSignal = Math.pow(
    medianNearestNeighbor / representativeDiameter / nearestTarget,
    2,
  );
  const rootRadiusSignal = p90RootRadius / rootRadiusTarget;
  const rawRatio = median([
    connectedEdgeSignal,
    nearestNeighborSignal,
    rootRadiusSignal,
  ]);
  if (
    ![
      connectedEdgeSignal,
      nearestNeighborSignal,
      rootRadiusSignal,
      rawRatio,
    ].every(Number.isFinite)
  ) {
    return fallback('Local density signals are non-finite.');
  }
  return {
    ratio: round(
      clamp(
        rawRatio,
        LOCAL_DENSITY_RATIO_BOUNDS.minimum,
        LOCAL_DENSITY_RATIO_BOUNDS.maximum,
      ),
    ),
    connectedEdgeSignal,
    nearestNeighborSignal,
    rootRadiusSignal,
    fallback: false,
  };
}
