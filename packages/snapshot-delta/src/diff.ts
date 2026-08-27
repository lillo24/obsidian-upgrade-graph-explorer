import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type KnowledgeSnapshot,
  type Reference,
} from '@icarus-graph-explorer/core';

import {
  KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION,
  type KnowledgeSnapshotDelta,
  type SnapshotCollectionDelta,
} from './types';

interface Identified {
  readonly id: string;
}

function exactEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireSnapshot(
  value: KnowledgeSnapshot,
  label: string,
): KnowledgeSnapshot {
  const validation = validateKnowledgeSnapshot(value);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Cannot diff invalid ${label} snapshot${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
    );
  }
  return validation.value;
}

function inferredCollection<T extends Identified>(
  previous: readonly T[],
  nextLength: number,
  delta: SnapshotCollectionDelta<T>,
): readonly T[] | undefined {
  const changed = new Set([
    ...delta.removed.map(({ before }) => before.id),
    ...delta.updated.map(({ before }) => before.id),
  ]);
  const result: Array<T | undefined> = Array.from({ length: nextLength });
  for (const { after, afterIndex } of [...delta.added, ...delta.updated]) {
    if (afterIndex >= nextLength || result[afterIndex] !== undefined) {
      return undefined;
    }
    result[afterIndex] = after;
  }
  const unchanged = previous.filter(({ id }) => !changed.has(id));
  let unchangedIndex = 0;
  for (let index = 0; index < result.length; index += 1) {
    if (result[index] !== undefined) continue;
    const record = unchanged[unchangedIndex];
    if (record === undefined) return undefined;
    result[index] = record;
    unchangedIndex += 1;
  }
  return unchangedIndex === unchanged.length &&
    result.every((record) => record !== undefined)
    ? (result as T[])
    : undefined;
}

function diffCollection<T extends Identified>(
  previous: readonly T[],
  next: readonly T[],
): SnapshotCollectionDelta<T> {
  const previousById = new Map(
    previous.map((record, index) => [record.id, { record, index }]),
  );
  const nextById = new Map(
    next.map((record, index) => [record.id, { record, index }]),
  );
  const added = next.flatMap((after, afterIndex) =>
    previousById.has(after.id) ? [] : [{ after, afterIndex }],
  );
  const removed = previous.flatMap((before, beforeIndex) =>
    nextById.has(before.id) ? [] : [{ before, beforeIndex }],
  );
  const updated = previous.flatMap((before, beforeIndex) => {
    const nextRecord = nextById.get(before.id);
    return nextRecord === undefined || exactEqual(before, nextRecord.record)
      ? []
      : [
          {
            before,
            beforeIndex,
            after: nextRecord.record,
            afterIndex: nextRecord.index,
          },
        ];
  });
  const preliminary: SnapshotCollectionDelta<T> = {
    added,
    removed,
    updated,
  };
  const inferred = inferredCollection(previous, next.length, preliminary);
  return inferred !== undefined && exactEqual(inferred, next)
    ? preliminary
    : { ...preliminary, afterOrder: next.map(({ id }) => id) };
}

/** Derive an exact deterministic stable-ID delta between two valid snapshots. */
export function diffKnowledgeSnapshots(
  previousValue: KnowledgeSnapshot,
  nextValue: KnowledgeSnapshot,
): KnowledgeSnapshotDelta {
  const previous = requireSnapshot(previousValue, 'previous');
  const next = requireSnapshot(nextValue, 'next');
  if (previous.workspace.id !== next.workspace.id) {
    throw new Error(
      `Cannot diff snapshots from different workspaces: ${JSON.stringify(previous.workspace.id)} and ${JSON.stringify(next.workspace.id)}.`,
    );
  }
  return {
    schemaVersion: KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION,
    workspaceId: previous.workspace.id,
    entities: diffCollection<AddressableEntity>(
      previous.entities,
      next.entities,
    ),
    references: diffCollection<Reference>(previous.references, next.references),
  };
}
