# FLICKER1 — Atomic Network Relayout/Query Commits + Extended Density Tuning

**Task type:** rendering bug fix + camera/normalization transaction refactor + QA/tuning extension

## Goal / success outcome

Fix the visible Network flicker that occurs when a one-shot graph/layout change commits, while preserving the camera-ownership behavior added by SPACING1B.

Observed native behavior in the current PR #60 executable:

```text
change Folder clustering
change Folder clustering strength
change Reference pull
change Folder separation
change Spacing
apply a query / change visible topology
        ↓
graph briefly jumps toward a corner / wrong viewport
        ↓
then snaps back to the previous intended camera
```

The final camera is usually correct. The problem is the **intermediate visible frame**.

The desired behavior is:

```text
old graph + old user viewport
        ↓
compute new layout/topology
        ↓
commit new graph normalization + corrected camera as one visible transition
        ↓
new graph appears directly in the preserved viewport
```

There must be no visible frame where Sigma renders the changed graph with stale camera coordinates.

This pass should also extend the transient Network Density Sandbox control to allow stronger-than-Auto tuning, so native QA can determine whether the accepted automatic density correction should later be strengthened.

Success means:

1. All Network physics/layout changes no longer produce the top-left/snap-back flicker.
2. Query/topology changes no longer produce that flicker when a stable surviving semantic anchor exists.
3. Focus Network retains equivalent no-flicker anchoring.
4. User pan/zoom/history ownership still cannot be stolen by layout/topology completion.
5. All/Focus Density sliders support `0–150%`, with `100% = current Auto` and `>100% = deliberate stronger Sandbox preview`.
6. No density or camera-preservation change enters ForceAtlas2/layout identity.
7. PR #60 remains draft/unmerged until native QA.

---

# Current evidence

Repository:

```text
lillo24/icarus-graph-explorer
```

Existing task branch / PR:

```text
PR #60
title: SPACING1B: density-aware Network camera framing
branch: codex/spacing1b-density-camera
head at plan-writing time:
3a3a6748f65ce64ef849ac9063d6f782ba76d310

base recorded by GitHub at plan-writing time:
283758705fbdb39ae27058ab99bbd1fc69171ce4
```

PR #60 is still:

```text
OPEN
DRAFT
UNMERGED
```

The current GitHub metadata reports it as not presently mergeable, so **sync/integrate latest `main` and inspect conflicts/staleness before implementation**. Do not assume the earlier native handoff's `CLEAN` status is still current.

## Relevant SPACING1B behavior already working

PR #60 currently has:

```text
All + Network density framing
Focus + Network density framing

separate transient A/B strengths
camera ownership: auto | user
density-aware Fit
restored viewport protection
query/topology protection
Pull/fixed-placement protection
temporary QA diagnostics
```

Native QA has now confirmed that the density controls visibly work in both All and Focus.

Do not discard that behavior while fixing flicker.

---

# Strong flicker evidence from current code

The likely failure mode is a **transaction-order race around Sigma normalization and camera restoration**.

The renderer currently does the conceptual sequence:

```text
capture old screen anchor
        ↓
mutate Graphology topology/coordinates
        ↓
Sigma notices graph mutation and can schedule processing
        ↓
register / wait for afterProcess
        ↓
correct camera against the new normalization
```

This is vulnerable because the graph mutation itself can invalidate Sigma and schedule its next process/render before the camera-correction transaction is fully armed.

The end result matches the native symptom:

```text
new extent + old camera
→ transient wrong frame
→ afterProcess anchor repair
→ intended frame
```

## Local helper already states the intended invariant

`packages/renderer-sigma/src/local-lifecycle.ts` currently documents the correct intent: reposition the camera after Sigma recomputes graph normalization but before it draws the changed graph, because waiting until afterRender exposes a stale-camera frame.

That invariant is correct.

However, both topology and coordinate mutation paths still need to be audited for whether the `afterProcess`/`afterRender` hooks are armed **before the graph mutation can schedule processing**.

Do not assume current helper usage is race-free merely because the repair runs in `afterProcess`.

## Global PR #60 changes are especially suspicious

PR #60 added camera-preservation code around Global:

```text
GlobalRendererSession.update(...)
GlobalRendererSession.applyPositions(...)
```

including:

```text
capture viewport anchor
mutate topology / positions
afterProcess → anchorNodeAtViewport(...)
```

This is exactly the area implicated by the native flicker.

The bug is not "wrong final camera"; it is "wrong first frame, then repaired final camera."

---

# Important behavior that is NOT a bug

The following existing controls remain intentionally **All Network only**:

```text
Folder clustering
Folder clustering strength
Spacing
Reference pull
Folder separation
All Network visual controls
```

`Reference pull` doing nothing in Focus Network is therefore expected.

Do **not** make Reference pull or the other All physics controls affect Focus in this task.

Keep the Sandbox scope labels clear.

---

# Scope / non-scope

## In scope

- Continue on PR #60.
- Integrate current `main` first.
- Reproduce the flicker deterministically.
- Trace exact Graphology → Sigma event/render order.
- Fix the first-visible-frame race for:
  - Global coordinate/layout commits;
  - Global query/topology reconciliation;
  - Global dynamic Pull/fixed-position commits if they share the same path;
  - Local/Focus equivalents where the same race exists.
- Preserve a stable semantic screen anchor atomically across normalization changes.
- Improve anchor selection for topology changes where the previous nearest anchor may disappear.
- Add frame-level regression tests proving no stale-camera frame is rendered.
- Extend All and Focus Density Sandbox strengths from `0–100%` to `0–150%`.
- Keep `100%` exactly equal to the currently accepted automatic policy.
- Produce fresh native QA executable.
- Keep temporary diagnostics during QA.
- Keep PR #60 draft/unmerged.

## Non-scope

Do not:

- redesign ForceAtlas2;
- change ForceAtlas2 gravity/scaling;
- make All physics controls apply to Focus;
- change QUERY1 semantics;
- change Network Explorer behavior;
- change Visual Group semantics;
- change folder Pull semantics;
- change fixed folder-placement persistence;
- animate node coordinates just to hide the flicker;
- solve flicker by arbitrary delays/timeouts;
- solve flicker by globally fading/hiding the canvas unless direct Sigma evidence proves no proper atomic transaction is possible;
- merge PR #60 automatically;
- retune the raw automatic density formula yet.

The density extension is a **Sandbox measurement tool** for deciding a later final default.

---

# Implementation guidance

## 1. Integrate latest main before diagnosis

First:

```text
inspect AGENTS.md
inspect worktrees/branches
fetch latest main
integrate latest main into codex/spacing1b-density-camera
resolve conflicts preserving newer behavior
run focused smoke before editing
```

Pay particular attention to any newer work touching:

```text
GlobalGraphCanvas.tsx
LocalGraphCanvas.tsx
session.ts
local-session.ts
GraphExplorer.tsx
layout/spatial reconciliation
temporary file movement
HIER/MOVE work
```

Do not resolve conflicts by restoring older PR #60 versions over newer main behavior.

---

## 2. Reproduce the flicker as a frame-order bug before fixing it

Do not immediately patch `afterProcess`.

Build a deterministic development/browser harness that records the actual first frames around a mutation.

### Required operations

At minimum reproduce:

```text
All:
- Folder clustering on/off
- Folder clustering strength change
- Reference pull change
- Folder separation change
- Compact ↔ Normal ↔ Spacious
- query that removes/adds visible nodes
- Hide File / Hide Folder if it uses the same projection path
- dynamic Pull adoption
- fixed folder-placement adoption

Focus:
- query/topology change
- depth change
- accepted Local layout position change
```

The user-facing symptom is especially strong in All Network, so Global reproduction is mandatory.

### Frame trace

For every operation capture:

```text
event sequence
Graphology mutation time
Sigma scheduled processing
beforeProcess if available
afterProcess
beforeRender if available
afterRender

camera:
x
y
ratio
angle

chosen semantic anchor key/entity
anchor viewport x/y
graph dimensions / normalized extent where available
```

Do not log private vault titles or paths.

Use synthetic fixture identifiers.

The key question is:

> Does any `afterRender` occur after the graph extent changed but before the preserved-anchor camera correction was applied?

If yes, quantify it.

---

## 3. Add a first-frame correctness regression test

Tests that only inspect the **final** camera are insufficient; current final state already looks correct.

Add a regression harness whose contract is:

```text
given:
user-owned camera
stable semantic anchor A
graph/layout change

then:
every rendered frame after the mutation begins
must place A at the intended viewport position
within tolerance
```

Recommended tolerance:

```text
<= 1 px
```

or the smallest stable tolerance supported by Sigma's Float32/render pipeline.

At minimum assert:

```text
no rendered frame exists with a large transient anchor displacement
```

The test must fail on the current buggy ordering before the fix.

### Visual-frame evidence

If practical, expose a deterministic dev-only trace such as:

```text
frame 0: old anchor px
frame 1: first changed-graph frame anchor px
frame 2: settled frame anchor px
```

Before fix, the fixture should show the transient displacement.

After fix:

```text
first changed-graph frame == settled anchored frame
```

within tolerance.

---

## 4. Arm the camera-restoration transaction before graph mutation

The preferred architectural correction is:

```text
capture old semantic screen anchor + ratio
        ↓
ARM first afterProcess correction
ARM matching afterRender completion
        ↓
mutate Graphology / coordinates
        ↓
Sigma processes new normalization
        ↓
afterProcess:
compute corrected camera against new graph dimensions
        ↓
Sigma draws
        ↓
first visible changed frame is already correct
```

The important invariant is:

> The first Sigma process caused by the mutation must already have the matching camera-restoration callback registered.

Do not register the correction after the mutation if Graphology events can already schedule processing.

### Preferred helper shape

Inspect the current Local lifecycle helper and either evolve it or create a source-neutral Sigma helper conceptually like:

```ts
atomicAnchoredGraphMutation({
  capture,
  armAfterProcess,
  armAfterRender,
  mutate,
  restore,
  ensureRefresh,
})
```

Exact API/name is flexible.

It should make the ordering difficult to misuse.

Prefer one shared renderer-level transaction primitive if Global and Local need the same lifecycle semantics.

Do not force unrelated renderer logic into a generic abstraction merely for symmetry.

---

## 5. Audit automatic Graphology-triggered Sigma refreshes

Determine exactly which Graphology mutations automatically cause Sigma to schedule refresh/process:

```text
updateEachNodeAttributes
add/drop nodes
add/drop edges
reconcile helpers
setGraph
partial coordinate mutation paths
```

For each relevant mutation path decide whether:

```text
A. mutation-triggered Sigma scheduling is authoritative
or
B. application explicitly schedules one refresh
```

Avoid accidentally producing:

```text
automatic refresh
+
explicit refresh
=
two process/render cycles
```

if only one is required.

A successful fix should not merely put the camera repair before one of two redundant renders while leaving another stale render possible.

---

## 6. Make Global `applyPositions()` atomic

Audit the current PR #60 `GlobalRendererSession.applyPositions()` carefully.

Current conceptual responsibilities include:

```text
validate positions
capture anchor
write all x/y
measure density
preserve user camera OR apply auto density camera
refresh Sigma
```

Refactor so:

1. current anchor state is captured from the old displayed frame;
2. first-process correction is armed;
3. coordinates are committed;
4. density decision is based on the confirmed new positions;
5. during the first process of those positions:
   - if user-owned: preserve old anchor + old ratio;
   - if auto-owned: apply density-aware automatic camera;
6. only then may the changed graph render.

There must not be an intermediate visible `ratio=old, normalization=new` frame.

### No-change path

If positions are identical:

```text
do not create a fake transaction
do not force an unnecessary render
```

unless auto density framing genuinely changed.

---

## 7. Make Global topology/query reconciliation atomic

Audit `GlobalRendererSession.update()`.

Queries can:

```text
add nodes
remove nodes
add/remove edges
change graph extent
change nearest-to-center node
```

Before mutation, choose an anchor that is meaningful in both old and new topology.

### Surviving-anchor policy

Preferred priority:

```text
1. selected node, if it survives in the incoming graph
2. current semantic/history anchor, if explicitly known and survives
3. nearest-to-viewport-center node among nodes that survive the incoming graph
4. deterministic fallback only if no current node survives
```

Do not choose an anchor first and discover only after reconciliation that it was removed if a stable surviving candidate was available.

This is especially important for query changes.

### If no node survives

If the new projection has no common node with the old projection, exact anchor preservation is impossible.

In that case:

- do not invent a fake semantic relationship;
- use the existing product camera policy for a genuinely replaced scene;
- document/test the behavior;
- still avoid an invalid transient corner frame.

---

## 8. Audit Global dynamic Pull and fixed-position composition

PR #60 now measures density on final displayed positions after:

```text
automatic layout
→ dynamic Pull
→ fixed folder placement
```

Each confirmed coordinate adoption that calls `applyPositions()` should inherit the atomic camera transaction automatically.

Required cases:

```text
automatic ForceAtlas2 result
dynamic Pull result
fixed placement composition
Pull + fixed composition
confirmed Arrange Folders commit
```

### Live Arrange preview

Keep the existing rule:

```text
live pointer/keyboard preview
→ user owns interaction
→ density must not fight camera
```

Do not add density recentering during every drag frame.

If live sparse position preview currently bypasses `applyPositions()`, verify it does not expose the same stale-normalization flicker. If it does, fix with the narrowest appropriate path without slowing pointer movement.

---

## 9. Audit Local/Focus for the same ordering race

Local currently has a helper explicitly intended to correct the camera during `afterProcess`.

Still test whether its callbacks are armed before or after:

```text
reconcileLocalGraph(...)
updateEachNodeAttributes(...)
```

If Local has the same theoretical race, fix it in the same pass even if the native symptom is less obvious.

Do not change the established Focus semantic anchor policy unnecessarily:

```text
selected node
otherwise Focus root
```

For query/depth transitions, preserve root/selected screen position when that anchor survives.

---

## 10. Do not replace the flicker with animation

A ForceAtlas2 or topology update may legitimately cause nodes to move.

That final movement is not the bug.

The bug is:

```text
camera/normalization transient
```

Do not add:

```text
CSS fade
camera animation
node tween
timeout
debounce delay
```

as a masking strategy.

Expected one-shot layout behavior can remain an immediate geometry replacement, but the viewport must remain stable.

---

# Density tuning extension

## 11. Extend All and Focus Density sliders to 150%

Native QA indicates the current `100%` automatic framing is useful but the user would like to test a stronger correction.

Do **not** immediately redefine the accepted automatic policy.

Instead extend both Sandbox controls:

```text
0% ───────────── 100% ───── 150%
Legacy              Auto       Stronger
```

Meaning:

```text
0%   = legacy ratio 1
100% = exact current SPACING1B automatic decision
150% = 1.5× the correction away from ratio 1
```

Use the same interpolation:

```text
effectiveRatio =
1 + (rawDecisionRatio - 1) * strength / 100
```

Examples:

```text
raw decision = 1.40

0%   -> 1.00
100% -> 1.40
125% -> 1.50
150% -> 1.60
```

and:

```text
raw decision = 0.70

0%   -> 1.00
100% -> 0.70
150% -> 0.55
```

This remains within Sigma's much wider camera limits and is acceptable as a transient Sandbox experiment, but validate the full raw bound range.

### Defaults

Keep application-launch defaults at:

```text
All Density   = 100%
Focus Density = 100%
```

Do not silently change product automatic behavior yet.

### Labels

Make the UI semantics explicit:

```text
Legacy | Auto | Stronger
```

so `150%` is not mistaken for "150% node density" or a raw camera ratio.

---

## 12. Extended-density camera behavior

Changing 100→150 must remain:

```text
camera-only
no layout request
no Pull request
no fingerprint/cache change
no persistence
```

Live preview preserves the current semantic screen anchor, exactly as existing density preview does.

The extended slider itself must not introduce flicker.

Add the slider-preview operation to the first-frame regression harness.

---

## 13. Do not change Reference pull scope

Explicitly preserve:

```text
Reference pull = All Network physics control
```

It should continue to cause a genuine Global relayout when changed in All.

It should continue to do nothing to Focus layout.

The flicker fix should make the **All relayout commit** clean; it should not broaden the control's scope.

---

# Validation

## A. Frame-order unit/integration tests

Add tests that prove event ordering rather than only final state.

Required invariant:

```text
anchor correction callback is armed
BEFORE
the graph mutation can trigger Sigma processing
```

Test both:

```text
Global topology mutation
Global position mutation
Local topology mutation
Local position mutation
```

where relevant.

---

## B. First-visible-frame tests

For user-owned camera:

```text
old anchor position = P

perform mutation

first rendered changed frame anchor = P ± tolerance
final rendered frame anchor = P ± tolerance
```

No large intermediate displacement.

Test at least:

```text
layout position replacement
query removes unrelated nodes
query adds nodes
query removes current-nearest node but another survivor exists
folder clustering physics relayout
reference pull relayout
folder separation relayout
dynamic Pull adoption
fixed placement adoption
```

---

## C. Auto-owned camera tests

When camera is auto-owned:

```text
new confirmed geometry
→ first visible frame already uses the new density-aware automatic ratio
```

There must not be:

```text
ratio 1 transient
→ density ratio
```

unless ratio 1 is the intended effective ratio.

---

## D. User ownership regression

Verify the existing SPACING1B promise remains true:

```text
manual pan/zoom
→ layout/query/topology/Pull/fixed update
→ camera ratio and semantic screen anchor preserved
```

Also:

```text
restored viewport
→ same preservation
```

Fit still intentionally resets ownership to auto.

---

## E. Query anchor survival

Test:

```text
selected node survives
selected node removed
nearest center node survives
nearest center node removed but another old node survives
no old nodes survive
empty projection
```

For every case, behavior must be deterministic and documented.

---

## F. Density 0–150 tests

For both Global and Local framing helpers:

```text
0%   -> 1
50%  -> midpoint
100% -> raw decision
125% -> 1.25× correction
150% -> 1.5× correction
```

Test raw decisions:

```text
0.7
0.93
1.0
1.19
1.4
```

Reject:

```text
< 0
> 150
NaN
Infinity
```

unless implementation chooses central clamping instead of validation; whichever policy is chosen must be explicit and tested.

---

## G. No layout side effects from density

Moving either density slider across:

```text
0
50
100
125
150
```

must create:

```text
0 ForceAtlas2 requests
0 dynamic Pull requests
0 spatial writes
0 layout fingerprint changes
```

---

## H. Existing All physics behavior

After flicker fix verify these still genuinely alter All layout:

```text
Folder clustering on/off
Folder clustering strength
Compact/Normal/Spacious
Reference pull
Folder separation
```

The final geometry should change when expected.

Only the transient camera jump should disappear.

---

## I. Focus scope behavior

Verify:

```text
Reference pull
Folder clustering
Folder separation
All spacing controls
```

still do not alter Focus layout.

This is expected and should be documented in QA so it is not misreported as another bug.

---

# Performance

The fix must not create an expensive extra render/process cycle for every mutation.

Instrument or test:

```text
process count
render count
layout request count
density measurement count
```

before vs after.

Target:

```text
one authoritative changed-graph process/render transaction
```

where possible.

Avoid a solution that fixes flicker by doing two full synchronous Sigma refreshes.

Run current relevant benchmarks:

```bash
pnpm benchmark:local-renderer
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm analyze:focus-spacing
pnpm analyze:network-spacing
```

Add a small transaction/frame benchmark only if useful.

---

# Browser QA

Create a production-browser graphical QA sequence that exercises:

```text
All:
- manual pan/zoom
- Reference pull change
- Folder clustering strength change
- Folder clustering toggle
- Folder separation change
- spacing preset change
- query apply
- query clear
- dynamic Pull/fixed placement where harness supports them

Focus:
- manual pan/zoom
- query/depth change

Density:
- 0 -> 100 -> 150
```

For the layout/query cases, inspect frame trace or screenshot/video-equivalent harness evidence, not merely the final state.

Console must remain clean.

---

# Native graphical QA

Build a fresh optimized `.exe` and provide exact path + SHA-256.

PR #60 must remain draft.

## 1. Original flicker case

In All + Network:

```text
manually pan/zoom
move Reference pull once
```

Expected:

```text
nodes change to the new layout
camera does NOT flash toward top-left
no snap-back
```

## 2. Other physics controls

Repeat one-shot changes:

```text
Folder clustering on/off
Folder clustering strength
Folder separation
Compact/Normal/Spacious
```

No corner flash / snap-back.

## 3. Query

Apply and clear a query while manually zoomed.

If a visible semantic anchor survives:

```text
its screen position should stay stable
```

and no transient wrong frame should appear.

## 4. Focus regression

In Focus + Network:

```text
manual pan/zoom
change depth/query
```

No transient viewport flash.

## 5. Density stronger preview

Test:

```text
All Density:
0 -> 100 -> 125 -> 150

Focus Density:
0 -> 100 -> 125 -> 150
```

The visual effect should increase continuously beyond Auto.

No layout movement should occur from the density slider itself.

Report which strength looks best for:

```text
sparse All
dense All
sparse Focus
```

Do not yet bake that preference into the raw policy.

## 6. History / Fit

Verify:

```text
Back / Forward
restored viewports
Fit
```

still behave correctly after the transaction refactor.

---

# Diagnostic cleanup decision

Keep current temporary density diagnostics visible for this QA pass.

If useful, add a temporary **frame transaction diagnostic** only in development/native QA builds, such as:

```text
last transition:
layout | topology | pull | fixed

first-frame anchor error:
0.3 px

processes:
1

renders:
1
```

Do not add this if it requires large product/UI coupling.

No permanent debug dashboard.

---

# Likely implementation areas

Inspect actual current branch after integrating main.

Likely relevant:

```text
packages/renderer-sigma/src/local-lifecycle.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/GlobalGraphCanvas.tsx

packages/renderer-sigma/src/*lifecycle*.test.ts
packages/renderer-sigma/src/*density-framing*.ts
packages/renderer-sigma/src/*density*.test.ts
packages/renderer-sigma/src/sigma-test-renderer.ts

apps/web/src/components/GraphSettings.tsx
apps/web/src/components/GraphSettings.test.tsx
apps/web/src/preferences/sandbox-settings.ts

docs/SPACING1B_NETWORK_DENSITY.md
docs/PERFORMANCE.md
history-implementations/
```

A new shared helper such as:

```text
packages/renderer-sigma/src/anchored-refresh.ts
```

is reasonable if it genuinely removes duplicate/racy lifecycle code.

Do not create a broad abstraction if a narrow ordering fix is clearer.

---

# Documentation

Update the relevant architecture/performance/density docs to state the invariant:

```text
When a renderer-owned graph mutation changes Sigma normalization while a
semantic viewport is being preserved, the matching camera correction is armed
before the mutation and applied during the first post-mutation process, before
the first visible changed-graph frame.
```

Document that:

```text
100% density = automatic policy
101–150% = Sandbox-only amplification
```

Do not describe >100% as production automatic behavior.

Archive this prompt exactly under:

```text
history-implementations/FLICKER1_atomic_network_relayout_camera_transaction_density_150_codex_prompt.md
```

---

# Merge gate

Do not merge PR #60.

This pass is complete only when:

```text
native All flicker: PASS
native Focus flicker: PASS
query flicker: PASS
density 150 preview: PASS
camera ownership: PASS
history/Fit: PASS
CI: PASS
```

Then report results and wait for explicit user acceptance.

The next decision after this QA will be:

```text
keep automatic density at current 100%
or
retune automatic policy based on the user's preferred >100% evidence
```

Do not make that decision automatically in FLICKER1.

---

# Final report

Report:

1. Confirmed root cause of flicker.
2. Exact old event ordering.
3. Exact new atomic ordering.
4. Whether Graphology auto-refresh scheduling contributed.
5. Whether Global, Local, or both were affected.
6. How query anchor selection works when nodes disappear.
7. First-frame anchor error before vs after on deterministic fixtures.
8. Process/render counts before vs after.
9. Confirmation that All physics controls still relayout normally.
10. Confirmation that All physics controls still do not affect Focus.
11. Density slider new range and exact formula.
12. Confirmation that `100%` remains current Auto.
13. Confirmation that `150%` is transient Sandbox amplification only.
14. ForceAtlas2 / Pull / cache / fingerprint invariants.
15. Files changed.
16. Tests and benchmarks run.
17. Fresh native executable path and SHA-256.
18. Any deviations or unresolved edge cases.
19. Explicit confirmation that PR #60 remains draft and unmerged.
