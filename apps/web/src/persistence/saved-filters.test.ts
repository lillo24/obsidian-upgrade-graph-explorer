import { describe, expect, it } from 'vitest';

import {
  addSavedGraphFilter,
  deleteSavedGraphFilter,
  loadSavedGraphFilters,
  savedGraphFilterStorageKey,
  saveSavedGraphFilterRegistry,
  serializeSavedGraphFilterRegistry,
  validateSavedGraphFilterRegistry,
} from './saved-filters';
import type { StorageLike } from './storage';

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

describe('saved graph filter registry', () => {
  it('uses an encoded stable-workspace key without source paths', () => {
    expect(savedGraphFilterStorageKey('stable/workspace name')).toBe(
      'icarus-graph-explorer:saved-filters:stable%2Fworkspace%20name',
    );
  });

  it('loads an empty registry and round-trips deterministic canonical filters', () => {
    const storage = memoryStorage();
    const empty = loadSavedGraphFilters(storage, 'workspace');
    expect(empty.status).toBe('empty');
    if (empty.status === 'error') return;
    const zebra = addSavedGraphFilter(empty.value, 'Zebra', 'sections');
    expect(zebra.ok).toBe(true);
    if (!zebra.ok) return;
    const alpha = addSavedGraphFilter(
      zebra.value,
      'alpha',
      'documents or path:"Notes"',
    );
    expect(alpha.ok).toBe(true);
    if (!alpha.ok) return;

    expect(alpha.value.filters).toEqual([
      { name: 'alpha', query: 'kind:document OR path:"Notes"' },
      { name: 'Zebra', query: 'kind:section' },
    ]);
    expect(saveSavedGraphFilterRegistry(storage, alpha.value)).toEqual({
      ok: true,
    });
    expect(loadSavedGraphFilters(storage, 'workspace')).toEqual({
      status: 'loaded',
      value: alpha.value,
    });
    expect(serializeSavedGraphFilterRegistry(alpha.value)).toBe(
      storage.values.get(savedGraphFilterStorageKey('workspace')),
    );
  });

  it('rejects duplicate names case-insensitively and deletes only definitions', () => {
    const registry = {
      schemaVersion: 1 as const,
      workspaceId: 'workspace',
      filters: [{ name: 'Sections', query: 'kind:section' }],
    };
    expect(addSavedGraphFilter(registry, ' sections ', 'documents')).toEqual({
      ok: false,
      message: 'A saved filter named "sections" already exists.',
    });
    expect(deleteSavedGraphFilter(registry, 'Sections')).toEqual({
      ok: true,
      value: { ...registry, filters: [] },
    });
  });

  it('round-trips exact-path queries without changing schema v1', () => {
    const storage = memoryStorage();
    const added = addSavedGraphFilter(
      {
        schemaVersion: 1,
        workspaceId: 'workspace',
        filters: [],
      },
      'Exact file',
      'path=Notes/Foo.md',
    );
    expect(added).toEqual({
      ok: true,
      value: {
        schemaVersion: 1,
        workspaceId: 'workspace',
        filters: [{ name: 'Exact file', query: 'path="Notes/Foo.md"' }],
      },
    });
    if (!added.ok) return;
    expect(saveSavedGraphFilterRegistry(storage, added.value)).toEqual({
      ok: true,
    });
    expect(loadSavedGraphFilters(storage, 'workspace')).toEqual({
      status: 'loaded',
      value: added.value,
    });
  });

  it('leaves corrupt values untouched and reports read/write failures', () => {
    const storage = memoryStorage();
    const key = savedGraphFilterStorageKey('workspace');
    storage.values.set(key, '{broken');
    expect(loadSavedGraphFilters(storage, 'workspace')).toMatchObject({
      status: 'error',
    });
    expect(storage.values.get(key)).toBe('{broken');
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadSavedGraphFilters(failing, 'workspace')).toMatchObject({
      status: 'error',
    });
    expect(
      saveSavedGraphFilterRegistry(failing, {
        schemaVersion: 1,
        workspaceId: 'workspace',
        filters: [],
      }),
    ).toMatchObject({ ok: false });
  });

  it('strictly validates workspace identity, fields, sorting, names, and queries', () => {
    expect(
      validateSavedGraphFilterRegistry(
        {
          schemaVersion: 1,
          workspaceId: 'other',
          filters: [{ name: 'Bad', query: 'sections documents' }],
          extra: true,
        },
        'workspace',
      ).valid,
    ).toBe(false);
    expect(
      validateSavedGraphFilterRegistry({
        schemaVersion: 1,
        workspaceId: 'workspace',
        filters: [
          { name: 'z', query: 'kind:section' },
          { name: 'A', query: 'kind:document' },
        ],
      }).valid,
    ).toBe(false);
  });
});
