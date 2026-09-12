# HIER4B-FIX4 — Post-Island Redundant Folder-Wrapper Suppression

**Task type:** Narrow Soft-folder guide correctness fix / renderer semantic cleanup

## Goal

Continue the existing unmerged HIER4B branch:

```text
codex/hier4b-soft-folder-clusters
```

Start from the **latest branch HEAD when you begin**.

At prompt-writing time the known pushed baseline is at least:

```text
013e618f43d4649c5abb59f90c8738dcf01b2d2b
fix: add soft folder area context menus
```

A separate narrow POLISH1 task may already have landed on the same branch. Preserve it if present.

Fix one specific semantic problem in Soft Folder Cluster guides:

> After the logical display tree has correctly singleton-compressed useless folder layers, the renderer's later spatial island splitting can recreate useless one-child folder wrappers.

Example currently visible in the real vault:

```text
Integrating the ideas/
└─ Cure Framework/
   └─ Principles are malleable
```

In that local spatial region, `Integrating the ideas` wraps only `Cure Framework`.

That outer wrapper communicates no local grouping information and should not be rendered there.

The same issue occurs when one logical folder containing several far-away Files gets split into separate spatial islands and each File receives its own duplicated same-folder wrapper.

This task should fix that **without redesigning Soft clustering itself**.

Do not redesign:

- Soft force layout;
- folder spacing;
- H1 attraction;
- nested display-tree semantics;
- File/folder promotion;
- context-menu contents;
- four-side ports;
- Direct/Electronic routing;
- HIER4B-SPACING;
- MODULAR-CONTEXT1.

No PR or merge. Commit/push the fix and stop after validation.

---

# Current cause

The current pipeline is effectively:

```text
1. Build nested displayed folder tree
2. Apply singleton-chain compression
3. Compute final File/module positions
4. Renderer builds folder guides
5. Renderer runs spatial splitIntoIslands(...)
6. Each island gets a folder wrapper
```

Step 2 correctly removes a folder with only one displayed child.

But step 5 can take a folder that globally has multiple children and split it into spatial regions.

Then step 6 can produce a region containing only:

```text
one File
```

or:

```text
one child-folder guide
```

which recreates the exact useless wrapper that singleton compression was intended to remove.

The current renderer also uses a hard spatial island gap around:

```text
GUIDE_ISLAND_GAP = 216
```

plus blocker-based separation.

Do not remove or redesign that island algorithm in this task.

Instead make the **rendered region semantics** consistent after the split.

---

# Product rule

A visible Soft folder-guide region must locally communicate grouping.

Therefore:

```text
visible folder region
→ must contain at least TWO direct displayed child units
```

A direct displayed child unit is one of:

```text
1 direct File/module
or
1 immediate child-folder guide region
```

Important:

```text
descendant Files inside one child folder
do NOT count as multiple direct units for the parent.
```

Example:

```text
Integrating the ideas region
└─ Cure Framework region
   ├─ File A
   └─ File B
```

For `Integrating the ideas`, this region contains:

```text
1 direct child unit = Cure Framework
```

Therefore:

```text
do not render Integrating the ideas wrapper in this region
```

`Cure Framework` remains visible because it locally groups File A + File B.

---

# A. Post-island local redundancy suppression

## A1. Evaluate every candidate region after island splitting

Current guide generation already builds children before parents.

Keep that useful ordering.

For each folder:

```text
direct File rectangles
+
rendered immediate child-folder regions
→ split into spatial islands
```

For each resulting island, determine its number of **direct units**.

If:

```text
directUnitCount >= 2
→ render region normally
```

If:

```text
directUnitCount == 1
→ suppress that folder region
```

Do not render:

- border;
- fill;
- folder title;
- context hit target;

for that redundant region.

---

# A2. Suppression is region-local

This is deliberately evaluated per spatial region, not only per logical folder.

Example:

```text
Folder A globally:
├─ child B
├─ child C
└─ child D
```

Spatially:

```text
Region 1:
B + C

Region 2:
D only
```

Expected:

```text
Region 1
→ Folder A guide visible because it groups B + C

Region 2
→ no Folder A wrapper around D alone
```

Folder A still exists logically in the display tree.

Only the redundant visual region is suppressed.

---

# A3. Same-folder far-away Files

Example:

```text
Z-Not in Graph/
├─ File A
└─ File B
```

If current island splitting produces:

```text
island 1 → File A only
island 2 → File B only
```

then neither island locally groups multiple units.

Expected:

```text
no separate Z-Not in Graph wrapper around File A
no separate Z-Not in Graph wrapper around File B
```

This is preferable to presenting two visually independent fake mini-folders with the same folder name.

The logical folder ancestry remains available in display-tree metadata/context behavior.

A future Soft-clustering redesign may introduce a better connected/multi-lobe representation. Do not solve that here.

---

# A4. Parent with File + child folder remains

Example:

```text
Folder1 region:
├─ File A
└─ Folder2 region
```

Direct units:

```text
2
```

Expected:

```text
Folder1 outer wrapper remains
Folder2 inner wrapper remains if Folder2 itself groups >=2 direct units
```

This is the desired nested hierarchy.

---

# A5. Parent with two child folders remains

```text
Folder1:
├─ Folder2
└─ Folder3
```

If both child regions are in the same parent island:

```text
Folder1 wrapper remains
```

---

# A6. Child region suppression can affect parent region formation

Because parent guide geometry currently uses child guide regions as units, suppression must be applied **before a parent consumes child regions**.

Do not:

```text
build redundant child region
let parent enclose it
then hide it only with CSS
```

That would leave incorrect parent geometry/hit testing.

Instead:

```text
child folder candidate regions
→ remove locally redundant child regions
→ parent receives only actually rendered child regions
```

This is important.

---

# A7. Direct Files remain available to ancestors correctly

Suppression of a child-folder region must not make its descendant File/module rectangles disappear from all ancestors.

There are two different cases:

### Logical child folder still useful elsewhere

If child folder has another rendered region, parent may consume that actual rendered region where spatially appropriate.

### Child region suppressed because it contains one unit

The parent should reason about the **surviving visual unit beneath it** rather than losing that branch.

Conceptually, suppression is a pass-through:

```text
Parent
  ↓
suppressed redundant child region
  ↓
actual child unit
```

For guide construction only, lift the suppressed region's direct visual unit into the parent candidate-unit set.

This mirrors singleton compression at renderer-region level.

Do not mutate the canonical/display folder tree.

---

# A8. Recursive local compression

A local region can contain a chain:

```text
A region
└─ B region
   └─ C region
      ├─ File1
      └─ File2
```

Expected rendered guide hierarchy:

```text
C
├─ File1
└─ File2
```

If A and B each have only one local direct unit, suppress both locally.

This must work recursively because guide construction is child-first.

---

# B. Preserve ancestry and management semantics

## B1. Do not mutate logical folder hierarchy

The display tree still knows:

```text
A
└─ B
   └─ C
```

even if A/B regions are locally suppressed.

Do not persist renderer suppression.

Do not add flattened-folder state.

Do not change File promotion semantics.

---

# B2. Hover ancestry

If current hover/focus context can report compressed ancestry, include renderer-local suppressed ancestry where useful.

For example, hovering `C` may still indicate:

```text
Parent ancestry:
B
A
```

without drawing redundant A/B boxes around the same local region.

Do not add heavy UI.

A small passive ancestry breadcrumb is enough if the current architecture already supports it cleanly.

---

# B3. Context menu

A suppressed local wrapper has no visible region, so it naturally has no empty-area right-click target there.

Right-click File or surviving child folder must continue using the existing displayed-folder/context logic.

Do not redesign context-menu semantics in this task.

If existing File menu needs the logical displayed containing folder rather than rendered region identity, preserve that existing behavior.

---

# C. Remove semantic dependence on `regionCount`

Do not reintroduce visible:

```text
Island X of Y
```

The product should not care how many renderer islands a folder has.

`regionIndex` / `regionCount` may remain internal for:

- deterministic IDs;
- tests;
- diagnostics;

but local redundancy decisions should be based on actual direct visual units.

---

# D. Geometry / hit testing

Suppressed regions must be absent from:

```text
rendered guide list
folder-area hit testing
guide labels
guide hover targets
context target candidates
```

A point inside where a redundant outer wrapper would have been should target:

```text
the surviving deeper folder guide
```

if inside it, otherwise whichever real containing guide exists.

No invisible suppressed guide should win deepest-folder hit testing.

---

# E. Root behavior

Preserve current structural-root policy.

Do not add an unnecessary workspace-root wrapper.

If a named top-level folder has only one local direct child unit after island splitting:

```text
suppress its local redundant wrapper
```

unless there is an explicit existing product rule requiring that specific top-level folder guide.

Prefer consistency.

---

# F. Tests

Add focused synthetic tests.

## LR1 — parent around only child folder

```text
A/
└─ B/
   ├─ File1
   └─ File2
```

If A's local region contains only rendered B:

```text
B guide visible
A region suppressed
```

---

## LR2 — exact screenshot case

Model:

```text
Integrating the ideas/
└─ Cure Framework/
   └─ Principles are malleable
```

plus other `Integrating the ideas` children far enough away to create other spatial islands.

For the local region around Cure Framework:

```text
Integrating the ideas wrapper absent
Cure Framework wrapper behavior determined by its own local direct-unit count
```

This directly regresses the reported real-vault issue.

---

## LR3 — far two-File same folder

```text
Z-Not in Graph/
├─ File A
└─ File B
```

force them into two current island regions.

Expected:

```text
0 one-File Z-Not in Graph wrappers
```

---

## LR4 — parent File + child folder

```text
A/
├─ File1
└─ B/
   ├─ File2
   └─ File3
```

same local region.

Expected:

```text
A visible
B visible
```

---

## LR5 — two child folders

```text
A/
├─ B/
└─ C/
```

same local island.

Expected A visible.

---

## LR6 — recursive redundant chain

```text
A/
└─ B/
   └─ C/
      ├─ File1
      └─ File2
```

Expected only useful C wrapper in that local region.

---

## LR7 — mixed islands

Logical folder A has:

```text
Region 1:
B + C

Region 2:
D only
```

Expected:

```text
A region 1 visible
A region 2 suppressed
```

---

## LR8 — pass-through geometry

Suppressing B region must not cause ancestor A to lose B's surviving underlying visual unit.

Assert correct parent candidate units and geometry.

---

## LR9 — hit testing

Suppressed outer region must not appear in hit-test candidates.

Right-click inside deeper surviving folder selects deeper folder.

---

## LR10 — determinism

Repeated cold runs produce identical guide region sets and suppression decisions.

---

# G. Existing regressions

Re-run relevant HIER4B tests for:

- nested display hierarchy;
- singleton compression;
- File promotion;
- folder flattening;
- folder-area context menus;
- short folder labels;
- parent/sibling hover;
- four-side File ports;
- Direct/Electronic parity;
- H1 attraction;
- strengths 0/25/50/75/100;
- Directional Bands byte identity;
- latest-result-wins.

If POLISH1 already landed, also preserve:

- hidden empty module boundaries;
- passive folder-label styling.

---

# H. Browser QA

Use synthetic/dev fixtures first.

Verify:

```text
1. parent wrapper disappears when a local region contains only one child folder.
2. same-folder two distant singleton islands no longer create one wrapper each.
3. useful parent wrapper remains when it contains File + child folder.
4. useful parent wrapper remains around two child folders.
5. right-click targets only visible surviving guides.
6. nested hierarchy still looks understandable.
```

Do not use spacing changes to make tests pass.

---

# I. Optimized desktop QA

Build and launch fresh optimized desktop.

Ask the user to revisit:

```text
Focus: Associated Value
```

and specifically inspect the case previously showing:

```text
Integrating the ideas
Cure Framework
Principles are malleable
```

Expected:

```text
no redundant Integrating the ideas wrapper
around the local Cure Framework-only region
```

Also inspect:

```text
Z-Not in Graph
```

Expected:

```text
no duplicated one-File same-folder wrappers
created solely by island splitting
```

Do not merge before approval.

---

# J. Explicit non-scope / later design

This fix does NOT decide the long-term representation of a folder whose members are far apart.

That remains part of the Soft clustering redesign.

Possible future strategies may include:

```text
single connected concave guide
multi-lobe guide with subtle connector
different folder-aware spacing
no island splitting
```

Do not implement or bake off those alternatives here.

This task only enforces:

> Never render a folder wrapper around a local spatial region that contains only one direct visual child unit.

---

# Likely implementation area

Current code of interest is likely:

```text
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
```

Current renderer uses:

```text
splitIntoIslands(...)
guideForIsland(...)
focusSchematicFolderClusterGuides(...)
```

with child guides built before parent guides.

Prefer refactoring guide construction around a small internal representation such as:

```text
candidate region
→ direct visual units
→ local redundancy compression
→ final rendered region
```

Do not push this logic into CSS.

---

# Validation

Use repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No new dependency.

---

# Hard exit gates

1. `splitIntoIslands` itself is not redesigned.
2. a rendered region with one direct File unit is suppressed.
3. a rendered region with one direct child-folder region is suppressed.
4. a rendered region with two+ direct units remains.
5. recursive local one-child chains compress.
6. suppression happens before parent geometry consumes child guides.
7. suppressed region passes its surviving visual unit upward correctly.
8. logical display tree is unchanged.
9. no new persisted state.
10. no source-folder mutation.
11. no File-promotion semantic change.
12. no folder-flatten semantic change.
13. no H1/Soft-force change.
14. no spacing change.
15. no cardinal-port change.
16. no route change.
17. suppressed regions absent from hit testing.
18. suppressed regions have no labels/context targets.
19. useful nested parent/child guides remain.
20. exact screenshot regression passes.
21. far two-File duplicate-wrapper regression passes.
22. mixed-island region regression passes.
23. Directional Bands unchanged.
24. POLISH1 preserved if already merged into branch.
25. no new dependency.
26. full checks pass.
27. optimized desktop build passes.
28. branch pushed.
29. no PR.
30. no merge.
31. prompt archived with SHA-256.
32. stop for graphical QA.

---

# Documentation

Update HIER4B development/validation docs only.

Record the rule:

```text
Post-island local guide compression:
a visible folder region must group at least two direct visual child units.
Single-unit regions are renderer-suppressed and pass their child visual unit
upward without changing the logical display hierarchy.
```

Archive exact prompt:

```text
history-implementations/HIER4B_FIX4_post_island_redundant_wrapper_suppression_codex_prompt.md
```

Record SHA-256.

Do not mark HIER4B complete.

---

# Final report

Return:

## Branch / commit

## Local redundancy rule

## Pass-through behavior

## Screenshot regression

## Z-Not-in-Graph regression

## Interaction/hit-test regression

## Tests / validation

## Desktop build path

## Prompt archive SHA

Then stop.

No PR or merge.
