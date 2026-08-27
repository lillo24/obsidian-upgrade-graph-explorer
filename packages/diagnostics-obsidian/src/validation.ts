import { validateKnowledgeSnapshot } from '@icarus-graph-explorer/core';
import type { WorkspaceResolutionDiagnosticCode } from '@icarus-graph-explorer/resolver-obsidian';

import {
  OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION,
  type CompatibilityProbeCode,
  type DiagnosticReportValidationIssue,
  type DiagnosticReportValidationResult,
  type ObsidianDiagnosticReport,
} from './types';

type PlainRecord = Record<string, unknown>;

const DIAGNOSTIC_CODES = new Set<WorkspaceResolutionDiagnosticCode>([
  'invalid-workspace-id',
  'invalid-document-path',
  'duplicate-document-path',
  'invalid-source-structure',
  'id-provider-failure',
  'id-collision',
  'adapter-diagnostic',
  'unresolved-target',
  'ambiguous-target',
  'invalid-target',
  'unsupported-target',
  'canonical-validation',
]);

const PROBE_CODES = new Set<CompatibilityProbeCode>([
  'case-only-file-match',
  'case-only-heading-match',
  'attachment-present-unmodeled',
  'attachment-not-found',
  'attachment-match-ambiguous',
]);

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: DiagnosticReportValidationIssue[],
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
  issues: DiagnosticReportValidationIssue[],
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issue(issues, `${path}.${key}`, 'Required field is missing.');
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issue(issues, `${path}.${key}`, 'Unexpected field.');
    }
  }
}

function nonEmptyString(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issue(issues, path, 'Expected a non-empty string.');
    return false;
  }
  return true;
}

function normalizedWorkspacePath(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): value is string {
  if (!nonEmptyString(value, path, issues)) return false;
  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    /^[A-Za-z]:\//u.test(value) ||
    value
      .split('/')
      .some(
        (segment) =>
          segment.length === 0 || segment === '.' || segment === '..',
      )
  ) {
    issue(
      issues,
      path,
      'Expected a normalized workspace-relative path using forward slashes.',
    );
    return false;
  }
  return true;
}

function nonNegativeInteger(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    issue(issues, path, 'Expected a non-negative integer.');
    return false;
  }
  return true;
}

function nonNegativeFiniteNumber(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    issue(issues, path, 'Expected a non-negative finite number.');
    return false;
  }
  return true;
}

function sourcePoint(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): boolean {
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a source-point object.');
    return false;
  }
  fields(value, ['line', 'column'], ['offset'], path, issues);
  const line = value.line;
  const column = value.column;
  const validLine = Number.isInteger(line) && (line as number) >= 1;
  const validColumn = Number.isInteger(column) && (column as number) >= 1;
  if (!validLine) issue(issues, `${path}.line`, 'Expected an integer >= 1.');
  if (!validColumn)
    issue(issues, `${path}.column`, 'Expected an integer >= 1.');
  if (
    Object.hasOwn(value, 'offset') &&
    (!Number.isInteger(value.offset) || (value.offset as number) < 0)
  ) {
    issue(issues, `${path}.offset`, 'Expected a non-negative integer.');
  }
  return validLine && validColumn;
}

function sourceSpan(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): boolean {
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a source-span object.');
    return false;
  }
  fields(value, ['start', 'end'], [], path, issues);
  const startValid = sourcePoint(value.start, `${path}.start`, issues);
  const endValid = sourcePoint(value.end, `${path}.end`, issues);
  return startValid && endValid;
}

function stringArray(
  value: unknown,
  path: string,
  issues: DiagnosticReportValidationIssue[],
): value is readonly string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'Expected an array.');
    return false;
  }
  let valid = true;
  for (const [index, item] of value.entries()) {
    valid = nonEmptyString(item, `${path}[${index}]`, issues) && valid;
  }
  return valid;
}

function validateDiagnostics(
  value: unknown,
  issues: DiagnosticReportValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    issue(issues, '$.diagnostics', 'Expected an array.');
    return;
  }
  for (const [index, item] of value.entries()) {
    const path = `$.diagnostics[${index}]`;
    if (!isRecord(item)) {
      issue(issues, path, 'Expected a diagnostic object.');
      continue;
    }
    fields(
      item,
      ['code', 'severity', 'fatal', 'message'],
      ['sourcePath', 'sourceSpan', 'relatedCode'],
      path,
      issues,
    );
    if (
      typeof item.code !== 'string' ||
      !DIAGNOSTIC_CODES.has(item.code as WorkspaceResolutionDiagnosticCode)
    ) {
      issue(issues, `${path}.code`, 'Unsupported diagnostic code.');
    }
    if (item.severity !== 'warning' && item.severity !== 'error') {
      issue(issues, `${path}.severity`, 'Expected "warning" or "error".');
    }
    if (typeof item.fatal !== 'boolean') {
      issue(issues, `${path}.fatal`, 'Expected a boolean.');
    }
    nonEmptyString(item.message, `${path}.message`, issues);
    if (Object.hasOwn(item, 'sourcePath')) {
      normalizedWorkspacePath(item.sourcePath, `${path}.sourcePath`, issues);
    }
    if (Object.hasOwn(item, 'sourceSpan')) {
      sourceSpan(item.sourceSpan, `${path}.sourceSpan`, issues);
    }
    if (Object.hasOwn(item, 'relatedCode')) {
      nonEmptyString(item.relatedCode, `${path}.relatedCode`, issues);
    }
  }
}

function validateProbes(
  value: unknown,
  referenceIds: ReadonlySet<string>,
  entityIds: ReadonlySet<string>,
  issues: DiagnosticReportValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    issue(issues, '$.probes', 'Expected an array.');
    return;
  }
  for (const [index, item] of value.entries()) {
    const path = `$.probes[${index}]`;
    if (!isRecord(item)) {
      issue(issues, path, 'Expected a compatibility-probe object.');
      continue;
    }
    fields(
      item,
      ['code', 'referenceId', 'message'],
      ['candidateEntityIds', 'candidatePaths'],
      path,
      issues,
    );
    if (
      typeof item.code !== 'string' ||
      !PROBE_CODES.has(item.code as CompatibilityProbeCode)
    ) {
      issue(issues, `${path}.code`, 'Unsupported compatibility-probe code.');
    }
    if (
      nonEmptyString(item.referenceId, `${path}.referenceId`, issues) &&
      !referenceIds.has(item.referenceId)
    ) {
      issue(issues, `${path}.referenceId`, 'Probe reference does not exist.');
    }
    nonEmptyString(item.message, `${path}.message`, issues);
    if (Object.hasOwn(item, 'candidateEntityIds')) {
      if (
        stringArray(
          item.candidateEntityIds,
          `${path}.candidateEntityIds`,
          issues,
        )
      ) {
        for (const candidate of item.candidateEntityIds) {
          if (!entityIds.has(candidate)) {
            issue(
              issues,
              `${path}.candidateEntityIds`,
              `Candidate entity "${candidate}" does not exist.`,
            );
          }
        }
      }
    }
    if (Object.hasOwn(item, 'candidatePaths')) {
      if (!Array.isArray(item.candidatePaths)) {
        issue(issues, `${path}.candidatePaths`, 'Expected an array.');
      } else {
        for (const [
          candidateIndex,
          candidatePath,
        ] of item.candidatePaths.entries()) {
          normalizedWorkspacePath(
            candidatePath,
            `${path}.candidatePaths[${candidateIndex}]`,
            issues,
          );
        }
      }
    }
  }
}

function validateInventory(
  value: unknown,
  documentCount: number,
  issues: DiagnosticReportValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, '$.sourceInventory', 'Expected a source-inventory object.');
    return;
  }
  fields(
    value,
    ['markdownFileCount', 'nonMarkdownFileCount'],
    [],
    '$.sourceInventory',
    issues,
  );
  if (
    nonNegativeInteger(
      value.markdownFileCount,
      '$.sourceInventory.markdownFileCount',
      issues,
    ) &&
    value.markdownFileCount !== documentCount
  ) {
    issue(
      issues,
      '$.sourceInventory.markdownFileCount',
      'Markdown inventory count must equal canonical document count.',
    );
  }
  nonNegativeInteger(
    value.nonMarkdownFileCount,
    '$.sourceInventory.nonMarkdownFileCount',
    issues,
  );
}

function validateTimings(
  value: unknown,
  issues: DiagnosticReportValidationIssue[],
): void {
  const path = '$.timings';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a timings object.');
    return;
  }
  const keys = [
    'discoveryReadMs',
    'parseAdaptMs',
    'resolutionMs',
    'reportConstructionMs',
    'reportSerializationMs',
  ] as const;
  fields(value, keys, [], path, issues);
  for (const key of keys) {
    nonNegativeFiniteNumber(value[key], `${path}.${key}`, issues);
  }
}

function validateIdentity(
  value: unknown,
  issues: DiagnosticReportValidationIssue[],
): void {
  const path = '$.identity';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected an identity-provenance object.');
    return;
  }
  fields(value, ['stability'], [], path, issues);
  if (value.stability !== 'stable' && value.stability !== 'transient') {
    issue(issues, `${path}.stability`, 'Expected "stable" or "transient".');
  }
}

export function validateObsidianDiagnosticReport(
  value: unknown,
): DiagnosticReportValidationResult {
  const issues: DiagnosticReportValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: '$', message: 'Expected a diagnostic-report object.' }],
    };
  }

  fields(
    value,
    ['schemaVersion', 'snapshot', 'diagnostics', 'probes', 'sourceInventory'],
    ['identity', 'timings'],
    '$',
    issues,
  );
  if (value.schemaVersion !== OBSIDIAN_DIAGNOSTIC_REPORT_SCHEMA_VERSION) {
    issue(
      issues,
      '$.schemaVersion',
      'Unsupported diagnostic report schema version.',
    );
  }

  const snapshotValidation = validateKnowledgeSnapshot(value.snapshot);
  if (!snapshotValidation.valid) {
    for (const snapshotIssue of snapshotValidation.issues) {
      issue(
        issues,
        `$.snapshot${snapshotIssue.path.slice(1)}`,
        snapshotIssue.message,
      );
    }
  }
  const snapshot = snapshotValidation.valid
    ? snapshotValidation.value
    : undefined;
  validateDiagnostics(value.diagnostics, issues);
  validateProbes(
    value.probes,
    new Set(snapshot?.references.map(({ id }) => id) ?? []),
    new Set(snapshot?.entities.map(({ id }) => id) ?? []),
    issues,
  );
  validateInventory(
    value.sourceInventory,
    snapshot?.entities.filter(({ kind }) => kind === 'document').length ?? 0,
    issues,
  );
  if (Object.hasOwn(value, 'timings')) {
    validateTimings(value.timings, issues);
  }
  if (Object.hasOwn(value, 'identity')) {
    validateIdentity(value.identity, issues);
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }
  return {
    valid: true,
    value: value as unknown as ObsidianDiagnosticReport,
    issues: [],
  };
}
