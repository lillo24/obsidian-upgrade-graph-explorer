import type { EntityId } from '@icarus-graph-explorer/core';

import { buildBaseProjection } from './base-projection';
import { prepareViewProjectionFilters } from './filter-plan';
import { documentOnlyProjectionState } from './presets';
import { applyFilters, applyFocus } from './slicing';
import type {
  ProjectedEdge,
  ProjectedEntityNode,
  ProjectedNode,
  ProjectedReferenceTargetNode,
  ProjectionIssue,
  ViewProjection,
  ViewProjectionState,
} from './types';
import { validateViewProjection } from './validation';
import type { ProjectionWorkspace } from './workspace';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Resolves any canonical entity to its stable containing document. */
export function containingDocumentEntityId(
  workspace: ProjectionWorkspace,
  entityId: EntityId,
): EntityId | undefined {
  let entity = workspace.entity(entityId);
  while (entity !== undefined && entity.kind !== 'document') {
    entity = workspace.parent(entity.id);
  }
  return entity?.id;
}

export interface FocusedDocumentNeighborhood {
  readonly rootDocumentId: EntityId;
  readonly rootDocumentNode: ProjectedEntityNode;
  readonly documentDistance: ReadonlyMap<EntityId, number>;
  readonly allowedDiagnosticReferenceIds: ReadonlySet<string>;
  readonly issues: readonly ProjectionIssue[];
}

/**
 * Establishes Focus membership from a documents-only reference projection.
 * Heading/text/kind/QUERY1 filters belong to the later detailed pass and can
 * never change which documents are reached here.
 */
export function projectFocusedDocumentNeighborhood(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
  owner: string,
): FocusedDocumentNeighborhood {
  const focus = state.focus;
  if (focus === undefined) {
    throw new Error(`Cannot project ${owner} without a KG6 Focus root.`);
  }
  const rootDocumentId = containingDocumentEntityId(
    workspace,
    focus.rootEntityId,
  );
  if (rootDocumentId === undefined) {
    throw new Error(
      `Cannot project ${owner}: focus root "${focus.rootEntityId}" has no containing document.`,
    );
  }

  const documentBase = buildBaseProjection(
    workspace,
    documentOnlyProjectionState().disclosure,
  ).projection;
  // Neighborhood discovery needs no DISC1 candidate-count pass. Relevant
  // document constraints are applied before traversal so excluded edges and
  // paths cannot carry Focus into another file.
  const constrainedDocuments = applyFilters(
    workspace,
    documentBase,
    prepareViewProjectionFilters(
      state.filters?.pathPrefixes === undefined &&
        state.filters?.referenceStatuses === undefined
        ? undefined
        : {
            ...(state.filters.pathPrefixes === undefined
              ? {}
              : { pathPrefixes: state.filters.pathPrefixes }),
            ...(state.filters.referenceStatuses === undefined
              ? {}
              : { referenceStatuses: state.filters.referenceStatuses }),
          },
    ),
  );
  const neighborhood = applyFocus(workspace, constrainedDocuments, {
    ...focus,
    rootEntityId: rootDocumentId,
    hierarchyContext: 'ancestors',
  });
  const documentDistance = new Map<EntityId, number>();
  let rootDocumentNode: ProjectedEntityNode | undefined;
  for (const node of neighborhood.nodes) {
    if (node.kind !== 'entity' || node.entityKind !== 'document') continue;
    documentDistance.set(node.entityId, node.focusDistance ?? 0);
    if (node.entityId === rootDocumentId) rootDocumentNode = node;
  }
  if (rootDocumentNode === undefined) {
    throw new Error(
      `Cannot project ${owner}: root document "${rootDocumentId}" is outside the active KG6 neighborhood.`,
    );
  }

  return {
    rootDocumentId,
    rootDocumentNode,
    documentDistance,
    allowedDiagnosticReferenceIds: new Set(
      neighborhood.nodes.flatMap((node) =>
        node.kind === 'reference-target' ? node.referenceIds : [],
      ),
    ),
    issues: neighborhood.issues,
  };
}

function uniqueIssues(
  issues: readonly ProjectionIssue[],
): readonly ProjectionIssue[] {
  return issues.filter(
    (issue, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === issue.code &&
          candidate.subject === issue.subject &&
          candidate.message === issue.message,
      ) === index,
  );
}

/** Retains exact detailed endpoints only inside the fixed document set. */
export function retainProjectionInsideFocusedDocuments(
  workspace: ProjectionWorkspace,
  detailed: ViewProjection,
  neighborhood: FocusedDocumentNeighborhood,
  owner: string,
): ViewProjection {
  const entityNodes = detailed.nodes.flatMap((node): ProjectedNode[] => {
    if (node.kind !== 'entity') return [];
    const documentId = containingDocumentEntityId(workspace, node.entityId);
    if (
      documentId === undefined ||
      !neighborhood.documentDistance.has(documentId)
    ) {
      return [];
    }
    const preserveFilterContext = node.role === 'context';
    return [
      {
        ...node,
        role: preserveFilterContext ? 'context' : 'content',
        focusDistance: preserveFilterContext
          ? null
          : (neighborhood.documentDistance.get(documentId) ?? 0),
      },
    ];
  });
  if (
    !entityNodes.some(
      (node) =>
        node.kind === 'entity' && node.entityId === neighborhood.rootDocumentId,
    )
  ) {
    // Focus renderers and navigation require one stable file anchor. Content
    // filters may hide the root as a match, but they must not invalidate the
    // active Focus scope when no matching descendant is structurally visible.
    entityNodes.push({
      ...neighborhood.rootDocumentNode,
      internalReferenceIds: [],
      revealableDescendantCount: 0,
      role: 'context',
      focusDistance: null,
    });
  }
  const retainedNodeIds = new Set(entityNodes.map(({ id }) => id));
  const diagnosticReferences = new Map<string, Set<string>>();
  const candidateEdges = detailed.edges.flatMap((edge): ProjectedEdge[] => {
    if (!retainedNodeIds.has(edge.sourceNodeId)) return [];
    if (retainedNodeIds.has(edge.targetNodeId)) return [edge];
    if (edge.kind !== 'reference') return [];
    const referenceIds = edge.referenceIds.filter((referenceId) =>
      neighborhood.allowedDiagnosticReferenceIds.has(referenceId),
    );
    if (referenceIds.length === 0) return [];
    const retained = diagnosticReferences.get(edge.targetNodeId) ?? new Set();
    for (const referenceId of referenceIds) retained.add(referenceId);
    diagnosticReferences.set(edge.targetNodeId, retained);
    return [{ ...edge, referenceIds }];
  });
  const diagnosticNodes = detailed.nodes.flatMap(
    (node): ProjectedReferenceTargetNode[] => {
      if (node.kind !== 'reference-target') return [];
      const referenceIds = diagnosticReferences.get(node.id);
      return referenceIds === undefined
        ? []
        : [{ ...node, referenceIds: [...referenceIds].sort(compareText) }];
    },
  );
  for (const node of diagnosticNodes) retainedNodeIds.add(node.id);
  const edges = candidateEdges.filter(
    (edge) =>
      retainedNodeIds.has(edge.sourceNodeId) &&
      retainedNodeIds.has(edge.targetNodeId),
  );
  const candidate: ViewProjection = {
    nodes: [...entityNodes, ...diagnosticNodes].sort((left, right) =>
      compareText(left.id, right.id),
    ),
    edges: [...edges].sort((left, right) => compareText(left.id, right.id)),
    issues: uniqueIssues([...neighborhood.issues, ...detailed.issues]),
  };
  const validation = validateViewProjection(workspace, candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `${owner} projection invariant failure${
        first === undefined ? '.' : `: ${first.path} ${first.message}`
      }`,
    );
  }
  return validation.value;
}
