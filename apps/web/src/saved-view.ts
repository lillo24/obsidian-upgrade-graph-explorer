import {
  resolveNetworkSettings,
  validateGlobalLayoutSettings,
  withNetworkSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';
import {
  serializeSpatialOverrideRegistry,
  type SpatialOverrideRegistry,
} from '@icarus-graph-explorer/spatial-overrides';
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
  applyFocusHierarchySettings,
  captureFocusHierarchySettings,
  type GraphPreferences,
} from './preferences/graph-preferences';
import {
  SAVED_VIEW_REGISTRY_SCHEMA_VERSION,
  validateSavedViewRegistry,
  type SavedViewEntry,
  type SavedViewLayout,
  type SavedViewProfile,
} from './persistence/saved-views';

export interface SavedViewApplyPlan {
  readonly state: ViewProjectionState;
  readonly presentationMode: GraphPresentationMode;
  readonly localLayoutMode: LocalLayoutMode;
  readonly viewports: PersistedRendererViewports;
  readonly preferences: GraphPreferences;
  readonly spatial?: SpatialOverrideRegistry;
  readonly issues: readonly ViewRestoreIssue[];
  readonly adjustment?: string;
}

export function captureSavedViewProfile({
  presentationMode,
  layout,
  preferences,
  spatial,
}: {
  readonly presentationMode: GraphPresentationMode;
  readonly layout: SavedViewLayout;
  readonly preferences: GraphPreferences;
  readonly spatial: SpatialOverrideRegistry;
}): SavedViewProfile {
  if (presentationMode === 'global') {
    return {
      kind: 'all-network',
      network: validateGlobalLayoutSettings(preferences.globalLayoutSettings),
      spatial,
    };
  }
  if (presentationMode === 'structure') return { kind: 'all-hierarchy' };
  return layout === 'network'
    ? {
        kind: 'focus-network',
        network: resolveNetworkSettings(preferences.globalLayoutSettings),
      }
    : {
        kind: 'focus-hierarchy',
        hierarchy: captureFocusHierarchySettings(preferences),
      };
}

/** Captures the semantic graph state plus its layout-appropriate committed profile. */
export function captureSavedView({
  name,
  workspace,
  state,
  presentationMode,
  layout,
  viewports,
  preferences,
  spatial,
}: {
  readonly name: string;
  readonly workspace: ProjectionWorkspace;
  readonly state: ViewProjectionState;
  readonly presentationMode: GraphPresentationMode;
  readonly layout: SavedViewLayout;
  readonly viewports: PersistedRendererViewports;
  readonly preferences: GraphPreferences;
  readonly spatial: SpatialOverrideRegistry;
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
    profile: captureSavedViewProfile({
      presentationMode,
      layout,
      preferences,
      spatial,
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
  preferences,
}: {
  readonly entry: SavedViewEntry;
  readonly workspace: ProjectionWorkspace;
  readonly availability: ExplorationAvailability;
  readonly preferences: GraphPreferences;
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
  const profiledPreferences = (() => {
    switch (validated.profile?.kind) {
      case 'all-network':
        return {
          ...preferences,
          globalLayoutSettings: validated.profile.network,
        };
      case 'focus-network':
        return {
          ...preferences,
          globalLayoutSettings: withNetworkSettings(
            preferences.globalLayoutSettings,
            validated.profile.network,
          ),
        };
      case 'focus-hierarchy':
        return applyFocusHierarchySettings(
          preferences,
          validated.profile.hierarchy,
        );
      case 'all-hierarchy':
      case undefined:
        return preferences;
    }
  })();
  const targetPreferences =
    presentationMode === 'local' &&
    profiledPreferences.localLayoutMode !== focusLayoutMode(validated.layout)
      ? {
          ...profiledPreferences,
          localLayoutMode: focusLayoutMode(validated.layout),
        }
      : profiledPreferences;
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
    preferences: targetPreferences,
    ...(validated.profile?.kind === 'all-network'
      ? { spatial: validated.profile.spatial }
      : {}),
    issues: restored.issues,
    ...(adjustment === undefined ? {} : { adjustment }),
  };
}

export function sameSavedViewSnapshot(
  left: SavedViewEntry,
  right: SavedViewEntry,
): boolean {
  if (!sameSavedViewSemanticSnapshot(left, right)) return false;
  if (left.profile === undefined || right.profile === undefined) return true;
  return profileFingerprint(left.profile) === profileFingerprint(right.profile);
}

export function sameSavedViewSemanticSnapshot(
  left: SavedViewEntry,
  right: SavedViewEntry,
): boolean {
  return (
    left.layout === right.layout &&
    serializePersistedWorkspaceView(left.view) ===
      serializePersistedWorkspaceView(right.view)
  );
}

function profileFingerprint(profile: SavedViewProfile): string {
  return profile.kind === 'all-network'
    ? JSON.stringify({
        kind: profile.kind,
        network: validateGlobalLayoutSettings(profile.network),
        spatial: serializeSpatialOverrideRegistry(profile.spatial),
      })
    : JSON.stringify(profile);
}

/** Derives navigation truth without persisting a stale active-view identity. */
export function matchingSavedViewName(
  current: SavedViewEntry,
  views: readonly SavedViewEntry[],
): string | undefined {
  return views
    .filter((entry) => sameSavedViewSnapshot(current, entry))
    .map((entry) => entry.name)
    .sort((left, right) =>
      left.toLowerCase() === right.toLowerCase()
        ? left.localeCompare(right)
        : left.toLowerCase().localeCompare(right.toLowerCase()),
    )[0];
}

/**
 * Best-effort render-time decoration. Saving and updating continue to use the
 * strict capture boundary above; an uncapturable transient state is no match.
 */
export function matchingCurrentSavedViewName(
  input: Parameters<typeof captureSavedView>[0],
  views: readonly SavedViewEntry[],
): string | undefined {
  if (views.length === 0) return undefined;
  try {
    return matchingSavedViewName(captureSavedView(input), views);
  } catch {
    return undefined;
  }
}
