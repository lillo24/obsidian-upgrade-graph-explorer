import { z } from 'zod';

import type {
  IntegrationResultInput,
  JsonValue,
  PostCheckResultInput,
  ReviewStage,
} from '@icarus-graph-explorer/ai-review';

const contributionReference = z
  .object({
    attemptId: z.string().min(1),
    locator: z.string().nullable(),
    quote: z.string().nullable(),
  })
  .strict();

const integrationResult = z
  .object({
    schemaVersion: z.literal(1),
    summary: z.string().min(1),
    issues: z
      .array(
        z
          .object({
            id: z.string().min(1),
            relation: z.enum([
              'agreement',
              'compatible',
              'direct-disagreement',
              'negative-only',
              'positive-only',
            ]),
            negativeReferences: z.array(contributionReference),
            positiveReferences: z.array(contributionReference),
            negativeContribution: z.string().nullable(),
            positiveContribution: z.string().nullable(),
            integrationMarkdown: z.string().min(1),
            unresolvedPoints: z.array(z.string()),
            integratorNotes: z.array(z.string()),
          })
          .strict(),
      )
      .min(1),
    unresolvedQuestions: z.array(z.string()),
  })
  .strict();

const postCheckResult = z
  .object({
    schemaVersion: z.literal(1),
    summary: z.string().min(1),
    findings: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum([
            'applicable-resolution',
            'existing-response-criticism',
            'axiom-criticism',
            'correction',
            'open-question',
          ]),
          markdown: z.string().min(1),
          references: z.array(contributionReference),
        })
        .strict(),
    ),
    revisedSynthesis: z.string().nullable(),
  })
  .strict();

export const OPENAI_INTEGRATOR_OUTPUT = z
  .object({
    rawMarkdown: z.string().min(1),
    structured: integrationResult,
  })
  .strict();

export const OPENAI_POST_CHECK_OUTPUT = z
  .object({
    rawMarkdown: z.string().min(1),
    structured: postCheckResult,
  })
  .strict();

type IntegrationTransport = z.infer<typeof OPENAI_INTEGRATOR_OUTPUT>;
type PostCheckTransport = z.infer<typeof OPENAI_POST_CHECK_OUTPUT>;

function reference(
  input: z.infer<typeof contributionReference>,
): IntegrationResultInput['issues'][number]['negativeReferences'][number] {
  return {
    attemptId: input.attemptId,
    ...(input.locator === null ? {} : { locator: input.locator }),
    ...(input.quote === null ? {} : { quote: input.quote }),
  };
}

export function normalizeIntegratorOutput(input: IntegrationTransport): {
  rawMarkdown: string;
  structured: IntegrationResultInput;
} {
  return {
    rawMarkdown: input.rawMarkdown,
    structured: {
      ...input.structured,
      issues: input.structured.issues.map((issue) => ({
        id: issue.id,
        relation: issue.relation,
        negativeReferences: issue.negativeReferences.map(reference),
        positiveReferences: issue.positiveReferences.map(reference),
        ...(issue.negativeContribution === null
          ? {}
          : { negativeContribution: issue.negativeContribution }),
        ...(issue.positiveContribution === null
          ? {}
          : { positiveContribution: issue.positiveContribution }),
        integrationMarkdown: issue.integrationMarkdown,
        unresolvedPoints: issue.unresolvedPoints,
        integratorNotes: issue.integratorNotes,
      })),
    },
  };
}

export function normalizePostCheckOutput(input: PostCheckTransport): {
  rawMarkdown: string;
  structured: PostCheckResultInput;
} {
  return {
    rawMarkdown: input.rawMarkdown,
    structured: {
      schemaVersion: 1,
      summary: input.structured.summary,
      findings: input.structured.findings.map((finding) => ({
        ...finding,
        references: finding.references.map(reference),
      })),
      ...(input.structured.revisedSynthesis === null
        ? {}
        : { revisedSynthesis: input.structured.revisedSynthesis }),
    },
  };
}

export function outputSchemaForStage(
  stage: ReviewStage,
):
  | typeof OPENAI_INTEGRATOR_OUTPUT
  | typeof OPENAI_POST_CHECK_OUTPUT
  | undefined {
  if (stage === 'integrator') return OPENAI_INTEGRATOR_OUTPUT;
  if (stage === 'post-check') return OPENAI_POST_CHECK_OUTPUT;
  return undefined;
}

export function normalizeStructuredOutput(
  stage: ReviewStage,
  value: unknown,
): { rawMarkdown: string; structured: JsonValue } {
  if (stage === 'integrator') {
    const output = normalizeIntegratorOutput(
      OPENAI_INTEGRATOR_OUTPUT.parse(value),
    );
    const structured: unknown = output.structured;
    return {
      rawMarkdown: output.rawMarkdown,
      structured: structured as JsonValue,
    };
  }
  if (stage === 'post-check') {
    const output = normalizePostCheckOutput(
      OPENAI_POST_CHECK_OUTPUT.parse(value),
    );
    const structured: unknown = output.structured;
    return {
      rawMarkdown: output.rawMarkdown,
      structured: structured as JsonValue,
    };
  }
  throw new Error(`Stage ${stage} does not use structured output.`);
}
