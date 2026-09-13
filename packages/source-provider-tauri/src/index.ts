export { createTauriSourceProvider } from './provider';
export { isTauriRuntime } from './runtime';
export {
  VAULT_DISCOVERY_OPERATION_TIMEOUT_MS,
  VAULT_DISCOVERY_SLOW_OPERATION_WARNING_MS,
} from './discovery-progress';
export {
  RecoverableWorkspaceIdentityError,
  VaultDiscoveryTimeoutError,
  type DiscoverSelectedVaultOptions,
  type PrepareWorkspaceIdentityOptions,
  type ReconcileSelectedVaultChangesInput,
  type TauriSourceProvider,
  type TauriWorkspaceRegistry,
  type TauriWorkspaceRegistryEntry,
  type VaultSelection,
  type VaultDiscoveryCompletedOperation,
  type VaultDiscoveryNativeOperation,
  type VaultDiscoveryProgress,
  type VaultDiscoveryProgressListener,
  type VaultDiscoveryWorkspacePath,
  type VaultChangeReconciliationResult,
  type VaultSourceChange,
  type VaultSourceChangePlan,
  type VaultSourceInventory,
  type VaultWatchBatch,
  type VaultWatchCategory,
  type VaultWatchSubscription,
  type WatchSelectedVaultOptions,
  type WorkspaceIdentityRecovery,
  type WorkspaceIdentitySession,
} from './types';
