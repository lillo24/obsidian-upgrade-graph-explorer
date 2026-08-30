import type { EntityId } from '@icarus-graph-explorer/core';

import type { ProjectionWorkspace } from './workspace';
import type { ProjectionIssue, StructuralDisclosureState } from './types';

export interface DisclosureResult {
  readonly visibleEntityIds: ReadonlySet<EntityId>;
  /** Private candidate IDs finalized against view filters before projection output. */
  readonly revealableDescendantIdsByEntityId: ReadonlyMap<
    EntityId,
    readonly EntityId[]
  >;
  readonly issues: readonly ProjectionIssue[];
}

function issue(
  code: ProjectionIssue['code'],
  subject: string,
  message: string,
): ProjectionIssue {
  return { code, subject, message };
}

export function calculateDisclosure(
  workspace: ProjectionWorkspace,
  state: StructuralDisclosureState,
): DisclosureResult {
  const issues: ProjectionIssue[] = [];
  const expanded = new Set<EntityId>();
  const collapsed = new Set<EntityId>();

  for (const entityId of [...new Set(state.expandedEntityIds)].sort()) {
    if (workspace.entity(entityId) === undefined) {
      issues.push(
        issue(
          'unknown-expanded-entity',
          entityId,
          `Expanded entity "${entityId}" is not present in the canonical snapshot.`,
        ),
      );
    } else {
      expanded.add(entityId);
    }
  }
  for (const entityId of [...new Set(state.collapsedEntityIds)].sort()) {
    if (workspace.entity(entityId) === undefined) {
      issues.push(
        issue(
          'unknown-collapsed-entity',
          entityId,
          `Collapsed entity "${entityId}" is not present in the canonical snapshot.`,
        ),
      );
    } else {
      collapsed.add(entityId);
    }
  }
  for (const entityId of [...expanded].sort()) {
    if (collapsed.has(entityId)) {
      issues.push(
        issue(
          'conflicting-disclosure-state',
          entityId,
          `Entity "${entityId}" is both expanded and collapsed; collapse takes precedence.`,
        ),
      );
    }
  }

  const visible = new Set<EntityId>();
  const depthByEntityId = new Map<EntityId, number>();
  const visitChildren = (parentId: EntityId, depth: number): void => {
    if (collapsed.has(parentId)) return;
    for (const child of workspace.children(parentId)) {
      const withinHeadingLimit =
        child.kind !== 'section' ||
        state.maxSectionLevel === undefined ||
        child.level <= state.maxSectionLevel;
      if (!withinHeadingLimit) continue;
      const visibleByDepth =
        child.kind === 'section' && depth <= state.defaultDepth;
      const visibleByExpansion =
        expanded.has(parentId) &&
        (child.kind !== 'block' || state.includeBlocks);
      if (!visibleByDepth && !visibleByExpansion) continue;
      visible.add(child.id);
      depthByEntityId.set(child.id, depth);
      visitChildren(child.id, depth + 1);
    }
  };

  for (const entity of workspace.entities()) {
    if (entity.kind !== 'document') continue;
    visible.add(entity.id);
    depthByEntityId.set(entity.id, 0);
    visitChildren(entity.id, 1);
  }

  const visibleParentIds = new Set<EntityId>();
  for (const entityId of visible) {
    const parent = workspace.parent(entityId);
    if (parent !== undefined && visible.has(parent.id)) {
      visibleParentIds.add(parent.id);
    }
  }

  const revealableByEntityId = new Map<EntityId, readonly EntityId[]>();
  const collectRevealableChildren = (
    ownerId: EntityId,
    parentId: EntityId,
    depth: number,
    result: EntityId[],
  ): void => {
    if (parentId !== ownerId && collapsed.has(parentId)) return;
    const parentExpanded = parentId === ownerId || expanded.has(parentId);
    for (const child of workspace.children(parentId)) {
      const withinHeadingLimit =
        child.kind !== 'section' ||
        state.maxSectionLevel === undefined ||
        child.level <= state.maxSectionLevel;
      if (!withinHeadingLimit) continue;
      const visibleByDepth =
        child.kind === 'section' && depth <= state.defaultDepth;
      const visibleByExpansion =
        parentExpanded && (child.kind !== 'block' || state.includeBlocks);
      if (!visibleByDepth && !visibleByExpansion) continue;
      if (!visible.has(child.id)) result.push(child.id);
      collectRevealableChildren(ownerId, child.id, depth + 1, result);
    }
  };

  for (const entity of workspace.entities()) {
    if (!visible.has(entity.id) || visibleParentIds.has(entity.id)) continue;

    // When an already-expanded entity has no visible children, another Expand
    // action cannot change disclosure state (for example, Blocks are disabled).
    if (expanded.has(entity.id) && !collapsed.has(entity.id)) continue;

    const descendants: EntityId[] = [];
    collectRevealableChildren(
      entity.id,
      entity.id,
      (depthByEntityId.get(entity.id) ?? 0) + 1,
      descendants,
    );
    if (descendants.length > 0) {
      revealableByEntityId.set(entity.id, descendants);
    }
  }

  return {
    visibleEntityIds: visible,
    revealableDescendantIdsByEntityId: revealableByEntityId,
    issues: issues.sort(
      (left, right) =>
        (left.code < right.code ? -1 : left.code > right.code ? 1 : 0) ||
        (left.subject < right.subject
          ? -1
          : left.subject > right.subject
            ? 1
            : 0),
    ),
  };
}
