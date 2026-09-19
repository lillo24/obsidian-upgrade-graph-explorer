# HIER4B-SPACING-FIX5 — Focus-Neutral Foldering + Hard Nested Hierarchy Containment + Named-Folder Coverage

**Task type:** structural Soft-folder semantics correction / continuation of open PR #106 / native graphical QA gate

## Goal

Continue the still-open PR #106 after founder graphical QA of FIX4.

FIX4 materially improved **immediate/direct folder unity**, but native QA shows that three distinct problems remain:

1. **The Focus File is still counted as a folder member for visual/structural foldering.**
   - Wrong.
   - The Focus File must remain the neutral central anchor and must not contribute to folder-guide geometry, folder cohesion, compound folder bodies, nested folder membership, radial folder spacing, or visible folder counts.
   - Its truthful source-folder metadata may remain available for context/inspection.

2. **Nested mode still allows geometry/topology to split or miscompose logical ancestor folders.**
   - Direct mode now groups immediate folders correctly.
   - Nested mode still builds parent guides through spatial island partitioning.
   - A logical parent can therefore fail to collect all of its actual child folders/direct Files or appear as disconnected/duplicated regions.
   - Logical folder ancestry must now outrank line/topology optimization in Nested Soft Clusters.

3. **A normal visible File with a named immediate folder can still appear without a folder guide.**
   - A synthetic equivalent of `Context conjunction.md` in `Neuroscience/` must always receive a `Neuroscience` guide in both Direct and Nested modes.
   - Workspace-root Files remain the explicit allowed folderless case when `Include workspace root group = Off`.

Do not merge before founder native QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
PR #106
branch: codex/hier4b-spacing-slider
current head at prompt-writing time:
262bac5625bbe2087712ad914fb0e29d5d672d84
```

PR #106 is OPEN and UNMERGED.

Latest `main` observed at prompt-writing time:

```text
af24cb7841f5d9332c5c6ddc72dde56313d19e4d
```

The PR branch is behind current `main`.

Before editing:

1. read current `AGENTS.md`;
2. fetch refs;
3. verify PR #106 is still open;
4. verify current PR head;
5. integrate latest `main` according to repository workflow;
6. preserve unrelated newer-main changes;
7. update the same PR #106;
8. record exact starting main/head SHAs.

Do not create a replacement PR unless continuing #106 is technically impossible.

---

# External founder examples

The founder supplied a native screenshot and concrete real-vault examples.

Codex should **not assume external private vault access**. The task must be implementable from this prompt + the graph-explorer repository.

Use synthetic fixtures mirroring this hierarchy:

```text
Pattern theory/
├─ Patterns Instances/
│  ├─ General Pattern/
│  │  ├─ God.md
│  │  └─ Philosophy to practice/
│  │     └─ Relativity vs Absolutism.md
│  └─ Underlying Patterns/
│     └─ Foundational Patterns.md
├─ Language/
│  └─ ...
└─ Response Behaviour/
   ├─ Associated Value.md        ← Focus in reported run
   ├─ Emotions.md
   ├─ Body State.md
   └─ Rationale vs Simple Response System.md
```

Another real-vault example:

```text
Z-Not in Graph/
└─ Theory/
   └─ Neuroscience/
      └─ Context conjunction.md
```

Workspace-root accepted exception:

```text
RoadMap.md
```

Do not commit private vault content or screenshots.

---

# Founder expectation: exact Nested hierarchy

In Nested mode the folder hierarchy should compose logically bottom-up:

```text
Relativity
↓
Philosophy to practice

God + Philosophy-to-practice subtree
↓
General Pattern

General Pattern + Underlying Patterns subtree
↓
Patterns Instances

Patterns Instances + Language + Response Behaviour + ...
↓
Pattern theory
```

Specifically:

```text
General Pattern
must contain:
- God
- Philosophy to practice
  - Relativity
```

and:

```text
Patterns Instances
must contain:
- General Pattern subtree
- Underlying Patterns subtree
  - Foundational Patterns
```

and:

```text
Pattern theory
must contain all retained visible descendant subtrees
according to the actual folder tree
```

A logically shallower File/subfolder must not be omitted merely because geometry/topology placed it elsewhere.

---

# What FIX4 solved vs what it did not

FIX4 correctly changed immediate named-folder semantics:

```text
same immediate folder
→ hard cohesive direct cluster
```

It also changed automatic compression so named folders with direct Files survive.

Preserve that.

However current Nested rendering still does approximately:

```text
parent units
= parent direct Files + rendered child folder regions

then:
splitIntoIslands(parent units, blockers)
```

using distance threshold + blocker geometry.

That means Nested mode still effectively says:

```text
logical parenthood is optional when geometry disagrees
```

Retire that behavior.

---

# New product priority

For **Nested Soft Folder Clusters**:

Hard:

```text
Focus File neutral / excluded from folder grouping
every visible named immediate folder represented
immediate folder unity
retained logical parent-child folder containment
one retained named folder = one logical region
no module overlap
```

Soft:

```text
topology spring quality
hop radius
edge length
crossing optimization
ancestor attraction strength
minimum displacement
```

In other words:

```text
folder hierarchy > line optimization
```

for folder-membership/containment.

Topology still influences positioning **inside** the allowed hierarchy, but cannot decide that a child is not inside its actual parent.

---

# PART A — Focus File becomes folder-neutral everywhere

## Required semantic

The selected Focus/root File remains:

```text
central
fixed
collision obstacle
topology anchor
fully inspectable
```

but is NOT a visual/structural member of any Soft folder group.

If Focus is:

```text
Response Behaviour/Associated Value.md
```

then visible Response Behaviour should conceptually contain:

```text
Emotions
Body State
Rationale vs Simple Response System
...
```

NOT Associated Value.

The Focus File sits outside the folder region as the neutral graph anchor.

## Preserve source-folder metadata

Do not erase the Focus File's actual folder metadata from the semantic model.

Keep available:

```text
exactFolderKey
manual/display parent metadata
context menu information if needed
debug/inspection metadata
```

This is a **folder grouping projection**, not source-data falsification.

## Preferred architecture: one explicit focus-neutral grouping projection

Avoid scattering root checks across unrelated layers.

Prefer one derived seam conceptually like:

```ts
projectSoftFolderGroupingTree(tree, {
  excludedFileIds: [rootModuleId],
  includeWorkspaceRootGroup,
})
```

or equivalent.

The semantic/full display-intent tree may still contain Focus for metadata/context actions.

The grouping/presentation projection used for:

```text
folder cohesion
compound bodies
nested hierarchy packing
radial grouping
folder guides
visible folder counts/evidence
```

must exclude Focus.

## Projection behavior after excluding Focus

After removing Focus from grouping:

1. remove it from direct membership;
2. recompute descendant membership;
3. prune empty presentation-only folders;
4. re-apply pass-through ancestor compression if needed.

Examples:

```text
Folder/
└─ Focus.md
```

No other visible descendants:

```text
Folder produces no visible guide
```

```text
Folder/
├─ Focus.md
├─ A.md
└─ B.md
```

Visible grouping:

```text
Folder/
├─ A
└─ B
```

```text
Folder/
├─ Focus.md
└─ Child/
   └─ A.md
```

If Folder becomes a pure one-child pass-through ancestor after Focus exclusion, it may compress according to current rules.

## Focus is not an anchored folder body anymore

FIX3B/FIX4 currently derives compound folder bodies from all Files and treats the body containing `rootModuleId` as anchored.

Refactor this.

Create an explicit neutral body/obstacle for the Focus module:

```text
focus-anchor
```

Properties:

```text
member = Focus module only
anchored = true
folderKey = null
not rendered as folder
not counted as folder
not radially spread
```

Named folder bodies must not contain Focus merely because its source path is inside them.

## Continuous radial safety includes Focus anchor

Focus still participates in:

```text
module overlap safety
compound-body packing safety
continuous spread safety oracle
```

Other folder groups must remain safe relative to it across the supported spacing range.

## Focus hard tests

Add at least:

### FOCUS1

```text
Folder/
├─ Focus
├─ A
└─ B
```

Guide membership = `{A, B}`.

### FOCUS2

Focus does not enter immediate-folder cohesion.

### FOCUS3

Focus is an explicit neutral anchored body in compound packing.

### FOCUS4

Named folder can move under radial spread; Focus cannot.

### FOCUS5

Focus absent from every Nested ancestor guide `memberModuleIds`.

### FOCUS6

Focus-only folder does not create a visible product folder.

### FOCUS7

Focus still retains truthful source-folder metadata outside grouping geometry.

---

# PART B — Hard logical Nested hierarchy

Direct mode can continue using FIX4 immediate-folder behavior.

Nested mode needs a **structural nested hierarchy stage**.

Do not solve this only by drawing a giant parent hull after the fact.

The structural layout must place folder subtrees so parent-child relationships are geometrically coherent.

## Retained folder tree

Use the current post-manual/post-auto-compression named folder tree through the Focus-neutral grouping projection.

The tree contains:

```text
named folder nodes
direct non-Focus File members
child named folder nodes
```

Workspace root `.` remains structural and normally has no visible guide when root grouping is Off.

## Hard membership invariant

For every retained named folder `P`:

```text
members(P)
=
direct non-Focus File members(P)
UNION
all descendant non-Focus File members of retained child folders
```

The Nested guide for `P` must cover exactly this logical retained subtree membership.

No geometry heuristic may remove a logical descendant.

## Hard parent/child invariant

For retained child `C` of parent `P`:

```text
members(C) ⊆ members(P)
```

Geometrically:

```text
C's rendered region contributes to / lies inside the single rendered region of P
```

Do not allow C to float outside P because topology found a better line arrangement.

## One retained named folder = one Nested region

For Nested mode:

```text
regionCount = 1
```

for every retained named folder.

No repeated same-folder labels.

## Current island partition becomes validator, not authority

Current renderer island splitting may remain useful diagnostically.

But in Nested mode it must no longer decide logical membership.

Preferred architecture:

```text
structural nested packing
→ one coherent logical folder region
→ renderer validates one region
```

If a retained parent would split:

```text
explicit development/layout failure
```

not silently draw multiple regions.

---

# PART C — Bottom-up nested hierarchy packing

Add a deterministic structural stage for Nested mode.

Suggested pipeline:

```text
existing Soft solve
→ FIX4 immediate-folder cohesion
→ NEW bottom-up nested folder hierarchy packing
→ hierarchy-aware radial-safety/compound packing
→ final structural candidate
→ Soft spacing postprocess
```

Exact integration with FIX3B group packing may require refactoring.

Do not simply stack conflicting packers without reasoning about ownership.

## Nested packing unit model

Process the retained tree deepest-first.

For each folder node:

```text
direct-member unit
+
child-folder subtree units
```

### Direct-member unit

All direct non-Focus File modules of that folder.

FIX4 already makes them cohesive.

Treat them as one rigid unit during parent-level packing.

### Child-folder subtree unit

A fully packed child folder subtree.

Move it as one rigid compound object when arranging the parent.

Never tear a previously packed child subtree apart at an ancestor level.

## Example: General Pattern

```text
General Pattern/
├─ God.md
└─ Philosophy/
   └─ Relativity.md
```

At General Pattern level:

```text
unit A = God direct-member unit
unit B = Philosophy subtree
```

Pack A + B into one coherent General Pattern parent region.

Then General Pattern becomes one rigid subtree unit for Patterns Instances.

## Example: Patterns Instances

```text
Patterns Instances/
├─ General Pattern subtree
└─ Underlying Patterns subtree
   └─ Foundational Patterns
```

Pack those two subtrees into one coherent Patterns Instances region.

Then treat the whole result as one rigid subtree at the next parent.

## Workspace root structural level

At `.`:

```text
retained top-level named folder subtrees
root-level normal Files
Focus neutral anchor
```

No workspace-root guide unless option On.

But workspace root may own final top-level subtree separation to prevent interleaving.

## Nested packing hard objectives

```text
no module overlap
single region per retained named folder
no sibling subtree interleaving
Focus fixed
child subtree integrity preserved
logical containment preserved
```

Soft objectives:

```text
minimum translation
preserve topology edge lengths
preserve polar order/direction
preserve hop radii
minimize canvas growth
minimize crossings
```

## Hierarchy beats topology

If topology wants two descendants far apart but they share a retained parent, Nested packing may move them/subtrees together enough to preserve the hierarchy.

Measure the topology cost; do not violate hierarchy.

## No internal module changes

Nested packing moves:

```text
whole File modules
whole already-packed folder subtrees
```

Do not change:

```text
File internal geometry
Heading side
Block positions
module dimensions
Adaptive Compass assignment
Heading ordering
```

## Sibling blocker invariant

An unrelated sibling/external subtree must not sit inside the visual envelope connecting a parent's logical child units.

Structural packing must prevent this.

Do not respond by splitting the parent.

---

# PART D — Refactor FIX3B ownership for Nested mode

FIX3B currently globally packs **immediate folder bodies** to guarantee safe rigid radial spreading.

That global peer treatment is incompatible with hard Nested hierarchy if it later moves a child independently away from its parent/siblings.

Do NOT blindly run:

```text
nested pack
→ old global immediate-folder pack
```

if the second stage can destroy nested composition.

## Required mode-specific architecture

Direct mode:

```text
keep current FIX4/FIX3B immediate-folder compound packing
```

Nested mode:

```text
use hierarchy-aware compound packing
```

Nested structural output must preserve subtree integrity through final adoption.

## Radial spacing in Nested mode

Prefer to keep current Soft spacing UX if it can coexist with hard Nested containment.

Add hard validation across the slider domain:

```text
for each supported spacing value:
  every retained nested folder still has one region
  every logical child remains contained
  no overlap
```

If existing immediate-folder centroid spread breaks hard Nested containment:

```text
STOP and report
```

Do not add post-slider collision/repacking.

Do not silently invent a new Nested spacing semantic without founder review.

## Exhaustive slider validation

Inspect actual slider step.

If integer `0..100` step 1, exhaustively validate all 101 values for Nested hard invariants.

If fractional values are possible, use an appropriate continuous guarantee plus sampling.

Retain FIX3B continuous module-overlap safety.

---

# PART E — Context-conjunction class missing-folder bug

A normal visible File with a named immediate folder must never silently lack its immediate folder guide.

Add explicit coverage auditing.

## Groupable File definition

A module is folder-groupable when:

```text
presentation = visible-content OR visible-context
module is not Focus
directDisplayParentFolderKey != "."
module boundary geometry exists
```

A genuinely `presentation = filtered` bridge may be exempt from normal folder-guide membership because it is not a normal visible File module.

Keep that distinction explicit.

## Folder coverage hard invariant

For every groupable File:

Direct mode:

```text
exactly one guide for its immediate named folder contains its module ID
```

Nested mode:

```text
immediate folder guide contains it
every retained ancestor guide contains it
```

No silent missing guide.

## Coverage evidence

Add development evidence/validation counts such as:

```text
groupableVisibleFileCount
workspaceRootExemptFileCount
focusExemptFileCount
filteredBridgeExemptFileCount
immediateFolderCoveredFileCount
missingImmediateFolderGuideCount
nestedAncestorCoverageViolationCount
```

Hard:

```text
missingImmediateFolderGuideCount = 0
nestedAncestorCoverageViolationCount = 0
```

## Synthetic Context regression

Create a normal visible File:

```text
Z/
└─ Theory/
   └─ Neuroscience/
      └─ Context.md
```

Assert:

```text
Direct:
  Neuroscience guide exists and contains Context

Nested:
  Neuroscience guide exists and contains Context
```

Pass-through ancestors `Theory`/`Z` may compress if they have no direct Files and exactly one child.

But `Neuroscience` cannot compress because it has a direct visible File.

## Filtered bridge regression

Add a separate filtered-module fixture and make the exemption explicit.

If current UI makes a filtered bridge visually indistinguishable from a normal File card, report that separately; do not broaden this task unless necessary.

---

# PART F — Nested renderer becomes hierarchy-driven

The renderer should consume structurally packed hierarchy.

Do not use `splitIntoIslands(...)` to decide which logical child units belong to a parent.

Preferred nested construction:

```text
bottom-up:
  child guides already exist
  parent units = direct module unit(s) + child guide units
  build ONE parent guide from all logical units
```

Structural packing is responsible for making this geometry valid.

## Nested guide validation

Before drawing a parent guide, validate:

```text
all logical child units present
no unrelated blocker swallowed
one coherent parent region
```

If invalid:

```text
throw/report explicit layout validation failure
```

Do not drop a child.

Do not split the parent.

## Direct renderer

Keep FIX4 behavior:

```text
immediate named folder
→ exactly one guide
```

No ancestor guides.

---

# PART G — Focus-neutral guide construction

The renderer must not see Focus as a direct visual unit.

Even if semantic tree data still lists Focus for metadata/context, the grouping projection must remove it before:

```text
direct guide membership
descendant membership
blocker exclusion
guide hull construction
visible folder counts
```

## Focus as blocker

Although Focus is not a folder member, it remains a real graph module.

Therefore:

```text
Focus counts as an unrelated blocker
```

A folder hull must not swallow Focus simply because Focus's source path is inside that folder.

Structural packing should move the folder group around the fixed Focus if needed.

## Response Behaviour example

Source:

```text
Response Behaviour/
├─ Associated Value      ← Focus
├─ Emotions
├─ Body State
└─ Rationale
```

Grouping projection:

```text
Response Behaviour/
├─ Emotions
├─ Body State
└─ Rationale
```

Focus:

```text
outside membership
fixed blocker
```

Guide must not enclose Focus.

## Ancestors containing Focus source path

Focus must also be excluded from all ancestor guide membership.

For example:

```text
Pattern theory
Response Behaviour
...
```

may exist logically, but Focus is not in any `memberModuleIds` set.

---

# PART H — Deep hierarchy regression fixture

Add a synthetic fixture structurally equivalent to:

```text
PatternTheory/
├─ PatternInstances/
│  ├─ GeneralPattern/
│  │  ├─ God.md
│  │  └─ Philosophy/
│  │     └─ Relativity.md
│  └─ Underlying/
│     └─ Foundational.md
├─ Language/
│  ├─ Language.md
│  └─ Symbols.md
└─ ResponseBehaviour/
   ├─ Focus.md
   ├─ Emotions.md
   ├─ BodyState.md
   └─ Rationale.md
```

Focus = `Focus.md`.

## Expected Direct mode

```text
GeneralPattern contains God only
Philosophy contains Relativity
Underlying contains Foundational
Language contains Language/Symbols
ResponseBehaviour contains Emotions/BodyState/Rationale
Focus belongs to no guide
```

## Expected Nested mode

```text
Philosophy ⊂ GeneralPattern ⊂ PatternInstances ⊂ PatternTheory
Underlying ⊂ PatternInstances ⊂ PatternTheory
Language ⊂ PatternTheory
ResponseBehaviour ⊂ PatternTheory
```

and:

```text
God ∈ GeneralPattern
Relativity ∈ Philosophy + GeneralPattern + PatternInstances + PatternTheory
Foundational ∈ Underlying + PatternInstances + PatternTheory
Focus ∉ every folder
```

## Exact membership assertions

Assert exact sets, e.g.:

```text
members(Philosophy)
= {Relativity}

members(GeneralPattern)
= {God, Relativity}

members(Underlying)
= {Foundational}

members(PatternInstances)
= {God, Relativity, Foundational}

members(PatternTheory)
= union of all visible non-Focus descendants under PatternTheory
```

Do not assert only label existence.

## Parent choice is path-based, never proximity-based

Invariant:

```text
parent folder = actual retained logical display-tree parent
```

Never:

```text
nearest spatial folder
best crossing folder
closest centroid
```

Geometry determines position, not ancestry.

---

# Automatic compression after Focus-neutral projection

Preserve FIX4 semantic rule:

```text
folder with direct visible non-Focus Files
→ cannot auto-compress

folder with no direct Files and exactly one retained child
→ may auto-compress
```

A parent with two child subfolders must remain even with no direct Files.

This is essential for the `Patterns Instances` example.

Manual flattening/promotion remain authoritative.

Do not resurrect manually flattened layers.

---

# Folder strength semantics

Keep FIX4 semantics:

```text
immediate named-folder unity remains hard at all strengths
```

Nested retained hierarchy containment also remains hard at all strengths when Nested mode is selected.

Folder strength controls additional Soft attraction, not whether ancestry exists.

Update help/docs if needed.

---

# Direct-only toggle semantics

Document clearly:

```text
Direct:
  immediate named-folder hard groups only

Nested:
  full retained folder hierarchy hard containment
```

Do not let Direct mode inherit ancestor packing accidentally.

---

# Evidence / metrics

Add Nested hierarchy evidence such as:

```text
retainedNestedFolderCount
nestedFolderPackingMoveMean
nestedFolderPackingMoveP95
nestedFolderPackingMoveMax
nestedFolderPackingDepth
nestedParentContainmentViolationCount
nestedFolderSplitViolationCount
nestedGuideBlockerViolationCount
missingImmediateFolderGuideCount
nestedAncestorCoverageViolationCount
```

Hard:

```text
nestedParentContainmentViolationCount = 0
nestedFolderSplitViolationCount = 0
missingImmediateFolderGuideCount = 0
nestedAncestorCoverageViolationCount = 0
```

Also report topology tradeoffs:

```text
connectedPairDistanceMean/P95
exactPrimaryEndpointSpanMean/P95
exactEndpointCrossingCount
hopMeanAbsoluteRadiusError
boundsArea
layoutMs
```

before vs after Nested packing.

---

# Determinism / isolation

Nested packing must be bounded and deterministic.

Test:

```text
cold repeat
input-order permutation
worker serialization round-trip
```

Preserve:

```text
secondary references = zero geometry influence
Adaptive assignment/scoring unchanged
internal module geometry unchanged
Directional byte identity unchanged
```

Only whole modules/subtrees may translate.

---

# Warning/fallback behavior

Keep FIX2 explicit warning behavior.

No broad silent catch.

If a hard folder invariant fails:

```text
surface exact development/native warning
retain last validated graph if appropriate
```

Do not silently fall back and make the user think the feature applied.

---

# Versioning

This changes structural Soft geometry and evidence.

Current PR is approximately:

```text
Soft algorithm/cache v10
worker protocol v12
Soft evidence schema v7
Directional algorithm unchanged
```

Inspect actual constants first.

Expected:

```text
Soft algorithm bump required
```

Bump worker/evidence protocol only if serialized shape changes.

Do not bump Directional.

Explain every version change.

---

# Likely files / areas

Inspect current branch first.

Probable:

```text
packages/focus-schematic-layout/src/soft-folder-display.ts
packages/focus-schematic-layout/src/soft-folder-display.test.ts
packages/focus-schematic-layout/src/soft-folder-cohesion.ts
packages/focus-schematic-layout/src/soft-folder-cohesion.test.ts
packages/focus-schematic-layout/src/soft-group-packing.ts
packages/focus-schematic-layout/src/soft-group-packing.test.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-cluster-fixtures.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/policies.ts

likely new:
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.ts
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.test.ts

packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.test.ts
packages/renderer-reactflow/src/focus-schematic/README.md

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/components/GraphSettings.modular.test.tsx

tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
tools/focus-schematic-bakeoff/src/soft-cluster-lab.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
docs/ROADMAP.md
history-implementations/
```

Do not force every file to change.

---

# Required tests summary

At minimum add/adjust:

## N1 — deep retained hierarchy

Exact membership sets from the synthetic hierarchy above.

## N2 — Direct vs Nested

Direct has only immediate guides.

Nested has full retained ancestry.

## N3 — logical parent no split

Every retained named Nested folder:

```text
regionCount = 1
```

## N4 — common parent composition

God + Philosophy subtree under GeneralPattern.

GeneralPattern + Underlying under PatternInstances.

## N5 — Focus neutral

Focus absent from every guide member set.

## N6 — Focus blocker

Folder hull does not count/swallow Focus as member.

## N7 — Focus source metadata

Still truthful outside geometry projection.

## N8 — Context-style named singleton

Normal visible File in Neuroscience gets guide in Direct + Nested.

## N9 — workspace-root exemption

Root-level File may be folderless when root grouping Off.

## N10 — filtered bridge exemption

Explicit and separate.

## N11 — automatic compression

No-direct single-child ancestor can compress.

Multi-child ancestor stays.

Direct-file folder stays.

## N12 — manual flatten

Explicit flattened layer remains absent.

## N13 — slider exhaustive Nested validation

All supported values preserve:

```text
one region per retained folder
coverage
no overlaps
```

## N14 — Direct spacing regression

Current Direct rigid folder spread remains intact.

## N15 — continuous overlap safety

Existing FIX3B oracle still passes.

## N16 — deterministic output

Cold repeat + permutation.

## N17 — Directional identity

Unchanged.

## N18 — secondary zero influence

Unchanged.

---

# Benchmark decision gate

Proceed if:

```text
Nested hard containment passes
Focus neutral semantics pass
named-file coverage passes
spread safety passes
bounds/topology degradation remains reviewable
```

STOP and report if Nested hierarchy requires:

```text
pathological bounds growth
unbounded packing
internal module geometry changes
post-slider repacking
or a new spacing semantic
```

Do not silently choose a new product rule in those cases.

---

# Validation

Follow current `AGENTS.md`.

Expected repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run apps/web/src/components

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current scripts if paths/names changed.

No new dependency unless clearly justified.

---

# Native artifact

Build:

```text
hier4b-spacing-fix5-nested-hierarchy-focus-neutral-native-candidate.exe
```

Report SHA-256.

Update the same PR #106.

Run CI.

Do not merge.

---

# Native founder QA request

Ask founder to retest with a deep hierarchy.

Expected:

### Focus

```text
Associated Value-style Focus
→ outside folder-guide membership
```

Sibling Files may form Response Behaviour without enclosing/counting Focus.

### Deep Nested case

Expected:

```text
Relativity
inside Philosophy

Philosophy + God
inside General Pattern

General Pattern + Underlying/Foundational
inside Patterns Instances

Patterns Instances + Language + ...
inside Pattern Theory
```

No topology-based omissions.

No duplicate same-name parent regions.

### Context-style named singleton

Expected:

```text
Context file
inside Neuroscience
```

in Direct and Nested.

### Workspace-root File

Expected:

```text
no guide by default
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_FIX5_nested_hierarchy_focus_neutral_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. same PR #106 continued;
2. latest main integrated;
3. Focus excluded from all folder grouping geometry;
4. Focus still retains source-folder metadata;
5. Focus represented as explicit neutral anchored obstacle/body;
6. Focus excluded from immediate cohesion;
7. Focus excluded from named-folder compound-body membership;
8. Focus excluded from radial folder grouping;
9. Focus excluded from every guide `memberModuleIds`;
10. Focus-only folder does not render;
11. Direct mode FIX4 semantics preserved;
12. Nested retained tree derived from logical folder ancestry;
13. Nested ancestry never inferred from spatial proximity;
14. bottom-up Nested structural packing exists;
15. child folder subtree remains rigid at parent packing level;
16. every retained named parent includes all logical retained children;
17. every retained named parent `regionCount = 1`;
18. no duplicate same-name Nested regions;
19. no logical child omitted due blocker/gap heuristic;
20. island splitter no longer determines Nested logical membership;
21. deep synthetic hierarchy exact membership sets pass;
22. GeneralPattern contains God + Philosophy subtree;
23. PatternInstances contains GeneralPattern + Underlying subtree;
24. PatternTheory contains retained descendant groups;
25. Context-style named singleton covered in Direct;
26. Context-style named singleton covered in Nested;
27. workspace-root File exempt when root grouping Off;
28. filtered bridge exemption explicit;
29. `missingImmediateFolderGuideCount = 0`;
30. `nestedAncestorCoverageViolationCount = 0`;
31. `nestedParentContainmentViolationCount = 0`;
32. `nestedFolderSplitViolationCount = 0`;
33. pass-through compression semantics preserved after Focus projection;
34. multi-child ancestor cannot auto-compress;
35. direct-file folder cannot auto-compress;
36. manual flatten remains authoritative;
37. 1/3 / 1/4 decay semantics unchanged;
38. Folder strength does not disable hierarchy;
39. FIX3B radial safety remains;
40. no post-slider collision/repacking;
41. all supported Nested slider values preserve hard hierarchy;
42. Direct spacing behavior preserved;
43. module internal geometry unchanged;
44. Adaptive Compass unchanged;
45. secondary influence zero;
46. Directional unchanged;
47. deterministic repeats pass;
48. permutation tests pass;
49. topology/bounds/crossing costs reported;
50. no pathological canvas explosion;
51. focused layout tests pass;
52. renderer tests pass;
53. web component tests pass;
54. benchmark hard gates pass;
55. full `pnpm check` passes;
56. desktop check/build passes;
57. `git diff --check` passes;
58. docs updated;
59. prompt archived + SHA-256;
60. optimized EXE + SHA-256;
61. PR #106 CI green;
62. PR remains unmerged;
63. stop.

---

# Final report before founder QA

## Branch / commits / PR #106

## Latest main integrated

## Focus-neutral projection

Explain exactly:

```text
what semantic metadata keeps Focus
what grouping projection excludes Focus
where Focus remains an obstacle
```

## Nested hierarchy algorithm

Explain:

```text
retained tree
bottom-up units
child subtree rigid translation
parent packing
blocker handling
deterministic ordering
```

## Deep hierarchy regression

Show exact synthetic membership sets:

```text
Philosophy
GeneralPattern
Underlying
PatternInstances
PatternTheory
```

## Context-style coverage

Report named singleton regression and filtered-bridge distinction.

## Direct vs Nested semantics

Summarize clearly.

## Slider compatibility

Report all-domain Nested hierarchy validation.

## Topology tradeoffs

Report worst fixture deltas.

## Versions

Explain every bump.

## Directional / Adaptive isolation

## Validation

Exact pass counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Founder QA request

Ask founder to verify:

```text
Focus no longer inside folder outlines

deep folder hierarchy matches actual path tree

Context-style named File has folder

workspace-root File remains folderless by default
```

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
