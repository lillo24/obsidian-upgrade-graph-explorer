import type {
  AddressableEntity,
  EntityKind,
  WorkspacePath,
} from '@icarus-graph-explorer/core';
import {
  matchesGraphQuery,
  parseGraphQuery,
  type GraphQueryParseResult,
} from '@icarus-graph-explorer/graph-query';

import type {
  ProjectedEntityNode,
  ProjectedReferenceEdge,
  ProjectionIssue,
  ViewProjectionFilters,
} from './types';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedPathPrefix(prefix: string): boolean {
  return (
    prefix.length > 0 &&
    !prefix.startsWith('/') &&
    !prefix.includes('\\') &&
    !/^[A-Za-z]:\//u.test(prefix) &&
    prefix
      .split('/')
      .every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
  );
}

function pathMatches(path: string, prefixes: ReadonlySet<string>): boolean {
  for (const prefix of prefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export interface PreparedViewProjectionFilters {
  readonly filters: ViewProjectionFilters | undefined;
  readonly query: GraphQueryParseResult | undefined;
  readonly validPathPrefixes: ReadonlySet<WorkspacePath> | undefined;
  readonly entityKinds: ReadonlySet<EntityKind> | undefined;
  readonly referenceStatuses:
    ReadonlySet<ProjectedReferenceEdge['status']> | undefined;
  readonly projectedText: string;
  readonly issues: readonly ProjectionIssue[];
  readonly invalid: boolean;
  readonly hasCanonicalEntityFilter: boolean;
  readonly hasProjectedTextFilter: boolean;
  readonly hasEntityVisibilityFilter: boolean;
}

/**
 * Parses and normalizes one filter state for reuse by both the visible and
 * DISC1 candidate paths. Projected text remains separate because canonical
 * entities intentionally do not contain every string that filter can inspect.
 */
export function prepareViewProjectionFilters(
  filters: ViewProjectionFilters | undefined,
): PreparedViewProjectionFilters {
  const query =
    filters?.query === undefined ? undefined : parseGraphQuery(filters.query);
  if (query !== undefined && !query.valid) {
    const first = query.issues[0];
    return {
      filters,
      query,
      validPathPrefixes: undefined,
      entityKinds: undefined,
      referenceStatuses: undefined,
      projectedText: '',
      issues: [
        {
          code: 'invalid-query',
          subject: filters?.query ?? '',
          message: `Graph query is invalid${
            first === undefined
              ? '.'
              : ` at character ${first.position + 1}: ${first.message}`
          }`,
        },
      ],
      invalid: true,
      hasCanonicalEntityFilter: true,
      hasProjectedTextFilter: false,
      hasEntityVisibilityFilter: true,
    };
  }

  const issues: ProjectionIssue[] = [];
  let validPathPrefixes: Set<WorkspacePath> | undefined;
  if (filters?.pathPrefixes !== undefined) {
    validPathPrefixes = new Set<WorkspacePath>();
    for (const prefix of [...new Set(filters.pathPrefixes)].sort(compareText)) {
      if (normalizedPathPrefix(prefix)) {
        validPathPrefixes.add(prefix);
      } else {
        issues.push({
          code: 'invalid-path-prefix',
          subject: prefix,
          message: `Path prefix "${prefix}" is not a normalized workspace-relative path prefix.`,
        });
      }
    }
  }
  const projectedText = filters?.text?.trim().toLowerCase() ?? '';
  const hasCanonicalEntityFilter =
    filters?.pathPrefixes !== undefined ||
    filters?.entityKinds !== undefined ||
    query !== undefined;
  const hasProjectedTextFilter = projectedText.length > 0;
  return {
    filters,
    query,
    validPathPrefixes,
    entityKinds:
      filters?.entityKinds === undefined
        ? undefined
        : new Set(filters.entityKinds),
    referenceStatuses:
      filters?.referenceStatuses === undefined
        ? undefined
        : new Set(filters.referenceStatuses),
    projectedText,
    issues,
    invalid: false,
    hasCanonicalEntityFilter,
    hasProjectedTextFilter,
    hasEntityVisibilityFilter:
      hasCanonicalEntityFilter || hasProjectedTextFilter,
  };
}

export function matchesCanonicalEntityFilters(
  entity: AddressableEntity,
  plan: PreparedViewProjectionFilters,
): boolean {
  if (plan.invalid) return false;
  if (
    plan.validPathPrefixes !== undefined &&
    !pathMatches(entity.source.path, plan.validPathPrefixes)
  ) {
    return false;
  }
  if (plan.entityKinds !== undefined && !plan.entityKinds.has(entity.kind)) {
    return false;
  }
  return (
    plan.query === undefined ||
    (plan.query.valid && matchesGraphQuery(entity, plan.query.expression))
  );
}

export function matchesProjectedText(
  node: ProjectedEntityNode,
  plan: PreparedViewProjectionFilters,
): boolean {
  return (
    !plan.hasProjectedTextFilter ||
    node.sourcePath.toLowerCase().includes(plan.projectedText) ||
    (node.title?.toLowerCase().includes(plan.projectedText) ?? false)
  );
}

export function referenceStatusAllowed(
  status: ProjectedReferenceEdge['status'],
  plan: PreparedViewProjectionFilters,
): boolean {
  return (
    plan.referenceStatuses === undefined || plan.referenceStatuses.has(status)
  );
}
