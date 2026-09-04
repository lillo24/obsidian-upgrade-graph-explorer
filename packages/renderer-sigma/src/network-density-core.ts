import {
  createNormalizationFunction,
  matrixFromCamera,
  multiplyVec2,
} from 'sigma/utils';

export const NETWORK_DENSITY_REFERENCE_FRAME = {
  width: 1_200,
  height: 800,
  stagePadding: 24,
  baselineRatio: 1,
} as const;

export interface NetworkDensityNode {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface NetworkTopologyMetrics {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly componentCount: number;
  readonly isolatedNodeCount: number;
  readonly largestComponentSize: number;
}

interface KdNode {
  readonly point: NetworkDensityNode;
  readonly axis: 0 | 1;
  readonly left?: KdNode;
  readonly right?: KdNode;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function distance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function median(values: readonly number[]): number {
  return percentile(values, 0.5);
}

/**
 * Reproduces Sigma 3.0.3 auto-rescaling in a deterministic reference frame.
 * Raw uniform coordinate scaling is intentionally eliminated here, matching
 * the installed renderer rather than treating ForceAtlas2 units as pixels.
 */
export function canonicalScreenNodes(
  nodes: readonly NetworkDensityNode[],
): readonly NetworkDensityNode[] | undefined {
  if (nodes.length === 0) return undefined;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    if (
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      !Number.isFinite(node.size) ||
      node.size <= 0
    ) {
      return undefined;
    }
    minimumX = Math.min(minimumX, node.x);
    maximumX = Math.max(maximumX, node.x);
    minimumY = Math.min(minimumY, node.y);
    maximumY = Math.max(maximumY, node.y);
  }
  const extent = {
    x: [minimumX, maximumX] as [number, number],
    y: [minimumY, maximumY] as [number, number],
  };
  const normalization = createNormalizationFunction(extent);
  const graphDimensions = {
    width: maximumX - minimumX || 1,
    height: maximumY - minimumY || 1,
  };
  const matrix = matrixFromCamera(
    { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
    NETWORK_DENSITY_REFERENCE_FRAME,
    graphDimensions,
    NETWORK_DENSITY_REFERENCE_FRAME.stagePadding,
  );
  const screenNodes = nodes.map((node) => {
    const clip = multiplyVec2(matrix, normalization(node));
    return {
      ...node,
      x: ((1 + clip.x) * NETWORK_DENSITY_REFERENCE_FRAME.width) / 2,
      y: ((1 - clip.y) * NETWORK_DENSITY_REFERENCE_FRAME.height) / 2,
    };
  });
  return screenNodes.every(
    ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
  )
    ? screenNodes
    : undefined;
}

function buildKdTree(
  points: readonly NetworkDensityNode[],
  depth = 0,
): KdNode | undefined {
  if (points.length === 0) return undefined;
  const axis = (depth % 2) as 0 | 1;
  const coordinate = axis === 0 ? 'x' : 'y';
  const secondary = axis === 0 ? 'y' : 'x';
  const sorted = [...points].sort(
    (left, right) =>
      left[coordinate] - right[coordinate] ||
      left[secondary] - right[secondary] ||
      left.key.localeCompare(right.key),
  );
  const middle = Math.floor(sorted.length / 2);
  const left = buildKdTree(sorted.slice(0, middle), depth + 1);
  const right = buildKdTree(sorted.slice(middle + 1), depth + 1);
  return {
    point: sorted[middle]!,
    axis,
    ...(left === undefined ? {} : { left }),
    ...(right === undefined ? {} : { right }),
  };
}

function nearestSquared(
  tree: KdNode | undefined,
  target: NetworkDensityNode,
  best: number,
): number {
  if (tree === undefined) return best;
  const point = tree.point;
  const deltaX = target.x - point.x;
  const deltaY = target.y - point.y;
  let nextBest =
    point.key === target.key
      ? best
      : Math.min(best, deltaX * deltaX + deltaY * deltaY);
  const axisDelta = tree.axis === 0 ? deltaX : deltaY;
  const near = axisDelta <= 0 ? tree.left : tree.right;
  const far = axisDelta <= 0 ? tree.right : tree.left;
  nextBest = nearestSquared(near, target, nextBest);
  return axisDelta * axisDelta < nextBest
    ? nearestSquared(far, target, nextBest)
    : nextBest;
}

/**
 * Exact deterministic nearest-neighbor distances. The balanced k-d tree avoids
 * the O(N²) production scan used by the bounded Focus renderer.
 */
export function nearestNeighborDistances(
  nodes: readonly NetworkDensityNode[],
): readonly number[] {
  if (nodes.length < 2) return [];
  const tree = buildKdTree(nodes);
  return nodes.map((node) =>
    Math.sqrt(nearestSquared(tree, node, Number.POSITIVE_INFINITY)),
  );
}

export function topologyMetrics(
  nodeKeys: readonly string[],
  edges: readonly { readonly source: string; readonly target: string }[],
): NetworkTopologyMetrics | undefined {
  const parent = new Map(nodeKeys.map((key) => [key, key]));
  const sizes = new Map(nodeKeys.map((key) => [key, 1]));
  const degrees = new Map(nodeKeys.map((key) => [key, 0]));
  if (parent.size !== nodeKeys.length) return undefined;
  const find = (key: string): string => {
    let root = parent.get(key)!;
    while (root !== parent.get(root)) root = parent.get(root)!;
    let current = key;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  };
  for (const edge of edges) {
    if (!parent.has(edge.source) || !parent.has(edge.target)) return undefined;
    degrees.set(edge.source, degrees.get(edge.source)! + 1);
    degrees.set(edge.target, degrees.get(edge.target)! + 1);
    const sourceRoot = find(edge.source);
    const targetRoot = find(edge.target);
    if (sourceRoot === targetRoot) continue;
    const sourceSize = sizes.get(sourceRoot)!;
    const targetSize = sizes.get(targetRoot)!;
    const [large, small] =
      sourceSize >= targetSize
        ? [sourceRoot, targetRoot]
        : [targetRoot, sourceRoot];
    parent.set(small, large);
    sizes.set(large, sourceSize + targetSize);
  }
  const componentSizes = new Map<string, number>();
  for (const key of nodeKeys) {
    const root = find(key);
    componentSizes.set(root, (componentSizes.get(root) ?? 0) + 1);
  }
  return {
    nodeCount: nodeKeys.length,
    edgeCount: edges.length,
    componentCount: componentSizes.size,
    isolatedNodeCount: [...degrees.values()].filter((degree) => degree === 0)
      .length,
    largestComponentSize:
      componentSizes.size === 0 ? 0 : Math.max(...componentSizes.values()),
  };
}
