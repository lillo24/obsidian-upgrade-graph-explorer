import type { EntityId, WorkspacePath } from '@icarus-graph-explorer/core';
import { parseGraphQuery } from '@icarus-graph-explorer/graph-query';
import type {
  ProjectionWorkspace,
  ViewProjectionFilters,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import { containingDocumentEntityId } from '@icarus-graph-explorer/view-projection';

import type {
  PersistedWorkspaceView,
  PersistedViewportAnchor,
  PersistedRendererViewports,
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
    ...(persisted.query === undefined ? {} : { query: persisted.query }),
  };
  return filters.pathPrefixes === undefined &&
    filters.entityKinds === undefined &&
    filters.referenceStatuses === undefined &&
    filters.text === undefined &&
    filters.query === undefined
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
        leftFilters.query === rightFilters.query &&
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
  viewports: PersistedRendererViewports,
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
  const reconcileViewport = <
    Viewport extends { readonly anchorEntityId: string },
  >(
    viewport: Viewport | undefined,
    renderer: 'Structure' | 'Global' | 'Local',
  ): Viewport | undefined => {
    if (
      viewport === undefined ||
      workspace.entity(viewport.anchorEntityId) !== undefined
    ) {
      return viewport;
    }
    issues.push({
      code: 'viewport-anchor-missing',
      subject: viewport.anchorEntityId,
      message: `${origin} ${renderer} viewport anchor "${viewport.anchorEntityId}" is no longer present; that graph will be fitted.`,
    });
    return undefined;
  };
  const structure = reconcileViewport(viewports.structure, 'Structure');
  const global = reconcileViewport(viewports.global, 'Global');
  const local = reconcileViewport(viewports.local, 'Local');
  const restoredViewports: PersistedRendererViewports = {
    ...(structure === undefined ? {} : { structure }),
    ...(global === undefined ? {} : { global }),
    ...(local === undefined ? {} : { local }),
  };

  return {
    state,
    viewports: restoredViewports,
    ...(structure === undefined ? {} : { viewport: structure }),
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
  viewportsOrViewport:
    PersistedRendererViewports | PersistedViewportAnchor = {},
): ReconciledCurrentWorkspaceView {
  const viewports: PersistedRendererViewports =
    'anchorEntityId' in viewportsOrViewport
      ? { structure: viewportsOrViewport }
      : viewportsOrViewport;
  return reconcileWorkspaceView(workspace, current, viewports, 'Current', true);
}

export function restorePersistedWorkspaceView(
  workspace: ProjectionWorkspace,
  persisted: PersistedWorkspaceView,
): RestoredWorkspaceView {
  const workspaceId = workspace.snapshot().workspace.id;
  if (persisted.workspaceId !== workspaceId) {
    throw new Error(
      `Cannot restore persisted workspace view for workspace "${persisted.workspaceId}" into "${workspaceId}".`,
    );
  }

  const persistedFilters = persisted.projection.filters;
  const parsedQuery =
    persistedFilters?.query === undefined
      ? undefined
      : parseGraphQuery(persistedFilters.query);
  if (parsedQuery !== undefined && !parsedQuery.valid) {
    throw new Error(
      'Cannot restore a persisted view with an invalid graph query.',
    );
  }
  const normalizedFilters =
    persistedFilters === undefined
      ? undefined
      : {
          ...persistedFilters,
          ...(parsedQuery === undefined
            ? {}
            : { query: parsedQuery.canonical }),
        };
  const persistedFocus = persisted.projection.focus;
  const localRootEntityId =
    persisted.presentationMode === 'local' && persistedFocus !== undefined
      ? containingDocumentEntityId(workspace, persistedFocus.rootEntityId)
      : undefined;
  const normalizedFocus =
    persisted.presentationMode === 'local' && persistedFocus !== undefined
      ? localRootEntityId === undefined
        ? persistedFocus
        : { ...persistedFocus, rootEntityId: localRootEntityId }
      : persistedFocus;
  const persistedDisclosure = persisted.projection.disclosure;
  // Earlier schema-v3 Local entry encoded its automatic top-level detail as
  // depth 0 plus an expanded document root. That root-only signature is
  // normalized on read while every other manual override remains untouched.
  const legacyLocalRootExpansion =
    localRootEntityId !== undefined &&
    persistedDisclosure.defaultDepth === 0 &&
    persistedDisclosure.expandedEntityIds.includes(localRootEntityId);
  const localExpanded = legacyLocalRootExpansion
    ? persistedDisclosure.expandedEntityIds.filter(
        (entityId) => entityId !== localRootEntityId,
      )
    : persistedDisclosure.expandedEntityIds;
  const state: ViewProjectionState = {
    disclosure: {
      defaultDepth: persistedDisclosure.defaultDepth,
      ...(persistedDisclosure.maxSectionLevel === undefined
        ? {}
        : {
            maxSectionLevel: persistedDisclosure.maxSectionLevel,
          }),
      expandedEntityIds: localExpanded,
      collapsedEntityIds: persistedDisclosure.collapsedEntityIds,
      includeBlocks: persistedDisclosure.includeBlocks,
    },
    ...(normalizedFocus === undefined ? {} : { focus: normalizedFocus }),
    ...(normalizedFilters === undefined ? {} : { filters: normalizedFilters }),
  };
  const reconciled = reconcileWorkspaceView(
    workspace,
    state,
    persisted.viewports ?? {},
    'Saved',
    false,
  );
  const legacyIssue: ViewRestoreIssue | undefined =
    legacyLocalRootExpansion && localRootEntityId !== undefined
      ? {
          code: 'legacy-local-root-expansion-removed',
          subject: localRootEntityId,
          message:
            `Saved Focus root "${localRootEntityId}" used the earlier automatic ` +
            'expansion marker; that marker was removed while other disclosure choices were preserved.',
        }
      : undefined;
  return {
    ...reconciled,
    issues:
      legacyIssue === undefined
        ? reconciled.issues
        : [legacyIssue, ...reconciled.issues],
    presentationMode:
      persisted.presentationMode === 'local' &&
      reconciled.state.focus === undefined
        ? 'global'
        : persisted.presentationMode,
  };
}
