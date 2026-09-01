import type { EntityId } from '@icarus-graph-explorer/core';

import { documentOnlyProjectionState } from './presets';
import { projectView } from './project';
import type {
  ProjectedEdge,
  ProjectedEntityNode,
  ProjectedNode,
  ProjectedReferenceTargetNode,
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

/**
 * Creates the source-neutral KG6 state used by Local presentations. Local
 * always starts from a document root, reveals that document's direct
 * structure, and leaves neighboring documents collapsed unless disclosure
 * already expands them explicitly.
 */
export function deriveLocalProjectionState(
  workspace: ProjectionWorkspace,
  source: ViewProjectionState,
  targetEntityId: EntityId,
): ViewProjectionState {
  const rootEntityId = containingDocumentEntityId(workspace, targetEntityId);
  if (rootEntityId === undefined) {
    throw new Error(
      `Cannot enter Local: entity "${targetEntityId}" has no containing document.`,
    );
  }
  const expanded = new Set(source.disclosure.expandedEntityIds);
  expanded.add(rootEntityId);
  const collapsed = new Set(source.disclosure.collapsedEntityIds);
  collapsed.delete(rootEntityId);
  return {
    disclosure: {
      ...source.disclosure,
      // Automatic depth is intentionally disabled here. The root's explicit
      // expansion supplies its top-level headings without expanding every
      // document in the bounded reference neighborhood.
      defaultDepth: 0,
      expandedEntityIds: [...expanded].sort(compareText),
      collapsedEntityIds: [...collapsed].sort(compareText),
    },
    focus: {
      rootEntityId,
      hops: source.focus?.hops ?? 1,
      direction: source.focus?.direction ?? 'both',
      hierarchyContext: 'ancestors-and-children',
    },
    ...(source.filters === undefined ? {} : { filters: source.filters }),
  };
}

function documentIdForNode(
  workspace: ProjectionWorkspace,
  node: ProjectedEntityNode,
): EntityId | undefined {
  return containingDocumentEntityId(workspace, node.entityId);
}

/**
 * Projects a bounded Local graph in two KG6 passes. The first pass establishes
 * the document neighborhood from rolled-up references. The second applies
 * normal disclosure, filters, diagnostics, and exact provenance only inside
 * those documents. This prevents revealing headings from changing which
 * documents are reachable.
 */
export function projectLocalView(
  workspace: ProjectionWorkspace,
  state: ViewProjectionState,
): ViewProjection {
  const focus = state.focus;
  if (focus === undefined) {
    throw new Error('Cannot project Local without a KG6 Focus root.');
  }
  const rootEntityId = containingDocumentEntityId(
    workspace,
    focus.rootEntityId,
  );
  if (rootEntityId === undefined) {
    throw new Error(
      `Cannot project Local: focus root "${focus.rootEntityId}" has no containing document.`,
    );
  }

  const neighborhood = projectView(workspace, {
    ...documentOnlyProjectionState(),
    focus: {
      ...focus,
      rootEntityId,
      hierarchyContext: 'ancestors',
    },
    ...(state.filters?.referenceStatuses === undefined &&
    state.filters?.pathPrefixes === undefined
      ? {}
      : {
          filters: {
            ...(state.filters.pathPrefixes === undefined
              ? {}
              : { pathPrefixes: state.filters.pathPrefixes }),
            ...(state.filters.referenceStatuses === undefined
              ? {}
              : { referenceStatuses: state.filters.referenceStatuses }),
            entityKinds: ['document'],
          },
        }),
  });
  const documentDistance = new Map<EntityId, number>();
  for (const node of neighborhood.nodes) {
    if (node.kind !== 'entity' || node.entityKind !== 'document') continue;
    documentDistance.set(node.entityId, node.focusDistance ?? 0);
  }
  if (!documentDistance.has(rootEntityId)) {
    throw new Error(
      `Cannot project Local: root document "${rootEntityId}" is outside the active KG6 neighborhood.`,
    );
  }
  const allowedDiagnosticReferenceIds = new Set(
    neighborhood.nodes.flatMap((node) =>
      node.kind === 'reference-target' ? node.referenceIds : [],
    ),
  );

  const expanded = projectView(workspace, {
    disclosure: state.disclosure,
    ...(state.filters === undefined ? {} : { filters: state.filters }),
  });
  const entityNodes = expanded.nodes.flatMap((node): ProjectedNode[] => {
    if (node.kind !== 'entity') return [];
    const documentId = documentIdForNode(workspace, node);
    if (documentId === undefined || !documentDistance.has(documentId)) {
      return [];
    }
    return [
      {
        ...node,
        role: 'content',
        focusDistance: documentDistance.get(documentId) ?? 0,
      },
    ];
  });
  const retainedNodeIds = new Set(entityNodes.map(({ id }) => id));
  const diagnosticReferences = new Map<string, Set<string>>();
  const candidateEdges = expanded.edges.flatMap((edge): ProjectedEdge[] => {
    if (!retainedNodeIds.has(edge.sourceNodeId)) return [];
    if (retainedNodeIds.has(edge.targetNodeId)) return [edge];
    if (edge.kind !== 'reference') return [];
    const referenceIds = edge.referenceIds.filter((referenceId) =>
      allowedDiagnosticReferenceIds.has(referenceId),
    );
    if (referenceIds.length === 0) return [];
    const retained = diagnosticReferences.get(edge.targetNodeId) ?? new Set();
    for (const referenceId of referenceIds) retained.add(referenceId);
    diagnosticReferences.set(edge.targetNodeId, retained);
    return [{ ...edge, referenceIds }];
  });
  const diagnosticNodes = expanded.nodes.flatMap(
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
    issues: [...neighborhood.issues, ...expanded.issues].filter(
      (issue, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.code === issue.code &&
            candidate.subject === issue.subject &&
            candidate.message === issue.message,
        ) === index,
    ),
  };
  const validation = validateViewProjection(workspace, candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Local projection invariant failure${
        first === undefined ? '.' : `: ${first.path} ${first.message}`
      }`,
    );
  }
  return validation.value;
}
