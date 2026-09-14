import { expect, it } from 'vitest';

import {
  ReviewEngine,
  ScriptedAgentProvider,
  SyntheticCompilerProvider,
  createSequentialIdGenerator,
  exportReviewRunMarkdown,
  type StartReviewInput,
} from '../src';

it('runs the visibly synthetic local REVIEW1 example', async () => {
  const provider = new ScriptedAgentProvider({
    negative: [
      [
        {
          type: 'tool',
          toolCallId: 'synthetic-search',
          name: 'compiler_search_index',
          arguments: { query: 'fictional', limit: 3 },
        },
        {
          type: 'terminal',
          status: 'completed',
          rawText:
            '# TEST DATA — Negative\n\nThe fictional mechanism lacks supporting evidence.',
        },
      ],
    ],
    positive: [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText:
            '# TEST DATA — Positive\n\nThe fictional mechanism is stated clearly enough to test.',
        },
      ],
    ],
    integrator: [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText:
            '# TEST DATA — Integration\n\nClarity and evidential support are separate questions.',
          structured: {
            schemaVersion: 1,
            summary: 'Synthetic integration only.',
            issues: [
              {
                id: 'synthetic-issue-1',
                relation: 'compatible',
                negativeReferences: [
                  {
                    attemptId: 'example-attempt-1',
                    quote: 'fictional mechanism lacks supporting evidence',
                  },
                ],
                positiveReferences: [
                  {
                    attemptId: 'example-attempt-2',
                    quote: 'fictional mechanism is stated clearly',
                  },
                ],
                negativeContribution: 'Evidence is absent.',
                positiveContribution: 'The proposition is inspectable.',
                integrationMarkdown:
                  'A clear proposition can still lack evidence.',
                unresolvedPoints: ['No real evidence was supplied.'],
                integratorNotes: [],
              },
            ],
            unresolvedQuestions: ['What evidence would test the mechanism?'],
          },
        },
      ],
    ],
    'post-check': [
      [
        {
          type: 'tool',
          toolCallId: 'synthetic-bundle',
          name: 'compiler_read_bundle',
          arguments: { id: 'counterargument:fictional' },
        },
        {
          type: 'terminal',
          status: 'completed',
          rawText:
            '# TEST DATA — Post-check\n\nThe fictional record narrows no real claim.',
          structured: {
            schemaVersion: 1,
            summary: 'Synthetic post-check only.',
            findings: [
              {
                id: 'synthetic-finding-1',
                kind: 'open-question',
                markdown: 'Real evidence remains required.',
                references: [{ attemptId: 'example-attempt-3' }],
              },
            ],
          },
        },
      ],
    ],
  });
  const compiler = new SyntheticCompilerProvider({
    descriptor: {
      snapshotId: 'example-synthetic-snapshot',
      revision: 'example-synthetic-revision',
      capabilities: [
        'list-index',
        'search-index',
        'read-bundle',
        'read-source',
      ],
    },
    entries: [
      {
        id: 'counterargument:fictional',
        kind: 'counter-argument',
        title: 'Fictional objection',
        summary: 'Explicitly synthetic compiler fixture.',
      },
    ],
    bundles: [
      {
        id: 'counterargument:fictional',
        objection: 'Fictional objection.',
        challenges: 'Fictional mechanism.',
        answeringAxioms: ['axiom:fictional'],
        recordedResponse: 'Fictional response.',
        whyResponseApplies: 'Test fixture only.',
        outcome: 'open',
        scope: 'local scripted example',
        boundaries: ['Not a real conclusion.'],
        sourceHeadingLinks: [],
        missingMaterial: [],
        dependentMaterial: [],
      },
    ],
    sources: [],
  });
  const input: StartReviewInput = {
    workspaceId: 'example-synthetic-workspace',
    source: {
      mode: 'supplied-material',
      selectedPaths: ['examples/fictional.md'],
      materials: [
        {
          id: 'fictional-source',
          relativePath: 'examples/fictional.md',
          kind: 'source',
          content:
            '# TEST DATA\n\nA fictional mechanism produces a fictional result.',
          provenance: {
            kind: 'supplied',
            label: 'scripted example fixture',
          },
        },
      ],
      completeness: 'complete',
      missingMaterial: [],
      omissions: [],
    },
    additionalRequest: 'Review this test fixture; do not treat it as fact.',
    models: {
      analysis: { provider: 'scripted', model: 'synthetic-analysis' },
      integrator: { provider: 'scripted', model: 'synthetic-integrator' },
      postCheck: { provider: 'scripted', model: 'synthetic-post-check' },
    },
    compiler: { analysis: true, integrator: false, postCheck: true },
  };

  const run = await (
    await new ReviewEngine({
      provider,
      compilerProvider: compiler,
      ids: createSequentialIdGenerator('example'),
    }).start(input)
  ).completion;

  expect(run.state).toBe('completed');
  expect(run.attempts).toHaveLength(4);
  console.log(
    '\n===== SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION =====\n',
    exportReviewRunMarkdown(run),
  );
});
