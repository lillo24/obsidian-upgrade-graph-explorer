import { describe, expect, it } from 'vitest';

import {
  captureArgumentLibrarySnapshot,
  clonePlainData,
  sameSnapshot,
  sha256,
} from './canonical';
import { createEmptyArgumentLibrary, createTopic } from './library';
import {
  exportArgumentLibraryMarkdown,
  safeMarkdownFileName,
} from './markdown';
import {
  mergeArgumentLibraries,
  parseArgumentLibraryJson,
  previewArgumentLibraryImport,
  serializeArgumentLibrary,
} from './serialization';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';

describe('Argument Library interchange', () => {
  const legacyV1 = {
    schemaVersion: 1,
    libraryId: 'library-v1-fixture',
    libraryRevision: 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    topics: [
      {
        id: 'T-V1',
        revision: 1,
        reviewState: 'accepted',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        title: 'Legacy topic',
        summary: 'A legacy summary.',
        retrieval: { aliases: [], keywords: ['legacy'], phrases: [] },
        axiomIds: ['AX-V1'],
        counterArgumentIds: ['CA-V1'],
      },
    ],
    axioms: [
      {
        id: 'AX-V1',
        revision: 2,
        reviewState: 'accepted',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        title: 'Legacy axiom',
        statement: 'Legacy content remains unchanged.',
        retrieval: { aliases: [], keywords: [], phrases: [] },
        sourceReferences: [],
      },
    ],
    counterArguments: [
      {
        id: 'CA-V1',
        revision: 3,
        reviewState: 'accepted',
        archived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        title: 'Legacy counter',
        observation: 'A legacy observation.',
        challengedClaim: 'A legacy challenged claim.',
        target: { kind: 'topic-claim', topicId: 'T-V1' },
        retrieval: { aliases: [], keywords: [], phrases: [] },
        sourceReferences: [],
        response: {
          answeringAxioms: [{ axiomId: 'AX-V1', reliedOnRevision: 2 }],
          explanation: 'A legacy response.',
          outcome: 'standing',
        },
      },
    ],
  } as const;

  it('implements SHA-256 and exact JSON round trips deterministically', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    const library = createNeutralArgumentLibrary();
    const serialized = serializeArgumentLibrary(library);
    const parsed = parseArgumentLibraryJson(serialized);
    expect(parsed.status).toBe('valid');
    if (parsed.status !== 'valid') return;
    expect(parsed.value).toEqual(library);
    expect(serializeArgumentLibrary(parsed.value)).toBe(serialized);
    expect(
      sameSnapshot(
        captureArgumentLibrarySnapshot(library).descriptor,
        captureArgumentLibrarySnapshot(parsed.value).descriptor,
      ),
    ).toBe(true);
  });

  it('distinguishes corrupt JSON, invalid data, and future schemas', () => {
    expect(parseArgumentLibraryJson('{broken')).toMatchObject({
      status: 'invalid-json',
    });
    expect(parseArgumentLibraryJson('{"schemaVersion":1}')).toMatchObject({
      status: 'invalid-library',
    });
    expect(
      parseArgumentLibraryJson(
        JSON.stringify({ ...createNeutralArgumentLibrary(), schemaVersion: 3 }),
      ),
    ).toMatchObject({ status: 'future-schema' });
  });

  it('migrates v1 deterministically without inventing reasoning content', () => {
    const source = JSON.stringify(legacyV1);
    const first = parseArgumentLibraryJson(source);
    const second = parseArgumentLibraryJson(source);
    expect(first).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 1,
      value: {
        schemaVersion: 2,
        libraryId: 'library-v1-fixture',
        libraryRevision: 7,
        arguments: [],
        topics: [{ id: 'T-V1', argumentIds: [] }],
      },
    });
    expect(second).toEqual(first);
    if (first.status !== 'valid') return;
    expect(first.value.axioms).toEqual(legacyV1.axioms);
    expect(first.value.counterArguments).toEqual(legacyV1.counterArguments);
    expect(first.value.topics[0]).not.toHaveProperty('currentArgumentId');
    expect(JSON.stringify(first.value)).not.toContain('reasoning');
  });

  it('treats identical import as idempotent and same-lineage altered content as conflict', () => {
    const library = createNeutralArgumentLibrary();
    expect(
      previewArgumentLibraryImport(library, clonePlainData(library), 'merge'),
    ).toMatchObject({
      status: 'identical',
    });
    const changed = clonePlainData(library) as {
      topics: { title: string }[];
    } & typeof library;
    changed.topics[0]!.title = 'Conflicting content';
    expect(
      previewArgumentLibraryImport(library, changed, 'replace'),
    ).toMatchObject({
      status: 'conflict',
    });
    expect(
      sameSnapshot(
        captureArgumentLibrarySnapshot(library).descriptor,
        captureArgumentLibrarySnapshot(changed).descriptor,
      ),
    ).toBe(false);
  });

  it('previews and merges a different lineage without rolling back local revision', () => {
    const runtime = deterministicRuntime('import');
    const current = createNeutralArgumentLibrary();
    let incoming = createEmptyArgumentLibrary(runtime, 'library-import');
    incoming = createTopic(
      incoming,
      {
        id: 'T-IMPORT',
        title: 'Imported context',
        summary: 'A neutral imported record.',
      },
      runtime,
    );
    expect(
      previewArgumentLibraryImport(current, incoming, 'merge'),
    ).toMatchObject({
      status: 'merge-ready',
      additions: [{ kind: 'topic', id: 'T-IMPORT' }],
    });
    const merged = mergeArgumentLibraries(current, incoming, runtime);
    expect(merged.libraryId).toBe(current.libraryId);
    expect(merged.libraryRevision).toBe(current.libraryRevision + 1);
    expect(merged.topics.map(({ id }) => id)).toEqual([
      'T-IMPORT',
      'T-NEUTRAL',
    ]);
  });

  it('exports compact Markdown with stable IDs, links, response semantics, and safe names', () => {
    const exported = exportArgumentLibraryMarkdown(
      createNeutralArgumentLibrary(),
    );
    expect(exported.files).toHaveLength(4);
    expect(exported.files.every(({ path }) => !/[<>:"\\|?*]/u.test(path))).toBe(
      true,
    );
    expect(
      exported.files.find(({ path }) => path.startsWith('axioms/'))?.text,
    ).toContain('[[Measurement#Units]]');
    const counter = exported.files.find(({ path }) =>
      path.startsWith('counter-arguments/'),
    )!;
    expect(counter.text).toContain('id: "CA-NEUTRAL"');
    expect(counter.text).toContain('AX-NEUTRAL, assessed at revision 1');
    expect(counter.text).toContain('inapplicable-under-stated-scope');
    const argument = exported.files.find(({ path }) =>
      path.startsWith('arguments/'),
    )!;
    expect(argument.text).toContain('## Premises');
    expect(argument.text).toContain('## Reasoning');
    expect(argument.text).toContain('## Conclusion');
    expect(safeMarkdownFileName('CON', 'id:unsafe')).toBe(
      'record--id-unsafe.md',
    );
  });
});
