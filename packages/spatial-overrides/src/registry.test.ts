import { describe, expect, it } from 'vitest';

import {
  clearFolderClusterAnchors,
  clearFolderSpatialRules,
  createEmptySpatialOverrideRegistry,
  folderClusterAnchorMap,
  removeFolderClusterAnchor,
  removeFolderSpatialRule,
  serializeSpatialOverrideRegistry,
  setFolderClusterAnchor,
  setFolderPullStrength,
  setFolderSpatialBehavior,
  setFolderSpatialRule,
  setFolderSpatialScope,
  setFolderSpatialTarget,
  validateSpatialOverrideRegistry,
} from './registry';

const empty = () => createEmptySpatialOverrideRegistry('workspace');
const pullRule = {
  folderKey: 'Theory',
  behavior: 'pull',
  scope: {
    kind: 'subtree',
    includeRootFiles: true,
    excludedSubtrees: ['Theory/Archive'],
  },
  anchor: { x: 1, y: -0.5 },
  strength: 75,
} as const;

describe('spatial override schema v2', () => {
  it('creates an immutable empty registry', () => {
    const registry = empty();
    expect(registry).toEqual({
      schemaVersion: 2,
      workspaceId: 'workspace',
      allNetwork: { folderRules: [] },
    });
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.allNetwork.folderRules)).toBe(true);
  });

  it('migrates schema-v1 exact and root anchors in memory', () => {
    const migrated = validateSpatialOverrideRegistry({
      schemaVersion: 1,
      workspaceId: 'workspace',
      allNetwork: {
        folderAnchors: [
          { folderKey: 'Theory', anchor: { x: 1, y: 0 } },
          { folderKey: '.', anchor: { x: -1, y: 0.5 } },
        ],
      },
    });
    expect(migrated).toMatchObject({ ok: true });
    if (!migrated.ok) return;
    expect(migrated.value).toEqual({
      schemaVersion: 2,
      workspaceId: 'workspace',
      allNetwork: {
        folderRules: [
          {
            folderKey: '.',
            behavior: 'place',
            scope: { kind: 'exact' },
            anchor: { x: -1, y: 0.5 },
          },
          {
            folderKey: 'Theory',
            behavior: 'place',
            scope: { kind: 'exact' },
            anchor: { x: 1, y: 0 },
          },
        ],
      },
    });
    expect(
      JSON.parse(serializeSpatialOverrideRegistry(migrated.value)),
    ).toMatchObject({
      schemaVersion: 2,
      allNetwork: { folderRules: expect.any(Array) },
    });
  });

  it('validates pull/place strength contracts and unknown fields', () => {
    for (const strength of [undefined, -1, 1.5, 101, '50']) {
      expect(
        validateSpatialOverrideRegistry({
          schemaVersion: 2,
          workspaceId: 'workspace',
          allNetwork: {
            folderRules: [{ ...pullRule, strength }],
          },
        }).ok,
      ).toBe(false);
    }
    expect(
      validateSpatialOverrideRegistry({
        schemaVersion: 2,
        workspaceId: 'workspace',
        allNetwork: {
          folderRules: [
            {
              folderKey: 'Theory',
              behavior: 'place',
              scope: { kind: 'exact' },
              anchor: { x: 0, y: 0 },
              strength: 10,
            },
          ],
        },
      }).ok,
    ).toBe(false);
  });

  it('serializes deterministically and survives JSON/structured clone', () => {
    const a = setFolderSpatialRule(
      setFolderClusterAnchor(empty(), 'z', { x: 0, y: 1 }),
      pullRule,
    );
    const b = {
      ...a,
      allNetwork: { folderRules: [...a.allNetwork.folderRules].reverse() },
    };
    const serialized = serializeSpatialOverrideRegistry(a);
    expect(serializeSpatialOverrideRegistry(b)).toBe(serialized);
    const clone = (
      globalThis as unknown as { structuredClone<T>(value: T): T }
    ).structuredClone(JSON.parse(serialized));
    expect(clone).toEqual(JSON.parse(serialized));
  });

  it('provides immutable general mutations', () => {
    const original = setFolderSpatialRule(empty(), pullRule);
    const scoped = setFolderSpatialScope(original, 'Theory', { kind: 'exact' });
    const targeted = setFolderSpatialTarget(scoped, 'Theory', { x: -1, y: 1 });
    const strengthened = setFolderPullStrength(targeted, 'Theory', 25);
    const placed = setFolderSpatialBehavior(strengthened, 'Theory', 'place');
    expect(original.allNetwork.folderRules[0]).toEqual(pullRule);
    expect(strengthened.allNetwork.folderRules[0]).toMatchObject({
      strength: 25,
      anchor: { x: -1, y: 1 },
      scope: { kind: 'exact' },
    });
    expect(placed.allNetwork.folderRules[0]).not.toHaveProperty('strength');
    expect(removeFolderSpatialRule(placed, 'Theory')).toEqual(empty());
    expect(clearFolderSpatialRules(original)).toEqual(empty());
    expect(() => setFolderSpatialBehavior(original, 'Theory', 'pull')).toThrow(
      'explicit strength',
    );
  });

  it('keeps the compatibility API fixed/exact only', () => {
    const withPull = setFolderSpatialRule(empty(), pullRule);
    expect(folderClusterAnchorMap(withPull).size).toBe(0);
    expect(removeFolderClusterAnchor(withPull, 'Theory')).toEqual(withPull);
    expect(clearFolderClusterAnchors(withPull)).toEqual(withPull);

    const placed = setFolderClusterAnchor(withPull, 'Theory', { x: 0.5, y: 0 });
    expect(placed.allNetwork.folderRules).toEqual([
      {
        folderKey: 'Theory',
        behavior: 'place',
        scope: { kind: 'exact' },
        anchor: { x: 0.5, y: 0 },
      },
    ]);
    expect([...folderClusterAnchorMap(placed)]).toEqual([
      ['Theory', { x: 0.5, y: 0 }],
    ]);
    expect(removeFolderClusterAnchor(placed, 'Theory')).toEqual(empty());
  });

  it.each([
    null,
    [],
    {},
    { ...empty(), schemaVersion: 3 },
    { ...empty(), workspaceId: '' },
    { ...empty(), extra: true },
    { ...empty(), allNetwork: {} },
    { ...empty(), allNetwork: { folderRules: [], extra: true } },
    { ...empty(), allNetwork: { folderRules: [pullRule, pullRule] } },
    {
      ...empty(),
      allNetwork: { folderRules: [{ ...pullRule, extra: true }] },
    },
  ])('rejects incompatible input %#', (candidate) => {
    expect(validateSpatialOverrideRegistry(candidate).ok).toBe(false);
  });

  it('rejects workspace mismatch and unsafe mutations loudly', () => {
    expect(validateSpatialOverrideRegistry(empty(), 'other').ok).toBe(false);
    expect(() => createEmptySpatialOverrideRegistry('')).toThrow(
      'workspace ID',
    );
    expect(() =>
      setFolderClusterAnchor(empty(), '/absolute', { x: 0, y: 0 }),
    ).toThrow('folder key');
  });
});
