import { describe, expect, it } from 'vitest';

import {
  attachAnsweringAxiom,
  createArgument,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createKnowledgeReaderFromLibrary,
  createTopic,
  editAxiom,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

import { formatArgumentBundle } from './context-export';

describe('argument-library context formatting', () => {
  it('formats only a complete core bundle and retains its structured receipt', () => {
    let serial = 0;
    const runtime: ArgumentRuntime = {
      createId: (kind) => `${kind}-${++serial}`,
      now: () => `2026-01-01T00:00:${String(serial++).padStart(2, '0')}.000Z`,
    };
    let library = createEmptyArgumentLibrary(runtime, 'context-test');
    library = createTopic(
      library,
      { id: 'T-NEUTRAL', title: 'Neutral topic', summary: 'Neutral summary.' },
      runtime,
    );
    library = createAxiom(
      library,
      {
        id: 'AX-NEUTRAL',
        title: 'Neutral Axiom',
        statement: 'Neutral premise.\n\n```text\nkept fence\n```',
        supportingReasoning: 'First line.\nSecond line.',
        sourceReferences: [
          {
            id: 'SRC-CONTEXT',
            path: 'Theory/Neutral.md',
            heading: 'Structured heading',
            label: 'Readable source',
            originalWikilink: '[[Neutral#Authored heading|Source alias]]',
            role: 'support',
          },
        ],
      },
      runtime,
    );
    library = createCounterArgument(
      library,
      {
        id: 'CA-NEUTRAL',
        title: 'Neutral objection',
        observation: 'Neutral observation.',
        challengedClaim: 'Neutral challenged claim.',
        target: { kind: 'axiom', axiomId: 'AX-NEUTRAL' },
        response: {
          explanation: 'Neutral response.',
          outcome: 'refuted',
        },
      },
      runtime,
    );
    library = attachAnsweringAxiom(
      library,
      'CA-NEUTRAL',
      'AX-NEUTRAL',
      runtime,
    );
    const reader = createKnowledgeReaderFromLibrary(library);
    const result = reader.readArgumentBundle({
      id: 'CA-NEUTRAL',
      kind: 'counter-argument',
      maxRecords: 10,
    });
    if (result.status !== 'ok') throw new Error('Neutral bundle failed.');

    const formatted = formatArgumentBundle(result.value);

    expect(formatted.text).toContain('Linked theory source text not read.');
    expect(formatted.text).toContain('Observation / example / argument:');
    expect(formatted.text).toContain('Recorded response — why it applies:');
    expect(formatted.text).toContain('Answered using: AX-NEUTRAL@');
    expect(formatted.text).toContain(
      '### Supporting reasoning\n\nFirst line.\nSecond line.',
    );
    expect(formatted.text).toContain('Structured target: Axiom: AX-NEUTRAL');
    expect(formatted.text).toContain(
      '[[Neutral#Authored heading|Source alias]] [support; SRC-CONTEXT]',
    );
    expect(formatted.text).not.toContain(
      '[[Neutral#Authored heading|Source alias]]#Structured heading',
    );
    expect(formatted.text).toContain('```text\nkept fence\n```');
    expect(JSON.parse(formatted.structured)).toMatchObject({
      completeness: { status: 'complete', theorySources: 'not-read' },
      receipt: { completeness: 'complete' },
    });
  });

  it('formats inherited dependency paths for compiler-readable context', () => {
    let serial = 0;
    const runtime: ArgumentRuntime = {
      createId: (kind) => `${kind}-${++serial}`,
      now: () => `2026-01-02T00:00:${String(serial++).padStart(2, '0')}.000Z`,
    };
    let library = createEmptyArgumentLibrary(runtime, 'context-stale');
    library = createAxiom(
      library,
      { id: 'AX-ROOT', title: 'Root', statement: 'Root support.' },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A1',
        title: 'First',
        premises: [
          {
            id: 'A1-P1',
            kind: 'axiom',
            axiomId: 'AX-ROOT',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'First conclusion.',
      },
      runtime,
    );
    library = createArgument(
      library,
      {
        id: 'A2',
        title: 'Second',
        premises: [
          {
            id: 'A2-P1',
            kind: 'argument-conclusion',
            argumentId: 'A1',
            reliedOnRevision: 1,
          },
        ],
        conclusion: 'Second conclusion.',
      },
      runtime,
    );
    library = editAxiom(
      library,
      'AX-ROOT',
      { statement: 'Revised root support.' },
      runtime,
    );
    const result = createKnowledgeReaderFromLibrary(library).readArgumentBundle(
      { id: 'A2', kind: 'argument' },
    );
    if (result.status !== 'ok') throw new Error('Stale bundle failed.');

    const formatted = formatArgumentBundle(result.value);
    expect(formatted.text).toContain(
      'A2-P1: direct=no; inherited=yes; inherited [A2.A2-P1 -> A1.conclusion; A1.A1-P1 -> AX-ROOT] root: axiom AX-ROOT revision 1 -> 2',
    );
    expect(JSON.parse(formatted.structured)).toMatchObject({
      arguments: expect.arrayContaining([
        expect.objectContaining({
          id: 'A2',
          stalePremiseIds: ['A2-P1'],
          premiseStaleness: [
            expect.objectContaining({ direct: false, inherited: true }),
          ],
        }),
      ]),
    });
  });
});
