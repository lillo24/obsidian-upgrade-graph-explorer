# HIER4B-SPACING-FIX4 — Immediate Folder Unity + Guaranteed Named-Folder Visibility

**Task type:** structural Soft-cluster priority correction / continuation of open PR #106 / native graphical gate

## Goal

Continue the still-open PR #106 after founder graphical QA of FIX3B.

FIX3B successfully made folder-centroid spreading structurally safe, but native QA exposed a more fundamental mismatch in Soft Clustering:

> Files with the same immediate named folder can still be structurally far apart, and the renderer can therefore draw multiple independent folder outlines with the same folder name.

The founder's product requirement is now explicit:

```text
IMMEDIATE FOLDER COHESION IS A PRIORITY IN SOFT CLUSTERING.
```

For every visible File whose immediate folder is a named folder rather than the workspace root:

```text
1. the File must visibly belong to that named folder;
2. all visible Files with the same immediate folder must form one coherent spatial cluster;
3. one immediate named folder must not appear as multiple independent folder islands;
4. topology/hop structure may influence the cluster, but may not tear the immediate folder into separate regions.
```

Workspace-root Files are the exception:

```text
RoadMap.md-style file directly at "."
→ allowed to have no folder guide when Workspace-root grouping is OFF
```

The founder explicitly accepts that.

This task changes the priority hierarchy of Soft Clusters:

```text
Hard:
  no overlap
  Focus anchor
  immediate named-folder identity
  immediate same-folder unity

Then:
  topology / hop / endpoint quality
  ancestor folder influence
```

Ancestor folders remain soft:

```text
1/3 or 1/4 decay
optional nested wrappers
```

Do not turn ancestor folders into hard clusters.

Do not merge before founder native QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue the same PR:

```text
PR #106
branch: codex/hier4b-spacing-slider
current head at prompt-writing time:
419bdb450a28d2e95ea4790798b424eb39a7a55e
```

PR #106 is:

```text
OPEN
UNMERGED
```

Latest `main` observed at prompt-writing time:

```text
6cc5829c18b7c33385d5bb981bc9008b4df69b23
```

Before editing:

1. read current `AGENTS.md`;
2. fetch refs;
3. verify PR #106 is still open;
4. verify current PR head;
5. integrate latest `main` if the PR branch is behind;
6. preserve unrelated work;
7. update the same PR #106;
8. record exact starting main/head SHAs.

Do not create a replacement PR unless continuing #106 is technically impossible.

---

# External/native QA examples

These real-vault examples are **external context** and are not required as repository fixtures.

Do not commit private vault content.

The founder tested with Focus approximately around:

```text
Associated Value
```

Observed:

```text
same-folder Files under "Pattern Theory"
→ separated spatially
→ rendered with independent outlines carrying the same folder name
```

Also observed:

```text
RoadMap.md
→ no folder outline

Context conjunction.md
→ no folder outline
```

Repository evidence from the Icarus vault confirms:

```text
RoadMap.md
→ directly at workspace root
→ NO folder guide is acceptable when Workspace-root group is OFF

Z-Not in Graph/Theory/Neuroscience/Context conjunction.md
→ immediate folder = Neuroscience
→ MUST have a Neuroscience folder guide
```

Use synthetic equivalent fixtures in this repository.

Do not require Codex to access the Icarus repo to implement this task.

---

# Preserve FIX3B achievements

Do not regress:

```text
structural folder-group packing before spread
continuous 1.0x–2.4x radial safety oracle
folder-centroid radial spread
same-group rigid spread
Focus-containing spacing group anchored
no post-slider collision resolver
spacing excluded from structural cache identity
Direct-only post-manual/pre-compression parent semantics
normalized 1/3 / 1/4 ancestor decay
default 1/3
Workspace-root grouping option
Workspace-root option default OFF
visible ON label = "Workspace root"
FIX2 top-horizontal folder label anchor
FIX2 strict spread renderer adoption
root Focus File excluded from folder force
Adaptive Compass unchanged
Folder-strength behavior unchanged
Directional unchanged
[36,18] main Soft relaxation schedule
secondary relationships zero geometry influence
```

This task changes **immediate folder cohesion**, not the slider architecture.

---

# Current behavior to retire

The existing Soft design intentionally allowed:

```text
same immediate folder
→ multiple topology-separated spatial islands
→ renderer draws multiple guides with same folder name
```

Current fixture history includes cases such as:

```text
SC23 — topology legitimately splits one folder
```

That old assumption now conflicts with the founder's explicit requirement.

Retire that assumption.

Do not preserve tests merely because they encode the old product decision.

Update the fixture expectation instead of forcing implementation to satisfy mutually contradictory rules.

---

# New core invariant

For every named immediate folder:

```text
one folder key
→ one direct-member structural cluster
→ one Direct-only guide region
```

More formally, for all visible non-root-level Files `F`:

```text
directFolder(F) != "."
```

then:

```text
F belongs to exactly one mandatory immediate-folder group.
```

For any two Files `A`, `B`:

```text
directFolder(A) == directFolder(B) != "."
```

they must remain members of one coherent structural cluster.

They may not be separated into independent guide islands.

---

# Immediate folder identity

Continue to use the FIX2 semantic parent:

```text
post-manual File promotion
post-manual folder flattening
PRE automatic singleton compression
```

Likely field:

```text
directDisplayParentFolderKey
```

or current equivalent.

Do not derive immediate folder identity from:

```text
post-compression displayParentFolderKey
```

---

# Critical display-tree change: immediate folders must never be auto-erased

Current automatic singleton compression historically suppresses any non-root folder with exactly one direct visual child unit.

That can erase:

```text
NamedFolder/
└─ File.md
```

and lift the File upward.

This is no longer allowed for an **immediate named folder**.

Change the compression invariant.

## New compression rule

A folder with one or more **direct Files** is semantically meaningful and cannot be automatically removed merely because it has one visual child.

Automatic compression may still suppress an ancestor-only chain such as:

```text
A/
└─ B/
   └─ C/
      └─ File.md
```

Desired result:

```text
C guide
└─ File
```

with:

```text
B suppressed
A suppressed
```

because B and A have:

```text
0 direct Files
exactly 1 child folder
```

But C stays because:

```text
C has a direct File
```

This is the clean rule.

---

# Suggested automatic-compression predicate

Replace the old generic:

```text
directFileIds.size + childFolderKeys.size === 1
```

with semantics equivalent to:

```text
folder is not "."
AND
folder.directFileIds.size === 0
AND
folder.childFolderKeys.size === 1
```

after manual intent has been applied.

Inspect edge cases before using this exact code, but preserve the semantic rule:

```text
automatic compression only removes ancestor-only pass-through folders
```

Never remove a named folder that directly owns a visible File.

Manual folder flattening remains allowed to deliberately remove such a layer because that is explicit user intent.

---

# Consequence for Nested mode

Nested display must now always retain the immediate named folder.

Example:

```text
A/B/C/File.md
```

with no manual intent.

Nested presentation may become:

```text
C
└─ File
```

if A/B are useless ancestor-only wrappers.

The File must never become visually folderless or appear under an unrelated ancestor just because of automatic compression.

This directly fixes the `Context conjunction.md → Neuroscience` class of bug.

---

# Consequence for Direct-only mode

Direct-only already uses pre-compression immediate folder semantics.

Keep:

```text
one named folder with one File
→ one singleton folder guide
```

Do not suppress it.

Workspace root `"."` remains the only normal folderless case when Workspace-root grouping is OFF.

---

# Structural architecture change: add immediate-folder cohesion pass

FIX3B group packing currently treats a folder as a rigid compound body **after** the existing Soft solve.

It intentionally preserves the Files' relative positions.

That is why widely separated same-folder Files remain widely separated.

Add a new structural stage BEFORE FIX3B group packing:

```text
existing Soft solve
→ NEW immediate-folder cohesion / local compaction
→ FIX3B compound-folder group packing
→ final structural result
→ folder-centroid radial spread slider
```

The new pass is allowed to translate individual File modules **within their immediate folder**.

It must not modify the internal File/Heading/Block geometry of a module.

---

# New structural priority

The cohesion pass intentionally changes the prior topology-first compromise.

For named immediate folders:

```text
folder unity > topology preference
```

But still preserve topology as a secondary objective.

The pass should optimize:

Hard:
```text
same-folder cluster is connected/coherent
no intra-folder module overlap
Focus File remains fixed
one immediate folder can be represented by one safe guide region
```

Soft:
```text
minimum movement from pre-cohesion candidate
preserve topology edge lengths where possible
preserve member angular/source ordering where practical
preserve hop-radius intent where practical
```

Do not simply collapse every folder to a tiny pile.

---

# Cohesion pass body

For each named immediate folder with visible members:

```text
members = all visible File modules sharing directDisplayParentFolderKey
```

Workspace-root `"."` is excluded from mandatory cohesion when Workspace-root grouping is OFF.

Singleton named folder:

```text
no module movement needed
but folder identity/guide remains mandatory
```

Multi-member named folder:

```text
run deterministic local cohesion/packing
```

---

# Focus-containing immediate folder

If a named immediate folder contains the Focus/root File:

```text
Focus module is pinned
```

Other same-folder member modules may move around it to form the coherent cluster.

After cohesion:

```text
the entire folder becomes the anchored compound body for FIX3B packing/spread
```

Do not keep other members far away merely because the later group body is anchored.

This is important for the `Associated Value / Pattern Theory` style case.

---

# Cohesion geometry objective

The direct folder members should form one spatially connected local cluster.

A suitable hard oracle is:

```text
the Direct-only folder-guide projection for this folder produces exactly ONE island
```

after the structural cohesion + group packing stages.

Do not solve this only in the renderer.

The structural layout must make it true.

---

# Renderer and layout oracle sharing

Current renderer island logic uses concepts such as:

```text
rectangle gap threshold
blocker swallowing
convex guide hull
```

Do not make the layout package depend on React.

But avoid two unrelated definitions of "coherent folder".

Preferred approaches:

### Option A

Move/share a pure geometry helper into an appropriate non-React package/module that both:

```text
layout
renderer
```

can use.

### Option B

Define a layout-level cohesion invariant and add end-to-end renderer tests proving it always maps to one island.

Either is acceptable.

Do not copy/paste large geometry algorithms into two places without justification.

---

# One immediate folder must not split into multiple renderer islands

For **Direct-only mode** this is now a hard invariant:

```text
named immediate folder
→ regionCount === 1
```

If the renderer receives a structurally invalid candidate that would split the folder:

```text
fail/warn explicitly in development validation
```

Do not silently render:

```text
Pattern Theory
...
Pattern Theory
```

as two independent same-name regions.

---

# Nested-mode visual rule

In Nested mode:

```text
immediate named-folder direct members
→ must remain coherent
→ their immediate folder identity must remain visible
```

Ancestor wrappers remain optional/soft.

It is acceptable for useless ancestor-only wrappers to be compressed.

Do not require every ancestor to form a hard spatial cluster.

---

# Ancestor wrappers and island splitting

Do NOT promote ancestor folder unity to the same hard invariant.

An ancestor may contain:

```text
multiple child immediate-folder clusters
```

spread across the graph.

Current nested wrapper suppression/island behavior may remain where needed for ancestor visualization.

However:

```text
the direct member cluster of an immediate folder may not be split
```

Keep this distinction explicit in code/tests.

---

# Local cohesion algorithm — implementation freedom

Codex should inspect current geometry and select a deterministic method.

A reasonable architecture is:

```text
for each named immediate folder:
  establish local preferred center from current member centers
  preserve each module's internal rectangle
  pack member modules into one compact connected local arrangement
  choose translations minimizing displacement from original positions
  pin Focus module if present
```

Possible approaches include:

```text
bounded deterministic local relaxation
nearest-safe-position packing
polar/angular-order-preserving pack
small deterministic force pass + exact pack
```

Do not use randomness.

Do not use fixture-specific rules.

---

# Do not use attraction strength as the hard-cluster mechanism

Do not "fix" this by simply multiplying folder attraction by a huge constant.

That would:

```text
remain equilibrium-sensitive
still allow split cases
make Folder strength semantics confusing
damage topology unpredictably
```

Immediate folder unity should be a separate structural invariant/stage.

Folder strength may still influence the pre-cohesion preferred positions and broader Soft layout.

---

# Folder strength semantics

Keep the existing Folder-strength control.

But after this task its semantics become:

```text
how much folder preference influences the Soft structural equilibrium
BEFORE mandatory immediate-folder cohesion
```

It no longer gets permission to break immediate folder unity.

At:

```text
Folder strength = 0
```

clarify intended behavior carefully.

Proceed with:

```text
Soft Folder Clusters selected
→ immediate named-folder unity ALWAYS active

Folder strength 0
→ no additional centroid attraction / ancestor pull
→ but mandatory immediate-folder cohesion remains
```

This makes the control coherent:

```text
0 = minimum folder influence consistent with being a folder-cluster layout
100 = maximum soft attraction
```

Update tests/docs/UI helper text if they currently imply `0 = folders have zero geometry influence`.

This is an intentional semantic change required by the founder's new priority.

---

# FIX3B group packing after cohesion

After the new cohesion pass:

```text
immediate named folder members are already compact/coherent
```

Then run existing FIX3B structural compound-body packing.

This should now produce:

```text
smaller folder envelopes
less pathological canvas growth
better radial spread safety
```

Preserve the continuous 1.0x–2.4x safety oracle.

Re-run all FIX3B evidence because group bodies changed.

---

# Folder-centroid radial spread

Keep FIX3B slider architecture unchanged:

```text
one coherent immediate folder
→ one rigid spacing group
→ one centroid delta
```

Now same-folder intra-group distances remain fixed during the slider **and** the base group is coherent.

---

# Workspace root semantics

Founder explicitly accepts root-level Files without folder lines.

Keep:

```text
Include workspace root group = OFF by default
```

When OFF:

```text
RoadMap.md-style root-level File
→ no folder guide
→ no fake folder
→ singleton spacing body
```

When ON:

```text
root-level Files may be grouped as Workspace root
```

Do not require every File to have a folder; workspace-root Files are the explicit exception.

---

# Named-folder visibility invariant

For every visible File `F` where:

```text
directDisplayParentFolderKey(F) != "."
```

there must exist a rendered guide corresponding to that immediate named folder.

This applies even if:

```text
folder has only one visible File
ancestors are compressed
Nested mode is active
Direct-only mode is active
```

Examples:

```text
Neuroscience/Context conjunction.md
→ Neuroscience guide

NamedFolder/OnlyFile.md
→ NamedFolder guide
```

---

# Guide generation change

Current nested guide generation relies heavily on the post-compression displayed tree.

After changing compression semantics as above, most immediate-folder loss should disappear naturally.

Still add a hard end-to-end assertion:

```text
every non-root-level visible File
→ covered by its immediate named-folder guide
```

Do not infer coverage only from tree membership.

Test actual generated guide membership.

---

# Same-name duplicate guide rule

For Direct-only:

```text
each named immediate folderKey
→ exactly one guide region
```

Hard.

For Nested:

```text
do not create duplicate immediate-folder regions for the direct member cluster
```

Ancestor presentation may be separate, but avoid multiple labels representing the same immediate direct group.

If current nested renderer architecture makes same-key duplicate ancestor islands unavoidable, prefer suppressing the ambiguous ancestor duplicate over showing multiple identical folder labels.

Do not broaden into a full nested-guide redesign unless necessary.

---

# Retire / update old fixtures

Revisit at least:

```text
SC5 — disconnected same-folder islands
SC23 — topology legitimately splits one folder
```

Their old expectations conflict with the new product rule.

Update them to test the new semantics rather than deleting them.

### SC5 new expectation

```text
same immediate folder must become one coherent cluster;
topology bridge quality is secondary and measured
```

### SC23 new expectation

```text
topology may stretch internal ordering,
but cannot split one immediate named folder into separate clusters
```

---

# New/updated structural tests

## C1 — two same-folder Files on conflicting topology branches

Assert after cohesion:

```text
same immediate folder
one coherent structural cluster
one Direct-only guide region
no overlap
```

## C2 — SC23

Assert:

```text
same-folder members coherent
regionCount = 1
topology edges preserved
```

Measure topology distortion.

## C3 — SC5

Same folder remains unified despite bridge topology.

## C4 — Focus-containing same folder

```text
Focus fixed
peer Files compact around it
one folder cluster
```

## C5 — singleton named folder

```text
no movement required
guide exists
```

## C6 — root-level singleton

```text
workspace root OFF
no guide
```

## C7 — ancestor singleton chain

```text
A/B/C/File
```

Automatic compression:

```text
C remains
B/A may compress
```

Guide:

```text
C
```

## C8 — manual promotion

Immediate named folder after promotion remains mandatory.

## C9 — manual flatten

Explicit flatten can remove immediate layer; resulting direct parent becomes mandatory instead.

---

# Cohesion quality metric

Add development evidence such as:

```text
immediateFolderGroupCount
immediateFolderSingletonCount
immediateFolderCohesionMoveMean
immediateFolderCohesionMoveP95
immediateFolderCohesionMoveMax
immediateFolderRmsRadiusMean/P95
immediateFolderMaxPairDistanceMean/P95
immediateFolderSplitViolationCount
```

Hard gate:

```text
immediateFolderSplitViolationCount = 0
```

for named immediate folders.

---

# Topology quality tradeoff evidence

Because folder unity now outranks topology, report the cost.

Track before vs after cohesion:

```text
connectedPairDistanceMean/P95
exactPrimaryEndpointSpanMean/P95
exactEndpointCrossingCount
hopMeanAbsoluteRadiusError
boundsArea
layoutMs
```

Especially report worst regressions for:

```text
SC3
SC5
SC14
SC23
SC24
SC21
```

Do not hide that product choice.

---

# Group-packing evidence

Re-run FIX3B metrics after cohesion:

```text
compoundGroupCount
groupTranslationMean/P95/max
groupEnvelopeAreaMean/P95
continuous radial safety violations
bounds growth
```

The expectation is that more coherent immediate groups may reduce envelope size.

Do not require improvement if evidence differs, but report it.

---

# Determinism

New cohesion pass must be deterministic.

Test:

```text
cold repeat
input-order permutation
worker round trip
```

No random search.

---

# Secondary relationship invariance

Secondary relationships remain zero geometry influence.

The cohesion pass must derive from:

```text
folder membership
primary structural result
module rectangles
```

not secondary reference edges.

Keep the existing invariance oracle.

---

# Adaptive Compass

Do not modify Adaptive assignment/search/scoring.

The cohesion pass translates complete modules only.

Internal File/Heading/Block layout remains byte-identical within each module.

---

# Module translation only

Within cohesion:

```text
translate whole File modules
```

Do not alter:

```text
module width/height
internal node offsets
Heading side assignment
Heading ordering
Block positions relative to module
```

Only module-level x/y translations are allowed.

---

# Collision safety

During cohesion:

```text
no two File modules may overlap
```

After group packing:

```text
no cross-group overlaps
```

Across radial spread:

```text
continuous 1.0x–2.4x safety remains
```

No post-slider collision correction.

---

# Interaction with Focus-containing group packing

Pipeline:

```text
cohesion pass:
  Focus fixed
  same-folder peers may move toward/around Focus

group packing:
  entire Focus-containing folder body anchored

spread:
  entire Focus-containing body anchored
```

This is intentional.

---

# Folder guides and blockers

After structural cohesion + group packing:

```text
one direct named folder must not need multiple spatial islands
```

Use the actual renderer guide builder in integration tests.

If an unrelated group still sits inside the prospective hull and forces an island split:

```text
structural packing is insufficient
```

Move the conflicting group structurally rather than splitting the immediate folder.

This is part of the hard invariant.

---

# Ancestor guide behavior

Ancestor folders may still be:

```text
soft
compressed when pass-through-only
suppressed when visually redundant
```

Do not require a guide for every ancestor path component.

Required visible identity is the **immediate named folder**.

---

# Workspace root control

Keep existing FIX3B behavior:

```text
Include workspace root group
default OFF
```

No visible `Root folder` string.

When ON:

```text
Workspace root
```

Do not change this unless regression requires it.

---

# Preferences / Saved Views

No new user control is required for immediate-folder unity.

It becomes intrinsic Soft Clusters behavior.

Existing preferences remain:

```text
Folder strength
Direct folders only
Ancestor pull 1/3/1/4
Soft spacing
Include workspace root group
```

No new migration merely for cohesion.

---

# Algorithm/cache version

This changes structural Soft geometry and product semantics.

Bump the Soft structural algorithm/cache version to next current value.

Current PR #106 is expected around:

```text
Soft algorithm v9
worker protocol v11
evidence schema v6
Directional v4
```

Inspect actual branch first.

Bump evidence/protocol only if serialized fields/contracts change.

Do not bump Directional.

---

# UI/help text

If current `Folder strength = 0` text implies:

```text
folders have zero geometry influence
```

update it because immediate-folder unity now remains active.

Suggested concept:

```text
Folder strength
Controls additional Soft folder attraction.
Immediate folder grouping remains active at all strengths.
```

Keep wording compact.

No new control.

---

# Native QA examples to request

Ask founder to retest:

### Pattern Theory-style case

Expected:

```text
all visible Files with immediate folder Pattern Theory
→ spatially together
→ one Pattern Theory guide
```

No duplicate same-name islands.

### Context conjunction-style case

Named immediate folder:

```text
Neuroscience
```

Expected:

```text
guide always visible
```

### RoadMap-style case

Workspace root:

```text
no guide with workspace-root option OFF
```

Expected and accepted.

---

# Direct-only vs Nested

## Direct-only

Hard:

```text
one immediate named folder = exactly one guide
```

No ancestor wrappers.

## Nested

Hard:

```text
immediate named folder remains visible/coherent
```

Ancestor wrappers may be added/suppressed according to nested rules.

Test both.

---

# Benchmark decision gate

Proceed if:

```text
all immediate folder unity hard gates pass
continuous spread safety passes
no pathological canvas explosion
topology regressions are measurable but not catastrophic
```

STOP and report if immediate-folder hard cohesion requires:

```text
extreme bounds growth
massive endpoint/crossing degradation
unbounded packing
or internal module geometry changes
```

Do not silently accept pathological results.

---

# Likely implementation order

Recommended:

```text
1. adjust automatic singleton compression semantics
2. expose/validate mandatory immediate named-folder identity
3. add structural immediate-folder cohesion pass
4. update SC5/SC23 product expectations
5. integrate cohesion pass before FIX3B group packing
6. verify renderer gets exactly one Direct guide per named folder
7. verify Nested keeps immediate folder guide
8. rerun continuous spread safety
9. benchmark topology tradeoffs
10. native build
```

Codex may alter this order after inspection.

---

# Likely files / areas

Inspect actual branch first.

Probable:

```text
packages/focus-schematic-layout/src/soft-folder-display.ts
packages/focus-schematic-layout/src/soft-folder-display.test.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
packages/focus-schematic-layout/src/soft-group-packing.ts
packages/focus-schematic-layout/src/soft-group-packing.test.ts
packages/focus-schematic-layout/src/soft-cluster-fixtures.ts
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/policies.ts

possibly:
packages/focus-schematic-layout/src/soft-folder-cohesion.ts
packages/focus-schematic-layout/src/soft-folder-cohesion.test.ts

packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.tsx
packages/renderer-reactflow/src/focus-schematic/folder-cluster-guides.test.ts

apps/web/src/components/GraphSettings.tsx
apps/web/src/components/GraphSettings.modular.test.tsx

tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
tools/focus-schematic-bakeoff/src/soft-cluster-lab.ts

docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
docs/ROADMAP.md
history-implementations/
```

Do not force all files to change.

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
hier4b-spacing-fix4-immediate-folder-unity-native-candidate.exe
```

Report SHA-256.

Update same PR #106.

Run CI.

Do not merge.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_FIX4_immediate_folder_unity_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. same PR #106 continued;
2. latest main integrated;
3. immediate folder identity remains post-manual/pre-auto-compression;
4. automatic compression never removes folder with direct visible File;
5. automatic compression only removes ancestor-only pass-through folders;
6. workspace-root Files remain allowed folderless when option OFF;
7. every non-root-level visible File has immediate named-folder guide;
8. singleton named folder guide always exists;
9. structural immediate-folder cohesion pass exists;
10. same-folder member modules become one coherent cluster;
11. Direct-only named folder regionCount exactly 1;
12. no duplicate same-name Direct guide islands;
13. Focus-containing named folder cohesive with Focus pinned;
14. module internal geometry unchanged by cohesion;
15. cohesion translates modules only;
16. SC5 updated to folder-unity semantics;
17. SC23 updated to folder-unity semantics;
18. SC5 same-folder split violation = 0;
19. SC23 same-folder split violation = 0;
20. Nested mode preserves immediate folder visibility;
21. ancestor-only wrappers may still compress;
22. 1/3 / 1/4 ancestor behavior unchanged;
23. FIX3B group packing still runs after cohesion;
24. continuous 1.0x–2.4x radial safety passes;
25. folder-centroid spread remains rigid;
26. no post-spread collision resolver;
27. Workspace-root option/default unchanged;
28. no visible Root folder string;
29. Context-conjunction synthetic equivalent gets named guide;
30. RoadMap synthetic root-level equivalent gets no guide by default;
31. root-neutral force unchanged;
32. Adaptive Compass unchanged;
33. Directional unchanged;
34. secondary geometry influence zero;
35. [36,18] main relaxation schedule unchanged;
36. deterministic cold repeat passes;
37. input permutation passes;
38. immediateFolderSplitViolationCount = 0;
39. topology quality deltas reported;
40. worst bounds regressions reported;
41. group-packing evidence rerun;
42. no pathological canvas explosion;
43. focused layout tests pass;
44. renderer tests pass;
45. web component tests pass;
46. benchmark hard gates pass;
47. full `pnpm check` passes;
48. desktop check/build passes;
49. `git diff --check` passes;
50. docs updated;
51. prompt archived + SHA-256;
52. optimized EXE + SHA-256;
53. PR #106 CI green;
54. PR remains unmerged;
55. stop.

---

# Final report before founder QA

## Branch / commits / PR #106

## Latest main integrated

## Product semantic change

State explicitly:

```text
immediate named-folder unity now outranks topology splitting
ancestor folders remain soft
```

## Automatic compression change

Show old vs new rule.

## Cohesion algorithm

Explain:

```text
group membership
Focus pinning
preferred positions
packing/relaxation
coherence oracle
deterministic tie-breaks
```

## SC5 / SC23

Show before/after expectations and topology cost.

## Named-folder coverage

Report tests proving:

```text
every named immediate-folder File gets guide
singleton named folder preserved
root-level File remains ungrouped by default
```

## Folder-strength 0 semantics

State tests/docs now use:

```text
immediate unity remains active at strength 0
```

and why.

## FIX3B compatibility

Report:

```text
group packing
continuous radial safety
slider rigidity
bounds changes
```

## Topology tradeoffs

Report worst metrics.

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
Pattern Theory-style same-folder Files
→ together
→ one outline

Context conjunction-style named singleton
→ named guide exists

RoadMap-style root-level File
→ no guide by default
```

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
