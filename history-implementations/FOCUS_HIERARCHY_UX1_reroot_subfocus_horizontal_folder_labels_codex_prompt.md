# FOCUS-HIERARCHY-UX1 — Fix File Reroot Blank Screen, Add Heading/Block Subfocus, and Horizontal Folder Labels

**Task type:** Focus Hierarchy interaction/navigation correction + presentation subfocus + folder-label polish.

## Goal

Continue the currently open Focus Hierarchy work and address three founder QA requests together.

1. **Fix the File→File reroot blank-screen bug.**
   - While already inside Focus Hierarchy, double-clicking another ordinary File can produce a blank screen.
   - The founder reproduced this with Files such as `Useful References` and `Symbol.md`.
   - These are **Files/documents, not Headings**.
   - File double-click must continue to mean:
     ```text
     reroot Focus to that File
     ```
     and must never blank the graph.

2. **Add Heading/Block subfocus inside the existing File Focus.**
   - Double-click a Heading to visually focus that Heading subtree + its actual rendered connections.
   - Double-click a Block for exact-Block subfocus.
   - The containing File remains the canonical Focus root.
   - Unrelated graph content remains visible but becomes strongly transparent.
   - Back / Ctrl+Z returns to the previous ordinary Focus presentation.

3. **Make folder + parent-folder labels horizontal.**
   - Current:
     ```text
     Folder
     Parent
     ```
   - Desired:
     ```text
     Folder | Parent
     ```
   - Keep the parent smaller/muted.
   - Keep the folder name primary.
   - Keep the accepted top-horizontal-edge label anchor unchanged.

Do not merge before founder native graphical QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At prompt-writing time:

```text
PR #106
branch: codex/hier4b-spacing-slider
head: eba13fe9cddc370a79de6a356b322ca9abbd4198
base / latest integrated main: 7a808f9b4109b6811df5d36405173ec2b90de3bf
state: OPEN / UNMERGED / mergeable
```

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #106 is still open and record its current head;
4. inspect whether `main` advanced;
5. integrate latest `main` according to repository workflow if needed;
6. preserve unrelated work;
7. update the same PR #106 unless current repository state clearly requires a separate PR;
8. record exact starting SHAs.

This task is graphical/interactions-sensitive.

Do **not** merge before explicit founder QA.

---

# Current repository facts

## Entity kinds

React Flow entity nodes expose:

```text
entityKind:
  document
  section
  block
```

and:

```text
typeLabel:
  File
  Heading
  Block
```

Current `GraphCanvas` double-click behavior routes every entity through the same generic:

```text
onFocusEntity(entityId)
```

That is too coarse for Local Focus Hierarchy after this task.

## Canonical Focus architecture

The Focus projection is deliberately document-rooted.

`deriveLocalProjectionState(...)` normalizes File / Heading / Block targets to their containing document as the stable Focus root.

Do **not** change KG6 so a Heading becomes the canonical Focus root.

Heading/Block subfocus is a **presentation subfocus inside the current File Focus**, not a new canonical graph scope.

## Existing graph-history shortcuts

Current graph-context behavior already supports:

```text
Alt+Left                 → Back
Alt+Right                → Forward

Ctrl+Z / Meta+Z          → Back
Ctrl+Shift+Z / Meta+Shift+Z
                         → Forward
```

Editable controls preserve native text undo, and application-overlay contexts guard graph-history shortcuts.

The founder wants:

```text
Heading/Block subfocus
→ Ctrl+Z
→ previous ordinary Focus view
```

Use the existing graph-history system. Do not build a second undo stack.

---

# PART A — Diagnose and fix File→File reroot blank screen

## Founder reproduction

While already inside Focus Hierarchy, for example:

```text
Focus: Language
double-click another File
e.g. Useful References / Symbol
→ blank screen
```

These targets are ordinary Files.

This is not a Heading-subfocus problem.

## Intended behavior

```text
Focus: File A
double-click File B
→ Focus: File B
```

The active Focus presentation remains Focus Hierarchy.

This should create one graph-history checkpoint.

Back / Ctrl+Z should restore File A.

## Current path to inspect

Current high-level flow is approximately:

```text
GraphCanvas document double-click
→ onFocusEntity(...)
→ Local/Modular callback
→ GraphExplorer.focusLocalEntity(...)
→ navigateToEntity(...)
→ planLocalEntityNavigation(...)
→ deriveLocalProjectionState(...)
→ projectLocalView(...)
→ replace Local Focus state
→ rebuild Focus Schematic model/layout
```

Do not guess where the failure occurs.

Possible categories include:

```text
navigation state
projection
transition anchor
history/viewport restoration
Focus Schematic model
FIX5 Focus-neutral folder projection
worker/layout result
prepared-graph adoption
```

Diagnose first.

## A1 — Automated reproduction

Create a synthetic integration fixture:

```text
File A = initial Focus
File B = visible connected neighbor
```

Exercise the same callback path used by double-click in Modular Focus Hierarchy.

Assert after File B activation:

```text
presentation remains Local Focus Hierarchy
focus.rootEntityId == File B
projection non-empty
File B is model/root File
prepared graph non-empty
no Modular fatal fallback
no blank graph
selection/center request valid
```

The test must go beyond `deriveLocalProjectionState(...)`.

## A2 — Report exact cause

Before patching, determine the actual failure.

Final report must state:

```text
File→File reroot blanked because <specific validated cause>
```

No speculation.

## A3 — Never fail silently to blank

After the fix:

```text
successful reroot
→ new Focus graph

failed reroot
→ previous validated graph remains
→ explicit warning/navigation error
```

Never an unexplained empty canvas.

## A4 — History regression

Test:

```text
Focus A
→ double-click File B
→ Focus B
→ Ctrl+Z / Back
→ Focus A
→ Ctrl+Shift+Z / Forward
→ Focus B
```

No duplicate history entries.

## A5 — FIX5 root-neutral folder regression

After reroot:

```text
new Focus File
→ excluded from folder grouping

old Focus File
→ becomes ordinary folder member again if still visible
```

This must update correctly.

---

# PART B — Entity-kind activation dispatch

Inside **Local Focus Hierarchy**:

```text
double-click File
→ existing File reroot

double-click Heading
→ Heading subfocus

double-click Block
→ Block subfocus
```

Do not route Heading/Block subfocus through File reroot navigation.

Preferred renderer API shape:

```text
onFocusEntity(document)
onSubfocusEntity(section/block)
```

or equivalent.

When `onSubfocusEntity` is absent, preserve existing behavior so All Hierarchy is not accidentally changed.

Scope subfocus to Focus Hierarchy. Do not implement it in Focus Network in this task.

Prefer shared React Flow behavior so Classic and Modular Focus Hierarchy do not diverge if the architecture permits it.

---

# PART C — Subfocus state

Use one explicit web-layer state, conceptually:

```ts
type FocusHierarchySubfocus =
  | {
      entityId: EntityId;
      kind: 'section' | 'block';
    }
  | null;
```

Use canonical EntityId, not renderer IDs.

Entering subfocus must NOT change:

```text
ViewProjectionState.focus.rootEntityId
Focus hops/direction
filters
folder hierarchy
Soft layout
worker structural result
layout cache key
Saved View semantics
```

The File remains canonical Focus.

---

# PART D — Heading subfocus semantics

For a Heading anchor, **primary** content is:

```text
1. the Heading itself
2. currently projected structural descendants of that Heading
   (nested Headings / Blocks)
3. hierarchy edges inside that subtree
4. reference edges whose rendered precise endpoint touches any node in the subtree
5. the opposite rendered endpoint of those reference edges
```

The goal is:

```text
show this Heading's content and its actual graph connections
```

Do not promote all File-level aggregate connections just because the containing File has them.

Use current rendered/projected truth.

---

# PART E — Block subfocus semantics

For a Block:

```text
primary anchor = exact Block
```

Primary connections:

```text
reference edges incident to that exact rendered Block
+ opposite rendered endpoints
```

No synthetic subtree unless the canonical model truly gives the Block descendants.

---

# PART F — Three visual tiers

## Primary

```text
subfocus anchor
Heading subtree / exact Block
exact relevant reference edges
opposite endpoints
```

Target opacity:

```text
100%
```

## Context

Keep enough orientation to understand location:

```text
containing File
structural ancestor Heading chain
containing module boundary
```

Optionally the containing File/module of a connected opposite endpoint if useful.

Target opacity:

```text
~25–35%
```

## Unrelated

Everything else remains rendered but strongly transparent.

Founder requirement:

```text
non-connected Files / Headings / Blocks should be very transparent
```

Target opacity:

```text
~5–10%
```

Apply similarly to unrelated edges.

Do not remove unrelated nodes from the semantic graph or accessibility tree.

---

# Folder guides during subfocus

Do not recompute folder geometry.

Prefer folder guides/labels at context/deemphasized opacity so they do not compete with the subfocus.

---

# Optional visual scrim

A translucent middle layer is optional.

First satisfy the hard requirement using node/edge opacity tiers.

If a scrim improves legibility and is cleanly implementable:

```text
renderer-only
pointer-events:none
not an application overlay
```

Do NOT use the application overlay system, because current graph-history shortcut guards disable Ctrl+Z in that state.

Do not add a scrim if z-index/hit-testing becomes fragile.

---

# PART G — Persistent subfocus + hover

Subfocus persists until navigation changes it.

Hover remains transient.

Required composition:

```text
subfocus tier = baseline
hover can emphasize inside that baseline
hovering an unrelated dim node must NOT make the whole unrelated neighborhood fully opaque
```

Do not overload transient `is-highlighted` / `is-deemphasized` if it makes composition ambiguous.

Prefer dedicated classes such as:

```text
is-subfocus-primary
is-subfocus-context
is-subfocus-dimmed
```

Selection remains independent.

---

# PART H — Enter / replace / exit

## Enter

```text
normal Focus Hierarchy
double-click Heading/Block
→ enter subfocus
→ one history action
```

No layout worker rerun.

## Replace

```text
Heading A subfocus
double-click Heading B
→ Heading B subfocus
→ one new history checkpoint
```

Back returns to A.

## Exit

Required:

```text
Back
Ctrl+Z / Meta+Z
→ previous checkpoint
```

If previous checkpoint had no subfocus:

```text
ordinary Focus restored
```

Also support Escape.

Prefer Escape to use the same semantic history transition so Forward can restore subfocus, if that matches current history conventions.

## File reroot while subfocused

```text
subfocus
→ double-click File B
→ clear subfocus
→ reroot Focus B
→ record normal File navigation
```

Back should be able to restore previous Focus + subfocus if still valid.

---

# PART I — History integration

Current `GraphHistoryCheckpoint` stores:

```text
presentationMode
ViewProjectionState
semantic viewports
```

Subfocus is not ordinary selection because the user expects Back/Ctrl+Z to restore it.

Extend graph history explicitly.

Conceptually:

```ts
interface GraphHistoryCheckpoint {
  ...
  readonly focusHierarchySubfocus?: {
    readonly entityId: EntityId;
    readonly kind: 'section' | 'block';
  };
}
```

Requirements:

```text
current checkpoint captures it
sameGraphHistoryCheckpoint compares it
Back/Forward restores it
normalization does not coalesce it away
File reroot destination clears it
ordinary state actions preserve/clear it intentionally
```

Subfocus remains **session-only**.

Do NOT add it to:

```text
Saved Views
workspace persisted view
Graph Preferences
localStorage persistence
```

unless the current architecture unexpectedly persists navigation history.

Reload may return to normal Focus without subfocus.

---

# Ctrl+Z safety

Preserve current rules:

```text
editable input/textarea/contenteditable
→ native text undo

eligible graph context
→ graph Back

application dialog/overlay
→ graph shortcut guarded off
```

Add tests proving:

```text
graph Ctrl+Z exits Heading subfocus
input Ctrl+Z does NOT
```

---

# Subfocus reconciliation

Clear/reconcile subfocus safely when:

```text
exit Focus to All
switch Focus Hierarchy → Focus Network
workspace reload
target entity removed by live update
target no longer projected
```

If Back restores a checkpoint whose subfocus target no longer exists:

```text
drop the stale subfocus
restore the remaining graph checkpoint
announce reconciliation
```

No crash or blank graph.

---

# PART J — Renderer implementation

Prefer a pure helper, conceptually:

```text
deriveFocusHierarchySubfocusPresentation(...)
applyFocusHierarchySubfocus(...)
```

Target complexity:

```text
O(nodes + edges)
```

No worker/layout/network call.

Primary/context/dim classes should be stable and theme-driven.

Primary content should render visually above dim content where necessary.

Do not let dim module boundaries or folder guides cover primary cards.

Accessibility:

```text
do not aria-hide unrelated entities
do not disable keyboard navigation globally
```

Provide a concise status announcement when subfocus enters/exits.

---

# PART K — Folder label formatting

Current folder chip stacks Folder and Parent vertically.

Current parent styling is already:

```text
smaller
muted
lighter weight
```

Preserve it.

Required visual:

```text
FolderName | ParentName
```

Example:

```text
Philosophy to practice | General Pattern
```

Folder remains primary.

Parent remains smaller/muted.

## Separator

Use:

```text
|
```

with balanced horizontal spacing.

If accessibility already announces Parent through the existing aria-label:

```text
separator aria-hidden
```

so screen readers do not read "bar".

If no parent:

```text
FolderName
```

only, with no separator.

## CSS direction

Prefer:

```text
chip:
  inline-flex/flex
  align-items: baseline

name:
  current primary styling

separator:
  muted/intermediate

parent:
  current 9px-ish smaller styling
  no display:block
  no margin-top
```

Use theme tokens, no hard-coded colors.

Prefer one line; add `white-space: nowrap` only if needed.

## Preserve anchor

Do not change:

```text
label position = start of actual top horizontal guide segment
```

Only change content layout within the chip.

Folder context-menu interaction must remain unchanged.

---

# PART L — Required tests: File reroot

Add at least:

## R1
```text
Focus A → double-click File B
→ Focus B
→ non-empty Modular graph
```

## R2
```text
A → B → C
```
No blank/stale root.

## R3
Back/Forward restore A/B correctly.

## R4
Selection/center requests remain valid.

## R5
FIX5 Focus-neutral folder membership reclassifies new vs old root correctly.

---

# PART M — Required tests: subfocus

## S1 — Heading subtree

Synthetic:

```text
File
├─ Heading A
│  ├─ Block A1
│  └─ Heading A2
└─ Heading B
```

Subfocus A:

```text
A / A1 / A2 primary
B dimmed
File context
```

## S2 — exact reference

```text
Block A1 → OtherFile/OtherHeading
```

Primary:

```text
A subtree
reference edge
OtherHeading exact endpoint
```

Unrelated content dimmed.

## S3 — Block subfocus

Exact Block + exact connection neighborhood.

## S4 — no structural rerun

Changing subfocus does not change:

```text
layout worker compute count
layout cache key
candidate geometry
folder guide geometry
```

## S5 — history

```text
none → Heading A → Heading B → Back → A → Back → none
```

## S6 — Ctrl+Z

Same semantic result as Back in eligible graph context.

## S7 — text undo

Ctrl+Z in editable control leaves subfocus unchanged.

## S8 — Escape

Exit semantics tested.

## S9 — File reroot clears subfocus.

## S10 — live removal safely reconciles.

## S11 — target disappearing from projection never blanks graph.

---

# PART N — Folder label tests

Update/add:

```text
passive-folder-label.test.ts
folder-cluster-guides tests
```

Assert:

```text
Folder + separator + Parent render on one horizontal chip
parent font remains smaller
separator absent without parent
separator accessibility sane
top-edge anchor coordinates unchanged
folder context menu unchanged
```

CSS tests should no longer require:

```text
parent display:block
margin-top
```

and should instead validate baseline horizontal layout.

---

# Interaction sanity

Verify:

```text
single click
→ selection only

double-click File
→ reroot File Focus

double-click Heading/Block in Focus Hierarchy
→ subfocus

right-click
→ existing context menu

folder-label right-click
→ folder display actions unchanged
```

Do not let subfocus activation interfere with disclosure controls inside entity cards.

Keyboard activation should remain coherent with pointer activation; if Enter currently activates canonical Focus, dispatch by entity kind consistently in Focus Hierarchy.

---

# Performance / isolation

Subfocus must be presentation-only.

No:

```text
Soft algorithm change
worker protocol change
layout cache change
Adaptive change
Directional change
folder geometry recomputation
```

unless the File reroot diagnosis proves a real structural contract bug.

Do not bump structural versions merely for:

```text
subfocus
folder label formatting
```

No new dependency unless clearly justified.

---

# Documentation

Update relevant docs, likely:

```text
apps/web/README.md
apps/web/src/components/README.md
packages/renderer-reactflow/README.md
packages/renderer-reactflow/src/focus-schematic/README.md
docs/ROADMAP.md
```

Document:

```text
File double-click reroot
Heading/Block subfocus
primary/context/dim presentation
Ctrl+Z/Back history semantics
session-only subfocus
Folder | Parent label format
```

Do not describe subfocus as a canonical Focus root.

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/navigation-history.test.ts
pnpm exec vitest run apps/web/src/graph-history-shortcuts.test.ts
pnpm exec vitest run packages/renderer-reactflow

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Run narrower suites during implementation.

---

# Native artifact

Build:

```text
focus-hierarchy-ux1-reroot-subfocus-folder-label-native-candidate.exe
```

Report SHA-256.

Update PR #106.

Run CI.

Do not merge.

---

# Native founder QA request

Ask founder to test:

## File reroot

From:

```text
Focus: Language
```

double-click several ordinary Files such as equivalents of:

```text
Useful References
Symbol
```

Expected:

```text
reroot works
graph never blanks
```

Then Ctrl+Z:

```text
previous File Focus restored
```

## Heading subfocus

Double-click a Heading.

Expected:

```text
Heading subtree + exact connections fully visible
structural context moderately visible
unrelated Files/Headings/Blocks/edges very transparent
```

Ctrl+Z restores ordinary Focus.

## Block subfocus

Same at exact Block granularity.

## Folder label

Expected:

```text
FolderName | ParentFolder
```

single horizontal line, parent still smaller/muted.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/FOCUS_HIERARCHY_UX1_reroot_subfocus_horizontal_folder_labels_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. PR #106 remains open/unmerged;
2. latest main integrated if needed;
3. exact File→File blank-screen cause identified;
4. File→File reroot works in Modular Focus;
5. reroot never blanks graph;
6. reroot records one history action;
7. Ctrl+Z restores previous File Focus;
8. Forward restores reroot destination;
9. FIX5 root-neutral folder membership updates correctly after reroot;
10. document double-click remains reroot;
11. Heading double-click becomes subfocus in Focus Hierarchy;
12. Block double-click becomes subfocus in Focus Hierarchy;
13. canonical File Focus root unchanged by subfocus;
14. subfocus does not change ViewProjectionState;
15. subfocus does not rerun layout worker;
16. subfocus does not change layout cache key;
17. Heading subtree primary-set logic correct;
18. exact connected reference endpoints primary;
19. context ancestor chain visible at intermediate opacity;
20. unrelated nodes very transparent;
21. unrelated edges very transparent;
22. persistent subfocus composes safely with hover;
23. selection remains independent;
24. folder geometry unchanged by subfocus;
25. Back restores/clears subfocus correctly;
26. Ctrl+Z restores/clears subfocus correctly;
27. Forward restores subfocus;
28. editable Ctrl+Z remains native text undo;
29. application-overlay history guard unchanged;
30. Escape semantics implemented/tested;
31. File reroot clears active subfocus;
32. stale/removed subfocus target reconciles safely;
33. invalid subfocus never blanks graph;
34. no unnecessary persistence schema added;
35. folder chip horizontal;
36. folder name remains primary;
37. separator shown only with parent;
38. parent remains smaller/muted;
39. separator accessibility sane;
40. top-horizontal label anchor unchanged;
41. folder context menu unchanged;
42. ordinary no-subfocus hover unchanged;
43. Direct/Nested folder geometry unchanged;
44. structural algorithms unchanged unless reroot diagnosis truly requires otherwise;
45. navigation tests pass;
46. renderer tests pass;
47. history shortcut tests pass;
48. folder-label tests pass;
49. full `pnpm check` passes;
50. desktop check/build passes;
51. `git diff --check` passes;
52. docs updated;
53. prompt archived + SHA-256;
54. optimized EXE + SHA-256;
55. PR CI green;
56. PR remains unmerged;
57. stop.

---

# Final report before founder QA

Report:

1. Branch / commits / PR
2. Latest main integrated
3. Exact File-reroot blank-screen cause
4. File reroot regression evidence
5. Heading/Block subfocus architecture
6. Primary/context/dim opacity behavior
7. History integration:
   ```text
   Ctrl+Z = Back
   Ctrl+Shift+Z = Forward
   text undo preserved
   ```
8. Folder label:
   ```text
   Folder | Parent
   ```
9. Version/schema changes, ideally none for structural layout
10. Exact validation counts
11. Native EXE path + SHA-256
12. Prompt archive + SHA-256
13. Merge status:

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
