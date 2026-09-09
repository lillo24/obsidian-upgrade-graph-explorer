import { describe, expect, it } from 'vitest';

import { softFolderScopeStorageKey } from '../persistence/soft-folder-scope';
import type { StorageLike } from '../persistence/storage';
import {
  commitSoftFolderScopeSession,
  createSoftFolderScopeSession,
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

const overrides = [
  { exactFolderKey: 'Language/Grammar', spatialGroupKey: 'Language' },
] as const;

describe('Soft folder scope workspace session', () => {
  it('persists stable workspace state and isolates A → B → A', () => {
    const storage = memoryStorage();
    const firstA = createSoftFolderScopeSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    expect(commitSoftFolderScopeSession(firstA, overrides, storage).ok).toBe(
      true,
    );
    expect(
      createSoftFolderScopeSession({
        eligibility: 'stable',
        storage,
        workspaceId: 'B',
      }).registry.overrides,
    ).toEqual([]);
    expect(
      createSoftFolderScopeSession({
        eligibility: 'stable',
        storage,
        workspaceId: 'A',
      }).registry.overrides,
    ).toEqual(overrides);
  });

  it.each(['transient', 'legacy'] as const)(
    'keeps %s workspace changes in memory only',
    (eligibility) => {
      const storage = memoryStorage();
      const session = createSoftFolderScopeSession({
        eligibility,
        storage,
        workspaceId: 'workspace',
      });
      const committed = commitSoftFolderScopeSession(
        session,
        overrides,
        storage,
      );
      expect(committed).toMatchObject({
        ok: true,
        value: { persistenceMode: 'session-only', registry: { overrides } },
      });
      expect(storage.values.size).toBe(0);
    },
  );

  it('retains last confirmed state and blocks retries after a write failure', () => {
    const storage = memoryStorage();
    const initial = createSoftFolderScopeSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    let writes = 0;
    storage.setItem = () => {
      writes += 1;
      throw new Error('quota');
    };
    const failed = commitSoftFolderScopeSession(initial, overrides, storage);
    expect(failed).toMatchObject({
      ok: false,
      value: {
        persistenceMode: 'blocked-write-failure',
        registry: { overrides: [] },
      },
    });
    const retried = commitSoftFolderScopeSession(
      failed.value,
      overrides,
      storage,
    );
    expect(retried.ok).toBe(false);
    expect(writes).toBe(1);
    expect(storage.values.has(softFolderScopeStorageKey('workspace'))).toBe(
      false,
    );
  });
});
