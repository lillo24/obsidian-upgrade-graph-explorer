import {
  isNormalizedWorkspacePath,
  type WorkspacePath,
} from '@icarus-graph-explorer/core';

import { formatGraphQuery } from './format';
import { parseGraphQuery } from './parser';
import type {
  ExactPathExclusionListResult,
  ExactPathExclusionMutationResult,
  GraphQueryExpression,
  GraphQueryIssue,
} from './types';

function invalidPathIssue(path: string): GraphQueryIssue {
  return {
    code: 'invalid-predicate-value',
    position: 0,
    length: path.length,
    message:
      'An exact-path exclusion requires a normalized workspace-relative path using forward slashes.',
  };
}

function parseCurrentQuery(
  query: string | undefined,
): GraphQueryExpression | readonly GraphQueryIssue[] | undefined {
  if (query === undefined) return undefined;
  const parsed = parseGraphQuery(query);
  return parsed.valid ? parsed.expression : parsed.issues;
}

function isIssueList(
  value: GraphQueryExpression | readonly GraphQueryIssue[] | undefined,
): value is readonly GraphQueryIssue[] {
  return Array.isArray(value);
}

function topLevelAndTerms(
  expression: GraphQueryExpression,
): readonly GraphQueryExpression[] {
  if (expression.kind !== 'and') return [expression];
  return [
    ...topLevelAndTerms(expression.left),
    ...topLevelAndTerms(expression.right),
  ];
}

function managedExactPath(
  expression: GraphQueryExpression,
): WorkspacePath | undefined {
  return expression.kind === 'not' &&
    expression.expression.kind === 'exact-path-predicate'
    ? expression.expression.value
    : undefined;
}

function rebuildAnd(
  terms: readonly GraphQueryExpression[],
): GraphQueryExpression | undefined {
  const first = terms[0];
  if (first === undefined) return undefined;
  return terms
    .slice(1)
    .reduce<GraphQueryExpression>(
      (left, right) => ({ kind: 'and', left, right }),
      first,
    );
}

function canonicalMutationResult(
  expression: GraphQueryExpression | undefined,
): ExactPathExclusionMutationResult {
  if (expression === undefined) return { ok: true, query: undefined };
  const canonical = formatGraphQuery(expression);
  const validated = parseGraphQuery(canonical);
  return validated.valid
    ? { ok: true, query: validated.canonical }
    : { ok: false, issues: validated.issues };
}

/** Adds one global `NOT path="..."` term to a canonical query. */
export function addExactPathExclusion(
  query: string | undefined,
  path: string,
): ExactPathExclusionMutationResult {
  if (!isNormalizedWorkspacePath(path)) {
    return { ok: false, issues: [invalidPathIssue(path)] };
  }
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (
    parsed !== undefined &&
    topLevelAndTerms(parsed).some((term) => managedExactPath(term) === path)
  ) {
    return canonicalMutationResult(parsed);
  }
  const exclusion: GraphQueryExpression = {
    kind: 'not',
    expression: { kind: 'exact-path-predicate', value: path },
  };
  return canonicalMutationResult(
    parsed === undefined
      ? exclusion
      : { kind: 'and', left: parsed, right: exclusion },
  );
}

/** Lists unique global exact-path exclusions in visible query-term order. */
export function listExactPathExclusions(
  query: string | undefined,
): ExactPathExclusionListResult {
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (parsed === undefined) return { ok: true, paths: [] };
  const seen = new Set<WorkspacePath>();
  for (const term of topLevelAndTerms(parsed)) {
    const path = managedExactPath(term);
    if (path !== undefined) seen.add(path);
  }
  return { ok: true, paths: [...seen] };
}

/** Removes all matching global exact-path exclusion terms from a query. */
export function removeExactPathExclusion(
  query: string | undefined,
  path: string,
): ExactPathExclusionMutationResult {
  if (!isNormalizedWorkspacePath(path)) {
    return { ok: false, issues: [invalidPathIssue(path)] };
  }
  const parsed = parseCurrentQuery(query);
  if (isIssueList(parsed)) return { ok: false, issues: parsed };
  if (parsed === undefined) return { ok: true, query: undefined };
  return canonicalMutationResult(
    rebuildAnd(
      topLevelAndTerms(parsed).filter(
        (term) => managedExactPath(term) !== path,
      ),
    ),
  );
}
