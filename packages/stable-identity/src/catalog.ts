import type {
  EntityId,
  ReferenceResolution,
} from '@icarus-graph-explorer/core';

import {
  STABLE_IDENTITY_CATALOG_SCHEMA_VERSION,
  type StableBlockObservation,
  type StableDocumentObservation,
  type StableEntityObservation,
  type StableIdentityCatalog,
  type StableIdentityCatalogValidationIssue,
  type StableIdentityCatalogValidationResult,
  type StableReferenceObservation,
  type StableSectionObservation,
} from './types';

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(record: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function issue(
  issues: StableIdentityCatalogValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function fields(
  value: PlainRecord,
  required: readonly string[],
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): void {
  const expected = new Set(required);
  for (const field of required) {
    if (!hasOwn(value, field))
      issue(issues, `${path}.${field}`, 'Required field is missing.');
  }
  for (const field of Object.keys(value)) {
    if (!expected.has(field))
      issue(issues, `${path}.${field}`, 'Unexpected field.');
  }
}

function stringValue(
  value: unknown,
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issue(issues, path, 'Expected a non-empty string.');
    return undefined;
  }
  return value;
}

function integerValue(
  value: unknown,
  minimum: number,
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): number | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    issue(
      issues,
      path,
      `Expected an integer greater than or equal to ${minimum}.`,
    );
    return undefined;
  }
  return value;
}

function nullableOffset(
  value: unknown,
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): number | null | undefined {
  if (value === null) return null;
  return integerValue(value, 0, path, issues);
}

function isWorkspacePath(value: string): boolean {
  return (
    !value.startsWith('/') &&
    !value.includes('\\') &&
    !/^[A-Za-z]:\//u.test(value) &&
    value
      .split('/')
      .every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
  );
}

function sourcePath(
  value: unknown,
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): string | undefined {
  const result = stringValue(value, path, issues);
  if (result !== undefined && !isWorkspacePath(result)) {
    issue(issues, path, 'Expected a normalized workspace-relative path.');
    return undefined;
  }
  return result;
}

function parseResolution(
  value: unknown,
  path: string,
  issues: StableIdentityCatalogValidationIssue[],
): ReferenceResolution | undefined {
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a reference-resolution object.');
    return undefined;
  }
  const status = value.status;
  if (status === 'resolved') {
    fields(value, ['status', 'targetEntityId'], path, issues);
    const targetEntityId = stringValue(
      value.targetEntityId,
      `${path}.targetEntityId`,
      issues,
    );
    return targetEntityId === undefined
      ? undefined
      : { status, targetEntityId };
  }
  if (status === 'unresolved') {
    const expected = hasOwn(value, 'reason')
      ? ['status', 'reason']
      : ['status'];
    fields(value, expected, path, issues);
    if (!hasOwn(value, 'reason')) return { status };
    const reason = stringValue(value.reason, `${path}.reason`, issues);
    return reason === undefined ? undefined : { status, reason };
  }
  if (status === 'invalid') {
    fields(value, ['status', 'reason'], path, issues);
    const reason = stringValue(value.reason, `${path}.reason`, issues);
    return reason === undefined ? undefined : { status, reason };
  }
  if (status === 'ambiguous') {
    const expected = hasOwn(value, 'reason')
      ? ['status', 'candidateEntityIds', 'reason']
      : ['status', 'candidateEntityIds'];
    fields(value, expected, path, issues);
    const candidates: EntityId[] = [];
    if (!Array.isArray(value.candidateEntityIds)) {
      issue(
        issues,
        `${path}.candidateEntityIds`,
        'Expected an entity-ID array.',
      );
    } else {
      for (const [index, candidate] of value.candidateEntityIds.entries()) {
        const parsed = stringValue(
          candidate,
          `${path}.candidateEntityIds[${index}]`,
          issues,
        );
        if (parsed !== undefined) candidates.push(parsed);
      }
      if (
        candidates.length < 2 ||
        new Set(candidates).size !== candidates.length
      ) {
        issue(
          issues,
          `${path}.candidateEntityIds`,
          'Expected at least two distinct candidates.',
        );
      }
    }
    const reason = hasOwn(value, 'reason')
      ? stringValue(value.reason, `${path}.reason`, issues)
      : undefined;
    if (
      candidates.length < 2 ||
      (hasOwn(value, 'reason') && reason === undefined)
    )
      return undefined;
    return reason === undefined
      ? { status, candidateEntityIds: candidates }
      : { status, candidateEntityIds: candidates, reason };
  }
  issue(issues, `${path}.status`, 'Unsupported reference-resolution status.');
  return undefined;
}

function parseEntity(
  value: unknown,
  index: number,
  issues: StableIdentityCatalogValidationIssue[],
): StableEntityObservation | undefined {
  const path = `$.entities[${index}]`;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected an entity-observation object.');
    return undefined;
  }
  const kind = value.kind;
  const common = ['id', 'kind', 'sourcePath', 'sourceStartOffset'];
  if (kind === 'document') {
    fields(
      value,
      [...common, 'structuralFingerprint', 'structuralSignalCount'],
      path,
      issues,
    );
  } else if (kind === 'section') {
    fields(
      value,
      [
        ...common,
        'parentId',
        'documentId',
        'title',
        'level',
        'siblingOrdinal',
        'sameTitleOrdinal',
        'strongFingerprint',
        'strongSignalCount',
      ],
      path,
      issues,
    );
  } else if (kind === 'block') {
    fields(
      value,
      [...common, 'parentId', 'documentId', 'siblingOrdinal'],
      path,
      issues,
    );
  } else {
    issue(
      issues,
      `${path}.kind`,
      'Expected entity kind document, section, or block.',
    );
    return undefined;
  }
  const id = stringValue(value.id, `${path}.id`, issues);
  const parsedSourcePath = sourcePath(
    value.sourcePath,
    `${path}.sourcePath`,
    issues,
  );
  const sourceStartOffset = nullableOffset(
    value.sourceStartOffset,
    `${path}.sourceStartOffset`,
    issues,
  );
  if (
    id === undefined ||
    parsedSourcePath === undefined ||
    sourceStartOffset === undefined
  )
    return undefined;

  if (kind === 'document') {
    const structuralFingerprint = stringValue(
      value.structuralFingerprint,
      `${path}.structuralFingerprint`,
      issues,
    );
    const structuralSignalCount = integerValue(
      value.structuralSignalCount,
      0,
      `${path}.structuralSignalCount`,
      issues,
    );
    if (
      structuralFingerprint === undefined ||
      structuralSignalCount === undefined
    )
      return undefined;
    return {
      id,
      kind,
      sourcePath: parsedSourcePath,
      sourceStartOffset,
      structuralFingerprint,
      structuralSignalCount,
    } satisfies StableDocumentObservation;
  }
  const parentId = stringValue(value.parentId, `${path}.parentId`, issues);
  const documentId = stringValue(
    value.documentId,
    `${path}.documentId`,
    issues,
  );
  const siblingOrdinal = integerValue(
    value.siblingOrdinal,
    0,
    `${path}.siblingOrdinal`,
    issues,
  );
  if (
    parentId === undefined ||
    documentId === undefined ||
    siblingOrdinal === undefined
  )
    return undefined;
  if (kind === 'block') {
    return {
      id,
      kind,
      parentId,
      documentId,
      sourcePath: parsedSourcePath,
      sourceStartOffset,
      siblingOrdinal,
    } satisfies StableBlockObservation;
  }
  const title = typeof value.title === 'string' ? value.title : undefined;
  if (title === undefined) issue(issues, `${path}.title`, 'Expected a string.');
  const level = integerValue(value.level, 1, `${path}.level`, issues);
  if (level !== undefined && level > 6)
    issue(
      issues,
      `${path}.level`,
      'Expected a heading level from 1 through 6.',
    );
  const sameTitleOrdinal = integerValue(
    value.sameTitleOrdinal,
    0,
    `${path}.sameTitleOrdinal`,
    issues,
  );
  const strongFingerprint = stringValue(
    value.strongFingerprint,
    `${path}.strongFingerprint`,
    issues,
  );
  const strongSignalCount = integerValue(
    value.strongSignalCount,
    0,
    `${path}.strongSignalCount`,
    issues,
  );
  if (
    title === undefined ||
    level === undefined ||
    level > 6 ||
    sameTitleOrdinal === undefined ||
    strongFingerprint === undefined ||
    strongSignalCount === undefined
  )
    return undefined;
  return {
    id,
    kind,
    parentId,
    documentId,
    title,
    level,
    sourcePath: parsedSourcePath,
    sourceStartOffset,
    siblingOrdinal,
    sameTitleOrdinal,
    strongFingerprint,
    strongSignalCount,
  } satisfies StableSectionObservation;
}

function parseReference(
  value: unknown,
  index: number,
  issues: StableIdentityCatalogValidationIssue[],
): StableReferenceObservation | undefined {
  const path = `$.references[${index}]`;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a reference-observation object.');
    return undefined;
  }
  fields(
    value,
    [
      'id',
      'sourceEntityId',
      'kind',
      'rawTarget',
      'sourceStartOffset',
      'resolution',
    ],
    path,
    issues,
  );
  const id = stringValue(value.id, `${path}.id`, issues);
  const sourceEntityId = stringValue(
    value.sourceEntityId,
    `${path}.sourceEntityId`,
    issues,
  );
  const kind =
    value.kind === 'link' || value.kind === 'embed' ? value.kind : undefined;
  if (kind === undefined)
    issue(issues, `${path}.kind`, 'Expected reference kind link or embed.');
  const rawTarget =
    typeof value.rawTarget === 'string' ? value.rawTarget : undefined;
  if (rawTarget === undefined)
    issue(issues, `${path}.rawTarget`, 'Expected a string.');
  const sourceStartOffset = nullableOffset(
    value.sourceStartOffset,
    `${path}.sourceStartOffset`,
    issues,
  );
  const resolution = parseResolution(
    value.resolution,
    `${path}.resolution`,
    issues,
  );
  if (
    id === undefined ||
    sourceEntityId === undefined ||
    kind === undefined ||
    rawTarget === undefined ||
    sourceStartOffset === undefined ||
    resolution === undefined
  )
    return undefined;
  return { id, sourceEntityId, kind, rawTarget, sourceStartOffset, resolution };
}

function validateRelationships(
  catalog: StableIdentityCatalog,
  issues: StableIdentityCatalogValidationIssue[],
): void {
  const entities = new Map<EntityId, StableEntityObservation>();
  const documentPaths = new Set<string>();
  for (const [index, entity] of catalog.entities.entries()) {
    if (entities.has(entity.id)) {
      issue(
        issues,
        `$.entities[${index}].id`,
        'Stable entity ID is duplicated.',
      );
    }
    entities.set(entity.id, entity);
    if (entity.kind === 'document') {
      if (documentPaths.has(entity.sourcePath)) {
        issue(
          issues,
          `$.entities[${index}].sourcePath`,
          'Document source path is duplicated.',
        );
      }
      documentPaths.add(entity.sourcePath);
    }
  }
  const references = new Set<string>();
  for (const [index, reference] of catalog.references.entries()) {
    if (references.has(reference.id))
      issue(
        issues,
        `$.references[${index}].id`,
        'Stable reference ID is duplicated.',
      );
    references.add(reference.id);
    if (!entities.has(reference.sourceEntityId))
      issue(
        issues,
        `$.references[${index}].sourceEntityId`,
        'Reference source is missing from catalog entities.',
      );
    const targets =
      reference.resolution.status === 'resolved'
        ? [reference.resolution.targetEntityId]
        : reference.resolution.status === 'ambiguous'
          ? reference.resolution.candidateEntityIds
          : [];
    for (const target of targets) {
      if (!entities.has(target))
        issue(
          issues,
          `$.references[${index}].resolution`,
          'Reference resolution target is missing from catalog entities.',
        );
    }
  }
  for (const [index, entity] of catalog.entities.entries()) {
    if (entity.kind === 'document') continue;
    const parent = entities.get(entity.parentId);
    const document = entities.get(entity.documentId);
    if (parent === undefined || parent.kind === 'block') {
      issue(
        issues,
        `$.entities[${index}].parentId`,
        'Entity parent is missing or invalid.',
      );
    }
    if (document?.kind !== 'document') {
      issue(
        issues,
        `$.entities[${index}].documentId`,
        'Entity document is missing or invalid.',
      );
    }
    if (document !== undefined && document.sourcePath !== entity.sourcePath) {
      issue(
        issues,
        `$.entities[${index}].sourcePath`,
        'Entity path must match its document path.',
      );
    }
    if (
      entity.kind === 'section' &&
      parent?.kind === 'section' &&
      parent.level >= entity.level
    ) {
      issue(
        issues,
        `$.entities[${index}].level`,
        'Section level must be deeper than its section parent.',
      );
    }
    const visited = new Set<EntityId>([entity.id]);
    let ancestor = parent;
    while (ancestor !== undefined && ancestor.kind !== 'document') {
      if (visited.has(ancestor.id)) {
        issue(
          issues,
          `$.entities[${index}].parentId`,
          'Entity hierarchy contains a cycle.',
        );
        ancestor = undefined;
        break;
      }
      visited.add(ancestor.id);
      ancestor = entities.get(ancestor.parentId);
    }
    if (ancestor !== undefined && ancestor.id !== entity.documentId) {
      issue(
        issues,
        `$.entities[${index}].documentId`,
        'Entity document does not match its parent ancestry.',
      );
    }
  }
}

/** Strictly validate deserialized private catalog state; invalid state never resets silently. */
export function validateStableIdentityCatalog(
  value: unknown,
): StableIdentityCatalogValidationResult {
  const issues: StableIdentityCatalogValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        { path: '$', message: 'Expected a stable-identity catalog object.' },
      ],
    };
  }
  fields(
    value,
    [
      'schemaVersion',
      'workspaceId',
      'nextEntitySequence',
      'nextReferenceSequence',
      'entities',
      'references',
    ],
    '$',
    issues,
  );
  if (value.schemaVersion !== STABLE_IDENTITY_CATALOG_SCHEMA_VERSION)
    issue(
      issues,
      '$.schemaVersion',
      `Expected schema version ${STABLE_IDENTITY_CATALOG_SCHEMA_VERSION}.`,
    );
  const workspaceId = stringValue(value.workspaceId, '$.workspaceId', issues);
  const nextEntitySequence = integerValue(
    value.nextEntitySequence,
    1,
    '$.nextEntitySequence',
    issues,
  );
  const nextReferenceSequence = integerValue(
    value.nextReferenceSequence,
    1,
    '$.nextReferenceSequence',
    issues,
  );
  const entities: StableEntityObservation[] = [];
  if (!Array.isArray(value.entities))
    issue(issues, '$.entities', 'Expected an entity-observation array.');
  else
    for (const [index, entity] of value.entities.entries()) {
      const parsed = parseEntity(entity, index, issues);
      if (parsed !== undefined) entities.push(parsed);
    }
  const references: StableReferenceObservation[] = [];
  if (!Array.isArray(value.references))
    issue(issues, '$.references', 'Expected a reference-observation array.');
  else
    for (const [index, reference] of value.references.entries()) {
      const parsed = parseReference(reference, index, issues);
      if (parsed !== undefined) references.push(parsed);
    }
  if (
    workspaceId === undefined ||
    nextEntitySequence === undefined ||
    nextReferenceSequence === undefined ||
    value.schemaVersion !== STABLE_IDENTITY_CATALOG_SCHEMA_VERSION
  )
    return { valid: false, issues };
  const catalog: StableIdentityCatalog = {
    schemaVersion: STABLE_IDENTITY_CATALOG_SCHEMA_VERSION,
    workspaceId,
    nextEntitySequence,
    nextReferenceSequence,
    entities,
    references,
  };
  validateRelationships(catalog, issues);
  return issues.length === 0
    ? { valid: true, value: catalog, issues: [] }
    : { valid: false, issues };
}

export function createStableIdentityCatalog(
  workspaceId: string,
): StableIdentityCatalog {
  if (workspaceId.trim().length === 0)
    throw new Error('Stable workspace ID must be non-empty.');
  return {
    schemaVersion: STABLE_IDENTITY_CATALOG_SCHEMA_VERSION,
    workspaceId,
    nextEntitySequence: 1,
    nextReferenceSequence: 1,
    entities: [],
    references: [],
  };
}
