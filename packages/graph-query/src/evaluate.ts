import type { AddressableEntity } from '@icarus-graph-explorer/core';

import type { GraphQueryExpression } from './types';

interface EntityQueryFacts {
  readonly kind: AddressableEntity['kind'];
  readonly path: string;
  readonly exactPath: string;
  readonly title: string;
  readonly level: number | undefined;
}

function factsFor(entity: AddressableEntity): EntityQueryFacts {
  return {
    kind: entity.kind,
    path: entity.source.path.toLowerCase(),
    exactPath: entity.source.path,
    title: entity.kind === 'section' ? entity.title.toLowerCase() : '',
    level: entity.kind === 'section' ? entity.level : undefined,
  };
}

function evaluate(
  expression: GraphQueryExpression,
  facts: EntityQueryFacts,
): boolean {
  if (expression.kind === 'and') {
    return (
      evaluate(expression.left, facts) && evaluate(expression.right, facts)
    );
  }
  if (expression.kind === 'or') {
    return (
      evaluate(expression.left, facts) || evaluate(expression.right, facts)
    );
  }
  if (expression.kind === 'not') return !evaluate(expression.expression, facts);
  if (expression.kind === 'kind-predicate') {
    return facts.kind === expression.value;
  }
  if (expression.kind === 'level-predicate') {
    if (facts.level === undefined) return false;
    if (expression.operator === 'lte') return facts.level <= expression.value;
    if (expression.operator === 'gte') return facts.level >= expression.value;
    return facts.level === expression.value;
  }
  if (expression.kind === 'exact-path-predicate') {
    return facts.exactPath === expression.value;
  }
  const needle = expression.value.toLowerCase();
  if (expression.field === 'path') return facts.path.includes(needle);
  if (expression.field === 'title') return facts.title.includes(needle);
  return facts.path.includes(needle) || facts.title.includes(needle);
}

export function matchesGraphQuery(
  entity: AddressableEntity,
  expression: GraphQueryExpression,
): boolean {
  return evaluate(expression, factsFor(entity));
}
