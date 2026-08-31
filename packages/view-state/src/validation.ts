import type { EntityKind } from '@icarus-graph-explorer/core';
import {
  STRUCTURAL_DEPTHS,
  type ReferenceResolutionStatus,
  type StructuralDepth,
} from '@icarus-graph-explorer/view-projection';

import {
  PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
  type PersistedViewValidationIssue,
  type PersistedViewValidationResult,
  type PersistedWorkspaceView,
  type PersistedRendererViewports,
} from './types';

type PlainRecord = Record<string, unknown>;

const ENTITY_KINDS = new Set<EntityKind>(['document', 'section', 'block']);
const REFERENCE_STATUSES = new Set<ReferenceResolutionStatus>([
  'resolved',
  'unresolved',
  'ambiguous',
  'invalid',
]);
const STRUCTURAL_DEPTH_VALUES = new Set<StructuralDepth>(STRUCTURAL_DEPTHS);

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: PersistedViewValidationIssue[],
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
  issues: PersistedViewValidationIssue[],
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

function nonEmptyString(
  value: unknown,
  path: string,
  issues: PersistedViewValidationIssue[],
): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    issue(issues, path, 'Expected a non-empty string.');
    return false;
  }
  return true;
}

function uniqueStringArray(
  value: unknown,
  path: string,
  issues: PersistedViewValidationIssue[],
  allowed?: ReadonlySet<string>,
): value is readonly string[] {
  if (!Array.isArray(value)) {
    issue(issues, path, 'Expected an array.');
    return false;
  }
  let valid = true;
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!nonEmptyString(item, `${path}[${index}]`, issues)) {
      valid = false;
      continue;
    }
    if (allowed !== undefined && !allowed.has(item)) {
      issue(issues, `${path}[${index}]`, 'Unsupported value.');
      valid = false;
    }
    if (seen.has(item)) {
      issue(issues, `${path}[${index}]`, 'Duplicate value.');
      valid = false;
    }
    seen.add(item);
  }
  return valid;
}

function normalizedPathPrefix(
  value: string,
  path: string,
  issues: PersistedViewValidationIssue[],
): boolean {
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
      'Expected a normalized workspace-relative path prefix.',
    );
    return false;
  }
  return true;
}

function validateDisclosure(
  value: unknown,
  issues: PersistedViewValidationIssue[],
): void {
  const path = '$.projection.disclosure';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a disclosure object.');
    return;
  }
  fields(
    value,
    [
      'defaultDepth',
      'expandedEntityIds',
      'collapsedEntityIds',
      'includeBlocks',
    ],
    ['maxSectionLevel'],
    path,
    issues,
  );
  if (!STRUCTURAL_DEPTH_VALUES.has(value.defaultDepth as StructuralDepth)) {
    issue(issues, `${path}.defaultDepth`, 'Expected 0, 1, 2, or 3.');
  }
  if (
    Object.hasOwn(value, 'maxSectionLevel') &&
    value.maxSectionLevel !== 1 &&
    value.maxSectionLevel !== 2 &&
    value.maxSectionLevel !== 3 &&
    value.maxSectionLevel !== 4 &&
    value.maxSectionLevel !== 5 &&
    value.maxSectionLevel !== 6
  ) {
    issue(
      issues,
      `${path}.maxSectionLevel`,
      'Expected an integer from 1 to 6.',
    );
  }
  uniqueStringArray(
    value.expandedEntityIds,
    `${path}.expandedEntityIds`,
    issues,
  );
  uniqueStringArray(
    value.collapsedEntityIds,
    `${path}.collapsedEntityIds`,
    issues,
  );
  if (typeof value.includeBlocks !== 'boolean') {
    issue(issues, `${path}.includeBlocks`, 'Expected a boolean.');
  }
}

function validateFocus(
  value: unknown,
  issues: PersistedViewValidationIssue[],
): void {
  const path = '$.projection.focus';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a focus object.');
    return;
  }
  fields(
    value,
    ['rootEntityId', 'hops', 'direction', 'hierarchyContext'],
    [],
    path,
    issues,
  );
  nonEmptyString(value.rootEntityId, `${path}.rootEntityId`, issues);
  if (value.hops !== 1 && value.hops !== 2 && value.hops !== 3) {
    issue(issues, `${path}.hops`, 'Expected 1, 2, or 3.');
  }
  if (
    value.direction !== 'incoming' &&
    value.direction !== 'outgoing' &&
    value.direction !== 'both'
  ) {
    issue(
      issues,
      `${path}.direction`,
      'Expected "incoming", "outgoing", or "both".',
    );
  }
  if (
    value.hierarchyContext !== 'ancestors' &&
    value.hierarchyContext !== 'ancestors-and-children'
  ) {
    issue(issues, `${path}.hierarchyContext`, 'Unsupported hierarchy context.');
  }
}

function validateFilters(
  value: unknown,
  issues: PersistedViewValidationIssue[],
): void {
  const path = '$.projection.filters';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a filters object.');
    return;
  }
  fields(
    value,
    [],
    ['pathPrefixes', 'entityKinds', 'referenceStatuses'],
    path,
    issues,
  );
  if (Object.hasOwn(value, 'pathPrefixes')) {
    if (uniqueStringArray(value.pathPrefixes, `${path}.pathPrefixes`, issues)) {
      for (const [index, prefix] of value.pathPrefixes.entries()) {
        normalizedPathPrefix(prefix, `${path}.pathPrefixes[${index}]`, issues);
      }
    }
  }
  if (Object.hasOwn(value, 'entityKinds')) {
    uniqueStringArray(
      value.entityKinds,
      `${path}.entityKinds`,
      issues,
      ENTITY_KINDS,
    );
  }
  if (Object.hasOwn(value, 'referenceStatuses')) {
    uniqueStringArray(
      value.referenceStatuses,
      `${path}.referenceStatuses`,
      issues,
      REFERENCE_STATUSES,
    );
  }
}

function validateProjection(
  value: unknown,
  issues: PersistedViewValidationIssue[],
): void {
  const path = '$.projection';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a projection-state object.');
    return;
  }
  fields(value, ['disclosure'], ['focus', 'filters'], path, issues);
  validateDisclosure(value.disclosure, issues);
  if (Object.hasOwn(value, 'focus')) validateFocus(value.focus, issues);
  if (Object.hasOwn(value, 'filters')) validateFilters(value.filters, issues);
}

function validateStructureViewport(
  value: unknown,
  path: string,
  issues: PersistedViewValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a semantic viewport object.');
    return;
  }
  fields(value, ['anchorEntityId', 'zoom'], [], path, issues);
  nonEmptyString(value.anchorEntityId, `${path}.anchorEntityId`, issues);
  if (
    typeof value.zoom !== 'number' ||
    !Number.isFinite(value.zoom) ||
    value.zoom <= 0
  ) {
    issue(issues, `${path}.zoom`, 'Expected a positive finite number.');
  }
}

function validateGlobalViewport(
  value: unknown,
  path: string,
  issues: PersistedViewValidationIssue[],
): void {
  if (!isRecord(value)) {
    issue(issues, path, 'Expected a semantic Global viewport object.');
    return;
  }
  fields(value, ['anchorEntityId', 'ratio'], [], path, issues);
  nonEmptyString(value.anchorEntityId, `${path}.anchorEntityId`, issues);
  if (
    typeof value.ratio !== 'number' ||
    !Number.isFinite(value.ratio) ||
    value.ratio <= 0
  ) {
    issue(issues, `${path}.ratio`, 'Expected a positive finite number.');
  }
}

function validateViewports(
  value: unknown,
  issues: PersistedViewValidationIssue[],
): void {
  const path = '$.viewports';
  if (!isRecord(value)) {
    issue(issues, path, 'Expected renderer semantic viewports.');
    return;
  }
  fields(value, [], ['structure', 'global'], path, issues);
  if (Object.hasOwn(value, 'structure')) {
    validateStructureViewport(value.structure, `${path}.structure`, issues);
  }
  if (Object.hasOwn(value, 'global')) {
    validateGlobalViewport(value.global, `${path}.global`, issues);
  }
}

export function validatePersistedWorkspaceView(
  value: unknown,
): PersistedViewValidationResult {
  const issues: PersistedViewValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [{ path: '$', message: 'Expected a persisted-view object.' }],
    };
  }
  if (value.schemaVersion === 1) {
    fields(
      value,
      ['schemaVersion', 'workspaceId', 'projection'],
      ['viewport'],
      '$',
      issues,
    );
    nonEmptyString(value.workspaceId, '$.workspaceId', issues);
    validateProjection(value.projection, issues);
    if (Object.hasOwn(value, 'viewport')) {
      validateStructureViewport(value.viewport, '$.viewport', issues);
    }
    if (issues.length > 0) return { valid: false, issues };
    const migrated: PersistedWorkspaceView = {
      schemaVersion: PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
      workspaceId: value.workspaceId as string,
      rendererMode: 'structure',
      projection: value.projection as PersistedWorkspaceView['projection'],
      ...(Object.hasOwn(value, 'viewport')
        ? {
            viewports: {
              structure: value.viewport as NonNullable<
                PersistedRendererViewports['structure']
              >,
            },
          }
        : {}),
    };
    return { valid: true, value: migrated, issues: [] };
  }
  fields(
    value,
    ['schemaVersion', 'workspaceId', 'rendererMode', 'projection'],
    ['viewports'],
    '$',
    issues,
  );
  if (value.schemaVersion !== PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION) {
    issue(
      issues,
      '$.schemaVersion',
      'Unsupported persisted-view schema version.',
    );
  }
  nonEmptyString(value.workspaceId, '$.workspaceId', issues);
  if (value.rendererMode !== 'structure' && value.rendererMode !== 'global') {
    issue(issues, '$.rendererMode', 'Expected "structure" or "global".');
  }
  validateProjection(value.projection, issues);
  if (Object.hasOwn(value, 'viewports'))
    validateViewports(value.viewports, issues);

  return issues.length === 0
    ? {
        valid: true,
        value: value as unknown as PersistedWorkspaceView,
        issues: [],
      }
    : { valid: false, issues };
}
