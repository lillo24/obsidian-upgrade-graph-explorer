import { describe, expect, it } from 'vitest';

import {
  OPENAI_INTEGRATOR_OUTPUT,
  OPENAI_POST_CHECK_OUTPUT,
  normalizeStructuredOutput,
} from './openai-output-schemas';

describe('OpenAI Review structured output schemas', () => {
  it('normalizes nullable transport fields to provider-neutral optional fields', () => {
    const output = normalizeStructuredOutput('integrator', {
      rawMarkdown: '# Integration',
      structured: {
        schemaVersion: 1,
        summary: 'Summary',
        issues: [
          {
            id: 'issue-1',
            relation: 'compatible',
            negativeReferences: [
              { attemptId: 'negative-1', locator: null, quote: null },
            ],
            positiveReferences: [],
            negativeContribution: null,
            positiveContribution: 'Positive contribution',
            integrationMarkdown: 'Integrated.',
            unresolvedPoints: [],
            integratorNotes: [],
          },
        ],
        unresolvedQuestions: [],
      },
    });
    expect(output).toEqual({
      rawMarkdown: '# Integration',
      structured: {
        schemaVersion: 1,
        summary: 'Summary',
        issues: [
          {
            id: 'issue-1',
            relation: 'compatible',
            negativeReferences: [{ attemptId: 'negative-1' }],
            positiveReferences: [],
            positiveContribution: 'Positive contribution',
            integrationMarkdown: 'Integrated.',
            unresolvedPoints: [],
            integratorNotes: [],
          },
        ],
        unresolvedQuestions: [],
      },
    });
  });

  it('rejects missing, malformed, and extra transport fields', () => {
    expect(() =>
      OPENAI_INTEGRATOR_OUTPUT.parse({
        rawMarkdown: '# Integration',
        structured: { schemaVersion: 1 },
      }),
    ).toThrow();
    expect(() =>
      OPENAI_POST_CHECK_OUTPUT.parse({
        rawMarkdown: '# Post-check',
        structured: {
          schemaVersion: 1,
          summary: 'Summary',
          findings: [],
          revisedSynthesis: null,
          extra: true,
        },
      }),
    ).toThrow();
  });
});
