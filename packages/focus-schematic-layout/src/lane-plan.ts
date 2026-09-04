import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  ProjectionEdgeId,
  ProjectionNodeId,
} from '@icarus-graph-explorer/view-projection';

import type {
  FocusSchematicDemandMask,
  FocusSchematicEndpointPlan,
  FocusSchematicEndpointValidationResult,
  FocusSchematicInternalHierarchyAttachment,
  FocusSchematicInternalLane,
  FocusSchematicInternalLaneNode,
  FocusSchematicInternalLanePlan,
  FocusSchematicLayoutInput,
} from './types';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

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

function maskFromSides(
  sides: readonly ('left' | 'right')[],
): FocusSchematicDemandMask {
  const left = sides.includes('left');
  const right = sides.includes('right');
  return left && right ? 'both' : left ? 'left' : right ? 'right' : 'none';
}

function unionMasks(
  masks: readonly FocusSchematicDemandMask[],
): FocusSchematicDemandMask {
  return maskFromSides(
    masks.flatMap((mask) =>
      mask === 'both'
        ? (['left', 'right'] as const)
        : mask === 'left' || mask === 'right'
          ? [mask]
          : [],
    ),
  );
}

function hierarchyAttachment(
  edgeId: ProjectionEdgeId,
  sourceNodeId: ProjectionNodeId,
  targetNodeId: ProjectionNodeId,
  sourceLane: FocusSchematicInternalLane,
  targetLane: FocusSchematicInternalLane,
): FocusSchematicInternalHierarchyAttachment {
  if (sourceLane === 'center' && targetLane === 'left')
    return {
      hierarchyEdgeId: edgeId,
      sourceProjectionNodeId: sourceNodeId,
      targetProjectionNodeId: targetNodeId,
      sourceSide: 'left',
      targetSide: 'right',
    };
  if (sourceLane === 'center' && targetLane === 'right')
    return {
      hierarchyEdgeId: edgeId,
      sourceProjectionNodeId: sourceNodeId,
      targetProjectionNodeId: targetNodeId,
      sourceSide: 'right',
      targetSide: 'left',
    };
  if (sourceLane === 'left' && targetLane === 'left')
    return {
      hierarchyEdgeId: edgeId,
      sourceProjectionNodeId: sourceNodeId,
      targetProjectionNodeId: targetNodeId,
      sourceSide: 'left',
      targetSide: 'right',
    };
  if (sourceLane === 'right' && targetLane === 'right')
    return {
      hierarchyEdgeId: edgeId,
      sourceProjectionNodeId: sourceNodeId,
      targetProjectionNodeId: targetNodeId,
      sourceSide: 'right',
      targetSide: 'left',
    };
  if (sourceLane === 'center' && targetLane === 'center')
    return {
      hierarchyEdgeId: edgeId,
      sourceProjectionNodeId: sourceNodeId,
      targetProjectionNodeId: targetNodeId,
      sourceSide: 'bottom',
      targetSide: 'top',
    };
  return {
    hierarchyEdgeId: edgeId,
    sourceProjectionNodeId: sourceNodeId,
    targetProjectionNodeId: targetNodeId,
    sourceSide: 'auto',
    targetSide: 'auto',
  };
}

function deriveInternalLanePlan(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
): FocusSchematicInternalLanePlan {
  const nodeById = new Map(
    input.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node] as const] : [],
    ),
  );
  const demandByNodeId = new Map(
    endpointPlan.nodeDemands.map((demand) => [demand.projectionNodeId, demand]),
  );
  const ownerByNodeId = new Map<ProjectionNodeId, EntityId>();
  for (const module of input.model.modules)
    for (const nodeId of module.visibleEntityNodeIds) {
      if (ownerByNodeId.has(nodeId))
        throw new Error(`Visible entity "${nodeId}" belongs to two modules.`);
      ownerByNodeId.set(nodeId, module.id);
    }

  const laneNodes: FocusSchematicInternalLaneNode[] = [];
  const attachments: FocusSchematicInternalHierarchyAttachment[] = [];
  for (const module of [...input.model.modules].sort((left, right) =>
    compareText(left.id, right.id),
  )) {
    const visible = new Set(module.visibleEntityNodeIds);
    if (module.presentation === 'filtered') {
      if (visible.size !== 0)
        throw new Error(`Filtered module "${module.id}" has visible entities.`);
      continue;
    }
    if (visible.size === 0)
      throw new Error(`Visible module "${module.id}" has no visible entities.`);
    for (const nodeId of visible)
      if (!nodeById.has(nodeId))
        throw new Error(
          `Module "${module.id}" references missing entity node "${nodeId}".`,
        );

    const hierarchyIds = new Set(module.hierarchyEdgeIds);
    const edges = input.projection.edges
      .filter((edge) => hierarchyIds.has(edge.id))
      .sort((left, right) => compareText(left.id, right.id));
    if (edges.some(({ kind }) => kind !== 'hierarchy'))
      throw new Error(`Module "${module.id}" contains a non-hierarchy edge.`);
    const parentByNodeId = new Map<ProjectionNodeId, ProjectionNodeId>();
    const childrenByNodeId = new Map<ProjectionNodeId, ProjectionNodeId[]>();
    for (const edge of edges) {
      if (edge.kind !== 'hierarchy') continue;
      if (!visible.has(edge.sourceNodeId) || !visible.has(edge.targetNodeId))
        throw new Error(
          `Hierarchy edge "${edge.id}" crosses or escapes module "${module.id}".`,
        );
      if (parentByNodeId.has(edge.targetNodeId))
        throw new Error(
          `Visible hierarchy node "${edge.targetNodeId}" has multiple parents.`,
        );
      parentByNodeId.set(edge.targetNodeId, edge.sourceNodeId);
      const children = childrenByNodeId.get(edge.sourceNodeId) ?? [];
      children.push(edge.targetNodeId);
      childrenByNodeId.set(edge.sourceNodeId, children);
    }
    const nodeOrder = (left: ProjectionNodeId, right: ProjectionNodeId) => {
      const leftNode = nodeById.get(left)!;
      const rightNode = nodeById.get(right)!;
      return (
        leftNode.sourceStartLine - rightNode.sourceStartLine ||
        compareText(left, right)
      );
    };
    for (const children of childrenByNodeId.values()) children.sort(nodeOrder);
    const roots = [...visible]
      .filter((nodeId) => !parentByNodeId.has(nodeId))
      .sort((left, right) => {
        const leftDocument = left === module.documentProjectionNodeId;
        const rightDocument = right === module.documentProjectionNodeId;
        return (
          Number(rightDocument) - Number(leftDocument) || nodeOrder(left, right)
        );
      });
    if (roots.length === 0)
      throw new Error(
        `Hierarchy forest for module "${module.id}" has no root.`,
      );

    const directMaskByNodeId = new Map<
      ProjectionNodeId,
      FocusSchematicDemandMask
    >(
      [...visible].map((nodeId) => [
        nodeId,
        maskFromSides(demandByNodeId.get(nodeId)?.directSides ?? []),
      ]),
    );
    const subtreeMaskByNodeId = new Map<
      ProjectionNodeId,
      FocusSchematicDemandMask
    >();
    const visiting = new Set<ProjectionNodeId>();
    const visit = (nodeId: ProjectionNodeId): FocusSchematicDemandMask => {
      const cached = subtreeMaskByNodeId.get(nodeId);
      if (cached !== undefined) return cached;
      if (visiting.has(nodeId))
        throw new Error(`Hierarchy cycle includes "${nodeId}".`);
      visiting.add(nodeId);
      const mask = unionMasks([
        directMaskByNodeId.get(nodeId) ?? 'none',
        ...(childrenByNodeId.get(nodeId) ?? []).map(visit),
      ]);
      visiting.delete(nodeId);
      subtreeMaskByNodeId.set(nodeId, mask);
      return mask;
    };
    roots.forEach(visit);
    if (subtreeMaskByNodeId.size !== visible.size)
      throw new Error(
        `Hierarchy traversal for module "${module.id}" did not cover every visible entity.`,
      );

    const laneByNodeId = new Map<
      ProjectionNodeId,
      FocusSchematicInternalLane
    >();
    const assign = (
      nodeId: ProjectionNodeId,
      parentLane: FocusSchematicInternalLane | null,
    ) => {
      const node = nodeById.get(nodeId)!;
      const directDemand = directMaskByNodeId.get(nodeId) ?? 'none';
      const subtreeDemand = subtreeMaskByNodeId.get(nodeId) ?? 'none';
      let lane: FocusSchematicInternalLane;
      let reason: FocusSchematicInternalLaneNode['reason'];
      if (node.entityKind === 'document') {
        lane = 'center';
        reason = 'document-core';
      } else if (subtreeDemand === 'left') {
        lane = 'left';
        reason = 'left-subtree';
      } else if (subtreeDemand === 'right') {
        lane = 'right';
        reason = 'right-subtree';
      } else if (subtreeDemand === 'both') {
        lane = 'center';
        reason = 'mixed-ancestor';
      } else if (parentLane === 'left' || parentLane === 'right') {
        lane = parentLane;
        reason = 'neutral-inherited';
      } else {
        lane = 'center';
        reason = 'neutral-center';
      }
      laneByNodeId.set(nodeId, lane);
      laneNodes.push({
        projectionNodeId: nodeId,
        moduleId: module.id,
        lane,
        directDemand,
        subtreeDemand,
        reason,
      });
      for (const childId of childrenByNodeId.get(nodeId) ?? [])
        assign(childId, lane);
    };
    roots.forEach((root) => assign(root, null));

    for (const edge of edges) {
      if (edge.kind !== 'hierarchy') continue;
      const sourceLane = laneByNodeId.get(edge.sourceNodeId);
      const targetLane = laneByNodeId.get(edge.targetNodeId);
      if (sourceLane === undefined || targetLane === undefined)
        throw new Error(
          `Hierarchy edge "${edge.id}" is missing a lane endpoint.`,
        );
      if (
        (sourceLane === 'left' && targetLane === 'right') ||
        (sourceLane === 'right' && targetLane === 'left')
      )
        throw new Error(
          `Hierarchy edge "${edge.id}" crosses directly between opposite side lanes.`,
        );
      attachments.push(
        hierarchyAttachment(
          edge.id,
          edge.sourceNodeId,
          edge.targetNodeId,
          sourceLane,
          targetLane,
        ),
      );
    }
  }
  laneNodes.sort((left, right) =>
    compareText(left.projectionNodeId, right.projectionNodeId),
  );
  attachments.sort((left, right) =>
    compareText(left.hierarchyEdgeId, right.hierarchyEdgeId),
  );
  return {
    schemaVersion: 1,
    rootModuleId: input.model.rootModuleId,
    nodes: laneNodes,
    hierarchyAttachments: attachments,
  };
}

export function createFocusSchematicInternalLanePlan(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
): FocusSchematicInternalLanePlan {
  const plan = deriveInternalLanePlan(input, endpointPlan);
  const validation = validateFocusSchematicInternalLanePlan(
    input,
    endpointPlan,
    plan,
  );
  if (!validation.valid)
    throw new Error(
      `Invalid Focus Schematic internal lane plan: ${validation.issues
        .map(({ path, message }) => `${path}: ${message}`)
        .join('; ')}`,
    );
  return plan;
}

export function validateFocusSchematicInternalLanePlan(
  input: FocusSchematicLayoutInput,
  endpointPlan: FocusSchematicEndpointPlan,
  value: unknown,
): FocusSchematicEndpointValidationResult<FocusSchematicInternalLanePlan> {
  if (!isPlainJson(value))
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Lane plan must be plain finite JSON data.' },
      ],
    };
  let expected: FocusSchematicInternalLanePlan;
  try {
    expected = deriveInternalLanePlan(input, endpointPlan);
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          message: `Lane-plan hierarchy semantics are invalid: ${error instanceof Error ? error.message : String(error)}`,
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
            'Lane plan does not exactly match endpoint demands, subtree propagation, neutral inheritance, hierarchy attachments, or deterministic ordering.',
        },
      ],
    };
  return {
    valid: true,
    value: value as FocusSchematicInternalLanePlan,
    issues: [],
  };
}
