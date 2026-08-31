# QUERY1 — Graph Query Language + Saved Filters

**Task type:** source-neutral query engine / KG6 entity filtering / workspace-local saved query presets / filter UX / persistence / NAV1 integration

## Goal

Add a deterministic **graph entity query language** supporting Boolean rules:

```text
AND
OR
NOT
(...)
```

with predicates such as:

```text
path:"Language"
title:"Associated Value"
sections
blocks
kind:document
level<=2
```

so a user can write:

```text
(path:"Language" OR path:"Symbols") AND sections AND NOT path:"Archive"
```

and apply it as an additional graph filter.

QUERY1 must also provide **named Saved Filters** for stable workspaces.

The architectural goal is larger than the textbox: create one reusable, source-neutral typed query engine that later milestones can reuse for:

```text
GROUP1 — Visual Groups + Color Rules
LAYOUT1 — optional grouping by Visual Group
```

Do not implement groups or clustering in this milestone.

---

# Product model

QUERY1 introduces one new filter dimension:

```text
Advanced query
```

The existing controls remain:

```text
Path Scope
Entity Content
Blocks
Heading limit
Reference Status
```

The final filter model is:

```text
existing simple entity filters
AND
advanced query
```

Reference Status remains its existing independent edge/status filter.

The common UI stays simple; Boolean syntax is opt-in.

---

# Important scope boundary — query v1 selects canonical entities

The v1 query language is deliberately an **entity rule language**.

It matches canonical:

```text
Document
Section
Block
```

attributes.

It does not directly query:

```text
reference edges
diagnostic target nodes
graph topology
incoming/outgoing link counts
reference resolution status
arbitrary Markdown body text
Obsidian-only metadata
```

The existing **Reference Status** control remains the supported v1 way to filter:

```text
resolved
unresolved
ambiguous
invalid
```

This is intentional. A Boolean expression such as:

```text
path:"Language" OR status:unresolved
```

has unclear cross-domain semantics because one side selects entities while the other selects relationships/diagnostic targets.

Design the AST for extension, but do not invent ambiguous mixed-domain semantics in QUERY1.

---

# Important scope boundary — query level is not Heading limit

The query language may match a Section's canonical literal heading level:

```text
level:2
level<=3
```

This is a **post-disclosure entity predicate**.

It is not the same thing as:

```text
Filters → Heading limit
```

Heading limit remains a structural eligibility ceiling applied before endpoint roll-up.

Therefore:

```text
level<=2
```

must not silently set:

```text
maxSectionLevel = 2
```

and must not change endpoint roll-up semantics.

---

# Important scope boundary — query `blocks` does not enable Blocks

Example:

```text
blocks AND path:"Ideas"
```

means:

```text
among Blocks already structurally eligible/visible,
retain matching Blocks
```

It does not change:

```text
disclosure.includeBlocks
```

and it does not expand Block parents.

DISC1 / STRUCT1 Block semantics stay intact.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

STRUCT1 merged through PR #31.

At prompt-writing time current `main` is:

```text
016bb43e673eba55abf0f2207edfe8692e03d802
```

Current KG6 filter contract is:

```ts
interface ViewProjectionFilters {
  pathPrefixes?
  text?
  entityKinds?
  referenceStatuses?
}
```

Current execution order is:

```text
canonical snapshot
→ structural disclosure
→ base projection / endpoint roll-up
→ Focus
→ applyFilters(...)
→ renderer
```

Current `applyFilters()` already:

- retains matching content entities;
- adds visible structural ancestors as `context`;
- keeps resolved reference edges only when both endpoints remain content;
- retains diagnostic targets through eligible source/reference rules;
- handles Reference Status separately;
- never reroutes relationships after ordinary filtering.

Current simple entity matching supports:

```text
Path Scope
Entity Content
case-insensitive projected text over path/title
```

Current Structure/Heading/Blocks semantics live outside ordinary entity filters.

Current `GraphFilters` is a temporary floating/contained panel with:

```text
Path Scope
Entity Content
Heading limit
Reference Status
```

Current NAV1 records filter changes as complete `ViewProjectionState` checkpoints.

Current KG9 schema-v1 persists optional:

```text
pathPrefixes
entityKinds
referenceStatuses
```

but intentionally does not persist transient `filters.text`.

Current Search/Inspector entity navigation widens conflicting:

```text
path
entity kind
projected text
```

filters to reveal an explicitly selected canonical target.

Current saved-view storage is workspace-keyed app storage and never writes to the vault.

---

# Required first step

Before editing:

1. sync/rebase onto actual latest `main`;
2. inspect whether work landed after STRUCT1;
3. read:
   - `AGENTS.md`;
   - `packages/core/src/model/entities.ts`;
   - `packages/view-projection/README.md`;
   - `packages/view-projection/package.json`;
   - `packages/view-projection/src/types.ts`;
   - `packages/view-projection/src/slicing.ts`;
   - `packages/view-projection/src/project.ts`;
   - `packages/view-projection/src/workspace.ts`;
   - filter/focus/disclosure tests;
   - `packages/view-state/README.md`;
   - `packages/view-state/src/types.ts`;
   - `packages/view-state/src/validation.ts`;
   - `packages/view-state/src/persist.ts`;
   - `packages/view-state/src/restore.ts`;
   - `apps/web/src/graph-state.ts`;
   - `apps/web/src/navigation.ts`;
   - `apps/web/src/navigation-history.ts`;
   - `apps/web/src/persistence/storage.ts`;
   - `apps/web/src/components/GraphFilters.tsx`;
   - `apps/web/src/components/graph-filter-count.ts`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - relevant web tests;
   - architecture/import-boundary lint rules;
   - KG12 performance scenarios;
4. preserve:
   - DISC1 actionable disclosure;
   - STRUCT1 structural depth;
   - NAV1 history;
   - UX4B Filter containment;
   - UX4C node/focus behavior;
   - KG9 saved-view safety;
   - KG12 worker/layout boundaries;
5. run the current graph/filter sample before editing.

If latest `main` differs materially, preserve current architecture and implement intent rather than restoring stale assumptions.

---

# Part 1 — Create a reusable source-neutral graph-query package

Preferred architecture:

```text
packages/graph-query/
```

package name:

```text
@icarus-graph-explorer/graph-query
```

Dependencies:

```text
@icarus-graph-explorer/core
```

External dependencies:

```text
none
```

This package owns:

```text
typed AST
tokenizer/parser
canonical formatter
query validation
canonical-entity evaluation
```

It must not know:

```text
ViewProjection
React
React Flow
web storage
Obsidian
Tauri
layout
Saved Filters UI
```

Target dependency direction:

```text
core
  ↑
graph-query
  ↑
view-projection

web ─────────→ graph-query

future GROUP1 ─→ graph-query
```

Do not bury parsing in `GraphFilters.tsx`.

If import-boundary lint rules currently permit `view-projection` to depend only on `core`, minimally update them to allow:

```text
view-projection → graph-query → core
```

Continue rejecting renderer/web/source/platform imports from source-neutral packages.

---

# Part 2 — Typed AST

Use a closed discriminated union, conceptually:

```ts
export type GraphQueryExpression =
  | { type: 'and'; left: GraphQueryExpression; right: GraphQueryExpression }
  | { type: 'or'; left: GraphQueryExpression; right: GraphQueryExpression }
  | { type: 'not'; operand: GraphQueryExpression }
  | GraphQueryPredicate;
```

Predicates should be typed variants, not generic strings:

```ts
type GraphQueryPredicate =
  | { type: 'path'; value: string }
  | { type: 'title'; value: string }
  | { type: 'text'; value: string }
  | { type: 'kind'; kind: EntityKind }
  | {
      type: 'level';
      operator: 'eq' | 'lte' | 'gte';
      level: 1 | 2 | 3 | 4 | 5 | 6;
    };
```

Exact names may differ.

Do not use:

```ts
{ field: string; operator: string; value: unknown }
```

as the main AST contract.

Future predicate additions should be exhaustiveness-checked.

---

# Part 3 — Grammar

Support explicit:

```text
AND
OR
NOT
(...)
```

Keywords are case-insensitive.

Precedence:

```text
NOT > AND > OR
```

Therefore:

```text
A OR B AND C
```

means:

```text
A OR (B AND C)
```

and:

```text
NOT A AND B
```

means:

```text
(NOT A) AND B
```

Parentheses override precedence.

Conceptual grammar:

```text
expression       := or_expression
or_expression    := and_expression ("OR" and_expression)*
and_expression   := unary_expression ("AND" unary_expression)*
unary_expression := "NOT" unary_expression | primary
primary          := "(" expression ")" | predicate | kind_alias
```

A small recursive-descent or Pratt parser is sufficient.

No parser generator dependency.

---

# No implicit AND

Require:

```text
path:"Language" AND sections
```

Do not silently treat:

```text
path:"Language" sections
```

as AND.

---

# Commas do not mean OR

Reject:

```text
path:"Language", path:"Symbols"
```

with useful feedback such as:

```text
Unexpected ",". Use OR between alternatives.
```

Do not invent comma semantics.

---

# Part 4 — Predicate semantics

## `path:`

Example:

```text
path:"Language"
path:"Archive/Old"
```

Semantics:

```text
case-insensitive substring match
against canonical workspace-relative source path
```

So `path:"Language"` may match:

```text
Language.md
Ideas/Language.md
Language/Grammar.md
```

This intentionally differs from simple **Path Scope**, which keeps its current exact/folder-prefix behavior.

Do not change Path Scope semantics for unification.

---

## `title:`

Example:

```text
title:"Associated Value"
```

Semantics:

```text
case-insensitive substring of canonical SectionEntity.title
```

Documents have no canonical title field in `core`.

Blocks have no canonical title field in `core`.

Therefore `title:` returns false for Documents and Blocks.

Do not invent a canonical Document title from renderer display conventions.

Use `path:` for filenames.

---

## `text:`

Example:

```text
text:"grammar"
```

Semantics:

```text
canonical source path contains text
OR
canonical Section title contains text
```

It does not search Markdown body text.

It does not search diagnostic raw targets.

It is separate from Global Find/Search.

---

## `kind:`

Required canonical values:

```text
kind:document
kind:section
kind:block
```

Accept:

```text
kind:file
```

as an input alias for `kind:document`.

Unknown kinds are parse errors.

---

# Kind shorthand

Accept standalone:

```text
files
documents
sections
blocks
```

Prefer also singular:

```text
file
document
section
block
```

Canonical formatting may normalize aliases to:

```text
kind:document
kind:section
kind:block
```

This makes the intended rule readable:

```text
(path:"Language" OR path:"Symbols") AND sections AND NOT path:"Archive"
```

---

## `level`

Support literal canonical Section heading level:

```text
level:1
level:2
...
level:6
```

Also support:

```text
level<=3
level>=2
```

`level=3` may alias `level:3`.

Only Sections match `level` predicates.

Documents/Blocks return false.

Optionally support:

```text
level:#
level:##
...
```

if clean; canonical output should remain one stable form.

---

# String literals

Quoted strings support at least:

```text
\"  quote
\\  backslash
```

Reject unterminated strings and malformed escapes.

Simple unquoted values are allowed where unambiguous:

```text
kind:section
level:2
```

Paths/titles containing spaces should require quotes.

No shell globbing.

---

# Part 5 — Explicitly unsupported QUERY1 syntax

Do not implement:

```text
regex
wildcards
fuzzy matching
semantic search
body-content search
frontmatter/metadata
tags
link count
degree
incoming/outgoing predicates
reference status predicates
ancestor/descendant functions
saved-filter references inside query
variables
macros
comments
```

Unknown fields are errors, not ignored.

---

# Part 6 — Parse result and diagnostics

User input must not throw.

Use a result type conceptually:

```ts
type GraphQueryParseResult =
  | {
      ok: true;
      expression: GraphQueryExpression;
      canonical: string;
    }
  | {
      ok: false;
      issues: readonly GraphQueryParseIssue[];
    };
```

Issues should include positions:

```ts
interface GraphQueryParseIssue {
  code: ...;
  message: string;
  start: number;
  end: number;
}
```

Distinguish at least:

```text
unexpected token
unexpected end
unterminated string
invalid escape
unknown field
invalid kind
invalid level
missing operand
unbalanced parentheses
query too long
query too complex
```

Suggested safety limits:

```text
max source length: 4096 chars
max AST nodes: 256
max nesting depth: 32
```

Exact nearby values are acceptable if justified.

No unbounded recursion from persisted input.

---

# Part 7 — Canonical formatting

Provide deterministic formatting/canonicalization.

Goals:

```text
SECTIONS
→ kind:section

kind:file
→ kind:document

aNd
→ AND
```

Use parentheses only where required by precedence.

String escaping must round-trip.

Required invariant:

```text
parse(format(parse(source).expression))
→ equivalent AST
```

and canonicalization should be idempotent.

Do not algebraically simplify/reorder Boolean expressions.

No:

```text
A AND A → A
De Morgan rewrite
sorting OR branches
```

Canonicalization is syntactic normalization only.

---

# Part 8 — Entity evaluator

Expose a pure evaluator or compiler:

```ts
matchesGraphQuery(entity, expression)
```

or:

```ts
compileGraphQuery(expression)
```

It operates on canonical `AddressableEntity` only.

Short-circuit Boolean evaluation.

Normalize string facts deterministically.

Avoid repeatedly lowercasing the same path/title for every leaf predicate; build internal facts once per entity if useful.

Do not add global unbounded caches.

---

# Part 9 — Integrate query into ViewProjectionFilters

Add:

```ts
interface ViewProjectionFilters {
  ...
  readonly query?: string;
}
```

Normal application paths should store the canonical query string.

Do not put AST objects directly into `ViewProjectionState`.

Reasons:

- compact/plain JSON;
- simple NAV1 equality;
- readable persistence;
- Saved Filters use the same representation;
- future GROUP1 can parse the same canonical rule.

---

# Invalid externally constructed query state

KG6 may receive manually constructed state.

`applyFilters()` must handle malformed `filters.query` deterministically.

Preferred policy:

```text
invalid active query
→ projection issue `invalid-query`
→ fail closed for query-selected entity content
```

Do not silently ignore the invalid query and broaden the graph.

Normal UI should never commit invalid syntax.

Parse once per filter pass, never once per entity.

---

# Part 10 — Query combines with existing filters

Final entity eligibility adds:

```text
Path Scope
AND
Entity Content
AND
projected text (if present)
AND
Advanced query
```

Reference Status remains its existing independent edge/status restriction.

Preserve current ancestor-context behavior:

```text
matching deep entity → content
required structural ancestors → context
```

Ancestors do not need to match the query.

Do not change current reference-edge topology rules.

---

# Focus interaction

Focus remains applied before ordinary filters/query.

Therefore:

```text
Focus neighborhood
AND
Advanced query
```

produces the final content set, with required structural context retained.

Do not make query change Focus traversal semantics.

---

# DISC1 interaction

DISC1 finalizes actionable disclosure counts against entity visibility filters.

Advanced query must participate.

Required:

```text
query excludes all candidate descendants
→ revealableDescendantCount = 0
→ no false disclosure control
```

Do not regress `› N` actionability.

---

# STRUCT1 interaction

Advanced query does not mutate:

```text
defaultDepth
maxSectionLevel
includeBlocks
expanded/collapsed IDs
```

It only filters final entity content.

---

# Part 11 — Do not rewrite all simple filters

QUERY1 should establish one reusable advanced rule engine, but do not force every historical filter through the AST if it risks semantic drift.

It is acceptable for Path Scope / Entity Content / projected text to retain their specialized state and be ANDed with the advanced query.

In particular:

```text
Path Scope prefix semantics
≠
path: substring semantics
```

Do not change one merely to compile everything into one AST.

Future cleanup can unify safe pieces later.

---

# Part 12 — Web state action

Add:

```ts
{
  type: 'set-query';
  query: string | null;
}
```

Non-null value is canonical syntax.

Reducer:

```text
null → remove filters.query
string → set filters.query
```

Preserve disclosure, Focus, and all other filters.

Any code checking whether a filters object is empty must now include `query`.

Repository-search all such checks.

---

# Part 13 — NAV1

`set-query` is a history-producing semantic graph action.

Update exhaustive history policy.

History equality must include:

```text
filters.query
```

Required sequence:

```text
none
→ Apply A
→ Apply B
→ Clear

Back → B
Back → A
Forward → B
```

Applying the same canonical query is a no-op and must not clear Forward history.

Draft typing is transient and must not:

- dispatch graph state;
- project;
- layout;
- create NAV1 checkpoints;
- autosave the active view.

---

# Part 14 — KG9 active-query persistence

The **active advanced query** is part of the current graph view for stable workspaces.

Extend schema-v1 optional persisted filters with:

```text
query
```

Preferred:

```text
schemaVersion remains 1
```

because the field is optional and old records remain valid.

No storage-key migration.

Persisted query must be a string and parse within complexity limits.

Malformed stored query is incompatible and must not execute.

Old schema-v1 records without query remain valid.

STRUCT1 depth 2/3 records remain valid.

Same-workspace live reconciliation preserves query even when it currently matches zero entities.

Reset clears active query but **does not delete named Saved Filters**.

---

# Part 15 — Search / Inspector navigation

Current explicit entity navigation widens conflicting filters.

Add query handling.

Evaluate active query against the canonical target.

If target matches:

```text
keep query
```

If target does not match:

```text
clear active advanced query
announce that it was cleared to reveal the target
```

Do not algebraically rewrite arbitrary Boolean expressions to include one target.

Add a navigation change type such as:

```text
advanced-query-cleared
```

with concise user-facing announcement.

NAV1 Back naturally restores the previous query.

---

# Part 16 — Advanced query UI

Add an **Advanced query** section inside the existing Graph Filters panel.

Do not create a new persistent toolbar/sidebar.

Use a small labelled textarea because Boolean rules may wrap.

Conceptually:

```text
Advanced query

[ (path:"Language" OR path:"Symbols") AND sections ... ]

[Apply] [Clear]

<syntax feedback>

Saved Filters
...
```

Use one neutral placeholder/example, not private vault names.

---

# Query draft state

The editor is local transient state.

Recommended:

- opening Filters initializes draft from active query;
- successful Apply replaces draft with canonical query;
- Clear empties active query/draft;
- NAV1/persistence changes to active query update draft when draft is not dirty;
- do not overwrite unsaved edits while typing.

Track dirty state if needed.

---

# Apply behavior

On Apply:

1. trim draft;
2. empty draft behaves like Clear;
3. parse/canonicalize;
4. invalid:
   - show inline error;
   - graph unchanged;
   - no history;
   - Filters stays open;
5. valid:
   - dispatch `set-query` with canonical string;
   - clear error;
   - update draft to canonical string.

Optional Ctrl/Meta+Enter Apply is acceptable only if tested safely.

Do not live-project on every keystroke.

---

# Clear behavior

If active query exists:

```text
Clear → one set-query:null history action
```

If no active query exists, clearing only local draft must not create graph history.

---

# Query feedback

Use concise positioned feedback, e.g.:

```text
Unexpected ")" at character 38.
```

No stack traces.

Use labelled/associated accessibility:

```text
aria-describedby
aria-invalid
```

Do not spam assertive announcements on every character.

---

# Part 17 — Saved Filters semantics

In QUERY1 a **Saved Filter** stores only:

```text
name
canonical advanced query
```

It does **not** store:

```text
Structure depth
Heading limit
Blocks choice
Path Scope dropdown
Entity Content checkboxes
Reference Status
Focus
viewport
selection
Inspector state
```

This is deliberate: the saved object is a reusable entity rule, which GROUP1 can later reuse without importing graph-view state.

Simple controls remain independent and AND with an applied Saved Filter.

---

# Part 18 — Saved Filter registry storage

Create a separate web-layer registry.

Do not add Saved Filters to:

```text
PersistedWorkspaceView
ViewProjectionState
canonical snapshot
vault files
```

Preferred record:

```ts
interface SavedGraphFiltersRecord {
  schemaVersion: 1;
  workspaceId: string;
  filters: readonly SavedGraphFilter[];
}

interface SavedGraphFilter {
  name: string;
  query: string;
}
```

No timestamp required.

No renderer data.

---

# Workspace scope

Saved Filters are workspace-specific.

Storage key derives from stable:

```text
workspaceId
```

not filesystem path, vault basename, or report filename.

Same stable workspace → same registry.

Different workspace → separate registry.

Same-workspace live updates → registry unchanged.

---

# Stability eligibility

Cross-session Saved Filter persistence uses the existing stable-workspace principle.

For stable identity + writable app storage:

```text
Saved Filters persist
```

For unstable/transient reports:

```text
Advanced query still works
Saved Filter persistence unavailable
```

Do not write under guessed unstable identity.

Provide concise disabled explanation.

---

# Registry storage key

Use a separate explicit prefix such as:

```text
icarus-graph-explorer:saved-filters:<encoded workspace id>
```

Do not reuse KG9 current-view key.

---

# Saved Filter validation

Validate on load:

```text
schemaVersion == 1
workspaceId non-empty
filters array
valid name
query parses
names unique
bounded count
```

Suggested limits:

```text
max filters per workspace: 50
name length: 1–64 trimmed chars
query length: parser limit
```

Names are unique case-insensitively after trim.

These should conflict:

```text
Language
language
 LANGUAGE
```

Preserve display capitalization.

Sort deterministically.

---

# Saved Filter lifecycle

Minimum lifecycle:

```text
Save
Apply
Delete
```

No rename UI required in QUERY1.

Rename can be save-new + delete-old.

Do not silently overwrite an existing name.

Duplicate name → clear validation message.

---

# Storage failure policy

If registry loading fails:

- do not overwrite corrupt data;
- show concise warning;
- Advanced query still works.

If Save/Delete write fails:

- report failure;
- do not claim durable success;
- retain last confirmed registry state where practical;
- graph remains usable.

Follow current storage failure conventions.

---

# Reset interaction

`Reset saved view`:

```text
clears active query
keeps Saved Filters
```

Saved Filter deletion is separate.

---

# Part 19 — Saved Filters UI

Inside Advanced query section, a compact design such as:

```text
Saved Filters

Name [________________] [Save current]

Language notes       [Apply] [Delete]
Research sections    [Apply] [Delete]
```

Exact layout may differ.

`Save current` uses the **active successfully applied query**, not invalid draft text.

If there is no active query:

```text
Save current disabled
```

Workflow:

```text
type
Apply
name
Save current
```

---

# Apply Saved Filter

Applying a Saved Filter:

```text
sets only filters.query
leaves all simple controls unchanged
```

It is one NAV1 semantic action if query differs.

Update draft to saved canonical query.

Keep Filters panel open.

---

# Delete Saved Filter

Delete removes only the preset definition.

It does not:

- change active query;
- change graph state;
- create NAV1 history.

If deleted preset's query is currently active, the graph keeps using the active query until user changes it.

---

# Part 20 — Active filter badge

Current badge counts visible filter groups.

Add:

```text
active advanced query → +1 group
```

Saved definitions do not count.

Draft text does not count until Apply.

One Boolean query = one group, regardless of clause count.

---

# Part 21 — Responsive containment

At:

```text
390
600
768
1000
1440
```

ensure:

- no horizontal page scroll;
- textarea shrinks/wraps;
- long query does not force panel width;
- saved names do not force width;
- buttons wrap cleanly;
- maximized Tools retains one contained vertical scroll owner;
- opening Filters still does not resize graph canvas.

---

# Part 22 — Parser tests

Pure suite must cover:

## Boolean precedence

```text
A OR B AND C
→ A OR (B AND C)

NOT A AND B
→ (NOT A) AND B
```

## Parentheses

Nested grouping.

## Keyword case

```text
and / Or / nOt
```

## Kind aliases

```text
sections
section
kind:section
```

canonicalize equivalently.

## Strings

Spaces, escaped quote, escaped backslash.

## Invalid syntax

At least:

```text
empty operand
double operator
unclosed (
unexpected )
unterminated string
unknown field
invalid kind
level 0
level 7
invalid comparator
comma
trailing token
too-deep expression
too-long query
```

No exception escapes.

---

# Canonicalization tests

Verify:

```text
parse(canonical) succeeds
canonicalization is idempotent
aliases normalize deterministically
precedence formatting is stable
strings round-trip
```

Do not algebraically reorder branches.

---

# Evaluator tests

Use neutral canonical entities.

Cover:

```text
path
title
text
kind
level exact
level <=
level >=
AND
OR
NOT
```

Title/level must return false for unsupported entity kinds.

Evaluator must not mutate entities.

---

# Part 23 — KG6 integration tests

Add tests for:

## Query only

```text
query: kind:section
```

retains Sections as content + required ancestors as context.

## Boolean path query

```text
(path:"alpha" OR path:"beta") AND NOT path:"archive"
```

## Query + simple Path Scope

Both must match.

## Query + Entity Content

Both must match.

## Query + projected text

Both must match.

## Query + Reference Status

Entity query selects content; status continues independent edge filtering.

---

# Query and diagnostics

Advanced query does not directly match diagnostic raw target text.

Diagnostic retention continues through current eligible-source/reference semantics.

---

# Query and Focus

Example:

```text
Focus includes A/B/C
query matches B
```

Expected:

```text
B content
required ancestors context
other Focus content removed
```

Preserve focus-distance metadata for retained content.

---

# Query and DISC1

Create expandable parent whose candidate descendants are structurally eligible but query-excluded.

Expected:

```text
revealableDescendantCount = 0
```

Clear/widen query:

```text
truthful positive count returns
```

Mandatory regression.

---

# Query and Blocks

`blocks` while Blocks disabled:

```text
does not enable/project Blocks
```

Blocks enabled but parent not expanded:

```text
still not projected
```

After explicit expansion:

```text
matching Blocks may appear
```

---

# Query level vs Heading limit

Use H1/H3/H5 hierarchy.

```text
Structure 3
Heading limit No limit
query level<=3
```

H5 is post-filtered.

Then clear query and set Heading limit `###`.

H5 is structurally excluded before roll-up.

Both may look similar but state/processing semantics must remain distinct.

---

# Invalid KG6 query

Manually construct malformed `filters.query`.

Expected:

- no throw;
- `invalid-query` issue;
- no silent broadening.

Document exact fail-closed result.

---

# Part 24 — Web/NAV1 tests

Reducer `set-query`:

- set canonical query;
- clear query;
- preserve disclosure/Focus/other filters;
- normalize empty filters object.

NAV1:

```text
none → A → B → clear
Back / Back / Forward
```

Same canonical query applied twice → second no-op.

Draft typing → no history.

Update every handwritten state/filter equality to include query.

---

# Part 25 — Persistence tests

KG9 tests:

1. old schema-v1 without query valid;
2. valid query round-trips;
3. query survives hydration;
4. depth 3 + query survives hydration;
5. malformed query rejected;
6. over-limit query rejected;
7. valid noncanonical input follows documented normalization policy;
8. live reconciliation retains query;
9. Reset clears active query;
10. schemaVersion remains 1.

---

# Part 26 — Saved Filter registry tests

Use `StorageLike`-style fake storage.

Cover:

1. missing key → empty registry;
2. valid registry load;
3. save round-trip;
4. delete round-trip;
5. workspace key isolation;
6. trim names;
7. case-insensitive duplicate rejection;
8. empty name rejection;
9. overlong name rejection;
10. max count;
11. malformed query rejection;
12. corrupt JSON error without overwrite;
13. incompatible schema error;
14. write exception surfaced;
15. deterministic ordering/serialization.

---

# Part 27 — Navigation tests

Active query matches explicit target:

```text
query preserved
```

Active query excludes target:

```text
query cleared
filterChanges includes advanced-query-cleared
announcement mentions clear
```

NAV1 Back restores prior query.

No algebraic query rewrite.

---

# Part 28 — Browser QA

Use synthetic/private-safe graph.

## Basic

```text
sections
```

Only Section content + required context.

## Boolean

```text
(path:"alpha" OR path:"beta") AND sections
```

then:

```text
(path:"alpha" OR path:"beta") AND sections AND NOT title:"Hidden"
```

## Level

```text
sections AND level<=3
```

Verify canonical levels.

---

# Syntax-error QA

Try:

```text
(path:"alpha"
```

Expected:

- inline error;
- previous active graph unchanged;
- no history;
- no console error.

Try:

```text
path:"alpha", path:"beta"
```

Expected explicit-OR feedback.

---

# Simple-filter composition QA

Set:

```text
Path Scope = folder A
Advanced query = sections AND NOT title:"Draft"
```

Verify AND composition.

Toggle Reference Status: edge semantics remain independent.

Toggle Heading limit: structural ceiling remains independent.

---

# DISC1 / STRUCT1 browser QA

With query excluding hidden descendants:

```text
no false › N
```

Clear query:

```text
actionable count returns
```

Exercise Structure 0–3 without query changing structural depth.

---

# NAV1 browser QA

```text
Apply A
Apply B
Clear
Back
Back
Forward
```

Active graph/query editor follows committed state.

Unsaved draft is not history.

---

# Search navigation browser QA

Apply query excluding a known entity.

Global Find → navigate to it.

Expected:

```text
advanced query cleared
target revealed/centered
announcement explains clear
```

Back restores previous query.

---

# Saved Filters browser QA

Stable workspace:

1. Apply query.
2. Name + Save current.
3. Change/clear active query.
4. Apply saved filter.
5. Reload/remount same stable workspace.
6. Saved Filter still exists.
7. Delete it.
8. Active query remains if same rule was active.

Unstable source:

```text
Advanced query works
Saved Filter persistence disabled with concise explanation
```

---

# Responsive QA

At:

```text
390
600
768
1000
1440
```

normal + maximized:

- textarea contained;
- Saved Filter rows wrap;
- long names/query do not overflow;
- buttons remain usable;
- graph canvas dimensions unchanged by panel opening.

---

# Part 29 — Desktop/live QA

Using synthetic/disposable vault where possible:

1. create/apply query;
2. save named filter;
3. reopen same stable workspace;
4. registry persists;
5. edit source so matches change;
6. live graph recomputes under active query;
7. Saved Filter definition remains;
8. Search to excluded target clears query;
9. Back restores query if compatible with current snapshot;
10. verify no vault file is written for Saved Filters.

Interactive native QA may be reported deferred only if repository/test constraints genuinely prevent it.

---

# Part 30 — Performance posture

QUERY1 adds:

```text
one parser pass per active-query projection
entity rule evaluation
```

It must not add:

```text
parser pass per entity
projection per clause
Dagre run per clause
React state per match
```

With bounded AST:

```text
query evaluation ≈ O(visible entities × AST size)
```

Use short-circuit evaluation and avoid repeated normalization allocations where practical.

STRUCT1 depth 3 materially increases graph size, so benchmark at least one nontrivial query on the existing medium/depth-3 profile.

Preserve existing performance gates.

If a gate fails, optimize evaluation before weakening an existing budget.

No new worker solely for Boolean query matching unless profiling proves necessary.

Saved registry state must not enter projection memo dependencies until a saved rule is actually applied to `filters.query`.

---

# Part 31 — Accessibility

Advanced query editor:

- visible label;
- associated syntax feedback;
- `aria-invalid` when invalid;
- native Apply/Clear buttons;
- labelled Saved Filter name input;
- Saved Filter Apply/Delete controls have clear accessible names.

The textarea is editable, therefore NAV1 Ctrl/Meta+Z must remain native text undo inside it.

Current graph-history shortcut exclusion already covers textarea; do not regress it.

---

# Part 32 — Documentation

Create:

```text
packages/graph-query/README.md
```

Document:

- source-neutral purpose;
- grammar;
- precedence;
- predicates;
- canonicalization;
- entity evaluation;
- unsupported v1 domains;
- complexity limits;
- future GROUP1 reuse boundary.

Update view-projection README for:

```text
filters.query
```

and explicitly distinguish:

```text
query level predicate vs Heading limit
query vs Reference Status
```

Update view-state README for optional schema-v1 active-query persistence.

Clarify Saved Filter registry is separate web storage, not KG9.

Update web/component docs for draft/Apply/Clear, Saved Filters, Search conflict clearing, and NAV1 behavior.

---

# Part 33 — No new external dependencies

Expected external additions:

```text
zero
```

A new workspace package is not an external dependency.

Do not add parser-generator/query/form/storage/icon/state libraries.

---

# No canonical/source mutation

Do not modify:

- Markdown parser;
- Obsidian adapter;
- resolver;
- canonical entity schema;
- stable identity;
- vault discovery/source provider;
- source Markdown files.

Graph query reads canonical entities only.

---

# No renderer query semantics

React Flow should not know query syntax/AST/string.

Renderer receives final `ViewProjection` only.

No query matching in node components.

---

# Likely files

Likely new package:

```text
packages/graph-query/
  package.json
  tsconfig.json
  README.md
  src/
    types.ts
    tokenize.ts
    parse.ts
    format.ts
    evaluate.ts
    index.ts
    *.test.ts
```

Exact split may be smaller.

Likely existing changes:

```text
packages/view-projection/package.json
packages/view-projection/src/types.ts
packages/view-projection/src/slicing.ts
packages/view-projection/src/project.ts
packages/view-projection/src/*tests*
packages/view-projection/README.md

packages/view-state/package.json        // if direct graph-query import needed
packages/view-state/src/types.ts
packages/view-state/src/validation.ts
packages/view-state/src/persist.ts
packages/view-state/src/restore.ts
packages/view-state/src/*tests*
packages/view-state/README.md

apps/web/package.json                   // workspace graph-query dependency
apps/web/src/graph-state.ts
apps/web/src/navigation.ts
apps/web/src/navigation-history.ts
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/graph-filter-count.ts
apps/web/src/components/AdvancedGraphQuery.tsx
apps/web/src/saved-graph-filters.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/*tests*
apps/web/src/App.css
apps/web/README.md
apps/web/src/components/README.md
```

Renderer changes should normally be unnecessary.

---

# Scope

## In scope

- new source-neutral graph-query package;
- typed AST;
- parser/tokenizer;
- AND/OR/NOT/parentheses;
- deterministic precedence;
- path/title/text predicates;
- kind predicate + aliases;
- section-level predicates/comparators;
- deterministic canonical formatter;
- complexity limits;
- pure canonical-entity evaluator;
- `ViewProjectionFilters.query`;
- KG6 query filtering;
- fail-closed invalid-query issue;
- DISC1 actionable-count integration;
- Focus/query composition;
- simple-filter AND composition;
- `set-query` reducer action;
- NAV1 query checkpoints;
- active-query KG9 schema-v1 persistence;
- Search/Inspector conflict clearing;
- Advanced query UI;
- draft validation;
- active filter badge;
- named Saved Filters;
- workspace-scoped Saved Filter storage;
- stable-workspace persistence eligibility;
- Save/Apply/Delete lifecycle;
- browser/desktop/performance/a11y tests;
- docs/PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- Reference Status query predicates;
- edge query language;
- diagnostic-target query predicates;
- regex/globbing/fuzzy/semantic query;
- body-content search;
- frontmatter/tags/metadata;
- topology/link-count predicates;
- query autocomplete;
- syntax highlighting;
- visual query builder;
- saved-filter rename/update UI;
- full simple-filter AST migration;
- Saved Filter containing Structure/Heading/Blocks/simple controls/status/viewport;
- sharing/export/import of Saved Filters;
- vault file persistence;
- GROUP1 colors;
- LAYOUT1 clustering.

Do not implement GROUP1 automatically.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Create `graph-query` workspace package.
3. Implement AST/tokenizer/parser + limits.
4. Implement canonical formatter.
5. Implement canonical entity evaluator.
6. Add exhaustive parser/evaluator tests.
7. Add `filters.query` to KG6 contract.
8. Integrate query into filter pass; parse once.
9. Add invalid-query fail-closed issue.
10. Integrate query into DISC1 actionable filtering.
11. Add projection/focus/block/level tests.
12. Add `set-query` graph action.
13. Update all filter-presence/equality helpers.
14. Add NAV1 policy/equality/tests.
15. Add KG9 optional query persistence/validation.
16. Update Search/Inspector conflict-clearing policy.
17. Create Saved Filter registry/storage module.
18. Add registry validation/storage tests.
19. Integrate stable-workspace registry lifecycle in GraphExplorer.
20. Add Advanced Query / Saved Filters UI.
21. Add active filter count.
22. Browser syntax/semantics QA.
23. Browser NAV1/Search/Saved Filter QA.
24. Responsive QA.
25. Desktop/live synthetic-vault QA.
26. KG12/performance benchmarks including depth-3 query.
27. Accessibility pass.
28. Docs.
29. Archive prompt according to repository convention.
30. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/graph-query typecheck
pnpm exec vitest run packages/graph-query

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm desktop:check
git diff --check
```

Run current small/medium projection benchmarks, depth-3 profile, Dagre-worker responsiveness, and workspace-worker responsiveness according to latest `main`.

Responsive widths:

```text
390
600
768
1000
1440
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

QUERY1 is complete only when:

1. source-neutral graph-query package exists;
2. it has no renderer/web/source-specific dependency;
3. no external dependency is added;
4. AST is typed/discriminated;
5. AND works;
6. OR works;
7. NOT works;
8. parentheses work;
9. precedence is NOT > AND > OR;
10. keywords are case-insensitive;
11. implicit AND is not silently accepted;
12. comma syntax is rejected usefully;
13. `path:` uses documented case-insensitive substring semantics;
14. `title:` matches canonical Section title only;
15. `text:` matches canonical path/Section title only;
16. kind predicates work for document/section/block;
17. file/document aliases canonicalize;
18. shorthand files/documents/sections/blocks works;
19. level exact works;
20. level <= works;
21. level >= works;
22. level matches Sections only;
23. invalid level rejected;
24. documented string escaping works;
25. malformed strings rejected;
26. unknown fields rejected;
27. parser returns positioned issues rather than throwing;
28. query length limit enforced;
29. AST complexity/depth limit enforced;
30. canonical formatter deterministic;
31. canonicalization idempotent;
32. canonical output reparses equivalently;
33. evaluator pure/source-neutral;
34. evaluator short-circuits;
35. `ViewProjectionFilters.query` exists;
36. KG6 parses active query once per filter pass;
37. KG6 does not parse per entity;
38. query ANDs with Path Scope;
39. query ANDs with Entity Content;
40. query ANDs with projected text if present;
41. Reference Status remains independent;
42. query does not directly select diagnostics;
43. ancestor context remains correct;
44. resolved reference retention remains current semantics;
45. Focus is applied before query;
46. query does not mutate Focus traversal;
47. `blocks` query does not enable Blocks;
48. `blocks` query does not expand parents;
49. query `level` does not set Heading limit;
50. Heading limit remains structural/pre-roll-up;
51. DISC1 counts account for advanced query;
52. query-excluded descendants do not create false `› N`;
53. no `› 0` / `⌄ 0` regression;
54. malformed in-memory query produces `invalid-query` issue;
55. malformed query fails closed rather than broadening;
56. `set-query` action exists;
57. clearing query removes only advanced query;
58. other graph state remains intact;
59. query Apply is NAV1 history;
60. query Clear is NAV1 history when active;
61. same canonical query is NAV1 no-op;
62. draft typing is not history;
63. draft typing does not project/layout;
64. history equality includes query;
65. Back/Forward restores query;
66. active query persists in KG9 schema v1;
67. schemaVersion stays 1;
68. old schema-v1 records without query remain valid;
69. malformed persisted query rejected safely;
70. live reconciliation preserves query;
71. Reset clears active query;
72. Reset does not delete Saved Filters;
73. explicit navigation preserves query when target matches;
74. explicit navigation clears query when target does not match;
75. navigation announces query clear;
76. NAV1 Back restores query cleared by navigation;
77. Advanced query editor lives inside Filters;
78. editor is labelled multiline input;
79. invalid draft leaves graph unchanged;
80. invalid draft shows concise positioned error;
81. successful Apply canonicalizes active query;
82. Clear works;
83. active query counts as one Filters badge group;
84. saved definitions/draft do not count;
85. Saved Filter stores name + canonical query only;
86. Saved Filter excludes Structure;
87. excludes Heading limit;
88. excludes Blocks;
89. excludes simple Path/Entity controls;
90. excludes Reference Status;
91. excludes Focus/viewport/selection;
92. registry is separate from KG9;
93. registry is workspace-ID scoped;
94. key contains no vault filesystem path;
95. same-workspace live updates preserve registry;
96. different workspaces isolate registries;
97. cross-session Saved Filter persistence requires stable identity;
98. unstable workspace can still use Advanced query;
99. registry schema validates;
100. names trim;
101. names are case-insensitively unique;
102. empty/overlong names rejected;
103. malformed saved query rejected;
104. registry count bounded;
105. corrupt registry is not silently overwritten;
106. write failure surfaced accurately;
107. Save current unavailable without active valid query;
108. Apply saved sets only advanced query;
109. Apply saved participates in NAV1 only when query changes;
110. Delete saved does not alter active query;
111. Delete saved does not create graph history;
112. long queries/names do not overflow Filters;
113. textarea retains native text undo;
114. NAV1 Ctrl/Meta+Z is not stolen from textarea;
115. 390/600/768/1000/1440 layouts pass;
116. Filters opening still does not resize graph canvas;
117. renderer remains unaware of query;
118. parser/resolver/canonical schema unchanged;
119. query adds no Dagre work by itself;
120. no per-clause projection;
121. no per-entity parsing;
122. depth-3 query benchmark remains within current gates;
123. graph-query tests pass;
124. view-projection tests pass;
125. view-state tests pass;
126. web tests pass;
127. full `pnpm check` passes;
128. production build passes;
129. desktop check passes;
130. browser query QA passes;
131. Saved Filter reload QA passes;
132. PR CI passes;
133. post-merge CI passes;
134. branch/worktree cleanup follows convention;
135. GROUP1 not implemented;
136. LAYOUT1 not implemented.

---

# Final report

Report:

## 1. Summary

QUERY1 implementation, PR, implementation commit, merge commit.

## 2. Query architecture

New source-neutral package and dependency direction.

## 3. Grammar

Exact supported Boolean syntax, precedence, predicates.

## 4. Deliberate v1 exclusions

Reference Status/topology/body/metadata exclusions and rationale.

## 5. Canonicalization

Synthetic input → canonical examples.

## 6. KG6 semantics

Advanced query as post-focus entity filter ANDed with simple filters.

## 7. Structure / Heading / Blocks

Confirm no structural mutation; explain `level` distinction.

## 8. DISC1

Actionable disclosure behavior under query filtering.

## 9. Focus / references

Context and edge semantics.

## 10. Invalid-query behavior

UI parser errors + KG6 fail-closed safety.

## 11. Query UI

Draft/Apply/Clear behavior.

## 12. Saved Filters

Name/query-only model, scoping, limits, Save/Apply/Delete.

## 13. Storage / stability

Stable-workspace persistence, key boundary, corrupt/write failure behavior.

## 14. KG9

Active query schema-v1 persistence/backward compatibility.

## 15. NAV1

Apply/Clear/Saved Apply history; draft exclusion.

## 16. Search / Inspector navigation

Conflicting-query clearing and Back restoration.

## 17. Responsive/browser QA

Widths and scenarios actually run.

## 18. Desktop/live QA

What was actually run.

## 19. Performance

Parser/evaluator strategy, depth-3 benchmark, projection/layout delta, no duplicate work.

## 20. Accessibility

Labels/errors/button names/native undo safety.

## 21. Dependencies / schemas

Report:

```text
new workspace package
external dependency additions: expected zero
KG9 schemaVersion remains 1
Saved Filter registry has separate schemaVersion 1
```

## 22. Tests / validation

Commands, counts, CI.

## 23. Files changed

Important graph-query/KG6/view-state/web/storage/tests/docs.

## 24. Deviations / warnings

Syntax compromise, browser issue, performance concern, or deferred desktop interaction.

## 25. GROUP1 handoff

State exactly what GROUP1 can reuse:

```text
canonical query string
typed parser/AST
canonical formatter
canonical entity evaluator
Saved Filter examples
```

GROUP1 should add visual style rules over matching projected canonical entities without changing query syntax.

Do not implement GROUP1 automatically.
