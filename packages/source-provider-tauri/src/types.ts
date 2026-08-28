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

export interface TauriSourceProvider {
  selectVaultDirectory(): Promise<VaultSelection | undefined>;
  discoverSelectedVault(
    selection: VaultSelection,
    options?: DiscoverSelectedVaultOptions,
  ): Promise<VaultSourceInventory>;
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
