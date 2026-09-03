# KG14B2 — Network Explorer Core: Accessible Virtualized Node + Adjacency Sidebar

**Task type:** accessibility feature / persistent graph companion UI / Network navigation surface / KG14B core

## Goal / success outcome

Implement the user-approved **Network Explorer**: a collapsible, IDE-style **left sidebar** that exposes the current Network projection as an accessible DOM navigation surface.

It should make All + Network and Focus + Network genuinely explorable without interacting with the Sigma canvas.

Conceptually:

```text
┌ Network Explorer ──────────────────┐
│ Visible nodes                  381 │
│                                     │
│ ▾ Associated Value       File       │
│    ◇ Overview             Structure │
│    → Motivation           2 refs    │
│    → Liking               1 ref     │
│    ← Emotions             3 refs    │
│                                     │
│ ▸ Creativity             File       │
│ ▸ Curiosity              File       │
│ ▸ Memory                 File       │
└─────────────────────────────────────┘
```

The sidebar must be synchronized with the active Network projection and controlled graph selection:

```text
sidebar row select
→ select same projected node
→ center it in Sigma

canvas node select
→ select/highlight same sidebar node
→ reveal it in the virtual list when the sidebar is open
```

Expanding a row shows **currently visible projected adjacency**:

```text
hierarchy parent/child
outgoing references
incoming references
```

This slice should close the core KG14A Network-accessibility gap.

Do **not** implement the user-approved QUERY1/Hide/context-menu integration yet. That is KG14B3.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

Current merged baseline at plan-writing time:

```text
PR #48 — KG14B1 exact-path/composable QUERY1 exclusions
merge af779a598997f135f181e2240f1d4d2f9e58b4db
```

KG14B1 added:

```text
path="Notes/Foo.md"
addExactPathExclusion(...)
listExactPathExclusions(...)
removeExactPathExclusion(...)
```

Those APIs are groundwork for KG14B3 and should remain unused by product UI in B2.

KG14A identified the release-blocking issue:

```text
both Sigma Network canvases are aria-hidden
and have no browsable DOM equivalent
```

The audit recommended a synchronized virtualized Visible Nodes companion rather than forcing users into Hierarchy.

Current exploration model remains:

```text
Scope:  All | Focus
Layout: Network | Hierarchy
```

Internal mapping:

```text
All + Network
→ Global Sigma

Focus + Network
→ bounded Local Free Sigma
```

Current `GraphExplorer` already owns:

- controlled `GraphSelection`;
- separate Global/Local Network center requests;
- semantic viewport bookmarks;
- one memoized `InspectionWorkspace`;
- current `ViewProjection`;
- current `VisualGroupPresentationMap`;
- Inspector open/close state and right-edge handle;
- Focus/All and Network/Hierarchy transitions.

The existing Inspector pattern is:

```text
toolbar button
+
right-edge chevron handle when closed
+
focus restoration to the control that opened it
+
absolute overlay drawer
```

Mirror that interaction pattern on the **left** for Network Explorer.

Current projected node types are:

```text
entity:
  document | section | block

reference-target:
  unresolved | ambiguous | invalid
```

Current projected edges are:

```text
hierarchy
reference
```

Use these existing projection semantics rather than reconstructing graph adjacency from canonical source data.

---

# Concurrent NETWORKZOOM1 work

At plan-writing time PR #47 (`NETWORKZOOM1`) is still open and modifies only Sigma interaction/zoom/session internals.

KG14B2 should avoid touching:

```text
packages/renderer-sigma/src/precision-wheel-zoom.ts
interaction zoom logic
Sigma wheel ownership/gains
```

The Network Explorer should integrate at the controlled application boundary through existing:

```text
selection
center requests
projection
viewport bookmarks
```

not by adding another Sigma event bridge.

Before implementation and again before merge:

1. check PR #47 status;
2. if it merged, integrate latest `main` before final validation;
3. preserve its branch/worktree while it is open;
4. do not change its tuned zoom behavior.

---

# Important local-worktree constraints

The user's primary checkout contains unrelated user-owned state.

Do not modify/revert/delete:

```text
AGENTS.md user modification
NETWORKZOOM1 worktree/branch
unrelated uncommitted/untracked files
```

The user also explicitly reported that a local `ROADMAP.md` deletion/state is user-owned.

For this task:

```text
DO NOT modify, restore, recreate, or include docs/ROADMAP.md in the task diff.
```

If the task worktree contains the tracked file from `origin/main`, simply leave it unchanged.

---

# 1. Product surface

Add a persistent companion drawer named:

```text
Network Explorer
```

It exists only when:

```text
Layout = Network
```

It supports both:

```text
All + Network
Focus + Network
```

Do not expose it in Hierarchy.

Initial state:

```text
closed
```

Open state is **transient UI state** only:

- do not persist it in view-state schema;
- do not add a graph preference;
- do not change schema v3.

When switching from Network to Hierarchy, close/hide the Network Explorer cleanly.

---

# 2. Open / close controls

Mirror Inspector's two entry points.

## Toolbar button

Add an icon button in the right-side workspace/tool controls near Inspector:

```text
Open Network Explorer
Close Network Explorer
```

Requirements:

```text
aria-label
aria-pressed
title
visible only while Layout = Network
```

Use an icon that visually communicates a left sidebar/list, not the same icon as Inspector.

## Left-edge handle

When Network Explorer is closed and Layout = Network, show a left-center edge handle:

```text
›
```

with:

```text
aria-label="Open Network Explorer"
```

This is the left-side mirror of Inspector's right-edge `‹` handle.

## Inside close action

The drawer header should contain a normal Close control.

## Focus restoration

Reuse the Inspector ownership pattern:

```text
opened from toolbar
→ closing restores toolbar button

opened from left handle
→ closing restores handle if still available
```

If the drawer disappears because Layout changes to Hierarchy, do not steal focus away from the Layout control the user just activated.

---

# 3. Drawer geometry

The drawer overlays the graph stage from the **left**.

Do not resize/reproject the graph merely because the panel opens.

Preferred architecture:

```text
Network Explorer drawer
→ absolute overlay over graph stage
→ independent scroll
→ no Sigma topology/layout change
```

Match the Inspector's visual family:

- border on graph-facing edge;
- subtle shadow;
- same general maximum width family;
- independent vertical scroll;
- safe-area handling;
- no page/body scroll.

Do not duplicate Inspector CSS blindly if a shared side-drawer primitive can be extracted narrowly without destabilizing Inspector.

---

# 4. Inspector coexistence

Network Explorer is the left-side counterpart to the right Inspector.

On normal desktop widths, both should be able to remain open:

```text
Network Explorer | graph | Inspector
```

because KG14B3's future `Inspect` action should be able to use both surfaces together.

At the existing narrow responsive breakpoint (currently around the app's <=900px responsive behavior), prevent two drawers from completely obscuring the workspace.

Preferred narrow behavior:

```text
opening Network Explorer closes Inspector
opening Inspector closes Network Explorer
```

while wide layouts keep them independent.

Use the existing responsive architecture/breakpoints rather than inventing a second unrelated mobile model.

Do not turn this into a mobile redesign.

---

# 5. Source of data — current projection, not Sigma

The Network Explorer is a DOM representation of the **same current `ViewProjection`** supplied to the active Network renderer.

Do not derive its node set from:

```text
Sigma Graphology instance
layout positions
canonical entire workspace
Search index
```

Use:

```text
current ViewProjection
+ InspectionWorkspace for canonical labels/context
+ current VisualGroupPresentationMap for winning style/group
```

This guarantees:

```text
query/filter changes
Hierarchy Depth in Focus Network
manual disclosure
Focus hops/direction
live updates
```

produce exactly the same visible node set in canvas and sidebar.

The panel itself must never affect projection membership.

---

# 6. Add a pure Network Explorer model adapter

Create a small source-neutral/app-level pure adapter, likely near:

```text
apps/web/src/network-explorer-model.ts
```

or another clearly appropriate location after repository inspection.

Conceptual output:

```ts
interface NetworkExplorerNode {
  projectionNodeId
  entityId?: EntityId
  kind
  label
  detail
  sourcePath?
  diagnosticStatus?
  focusDistance?
  internalReferenceCount
  visualGroup?
  adjacency
}
```

Do not make the React component repeatedly scan the projection for each row.

Build indexes once per projection/model derivation:

```text
nodeByProjectionId
incoming edges by node
outgoing edges by node
```

Complexity target:

```text
O(nodes + edges)
```

not:

```text
O(nodes × edges)
```

The adapter must not depend on Sigma renderer classes.

---

# 7. Which nodes appear

The top-level list represents **every node in the active Network projection**.

That includes:

```text
File / Document
Heading / Section
Block
Diagnostic reference target
```

All + Network will normally contain Files plus diagnostic targets.

Focus + Network may additionally contain Headings and Blocks because it shares Focus detail/disclosure semantics.

Do not silently omit diagnostic nodes: unresolved/ambiguous/invalid targets are part of the visual Network and must have a DOM equivalent.

---

# 8. Node presentation

Use a compact IDE-style row.

Suggested visual markers, consistent with current graph grammar:

```text
File        ▰
Heading     ◇
Block       ●
Diagnostic  ○
```

Do not rely on marker/color alone.

Every accessible row name must include a textual kind/status.

Examples:

```text
File Associated Value, Integrating ideas/Associated Value.md
Heading Overview, Associated Value.md line 4
Unresolved target "Foo"
Ambiguous target "Bar", 3 candidates
```

For entity labels, reuse existing `explorer-inspection` descriptor/display-name behavior where useful rather than creating divergent basename/title rules.

Show secondary context compactly so duplicate titles are distinguishable.

For Focus Network:

```text
focusDistance === 0
→ visible + accessible "Focus root" indicator
```

A subtle hop/distance indicator is acceptable if it helps, but avoid clutter.

---

# 9. Visual Groups

If a visible entity has a winning `VisualGroupPresentationMap` entry:

- show a small group indicator;
- expose the **group name in text/accessible name**, not only color;
- preserve the current first-match/winning-presentation semantics.

Do not recompile QUERY1 rules in the sidebar.

Do not calculate all Visual Group memberships per row; the Inspector already owns detailed membership display.

Diagnostic nodes have no canonical EntityId and therefore no Visual Group presentation.

---

# 10. Deterministic top-level ordering

The Network canvas is spatial; the sidebar needs deterministic linear ordering.

Recommended order:

```text
Focus root first, when present
then other entity nodes in deterministic source order
then diagnostics
```

Within entity nodes, use existing source-order helpers where practical:

```text
focus distance (when useful)
source path
source line/column
entity kind/id tie-break
```

The exact final comparator may adapt to existing utilities, but it must be:

```text
deterministic
stable across renderer relayouts
independent of x/y coordinates
```

Do not reorder the list when ForceAtlas2 moves nodes.

---

# 11. Adjacency expansion

Each top-level row can expand/collapse its **currently projected adjacency**.

Use projection edges only.

Do not expose hidden canonical neighbors outside the current projection.

Flatten expanded adjacency into compact child rows such as:

```text
◇ Overview              Structure child
→ Motivation            Outgoing · 2 refs
← Emotions              Incoming · 3 refs
→ unresolved: Foo       Outgoing · unresolved
```

## Hierarchy edge semantics

For a hierarchy edge:

```text
source → target
```

present relationship as parent/child according to the current projected hierarchy.

## Reference edge semantics

For a reference edge:

```text
source → target
```

show:

```text
Outgoing
Incoming
```

and expose:

```text
status
referenceIds.length
```

when useful.

Reference aggregation remains projection-owned. Do not expand aggregated edges into canonical occurrences here.

Inspector remains the provenance/deaggregation surface.

## Internal references

If a projected entity node has `internalReferenceIds`, expose the count on the parent row/accessibility text rather than inventing a fake neighbor edge.

---

# 12. Expansion state

Expanded/collapsed adjacency state is:

```text
memory-only
sidebar-only
keyed by ProjectionNodeId
```

It must not alter:

```text
StructuralDisclosureState
Focus projection
QUERY1
Sigma graph
history
saved view
```

When projection changes:

- retain expanded state for node IDs that remain visible;
- discard stale expansion IDs cleanly;
- do not throw if an expanded node disappears during a live/filter update.

---

# 13. Virtualization architecture

This is required. Do not render thousands of Network rows into the DOM at once.

Prefer **no new dependency**.

A good fit is a lightweight fixed-row virtualized flattened model:

```text
top-level node row
expanded adjacency rows
```

where each logical visible row has a known fixed height.

The component can maintain:

```text
scrollTop
viewport height
row height
overscan
logical active row
```

and render only the visible window + small overscan.

Do not add a third-party virtualization package unless there is a concrete blocker. If Codex believes a new dependency is required for correctness/accessibility, stop and report before adding it.

### Virtualization acceptance

For a synthetic/stress list with thousands of nodes:

```text
DOM row count stays bounded by viewport + overscan
```

Scrolling/keyboard navigation must be able to reach the entire logical list.

No timing threshold in CI.

---

# 14. Accessible interaction model

Use an IDE-style **tree interaction model** for the virtualized logical rows.

A `role="tree"` / `role="treeitem"` pattern is appropriate if implemented correctly.

Top-level rows:

```text
aria-level=1
aria-expanded when adjacency exists
aria-selected according to controlled graph node selection
```

Adjacency rows:

```text
aria-level=2
accessible relationship in name
```

Examples:

```text
Outgoing reference to Motivation, 2 references
Incoming ambiguous reference from Source
Structure child Overview
```

Only one treeitem should participate in roving tab order at a time.

---

# 15. Keyboard model

Required:

```text
ArrowDown / ArrowUp
→ next/previous logical row

Home / End
→ first/last logical row

ArrowRight on collapsed top-level node
→ expand

ArrowRight on expanded top-level node
→ move to first adjacency row when present

ArrowLeft on adjacency row
→ move to its parent top-level node

ArrowLeft on expanded top-level node
→ collapse

Enter / Space
→ select + center row target node
```

If an adjacency row points to another projected node, Enter/Space selects and centers that neighbor.

The logical active row may move outside the rendered DOM window. The virtualizer must scroll/render it and restore DOM focus without dropping focus to the document body.

No keyboard shortcut should trigger graph Back/Forward accidentally while operating the Network Explorer.

Use the existing history-shortcut exclusion mechanism or `data-graph-history-shortcuts="off"` appropriately.

Do not implement typeahead in B2; Search already exists.

---

# 16. Selection synchronization

The sidebar uses the same controlled `GraphSelection` as the graph.

## Sidebar → graph

Selecting a row should:

```text
set selection = { kind: 'node', id: ProjectionNodeId }
request semantic center in active Network renderer
```

Do not create a second selected-node state.

### Centering without zoom jumps

Prefer the current active semantic Network zoom when available:

```text
All Network
→ current global ratio

Focus Network
→ current freeRatio
```

Fallback only to the existing navigation ratios when no current bookmark exists.

Selecting from the sidebar should normally **center without forcing a new zoom level**.

Do not record a graph navigation-history checkpoint for ordinary row selection/centering; match canvas node-selection semantics.

## Graph → sidebar

When the user selects a node on Sigma:

- highlight the corresponding top-level sidebar row;
- if the Network Explorer is open and the row is outside the virtual window, scroll it into view;
- do not automatically expand its adjacency;
- do not steal DOM focus from the canvas/pointer action.

If an edge is selected in Sigma:

- keep graph edge selection intact;
- do not invent a selected top-level node;
- sidebar may show no selected treeitem.

B2 does not need an edge-selection DOM equivalent beyond relationship descriptions; provenance edge actions remain Inspector territory.

---

# 17. Center requests should reuse GraphExplorer seams

Reuse existing application callbacks/state around:

```text
requestGlobalSemanticCenter(...)
requestLocalSemanticCenter(...)
changeGlobalSelection(...)
changeLocalSelection(...)
semantic viewport bookmarks
```

Do not modify Sigma sessions to add a sidebar-specific center API.

This is particularly important because NETWORKZOOM1 is concurrently tuning renderer input behavior.

---

# 18. No graph work on sidebar-only interactions

Required operation behavior:

## Open / close drawer

```text
0 projection updates
0 Global layout requests
0 Local layout requests
0 workspace work
```

## Scroll virtual list

```text
0 projection
0 renderer layout
0 graph topology reconciliation
```

## Expand/collapse adjacency

```text
0 projection
0 renderer layout
0 graph-state action
```

## Select row

```text
1 controlled selection update
1 semantic center request
0 projection
0 layout
```

Do not couple sidebar state to ForceAtlas2/Dagre.

---

# 19. Empty / failure states

If the current Network projection has zero nodes:

```text
Network Explorer
No visible nodes in the current Network view.
```

Do not mount a meaningless empty virtualizer.

Existing All Network zero-result canvas guidance remains authoritative for query/filter recovery.

If the Network renderer fails but the current projection is still valid, the DOM Network Explorer should remain usable where practical because it does not depend on Sigma mounting.

This is a useful accessibility/resilience property.

Do not make its rendering conditional on `GlobalGraphView` / `LocalGraphView` successfully mounting.

---

# 20. Focus / live-update / filter transitions

Test sidebar correctness through:

```text
All Network → Focus Network
Focus reroot
Hops 1/2/3
Direction incoming/outgoing/both
Hierarchy Depth in Focus Network
manual +/- disclosure
QUERY1 apply/clear
simple filters
Saved Filter apply
Visual Group style changes
live vault update
Back/Forward
```

Expected:

```text
sidebar node/adjacency model follows the new projection
without creating extra projection work
```

When switching All ↔ Focus while the drawer is open, keep it open because Layout remains Network.

When switching Network → Hierarchy, close it.

---

# 21. Context menu and query integration are NOT part of B2

Do not implement:

```text
right-click custom menu
Focus action from sidebar
Inspect action from sidebar
Hide action
QUERY1 editor inside sidebar
Hidden chips
add/remove exact-path exclusions from UI
```

These are KG14B3.

Normal right-click may retain browser/default behavior in B2.

Do not add placeholder disabled menu items.

---

# 22. Files / likely areas

Probable areas to inspect/change:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/NetworkExplorer.tsx            (new, likely)
apps/web/src/network-explorer-model.ts                 (new, likely)
apps/web/src/App.css
apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PRODUCT_QUALITY_AUDIT.md
```

Potential test modules:

```text
apps/web/src/network-explorer-model.test.ts
apps/web/src/components/NetworkExplorer.test.tsx
GraphExplorer integration tests
```

Reuse:

```text
@icarus-graph-explorer/explorer-inspection
@icarus-graph-explorer/view-projection
@icarus-graph-explorer/visual-groups
```

Do not move this model into core/canonical packages without a concrete source-neutral need.

Do not touch renderer-sigma internals unless a real missing existing application seam is proven.

---

# Scope

## In scope

- left Network Explorer drawer;
- toolbar toggle + left edge handle + internal close action;
- focus restoration;
- Network-only availability;
- wide Inspector coexistence + narrow mutual exclusion;
- pure projection-derived sidebar model;
- File/Heading/Block/Diagnostic rows;
- Focus root/status/group indicators;
- projected hierarchy/reference adjacency;
- fixed-row virtualization;
- accessible tree semantics;
- complete keyboard navigation;
- sidebar ↔ canvas node selection synchronization;
- semantic center using current zoom;
- zero-projection/layout operation oracles;
- empty/failure behavior;
- browser/Tauri/accessibility QA;
- audit/architecture docs;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

- query editor relocation;
- Hide/query mutation UI;
- context menu;
- Focus/Inspect sidebar actions;
- Hidden chips;
- Saved Filter deletion polish;
- QUERY1 parse live announcement (B4);
- desktop packaging/CSP (KG14C);
- source status/progress (KG14D);
- repeated-reference Inspector polish (KG14E);
- renderer zoom changes;
- new projection semantics;
- new persistence schema;
- new external dependency by default.

---

# Suggested implementation sequence

1. Check current `main`, PR #47 status, and user-owned local changes.
2. Inspect Inspector open/close/edge-handle/focus-restoration patterns.
3. Inspect current Global/Focus Network controlled selection and center seams.
4. Add pure `NetworkExplorerModel` derivation from `ViewProjection`.
5. Add source-order/diagnostic/group/Focus-root presentation coverage.
6. Add projected adjacency indexes and model tests.
7. Add fixed-row flattening for expanded adjacency.
8. Implement bounded virtualizer + stress tests.
9. Implement accessible tree keyboard model.
10. Implement `NetworkExplorer` drawer UI.
11. Integrate toolbar toggle + left-edge handle in `GraphExplorer`.
12. Wire sidebar selection to existing Global/Local controlled selection and center callbacks.
13. Wire canvas selection back to sidebar highlight/reveal without stealing focus.
14. Add wide/narrow Inspector coexistence behavior.
15. Test projection/filter/Focus/live-update transitions.
16. Verify sidebar-only interactions cause zero projection/layout work.
17. Run responsive production browser QA.
18. Run release Tauri keyboard/pointer/touchpad smoke; do not alter NETWORKZOOM1 behavior.
19. Update architecture/components/audit docs, but do not touch user-owned `ROADMAP.md` state.
20. Archive this exact prompt under `history-implementations/`.
21. PR → CI → integrate latest `main` if needed → merge → post-merge CI → cleanup.
22. Stop. KG14B3 is next.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/explorer-inspection typecheck
pnpm exec vitest run packages/explorer-inspection

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Task-specific QA:

```text
All + Network Network Explorer open/close
Focus + Network Network Explorer open/close
toolbar button focus restoration
left chevron focus restoration
Network → Hierarchy closes panel
All ↔ Focus keeps panel open
wide Network Explorer + Inspector coexistence
narrow drawer mutual exclusion

File / Heading / Block / Diagnostic rows
Focus-root indicator
Visual Group indicator
zero-node state

expand/collapse adjacency
hierarchy parent/child rows
outgoing/incoming reference rows
aggregated reference counts/status

ArrowUp/Down/Home/End
ArrowRight/Left expansion/navigation
Enter/Space select+center
virtualized offscreen keyboard traversal
screen-reader names/levels/expanded/selected state

sidebar select → Sigma select/center
canvas select → sidebar highlight/reveal
edge selection does not corrupt sidebar node selection
selection center preserves current Network zoom

QUERY1/filter projection changes
Focus hops/direction/depth/disclosure
Saved Filter apply
Visual Groups change
live update/reroot
Back/Forward

stress projection with thousands of nodes
bounded DOM row count
scroll/expand causes zero graph projection/layout work
normal console clean
```

If PR #47 merges before B2 finishes, repeat the relevant Network native smoke on the rebased result.

No CI timing threshold.

---

# Exit gate

KG14B2 is complete only when:

1. Network Explorer exists as a left-side drawer.
2. It is user-facing as `Network Explorer`.
3. It is available in All + Network.
4. It is available in Focus + Network.
5. It is absent/closed in Hierarchy.
6. It opens from a toolbar button.
7. It opens from a left-edge `›` handle.
8. It has an internal close action.
9. open/close focus restoration matches Inspector quality.
10. panel open state is transient and not persisted.
11. opening/closing causes zero projection/layout work.
12. drawer overlays rather than changes graph topology/layout.
13. wide layouts can show Network Explorer and Inspector together.
14. narrow layouts avoid two drawers obscuring the workspace.
15. the top-level list derives from current `ViewProjection`.
16. no Sigma/Graphology introspection is used for the node list.
17. every projected entity node is represented.
18. projected diagnostic target nodes are represented.
19. File/Heading/Block/Diagnostic are textually distinguishable.
20. Focus root is visibly/accessibly identified.
21. winning Visual Group name is non-color-accessible where present.
22. top-level ordering is deterministic and layout-position independent.
23. expanding a row exposes only current projected adjacency.
24. hierarchy parent/child relationship is understandable.
25. outgoing/incoming reference relationship is understandable.
26. projected reference status/count remains available.
27. internal reference count does not become a fake edge.
28. expansion state is sidebar-only and memory-only.
29. stale expansion state survives projection changes safely.
30. the list is genuinely virtualized/windowed.
31. large logical lists do not create an unbounded DOM node count.
32. virtualized keyboard navigation can reach every logical row.
33. tree/treeitem semantics are valid and useful.
34. roving focus is stable across virtualization.
35. ArrowUp/Down work.
36. Home/End work.
37. ArrowRight/Left expansion/navigation work.
38. Enter/Space select and center node targets.
39. history shortcuts do not interfere with tree keyboard input.
40. sidebar row selection uses the same controlled graph selection.
41. row selection centers All Network.
42. row selection centers Focus Network.
43. centering preserves current active Network zoom when available.
44. row selection does not create navigation history.
45. canvas node selection highlights/reveals the top-level row.
46. canvas selection does not steal DOM focus into the sidebar.
47. graph edge selection remains intact without fake node selection.
48. Network Explorer can remain usable if Sigma mount fails but projection is valid.
49. All↔Focus projection changes update the sidebar correctly.
50. QUERY1/filter changes update it correctly.
51. Focus hops/direction/depth/disclosure update it correctly.
52. live updates cannot leave stale crashing rows.
53. Visual Group changes update indicators without changing topology.
54. sidebar scroll/expand causes zero graph projection/layout operations.
55. no Hide/context-menu/query-editor integration is implemented.
56. KG14B1 exact-path APIs remain untouched semantically.
57. NETWORKZOOM1 behavior/files are not modified unnecessarily.
58. no view-state schema bump occurs.
59. no new external dependency is added unless explicitly approved after a blocker report.
60. browser responsive QA passes.
61. keyboard/accessibility QA passes.
62. release Tauri smoke passes.
63. full `pnpm check` passes.
64. desktop check/build pass.
65. PR CI passes.
66. post-merge CI passes.
67. user-modified `AGENTS.md` remains untouched.
68. user-owned ROADMAP/local deletion state is not restored/changed by this task.
69. concurrent NETWORKZOOM1 worktree/branch remains intact until its own lifecycle finishes.
70. task branch/worktree cleanup completes.
71. prompt is archived.
72. KG14B3 is not started automatically.

---

# Documentation

Update the minimum useful current docs, likely:

```text
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/PRODUCT_QUALITY_AUDIT.md
```

Document the key architectural rule:

```text
Sigma canvas = spatial visual presentation
Network Explorer = synchronized accessible DOM representation
both consume the same current ViewProjection
```

If KG14A-02 is fully satisfied by the final implementation/QA, mark that finding as addressed by KG14B2 while leaving the remaining KG14B accessibility-feedback work for B4.

Do not rewrite historical prompts/ADRs.

Do not touch `docs/ROADMAP.md` in this task.

---

# Final report

## 1. Summary

Describe the final Network Explorer interaction.

## 2. Architecture

Explain:

```text
ViewProjection
→ pure Network Explorer model
→ virtualized accessible drawer

ViewProjection
→ Sigma renderer
```

and confirm there is no duplicate graph truth.

## 3. Open/close + responsive behavior

Toolbar, left handle, focus restoration, Inspector coexistence.

## 4. Node/adjacency model

Entity kinds, diagnostics, reference/hierarchy relationships, Visual Groups.

## 5. Virtualization

Logical row count versus maximum mounted DOM rows and stress evidence.

## 6. Accessibility

Keyboard model, ARIA structure, screen-reader path, focus behavior.

## 7. Selection synchronization

Sidebar → canvas and canvas → sidebar, including center/zoom behavior.

## 8. Performance / operation counts

Confirm drawer scroll/expansion is graph-work-free.

## 9. Tests / browser / Tauri QA

## 10. Concurrent NETWORKZOOM1 status

State whether PR #47 merged during the task and what integration was required.

## 11. Files changed

## 12. Dependencies

Expected additions: zero.

## 13. User-owned local state

Confirm `AGENTS.md`, ROADMAP deletion/state, unrelated files, and concurrent worktrees were not disturbed.

## 14. Follow-up

State:

```text
KG14B2 complete
KG14B3 — Network Explorer query + Focus / Inspect / Hide actions — next
```

Do not implement KG14B3 automatically.
