import type { EntityId, WorkspacePath } from '@icarus-graph-explorer/core';
import type {
  ProjectionWorkspace,
  ViewProjectionFilters,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import type {
  PersistedWorkspaceView,
  RestoredWorkspaceView,
  ViewRestoreIssue,
  ViewRestoreIssueCode,
} from './types';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function restoreIds(
  workspace: ProjectionWorkspace,
  ids: readonly EntityId[],
  code: ViewRestoreIssueCode,
  issues: ViewRestoreIssue[],
): EntityId[] {
  const restored: EntityId[] = [];
  for (const entityId of [...new Set(ids)].sort(compareText)) {
    if (workspace.entity(entityId) !== undefined) restored.push(entityId);
    else {
      issues.push({
        code,
        subject: entityId,
        message: `Saved entity "${entityId}" is no longer present and was removed from the view.`,
      });
    }
  }
  return restored;
}

function pathMatches(path: WorkspacePath, prefix: WorkspacePath): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function restoreFilters(
  workspace: ProjectionWorkspace,
  persisted: PersistedWorkspaceView['projection']['filters'],
  issues: ViewRestoreIssue[],
): ViewProjectionFilters | undefined {
  if (persisted === undefined) return undefined;
  const documentPaths = workspace
    .entities()
    .filter((entity) => entity.kind === 'document')
    .map((entity) => entity.source.path);
  const pathPrefixes = persisted.pathPrefixes?.filter((prefix) => {
    if (documentPaths.some((path) => pathMatches(path, prefix))) return true;
    issues.push({
      code: 'path-filter-no-longer-matches',
      subject: prefix,
      message: `Saved path prefix "${prefix}" no longer matches a document and was removed.`,
    });
    return false;
  });
  const filters: ViewProjectionFilters = {
    ...(pathPrefixes === undefined ? {} : { pathPrefixes }),
    ...(persisted.entityKinds === undefined
      ? {}
      : { entityKinds: [...persisted.entityKinds] }),
    ...(persisted.referenceStatuses === undefined
      ? {}
      : { referenceStatuses: [...persisted.referenceStatuses] }),
  };
  return filters.pathPrefixes === undefined &&
    filters.entityKinds === undefined &&
    filters.referenceStatuses === undefined
    ? undefined
    : filters;
}

export function restorePersistedWorkspaceView(
  workspace: ProjectionWorkspace,
  persisted: PersistedWorkspaceView,
): RestoredWorkspaceView {
  const workspaceId = workspace.snapshot().workspace.id;
  if (persisted.workspaceId !== workspaceId) {
    throw new Error(
      `Cannot restore saved view for workspace "${persisted.workspaceId}" into "${workspaceId}".`,
    );
  }

  const issues: ViewRestoreIssue[] = [];
  const collapsedEntityIds = restoreIds(
    workspace,
    persisted.projection.disclosure.collapsedEntityIds,
    'unknown-collapsed-entity',
    issues,
  );
  const collapsed = new Set(collapsedEntityIds);
  const expandedEntityIds = restoreIds(
    workspace,
    persisted.projection.disclosure.expandedEntityIds,
    'unknown-expanded-entity',
    issues,
  ).filter((entityId) => {
    if (!collapsed.has(entityId)) return true;
    issues.push({
      code: 'conflicting-disclosure-state',
      subject: entityId,
      message: `Saved entity "${entityId}" was expanded and collapsed; collapse took precedence.`,
    });
    return false;
  });
  const focus = persisted.projection.focus;
  const restoredFocus =
    focus === undefined || workspace.entity(focus.rootEntityId) !== undefined
      ? focus
      : undefined;
  if (focus !== undefined && restoredFocus === undefined) {
    issues.push({
      code: 'focus-root-missing',
      subject: focus.rootEntityId,
      message: `Saved focus root "${focus.rootEntityId}" is no longer present; focus was cleared.`,
    });
  }
  const filters = restoreFilters(
    workspace,
    persisted.projection.filters,
    issues,
  );
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: persisted.projection.disclosure.defaultDepth,
      expandedEntityIds,
      collapsedEntityIds,
      includeBlocks: persisted.projection.disclosure.includeBlocks,
    },
    ...(restoredFocus === undefined ? {} : { focus: restoredFocus }),
    ...(filters === undefined ? {} : { filters }),
  };
  const viewport = persisted.viewport;
  const restoredViewport =
    viewport === undefined ||
    workspace.entity(viewport.anchorEntityId) !== undefined
      ? viewport
      : undefined;
  if (viewport !== undefined && restoredViewport === undefined) {
    issues.push({
      code: 'viewport-anchor-missing',
      subject: viewport.anchorEntityId,
      message: `Saved viewport anchor "${viewport.anchorEntityId}" is no longer present; the current graph will be fitted.`,
    });
  }

  return {
    state,
    ...(restoredViewport === undefined ? {} : { viewport: restoredViewport }),
    issues,
  };
}
