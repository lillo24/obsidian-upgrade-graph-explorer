import type {
  GraphFlowEdge,
  GraphFlowNode,
  LocalStructuredLayoutCache as LocalStructuredLayoutCacheContract,
  LocalStructuredLayoutPosition,
  RendererGraph,
} from './types';

const LOCAL_STRUCTURED_LAYOUT_VERSION = 2;
const DEFAULT_CACHE_LIMIT = 12;
// Clear gaps between actual fixed rectangles, including outline clearance.
const RANK_GAP = 58;
const LANE_GAP = 24;

function fixedDimensions(node: GraphFlowNode): {
  readonly width: number;
  readonly height: number;
} {
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  if (
    width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      `Local Structured node ${node.id} is missing finite fixed dimensions.`,
    );
  }
  return { width, height };
}

/**
 * Exact, private-data-safe key for one bounded Local schematic. It deliberately
 * excludes labels, paths, queries, camera state, selection, and source text.
 */
export function localStructuredLayoutFingerprint(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
): string {
  const nodeParts = [...nodes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const { height, width } = fixedDimensions(node);
      return JSON.stringify([node.id, width, height]);
    });
  const edgeParts = [...edges]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((edge) =>
      JSON.stringify([
        edge.id,
        edge.source,
        edge.target,
        edge.data?.kind ?? 'reference',
      ]),
    );
  return `local-structured:${LOCAL_STRUCTURED_LAYOUT_VERSION}:n[${nodeParts.join(',')}]:e[${edgeParts.join(',')}]`;
}

function normalizePositionsAtRoot(
  positions: ReadonlyMap<string, LocalStructuredLayoutPosition>,
  rootNodeId: string,
): ReadonlyMap<string, LocalStructuredLayoutPosition> {
  const root = positions.get(rootNodeId);
  if (root === undefined) {
    throw new Error(`Local Structured root node ${rootNodeId} is missing.`);
  }
  return new Map(
    [...positions].map(([id, position]) => [
      id,
      {
        id,
        x: position.x - root.x,
        y: position.y - root.y,
      },
    ]),
  );
}

function graphWithPositions(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  positions: readonly LocalStructuredLayoutPosition[],
  rootNodeId: string,
  layoutWarning: string | null,
): RendererGraph {
  const raw = new Map<string, LocalStructuredLayoutPosition>();
  for (const position of positions) {
    if (
      raw.has(position.id) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      throw new Error(
        `Local Structured positions are invalid for node ${position.id}.`,
      );
    }
    raw.set(position.id, position);
  }
  if (raw.size !== nodes.length || nodes.some((node) => !raw.has(node.id))) {
    throw new Error(
      'Local Structured positions must cover every mapped node exactly once.',
    );
  }
  const normalized = normalizePositionsAtRoot(raw, rootNodeId);
  return {
    nodes: nodes.map((node) => {
      const position = normalized.get(node.id);
      if (position === undefined) {
        throw new Error(`Local Structured position omitted node ${node.id}.`);
      }
      return { ...node, position: { x: position.x, y: position.y } };
    }),
    edges: [...edges],
    layoutWarning,
  };
}

/** Deterministic O(n+e+sorting) dimension-packed seed shown before W3 returns. */
export function seedLocalStructuredGraph(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  rootNodeId: string,
): RendererGraph {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (!nodeById.has(rootNodeId)) {
    throw new Error(`Local Structured root node ${rootNodeId} is missing.`);
  }
  const entityIds = new Set(
    nodes.filter((node) => node.type === 'entity').map((node) => node.id),
  );
  const hierarchyBySource = new Map<string, string[]>();
  const incomingByTarget = new Map<string, string>();
  for (const edge of edges) {
    if (!incomingByTarget.has(edge.target)) {
      incomingByTarget.set(edge.target, edge.source);
    }
    if (
      edge.data?.kind !== 'hierarchy' ||
      !entityIds.has(edge.source) ||
      !entityIds.has(edge.target)
    ) {
      continue;
    }
    const children = hierarchyBySource.get(edge.source) ?? [];
    children.push(edge.target);
    hierarchyBySource.set(edge.source, children);
  }
  const depthById = new Map<string, number>([[rootNodeId, 0]]);
  const queue = [rootNodeId];
  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index]!;
    const depth = depthById.get(source)!;
    for (const target of hierarchyBySource.get(source) ?? []) {
      if (depthById.has(target)) continue;
      depthById.set(target, depth + 1);
      queue.push(target);
    }
  }
  for (const node of nodes) {
    const id = node.id;
    if (node.type !== 'entity') continue;
    if (depthById.has(id)) continue;
    const incoming = incomingByTarget.get(id);
    depthById.set(
      id,
      incoming === undefined ? 1 : (depthById.get(incoming) ?? 0) + 1,
    );
  }
  for (const node of nodes) {
    if (node.type === 'entity') continue;
    const incoming = incomingByTarget.get(node.id);
    depthById.set(
      node.id,
      incoming === undefined ? 1 : (depthById.get(incoming) ?? 0) + 1,
    );
  }

  const idsByDepth = new Map<number, string[]>();
  let maximumDepth = 0;
  for (const node of nodes) {
    const depth = depthById.get(node.id) ?? 1;
    maximumDepth = Math.max(maximumDepth, depth);
    const ids = idsByDepth.get(depth) ?? [];
    ids.push(node.id);
    idsByDepth.set(depth, ids);
  }
  const positions: LocalStructuredLayoutPosition[] = [];
  let columnX = 0;
  for (let depth = 0; depth <= maximumDepth; depth += 1) {
    const ids = idsByDepth.get(depth) ?? [];
    const ordered =
      depth === 0 && ids.includes(rootNodeId)
        ? [rootNodeId, ...ids.filter((id) => id !== rootNodeId)]
        : [...ids].sort();
    let columnWidth = 0;
    let packedHeight = Math.max(0, ordered.length - 1) * LANE_GAP;
    for (const id of ordered) {
      const dimensions = fixedDimensions(nodeById.get(id)!);
      columnWidth = Math.max(columnWidth, dimensions.width);
      packedHeight += dimensions.height;
    }
    let y = -packedHeight / 2;
    ordered.forEach((id) => {
      positions.push({
        id,
        x: columnX,
        y,
      });
      y += fixedDimensions(nodeById.get(id)!).height + LANE_GAP;
    });
    columnX += columnWidth + RANK_GAP;
  }
  return graphWithPositions(nodes, edges, positions, rootNodeId, null);
}

export function applyLocalStructuredPositions(
  nodes: readonly GraphFlowNode[],
  edges: readonly GraphFlowEdge[],
  positions: readonly LocalStructuredLayoutPosition[],
  rootNodeId: string,
  layoutWarning: string | null = null,
): RendererGraph {
  return graphWithPositions(nodes, edges, positions, rootNodeId, layoutWarning);
}

export function localStructuredGraphPositions(
  graph: RendererGraph,
): readonly LocalStructuredLayoutPosition[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
  }));
}

export class LocalStructuredLayoutCache implements LocalStructuredLayoutCacheContract {
  private readonly values = new Map<
    string,
    readonly LocalStructuredLayoutPosition[]
  >();

  constructor(private readonly limit = DEFAULT_CACHE_LIMIT) {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('Local Structured layout cache limit must be positive.');
    }
  }

  get(
    fingerprint: string,
  ): readonly LocalStructuredLayoutPosition[] | undefined {
    const value = this.values.get(fingerprint);
    if (value === undefined) return undefined;
    return value.map((position) => ({ ...position }));
  }

  set(
    fingerprint: string,
    positions: readonly LocalStructuredLayoutPosition[],
  ): void {
    const copy = positions.map((position) => ({ ...position }));
    this.values.delete(fingerprint);
    this.values.set(fingerprint, copy);
    while (this.values.size > this.limit) {
      const oldest = this.values.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.values.delete(oldest);
    }
  }
}
