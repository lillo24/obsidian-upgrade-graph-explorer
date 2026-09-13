import {
  assertPlainData,
  clonePlainData,
  deepFreeze,
  deterministicFingerprint,
  prepareReviewPromptPreview,
  prepareReviewInput,
  utf8Bytes,
  validateReviewRunRecord,
} from '@icarus-graph-explorer/ai-review';

import {
  MAX_REVIEW_HISTORY_RECORD_BYTES,
  REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION,
  REVIEW_PREPARATION_SCHEMA_VERSION,
  type ReviewHistoryDescriptor,
  type ReviewHistoryEntry,
  type ReviewHistorySummary,
  type ReviewPreparationRecord,
} from './types';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(
      `${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`,
    );
  }
  return value;
}

export function assertReviewRecordId(id: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(id)) {
    throw new Error(
      'Review record ID must be 1–128 safe identifier characters and contain no path separators.',
    );
  }
}

export function validateReviewPreparationRecord(
  value: unknown,
): ReviewPreparationRecord {
  assertPlainData(value, 'Prepared review JSON');
  if (!object(value)) throw new Error('Prepared review must be an object.');
  if (value.schemaVersion !== REVIEW_PREPARATION_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported prepared-review schema ${String(value.schemaVersion)}; expected ${REVIEW_PREPARATION_SCHEMA_VERSION}.`,
    );
  }
  const id = text(value.id, 'Prepared review ID');
  assertReviewRecordId(id);
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) {
    throw new Error('Prepared review revision must be a positive integer.');
  }
  text(value.createdAt, 'Prepared review createdAt');
  text(value.updatedAt, 'Prepared review updatedAt');
  text(value.title, 'Prepared review title');
  if (!object(value.workspace)) {
    throw new Error('Prepared review workspace provenance is required.');
  }
  const workspaceId = text(value.workspace.id, 'Prepared workspace ID');
  text(value.workspace.label, 'Prepared workspace label');
  text(value.additionalRequest, 'Additional request', true);
  if (!object(value.origin)) {
    throw new Error('Prepared review origin is required.');
  }
  if (
    !['captured-local-git', 'duplicated-run', 'imported'].includes(
      String(value.origin.kind),
    )
  ) {
    throw new Error('Prepared review origin kind is invalid.');
  }
  text(value.origin.capturedAt, 'Prepared review capturedAt');
  if (value.origin.importedAt !== undefined) {
    text(value.origin.importedAt, 'Prepared review importedAt');
  }
  const candidate = clonePlainData(value as unknown as ReviewPreparationRecord);
  const preview = prepareReviewPromptPreview({
    workspaceId,
    source: candidate.source,
    additionalRequest: candidate.additionalRequest,
    templates: candidate.templates,
    limits: candidate.limits,
    compiler: candidate.compilerPolicy,
  });
  if (candidate.models !== undefined) {
    prepareReviewInput({
      workspaceId,
      source: candidate.source,
      additionalRequest: candidate.additionalRequest,
      templates: candidate.templates,
      limits: candidate.limits,
      compiler: candidate.compilerPolicy,
      models: candidate.models,
    });
  }
  return deepFreeze({
    ...candidate,
    templates: preview.templates,
    limits: preview.limits,
    compilerPolicy: preview.compilerPolicy,
  });
}

export function validateReviewHistoryEntry(value: unknown): ReviewHistoryEntry {
  assertPlainData(value, 'Review history JSON');
  if (!object(value))
    throw new Error('Review history entry must be an object.');
  if (value.schemaVersion !== REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported review-history envelope ${String(value.schemaVersion)}; expected ${REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION}.`,
    );
  }
  let entry: ReviewHistoryEntry;
  if (value.kind === 'preparation') {
    entry = {
      schemaVersion: REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION,
      kind: 'preparation',
      preparation: validateReviewPreparationRecord(value.preparation),
    };
  } else if (value.kind === 'run') {
    const title = text(value.title, 'Stored run title');
    const workspaceLabel = text(value.workspaceLabel, 'Stored workspace label');
    if (value.origin !== 'local-engine' && value.origin !== 'imported') {
      throw new Error('Stored run origin is invalid.');
    }
    if (value.importedAt !== undefined) {
      text(value.importedAt, 'Stored run importedAt');
    }
    const run = validateReviewRunRecord(value.run);
    assertReviewRecordId(run.id);
    entry = {
      schemaVersion: REVIEW_HISTORY_ENVELOPE_SCHEMA_VERSION,
      kind: 'run',
      title,
      workspaceLabel,
      origin: value.origin,
      ...(value.importedAt === undefined
        ? {}
        : { importedAt: value.importedAt as string }),
      run,
    };
  } else {
    throw new Error('Review history kind must be preparation or run.');
  }
  const serialized = JSON.stringify(entry);
  const bytes = utf8Bytes(serialized);
  if (bytes > MAX_REVIEW_HISTORY_RECORD_BYTES) {
    throw new Error(
      `Review history record is ${bytes} bytes; the limit is ${MAX_REVIEW_HISTORY_RECORD_BYTES}. No content was truncated.`,
    );
  }
  return deepFreeze(clonePlainData(entry));
}

export function reviewHistoryEntryId(entry: ReviewHistoryEntry): string {
  return entry.kind === 'run' ? entry.run.id : entry.preparation.id;
}

export function serializeReviewHistoryEntry(entry: ReviewHistoryEntry): string {
  return `${JSON.stringify(validateReviewHistoryEntry(entry), null, 2)}\n`;
}

export function parseReviewHistoryEntryJson(
  source: string,
): ReviewHistoryEntry {
  if (utf8Bytes(source) > MAX_REVIEW_HISTORY_RECORD_BYTES) {
    throw new Error(
      `Review history JSON exceeds the ${MAX_REVIEW_HISTORY_RECORD_BYTES}-byte limit.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Review history JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return validateReviewHistoryEntry(parsed);
}

export function captureReviewHistoryDescriptor(
  entry: ReviewHistoryEntry,
): ReviewHistoryDescriptor {
  const validated = validateReviewHistoryEntry(entry);
  return {
    id: reviewHistoryEntryId(validated),
    fingerprint: deterministicFingerprint(validated),
  };
}

export function summarizeReviewHistoryEntry(
  entry: ReviewHistoryEntry,
): ReviewHistorySummary {
  const validated = validateReviewHistoryEntry(entry);
  const descriptor = captureReviewHistoryDescriptor(validated);
  const byteLength = utf8Bytes(JSON.stringify(validated));
  if (validated.kind === 'preparation') {
    const preparation = validated.preparation;
    return {
      ...descriptor,
      kind: 'preparation',
      title: preparation.title,
      workspaceId: preparation.workspace.id,
      workspaceLabel: preparation.workspace.label,
      state: 'prepared',
      createdAt: preparation.createdAt,
      updatedAt: preparation.updatedAt,
      byteLength,
      origin: preparation.origin.kind,
    };
  }
  return {
    ...descriptor,
    kind: 'run',
    title: validated.title,
    workspaceId: validated.run.frozenInput.workspaceId,
    workspaceLabel: validated.workspaceLabel,
    state: validated.run.state,
    createdAt: validated.run.createdAt,
    updatedAt: validated.run.updatedAt,
    byteLength,
    origin: validated.origin,
  };
}

export function sameReviewHistoryDescriptor(
  left: ReviewHistoryDescriptor,
  right: ReviewHistoryDescriptor,
): boolean {
  return left.id === right.id && left.fingerprint === right.fingerprint;
}
