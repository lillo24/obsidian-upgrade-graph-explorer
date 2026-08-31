# Graph Query

Status: **STABLE — QUERY1 grammar and evaluation contract.**

This package owns the bounded, source-neutral graph-query language. It parses
user text into a closed typed expression, formats deterministic canonical query
strings, and evaluates those expressions against canonical addressable
entities. It does not project a graph, read source bodies, access storage, or
own React state.

## File map

- `src/types.ts` defines the closed expression, issue, and parse-result types.
- `src/parser.ts` tokenizes and parses the bounded v1 grammar without throwing.
- `src/format.ts` emits deterministic canonical query strings.
- `src/evaluate.ts` evaluates one parsed expression using one fact extraction
  per canonical entity.
- `src/index.ts` exposes the public package contract.

The v1 grammar requires explicit `AND` / `OR` / `NOT`, with precedence
`NOT` > `AND` > `OR`. Predicates are `path`, `title`, `text`, `kind`, and
section-only `level`; entity-kind shorthands are also accepted. Query length,
AST size, and nesting are bounded by exported constants. Query matching is
case-insensitive. `text` means canonical source path or section title, not
Markdown body content.
