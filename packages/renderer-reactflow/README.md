# React Flow Structural Renderer

Status: **STABLE — KG12A phase/counter hooks preserve the UX4B renderer contract.**

This renderer package turns one KG6 `ViewProjection` into a deterministic,
read-only React Flow scene. It owns renderer IDs, fixed node geometry, Dagre
layout, semantic node/edge presentation, direct-neighborhood emphasis, viewport
navigation, anchored disclosure, and accessible canvas controls. It does not inspect canonical
references, roll endpoints, aggregate links, apply focus/filter policy, read
reports, access files, or persist view state.

```text
ViewProjection + renderer interaction state
  → one-to-one React Flow mapping
  → deterministic Dagre coordinates
  → structural or focus graph canvas
```

## File map

```text
src/
  types.ts               Renderer data, selection, layout, and component contracts.
  ids.ts                 Collision-safe projection-to-renderer tuple IDs.
  mapping.ts             One-to-one semantic React Flow node/edge mapping.
  layout.ts              Fixed-size Dagre layout and explicit grid fallback.
  highlight.ts           Direct incident-node/edge visual emphasis.
  center-request.ts      Keyed projected-node viewport-center resolution.
  semantic-viewport.ts   Viewport-center to canonical-entity bookmark observation.
  viewport-navigation.ts Wheel zoom, focal-point, and disclosure-anchor geometry.
  prepare.ts             Pure mapping + layout benchmark/test entry point.
  disclosure-context.tsx Stable entity-disclosure callback boundary.
  nodes.tsx              Memoized entity and diagnostic custom nodes.
  edges.tsx              Memoized hierarchy/reference custom edge.
  component-maps.ts      Module-scope stable React Flow type maps.
  GraphCanvas.tsx        Read-only viewport, selection, hover, disclosure, and controls.
  styles.css             Node, edge, control, and reduced-motion presentation.
  *.test.ts              Mapping, layout failure, determinism, and highlight tests.
```

## Contract and layout

The mapper creates exactly one renderer node or edge for each projected node or
edge. It uses projection IDs only for semantics; React Flow IDs wrap them in
JSON tuples so node/edge namespaces cannot collide. Diagnostic targets remain
selectable terminals, and aggregated reference counts come directly from KG6
`referenceIds`. Internal collapsed references appear only as entity badges and
never as self-loop edges.

Structure mode uses a top-to-bottom Dagre layout. Focus mode uses left-to-right
layout. Entity nodes participate in Dagre topology; diagnostic targets are
placed deterministically beside their projected source so they do not distort
structural ranks. Every node type has a fixed measured size. A layout exception
becomes an explicit warning plus deterministic grid—not a success-shaped empty
graph.

The graph is deliberately not an authoring surface: nodes cannot be dragged or
connected, edges cannot be reconnected, and Delete is disabled. First render
fits the viewport; application-requested focus changes may fit again, while
ordinary disclosure does not aggressively reset the user's viewport. Motion
durations are zero and CSS honors reduced-motion preferences.

UX4A replaces React Flow's scroll zoom with a non-passive, renderer-local wheel
handler. UX4B makes its ownership explicit through `TrackpadZoomMode`: the
default `scroll-zoom` mode captures ordinary and Ctrl-wheel input for focal
zoom, while `pinch-zoom` captures only Ctrl-wheel pinch zoom and delegates
ordinary two-finger movement to React Flow's public pan-on-scroll path. The
capture-phase handoff prevents React Flow and the custom handler from applying
the same gesture twice. D3-compatible delta normalization uses the named
sensitivity constant `GRAPH_ZOOM_SENSITIVITY = 1.8`, clamps to the shared
`0.08`–`2` zoom bounds, and preserves the graph point beneath the mouse or
precision-touchpad focal point. Native wheel events over the viewport controls
or an explicitly marked scroll region are not captured.
Wheel-driven semantic viewport persistence is debounced to one observation 120
ms after the final tick; raw transforms and high-frequency frames still do not
cross the renderer boundary.

Disclosure captures the toggled entity's screen-space center and current zoom,
then restores that point after the new projection and layout commit. Only the
viewport translation changes: zoom, selection, focus, Inspector state, and
disclosure semantics remain owned by their existing layers. A missing anchor is
cleared safely without fitting. File cards remain `224 × 112`, Heading nodes are
compact `200 × 96` lozenges, and Block nodes remain `168 × 80`; their visible
type labels are File, Heading, and Block while canonical entity kinds are
unchanged.

The bottom-left control stack owns zoom in/out, a custom **Fit graph to view**
button, and the optional application maximize/restore callback. The fit icon is
graph-specific, maximize and restore use conventional corner glyphs, and the
built-in React Flow Fit and interactive-lock buttons are hidden.

Hover is transient renderer-local neighborhood emphasis: the hovered node or
edge and its direct endpoints remain emphasized while unrelated content fades.
Pointer leave removes those classes immediately. Selection is independent and
uses React Flow's persistent selected state without fading unrelated content;
Focus remains projection-level graph isolation owned by KG6. Hover changes map
prepared renderer elements only and never rerun projection or layout.

KG12A adds an optional `PerformanceInstrumentation` prop and matching pure
prepare hook. When omitted—the normal path—there is no recorder. When supplied,
mapping, Dagre, highlight, viewport, commit, and next-paint counts remain
in-memory. Tests prove hover/selection add highlight work without another
mapping/layout operation. No renderer behavior, layout algorithm, dependency,
or visibility policy changes in KG12A.

KG8 adds an optional keyed `GraphCenterRequest` containing only a projected node
ID and optional zoom. After the matching projection/layout exists, the renderer
uses that node's prepared center with duration `0`; stale IDs are consumed
safely. Centering is independent from selection and full-graph fit, and the
renderer still has no canonical or inspection dependency.

KG9B adds an optional interaction-end observation. Using the actual container
dimensions and React Flow transform, the renderer selects the nearest visible
entity node and reports only its canonical `entityId` plus zoom. Diagnostic
nodes are never anchors, raw transforms never cross the boundary, equal-distance
ties are deterministic, and high-frequency move frames are ignored. An initial
saved center request suppresses the competing initial fit and is applied after
React Flow initializes; missing or filtered anchors remain an application-owned
fit fallback.

`onlyRenderVisibleElements` is intentionally left at React Flow's default.
KG7's local synthetic and real-report browser runs remained responsive, and the
option itself adds visibility-check overhead. KG12 may revisit this with an
explicit workload budget.

## Dependency boundary

Production code depends only on KG6 view projection, React, React Flow, and
Dagre. ESLint rejects canonical/core, source adapters, diagnostics, application,
filesystem, platform, Sigma, and Graphology imports. The `./prepare` subpath
exposes pure mapping and layout phases separately, so the opt-in benchmark can
measure both without mounting React or opening a browser.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web build
```
