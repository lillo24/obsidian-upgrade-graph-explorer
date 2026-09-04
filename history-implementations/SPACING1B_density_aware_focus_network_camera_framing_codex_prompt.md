# SPACING1B — Density-Aware Focus Network Camera Framing

**Task type:** production renderer behavior / camera-framing policy / visual-density correction

## Goal / success outcome

Implement the production follow-up selected by SPACING1A:

```text
ForceAtlas2 geometry
→ leave unchanged

Sigma auto-rescale
→ leave unchanged

Focus Network automatic framing
→ use a deterministic bounded density-aware camera ratio
```

The user-visible problem is:

```text
small Focus Network
→ Sigma Fit stretches a handful of nodes across most of the viewport
→ excessive whitespace / nodes feel implausibly far apart
```

SPACING1A established that this is mainly a **camera/framing problem**, not a ForceAtlas2-equation problem.

Success means:

```text
2–10-node Focus graphs
→ visibly more compact

20–50-node Focus graphs
→ remain close to current density unless correction is genuinely useful

all cases
→ identical ForceAtlas2 relative geometry
→ no coordinate scaling
→ no ForceAtlas2 tuning
→ no layout/cache/fingerprint change
```

The initial production policy is the SPACING1A B-camera hybrid, clamped to:

```text
0.7 ≤ camera ratio ≤ 1.4
```

This is a visual product change. Native visual acceptance is a merge gate.

---

# Source of truth

Repository:

```text
lillo24/icarus-graph-explorer
```

Current merged baseline at plan-writing time:

```text
main = 2cacaf9c57249e78178b6b7a0dcb4595c1093ad0
PR #57 — SPACING1A
```

At plan-writing time there are no open PRs.

Recent merged work that must remain compatible:

```text
#51 VISUAL1B
→ per-File Network Size is render-only
→ changing Size must not move nodes or re-run layout

#54 NETWORKPOLISH1
→ source-folder Network Explorer
→ Focus reference lines remain visible at far LOD

#55 HIER0
→ All Hierarchy experimental
→ Focus Hierarchy remains supported

#56 SPATIAL1A
→ All Network normalized folder-anchor foundation
→ separate from Focus camera density

#57 SPACING1A
→ diagnostic evidence and B-camera decision
```

Before implementation, sync current `main` and check again for concurrent work.

No external context is required. The canonical decision report is already in:

```text
docs/SPACING1A_FOCUS_DENSITY_SPIKE.md
```

---

# SPACING1A conclusion — treat as accepted design evidence

SPACING1A established:

```text
raw ForceAtlas2 coordinates
→ Sigma autoRescale / autoCenter
→ camera
→ pixels
```

Sigma 3.0.3 normalizes the raw graph extent before the camera.

Therefore:

```text
P
and
0.5 × P

→ identical screen positions under the same camera state
```

Uniform coordinate compression is ineffective unless Sigma normalization is also redesigned, which is explicitly not wanted.

At camera ratio `r`:

```text
center-to-center pixel distance ∝ 1/r
screen-referenced node radius   ∝ 1/sqrt(r)
```

So increasing the Fit ratio reduces whitespace faster than it reduces apparent node size.

SPACING1A verdict:

```text
B-camera is sufficient
C adaptive ForceAtlas2 is not justified
ForceAtlas2 fork is not justified
```

Do not reopen that architecture decision unless implementation evidence contradicts the report.

---

# Current production camera evidence

Current `packages/renderer-sigma/src/local-session.ts`:

```ts
fit(): void {
  void this.renderer.getCamera().animatedReset(...)
}
```

Sigma reset means approximately:

```text
x = 0.5
y = 0.5
ratio = 1
angle = 0
```

Current `LocalGraphCanvas` calls this same `fit()` for:

```text
external fitRequestKey
manual "Fit" button
```

Current accepted Local layout positions are applied through:

```text
session.applyPositions(...)
```

which intentionally preserves the existing viewport anchor and current camera ratio.

Current semantic Local persistence stores:

```text
anchorEntityId
freeRatio
```

That persisted/restored camera intent must remain authoritative.

---

# Important architectural rule: density is a Fit target, not a layout property

The new density ratio must never enter:

```text
LocalLayoutRequest
ForceAtlas2 settings
raw x/y positions
root normalization
layout fingerprint
LocalLayoutCache key/value
ViewProjection
canonical truth
QUERY1
Visual Groups
presentation-overrides registry
```

Conceptually:

```text
completed Local layout
+
automatic production node radii
+
Local edges
        ↓
pure density policy
        ↓
recommended Fit ratio only
        ↓
camera
```

The output is **one number** plus optional aggregate diagnostic metadata.

It does not return new coordinates.

---

# 1. Add a production Local density policy

Create a pure module beside the Local Sigma renderer, likely:

```text
packages/renderer-sigma/src/local-density.ts
```

or another repository-consistent name.

Suggested contract:

```ts
interface LocalDensityDecision {
  readonly ratio: number
  readonly nearestNeighborSignal: number
  readonly connectedEdgeSignal: number
  readonly rootRadiusSignal: number
  readonly fallback: boolean
}

resolveLocalDensityFit(...)
→ LocalDensityDecision
```

Exact shape is flexible.

Inputs should be sufficient to evaluate the **completed accepted Local layout**:

```text
root key
automatic node sizes
completed x/y positions
Local edges
```

Prefer existing `LocalLayoutRequest` + accepted `LocalLayoutPosition[]` or a similarly narrow renderer-owned input rather than reconstructing semantic data.

---

# 2. Promote the SPACING1A formula without creating tool → production dependencies

SPACING1A currently contains diagnostic-only metric/formula code under:

```text
tools/vault-diagnostics/src/focus-spacing-*.ts
```

Production code must **not** import from tooling.

Preferred direction:

```text
renderer-sigma production module
→ owns the approved minimal density policy

vault-diagnostics
→ imports/reuses production policy where practical
→ retains analysis-only detailed metrics/report generation
```

This prevents the diagnostic oracle and production formula from drifting.

If a direct refactor would overcouple diagnostic types, extract only the minimal shared math required.

Do not move large reporting/HTML code into renderer-sigma.

---

# 3. Use Sigma 3.0.3 framing math faithfully

SPACING1A measured screen density using the installed Sigma utilities:

```text
createNormalizationFunction
matrixFromCamera
multiplyVec2
```

Production density policy must measure the same normalized scene Sigma actually renders.

Prefer using supported `sigma/utils` functions directly if their versioned API is appropriate.

If copying/isolation is safer, document the exact Sigma 3.0.3 behavior being mirrored and test parity.

Do not invent a second approximate coordinate system that silently diverges from Sigma.

Pinned dependency evidence:

```text
sigma = 3.0.3
```

Keep the version-sensitive assumption close to the policy.

---

# 4. Canonical reference frame

Density must not fluctuate merely because the app window changes size.

Use the accepted reference frame:

```text
width  = 1200 px
height = 800 px
stage padding = 24 px
baseline camera ratio = 1
```

The density decision is calculated in that canonical screen frame.

Then use the resulting ratio in the real current viewport.

Required invariant:

```text
same accepted layout
720×480 app
1200×800 app
large maximized app

→ same density target ratio
```

Normal Sigma viewport scaling still handles actual pixels.

Do not recompute ratio from real window dimensions.

---

# 5. Production formula

Centralize and name all provisional policy constants.

For node count `N` and baseline screen metrics at camera ratio 1:

## B1 — connected-edge guard

```text
targetConnectedEdgePx
= min(180, 80 + 20 × sqrt(N))

B1
= medianConnectedEdgePx / targetConnectedEdgePx
```

## B2 — primary nearest-neighbor / diameter density signal

```text
targetNearestPerDiameter
= 30 / sqrt(N)

B2
= (
    baselineNearestNeighborPerNodeDiameter
    /
    targetNearestPerDiameter
  )²
```

The square is required because with screen-referenced Sigma sizes:

```text
distance / diameter ∝ 1 / sqrt(cameraRatio)
```

## B3 — overall root-radius guard

```text
targetRootRadiusPx
= min(720, 200 + 70 × sqrt(N))

B3
= p90RootRadiusPx / targetRootRadiusPx
```

## Final B4 ratio

```text
rawRatio = median(B1, B2, B3)

densityFitRatio
= clamp(rawRatio, 0.7, 1.4)
```

Do not clamp B1/B2/B3 independently before taking the median unless current SPACING1A fixture parity proves that is intentionally equivalent to the accepted oracle.

The final product policy should be easy to locate and tune.

---

# 6. Automatic node sizes only — VISUAL1B must remain render-only

Density calculations must use the automatic Local node sizes that participate in the existing Local renderer input/layout request.

Do **not** use the user's per-File VISUAL1B display multiplier.

Required:

```text
change File Size 1.00× → 2.50×
→ displayed node radius changes
→ densityFitRatio unchanged
→ camera unchanged
→ layout unchanged
```

This separation is critical.

The new density policy must not undo the recently accepted VISUAL1B fix.

Visual Groups likewise must not affect the density decision.

---

# 7. Degenerate input and fallback behavior

Focus should normally contain at least its root, but the pure policy must be explicit.

Required fallback:

```text
invalid / non-finite / unusable density metrics
→ ratio = 1
```

Do not emit NaN/Infinity to Sigma.

At minimum handle safely:

```text
1 node
2 nodes
no reference edges
no hierarchy edges
multiple disconnected components
duplicate/zero geometric distances if malformed input reaches the policy
```

For valid sparse cases, use the B4 rule.

For genuine malformed production input:

- fail loudly in tests/development where consistent with repository conventions;
- keep runtime camera safe with B0 ratio 1 rather than crashing the entire explorer because a density heuristic failed.

Do not silently mutate coordinates to recover.

---

# 8. Add an explicit camera-framing ownership model

The density policy must not continuously fight the user.

There are two conceptual camera states:

```text
AUTO FRAMING
→ app may adopt/recompute density-aware Fit ratio

USER / SEMANTIC CAMERA
→ preserve exactly until user explicitly requests Fit
```

Implement the smallest robust state/contract that achieves this.

Do not necessarily use these literal enum names if current architecture has a better seam.

---

# 9. What starts as user/semantic camera ownership

The following must **not** be overwritten by a later layout completion:

```text
restored SemanticLocalViewport
Back/Forward restored Local viewport
explicit center/navigation request with a requested freeRatio
manual wheel / touchpad / pinch zoom
manual pan/drag
Zoom + / Zoom − buttons
```

If any of those occurs while ForceAtlas2 worker work is pending:

```text
worker result accepted
→ positions may update normally
→ existing anchor/camera preservation applies
→ DO NOT snap to density Fit
```

This is a hard acceptance criterion.

---

# 10. Fresh Focus entry and transition anchors

A fresh Focus entry without a restored semantic Local viewport should receive the density-aware automatic scale.

However, current All→Focus / renderer-transition behavior may carry a transient viewport point so the root/node does not visibly jump between renderers.

Treat:

```text
transition anchor position
```

separately from:

```text
saved/manual camera scale ownership
```

Preferred behavior:

```text
fresh Focus transition
→ preserve the transition anchor's screen point
→ once accepted Local layout is available, adopt densityFitRatio
→ do not arbitrarily snap the root to a different screen location
```

If exact current transition architecture makes a centered Fit visually superior, compare it carefully in browser/native QA before changing transition semantics.

Do not simply call `animatedReset()` after every first worker result if that causes a visible handoff jump.

The important product outcome is:

```text
automatic density scale
+
camera continuity
```

not one specific low-level API.

---

# 11. Automatic framing after accepted Local layouts

Compute the density decision from the positions that are actually accepted:

```text
exact cache hit
fresh latest worker result
```

Do not compute from a stale result.

When camera ownership is still AUTO:

```text
accepted layout
→ update latest densityFitRatio
→ apply that ratio as automatic framing
```

When camera ownership is USER/SEMANTIC:

```text
accepted layout
→ update latest densityFitRatio for future Fit
→ preserve current camera
```

Thus the latest ratio is always available without continuously overriding the user.

---

# 12. Topology / depth / query changes

Focus membership can change through:

```text
hops
direction
hierarchy depth
manual disclosure
QUERY1/filter changes
live source update
Focus reroot/navigation
```

After a new accepted Local layout:

### If camera is still AUTO

Recompute and adopt the new density target.

### If camera is USER/SEMANTIC

Recompute the stored/latest density target but do not apply it.

This prevents camera fights while still making the next manual Fit correct for the current graph.

Preserve the existing anchor-through-layout behavior.

---

# 13. Manual Fit

Change the Focus Network `Fit` action from:

```text
Sigma animatedReset → ratio 1
```

to:

```text
density-aware Fit
→ x/y/angle behavior consistent with current Fit
→ ratio = latest densityFitRatio
```

Recommended:

```text
manual Fit
→ explicitly returns camera ownership to AUTO
```

so later topology changes can continue using automatic density framing until the user pans/zooms/centers again.

If there is no valid density decision yet:

```text
manual Fit
→ safe ratio 1
```

Manual Fit should remain animated according to existing reduced-motion behavior.

Do not change All Network Fit.

---

# 14. Pan/zoom intent detection

Current custom precision-wheel path is easy to mark as user intent.

Native Sigma drag/pan also needs to transition camera ownership away from AUTO.

Inspect Sigma 3.0.3 event/captor APIs and use the smallest reliable, version-compatible signal.

Avoid brittle heuristics such as treating **every** camera update as user input, because the app itself changes the camera for:

```text
center
transition anchoring
Fit
layout anchor correction
```

A small explicit suppression/programmatic-camera seam is acceptable if needed.

Required tests must distinguish:

```text
programmatic density Fit
vs
user wheel
vs
user drag/pan
vs
center request
```

Do not add global application state if session-local ownership is sufficient.

---

# 15. Centering/navigation

Existing:

```text
session.center({ nodeId, freeRatio })
```

must remain authoritative.

A center request must not be immediately replaced by density Fit when a layout finishes.

Treat explicit center/navigation as semantic/user camera ownership.

The requested `freeRatio` remains exactly the requested ratio.

Do not silently substitute the density ratio into Search/sidebar/entity navigation.

The density ratio is for **Fit/automatic framing**, not every center operation.

---

# 16. Semantic viewport persistence

Do not add a new persisted field.

Existing:

```text
SemanticLocalViewport {
  anchorEntityId
  freeRatio
}
```

is sufficient.

After automatic density framing, normal viewport observation may persist that derived ratio exactly as it persists any other camera ratio.

On restoration:

```text
saved freeRatio
→ authoritative
→ no density override
```

until the user invokes Fit or otherwise re-enters an auto-owned fresh frame according to the established flow.

No view-state schema bump.

---

# 17. Resize behavior

Because the policy uses a fixed reference frame:

```text
window resize
→ do not recompute density ratio
→ do not automatically Fit
```

Sigma handles the actual viewport transform.

If the camera is auto-owned, resize should still not create unnecessary camera animation/reframing unless existing Sigma behavior requires it.

Test:

```text
1200×800 → narrow
narrow → maximized
```

with stable camera ratio.

---

# 18. Keep ForceAtlas2 completely unchanged

Do not modify:

```text
DEFAULT_LOCAL_LAYOUT_SETTINGS
hierarchyWeight
referenceWeight
scalingRatio
gravity
strongGravityMode
edgeWeightInfluence
Barnes-Hut threshold
iteration policy
seed positions
root normalization
```

Do not fork Graphology ForceAtlas2.

SPACING1A concluded that C is not justified.

If SPACING1B graphical QA reveals actual malformed relative topology, stop and report it as evidence for a future separate C sensitivity spike.

Do not broaden this task.

---

# 19. Keep layout/cache/fingerprint unchanged

Density-aware framing must not affect:

```text
createLocalLayoutRequest
localLayoutFingerprint
LocalLayoutCache
worker request count
worker latest-only behavior
Graphology x/y
```

Required regression:

```text
same topology/input
before vs after SPACING1B
→ exact same Local layout fingerprint
→ exact same accepted x/y positions
```

Manual Fit must produce:

```text
0 Local layout requests
```

Changing only camera ownership must produce:

```text
0 Local layout requests
```

---

# 20. SPATIAL1A is unrelated

SPATIAL1A currently applies folder-anchor preview composition to **All Network**.

Do not generalize SPACING1B into spatial overrides or folder positioning.

No shared persistence is needed.

Keep:

```text
SPATIAL1A → All Network displayed positions
SPACING1B → Focus Network camera framing
```

separate.

---

# 21. NETWORKPOLISH1 far-edge behavior must survive

Focus reference lines now remain visible even at far Local LOD.

SPACING1B will intentionally make sparse graphs use larger ratios, often closer to/farther into `far-local`.

Therefore specifically verify:

```text
densityFitRatio = 1.4
→ reference lines remain visible
```

Do not reintroduce disappearing lines through an LOD/camera interaction.

---

# 22. Visual density constants are provisional but centralized

The accepted initial constants are:

```text
reference frame: 1200×800
stage padding: 24

edge target:
min(180, 80 + 20√N)

nearest-neighbor / diameter target:
30 / √N

root radius target:
min(720, 200 + 70√N)

final ratio bounds:
0.7–1.4
```

Place them together with comments describing their units and SPACING1A origin.

Do not expose them in Settings yet.

Do not add a user-facing "density" slider in this slice.

During manual QA, if the user asks for tuning, adjust these centralized policy constants only after preserving the architectural contract and rerunning the fixture oracle.

---

# 23. Reuse the 15-fixture SPACING1A oracle

SPACING1A already has deterministic fixtures covering:

```text
two-reference
three-chain
three-star
five-chain
five-star
five-mixed-isolate
eight-star
ten-mixed
twenty-mixed
fifty-mixed
two-dense-clusters-bridge
long-chain
root-weak-and-isolated
hierarchy-heavy
reference-heavy
```

Do not rewrite a separate incompatible fixture universe.

Update the diagnostic tooling so it can verify the **actual production density policy**.

The production result for these fixtures should match the accepted SPACING1A B4 ratios within clearly documented rounding/tolerance.

Keep the visual comparison command usable:

```bash
pnpm analyze:focus-spacing
```

If the report/artifact changes because it now calls production code, preserve its deterministic output and documentation.

---

# 24. Pure density-policy tests

Cover:

```text
determinism
finite output
0.7 lower clamp
1.4 upper clamp
near-neutral dense cases
2-node case
3-node cases
isolates
multi-component
long chain
hierarchy-heavy
reference-heavy
fixed reference-frame invariance
```

Also verify:

```text
user presentation Size map
→ not an input
```

and:

```text
relative geometry
→ untouched because policy returns only a camera ratio
```

---

# 25. Session / canvas behavior tests

Add focused tests for at least:

### Fresh / automatic

```text
fresh Focus, no restored viewport
→ accepted layout computes density ratio
→ automatic camera adopts ratio

cache-hit layout
→ same density ratio
→ no worker required

worker result
→ ratio based on accepted latest result
```

### Transition

```text
fresh All→Focus transition anchor
→ density ratio adopted
→ anchor continuity preserved
```

### User ownership

```text
wheel before worker result
→ worker completion does not overwrite camera

drag/pan before worker result
→ no overwrite

Zoom + / −
→ no overwrite

center/search/navigation request
→ no overwrite
```

### Restored semantic camera

```text
initialViewport freeRatio
→ restored exactly
→ layout completion does not replace it
```

### Manual Fit

```text
manual Fit
→ latest density ratio
→ no layout request
→ ownership returns to AUTO
```

### Topology update

```text
AUTO camera
→ accepted changed layout recomputes/applies density ratio

USER camera
→ accepted changed layout recomputes but does not apply
→ next manual Fit uses new ratio
```

### Resize

```text
resize
→ density ratio unchanged
→ no automatic re-fit
```

---

# 26. VISUAL1B regression tests

Explicitly preserve:

```text
File Size slider
→ radius changes
→ x/y unchanged
→ camera ratio unchanged
→ density decision unchanged
→ 0 layout requests
```

Reset Size has the same invariants.

Existing 1.00→1.30 flicker regression must remain green.

Do not use reducer/display sizes in the density formula.

---

# 27. Navigation / history regression tests

Test current app-level flows:

```text
All Network → Focus Network
Focus reroot
Back
Forward
return to All
Network ↔ Focus Hierarchy ↔ Network
Search/selection center
QUERY1 Hide/unhide
Saved Query Apply
```

Density framing must not corrupt stored viewport history.

Particularly:

```text
Back/Forward Local viewport restoration
→ exact saved freeRatio
→ no immediate density snap
```

---

# 28. Operation-count contract

Add or extend the Local interaction contract where appropriate.

Expected:

```text
compute density after accepted layout
→ 0 extra projections
→ 0 extra topology reconciliation
→ 0 extra layout requests

automatic density framing
→ camera-only

manual Fit
→ camera-only

user pan/zoom ownership change
→ camera/state-only
```

The pure metric pass is O(N²) if implemented as naive nearest-neighbor scanning.

That is acceptable for current bounded Focus only if measured evidence supports it, but inspect current maximum Focus sizes and avoid unnecessary repeated work.

Preferred:

```text
compute once per accepted Local layout
cache only in session/canvas memory alongside latest accepted layout
```

Do not compute on every render, wheel event, or camera update.

If O(N²) becomes material in stress evidence, optimize the metric implementation without changing its exact result; do not weaken the policy silently.

No new generalized cache.

---

# 29. Performance validation

Measure the production density pass separately.

Use current Local benchmark profiles:

```text
smoke
small
medium
stress where practical
```

Record:

```text
density-policy computation time
number of evaluations
layout worker count unchanged
```

No CI timing threshold.

A small memory-only instrumentation phase/operation is acceptable if consistent with current renderer instrumentation.

Do not add analytics/network telemetry.

---

# 30. Browser graphical QA

Use production build/browser harness.

At minimum verify actual Focus Network with representative states corresponding to:

```text
2–3 nodes
5-node sparse
isolate/multi-component
10-node
long/elongated context if feasible
20-ish
dense 50-ish
```

If the normal app sample cannot naturally produce every diagnostic fixture, combine:

```text
production browser sample/filtering
+
SPACING1A deterministic comparison artifact
```

Do not add a permanent product-only test screen solely for this task unless there is already an established development harness seam.

Check:

```text
sparse graphs visibly more compact
dense graphs not crushed
nodes remain readable
labels sensible
reference lines remain visible
selection/hover/picking
manual Fit
wheel/pinch/pan
Network Explorer actions
Size overrides
clean console
```

---

# 31. Release desktop manual QA gate

This change is fundamentally visual.

Build a fresh optimized Windows executable.

Before merging, give the user a concise checklist and wait for explicit acceptance.

Recommended checklist:

```text
1. Open a sparse Focus Network with only a few nodes.
   → confirm nodes are materially closer than before.

2. Press Fit.
   → confirm it returns to the same sensible density,
      not the old ratio=1 full-screen spread.

3. Pan/zoom manually, then cause a graph update if practical.
   → camera must not snap back.

4. Back/Forward or reopen a saved Focus viewport.
   → saved zoom must be restored, not replaced.

5. Open a denser Focus graph.
   → confirm it is not over-compressed.

6. Check far zoom/reference lines.
   → lines remain visible.

7. Resize a File with Size.
   → radius changes without camera/layout movement.
```

If user feedback is only:

```text
too compact
still too sparse
dense graph slightly too tight
```

tune only centralized policy constants/bounds, rerun focused fixture + browser validation, rebuild, and repeat the relevant QA.

If feedback indicates **relative topology is wrong**, stop. That is evidence for a future C spike, not a reason to change ForceAtlas2 ad hoc in SPACING1B.

---

# 32. Documentation

Update current docs minimally, likely:

```text
packages/renderer-sigma/README.md
docs/ARCHITECTURE.md
docs/SPACING1A_FOCUS_DENSITY_SPIKE.md
docs/PERFORMANCE.md          if timing evidence is recorded
```

Document:

```text
Focus Free layout
= ForceAtlas2 geometry + density-aware camera Fit

density ratio
= derived, not persisted as a new preference

manual/saved camera
= authoritative until Fit

File Size override
= display-only and not part of density input
```

Do not rewrite historical prompts.

Archive this exact prompt under:

```text
history-implementations/
```

---

# 33. User-owned / cleanup constraints

Preserve unrelated user state.

Do not modify `AGENTS.md` instruction content.

SPACING1A left a Windows orphan directory after worktree cleanup:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-spacing1a
```

Git worktree registration was already removed.

Do not use, repair, or delete that orphan directory as part of SPACING1B unless the user explicitly asks.

Use a fresh isolated task worktree/branch.

Do not touch unrelated worktrees.

---

# Scope

## In scope

- production Local density policy;
- Sigma-faithful reference-frame metric calculation;
- B1/B2/B3 + median B4;
- final clamp `0.7–1.4`;
- automatic Focus camera framing;
- explicit auto vs user/semantic camera ownership;
- density-aware manual Fit;
- fresh-transition continuity;
- cache-hit and worker-result behavior;
- viewport/history preservation;
- tests for all SPACING1A fixtures;
- VISUAL1B regression;
- NETWORKPOLISH1 far-edge regression;
- performance evidence;
- browser QA;
- native visual QA;
- docs;
- PR/CI/cleanup after approval.

## Explicitly out of scope

Do not implement:

- coordinate scaling;
- disabling Sigma autoRescale/autoCenter;
- ForceAtlas2 parameter changes;
- ForceAtlas2 fork;
- new Local layout algorithm;
- node collision/`adjustSizes`;
- per-node displacement;
- Focus spacing slider;
- Global Network density changes;
- Focus Hierarchy changes;
- SPATIAL1 folder-anchor changes;
- new view-state schema;
- node Size affecting layout/density;
- adaptive gravity/scalingRatio C;
- Saved Views.

---

# Suggested implementation sequence

1. Sync latest `main` and inspect open/recent PRs.
2. Re-read `docs/SPACING1A_FOCUS_DENSITY_SPIKE.md`.
3. Inspect current Local session/canvas camera + transition + viewport behavior.
4. Extract/promote the minimal approved density policy into renderer-sigma.
5. Make diagnostics call the production policy rather than duplicate it.
6. Add pure 15-fixture parity tests.
7. Add session-local latest density decision storage.
8. Define/test auto vs user/semantic camera ownership.
9. Make manual Fit density-aware.
10. Apply density framing after accepted layouts only when auto-owned.
11. Preserve restored viewport and explicit center requests.
12. Handle transition-anchor continuity.
13. Mark wheel/pinch/pan/zoom buttons as user camera intent.
14. Verify topology updates under both ownership modes.
15. Add VISUAL1B / far-edge / fingerprint operation regressions.
16. Run focused renderer/tool tests.
17. Run Local benchmarks and record density timing.
18. Run full `pnpm check`.
19. Run desktop checks/build.
20. Browser graphical QA.
21. Build fresh optimized desktop executable.
22. Stop for user native visual acceptance.
23. If accepted: finalize PR → CI → merge → post-merge CI → cleanup.
24. Stop; do not start adaptive ForceAtlas2/SPACING1C automatically.

---

# Validation commands

Use current repository equivalents.

Expected:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/vault-diagnostics typecheck
pnpm exec vitest run tools/vault-diagnostics

pnpm analyze:focus-spacing

pnpm benchmark:local-renderer -- --profile smoke
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Add the smallest targeted browser/native commands used by the current repo.

No timing thresholds in CI.

---

# Exit gate

SPACING1B is complete only when:

1. ForceAtlas2 settings are unchanged.
2. raw Local layout positions are unchanged.
3. root coordinate normalization is unchanged.
4. layout fingerprints are unchanged by density framing.
5. Local layout cache keys/values are unchanged.
6. density policy returns only camera/framing information.
7. production uses a fixed 1200×800 reference frame.
8. production uses stage padding 24 consistently with Sigma.
9. B1 formula matches SPACING1A.
10. B2 formula matches SPACING1A.
11. B3 formula matches SPACING1A.
12. B4 is the median of the three raw signals.
13. one final `0.7–1.4` clamp is applied.
14. constants are centralized and documented.
15. 15 SPACING1A fixtures exercise the production policy.
16. production and diagnostic ratios stay in parity.
17. single-node/degenerate fallback is safe.
18. 2–3-node valid sparse graphs remain supported.
19. multi-component/isolate cases remain supported.
20. File Size overrides are not density inputs.
21. Size slider does not change density ratio.
22. Size slider does not change camera.
23. Size slider does not trigger layout.
24. Visual Groups do not change density ratio.
25. fresh Focus receives density-aware automatic framing.
26. transition-anchor continuity is preserved.
27. cache-hit accepted layout gets the same density policy.
28. latest worker accepted layout gets density policy.
29. stale worker output cannot alter camera/density decision.
30. automatic topology changes reframe only while camera remains auto-owned.
31. manual wheel/pinch zoom disables automatic reframing.
32. manual pan disables automatic reframing.
33. Zoom + / − disables automatic reframing.
34. explicit center/navigation preserves its requested freeRatio.
35. restored semantic viewport preserves its saved freeRatio.
36. Back/Forward viewport restore does not density-snap.
37. manual Fit uses the latest density ratio.
38. manual Fit re-enters auto-framing ownership.
39. resize does not recompute/reapply density.
40. manual Fit triggers zero layout requests.
41. density framing triggers zero extra layout requests.
42. no projection/workspace work is added by camera framing.
43. Focus far reference edges remain visible at ratio 1.4.
44. Global Network behavior is unchanged.
45. Focus Hierarchy behavior is unchanged.
46. SPATIAL1A behavior is unchanged.
47. local renderer operation-count tests pass.
48. density computation performance is measured.
49. focused tests pass.
50. `pnpm analyze:focus-spacing` passes.
51. full `pnpm check` passes.
52. desktop check/build pass.
53. browser QA passes.
54. fresh native build is supplied for visual QA.
55. user explicitly accepts sparse/dense visual balance before merge.
56. PR CI passes.
57. post-merge CI passes.
58. task branch/worktree cleanup completes.
59. SPACING1A orphan directory is untouched.
60. no adaptive ForceAtlas2 work is started automatically.

---

# Final report

Before the native merge gate, report:

## 1. Result

What sparse Focus graphs now do.

## 2. Production density formula

Show B1/B2/B3/B4 and current bounds.

## 3. Camera ownership

Explain exactly when automatic framing is allowed vs preserved user/semantic zoom.

## 4. Fit behavior

Manual Fit and fresh accepted-layout behavior.

## 5. Layout invariants

Confirm ForceAtlas2 positions, fingerprints, caches, worker counts unchanged.

## 6. VISUAL1B compatibility

Confirm per-File Size remains render-only.

## 7. SPACING1A parity

15-fixture ratios and diagnostic artifact.

## 8. Performance

Density-pass timing and evaluation count.

## 9. Automated/browser validation

## 10. Fresh native executable

Give the exact path.

## 11. Manual QA request

Ask the user only for the visual/interaction checks above.

Do not merge before explicit acceptance.

After acceptance and merge, report:

```text
SPACING1B complete.
B-camera production framing is active.
Adaptive ForceAtlas2 is not needed based on current evidence.
```

Do not start further spacing work automatically.
