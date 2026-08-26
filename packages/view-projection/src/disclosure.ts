import type { EntityId } from '@icarus-graph-explorer/core';

import type { ProjectionWorkspace } from './workspace';
import type { ProjectionIssue, StructuralDisclosureState } from './types';

export interface DisclosureResult {
  readonly visibleEntityIds: ReadonlySet<EntityId>;
  readonly hiddenDescendantCountByEntityId: ReadonlyMap<EntityId, number>;
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
  const visitChildren = (parentId: EntityId, depth: number): void => {
    if (collapsed.has(parentId)) return;
    for (const child of workspace.children(parentId)) {
      const visibleByDepth =
        child.kind === 'section' && depth <= state.defaultDepth;
      const visibleByExpansion =
        expanded.has(parentId) &&
        (child.kind !== 'block' || state.includeBlocks);
      if (!visibleByDepth && !visibleByExpansion) continue;
      visible.add(child.id);
      visitChildren(child.id, depth + 1);
    }
  };

  for (const entity of workspace.entities()) {
    if (entity.kind !== 'document') continue;
    visible.add(entity.id);
    visitChildren(entity.id, 1);
  }

  const hiddenCounts = new Map<EntityId, number>();
  for (const entityId of visible) {
    hiddenCounts.set(
      entityId,
      workspace
        .descendants(entityId)
        .filter((descendant) => !visible.has(descendant.id)).length,
    );
  }

  return {
    visibleEntityIds: visible,
    hiddenDescendantCountByEntityId: hiddenCounts,
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
