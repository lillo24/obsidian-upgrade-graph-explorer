import { describe, expect, it } from 'vitest';
import { setEntitySizeScale } from '@icarus-graph-explorer/presentation-overrides';

import { presentationOverrideStorageKey } from '../persistence/presentation-overrides';
import { clearWorkspaceView, type StorageLike } from '../persistence/storage';
import {
  commitPresentationOverrideSession,
  createPresentationOverrideSession,
} from './session';

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe('Network presentation sessions', () => {
  it('isolates workspaces and persists custom sizes independently of view reset', () => {
    const storage = memoryStorage();
    const session = createPresentationOverrideSession({
      workspaceId: 'A',
      eligibility: 'stable',
      storage,
    });
    const candidate = setEntitySizeScale(session.registry, 'opaque-file', 1.8);
    const committed = commitPresentationOverrideSession(
      session,
      candidate,
      storage,
    );
    expect(committed.ok).toBe(true);
    expect(storage.values.size).toBe(1);
    expect([...storage.values.keys()]).toEqual([
      presentationOverrideStorageKey('A'),
    ]);
    clearWorkspaceView(storage, 'A');
    expect(
      createPresentationOverrideSession({
        workspaceId: 'A',
        eligibility: 'stable',
        storage,
      }).registry,
    ).toEqual(candidate);
    expect(
      createPresentationOverrideSession({
        workspaceId: 'B',
        eligibility: 'stable',
        storage,
      }).registry.entities,
    ).toEqual([]);
    expect(
      commitPresentationOverrideSession(
        session,
        { ...candidate, workspaceId: 'B' },
        storage,
      ).ok,
    ).toBe(false);
  });

  it.each(['transient', 'legacy'] as const)(
    'keeps %s inputs session-only even when storage has a matching ID',
    (eligibility) => {
      const storage = memoryStorage();
      storage.values.set(presentationOverrideStorageKey('sample'), 'ignored');
      const session = createPresentationOverrideSession({
        workspaceId: 'sample',
        eligibility,
        storage,
      });
      const candidate = setEntitySizeScale(session.registry, 'file', 2);
      expect(
        commitPresentationOverrideSession(session, candidate, storage),
      ).toMatchObject({
        ok: true,
        value: { registry: candidate, persistenceMode: 'session-only' },
      });
      expect(storage.values.get(presentationOverrideStorageKey('sample'))).toBe(
        'ignored',
      );
    },
  );

  it('is explicitly session-only when storage is unavailable or fails to read', () => {
    for (const storage of [
      undefined,
      {
        ...memoryStorage(),
        getItem: () => {
          throw new Error('denied');
        },
      },
    ]) {
      const session = createPresentationOverrideSession({
        workspaceId: 'A',
        eligibility: 'stable',
        storage,
      });
      expect(session).toMatchObject({
        persistenceMode: 'session-only',
        status: 'Session only — storage unavailable',
      });
    }
  });

  it.each([
    '{broken',
    '{"schemaVersion":2}',
    '{"schemaVersion":1,"workspaceId":"other","entities":[]}',
  ])('leaves corrupt storage unchanged and blocks edits: %s', (corrupt) => {
    const storage = memoryStorage();
    storage.values.set(presentationOverrideStorageKey('A'), corrupt);
    const session = createPresentationOverrideSession({
      workspaceId: 'A',
      eligibility: 'stable',
      storage,
    });
    expect(session.persistenceMode).toBe('blocked-corrupt');
    expect(session.error).toContain('left unchanged');
    expect(
      commitPresentationOverrideSession(
        session,
        setEntitySizeScale(session.registry, 'file', 1.5),
        storage,
      ).ok,
    ).toBe(false);
    expect(storage.values.get(presentationOverrideStorageKey('A'))).toBe(
      corrupt,
    );
  });

  it('retains confirmed sizes on write failure and prevents repeated writes', () => {
    const storage = memoryStorage();
    const first = createPresentationOverrideSession({
      workspaceId: 'A',
      eligibility: 'stable',
      storage,
    });
    const confirmed = commitPresentationOverrideSession(
      first,
      setEntitySizeScale(first.registry, 'file', 1.5),
      storage,
    ).value;
    let writes = 0;
    storage.setItem = () => {
      writes++;
      throw new Error('quota');
    };
    const failed = commitPresentationOverrideSession(
      confirmed,
      setEntitySizeScale(confirmed.registry, 'file', 2),
      storage,
    );
    expect(failed).toMatchObject({
      ok: false,
      value: {
        persistenceMode: 'blocked-write-failure',
        registry: confirmed.registry,
      },
    });
    expect(failed.value.error).toContain('quota');
    expect(
      commitPresentationOverrideSession(
        failed.value,
        confirmed.registry,
        storage,
      ).ok,
    ).toBe(false);
    expect(writes).toBe(1);
    expect(
      commitPresentationOverrideSession(
        confirmed,
        confirmed.registry,
        undefined,
      ).ok,
    ).toBe(false);
  });
});
