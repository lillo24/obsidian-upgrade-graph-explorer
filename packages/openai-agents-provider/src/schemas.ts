import type { JsonValue, ReviewStage } from '@icarus-graph-explorer/ai-review';

const STRING = { type: 'string' } as const;
const NON_EMPTY_STRING = { type: 'string', minLength: 1 } as const;
const STRING_ARRAY = { type: 'array', items: STRING } as const;

const REFERENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    attemptId: NON_EMPTY_STRING,
    locator: STRING,
    quote: STRING,
  },
  required: ['attemptId'],
} as const;

const INTEGRATION_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    summary: NON_EMPTY_STRING,
    issues: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: NON_EMPTY_STRING,
          relation: {
            type: 'string',
            enum: [
              'agreement',
              'compatible',
              'direct-disagreement',
              'negative-only',
              'positive-only',
            ],
          },
          negativeReferences: {
            type: 'array',
            items: REFERENCE_SCHEMA,
          },
          positiveReferences: {
            type: 'array',
            items: REFERENCE_SCHEMA,
          },
          negativeContribution: STRING,
          positiveContribution: STRING,
          integrationMarkdown: NON_EMPTY_STRING,
          unresolvedPoints: STRING_ARRAY,
          integratorNotes: STRING_ARRAY,
        },
        required: [
          'id',
          'relation',
          'negativeReferences',
          'positiveReferences',
          'integrationMarkdown',
          'unresolvedPoints',
          'integratorNotes',
        ],
      },
    },
    unresolvedQuestions: STRING_ARRAY,
  },
  required: ['schemaVersion', 'summary', 'issues', 'unresolvedQuestions'],
} as const;

const POST_CHECK_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    summary: NON_EMPTY_STRING,
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: NON_EMPTY_STRING,
          kind: {
            type: 'string',
            enum: [
              'applicable-resolution',
              'existing-response-criticism',
              'axiom-criticism',
              'correction',
              'open-question',
            ],
          },
          markdown: NON_EMPTY_STRING,
          references: { type: 'array', items: REFERENCE_SCHEMA },
        },
        required: ['id', 'kind', 'markdown', 'references'],
      },
    },
    revisedSynthesis: STRING,
  },
  required: ['schemaVersion', 'summary', 'findings'],
} as const;

function envelope(structured: unknown): JsonValue {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      markdown: NON_EMPTY_STRING,
      structured: structured as JsonValue,
    },
    required: ['markdown', 'structured'],
  };
}

export function structuredTextSchema(
  stage: ReviewStage,
): JsonValue | undefined {
  if (stage === 'integrator') return envelope(INTEGRATION_RESULT_SCHEMA);
  if (stage === 'post-check') return envelope(POST_CHECK_RESULT_SCHEMA);
  return undefined;
}
