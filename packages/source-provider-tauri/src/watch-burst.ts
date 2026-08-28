import { compareWorkspaceText } from '@icarus-graph-explorer/vault-discovery-policy';

import type { VaultWatchBatch, VaultWatchCategory } from './types';

export interface WatchSignal {
  readonly paths: readonly string[];
  readonly category: VaultWatchCategory;
  readonly requiresResync: boolean;
  readonly reasons: readonly string[];
}

export interface WatchScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface WatchBurstCollector {
  add(signal: WatchSignal): void;
  dispose(): Promise<void>;
}

export interface WatchBurstCollectorOptions {
  readonly quietWindowMs: number;
  readonly maximumWaitMs: number;
  readonly scheduler: WatchScheduler;
}

export const browserWatchScheduler: WatchScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
};

function validateWindow(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${name} must be a positive finite number of milliseconds.`,
    );
  }
}

export function createWatchBurstCollector(
  listener: (batch: VaultWatchBatch) => void | Promise<void>,
  options: WatchBurstCollectorOptions,
): WatchBurstCollector {
  validateWindow('Watcher quiet window', options.quietWindowMs);
  validateWindow('Watcher maximum wait', options.maximumWaitMs);

  const paths = new Set<string>();
  const categories = new Set<VaultWatchCategory>();
  const reasons = new Set<string>();
  let requiresResync = false;
  let firstSignalAt: number | undefined;
  let quietTimer: unknown;
  let maximumTimer: unknown;
  let disposed = false;
  let flushing = false;
  let flushRequested = false;
  let activeFlush: Promise<void> | undefined;

  function clearTimer(handle: unknown): void {
    if (handle !== undefined) options.scheduler.clearTimeout(handle);
  }

  function clearTimers(): void {
    clearTimer(quietTimer);
    clearTimer(maximumTimer);
    quietTimer = undefined;
    maximumTimer = undefined;
  }

  function pending(): boolean {
    return paths.size > 0 || categories.size > 0 || requiresResync;
  }

  function schedule(): void {
    if (disposed || !pending()) return;
    clearTimer(quietTimer);
    quietTimer = options.scheduler.setTimeout(
      () => void requestFlush(),
      options.quietWindowMs,
    );
    if (maximumTimer === undefined && firstSignalAt !== undefined) {
      const elapsed = Math.max(0, options.scheduler.now() - firstSignalAt);
      maximumTimer = options.scheduler.setTimeout(
        () => void requestFlush(),
        Math.max(0, options.maximumWaitMs - elapsed),
      );
    }
  }

  async function flush(): Promise<void> {
    if (disposed || !pending()) return;
    clearTimers();
    const batch: VaultWatchBatch = {
      paths: [...paths].sort(compareWorkspaceText),
      categories: [...categories].sort(compareWorkspaceText),
      requiresResync,
      reasons: [...reasons].sort(compareWorkspaceText),
    };
    paths.clear();
    categories.clear();
    reasons.clear();
    requiresResync = false;
    firstSignalAt = undefined;
    flushing = true;
    try {
      await listener(batch);
    } finally {
      flushing = false;
      if (!disposed && pending()) {
        if (flushRequested) {
          flushRequested = false;
          clearTimers();
          firstSignalAt ??= options.scheduler.now();
          quietTimer = options.scheduler.setTimeout(
            () => void requestFlush(),
            0,
          );
        } else {
          schedule();
        }
      }
    }
  }

  function requestFlush(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (flushing) {
      flushRequested = true;
      return activeFlush ?? Promise.resolve();
    }
    activeFlush = flush().finally(() => {
      activeFlush = undefined;
    });
    return activeFlush;
  }

  return {
    add(signal) {
      if (disposed) return;
      firstSignalAt ??= options.scheduler.now();
      for (const path of signal.paths) paths.add(path);
      categories.add(signal.category);
      for (const reason of signal.reasons) reasons.add(reason);
      requiresResync ||= signal.requiresResync;
      schedule();
    },
    async dispose() {
      if (disposed) {
        await activeFlush;
        return;
      }
      disposed = true;
      clearTimers();
      paths.clear();
      categories.clear();
      reasons.clear();
      requiresResync = false;
      await activeFlush;
    },
  };
}
