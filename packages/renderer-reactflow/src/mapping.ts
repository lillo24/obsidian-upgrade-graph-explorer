import type {
  ProjectedEntityNode,
  ProjectedReferenceTargetNode,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { rendererEdgeId, rendererNodeId } from './ids';
import type {
  DiagnosticFlowNode,
  EntityFlowNode,
  GraphFlowEdge,
  GraphFlowNode,
  GraphLayoutMode,
} from './types';

export const ENTITY_NODE_DIMENSIONS = {
  document: { width: 224, height: 112 },
  section: { width: 200, height: 96 },
  block: { width: 168, height: 80 },
} as const;

export const ENTITY_TYPE_LABELS = {
  document: 'File',
  section: 'Heading',
  block: 'Block',
} as const;

export const DIAGNOSTIC_NODE_DIMENSIONS = { width: 208, height: 94 } as const;

function documentName(path: string): string {
  const name = path.split('/').at(-1) ?? path;
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
}

function entityTitle(node: ProjectedEntityNode): string {
  if (node.entityKind === 'document') return documentName(node.sourcePath);
  if (node.entityKind === 'block') return 'Block';
  const trimmed = node.title?.trim();
  return trimmed === undefined || trimmed.length === 0
    ? 'Untitled section'
    : trimmed;
}

function entityDetail(node: ProjectedEntityNode): string {
  if (node.entityKind === 'document') return node.sourcePath;
  if (node.entityKind === 'block') return `Line ${node.sourceStartLine}`;
  return `${node.sourcePath} · line ${node.sourceStartLine}`;
}

function mapEntityNode(
  node: ProjectedEntityNode,
  expandedEntityIds: ReadonlySet<string>,
  visibleParentNodeIds: ReadonlySet<string>,
  visibleDescendantCount: number,
): EntityFlowNode {
  const dimensions = ENTITY_NODE_DIMENSIONS[node.entityKind];
  const typeLabel = ENTITY_TYPE_LABELS[node.entityKind];
  const title = entityTitle(node);
  const isExpanded =
    expandedEntityIds.has(node.entityId) || visibleParentNodeIds.has(node.id);
  const disclosure = node.hasHiddenChildren
    ? `${node.hiddenDescendantCount} hidden descendant${node.hiddenDescendantCount === 1 ? '' : 's'}`
    : 'No hidden descendants';
  const ariaLabel = `${typeLabel} ${title}, ${entityDetail(node)}, ${disclosure}`;
  return {
    id: rendererNodeId(node.id),
    type: 'entity',
    position: { x: 0, y: 0 },
    width: dimensions.width,
    height: dimensions.height,
    measured: dimensions,
    draggable: false,
    connectable: false,
    deletable: false,
    selectable: true,
    focusable: true,
    ariaLabel,
    className: `graph-node graph-node--${node.entityKind}`,
    data: {
      projectionNodeId: node.id,
      entityId: node.entityId,
      entityKind: node.entityKind,
      typeLabel,
      title,
      detail: entityDetail(node),
      sourcePath: node.sourcePath,
      sourceStartLine: node.sourceStartLine,
      role: node.role,
      focusDistance: node.focusDistance,
      hasHiddenChildren: node.hasHiddenChildren,
      hiddenDescendantCount: node.hiddenDescendantCount,
      visibleDescendantCount,
      isExpanded,
      internalReferenceCount: node.internalReferenceIds.length,
      ariaLabel,
    },
  };
}

function mapDiagnosticNode(
  node: ProjectedReferenceTargetNode,
): DiagnosticFlowNode {
  const candidateText =
    node.status === 'ambiguous'
      ? `, ${node.candidateEntityIds.length} candidates`
      : '';
  const ariaLabel = `${node.status} reference target ${node.rawTarget}, ${node.referenceIds.length} occurrence${node.referenceIds.length === 1 ? '' : 's'}${candidateText}`;
  return {
    id: rendererNodeId(node.id),
    type: 'diagnostic',
    position: { x: 0, y: 0 },
    width: DIAGNOSTIC_NODE_DIMENSIONS.width,
    height: DIAGNOSTIC_NODE_DIMENSIONS.height,
    measured: DIAGNOSTIC_NODE_DIMENSIONS,
    draggable: false,
    connectable: false,
    deletable: false,
    selectable: true,
    focusable: true,
    ariaLabel,
    className: `graph-node graph-node--diagnostic graph-node--${node.status}`,
    data: {
      projectionNodeId: node.id,
      status: node.status,
      rawTarget: node.rawTarget,
      referenceCount: node.referenceIds.length,
      candidateCount: node.candidateEntityIds.length,
      reasonCount: node.reasons.length,
      ariaLabel,
    },
  };
}

function edgeHandles(mode: GraphLayoutMode) {
  return mode === 'structure'
    ? { sourceHandle: 'source-bottom', targetHandle: 'target-top' }
    : { sourceHandle: 'source-right', targetHandle: 'target-left' };
}

export function mapProjectionToReactFlow(
  projection: ViewProjection,
  mode: GraphLayoutMode,
  expandedEntityIds: ReadonlySet<string>,
): { readonly nodes: GraphFlowNode[]; readonly edges: GraphFlowEdge[] } {
  const visibleParentNodeIds = new Set(
    projection.edges
      .filter((edge) => edge.kind === 'hierarchy')
      .map((edge) => edge.sourceNodeId),
  );
  const visibleChildrenByNodeId = new Map<string, string[]>();
  for (const edge of projection.edges) {
    if (edge.kind !== 'hierarchy') continue;
    const children = visibleChildrenByNodeId.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    visibleChildrenByNodeId.set(edge.sourceNodeId, children);
  }
  const descendantCountByNodeId = new Map<string, number>();
  const countVisibleDescendants = (nodeId: string): number => {
    const cached = descendantCountByNodeId.get(nodeId);
    if (cached !== undefined) return cached;
    const count = (visibleChildrenByNodeId.get(nodeId) ?? []).reduce(
      (total, childId) => total + 1 + countVisibleDescendants(childId),
      0,
    );
    descendantCountByNodeId.set(nodeId, count);
    return count;
  };
  const nodes = [...projection.nodes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) =>
      node.kind === 'entity'
        ? mapEntityNode(
            node,
            expandedEntityIds,
            visibleParentNodeIds,
            countVisibleDescendants(node.id),
          )
        : mapDiagnosticNode(node),
    );
  const handles = edgeHandles(mode);
  const edges = [...projection.edges]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((edge): GraphFlowEdge => {
      const isReference = edge.kind === 'reference';
      const referenceCount = isReference ? edge.referenceIds.length : 0;
      const status = isReference ? edge.status : null;
      const ariaLabel = isReference
        ? `${status} reference, ${referenceCount} occurrence${referenceCount === 1 ? '' : 's'}`
        : 'Hierarchy relationship';
      return {
        id: rendererEdgeId(edge.id),
        type: 'graph',
        source: rendererNodeId(edge.sourceNodeId),
        target: rendererNodeId(edge.targetNodeId),
        ...handles,
        selectable: true,
        focusable: true,
        deletable: false,
        ariaLabel,
        className: `graph-edge graph-edge--${edge.kind}${status === null ? '' : ` graph-edge--${status}`}`,
        data: {
          projectionEdgeId: edge.id,
          kind: edge.kind,
          status,
          referenceCount,
          ariaLabel,
        },
      };
    });
  return { nodes, edges };
}
