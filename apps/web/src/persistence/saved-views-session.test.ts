import { describe, expect, it } from 'vitest';

import {
  commitSavedViewSessionMutation,
  createSavedViewSession,
  resetSavedViewSession,
} from './saved-views-session';
import {
  createEmptySavedViewRegistry,
  savedViewStorageKey,
} from './saved-views';
import {
  clearWorkspaceView,
  type StorageLike,
  workspaceViewStorageKey,
} from './storage';

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

describe('Named Saved Views session policy', () => {
  it('enables durable mutations only for stable workspaces with storage', () => {
    const storage = memoryStorage();
    expect(
      createSavedViewSession({
        eligibility: 'stable',
        storage,
        workspaceId: 'workspace',
      }),
    ).toMatchObject({ writable: true, recoveryAvailable: false });
    expect(
      createSavedViewSession({
        eligibility: 'transient',
        storage,
        workspaceId: 'workspace',
      }),
    ).toMatchObject({ writable: false, recoveryAvailable: false });
    expect(
      createSavedViewSession({
        eligibility: 'stable',
        storage: undefined,
        workspaceId: 'workspace',
      }),
    ).toMatchObject({ writable: false, recoveryAvailable: false });
  });

  it('writes before adoption and retains the confirmed registry after failure', () => {
    const confirmed = createEmptySavedViewRegistry('workspace');
    const session = {
      registry: confirmed,
      writable: true,
      recoveryAvailable: false,
      status: 'ready',
    };
    const candidate = { ...confirmed, views: [] };
    const result = commitSavedViewSessionMutation(session, candidate, {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('disk full');
      },
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.session.registry).toBe(confirmed);
    expect(result.session.writable).toBe(false);
  });

  it('recovers only the corrupt Saved Views key and leaves other registries untouched', () => {
    const storage = memoryStorage();
    const key = savedViewStorageKey('workspace');
    const otherWorkspaceKey = savedViewStorageKey('other-workspace');
    storage.values.set(key, '{broken');
    storage.values.set(otherWorkspaceKey, 'other views');
    storage.values.set(
      'icarus-graph-explorer:saved-filters:workspace',
      'queries',
    );
    storage.values.set(
      'icarus-graph-explorer:visual-groups:workspace',
      'groups',
    );
    storage.values.set(
      'icarus-graph-explorer:spatial-overrides:workspace',
      'rules',
    );
    storage.values.set(
      'icarus-graph-explorer:presentation-overrides:workspace',
      'sizes',
    );
    storage.values.set('icarus-graph-explorer:view-state:workspace', 'current');
    const blocked = createSavedViewSession({
      eligibility: 'stable',
      storage,
      workspaceId: 'workspace',
    });
    expect(blocked).toMatchObject({
      writable: false,
      recoveryAvailable: true,
    });
    const reset = resetSavedViewSession(blocked, storage);
    expect(reset).toMatchObject({ ok: true });
    expect(storage.values.has(key)).toBe(false);
    expect(storage.values.get(otherWorkspaceKey)).toBe('other views');
    expect([...storage.values.values()]).toEqual([
      'other views',
      'queries',
      'groups',
      'rules',
      'sizes',
      'current',
    ]);
  });

  it('keeps Named Saved Views when Current View is reset', () => {
    const storage = memoryStorage();
    const namedKey = savedViewStorageKey('workspace');
    const currentKey = workspaceViewStorageKey('workspace');
    storage.values.set(namedKey, 'named');
    storage.values.set(currentKey, 'current');

    expect(clearWorkspaceView(storage, 'workspace')).toEqual({ ok: true });
    expect(storage.values.has(currentKey)).toBe(false);
    expect(storage.values.get(namedKey)).toBe('named');
  });
});
