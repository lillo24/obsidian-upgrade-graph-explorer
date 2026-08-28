import type { TauriNativeBridge } from './bridge';
import { normalizeDiscoveryExclude } from '@icarus-graph-explorer/vault-discovery-policy';
import {
  browserWatchScheduler,
  createWatchBurstCollector,
  type WatchScheduler,
} from './watch-burst';
import { normalizeNativeWatchPaths } from './watch-paths';
import type {
  VaultSelection,
  VaultWatchBatch,
  VaultWatchSubscription,
  WatchSelectedVaultOptions,
} from './types';

const DEFAULT_QUIET_WINDOW_MS = 250;
const DEFAULT_MAXIMUM_WAIT_MS = 1_000;

export interface WatchSelectedVaultDependencies {
  readonly scheduler?: WatchScheduler;
}

export async function watchSelectedVault(
  bridge: TauriNativeBridge,
  selection: VaultSelection,
  listener: (batch: VaultWatchBatch) => void | Promise<void>,
  options: WatchSelectedVaultOptions = {},
  dependencies: WatchSelectedVaultDependencies = {},
): Promise<VaultWatchSubscription> {
  for (const exclude of options.excludes ?? [])
    normalizeDiscoveryExclude(exclude);
  const collector = createWatchBurstCollector(listener, {
    quietWindowMs: options.quietWindowMs ?? DEFAULT_QUIET_WINDOW_MS,
    maximumWaitMs: options.maximumWaitMs ?? DEFAULT_MAXIMUM_WAIT_MS,
    scheduler: dependencies.scheduler ?? browserWatchScheduler,
  });
  let stopped = false;
  let normalizationChain = Promise.resolve();
  let stopNative: (() => void) | undefined;
  try {
    stopNative = await bridge.watchDirectory(selection.rootPath, (event) => {
      if (stopped) return;
      // File reads can themselves emit access events on some platforms. They
      // do not change source truth and must not feed a re-observation loop.
      if (event.category === 'access' && !event.requiresResync) return;
      normalizationChain = normalizationChain.then(async () => {
        if (stopped) return;
        const normalized = await normalizeNativeWatchPaths(
          bridge,
          selection,
          event.paths,
          options.excludes,
        );
        if (stopped) return;
        const requiresResync =
          event.requiresResync || normalized.requiresResync;
        if (normalized.paths.length === 0 && !requiresResync) return;
        collector.add({
          paths: normalized.paths,
          category: event.category === 'access' ? 'other' : event.category,
          requiresResync,
          reasons: [
            ...(event.requiresResync
              ? ['The native watcher requested a full resynchronization.']
              : []),
            ...normalized.reasons,
          ],
        });
      });
    });
  } catch (error: unknown) {
    await collector.dispose();
    throw new Error('Cannot start the selected-vault filesystem watcher.', {
      cause: error,
    });
  }

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      let stopError: unknown;
      try {
        stopNative?.();
      } catch (error: unknown) {
        stopError = error;
      }
      try {
        await normalizationChain;
      } finally {
        await collector.dispose();
      }
      if (stopError !== undefined) {
        throw new Error('Cannot stop the selected-vault filesystem watcher.', {
          cause: stopError,
        });
      }
    },
  };
}
