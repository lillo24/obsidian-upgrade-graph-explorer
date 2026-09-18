import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot } from './canonical';
import { createKnowledgeReaderFromLibrary } from './reader';
import {
  resolveProposalAsArgument,
  resolveProposalAsRejected,
  submitArgumentProposal,
} from './proposals';
import {
  parseArgumentLibraryJson,
  serializeArgumentLibrary,
} from './serialization';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import type { ArgumentLibrary, CreateArgumentProposalInput } from './types';

function submission(library: ArgumentLibrary): CreateArgumentProposalInput {
  const snapshot = captureArgumentLibrarySnapshot(library).descriptor;
  const target = library.arguments.find(({ id }) => id === 'AR-NEUTRAL')!;
  const topic = library.topics.find(({ id }) => id === 'T-NEUTRAL')!;
  const axiom = library.axioms.find(({ id }) => id === 'AX-NEUTRAL')!;
  return {
    clientSubmissionId: 'client-proposal-1',
    title: 'Compatibility rule has a scoped exception',
    topicId: 'T-NEUTRAL',
    target: {
      argumentId: target.id,
      part: { kind: 'reasoning' },
      reliedOnRevision: target.revision,
    },
    examples: ['Two quantities are intentionally normalized upstream.'],
    premiseHints: ['The normalization contract is independently verified.'],
    suggestedAxiomIds: ['AX-NEUTRAL'],
    reasoning: 'Pre-normalized quantities do not require another conversion.',
    conclusion: 'The compatibility check can reuse a verified normalization.',
    boundary: 'Only where the normalization contract is current.',
    whyNovelOrUnresolved:
      'The existing response discusses incompatible units, not a verified normalization boundary.',
    consultation: {
      libraryId: snapshot.libraryId,
      libraryRevision: snapshot.libraryRevision,
      contentFingerprint: snapshot.contentFingerprint,
      records: [
        { kind: 'topic', id: topic.id, revision: topic.revision },
        { kind: 'argument', id: target.id, revision: target.revision },
        { kind: 'axiom', id: axiom.id, revision: axiom.revision },
      ],
    },
  };
}

describe('Argument Proposal Mailbox', () => {
  it('appends a pending non-canonical proposal and makes exact retries idempotent', () => {
    const original = createNeutralArgumentLibrary();
    const runtime = deterministicRuntime('proposal');
    const input = submission(original);

    const first = submitArgumentProposal(original, input, runtime);
    const second = submitArgumentProposal(first.library, input, runtime);

    expect(first.proposal).toMatchObject({
      status: 'pending',
      title: input.title,
      target: input.target,
      consultation: input.consultation,
    });
    expect(first.library.proposals).toHaveLength(1);
    expect(second.duplicate).toBe(true);
    expect(second.proposal.id).toBe(first.proposal.id);
    expect(second.library).toBe(first.library);
    expect(() =>
      submitArgumentProposal(
        first.library,
        { ...input, conclusion: 'Different content under the same retry key.' },
        runtime,
      ),
    ).toThrow('already used for different content');
    expect(first.library.topics).toEqual(original.topics);
    expect(first.library.axioms).toEqual(original.axioms);
    expect(first.library.arguments).toEqual(original.arguments);
    expect(first.library.counterArguments).toEqual(original.counterArguments);
    expect(
      parseArgumentLibraryJson(serializeArgumentLibrary(first.library)),
    ).toMatchObject({ status: 'valid', value: first.library });

    const reader = createKnowledgeReaderFromLibrary(first.library);
    const search = reader.searchIndex({ query: input.conclusion });
    expect(search.status).toBe('ok');
    if (search.status === 'ok') {
      expect(
        search.value.candidates.some(({ id }) => id === first.proposal.id),
      ).toBe(false);
    }
  });

  it('rejects stale consultation and target identities without storing anything', () => {
    const library = createNeutralArgumentLibrary();
    const input = submission(library);
    expect(() =>
      submitArgumentProposal(
        library,
        {
          ...input,
          consultation: {
            ...input.consultation,
            libraryRevision: input.consultation.libraryRevision - 1,
          },
        },
        deterministicRuntime('stale-consultation'),
      ),
    ).toThrow('consultation snapshot is stale');
    expect(() =>
      submitArgumentProposal(
        library,
        {
          ...input,
          target: { ...input.target!, reliedOnRevision: 99 },
        },
        deterministicRuntime('stale-target'),
      ),
    ).toThrow('target Argument revision is stale');
    expect(() =>
      submitArgumentProposal(
        library,
        {
          ...input,
          consultation: {
            ...input.consultation,
            records: input.consultation.records.filter(
              ({ kind }) => kind !== 'argument',
            ),
          },
        },
        deterministicRuntime('missing-target-receipt'),
      ),
    ).toThrow('target and revision must appear in the consultation records');
    expect(library.proposals).toEqual([]);
  });

  it('atomically rejects into accepted canonical Audit with pinned answering Axioms', () => {
    const runtime = deterministicRuntime('reject');
    const submitted = submitArgumentProposal(
      createNeutralArgumentLibrary(),
      submission(createNeutralArgumentLibrary()),
      runtime,
    );
    const proposal = submitted.proposal;
    const target = proposal.target!;
    const resolved = resolveProposalAsRejected(
      submitted.library,
      {
        proposalId: proposal.id,
        topicIds: ['T-NEUTRAL'],
        note: 'The normalization contract was not demonstrated.',
        counterArgument: {
          id: 'CA-PROPOSAL-REJECTED',
          title: proposal.title,
          observation: proposal.examples.join('\n'),
          challengedClaim: proposal.conclusion,
          target: {
            kind: 'argument',
            argumentId: target.argumentId,
            part: target.part,
          },
          response: {
            answeringAxioms: [
              {
                axiomId: 'AX-NEUTRAL',
                reliedOnRevision: submitted.library.axioms[0]!.revision,
              },
            ],
            explanation:
              'The proposed normalization is not established under the current scope.',
            outcome: 'refuted',
            boundary: 'A verified normalization could change this result.',
            reopeningCondition: 'Provide the normalization contract.',
          },
        },
      },
      runtime,
    );

    expect(resolved.proposals[0]).toMatchObject({
      status: 'rejected',
      decision: { resultingCounterArgumentId: 'CA-PROPOSAL-REJECTED' },
    });
    expect(resolved.counterArguments).toContainEqual(
      expect.objectContaining({
        id: 'CA-PROPOSAL-REJECTED',
        reviewState: 'accepted',
        response: expect.objectContaining({
          outcome: 'refuted',
          answeringAxioms: [{ axiomId: 'AX-NEUTRAL', reliedOnRevision: 1 }],
        }),
      }),
    );
    expect(resolved.topics[0]!.counterArgumentIds).toContain(
      'CA-PROPOSAL-REJECTED',
    );
    const search = createKnowledgeReaderFromLibrary(resolved).searchIndex({
      query: 'normalization is not established',
    });
    expect(search.status).toBe('ok');
    if (search.status === 'ok') {
      expect(search.value.candidates).toContainEqual(
        expect.objectContaining({ id: 'CA-PROPOSAL-REJECTED' }),
      );
    }
    expect(
      createKnowledgeReaderFromLibrary(resolved).readArgumentBundle({
        id: 'CA-PROPOSAL-REJECTED',
        kind: 'counter-argument',
      }),
    ).toMatchObject({
      status: 'ok',
      value: {
        counterArguments: [
          expect.objectContaining({ id: 'CA-PROPOSAL-REJECTED' }),
        ],
      },
    });
    expect(
      parseArgumentLibraryJson(serializeArgumentLibrary(resolved)),
    ).toMatchObject({ status: 'valid', value: resolved });
  });

  it('atomically accepts a human-built replacement while keeping attack, supersession, and promotion separate', () => {
    const original = createNeutralArgumentLibrary();
    const runtime = deterministicRuntime('accept');
    const submitted = submitArgumentProposal(
      original,
      submission(original),
      runtime,
    );
    const proposal = submitted.proposal;
    const target = proposal.target!;
    const accepted = resolveProposalAsArgument(
      submitted.library,
      {
        proposalId: proposal.id,
        topicIds: ['T-NEUTRAL'],
        promoteTopicId: 'T-NEUTRAL',
        argument: {
          id: 'AR-PROPOSAL-ACCEPTED',
          title: 'Verified normalization refines compatibility checking',
          examples: [{ id: 'EX-PROPOSAL', text: proposal.examples[0]! }],
          premises: [
            {
              id: 'P-PROPOSAL-AXIOM',
              kind: 'axiom',
              axiomId: 'AX-NEUTRAL',
              reliedOnRevision: submitted.library.axioms[0]!.revision,
            },
          ],
          ...(proposal.reasoning === undefined
            ? {}
            : { reasoning: proposal.reasoning }),
          conclusion: proposal.conclusion,
          ...(proposal.boundary === undefined
            ? {}
            : { boundary: proposal.boundary }),
          relations: [
            {
              id: 'REL-PROPOSAL-ATTACK',
              kind: 'attack',
              targetArgumentId: target.argumentId,
              targetPart: target.part,
              reliedOnRevision: target.reliedOnRevision,
            },
          ],
          supersedesArgumentId: target.argumentId,
        },
      },
      runtime,
    );

    expect(accepted.arguments.map(({ id }) => id)).toEqual([
      'AR-NEUTRAL',
      'AR-PROPOSAL-ACCEPTED',
    ]);
    expect(accepted.arguments[1]).toMatchObject({
      reviewState: 'accepted',
      supersedesArgumentId: 'AR-NEUTRAL',
      premises: [
        expect.objectContaining({
          kind: 'axiom',
          axiomId: 'AX-NEUTRAL',
          reliedOnRevision: 1,
        }),
      ],
      relations: [
        expect.objectContaining({
          kind: 'attack',
          targetArgumentId: 'AR-NEUTRAL',
          targetPart: { kind: 'reasoning' },
        }),
      ],
    });
    expect(accepted.topics[0]!.currentArgumentId).toBe('AR-PROPOSAL-ACCEPTED');
    expect(accepted.proposals[0]).toMatchObject({
      status: 'accepted',
      decision: { resultingArgumentId: 'AR-PROPOSAL-ACCEPTED' },
    });
    expect(
      createKnowledgeReaderFromLibrary(accepted).readArgumentBundle({
        id: 'AR-PROPOSAL-ACCEPTED',
        kind: 'argument',
      }),
    ).toMatchObject({
      status: 'ok',
      value: {
        arguments: [
          expect.objectContaining({ id: 'AR-NEUTRAL' }),
          expect.objectContaining({ id: 'AR-PROPOSAL-ACCEPTED' }),
        ],
      },
    });

    const secondSubmission = submitArgumentProposal(
      original,
      submission(original),
      runtime,
    );
    const withoutPromotion = resolveProposalAsArgument(
      secondSubmission.library,
      {
        proposalId: secondSubmission.proposal.id,
        topicIds: ['T-NEUTRAL'],
        argument: {
          id: 'AR-PROPOSAL-NO-PROMOTION',
          title: 'A separate refinement',
          premises: [],
          conclusion: proposal.conclusion,
        },
      },
      runtime,
    );
    expect(withoutPromotion.topics[0]!.currentArgumentId).toBe('AR-NEUTRAL');
    expect(withoutPromotion.arguments[1]).not.toHaveProperty(
      'supersedesArgumentId',
    );
    expect(withoutPromotion.arguments[1]!.relations).toEqual([]);
  });

  it('leaves the proposal pending when rejection validation fails', () => {
    const original = createNeutralArgumentLibrary();
    const runtime = deterministicRuntime('invalid-reject');
    const submitted = submitArgumentProposal(
      original,
      submission(original),
      runtime,
    );
    expect(() =>
      resolveProposalAsRejected(
        submitted.library,
        {
          proposalId: submitted.proposal.id,
          topicIds: ['T-NEUTRAL'],
          counterArgument: {
            id: 'CA-INVALID',
            title: submitted.proposal.title,
            observation: submitted.proposal.examples[0]!,
            challengedClaim: submitted.proposal.conclusion,
            response: { explanation: '', outcome: 'unanswered' },
          },
        },
        runtime,
      ),
    ).toThrow('response explanation');
    expect(submitted.library.proposals[0]!.status).toBe('pending');
    expect(submitted.library.counterArguments).toHaveLength(
      original.counterArguments.length,
    );
  });
});
