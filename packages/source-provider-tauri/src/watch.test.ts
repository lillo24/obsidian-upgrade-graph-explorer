import { describe, expect, it, vi } from 'vitest';

import type { NativeWatchEvent, TauriNativeBridge } from './bridge';
import { watchSelectedVault } from './watch';
import type { WatchScheduler } from './watch-burst';

class ManualScheduler implements WatchScheduler {
  private current = 0;
  private nextId = 0;
  private readonly tasks = new Map<number, () => void>();

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void): number {
    const id = (this.nextId += 1);
    this.tasks.set(id, callback);
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  flush(): void {
    this.current += 1_000;
    const callbacks = [...this.tasks.values()];
    this.tasks.clear();
    for (const callback of callbacks) callback();
  }
}

describe('selected-vault watch lifecycle', () => {
  it('normalizes native events, coalesces them, and stops idempotently', async () => {
    const scheduler = new ManualScheduler();
    const nativeStop = vi.fn();
    let emit: ((event: NativeWatchEvent) => void) | undefined;
    const bridge = {
      watchDirectory: async (
        _path: string,
        listener: (event: NativeWatchEvent) => void,
      ) => {
        emit = listener;
        return nativeStop;
      },
      normalizePath: async (path: string) => path,
    } as unknown as TauriNativeBridge;
    const listener = vi.fn();
    const subscription = await watchSelectedVault(
      bridge,
      { rootPath: 'C:\\Vault', displayName: 'Vault' },
      listener,
      { quietWindowMs: 10, maximumWaitMs: 20 },
      { scheduler },
    );

    emit?.({
      category: 'modify',
      paths: ['C:\\Vault\\B.md', 'C:\\Vault\\A.md'],
      requiresResync: false,
    });
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    scheduler.flush();
    for (let index = 0; index < 3; index += 1) await Promise.resolve();
    expect(listener).toHaveBeenCalledWith({
      paths: ['A.md', 'B.md'],
      categories: ['modify'],
      requiresResync: false,
      reasons: [],
    });

    emit?.({
      category: 'modify',
      paths: ['C:\\Vault\\.obsidian\\workspace.json'],
      requiresResync: false,
    });
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    scheduler.flush();
    expect(listener).toHaveBeenCalledOnce();

    await subscription.stop();
    await subscription.stop();
    expect(nativeStop).toHaveBeenCalledOnce();
    emit?.({
      category: 'remove',
      paths: ['C:\\Vault\\A.md'],
      requiresResync: false,
    });
    scheduler.flush();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('surfaces startup failure with selected-vault context', async () => {
    const bridge = {
      watchDirectory: async () => {
        throw new Error('permission denied');
      },
    } as unknown as TauriNativeBridge;
    await expect(
      watchSelectedVault(
        bridge,
        { rootPath: '/vault', displayName: 'vault' },
        () => undefined,
      ),
    ).rejects.toThrow('Cannot start the selected-vault filesystem watcher');
  });

  it('still disposes pending work when native unwatch fails', async () => {
    const scheduler = new ManualScheduler();
    let emit: ((event: NativeWatchEvent) => void) | undefined;
    const bridge = {
      watchDirectory: async (
        _path: string,
        listener: (event: NativeWatchEvent) => void,
      ) => {
        emit = listener;
        return () => {
          throw new Error('unwatch failed');
        };
      },
      normalizePath: async (path: string) => path,
    } as unknown as TauriNativeBridge;
    const listener = vi.fn();
    const subscription = await watchSelectedVault(
      bridge,
      { rootPath: '/vault', displayName: 'vault' },
      listener,
      { quietWindowMs: 10, maximumWaitMs: 20 },
      { scheduler },
    );
    emit?.({
      category: 'modify',
      paths: ['/vault/A.md'],
      requiresResync: false,
    });

    await expect(subscription.stop()).rejects.toThrow(
      'Cannot stop the selected-vault filesystem watcher',
    );
    scheduler.flush();
    expect(listener).not.toHaveBeenCalled();
    await expect(subscription.stop()).resolves.toBeUndefined();
  });
});
