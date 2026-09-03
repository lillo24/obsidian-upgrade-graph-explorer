import type { EntityId, WorkspacePath } from '@icarus-graph-explorer/core';
import {
  entityDisplayName,
  type InspectionWorkspace,
} from '@icarus-graph-explorer/explorer-inspection';
import type {
  ProjectedEntityNode,
  ProjectedNode,
  ProjectionNodeId,
  ReferenceResolutionStatus,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';
import {
  createNetworkExplorerFolders,
  type NetworkExplorerFolders,
  type NetworkExplorerRow,
} from './network-explorer-folders';
export {
  flattenNetworkExplorerRows,
  networkExplorerFolderExpanded,
  revealNetworkExplorerNode,
} from './network-explorer-folders';
export type {
  NetworkExplorerFolderState,
  NetworkExplorerRow,
} from './network-explorer-folders';

export const NETWORK_EXPLORER_ROW_HEIGHT = 56;
export const NETWORK_EXPLORER_OVERSCAN = 6;

export interface NetworkExplorerNode {
  readonly id: ProjectionNodeId;
  readonly entityId?: EntityId;
  readonly sourcePath?: WorkspacePath;
  readonly glyph: '▰' | '◇' | '●' | '○';
  readonly kindLabel: 'File' | 'Heading' | 'Block' | 'Diagnostic';
  readonly name: string;
  readonly secondary: string;
  readonly focusRoot: boolean;
  readonly focusDistance: number | null;
  readonly visualGroupName?: string;
  readonly diagnosticStatus?: Exclude<ReferenceResolutionStatus, 'resolved'>;
}

export interface NetworkExplorerModel extends NetworkExplorerFolders {
  readonly nodes: readonly NetworkExplorerNode[];
  readonly nodeById: ReadonlyMap<ProjectionNodeId, NetworkExplorerNode>;
}

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
      readonly kind: 'toggle-folder';
      readonly path: WorkspacePath;
      readonly expanded: boolean;
    }
  | { readonly kind: 'select'; readonly nodeId: ProjectionNodeId };

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

/** Projection-only source orientation. Relationship indexing belongs to Inspector. */
export function createNetworkExplorerModel(
  projection: Pick<ViewProjection, 'nodes'>,
  workspace: InspectionWorkspace,
  visualGroups: VisualGroupPresentationMap,
): NetworkExplorerModel {
  const entities: ProjectedEntityNode[] = [];
  const diagnostics: Extract<ProjectedNode, { kind: 'reference-target' }>[] =
    [];
  for (const node of projection.nodes) {
    if (node.kind === 'entity') entities.push(node);
    else diagnostics.push(node);
  }
  entities.sort((left, right) => compareEntityNodes(left, right, workspace));
  diagnostics.sort(compareDiagnosticNodes);
  const nodes: NetworkExplorerNode[] = [...entities, ...diagnostics].map(
    (node) => {
      const presentation = glyphAndKind(node);
      if (node.kind === 'entity') {
        const entity = workspace.requireEntity(node.entityId);
        const group = visualGroups.get(node.entityId);
        return {
          id: node.id,
          entityId: node.entityId,
          sourcePath: node.sourcePath,
          ...presentation,
          name: entityDisplayName(entity),
          secondary: `${node.sourcePath} · L${entity.source.span.start.line}:C${entity.source.span.start.column}`,
          focusRoot: node.focusDistance === 0,
          focusDistance: node.focusDistance,
          ...(group === undefined ? {} : { visualGroupName: group.groupName }),
        };
      }
      const firstReference = node.referenceIds[0];
      const occurrence =
        firstReference === undefined
          ? undefined
          : workspace.reference(firstReference);
      const source =
        occurrence === undefined
          ? undefined
          : workspace.entity(occurrence.sourceEntityId);
      return {
        id: node.id,
        ...presentation,
        name: node.rawTarget,
        secondary:
          occurrence === undefined || source === undefined
            ? `${node.status} link target`
            : `${source.source.path} · L${occurrence.sourceSpan.start.line}:C${occurrence.sourceSpan.start.column}`,
        focusRoot: false,
        focusDistance: null,
        diagnosticStatus: node.status,
      };
    },
  );
  return {
    nodes,
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    ...createNetworkExplorerFolders(nodes),
  };
}

export function indexNetworkExplorerRows(
  rows: readonly NetworkExplorerRow[],
): ReadonlyMap<string, number> {
  return new Map(rows.map((row, index) => [row.id, index]));
}

export function shouldRevealNetworkExplorerSelection(
  previousNodeId: ProjectionNodeId | undefined,
  selectedNodeId: ProjectionNodeId | undefined,
): boolean {
  return selectedNodeId !== undefined && selectedNodeId !== previousNodeId;
}

/** Transient graph click intent; a new key can reveal the same selected node. */
export interface NetworkExplorerRevealRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
}

/** Graph clicks align the row top, clamped to the list's actual scroll range. */
export function networkExplorerTopAlignedScrollTop(args: {
  readonly index: number;
  readonly rowCount: number;
  readonly viewportHeight: number;
}): number {
  return Math.max(
    0,
    Math.min(
      args.index * NETWORK_EXPLORER_ROW_HEIGHT,
      args.rowCount * NETWORK_EXPLORER_ROW_HEIGHT - args.viewportHeight,
    ),
  );
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
  // Folder collapse/query changes can shrink content before the browser clamps scrollTop.
  const scrollTop = Math.min(
    Math.max(0, args.scrollTop),
    Math.max(0, totalHeight - Math.max(0, args.viewportHeight)),
  );
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.min(
    args.rowCount,
    Math.ceil((scrollTop + Math.max(0, args.viewportHeight)) / rowHeight),
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
    case 'ArrowRight':
      if (row.kind !== 'folder') return { kind: 'none' };
      return row.expanded
        ? {
            kind: 'activate',
            index: Math.min(args.rows.length - 1, args.activeIndex + 1),
          }
        : { kind: 'toggle-folder', path: row.folder.path, expanded: true };
    case 'ArrowLeft': {
      if (row.kind === 'folder' && row.expanded) {
        return {
          kind: 'toggle-folder',
          path: row.folder.path,
          expanded: false,
        };
      }
      const parentIndex =
        row.parentFolderId === undefined
          ? undefined
          : args.rowIndexById.get(row.parentFolderId);
      return parentIndex === undefined
        ? { kind: 'none' }
        : { kind: 'activate', index: parentIndex };
    }
    case 'Enter':
    case ' ':
      return row.kind === 'folder'
        ? {
            kind: 'toggle-folder',
            path: row.folder.path,
            expanded: !row.expanded,
          }
        : { kind: 'select', nodeId: row.node.id };
    default:
      return { kind: 'none' };
  }
}
