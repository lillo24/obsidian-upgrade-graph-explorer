# HIERDISC1-FIX3 — Independent Heading-Tree Collapse in Focus Explorer

**Task type:** UI/state refinement on PR #127 — Focus Explorer Headings tree only.

## Goal / success outcome

Continue PR #127.

The current **Focus Explorer → Headings** view correctly lists the canonical Heading tree and separately supports graph-level **Hide/Show**. Add a second, purely local disclosure layer so parent Heading rows can collapse/expand their child Heading rows **inside the left sidebar only**.

The key product rule is directional:

```text
GRAPH → EXPLORER
If graph disclosure reveals deeper Headings,
the Focus Explorer should automatically open the required parent branches
so those newly visible graph Headings are also visible in the sidebar.

EXPLORER → GRAPH
If the user collapses a parent Heading in the sidebar,
ONLY the sidebar tree collapses.
The graph layout/projection must not change.
```

Example:

```text
Graph:
Language.md
└─ H1 Meaning
   ├─ H2 Context
   └─ H2 Reference

If H1 is expanded on the graph and H2 Context/Reference are visible:
→ Focus Explorer should show H1 expanded and show the H2 rows.

Then user clicks ▾ on H1 in Focus Explorer:
→ H2 rows disappear from the sidebar only.
→ H2 cards remain visible in the graph.
→ no projection/layout/worker/history mutation.
```

This must remain clearly distinct from:

```text
Graph Collapse
→ Heading stays in graph, descendants leave graph.

Graph Hide
→ Heading + subtree leave graph.

Explorer Collapse
→ only descendant rows disappear from the left sidebar.
```

Do not merge before founder graphical QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
PR #127
branch: codex/focus-outline-heading-visibility
head observed at prompt-writing time:
804e0411e4c7f93c1d66e06c6fceb28d3e67f49e
state: OPEN / UNMERGED / mergeable
```

Current PR already includes:

```text
Focus Explorer
Files | Headings
graph-level Heading Hide/Restore
HIERDISC1-FIX2 Nested Soft geometry hardening
Current View schema v4
```

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #127 head/state;
4. integrate latest `main` if required by repo workflow;
5. preserve accepted FIX1/FIX2 UI/layout work;
6. update the same PR.

---

# Current code evidence

Current `FocusHeadings` renders:

```text
model.rows.map(...)
```

where `createFocusOutlineModel(...)` builds the **complete canonical Heading outline**, independent of projection.

Each row already knows:

```text
entityId
title
depth
headingLevel
status:
  visible
  hidden
  hidden-by-ancestor
  not-disclosed
explicitlyHidden
```

This is the correct source basis.

Do not rebuild the sidebar from projected graph nodes, because hidden/not-disclosed Headings must remain discoverable.

---

# Scope

## In scope

- local parent/child collapse in Focus Explorer → Headings;
- automatic initial/open synchronization from graph-visible Heading disclosure;
- automatic reopening when a graph action newly reveals descendants;
- session-local sidebar tree state;
- accessible chevrons/tree semantics;
- tests.

## Non-scope

Do not change:

```text
hiddenEntityIds semantics
graph Collapse semantics
graph Heading depth
projection logic
reference roll-up
Soft/Directional layout
Current View schema
Saved Views
graph navigation history
Heading/Block subfocus
Files tab
folder layout
```

Explorer collapse must not become graph state.

---

# Part A — Add explicit canonical tree metadata

The existing flat `rows` array contains `depth` but not enough explicit tree metadata for clean local collapse.

Extend the outline model with only what is useful, e.g.:

```ts
interface FocusOutlineRow {
  ...
  parentEntityId?: EntityId;
  hasChildHeadings: boolean;
}
```

Optionally include direct child IDs if that produces a cleaner implementation.

Do not duplicate the canonical source tree unnecessarily.

Source order and Heading nesting remain canonical.

---

# Part B — Add transient Explorer-collapse state

Introduce UI-only state representing collapsed parent Heading rows, conceptually:

```ts
Set<EntityId> explorerCollapsedHeadingIds
```

or a per-document map if needed:

```ts
Map<DocumentEntityId, Set<EntityId>>
```

This state is NOT:

```text
ViewProjectionState
StructuralDisclosureState
GraphHistoryCheckpoint
Current View
Saved View
layout/cache input
```

It is ordinary transient Focus Explorer UI state.

Preferred behavior is to preserve it while the current app session remains mounted, including closing/reopening the drawer and switching Files ↔ Headings.

It does not need cross-reload persistence.

---

# Part C — Initial sidebar expansion should mirror graph disclosure

When opening/switching to a Focus document for the first time, determine which sidebar parent branches need to be open from the **currently visible graph Headings**.

Rule:

```text
If a Heading has a currently graph-visible descendant Heading,
that parent branch starts expanded in Focus Explorer.
```

Example:

```text
Graph currently shows:
H1
  H2
    H3
```

Sidebar must initially show:

```text
▾ H1
  ▾ H2
    H3
```

If graph currently shows only:

```text
H1
```

and its H2 children are not disclosed:

```text
▸ H1
```

is an appropriate initial sidebar state.

This keeps the sidebar compact while guaranteeing that anything currently shown in the graph is initially reachable/visible in the left tree.

---

# Important nuance: graph-visible SELF does not force its own branch open

A visible H1 card does not imply its child H2 rows should appear in the sidebar.

Only a **visible descendant** requires the parent branch open.

This matches graph disclosure semantics.

---

# Part D — One-way synchronization after initial state

The synchronization is intentionally asymmetric.

## Graph expand → Explorer expand

If a graph action newly reveals a Heading that was not visible before:

```text
newly visible Heading
→ automatically open every sidebar ancestor needed to reveal its row
```

Example:

```text
Sidebar:
▸ H1

User expands H1 on graph
→ H2 becomes graph-visible

Sidebar automatically becomes:
▾ H1
  H2
```

If user expands H2 on graph and H3 becomes visible:

```text
H2 also auto-opens in sidebar.
```

---

## Explorer collapse → graph unchanged

If user then clicks the sidebar chevron:

```text
▾ H1 → ▸ H1
```

the graph remains exactly as-is.

No:

```text
ViewProjectionState change
hiddenEntityIds change
collapsedEntityIds change
layout request
worker compute
graph history checkpoint
```

The sidebar is merely hiding its own child rows.

---

# Part E — Do not immediately undo the user's sidebar collapse

This requires care.

Do NOT write a generic effect such as:

```text
every render:
  if descendant is graph-visible
  force parent expanded
```

because then the user could never locally collapse a branch containing graph-visible children.

Instead track **visibility transitions**.

Preferred logic:

```text
initial model / Focus document:
  open ancestors of all graph-visible Headings

subsequent projection changes:
  compare previous visible Heading IDs vs current visible Heading IDs

newlyVisible = current - previous

for each newlyVisible Heading:
  remove its ancestor chain from explorerCollapsedHeadingIds
```

Unrelated React rerenders must not reopen a sidebar branch the user manually collapsed.

---

# Part F — Graph collapse does NOT force Explorer collapse

If the user collapses a Heading on the graph:

```text
H2/H3 disappear from graph
```

do not automatically close the same parent branch in Focus Explorer.

The explorer is allowed to remain open and show those canonical rows with:

```text
Not disclosed
```

status.

Reason:

```text
graph disclosure controls what is rendered;
Explorer disclosure controls what the user wants to inspect in the sidebar.
```

Only graph **expansion/new visibility** pushes the Explorer open.

Graph collapse does not push it closed.

---

# Part G — Local chevron UI

For every Heading row with child Heading rows, add a compact chevron before the row copy:

```text
▾ expanded in Explorer
▸ collapsed in Explorer
```

No chevron for leaf Headings.

The chevron action must be separate from the existing graph Hide/Show button.

Suggested visual:

```text
[▾] Heading title                  [Hide]
    H1 · Visible
```

Do not make the entire row a collapse target if that makes Hide/navigation ambiguous.

---

# Tooltip/accessibility copy

Use explicit wording:

```text
Collapse children in Focus Explorer
Expand children in Focus Explorer
```

Not simply:

```text
Collapse Heading
```

because that sounds like graph disclosure.

ARIA:

```text
aria-expanded
```

on parent Heading treeitems or the disclosure button according to valid tree semantics.

Keep Hide/Show accessible names unchanged.

---

# Part H — Effective sidebar row visibility

A row is displayed in the sidebar only if none of its canonical Heading ancestors is locally Explorer-collapsed.

This local filtering occurs **after** `createFocusOutlineModel(...)`.

Do not remove rows from the canonical model.

This keeps:

```text
hidden status
not-disclosed status
graph-visible status
explicit hidden state
```

truthful and available when the branch is reopened.

---

# Part I — Interaction with graph-level Hide

Existing graph-level Hide remains independent.

Example:

```text
H1
└─ H2
```

If H2 is explicitly graph-hidden:

```text
sidebar row H2 remains available when H1 Explorer branch is open
status = Hidden
button = Show
```

If H1 Explorer branch is locally collapsed:

```text
H2 row disappears only from sidebar
```

Reopening H1 reveals H2 again so it can be restored.

Do not let Explorer collapse modify `hiddenEntityIds`.

---

# Part J — Hidden-by-parent behavior

Current graph-hidden ancestor semantics remain.

A descendant may have:

```text
status = hidden-by-ancestor
```

The local Explorer tree can still collapse/open those branches.

Do not merge graph-hidden-by-parent state with Explorer-collapsed state.

These are distinct concepts.

If useful, keep the current muted status styling unchanged.

---

# Part K — Per-Focus-document state

When rerooting:

```text
File A → File B
```

Focus Explorer should show File B's tree.

Preferred transient behavior:

```text
A's Explorer-collapse choices remain in session memory;
return to A → restore A's Explorer-collapse choices.
```

Use stable document EntityId keys.

Do not fuzzy-map states across Files.

If this adds disproportionate complexity, resetting local collapse on reroot is acceptable only after reporting the tradeoff before implementation. Prefer per-document state.

---

# Part L — Files ↔ Headings tab switch

Switching:

```text
Headings → Files → Headings
```

must retain Explorer-collapse state.

No projection/layout work.

No graph history.

---

# Part M — Focus Explorer close/reopen

Close/reopen should preferably retain session-local branch disclosure for the current Focus document.

Again:

```text
UI session state only
```

No persistence schema.

---

# Part N — Show all remains graph Hide state only

Current:

```text
Show all
```

clears explicit graph-level hidden Heading IDs.

Do NOT make it expand every locally collapsed Explorer branch.

If a global Explorer action is desirable, use separate wording later such as:

```text
Expand all
```

but do not add it in this task unless clearly needed.

Keep current Show all semantics stable.

---

# Part O — Graph Expand action synchronization source

Do not infer "newly visible" from DOM timing.

Use the same semantic projection/model status that currently marks each row:

```text
row.status === 'visible'
```

or a source-neutral equivalent.

Track previous vs current visible canonical Heading IDs.

This should work identically for:

```text
Classic
Modular
```

because the sidebar uses shared projection semantics.

---

# Part P — Layout isolation hard test

Explorer-only collapse is required to be layout-neutral.

Add instrumentation/test:

```text
before local Explorer collapse:
  projection identity P
  Modular layout key K
  Classic layout fingerprint F

after local Explorer collapse:
  P unchanged
  K unchanged
  F unchanged
```

No worker call.

No geometry adoption.

Only Focus Explorer DOM rows change.

This is an important regression because PR #127 just finished fixing layout issues.

---

# Part Q — History isolation

Explorer collapse/expand must not create:

```text
Back/Forward entries
Ctrl+Z graph history entries
Current View dirty state
Saved View dirty state
```

Graph-level Hide/Show continues to do all of those as currently implemented.

---

# Part R — Required tests

## E1 — initial tree mirrors visible descendants

Canonical:

```text
H1
├─ H2a
└─ H2b
```

Projection shows H1 + H2a + H2b.

Explorer:

```text
▾ H1
  H2a
  H2b
```

## E2 — initially undisclosed descendants

Projection only shows H1.

Explorer default:

```text
▸ H1
```

## E3 — graph expansion opens Explorer

Start:

```text
▸ H1
```

Graph expands H1 and H2 becomes newly visible.

Explorer becomes:

```text
▾ H1
  H2
```

## E4 — local collapse does not affect graph

With H2 graph-visible:

```text
Explorer ▾ H1 → ▸ H1
```

Assert:

```text
projection unchanged
H2 still graph-visible
layout identity unchanged
worker count unchanged
history unchanged
```

## E5 — unrelated rerender does not auto-reopen

After local collapse with H2 still graph-visible:

```text
selection change
hover
tab-local state change
other ordinary render
```

H1 remains Explorer-collapsed.

## E6 — graph collapse does not force sidebar collapse

Explorer H1 open.

Graph collapses H1.

Explorer may remain:

```text
▾ H1
  H2 · Not disclosed
```

## E7 — graph re-expand after graph collapse

H2 transitions back to visible.

Explorer auto-opens ancestor path if the user had locally collapsed it before the new graph reveal.

## E8 — nested H3

Newly visible H3 automatically opens both:

```text
H1
H2
```

ancestor branches.

## E9 — graph Hide independence

Explorer collapse does not modify `hiddenEntityIds`.

Graph Hide still works after reopening branch.

## E10 — Files ↔ Headings tab

Local branch state retained.

## E11 — close/reopen

Session branch state retained if implementation follows preferred design.

## E12 — reroot and return

Per-document collapse state restored.

## E13 — leaf Heading

No fake chevron.

## E14 — hidden-by-parent

Graph and Explorer states remain distinct.

## E15 — Show all

Clears graph-hidden IDs but does not unexpectedly expand Explorer branches.

---

# UI styling

Keep current Focus Explorer design.

Add only minimal styles for:

```text
heading disclosure chevron
indent alignment
hover/focus-visible
```

The chevron should be compact and visually secondary to Heading title and Hide/Show control.

Do not widen rows excessively.

Do not introduce new colors outside theme tokens.

---

# Likely files

Inspect current branch first.

Probable:

```text
apps/web/src/components/FocusExplorer.tsx
apps/web/src/components/FocusExplorer.test.tsx
apps/web/src/focus-outline-model.ts
apps/web/src/focus-outline-model.test.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/App.css
apps/web/src/components/README.md
history-implementations/
```

Potential small helper:

```text
apps/web/src/focus-explorer-heading-disclosure.ts
```

if the visibility-transition/state logic is cleaner outside React.

Do not touch layout packages unless a surprising dependency is found.

---

# Validation

Follow current `AGENTS.md`.

Run focused tests for Focus Explorer first, then normal repository validation.

Expected equivalents:

```bash
pnpm exec vitest run apps/web/src/components/FocusExplorer.test.tsx
pnpm exec vitest run apps/web/src/focus-outline-model.test.ts
pnpm exec vitest run apps/web/src/components

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

The full Soft benchmark is not required if no layout code changes, but existing layout tests must remain green.

---

# Native artifact

Build a fresh optimized candidate:

```text
hierdisc1-fix3-explorer-heading-collapse-native-candidate.exe
```

Report SHA-256.

Update PR #127.

Do not merge before founder QA.

---

# Founder graphical QA

Ask founder to test:

```text
1. Focus a File with H1 → H2 → H3 hierarchy.
2. Expand H1 on graph.
3. Confirm H1 auto-opens in Focus Explorer and H2 appears.
4. Collapse H1 in Focus Explorer.
5. Confirm H2 stays visible on graph.
6. Reopen H1 in Focus Explorer.
7. Collapse H1 on graph.
8. Confirm sidebar may remain open and H2 says Not disclosed.
9. Re-expand H1 on graph.
10. Confirm sidebar auto-opens if needed.
11. Test Files ↔ Headings tab.
12. Test Hide/Show still works independently.
```

Expected mental model:

```text
Graph expand can open Explorer.
Explorer collapse never closes graph.
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIERDISC1_FIX3_focus_explorer_heading_tree_collapse_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. same PR #127 continued;
2. accepted Files/Headings UI preserved;
3. canonical Heading model remains source-based;
4. local Explorer-collapse state exists separately from graph disclosure;
5. parent rows with children have clear chevron;
6. leaf rows have no chevron;
7. initial Explorer state exposes all graph-visible descendants;
8. graph expand auto-opens required sidebar ancestors;
9. local sidebar collapse hides rows only;
10. local sidebar collapse does not mutate projection;
11. local sidebar collapse does not mutate hiddenEntityIds;
12. local sidebar collapse does not mutate collapsedEntityIds;
13. local sidebar collapse does not alter Classic fingerprint;
14. local sidebar collapse does not alter Modular layout key;
15. local sidebar collapse does not invoke worker;
16. local sidebar collapse does not create graph history;
17. unrelated rerender does not reopen manually collapsed sidebar branch;
18. graph collapse does not force sidebar collapse;
19. subsequent graph re-expand can reopen sidebar path;
20. nested ancestor auto-open works;
21. Files ↔ Headings retains local branch state;
22. close/reopen retains session state if preferred design implemented;
23. reroot per-document state works if preferred design implemented;
24. graph Hide/Show remains independent;
25. hidden-by-parent remains independent;
26. Show all semantics unchanged;
27. Current View schema remains v4;
28. Saved Views unchanged;
29. Heading/Block subfocus unchanged;
30. HIERDISC1-FIX2 Nested Soft geometry unchanged;
31. focused tests pass;
32. full `pnpm check` passes;
33. desktop check/build passes;
34. `git diff --check` passes;
35. prompt archived + SHA-256;
36. optimized EXE + SHA-256;
37. PR #127 remains unmerged for founder QA.

---

# Final report

Report:

## Branch / commit / PR

## Explorer-collapse state

Explain where transient per-document sidebar disclosure lives.

## Directional synchronization

Show:

```text
graph expand → Explorer expands
Explorer collapse → graph unchanged
graph collapse → Explorer not forced closed
```

## Layout/history isolation

Report proof that local Explorer collapse changes none of:

```text
projection
Classic layout fingerprint
Modular layout key
worker compute count
graph history
persisted Current View
```

## UI

Describe chevron/tree behavior and accessibility.

## Validation

Exact test/build counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
