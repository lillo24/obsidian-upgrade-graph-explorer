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
const PROPOSAL_STATUSES = new Set(['pending', 'accepted', 'rejected']);
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

function textArray(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): value is readonly string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'invalid-type', 'Expected an array.');
    return false;
  }
  let valid = true;
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry, `${path}[${index}]`, issues)) valid = false;
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
  schemaVersion: 1 | 2 | 3 | 4 | 5 = 5,
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
      ...(schemaVersion >= 2 ? ['argumentIds'] : []),
      'counterArgumentIds',
    ],
    schemaVersion >= 2 ? ['currentArgumentId'] : [],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  nonEmptyString(value.summary, `${path}.summary`, issues);
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  stringArray(value.axiomIds, `${path}.axiomIds`, issues);
  if (schemaVersion >= 2) {
    stringArray(value.argumentIds, `${path}.argumentIds`, issues);
    if (Object.hasOwn(value, 'currentArgumentId')) {
      nonEmptyString(
        value.currentArgumentId,
        `${path}.currentArgumentId`,
        issues,
      );
    }
  }
  stringArray(value.counterArgumentIds, `${path}.counterArgumentIds`, issues);
}

function validateArgumentPremise(
  value: unknown,
  path: string,
  ownerId: unknown,
  issues: ArgumentLibraryValidationIssue[],
  schemaVersion: 2 | 3 | 4 | 5 = 5,
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected an Argument premise.');
    return;
  }
  if (value.kind === 'text') {
    fields(
      value,
      ['id', 'kind', 'text'],
      schemaVersion >= 3 ? ['exampleIds'] : [],
      path,
      issues,
    );
    nonEmptyString(value.id, `${path}.id`, issues);
    nonEmptyString(value.text, `${path}.text`, issues);
    if (schemaVersion >= 3 && Object.hasOwn(value, 'exampleIds')) {
      stringArray(value.exampleIds, `${path}.exampleIds`, issues);
    }
    return;
  }
  if (value.kind === 'axiom') {
    fields(
      value,
      ['id', 'kind', 'axiomId', 'reliedOnRevision'],
      schemaVersion >= 3 ? ['exampleIds'] : [],
      path,
      issues,
    );
    nonEmptyString(value.id, `${path}.id`, issues);
    nonEmptyString(value.axiomId, `${path}.axiomId`, issues);
    positiveRevision(
      value.reliedOnRevision,
      `${path}.reliedOnRevision`,
      issues,
    );
    if (schemaVersion >= 3 && Object.hasOwn(value, 'exampleIds')) {
      stringArray(value.exampleIds, `${path}.exampleIds`, issues);
    }
    return;
  }
  if (value.kind === 'argument-conclusion') {
    fields(
      value,
      ['id', 'kind', 'argumentId', 'reliedOnRevision'],
      schemaVersion >= 3 ? ['exampleIds'] : [],
      path,
      issues,
    );
    nonEmptyString(value.id, `${path}.id`, issues);
    if (
      nonEmptyString(value.argumentId, `${path}.argumentId`, issues) &&
      value.argumentId === ownerId
    ) {
      issue(
        issues,
        `${path}.argumentId`,
        'self-reference',
        'An Argument cannot use its own conclusion as a premise.',
      );
    }
    positiveRevision(
      value.reliedOnRevision,
      `${path}.reliedOnRevision`,
      issues,
    );
    if (schemaVersion >= 3 && Object.hasOwn(value, 'exampleIds')) {
      stringArray(value.exampleIds, `${path}.exampleIds`, issues);
    }
    return;
  }
  if (value.kind === 'argument-premise' && schemaVersion >= 3) {
    fields(
      value,
      ['id', 'kind', 'argumentId', 'premiseId', 'reliedOnRevision'],
      ['exampleIds'],
      path,
      issues,
    );
    nonEmptyString(value.id, `${path}.id`, issues);
    if (
      nonEmptyString(value.argumentId, `${path}.argumentId`, issues) &&
      value.argumentId === ownerId
    ) {
      issue(
        issues,
        `${path}.argumentId`,
        'self-reference',
        'An Argument cannot use one of its own premises as an external premise dependency.',
      );
    }
    nonEmptyString(value.premiseId, `${path}.premiseId`, issues);
    positiveRevision(
      value.reliedOnRevision,
      `${path}.reliedOnRevision`,
      issues,
    );
    if (Object.hasOwn(value, 'exampleIds')) {
      stringArray(value.exampleIds, `${path}.exampleIds`, issues);
    }
    return;
  }
  issue(issues, `${path}.kind`, 'invalid-value', 'Unsupported premise kind.');
}

function validateArgument(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
  sourceIds: Set<string>,
  schemaVersion: 2 | 3 | 4 | 5 = 5,
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected an Argument.');
    return;
  }
  fields(
    value,
    [
      ...METADATA_FIELDS,
      'title',
      ...(schemaVersion >= 3 ? ['examples'] : []),
      'premises',
      'conclusion',
      ...(schemaVersion >= 3 ? ['relations'] : []),
      ...(schemaVersion >= 4 ? ['contextIds'] : []),
      'retrieval',
      'sourceReferences',
    ],
    [
      'reasoning',
      ...(schemaVersion >= 3 ? ['boundary'] : []),
      'supersedesArgumentId',
    ],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  if (schemaVersion >= 3) {
    if (!Array.isArray(value.examples)) {
      issue(issues, `${path}.examples`, 'invalid-type', 'Expected an array.');
    } else {
      const exampleIds = new Set<string>();
      value.examples.forEach((example, index) => {
        const examplePath = `${path}.examples[${index}]`;
        if (!isRecord(example)) {
          issue(issues, examplePath, 'invalid-type', 'Expected an Example.');
          return;
        }
        fields(example, ['id', 'text'], [], examplePath, issues);
        nonEmptyString(example.id, `${examplePath}.id`, issues);
        nonEmptyString(example.text, `${examplePath}.text`, issues);
        if (typeof example.id === 'string') {
          if (exampleIds.has(example.id)) {
            issue(
              issues,
              `${examplePath}.id`,
              'duplicate-id',
              'Example IDs must be unique within an Argument.',
            );
          }
          exampleIds.add(example.id);
        }
      });
    }
  }
  if (!Array.isArray(value.premises)) {
    issue(issues, `${path}.premises`, 'invalid-type', 'Expected an array.');
  } else {
    const premiseIds = new Set<string>();
    value.premises.forEach((premise, index) => {
      const premisePath = `${path}.premises[${index}]`;
      validateArgumentPremise(
        premise,
        premisePath,
        value.id,
        issues,
        schemaVersion,
      );
      if (isRecord(premise) && typeof premise.id === 'string') {
        if (premiseIds.has(premise.id)) {
          issue(
            issues,
            `${premisePath}.id`,
            'duplicate-id',
            'Premise IDs must be unique within an Argument.',
          );
        }
        premiseIds.add(premise.id);
      }
    });
  }
  if (Object.hasOwn(value, 'reasoning')) {
    nonEmptyString(value.reasoning, `${path}.reasoning`, issues);
  }
  nonEmptyString(value.conclusion, `${path}.conclusion`, issues);
  if (schemaVersion >= 3 && Object.hasOwn(value, 'boundary')) {
    nonEmptyString(value.boundary, `${path}.boundary`, issues);
  }
  if (schemaVersion >= 3) {
    if (!Array.isArray(value.relations)) {
      issue(issues, `${path}.relations`, 'invalid-type', 'Expected an array.');
    } else {
      const relationIds = new Set<string>();
      value.relations.forEach((relation, index) => {
        const relationPath = `${path}.relations[${index}]`;
        if (!isRecord(relation)) {
          issue(
            issues,
            relationPath,
            'invalid-type',
            'Expected an Argument relation.',
          );
          return;
        }
        fields(
          relation,
          ['id', 'kind', 'targetArgumentId', 'targetPart', 'reliedOnRevision'],
          [],
          relationPath,
          issues,
        );
        nonEmptyString(relation.id, `${relationPath}.id`, issues);
        if (relation.kind !== 'attack' && relation.kind !== 'support') {
          issue(
            issues,
            `${relationPath}.kind`,
            'invalid-value',
            'Argument relation kind must be attack or support.',
          );
        }
        if (
          nonEmptyString(
            relation.targetArgumentId,
            `${relationPath}.targetArgumentId`,
            issues,
          ) &&
          relation.targetArgumentId === value.id
        ) {
          issue(
            issues,
            `${relationPath}.targetArgumentId`,
            'self-reference',
            'An Argument relation must target another Argument.',
          );
        }
        validateArgumentTargetPart(
          relation.targetPart,
          `${relationPath}.targetPart`,
          issues,
        );
        positiveRevision(
          relation.reliedOnRevision,
          `${relationPath}.reliedOnRevision`,
          issues,
        );
        if (typeof relation.id === 'string') {
          if (relationIds.has(relation.id)) {
            issue(
              issues,
              `${relationPath}.id`,
              'duplicate-id',
              'Relation IDs must be unique within an Argument.',
            );
          }
          relationIds.add(relation.id);
        }
      });
    }
  }
  if (schemaVersion >= 4) {
    stringArray(value.contextIds, `${path}.contextIds`, issues);
  }
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  if (Object.hasOwn(value, 'supersedesArgumentId')) {
    if (
      nonEmptyString(
        value.supersedesArgumentId,
        `${path}.supersedesArgumentId`,
        issues,
      ) &&
      value.supersedesArgumentId === value.id
    ) {
      issue(
        issues,
        `${path}.supersedesArgumentId`,
        'self-reference',
        'An Argument cannot supersede itself.',
      );
    }
  }
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

function validateContext(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a Context.');
    return;
  }
  fields(
    value,
    [...METADATA_FIELDS, 'title', 'retrieval', 'axiomIds'],
    ['description', 'parentContextId'],
    path,
    issues,
  );
  validateMetadata(value, path, issues);
  nonEmptyString(value.title, `${path}.title`, issues);
  if (Object.hasOwn(value, 'description')) {
    nonEmptyString(value.description, `${path}.description`, issues);
  }
  validateRetrieval(value.retrieval, `${path}.retrieval`, issues);
  stringArray(value.axiomIds, `${path}.axiomIds`, issues);
  if (
    Object.hasOwn(value, 'parentContextId') &&
    nonEmptyString(value.parentContextId, `${path}.parentContextId`, issues) &&
    value.parentContextId === value.id
  ) {
    issue(
      issues,
      `${path}.parentContextId`,
      'self-reference',
      'A Context cannot inherit from itself.',
    );
  }
}

function validateArgumentTargetPart(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected an Argument target part.');
  } else if (
    value.kind === 'argument' ||
    value.kind === 'reasoning' ||
    value.kind === 'conclusion'
  ) {
    fields(value, ['kind'], [], path, issues);
  } else if (value.kind === 'premise') {
    fields(value, ['kind', 'premiseId'], [], path, issues);
    nonEmptyString(value.premiseId, `${path}.premiseId`, issues);
  } else {
    issue(
      issues,
      `${path}.kind`,
      'invalid-value',
      'Unsupported Argument target part.',
    );
  }
}

function validateTarget(
  value: unknown,
  path: string,
  ownerId: unknown,
  issues: ArgumentLibraryValidationIssue[],
  allowArgumentTarget = true,
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
  } else if (value.kind === 'argument' && allowArgumentTarget) {
    fields(value, ['kind', 'argumentId', 'part'], [], path, issues);
    nonEmptyString(value.argumentId, `${path}.argumentId`, issues);
    validateArgumentTargetPart(value.part, `${path}.part`, issues);
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
  allowArgumentTarget = true,
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
    validateTarget(
      value.target,
      `${path}.target`,
      value.id,
      issues,
      allowArgumentTarget,
    );
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

function validateProposalConsultation(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected proposal consultation.');
    return;
  }
  fields(
    value,
    ['libraryId', 'libraryRevision', 'records'],
    ['contentFingerprint'],
    path,
    issues,
  );
  nonEmptyString(value.libraryId, `${path}.libraryId`, issues);
  positiveRevision(value.libraryRevision, `${path}.libraryRevision`, issues);
  if (Object.hasOwn(value, 'contentFingerprint')) {
    validateFingerprint(
      value.contentFingerprint,
      `${path}.contentFingerprint`,
      issues,
    );
  }
  if (!Array.isArray(value.records)) {
    issue(issues, `${path}.records`, 'invalid-type', 'Expected an array.');
    return;
  }
  if (value.records.length === 0) {
    issue(
      issues,
      `${path}.records`,
      'invalid-value',
      'Proposal consultation must retain at least one record identity.',
    );
  }
  const seen = new Set<string>();
  value.records.forEach((record, index) => {
    const recordPath = `${path}.records[${index}]`;
    if (!isRecord(record)) {
      issue(
        issues,
        recordPath,
        'invalid-type',
        'Expected a consulted record identity.',
      );
      return;
    }
    fields(record, ['kind', 'id'], ['revision'], recordPath, issues);
    if (
      record.kind !== 'topic' &&
      record.kind !== 'axiom' &&
      record.kind !== 'argument' &&
      record.kind !== 'counter-argument'
    ) {
      issue(
        issues,
        `${recordPath}.kind`,
        'invalid-value',
        'Unsupported consulted record kind.',
      );
    }
    if (nonEmptyString(record.id, `${recordPath}.id`, issues)) {
      const key = `${String(record.kind)}\0${record.id}`;
      if (seen.has(key)) {
        issue(
          issues,
          `${recordPath}.id`,
          'duplicate-id',
          'Duplicate consulted record identity.',
        );
      }
      seen.add(key);
    }
    if (Object.hasOwn(record, 'revision')) {
      positiveRevision(record.revision, `${recordPath}.revision`, issues);
    }
  });
}

function validateProposal(
  value: unknown,
  path: string,
  issues: ArgumentLibraryValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'invalid-type', 'Expected a Mailbox proposal.');
    return;
  }
  fields(
    value,
    [
      'id',
      'revision',
      'createdAt',
      'updatedAt',
      'status',
      'title',
      'examples',
      'premiseHints',
      'suggestedAxiomIds',
      'conclusion',
      'whyNovelOrUnresolved',
      'consultation',
      'submissionFingerprint',
    ],
    [
      'topicId',
      'target',
      'reasoning',
      'boundary',
      'clientSubmissionId',
      'decision',
    ],
    path,
    issues,
  );
  nonEmptyString(value.id, `${path}.id`, issues);
  positiveRevision(value.revision, `${path}.revision`, issues);
  timestamp(value.createdAt, `${path}.createdAt`, issues);
  timestamp(value.updatedAt, `${path}.updatedAt`, issues);
  if (!PROPOSAL_STATUSES.has(value.status as string)) {
    issue(
      issues,
      `${path}.status`,
      'invalid-value',
      'Unsupported proposal status.',
    );
  }
  nonEmptyString(value.title, `${path}.title`, issues);
  if (Object.hasOwn(value, 'topicId')) {
    nonEmptyString(value.topicId, `${path}.topicId`, issues);
  }
  if (Object.hasOwn(value, 'target')) {
    const targetPath = `${path}.target`;
    if (!isRecord(value.target)) {
      issue(issues, targetPath, 'invalid-type', 'Expected a proposal target.');
    } else {
      fields(
        value.target,
        ['argumentId', 'part', 'reliedOnRevision'],
        [],
        targetPath,
        issues,
      );
      nonEmptyString(
        value.target.argumentId,
        `${targetPath}.argumentId`,
        issues,
      );
      validateArgumentTargetPart(
        value.target.part,
        `${targetPath}.part`,
        issues,
      );
      positiveRevision(
        value.target.reliedOnRevision,
        `${targetPath}.reliedOnRevision`,
        issues,
      );
    }
  }
  textArray(value.examples, `${path}.examples`, issues);
  textArray(value.premiseHints, `${path}.premiseHints`, issues);
  stringArray(value.suggestedAxiomIds, `${path}.suggestedAxiomIds`, issues);
  for (const field of [
    'reasoning',
    'boundary',
    'clientSubmissionId',
  ] as const) {
    if (Object.hasOwn(value, field)) {
      nonEmptyString(value[field], `${path}.${field}`, issues);
    }
  }
  nonEmptyString(value.conclusion, `${path}.conclusion`, issues);
  nonEmptyString(
    value.whyNovelOrUnresolved,
    `${path}.whyNovelOrUnresolved`,
    issues,
  );
  validateProposalConsultation(
    value.consultation,
    `${path}.consultation`,
    issues,
  );
  validateFingerprint(
    value.submissionFingerprint,
    `${path}.submissionFingerprint`,
    issues,
  );

  const hasDecision = Object.hasOwn(value, 'decision');
  if (value.status === 'pending' && hasDecision) {
    issue(
      issues,
      `${path}.decision`,
      'invalid-value',
      'Pending proposals must not have a decision.',
    );
  } else if (value.status !== 'pending' && !hasDecision) {
    issue(
      issues,
      `${path}.decision`,
      'invalid-type',
      'Resolved proposals require a decision.',
    );
  }
  if (!hasDecision) return;
  if (!isRecord(value.decision)) {
    issue(
      issues,
      `${path}.decision`,
      'invalid-type',
      'Expected a proposal decision.',
    );
    return;
  }
  fields(
    value.decision,
    ['decidedAt'],
    ['note', 'resultingArgumentId', 'resultingCounterArgumentId'],
    `${path}.decision`,
    issues,
  );
  timestamp(value.decision.decidedAt, `${path}.decision.decidedAt`, issues);
  if (Object.hasOwn(value.decision, 'note')) {
    nonEmptyString(value.decision.note, `${path}.decision.note`, issues);
  }
  const argumentResult = Object.hasOwn(value.decision, 'resultingArgumentId');
  const counterResult = Object.hasOwn(
    value.decision,
    'resultingCounterArgumentId',
  );
  if (argumentResult) {
    nonEmptyString(
      value.decision.resultingArgumentId,
      `${path}.decision.resultingArgumentId`,
      issues,
    );
  }
  if (counterResult) {
    nonEmptyString(
      value.decision.resultingCounterArgumentId,
      `${path}.decision.resultingCounterArgumentId`,
      issues,
    );
  }
  if (
    (value.status === 'accepted' && (!argumentResult || counterResult)) ||
    (value.status === 'rejected' && (!counterResult || argumentResult))
  ) {
    issue(
      issues,
      `${path}.decision`,
      'invalid-value',
      'Accepted proposals must link one Argument; rejected proposals must link one Counter-Argument.',
    );
  }
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
  contextIds: ReadonlySet<string>,
  axiomIds: ReadonlySet<string>,
  argumentIds: ReadonlySet<string>,
  counterIds: ReadonlySet<string>,
  issues: ArgumentLibraryValidationIssue[],
): void {
  const argumentsById = new Map<string, PlainRecord>();
  const argumentIndexById = new Map<string, number>();
  const contextsById = new Map<string, PlainRecord>();
  const contextIndexById = new Map<string, number>();
  if (Array.isArray(library.contexts)) {
    library.contexts.forEach((entry, index) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') return;
      contextsById.set(entry.id, entry);
      contextIndexById.set(entry.id, index);
    });
  }
  if (Array.isArray(library.arguments)) {
    library.arguments.forEach((entry, index) => {
      if (!isRecord(entry) || typeof entry.id !== 'string') return;
      argumentsById.set(entry.id, entry);
      argumentIndexById.set(entry.id, index);
    });
  }
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
      if (Array.isArray(entry.argumentIds)) {
        entry.argumentIds.forEach((id, memberIndex) => {
          if (typeof id === 'string' && !argumentIds.has(id)) {
            issue(
              issues,
              `$.topics[${index}].argumentIds[${memberIndex}]`,
              'missing-reference',
              `Unknown Argument "${id}".`,
            );
          }
        });
      }
      if (typeof entry.currentArgumentId === 'string') {
        const current = argumentsById.get(entry.currentArgumentId);
        if (!argumentIds.has(entry.currentArgumentId)) {
          issue(
            issues,
            `$.topics[${index}].currentArgumentId`,
            'missing-reference',
            `Unknown current Argument "${entry.currentArgumentId}".`,
          );
        } else if (
          !Array.isArray(entry.argumentIds) ||
          !entry.argumentIds.includes(entry.currentArgumentId)
        ) {
          issue(
            issues,
            `$.topics[${index}].currentArgumentId`,
            'invalid-value',
            'The current Argument must belong to the Topic.',
          );
        } else if (current?.archived === true) {
          issue(
            issues,
            `$.topics[${index}].currentArgumentId`,
            'invalid-value',
            'The current Argument cannot be archived.',
          );
        }
      }
    });
  }
  if (Array.isArray(library.contexts)) {
    library.contexts.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      if (Array.isArray(entry.axiomIds)) {
        entry.axiomIds.forEach((id, memberIndex) => {
          if (typeof id === 'string' && !axiomIds.has(id)) {
            issue(
              issues,
              `$.contexts[${index}].axiomIds[${memberIndex}]`,
              'missing-reference',
              `Unknown Axiom "${id}".`,
            );
          }
        });
      }
      if (
        typeof entry.parentContextId === 'string' &&
        !contextIds.has(entry.parentContextId)
      ) {
        issue(
          issues,
          `$.contexts[${index}].parentContextId`,
          'missing-reference',
          `Unknown parent Context "${entry.parentContextId}".`,
        );
      }
    });
  }
  if (Array.isArray(library.arguments)) {
    library.arguments.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const localExampleIds = new Set(
        Array.isArray(entry.examples)
          ? entry.examples.flatMap((example) =>
              isRecord(example) && typeof example.id === 'string'
                ? [example.id]
                : [],
            )
          : [],
      );
      if (Array.isArray(entry.premises)) {
        entry.premises.forEach((premise, premiseIndex) => {
          if (!isRecord(premise)) return;
          let referencedId: unknown;
          let referencedIds: ReadonlySet<string> | undefined;
          let referencedKind: 'Axiom' | 'Argument' | undefined;
          if (premise.kind === 'axiom') {
            referencedId = premise.axiomId;
            referencedIds = axiomIds;
            referencedKind = 'Axiom';
          } else if (
            premise.kind === 'argument-conclusion' ||
            premise.kind === 'argument-premise'
          ) {
            referencedId = premise.argumentId;
            referencedIds = argumentIds;
            referencedKind = 'Argument';
          }
          if (
            typeof referencedId === 'string' &&
            referencedIds !== undefined &&
            !referencedIds.has(referencedId)
          ) {
            issue(
              issues,
              `$.arguments[${index}].premises[${premiseIndex}]`,
              'missing-reference',
              `Unknown ${referencedKind} "${referencedId}".`,
            );
          }
          if (Array.isArray(premise.exampleIds)) {
            premise.exampleIds.forEach((exampleId, exampleIndex) => {
              if (
                typeof exampleId === 'string' &&
                !localExampleIds.has(exampleId)
              ) {
                issue(
                  issues,
                  `$.arguments[${index}].premises[${premiseIndex}].exampleIds[${exampleIndex}]`,
                  'missing-reference',
                  `Unknown local Example "${exampleId}".`,
                );
              }
            });
          }
          if (
            premise.kind === 'argument-premise' &&
            typeof premise.argumentId === 'string' &&
            typeof premise.premiseId === 'string'
          ) {
            const targetArgument = argumentsById.get(premise.argumentId);
            if (
              targetArgument !== undefined &&
              (!Array.isArray(targetArgument.premises) ||
                !targetArgument.premises.some(
                  (targetPremise) =>
                    isRecord(targetPremise) &&
                    targetPremise.id === premise.premiseId,
                ))
            ) {
              issue(
                issues,
                `$.arguments[${index}].premises[${premiseIndex}].premiseId`,
                'missing-reference',
                `Unknown source premise "${premise.premiseId}".`,
              );
            }
          }
        });
      }
      if (Array.isArray(entry.relations)) {
        entry.relations.forEach((relation, relationIndex) => {
          if (
            !isRecord(relation) ||
            typeof relation.targetArgumentId !== 'string'
          ) {
            return;
          }
          const relationPath = `$.arguments[${index}].relations[${relationIndex}]`;
          const targetArgument = argumentsById.get(relation.targetArgumentId);
          if (targetArgument === undefined) {
            issue(
              issues,
              `${relationPath}.targetArgumentId`,
              'missing-reference',
              `Unknown target Argument "${relation.targetArgumentId}".`,
            );
            return;
          }
          const targetPart = relation.targetPart;
          if (!isRecord(targetPart)) return;
          if (
            targetPart.kind === 'premise' &&
            typeof targetPart.premiseId === 'string' &&
            (!Array.isArray(targetArgument.premises) ||
              !targetArgument.premises.some(
                (premise) =>
                  isRecord(premise) && premise.id === targetPart.premiseId,
              ))
          ) {
            issue(
              issues,
              `${relationPath}.targetPart.premiseId`,
              'missing-reference',
              `Unknown target premise "${targetPart.premiseId}".`,
            );
          }
          if (
            targetPart.kind === 'reasoning' &&
            typeof targetArgument.reasoning !== 'string'
          ) {
            issue(
              issues,
              `${relationPath}.targetPart`,
              'missing-reference',
              'The target Argument has no reasoning section.',
            );
          }
        });
      }
      if (Array.isArray(entry.contextIds)) {
        entry.contextIds.forEach((id, contextIndex) => {
          if (typeof id === 'string' && !contextIds.has(id)) {
            issue(
              issues,
              `$.arguments[${index}].contextIds[${contextIndex}]`,
              'missing-reference',
              `Unknown Context "${id}".`,
            );
          }
        });
      }
      if (
        typeof entry.supersedesArgumentId === 'string' &&
        !argumentIds.has(entry.supersedesArgumentId)
      ) {
        issue(
          issues,
          `$.arguments[${index}].supersedesArgumentId`,
          'missing-reference',
          `Unknown superseded Argument "${entry.supersedesArgumentId}".`,
        );
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
      } else if (entry.target.kind === 'argument') {
        targetId = entry.target.argumentId;
        targetSet = argumentIds;
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
      if (
        entry.target.kind === 'argument' &&
        typeof entry.target.argumentId === 'string' &&
        isRecord(entry.target.part)
      ) {
        const targetArgument = argumentsById.get(entry.target.argumentId);
        const targetPart = entry.target.part;
        if (
          targetArgument !== undefined &&
          targetPart.kind === 'premise' &&
          typeof targetPart.premiseId === 'string' &&
          (!Array.isArray(targetArgument.premises) ||
            !targetArgument.premises.some(
              (premise) =>
                isRecord(premise) && premise.id === targetPart.premiseId,
            ))
        ) {
          issue(
            issues,
            `$.counterArguments[${index}].target.part.premiseId`,
            'missing-reference',
            `Unknown target premise "${targetPart.premiseId}".`,
          );
        }
        if (
          targetArgument !== undefined &&
          targetPart.kind === 'reasoning' &&
          typeof targetArgument.reasoning !== 'string'
        ) {
          issue(
            issues,
            `$.counterArguments[${index}].target.part`,
            'missing-reference',
            'The target Argument has no reasoning section.',
          );
        }
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

  if (Array.isArray(library.proposals)) {
    library.proposals.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      if (typeof entry.topicId === 'string' && !topicIds.has(entry.topicId)) {
        issue(
          issues,
          `$.proposals[${index}].topicId`,
          'missing-reference',
          `Unknown Topic "${entry.topicId}".`,
        );
      }
      if (
        isRecord(entry.target) &&
        typeof entry.target.argumentId === 'string' &&
        !argumentIds.has(entry.target.argumentId)
      ) {
        issue(
          issues,
          `$.proposals[${index}].target.argumentId`,
          'missing-reference',
          `Unknown target Argument "${entry.target.argumentId}".`,
        );
      }
      if (Array.isArray(entry.suggestedAxiomIds)) {
        entry.suggestedAxiomIds.forEach((axiomId, axiomIndex) => {
          if (typeof axiomId === 'string' && !axiomIds.has(axiomId)) {
            issue(
              issues,
              `$.proposals[${index}].suggestedAxiomIds[${axiomIndex}]`,
              'missing-reference',
              `Unknown suggested Axiom "${axiomId}".`,
            );
          }
        });
      }
      if (
        isRecord(entry.consultation) &&
        Array.isArray(entry.consultation.records)
      ) {
        entry.consultation.records.forEach((identity, identityIndex) => {
          if (!isRecord(identity) || typeof identity.id !== 'string') return;
          const exists =
            (identity.kind === 'topic' && topicIds.has(identity.id)) ||
            (identity.kind === 'axiom' && axiomIds.has(identity.id)) ||
            (identity.kind === 'argument' && argumentIds.has(identity.id)) ||
            (identity.kind === 'counter-argument' &&
              counterIds.has(identity.id));
          if (!exists) {
            issue(
              issues,
              `$.proposals[${index}].consultation.records[${identityIndex}].id`,
              'missing-reference',
              `Unknown consulted ${String(identity.kind)} "${identity.id}".`,
            );
          }
        });
      }
      if (!isRecord(entry.decision)) return;
      if (
        typeof entry.decision.resultingArgumentId === 'string' &&
        !argumentIds.has(entry.decision.resultingArgumentId)
      ) {
        issue(
          issues,
          `$.proposals[${index}].decision.resultingArgumentId`,
          'missing-reference',
          `Unknown resulting Argument "${entry.decision.resultingArgumentId}".`,
        );
      }
      if (
        typeof entry.decision.resultingCounterArgumentId === 'string' &&
        !counterIds.has(entry.decision.resultingCounterArgumentId)
      ) {
        issue(
          issues,
          `$.proposals[${index}].decision.resultingCounterArgumentId`,
          'missing-reference',
          `Unknown resulting Counter-Argument "${entry.decision.resultingCounterArgumentId}".`,
        );
      }
    });
  }

  const visitGraph = (
    edgeKind: 'premise' | 'supersession',
    edgesFor: (record: PlainRecord) => readonly string[],
  ): void => {
    const state = new Map<string, 'visiting' | 'visited'>();
    const visit = (id: string): void => {
      const current = state.get(id);
      if (current === 'visited') return;
      if (current === 'visiting') return;
      state.set(id, 'visiting');
      const record = argumentsById.get(id);
      if (record !== undefined) {
        for (const dependencyId of edgesFor(record)) {
          if (!argumentsById.has(dependencyId)) continue;
          if (state.get(dependencyId) === 'visiting') {
            const recordIndex = argumentIndexById.get(id);
            issue(
              issues,
              recordIndex === undefined
                ? '$.arguments'
                : `$.arguments[${recordIndex}]`,
              'dependency-cycle',
              edgeKind === 'premise'
                ? 'Argument premise dependencies must not form a dependency cycle.'
                : 'Argument supersession links must not form a cycle.',
            );
            continue;
          }
          visit(dependencyId);
        }
      }
      state.set(id, 'visited');
    };
    for (const id of argumentsById.keys()) visit(id);
  };

  visitGraph('premise', (record) =>
    Array.isArray(record.premises)
      ? record.premises.flatMap((premise) =>
          isRecord(premise) &&
          (premise.kind === 'argument-conclusion' ||
            premise.kind === 'argument-premise') &&
          typeof premise.argumentId === 'string'
            ? [premise.argumentId]
            : [],
        )
      : [],
  );
  visitGraph('supersession', (record) =>
    typeof record.supersedesArgumentId === 'string'
      ? [record.supersedesArgumentId]
      : [],
  );

  const contextState = new Map<string, 'visiting' | 'visited'>();
  const visitContext = (id: string): void => {
    const current = contextState.get(id);
    if (current === 'visited' || current === 'visiting') return;
    contextState.set(id, 'visiting');
    const record = contextsById.get(id);
    const parentId = record?.parentContextId;
    if (typeof parentId === 'string' && contextsById.has(parentId)) {
      if (contextState.get(parentId) === 'visiting') {
        const recordIndex = contextIndexById.get(id);
        issue(
          issues,
          recordIndex === undefined
            ? '$.contexts'
            : `$.contexts[${recordIndex}].parentContextId`,
          'dependency-cycle',
          'Context parent links must not form an inheritance cycle.',
        );
      } else {
        visitContext(parentId);
      }
    }
    contextState.set(id, 'visited');
  };
  for (const id of contextsById.keys()) visitContext(id);
}

function validateArgumentLibraryVersion(
  value: unknown,
  expectedVersion: 2 | 3 | 4 | 5,
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
      ...(expectedVersion >= 4 ? ['contexts'] : []),
      'axioms',
      'arguments',
      'counterArguments',
      ...(expectedVersion >= 5 ? ['proposals'] : []),
    ],
    [],
    '$',
    issues,
  );
  if (
    expectedVersion === ARGUMENT_LIBRARY_SCHEMA_VERSION &&
    typeof value.schemaVersion === 'number' &&
    value.schemaVersion > ARGUMENT_LIBRARY_SCHEMA_VERSION
  ) {
    issue(
      issues,
      '$.schemaVersion',
      'future-schema',
      'Argument Library uses a newer schema version.',
    );
  } else if (value.schemaVersion !== expectedVersion) {
    issue(
      issues,
      '$.schemaVersion',
      'invalid-value',
      `Expected Argument Library schema version ${expectedVersion}.`,
    );
  }
  nonEmptyString(value.libraryId, '$.libraryId', issues);
  positiveRevision(value.libraryRevision, '$.libraryRevision', issues);
  timestamp(value.createdAt, '$.createdAt', issues);
  timestamp(value.updatedAt, '$.updatedAt', issues);
  const globalIds = new Set<string>();
  const topicIds = collectIds(value.topics, '$.topics', issues, globalIds);
  const contextIds =
    expectedVersion >= 4
      ? collectIds(value.contexts, '$.contexts', issues, globalIds)
      : new Set<string>();
  const axiomIds = collectIds(value.axioms, '$.axioms', issues, globalIds);
  const argumentIds = collectIds(
    value.arguments,
    '$.arguments',
    issues,
    globalIds,
  );
  const counterIds = collectIds(
    value.counterArguments,
    '$.counterArguments',
    issues,
    globalIds,
  );
  if (expectedVersion >= 5) {
    collectIds(value.proposals, '$.proposals', issues, globalIds);
  }
  const sourceIds = new Set<string>();
  if (Array.isArray(value.topics))
    value.topics.forEach((entry, index) =>
      validateTopic(entry, `$.topics[${index}]`, issues, expectedVersion),
    );
  if (expectedVersion >= 4 && Array.isArray(value.contexts))
    value.contexts.forEach((entry, index) =>
      validateContext(entry, `$.contexts[${index}]`, issues),
    );
  if (Array.isArray(value.axioms))
    value.axioms.forEach((entry, index) =>
      validateAxiom(entry, `$.axioms[${index}]`, issues, sourceIds),
    );
  if (Array.isArray(value.arguments))
    value.arguments.forEach((entry, index) =>
      validateArgument(
        entry,
        `$.arguments[${index}]`,
        issues,
        sourceIds,
        expectedVersion,
      ),
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
  if (expectedVersion >= 5 && Array.isArray(value.proposals)) {
    value.proposals.forEach((entry, index) =>
      validateProposal(entry, `$.proposals[${index}]`, issues),
    );
  }
  validateIntegrity(
    value,
    topicIds,
    contextIds,
    axiomIds,
    argumentIds,
    counterIds,
    issues,
  );
  return issues.length === 0
    ? { valid: true, value: value as unknown as ArgumentLibrary, issues: [] }
    : { valid: false, issues };
}

export function validateArgumentLibrary(
  value: unknown,
): ArgumentLibraryValidationResult {
  return validateArgumentLibraryVersion(value, 5);
}

export type ArgumentLibraryV4ValidationResult =
  | {
      readonly valid: true;
      readonly value: PlainRecord;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

/** Strictly validates the schema-v4 shape before deterministic migration. */
export function validateArgumentLibraryV4(
  value: unknown,
): ArgumentLibraryV4ValidationResult {
  const validation = validateArgumentLibraryVersion(value, 4);
  return validation.valid
    ? { valid: true, value: value as PlainRecord, issues: [] }
    : validation;
}

export type ArgumentLibraryV3ValidationResult =
  | {
      readonly valid: true;
      readonly value: PlainRecord;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

/** Strictly validates the schema-v3 shape before deterministic migration. */
export function validateArgumentLibraryV3(
  value: unknown,
): ArgumentLibraryV3ValidationResult {
  const validation = validateArgumentLibraryVersion(value, 3);
  return validation.valid
    ? { valid: true, value: value as PlainRecord, issues: [] }
    : validation;
}

export type ArgumentLibraryV2ValidationResult =
  | {
      readonly valid: true;
      readonly value: PlainRecord;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

/** Strictly validates the schema-v2 shape before deterministic migration. */
export function validateArgumentLibraryV2(
  value: unknown,
): ArgumentLibraryV2ValidationResult {
  const validation = validateArgumentLibraryVersion(value, 2);
  return validation.valid
    ? {
        valid: true,
        value: value as PlainRecord,
        issues: [],
      }
    : validation;
}

export type ArgumentLibraryV1ValidationResult =
  | {
      readonly valid: true;
      readonly value: PlainRecord;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly ArgumentLibraryValidationIssue[];
    };

/** Strictly validates the legacy shape before deterministic v1 migration. */
export function validateArgumentLibraryV1(
  value: unknown,
): ArgumentLibraryV1ValidationResult {
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
  if (value.schemaVersion !== 1) {
    issue(
      issues,
      '$.schemaVersion',
      'invalid-value',
      'Expected Argument Library schema version 1.',
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
  if (Array.isArray(value.topics)) {
    value.topics.forEach((entry, index) =>
      validateTopic(entry, `$.topics[${index}]`, issues, 1),
    );
  }
  if (Array.isArray(value.axioms)) {
    value.axioms.forEach((entry, index) =>
      validateAxiom(entry, `$.axioms[${index}]`, issues, sourceIds),
    );
  }
  if (Array.isArray(value.counterArguments)) {
    value.counterArguments.forEach((entry, index) =>
      validateCounterArgument(
        entry,
        `$.counterArguments[${index}]`,
        issues,
        sourceIds,
        false,
      ),
    );
  }
  validateIntegrity(
    value,
    topicIds,
    new Set<string>(),
    axiomIds,
    new Set<string>(),
    counterIds,
    issues,
  );
  return issues.length === 0
    ? { valid: true, value, issues: [] }
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
