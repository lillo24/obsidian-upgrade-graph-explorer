import type {
  WorkspaceFolderKey,
  WorkspaceId,
} from '@icarus-graph-explorer/core';

export type { WorkspaceFolderKey } from '@icarus-graph-explorer/core';

export const SPATIAL_OVERRIDE_SCHEMA_VERSION = 1 as const;
export const NORMALIZED_FOLDER_ANCHOR_RANGE = {
  min: -2,
  max: 2,
} as const;
export const MINIMUM_AUTOMATIC_FRAME_HALF_EXTENT = 1;

/** User-facing semantics: positive X is right and positive Y is down. */
export interface NormalizedFolderAnchor {
  readonly x: number;
  readonly y: number;
}

export interface FolderClusterAnchorEntry {
  readonly folderKey: WorkspaceFolderKey;
  readonly anchor: NormalizedFolderAnchor;
}

export interface SpatialOverrideRegistry {
  readonly schemaVersion: typeof SPATIAL_OVERRIDE_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly allNetwork: {
    readonly folderAnchors: readonly FolderClusterAnchorEntry[];
  };
}

export type FolderClusterAnchorMap = ReadonlyMap<
  WorkspaceFolderKey,
  NormalizedFolderAnchor
>;

export interface SpatialPoint {
  readonly x: number;
  readonly y: number;
}

export interface SpatialPosition extends SpatialPoint {
  readonly key: string;
}

export interface AutomaticGraphFrame {
  readonly centerX: number;
  readonly centerY: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** Sign of the graph-space Y delta that appears visually downward. */
export type VisualDownGraphYSign = -1 | 1;

export interface AppliedFolderTranslation {
  readonly folderKey: WorkspaceFolderKey;
  readonly memberNodeKeys: readonly string[];
  readonly automaticCenter: SpatialPoint;
  readonly target: SpatialPoint;
  readonly translation: SpatialPoint;
}

export interface SpatialCompositionResult {
  readonly displayedPositions: readonly SpatialPosition[];
  readonly automaticFrame: AutomaticGraphFrame;
  readonly activeFolders: readonly AppliedFolderTranslation[];
  readonly inactiveFolderKeys: readonly WorkspaceFolderKey[];
  readonly issues: readonly [];
}

/** Automatic, committed-display geometry captured once for one exact folder. */
export interface FolderClusterPreviewGeometry {
  readonly folderKey: WorkspaceFolderKey;
  readonly automaticFrame: AutomaticGraphFrame;
  readonly automaticCenter: SpatialPoint;
  readonly displayedCenter: SpatialPoint;
  readonly displayedAnchor: NormalizedFolderAnchor;
  readonly memberAutomaticPositions: readonly SpatialPosition[];
}

/** One sparse preview derived from an immutable automatic-position base. */
export interface FolderClusterPreviewResult {
  readonly folderKey: WorkspaceFolderKey;
  readonly anchor: NormalizedFolderAnchor;
  readonly target: SpatialPoint;
  readonly translation: SpatialPoint;
  readonly positions: readonly SpatialPosition[];
}
