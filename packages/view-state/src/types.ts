import type {
  EntityId,
  EntityKind,
  WorkspaceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import type {
  FocusProjectionState,
  ReferenceResolutionStatus,
  SectionHeadingLevel,
  StructuralDepth,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';

export const PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION = 2 as const;
export type RendererEntryMode = 'structure' | 'global';

export interface PersistedViewportAnchor {
  readonly anchorEntityId: EntityId;
  readonly zoom: number;
}

export type PersistedStructureViewport = PersistedViewportAnchor;

export interface PersistedGlobalViewport {
  readonly anchorEntityId: EntityId;
  readonly ratio: number;
}

export interface PersistedRendererViewports {
  readonly structure?: PersistedStructureViewport;
  readonly global?: PersistedGlobalViewport;
}

export interface PersistedProjectionState {
  readonly disclosure: {
    readonly defaultDepth: StructuralDepth;
    readonly maxSectionLevel?: SectionHeadingLevel;
    readonly expandedEntityIds: readonly EntityId[];
    readonly collapsedEntityIds: readonly EntityId[];
    readonly includeBlocks: boolean;
  };
  readonly focus?: FocusProjectionState;
  readonly filters?: {
    readonly pathPrefixes?: readonly WorkspacePath[];
    readonly entityKinds?: readonly EntityKind[];
    readonly referenceStatuses?: readonly ReferenceResolutionStatus[];
  };
}

export interface PersistedWorkspaceView {
  readonly schemaVersion: typeof PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly rendererMode: RendererEntryMode;
  readonly projection: PersistedProjectionState;
  readonly viewports?: PersistedRendererViewports;
}

export interface PersistedViewValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type PersistedViewValidationResult =
  | {
      readonly valid: true;
      readonly value: PersistedWorkspaceView;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly PersistedViewValidationIssue[];
    };

export type ViewRestoreIssueCode =
  | 'unknown-expanded-entity'
  | 'unknown-collapsed-entity'
  | 'conflicting-disclosure-state'
  | 'focus-root-missing'
  | 'path-filter-no-longer-matches'
  | 'viewport-anchor-missing';

export interface ViewRestoreIssue {
  readonly code: ViewRestoreIssueCode;
  readonly subject: string;
  readonly message: string;
}

export interface RestoredWorkspaceView {
  readonly state: ViewProjectionState;
  readonly rendererMode: RendererEntryMode;
  readonly viewports: PersistedRendererViewports;
  /** Compatibility alias for the Structure viewport during schema-v2 rollout. */
  readonly viewport?: PersistedViewportAnchor;
  readonly issues: readonly ViewRestoreIssue[];
}

/** Reconciled in-memory view state for a newer snapshot of the same workspace. */
export interface ReconciledCurrentWorkspaceView {
  readonly state: ViewProjectionState;
  readonly viewports: PersistedRendererViewports;
  /** Compatibility alias for the Structure viewport during schema-v2 rollout. */
  readonly viewport?: PersistedViewportAnchor;
  readonly issues: readonly ViewRestoreIssue[];
}
