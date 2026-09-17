import { describe, expect, it } from 'vitest';

import {
  captureArgumentLibrarySnapshot,
  clonePlainData,
  sameSnapshot,
  sha256,
} from './canonical';
import {
  createArgument,
  createEmptyArgumentLibrary,
  createTopic,
} from './library';
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
        JSON.stringify({ ...createNeutralArgumentLibrary(), schemaVersion: 4 }),
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
        schemaVersion: 3,
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

  it('migrates v2 deterministically and preserves existing records and premises', () => {
    const current = clonePlainData(createNeutralArgumentLibrary());
    const withoutV3Fields = (argument: unknown): Record<string, unknown> => {
      const legacyArgument = clonePlainData(argument) as Record<
        string,
        unknown
      >;
      delete legacyArgument.examples;
      delete legacyArgument.relations;
      delete legacyArgument.boundary;
      return legacyArgument;
    };
    const legacyArguments = current.arguments.map(withoutV3Fields);
    const legacyV2 = {
      ...current,
      schemaVersion: 2,
      arguments: legacyArguments,
    };
    const source = JSON.stringify(legacyV2);
    const first = parseArgumentLibraryJson(source);
    const second = parseArgumentLibraryJson(source);
    expect(first).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 2,
      value: {
        schemaVersion: 3,
        arguments: [{ examples: [], relations: [] }],
      },
    });
    expect(second).toEqual(first);
    if (first.status !== 'valid') return;
    expect(first.value.arguments.map(withoutV3Fields)).toEqual(legacyArguments);
    expect(first.value.topics).toEqual(legacyV2.topics);
    expect(first.value.axioms).toEqual(legacyV2.axioms);
    expect(first.value.counterArguments).toEqual(legacyV2.counterArguments);
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
    expect(argument.text).toContain('## Examples');
    expect(argument.text).toContain('## Reasoning');
    expect(argument.text).toContain('## Conclusion');
    expect(argument.text).toContain('## Argument relations');
    expect(safeMarkdownFileName('CON', 'id:unsafe')).toBe(
      'record--id-unsafe.md',
    );
  });

  it('exports v3 Argument structure without flattening reusable identities', () => {
    const runtime = deterministicRuntime('markdown-v3');
    let library = createArgument(
      createEmptyArgumentLibrary(runtime, 'markdown-v3-library'),
      {
        id: 'AR-MD-SOURCE',
        title: 'Source case',
        examples: [{ id: 'E-MD', text: 'A concrete exported Example.' }],
        premises: [
          {
            id: 'P-MD',
            kind: 'text',
            text: 'A reusable exported premise.',
            exampleIds: ['E-MD'],
          },
        ],
        reasoning: 'Source reasoning.',
        conclusion: 'Source conclusion.',
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'AR-MD-NEXT',
        title: 'Reusing case',
        premises: [
          {
            id: 'P-MD-REUSE',
            kind: 'argument-premise',
            argumentId: 'AR-MD-SOURCE',
            premiseId: 'P-MD',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'Reused conclusion.',
        boundary: 'Invariant under a neutral presentation change.',
        relations: [
          {
            id: 'REL-MD',
            kind: 'attack',
            targetArgumentId: 'AR-MD-SOURCE',
            targetPart: { kind: 'reasoning' },
            reliedOnRevision: 1,
          },
        ],
        supersedesArgumentId: 'AR-MD-SOURCE',
      },
      runtime,
    );
    const exported = exportArgumentLibraryMarkdown(library);
    const source = exported.files.find(({ path }) =>
      path.includes('AR-MD-SOURCE'),
    )!.text;
    const next = exported.files.find(({ path }) =>
      path.includes('AR-MD-NEXT'),
    )!.text;
    expect(source).toContain('**E-MD** — A concrete exported Example.');
    expect(source).toContain('[Examples: E-MD]');
    expect(next).toContain('premise P-MD');
    expect(next).toContain('## Boundary / Invariance');
    expect(next).toContain('**REL-MD** — attack');
    expect(next).toContain('## Supersedes');
  });
});
