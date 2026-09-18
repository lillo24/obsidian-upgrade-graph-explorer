# GRAPHVIS2 — Refine label proportions + smoother hover transition

**Task type:** small Network visual-polish follow-up

## Goal / success outcome

Refine the recently merged Obsidian-style Network presentation in two narrow ways:

1. **Labels are still too large relative to nodes.**
   - Keep the good behavior that label size follows node size and zoom.
   - Make labels clearly smaller than the node diameter.
   - Small nodes should use a proportionally smaller label than large nodes.
   - Large nodes should also be slightly smaller than today.
   - Preserve the existing zoom fade, truncation, below-node placement, and All/Focus shared renderer.

2. **Make hover highlighting more elegant and gradual.**
   - Keep the existing hover behavior/functionality:
     - hovered node highlights;
     - only directly connected edges brighten;
     - unrelated graph elements remain unchanged;
     - label moves slightly downward.
   - Animate the connected-edge highlight instead of changing color/width instantly.
   - Make the label downward movement slower/smoother than the current implementation.
   - Do **not** add Obsidian's opaque graph overlay/dimming effect.

This is presentation-only.

No layout, physics, Move, camera, density, projection, cache, persistence, Pull, Place, folder clustering, or graph-topology changes.

---

# Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current merged baseline observed while writing this prompt:

```text
f7d6bfd43dbc6588b685dde20c8ffc491a3374d7
```

This is the merge of:

```text
PR #110 — GRAPHVIS-OBSIDIAN1
```

and already includes:

```text
b747972 — zoom-dependent label fade
73aa1d3 — click/Move ownership correction
d28304f — zoom-scaled labels, truncation, hover focus
```

Start from current `main`, not the old PR branch.

Inspect current open PRs/worktrees and preserve unrelated work.

---

# Current implementation evidence

## Shared label renderer

Current main has:

```text
packages/renderer-sigma/src/network-label.ts
```

shared by All and Focus.

Current logical scaling is equivalent to:

```text
renderScale = renderedRadius / logicalRadius

fontPx =
  min(
    (14 + logicalRadius / 4) * renderScale,
    renderedRadius * 2
  )
```

The second term is:

```text
renderedRadius * 2
= rendered node diameter
```

so small Icarus nodes often hit a font cap equal to **100% of their diameter**.

That solved the previous "fixed text while zooming" problem, but is visually too large.

The current hover label motion is:

```text
max offset = min(3 px, renderedRadius * 0.35)
duration = 120 ms
easing = cubic ease-out
```

## Current connected-edge hover

Current main uses:

```text
resolveIncidentEdgeColor(...)
```

and immediately switches directly connected edges to the highlighted color.

It also immediately applies approximately:

```text
incident width multiplier = 1.3
```

So the hover functionality is correct, but the visual state snaps instead of transitioning.

Keep the existing incident-edge color semantics:

- neutral Graph edges move toward the Obsidian accent;
- semantic/status hues are lightened rather than erased.

---

# PART A — Better label-size curve

## Desired visual relationship

Current result is too text-heavy.

Target behavior:

```text
small node
→ noticeably smaller text relative to its diameter

medium node
→ readable text, clearly subordinate to node

large node
→ larger text than small nodes, but still slightly smaller than current
```

Do not revert to fixed screen-pixel text.

The label must continue scaling naturally with zoom and node presentation.

## Core design requirement

Replace the current effective:

```text
font <= 100% of node diameter
```

with a **smaller size-sensitive ceiling/curve**.

Do not solve this only by subtracting a fixed number of pixels.

A small node should not have the same font/diameter ratio as the smallest current nodes if that makes the text dominate.

### Preferred tuning approach

Do a small deterministic visual bakeoff rather than guessing one arbitrary formula.

Compare approximately three candidates, for example:

```text
A — conservative
small nodes ≈ 50–55% diameter
large nodes ≈ 62–65% diameter

B — middle
small nodes ≈ 55–60% diameter
large nodes ≈ 65–70% diameter

C — larger
small nodes ≈ 60–65% diameter
large nodes ≈ 70–75% diameter
```

These are visual targets, not mandatory exact formulas.

Prefer **B as the initial candidate**, then inspect the production browser fixture and choose the closest fit to:

- user feedback: current labels are too big everywhere;
- small nodes need the biggest proportional reduction;
- large nodes need only a modest reduction;
- labels must remain readable.

Do not add a user-facing font-size control in this task.

## Possible implementation shape

Keep the current Obsidian-derived logical-font idea, but apply an Icarus-specific size-sensitive presentation ceiling.

Conceptually, something like:

```text
obsidianScaledFont
= (14 + logicalRadius / 4) * renderScale

maxFontRatio(logicalRadius)
= a bounded function that increases modestly with node size

fontPx
= min(
    obsidianScaledFont * optional-small-global-adjustment,
    renderedDiameter * maxFontRatio(logicalRadius)
  )
```

The exact function is Codex's choice after visual comparison.

Important:

- it must be deterministic;
- monotonic with node size;
- continuous, not bucketed jumps;
- bounded;
- no font larger than today;
- no layout/cache input.

## Preserve

Keep unchanged:

- zoom-dependent font scaling;
- zoom-dependent opacity fade near threshold;
- forced-label full opacity;
- below-node centered placement;
- width-based ellipsis;
- `Creativity - Initiative - Curiosity.md` width budget;
- no Canvas horizontal glyph compression;
- Visual Group / diagnostic semantics;
- All/Focus shared label code.

## Gap

Current gap scaling is good conceptually.

After reducing font size, check whether the label looks too far from the node.

If needed, reduce the logical gap slightly, but only as a secondary optical adjustment.

Do not return to a fixed screen-pixel gap.

---

# PART B — Smooth connected-edge hover transition

## Desired behavior

Current:

```text
pointer enters node
→ incident edges instantly change color
→ incident edges instantly become thicker
→ label animates downward over 120 ms
```

Desired:

```text
pointer enters node
→ hovered-node state begins
→ directly connected edges gradually brighten
→ their modest width increase also eases in
→ label gradually moves slightly downward
→ all finish together in a calm ease-out

pointer leaves
→ same properties smoothly return
```

The graph should feel more like Obsidian's polished hover, **without adding the opaque overlay**.

## One shared transition progress

Prefer one renderer-local hover progress:

```text
0 → ordinary
1 → fully hovered
```

and use it to drive:

```text
label vertical offset
incident edge color interpolation
incident edge width interpolation
```

Do not create separate unsynchronized timers for each property.

The existing `NetworkLabelHoverController` / hover-progress machinery is a likely foundation.

If its ownership has become too label-specific, make the smallest sensible refactor toward a shared Network hover presentation controller rather than adding another controller beside it.

For example conceptually:

```text
NetworkHoverTransitionController
```

can own the same progress while label drawing and edge styling consume it.

Naming is flexible.

## Timing

Current label duration:

```text
120 ms
```

is too fast.

Use a slower but still lightweight transition.

Initial target:

```text
~200–240 ms
```

with ease-out.

Prefer roughly **220 ms** as the first graphical candidate.

If direct Obsidian extraction gives a clearly better supported temporal behavior, use that evidence.

Do not make hover feel sluggish; this is still a pointer response, not a page transition.

## Label motion

Current maximum:

```text
min(3 px, radius * 0.35)
```

Functionally it is close.

The user wants:

- a bit more visible downward movement;
- slower animation.

Do a narrow bakeoff, e.g.:

```text
2.5 px
3.5 px
4.5 px
```

at ordinary node/zoom scale, still radius-bounded.

Prefer a subtle result around **3–4 px** at ordinary scale rather than making the label visibly "jump".

Keep the offset scale-aware for small nodes.

The text must remain:

```text
same x
same font
same truncation
same opacity logic
```

apart from hover's existing full-opacity override.

## Incident-edge color interpolation

Do not abruptly replace:

```text
baseColor
→ resolveIncidentEdgeColor(baseColor)
```

Instead interpolate continuously according to hover progress.

Conceptually:

```text
edgeColor(progress)
= mix(baseColor, incidentHighlightColor, progress)
```

Support at least the color formats actually present in production.

Do not silently collapse semantic/status edge colors to the neutral accent.

Keep:

```text
resolveIncidentEdgeColor(baseColor)
```

as the final `progress=1` target unless current architecture suggests a cleaner equivalent.

## Edge width interpolation

Current hover multiplier is roughly:

```text
1.3
```

Keep that final visual emphasis unless QA shows it is excessive.

Interpolate:

```text
widthMultiplier = lerp(1, 1.3, progress)
```

on top of the current LOD multiplier.

Do not change physical/layout edge weights.

## Leaving / switching nodes

Handle:

```text
A hovered
→ pointer moves directly to B
```

cleanly:

- A edges/label ease back toward ordinary;
- B edges/label ease toward hover;
- no one-frame snap to neutral;
- no stale transition ownership.

Only directly relevant nodes/edges should animate.

No whole-graph per-frame reducer work if avoidable.

---

# Performance / architecture

This must stay renderer-local.

Do not introduce:

```text
React state per animation frame
Graphology coordinate changes
layout submissions
physics work
camera writes
projection rebuilds
persistent state
```

For edge animation, use the narrowest Sigma refresh possible.

Prefer partial refresh of:

```text
incident edges of outgoing hover transition
+
incident edges of incoming hover transition
+
hovered/previous label layers as already required
```

Do not schedule a full graph reducer refresh every animation frame on a 300-node All graph unless measurement proves it negligible and there is no narrower supported path.

Animation should sleep completely when no transition is active.

Respect:

```text
prefers-reduced-motion: reduce
```

In reduced motion:

```text
hover presentation snaps directly to progress 1 / 0
```

without an animation loop.

---

# Interaction with Arrange Folders

Arrange Folders has its own stronger highlighting semantics.

Do not force this hover animation model into folder-arrangement scope highlighting.

Ordinary Network hover only.

If Arrange Folders is active, preserve its existing ownership/priority rules.

---

# Tests

## Label-size curve

Add pure tests showing:

- font increases monotonically with node size;
- font remains monotonic across zoom scale;
- small node font/diameter ratio is lower than large node ratio;
- no font exceeds the selected new ratio ceiling;
- no font exceeds node diameter;
- zoom fade remains independent of size curve;
- forced label opacity remains 1;
- All and Focus still use the shared resolver.

Use representative current node sizes, including:

```text
small Block/diagnostic
Section
File
Focus root / larger File
high-degree All File
```

## Hover transition math

Add pure tests for:

```text
progress 0
progress midpoint
progress 1
enter
leave
A → B switch
reduced motion
```

Assert:

```text
color interpolation monotonic
width interpolation 1 → 1.3
label offset monotonic and bounded
```

Do not rely only on screenshots.

## Renderer integration

Prove:

- only incident edges change during ordinary hover;
- unrelated edge style is byte/value equivalent throughout;
- unrelated node style is unchanged;
- hover transition does not mutate Graphology x/y;
- no layout/physics/camera invocation;
- animation loop stops after settlement;
- switching hover target does not leave stale highlighted edges.

---

# Graphical QA

Use both:

```text
All + Network
Focus + Network
```

and several node sizes.

## Label review

Compare:

```text
small nodes
medium nodes
large/high-degree nodes
Focus root
```

at:

```text
zoomed in
normal
zoomed out before fade
near fade threshold
```

Acceptance:

- labels no longer visually approach the full node diameter;
- small-node labels are clearly more restrained;
- large labels are also modestly smaller than the merged baseline;
- proportionality remains stable while zooming;
- readability remains adequate.

## Hover review

Slowly enter/leave and move among connected nodes.

Acceptance:

- incident connectors brighten smoothly;
- width grows smoothly;
- label drifts down subtly and more slowly than before;
- all hover motion feels coordinated;
- no opaque/dimming overlay appears;
- unrelated graph remains visually stable;
- transition does not feel delayed or laggy.

Build a fresh optimized desktop executable for user acceptance.

---

# Regression boundaries

Do not change:

```text
ForceAtlas2
PHYSICS1
convergence
Move / drag threshold
Pull
Place
folder clustering
density
camera
topology
projection
QUERY1
Visual Group persistence
Saved Views
Hierarchy
```

Expected impact:

```text
layout requests:      0 new
physics jobs:         0 new
spatial jobs:         0 new
camera writes:        0 new
cache invalidations:  0 new
persistence writes:   0 new
```

---

# Documentation

Update the existing visual implementation history rather than creating a broad new design document.

Likely:

```text
history-implementations/GRAPHVIS_OBSIDIAN1_implementation_status.md
```

Append a concise section describing:

- final label sizing curve;
- visual candidate comparison;
- new hover timing/offset;
- edge color/width interpolation;
- no-overlay decision.

Update:

```text
docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md
```

only if new Obsidian source evidence is actually discovered.

Archive this exact prompt under `history-implementations/` following repository conventions.

---

# Validation

Follow current `AGENTS.md`.

At minimum run current equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also perform production-browser graphical QA for the label-size and hover-transition candidates.

No new dependency.

No timing CI gate.

---

# Exit gate

Ready for user QA only when:

## Labels

1. label font still follows node size and zoom;
2. small-node labels are proportionally smaller than large-node labels;
3. all labels are visibly smaller than the merged baseline;
4. large-node labels are only modestly reduced;
5. label never approaches/exceeds node diameter;
6. existing zoom fade remains correct;
7. truncation remains correct;
8. below-node geometry remains correct;
9. All and Focus share the same curve.

## Hover

10. incident edge color transitions gradually;
11. incident edge width transitions gradually;
12. label moves down gradually with the same hover progress;
13. hover animation is slower/smoother than the current 120 ms version;
14. leave animation is equally smooth;
15. A→B hover switches cleanly;
16. unrelated nodes remain unchanged;
17. unrelated edges remain unchanged;
18. no whole-graph opaque/dimming overlay is added;
19. reduced motion is respected;
20. animation causes no graph-coordinate/camera changes;
21. animation loop sleeps when settled.

## System

22. focused tests pass;
23. `pnpm check` passes;
24. desktop check/build pass;
25. fresh optimized executable is produced;
26. no unrelated work is modified.

---

# Final report

Report:

## Label sizing

- previous formula;
- new formula;
- small/medium/large font-to-diameter ratios;
- candidates compared;
- selected candidate and why.

## Hover animation

- shared transition duration/easing;
- label offset;
- edge color interpolation;
- edge width interpolation;
- reduced-motion behavior.

## Regression proof

Explicitly confirm:

```text
layout: unchanged
physics: unchanged
spatial: unchanged
camera: unchanged
cache: unchanged
persistence: unchanged
```

## Validation

List focused tests, full checks, benchmarks, browser graphical QA, desktop build.

## Native handoff

Provide the fresh executable path and ask the user to judge specifically:

```text
1. Are small-node labels now restrained enough?
2. Are large-node labels still readable without dominating?
3. Does the connector + label hover transition feel smooth/elegant rather than snappy?
```
