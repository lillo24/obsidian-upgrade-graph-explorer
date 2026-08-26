# Obsidian Syntax Adapter

Status: **STABLE — KG3 tested syntax subset is fixture-backed.**

This package interprets the Obsidian source syntax needed by the explorer for
one already-normalized workspace-relative Markdown path and its original source
string. It produces serializable parser IR for KG4 without reading files,
resolving targets, assigning canonical IDs, or depending on the Obsidian app.

Dependency direction remains inward:

```text
adapter-obsidian → parser-markdown → core
```

## File map

```text
packages/adapter-obsidian/
  package.json       Pinned frontmatter, YAML, and Markdown dependencies.
  tsconfig.json      Strict framework-independent TypeScript settings.
  src/
    index.ts         Intentional public exports.
    types.ts         Serializable source-adapter contract.
    parse.ts         Frontmatter-aware public parse entry point.
    frontmatter.ts   Validated document-alias extraction.
    syntax.ts        AST-ranged references, comments, and block markers.
    targets.ts       Unresolved file/heading/block target decomposition.
    source-index.ts  Original UTF-16 offset-to-line conversion.
    index.test.ts    Synthetic syntax, diagnostic, and provenance cases.
```

## Public contract

```ts
parseObsidianDocument({ path, source }): ParsedObsidianDocument
```

The result contains:

- `structure`: the exact KG2 document/section contract derived through the
  shared mdast integration subpath;
- `metadata`: validated, ordered document aliases and the leading frontmatter
  span when present;
- `references`: unresolved source occurrences with link/embed kind,
  wikilink/Markdown syntax, full syntax span, raw target, decomposed target, and
  optional display text;
- `blockAnchors`: explicit block IDs and exact marker spans, without guessed
  content extents;
- `diagnostics`: actionable adapter syntax problems with source spans.

Every result is plain data. Lines and columns are 1-based; offsets are 0-based
JavaScript UTF-16 code units; spans are half-open and index the original source
without newline normalization.

## Supported subset

KG3 supports leading YAML frontmatter and string-list `aliases`; file,
same-file heading, cross-file heading, multi-heading, and block-target
wikilinks; `|` display text; `!` embeds; local standard Markdown links and
images; links inside headings, emphasis, lists, quotes, and callouts; inline and
multiline `%%` comment shielding; code/HTML/frontmatter shielding; and explicit
block markers containing Latin letters, numbers, and dashes.

Obvious external Markdown schemes and protocol-relative URLs are omitted from
the internal-reference list. Markdown reference-style links are not expanded.
For wikilinks, `rawTarget` is the exact text before `|`. For Markdown links, it
is mdast's CommonMark-parsed destination: escapes and character references are
decoded, percent encoding is retained, and the full syntax spelling remains
available through `sourceSpan`.
Malformed YAML yields empty aliases plus an error diagnostic while trustworthy
structure and body references remain available. Duplicate aliases keep their
first occurrence. Duplicate block markers are all preserved and diagnosed.
Unterminated comments shield the remaining source and produce a warning.

## Deliberate limits

This is not a claim of full Obsidian compatibility. KG3 does not interpret
tags, properties beyond aliases, deprecated scalar `alias` forms, footnotes,
Canvas, URI links, or embed display/size semantics. Persisted `[[##...]]` and
`[[^^...]]` editor search shortcuts are diagnosed rather than treated as
durable targets.

The adapter does not append extensions, decode or case-fold wikilink targets,
resolve aliases or same-named notes, match headings or blocks, select reference
owners, create canonical entities/references, or assemble snapshots. Those
operations belong to KG4.

## Parser strategy

Frontmatter uses `micromark-extension-frontmatter` and
`mdast-util-frontmatter`, then `yaml` validates the alias property. Standard
Markdown links come directly from mdast. An adapter-owned lexical scanner runs
only over AST-approved text ranges for Obsidian wikilinks and comments. This
matches Obsidian's tested `|`, heading, block, and embed forms without adopting
older wiki-link packages with a different grammar.

The new frontmatter dependencies are pinned to
`micromark-extension-frontmatter` 2.0.0 (MIT), `mdast-util-frontmatter` 2.0.1
(MIT), and `yaml` 2.9.0 (ISC). The adapter directly reuses the repository's
pinned `mdast-util-from-markdown` 2.0.3 and `mdast-util-to-string` 4.0.0 parser
line.

## Local validation

Run from the repository root:

```bash
pnpm --filter @icarus-graph-explorer/adapter-obsidian typecheck
pnpm exec vitest run packages/adapter-obsidian
pnpm check
```
