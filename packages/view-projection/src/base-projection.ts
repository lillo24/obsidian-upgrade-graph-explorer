import type {
  AddressableEntity,
  EntityId,
  ReferenceId,
} from '@icarus-graph-explorer/core';

import { calculateDisclosure, type DisclosureResult } from './disclosure';
import {
  diagnosticTargetNodeId,
  entityNodeId,
  hierarchyEdgeId,
  referenceEdgeId,
} from './ids';
import type {
  DiagnosticReferenceStatus,
  ProjectedEntityNode,
  ProjectedHierarchyEdge,
  ProjectedNode,
  ProjectedReferenceEdge,
  ProjectedReferenceTargetNode,
  ProjectionNodeId,
  StructuralDisclosureState,
  ViewProjection,
} from './types';
import type { ProjectionWorkspace } from './workspace';

interface ReferenceAccumulator {
  readonly id: string;
  readonly sourceNodeId: ProjectionNodeId;
  readonly targetNodeId: ProjectionNodeId;
  readonly status: ProjectedReferenceEdge['status'];
  readonly referenceIds: Set<ReferenceId>;
}

interface DiagnosticAccumulator {
  readonly id: ProjectionNodeId;
  readonly status: DiagnosticReferenceStatus;
  readonly rawTarget: string;
  readonly referenceIds: Set<ReferenceId>;
  readonly candidateEntityIds: readonly EntityId[];
  readonly reasons: Set<string>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function titleOf(entity: AddressableEntity): string | null {
  return entity.kind === 'section' ? entity.title : null;
}

function nearestVisibleEntityId(
  workspace: ProjectionWorkspace,
  entityId: EntityId,
  visible: ReadonlySet<EntityId>,
  cache: Map<EntityId, EntityId>,
): EntityId {
  const cached = cache.get(entityId);
  if (cached !== undefined) return cached;
  if (visible.has(entityId)) {
    cache.set(entityId, entityId);
    return entityId;
  }
  const parent = workspace.parent(entityId);
  if (parent === undefined) {
    throw new Error(
      `Cannot route hidden entity "${entityId}" to a visible structural ancestor.`,
    );
  }
  const routed = nearestVisibleEntityId(workspace, parent.id, visible, cache);
  cache.set(entityId, routed);
  return routed;
}

function nearestVisibleParentId(
  workspace: ProjectionWorkspace,
  entity: AddressableEntity,
  visible: ReadonlySet<EntityId>,
): EntityId | undefined {
  let parent = workspace.parent(entity.id);
  while (parent !== undefined) {
    if (visible.has(parent.id)) return parent.id;
    parent = workspace.parent(parent.id);
  }
  return undefined;
}

export function buildBaseProjection(
  workspace: ProjectionWorkspace,
  state: StructuralDisclosureState,
): {
  readonly projection: ViewProjection;
  readonly disclosure: DisclosureResult;
} {
  const disclosure = calculateDisclosure(workspace, state);
  const visible = disclosure.visibleEntityIds;
  const routeCache = new Map<EntityId, EntityId>();
  const internalByEntityId = new Map<EntityId, Set<ReferenceId>>();
  const referencesById = new Map<string, ReferenceAccumulator>();
  const diagnosticsById = new Map<string, DiagnosticAccumulator>();

  for (const reference of workspace.references()) {
    const sourceEntityId = nearestVisibleEntityId(
      workspace,
      reference.sourceEntityId,
      visible,
      routeCache,
    );
    const sourceNodeId = entityNodeId(sourceEntityId);

    if (reference.resolution.status === 'resolved') {
      const targetEntityId = nearestVisibleEntityId(
        workspace,
        reference.resolution.targetEntityId,
        visible,
        routeCache,
      );
      if (sourceEntityId === targetEntityId) {
        const internal = internalByEntityId.get(sourceEntityId) ?? new Set();
        internal.add(reference.id);
        internalByEntityId.set(sourceEntityId, internal);
        continue;
      }

      const targetNodeId = entityNodeId(targetEntityId);
      const id = referenceEdgeId(sourceNodeId, targetNodeId, 'resolved');
      const accumulator = referencesById.get(id) ?? {
        id,
        sourceNodeId,
        targetNodeId,
        status: 'resolved',
        referenceIds: new Set<ReferenceId>(),
      };
      accumulator.referenceIds.add(reference.id);
      referencesById.set(id, accumulator);
      continue;
    }

    const status = reference.resolution.status;
    const candidateEntityIds =
      status === 'ambiguous'
        ? [...reference.resolution.candidateEntityIds].sort(compareText)
        : [];
    const targetNodeId = diagnosticTargetNodeId(
      sourceNodeId,
      status,
      reference.rawTarget,
      candidateEntityIds,
    );
    const diagnostic = diagnosticsById.get(targetNodeId) ?? {
      id: targetNodeId,
      status,
      rawTarget: reference.rawTarget,
      referenceIds: new Set<ReferenceId>(),
      candidateEntityIds,
      reasons: new Set<string>(),
    };
    diagnostic.referenceIds.add(reference.id);
    if (reference.resolution.reason !== undefined) {
      diagnostic.reasons.add(reference.resolution.reason);
    }
    diagnosticsById.set(targetNodeId, diagnostic);

    const id = referenceEdgeId(sourceNodeId, targetNodeId, status);
    const edge = referencesById.get(id) ?? {
      id,
      sourceNodeId,
      targetNodeId,
      status,
      referenceIds: new Set<ReferenceId>(),
    };
    edge.referenceIds.add(reference.id);
    referencesById.set(id, edge);
  }

  const entityNodes: ProjectedEntityNode[] = workspace
    .entities()
    .filter((entity) => visible.has(entity.id))
    .map((entity) => {
      return {
        id: entityNodeId(entity.id),
        kind: 'entity',
        entityId: entity.id,
        entityKind: entity.kind,
        sourcePath: entity.source.path,
        sourceStartLine: entity.source.span.start.line,
        title: titleOf(entity),
        revealableDescendantCount: 0,
        internalReferenceIds: [
          ...(internalByEntityId.get(entity.id) ?? []),
        ].sort(compareText),
        role: 'content',
        focusDistance: null,
      };
    });

  const diagnosticNodes: ProjectedReferenceTargetNode[] = [
    ...diagnosticsById.values(),
  ].map((node) => ({
    id: node.id,
    kind: 'reference-target',
    status: node.status,
    rawTarget: node.rawTarget,
    referenceIds: [...node.referenceIds].sort(compareText),
    candidateEntityIds: node.candidateEntityIds,
    reasons: [...node.reasons].sort(compareText),
  }));

  const hierarchyEdges: ProjectedHierarchyEdge[] = entityNodes.flatMap(
    (node) => {
      const entity = workspace.requireEntity(node.entityId);
      const parentId = nearestVisibleParentId(workspace, entity, visible);
      if (parentId === undefined) return [];
      const sourceNodeId = entityNodeId(parentId);
      return [
        {
          id: hierarchyEdgeId(sourceNodeId, node.id),
          kind: 'hierarchy' as const,
          sourceNodeId,
          targetNodeId: node.id,
        },
      ];
    },
  );

  const referenceEdges: ProjectedReferenceEdge[] = [
    ...referencesById.values(),
  ].map((edge) => ({
    id: edge.id,
    kind: 'reference',
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    status: edge.status,
    referenceIds: [...edge.referenceIds].sort(compareText),
  }));

  return {
    projection: {
      nodes: ([...entityNodes, ...diagnosticNodes] as ProjectedNode[]).sort(
        (left, right) => compareText(left.id, right.id),
      ),
      edges: [...hierarchyEdges, ...referenceEdges].sort((left, right) =>
        compareText(left.id, right.id),
      ),
      issues: disclosure.issues,
    },
    disclosure,
  };
}
