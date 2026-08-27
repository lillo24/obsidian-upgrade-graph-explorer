import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type KnowledgeSnapshot,
  type Reference,
} from '@icarus-graph-explorer/core';

import type { KnowledgeSnapshotDelta, SnapshotCollectionDelta } from './types';
import { validateKnowledgeSnapshotDelta } from './validation';

interface Identified {
  readonly id: string;
}

function exactEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyCollection<T extends Identified>(
  previous: readonly T[],
  delta: SnapshotCollectionDelta<T>,
  label: string,
): readonly T[] {
  const previousById = new Map(
    previous.map((record, index) => [record.id, { record, index }]),
  );
  const removedOrUpdated = new Set<string>();

  for (const item of delta.removed) {
    const current = previousById.get(item.before.id);
    if (
      current === undefined ||
      current.index !== item.beforeIndex ||
      !exactEqual(current.record, item.before)
    ) {
      throw new Error(
        `Cannot apply ${label} removal for ${JSON.stringify(item.before.id)}: the base record or index is stale.`,
      );
    }
    removedOrUpdated.add(item.before.id);
  }
  for (const item of delta.updated) {
    const current = previousById.get(item.before.id);
    if (
      current === undefined ||
      current.index !== item.beforeIndex ||
      !exactEqual(current.record, item.before)
    ) {
      throw new Error(
        `Cannot apply ${label} update for ${JSON.stringify(item.before.id)}: the base record or index is stale.`,
      );
    }
    removedOrUpdated.add(item.before.id);
  }
  for (const { after } of delta.added) {
    if (previousById.has(after.id)) {
      throw new Error(
        `Cannot add ${label} record ${JSON.stringify(after.id)} because that ID already exists.`,
      );
    }
  }

  const nextLength =
    previous.length - delta.removed.length + delta.added.length;
  const staged: Array<T | undefined> = Array.from({ length: nextLength });
  for (const { after, afterIndex } of [...delta.added, ...delta.updated]) {
    if (afterIndex >= nextLength) {
      throw new Error(
        `Cannot apply ${label} record ${JSON.stringify(after.id)} at out-of-range index ${afterIndex}.`,
      );
    }
    if (staged[afterIndex] !== undefined) {
      throw new Error(
        `Cannot apply ${label} delta because after-index ${afterIndex} is occupied more than once.`,
      );
    }
    staged[afterIndex] = after;
  }
  const unchanged = previous.filter(({ id }) => !removedOrUpdated.has(id));
  let unchangedIndex = 0;
  for (let index = 0; index < staged.length; index += 1) {
    if (staged[index] !== undefined) continue;
    const record = unchanged[unchangedIndex];
    if (record === undefined) {
      throw new Error(
        `Cannot apply ${label} delta because its indexes leave an unfillable position.`,
      );
    }
    staged[index] = record;
    unchangedIndex += 1;
  }
  if (unchangedIndex !== unchanged.length) {
    throw new Error(
      `Cannot apply ${label} delta because its indexes leave unused base records.`,
    );
  }
  const records = staged as T[];
  if (delta.afterOrder === undefined) return records;
  if (delta.afterOrder.length !== records.length) {
    throw new Error(
      `Cannot apply ${label} delta because afterOrder has the wrong length.`,
    );
  }
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered = delta.afterOrder.map((id) => {
    const record = byId.get(id);
    if (record === undefined) {
      throw new Error(
        `Cannot apply ${label} delta because afterOrder contains unknown ID ${JSON.stringify(id)}.`,
      );
    }
    return record;
  });
  if (new Set(delta.afterOrder).size !== records.length) {
    throw new Error(
      `Cannot apply ${label} delta because afterOrder does not contain every resulting ID exactly once.`,
    );
  }
  return ordered;
}

/** Apply a validated exact delta, rejecting stale bases and invalid results. */
export function applyKnowledgeSnapshotDelta(
  previousValue: KnowledgeSnapshot,
  deltaValue: KnowledgeSnapshotDelta,
): KnowledgeSnapshot {
  const previousValidation = validateKnowledgeSnapshot(previousValue);
  if (!previousValidation.valid) {
    const first = previousValidation.issues[0];
    throw new Error(
      `Cannot apply a delta to an invalid snapshot${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
    );
  }
  const deltaValidation = validateKnowledgeSnapshotDelta(deltaValue);
  if (!deltaValidation.valid) {
    const first = deltaValidation.issues[0];
    throw new Error(
      `Cannot apply an invalid snapshot delta${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
    );
  }
  const previous = previousValidation.value;
  const delta = deltaValidation.value;
  if (previous.workspace.id !== delta.workspaceId) {
    throw new Error(
      `Cannot apply snapshot delta for workspace ${JSON.stringify(delta.workspaceId)} to ${JSON.stringify(previous.workspace.id)}.`,
    );
  }
  const candidate: KnowledgeSnapshot = {
    schemaVersion: previous.schemaVersion,
    workspace: previous.workspace,
    entities: applyCollection<AddressableEntity>(
      previous.entities,
      delta.entities,
      'entity',
    ),
    references: applyCollection<Reference>(
      previous.references,
      delta.references,
      'reference',
    ),
  };
  const validation = validateKnowledgeSnapshot(candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Applied snapshot delta produced invalid canonical truth${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
    );
  }
  return validation.value;
}
