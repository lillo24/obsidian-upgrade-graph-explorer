export interface ConvergencePosition {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

export interface ConvergenceEdge {
  readonly source: string;
  readonly target: string;
}

export type ConvergenceAlignment =
  | { readonly kind: 'root'; readonly rootKey: string }
  | { readonly kind: 'centroid' };

export interface MovementDistribution {
  readonly count: number;
  readonly p50: number | null;
  readonly p90: number | null;
  readonly maximum: number | null;
}

export interface DisplacementMetrics {
  readonly nodeCount: number;
  readonly scale: number;
  readonly rawCentroidDrift: number;
  readonly normalizedCentroidDrift: number;
  readonly rawAnchorDrift: number | null;
  readonly normalizedAnchorDrift: number | null;
  readonly all: MovementDistribution;
  readonly degree0: MovementDistribution;
  readonly degree1: MovementDistribution;
  readonly degree2Plus: MovementDistribution;
  readonly lowDegree: MovementDistribution;
}

export interface LayoutQualityMetrics {
  readonly scale: number;
  readonly normalizedEdgeLength: MovementDistribution;
  readonly nearCoincidentPairs: number;
  readonly nonFiniteCoordinates: number;
}

const RMS_SCALE_FLOOR = 1e-6;
const NEAR_COINCIDENT_NORMALIZED_DISTANCE = 0.01;

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Convergence ${label} must be finite.`);
  }
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('Convergence percentile fraction must be from 0 to 1.');
  }
  if (values.length === 0) return 0;
  for (const value of values) finite(value, 'percentile value');
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function distribution(values: readonly number[]): MovementDistribution {
  return values.length === 0
    ? { count: 0, p50: null, p90: null, maximum: null }
    : {
        count: values.length,
        p50: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        maximum: Math.max(...values),
      };
}

function positionMap(
  positions: readonly ConvergencePosition[],
  label: string,
): ReadonlyMap<string, ConvergencePosition> {
  if (positions.length === 0) {
    throw new Error(`Convergence ${label} frame requires at least one node.`);
  }
  const result = new Map<string, ConvergencePosition>();
  for (const position of positions) {
    if (position.key.length === 0 || result.has(position.key)) {
      throw new Error(
        `Convergence ${label} frame has an invalid or duplicate node key.`,
      );
    }
    finite(position.x, `${label} x for ${position.key}`);
    finite(position.y, `${label} y for ${position.key}`);
    result.set(position.key, position);
  }
  return result;
}

function centroid(positions: readonly ConvergencePosition[]): {
  readonly x: number;
  readonly y: number;
} {
  let x = 0;
  let y = 0;
  for (const position of positions) {
    x += position.x;
    y += position.y;
  }
  return { x: x / positions.length, y: y / positions.length };
}

function originFor(
  positions: readonly ConvergencePosition[],
  byKey: ReadonlyMap<string, ConvergencePosition>,
  alignment: ConvergenceAlignment,
): { readonly x: number; readonly y: number } {
  if (alignment.kind === 'centroid') return centroid(positions);
  const root = byKey.get(alignment.rootKey);
  if (root === undefined) {
    throw new Error(
      `Convergence root alignment omitted node ${alignment.rootKey}.`,
    );
  }
  return root;
}

function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/**
 * Uses the previous accepted frame's RMS radius as the deterministic movement
 * denominator. The floor handles coincident seed frames without hiding them.
 */
export function rmsRadius(
  positions: readonly ConvergencePosition[],
  origin = centroid(positions),
): number {
  if (positions.length === 0) {
    throw new Error('Convergence RMS radius requires at least one node.');
  }
  let squared = 0;
  for (const position of positions) {
    finite(position.x, `RMS x for ${position.key}`);
    finite(position.y, `RMS y for ${position.key}`);
    squared += (position.x - origin.x) ** 2 + (position.y - origin.y) ** 2;
  }
  return Math.max(RMS_SCALE_FLOOR, Math.sqrt(squared / positions.length));
}

function degrees(
  nodeKeys: ReadonlySet<string>,
  edges: readonly ConvergenceEdge[],
): ReadonlyMap<string, number> {
  const neighbors = new Map(
    [...nodeKeys].map((key) => [key, new Set<string>()] as const),
  );
  for (const edge of edges) {
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) {
      throw new Error(
        `Convergence edge ${edge.source} → ${edge.target} has a missing endpoint.`,
      );
    }
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }
  return new Map(
    [...neighbors].map(([key, adjacent]) => [key, adjacent.size] as const),
  );
}

export function measureDisplacement(input: {
  readonly before: readonly ConvergencePosition[];
  readonly after: readonly ConvergencePosition[];
  readonly edges: readonly ConvergenceEdge[];
  readonly alignment: ConvergenceAlignment;
}): DisplacementMetrics {
  const beforeByKey = positionMap(input.before, 'before');
  const afterByKey = positionMap(input.after, 'after');
  if (beforeByKey.size !== afterByKey.size) {
    throw new Error('Convergence frames have different node counts.');
  }
  for (const key of beforeByKey.keys()) {
    if (!afterByKey.has(key)) {
      throw new Error(`Convergence after frame omitted node ${key}.`);
    }
  }
  const beforeOrigin = originFor(input.before, beforeByKey, input.alignment);
  const afterOrigin = originFor(input.after, afterByKey, input.alignment);
  const beforeCentroid = centroid(input.before);
  const afterCentroid = centroid(input.after);
  const scale = rmsRadius(input.before, beforeOrigin);
  const degreeByKey = degrees(new Set(beforeByKey.keys()), input.edges);
  const all: number[] = [];
  const degree0: number[] = [];
  const degree1: number[] = [];
  const degree2Plus: number[] = [];
  const lowDegree: number[] = [];
  for (const [key, before] of beforeByKey) {
    const after = afterByKey.get(key)!;
    const movement =
      Math.hypot(
        before.x - beforeOrigin.x - (after.x - afterOrigin.x),
        before.y - beforeOrigin.y - (after.y - afterOrigin.y),
      ) / scale;
    all.push(movement);
    const degree = degreeByKey.get(key)!;
    if (degree === 0) degree0.push(movement);
    else if (degree === 1) degree1.push(movement);
    else degree2Plus.push(movement);
    if (degree <= 1) lowDegree.push(movement);
  }
  const rawCentroidDrift = distance(beforeCentroid, afterCentroid);
  const rawAnchorDrift =
    input.alignment.kind === 'root'
      ? distance(beforeOrigin, afterOrigin)
      : null;
  return {
    nodeCount: beforeByKey.size,
    scale,
    rawCentroidDrift,
    normalizedCentroidDrift: rawCentroidDrift / scale,
    rawAnchorDrift,
    normalizedAnchorDrift:
      rawAnchorDrift === null ? null : rawAnchorDrift / scale,
    all: distribution(all),
    degree0: distribution(degree0),
    degree1: distribution(degree1),
    degree2Plus: distribution(degree2Plus),
    lowDegree: distribution(lowDegree),
  };
}

export function measureLayoutQuality(input: {
  readonly positions: readonly ConvergencePosition[];
  readonly edges: readonly ConvergenceEdge[];
  readonly alignment: ConvergenceAlignment;
}): LayoutQualityMetrics {
  const byKey = positionMap(input.positions, 'quality');
  const origin = originFor(input.positions, byKey, input.alignment);
  const scale = rmsRadius(input.positions, origin);
  const edgeLengths = input.edges.map((edge) => {
    const source = byKey.get(edge.source);
    const target = byKey.get(edge.target);
    if (source === undefined || target === undefined) {
      throw new Error(
        `Convergence quality edge ${edge.source} → ${edge.target} has a missing endpoint.`,
      );
    }
    return distance(source, target) / scale;
  });
  let nearCoincidentPairs = 0;
  for (let left = 0; left < input.positions.length; left += 1) {
    for (let right = left + 1; right < input.positions.length; right += 1) {
      if (
        distance(input.positions[left]!, input.positions[right]!) / scale <
        NEAR_COINCIDENT_NORMALIZED_DISTANCE
      ) {
        nearCoincidentPairs += 1;
      }
    }
  }
  return {
    scale,
    normalizedEdgeLength: distribution(edgeLengths),
    nearCoincidentPairs,
    nonFiniteCoordinates: 0,
  };
}

export function roundEvidence(value: number | null, digits = 8): number | null {
  return value === null ? null : Number(value.toFixed(digits));
}

export function roundDistribution(
  value: MovementDistribution,
  digits = 8,
): MovementDistribution {
  return {
    count: value.count,
    p50: roundEvidence(value.p50, digits),
    p90: roundEvidence(value.p90, digits),
    maximum: roundEvidence(value.maximum, digits),
  };
}
