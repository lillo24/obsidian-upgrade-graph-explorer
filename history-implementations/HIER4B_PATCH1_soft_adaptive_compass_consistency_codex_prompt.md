# HIER4B-PATCH1 — Adaptive Compass × Soft Folder Clusters Consistency Investigation and Fix

**Task type:** Targeted diagnosis + layout correction + QA-state reconciliation after merged HIER4B preview

## Goal

Investigate and fix a suspicious interaction between:

```text
Soft Folder Clusters
×
Adaptive Compass
```

in Modular Focus Hierarchy.

The user reports:

> In Soft Folder Clusters, selecting Adaptive Compass still leaves the visible Heading branches essentially vertical. It does not appear to distribute Heading branches meaningfully across left/right/top/bottom as Adaptive Compass is supposed to. However, switching between Adaptive Compass and Vertical Spine still changes the overall macro layout, even when the Heading placement appears unchanged. That combination looks wrong.

The task is to determine exactly why this happens, correct it at the appropriate architectural layer, and provide a fresh optimized desktop build for graphical QA.

Do **not** redesign Soft spacing in this task.

Do **not** implement the later “Keep folders unified / no island splitting” alternative in this task.

Do **not** change the already-approved Directional Bands behavior.

---

# Current repository state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

HIER4B Soft Folder Clusters has now been merged to `main` through:

```text
PR #84
merge commit:
bfc4b1c28eaa70745997da5d97115dd34ecdaade
```

Therefore:

```text
start from latest main
```

Create a fresh focused branch/worktree, suggested:

```text
codex/hier4b-patch1-soft-adaptive-compass
```

Do not continue an old removed HIER4B branch if it no longer exists remotely.

Before editing:

1. update/fetch `main`;
2. confirm HIER4B merged state;
3. inspect open PRs/worktrees;
4. preserve unrelated user modifications/worktrees;
5. create isolated branch/worktree;
6. inspect current main rather than trusting old HIER4B branch assumptions.

---

# QA state to record before doing new work

The documentation is stale and still describes earlier HIER4B graphical review as pending.

Update the development/validation state to reflect the user's actual QA result.

## Graphically approved / no longer pending

The user has now visually checked and accepted the current behavior for:

```text
nested Soft folder hierarchy
singleton-chain compression
folder promotion/flattening semantics
passive folder labels
empty File-module-boundary suppression
post-island redundant wrapper suppression
folder-area right-click behavior
composed File + containing-folder context menu
four-side File ports as a general interaction concept
```

Do not reopen these as undecided design questions unless this patch causes a regression.

## Still under evaluation

HIER4B/Soft still has unresolved work:

```text
1. Adaptive Compass × Soft Folder Clusters consistency   ← THIS PATCH
2. HIER4B-SPACING                                       ← later
3. Unified / Keep-folders-together region policy        ← later experiment
4. MODULAR-CONTEXT1                                     ← later interaction work
```

The user has explicitly said the current label/wrapper cleanup is fine.

The new patch should update the QA/status docs so they do not continue claiming those already-approved visual fixes are awaiting review.

However:

```text
do not claim Adaptive Compass compatibility is approved
until the user tests this patch.
```

---

# Current implementation evidence

On current main, Soft Clusters already does invoke the internal layout variant.

In:

```text
packages/focus-schematic-layout/src/soft-clusters.ts
```

the Soft pipeline currently approximately does:

```text
base HIER3/HIER4 candidate

→ initial radial Soft module positions
→ apply internal layout variant
→ Soft relaxation round 1
→ apply internal layout variant AGAIN
→ Soft relaxation round 2
→ final root anchoring
→ Soft cardinal File attachments
```

The selected default is already:

```text
adaptive-compass
```

unless overridden.

So the bug is **not simply “Adaptive Compass is never called.”**

It is called.

The issue is whether it is making the correct Soft-specific branch-placement decision and whether its two integration passes are producing coherent geometry.

---

# Important current Adaptive Compass behavior

The shared Adaptive Compass implementation currently derives branch demand mostly from counterpart module X position:

```text
counterpart left of File module
→ left demand

counterpart right of File module
→ right demand
```

Its branch candidate choices are approximately:

```text
left-only demand
→ LEFT or TOP/BOTTOM fallback

right-only demand
→ RIGHT or TOP/BOTTOM fallback

mixed left/right demand
or no unilateral horizontal demand
→ TOP or BOTTOM
```

`preferredY` is used mainly for ordering.

That was designed and validated for HIER4A's directional environment.

Soft Folder Clusters is different:

```text
no strict incoming-left / outgoing-right macro axis
modules may exist above, below, left, right, diagonal
File attachments use spatial cardinal geometry
```

Therefore investigate whether the shared HIER4A demand classifier is the reason Soft Adaptive Compass often collapses back into a vertical top/bottom arrangement.

Do not assume this is definitely the only cause.

Prove it.

---

# Core questions this patch must answer

## Q1

Is Adaptive Compass actually selecting:

```text
left
right
top
bottom
```

regions in Soft mode on cases where external connected modules occupy those directions?

Or are most Soft branches getting only:

```text
top / bottom
```

choices?

## Q2

Why does:

```text
Adaptive Compass ↔ Vertical Spine
```

sometimes change the **macro File layout** even when the visible Heading branch arrangement appears equivalent?

Determine whether the difference comes from:

```text
different top/bottom ordering
different internal branch Y offsets
different module width/height
different module reframing
different attachment geometry
different second-pass result
Soft collision/relaxation sensitivity
cache/config differences
or an actual bug
```

Do not guess.

Instrument it.

## Q3

Is the second Adaptive Compass application after Soft relaxation:

```text
necessary and beneficial
```

or is it causing:

```text
region churn
module-size churn
macro layout perturbation
```

without a meaningful Heading-placement improvement?

The current code already records:

```text
compassBranchRegionChurn
```

Use and extend this evidence if useful.

Do not remove the second pass casually.

## Q4

Should Soft Adaptive Compass use a dedicated **spatial-cardinal branch-demand policy** rather than HIER4A's directional left/right-oriented branch-demand policy?

This is the likely architectural solution if diagnosis confirms the mismatch.

---

# Desired product semantics

In:

```text
Directional Bands
```

preserve the accepted HIER4A behavior exactly.

In:

```text
Soft Folder Clusters
```

Adaptive Compass should respond to actual 2D external connection geometry.

Conceptually:

```text
external connection mostly left
→ branch should be eligible/prefer LEFT

mostly right
→ RIGHT

mostly above
→ TOP

mostly below
→ BOTTOM
```

This should be based on the final/current candidate macro geometry used by that Compass pass.

A branch with several external references should derive a stable aggregate spatial demand.

---

# Do not simply force every Heading into one cardinal side

Adaptive Compass should remain an optimizer.

The desired behavior is not:

```text
one target position
→ hard-code one branch side
```

Instead:

```text
spatial demand
→ generate a small bounded plausible candidate set
→ existing lexicographic quality scoring selects the best legal arrangement
```

Preserve:

```text
crossings first
ordering/inversions
internal hierarchy quality
span
compactness
determinism
```

or the current repository-equivalent ordering.

---

# Soft-specific branch demand

If diagnosis confirms the current HIER4A classifier is inappropriate, introduce a typed internal demand policy.

Conceptually:

```ts
type FocusSchematicCompassDemandPolicy =
  | 'directional-horizontal'
  | 'spatial-cardinal';
```

or equivalent.

Expected mapping:

```text
Directional Bands
→ directional-horizontal

Soft Folder Clusters
→ spatial-cardinal
```

Do not infer macro mode indirectly from arbitrary geometry if the caller can explicitly supply the policy.

Keep the shared Compass engine.

Do not fork the whole algorithm into two copies.

---

# Spatial-cardinal demand derivation

For each top-level Heading branch:

1. collect primary authored external connections involving any node in that branch;
2. resolve the counterpart endpoint/module rectangle in the current candidate;
3. compare counterpart center against the File/document center;
4. classify each connection into:
   ```text
   left / right / top / bottom
   ```
   using deterministic cardinal sectors;
5. aggregate the demand.

A simple sector rule is acceptable:

```text
dx = counterpartX - fileX
dy = counterpartY - fileY

if abs(dx) >= abs(dy):
    dx < 0 → LEFT
    else   → RIGHT
else:
    dy < 0 → TOP
    else   → BOTTOM
```

But do not automatically freeze this exact classifier without comparison if another equally simple robust method is already available.

---

# Multiple references in one branch

For a branch with several external references, compare at least two bounded demand summaries:

```text
S1 — dominant cardinal count
S2 — aggregate/median direction vector
```

Potentially:

```text
S3 — top-two cardinal demand counts
```

if useful.

The purpose is to avoid a branch with:

```text
3 targets above
1 slightly right
```

being incorrectly classified as RIGHT merely because of one horizontal connection.

Keep this bakeoff small.

---

# Candidate choices must remain bounded

Do not let a branch independently consider all four directions if that creates:

```text
4^N
```

assignment explosion.

Preserve a maximum of roughly:

```text
2 plausible choices per top-level branch
```

unless current bounded heuristic can safely support more.

For example, a spatial-cardinal policy might derive:

```text
primary cardinal region
+
best fallback region
```

The fallback can come from:

```text
second-strongest spatial demand
or
a balancing orthogonal region
```

based on the selected bakeoff strategy.

Maintain the existing Compass caps:

```text
complete assignment cap
local relocation sweep limit
large-module deterministic fallback
```

unless measurement proves a small change necessary.

---

# Critical Soft fixture set

Create synthetic fixtures specifically capable of exposing this bug.

## AC-S1 — four-cardinal fan

Root File with four top-level Heading branches:

```text
H-left
H-right
H-top
H-bottom
```

Each Heading has a primary reference to a File module placed predominantly in its corresponding cardinal direction.

Expected Adaptive Compass:

```text
at least one branch left
at least one branch right
at least one top
at least one bottom
```

if no higher-priority crossing constraint prevents it.

Vertical Spine expected:

```text
left = 0
right = 0
```

## AC-S2 — vertical demand

Two Heading branches connect primarily to modules above/below.

Adaptive should use:

```text
top / bottom
```

naturally.

No requirement to invent left/right merely to look “Compass-like.”

## AC-S3 — horizontal demand

Two branches target left/right external modules.

Expected Adaptive:

```text
lateral branch placement
```

Vertical Spine remains vertical.

## AC-S4 — mixed demand

A Heading branch has:

```text
2 targets above
1 target right
```

Compare demand-summary variants.

Expected selected policy should not be unstable under tiny coordinate perturbation.

## AC-S5 — neutral/no external demand

Heading has no primary cross-module external reference.

Expected deterministic fallback:

```text
top/bottom balancing
```

Do not invent arbitrary lateral placement.

## AC-S6 — real Compass reason to stay vertical

Construct case where lateral placement creates:

```text
1 exact crossing
```

while top/bottom gives:

```text
0 crossings
```

Adaptive should remain vertical because crossing quality is higher priority.

This proves:

```text
Adaptive Compass ≠ always use all four directions.
```

## AC-S7 — same geometry as Vertical Spine

Construct a case where Adaptive's selected geometry genuinely equals Vertical Spine.

Expected:

```text
branch regions identical
module bounds identical
node offsets identical
```

Then the Soft macro output should also remain geometry-identical.

This fixture directly addresses the user's second observation.

## AC-S8 — second-pass adaptation

First Soft macro geometry suggests one branch side.

After first relaxation, external modules move enough that another side becomes more appropriate.

Measure whether the second Compass pass:

```text
improves crossing/span/cardinal alignment
```

or only creates churn.

---

# Instrumentation / evidence

Add explicit development evidence for Soft × internal layout.

For each optimized module, record aggregate counts such as:

```text
top branches
bottom branches
left branches
right branches
```

At Soft attempt level record:

```text
modules with lateral branches
modules with only vertical branches
branches whose preferred cardinal demand matched final region
branches whose region changed between Compass pass 1 and 2
module bounds changed between pass 1 and 2
```

Do not expose this in product UI.

This is diagnostic evidence.

---

# Add a macro-perturbation diagnostic

For:

```text
Adaptive Compass
vs
Vertical Spine
```

on the same Soft input, measure:

```text
internal region assignment difference
internal node geometry difference
module-bound difference
macro File-center displacement
```

The important distinction is:

```text
internal geometry changed
→ macro difference may be legitimate

internal geometry identical
→ macro geometry should not mysteriously change
```

Add an oracle to catch the latter.

---

# Semantic no-op rule

If two internal-layout variants produce geometrically identical:

```text
module rectangles
internal node rectangles
```

before Soft relaxation, then the downstream Soft layout must receive identical geometric input.

Config/evidence strings may differ.

Actual positions should not differ because of:

```text
variant name
stats counters
cache-key text
```

alone.

If they currently do, fix the hidden non-geometric dependency.

---

# Beware second-pass module reframing

`applyFocusSchematicInternalLayoutVariant(...)` reframes module bounds after branch placement.

A visually “still vertical” Adaptive layout can nevertheless differ from Vertical Spine in:

```text
which branches are above/below
stacking order
internal gaps
module width
module height
```

This can legitimately change Soft collision packing.

Therefore do not label all macro movement as a bug.

The QA/report must distinguish:

```text
A. visible branch-region difference
B. subtle internal ordering/bounds difference
C. true no-op variant causing macro drift
```

---

# Suggested bakeoff

Compare:

```text
D0 — current Soft Adaptive Compass behavior
S1 — spatial dominant-cardinal demand
S2 — spatial aggregate-vector demand
```

Optional S3 only if S1/S2 are inconclusive.

Use:

```text
Vertical Spine
```

as the control, not as a candidate to adopt.

Metrics, lexicographically interpreted:

1. exact endpoint crossings;
2. module overlaps [hard zero];
3. adjacent-rank/order inversions;
4. internal hierarchy crossings;
5. branch/cardinal-demand mismatch;
6. primary reference span;
7. Compass region churn across Soft rounds;
8. macro File displacement caused by internal variant;
9. module area/compactness;
10. runtime/candidate counts;
11. deterministic tie-break.

Do not select based on “uses more directions” alone.

---

# Expected likely implementation

If evidence confirms the current branch-demand mismatch:

```text
Directional Adaptive Compass
→ keep current directional-horizontal demand policy

Soft Adaptive Compass
→ use spatial-cardinal demand policy
```

The Soft pipeline still applies Adaptive Compass at the current bounded refinement points unless evidence shows the second pass should be changed.

Do not change the HIER4A implementation path.

---

# Second-pass decision gate

After instrumentation:

## Keep both passes if:

```text
pass 2 materially improves crossing/span/cardinal match
with bounded churn
```

## Simplify/change pass 2 only if:

```text
it repeatedly changes module bounds/ordering
without improving quality
or creates unstable region churn
```

If changing the two-pass schedule is a major architectural choice with mixed evidence:

```text
STOP and report
```

rather than silently redesigning it.

The preferred scope of this patch is the demand-policy mismatch first.

---

# Product settings

Do not add another user-facing Compass setting unless needed for temporary Sandbox development comparison.

The desired product controls remain approximately:

```text
Internal layout:
Adaptive Compass
Vertical Spine
```

The Soft-specific demand policy should be an internal implementation detail once selected.

If a temporary dev-only toggle helps bakeoff, remove it from normal product UI before handoff.

---

# QA state documentation

Update:

```text
docs/ROADMAP.md
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md
```

or repository-current equivalents.

Record:

```text
Approved before PATCH1:
- nested hierarchy
- singleton compression
- passive labels
- File-only module-boundary hiding
- redundant region-wrapper suppression
- context menu behavior

PATCH1 under evaluation:
- Adaptive Compass compatibility with Soft Folder Clusters

Later:
- HIER4B-SPACING
- unified/keep-folder-together region policy
- MODULAR-CONTEXT1
```

Also correct stale language that still says the already-approved visual cleanup itself is awaiting QA.

Do not claim:

```text
HIER4B fully complete
```

until this patch receives graphical approval if current roadmap semantics use HIER4B as the whole Soft track.

Because Soft Folder Clusters is already merged to `main`, distinguish:

```text
merged implementation
vs
remaining graphical-quality patches
```

clearly.

---

# Preserve current accepted Soft behavior

Do not regress:

```text
nested displayed folder hierarchy
per-File promotion
folder flattening
sibling flattening
restore
singleton compression
H1 hierarchical attraction
post-island redundant wrapper suppression
passive labels
File-only module-boundary suppression
folder-area context menus
File + folder composed context menu
four-side File attachments
Direct/Electronic parity
secondary zero-layout
latest-result-wins
```

---

# Directional Bands hard isolation

This patch must not alter HIER4A Directional behavior.

Hard oracle:

```text
Directional Bands
+ Adaptive Compass
```

before/after PATCH1 must remain byte-identical in:

```text
candidate geometry
attachments
folder bands
quality
```

except permitted evidence/version metadata if unavoidable.

Prefer zero change even there.

---

# Cache / worker behavior

If the Soft-specific internal demand policy changes actual layout geometry:

```text
bump the Soft layout algorithm/config version as appropriate
```

Do not invalidate Directional caches unnecessarily.

The cache must distinguish old/new Soft algorithm versions after code update naturally through the repository's current versioning seam.

No new product persistence field should be required.

---

# Browser graphical QA

Use synthetic fixtures first, then actual application.

In:

```text
Modular Preview
→ Soft Folder Clusters
```

test:

```text
Adaptive Compass
vs
Vertical Spine
```

with Files containing several expanded Headings.

Expected visual question:

> Does Adaptive Compass now actually move Heading branches laterally when their external references are spatially left/right, while still using top/bottom when appropriate?

Also verify:

> If Adaptive remains visually equivalent to Vertical Spine on a case, does switching variants avoid unexplained macro File movement?

---

# Real-vault QA handoff

Build optimized desktop and ask the user to test at least:

```text
Associated Value.md
Language.md
```

and any File with multiple expanded Headings plus external references in several directions.

Suggested QA:

1. Modular Preview.
2. Soft Folder Clusters.
3. Adaptive Compass.
4. Expand multiple Headings.
5. Observe Heading branch positions.
6. Switch Vertical Spine.
7. Switch back Adaptive.
8. Check whether Adaptive meaningfully uses left/right/top/bottom when spatial demand exists.
9. Check whether File modules/macrolayout move only when internal geometry actually changes.
10. Reroot.
11. Repeat on another File.
12. Test strength 25/50/75 if needed to change surrounding spatial demand.

Ask:

```text
Does Adaptive Compass now behave meaningfully in Soft mode?

Do you see lateral Heading placement when references are lateral?

When Adaptive and Vertical genuinely look the same internally, does the surrounding Soft layout remain stable?
```

Do not merge this patch before user approval.

---

# HIER4B-SPACING remains later

Do not combine spacing with this patch.

The user has already identified:

```text
Files should use more available canvas
and feel less cramped.
```

That remains:

```text
HIER4B-SPACING
```

after Adaptive Compass compatibility is understood.

Reason:

```text
spacing changes would confound Compass diagnosis
```

---

# Unified / no-island mode remains later

The user currently prefers to do this after the Compass issue.

Record only:

```text
HIER4B-UNIFIED-REGIONS — later experiment

Compare current split-when-needed behavior
against a real layout policy that prioritizes keeping
displayed folder regions spatially unified.
```

Do not implement it here.

---

# Likely implementation areas

Inspect current main first.

Probable core files:

```text
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/internal-layout-variants.ts
packages/focus-schematic-layout/src/internal-layout-variants.test.ts
packages/focus-schematic-layout/src/soft-clusters.test.ts
tools/focus-schematic-bakeoff/*
docs/HIER4B_*
docs/ROADMAP.md
```

Do not mechanically create new files if current architecture already has appropriate homes.

---

# Suggested implementation sequence

## Phase 1 — QA-state reconciliation

1. branch from latest main;
2. update stale docs to record already-approved FIX4/POLISH1 QA;
3. mark Adaptive Compass × Soft as current unresolved patch;
4. keep spacing/unified/context work later.

## Phase 2 — reproduce

5. create AC-S1..AC-S8 fixtures;
6. instrument current D0 behavior;
7. prove whether Soft Adaptive choices collapse to top/bottom;
8. measure why macro geometry changes when variants appear visually similar.

## Phase 3 — demand-policy bakeoff

9. implement internal dev comparison S1/S2;
10. keep Directional on old demand policy;
11. compare crossings, region match, churn, spans, bounds, runtime;
12. select one Soft spatial-cardinal demand policy.

## Phase 4 — integration

13. wire selected Soft policy through the shared Compass engine;
14. preserve candidate caps;
15. preserve Soft cardinal File attachment policy;
16. verify/refine second Compass pass only if evidence requires;
17. update algorithm version/cache seam if necessary.

## Phase 5 — automated validation

18. AC-S1..AC-S8;
19. Directional byte-identical oracle;
20. Soft strength matrix;
21. nested folder regressions;
22. cardinal port regressions;
23. deterministic cold repeats;
24. worker/latest-result-wins;
25. performance benchmark.

## Phase 6 — browser QA

26. synthetic graphical fixtures;
27. real app;
28. compare Adaptive vs Vertical.

## Phase 7 — optimized desktop

29. full checks;
30. desktop check/build;
31. launch optimized executable;
32. report exact path;
33. ask user for graphical approval;
34. STOP.

No PR/merge before approval.

---

# Required automated tests

## T1 — Soft four-direction Compass

AC-S1 should prove:

```text
Adaptive:
left > 0
right > 0
top > 0
bottom > 0
```

when quality permits.

## T2 — Vertical control

Same fixture:

```text
Vertical Spine:
left = 0
right = 0
```

## T3 — Directional unchanged

Directional Bands output before/after patch:

```text
byte-identical geometry
```

## T4 — true vertical case

Adaptive remains vertical when spatial demand is actually vertical.

## T5 — crossing guard

Adaptive does not choose a lateral region merely to satisfy cardinal direction if it introduces a higher-priority crossing.

## T6 — demand stability

Tiny coordinate perturbation does not cause unreasonable branch-side oscillation.

## T7 — second-pass churn

Record pass1/pass2 branch region change count.

Assert deterministic bound.

## T8 — semantic no-op

If Adaptive and Vertical internal rectangles are identical:

```text
Soft final module centers are identical
```

within strict deterministic numeric representation / repository-standard tolerance.

## T9 — meaningful internal difference

If Adaptive chooses lateral branches:

```text
module bounds/internal nodes differ
```

and macro movement is allowed.

This distinguishes legitimate from unexplained movement.

## T10 — cardinal attachments

Four-side Soft File endpoint behavior remains correct after new Heading regions.

## T11 — Heading disclosure

Expand/collapse:

```text
Adaptive recomputes deterministically
no stale branch regions
```

## T12 — reroot

Reroot to a connected File:

```text
Soft macro geometry
Adaptive branch demand
attachments
```

all update deterministically.

## T13 — strength matrix

Run at:

```text
0
25
50
75
100
```

Adaptive Compass must remain functional independent of folder strength.

Strength may alter macro geometry and therefore spatial branch demand.

That is expected.

## T14 — cache correctness

Same input/policy:

```text
cache hit / deterministic result
```

Different internal variant:

```text
distinct cache identity if geometry differs
```

No cache collision.

---

# Performance

Keep the existing bounded Compass constraints.

Report:

```text
Compass assignments
placement candidates
pass1/pass2 region churn
layout runtime
Soft collision checks/corrections
```

No new hard CI timing threshold unless a clear regression appears.

No new external dependency.

---

# Privacy

Real-vault QA must remain aggregate/private.

Do not commit:

```text
real note titles
real folder names
screenshots
absolute private vault paths
```

Use synthetic equivalents in tests.

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

If current script names differ, use repository-current equivalents.

---

# Hard exit gates

PATCH1 is ready for user QA only when:

1. branch starts from current merged main;
2. stale HIER4B QA docs are corrected;
3. previously approved FIX4/POLISH1 items are recorded as approved;
4. Adaptive Compass × Soft is recorded as pending this patch;
5. AC-S1..AC-S8 exist;
6. current D0 behavior is measured rather than guessed;
7. root cause is documented;
8. Directional Compass behavior is unchanged;
9. Soft uses an evidence-backed spatial-cardinal demand policy if diagnosis supports it;
10. shared Compass engine remains shared;
11. no full algorithm fork;
12. candidate growth remains bounded;
13. exact crossings remain highest-priority readability guard;
14. Soft Adaptive can use lateral regions when spatial demand supports them;
15. Soft Adaptive can remain vertical when that is actually better;
16. no forced “use all four directions” gimmick;
17. pass1/pass2 churn is measured;
18. second-pass behavior is retained or changed based on evidence;
19. no-op internal geometry does not cause mysterious macro drift;
20. legitimate internal geometry differences may still change macro layout;
21. four-side File attachments remain correct;
22. Heading/Block exact semantics remain correct;
23. disclosure works;
24. reroot works;
25. strength 0/25/50/75/100 works;
26. deterministic cold repeats pass;
27. cache identity remains correct;
28. latest-result-wins passes;
29. nested Soft folder behavior does not regress;
30. passive labels do not regress;
31. redundant-wrapper suppression does not regress;
32. Directional byte-identical oracle passes;
33. no spacing redesign;
34. no unified/no-island implementation;
35. no MODULAR-CONTEXT1 implementation;
36. no HIER5 work;
37. no HIER3C work;
38. no new dependency;
39. full `pnpm check` passes;
40. desktop check/build passes;
41. optimized executable launches;
42. prompt archived with SHA-256;
43. exact executable path reported;
44. user QA requested;
45. no PR/merge before user approval;
46. stop.

---

# Prompt archive

Archive this exact prompt in:

```text
history-implementations/HIER4B_PATCH1_soft_adaptive_compass_consistency_codex_prompt.md
```

Record SHA-256.

---

# Final report format

## Branch / commit

## QA state update

State which previously pending HIER4B items were marked graphically approved.

## Root cause

Explain precisely why Soft Adaptive Compass looked vertical and/or why macro geometry changed.

## Demand-policy bakeoff

D0 vs S1 vs S2, selected policy and evidence.

## Adaptive Compass behavior

Region counts and representative synthetic results.

## Second-pass behavior

Retained/changed and why.

## Semantic no-op

Evidence that identical internal geometry does not create unexplained macro movement.

## Directional isolation

Byte-identical evidence.

## Regressions

Nested folders, ports, disclosure, reroot, strengths.

## Performance

## Tests

## Privacy

## Optimized desktop path

## User QA

Ask the user to compare Adaptive Compass vs Vertical Spine in Soft mode.

## Later

```text
HIER4B-SPACING
HIER4B-UNIFIED-REGIONS
MODULAR-CONTEXT1
```

Then stop.

No PR or merge before approval.
