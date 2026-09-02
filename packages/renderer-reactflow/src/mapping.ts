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
  GraphVisualVariant,
} from './types';

export const ENTITY_NODE_DIMENSIONS = {
  document: { width: 200, height: 80 },
  section: { width: 184, height: 72 },
  block: { width: 152, height: 64 },
} as const;

export const ENTITY_TYPE_LABELS = {
  document: 'File',
  section: 'Heading',
  block: 'Block',
} as const;

export const DIAGNOSTIC_NODE_DIMENSIONS = { width: 208, height: 94 } as const;

/** Measured fixed boxes for the reusable compact hierarchy presentation. */
export const COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS = {
  document: { width: 156, height: 46 },
  section: { width: 148, height: 42 },
  block: { width: 132, height: 38 },
} as const;

export const COMPACT_HIERARCHY_DIAGNOSTIC_NODE_DIMENSIONS = {
  width: 148,
  height: 42,
} as const;

export interface MapProjectionOptions {
  readonly visualVariant?: GraphVisualVariant;
  readonly rootEntityId?: string;
}

function documentName(path: string): string {
  const name = path.split('/').at(-1) ?? path;
  return name.toLowerCase().endsWith('.md') ? name.slice(0, -3) : name;
}

function parentSegments(path: string): readonly string[] {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  return segments.slice(0, -1);
}

function parentSuffix(path: string, depth: number): string {
  const segments = parentSegments(path);
  return segments.length === 0
    ? 'workspace root'
    : segments.slice(-depth).join('/');
}

interface DocumentPresentation {
  readonly title: string;
  readonly detail: string | null;
  readonly context: string;
}

interface EntityPresentation {
  readonly title: string;
  readonly detail: string | null;
}

/**
 * Finds the shortest unique parent suffix for same-named documents. The work is
 * proportional to the number of path segments, avoiding pairwise comparisons.
 */
function documentPresentations(
  nodes: readonly ProjectedEntityNode[],
): ReadonlyMap<string, DocumentPresentation> {
  const paths = [...new Set(nodes.map((node) => node.sourcePath))].sort(
    (a, b) => a.localeCompare(b),
  );
  const pathsByTitle = new Map<string, string[]>();
  for (const path of paths) {
    const title = documentName(path);
    const titledPaths = pathsByTitle.get(title) ?? [];
    titledPaths.push(path);
    pathsByTitle.set(title, titledPaths);
  }

  const result = new Map<string, DocumentPresentation>();
  for (const [title, titledPaths] of pathsByTitle) {
    if (titledPaths.length === 1) {
      result.set(titledPaths[0]!, { title, detail: null, context: title });
      continue;
    }

    const unresolved = new Set(titledPaths);
    const maximumDepth = Math.max(
      1,
      ...titledPaths.map((path) => parentSegments(path).length),
    );
    for (let depth = 1; depth <= maximumDepth && unresolved.size > 0; depth++) {
      const suffixCounts = new Map<string, number>();
      for (const path of titledPaths) {
        const suffix = parentSuffix(path, depth);
        suffixCounts.set(suffix, (suffixCounts.get(suffix) ?? 0) + 1);
      }
      for (const path of unresolved) {
        const suffix = parentSuffix(path, depth);
        if (suffixCounts.get(suffix) !== 1) continue;
        result.set(path, {
          title,
          detail: suffix,
          context: `${title} · ${suffix}`,
        });
        unresolved.delete(path);
      }
    }
    for (const path of unresolved) {
      result.set(path, { title, detail: path, context: path });
    }
  }
  return result;
}

function sectionTitle(node: ProjectedEntityNode): string {
  const trimmed = node.title?.trim();
  return trimmed === undefined || trimmed.length === 0
    ? 'Untitled section'
    : trimmed;
}

function entityPresentations(
  nodes: readonly ProjectedEntityNode[],
): ReadonlyMap<string, EntityPresentation> {
  const documents = documentPresentations(nodes);
  const sectionsByTitle = new Map<string, ProjectedEntityNode[]>();
  const sectionPathCountsByTitle = new Map<string, Map<string, number>>();
  for (const node of nodes) {
    if (node.entityKind !== 'section') continue;
    const title = sectionTitle(node);
    const sections = sectionsByTitle.get(title) ?? [];
    sections.push(node);
    sectionsByTitle.set(title, sections);
    const pathCounts = sectionPathCountsByTitle.get(title) ?? new Map();
    pathCounts.set(node.sourcePath, (pathCounts.get(node.sourcePath) ?? 0) + 1);
    sectionPathCountsByTitle.set(title, pathCounts);
  }

  const result = new Map<string, EntityPresentation>();
  for (const node of nodes) {
    const document = documents.get(node.sourcePath) ?? {
      title: documentName(node.sourcePath),
      detail: null,
      context: documentName(node.sourcePath),
    };
    if (node.entityKind === 'document') {
      result.set(node.id, { title: document.title, detail: document.detail });
      continue;
    }
    if (node.entityKind === 'block') {
      result.set(node.id, {
        title: `Line ${node.sourceStartLine}`,
        detail: document.context,
      });
      continue;
    }

    const title = sectionTitle(node);
    const collisions = sectionsByTitle.get(title) ?? [];
    if (collisions.length === 1) {
      result.set(node.id, { title, detail: null });
      continue;
    }
    const sameDocumentCount =
      sectionPathCountsByTitle.get(title)?.get(node.sourcePath) ?? 0;
    result.set(node.id, {
      title,
      detail:
        sameDocumentCount > 1
          ? `${document.context} · line ${node.sourceStartLine}`
          : document.context,
    });
  }
  return result;
}

function mapEntityNode(
  node: ProjectedEntityNode,
  presentation: EntityPresentation,
  visibleDescendantCount: number,
  visualVariant: GraphVisualVariant,
  rootEntityId: string | undefined,
): EntityFlowNode {
  const dimensions =
    visualVariant === 'compact-schematic'
      ? COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS[node.entityKind]
      : ENTITY_NODE_DIMENSIONS[node.entityKind];
  const typeLabel = ENTITY_TYPE_LABELS[node.entityKind];
  const { detail, title } = presentation;
  const isExpanded = visibleDescendantCount > 0;
  const disclosure =
    node.revealableDescendantCount > 0
      ? `${node.revealableDescendantCount} descendant${node.revealableDescendantCount === 1 ? '' : 's'} can be revealed`
      : 'No descendants can be revealed';
  const sourceLocation =
    node.entityKind === 'document'
      ? node.sourcePath
      : `${node.sourcePath}, line ${node.sourceStartLine}`;
  const ariaLabel = `${typeLabel} ${title}, ${sourceLocation}, ${disclosure}`;
  const focusClass =
    node.focusDistance === null
      ? ''
      : ` graph-node--focus-distance-${node.focusDistance}`;
  const root = rootEntityId === node.entityId;
  const variantClass =
    visualVariant === 'compact-schematic'
      ? ' graph-node--compact-schematic'
      : '';
  const rootClass = root ? ' graph-node--local-root' : '';
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
    className: `graph-node graph-node--${node.entityKind} graph-node--role-${node.role}${focusClass}${variantClass}${rootClass}`,
    data: {
      projectionNodeId: node.id,
      entityId: node.entityId,
      entityKind: node.entityKind,
      typeLabel,
      title,
      detail,
      sourcePath: node.sourcePath,
      sourceStartLine: node.sourceStartLine,
      role: node.role,
      focusDistance: node.focusDistance,
      revealableDescendantCount: node.revealableDescendantCount,
      visibleDescendantCount,
      isExpanded,
      internalReferenceCount: node.internalReferenceIds.length,
      ariaLabel,
      visualVariant,
      root,
    },
  };
}

function mapDiagnosticNode(
  node: ProjectedReferenceTargetNode,
  visualVariant: GraphVisualVariant,
): DiagnosticFlowNode {
  const candidateText =
    node.status === 'ambiguous'
      ? `, ${node.candidateEntityIds.length} candidates`
      : '';
  const ariaLabel = `${node.status} reference target ${node.rawTarget}, ${node.referenceIds.length} occurrence${node.referenceIds.length === 1 ? '' : 's'}${candidateText}`;
  const dimensions =
    visualVariant === 'compact-schematic'
      ? COMPACT_HIERARCHY_DIAGNOSTIC_NODE_DIMENSIONS
      : DIAGNOSTIC_NODE_DIMENSIONS;
  return {
    id: rendererNodeId(node.id),
    type: 'diagnostic',
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
    className: `graph-node graph-node--diagnostic graph-node--${node.status}${visualVariant === 'compact-schematic' ? ' graph-node--compact-schematic' : ''}`,
    data: {
      projectionNodeId: node.id,
      status: node.status,
      rawTarget: node.rawTarget,
      referenceCount: node.referenceIds.length,
      candidateCount: node.candidateEntityIds.length,
      reasonCount: node.reasons.length,
      ariaLabel,
      visualVariant,
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
  options: MapProjectionOptions = {},
): { readonly nodes: GraphFlowNode[]; readonly edges: GraphFlowEdge[] } {
  const visualVariant = options.visualVariant ?? 'extended';
  const entityNodes = projection.nodes.filter(
    (node): node is ProjectedEntityNode => node.kind === 'entity',
  );
  const presentationByNodeId = entityPresentations(entityNodes);
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
            presentationByNodeId.get(node.id) ?? {
              title: documentName(node.sourcePath),
              detail: null,
            },
            countVisibleDescendants(node.id),
            visualVariant,
            options.rootEntityId,
          )
        : mapDiagnosticNode(node, visualVariant),
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
        className: `graph-edge graph-edge--${edge.kind}${status === null ? '' : ` graph-edge--${status}`}${visualVariant === 'compact-schematic' ? ' graph-edge--compact-schematic' : ''}`,
        data: {
          projectionEdgeId: edge.id,
          kind: edge.kind,
          status,
          referenceCount,
          ariaLabel,
          visualVariant,
        },
      };
    });
  return { nodes, edges };
}
