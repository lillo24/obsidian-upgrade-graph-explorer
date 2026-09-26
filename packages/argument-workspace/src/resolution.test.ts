import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot } from './canonical';
import { createKnowledgeReaderFromLibrary } from './reader';
import {
  applyCanonicalResolution,
  prepareCanonicalResolution,
  type CanonicalResolutionPackageSpec,
} from './resolution';
import { submitArgumentProposal } from './proposals';
import {
  createNeutralArgumentLibrary,
  deterministicRuntime,
} from './test-fixture';
import type {
  ArgumentLibrary,
  ArgumentProposalDraftRelation,
  CounterArgumentResponse,
  CreateArgumentProposalInput,
} from './types';

function proposalInput(
  library: ArgumentLibrary,
  key: string,
  draftRelations: readonly ArgumentProposalDraftRelation[] = [],
): CreateArgumentProposalInput {
  const snapshot = captureArgumentLibrarySnapshot(library).descriptor;
  const topic = library.topics.find(({ id }) => id === 'T-NEUTRAL')!;
  return {
    clientSubmissionId: `client-${key}`,
    title: `${key} canonical candidate`,
    softExplanationMarkdown: `SOFT-${key} must stay non-canonical.`,
    intent: 'new',
    topicId: topic.id,
    examples: [`Example ${key}`],
    premises: [
      {
        id: `P-${key}`,
        kind: 'text',
        text: `Premise ${key}`,
      },
    ],
    reasoning: `Reasoning ${key}`,
    reasoningSteps: [
      {
        id: `R-${key}`,
        text: `Structured step ${key}`,
        uses: [{ kind: 'premise', premiseId: `P-${key}` }],
      },
    ],
    conclusion: `Conclusion ${key}`,
    boundary: `Boundary ${key}`,
    sourceObservations: [
      {
        id: `OBS-${key}`,
        observation: `SOURCE-${key} must not become canonical evidence.`,
      },
    ],
    draftRelations,
    whyNovelOrUnresolved: `Novel ${key}`,
    consultation: {
      libraryId: snapshot.libraryId,
      libraryRevision: snapshot.libraryRevision,
      contentFingerprint: snapshot.contentFingerprint,
      records: [{ kind: 'topic', id: topic.id, revision: topic.revision }],
    },
  };
}

function withArgumentAndCounterProposals(): {
  readonly library: ArgumentLibrary;
  readonly argumentProposalId: string;
  readonly counterProposalId: string;
} {
  const runtime = deterministicRuntime('resolution-submit');
  const original = createNeutralArgumentLibrary();
  const argument = submitArgumentProposal(
    original,
    proposalInput(original, 'A'),
    runtime,
  );
  const counterInput = proposalInput(argument.library, 'C', [
    {
      id: 'DRAFT-C-ATTACKS-A',
      kind: 'attack',
      targetProposalId: argument.proposal.id,
      targetProposalRevision: argument.proposal.revision,
    },
  ]);
  const counter = submitArgumentProposal(
    argument.library,
    counterInput,
    runtime,
  );
  return {
    library: counter.library,
    argumentProposalId: argument.proposal.id,
    counterProposalId: counter.proposal.id,
  };
}

function connectedPackage(
  library: ArgumentLibrary,
  argumentProposalId: string,
  counterProposalId: string,
  response?: Partial<CounterArgumentResponse>,
): CanonicalResolutionPackageSpec {
  const argument = library.proposals.find(
    ({ id }) => id === argumentProposalId,
  )!;
  const counter = library.proposals.find(({ id }) => id === counterProposalId)!;
  return {
    proposals: [
      {
        kind: 'argument',
        proposalId: argument.id,
        expectedRevision: argument.revision,
        canonicalId: 'AR-PACKAGE-A',
        topicIds: ['T-NEUTRAL'],
      },
      {
        kind: 'counter-argument',
        proposalId: counter.id,
        expectedRevision: counter.revision,
        canonicalId: 'CA-PACKAGE-C',
        topicIds: ['T-NEUTRAL'],
        target: {
          kind: 'argument',
          argument: { kind: 'proposal', proposalId: argument.id },
          part: { kind: 'conclusion' },
        },
        ...(response === undefined ? {} : { response }),
      },
    ],
    draftRelationDispositions: [
      {
        sourceProposalId: counter.id,
        relationId: 'DRAFT-C-ATTACKS-A',
        action: 'counter-target',
      },
    ],
  };
}

describe('atomic canonical Proposal resolution', () => {
  it('stores one Argument with Topic membership and a typed durable receipt', () => {
    const runtime = deterministicRuntime('single-resolution');
    const original = createNeutralArgumentLibrary();
    const submitted = submitArgumentProposal(
      original,
      proposalInput(original, 'SINGLE'),
      runtime,
    );
    const prepared = prepareCanonicalResolution(
      submitted.library,
      {
        proposals: [
          {
            kind: 'argument',
            proposalId: submitted.proposal.id,
            expectedRevision: submitted.proposal.revision,
            canonicalId: 'AR-SINGLE-RESULT',
            topicIds: ['T-NEUTRAL'],
          },
        ],
        draftRelationDispositions: [],
      },
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;

    const applied = applyCanonicalResolution(
      submitted.library,
      prepared.plan,
      runtime,
    );
    expect(applied.alreadyApplied).toBe(false);
    expect(applied.library.arguments.at(-1)).toMatchObject({
      id: 'AR-SINGLE-RESULT',
      reviewState: 'accepted',
      conclusion: 'Conclusion SINGLE',
    });
    expect(applied.library.topics[0]?.argumentIds).toContain(
      'AR-SINGLE-RESULT',
    );
    const stored = applied.library.proposals.find(
      ({ id }) => id === submitted.proposal.id,
    )!;
    expect(stored).toMatchObject({
      status: 'stored',
      decision: {
        resultingRecords: [{ kind: 'argument', id: 'AR-SINGLE-RESULT' }],
        resolutionReceipt: { id: prepared.plan.resolutionId },
      },
    });
  });

  it('stores an Argument and standing Counter-Argument together without treating the latter as rejected', () => {
    const fixture = withArgumentAndCounterProposals();
    const runtime = deterministicRuntime('package-resolution');
    const prepared = prepareCanonicalResolution(
      fixture.library,
      connectedPackage(
        fixture.library,
        fixture.argumentProposalId,
        fixture.counterProposalId,
      ),
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    const beforeCurrent = fixture.library.topics[0]?.currentArgumentId;
    const applied = applyCanonicalResolution(
      fixture.library,
      prepared.plan,
      runtime,
    );
    expect(applied.library.counterArguments.at(-1)).toMatchObject({
      id: 'CA-PACKAGE-C',
      target: {
        kind: 'argument',
        argumentId: 'AR-PACKAGE-A',
        part: { kind: 'conclusion' },
      },
      response: { outcome: 'unanswered', answeringAxioms: [] },
    });
    expect(applied.library.proposals.map(({ status }) => status)).toEqual([
      'stored',
      'stored',
    ]);
    expect(
      applied.library.proposals.find(
        ({ id }) => id === fixture.counterProposalId,
      )?.decision?.resultingRecords,
    ).toEqual([{ kind: 'counter-argument', id: 'CA-PACKAGE-C' }]);
    expect(applied.library.topics[0]?.currentArgumentId).toBe(beforeCurrent);
    expect(JSON.stringify(applied.library.arguments.at(-1))).not.toContain(
      'SOFT-A',
    );
    expect(JSON.stringify(applied.library.arguments.at(-1))).not.toContain(
      'SOURCE-A',
    );
  });

  it('stores an explicit Counter-Argument response with revision-pinned answering Axioms', () => {
    const fixture = withArgumentAndCounterProposals();
    const axiom = fixture.library.axioms[0]!;
    const prepared = prepareCanonicalResolution(
      fixture.library,
      connectedPackage(
        fixture.library,
        fixture.argumentProposalId,
        fixture.counterProposalId,
        {
          answeringAxioms: [
            { axiomId: axiom.id, reliedOnRevision: axiom.revision },
          ],
          explanation: 'The standing objection is answered under this Axiom.',
          outcome: 'inapplicable-under-stated-scope',
        },
      ),
      deterministicRuntime('response-resolution'),
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    expect(
      prepared.candidate.counterArguments.find(
        ({ id }) => id === 'CA-PACKAGE-C',
      )?.response,
    ).toMatchObject({
      outcome: 'inapplicable-under-stated-scope',
      answeringAxioms: [
        { axiomId: axiom.id, reliedOnRevision: axiom.revision },
      ],
    });
  });

  it('supports explicit new-to-new Argument relations and premise bindings', () => {
    const runtime = deterministicRuntime('dependency-resolution');
    const original = createNeutralArgumentLibrary();
    const first = submitArgumentProposal(
      original,
      proposalInput(original, 'BASE'),
      runtime,
    );
    const second = submitArgumentProposal(
      first.library,
      proposalInput(first.library, 'DEPENDENT', [
        {
          id: 'DRAFT-SUPPORT',
          kind: 'support',
          targetProposalId: first.proposal.id,
          targetProposalRevision: first.proposal.revision,
        },
      ]),
      runtime,
    );
    const prepared = prepareCanonicalResolution(
      second.library,
      {
        proposals: [
          {
            kind: 'argument',
            proposalId: first.proposal.id,
            expectedRevision: first.proposal.revision,
            canonicalId: 'AR-NEW-BASE',
            topicIds: ['T-NEUTRAL'],
          },
          {
            kind: 'argument',
            proposalId: second.proposal.id,
            expectedRevision: second.proposal.revision,
            canonicalId: 'AR-NEW-DEPENDENT',
            topicIds: ['T-NEUTRAL'],
            premiseBindings: [
              {
                premiseId: 'P-DEPENDENT',
                targetProposalId: first.proposal.id,
                targetPart: { kind: 'conclusion' },
              },
            ],
            relations: [
              {
                kind: 'support',
                target: {
                  kind: 'proposal',
                  proposalId: first.proposal.id,
                },
                targetPart: { kind: 'conclusion' },
              },
            ],
          },
        ],
        draftRelationDispositions: [
          {
            sourceProposalId: second.proposal.id,
            relationId: 'DRAFT-SUPPORT',
            action: 'argument-relation',
          },
        ],
      },
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    const dependent = prepared.candidate.arguments.find(
      ({ id }) => id === 'AR-NEW-DEPENDENT',
    )!;
    expect(dependent.premises[0]).toMatchObject({
      kind: 'argument-conclusion',
      argumentId: 'AR-NEW-BASE',
      reliedOnRevision: 1,
    });
    expect(dependent.relations[0]).toMatchObject({
      kind: 'support',
      targetArgumentId: 'AR-NEW-BASE',
      reliedOnRevision: 1,
    });
  });

  it('requires an explicit disposition for every selected draft link', () => {
    const fixture = withArgumentAndCounterProposals();
    const spec = connectedPackage(
      fixture.library,
      fixture.argumentProposalId,
      fixture.counterProposalId,
    );
    const prepared = prepareCanonicalResolution(
      fixture.library,
      { ...spec, draftRelationDispositions: [] },
      deterministicRuntime('decision-resolution'),
    );
    expect(prepared).toMatchObject({
      status: 'needs-decision',
      unresolvedChoices: [expect.stringContaining('DRAFT-C-ATTACKS-A')],
    });
  });

  it('keeps a related draft link as staging provenance when explicitly requested', () => {
    const runtime = deterministicRuntime('staging-only-resolution');
    const original = createNeutralArgumentLibrary();
    const first = submitArgumentProposal(
      original,
      proposalInput(original, 'RELATED-BASE'),
      runtime,
    );
    const second = submitArgumentProposal(
      first.library,
      proposalInput(first.library, 'RELATED-SOURCE', [
        {
          id: 'DRAFT-RELATED',
          kind: 'related',
          targetProposalId: first.proposal.id,
          targetProposalRevision: first.proposal.revision,
        },
      ]),
      runtime,
    );
    const prepared = prepareCanonicalResolution(
      second.library,
      {
        proposals: [
          {
            kind: 'argument',
            proposalId: first.proposal.id,
            expectedRevision: first.proposal.revision,
            canonicalId: 'AR-RELATED-BASE',
            topicIds: [],
          },
          {
            kind: 'argument',
            proposalId: second.proposal.id,
            expectedRevision: second.proposal.revision,
            canonicalId: 'AR-RELATED-SOURCE',
            topicIds: [],
          },
        ],
        draftRelationDispositions: [
          {
            sourceProposalId: second.proposal.id,
            relationId: 'DRAFT-RELATED',
            action: 'staging-only',
          },
        ],
      },
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    expect(
      prepared.candidate.arguments.find(({ id }) => id === 'AR-RELATED-SOURCE'),
    ).toMatchObject({ relations: [] });
    expect(prepared.plan.preview.warnings).toContainEqual(
      expect.stringContaining('remains staging provenance only'),
    );
  });

  it('does not infer supersession or Current and applies both only when explicit', () => {
    const runtime = deterministicRuntime('promotion-resolution');
    const original = createNeutralArgumentLibrary();
    const submitted = submitArgumentProposal(
      original,
      proposalInput(original, 'PROMOTED'),
      runtime,
    );
    const prepared = prepareCanonicalResolution(
      submitted.library,
      {
        proposals: [
          {
            kind: 'argument',
            proposalId: submitted.proposal.id,
            expectedRevision: submitted.proposal.revision,
            canonicalId: 'AR-EXPLICIT-CURRENT',
            topicIds: ['T-NEUTRAL'],
            supersedes: {
              kind: 'existing',
              argumentId: 'AR-NEUTRAL',
              expectedRevision: submitted.library.arguments.find(
                ({ id }) => id === 'AR-NEUTRAL',
              )!.revision,
            },
            promoteTopicId: 'T-NEUTRAL',
          },
        ],
        draftRelationDispositions: [],
      },
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    expect(prepared.candidate.topics[0]?.currentArgumentId).toBe(
      'AR-EXPLICIT-CURRENT',
    );
    expect(
      prepared.candidate.arguments.find(
        ({ id }) => id === 'AR-EXPLICIT-CURRENT',
      )?.supersedesArgumentId,
    ).toBe('AR-NEUTRAL');

    expect(() =>
      prepareCanonicalResolution(
        submitted.library,
        {
          proposals: [
            {
              kind: 'argument',
              proposalId: submitted.proposal.id,
              expectedRevision: submitted.proposal.revision,
              canonicalId: 'AR-NOT-A-MEMBER',
              topicIds: [],
              promoteTopicId: 'T-NEUTRAL',
            },
          ],
          draftRelationDispositions: [],
        },
        runtime,
      ),
    ).toThrow(/selected membership/i);
  });

  it('fails stale snapshots and Proposal revisions without a partial mutation', () => {
    const fixture = withArgumentAndCounterProposals();
    const runtime = deterministicRuntime('stale-resolution');
    const prepared = prepareCanonicalResolution(
      fixture.library,
      connectedPackage(
        fixture.library,
        fixture.argumentProposalId,
        fixture.counterProposalId,
      ),
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    const changed = {
      ...fixture.library,
      libraryRevision: fixture.library.libraryRevision + 1,
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    expect(() =>
      applyCanonicalResolution(changed, prepared.plan, runtime),
    ).toThrow(/stale/i);
    expect(changed.arguments).toHaveLength(fixture.library.arguments.length);
    const staleSpec = connectedPackage(
      fixture.library,
      fixture.argumentProposalId,
      fixture.counterProposalId,
    );
    const staleProposal = {
      ...staleSpec,
      proposals: staleSpec.proposals.map((entry, index) =>
        index === 0
          ? { ...entry, expectedRevision: entry.expectedRevision + 1 }
          : entry,
      ),
    };
    expect(() =>
      prepareCanonicalResolution(fixture.library, staleProposal, runtime),
    ).toThrow(/stale/i);

    const originalArgument = fixture.library.arguments[0]!;
    const targetSpec: CanonicalResolutionPackageSpec = {
      proposals: [
        {
          kind: 'argument',
          proposalId: fixture.argumentProposalId,
          expectedRevision: 1,
          canonicalId: 'AR-STALE-TARGET',
          topicIds: [],
          relations: [
            {
              kind: 'support',
              target: {
                kind: 'existing',
                argumentId: originalArgument.id,
                expectedRevision: originalArgument.revision + 1,
              },
              targetPart: { kind: 'conclusion' },
            },
          ],
        },
      ],
      draftRelationDispositions: [],
    };
    expect(() =>
      prepareCanonicalResolution(fixture.library, targetSpec, runtime),
    ).toThrow(/revision is stale/i);
    expect(fixture.library.arguments).not.toContainEqual(
      expect.objectContaining({ id: 'AR-STALE-TARGET' }),
    );
  });

  it('makes the prepared fingerprint stable and exact retries idempotent', () => {
    const fixture = withArgumentAndCounterProposals();
    const runtime = deterministicRuntime('retry-resolution');
    const spec = connectedPackage(
      fixture.library,
      fixture.argumentProposalId,
      fixture.counterProposalId,
    );
    const first = prepareCanonicalResolution(fixture.library, spec, runtime);
    const second = prepareCanonicalResolution(fixture.library, spec, runtime);
    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    if (first.status !== 'ready' || second.status !== 'ready') return;
    expect(first.plan.planFingerprint).toEqual(second.plan.planFingerprint);
    const applied = applyCanonicalResolution(
      fixture.library,
      first.plan,
      runtime,
    );
    const retry = applyCanonicalResolution(
      applied.library,
      first.plan,
      runtime,
    );
    expect(retry.alreadyApplied).toBe(true);
    expect(retry.library).toEqual(applied.library);
    expect(retry.receipt).toEqual(applied.receipt);
    const tampered = {
      ...first.plan,
      currentPromotions: [{ topicId: 'T-NEUTRAL', argumentId: 'AR-PACKAGE-A' }],
    };
    expect(() =>
      applyCanonicalResolution(fixture.library, tampered, runtime),
    ).toThrow(/fingerprint/i);
  });

  it('publishes canonical search results only after successful apply', () => {
    const runtime = deterministicRuntime('search-resolution');
    const original = createNeutralArgumentLibrary();
    const submitted = submitArgumentProposal(
      original,
      proposalInput(original, 'SEARCHABLE'),
      runtime,
    );
    const before = createKnowledgeReaderFromLibrary(
      submitted.library,
    ).searchIndex({ query: 'SEARCHABLE canonical candidate' });
    expect(before.status).toBe('ok');
    if (before.status !== 'ok') return;
    expect(before.value.candidates).toHaveLength(0);
    const prepared = prepareCanonicalResolution(
      submitted.library,
      {
        proposals: [
          {
            kind: 'argument',
            proposalId: submitted.proposal.id,
            expectedRevision: submitted.proposal.revision,
            canonicalId: 'AR-SEARCHABLE',
            topicIds: [],
          },
        ],
        draftRelationDispositions: [],
      },
      runtime,
    );
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') return;
    const applied = applyCanonicalResolution(
      submitted.library,
      prepared.plan,
      runtime,
    );
    const after = createKnowledgeReaderFromLibrary(applied.library).searchIndex(
      { query: 'SEARCHABLE canonical candidate' },
    );
    expect(after.status).toBe('ok');
    if (after.status !== 'ok') return;
    expect(after.value.candidates).toEqual([
      expect.objectContaining({ id: 'AR-SEARCHABLE' }),
    ]);
  });
});
