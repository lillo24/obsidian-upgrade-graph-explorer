import { assertPlainData, clonePlainData } from './plain-data';
import type {
  ContributionReference,
  IntegrationIssueInput,
  IntegrationRelation,
  IntegrationResult,
  IntegrationResultInput,
  JsonValue,
  PostCheckFindingKind,
  PostCheckResult,
  PostCheckResultInput,
  ReviewAttemptRecord,
  ReviewStage,
  VerifiedContributionReference,
} from './types';

const RELATIONS = new Set<IntegrationRelation>([
  'agreement',
  'compatible',
  'direct-disagreement',
  'negative-only',
  'positive-only',
]);
const FINDING_KINDS = new Set<PostCheckFindingKind>([
  'applicable-resolution',
  'existing-response-criticism',
  'axiom-criticism',
  'correction',
  'open-question',
]);

export class StructuredOutputError extends Error {
  public constructor(public readonly errors: string[]) {
    super(errors.join(' '));
    this.name = 'StructuredOutputError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function parseReferences(
  value: unknown,
  path: string,
  errors: string[],
): ContributionReference[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array.`);
    return [];
  }
  return value.flatMap((candidate, index) => {
    if (!isObject(candidate) || !nonEmptyString(candidate.attemptId)) {
      errors.push(`${path}[${index}] must contain a non-empty attemptId.`);
      return [];
    }
    if (
      candidate.locator !== undefined &&
      typeof candidate.locator !== 'string'
    ) {
      errors.push(`${path}[${index}].locator must be a string when present.`);
      return [];
    }
    if (candidate.quote !== undefined && typeof candidate.quote !== 'string') {
      errors.push(`${path}[${index}].quote must be a string when present.`);
      return [];
    }
    return [
      {
        attemptId: candidate.attemptId,
        ...(candidate.locator === undefined
          ? {}
          : { locator: candidate.locator }),
        ...(candidate.quote === undefined ? {} : { quote: candidate.quote }),
      },
    ];
  });
}

function parseIntegrationIssue(
  candidate: unknown,
  index: number,
  errors: string[],
): IntegrationIssueInput | undefined {
  const path = `issues[${index}]`;
  if (!isObject(candidate)) {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const relation = candidate.relation;
  if (!nonEmptyString(candidate.id)) errors.push(`${path}.id is required.`);
  if (
    typeof relation !== 'string' ||
    !RELATIONS.has(relation as IntegrationRelation)
  ) {
    errors.push(`${path}.relation is invalid.`);
  }
  if (!nonEmptyString(candidate.integrationMarkdown)) {
    errors.push(`${path}.integrationMarkdown is required.`);
  }
  if (!stringArray(candidate.unresolvedPoints)) {
    errors.push(`${path}.unresolvedPoints must be a string array.`);
  }
  if (!stringArray(candidate.integratorNotes)) {
    errors.push(`${path}.integratorNotes must be a string array.`);
  }
  if (
    candidate.negativeContribution !== undefined &&
    typeof candidate.negativeContribution !== 'string'
  ) {
    errors.push(`${path}.negativeContribution must be a string when present.`);
  }
  if (
    candidate.positiveContribution !== undefined &&
    typeof candidate.positiveContribution !== 'string'
  ) {
    errors.push(`${path}.positiveContribution must be a string when present.`);
  }
  const negativeReferences = parseReferences(
    candidate.negativeReferences,
    `${path}.negativeReferences`,
    errors,
  );
  const positiveReferences = parseReferences(
    candidate.positiveReferences,
    `${path}.positiveReferences`,
    errors,
  );
  if (
    typeof relation === 'string' &&
    [
      'agreement',
      'compatible',
      'direct-disagreement',
      'negative-only',
    ].includes(relation) &&
    negativeReferences.length === 0
  ) {
    errors.push(
      `${path} requires a Negative reference for relation ${relation}.`,
    );
  }
  if (
    typeof relation === 'string' &&
    [
      'agreement',
      'compatible',
      'direct-disagreement',
      'positive-only',
    ].includes(relation) &&
    positiveReferences.length === 0
  ) {
    errors.push(
      `${path} requires a Positive reference for relation ${relation}.`,
    );
  }
  if (
    !nonEmptyString(candidate.id) ||
    typeof relation !== 'string' ||
    !RELATIONS.has(relation as IntegrationRelation) ||
    !nonEmptyString(candidate.integrationMarkdown) ||
    !stringArray(candidate.unresolvedPoints) ||
    !stringArray(candidate.integratorNotes)
  ) {
    return undefined;
  }
  return {
    id: candidate.id,
    relation: relation as IntegrationRelation,
    negativeReferences,
    positiveReferences,
    ...(typeof candidate.negativeContribution === 'string'
      ? { negativeContribution: candidate.negativeContribution }
      : {}),
    ...(typeof candidate.positiveContribution === 'string'
      ? { positiveContribution: candidate.positiveContribution }
      : {}),
    integrationMarkdown: candidate.integrationMarkdown,
    unresolvedPoints: candidate.unresolvedPoints,
    integratorNotes: candidate.integratorNotes,
  };
}

function verifyReference(
  reference: ContributionReference,
  attempts: Map<string, ReviewAttemptRecord>,
  allowedStages: ReviewStage[],
  warnings: string[],
): VerifiedContributionReference {
  const attempt = attempts.get(reference.attemptId);
  let message: string | undefined;
  if (!attempt) {
    message = `Unknown attempt ${reference.attemptId}.`;
  } else if (!allowedStages.includes(attempt.stage)) {
    message = `Attempt ${reference.attemptId} has stage ${attempt.stage}, not ${allowedStages.join(' or ')}.`;
  } else if (!attempt.output) {
    message = `Attempt ${reference.attemptId} has no retained output.`;
  } else if (
    reference.quote !== undefined &&
    !attempt.output.rawMarkdown.includes(reference.quote)
  ) {
    message = `Quoted passage was not found in attempt ${reference.attemptId}.`;
  }
  if (message) warnings.push(message);
  return {
    ...reference,
    verification: message ? 'invalid' : 'verified',
    ...(message ? { verificationMessage: message } : {}),
  };
}

export function validateIntegrationResult(
  value: JsonValue,
  negative: ReviewAttemptRecord,
  positive: ReviewAttemptRecord,
): IntegrationResult {
  assertPlainData(value, 'Integration structured output');
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new StructuredOutputError(['Integration output must be an object.']);
  }
  if (value.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (!nonEmptyString(value.summary)) errors.push('summary is required.');
  if (!Array.isArray(value.issues) || value.issues.length === 0) {
    errors.push('issues must be a non-empty array.');
  }
  if (!stringArray(value.unresolvedQuestions)) {
    errors.push('unresolvedQuestions must be a string array.');
  }
  const issues = Array.isArray(value.issues)
    ? value.issues.flatMap((issue, index) => {
        const parsed = parseIntegrationIssue(issue, index, errors);
        return parsed ? [parsed] : [];
      })
    : [];
  const ids = new Set<string>();
  for (const issue of issues) {
    if (ids.has(issue.id)) errors.push(`Issue ID ${issue.id} is duplicated.`);
    ids.add(issue.id);
  }
  if (errors.length > 0) throw new StructuredOutputError(errors);

  const input: IntegrationResultInput = {
    schemaVersion: 1,
    summary: value.summary as string,
    issues,
    unresolvedQuestions: value.unresolvedQuestions as string[],
  };
  const attempts = new Map([
    [negative.id, negative],
    [positive.id, positive],
  ]);
  const warnings: string[] = [];
  return clonePlainData({
    ...input,
    issues: input.issues.map((issue) => ({
      ...issue,
      negativeReferences: issue.negativeReferences.map((reference) =>
        verifyReference(reference, attempts, ['negative'], warnings),
      ),
      positiveReferences: issue.positiveReferences.map((reference) =>
        verifyReference(reference, attempts, ['positive'], warnings),
      ),
    })),
    validationWarnings: warnings,
  });
}

export function validatePostCheckResult(
  value: JsonValue,
  referencedAttempts: ReviewAttemptRecord[],
): PostCheckResult {
  assertPlainData(value, 'Post-check structured output');
  const errors: string[] = [];
  if (!isObject(value)) {
    throw new StructuredOutputError(['Post-check output must be an object.']);
  }
  if (value.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (!nonEmptyString(value.summary)) errors.push('summary is required.');
  if (!Array.isArray(value.findings)) errors.push('findings must be an array.');
  if (
    value.revisedSynthesis !== undefined &&
    typeof value.revisedSynthesis !== 'string'
  ) {
    errors.push('revisedSynthesis must be a string when present.');
  }
  const findings: PostCheckResultInput['findings'] = [];
  if (Array.isArray(value.findings)) {
    value.findings.forEach((finding, index) => {
      const path = `findings[${index}]`;
      if (!isObject(finding)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      if (!nonEmptyString(finding.id)) errors.push(`${path}.id is required.`);
      if (
        typeof finding.kind !== 'string' ||
        !FINDING_KINDS.has(finding.kind as PostCheckFindingKind)
      ) {
        errors.push(`${path}.kind is invalid.`);
      }
      if (!nonEmptyString(finding.markdown)) {
        errors.push(`${path}.markdown is required.`);
      }
      const references = parseReferences(
        finding.references,
        `${path}.references`,
        errors,
      );
      if (
        nonEmptyString(finding.id) &&
        typeof finding.kind === 'string' &&
        FINDING_KINDS.has(finding.kind as PostCheckFindingKind) &&
        nonEmptyString(finding.markdown)
      ) {
        findings.push({
          id: finding.id,
          kind: finding.kind as PostCheckFindingKind,
          markdown: finding.markdown,
          references,
        });
      }
    });
  }
  const ids = new Set<string>();
  for (const finding of findings) {
    if (ids.has(finding.id))
      errors.push(`Finding ID ${finding.id} is duplicated.`);
    ids.add(finding.id);
  }
  if (errors.length > 0) throw new StructuredOutputError(errors);
  const attempts = new Map(
    referencedAttempts.map((attempt) => [attempt.id, attempt]),
  );
  const warnings: string[] = [];
  return clonePlainData({
    schemaVersion: 1,
    summary: value.summary as string,
    findings: findings.map((finding) => ({
      ...finding,
      references: finding.references.map((reference) =>
        verifyReference(
          reference,
          attempts,
          ['negative', 'positive', 'integrator'],
          warnings,
        ),
      ),
    })),
    ...(typeof value.revisedSynthesis === 'string'
      ? { revisedSynthesis: value.revisedSynthesis }
      : {}),
    validationWarnings: warnings,
  });
}

export function structuredCandidate(
  structured: JsonValue | undefined,
  rawText: string,
): JsonValue {
  if (structured !== undefined) return structured;
  try {
    const parsed: unknown = JSON.parse(rawText);
    assertPlainData(parsed, 'Parsed structured output');
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      throw new StructuredOutputError([
        `No valid structured output was supplied: ${error.message}`,
      ]);
    }
    throw error;
  }
}
