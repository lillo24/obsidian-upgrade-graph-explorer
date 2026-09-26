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
  discardArgumentProposal,
  resolveProposalAsArgument,
  resolveProposalAsRejected,
  submitArgumentProposal,
} from './proposals';
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
        JSON.stringify({
          ...createNeutralArgumentLibrary(),
          schemaVersion: 10,
        }),
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
        schemaVersion: 9,
        libraryId: 'library-v1-fixture',
        libraryRevision: 7,
        arguments: [],
        contexts: [],
        proposals: [],
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
      delete legacyArgument.contextIds;
      return legacyArgument;
    };
    const legacyArguments = current.arguments.map(withoutV3Fields);
    const currentWithoutContexts = { ...current } as Record<string, unknown>;
    delete currentWithoutContexts.contexts;
    delete currentWithoutContexts.proposals;
    const legacyV2 = {
      ...currentWithoutContexts,
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
        schemaVersion: 9,
        contexts: [],
        proposals: [],
        arguments: [{ examples: [], relations: [], contextIds: [] }],
      },
    });
    expect(second).toEqual(first);
    if (first.status !== 'valid') return;
    expect(first.value.arguments.map(withoutV3Fields)).toEqual(legacyArguments);
    expect(first.value.topics).toEqual(current.topics);
    expect(first.value.axioms).toEqual(current.axioms);
    expect(first.value.counterArguments).toEqual(current.counterArguments);
  });

  it('migrates v4 by adding only an empty Proposal Mailbox', () => {
    const current = clonePlainData(createNeutralArgumentLibrary());
    const legacyV4 = { ...current } as Record<string, unknown>;
    delete legacyV4.proposals;
    legacyV4.schemaVersion = 4;

    const parsed = parseArgumentLibraryJson(JSON.stringify(legacyV4));

    expect(parsed).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 4,
      value: { schemaVersion: 9, proposals: [] },
    });
    if (parsed.status !== 'valid') return;
    const migratedWithoutMailbox = clonePlainData(
      parsed.value,
    ) as unknown as Record<string, unknown>;
    delete migratedWithoutMailbox.proposals;
    migratedWithoutMailbox.schemaVersion = 4;
    expect(migratedWithoutMailbox).toEqual(legacyV4);
  });

  it('migrates v5 proposals into typed review roles without inferring references from prose', () => {
    const library = createNeutralArgumentLibrary();
    const descriptor = captureArgumentLibrarySnapshot(library).descriptor;
    const target = library.arguments[0]!;
    const axiom = library.axioms[0]!;
    const submitted = submitArgumentProposal(
      library,
      {
        clientSubmissionId: 'legacy-v5-submission',
        title: 'Legacy boundary candidate',
        topicId: library.topics[0]!.id,
        target: {
          argumentId: target.id,
          part: { kind: 'reasoning' },
          reliedOnRevision: target.revision,
        },
        examples: [],
        premiseHints: [
          `Arbitrary prose mentions ${target.id} but remains a text claim.`,
        ],
        suggestedAxiomIds: [axiom.id],
        reasoning: 'Legacy reasoning remains readable.',
        conclusion: 'The legacy proposal remains reviewable.',
        whyNovelOrUnresolved: 'This proposal predates typed review roles.',
        consultation: {
          libraryId: descriptor.libraryId,
          libraryRevision: descriptor.libraryRevision,
          contentFingerprint: descriptor.contentFingerprint,
          records: [
            {
              kind: 'topic',
              id: library.topics[0]!.id,
              revision: library.topics[0]!.revision,
            },
            { kind: 'argument', id: target.id, revision: target.revision },
            { kind: 'axiom', id: axiom.id, revision: axiom.revision },
          ],
        },
      },
      deterministicRuntime('legacy-v5'),
    );
    const currentProposal = submitted.proposal;
    const v5Proposal = {
      ...currentProposal,
    } as unknown as Record<string, unknown>;
    delete v5Proposal.intent;
    delete v5Proposal.premises;
    delete v5Proposal.reasoningSteps;
    delete v5Proposal.sourceObservations;
    delete v5Proposal.draftRelations;
    delete v5Proposal.revisionHistory;
    const legacy = {
      ...submitted.library,
      schemaVersion: 5,
      proposals: [
        {
          ...v5Proposal,
          premiseHints: [
            `Arbitrary prose mentions ${target.id} but remains a text claim.`,
          ],
          suggestedAxiomIds: [axiom.id],
        },
      ],
    };

    const first = parseArgumentLibraryJson(JSON.stringify(legacy));
    const second = parseArgumentLibraryJson(JSON.stringify(legacy));
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 5,
      value: {
        schemaVersion: 9,
        proposals: [
          {
            intent: 'unspecified',
            premises: [
              {
                id: 'legacy-text-1',
                kind: 'text',
                text: `Arbitrary prose mentions ${target.id} but remains a text claim.`,
              },
              {
                id: 'legacy-axiom-1',
                kind: 'axiom',
                axiomId: axiom.id,
                reliedOnRevision: axiom.revision,
              },
            ],
            reasoningSteps: [],
            sourceObservations: [],
          },
        ],
      },
    });
    if (first.status !== 'valid') return;
    expect(
      parseArgumentLibraryJson(serializeArgumentLibrary(first.value)),
    ).toMatchObject({ status: 'valid', value: first.value });
  });

  it('migrates v6 proposals without fabricating a Soft Explanation', () => {
    const library = createNeutralArgumentLibrary();
    const descriptor = captureArgumentLibrarySnapshot(library).descriptor;
    const submitted = submitArgumentProposal(
      library,
      {
        clientSubmissionId: 'legacy-v6-submission',
        title: 'Legacy v6 proposal',
        intent: 'new',
        examples: [],
        premises: [{ id: 'P-1', kind: 'text', text: 'A bounded claim.' }],
        reasoningSteps: [],
        conclusion: 'The bounded claim may be reviewed.',
        sourceObservations: [],
        whyNovelOrUnresolved: 'This proposal predates Soft Explanations.',
        consultation: {
          libraryId: descriptor.libraryId,
          libraryRevision: descriptor.libraryRevision,
          contentFingerprint: descriptor.contentFingerprint,
          records: [
            {
              kind: 'topic',
              id: library.topics[0]!.id,
              revision: library.topics[0]!.revision,
            },
          ],
        },
      },
      deterministicRuntime('legacy-v6'),
    ).library;
    const legacy = {
      ...submitted,
      schemaVersion: 6,
      proposals: submitted.proposals.map((proposal) => {
        const retained = { ...proposal } as Record<string, unknown>;
        delete retained.draftRelations;
        delete retained.revisionHistory;
        return retained;
      }),
    };

    const parsed = parseArgumentLibraryJson(JSON.stringify(legacy));

    expect(parsed).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 6,
      value: { schemaVersion: 9 },
    });
    if (parsed.status !== 'valid') return;
    expect(parsed.value.proposals[0]).not.toHaveProperty(
      'softExplanationMarkdown',
    );
    expect(
      parseArgumentLibraryJson(serializeArgumentLibrary(parsed.value)),
    ).toMatchObject({ status: 'valid', value: parsed.value });
  });

  it('migrates v7 pending, stored, and canonically refuted history into v9 staging', () => {
    const runtime = deterministicRuntime('legacy-v7');
    const original = createNeutralArgumentLibrary();
    const descriptor = captureArgumentLibrarySnapshot(original).descriptor;
    const proposalInput = {
      title: 'Legacy lifecycle proposal',
      intent: 'new' as const,
      examples: [],
      premises: [],
      reasoningSteps: [],
      conclusion: 'A legacy proposal conclusion.',
      sourceObservations: [],
      whyNovelOrUnresolved: 'It remains relevant to migration coverage.',
      consultation: {
        libraryId: descriptor.libraryId,
        libraryRevision: descriptor.libraryRevision,
        contentFingerprint: descriptor.contentFingerprint,
        records: [
          {
            kind: 'topic' as const,
            id: original.topics[0]!.id,
            revision: original.topics[0]!.revision,
          },
        ],
      },
    };
    const pending = submitArgumentProposal(original, proposalInput, runtime);
    const stored = resolveProposalAsArgument(
      pending.library,
      {
        proposalId: pending.proposal.id,
        topicIds: ['T-NEUTRAL'],
        argument: {
          id: 'AR-LEGACY-STORED',
          title: 'Stored legacy proposal',
          premises: [],
          conclusion: pending.proposal.conclusion,
        },
      },
      runtime,
    );
    const secondDescriptor = captureArgumentLibrarySnapshot(stored).descriptor;
    const second = submitArgumentProposal(
      stored,
      {
        ...proposalInput,
        clientSubmissionId: 'legacy-refutation',
        title: 'Legacy refuted proposal',
        consultation: {
          libraryId: secondDescriptor.libraryId,
          libraryRevision: secondDescriptor.libraryRevision,
          contentFingerprint: secondDescriptor.contentFingerprint,
          records: [
            {
              kind: 'topic',
              id: stored.topics[0]!.id,
              revision: stored.topics[0]!.revision,
            },
          ],
        },
      },
      runtime,
    );
    const resolved = resolveProposalAsRejected(
      second.library,
      {
        proposalId: second.proposal.id,
        topicIds: ['T-NEUTRAL'],
        counterArgument: {
          id: 'CA-LEGACY-REFUTED',
          title: second.proposal.title,
          observation: 'Legacy refuting observation.',
          challengedClaim: second.proposal.conclusion,
          response: {
            explanation: 'The legacy claim was refuted.',
            outcome: 'refuted',
          },
        },
      },
      runtime,
    );
    const legacyProposals = resolved.proposals.map((proposal) => {
      const legacy = { ...proposal } as Record<string, unknown>;
      delete legacy.draftRelations;
      delete legacy.revisionHistory;
      const result = proposal.decision!.resultingRecords[0]!;
      legacy.status = result.kind === 'argument' ? 'accepted' : 'rejected';
      legacy.decision = {
        decidedAt: proposal.decision!.decidedAt,
        ...(proposal.decision!.note === undefined
          ? {}
          : { note: proposal.decision!.note }),
        ...(result.kind === 'argument'
          ? { resultingArgumentId: result.id }
          : { resultingCounterArgumentId: result.id }),
      };
      return legacy;
    });
    const legacy = {
      ...resolved,
      schemaVersion: 7,
      proposals: legacyProposals,
    };

    const parsed = parseArgumentLibraryJson(JSON.stringify(legacy));

    expect(parsed).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 7,
      value: { schemaVersion: 9 },
    });
    if (parsed.status !== 'valid') return;
    expect(parsed.value.arguments).toEqual(resolved.arguments);
    expect(parsed.value.counterArguments).toEqual(resolved.counterArguments);
    expect(parsed.value.proposals.map(({ status }) => status)).toEqual([
      'stored',
      'stored',
    ]);
    expect(parsed.value.proposals).toEqual(
      resolved.proposals.map((proposal) => ({
        ...proposal,
        draftRelations: [],
        revisionHistory: [],
      })),
    );
  });

  it('migrates v8 stored and discarded outcomes into typed v9 decisions', () => {
    const runtime = deterministicRuntime('legacy-v8');
    const original = createNeutralArgumentLibrary();
    const descriptor = captureArgumentLibrarySnapshot(original).descriptor;
    const input = {
      title: 'V8 lifecycle proposal',
      intent: 'new' as const,
      examples: [],
      premises: [],
      reasoningSteps: [],
      conclusion: 'A v8 lifecycle conclusion.',
      sourceObservations: [],
      whyNovelOrUnresolved: 'Migration must preserve its outcome.',
      consultation: {
        libraryId: descriptor.libraryId,
        libraryRevision: descriptor.libraryRevision,
        contentFingerprint: descriptor.contentFingerprint,
        records: [
          {
            kind: 'topic' as const,
            id: original.topics[0]!.id,
            revision: original.topics[0]!.revision,
          },
        ],
      },
    };
    const first = submitArgumentProposal(original, input, runtime);
    const stored = resolveProposalAsArgument(
      first.library,
      {
        proposalId: first.proposal.id,
        topicIds: ['T-NEUTRAL'],
        argument: {
          id: 'AR-V8-STORED',
          title: first.proposal.title,
          premises: [],
          conclusion: first.proposal.conclusion,
        },
      },
      runtime,
    );
    const nextDescriptor = captureArgumentLibrarySnapshot(stored).descriptor;
    const second = submitArgumentProposal(
      stored,
      {
        ...input,
        clientSubmissionId: 'v8-discarded',
        title: 'V8 discarded proposal',
        consultation: {
          libraryId: nextDescriptor.libraryId,
          libraryRevision: nextDescriptor.libraryRevision,
          contentFingerprint: nextDescriptor.contentFingerprint,
          records: [
            {
              kind: 'topic',
              id: stored.topics[0]!.id,
              revision: stored.topics[0]!.revision,
            },
          ],
        },
      },
      runtime,
    );
    const resolved = discardArgumentProposal(
      second.library,
      {
        proposalId: second.proposal.id,
        expectedRevision: second.proposal.revision,
        note: 'No longer active.',
      },
      runtime,
    );
    const legacy = {
      ...resolved,
      schemaVersion: 8,
      proposals: resolved.proposals.map((proposal) => {
        if (proposal.status === 'discarded') {
          return {
            ...proposal,
            decision: {
              decidedAt: proposal.decision!.decidedAt,
              note: proposal.decision!.note,
            },
          };
        }
        const result = proposal.decision!.resultingRecords[0]!;
        return {
          ...proposal,
          status: result.kind === 'argument' ? 'accepted' : 'rejected',
          decision: {
            decidedAt: proposal.decision!.decidedAt,
            ...(result.kind === 'argument'
              ? { resultingArgumentId: result.id }
              : { resultingCounterArgumentId: result.id }),
          },
        };
      }),
    };

    const parsed = parseArgumentLibraryJson(JSON.stringify(legacy));

    expect(parsed).toMatchObject({
      status: 'valid',
      migratedFromSchemaVersion: 8,
      value: { schemaVersion: 9 },
    });
    if (parsed.status !== 'valid') return;
    expect(parsed.value.arguments).toEqual(resolved.arguments);
    expect(parsed.value.proposals.map(({ status }) => status)).toEqual([
      'stored',
      'discarded',
    ]);
    expect(parsed.value.proposals[0]?.decision?.resultingRecords).toEqual([
      { kind: 'argument', id: 'AR-V8-STORED' },
    ]);
    expect(parsed.value.proposals[1]?.decision?.resultingRecords).toEqual([]);
    expect(
      parsed.value.proposals.map(({ revisionHistory }) => revisionHistory),
    ).toEqual(resolved.proposals.map(({ revisionHistory }) => revisionHistory));
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
