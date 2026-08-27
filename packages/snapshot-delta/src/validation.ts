import type {
  AddressableEntity,
  EntityId,
  Reference,
  ReferenceResolution,
  SourceLocation,
  SourcePoint,
  SourceSpan,
} from '@icarus-graph-explorer/core';

import {
  KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION,
  type AddedRecord,
  type KnowledgeSnapshotDelta,
  type RemovedRecord,
  type SnapshotCollectionDelta,
  type SnapshotDeltaValidationIssue,
  type SnapshotDeltaValidationResult,
  type UpdatedRecord,
} from './types';

type PlainRecord = Record<string, unknown>;
type Identified = { readonly id: string };
type RecordParser<T extends Identified> = (
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
) => T | undefined;

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: SnapshotDeltaValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function fields(
  value: PlainRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issue(issues, `${path}.${key}`, 'Required field is missing.');
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) issue(issues, `${path}.${key}`, 'Unexpected field.');
  }
}

function stringValue(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): string | undefined {
  if (typeof value !== 'string') {
    issue(issues, path, 'Expected a string.');
    return undefined;
  }
  return value;
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): string | undefined {
  const parsed = stringValue(value, path, issues);
  if (parsed !== undefined && parsed.trim().length === 0) {
    issue(issues, path, 'Expected a non-empty string.');
    return undefined;
  }
  return parsed;
}

function integer(
  value: unknown,
  minimum: number,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
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

function sourcePoint(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): SourcePoint | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a source-point object.');
    return undefined;
  }
  fields(value, ['line', 'column'], ['offset'], path, issues);
  const line = integer(value.line, 1, `${path}.line`, issues);
  const column = integer(value.column, 1, `${path}.column`, issues);
  const offset = Object.hasOwn(value, 'offset')
    ? integer(value.offset, 0, `${path}.offset`, issues)
    : undefined;
  if (issues.length !== start || line === undefined || column === undefined) {
    return undefined;
  }
  return offset === undefined ? { line, column } : { line, column, offset };
}

function comparePoints(left: SourcePoint, right: SourcePoint): number {
  return left.line !== right.line
    ? left.line - right.line
    : left.column - right.column;
}

function sourceSpan(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): SourceSpan | undefined {
  const startIssueCount = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a source-span object.');
    return undefined;
  }
  fields(value, ['start', 'end'], [], path, issues);
  const start = sourcePoint(value.start, `${path}.start`, issues);
  const end = sourcePoint(value.end, `${path}.end`, issues);
  if (start === undefined || end === undefined) return undefined;
  const pointOrder = comparePoints(start, end);
  if (pointOrder > 0) {
    issue(issues, path, 'Source span start must not occur after its end.');
  }
  const startOffset = start.offset;
  const endOffset = end.offset;
  if ((startOffset === undefined) !== (endOffset === undefined)) {
    issue(
      issues,
      path,
      'Source offsets must appear on both endpoints or neither.',
    );
  } else if (startOffset !== undefined && endOffset !== undefined) {
    const offsetOrder = startOffset - endOffset;
    if (offsetOrder > 0) {
      issue(
        issues,
        path,
        'Source start offset must not exceed its end offset.',
      );
    }
    if ((pointOrder === 0) !== (offsetOrder === 0)) {
      issue(issues, path, 'Source point and offset ordering are inconsistent.');
    }
  }
  return issues.length === startIssueCount ? { start, end } : undefined;
}

function normalizedWorkspacePath(value: string): boolean {
  return (
    value.length > 0 &&
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

function sourceLocation(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): SourceLocation | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a source-location object.');
    return undefined;
  }
  fields(value, ['path', 'span'], [], path, issues);
  const sourcePath = stringValue(value.path, `${path}.path`, issues);
  const span = sourceSpan(value.span, `${path}.span`, issues);
  if (sourcePath !== undefined && !normalizedWorkspacePath(sourcePath)) {
    issue(
      issues,
      `${path}.path`,
      'Expected a normalized workspace-relative path.',
    );
  }
  return issues.length === start &&
    sourcePath !== undefined &&
    span !== undefined
    ? { path: sourcePath, span }
    : undefined;
}

function entity(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): AddressableEntity | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected an entity object.');
    return undefined;
  }
  const kind = value.kind;
  if (kind === 'document') {
    fields(value, ['id', 'kind', 'source'], [], path, issues);
  } else if (kind === 'section') {
    fields(
      value,
      ['id', 'kind', 'parentId', 'title', 'level', 'source'],
      [],
      path,
      issues,
    );
  } else if (kind === 'block') {
    fields(value, ['id', 'kind', 'parentId', 'source'], [], path, issues);
  } else {
    issue(issues, `${path}.kind`, 'Expected document, section, or block.');
    return undefined;
  }
  const id = nonEmptyString(value.id, `${path}.id`, issues);
  const source = sourceLocation(value.source, `${path}.source`, issues);
  if (kind === 'document') {
    return issues.length === start && id !== undefined && source !== undefined
      ? { id, kind, source }
      : undefined;
  }
  const parentId = nonEmptyString(value.parentId, `${path}.parentId`, issues);
  if (kind === 'block') {
    return issues.length === start &&
      id !== undefined &&
      parentId !== undefined &&
      source !== undefined
      ? { id, kind, parentId, source }
      : undefined;
  }
  const title = stringValue(value.title, `${path}.title`, issues);
  const level = integer(value.level, 1, `${path}.level`, issues);
  if (level !== undefined && level > 6) {
    issue(
      issues,
      `${path}.level`,
      'Expected a heading level from 1 through 6.',
    );
  }
  return issues.length === start &&
    id !== undefined &&
    parentId !== undefined &&
    title !== undefined &&
    level !== undefined &&
    source !== undefined
    ? { id, kind, parentId, title, level, source }
    : undefined;
}

function optionalReason(
  value: PlainRecord,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): string | undefined {
  return Object.hasOwn(value, 'reason')
    ? nonEmptyString(value.reason, path, issues)
    : undefined;
}

function resolution(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): ReferenceResolution | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a reference-resolution object.');
    return undefined;
  }
  if (value.status === 'resolved') {
    fields(value, ['status', 'targetEntityId'], [], path, issues);
    const targetEntityId = nonEmptyString(
      value.targetEntityId,
      `${path}.targetEntityId`,
      issues,
    );
    return issues.length === start && targetEntityId !== undefined
      ? { status: 'resolved', targetEntityId }
      : undefined;
  }
  if (value.status === 'unresolved') {
    fields(value, ['status'], ['reason'], path, issues);
    const reason = optionalReason(value, `${path}.reason`, issues);
    if (issues.length !== start) return undefined;
    return reason === undefined
      ? { status: 'unresolved' }
      : { status: 'unresolved', reason };
  }
  if (value.status === 'invalid') {
    fields(value, ['status', 'reason'], [], path, issues);
    const reason = nonEmptyString(value.reason, `${path}.reason`, issues);
    return issues.length === start && reason !== undefined
      ? { status: 'invalid', reason }
      : undefined;
  }
  if (value.status === 'ambiguous') {
    fields(value, ['status', 'candidateEntityIds'], ['reason'], path, issues);
    const candidateEntityIds: EntityId[] = [];
    if (!Array.isArray(value.candidateEntityIds)) {
      issue(
        issues,
        `${path}.candidateEntityIds`,
        'Expected an entity-ID array.',
      );
    } else {
      for (const [index, candidate] of value.candidateEntityIds.entries()) {
        const parsed = nonEmptyString(
          candidate,
          `${path}.candidateEntityIds[${index}]`,
          issues,
        );
        if (parsed !== undefined) candidateEntityIds.push(parsed);
      }
      if (
        candidateEntityIds.length < 2 ||
        new Set(candidateEntityIds).size !== candidateEntityIds.length
      ) {
        issue(
          issues,
          `${path}.candidateEntityIds`,
          'Expected at least two distinct candidate IDs.',
        );
      }
    }
    const reason = optionalReason(value, `${path}.reason`, issues);
    if (issues.length !== start) return undefined;
    return reason === undefined
      ? { status: 'ambiguous', candidateEntityIds }
      : { status: 'ambiguous', candidateEntityIds, reason };
  }
  issue(issues, `${path}.status`, 'Unsupported reference-resolution status.');
  return undefined;
}

function reference(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
): Reference | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a reference object.');
    return undefined;
  }
  fields(
    value,
    ['id', 'kind', 'sourceEntityId', 'rawTarget', 'sourceSpan', 'resolution'],
    [],
    path,
    issues,
  );
  const id = nonEmptyString(value.id, `${path}.id`, issues);
  const kind =
    value.kind === 'link' || value.kind === 'embed' ? value.kind : undefined;
  if (kind === undefined) {
    issue(issues, `${path}.kind`, 'Expected link or embed.');
  }
  const sourceEntityId = nonEmptyString(
    value.sourceEntityId,
    `${path}.sourceEntityId`,
    issues,
  );
  const rawTarget = stringValue(value.rawTarget, `${path}.rawTarget`, issues);
  const parsedSpan = sourceSpan(value.sourceSpan, `${path}.sourceSpan`, issues);
  const parsedResolution = resolution(
    value.resolution,
    `${path}.resolution`,
    issues,
  );
  return issues.length === start &&
    id !== undefined &&
    kind !== undefined &&
    sourceEntityId !== undefined &&
    rawTarget !== undefined &&
    parsedSpan !== undefined &&
    parsedResolution !== undefined
    ? {
        id,
        kind,
        sourceEntityId,
        rawTarget,
        sourceSpan: parsedSpan,
        resolution: parsedResolution,
      }
    : undefined;
}

function parseArray<T>(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
  parse: (item: unknown, itemPath: string) => T | undefined,
): T[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'Expected an array.');
    return [];
  }
  const parsed: T[] = [];
  for (const [index, item] of value.entries()) {
    const result = parse(item, `${path}[${index}]`);
    if (result !== undefined) parsed.push(result);
  }
  return parsed;
}

function parseCollection<T extends Identified>(
  value: unknown,
  path: string,
  issues: SnapshotDeltaValidationIssue[],
  parseRecord: RecordParser<T>,
): SnapshotCollectionDelta<T> | undefined {
  const start = issues.length;
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a collection-delta object.');
    return undefined;
  }
  fields(value, ['added', 'removed', 'updated'], ['afterOrder'], path, issues);
  const added = parseArray<AddedRecord<T>>(
    value.added,
    `${path}.added`,
    issues,
    (item, itemPath) => {
      const itemStart = issues.length;
      if (!isRecord(item)) {
        issue(issues, itemPath, 'Expected an added-record object.');
        return undefined;
      }
      fields(item, ['after', 'afterIndex'], [], itemPath, issues);
      const after = parseRecord(item.after, `${itemPath}.after`, issues);
      const afterIndex = integer(
        item.afterIndex,
        0,
        `${itemPath}.afterIndex`,
        issues,
      );
      return issues.length === itemStart &&
        after !== undefined &&
        afterIndex !== undefined
        ? { after, afterIndex }
        : undefined;
    },
  );
  const removed = parseArray<RemovedRecord<T>>(
    value.removed,
    `${path}.removed`,
    issues,
    (item, itemPath) => {
      const itemStart = issues.length;
      if (!isRecord(item)) {
        issue(issues, itemPath, 'Expected a removed-record object.');
        return undefined;
      }
      fields(item, ['before', 'beforeIndex'], [], itemPath, issues);
      const before = parseRecord(item.before, `${itemPath}.before`, issues);
      const beforeIndex = integer(
        item.beforeIndex,
        0,
        `${itemPath}.beforeIndex`,
        issues,
      );
      return issues.length === itemStart &&
        before !== undefined &&
        beforeIndex !== undefined
        ? { before, beforeIndex }
        : undefined;
    },
  );
  const updated = parseArray<UpdatedRecord<T>>(
    value.updated,
    `${path}.updated`,
    issues,
    (item, itemPath) => {
      const itemStart = issues.length;
      if (!isRecord(item)) {
        issue(issues, itemPath, 'Expected an updated-record object.');
        return undefined;
      }
      fields(
        item,
        ['before', 'beforeIndex', 'after', 'afterIndex'],
        [],
        itemPath,
        issues,
      );
      const before = parseRecord(item.before, `${itemPath}.before`, issues);
      const beforeIndex = integer(
        item.beforeIndex,
        0,
        `${itemPath}.beforeIndex`,
        issues,
      );
      const after = parseRecord(item.after, `${itemPath}.after`, issues);
      const afterIndex = integer(
        item.afterIndex,
        0,
        `${itemPath}.afterIndex`,
        issues,
      );
      if (
        before !== undefined &&
        after !== undefined &&
        before.id !== after.id
      ) {
        issue(issues, `${itemPath}.after.id`, 'Updated record IDs must match.');
      }
      return issues.length === itemStart &&
        before !== undefined &&
        beforeIndex !== undefined &&
        after !== undefined &&
        afterIndex !== undefined
        ? { before, beforeIndex, after, afterIndex }
        : undefined;
    },
  );

  const changedIds = new Set<string>();
  const beforeIndexes = new Set<number>();
  const afterIndexes = new Set<number>();
  const registerId = (id: string, itemPath: string): void => {
    if (changedIds.has(id)) {
      issue(
        issues,
        itemPath,
        `Record ID ${JSON.stringify(id)} is changed more than once.`,
      );
    }
    changedIds.add(id);
  };
  const registerIndex = (
    indexes: Set<number>,
    index: number,
    itemPath: string,
  ): void => {
    if (indexes.has(index)) issue(issues, itemPath, 'Index is duplicated.');
    indexes.add(index);
  };
  for (const [index, item] of added.entries()) {
    registerId(item.after.id, `${path}.added[${index}].after.id`);
    registerIndex(
      afterIndexes,
      item.afterIndex,
      `${path}.added[${index}].afterIndex`,
    );
  }
  for (const [index, item] of removed.entries()) {
    registerId(item.before.id, `${path}.removed[${index}].before.id`);
    registerIndex(
      beforeIndexes,
      item.beforeIndex,
      `${path}.removed[${index}].beforeIndex`,
    );
  }
  for (const [index, item] of updated.entries()) {
    registerId(item.before.id, `${path}.updated[${index}].before.id`);
    registerIndex(
      beforeIndexes,
      item.beforeIndex,
      `${path}.updated[${index}].beforeIndex`,
    );
    registerIndex(
      afterIndexes,
      item.afterIndex,
      `${path}.updated[${index}].afterIndex`,
    );
  }

  let afterOrder: string[] | undefined;
  if (Object.hasOwn(value, 'afterOrder')) {
    afterOrder = parseArray<string>(
      value.afterOrder,
      `${path}.afterOrder`,
      issues,
      (item, itemPath) => nonEmptyString(item, itemPath, issues),
    );
    if (new Set(afterOrder).size !== afterOrder.length) {
      issue(issues, `${path}.afterOrder`, 'Expected unique record IDs.');
    }
  }
  return issues.length === start
    ? {
        added,
        removed,
        updated,
        ...(afterOrder === undefined ? {} : { afterOrder }),
      }
    : undefined;
}

export function validateKnowledgeSnapshotDelta(
  value: unknown,
): SnapshotDeltaValidationResult {
  const issues: SnapshotDeltaValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: '$', message: 'Expected a snapshot-delta object.' }],
    };
  }
  fields(
    value,
    ['schemaVersion', 'workspaceId', 'entities', 'references'],
    [],
    '$',
    issues,
  );
  if (value.schemaVersion !== KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION) {
    issue(
      issues,
      '$.schemaVersion',
      'Unsupported snapshot-delta schema version.',
    );
  }
  const workspaceId = nonEmptyString(
    value.workspaceId,
    '$.workspaceId',
    issues,
  );
  const entities = parseCollection(
    value.entities,
    '$.entities',
    issues,
    entity,
  );
  const references = parseCollection(
    value.references,
    '$.references',
    issues,
    reference,
  );
  if (
    issues.length > 0 ||
    workspaceId === undefined ||
    entities === undefined ||
    references === undefined
  ) {
    return { valid: false, issues };
  }
  const delta: KnowledgeSnapshotDelta = {
    schemaVersion: KNOWLEDGE_SNAPSHOT_DELTA_SCHEMA_VERSION,
    workspaceId,
    entities,
    references,
  };
  return { valid: true, value: delta, issues: [] };
}
