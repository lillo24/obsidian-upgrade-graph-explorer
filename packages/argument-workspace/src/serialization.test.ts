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
        JSON.stringify({ ...createNeutralArgumentLibrary(), schemaVersion: 2 }),
      ),
    ).toMatchObject({ status: 'future-schema' });
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
    expect(exported.files).toHaveLength(3);
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
    expect(safeMarkdownFileName('CON', 'id:unsafe')).toBe(
      'record--id-unsafe.md',
    );
  });
});
