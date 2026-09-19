import type { EntityId } from '@icarus-graph-explorer/core';
import type {
  ProjectionWorkspace,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export interface FocusHierarchySubfocus {
  readonly entityId: EntityId;
  readonly kind: 'section' | 'block';
}

export function sameFocusHierarchySubfocus(
  left: FocusHierarchySubfocus | null | undefined,
  right: FocusHierarchySubfocus | null | undefined,
): boolean {
  if (left == null || right == null) return left == null && right == null;
  return left.entityId === right.entityId && left.kind === right.kind;
}

/** Drops stale session-only targets without changing canonical Focus state. */
export function reconcileFocusHierarchySubfocus(
  workspace: ProjectionWorkspace,
  projection: ViewProjection,
  target: FocusHierarchySubfocus | null | undefined,
): FocusHierarchySubfocus | null {
  if (target == null) return null;
  const entity = workspace.entity(target.entityId);
  if (entity?.kind !== target.kind) return null;
  return projection.nodes.some(
    (node) =>
      node.kind === 'entity' &&
      node.entityId === target.entityId &&
      node.entityKind === target.kind,
  )
    ? target
    : null;
}
