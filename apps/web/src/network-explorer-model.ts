import {
  entityDisplayName,
  type InspectionWorkspace,
} from '@icarus-graph-explorer/explorer-inspection';
import type {
  ProjectedEntityNode,
  ProjectedNode,
  ProjectionEdgeId,
  ProjectionNodeId,
  ReferenceResolutionStatus,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

export const NETWORK_EXPLORER_ROW_HEIGHT = 56;
export const NETWORK_EXPLORER_OVERSCAN = 6;

export type NetworkExplorerRelationship =
  'parent' | 'child' | 'outgoing' | 'incoming';

export interface NetworkExplorerAdjacency {
  readonly id: string;
  readonly edgeId: ProjectionEdgeId;
  readonly parentNodeId: ProjectionNodeId;
  readonly targetNodeId: ProjectionNodeId;
  readonly relationship: NetworkExplorerRelationship;
  readonly targetName: string;
  readonly targetKindLabel: string;
  readonly status?: ReferenceResolutionStatus;
  readonly referenceCount: number;
}

export interface NetworkExplorerNode {
  readonly id: ProjectionNodeId;
  readonly glyph: '▰' | '◇' | '●' | '○';
  readonly kindLabel: 'File' | 'Heading' | 'Block' | 'Diagnostic';
  readonly name: string;
  readonly secondary: string;
  readonly focusRoot: boolean;
  readonly focusDistance: number | null;
  readonly visualGroupName?: string;
  readonly diagnosticStatus?: Exclude<ReferenceResolutionStatus, 'resolved'>;
  readonly internalReferenceCount: number;
  readonly adjacency: readonly NetworkExplorerAdjacency[];
}

export interface NetworkExplorerModel {
  readonly nodes: readonly NetworkExplorerNode[];
  readonly nodeById: ReadonlyMap<ProjectionNodeId, NetworkExplorerNode>;
}

export type NetworkExplorerRow =
  | {
      readonly kind: 'node';
      readonly id: string;
      readonly node: NetworkExplorerNode;
      readonly position: number;
      readonly setSize: number;
    }
  | {
      readonly kind: 'adjacency';
      readonly id: string;
      readonly adjacency: NetworkExplorerAdjacency;
      readonly position: number;
      readonly setSize: number;
    };

export interface NetworkExplorerVirtualWindow {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly offset: number;
  readonly totalHeight: number;
}

export type NetworkExplorerKeyboardAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'activate'; readonly index: number }
  | {
      readonly kind: 'expand';
      readonly nodeId: ProjectionNodeId;
      readonly focusRowId: string;
    }
  | { readonly kind: 'collapse'; readonly nodeId: ProjectionNodeId }
  | { readonly kind: 'select'; readonly nodeId: ProjectionNodeId };

interface AdjacencyBuckets {
  readonly parent: NetworkExplorerAdjacency[];
  readonly child: NetworkExplorerAdjacency[];
  readonly outgoing: NetworkExplorerAdjacency[];
  readonly incoming: NetworkExplorerAdjacency[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function entityKindRank(kind: ProjectedEntityNode['entityKind']): number {
  switch (kind) {
    case 'document':
      return 0;
    case 'section':
      return 1;
    case 'block':
      return 2;
  }
}

function compareEntityNodes(
  left: ProjectedEntityNode,
  right: ProjectedEntityNode,
  workspace: InspectionWorkspace,
): number {
  if (left.focusDistance === 0 && right.focusDistance !== 0) return -1;
  if (right.focusDistance === 0 && left.focusDistance !== 0) return 1;
  const leftStart = workspace.requireEntity(left.entityId).source.span.start;
  const rightStart = workspace.requireEntity(right.entityId).source.span.start;
  return (
    compareText(left.sourcePath, right.sourcePath) ||
    left.sourceStartLine - right.sourceStartLine ||
    leftStart.column - rightStart.column ||
    entityKindRank(left.entityKind) - entityKindRank(right.entityKind) ||
    compareText(left.id, right.id)
  );
}

function compareDiagnosticNodes(
  left: Extract<ProjectedNode, { kind: 'reference-target' }>,
  right: Extract<ProjectedNode, { kind: 'reference-target' }>,
): number {
  return (
    compareText(left.status, right.status) ||
    compareText(left.rawTarget, right.rawTarget) ||
    compareText(left.id, right.id)
  );
}

function glyphAndKind(
  node: ProjectedNode,
): Pick<NetworkExplorerNode, 'glyph' | 'kindLabel'> {
  if (node.kind === 'reference-target') {
    return { glyph: '○', kindLabel: 'Diagnostic' };
  }
  switch (node.entityKind) {
    case 'document':
      return { glyph: '▰', kindLabel: 'File' };
    case 'section':
      return { glyph: '◇', kindLabel: 'Heading' };
    case 'block':
      return { glyph: '●', kindLabel: 'Block' };
  }
}

function createBuckets(): AdjacencyBuckets {
  return { parent: [], child: [], outgoing: [], incoming: [] };
}

function adjacencyId(
  parentNodeId: ProjectionNodeId,
  edgeId: ProjectionEdgeId,
  relationship: NetworkExplorerRelationship,
): string {
  return `adjacency:${parentNodeId}\0${edgeId}\0${relationship}`;
}

function createAdjacency(args: {
  readonly edgeId: ProjectionEdgeId;
  readonly parentNodeId: ProjectionNodeId;
  readonly target: NetworkExplorerNode;
  readonly relationship: NetworkExplorerRelationship;
  readonly status?: ReferenceResolutionStatus;
  readonly referenceCount: number;
}): NetworkExplorerAdjacency {
  return {
    id: adjacencyId(args.parentNodeId, args.edgeId, args.relationship),
    edgeId: args.edgeId,
    parentNodeId: args.parentNodeId,
    targetNodeId: args.target.id,
    relationship: args.relationship,
    targetName: args.target.name,
    targetKindLabel: args.target.kindLabel,
    ...(args.status === undefined ? {} : { status: args.status }),
    referenceCount: args.referenceCount,
  };
}

/**
 * Builds a projection-scoped read model. It indexes every node and projected
 * edge once; neither canonical hidden entities nor renderer topology participate.
 */
export function createNetworkExplorerModel(
  projection: Pick<ViewProjection, 'nodes' | 'edges'>,
  workspace: InspectionWorkspace,
  visualGroups: VisualGroupPresentationMap,
): NetworkExplorerModel {
  const entityNodes: ProjectedEntityNode[] = [];
  const diagnosticNodes: Extract<
    ProjectedNode,
    { kind: 'reference-target' }
  >[] = [];
  for (const node of projection.nodes) {
    if (node.kind === 'entity') entityNodes.push(node);
    else diagnosticNodes.push(node);
  }
  entityNodes.sort((left, right) => compareEntityNodes(left, right, workspace));
  diagnosticNodes.sort(compareDiagnosticNodes);

  const orderedProjectionNodes: ProjectedNode[] = [
    ...entityNodes,
    ...diagnosticNodes,
  ];
  const mutableNodes = new Map<ProjectionNodeId, NetworkExplorerNode>();
  const bucketsByNodeId = new Map<ProjectionNodeId, AdjacencyBuckets>();

  for (const node of orderedProjectionNodes) {
    const presentation = glyphAndKind(node);
    if (node.kind === 'entity') {
      const entity = workspace.requireEntity(node.entityId);
      const visualGroup = visualGroups.get(node.entityId);
      mutableNodes.set(node.id, {
        id: node.id,
        ...presentation,
        name: entityDisplayName(entity),
        secondary: `${node.sourcePath} · L${entity.source.span.start.line}:C${entity.source.span.start.column}`,
        focusRoot: node.focusDistance === 0,
        focusDistance: node.focusDistance,
        ...(visualGroup === undefined
          ? {}
          : { visualGroupName: visualGroup.groupName }),
        internalReferenceCount: node.internalReferenceIds.length,
        adjacency: [],
      });
    } else {
      const firstReference = node.referenceIds[0];
      const occurrence =
        firstReference === undefined
          ? undefined
          : workspace.reference(firstReference);
      const source =
        occurrence === undefined
          ? undefined
          : workspace.entity(occurrence.sourceEntityId);
      const secondary =
        occurrence === undefined || source === undefined
          ? `${node.status} link target`
          : `${source.source.path} · L${occurrence.sourceSpan.start.line}:C${occurrence.sourceSpan.start.column}`;
      mutableNodes.set(node.id, {
        id: node.id,
        ...presentation,
        name: node.rawTarget,
        secondary,
        focusRoot: false,
        focusDistance: null,
        diagnosticStatus: node.status,
        internalReferenceCount: 0,
        adjacency: [],
      });
    }
    bucketsByNodeId.set(node.id, createBuckets());
  }

  for (const edge of projection.edges) {
    const source = mutableNodes.get(edge.sourceNodeId);
    const target = mutableNodes.get(edge.targetNodeId);
    const sourceBuckets = bucketsByNodeId.get(edge.sourceNodeId);
    const targetBuckets = bucketsByNodeId.get(edge.targetNodeId);
    if (
      source === undefined ||
      target === undefined ||
      sourceBuckets === undefined ||
      targetBuckets === undefined
    ) {
      throw new Error(
        `Network Explorer cannot index edge ${JSON.stringify(edge.id)} with a missing projected endpoint.`,
      );
    }
    if (edge.kind === 'hierarchy') {
      sourceBuckets.child.push(
        createAdjacency({
          edgeId: edge.id,
          parentNodeId: source.id,
          target,
          relationship: 'child',
          referenceCount: 0,
        }),
      );
      targetBuckets.parent.push(
        createAdjacency({
          edgeId: edge.id,
          parentNodeId: target.id,
          target: source,
          relationship: 'parent',
          referenceCount: 0,
        }),
      );
    } else {
      sourceBuckets.outgoing.push(
        createAdjacency({
          edgeId: edge.id,
          parentNodeId: source.id,
          target,
          relationship: 'outgoing',
          status: edge.status,
          referenceCount: edge.referenceIds.length,
        }),
      );
      targetBuckets.incoming.push(
        createAdjacency({
          edgeId: edge.id,
          parentNodeId: target.id,
          target: source,
          relationship: 'incoming',
          status: edge.status,
          referenceCount: edge.referenceIds.length,
        }),
      );
    }
  }

  const nodes = orderedProjectionNodes.map((node) => {
    const value = mutableNodes.get(node.id);
    const buckets = bucketsByNodeId.get(node.id);
    if (value === undefined || buckets === undefined) {
      throw new Error(
        `Network Explorer lost projected node ${JSON.stringify(node.id)} while indexing.`,
      );
    }
    return {
      ...value,
      adjacency: [
        ...buckets.parent,
        ...buckets.child,
        ...buckets.outgoing,
        ...buckets.incoming,
      ],
    };
  });
  return { nodes, nodeById: new Map(nodes.map((node) => [node.id, node])) };
}

export function reconcileNetworkExplorerExpansion(
  expandedNodeIds: ReadonlySet<ProjectionNodeId>,
  model: NetworkExplorerModel,
): ReadonlySet<ProjectionNodeId> {
  const next = new Set<ProjectionNodeId>();
  for (const nodeId of expandedNodeIds) {
    if ((model.nodeById.get(nodeId)?.adjacency.length ?? 0) > 0) {
      next.add(nodeId);
    }
  }
  if (
    next.size === expandedNodeIds.size &&
    [...next].every((nodeId) => expandedNodeIds.has(nodeId))
  ) {
    return expandedNodeIds;
  }
  return next;
}

export function flattenNetworkExplorerRows(
  model: NetworkExplorerModel,
  expandedNodeIds: ReadonlySet<ProjectionNodeId>,
): readonly NetworkExplorerRow[] {
  const rows: NetworkExplorerRow[] = [];
  for (const [index, node] of model.nodes.entries()) {
    rows.push({
      kind: 'node',
      id: `node:${node.id}`,
      node,
      position: index + 1,
      setSize: model.nodes.length,
    });
    if (!expandedNodeIds.has(node.id)) continue;
    for (const [adjacencyIndex, adjacency] of node.adjacency.entries()) {
      rows.push({
        kind: 'adjacency',
        id: adjacency.id,
        adjacency,
        position: adjacencyIndex + 1,
        setSize: node.adjacency.length,
      });
    }
  }
  return rows;
}

export function indexNetworkExplorerRows(
  rows: readonly NetworkExplorerRow[],
): ReadonlyMap<string, number> {
  return new Map(rows.map((row, index) => [row.id, index]));
}

export function networkExplorerVirtualWindow(args: {
  readonly rowCount: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight?: number;
  readonly overscan?: number;
}): NetworkExplorerVirtualWindow {
  const rowHeight = args.rowHeight ?? NETWORK_EXPLORER_ROW_HEIGHT;
  const overscan = args.overscan ?? NETWORK_EXPLORER_OVERSCAN;
  const totalHeight = args.rowCount * rowHeight;
  if (args.rowCount === 0) {
    return { startIndex: 0, endIndex: 0, offset: 0, totalHeight: 0 };
  }
  const visibleStart = Math.max(0, Math.floor(args.scrollTop / rowHeight));
  const visibleEnd = Math.min(
    args.rowCount,
    Math.ceil((args.scrollTop + Math.max(0, args.viewportHeight)) / rowHeight),
  );
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(args.rowCount, visibleEnd + overscan);
  return {
    startIndex,
    endIndex,
    offset: startIndex * rowHeight,
    totalHeight,
  };
}

export function networkExplorerScrollTopForIndex(args: {
  readonly index: number;
  readonly scrollTop: number;
  readonly viewportHeight: number;
  readonly rowHeight?: number;
}): number {
  const rowHeight = args.rowHeight ?? NETWORK_EXPLORER_ROW_HEIGHT;
  const rowTop = args.index * rowHeight;
  const rowBottom = rowTop + rowHeight;
  if (rowTop < args.scrollTop) return rowTop;
  if (rowBottom > args.scrollTop + args.viewportHeight) {
    return Math.max(0, rowBottom - args.viewportHeight);
  }
  return args.scrollTop;
}

export function networkExplorerKeyboardAction(args: {
  readonly rows: readonly NetworkExplorerRow[];
  readonly rowIndexById: ReadonlyMap<string, number>;
  readonly activeIndex: number;
  readonly expandedNodeIds: ReadonlySet<ProjectionNodeId>;
  readonly key: string;
}): NetworkExplorerKeyboardAction {
  const row = args.rows[args.activeIndex];
  if (row === undefined) return { kind: 'none' };
  switch (args.key) {
    case 'ArrowDown':
      return {
        kind: 'activate',
        index: Math.min(args.rows.length - 1, args.activeIndex + 1),
      };
    case 'ArrowUp':
      return { kind: 'activate', index: Math.max(0, args.activeIndex - 1) };
    case 'Home':
      return { kind: 'activate', index: 0 };
    case 'End':
      return { kind: 'activate', index: args.rows.length - 1 };
    case 'ArrowRight': {
      if (row.kind !== 'node' || row.node.adjacency.length === 0) {
        return { kind: 'none' };
      }
      if (args.expandedNodeIds.has(row.node.id)) {
        return {
          kind: 'activate',
          index: Math.min(args.rows.length - 1, args.activeIndex + 1),
        };
      }
      const firstAdjacency = row.node.adjacency[0];
      return firstAdjacency === undefined
        ? { kind: 'none' }
        : {
            kind: 'expand',
            nodeId: row.node.id,
            focusRowId: firstAdjacency.id,
          };
    }
    case 'ArrowLeft': {
      if (row.kind === 'adjacency') {
        const parentIndex = args.rowIndexById.get(
          `node:${row.adjacency.parentNodeId}`,
        );
        return parentIndex === undefined
          ? { kind: 'none' }
          : { kind: 'activate', index: parentIndex };
      }
      return args.expandedNodeIds.has(row.node.id)
        ? { kind: 'collapse', nodeId: row.node.id }
        : { kind: 'none' };
    }
    case 'Enter':
    case ' ':
      return {
        kind: 'select',
        nodeId: row.kind === 'node' ? row.node.id : row.adjacency.targetNodeId,
      };
    default:
      return { kind: 'none' };
  }
}
