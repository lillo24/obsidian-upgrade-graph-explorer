import type {
  AddressableEntity,
  Reference,
  WorkspaceId,
} from '@icarus-graph-explorer/core';

export const KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION = 1 as const;

export interface AddedRecord<T> {
  readonly after: T;
  readonly afterIndex: number;
}

export interface RemovedRecord<T> {
  readonly before: T;
  readonly beforeIndex: number;
}

export interface UpdatedRecord<T> {
  readonly before: T;
  readonly beforeIndex: number;
  readonly after: T;
  readonly afterIndex: number;
}

export interface SnapshotCollectionDelta<T> {
  readonly added: readonly AddedRecord<T>[];
  readonly removed: readonly RemovedRecord<T>[];
  readonly updated: readonly UpdatedRecord<T>[];
  /** Present only for a pure reorder that changed-record indexes cannot encode. */
  readonly afterOrder?: readonly string[];
}

export interface KnowledgeSnapshotDelta {
  readonly schemaVersion: typeof KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION;
  readonly workspaceId: WorkspaceId;
  readonly entities: SnapshotCollectionDelta<AddressableEntity>;
  readonly references: SnapshotCollectionDelta<Reference>;
}

export interface SnapshotDeltaValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type SnapshotDeltaValidationResult =
  | {
      readonly valid: true;
      readonly value: KnowledgeSnapshotDelta;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly SnapshotDeltaValidationIssue[];
    };
