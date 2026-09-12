import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot } from './canonical';
import {
  attachAnsweringAxiom,
  createAxiom,
  createCounterArgument,
  createTopic,
  detachAnsweringAxiom,
  editAxiom,
  editCounterArgument,
  editTopic,
  responseStaleness,
  setRecordArchived,
  setRecordReviewState,
  setTopicMembership,
  updateCounterArgumentResponse,
} from './library';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import { validateArgumentLibrary } from './validation';

describe('Argument Library domain operations', () => {
  it('creates and edits all record kinds without changing stable IDs', () => {
    const runtime = deterministicRuntime('edit');
    let library = createNeutralArgumentLibrary();
    const beforeRevision = library.libraryRevision;
    const topicRevision = library.topics[0]!.revision;
    const axiomRevision = library.axioms[0]!.revision;
    const counterRevision = library.counterArguments[0]!.revision;
    library = editTopic(
      library,
      'T-NEUTRAL',
      { title: 'Renamed topic' },
      runtime,
    );
    library = editAxiom(
      library,
      'AX-NEUTRAL',
      { title: 'Renamed axiom' },
      runtime,
    );
    library = editCounterArgument(
      library,
      'CA-NEUTRAL',
      { title: 'Renamed objection' },
      runtime,
    );

    expect(library.libraryRevision).toBe(beforeRevision + 3);
    expect(library.topics[0]).toMatchObject({
      id: 'T-NEUTRAL',
      title: 'Renamed topic',
      revision: topicRevision + 1,
    });
    expect(library.axioms[0]).toMatchObject({
      id: 'AX-NEUTRAL',
      title: 'Renamed axiom',
      revision: axiomRevision + 1,
    });
    expect(library.counterArguments[0]).toMatchObject({
      id: 'CA-NEUTRAL',
      title: 'Renamed objection',
      revision: counterRevision + 1,
    });
    expect(validateArgumentLibrary(library).valid).toBe(true);
  });

  it('reuses shared Axioms and removes membership without deleting records', () => {
    const runtime = deterministicRuntime('membership');
    let library = createNeutralArgumentLibrary();
    library = createTopic(
      library,
      {
        id: 'T-SECOND',
        title: 'Second context',
        summary: 'Another retrieval context.',
      },
      runtime,
    );
    library = setTopicMembership(
      library,
      'T-SECOND',
      'axiom',
      'AX-NEUTRAL',
      true,
      runtime,
    );
    library = setTopicMembership(
      library,
      'T-NEUTRAL',
      'axiom',
      'AX-NEUTRAL',
      false,
      runtime,
    );

    expect(library.axioms.map(({ id }) => id)).toEqual(['AX-NEUTRAL']);
    expect(
      library.topics.find(({ id }) => id === 'T-NEUTRAL')?.axiomIds,
    ).toEqual([]);
    expect(
      library.topics.find(({ id }) => id === 'T-SECOND')?.axiomIds,
    ).toEqual(['AX-NEUTRAL']);
  });

  it('supports Counter-Argument targets, rejects self/broken targets, and validates cycles', () => {
    const runtime = deterministicRuntime('target');
    let library = createNeutralArgumentLibrary();
    library = createCounterArgument(
      library,
      {
        id: 'CA-SECOND',
        title: 'Challenge the response',
        observation: 'The units may already have been normalized.',
        challengedClaim: 'The recorded response always applies.',
        target: { kind: 'counter-argument', counterArgumentId: 'CA-NEUTRAL' },
      },
      runtime,
    );
    expect(validateArgumentLibrary(library).valid).toBe(true);
    expect(() =>
      editCounterArgument(
        library,
        'CA-SECOND',
        {
          target: { kind: 'counter-argument', counterArgumentId: 'CA-SECOND' },
        },
        runtime,
      ),
    ).toThrow(/cannot target itself/i);
    expect(() =>
      editCounterArgument(
        library,
        'CA-SECOND',
        { target: { kind: 'axiom', axiomId: 'AX-MISSING' } },
        runtime,
      ),
    ).toThrow(/unknown target/i);

    library = editCounterArgument(
      library,
      'CA-NEUTRAL',
      { target: { kind: 'counter-argument', counterArgumentId: 'CA-SECOND' } },
      runtime,
    );
    expect(validateArgumentLibrary(library).valid).toBe(true);
  });

  it('keeps archive, human review, outcome, and response revision changes distinct', () => {
    const runtime = deterministicRuntime('states');
    let library = createNeutralArgumentLibrary();
    const before = library.counterArguments[0]!;
    library = setRecordArchived(
      library,
      'counter-argument',
      before.id,
      true,
      runtime,
    );
    library = setRecordArchived(
      library,
      'counter-argument',
      before.id,
      false,
      runtime,
    );
    library = setRecordReviewState(
      library,
      'counter-argument',
      before.id,
      'reopened',
      runtime,
    );
    library = updateCounterArgumentResponse(
      library,
      before.id,
      { outcome: 'standing', explanation: 'A revised recorded assessment.' },
      runtime,
    );
    const after = library.counterArguments[0]!;
    expect(after).toMatchObject({
      archived: false,
      reviewState: 'reopened',
      response: { outcome: 'standing' },
      revision: before.revision + 4,
    });
  });

  it('marks a response stale after an Axiom edit without changing its recorded outcome', () => {
    const runtime = deterministicRuntime('stale');
    let library = createNeutralArgumentLibrary();
    const before = library.counterArguments[0]!;
    expect(responseStaleness(library, before)).toEqual({
      stale: false,
      axiomIds: [],
    });
    library = editAxiom(
      library,
      'AX-NEUTRAL',
      {
        statement:
          'Compatible units and scope are required for direct comparison.',
      },
      runtime,
    );
    const after = library.counterArguments[0]!;
    expect(responseStaleness(library, after)).toEqual({
      stale: true,
      axiomIds: ['AX-NEUTRAL'],
    });
    expect(after.response.outcome).toBe(before.response.outcome);
    const refreshed = detachAnsweringAxiom(
      library,
      after.id,
      'AX-NEUTRAL',
      runtime,
    );
    const reattached = attachAnsweringAxiom(
      refreshed,
      after.id,
      'AX-NEUTRAL',
      runtime,
    );
    expect(
      responseStaleness(reattached, reattached.counterArguments[0]!),
    ).toEqual({
      stale: false,
      axiomIds: [],
    });
  });

  it('changes snapshot identity for response, status, and membership edits', () => {
    const runtime = deterministicRuntime('fingerprint');
    const first = createNeutralArgumentLibrary();
    const descriptors = [captureArgumentLibrarySnapshot(first).descriptor];
    const second = updateCounterArgumentResponse(
      first,
      'CA-NEUTRAL',
      { outcome: 'standing' },
      runtime,
    );
    descriptors.push(captureArgumentLibrarySnapshot(second).descriptor);
    const third = setRecordReviewState(
      second,
      'axiom',
      'AX-NEUTRAL',
      'reopened',
      runtime,
    );
    descriptors.push(captureArgumentLibrarySnapshot(third).descriptor);
    const fourth = setTopicMembership(
      third,
      'T-NEUTRAL',
      'axiom',
      'AX-NEUTRAL',
      false,
      runtime,
    );
    descriptors.push(captureArgumentLibrarySnapshot(fourth).descriptor);
    expect(
      new Set(
        descriptors.map(({ contentFingerprint }) => contentFingerprint.value),
      ),
    ).toHaveLength(4);
    expect(descriptors.map(({ libraryRevision }) => libraryRevision)).toEqual([
      first.libraryRevision,
      first.libraryRevision + 1,
      first.libraryRevision + 2,
      first.libraryRevision + 3,
    ]);
  });

  it('creates additional neutral Axioms with source references through ordinary APIs', () => {
    const runtime = deterministicRuntime('create');
    const library = createAxiom(
      createNeutralArgumentLibrary(),
      {
        id: 'AX-TWO',
        title: 'Second axiom',
        statement: 'A second neutral premise.',
      },
      runtime,
    );
    expect(library.axioms.map(({ id }) => id)).toEqual([
      'AX-NEUTRAL',
      'AX-TWO',
    ]);
  });
});
