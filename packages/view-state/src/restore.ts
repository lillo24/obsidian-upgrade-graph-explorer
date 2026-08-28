import type { EntityId, WorkspacePath } from '@icarus-graph-explorer/core';
import type {
  ProjectionWorkspace,
  ViewProjectionFilters,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import type {
  PersistedWorkspaceView,
  PersistedViewportAnchor,
  ReconciledCurrentWorkspaceView,
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
  origin = 'Saved',
): EntityId[] {
  const restored: EntityId[] = [];
  for (const entityId of [...new Set(ids)].sort(compareText)) {
    if (workspace.entity(entityId) !== undefined) restored.push(entityId);
    else {
      issues.push({
        code,
        subject: entityId,
        message: `${origin} entity "${entityId}" is no longer present and was removed from the view.`,
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
  persisted: ViewProjectionFilters | undefined,
  issues: ViewRestoreIssue[],
  origin = 'Saved',
  dropExhaustedPathScope = false,
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
      message: `${origin} path prefix "${prefix}" no longer matches a document and was removed.`,
    });
    return false;
  });
  const reconciledPathPrefixes =
    dropExhaustedPathScope &&
    persisted.pathPrefixes !== undefined &&
    persisted.pathPrefixes.length > 0 &&
    pathPrefixes?.length === 0
      ? undefined
      : pathPrefixes;
  const filters: ViewProjectionFilters = {
    ...(reconciledPathPrefixes === undefined
      ? {}
      : { pathPrefixes: reconciledPathPrefixes }),
    ...(persisted.entityKinds === undefined
      ? {}
      : { entityKinds: [...persisted.entityKinds] }),
    ...(persisted.referenceStatuses === undefined
      ? {}
      : { referenceStatuses: [...persisted.referenceStatuses] }),
    ...(persisted.text === undefined ? {} : { text: persisted.text }),
  };
  return filters.pathPrefixes === undefined &&
    filters.entityKinds === undefined &&
    filters.referenceStatuses === undefined &&
    filters.text === undefined
    ? undefined
    : filters;
}

function sameValues<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean {
  return (
    left === right ||
    (left !== undefined &&
      right !== undefined &&
      left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

function sameViewState(
  left: ViewProjectionState,
  right: ViewProjectionState,
): boolean {
  const leftDisclosure = left.disclosure;
  const rightDisclosure = right.disclosure;
  const leftFocus = left.focus;
  const rightFocus = right.focus;
  const leftFilters = left.filters;
  const rightFilters = right.filters;
  return (
    leftDisclosure.defaultDepth === rightDisclosure.defaultDepth &&
    leftDisclosure.maxSectionLevel === rightDisclosure.maxSectionLevel &&
    leftDisclosure.includeBlocks === rightDisclosure.includeBlocks &&
    sameValues(
      leftDisclosure.expandedEntityIds,
      rightDisclosure.expandedEntityIds,
    ) &&
    sameValues(
      leftDisclosure.collapsedEntityIds,
      rightDisclosure.collapsedEntityIds,
    ) &&
    ((leftFocus === undefined && rightFocus === undefined) ||
      (leftFocus !== undefined &&
        rightFocus !== undefined &&
        leftFocus.rootEntityId === rightFocus.rootEntityId &&
        leftFocus.hops === rightFocus.hops &&
        leftFocus.direction === rightFocus.direction &&
        leftFocus.hierarchyContext === rightFocus.hierarchyContext)) &&
    ((leftFilters === undefined && rightFilters === undefined) ||
      (leftFilters !== undefined &&
        rightFilters !== undefined &&
        leftFilters.text === rightFilters.text &&
        sameValues(leftFilters.pathPrefixes, rightFilters.pathPrefixes) &&
        sameValues(leftFilters.entityKinds, rightFilters.entityKinds) &&
        sameValues(
          leftFilters.referenceStatuses,
          rightFilters.referenceStatuses,
        )))
  );
}

function reconcileWorkspaceView(
  workspace: ProjectionWorkspace,
  current: ViewProjectionState,
  viewport: PersistedViewportAnchor | undefined,
  origin: 'Saved' | 'Current',
  dropExhaustedPathScope: boolean,
): ReconciledCurrentWorkspaceView {
  const issues: ViewRestoreIssue[] = [];
  const collapsedEntityIds = restoreIds(
    workspace,
    current.disclosure.collapsedEntityIds,
    'unknown-collapsed-entity',
    issues,
    origin,
  );
  const collapsed = new Set(collapsedEntityIds);
  const expandedEntityIds = restoreIds(
    workspace,
    current.disclosure.expandedEntityIds,
    'unknown-expanded-entity',
    issues,
    origin,
  ).filter((entityId) => {
    if (!collapsed.has(entityId)) return true;
    issues.push({
      code: 'conflicting-disclosure-state',
      subject: entityId,
      message: `${origin} entity "${entityId}" was expanded and collapsed; collapse took precedence.`,
    });
    return false;
  });
  const focus = current.focus;
  const restoredFocus =
    focus === undefined || workspace.entity(focus.rootEntityId) !== undefined
      ? focus
      : undefined;
  if (focus !== undefined && restoredFocus === undefined) {
    issues.push({
      code: 'focus-root-missing',
      subject: focus.rootEntityId,
      message: `${origin} focus root "${focus.rootEntityId}" is no longer present; focus was cleared.`,
    });
  }
  const filters = restoreFilters(
    workspace,
    current.filters,
    issues,
    origin,
    dropExhaustedPathScope,
  );
  const reconciled: ViewProjectionState = {
    disclosure: {
      ...current.disclosure,
      expandedEntityIds,
      collapsedEntityIds,
    },
    ...(restoredFocus === undefined ? {} : { focus: restoredFocus }),
    ...(filters === undefined ? {} : { filters }),
  };
  const state = sameViewState(current, reconciled) ? current : reconciled;
  const restoredViewport =
    viewport === undefined ||
    workspace.entity(viewport.anchorEntityId) !== undefined
      ? viewport
      : undefined;
  if (viewport !== undefined && restoredViewport === undefined) {
    issues.push({
      code: 'viewport-anchor-missing',
      subject: viewport.anchorEntityId,
      message: `${origin} viewport anchor "${viewport.anchorEntityId}" is no longer present; the current graph will be fitted.`,
    });
  }

  return {
    state,
    ...(restoredViewport === undefined ? {} : { viewport: restoredViewport }),
    issues,
  };
}

/**
 * Reconciles the current, in-memory view against a newer snapshot of the same
 * workspace. Unlike persisted hydration, transient text filtering is retained.
 */
export function reconcileCurrentWorkspaceView(
  workspace: ProjectionWorkspace,
  current: ViewProjectionState,
  viewport?: PersistedViewportAnchor,
): ReconciledCurrentWorkspaceView {
  return reconcileWorkspaceView(workspace, current, viewport, 'Current', true);
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

  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: persisted.projection.disclosure.defaultDepth,
      ...(persisted.projection.disclosure.maxSectionLevel === undefined
        ? {}
        : {
            maxSectionLevel: persisted.projection.disclosure.maxSectionLevel,
          }),
      expandedEntityIds: persisted.projection.disclosure.expandedEntityIds,
      collapsedEntityIds: persisted.projection.disclosure.collapsedEntityIds,
      includeBlocks: persisted.projection.disclosure.includeBlocks,
    },
    ...(persisted.projection.focus === undefined
      ? {}
      : { focus: persisted.projection.focus }),
    ...(persisted.projection.filters === undefined
      ? {}
      : { filters: persisted.projection.filters }),
  };
  return reconcileWorkspaceView(
    workspace,
    state,
    persisted.viewport,
    'Saved',
    false,
  );
}
