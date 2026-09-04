# GLOBALVIS1 — Make All Network Visual Controls Render-Only

**Task type:** architecture cleanup / renderer behavior fix / unnecessary relayout elimination

## Goal / success outcome

Fix the current All + Network settings behavior so that controls labeled **Visual** behave as presentation changes only and do not trigger ForceAtlas2, layout-cache invalidation, position reapplication, camera movement, or unrelated node movement.

The intended contract is:

```text
LAYOUT
Reference pull
Folder clustering / strength
Spacing preset / spatial spacing
Folder separation
        ↓
may legitimately run Global ForceAtlas2 / folder-prior layout

VISUAL
Base node size
Link influence on node size
Link thickness
Label threshold
        ↓
Sigma presentation refresh only
0 Global layout requests
0 position changes
0 camera changes
```

This should extend the architectural lesson already established by VISUAL1B:

```text
visual radius change
≠
layout/physics change
```

Do not change the user's current visual formulas or control ranges. Change **ownership and invalidation behavior**, not the product meaning of the controls.

---

# Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
836c465ea3143e769b7ee1937261b2a43cd80587
```

Recent relevant merged work includes:

```text
#51 VISUAL1B — per-file Network size overrides
#54 NETWORKPOLISH1 — source-folder sidebar + persistent Focus lines
#56 SPATIAL1A — normalized folder anchor foundation
#57 SPACING1A — Focus density diagnostic
#59 SPATIAL1B — direct folder-cluster arrangement
```

Current open concurrent work:

```text
#60 SPACING1B — density-aware Focus camera framing
status: draft / unmerged
base: current main
```

PR #60 is Focus/Local camera work. Preserve its branch/worktree and do not incorporate or modify its unmerged changes.

If #60 merges before this task finishes, update this task onto newest `main` before final validation/merge.

No external context is required.

---

# Current evidence

## 1. App-level invalidation is too broad

`GraphExplorer.changeGlobalLayoutSettings(...)` currently does approximately:

```ts
if (globalLayoutSettingsApplyImmediately(activeScope, activeLayout)) {
  setGlobalLayoutRequestKey((current) => current + 1);
}
updateGraphPreferences({ globalLayoutSettings: settings });
```

`globalLayoutSettingsApplyImmediately(...)` checks only:

```text
Scope = All
Layout = Network
```

It does **not** inspect which setting changed.

Therefore while All + Network is active:

```text
Base node size slider
Link influence slider
Link thickness slider
Label threshold slider
```

all increment the explicit Global layout request key.

That is incorrect for the current physics.

---

## 2. The settings object mixes layout + visual state

`GlobalLayoutCustomSettings` currently contains:

```text
linkForce
folderCohesion
withinFolderSpacing
betweenFolderSpacing

nodeSize
referenceDegreeSizeInfluence
linkThickness
labelThreshold
```

This JSON-compatible preference shape is already persisted and should remain compatible.

The UI already presents an intentional conceptual split:

```text
Advanced controls

LAYOUT
- Reference pull
- Folder separation

VISUAL
- Base node size
- Link influence on node size
- Link thickness
- Label threshold
```

Use that separation as a real runtime architecture boundary rather than only a heading in the settings UI.

---

## 3. Current Global layout physics do not use visual size

Current Global ForceAtlas2 setup uses resolved settings for:

```text
linkForce
withinFolderSpacing / scalingRatio
folder prior behavior
```

and folder-prior logic uses:

```text
folderCohesion
betweenFolderSpacing
withinFolderSpacing
```

The installed ForceAtlas2 path does not intentionally use display node radius for collision physics.

VISUAL1B already proved the same architectural issue for per-file Size:

```text
size multiplier entered layout fingerprint
→ slider caused fresh ForceAtlas2
→ unrelated nodes moved

correction:
per-file Size became Sigma render-only
→ 0 layout requests
→ exact node centers preserved
```

Apply the same principle to the global automatic visual-size controls.

---

## 4. Current layout request/fingerprint overstates dependencies

Global mapping currently calculates automatic document `attributes.size` from:

```text
nodeSize
+
referenceDegreeSizeBoost(degree, referenceDegreeSizeInfluence)
```

and edge `attributes.size` from `linkThickness`.

`createGlobalLayoutRequest(...)` includes node `size`.

`globalLayoutFingerprint(...)` currently includes:

```text
full validated GlobalLayoutSettings
+
node key
+
node size
+
folder key
+
edge topology/weight
```

Therefore even visual-only values participate in layout identity despite not changing the current ForceAtlas2/folder-prior physics.

This should be corrected.

---

## 5. Existing renderer seams can support this

Current Sigma Global session already has presentation-only update mechanisms:

```text
updateSettings(...)
Visual Group style refresh
per-file Size override refresh
```

VISUAL1B specifically established that radius changes can refresh Sigma's label/program/picking data without changing Graphology coordinates or submitting a layout.

Reuse/generalize these patterns where appropriate.

Do not invent a second renderer architecture.

---

# Desired semantic classification

Create one authoritative, testable classification based on resolved settings.

## Layout-affecting

These currently change actual automatic positions and therefore may request layout:

```text
folderClustering
folderCohesion
linkForce
withinFolderSpacing
betweenFolderSpacing
```

Also:

```text
spacingPreset
```

is layout-affecting when changing the preset changes any of those resolved spatial values.

The current `withGlobalSpacingPreset(...)` intentionally preserves visual choices while changing the spatial baseline, so a preset change should still relayout.

Product examples:

```text
Folder clustering toggle           → layout
Folder clustering strength         → layout
Compact / Normal / Spacious        → layout
Reference pull                     → layout
Folder separation                  → layout
```

## Visual-only

These must never request Global layout under the current physics:

```text
nodeSize
referenceDegreeSizeInfluence
linkThickness
labelThreshold
```

Product examples:

```text
Base node size                     → render-only
Link influence on node size        → render-only
Link thickness                     → render-only
Label threshold                    → render-only
```

If future code enables size-aware collision physics (`adjustSizes` or equivalent), this contract must be intentionally revisited. Do not silently make visual size layout-affecting today “for future proofing.”

---

# Core invariants

For each visual-only setting change while All + Network is active:

```text
Global layout worker calls          = 0
globalLayoutRequestKey increment    = 0
layout-cache invalidation           = 0
cached position re-application      = 0
Graphology x/y changes              = 0
displayed folder-anchor translation = unchanged
camera state                        = unchanged
selection                           = unchanged
```

The requested visual property itself must update immediately.

For a true layout-setting change:

```text
normal current latest-wins layout path remains active
```

Do not weaken legitimate spatial controls.

---

# 1. Add an explicit layout-vs-visual settings boundary

Add small pure helpers in the most appropriate source-neutral renderer settings layer.

Possible shape:

```ts
interface ResolvedGlobalPhysicsSettings {
  folderClustering: boolean
  folderCohesion: number
  linkForce: number
  withinFolderSpacing: number
  betweenFolderSpacing: number
}

interface ResolvedGlobalVisualSettings {
  nodeSize: number
  referenceDegreeSizeInfluence: number
  linkThickness: number
  labelThreshold: number
}
```

Exact names/types are flexible.

Useful helpers may include equivalents of:

```ts
resolveGlobalPhysicsSettings(settings)
resolveGlobalVisualSettings(settings)
sameGlobalPhysicsSettings(a, b)
```

or a deterministic layout-settings signature.

Requirements:

- one canonical classification;
- no classification duplicated ad hoc in React;
- pure and unit-tested;
- persisted `GlobalLayoutSettings` schema can remain unchanged.

Do not split persistence into multiple records unless repository evidence proves it materially safer. This task should not require a preference schema bump.

---

# 2. Stop app-level explicit relayout for visual changes

Refactor `GraphExplorer.changeGlobalLayoutSettings(...)`.

Current behavior:

```text
any Global setting change in All + Network
→ globalLayoutRequestKey++
```

Required behavior:

```text
previous resolved physics settings
vs
next resolved physics settings
        ↓
different?
  yes → request layout
  no  → do not request layout

always:
→ adopt/save new full preference record
```

Do not compare raw object identity.

Do not key the decision from UI labels/control names.

A user can reach the same settings through:

```text
preset
Advanced control
preference hydration
future UI
```

so the decision must come from the actual resolved physics subset.

---

# 3. Decouple Global layout effect identity from visual settings

Fix the renderer side as well; app-level key gating alone is insufficient.

Current `GlobalGraphCanvas` approximately has:

```text
input = mapProjectionToGlobal(projection, settings)

requestTemplate = createGlobalLayoutRequest(input, settings, ...)

fingerprint = globalLayoutFingerprint(requestTemplate)

layout effect dependencies include:
input
settings
fingerprint
layoutRequestKey
...
```

A visual-only setting change can therefore still wake the layout effect even if the explicit request key stops changing.

Required:

```text
visual-only setting change
→ visual Graphology/Sigma update
→ layout effect does not run
```

Not merely:

```text
layout effect runs
→ finds same cached layout
→ reapplies positions
```

The latter is still unnecessary movement/work and risks camera/anchor side effects.

Create a true **layout semantic identity** based only on:

```text
topology
reference weights used by layout
folder keys
layout-affecting settings
algorithm
iterations
other inputs demonstrably consumed by current layout physics
```

Visual changes must not alter that identity.

---

# 4. Correct the Global layout fingerprint/cache contract

Audit `globalLayoutFingerprint(...)` against what `computeGlobalLayout(...)` actually consumes.

Current likely false dependencies:

```text
node display size
referenceDegreeSizeInfluence
linkThickness
labelThreshold
```

Remove visual-only dependencies from the layout fingerprint.

At minimum prove:

```text
same graph + only Base node size changed
→ same Global layout fingerprint

same graph + only Link influence changed
→ same fingerprint

same graph + only Link thickness changed
→ same fingerprint

same graph + only Label threshold changed
→ same fingerprint
```

And:

```text
Reference pull changed
→ different fingerprint

Folder separation changed
→ different fingerprint

Folder cohesion changed
→ different fingerprint

folderClustering changed
→ different fingerprint

layout spacing baseline changed
→ different fingerprint
```

Do not remove a field merely because it “sounds visual.” Confirm current ForceAtlas2/folder-prior consumption.

---

# 5. Node size in worker request

The current layout request transports node `size`, but current physics do not intentionally consume it.

Choose the smallest safe architecture after inspecting the worker protocol and installed ForceAtlas2 source.

Acceptable approaches include:

### Option A — keep transport, remove semantic dependency

Keep `size` in the worker protocol for compatibility, but:

```text
document clearly that current Global physics ignore it
exclude it from layout identity/fingerprint
do not wake layout when it changes
```

Add a contract test so enabling size-aware physics later requires updating this invariant.

### Option B — remove it from the layout protocol

Only if this is clearly cleaner and does not cause disproportionate schema/worker churn.

Do not perform a broad protocol migration merely for conceptual purity.

Prefer Option A unless repository evidence strongly favors B.

---

# 6. Make Base node size render-only

Changing:

```text
Base node size
```

must update automatic display radius immediately.

It must compose exactly as now with:

```text
reference-degree automatic boost
per-file VISUAL1B multiplier
Focus/hover/selection/group styling
Global LOD label decisions
```

But:

```text
node x/y
folder positions
layout cache
camera
```

must stay unchanged.

Use Sigma's existing indexed radius-refresh path or generalize it safely.

Because radius changes affect:

```text
rendering
label/program data
picking/hit target
```

do not use an insufficient paint-only refresh if Sigma requires reprocessing indices.

VISUAL1B already contains evidence/patterns for this.

---

# 7. Make Link influence on node size render-only

`referenceDegreeSizeInfluence` changes automatic radius as:

```text
Base node size
+
compressed degree boost × influence
```

The reference degree itself comes from current projected topology, which remains unchanged by moving the slider.

Required:

```text
slider
→ recompute displayed automatic sizes
→ refresh affected document nodes
→ 0 ForceAtlas2
```

Preserve:

```text
0%   → no degree boost
50%  → legacy/default curve
100% → current strong curve
```

Do not change the formula/ranges.

If all document nodes need refreshing because this is a global visual rule, that is acceptable. The important contract is:

```text
visual recomputation
≠ layout worker
```

Avoid O(N²) work.

---

# 8. Make Link thickness render-only

Changing:

```text
Link thickness
```

must update rendered edge width immediately.

No layout, positions, camera, folder anchors, query, or history changes.

Keep current formula:

```text
global thickness
× current reference-count compression
× current LOD / arrangement emphasis
```

Do not change edge semantic weight used by ForceAtlas2.

Important distinction:

```text
referenceCount / layout edge weight
≠ displayed link thickness
```

Test that visual thickness changes do not change worker edge weights or layout fingerprint.

---

# 9. Keep Label threshold render-only

This is already conceptually a renderer setting.

Changing:

```text
Label threshold
```

must only affect label visibility thresholds/refresh.

It must never trigger layout or graph-coordinate reconciliation.

Preserve:

```text
small-network always-label rule
hover/selection force-label behavior
LOD behavior
arrangement behavior
```

---

# 10. Preserve legitimate layout settings

Do not overcorrect.

These should still request automatic layout as before:

```text
Folder clustering on/off
Folder clustering strength
Spacing preset
Reference pull
Folder separation
within-folder spatial baseline where changed
```

Preserve:

```text
latest-wins worker behavior
cache behavior for true layout changes
folder-prior algorithms
SPATIAL1A/1B automatic-position + displayed-offset separation
```

Rapid dragging of a true layout slider may continue to submit/supersede layout work according to current policy.

This task is not about redesigning that interaction cadence.

---

# 11. SPATIAL1B compatibility

Current All Network can have persisted/manual folder-cluster translations layered on top of automatic layout.

Visual-only changes must preserve both:

```text
automatic base x/y
+
current spatial override / arrangement preview
```

exactly.

Test with a non-zero folder override:

```text
change Base node size
→ cluster center unchanged

change Link influence
→ cluster center unchanged

change Link thickness
→ cluster center unchanged

change Label threshold
→ cluster center unchanged
```

Do not clear or renormalize folder anchors.

Do not exit Arrange Folders mode simply because a visual slider changes.

---

# 12. VISUAL1B compatibility

Per-file Size remains:

```text
display-only multiplier over current automatic Network size
```

After this task:

```text
global Base node size
+
global degree influence
→ automatic displayed size
×
per-file sizeScale
→ final displayed size
```

All of it remains presentation-only.

Changing global Base size must not erase per-file multipliers.

Changing degree influence must not erase per-file multipliers.

Changing a per-file multiplier must remain 0-layout.

Do not change the presentation-overrides persistence schema.

---

# 13. Visual Groups compatibility

Visual Groups remain style-only.

The final reducer composition should continue to support:

```text
automatic global radius
× optional per-file multiplier

+
Visual Group accent
+
hover/selection
+
arrangement emphasis
+
LOD
```

No Visual Group query recompile or graph projection should occur for the four visual sliders.

---

# 14. Camera stability

A visual-only slider must not:

```text
Fit
center
change camera ratio
change camera x/y
restore an old viewport
```

This includes when the graph contains only a few nodes.

Do not couple this task to SPACING1B's Focus camera-framing work.

All + Network camera state should remain byte-for-byte/equivalent where practical during visual slider changes.

---

# 15. No graph-history checkpoint

These settings are preferences, not semantic graph navigation.

Preserve current behavior:

```text
no Back/Forward graph history entry
```

Do not introduce graph history for visual or layout preferences.

---

# 16. Persistence compatibility

Keep the existing Graph Preferences record/schema unless a migration is genuinely required.

After reload, all controls must retain their current values.

No new external storage key is needed for this task.

Do not accidentally reset custom values when changing presets; preserve the existing `withGlobalSpacingPreset(...)` behavior where visual choices remain independent.

---

# 17. Instrumentation / operation contracts

Add or strengthen operation-level tests.

Desired visual operations:

```text
Base node size change
projection                0
workspace work            0
global layout requests    0
position applications     0
camera requests           0
visual refresh            >= 1 as needed

Degree-size influence
same

Link thickness
same

Label threshold
same
```

Desired layout operations:

```text
Reference pull
global layout requests    current expected behavior

Folder separation
same

Folder strength/toggle
same

Spacing preset
same
```

If current instrumentation does not expose position-apply/cache counters, use deterministic layout service/session doubles and exact x/y assertions rather than adding broad telemetry.

---

# 18. Rapid-slider regression

The original problematic user interaction is continuous slider movement.

Test sequences such as:

```text
Base node size
4.0
4.25
4.5
...
9.0
```

and:

```text
Link influence
0
10
...
100
```

Required:

```text
0 extra Global layout worker calls
all graph node centers unchanged
camera unchanged
visual state reaches final value
```

Also test rapid Link thickness and Label threshold changes.

Do not debounce correctness away. Immediate visual feedback should remain.

---

# 19. Layout-slider control case

Use the same test harness to prove the distinction is real.

Example:

```text
Reference pull
1.00 → 1.15
→ layout request occurs

Base node size
4.50 → 6.50
→ no layout request
```

This prevents a future refactor from making **all** settings inert.

---

# 20. Zero / one / small / large graph cases

Test visual-only changes with:

```text
0 nodes
1 node
small 3-node graph
normal synthetic sample
larger benchmark graph
```

No crashes, stale refresh targets, or spurious layout work.

This matters because visual refresh paths often behave differently on empty/very small Sigma graphs.

---

# 21. Layout failure state

If the last true automatic layout failed and the renderer is showing the last valid positions, changing a visual-only slider should still update appearance without retrying layout.

Do not use a visual change as an implicit worker retry.

Explicit/legitimate layout actions retain current recovery behavior.

---

# Likely implementation areas

Inspect current code before editing.

Probable areas:

```text
packages/renderer-sigma/src/settings.ts
packages/renderer-sigma/src/settings.test.ts

packages/renderer-sigma/src/mapping.ts
packages/renderer-sigma/src/style.ts
packages/renderer-sigma/src/session.ts

packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/layout.test.ts
packages/renderer-sigma/src/interaction-contract.ts
packages/renderer-sigma renderer/canvas regression tests

packages/renderer-sigma/src/GlobalGraphCanvas.tsx

apps/web/src/components/GraphExplorer.tsx
apps/web/src/exploration-model.ts
apps/web related tests

possibly GraphSettings tests, but the visible control layout should not need redesign
```

Do not touch Local/Focus renderer files unless a shared type/helper requires a very small neutral change.

Do not modify SPACING1B's unmerged branch/worktree.

---

# Preferred implementation direction

The exact refactor is Codex's decision after inspecting current code, but aim for this ownership model:

```text
GlobalLayoutSettings persisted object
        │
        ├── resolve physics subset
        │      ↓
        │   Global layout semantic key
        │      ↓
        │   worker/cache/positions
        │
        └── resolve visual subset
               ↓
            Sigma node/edge reducers/settings
               ↓
            repaint/reprocess only
```

Avoid:

```text
one giant settings object
→ every consumer invalidated on every field
```

This is the core architectural cleanup.

---

# Avoid a misleading partial fix

The task is **not complete** if it only changes:

```text
GraphExplorer
→ stop incrementing globalLayoutRequestKey
```

while `GlobalGraphCanvas` still wakes its layout effect because `input/settings/requestTemplate` changed and then reapplies a cached layout.

Likewise it is incomplete if the worker stops running but:

```text
same cached positions are reapplied
camera/anchors are disturbed
```

The visual path should stay entirely outside layout execution.

---

# Scope

## In scope

- classify Global settings into physics/layout vs visual;
- pure resolved-subset helpers/signature;
- gate explicit relayout by actual physics changes;
- remove visual-only values from layout identity/fingerprint;
- prevent Global layout effect from executing on visual-only changes;
- make Base node size render-only;
- make degree-size influence render-only;
- make link thickness render-only;
- keep label threshold render-only;
- preserve layout controls;
- preserve per-file Size;
- preserve Visual Groups;
- preserve SPATIAL1B folder offsets/Arrange mode;
- preserve persistence;
- focused/full automated validation;
- browser/native graphical regression as appropriate;
- prompt archive;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement or redesign:

```text
SPACING1B Focus density camera framing
ForceAtlas2 parameter tuning
Focus Network spacing
node-size-aware collision physics
adjustSizes
new collision algorithm
custom ForceAtlas2 fork
new settings controls/ranges
new presets
new per-file Size semantics
folder anchor behavior
Arrange Folders behavior
QUERY1
Network Explorer
Hierarchy
Saved Views
KG14B4
desktop security/release work
```

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Re-check PR #60 / other open PRs.
3. Inspect current installed ForceAtlas2 behavior and confirm node display size is not physics input.
4. Add pure physics-vs-visual settings helpers/tests.
5. Refactor GraphExplorer relayout gating to compare physics settings only.
6. Refactor GlobalGraphCanvas layout semantic identity/effect so visual changes cannot execute layout/cache-position paths.
7. Correct Global layout fingerprint dependencies.
8. Route Base node size through render-only update.
9. Route degree-size influence through render-only update.
10. Route link thickness through render-only update.
11. Confirm Label threshold remains render-only.
12. Preserve SPATIAL1B offsets/arrangement.
13. Add operation-count/exact-position regressions, preferably reusing the VISUAL1B hook/session test patterns.
14. Add explicit layout-control counterexamples.
15. Run focused renderer/web tests.
16. Run Global renderer benchmark; do not create new timing thresholds.
17. Run production browser graphical smoke:
    - move each Visual slider;
    - confirm appearance changes;
    - confirm nodes do not move.
18. Build/run release desktop smoke if current repository gate requires it.
19. Update closest architecture/renderer docs.
20. Archive this exact prompt under `history-implementations/`.
21. PR → CI → merge → post-merge CI → cleanup.
22. Stop. Do not start unrelated work.

---

# Validation

Use current repo equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Task-specific automated oracle:

```text
Initial All + Network
→ settle one layout

Base node size sequence
→ 0 additional worker calls
→ all x/y unchanged

Link influence sequence
→ 0 additional worker calls
→ all x/y unchanged

Link thickness sequence
→ 0 additional worker calls
→ all x/y unchanged

Label threshold sequence
→ 0 additional worker calls
→ all x/y unchanged

Reference pull change
→ worker/layout path still executes

Folder separation change
→ worker/layout path still executes
```

Also verify:

```text
layout fingerprint:
visual-only changes → identical
physics changes     → different
```

and:

```text
spatial override / folder arrangement:
visual changes → displayed cluster coordinates unchanged
```

---

# Manual graphical QA

Use a graph where node movement is easy to notice.

Recommended:

```text
All + Network
wait for layout to settle
pick 2–3 connected nodes and one isolated node
```

Then, one at a time:

```text
Base node size
→ drag from low to high
→ nodes visibly resize
→ centers must remain fixed

Link influence on node size
→ drag 0 → 100
→ connected/high-degree nodes resize
→ centers fixed

Link thickness
→ drag low → high
→ edges thicken only
→ centers fixed

Label threshold
→ drag range
→ label visibility changes only
→ centers fixed
```

Then verify:

```text
Reference pull
→ positions are allowed/expected to change

Folder separation
→ folder positions are allowed/expected to change
```

With a manual folder arrangement/offset active:

```text
repeat Visual sliders
→ arranged folder position remains fixed
```

No console errors/warnings introduced.

---

# Exit gate

GLOBALVIS1 is complete only when:

1. there is one tested authoritative physics-vs-visual settings classification;
2. persisted preference compatibility is preserved;
3. Base node size is visual-only;
4. degree-size influence is visual-only;
5. Link thickness is visual-only;
6. Label threshold is visual-only;
7. Folder clustering toggle remains layout-affecting;
8. Folder strength remains layout-affecting;
9. spacing preset remains layout-affecting where spatial values change;
10. Reference pull remains layout-affecting;
11. Folder separation remains layout-affecting;
12. visual-only changes do not increment explicit Global layout request generation;
13. visual-only changes do not execute the Global layout effect;
14. visual-only changes do not invalidate the layout cache;
15. visual-only changes do not reapply cached positions;
16. visual-only changes produce 0 layout worker calls;
17. graph x/y are exactly/equivalently unchanged after visual slider sequences;
18. camera state is unchanged;
19. selection is unchanged;
20. spatial override/Arrange Folder displayed coordinates are unchanged;
21. Base node size updates displayed radius correctly;
22. Base node size still composes with degree influence;
23. Base node size still composes with per-file VISUAL1B multiplier;
24. degree influence formula/range is unchanged;
25. Link thickness formula/range is unchanged;
26. link thickness does not alter layout edge weight;
27. Label threshold LOD/force-label behavior remains correct;
28. Visual Groups still compose;
29. hover/selection styling still composes;
30. arrangement emphasis still composes;
31. empty/single/small graph cases are safe;
32. layout-failure state can still receive visual updates without retrying worker;
33. true layout changes still run the existing worker path;
34. layout fingerprint changes only for actual layout-semantic changes/topology;
35. no size-aware collision physics is introduced;
36. no ForceAtlas2 settings change;
37. no SPACING1B behavior is copied/modified;
38. PR #60 branch/worktree remains untouched;
39. no new external dependency is added;
40. focused tests pass;
41. full `pnpm check` passes;
42. renderer benchmarks pass without unexplained regression;
43. desktop check/build pass if required by current repo gate;
44. browser graphical QA confirms zero node movement for Visual sliders;
45. PR CI passes;
46. post-merge CI passes;
47. current `AGENTS.md` content is preserved;
48. unrelated user files/worktrees remain untouched;
49. prompt is archived;
50. task branch/worktree cleanup completes.

---

# Documentation

Update only the closest useful docs, likely renderer/settings architecture.

Document the distinction clearly:

```text
Global Network layout controls
→ automatic coordinate computation

Global Network visual controls
→ Sigma presentation only
→ do not invalidate automatic layout
```

State that current ForceAtlas2 has no size-aware collision contract, so automatic node radius is intentionally excluded from layout identity.

Do not rewrite historical implementation notes.

---

# Final report

Report concisely:

## 1. Result

Which settings are now layout vs visual.

## 2. Root cause

Why visual sliders previously triggered layout.

## 3. New ownership boundary

Show:

```text
persisted settings
├ physics subset → layout
└ visual subset  → Sigma refresh
```

## 4. Layout fingerprint/cache

What was removed from layout identity and why.

## 5. Visual update paths

- Base size
- degree influence
- link thickness
- label threshold

## 6. Compatibility

- VISUAL1B
- Visual Groups
- SPATIAL1B
- arrangement mode
- graph preferences

## 7. Operation evidence

For each Visual control:

```text
worker requests: 0
position changes: 0
camera changes: 0
```

and show a true layout control still produces layout work.

## 8. Tests / benchmarks / graphical QA

## 9. Files changed / dependencies

Expected external additions: zero.

## 10. Concurrency

State PR #60 status and confirm it was untouched/rebased around correctly.

## 11. Follow-up

Do not automatically start any next task.
