import { describe, expect, it } from 'vitest';

import type { TauriNativeBridge } from './bridge';
import { normalizeNativeWatchPaths } from './watch-paths';

const bridge = {
  normalizePath: async (path: string) => path,
} as TauriNativeBridge;

describe('native watch path normalization', () => {
  it('normalizes Windows paths case-insensitively and deduplicates them', async () => {
    await expect(
      normalizeNativeWatchPaths(
        bridge,
        { rootPath: 'C:\\Vault', displayName: 'Vault' },
        ['c:\\vault\\Folder\\A.md', 'C:\\Vault\\Folder\\A.md'],
      ),
    ).resolves.toEqual({
      paths: ['Folder/A.md'],
      requiresResync: false,
      reasons: [],
    });
  });

  it('treats a Windows drive root as case-insensitive and sorts output', async () => {
    await expect(
      normalizeNativeWatchPaths(
        bridge,
        { rootPath: 'C:', displayName: 'C drive' },
        ['c:\\B.md', 'C:\\A.md'],
      ),
    ).resolves.toEqual({
      paths: ['A.md', 'B.md'],
      requiresResync: false,
      reasons: [],
    });
  });

  it('filters hidden, node_modules, and configured excluded paths', async () => {
    await expect(
      normalizeNativeWatchPaths(
        bridge,
        { rootPath: '/vault', displayName: 'vault' },
        [
          '/vault/.obsidian/state.json',
          '/vault/node_modules/pkg/index.js',
          '/vault/Excluded/A.md',
          '/vault/Visible.md',
        ],
        ['Excluded'],
      ),
    ).resolves.toEqual({
      paths: ['Visible.md'],
      requiresResync: false,
      reasons: [],
    });
  });

  it('marks root and out-of-root events as resync-required without exposing them', async () => {
    const result = await normalizeNativeWatchPaths(
      bridge,
      { rootPath: '/vault', displayName: 'vault' },
      ['/vault', '/other/private.md'],
    );
    expect(result.paths).toEqual([]);
    expect(result.requiresResync).toBe(true);
    expect(result.reasons.join(' ')).not.toContain('/other/private.md');
  });

  it('rejects traversal-shaped event paths deterministically', async () => {
    const result = await normalizeNativeWatchPaths(
      bridge,
      { rootPath: '/vault', displayName: 'vault' },
      ['/vault/../private.md'],
    );
    expect(result).toEqual({
      paths: [],
      requiresResync: true,
      reasons: ['The watcher reported an unsafe workspace-relative path.'],
    });
  });
});
