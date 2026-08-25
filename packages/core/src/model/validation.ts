import type {
  AddressableEntity,
  BlockEntity,
  DocumentEntity,
  SectionEntity,
} from './entities';
import type { EntityId } from './ids';
import type {
  Reference,
  ReferenceKind,
  ReferenceResolution,
} from './references';
import {
  KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION,
  type KnowledgeSnapshot,
  type WorkspaceDescriptor,
} from './snapshot';
import type { SourceLocation, SourcePoint, SourceSpan } from './source';

export type SnapshotValidationIssueCode =
  | 'invalid-type'
  | 'missing-field'
  | 'unexpected-field'
  | 'unsupported-schema-version'
  | 'invalid-id'
  | 'invalid-entity-kind'
  | 'invalid-reference-kind'
  | 'invalid-resolution-status'
  | 'invalid-workspace-path'
  | 'duplicate-document-path'
  | 'invalid-source-point'
  | 'invalid-source-span'
  | 'invalid-heading-level'
  | 'duplicate-entity-id'
  | 'duplicate-reference-id'
  | 'missing-parent'
  | 'self-parent'
  | 'invalid-parent-kind'
  | 'invalid-heading-parent-level'
  | 'source-path-mismatch'
  | 'hierarchy-cycle'
  | 'missing-reference-source'
  | 'missing-resolution-target'
  | 'invalid-ambiguous-candidates'
  | 'duplicate-ambiguous-candidate';

export interface SnapshotValidationIssue {
  readonly code: SnapshotValidationIssueCode;
  readonly path: string;
  readonly message: string;
}

export type SnapshotValidationResult =
  | {
      readonly valid: true;
      readonly value: KnowledgeSnapshot;
      readonly issues: readonly [];
    }
  | {
      readonly valid: false;
      readonly issues: readonly SnapshotValidationIssue[];
    };

type PlainRecord = Record<string, unknown>;

function addIssue(
  issues: SnapshotValidationIssue[],
  code: SnapshotValidationIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function checkFields(
  record: PlainRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  issues: SnapshotValidationIssue[],
): void {
  const allowed = new Set([...required, ...optional]);

  for (const key of required) {
    if (!hasOwn(record, key)) {
      addIssue(
        issues,
        'missing-field',
        `${path}.${key}`,
        `Required field "${key}" is missing.`,
      );
    }
  }

  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      addIssue(
        issues,
        'unexpected-field',
        `${path}.${key}`,
        `Field "${key}" is not part of this canonical shape.`,
      );
    }
  }
}

function readString(
  record: PlainRecord,
  key: string,
  path: string,
  issues: SnapshotValidationIssue[],
): string | undefined {
  if (!hasOwn(record, key)) {
    return undefined;
  }

  const value = record[key];
  if (typeof value !== 'string') {
    addIssue(issues, 'invalid-type', path, 'Expected a string.');
    return undefined;
  }

  return value;
}

function readNonEmptyString(
  record: PlainRecord,
  key: string,
  path: string,
  issues: SnapshotValidationIssue[],
  code: SnapshotValidationIssueCode = 'invalid-id',
): string | undefined {
  const value = readString(record, key, path, issues);
  if (value !== undefined && value.trim().length === 0) {
    addIssue(issues, code, path, 'Expected a non-empty string.');
    return undefined;
  }

  return value;
}

function readInteger(
  record: PlainRecord,
  key: string,
  path: string,
  minimum: number,
  issues: SnapshotValidationIssue[],
  code: SnapshotValidationIssueCode,
): number | undefined {
  if (!hasOwn(record, key)) {
    return undefined;
  }

  const value = record[key];
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    addIssue(
      issues,
      code,
      path,
      `Expected an integer greater than or equal to ${minimum}.`,
    );
    return undefined;
  }

  return value;
}

function parseSourcePoint(
  value: unknown,
  path: string,
  issues: SnapshotValidationIssue[],
): SourcePoint | undefined {
  const issueCount = issues.length;
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a source-point object.');
    return undefined;
  }

  checkFields(value, ['line', 'column'], ['offset'], path, issues);
  const line = readInteger(
    value,
    'line',
    `${path}.line`,
    1,
    issues,
    'invalid-source-point',
  );
  const column = readInteger(
    value,
    'column',
    `${path}.column`,
    1,
    issues,
    'invalid-source-point',
  );
  const offset = hasOwn(value, 'offset')
    ? readInteger(
        value,
        'offset',
        `${path}.offset`,
        0,
        issues,
        'invalid-source-point',
      )
    : undefined;

  if (
    issues.length !== issueCount ||
    line === undefined ||
    column === undefined
  ) {
    return undefined;
  }

  return offset === undefined ? { line, column } : { line, column, offset };
}

function comparePoints(start: SourcePoint, end: SourcePoint): number {
  if (start.line !== end.line) {
    return start.line - end.line;
  }

  return start.column - end.column;
}

function parseSourceSpan(
  value: unknown,
  path: string,
  issues: SnapshotValidationIssue[],
): SourceSpan | undefined {
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a source-span object.');
    return undefined;
  }

  checkFields(value, ['start', 'end'], [], path, issues);
  const start = parseSourcePoint(value.start, `${path}.start`, issues);
  const end = parseSourcePoint(value.end, `${path}.end`, issues);

  if (start === undefined || end === undefined) {
    return undefined;
  }

  const pointOrder = comparePoints(start, end);
  if (pointOrder > 0) {
    addIssue(
      issues,
      'invalid-source-span',
      path,
      'Source span start must not occur after its end.',
    );
  }

  const startHasOffset = start.offset !== undefined;
  const endHasOffset = end.offset !== undefined;
  if (startHasOffset !== endHasOffset) {
    addIssue(
      issues,
      'invalid-source-span',
      path,
      'Source span offsets must be present on both points or omitted on both.',
    );
  } else if (start.offset !== undefined && end.offset !== undefined) {
    const offsetOrder = start.offset - end.offset;
    if (offsetOrder > 0) {
      addIssue(
        issues,
        'invalid-source-span',
        path,
        'Source span start offset must not exceed its end offset.',
      );
    }

    if ((pointOrder === 0) !== (offsetOrder === 0)) {
      addIssue(
        issues,
        'invalid-source-span',
        path,
        'Source point ordering and offset ordering are inconsistent.',
      );
    }
  }

  return { start, end };
}

function isNormalizedWorkspacePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    /^[A-Za-z]:\//u.test(path)
  ) {
    return false;
  }

  return path
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    );
}

function parseSourceLocation(
  value: unknown,
  path: string,
  issues: SnapshotValidationIssue[],
): SourceLocation | undefined {
  if (!isPlainRecord(value)) {
    addIssue(
      issues,
      'invalid-type',
      path,
      'Expected a source-location object.',
    );
    return undefined;
  }

  checkFields(value, ['path', 'span'], [], path, issues);
  const sourcePath = readString(value, 'path', `${path}.path`, issues);
  const span = parseSourceSpan(value.span, `${path}.span`, issues);

  if (sourcePath !== undefined && !isNormalizedWorkspacePath(sourcePath)) {
    addIssue(
      issues,
      'invalid-workspace-path',
      `${path}.path`,
      'Expected a normalized workspace-relative path using forward slashes.',
    );
  }

  if (sourcePath === undefined || span === undefined) {
    return undefined;
  }

  return { path: sourcePath, span };
}

function parseEntity(
  value: unknown,
  index: number,
  issues: SnapshotValidationIssue[],
): AddressableEntity | undefined {
  const path = `$.entities[${index}]`;
  const issueCount = issues.length;
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected an entity object.');
    return undefined;
  }

  const kind = readString(value, 'kind', `${path}.kind`, issues);
  if (kind !== 'document' && kind !== 'section' && kind !== 'block') {
    addIssue(
      issues,
      'invalid-entity-kind',
      `${path}.kind`,
      'Expected entity kind "document", "section", or "block".',
    );
    return undefined;
  }

  if (kind === 'document') {
    checkFields(value, ['id', 'kind', 'source'], [], path, issues);
  } else if (kind === 'section') {
    checkFields(
      value,
      ['id', 'kind', 'parentId', 'title', 'level', 'source'],
      [],
      path,
      issues,
    );
  } else {
    checkFields(value, ['id', 'kind', 'parentId', 'source'], [], path, issues);
  }

  const id = readNonEmptyString(value, 'id', `${path}.id`, issues);
  const source = parseSourceLocation(value.source, `${path}.source`, issues);

  if (kind === 'document') {
    if (
      issues.length !== issueCount ||
      id === undefined ||
      source === undefined
    ) {
      return undefined;
    }

    const document: DocumentEntity = { id, kind, source };
    return document;
  }

  const parentId = readNonEmptyString(
    value,
    'parentId',
    `${path}.parentId`,
    issues,
  );

  if (kind === 'block') {
    if (
      issues.length !== issueCount ||
      id === undefined ||
      parentId === undefined ||
      source === undefined
    ) {
      return undefined;
    }

    const block: BlockEntity = { id, kind, parentId, source };
    return block;
  }

  const title = readString(value, 'title', `${path}.title`, issues);
  const level = readInteger(
    value,
    'level',
    `${path}.level`,
    1,
    issues,
    'invalid-heading-level',
  );
  if (level !== undefined && level > 6) {
    addIssue(
      issues,
      'invalid-heading-level',
      `${path}.level`,
      'Markdown heading level must be between 1 and 6.',
    );
  }

  if (
    issues.length !== issueCount ||
    id === undefined ||
    parentId === undefined ||
    title === undefined ||
    level === undefined ||
    source === undefined
  ) {
    return undefined;
  }

  const section: SectionEntity = {
    id,
    kind,
    parentId,
    title,
    level,
    source,
  };
  return section;
}

function readOptionalReason(
  record: PlainRecord,
  path: string,
  issues: SnapshotValidationIssue[],
): string | undefined {
  if (!hasOwn(record, 'reason')) {
    return undefined;
  }

  return readNonEmptyString(record, 'reason', path, issues, 'invalid-type');
}

function parseResolution(
  value: unknown,
  path: string,
  issues: SnapshotValidationIssue[],
): ReferenceResolution | undefined {
  const issueCount = issues.length;
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a resolution object.');
    return undefined;
  }

  const status = readString(value, 'status', `${path}.status`, issues);
  if (status === 'resolved') {
    checkFields(value, ['status', 'targetEntityId'], [], path, issues);
    const targetEntityId = readNonEmptyString(
      value,
      'targetEntityId',
      `${path}.targetEntityId`,
      issues,
    );
    return issues.length === issueCount && targetEntityId !== undefined
      ? { status, targetEntityId }
      : undefined;
  }

  if (status === 'unresolved') {
    checkFields(value, ['status'], ['reason'], path, issues);
    const reason = readOptionalReason(value, `${path}.reason`, issues);
    if (issues.length !== issueCount) {
      return undefined;
    }

    return reason === undefined ? { status } : { status, reason };
  }

  if (status === 'invalid') {
    checkFields(value, ['status', 'reason'], [], path, issues);
    const reason = readNonEmptyString(
      value,
      'reason',
      `${path}.reason`,
      issues,
      'invalid-type',
    );
    return issues.length === issueCount && reason !== undefined
      ? { status, reason }
      : undefined;
  }

  if (status === 'ambiguous') {
    checkFields(
      value,
      ['status', 'candidateEntityIds'],
      ['reason'],
      path,
      issues,
    );
    const candidatesValue = value.candidateEntityIds;
    const candidateEntityIds: EntityId[] = [];
    if (!Array.isArray(candidatesValue)) {
      addIssue(
        issues,
        'invalid-type',
        `${path}.candidateEntityIds`,
        'Expected an array of entity IDs.',
      );
    } else {
      for (const [index, candidate] of candidatesValue.entries()) {
        if (typeof candidate !== 'string' || candidate.trim().length === 0) {
          addIssue(
            issues,
            'invalid-id',
            `${path}.candidateEntityIds[${index}]`,
            'Expected a non-empty entity ID.',
          );
        } else {
          candidateEntityIds.push(candidate);
        }
      }

      if (candidateEntityIds.length < 2) {
        addIssue(
          issues,
          'invalid-ambiguous-candidates',
          `${path}.candidateEntityIds`,
          'Ambiguous resolution requires at least two distinct candidates.',
        );
      }

      const seen = new Set<EntityId>();
      for (const [index, candidate] of candidateEntityIds.entries()) {
        if (seen.has(candidate)) {
          addIssue(
            issues,
            'duplicate-ambiguous-candidate',
            `${path}.candidateEntityIds[${index}]`,
            `Ambiguous candidate "${candidate}" is duplicated.`,
          );
        }
        seen.add(candidate);
      }
    }

    const reason = readOptionalReason(value, `${path}.reason`, issues);
    if (issues.length !== issueCount) {
      return undefined;
    }

    return reason === undefined
      ? { status, candidateEntityIds }
      : { status, candidateEntityIds, reason };
  }

  addIssue(
    issues,
    'invalid-resolution-status',
    `${path}.status`,
    'Expected resolution status "resolved", "unresolved", "ambiguous", or "invalid".',
  );
  return undefined;
}

function parseReference(
  value: unknown,
  index: number,
  issues: SnapshotValidationIssue[],
): Reference | undefined {
  const path = `$.references[${index}]`;
  const issueCount = issues.length;
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a reference object.');
    return undefined;
  }

  checkFields(
    value,
    ['id', 'kind', 'sourceEntityId', 'rawTarget', 'sourceSpan', 'resolution'],
    [],
    path,
    issues,
  );
  const id = readNonEmptyString(value, 'id', `${path}.id`, issues);
  const kindValue = readString(value, 'kind', `${path}.kind`, issues);
  let kind: ReferenceKind | undefined;
  if (kindValue === 'link' || kindValue === 'embed') {
    kind = kindValue;
  } else {
    addIssue(
      issues,
      'invalid-reference-kind',
      `${path}.kind`,
      'Expected reference kind "link" or "embed".',
    );
  }
  const sourceEntityId = readNonEmptyString(
    value,
    'sourceEntityId',
    `${path}.sourceEntityId`,
    issues,
  );
  const rawTarget = readString(value, 'rawTarget', `${path}.rawTarget`, issues);
  const sourceSpan = parseSourceSpan(
    value.sourceSpan,
    `${path}.sourceSpan`,
    issues,
  );
  const resolution = parseResolution(
    value.resolution,
    `${path}.resolution`,
    issues,
  );

  if (
    issues.length !== issueCount ||
    id === undefined ||
    kind === undefined ||
    sourceEntityId === undefined ||
    rawTarget === undefined ||
    sourceSpan === undefined ||
    resolution === undefined
  ) {
    return undefined;
  }

  return {
    id,
    kind,
    sourceEntityId,
    rawTarget,
    sourceSpan,
    resolution,
  };
}

function parseWorkspace(
  value: unknown,
  issues: SnapshotValidationIssue[],
): WorkspaceDescriptor | undefined {
  const path = '$.workspace';
  const issueCount = issues.length;
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', path, 'Expected a workspace object.');
    return undefined;
  }

  checkFields(value, ['id'], [], path, issues);
  const id = readNonEmptyString(value, 'id', `${path}.id`, issues);
  return issues.length === issueCount && id !== undefined ? { id } : undefined;
}

function validateEntitySemantics(
  entities: readonly AddressableEntity[],
  issues: SnapshotValidationIssue[],
): Map<EntityId, AddressableEntity> {
  const entityById = new Map<EntityId, AddressableEntity>();
  const entityIndexById = new Map<EntityId, number>();
  const documentPathIndex = new Map<string, number>();

  for (const [index, entity] of entities.entries()) {
    if (entityById.has(entity.id)) {
      addIssue(
        issues,
        'duplicate-entity-id',
        `$.entities[${index}].id`,
        `Entity ID "${entity.id}" is duplicated.`,
      );
    } else {
      entityById.set(entity.id, entity);
      entityIndexById.set(entity.id, index);
    }

    if (entity.kind === 'document') {
      const previousIndex = documentPathIndex.get(entity.source.path);
      if (previousIndex !== undefined) {
        addIssue(
          issues,
          'duplicate-document-path',
          `$.entities[${index}].source.path`,
          `Document path "${entity.source.path}" is already used by entity at $.entities[${previousIndex}].`,
        );
      } else {
        documentPathIndex.set(entity.source.path, index);
      }
    }
  }

  for (const [index, entity] of entities.entries()) {
    if (entity.kind === 'document') {
      continue;
    }

    if (entity.parentId === entity.id) {
      addIssue(
        issues,
        'self-parent',
        `$.entities[${index}].parentId`,
        'An entity cannot be its own structural parent.',
      );
      continue;
    }

    const parent = entityById.get(entity.parentId);
    if (parent === undefined) {
      addIssue(
        issues,
        'missing-parent',
        `$.entities[${index}].parentId`,
        `Parent entity "${entity.parentId}" does not exist.`,
      );
      continue;
    }

    if (parent.kind === 'block') {
      addIssue(
        issues,
        'invalid-parent-kind',
        `$.entities[${index}].parentId`,
        'Sections and blocks may be parented only by a document or section.',
      );
    }

    if (entity.source.path !== parent.source.path) {
      addIssue(
        issues,
        'source-path-mismatch',
        `$.entities[${index}].source.path`,
        'A descendant must use the same source path as its structural parent.',
      );
    }

    if (
      entity.kind === 'section' &&
      parent.kind === 'section' &&
      entity.level <= parent.level
    ) {
      addIssue(
        issues,
        'invalid-heading-parent-level',
        `$.entities[${index}].level`,
        'A nested section heading level must be greater than its parent level; skipped levels are allowed.',
      );
    }
  }

  const states = new Map<EntityId, 'visiting' | 'visited'>();
  const stack: EntityId[] = [];
  const reportedCycles = new Set<EntityId>();

  const visit = (entity: AddressableEntity): void => {
    if (states.get(entity.id) === 'visited') {
      return;
    }

    states.set(entity.id, 'visiting');
    stack.push(entity.id);

    if (entity.kind !== 'document' && entity.parentId !== entity.id) {
      const parent = entityById.get(entity.parentId);
      if (parent !== undefined) {
        if (states.get(parent.id) === 'visiting') {
          const cycleStart = stack.indexOf(parent.id);
          const cycleIds = stack.slice(cycleStart);
          for (const cycleId of cycleIds) {
            if (!reportedCycles.has(cycleId)) {
              const cycleIndex = entityIndexById.get(cycleId);
              addIssue(
                issues,
                'hierarchy-cycle',
                cycleIndex === undefined
                  ? '$.entities'
                  : `$.entities[${cycleIndex}].parentId`,
                `Entity "${cycleId}" participates in a hierarchy cycle.`,
              );
              reportedCycles.add(cycleId);
            }
          }
        } else {
          visit(parent);
        }
      }
    }

    stack.pop();
    states.set(entity.id, 'visited');
  };

  for (const entity of entities) {
    visit(entity);
  }

  return entityById;
}

function validateReferenceSemantics(
  references: readonly Reference[],
  entityById: ReadonlyMap<EntityId, AddressableEntity>,
  issues: SnapshotValidationIssue[],
): void {
  const referenceIds = new Set<string>();

  for (const [index, reference] of references.entries()) {
    if (referenceIds.has(reference.id)) {
      addIssue(
        issues,
        'duplicate-reference-id',
        `$.references[${index}].id`,
        `Reference ID "${reference.id}" is duplicated.`,
      );
    }
    referenceIds.add(reference.id);

    if (!entityById.has(reference.sourceEntityId)) {
      addIssue(
        issues,
        'missing-reference-source',
        `$.references[${index}].sourceEntityId`,
        `Source entity "${reference.sourceEntityId}" does not exist.`,
      );
    }

    if (
      reference.resolution.status === 'resolved' &&
      !entityById.has(reference.resolution.targetEntityId)
    ) {
      addIssue(
        issues,
        'missing-resolution-target',
        `$.references[${index}].resolution.targetEntityId`,
        `Resolved target "${reference.resolution.targetEntityId}" does not exist.`,
      );
    }

    if (reference.resolution.status === 'ambiguous') {
      for (const [
        candidateIndex,
        candidateId,
      ] of reference.resolution.candidateEntityIds.entries()) {
        if (!entityById.has(candidateId)) {
          addIssue(
            issues,
            'missing-resolution-target',
            `$.references[${index}].resolution.candidateEntityIds[${candidateIndex}]`,
            `Ambiguous candidate "${candidateId}" does not exist.`,
          );
        }
      }
    }
  }
}

/** Validate untrusted/deserialized data and return a typed canonical snapshot. */
export function validateKnowledgeSnapshot(
  value: unknown,
): SnapshotValidationResult {
  const issues: SnapshotValidationIssue[] = [];
  if (!isPlainRecord(value)) {
    addIssue(issues, 'invalid-type', '$', 'Expected a snapshot object.');
    return { valid: false, issues };
  }

  checkFields(
    value,
    ['schemaVersion', 'workspace', 'entities', 'references'],
    [],
    '$',
    issues,
  );

  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION) {
    addIssue(
      issues,
      'unsupported-schema-version',
      '$.schemaVersion',
      `Expected schema version ${KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION}.`,
    );
  }

  const workspace = parseWorkspace(value.workspace, issues);

  const entities: AddressableEntity[] = [];
  if (!Array.isArray(value.entities)) {
    addIssue(issues, 'invalid-type', '$.entities', 'Expected an entity array.');
  } else {
    for (const [index, entity] of value.entities.entries()) {
      const parsed = parseEntity(entity, index, issues);
      if (parsed !== undefined) {
        entities.push(parsed);
      }
    }
  }

  const references: Reference[] = [];
  if (!Array.isArray(value.references)) {
    addIssue(
      issues,
      'invalid-type',
      '$.references',
      'Expected a reference array.',
    );
  } else {
    for (const [index, reference] of value.references.entries()) {
      const parsed = parseReference(reference, index, issues);
      if (parsed !== undefined) {
        references.push(parsed);
      }
    }
  }

  const entityById = validateEntitySemantics(entities, issues);
  validateReferenceSemantics(references, entityById, issues);

  if (
    issues.length > 0 ||
    workspace === undefined ||
    schemaVersion !== KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION
  ) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    value: {
      schemaVersion,
      workspace,
      entities,
      references,
    },
    issues: [],
  };
}
