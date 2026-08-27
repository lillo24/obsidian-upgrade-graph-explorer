import { validateKnowledgeSnapshot } from '@icarus-graph-explorer/core';
import { describe, expect, it } from 'vitest';

import {
  createStableIdentityCatalog,
  identityFreeSnapshot,
  reconcileStableIdentity,
  validateStableIdentityCatalog,
} from './index';
import { buildSnapshot, entityId, type DocumentSpec } from './test-fixture';

const target: DocumentSpec = {
  key: 'target',
  path: 'Target.md',
  sections: [{ key: 'target-heading', title: 'Target', level: 1, offset: 10 }],
};

function reconcileRevision(
  revision: string,
  documents: readonly DocumentSpec[],
  previousCatalog?: ReturnType<typeof createStableIdentityCatalog>,
) {
  return reconcileStableIdentity({
    snapshot: buildSnapshot(revision, documents),
    ...(previousCatalog === undefined ? {} : { previousCatalog }),
  });
}

describe('stable identity reconciliation', () => {
  it('reuses every ID for an unchanged snapshot and is deterministic', () => {
    const documents: DocumentSpec[] = [
      {
        key: 'note',
        path: 'Note.md',
        sections: [{ key: 'topic', title: 'Topic', level: 1, offset: 10 }],
        blocks: [{ key: 'block', parentKey: 'topic', offset: 20 }],
        references: [
          {
            key: 'reference',
            sourceKey: 'topic',
            rawTarget: 'Target',
            offset: 15,
            targetKey: 'target',
          },
        ],
      },
      target,
    ];
    const first = reconcileRevision('one', documents);
    const second = reconcileRevision('two', documents, first.catalog);
    const repeated = reconcileRevision('two', documents, first.catalog);

    expect(second.snapshot).toEqual(first.snapshot);
    expect(second.catalog).toEqual(first.catalog);
    expect(repeated).toEqual(second);
    expect(second.summary.documents.reusedExact).toBe(2);
    expect(second.summary.sections.reusedExact).toBe(2);
    expect(second.summary.blocks.reusedExact).toBe(1);
    expect(second.summary.references.reusedExact).toBe(1);
    expect(second.summary.retiredFromPrevious).toEqual({
      entities: 0,
      references: 0,
    });
  });

  it('preserves ordinary offset/body edits and existing siblings around an inserted heading', () => {
    const first = reconcileRevision('base', [
      {
        key: 'note',
        path: 'Note.md',
        sections: [
          { key: 'alpha', title: 'Alpha', level: 1, offset: 10 },
          { key: 'beta', title: 'Beta', level: 1, offset: 30 },
        ],
        references: [
          {
            key: 'alpha-link',
            sourceKey: 'alpha',
            rawTarget: 'Target',
            offset: 15,
            targetKey: 'target',
          },
        ],
      },
      target,
    ]);
    const second = reconcileRevision(
      'edited',
      [
        {
          key: 'note',
          path: 'Note.md',
          sections: [
            { key: 'inserted', title: 'Inserted', level: 1, offset: 20 },
            { key: 'alpha', title: 'Alpha', level: 1, offset: 40 },
            { key: 'beta', title: 'Beta', level: 1, offset: 60 },
          ],
          references: [
            {
              key: 'alpha-link',
              sourceKey: 'alpha',
              rawTarget: 'Target',
              offset: 48,
              targetKey: 'target',
            },
          ],
        },
        target,
      ],
      first.catalog,
    );

    expect(entityId(second.snapshot, 'section', 'Note.md', 'Alpha')).toBe(
      entityId(first.snapshot, 'section', 'Note.md', 'Alpha'),
    );
    expect(entityId(second.snapshot, 'section', 'Note.md', 'Beta')).toBe(
      entityId(first.snapshot, 'section', 'Note.md', 'Beta'),
    );
    expect(second.snapshot.references[0]?.id).toBe(
      first.snapshot.references[0]?.id,
    );
    expect(second.summary.sections.allocatedNew).toBe(1);
  });

  it('preserves a uniquely structured document and descendants across a path rename', () => {
    const original: DocumentSpec = {
      key: 'note',
      path: 'Old/Note.md',
      sections: [{ key: 'topic', title: 'Topic', level: 1, offset: 10 }],
      references: [
        {
          key: 'link',
          sourceKey: 'topic',
          rawTarget: 'Target',
          offset: 15,
          targetKey: 'target',
        },
      ],
    };
    const first = reconcileRevision('base', [original, target]);
    const second = reconcileRevision(
      'rename',
      [{ ...original, path: 'Moved/Renamed.md' }, target],
      first.catalog,
    );

    expect(entityId(second.snapshot, 'document', 'Moved/Renamed.md')).toBe(
      entityId(first.snapshot, 'document', 'Old/Note.md'),
    );
    expect(
      entityId(second.snapshot, 'section', 'Moved/Renamed.md', 'Topic'),
    ).toBe(entityId(first.snapshot, 'section', 'Old/Note.md', 'Topic'));
  });

  it('refuses to pair structurally identical documents after ambiguous renames', () => {
    const make = (key: string, path: string): DocumentSpec => ({
      key,
      path,
      sections: [{ key: `${key}-topic`, title: 'Same', level: 1, offset: 10 }],
    });
    const first = reconcileRevision('base', [
      make('a', 'A.md'),
      make('b', 'B.md'),
    ]);
    const second = reconcileRevision(
      'rename',
      [make('c', 'C.md'), make('d', 'D.md')],
      first.catalog,
    );
    const oldIds = new Set(first.snapshot.entities.map(({ id }) => id));

    expect(second.snapshot.entities.every(({ id }) => !oldIds.has(id))).toBe(
      true,
    );
    expect(second.summary.documents.ambiguousNotReused).toBe(2);
    expect(
      second.diagnostics.filter(({ recordKind }) => recordKind === 'document'),
    ).toHaveLength(2);
  });

  it('preserves heading rename and cross-parent move only with unique strong context', () => {
    const base: DocumentSpec = {
      key: 'note',
      path: 'Note.md',
      sections: [
        { key: 'left', title: 'Left', level: 1, offset: 10 },
        { key: 'right', title: 'Right', level: 1, offset: 40 },
        {
          key: 'moving',
          title: 'Before',
          level: 2,
          offset: 20,
          parentKey: 'left',
        },
        {
          key: 'leaf',
          title: 'Weak leaf',
          level: 2,
          offset: 30,
          parentKey: 'left',
        },
      ],
      references: [
        {
          key: 'context',
          sourceKey: 'moving',
          rawTarget: 'Target',
          offset: 25,
          targetKey: 'target',
        },
      ],
    };
    const first = reconcileRevision('base', [base, target]);
    const second = reconcileRevision(
      'edit',
      [
        {
          ...base,
          sections: [
            { key: 'left', title: 'Left', level: 1, offset: 10 },
            { key: 'right', title: 'Right', level: 1, offset: 40 },
            {
              key: 'moving',
              title: 'After',
              level: 2,
              offset: 50,
              parentKey: 'right',
            },
            {
              key: 'leaf',
              title: 'Renamed weak leaf',
              level: 2,
              offset: 30,
              parentKey: 'left',
            },
          ],
        },
        target,
      ],
      first.catalog,
    );

    expect(entityId(second.snapshot, 'section', 'Note.md', 'After')).toBe(
      entityId(first.snapshot, 'section', 'Note.md', 'Before'),
    );
    expect(
      entityId(second.snapshot, 'section', 'Note.md', 'Renamed weak leaf'),
    ).not.toBe(entityId(first.snapshot, 'section', 'Note.md', 'Weak leaf'));
  });

  it('keeps duplicate headings distinct and refuses a shifted ambiguous reassignment', () => {
    const base: DocumentSpec = {
      key: 'note',
      path: 'Note.md',
      sections: [
        { key: 'first', title: 'Details', level: 1, offset: 10 },
        { key: 'second', title: 'Details', level: 1, offset: 20 },
      ],
    };
    const first = reconcileRevision('base', [base]);
    const unchanged = reconcileRevision('same', [base], first.catalog);
    const shifted = reconcileRevision(
      'shift',
      [
        {
          ...base,
          sections: [
            { key: 'inserted', title: 'Details', level: 1, offset: 10 },
            { key: 'first', title: 'Details', level: 1, offset: 20 },
            { key: 'second', title: 'Details', level: 1, offset: 30 },
          ],
        },
      ],
      first.catalog,
    );
    const previousSectionIds = new Set(
      first.snapshot.entities
        .filter(({ kind }) => kind === 'section')
        .map(({ id }) => id),
    );

    expect(new Set(unchanged.snapshot.entities.map(({ id }) => id)).size).toBe(
      unchanged.snapshot.entities.length,
    );
    expect(
      shifted.snapshot.entities
        .filter(({ kind }) => kind === 'section')
        .every(({ id }) => !previousSectionIds.has(id)),
    ).toBe(true);
    expect(shifted.summary.sections.ambiguousNotReused).toBe(3);
  });

  it('uses unique graph-visible context instead of old positions when duplicate headings reorder', () => {
    const base: DocumentSpec = {
      key: 'note',
      path: 'Note.md',
      sections: [
        { key: 'first', title: 'Details', level: 1, offset: 10 },
        { key: 'second', title: 'Details', level: 1, offset: 20 },
      ],
      references: [
        {
          key: 'first-context',
          sourceKey: 'first',
          rawTarget: 'First-context',
          offset: 11,
        },
        {
          key: 'second-context',
          sourceKey: 'second',
          rawTarget: 'Second-context',
          offset: 21,
        },
      ],
    };
    const first = reconcileRevision('base', [base]);
    const reordered = reconcileRevision(
      'reordered',
      [
        {
          ...base,
          sections: [
            { key: 'second', title: 'Details', level: 1, offset: 10 },
            { key: 'first', title: 'Details', level: 1, offset: 20 },
          ],
          references: [
            {
              key: 'second-context',
              sourceKey: 'second',
              rawTarget: 'Second-context',
              offset: 11,
            },
            {
              key: 'first-context',
              sourceKey: 'first',
              rawTarget: 'First-context',
              offset: 21,
            },
          ],
        },
      ],
      first.catalog,
    );

    expect(
      entityId(reordered.snapshot, 'section', 'Note.md', 'Details', 20),
    ).toBe(entityId(first.snapshot, 'section', 'Note.md', 'Details', 10));
    expect(
      entityId(reordered.snapshot, 'section', 'Note.md', 'Details', 10),
    ).toBe(entityId(first.snapshot, 'section', 'Note.md', 'Details', 20));
  });

  it('does not reuse a deleted identity for unrelated new content', () => {
    const first = reconcileRevision('base', [
      {
        key: 'note',
        path: 'Note.md',
        sections: [{ key: 'deleted', title: 'Deleted', level: 1, offset: 10 }],
      },
    ]);
    const deletedId = entityId(first.snapshot, 'section', 'Note.md', 'Deleted');
    const without = reconcileRevision(
      'without',
      [{ key: 'note', path: 'Note.md' }],
      first.catalog,
    );
    const recreated = reconcileRevision(
      'new',
      [
        {
          key: 'note',
          path: 'Note.md',
          sections: [{ key: 'new', title: 'Unrelated', level: 1, offset: 10 }],
        },
      ],
      without.catalog,
    );

    expect(
      entityId(recreated.snapshot, 'section', 'Note.md', 'Unrelated'),
    ).not.toBe(deletedId);
    expect(without.summary.retiredFromPrevious.entities).toBe(1);
  });

  it('preserves a uniquely positioned block after an offset shift but refuses changed duplicate groups', () => {
    const oneBlock: DocumentSpec = {
      key: 'note',
      path: 'Note.md',
      sections: [{ key: 'topic', title: 'Topic', level: 1, offset: 10 }],
      blocks: [{ key: 'block', parentKey: 'topic', offset: 20 }],
    };
    const first = reconcileRevision('base', [oneBlock]);
    const shifted = reconcileRevision(
      'shift',
      [
        {
          ...oneBlock,
          blocks: [{ key: 'block', parentKey: 'topic', offset: 40 }],
        },
      ],
      first.catalog,
    );
    expect(entityId(shifted.snapshot, 'block', 'Note.md')).toBe(
      entityId(first.snapshot, 'block', 'Note.md'),
    );

    const expanded = reconcileRevision(
      'expanded',
      [
        {
          ...oneBlock,
          blocks: [
            { key: 'new-block', parentKey: 'topic', offset: 20 },
            { key: 'block', parentKey: 'topic', offset: 50 },
          ],
        },
      ],
      first.catalog,
    );
    expect(expanded.summary.blocks.ambiguousNotReused).toBe(2);
  });

  it('reuses a unique semantic reference but not shifted duplicate occurrences', () => {
    const unique: DocumentSpec = {
      key: 'note',
      path: 'Note.md',
      sections: [{ key: 'topic', title: 'Topic', level: 1, offset: 10 }],
      references: [
        {
          key: 'one',
          sourceKey: 'topic',
          rawTarget: 'Target',
          offset: 15,
          targetKey: 'target',
        },
      ],
    };
    const first = reconcileRevision('base', [unique, target]);
    const shifted = reconcileRevision(
      'shift',
      [
        { ...unique, references: [{ ...unique.references![0]!, offset: 35 }] },
        target,
      ],
      first.catalog,
    );
    expect(shifted.snapshot.references[0]?.id).toBe(
      first.snapshot.references[0]?.id,
    );

    const duplicates = reconcileRevision('duplicates', [
      {
        ...unique,
        references: [
          {
            key: 'one',
            sourceKey: 'topic',
            rawTarget: 'Target',
            offset: 15,
            targetKey: 'target',
          },
          {
            key: 'two',
            sourceKey: 'topic',
            rawTarget: 'Target',
            offset: 25,
            targetKey: 'target',
          },
        ],
      },
      target,
    ]);
    const movedDuplicates = reconcileRevision(
      'moved-duplicates',
      [
        {
          ...unique,
          references: [
            {
              key: 'inserted',
              sourceKey: 'topic',
              rawTarget: 'Target',
              offset: 15,
              targetKey: 'target',
            },
            {
              key: 'one',
              sourceKey: 'topic',
              rawTarget: 'Target',
              offset: 25,
              targetKey: 'target',
            },
            {
              key: 'two',
              sourceKey: 'topic',
              rawTarget: 'Target',
              offset: 35,
              targetKey: 'target',
            },
          ],
        },
        target,
      ],
      duplicates.catalog,
    );
    const oldReferenceIds = new Set(
      duplicates.snapshot.references.map(({ id }) => id),
    );
    expect(
      movedDuplicates.snapshot.references.every(
        ({ id }) => !oldReferenceIds.has(id),
      ),
    ).toBe(true);
    expect(movedDuplicates.summary.references.ambiguousNotReused).toBe(3);
  });

  it('remaps resolved targets and every ambiguous candidate to stable entity IDs', () => {
    const result = reconcileRevision('base', [
      {
        key: 'source',
        path: 'Source.md',
        references: [
          {
            key: 'resolved',
            sourceKey: 'source',
            rawTarget: 'A',
            offset: 10,
            targetKey: 'a',
          },
          {
            key: 'ambiguous',
            sourceKey: 'source',
            rawTarget: 'Maybe',
            offset: 20,
            candidateKeys: ['a', 'b'],
          },
        ],
      },
      { key: 'a', path: 'A.md' },
      { key: 'b', path: 'B.md' },
    ]);
    const stableIds = new Set(result.snapshot.entities.map(({ id }) => id));
    const resolved = result.snapshot.references.find(
      ({ rawTarget }) => rawTarget === 'A',
    );
    const ambiguous = result.snapshot.references.find(
      ({ rawTarget }) => rawTarget === 'Maybe',
    );

    expect(resolved?.resolution.status).toBe('resolved');
    if (resolved?.resolution.status === 'resolved') {
      expect(stableIds.has(resolved.resolution.targetEntityId)).toBe(true);
    }
    expect(ambiguous?.resolution.status).toBe('ambiguous');
    if (ambiguous?.resolution.status === 'ambiguous') {
      expect(
        ambiguous.resolution.candidateEntityIds.every((id) =>
          stableIds.has(id),
        ),
      ).toBe(true);
    }
  });

  it('round-trips valid plain data and preserves all non-identity semantics', () => {
    const transient = buildSnapshot('base', [
      {
        key: 'note',
        path: 'Note.md',
        sections: [{ key: 'topic', title: 'Topic', level: 1, offset: 10 }],
      },
    ]);
    const result = reconcileStableIdentity({ snapshot: transient });
    const catalogRoundTrip: unknown = JSON.parse(
      JSON.stringify(result.catalog),
    );
    const snapshotRoundTrip: unknown = JSON.parse(
      JSON.stringify(result.snapshot),
    );

    expect(validateStableIdentityCatalog(catalogRoundTrip)).toEqual({
      valid: true,
      value: result.catalog,
      issues: [],
    });
    expect(validateKnowledgeSnapshot(snapshotRoundTrip).valid).toBe(true);
    expect(identityFreeSnapshot(result.snapshot)).toEqual(
      identityFreeSnapshot(transient),
    );
  });

  it('fails explicitly for corrupt, unknown-version, and mismatched catalog state', () => {
    expect(validateStableIdentityCatalog({ schemaVersion: 99 }).valid).toBe(
      false,
    );
    expect(
      validateStableIdentityCatalog({
        ...createStableIdentityCatalog('workspace-stable-test'),
        entities: [
          {
            id: 'bad',
            kind: 'document',
            sourcePath: 'C:/private/Note.md',
            sourceStartOffset: 0,
            structuralFingerprint: '[]',
            structuralSignalCount: 0,
          },
        ],
      }).valid,
    ).toBe(false);
    expect(() =>
      reconcileStableIdentity({
        snapshot: buildSnapshot('base', [{ key: 'note', path: 'Note.md' }]),
        previousCatalog: createStableIdentityCatalog('other-workspace'),
      }),
    ).toThrow('workspace mismatch');
  });
});
