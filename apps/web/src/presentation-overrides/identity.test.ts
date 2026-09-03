import { describe, expect, it } from 'vitest';
import type { AddressableEntity } from '@icarus-graph-explorer/core';
import {
  createEmptyPresentationOverrideRegistry,
  reconcilePresentationOverrides,
  serializePresentationOverrideRegistry,
  setEntitySizeScale,
} from '@icarus-graph-explorer/presentation-overrides';

const source = (path: string) => ({
  path,
  span: { start: { line: 1, column: 1 }, end: { line: 2, column: 1 } },
});

describe('presentation identity reconciliation', () => {
  it('survives path rename/move but never transfers a missing ID to a same-path replacement', () => {
    const original: AddressableEntity = {
      id: 'opaque-file',
      kind: 'document',
      source: source('old/Name.md'),
    };
    const renamed: AddressableEntity = {
      ...original,
      source: source('moved/Renamed.md'),
    };
    const replacement: AddressableEntity = { ...renamed, id: 'replacement-id' };
    const registry = setEntitySizeScale(
      createEmptyPresentationOverrideRegistry('opaque-workspace'),
      original.id,
      1.75,
    );
    const resolve = (entity: AddressableEntity) =>
      reconcilePresentationOverrides(registry, new Map([[entity.id, entity]]));
    expect(resolve(original).get(original.id)).toEqual({ sizeScale: 1.75 });
    expect(resolve(renamed).get(renamed.id)).toEqual({ sizeScale: 1.75 });
    expect(resolve(replacement).size).toBe(0);
    expect(registry.entities).toEqual([
      { entityId: original.id, sizeScale: 1.75 },
    ]);
    expect(serializePresentationOverrideRegistry(registry)).not.toMatch(
      /Name|Renamed|moved|old|path|source|title/,
    );
  });
});
