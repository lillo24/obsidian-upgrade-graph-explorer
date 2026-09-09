# HIER4B-FIX2 — Nested Soft Folder Hierarchy + Singleton Compression + Context Menu

**Task type:** HIER4B semantic correction / nested folder guides / workspace display hierarchy / interaction refactor

## Goal

Continue the existing **unmerged HIER4B Soft Folder Clusters** branch and replace the too-flat grouping model discovered during live QA.

The current HIER4B-FIX1 behavior effectively treats Soft grouping as:

```text
exact folder
→ optional ancestor effective group
→ one flat spatial cluster
```

That is not the intended product model.

The user wants **nested folder hierarchy** to remain visible.

Example:

```text
Folder1/
├─ File A
└─ Folder2/
   ├─ File B
   └─ File C
```

must read visually as:

```text
┌──────────── Folder1/ ─────────────┐
│                                   │
│  File A                           │
│                                   │
│      ┌──── Folder2/ ──────┐       │
│      │ File B    File C   │       │
│      └────────────────────┘       │
│                                   │
└───────────────────────────────────┘
```

A **single File** may also be displayed one folder level higher while other Files remain inside the child folder:

```text
source:
Folder1/
└─ Folder2/
   ├─ File A
   ├─ File B
   └─ File C

display after promoting only File A:
Folder1/
├─ File A
└─ Folder2/
   ├─ File B
   └─ File C
```

This task must also:

- automatically compress useless one-item folder chains;
- remove the current inline/hover `↑ / siblings / Reset` guide toolbar;
- move folder management to **right-click/context menu** on a File or folder guide;
- make folder-guide hover/focus reveal its parent and sibling folder context;
- preserve the HIER4B-FIX1 four-side Soft File ports;
- preserve HIER4A Directional Bands byte-for-byte;
- leave future generic context actions such as **Hide / Focus / Inspect** for a later follow-up.

Do not create the HIER4B adoption PR or merge.

After implementation, build and launch a fresh optimized desktop executable and stop for graphical QA.

---

# Current branch / baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
codex/hier4b-soft-folder-clusters
```

Latest reported pushed commit:

```text
3e15469e241b7b468a14d226ea2e7617848c7ac0
```

No HIER4B PR exists and nothing is merged.

Current branch already includes:

```text
Macro layout:
- Directional Bands [default]
- Soft Folder Clusters [experimental]

Soft strength:
0..100
default 50

Internal layout:
Adaptive Compass / Vertical Spine

Heading order:
Crossing optimized / Document order

Folder Guides:
On / Off

Connection style:
Direct / Electronic

Soft File ports:
LEFT / RIGHT / TOP / BOTTOM
selected from final geometry and used in scoring
```

Preserve all current tests, privacy boundaries, latest-result-wins behavior, worker ownership, and cache correctness.

Before editing:

1. inspect current branch/worktree;
2. inspect the FIX1 flat scope override schema and persistence;
3. inspect existing Network/Network Explorer context-menu infrastructure;
4. preserve unrelated branches/worktrees and local files;
5. continue this same HIER4B branch.

---

# Core product model

Replace the flat cluster partition with:

```text
CANONICAL SOURCE FOLDER TREE
        ↓
MANUAL FILE DISPLAY-PARENT OVERRIDES
        ↓
MANUAL FOLDER-LAYER FLATTENING
        ↓
AUTOMATIC TRIVIAL FOLDER COMPRESSION
        ↓
NESTED SOFT DISPLAY TREE
        ↓
HIERARCHICAL SOFT ATTRACTION
        ↓
NESTED FOLDER GUIDES
```

Hard principle:

> Soft Folder Clusters uses a **displayed folder tree**, not one flat effective group key.

Canonical source structure remains immutable.

---

# 1. File promotion and folder flattening are different operations

## File promotion

A specific File can be displayed under an ancestor folder without moving siblings.

Example:

```text
source:
Folder1/Folder2/FileA.md

display override:
FileA → Folder1/
```

while `FileB` and `FileC` remain displayed in `Folder2/`.

Use stable File/document identity, not transient projection IDs.

Conceptually:

```ts
type SoftFileDisplayParentOverride = {
  fileId: StableDocumentId;
  displayParentFolderKey: WorkspaceFolderKey;
};
```

Use repository-current stable identity types.

## Folder flattening

A displayed folder guide can be flattened one level:

```text
before:
Folder1/
└─ Folder2/
   ├─ File A
   └─ Folder3/
      ├─ File B
      └─ File C

flatten Folder2 into Folder1:

after:
Folder1/
├─ File A
└─ Folder3/
   ├─ File B
   └─ File C
```

The `Folder2` display layer disappears, but nested child folders survive.

This is not a source-folder move.

---

# 2. Suggested sparse workspace intent

Use the simplest clean source-neutral representation.

Conceptually:

```ts
interface SoftFolderDisplayIntent {
  fileParentOverrides: readonly {
    fileId: StableDocumentId;
    displayParentFolderKey: WorkspaceFolderKey;
  }[];

  flattenedFolderKeys: readonly WorkspaceFolderKey[];
}
```

Do not force this exact API if current workspace persistence has a better shape.

Requirements:

- sparse;
- deterministic;
- reversible;
- workspace-scoped;
- no Markdown write;
- no absolute-path leakage;
- stale state reconciles safely.

Automatic singleton compression is **derived**, not persisted.

---

# 3. File context behavior

For a File currently displayed in:

```text
Folder2/
```

right-click should expose:

```text
Folder display
──────────────
Move up to Folder1/
Restore exact folder placement
```

When already at exact placement, hide/disable Restore.

When already at top/root, disable Move Up.

Each Move Up goes **one current display level** upward.

Promoting File A must not promote File B/C.

Repeated promotion is allowed.

Restore removes only that File's manual override.

---

# 4. Folder context behavior

Right-click a visible Soft folder guide.

Suggested menu:

```text
Folder display
──────────────
Flatten into Parent/
Flatten this + sibling folders into Parent/
Restore folder layer / restore affected layer
```

Flattening means:

```text
remove this displayed folder layer
lift its direct displayed children into its displayed parent
keep grandchildren folder structure intact
```

`Flatten this + sibling folders` flattens sibling folder guides sharing the same displayed parent.

Do not recursively flatten descendants.

---

# 5. Restore path for flattened folders

A flattened guide is no longer visible, so there must be a practical reverse path.

Prefer one of these clean approaches:

```text
Parent context menu
→ Hidden folder layers
→ Folder2/
→ Restore
```

or:

```text
Descendant File/folder context menu
→ Restore flattened ancestor
```

At minimum, also support:

```text
Reset Soft folder display
```

for the current workspace if needed.

A user must not get trapped in an irreversible display state.

---

# 6. Automatic singleton / trivial-folder compression

The user does not want:

```text
A/
└─ B/
   └─ C/
      └─ Only.md
```

shown as three nested one-item folder guides.

After manual display intent is applied, derive the **visible display tree**.

A non-root folder guide with only:

```text
1 direct displayed child unit
```

may be automatically suppressed because it adds no grouping information.

A child unit is:

```text
File
or
child folder
```

Lift that one child into the displayed parent and repeat until reaching a meaningful branching level.

Do not persist this suppression.

---

# 7. Singleton compression examples

## One File

```text
A/
├─ Other.md
└─ B/
   └─ Only.md
```

Preferred display:

```text
A/
├─ Other
└─ Only
```

No pointless `B/` guide.

## Deep chain

```text
A/B/C/D/Only.md
```

If `A/` is the first useful branching parent, compress B/C/D.

## Meaningful nested case

```text
A/
├─ File1
└─ B/
   ├─ File2
   └─ File3
```

Show:

```text
A outer guide
B inner guide
```

because A has two child units:

```text
File1 + B/
```

and B has two Files.

## Two folders

```text
A/
├─ B/
└─ C/
```

A remains visible.

---

# 8. Compression operates on the visible File display tree

Prefer evaluating triviality using:

```text
currently visible Files in the Soft projection
```

because the guide should explain what is on screen.

However:

- manual sibling discovery should remain workspace-aware;
- Heading expand/collapse must **not** restructure the folder hierarchy, because it does not change visible File membership.

Hard:

```text
Heading disclosure
→ guide geometry may resize
→ folder display-tree identity unchanged
```

Hide/restore of an entire File may legitimately change auto-compression.

---

# 9. Build a pure display-tree model

Do not derive nested hierarchy ad hoc in JSX.

Create/refactor a pure testable transformation conceptually:

```ts
buildSoftFolderDisplayTree({
  canonicalFolderTree,
  visibleFiles,
  fileParentOverrides,
  flattenedFolderKeys
})
```

Pipeline:

```text
1. canonical folder tree
2. insert visible Files
3. apply File display-parent overrides
4. flatten manually suppressed folder layers
5. iteratively compress trivial folder layers
6. emit deterministic nested display tree + provenance
```

Useful provenance:

```text
exact
manual-file-promotion
manual-folder-flatten
automatic-singleton-compression
```

Normal UI does not need to expose all provenance, but dev/tests should be able to inspect it.

---

# 10. Nested guide geometry

The Soft guide renderer must consume the nested display tree.

For a rendered folder guide, its visual region must include:

```text
direct File/module rectangles
+
child folder-guide regions
```

plus modest nesting padding.

Hard:

```text
child guide visually contained inside parent guide
```

where applicable.

Do not calculate all guides independently as flat hulls and let them overlap accidentally.

---

# 11. Keep disconnected islands truthful

A logical displayed folder may still form multiple spatial islands due to topology.

Multiple guide regions for the same folder are allowed.

Do not draw a huge convex hull that swallows unrelated folders.

Nested child-folder islands must remain visually associated with the correct logical parent.

---

# 12. Nesting style

Keep the visual grammar subtle:

```text
low-opacity fill
thin dashed/dotted boundary
small folder label
```

Parent fill behind child fill.

Child border must remain readable.

Avoid exponential padding growth in deep trees.

Use modest fixed padding or a capped depth-sensitive value.

Never expose absolute filesystem paths.

---

# 13. Hover/focus reveals parent and siblings

When a Soft folder guide is hovered/focused:

```text
current folder
→ primary emphasis

displayed parent folder
→ secondary emphasis

displayed sibling folder guides
→ sibling emphasis
```

The goal is to immediately answer:

```text
What parent folder am I inside?
What other folders share that parent?
```

Do not aggressively dim graph nodes/edges.

Hover/focus is renderer-only:

```text
0 worker
0 layout
0 cache change
```

---

# 14. Parent context when the parent was auto-compressed

If the immediate parent folder was suppressed by automatic singleton compression, still expose ancestry.

Preferred:

```text
temporary pointer-inert parent preview outline + label
```

computed from current visible descendants.

If that is too invasive, minimum acceptable fallback:

```text
hover breadcrumb:
Parent: A/B/
Siblings: ...
```

The user must still understand the parent relation.

No persistent guide/layout mutation.

---

# 15. Remove the old FIX1 guide toolbar

Delete the current inline/hover controls:

```text
↑ This group
↑ This + sibling folders
Reset
```

Folder guides should remain visually quiet.

All management moves to context menus.

---

# 16. Reuse Network context-menu infrastructure

The repository already has shared Network/Network Explorer interaction patterns for:

```text
right-click
Shift+F10
ContextMenu/Menu key
single logical target
nonmodal portal
viewport bounding
Escape/outside dismissal
focus restoration
```

Inspect and reuse/extract the minimal shared infrastructure.

Do not invent a second incompatible menu framework.

Opening a menu must not:

- reroot;
- trigger disclosure;
- start drag;
- alter graph layout;
- unexpectedly hide/select another item.

---

# 17. Folder guide context hit target

Keep large hull/fill:

```text
pointer-events: none
```

so nodes/edges/pan remain usable inside the region.

Make only a small reasonable surface interactive, such as:

```text
folder label
and/or thin border hit target
```

Right-click that area to open folder menu.

Folder label must be keyboard focusable while guides are On.

---

# 18. Keyboard access

For File and folder guide:

```text
Shift+F10
ContextMenu key
```

should open the same logical menu as right-click.

Escape closes and restores focus to the trigger.

Do not rely on hover only.

---

# 19. Future generic context actions are non-scope

The user wants this same context-menu direction later for actions similar to Network:

```text
Hide
Focus
Inspect
possibly other actions
```

Do **not** implement them in FIX2.

Record a follow-up milestone/task:

```text
MODULAR-CONTEXT1
→ extend Modular File/folder context menus with Network-style
  Hide / Focus / Inspect / other shared actions
```

Design this menu so that adding those actions later is straightforward.

---

# 20. Directional Bands completely ignore Soft display intent

Hard:

```text
Soft File promotions
Soft flattened folder layers
Soft auto-compression
```

must have no effect on:

```text
Directional Bands geometry
Directional exact-folder strips
Directional attachment policy
Directional cache identity
HIER4A output
```

With non-empty new display intent, switching to Directional must pass the existing byte-identical HIER4A oracle.

Switching back to Soft restores the workspace display intent.

---

# 21. Replace the old flat FIX1 override model cleanly

The current branch has workspace-specific flat:

```text
exact folder → ancestor effective group
```

state.

This semantics is superseded.

Do not keep both systems alive.

Refactor/remove the flat model from:

- worker input;
- cache key;
- Soft grouping;
- guide grouping;
- UI;
- persistence;

where no longer applicable.

Because HIER4B is unmerged Experimental work, do not create a complex production migration.

If old flat state converts cleanly, migrate it.

Otherwise:

```text
bump experimental display-intent schema
reset only old HIER4B grouping overrides
preserve all unrelated settings
```

Report this in QA handoff.

---

# 22. Workspace-scoped persistence

Persist only manual intent:

```text
File display-parent overrides
manual flattened folder layers
```

per stable workspace identity.

Automatic compression is derived.

Requirements:

- reload-safe;
- restart-safe;
- vault reopen-safe;
- no cross-vault leakage;
- no Markdown write;
- corrupt/stale state normalizes safely.

Use stable File/document identity from the existing KG9/KG10 system where possible.

---

# 23. Hierarchical Soft attraction

The current Soft solver was based on flat groups.

Adapt it to the displayed hierarchy.

A File can now belong to multiple displayed ancestor scopes:

```text
File B
∈ Folder2
∈ Folder1
```

This is intentional.

But do **not** naively apply full strength independently at every ancestor, because deep Files would receive more total force.

---

# 24. Bounded hierarchy-force budget

`Folder strength 0..100` must remain one understandable global magnitude.

Use a bounded per-File total folder-attraction budget distributed across visible displayed ancestor scopes.

Bake off a few internal policies, e.g.:

```text
H0 — nearest displayed folder only
H1 — normalized decaying weights across ancestors
H2 — normalized equal ancestor shares
```

No product selector.

Hard gates before soft quality:

1. no overlap;
2. no exact-crossing regression beyond current HIER4B hard gate;
3. no depth-dependent force explosion;
4. deterministic convergence;
5. useful child coherence;
6. useful parent coherence.

Then compare span/compactness.

Graphical quality matters.

Select one internal policy and document it.

At:

```text
strength 0
```

there must be zero folder-attraction force at every hierarchy level.

Guides still render.

---

# 25. Manual placement affects displayed force membership

If File A source is:

```text
Folder1/Folder2/
```

but manually displayed under:

```text
Folder1/
```

then in Soft force semantics:

```text
File A participates in Folder1 scope
File A does NOT participate in displayed Folder2 scope
```

Canonical source Folder2 remains available for Restore.

If Folder2 layer is flattened:

```text
Folder2 gets no separate displayed force
lifted direct children participate in parent
surviving Folder3 child still has its own displayed force
```

Auto-compressed folder levels similarly get no separate force.

---

# 26. Four-side Soft File ports remain accepted

Preserve HIER4B-FIX1:

```text
Soft File/document endpoints:
left / right / top / bottom
from candidate/final relative geometry
```

They participate in crossing/readability scoring.

Do not redesign or revert them.

Precise Heading/Block endpoints remain unchanged.

Direct/Electronic use the same selected handles.

---

# 27. No routing rewrite

Nested guides are not routing obstacles.

Do not route edges around guide boundaries.

HIER5 still owns:

```text
true orthogonal Electronic routes
rounded Electronic
channels
obstacle avoidance
parallel separation
distinct hit targets
```

---

# 28. Cache / worker ownership

Soft layout cache identity must include normalized layout-relevant manual display intent.

Do not include:

```text
hovered guide
context menu state
temporary parent preview
```

If strict worker request/result schema changes from flat to nested intent, bump the HIER4B protocol once.

Do not bump for pure UI changes.

Latest-result-wins must survive:

```text
Move File up
Flatten folder
Reset
strength change
reroot
hide/restore File
```

---

# 29. Required display-tree tests

Add table-driven synthetic tests for:

```text
N1 parent guide + nested child guide
N2 promote one of three child-folder Files
N3 repeated File promotion
N4 restore File exact placement
N5 flatten folder one level
N6 flatten sibling folder layer
N7 restore flattened layer
N8 one-File folder auto-compresses
N9 deep singleton chain compresses
N10 two-File folder remains visible
N11 File + child-folder parent remains visible
N12 two child folders keep parent visible
N13 query hides/restores one File
N14 Heading disclosure does not restructure folder hierarchy
N15 manual vs automatic provenance
N16 workspace isolation
N17 stale intent reconciliation
N18 Directional byte-identical with non-empty Soft intent
```

---

# 30. Required nested guide tests

Prove:

```text
G1 child guide contained by parent
G2 parent contains direct File + child guide
G3 nested labels correspond to displayed hierarchy
G4 disconnected islands remain truthful
G5 deep nesting padding stays bounded
G6 guide On/Off remains renderer-only
G7 hover child emphasizes parent/siblings
G8 auto-compressed parent still exposes ancestry context
```

---

# 31. Required context-menu tests

Prove:

```text
C1 right-click Soft File opens folder-display menu
C2 Shift+F10 / ContextMenu key opens same File menu
C3 right-click Soft folder label opens folder menu
C4 keyboard context opens same folder menu
C5 Escape closes + restores focus
C6 outside click dismisses
C7 menu open/close = zero layout
C8 File Move Up triggers one relevant Soft update
C9 folder Flatten triggers one relevant Soft update
C10 old ↑ toolbar no longer exists
C11 guide hull remains pointer-inert
C12 actions disabled appropriately at root/exact state
```

---

# 32. Required hierarchy-force bakeoff fixtures

At minimum:

```text
HFA1 parent direct File + two-File child
HFA2 two sibling nested child folders
HFA3 depth-3 hierarchy with Files at multiple levels
HFA4 promoted File leaves child folder
HFA5 flattened folder with surviving grandchild folder
HFA6 disconnected same-folder islands
HFA7 topology pulls against folder nesting
```

Compare H0/H1/H2.

Record metrics:

```text
overlap
exact crossings
primary span
folder coherence at child level
folder coherence at parent level
collision corrections
convergence iterations/time
```

Select one bounded policy.

---

# 33. Strength matrix

Re-run:

```text
0
25
50
75
100
```

with nested hierarchy.

Check:

- group tree identity stable across strengths;
- no attraction at 0;
- no depth-amplified runaway at 100;
- cardinal File ports remain valid;
- guide containment remains legible.

---

# 34. Stress cases

Include:

```text
100+ visible Files
many singleton leaf folders
10-level folder chain
many File display overrides
many manually flattened folders
large sibling-folder set
mixed nested islands
```

Ensure deterministic bounded runtime and no recursion/stack issue.

No new external dependency expected.

---

# 35. Browser / optimized desktop QA gate

Do not merge.

After automated checks:

1. run browser real-app QA;
2. build optimized desktop;
3. launch it;
4. give exact executable path;
5. ask user for graphical evaluation;
6. stop.

---

# 36. Required user QA scenario

The most important live scenario is:

```text
Folder1/
└─ Folder2/
   ├─ File A
   ├─ File B
   └─ File C
```

In Soft mode:

```text
right-click File A
→ Move up one level
```

Expected:

```text
Folder1 outer guide
├─ File A
└─ Folder2 inner guide
   ├─ File B
   └─ File C
```

This must look natural.

Then test:

```text
Restore File A
```

---

# 37. Additional live QA

Ask the user to verify:

```text
1. A one-File folder auto-compresses into useful parent.
2. A two-File folder keeps its own guide.
3. Parent with File + child folder renders two nested guide levels.
4. Right-click folder → Flatten one level.
5. Grandchild folder remains nested.
6. Flatten + siblings works.
7. Restore path works.
8. Hover child guide makes parent/siblings obvious.
9. Strength 0/25/50/75/100.
10. Reroot and hide/restore File.
11. Expand/collapse Headings without folder hierarchy restructuring.
12. Soft File ports still use all four sides sensibly.
13. Direct/Electronic preserve same handles.
14. Directional Bands still show exact horizontal strips unchanged.
15. Switching back Soft restores manual display intent.
```

Ask:

```text
Does this now match the folder hierarchy you expect?

Is singleton compression too aggressive, too weak, or correct?

Does parent/sibling hover context make the hierarchy obvious?

Which Soft strength looks best now?
```

Then stop.

---

# 38. Documentation / follow-up

Update HIER4B development docs only.

Do not write adoption ADR.

Record:

```text
Soft folder model:
nested displayed hierarchy

Manual:
per-File parent promotion
folder-layer flattening

Automatic:
trivial singleton-chain compression

Interaction:
right-click/context menu
no permanent guide buttons

Hover:
parent + sibling context
```

Also record the explicit later follow-up:

```text
MODULAR-CONTEXT1 — after HIER4B folder semantics

Extend Modular File/folder context menus with:
- Focus
- Inspect
- Hide File
- Hide folder
- other useful Network-parity actions
```

Do not implement it now.

Archive this exact prompt at:

```text
history-implementations/HIER4B_FIX2_nested_folder_hierarchy_context_menu_codex_prompt.md
```

Record SHA-256.

---

# Suggested implementation sequence

## Phase 1
Inspect current `3e15469...`, freeze Directional/cardinal regression oracles, add failing nested case.

## Phase 2
Replace flat scope model with:
- File parent overrides;
- manual flattened-folder state;
- validation/reconciliation/persistence.

## Phase 3
Implement pure nested display-tree builder:
- manual File placement;
- manual flattening;
- iterative auto singleton compression;
- provenance;
- deterministic output.

## Phase 4
Adapt Soft solver to hierarchical display tree.
Bake off H0/H1/H2 normalized hierarchy-force policies and select one.

## Phase 5
Render nested guides:
- direct Files;
- child guides;
- containment;
- islands;
- labels;
- parent/sibling hover context.

## Phase 6
Remove old guide toolbar.
Reuse Network context-menu infrastructure for File/folder display management.

## Phase 7
Run nested hierarchy, guide, context-menu, force, cardinal-port, Directional, strength, cache, latest-result-wins, stress tests.

## Phase 8
Run full checks and build optimized desktop.

## Phase 9
Give user executable + concise QA steps and STOP.

No PR, no merge.

---

# Validation commands

Use repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:focus-schematic-soft-folder-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current HIER4B script names if different.

---

# Hard exit gates

FIX2 is ready for graphical QA only when all are true:

1. source folder identity remains immutable;
2. a single File can move one display folder level up;
3. sibling Files remain in child folder;
4. File promotion can repeat;
5. File restore works;
6. folder layer flatten works;
7. child folders survive parent flattening;
8. sibling-folder flatten works;
9. flattened-folder restore path exists;
10. manual state is workspace-scoped;
11. old flat effective-group model is removed/replaced;
12. stale old Experimental state migrates safely or resets narrowly;
13. singleton folder compression is automatic and derived;
14. deep one-item chains compress;
15. two-File folder guide remains;
16. File + child-folder parent remains;
17. two-child-folder parent remains;
18. Heading disclosure does not restructure folder hierarchy;
19. nested display tree is pure/tested/deterministic;
20. provenance distinguishes manual/automatic placement;
21. hierarchical attraction is bounded/normalized;
22. strength 0 means zero folder force;
23. strength 100 does not amplify with depth uncontrollably;
24. promoted File leaves child displayed attraction;
25. flattened folder loses separate displayed attraction;
26. nested guides render parent around direct Files + child guides;
27. child guide containment is correct;
28. islands remain truthful;
29. nesting padding remains bounded;
30. labels expose no absolute paths;
31. hover/focus shows parent/sibling context;
32. auto-compressed parent still has ancestry indication;
33. hover causes zero layout;
34. old inline guide buttons are gone;
35. File right-click menu works;
36. folder-guide right-click menu works;
37. Shift+F10/ContextMenu keyboard paths work;
38. Escape/outside dismissal works;
39. focus restoration works;
40. guide fill remains pointer-inert;
41. context-menu opening causes zero layout;
42. display action triggers only relevant Soft update;
43. menu architecture is extensible for later Hide/Focus/Inspect;
44. Hide/Focus/Inspect are NOT implemented now;
45. Directional Bands ignore all Soft display intent;
46. Directional output remains byte-identical to HIER4A;
47. Directional exact horizontal strips unchanged;
48. four-side Soft File ports remain correct;
49. cardinal sides remain part of scoring;
50. Direct/Electronic use same selected handles;
51. Secondary remains zero-layout;
52. File aggregate hover remains correct;
53. direct File ring remains correct;
54. Heading/Block exact hover remains correct;
55. query hide/restore passes;
56. reroot passes;
57. latest-result-wins passes;
58. Soft cache includes relevant display intent;
59. hover/menu state excluded from cache;
60. protocol bumps only if strict schema changes;
61. H0/H1/H2 internal bakeoff documented;
62. no product-facing hierarchy-force selector added;
63. strengths 0/25/50/75/100 pass;
64. stress fixtures pass;
65. no new dependency;
66. full `pnpm check` passes;
67. desktop check/build passes;
68. optimized desktop launches;
69. real-vault evidence remains private;
70. exact prompt archived with SHA-256;
71. MODULAR-CONTEXT1 follow-up documented;
72. no PR created;
73. no merge;
74. no HIER5 work;
75. no HIER3C work;
76. stop for user QA.

---

# Final report format

## Branch / commit

## Display hierarchy
Explain the new nested model.

## File promotion
Explain one-File promotion + restore.

## Folder flattening
Explain flatten + siblings + restore.

## Singleton compression
State exact selected rule.

## Hierarchical attraction
State which H0/H1/H2 policy won and why.

## Nested guides
Containment, islands, labels.

## Hover hierarchy context

## Context menu
Right-click + keyboard behavior.

## Old FIX1 state migration/reset

## Directional isolation

## Cardinal File-port regression

## Strength / benchmark results

## Tests

## Privacy

## Optimized desktop path

## User QA steps

## Follow-up
`MODULAR-CONTEXT1` for later Hide / Focus / Inspect parity.

Then stop.

No PR or merge.
