import type { GlobalLayoutPosition, GlobalRendererInput } from './types';
import {
  NETWORK_DENSITY_REFERENCE_FRAME,
  canonicalScreenNodes,
  clamp,
  distance,
  median,
  nearestNeighborDistances,
  percentile,
  round,
  topologyMetrics,
  type NetworkTopologyMetrics,
} from './network-density-core';

export const GLOBAL_DENSITY_RATIO_BOUNDS = {
  minimum: 0.7,
  maximum: 1.4,
} as const;

/** Auditable SPACING1B-GLOBAL targets in Sigma-normalized reference pixels. */
export const GLOBAL_DENSITY_TARGETS = {
  nearestNeighborPerDiameterAtSqrtNode: 24,
  connectedEdgeBasePx: 90,
  connectedEdgePerSqrtNodePx: 15,
  connectedEdgeMaximumPx: 180,
  robustRadiusBasePx: 260,
  robustRadiusPerSqrtNodePx: 40,
  robustRadiusMaximumPx: 520,
  usefulViewportFraction: 0.95,
} as const;

export interface GlobalDensityDecision extends NetworkTopologyMetrics {
  readonly ratio: number;
  readonly nearestNeighborSignal: number;
  readonly connectedEdgeSignal?: number;
  readonly robustExtentSignal: number;
  readonly visibilityMinimumRatio: number;
  readonly medianNearestNeighborPx: number;
  readonly medianConnectedEdgePx?: number;
  readonly p95RadiusPx: number;
  readonly fallback: boolean;
  readonly fallbackReason?: string;
}

const EMPTY_TOPOLOGY: NetworkTopologyMetrics = {
  nodeCount: 0,
  edgeCount: 0,
  componentCount: 0,
  isolatedNodeCount: 0,
  largestComponentSize: 0,
};

function fallback(
  reason: string,
  topology: NetworkTopologyMetrics = EMPTY_TOPOLOGY,
): GlobalDensityDecision {
  return {
    ...topology,
    ratio: 1,
    nearestNeighborSignal: 1,
    robustExtentSignal: 1,
    visibilityMinimumRatio: 1,
    medianNearestNeighborPx: 0,
    p95RadiusPx: 0,
    fallback: true,
    fallbackReason: reason,
  };
}

function usefulViewportRequirement(
  nodes: readonly { readonly x: number; readonly y: number }[],
): number {
  const horizontal =
    NETWORK_DENSITY_REFERENCE_FRAME.width / 2 -
    NETWORK_DENSITY_REFERENCE_FRAME.stagePadding;
  const vertical =
    NETWORK_DENSITY_REFERENCE_FRAME.height / 2 -
    NETWORK_DENSITY_REFERENCE_FRAME.stagePadding;
  const requirements = nodes.map(({ x, y }) =>
    Math.max(
      Math.abs(x - NETWORK_DENSITY_REFERENCE_FRAME.width / 2) / horizontal,
      Math.abs(y - NETWORK_DENSITY_REFERENCE_FRAME.height / 2) / vertical,
    ),
  );
  return percentile(
    requirements,
    GLOBAL_DENSITY_TARGETS.usefulViewportFraction,
  );
}

/**
 * Rootless All Network density policy. It accepts independent components,
 * measures the final displayed coordinates, and uses connected edges only as
 * an optional signal. Nothing returned here is a layout input.
 */
export function resolveGlobalDensityFit(
  input: GlobalRendererInput,
  positions: readonly GlobalLayoutPosition[],
): GlobalDensityDecision {
  const topology = topologyMetrics(
    input.nodes.map(({ key }) => key),
    input.edges,
  );
  if (topology === undefined) {
    return fallback('Global density topology has duplicate or missing nodes.');
  }
  if (input.nodes.length === 0) {
    return fallback(
      'Global density requires at least one displayed node.',
      topology,
    );
  }
  if (input.nodes.length === 1) {
    return fallback(
      'A single displayed node has no measurable spacing or extent.',
      topology,
    );
  }
  const positionsByKey = new Map(
    positions.map((position) => [position.key, position]),
  );
  if (
    positionsByKey.size !== positions.length ||
    positions.length !== input.nodes.length
  ) {
    return fallback(
      'Confirmed displayed positions must match Global nodes exactly.',
      topology,
    );
  }
  const nodes = input.nodes.map((node) => {
    const position = positionsByKey.get(node.key);
    return position === undefined
      ? undefined
      : {
          key: node.key,
          x: position.x,
          y: position.y,
          size: node.attributes.size,
        };
  });
  if (nodes.some((node) => node === undefined)) {
    return fallback('Confirmed Global positions omitted a node.', topology);
  }
  const completeNodes = nodes.filter(
    (node): node is NonNullable<typeof node> => node !== undefined,
  );
  const screenNodes = canonicalScreenNodes(completeNodes);
  if (screenNodes === undefined) {
    return fallback(
      'Global density input contains invalid coordinates or sizes.',
      topology,
    );
  }
  const screenByKey = new Map(screenNodes.map((node) => [node.key, node]));
  const nearestDistances = nearestNeighborDistances(screenNodes);
  if (
    nearestDistances.some(
      (value) => !Number.isFinite(value) || value <= Number.EPSILON,
    )
  ) {
    return fallback(
      'Global density input contains duplicate or unusable coordinates.',
      topology,
    );
  }
  const connectedDistances: number[] = [];
  for (const edge of input.edges) {
    const source = screenByKey.get(edge.source);
    const target = screenByKey.get(edge.target);
    if (source === undefined || target === undefined) {
      return fallback('Global density edge has a missing endpoint.', topology);
    }
    const value = distance(source, target);
    if (Number.isFinite(value) && value > Number.EPSILON) {
      connectedDistances.push(value);
    }
  }
  const center = {
    x: percentile(
      screenNodes.map(({ x }) => x),
      0.5,
    ),
    y: percentile(
      screenNodes.map(({ y }) => y),
      0.5,
    ),
  };
  const radii = screenNodes.map((node) => distance(center, node));
  const representativeDiameter = median(
    screenNodes.map(({ size }) => size * 2),
  );
  const medianNearestNeighborPx = median(nearestDistances);
  const medianConnectedEdgePx =
    connectedDistances.length === 0 ? undefined : median(connectedDistances);
  const p95RadiusPx = percentile(radii, 0.95);
  const visibilityMinimumRatio = usefulViewportRequirement(screenNodes);
  if (
    ![
      representativeDiameter,
      medianNearestNeighborPx,
      p95RadiusPx,
      visibilityMinimumRatio,
    ].every(Number.isFinite) ||
    representativeDiameter <= 0 ||
    medianNearestNeighborPx <= 0 ||
    p95RadiusPx <= 0 ||
    visibilityMinimumRatio <= 0
  ) {
    return fallback(
      'Global density metrics are non-finite or unusable.',
      topology,
    );
  }
  const sqrtNodeCount = Math.sqrt(screenNodes.length);
  const nearestTargetPerDiameter =
    GLOBAL_DENSITY_TARGETS.nearestNeighborPerDiameterAtSqrtNode / sqrtNodeCount;
  const nearestNeighborSignal =
    medianNearestNeighborPx / representativeDiameter / nearestTargetPerDiameter;
  const robustExtentTarget = Math.min(
    GLOBAL_DENSITY_TARGETS.robustRadiusMaximumPx,
    GLOBAL_DENSITY_TARGETS.robustRadiusBasePx +
      GLOBAL_DENSITY_TARGETS.robustRadiusPerSqrtNodePx * sqrtNodeCount,
  );
  const robustExtentSignal = p95RadiusPx / robustExtentTarget;
  const connectedEdgeSignal =
    medianConnectedEdgePx === undefined
      ? undefined
      : medianConnectedEdgePx /
        Math.min(
          GLOBAL_DENSITY_TARGETS.connectedEdgeMaximumPx,
          GLOBAL_DENSITY_TARGETS.connectedEdgeBasePx +
            GLOBAL_DENSITY_TARGETS.connectedEdgePerSqrtNodePx * sqrtNodeCount,
        );
  const availableSignals = [
    nearestNeighborSignal,
    robustExtentSignal,
    ...(connectedEdgeSignal === undefined ? [] : [connectedEdgeSignal]),
  ];
  if (!availableSignals.every(Number.isFinite)) {
    return fallback('Global density signals are non-finite.', topology);
  }
  const rawRatio = Math.max(median(availableSignals), visibilityMinimumRatio);
  return {
    ...topology,
    ratio: round(
      clamp(
        rawRatio,
        GLOBAL_DENSITY_RATIO_BOUNDS.minimum,
        GLOBAL_DENSITY_RATIO_BOUNDS.maximum,
      ),
    ),
    nearestNeighborSignal,
    ...(connectedEdgeSignal === undefined ? {} : { connectedEdgeSignal }),
    robustExtentSignal,
    visibilityMinimumRatio,
    medianNearestNeighborPx,
    ...(medianConnectedEdgePx === undefined ? {} : { medianConnectedEdgePx }),
    p95RadiusPx,
    fallback: false,
  };
}
