# React Flow Structural Renderer

Status: **STABLE — Structure, Local Structured, and scope-neutral density contracts are test-backed.**

This renderer package turns one KG6 `ViewProjection` into a deterministic,
read-only React Flow scene. It owns renderer IDs, fixed node geometry, Dagre
layout, semantic node/edge presentation, direct-neighborhood emphasis, viewport
navigation, anchored disclosure, and accessible canvas controls. It does not inspect canonical
references, roll endpoints, aggregate links, apply focus/filter policy, read
reports, access files, or persist view state.

```text
ViewProjection + renderer interaction state
  → one-to-one React Flow mapping
  → plain W3 request → deterministic Dagre coordinates
  → structural or focus graph canvas
```

## File map

```text
src/
  types.ts               Renderer data, selection, layout, and component contracts.
  ids.ts                 Collision-safe projection-to-renderer tuple IDs.
  mapping.ts             Extended and compact-schematic one-to-one mapping.
  layout.ts              Plain layout input/result adaptation and grid fallback.
  layout-sync.ts         Direct compute entry used only by tests and benchmarks.
  layout-state.ts        Pure latest-generation commit/anchor state machine.
  local-structured-layout.ts  Exact fingerprint/cache, immediate seed, and root normalization.
  local-structured.ts    DOM-free Local Structured benchmark/test exports.
  visual-group-presentation.tsx  EntityId style context and zero-work operation contract.
  highlight.ts           Direct incident-node/edge visual emphasis.
  focus-interaction.ts   Graph-scoped Enter-to-Focus activation policy.
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
layout. Local Structured uses an independently tunable left-to-right
mode with `nodesep: 22` and `ranksep: 58`. Entity nodes participate in Dagre topology; diagnostic targets are
placed deterministically beside their projected source so they do not distort
structural ranks. Every node type has a fixed measured size. In extended
Structure/Focus, a layout exception becomes an explicit warning plus
deterministic grid—not a success-shaped empty graph.

Production `GraphCanvas` maps the projection on the UI thread and sends only
plain entity geometry/topology to a caller-owned asynchronous layout service.
The first graph waits behind an accessible **Laying out graph…** state. Later
requests retain the last committed graph, selection, hover, and viewport while
showing **Updating layout…**; disclosure and Fit are temporarily disabled so a
control cannot target geometry that has not committed. Only the latest
generation may adopt a result. Center, initial fit, saved viewport restoration,
and disclosure anchors run only against that matching commit. A worker failure
adopts the deterministic renderer-side grid and exposes a warning; production
never falls back to synchronous Dagre.

`GraphVisualVariant` is scope-neutral: `extended` owns the detailed File
`200 × 80`, Heading `184 × 72`, Block `152 × 64`, and diagnostic `208 × 94`
cards; `compact-schematic` owns File `156 × 46`, Heading `148 × 42`, Block
`132 × 38`, and diagnostic `148 × 42` boxes plus the `▰`, `◇`, `●`, and `○`
marker grammar. PRE-KG14A4 assigns compact cards to All Hierarchy and extended
cards to Focus Hierarchy. This visual-density choice is independent from Dagre:
All keeps `structure`, while Focus keeps `local-structured`, its root emphasis,
seed, and exact cache. Fingerprints include measured dimensions, so coordinates
from the former density assignment cannot become stale cache hits.

GROUP1A adds an optional `visualGroupStyles` presentation map to `GraphCanvas`.
It is delivered through a renderer-local context, so changing only the map does
not rerun KG6, React Flow mapping, W3/Dagre, Local Structured fingerprints, or
node geometry. Matched entity cards receive a fixed overlay on the right edge;
File top-edge, Heading left-edge, Block dashed grammar, compact markers, Focus,
hover attenuation, context styling, and the selection ring remain independent.
Diagnostics do not read the map. With the prop omitted, the node markup has no
group data/style and the current appearance is unchanged. GROUP1B UI wiring is
pending.

On a Local Structured cache miss, deterministic O(nodes + edges) seed geometry
is complete, finite, root-normalized, and usable on the first React Flow paint;
W3 refines it asynchronously. An exact bounded memory-cache fingerprint covers
mode/version, node IDs/dimensions, and edge IDs/endpoints/kinds while excluding
labels, paths, source/query text, camera, selection, and hover. Exact hits skip
W3. A worker failure keeps seed/cached geometry and shows a warning instead of
using the standard grid fallback or switching presentation.

The optional runtime transition API exposes only one projected node's viewport
point. It preserves the selected node, or Focus root, across the product's
Network/Hierarchy switch (the internal Free/Structured mounts) and during
structured topology/refinement adoption. The point comes from the visible DOM
card center when available, with measured React Flow bounds as the fallback;
same-instance depth changes stage that anchor before the new topology arrives.
Renderer instances,
graph coordinates, and screen points never enter persisted state. Structured
semantic observation reports only canonical entity anchor plus React Flow zoom.

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
cross the renderer boundary. User-invoked React Flow zoom controls schedule the
same trailing semantic observation because their completed moves have no
originating DOM event.

Disclosure captures the toggled entity's screen-space center and current zoom,
then restores that point after the new projection and layout commit. Only the
viewport translation changes: zoom, selection, focus, Inspector state, and
disclosure semantics remain owned by their existing layers. A missing anchor is
cleared safely without fitting. Document cards are fixed at `200 × 80`, Section
nodes at `184 × 72`, and Blocks at `152 × 64`. Canonical File, Heading, and Block
kinds remain in renderer data and accessible names but are not repeated as
visible labels. Disclosure uses a shared `+`/`−` count control with an unchanged
44 px touch target. `+ N` consumes KG6's actionable count and announces how
many descendants Expand reveals; `− N` is derived from final hierarchy edges
and announces how many visible descendants Collapse hides. A preserved
expanded ID with no final visible descendants renders no `− 0` control, and a
zero actionable count renders no `+ 0` control. Collapsed internal references
remain a compact `↺ N` cue.

UX4C keeps single click as selection and adds a narrow `onFocusEntity(entityId)`
boundary for double-click and graph-scoped Enter on a focused canonical entity.
Controls, editable targets, repeating key events, diagnostic targets, and edges
cannot activate Focus. Disclosure stops click, double-click, and keyboard events
locally. The focus root is derived only from projected `focusDistance === 0`.
The canvas-level `FocusAppearance` (`outline`, `inverted`, or `minimal`) changes
CSS presentation only: it is intentionally absent from mapping/layout options
and prepared-graph memo dependencies. The gold selection ring remains separate
from every root treatment. Distances 2 and 3 receive bounded visual attenuation,
while selected or highlighted nodes regain full readability.

Visible entity content is title-first. Unique documents and sections omit a
detail row; same-named documents use the shortest unique parent suffix, repeated
section headings add only the document/line context needed to distinguish them,
and blocks use `Line N` plus compact document context. Full source paths and
entity kinds remain available in accessible names, native titles, and the
Inspector. Collision indexing uses maps and path-segment passes rather than
pairwise comparisons.

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

Node and edge change callbacks are the single owner of React Flow keyboard and
marquee selection updates. `GraphCanvas` intentionally does not mirror the
aggregate `onSelectionChange` callback back into its controlled selection prop;
doing both creates a feedback loop when application navigation selects a node
while switching renderer modes.

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
renderer still has no canonical or inspection dependency. A current center
request consumes any older Fit token without running it, so rapid semantic
Back/Forward traversal cannot snap from a newer center to a stale async Fit.

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

Production code depends only on KG6 view projection, the resolved GROUP1A
presentation type, React, React Flow, and the plain root contract of
`@icarus-graph-explorer/dagre-layout`. ESLint rejects
direct Dagre, canonical/core, source adapters, diagnostics, application,
filesystem, platform, Sigma, and Graphology imports. The `./prepare` subpath
retains direct compute only for tests and diagnostic benchmarks; it is not
re-exported by the production package root.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web build
```
