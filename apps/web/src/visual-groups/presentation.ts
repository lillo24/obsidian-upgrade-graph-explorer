import type { AddressableEntity, EntityId } from '@icarus-graph-explorer/core';
import {
  assignPrimaryVisualGroupPresentations,
  type CompiledVisualGroups,
  type VisualGroupPresentationMap,
} from '@icarus-graph-explorer/visual-groups';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

/** Collects only canonical IDs represented by entity nodes; diagnostics opt out. */
export function visualGroupEntityIdsForProjection(
  projection: Pick<ViewProjection, 'nodes'>,
): readonly EntityId[] {
  const ids = new Set<EntityId>();
  for (const node of projection.nodes) {
    if (node.kind === 'entity') ids.add(node.entityId);
  }
  return [...ids];
}

/**
 * Derives presentation for an already-selected entity subset. Projection stays
 * an upstream concern; this helper deliberately has no projectView call.
 */
export function deriveVisualGroupPresentationMap(
  entityIds: Iterable<EntityId>,
  entityById: ReadonlyMap<EntityId, AddressableEntity>,
  compiled: CompiledVisualGroups,
): VisualGroupPresentationMap {
  const entities: AddressableEntity[] = [];
  const seen = new Set<EntityId>();
  for (const entityId of entityIds) {
    if (seen.has(entityId)) continue;
    seen.add(entityId);
    const entity = entityById.get(entityId);
    if (entity === undefined) {
      throw new Error(
        `Cannot derive Visual Group presentation for missing canonical entity ${JSON.stringify(entityId)}.`,
      );
    }
    entities.push(entity);
  }
  return assignPrimaryVisualGroupPresentations(entities, compiled);
}

export function deriveProjectionVisualGroupPresentationMap(
  projection: Pick<ViewProjection, 'nodes'>,
  entityById: ReadonlyMap<EntityId, AddressableEntity>,
  compiled: CompiledVisualGroups,
): VisualGroupPresentationMap {
  return deriveVisualGroupPresentationMap(
    visualGroupEntityIdsForProjection(projection),
    entityById,
    compiled,
  );
}
