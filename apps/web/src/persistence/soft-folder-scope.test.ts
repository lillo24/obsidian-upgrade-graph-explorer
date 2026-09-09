import { describe, expect, it } from 'vitest';

import type { StorageLike } from './storage';
import {
  createEmptySoftFolderScopeRegistry,
  loadSoftFolderScope,
  saveSoftFolderScope,
  softFolderScopeStorageKey,
} from './soft-folder-scope';

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('Soft folder scope persistence', () => {
  it('uses an encoded workspace-local key and canonical sparse data', () => {
    const storage = memoryStorage();
    const registry = {
      ...createEmptySoftFolderScopeRegistry('vault/A'),
      overrides: [
        { exactFolderKey: 'Z/Child', spatialGroupKey: 'Z' },
        { exactFolderKey: 'A/Child', spatialGroupKey: 'A' },
      ],
    };
    expect(saveSoftFolderScope(storage, registry)).toEqual({ ok: true });
    expect(softFolderScopeStorageKey('vault/A')).toBe(
      'icarus-graph-explorer:soft-folder-scope:vault%2FA',
    );
    expect(loadSoftFolderScope(storage, 'vault/A')).toEqual({
      ok: true,
      value: {
        ...registry,
        overrides: [...registry.overrides].reverse(),
      },
    });
    expect(loadSoftFolderScope(storage, 'vault/B')).toEqual({
      ok: true,
      value: createEmptySoftFolderScopeRegistry('vault/B'),
    });
  });

  it('leaves corrupt and cross-workspace records unchanged', () => {
    const storage = memoryStorage();
    const key = softFolderScopeStorageKey('vault');
    storage.values.set(key, '{broken');
    expect(loadSoftFolderScope(storage, 'vault')).toMatchObject({
      ok: false,
      kind: 'corrupt',
    });
    expect(storage.values.get(key)).toBe('{broken');
    storage.values.set(
      key,
      JSON.stringify({
        schemaVersion: 1,
        workspaceId: 'other',
        overrides: [],
      }),
    );
    expect(loadSoftFolderScope(storage, 'vault')).toMatchObject({
      ok: false,
      kind: 'corrupt',
    });
  });
});
