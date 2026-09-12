import { describe, expect, it } from 'vitest';

import {
  attachAnsweringAxiom,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  editAxiom,
  sameSnapshot,
  serializeArgumentLibrary,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentLibrary,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

import {
  ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY,
  createBrowserArgumentLibraryStore,
} from '../../persistence/argument-library';
import {
  ArgumentWorkspaceSession,
  type CounterArgumentRecordDraft,
} from './session';

function runtime(prefix: string): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `${prefix}-${kind}-${++id}`,
    now: () => `2026-02-01T00:00:${String(second++).padStart(2, '0')}.000Z`,
  };
}

function neutralLibrary(): ArgumentLibrary {
  const clock = runtime('fixture');
  let library = createEmptyArgumentLibrary(clock, 'library-overlay-neutral');
  library = createTopic(
    library,
    {
      id: 'T-ONE',
      title: 'Comparison rules',
      summary: 'A neutral test topic.',
    },
    clock,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-ONE',
      title: 'Use common units',
      statement: 'A comparison requires compatible units.',
    },
    clock,
  );
  library = createCounterArgument(
    library,
    {
      id: 'CA-ONE',
      title: 'Numeric mismatch',
      observation: '3.14... differs from 180.',
      challengedClaim: 'Different numerals alone establish a contradiction.',
      target: { kind: 'topic-claim', topicId: 'T-ONE' },
    },
    clock,
  );
  library = attachAnsweringAxiom(library, 'CA-ONE', 'AX-ONE', clock);
  library = updateCounterArgumentResponse(
    library,
    'CA-ONE',
    {
      explanation: 'The quantities must first use compatible units.',
      outcome: 'inapplicable-under-stated-scope',
    },
    clock,
  );
  library = setTopicMembership(
    library,
    'T-ONE',
    'axiom',
    'AX-ONE',
    true,
    clock,
  );
  return setTopicMembership(
    library,
    'T-ONE',
    'counter-argument',
    'CA-ONE',
    true,
    clock,
  );
}

function harness(initial?: ArgumentLibrary) {
  const values = new Map<string, string>();
  if (initial !== undefined) {
    values.set(
      ARGUMENT_LIBRARY_BROWSER_STORAGE_KEY,
      serializeArgumentLibrary(initial),
    );
  }
  let writes = 0;
  let failWrites = false;
  const store = createBrowserArgumentLibraryStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => {
      if (failWrites) throw new Error('quota exhausted');
      writes += 1;
      values.set(key, value);
    },
  });
  const session = new ArgumentWorkspaceSession(store, runtime('session'));
  return {
    session,
    values,
    writes: () => writes,
    fail: () => {
      failWrites = true;
    },
  };
}

function draft(
  session: ArgumentWorkspaceSession,
  title = 'Second objection',
): CounterArgumentRecordDraft {
  const state = session.state();
  if (state.phase !== 'ready') throw new Error('Session not ready.');
  return {
    kind: 'counter-argument',
    mode: 'create',
    id: 'CA-TWO',
    expected: state.snapshot.descriptor,
    title,
    observation: 'A second neutral observation.',
    challengedClaim: 'A second neutral claim.',
    retrieval: { aliases: [], keywords: ['second'], phrases: [] },
    sourceReferences: [],
    answeringAxiomIds: ['AX-ONE'],
    responseExplanation: 'The existing shared Axiom answers this observation.',
    outcome: 'refuted',
    reviewState: 'draft',
    topicIds: ['T-ONE'],
  };
}

describe('Argument Workspace application session', () => {
  it('keeps one Save atomic across record, response, answer, and Topic membership', async () => {
    const host = harness(neutralLibrary());
    await Promise.all([host.session.open(), host.session.open()]);
    expect(host.writes()).toBe(0);

    const result = await host.session.save(draft(host.session));

    expect(result.status).toBe('ok');
    expect(host.writes()).toBe(1);
    const state = host.session.state();
    expect(state.phase).toBe('ready');
    if (state.phase !== 'ready') return;
    const saved = state.snapshot.library.counterArguments.find(
      ({ id }) => id === 'CA-TWO',
    )!;
    expect(saved.response).toMatchObject({
      answeringAxioms: [{ axiomId: 'AX-ONE' }],
      explanation: 'The existing shared Axiom answers this observation.',
      outcome: 'refuted',
    });
    expect(state.snapshot.library.topics[0]!.counterArgumentIds).toContain(
      'CA-TWO',
    );
  });

  it('keeps the confirmed snapshot and immutable L1 reader after a failed or later L2 save', async () => {
    const host = harness(neutralLibrary());
    await host.session.open();
    const opened = host.session.state();
    if (opened.phase !== 'ready') throw new Error('Session not ready.');
    const l1Reader = opened.reader;
    const l1Descriptor = opened.snapshot.descriptor;

    const saved = await host.session.save(draft(host.session));
    expect(saved.status).toBe('ok');
    const l2 = host.session.state();
    if (l2.phase !== 'ready') throw new Error('Session not ready.');
    expect(sameSnapshot(l1Reader.snapshot, l1Descriptor)).toBe(true);
    expect(l1Reader.searchIndex({ query: 'Second objection' })).toMatchObject({
      status: 'ok',
      value: { candidates: [] },
    });
    expect(l2.reader.searchIndex({ query: 'Second objection' })).toMatchObject({
      status: 'ok',
      value: { candidates: [{ id: 'CA-TWO' }] },
    });

    host.fail();
    const failedDraft = {
      ...draft(host.session, 'Third objection'),
      id: 'CA-THREE',
    };
    const failed = await host.session.save(failedDraft);
    expect(failed).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/quota exhausted/i),
    });
    const afterFailure = host.session.state();
    expect(afterFailure.phase).toBe('ready');
    if (afterFailure.phase === 'ready') {
      expect(afterFailure.snapshot.descriptor).toEqual(l2.snapshot.descriptor);
      expect(afterFailure.snapshot.library.counterArguments).toHaveLength(2);
    }
  });

  it('flags Axiom changes without changing outcome and only refreshes revisions on explicit reassessment', async () => {
    const host = harness(neutralLibrary());
    await host.session.open();
    const first = host.session.state();
    if (first.phase !== 'ready') throw new Error('Session not ready.');
    const before = first.snapshot.library.counterArguments[0]!;
    const changed = await host.session.save({
      kind: 'axiom',
      mode: 'edit',
      id: 'AX-ONE',
      expected: first.snapshot.descriptor,
      title: 'Use common units',
      statement: 'Direct comparison requires explicitly compatible units.',
      retrieval: first.snapshot.library.axioms[0]!.retrieval,
      sourceReferences: [],
      reviewState: first.snapshot.library.axioms[0]!.reviewState,
      topicIds: ['T-ONE'],
    });
    expect(changed.status).toBe('ok');
    const second = host.session.state();
    if (second.phase !== 'ready') throw new Error('Session not ready.');
    const staleBundle = second.reader.readArgumentBundle({
      id: 'CA-ONE',
      kind: 'counter-argument',
    });
    expect(staleBundle).toMatchObject({
      status: 'ok',
      value: { counterArguments: [{ responseStale: true }] },
    });
    expect(second.snapshot.library.counterArguments[0]!.response.outcome).toBe(
      before.response.outcome,
    );

    const reassessed = await host.session.reassessResponse(
      second.snapshot.descriptor,
      'CA-ONE',
    );
    expect(reassessed.status).toBe('ok');
    const third = host.session.state();
    if (third.phase !== 'ready') throw new Error('Session not ready.');
    expect(third.snapshot.library.counterArguments[0]!.response).toMatchObject({
      explanation: before.response.explanation,
      outcome: before.response.outcome,
      answeringAxioms: [
        { reliedOnRevision: third.snapshot.library.axioms[0]!.revision },
      ],
    });
  });

  it('rejects stale drafts and stale import previews without overwriting confirmed data', async () => {
    const host = harness(neutralLibrary());
    await host.session.open();
    const staleDraft = draft(host.session);
    const importSource = serializeArgumentLibrary(
      editAxiom(
        neutralLibrary(),
        'AX-ONE',
        { title: 'Imported title' },
        runtime('import'),
      ),
    );
    const preview = host.session.previewImport(importSource, 'replace');
    expect(preview.status).toBe('ok');

    expect((await host.session.save(staleDraft)).status).toBe('ok');
    expect(
      await host.session.save({ ...staleDraft, id: 'CA-THREE' }),
    ).toMatchObject({ status: 'conflict' });
    if (preview.status === 'ok') {
      expect(await host.session.commitImport(preview.plan)).toMatchObject({
        status: 'conflict',
        message: expect.stringMatching(/changed after the import preview/i),
      });
    }
  });

  it('distinguishes missing onboarding and initializes supplied JSON only after an explicit call', async () => {
    const host = harness();
    await host.session.open();
    expect(host.session.state()).toEqual({ phase: 'missing', busy: false });
    expect(host.writes()).toBe(0);

    const result = await host.session.initializeJson(
      serializeArgumentLibrary(neutralLibrary()),
    );
    expect(result.status).toBe('ok');
    expect(host.writes()).toBe(1);
    expect(host.session.state()).toMatchObject({
      phase: 'ready',
      snapshot: { library: { libraryId: 'library-overlay-neutral' } },
    });
  });
});
