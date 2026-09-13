import { describe, expect, it } from 'vitest';

import {
  CompilerAccessError,
  ReviewEngine,
  ScriptedAgentProvider,
  createSequentialIdGenerator,
  type IntegrationResultInput,
  type PostCheckResultInput,
  type ReviewRunRecord,
  type ReviewStage,
  type ScriptedStep,
  type StartReviewInput,
} from '@icarus-graph-explorer/ai-review';
import {
  attachAnsweringAxiom,
  captureArgumentLibrarySnapshot,
  contentFingerprint,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  editAxiom,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentLibrary,
  type ArgumentLibrarySnapshot,
  type ArgumentRuntime,
  type TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import {
  ARGUMENT_SOURCE_CAPTURE_LIMITS,
  ArgumentSourceAccessSession,
  FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE,
} from '../arguments/source-capture';
import {
  createArgumentCompilerProvider,
  decodeArgumentCompilerSnapshotDescriptor,
  encodeArgumentCompilerSnapshotDescriptor,
} from './argument-compiler-adapter';

const WORKSPACE_ID = 'authorized-space';
const OBSERVED_AT = '2026-09-13T10:00:00.000Z';
const SOURCE_TEXT = '# Units\nCompatible quantities share a unit.\n';
const SOURCE_VERSION = `${FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE}:${contentFingerprint(SOURCE_TEXT).value}`;

function runtime(prefix = 'adapter'): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `${prefix}-${kind}-${++id}`,
    now: () => new Date(Date.UTC(2026, 8, 13, 10, 0, second++)).toISOString(),
  };
}

function sourceReference(
  overrides: Partial<TheorySourceReference> = {},
): TheorySourceReference {
  return {
    id: 'SRC-UNITS',
    sourceSpaceHint: WORKSPACE_ID,
    path: 'Theory/Measurement.md',
    heading: 'Units',
    label: 'Measurement units',
    role: 'basis',
    recordedVersion: {
      sourceVersion: SOURCE_VERSION,
      fingerprintScope: 'file',
    },
    ...overrides,
  };
}

function neutralLibrary(
  reference: TheorySourceReference = sourceReference(),
): ArgumentLibrary {
  const clock = runtime();
  let library = createEmptyArgumentLibrary(clock, 'library-neutral-α');
  library = createTopic(
    library,
    {
      id: 'T-NEUTRAL',
      title: 'Measurement Boundaries',
      summary: 'Comparisons depend on a shared unit and scope.',
      retrieval: {
        keywords: ['measurement', 'scope'],
        phrases: ['numbers initially seem inconsistent'],
      },
      reviewState: 'accepted',
    },
    clock,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-NEUTRAL',
      title: 'Comparable quantities use compatible units',
      statement: 'A direct numerical comparison requires compatible units.',
      explanation: 'Convert both quantities into compatible units first.',
      scope: 'Direct comparisons of measured quantities.',
      supportingReasoning: 'A number without its unit is incomplete evidence.',
      retrieval: { aliases: ['unit compatibility'], keywords: ['units'] },
      sourceReferences: [reference],
      reviewState: 'accepted',
    },
    clock,
  );
  library = createCounterArgument(
    library,
    {
      id: 'CA-NEUTRAL',
      title: 'Different numbers imply a contradiction',
      observation: 'A length and duration can have different numeric values.',
      challengedClaim: 'Any unequal measurements contradict each other.',
      target: { kind: 'topic-claim', topicId: 'T-NEUTRAL' },
      retrieval: {
        keywords: ['contradiction'],
        phrases: ['initially seem inconsistent'],
      },
      reviewState: 'accepted',
    },
    clock,
  );
  library = attachAnsweringAxiom(library, 'CA-NEUTRAL', 'AX-NEUTRAL', clock);
  library = updateCounterArgumentResponse(
    library,
    'CA-NEUTRAL',
    {
      explanation:
        'The comparison establishes no contradiction until units and scope agree.',
      outcome: 'inapplicable-under-stated-scope',
      boundary: 'The observations remain valid individually.',
      reopeningCondition:
        'Reopen if the quantities are shown to use compatible units.',
    },
    clock,
  );
  library = setTopicMembership(
    library,
    'T-NEUTRAL',
    'axiom',
    'AX-NEUTRAL',
    true,
    clock,
  );
  return setTopicMembership(
    library,
    'T-NEUTRAL',
    'counter-argument',
    'CA-NEUTRAL',
    true,
    clock,
  );
}

function sourceAccess(
  source = SOURCE_TEXT,
  sourceSpaceId = WORKSPACE_ID,
  path = 'Theory/Measurement.md',
): ArgumentSourceAccessSession {
  const access = new ArgumentSourceAccessSession();
  access.publishCommittedSource({
    sourceSessionId: 'source-session',
    sourceSpaceId,
    displayName: 'Neutral source',
    acquisition: 'captured',
    acquisitionState: 'ready',
    runtimeRevision: 1,
    observedAt: OBSERVED_AT,
    inventory: {
      markdownDocuments: [{ path, source }],
      nonMarkdownPaths: [],
    },
  });
  expect(access.bindCurrent(access.state().generation).status).toBe('bound');
  return access;
}

function providerFor(
  current: () => ArgumentLibrarySnapshot | undefined,
  access?: ArgumentSourceAccessSession,
) {
  return createArgumentCompilerProvider({
    currentSnapshot: current,
    ...(access === undefined ? {} : { sourceAccess: access }),
    clock: () => OBSERVED_AT,
  });
}

function abortSignal(): AbortSignal {
  return new AbortController().signal;
}

function content<T>(value: unknown): T {
  return value as T;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof CompilerAccessError ? error.code : undefined;
}

describe('Argument CompilerProvider adapter', () => {
  it('round-trips every core snapshot field and rejects malformed requested IDs', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const encoded = encodeArgumentCompilerSnapshotDescriptor(
      snapshot.descriptor,
    );
    expect(decodeArgumentCompilerSnapshotDescriptor(encoded)).toEqual(
      snapshot.descriptor,
    );
    expect(encoded.snapshotId).not.toContain('C:\\');
    expect(encoded.revision).toBe(String(snapshot.descriptor.libraryRevision));

    await expect(
      providerFor(() => snapshot).openSnapshot({
        workspaceId: WORKSPACE_ID,
        requestedSnapshotId: 'malformed',
        signal: abortSignal(),
      }),
    ).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'invalid-request',
    );
  });

  it('never substitutes latest for an unavailable old snapshot and pins opened sessions', async () => {
    const first = captureArgumentLibrarySnapshot(neutralLibrary());
    const changed = editAxiom(
      first.library,
      'AX-NEUTRAL',
      { statement: 'Changed only after the first session opened.' },
      runtime('changed'),
    );
    const second = captureArgumentLibrarySnapshot(changed);
    let current = first;
    const provider = providerFor(() => current);
    const firstSession = await provider.openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });

    current = second;
    const secondSession = await provider.openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    const reopenedFirst = await provider.openSnapshot({
      workspaceId: WORKSPACE_ID,
      requestedSnapshotId: firstSession.descriptor.snapshotId,
      signal: abortSignal(),
    });
    expect(secondSession.descriptor.snapshotId).not.toBe(
      firstSession.descriptor.snapshotId,
    );
    expect(reopenedFirst.descriptor.snapshotId).toBe(
      firstSession.descriptor.snapshotId,
    );

    const pinned = await firstSession.readBundle(
      { id: 'AX-NEUTRAL' },
      abortSignal(),
    );
    const newest = await secondSession.readBundle(
      { id: 'AX-NEUTRAL' },
      abortSignal(),
    );
    expect(JSON.stringify(pinned.content)).toContain(
      'A direct numerical comparison requires compatible units.',
    );
    expect(JSON.stringify(pinned.content)).not.toContain(
      'Changed only after the first session opened.',
    );
    expect(JSON.stringify(newest.content)).toContain(
      'Changed only after the first session opened.',
    );

    const unretained = providerFor(() => second);
    await expect(
      unretained.openSnapshot({
        workspaceId: WORKSPACE_ID,
        requestedSnapshotId: firstSession.descriptor.snapshotId,
        signal: abortSignal(),
      }),
    ).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'stale-snapshot',
    );
    await expect(
      providerFor(() => undefined).openSnapshot({
        workspaceId: WORKSPACE_ID,
        signal: abortSignal(),
      }),
    ).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'compiler-unavailable',
    );
  });

  it('advertises strict source reads only for a complete matching authorized capture', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const noSource = await providerFor(() => snapshot).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(noSource.descriptor.capabilities).toEqual([
      'list-index',
      'search-index',
      'read-bundle',
    ]);

    const matching = await providerFor(
      () => snapshot,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(matching.descriptor.capabilities).toContain('read-source');

    const wrongWorkspace = await providerFor(
      () => snapshot,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: 'different-review-workspace',
      signal: abortSignal(),
    });
    expect(wrongWorkspace.descriptor.capabilities).not.toContain('read-source');
    expect(
      await wrongWorkspace.readSource({ sourceId: 'SRC-UNITS' }, abortSignal()),
    ).toMatchObject({
      status: 'unauthorized',
      error: { code: 'source-workspace-mismatch' },
    });

    const base = neutralLibrary();
    const oversizedReferences = Array.from({ length: 25 }, (_value, index) =>
      sourceReference({ id: `SRC-${index}` }),
    );
    const oversized = captureArgumentLibrarySnapshot({
      ...base,
      axioms: base.axioms.map((axiom) => ({
        ...axiom,
        sourceReferences: oversizedReferences,
      })),
    });
    const limited = await providerFor(
      () => oversized,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(limited.descriptor.capabilities).not.toContain('read-source');
    expect(
      await limited.readSource({ sourceId: 'SRC-0' }, abortSignal()),
    ).toMatchObject({ status: 'limit-exceeded' });

    const perFileLimited = await providerFor(
      () => snapshot,
      sourceAccess(
        'x'.repeat(ARGUMENT_SOURCE_CAPTURE_LIMITS.perFileCharacters + 1),
      ),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(perFileLimited.descriptor.capabilities).not.toContain('read-source');
    expect(
      await perFileLimited.readSource({ sourceId: 'SRC-UNITS' }, abortSignal()),
    ).toMatchObject({
      status: 'limit-exceeded',
      error: { code: 'source-capture-limit-exceeded' },
    });
  });

  it('maps list/search pages and receipts, while rejecting unsupported filters', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const session = await providerFor(() => snapshot).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    const listed = await session.listIndex({ limit: 2 }, abortSignal());
    expect(listed.status).toBe('ok');
    const listContent = content<{
      items: Array<{
        id: string;
        kind: string;
        revision: number;
        topicIds: string[];
        matchedFields: string[];
      }>;
      nextCursor: string;
      receipt: { operation: string; returnedRecords: unknown[] };
    }>(listed.content);
    expect(listContent.items).toHaveLength(2);
    expect(listContent.items).toContainEqual(
      expect.objectContaining({
        id: 'AX-NEUTRAL',
        kind: 'axiom',
        topicIds: ['T-NEUTRAL'],
        matchedFields: [],
      }),
    );
    expect(listContent.items[0]).toMatchObject({
      topicIds: ['T-NEUTRAL'],
      matchedFields: [],
    });
    expect(listContent.nextCursor).toBeTruthy();
    expect(listContent.receipt.operation).toBe('list-index');
    expect(listed.references).toEqual(
      listContent.receipt.returnedRecords.map((record) => {
        const identity = record as { id: string; revision: number };
        return {
          canonicalId: identity.id,
          revision: String(identity.revision),
        };
      }),
    );
    const nextPage = await session.listIndex(
      { cursor: listContent.nextCursor, limit: 2 },
      abortSignal(),
    );
    expect(JSON.stringify(nextPage.content)).toContain('T-NEUTRAL');

    const searched = await session.searchIndex(
      { query: 'contradiction', limit: 5 },
      abortSignal(),
    );
    const searchContent = content<{
      items: Array<{
        id: string;
        score: number;
        matchedFields: string[];
        topicIds: string[];
      }>;
      receipt: { operation: string };
    }>(searched.content);
    expect(searched.status).toBe('ok');
    expect(searchContent.items[0]).toMatchObject({
      id: 'CA-NEUTRAL',
      topicIds: ['T-NEUTRAL'],
    });
    expect(searchContent.items[0]!.score).toBeGreaterThan(0);
    expect(searchContent.items[0]!.matchedFields).toContain('keywords');
    expect(searchContent.receipt.operation).toBe('search-index');

    expect(
      await session.searchIndex(
        { query: 'units', filter: 'axiom', limit: 5 },
        abortSignal(),
      ),
    ).toMatchObject({
      status: 'invalid-request',
      error: { code: 'unsupported-search-filter' },
    });
  });

  it('returns the full neutral argument closure plus readable Markdown without a verdict', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const session = await providerFor(() => snapshot).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    const result = await session.readBundle(
      { id: 'CA-NEUTRAL' },
      abortSignal(),
    );
    expect(result.status).toBe('ok');
    expect(result.completeness).toBe('complete');
    const value = content<{
      bundle: {
        counterArguments: Array<{
          observation: string;
          challengedClaim: string;
          target: { kind: string; topicId: string };
          response: {
            answeringAxioms: Array<{
              axiomId: string;
              reliedOnRevision: number;
            }>;
            explanation: string;
            outcome: string;
            boundary: string;
            reopeningCondition: string;
          };
          responseStale: boolean;
          staleAxiomIds: string[];
        }>;
        completeness: { status: string; theorySources: string };
        receipt: { operation: string };
      };
      markdown: string;
    }>(result.content);
    const counter = value.bundle.counterArguments[0]!;
    expect(counter).toMatchObject({
      observation: 'A length and duration can have different numeric values.',
      challengedClaim: 'Any unequal measurements contradict each other.',
      target: { kind: 'topic-claim', topicId: 'T-NEUTRAL' },
      responseStale: false,
      staleAxiomIds: [],
    });
    expect(counter.response).toMatchObject({
      answeringAxioms: [
        expect.objectContaining({
          axiomId: 'AX-NEUTRAL',
          reliedOnRevision: expect.any(Number),
        }),
      ],
      explanation:
        'The comparison establishes no contradiction until units and scope agree.',
      outcome: 'inapplicable-under-stated-scope',
      boundary: 'The observations remain valid individually.',
      reopeningCondition:
        'Reopen if the quantities are shown to use compatible units.',
    });
    expect(value.bundle.completeness).toMatchObject({
      status: 'complete',
      theorySources: 'not-read',
    });
    expect(value.bundle.receipt.operation).toBe('read-argument-bundle');
    expect(value.markdown).toContain('Observation / example / argument');
    expect(value.markdown).toContain('Current outcome');
    expect(value.markdown).not.toContain('AI verdict');
    expect(
      await session.readBundle({ id: 'NOT-PRESENT' }, abortSignal()),
    ).toMatchObject({
      status: 'not-found',
      error: { code: 'record-not-found' },
    });
  });

  it('preserves an explicit core receipt when a complete bundle exceeds limits', async () => {
    const clock = runtime('bundle-limit');
    let library = neutralLibrary();
    for (let index = 0; index < 100; index += 1) {
      const id = `AX-LIMIT-${index}`;
      library = createAxiom(
        library,
        {
          id,
          title: `Limit Axiom ${index}`,
          statement: `Synthetic bounded statement ${index}.`,
        },
        clock,
      );
      library = attachAnsweringAxiom(library, 'CA-NEUTRAL', id, clock);
    }
    const snapshot = captureArgumentLibrarySnapshot(library);
    const session = await providerFor(() => snapshot).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    const result = await session.readBundle(
      { id: 'CA-NEUTRAL' },
      abortSignal(),
    );
    expect(result).toMatchObject({
      status: 'limit-exceeded',
      completeness: 'incomplete',
      freshness: 'retained',
      error: { code: 'bundle-limit-exceeded' },
    });
    expect(JSON.stringify(result.content)).toContain('read-argument-bundle');
    expect(result.omissions).not.toHaveLength(0);
  });

  it('reads only the exact recorded source version and retains source evidence', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const access = sourceAccess();
    const session = await providerFor(() => snapshot, access).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    const exact = await session.readSource(
      { sourceId: 'SRC-UNITS' },
      abortSignal(),
    );
    expect(exact.status).toBe('ok');
    const exactContent = content<{
      owner: { kind: string; id: string; revision: number };
      source: {
        sourceReferenceId: string;
        text: string;
        sourceVersion: string;
        freshness: string;
        contentFingerprint: { value: string };
        location: { path: string; heading: string };
        receipt: {
          operation: string;
          returnedRecords: Array<{ id: string; revision: number }>;
          sourceObservations: Array<{ sourceVersion: string }>;
        };
      };
    }>(exact.content);
    expect(exactContent.owner).toMatchObject({
      kind: 'axiom',
      id: 'AX-NEUTRAL',
    });
    expect(exactContent.source).toMatchObject({
      sourceReferenceId: 'SRC-UNITS',
      text: SOURCE_TEXT,
      sourceVersion: SOURCE_VERSION,
      freshness: 'matches-recorded-version',
      location: { path: 'Theory/Measurement.md', heading: 'Units' },
    });
    expect(exactContent.source.contentFingerprint.value).toMatch(
      /^[a-f0-9]{64}$/u,
    );
    expect(exactContent.source.receipt.operation).toBe(
      'read-linked-theory-source',
    );
    expect(
      exactContent.source.receipt.sourceObservations[0]?.sourceVersion,
    ).toBe(SOURCE_VERSION);
    expect(exact.references).toContainEqual({
      canonicalId: 'SRC-UNITS',
      revision: SOURCE_VERSION,
      sourceHeading: 'Units',
    });

    access.publishCommittedSource({
      sourceSessionId: 'source-session',
      sourceSpaceId: WORKSPACE_ID,
      displayName: 'Neutral source',
      acquisition: 'live',
      acquisitionState: 'ready',
      runtimeRevision: 2,
      observedAt: '2026-09-13T10:01:00.000Z',
      inventory: {
        markdownDocuments: [
          {
            path: 'Theory/Measurement.md',
            source: '# Units\nA later incompatible source body.\n',
          },
        ],
        nonMarkdownPaths: [],
      },
    });
    const pinned = await session.readSource(
      { sourceId: 'SRC-UNITS' },
      abortSignal(),
    );
    expect(pinned).toEqual(exact);
    const laterSession = await providerFor(() => snapshot, access).openSnapshot(
      {
        workspaceId: WORKSPACE_ID,
        signal: abortSignal(),
      },
    );
    const unavailable = await laterSession.readSource(
      { sourceId: 'SRC-UNITS' },
      abortSignal(),
    );
    expect(unavailable).toMatchObject({
      status: 'source-unavailable',
      freshness: 'stale',
      error: { code: 'source-version-unavailable' },
    });
    expect(JSON.stringify(unavailable.content)).not.toContain(
      'A later incompatible source body.',
    );
  });

  it('keeps missing versions and unresolved headings explicitly unavailable', async () => {
    const noVersion = captureArgumentLibrarySnapshot(
      neutralLibrary(
        sourceReference({
          recordedVersion: { fingerprintScope: 'file' },
        }),
      ),
    );
    const noVersionSession = await providerFor(
      () => noVersion,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(
      await noVersionSession.readSource(
        { sourceId: 'SRC-UNITS' },
        abortSignal(),
      ),
    ).toMatchObject({
      status: 'source-unavailable',
      freshness: 'stale',
      error: { code: 'source-version-unavailable' },
    });

    const unresolved = captureArgumentLibrarySnapshot(
      neutralLibrary(sourceReference({ heading: 'Renamed heading' })),
    );
    const unresolvedSession = await providerFor(
      () => unresolved,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(
      await unresolvedSession.readSource(
        { sourceId: 'SRC-UNITS' },
        abortSignal(),
      ),
    ).toMatchObject({
      status: 'source-unavailable',
      error: { code: 'source-heading-unresolved' },
    });

    const missingSession = await providerFor(
      () => captureArgumentLibrarySnapshot(neutralLibrary()),
      sourceAccess(SOURCE_TEXT, WORKSPACE_ID, 'Theory/Other.md'),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(
      await missingSession.readSource({ sourceId: 'SRC-UNITS' }, abortSignal()),
    ).toMatchObject({
      status: 'source-unavailable',
      error: { code: 'source-source-missing' },
    });

    const wrongBinding = captureArgumentLibrarySnapshot(
      neutralLibrary(sourceReference({ sourceSpaceHint: 'other-space' })),
    );
    const wrongBindingSession = await providerFor(
      () => wrongBinding,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(wrongBindingSession.descriptor.capabilities).toContain(
      'read-source',
    );
    expect(
      await wrongBindingSession.readSource(
        { sourceId: 'SRC-UNITS' },
        abortSignal(),
      ),
    ).toMatchObject({
      status: 'unauthorized',
      error: { code: 'source-wrong-binding' },
    });
  });

  it('checks cancellation before work and after an awaited source read', async () => {
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const controller = new AbortController();
    controller.abort();
    await expect(
      providerFor(() => snapshot).openSnapshot({
        workspaceId: WORKSPACE_ID,
        signal: controller.signal,
      }),
    ).rejects.toSatisfy((error: unknown) => errorCode(error) === 'cancelled');

    const session = await providerFor(
      () => snapshot,
      sourceAccess(),
    ).openSnapshot({
      workspaceId: WORKSPACE_ID,
      signal: abortSignal(),
    });
    expect(
      await session.listIndex({ limit: 5 }, controller.signal),
    ).toMatchObject({ status: 'cancelled' });
    const sourceController = new AbortController();
    const pending = session.readSource(
      { sourceId: 'SRC-UNITS' },
      sourceController.signal,
    );
    sourceController.abort();
    expect(await pending).toMatchObject({ status: 'cancelled' });
  });
});

function reviewInput(
  compiler: NonNullable<StartReviewInput['compiler']>,
): StartReviewInput {
  return {
    workspaceId: WORKSPACE_ID,
    source: {
      mode: 'supplied-material',
      selectedPaths: ['review.md'],
      materials: [
        {
          id: 'review-material',
          relativePath: 'review.md',
          kind: 'source',
          content: '# Neutral review material',
          provenance: { kind: 'supplied', label: 'adapter test' },
        },
      ],
      completeness: 'complete',
      missingMaterial: [],
      omissions: [],
    },
    additionalRequest: 'Review the neutral supplied material.',
    models: {
      analysis: { provider: 'scripted', model: 'analysis' },
      integrator: { provider: 'scripted', model: 'integrator' },
      postCheck: { provider: 'scripted', model: 'post-check' },
    },
    compiler,
  };
}

function integration(prefix: string): IntegrationResultInput {
  return {
    schemaVersion: 1,
    summary: 'Neutral integration.',
    issues: [
      {
        id: 'neutral-issue',
        relation: 'compatible',
        negativeReferences: [
          {
            attemptId: `${prefix}-attempt-1`,
            quote: 'negative complete',
          },
        ],
        positiveReferences: [
          {
            attemptId: `${prefix}-attempt-2`,
            quote: 'positive complete',
          },
        ],
        negativeContribution: 'Neutral negative contribution.',
        positiveContribution: 'Neutral positive contribution.',
        integrationMarkdown: 'The contributions are compatible.',
        unresolvedPoints: [],
        integratorNotes: [],
      },
    ],
    unresolvedQuestions: [],
  };
}

function postCheck(): PostCheckResultInput {
  return {
    schemaVersion: 1,
    summary: 'Neutral post-check.',
    findings: [],
  };
}

function terminal(
  stage: 'negative' | 'positive' | 'integrator' | 'post-check',
  prefix: string,
): ScriptedStep {
  return {
    type: 'terminal',
    status: 'completed',
    rawText: `${stage} complete`,
    ...(stage === 'integrator'
      ? { structured: integration(prefix) }
      : stage === 'post-check'
        ? { structured: postCheck() }
        : {}),
  };
}

function attempt(run: ReviewRunRecord, stage: ReviewStage) {
  const id = run.currentAttemptIds[stage];
  return run.attempts.find((candidate) => candidate.id === id)!;
}

describe('ReviewEngine with the real Argument adapter', () => {
  it('uses search and bundle reads only at Integrator when analysis is disabled', async () => {
    const agent = new ScriptedAgentProvider({
      negative: [[terminal('negative', 'integrator-only')]],
      positive: [[terminal('positive', 'integrator-only')]],
      integrator: [
        [
          {
            type: 'tool',
            toolCallId: 'integrator-search',
            name: 'compiler_search_index',
            arguments: { query: 'contradiction', limit: 5 },
          },
          {
            type: 'tool',
            toolCallId: 'integrator-read',
            name: 'compiler_read_bundle',
            arguments: { id: 'CA-NEUTRAL' },
          },
          terminal('integrator', 'integrator-only'),
        ],
      ],
    });
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const engine = new ReviewEngine({
      provider: agent,
      compilerProvider: providerFor(() => snapshot),
      ids: createSequentialIdGenerator('integrator-only'),
    });
    const run = await (
      await engine.start(
        reviewInput({ analysis: false, integrator: true, postCheck: false }),
      )
    ).completion;

    expect(run.state).toBe('completed');
    expect(attempt(run, 'negative').toolCalls).toHaveLength(0);
    expect(attempt(run, 'positive').toolCalls).toHaveLength(0);
    expect(attempt(run, 'integrator').toolCalls).toHaveLength(2);
    expect(
      agent.startedRequests.find(({ stage }) => stage === 'negative')?.tools,
    ).toEqual([]);
    expect(
      agent.contexts
        .find(({ stage }) => stage === 'integrator')
        ?.toolResults.map(({ result }) => result.status),
    ).toEqual(['ok', 'ok']);
  });

  it('gives negative and positive separate retrieval histories when only analysis is enabled', async () => {
    const agent = new ScriptedAgentProvider({
      negative: [
        [
          {
            type: 'tool',
            toolCallId: 'negative-search',
            name: 'compiler_search_index',
            arguments: { query: 'measurement', limit: 5 },
          },
          terminal('negative', 'analysis-only'),
        ],
      ],
      positive: [
        [
          {
            type: 'tool',
            toolCallId: 'positive-search',
            name: 'compiler_search_index',
            arguments: { query: 'units', limit: 5 },
          },
          terminal('positive', 'analysis-only'),
        ],
      ],
      integrator: [[terminal('integrator', 'analysis-only')]],
    });
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const run = await (
      await new ReviewEngine({
        provider: agent,
        compilerProvider: providerFor(() => snapshot),
        ids: createSequentialIdGenerator('analysis-only'),
      }).start(
        reviewInput({ analysis: true, integrator: false, postCheck: false }),
      )
    ).completion;

    expect(run.state).toBe('completed');
    expect(attempt(run, 'negative').toolCalls).toHaveLength(1);
    expect(attempt(run, 'positive').toolCalls).toHaveLength(1);
    expect(attempt(run, 'integrator').toolCalls).toHaveLength(0);
    const negative = agent.contexts.find(({ stage }) => stage === 'negative')!;
    const positive = agent.contexts.find(({ stage }) => stage === 'positive')!;
    expect(negative.contextId).not.toBe(positive.contextId);
    expect(negative.toolResults).not.toBe(positive.toolResults);
    expect(negative.toolResults[0]?.toolCallId).toBe('negative-search');
    expect(positive.toolResults[0]?.toolCallId).toBe('positive-search');
  });

  it('uses the same stage-agnostic adapter for a separate post-check', async () => {
    const agent = new ScriptedAgentProvider({
      negative: [[terminal('negative', 'post-check')]],
      positive: [[terminal('positive', 'post-check')]],
      integrator: [[terminal('integrator', 'post-check')]],
      'post-check': [
        [
          {
            type: 'tool',
            toolCallId: 'post-check-source',
            name: 'compiler_read_source',
            arguments: { sourceId: 'SRC-UNITS' },
          },
          terminal('post-check', 'post-check'),
        ],
      ],
    });
    const snapshot = captureArgumentLibrarySnapshot(neutralLibrary());
    const run = await (
      await new ReviewEngine({
        provider: agent,
        compilerProvider: providerFor(() => snapshot, sourceAccess()),
        ids: createSequentialIdGenerator('post-check'),
      }).start(
        reviewInput({ analysis: false, integrator: false, postCheck: true }),
      )
    ).completion;

    expect(run.state).toBe('completed');
    expect(attempt(run, 'negative').toolCalls).toHaveLength(0);
    expect(attempt(run, 'positive').toolCalls).toHaveLength(0);
    expect(attempt(run, 'integrator').toolCalls).toHaveLength(0);
    expect(attempt(run, 'post-check').toolCalls).toHaveLength(1);
    expect(
      agent.contexts.find(({ stage }) => stage === 'post-check')?.toolResults[0]
        ?.result,
    ).toMatchObject({ status: 'ok' });
  });
});
