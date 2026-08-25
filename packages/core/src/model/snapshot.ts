import type { AddressableEntity } from './entities';
import type { WorkspaceId } from './ids';
import type { Reference } from './references';

export const KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface WorkspaceDescriptor {
  readonly id: WorkspaceId;
}

/**
 * Canonical source truth for one workspace.
 *
 * Arrays are persisted data. Runtime maps/indexes and view state are derived
 * outside this contract.
 */
export interface KnowledgeSnapshot {
  readonly schemaVersion: typeof KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION;
  readonly workspace: WorkspaceDescriptor;
  readonly entities: readonly AddressableEntity[];
  readonly references: readonly Reference[];
}
