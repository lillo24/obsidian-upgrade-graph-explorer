import { describe, expect, it } from 'vitest';

import {
  clearFolderClusterAnchors,
  createEmptySpatialOverrideRegistry,
  folderClusterAnchorMap,
  removeFolderClusterAnchor,
  serializeSpatialOverrideRegistry,
  setFolderClusterAnchor,
  validateSpatialOverrideRegistry,
} from './registry';

const empty = () => createEmptySpatialOverrideRegistry('workspace');

describe('spatial override schema v1', () => {
  it('creates an immutable empty registry', () => {
    const registry = empty();
    expect(registry).toEqual({
      schemaVersion: 1,
      workspaceId: 'workspace',
      allNetwork: { folderAnchors: [] },
    });
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.allNetwork)).toBe(true);
    expect(Object.isFrozen(registry.allNetwork.folderAnchors)).toBe(true);
  });

  it('sets, replaces, removes, and clears anchors without mutating inputs', () => {
    const original = empty();
    const first = setFolderClusterAnchor(original, 'Theory', {
      x: 0.5,
      y: -0.25,
    });
    const second = setFolderClusterAnchor(first, 'Theory', { x: 1, y: 2 });
    const root = setFolderClusterAnchor(second, '.', { x: -1, y: 0 });

    expect(original.allNetwork.folderAnchors).toEqual([]);
    expect(first.allNetwork.folderAnchors).toEqual([
      { folderKey: 'Theory', anchor: { x: 0.5, y: -0.25 } },
    ]);
    expect(second.allNetwork.folderAnchors).toEqual([
      { folderKey: 'Theory', anchor: { x: 1, y: 2 } },
    ]);
    expect(
      root.allNetwork.folderAnchors.map((entry) => entry.folderKey),
    ).toEqual(['.', 'Theory']);
    expect(
      removeFolderClusterAnchor(root, 'Theory').allNetwork.folderAnchors,
    ).toEqual([{ folderKey: '.', anchor: { x: -1, y: 0 } }]);
    expect(clearFolderClusterAnchors(root)).toEqual(empty());
    expect(root.allNetwork.folderAnchors).toHaveLength(2);
  });

  it('serializes deterministically and round-trips through JSON and structured clone', () => {
    const forward = {
      ...empty(),
      allNetwork: {
        folderAnchors: [
          { folderKey: 'z', anchor: { x: 1, y: 1 } },
          { folderKey: '.', anchor: { x: -2, y: 2 } },
          { folderKey: 'a/nested', anchor: { x: 0, y: 0 } },
        ],
      },
    };
    const reverse = {
      ...forward,
      allNetwork: {
        folderAnchors: [...forward.allNetwork.folderAnchors].reverse(),
      },
    };
    const serialized = serializeSpatialOverrideRegistry(forward);
    expect(serializeSpatialOverrideRegistry(reverse)).toBe(serialized);
    const parsed = validateSpatialOverrideRegistry(
      JSON.parse(serialized),
      'workspace',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(serializeSpatialOverrideRegistry(parsed.value)).toBe(serialized);
    const clone = (
      globalThis as unknown as {
        structuredClone<T>(value: T): T;
      }
    ).structuredClone(parsed.value);
    expect(clone).toEqual(parsed.value);
    expect([...folderClusterAnchorMap(parsed.value)]).toEqual([
      ['.', { x: -2, y: 2 }],
      ['a/nested', { x: 0, y: 0 }],
      ['z', { x: 1, y: 1 }],
    ]);
  });

  it.each([
    null,
    [],
    {},
    { ...empty(), schemaVersion: 2 },
    { ...empty(), workspaceId: '' },
    { ...empty(), extra: true },
    { ...empty(), allNetwork: {} },
    { ...empty(), allNetwork: { folderAnchors: [], extra: true } },
    { ...empty(), allNetwork: { folderAnchors: {} } },
    { ...empty(), allNetwork: { folderAnchors: [null] } },
    {
      ...empty(),
      allNetwork: {
        folderAnchors: [
          { folderKey: 'same', anchor: { x: 0, y: 0 } },
          { folderKey: 'same', anchor: { x: 1, y: 1 } },
        ],
      },
    },
    ...['', '/a', 'a/', 'a\\b', 'C:/a', 'a//b', '..', 'a/../b', './a'].map(
      (folderKey) => ({
        ...empty(),
        allNetwork: {
          folderAnchors: [{ folderKey, anchor: { x: 0, y: 0 } }],
        },
      }),
    ),
    ...[NaN, Infinity, -Infinity, -2.01, 2.01, '1', null, undefined].map(
      (x) => ({
        ...empty(),
        allNetwork: {
          folderAnchors: [{ folderKey: 'a', anchor: { x, y: 0 } }],
        },
      }),
    ),
    {
      ...empty(),
      allNetwork: {
        folderAnchors: [{ folderKey: 'a', anchor: { x: 0, y: 0, z: 0 } }],
      },
    },
    {
      ...empty(),
      allNetwork: {
        folderAnchors: [
          { folderKey: 'a', anchor: { x: 0, y: 0 }, extra: true },
        ],
      },
    },
  ])('rejects incompatible, duplicate, or unsafe input %#', (candidate) => {
    expect(validateSpatialOverrideRegistry(candidate).ok).toBe(false);
  });

  it('rejects workspace mismatch and invalid pure mutations loudly', () => {
    expect(validateSpatialOverrideRegistry(empty(), 'other')).toMatchObject({
      ok: false,
    });
    expect(() => createEmptySpatialOverrideRegistry('')).toThrow(
      'workspace ID',
    );
    expect(() =>
      setFolderClusterAnchor(empty(), '/absolute', { x: 0, y: 0 }),
    ).toThrow('folder key');
    expect(() =>
      setFolderClusterAnchor(empty(), 'folder', { x: NaN, y: 0 }),
    ).toThrow('finite x/y');
    expect(() => removeFolderClusterAnchor(empty(), '../folder')).toThrow(
      'normalized workspace folder key',
    );
  });
});
