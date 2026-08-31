import type { DiagnosticIdentityStability } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  restorePersistedWorkspaceView,
  type PersistedViewportAnchor,
  type PersistedRendererViewports,
  type RendererEntryMode,
  type ViewRestoreIssue,
} from '@icarus-graph-explorer/view-state';
import {
  documentOnlyProjectionState,
  type ProjectionWorkspace,
  type ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

import { loadWorkspaceView, type StorageLike } from './storage';

export type ViewPersistenceEligibility = 'stable' | 'transient' | 'legacy';

export interface HydratedGraphView {
  readonly state: ViewProjectionState;
  readonly rendererMode: RendererEntryMode;
  readonly viewports: PersistedRendererViewports;
  /** Compatibility alias for the Structure viewport. */
  readonly viewport?: PersistedViewportAnchor;
  readonly issues: readonly ViewRestoreIssue[];
  readonly writable: boolean;
  readonly status: string;
}

export function persistenceEligibility(
  stability: DiagnosticIdentityStability | undefined,
): ViewPersistenceEligibility {
  return stability === 'stable'
    ? 'stable'
    : stability === 'transient'
      ? 'transient'
      : 'legacy';
}

function restoredStatus(issues: readonly ViewRestoreIssue[]): string {
  return issues.length === 0
    ? 'Restored saved graph view.'
    : `Restored saved graph view with ${issues.length} stale item${issues.length === 1 ? '' : 's'} removed.`;
}

export function hydrateGraphView({
  eligibility,
  storage,
  workspace,
}: {
  readonly eligibility: ViewPersistenceEligibility;
  readonly storage: StorageLike | undefined;
  readonly workspace: ProjectionWorkspace;
}): HydratedGraphView {
  if (eligibility !== 'stable') {
    return {
      state: documentOnlyProjectionState(),
      rendererMode: 'structure',
      viewports: {},
      issues: [],
      writable: false,
      status:
        eligibility === 'transient'
          ? 'View persistence is unavailable because this report was generated without stable identity.'
          : 'View persistence is unavailable because this legacy report does not declare stable identity.',
    };
  }
  if (storage === undefined) {
    return {
      state: documentOnlyProjectionState(),
      rendererMode: 'structure',
      viewports: {},
      issues: [],
      writable: false,
      status:
        'View persistence is unavailable because browser storage could not be accessed.',
    };
  }
  const workspaceId = workspace.snapshot().workspace.id;
  const loaded = loadWorkspaceView(storage, workspaceId);
  if (loaded.status === 'empty') {
    return {
      state: documentOnlyProjectionState(),
      rendererMode: 'structure',
      viewports: {},
      issues: [],
      writable: true,
      status: 'View persistence is active for this stable workspace.',
    };
  }
  if (loaded.status === 'error') {
    return {
      state: documentOnlyProjectionState(),
      rendererMode: 'structure',
      viewports: {},
      issues: [],
      writable: false,
      status: `${loaded.message} The stored value was left unchanged; use Reset saved view to remove it.`,
    };
  }
  try {
    const restored = restorePersistedWorkspaceView(workspace, loaded.value);
    return {
      state: restored.state,
      rendererMode: restored.rendererMode,
      viewports: restored.viewports,
      ...(restored.viewport === undefined
        ? {}
        : { viewport: restored.viewport }),
      issues: restored.issues,
      writable: true,
      status: restoredStatus(restored.issues),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: documentOnlyProjectionState(),
      rendererMode: 'structure',
      viewports: {},
      issues: [],
      writable: false,
      status: `${message} The stored value was left unchanged; use Reset saved view to remove it.`,
    };
  }
}
