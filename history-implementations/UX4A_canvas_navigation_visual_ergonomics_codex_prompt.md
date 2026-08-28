# UX4A — Canvas Navigation & Visual Ergonomics

## Task type

Focused graph-canvas interaction / navigation / renderer usability pass.

This is **UX4A only**.

UX4B will later redesign maximized mode into a true canvas-only workspace with floating/collapsible tools and an overlay Inspector drawer.

---

# Starting point

Use the latest `main` of:

`lillo24/icarus-graph-explorer`

At the time this prompt was prepared, `main` is:

`29045854f41773243163faf4ce8bc379818529d6`

This includes:
- KG10;
- UX1;
- UX2;
- UX3;
- KG11A Tauri one-shot local-vault opening.

The desktop app is a thin Tauri shell around the same web UI, so UX4A should be implemented primarily in the shared React/renderer layer and must be tested in both:
- normal browser/Vite;
- Windows Tauri desktop app.

---

# User problems to solve

1. **Touchpad pinch zoom**
   - Desktop: pinch does not behave correctly/usefully.
   - Website: pinch/trackpad zoom works but is **too weak**.
   - Zoom should feel substantially more responsive.

2. **Expand/collapse destroys spatial orientation**
   - Expanding a document/heading triggers a Dagre relayout.
   - The node the user just expanded moves somewhere else on screen.
   - The user loses the document/heading they were working on.

3. **Documents and headings look too similar**
   - Current color distinction is useful but insufficient.
   - They should differ through shape/size/type treatment as well.

4. **Bottom-left Fit View icon is confused with fullscreen**
   - The existing four-corners-style visual is read as fullscreen.
   - Use a conventional fullscreen/maximize symbol for maximize.
   - Give Fit View its own clearly different symbol.

Do **not** implement the true canvas-only fullscreen shell in this PR.
That is UX4B.

---

# Product interaction rules

After UX4A:

```text
Pinch / wheel zoom
→ responsive graph zoom
→ about 1.8× stronger than current behavior
→ point under cursor/fingers stays stationary

Expand / collapse
→ graph may relayout
→ the exact node interacted with remains at the same screen position
→ current zoom stays unchanged

Document
→ substantial rounded rectangular file card

Heading
→ visually lighter/compact lozenge-like heading card
→ clearly distinguishable even without relying on color

Bottom-left controls
→ + Zoom in
→ − Zoom out
→ Fit graph
→ Maximize graph
```

---

# Current implementation facts

## Renderer

Current graph renderer:

`packages/renderer-reactflow/src/GraphCanvas.tsx`

Uses:
- React Flow `12.11.5`;
- `minZoom={0.08}`;
- built-in `<Controls>`;
- Dagre-prepared graph positions;
- public React Flow viewport helpers via `useReactFlow`.

Current React Flow behavior has:
- `zoomOnScroll` defaulting to true;
- `zoomOnPinch` defaulting to true;
- no public zoom-sensitivity prop.

React Flow's underlying D3 wheel zoom uses a delta formula approximately equivalent to:

```ts
-event.deltaY
  * modeFactor
  * (event.ctrlKey ? 10 : 1)
```

with scale factor `2 ** delta`.

For UX4A, keep the same normalized model but multiply the zoom delta by:

```ts
const GRAPH_ZOOM_SENSITIVITY = 1.8;
```

This should be a single named/testable constant, not magic numbers scattered through event handlers.

## Layout

Dagre owns structural positions in:

`packages/renderer-reactflow/src/layout.ts`

A disclosure change can move the entire graph because it changes topology and Dagre recomputes all positions.

Do not try to prevent Dagre from moving nodes in UX4A.

Instead, compensate the **viewport** after the relayout so the interacted node stays at the same screen coordinate.

## Disclosure

The +/− disclosure control is inside:

`packages/renderer-reactflow/src/nodes.tsx`

and calls the `EntityDisclosureProvider`.

GraphCanvas receives:

```ts
onToggleEntity(entityId, currentlyOpen)
```

from GraphExplorer.

This is the correct seam for anchored disclosure.

## Node visuals

Current fixed dimensions:

```ts
document: 224 × 112
section: 208 × 104
block: 168 × 80
```

Current documents and sections are both rounded rectangular cards with different top-border colors/backgrounds.

UX4A should add a second/third visual channel beyond color.

---

# Part A — Strong, predictable touchpad/wheel zoom

## 1. Make touchpad/wheel zoom intentionally stronger

Target:

> A given physical wheel/pinch gesture should produce approximately **1.8× the current zoom delta**.

Do not simply increase `maxZoom`.

The issue is sensitivity, not the zoom range.

Keep the current useful range approximately:

```text
min zoom: 0.08
max zoom: 2
```

unless current code already centralizes slightly different bounds.

Define shared renderer constants for the bounds rather than duplicating raw values where practical.

---

# 2. Use a custom wheel/pinch viewport handler

React Flow does not expose zoom sensitivity directly.

Implement wheel/trackpad zoom through public viewport APIs rather than patching `@xyflow/react`, forking D3, or reaching into unstable React Flow internal store fields.

Preferred strategy:

- handle `wheel` events on the actual graph canvas;
- listener must be non-passive so `preventDefault()` is legal;
- stop the browser/WebView from page-zooming/scrolling while the gesture is intended for the graph;
- disable React Flow's ordinary wheel zoom path to prevent double application;
- retain React Flow's true touch/pointer pinch support for touchscreens.

Conceptually:

```tsx
<ReactFlow
  zoomOnScroll={false}
  zoomOnPinch
  ...
/>
```

Then the graph-canvas wheel handler owns:
- mouse wheel zoom;
- Windows precision-touchpad wheel-like zoom;
- ctrl+wheel pinch-style browser events.

This deliberately makes **wheel zoom and touchpad zoom share one calibrated sensitivity**, because on Windows some touchpad pinch events cannot be reliably distinguished from ordinary wheel events.

Do not add device/OS sniffing.

---

# 3. Preserve the zoom focal point

Zoom must occur around the point under the cursor/fingers.

Do **not** zoom around the center of the whole canvas.

Given current viewport:

```ts
{x, y, zoom}
```

and pointer location relative to the canvas:

```ts
{px, py}
```

calculate the flow coordinate under that point before zoom:

```ts
flowX = (px - x) / zoom
flowY = (py - y) / zoom
```

After choosing `nextZoom`:

```ts
nextX = px - flowX * nextZoom
nextY = py - flowY * nextZoom
```

Then:

```ts
setViewport({
  x: nextX,
  y: nextY,
  zoom: nextZoom,
})
```

This means the object under the user's fingers/cursor does not slide away during zoom.

Prefer extracting this math into a pure helper with unit tests.

---

# 4. Zoom delta normalization

Use a D3-compatible normalized wheel delta and then apply our multiplier.

Conceptually:

```ts
const modeFactor =
  event.deltaMode === 1
    ? 0.05
    : event.deltaMode
      ? 1
      : 0.002;

const normalizedDelta =
  -event.deltaY
  * modeFactor
  * (event.ctrlKey ? 10 : 1)
  * GRAPH_ZOOM_SENSITIVITY;

const nextZoom =
  clamp(currentZoom * 2 ** normalizedDelta, MIN_ZOOM, MAX_ZOOM);
```

Set:

```ts
GRAPH_ZOOM_SENSITIVITY = 1.8;
```

If browser + Windows Tauri manual QA shows 1.8 is clearly still too weak or clearly excessive, tune **this one constant only**, keeping final value in the approximate `1.6–2.0` range unless strong evidence justifies otherwise.

Report the final chosen value.

Do not add a user-facing sensitivity setting yet.

---

# 5. Prevent duplicate/browser zoom

For handled wheel events over the graph:

- call `preventDefault()`;
- prevent the browser/WebView page itself from zooming on ctrl+wheel/pinch;
- prevent React Flow from applying a second wheel zoom.

Do not interfere with:
- clicking buttons;
- select/dropdown scrolling outside the actual graph canvas;
- Inspector scrolling;
- page scrolling when the pointer is outside the graph.

If the listener lives on `.graph-canvas`, explicitly ignore wheel events whose target is inside UI that should scroll independently, e.g.:
- `.react-flow__controls`;
- elements marked `.nowheel`;
- another deliberate scroll container.

Do not break accessibility or keyboard zoom controls.

---

# 6. Keep zoom smooth

Do not route every wheel tick through React state.

Use React Flow's imperative viewport API.

If event density causes unnecessary repeated work:
- coalesce wheel deltas per animation frame;
- apply one viewport update per frame.

Do not reprojection.
Do not rerun Dagre.
Do not rebuild canonical graph data.

Wheel/pinch zoom must remain a viewport-only operation.

---

# 7. Persist the resulting viewport correctly

Current KG9 persistence stores semantic viewport information.

A custom programmatic `setViewport()` may produce callbacks whose underlying event is `null`, while existing code intentionally ignores non-user `onMoveEnd` events.

Therefore, explicitly ensure the final viewport after a user wheel/pinch gesture still updates the semantic viewport bookmark.

Preferred:
- debounce gesture-end observation (~80–150 ms after last wheel tick);
- call existing `observeSemanticViewport(...)` using:
  - current prepared graph;
  - final viewport;
  - current canvas dimensions;
- forward the resulting observation through existing `onViewportObservation`.

Do not persist every wheel tick.

Do not change the persisted schema.

---

# 8. Desktop/Tauri behavior

The shared renderer solution must be tried first.

Do **not** immediately modify Rust/Tauri/WebView2 settings.

Required desktop QA:
- Windows precision touchpad pinch over graph;
- ordinary two-finger interaction;
- mouse wheel if available;
- no entire-app/browser page zoom;
- graph zoom noticeably stronger than before.

Only if the DOM-level shared handler demonstrably cannot receive/stop the relevant WebView2 gesture may this PR add the **smallest possible desktop-shell adjustment**.

If such a fallback becomes necessary:
- document why;
- keep graph zoom math shared in TypeScript;
- do not build a parallel desktop zoom implementation.

---

# Part B — Anchored disclosure

## 9. Preserve the interacted node's screen position

When the user presses `+` or `−` on a visible document/heading:

1. capture that node's current flow position;
2. capture the current viewport;
3. calculate the node center's **canvas-local screen coordinate**;
4. perform the existing disclosure state change;
5. let projection + Dagre recompute normally;
6. find the same entity/node in the newly prepared graph;
7. translate the viewport so that node center returns to its previous canvas-local screen coordinate;
8. preserve the exact previous zoom.

This behavior is called **anchored disclosure**.

Example:

Before:

```text
                 [My Document]   ← screen position P
```

User expands.

After layout:

```text
                 [My Document]   ← still screen position P
                       │
                 ┌─────┼─────┐
              [H1]   [H1]   [H1]
```

The graph around it can move.
The interacted node should not.

---

# 10. Keep anchored disclosure renderer-local

Prefer implementing the anchor capture/restore inside `GraphCanvas`.

The renderer already has:
- the prepared graph with current positions;
- React Flow viewport helpers;
- the disclosure callback;
- the new prepared graph after projection changes.

Wrap the supplied disclosure callback with something like:

```ts
handleAnchoredToggle(entityId, currentlyOpen)
```

rather than pushing screen-coordinate concerns into:
- canonical model;
- view projection;
- graph-state reducer.

The web layer should still only own **what is expanded**, not screen-space compensation.

---

# 11. Anchor by entity/projection identity, not array index

Capture a stable identifier for the interacted node.

Do not anchor by:
- index;
- label/title;
- current Dagre order.

Use the entity/projection node identity already present in renderer data.

Before toggle, store something conceptually like:

```ts
{
  entityId,
  projectionNodeId,
  localScreenX,
  localScreenY,
  zoom
}
```

After relayout:
- locate the same entity/node;
- calculate its new flow-space center;
- derive the viewport translation needed to restore the stored local screen point.

---

# 12. Use node center as anchor

Anchor the node's **center**, not the entire graph bounding box.

The actual disclosure button is at the bottom-right of the card, but anchoring the node center is more stable and does not depend on internal card CSS.

Changing the heading shape later in this same PR must not invalidate the anchor calculation.

Use the fixed node width/height from renderer data.

---

# 13. Restore before the user sees a jump

Use an appropriate layout-timed effect (`useLayoutEffect` or equivalent) so viewport compensation occurs as close as possible to the prepared-layout update.

Goal:
- no visible "jump away then snap back" if avoidable.

Do not introduce a long animation.

Preferred:
- duration `0`.

If a tiny transition is required to avoid WebView visual tearing, keep it extremely short and respect `prefers-reduced-motion`, but zero-duration is the default requirement.

---

# 14. Do not Fit View on disclosure

Expanding/collapsing must **never** call `fitView()` automatically.

Do not:
- reset zoom;
- recenter the whole graph;
- clear selection;
- change Focus;
- open/close Inspector.

Only compensate pan so the interacted node remains fixed.

---

# 15. Failure behavior

If the anchor cannot be restored because:
- node unexpectedly disappeared;
- projection failed;
- prepared graph is unavailable;

then:
- clear pending anchor;
- leave viewport unchanged;
- do not throw;
- do not fit the entire graph.

This should be exceptional.

Normal expand/collapse semantics keep the interacted node visible.

---

# 16. Persist anchored viewport coherently

After compensation, update the semantic viewport observation once.

Do not save raw x/y into persisted schema.

Keep existing semantic viewport persistence model.

---

# Part C — Stronger Document vs Heading visual distinction

## 17. Use shape + size + color + wording

Current color distinction stays.

Add stronger structural cues.

### Document

Documents should remain the visually substantial root objects:

```text
┌─────────────────────────┐
│ FILE                    │
│ Associated Value        │
│ path/...                │
│                    + 12 │
└─────────────────────────┘
```

Characteristics:
- rounded rectangle;
- current blue family;
- existing document dimensions can remain approximately `224 × 112`;
- visually heavier than a heading.

### Heading

Headings should become a more compact **lozenge/capsule or clipped-corner heading card**:

```text
   /───────────────────\
  | HEADING             |
  | Feeling             |
   \─────────────── + 3/
```

The goal is not a literal flowchart decision diamond.

Avoid a full diamond/rhombus because:
- it wastes horizontal space for text;
- it strongly implies "decision" in diagram conventions;
- heading titles can be long.

Preferred silhouette:
- compact lozenge;
- noticeably more rounded/angled than documents;
- still enough rectangular interior for text.

A robust capsule/pill-like silhouette is acceptable if a clipped-corner implementation causes:
- broken selection outline;
- clipped handles;
- broken shadows;
- text loss.

Do not sacrifice interaction correctness for a fancy polygon.

---

# 18. Make headings somewhat smaller

Current:

```text
document 224 × 112
section  208 × 104
```

The difference is too small.

Target approximately:

```text
document 224 × 112
section  ~196–204 × ~88–96
block    unchanged unless needed
```

Choose final dimensions based on:
- title readability;
- disclosure button fit;
- no text collisions;
- Dagre layout quality.

Keep dimensions fixed/deterministic for Dagre.

Update layout/mapping tests accordingly.

Do not use runtime DOM measurement in UX4A.

---

# 19. User-facing type labels

Change graph card wording from implementation terms when useful:

```text
document → File
section  → Heading
block    → Block
```

This is graph-card presentation only.

Do not rename canonical `EntityKind`.

Do not change Inspector terminology unless required for consistency; UX2 already handles user-facing File/Section/Block there.

If changing `Section` to `Heading` in Inspector would create needless scope, keep UX4A renderer-only and report the inconsistency for later review.

---

# 20. Preserve accessibility and interaction

Visual shape must not affect:
- node hit box;
- focusability;
- keyboard selection;
- disclosure button;
- invisible edge handles;
- hover;
- selection outline;
- Focus;
- Inspector selection.

Selected heading still needs a clear focus/selection ring.

Do not convey type by shape/color alone:
- retain visible text label;
- retain accessible aria label.

---

# Part D — Bottom-left viewport controls

## 21. Separate Fit View from Maximize

The current built-in Fit View symbol is visually read as fullscreen.

Replace the bottom-left controls with:

```text
+
−
[Fit graph icon]
[Maximize icon]
```

Keep React Flow's built-in zoom +/− buttons if they remain appropriate.

Hide the built-in Fit View button:

```tsx
<Controls
  showFitView={false}
  showInteractive={false}
>
  ...
</Controls>
```

Add custom `ControlButton`s for:
1. Fit graph
2. Maximize / restore

No new icon package.

Use small inline SVG components owned by the renderer/web app.

---

# 22. Fit Graph icon

Fit Graph must have a symbol that clearly means:

> bring the graph into the current frame

Do **not** use the conventional four-outward-corners fullscreen glyph.

Preferred visual:
- a small frame/viewport rectangle containing 2–3 tiny nodes/dots;
- or inward-facing arrows toward graph content.

Tooltip/title:

```text
Fit graph to view
```

Accessible label:

```text
Fit graph to view
```

Behavior:
- call existing `fitView`;
- preserve existing padding/maxZoom semantics;
- no change to projection.

---

# 23. Maximize icon

Use the conventional four-outward-corners fullscreen/maximize symbol for entering maximized mode.

When already maximized:
- switch to inward-corners/restore symbol.

Accessible labels:

```text
Maximize graph
Restore graph
```

This button should trigger the **existing UX1 maximize behavior for now**.

Important:

UX4A does **not** yet make maximized mode canvas-only.

UX4B will change maximized mode so:
- search/toolbars become floating/collapsible;
- the canvas consumes the whole surface;
- Inspector becomes a right overlay drawer.

Do not pull UX4B into this PR.

---

# 24. Move maximize control out of the top toolbar

Once the bottom-left maximize control exists:
- remove the duplicate `Maximize Graph / Exit Maximize` text button from the top workspace-control group.

Do not leave two primary controls for the same action.

Existing Escape-to-exit behavior must remain.

Inspector button remains where it currently is for UX4A.

---

# 25. Renderer/web callback seam

Bottom-left controls live inside `GraphCanvas`, but maximized state is currently owned by `GraphExplorer` / app shell.

Use a narrow explicit renderer prop/callback, e.g.:

```ts
readonly maximized?: boolean;
readonly onMaximizedChange?: (maximized: boolean) => void;
```

or an equivalent small viewport-control API.

Do not move app-shell ownership into renderer package.

Do not make the renderer import web components.

---

# Architecture boundaries

## Expected files

Likely renderer changes:

```text
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/mapping.ts
packages/renderer-reactflow/src/styles.css
packages/renderer-reactflow/src/*
renderer tests
```

Likely web changes:

```text
apps/web/src/components/GraphExplorer.tsx
web tests
```

Possibly concise README updates.

## Do not change unless proven necessary

```text
packages/core
packages/parser-markdown
packages/adapter-obsidian
packages/resolver
packages/view-projection
packages/view-state schema
stable identity
incremental pipeline
Tauri Rust shell
source provider
vault watching
```

Anchored disclosure is viewport behavior.
Do not contaminate canonical/projection layers with screen coordinates.

---

# Parallel-work / current KG11 boundary

KG11A is already merged at the starting commit.

If later KG11 work advances `main` while UX4A is in progress:
- rebase/synchronize before merge;
- preserve direct-vault opening behavior;
- do not rewrite the Tauri/source-provider seam;
- resolve web README/tests deliberately.

No filesystem/watch functionality belongs in UX4A.

---

# Performance boundary

The graph is still known to be slow on large expanded views.

UX4A is **not PERF1/KG12**.

Do not:
- replace Dagre;
- add workers;
- add renderer virtualization;
- switch to Sigma/Pixi/WebGL;
- add broad layout caches.

However UX4A must avoid introducing new unnecessary work:

### Zoom
- viewport-only;
- no reprojection;
- no Dagre;
- no React state per wheel tick.

### Anchored disclosure
- disclosure already triggers one projection/layout;
- viewport compensation should not trigger a second layout.

### Visual shape
- fixed dimensions;
- no dynamic measuring.

---

# Explicitly out of scope

Do not implement:

- true canvas-only fullscreen shell;
- floating/collapsible search/tools bubble;
- fullscreen Inspector drawer redesign;
- performance architecture;
- file watching;
- automatic vault reopen;
- source preview;
- Open in Obsidian;
- node dragging;
- manual pinning;
- saved manual positions;
- new renderer;
- Minimap;
- zoom sensitivity preference UI;
- animation-polish pass.

Those can follow separately.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Read:
   - current renderer GraphCanvas;
   - viewport observation helpers;
   - disclosure context;
   - mapping/layout/node styles;
   - GraphExplorer maximize ownership;
   - relevant tests.
3. Run baseline `pnpm check`.
4. Extract/test pure wheel-zoom math.
5. Implement stronger shared browser/Tauri wheel zoom.
6. Verify focal-point preservation.
7. Ensure semantic viewport persistence after gesture end.
8. Test browser touchpad behavior manually.
9. Test Tauri touchpad behavior manually.
10. Implement anchored disclosure capture/restore.
11. Add pure anchor viewport-compensation helper if useful.
12. Add disclosure anchor tests.
13. Redesign document vs heading visual silhouette/dimensions.
14. Update renderer mapping/layout/style tests.
15. Add custom bottom-left Fit + Maximize buttons.
16. Remove duplicate top maximize button.
17. Regression test Focus, Inspector, search, heading limit, maximize.
18. Test ~390px browser layout where applicable.
19. Test Windows Tauri.
20. Sync/rebase latest `main`.
21. Run full validation.
22. Open PR.
23. Merge only after CI.
24. Delete branch/worktree according to project convention.

---

# Required automated tests

## Zoom math

Extract pure viewport math and test:

- positive zoom-in delta increases zoom;
- negative delta decreases zoom;
- clamp respects min zoom;
- clamp respects max zoom;
- 1.8 sensitivity is applied;
- focal flow point maps back to the same local screen coordinate after zoom;
- different `deltaMode` values normalize correctly;
- ctrl-modified wheel uses the intended multiplier.

Use numeric tolerance rather than brittle exact floating-point equality.

## Zoom integration

Where practical:

- React Flow ordinary wheel zoom path is disabled;
- custom canvas handler owns wheel zoom;
- handled wheel calls `preventDefault`;
- UI/`.nowheel` targets are ignored;
- zoom does not alter graph projection data;
- custom maximize/Fit controls remain operable.

Do not build an enormous fake-browser gesture suite if pure helper coverage + browser QA is stronger.

## Anchored disclosure math

Test helper with:

```text
old node position
old viewport
new node position
same zoom
```

and verify:
- old node-center local screen point equals new node-center local screen point after compensation;
- zoom unchanged.

Test both large positive and negative Dagre movement.

## Anchored disclosure integration

Verify:
- expanding visible document triggers anchor capture;
- collapsing visible document triggers anchor capture;
- same entity is used after new prepared graph;
- no `fitView` request is generated;
- selection unchanged;
- Focus state unchanged;
- failure to find anchor clears it safely.

If React integration tests can inspect viewport transforms reliably, assert node screen position within a small tolerance.

## Node visuals

Test renderer data/CSS class intent, not screenshots:
- documents retain document class;
- sections retain section class;
- user-facing type label maps to File/Heading/Block;
- section dimensions are meaningfully smaller than document dimensions;
- fixed dimensions remain present for layout.

## Controls

Verify:
- built-in Fit View is hidden/replaced;
- custom Fit button calls fit;
- custom maximize button calls callback;
- maximize icon/label changes to restore state;
- duplicate top maximize text button removed;
- Escape behavior remains covered by existing maximize tests.

---

# Required browser QA

Use normal browser/Vite with synthetic report and, if available, real vault.

## Pinch / wheel

Test on the actual Windows precision touchpad:

1. Place pointer over a recognizable node.
2. Pinch outward.
3. Confirm zoom is substantially stronger than pre-UX4A.
4. Confirm the node under the gesture stays under the same screen location.
5. Pinch inward.
6. Confirm symmetrical usable zoom-out.
7. Confirm the browser page itself does not zoom.
8. Confirm no horizontal/vertical page scroll is caused while pointer is over graph.
9. Mouse wheel test if hardware is available.

Do not accept "buttons work" as pinch QA.

## Anchored expand

1. Put a document near center-left of viewport.
2. Zoom to a non-default level.
3. Press `+`.
4. Confirm document stays in effectively the same screen position.
5. Confirm headings appear around/below it.
6. Press `−`.
7. Confirm document again stays fixed.
8. Repeat on a heading with nested headings.

The acceptance criterion is spatial orientation, not merely "node remains visible somewhere."

## Visual hierarchy

At normal zoom:
- identify documents vs headings without reading all titles;
- verify color difference remains;
- verify heading silhouette is clearly different;
- verify long heading names still fit/truncate cleanly;
- selected/hovered states remain clear.

## Controls

Bottom-left:
- + works;
- − works;
- Fit icon fits graph;
- four-corners icon maximizes;
- restore icon restores;
- Fit and Maximize are visually unambiguous;
- no duplicate maximize text button remains.

## Regressions

Verify:
- hover semantics from UX3;
- click selection semantics;
- Focus;
- heading ceiling;
- search reveal;
- Inspector;
- persisted viewport;
- Escape from maximize.

No console warnings/errors.

---

# Required Tauri desktop QA

Run:

```bash
pnpm desktop:dev
```

Use the native app window.

Test:

- local vault open still works;
- precision-touchpad pinch zoom;
- stronger sensitivity;
- focal point stability;
- no WebView/page zoom;
- anchored expand/collapse;
- node visuals;
- Fit control;
- maximize/restore control;
- Escape restore;
- Inspector regression.

If pinch still fails only in Tauri:
1. log/inspect whether wheel events reach the canvas;
2. determine whether the WebView consumes them before DOM;
3. only then consider minimal desktop-shell handling.

Do not guess.

---

# Responsive QA

At approximately `390px` browser width:

- bottom-left controls remain reachable;
- custom Fit/Maximize controls do not overflow;
- heading shape does not create page-level horizontal overflow;
- graph remains usable;
- Inspector behavior unchanged.

Desktop-specific pinch is not required at mobile width.

---

# Validation

Run:

```bash
pnpm check
pnpm desktop:check
git diff --check
```

If desktop build prerequisites are available, also run:

```bash
pnpm desktop:build
```

CI must pass.

No new dependency should be needed.

---

# Documentation

Keep updates concise.

Renderer README should state:

- wheel/touchpad zoom uses calibrated shared viewport math;
- zoom preserves the focal point;
- disclosure is screen-anchored to the interacted node;
- File vs Heading have intentionally distinct silhouettes;
- Fit and Maximize are separate viewport controls.

Web/desktop README only if needed.

If project convention still archives completed implementation prompts under:

`history-implementations/`

add this prompt as:

`UX4A_canvas_navigation_visual_ergonomics_codex_prompt.md`

Do not mark UX4B, KG12, or later roadmap work complete.

---

# Exit gate

UX4A is complete only if all are true.

## Zoom

- [ ] Browser touchpad/wheel zoom is noticeably stronger than before.
- [ ] Final sensitivity constant is reported.
- [ ] Target is approximately 1.8× current zoom delta.
- [ ] Zoom preserves point under cursor/fingers.
- [ ] Zoom clamps correctly.
- [ ] Browser page itself does not zoom during graph pinch.
- [ ] No duplicate React Flow wheel zoom occurs.
- [ ] Zoom is viewport-only: no reprojection/layout per tick.
- [ ] Semantic viewport persistence updates after gesture end.
- [ ] Windows Tauri precision-touchpad pinch is manually tested.
- [ ] If desktop needed a shell fallback, it is minimal and documented.

## Anchored disclosure

- [ ] Expanding a document keeps that document at the same screen position.
- [ ] Collapsing keeps it at the same screen position.
- [ ] Expanding/collapsing a heading behaves the same.
- [ ] Current zoom remains exactly unchanged.
- [ ] No automatic Fit View occurs.
- [ ] Selection is preserved.
- [ ] Focus is preserved.
- [ ] Inspector state is preserved.
- [ ] Anchor failure is safe.
- [ ] Semantic viewport remains coherent.

## Visual hierarchy

- [ ] Documents remain substantial rounded rectangular cards.
- [ ] Headings have a clearly different compact silhouette.
- [ ] Difference is visible beyond color alone.
- [ ] Heading card is meaningfully smaller than document card.
- [ ] Visible labels use user-facing File / Heading / Block wording.
- [ ] Long titles remain readable/truncated correctly.
- [ ] Hover state works.
- [ ] Selection state works.
- [ ] Keyboard focus works.
- [ ] Disclosure buttons work.
- [ ] Edge handles/layout remain correct.

## Viewport controls

- [ ] Built-in ambiguous Fit icon is removed/replaced.
- [ ] Custom Fit Graph control has a distinct fit-to-content icon.
- [ ] Conventional four-corners icon controls maximize.
- [ ] Restore icon appears while maximized.
- [ ] Accessible labels/tooltips are correct.
- [ ] Top-toolbar duplicate Maximize button is removed.
- [ ] Escape restore remains functional.

## Boundaries/regressions

- [ ] UX3 hover/selection/Focus unchanged.
- [ ] Heading-level ceiling unchanged.
- [ ] UX2 Inspector unchanged.
- [ ] KG11A local-vault open unchanged.
- [ ] No parser/resolver/schema change.
- [ ] No performance architecture added.
- [ ] No unnecessary dependency.
- [ ] Browser QA passes.
- [ ] Tauri desktop QA passes.
- [ ] ~390px QA passes.
- [ ] No new console warnings/errors.
- [ ] `pnpm check` passes.
- [ ] `pnpm desktop:check` passes.
- [ ] `git diff --check` passes.
- [ ] Branch synchronized with latest `main` before merge.

---

# Final implementation report

When complete, return:

1. Summary
2. PR + merge commit
3. Files changed
4. Final zoom sensitivity constant
5. Browser pinch/wheel behavior
6. Tauri pinch behavior
7. Focal-point preservation implementation
8. Anchored disclosure behavior
9. Document vs Heading visual design
10. Node dimensions chosen
11. Bottom-left Fit/Maximize controls
12. Persistence behavior
13. Responsive behavior
14. Tests
15. Browser QA
16. Tauri QA
17. Dependencies
18. Any desktop-shell fallback
19. Conflicts/rebase notes
20. Deviations from plan
21. UX4B handoff

Do **not** begin UX4B automatically.
Do **not** begin PERF1/KG12 automatically.
