# KG14B1 — QUERY1 Exact-Path Predicate + Composable Exclusion Operations

**Task type:** query-language extension / source-neutral AST operations / compatibility groundwork for Network Explorer

## Goal

Add the minimal QUERY1 primitives needed for the future Network Explorer **Hide file** workflow without building the sidebar yet.

The user-approved interaction is:

```text
current query
        ↓
Hide File A
        ↓
(existing query) AND NOT <exact path File A>
```

The operation must be AST-based, never string concatenation.

This slice should provide:

1. an **exact workspace-relative path predicate**;
2. pure QUERY1 helpers to add, list, and remove global exact-path exclusions;
3. canonical formatting and normal QUERY1 limit enforcement;
4. compatibility across projection, Saved Filters, navigation, and Visual Groups;
5. documentation/help updates for the new syntax.

Do **not** implement the Network Explorer/sidebar/context menu in KG14B1.

KG14B2 remains the next slice after this is merged.

---

## Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current merged baseline at plan-writing time:

```text
PR #46 — KG14A
main = ce256cd6b89bebf0b1288af3dff6fb0045ae9b5b
```

KG14A is complete. The roadmap currently says:

```text
KG14 — In progress
KG14B — accessible Network exploration and critical feedback — Next
```

There is also a concurrent open PR at plan-writing time:

```text
PR #47 — NETWORKZOOM1
```

PR #47 currently touches only:

```text
packages/renderer-sigma/*
history-implementations/NETWORKZOOM1_...
```

and does not currently overlap QUERY1. Still:

1. check PR #47 status before branching;
2. if merged, sync/rebase onto the new `main`;
3. do not modify/delete its branch/worktree;
4. before final merge, ensure KG14B1 is based on latest `main`.

No external context is required for this task.

---

## Current QUERY1 evidence

`packages/graph-query` is the source-neutral QUERY1 owner.

Current public grammar includes:

```text
AND / OR / NOT
path
title
text
kind
level
```

with precedence:

```text
NOT > AND > OR
```

Current path behavior:

```text
path:"Notes/Foo.md"
```

means:

```text
case-insensitive path CONTAINS "Notes/Foo.md"
```

It is **not exact identity**.

That makes it unsafe for a UI action literally meaning:

```text
Hide this file
```

because:

```text
NOT path:"folder/Foo.md"
```

could also exclude another canonical path containing that substring.

Current parser already tokenizes `=` for level predicates, so adding one narrow exact-path syntax does not require a new tokenizer family.

Current canonical `WorkspacePath` contract:

```text
normalized
workspace-relative
forward slashes
no leading slash
no drive prefix
no empty segment
no "." / ".." segments
```

Current QUERY1 limits must remain:

```text
MAX_GRAPH_QUERY_LENGTH = 4096
MAX_GRAPH_QUERY_AST_NODES = 256
MAX_GRAPH_QUERY_NESTING = 32
```

Saved Filters persist **canonical query strings**, not ASTs.

Visual Groups compile through the same `parseGraphQuery()` / `matchesGraphQuery()` package contract.

PERFQ1A projection filtering also delegates canonical query matching to QUERY1.

---

# Product decision — exact-path syntax

Add:

```text
path="folder/Foo.md"
```

with semantics:

```text
entity.source.path === "folder/Foo.md"
```

This is exact canonical `WorkspacePath` identity.

Preserve existing:

```text
path:"Foo"
```

as the current case-insensitive substring predicate.

Do not silently change old query meaning.

Do not add `title=` or `text=` exact matching in this slice.

---

## Exact path is case-sensitive

Exact-path identity should compare the canonical workspace-relative path **exactly**, without lowercasing.

Reason:

```text
path:"..."
→ human search semantics
→ case-insensitive substring

path="..."
→ canonical file identity
→ exact WorkspacePath equality
```

On case-sensitive filesystems two paths differing only by case can be distinct. The exact predicate must not collapse them.

Document this exception to QUERY1's otherwise case-insensitive string-search behavior.

---

## Exact-path value validation

`path=...` must require a valid normalized workspace-relative path.

Reject values such as:

```text
/C:/Foo.md
C:/Foo.md
/Foo.md
foo\bar.md
foo//bar.md
foo/./bar.md
foo/../bar.md
""
```

with the existing positioned QUERY1 invalid-predicate behavior or an equally narrow compatible issue.

Valid examples:

```text
Notes/Foo.md
folder with spaces/Foo.md
A/B/C.md
```

Canonical output should always quote the exact path:

```text
path="Notes/Foo.md"
```

even if the parser accepts an unquoted simple value.

Do not create a separate platform-specific path normalizer.

Use/reuse the canonical lexical WorkspacePath rules already established in the repo.

---

# AST representation

Prefer a **distinct exact-path predicate** rather than overloading all string predicates with a generic equals operator.

Conceptually:

```ts
type GraphQueryPredicate =
  | {
      kind: 'string-predicate'
      field: 'path' | 'title' | 'text'
      value: string
    }
  | {
      kind: 'exact-path-predicate'
      value: WorkspacePath
    }
  | ...
```

Exact naming is flexible.

The important invariant is:

```text
path:"..."
and
path="..."
```

remain structurally distinguishable in the AST.

Why:

- only path equality is supported now;
- generated Hide clauses need reliable recognition/removal;
- it avoids accidentally creating unsupported `title=` / `text=` semantics.

Update all exhaustive evaluator/formatter paths accordingly.

---

# Canonical formatter behavior

Required examples:

```text
path=Notes/Foo.md
→ path="Notes/Foo.md"

PATH="Notes/Foo.md"
→ path="Notes/Foo.md"

NOT path=Notes/Foo.md
→ NOT path="Notes/Foo.md"

(path:"notes" OR title:"Foo") AND NOT path=Notes/Foo.md
→ (path:"notes" OR title:"Foo") AND NOT path="Notes/Foo.md"
```

Existing precedence and minimal-parentheses behavior must remain unchanged.

Parse → format → parse must remain idempotent.

---

# Evaluation behavior

Add exact-path evaluation through `matchesGraphQuery()`.

Oracle:

```text
entity path = Notes/Overview.md

path:"Overview"
→ true

path="Notes/Overview.md"
→ true

path="Archive/Notes/Overview.md"
→ false

path="notes/overview.md"
→ false
```

A section/block backed by the same file also satisfies:

```text
path="Notes/Overview.md"
```

because the predicate is source-path based, not document-kind based.

That is intentional: future Hide-file behavior can remove the file and its structural descendants with one clause.

---

# Composable exact-path exclusion operations

Add pure source-neutral operations in `packages/graph-query`.

Exact function names are flexible, but B3 must have clean equivalents of:

```ts
addExactPathExclusion(...)
removeExactPathExclusion(...)
listExactPathExclusions(...)
```

Do not put these helpers in React/web code.

Do not mutate AST inputs.

---

## Definition of a managed/global exact-path exclusion

A removable/listable hidden-file clause is:

```text
NOT path="..."
```

appearing as a **top-level AND term** of the whole expression.

Examples that count:

```text
NOT path="A.md"

documents AND NOT path="A.md"

(documents OR sections)
AND NOT path="A.md"
AND NOT path="B.md"
```

These are global exclusions.

Examples that must **not** be treated as removable hidden-file chips:

```text
path="A.md" OR documents

NOT (path="A.md" OR path="B.md")

documents OR NOT path="A.md"
```

because removing those terms would change arbitrary user-authored Boolean meaning rather than remove one global hide constraint.

Implement this by flattening/rebuilding only the top-level conjunction chain.

---

# Add exclusion behavior

Required semantics:

### No current query

```text
<none>
+ Hide A.md
→ NOT path="A.md"
```

### Existing predicate

```text
kind:document
+ Hide A.md
→ kind:document AND NOT path="A.md"
```

### Existing OR

```text
kind:document OR title:"Memory"
+ Hide A.md
→ (kind:document OR title:"Memory") AND NOT path="A.md"
```

### Multiple hides

```text
kind:document
+ Hide A.md
+ Hide B.md
→ kind:document AND NOT path="A.md" AND NOT path="B.md"
```

### Duplicate hide

Adding the same exact path twice must be idempotent:

```text
... AND NOT path="A.md"
+ Hide A.md
→ unchanged canonical expression
```

Do not reorder arbitrary user query terms.

---

# List exclusion behavior

Return deterministic unique exact paths represented by global top-level exclusions.

Example:

```text
(title:"X" OR sections)
AND NOT path="B.md"
AND NOT path="A.md"
```

may return either expression order or a documented stable order, but choose one deterministic contract and test it.

Prefer preserving query term order because it matches what the user sees.

Duplicate exact exclusions, if encountered in a manually authored query, should not create duplicate future chips.

---

# Remove exclusion behavior

Removing `A.md` from:

```text
kind:document
AND NOT path="A.md"
AND NOT path="B.md"
```

must produce:

```text
kind:document AND NOT path="B.md"
```

Removing the only term from:

```text
NOT path="A.md"
```

must represent:

```text
no active query
```

through the operation's explicit empty/undefined result contract.

If duplicate global exclusions for the same exact path somehow exist, removing that hidden path should remove **all redundant matching global exclusion terms**, so the file genuinely returns.

Do not remove exact-path predicates occurring inside OR branches or other non-global Boolean structures.

---

# Query limits for generated operations

Generated operations must never create an active query that violates the existing QUERY1 limits.

The public operation contract should fail explicitly if adding a hide would exceed:

```text
query length
AST node count
nesting limit
```

Do not return an expression that formats to something `parseGraphQuery()` would reject.

A practical implementation may:

```text
parse/validate current query
→ manipulate AST
→ canonical format
→ re-parse/validate canonical output
→ return success/failure
```

or enforce the same limits directly.

Do not silently truncate or drop old query terms.

---

# Input contract for future UI

B3 will modify the **active applied canonical query**, not an invalid local draft.

Therefore the B1 package API should support a clean path such as:

```text
canonical active query | no query
+ exact WorkspacePath
→ canonical updated query | explicit error
```

or equivalent AST primitives plus a safe canonical wrapper.

If a string-level helper is provided and receives an invalid current query:

```text
return explicit failure
do not mutate
```

No UI is required now.

---

# Compatibility requirements

## Existing QUERY1

All existing queries must preserve meaning and canonical output.

Especially:

```text
path:"..."
title:"..."
text:"..."
kind:...
level...
AND / OR / NOT
```

No existing canonical Saved Filter should be rewritten merely because this grammar extension exists.

## Saved Filters

Keep:

```text
SAVED_GRAPH_FILTER_SCHEMA_VERSION = 1
```

Old canonical filters remain valid.

New filters using:

```text
path="..."
```

must validate, persist, load, and round-trip through the same registry.

No storage migration.

## Visual Groups

Because Visual Groups use QUERY1:

```text
path="Notes/Foo.md"
```

should work in a Visual Group definition automatically.

No Visual Group schema change.

## View projection / PERFQ1A

The canonical query fast path must evaluate exact paths correctly.

Do not add a special renderer-owned filter.

Do not fall back to projected-text filtering merely because an exact-path predicate exists.

## Navigation

Reveal/navigation logic that checks QUERY1 through `matchesGraphQuery()` must remain coherent.

---

# Existing query help

This slice may make the minimal existing documentation/help updates necessary to expose the grammar truthfully.

Update:

```text
packages/graph-query/README.md
```

and relevant Advanced Query / Visual Group help copy so users can distinguish:

```text
path:"notes"
→ path contains, case-insensitive

path="Notes/Foo.md"
→ exact canonical file path
```

Keep help compact.

Do not build the Network Explorer panel yet.

Do not move the query editor yet.

---

# Tests

## Graph-query parser/formatter

Add coverage for:

- exact path quoted;
- exact path unquoted → canonical quoted, if accepted;
- escaped quote/backslash handling where valid;
- invalid normalized paths;
- no `title=` / `text=` accidental support;
- Boolean precedence;
- parse-format-parse idempotence;
- old canonical strings unchanged.

## Evaluator

Cover:

```text
exact match
substring near-match
case-only mismatch
section/block same-source match
```

## Operations

Cover:

```text
empty → one exclusion
AND composition
OR wrapping
multiple exclusions
duplicate add
list
remove first/middle/last
remove sole exclusion → no query
duplicate removal
non-global NOT path is not listed/removed
immutability
query limit failure
```

## Saved Filters

Add exact-path round-trip without schema bump.

## Visual Groups

Add at least one exact-path rule parity test.

## View projection

Add exact-path query projection coverage to prove:

```text
path="A.md"
```

matches exactly one canonical source path while:

```text
path:"A.md"
```

retains substring behavior.

If practical, include a fixture with:

```text
A.md
Archive/A.md
```

so the difference is undeniable.

## Performance

Run current small/medium query-projection benchmark.

This syntax should not materially change the existing fast-path architecture.

No new CI timing threshold.

---

# Concurrent NETWORKZOOM1

At plan-writing time PR #47 is open and changes only Sigma interaction/zoom files.

KG14B1 should not touch those files.

If PR #47 merges during this task:

```text
sync/rebase before final validation/PR merge
```

Preserve its precision touchpad behavior exactly.

Do not use KG14B1 as an opportunity to modify Network renderer interaction.

---

# Scope

## In scope

- `path="..."` exact-path grammar;
- normalized WorkspacePath validation;
- exact case-sensitive evaluation;
- canonical formatting;
- source-neutral add/list/remove global exact-path exclusion operations;
- query-limit enforcement for generated operations;
- Saved Filter compatibility;
- Visual Group compatibility;
- projection/navigation parity;
- minimal query help/docs;
- tests/benchmarks;
- prompt archival;
- roadmap update;
- PR/CI/cleanup.

## Out of scope

Do not implement:

- Network Explorer sidebar;
- virtualization;
- right-click/context menu;
- Focus/Inspect/Hide UI actions;
- hidden chips UI;
- moving Advanced Query out of Filters;
- accessibility node list;
- adjacency explorer;
- Saved Filter deletion polish;
- QUERY1 live-announcement fix;
- generic exact `title=` or `text=`;
- regex/glob syntax;
- entity-ID predicates;
- folder predicates;
- KG14C/D/E work.

---

# Suggested implementation sequence

1. Check latest `main` and PR #47 status.
2. Inspect current graph-query parser/types/formatter/evaluator/tests.
3. Add exact-path AST predicate and parser syntax.
4. Add normalized workspace-path validation.
5. Update formatter/evaluator.
6. Add pure exclusion composition helpers.
7. Enforce canonical query limits in operation results.
8. Add graph-query tests.
9. Add Saved Filter / Visual Group / projection parity tests.
10. Update QUERY1 docs and minimal existing help.
11. Run query projection benchmarks.
12. Run full repository checks.
13. Browser smoke existing Advanced Query and Saved Filters.
14. Desktop smoke if normal project workflow requires it; no new graphical feature requires extensive native QA.
15. Archive this exact prompt under `history-implementations/`.
16. PR → CI → merge → post-merge CI → cleanup.
17. Stop. KG14B2 is next; do not implement it automatically.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/graph-query typecheck
pnpm exec vitest run packages/graph-query

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/visual-groups typecheck
pnpm exec vitest run packages/visual-groups

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:query-projection -- --profile small
pnpm benchmark:query-projection -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Do not fabricate a pass for unavailable manual QA.

---

# Exit gate

KG14B1 is complete only when:

1. `path:"..."` retains old substring behavior.
2. `path="..."` exists as exact canonical path syntax.
3. exact path matching is case-sensitive.
4. exact path requires normalized workspace-relative path semantics.
5. canonical formatter quotes exact paths.
6. parser/formatter remain idempotent.
7. no accidental `title=` or `text=` syntax is added.
8. exact-path predicate is structurally distinguishable in AST.
9. evaluator supports exact paths.
10. sections/blocks match their exact source path.
11. add-exclusion works with no current query.
12. add-exclusion composes with existing AND query.
13. add-exclusion parenthesizes existing OR semantics correctly.
14. duplicate add is idempotent.
15. list returns only global top-level exact exclusions.
16. list does not misclassify OR/nested-NOT expressions.
17. remove preserves unrelated query terms.
18. remove sole exclusion returns no-query state.
19. duplicate matching exclusions are removed safely.
20. AST inputs are not mutated.
21. generated operations enforce QUERY1 length/complexity/nesting limits.
22. invalid current-query input fails explicitly if string wrapper exists.
23. old Saved Filters remain valid.
24. new exact-path Saved Filters round-trip in schema v1.
25. Visual Groups accept exact-path query.
26. view projection exact-path behavior is correct.
27. navigation/query reveal behavior remains correct.
28. PERFQ1A fast path remains valid.
29. no query UI is moved.
30. Network Explorer is not implemented.
31. no renderer semantics change.
32. no view-state schema change.
33. no Saved Filter schema bump.
34. no Visual Group schema bump.
35. no new external dependency.
36. QUERY1 docs/help explain contains vs exact.
37. focused tests pass.
38. query-projection benchmarks complete.
39. full `pnpm check` passes.
40. desktop check/build pass.
41. PR CI passes.
42. post-merge CI passes.
43. branch/worktree cleanup completes.
44. unrelated user work/untracked files remain untouched.
45. roadmap shows KG14B in progress, KG14B1 complete, KG14B2 next.
46. KG14B2 is not started automatically.

---

# Roadmap update

After implementation and acceptance, update the roadmap to reflect:

```text
KG14 — In progress
KG14A — complete
KG14B — in progress
KG14B1 — QUERY1 exact-path/composable exclusions — complete
KG14B2 — Network Explorer core — Next
```

Use the repo's current roadmap style; do not invent a large new milestone table if the existing document uses prose for sub-slices.

---

# Final report

Report:

## 1. Summary
What QUERY1 primitive and operations were added.

## 2. Syntax
Show exact difference:

```text
path:"Foo"  → contains
path="A/Foo.md" → exact
```

## 3. Exact-path semantics
Validation and case sensitivity.

## 4. AST operations
Add/list/remove contract and top-level AND rule.

## 5. Limits
How generated operations remain valid under QUERY1 limits.

## 6. Compatibility
Saved Filters, Visual Groups, projection/navigation, schema versions.

## 7. Performance
Query-projection benchmark evidence.

## 8. Tests / QA
Commands and outcomes.

## 9. Files changed
Important areas only.

## 10. Dependencies
Expected: zero.

## 11. Concurrent work
State whether PR #47 merged/rebase was needed and confirm no zoom changes were touched.

## 12. Roadmap
Confirm:

```text
KG14B1 complete
KG14B2 next
```

Do not implement KG14B2 automatically.
