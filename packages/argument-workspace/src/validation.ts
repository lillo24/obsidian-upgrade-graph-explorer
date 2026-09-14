import {
  ARGUMENT_LIBRARY_SCHEMA_VERSION,
  CONTENT_FINGERPRINT_ALGORITHM,
  type ArgumentLibrary,
  type ArgumentLibraryValidationIssue,
  type ArgumentLibraryValidationResult,
} from './types';

type PlainRecord = Record<string, unknown>;

const REVIEW_STATES = new Set([
  'draft',
  'pending-review',
  'accepted',
  'reopened',
  'rejected',
]);
const OUTCOMES = new Set([
  'unanswered',
  'standing',
  'partially-addressed',
  'refuted',
  'inapplicable-under-stated-scope',
]);
const SOURCE_ROLES = new Set(['target', 'basis', 'support']);
const FINGERPRINT_SCOPES = new Set(['file', 'heading', 'block', 'span']);

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: ArgumentLibraryValidationIssue[],
  path: string,
  code: ArgumentLibraryValidationIssue['code'],
  message: string,
): void {
  issues.push({ path, code, message });
}

function fields(
  value: PlainRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const field of required) {
    if (!Object.hasOwn(value, field)) {
      issue(
        issues,
        `${path}.${field}`,
        'invalid-type',
        'Missing required field.',
      );
    }
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      issue(issues, `${path}.${field}`, 'unknown-field', 'Unknown field.');
    }
  }
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    issue(issues, path, 'invalid-type', 'Expected a non-empty string.');
    return false;
  }
  return true;
}

function timestamp(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is string {
  if (
    !nonEmptyString(value, path, issues) ||
    !Number.isFinite(Date.parse(value))
  ) {
    if (typeof value === 'string' && value.trim() !== '') {
      issue(
        issues,
        path,
        'invalid-value',
        'Expected an ISO-compatible timestamp.',
      );
    }
    return false;
  }
  return true;
}

function positiveRevision(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    issue(
      issues,
      path,
      'invalid-value',
      'Expected a positive safe integer revision.',
    );
    return false;
  }
  return true;
}

function stringArray(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is readonly string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'invalid-type', 'Expected an array.');
    return false;
  }
  let valid = true;
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry, `${path}[${index}]`, issues)) {
      valid = false;
    } else if (seen.has(entry)) {
      issue(issues, `${path}[${index}]`, 'duplicate-id', 'Duplicate value.');
      valid = false;
    } else {
      seen.add(entry);
    }
  });
  return valid;
}

function validateRetrieval(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected retrieval metadata.');
    return;
  }
  fields(value, ['aliases', 'keywords', 'phrases'], [], path, issues);
  stringArray(value.aliases, `${path}.aliases`, issues);
  stringArray(value.keywords, `${path}.keywords`, issues);
  stringArray(value.phrases, `${path}.phrases`, issues);
}

function validatePosition(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a source position.');
    return;
  }
  fields(value, ['line', 'column'], ['offset'], path, issues);
  for (const field of ['line', 'column'] as const) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) < 1) {
      issue(
        issues,
        `${path}.${field}`,
        'invalid-value',
        'Expected a positive integer.',
      );
    }
  }
  if (
    Object.hasOwn(value, 'offset') &&
    (!Number.isSafeInteger(value.offset) || Number(value.offset) < 0)
  ) {
    issue(
      issues,
      `${path}.offset`,
      'invalid-value',
      'Expected a non-negative integer.',
    );
  }
}

function validateSpan(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a source span.');
    return;
  }
  fields(value, ['start', 'end'], [], path, issues);
  validatePosition(value.start, `${path}.start`, issues);
  validatePosition(value.end, `${path}.end`, issues);
  if (isRecord(value.start) && isRecord(value.end)) {
    const oneOffset =
      Object.hasOwn(value.start, 'offset') !==
      Object.hasOwn(value.end, 'offset');
    if (oneOffset) {
      issue(
        issues,
        path,
        'invalid-value',
        'Span offsets must appear on both endpoints or neither.',
      );
    }
  }
}

function validateFingerprint(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a content fingerprint.');
    return;
  }
  fields(value, ['algorithm', 'value'], [], path, issues);
  if (value.algorithm !== CONTENT_FINGERPRINT_ALGORITHM) {
    issue(
      issues,
      `${path}.algorithm`,
      'invalid-value',
      'Unsupported fingerprint algorithm.',
    );
  }
  if (typeof value.value !== 'string' || !/^[a-f0-9]{64}$/u.test(value.value)) {
    issue(
      issues,
      `${path}.value`,
      'invalid-value',
      'Expected a lowercase SHA-256 digest.',
    );
  }
}

function validateSourceReference(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
  sourceIds: Set<string>,
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a theory source reference.');
    return;
  }
  fields(
    value,
    ['id', 'path', 'label', 'role'],
    [
      'sourceSpaceHint',
      'heading',
      'block',
      'originalWikilink',
      'entityIdHint',
      'recordedVersion',
    ],
    path,
    issues,
  );
  if (nonEmptyString(value.id, `${path}.id`, issues)) {
    if (sourceIds.has(value.id)) {
      issue(
        issues,
        `${path}.id`,
        'duplicate-id',
        'Source-reference ID must be unique within the library.',
      );
    }
    sourceIds.add(value.id);
  }
  if (nonEmptyString(value.path, `${path}.path`, issues)) {
    const segments = value.path.split('/');
    if (
      value.path.startsWith('/') ||
      value.path.includes('\\') ||
      /^[A-Za-z]:\//u.test(value.path) ||
      segments.some(
        (segment) => segment === '' || segment === '.' || segment === '..',
      )
    ) {
      issue(
        issues,
        `${path}.path`,
        'invalid-value',
        'Expected a normalized workspace-relative path.',
      );
    }
  }
  nonEmptyString(value.label, `${path}.label`, issues);
  if (!SOURCE_ROLES.has(value.role as string)) {
    issue(
      issues,
      `${path}.role`,
      'invalid-value',
      'Unsupported source-reference role.',
    );
  }
  for (const field of [
    'sourceSpaceHint',
    'heading',
    'block',
    'originalWikilink',
    'entityIdHint',
  ] as const) {
    if (Object.hasOwn(value, field)) {
      nonEmptyString(value[field], `${path}.${field}`, issues);
    }
  }
  if (Object.hasOwn(value, 'recordedVersion')) {
    const recorded = value.recordedVersion;
    if (!isRecord(recorded)) {
      issue(
        issues,
        `${path}.recordedVersion`,
        'invalid-type',
        'Expected recorded source metadata.',
      );
    } else {
      fields(
        recorded,
        ['fingerprintScope'],
        ['sourceVersion', 'contentFingerprint', 'span'],
        `${path}.recordedVersion`,
        issues,
      );
      if (!FINGERPRINT_SCOPES.has(recorded.fingerprintScope as string)) {
        issue(
          issues,
          `${path}.recordedVersion.fingerprintScope`,
          'invalid-value',
          'Unsupported fingerprint scope.',
        );
      }
      if (Object.hasOwn(recorded, 'sourceVersion')) {
        nonEmptyString(
          recorded.sourceVersion,
          `${path}.recordedVersion.sourceVersion`,
          issues,
        );
      }
      if (Object.hasOwn(recorded, 'contentFingerprint')) {
        validateFingerprint(
          recorded.contentFingerprint,
          `${path}.recordedVersion.contentFingerprint`,
          issues,
        );
      }
      if (Object.hasOwn(recorded, 'span')) {
        validateSpan(recorded.span, `${path}.recordedVersion.span`, issues);
      }
    }
  }
}

function validateMetadata(
  value: PlainRecord,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  nonEmptyString(value.id, `${path}.id`, issues);
  positiveRevision(value.revision, `${path}.revision`, issues);
  if (!REVIEW_STATES.has(value.reviewState as string)) {
    issue(
      issues,
      `${path}.reviewState`,
      'invalid-value',
      'Unsupported human review state.',
    );
  }
  if (typeof value.archived !== 'boolean') {
    issue(issues, `${path}.archived`, 'invalid-type', 'Expected a boolean.');
  }
  timestamp(value.createdAt, `${path}.createdAt`, issues);
  timestamp(value.updatedAt, `${path}.updatedAt`, issues);
}

const METADATA_FIELDS = [
  'id',
  'revision',
  'reviewState',
  'archived',
  'createdAt',
  'updatedAt',
] as const;

function validateTopic(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a Topic.');
    return;
  }
  fields(
    value,
    [
      ...METADATA_FIELDS,
      'title',
      'summary',
      'retrieval',
      'axiomIds',
      'counterArgumentIds',
    ],
    [],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  nonEmptyString(value.summary, `${path}.summary`, issues);
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  stringArray(value.axiomIds, `${path}.axiomIds`, issues);
  stringArray(value.counterArgumentIds, `${path}.counterArgumentIds`, issues);
}

function validateAxiom(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
  sourceIds: Set<string>,
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected an Axiom.');
    return;
  }
  fields(
    value,
    [...METADATA_FIELDS, 'title', 'statement', 'retrieval', 'sourceReferences'],
    ['explanation', 'scope', 'supportingReasoning'],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  nonEmptyString(value.statement, `${path}.statement`, issues);
  for (const field of [
    'explanation',
    'scope',
    'supportingReasoning',
  ] as const) {
    if (Object.hasOwn(value, field))
      nonEmptyString(value[field], `${path}.${field}`, issues);
  }
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  if (!Array.isArray(value.sourceReferences)) {
    issue(
      issues,
      `${path}.sourceReferences`,
      'invalid-type',
      'Expected an array.',
    );
  } else {
    value.sourceReferences.forEach((entry, index) =>
      validateSourceReference(
        entry,
        `${path}.sourceReferences[${index}]`,
        issues,
        sourceIds,
      ),
    );
  }
}

function validateTarget(
  value: unknown,
  path: string,
  ownerId: unknown,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a Counter-Argument target.');
    return;
  }
  if (value.kind === 'topic-claim') {
    fields(value, ['kind', 'topicId'], [], path, issues);
    nonEmptyString(value.topicId, `${path}.topicId`, issues);
  } else if (value.kind === 'axiom') {
    fields(value, ['kind', 'axiomId'], [], path, issues);
    nonEmptyString(value.axiomId, `${path}.axiomId`, issues);
  } else if (value.kind === 'counter-argument') {
    fields(value, ['kind', 'counterArgumentId'], [], path, issues);
    if (
      nonEmptyString(
        value.counterArgumentId,
        `${path}.counterArgumentId`,
        issues,
      ) &&
      value.counterArgumentId === ownerId
    ) {
      issue(
        issues,
        `${path}.counterArgumentId`,
        'self-reference',
        'A Counter-Argument cannot target itself.',
      );
    }
  } else {
    issue(issues, `${path}.kind`, 'invalid-value', 'Unsupported target kind.');
  }
}

function validateResponse(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(
      issues,
      path,
      'invalid-type',
      'Expected a Counter-Argument response.',
    );
    return;
  }
  fields(
    value,
    ['answeringAxioms', 'explanation', 'outcome'],
    ['boundary', 'reopeningCondition'],
    path,
    issues,
  );
  if (!Array.isArray(value.answeringAxioms)) {
    issue(
      issues,
      `${path}.answeringAxioms`,
      'invalid-type',
      'Expected an array.',
    );
  } else {
    const seen = new Set<string>();
    value.answeringAxioms.forEach((entry, index) => {
      const entryPath = `${path}.answeringAxioms[${index}]`;
      if (!isRecord(entry)) {
        issue(
          issues,
          entryPath,
          'invalid-type',
          'Expected an answering Axiom reference.',
        );
        return;
      }
      fields(entry, ['axiomId', 'reliedOnRevision'], [], entryPath, issues);
      if (nonEmptyString(entry.axiomId, `${entryPath}.axiomId`, issues)) {
        if (seen.has(entry.axiomId)) {
          issue(
            issues,
            `${entryPath}.axiomId`,
            'duplicate-id',
            'Duplicate answering Axiom.',
          );
        }
        seen.add(entry.axiomId);
      }
      positiveRevision(
        entry.reliedOnRevision,
        `${entryPath}.reliedOnRevision`,
        issues,
      );
    });
  }
  if (typeof value.explanation !== 'string') {
    issue(
      issues,
      `${path}.explanation`,
      'invalid-type',
      'Expected response text.',
    );
  }
  if (!OUTCOMES.has(value.outcome as string)) {
    issue(
      issues,
      `${path}.outcome`,
      'invalid-value',
      'Unsupported response outcome.',
    );
  }
  for (const field of ['boundary', 'reopeningCondition'] as const) {
    if (Object.hasOwn(value, field))
      nonEmptyString(value[field], `${path}.${field}`, issues);
  }
}

function validateCounterArgument(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
  sourceIds: Set<string>,
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a Counter-Argument.');
    return;
  }
  fields(
    value,
    [
      ...METADATA_FIELDS,
      'title',
      'observation',
      'challengedClaim',
      'retrieval',
      'sourceReferences',
      'response',
    ],
    ['target'],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  nonEmptyString(value.observation, `${path}.observation`, issues);
  nonEmptyString(value.challengedClaim, `${path}.challengedClaim`, issues);
  if (Object.hasOwn(value, 'target'))
    validateTarget(value.target, `${path}.target`, value.id, issues);
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  if (!Array.isArray(value.sourceReferences)) {
    issue(
      issues,
      `${path}.sourceReferences`,
      'invalid-type',
      'Expected an array.',
    );
  } else {
    value.sourceReferences.forEach((entry, index) =>
      validateSourceReference(
        entry,
        `${path}.sourceReferences[${index}]`,
        issues,
        sourceIds,
      ),
    );
  }
  validateResponse(value.response, `${path}.response`, issues);
}

function collectIds(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
  globalIds: Set<string>,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    issue(issues, path, 'invalid-type', 'Expected an array.');
    return ids;
  }
  value.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') return;
    if (ids.has(entry.id) || globalIds.has(entry.id)) {
      issue(
        issues,
        `${path}[${index}].id`,
        'duplicate-id',
        'Record ID must be unique within the library.',
      );
    }
    ids.add(entry.id);
    globalIds.add(entry.id);
  });
  return ids;
}

function validateIntegrity(
  library: PlainRecord,
  topicIds: ReadonlySet<string>,
  axiomIds: ReadonlySet<string>,
  counterIds: ReadonlySet<string>,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (Array.isArray(library.topics)) {
    library.topics.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      if (Array.isArray(entry.axiomIds)) {
        entry.axiomIds.forEach((id, memberIndex) => {
          if (typeof id === 'string' && !axiomIds.has(id)) {
            issue(
              issues,
              `$.topics[${index}].axiomIds[${memberIndex}]`,
              'missing-reference',
              `Unknown Axiom "${id}".`,
            );
          }
        });
      }
      if (Array.isArray(entry.counterArgumentIds)) {
        entry.counterArgumentIds.forEach((id, memberIndex) => {
          if (typeof id === 'string' && !counterIds.has(id)) {
            issue(
              issues,
              `$.topics[${index}].counterArgumentIds[${memberIndex}]`,
              'missing-reference',
              `Unknown Counter-Argument "${id}".`,
            );
          }
        });
      }
    });
  }
  if (!Array.isArray(library.counterArguments)) return;
  library.counterArguments.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    if (isRecord(entry.target)) {
      let targetId: unknown;
      let targetSet: ReadonlySet<string> | undefined;
      if (entry.target.kind === 'topic-claim') {
        targetId = entry.target.topicId;
        targetSet = topicIds;
      } else if (entry.target.kind === 'axiom') {
        targetId = entry.target.axiomId;
        targetSet = axiomIds;
      } else if (entry.target.kind === 'counter-argument') {
        targetId = entry.target.counterArgumentId;
        targetSet = counterIds;
      }
      if (
        typeof targetId === 'string' &&
        targetSet !== undefined &&
        !targetSet.has(targetId)
      ) {
        issue(
          issues,
          `$.counterArguments[${index}].target`,
          'missing-reference',
          `Unknown target "${targetId}".`,
        );
      }
    }
    if (
      isRecord(entry.response) &&
      Array.isArray(entry.response.answeringAxioms)
    ) {
      entry.response.answeringAxioms.forEach((answer, answerIndex) => {
        if (
          isRecord(answer) &&
          typeof answer.axiomId === 'string' &&
          !axiomIds.has(answer.axiomId)
        ) {
          issue(
            issues,
            `$.counterArguments[${index}].response.answeringAxioms[${answerIndex}].axiomId`,
            'missing-reference',
            `Unknown answering Axiom "${answer.axiomId}".`,
          );
        }
      });
    }
  });
}

export function validateArgumentLibrary(
  value: unknown,
): ArgumentLibraryValidationResult {
  const issues: ArgumentLibraryValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          path: '$',
          code: 'invalid-type',
          message: 'Expected an Argument Library object.',
        },
      ],
    };
  }
  fields(
    value,
    [
      'schemaVersion',
      'libraryId',
      'libraryRevision',
      'createdAt',
      'updatedAt',
      'topics',
      'axioms',
      'counterArguments',
    ],
    [],
    '$',
    issues,
  );
  if (
    typeof value.schemaVersion === 'number' &&
    value.schemaVersion > ARGUMENT_LIBRARY_SCHEMA_VERSION
  ) {
    issue(
      issues,
      '$.schemaVersion',
      'future-schema',
      'Argument Library uses a newer schema version.',
    );
  } else if (value.schemaVersion !== ARGUMENT_LIBRARY_SCHEMA_VERSION) {
    issue(
      issues,
      '$.schemaVersion',
      'invalid-value',
      'Unsupported Argument Library schema version.',
    );
  }
  nonEmptyString(value.libraryId, '$.libraryId', issues);
  positiveRevision(value.libraryRevision, '$.libraryRevision', issues);
  timestamp(value.createdAt, '$.createdAt', issues);
  timestamp(value.updatedAt, '$.updatedAt', issues);
  const globalIds = new Set<string>();
  const topicIds = collectIds(value.topics, '$.topics', issues, globalIds);
  const axiomIds = collectIds(value.axioms, '$.axioms', issues, globalIds);
  const counterIds = collectIds(
    value.counterArguments,
    '$.counterArguments',
    issues,
    globalIds,
  );
  const sourceIds = new Set<string>();
  if (Array.isArray(value.topics))
    value.topics.forEach((entry, index) =>
      validateTopic(entry, `$.topics[${index}]`, issues),
    );
  if (Array.isArray(value.axioms))
    value.axioms.forEach((entry, index) =>
      validateAxiom(entry, `$.axioms[${index}]`, issues, sourceIds),
    );
  if (Array.isArray(value.counterArguments))
    value.counterArguments.forEach((entry, index) =>
      validateCounterArgument(
        entry,
        `$.counterArguments[${index}]`,
        issues,
        sourceIds,
      ),
    );
  validateIntegrity(value, topicIds, axiomIds, counterIds, issues);
  return issues.length === 0
    ? { valid: true, value: value as unknown as ArgumentLibrary, issues: [] }
    : { valid: false, issues };
}

export function assertValidArgumentLibrary(value: unknown): ArgumentLibrary {
  const validation = validateArgumentLibrary(value);
  if (validation.valid) return validation.value;
  const first = validation.issues[0];
  throw new Error(
    `Invalid Argument Library${first === undefined ? '.' : ` at ${first.path}: ${first.message}`}`,
  );
}
