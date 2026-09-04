import type {
  LocalConvergenceDistribution,
  LocalConvergenceMovement,
  LocalConvergencePolicy,
  LocalLayoutEdge,
  LocalLayoutPosition,
} from './local-types';

export const LOCAL_CONVERGENCE_POLICY_VERSION =
  'local-fa2-convergence-v1' as const;
export const LOCAL_CONVERGENCE_BATCH_ITERATIONS = 32 as const;
export const LOCAL_CONVERGENCE_ALL_P90_THRESHOLD = 0.00512 as const;
export const LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD = 0.01024 as const;
export const LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED = 3 as const;
export const LOCAL_CONVERGENCE_SCALE_FLOOR = 1e-6 as const;
export const LOCAL_CONVERGENCE_MAX_WALL_TIME_MS = 2_000;

interface Point {
  readonly x: number;
  readonly y: number;
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Local convergence ${label} must be finite.`);
  }
}

function positionMap(
  positions: readonly LocalLayoutPosition[],
  label: string,
): ReadonlyMap<string, LocalLayoutPosition> {
  if (positions.length === 0) {
    throw new Error(`Local convergence ${label} frame requires a node.`);
  }
  const byKey = new Map<string, LocalLayoutPosition>();
  for (const position of positions) {
    if (position.key.length === 0 || byKey.has(position.key)) {
      throw new Error(
        `Local convergence ${label} frame has an invalid or duplicate node key.`,
      );
    }
    finite(position.x, `${label} x for ${position.key}`);
    finite(position.y, `${label} y for ${position.key}`);
    byKey.set(position.key, position);
  }
  return byKey;
}

export function convergencePercentile(
  values: readonly number[],
  fraction: number,
): number {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('Local convergence percentile must be from 0 to 1.');
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

function distribution(values: readonly number[]): LocalConvergenceDistribution {
  return values.length === 0
    ? { count: 0, p50: null, p90: null, maximum: null }
    : {
        count: values.length,
        p50: convergencePercentile(values, 0.5),
        p90: convergencePercentile(values, 0.9),
        maximum: Math.max(...values),
      };
}

/** Previous-frame RMS radius; the floor keeps coincident seeds measurable. */
export function convergenceRmsRadius(
  positions: readonly LocalLayoutPosition[],
  origin: Point,
): number {
  if (positions.length === 0) {
    throw new Error('Local convergence RMS radius requires a node.');
  }
  let squaredDistance = 0;
  for (const position of positions) {
    finite(position.x, `RMS x for ${position.key}`);
    finite(position.y, `RMS y for ${position.key}`);
    squaredDistance +=
      (position.x - origin.x) ** 2 + (position.y - origin.y) ** 2;
  }
  return Math.max(
    LOCAL_CONVERGENCE_SCALE_FLOOR,
    Math.sqrt(squaredDistance / positions.length),
  );
}

/** Counts undirected unique neighbors; reciprocal and parallel edges count once. */
export function createLocalConvergenceDegreeIndex(
  nodeKeys: readonly string[],
  edges: readonly Pick<LocalLayoutEdge, 'source' | 'target'>[],
): ReadonlyMap<string, number> {
  const neighbors = new Map<string, Set<string>>();
  for (const key of nodeKeys) {
    if (key.length === 0 || neighbors.has(key)) {
      throw new Error(
        'Local convergence degree index has an invalid or duplicate node key.',
      );
    }
    neighbors.set(key, new Set());
  }
  if (neighbors.size === 0) {
    throw new Error('Local convergence degree index requires a node.');
  }
  for (const edge of edges) {
    const source = neighbors.get(edge.source);
    const target = neighbors.get(edge.target);
    if (source === undefined || target === undefined) {
      throw new Error(
        `Local convergence edge ${edge.source} → ${edge.target} has a missing endpoint.`,
      );
    }
    source.add(edge.target);
    target.add(edge.source);
  }
  return new Map(
    [...neighbors].map(([key, adjacent]) => [key, adjacent.size] as const),
  );
}

export function rootAlignLocalConvergenceFrame(
  positions: readonly LocalLayoutPosition[],
  rootKey: string,
): readonly LocalLayoutPosition[] {
  const byKey = positionMap(positions, 'root-alignment');
  const root = byKey.get(rootKey);
  if (root === undefined) {
    throw new Error(`Local convergence frame omitted root ${rootKey}.`);
  }
  return positions
    .map((position) => ({
      key: position.key,
      x: position.key === rootKey ? 0 : position.x - root.x,
      y: position.key === rootKey ? 0 : position.y - root.y,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

/**
 * Measures endpoint movement after removing only root translation. Rotation and
 * scale changes remain visible, and the previous raw frame supplies the scale.
 */
export function measureLocalConvergenceMovement(input: {
  readonly before: readonly LocalLayoutPosition[];
  readonly after: readonly LocalLayoutPosition[];
  readonly rootKey: string;
  readonly degreeByKey: ReadonlyMap<string, number>;
}): LocalConvergenceMovement {
  const beforeByKey = positionMap(input.before, 'before');
  const afterByKey = positionMap(input.after, 'after');
  if (beforeByKey.size !== afterByKey.size) {
    throw new Error('Local convergence frames have different node counts.');
  }
  for (const key of beforeByKey.keys()) {
    if (!afterByKey.has(key)) {
      throw new Error(`Local convergence after frame omitted node ${key}.`);
    }
  }
  if (input.degreeByKey.size !== beforeByKey.size) {
    throw new Error('Local convergence degree index has the wrong node count.');
  }
  const beforeRoot = beforeByKey.get(input.rootKey);
  const afterRoot = afterByKey.get(input.rootKey);
  if (beforeRoot === undefined || afterRoot === undefined) {
    throw new Error(`Local convergence frame omitted root ${input.rootKey}.`);
  }
  const scale = convergenceRmsRadius(input.before, beforeRoot);
  const all: number[] = [];
  const degree0: number[] = [];
  const degree1: number[] = [];
  const degree2Plus: number[] = [];
  const lowDegree: number[] = [];
  for (const [key, before] of beforeByKey) {
    const after = afterByKey.get(key)!;
    const degree = input.degreeByKey.get(key);
    if (degree === undefined || !Number.isSafeInteger(degree) || degree < 0) {
      throw new Error(`Local convergence degree is invalid for node ${key}.`);
    }
    const movement =
      Math.hypot(
        before.x - beforeRoot.x - (after.x - afterRoot.x),
        before.y - beforeRoot.y - (after.y - afterRoot.y),
      ) / scale;
    all.push(movement);
    if (degree === 0) degree0.push(movement);
    else if (degree === 1) degree1.push(movement);
    else degree2Plus.push(movement);
    if (degree <= 1) lowDegree.push(movement);
  }
  return {
    scale,
    all: distribution(all),
    degree0: distribution(degree0),
    degree1: distribution(degree1),
    degree2Plus: distribution(degree2Plus),
    lowDegree: distribution(lowDegree),
  };
}

export function localConvergenceMaxIterations(nodeCount: number): number {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 1) {
    throw new Error('Local convergence node count must be a positive integer.');
  }
  return nodeCount <= 100 ? 1_000 : nodeCount <= 500 ? 600 : 240;
}

export function createLocalConvergencePolicy(
  nodeCount: number,
): LocalConvergencePolicy {
  return {
    version: LOCAL_CONVERGENCE_POLICY_VERSION,
    batchIterations: LOCAL_CONVERGENCE_BATCH_ITERATIONS,
    allP90Threshold: LOCAL_CONVERGENCE_ALL_P90_THRESHOLD,
    lowDegreeMaximumThreshold: LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD,
    stableBatchesRequired: LOCAL_CONVERGENCE_STABLE_BATCHES_REQUIRED,
    maxIterations: localConvergenceMaxIterations(nodeCount),
    rootAlignment: 'root-translation-v1',
    scaleNormalization: 'previous-root-rms-v1',
    scaleFloor: LOCAL_CONVERGENCE_SCALE_FLOOR,
  };
}

export function validateLocalConvergencePolicy(
  policy: LocalConvergencePolicy,
  nodeCount: number,
): void {
  const expected = createLocalConvergencePolicy(nodeCount);
  if (Object.keys(policy).length !== Object.keys(expected).length) {
    throw new Error(
      `Local convergence policy does not match ${LOCAL_CONVERGENCE_POLICY_VERSION}.`,
    );
  }
  for (const key of Object.keys(expected) as (keyof LocalConvergencePolicy)[]) {
    if (policy[key] !== expected[key]) {
      throw new Error(
        `Local convergence policy ${key} does not match ${LOCAL_CONVERGENCE_POLICY_VERSION}.`,
      );
    }
  }
}

export function localConvergenceBatchIsStable(
  movement: LocalConvergenceMovement,
): boolean {
  if (
    movement.all.p90 === null ||
    movement.all.p90 > LOCAL_CONVERGENCE_ALL_P90_THRESHOLD
  ) {
    return false;
  }
  return (
    movement.lowDegree.count === 0 ||
    (movement.lowDegree.maximum !== null &&
      movement.lowDegree.maximum <=
        LOCAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD)
  );
}

export function nextLocalConvergenceStableBatchCount(input: {
  readonly previousStableBatches: number;
  readonly batchIterations: number;
  readonly movement: LocalConvergenceMovement;
}): number {
  if (
    !Number.isSafeInteger(input.previousStableBatches) ||
    input.previousStableBatches < 0
  ) {
    throw new Error('Local convergence stable-batch count is invalid.');
  }
  if (input.batchIterations !== LOCAL_CONVERGENCE_BATCH_ITERATIONS) {
    return input.previousStableBatches;
  }
  return localConvergenceBatchIsStable(input.movement)
    ? input.previousStableBatches + 1
    : 0;
}

export function localConvergenceBatchPlan(
  nodeCount: number,
): readonly number[] {
  const cap = localConvergenceMaxIterations(nodeCount);
  const batches: number[] = [];
  let completed = 0;
  while (completed < cap) {
    const iterations = Math.min(
      LOCAL_CONVERGENCE_BATCH_ITERATIONS,
      cap - completed,
    );
    batches.push(iterations);
    completed += iterations;
  }
  return batches;
}
