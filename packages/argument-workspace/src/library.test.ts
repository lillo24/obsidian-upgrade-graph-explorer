import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot, clonePlainData } from './canonical';
import {
  argumentStaleness,
  createAxiom,
  createArgument,
  createCounterArgument,
  createTopic,
  editAxiom,
  editArgument,
  editCounterArgument,
  editTopic,
  promoteArgumentToCurrent,
  reassessArgumentPremises,
  reassessCounterArgumentResponse,
  recordTheorySourceVersion,
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
  it('records only a confirmed full-file source baseline and leaves verdicts untouched', () => {
    const runtime = deterministicRuntime('source-baseline');
    const before = createNeutralArgumentLibrary();
    const outcome = before.counterArguments[0]!.response.outcome;
    const reviewState = before.axioms[0]!.reviewState;
    const next = recordTheorySourceVersion(
      before,
      {
        recordKind: 'axiom',
        recordId: 'AX-NEUTRAL',
        sourceReferenceId: 'SRC-NEUTRAL',
        sourceSpaceId: 'authorized-space',
        sourceVersion: 'full-file:v2',
      },
      runtime,
    );

    expect(next.axioms[0]!.sourceReferences[0]).toMatchObject({
      id: 'SRC-NEUTRAL',
      sourceSpaceHint: 'authorized-space',
      recordedVersion: {
        sourceVersion: 'full-file:v2',
        fingerprintScope: 'file',
      },
    });
    expect(next.axioms[0]!.reviewState).toBe(reviewState);
    expect(next.counterArguments[0]!.response.outcome).toBe(outcome);
    expect(responseStaleness(next, next.counterArguments[0]!)).toMatchObject({
      stale: true,
      axiomIds: ['AX-NEUTRAL'],
    });
    expect(JSON.stringify(next)).not.toContain('source body');
  });

  it('rejects recording a baseline under an incompatible source-space hint', () => {
    expect(() =>
      recordTheorySourceVersion(
        createNeutralArgumentLibrary(),
        {
          recordKind: 'axiom',
          recordId: 'AX-NEUTRAL',
          sourceReferenceId: 'SRC-NEUTRAL',
          sourceSpaceId: 'different-space',
          sourceVersion: 'full-file:v2',
        },
        deterministicRuntime('wrong-source'),
      ),
    ).toThrow('different source space');
  });

  it('creates and edits all record kinds without changing stable IDs', () => {
    const runtime = deterministicRuntime('edit');
    let library = createNeutralArgumentLibrary();
    const beforeRevision = library.libraryRevision;
    const topicRevision = library.topics[0]!.revision;
    const axiomRevision = library.axioms[0]!.revision;
    const argumentRevision = library.arguments[0]!.revision;
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
    library = editArgument(
      library,
      'AR-NEUTRAL',
      { title: 'Renamed argument' },
      runtime,
    );
    library = editCounterArgument(
      library,
      'CA-NEUTRAL',
      { title: 'Renamed objection' },
      runtime,
    );

    expect(library.libraryRevision).toBe(beforeRevision + 4);
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
    expect(library.arguments[0]).toMatchObject({
      id: 'AR-NEUTRAL',
      title: 'Renamed argument',
      revision: argumentRevision + 1,
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
    const reattached = reassessCounterArgumentResponse(
      library,
      after.id,
      runtime,
    );
    expect(
      responseStaleness(reattached, reattached.counterArguments[0]!),
    ).toEqual({
      stale: false,
      axiomIds: [],
    });
    expect(reattached.counterArguments[0]!.response).toMatchObject({
      explanation: before.response.explanation,
      outcome: before.response.outcome,
      answeringAxioms: [
        {
          axiomId: 'AX-NEUTRAL',
          reliedOnRevision: library.axioms[0]!.revision,
        },
      ],
    });
  });

  it('marks referenced Argument premises stale and clears them only on explicit reassessment', () => {
    const runtime = deterministicRuntime('argument-stale');
    let library = createNeutralArgumentLibrary();
    library = createArgument(
      library,
      {
        id: 'AR-FOLLOWUP',
        title: 'Follow-up reasoning',
        premises: [
          {
            id: 'P-FOLLOWUP',
            kind: 'argument-conclusion',
            argumentId: 'AR-NEUTRAL',
            reliedOnRevision: library.arguments[0]!.revision,
          },
        ],
        conclusion: 'The earlier conclusion can be reused explicitly.',
      },
      runtime,
    );
    const original = library.arguments.find(({ id }) => id === 'AR-FOLLOWUP')!;
    library = editArgument(
      library,
      'AR-NEUTRAL',
      { conclusion: 'A revised compatible-units conclusion.' },
      runtime,
    );
    const stale = library.arguments.find(({ id }) => id === 'AR-FOLLOWUP')!;
    expect(argumentStaleness(library, stale)).toEqual({
      stale: true,
      premiseIds: ['P-FOLLOWUP'],
    });
    expect(stale.conclusion).toBe(original.conclusion);

    library = reassessArgumentPremises(library, 'AR-FOLLOWUP', runtime);
    const reassessed = library.arguments.find(
      ({ id }) => id === 'AR-FOLLOWUP',
    )!;
    expect(argumentStaleness(library, reassessed)).toEqual({
      stale: false,
      premiseIds: [],
    });
    expect(reassessed).toMatchObject({
      conclusion: original.conclusion,
      reviewState: original.reviewState,
    });
  });

  it('promotes only accepted Topic members and preserves the supersession chain', () => {
    const runtime = deterministicRuntime('promotion');
    let library = createNeutralArgumentLibrary();
    library = createArgument(
      library,
      {
        id: 'AR-NEXT',
        title: 'Replacement reasoning',
        premises: [],
        conclusion: 'A replacement conclusion.',
        reviewState: 'accepted',
      },
      runtime,
    );
    expect(() =>
      promoteArgumentToCurrent(library, 'T-NEUTRAL', 'AR-NEXT', runtime),
    ).toThrow(/must belong/i);
    library = setTopicMembership(
      library,
      'T-NEUTRAL',
      'argument',
      'AR-NEXT',
      true,
      runtime,
    );
    library = promoteArgumentToCurrent(
      library,
      'T-NEUTRAL',
      'AR-NEXT',
      runtime,
    );
    expect(library.topics[0]!.currentArgumentId).toBe('AR-NEXT');
    expect(library.arguments.find(({ id }) => id === 'AR-NEXT')).toMatchObject({
      supersedesArgumentId: 'AR-NEUTRAL',
    });
    expect(library.arguments.some(({ id }) => id === 'AR-NEUTRAL')).toBe(true);
    expect(() =>
      setRecordArchived(library, 'argument', 'AR-NEXT', true, runtime),
    ).toThrow(/current.*cannot be archived/i);
    expect(() =>
      setTopicMembership(
        library,
        'T-NEUTRAL',
        'argument',
        'AR-NEXT',
        false,
        runtime,
      ),
    ).toThrow(/current.*cannot be removed/i);
  });

  it('validates Argument target parts and rejects premise dependency cycles', () => {
    const runtime = deterministicRuntime('argument-target');
    let library = createCounterArgument(
      createNeutralArgumentLibrary(),
      {
        id: 'CA-PREMISE',
        title: 'Premise challenge',
        observation: 'The premise needs qualification.',
        challengedClaim: 'The premise applies without a boundary.',
        target: {
          kind: 'argument',
          argumentId: 'AR-NEUTRAL',
          part: { kind: 'premise', premiseId: 'P-NEUTRAL-TEXT' },
        },
      },
      runtime,
    );
    expect(validateArgumentLibrary(library).valid).toBe(true);
    expect(() =>
      editCounterArgument(
        library,
        'CA-PREMISE',
        {
          target: {
            kind: 'argument',
            argumentId: 'AR-NEUTRAL',
            part: { kind: 'premise', premiseId: 'P-MISSING' },
          },
        },
        runtime,
      ),
    ).toThrow(/unknown target premise/i);

    library = createArgument(
      library,
      {
        id: 'AR-CYCLE',
        title: 'Cycle candidate',
        premises: [],
        conclusion: 'A cycle candidate conclusion.',
      },
      runtime,
    );
    const cyclic = clonePlainData(library) as unknown as {
      arguments: { id: string; premises: unknown[] }[];
    };
    cyclic.arguments
      .find(({ id }) => id === 'AR-NEUTRAL')!
      .premises.push({
        id: 'P-CYCLE-A',
        kind: 'argument-conclusion',
        argumentId: 'AR-CYCLE',
        reliedOnRevision: 1,
      });
    cyclic.arguments
      .find(({ id }) => id === 'AR-CYCLE')!
      .premises.push({
        id: 'P-CYCLE-B',
        kind: 'argument-conclusion',
        argumentId: 'AR-NEUTRAL',
        reliedOnRevision: 1,
      });
    const validation = validateArgumentLibrary(cyclic);
    expect(validation.valid).toBe(false);
    if (validation.valid) return;
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'dependency-cycle' }),
      ]),
    );
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
