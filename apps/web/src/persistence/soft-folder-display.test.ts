import { describe, expect, it } from 'vitest';

import type { StorageLike } from './storage';
import {
  createEmptySoftFolderDisplayRegistry,
  loadSoftFolderDisplay,
  saveSoftFolderDisplay,
  softFolderDisplayStorageKey,
} from './soft-folder-display';

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe('Soft folder display persistence', () => {
  it('uses an encoded workspace-local key and canonical sparse intent', () => {
    const storage = memoryStorage();
    const registry = {
      ...createEmptySoftFolderDisplayRegistry('vault/A'),
      displayIntent: {
        fileParentOverrides: [
          { fileId: 'z', displayParentFolderKey: 'Z' },
          { fileId: 'a', displayParentFolderKey: 'A' },
        ],
        flattenedFolderKeys: ['Z/B', 'A/B'],
      },
    };
    expect(saveSoftFolderDisplay(storage, registry)).toEqual({ ok: true });
    expect(softFolderDisplayStorageKey('vault/A')).toBe(
      'icarus-graph-explorer:soft-folder-scope:vault%2FA',
    );
    expect(loadSoftFolderDisplay(storage, 'vault/A')).toEqual({
      ok: true,
      legacyReset: false,
      value: {
        ...registry,
        displayIntent: {
          fileParentOverrides: [
            ...registry.displayIntent.fileParentOverrides,
          ].reverse(),
          flattenedFolderKeys: [
            ...registry.displayIntent.flattenedFolderKeys,
          ].reverse(),
        },
      },
    });
    expect(loadSoftFolderDisplay(storage, 'vault/B')).toEqual({
      ok: true,
      legacyReset: false,
      value: createEmptySoftFolderDisplayRegistry('vault/B'),
    });
  });

  it('recognizes schema 1 for a narrow Experimental reset', () => {
    const storage = memoryStorage();
    storage.values.set(
      softFolderDisplayStorageKey('vault'),
      JSON.stringify({ schemaVersion: 1, workspaceId: 'vault', overrides: [] }),
    );
    expect(loadSoftFolderDisplay(storage, 'vault')).toMatchObject({
      ok: true,
      legacyReset: true,
      value: {
        displayIntent: { fileParentOverrides: [], flattenedFolderKeys: [] },
      },
    });
  });

  it('leaves corrupt records unchanged', () => {
    const storage = memoryStorage();
    const key = softFolderDisplayStorageKey('vault');
    storage.values.set(key, '{broken');
    expect(loadSoftFolderDisplay(storage, 'vault')).toMatchObject({
      ok: false,
      kind: 'corrupt',
    });
    expect(storage.values.get(key)).toBe('{broken');
  });
});
