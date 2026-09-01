import {
  MAX_VISUAL_GROUPS,
  type VisualGroupDefinition,
} from '@icarus-graph-explorer/visual-groups';
import { describe, expect, it } from 'vitest';

import type { StorageLike } from './storage';
import {
  addVisualGroup,
  clearVisualGroupRegistry,
  createEmptyVisualGroupRegistry,
  deleteVisualGroup,
  loadVisualGroupRegistry,
  moveVisualGroupDown,
  moveVisualGroupUp,
  saveVisualGroupRegistry,
  serializeVisualGroupRegistry,
  setVisualGroupEnabled,
  updateVisualGroup,
  validateVisualGroupRegistry,
  visualGroupStorageKey,
  type VisualGroupRegistry,
} from './visual-groups';

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

const research: VisualGroupDefinition = {
  name: 'Research',
  query: 'path:"Research"',
  color: 'teal',
  enabled: true,
};
const drafts: VisualGroupDefinition = {
  name: 'Drafts',
  query: 'title:"Draft"',
  color: 'amber',
  enabled: true,
};

function registry(
  groups: readonly VisualGroupDefinition[] = [research, drafts],
): VisualGroupRegistry {
  return { schemaVersion: 1, workspaceId: 'workspace', groups };
}

function successful(result: ReturnType<typeof addVisualGroup>) {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe('Visual Group registry persistence', () => {
  it('uses an encoded stable-workspace key and loads an empty registry', () => {
    expect(visualGroupStorageKey('stable/workspace name')).toBe(
      'icarus-graph-explorer:visual-groups:stable%2Fworkspace%20name',
    );
    expect(loadVisualGroupRegistry(memoryStorage(), 'workspace')).toEqual({
      status: 'empty',
      value: createEmptyVisualGroupRegistry('workspace'),
    });
  });

  it('round-trips deterministic serialization with exact priority order', () => {
    const storage = memoryStorage();
    const value = registry([drafts, research]);
    expect(saveVisualGroupRegistry(storage, value)).toEqual({ ok: true });
    expect(loadVisualGroupRegistry(storage, 'workspace')).toEqual({
      status: 'loaded',
      value,
    });
    expect(serializeVisualGroupRegistry(value)).toBe(
      '{"schemaVersion":1,"workspaceId":"workspace","groups":[{"name":"Drafts","query":"title:\\"Draft\\"","color":"amber","enabled":true},{"name":"Research","query":"path:\\"Research\\"","color":"teal","enabled":true}]}',
    );
  });

  it('isolates workspace IDs and rejects schema, field, and corrupt JSON failures', () => {
    const storage = memoryStorage();
    const key = visualGroupStorageKey('workspace');
    storage.values.set(key, '{broken');
    expect(loadVisualGroupRegistry(storage, 'workspace')).toMatchObject({
      status: 'error',
    });
    expect(storage.values.get(key)).toBe('{broken');
    expect(
      validateVisualGroupRegistry({ ...registry(), schemaVersion: 2 }),
    ).toMatchObject({
      valid: false,
    });
    expect(
      validateVisualGroupRegistry({ ...registry(), extra: true }, 'workspace'),
    ).toMatchObject({ valid: false });
    expect(validateVisualGroupRegistry(registry(), 'other')).toMatchObject({
      valid: false,
    });
  });

  it.each([
    [[research, { ...research, name: 'research' }], 'duplicated'],
    [[{ ...research, query: 'documents' }], 'non-canonical'],
    [[{ ...research, query: 'documents sections' }], 'explicit AND'],
    [[{ ...research, color: 'pink' }], 'Unsupported Visual Group color'],
  ])('rejects invalid persisted groups %#', (groups, message) => {
    const result = validateVisualGroupRegistry({
      schemaVersion: 1,
      workspaceId: 'workspace',
      groups,
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.message).toContain(message);
  });

  it('enforces the bounded group count', () => {
    expect(
      validateVisualGroupRegistry(
        registry(
          Array.from({ length: MAX_VISUAL_GROUPS + 1 }, (_, index) => ({
            ...research,
            name: `Group ${index}`,
          })),
        ),
      ),
    ).toMatchObject({ valid: false });
  });

  it('adds, canonicalizes, updates, deletes, and enables definitions', () => {
    const empty = createEmptyVisualGroupRegistry('workspace');
    const added = successful(
      addVisualGroup(empty, {
        name: '  Research ',
        query: 'documents or path:Research',
        color: 'blue',
        enabled: true,
      }),
    );
    expect(added.groups).toEqual([
      {
        name: 'Research',
        query: 'kind:document OR path:"Research"',
        color: 'blue',
        enabled: true,
      },
    ]);
    const updated = updateVisualGroup(added, 'research', {
      ...drafts,
      name: 'Draft work',
    });
    expect(updated).toMatchObject({
      ok: true,
      value: { groups: [{ name: 'Draft work' }] },
    });
    if (!updated.ok) return;
    const disabled = setVisualGroupEnabled(updated.value, 'DRAFT WORK', false);
    expect(disabled).toMatchObject({
      ok: true,
      value: { groups: [{ enabled: false }] },
    });
    if (!disabled.ok) return;
    expect(deleteVisualGroup(disabled.value, 'draft work')).toEqual({
      ok: true,
      value: { ...disabled.value, groups: [] },
    });
  });

  it('moves priority up/down exactly without sorting', () => {
    const initial = registry([research, drafts]);
    const up = moveVisualGroupUp(initial, 'Drafts');
    expect(up).toMatchObject({
      ok: true,
      value: { groups: [drafts, research] },
    });
    if (!up.ok) return;
    expect(moveVisualGroupDown(up.value, 'Drafts')).toEqual({
      ok: true,
      value: initial,
    });
    expect(moveVisualGroupUp(initial, 'Research')).toMatchObject({ ok: false });
  });

  it('reports read/write failures without overwriting corrupt values', () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadVisualGroupRegistry(failing, 'workspace')).toMatchObject({
      status: 'error',
    });
    expect(saveVisualGroupRegistry(failing, registry())).toMatchObject({
      ok: false,
    });
    expect(clearVisualGroupRegistry(failing, 'workspace')).toEqual({
      ok: true,
    });
  });

  it('clears only the current workspace Visual Group key', () => {
    const storage = memoryStorage();
    const current = visualGroupStorageKey('workspace');
    const other = visualGroupStorageKey('other');
    storage.values.set(current, serializeVisualGroupRegistry(registry()));
    storage.values.set(other, 'other-groups');
    storage.values.set('icarus-graph-explorer:view-state:workspace', 'view');
    storage.values.set(
      'icarus-graph-explorer:saved-filters:workspace',
      'filters',
    );

    expect(clearVisualGroupRegistry(storage, 'workspace')).toEqual({
      ok: true,
    });
    expect(storage.values.has(current)).toBe(false);
    expect(storage.values.get(other)).toBe('other-groups');
    expect(
      storage.values.get('icarus-graph-explorer:view-state:workspace'),
    ).toBe('view');
    expect(
      storage.values.get('icarus-graph-explorer:saved-filters:workspace'),
    ).toBe('filters');
  });
});
