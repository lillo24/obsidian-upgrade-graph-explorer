import type { EntityId, WorkspaceId } from '@icarus-graph-explorer/core';

export const PRESENTATION_OVERRIDE_SCHEMA_VERSION = 1 as const;
export const NODE_SIZE_SCALE_RANGE = { min: 0.5, max: 2.5 } as const;

/** A multiplier of automatic Network size, never a renderer pixel radius. */
export interface EntityPresentationOverride {
  readonly sizeScale: number;
}

export type EntityPresentationOverrideMap = ReadonlyMap<
  EntityId,
  EntityPresentationOverride
>;

export interface PresentationOverrideEntry extends EntityPresentationOverride {
  readonly entityId: EntityId;
}

/** Auto is absence, not a stored 1. No source paths, content, or geometry. */
export interface PresentationOverrideRegistry {
  readonly schemaVersion: typeof PRESENTATION_OVERRIDE_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly entities: readonly PresentationOverrideEntry[];
}
