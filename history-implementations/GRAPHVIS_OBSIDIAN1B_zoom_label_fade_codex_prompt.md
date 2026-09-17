# GRAPHVIS-OBSIDIAN1B — Zoom-dependent Network label fade before threshold

**Task type:** visual polish / renderer correction / Obsidian parity follow-up

## Goal / success outcome

Continue the existing **GRAPHVIS-OBSIDIAN1** work in PR #110 and add the missing Obsidian-like label fade behavior.

Current PR #110 already gives All and Focus:

- shared below-node labels;
- font size capped to rendered node diameter;
- evidence-backed Obsidian 1.11.5 dark graph palette;
- existing Icarus hard label visibility thresholds / semantic LOD.

The missing behavior is:

```text
zoom in
→ ordinary visible labels are fully readable

zoom out
→ labels gradually become more faded

approach the existing disappearance threshold
→ opacity approaches 0 smoothly

cross the existing threshold
→ label is not rendered
```

So retain the threshold, but replace the abrupt:

```text
visible at full opacity
→ suddenly gone
```

with approximately:

```text
full opacity
→ smooth fade region
→ zero opacity
→ hard cull
```

This should work consistently in **All + Network** and **Focus + Network**.

The implementation must remain renderer-only. No layout, physics, camera, density, persistence, topology, or projection behavior should change.

---

# Work on the existing PR, not a separate visual project

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Existing PR:

```text
#110 — GRAPHVIS-OBSIDIAN1: Obsidian-style Network labels and dark palette
```

Observed head when this follow-up was written:

```text
c1210bb3a2776efc3c97b24202ff34457636afb4
branch: codex/graphvis-obsidian1-dark-network
```

Prefer adding focused commits to that existing branch/PR.

Do not open a second PR unless the existing branch is unavailable or repository state has materially changed.

Keep PR #110 unmerged pending the user's native visual acceptance.

Before editing:

1. sync/fetch current remote state;
2. inspect whether PR #110 has changed since this prompt;
3. preserve unrelated branches/worktrees and concurrent work;
4. use the current PR code over stale details below.

---

# Existing evidence from PR #110

PR #110's new evidence document already records that Obsidian 1.11.5 does this:

> Label opacity follows graph zoom/text fade, becomes fully opaque for the highlighted node, and otherwise participates in related-node fade.

Source note:

```text
docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md
```

The existing extraction source referenced there includes:

```text
formatted/app.pretty.js
extracted/obsidian/app.css
```

and stable tokens around the graph renderer such as:

```text
PIXI.TextStyle
anchor.set(0.5, 0)
getTextStyle
getSize
color-text
```

The current PR implemented the placement/font/palette evidence but did **not** implement zoom-dependent label alpha.

Current shared renderer is likely:

```text
packages/renderer-sigma/src/network-label.ts
```

At the inspected PR head, ordinary label drawing effectively does:

```ts
context.fillStyle = labelColor(settings);
fillText(...);
```

with no zoom/threshold-dependent `globalAlpha` or RGBA alpha.

That is the narrow gap to fix.

---

# Phase 1 — Recover Obsidian's fade behavior more precisely

Use the **same Obsidian 1.11.5 extraction already available in this Codex/chat workspace**.

Before choosing an Icarus fade curve, inspect the renderer around label/text alpha and determine as much as possible about:

- the variable controlling graph text fade;
- whether alpha is a direct function of zoom/renderer scale;
- exact formula or interpolation, if recoverable;
- lower/upper scale boundaries;
- whether node weight/size influences the alpha independently;
- whether highlighted/focused text bypasses the fade;
- interaction with unrelated-node fade;
- whether opacity is clamped;
- whether disappearance is a separate cull or simply alpha reaching zero.

Search stable terms around the existing renderer evidence and likely concepts such as:

```text
alpha
opacity
textFade
fade
scale
color-text
highlight
getTextStyle
getSize
```

Do not guess an "Obsidian formula" if the exact code cannot be established.

Update:

```text
docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md
```

with the additional evidence.

If Obsidian's exact fade formula is recoverable and maps cleanly onto Icarus/Sigma, use it.

If it is not directly portable, preserve the *behavioral principle* and implement an explicitly documented Icarus adaptation tied to the existing Icarus label threshold.

---

# Phase 2 — Icarus fade model

## Core requirement

For ordinary labels that already qualify under the existing semantic/LOD policy, opacity should depend continuously on the same rendered-scale domain that leads toward threshold disappearance.

Prefer deriving the fade from:

```text
rendered node radius / rendered label size signal
+
current labelRenderedSizeThreshold
```

rather than raw graph coordinates or stored node size.

The fade must therefore react naturally to actual zoom.

### Important

Verify what Sigma's:

```text
data.size
settings.labelRenderedSizeThreshold
```

represent at draw time.

Do not assume graph-space units if they are actually viewport/rendered pixels.

The opacity calculation must use a quantity that changes correctly with zoom.

---

# Preserve the existing hard threshold

Do **not** remove Sigma/Icarus culling.

Conceptually:

```text
T = current disappearance threshold

rendered signal <= T
→ label culled / absent

T < rendered signal < fadeFull
→ opacity smoothly rises from ~0 to 1

rendered signal >= fadeFull
→ opacity = 1
```

This gives the user exactly:

```text
fade into nothing in the portion before threshold disappearance
```

rather than keeping labels visible indefinitely at tiny alpha.

---

# Fade curve

First preference:

```text
Obsidian's actual curve/bounds, if recoverable and compatible.
```

Fallback if exact Obsidian mapping cannot be recovered:

Use a deterministic smooth interpolation, preferably `smoothstep`, over a fade window expressed **relative to the current label threshold** rather than an unrelated fixed pixel range.

Conceptually:

```text
progress = clamp(
  (renderedSignal - threshold) /
  (fullOpacitySignal - threshold),
  0,
  1
)

opacity = smoothstep(progress)
```

Do not hard-code the current default Label Threshold into the fade algorithm.

Changing the existing Label Threshold control must move the fade window coherently.

### Selecting the fade-window width

Do not add a new product slider in this task.

Use Obsidian evidence to select the width if possible.

If evidence cannot provide an exact portable ratio, compare a tiny bounded set such as:

```text
full opacity at 1.5 × threshold
full opacity at 1.75 × threshold
full opacity at 2.0 × threshold
```

using the existing graphical QA fixture, then choose the closest Obsidian-looking result.

Document the chosen constant and why.

No runtime "Label Fade" control yet.

---

# Forced / important labels

The fade must not break existing forced-label semantics.

Current Icarus can force labels for states such as:

- selected;
- hovered;
- Focus root;
- arrangement/scope interaction states;
- other existing `forceLabel` cases.

Obsidian evidence says the highlighted label becomes fully opaque.

Desired Icarus policy:

```text
ordinary label
→ zoom fade applies

selected / hovered label
→ full opacity

other labels intentionally forced visible by current product semantics
→ do not fade to zero merely because the ordinary threshold is near
```

Prefer full opacity for `forceLabel` unless current semantics clearly distinguish a forced-but-muted state.

Do not create a case where:

```text
Sigma says forceLabel = true
but custom drawer multiplies opacity to ~0
```

because that would silently defeat the product's forced-label contract.

If Sigma's label drawing data does not expose enough information to distinguish forced labels, inspect the cleanest renderer-local way to carry that state. Do not introduce React state or layout inputs for this.

---

# Hover and selection continuity

PR #110 intentionally made hover use the same centered-below geometry so labels no longer jump sideways.

Preserve that.

When a faded ordinary label becomes hovered/selected:

```text
same position
same font size
same text
opacity → 1
```

No positional jump.

When hover/selection ends:

```text
opacity returns to the current zoom-derived value
```

No layout or camera change.

---

# All and Focus must share the same fade policy

Do not implement one fade curve in:

```text
GlobalRendererSession
```

and another in:

```text
LocalRendererSession
```

The existing PR deliberately introduced one shared:

```text
network-label.ts
```

policy.

Keep this ownership.

All and Focus may continue to have different **label eligibility/LOD thresholds**, but once a label is being drawn the fade computation should be shared and parameterized by the relevant current threshold/settings.

---

# Color and alpha composition

PR #110 now owns an Obsidian-like dark graph palette.

Do not replace label colors with separate hard-coded faded hex values.

Prefer alpha composition:

```text
base label color
× zoom opacity
× existing interaction opacity, if any
```

or the clean Canvas equivalent.

This matters because:

- Obsidian label base color remains evidence-backed;
- Visual Groups / diagnostics may retain their own semantic color;
- zoom fade is an opacity concern, not a different semantic color.

Avoid repeated conversion between RGB/hex strings if `context.globalAlpha` cleanly preserves current color ownership.

Remember to use `save()` / `restore()` so label alpha cannot leak into later drawing.

---

# Interaction with unrelated-node fading

The Obsidian evidence also notes that unrelated graph elements can fade while a node is highlighted.

Do **not** broaden this follow-up into a new hover-neighborhood visual redesign unless PR #110 already has an explicit label-alpha path for that behavior.

The primary task is zoom fade.

If existing Icarus interaction styling already supplies a label opacity, compose it multiplicatively with zoom fade.

If not, leave unrelated-node hover fading as current PR #110 behavior and document it as separate.

---

# Tests

Add focused pure tests for the fade function.

Prefer exporting a small pure resolver such as conceptually:

```ts
resolveNetworkLabelOpacity(...)
```

Exact naming is flexible.

Cover at least:

```text
below threshold            → 0 / not ordinarily drawable
exact threshold            → 0
just above threshold       → small positive alpha
middle of fade window      → intermediate alpha
full-opacity boundary      → 1
well above boundary        → 1
invalid/negative size      → safe deterministic result
different threshold value  → fade window moves with threshold
```

If using smoothstep, assert meaningful values/bounds without making tests brittle to insignificant floating-point details.

Add renderer tests for:

```text
ordinary label uses zoom-derived alpha
hovered label is fully opaque
selected / forced label is fully opaque
same geometry before/after force state
All and Focus use the shared function
```

Preserve existing tests for:

- below-node positioning;
- font <= rendered node diameter;
- long-label max width;
- viewport handling;
- dark palette;
- zero layout/physics/camera effects.

---

# Visual-only regression gate

This follow-up must continue to produce:

```text
0 layout requests
0 PHYSICS1 jobs
0 spatial-influence jobs
0 position/cache applications
0 camera writes/reframes
0 persistence writes
```

Zoom already causes renderer work; this task may cause label redraws during zoom, but it must not make zoom a semantic graph update.

Do not change:

- ForceAtlas2;
- convergence;
- MOVE300A;
- Pull;
- Place;
- folder clustering;
- density framing;
- node-size algorithms;
- edge weights;
- projection;
- QUERY1;
- Saved Views;
- Hierarchy.

---

# Performance

The opacity math should be negligible.

Do not add per-label DOM elements, React state, or allocations that scale unnecessarily with each frame.

Prefer a tiny numeric calculation in the existing canvas label draw path.

Avoid:

```text
setState on zoom
rebuilding Graphology
refreshing layout
recomputing projection
```

The fade should naturally follow rendered label/node scale during Sigma rendering.

---

# Graphical QA

Repeat the existing PR #110 browser/native visual matrix with special attention to gradual fade.

Test both:

```text
All + Network
Focus + Network
```

At multiple continuous zoom positions:

```text
close
normal
start of fade
middle of fade
just before disappearance
past disappearance threshold
```

Check:

1. fade is smooth, not stepped;
2. labels do not suddenly change hue—only opacity;
3. threshold disappearance no longer looks abrupt;
4. selected/hovered labels remain readable at zoom levels where ordinary labels are fading;
5. Focus root remains consistent with existing forced-label semantics;
6. label placement remains centered below the node;
7. font-size/node-size invariant remains intact;
8. dark graph contrast remains good;
9. pan/zoom remains smooth;
10. no label flicker at the threshold boundary.

If possible, compare directly with Obsidian 1.11.5 at similar zoom progression.

Build a fresh optimized Windows executable again after the final changes.

---

# Documentation / implementation report

Update the existing PR #110 documentation rather than creating redundant top-level documents:

```text
docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md
history-implementations/GRAPHVIS_OBSIDIAN1_implementation_status.md
```

Record:

- exact Obsidian fade evidence recovered;
- whether the formula was copied behaviorally or adapted;
- Icarus fade window;
- forced-label opacity policy;
- tests/QA.

Archive this follow-up prompt under `history-implementations/` using repository conventions.

---

# Validation

Follow current `AGENTS.md` and the validation already established by PR #110.

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

Also repeat production-browser graphical QA at multiple zoom levels.

No new dependency.

No timing CI gate.

---

# Exit gate

Ready for user native review only when:

1. the existing Obsidian extraction was checked for actual text-fade behavior;
2. exact formula/bounds are documented if recoverable;
3. otherwise the Icarus adaptation is clearly labelled as an adaptation;
4. All ordinary labels fade continuously as zoom approaches threshold;
5. Focus ordinary labels fade continuously as zoom approaches threshold;
6. threshold still hard-culls labels at/below its existing boundary;
7. fade window follows the current Label Threshold rather than one hard-coded default;
8. All and Focus share one fade policy;
9. selected/hovered labels are fully opaque;
10. current forced-label semantics are not defeated by fade;
11. placement remains centered below nodes;
12. font remains capped to rendered node diameter;
13. dark palette remains unchanged from approved PR #110 values;
14. Visual Groups/diagnostics remain distinct;
15. no layout/physics/spatial/camera/cache/persistence semantics change;
16. focused tests pass;
17. full `pnpm check` passes;
18. desktop check/build pass;
19. fresh executable is produced;
20. PR #110 remains unmerged pending user visual approval.

Do not start a broader animation/theme task automatically.

---

# Final report

Report concisely:

## Obsidian fade evidence

- source tokens/files inspected;
- exact fade formula/bounds if recovered;
- highlight behavior;
- any unresolved uncertainty.

## Icarus implementation

- fade formula;
- fade window relative to threshold;
- forced-label behavior;
- files changed.

## Regression proof

Confirm explicitly:

```text
layout: unchanged
physics: unchanged
spatial influence: unchanged
camera: unchanged
cache: unchanged
persistence: unchanged
```

## Validation

- focused tests;
- package/app suites;
- `pnpm check`;
- desktop check/build;
- browser graphical QA.

## Native handoff

Give the new executable path and ask the user specifically to judge:

```text
Does label fading feel continuous and Obsidian-like from normal zoom until disappearance?
```

Keep PR #110 unmerged until that acceptance.
