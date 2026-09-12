import { describe, expect, it } from 'vitest';

import {
  createEmptySpatialOverrideRegistry,
  setFolderSpatialRule,
} from '@icarus-graph-explorer/spatial-overrides';
import {
  customGlobalLayoutSettings,
  type GlobalLayoutSettings,
} from '@icarus-graph-explorer/renderer-sigma/settings';

import {
  DEFAULT_GRAPH_PREFERENCES,
  GRAPH_PREFERENCES_STORAGE_KEY,
  serializeGraphPreferences,
} from './preferences/graph-preferences';
import { spatialOverrideStorageKey } from './persistence/spatial-overrides';
import type { StorageLike } from './persistence/storage';
import { commitSavedViewProfileTransaction } from './saved-view-profile-transaction';
import {
  SPATIAL_OVERRIDE_DURABLE_STATUS,
  type SpatialOverrideSession,
} from './spatial-overrides/session';

const workspaceId = 'workspace';
const currentSpatial = createEmptySpatialOverrideRegistry(workspaceId);
const targetSpatial = setFolderSpatialRule(currentSpatial, {
  folderKey: 'Architecture',
  behavior: 'pull',
  scope: { kind: 'subtree', includeRootFiles: true, excludedSubtrees: [] },
  anchor: { x: 0.6, y: -0.4 },
  strength: 75,
});
const spatialSession: SpatialOverrideSession = {
  registry: currentSpatial,
  persistenceMode: 'durable',
  status: SPATIAL_OVERRIDE_DURABLE_STATUS,
};
const targetNetwork: GlobalLayoutSettings = {
  folderClustering: false,
  spacingPreset: 'spacious',
  custom: {
    ...customGlobalLayoutSettings('spacious'),
    linkForce: 1.6,
    nodeSize: 7.5,
  },
};
const targetPreferences = {
  ...DEFAULT_GRAPH_PREFERENCES,
  globalLayoutSettings: targetNetwork,
};

function storageFixture(): StorageLike & {
  readonly values: Map<string, string>;
  readonly writes: string[];
} {
  const values = new Map<string, string>([
    [
      GRAPH_PREFERENCES_STORAGE_KEY,
      serializeGraphPreferences(DEFAULT_GRAPH_PREFERENCES),
    ],
    [spatialOverrideStorageKey(workspaceId), JSON.stringify(currentSpatial)],
    ['icarus-graph-explorer:visual-groups:workspace', 'groups'],
    ['icarus-graph-explorer:saved-filters:workspace', 'queries'],
    ['icarus-graph-explorer:presentation-overrides:workspace', 'sizes'],
  ]);
  const writes: string[] = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      writes.push(key);
      values.delete(key);
    },
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
  };
}

function plan() {
  return {
    currentPreferences: DEFAULT_GRAPH_PREFERENCES,
    preferences: targetPreferences,
    spatialSession,
    spatial: targetSpatial,
  };
}

describe('Saved View cross-key profile transaction', () => {
  it('writes spatial first, then preferences, and returns one adoptable final state', () => {
    const storage = storageFixture();

    const result = commitSavedViewProfileTransaction({ storage, plan: plan() });

    expect(result).toMatchObject({
      ok: true,
      preferenceWrite: true,
      spatialWrite: true,
    });
    if (!result.ok) return;
    expect(storage.writes).toEqual([
      spatialOverrideStorageKey(workspaceId),
      GRAPH_PREFERENCES_STORAGE_KEY,
    ]);
    expect(result.preferences).toEqual(targetPreferences);
    expect(result.spatialSession.registry).toEqual(targetSpatial);
    expect(
      storage.values.get('icarus-graph-explorer:visual-groups:workspace'),
    ).toBe('groups');
    expect(
      storage.values.get('icarus-graph-explorer:saved-filters:workspace'),
    ).toBe('queries');
    expect(
      storage.values.get(
        'icarus-graph-explorer:presentation-overrides:workspace',
      ),
    ).toBe('sizes');
  });

  it('performs zero reads or writes for an exact profile reapply', () => {
    const calls: string[] = [];
    const exactSession = { ...spatialSession, registry: targetSpatial };
    const result = commitSavedViewProfileTransaction({
      storage: {
        getItem: (key) => {
          calls.push(`get:${key}`);
          return null;
        },
        removeItem: (key) => calls.push(`remove:${key}`),
        setItem: (key) => calls.push(`set:${key}`),
      },
      plan: {
        currentPreferences: targetPreferences,
        preferences: targetPreferences,
        spatialSession: exactSession,
        spatial: targetSpatial,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      preferenceWrite: false,
      spatialWrite: false,
    });
    expect(calls).toEqual([]);
  });

  it('does not write preferences when the spatial write fails first', () => {
    const storage = storageFixture();
    const before = new Map(storage.values);
    storage.setItem = (key) => {
      storage.writes.push(key);
      if (key === spatialOverrideStorageKey(workspaceId))
        throw new Error('spatial full');
    };

    const result = commitSavedViewProfileTransaction({ storage, plan: plan() });

    expect(result).toMatchObject({ ok: false });
    expect(storage.writes).not.toContain(GRAPH_PREFERENCES_STORAGE_KEY);
    expect(storage.values).toEqual(before);
  });

  it('does not return adoptable state when a preference-only write fails', () => {
    const storage = storageFixture();
    const before = new Map(storage.values);
    storage.setItem = (key) => {
      storage.writes.push(key);
      throw new Error('preferences full');
    };

    const result = commitSavedViewProfileTransaction({
      storage,
      plan: {
        currentPreferences: DEFAULT_GRAPH_PREFERENCES,
        preferences: targetPreferences,
        spatialSession,
      },
    });

    expect(result).toMatchObject({ ok: false });
    expect(storage.writes).toEqual([GRAPH_PREFERENCES_STORAGE_KEY]);
    expect(storage.values).toEqual(before);
  });

  it('rolls spatial and preferences back when the second write fails', () => {
    const storage = storageFixture();
    const before = new Map(storage.values);
    const ordinarySet = storage.setItem.bind(storage);
    let failPreference = true;
    storage.setItem = (key, value) => {
      if (key === GRAPH_PREFERENCES_STORAGE_KEY && failPreference) {
        failPreference = false;
        storage.writes.push(key);
        throw new Error('preferences full');
      }
      ordinarySet(key, value);
    };

    const result = commitSavedViewProfileTransaction({ storage, plan: plan() });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.message).toContain(
      'Previous durable profile values were restored',
    );
    expect(storage.values).toEqual(before);
  });

  it('surfaces rollback failure without returning adoptable state', () => {
    const storage = storageFixture();
    const spatialKey = spatialOverrideStorageKey(workspaceId);
    let spatialWrites = 0;
    storage.setItem = (key, value) => {
      storage.writes.push(key);
      if (key === spatialKey) {
        spatialWrites += 1;
        if (spatialWrites > 1) throw new Error('rollback blocked');
        storage.values.set(key, value);
        return;
      }
      if (key === GRAPH_PREFERENCES_STORAGE_KEY)
        throw new Error('preferences full');
      storage.values.set(key, value);
    };

    const result = commitSavedViewProfileTransaction({ storage, plan: plan() });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.message).toContain(
      'folder positions: rollback blocked',
    );
  });

  it('rejects an All Network profile while spatial persistence is blocked', () => {
    const storage = storageFixture();
    const result = commitSavedViewProfileTransaction({
      storage,
      plan: {
        ...plan(),
        spatialSession: {
          ...spatialSession,
          persistenceMode: 'blocked-corrupt',
        },
      },
    });
    expect(result).toMatchObject({ ok: false });
    expect(storage.writes).toEqual([]);
  });
});
