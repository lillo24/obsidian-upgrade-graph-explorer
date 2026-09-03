# NETWORKPOLISH1 — Foldered Network Explorer + Persistent Focus Reference Lines

**Task type:** Network Explorer UI refinement + accessible folder tree + Focus Network LOD correction

## Goal

Implement two user-confirmed refinements while deliberately leaving the sparse-graph spacing/camera problem for a later discussion.

### A. Simplify the Network Explorer

Replace expandable graph-connection rows with a tree based on the actual Obsidian/workspace folder structure already encoded in canonical `sourcePath`.

Target:

```text
Network Explorer
Query [..........................] ✓
[Saved queries]

▾ Integrating the ideas
  ▾ Associated Values
    ▸ Archive
    Liking
    Motivation
  Memory

Diagnostic: Missing target
```

The sidebar should provide source orientation + precise graph-node selection/actions.

The Inspector remains the place for incoming/outgoing links, occurrences, provenance, and relationship detail.

### B. Keep Focus reference lines visible when zoomed out

Focus Network currently hides reference edges when its Local LOD becomes `far-local`.

Change that policy to:

```text
near   → visible
normal → visible
far    → still visible, but it may become thinner/fainter
```

Do not change All + Network's separate far-distance edge policy.

---

## Current repository evidence

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
b81cc2cdd93ec7dd314189616efec3717ae81d18
```

Relevant merged work:

```text
#48 KG14B1 — exact-path QUERY1 exclusions
#50 KG14B2 — accessible virtualized Network Explorer
#52 KG14B3 — query + Focus / Inspect / Hide actions
```

Current Network Explorer still builds adjacency for every projected node and can expand:

```text
parent
child
incoming
outgoing
```

Current compact `GraphQueryEditor` still exposes when dirty:

```text
Draft not applied
Reset draft
```

Current Saved Filters/Saved Queries management remains visibly inside `GraphFilters`.

Current Focus LOD is implemented in:

```text
packages/renderer-sigma/src/local-style.ts
```

with:

```ts
if (cameraRatio > 1.25) return 'far-local'
```

and reference edges become:

```ts
hidden:
  context.lod === 'far-local' &&
  !hierarchy &&
  !(context.hoverActive && context.relatedToHover)
```

That hide rule is the direct cause of the reported disappearing Focus lines.

---

## Concurrent VISUAL1B — hard constraint

At plan-writing time:

```text
PR #51 — VISUAL1B: per-file Network size overrides
status: draft / unmerged
```

It is already rebased onto current `main` and extends the existing KG14B3 Network Explorer action menu with a File-only `Size` action/editor.

It overlaps shared files including:

```text
NetworkExplorer.tsx
NetworkExplorerMenu.tsx
network-explorer-context.ts
GraphExplorer.tsx
App.css
renderer-sigma mapping/canvas files
```

Rules:

1. Do not modify/reset/delete PR #51's worktree or branch.
2. Use a separate task branch/worktree from current `main`.
3. This task may merge before PR #51.
4. Preserve the canonical File-row/action seam so VISUAL1B can rebase afterward.
5. Do not add another context menu.
6. Do not implement Size here.
7. Do not claim this task fixes the separate Network layout/flicker issue currently blocking VISUAL1B native QA.
8. If #51 merges first, update this task onto latest `main` and preserve Size behavior exactly.

---

# 1. Remove expandable connection rows

Remove the sidebar concept:

```text
node
  ▸ parent/child/incoming/outgoing graph relationships
```

Do not merely hide the controls with CSS.

Simplify the Network Explorer model/UI so:

```text
folders → collapsible
graph nodes → selectable/actionable, not connection-collapsible
```

Underlying `ViewProjection.edges` remain untouched.

The Inspector continues to expose relationship details.

Remove obsolete sidebar-specific:

- adjacency row types where no longer needed;
- adjacency flattening;
- relationship glyph/label helpers;
- relationship-count text in accessible row names;
- ArrowLeft/Right logic that expands graph connections.

---

# 2. Derive folders only from canonical `WorkspacePath`

Use existing normalized workspace-relative `sourcePath`.

Example:

```text
Main idea.md
Integrating the ideas/Liking.md
Integrating the ideas/Associated Values/Motivation.md
Integrating the ideas/Associated Values/Archive/Old.md
```

must produce:

```text
Main idea.md

Integrating the ideas/
  Liking.md
  Associated Values/
    Motivation.md
    Archive/
      Old.md
```

Do not derive grouping from:

- graph links;
- Visual Groups;
- title similarity;
- QUERY1;
- ForceAtlas2 positions;
- custom metadata;
- a new grouping registry.

This is source-folder presentation only.

Custom/virtual foldering is deferred.

---

# 3. Keep it projection-scoped

Network Explorer remains a companion to the **current Network projection**.

Build the folder tree from source-backed nodes that are currently represented by the Network projection.

Therefore:

```text
query/filter hides all nodes from folder
→ folder disappears from current sidebar

nodes return
→ folder returns
```

Do not independently enumerate the entire vault.

Folder nodes are UI scaffolding, never canonical graph nodes.

---

# 4. Files, Headings, Blocks

Every currently projected canonical entity must remain reachable.

Preferred structure:

```text
source folder
  File
    currently projected Heading/Block rows
```

But **File is not another disclosure control**.

If Headings/Blocks are currently visible, show them beneath their containing File without adding File expand/collapse state.

Only source folders should own new disclosure state.

Keep concepts separate:

```text
folder disclosure
≠ graph relationship disclosure
≠ KG6 structural disclosure
```

If repository invariants make a slightly different deterministic placement safer, adapt after inspection, but do not reintroduce node relationship expansion.

---

# 5. Diagnostics

Diagnostic target nodes have no canonical `sourcePath`.

Do not invent a fake Obsidian folder for them.

Keep them reachable as root-level trailing rows, clearly labelled `Diagnostic`.

Do not infer a folder from raw target text.

---

# 6. Default folder collapse policy

User requirement:

```text
Folder depth 1 → expanded
Folder depth 2 → expanded
Folder depth 3+ → collapsed
```

Example:

```text
Folder 1/
  Folder 2/
    Folder 3/  ← collapsed by default
```

Root is not counted as a folder level.

Folder state is:

```text
memory-only
Network-Explorer-only
keyed by canonical folder path
```

Do not persist it in view-state or graph preferences.

User toggles should override defaults during the current app/sidebar lifetime.

Projection/query/live changes must not reset surviving user folder state.

Newly appearing folders initialize according to their depth.

---

# 7. Accessible folder-tree keyboard model

Keep the current virtualized accessible tree architecture, but make folders the disclosure items.

Logical rows:

```text
Folder
File
Heading
Block
Diagnostic
```

Required:

```text
ArrowDown / ArrowUp → next/previous visible logical row
Home / End          → first/last visible logical row

ArrowRight on collapsed folder → expand
ArrowRight on expanded folder  → first child

ArrowLeft on child              → parent folder
ArrowLeft on expanded folder    → collapse

Enter / Space on graph node     → existing select + center
Enter / Space on folder         → toggle, or preserve standard tree behavior
```

Folder rows:

```text
role=treeitem
aria-expanded
not aria-selected as graph selection
```

Graph-node rows retain selection semantics and context actions.

Folder rows must never offer Focus / Inspect / Hide / Size.

---

# 8. Preserve virtualization

Do not render all source nodes at once.

Preferred pipeline:

```text
current projected nodes
→ source folder tree
→ apply folder collapsed state
→ flatten visible logical rows
→ existing fixed-height virtual window
```

Stress-test thousands of files and deep paths.

No new virtualization dependency.

---

# 9. Preserve KG14B3 node actions

Keep one existing node action system:

```text
Focus
Inspect
Hide file
```

VISUAL1B may later add `Size`.

Right-click, Shift+F10, ContextMenu key, and visible Actions button continue to work on graph-node rows.

Folder rows have no node-actions menu.

Update `network-explorer-context` only as needed to support the new row union safely.

---

# 10. Remove relationship-oriented sidebar copy

Update copy such as:

```text
Visible network nodes and relationships
```

to something like:

```text
Visible network nodes by source folder
```

Remove adjacency relationship counts from node accessible names.

Inspector relationship/provenance text is unchanged.

---

# 11. Remove compact dirty-draft clutter

In **compact Network Explorer mode**, remove visible:

```text
Draft not applied
Reset draft
```

Keep:

```text
textarea
Apply icon
Clear icon
validation errors
```

Do not delete the underlying KG14B3 draft state/controller or atomic Hide/restore safety.

This is a UI simplification only.

Hierarchy's fuller query editor may retain its current dirty/reset affordance unless a tiny shared-component change is clearly safer.

---

# 12. Move Saved Queries behind a compact sidebar button

For Network layouts add a compact:

```text
Saved queries
```

button near/below the query control.

Opening it exposes the existing management:

```text
save current query
name
saved list
apply
delete
status/errors
```

Use the existing `SavedGraphFilterRegistry`; no schema migration and no second store.

Prefer extracting reusable saved-query UI from `GraphFilters` instead of duplicating it.

Final placement:

```text
Network
→ live query in Network Explorer
→ Saved queries behind Network Explorer button
→ GraphFilters does not duplicate Saved Queries

Hierarchy
→ query editor in Filters
→ Saved Queries remain available in Filters
```

User-facing wording can be `Saved queries`; internal `SavedGraphFilter*` names can remain unchanged.

The Saved Queries surface must be keyboard accessible, viewport-bounded, Escape/outside dismissible, and restore focus safely.

Do not add Saved Filter delete confirmation/undo here.

---

# 13. Sidebar presentation must not change graph semantics

Operations:

```text
open/close folder
open/close Saved queries
open/close Network Explorer
```

must trigger:

```text
0 projection updates
0 workspace work
0 ForceAtlas2 requests
0 Dagre requests
```

Folder collapse must never mutate QUERY1/path filters.

Applying a Saved Query intentionally uses the existing semantic QUERY1/history path.

---

# 14. Focus reference edges: never hide solely because of far LOD

Required invariant:

```text
resolveLocalEdgeStyle(reference, far-local, no hover)
→ hidden === false
```

This must remain true through the maximum supported Focus camera ratio.

Keep `far-local` itself because it still supports useful label/detail simplification.

Do not merely move the `1.25` threshold farther away.

The new semantic rule is:

```text
far-local
→ simplify visual detail
→ never delete/hide Focus reference relationships
```

---

# 15. Keep All + Network unchanged

Do not change:

```text
resolveGlobalVisualLod
resolveGlobalEdgeStyle
Global weak-edge far-LOD behavior
```

The reported problem is Focus-specific.

---

# 16. Focus far-edge visual treatment

Keep a conservative fade/thinning policy.

Preferred:

```text
near reference   → current full width
normal reference → current moderate thinning
far reference    → thinner/fainter but visible
```

The existing far reference multiplier can remain near `0.45` if native QA shows it is actually readable after `hidden=false`.

If it becomes functionally invisible, raise only the far reference minimum modestly.

Do not add a user-facing edge-LOD setting.

Hover emphasis remains intact.

---

# 17. Explicitly do NOT solve spacing/camera here

The user wants to continue discussing sparse Focus spacing separately.

Do not modify:

```text
ForceAtlas2 scalingRatio
gravity
strongGravityMode
layout normalization
post-layout coordinate scaling
Fit
camera framing
Sigma autoRescale
zoomToSizeRatioFunction
node-size/zoom relationship
sparse graph density
```

Do not attempt to solve:

```text
few nodes are too far apart
```

in this task.

Also do not change VISUAL1B size formulas.

---

# 18. Do not fix the separate VISUAL1B flicker here

PR #51 reports a separate Network movement/layout flicker blocking its native QA.

This prompt does not investigate that issue.

Only renderer behavior needed for Focus far-edge visibility is in scope.

If a directly related defect is discovered, report it separately rather than broadening this PR.

---

## Likely files

Inspect current code first. Likely:

```text
apps/web/src/network-explorer-model.ts
apps/web/src/network-explorer-model.test.ts
apps/web/src/network-explorer-context.ts
apps/web/src/network-explorer-context.test.ts

apps/web/src/components/NetworkExplorer.tsx
apps/web/src/components/NetworkExplorer.test.tsx
apps/web/src/components/GraphQueryEditor.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/GraphExplorer.tsx

possibly new reusable SavedQueries/SavedFilters component
apps/web/src/App.css

packages/renderer-sigma/src/local-style.ts
packages/renderer-sigma focused tests

apps/web/src/components/README.md
apps/web/README.md
packages/renderer-sigma/README.md
docs/ARCHITECTURE.md
```

Preserve current `AGENTS.md` instruction content exactly.

No ROADMAP change is required.

---

## Scope

### In scope

- remove Network Explorer adjacency/connection disclosure;
- folder tree from visible canonical source paths;
- folder depth 1/2 expanded, 3+ collapsed by default;
- memory-only folder state;
- File/Heading/Block/Diagnostic accessibility;
- folder keyboard navigation;
- virtualization preservation;
- existing node actions preserved;
- compact `Draft not applied` / `Reset draft` removal;
- Saved Queries button/panel in Network Explorer;
- no duplicate Saved Queries in Network Filters;
- Hierarchy Saved Queries preserved;
- Focus reference edges remain visible at far LOD;
- browser/release QA;
- docs/prompt archive;
- PR/CI/cleanup.

### Explicitly out of scope

- sparse graph spacing;
- camera fit/framing;
- ForceAtlas2 tuning;
- node-size/zoom redesign;
- custom/virtual folders;
- persisted folder-open state;
- folder drag/reorder;
- folder-based graph filtering;
- Inspector redesign;
- QUERY1 grammar;
- Saved Query schema/storage redesign;
- Saved Query delete confirmation;
- Size implementation;
- VISUAL1B flicker fix;
- All Network far-edge policy;
- KG14B4 general accessibility work.

---

## Suggested implementation sequence

1. Sync current `main`.
2. Check PR #51 status; preserve its worktree/branch.
3. Remove adjacency-row behavior from Network Explorer model/UI/tests.
4. Add pure source-folder tree derivation from `WorkspacePath`.
5. Add deterministic folder default-state logic.
6. Flatten visible folder/node rows.
7. Adapt virtualizer and selection reveal.
8. Adapt tree keyboard behavior.
9. Preserve node context actions; disable actions for folders.
10. Remove compact dirty/reset copy.
11. Extract/reuse Saved Queries UI and add Network button.
12. Remove Network duplicate Saved Queries from Filters; keep Hierarchy.
13. Change Local far-edge style to keep references visible.
14. Add focused LOD tests.
15. Run accessibility/virtualization stress tests.
16. Browser QA across All/Focus/query/live update.
17. Release desktop QA, especially Focus zoom-out edge visibility.
18. Update minimal docs.
19. Archive this exact prompt under `history-implementations/`.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop; do not start spacing/framing work.

---

## Validation

Use current repo equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Task-specific QA:

```text
FOLDERS
root file
Folder1
Folder1/Folder2
Folder1/Folder2/Folder3
depth 1/2 open by default
depth 3+ collapsed
manual folder toggles
state survives ordinary query/live membership changes
no adjacency rows
no relationship counts/glyphs
Heading/Block reachable
Diagnostic reachable without fake folder

KEYBOARD
ArrowUp/Down/Home/End
ArrowRight/Left folder behavior
node Enter/Space select+center
folder never graph-selects
right-click/Shift+F10 node actions
folder has no node action
virtual offscreen navigation
5000+ logical rows bounded

QUERY UI
no compact "Draft not applied"
no compact "Reset draft"
Apply/Clear remain
invalid query still visible
KG14B3 dirty-draft Hide/restore tests remain green

SAVED QUERIES
Network button
open/close/focus restore
save/apply/delete existing semantics
no duplicate in Network Filters
Hierarchy still exposes Saved Queries
Back/Forward after Apply
narrow/short containment

FOCUS EDGES
near reference visible
normal reference visible
far reference visible without hover
far hover emphasis
maximum camera ratio still visible
hierarchy edges unchanged
Global far-edge tests unchanged

REGRESSIONS
All Network
Focus Network
Focus hops/direction/depth
QUERY1 Hide/restore
Visual Groups
Inspector
NETWORKZOOM1
no ForceAtlas2/camera changes
clean console
```

No CI timing threshold.

---

## Exit gate

Complete only when:

1. adjacency/connection rows are gone from Network Explorer;
2. Inspector remains the relationship-detail surface;
3. folder grouping derives only from current visible canonical `sourcePath`;
4. no custom semantic folder truth is added;
5. root files render correctly;
6. nested folders render correctly;
7. folder levels 1 and 2 default expanded;
8. folder level 3+ defaults collapsed;
9. folder disclosure is memory-only;
10. folder toggles are graph-work-free;
11. surviving folder state is not reset by ordinary projection changes;
12. Headings/Blocks remain accessible;
13. diagnostics remain accessible without fake folders;
14. node action menu still works;
15. folder rows expose no node actions;
16. virtualization remains bounded;
17. keyboard folder navigation works;
18. graph selection/centering remains node-only;
19. B2 external-selection reveal does not regress;
20. compact Network query shows neither `Draft not applied` nor `Reset draft`;
21. query draft/Hide safety remains unchanged internally;
22. Network Explorer has a compact Saved queries button;
23. Saved Queries reuse the current registry/storage;
24. Network Filters do not duplicate Saved Queries;
25. Hierarchy retains Saved Queries;
26. Saved Query Apply retains normal history;
27. Focus reference edges never hide solely due to `far-local`;
28. far Focus edges remain readable;
29. label LOD still simplifies normally;
30. hover emphasis still works;
31. All/Global far-edge behavior is unchanged;
32. no ForceAtlas2 settings change;
33. no spacing/camera normalization is implemented;
34. no VISUAL1B size semantics are changed;
35. PR #51 worktree/branch remains intact;
36. this task does not claim to fix PR #51 flicker;
37. no new external dependency;
38. focused tests pass;
39. full `pnpm check` passes;
40. desktop check/build pass;
41. browser QA passes;
42. release Focus zoom-out QA passes;
43. PR CI passes;
44. post-merge CI passes;
45. current `AGENTS.md` content remains intact;
46. task worktree/branch cleanup completes;
47. prompt is archived;
48. spacing/framing work is not started automatically.

---

## Final report

Report briefly:

### 1. Sidebar result
Final folder-tree behavior and default depth policy.

### 2. Data model

```text
current ViewProjection
→ visible sourcePath
→ UI-only folder tree
→ virtualized rows
```

Confirm no custom folder truth.

### 3. Relationship removal
Adjacency rows removed; Inspector remains authoritative.

### 4. Query UI
Dirty/reset clutter removed without changing query-draft semantics.

### 5. Saved Queries
Button/panel placement and reuse of existing Saved Filter registry.

### 6. Focus edge LOD
Old hide behavior and final far-edge behavior.

### 7. Performance/semantics
Folder interactions cause no graph work; Global LOD unchanged.

### 8. VISUAL1B concurrency
PR #51 status and whether it must rebase onto this merge.

### 9. Tests/browser/desktop QA

### 10. Files changed / dependencies

### 11. Follow-up

State explicitly:

```text
Sparse Focus graph spacing / normalization / camera framing remains unresolved
and was intentionally not changed.
```
