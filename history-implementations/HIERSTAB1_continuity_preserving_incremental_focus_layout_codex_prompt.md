# HIERSTAB1 — Continuity-Preserving Incremental Focus Hierarchy Layout

**Task type:** structural layout architecture / incremental-layout feature / continuity and stability hardening

## Goal

PR #127 has merged. Start a **new branch / new PR from current `main`**.

The current Modular Focus Hierarchy layout is deterministic for a fresh input, but it is still effectively a **cold solve** after many small disclosure changes.

That produces poor visual continuity.

The motivating failure is:

```text
Focus File
├─ H1
├─ H2
├─ H3
└─ H4   ← unconnected Heading

hide H4
```

Today, removing H4 can trigger:

```text
projection changes
→ module dimensions change
→ new exact layout input/cache identity
→ Adaptive Compass searches again
→ Soft macro relaxation / cohesion / nested packing / group packing run again
→ multiple equally-valid discrete decisions change
→ Files can flip above/below/around Focus
```

The resulting graph may satisfy every hard layout constraint while still being visually bad because almost the entire previous layout was already valid and should have been retained.

Implement **continuity-preserving incremental layout** for eligible Focus Hierarchy transitions.

Core principle:

> Reuse the previous validated layout as an explicit transition prior. Keep everything that is still valid. Recompute only what changed, perform bounded local repair only if hard constraints require movement, and fall back to the existing deterministic cold solver when the incremental path cannot prove a valid result.

Hard motivating regression:

```text
Hide an unconnected Heading subtree
→ unaffected File-module centers do not move at all
→ surviving Adaptive Compass branch regions/orders do not change
→ only the affected File's internal geometry/module bounds change
```

This should be a structural architecture feature, not animation that visually hides a global relayout.

---

# Repository state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

PR #127 has merged.

Observed merge commit at prompt-writing time:

```text
fe3421ab1d0466c2532dcc308bddee604d7e9d8f
Merge pull request #127 from lillo24/codex/focus-outline-heading-visibility
```

Recent merged HIERDISC work includes:

```text
057ba8a20bfbbb49a08b132f04c1c419ef411ca6
feat(web): add local Focus Explorer heading collapse

a7d25a00d722453314c7158eeef1e8f06a6c34eb
fix(focus): apply hierarchy depth to all files

804e0411e4c7f93c1d66e06c6fceb28d3e67f49
fix(layout): preserve nested soft geometry after heading hide
```

Before editing:

1. read current `AGENTS.md`;
2. fetch latest `main`;
3. verify PR #127 is merged;
4. inspect commits after `fe3421ab...`;
5. create an isolated branch/worktree from latest `main`;
6. preserve unrelated work/worktrees;
7. create a new PR;
8. record exact starting SHAs.

Suggested branch:

```text
codex/hierstab1-incremental-focus-layout
```

Exact name is flexible.

---

# Current architecture evidence

## Current structural input is cold/current-state only

`FocusSchematicLayoutInput` currently contains:

```ts
model
projection
nodeDimensions
settings
```

It contains no previous validated geometry / transition prior.

The layout package therefore has no principled way to distinguish:

```text
first load of state B
```

from:

```text
tiny transition A → B where 95% of A remains valid
```

---

# Current worker protocol

At the merged baseline:

```text
FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION = 14
```

Worker request is approximately:

```ts
{
  protocolVersion
  requestId
  kind: 'layout'
  input
  policies
}
```

There is no transition prior.

---

# Current exact cache

`apps/web/src/focus-schematic-layout-cache.ts` owns an exact layout cache keyed from:

```text
protocol
algorithm/version
current input
current product policies
```

Preserve the important meaning:

> Exact cache = a result for the current state independent of navigation history.

Do not silently make the existing exact cache path-dependent.

---

# Current Soft baseline

At merged main, inspect exact constants first.

Expected approximately:

```text
Soft structural algorithm/cache v13
worker protocol v14
Soft evidence schema v9
```

Current Soft pipeline contains:

```text
internal layout / Adaptive Compass
Soft relaxation
immediate-folder cohesion
Nested hierarchy packing
group packing
strict hard validation
```

FIX4–FIX6 intentionally made several folder constraints hard.

Do not weaken them for continuity.

---

# Product priority change

For an incremental transition:

```text
hard validity
>
continuity with previous validated layout
>
fresh global optimality
```

Meaning:

If the old positions and branch assignments remain valid after applying the local semantic change:

```text
KEEP THEM
```

Do not move the graph merely because a cold solve can produce:

```text
slightly shorter lines
slightly smaller area
another equivalent Compass assignment
```

Continuity is now a first-class layout objective.

---

# Scope

## Production target in HIERSTAB1

Primary target:

```text
Focus + Hierarchy + Modular Preview
```

especially:

```text
Adaptive Compass
Soft Folder Clusters
Heading Hide/Restore
Heading Collapse/Expand
uniform Focus depth disclosure changes
Blocks visibility changes
```

The architecture should be generic enough for Directional Bands to use safe internal continuity where feasible, but do not turn this task into a complete incremental rewrite of every layout family.

---

# Non-scope

Do not redesign:

```text
Focus Explorer UI
Files | Headings controls
Heading/Block subfocus
folder semantics
Adaptive Compass visual concept
Soft folder policies
Directional Bands product semantics
graph history
Current View/Saved Views
source parsing/projection semantics
Network layouts
```

Do not persist layout coordinates to vault or Saved Views.

Do not add user-facing "stability strength" sliders.

---

# PART A — Introduce an explicit ephemeral transition prior

Add a strict clone-safe type conceptually like:

```ts
interface FocusSchematicLayoutTransitionPrior {
  readonly schemaVersion: 1;
  readonly rootModuleId: EntityId;
  readonly previousPoliciesFingerprint: string;
  readonly modules: readonly {
    readonly moduleId: EntityId;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly nodes: readonly {
    readonly projectionNodeId: ProjectionNodeId;
    readonly moduleId: EntityId;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
}
```

Exact representation is Codex's choice.

Only include what the worker genuinely needs.

Prefer deriving prior branch-region/order information from validated prior geometry + current/previous structural models rather than serializing redundant renderer-specific objects.

Hard requirements:

```text
plain serializable data
no React objects
no DOM
no renderer handles
no workspace handles
bounded size proportional to visible Focus graph
```

---

# Transition prior boundary

The prior is:

```text
ephemeral
session-only
navigation-transition input
```

It is NOT:

```text
canonical graph truth
Current View persistence
Saved View data
workspace persistence
source state
```

Reload may cold-solve.

That is acceptable.

---

# Worker protocol

If the prior crosses the worker boundary, evolve the strict worker protocol explicitly.

Preferred request shape:

```ts
{
  protocolVersion: 15,
  requestId,
  kind: 'layout',
  input,
  policies,
  transitionPrior?: ...
}
```

Inspect actual current version and bump only as required.

Strict validation must reject malformed/nonfinite priors.

---

# PART B — Preserve exact cache purity

This is critical.

A prior-conditioned layout can depend on the path:

```text
A → B
```

and another equally valid layout for B could result from:

```text
C → B
```

Therefore:

```text
do NOT write prior-conditioned transition results
into the existing exact current-input cache
```

under the ordinary B key.

Otherwise the exact cache becomes history-dependent.

---

# Required cache flow

Preferred:

```text
new current input
↓
check existing exact cold/current-input cache

if HIT:
  adopt exact cached result
  (useful for undo/redo and returning to known states)

if MISS and eligible prior exists:
  run incremental transition solve
  adopt valid incremental result
  DO NOT populate ordinary exact cache

if incremental rejects/fails:
  run normal deterministic cold solver
  validate
  write cold result to exact cache
  adopt
```

A tiny separate transition cache keyed by:

```text
current exact key + prior geometry fingerprint
```

is optional but not required.

Prefer no new cache in HIERSTAB1 unless measurement demonstrates value.

---

# Undo/redo advantage

This design means:

```text
State A already had an exact/cached layout
A → B incremental
Ctrl+Z → A
```

can restore the exact prior A geometry through the current cache/history lifecycle.

Do not destroy that behavior.

---

# PART C — Eligibility classifier

Do not apply prior continuity blindly to unrelated layouts.

Create a deterministic transition classifier.

At minimum distinguish:

```text
cold-required
local-internal-change
local-topology-change   (future / fallback initially)
```

HIERSTAB1 production incremental support may be limited to:

```text
local-internal-change
```

provided the classifier is truthful.

---

# Local-internal-change eligibility

A strong initial eligibility rule:

```text
same Focus root File
same macro layout family
same internal layout variant
same endpoint order policy
same folder policy/settings
same visible File-module identity set
same folder display/grouping tree
same inter-File primary relationship topology
change limited to Heading/Block projection and node/module dimensions
```

Reference endpoint ownership may roll up from hidden precise Heading/Block to a visible ancestor while the underlying inter-File relationship remains the same.

Handle that intentionally.

---

# Cold-required examples

Use the ordinary cold path for at least:

```text
File reroot
File-module set changes
Focus hops/direction changes that add/remove Files
macro mode switch Soft ↔ Directional
Adaptive ↔ Vertical switch
folder scope policy change
folder strength change
ancestor decay change
manual folder display-intent change
workspace/source replacement
```

HIERSTAB1 may broaden eligibility later, but not at the expense of correctness.

---

# Transition classifier evidence

Report why a transition was:

```text
incremental-eligible
or
cold-required
```

in development evidence/tests.

Do not expose noisy technical UI.

---

# PART D — Fast path: validate "keep old macro positions"

For an eligible local-internal transition:

1. map surviving modules/entities by stable canonical IDs;
2. rebuild only the changed internal File-module geometry required by the new projection;
3. preserve previous centers for every surviving File module;
4. preserve the Focus File center exactly;
5. preserve unchanged module internal geometry exactly;
6. preserve surviving branch placements/order in affected modules where possible;
7. regenerate required endpoint attachments/routes/quality;
8. run ALL current hard validation.

If valid:

```text
ADOPT IMMEDIATELY
```

No Soft macro relaxation.

No folder re-pack.

No global Compass reselection.

---

# Motivating hard regression: unconnected H4 hide

Synthetic:

```text
Focus File
├─ H1   connected
├─ H2   connected
├─ H3   no external ref
└─ H4   no external ref ← hide this
```

with multiple surrounding File modules and Soft Nested folders.

After Hide H4:

```text
unaffected File module centers:
  EXACTLY unchanged

unaffected module rectangles:
  EXACTLY unchanged

unaffected internal node rectangles:
  EXACTLY unchanged

surviving top-level branch region assignments in Focus:
  unchanged

surviving branch order:
  unchanged

Focus File center:
  unchanged

H4:
  absent

Focus module bounds:
  recomputed only as necessary around surviving content

folder hard gates:
  pass

crossings:
  pass

no macro relaxation
```

This is a hard product regression, not merely a metric.

---

# PART E — Incremental internal-module layout

The affected File may need its module geometry recomputed.

Do not rerun a fresh unrestricted Adaptive Compass search if the surviving prior arrangement remains valid.

---

# Preserve surviving branch regions

For each surviving top-level Heading branch in the affected File:

```text
prior TOP / BOTTOM / LEFT / RIGHT region
```

should remain fixed when:

```text
the branch still exists
the placement remains collision-free internally
hard endpoint/layout constraints remain satisfied
```

Removed branches disappear.

Unchanged branches stay.

---

# New branches on expansion

If a new Heading branch appears:

1. freeze all surviving prior branches;
2. evaluate sensible candidate regions only for the new branch;
3. choose the best valid position under existing Adaptive Compass hard metrics;
4. preserve old branch region/order as much as possible.

Only if no valid arrangement exists with survivors frozen may the solver unlock the minimum necessary existing branches.

---

# Branch continuity objective

If a search is necessary, continuity should be lexicographically important.

Conceptually:

```text
hard validity
exact endpoint crossing quality
minimum changed surviving branch regions
minimum surviving branch order movement
minimum internal-node displacement
then ordinary span/area/source-order tie breakers
```

Do not let a tiny area/span improvement flip five established branches.

---

# Document order option

Preserve the current:

```text
Crossing optimized
Document order
```

semantics.

Continuity must not violate an explicitly selected Document-order requirement.

---

# PART F — Macro continuity: freeze all module centers first

After affected internal geometry is updated, use the prior File-module centers as the initial/desired final macro geometry.

Run current hard validators:

```text
module overlap
Focus anchor
immediate folder unity
Nested containment/splits/blockers
group packing/radial safety as relevant
endpoint/lane constraints
```

If all pass:

```text
0 macro movement
```

This is the most important behavior change.

---

# Shrink should usually move nobody

Hiding/collapsing content usually shrinks a module.

If preserving existing centers still satisfies hard constraints:

```text
do not move other modules
```

Even if:

```text
line lengths could be shorter
folder area could be smaller
canvas could compact
```

Continuity wins.

---

# PART G — Bounded local repair

If the previous centers are no longer hard-valid, do not immediately run the global cold solver.

Run bounded local repair.

---

# Initial repair frontier

Start with:

```text
affected File module(s)
+
direct collision partners
+
folder/group units whose hard invariant is violated
```

Examples:

```text
grown module overlaps neighbor
shrunk module creates immediate-folder split
nested folder hull now splits
nested hull swallows an external blocker
```

---

# Preserve compound-body ownership

Respect current Soft semantics.

If repair must move a rigid current unit:

```text
immediate folder body
Nested subtree
top-level Nested subtree
Focus-neutral anchor
```

move the correct compound unit rather than tearing folder semantics apart.

Do not undo FIX4–FIX6.

---

# Local repair objective

Hard:

```text
all existing validators pass
```

Then minimize:

```text
1. number of previously-unaffected modules moved
2. maximum displacement of previously-unaffected modules
3. total displacement
4. surviving branch changes
5. existing quality metrics
```

This formalizes:

> move the fewest things by the smallest amount.

---

# Repair frontier expansion

If the initial frontier cannot find a valid state:

```text
expand deterministically
```

for example:

```text
collision neighbors
→ immediate folder body / relevant nested subtree
→ neighboring compound bodies
```

Use a strict bounded expansion/candidate cap.

No unbounded force simulation.

No randomness.

---

# Fallback

If bounded local repair cannot prove a valid candidate:

```text
run existing cold deterministic solver
```

Do not weaken hard constraints.

Do not preserve a bad prior just for continuity.

---

# PART H — Do not use continuity as animation

The actual adopted layout must be stable.

Do not solve this by:

```text
cold global relayout
+
slow animation from old positions to new ones
```

That would preserve motion smoothness but not spatial memory.

The output coordinates themselves should retain unaffected geometry.

Existing visual transition behavior may remain after the structural result is chosen.

---

# PART I — Cold solver remains canonical fallback

The existing cold layout engine remains available and deterministic.

Do not delete:

```text
Adaptive Compass exhaustive/bounded search
Soft relaxation
folder cohesion
Nested packing
group packing
Directional path
strict validation
```

HIERSTAB1 adds a transition-aware path before them.

---

# Cold-equivalence oracle

For transitions that fall back:

```text
incremental fallback result
```

must equal or satisfy the same exact hard validation as:

```text
normal current cold solve
```

Prefer invoking the same cold implementation rather than duplicating it.

---

# PART J — Worker/API architecture

Prefer one clean API rather than threading prior-state conditionals through UI code.

Conceptually:

```ts
computeFocusSchematicComputedLayout({
  input,
  policies,
  transitionPrior?,
})
```

or an explicit transition entry point sharing the cold core.

Do not make React own layout repair.

The layout package should own:

```text
eligibility
prior reconciliation
continuity fast path
local repair
cold fallback
evidence
```

---

# PART K — Web lifecycle

`ModularStructuredGraphView` already owns:

```text
last-valid retention
latest-result-wins worker
exact cache
failure/retry
```

Extend it carefully.

When a new eligible input appears and no exact cache hit exists:

```text
capture the currently ADOPTED validated computed layout
→ canonicalize transition prior
→ send with request
```

Do not use:

```text
decorative interpolated positions
pending partial graph
new semantic tree mixed with old geometry
```

Use only the last validated adopted computed layout.

---

# Latest-result-wins

Rapid:

```text
Hide
Restore
Hide
```

must still adopt only the latest request.

A stale transition result must never overwrite a newer state.

Preserve FIX6 generation safety.

---

# PART L — Exact cache vs transition result

Add explicit tests:

```text
incremental result is NOT written into ordinary exact cache

cold result IS written

existing exact cache hit skips transition worker path

undo to prior cached input restores exact prior result
```

This is a hard architectural gate.

---

# PART M — Transition-prior validation/reconciliation

The current input may differ from the prior.

Reconcile by stable IDs.

Ignore/remove:

```text
prior nodes no longer present
prior branches no longer present
prior modules no longer present
```

but local-internal eligibility should already require the module set to remain stable.

Malformed/nonfinite/out-of-policy priors:

```text
reject prior
→ cold solve
```

Do not fail the whole layout merely because an optional prior is unusable.

---

# PART N — Root anchoring

Focus File remains the spatial anchor.

For all incremental paths:

```text
Focus document center = exact prior Focus center
```

Normally current coordinates are normalized so that Focus remains at the established root origin.

Do not let a module shrink change the root anchor.

---

# PART O — Soft folder constraints

Continuity does NOT lower the priority of current hard folder semantics.

Preserve:

```text
Focus excluded from folder grouping
immediate named-folder unity
Nested logical containment
one retained Nested region
no blocker swallowing
root-level folderless semantics
workspace-root option behavior
continuous Soft spacing safety
```

---

# Shrink-induced folder split case

Important edge case:

```text
same module centers
module shrinks
→ rectangle-to-rectangle gap increases
→ folder guide could split
```

If this occurs:

```text
fast path fails validation
→ local folder-aware repair
```

Do not globally relayout.

Test it.

---

# Blocker case

If a resized module makes a folder hull swallow an unrelated blocker:

```text
move minimum relevant folder/subtree/body
```

while freezing distant bodies.

---

# PART P — Directional Bands

Do not regress Directional Bands.

At minimum:

```text
current cold Directional output remains byte-stable for first load/cold-required transitions
```

If generic internal-module continuity can safely preserve Adaptive/Vertical branch positions before Directional band composition, use it only with explicit tests.

It is acceptable for HIERSTAB1 macro incremental repair to be Soft-only initially.

Document scope honestly.

---

# PART Q — Transition evidence

Add explicit development evidence.

Suggested:

```ts
type FocusSchematicTransitionMode =
  | 'cold'
  | 'exact-cache'
  | 'incremental-no-macro-move'
  | 'incremental-local-repair'
  | 'cold-fallback';
```

Evidence should include approximately:

```text
mode
eligible
rejectionReason?
priorModuleCount
survivingModuleCount
affectedModuleCount
unchangedModuleCount
movedUnaffectedModuleCount
meanUnaffectedModuleDisplacement
p95UnaffectedModuleDisplacement
maxUnaffectedModuleDisplacement
changedSurvivingCompassBranchCount
localRepairFrontierModuleCount
localRepairIterations/candidates
coldFallbackUsed
```

Do not expose this as normal product UI.

---

# Privacy

No real-vault names/paths/content in committed evidence.

Use synthetic fixtures.

---

# PART R — Core continuity metrics

Add pure helpers for comparing prior/final geometry.

For stable module IDs measure center displacement.

For surviving node IDs measure rectangle displacement.

For Adaptive Compass measure surviving branch-region changes.

Hard motivating expectation:

```text
unconnected H4 hide:
movedUnaffectedModuleCount = 0
maxUnaffectedModuleDisplacement = 0
changedSurvivingCompassBranchCount = 0
```

Use exact or tight EPSILON comparisons as appropriate.

---

# PART S — Required regression matrix

## ST1 — unconnected Heading hide

Hard case described above.

Expected:

```text
0 unaffected macro movement
0 surviving Compass changes
```

## ST2 — unconnected nested Heading hide

Hide a nested H3/H4 subtree.

Same expectation if hard-valid.

## ST3 — connected Heading hide / reference roll-up

Hide Heading with exact outgoing reference.

Expected:

```text
affected module internal geometry/routes update
opposite module center unchanged
all unrelated module centers unchanged
```

provided hard-valid.

## ST4 — Block disclosure hide

Same local behavior.

## ST5 — restore to exact cached prior state

```text
A → B → A
```

A returns byte/exact geometry from cache.

## ST6 — new expansion with no collision

Add a new Heading branch.

Surviving branches keep regions/orders.

Other File centers unchanged.

## ST7 — growth causing one collision

New/grown branch expands module into neighbor.

Expected:

```text
bounded local repair
minimum frontier
distant modules exact
```

## ST8 — shrink creates folder split

Expected local folder repair only.

## ST9 — blocker violation

Expected local relevant subtree/body repair.

## ST10 — local repair impossible

Force a fixture where bounded repair cannot succeed.

Expected:

```text
cold-fallback
all hard gates pass
```

## ST11 — reroot

Cold-required.

No transition prior continuity path.

## ST12 — macro policy change

Cold-required.

## ST13 — module-set topology change

Cold-required in HIERSTAB1 unless explicitly implemented/tested.

## ST14 — rapid Hide/Restore/Hide

Latest result wins.

## ST15 — secondary edges

Still zero geometry influence.

## ST16 — Direct vs Nested Soft

Both hard folder semantics remain valid.

## ST17 — strength / decay policy

Transitions changing these settings are cold-required.

## ST18 — Soft spacing slider

Presentation-only behavior remains as currently designed; do not route it through structural transition solve.

---

# PART T — 32-File / many-Heading stability fixture

Reuse or extend the merged HIERDISC deterministic fixture:

```text
32 Files
96 Headings
```

Apply a sequence of local disclosure mutations.

Measure:

```text
how many modules moved
how far
worker compute time
fallback frequency
```

Expected local hide mutations:

```text
movement concentrated in changed modules / local repair frontier
not global graph churn
```

No CI wall-clock gate unless current repo policy already uses one.

Record evidence.

---

# PART U — "almost nothing moves" graphical lab

Create a deterministic development visual comparator for several transitions:

```text
Before
After cold solve
After incremental solve
```

Draw movement vectors for File-module centers.

At minimum scenarios:

```text
unconnected H4 hide
connected Heading hide
growth collision
folder split repair
```

This is development evidence only.

Do not add a permanent product panel.

---

# PART V — Candidate validity first

Incremental candidate must pass the exact current validators.

Do not define a second weaker "incremental-valid" standard.

Reuse:

```text
computed layout validation
Soft nested hierarchy validation
folder coverage
module collision gates
endpoint/lane gates
secondary-invariance gates
```

---

# PART W — Current UI behavior

No new user-facing controls are needed.

Preserve:

```text
Files only / 1 / 2 / 3 levels / Custom
All Files
Focus Explorer
Heading Hide/Restore
Collapse/Expand
Ctrl+Z history
Heading subfocus
```

HIERSTAB1 should make those interactions spatially stable automatically.

---

# PART X — Failure behavior

If incremental computation fails unexpectedly:

```text
try existing cold solver
```

If cold solver succeeds:

```text
adopt cold result
```

If both fail:

```text
preserve last-valid presentation
show explicit warning / current fallback behavior
```

No blank graph.

---

# PART Y — Versioning

This changes worker/request semantics and Soft transition behavior.

Inspect current versions before editing.

Expected baseline:

```text
Soft algorithm/cache v13
worker protocol v14
Soft evidence schema v9
```

Likely:

```text
worker protocol bump required
```

because of optional transition prior.

A Soft structural algorithm bump may also be appropriate if transition-aware geometry is considered part of the algorithm contract.

However:

```text
existing cold exact-cache identity must remain deterministic
```

Do not invalidate Directional merely because transition protocol changed unless the strict shared protocol requires it.

Explain every version/cache change.

---

# PART Z — Documentation

Update:

```text
docs/ARCHITECTURE.md
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/HIER4B_VALIDATION.md or a new HIERSTAB1 validation doc
apps/web/src/components/README.md
packages/focus-schematic-layout/README.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Document:

```text
cold layout vs transition layout
exact cache purity
transition-prior boundary
eligible transition class
local repair
cold fallback
continuity priority
no coordinate persistence
```

---

# Likely files / areas

Inspect actual latest main first.

Probable:

```text
packages/focus-schematic-layout/src/types.ts
packages/focus-schematic-layout/src/input.ts
packages/focus-schematic-layout/src/worker-protocol.ts
packages/focus-schematic-layout/src/worker-runtime.ts

packages/focus-schematic-layout/src/internal-layout-variants.ts
packages/focus-schematic-layout/src/endpoint-facing.ts
packages/focus-schematic-layout/src/soft-clusters.ts
packages/focus-schematic-layout/src/soft-folder-cohesion.ts
packages/focus-schematic-layout/src/soft-nested-hierarchy-packing.ts
packages/focus-schematic-layout/src/soft-group-packing.ts

likely new:
packages/focus-schematic-layout/src/transition-prior.ts
packages/focus-schematic-layout/src/incremental-layout.ts
packages/focus-schematic-layout/src/incremental-layout.test.ts
packages/focus-schematic-layout/src/layout-continuity.ts

apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/workers/focus-schematic-layout-worker-client.ts
apps/web/src/focus-schematic-layout-cache.ts

tools/focus-schematic-bakeoff/*
tools/vault-diagnostics/*
history-implementations/
```

Do not force this exact file split.

---

# Implementation order recommendation

1. Establish cold baseline and continuity metrics.
2. Add transition-prior type/validation.
3. Add deterministic eligibility classifier.
4. Add exact-cache purity tests.
5. Implement prior reconciliation.
6. Implement internal-module continuity for surviving Adaptive branches.
7. Implement "keep macro centers" fast path.
8. Validate all hard gates.
9. Implement bounded local repair.
10. Add cold fallback.
11. Wire optional prior through worker/client.
12. Wire `ModularStructuredGraphView` from last adopted validated computed layout.
13. Add latest-result-wins/race tests.
14. Add continuity benchmark/visual evidence.
15. Native QA build.
16. Stop before merge.

Codex may adjust sequencing after inspection.

---

# Validation

Follow current `AGENTS.md`.

Expected current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/focus-schematic
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/workers

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Run narrow transition tests throughout development.

---

# Native graphical QA artifact

Build:

```text
hierstab1-incremental-focus-layout-native-candidate.exe
```

Report SHA-256.

Open the candidate.

Do not merge.

---

# Founder native QA

Ask founder to test real-vault cases where the graph previously jumped dramatically.

Primary:

```text
1. Focus a File with several Headings.
2. Record rough File positions.
3. Hide an unconnected Heading.
4. Confirm essentially nothing outside that File moves.
5. Restore it.
6. Confirm prior spatial arrangement returns.
```

Then:

```text
7. Hide a Heading with a real external reference.
8. Expand/collapse a nested Heading.
9. Switch Files only ↔ 1 level / Custom.
10. Try a change that grows a File near another File.
11. Observe whether only the local neighborhood repairs.
12. Smoke-test Nested Soft folders.
13. Smoke-test File reroot (should cold-solve safely).
14. Ctrl+Z / Forward through disclosure changes.
```

Expected:

```text
small semantic edit
→ small spatial edit
```

not:

```text
small semantic edit
→ global reshuffle
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIERSTAB1_continuity_preserving_incremental_focus_layout_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before founder QA

1. new branch/PR from merged latest main;
2. PR #127 remains merged/untouched;
3. transition-prior contract exists;
4. prior is clone-safe and strictly validated;
5. prior is ephemeral and nonpersistent;
6. exact cache remains current-input/cold semantic cache;
7. prior-conditioned incremental results do NOT pollute ordinary exact cache;
8. exact cache hit takes precedence over incremental solve;
9. eligibility classifier exists;
10. reroot is cold-required;
11. macro policy changes are cold-required;
12. module-set changes are cold-required unless explicitly supported/tested;
13. unconnected H4 Hide yields zero unaffected module displacement;
14. unconnected H4 Hide yields zero surviving Compass region changes;
15. unaffected internal node geometry remains exact;
16. Focus center remains exact;
17. removed subtree disappears correctly;
18. connected Heading Hide preserves unrelated module centers when valid;
19. reference roll-up remains correct;
20. new branch expansion preserves surviving branch regions when valid;
21. no-collision growth moves no unrelated modules;
22. local collision repair moves bounded minimal frontier;
23. shrink-induced folder split uses local folder-aware repair;
24. blocker violation uses local relevant repair;
25. distant unaffected modules remain exact during local repair;
26. incremental candidates use existing hard validators;
27. immediate-folder unity preserved;
28. Nested containment preserved;
29. Nested split count zero;
30. blocker count zero;
31. module overlap zero;
32. root-neutral folder semantics preserved;
33. continuous Soft spacing safety preserved;
34. local repair is bounded/deterministic;
35. impossible local repair cold-falls back;
36. cold fallback uses existing deterministic solver;
37. rapid requests remain latest-result-wins;
38. stale prior result cannot adopt;
39. undo to exact cached state restores prior geometry;
40. secondary geometry influence remains zero;
41. Directional cold output unchanged;
42. Soft cold baseline remains deterministic;
43. transition evidence reports movement/fallback;
44. 32-File/96-Heading sequence shows local rather than global movement;
45. no new user-facing layout stability control;
46. no coordinate persistence;
47. no blank graph on failure;
48. protocol/version changes documented;
49. focused tests pass;
50. benchmark hard gates pass;
51. full `pnpm check` passes;
52. desktop check/build passes;
53. `git diff --check` passes;
54. docs updated;
55. prompt archived + SHA-256;
56. optimized EXE + SHA-256;
57. new PR CI green;
58. PR remains unmerged;
59. stop.

---

# Final report

## Branch / PR / commits

## Starting main

Confirm PR #127 merge baseline.

## Architecture

Explain:

```text
cold solve
exact cache
transition prior
eligibility classifier
incremental fast path
local repair
cold fallback
```

## Cache semantics

Explicitly state whether any prior-conditioned result is stored and under what key.

## Motivating regression

Report exact geometry deltas for:

```text
unconnected H4 Hide
```

including:

```text
unaffected moved module count
max unaffected displacement
surviving Compass branch changes
```

## Connected Heading regression

Report endpoint roll-up and movement.

## Local repair

Explain frontier expansion and minimization objective.

## Fallback

Report fixtures that intentionally cold-fall back.

## Folder invariants

Report Direct/Nested hard gates.

## Performance

Report transition compute vs cold compute and 32-File/96-Heading evidence.

## Versions

Explain worker/algorithm/evidence/cache changes.

## Validation

Exact pass counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
