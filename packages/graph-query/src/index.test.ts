import type { AddressableEntity } from '@icarus-graph-explorer/core';
import { describe, expect, it } from 'vitest';

import {
  addExactPathExclusion,
  addFolderExclusion,
  formatGraphQuery,
  listExactPathExclusions,
  listFolderExclusions,
  matchesGraphQuery,
  MAX_GRAPH_QUERY_AST_NODES,
  MAX_GRAPH_QUERY_LENGTH,
  MAX_GRAPH_QUERY_NESTING,
  parseGraphQuery,
  removeExactPathExclusion,
  removeFolderExclusion,
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

  it('parses exact paths as a distinct predicate and always quotes them', () => {
    expect(parsed('path=Notes/Foo.md')).toMatchObject({
      canonical: 'path="Notes/Foo.md"',
      expression: {
        kind: 'exact-path-predicate',
        value: 'Notes/Foo.md',
      },
    });
    expect(parsed('PATH="folder with spaces/Foo.md"').canonical).toBe(
      'path="folder with spaces/Foo.md"',
    );
    expect(parsed(String.raw`path="Notes/Foo\"Quote.md"`).canonical).toBe(
      String.raw`path="Notes/Foo\"Quote.md"`,
    );
  });

  it('formats exact paths with existing Boolean precedence', () => {
    expect(
      parsed('(path:"notes" OR title:"Foo") AND NOT path=Notes/Foo.md')
        .canonical,
    ).toBe('(path:"notes" OR title:"Foo") AND NOT path="Notes/Foo.md"');
  });

  it('parses exact folder subtrees as a distinct, quoted predicate', () => {
    expect(parsed('FOLDER=Theory/Sub').expression).toEqual({
      kind: 'folder-predicate',
      value: 'Theory/Sub',
    });
    expect(parsed('folder=Theory/Sub').canonical).toBe('folder="Theory/Sub"');
    expect(parsed('folder="folder with spaces"').canonical).toBe(
      'folder="folder with spaces"',
    );
    expect(parsed('folder=.').canonical).toBe('folder="."');
    expect(
      parsed('(folder=Theory OR folder=Archive) AND sections').canonical,
    ).toBe('(folder="Theory" OR folder="Archive") AND kind:section');
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
    ['title="Exact"', 'unexpected-token'],
    ['text="Exact"', 'unexpected-token'],
  ])('rejects %s with a positioned %s issue', (query, code) => {
    const result = parseGraphQuery(query);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toMatchObject({ code });
    expect(result.issues[0]?.position).toBeGreaterThanOrEqual(0);
  });

  it.each([
    'path=""',
    'path="/C:/Foo.md"',
    'path="C:/Foo.md"',
    'path="C:Foo.md"',
    'path="/Foo.md"',
    'path="foo\\\\bar.md"',
    'path="foo//bar.md"',
    'path="foo/./bar.md"',
    'path="foo/../bar.md"',
  ])('rejects non-canonical exact path in %s', (query) => {
    expect(parseGraphQuery(query)).toMatchObject({
      valid: false,
      issues: [{ code: 'invalid-predicate-value' }],
    });
  });

  it.each([
    'folder=""',
    'folder="/Theory"',
    'folder="C:/Theory"',
    'folder="Theory\\\\Drafts"',
    'folder="Theory//Drafts"',
    'folder="Theory/./Drafts"',
    'folder="Theory/../Drafts"',
  ])('rejects non-canonical folder key in %s', (query) => {
    expect(parseGraphQuery(query)).toMatchObject({
      valid: false,
      issues: [{ code: 'invalid-predicate-value' }],
    });
  });

  it('does not add folder substring syntax', () => {
    expect(parseGraphQuery('folder:"Theory"')).toMatchObject({
      valid: false,
      issues: [{ code: 'unexpected-token' }],
    });
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

  it('distinguishes exact path identity from path substring search', () => {
    expect(
      matchesGraphQuery(document, parsed('path:"Overview"').expression),
    ).toBe(true);
    expect(
      matchesGraphQuery(
        document,
        parsed('path="Notes/Overview.md"').expression,
      ),
    ).toBe(true);
    expect(
      matchesGraphQuery(
        document,
        parsed('path="Archive/Notes/Overview.md"').expression,
      ),
    ).toBe(false);
    expect(
      matchesGraphQuery(
        document,
        parsed('path="notes/overview.md"').expression,
      ),
    ).toBe(false);
    for (const entity of [section, block]) {
      expect(
        matchesGraphQuery(
          entity,
          parsed('path="Notes/Overview.md"').expression,
        ),
      ).toBe(true);
    }
  });

  it('matches exact folder segments, descendants, root, and every entity kind', () => {
    const entities: AddressableEntity[] = [
      {
        id: 'theory-document',
        kind: 'document',
        source: source('Theory/A.md'),
      },
      {
        id: 'theory-section',
        kind: 'section',
        parentId: 'theory-document',
        title: 'Theory section',
        level: 2,
        source: source('Theory/Sub/B.md'),
      },
      {
        id: 'theory-block',
        kind: 'block',
        parentId: 'theory-section',
        source: source('Theory/Sub/B.md'),
      },
      {
        id: 'sibling-prefix',
        kind: 'document',
        source: source('Theory-old/C.md'),
      },
      {
        id: 'other-parent',
        kind: 'document',
        source: source('Archive/Theory/D.md'),
      },
      {
        id: 'root',
        kind: 'document',
        source: source('Root.md'),
      },
    ];
    const theory = parsed('folder="Theory"').expression;
    expect(entities.map((entity) => matchesGraphQuery(entity, theory))).toEqual(
      [true, true, true, false, false, false],
    );
    const root = parsed('folder="."').expression;
    expect(entities.every((entity) => matchesGraphQuery(entity, root))).toBe(
      true,
    );
    expect(
      matchesGraphQuery(entities[0]!, parsed('folder="theory"').expression),
    ).toBe(false);
  });

  it('keeps folder queries path-semantic as files are added or moved', () => {
    const query = parsed('folder="Theory"');
    const added: AddressableEntity = {
      id: 'new',
      kind: 'document',
      source: source('Theory/New.md'),
    };
    const moved: AddressableEntity = {
      ...added,
      source: source('Archive/New.md'),
    };
    expect(matchesGraphQuery(added, query.expression)).toBe(true);
    expect(matchesGraphQuery(moved, query.expression)).toBe(false);
    expect(query.canonical).toBe('folder="Theory"');
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

function successfulQuery(
  result: ReturnType<typeof addExactPathExclusion>,
): string | undefined {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.issues[0]?.message);
  return result.query;
}

describe('global exact-path exclusion operations', () => {
  it('adds exclusions to no query, an AND query, and an OR query', () => {
    expect(successfulQuery(addExactPathExclusion(undefined, 'A.md'))).toBe(
      'NOT path="A.md"',
    );
    expect(
      successfulQuery(addExactPathExclusion('kind:document', 'A.md')),
    ).toBe('kind:document AND NOT path="A.md"');
    expect(
      successfulQuery(
        addExactPathExclusion('kind:document OR title:"Memory"', 'A.md'),
      ),
    ).toBe('(kind:document OR title:"Memory") AND NOT path="A.md"');
  });

  it('preserves term order and makes repeated adds idempotent', () => {
    const first = successfulQuery(
      addExactPathExclusion('kind:document', 'A.md'),
    );
    const second = successfulQuery(addExactPathExclusion(first, 'B.md'));
    expect(second).toBe(
      'kind:document AND NOT path="A.md" AND NOT path="B.md"',
    );
    expect(successfulQuery(addExactPathExclusion(second, 'A.md'))).toBe(second);
  });

  it('lists unique global exclusions in query-term order', () => {
    expect(
      listExactPathExclusions(
        '(title:"X" OR sections) AND NOT path="B.md" AND NOT path="A.md" AND NOT path="B.md"',
      ),
    ).toEqual({ ok: true, paths: ['B.md', 'A.md'] });
    expect(listExactPathExclusions(undefined)).toEqual({
      ok: true,
      paths: [],
    });
  });

  it('does not manage exclusions inside OR or nested NOT expressions', () => {
    for (const query of [
      'path="A.md" OR kind:document',
      'NOT (path="A.md" OR path="B.md")',
      'kind:document OR NOT path="A.md"',
    ]) {
      expect(listExactPathExclusions(query)).toEqual({ ok: true, paths: [] });
      expect(removeExactPathExclusion(query, 'A.md')).toEqual({
        ok: true,
        query: parsed(query).canonical,
      });
    }
  });

  it('removes first, middle, last, sole, and duplicate global terms', () => {
    const query =
      'NOT path="A.md" AND kind:document AND NOT path="B.md" AND NOT path="C.md"';
    expect(removeExactPathExclusion(query, 'A.md')).toEqual({
      ok: true,
      query: 'kind:document AND NOT path="B.md" AND NOT path="C.md"',
    });
    expect(removeExactPathExclusion(query, 'B.md')).toEqual({
      ok: true,
      query: 'NOT path="A.md" AND kind:document AND NOT path="C.md"',
    });
    expect(removeExactPathExclusion(query, 'C.md')).toEqual({
      ok: true,
      query: 'NOT path="A.md" AND kind:document AND NOT path="B.md"',
    });
    expect(removeExactPathExclusion('NOT path="A.md"', 'A.md')).toEqual({
      ok: true,
      query: undefined,
    });
    expect(
      removeExactPathExclusion(
        'NOT path="A.md" AND kind:document AND NOT path="A.md"',
        'A.md',
      ),
    ).toEqual({ ok: true, query: 'kind:document' });
  });

  it('returns explicit failures for invalid paths and current queries', () => {
    expect(addExactPathExclusion(undefined, '../A.md')).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-predicate-value' }],
    });
    expect(
      removeExactPathExclusion('sections documents', 'A.md'),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'missing-operator' }],
    });
    expect(listExactPathExclusions('')).toMatchObject({
      ok: false,
      issues: [{ code: 'empty-query' }],
    });
  });

  it('fails instead of emitting queries beyond length, AST, or nesting limits', () => {
    const maximumLengthQuery = `path:"${'x'.repeat(MAX_GRAPH_QUERY_LENGTH - 7)}"`;
    expect(addExactPathExclusion(maximumLengthQuery, 'A.md')).toMatchObject({
      ok: false,
      issues: [{ code: 'query-too-long' }],
    });

    const maximumNodeQuery = Array.from(
      { length: 128 },
      () => 'documents',
    ).join(' AND ');
    expect(addExactPathExclusion(maximumNodeQuery, 'A.md')).toMatchObject({
      ok: false,
      issues: [{ code: 'query-too-complex' }],
    });

    const maximumDepthOr = `documents OR ${'NOT '.repeat(
      MAX_GRAPH_QUERY_NESTING - 1,
    )}(documents OR sections)`;
    expect(parsed(maximumDepthOr).canonical).toContain(' OR ');
    expect(addExactPathExclusion(maximumDepthOr, 'A.md')).toMatchObject({
      ok: false,
      issues: [{ code: 'query-too-deep' }],
    });
  });

  it('does not mutate parsed expression inputs while deriving operations', () => {
    const original = parsed(
      '(kind:document OR kind:section) AND NOT path="A.md"',
    );
    const before = JSON.stringify(original.expression);
    addExactPathExclusion(original.canonical, 'B.md');
    listExactPathExclusions(original.canonical);
    removeExactPathExclusion(original.canonical, 'A.md');
    expect(JSON.stringify(original.expression)).toBe(before);
  });
});

function successfulFolderQuery(
  result: ReturnType<typeof addFolderExclusion>,
): string | undefined {
  expect(result.ok, JSON.stringify(result)).toBe(true);
  if (!result.ok) throw new Error(result.issues[0]?.message);
  return result.query;
}

describe('global folder exclusion operations', () => {
  it('adds to empty, AND, and OR queries with deterministic formatting', () => {
    expect(successfulFolderQuery(addFolderExclusion(undefined, 'Theory'))).toBe(
      'NOT folder="Theory"',
    );
    expect(
      successfulFolderQuery(
        addFolderExclusion('kind:document AND NOT path="Private.md"', 'Theory'),
      ),
    ).toBe('kind:document AND NOT path="Private.md" AND NOT folder="Theory"');
    expect(
      successfulFolderQuery(
        addFolderExclusion('documents OR sections', 'Theory'),
      ),
    ).toBe('(kind:document OR kind:section) AND NOT folder="Theory"');
  });

  it('is idempotent and avoids a descendant term covered by an ancestor', () => {
    const query = successfulFolderQuery(
      addFolderExclusion('NOT folder="Theory"', 'Theory/Drafts'),
    );
    expect(query).toBe('NOT folder="Theory"');
    expect(successfulFolderQuery(addFolderExclusion(query, 'Theory'))).toBe(
      query,
    );
    expect(
      successfulFolderQuery(
        addFolderExclusion('NOT folder="."', 'Any/Descendant'),
      ),
    ).toBe('NOT folder="."');
  });

  it('lists only unique top-level AND terms and ignores nested Boolean terms', () => {
    expect(
      listFolderExclusions(
        'NOT folder="Theory" AND kind:document AND NOT folder="Archive" AND NOT folder="Theory"',
      ),
    ).toEqual({ ok: true, folderKeys: ['Theory', 'Archive'] });
    for (const query of [
      'folder="Theory" OR kind:document',
      'NOT (folder="Theory" OR folder="Archive")',
      'kind:document OR NOT folder="Theory"',
    ]) {
      expect(listFolderExclusions(query)).toEqual({
        ok: true,
        folderKeys: [],
      });
      expect(removeFolderExclusion(query, 'Theory')).toEqual({
        ok: true,
        query: parsed(query).canonical,
      });
    }
  });

  it('restores only the selected folder and leaves file/nested exclusions intact', () => {
    expect(
      removeFolderExclusion(
        'NOT folder="Theory" AND NOT path="Theory/Special.md" AND NOT folder="Theory/Drafts"',
        'Theory',
      ),
    ).toEqual({
      ok: true,
      query: 'NOT path="Theory/Special.md" AND NOT folder="Theory/Drafts"',
    });
    expect(removeFolderExclusion('NOT folder="Theory"', 'Theory')).toEqual({
      ok: true,
      query: undefined,
    });
  });

  it('rejects invalid keys/current queries and generated limit overflows', () => {
    expect(addFolderExclusion(undefined, '../Theory')).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-predicate-value' }],
    });
    expect(removeFolderExclusion('sections documents', 'Theory')).toMatchObject(
      { ok: false, issues: [{ code: 'missing-operator' }] },
    );
    const maximumLengthQuery = `path:"${'x'.repeat(MAX_GRAPH_QUERY_LENGTH - 7)}"`;
    expect(addFolderExclusion(maximumLengthQuery, 'Theory')).toMatchObject({
      ok: false,
      issues: [{ code: 'query-too-long' }],
    });
  });

  it('does not mutate parsed expressions while deriving operations', () => {
    const original = parsed(
      '(kind:document OR kind:section) AND NOT folder="Theory"',
    );
    const before = JSON.stringify(original.expression);
    addFolderExclusion(original.canonical, 'Archive');
    listFolderExclusions(original.canonical);
    removeFolderExclusion(original.canonical, 'Theory');
    expect(JSON.stringify(original.expression)).toBe(before);
  });
});
