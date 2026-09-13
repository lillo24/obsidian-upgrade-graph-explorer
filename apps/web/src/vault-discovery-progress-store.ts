import type {
  VaultDiscoveryProgress,
  VaultDiscoveryProgressListener,
} from '@icarus-graph-explorer/source-provider-tauri';

export const VAULT_DISCOVERY_NOTICE_INTERVAL_MS = 100;

export interface VaultDiscoveryProgressStore {
  readonly clear: () => void;
  readonly dispose: () => void;
  readonly getSnapshot: () => VaultDiscoveryProgress | undefined;
  readonly publish: VaultDiscoveryProgressListener;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createVaultDiscoveryProgressStore(
  notificationIntervalMs = VAULT_DISCOVERY_NOTICE_INTERVAL_MS,
): VaultDiscoveryProgressStore {
  if (!Number.isFinite(notificationIntervalMs) || notificationIntervalMs <= 0) {
    throw new Error(
      'Vault discovery notification interval must be a positive finite duration.',
    );
  }
  const listeners = new Set<() => void>();
  let snapshot: VaultDiscoveryProgress | undefined;
  let lastNotificationAt = Number.NEGATIVE_INFINITY;
  let pendingNotification: ReturnType<typeof setTimeout> | undefined;

  function notify(): void {
    if (pendingNotification !== undefined) {
      clearTimeout(pendingNotification);
      pendingNotification = undefined;
    }
    lastNotificationAt = performance.now();
    for (const listener of listeners) listener();
  }

  function scheduleNotification(): void {
    if (listeners.size === 0 || pendingNotification !== undefined) return;
    const elapsed = Math.max(0, performance.now() - lastNotificationAt);
    if (elapsed >= notificationIntervalMs) {
      notify();
      return;
    }
    pendingNotification = setTimeout(notify, notificationIntervalMs - elapsed);
  }

  return {
    clear() {
      if (snapshot === undefined && pendingNotification === undefined) return;
      snapshot = undefined;
      notify();
    },
    dispose() {
      if (pendingNotification !== undefined) {
        clearTimeout(pendingNotification);
        pendingNotification = undefined;
      }
      snapshot = undefined;
      listeners.clear();
    },
    getSnapshot: () => snapshot,
    publish(progress) {
      snapshot = progress;
      scheduleNotification();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
