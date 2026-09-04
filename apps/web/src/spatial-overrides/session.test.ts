import { describe, expect, it } from 'vitest';
import {
  setFolderClusterAnchor,
  type SpatialOverrideRegistry,
} from '@icarus-graph-explorer/spatial-overrides';

import { presentationOverrideStorageKey } from '../persistence/presentation-overrides';
import { spatialOverrideStorageKey } from '../persistence/spatial-overrides';
import { clearWorkspaceView } from '../persistence/storage';
import type { StorageLike } from '../persistence/storage';
import {
  GRAPH_PREFERENCES_STORAGE_KEY,
  saveGraphPreferences,
  DEFAULT_GRAPH_PREFERENCES,
} from '../preferences/graph-preferences';
import {
  commitSpatialOverrideSessionMutation,
  createSpatialOverrideSession,
  resetCorruptSpatialOverrideSession,
  SPATIAL_OVERRIDE_CORRUPT_STATUS,
  SPATIAL_OVERRIDE_DURABLE_STATUS,
  SPATIAL_OVERRIDE_STORAGE_UNAVAILABLE_STATUS,
  SPATIAL_OVERRIDE_UNSTABLE_STATUS,
  SPATIAL_OVERRIDE_WRITE_FAILURE_STATUS,
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

function candidate(
  session: ReturnType<typeof createSpatialOverrideSession>,
  folderKey = 'Research',
): SpatialOverrideRegistry {
  return setFolderClusterAnchor(session.registry, folderKey, {
    x: 0.8,
    y: 0.6,
  });
}

describe('spatial override workspace session', () => {
  it('loads stable workspaces durably and isolates A → B → A', () => {
    const storage = memoryStorage();
    const firstA = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    const committedA = commitSpatialOverrideSessionMutation(
      firstA,
      candidate(firstA),
      storage,
    );
    expect(committedA.ok).toBe(true);
    const workspaceB = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'B',
    });
    const restoredA = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    expect(firstA.status).toBe(SPATIAL_OVERRIDE_DURABLE_STATUS);
    expect(workspaceB.registry.allNetwork.folderRules).toEqual([]);
    expect(restoredA.registry).toEqual(committedA.value.registry);
  });

  it('uses declared stable identity for the Synthetic Sample', () => {
    const storage = memoryStorage();
    const sample = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'sample-workspace',
    });
    const committed = commitSpatialOverrideSessionMutation(
      sample,
      candidate(sample),
      storage,
    );
    expect(committed.ok).toBe(true);
    expect(
      createSpatialOverrideSession({
        eligibility: 'stable',
        storage,
        workspaceId: 'sample-workspace',
      }).registry,
    ).toEqual(committed.value.registry);
  });

  it.each(['transient', 'legacy'] as const)(
    'keeps %s reports editable in memory without touching durable data',
    (eligibility) => {
      const storage = memoryStorage();
      const key = spatialOverrideStorageKey('sample');
      storage.values.set(key, 'durable-value');
      const session = createSpatialOverrideSession({
        eligibility,
        storage,
        workspaceId: 'sample',
      });
      const committed = commitSpatialOverrideSessionMutation(
        session,
        candidate(session),
        storage,
      );
      expect(session).toMatchObject({
        persistenceMode: 'session-only',
        status: SPATIAL_OVERRIDE_UNSTABLE_STATUS,
      });
      expect(committed).toMatchObject({
        ok: true,
        value: {
          registry: {
            allNetwork: {
              folderRules: [
                {
                  folderKey: 'Research',
                  behavior: 'place',
                  scope: { kind: 'exact' },
                },
              ],
            },
          },
        },
      });
      expect(storage.values.get(key)).toBe('durable-value');
    },
  );

  it('treats unavailable or unreadable storage as visible session-only status', () => {
    const unreadable: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      setItem: () => undefined,
    };
    for (const storage of [undefined, unreadable]) {
      const session = createSpatialOverrideSession({
        eligibility: 'stable',
        storage,
        workspaceId: 'workspace',
      });
      expect(session).toMatchObject({
        persistenceMode: 'session-only',
        status: SPATIAL_OVERRIDE_STORAGE_UNAVAILABLE_STATUS,
      });
      if (storage !== undefined) expect(session.error).toContain('blocked');
    }
  });

  it.each([
    '{broken',
    '{"schemaVersion":2}',
    '{"schemaVersion":1,"workspaceId":"other","allNetwork":{"folderAnchors":[]}}',
  ])('keeps corruption untouched and blocks editing: %s', (corrupt) => {
    const storage = memoryStorage();
    const key = spatialOverrideStorageKey('workspace');
    storage.values.set(key, corrupt);
    const session = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    expect(session).toMatchObject({
      persistenceMode: 'blocked-corrupt',
      status: SPATIAL_OVERRIDE_CORRUPT_STATUS,
    });
    expect(
      commitSpatialOverrideSessionMutation(
        session,
        candidate(session),
        storage,
      ),
    ).toMatchObject({ ok: false, value: { registry: session.registry } });
    expect(storage.values.get(key)).toBe(corrupt);
  });

  it('recovers corruption only through an explicit registry-key reset', () => {
    const storage = memoryStorage();
    const key = spatialOverrideStorageKey('workspace');
    storage.values.set(key, '{broken');
    storage.values.set('unrelated', 'keep');
    const session = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    const recovered = resetCorruptSpatialOverrideSession(session, storage);
    expect(recovered).toMatchObject({
      ok: true,
      value: {
        persistenceMode: 'durable',
        status: SPATIAL_OVERRIDE_DURABLE_STATUS,
      },
    });
    expect(storage.values.has(key)).toBe(false);
    expect(storage.values.get('unrelated')).toBe('keep');
  });

  it('retains the last confirmed registry and blocks retries after write failure', () => {
    const storage = memoryStorage();
    const initial = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    const confirmed = commitSpatialOverrideSessionMutation(
      initial,
      candidate(initial),
      storage,
    ).value;
    let writes = 0;
    storage.setItem = () => {
      writes += 1;
      throw new Error('quota');
    };
    const failed = commitSpatialOverrideSessionMutation(
      confirmed,
      candidate(confirmed, 'Other'),
      storage,
    );
    expect(failed).toMatchObject({
      ok: false,
      value: {
        registry: confirmed.registry,
        persistenceMode: 'blocked-write-failure',
        status: SPATIAL_OVERRIDE_WRITE_FAILURE_STATUS,
      },
    });
    const retried = commitSpatialOverrideSessionMutation(
      failed.value,
      candidate(failed.value, 'Third'),
      storage,
    );
    expect(retried.ok).toBe(false);
    expect(writes).toBe(1);
  });

  it('keeps view reset, graph preferences, and presentation overrides independent', () => {
    const storage = memoryStorage();
    const session = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    const committed = commitSpatialOverrideSessionMutation(
      session,
      candidate(session),
      storage,
    );
    expect(committed.ok).toBe(true);
    storage.values.set('icarus-graph-explorer:view-state:workspace', 'view');
    storage.values.set(presentationOverrideStorageKey('workspace'), 'sizes');
    expect(saveGraphPreferences(storage, DEFAULT_GRAPH_PREFERENCES)).toEqual({
      ok: true,
    });

    clearWorkspaceView(storage, 'workspace');
    expect(storage.values.has(spatialOverrideStorageKey('workspace'))).toBe(
      true,
    );
    expect(
      storage.values.get(presentationOverrideStorageKey('workspace')),
    ).toBe('sizes');
    expect(storage.values.has(GRAPH_PREFERENCES_STORAGE_KEY)).toBe(true);
  });

  it('rejects a candidate from another workspace', () => {
    const storage = memoryStorage();
    const a = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'A',
    });
    const b = createSpatialOverrideSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'B',
    });
    expect(
      commitSpatialOverrideSessionMutation(a, candidate(b), storage).ok,
    ).toBe(false);
  });
});
