import { formatGraphQuery } from './format';
import { parseGraphQuery } from './parser';
import type { GraphQueryExpression, GraphQueryIssue } from './types';

export function parseCurrentQuery(
  query: string | undefined,
): GraphQueryExpression | readonly GraphQueryIssue[] | undefined {
  if (query === undefined) return undefined;
  const parsed = parseGraphQuery(query);
  return parsed.valid ? parsed.expression : parsed.issues;
}

export function isIssueList(
  value: GraphQueryExpression | readonly GraphQueryIssue[] | undefined,
): value is readonly GraphQueryIssue[] {
  return Array.isArray(value);
}

export function topLevelAndTerms(
  expression: GraphQueryExpression,
): readonly GraphQueryExpression[] {
  if (expression.kind !== 'and') return [expression];
  return [
    ...topLevelAndTerms(expression.left),
    ...topLevelAndTerms(expression.right),
  ];
}

export function rebuildAnd(
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

/** Reparse generated text so UI mutations obey the same QUERY1 bounds. */
export function canonicalMutationResult(
  expression: GraphQueryExpression | undefined,
):
  | { readonly ok: true; readonly query: string | undefined }
  | { readonly ok: false; readonly issues: readonly GraphQueryIssue[] } {
  if (expression === undefined) return { ok: true, query: undefined };
  const canonical = formatGraphQuery(expression);
  const validated = parseGraphQuery(canonical);
  return validated.valid
    ? { ok: true, query: validated.canonical }
    : { ok: false, issues: validated.issues };
}
