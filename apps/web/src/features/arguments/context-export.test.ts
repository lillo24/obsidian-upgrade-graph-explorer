import { describe, expect, it } from 'vitest';

import {
  attachAnsweringAxiom,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createKnowledgeReaderFromLibrary,
  createTopic,
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
});
