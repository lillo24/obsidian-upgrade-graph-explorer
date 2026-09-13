import {
  ReviewEngine,
  ScriptedAgentProvider,
  SyntheticCompilerProvider,
  createSequentialIdGenerator,
  exportReviewRunJson,
  type ReviewClock,
} from '@icarus-graph-explorer/ai-review';

const SYNTHETIC_LABEL = 'SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION';

const clock: ReviewClock = {
  now: () => new Date('2026-09-13T08:00:00.000Z'),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
};

/** Explicit development-only fixture. It never reads a vault or calls a model. */
export async function createSyntheticReviewFixtureJson(): Promise<string> {
  const provider = new ScriptedAgentProvider({
    negative: [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText: `# ${SYNTHETIC_LABEL}\n\n> A deliberately fictional criticism.\n\nThe **synthetic mechanism** lacks evidence for its scale claim.\n\n| Claim | Evidence |\n| --- | --- |\n| Growth | Not supplied |\n\n\`\`\`ts\nconst bounded = true;\n\`\`\`\n\nUnsafe media remains blocked: ![remote](https://example.invalid/pixel.png)`,
        },
      ],
    ],
    positive: [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText: `# ${SYNTHETIC_LABEL}\n\nThe fictional mechanism is stated clearly enough to test. Its toy relationship is $x^2 + y^2 = z^2$, but clarity does not establish truth.\n\n- Defined inputs\n- Falsifiable output\n- Missing real observations`,
        },
      ],
    ],
    integrator: [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText: `# ${SYNTHETIC_LABEL}\n\nClarity and evidential support are compatible observations, not a compromise.`,
          structured: {
            schemaVersion: 1,
            summary: `${SYNTHETIC_LABEL}\n\nThe proposal is inspectable but unsupported.`,
            issues: [
              {
                id: 'synthetic-evidence-gap',
                relation: 'compatible',
                negativeReferences: [
                  {
                    attemptId: 'qa-attempt-1',
                    quote: 'synthetic mechanism',
                  },
                ],
                positiveReferences: [
                  {
                    attemptId: 'qa-attempt-2',
                    quote: 'fictional mechanism',
                  },
                ],
                negativeContribution:
                  'The scale claim has no supplied evidence.',
                positiveContribution:
                  'The mechanism is defined precisely enough to test.',
                integrationMarkdown:
                  'A testable statement can remain empirically unsupported.',
                unresolvedPoints: ['No real observations were supplied.'],
                integratorNotes: [
                  'This note only classifies the relationship between the fixture outputs.',
                ],
              },
            ],
            unresolvedQuestions: [
              'What observation would falsify the scale claim?',
            ],
          },
        },
      ],
    ],
    'post-check': [
      [
        {
          type: 'terminal',
          status: 'completed',
          rawText: `# ${SYNTHETIC_LABEL}\n\nNo compiler snapshot was available; no cross-check is claimed.`,
          structured: {
            schemaVersion: 1,
            summary: `${SYNTHETIC_LABEL}. No compiler conclusion is available.`,
            findings: [
              {
                id: 'synthetic-open-question',
                kind: 'open-question',
                markdown:
                  'Real evidence and compiler context remain unavailable.',
                references: [{ attemptId: 'qa-attempt-3' }],
              },
            ],
            revisedSynthesis:
              'The earlier synthesis remains visible; this separate fixture adds no proof.',
          },
        },
      ],
    ],
  });
  const run = await (
    await new ReviewEngine({
      provider,
      compilerProvider: new SyntheticCompilerProvider({
        descriptor: {
          snapshotId: 'synthetic-ui-snapshot',
          revision: 'synthetic-ui-revision',
          capabilities: [
            'list-index',
            'search-index',
            'read-bundle',
            'read-source',
          ],
        },
        entries: [],
        bundles: [],
        sources: [],
      }),
      clock,
      ids: createSequentialIdGenerator('qa'),
    }).start({
      workspaceId: 'synthetic-qa-workspace',
      source: {
        mode: 'supplied-material',
        selectedPaths: ['qa/fictional-mechanism.md'],
        materials: [
          {
            id: 'synthetic-source',
            relativePath: 'qa/fictional-mechanism.md',
            kind: 'source',
            content:
              '# Fictional mechanism\n\nA bounded fictional mechanism produces a fictional scale claim.',
            provenance: {
              kind: 'supplied',
              label: 'explicit development QA fixture',
            },
          },
        ],
        completeness: 'complete',
        missingMaterial: [],
        omissions: [],
      },
      additionalRequest:
        'Render this synthetic fixture only; do not treat it as a factual assessment.',
      models: {
        analysis: { provider: 'scripted-qa', model: 'synthetic-analysis' },
        integrator: { provider: 'scripted-qa', model: 'synthetic-integrator' },
        postCheck: { provider: 'scripted-qa', model: 'synthetic-post-check' },
      },
      compiler: { analysis: false, integrator: false, postCheck: true },
    })
  ).completion;
  return exportReviewRunJson(run);
}
