import type { WorkspaceId, WorkspacePath } from '@icarus-graph-explorer/core';
import type { StableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';

export interface VaultSelection {
  /** Private absolute path retained only by the platform session and registry. */
  readonly rootPath: string;
  readonly displayName: string;
}

export interface VaultSourceInventory {
  readonly markdownDocuments: readonly {
    readonly path: WorkspacePath;
    readonly source: string;
  }[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface TauriWorkspaceRegistryEntry {
  readonly rootPath: string;
  readonly workspaceId: WorkspaceId;
}

export interface TauriWorkspaceRegistry {
  readonly schemaVersion: 1;
  readonly workspaces: readonly TauriWorkspaceRegistryEntry[];
}

export interface WorkspaceIdentitySession {
  readonly selection: VaultSelection;
  readonly workspaceId: WorkspaceId;
  readonly catalog: StableIdentityCatalog;
  readonly association: 'new' | 'existing' | 'reset';
  readonly previousWorkspaceId?: WorkspaceId;
}

export interface PrepareWorkspaceIdentityOptions {
  readonly reset?: boolean;
  /** Explicit recovery for a malformed global registry after UI confirmation. */
  readonly replaceCorruptRegistry?: boolean;
}

export interface DiscoverSelectedVaultOptions {
  readonly excludes?: readonly string[];
}

export type VaultWatchCategory =
  'create' | 'modify' | 'remove' | 'rename' | 'other';

export interface VaultWatchBatch {
  readonly paths: readonly WorkspacePath[];
  readonly categories: readonly VaultWatchCategory[];
  readonly requiresResync: boolean;
  /** Relative-path-safe explanations only; absolute native paths are never exposed. */
  readonly reasons: readonly string[];
}

export interface WatchSelectedVaultOptions extends DiscoverSelectedVaultOptions {
  /** Burst quiet period. Defaults to 250 ms. */
  readonly quietWindowMs?: number;
  /** Hard cap from the first pending signal. Defaults to 1,000 ms. */
  readonly maximumWaitMs?: number;
}

export interface VaultWatchSubscription {
  /** Idempotently stops native delivery, timers, and future listener calls. */
  stop(): Promise<void>;
}

export type VaultSourceChange =
  | {
      readonly kind: 'upsert';
      readonly path: WorkspacePath;
      readonly source: string;
    }
  | {
      readonly kind: 'delete';
      readonly path: WorkspacePath;
    }
  | {
      readonly kind: 'move';
      readonly fromPath: WorkspacePath;
      readonly toPath: WorkspacePath;
    };

export interface VaultSourceChangePlan {
  readonly markdownChanges: readonly VaultSourceChange[];
  readonly nextInventory: VaultSourceInventory;
  readonly nonMarkdownChanged: boolean;
  readonly affectedPaths: readonly WorkspacePath[];
}

export type VaultChangeReconciliationResult =
  | {
      readonly status: 'planned';
      readonly plan: VaultSourceChangePlan;
    }
  | {
      readonly status: 'resync-required';
      readonly reason: string;
      readonly affectedPaths: readonly WorkspacePath[];
    };

export interface ReconcileSelectedVaultChangesInput {
  readonly selection: VaultSelection;
  readonly previousInventory: VaultSourceInventory;
  readonly watchBatch: VaultWatchBatch;
}

export interface TauriSourceProvider {
  selectVaultDirectory(): Promise<VaultSelection | undefined>;
  discoverSelectedVault(
    selection: VaultSelection,
    options?: DiscoverSelectedVaultOptions,
  ): Promise<VaultSourceInventory>;
  watchSelectedVault(
    selection: VaultSelection,
    listener: (batch: VaultWatchBatch) => void | Promise<void>,
    options?: WatchSelectedVaultOptions,
  ): Promise<VaultWatchSubscription>;
  reconcileSelectedVaultChanges(
    input: ReconcileSelectedVaultChangesInput,
    options?: DiscoverSelectedVaultOptions,
  ): Promise<VaultChangeReconciliationResult>;
  loadOrPrepareWorkspaceIdentity(
    selection: VaultSelection,
    options?: PrepareWorkspaceIdentityOptions,
  ): Promise<WorkspaceIdentitySession>;
  commitWorkspaceIdentity(
    session: WorkspaceIdentitySession,
    nextCatalog: StableIdentityCatalog,
  ): Promise<void>;
}

export type WorkspaceIdentityRecovery =
  'reset-vault-identity' | 'replace-corrupt-registry';

export class RecoverableWorkspaceIdentityError extends Error {
  readonly recovery: WorkspaceIdentityRecovery;

  constructor(message: string, recovery: WorkspaceIdentityRecovery) {
    super(message);
    this.name = 'RecoverableWorkspaceIdentityError';
    this.recovery = recovery;
  }
}
