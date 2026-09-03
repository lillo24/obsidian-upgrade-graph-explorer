# VISUAL1B QA correction — eliminate Size-slider Network layout flicker

**Task type:** bug fix / renderer architecture correction / performance regression fix / native-QA blocker

## Goal / success outcome

Fix the severe Network flicker discovered during native QA of PR #51.

Changing a File's per-node Size multiplier must be **render/presentation-only**:

```text
change File size multiplier
→ that File visibly changes size
→ graph coordinates remain unchanged
→ no ForceAtlas2 request
→ no layout-cache fingerprint change
→ no unrelated node movement
```

The current observed behavior is much worse than a normal layout adjustment:

```text
drag Size linearly, e.g. 1.00× → 1.30×
→ unrelated connected nodes rapidly jump between near/far states
→ visually resembles random flicker
```

Do not merge PR #51 until this correction and renewed native QA pass.

Keep this work inside the existing draft PR #51 / VISUAL1B branch unless repository state makes that impossible.

---

# Diagnosis

This is not primarily a collision/occupied-space response to a larger node.

The current VISUAL1B implementation accidentally turns every Size-slider step into another **whole-graph ForceAtlas2 refinement**.

At the current PR head, the path is:

```text
presentationOverrides changes
        ↓
mapProjectionToGlobal / mapProjectionToLocalTopology
writes the custom multiplier into node.attributes.size
        ↓
renderer input changes
        ↓
layout request contains the changed node size
        ↓
layout fingerprint changes because node.size is fingerprinted
        ↓
no exact cache hit for the new slider value
        ↓
Global/Local layout effect starts ForceAtlas2 again
        ↓
new whole-graph coordinates are applied
```

This is directly visible in the current implementation:

- `mapProjectionToGlobal(..., presentationOverrides)` applies `applyNetworkNodeSizeScale(...)` before producing renderer/layout input;
- `mapProjectionToLocalTopology(..., presentationOverrides)` does the same;
- `createGlobalLayoutRequest()` copies `attributes.size`;
- `globalLayoutFingerprint()` includes `node.size`;
- `createLocalLayoutRequest()` copies `attributes.size`;
- `localLayoutFingerprint()` includes `node.size`;
- both `GlobalGraphCanvas` and `LocalGraphCanvas` depend on `presentationOverrides` while building mapping/topology and layout inputs.

The existing VISUAL1B test even intentionally asserts:

```text
per-File size changes
→ different Global fingerprint
→ different Local fingerprint
```

That test encodes the bug and must be replaced.

---

# Why the movement looks wildly unstable instead of smoothly responding to size

The important extra finding is that the current ForceAtlas2 configuration does **not** enable node-size-aware forces.

The repository uses:

```text
graphology-layout-forceatlas2 0.10.1
```

and both Global and Local calls do:

```ts
forceAtlas2.assign(graph, {
  ...
  settings: {
    ...forceAtlas2.inferSettings(graph),
    ...
  },
})
```

without enabling:

```text
adjustSizes: true
```

For graphology ForceAtlas2 0.10.1, `adjustSizes` defaults to `false`.

Therefore the custom visual radius is being included in the **cache/fingerprint invalidation**, but it is not actually the intended physical cause of the subsequent ForceAtlas2 motion.

In other words, a slider change currently behaves approximately like:

```text
"run another block of layout iterations"
```

even when the changed visual size contributes no corresponding node-radius force.

This explains the user's strongest observation:

```text
resize an isolated Note.md
→ Source.md and Target.md change distance dramatically
```

The Source/Target movement is not evidence that Note.md needs more geometric room. The whole layout is simply being solved/refined again.

---

# Why repeated relayout can produce near/far flicker

The current canvases warm new requests from the **current live graph coordinates**:

```text
session.createLayoutRequest(...)
→ copy this.graph current x/y
→ run another fixed ForceAtlas2 iteration block
```

For small All Network graphs this is typically another 100 iterations.

With folder clustering enabled, Global layout also interleaves ForceAtlas2 and the chunked folder prior multiple times per request.

So a sequence such as:

```text
1.00×
1.05×
1.10×
1.15×
1.20×
1.25×
1.30×
```

can currently become a sequence of repeated finite simulation/refinement passes.

Rapid slider input additionally invokes the latest-result-wins worker policy:

```text
new request
→ terminate/reject active older worker
→ start replacement
```

That protects against stale results being applied out of order, but it does **not** make repeated whole-graph solves visually stable.

Small layouts can finish quickly enough that some intermediate slider steps complete and apply an entire new position set before the next step arrives. Other requests are superseded.

The result can therefore look timing-dependent and flickery even though there is no intended random node movement.

Do not "fix" this by:

- debouncing the slider;
- lowering ForceAtlas2 iterations;
- animating between the jumping layouts;
- increasing worker cancellation;
- changing folder strength;
- adding collision physics;
- pinning Source/Target;
- adding a cache entry for every multiplier.

Those approaches would only hide or reduce the accidental relayout.

The correct semantic fix is:

```text
per-File visual size override
≠ layout input
```

---

# Product decision

Per-File VISUAL1B Size is a **visual presentation override only**.

It should scale the radius drawn by Sigma while retaining the coordinates generated from the normal automatic Network graph.

Conceptually:

```text
LAYOUT / AUTOMATIC SIZE
global automatic size
or Focus semantic File/root base size
        ↓
normal graph/layout attributes

PRESENTATION
normal rendered size
× optional per-File multiplier
        ↓
Sigma displayed node size
```

The per-File multiplier must not become part of:

```text
GlobalLayoutRequest
LocalLayoutRequest
globalLayoutFingerprint
localLayoutFingerprint
layout cache identity
ForceAtlas2 input
folder-prior input
```

This correction does **not** require changing the existing KG13 rule that the renderer's normal/automatic semantic node sizes are fingerprinted.

Keep the scope narrow:

```text
normal automatic node size may remain a layout/fingerprint concept
per-File VISUAL1B multiplier must be style-only
```

Do not broadly redesign all existing Global size settings unless required by evidence.

---

# Current corrected Size UI — preserve it

The previous QA correction is already complete.

The File action editor is now:

```text
Size
0.50× ─────────●──────── 2.50×
               1.30×
Reset
```

There is no Auto/Custom selector.

Preserve that UI.

Do not reopen the UI design in this task except for changes strictly necessary to wire the corrected render-only behavior.

Current semantics remain:

```text
no registry entry
→ displayed control = 1.00×

slider movement
→ store multiplier immediately

Reset
→ remove registry entry
→ return to calculated size × 1.00
```

---

# Required architecture

## 1. Restore mapping/layout inputs to automatic size only

Remove VISUAL1B `presentationOverrides` from the Global mapping calculation.

Desired:

```ts
mapProjectionToGlobal(
  projection,
  settings,
)
```

produces the normal VISUAL1A automatic node sizes only.

Per-file override changes must not alter the returned `GlobalRendererInput`.

Likewise, restore Local topology mapping so:

```ts
mapProjectionToLocalTopology(
  projection,
  rootEntityId,
)
```

produces the existing semantic sizes:

```text
Focus root File  8.4
File             6.4
Heading          4.7
Block            3.1
Diagnostic       3.8
```

without per-file overrides.

Do not remove `applyNetworkNodeSizeScale`; move its use to the presentation/style layer.

---

## 2. Treat presentation overrides similarly to style-only Visual Groups

Both Sigma sessions already have renderer-only state for Visual Groups:

```text
visualGroupStyles
→ node reducer
→ targeted renderer refresh
→ zero ForceAtlas2 work
```

Use the same architectural class of solution for File size overrides.

Add session-owned state such as:

```ts
private presentationOverrides:
  EntityPresentationOverrideMap | undefined
```

to:

```text
GlobalRendererSession
LocalRendererSession
```

Initial session options should be able to receive the current override map so the first frame is correct.

Add a setter such as:

```ts
setPresentationOverrides(...)
```

or a better repo-consistent name.

The setter must update Sigma presentation only.

It must never call/create:

```text
createGlobalLayoutRequest
createLocalLayoutRequest
layoutService.layout
resetPositions
```

---

## 3. Apply effective size in the Sigma node reducer/style resolver

For All + Network:

```text
attributes.size
= automatic VISUAL1A size

effective displayed size
=
applyNetworkNodeSizeScale(
  attributes.size,
  File override sizeScale
)
```

Only canonical File/document nodes receive the multiplier.

Diagnostic targets remain unchanged.

For Focus + Network:

```text
attributes.size
= existing semantic Local node size

effective displayed size
=
applyNetworkNodeSizeScale(
  attributes.size,
  File override sizeScale,
  attributes.root
)
```

Only File/document nodes receive the override.

Heading, Block and Diagnostic remain unchanged.

Preserve the Focus-root minimum behavior.

---

## 4. Keep label behavior coherent with displayed size

All Network currently uses node size as part of LOD label visibility.

After moving VISUAL1B size to the reducer, do not accidentally make:

```text
visual node becomes 2.5× larger
but label logic still reasons only from unscaled displayed radius
```

Compute the effective display size once and use it consistently where size-sensitive presentation logic requires it.

Do not change unrelated LOD thresholds.

Focus label policy is mostly kind/root/LOD based; preserve it unless the reducer needs the effective size for another established reason.

---

## 5. Refresh Sigma correctly for a size change

A Size change is render work, but it may require more than `scheduleRender()` because Sigma caches reducer output.

Use an appropriate `renderer.refresh(...)` path.

Important:

Visual Groups currently use:

```text
skipIndexation: true
```

because their changes are color/style-only.

Do **not** blindly copy that flag for node radius.

A changed rendered size can affect:

- node display data;
- hit testing;
- hover target extent;
- label collision/index data.

Inspect Sigma 3.0.3 behavior and choose the narrowest correct partial refresh for the affected node(s).

The hard requirement is:

```text
Sigma process/index refresh if needed
is allowed

ForceAtlas2 layout is not
```

Do not conflate renderer indexation with graph layout.

---

## 6. Refresh only affected File nodes where practical

Slider movement can emit many updates.

Avoid repainting every node in a 10k-file All Network on every tick if a narrow update is practical.

Prefer:

```text
old override map
vs
new override map
→ determine EntityIds whose sizeScale changed
→ resolve currently visible node key(s)
→ refresh only those nodes
```

A small stable `EntityId → ProjectionNodeId/node key` lookup owned by the session is acceptable.

Keep it synchronized when topology changes.

For bounded Focus Network, a small scan may be acceptable if simpler and measured.

Do not create a general new cache.

---

## 7. Coexist safely with topology refresh

KG14A/KG14B already contains protections around Sigma partial refresh during topology changes.

A size-style refresh must not reintroduce:

```text
"node ... can't be repaint"
```

when Hide/query/live updates add/remove nodes.

If a topology process/render boundary is currently pending:

```text
coalesce/defer size refresh
→ apply against the new indexed topology
```

Reuse/generalize the existing pending-style-refresh logic narrowly if appropriate.

Do not duplicate fragile race-handling paths.

---

# GlobalGraphCanvas correction

Currently the Global canvas does:

```text
presentationOverrides
→ mapping useMemo dependency
→ requestTemplate
→ fingerprint
→ layout effect
```

Change the ownership.

Desired dependency flow:

```text
projection/settings
→ mapProjectionToGlobal
→ normal layout input/fingerprint

presentationOverrides
→ independent effect
→ session.setPresentationOverrides(...)
→ renderer-only node refresh
```

Therefore:

- remove `presentationOverrides` from the mapping `useMemo` dependency;
- do not put it in `requestTemplate`;
- do not put it in `fingerprint`;
- do not trigger the layout effect when only presentationOverrides changes;
- pass initial overrides into the mounted session;
- update session overrides through a separate effect.

A multiplier drag after layout readiness should keep:

```text
instrumentation global-layouts count
```

unchanged.

---

# LocalGraphCanvas correction

Currently Focus Network does:

```text
presentationOverrides
→ mapProjectionToLocalTopology
→ seeded input
→ local request/fingerprint
→ Local ForceAtlas2
```

Change it to:

```text
projection/root
→ automatic topology/semantic node sizes
→ normal Local layout input/fingerprint

presentationOverrides
→ independent session style state
→ reducer size
```

A File size drag must not:

- reseed Local topology;
- change the local fingerprint;
- call Local layout worker;
- apply new coordinates;
- invoke viewport-anchor correction merely because size changed.

The current visual size should update without moving the root or any neighbor.

---

# Layout fingerprints

Do not simply delete all node sizes from KG13 fingerprints.

Instead ensure the values entering those fingerprints are the **automatic/layout sizes**, not VISUAL1B display multipliers.

The following must become true:

```text
same projection
same global settings
different per-File VISUAL1B overrides
→ same Global layout request
→ same Global layout fingerprint
```

and:

```text
same Focus projection/root
different per-File VISUAL1B overrides
→ same Local layout request
→ same Local layout fingerprint
```

But existing legitimate layout inputs should preserve current fingerprint behavior.

---

# Worker behavior

Do not modify latest-result-wins worker architecture merely to fix this bug.

The worker is doing what it was designed to do: supersede old layout work.

The bug is that presentation changes are incorrectly submitting layout work at all.

After this correction:

```text
slider drag
→ 0 new Global layout worker requests
→ 0 new Local layout worker requests
```

Worker tests should remain unchanged unless a narrow operation-count assertion is added.

---

# Layout cache behavior

Per-file size multiplier changes must not:

- create new Global cache fingerprints;
- create new Local cache fingerprints;
- evict the existing exact layout;
- apply an older cached coordinate set.

The current positions stay authoritative while visual size changes.

Do not persist rendered positions.

---

# Persistence / registry behavior

Preserve the existing VISUAL1B architecture:

```text
WorkspaceId + stable EntityId
→ optional sizeScale
```

Do not change:

- registry schema v1;
- stable/session-only persistence policy;
- rename/move continuity;
- corrupt-storage behavior;
- Reset saved view separation;
- QUERY1 separation;
- Visual Groups separation.

This is a renderer ownership correction, not a storage redesign.

---

# QUERY1 Hide / KG14B3 compatibility

KG14B3 is already integrated into PR #51.

Preserve:

```text
query determines whether File is visible
presentation override determines displayed size when visible
```

Hide/unhide must continue retaining the size override.

If a hidden File returns:

```text
same EntityId
→ same size multiplier
```

No second visibility system.

---

# Tests — replace the current wrong invariant

The current `node-size.test.ts` contains a test equivalent to:

```text
"makes final sizes part of both layout requests/fingerprints"
```

Delete/replace that expectation.

It is now explicitly the wrong product behavior.

Add tests proving the corrected seam.

## Mapping tests

All:

```text
mapProjectionToGlobal(...)
```

must be identical for different per-file override maps because overrides should no longer be an argument/input.

Automatic VISUAL1A degree sizing remains tested independently.

Focus:

```text
mapProjectionToLocalTopology(...)
```

must retain normal semantic sizes regardless of per-file presentation registry.

---

## Style/reducer tests

All:

```text
automatic size 6
scale 1.5
→ displayed size 9

scale undefined
→ displayed size 6
```

Focus:

```text
normal File base 6.4
scale 1.5
→ displayed 9.6

root base 8.4
scale 0.5
→ displayed remains root minimum 8.4
```

Heading/block/diagnostic remain unchanged.

Visual Group color and custom size must compose.

---

## Fingerprint tests

Prove explicitly:

```text
presentation override 1.00×
presentation override 1.30×
presentation override 2.50×

→ same Global fingerprint
→ same Local fingerprint
```

Do this through the real canvas/mapping ownership seam, not by artificially stripping fields after request creation.

Also retain tests that genuine normal layout-setting/topology changes still alter fingerprints where expected.

---

## Canvas operation-count regression — REQUIRED

This is the most important regression test.

Use a controlled/mock layout service and instrumentation.

After initial layout has settled:

```text
render All + Network
record layout call/count
change only presentationOverrides for one visible File:
1.00 → 1.05 → 1.10 → 1.15 → 1.30
```

Assert:

```text
global mapping/layout input unchanged
global layout service call count unchanged
global-layouts operation count unchanged
node displayed size changes
positions unchanged
```

Do the equivalent for Focus Network:

```text
local layout service call count unchanged
local-layouts count unchanged
positions unchanged
displayed File size changes
```

Do not merely assert that stale results are rejected.

The oracle is **zero layout work caused by size edits**.

---

## Coordinate regression

Capture node coordinates before and after a presentation-only size edit.

For every visible node:

```text
x before === x after
y before === y after
```

This should include a fixture matching the user's observation:

```text
Note.md       isolated
Source.md → Target.md
```

Increase only Note.md size.

Assert:

```text
Source coordinate unchanged
Target coordinate unchanged
distance(Source, Target) unchanged exactly
Note coordinate unchanged
```

The test should fail under the current PR #51 architecture.

---

## Rapid slider sequence

Add a regression that applies a rapid monotonic sequence:

```text
1.00
1.05
1.10
1.15
1.20
1.25
1.30
```

After each step:

```text
no layout request
no coordinate change
effective displayed size follows multiplier
```

This directly encodes the native-QA failure.

---

## Sigma refresh correctness

Test, to the extent current harness permits:

- size changes are reflected by the reducer;
- hover/click behavior still works after size change;
- topology removal during/pending size refresh does not repaint a stale node;
- no crash if the sized node becomes hidden while refresh is pending.

Do not create brittle pixel-perfect tests.

---

# Diagnostic instrumentation / optional confirmation

Before deleting the old path, it is useful to add or temporarily run a focused diagnostic proving the current bug:

```text
one Size slider step
→ global-layouts increments
```

and, if practical:

```text
ForceAtlas2 config has adjustSizes false/default
```

This evidence may be captured in the implementation report.

Do not keep noisy production logging.

The correction does not depend on reproducing the exact Source/Target amplitude once the causal operation-count path is proven.

---

# Native QA after correction

Build a new optimized Windows executable.

Repeat the exact failure case first:

```text
Synthetic Sample or same native fixture
Source.md → Target.md
Note.md isolated

open Note.md Size
drag slowly and continuously:
1.00× → 1.30×
then 1.30× → 2.50×
then back downward
```

Required:

```text
Note changes radius smoothly
Source stays fixed
Target stays fixed
Source↔Target distance stays fixed
all unrelated nodes stay fixed
no near/far flicker
```

Then test:

- Reset;
- right-click / Shift+F10 action entry;
- Visual Group + size;
- Hide/unhide;
- All → Focus reuse;
- Focus root minimum;
- pan/wheel/touchpad/pinch;
- reload persistence;
- live rename/move;
- remove sized File while editor open.

Do not mark native QA passed until the user confirms.

---

# Performance acceptance

The new architecture should be substantially cheaper than the current one.

During a slider drag:

```text
allowed:
- registry mutation/persistence
- React state update
- sparse override-map comparison
- Sigma node reducer refresh/process
- repaint

forbidden:
- KG6 reprojection
- Global mapping recomputation caused only by override
- Local topology remapping caused only by override
- Global ForceAtlas2
- Local ForceAtlas2
- layout cache churn
```

Use existing instrumentation to prove the zero-layout invariant.

No new timing threshold is required.

---

# Scope / non-scope

## In scope

- diagnose and document the relayout flicker;
- move per-File size multiplication out of layout mapping;
- make size a Sigma presentation/reducer override;
- All + Network;
- Focus + Network;
- sparse correct renderer refresh;
- topology-refresh race safety;
- operation-count/coordinate regressions;
- update VISUAL1B implementation report;
- build fresh native executable;
- repeat native QA gate.

## Out of scope

Do not implement:

- SPATIAL1;
- Move mode;
- drag/pin;
- folder-cluster offsets;
- adaptive layout;
- Saved Views;
- new ForceAtlas2 tuning;
- `adjustSizes: true`;
- no-overlap layout;
- collision engine;
- debounced relayout;
- slider animation;
- per-heading sizing;
- per-block sizing;
- new visibility model.

In particular:

```text
DO NOT solve this by turning on adjustSizes.
```

The user requirement is that individual visual resizing should not reorganize the graph.

---

# Documentation

Update relevant renderer/VISUAL1B docs to state the corrected ownership:

```text
automatic node size
→ renderer/layout semantic input

per-File size multiplier
→ Sigma presentation only
→ excluded from coordinates/layout fingerprint
```

Correct any existing PR #51 report text saying:

```text
"Final sizes enter the normal mapping/layout fingerprints"
```

That statement must no longer be true after the fix.

Record the actual causal diagnosis:

1. override changed mapped size;
2. mapped size changed fingerprint;
3. each slider step launched a full layout refinement;
4. ForceAtlas2 node-size adjustment is not enabled;
5. repeated layout refinements moved unrelated connected nodes;
6. render-only override removes the accidental feedback loop.

Do not describe the flicker as random unless actual randomness is found.

---

# Validation

Use current `AGENTS.md` requirements and all focused tests.

Expected core commands:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

Also run the focused operation-count/coordinate tests for this correction explicitly.

No new external dependency should be needed.

---

# Exit gate

This QA correction is complete only when:

1. current simplified Size slider UI remains intact;
2. presentation registry/persistence remains intact;
3. per-File multiplier no longer changes Global renderer input size;
4. per-File multiplier no longer changes Local topology size;
5. multiplier is applied in Sigma presentation/reducer logic;
6. All File display size updates correctly;
7. Focus File display size updates correctly;
8. Focus root minimum is preserved;
9. Heading/Block/Diagnostic are unaffected;
10. Visual Groups still compose;
11. per-File size does not change Global layout fingerprint;
12. per-File size does not change Local layout fingerprint;
13. per-File size causes zero new Global layout requests;
14. per-File size causes zero new Local layout requests;
15. rapid 1.00→1.30 sequence causes zero layout requests;
16. all node x/y coordinates remain unchanged during size edits;
17. Source↔Target distance remains exactly unchanged when resizing unrelated Note;
18. Reset changes only displayed size/persistence;
19. Hide/unhide preserves size and does not reintroduce a second visibility path;
20. topology-change/style-refresh races remain safe;
21. hover/click/hit testing remains correct after resizing;
22. slider remains responsive;
23. no layout-cache churn occurs from overrides;
24. latest-result-wins worker architecture remains unchanged;
25. no `adjustSizes: true` workaround is introduced;
26. focused tests pass;
27. full `pnpm check` passes;
28. desktop check/build pass;
29. relevant benchmarks pass;
30. production-browser smoke passes;
31. new optimized Windows executable is built;
32. user native QA confirms no flicker/unrelated movement;
33. PR #51 remains draft until that confirmation;
34. only after confirmation: final CI/merge/post-merge cleanup.

---

# Final report

Update `history-implementations/VISUAL1B_implementation_status.md` with:

## Root cause

Explain the accidental:

```text
Size slider
→ size in layout fingerprint
→ repeated whole-graph ForceAtlas2
→ unrelated coordinate changes/flicker
```

and the important `adjustSizes` finding.

## Architectural correction

Explain:

```text
automatic size = layout attribute
per-File multiplier = Sigma presentation override
```

## Operation-count evidence

Report exact before/after layout-request counts for a slider sequence.

## Coordinate evidence

Report the synthetic:

```text
isolated Note
Source → Target
```

regression and verify unchanged Source/Target distance.

## Compatibility

Persistence, KG14B3 Hide, Visual Groups, All/Focus, root minimum, view-state.

## Tests / benchmarks / browser / native QA

Native QA must remain pending until user confirmation.

Do not merge automatically.
