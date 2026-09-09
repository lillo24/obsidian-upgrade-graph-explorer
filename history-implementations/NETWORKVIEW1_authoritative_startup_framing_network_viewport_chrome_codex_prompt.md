# NETWORKVIEW1 — Authoritative Startup Framing + Network Viewport Chrome Parity

**Task type:** correctness bug fix + UI parity / polish

## Goal

Fix the remaining Network startup presentation bug and bring All/Focus Network viewport controls up to the same product quality as Focus Hierarchy.

The user-observed current behavior on the bundled **Synthetic Sample** is:

```text
open app
→ All Network appears in a strange initial state
→ nodes can be extremely far apart
→ node radii look unexpectedly tiny
→ not all nodes are inside the viewport

click Fit
→ graph suddenly looks normal
→ spacing/apparent node size become sensible
→ all nodes are framed
```

The user also reports that Network still uses the old bottom-left text controls:

```text
[ + ] [ − ] [ Fit ]
```

and does not expose the same maximize/restore/full-view control used by Focus Hierarchy.

Success should look like:

```text
fresh source/session
→ no user-visible seed/unrefined geometry
→ current final displayed geometry becomes authoritative
→ startup Fit All is computed against that exact geometry
→ first usable frame already looks like an explicit Fit
→ clicking Fit immediately afterward is visually idempotent

All Network and Focus Network
→ polished icon viewport controls
→ Zoom in
→ Zoom out
→ Fit all
→ Maximize / Restore
```

Do not change ForceAtlas2 physics/convergence merely to make the viewport look correct.

---

# Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` at plan-writing time:

```text
b854033377a5d74fa94b35bfbf3c02af52ef33f2
```

Latest relevant merged work:

```text
PR #81  camera intent / Fit-all correctness
        merge b0b187003148ae206173bba1dda1802e204d3fbf

PR #80  MOVE1B direct Network File dragging
        merge b854033377a5d74fa94b35bfbf3c02af52ef33f2
```

At plan-writing time there are no open PRs.

Before branching and again before merge:

1. inspect current `main`;
2. inspect open PRs/worktrees;
3. use the repository's isolated branch/worktree policy from `AGENTS.md`;
4. preserve unrelated worktrees, `.pnpm-store/`, user files, and concurrent tasks;
5. if main moves, update from latest main and rerun affected Network/camera/Move QA.

No external context is required.

---

# Current evidence

## 1. Fresh Global mount can expose deterministic warm seeds

When no Global layout cache entry exists, `GlobalGraphCanvas` starts from:

```text
globalLayoutPositionsFromInput(input)
```

which originates from deterministic seed positions.

Those deterministic positions are explicitly a **warm seed**, not final presentation geometry.

Current initial path is broadly:

```text
mount Global Sigma
→ deterministic seed positions visible
→ background Global layout
→ optional spatial Pull/Place
→ final geometry
→ startup Fit
```

This is acceptable as a computation pipeline, but not as a visible product pipeline if the seed frame is obviously malformed relative to the final view.

The first visible usable Network frame should not present temporary solver input as though it were authoritative UI.

## 2. Current position-frame ownership is probable root cause of the “Fit fixes everything” symptom

`GlobalRendererSession` uses a Sigma `customBBox` as the stable presentation normalization frame.

Current behavior includes:

```text
establishPositionFrame(positions)
→ setCustomBBox(networkPositionExtent(positions))
→ only if positionFrameEstablished is false
```

and:

```text
rebaseCurrentPositionFrame()
→ setCustomBBox(renderer.getBBox())
```

Manual `fit()` explicitly performs `rebaseCurrentPositionFrame()` before setting camera center/ratio.

Therefore manual Fit is not merely changing zoom; it can change Sigma's normalization frame.

Probable bad sequence on fresh uncached Global:

```text
base automatic layout arrives
→ establishPositionFrame(base positions)

later final displayed geometry changes because of:
  M2 output
  Dynamic Pull
  Fixed Place
  or another final spatial composition

positionFrameEstablished is already true
→ final displayed geometry does not become the customBBox owner

manual Fit
→ rebaseCurrentPositionFrame() from actual current displayed geometry
→ normalization suddenly becomes correct
```

This matches the reported combination:

```text
before Fit:
nodes apparently too far apart
node radii apparently too small
some nodes outside viewport

after Fit:
all three become sane
```

Treat this as a strong hypothesis that must be reproduced with real Sigma before choosing the exact fix.

Do not assume that changing node-size settings or ForceAtlas2 spacing is the right solution.

## 3. PR #81 tests mostly validate camera-intent ordering, not complete real-Sigma startup presentation

PR #81 correctly added:

```text
one-shot Fit/Center consumption
manual-input cancellation of startup Fit
latest spatial-generation gating
Fit All semantics
scale-independent trackpad pan
```

However, relevant canvas tests mock `GlobalRendererSession.fit()` while verifying ordering.

That proves:

```text
Fit happened at the right logical time
```

but not necessarily:

```text
the real Sigma normalization frame was final
the first visible frame was authoritative
all visible nodes were on-screen
screen-space node sizes were sane
an immediate second Fit was visually idempotent
```

This task must add that missing integration evidence.

## 4. Synthetic Sample intentionally has stable identity

The bundled Synthetic Sample uses stable workspace identity.

This means saved workspace-specific state may survive reloads, including independently stored concerns such as:

```text
spatial Pull / Place rules
per-File presentation-size overrides
saved semantic graph view
Graph preferences
```

Do **not** “fix” startup by clearing those.

Instead prove that startup framing works correctly with:

```text
clean storage
saved Pull rules
saved Place rules
saved per-File size overrides
combinations of the above
```

Reset Saved View intentionally does not clear all these registries, so the test matrix must treat them as legitimate persisted state.

## 5. Network viewport controls are legacy UI

All Network currently renders custom text buttons:

```text
+
−
Fit
```

plus `Arrange folders` in the same control strip.

Focus Network uses the same legacy style.

Focus Hierarchy already uses polished icon controls:

```text
FitGraphIcon
MaximizeGraphIcon
RestoreGraphIcon
```

with accessible labels/titles and a proper viewport-control visual language.

Network currently does not receive the same maximize/restore API even though `GraphExplorer` already owns:

```ts
maximized
onMaximizedChange
```

and passes them to the Hierarchy renderer.

---

# Product decisions for this task

These are intentional requirements, not open design questions.

## A. Startup should show final geometry, not solver seeds

For a fresh source load with no exact cached Network geometry:

```text
seed geometry may exist internally
but must not be presented as the final interactive graph
```

Acceptable implementation patterns include:

```text
keep Network surface hidden/loading until authoritative final geometry + initial framing commit
```

or another equivalent architecture that avoids showing an obviously wrong intermediate scene.

Do not introduce a fake placeholder graph.

Do not block the app longer than necessary after the final geometry is actually ready.

## B. “Fit” means Fit All

Explicit Fit and source-startup Fit must frame **every currently displayed node** with the intended stage padding.

Density framing remains a separate Sandbox/camera policy.

Do not remerge density framing into Fit.

## C. Startup Fit should be visually idempotent

When the user has not manually navigated after startup:

```text
startup completes
→ record screen positions / camera / normalization

immediately press Fit
→ only negligible rendering/float difference
```

The graph must not dramatically shrink, expand, or change apparent spacing simply because Fit rebased a stale normalization frame.

This is the most important regression oracle.

## D. Final displayed geometry owns the initial Network normalization frame

For initial presentation, the frame must correspond to the exact final displayed geometry generation:

```text
Global:
settled base automatic
→ final M2/base output
→ current Dynamic Pull result if active
→ current Fixed Place composition
→ authoritative initial display frame
→ Fit All

Focus:
accepted Local layout
→ authoritative initial display frame
→ Fit All
```

Do not let a prior seed/base/intermediate frame permanently become the presentation normalization owner.

After initial establishment, preserve existing camera-neutral geometry-adoption semantics.

## E. Do not auto-fit later graph changes

Only the explicit cases that already own camera should Fit/Center:

```text
source-session startup Fit
explicit Fit button
explicit semantic Center/Search/history restoration
```

Ordinary later operations must remain camera-neutral unless their existing contract explicitly says otherwise:

```text
live vault revisions
layout refinement/re-layout result adoption
Pull/Place edits
Move/physics
visual controls
selection/hover
query changes unless current navigation policy explicitly requests Fit
```

Do not solve startup by calling Fit after every geometry update.

## F. Network viewport chrome should match the polished hierarchy language

Both:

```text
All Network
Focus Network
```

should expose icon controls for:

```text
Zoom in
Zoom out
Fit graph to view
Maximize graph / Restore graph
```

Use the visual language already established by Focus Hierarchy rather than inventing a second polished style.

`Arrange folders` is not a viewport operation. Keep it visually/functionally separate from the viewport-control icon cluster.

---

# Phase 1 — Reproduce before editing

Use the current production path with the bundled Synthetic Sample.

Reproduce at least:

```text
fresh app/source session
All Network
no user input
wait for layout/spatial settle
observe initial final frame
press Fit
compare
```

Capture before/after:

```text
camera x/y/ratio/angle
Sigma customBBox
Sigma live node extent
graph dimensions
displayed node viewport positions
screen-space min/max node coordinates
screen-space node radii for representative Files
final geometry generation identity
whether layout/spatial work is still pending
```

At minimum verify:

```text
Does customBBox differ from final displayed node extent before Fit?
Does Fit replace it?
Does that explain screen-space geometry changing?
```

Also record whether the Synthetic Sample currently has persisted spatial or size overrides in the QA profile.

Do not infer from persisted browser state; state exactly what is active.

---

# Phase 2 — Define one authoritative initial-presentation transaction

Design one explicit concept:

```text
INITIAL NETWORK PRESENTATION COMMIT
```

It should own the one-time transition:

```text
temporary/internal seed
→ authoritative final displayed geometry
→ correct normalization frame
→ Fit All camera
→ visible interactive Network
```

This should be generation-safe.

For Global, it must be tied to the same final-geometry generation already used by PR #81 to gate Fit/Center.

Do not create a parallel notion of “ready” that can disagree with `finalGeometryGeneration`.

Prefer extending/reusing current generation ownership rather than layering another boolean race.

For Focus, use the accepted Local layout generation/commit boundary.

---

# Phase 3 — Fix normalization-frame ownership

The exact implementation is up to current architecture after inspection, but the invariant is:

```text
Before first authoritative Network presentation:
  customBBox / presentation frame may be replaced by newer authoritative geometry

After first authoritative Network presentation:
  frame becomes stable
  ordinary geometry changes use existing anchored/camera-neutral adoption
```

Possible clean design:

```text
positionFrameState:
  pending
  established
```

with an explicit:

```text
establishAuthoritativePositionFrame(finalPositions)
```

called only for the final startup generation.

Do not allow:

```text
first intermediate base result
→ permanently lock presentation frame
```

if spatial work is still pending.

If the best architecture is instead to avoid setting a customBBox until final startup geometry, that is also acceptable.

Keep the owner clear and documented.

---

# Phase 4 — Prevent visible seed flash

For an uncached first mount:

```text
deterministic seed
```

may remain necessary for:

```text
ForceAtlas2 warm start
worker request construction
internal Sigma setup
```

but it should not be presented as a finished graph.

Choose the least invasive product treatment consistent with existing shell:

```text
surface hidden or visually withheld
+ existing “Preparing/Refining Network layout…” status
```

until the authoritative initial presentation transaction completes.

Requirements:

```text
no white-screen flash after geometry is ready
no fake animation from seed → final
no extra automatic Fit after reveal
no React remount loop
no layout restart
```

If an exact cached final geometry is available and current spatial composition is immediately known, allow fast-path presentation without unnecessary waiting.

---

# Phase 5 — Fit All correctness against final geometry

PR #81 changed explicit `fit()` to:

```text
rebaseCurrentPositionFrame()
camera center 0.5 / 0.5
ratio 1
```

Verify that this is still mathematically sufficient when the customBBox is built from the final displayed extent and node radii/stage padding are considered.

The regression must check actual viewport containment:

```text
for every displayed node:
  node center ± rendered radius
  stays inside usable viewport bounds
  accounting for stagePadding
```

If labels are not part of Fit semantics, document that explicitly.

Do not silently add huge label padding.

Test wide/tall/square and outlier layouts.

---

# Phase 6 — Startup idempotence oracle

Add a real-Sigma integration regression:

```text
mount fresh Network
→ allow authoritative startup transaction
→ capture:
    customBBox
    camera
    viewport positions
    screen radii

call explicit Fit
→ wait for render
→ capture same values
```

Expected:

```text
same customBBox
same geometry
same camera target
same representative viewport positions within float/render tolerance
same screen radii within tolerance
```

This should exist for:

```text
All Network no spatial rules
All Network with Pull
All Network with Place
All Network with Pull + Place
Focus Network
```

At least one All fixture should include an extreme/outlier node.

This is stronger than only spying on whether `fit()` was invoked.

---

# Phase 7 — Synthetic Sample persistence matrix

Synthetic Sample is stable and used repeatedly during development.

Create tests/browser QA covering:

### Clean state

```text
no saved spatial rules
no size overrides
startup fits correctly
```

### Saved Pull

```text
saved Pull affects final positions
startup waits for final Pull generation
customBBox matches pulled displayed geometry
Fit is idempotent
```

### Saved Place

```text
saved Place translation included exactly once
customBBox includes final placed positions
Fit is idempotent
```

### Saved per-File size override

```text
override preserved
screen radius reflects override
Fit contains the larger node
startup does not clear override
```

### Combined

At least one combined saved state should be exercised.

Do not modify storage semantics just to simplify startup.

---

# Phase 8 — Network viewport control component / ownership

Modernize Network controls without creating a renderer dependency cycle.

Current hierarchy icon implementations live in the React Flow renderer. `renderer-sigma` should not casually import the React Flow renderer merely for icons.

Before editing, inspect package boundaries and choose one of:

```text
A. extract tiny neutral viewport icons/control primitives to an already suitable shared UI boundary
B. move icon-only components to an app/shared neutral module used by both renderer surfaces
C. duplicate only trivial SVG paths if extracting would create worse architecture
```

Prefer reuse, but do not create a large UI package for four icons.

Document why the selected ownership is appropriate.

Do not add an external icon dependency for this.

---

# Phase 9 — Network viewport controls

Replace legacy Network viewport chrome in both:

```text
GlobalGraphCanvas
LocalGraphCanvas
```

Target actions:

```text
Zoom in
Zoom out
Fit graph to view
Maximize graph / Restore graph
```

Requirements:

```text
icon-only visual presentation
aria-label
title
keyboard-accessible native buttons
visible focus state
same/similar dimensions and visual density as Focus Hierarchy controls
no text "+" / "−" / "Fit" product buttons
```

Exact SVGs can match Focus Hierarchy.

Do not change zoom factors unless a bug is proven.

Do not change wheel/pinch behavior.

---

# Phase 10 — Maximize / Restore integration

`GraphExplorer` already owns:

```ts
maximized
onMaximizedChange
```

and passes them to Hierarchy.

Extend the narrow API so All Network and Focus Network can invoke the same shell behavior.

Likely shape:

```ts
readonly maximized?: boolean;
readonly onMaximizedChange?: (maximized: boolean) => void;
```

or equivalent.

Wire through:

```text
GraphExplorer
→ GlobalGraphView / LocalGraphView
→ GlobalGraphCanvas / LocalGraphCanvas
→ viewport icon control
```

Do not duplicate maximize state inside Sigma.

Do not implement browser Fullscreen API unless the existing product semantics already use it.

“Full view” here means the existing app graph-maximized workspace mode.

On maximize/restore:

```text
do not relayout
do not reset camera
do not Fit automatically
```

The existing canvas resize should preserve current semantic viewport/camera as much as the current renderer contract allows.

Add a regression for that.

---

# Phase 11 — Separate Arrange Folders from viewport controls

Current Global control strip mixes:

```text
Zoom
Fit
Arrange folders
```

Refactor presentation so:

```text
viewport icon cluster
```

contains only camera/viewport actions.

`Arrange folders` should remain a distinct tool/control, preserving:

```text
availability
active state
Done behavior
dirty-draft protection
keyboard semantics
```

Do not redesign SPATIAL2B's editor in this task.

---

# Phase 12 — Camera intent guarantees to preserve

PR #81 behavior is now contract.

Do not regress:

```text
two-finger pan is scale-independent
wheel delta modes normalize correctly
rotated-camera pan is correct
explicit Fit is Fit All
Fit/Center requests are consumed once
old requests do not replay after remount
Global Fit/Center waits for latest final spatial generation
manual camera input cancels pending automatic startup Fit
newer Center/Fit supersedes older camera intent
```

Add startup-frame tests on top of this contract rather than replacing it.

---

# Phase 13 — MOVE1B guarantees to preserve

Current main includes MOVE1B.

Viewport/startup changes must not regress:

```text
direct All/Focus File dragging
3 px drag threshold
exact held File target
neighbor physical reaction
smooth bounded cooling presentation
All Pull participation
Place display composition
100-node movement support gate
no movement persistence
camera-neutral physics frames
```

During File dragging/cooling:

```text
no automatic Fit
no position-frame rebasing
no maximize-triggered relayout
```

Maximize/restore while a move is active should either preserve the current move safely or use an existing conservative cancellation path. Do not invent ambiguous interaction semantics silently; test and document the selected existing-compatible behavior.

---

# Phase 14 — Real-Sigma integration tests

The missing evidence is specifically around Sigma normalization/presentation.

Use the repository's real Sigma/browser path where practical, not only `SigmaTestRenderer`.

Required assertions should include actual rendered/coordinate outcomes rather than method spies.

Test:

```text
fresh uncached Global
fresh uncached Focus
exact cache hit
Global with Pull
Global with Place
Global with Pull + Place
saved size override
wide/tall/outlier graph
```

For each relevant case verify:

```text
first authoritative frame visible
all expected nodes inside Fit bounds
customBBox equals intended authoritative extent
immediate explicit Fit is idempotent
node screen radii do not jump on Fit
```

If jsdom cannot provide real WebGL/Sigma geometry faithfully, add a production-browser harness/test rather than pretending the mock is sufficient.

---

# Phase 15 — Browser / desktop QA

Run the optimized app with the bundled Synthetic Sample.

Mandatory manual/automated production QA:

```text
1. clean-ish Synthetic Sample state
   open app
   do not click anything
   wait for layout
   verify graph begins usable and fully framed

2. immediately click Fit
   verify no dramatic scale/spacing/radius change

3. zoom/pan
   Fit
   verify Fit All works

4. maximize
   restore
   verify viewport controls and graph remain sane

5. Focus Network
   verify same icon controls + maximize/restore
   Fit behaves correctly

6. All Network with Arrange Folders saved Pull/Place
   reload/source-remount
   verify startup final frame

7. direct File drag in All and Focus
   verify viewport changes did not break MOVE1B
```

If native Windows executable can be run, perform the same startup + maximize + Fit smoke there.

Physical touchpad QA is beneficial but is not the core blocker for this task unless trackpad code changes beyond styling/prop wiring.

Report exactly what was and was not physically exercised.

---

# Likely implementation areas

Inspect current code first. Probable areas:

```text
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts

packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx

packages/renderer-sigma/src/styles.css
packages/renderer-sigma/src/network-position-frame.ts
packages/renderer-sigma/src/lifecycle.ts
packages/renderer-sigma/src/local-lifecycle.ts

packages/renderer-sigma/src/*camera* tests
packages/renderer-sigma/src/*density* tests
packages/renderer-sigma/src/spatial-rule-canvas.test.tsx
new startup-presentation integration test if needed

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/LocalGraphView.tsx
apps/web/src/components / styles only if shared viewport icons live there

packages/renderer-reactflow/src/GraphCanvas.tsx
only if extracting/reusing icon primitives cleanly

docs/decisions/0024-network-camera-intents-and-fit-all.md
or a new focused ADR if authoritative startup-frame ownership deserves one

packages/renderer-sigma/README.md
apps/web/src/components/README.md
docs/PERFORMANCE.md if QA/performance evidence changes
history-implementations/<this exact prompt>
```

Do not mechanically touch every listed file.

---

# Scope

## In scope

- reproduce startup Synthetic Sample presentation bug;
- authoritative initial Network presentation transaction;
- correct final-geometry ownership of initial Sigma normalization/customBBox;
- avoid user-visible deterministic seed/unrefined graph;
- source-startup Fit All against final displayed geometry;
- immediate post-startup Fit idempotence;
- saved Pull/Place/size-override startup compatibility;
- All Network viewport icon controls;
- Focus Network viewport icon controls;
- maximize/restore integration for Network;
- separation of Arrange Folders from viewport camera controls;
- accessibility for new buttons;
- real-Sigma/browser integration regressions;
- docs/ADR updates;
- prompt archive;
- PR/CI/merge/cleanup.

## Explicitly out of scope

- ForceAtlas2 convergence retuning;
- changing Global M2;
- changing Dynamic Pull algorithm;
- changing Move physics/cooling algorithm;
- PIN1;
- persistent File positions;
- redesigning Arrange Folders editor;
- changing node-size product defaults merely to mask framing;
- changing density framing semantics;
- changing query/navigation semantics;
- browser Fullscreen API if the existing app uses maximized workspace mode instead;
- unrelated HIER work.

---

# Hidden-cost checks

Before finalizing implementation, explicitly check:

## Startup latency

Withholding seed geometry must not accidentally add a long blank period after final geometry is already available.

Measure:

```text
mount
→ final layout ready
→ final spatial ready
→ first authoritative visible render
```

No strict CI timing threshold.

## Cache fast path

Exact cached geometry should still appear quickly.

Do not force a new layout merely to establish the correct frame.

## Large graph

Do not calculate expensive screen bounds repeatedly per render.

Initial frame/explicit Fit may perform O(N) bounds work; continuous interaction should not.

## Node radius

Fit All should account for rendered node radius without turning node size into layout physics identity.

Do not feed visual radius into ForceAtlas2.

## Maximize

Do not accidentally remount the Network renderer or invalidate layout caches merely because shell dimensions changed.

---

# Validation

Use current repository equivalents.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web/src/components

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also run targeted production-browser QA for the real Sigma startup geometry.

If a dedicated task script is useful, something like:

```text
pnpm analyze:network-startup-presentation
```

is acceptable, but do not add a script just for ceremony.

No flaky timing gates.

---

# Exit gate

NETWORKVIEW1 is complete only when:

1. current startup bug is reproduced or the original symptom is otherwise explained with concrete current-code evidence;
2. seed geometry is confirmed as computation-only or hidden from final presentation;
3. a fresh uncached Global session does not visibly present a malformed seed scene;
4. final displayed Global geometry owns the initial normalization frame;
5. final displayed Focus geometry owns its initial normalization frame;
6. Global startup waits for current Pull/Place generation where applicable;
7. saved Pull survives startup;
8. saved Place survives startup;
9. saved per-File size overrides survive startup;
10. startup does not clear any unrelated persistence registry;
11. startup Fit frames every displayed node;
12. rendered node radius is respected by Fit containment;
13. an immediate second Fit after untouched startup is visually idempotent;
14. that idempotence is tested on real Sigma/browser geometry, not only a Fit spy;
15. customBBox/normalization frame does not change dramatically on the second Fit;
16. representative node screen radii do not jump on the second Fit;
17. later ordinary geometry adoption remains camera-neutral;
18. live revisions do not auto-fit;
19. Pull/Place edits do not auto-fit;
20. Move/physics frames do not rebase the normalization frame;
21. explicit Fit still works after user navigation;
22. explicit Center/Search still works;
23. old Fit/Center requests still cannot replay;
24. manual navigation still cancels pending automatic startup Fit;
25. two-finger pan regression remains green;
26. All Network uses polished icon zoom controls;
27. All Network uses a polished Fit icon;
28. All Network exposes maximize/restore;
29. Focus Network has the same viewport-control capabilities;
30. maximize state remains owned by `GraphExplorer`/app shell;
31. maximize/restore does not relayout automatically;
32. maximize/restore does not auto-fit automatically;
33. Arrange Folders is visually separate from the viewport icon cluster;
34. Arrange Folders semantics remain unchanged;
35. all icon controls have accessible labels/titles;
36. keyboard focus is visible;
37. no external icon dependency is added;
38. no renderer dependency cycle is introduced;
39. MOVE1B direct dragging still works in All;
40. MOVE1B direct dragging still works in Focus;
41. current 100-node movement gate remains unchanged;
42. current convergence policies remain unchanged;
43. current density policy remains unchanged;
44. clean Synthetic Sample production startup passes;
45. persisted-state Synthetic Sample startup passes;
46. browser production build QA passes;
47. desktop check/build pass;
48. native executable startup smoke is reported if performed;
49. `pnpm check` passes;
50. PR CI passes;
51. post-merge CI passes;
52. docs/comments reflect authoritative startup-frame ownership;
53. exact prompt is archived;
54. unrelated files/worktrees remain untouched;
55. task branch/worktree cleanup completes;
56. no next feature is started automatically.

---

# Suggested implementation sequence

1. Sync current `main`; inspect open PRs/worktrees and `AGENTS.md`.
2. Reproduce the Synthetic Sample startup problem on the current production build.
3. Record customBBox, live extent, final positions, camera and screen geometry before/after Fit.
4. Confirm or reject the stale initial normalization-frame hypothesis.
5. Design the smallest authoritative initial-presentation ownership fix.
6. Prevent visible seed/unrefined presentation on uncached startup.
7. Add real-Sigma startup Fit/idempotence regressions.
8. Add saved Pull/Place/size override cases.
9. Verify PR #81 camera intent tests remain green.
10. Extract/reuse minimal viewport icon primitives without creating bad package coupling.
11. Replace All/Focus Network legacy +/-/Fit controls.
12. Wire maximize/restore through the existing app-shell state.
13. Separate Arrange Folders visually from viewport actions.
14. Add accessibility and maximize/resize regressions.
15. Run MOVE1B regressions and small renderer benchmarks.
16. Run full checks/builds.
17. Production-browser Synthetic Sample QA.
18. Desktop build/native smoke where available.
19. Update nearest docs/ADR and archive the exact prompt.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop.

---

# Final report

Report concisely:

## 1. Root cause

```text
What caused the bad startup presentation?
Was stale customBBox/normalization confirmed?
Was persisted sample state involved?
```

## 2. Startup lifecycle

```text
seed
→ layout
→ spatial
→ authoritative frame
→ Fit All
→ reveal/interactive
```

## 3. Idempotence evidence

Before/after immediate Fit:

```text
camera
customBBox
node viewport positions
screen radii
all-node containment
```

## 4. Persisted-state evidence

```text
clean
Pull
Place
size override
combined
```

## 5. Network viewport UI

State what was reused/extracted and show:

```text
All Network controls
Focus Network controls
maximize/restore ownership
Arrange Folders separation
```

## 6. Regression guarantees

Confirm PR #81 and MOVE1B behavior remain intact.

## 7. Performance

Startup/fit overhead and any relevant renderer benchmark difference.

## 8. Tests / browser / desktop QA

State exactly what physical/native interaction was and was not exercised.

## 9. Files / dependencies

Expected external dependency additions:

```text
zero
```

## 10. Follow-up

State whether Network startup/framing and viewport chrome are now complete.

Do not start another implementation task automatically.
