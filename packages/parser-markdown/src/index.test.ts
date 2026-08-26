import { readFileSync } from 'node:fs';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { describe, expect, it } from 'vitest';

import { parseMarkdownDocument } from './index';
import { deriveMarkdownStructure } from './structure';
import type { ParsedMarkdownSection } from './types';

const fixtureSource = readFileSync(
  new URL(
    '../../../tests/fixtures/workspaces/section-extents/input/A.md',
    import.meta.url,
  ),
  'utf8',
);

function section(
  sections: readonly ParsedMarkdownSection[],
  index: number,
): ParsedMarkdownSection {
  const value = sections[index];
  if (value === undefined) {
    throw new Error(`Expected section at index ${index}.`);
  }

  return value;
}

function offsets(parsedSection: ParsedMarkdownSection): [number, number] {
  const start = parsedSection.span.start.offset;
  const end = parsedSection.span.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error('Parser sections must always include offsets.');
  }

  return [start, end];
}

describe('parseMarkdownDocument', () => {
  it('represents an empty document as a zero-length span', () => {
    expect(parseMarkdownDocument({ path: 'Empty.md', source: '' })).toEqual({
      path: 'Empty.md',
      span: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 1, offset: 0 },
      },
      sections: [],
    });
  });

  it('keeps a heading-free preamble at document level', () => {
    const source = 'Preamble only\nwith another line.';
    const result = parseMarkdownDocument({ path: 'Preamble.md', source });

    expect(result.sections).toEqual([]);
    expect(result.span).toEqual({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 2, column: 19, offset: source.length },
    });
  });

  it('derives the synthetic fixture hierarchy without synthetic sections', () => {
    const result = parseMarkdownDocument({
      path: 'fixtures/A.md',
      source: fixtureSource,
    });
    const alpha = section(result.sections, 0);
    const omega = section(result.sections, 1);
    const beta = section(alpha.children, 0);
    const firstDetails = section(alpha.children, 1);
    const secondDetails = section(alpha.children, 2);
    const deep = section(beta.children, 0);

    expect(result.path).toBe('fixtures/A.md');
    expect(result.sections).toHaveLength(2);
    expect(alpha.title).toBe('Alpha');
    expect(alpha.level).toBe(1);
    expect(alpha.children.map(({ title }) => title)).toEqual([
      'Beta',
      'Details',
      'Details',
    ]);
    expect(beta.level).toBe(2);
    expect(deep.level).toBe(4);
    expect(deep.children).toEqual([]);
    expect(firstDetails.title).toBe(secondDetails.title);
    expect(omega.title).toBe('Omega');
    expect(alpha.span.start.offset).toBe(fixtureSource.indexOf('# Alpha'));
    expect(alpha.span.end.offset).toBe(fixtureSource.indexOf('# Omega'));
    expect(omega.span.end.offset).toBe(fixtureSource.length);
  });

  it('uses the nearest open lower-level heading when levels are skipped', () => {
    const result = parseMarkdownDocument({
      path: 'Skipped.md',
      source: '# A\n### C\n###### F\n## B',
    });
    const a = section(result.sections, 0);
    const c = section(a.children, 0);

    expect(a.children.map(({ title, level }) => [title, level])).toEqual([
      ['C', 3],
      ['B', 2],
    ]);
    expect(c.children.map(({ title, level }) => [title, level])).toEqual([
      ['F', 6],
    ]);
  });

  it('keeps empty and duplicate heading titles as distinct sections', () => {
    const result = parseMarkdownDocument({
      path: 'Duplicates.md',
      source: '#\n## Details\n## Details',
    });
    const root = section(result.sections, 0);

    expect(root.title).toBe('');
    expect(root.children.map(({ title }) => title)).toEqual([
      'Details',
      'Details',
    ]);
  });

  it('recognizes Setext headings and keeps heading syntax separate from extent', () => {
    const source = 'Title\n=====\n\nSubtitle\n--------';
    const result = parseMarkdownDocument({ path: 'Setext.md', source });
    const title = section(result.sections, 0);
    const subtitle = section(title.children, 0);

    expect(title.level).toBe(1);
    expect(title.headingSpan).toEqual({
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 2, column: 6, offset: 11 },
    });
    expect(title.span.end.offset).toBe(source.length);
    expect(subtitle.level).toBe(2);
    expect(subtitle.headingSpan).toEqual({
      start: { line: 4, column: 1, offset: 13 },
      end: { line: 5, column: 9, offset: 30 },
    });
  });

  it('extracts human-readable titles from inline Markdown', () => {
    const result = parseMarkdownDocument({
      path: 'Titles.md',
      source:
        '# Hello *world*\n## `code` and [label](target) plus <i>HTML text</i>',
    });
    const root = section(result.sections, 0);

    expect(root.title).toBe('Hello world');
    expect(section(root.children, 0).title).toBe(
      'code and label plus HTML text',
    );
  });

  it('uses only root mdast headings, ignoring fences and block quotes', () => {
    const source = [
      '```text',
      '# Fenced',
      '```',
      '',
      '> # Quoted',
      '> quoted body',
      '',
      '# Real',
    ].join('\n');
    const result = parseMarkdownDocument({ path: 'Root-only.md', source });

    expect(result.sections.map(({ title }) => title)).toEqual(['Real']);
  });

  it('closes siblings and ancestors at exact heading-start offsets', () => {
    const source = '# A\ntext\n## B\ntext\n## C\ntext\n# D\nend';
    const result = parseMarkdownDocument({ path: 'Extents.md', source });
    const a = section(result.sections, 0);
    const d = section(result.sections, 1);
    const b = section(a.children, 0);
    const c = section(a.children, 1);

    expect(offsets(a)).toEqual([source.indexOf('# A'), source.indexOf('# D')]);
    expect(offsets(b)).toEqual([
      source.indexOf('## B'),
      source.indexOf('## C'),
    ]);
    expect(offsets(c)).toEqual([source.indexOf('## C'), source.indexOf('# D')]);
    expect(offsets(d)).toEqual([source.indexOf('# D'), source.length]);
    expect(b.headingSpan.end.offset).toBe(source.indexOf('## B') + 4);
  });

  it('preserves CRLF offsets in the original source', () => {
    const source = '# A\r\n## B';
    const result = parseMarkdownDocument({ path: 'Crlf.md', source });
    const a = section(result.sections, 0);
    const b = section(a.children, 0);

    expect(a.span.end.offset).toBe(source.length);
    expect(b.headingSpan.start).toEqual({ line: 2, column: 1, offset: 5 });
    expect(b.span.end).toEqual({ line: 2, column: 5, offset: 9 });
  });

  it('uses JavaScript UTF-16 code-unit offsets for non-BMP text', () => {
    const source = '😀 intro\n# 😀 title';
    const result = parseMarkdownDocument({ path: 'Unicode.md', source });
    const heading = section(result.sections, 0);

    expect(source.length).toBe(19);
    expect(heading.headingSpan.start).toEqual({
      line: 2,
      column: 1,
      offset: 9,
    });
    expect(heading.headingSpan.end.offset).toBe(19);
    expect(heading.title).toBe('😀 title');
  });

  it('does not promote escaped markers or HTML headings', () => {
    const source = '\\# Escaped\n\n<h1>HTML heading</h1>\n\n# Real';
    const result = parseMarkdownDocument({ path: 'Syntax.md', source });

    expect(result.sections.map(({ title }) => title)).toEqual(['Real']);
  });

  it('documents generic CommonMark frontmatter-like behavior for KG3', () => {
    const source = '---\ntitle: Example\n---\n# Real heading';
    const result = parseMarkdownDocument({
      path: 'Frontmatter-like.md',
      source,
    });

    expect(result.sections.map(({ title, level }) => [title, level])).toEqual([
      ['title: Example', 2],
      ['Real heading', 1],
    ]);
  });

  it('returns only JSON-serializable parser intermediate data', () => {
    const result = parseMarkdownDocument({
      path: 'Serializable.md',
      source: '# A\n## B',
    });

    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(JSON.stringify(result)).not.toContain('position');
  });
});

describe('deriveMarkdownStructure', () => {
  it('fails loudly with the path when required AST positions are absent', () => {
    const root = fromMarkdown('# A');
    const heading = root.children[0];
    if (heading?.type !== 'heading') {
      throw new Error('Test setup expected a heading.');
    }
    delete heading.position;

    expect(() =>
      deriveMarkdownStructure(root, {
        path: 'notes/Missing-position.md',
        sourceLength: 3,
      }),
    ).toThrow(
      'Cannot derive Markdown structure for "notes/Missing-position.md": level 1 heading is missing source position data.',
    );
  });
});
