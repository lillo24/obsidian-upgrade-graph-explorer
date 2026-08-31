import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  type StructuralDepth,
} from '@icarus-graph-explorer/view-projection';
import {
  createPersistedWorkspaceView,
  PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
} from '@icarus-graph-explorer/view-state';
import { describe, expect, it } from 'vitest';

import { hydrateGraphView } from './session';
import {
  clearWorkspaceView,
  loadWorkspaceView,
  saveWorkspaceView,
  workspaceViewStorageKey,
  type StorageLike,
} from './storage';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  reads = 0;
  writes = 0;
  removes = 0;

  getItem(key: string): string | null {
    this.reads += 1;
    return this.values.get(key) ?? null;
  }

  removeItem(key: string): void {
    this.removes += 1;
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.writes += 1;
    this.values.set(key, value);
  }
}

function snapshot(workspaceId: string): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: workspaceId },
    entities: [
      {
        id: `${workspaceId}-document`,
        kind: 'document',
        source: {
          path: 'Document.md',
          span: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
          },
        },
      },
    ],
    references: [],
  };
}

function saved(workspaceId: string, defaultDepth: StructuralDepth = 1) {
  const workspace = createProjectionWorkspace(snapshot(workspaceId));
  return createPersistedWorkspaceView({
    workspace,
    state: {
      ...documentOnlyProjectionState(),
      disclosure: {
        ...documentOnlyProjectionState().disclosure,
        defaultDepth,
        maxSectionLevel: 2,
      },
    },
    viewport: { anchorEntityId: `${workspaceId}-document`, zoom: 1.1 },
  });
}

describe('browser saved-view storage', () => {
  it('saves and loads encoded workspace-scoped values', () => {
    const storage = new MemoryStorage();
    const value = saved('stable / one');

    expect(saveWorkspaceView(storage, value)).toEqual({ ok: true });
    expect(loadWorkspaceView(storage, 'stable / one')).toEqual({
      status: 'loaded',
      value,
    });
    expect(workspaceViewStorageKey('stable / one')).toBe(
      'icarus-graph-explorer:view-state:stable%20%2F%20one',
    );
  });

  it('isolates two workspaces and clears only the selected workspace', () => {
    const storage = new MemoryStorage();
    saveWorkspaceView(storage, saved('one'));
    saveWorkspaceView(storage, saved('two'));

    expect(clearWorkspaceView(storage, 'one')).toEqual({ ok: true });
    expect(loadWorkspaceView(storage, 'one')).toEqual({ status: 'empty' });
    expect(loadWorkspaceView(storage, 'two').status).toBe('loaded');
  });

  it('reports malformed JSON without deleting or overwriting it', () => {
    const storage = new MemoryStorage();
    const key = workspaceViewStorageKey('one');
    storage.values.set(key, '{not-json');

    expect(loadWorkspaceView(storage, 'one').status).toBe('error');
    expect(storage.values.get(key)).toBe('{not-json');
    expect(storage.writes).toBe(0);
    expect(storage.removes).toBe(0);
  });

  it('reports unsupported schemas without silently overwriting them', () => {
    const storage = new MemoryStorage();
    const key = workspaceViewStorageKey('one');
    const unsupported = JSON.stringify({
      ...saved('one'),
      schemaVersion: PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION + 1,
    });
    storage.values.set(key, unsupported);
    const hydration = hydrateGraphView({
      eligibility: 'stable',
      storage,
      workspace: createProjectionWorkspace(snapshot('one')),
    });

    expect(hydration.writable).toBe(false);
    expect(hydration.status).toContain('Unsupported persisted-view schema');
    expect(storage.values.get(key)).toBe(unsupported);
    expect(storage.writes).toBe(0);
  });

  it('converts storage getter, setter, and remover failures into explicit results', () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error('read denied');
      },
      setItem() {
        throw new Error('quota exceeded');
      },
      removeItem() {
        throw new Error('delete denied');
      },
    };

    expect(loadWorkspaceView(throwing, 'one')).toMatchObject({
      status: 'error',
      message: expect.stringContaining('read denied'),
    });
    expect(saveWorkspaceView(throwing, saved('one'))).toMatchObject({
      ok: false,
      message: expect.stringContaining('quota exceeded'),
    });
    expect(clearWorkspaceView(throwing, 'one')).toMatchObject({
      ok: false,
      message: expect.stringContaining('delete denied'),
    });
  });

  it.each(['transient', 'legacy'] as const)(
    'never reads or writes for %s reports',
    (eligibility) => {
      const storage = new MemoryStorage();
      const hydration = hydrateGraphView({
        eligibility,
        storage,
        workspace: createProjectionWorkspace(snapshot('one')),
      });

      expect(hydration.writable).toBe(false);
      expect(storage.reads).toBe(0);
      expect(storage.writes).toBe(0);
    },
  );

  it('hydrates a stable saved view before any write and keeps report workspaces isolated', () => {
    const storage = new MemoryStorage();
    saveWorkspaceView(storage, saved('one'));
    storage.writes = 0;

    const one = hydrateGraphView({
      eligibility: 'stable',
      storage,
      workspace: createProjectionWorkspace(snapshot('one')),
    });
    const two = hydrateGraphView({
      eligibility: 'stable',
      storage,
      workspace: createProjectionWorkspace(snapshot('two')),
    });

    expect(one.state.disclosure.defaultDepth).toBe(1);
    expect(one.state.disclosure.maxSectionLevel).toBe(2);
    expect(one.viewport).toEqual({
      anchorEntityId: 'one-document',
      zoom: 1.1,
    });
    expect(two.state.disclosure.defaultDepth).toBe(0);
    expect(two.state.disclosure.maxSectionLevel).toBeUndefined();
    expect(storage.writes).toBe(0);
  });

  it.each([2, 3] as const)(
    'hydrates persisted structural depth %i under schema v2',
    (defaultDepth) => {
      const storage = new MemoryStorage();
      const value = saved('deep', defaultDepth);
      saveWorkspaceView(storage, value);

      const hydration = hydrateGraphView({
        eligibility: 'stable',
        storage,
        workspace: createProjectionWorkspace(snapshot('deep')),
      });

      expect(value.schemaVersion).toBe(2);
      expect(hydration.state.disclosure.defaultDepth).toBe(defaultDepth);
      expect(hydration.writable).toBe(true);
    },
  );
});
