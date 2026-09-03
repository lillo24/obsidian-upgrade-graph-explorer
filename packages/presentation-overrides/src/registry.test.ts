import { describe, expect, it, vi } from 'vitest';

import {
  createEmptyPresentationOverrideRegistry,
  reconcilePresentationOverrides,
  serializePresentationOverrideRegistry,
  setEntitySizeScale,
  validatePresentationOverrideRegistry,
} from './registry';

const empty = () => createEmptyPresentationOverrideRegistry('workspace');
const entry = { entityId: 'document', sizeScale: 1.5 };

describe('presentation override v1 registry', () => {
  it('resolves a sparse registry without scanning canonical entities', () => {
    const canonical = new Map(
      Array.from({ length: 10_000 }, (_, i) => [
        `file-${i}`,
        { kind: 'document' as const },
      ]),
    );
    const get = vi.spyOn(canonical, 'get');
    const iteration = vi.spyOn(canonical, Symbol.iterator);
    const registry = setEntitySizeScale(empty(), 'file-9999', 2);
    expect(reconcilePresentationOverrides(registry, canonical).size).toBe(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(iteration).not.toHaveBeenCalled();
  });
  it('roundtrips empty, one, and multiple entries with deterministic ordering', () => {
    for (const entries of [
      [],
      [entry],
      [entry, { entityId: 'a', sizeScale: 0.5 }],
    ]) {
      const forward = { ...empty(), entities: entries };
      const backward = { ...empty(), entities: [...entries].reverse() };
      const serialized = serializePresentationOverrideRegistry(forward);
      expect(serializePresentationOverrideRegistry(backward)).toBe(serialized);
      const restored = validatePresentationOverrideRegistry(
        JSON.parse(serialized),
        'workspace',
      );
      expect(restored.ok).toBe(true);
      if (restored.ok)
        expect(serializePresentationOverrideRegistry(restored.value)).toBe(
          serialized,
        );
    }
  });

  it.each([
    null,
    [],
    {},
    { ...empty(), schemaVersion: 2 },
    { ...empty(), workspaceId: '' },
    { ...empty(), entities: {} },
    { ...empty(), hidden: true },
    { ...empty(), entities: [null] },
    { ...empty(), entities: [entry, entry] },
    { ...empty(), entities: [{ ...entry, entityId: '' }] },
    { ...empty(), entities: [{ entityId: 'document' }] },
    ...['path', 'title', 'x', 'hidden', 'color'].map((field) => ({
      ...empty(),
      entities: [{ ...entry, [field]: 'forbidden' }],
    })),
    ...[0.49, 2.51, NaN, Infinity, -Infinity, '1', null, undefined].map(
      (sizeScale) => ({ ...empty(), entities: [{ ...entry, sizeScale }] }),
    ),
  ])('rejects incompatible or unsafe input %#', (candidate) => {
    expect(validatePresentationOverrideRegistry(candidate).ok).toBe(false);
  });

  it('rejects workspace mismatch and invalid serialization/mutations loudly', () => {
    expect(
      validatePresentationOverrideRegistry(empty(), 'other'),
    ).toMatchObject({ ok: false });
    expect(() => createEmptyPresentationOverrideRegistry('')).toThrow(
      'workspace ID',
    );
    expect(() => setEntitySizeScale(empty(), '', undefined)).toThrow(
      'entity ID',
    );
    expect(() => setEntitySizeScale(empty(), 'a', NaN)).toThrow('finite size');
    expect(() =>
      serializePresentationOverrideRegistry({
        ...empty(),
        schemaVersion: 2 as 1,
      }),
    ).toThrow('schema');
  });

  it('distinguishes Auto from custom 1× and leaves other entries untouched', () => {
    const first = setEntitySizeScale(empty(), 'a', 2.5);
    const second = setEntitySizeScale(first, 'b', 1);
    expect(second.entities).toEqual([
      { entityId: 'a', sizeScale: 2.5 },
      { entityId: 'b', sizeScale: 1 },
    ]);
    expect(setEntitySizeScale(second, 'a', undefined).entities).toEqual([
      { entityId: 'b', sizeScale: 1 },
    ]);
    expect(first.entities).toEqual([{ entityId: 'a', sizeScale: 2.5 }]);
  });

  it('reconciles by canonical identity only; stale and non-File entries stay inactive', () => {
    const registry = {
      ...empty(),
      entities: ['file', 'heading', 'block', 'gone'].map((entityId) => ({
        entityId,
        sizeScale: 2,
      })),
    };
    const entities = new Map([
      ['file', { kind: 'document' as const }],
      ['heading', { kind: 'section' as const }],
      ['block', { kind: 'block' as const }],
      ['replacement', { kind: 'document' as const }],
    ]);
    expect([...reconcilePresentationOverrides(registry, entities)]).toEqual([
      ['file', { sizeScale: 2 }],
    ]);
    expect(registry.entities).toHaveLength(4);
    entities.delete('file');
    expect(reconcilePresentationOverrides(registry, entities).size).toBe(0);
    entities.set('file', { kind: 'document' });
    expect(
      reconcilePresentationOverrides(registry, entities).get('file'),
    ).toEqual({ sizeScale: 2 });
  });
});
