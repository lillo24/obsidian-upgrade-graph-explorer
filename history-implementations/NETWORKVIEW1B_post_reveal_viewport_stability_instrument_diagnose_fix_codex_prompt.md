# NETWORKVIEW1B — Post-Reveal Viewport Stability: Instrument, Diagnose, Then Fix

**Task type:** debugging pass + startup camera/layout stabilization + regression hardening

## Goal

Investigate and fix the remaining **small startup movement/zoom after the Network graph is revealed**.

Do **not** assume the current hypothesis is correct. Instrument the real startup path, determine whether the visible movement comes from:

```text
A. graph/canvas/container dimensions changing after startup Fit
B. another camera command firing after reveal
C. Sigma normalization/customBBox changing again
D. final node geometry changing after reveal
E. visual LOD/style refresh only
F. native WebView/window resizing
G. some other cause
```

Then implement the smallest architecture-correct fix and prove it with automated traces.

The user cannot reliably screen-record or manually inspect this because the movement happens too quickly. Codex should therefore make the startup **observable programmatically** and use that evidence to diagnose it.

Success:

```text
load bundled Synthetic Sample
→ final Network geometry becomes ready
→ authoritative Fit All occurs
→ graph is revealed
→ first ~300–500 ms remain visually stable

No:
  tiny second zoom
  little camera slide
  post-reveal graph-stage resize
  second automatic Fit
  normalization rebase
  unexplained node-center movement
```

An immediate manual Fit after untouched startup must remain visually idempotent.

---

# Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` at plan-writing time:

```text
bfc4b1c28eaa70745997da5d97115dd34ecdaade
```

Relevant merged work:

```text
PR #83 — NETWORKVIEW1 authoritative Network startup framing
          merge ce757bb622e60702b32819113ef1d92c222e07a1

PR #84 — HIER4B Soft Folder Clusters preview
          merge bfc4b1c28eaa70745997da5d97115dd34ecdaade
```

At plan-writing time there are no open PRs.

PR #84 touched `GraphExplorer.tsx` and `App.css`, but its changes there were HIER4B/Settings/menu additions; it did not replace the Sigma startup-presentation transaction introduced by PR #83. Re-check current files before assuming anything.

Before branching and before merge:

1. inspect latest `main`;
2. inspect open PRs/worktrees;
3. follow `AGENTS.md`;
4. use an isolated task worktree;
5. preserve unrelated worktrees, `.pnpm-store/`, user changes and HIER work;
6. if main changes, integrate it and repeat the startup trace.

No external file/context is required.

---

# What PR #83 already fixed

Do not reopen these without contradictory evidence:

```text
seed/base geometry no longer owns the final startup customBBox
Global waits for final layout + Pull/Place generation
Focus waits for accepted Local layout
final displayed geometry becomes authoritative
Fit All occurs before reveal
old Fit/Center requests are one-shot
manual navigation can supersede pending startup Fit
Fit All is separate from Density
Network icon viewport controls + maximize/restore exist
```

PR #83's intended startup transaction is:

```text
seed
→ layout
→ Pull / Place
→ authoritative customBBox
→ Fit All
→ Sigma render
→ reveal
```

The current bug is smaller and happens **after** this transaction appears to have succeeded.

Do not solve it by reverting to seed visibility or by adding another delayed Fit.

---

# Current hypothesis from prior analysis — treat as a hypothesis, not truth

The strongest current intuition is:

```text
final geometry ready
        ↓
Fit while Network canvas has physical size H₁
        ↓
Sigma renders
        ↓
graph becomes visible
        ↓
outer shell / toolbar changes physical height
        ↓
Network canvas becomes H₂
        ↓
Sigma redraws same camera/customBBox into new dimensions
        ↓
user perceives a small zoom / movement
```

The graph's logical camera may remain unchanged:

```text
camera.x
camera.y
camera.ratio
camera.angle
customBBox
```

while node **screen pixels** still change because the renderer dimensions changed.

### Why this is plausible in current source

Current shell CSS includes a content-height toolbar:

```css
.graph-toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  min-height: 3rem;
  ...
}
```

The graph stage consumes the remaining workspace space.

Current `GraphExplorer` also derives visible Network-movement availability text, including:

```text
simulation-not-running
→ "Waiting for Network layout…"
```

Once `GlobalGraphCanvas` becomes ready, its temporary movement capability changes from:

```text
simulation-not-running
```

to:

```text
available
```

If that transient content participates in the wrapping toolbar's layout, it can change toolbar height and therefore canvas height after the initial Fit.

PR #84 did not alter the `.graph-toolbar` rule itself.

Again: **confirm this with measurement before changing the UI.**

---

# Other hypotheses that must remain open

## H2 — Native/window/WebView resize after commit

Tauri/native startup may emit one or more real viewport/window resize events after the WebView has already committed the initial graph.

If the browser build is stable but the executable moves, instrument native startup separately.

Do not blame the toolbar merely because it is plausible.

## H3 — another camera intent

A second Fit/Center, history restore, Density command, or other camera write could still occur after reveal.

PR #83 should prevent this, but instrument every camera mutation rather than assuming.

## H4 — normalization/customBBox changes again

Another later code path could call:

```text
setCustomBBox(...)
rebaseCurrentPositionFrame(...)
commitInitialPresentation(...)
fit()
```

after reveal.

Instrument it.

## H5 — node geometry still changes

A late:

```text
base layout
Pull
Place
physics
presentation override
```

could alter actual node coordinates after reveal.

Track fixed node raw coordinates separately from screen coordinates.

## H6 — LOD/style refresh

Startup camera ratio can change the Global visual LOD. Labels/edges may appear/disappear and produce a visual flash.

This is only the cause if node centers, camera, bbox and dimensions remain stable.

Do not treat a label/edge redraw as geometric motion.

## H7 — font/layout hydration or another shell element

If toolbar height changes, determine **which DOM element** caused it. Do not assume the Network availability message without evidence.

---

# Key conceptual distinction

For each suspicious frame, record these separately:

```text
RAW GRAPH
node x/y

NORMALIZATION
customBBox / effective graph extent

CAMERA
x/y/ratio/angle

PHYSICAL VIEWPORT
renderer width/height
surface DOM rect
graph-stage DOM rect
toolbar DOM rect
window/WebView dimensions

SCREEN
node viewport pixel x/y
rendered radius

VISUAL
LOD tier
label/edge visibility/style
```

Then classify the movement:

```text
raw x/y changed
→ geometry/layout movement

customBBox changed
→ normalization-frame change

camera changed
→ explicit camera movement

only dimensions changed
→ same camera projected into a new viewport

only style/LOD changed
→ visual flash, not geometry

multiple changed
→ identify ordering and owner
```

This classification is the core of the task.

---

# Phase 1 — Instrument before editing behavior

Add **temporary QA/development instrumentation** around the real production startup path.

Do not permanently add noisy production telemetry.

A reusable test-only/dev-only diagnostics hook is acceptable if it materially improves regression coverage.

Record timestamps relative to:

```text
GraphExplorer mount
Sigma session creation
base layout accepted
final spatial generation accepted
commitInitialPresentation start
customBBox write
camera Fit write
Sigma afterRender resolving commitInitialPresentation
initialPresentationReady = true
surface reveal
```

Then continue recording for at least:

```text
500 ms after reveal
```

with `requestAnimationFrame`/`ResizeObserver`-based sampling rather than arbitrary sleeps alone.

---

# Phase 2 — Required trace fields

For every meaningful event/sample, record:

## Time / reason

```text
relative timestamp
frame number
event/reason tag
```

Reason tags should include, where applicable:

```text
layout accepted
Pull accepted
Place composed
initial presentation begin
customBBox changed
camera changed
Sigma beforeRender / afterRender
surface reveal
ResizeObserver
window resize
toolbar mutation/status transition
LOD transition
explicit refresh/scheduleRender where identifiable
```

## Physical dimensions

```text
window.innerWidth / innerHeight

.graph-workspace rect
.graph-toolbar rect
.graph-stage rect
Network canvas root rect
Sigma surface rect

renderer.getDimensions()
devicePixelRatio if relevant
```

## Camera

```text
x
y
ratio
angle
```

## Normalization

```text
customBBox
renderer live bbox / graph extent where available
```

## Geometry

Choose 3–5 stable representative node keys:

```text
raw graph x/y
viewport x/y
rendered radius
```

Include:

```text
left/top-ish node
center-ish node
right/bottom-ish node
outlier if fixture has one
```

## Network state

```text
initialPresentationReady
layout pending / ready
spatial generation identity or serializable QA key
final geometry generation
temporary File-move capability status/reason
layout status text
```

## Visual state

```text
Global LOD tier
```

and any other cheap state needed to prove a style-only refresh.

---

# Phase 3 — Do not depend on human timing

The user should not have to record the startup manually.

Create a repeatable production-browser QA path.

Recommended approach:

```text
development/QA trace collector
→ launch optimized browser build
→ load bundled Synthetic Sample
→ automatically wait for initial presentation
→ collect trace through +500 ms
→ write/print structured JSON summary
```

A task-specific command is appropriate if useful, e.g.:

```bash
pnpm analyze:network-post-reveal-stability
```

Exact name is flexible.

If adding a permanent CLI is excessive, use a bounded development harness and keep only regression tests after diagnosis.

No private vault data.

---

# Phase 4 — Amplify race conditions deterministically

Because the movement is fast, create controlled slow paths in QA/tests rather than relying only on natural timing.

At minimum test:

```text
normal Synthetic Sample startup

artificially delayed base layout completion

artificially delayed Dynamic Pull completion

artificially delayed temporary File-move capability becoming available

artificially delayed/transitional toolbar status removal

container resize immediately after commitInitialPresentation

window resize immediately after reveal
```

Use test seams/fakes, not production sleeps.

The goal is to make event ordering reproducible.

---

# Phase 5 — Verify/refute the toolbar-height hypothesis

Instrument:

```text
.graph-toolbar height
.graph-stage height
Sigma surface height
```

before and after:

```text
"Waiting for Network layout…" visible
→ capability available / status removed or replaced
```

Also record whether wrapping changes:

```text
toolbar row count if cheaply detectable
control rect top positions
```

If confirmed, identify the exact element that changes shell height.

Do not merely observe "toolbar changed"; establish:

```text
which DOM element/state transition
→ changed toolbar height by N px
→ changed graph stage by N px
→ changed node pixel positions by M px
```

That is enough to close causality.

---

# Phase 6 — Verify camera intent count

Instrument or spy on every relevant Network session operation during startup:

```text
commitInitialPresentation
fit
center
applyDensityFraming
setCustomBBox / authoritative frame setter
camera.setState
camera.animate
raw viewport restore
```

After `initialPresentationReady` becomes true and before user input:

Expected:

```text
0 additional automatic Fit
0 additional automatic Center
0 unexpected camera writes
0 unexpected normalization rebase
```

If this expectation fails, fix the actual duplicate intent instead of shell geometry.

---

# Phase 7 — Verify actual node geometry

For the representative nodes, compare:

```text
raw x/y at reveal
raw x/y + 16 ms
raw x/y + 50 ms
raw x/y + 100 ms
raw x/y + 300 ms
```

Without user input/live vault edits:

Expected:

```text
no meaningful raw coordinate movement after authoritative reveal
```

If raw coordinates move, trace which operation applied them:

```text
layout
spatial Pull
Place
physics
presentation/session update
```

Do not compensate with camera tricks.

---

# Phase 8 — Verify LOD separately

If:

```text
raw node coordinates stable
customBBox stable
camera stable
viewport dimensions stable
```

but appearance still flashes, log:

```text
LOD tier
label visibility
edge visibility/thickness
```

Determine whether the remaining perception is style-only.

If so, fix only if it is visibly problematic; do not introduce geometry/camera behavior to hide it.

---

# Phase 9 — Diagnosis gate

Before modifying production behavior, write a concise evidence note:

```text
Root cause:
Measured event order:
Measured dimension/camera/bbox/node deltas:
Why other hypotheses were rejected:
```

If there are two independent causes, state both.

Do not implement the prior chat's toolbar hypothesis merely because it sounds plausible.

---

# Phase 10 — Fix policy if shell/container dimensions are the cause

If post-reveal container resizing is confirmed, prefer **preventing startup layout shift** over performing another Fit.

Good solution families:

## A. Stabilize shell geometry

If transient toolbar content changes height:

```text
reserve a stable toolbar/status slot
```

or move transient Network readiness text into a:

```text
non-layout-changing status/overlay region
```

while preserving accessibility (`aria-live` where appropriate).

The graph stage should not gain/lose height simply because:

```text
Waiting for Network layout…
```

becomes available/hidden.

Do not make the entire toolbar a huge fixed-height region on narrow screens.

Responsive wrapping still matters.

## B. Delay authoritative presentation until dimensions are actually stable

If a legitimate one-time shell/WebView resize occurs before the UI settles:

```text
final geometry ready
→ observe Network container dimensions
→ require bounded stability across consecutive animation frames / ResizeObserver state
→ commit authoritative frame + Fit All
→ render
→ reveal
```

Do **not** use a blind fixed delay such as:

```text
wait 300 ms
```

Use actual geometry stability.

The wait must be bounded and fail-safe.

## C. Combination

If the toolbar causes one predictable shift and native WebView adds another, fix structural toolbar instability first and use a small generic dimension-stability gate only for legitimate mount-time sizing.

---

# Phase 11 — Important non-solution: delayed second Fit

Do not implement:

```text
Fit
→ reveal
→ 50/100/300 ms later
→ Fit again
```

That would formalize the exact visible jump the user dislikes.

The final startup Fit must happen once, against the correct final geometry **and final startup viewport size**.

---

# Phase 12 — External resize semantics

A real user-driven window resize after startup is different from startup instability.

Do not attempt to freeze all screen pixel positions forever.

For ordinary later resize:

```text
renderer resizes normally
camera ownership remains unchanged
no unsolicited Fit
```

This task only requires startup to avoid a hidden shell/native resize immediately after reveal.

If Tauri performs an unavoidable native resize after the page becomes visible, investigate whether startup can wait for it rather than fighting legitimate later resizing.

---

# Phase 13 — Cached and uncached paths

Test both:

```text
fresh uncached Global Network
exact Global layout cache hit
```

and, where useful:

```text
fresh Focus Network
Focus exact cache hit
```

The dimension-stability fix must not introduce unnecessary delay on the cache fast path.

---

# Phase 14 — Spatial and persisted-state matrix

At minimum test All Network with:

```text
no spatial rules
saved Pull
saved Place
Pull + Place
```

The startup stability fix must remain generation-correct with final spatial geometry.

Do not clear persisted sample state.

---

# Phase 15 — Responsive-width matrix

Because the toolbar uses wrapping, test startup at widths where row wrapping could change.

At minimum:

```text
1440 × 900
1280 × 720
around the toolbar wrap breakpoint / narrow desktop
390 px mobile-style width if still a supported responsive path
```

Record toolbar and graph-stage dimensions.

A fix that only works at 1440 px is insufficient.

---

# Phase 16 — Tauri/native startup

NETWORKVIEW1 did not perform native UI clicks. This follow-up should make a stronger effort.

If the native executable can be launched under available computer-control tooling:

```text
launch release executable
load Synthetic Sample/default source
collect startup trace if QA instrumentation can report it
observe first 500 ms after reveal
```

If automated native interaction remains unavailable:

- still run `desktop:check` and optimized build;
- run bounded native startup/process smoke;
- explicitly report that physical native visual confirmation remains unavailable.

Do not claim native startup stability solely from Chrome.

---

# Phase 17 — Regression oracle

After the fix, define a measurable startup-stability contract.

For a normal no-user-input Synthetic Sample startup:

From:

```text
initial presentation reveal
```

through at least:

```text
+300 ms
```

expected:

```text
no automatic camera command
no customBBox change
no raw node coordinate change
no unexpected toolbar/stage/surface resize
```

For representative nodes:

```text
viewport x/y remains within <= 1 CSS px
```

**only when physical viewport dimensions are unchanged**.

If dimensions legitimately change before reveal, that is fine.

If dimensions change after reveal in the test, that should fail the startup-stability contract unless the test explicitly simulates external/user window resizing.

Use a tolerance appropriate for browser subpixel rounding; do not make the test flaky.

---

# Phase 18 — Explicit post-reveal observation test

Add a production-browser regression stronger than PR #83's instant Fit idempotence:

```text
load fresh Network
→ wait until data-initial-presentation="ready"
→ capture dimensions/camera/bbox/node pixels
→ wait 1 rAF
→ capture
→ wait 5 rAF
→ capture
→ wait until ~300 ms after reveal
→ capture
```

Assert the relevant invariants.

Then:

```text
click explicit Fit
```

and ensure Fit remains effectively idempotent.

This directly covers the bug the current tests miss.

---

# Phase 19 — Temporary instrumentation cleanup

Before merge:

- remove one-off console spam;
- remove temporary monkey-patches used only to diagnose;
- keep only useful structured QA/test instrumentation;
- do not ship continuous startup telemetry to users;
- document any retained development-only trace hook.

If a small generic viewport-stability observer becomes part of production, it should own real behavior—not act as logging residue.

---

# Phase 20 — Preserve existing contracts

Do not regress PR #81 / #83:

```text
scale-independent two-finger pan
wheel delta normalization
rotated-camera pan
Fit All
one-shot Fit/Center requests
manual input supersedes automatic startup Fit
latest spatial generation gating
authoritative final startup customBBox
immediate Fit idempotence
Network maximize/restore
```

Do not regress MOVE1B:

```text
All/Focus File dragging
physics frames camera-neutral
no movement persistence
100-node support gate
```

Do not modify:

```text
ForceAtlas2 convergence
Global M2
Dynamic Pull physics
Density semantics
HIER4B
```

unless diagnosis proves direct involvement and the user-visible fix cannot be isolated.

---

# Likely relevant areas

Inspect current code first; probable starting points include:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/App.css

packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx

packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts

packages/renderer-sigma/src/network-camera-intent.ts
packages/renderer-sigma/src/network-position-frame.ts
packages/renderer-sigma/src/raw-viewport-frame.ts

packages/renderer-sigma/src/initial-presentation-session.test.ts
packages/renderer-sigma/src/camera-intent-canvas.test.tsx
packages/renderer-sigma/src/spatial-rule-canvas.test.tsx
packages/renderer-sigma/src/network-wheel-pan-session.test.ts

apps/web/src/components/NetworkEditingControls.tsx
or the current owner of the "Waiting for Network layout…" status

apps/web/src/components / browser QA harness
```

Do not mechanically touch all of these.

PR #84's GraphExplorer/App.css edits were HIER4B additions; do not conflate that feature with this bug merely because the files overlap.

---

# Scope

## In scope

- programmatically reproduce the small post-reveal movement;
- startup trace/instrumentation;
- container/toolbar/stage dimension diagnostics;
- camera/customBBox/geometry/LOD diagnostics;
- deterministic slow-path race reproduction;
- diagnose toolbar-status hypothesis;
- diagnose native/window resize hypothesis;
- diagnose duplicate camera intent;
- diagnose late geometry adoption;
- fix confirmed root cause;
- post-reveal stability regression;
- cached/uncached startup;
- Pull/Place startup;
- responsive widths;
- Chrome production QA;
- native startup QA where possible;
- docs/comments for final startup stability ownership;
- prompt archival;
- PR/CI/merge/cleanup.

## Explicitly out of scope

- new graph layout algorithm;
- ForceAtlas2 retuning;
- convergence thresholds;
- node-size redesign;
- Density redesign;
- folder-clustering redesign;
- HIER4B work;
- PIN1;
- persistence migrations unrelated to this bug;
- adding a second delayed automatic Fit as a workaround.

---

# Suggested implementation sequence

1. Sync latest main and inspect worktrees/open PRs.
2. Read AGENTS and PR #83 camera/startup code.
3. Reproduce current Synthetic Sample startup in optimized Chrome.
4. Add bounded startup trace instrumentation.
5. Record real event order and dimensions for +500 ms after reveal.
6. Add controlled slow-layout/Pull/status/resize scenarios.
7. Classify the movement: camera / bbox / geometry / dimensions / LOD.
8. Write a short diagnosis note before production behavior changes.
9. Implement the smallest root-cause fix.
10. Add the +300 ms post-reveal stability regression.
11. Test clean/cache/Pull/Place paths.
12. Test 1440×900, 1280×720 and wrapping/narrow widths.
13. Re-run explicit Fit idempotence and camera-intent regressions.
14. Run MOVE1B regressions.
15. Run optimized browser QA.
16. Run desktop check/build and native startup trace/smoke where possible.
17. Remove temporary tracing noise.
18. Update nearest docs/ADR only where the final ownership contract changed.
19. Archive this exact prompt.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop.

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

Also run the task-specific production-browser startup trace/regression.

No flaky fixed-time CI performance gate.

---

# Exit gate

NETWORKVIEW1B is complete only when:

1. the post-reveal movement is captured programmatically or conclusively shown absent in the current optimized browser build;
2. the first 300–500 ms startup sequence is traceable;
3. container dimensions are recorded;
4. toolbar dimensions are recorded;
5. graph-stage dimensions are recorded;
6. Sigma surface/renderer dimensions are recorded;
7. camera state is recorded;
8. customBBox is recorded;
9. representative raw node coordinates are recorded;
10. representative viewport node coordinates are recorded;
11. LOD is recorded;
12. camera operations have reason/ownership tags;
13. the "Waiting for Network layout…" transition is tested explicitly;
14. toolbar wrapping is either confirmed causal or rejected;
15. native/window resize is either confirmed causal or rejected as far as available tooling permits;
16. duplicate post-reveal Fit/Center is either confirmed causal or rejected;
17. late customBBox rebase is either confirmed causal or rejected;
18. late node geometry is either confirmed causal or rejected;
19. style-only LOD flash is distinguished from geometry;
20. diagnosis is written before behavior changes;
21. no arbitrary fixed startup sleep is used as the main solution;
22. no delayed second automatic Fit is added;
23. the confirmed cause is fixed at its owner;
24. fresh uncached All startup is stable;
25. cached All startup is stable;
26. Pull startup is stable;
27. Place startup is stable;
28. Pull + Place startup is stable;
29. Focus startup remains correct;
30. an untouched startup remains stable for at least ~300 ms after reveal;
31. no automatic camera command occurs after reveal in that window;
32. no unexpected customBBox change occurs after reveal;
33. no unexpected raw node-coordinate change occurs after reveal;
34. no internal shell resize occurs after reveal in the ordinary test;
35. representative screen positions remain stable when viewport dimensions are stable;
36. explicit Fit immediately afterward remains idempotent;
37. user-driven later window resizing remains allowed;
38. later geometry adoption remains camera-neutral;
39. PR #81 pan/camera tests remain green;
40. PR #83 startup framing tests remain green;
41. MOVE1B tests remain green;
42. ForceAtlas2/convergence code remains unchanged unless direct evidence requires otherwise;
43. Density semantics remain unchanged;
44. HIER4B behavior remains unchanged;
45. 1440×900 startup passes;
46. 1280×720 startup passes;
47. wrapping/narrow-width startup passes;
48. optimized Chrome QA passes with clean console;
49. desktop check/build passes;
50. native startup interaction/trace is reported honestly;
51. temporary debug logging is removed;
52. useful retained QA instrumentation is documented;
53. no external dependency is added without strong justification;
54. `pnpm check` passes;
55. PR CI passes;
56. post-merge CI passes;
57. exact prompt is archived;
58. unrelated worktrees/files are preserved;
59. task worktree/branch is cleaned up;
60. no next feature is started automatically.

---

# Final report

## 1. Root cause

State the actual cause, not the initial hypothesis.

Example format:

```text
Confirmed:
Rejected:
```

## 2. Measured startup timeline

Provide a small timeline:

```text
t=...
geometry ready
t=...
Fit committed
t=...
reveal
t=...
dimension/camera/etc changed
```

Include measured pixel/dimension deltas.

## 3. Fix

Explain why the selected fix acts at the correct owner and why a second Fit was not used.

## 4. Post-fix stability evidence

Report:

```text
toolbar rect
stage rect
Sigma dimensions
camera
customBBox
raw node x/y
screen node x/y
LOD
```

from reveal through +300 ms.

## 5. Responsive / persisted-state matrix

Report:

```text
1440×900
1280×720
narrow/wrapping width
cache
Pull
Place
Pull + Place
```

## 6. Camera / Fit regressions

Confirm existing pan, Fit, Center and manual-input ownership behavior.

## 7. Browser / native QA

State exactly what was run physically and what was not.

## 8. Files / dependencies

Expected dependency additions:

```text
zero
```

## 9. Follow-up

State whether the Network startup viewport is now stable.

Do not start another task automatically.
