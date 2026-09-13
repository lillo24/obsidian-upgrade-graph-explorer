import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VaultDiscoveryProgress } from '@icarus-graph-explorer/source-provider-tauri';

import { createVaultDiscoveryProgressStore } from './vault-discovery-progress-store';

function progress(entriesExamined: number): VaultDiscoveryProgress {
  return {
    directoriesRead: 1,
    entriesExamined,
    markdownFilesRead: entriesExamined,
    nonMarkdownFilesSeen: 0,
    bytesRead: entriesExamined * 10,
    currentRecursionDepth: 0,
    maximumRecursionDepth: 0,
    slowOperationWarningMs: 3_000,
    currentOperation: 'read-markdown',
    currentWorkspacePath: `Note-${entriesExamined}.md`,
    currentOperationStartedAt: 0,
  };
}

afterEach(() => vi.useRealTimers());

describe('vault discovery progress store', () => {
  it('coalesces thousands of source events into bounded subscriber updates', async () => {
    vi.useFakeTimers();
    const store = createVaultDiscoveryProgressStore(100);
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    for (let index = 1; index <= 2_000; index += 1) {
      store.publish(progress(index));
    }

    expect(notifications).toBe(1);
    expect(store.getSnapshot()?.entriesExamined).toBe(2_000);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(notifications).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears a pending notification and removes the detailed snapshot', () => {
    vi.useFakeTimers();
    const store = createVaultDiscoveryProgressStore(100);
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });
    store.publish(progress(1));
    store.publish(progress(2));
    expect(vi.getTimerCount()).toBe(1);

    store.clear();

    expect(store.getSnapshot()).toBeUndefined();
    expect(notifications).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
