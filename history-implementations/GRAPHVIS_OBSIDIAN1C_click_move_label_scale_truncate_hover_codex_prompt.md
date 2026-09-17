# GRAPHVIS-OBSIDIAN1C — Click/Move arbitration + zoom-scaled labels + truncation + hover connections

**Task type:** interaction bug fix + Network renderer polish / Obsidian-parity follow-up

## Goal / success outcome

Continue the current Network visual work and fix four related problems discovered during native review:

1. **Double-click must activate a node again.**
   - A normal click/double-click must not look or behave like the beginning of a drag.
   - Temporary File Move should take ownership only after the existing 3 px drag threshold is actually crossed.
   - Idle/hovered movable Files should use a normal clickable cursor; the grabbing-hand cursor should appear only during a real drag.

2. **Label font/gap must scale sensibly with node scale while zooming.**
   - The current below-node geometry is correct, but the text behaves too much like fixed screen text.
   - As the graph is zoomed out, node labels must shrink with the nodes rather than becoming disproportionately large.
   - As the graph is zoomed in, labels may grow with nodes.
   - Preserve the existing invariant that text height never exceeds the rendered node diameter.
   - Compose correctly with GRAPHVIS-OBSIDIAN1B's zoom-opacity fade if that follow-up is already present.

3. **Long File names must truncate instead of being horizontally squashed.**
   - Current Canvas `fillText(..., maxWidth)` behavior can compress glyphs horizontally, which makes long names look distorted.
   - Replace that with real text truncation + ellipsis.
   - Target a maximum visual width around the current-font width of:

     ```text
     Creativity - Initiative - Curiosity.md
     ```

   - Example that should truncate cleanly:

     ```text
     Hippocampus as a reward predictor + Cerebellum.md
     ```

4. **Hover should emphasize direct connections without obscuring the rest of the graph.**
   - Keep the hovered node visibly focused.
   - Brighten only edges directly incident to the hovered node.
   - Do **not** dim all unrelated nodes.
   - Do **not** add a whole-graph overlay.
   - Do **not** animate unrelated nodes.
   - Add the small Obsidian-like label motion on hover: the label moves slightly downward with a short ease-out and returns smoothly on leave.

These changes belong in one implementation task because they share the same Sigma node-pointer, label drawing, reducer/style, and browser/native QA path.

For reviewability, prefer **two focused commits** if practical:

```text
Commit A — click/double-click vs Move ownership correction
Commit B — label scale/truncation + hover presentation
```

Do not split them into separate PRs unless repository state forces that.

---

# Existing PR / prerequisite

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue on the existing visual PR:

```text
PR #110 — GRAPHVIS-OBSIDIAN1: Obsidian-style Network labels and dark palette
branch: codex/graphvis-obsidian1-dark-network
```

Observed PR state when this prompt was written:

```text
base main: e84dee9c23031c7a91cae4012611820c13720aa0
head:      8257896bd62bcb380360f747ef79e903c52ab5a0
```

PR #110 is intentionally unmerged pending native visual approval.

This task is intended to follow:

```text
GRAPHVIS-OBSIDIAN1B — zoom-dependent Network label fade before threshold
```

At task start, inspect PR #110:

- if 1B has already been applied, preserve and integrate with it;
- if 1B is currently being applied in the same worktree/session, finish/reconcile that work first;
- do not independently invent a second competing fade implementation.

Use the latest branch state over this prompt if it has advanced.

Preserve unrelated branches/worktrees, `.pnpm-store/`, and user-owned instruction files.

---

# Current evidence / likely relevant areas

Inspect current versions of at least:

```text
AGENTS.md

docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md

packages/renderer-sigma/src/file-move.ts
packages/renderer-sigma/src/file-move-pointer-owner.ts
packages/renderer-sigma/src/node-click.ts

packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts

packages/renderer-sigma/src/network-label.ts
packages/renderer-sigma/src/network-theme.ts

packages/renderer-sigma/src/style.ts
packages/renderer-sigma/src/local-style.ts

packages/renderer-sigma/src/styles.css

packages/renderer-sigma/src/*file-move*.test*
packages/renderer-sigma/src/activation.test.ts
packages/renderer-sigma/src/interaction.test.ts
packages/renderer-sigma/src/global-label.test.ts
packages/renderer-sigma/src/network-theme.test.ts
```

Also inspect the installed **Sigma 3.0.3** label/node rendering source/types rather than assuming what `data.size` means across zoom.

For Obsidian label-scale and hover-motion behavior, reuse the existing Obsidian 1.11.5 extraction available in this Codex/chat workspace.

---

# PART A — Fix double-click / Move arbitration

## Confirmed current architectural problem

At the inspected implementation, an eligible File press does approximately:

```text
downNode
→ preventSigmaDefault()
→ beginTemporaryFileMove(...)
→ coordinator enters primed
→ coordinator.ownsPointerSequence === true even while only primed
→ FileMovePointerOwner.claim()
```

The Move coordinator itself correctly has:

```text
idle
→ primed
→ only after >= 3 px
→ dragging
```

and sends no physics `begin` effect before the threshold.

But the browser/Sigma pointer ownership is being claimed **before** that threshold.

This means a plain click/double-click can be treated externally like a drag candidate strongly enough to interfere with Sigma's real click/double-click event sequence.

Existing tests that invoke:

```text
clickNode
doubleClickNode
```

directly do not prove that real pointerdown/up sequences still generate those events.

## Required interaction contract

### Single click

```text
pointer down on movable File
→ internally may prime Move
→ cursor remains ordinary clickable pointer
→ no exclusive pointer ownership
→ no physics Worker / no constraint
→ pointer up below 3 px
→ normal Sigma click survives
→ node selection/single-click behavior works
```

### Double click

```text
first down/up below threshold
second down/up below threshold within double-click window
→ no drag begins
→ no Move click suppression
→ Sigma doubleClickNode occurs
→ canonical File activates exactly once
→ no camera double-click zoom
```

### Real drag

```text
pointer down
→ prime only

movement < 3 px
→ still a click candidate

movement crosses >= 3 px
→ Move becomes dragging
→ NOW take exclusive native pointer ownership
→ NOW show grabbing cursor
→ NOW suppress Sigma stage pan/click semantics
→ PHYSICS1 begin
→ File moves

release
→ end constraint
→ suppress trailing click/double-click generated by the drag
```

This distinction is the key requirement:

```text
primed ≠ pointer-owned drag
```

## Cursor contract

Current behavior exposes `grab` on eligible hover and `grabbing` as soon as the coordinator owns a primed sequence.

Change the user-facing pointer semantics to:

```text
movable File, idle/hovered
→ cursor: pointer

pointer down but below drag threshold
→ cursor: pointer

actual dragging
→ cursor: grabbing
```

The grabbing hand must mean **drag is actually happening**.

Do not show a `grab` hand just because the File happens to be movable.

If there is a compelling native accessibility/platform reason to retain a different pointer for keyboard movement, keep keyboard state separate from ordinary pointer hover.

## Architecture guidance

Do not remove the 3 px MOVE1A threshold.

Prefer correcting ownership semantics around it.

Potentially relevant distinction:

```text
coordinator.phase === 'primed'
coordinator.phase === 'dragging'
```

The existing `ownsPointerSequence` getter currently includes both; consider whether the code needs two explicit concepts such as:

```text
hasPointerCandidate
isDragging / ownsDragPointer
```

Exact naming/design is Codex's choice after inspecting all callers.

The DOM `FileMovePointerOwner` already has:

```text
candidatePointerId
owned pointer
claim()
```

so a clean solution may be possible by **arming** the candidate on downNode and claiming/capturing only when the Move coordinator actually transitions to `dragging`.

Do not blindly change `ownsPointerSequence` without checking:

- window/document pointer continuation;
- overlay-crossing behavior;
- stage camera dragging;
- `moveBody`;
- `upNode` / `upStage`;
- click suppression;
- keyboard Move;
- Escape / blur / lost capture;
- Arrange Folders arbitration.

If Sigma begins stage panning before the 3 px threshold and that creates visible camera drift, solve that narrow problem without restoring premature drag ownership.

## Must preserve

- direct File Move after 3 px;
- whole-graph physics;
- overlay-crossing pointer continuity once drag starts;
- release smoothing;
- drag click suppression;
- keyboard Move;
- Arrange Folders mutual exclusion;
- Sigma double-click default zoom remains prevented when a node activation double-click is actually recognized.

---

# PART B — Make label size and gap scale with zoom like the node

## Current problem

PR #110's shared label renderer currently uses approximately:

```text
fontPx = min(14 + renderedRadius / 4, renderedDiameter)
gapPx = 5
```

in final Canvas screen pixels.

That preserved the font<=diameter invariant, but it is **not equivalent to Obsidian's rendering transform**.

PR #110's Obsidian evidence says Obsidian conceptually uses:

```text
base font = 14 + node radius / 4
label y   = node y + (node radius + 5) * nodeScale
```

and the node and text share the renderer scale.

In other words, Obsidian scales the **whole label presentation** with the graph/node presentation. It does not keep a fixed 14-screen-pixel base while the graph shrinks.

The user-visible symptom in Icarus is:

> when zooming out, the text eventually looks much too large relative to the node.

## Required result

At ordinary zooms, the ratio between:

```text
label font height
rendered node diameter
```

should remain visually coherent as zoom changes.

The label gap should scale coherently too.

Still enforce:

```text
font height <= rendered node diameter
```

for Icarus's smaller nodes.

## Required investigation before coding

Inspect Sigma 3.0.3's actual production rendering path and establish:

- what `NodeLabelDrawingFunction`'s `data.size` represents;
- whether it is already camera-adjusted;
- how Sigma computes WebGL node screen radius;
- `zoomToSizeRatioFunction` / camera ratio involvement;
- whether the original logical/reducer node radius is available in label draw data;
- the cleanest way to obtain a presentation scale without React state.

Instrument a real production renderer if necessary.

Do not rely on the existing comment saying "screen-space node radius" unless verified against actual rendering at multiple camera ratios.

## Preferred conceptual model

If compatible with Sigma's internals, emulate Obsidian's transform:

```text
logicalRadius = final Icarus presentation radius before camera zoom
renderedRadius = actual on-screen radius
renderScale = renderedRadius / logicalRadius

logicalFont = 14 + logicalRadius / 4
fontPx = logicalFont * renderScale

fontPx = min(fontPx, renderedRadius * 2)

gapPx = 5 * renderScale
```

This is conceptual guidance, not a requirement to force this exact implementation if Sigma exposes a better equivalent.

Do not make camera ratio itself a layout/persistence setting.

## Interaction with 1B fade

If GRAPHVIS-OBSIDIAN1B is present:

```text
size scaling
→ determines actual rendered text size

zoom opacity fade
→ independently controls alpha near disappearance threshold
```

These must compose.

Do not use fading as a substitute for fixing disproportionate font size.

Selected/hovered labels may remain fully opaque while still using the correct zoom-scaled font size.

---

# PART C — Truncate long File labels; never horizontally squeeze glyphs

## Confirmed implementation hazard

The current shared Canvas label renderer calls:

```ts
context.fillText(label, x, y, maxWidth)
```

Canvas `fillText(..., maxWidth)` is allowed to condense text horizontally to satisfy `maxWidth`.

That matches the user's observation that long labels appear stretched/squashed inward.

Do not use `maxWidth` as the truncation mechanism.

## Desired visible limit

Use this as the approximate maximum visual label width reference:

```text
Creativity - Initiative - Curiosity.md
```

At the same font, a longer name such as:

```text
Hippocampus as a reward predictor + Cerebellum.md
```

should become a clean ellipsized label, for example conceptually:

```text
Hippocampus as a reward predictor…
```

Exact cut position depends on proportional font metrics.

## Implement width-based ellipsis, not naïve character count

Prefer:

```text
set final font
measure reference-width budget
measure actual label
if <= budget:
  render unchanged
else:
  find longest prefix that fits together with "…"
  render prefix + "…"
```

A binary search over code points/graphemes is preferable to repeatedly trimming one character for every frame.

Avoid splitting Unicode surrogate pairs.

If a small cached text-measurement result is useful, keep it renderer-local and bounded; do not create a persistent semantic cache.

## Important

Draw the truncated string at natural glyph proportions:

```text
fillText(truncatedLabel, x, y)
```

Do **not** pass the old constraining `maxWidth` for ordinary label truncation.

Viewport-edge protection can still use a smaller available width when necessary; truncate further rather than squeeze.

The canonical/full label remains unchanged in:

- graph data;
- Network Explorer;
- Inspector;
- search;
- source path;
- accessibility surfaces.

This is display-only truncation.

Use the same behavior in All and Focus.

---

# PART D — Hover focus: brighten connected edges, do not dim the graph

## Current behavior to change

Current All/Focus hover reducers calculate `relatedToHover` and use it to dim unrelated nodes/edges:

```text
unrelated nodes → dimmedNode
unrelated edges → dimmedEdge
```

The user does **not** want that presentation.

Desired hover behavior:

```text
hovered node
→ focused/highlighted

directly connected edges
→ brighter / visually stronger

all unrelated nodes
→ remain at their ordinary color

all unrelated edges
→ remain at their ordinary non-hover style
```

No whole-graph dark overlay.

No unrelated-node fade animation.

No network-neighborhood dimming.

### Far-LOD exception

Preserve existing semantic/far-LOD edge hiding rules.

If a weak direct edge is normally hidden at far LOD but hovering its endpoint currently reveals it, keep that useful behavior.

Do not use hover as a reason to reveal every unrelated far edge.

## Brightening direct edges

First inspect the Obsidian 1.11.5 extraction for highlighted/incident graph-line treatment.

If there is a clear evidence-backed value/rule, use it.

Otherwise derive a restrained direct-edge highlight from the existing PR #110 dark palette.

Requirements:

- clearly brighter than ordinary `#3f3f3f`-like edges;
- not as visually dominant as the selected/hovered node;
- diagnostic/status edge meaning should not be erased unnecessarily;
- no persisted color changes;
- optional modest width increase is acceptable if it improves readability.

Do not add a user setting in this task.

Use the same interaction principle in All and Focus.

---

# PART E — Small hover label ease-out motion

## Desired behavior

When the pointer enters a node:

```text
label stays horizontally centered
label keeps same font/truncation/fade logic
label shifts slightly downward
short ease-out
```

The movement should be subtle, not a large UI animation.

When leaving:

```text
label returns smoothly to normal position
```

## Obsidian reference

PR #110's evidence already found that Obsidian's highlighted node keeps the same centered/below anchor and moves the text farther down by up to approximately 15 graph/display units depending on its renderer scale.

Re-open the extracted Obsidian code and recover, if possible:

- exact target offset;
- scale relationship;
- duration;
- easing/interpolation;
- enter/leave behavior.

The user's desired effect is "very little", so preserve the behavioral idea without blindly applying 15 fixed CSS pixels to small Icarus nodes.

### Fallback if exact animation does not port cleanly

Use a small scale-aware offset, visually around a few pixels at ordinary zoom, bounded relative to rendered node radius.

Use a short ease-out, roughly in the 80–160 ms family.

Do not expose a setting.

Respect:

```text
prefers-reduced-motion: reduce
```

by applying the final hover presentation without animated interpolation.

## Performance / ownership

Labels are Canvas/Sigma-rendered.

Do not introduce React state per animation frame.

Prefer renderer-local transient state and `requestAnimationFrame`.

Only the hovered node (and the just-left node while returning) should require animation work.

Do not refresh/reduce the entire graph every frame if a partial renderer-local path can do the job.

This is label presentation only:

```text
Graphology x/y remain unchanged.
camera remains unchanged.
physics remains unchanged.
```

---

# Shared-label architecture

PR #110 correctly introduced a shared Network label renderer.

Keep one core implementation for:

```text
All + Network
Focus + Network
```

The following should be shared unless there is a strong type/API reason otherwise:

- zoom-scaled font formula;
- zoom-scaled gap;
- truncation;
- hover vertical offset;
- opacity composition from 1B.

Do not regress to separate All/Focus label algorithms.

---

# Required testing

## A. Real click/double-click pointer sequence

The current direct event-handler tests are insufficient for the reported bug.

Add an integration/browser-level regression that uses an actual pointer/mouse sequence against Sigma or the closest real captor path:

### Single click

```text
pointerdown
pointerup
```

with movement below 3 px:

- selection/click occurs;
- Move never becomes dragging;
- no File Move physics begin;
- cursor never enters grabbing;
- no click suppression.

### Double click

Two valid clicks within the configured window:

- `doubleClickNode`/activation occurs exactly once;
- no Move begin/update/end;
- no node movement;
- Sigma camera does not perform its default double-click zoom.

### Drag

```text
pointerdown
move >= 3 px
pointerup
```

- click/double-click activation suppressed;
- Move begins exactly once;
- pointer ownership/capture becomes active only after threshold;
- grabbing cursor appears only then;
- release works.

Also cover overlay crossing / pointer continuation because the pointer owner was originally introduced for this.

## B. Label scale tests

Use the real renderer or a deterministic equivalent to compare at multiple camera ratios.

Assert:

- rendered node radius changes as expected;
- font changes in the same direction;
- font/node-diameter relationship remains bounded/coherent;
- gap scales coherently;
- no fixed-screen 14 px plateau makes labels dominate small zoomed-out nodes;
- 1B opacity fade, if present, still works.

Avoid brittle screenshot-only assertions for the core math.

## C. Truncation tests

Cover:

```text
short name unchanged
reference-length name unchanged
very long name ends with …
Unicode label is not split incorrectly
viewport-limited label truncates further instead of squeezing
natural text draw has no maxWidth compression argument
```

Use the exact reference text:

```text
Creativity - Initiative - Curiosity.md
```

in at least one test/evidence case.

## D. Hover style tests

Assert:

```text
hovered node → highlighted
direct incident edge → brighter
unrelated node → same ordinary base color as no-hover
unrelated edge → same ordinary base style as no-hover
```

for All and Focus.

Preserve arrangement-specific styling tests separately: Arrange Folders can continue to have its own stronger scope highlighting.

## E. Hover label animation

Purely test:

- progress 0 → base y;
- progress 1 → small lower y;
- easing monotonic/bounded;
- reduced motion skips interpolation;
- x/font/truncated text do not change solely because of hover animation.

Add a focused renderer integration proving animation does not alter Graphology coordinates.

---

# Visual regression / native QA

Use one native/browser review pass for all four changes.

## All + Network

Check:

1. single click feels like click;
2. rapid double click opens/activates the File;
3. tiny pointer jitter does not enter drag;
4. deliberate drag crosses threshold and then shows grabbing cursor;
5. dragging still works across overlays;
6. zoom out: label shrinks with node;
7. label also fades near threshold if 1B is present;
8. long filenames truncate with ellipsis and never look horizontally compressed;
9. hover: direct lines brighten;
10. unrelated nodes/edges do not darken because of hover;
11. hover label shifts down only slightly and eases;
12. Move remains smooth at real-vault scale.

## Focus + Network

Repeat the relevant checks, including:

- root label;
- neighboring File;
- Section/Block labels;
- reference/hierarchy edges;
- double-click activation for canonical File nodes.

## Specific label cases

Compare at least:

```text
Creativity - Initiative - Curiosity.md
Hippocampus as a reward predictor + Cerebellum.md
```

Record screenshots locally for QA if useful, but do not commit vault-identifying screenshots/content unless repository policy explicitly allows it.

---

# Regression boundaries

This task must not alter:

```text
ForceAtlas2
PHYSICS1 numerical behavior
convergence
Pull
Place
folder clustering
density framing
layout coordinates
projection
QUERY1
Saved View persistence
Visual Group persistence
Hierarchy layout
```

Presentation updates must produce:

```text
0 new layout requests
0 new physics jobs
0 new spatial-influence jobs
0 automatic camera reframes
0 cache invalidations
0 persistence writes
```

The pointer arbitration fix may change **when** Move obtains ownership, but must not change the existing 3 px threshold or physics once a real drag begins.

---

# Documentation

Update the current PR #110 implementation report:

```text
history-implementations/GRAPHVIS_OBSIDIAN1_implementation_status.md
```

Update:

```text
docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md
```

only where new Obsidian evidence is established for:

- label scale transform;
- hover label motion;
- incident edge highlighting.

Do not claim exact Obsidian parity where the implementation is an Icarus adaptation.

Archive this exact prompt under `history-implementations/` following repository conventions.

---

# Validation

Follow current `AGENTS.md`.

At minimum run current equivalents of:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web

pnpm benchmark:file-move
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also run the real browser graphical/pointer sequence QA described above.

No new external dependency unless clearly necessary and justified.

No timing-based CI gate.

---

# Exit gate

Ready for user native acceptance only when:

### Click / Move

1. ordinary movable-node hover uses a click/pointer cursor;
2. below-threshold press/release remains a real click;
3. double-click activates a canonical File exactly once;
4. double-click causes zero File movement;
5. double-click causes zero PHYSICS1 begin;
6. Sigma's default double-click camera zoom remains prevented;
7. actual dragging still begins at the established 3 px threshold;
8. exclusive pointer ownership/capture begins only for a real drag;
9. grabbing cursor appears only during real drag;
10. trailing drag click remains suppressed;
11. overlay-crossing drag continuity remains intact.

### Labels

12. font size scales sensibly with zoom/node presentation;
13. vertical label gap scales coherently too;
14. font never exceeds rendered node diameter;
15. 1B fade still works if present;
16. All and Focus still share one label policy;
17. long labels use true ellipsis truncation;
18. Canvas horizontal squashing via `fillText(..., maxWidth)` is no longer the normal long-label behavior;
19. the `Creativity - Initiative - Curiosity.md` visual-width target is respected.

### Hover

20. hovered node remains focused;
21. directly connected edges visibly brighten;
22. unrelated nodes remain at ordinary colors;
23. unrelated edges remain at ordinary styles;
24. no whole-graph hover overlay/dimming;
25. label makes only a small downward ease-out movement;
26. reduced motion is respected;
27. hover animation never changes graph x/y or camera.

### System

28. no layout/physics/spatial algorithm change;
29. no cache/persistence change;
30. focused tests pass;
31. `pnpm check` passes;
32. desktop check/build pass;
33. fresh optimized executable is produced;
34. PR #110 remains unmerged until the user accepts the native behavior.

---

# Final report

## Interaction correction

Report:

- root cause of double-click failure;
- exact ownership change;
- cursor-state change;
- evidence that click/double-click/drag are now separated.

## Label rendering

Report:

- Sigma size semantics found;
- old vs new zoom/font formula;
- gap scaling;
- truncation algorithm and width budget;
- interaction with 1B fade.

## Hover presentation

Report:

- direct-edge highlight rule/color;
- proof unrelated graph elements are not dimmed;
- hover-label offset/easing/duration;
- reduced-motion behavior.

## Validation

List:

- focused pointer tests;
- renderer tests;
- file-move benchmark;
- renderer benchmarks;
- `pnpm check`;
- desktop check/build;
- browser QA.

## Native handoff

Provide the fresh executable path and a short acceptance checklist focusing on:

```text
double-click
drag threshold/cursor
zoomed label proportions
long filename truncation
connected-edge hover highlight
subtle label hover movement
```

Keep PR #110 unmerged until user approval.
