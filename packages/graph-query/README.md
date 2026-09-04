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
- `src/managed-exclusions.ts` owns shared top-level `AND` traversal and bounded
  canonical regeneration for UI-managed exclusions.
- `src/exact-path-exclusions.ts` composes, lists, and removes global exact-path
  exclusion terms.
- `src/folder-exclusions.ts` does the same for exact folder-subtree terms and
  avoids adding descendants already covered by a managed ancestor.
- `src/index.ts` exposes the public package contract.

The v1 grammar requires explicit `AND` / `OR` / `NOT`, with precedence
`NOT` > `AND` > `OR`. Predicates are `path`, `folder`, `title`, `text`, `kind`, and
section-only `level`; entity-kind shorthands are also accepted. Query length,
AST size, and nesting are bounded by exported constants. String search is
case-insensitive. `text` means canonical source path or section title, not
Markdown body content.

`path:"Notes"` retains the original case-insensitive path-contains behavior.
`path="Notes/Foo.md"` instead compares the canonical workspace-relative source
path exactly and case-sensitively. Exact paths must use forward slashes, cannot
be absolute, and cannot contain empty, `.` or `..` segments. Canonical formatting
always quotes them.

`folder="Notes"` compares exact, case-sensitive canonical folder identity and
matches entities sourced directly in `Notes` or any path-segment descendant.
It does not match `Notes-old` or `Archive/Notes`. `folder="."` matches every
source-backed canonical entity. Folder queries remain path-semantic as files
move or folders are renamed; the query text is never rewritten automatically.

The exclusion helpers accept a current query or no query and manage only exact
clauses shaped as `NOT path="..."` or `NOT folder="..."` in the expression's
top-level `AND` chain. File and folder operations preserve each other and all
other terms in order, ignore clauses nested in arbitrary Boolean branches, and
return explicit issues instead of emitting a query that violates normal QUERY1
bounds.
