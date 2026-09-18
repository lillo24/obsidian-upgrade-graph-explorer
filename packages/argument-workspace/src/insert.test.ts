import { describe, expect, it } from 'vitest';

import { captureArgumentLibrarySnapshot, canonicalJson } from './canonical';
import { previewArgumentWorkspaceInsert } from './insert';
import {
  createArgument,
  createEmptyArgumentLibrary,
  createTopic,
  promoteArgumentToCurrent,
  setTopicMembership,
} from './library';
import { createKnowledgeReader } from './reader';
import type { ArgumentRuntime } from './types';

function runtime(): ArgumentRuntime {
  let tick = 0;
  return {
    createId: (kind) => `unused-${kind}`,
    now: () => `2026-09-18T10:00:${String(tick++).padStart(2, '0')}.000Z`,
  };
}

function snapshot() {
  const clock = runtime();
  return {
    clock,
    snapshot: captureArgumentLibrarySnapshot(
      createEmptyArgumentLibrary(clock, 'library-insert-test'),
    ),
  };
}

function completePayload() {
  return {
    format: 'argument-workspace-insert-v1',
    topics: [
      {
        id: 'TOP-DEMO',
        title: 'Demo Topic',
        summary: 'Synthetic insert acceptance topic',
        reviewState: 'accepted',
      },
    ],
    axioms: [
      {
        id: 'AX-DEMO',
        title: 'Demo background Axiom',
        statement: 'A neutral background assumption.',
        reviewState: 'accepted',
      },
    ],
    contexts: [
      {
        id: 'CTX-DEMO',
        title: 'Demo Context',
        description: 'A named interpretive background.',
        axiomIds: ['AX-DEMO'],
        reviewState: 'accepted',
      },
    ],
    arguments: [
      {
        id: 'ARG-DEMO-A1',
        title: 'Original explanation',
        examples: [
          { id: 'EX-A', text: 'Example A' },
          { id: 'EX-B', text: 'Example B' },
        ],
        premises: [
          {
            id: 'P-A',
            kind: 'text',
            text: 'Premise derived from Example A',
            exampleIds: ['EX-A'],
          },
          {
            id: 'P-B',
            kind: 'text',
            text: 'Premise derived from Example B',
            exampleIds: ['EX-B'],
          },
        ],
        reasoning: 'The examples jointly motivate the original interpretation.',
        conclusion: 'Original conclusion',
        reviewState: 'accepted',
      },
      {
        id: 'ARG-DEMO-A2',
        title: 'Refined explanation',
        premises: [
          {
            id: 'P-REUSE-A',
            kind: 'argument-premise',
            argumentId: 'ARG-DEMO-A1',
            premiseId: 'P-A',
          },
          {
            id: 'P-REUSE-B',
            kind: 'argument-premise',
            argumentId: 'ARG-DEMO-A1',
            premiseId: 'P-B',
          },
          { id: 'P-NEW', kind: 'text', text: 'Additional premise' },
        ],
        reasoning:
          'The original premises survive, but their relationship changes.',
        conclusion: 'Refined conclusion',
        boundary: 'A specified irrelevant variation leaves it unchanged.',
        relations: [
          {
            id: 'REL-A2-A1',
            kind: 'attack',
            targetArgumentId: 'ARG-DEMO-A1',
            targetPart: { kind: 'reasoning' },
          },
        ],
        contextIds: ['CTX-DEMO'],
        supersedesArgumentId: 'ARG-DEMO-A1',
        reviewState: 'accepted',
      },
    ],
    memberships: [
      { topicId: 'TOP-DEMO', kind: 'argument', recordId: 'ARG-DEMO-A1' },
      { topicId: 'TOP-DEMO', kind: 'argument', recordId: 'ARG-DEMO-A2' },
    ],
    currentPromotions: [{ topicId: 'TOP-DEMO', argumentId: 'ARG-DEMO-A2' }],
  };
}

describe('Argument Workspace Insert JSON', () => {
  it('builds one candidate with same-payload references, explicit history, membership, Current, and search visibility', () => {
    const host = snapshot();
    const before = canonicalJson(host.snapshot.library);

    const result = previewArgumentWorkspaceInsert(
      host.snapshot,
      JSON.stringify(completePayload()),
      host.clock,
    );

    expect(result.status).toBe('valid');
    expect(canonicalJson(host.snapshot.library)).toBe(before);
    if (result.status !== 'valid') return;
    const { candidate, preview } = result.plan;
    const topic = candidate.topics.find(({ id }) => id === 'TOP-DEMO')!;
    const original = candidate.arguments.find(
      ({ id }) => id === 'ARG-DEMO-A1',
    )!;
    const refined = candidate.arguments.find(({ id }) => id === 'ARG-DEMO-A2')!;
    expect(refined.premises.slice(0, 2)).toMatchObject([
      { argumentId: original.id, premiseId: 'P-A', reliedOnRevision: 1 },
      { argumentId: original.id, premiseId: 'P-B', reliedOnRevision: 1 },
    ]);
    expect(refined.relations).toEqual([
      {
        id: 'REL-A2-A1',
        kind: 'attack',
        targetArgumentId: original.id,
        targetPart: { kind: 'reasoning' },
        reliedOnRevision: 1,
      },
    ]);
    expect(refined.supersedesArgumentId).toBe(original.id);
    expect(refined.contextIds).toEqual(['CTX-DEMO']);
    expect(candidate.contexts).toContainEqual(
      expect.objectContaining({
        id: 'CTX-DEMO',
        axiomIds: ['AX-DEMO'],
      }),
    );
    expect(topic.argumentIds).toEqual([original.id, refined.id]);
    expect(topic.currentArgumentId).toBe(refined.id);
    expect(candidate.arguments).toContain(original);
    expect(preview.resolvedPins).toHaveLength(3);
    expect(preview.counts).toEqual({
      topics: 1,
      contexts: 1,
      axioms: 1,
      arguments: 2,
      counterArguments: 0,
    });
    const search = createKnowledgeReader(
      captureArgumentLibrarySnapshot(candidate),
    ).searchIndex({ query: 'Refined explanation' });
    expect(search.status).toBe('ok');
    if (search.status === 'ok') {
      expect(search.value.candidates).toContainEqual(
        expect.objectContaining({ id: 'ARG-DEMO-A2' }),
      );
    }
  });

  it('accepts attack/support cycles because they are not inference dependencies', () => {
    const host = snapshot();
    const payload = completePayload();
    payload.arguments[0]!.relations = [
      {
        id: 'REL-A1-A2',
        kind: 'support',
        targetArgumentId: 'ARG-DEMO-A2',
        targetPart: { kind: 'conclusion' },
      },
    ];

    const result = previewArgumentWorkspaceInsert(
      host.snapshot,
      JSON.stringify(payload),
      host.clock,
    );

    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.plan.preview.relations).toHaveLength(2);
    }
  });

  it('pins against the final candidate revision after promotion updates an existing Argument', () => {
    const clock = runtime();
    let library = createEmptyArgumentLibrary(clock, 'library-promotion-pin');
    library = createTopic(
      library,
      { id: 'TOP-EXISTING', title: 'Existing Topic', summary: 'Neutral.' },
      clock,
    );
    library = createArgument(
      library,
      {
        id: 'ARG-CURRENT',
        title: 'Current',
        premises: [],
        conclusion: 'Current conclusion.',
        reviewState: 'accepted',
      },
      clock,
    );
    library = createArgument(
      library,
      {
        id: 'ARG-PROMOTED',
        title: 'Promoted',
        premises: [],
        conclusion: 'Promoted conclusion.',
        reviewState: 'accepted',
      },
      clock,
    );
    library = setTopicMembership(
      library,
      'TOP-EXISTING',
      'argument',
      'ARG-CURRENT',
      true,
      clock,
    );
    library = setTopicMembership(
      library,
      'TOP-EXISTING',
      'argument',
      'ARG-PROMOTED',
      true,
      clock,
    );
    library = promoteArgumentToCurrent(
      library,
      'TOP-EXISTING',
      'ARG-CURRENT',
      clock,
    );
    const promotedBefore = library.arguments.find(
      ({ id }) => id === 'ARG-PROMOTED',
    )!;

    const result = previewArgumentWorkspaceInsert(
      captureArgumentLibrarySnapshot(library),
      JSON.stringify({
        format: 'argument-workspace-insert-v1',
        arguments: [
          {
            id: 'ARG-REFERENCING',
            title: 'References final candidate',
            premises: [
              {
                id: 'P-REFERENCE',
                kind: 'argument-conclusion',
                argumentId: 'ARG-PROMOTED',
              },
            ],
            conclusion: 'A downstream conclusion.',
          },
        ],
        currentPromotions: [
          { topicId: 'TOP-EXISTING', argumentId: 'ARG-PROMOTED' },
        ],
      }),
      clock,
    );

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    const promoted = result.plan.candidate.arguments.find(
      ({ id }) => id === 'ARG-PROMOTED',
    )!;
    const referencing = result.plan.candidate.arguments.find(
      ({ id }) => id === 'ARG-REFERENCING',
    )!;
    expect(promoted.revision).toBe(promotedBefore.revision + 1);
    expect(promoted.supersedesArgumentId).toBe('ARG-CURRENT');
    expect(referencing.premises[0]).toMatchObject({
      argumentId: 'ARG-PROMOTED',
      reliedOnRevision: promoted.revision,
    });
  });

  it.each([
    [
      'duplicate payload ID',
      (payload: ReturnType<typeof completePayload>) => {
        payload.arguments[1]!.id = 'ARG-DEMO-A1';
      },
      /duplicated/i,
    ],
    [
      'dangling premise',
      (payload: ReturnType<typeof completePayload>) => {
        const premise = payload.arguments[1]!.premises[0] as {
          argumentId: string;
        };
        premise.argumentId = 'ARG-MISSING';
      },
      /unknown argument/i,
    ],
    [
      'inference cycle',
      (payload: ReturnType<typeof completePayload>) => {
        const argument = payload.arguments[0] as { premises: unknown[] };
        argument.premises = [
          {
            id: 'P-CYCLE',
            kind: 'argument-conclusion',
            argumentId: 'ARG-DEMO-A2',
          },
        ];
      },
      /dependency cycle/i,
    ],
    [
      'late invalid promotion',
      (payload: ReturnType<typeof completePayload>) => {
        payload.currentPromotions[0]!.argumentId = 'ARG-MISSING';
      },
      /unknown argument/i,
    ],
  ])(
    'rejects %s without changing the input snapshot',
    (_name, mutate, message) => {
      const host = snapshot();
      const before = canonicalJson(host.snapshot.library);
      const payload = completePayload();
      mutate(payload);

      const result = previewArgumentWorkspaceInsert(
        host.snapshot,
        JSON.stringify(payload),
        host.clock,
      );

      expect(result).toMatchObject({ status: 'invalid' });
      if (result.status === 'invalid') {
        expect(result.issues.map((issue) => issue.message).join(' ')).toMatch(
          message,
        );
      }
      expect(canonicalJson(host.snapshot.library)).toBe(before);
    },
  );

  it('rejects an explicit stale revision instead of silently replacing it', () => {
    const host = snapshot();
    const payload = completePayload();
    const premise = payload.arguments[1]!.premises[0] as {
      reliedOnRevision?: number;
    };
    premise.reliedOnRevision = 99;

    const result = previewArgumentWorkspaceInsert(
      host.snapshot,
      JSON.stringify(payload),
      host.clock,
    );

    expect(result).toMatchObject({
      status: 'invalid',
      issues: [
        expect.objectContaining({
          path: '$.arguments[1].premises[0].reliedOnRevision',
          message: expect.stringMatching(/must equal.*revision 1/i),
        }),
      ],
    });
  });
});
