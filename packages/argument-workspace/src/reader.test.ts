import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot, clonePlainData } from './canonical';
import {
  editAxiom,
  editCounterArgument,
  createCounterArgument,
} from './library';
import {
  createKnowledgeReader,
  createKnowledgeReaderFromJson,
  dispatchKnowledgeCall,
} from './reader';
import { serializeArgumentLibrary } from './serialization';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import type {
  LinkedTheorySourceProvider,
  LinkedTheorySourceProviderResult,
} from './types';

describe('snapshot-bound knowledge reader', () => {
  it('lists and searches deterministic snapshot-bound candidates', () => {
    const library = createNeutralArgumentLibrary();
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(library),
    );
    const first = reader.listIndex({ limit: 2 });
    expect(first.status).toBe('ok');
    if (first.status !== 'ok') return;
    expect(first.value.candidates).toHaveLength(2);
    expect(first.value.nextCursor).toBeTypeOf('string');
    const firstCursor = first.value.nextCursor;
    if (firstCursor === undefined)
      throw new Error('Expected a second index page.');
    const second = reader.listIndex({ limit: 2, cursor: firstCursor });
    expect(second).toMatchObject({
      status: 'ok',
      value: { candidates: [{ id: 'T-NEUTRAL' }] },
    });

    const phrase = reader.searchIndex({
      query: 'approximation initially seems inconsistent',
    });
    expect(phrase).toMatchObject({
      status: 'ok',
      value: {
        candidates: expect.arrayContaining([
          expect.objectContaining({ id: 'CA-NEUTRAL' }),
        ]),
      },
    });
    const numeric = reader.searchIndex({ query: '3.14...' });
    expect(numeric).toMatchObject({
      status: 'ok',
      value: {
        candidates: expect.arrayContaining([
          expect.objectContaining({ id: 'T-NEUTRAL' }),
        ]),
      },
    });
    expect(reader.searchIndex({ query: '', limit: 10 }).status).toBe('ok');
  });

  it('binds cursors and expected snapshots instead of falling back to latest', () => {
    const runtime = deterministicRuntime('cursor');
    const firstLibrary = createNeutralArgumentLibrary();
    const firstReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(firstLibrary),
    );
    const first = firstReader.listIndex({ limit: 1 });
    if (first.status !== 'ok') throw new Error('Expected index page.');
    const firstCursor = first.value.nextCursor;
    if (firstCursor === undefined) throw new Error('Expected an index cursor.');
    const secondLibrary = editAxiom(
      firstLibrary,
      'AX-NEUTRAL',
      { statement: 'An edited neutral premise.' },
      runtime,
    );
    const secondReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(secondLibrary),
    );
    expect(
      secondReader.listIndex({ limit: 1, cursor: firstCursor }),
    ).toMatchObject({
      status: 'invalid-request',
    });
    expect(
      secondReader.searchIndex({
        query: 'units',
        expectedSnapshot: firstReader.snapshot,
      }),
    ).toEqual({
      status: 'snapshot-mismatch',
      expected: firstReader.snapshot,
      actual: secondReader.snapshot,
    });
  });

  it('assembles complete CA and Axiom exchanges with memberships and stale warnings', () => {
    const runtime = deterministicRuntime('bundle');
    const first = createNeutralArgumentLibrary();
    const oldReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(first),
    );
    const firstBundle = oldReader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    expect(firstBundle).toMatchObject({
      status: 'ok',
      value: {
        topics: [expect.objectContaining({ id: 'T-NEUTRAL' })],
        axioms: [expect.objectContaining({ id: 'AX-NEUTRAL' })],
        counterArguments: [
          expect.objectContaining({
            id: 'CA-NEUTRAL',
            challengedClaim: expect.stringContaining('unequal measurements'),
            responseStale: false,
            response: expect.objectContaining({
              outcome: 'inapplicable-under-stated-scope',
            }),
          }),
        ],
        completeness: { status: 'complete', theorySources: 'not-read' },
      },
    });
    const axiomBundle = oldReader.readArgumentBundle({
      kind: 'axiom',
      id: 'AX-NEUTRAL',
    });
    expect(axiomBundle).toMatchObject({
      status: 'ok',
      value: {
        counterArguments: [expect.objectContaining({ id: 'CA-NEUTRAL' })],
      },
    });

    const second = editAxiom(
      first,
      'AX-NEUTRAL',
      { statement: 'Edited after assessment.' },
      runtime,
    );
    const newReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(second),
    );
    const oldAgain = oldReader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    const newBundle = newReader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    expect(oldAgain).toEqual(firstBundle);
    expect(newBundle).toMatchObject({
      status: 'ok',
      value: {
        counterArguments: [
          expect.objectContaining({
            responseStale: true,
            staleAxiomIds: ['AX-NEUTRAL'],
          }),
        ],
      },
    });
  });

  it('keeps target traversal cycle-safe and reports depth/record limits explicitly', () => {
    const runtime = deterministicRuntime('cycle');
    let library = createNeutralArgumentLibrary();
    library = createCounterArgument(
      library,
      {
        id: 'CA-TWO',
        title: 'Second challenge',
        observation: 'A second observation.',
        challengedClaim: 'A second challenged claim.',
        target: { kind: 'counter-argument', counterArgumentId: 'CA-NEUTRAL' },
      },
      runtime,
    );
    library = editCounterArgument(
      library,
      'CA-NEUTRAL',
      { target: { kind: 'counter-argument', counterArgumentId: 'CA-TWO' } },
      runtime,
    );
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(library),
    );
    const cycle = reader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    expect(cycle).toMatchObject({
      status: 'ok',
      value: {
        counterArguments: expect.arrayContaining([
          expect.objectContaining({ id: 'CA-NEUTRAL' }),
          expect.objectContaining({ id: 'CA-TWO' }),
        ]),
        completeness: {
          warnings: expect.arrayContaining([
            expect.stringContaining('cycle detected'),
          ]),
        },
      },
    });
    expect(
      reader.readArgumentBundle({ id: 'CA-NEUTRAL', maxRecords: 1 }),
    ).toMatchObject({
      status: 'limit-exceeded',
      omissions: expect.arrayContaining([
        expect.stringContaining('Record limit'),
      ]),
    });
    expect(
      reader.readArgumentBundle({ id: 'CA-NEUTRAL', maxDepth: 0 }),
    ).toMatchObject({
      status: 'limit-exceeded',
      omissions: expect.arrayContaining([expect.stringContaining('depth 0')]),
    });
  });

  it('returns copies, supports equivalent concurrent readers, and recreates from retained JSON', async () => {
    const library = createNeutralArgumentLibrary();
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(library),
    );
    const first = reader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    if (first.status !== 'ok') throw new Error('Expected bundle.');
    const mutable = first.value as unknown as {
      topics: { title: string }[];
      counterArguments: { response: { outcome: string } }[];
    };
    mutable.topics[0]!.title = 'Mutated caller copy';
    mutable.counterArguments[0]!.response.outcome = 'standing';
    expect(reader.readArgumentBundle({ id: 'CA-NEUTRAL' })).toMatchObject({
      status: 'ok',
      value: {
        topics: [expect.objectContaining({ title: 'Measurement Boundaries' })],
        counterArguments: [
          expect.objectContaining({
            response: expect.objectContaining({
              outcome: 'inapplicable-under-stated-scope',
            }),
          }),
        ],
      },
    });
    const recreated = createKnowledgeReaderFromJson(
      serializeArgumentLibrary(library),
    );
    const [left, right] = await Promise.all([
      Promise.resolve(reader.readArgumentBundle({ id: 'CA-NEUTRAL' })),
      Promise.resolve(recreated.readArgumentBundle({ id: 'CA-NEUTRAL' })),
    ]);
    expect(left).toEqual(right);
    expect(JSON.parse(reader.exportRetainedSnapshot())).toEqual(library);
  });

  it('validates the generic dispatcher and does not accept arbitrary source locations', async () => {
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
    );
    expect(
      await dispatchKnowledgeCall(reader, {
        operation: 'searchIndex',
        input: { query: 'units' },
      }),
    ).toMatchObject({ status: 'ok' });
    expect(
      await dispatchKnowledgeCall(reader, {
        operation: 'readLinkedTheorySource',
        input: { sourceReferenceId: 'SRC-NEUTRAL', path: 'C:/private/file.md' },
      }),
    ).toMatchObject({
      status: 'invalid-request',
      issues: [expect.stringContaining('Unknown field "path"')],
    });
  });

  it('produces serializable receipts from the actual returned payload', () => {
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
    );
    const result = reader.readArgumentBundle({ id: 'CA-NEUTRAL' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(() => JSON.stringify(result.value.receipt)).not.toThrow();
    expect(result.value.receipt).toMatchObject({
      contractVersion: 1,
      operation: 'read-argument-bundle',
      snapshot: reader.snapshot,
      returnedRecords: expect.arrayContaining([
        { kind: 'counter-argument', id: 'CA-NEUTRAL', revision: 3 },
      ]),
      payloadFingerprint: { algorithm: 'sha256-canonical-json-v1' },
    });
    const altered = clonePlainData(result.value.receipt);
    expect(altered.payloadFingerprint.value).toBe(
      result.value.receipt.payloadFingerprint.value,
    );
  });
});

describe('linked theory source reads', () => {
  const success = (version = 'v1'): LinkedTheorySourceProviderResult => ({
    status: 'ok',
    sourceSpaceId: 'authorized-space',
    location: {
      path: 'Theory/Measurement.md',
      heading: 'Units',
      span: {
        start: { line: 4, column: 1, offset: 20 },
        end: { line: 6, column: 1, offset: 80 },
      },
    },
    text: '## Units\nCompatible units are required.',
    sourceVersion: version,
    complete: true,
    omissions: [],
    observedAt: '2026-01-02T00:00:00.000Z',
  });

  function provider(
    result: LinkedTheorySourceProviderResult | Error,
    sourceSpaceId = 'authorized-space',
  ): LinkedTheorySourceProvider {
    return {
      sourceSpaceId,
      async read() {
        if (result instanceof Error) throw result;
        return result;
      },
    };
  }

  it('reports no provider while retaining the registered locator', async () => {
    const reader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
    );
    expect(
      await reader.readLinkedTheorySource({ sourceReferenceId: 'SRC-NEUTRAL' }),
    ).toMatchObject({
      status: 'provider-unavailable',
      locator: {
        id: 'SRC-NEUTRAL',
        path: 'Theory/Measurement.md',
        originalWikilink: '[[Measurement#Units]]',
      },
    });
    expect(
      await reader.readLinkedTheorySource({ sourceReferenceId: 'SRC-UNKNOWN' }),
    ).toMatchObject({
      status: 'source-reference-not-found',
      sourceReferenceId: 'SRC-UNKNOWN',
    });
  });

  it.each([
    ['source-missing', 'missing'],
    ['heading-unresolved', 'unresolved'],
    ['heading-ambiguous', 'ambiguous'],
    ['denied', 'denied'],
    ['unsupported', 'unsupported'],
    ['version-unavailable', 'version unavailable'],
  ] as const)(
    'preserves explicit provider outcome %s',
    async (status, message) => {
      const reader = createKnowledgeReader(
        captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
        {
          sourceProvider: provider({ status, message }),
        },
      );
      expect(
        await reader.readLinkedTheorySource({
          sourceReferenceId: 'SRC-NEUTRAL',
        }),
      ).toMatchObject({
        status,
        message,
      });
    },
  );

  it('rejects wrong bindings before reading and reports provider exceptions', async () => {
    let reads = 0;
    const wrongReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
      {
        sourceProvider: {
          sourceSpaceId: 'other-space',
          async read() {
            reads += 1;
            return success();
          },
        },
      },
    );
    expect(
      await wrongReader.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
      }),
    ).toMatchObject({
      status: 'wrong-binding',
    });
    expect(reads).toBe(0);
    const failingReader = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
      {
        sourceProvider: provider(new Error('read failed')),
      },
    );
    expect(
      await failingReader.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
      }),
    ).toMatchObject({
      status: 'provider-error',
      message: expect.stringContaining('read failed'),
    });
  });

  it('returns exact source/version/fingerprint metadata and separates freshness', async () => {
    const matching = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
      {
        sourceProvider: provider(success('v1')),
      },
    );
    expect(
      await matching.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
        expectedSourceVersion: 'v1',
        requireExactVersion: true,
      }),
    ).toMatchObject({
      status: 'ok',
      value: {
        text: '## Units\nCompatible units are required.',
        sourceVersion: 'v1',
        freshness: 'matches-recorded-version',
        fingerprintScope: 'returned-excerpt',
        receipt: {
          sourceObservations: [
            expect.objectContaining({
              sourceReferenceId: 'SRC-NEUTRAL',
              sourceVersion: 'v1',
            }),
          ],
        },
      },
    });
    expect(
      await matching.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
        requireExactVersion: true,
      }),
    ).toMatchObject({ status: 'ok', value: { sourceVersion: 'v1' } });
    const changed = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
      {
        sourceProvider: provider(success('v2')),
      },
    );
    expect(
      await changed.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
      }),
    ).toMatchObject({
      status: 'ok',
      value: { freshness: 'changed', sourceVersion: 'v2' },
    });
    expect(
      await changed.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
        expectedSourceVersion: 'v1',
      }),
    ).toMatchObject({ status: 'version-mismatch' });

    const unknown = createKnowledgeReader(
      captureArgumentLibrarySnapshot(createNeutralArgumentLibrary()),
      {
        sourceProvider: provider({
          ...success(),
          sourceVersion: undefined,
        } as unknown as LinkedTheorySourceProviderResult),
      },
    );
    expect(
      await unknown.readLinkedTheorySource({
        sourceReferenceId: 'SRC-NEUTRAL',
      }),
    ).toMatchObject({
      status: 'ok',
      value: { freshness: 'unknown' },
    });
  });
});
