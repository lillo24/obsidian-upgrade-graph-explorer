import { describe, expect, it } from 'vitest';
import {
  createEmptySpatialOverrideRegistry,
  setFolderClusterAnchor,
} from '@icarus-graph-explorer/spatial-overrides';

import type { StorageLike } from './storage';
import {
  clearSpatialOverrides,
  loadSpatialOverrides,
  saveSpatialOverrides,
  spatialOverrideStorageKey,
} from './spatial-overrides';

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

describe('spatial override persistence adapter', () => {
  it('uses an encoded workspace key and round-trips a registry', () => {
    expect(spatialOverrideStorageKey('stable/workspace name')).toBe(
      'icarus-graph-explorer:spatial-overrides:stable%2Fworkspace%20name',
    );
    const storage = memoryStorage();
    const registry = setFolderClusterAnchor(
      createEmptySpatialOverrideRegistry('stable/workspace name'),
      'Research',
      { x: 0.75, y: -0.5 },
    );
    expect(saveSpatialOverrides(storage, registry)).toEqual({ ok: true });
    expect(loadSpatialOverrides(storage, registry.workspaceId)).toEqual({
      ok: true,
      value: registry,
    });
  });

  it('leaves malformed, incompatible, and mismatched values untouched', () => {
    for (const value of [
      '{broken',
      '{"schemaVersion":2}',
      '{"schemaVersion":1,"workspaceId":"other","allNetwork":{"folderAnchors":[]}}',
    ]) {
      const storage = memoryStorage();
      const key = spatialOverrideStorageKey('workspace');
      storage.values.set(key, value);
      expect(loadSpatialOverrides(storage, 'workspace')).toMatchObject({
        ok: false,
        kind: 'corrupt',
      });
      expect(storage.values.get(key)).toBe(value);
    }
  });

  it('reports read, write, and clear failures explicitly', () => {
    const storage: StorageLike = {
      getItem: () => {
        throw new Error('read denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('remove denied');
      },
    };
    expect(loadSpatialOverrides(storage, 'workspace')).toMatchObject({
      ok: false,
      kind: 'storage',
    });
    expect(
      saveSpatialOverrides(
        storage,
        createEmptySpatialOverrideRegistry('workspace'),
      ),
    ).toMatchObject({ ok: false });
    expect(clearSpatialOverrides(storage, 'workspace')).toMatchObject({
      ok: false,
    });
  });
});
