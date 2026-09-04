import type { GraphQueryExpression, GraphQueryPredicate } from './types';

function quoted(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function formatPredicate(predicate: GraphQueryPredicate): string {
  if (predicate.kind === 'exact-path-predicate') {
    return `path=${quoted(predicate.value)}`;
  }
  if (predicate.kind === 'folder-predicate') {
    return `folder=${quoted(predicate.value)}`;
  }
  if (predicate.kind === 'string-predicate') {
    return `${predicate.field}:${quoted(predicate.value)}`;
  }
  if (predicate.kind === 'kind-predicate') return `kind:${predicate.value}`;
  const operator =
    predicate.operator === 'lte'
      ? '<='
      : predicate.operator === 'gte'
        ? '>='
        : '=';
  return `level${operator}${predicate.value}`;
}

function precedence(expression: GraphQueryExpression): number {
  if (expression.kind === 'or') return 1;
  if (expression.kind === 'and') return 2;
  if (expression.kind === 'not') return 3;
  return 4;
}

function formatted(
  expression: GraphQueryExpression,
  parentPrecedence: number,
): string {
  const ownPrecedence = precedence(expression);
  let value: string;
  if (expression.kind === 'and' || expression.kind === 'or') {
    const keyword = expression.kind.toUpperCase();
    value = `${formatted(expression.left, ownPrecedence)} ${keyword} ${formatted(expression.right, ownPrecedence)}`;
  } else if (expression.kind === 'not') {
    value = `NOT ${formatted(expression.expression, ownPrecedence)}`;
  } else {
    value = formatPredicate(expression);
  }
  return ownPrecedence < parentPrecedence ? `(${value})` : value;
}

export function formatGraphQuery(expression: GraphQueryExpression): string {
  return formatted(expression, 0);
}
