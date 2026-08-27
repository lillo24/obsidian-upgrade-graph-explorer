import { applyKnowledgeSnapshotDelta } from '@icarus-graph-explorer/snapshot-delta';
import { describe, expect, it } from 'vitest';

import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
  type ApplyObsidianWorkspaceChangesResult,
  type InitializeObsidianWorkspaceEngineResult,
  type ObsidianWorkspaceEngine,
  type WorkspaceSourceChange,
  type WorkspaceSourceDocument,
} from './index';

const WORKSPACE_ID = 'workspace-engine-test';

function sources(
  values: Readonly<Record<string, string>>,
): WorkspaceSourceDocument[] {
  return Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, source]) => ({ path, source }));
}

function initialized(
  documents: readonly WorkspaceSourceDocument[],
  identityCatalog?: Parameters<
    typeof initializeObsidianWorkspaceEngine
  >[0]['identityCatalog'],
) {
  const result = initializeObsidianWorkspaceEngine({
    workspaceId: WORKSPACE_ID,
    documents,
    ...(identityCatalog === undefined ? {} : { identityCatalog }),
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.failure.message);
  return result;
}

function applied(
  engine: ObsidianWorkspaceEngine,
  changes: readonly WorkspaceSourceChange[],
) {
  const result = applyObsidianWorkspaceChanges(engine, changes);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.failure.message);
  return result;
}

function revisedSources(
  current: ReadonlyMap<string, string>,
  changes: readonly WorkspaceSourceChange[],
): Map<string, string> {
  const next = new Map(current);
  for (const change of changes) {
    if (change.kind === 'upsert') next.set(change.path, change.source);
    else if (change.kind === 'delete') next.delete(change.path);
    else {
      const source = next.get(change.fromPath);
      if (source === undefined) throw new Error('Missing test move source.');
      next.delete(change.fromPath);
      next.set(change.toPath, source);
    }
  }
  return next;
}

function fullRebuildOracle(
  previous: ObsidianWorkspaceEngine,
  result: Extract<ApplyObsidianWorkspaceChangesResult, { readonly ok: true }>,
  nextSources: ReadonlyMap<string, string>,
): Extract<InitializeObsidianWorkspaceEngineResult, { readonly ok: true }> {
  const oracle = initialized(
    sources(Object.fromEntries(nextSources)),
    previous.identityCatalog,
  );
  expect(result.snapshot).toEqual(oracle.snapshot);
  expect(result.identityCatalog).toEqual(oracle.identityCatalog);
  expect(applyKnowledgeSnapshotDelta(previous.snapshot, result.delta)).toEqual(
    oracle.snapshot,
  );
  return oracle;
}

function referenceStatus(engine: ObsidianWorkspaceEngine): string {
  const reference = engine.snapshot.references[0];
  if (reference === undefined) throw new Error('Expected one reference.');
  return reference.resolution.status;
}

describe('Obsidian workspace engine', () => {
  it('initializes by parsing every document once into stable truth', () => {
    const result = initialized(
      sources({
        'A.md': '# A\n[[B]]\n',
        'B.md': '# B\n',
      }),
    );

    expect(result.engine.revision).toBe(0);
    expect(result.stats).toEqual({
      reparsedPaths: ['A.md', 'B.md'],
      reusedParsedDocumentCount: 0,
      totalParsedDocumentCount: 2,
    });
    expect(
      result.snapshot.entities.every(({ id }) => id.startsWith('stable:')),
    ).toBe(true);
    expect(result.engine.parsedDocuments()).toHaveLength(2);
  });

  it('reparses exactly one upsert and all members of a multi-upsert', () => {
    const initialMap = new Map([
      ['A.md', '# A\n'],
      ['B.md', '# B\n'],
      ['C.md', '# C\n'],
    ]);
    const first = initialized(sources(Object.fromEntries(initialMap)));
    const oneChange = [
      { kind: 'upsert', path: 'A.md', source: '# A\n\nEdited\n' },
    ] as const;
    const one = applied(first.engine, oneChange);
    const afterOne = revisedSources(initialMap, oneChange);
    fullRebuildOracle(first.engine, one, afterOne);
    expect(one.stats.reparsedPaths).toEqual(['A.md']);
    expect(one.stats.reusedParsedDocumentCount).toBe(2);

    const threeChanges = [
      { kind: 'upsert', path: 'A.md', source: '# A2\n' },
      { kind: 'upsert', path: 'B.md', source: '# B2\n' },
      { kind: 'upsert', path: 'C.md', source: '# C2\n' },
    ] as const;
    const three = applied(one.engine, threeChanges);
    const afterThree = revisedSources(afterOne, threeChanges);
    fullRebuildOracle(one.engine, three, afterThree);
    expect(three.stats.reparsedPaths).toEqual(['A.md', 'B.md', 'C.md']);
    expect(three.stats.reusedParsedDocumentCount).toBe(0);
  });

  it('deletes with zero reparses and advances one revision', () => {
    const initialMap = new Map([
      ['A.md', '# A\n'],
      ['B.md', '# B\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const changes = [{ kind: 'delete', path: 'B.md' }] as const;
    const result = applied(initial.engine, changes);

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(result.stats.reparsedPaths).toEqual([]);
    expect(result.stats.reusedParsedDocumentCount).toBe(1);
    expect(result.fromRevision).toBe(0);
    expect(result.toRevision).toBe(1);
  });

  it('moves cached parsed IR with zero reparses and lets KG9A preserve identity', () => {
    const initialMap = new Map([
      ['Old/Note.md', '# Topic\n[[Target]]\n'],
      ['Target.md', '# Target\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const oldDocument = initial.snapshot.entities.find(
      ({ kind, source }) =>
        kind === 'document' && source.path === 'Old/Note.md',
    );
    const changes = [
      {
        kind: 'move',
        fromPath: 'Old/Note.md',
        toPath: 'Moved/Note.md',
      },
    ] as const;
    const result = applied(initial.engine, changes);
    const movedDocument = result.snapshot.entities.find(
      ({ kind, source }) =>
        kind === 'document' && source.path === 'Moved/Note.md',
    );

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(result.stats.reparsedPaths).toEqual([]);
    expect(movedDocument?.id).toBe(oldDocument?.id);
    expect(
      result.delta.entities.updated.some(
        ({ before, after }) =>
          before.id === oldDocument?.id && after.id === oldDocument?.id,
      ),
    ).toBe(true);
  });

  it('fails missing deletes and invalid moves without changing prior state', () => {
    const initial = initialized(sources({ 'A.md': '# A\n', 'B.md': '# B\n' }));
    const beforeSnapshot = JSON.stringify(initial.engine.snapshot);
    const beforeCatalog = JSON.stringify(initial.engine.identityCatalog);
    const missingDelete = applyObsidianWorkspaceChanges(initial.engine, [
      { kind: 'delete', path: 'Missing.md' },
    ]);
    const missingMove = applyObsidianWorkspaceChanges(initial.engine, [
      { kind: 'move', fromPath: 'Missing.md', toPath: 'Moved.md' },
    ]);
    const occupiedMove = applyObsidianWorkspaceChanges(initial.engine, [
      { kind: 'move', fromPath: 'A.md', toPath: 'B.md' },
    ]);

    expect(missingDelete).toMatchObject({
      ok: false,
      failure: { code: 'delete-missing-path' },
    });
    expect(missingMove).toMatchObject({
      ok: false,
      failure: { code: 'move-missing-source' },
    });
    expect(occupiedMove).toMatchObject({
      ok: false,
      failure: { code: 'move-target-exists' },
    });
    expect(initial.engine.revision).toBe(0);
    expect(JSON.stringify(initial.engine.snapshot)).toBe(beforeSnapshot);
    expect(JSON.stringify(initial.engine.identityCatalog)).toBe(beforeCatalog);
  });

  it('rejects conflicting batches before parsing or revision advance', () => {
    const initial = initialized(sources({ 'A.md': '# A\n', 'B.md': '# B\n' }));
    const result = applyObsidianWorkspaceChanges(initial.engine, [
      { kind: 'upsert', path: 'A.md', source: '# Changed\n' },
      { kind: 'delete', path: 'A.md' },
    ]);

    expect(result).toMatchObject({
      ok: false,
      failure: { code: 'conflicting-change-batch' },
    });
    expect(initial.engine.revision).toBe(0);
    expect(
      initial.engine.parsedDocument('A.md')?.structure.sections[0]?.title,
    ).toBe('A');
  });

  it('produces identical results for equivalent non-conflicting batch order', () => {
    const initial = initialized(
      sources({ 'A.md': '# A\n', 'B.md': '# B\n', 'C.md': '# C\n' }),
    );
    const forward = applied(initial.engine, [
      { kind: 'upsert', path: 'A.md', source: '# A2\n' },
      { kind: 'delete', path: 'B.md' },
      { kind: 'move', fromPath: 'C.md', toPath: 'Moved/C.md' },
    ]);
    const reverse = applied(initial.engine, [
      { kind: 'move', fromPath: 'C.md', toPath: 'Moved/C.md' },
      { kind: 'delete', path: 'B.md' },
      { kind: 'upsert', path: 'A.md', source: '# A2\n' },
    ]);

    expect(reverse.snapshot).toEqual(forward.snapshot);
    expect(reverse.identityCatalog).toEqual(forward.identityCatalog);
    expect(reverse.delta).toEqual(forward.delta);
    expect(reverse.stats).toEqual(forward.stats);
  });

  it('adds a target while updating an unchanged inbound reference globally', () => {
    const initialMap = new Map([['A.md', '# A\n[[Target]]\n']]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const previousReferenceId = initial.snapshot.references[0]?.id;
    const changes = [
      { kind: 'upsert', path: 'Target.md', source: '# Target\n' },
    ] as const;
    const result = applied(initial.engine, changes);

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(referenceStatus(initial.engine)).toBe('unresolved');
    expect(referenceStatus(result.engine)).toBe('resolved');
    expect(result.snapshot.references[0]?.id).toBe(previousReferenceId);
    expect(result.stats.reparsedPaths).toEqual(['Target.md']);
    expect(result.delta.references.updated).toHaveLength(1);
    expect(result.delta.references.added).toHaveLength(0);
    expect(result.delta.references.removed).toHaveLength(0);
    expect(result.delta.references.updated[0]?.before.sourceSpan).toEqual(
      result.delta.references.updated[0]?.after.sourceSpan,
    );
  });

  it('creates and reverses basename ambiguity without reparsing the source', () => {
    const initialMap = new Map([
      ['Source.md', '# Source\n[[Note]]\n'],
      ['one/Note.md', '# One\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const add = [
      { kind: 'upsert', path: 'two/Note.md', source: '# Two\n' },
    ] as const;
    const ambiguous = applied(initial.engine, add);
    const ambiguousSources = revisedSources(initialMap, add);
    fullRebuildOracle(initial.engine, ambiguous, ambiguousSources);
    expect(referenceStatus(initial.engine)).toBe('resolved');
    expect(referenceStatus(ambiguous.engine)).toBe('ambiguous');
    expect(ambiguous.stats.reparsedPaths).toEqual(['two/Note.md']);
    expect(ambiguous.delta.references.updated).toHaveLength(1);

    const remove = [{ kind: 'delete', path: 'two/Note.md' }] as const;
    const resolved = applied(ambiguous.engine, remove);
    fullRebuildOracle(
      ambiguous.engine,
      resolved,
      revisedSources(ambiguousSources, remove),
    );
    expect(referenceStatus(resolved.engine)).toBe('resolved');
    expect(resolved.stats.reparsedPaths).toEqual([]);
    expect(resolved.delta.references.updated).toHaveLength(1);
  });

  it('updates unchanged inbound heading references after a target-only edit', () => {
    const initialMap = new Map([
      ['Source.md', '# Source\n[[Target#Details]]\n'],
      ['Target.md', '# Details\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const changes = [
      { kind: 'upsert', path: 'Target.md', source: '# Renamed\n' },
    ] as const;
    const result = applied(initial.engine, changes);

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(referenceStatus(initial.engine)).toBe('resolved');
    expect(referenceStatus(result.engine)).toBe('unresolved');
    expect(result.stats.reparsedPaths).toEqual(['Target.md']);
    expect(result.delta.references.updated).toHaveLength(1);
  });

  it('updates unchanged inbound block references after an anchor-only edit', () => {
    const initialMap = new Map([
      ['Source.md', '# Source\n[[Target#^anchor]]\n'],
      ['Target.md', '# Target\nParagraph ^anchor\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const changes = [
      { kind: 'upsert', path: 'Target.md', source: '# Target\nParagraph\n' },
    ] as const;
    const result = applied(initial.engine, changes);

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(referenceStatus(initial.engine)).toBe('resolved');
    expect(referenceStatus(result.engine)).toBe('unresolved');
    expect(result.delta.references.updated).toHaveLength(1);
  });

  it('deletes a target with zero reparses while updating inbound references', () => {
    const initialMap = new Map([
      ['Source.md', '# Source\n[[Target]]\n'],
      ['Target.md', '# Target\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const changes = [{ kind: 'delete', path: 'Target.md' }] as const;
    const result = applied(initial.engine, changes);

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(referenceStatus(result.engine)).toBe('unresolved');
    expect(result.stats.reparsedPaths).toEqual([]);
    expect(result.delta.references.updated).toHaveLength(1);
  });

  it('preserves stable IDs across offset shifts and emits updates rather than churn', () => {
    const initialMap = new Map([
      ['A.md', '# Topic\n[[B]]\n'],
      ['B.md', '# B\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const oldSectionId = initial.snapshot.entities.find(
      ({ kind, source }) => kind === 'section' && source.path === 'A.md',
    )?.id;
    const oldReferenceId = initial.snapshot.references[0]?.id;
    const changes = [
      { kind: 'upsert', path: 'A.md', source: '\n\n# Topic\n[[B]]\n' },
    ] as const;
    const result = applied(initial.engine, changes);
    const newSectionId = result.snapshot.entities.find(
      ({ kind, source }) => kind === 'section' && source.path === 'A.md',
    )?.id;

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(newSectionId).toBe(oldSectionId);
    expect(result.snapshot.references[0]?.id).toBe(oldReferenceId);
    expect(
      result.delta.entities.updated.map(({ before }) => before.id),
    ).toContain(oldSectionId);
    expect(
      result.delta.references.updated.map(({ before }) => before.id),
    ).toContain(oldReferenceId);
  });

  it('supports an atomic rename-plus-edit under KG9A continuity policy', () => {
    const initialMap = new Map([
      ['Old.md', '# Topic\n[[Target]]\n'],
      ['Target.md', '# Target\n'],
    ]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const oldDocumentId = initial.snapshot.entities.find(
      ({ kind, source }) => kind === 'document' && source.path === 'Old.md',
    )?.id;
    const changes = [
      { kind: 'delete', path: 'Old.md' },
      {
        kind: 'upsert',
        path: 'Renamed.md',
        source: '# Topic\n\n[[Target]]\n',
      },
    ] as const;
    const result = applied(initial.engine, changes);
    const renamedDocumentId = result.snapshot.entities.find(
      ({ kind, source }) => kind === 'document' && source.path === 'Renamed.md',
    )?.id;

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(result.stats.reparsedPaths).toEqual(['Renamed.md']);
    expect(renamedDocumentId).toBe(oldDocumentId);
  });

  it('represents KG9A-refused weak identity continuity as remove plus add', () => {
    const initialMap = new Map([['A.md', '# Weak\n']]);
    const initial = initialized(sources(Object.fromEntries(initialMap)));
    const oldSectionId = initial.snapshot.entities.find(
      ({ kind }) => kind === 'section',
    )?.id;
    const changes = [
      { kind: 'upsert', path: 'A.md', source: '# Different weak heading\n' },
    ] as const;
    const result = applied(initial.engine, changes);
    const newSectionId = result.snapshot.entities.find(
      ({ kind }) => kind === 'section',
    )?.id;

    fullRebuildOracle(
      initial.engine,
      result,
      revisedSources(initialMap, changes),
    );
    expect(newSectionId).not.toBe(oldSectionId);
    expect(
      result.delta.entities.removed.map(({ before }) => before.id),
    ).toContain(oldSectionId);
    expect(result.delta.entities.added.map(({ after }) => after.id)).toContain(
      newSectionId,
    );
  });

  it('keeps failed resolution batches atomic and revisioned successes isolated', () => {
    const initial = initialized(sources({ 'A.md': '# A\n' }));
    const invalid = applyObsidianWorkspaceChanges(initial.engine, [
      { kind: 'upsert', path: '../outside.md', source: '# Outside\n' },
    ]);
    expect(invalid).toMatchObject({
      ok: false,
      failure: { stage: 'input', code: 'invalid-upsert' },
    });
    expect(initial.engine.revision).toBe(0);

    const success = applied(initial.engine, [
      { kind: 'upsert', path: 'A.md', source: '# A\nEdited\n' },
    ]);
    expect(success.fromRevision).toBe(0);
    expect(success.toRevision).toBe(1);
    expect(initial.engine.revision).toBe(0);
    expect(success.engine.revision).toBe(1);
  });
});
