import type { EntityId, ReferenceId } from '@icarus-graph-explorer/core';
import type {
  FocusSchematicModel,
  FocusSchematicRelationship,
} from '@icarus-graph-explorer/focus-schematic';
import type {
  ProjectedEntityNode,
  ProjectionNodeId,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import type {
  FocusSchematicConnectionEndpoint,
  FocusSchematicConnectionRole,
  FocusSchematicEndpointAttachmentSide,
  FocusSchematicEndpointConnection,
  FocusSchematicEndpointPlan,
  FocusSchematicEndpointValidationResult,
  FocusSchematicLayoutInput,
  FocusSchematicLayoutPlan,
  FocusSchematicNodeEndpointDemand,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort(compareText);

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonicalize);
    if (
      item !== null &&
      typeof item === 'object' &&
      Object.getPrototypeOf(item) === Object.prototype
    )
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => compareText(left, right))
          .map(([key, child]) => [key, canonicalize(child)]),
      );
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJson);
  return (
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value as Record<string, unknown>).every(isPlainJson)
  );
}

function connectionRole(
  relationship: FocusSchematicRelationship,
  selectedRelationshipIds: ReadonlySet<string>,
): FocusSchematicConnectionRole {
  if (selectedRelationshipIds.has(relationship.id)) return 'selected-backbone';
  if (
    !relationship.secondary &&
    (relationship.incomingPathForModuleIds.length > 0 ||
      relationship.outgoingPathForModuleIds.length > 0)
  )
    return 'focus-path';
  return 'secondary';
}

function attachmentSides(
  sourceModuleId: EntityId,
  targetModuleId: EntityId,
  planByModuleId: ReadonlyMap<
    EntityId,
    FocusSchematicLayoutPlan['modules'][number]
  >,
): readonly [
  FocusSchematicEndpointAttachmentSide,
  FocusSchematicEndpointAttachmentSide,
] {
  const sourceRank = planByModuleId.get(sourceModuleId)?.signedRank;
  const targetRank = planByModuleId.get(targetModuleId)?.signedRank;
  if (sourceRank === undefined || targetRank === undefined)
    throw new Error(
      `Endpoint side derivation is missing a module-plan entry for "${sourceModuleId}" or "${targetModuleId}".`,
    );
  return targetRank > sourceRank
    ? ['right', 'left']
    : targetRank < sourceRank
      ? ['left', 'right']
      : ['auto', 'auto'];
}

function visibleEndpoint(
  projectionNodeId: ProjectionNodeId,
  moduleId: EntityId,
  side: FocusSchematicEndpointAttachmentSide,
  nodeById: ReadonlyMap<ProjectionNodeId, ProjectedEntityNode>,
  ownerByNodeId: ReadonlyMap<ProjectionNodeId, EntityId>,
): FocusSchematicConnectionEndpoint {
  const node = nodeById.get(projectionNodeId);
  if (node === undefined)
    throw new Error(
      `Precise endpoint "${projectionNodeId}" is not a visible entity node.`,
    );
  if (ownerByNodeId.get(projectionNodeId) !== moduleId)
    throw new Error(
      `Precise endpoint "${projectionNodeId}" does not belong to module "${moduleId}".`,
    );
  if (!['document', 'section', 'block'].includes(node.entityKind))
    throw new Error(
      `Precise endpoint "${projectionNodeId}" has unsupported kind "${node.entityKind}".`,
    );
  return {
    kind: 'visible-entity',
    projectionNodeId,
    entityId: node.entityId,
    entityKind: node.entityKind as 'document' | 'section' | 'block',
    moduleId,
    attachmentSide: side,
  };
}

function fallbackEndpoint(
  moduleId: EntityId,
  side: FocusSchematicEndpointAttachmentSide,
  model: FocusSchematicModel,
  projection: ViewProjection,
  nodeById: ReadonlyMap<ProjectionNodeId, ProjectedEntityNode>,
): FocusSchematicConnectionEndpoint {
  const module = model.modules.find(({ id }) => id === moduleId);
  if (module === undefined)
    throw new Error(
      `Fallback endpoint references unknown module "${moduleId}".`,
    );
  if (module.presentation === 'filtered')
    return {
      kind: 'module-anchor',
      moduleId,
      reason: 'filtered-module',
      attachmentSide: side,
    };
  if (
    module.documentProjectionNodeId !== null &&
    nodeById.has(module.documentProjectionNodeId)
  )
    return visibleEndpoint(
      module.documentProjectionNodeId,
      moduleId,
      side,
      nodeById,
      new Map(module.visibleEntityNodeIds.map((id) => [id, moduleId])),
    );

  const visible = new Set(module.visibleEntityNodeIds);
  const childIds = new Set(
    projection.edges.flatMap((edge) =>
      edge.kind === 'hierarchy' &&
      module.hierarchyEdgeIds.includes(edge.id) &&
      visible.has(edge.sourceNodeId) &&
      visible.has(edge.targetNodeId)
        ? [edge.targetNodeId]
        : [],
    ),
  );
  const structuralRoot = [...visible]
    .filter((id) => !childIds.has(id) && nodeById.has(id))
    .sort((left, right) => {
      const leftNode = nodeById.get(left)!;
      const rightNode = nodeById.get(right)!;
      return (
        leftNode.sourceStartLine - rightNode.sourceStartLine ||
        compareText(left, right)
      );
    })[0];
  return structuralRoot === undefined
    ? {
        kind: 'module-anchor',
        moduleId,
        reason: 'no-visible-document-endpoint',
        attachmentSide: side,
      }
    : visibleEndpoint(
        structuralRoot,
        moduleId,
        side,
        nodeById,
        new Map(module.visibleEntityNodeIds.map((id) => [id, moduleId])),
      );
}

function deriveEndpointPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
): FocusSchematicEndpointPlan {
  const nodeById = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node] as const] : [],
    ),
  );
  const ownerByNodeId = new Map<ProjectionNodeId, EntityId>();
  for (const module of input.model.modules)
    for (const nodeId of module.visibleEntityNodeIds) {
      if (ownerByNodeId.has(nodeId))
        throw new Error(`Visible entity "${nodeId}" belongs to two modules.`);
      ownerByNodeId.set(nodeId, module.id);
    }
  const planByModuleId = new Map(
    modulePlan.modules.map((module) => [module.moduleId, module]),
  );
  const selectedRelationshipIds = new Set(
    modulePlan.modules.flatMap(({ parentRelationshipId }) =>
      parentRelationshipId === null ? [] : [parentRelationshipId],
    ),
  );
  const connections: FocusSchematicEndpointConnection[] = [];
  for (const relationship of [...input.model.relationships].sort(
    (left, right) => compareText(left.id, right.id),
  )) {
    const [sourceSide, targetSide] = attachmentSides(
      relationship.sourceModuleId,
      relationship.targetModuleId,
      planByModuleId,
    );
    const role = connectionRole(relationship, selectedRelationshipIds);
    const represented = new Set<ReferenceId>();
    for (const group of [...relationship.visibleEndpointGroups].sort(
      (left, right) => compareText(left.projectedEdgeId, right.projectedEdgeId),
    )) {
      const referenceIds = sortedUnique(group.referenceIds);
      for (const referenceId of referenceIds) {
        if (represented.has(referenceId))
          throw new Error(
            `Reference "${referenceId}" appears in more than one endpoint group for relationship "${relationship.id}".`,
          );
        represented.add(referenceId);
      }
      connections.push({
        id: `precise:${relationship.id}:${group.projectedEdgeId}`,
        kind: 'precise',
        relationshipId: relationship.id,
        projectedEdgeId: group.projectedEdgeId,
        referenceIds,
        sourceModuleId: relationship.sourceModuleId,
        targetModuleId: relationship.targetModuleId,
        source: visibleEndpoint(
          group.sourceProjectionNodeId,
          relationship.sourceModuleId,
          sourceSide,
          nodeById,
          ownerByNodeId,
        ),
        target: visibleEndpoint(
          group.targetProjectionNodeId,
          relationship.targetModuleId,
          targetSide,
          nodeById,
          ownerByNodeId,
        ),
        role,
      });
    }
    const relationshipReferenceIds = sortedUnique(relationship.referenceIds);
    const uncovered = relationshipReferenceIds.filter(
      (id) => !represented.has(id),
    );
    for (const referenceId of represented)
      if (!relationshipReferenceIds.includes(referenceId))
        throw new Error(
          `Endpoint group contains foreign ReferenceId "${referenceId}" for relationship "${relationship.id}".`,
        );
    if (uncovered.length > 0)
      connections.push({
        id: `fallback:${relationship.id}`,
        kind: 'fallback',
        relationshipId: relationship.id,
        projectedEdgeId: null,
        referenceIds: uncovered,
        sourceModuleId: relationship.sourceModuleId,
        targetModuleId: relationship.targetModuleId,
        source: fallbackEndpoint(
          relationship.sourceModuleId,
          sourceSide,
          input.model,
          input.projection,
          nodeById,
        ),
        target: fallbackEndpoint(
          relationship.targetModuleId,
          targetSide,
          input.model,
          input.projection,
          nodeById,
        ),
        role,
      });
  }
  connections.sort((left, right) => compareText(left.id, right.id));

  const demands = new Map<
    ProjectionNodeId,
    {
      moduleId: EntityId;
      sides: ('left' | 'right')[];
      sources: string[];
      targets: string[];
      backbone: string[];
      focusPath: string[];
    }
  >();
  for (const connection of connections) {
    if (connection.role === 'secondary') continue;
    for (const [endpointName, endpoint] of [
      ['source', connection.source] as const,
      ['target', connection.target] as const,
    ]) {
      if (
        endpoint.kind !== 'visible-entity' ||
        endpoint.attachmentSide === 'auto'
      )
        continue;
      const demand = demands.get(endpoint.projectionNodeId) ?? {
        moduleId: endpoint.moduleId,
        sides: [],
        sources: [],
        targets: [],
        backbone: [],
        focusPath: [],
      };
      demand.sides.push(endpoint.attachmentSide);
      (endpointName === 'source' ? demand.sources : demand.targets).push(
        connection.id,
      );
      if (connection.role === 'selected-backbone')
        demand.backbone.push(connection.id);
      else demand.focusPath.push(connection.id);
      demands.set(endpoint.projectionNodeId, demand);
    }
  }
  const nodeDemands: FocusSchematicNodeEndpointDemand[] = [...demands]
    .map(([projectionNodeId, demand]) => ({
      projectionNodeId,
      moduleId: demand.moduleId,
      directSides: sortedUnique(demand.sides),
      sourceConnectionIds: sortedUnique(demand.sources),
      targetConnectionIds: sortedUnique(demand.targets),
      selectedBackboneConnectionIds: sortedUnique(demand.backbone),
      focusPathConnectionIds: sortedUnique(demand.focusPath),
    }))
    .sort((left, right) =>
      compareText(left.projectionNodeId, right.projectionNodeId),
    );
  const precise = connections.filter(({ kind }) => kind === 'precise');
  const fallback = connections.filter(({ kind }) => kind === 'fallback');
  return {
    schemaVersion: 1,
    rootModuleId: input.model.rootModuleId,
    connections,
    nodeDemands,
    summary: {
      preciseConnectionCount: precise.length,
      fallbackConnectionCount: fallback.length,
      preciseReferenceIdCount: new Set(
        precise.flatMap(({ referenceIds }) => referenceIds),
      ).size,
      fallbackReferenceIdCount: new Set(
        fallback.flatMap(({ referenceIds }) => referenceIds),
      ).size,
      totalReferenceIdCount: new Set(
        input.model.relationships.flatMap(({ referenceIds }) => referenceIds),
      ).size,
    },
  };
}

export function createFocusSchematicEndpointPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
): FocusSchematicEndpointPlan {
  const plan = deriveEndpointPlan(input, modulePlan);
  const validation = validateFocusSchematicEndpointPlan(
    input,
    modulePlan,
    plan,
  );
  if (!validation.valid)
    throw new Error(
      `Invalid Focus Schematic endpoint plan: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return plan;
}

export function validateFocusSchematicEndpointPlan(
  input: FocusSchematicLayoutInput,
  modulePlan: FocusSchematicLayoutPlan,
  value: unknown,
): FocusSchematicEndpointValidationResult<FocusSchematicEndpointPlan> {
  if (!isPlainJson(value))
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Endpoint plan must be plain finite JSON data.' },
      ],
    };
  let expected: FocusSchematicEndpointPlan;
  try {
    expected = deriveEndpointPlan(input, modulePlan);
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          message: `Endpoint-plan source semantics are invalid: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
  if (canonicalJson(value) !== canonicalJson(expected))
    return {
      valid: false,
      issues: [
        {
          path: '$',
          message:
            'Endpoint plan does not exactly match visible endpoint groups, fallback provenance, roles, ranks, or deterministic ordering.',
        },
      ],
    };
  return {
    valid: true,
    value: value as FocusSchematicEndpointPlan,
    issues: [],
  };
}
