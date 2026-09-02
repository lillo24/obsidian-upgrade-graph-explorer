# QUERYNET1 — Propagate Advanced QUERY1 into All Network

**Task type:** narrow product correctness fix / filter parity / All Network projection adapter / regression tests

## Goal

Fix the remaining Advanced QUERY1 integration gap in **All Network**.

Current behavior:

```text
All Hierarchy + Advanced QUERY1
→ query is applied

All Network + Advanced QUERY1
→ query is silently omitted
```

Required behavior:

```text
All Hierarchy + Advanced QUERY1
→ query applies to Hierarchy entities

All Network + Advanced QUERY1
→ the same canonical QUERY1 applies to All Network's document-only topology
```

This is a **small adapter fix**, not a new QUERY1 milestone.

Do not redesign filtering, QUERY1 syntax, PERFQ1A, Network topology, Focus semantics, or layout.

---

# Current repository grounding

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at prompt-writing time:

```text
cf2cd6ec4c816a85a3cd77e7ed1af05d1b47ee82
```

This is after PERFQ1A PR #42 and PRE-KG14A4 PR #43.

Before editing:

1. sync actual latest `main`;
2. inspect commits after the SHA above;
3. adapt to newer main if it advanced;
4. preserve concurrent PRE-KG14/KG14 changes;
5. do not restore stale whole files.

---

# Root cause already identified

Current `apps/web/src/global-view.ts` creates the effective All Network projection state.

It copies:

```text
pathPrefixes
text
entityKinds
referenceStatuses
```

but currently omits:

```text
filters.query
```

The function already states that Global consumes the same KG6 filter/focus intent, so this omission is an integration gap.

The likely core change is conceptually:

```ts
filters: {
  ...
  ...(filters?.query === undefined ? {} : { query: filters.query }),
  referenceStatuses,
}
```

Use current code style.

Do not parse or evaluate QUERY1 in `global-view.ts`. Pass the canonical query through to the existing projection/query path.

---

# Exact semantics

All Network remains:

```text
documents only
```

This is critical.

The fix means:

```text
same QUERY1 grammar
evaluated against entities present in All Network
```

It does **not** mean:

```text
query the full hierarchy
then promote matching Sections to parent Documents
```

Do not add ancestor promotion.

---

# Queries that can match in All Network

Examples:

```text
documents
kind:document
path:"Language"
text:"Language"
documents AND NOT path:"archive"
documents AND (path:"Language" OR path:"Liking")
```

For a Document, `text:` effectively searches its path because Documents do not have Section titles.

---

# Queries that legitimately return zero in All Network

Examples:

```text
sections
kind:section
level<=2
title:"Associated Value"
sections AND level<=3
```

This is correct because All Network has no Section nodes.

Do not silently ignore these queries.

Do not show parent files merely because a hidden Section matches.

---

# Scope × Layout behavior

Current product model:

```text
Scope: All | Focus
Layout: Network | Hierarchy
```

Required:

```text
All + Hierarchy
→ unchanged QUERY1 behavior

All + Network
→ QUERY1 now applies to documents-only topology

Focus + Network
→ unchanged existing focused-detail QUERY1 behavior

Focus + Hierarchy
→ unchanged existing focused-detail QUERY1 behavior
```

Do not redesign Focus.

---

# PERFQ1A preservation

PERFQ1A just optimized the query/filter path.

This fix must use that existing implementation.

Do not:

- revive the old DISC1 second hypothetical projection;
- add another query evaluator;
- add a Network-specific filter path;
- add a query cache;
- add a projection cache;
- move W2 projection to a worker;
- change validation semantics;
- bypass `projectView()`.

This task should pass existing query state correctly into the already-optimized path.

---

# Existing simple filters

Current All Network behavior for:

```text
Path Scope
Text
Entity Content
Reference Status
```

must remain unchanged.

Advanced Query becomes an additional normal filter constraint.

Example:

```text
Entity Content disables Documents
query = documents
```

Expected:

```text
0 nodes
```

Do not let QUERY1 override existing entity-kind filtering.

---

# Reference Status

Preserve current All Network default:

```text
resolved-only
```

unless the user explicitly selected other statuses.

QUERY1 propagation must not change reference-status behavior.

---

# Query persistence and layout switching

The active query already belongs to ordinary graph view state.

Switching:

```text
All Hierarchy
→ All Network
```

must keep the exact canonical query string and now make Network reflect it.

Switching back must keep the same active query.

No schema or history redesign is required.

---

# Saved Filters

Saved Filters already store canonical QUERY1 strings.

After the fix:

```text
Apply Saved Filter while All Network is active
→ Network result updates using that query
```

No Saved Filter schema changes.

No special Network Saved Filter type.

---

# GraphFilters copy

Current Network note says approximately:

```text
All Network always displays files only. Entity and heading controls remain saved for Hierarchy.
```

Advanced Query remains visible below it.

Update the note slightly if useful, with meaning such as:

```text
All Network displays files only. Entity and heading controls remain saved for Hierarchy; Advanced query still applies to files.
```

Keep it concise.

Do not disable the Advanced Query editor in Network.

Do not add a second query help system.

---

# Empty result behavior

A valid query that matches no Documents should keep the existing empty-view behavior.

For example:

```text
sections AND level<=2
```

in All Network should legitimately show:

```text
No nodes match this view.
```

Do not special-case it.

---

# Unit tests — global adapter

Expand `apps/web/src/global-view.test.ts` minimally.

Use a fixture with multiple documents, for example:

```text
folder/A.md
  # Heading

Language/B.md
  # Associated Value

archive/C.md
```

Stable explicit IDs are enough.

Add tests for:

## Query propagation

Input state:

```text
query = documents AND path:"folder"
```

Assert effective Global state preserves the query exactly.

Also prove the original input state is not mutated.

## Positive document query

```text
documents AND path:"Language"
```

Expected:

```text
Language document retained
others excluded
```

## Text path query

```text
text:"Language"
```

Expected:

```text
Language document retained
```

## NOT query

```text
documents AND NOT path:"archive"
```

Expected:

```text
archive document excluded
non-archive documents retained
```

## Section-only query

```text
sections AND level<=2
```

Expected:

```text
0 All Network entity nodes
```

## Section-title query

A Section exists with title:

```text
Associated Value
```

Query:

```text
title:"Associated Value"
```

Expected All Network result:

```text
0 entity nodes
```

This explicitly proves there is no Section → Document promotion.

---

# Layout parity oracle

Add a pure/app-level regression where:

```text
All Hierarchy
Hierarchy Depth = Files only
query = documents AND path:"Language"
```

and:

```text
All Network
same query
```

retain the same matching Document IDs.

Do not compare coordinates/layout.

The point is filter parity at equal granularity.

---

# Focus regression

Focus Network and Focus Hierarchy currently share the focused-detail semantics.

Add or retain enough regression coverage to prove this change does not route Focus Network through the All Network adapter incorrectly.

No Focus redesign.

---

# Navigation history

Do not modify NAV1.

Applying/Clearing QUERY1 already participates in graph history.

After this fix, Back/Forward in Network should simply reflect the restored query correctly.

No new checkpoint fields.

---

# Persistence

Do not bump any schema:

```text
view-state
Saved Filters
Visual Groups
canonical
```

The active query already persists.

All Network simply starts consuming it.

---

# Visual Groups

GROUP1 remains independent.

Query controls visibility.

Visual Groups style visible entities.

Do not couple the systems.

---

# Renderer and layout

Expected renderer-package changes:

```text
none
```

Sigma should render the projection it receives.

If the implementation starts adding query semantics to Sigma, stop and re-evaluate.

A query changes topology, so normal Network projection/mapping/layout work is allowed when the visible document set changes.

Do **not** impose a false `layout +0` invariant.

---

# Workers

Do not change:

```text
W1
W3
Global layout worker
Local layout worker
worker protocols
```

No worker change is justified by this bug.

---

# Canonical/source layers

Do not touch:

```text
core schema
Markdown parser
Obsidian adapter
resolver
stable identity
KG10
KG11
reference semantics
```

---

# Performance

This is not a performance milestone, but PERFQ1A must remain intact.

Run the relevant PERFQ1A query benchmark/tests and confirm no meaningful regression.

Do not add timing gates.

No new cache.

No new index.

---

# Browser QA

Use a synthetic/sample workspace.

First:

```text
Scope = All
Layout = Hierarchy
Hierarchy Depth = Files only
```

Apply:

```text
documents AND path:"Language"
```

Record matching Documents.

Switch:

```text
Layout = Network
```

Expected:

```text
same matching Documents
```

Then test:

```text
documents AND NOT path:"archive"
```

Expected:

```text
archive files excluded
```

Then:

```text
sections AND level<=2
```

Expected:

```text
No nodes match this view
```

Then switch to:

```text
All Hierarchy
3 levels
```

Expected:

```text
matching Sections can appear
```

This proves shared query semantics with layout-specific topology.

---

# Saved Filter QA

Save:

```text
documents AND path:"Language"
```

Apply it while All Network is active.

Clear and reapply.

Expected:

```text
same deterministic Network result
```

No stale unfiltered scene.

---

# Layout switch QA

With a query active:

```text
All Hierarchy
→ All Network
→ All Hierarchy
```

Verify:

- query remains active;
- each layout shows the correct result;
- selection/history behavior remains normal;
- no stale unfiltered Network scene;
- no crash.

---

# Focus regression QA

With:

```text
path:"Language"
```

active, enter Focus and switch:

```text
Focus Network ↔ Focus Hierarchy
```

Verify current focused behavior is unchanged.

---

# Minimal native/live QA

If current repository policy requires native QA, use a narrow check:

1. Open disposable vault.
2. Use All Network.
3. Apply:
   ```text
   path:"Language"
   ```
4. Move/rename a disposable Markdown file into or out of a matching path.
5. Confirm Network query result updates transactionally.
6. Confirm no app file is written into the vault.

Do not repeat the full PERFQ1A QA matrix unless repository policy requires it.

---

# Likely files

Expected primary changes:

```text
apps/web/src/global-view.ts
apps/web/src/global-view.test.ts
apps/web/src/components/GraphFilters.tsx
```

Possibly:

```text
apps/web/src/components/...test.tsx
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
```

only if needed to state/test the behavior.

Renderer/view-projection packages should normally remain unchanged.

---

# First inspection list

Before editing, inspect latest:

```text
AGENTS.md

apps/web/src/global-view.ts
apps/web/src/global-view.test.ts
apps/web/src/exploration-model.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/README.md
apps/web/README.md

packages/graph-query/*
packages/view-projection/src/project.ts
packages/view-projection/src/slicing.ts
packages/view-projection/src/focused-detail.ts
packages/view-projection/README.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md

history-implementations/PERFQ1A*
```

Use actual latest filenames.

---

# Suggested implementation sequence

1. Sync latest main.
2. Confirm PERFQ1A is present.
3. Add a failing test reproducing All Network query omission.
4. Propagate `filters.query` in `effectiveGlobalProjectionState()`.
5. Expand the Global fixture minimally.
6. Add positive Document-query tests.
7. Add Section-only zero-result tests.
8. Add no-parent-promotion test.
9. Add Files-only Hierarchy ↔ Network document parity test.
10. Adjust Network filter note if useful.
11. Add UI copy/query-availability test if straightforward.
12. Run focused tests.
13. Run PERFQ1A query benchmark/regressions.
14. Run full validation.
15. Browser QA.
16. Minimal native/live QA if required.
17. Archive the exact prompt under repository convention.
18. Commit.
19. PR.
20. CI.
21. Merge.
22. Post-merge main CI.
23. Cleanup.
24. Do not start KG14 automatically.

---

# Validation

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck

pnpm exec vitest run apps/web/src/global-view.test.ts
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/web build

pnpm check
pnpm desktop:check
git diff --check
```

Also run the relevant current PERFQ1A query benchmark.

If current repository policy requires it:

```bash
pnpm desktop:build
```

PR CI and post-merge main CI must pass.

---

# Exit gate

QUERYNET1 is complete only when:

1. Latest main was inspected.
2. PERFQ1A remains intact.
3. `effectiveGlobalProjectionState()` propagates `filters.query`.
4. No second query parser is added.
5. No Global-specific query evaluator is added.
6. No external dependency is added.
7. All Network remains documents-only.
8. No matching Section is promoted to its Document.
9. Document-compatible QUERY1 filters All Network.
10. `documents AND path:"Language"` works in fixture.
11. `text:"Language"` works via Document path.
12. `documents AND NOT path:"archive"` works.
13. `sections` yields zero All Network entity nodes.
14. `level<=2` yields zero All Network entity nodes.
15. `title:"Associated Value"` does not promote parent Document.
16. Existing path filter behavior is unchanged.
17. Existing text filter behavior is unchanged.
18. Existing entity-kind behavior is unchanged.
19. Existing reference-status behavior is unchanged.
20. Default resolved-only Network behavior remains.
21. Explicit reference-status selection remains authoritative.
22. All Hierarchy QUERY1 behavior is unchanged.
23. Focus Network behavior is unchanged.
24. Focus Hierarchy behavior is unchanged.
25. Files-only Hierarchy and All Network match the same Document IDs for a document-compatible query.
26. Hierarchy → Network retains the active query.
27. Network → Hierarchy retains the active query.
28. Valid zero-result Network query is not ignored.
29. Advanced Query remains available in Network Filters.
30. Network UI clearly states files-only topology.
31. Saved Filter application works in All Network.
32. Clear query restores normal Network result.
33. Reapply gives deterministic same result.
34. NAV1 policy/schema is unchanged.
35. Active-query persistence schema is unchanged.
36. Saved Filters schema is unchanged.
37. Visual Groups schema/semantics are unchanged.
38. Canonical schema is unchanged.
39. Parser/adapter/resolver are unchanged.
40. Stable identity is unchanged.
41. KG10/KG11 are unchanged.
42. Sigma query code is not introduced.
43. Layout algorithms are unchanged.
44. Worker protocols are unchanged.
45. No query cache is added.
46. No projection cache is added.
47. PERFQ1A fast paths remain used.
48. Relevant PERFQ1A benchmark shows no meaningful regression.
49. Query topology changes may use existing normal Network remap/layout.
50. Focus Network ↔ Focus Hierarchy works with active query.
51. Live Network query update passes if native QA is required.
52. App writes no files into vault.
53. Focused unit tests pass.
54. Web suite passes.
55. Full `pnpm check` passes.
56. Production web build passes.
57. `pnpm desktop:check` passes.
58. Desktop build passes if required.
59. Browser QA passes.
60. Required native QA passes or is truthfully marked pending.
61. PR CI passes.
62. Post-merge main CI passes.
63. Exact prompt is archived.
64. Branch/worktree cleanup completes.
65. KG14 is not started automatically.

---

# Final report

Report:

## 1. Summary
PR, implementation commit, merge commit, CI.

## 2. Starting/final main
Starting SHA and rebase if any.

## 3. Root cause
Confirm active `filters.query` was omitted by All Network adapter.

## 4. Fix
Exact query-state propagation.

## 5. Semantics
All Network remains Documents only; no Section → Document promotion.

## 6. Positive cases
Document/path/text/NOT examples.

## 7. Zero-result cases
Section/title/level examples.

## 8. Existing filters
Path/entity/reference-status behavior.

## 9. Layout parity
Files-only Hierarchy vs Network Document-ID oracle.

## 10. Focus regression
Confirm Focus Network/Hierarchy unchanged.

## 11. Saved Filters / persistence / NAV1
Confirm no schema/policy changes.

## 12. PERFQ1A
Confirm fast-path architecture and benchmark remain healthy.

## 13. Renderer/layout/workers
Confirm no semantic/layout/worker redesign.

## 14. Browser/native QA
Report tested query/layout behavior.

## 15. Dependencies / schemas
Confirm none changed.

## 16. Tests / validation
Commands, counts, CI.

## 17. Files changed
Expected narrow adapter/test/copy/docs set.

## 18. Deviations / warnings
Anything unexpected.

## 19. Handoff
QUERY1 now behaves consistently across All Hierarchy and All Network while respecting each layout's topology.

Do not automatically begin KG14.
