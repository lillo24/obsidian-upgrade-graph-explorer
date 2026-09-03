# Sigma Global/Regional and Local Free Renderer

Status: **STABLE — KG13B1 Global and KG13B2A Local Free contracts are test-backed.**

This package owns the lazy, direct Sigma 3 renderers for file-level
Global/Regional exploration and bounded Local Free exploration. Both consume a
completed KG6 `ViewProjection` and derive replaceable Graphology state, but
their mapping and layout contracts remain explicit: Global owns the soft folder
prior; Local owns hierarchy/reference force semantics and has no folder
clustering. Neither owns canonical entities, KG6 projection policy, search,
inspection, source acquisition, Tauri, React Flow, Dagre, analytics, or saved
coordinates.

```text
documents-only KG6 projection
  → mapping.ts       stable renderer keys + workspace-relative folder metadata
  → graph.ts         derived Graphology graph + in-place reconciliation
  → session.ts       direct Sigma lifecycle, reducers, camera, precision input
  → layout.ts        serializable request → ForceAtlas2 + optional soft prior
  → application Worker → latest result → memory-only position cache

bounded Local KG6 projection
  → local-mapping.ts   File/Heading/Block/diagnostic topology + stable seed
  → local-graph.ts     Local Graphology construction + survivor reconciliation
  → local-session.ts   Local Sigma lifecycle, LOD, selection, semantic viewport
  → local-layout.ts    separate hierarchy/reference ForceAtlas2 protocol
  → Local Worker → latest result → bounded memory-only position cache
```

## File map

```text
src/
  types.ts                 Serializable settings, worker, renderer, and viewport contracts.
  settings.ts              Compact/Normal/Spacious presets and bounded Custom validation.
  mapping.ts               KG6-to-Sigma mapping, deterministic seeds, and folder keys.
  node-size.ts             Per-File multiplier composition and final display-only bounds.
  node-size-presentation.ts  Sparse override diff and topology-owned File-to-node key index.
  graph.ts                 Graphology construction, neighborhood index, and reconciliation.
  interaction-contract.ts  Operation-count oracle for camera/UI versus layout-triggering work.
  layout.ts                Worker-safe ForceAtlas2, folder-prior candidates, metrics, fingerprint.
  layout-cache.ts          Four-entry memory-only LRU of derived positions.
  lifecycle.ts             WebGL construction result and idempotent session lease.
  style.ts                 Far/Regional/Near LOD and GROUP1A base-accent layer.
  global-label.ts          Viewport-aware Global label/hover placement after adaptive culling.
  precision-wheel-zoom.ts  Fine-linear/coarse-compressed wheel curve and Sigma default guard.
  session.ts               Imperative Sigma lifecycle and high-frequency interaction ownership.
  node-click.ts            Shared 300 ms single/double-click arbitration; selection stays immediate.
  viewport-request.ts      Layout-commit gate for semantic center and Fit requests.
  GlobalGraphEmptyState.tsx  Explicit zero-match state shared by Global mount decisions.
  GlobalGraphCanvas.tsx    Thin React mount/update boundary and background-layout adoption.
  local-types.ts           Local mapper, viewport, interaction, and worker contracts.
  local-mapping.ts         Separate Local topology and deterministic root-relative seed.
  local-graph.ts           Local Graphology construction, reconciliation, and neighborhoods.
  local-style.ts           Far/normal/near Local and GROUP1A styling without topology changes.
  local-layout.ts          DOM-free Local ForceAtlas2 request/result and fingerprint.
  local-layout-cache.ts    Bounded memory-only exact Local position cache.
  local-lifecycle.ts       Idempotent lease and pre-draw anchored refresh boundary.
  local-session.ts         Local Sigma ownership, precision input, anchors, and viewport.
  local-interaction-contract.ts  Local operation-count oracle and Global-isolation proof.
  LocalGraphCanvas.tsx     Immediate seed mount and latest worker refinement boundary.
  deterministic.ts        Shared stable hash/unit primitives; no random geometry.
  styles.css               Canvas controls, progress/error surface, and reduced-motion rules.
  core.ts                  DOM-free mapping/layout/settings exports for tests and benchmarks.
  index.ts                 Browser-capable public API.
  canvas-test-harness.ts    Test-only hook/effect driver for the real canvas dependency paths.
  sigma-test-renderer.ts    Test-only reducer cache and process-boundary Sigma double.
  size-canvas-regression.test.tsx  Real canvas/session layout-count and exact-coordinate regression.
  node-size-session.test.ts  Initial display, sparse indexed refresh, and topology-race contracts.
  *.test.ts                Mapping, layout, cache, LOD, settings, and precision contracts.
```

## Projection and spatial contracts

Both Network sessions emit confirmed single-click intent separately from immediate
selection. The shared 300 ms constant also configures Sigma's double-click window.
Node double-click cancels reveal, suppresses Sigma's default zoom, and invokes the
existing application Focus action once (diagnostics do not activate). Projection
updates, controlled selection changes, stage clicks, and session disposal cancel
pending reveals. The renderer never scrolls sidebar DOM.

Network layout progress remains visible while preparing/refining; success clears
the status, while layout failure retains the error and last-position recovery text.

Global is documents-first. A section or block at this boundary is an error;
headings never enter Global layout. Reference edges remain the only semantic
edges. A document's normalized workspace-relative source path supplies a
layout-only `folderKey`: a root file uses `.`, and `folder/A.md` uses `folder`.
No folder node or folder-derived edge is invented.

Reference attraction and folder tendency are independent. Folder clustering
Off selects the reference-only baseline. On selects the evaluated Option A:
short ForceAtlas2 chunks alternate with a small deterministic folder-prior
adjustment. Compared with the one-shot offset-field Option B, the small
production evidence reduced within-folder distance while keeping cross-folder
reference length materially closer to the reference-only result. The prior is
soft: strong cross-folder references still affect geometry and no rigid boxes
or cluster topology exist.

PRE-KG14A4 keeps this prior exclusive to All Network and exposes its existing
`folderCohesion` value as **Folder clustering strength** on a normalized 0–100%
scale. No second persisted strength field exists. The compact/normal/spacious
cohesion baselines are now `0.09` / `0.08` / `0.07` (previously `0.055` /
`0.045` / `0.035`) so default grouping is noticeable while reference edges
remain part of every ForceAtlas2 pass. Strength survives spacing changes and
Folder clustering Off; Advanced visibility is transient UI state.

`GlobalLayoutSettings` is plain JSON-compatible presentation state. Presets
cover ordinary use; the direct Strength slider owns folder cohesion, while
Advanced separates spatial controls (reference pull and folder separation)
from visual controls (base node size, link influence on node size, link
thickness, and label threshold). Settings are user preferences, not canonical
truth. Changing a spacing preset adopts its spatial baseline while preserving
folder strength and the current advanced visual values. Manual folder dragging
and persistent node, folder, or ForceAtlas2 coordinates are intentionally
absent.

VISUAL1A applies only to All Network. Ordinary document nodes add a bounded
reference-degree boost to the configured base size. At the persisted
`referenceDegreeSizeInfluence` default of `50`, the boost is exactly the prior
`min(4, log2(degree + 1) * 0.48)` curve; `0` removes it; `100` strengthens it
while capping the added size at six units. Projected edge degree continues to
count represented canonical reference occurrences. Diagnostic targets keep
their separate subordinate size formula, and Focus Network keeps its existing
root/entity-kind sizing contract.

Node size participates in ForceAtlas2 input and layout fingerprints, so a
change to base size or link influence intentionally remaps attributes and
requests layout without asking KG6 for a new projection. The existing settings
update boundary also remaps the other advanced presentation values; optimizing
those independent refresh paths remains outside this narrow settings change.

VISUAL1B accepts a separate resolved `EntityId` presentation-override map in
both Network canvases. The mount options and an independent effect deliver it
to each session, never to mapping, topology, seeds, requests, or fingerprints.
The node reducers multiply All's automatic `(base + degree boost)` or Focus's
existing File/root semantic size by the 0.5–2.5 scale exactly once. Custom
results are bounded to 2–24 display units; a Focus root keeps at least its
automatic 8.4 size (and root styling). No entry is exactly unchanged. Headings,
blocks, and diagnostics ignore the map. Global label LOD uses that same final
displayed size; thresholds are unchanged. Group color composes independently.
Graphology retains automatic size and exact coordinates. The renderer never
loads storage or changes projection/query membership.

`setPresentationOverrides()` diffs the sparse maps and resolves changed File
IDs through a session index rebuilt only on topology updates. Only affected
visible node reducers are refreshed. Sigma **3.0.3** requires
`skipIndexation: false` for radius changes: its next process pass rebuilds
label/program/picking indices, not spatial layout. This Sigma indexing may scan
the graph; the application does not remap or scan all nodes per slider tick.
Color-only group changes retain `skipIndexation: true`. If topology is awaiting
Sigma processing, both style updates coalesce behind its existing after-render
boundary and removed keys are excluded from the partial refresh. Initial
overrides are installed before the first draw.

The flicker correction removes accidental layout-cache invalidation, not
physical radius coupling: resolved ForceAtlas2 **0.10.1** defaults to
`adjustSizes: false`, and neither Global nor Local enables it. Per-File display
changes must submit zero layouts and preserve exact x/y coordinates, including
the distance between unrelated connected Files. Normal automatic sizes still
participate in layout fingerprints. Workers, latest-wins handling, and bounded
position caches are unchanged; no new layout cache or persisted geometry exists.

The layout fingerprint includes schema, algorithm, iterations, stable node
keys/sizes, reference endpoints/weights, folder assignment, and validated
settings. It excludes seed coordinates, labels, search, hover, selection, and
source text. Surviving coordinates warm a changed layout; an exact cache hit
skips worker computation. The cache is bounded and memory-only.

## Regional semantic zoom and lifecycle

Sigma camera ratio resolves to `far`, `regional`, or `near`. Camera movement
changes reducer styling and may schedule a Sigma render; it never asks KG6 to
project, rebuilds Graphology topology, or requests layout. Hover and selection
use the same reducer boundary. Style resolution is centralized so a future
GROUP1 layer can contribute color, marker, or label treatment before the final
interaction pass. GROUP1A now supplies that layer as an optional resolved
`EntityId` presentation map: document base color may use the group accent,
then LOD label policy, hover, selection, and deemphasis remain final. Diagnostic
status colors are excluded. `setVisualGroupStyles()` retains the map and
schedules one partial node reducer refresh without Graphology reconciliation,
index rebuilding, coordinate or size changes, folder/degree changes,
fingerprint changes, or a Global worker request.

Crossing a camera LOD boundary refreshes Sigma's reducer caches (including edge
visibility and its label/program indices), not merely its draw pass. Otherwise
zoom styling stays stale until a later Hide or query update and can make
unrelated edges appear to disappear together. Both Network sessions initialize
LOD after restoring the initial camera; within-band zoom and pan do not trigger
this refresh. The existing far-scale edge suppression thresholds are unchanged,
and zooming back in restores reference lines without needing a query/layout
change. This renderer-only refresh does not change canonical/projection data,
Graphology topology, positions, or the worker layout fingerprint.

Networks with 1–12 visible nodes force their document labels through Sigma's
ordinary density culling so filtered and synthetic results remain legible at
the default camera ratio. Larger graphs retain the existing semantic-zoom label
policy. A zero-node projection overlays the same explicit
`No nodes match this view.` outcome used by Hierarchy. The existing Global
session remains mounted across nonempty/empty query changes so desktop WebView
transitions reconcile topology in place instead of tearing down and recreating
WebGL. Exact memory-cache restoration is silent; persistent canvas status is
reserved for pending layout work and failures.

All and Focus Network share one precision-wheel contract. Browser line units
still normalize to 16 px. Pixel-mode input remains exact—including magnitudes
below 0.5 px—through the 8 px precision range, then follows a smooth exponential
compression toward 34 px; with the unchanged `0.0017` gain, a single coarse
event cannot exceed roughly a 6% ratio change. Fine ordinary-wheel input uses a
slightly faster `0.0021` gain, while fine Ctrl+wheel input—the browser contract
for precision-touchpad pinch—uses `0.012`. Pinch therefore travels farther
without changing mouse-notch magnitude or relying on device/OS detection. The
90 ms reversal-tail guard is restricted to coarse events, while fine
high-frequency events and intentional fine reversals are applied immediately.

Both sessions explicitly set Sigma's wheel prevention flag after calling its
public prevention function. Sigma 3.0.3 constructs that function before
spreading the wheel coordinates, so the function alone updates a different
object and otherwise leaves Sigma's animated 1.7x default zoom competing with
the direct camera update. Ctrl/pinch ownership, pointer-anchored Sigma camera
transform, `0.02`–`6` camera bounds, and 120 ms semantic viewport observation
remain unchanged. Wheel handling stays inside the imperative sessions and
performs no React state, projection, Graphology, layout, or workspace work.

Sigma 3.0.3's default label and highlight drawing always extends to the right.
Global replaces only that canvas drawing boundary: adaptive culling still
chooses ordinary labels, while forced hover/selection labels can flip or clamp
inside the current viewport. Hover and controlled selection also refresh only
the previous/current node reducers, so their label and emphasis state changes
without topology, layout, or coordinate work.

Sigma 3.0.3 also applies camera zoom after a node double-click unless the
renderer event prevents its default. Global consumes every node double-click at
that event seam, invokes the application-neutral activation callback only for a
canonical document node, and leaves diagnostic nodes inert. The web boundary
maps document activation to the shared Focus/history/transition-anchor
pipeline; Sigma never learns presentation modes or Focus navigation policy.

Stable projected IDs are Graphology keys. Live/filter changes reconcile nodes
and edges in place, preserve surviving positions and selection, seed additions
deterministically, and leave the current camera intact while a latest-only
worker relaxation runs. Folder moves update `folderKey` without changing the
canonical identity or synthesizing relationships.

An entry/search center or Fit request waits until Sigma has rendered its
matching background-layout coordinates, so seed or stale display coordinates
cannot be centered and then replaced out from under the camera. Once consumed,
that semantic request is not replayed by later live refinements; ordinary user
pan and zoom therefore remain intact.

The WebGL canvas is visual-only and `aria-hidden`. Product search, Inspector,
and Structure remain the accessible semantic surfaces. Sigma construction or
lazy-module failure must be reported to the application, which keeps Structure
usable for the session. Layout failure keeps the last valid positions visible
and reports an explicit error.

## Focus Network contract (internal Local Free)

Focus Network maps files, headings, blocks, and diagnostic targets without
weakening All Network's documents-only invariant. The root seed and every
refined result are
normalized to graph origin. A transient Global viewport point may place that
root on entry; refinement captures and restores the root's screen position.
Missing capture falls back to semantic centering. Exact cached positions and
the saved semantic viewport are installed during the imperative mount, before
the first visible draw. A topology or position reconciliation restores the
selected node, or otherwise the Local root, during Sigma's `afterProcess`
phase so the renderer cannot expose one frame with new normalization and an
old camera.

Hierarchy edges are stronger than references and remain visually distinct.
Local has no folder prior or fake edges. Exact cache fingerprints include the
root, stable topology, semantic node/edge roles, weights, iterations, and Local
settings while excluding seed coordinates, labels, hover, selection, camera,
and source text. Ordinary zoom/pan/hover/selection changes reducer or camera
state only; it never maps, reconciles, or lays out topology.

The same GROUP1A map feeds Local Free. File, Heading, and Block base fills may
use the accent; diagnostic colors and all edges remain unchanged. Root/LOD,
hover, selection, and deemphasis stay authoritative. A style-map update uses
the Local session's style-only setter and cannot reproject, reconcile topology,
change positions, request Local ForceAtlas2, or touch Global layout. GROUP1B
user-facing configuration is pending. When projection and style-map updates
arrive in the same commit, the style-only repaint is queued behind Sigma's
topology process/render boundary so it cannot target node indices that do not
exist yet. The Global session uses the same boundary when an All Network query
changes files-only membership alongside a style-map update.

Local hop and direction changes preserve the current camera rather than
requesting Fit. Their topology may naturally change around the anchored node,
but the application does not move away and then recenter. Cross-mode entry
anchors and explicit Fit requests are one-shot intents: the canvas reports
them consumed after mount so a later Local remount or graph-history traversal
cannot replay stale camera work.

KG13B2B keeps this package as the internal Free owner while React Flow owns the
internal Structured presentation. Product controls call these Focus Network
and Focus Hierarchy.
The Local canvas now exposes a narrow runtime `nodeViewportPoint` query and can
mount an arbitrary projected node at a supplied screen point. That is the only
cross-renderer seam: no Sigma instance, normalized graph coordinate, camera,
or position cache crosses into application or persisted state. The query
recomputes Sigma's framed-to-viewport transform from the live camera and graph
dimensions because topology anchoring can make the renderer's cached matrix
one frame older than the pixels already drawn. Free viewport
observations continue to update `freeRatio` while the application preserves
the sibling `structuredZoom` bookmark. Future manual cluster offsets, Saved
Views, QUERY1 evolution, and GROUP1 remain separate product layers.

## Dependency boundary and validation

Production depends only on view-projection, the resolved GROUP1A presentation
type, the source-neutral presentation-overrides contract, React/React DOM,
Sigma, Graphology, and Graphology ForceAtlas2. ESLint
rejects canonical, source, platform,
application, analytics/performance, React Flow, Dagre, and Node imports. React
Sigma is not used.

```bash
pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma
pnpm --filter @icarus-graph-explorer/web build
```
