import type {
  AddressableEntity,
  KnowledgeSnapshot,
  Reference,
  SourceSpan,
} from '@icarus-graph-explorer/core';
import { describe, expect, it } from 'vitest';

import {
  applyKnowledgeSnapshotDelta,
  diffKnowledgeSnapshots,
  validateKnowledgeSnapshotDelta,
  type KnowledgeSnapshotDelta,
} from './index';

function span(start: number, end = start + 1): SourceSpan {
  return {
    start: { line: start + 1, column: 1, offset: start },
    end: { line: end + 1, column: 1, offset: end },
  };
}

const DOCUMENT_A: AddressableEntity = {
  id: 'stable-document-a',
  kind: 'document',
  source: { path: 'A.md', span: span(0, 100) },
};
const SECTION_A: AddressableEntity = {
  id: 'stable-section-a',
  kind: 'section',
  parentId: DOCUMENT_A.id,
  title: 'Section A',
  level: 1,
  source: { path: 'A.md', span: span(10, 100) },
};
const DOCUMENT_B: AddressableEntity = {
  id: 'stable-document-b',
  kind: 'document',
  source: { path: 'B.md', span: span(0, 50) },
};
const REFERENCE_A: Reference = {
  id: 'stable-reference-a',
  kind: 'link',
  sourceEntityId: SECTION_A.id,
  rawTarget: 'Missing',
  sourceSpan: span(20, 29),
  resolution: { status: 'unresolved', reason: 'Target was not found.' },
};

function snapshot(
  entities: readonly AddressableEntity[] = [DOCUMENT_A, DOCUMENT_B, SECTION_A],
  references: readonly Reference[] = [REFERENCE_A],
  workspaceId = 'workspace-delta',
): KnowledgeSnapshot {
  return {
    schemaVersion: 1,
    workspace: { id: workspaceId },
    entities,
    references,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectExactRoundTrip(
  previous: KnowledgeSnapshot,
  next: KnowledgeSnapshot,
): KnowledgeSnapshotDelta {
  const delta = diffKnowledgeSnapshots(previous, next);
  expect(applyKnowledgeSnapshotDelta(previous, delta)).toEqual(next);
  return delta;
}

describe('knowledge snapshot delta', () => {
  it('creates a valid empty delta for identical snapshots', () => {
    const previous = snapshot();
    const delta = expectExactRoundTrip(previous, previous);

    expect(delta.entities).toEqual({ added: [], removed: [], updated: [] });
    expect(delta.references).toEqual({ added: [], removed: [], updated: [] });
    expect(validateKnowledgeSnapshotDelta(delta).valid).toBe(true);
  });

  it('adds entities and references at their exact indexes', () => {
    const addedDocument: AddressableEntity = {
      id: 'stable-document-c',
      kind: 'document',
      source: { path: 'C.md', span: span(0, 20) },
    };
    const addedReference: Reference = {
      id: 'stable-reference-c',
      kind: 'link',
      sourceEntityId: addedDocument.id,
      rawTarget: 'A',
      sourceSpan: span(2, 5),
      resolution: { status: 'resolved', targetEntityId: DOCUMENT_A.id },
    };
    const delta = expectExactRoundTrip(
      snapshot(),
      snapshot(
        [DOCUMENT_A, DOCUMENT_B, addedDocument, SECTION_A],
        [REFERENCE_A, addedReference],
      ),
    );

    expect(delta.entities.added).toEqual([
      { after: addedDocument, afterIndex: 2 },
    ]);
    expect(delta.references.added).toEqual([
      { after: addedReference, afterIndex: 1 },
    ]);
  });

  it('removes entities and references with exact before evidence', () => {
    const delta = expectExactRoundTrip(
      snapshot(),
      snapshot([DOCUMENT_A, SECTION_A], []),
    );

    expect(delta.entities.removed).toEqual([
      { before: DOCUMENT_B, beforeIndex: 1 },
    ]);
    expect(delta.references.removed).toEqual([
      { before: REFERENCE_A, beforeIndex: 0 },
    ]);
  });

  it('classifies source-span shifts with stable IDs as updates', () => {
    const shiftedSection: AddressableEntity = {
      ...SECTION_A,
      source: { ...SECTION_A.source, span: span(12, 100) },
    };
    const shiftedReference: Reference = {
      ...REFERENCE_A,
      sourceSpan: span(22, 31),
    };
    const delta = expectExactRoundTrip(
      snapshot(),
      snapshot([DOCUMENT_A, DOCUMENT_B, shiftedSection], [shiftedReference]),
    );

    expect(delta.entities.updated[0]).toMatchObject({
      before: SECTION_A,
      after: shiftedSection,
    });
    expect(delta.references.updated[0]).toMatchObject({
      before: REFERENCE_A,
      after: shiftedReference,
    });
  });

  it('reconstructs a stable path move and resulting array-order change', () => {
    const movedDocument: AddressableEntity = {
      ...DOCUMENT_B,
      source: { ...DOCUMENT_B.source, path: '0/B.md' },
    };
    const next = snapshot([movedDocument, DOCUMENT_A, SECTION_A]);
    const delta = expectExactRoundTrip(snapshot(), next);

    expect(delta.entities.updated).toEqual([
      {
        before: DOCUMENT_B,
        beforeIndex: 1,
        after: movedDocument,
        afterIndex: 0,
      },
    ]);
  });

  it('represents unresolved-to-resolved changes as reference updates', () => {
    const resolved: Reference = {
      ...REFERENCE_A,
      resolution: { status: 'resolved', targetEntityId: DOCUMENT_B.id },
    };
    const delta = expectExactRoundTrip(
      snapshot(),
      snapshot(undefined, [resolved]),
    );

    expect(delta.references.updated).toHaveLength(1);
    expect(delta.references.added).toHaveLength(0);
    expect(delta.references.removed).toHaveLength(0);
  });

  it('represents ambiguity candidate changes as updates', () => {
    const ambiguous: Reference = {
      ...REFERENCE_A,
      resolution: {
        status: 'ambiguous',
        candidateEntityIds: [DOCUMENT_A.id, DOCUMENT_B.id],
        reason: 'Two candidates matched.',
      },
    };
    const nextAmbiguous: Reference = {
      ...ambiguous,
      resolution: {
        status: 'ambiguous',
        candidateEntityIds: [DOCUMENT_B.id, SECTION_A.id],
        reason: 'Two candidates matched.',
      },
    };
    const delta = expectExactRoundTrip(
      snapshot(undefined, [ambiguous]),
      snapshot(undefined, [nextAmbiguous]),
    );

    expect(delta.references.updated).toHaveLength(1);
  });

  it('reconstructs multiple simultaneous adds, removals, and updates', () => {
    const movedA: AddressableEntity = {
      ...DOCUMENT_A,
      source: { path: 'Moved/A.md', span: span(0, 110) },
    };
    const movedSection: AddressableEntity = {
      ...SECTION_A,
      title: 'Renamed A',
      source: { path: 'Moved/A.md', span: span(12, 110) },
    };
    const newDocument: AddressableEntity = {
      id: 'stable-document-new',
      kind: 'document',
      source: { path: 'New.md', span: span(0, 20) },
    };
    const next = snapshot([movedA, newDocument, movedSection], []);
    const delta = expectExactRoundTrip(snapshot(), next);

    expect(delta.entities.added).toHaveLength(1);
    expect(delta.entities.removed).toHaveLength(1);
    expect(delta.entities.updated).toHaveLength(2);
    expect(delta.references.removed).toHaveLength(1);
  });

  it('uses an explicit order only for otherwise-unrepresentable pure reorders', () => {
    const next = snapshot([DOCUMENT_B, DOCUMENT_A, SECTION_A]);
    const delta = expectExactRoundTrip(snapshot(), next);

    expect(delta.entities.added).toEqual([]);
    expect(delta.entities.removed).toEqual([]);
    expect(delta.entities.updated).toEqual([]);
    expect(delta.entities.afterOrder).toEqual([
      DOCUMENT_B.id,
      DOCUMENT_A.id,
      SECTION_A.id,
    ]);
  });

  it('rejects a stale base record or before index', () => {
    const nextReference: Reference = {
      ...REFERENCE_A,
      rawTarget: 'Changed',
    };
    const delta = diffKnowledgeSnapshots(
      snapshot(),
      snapshot(undefined, [nextReference]),
    );
    const staleReference: Reference = {
      ...REFERENCE_A,
      sourceSpan: span(21, 30),
    };

    expect(() =>
      applyKnowledgeSnapshotDelta(snapshot(undefined, [staleReference]), delta),
    ).toThrow('base record or index is stale');
  });

  it('rejects a wrong workspace', () => {
    const delta = diffKnowledgeSnapshots(snapshot(), snapshot());

    expect(() =>
      applyKnowledgeSnapshotDelta(
        snapshot(undefined, undefined, 'other'),
        delta,
      ),
    ).toThrow('workspace');
    expect(() =>
      diffKnowledgeSnapshots(
        snapshot(),
        snapshot(undefined, undefined, 'other'),
      ),
    ).toThrow('different workspaces');
  });

  it('rejects malformed and duplicate changed records', () => {
    const delta = diffKnowledgeSnapshots(snapshot(), snapshot());
    const malformed = {
      ...delta,
      entities: {
        ...delta.entities,
        added: [
          { after: DOCUMENT_B, afterIndex: 0 },
          { after: DOCUMENT_B, afterIndex: 0 },
        ],
      },
    };
    const result = validateKnowledgeSnapshotDelta(malformed);

    expect(result.valid).toBe(false);
    expect(
      result.valid ? [] : result.issues.map(({ message }) => message),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('changed more than once'),
        'Index is duplicated.',
      ]),
    );
  });

  it('rejects out-of-range application indexes and ID conflicts', () => {
    const addedDocument: AddressableEntity = {
      id: 'stable-new',
      kind: 'document',
      source: { path: 'New.md', span: span(0, 1) },
    };
    const delta = diffKnowledgeSnapshots(
      snapshot(),
      snapshot([DOCUMENT_A, DOCUMENT_B, SECTION_A, addedDocument]),
    );
    const badIndex = {
      ...clone(delta),
      entities: {
        ...delta.entities,
        added: delta.entities.added.map((item, index) =>
          index === 0 ? { ...item, afterIndex: 99 } : item,
        ),
      },
    };
    expect(() => applyKnowledgeSnapshotDelta(snapshot(), badIndex)).toThrow(
      'out-of-range index',
    );

    const conflict = {
      ...clone(delta),
      entities: {
        ...delta.entities,
        added: delta.entities.added.map((item, index) =>
          index === 0
            ? { ...item, after: { ...item.after, id: DOCUMENT_A.id } }
            : item,
        ),
      },
    };
    expect(() => applyKnowledgeSnapshotDelta(snapshot(), conflict)).toThrow(
      'already exists',
    );
  });

  it('round-trips through JSON and produces deterministic deltas', () => {
    const resolved: Reference = {
      ...REFERENCE_A,
      resolution: { status: 'resolved', targetEntityId: DOCUMENT_B.id },
    };
    const first = diffKnowledgeSnapshots(
      snapshot(),
      snapshot(undefined, [resolved]),
    );
    const second = diffKnowledgeSnapshots(
      snapshot(),
      snapshot(undefined, [resolved]),
    );
    const validation = validateKnowledgeSnapshotDelta(
      JSON.parse(JSON.stringify(first)),
    );

    expect(first).toEqual(second);
    expect(validation).toEqual({ valid: true, value: first, issues: [] });
  });

  it('does not mutate either snapshot or a supplied delta', () => {
    const previous = snapshot();
    const next = snapshot(undefined, [
      { ...REFERENCE_A, rawTarget: 'Changed target' },
    ]);
    const previousBefore = JSON.stringify(previous);
    const nextBefore = JSON.stringify(next);
    const delta = diffKnowledgeSnapshots(previous, next);
    const deltaBefore = JSON.stringify(delta);

    applyKnowledgeSnapshotDelta(previous, delta);

    expect(JSON.stringify(previous)).toBe(previousBefore);
    expect(JSON.stringify(next)).toBe(nextBefore);
    expect(JSON.stringify(delta)).toBe(deltaBefore);
  });
});
