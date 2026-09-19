# HIER4B-SPACING-FIX1 — Direct Folders, Faster Ancestor Decay, Stable Radial Spread

## Goal

Continue the still-open HIER4B-SPACING work in PR #106 and correct the native-QA issues before merge.

Required changes:

1. Add `Direct folders only` Sandbox mode:
   - each File gets Soft force only from its nearest/current displayed folder;
   - folder guides become visually flat, with no ancestor wrapper around child-folder groups;
   - underlying displayed-folder hierarchy, persisted intent, promotion/flattening, and context semantics remain unchanged.

2. Replace current nested ancestor decay (`1/2` per level) with a Sandbox comparison:
   - `1/3` decay;
   - `1/4` decay;
   - default `1/3`;
   - raw weights decay geometrically, then normalize per File so total folder-force weight remains bounded at 1.

3. Replace the current unstable Soft spacing slider semantics:
   - it must no longer interpolate many solver constants;
   - spread-only changes must not rerun/reselect Adaptive Compass, crossing ordering, folder-force relaxation, collision packing, internal spacing, or topology spacing;
   - instead apply a smooth post-layout radial spread around the Focus/root, translating complete non-root File modules outward while preserving angles and internal geometry.

Do not merge before founder native graphical QA.

---

## Current repo / PR

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue:

```text
PR #106
branch: codex/hier4b-spacing-slider
reported head: c99e238416fa29b42b0556d0be1358ca77dee66c
```

At prompt-writing time PR #106 is open/unmerged.

Current `main` inspected:

```text
7f646ddb2517f7b8b46c346804994d635acfbff8
```

PR #106 was created from an older base, so first:

1. read `AGENTS.md`;
2. fetch refs;
3. verify PR #106 is still open;
4. integrate latest `main` into the PR branch using repo conventions;
5. resolve conflicts conservatively;
6. preserve unrelated newer-main work;
7. update the same PR rather than opening a competing spacing PR.

Record exact starting SHAs.

---

## Founder QA requirements

### Root File

Leave current visual behavior unchanged:

```text
root displayed folder membership    YES
root folder guide membership        YES
root context semantics              YES
root folder-force membership        NO
```

Preserve PR #101 root-neutral force.

### Direct folders only

Add Sandbox control:

```text
☐ Direct folders only
```

When OFF:
- nested folder guides remain;
- ancestor force uses selected 1/3 or 1/4 decay.

When ON:
- force policy becomes nearest-only;
- each File has one Soft folder force scope: its nearest/current displayed parent;
- folder guides are flat: parent guides do not wrap child-folder regions.

Do not destructively flatten or rewrite the displayed tree.

Example:

```text
A
└─ B
   ├─ B1
   └─ B2
```

Nested visual:
```text
A wrapper
└─ B wrapper
   ├─ B1
   └─ B2
```

Direct-only visual:
```text
B guide around B1/B2
```

If A also has direct A1/A2 Files, direct-only may render an independent A guide around A1/A2. A must not wrap B.

Preserve existing one-unit wrapper suppression.

Context menus:
- File menu uses current nearest displayed containing folder;
- flat folder label/area acts on that represented folder;
- persisted manual folder intent remains unchanged.

---

## Ancestor pull 1/3 vs 1/4

When `Direct folders only` is OFF, expose a two-option Sandbox control:

```text
Ancestor pull
(●) 1/3
( ) 1/4
```

Default:

```text
1/3
```

Do not expose old `1/2` as a normal product option.

Use:

```ts
rawWeight(index, base) = 1 / base ** index
```

where:
- index 0 = nearest displayed folder,
- index 1 = parent,
- index 2 = grandparent.

Then normalize each File's selected raw weights so total force weight remains 1 (or 0 when no scopes).

Expected tests:

For 2 scopes:
```text
1/3: nearest .75, parent .25
1/4: nearest .80, parent .20
```

For 3:
```text
1/3 ≈ .6923077 / .2307692 / .0769231
1/4 ≈ .7619048 / .1904762 / .0476190
```

Prefer separating:
```text
scope mode: nested | nearest-only
ancestor decay base: 3 | 4
```

rather than multiplying enum variants.

When Direct-only is ON:
- ancestor decay control should be hidden or disabled;
- stored 1/3 vs 1/4 preference is retained for later;
- decay difference must be canonicalized out of structural cache identity.

---

## Current spacing slider problem

PR #106 currently lets the slider change multiple structural parameters such as:

```text
hop spacing
module gap
topology extra distance
packing step
radial jitter
internal node separation
internal rank separation
module padding X/Y
```

That means a tiny slider change can cross discrete packing/Compass/crossing thresholds, causing large rearrangements.

Founder observed specifically that values around:

```text
71 → 73
```

can move many modules unexpectedly.

This behavior is rejected.

---

## Stable structural Soft layout

Use ONE fixed Soft structural spacing policy.

The current PR's evidence-selected moderate policy is a reasonable starting base if it still validates after latest-main integration:

```text
hopSpacing               600
moduleGap                  88
topologyExtraDistance     180
packingStep                72
radialJitter              104
internalNodeSeparation     30
internalRankSeparation     60
modulePaddingX             34
modulePaddingY             30
```

Re-run current tests/benchmark first. If still valid, freeze this as the structural spacing policy.

Remove the runtime Compact/Selected/Spacious interpolation from solver decisions.

---

## New Soft spacing semantics: radial spread only

After the stable structural layout is decided, apply a pure radial transform.

Let:
```text
R = Focus/root center
P = non-root module center
s = spread scale >= 1
```

Then:
```text
P' = R + s * (P - R)
```

For each non-root module:
- translate the module to P';
- translate all File/Heading/Block/Diagnostic nodes in that module by the same delta;
- keep module width/height unchanged;
- keep internal node offsets unchanged.

Root remains fixed.

Required invariants across slider values:
```text
same angular direction from root
same branch-region assignments
same Heading/crossing ordering
same force groups
same collision-pack selection
same module dimensions
same internal layout
```

Only module translations change.

---

## Stronger slider

Keep one Sandbox slider, preferably still labeled:

```text
Soft spacing
```

Helper:
```text
Spread File modules outward from the Focus without changing layout decisions.
```

Evaluate roughly:

```text
0   → 1.0× base radius
50  → ~1.6–1.7×
100 → ~2.3–2.5×
```

Use a simple continuous monotonic mapping such as linear interpolation unless evidence supports a different smooth mapping.

Do not allow slider 0 to contract below the validated base layout.

The high end should be visibly strong enough to separate individual modules.

---

## Critical architecture requirement

A spread-only change should NOT rerun the structural Soft solver.

Preferred architecture:

```text
structural worker/cache
→ stable base Soft result
→ cheap radial post-transform
→ recompute/update only geometry-derived attachments needed for rendering
```

Exclude radial spread from structural cache identity.

Do not rerun:
```text
Adaptive Compass
crossing optimization
folder forces
collision packing
internal branch placement
```

because spread changed.

If the current renderer requires a cheap postprocess, that is fine. Structural compute count must remain unchanged for spread-only changes.

Recompute/update endpoint attachments or other final geometry-dependent coordinates so edges remain correct.

Folder guides should derive from transformed module rectangles.

---

## 71 → 73 regression

Add a direct regression at:

```text
71
72
73
```

Assert:
- same module angular order;
- same branch-region assignments;
- same module sizes;
- same node offsets inside each module;
- same structural/crossing-order evidence;
- positions differ only according to radial scale.

No discrete structural re-layout.

---

## Crossing behavior

Do not promise actual geometric crossing count always improves monotonically.

But the crossing/order optimizer decision must remain stable because the slider no longer reruns it.

If final straight-line crossing measurements shift as endpoints move outward, record them diagnostically only.

---

## Preferences / UI

Sandbox Soft controls should conceptually be:

```text
Folder strength
[0 ---------------- 100]

☐ Direct folders only

Ancestor pull
(●) 1/3
( ) 1/4
[hidden/disabled when Direct folders only is ON]

Soft spacing
[0 ---------------- 100]
Base            Strong spread
```

Recommended preference concepts:
```text
modularFocusDirectFoldersOnly
modularFocusSoftAncestorDecayBase
modularFocusSoftRadialSpread
```

Defaults:
```text
Direct folders only = false
Ancestor decay      = 1/3
Soft spacing        = 50
```

`Reset Sandbox` restores defaults.

Malformed/out-of-range stored values recover safely.

Preserve existing Saved View compatibility. If current Saved Views capture neighboring Soft controls, extend them compatibly rather than invalidating old profiles.

---

## Cache / worker identity

Structural cache:
- nested 1/3 vs nested 1/4 => different;
- direct-only => ancestor decay irrelevant/canonicalized;
- radial spread => excluded from structural cache identity;
- Directional => ignores all these Soft-only controls.

Direct-only and decay affect structural layout and may require worker/evidence contract changes.

Radial spread ideally stays outside structural worker input.

Bump only versions required by actual contract changes.

Current PR #106 previously reported:
```text
Soft algorithm 6
worker protocol 9
Soft evidence schema 4
```

Use next current versions only as needed.

Directional algorithm/version must remain unchanged.

---

## Force tests

Add tests for:

1. normalized 1/3 weights;
2. normalized 1/4 weights;
3. nearest-only membership;
4. total per-File force <= 1 at arbitrary depth;
5. root neutrality for 1/3, 1/4, and Direct-only;
6. strength-zero folder identity independence at fixed scope/decay.

---

## Flat guide tests

Add:
- nested vs direct-only visual guide comparison;
- parent with own direct Files plus child folder;
- nested → direct-only → nested leaves display tree/persisted intent byte-identical;
- context target correctness.

Direct-only folder guide membership is direct displayed Files only, not child folder regions.

---

## Radial tests

Add:
- root fixed;
- angle invariant;
- radius monotonic;
- exact scale relation;
- module width/height invariant;
- node offset-to-module-center invariant;
- branch-region invariant;
- crossing-order evidence invariant;
- no new overlaps;
- 71/72/73 stability;
- structural worker/base-solver reuse across spread-only changes.

For worker reuse, ideal oracle:

```text
structural compute count = 1
spread changes = many
```

---

## Directional / unrelated isolation

No impact on:
```text
Directional Folder Bands
Classic Focus Hierarchy
All Hierarchy
Global/Focus Network
Local Free/Structured
SPATIAL/MOVE
source discovery
```

Representative Directional hashes/oracles must remain unchanged.

---

## Documentation

Update relevant docs, likely:
```text
docs/HIER4B_SOFT_FOLDER_CLUSTERS.md
docs/ROADMAP.md
packages/focus-schematic-layout/README.md
packages/renderer-reactflow/src/focus-schematic/README.md
apps/web/src/components/README.md
apps/web/src/preferences/README.md
```

Document:
- Direct folders only force + flat-guide semantics;
- 1/3 and 1/4 normalized decay;
- default 1/3;
- root-neutral force unchanged;
- Soft spacing is now radial post-layout spread;
- spread does not rerun Adaptive/crossing/collision;
- native QA pending.

Remove/update documentation describing the rejected nine-parameter runtime slider.

---

## Validation

Follow current `AGENTS.md`.

Expected equivalents:
```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/focus-schematic-layout
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run apps/web/src/components/GraphSettings.modular.test.tsx
pnpm exec vitest run apps/web/src/preferences
pnpm exec vitest run apps/web/src/focus-schematic-layout-cache.test.ts

pnpm benchmark:focus-schematic-soft-clusters

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No new dependency unless clearly justified.

---

## Native artifact / QA gate

Build:
```text
hier4b-soft-direct-decay-radial-spread-native-candidate.exe
```

Report SHA-256.

Update PR #106 and run CI.

Do not merge.

Ask founder to test:

```text
Direct folders only OFF / ON

Ancestor pull:
1/3 / 1/4

Soft spacing:
0 / 25 / 50 / 71 / 73 / 75 / 100
```

Explicit QA questions:
1. Does Direct-only remove nested parent wrappers?
2. Does nearest-folder grouping remain correct?
3. Which looks better: 1/3 or 1/4 ancestor pull?
4. Does nested mode remain useful without over-pulling?
5. Is Soft spacing smooth now?
6. Does 71 → 73 produce only a small outward shift?
7. Is 100 strong enough?
8. At what value does it become too sparse?
9. Do Adaptive branch arrangements remain stable?
10. Are guides/labels/context menus correct?
11. Is root still central?
12. Any obvious new edge problems?

---

## PR workflow

Continue PR #106:

```text
sync branch with latest main
→ implement correction
→ validate
→ optimized EXE
→ push PR #106
→ CI
→ STOP for founder graphical QA
```

No merge before explicit approval.

---

## Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_SPACING_FIX1_direct_folders_decay_radial_spread_codex_prompt.md
```

Record SHA-256.

---

## Hard exit gates before QA

- latest main integrated;
- same PR #106 updated;
- root visual folder membership unchanged;
- root-neutral force preserved;
- Direct folders only control works;
- Direct-only force is nearest-only;
- Direct-only guides are flat/non-nested;
- display tree/persisted intent unchanged by mode switching;
- 1/3 and 1/4 options work;
- default = 1/3;
- normalized decay totals <= 1;
- Direct-only makes decay structurally irrelevant;
- old 1/2 product default removed;
- one fixed structural Soft spacing policy;
- user spacing slider no longer changes solver constants;
- spread does not rerun Adaptive/crossing/folder-force/collision;
- spread is uniform radial translation;
- root fixed;
- module angles invariant;
- module/internal geometry invariant;
- 71/72/73 regression passes;
- structural solver reused for spread-only changes;
- transformed attachments/guides correct;
- cache canonicalization correct;
- Directional unchanged;
- [36,18] structural schedule unchanged;
- secondary geometry influence remains zero;
- preference/reset/profile compatibility tests pass;
- focused tests pass;
- full `pnpm check` passes;
- desktop check/build passes;
- benchmark hard gates pass;
- docs updated;
- prompt archived + SHA-256;
- optimized EXE + SHA-256;
- PR #106 CI green;
- PR unmerged;
- stop.

---

## Final report before founder QA

Report:

1. Branch / commits / PR #106
2. Latest-main SHA integrated
3. Direct-only implementation: force + guide semantics
4. Ancestor decay: 1/3 vs 1/4 weights and defaults
5. Fixed structural Soft spacing policy
6. Radial spread mapping
7. 71→73 stability evidence
8. Structural worker/cache reuse evidence
9. Directional isolation evidence
10. Version/schema changes
11. Validation counts
12. EXE path + SHA-256
13. Prompt archive + SHA-256
14. Explicit status:

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
