import { describe, expect, it } from 'vitest';

import { addVisualGroup } from '../persistence/visual-groups';
import type { StorageLike } from '../persistence/storage';
import {
  commitVisualGroupSessionMutation,
  createVisualGroupSession,
  resetCorruptVisualGroupSession,
  VISUAL_GROUP_CORRUPT_STATUS,
  VISUAL_GROUP_DURABLE_STATUS,
  VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS,
  VISUAL_GROUP_UNSTABLE_STATUS,
  VISUAL_GROUP_WRITE_FAILURE_STATUS,
} from './session';

function memoryStorage(): StorageLike & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

function groupCandidate(session: ReturnType<typeof createVisualGroupSession>) {
  const candidate = addVisualGroup(session.registry, {
    name: 'Research',
    query: 'path:Research',
    color: 'green',
    enabled: true,
  });
  if (!candidate.ok) throw new Error(candidate.message);
  return candidate.value;
}

describe('Visual Group workspace session', () => {
  it('loads stable workspaces durably and isolates A → B → A', () => {
    const storage = memoryStorage();
    const firstA = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    const committedA = commitVisualGroupSessionMutation(
      firstA,
      groupCandidate(firstA),
      storage,
    );
    expect(committedA.ok).toBe(true);
    if (!committedA.ok) return;

    const workspaceB = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'B',
    });
    const restoredA = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });

    expect(firstA.status).toBe(VISUAL_GROUP_DURABLE_STATUS);
    expect(workspaceB.registry.groups).toEqual([]);
    expect(restoredA.registry.groups).toEqual(committedA.value.registry.groups);
  });

  it.each([
    ['transient' as const, memoryStorage(), VISUAL_GROUP_UNSTABLE_STATUS],
    ['legacy' as const, memoryStorage(), VISUAL_GROUP_UNSTABLE_STATUS],
    ['stable' as const, undefined, VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS],
  ])('keeps %s sessions editable in memory', (eligibility, storage, status) => {
    const session = createVisualGroupSession({
      eligibility,
      storage,
      workspaceId: 'session',
    });
    const committed = commitVisualGroupSessionMutation(
      session,
      groupCandidate(session),
      storage,
    );

    expect(session).toMatchObject({ persistenceMode: 'session-only', status });
    expect(committed).toMatchObject({
      ok: true,
      value: { registry: { groups: [{ name: 'Research' }] } },
    });
  });

  it('treats a storage read failure as session-only rather than corrupt', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    const session = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });

    expect(session).toMatchObject({
      persistenceMode: 'session-only',
      status: VISUAL_GROUP_STORAGE_UNAVAILABLE_STATUS,
      registry: { groups: [] },
    });
  });

  it('preserves corrupt storage until explicit recovery clears only that key', () => {
    const storage = memoryStorage();
    const key = 'icarus-graph-explorer:visual-groups:workspace';
    storage.values.set(key, '{broken');
    storage.values.set('icarus-graph-explorer:view-state:workspace', 'view');
    const session = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });

    expect(session).toMatchObject({
      persistenceMode: 'blocked-corrupt',
      status: VISUAL_GROUP_CORRUPT_STATUS,
      registry: { groups: [] },
    });
    expect(storage.values.get(key)).toBe('{broken');
    expect(
      commitVisualGroupSessionMutation(
        session,
        groupCandidate(session),
        storage,
      ),
    ).toMatchObject({ ok: false, value: { registry: { groups: [] } } });

    const reset = resetCorruptVisualGroupSession(session, storage);
    expect(reset).toMatchObject({
      ok: true,
      value: {
        persistenceMode: 'durable',
        status: VISUAL_GROUP_DURABLE_STATUS,
        registry: { groups: [] },
      },
    });
    expect(storage.values.has(key)).toBe(false);
    expect(
      storage.values.get('icarus-graph-explorer:view-state:workspace'),
    ).toBe('view');
  });

  it('keeps corruption blocked when explicit recovery cannot clear storage', () => {
    const storage: StorageLike = {
      getItem: () => '{broken',
      removeItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
    };
    const session = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    const reset = resetCorruptVisualGroupSession(session, storage);

    expect(reset).toMatchObject({
      ok: false,
      value: { persistenceMode: 'blocked-corrupt' },
    });
    if (reset.ok) return;
    expect(reset.message).toContain('denied');
  });

  it('does not adopt a durable candidate after a write failure', () => {
    let writes = 0;
    const storage: StorageLike = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        writes += 1;
        throw new Error('quota');
      },
    };
    const session = createVisualGroupSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    const failed = commitVisualGroupSessionMutation(
      session,
      groupCandidate(session),
      storage,
    );

    expect(writes).toBe(1);
    expect(failed).toMatchObject({
      ok: false,
      value: {
        persistenceMode: 'blocked-write-failure',
        status: VISUAL_GROUP_WRITE_FAILURE_STATUS,
        registry: { groups: [] },
      },
    });
    if (failed.ok) return;
    const retried = commitVisualGroupSessionMutation(
      failed.value,
      groupCandidate(failed.value),
      storage,
    );
    expect(retried.ok).toBe(false);
    expect(writes).toBe(1);
  });
});
