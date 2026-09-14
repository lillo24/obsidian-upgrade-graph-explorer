import {
  assertPlainData,
  assertSafeMetadata,
  clonePlainData,
  deepFreeze,
  plainDataByteLength,
  utf8Bytes,
} from './plain-data';
import { validateIntegrationResult, validatePostCheckResult } from './results';
import { prepareReviewInput } from './snapshot';
import {
  COMPILER_TOOL_NAMES,
  REVIEW_RUN_SCHEMA_VERSION,
  type AttemptState,
  type CompilerToolName,
  type JsonValue,
  type ReviewAttemptRecord,
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
const TERMINAL_STATUSES = new Set([
  'completed',
  'refused',
  'truncated',
  'failed',
  'cancelled',
]);
const COMPILER_RESULT_STATUSES = new Set([
  'ok',
  'unavailable',
  'not-found',
  'source-unavailable',
  'stale-snapshot',
  'unauthorized',
  'invalid-request',
  'limit-exceeded',
  'cancelled',
]);
const COMPILER_CAPABILITIES = new Set([
  'list-index',
  'search-index',
  'read-bundle',
  'read-source',
]);

function object(value: unknown): value is Record<string, unknown> {
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

function safeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function validateRenderedPrompt(value: unknown, label: string): void {
  if (
    !object(value) ||
    !nonEmptyString(value.templateVersion) ||
    !nonEmptyString(value.commonTemplateVersion) ||
    !nonEmptyString(value.text)
  ) {
    throw new Error(`${label} rendered prompt is invalid.`);
  }
}

function validateAttemptDetail(attempt: Record<string, unknown>): void {
  const id = String(attempt.id);
  if (!Number.isSafeInteger(attempt.number) || (attempt.number as number) < 1) {
    throw new Error(`Attempt ${id} number must be a positive integer.`);
  }
  if (
    !nonEmptyString(attempt.contextId) ||
    !nonEmptyString(attempt.createdAt)
  ) {
    throw new Error(`Attempt ${id} context/timestamp is invalid.`);
  }
  if (attempt.startedAt !== undefined && !nonEmptyString(attempt.startedAt)) {
    throw new Error(`Attempt ${id} startedAt is invalid.`);
  }
  if (attempt.endedAt !== undefined && !nonEmptyString(attempt.endedAt)) {
    throw new Error(`Attempt ${id} endedAt is invalid.`);
  }
  validateRenderedPrompt(attempt.prompt, `Attempt ${id}`);
  if (
    !object(attempt.model) ||
    !nonEmptyString(attempt.model.provider) ||
    !nonEmptyString(attempt.model.model)
  ) {
    throw new Error(`Attempt ${id} model settings are invalid.`);
  }
  if (
    !(attempt.toolsAvailable as unknown[]).every(
      (tool): tool is CompilerToolName =>
        typeof tool === 'string' &&
        (COMPILER_TOOL_NAMES as readonly string[]).includes(tool),
    ) ||
    !stringArray(attempt.dependsOn)
  ) {
    throw new Error(`Attempt ${id} tool/dependency lists are invalid.`);
  }
  for (const [index, reference] of (
    attempt.recordsRetrieved as unknown[]
  ).entries()) {
    if (
      !object(reference) ||
      !nonEmptyString(reference.canonicalId) ||
      !nonEmptyString(reference.revision) ||
      (reference.sourceHeading !== undefined &&
        typeof reference.sourceHeading !== 'string')
    ) {
      throw new Error(`Attempt ${id} retrieved reference ${index} is invalid.`);
    }
  }
  for (const [index, event] of (attempt.events as unknown[]).entries()) {
    if (
      !object(event) ||
      !nonEmptyString(event.eventId) ||
      !['progress', 'text-delta', 'tool-call', 'terminal'].includes(
        String(event.type),
      ) ||
      !nonEmptyString(event.at) ||
      typeof event.summary !== 'string'
    ) {
      throw new Error(`Attempt ${id} event ${index} is invalid.`);
    }
  }
  if (attempt.output !== undefined) {
    if (
      !object(attempt.output) ||
      typeof attempt.output.rawMarkdown !== 'string' ||
      !['not-required', 'valid', 'invalid'].includes(
        String(attempt.output.structuredStatus),
      ) ||
      !stringArray(attempt.output.validationErrors)
    ) {
      throw new Error(`Attempt ${id} output is invalid.`);
    }
    if (
      attempt.output.structuredStatus === 'valid' &&
      !object(attempt.output.structured)
    ) {
      throw new Error(`Attempt ${id} valid structured output is missing.`);
    }
    if (
      utf8Bytes(attempt.output.rawMarkdown as string) >
      DEFAULT_VALIDATION_OUTPUT_BYTES
    ) {
      throw new Error(`Attempt ${id} output exceeds the import safety bound.`);
    }
  }
  if (
    attempt.terminalStatus !== undefined &&
    !TERMINAL_STATUSES.has(String(attempt.terminalStatus))
  ) {
    throw new Error(`Attempt ${id} terminal status is invalid.`);
  }
  if (attempt.usage !== undefined) {
    if (!object(attempt.usage))
      throw new Error(`Attempt ${id} usage is invalid.`);
    for (const field of [
      'inputTokens',
      'outputTokens',
      'totalTokens',
    ] as const) {
      const count = attempt.usage[field];
      if (count !== undefined && !safeNonNegativeInteger(count)) {
        throw new Error(`Attempt ${id} usage ${field} is invalid.`);
      }
    }
    const cost = attempt.usage.costUsd;
    if (
      cost !== undefined &&
      (!Number.isFinite(cost) || (cost as number) < 0)
    ) {
      throw new Error(`Attempt ${id} usage costUsd is invalid.`);
    }
  }
  if (
    attempt.error !== undefined &&
    (!object(attempt.error) ||
      !nonEmptyString(attempt.error.code) ||
      !nonEmptyString(attempt.error.message))
  ) {
    throw new Error(`Attempt ${id} error is invalid.`);
  }
  if (
    attempt.cancellation !== undefined &&
    (!object(attempt.cancellation) ||
      !nonEmptyString(attempt.cancellation.requestedAt) ||
      !nonEmptyString(attempt.cancellation.reason) ||
      typeof attempt.cancellation.remoteTerminationConfirmed !== 'boolean')
  ) {
    throw new Error(`Attempt ${id} cancellation evidence is invalid.`);
  }
  if (attempt.adapterMetadata !== undefined) {
    assertSafeMetadata(
      attempt.adapterMetadata,
      `Attempt ${id} adapter metadata`,
    );
  }
}

const DEFAULT_VALIDATION_OUTPUT_BYTES = 5 * 1024 * 1024;

export function validateReviewRunRecord(value: unknown): ReviewRunRecord {
  assertPlainData(value, 'Review run JSON');
  if (!object(value)) throw new Error('Review run must be an object.');
  if (value.schemaVersion !== REVIEW_RUN_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported review run schema ${String(value.schemaVersion)}; expected ${REVIEW_RUN_SCHEMA_VERSION}.`,
    );
  }
  if (!nonEmptyString(value.id)) throw new Error('Review run ID is required.');
  if (!nonEmptyString(value.createdAt) || !nonEmptyString(value.updatedAt)) {
    throw new Error('Review run timestamps are required.');
  }
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
    validateAttemptDetail(attempt);
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
  for (const stage of STAGES) {
    const prompt = value.renderedPrompts[stage];
    if (prompt !== undefined) validateRenderedPrompt(prompt, `${stage} run`);
  }
  const candidateRun = value as unknown as ReviewRunRecord;
  try {
    const prepared = prepareReviewInput({
      workspaceId: candidateRun.frozenInput.workspaceId,
      source: candidateRun.frozenInput.source,
      additionalRequest: candidateRun.frozenInput.additionalRequest,
      templates: candidateRun.templates,
      models: candidateRun.models,
      limits: candidateRun.limits,
      compiler: candidateRun.compilerPolicy,
    });
    if (
      prepared.frozenInput.sharedMaterial !==
      candidateRun.frozenInput.sharedMaterial
    ) {
      throw new Error(
        'Review run frozen shared material does not match its retained source.',
      );
    }
  } catch (error) {
    throw new Error(
      `Review run source/configuration is invalid: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (
    typeof value.compilerBinding.requested !== 'boolean' ||
    (value.compilerBinding.descriptor !== undefined &&
      (!object(value.compilerBinding.descriptor) ||
        value.compilerBinding.descriptor.protocolVersion !== 1 ||
        !nonEmptyString(value.compilerBinding.descriptor.snapshotId) ||
        !nonEmptyString(value.compilerBinding.descriptor.revision) ||
        !Array.isArray(value.compilerBinding.descriptor.capabilities) ||
        !nonEmptyString(value.compilerBinding.descriptor.openedAt))) ||
    (value.compilerBinding.error !== undefined &&
      (!object(value.compilerBinding.error) ||
        !nonEmptyString(value.compilerBinding.error.code) ||
        !nonEmptyString(value.compilerBinding.error.message)))
  ) {
    throw new Error('Review run compiler binding is invalid.');
  }
  const descriptorCapabilities =
    candidateRun.compilerBinding.descriptor?.capabilities;
  if (
    descriptorCapabilities !== undefined &&
    (descriptorCapabilities.some(
      (capability) => !COMPILER_CAPABILITIES.has(String(capability)),
    ) ||
      new Set(descriptorCapabilities).size !== descriptorCapabilities.length)
  ) {
    throw new Error('Review run compiler capabilities are invalid.');
  }
  if (
    !stringArray(value.automaticIntegrationPairs) ||
    !stringArray(value.automaticPostCheckIntegrations)
  ) {
    throw new Error('Review run automatic-stage history is invalid.');
  }
  for (const [artifactId, artifact] of Object.entries(value.artifacts)) {
    if (
      !object(artifact) ||
      artifact.id !== artifactId ||
      !nonEmptyString(artifact.mediaType) ||
      !safeNonNegativeInteger(artifact.byteLength) ||
      !['application/json', 'text/markdown'].includes(
        String(artifact.mediaType),
      ) ||
      (artifact.mediaType === 'text/markdown' &&
        typeof artifact.content !== 'string')
    ) {
      throw new Error(`Artifact ${artifactId} is invalid.`);
    }
    const actualBytes = utf8Bytes(
      typeof artifact.content === 'string'
        ? artifact.content
        : JSON.stringify(artifact.content),
    );
    if (actualBytes !== artifact.byteLength) {
      throw new Error(`Artifact ${artifactId} byteLength is inconsistent.`);
    }
  }
  for (const attempt of attemptById.values()) {
    for (const toolCall of attempt.toolCalls as unknown[]) {
      if (
        !object(toolCall) ||
        !nonEmptyString(toolCall.toolCallId) ||
        !nonEmptyString(toolCall.name) ||
        !nonEmptyString(toolCall.argumentsArtifactId) ||
        !nonEmptyString(toolCall.resultArtifactId) ||
        !(toolCall.argumentsArtifactId in value.artifacts) ||
        !(toolCall.resultArtifactId in value.artifacts) ||
        !COMPILER_RESULT_STATUSES.has(String(toolCall.status)) ||
        !safeNonNegativeInteger(toolCall.duplicateDeliveries) ||
        !Array.isArray(toolCall.canonicalReferences)
      ) {
        throw new Error(
          `Attempt ${String(attempt.id)} has an invalid tool evidence reference.`,
        );
      }
      for (const reference of toolCall.canonicalReferences) {
        if (
          !object(reference) ||
          !nonEmptyString(reference.canonicalId) ||
          !nonEmptyString(reference.revision) ||
          (reference.sourceHeading !== undefined &&
            typeof reference.sourceHeading !== 'string')
        ) {
          throw new Error(
            `Attempt ${String(attempt.id)} has an invalid tool canonical reference.`,
          );
        }
      }
    }
  }
  const currentByStage = new Map<ReviewStage, string>();
  for (const attempt of candidateRun.attempts) {
    if (!attempt.current) continue;
    if (currentByStage.has(attempt.stage)) {
      throw new Error(`Multiple current attempts exist for ${attempt.stage}.`);
    }
    currentByStage.set(attempt.stage, attempt.id);
    if (value.currentAttemptIds[attempt.stage] !== attempt.id) {
      throw new Error(
        `Current attempt ${attempt.id} is not selected by currentAttemptIds.`,
      );
    }
    if (utf8Bytes(attempt.prompt.text) > candidateRun.limits.maxPromptBytes) {
      throw new Error(
        `Attempt ${attempt.id} prompt exceeds its retained limit.`,
      );
    }
    if (
      attempt.output !== undefined &&
      utf8Bytes(attempt.output.rawMarkdown) > candidateRun.limits.maxOutputBytes
    ) {
      throw new Error(
        `Attempt ${attempt.id} output exceeds its retained limit.`,
      );
    }
  }
  if (plainDataByteLength(value) > 5 * 1024 * 1024) {
    throw new Error('Review run exceeds the 5 MiB import/render safety bound.');
  }
  const normalized = clonePlainData(value as unknown as ReviewRunRecord);
  const normalizedAttempts = new Map(
    normalized.attempts.map((attempt) => [attempt.id, attempt]),
  );
  for (const attempt of normalized.attempts) {
    if (
      attempt.output?.structuredStatus !== 'valid' ||
      attempt.output.structured === undefined
    ) {
      continue;
    }
    try {
      if (attempt.stage === 'integrator') {
        const dependencies = attempt.dependsOn
          .map((id) => normalizedAttempts.get(id))
          .filter(
            (candidate): candidate is ReviewAttemptRecord =>
              candidate !== undefined,
          );
        const negative = dependencies.find(({ stage }) => stage === 'negative');
        const positive = dependencies.find(({ stage }) => stage === 'positive');
        if (negative === undefined || positive === undefined) {
          throw new Error(
            'Integrator result requires retained branch dependencies.',
          );
        }
        attempt.output.structured = validateIntegrationResult(
          attempt.output.structured as unknown as JsonValue,
          negative,
          positive,
        );
      } else if (attempt.stage === 'post-check') {
        attempt.output.structured = validatePostCheckResult(
          attempt.output.structured as unknown as JsonValue,
          normalized.attempts,
        );
      } else {
        throw new Error(
          `${attempt.stage} attempts cannot claim validated structured output.`,
        );
      }
    } catch (error) {
      throw new Error(
        `Attempt ${attempt.id} structured output is invalid: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
  return deepFreeze(normalized);
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
  if (unfinished.has(run.state)) interrupted = true;
  if (interrupted) {
    run.state = 'interrupted';
    run.updatedAt = importedAt;
  }
  return validateReviewRunRecord(run);
}
