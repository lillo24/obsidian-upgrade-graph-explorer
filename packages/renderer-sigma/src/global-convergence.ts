import type {
  GlobalConvergenceDistribution,
  GlobalConvergenceMovement,
  GlobalConvergencePolicy,
  GlobalLayoutEdge,
  GlobalLayoutPosition,
} from './types';

export const GLOBAL_CONVERGENCE_POLICY_VERSION =
  'global-fa2-folder-convergence-v1' as const;
export const GLOBAL_CONVERGENCE_BATCH_ITERATIONS = 32 as const;
export const GLOBAL_CONVERGENCE_ALL_P90_THRESHOLD = 0.00512 as const;
export const GLOBAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD = 0.01024 as const;
export const GLOBAL_CONVERGENCE_CENTROID_DRIFT_THRESHOLD = 0.00512 as const;
export const GLOBAL_CONVERGENCE_STABLE_MACRO_STEPS_REQUIRED = 3 as const;
export const GLOBAL_CONVERGENCE_SCALE_FLOOR = 1e-6 as const;
export const GLOBAL_CONVERGENCE_MAX_WALL_TIME_MS = 5_000 as const;

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Global convergence ${label} must be finite.`);
  }
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function distribution(
  values: readonly number[],
): GlobalConvergenceDistribution {
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
  positions: readonly GlobalLayoutPosition[],
  label: string,
): ReadonlyMap<string, GlobalLayoutPosition> {
  if (positions.length === 0) {
    throw new Error(`Global convergence ${label} frame requires a node.`);
  }
  const byKey = new Map<string, GlobalLayoutPosition>();
  for (const position of positions) {
    if (position.key.length === 0 || byKey.has(position.key)) {
      throw new Error(
        `Global convergence ${label} frame has an invalid or duplicate node key.`,
      );
    }
    finite(position.x, `${label} x for ${position.key}`);
    finite(position.y, `${label} y for ${position.key}`);
    byKey.set(position.key, position);
  }
  return byKey;
}

function centroid(positions: readonly GlobalLayoutPosition[]): {
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

export function globalConvergenceMaxIterations(nodeCount: number): number {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 0) {
    throw new Error(
      'Global convergence node count must be a non-negative integer.',
    );
  }
  if (nodeCount === 0) return 0;
  return nodeCount <= 1_000 ? 640 : nodeCount <= 5_000 ? 120 : 80;
}

export function createGlobalConvergencePolicy(
  nodeCount: number,
): GlobalConvergencePolicy {
  return {
    version: GLOBAL_CONVERGENCE_POLICY_VERSION,
    batchIterations: GLOBAL_CONVERGENCE_BATCH_ITERATIONS,
    allP90Threshold: GLOBAL_CONVERGENCE_ALL_P90_THRESHOLD,
    lowDegreeMaximumThreshold: GLOBAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD,
    normalizedCentroidDriftThreshold:
      GLOBAL_CONVERGENCE_CENTROID_DRIFT_THRESHOLD,
    stableMacroStepsRequired: GLOBAL_CONVERGENCE_STABLE_MACRO_STEPS_REQUIRED,
    maxIterations: globalConvergenceMaxIterations(nodeCount),
    centroidAlignment: 'centroid-translation-v1',
    scaleNormalization: 'previous-centroid-rms-v1',
    scaleFloor: GLOBAL_CONVERGENCE_SCALE_FLOOR,
    maxWallTimeMs: GLOBAL_CONVERGENCE_MAX_WALL_TIME_MS,
  };
}

export function validateGlobalConvergencePolicy(
  policy: GlobalConvergencePolicy,
  nodeCount: number,
): void {
  const expected = createGlobalConvergencePolicy(nodeCount);
  if (Object.keys(policy).length !== Object.keys(expected).length) {
    throw new Error(
      `Global convergence policy does not match ${GLOBAL_CONVERGENCE_POLICY_VERSION}.`,
    );
  }
  for (const key of Object.keys(
    expected,
  ) as (keyof GlobalConvergencePolicy)[]) {
    if (policy[key] !== expected[key]) {
      throw new Error(
        `Global convergence policy ${key} does not match ${GLOBAL_CONVERGENCE_POLICY_VERSION}.`,
      );
    }
  }
}

/** Counts undirected unique neighbors; reciprocal and parallel edges count once. */
export function createGlobalConvergenceDegreeIndex(
  nodeKeys: readonly string[],
  edges: readonly Pick<GlobalLayoutEdge, 'source' | 'target'>[],
): ReadonlyMap<string, number> {
  const neighbors = new Map<string, Set<string>>();
  for (const key of nodeKeys) {
    if (key.length === 0 || neighbors.has(key)) {
      throw new Error(
        'Global convergence degree index has an invalid or duplicate node key.',
      );
    }
    neighbors.set(key, new Set());
  }
  for (const edge of edges) {
    const source = neighbors.get(edge.source);
    const target = neighbors.get(edge.target);
    if (source === undefined || target === undefined) {
      throw new Error(
        `Global convergence edge ${edge.source} → ${edge.target} has a missing endpoint.`,
      );
    }
    source.add(edge.target);
    target.add(edge.source);
  }
  return new Map(
    [...neighbors].map(([key, adjacent]) => [key, adjacent.size] as const),
  );
}

/** Removes only centroid translation; rotation and scale changes remain visible. */
export function measureGlobalConvergenceMovement(input: {
  readonly before: readonly GlobalLayoutPosition[];
  readonly after: readonly GlobalLayoutPosition[];
  readonly degreeByKey: ReadonlyMap<string, number>;
}): GlobalConvergenceMovement {
  const beforeByKey = positionMap(input.before, 'before');
  const afterByKey = positionMap(input.after, 'after');
  if (
    beforeByKey.size !== afterByKey.size ||
    input.degreeByKey.size !== beforeByKey.size
  ) {
    throw new Error('Global convergence frames have inconsistent node counts.');
  }
  const beforeValues = [...beforeByKey.values()];
  const afterValues = [...afterByKey.values()];
  const beforeCentroid = centroid(beforeValues);
  const afterCentroid = centroid(afterValues);
  const scale = Math.max(
    GLOBAL_CONVERGENCE_SCALE_FLOOR,
    Math.sqrt(
      beforeValues.reduce(
        (sum, value) =>
          sum +
          (value.x - beforeCentroid.x) ** 2 +
          (value.y - beforeCentroid.y) ** 2,
        0,
      ) / beforeValues.length,
    ),
  );
  const all: number[] = [];
  const degree0: number[] = [];
  const degree1: number[] = [];
  const degree2Plus: number[] = [];
  const lowDegree: number[] = [];
  for (const [key, before] of beforeByKey) {
    const after = afterByKey.get(key);
    const degree = input.degreeByKey.get(key);
    if (after === undefined || degree === undefined) {
      throw new Error(`Global convergence after frame omitted node ${key}.`);
    }
    const movement =
      Math.hypot(
        before.x - beforeCentroid.x - (after.x - afterCentroid.x),
        before.y - beforeCentroid.y - (after.y - afterCentroid.y),
      ) / scale;
    all.push(movement);
    if (degree === 0) degree0.push(movement);
    else if (degree === 1) degree1.push(movement);
    else degree2Plus.push(movement);
    if (degree <= 1) lowDegree.push(movement);
  }
  const rawCentroidDrift = Math.hypot(
    afterCentroid.x - beforeCentroid.x,
    afterCentroid.y - beforeCentroid.y,
  );
  return {
    scale,
    all: distribution(all),
    degree0: distribution(degree0),
    degree1: distribution(degree1),
    degree2Plus: distribution(degree2Plus),
    lowDegree: distribution(lowDegree),
    rawCentroidDrift,
    normalizedCentroidDrift: rawCentroidDrift / scale,
  };
}

export function globalConvergenceMacroStepIsStable(
  movement: GlobalConvergenceMovement,
): boolean {
  return (
    movement.all.p90 !== null &&
    movement.all.p90 <= GLOBAL_CONVERGENCE_ALL_P90_THRESHOLD &&
    (movement.lowDegree.count === 0 ||
      (movement.lowDegree.maximum !== null &&
        movement.lowDegree.maximum <=
          GLOBAL_CONVERGENCE_LOW_DEGREE_MAXIMUM_THRESHOLD)) &&
    movement.normalizedCentroidDrift <=
      GLOBAL_CONVERGENCE_CENTROID_DRIFT_THRESHOLD
  );
}

export function nextGlobalConvergenceStableMacroStepCount(input: {
  readonly previousStableMacroSteps: number;
  readonly batchIterations: number;
  readonly movement: GlobalConvergenceMovement;
}): number {
  if (input.batchIterations !== GLOBAL_CONVERGENCE_BATCH_ITERATIONS) {
    return input.previousStableMacroSteps;
  }
  return globalConvergenceMacroStepIsStable(input.movement)
    ? input.previousStableMacroSteps + 1
    : 0;
}

export function globalConvergenceBatchPlan(
  nodeCount: number,
): readonly number[] {
  const cap = globalConvergenceMaxIterations(nodeCount);
  const batches: number[] = [];
  for (let completed = 0; completed < cap;) {
    const iterations = Math.min(
      GLOBAL_CONVERGENCE_BATCH_ITERATIONS,
      cap - completed,
    );
    batches.push(iterations);
    completed += iterations;
  }
  return batches;
}
