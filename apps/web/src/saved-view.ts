import {
  createPersistedWorkspaceView,
  restorePersistedWorkspaceView,
  serializePersistedWorkspaceView,
  type GraphPresentationMode,
  type LocalLayoutMode,
  type PersistedRendererViewports,
  type ViewRestoreIssue,
} from '@icarus-graph-explorer/view-state';
import type {
  ProjectionWorkspace,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import {
  focusLayoutMode,
  resolveAvailablePresentationMode,
  type ExplorationAvailability,
} from './exploration-model';
import {
  SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
  validateSavedViewRegistry,
  type SavedViewEntry,
  type SavedViewLayout,
} from './persistence/saved-views';

export interface SavedViewApplyPlan {
  readonly state: ViewProjectionState;
  readonly presentationMode: GraphPresentationMode;
  readonly localLayoutMode: LocalLayoutMode;
  readonly viewports: PersistedRendererViewports;
  readonly issues: readonly ViewRestoreIssue[];
  readonly adjustment?: string;
}

/** Captures only the applied semantic graph state and renderer-independent bookmarks. */
export function captureSavedView({
  name,
  workspace,
  state,
  presentationMode,
  layout,
  viewports,
}: {
  readonly name: string;
  readonly workspace: ProjectionWorkspace;
  readonly state: ViewProjectionState;
  readonly presentationMode: GraphPresentationMode;
  readonly layout: SavedViewLayout;
  readonly viewports: PersistedRendererViewports;
}): SavedViewEntry {
  const workspaceId = workspace.snapshot().workspace.id;
  const entry: SavedViewEntry = {
    name: name.trim(),
    layout,
    view: createPersistedWorkspaceView({
      workspace,
      state,
      presentationMode,
      viewports,
    }),
  };
  const validation = validateSavedViewRegistry(
    {
      schemaVersion: SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
      workspaceId,
      views: [entry],
    },
    workspaceId,
  );
  if (!validation.valid) throw new Error(validation.message);
  return validation.value.views[0]!;
}

/** Reconciles the immutable snapshot, then applies current product availability. */
export function planSavedViewApply({
  entry,
  workspace,
  availability,
}: {
  readonly entry: SavedViewEntry;
  readonly workspace: ProjectionWorkspace;
  readonly availability: ExplorationAvailability;
}): SavedViewApplyPlan {
  const workspaceId = workspace.snapshot().workspace.id;
  const validation = validateSavedViewRegistry(
    {
      schemaVersion: SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
      workspaceId,
      views: [entry],
    },
    workspaceId,
  );
  if (!validation.valid) throw new Error(validation.message);
  const validated = validation.value.views[0]!;
  const restored = restorePersistedWorkspaceView(workspace, validated.view);
  const presentationMode = resolveAvailablePresentationMode(
    restored.presentationMode,
    restored.state,
    availability,
  );
  const adjustment =
    validated.view.presentationMode === 'local' &&
    restored.presentationMode !== 'local'
      ? `The saved Focus root no longer exists, so "${validated.name}" opened in All ${
          presentationMode === 'global' ? 'Network' : 'Hierarchy'
        }.`
      : restored.presentationMode === presentationMode
        ? undefined
        : restored.presentationMode === 'structure'
          ? `All Hierarchy is currently unavailable, so "${validated.name}" opened in All Network.`
          : 'All Network is unavailable, so this named view opened in All Hierarchy.';
  return {
    state: restored.state,
    presentationMode,
    localLayoutMode: focusLayoutMode(validated.layout),
    viewports: restored.viewports,
    issues: restored.issues,
    ...(adjustment === undefined ? {} : { adjustment }),
  };
}

export function sameSavedViewSnapshot(
  left: SavedViewEntry,
  right: SavedViewEntry,
): boolean {
  return (
    left.layout === right.layout &&
    serializePersistedWorkspaceView(left.view) ===
      serializePersistedWorkspaceView(right.view)
  );
}
