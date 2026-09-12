# HIER4B — Soft Folder Clusters Bakeoff

**Task type:** new macro-layout family / deterministic soft clustering / graphical bakeoff / performance + stability validation

## Starting point

HIER4A is complete and merged.

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Known merged state:

```text
PR #77
merge commit:
70eb9f0c7cbc5cee483c90b0108e3ba9f040b404
```

HIER4A selected:

```text
Directional Folder Bands
+
Adaptive Compass
+
Crossing optimized
```

Sandbox alternatives already preserved:

```text
Vertical Spine
Document order
```

Classic Focus Hierarchy is still the global/default Focus Hierarchy implementation until HIER3C.

Do not reopen HIER4A.

Create a clean HIER4B branch/worktree from current `main`.

---

# Goal

Build and visually evaluate a second, genuinely different macro-layout family for Modular Focus Hierarchy:

```text
Soft Folder Clusters
```

This is **not** another correction to Directional Folder Bands.

Directional Folder Bands intentionally encode:

```text
incoming → left
Focus    → center
outgoing → right
```

Soft Folder Clusters intentionally removes that positional rule.

In Soft Folder Clusters:

```text
authored link direction
→ remains visible through arrow direction

module position
→ is determined by topology, distance from Focus,
   exact-folder attraction, collision avoidance,
   and compactness/stability
```

So a File that references the Focus may appear above, below, left, or right if that produces the better cluster geometry.

The user wants this as a more organic alternative where folder attraction can meaningfully be **soft**.

This is the layout family where a strength control such as:

```text
0 / 25 / 50 / 75 / 100
```

actually makes conceptual sense.

---

# Core distinction from HIER4A

## Directional Folder Bands

```text
X position has semantic meaning:
left  = toward Focus
right = away from Focus

folder membership:
categorical horizontal spatial home
```

## Soft Folder Clusters

```text
X/Y do NOT encode authored direction

arrowheads encode direction

distance from Focus:
soft topological / hop-distance signal

folder membership:
soft attraction toward same-folder modules
```

Do not hybridize these into:

```text
mostly directional columns + little folder blobs
```

That would defeat HIER4B.

---

# HIER4B is a bakeoff first

Do **not** immediately integrate Soft Folder Clusters as a normal product setting.

First build:

```text
deterministic layout implementation
+
synthetic fixture corpus
+
interactive graphical lab
+
benchmarks
+
quality/stability evidence
```

Then stop for user graphical review.

Only after explicit approval should a later HIER4B-FINAL task wire the selected Soft Cluster behavior into the actual Modular graph.

Directional Folder Bands production behavior remains unchanged during this task.

---

# Product architecture to preserve

Reuse the existing semantic/model stack:

```text
KG6 Focus neighborhood
        ↓
FocusSchematicModel
        ↓
File modules with exact visible structure
        ↓
internal File-module layout
        ↓
macro File-module layout
```

For HIER4B:

```text
internal File-module layout
→ Adaptive Compass by default
```

Do not invent a new Heading layout.

The HIER4B work is primarily the **macro placement of File modules**.

Vertical Spine may remain available in the dev lab if trivial to inherit, but do not make the HIER4B decision depend on it.

Use:

```text
Adaptive Compass
+
Crossing optimized
```

as the primary bakeoff configuration.

---

# Joint layout with Adaptive Compass

Adaptive Compass depends partly on external counterpart positions.

Soft Clusters also moves the external File modules.

Therefore do not:

```text
Compass once
→ freeze it
→ cluster Files forever
```

Use a small, fixed deterministic joint refinement.

Recommended:

```text
Round 0
→ deterministic macro seed

Round 1
→ Adaptive Compass from current external geometry
→ recompute module rectangles
→ Soft Cluster macro relaxation

Round 2
→ Adaptive Compass from updated external geometry
→ recompute rectangles
→ shorter Soft Cluster relaxation
→ final exact endpoint recomputation
```

Hard:

```text
fixed number of rounds
```

No convergence loop. No randomness.

---

# Semantic inputs

The macro layout may use:

```text
1. Focus/root identity
2. primary visible cross-module topology
3. minimum topological hop distance from Focus
4. exact folder identity
5. final module rectangle dimensions
6. stable IDs for deterministic tie-breaking/seeding
```

It must not use:

```text
Secondary links
Visual Groups
hover state
renderer state
current edge routing
screen-space camera state
```

---

# Direction is display-only for macro placement

For Soft Clusters, aggregate topology as **undirected for spatial attraction**.

Example:

```text
A → B
```

creates a symmetric spatial relationship between module A and B.

The rendered authored edge remains:

```text
A → B
```

Do not mutate semantic direction.

Do not add a signed-rank X penalty.

Hard:

```text
incoming modules are allowed on any side
outgoing modules are allowed on any side
```

Arrow direction, not x-position, communicates authored direction.

---

# Root anchor

The Focus File remains the semantic anchor.

Hard:

```text
focused File center = (0, 0)
```

or preserve the exact current root-anchor convention if the geometry API stores local/module coordinates differently.

The whole layout must not freely drift or rotate between runs.

---

# Hop-distance semantics

Compute a deterministic topological hop distance from Focus over the fixed Focus neighborhood.

Preferred:

```text
minimum UNDIRECTED module hop distance
```

because Soft Clusters intentionally removes incoming/outgoing positional meaning.

Use:

```text
hop 0 = Focus
hop 1 = directly connected module
hop 2 = two-hop context
...
```

Each hop has a **preferred** radius:

```text
preferredRadius(module)
=
hopDistance * hopSpacing
```

but this is soft.

Do not force perfect concentric circles.

Goal:

```text
nearer in topology
→ usually nearer to Focus spatially
```

not exact rings.

---

# Solver model

Implement a deterministic bounded relaxation using explicit terms:

```text
A. topology spring
B. Focus-hop radial pull
C. exact-folder centroid attraction
D. weak deterministic seed/stability anchor
E. rectangle collision separation
F. weak compactness
```

Do not import an opaque new general graph-layout engine.

---

# A. Topology spring

For each unique pair of File modules connected by at least one **primary** visible cross-module relationship:

```text
module A ↔ module B
```

create one macro spring.

Do not create one full-strength spring per exact Heading link.

Aggregate module-pair multiplicity.

Suggested weighting:

```text
weight = 1 + log2(referenceCount)
```

with a small cap around:

```text
3–4
```

Tune only with evidence.

The preferred separation must account for variable module sizes:

```text
support/half extent of A
+
support/half extent of B
+
base edge gap
```

Do not use a single point-node distance for both tiny and large Compass modules.

---

# B. Focus-hop radial pull

Each non-root module is softly attracted toward:

```text
hopDistance * hopSpacing
```

This is weaker than collision validity and must not overpower topology.

Hop distance is contextual guidance, not a hard rank.

---

# C. Exact-folder attraction

For every exact folder with at least two eligible visible modules:

```text
compute folder centroid
```

and attract its members toward that centroid.

Avoid all-pairs same-folder attraction.

Prefer:

```text
member → centroid
```

which is O(n) per iteration.

Exact identity only.

Do not merge:

```text
science/
science/physics/
```

just because paths share a prefix.

Hierarchical-folder attraction is future scope.

---

# Singleton folders

A singleton folder has no other visible member to cluster with.

Therefore:

```text
folder attraction = 0
```

for that singleton.

This is intentional and differs from Directional Folder Bands, where every singleton receives a categorical band.

Do not create fake singleton folder anchors.

---

# Filtered bridges

Preserve existing filtered-bridge semantics.

A filtered/context bridge may affect:

```text
topology
hop distance
```

if existing Focus semantics say it participates.

But if it is not eligible for visible folder grouping:

```text
exclude it from folder centroid attraction
```

Reuse current eligibility rules rather than inventing new folder ownership.

---

# D. Deterministic seed and stability anchor

Do not initialize randomly.

Create a stateless deterministic seed based on:

```text
hop distance
exact folder identity
topology
stable module ID
```

Recommended shape:

```text
root at origin
hop distance gives approximate seed radius
folder gives deterministic angular preference
stable IDs break residual ties
```

A stable folder hash may provide initial angle, but do not let lexical/hash order dominate final topology.

Add a **weak** pull back toward the deterministic seed to stop symmetric graphs rotating/flipping unpredictably.

This is for orientation and small-change stability, not for final grouping.

---

# E. Rectangle collision separation

Hard outcome:

```text
module overlap count = 0
```

Modules are variable rectangles because Adaptive Compass changes width/height.

Collision handling must use real rectangle dimensions.

Use a deterministic rectangle-resolution pass.

Conceptually:

```text
find overlapping pair
→ choose minimum-separation axis
→ split correction deterministically
```

Root stays fixed.

If root overlaps another module:

```text
move the other module only
```

Tie-break equal axes/signs by stable IDs.

No randomness.

---

# Collision broad phase

Measure first.

If pairwise checks are fine for expected Focus sizes, keep them simple.

If profiling shows collision detection dominates, use:

```text
spatial grid
sweep-and-prune
or existing internal spatial helper
```

No new dependency by default.

---

# F. Weak compactness

Use a weak compactness tendency so disconnected-looking empty space does not explode.

Prefer folding this into hop-radius behavior where possible.

Do not add a second strong center force that collapses everything around Focus.

---

# Folder Strength

The lab must expose:

```text
Folder strength:
0
25
50
75
100
```

A continuous slider is fine if easy, but these values must be directly testable.

Semantics:

```text
0
→ folder identity has zero positional influence

25
→ weak folder attraction

50
→ balanced topology/folder attraction

75
→ strong folder cohesion

100
→ strongest accepted SOFT folder attraction
```

At 100:

```text
collision validity
root anchor
basic topology readability
```

still win.

100 is not a hard enclosure.

---

# Strength scaling

Normalize:

```text
s = strength / 100
```

Map it to a bounded folder-attraction coefficient.

Start linear unless visual evidence favors a simple nonlinear curve such as:

```text
s²
```

Do not make 25/50/75 fake labels.

If they produce indistinguishable results, report it and tune.

---

# Strength 0 oracle

Hard:

```text
strength = 0
```

means folder identity has **zero geometry influence**.

Changing exact-folder keys at strength 0, while keeping everything else identical, must yield:

```text
byte-identical macro geometry
```

This is a key regression.

---

# Folder-cohesion progression

Measure repeated-folder cohesion using e.g.:

```text
folderRadius =
sqrt(mean(distance(memberCenter, folderCentroid)^2))
```

Report mean/median/p95 repeated-folder radius.

Expected broadly:

```text
strength ↑
→ repeated-folder cohesion ↑
```

Do not require every individual pair distance to decrease monotonically; collision/topology conflicts may prevent that.

But the corpus should show a meaningful overall progression.

---

# Do not destroy topology to satisfy folders

Soft means folders can lose against topology.

Track:

```text
primary connected-pair distance
exact primary crossing count
hop-radius error
folder radius
layout area
```

Do not collapse all metrics into one opaque weighted score for reporting.

The user needs to see the trade-off.

---

# Macro edge metrics

HIER5 is not implemented.

Use renderer-neutral geometry for layout metrics:

```text
module center geometry
rectangle-boundary approximation
or current exact endpoints after Compass
```

Do not optimize against SmoothStep route length.

Do not implement obstacle routing.

---

# Crossings at macro level

Measure crossings.

But do **not** make crossing count a hard global lexicographic gate like Adaptive Compass's internal candidate ranking.

That would risk turning Soft Clusters back into a layered layout.

The cluster solver should come from topology/folder/hop forces.

Crossing count is evidence.

---

# No folder bands

Soft Cluster layout must not use HIER4A horizontal folder bands.

No hidden band constraints.

Optional development visualization may show:

```text
folder centroids
folder hulls
```

but those are visual overlays only.

---

# Folder hulls

For the lab, add optional:

```text
Folder hulls: Off / On
Folder centroids: Off / On
```

A hull can be a convex hull of member module centers with padding, or a simple bounding outline if easier.

Development-only.

Do not wire folder hulls into production in this task.

---

# Adaptive Compass joint refinement

Use HIER4A-selected:

```text
Adaptive Compass
Crossing optimized
```

as the primary HIER4B internal configuration.

Suggested fixed sequence:

```text
deterministic macro seed

Round 1
→ Compass
→ module bounds
→ 24–48 macro relaxation iterations
→ collision cleanup

Round 2
→ Compass from new external geometry
→ module bounds
→ 12–24 macro relaxation iterations
→ collision cleanup

Final
→ exact endpoint recompute
```

Tune iteration counts by measurement.

Keep constants explicit.

No convergence loop.

---

# Compass churn

Track:

```text
branch-region changes between joint rounds
```

The final result must be deterministic.

If exact ties cause Compass flip-flopping, use deterministic tie retention.

Do not store prior layout state across separate layout calls.

---

# Stateless first

Keep HIER4B stateless.

Do not introduce persistent prior positions/warm-start persistence yet.

Measure small-change stability.

If stateless Soft Clusters is visually too unstable, report that as a design issue instead of silently adding history dependence.

---

# Small-change stability

Create paired fixtures for:

```text
add one unrelated module
remove one unrelated module
add one relationship
remove one relationship
hide/restore one File
expand/collapse one Heading branch
```

Align by fixed root only.

Report common-module:

```text
mean displacement
p95 displacement
max displacement
```

No rotational alignment should be necessary.

---

# Reroot

Reroot is expected to change geometry.

Verify:

```text
new root at origin
new undirected hop distances
new deterministic seed
new Compass demand
authored arrow direction unchanged
```

Do not penalize reroot for large displacement.

---

# Secondary invariance

Hard:

```text
Secondary Off ↔ On
→ byte-identical Soft Cluster geometry
```

Secondary must not enter:

- topology spring;
- hop graph;
- folder attraction;
- Compass geometry;
- collision layout objective.

---

# Visual Groups invariance

Visual Groups remain style-only.

Changing only group classification/style must not affect Soft Cluster geometry.

---

# Multiplicity saturation fixture

Test pair-reference counts:

```text
1
2
5
20
100
```

If multiplicity weighting is used, demonstrate that the effect saturates.

100 references must not create a 100× macro spring.

---

# Required synthetic fixtures

Create at least:

```text
SC1  topology-only star
SC2  two repeated folders
SC3  topology vs folder conflict
SC4  same-folder topology cooperation
SC5  disconnected same-folder attraction
SC6  singleton folders
SC7  nested exact folders
SC8  root-folder repeated members
SC9  long hop chain
SC10 topology cycle
SC11 hub / many modules
SC12 relationship multiplicity saturation
SC13 filtered bridge
SC14 multi-Heading Adaptive Compass
SC15 mixed incoming/outgoing arrows around root
SC16 strength progression
SC17 perturbation stability
SC18 query hide/restore
SC19 reroot
SC20 secondary invariance
SC21 large mixed-folder graph
SC22 highly asymmetric module rectangles
SC23 same folder split by strong topology
SC24 root + several folders with free 2D placement
```

Add more only for distinct failure modes.

---

# SC3 — topology vs folder conflict

Example:

```text
alpha: A1 A2 A3
beta:  B1 B2 B3

strong cross topology:
A1—B1
A2—B2
A3—B3
```

At strength 0 topology dominates.

At 100 folders should become visibly more cohesive without overlap/collapse.

This is a key trade-off fixture.

---

# SC5 — disconnected same-folder attraction

Two same-folder modules with no direct edge but both in the Focus neighborhood.

At strength > 0 they should move meaningfully closer as a folder group.

This proves folder force is not just duplicating topology.

---

# SC6 — singletons

Several singleton folders.

Their own folder force must be zero.

Any movement as strength changes may happen only indirectly through collision/repacking as repeated folders move.

---

# SC7 — nested exact folders

Use:

```text
science/
science/physics/
science/physics/quantum/
```

Treat each exact folder separately.

No prefix attraction.

---

# SC8 — root-folder members

Several visible Files share the root File's exact folder.

They should softly cluster around the fixed root as strength increases.

Do not create a hard root-folder enclosure.

---

# SC9 — long hop chain

```text
Root—A—B—C—D—E
```

Expected:

```text
radial distance generally correlates with hop distance
```

without forcing a straight line.

---

# SC10 — cycle

A cyclic topology should be allowed to form a compact non-columnar shape.

This demonstrates that HIER4B is truly not Directional Bands.

---

# SC11 — hub

One root/hub with many modules across folders.

Test approximately:

```text
20
50
100
```

modules if current Focus limits permit.

No overlap.

Folder strength should visibly organize the hub.

---

# SC14 — Adaptive Compass stress

Use 5–8 top-level Heading branches and exact Heading-to-Heading external references.

The internal Compass layout must adapt coherently to the free 2D macro geometry.

No stale module bounds.

---

# SC15 — direction confusion

Mix:

```text
incoming
outgoing
bidirectional
```

authored references around all sides of Focus.

This is a product test:

```text
Are arrows clear enough without left/right direction semantics?
```

Do not solve it algorithmically.

---

# SC16 — strength progression

Render the same graph at:

```text
0
25
50
75
100
```

side-by-side.

This is the most important HIER4B visual.

The user should immediately understand what Folder Strength does.

---

# SC17 — perturbation stability

Side-by-side before/after small semantic change.

Show displacement metrics.

No previous-position state.

---

# SC21 — large mixed-folder graph

Stress:

```text
many folders
repeated + singleton folders
mixed topology
variable Compass module sizes
```

Check bounded runtime and visual coherence.

---

# SC23 — strong topology splits a folder

Construct a case where forcing same-folder modules together would clearly damage topology.

At high strength:

```text
folder attraction should increase cohesion
but topology may still keep the folder partially split
```

This demonstrates that 100 remains soft.

---

# Lab

Create:

```text
HIER4B Soft Folder Clusters Lab
```

Recommended controls:

```text
Scenario

Macro layout:
- Directional Bands reference
- Soft Clusters

Folder strength:
0 / 25 / 50 / 75 / 100

Internal layout:
- Adaptive Compass
- Vertical Spine   [optional inherited comparison]

Heading order:
- Crossing optimized
- Document order

Show:
- exact primary links
- arrows
- folder hulls
- folder centroids
- hop-radius guides
- module bounds
```

Default:

```text
Soft Clusters
50
Adaptive Compass
Crossing optimized
```

---

# Directional Bands reference

Render current merged HIER4A Directional Folder Bands as a reference.

Do not modify its algorithm.

The same semantic fixture should be switchable between:

```text
Directional Bands
Soft Clusters
```

for visual comparison.

---

# Hop guides

Optional faint development circles at preferred hop radii.

They are diagnostic only.

Modules are allowed to deviate.

Do not ship them in production.

---

# Metrics

Report by scenario and strength:

## Folder cohesion

```text
mean repeated-folder RMS radius
median
p95
```

Exclude singletons.

## Topology

```text
mean connected module-pair distance
p95 connected distance
total exact-primary endpoint span
exact-primary straight crossing count
```

## Hop

```text
mean absolute hop-radius error
correlation between hop distance and radial distance
```

No stats dependency required.

## Compactness

```text
bounding-box width
height
area
```

## Collision

```text
module overlap count
minimum module gap
collision corrections
```

Hard overlap count = 0.

## Stability

```text
mean/p95/max common-module displacement
```

## Runtime

```text
module count
aggregated topology pair count
repeated folder count
solver iterations
joint Compass rounds
Compass assignments
collision checks/corrections
layout ms
```

---

# Centralize solver parameters

Keep constants in one place:

```text
topology strength
topology preferred gap
hop radial strength
hop spacing
folder max attraction
seed anchor strength
collision padding
round-1 iterations
round-2 iterations
step size/damping
max movement per iteration
```

Only Folder Strength should be a normal lab tuning control.

Do not expose a physics-control panel.

---

# Deterministic relaxation shape

A simple bounded positional solver is enough:

```text
for fixed iteration count:
    clear displacement
    accumulate topology spring
    accumulate hop radial pull
    accumulate folder-centroid pull
    accumulate weak seed anchor
    clamp displacement
    apply movement
    resolve rectangle collisions
```

Velocity simulation is unnecessary unless measurement proves otherwise.

Guard zero-distance math with epsilon.

Hard:

```text
no NaN
no Infinity
```

---

# Collision and variable rectangles

Adaptive Compass produces asymmetric rectangles.

Soft Clusters must use final current module widths/heights each joint round.

Do not use old HIER4A Mosaic dimensions.

After Compass changes:

```text
recompute bounds
→ cluster
→ collision
```

---

# No global Compass Cartesian product

Compass may evaluate up to ~64 restricted assignments **per module**.

Do not combine multiple modules as:

```text
64^N
```

Each module remains locally optimized within fixed joint macro rounds.

Instrument if needed to prove bounded behavior.

---

# Determinism

Stable-sort:

```text
modules
aggregated edges
folders
collision pairs
```

by stable keys before order-dependent calculations.

Hard:

```text
cold repeat identical
input permutation identical
secondary-only change identical
```

Add a symmetric graph fixture to prove deterministic symmetry breaking.

---

# Package boundary

Prefer implementing Soft Clusters in the existing layout package:

```text
packages/focus-schematic-layout
```

or the current repository-equivalent owner of modular macro layout.

Do not put layout logic into:

```text
React components
web app
Tauri shell
core semantic model
```

The renderer receives geometry.

---

# No Network state reuse

Do not import:

```text
Network ForceAtlas live positions
saved network coordinates
network folder fake edges
network camera state
```

Conceptual/helper reuse is allowed if clean and stateless.

Soft Cluster semantics remain independent.

---

# No new dependency by default

Expected dependency additions:

```text
0
```

The solver is constrained enough to implement locally.

Do not pull in a general force library merely for this bakeoff.

---

# Quality philosophy

Soft Clusters succeeds if it feels:

```text
organic
Focus-centric
topologically coherent
folder-aware
stable enough
compact enough
```

It is allowed to sacrifice the immediate directional-column readability of Directional Bands.

That is the reason this separate layout family exists.

---

# Do not add product settings yet

Do not add real-app settings for:

```text
Macro layout: Directional / Soft
Folder strength
```

during this bakeoff.

Those belong to HIER4B-FINAL after graphical approval.

Existing HIER4A Sandbox settings remain untouched.

The lab may expose all HIER4B controls.

---

# Likely future product UI

Design APIs so later integration can support:

```text
Macro layout
- Directional Bands
- Soft Clusters

[Soft Clusters only]
Folder strength
0–100
```

A third `None` mode is probably unnecessary because:

```text
Soft Clusters strength 0
```

is the topology-only non-directional case.

Do not add the product UI now.

---

# HIER5 boundary

Do not implement:

```text
Direct routing
Electronic routing
Electronic — Rounded
obstacle avoidance
channel separation
edge hit-target redesign
```

HIER5 owns those.

Current arrow/edge style is enough for the HIER4B bakeoff.

---

# HIER3C boundary

Do not make Modular Focus Hierarchy globally default.

Classic remains default until HIER3C.

---

# Documentation

Create/update repository-current equivalents of:

```text
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Document:

- semantic distinction from Directional Bands;
- arrows preserve direction while x/y do not;
- undirected hop distance for placement;
- exact-folder centroid attraction;
- singleton semantics;
- strength definition;
- deterministic seed;
- fixed bounded relaxation;
- Adaptive Compass joint rounds;
- stability results;
- bakeoff status.

Do not mark HIER4B complete before adoption/integration.

---

# ADR

Do not create a final adoption ADR before graphical review unless current repository convention records bakeoffs.

If an ADR is created now:

```text
status = Proposed / Under evaluation
```

No premature `ADOPT_SOFT_FOLDER_CLUSTERS`.

---

# Prompt archive

Archive the exact prompt under current history convention, e.g.:

```text
history-implementations/HIER4B_soft_folder_clusters_bakeoff_codex_prompt.md
```

Report SHA-256.

---

# Suggested implementation sequence

## Phase 0 — clean start

1. Verify current `main`.
2. Confirm HIER4A PR #77 merge.
3. Create HIER4B branch/worktree.
4. Leave unrelated `.pnpm-store/` untouched.

## Phase 1 — semantic preparation

5. Aggregate primary module-pair topology.
6. Compute undirected Focus hop distances.
7. Build exact-folder eligible memberships.
8. Build deterministic macro seed.
9. Add typed HIER4B bakeoff settings/input.

## Phase 2 — solver

10. Root anchor.
11. Topology spring.
12. Hop radial pull.
13. Folder-centroid attraction.
14. Seed/stability anchor.
15. bounded update.
16. rectangle collision.
17. deterministic tie-breaking.

## Phase 3 — strength

18. 0–100 strength mapping.
19. strength-0 folder invariance.
20. cohesion metrics.
21. SC16 progression validation.

## Phase 4 — Compass joint refinement

22. deterministic macro seed.
23. Compass round 1.
24. recompute bounds.
25. cluster round 1.
26. Compass round 2.
27. recompute bounds.
28. cluster round 2.
29. final collision.
30. final exact endpoints.
31. Compass churn measurement.

## Phase 5 — fixtures

32. SC1–SC24.
33. symmetry.
34. input permutation.
35. perturbation pairs.
36. multiplicity saturation.
37. large variable modules.

## Phase 6 — quality harness

38. folder cohesion.
39. topology span.
40. exact crossings.
41. hop quality.
42. compactness.
43. collision.
44. stability.
45. runtime/instrumentation.

## Phase 7 — graphical lab

46. Soft vs Directional selector.
47. Folder Strength.
48. hull/centroid overlays.
49. hop guides.
50. Adaptive Compass + Crossing optimized default.
51. side-by-side SC16.
52. browser validation.

## Phase 8 — performance

53. small/medium/large.
54. 20/50/100 hub.
55. large Heading modules.
56. collision profile.
57. optimize only if measured.

## Phase 9 — user review

58. Generate lab.
59. Give exact local path.
60. Ask user to inspect key cases.
61. STOP.
62. Do not integrate into real app.

A later HIER4B-FINAL prompt owns product integration.

---

# Priority graphical scenarios

Ask the user to inspect primarily:

```text
SC3  topology vs folder conflict
SC5  disconnected same-folder attraction
SC7  nested exact folders
SC9  hop chain
SC11 hub
SC14 Adaptive Compass stress
SC15 authored direction without positional direction
SC16 strength progression
SC17 small-change stability
SC21 large mixed-folder graph
SC23 topology legitimately splits folder
SC24 free 2D root/folders
```

Do not require manual review of every fixture unless problems appear.

---

# User review questions

Ask only:

1. Is Soft Clusters useful enough to keep beside Directional Bands?
2. Are arrowheads clear enough when direction is no longer left/right?
3. Which strength looks best: 0 / 25 / 50 / 75 / 100?
4. Does the strength progression feel meaningfully gradual?
5. Do folders become clearer without topology becoming confusing?
6. Does Adaptive Compass still read well in free 2D placement?
7. Is small-change movement acceptable?

Then stop.

---

# Decision outcomes

After user review, record one:

```text
ADOPT_SOFT_FOLDER_CLUSTERS
SOFT_CLUSTERS_REQUIRE_TUNING
KEEP_DIRECTIONAL_BANDS_ONLY
SOFT_CLUSTERS_REQUIRE_REDESIGN
```

If adopted/tuned, also record preferred strength.

Do not integrate automatically.

---

# Validation

Use current repository equivalents.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff

pnpm benchmark:focus-schematic-soft-clusters
pnpm generate:focus-schematic-soft-cluster-lab -- --out output/hier4b-soft-clusters-lab

pnpm check
git diff --check
```

Use current renamed package/script names if necessary.

Do not add duplicate scripts solely to match prompt wording.

No production desktop build is required before the bakeoff decision unless the lab architecture requires it.

---

# Hard exit gates

HIER4B bakeoff is review-ready only when:

1. HIER4A production behavior is untouched.
2. Soft Clusters exists as a separate macro-layout algorithm.
3. no incoming-left/outgoing-right positional rule exists.
4. authored arrows remain directed.
5. root File remains fixed at semantic origin.
6. undirected Focus hop distance is deterministic.
7. hop radius is soft.
8. primary relationships only drive macro topology.
9. module-pair topology is aggregated.
10. multiplicity is saturated if weighted.
11. exact-folder attraction uses exact identity.
12. folder attraction avoids all-pairs same-folder O(n²).
13. singleton folder contributes zero direct folder force.
14. filtered bridge folder eligibility remains correct.
15. strength supports 0/25/50/75/100.
16. strength 0 is folder-key geometry invariant.
17. strength 100 remains soft.
18. SC16 shows measurable strength progression.
19. repeated-folder cohesion metric exists.
20. topology quality metrics exist.
21. hop-quality metric exists.
22. compactness metrics exist.
23. crossing metric exists.
24. module overlap count is zero.
25. collision uses variable rectangles.
26. Adaptive Compass is primary internal layout.
27. Crossing optimized is primary Heading order.
28. Compass/macro layout uses fixed bounded joint rounds.
29. no convergence loop.
30. no randomness.
31. deterministic seed exists.
32. stable tie-breaks exist.
33. symmetric fixture is deterministic.
34. input permutation is byte-identical.
35. Secondary-only changes are byte-identical geometry.
36. Visual Group style-only changes do not affect geometry.
37. no Network live/persistent layout state is imported.
38. no production renderer layout logic is added.
39. no HIER5 routing leaks in.
40. no HIER3C default flip.
41. Directional Bands remains unmodified reference.
42. no hidden horizontal bands constrain Soft Clusters.
43. folder hulls/centroids are visualization-only.
44. nested exact folders remain distinct.
45. root-folder repeated members cluster softly.
46. SC3 topology/folder conflict behaves sensibly.
47. SC5 demonstrates genuine folder attraction.
48. SC6 singleton semantics are correct.
49. SC9 preserves useful hop progression.
50. SC10 is non-columnar.
51. SC11 remains collision-free.
52. SC12 proves multiplicity saturation.
53. SC14 keeps valid Compass geometry.
54. SC15 clearly renders authored arrows.
55. SC17 reports perturbation stability.
56. SC21 runtime remains bounded.
57. SC23 demonstrates soft, not hard, folder cohesion.
58. large-module rectangles are handled.
59. solver iteration counts are explicit.
60. runtime is reported.
61. Compass region churn is reported.
62. query hide/restore is deterministic.
63. reroot is deterministic under new semantics.
64. lab has Soft vs Directional.
65. lab has Folder Strength.
66. lab defaults to Soft / 50 / Adaptive Compass / Crossing optimized.
67. SC16 shows all five strengths.
68. folder hull/centroid overlays work.
69. hop guides work.
70. no new dependency unless specifically justified.
71. tests pass.
72. benchmarks pass.
73. `pnpm check` passes.
74. docs describe semantics correctly.
75. HIER4B is not marked complete/adopted.
76. prompt is archived with SHA-256.
77. user receives exact lab path.
78. implementation stops for graphical review.
79. no real product macro-layout setting is added.
80. HIER4B-FINAL is not started automatically.

---

# Final implementation report before review

## Status

```text
HIER4B Soft Folder Clusters
→ BAKEOFF READY
```

not adopted.

## Algorithm

Explain:

```text
deterministic seed
+ primary topology spring
+ soft hop radius
+ exact-folder centroid attraction
+ rectangle collision
+ weak stability/compactness
```

## Direction semantics

Confirm:

```text
authored direction is shown by arrows
not x/y position
```

## Folder Strength

Explain actual 0–100 coefficient mapping.

## Adaptive Compass joint refinement

Report fixed rounds and region churn.

## Strength table

For 0/25/50/75/100:

```text
folder cohesion
topology span
crossings
hop error
area
stability
runtime
```

## Fixtures

Highlight SC3, SC5, SC9, SC11, SC14, SC15, SC16, SC17, SC21, SC23, SC24.

## Determinism

Cold/input-permutation/Secondary invariance.

## Performance

Small/medium/large + iteration counts.

## Graphical lab

Provide exact generated path.

## Files changed

## Dependencies

Expected:

```text
0
```

## Checks

## Decision requested

Ask user to choose:

```text
ADOPT_SOFT_FOLDER_CLUSTERS
SOFT_CLUSTERS_REQUIRE_TUNING
KEEP_DIRECTIONAL_BANDS_ONLY
SOFT_CLUSTERS_REQUIRE_REDESIGN
```

and, if relevant:

```text
preferred Folder Strength
```

Then stop.
