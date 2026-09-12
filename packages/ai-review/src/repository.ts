import { assertPlainData, clonePlainData, deepFreeze } from './plain-data';
import {
  REVIEW_RUN_SCHEMA_VERSION,
  type AttemptState,
  type ReviewRunRecord,
  type ReviewRunRepository,
  type ReviewStage,
  type RunState,
} from './types';

const ATTEMPT_STATES = new Set<AttemptState>([
  'queued',
  'running',
  'waiting-for-tool',
  'completed',
  'failed',
  'cancel-requested',
  'cancelled',
  'interrupted',
  'blocked',
]);
const RUN_STATES = new Set<RunState>([
  'queued',
  'running',
  'completed',
  'failed',
  'cancel-requested',
  'cancelled',
  'interrupted',
  'blocked',
]);
const STAGES = new Set<ReviewStage>([
  'negative',
  'positive',
  'integrator',
  'post-check',
]);

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateReviewRunRecord(value: unknown): ReviewRunRecord {
  assertPlainData(value, 'Review run JSON');
  if (!object(value)) throw new Error('Review run must be an object.');
  if (value.schemaVersion !== REVIEW_RUN_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported review run schema ${String(value.schemaVersion)}; expected ${REVIEW_RUN_SCHEMA_VERSION}.`,
    );
  }
  if (!nonEmptyString(value.id)) throw new Error('Review run ID is required.');
  if (
    typeof value.state !== 'string' ||
    !RUN_STATES.has(value.state as RunState)
  ) {
    throw new Error('Review run state is invalid.');
  }
  if (
    !object(value.frozenInput) ||
    !nonEmptyString(value.frozenInput.fingerprint)
  ) {
    throw new Error('Review run frozen input/fingerprint is missing.');
  }
  if (!Array.isArray(value.attempts)) {
    throw new Error('Review run attempts must be an array.');
  }
  const attemptIds = new Set<string>();
  const attemptById = new Map<string, Record<string, unknown>>();
  for (const [index, attempt] of value.attempts.entries()) {
    if (!object(attempt) || !nonEmptyString(attempt.id)) {
      throw new Error(`Attempt ${index} has no valid ID.`);
    }
    if (attemptIds.has(attempt.id)) {
      throw new Error(`Attempt ID ${attempt.id} is duplicated.`);
    }
    attemptIds.add(attempt.id);
    attemptById.set(attempt.id, attempt);
    if (
      typeof attempt.stage !== 'string' ||
      !STAGES.has(attempt.stage as ReviewStage)
    ) {
      throw new Error(`Attempt ${attempt.id} has an invalid stage.`);
    }
    if (
      typeof attempt.state !== 'string' ||
      !ATTEMPT_STATES.has(attempt.state as AttemptState)
    ) {
      throw new Error(`Attempt ${attempt.id} has an invalid state.`);
    }
    if (!object(attempt.prompt) || !nonEmptyString(attempt.prompt.text)) {
      throw new Error(`Attempt ${attempt.id} has no rendered prompt.`);
    }
    if (!Array.isArray(attempt.dependsOn)) {
      throw new Error(`Attempt ${attempt.id} dependencies must be an array.`);
    }
    if (
      !Array.isArray(attempt.toolsAvailable) ||
      !Array.isArray(attempt.recordsRetrieved) ||
      !Array.isArray(attempt.events) ||
      !Array.isArray(attempt.toolCalls) ||
      typeof attempt.current !== 'boolean' ||
      typeof attempt.automatic !== 'boolean'
    ) {
      throw new Error(
        `Attempt ${attempt.id} is missing evidence/history fields.`,
      );
    }
    if (attempt.state === 'completed' && !object(attempt.output)) {
      throw new Error(
        `Completed attempt ${attempt.id} must retain its output.`,
      );
    }
  }
  for (const attempt of attemptById.values()) {
    for (const dependency of attempt.dependsOn as unknown[]) {
      if (!nonEmptyString(dependency) || !attemptIds.has(dependency)) {
        throw new Error(
          `Attempt ${String(attempt.id)} references an unknown dependency.`,
        );
      }
    }
  }
  if (!object(value.currentAttemptIds)) {
    throw new Error('Review run currentAttemptIds must be an object.');
  }
  for (const [stage, attemptId] of Object.entries(value.currentAttemptIds)) {
    if (!STAGES.has(stage as ReviewStage) || !nonEmptyString(attemptId)) {
      throw new Error(
        'Review run contains an invalid current-attempt pointer.',
      );
    }
    if (!attemptIds.has(attemptId)) {
      throw new Error(
        `Current attempt ${attemptId} is not present in history.`,
      );
    }
    const attempt = attemptById.get(attemptId);
    if (attempt?.stage !== stage || attempt.current !== true) {
      throw new Error(
        `Current attempt ${attemptId} does not match stage ${stage} or is not marked current.`,
      );
    }
  }
  if (
    !object(value.renderedPrompts) ||
    !object(value.templates) ||
    !object(value.models) ||
    !object(value.limits) ||
    !object(value.compilerPolicy) ||
    !object(value.compilerBinding) ||
    !object(value.artifacts) ||
    !Array.isArray(value.automaticIntegrationPairs) ||
    !Array.isArray(value.automaticPostCheckIntegrations)
  ) {
    throw new Error(
      'Review run is missing required versioned configuration/history fields.',
    );
  }
  for (const [artifactId, artifact] of Object.entries(value.artifacts)) {
    if (
      !object(artifact) ||
      artifact.id !== artifactId ||
      !nonEmptyString(artifact.mediaType) ||
      typeof artifact.byteLength !== 'number' ||
      artifact.byteLength < 0
    ) {
      throw new Error(`Artifact ${artifactId} is invalid.`);
    }
  }
  for (const attempt of attemptById.values()) {
    for (const toolCall of attempt.toolCalls as unknown[]) {
      if (
        !object(toolCall) ||
        !nonEmptyString(toolCall.argumentsArtifactId) ||
        !nonEmptyString(toolCall.resultArtifactId) ||
        !(toolCall.argumentsArtifactId in value.artifacts) ||
        !(toolCall.resultArtifactId in value.artifacts)
      ) {
        throw new Error(
          `Attempt ${String(attempt.id)} has an invalid tool evidence reference.`,
        );
      }
    }
  }
  return deepFreeze(clonePlainData(value as unknown as ReviewRunRecord));
}

export class InMemoryReviewRunRepository implements ReviewRunRepository {
  readonly #runs = new Map<string, ReviewRunRecord>();

  public async save(run: ReviewRunRecord): Promise<void> {
    await Promise.resolve();
    const validated = validateReviewRunRecord(run);
    this.#runs.set(run.id, validated);
  }

  public async load(runId: string): Promise<ReviewRunRecord | undefined> {
    await Promise.resolve();
    const run = this.#runs.get(runId);
    return run ? deepFreeze(clonePlainData(run)) : undefined;
  }

  public async list(): Promise<ReviewRunRecord[]> {
    await Promise.resolve();
    return [...this.#runs.values()].map((run) =>
      deepFreeze(clonePlainData(run)),
    );
  }
}

export function exportReviewRunJson(run: ReviewRunRecord): string {
  return `${JSON.stringify(validateReviewRunRecord(run), null, 2)}\n`;
}

export function importReviewRunJson(
  json: string,
  importedAt: string,
): ReviewRunRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Review run JSON could not be parsed: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  }
  const run = clonePlainData(validateReviewRunRecord(parsed));
  let interrupted = false;
  const unfinished = new Set<AttemptState>([
    'queued',
    'running',
    'waiting-for-tool',
    'cancel-requested',
  ]);
  for (const attempt of run.attempts) {
    if (unfinished.has(attempt.state)) {
      attempt.state = 'interrupted';
      attempt.endedAt = importedAt;
      attempt.error = {
        code: 'imported-unfinished-attempt',
        message:
          'Imported JSON cannot reconnect a provider session; explicitly retry through a supported adapter.',
      };
      interrupted = true;
    }
  }
  if (interrupted) {
    run.state = 'interrupted';
    run.updatedAt = importedAt;
  }
  return validateReviewRunRecord(run);
}
