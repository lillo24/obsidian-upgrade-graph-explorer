# SPACING1B-GLOBAL — Complete Network Density Framing for All + Focus and Clarify Sandbox Scope

**Task type:** feature completion + renderer/camera integration + diagnostic pass + Settings UI cleanup

## Goal / success outcome

Complete the density-framing work so it applies to **both Network scopes**:

```text
All + Network
Focus + Network
```

The original visual problem is especially important in **All + Network**, where many nodes can be independent or split across components. The existing draft PR #60 currently implements density-aware camera framing only for Focus Network.

This task should:

1. verify the density problem against the real All Network renderer rather than assuming the Focus formula transfers unchanged;
2. add a safe density-aware camera policy for All Network;
3. preserve the already-working Focus Network behavior;
4. make Sandbox scope explicit so All-only controls do not appear to be broken in Focus;
5. provide separate live A/B controls for All Network and Focus Network;
6. keep all density work camera-only and outside ForceAtlas2/layout identity;
7. keep PR #60 draft and unmerged until native QA passes in both Network scopes.

Success means I can use one release executable and do:

```text
All + Network:
0% density -> legacy framing
100% density -> proposed All density framing

Focus + Network:
0% density -> legacy framing
100% density -> proposed Focus density framing
```

with visible, deterministic differences where the graph is genuinely sparse, while dense graphs remain sensible and manual camera control is never stolen unexpectedly.

---

## Current evidence

Repository:

```text
lillo24/icarus-graph-explorer
```

Existing draft PR:

```text
#60 — SPACING1B: density-aware Focus camera framing
branch: codex/spacing1b-density-camera
head at plan-writing time: 4134eb55e062b8ab245881215631d32ab3095e89
base main at plan-writing time: 16bbd2208593cb320c9ab57affafbf0b7dee0a11
status: draft / unmerged
```

PR #60 currently provides:

- Focus Network density measurement;
- a bounded camera ratio;
- 0–100% transient Focus density A/B strength;
- automatic-vs-user camera ownership;
- density-aware Focus Fit;
- runtime-only QA diagnostics;
- Settings reorganized into Preferences / Sandbox / Source & Diagnostics.

The Focus implementation is now confirmed to work visually in the native executable.

### Important scope fact

The existing layout controls are intentionally **All Network only**.

Current application policy:

```ts
globalLayoutSettingsApplyImmediately(scope, layout)
-> scope === 'all' && layout === 'network'
```

So the following not changing Focus Network is expected behavior, not an executable regression:

```text
Folder clustering
Folder clustering strength
Compact / Normal / Spacious spacing
Reference pull
Folder separation
All Network Base node size
All Network degree-size influence
All Network link thickness
All Network label threshold
```

Do not make these silently affect Focus as part of this task.

### Recent main changes that must be preserved

Several relevant Global renderer changes have already merged:

```text
#59 SPATIAL1B
-> direct All Network folder cluster placement

#61 GLOBALVIS1
-> split Global settings into physics vs render-only visual settings

#62 FOLDERQUERY1
-> exact folder query / Hide folder

#63 SPATIAL2A
-> schema-v2 hierarchical soft folder attractors
-> base automatic positions
-> dynamic pull positions
-> fixed folder placement composition
```

Before editing PR #60, integrate the latest `main` again and preserve all of these behaviors.

### Current All Network renderer behavior

All Network uses the separate Global Sigma path:

```text
GlobalGraphView
-> GlobalGraphCanvas
-> GlobalRendererSession
```

The Global renderer currently uses Sigma with:

```text
stagePadding: 24
minCameraRatio: 0.02
maxCameraRatio: 6
```

and its current Fit is effectively:

```text
Sigma animatedReset()
-> x = 0.5
-> y = 0.5
-> ratio = 1
-> angle = 0
```

Global final displayed positions can be more than raw ForceAtlas2 output because the current pipeline can include:

```text
automatic ForceAtlas2 positions
-> dynamic folder-pull positions
-> fixed folder placement composition
-> displayed positions
```

Therefore All Network density must be based on what is actually displayed, not blindly on the original worker output.

### Important evidence from SPACING1A

SPACING1A already established for Sigma 3.0.3 that raw uniform coordinate scaling is neutralized by Sigma auto-rescaling:

```text
raw coordinate compression
-> Sigma autoRescale
-> same fitted screen extent
```

The useful correction layer is therefore the camera/framing layer.

That architectural result probably applies to Global Sigma too, but verify it directly before production adoption.

---

## Scope / non-scope

### In scope

- Continue on the existing PR #60 branch.
- Integrate current `main` before implementation.
- Add All Network density analysis using the real Global renderer pipeline.
- Add production All Network density-aware camera framing if the evidence supports it.
- Preserve existing Focus Network density behavior exactly unless a shared-core refactor is required.
- Add separate transient Sandbox strengths:
  - All Network Density
  - Focus Network Density
- Add live QA diagnostics for both renderers while PR #60 remains under native QA.
- Clarify Sandbox UI by scope.
- Preserve Global folder arrangement, dynamic Pull, fixed placement, visual controls, queries, and persistence.
- Update tests, benchmarks, docs, and the archived prompt.
- Produce a fresh optimized desktop executable for native QA.

### Non-scope

Do not:

- make existing All Network physics controls affect Focus;
- make existing All Network visual controls affect Focus;
- redesign ForceAtlas2;
- adapt Global ForceAtlas2 gravity/scaling based on node count;
- fork ForceAtlas2;
- alter graph topology;
- alter QUERY1, Visual Groups, Network Explorer semantics, or folder-query semantics;
- alter spatial schema-v2 behavior;
- change fixed folder placements;
- introduce a persistence migration just for density A/B controls;
- merge PR #60 before explicit native acceptance;
- generalize every graph appearance setting across renderers in this task.

A future cross-renderer visual-preferences cleanup can be separate.

---

# Implementation guidance

## 1. Integrate current main first

Before modifying PR #60:

1. inspect `AGENTS.md`;
2. inspect current branch/worktree state;
3. integrate latest `main`;
4. verify merged PRs #61–#63 remain intact;
5. resolve conflicts by preserving newer Global renderer behavior;
6. keep PR #60 draft.

Do not discard:

```text
GLOBALVIS1 render-only visual controls
SPATIAL1B fixed folder positions
SPATIAL2A dynamic folder Pull
FOLDERQUERY1 behavior
```

---

## 2. Trace the actual All Network screen pipeline

Before choosing the Global formula, document and test the installed path:

```text
Global mapping
-> automatic ForceAtlas2
-> optional dynamic folder Pull
-> optional fixed folder positions
-> final displayed coordinates
-> Sigma normalization / autoRescale
-> Global camera
-> screen pixels
```

Confirm experimentally that:

```text
P
vs
0.5 x P
```

still produce the same screen geometry under the same Global camera because of Sigma auto-rescaling.

Do not simply cite the Local result.

Also confirm:

- how current Global Fit behaves;
- how restored Global semantic viewports behave;
- how query/topology changes affect the camera;
- how folder arrangements affect final displayed extent;
- whether the Global renderer currently owns any implicit auto-camera behavior after layout completion.

Document this in the density report.

---

## 3. Add an All Network density diagnostic matrix

Extend the existing diagnostic ecosystem rather than creating unrelated one-off tooling.

A reasonable command is:

```text
pnpm analyze:network-spacing
```

or extend the existing analysis command with separate Local/Global sections.

The exact command is flexible.

### Required Global fixture families

At minimum include deterministic cases for:

```text
1 node

2 independent nodes
3 independent nodes
5 independent nodes
10 independent nodes
20 independent nodes
50 independent nodes

2 connected nodes
3-node chain
5-node star
10-node mixed graph
20-node mixed graph
50-node mixed graph

mixed connected + isolates
many components
two dense clusters with no bridge
two dense clusters with one bridge
long chain
reference-heavy graph

folder-clustered graph
same graph with weak folder clustering
same graph with strong folder clustering

dynamic Pull example
fixed folder-placement example
dynamic Pull + fixed placement example

query-reduced / filtered sparse projection

larger stress profiles
100 nodes
500 nodes
1,000 nodes
```

The original user problem particularly concerns graphs with many independent nodes, so **zero-edge and multi-component fixtures are mandatory**.

Do not require a connected edge for a valid Global density decision.

---

## 4. Measure Global graph-space and screen-space density

For each fixture record at least:

### Topology

```text
node count
edge count
component count
isolated-node count
largest-component size
```

### Final displayed geometry

Use the **final displayed positions** after the relevant spatial composition.

Measure:

```text
median nearest-neighbor distance
p10 / p90 nearest-neighbor distance

median connected-edge distance when edges exist

robust overall extent
p90 / p95 radial distance from a robust graph center
bounding width / height

component-center separation where useful
```

### Screen-space

Use a canonical reference frame such as:

```text
1200 x 800
stagePadding 24
```

Measure:

```text
median nearest-neighbor px
median connected-edge px when defined
p90/p95 displayed radius
viewport occupancy
fraction of nodes inside the useful viewport
```

Also check a smaller viewport to confirm policy invariance.

Do not use private vault names/content in committed diagnostic output.

---

## 5. Do not blindly copy the Focus formula

The current Focus policy uses:

```text
connected edge distance
nearest-neighbor density
root radius
```

All Network has no semantic Focus root and may have zero edges.

Create a Global-specific policy that shares low-level math where useful but has its own semantics.

### Preferred shared architecture

Aim for something like:

```text
network-density-core.ts
├─ Sigma canonical normalization helpers
├─ percentile / robust-distance helpers
├─ clamp / validation
└─ screen-density primitives

local-density.ts
-> Focus-specific policy
-> root-aware

global-density.ts
-> All-specific policy
-> rootless / component-safe / zero-edge-safe

local-density-framing.ts
or a renamed shared framing module
-> interpolation between legacy ratio 1 and a density decision
```

Exact filenames are flexible.

Do not force Local and Global through one inappropriate formula just to reduce files.

### Focus parity gate

If Local density code is refactored to share primitives:

```text
all existing 15 SPACING1A Focus fixtures
-> identical raw decision ratios
-> identical effective ratios
```

within floating-point tolerance.

Native Focus behavior must not regress.

---

## 6. Global candidate policy

Evaluate a small B-camera family before fixing constants.

A likely Global policy should use:

### Signal A — nearest-neighbor visual density

This should be the primary signal because it works even when:

```text
edges = 0
```

and directly measures the user's "nodes are spread too far apart" complaint.

### Signal B — connected-edge distance

Use when enough valid edges exist.

Do not make it mandatory.

### Signal C — robust overall extent / radius

Use a rootless robust center:

```text
median/robust center
or
the Sigma-normalized scene center
```

and a p90/p95 radius or comparable robust extent.

This prevents a small dense cluster plus widely spread independent nodes from fooling the nearest-neighbor metric.

### Optional visibility guard

The Global policy must not zoom so far in that ordinary outlying components disappear unnecessarily.

Evaluate a guard such as:

```text
at proposed ratio
-> at least a high fraction of nodes remains inside the useful viewport
```

Use evidence to choose the exact threshold rather than inventing a brittle magic number.

### Combination

Prefer a bounded, explainable combination such as:

```text
median of available robust signals
-> one final clamp
```

rather than a complex optimizer.

Start comparison around the existing Focus bound family:

```text
0.7–1.4
```

but do not assume it is optimal for Global.

If Global evidence clearly supports a different conservative bound, document why.

Do not use extreme corrections.

---

## 7. Density must remain camera-only

All Network density must not enter:

```text
GlobalLayoutSettings
ResolvedGlobalPhysicsSettings
globalLayoutFingerprint()
GlobalLayoutCache
ForceAtlas2 worker requests
dynamic Pull worker requests
spatial-rule fingerprints
fixed folder placements
presentation overrides
Visual Groups
QUERY1
```

Changing All Network Density strength must produce:

```text
0 automatic layout requests
0 dynamic Pull requests
0 spatial persistence writes
```

It changes camera framing only.

This boundary is especially important because GLOBALVIS1 deliberately separated Global visual presentation from physics/layout identity.

---

## 8. Measure the final displayed Global positions

The Global density decision must describe the scene the user actually sees.

Therefore update the latest Global density decision whenever a **confirmed displayed geometry** becomes authoritative, including:

```text
fresh automatic layout
cache-restored automatic layout
topology-reconciled layout
dynamic Pull result
fixed folder placement composition
dynamic Pull + fixed composition
confirmed folder arrangement commit
```

But distinguish confirmed state from pointer preview.

### Arrange Folders preview

During live pointer/keyboard preview:

```text
DO NOT
recalculate density every frame
DO NOT
auto-adjust camera every frame
```

That would fight the user.

After a confirmed arrangement becomes authoritative:

```text
update the stored density decision
```

but preserve user camera ownership.

The next explicit Fit can use the new decision.

---

## 9. Add Global camera ownership

Implement the same conceptual ownership rule as Focus, adapted to the Global renderer:

```text
auto-owned
user-owned
```

### Auto-owned

Examples:

```text
fresh All Network mount without restored viewport
explicit Fit
```

When a new confirmed displayed geometry arrives while still auto-owned, the camera may adopt the current All density ratio.

### User-owned

Mark user-owned after explicit navigation such as:

```text
wheel zoom
pinch zoom
stage drag / pan
zoom buttons
search/node centering where current product semantics treat it as navigation
restored semantic viewport
folder arrangement interaction
density slider preview
```

Once user-owned:

```text
query changes
topology changes
worker completion
dynamic Pull completion
fixed-position adoption
```

must not unexpectedly replace the user's ratio.

Use actual event seams already available in Sigma; do not add global DOM listeners unless necessary.

---

## 10. Global density slider behavior

Add a separate transient control:

```text
All Network Density
0% ───────── 100%
Legacy           Auto
```

Keep Focus separate:

```text
Focus Network Density
0% ───────── 100%
Legacy           Auto
```

Do not use one shared percentage unless evidence shows that is clearly better.

At application start:

```text
All Network Density   = 100%
Focus Network Density = 100%
```

For either renderer:

```text
effectiveRatio =
1 + (rawDecisionRatio - 1) * strength / 100
```

### Live preview

Moving the slider while that renderer is mounted is an explicit camera action:

```text
move slider
-> immediately apply effective ratio
-> preserve a stable semantic/visual anchor
-> do not relayout
-> resulting viewport becomes user-owned
```

If that scope is not currently mounted, update only the transient setting; apply it when that Network scope is entered.

---

## 11. Global Fit

Change Global Fit from unconditional Sigma ratio `1` to:

```text
center / reset angle
+
current effective All density ratio
```

Fit remains camera-only.

Repeated Fit on unchanged geometry and unchanged density strength must return to the same state.

At:

```text
All density 0%
```

Fit must reproduce the legacy ratio-1 behavior.

At:

```text
All density 100%
```

Fit must use the current Global density decision.

---

## 12. Preserve Global semantic viewport/history

All density framing must not break:

```text
Back / Forward
restored All Network viewport
search centering
selection
mode transitions
saved semantic camera state
```

A restored viewport is user-owned and should preserve its stored ratio.

Do not silently replace a restored ratio with the density default merely because the renderer remounted.

---

## 13. Clarify Sandbox UI by scope

The current Sandbox made the pre-existing All-only controls look broken in Focus.

Reorganize the content so scope is visually explicit.

Recommended structure:

```text
Sandbox

Focus
├─ Focus Root appearance

Network Density
├─ All Network Density
│  └─ 0–100% Legacy -> Auto
└─ Focus Network Density
   └─ 0–100% Legacy -> Auto

All Network
├─ Folder clustering
├─ Folder clustering strength
├─ Spacing
│  ├─ Compact
│  ├─ Normal
│  └─ Spacious
└─ Advanced
   ├─ Layout
   │  ├─ Reference pull
   │  └─ Folder separation
   └─ Visual
      ├─ Base node size
      ├─ Link influence on node size
      ├─ Link thickness
      └─ Label threshold

Experimental
└─ Show All Hierarchy

Reset Sandbox
```

Add concise scope notes where useful:

```text
All Network controls apply only to Scope = All, Layout = Network.
```

Do not disable the controls merely because the user is currently in Focus; it is acceptable to tune them and see the result when returning to All.

But the UI must not imply that they are Focus controls.

---

## 14. Temporary QA diagnostics for both scopes

Keep the existing Focus diagnostics during this draft phase and add Global equivalents.

For whichever renderer is mounted, show:

```text
Raw decision ratio
Effective ratio
Sigma camera ratio
Fallback: Yes/No
Fallback reason, if any
```

For Global also consider showing only if cheap:

```text
node count
edge count
isolated-node count
```

These are useful because zero-edge graphs are a first-class test case.

Do not add awkward renderer->React coupling solely for extra metrics beyond the required values.

Diagnostics remain:

```text
runtime only
not persisted
not part of layout input
not part of density input
```

Once native QA is accepted, remove or explicitly downgrade the temporary diagnostic block before final merge unless the user asks to retain it.

---

## 15. Global fallback behavior

Global density must handle these safely:

```text
0 nodes / empty projection
1 node
all nodes independent
duplicate/invalid coordinates
degenerate extent
non-finite metrics
```

Do not require edges.

A valid independent-node graph should produce a real density decision rather than falling back simply because:

```text
edge count = 0
```

Fallback should be reserved for genuinely unusable geometry.

Fallback ratio remains:

```text
1
```

and diagnostics must state the reason.

---

## 16. Performance

Global density analysis must be inexpensive enough for normal All Network use.

Avoid naïve full pairwise nearest-neighbor computation at large `N` if it would create O(N²) behavior on thousands of nodes.

The Focus implementation is small enough for direct pairwise work; Global may not be.

Choose a deterministic scalable method for nearest-neighbor estimation/exact computation, such as:

```text
spatial grid
k-d tree if already available without adding a dependency
bounded deterministic sampling
another evidence-backed internal approach
```

Prefer no new dependency.

Benchmark at least:

```text
100
500
1,000
5,000 nodes
```

and report the algorithmic complexity.

Density work must never block the Global layout worker path or duplicate a layout.

---

## 17. Reset Sandbox

Extend Reset Sandbox so it resets both transient density controls:

```text
All Network Density   -> 100%
Focus Network Density -> 100%
```

while preserving its existing strict boundary.

It must not reset:

```text
Trackpad Zoom
source configuration
queries
Saved Filters
navigation/history
vault data
spatial folder positions unless those are already intentionally Sandbox-owned
```

Be especially careful not to erase persisted SPATIAL1B/SPATIAL2A folder placement intent merely because the controls are shown inside Sandbox.

---

# Validation

## Focus parity

The existing Focus suite must remain green.

At minimum verify:

```text
all 15 SPACING1A fixtures
same raw Focus ratios as before
same 0/50/100 interpolation
same camera ownership
same Fit behavior
same reference-line visibility
same size-override independence
```

If shared-core refactoring changes any Focus fixture result beyond floating-point noise, stop and explain why.

---

## Global density tests

Add focused tests for:

### Policy

```text
independent nodes produce non-fallback decisions
zero-edge graphs work
1-node behavior is safe
sparse graphs request stronger framing than comparable dense graphs
dense graphs remain near neutral
large graphs remain bounded
all ratios finite
deterministic output
```

### Geometry

Density changes must preserve:

```text
Graphology x/y
automatic positions
dynamic Pull positions
fixed positions
relative geometry
layout fingerprints
cache keys
```

### Camera

Verify:

```text
fresh auto-owned mount adopts All density
slider preview applies immediately
slider preview preserves semantic/visual anchor
slider preview creates no layout
manual pan/zoom becomes user-owned
topology change does not steal user camera
dynamic Pull completion does not steal user camera
fixed-placement adoption does not steal user camera
Fit returns to auto-owned
Fit at 0% = legacy ratio 1
Fit at 100% = raw Global density decision
restored viewport retains saved ratio
```

### Arrange Folders

Verify:

```text
live drag does not recalculate/reframe camera every frame
confirmed placement updates latest density decision
confirmed placement does not steal current camera
next Fit uses the updated decision
```

### Settings

Verify:

```text
Preferences / Sandbox / Source & Diagnostics still accessible
All-only controls are clearly grouped as All Network
All density slider exists
Focus density slider exists
Reset Sandbox resets both density strengths
Trackpad Zoom unaffected
Source & Diagnostics unaffected
keyboard tab navigation intact
no overflow regression
```

---

## Performance validation

Run the repository's current equivalents, including:

```bash
pnpm check

pnpm desktop:check
pnpm desktop:build

pnpm analyze:focus-spacing
# plus new/extended global/network density analysis

pnpm benchmark:local-renderer
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
```

Add a density-specific Global stress benchmark if the existing benchmark cannot isolate the work.

Verify:

```text
0 additional Global ForceAtlas2 requests
0 additional spatial Pull requests
```

when only density strength changes.

Run `git diff --check`.

---

# Native graphical QA

Build a fresh optimized executable and provide exact path + SHA-256.

Keep PR #60 draft.

## A. All Network — original target problem

Use a real All Network view with many independent nodes.

Test:

```text
All Density = 0%
-> observe legacy framing

All Density = 100%
-> observe proposed density framing
```

Do this without changing the underlying layout.

The difference should be visibly meaningful on a sparse graph.

## B. All Network — dense graph

Use a dense/full-vault All Network view.

100% must not produce excessive crowding or crop the graph unreasonably.

## C. Query-reduced All Network

Apply a query that leaves only a small/sparse subset.

The automatic density decision should adapt to the displayed sparse result if the camera is auto-owned.

If manually zoomed/panned first, the query change must not steal the camera.

## D. Independent-only case

Use or synthesize a projection with no reference edges if practical.

It must still receive a valid Global density decision.

## E. Folder clustering

Change:

```text
Folder clustering strength
Spacing
Reference pull
```

in **All Network** and verify these still change layout as intended.

Then return to Focus and verify they remain intentionally inactive there.

## F. Spatial positions

Verify existing:

```text
Arrange Folders
fixed placements
dynamic Pull
```

still work.

Dragging a folder must not make density fight the pointer.

## G. Focus regression

Repeat a known Focus sparse graph:

```text
Focus Density 0%
Focus Density 100%
```

and confirm the existing Focus behavior is preserved.

## H. History/camera

Verify:

```text
manual All pan/zoom
-> query/topology update
-> camera preserved

Back / Forward
-> stored All viewport restored

Fit
-> density-aware framing
```

## I. Sandbox clarity

Confirm it is obvious from the UI that:

```text
All Network layout controls
!= Focus controls
```

and that both density controls have explicit scope.

---

# Evidence gate

If the Global diagnostic shows that the All Network problem is **not** primarily camera occupancy, do not force the Focus policy into Global.

In that case:

1. leave Focus behavior intact;
2. keep PR #60 draft;
3. document the Global evidence;
4. state which layer actually causes the Global problem;
5. stop before modifying Global ForceAtlas2.

However, if Global shows the same Sigma occupancy mechanism—as expected—complete the B-camera implementation in this task.

Do not move to adaptive ForceAtlas2 without a separate explicit decision.

---

# PR / merge handling

This work corrects the intended scope of the existing feature, so keep it in PR #60 rather than creating an independent competing density PR.

Once All + Focus are both implemented and native QA is ready, update PR #60 title/body to reflect the real scope, e.g.:

```text
SPACING1B: density-aware Network camera framing
```

Do not merge automatically.

Wait for explicit user acceptance of native QA in both:

```text
All + Network
Focus + Network
```

Only after acceptance:

- remove/downgrade temporary QA diagnostics as agreed;
- update final docs;
- ensure archived implementation prompt is present;
- mark ready/merge according to normal repository workflow.

---

# Likely implementation areas

Inspect first; do not treat this as a mandatory file list.

Likely relevant:

```text
packages/renderer-sigma/src/network-density-core.ts       (possible new)
packages/renderer-sigma/src/global-density.ts             (possible new)
packages/renderer-sigma/src/local-density.ts
packages/renderer-sigma/src/local-density-framing.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/types.ts

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/preferences/sandbox-settings.ts

tools/vault-diagnostics/...
docs/SPACING1A_FOCUS_DENSITY_SPIKE.md
docs/<Global/network density report>

history-implementations/
```

Avoid unnecessary changes to unrelated packages.

---

# Final report

Report:

1. whether Global showed the same Sigma occupancy mechanism;
2. All Network raw density formula and why it differs from / matches Focus;
3. zero-edge / independent-node handling;
4. chosen Global ratio bounds;
5. whether final displayed positions include dynamic/fixed spatial composition in density measurement;
6. Global camera-ownership contract;
7. All vs Focus density slider behavior;
8. Sandbox organization and explicit scope labels;
9. confirmation that existing All layout controls still affect only All Network;
10. confirmation that Global visual settings remain render-only;
11. confirmation that ForceAtlas2/layout fingerprints/caches are unchanged by density;
12. density performance at 100 / 500 / 1,000 / 5,000 nodes;
13. files changed;
14. tests/checks/benchmarks run;
15. fresh release executable path + SHA-256;
16. any deviations from this plan;
17. any remaining concerns;
18. explicit confirmation that PR #60 remains draft/unmerged pending native QA.
