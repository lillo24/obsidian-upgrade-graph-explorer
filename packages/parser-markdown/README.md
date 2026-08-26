# Markdown Structural Parser

Status: **STABLE — KG2 CommonMark structure contract is fixture-backed.**

This package owns the pure transformation from one already-normalized
workspace-relative path plus Markdown source text into source-neutral document
and section structure. It depends inward on `@icarus-graph-explorer/core` only
for established path and span types.

## File map

```text
packages/parser-markdown/
  package.json       Pinned parser dependencies and package export.
  tsconfig.json      Strict framework-independent TypeScript settings.
  src/
    index.ts         Intentional public exports.
    mdast.ts         Narrow source-adapter integration subpath.
    types.ts         Serializable parser intermediate representation.
    parse.ts         CommonMark source-to-mdast entry point.
    structure.ts     Shared mdast-to-heading-tree derivation.
    index.test.ts    Parser semantics, positions, failures, and fixture tests.
```

`parse.ts` and `structure.ts` are separate so a package-owned syntax entry can
feed an extended mdast tree through the same hierarchy algorithm. The ordinary
package entry point does not return or expose mdast.

## Public contract

```ts
parseMarkdownDocument({ path, source }): ParsedMarkdownDocument
```

Callers supply source text directly and are responsible for passing a path that
already follows core's normalized workspace-path convention. The parser does
not read files, normalize paths or line endings, assign canonical IDs, or
assemble workspace snapshots.

The returned document contains its full source span and a nested array of
root-level Markdown sections. Every section contains:

- a human-readable title extracted from inline Markdown;
- the Markdown heading level;
- `headingSpan`, covering only the ATX or Setext heading construct;
- `span`, covering the heading through descendants until the next same/higher
  heading or EOF;
- nested child sections derived from the nearest open lower-level heading.

Preamble content remains document-level. Duplicate and empty titles are valid,
and skipped levels do not create synthetic sections. All points follow core's
1-based line/column, 0-based UTF-16 offset, half-open span convention.

## Markdown scope

KG2 parses base CommonMark through `mdast-util-from-markdown` 2.0.3 and extracts
titles through `mdast-util-to-string` 4.0.0. Only heading nodes that are direct
children of the mdast root define sections, so fences and block quotes do not
create false sections.

Frontmatter, wikilinks, embeds, aliases, block IDs, references, identity
assignment, and resolution are not part of this entry point. In particular,
frontmatter-looking text is interpreted as ordinary CommonMark here and can
form a Setext heading. `@icarus-graph-explorer/adapter-obsidian` supplies
frontmatter handling before reusing structure derivation.

## Adapter integration subpath

Source-adapter packages that already own an mdast root may import:

```ts
import { deriveMarkdownStructureFromMdast } from '@icarus-graph-explorer/parser-markdown/mdast';
```

This dedicated subpath is parser-integration infrastructure. It exists so
extended syntax can share the exact KG2 hierarchy and span algorithm without
duplicating it or changing CommonMark behavior. It is not canonical domain API,
and the mdast tree never appears in `ParsedMarkdownDocument`.

## Local validation

Run from the repository root:

```bash
pnpm --filter @icarus-graph-explorer/parser-markdown typecheck
pnpm exec vitest run packages/parser-markdown
pnpm check
```
