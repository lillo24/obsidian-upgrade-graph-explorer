import type { AddressableEntity } from '@icarus-graph-explorer/core';
import { describe, expect, it } from 'vitest';

import {
  formatGraphQuery,
  matchesGraphQuery,
  MAX_GRAPH_QUERY_AST_NODES,
  MAX_GRAPH_QUERY_LENGTH,
  MAX_GRAPH_QUERY_NESTING,
  parseGraphQuery,
} from './index';

const source = (path: string) => ({
  path,
  span: {
    start: { line: 1, column: 1 },
    end: { line: 1, column: 2 },
  },
});

const document: AddressableEntity = {
  id: 'document',
  kind: 'document',
  source: source('Notes/Overview.md'),
};
const section: AddressableEntity = {
  id: 'section',
  kind: 'section',
  parentId: document.id,
  title: 'Release Plan',
  level: 3,
  source: source('Notes/Overview.md'),
};
const block: AddressableEntity = {
  id: 'block',
  kind: 'block',
  parentId: section.id,
  source: source('Notes/Overview.md'),
};

function parsed(query: string) {
  const result = parseGraphQuery(query);
  expect(result.valid, JSON.stringify(result)).toBe(true);
  if (!result.valid) throw new Error(result.issues[0]?.message);
  return result;
}

describe('graph query parsing and formatting', () => {
  it('applies NOT, AND, and OR precedence and preserves branch order', () => {
    const result = parsed('sections or documents and not path:"archive"');
    expect(result.canonical).toBe(
      'kind:section OR kind:document AND NOT path:"archive"',
    );
    expect(formatGraphQuery(result.expression)).toBe(result.canonical);
  });

  it('retains only required parentheses', () => {
    expect(
      parsed('(sections OR documents) AND NOT (blocks OR level>=4)').canonical,
    ).toBe('(kind:section OR kind:document) AND NOT (kind:block OR level>=4)');
  });

  it('normalizes aliases, heading equality, case, and quoted escapes', () => {
    expect(parsed('KIND:FILE AND level:###').canonical).toBe(
      'kind:document AND level=3',
    );
    expect(parsed('text:"a\\\\b\\"c"').canonical).toBe('text:"a\\\\b\\"c"');
  });

  it('is parse-format-parse idempotent', () => {
    const first = parsed('NOT sections OR path:Notes AND title:"Plan"');
    const second = parsed(first.canonical);
    expect(second.canonical).toBe(first.canonical);
    expect(second.expression).toEqual(first.expression);
  });

  it.each([
    ['sections documents', 'missing-operator'],
    ['sections, documents', 'unsupported-comma'],
    ['path:"unterminated', 'unterminated-string'],
    ['text:"bad\\n"', 'invalid-escape'],
    ['kind:folder', 'invalid-predicate-value'],
    ['level<3', 'unexpected-token'],
    ['owner:"team"', 'unknown-predicate'],
  ])('rejects %s with a positioned %s issue', (query, code) => {
    const result = parseGraphQuery(query);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toMatchObject({ code });
    expect(result.issues[0]?.position).toBeGreaterThanOrEqual(0);
  });

  it('enforces query length, AST size, and nesting limits', () => {
    expect(
      parseGraphQuery('x'.repeat(MAX_GRAPH_QUERY_LENGTH + 1)),
    ).toMatchObject({ valid: false, issues: [{ code: 'query-too-long' }] });
    expect(
      parseGraphQuery(
        Array.from(
          { length: Math.floor(MAX_GRAPH_QUERY_AST_NODES / 2) + 2 },
          () => 'sections',
        ).join(' OR '),
      ),
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'query-too-complex' }],
    });
    expect(
      parseGraphQuery(
        `${'('.repeat(MAX_GRAPH_QUERY_NESTING + 1)}sections${')'.repeat(MAX_GRAPH_QUERY_NESTING + 1)}`,
      ),
    ).toMatchObject({ valid: false, issues: [{ code: 'query-too-deep' }] });
  });
});

describe('graph query evaluation', () => {
  it('matches paths and titles case-insensitively without body content', () => {
    expect(matchesGraphQuery(document, parsed('path:"notes"').expression)).toBe(
      true,
    );
    expect(
      matchesGraphQuery(section, parsed('title:"release"').expression),
    ).toBe(true);
    expect(matchesGraphQuery(block, parsed('title:"release"').expression)).toBe(
      false,
    );
    expect(
      matchesGraphQuery(section, parsed('text:"overview"').expression),
    ).toBe(true);
    expect(
      matchesGraphQuery(section, parsed('text:"release"').expression),
    ).toBe(true);
  });

  it('evaluates kind, level, Boolean grouping, and section-only levels', () => {
    const expression = parsed(
      '(sections AND level<=3) OR (documents AND NOT path:"archive")',
    ).expression;
    expect(matchesGraphQuery(document, expression)).toBe(true);
    expect(matchesGraphQuery(section, expression)).toBe(true);
    expect(matchesGraphQuery(block, expression)).toBe(false);
    expect(matchesGraphQuery(document, parsed('NOT level>=1').expression)).toBe(
      true,
    );
  });
});
