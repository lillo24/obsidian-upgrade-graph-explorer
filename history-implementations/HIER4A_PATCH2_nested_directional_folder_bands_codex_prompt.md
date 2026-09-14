# HIER4A-PATCH2 — One-Level Nested Directional Folder Bands

**Task type:** experimental layout refinement / Directional Folder Bands hierarchy / renderer overlay / regression hardening

## Goal / success outcome

Experiment with **one level of nested folder hierarchy inside Directional Folder Bands**.

The current Directional layout treats visible folders as flat horizontal bands. That loses useful Obsidian folder structure that is already represented successfully in HIER4B Soft Folder Clusters.

The intended Directional grammar is now:

```text
external graph semantics
→ incoming / Focus / outgoing signed-rank structure

folder semantics
→ one-level nested horizontal containment hierarchy
```

Example:

```text
Pattern Theory/
├─ direct Files
├─ Brain Power/
│  ├─ File A
│  └─ File B
└─ Foundational Patterns/
   ├─ File C
   └─ File D
```

should read approximately as:

```text
┌────────────────── Pattern Theory ──────────────────┐
│                                                     │
│  direct Files in Pattern Theory                     │
│                                                     │
│  ┌──────────── Brain Power ──────────────────────┐  │
│  │ File A                         File B          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ┌────── Foundational Patterns ──────────────────┐  │
│  │ File C                         File D          │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The **outer parent container is a hard layout constraint**.

Crossing/order optimization may decide:

- which child band comes first;
- where direct-parent Files sit inside the parent;
- module order inside each child band;
- legal Heading/Adaptive-Compass ordering;

but it may **not scatter child folders or their Files outside the parent container merely to reduce arrows**.

For this experiment:

```text
nesting depth = exactly 1 visible parent layer
```

Do not implement arbitrary-depth Directional nesting yet.

The user may evaluate a two-level version later if one-level nesting proves useful.

---

# Current repository / branch context

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At plan-writing time the remote HIER4B development branch:

```text
codex/hier4b-patch1-soft-adaptive-compass
```

is at approximately:

```text
3913ab39a1ff39687915199d07c8f512aeb2ebad
```

and already contains:

- merged current `main`;
- the accepted HIER4A Directional Bands architecture;
- Adaptive Compass;
- the HIER4B nested Soft display tree;
- nested Soft folder guides;
- Soft singleton compression;
- root-neutral Soft force behavior.

The user says they **branched specifically for this Directional nesting experiment**.

Therefore:

1. inspect the actual current local branch/HEAD first;
2. continue the user's current experimental branch;
3. do **not** blindly checkout/reset to the remote HIER4B branch;
4. use current HIER4B nested-folder code as implementation evidence/reusable infrastructure;
5. preserve unrelated work and untracked files;
6. do not create a PR or merge until graphical QA is approved.

The existing Soft implementation already separates canonical source folders from a derived displayed folder tree and renders child guide geometry inside parent regions. Reuse generic ancestry/geometry ideas where clean, but do not make Directional Bands inherit Soft force semantics. fileciteturn4file0

---

# Existing architecture to preserve

Directional Modular Focus Hierarchy currently has:

```text
Macro:
Directional Folder Bands

Internal File-module layout:
Adaptive Compass          [default]
Vertical Spine            [Sandbox alternative]

Heading visual order:
Crossing optimized        [default]
Document order            [Sandbox alternative]

Root:
Focus File remains semantic anchor

Secondary links:
zero geometry influence
```

Do not change:

- canonical folder identity;
- Focus projection;
- signed-rank X semantics;
- incoming/root/outgoing meaning;
- Adaptive Compass semantics;
- exact File/Heading/Block endpoints;
- File aggregate hover;
- direct File ring;
- Secondary zero-layout behavior;
- worker ownership;
- exact cache;
- latest-result-wins;
- Classic behavior;
- HIER4B Soft cluster solver.

---

# Core distinction

Keep these separate:

```text
SOURCE FOLDER
canonical Obsidian folder identity

DIRECTIONAL EXACT BAND
current horizontal band belonging to one exact folder

DIRECTIONAL PARENT CONTAINER
new one-level parent folder container holding direct Files
and child exact bands

SOFT DISPLAY TREE
HIER4B nested visual/spatial hierarchy

VISUAL GROUP
GROUP1 styling

REFERENCE GRAPH
authored semantic edges
```

A parent container is not a graph node.

Folder hierarchy never creates fake reference edges.

---

# 1. One-level Directional hierarchy only

The final rendered Directional folder structure may contain:

```text
Parent container
└─ child exact bands
```

but not:

```text
Grandparent
└─ Parent
   └─ Child
```

in this task.

Hard:

```text
maximum Directional nested-guide depth = 1
```

The architecture may remain extensible to depth 2 later, but do not expose a depth control or implement recursive Directional nesting now.

---

# 2. Root folder is explicitly excluded

The focused root File/root exact folder remains special.

For now:

```text
root exact folder band
→ remains the existing independent root band
→ retains its full normalized workspace-relative folder path label
→ is NOT inserted into a parent container
→ does NOT cause parent/sibling nested grouping
→ does NOT participate in parent-container construction
```

Example:

```text
Pattern Theory/
├─ Brain Power/           ← contains focused root File
└─ Foundational Patterns/
```

Do **not** render:

```text
Pattern Theory
└─ Brain Power [root]
```

for the root band in this experiment.

The root band stays independent.

If other non-root folders can still form a meaningful parent container without the root exact folder, they may do so.

The root File remains at its accepted semantic anchor.

---

# 3. Parent containers come from real immediate folder ancestry

For a non-root visible exact folder:

```text
Pattern Theory/Brain Power/
```

its one-level parent candidate is:

```text
Pattern Theory/
```

Use the canonical/source-neutral folder tree already available to HIER1/HIER4.

Do not:

- parse labels;
- infer parent from rendered text;
- read filesystem folders from React;
- use Soft manual display-parent overrides.

This experiment uses the real folder hierarchy.

---

# 4. Parent direct Files remain direct children

Suppose:

```text
Pattern Theory/
├─ Main.md
├─ Notes.md
├─ Brain Power/
└─ Foundational Patterns/
```

Then:

```text
Main.md
Notes.md
```

belong directly to the outer `Pattern Theory` container.

Do not invent a fake child band such as:

```text
Pattern Theory / direct files
```

They should occupy an unlabeled **direct-parent region/unit** inside the parent container.

The outer parent label already gives their folder context.

---

# 5. Preserve meaningful sibling folder splits

This is a core rule and intentionally differs from aggressive Soft singleton compression.

If one parent has **two or more visible child folders**:

```text
Pattern Theory/
├─ Brain Power/
│  └─ A.md
└─ Foundational Patterns/
   └─ B.md
```

then preserve both child folders as separate nested child bands even though each contains only one visible File.

Display:

```text
Pattern Theory
├─ Brain Power
│  └─ A
└─ Foundational Patterns
   └─ B
```

Do **not** flatten A/B directly into Pattern Theory.

Reason:

> once sibling folder alternatives exist, the split itself carries useful structural information.

Hard acceptance:

```text
visible child folder count >= 2
→ preserve child-folder distinction
```

---

# 6. Simplify a useless sole singleton child

The user's explicit simplification case:

```text
Folder 1/
├─ ParentFile.md
└─ Folder 2/
   └─ Only.md
```

should not waste a nested band on `Folder 2`.

Preferred Directional display:

```text
Folder 1/
├─ ParentFile
└─ Only
```

Therefore, when all are true:

```text
parent has exactly 1 visible child folder
child contributes exactly 1 visible direct File/module
child has no other visible child-folder structure represented in this one-level view
```

suppress the child band and lift that File into the parent's direct region.

This suppression is derived layout/display behavior.

Do not mutate the source folder.

Do not persist it.

---

# 7. Sole child with multiple Files remains meaningful

Example:

```text
Folder 1/
├─ ParentFile.md
└─ Folder 2/
   ├─ A.md
   └─ B.md
```

Preferred:

```text
Folder 1 outer container
├─ ParentFile
└─ Folder 2 child band
   ├─ A
   └─ B
```

because `Folder 2` groups multiple Files.

Do not flatten it merely because it is the only child folder.

---

# 8. Parent with one child and no direct Files is redundant

Example:

```text
Folder 1/
└─ Folder 2/
   ├─ A.md
   └─ B.md
```

An outer `Folder 1` container adds no visible grouping contrast at one-level depth.

Preferred:

```text
Folder 2 band
├─ A
└─ B
```

without an extra outer wrapper.

The exact source ancestry remains available in Inspector/source data.

This keeps nested Directional UI from degenerating into box-within-box decoration.

---

# 9. Parent-container materialization rule

A parent container should normally exist when it has at least **two meaningful direct visual units** after the sole-singleton simplification.

A direct visual unit is:

```text
direct-parent File/module region
or
preserved child folder band
```

Examples:

```text
2 child folders
→ parent exists

direct Files + 1 multi-File child folder
→ parent exists

direct Files only
→ ordinary exact parent band; no extra nested wrapper

1 child folder only, no direct Files
→ parent wrapper suppressed
```

Implement this deterministically and test it.

---

# 10. One parent container is atomic to global band ordering

Current Directional optimization orders flat folder bands vertically around the root.

With nesting enabled, global ordering units become:

```text
root band
standalone exact bands
parent containers
```

A parent container is atomic at the top-level ordering stage.

The global optimizer may move the whole:

```text
Pattern Theory
```

container above/below other top-level units.

It may not interleave:

```text
Pattern Theory / Brain Power
Other Parent / X
Pattern Theory / Foundational Patterns
```

because that destroys the parent grouping.

Hard:

```text
child bands belonging to one parent container remain contiguous inside that container
```

---

# 11. Parent containment outranks crossing optimization

This is an explicit user decision.

Priority for the nested Directional experiment:

```text
P0 finite / non-overlapping geometry

P1 external signed-rank X semantics
   incoming ← Focus → outgoing

P2 root anchor semantics

P3 folder hierarchy containment
   parent container ownership
   child band ownership
   direct-parent File ownership

P4 exact endpoint crossings / rank-order inversions

P5 root above/below balance

P6 primary reference span / compactness / stability
```

This differs from the earlier flat Directional design where topology could justify an out-of-band exception.

For nested mode:

> Cross-arrow optimization must adapt **inside the folder hierarchy**, not break the hierarchy to improve arrows.

Do not move a File out of its materialized parent/child band as a crossing optimization.

---

# 12. No topology exceptions that violate folder containment

While this nested experiment is enabled:

```text
visible non-root File
→ must be inside its assigned direct-parent region or exact child band
→ that region must be inside its parent container when parent exists
```

Do not classify:

```text
"outside own folder because crossing guard"
```

as success.

If the folder hierarchy makes a crossing unavoidable:

```text
keep folder containment
accept/report the crossing
```

The purpose of this branch is to evaluate that design trade-off visually.

Do not weaken graph semantic direction or endpoint provenance.

---

# 13. Child ordering inside a parent can optimize crossings

Hard containment does **not** mean fixed folder order.

Inside:

```text
Pattern Theory
```

candidate internal units may be:

```text
direct Files
Brain Power
Foundational Patterns
```

The parent-local optimizer may reorder these vertical units to reduce:

```text
exact endpoint crossings
adjacent-rank inversions
primary edge span
```

while keeping every unit inside `Pattern Theory`.

Use bounded deterministic adjacent/unit ordering.

No factorial search.

---

# 14. Direct-parent Files are an unlabeled internal unit

Treat direct parent Files as one internal band-like unit for packing/order purposes.

Across signed-rank columns, compute its required vertical height using the existing Directional rank-stack logic.

Conceptually:

```text
Parent container internal units:

[direct parent Files]
[child band A]
[child band B]
```

The direct unit has no visible inner folder label.

It may be placed before, between, or after child bands if this improves crossing/span and remains deterministic.

---

# 15. Child band heights use actual module dimensions

Adaptive Compass may make File modules different heights.

For each child exact folder and signed rank:

```text
childRankStackHeight
=
sum(final module heights)
+
normal inter-module gaps
```

Then:

```text
childBandHeight
=
max(childRankStackHeight across signed ranks)
```

Use final current module dimensions.

Do not use File counts as the production geometry estimate.

---

# 16. Parent container height

Parent height must contain:

```text
all internal child bands
+
direct-parent unit if present
+
internal gaps
+
parent padding
```

No child band may visually exceed parent bounds.

The outer container is structural, not a renderer-only approximate hull.

---

# 17. Root balance uses top-level container heights

The accepted Directional root-balance rule remains, but it now compares:

```text
standalone band heights
parent-container heights
```

rather than pretending every nested child is a separate top-level band.

Balance by actual packed extent.

Do not count child bands separately against the root once they belong to one parent container.

---

# 18. Adaptive Compass remains inside File modules

Do not mix folder nesting with internal Heading layout.

Pipeline should remain conceptually:

```text
visible Heading structure
→ Adaptive Compass / Vertical Spine
→ final File-module dimensions

→ build one-level Directional folder hierarchy
→ calculate child/direct unit heights
→ calculate parent-container heights
→ root/top-level ordering
→ parent-local ordering
→ module packing
→ final exact endpoints
```

Folder containers constrain module macro Y placement.

Adaptive Compass still controls internal Heading branch geometry.

---

# 19. Crossing-optimized Heading order remains default

Keep:

```text
Crossing optimized
```

as default.

It may reorder graph-only legal sibling Heading branches.

But it may not move a File or folder unit outside its folder hierarchy.

Candidate scoring should operate against the nested candidate geometry.

---

# 20. Labels are relative inside nested hierarchy

For nested non-root guides:

```text
outer parent:
Pattern Theory

child:
Brain Power

child:
Foundational Patterns
```

Do not render:

```text
Pattern Theory/Brain Power
```

inside a visible `Pattern Theory` parent container.

The parent already supplies that context.

Use:

```text
final folder segment / basename
```

for parent and child visible labels.

Keep the normalized full path in:

- title/tooltip;
- ARIA name if useful for disambiguation;
- development/debug data;
- context/Inspector metadata.

---

# 21. Root label stays full path

The root exact folder remains intentionally different.

Keep the existing root band label as:

```text
full normalized workspace-relative folder path
```

for now.

Do not abbreviate it through nested parent context.

Do not add an outer parent label around it.

---

# 22. Renderer visual grammar

Reuse the restrained nested-folder visual language already proven in Soft guides where appropriate:

```text
parent:
very subtle outer fill/border
small parent folder label

child:
existing Directional band visual
contained inside parent
short child label
```

Preferred:

- thin dashed/dotted outer parent border;
- low-opacity parent fill;
- child band styling remains clearly visible;
- parent behind child;
- modest fixed padding.

Do not make a large solid dashboard panel.

The graph should remain primary.

---

# 23. Parent guide geometry must be structural

Do not simply draw an outer hull around whatever the flat Directional solver happened to produce.

The solver must first guarantee parent-child containment.

Then renderer consumes the resulting nested layout plan.

Renderer overlay may derive final SVG/HTML rectangles from worker-plan geometry, but it must not invent containment after layout.

---

# 24. Guide pointer behavior

Follow current overlay discipline:

```text
guide fills/borders
→ pointer inert
```

Do not break:

- node hover;
- edge hover;
- pan;
- zoom;
- selection.

No new folder-management context menu is required in this experiment.

This task is about nested layout/visualization first.

---

# 25. No manual flatten/promotion UI in Directional yet

Soft Folder Clusters already has rich display-tree management.

Do **not** copy its context-menu File promotion / folder flattening controls into Directional in this task.

Directional nesting is automatic from canonical folder ancestry.

The earlier Directional folder-scope/promotion idea is superseded for this experiment by automatic one-level hierarchy.

A later task may decide whether users need manual Directional nesting/flattening.

---

# 26. Soft Folder Clusters must remain unchanged

Hard isolation:

```text
Nested Directional experiment
→ no Soft display-tree semantic change
→ no Soft force change
→ no Soft guide compression change
→ no Soft context-menu change
```

The Soft implementation already has a derived nested display tree with one-child compression and renderer-local nested guide geometry. Use it as architectural evidence, not as a reason to rewrite it. fileciteturn11file0

---

# 27. Directional nested-plan model

Prefer a renderer-neutral plan rather than ad hoc JSX.

Conceptually:

```ts
interface FocusSchematicDirectionalFolderHierarchyPlan {
  readonly schemaVersion: 1;
  readonly maximumNestedDepth: 1;
  readonly rootBandFolderKey: WorkspaceFolderKey;

  readonly topLevelUnits: readonly DirectionalTopLevelFolderUnit[];
  readonly parentContainers: readonly DirectionalParentContainer[];
  readonly childBands: readonly DirectionalChildBand[];
  readonly modulePlacements: readonly DirectionalNestedModulePlacement[];

  readonly summary: DirectionalFolderHierarchySummary;
}
```

Exact types may differ.

The important properties are:

```text
module → exact source folder
module → displayed child/direct unit
child/direct unit → parent container or top-level
root band → independent
```

Plain serializable deterministic data.

---

# 28. Preserve exact folder provenance

Even when a sole singleton child is visually simplified:

```text
Folder 1/
└─ Folder 2/
   └─ Only.md
```

and displayed as direct inside `Folder 1`, keep:

```text
Only.md exactFolderKey = Folder 1/Folder 2
```

The display provenance should be inspectable in tests/dev evidence, e.g.:

```text
automatic-directional-singleton-simplification
```

Do not alter Inspector/source path.

---

# 29. Development/Sandbox comparison

Because this is an experiment, preserve the flat HIER4A geometry for comparison.

Preferred temporary Sandbox/development selector:

```text
Directional folder hierarchy:
- Flat
- Nested (1 level)
```

Default on this experimental branch may be:

```text
Nested (1 level)
```

for QA convenience.

Do not commit this as a permanent product preference yet.

If adding a product setting causes disproportionate persistence/version work, a development-only switch is acceptable.

The key is that the user can compare:

```text
Flat vs Nested
```

without rebuilding code.

---

# 30. Cache identity

If Flat/Nested are both selectable during the experiment:

```text
cache key must distinguish them
```

No stale flat geometry after switching to nested.

No stale nested geometry after switching back.

If nested replaces flat only inside a dedicated dev build instead, still increment/identify the experimental algorithm revision cleanly.

---

# 31. Worker ownership

All nested Directional packing belongs in the existing modular layout worker.

Do not calculate nested bands in React.

No additional worker.

Preserve latest-result-wins.

---

# 32. Determinism

Hard:

```text
same model + same visible structure + same policy
→ byte-identical nested plan and geometry
```

under:

- cold repeats;
- worker vs in-process;
- input permutation;
- cache miss vs hit.

No dependency on insertion order.

---

# 33. Secondary invariance

Hard:

```text
secondary-only change
→ byte-identical nested folder geometry
```

Secondary remains zero layout influence.

---

# 34. Folder guides Off

Turning visual folder guides Off:

```text
must not change nested geometry
```

It hides only overlays.

The parent/child containment remains part of the layout because it is a real geometry constraint.

---

# 35. Flat oracle

When:

```text
Directional folder hierarchy = Flat
```

the result must reproduce the accepted HIER4A Directional geometry exactly.

This is the strongest regression oracle.

Do not alter flat HIER4A while implementing nested mode.

---

# Synthetic regression fixtures

Add a compact dedicated nested-Directional corpus.

## ND1 — parent direct Files + sole singleton child

```text
A/
├─ Parent.md
└─ B/
   └─ Only.md
```

Expected nested display:

```text
A band/container
├─ Parent
└─ Only
```

No visible `B` child band.

Exact folder provenance for Only remains `A/B`.

---

## ND2 — parent direct File + sole multi-File child

```text
A/
├─ Parent.md
└─ B/
   ├─ B1.md
   └─ B2.md
```

Expected:

```text
A outer container
├─ Parent direct unit
└─ B child band
   ├─ B1
   └─ B2
```

---

## ND3 — two singleton child folders

```text
A/
├─ B/
│  └─ B1.md
└─ C/
   └─ C1.md
```

Expected:

```text
A outer container
├─ B child band
│  └─ B1
└─ C child band
   └─ C1
```

Do not singleton-compress B/C because sibling split is meaningful.

---

## ND4 — direct Files + two child folders

```text
A/
├─ Direct1.md
├─ Direct2.md
├─ B/
│  ├─ B1.md
│  └─ B2.md
└─ C/
   └─ C1.md
```

Expected:

- one outer A container;
- one unlabeled direct-parent unit;
- B child band;
- C child band;
- all contained.

---

## ND5 — one child only, no direct parent Files

```text
A/
└─ B/
   ├─ B1.md
   └─ B2.md
```

Expected:

```text
standalone B band
```

No redundant A wrapper.

---

## ND6 — child-order crossing optimization

Two child bands can swap vertically.

Construct references where:

```text
B then C
```

produces more crossings than:

```text
C then B
```

Expected:

- parent containment remains;
- child order changes;
- crossings improve;
- no module escapes parent.

---

## ND7 — folder containment beats crossings

Construct a case where pulling one File outside its child/parent would reduce crossings.

Expected nested mode:

```text
File stays in folder hierarchy
crossing remains
```

This is a deliberate design oracle.

Flat mode may behave differently.

---

## ND8 — root-folder exclusion

Root File exact folder:

```text
A/B/
```

Sibling:

```text
A/C/
```

Expected:

- root band `A/B` remains independent;
- no outer `A` container is created solely to group root with C;
- root label remains full path;
- C follows ordinary non-root rules.

---

## ND9 — root exclusion with two other siblings

```text
A/
├─ B/   ← root exact folder
├─ C/
└─ D/
```

Expected:

- B root band independent;
- C and D may form an `A` parent container if meaningful under the non-root rules;
- B is not inserted into it.

---

## ND10 — nested labels

Verify:

```text
outer visible label = A
child visible label = B
full metadata = A/B
```

Root still uses full path.

---

## ND11 — depth > 1 source tree

```text
A/B/C/
```

with other visible folders.

Expected:

```text
no more than one visible nested Directional parent layer
```

No accidental triple nesting.

Document which parent layer is selected by the algorithm.

---

## ND12 — Heading disclosure

Expand Adaptive Compass Headings inside modules in several child bands.

Expected:

- module dimensions update;
- child band heights recompute;
- parent height recomputes;
- all containment remains valid;
- no stale overlay geometry.

---

## ND13 — query hide/restore

Hide one File causing:

- sole-child simplification;
- parent materialization/dematerialization if applicable.

Restore it.

Expected deterministic original geometry when exact visible state returns.

---

## ND14 — reroot

Reroot into another File/folder.

Expected:

- new root exact folder becomes independent;
- parent hierarchy recomputes around the new root exclusion;
- camera semantics remain valid.

---

## ND15 — Secondary-only change

Expected byte-identical geometry.

---

# 36. One-level selection rule for deep source trees

The source vault can be deeper than two folders.

Define a deterministic max-depth-1 displayed hierarchy.

Preferred approach:

1. start from exact bands that contain visible non-root modules;
2. identify meaningful immediate-parent grouping candidates;
3. materialize an outer parent around its direct files + immediate child bands;
4. once a folder is materialized as an outer parent container, do **not** nest that container again under its own parent in this task;
5. standalone exact bands remain flat.

This keeps:

```text
maximum rendered nested depth = 1
```

without rewriting source ancestry.

If repository evidence suggests a cleaner equivalent, use it and document the rule.

---

# 37. Relative folder labels must be disambiguatable

Visible labels use short final segments inside nested containers.

If two visible top-level/parent labels would become ambiguous:

```text
A/Brain Power
B/Brain Power
```

they remain spatially separate, but accessibility/title metadata must preserve full normalized keys.

Do not reintroduce full path into every nested child label merely to solve rare ambiguity.

Use tooltip/ARIA/full metadata for disambiguation.

---

# 38. Parent container as renderer overlay

Recommended renderer result:

```text
outer parent
→ subtle border/fill + parent short label

child bands
→ current Directional band style + child short label

direct Files
→ no inner label
```

Do not render a separate graph node representing the parent folder.

Guides remain behind edges/nodes.

---

# 39. No edge routing around nested bands

Nested parent borders are not routing obstacles.

Current Direct/Electronic path styling remains as-is.

HIER5 owns:

- true orthogonal routing;
- channels;
- obstacle avoidance;
- parallel separation;
- hit-target fixes.

Do not route around folder containers in this experiment.

---

# 40. Performance

This should be significantly cheaper than Soft physics.

Expected work:

```text
folder hierarchy derivation
band/container sizing
bounded ordering/packing
```

No new force solver.

Measure:

- visible Files;
- exact bands;
- materialized parent containers;
- child bands;
- simplified singleton children;
- top-level ordering candidates;
- parent-local ordering sweeps;
- total layout time.

No new CI timing threshold.

---

# 41. Graphical lab / real-app QA

Prefer testing in the actual Modular Directional graph plus a small synthetic lab.

Required visual cases:

```text
ND1
ND3
ND4
ND6
ND7
ND8
ND9
ND12
```

Then test a real vault area with:

```text
parent folder
direct Files
multiple child folders
```

Ask the user:

1. Does the outer parent boundary make folder structure easier to parse?
2. Are direct parent Files understandable without a fake label?
3. Is simplifying a sole singleton child correct?
4. When there are sibling folders, does preserving even singleton child bands feel right?
5. Is one nesting level enough?
6. Does hard folder containment hurt arrow readability too much?
7. Are short child labels clearer than repeated full paths?
8. Does excluding the root folder from parent nesting feel correct?

Do not merge before this review.

---

# Likely implementation areas

Inspect current branch first.

Probable Directional layout areas:

```text
packages/focus-schematic-layout/src/folder-bands.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/settings.ts
packages/focus-schematic-layout/src/*folder-band*.test.ts
```

Existing Soft hierarchy/reference implementation:

```text
packages/focus-schematic-layout/src/soft-folder-display.ts
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.test.ts
```

Directional renderer:

```text
packages/renderer-reactflow/src/focus-schematic/folder-band-strips.tsx
packages/renderer-reactflow/src/focus-schematic/*
```

App/worker/cache only if a Flat/Nested comparison option is wired:

```text
apps/web/src/*
packages/focus-schematic-layout/src/worker-*
```

Do not mechanically create every suggested file.

---

# Suggested implementation sequence

## Phase 1 — baseline

1. Inspect current experimental branch.
2. Run current HIER4A Directional focused tests.
3. Freeze Flat byte-identical fixture hashes.
4. Inspect the merged Soft nested display-tree and guide code for reusable helpers.
5. Add ND1–ND15 fixture definitions.

## Phase 2 — pure one-level hierarchy model

6. Derive visible non-root exact folder inventory.
7. Exclude root exact folder from parent grouping.
8. Derive immediate-parent candidates.
9. Add sole-singleton-child simplification.
10. Preserve sibling child folders when child count >= 2.
11. Suppress redundant sole-parent wrappers.
12. Emit deterministic one-level hierarchy + provenance.
13. Strictly validate max depth 1.

## Phase 3 — nested Directional geometry

14. Compute final module dimensions from Adaptive Compass/Spine.
15. Compute child-band rank-stack heights.
16. Compute unlabeled direct-parent unit heights.
17. Compute parent-container heights.
18. Turn parent containers into atomic top-level ordering units.
19. Apply accepted root balance over top-level units.
20. Add bounded parent-local child/direct-unit ordering.
21. Pack modules strictly inside their units.
22. Pack units strictly inside parent.
23. Recompute exact endpoint attachments.
24. Strict containment validation.

## Phase 4 — renderer

25. Render parent outer borders/labels.
26. Render child bands inside.
27. Keep direct Files unlabeled inside parent.
28. Use relative nested labels.
29. Keep root full-path label.
30. Keep overlays pointer-inert.
31. Do not add management menus.

## Phase 5 — comparison / compatibility

32. Add Flat/Nested development or Sandbox comparison.
33. Include policy in cache identity if selectable.
34. Prove Flat byte-identical.
35. Prove Soft byte-identical/unaffected.
36. Prove Secondary zero-geometry.
37. Prove worker/cold/input-permutation determinism.

## Phase 6 — QA

38. Run synthetic nested cases.
39. Browser real-app QA.
40. Build optimized desktop if needed for evaluation.
41. Ask user for graphical review.
42. STOP.

Do not PR/merge automatically.

---

# Validation

Use current repository commands rather than inventing duplicates.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:focus-schematic-directional-folder-bands
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

If script names differ, use current repository equivalents.

---

# Hard exit gates

This experiment is ready for user QA only when:

1. Flat Directional mode remains byte-identical to accepted HIER4A.
2. nested mode has maximum visible parent depth 1.
3. root exact folder is never nested in a parent container.
4. root label remains full path.
5. root File anchor semantics remain unchanged.
6. every non-root module keeps exact folder provenance.
7. parent direct Files remain direct-parent children.
8. no fake direct-files folder label exists.
9. parent with direct Files + sole singleton child simplifies that child.
10. simplified child's source folder remains unchanged.
11. sole child with multiple Files remains visible as child band.
12. parent with >=2 child folders preserves each child split.
13. singleton sibling child folders remain visible.
14. parent with one child and no direct Files does not create redundant outer wrapper.
15. parent container materialization is deterministic.
16. nested child labels use short final segment.
17. parent label uses short final segment.
18. full paths remain available in metadata/ARIA/title.
19. root uses full path.
20. parent containers are atomic at global ordering level.
21. child bands from one parent cannot interleave with another parent.
22. parent containment outranks crossing optimization.
23. child band containment outranks crossing optimization.
24. direct-parent File containment outranks crossing optimization.
25. no topology exception may move a File outside its nested folder hierarchy.
26. crossings may remain if folder containment makes them unavoidable.
27. child/direct unit order may optimize crossings inside parent.
28. direct-parent unit is unlabeled.
29. child heights use actual final module dimensions.
30. parent height contains all child/direct units + padding.
31. root balance uses top-level parent-container heights.
32. Adaptive Compass remains unchanged internally.
33. Crossing optimized remains default.
34. Vertical Spine remains compatible.
35. Document order remains compatible.
36. exact endpoints are recomputed from final nested geometry.
37. Secondary-only change is byte-identical.
38. Folder Guides Off changes visualization only, not geometry.
39. Soft Folder Clusters behavior is unchanged.
40. Soft display intent does not alter Directional nested hierarchy.
41. no fake folder reference edges are created.
42. no folder graph nodes are created.
43. parent overlays are pointer-inert.
44. no Directional context-menu management is added.
45. ND1 passes.
46. ND2 passes.
47. ND3 passes.
48. ND4 passes.
49. ND5 passes.
50. ND6 crossing optimization stays inside parent.
51. ND7 proves folder containment beats crossing reduction.
52. ND8 root exclusion passes.
53. ND9 root sibling case passes.
54. ND10 labels pass.
55. ND11 max-depth-one passes.
56. ND12 disclosure/reflow passes.
57. ND13 hide/restore passes.
58. ND14 reroot passes.
59. ND15 Secondary invariance passes.
60. cold determinism passes.
61. input permutation determinism passes.
62. worker/in-process determinism passes.
63. cache isolation passes if Flat/Nested is selectable.
64. no new external dependency.
65. focused tests pass.
66. full `pnpm check` passes.
67. desktop check/build pass if performed.
68. user graphical QA occurs.
69. user decides whether nested Directional bands should replace/remain optional versus Flat.
70. no PR/merge occurs before that decision.
71. HIER5 is not started.

---

# Documentation / prompt archive

During this experiment, add/update a focused validation note such as:

```text
docs/HIER4A_NESTED_DIRECTIONAL_BANDS_EXPERIMENT.md
```

Do not rewrite HIER4A ADR as accepted product truth before user approval.

Record:

- one-level rule;
- root exclusion;
- singleton-child simplification;
- sibling preservation;
- hard parent containment;
- relative nested labels;
- Flat oracle;
- Soft isolation;
- visual QA result.

Archive this exact prompt at:

```text
history-implementations/HIER4A_PATCH2_nested_directional_folder_bands_codex_prompt.md
```

Report SHA-256.

---

# Final report before user QA

Return:

## 1. Branch / commit
Actual current experimental branch and pushed commit.

## 2. One-level hierarchy
How parent containers are derived and why nesting stops at one layer.

## 3. Simplification rules
Sole singleton child vs meaningful sibling folders.

## 4. Root special case
How root exact folder is kept independent.

## 5. Hard containment
How parent/child folder constraints interact with crossing optimization.

## 6. Direct parent Files
How they share the outer parent container without a fake child label.

## 7. Labels
Short nested names vs full root path/full metadata.

## 8. Flat compatibility
Byte-identical evidence.

## 9. Soft isolation
Confirm HIER4B behavior did not change.

## 10. Tests / performance
ND1–ND15, determinism, timing.

## 11. Optimized/browser build
Exact run path if prepared.

## 12. User QA
Ask whether nested one-level Directional bands should be adopted, remain optional, or be rejected.

Then stop.

Do not create a PR or merge automatically.
