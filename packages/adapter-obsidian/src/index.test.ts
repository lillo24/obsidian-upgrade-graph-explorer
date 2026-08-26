import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseObsidianDocument } from './index';
import type { ParsedObsidianDocument, ParsedSourceReference } from './types';

const frontmatterFixture = readFileSync(
  new URL(
    '../../../tests/fixtures/workspaces/obsidian-frontmatter/input/A.md',
    import.meta.url,
  ),
  'utf8',
);
const linksFixture = readFileSync(
  new URL(
    '../../../tests/fixtures/workspaces/obsidian-links/input/A.md',
    import.meta.url,
  ),
  'utf8',
);
const blocksFixture = readFileSync(
  new URL(
    '../../../tests/fixtures/workspaces/obsidian-blocks/input/A.md',
    import.meta.url,
  ),
  'utf8',
);

function parse(source: string, path = 'A.md'): ParsedObsidianDocument {
  return parseObsidianDocument({ path, source });
}

function reference(
  references: readonly ParsedSourceReference[],
  index: number,
): ParsedSourceReference {
  const value = references[index];
  if (value === undefined) {
    throw new Error(`Expected reference at index ${index}.`);
  }
  return value;
}

function sourceSlice(
  source: string,
  value: {
    readonly sourceSpan: {
      readonly start: { readonly offset?: number };
      readonly end: { readonly offset?: number };
    };
  },
): string {
  const start = value.sourceSpan.start.offset;
  const end = value.sourceSpan.end.offset;
  if (start === undefined || end === undefined) {
    throw new Error('Adapter facts must always include source offsets.');
  }
  return source.slice(start, end);
}

describe('parseObsidianDocument', () => {
  it('parses leading YAML before deriving KG2-compatible structure', () => {
    const result = parse(frontmatterFixture, 'obsidian-frontmatter/A.md');

    expect(result.metadata.aliases).toEqual(['Alternate', 'Quoted alternate']);
    expect(result.metadata.frontmatterSpan?.start.offset).toBe(0);
    expect(result.structure.sections.map(({ title }) => title)).toEqual([
      'Real heading',
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('preserves trustworthy structure and references when YAML is malformed', () => {
    const source = [
      '---',
      'aliases: [broken',
      '---',
      '# Real',
      'See [[Target]].',
    ].join('\n');
    const result = parse(source, 'Malformed.md');

    expect(result.metadata.aliases).toEqual([]);
    expect(result.structure.sections.map(({ title }) => title)).toEqual([
      'Real',
    ]);
    expect(result.references).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'malformed-frontmatter',
      severity: 'error',
    });
    expect(result.diagnostics[0]?.message).toContain('Malformed.md');
  });

  it('validates alias lists, keeps first occurrences, and ignores unknown properties', () => {
    const source = [
      '---',
      'title: Example',
      'aliases:',
      '  - One',
      '  - 42',
      '  - One',
      '  - "Deux"',
      '---',
    ].join('\n');
    const result = parse(source);

    expect(result.metadata.aliases).toEqual(['One', 'Deux']);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'invalid-aliases',
      'duplicate-alias',
    ]);
    expect(parse('---\naliases: Scalar\n---').diagnostics[0]?.code).toBe(
      'invalid-aliases',
    );
    expect(parse('---\n---').metadata.aliases).toEqual([]);
    expect(
      parse('---\r\naliases:\r\n  - "Café 😀"\r\n---\r\n# Heading').metadata
        .aliases,
    ).toEqual(['Café 😀']);
  });

  it('decomposes file, heading, nested-heading, and block wikilinks', () => {
    const source = [
      '[[Target]]',
      '[[Target.md]]',
      '[[folder/Target]]',
      '[[#Heading]]',
      '[[Target#Heading]]',
      '[[Target#Parent#Child]]',
      '[[#Parent#Child|section]]',
      '[[Target#^block-id]]',
      '[[#^local-block]]',
    ].join('\n');
    const result = parse(source);

    expect(result.references.map(({ rawTarget }) => rawTarget)).toEqual([
      'Target',
      'Target.md',
      'folder/Target',
      '#Heading',
      'Target#Heading',
      'Target#Parent#Child',
      '#Parent#Child',
      'Target#^block-id',
      '#^local-block',
    ]);
    expect(reference(result.references, 0).target).toEqual({
      kind: 'file',
      file: 'Target',
    });
    expect(reference(result.references, 3).target).toEqual({
      kind: 'heading',
      headings: ['Heading'],
    });
    expect(reference(result.references, 5).target).toEqual({
      kind: 'heading',
      file: 'Target',
      headings: ['Parent', 'Child'],
    });
    expect(reference(result.references, 6).displayText).toBe('section');
    expect(reference(result.references, 7).target).toEqual({
      kind: 'block',
      file: 'Target',
      blockId: 'block-id',
    });
    expect(reference(result.references, 8).target).toEqual({
      kind: 'block',
      blockId: 'local-block',
    });
    expect(
      result.references.map((value) => sourceSlice(source, value)),
    ).toEqual(source.split('\n'));
  });

  it('keeps wikilink display text separate and identifies embeds', () => {
    const source = [
      '[[Target|custom]]',
      '[[Target#Heading|section]]',
      '![[Target]]',
      '![[image.png|663]]',
      '![[Target#Heading]]',
    ].join('\n');
    const result = parse(source);

    expect(
      result.references.map(({ kind, rawTarget, displayText }) => ({
        kind,
        rawTarget,
        displayText,
      })),
    ).toEqual([
      { kind: 'link', rawTarget: 'Target', displayText: 'custom' },
      {
        kind: 'link',
        rawTarget: 'Target#Heading',
        displayText: 'section',
      },
      { kind: 'embed', rawTarget: 'Target', displayText: undefined },
      { kind: 'embed', rawTarget: 'image.png', displayText: '663' },
      {
        kind: 'embed',
        rawTarget: 'Target#Heading',
        displayText: undefined,
      },
    ]);
    expect(sourceSlice(source, reference(result.references, 3))).toBe(
      '![[image.png|663]]',
    );
  });

  it('extracts local Markdown links/images and omits obvious external URLs', () => {
    const source = [
      '[Target](Target.md)',
      '[Section](Target.md#Heading)',
      '![Alt](assets/image.png)',
      '[Spaced](<Target Name.md>)',
      '[Entity](A&amp;B.md)',
      '[Web](https://example.com)',
      '[Mail](mailto:test@example.com)',
    ].join('\n');
    const result = parse(source);

    expect(
      result.references.map(({ syntax, kind, rawTarget, displayText }) => ({
        syntax,
        kind,
        rawTarget,
        displayText,
      })),
    ).toEqual([
      {
        syntax: 'markdown',
        kind: 'link',
        rawTarget: 'Target.md',
        displayText: 'Target',
      },
      {
        syntax: 'markdown',
        kind: 'link',
        rawTarget: 'Target.md#Heading',
        displayText: 'Section',
      },
      {
        syntax: 'markdown',
        kind: 'embed',
        rawTarget: 'assets/image.png',
        displayText: 'Alt',
      },
      {
        syntax: 'markdown',
        kind: 'link',
        rawTarget: 'Target Name.md',
        displayText: 'Spaced',
      },
      {
        syntax: 'markdown',
        kind: 'link',
        rawTarget: 'A&B.md',
        displayText: 'Entity',
      },
    ]);
  });

  it('shields code and comments while retaining nested-container links', () => {
    const source = [
      '`[[Inline code]]`',
      '\\[[Escaped]]',
      '',
      '```text',
      '[[Fenced code]]',
      '%% in code, not a comment %%',
      '```',
      '',
      '%%',
      '[[Commented]]',
      '[Markdown commented](Hidden.md)',
      '%%',
      'Inline %% [[Inline commented]] %% [[Inline real]]',
      '> [!info]',
      '> See [[Quoted]]',
      '- *See [[Listed]]*',
      '## Compare [[A]] and [[B]]',
    ].join('\n');
    const result = parse(source);

    expect(result.references.map(({ rawTarget }) => rawTarget)).toEqual([
      'Inline real',
      'Quoted',
      'Listed',
      'A',
      'B',
    ]);
    expect(result.structure.sections[0]?.title).toBe('Compare [[A]] and [[B]]');
  });

  it('keeps duplicate reference occurrences at distinct exact spans', () => {
    const source = '[[Target]] then [[Target]]';
    const result = parse(source);

    expect(result.references).toHaveLength(2);
    expect(
      result.references.map(({ sourceSpan }) => sourceSpan.start.offset),
    ).toEqual([0, 16]);
  });

  it('extracts exact block markers conservatively and diagnoses ambiguity', () => {
    const result = parse(blocksFixture, 'obsidian-blocks/A.md');

    expect(result.blockAnchors.map(({ blockId }) => blockId)).toEqual([
      'abc-123',
      'standalone',
      'same',
      'same',
    ]);
    expect(
      result.blockAnchors.map(({ markerSpan }) =>
        blocksFixture.slice(markerSpan.start.offset, markerSpan.end.offset),
      ),
    ).toEqual(['^abc-123', '^standalone', '^same', '^same']);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'invalid-block-id',
      'duplicate-block-id',
    ]);
    expect(result.blockAnchors[0]).not.toHaveProperty('blockSpan');
  });

  it('diagnoses malformed links, invalid block targets, and search shortcuts', () => {
    const source = [
      '[[## heading]]',
      '[[^^block]]',
      '[[Target#^bad_id]]',
      '[[broken',
    ].join('\n');
    const result = parse(source, 'Broken.md');

    expect(result.references).toEqual([]);
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'unsupported-search-shortcut',
      'unsupported-search-shortcut',
      'invalid-block-id',
      'unterminated-wikilink',
    ]);
    expect(
      result.diagnostics.every(({ message }) => message.includes('Broken.md')),
    ).toBe(true);
  });

  it('diagnoses an unclosed comment and shields the remaining source', () => {
    const result = parse('[[Before]]\n%% comment\n[[After]]', 'Comment.md');

    expect(result.references.map(({ rawTarget }) => rawTarget)).toEqual([
      'Before',
    ]);
    expect(result.diagnostics[0]?.code).toBe('unterminated-comment');
  });

  it('preserves CRLF, Unicode, and original UTF-16 source coordinates', () => {
    const source = '😀 [[Café#Résumé|✨]]\r\n^id';
    const result = parse(source, 'Unicode.md');
    const link = reference(result.references, 0);
    const anchor = result.blockAnchors[0];

    expect(link.sourceSpan).toEqual({
      start: { line: 1, column: 4, offset: 3 },
      end: { line: 1, column: 21, offset: 20 },
    });
    expect(sourceSlice(source, link)).toBe('[[Café#Résumé|✨]]');
    expect(anchor?.markerSpan.start).toEqual({
      line: 2,
      column: 1,
      offset: 22,
    });
    expect(anchor?.markerSpan.end.offset).toBe(source.length);
  });

  it('covers the link fixture and remains plain JSON data', () => {
    const result = parse(linksFixture, 'obsidian-links/A.md');
    const roundTripped: unknown = JSON.parse(JSON.stringify(result));

    expect(result.references.map(({ rawTarget }) => rawTarget)).toEqual([
      'B',
      'B#Details',
      '#Local',
      'asset.png',
      'B.md#Details',
    ]);
    expect(roundTripped).toEqual(result);
    expect(JSON.stringify(result)).not.toContain('position');
    expect(JSON.stringify(result)).not.toContain('canonical');
  });
});
