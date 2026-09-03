# KG14B3 — Network Explorer Actions + QUERY1 Integration

**Task type:** interaction integration / QUERY1 product UI / Network Explorer contextual actions / accessible context menu

## Goal

Turn the KG14B2 Network Explorer from a read/navigation companion into the user-approved high-precision control surface for Network exploration.

Final intended interaction:

```text
┌ Network Explorer ─────────────────────┐
│ Query                                 │
│ [ kind:document AND ...             ] │
│ [Apply] [Clear]                       │
│                                       │
│ Hidden files                          │
│ [× Archive.md] [× Old/Notes.md]       │
│                                       │
│ Visible nodes                         │
│ ▾ Associated Value                    │
│   → Motivation                        │
│   → Liking                            │
└───────────────────────────────────────┘

right-click / keyboard context menu on a node:

Focus
Inspect
Hide file
```

`Hide file` must update the **existing applied QUERY1 expression**, never replace it:

```text
existing query
+
Hide Notes/Foo.md

→
(existing query) AND NOT path="Notes/Foo.md"
```

Removing a Hidden-file chip removes only that global exact-path exclusion.

Do not implement unrelated KG14B4 accessibility-feedback work, desktop hardening, or general exploration polish in this slice.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current merged baseline at plan-writing time:

```text
PR #50 — KG14B2 accessible virtualized Network Explorer
merge d7107e5d312a5997b4e152b9d2de351afac9bfe8
```

Current `main` already includes:

```text
PR #47 — NETWORKZOOM1
PR #48 — KG14B1 exact-path QUERY1 exclusions
PR #49 — VISUAL1A
PR #50 — KG14B2 Network Explorer
```

No external context is required.

Before implementation, sync latest `main` and inspect any newer open PRs. Preserve unrelated user work/worktrees.

---

# Current KG14B1 contract

QUERY1 now distinguishes:

```text
path:"Foo"
→ case-insensitive substring search

path="Notes/Foo.md"
→ case-sensitive exact canonical WorkspacePath
```

KG14B1 already exposes source-neutral helpers in:

```text
packages/graph-query/src/exact-path-exclusions.ts
```

including equivalents of:

```ts
addExactPathExclusion(query, path)
listExactPathExclusions(query)
removeExactPathExclusion(query, path)
```

These helpers:

- parse/validate QUERY1;
- preserve Boolean meaning;
- manipulate only top-level global `AND NOT path="..."` exclusions;
- enforce QUERY1 limits;
- return canonical query strings;
- are immutable.

**Reuse them.**

Do not duplicate their AST logic in React code.

---

# Current KG14B2 contract

The Network Explorer currently:

- exists only for Layout = Network;
- supports All + Network and Focus + Network;
- is a left overlay drawer;
- opens through toolbar button + left-edge handle;
- derives every row from the active `ViewProjection`;
- exposes virtualized accessible tree navigation;
- synchronizes node selection/centering with Sigma;
- exposes projected adjacency;
- survives projection/live changes;
- coexists with Inspector on wide screens;
- uses narrow-screen drawer mutual exclusion;
- does not depend on Sigma internals.

Current relevant files include:

```text
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/network-explorer-model.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/App.css
```

Preserve B2 virtualization, keyboard tree behavior, controlled selection, and the QA fix that prevents repeated external-selection scroll snapping.

---

# Core product rule

There remains exactly one semantic query state:

```text
ViewProjectionState.filters.query
```

The Network Explorer query editor, Filters, Saved Filters, Hide, Hidden chips, Back/Forward, persistence, Visual Groups, and renderers must never create competing query stores.

Separate concepts are allowed:

```text
applied canonical query
→ semantic graph state / history / persistence

query draft
→ transient editor state only
```

Do not create a `hiddenFiles` persisted array.

Hidden files are derived from the applied QUERY1 expression.

---

# 1. Put the Advanced Query editor in Network Explorer

When Layout = Network, display the Advanced QUERY1 editor at the top of the Network Explorer, above the virtualized node list.

Suggested compact structure:

```text
Query
[ textarea                         ]
[ Apply ] [ Clear ] [ Reset draft* ]
Draft not applied* / error*

Hidden files
[chips...]

Visible nodes
...
```

The query section should be compact enough that the virtualized node list still owns the remaining drawer height.

The virtualized node list must retain its own independent scrolling/windowing behavior.

---

# 2. Do not show two Advanced Query editors

The user explicitly wants the query in the Network Explorer for Network layouts.

Final placement:

```text
Network layout
→ Advanced Query editor in Network Explorer
→ no duplicate Advanced Query editor inside Filters

Hierarchy layout
→ Network Explorer unavailable
→ Advanced Query editor remains in Filters
```

Saved Filters may remain in Filters in both layouts.

This is the preferred scope because Saved Filters are reusable filter management, while the live query formula is now part of direct Network exploration.

In Network Filters, replace the old editor area with brief copy such as:

```text
Advanced query is edited in Network Explorer.
```

Do not require opening Filters to use QUERY1 in Network.

---

# 3. Extract/reuse one query-editor implementation

Do not copy the current GraphFilters textarea/apply/clear parsing logic into NetworkExplorer.

Extract a reusable controlled query-editor component or equivalent narrow abstraction, likely something like:

```text
apps/web/src/components/GraphQueryEditor.tsx
```

Exact file/name is flexible.

It should own presentation, not semantic graph state.

Conceptual props:

```ts
activeQuery
queryDraft
queryDirty
queryIssue
onDraftChange
onApply
onClear
onResetDraft
idPrefix
compact?
```

Use unique IDs/prefixes so future layout changes cannot create duplicate DOM IDs.

The same editor implementation should render:

```text
inside Network Explorer for Network
inside GraphFilters for Hierarchy
```

---

# 4. Lift/preserve query draft state across UI placement

Today GraphFilters locally owns `queryDraft` and parse error state.

That becomes insufficient because the editor moves between surfaces and Network Explorer can be closed/unmounted.

Move the transient query-draft controller to a stable owner at/near `GraphExplorer`, or to a dedicated hook used there.

Required behavior:

```text
close/reopen Network Explorer
→ dirty draft survives

Network → Hierarchy
→ same draft appears in Filters

Hierarchy → Network
→ same draft appears in Network Explorer
```

Preserve the current useful synchronization rule:

```text
if draft is clean
→ external applied-query change updates draft

if draft is dirty
→ external applied-query change does not silently overwrite the user's draft
```

External applied-query changes include:

```text
Saved Filter Apply
Back/Forward
Hide
Hidden-file restore
other existing query actions
```

Saved Filter Apply should explicitly adopt that Saved Filter query as the new editor draft because the user intentionally chose that formula.

---

# 5. Query editor actions

Preserve current semantics:

## Apply

```text
parse draft
→ invalid: do not mutate graph
→ valid: canonicalize
→ history-producing set-query action
```

## Clear

Clear both:

```text
applied query
query draft
```

using the current history-producing query action.

## Reset draft

Add a small action shown only when the draft differs from the applied query:

```text
Reset draft
→ replace transient draft with current applied canonical query
→ no graph/history change
```

This gives a non-destructive way to abandon an unfinished draft.

Do not change QUERY1 grammar in B3.

---

# 6. Hidden files are derived from QUERY1

Directly beneath the query editor, derive:

```text
Hidden files
```

from:

```ts
listExactPathExclusions(activeQuery)
```

Do not track provenance such as "generated by context menu".

Therefore any valid global clause manually written by the user:

```text
NOT path="Archive.md"
```

also appears as a Hidden-file chip.

This is desirable because the query remains the only truth.

If none exist, either omit the section or show concise text:

```text
No hidden files.
```

---

# 7. Hidden-file chip design

Each chip should show a compact friendly file label plus expose the complete path via accessible name/title.

Example:

```text
[ × Overview.md ]
```

Accessible action:

```text
Show Notes/Overview.md again
```

If duplicate basenames exist, visually add enough parent context to distinguish them.

Do not independently inspect the filesystem. Use the exact path strings from QUERY1.

If a path no longer exists after a source update, keep the chip because the exclusion still exists in the query and the user may want to remove it.

---

# 8. Removing a Hidden-file chip

Use:

```ts
removeExactPathExclusion(...)
```

Then commit the returned canonical query through the existing history-producing `set-query` path.

Required:

```text
A AND NOT path="X.md" AND B
remove X
→ A AND B
```

If it was the only term:

```text
NOT path="X.md"
remove X
→ no applied query
```

One chip action = one graph-history checkpoint.

Back should undo the restore; Forward should redo it.

Do not automatically center the returning file.

---

# 9. Safely combine Hide/restore with dirty query drafts

Do not lose a dirty draft and do not let a later Apply accidentally undo a Hide.

Implement one pure/testable mutation planner for exact-path UI operations, conceptually:

```ts
planExactPathQueryMutation({
  activeQuery,
  queryDraft,
  path,
  operation: 'add' | 'remove'
})
```

Required behavior:

### Clean draft

```text
draft == active
→ mutate active query
→ use same canonical result as draft
```

### Dirty but valid draft

Mutate **both** independently using the KG14B1 helper:

```text
active query
→ semantic result to commit

dirty draft
→ same add/remove operation
→ preserved as still-unapplied draft
```

This ensures a later Apply does not unexpectedly restore a file the user just hid.

It is acceptable that this operation canonicalizes the valid dirty draft.

### Dirty invalid draft

Do not mutate the applied query.

Return/display a clear inline message such as:

```text
Fix or reset the current query draft before hiding/restoring files.
```

This avoids partially updating two representations.

The operation must be atomic from the user's perspective.

---

# 10. Context menu

Add a small custom context menu for Network Explorer logical node targets.

Open from:

```text
right-click / contextmenu pointer event
Shift+F10
ContextMenu/Menu keyboard key when supported
```

The menu acts on the row/adjacency target that invoked it, not necessarily the previously selected graph node.

Menu items:

```text
Focus
Inspect
Hide file
```

Do not add more actions in this slice.

---

# 11. Context menu accessibility / lifecycle

Use accessible menu semantics and robust focus ownership.

Expected:

```text
role=menu
role=menuitem / menuitem with disabled semantics
ArrowUp / ArrowDown
Home / End
Enter / Space
Escape closes
Tab closes rather than trapping indefinitely
```

Pointer-opened menu may appear near pointer coordinates.

Keyboard-opened menu should anchor near the originating row if practical.

On open:

```text
focus first enabled menu item
```

On Escape/cancel:

```text
restore originating tree row focus if still mounted
```

Because rows are virtualized:

- store stable logical target ID, not only a DOM element;
- close the context menu if its source row is invalidated/removed;
- scrolling may close the menu to avoid a detached floating menu;
- never crash if the source row unmounts.

Outside click closes it.

Do not interfere with Network Explorer tree Arrow-key behavior when menu is closed.

---

# 12. Context target normalization

Both top-level node rows and adjacency rows may open the menu.

For an adjacency row:

```text
menu target = adjacency.targetNodeId
```

Resolve the target through the current `NetworkExplorerModel.nodeById`.

If the projection updates and that target disappears, close the menu.

Never resolve actions through stale Sigma/Graphology state.

---

# 13. Focus action

## All + Network

For canonical entity nodes:

```text
Focus
→ reuse the same Focus-entry pipeline as Network canvas double-click
→ existing history behavior
→ same screen/semantic transition rules
```

Do not implement a second Focus planner.

## Focus + Network

For canonical entity nodes:

```text
Focus
→ reroot/navigate Focus through existing local entity-navigation semantics
→ preserve Layout = Network
```

Reuse `navigateToEntity` / `planLocalEntityNavigation` or the current equivalent rather than constructing new Focus state.

This lets a neighboring file become the new focused context.

For a Heading/Block, existing navigation should resolve its containing document while preserving exact entity selection/centering where supported.

## Diagnostics

Diagnostic target nodes have no canonical entity ID:

```text
Focus unavailable
```

Omit or disable the item consistently.

Do not fake a Focus root from raw target text.

---

# 14. Inspect action

`Inspect` is available for any projected node that the existing Inspector can inspect, including diagnostic target nodes.

Required behavior:

```text
Inspect
→ set controlled GraphSelection to context target node
→ open existing Inspector
→ Inspector displays existing projection/canonical inspection
```

No duplicate Inspector UI in Network Explorer.

Do not create graph history for Inspect.

On wide screens:

```text
Network Explorer remains open
Inspector opens on right
```

On narrow screens, preserve KG14B2 mutual-exclusion behavior:

```text
Inspector opens
Network Explorer closes
```

If Inspector later closes and the original row no longer exists/is mounted, use the current safe focus fallback rather than throwing.

A narrow refactor from `HTMLButtonElement` to `HTMLElement` for Inspector focus-restore ownership is acceptable if necessary to restore to a treeitem.

---

# 15. Hide file action

`Hide file` operates on the target node's canonical `sourcePath`.

Use:

```ts
addExactPathExclusion(...)
```

Then commit the returned canonical active query through existing history-producing `set-query` semantics.

Do not use:

```text
string concatenation
simple pathPrefixes filter
renderer hiding
CSS visibility
local hidden IDs
```

Exact-path QUERY1 is the product mechanism.

---

# 16. Which targets can be hidden

## Entity nodes

Document / Heading / Block have a canonical source path.

For Heading/Block rows, menu label remains:

```text
Hide file
```

because the operation hides **the entire source file**, not only that heading/block.

## Diagnostic nodes

No canonical source path:

```text
Hide file unavailable
```

## Focus root

Do not allow the active Focus root file to be hidden through this context action.

Reason: the Focus projection intentionally retains its root as structural context even when content filters exclude it, which would make a `Hide` action appear broken.

When target is the active Focus root:

```text
Hide file disabled
```

with accessible explanation such as:

```text
Change Focus before hiding the focused file.
```

Do not automatically exit Focus or silently hide only descendants.

A manually authored query may still contain such an exclusion; the product must remain resilient to that existing supported state.

---

# 17. Already-hidden target

Normally a globally hidden file will not have a visible Network row.

However retained Focus context or unusual valid state can still expose a source path already present in global exact exclusions.

If target path is already listed by `listExactPathExclusions(activeQuery)`:

```text
Hide file disabled / already hidden
```

Do not create duplicate clauses.

KG14B1 is already idempotent, but the UI should still be truthful.

---

# 18. Hide result behavior

After successful Hide:

```text
context menu closes
query editor shows updated formula/draft according to mutation planner
Hidden-file chip appears
projection updates normally
file disappears where filtering semantics allow
```

If the hidden node was selected, allow existing projection reconciliation/selection safety to clear it naturally.

Do not force Fit or camera recenter after Hide.

Do not directly manipulate Network Explorer rows; they must update from the new projection.

---

# 19. Errors / QUERY1 limits

KG14B1 operations can fail, including when the resulting query would exceed QUERY1 length/AST/nesting limits.

Surface a concise inline error in the Network Explorer query area.

Examples:

```text
Could not hide this file because the current query is at the QUERY1 limit.

Fix or reset the current query draft before hiding files.
```

Do not silently drop old clauses.

Do not show raw internal exception stacks.

B4 still owns the broader live-announcement audit issue for normal QUERY1 parse errors; do not expand this into a full accessibility-feedback redesign.

---

# 20. Query editor + Saved Filters compatibility

Saved Filters remain a single existing registry.

Required:

```text
Saved Filter Apply
→ changes applied query
→ Network Explorer query editor synchronizes appropriately
→ Hidden chips derive from new applied query

Save current query
→ saves exact current canonical formula including global exact exclusions
```

Do not bump Saved Filter schema.

Do not create a Network-Explorer-specific saved-query format.

---

# 21. Back / Forward behavior

QUERY1 actions already participate in graph history.

Verify:

```text
Hide file
→ Back restores prior query/file
→ Forward hides again

Remove Hidden chip
→ Back restores exclusion
→ Forward removes again
```

If query draft is clean, editor should follow history.

If a valid dirty draft exists, preserve the user's draft according to the shared draft-controller rule rather than silently destroying it.

Do not store context-menu state in graph history.

---

# 22. Visual Groups / filters / renderer boundaries

Preserve the established separation:

```text
QUERY1
→ semantic visibility/filtering

GROUP1
→ style/classification only

Sigma
→ drawing/layout

Network Explorer
→ projection-backed DOM navigation/control surface
```

Hide must not directly change Visual Groups, layout settings, folder clustering, or node-size controls.

No new renderer API should be necessary.

---

# 23. Performance / operation expectations

## Context menu open/close

```text
0 projection changes
0 Sigma layout work
0 workspace work
```

## Inspect

```text
selection + Inspector only
0 projection
0 layout
```

## Focus

Use current Focus transition operation counts; no duplicate projection/layout passes beyond the existing pipeline.

## Hide / restore

Exactly one semantic query mutation:

```text
1 normal projection transition for active renderer
normal renderer reconciliation/layout only if current architecture requires it
0 extra shadow projections caused by the Network Explorer UI
```

Do not parse/rebuild the query independently once per visible row.

Compute Hidden paths once from the active query and reuse the set for menu eligibility/chips.

---

# 24. Context menu must not break virtualization

Stress-test:

```text
thousands of logical rows
open menu near bottom
close
keyboard continue
scroll
projection change
```

The menu itself is one small overlay and must not devirtualize the tree.

Do not render one hidden menu per row.

Use one shared context-menu instance/state at NetworkExplorer level.

---

# 25. Responsive behavior

Query area + Hidden chips must not make the virtualized node list unusable on short/narrow windows.

Use flex/min-height constraints so:

```text
query controls
→ bounded natural height

Hidden chips
→ wrap / bounded overflow if many

Visible nodes tree
→ flex: 1; min-height: 0; independent scroll
```

If Hidden files become numerous, cap their display area and scroll/wrap within that section rather than pushing the node tree off-screen.

Preserve Inspector/Network Explorer wide/narrow behavior from B2.

---

# Likely implementation areas

Inspect current code first. Likely changes:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/GraphQueryEditor.tsx          (likely new)
apps/web/src/network-explorer-query-actions.ts       (possible pure helper)
apps/web/src/App.css
apps/web/src/App.test.tsx
apps/web/src/components/NetworkExplorer.test.tsx
apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PRODUCT_QUALITY_AUDIT.md
```

Reuse:

```text
@icarus-graph-explorer/graph-query
existing Focus/navigation pipelines
existing controlled selection
existing Inspector
```

Do not change `packages/graph-query` semantics unless a real B1 defect is found. If a major B1 contract problem appears, stop and report rather than redesigning QUERY1 inside B3.

---

# User-owned repository state

Preserve unrelated user state.

In particular:

```text
modified AGENTS.md
unrelated untracked files/worktrees
```

The user previously had intentional local `ROADMAP.md` state. Do not restore/rewrite ROADMAP as part of B3 unless current repository evidence and user-owned state clearly show it is now intended to be edited. Prefer leaving it untouched.

Do not overwrite unrelated concurrent work.

---

# Scope

## In scope

- move/reuse Advanced Query editor in Network Explorer for Network layouts;
- keep Advanced Query editor in Filters for Hierarchy;
- one shared query-draft controller;
- dirty-draft preservation across drawer/layout changes;
- Reset draft action;
- Hidden-file chips derived from QUERY1;
- atomic active-query + dirty-draft exact-path mutation planning;
- remove chip → exact-path exclusion removal;
- one shared accessible context menu;
- right-click + keyboard context-menu opening;
- Focus action;
- Inspect action;
- Hide file action;
- Focus-root Hide guard;
- diagnostic action eligibility;
- Saved Filter/history compatibility;
- virtualization/responsive preservation;
- browser/Tauri QA;
- docs/prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- new QUERY1 grammar;
- generic node hiding outside QUERY1;
- hiding individual headings/blocks independently from file path;
- multiple selected nodes;
- batch hide;
- Copy Path / Open File / rename/delete source actions;
- context menu on Sigma canvas itself;
- moving Saved Filters into a new storage system;
- Saved Filter delete confirmation (KG14E);
- full QUERY1 live-announcement fix (KG14B4);
- desktop CSP/versioning/packaging (KG14C);
- source status/progress (KG14D);
- repeated-reference Inspector redesign (KG14E);
- renderer zoom/layout tuning.

---

# Suggested implementation sequence

1. Sync current `main`; inspect recent/open PRs and user-owned changes.
2. Inspect KG14B2 NetworkExplorer/GraphExplorer integration and tests.
3. Inspect GraphFilters query/Saved Filters UI and graph-history query actions.
4. Extract a reusable controlled GraphQueryEditor.
5. Move query-draft controller to stable GraphExplorer-level ownership/hook.
6. Preserve Saved Filter Apply and external active-query synchronization.
7. Render query editor in Network Explorer for Network; Hierarchy Filters otherwise.
8. Keep Saved Filters in Filters and remove duplicate Network query editor there.
9. Add pure atomic exact-path active-query/draft mutation planner.
10. Add Hidden-file derivation/chips and restore action.
11. Add one shared context-menu state/overlay to NetworkExplorer.
12. Add pointer + keyboard opening/focus lifecycle.
13. Wire Inspect through controlled selection + existing Inspector.
14. Wire Focus through existing All/Focus navigation pipelines.
15. Wire Hide file through KG14B1 add-exclusion helper + set-query history.
16. Add Focus-root/diagnostic/already-hidden guards.
17. Test history, Saved Filters, filters, live projection updates, virtualization.
18. Run responsive production-browser QA.
19. Run release Tauri pointer/keyboard/touchpad smoke.
20. Update architecture/components/audit docs; preserve user-owned ROADMAP state.
21. Archive this exact prompt under `history-implementations/`.
22. PR → CI → merge → post-merge CI → cleanup.
23. Stop. KG14B4 remains next.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/graph-query typecheck
pnpm exec vitest run packages/graph-query

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Task-specific QA:

```text
NETWORK QUERY PLACEMENT
All + Network → query editor in Network Explorer
Focus + Network → query editor in Network Explorer
All/Focus Hierarchy → query editor in Filters
no duplicate editor IDs/UI
close/reopen drawer preserves dirty draft
Network↔Hierarchy preserves draft
Reset draft works without graph mutation

QUERY
valid Apply
invalid Apply
Clear
Saved Filter Apply
Save current query
Back/Forward query changes

HIDDEN FILES
Hide with no existing query
Hide with simple AND query
Hide with OR query → correct parentheses
multiple hides
duplicate eligibility
Hidden chips from manually authored NOT path="..."
remove first/middle/last exclusion
remove sole exclusion → no query
stale/nonexistent path chip remains removable
query-limit failure

DIRTY DRAFT
clean draft Hide
dirty valid draft Hide mutates active + draft safely
dirty invalid draft Hide blocked atomically
same three cases for chip restore
later Apply does not unintentionally undo prior Hide

CONTEXT MENU
right-click top-level row
right-click adjacency row
Shift+F10
ContextMenu key where supported
Arrow Up/Down/Home/End
Enter/Space
Escape restore focus
outside click close
scroll/projection invalidation safe
single shared menu; virtualization remains bounded

ACTIONS
All Network Focus → existing Focus pipeline
Focus Network Focus/reroot → existing local navigation
Inspect entity
Inspect diagnostic
Inspect wide → both drawers remain
Inspect narrow → Network Explorer closes safely
Hide File document
Hide File heading/block hides source file
Hide diagnostic unavailable
Hide active Focus root disabled/explained
already-hidden target disabled

INTEGRATION
QUERY1 simple filters
Saved Filters
Visual Groups
All/Focus transitions
Focus hops/direction/depth/disclosure
live source update
zero-result graph
Back/Forward
Inspector
NETWORKZOOM1 touchpad behavior unchanged
VISUAL1A settings unchanged
clean console
```

No new CI timing threshold.

---

# Exit gate

KG14B3 is complete only when:

1. Network layouts expose the Advanced Query editor in Network Explorer.
2. Hierarchy keeps Advanced Query available through Filters.
3. Network does not show a duplicate query editor in Filters.
4. there is one applied query state only.
5. query draft is transient and separate from applied query.
6. dirty draft survives Network Explorer close/reopen.
7. dirty draft survives Network↔Hierarchy switches.
8. clean draft follows external applied-query changes.
9. Saved Filter Apply intentionally adopts its query into the editor.
10. Reset draft restores applied query without semantic graph change.
11. Hidden files derive from `listExactPathExclusions()`.
12. no persisted hidden-file array is added.
13. manually authored global exact exclusions appear as Hidden chips.
14. chip labels remain distinguishable for duplicate basenames.
15. stale/nonexistent excluded paths remain removable.
16. chip removal uses `removeExactPathExclusion()`.
17. chip removal changes only that global exact exclusion.
18. removing the sole exclusion clears the applied query correctly.
19. Hide uses `addExactPathExclusion()`.
20. Hide appends to existing Boolean meaning rather than replacing it.
21. no query string concatenation is used for exact-path operations.
22. clean-draft exact-path mutation is coherent.
23. dirty-valid-draft exact-path mutation preserves the draft safely.
24. dirty-invalid-draft mutation is blocked atomically.
25. query-limit errors are user-visible and non-destructive.
26. one accessible shared context menu exists.
27. menu opens by pointer right-click.
28. menu opens by keyboard context command.
29. menu keyboard navigation works.
30. Escape/outside close behavior works.
31. menu focus restore is safe under virtualization.
32. only one menu is mounted, not one per row.
33. adjacency-row menu targets the adjacency target node.
34. stale context targets close safely after projection changes.
35. All Network Focus reuses existing Focus-entry semantics.
36. Focus Network Focus reuses existing local reroot/navigation semantics.
37. diagnostic targets cannot be Focused.
38. Inspect reuses existing controlled selection and Inspector.
39. Inspect creates no graph-history checkpoint.
40. wide Inspect can keep both drawers open.
41. narrow Inspect respects drawer mutual exclusion.
42. entity nodes with a source path can Hide file.
43. Heading/Block Hide clearly means hide their whole source file.
44. diagnostic targets cannot Hide file.
45. active Focus root Hide is disabled/explained.
46. already-hidden targets do not create duplicate exclusions.
47. successful Hide produces a Hidden chip and normal projection change.
48. successful Hide does not directly mutate sidebar rows/Sigma state.
49. Hide/restore each produce exactly one normal history-producing query mutation.
50. Back/Forward undo/redo Hide and restore correctly.
51. Saved Filters remain schema-compatible.
52. view-state schema remains unchanged.
53. Visual Groups semantics remain unchanged.
54. B2 virtualization remains bounded.
55. B2 keyboard tree behavior remains intact while menu is closed.
56. query/Hidden sections do not squeeze out the virtual list on short windows.
57. context-menu operations do not devirtualize the tree.
58. no renderer-sigma API change is needed unless evidence proves otherwise.
59. NETWORKZOOM1 behavior remains unchanged.
60. VISUAL1A behavior remains unchanged.
61. no new external dependency is added.
62. focused tests pass.
63. full `pnpm check` passes.
64. desktop check/build pass.
65. browser graphical QA passes.
66. release Tauri pointer/keyboard/touchpad smoke passes.
67. PR CI passes.
68. post-merge CI passes.
69. modified `AGENTS.md` and unrelated user files remain untouched.
70. user-owned ROADMAP state is not accidentally restored/rewritten.
71. task worktree/branches are cleaned up.
72. prompt is archived.
73. KG14B4 is not started automatically.

---

# Documentation

Update current docs where useful, likely:

```text
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/PRODUCT_QUALITY_AUDIT.md
```

Document:

```text
Network Explorer
= accessible Network DOM + precision control surface

QUERY1
= single semantic filtering truth

Hidden files
= derived top-level exact-path exclusions

Focus / Inspect
= reuse existing application navigation/inspection pipelines
```

Do not rewrite historical prompts.

---

# Final report

## 1. Summary

Describe the final Network Explorer query/action experience.

## 2. Query ownership

Explain applied query vs transient draft and why there is no duplicate semantic state.

## 3. Query placement

Network Explorer vs Hierarchy Filters.

## 4. Hidden files

How exact-path exclusions are derived, added, and removed.

## 5. Dirty-draft mutation safety

Explain active/draft atomic behavior.

## 6. Context menu

Pointer/keyboard/focus lifecycle.

## 7. Focus

All entry + Focus reroot reuse.

## 8. Inspect

Selection/Inspector reuse and responsive drawer behavior.

## 9. Hide file

Eligibility, Focus-root guard, diagnostics, history.

## 10. Virtualization/performance

Confirm no row-menu explosion and no extra shadow graph work.

## 11. Compatibility

Saved Filters, QUERY1, Visual Groups, history, schemas, NETWORKZOOM1, VISUAL1A.

## 12. Tests / browser / Tauri QA

## 13. Files changed

## 14. Dependencies

Expected additions: zero.

## 15. User-owned state

Confirm modified `AGENTS.md`, unrelated files, and ROADMAP state were preserved.

## 16. Follow-up

State:

```text
KG14B3 complete
KG14B4 — remaining critical accessibility feedback — next
```

Do not implement KG14B4 automatically.
