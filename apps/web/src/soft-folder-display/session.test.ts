import { describe, expect, it } from 'vitest';

import { softFolderDisplayStorageKey } from '../persistence/soft-folder-display';
import type { StorageLike } from '../persistence/storage';
import {
  commitSoftFolderDisplaySession,
  createSoftFolderDisplaySession,
} from './session';

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

const displayIntent = {
  fileParentOverrides: [{ fileId: 'file-a', displayParentFolderKey: 'A' }],
  flattenedFolderKeys: ['A/B'],
} as const;

describe('Soft folder display workspace session', () => {
  it('N16 persists stable workspace state and isolates A → B → A', () => {
    const storage = memoryStorage();
    const firstA = createSoftFolderDisplaySession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    expect(
      commitSoftFolderDisplaySession(firstA, displayIntent, storage).ok,
    ).toBe(true);
    expect(
      createSoftFolderDisplaySession({
        eligibility: 'stable',
        storage,
        workspaceId: 'B',
      }).registry.displayIntent,
    ).toEqual({ fileParentOverrides: [], flattenedFolderKeys: [] });
    expect(
      createSoftFolderDisplaySession({
        eligibility: 'stable',
        storage,
        workspaceId: 'A',
      }).registry.displayIntent,
    ).toEqual(displayIntent);
  });

  it.each(['transient', 'legacy'] as const)(
    'keeps %s workspace changes in memory only',
    (eligibility) => {
      const storage = memoryStorage();
      const session = createSoftFolderDisplaySession({
        eligibility,
        storage,
        workspaceId: 'workspace',
      });
      const committed = commitSoftFolderDisplaySession(
        session,
        displayIntent,
        storage,
      );
      expect(committed).toMatchObject({
        ok: true,
        value: { persistenceMode: 'session-only', registry: { displayIntent } },
      });
      expect(storage.values.size).toBe(0);
    },
  );

  it('retains confirmed state and blocks retries after a write failure', () => {
    const storage = memoryStorage();
    const initial = createSoftFolderDisplaySession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    let writes = 0;
    storage.setItem = () => {
      writes += 1;
      throw new Error('quota');
    };
    const failed = commitSoftFolderDisplaySession(
      initial,
      displayIntent,
      storage,
    );
    expect(failed).toMatchObject({
      ok: false,
      value: {
        persistenceMode: 'blocked-write-failure',
        registry: {
          displayIntent: { fileParentOverrides: [], flattenedFolderKeys: [] },
        },
      },
    });
    expect(
      commitSoftFolderDisplaySession(failed.value, displayIntent, storage).ok,
    ).toBe(false);
    expect(writes).toBe(1);
    expect(storage.values.has(softFolderDisplayStorageKey('workspace'))).toBe(
      false,
    );
  });
});
