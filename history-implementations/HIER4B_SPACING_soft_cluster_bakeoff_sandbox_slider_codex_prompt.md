# HIER4B-SPACING — Soft Cluster Spacing Bakeoff + Sandbox Slider + Native Graphical Gate

**Task type:** evidence-driven layout tuning + bounded Sandbox control + native graphical QA

## Goal

Improve **Modular Focus Hierarchy → Soft Folder Clusters** so it uses available canvas more effectively and feels less cramped, especially with expanded Heading/Block structure.

This task intentionally happens **before** the separate Adaptive Compass × Soft consistency investigation.

The workflow is:

```text
1. benchmark several spacing candidates
2. choose one evidence-backed default spacing policy
3. keep that selected policy as the slider's midpoint/default
4. expose a Sandbox-only "Soft spacing" slider around that tested default
5. build an optimized Windows candidate
6. let the user tune spacing on the real vault
7. graphical QA decides final spacing / whether Adaptive still needs its own fix
```

The Sandbox slider is **required** in the final candidate.

Do not create a runtime algorithm that tries to automatically optimize spacing per graph. The development bakeoff chooses a good default; the Sandbox slider then lets the user manually explore a **bounded, prevalidated spacing range**.

Do **not** modify Adaptive Compass assignment/search/scoring logic in this task.

This is a visual/product task. Open a PR and run CI, but **do not merge before founder/user graphical QA**.

---

# Repository / starting point

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

The last confirmed HIER merge before this task is:

```text
7980c2e6d6a3c1ea5872023a05e1625b03be637d
PR #101 — HIER4B-PATCH2 root-neutral Soft folder force
```

The repository may have advanced since then with unrelated work. At task start:

1. read current `AGENTS.md`;
2. fetch/update `main`;
3. use **latest `main`**;
4. inspect open PRs/worktrees;
5. preserve unrelated work;
6. record the exact starting SHA.

Suggested isolated branch/worktree:

```text
codex/hier4b-spacing-slider
```

Do not push directly to `main`.

---

# Existing Sandbox architecture to reuse

Current `GraphSettings.tsx` already exposes Modular Focus controls under:

```text
Settings
→ Sandbox
→ Experimental
→ Modular preview
```

When Soft Folder Clusters is active, it already exposes:

```text
Folder strength: 0–100
```

That slider controls **folder attraction strength**.

This task adds a separate:

```text
Soft spacing: 0–100
```

slider.

The two controls must remain semantically distinct:

```text
Folder strength
→ how strongly repeated displayed folders attract

Soft spacing
→ how much geometric breathing room Soft layout uses
```

Do not repurpose the existing strength slider.

---

# Current accepted HIER4B behavior

Preserve all accepted behavior:

```text
nested displayed folder hierarchy
manual per-File promotion
manual folder flattening + sibling flatten
automatic singleton-chain compression
normalized-decay ancestor attraction
root-neutral folder force from PR #101
passive folder labels
File-only module-border hiding
post-island redundant wrapper suppression
folder-area right-click
composed File + containing-folder context menu
four-side Soft File attachment concept
Direct rendering + Electronic alternative
secondary references = zero geometry influence
```

Soft remains under evaluation.

Do not make Soft the product default.

---

# Current spacing evidence

Relevant owner:

```text
packages/focus-schematic-layout/src/soft-clusters.ts
```

At the previously inspected baseline:

```ts
HOP_SPACING = 520
MODULE_GAP = 72
radial jitter range ≈ 90
topology desired-distance extra = 155
packing ring step = 64
```

Soft schedule:

```text
initial radial placement
→ Adaptive Compass
→ 36 relaxation/collision iterations
→ Adaptive Compass again
→ 18 relaxation/collision iterations
→ deterministic packing
→ root anchoring
```

Shared internal spacing comes from current settings, previously:

```ts
modulePaddingX = 28
modulePaddingY = 24
internalNodeSeparation = 24
internalRankSeparation = 48
```

These are shared with non-Soft layouts.

**Do not enlarge shared global settings casually.** HIER4B-SPACING should be Soft-specific unless repository evidence proves otherwise.

---

# Design target

We want more space in two distinct layers.

## A. Macro spacing — between File modules / folder groups

Desired:

```text
clearer separation between modules
more useful canvas usage
less cramped folder regions
expanded modules not packed against neighbors
hop structure still readable
folder cohesion still obvious
```

Potential levers after inspection:

```text
hop radial spacing
module collision clearance
topology desired-distance offset
packing step / packing clearance
radial jitter amplitude
```

Do not assume all must increase.

## B. Internal spacing — inside expanded File modules

Desired:

```text
more room between File node and Heading branches
clearer separation between top-level branches
top/bottom/left/right regions visually distinct
nested descendants remain coherent
module frames do not hug nodes tightly
```

Potential values:

```text
internalNodeSeparation
internalRankSeparation
modulePaddingX
modulePaddingY
```

If Soft needs different values, create a **narrow Soft-only spacing seam** rather than changing global HIER defaults.

---

# Critical experimental rule: Adaptive stays frozen

Do not modify:

```text
branchDemand(...)
Adaptive Compass region assignment
Compass search enumeration
Compass scoring
Compass parity/tie-breaks
local relocation sweeps
directional-horizontal demand logic
soft-cardinal demand policy
```

After spacing changes, simply **observe** whether Adaptive looks better.

If it still looks mostly vertical, report it as remaining work.

Do not sneak in an Adaptive fix.

---

# Context sanity check

Before editing confirm:

```text
Goal:
  clearer Soft geometry + user-tunable Sandbox spacing

Constraints:
  no folder semantic changes
  no Adaptive algorithm changes
  no Directional changes
  no routing redesign
  no island/unification redesign
  deterministic output for any fixed slider value
  no overlaps
  root remains centered
  root-neutral folder force preserved

Success:
  evidence-backed default
  safe bounded slider range
  visibly less cramped real-vault graph
  no pathological canvas explosion
```

If current architecture materially differs, stop and report.

---

# Phase 1 — Capture baseline evidence first

Before spacing changes, run current Soft benchmark/bakeoff.

Relevant existing tool:

```text
tools/focus-schematic-bakeoff/src/soft-cluster-benchmark.ts
```

Record baseline aggregate + worst-case values for:

```text
overlapCount
minimumModuleGap
boundsWidth
boundsHeight
boundsArea
connectedPairDistanceMean/P95
exactPrimaryEndpointSpanMean/P95
exactEndpointCrossingCount
hopMeanAbsoluteRadiusError
hopRadiusCorrelation
repeatedFolderRmsRadiusMean/Median/P95
childFolderCoherenceMean
parentFolderCoherenceMean
collisionCheckCount
collisionCorrectionCount
layoutMs
```

Retain hard gates:

```text
deterministic
root File centered
node containment
secondary geometry influence = 0
fixed [36,18] schedule
```

Do not alter the baseline after seeing candidates.

---

# Phase 2 — Explore bounded spacing candidates

Do not multiply every number by one arbitrary factor.

Treat macro and internal spacing separately.

Evaluate a bounded matrix such as:

```text
macro:
  baseline
  moderate
  wide

internal:
  baseline
  moderate
  wide
```

Reasonable exploratory ranges:

```text
macro:    ~1.00 / 1.15–1.20 / 1.30–1.35
internal: ~1.00 / 1.20–1.30 / 1.40–1.50
```

These are search ranges, not required final values.

No fixture-specific spacing.

No File/folder-name-dependent spacing.

No randomness.

---

# Phase 3 — Select THREE validated anchor policies

After the bakeoff, select three coherent policies:

```text
COMPACT anchor
SELECTED DEFAULT anchor
SPACIOUS anchor
```

All three must pass the hard gates.

The middle anchor is the evidence-backed spacing Codex would have selected **even if no slider existed**.

Do not choose the midpoint merely because it is mathematically halfway between endpoints.

Conceptually:

```ts
SOFT_SPACING_COMPACT
SOFT_SPACING_SELECTED
SOFT_SPACING_SPACIOUS
```

Each anchor may contain independently tuned macro/internal values.

Example shape only:

```ts
{
  hopSpacing,
  moduleGap,
  topologyExtraDistance,
  packingStep,
  radialJitter,

  internalNodeSeparation,
  internalRankSeparation,
  modulePaddingX,
  modulePaddingY,
}
```

Use only fields actually justified by current code.

---

# Phase 4 — Sandbox slider semantics

Add one slider:

```text
Soft spacing
0 ───────────── 50 ───────────── 100
Compact         Selected          Spacious
```

Required semantics:

```text
0   = validated Compact anchor
50  = validated Selected Default anchor
100 = validated Spacious anchor
```

Default:

```text
50
```

The selected benchmark winner therefore remains the default experience.

This is important: the slider exists for human tuning, but Codex still does the automatic candidate analysis first.

---

# Piecewise interpolation

For values between anchors, use deterministic piecewise interpolation:

```text
0..50
→ interpolate Compact → Selected

50..100
→ interpolate Selected → Spacious
```

Interpolate each numeric spacing field independently.

Conceptually:

```ts
if value <= 50:
    t = value / 50
    policy = lerp(COMPACT, SELECTED, t)
else:
    t = (value - 50) / 50
    policy = lerp(SELECTED, SPACIOUS, t)
```

Do not introduce a meta-optimizer.

For a fixed slider value, layout output must remain deterministic.

If a field logically requires an integer, normalize deterministically at the policy boundary.

If linear interpolation is clearly inappropriate for one current spacing field, document and use the simplest monotonic mapping justified by the solver.

---

# Slider range must be prevalidated

Do not expose arbitrary unsafe extremes.

The 0 and 100 anchors must both pass:

```text
no overlaps
containment
determinism
root centering
root-neutral force
secondary influence = 0
bounded [36,18] schedule
reasonable bounds/runtime
```

Also sample intermediate slider values in automated tests/benchmark, at minimum:

```text
0
25
50
75
100
```

If interpolation creates a bad intermediate value even though endpoints are safe, adjust anchors/mapping rather than shipping the bad range.

---

# Product/UI placement

The control belongs in the existing Sandbox-only Modular section.

Show it only when:

```text
Scope = Focus
Layout = Hierarchy
Focus Hierarchy implementation = Modular preview
Macro layout = Soft Folder Clusters
```

Place it near the existing:

```text
Folder strength
```

slider.

Recommended UI:

```text
Folder strength
[ existing slider ]

Soft spacing
[ slider ]
Compact        Selected        Spacious
```

Show the numeric value in an `<output>`.

Use accessible range semantics and a useful `aria-valuetext`.

No control should appear in Directional Bands.

---

# Persistence / Sandbox semantics

This is a Sandbox graph-presentation control.

Inspect current `GraphPreferences` / Sandbox reset architecture and follow the established pattern.

Preferred field name conceptually:

```ts
modularFocusSoftSpacing
```

normalized to:

```text
0..100
default 50
```

Requirements:

```text
Reset Sandbox → restores 50
malformed persisted values → safe default 50
out-of-range values → normalize/clamp using repository convention
```

It is acceptable for the Sandbox control to persist like neighboring Modular experimental graph preferences.

However, **do not broaden this task into a Saved View schema migration unless current architecture strictly requires it**.

Current `SavedFocusHierarchySettings` is an exact serialized profile contract. If adding this experimental Sandbox field to Saved Views would require a consequential profile/schema compatibility decision, leave it out of Saved View capture/apply for this task and document that choice.

The slider must work in the live Sandbox regardless.

Do not silently break existing saved profiles.

---

# Reset Sandbox

Update current Sandbox reset behavior so:

```text
Soft spacing → 50
```

while existing reset behavior remains intact.

Test it.

---

# Layout policy threading

The spacing value must reach the Soft layout through a typed policy path, not via UI globals.

Likely flow:

```text
GraphPreferences / Sandbox
→ GraphExplorer
→ ModularStructuredGraphView
→ FocusSchematicProductLayoutPolicies
→ worker request
→ Soft layout options/policy
→ resolved Soft spacing policy
```

Inspect current architecture and use the narrowest existing seam.

Do not let React-specific types leak into the layout package.

---

# Directional isolation

When Macro Layout is Directional Bands:

```text
Soft spacing must have ZERO geometry influence
```

Prefer the same pattern already used for Soft-only fields:

```text
Directional request/cache identity ignores Soft-only spacing
```

Changing the hidden Soft spacing preference must not recompute Directional geometry.

When returning to Soft, restore the retained value.

---

# Cache identity

Soft spacing changes geometry and must participate in Soft cache identity.

Requirements:

```text
Soft + spacing 25 ≠ Soft + spacing 50 cache key
Soft + spacing 50 ≠ Soft + spacing 75 cache key

Directional + hidden Soft spacing 25
=
Directional + hidden Soft spacing 75
```

Rapid slider movement should use current latest-result-wins worker behavior; do not add a serial queue.

Do not adopt stale worker results from an earlier slider value.

---

# Algorithm/cache version

The selected default spacing changes deterministic Soft geometry.

Current Soft algorithm version after PR #101 should be:

```text
4
```

If latest main still has 4, bump to:

```text
5
```

Otherwise bump to next current version.

Directional selected algorithm version remains unchanged.

Worker protocol remains unchanged **unless current request serialization genuinely needs a protocol bump by repository contract**. Inspect first; do not bump reflexively.

---

# Candidate architecture

Prefer a Soft-owned resolved spacing policy.

Conceptually:

```ts
interface SoftClusterSpacingPolicy {
  hopSpacing: number;
  moduleGap: number;
  topologyExtraDistance: number;
  packingStep: number;
  radialJitter: number;

  internalNodeSeparation: number;
  internalRankSeparation: number;
  modulePaddingX: number;
  modulePaddingY: number;
}
```

Production path:

```text
slider value
→ resolveSoftClusterSpacing(value)
→ deterministic policy
→ solver
```

Benchmark path may directly compare anchor policies or slider values.

Do not expose every internal constant as its own UI control.

The user requested **one slider**.

---

# Do not edit shared global HIER settings

Avoid changing:

```text
FOCUS_SCHEMATIC_LAYOUT_SETTINGS
FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS
```

to achieve Soft spacing.

Those affect Directional / inherited HIER geometry.

Use Soft-only derived/internal settings for:

```text
internalNodeSeparation
internalRankSeparation
modulePaddingX
modulePaddingY
```

when applying internal layout inside Soft.

Do not mutate original input.

---

# Internal spacing details

Inspect `internal-layout-variants.ts`.

Current placement derives approximately:

```text
branch separation = input.settings.internalNodeSeparation
File-to-branch gap = input.settings.internalRankSeparation
module frame = node bounds + modulePaddingX/Y
```

Evaluate separately:

```text
branch separation / File gap
vs
module padding
```

Increasing module padding alone is not sufficient if branches remain tightly stacked.

---

# Macro spacing details

Inspect current Soft constants and their semantic roles.

Potential concepts:

```text
hop spacing
module gap
topology desired distance
packing step
radial seed jitter
```

If a spacing value changes, related metrics must use the resolved current spacing policy.

Especially:

```text
hopMeanAbsoluteRadiusError
```

must compare against:

```text
hop * resolvedHopSpacing
```

not a stale constant.

---

# Folder guides are downstream

Do not tune folder-guide padding to fake a spacing improvement.

Preserve:

```text
nested containment
post-island redundant-wrapper suppression
labels
area hit testing
context menus
```

Guide geometry may naturally change because module rectangles move.

That is expected.

---

# Preserve HIER4B-PATCH2 root neutrality

Keep:

```text
root excluded from Soft folder-force groups
root included in display hierarchy
root remains topology anchor/collision body
force metrics root-excluded
display evidence root-inclusive
```

All PR #101 regressions must remain green at slider values:

```text
0
50
100
```

and ideally sampled intermediates.

---

# Strength × spacing independence

Folder strength and Soft spacing are separate axes.

Test representative combinations:

```text
strength 0   / spacing 0
strength 0   / spacing 50
strength 0   / spacing 100

strength 50  / spacing 0
strength 50  / spacing 50
strength 50  / spacing 100

strength 100 / spacing 0
strength 100 / spacing 50
strength 100 / spacing 100
```

Do not require all geometries equal.

Required invariant:

```text
At a fixed spacing value and strength = 0,
folder identity/display intent has zero geometry influence.
```

Changing spacing is allowed to change geometry at strength 0.

---

# Adaptive Compass observation — diagnostics only

Because we want to know whether spacing improves Adaptive "by itself", add development diagnostics that observe final branch-region usage without influencing it.

Useful outputs:

```text
per-module region count:
  1 / 2 / 3 / 4 regions used

aggregate branches:
  left / right / top / bottom

existing branch-region churn
```

Run at least:

```text
spacing 0
spacing 50
spacing 100
```

for representative expanded fixtures.

Prefer benchmark/lab-only diagnostics.

Do not alter production Adaptive evidence schema unless strongly justified.

This is not a hard gate.

---

# Visual bakeoff

Use existing tooling under:

```text
tools/focus-schematic-bakeoff/
```

Compare at least:

```text
old baseline
new slider 0
new slider 50
new slider 100
```

on representative fixtures:

```text
small/simple
dense repeated folder
deep nested hierarchy
wide hub/star
expanded File with several top-level Heading branches
mixed promotion/flattening
root-shared-folder regression fixture
```

If needed, add one synthetic source-neutral multi-branch fixture.

No private vault content.

---

# Hard candidate gates

Reject any anchor/range causing:

```text
module overlaps
nodes outside modules
root-centering loss
nondeterminism
secondary geometry influence
failure of [36,18] schedule
Soft folder semantic changes
root-neutral force regression
Directional output changes
packing failure
pathological canvas explosion
severe folder-coherence loss
material runtime regression without visual benefit
```

Use aggregate + worst-case evidence.

Do not maximize whitespace.

---

# Tradeoff objective

Generally improve:

```text
minimumModuleGap ↑
visual separation of expanded modules ↑
internal branch breathing room ↑
usable canvas coverage ↑
```

Keep bounded:

```text
boundsArea
connectedPairDistance
endpoint span
hop-radius error
folder RMS radius
collision work
layout time
```

---

# Slider performance / interaction

Moving the slider rapidly triggers layout recomputation.

Use existing latest-result-wins behavior.

Requirements:

```text
no serial backlog
stale result cannot replace newer value
UI remains responsive
```

Do not add debounce unless evidence shows it is needed.

If a light animation-frame coalescing layer already exists for similar controls, reuse it.

Do not make the slider update only on mouse release unless necessary.

The user should be able to tune spacing interactively.

---

# Required tests

## S1 — resolved anchors

Assert:

```text
resolve(0)   = Compact
resolve(50)  = Selected
resolve(100) = Spacious
```

## S2 — deterministic interpolation

For:

```text
0, 1, 25, 49, 50, 51, 75, 99, 100
```

resolution is deterministic, bounded, and monotonic for intended spacing dimensions.

## S3 — Soft-only influence

Soft cache/geometry responds to spacing.

Directional geometry/cache does not.

## S4 — deterministic layout

Repeated cold runs at:

```text
0 / 25 / 50 / 75 / 100
```

remain byte-deterministic.

## S5 — overlap / containment

Dense and expanded fixtures remain valid across slider samples.

## S6 — default actually improved

Slider 50 embodies the evidence-selected spacing and improves an evidence-backed readability geometry property over the old pre-spacing algorithm.

## S7 — endpoints safe

0 and 100 pass all hard gates.

## S8 — internal breathing room

Expanded multi-branch fixture proves intended File-to-branch / branch-to-branch spacing.

## S9 — root neutrality

PR #101 root+1/root+2/ancestor regressions pass at multiple spacing values.

## S10 — strength-zero semantics

At fixed spacing, strength zero remains folder-identity independent.

## S11 — Sandbox visibility

Slider shown only for:

```text
Focus + Hierarchy + Modular preview + Soft Folder Clusters
```

and absent for irrelevant modes.

## S12 — Reset Sandbox

Restores:

```text
50
```

## S13 — persistence validation

Malformed/out-of-range values recover safely.

## S14 — cache identity

Soft spacing values key independently; Directional ignores them.

## S15 — rapid update stale rejection

Latest spacing wins.

## S16 — Saved Views compatibility

Existing Saved View validation/capture/apply remains compatible.

Do not silently force a profile schema migration.

## S17 — Adaptive code untouched

Diff + existing tests prove no assignment/search/scoring change.

---

# Documentation

Update nearest relevant docs, likely:

```text
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/ROADMAP.md
apps/web/src/components/README.md
apps/web/src/preferences/README.md
packages/focus-schematic-layout/README.md
```

Document:

```text
selected Soft spacing default
Compact / Selected / Spacious anchor semantics
Sandbox slider range 0–100
default = 50
Folder strength vs Soft spacing distinction
Soft-only cache influence
Directional isolation
Adaptive logic intentionally unchanged
native graphical QA pending
```

Roadmap conceptually:

```text
HIER4B-SPACING — implemented candidate + Sandbox tuning slider; native graphical QA pending
```

Do not mark complete before user approval.

Do not mark Soft adopted.

---

# Sandbox slider UX

Recommended UI:

```text
Folder strength
[────────●────────] 50

Soft spacing
[────────●────────] 50
Compact       Selected       Spacious
```

Use existing slider styling.

Show the numeric value clearly so the user can report it.

At anchors, useful accessible text:

```text
0:   compact spacing
50:  selected spacing
100: spacious spacing
```

---

# Native graphical QA artifact

Build optimized Windows executable:

```text
hier4b-spacing-slider-native-candidate.exe
```

Report SHA-256.

Open PR and run CI, but do not merge.

Ask the user to test real vault with:

```text
Macro Layout: Soft Folder Clusters
Internal Layout: Adaptive Compass
```

and try:

```text
0
25
50
75
100
```

plus preferred in-between values.

---

# Native QA questions

Ask:

```text
1. Which Soft spacing value looks best?
2. Are Files/modules less cramped?
3. Is empty space used better?
4. Are nested folder regions easier to parse?
5. Are expanded Heading branches easier to distinguish?
6. At what value does the graph become too sparse?
7. Are related Files still visibly cohesive?
8. Does Adaptive Compass now look like it meaningfully uses multiple sides?
9. Any huge gaps or isolated modules?
10. Are folder guides/labels still sane?
11. Does root still read as central focus?
12. Does moving the slider feel responsive?
```

User should report a preferred numeric value.

---

# Post-QA decision

## If user likes 50

Keep selected default.

## If user prefers another value, e.g. 63

Prefer recalibrating the Selected anchor so the approved geometry becomes:

```text
slider 50 = recommended/default
```

rather than permanently making an arbitrary non-midpoint value the conceptual default.

Before merge, report the recalibration and rerun hard gates.

If user explicitly wants the raw chosen number preserved as default instead, follow that explicit instruction.

## If Adaptive looks fixed after spacing

Record that spacing resolved the visible symptom sufficiently without Adaptive code changes.

## If Adaptive still looks vertical

Spacing may still be approved and merged.

Leave Adaptive Compass × Soft consistency as a separate task.

Do not abuse spacing to force four-side appearance.

---

# Directional isolation

Directional Folder Bands must remain byte/semantically unchanged.

Required evidence:

```text
representative Directional hashes before/after
shared global HIER settings unchanged
Directional algorithm version unchanged
signed-rank semantics unchanged
Directional cache key independent of Soft spacing
```

If Directional changes, stop.

---

# Performance

Track:

```text
collisionCheckCount
collisionCorrectionCount
layoutMs
boundsArea
```

across:

```text
0 / 25 / 50 / 75 / 100
```

Do not increase the fixed iteration schedule.

Expected:

```text
[36,18] unchanged
```

---

# No extra product controls

Add only:

```text
one Soft spacing slider
```

Do not add separate UI sliders for implementation constants.

---

# Explicit non-scope

Do not change:

```text
Adaptive Compass assignment logic
Vertical Spine algorithm
folder semantics
root-neutral force semantics
promotion/flattening
singleton compression
guide island splitting
unified/no-island policy
context menus
File attachment semantics
Direct/Electronic routing
HIER5
MODULAR-CONTEXT1
HIER3C
Classic Focus Hierarchy
Network layout
source discovery
```

Do not start next HIER milestone automatically.

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run apps/web/src/focus-schematic-layout-cache.test.ts
pnpm exec vitest run apps/web/src/components/GraphSettings.modular.test.tsx
pnpm exec vitest run apps/web/src/preferences

pnpm <current-soft-cluster-benchmark-command>

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current scripts/package names.

No new dependency unless clearly justified.

---

# PR / merge workflow

This task explicitly requires founder graphical review.

Workflow:

```text
implement
→ tests + benchmark
→ add Sandbox slider
→ optimized Windows build
→ commit/push
→ open PR
→ CI
→ STOP for user native graphical QA
```

**Do not merge** until explicit user approval.

After approval and any agreed recalibration:

```text
record native QA
→ update latest main if needed
→ final CI
→ merge
→ verify post-merge CI
→ cleanup
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_soft_cluster_bakeoff_sandbox_slider_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates before user QA

1. latest `main` used;
2. starting SHA recorded;
3. baseline benchmark captured first;
4. macro/internal spacing analyzed separately;
5. multiple candidates evaluated;
6. Compact anchor selected/validated;
7. Selected anchor selected/validated;
8. Spacious anchor selected/validated;
9. slider 0 = Compact;
10. slider 50 = Selected;
11. slider 100 = Spacious;
12. interpolation deterministic;
13. 0/25/50/75/100 pass hard gates;
14. Sandbox-only Soft spacing slider exists;
15. default = 50;
16. Folder strength remains separate;
17. slider only visible for Modular Soft;
18. absent for Directional;
19. Reset Sandbox restores 50;
20. malformed persisted values recover safely;
21. Saved View compatibility preserved;
22. Soft cache includes spacing;
23. Directional cache ignores spacing;
24. rapid changes latest-result-wins;
25. no serial backlog;
26. no fixture-specific spacing;
27. one slider only;
28. Adaptive logic unchanged;
29. [36,18] unchanged;
30. root-neutral force preserved;
31. folder semantics preserved;
32. no overlaps;
33. no containment violations;
34. root centered;
35. secondary influence zero;
36. deterministic repeats pass;
37. default improves readability geometry;
38. bounds measured;
39. connection spans measured;
40. hop error uses resolved spacing;
41. folder coherence measured;
42. collision/runtime measured;
43. Adaptive region use observed only;
44. Directional output unchanged;
45. Soft version bumped;
46. Directional version unchanged;
47. protocol unchanged unless contract requires;
48. layout tests pass;
49. cache tests pass;
50. GraphSettings tests pass;
51. preference/reset tests pass;
52. benchmark hard gates pass;
53. full `pnpm check` passes;
54. desktop check/build passes;
55. `git diff --check` passes;
56. docs updated;
57. roadmap says native QA pending;
58. optimized EXE produced;
59. EXE SHA-256 reported;
60. prompt archived + SHA-256;
61. PR opened;
62. PR CI passes;
63. PR remains unmerged pending user QA;
64. stop.

---

# Final report before user QA

## Branch / commit / PR

## Starting main SHA

## Old baseline spacing

List actual values.

## Candidate bakeoff

Summarize tested combinations.

## Three slider anchors

Provide:

```text
property | 0 Compact | 50 Selected | 100 Spacious
```

## Default rationale

Why 50's policy was selected.

## Slider implementation

Report preference field, normalization, Reset Sandbox, visibility, cache behavior, latest-result-wins behavior.

## Benchmark comparison

Include baseline and 0/50/100 for:

```text
minimumModuleGap
boundsArea
connectedPairDistanceP95
exactPrimaryEndpointSpanP95
hopMeanAbsoluteRadiusError
folder coherence
crossings
collision work
layout time
```

Include worst-case regressions.

## Adaptive observation

Region-use/churn for 0/50/100; state Adaptive logic unchanged.

## Directional isolation

Representative hash/oracle evidence.

## Cache/version

Soft old → new; Directional/protocol unchanged.

## Validation

Exact commands + pass counts.

## Native artifact

Exact EXE path + SHA-256.

## Native QA request

Ask user to try:

```text
0, 25, 50, 75, 100
```

and report preferred value.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
