# Sigma Global/Regional and Local Free Renderer

Status: **QA — atomic All/Focus camera commits and 0–150% density framing are test-backed; native acceptance remains pending.**

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
  spatial.ts               Sigma logical-axis adapter and All Network override composition.
  spatial-influence.ts     Pure soft-attractor request, fingerprint, compute, validation, metrics.
  spatial-influence-cache.ts  Four-entry memory-only LRU of dynamic positions.
  arrangement.ts           Pure thresholded prime/drag/commit/cancel gesture reducer.
  temporary-node-constraint.ts  Serializable fake-backed PHYSICS1 consumer port.
  file-move.ts             Pure File gesture reducer and frame-coalesced coordinator.
  node-size.ts             Per-File multiplier composition and final display-only bounds.
  node-size-presentation.ts  Sparse override diff and topology-owned File-to-node key index.
  graph.ts                 Graphology construction, neighborhood index, and planned reconciliation.
  anchored-refresh.ts      Pre-mutation Sigma process/render camera transaction.
  interaction-contract.ts  Operation-count oracle for camera/UI versus layout-triggering work.
  layout.ts                Worker-safe ForceAtlas2, folder-prior candidates, metrics, fingerprint.
  layout-cache.ts          Four-entry memory-only LRU of automatic derived positions.
  lifecycle.ts             WebGL construction result and idempotent session lease.
  style.ts                 Far/Regional/Near LOD and GROUP1A base-accent layer.
  global-label.ts          Viewport-aware Global label/hover placement after adaptive culling.
  precision-wheel-zoom.ts  Fine-linear/coarse-compressed wheel curve and Sigma default guard.
  session.ts               Imperative Sigma lifecycle and high-frequency interaction ownership.
  node-click.ts            Shared 300 ms single/double-click arbitration; selection stays immediate.
  viewport-request.ts      Layout-commit gate for semantic center and Fit requests.
  GlobalGraphEmptyState.tsx  Explicit zero-match state shared by Global mount decisions.
  GlobalGraphCanvas.tsx    React mount/update boundary, background layout, and Arrange panel.
  local-types.ts           Local mapper, viewport, interaction, and worker contracts.
  local-mapping.ts         Separate Local topology and deterministic root-relative seed.
  local-graph.ts           Local Graphology construction, reconciliation, and neighborhoods.
  local-style.ts           Far/normal/near Local and GROUP1A styling without topology changes.
  network-density-core.ts  Shared Sigma normalization, robust statistics, topology, and exact k-d-tree primitives.
  global-density.ts        Rootless, component-safe All Network camera-ratio policy.
  global-density-framing.ts  Transient legacy-to-density interpolation for All Network.
  local-density.ts         Pure Sigma-faithful B4 policy for accepted-layout camera Fit.
  local-convergence.ts     Canonical bounded policy, root-aligned metrics, degree guard, and caps.
  local-layout.ts          Schema-v2 Local ForceAtlas2 lifecycle, result validation, and fingerprint.
  local-layout-cache.ts    Bounded memory-only exact Local position cache.
  local-lifecycle.ts       Idempotent Local renderer mount/session lease.
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
  arrangement-session.test.ts  Exact-folder pointer ownership, sparse refresh, and commit contract.
  file-move-session.test.ts  All/Focus eligibility, arbitration, lifecycle, and fake-port contract.
  arrangement-canvas.test.tsx  Accessible nudge/save and write-failure rollback contract.
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
folder strength and the current advanced visual values. SPATIAL1 stores only
normalized folder target centers; raw node, folder, and ForceAtlas2 coordinates
never persist.

That product split is also the runtime ownership boundary. The resolved physics
subset (`folderClustering`, cohesion, reference pull, and within/between-folder
spacing) owns automatic layout requests, worker settings, and cache identity.
The resolved visual subset (base size, degree-size influence, link thickness,
and label threshold) owns Sigma reducer/settings refreshes only. The persisted
record and control ranges remain unchanged.

SPATIAL2A evolves the All Network-only position pipeline without changing the
current production authoring controls:

```text
base automatic deterministic/cache/worker positions
  → separate soft-attractor worker/cache
  → fixed-placement composition in the base frame
  → displayed Sigma positions
```

`GlobalGraphCanvas` owns base, dynamic, and displayed coordinates separately
from live Graphology state. Base worker/cache output is the only dynamic-worker
seed. The dynamic cache stores only pull output, and fixed output is never
cached upstream. A fixed-only edit reuses the exact dynamic fingerprint; pull
target, strength, scope, membership, edge, settings, or base changes request one
latest soft refinement. No pull skips the worker/cache exactly. Pull failure
falls back to base plus fixed placements with a visible warning.

Schema-v2 rules resolve most-specific membership per document. The deepest
matching root wins, so parent and child pulls/placements never add together.
The selected algorithm alternates bounded ForceAtlas2 chunks with a shared
centroid translation. Each chunk uses gain `0.55 × strength/100` and a distance
cap `0.60 × graph RMS scale × strength/100`; strength zero is inert and 100
remains soft. Continued ForceAtlas2 lets connected nonmembers react. The
move-then-relax comparison retained larger normalized target error in synthetic
evidence and remains a benchmark candidate only.

The source-neutral geometry computes the target frame from canonical document
base positions and fixed centers from current dynamic positions. Diagnostics,
display-only radii (including VISUAL1B multipliers), viewport, camera, and prior
fixed translations are excluded. Every fixed member receives one rigid
translation. Sigma 3.0.3 maps positive graph Y upward, so `spatial.ts`
centralizes a `-1` visual-down sign. Inactive exact/subtree paths remain dormant
and reactivate when matching folders become visible. Focus Network and both
Hierarchy presentations receive no spatial registry.

SPATIAL1B adds an explicit All Network Arrange mode over that existing seam.
Pressing a canonical File primes its exact folder at the current displayed
center; movement crosses a 3 px viewport threshold before a drag begins, so a
click never moves geometry. Each pointer sample recomputes from the immutable
automatic positions captured at gesture start. One animation frame applies only
the folder's visible document coordinates and incident edges. Stage drag keeps
Sigma camera pan; selection, Focus activation, context click, wheel zoom, and
node double-click are suppressed while Arrange owns node input.

Sigma 3.0.3 requires indexation for moved-node picking, labels, and incident
edge geometry. The session therefore mutates its renderer-owned Graphology x/y
fields only after validating the entire sparse set, then requests one scheduled
partial refresh with `skipIndexation: false`. This can still make Sigma's
internal processing graph-scale even though the application performs no KG6
projection, mapping, topology reconciliation, full spatial composition, or
layout per pointer frame. The browser/Tauri harness is the runtime evidence
boundary for that remaining library cost.

Release commits one normalized anchor through the web write-before-adopt
transaction. The transient preview remains visible until the confirmed map is
rendered; a write failure or mismatched authoritative map restores the last
confirmed composition. Escape cancels a primed/dragging/keyboard preview and
stays in Arrange; a second idle Escape exits. Blur, visibility loss, topology
change, layout change, mode change, and disposal cancel unfinished motion.
Keyboard users can choose the exact folder in Network Explorer, nudge by 0.02
(Shift: 0.10), save or cancel, and reset one/all positions. Root uses `.` and
nested folders never inherit a parent action.

MOVE1A adds a separate, fake-backed temporary File constraint seam to both
Network Sigma sessions without exposing a production control. One canonical
document may own a pointer sequence after the same 3 px threshold; Focus
headings, blocks, and diagnostics remain ineligible. The reducer captures the
pointer-to-node offset and winning fixed Place translation, converts every live
viewport sample through Sigma, and sends the dynamic target through a plain
begin/update/end port. Raw updates coalesce to the latest animation frame;
release flushes the latest update before one end command.

Folder arrangement and File movement are mutually exclusive. Below threshold,
selection, confirmed reveal, and document double-click keep their existing
meaning. A real drag suppresses its trailing click/double-click. Escape,
capture/stage loss, blur, visibility loss, topology/layout/scope/spatial or
workspace invalidation, service failure, mode exit, and disposal remove the
temporary constraint. The port carries stable node key, session/simulation
generation, gesture ID, monotonic sequence, simulation-space target, and end
reason only; it owns no alpha/cooling values, Graphology/Sigma instances,
worker handles, source text, or persisted coordinates. PHYSICS1 owns the future
real adapter and MOVE1B owns the visible Edit/Move mode.

VISUAL1A applies only to All Network. Ordinary document nodes add a bounded
reference-degree boost to the configured base size. At the persisted
`referenceDegreeSizeInfluence` default of `50`, the boost is exactly the prior
`min(4, log2(degree + 1) * 0.48)` curve; `0` removes it; `100` strengthens it
while capping the added size at six units. Projected edge degree continues to
count represented canonical reference occurrences. Diagnostic targets keep
their separate subordinate size formula, and Focus Network keeps its existing
root/entity-kind sizing contract.

GLOBALVIS1 makes all four Visual controls render-only. The mounted canvas maps a
topology-stable baseline once per projection. Sigma recomputes automatic node
radius from that topology's weighted degree plus current visual settings, then
applies the VISUAL1B File multiplier and the existing Group/interaction/LOD
layers. Edge reducers likewise recompute displayed thickness from reference
count without changing layout edge weight. Radius refreshes retain Sigma's
indexed processing for labels/programs/picking; thickness and label changes do
not submit ForceAtlas2 or reapply coordinates.

VISUAL1B accepts a separate resolved `EntityId` presentation-override map in
both Network canvases. The mount options and an independent effect deliver it
to each session, never to mapping, topology, seeds, requests, or fingerprints.
The node reducers multiply All's automatic `(base + degree boost)` or Focus's
existing File/root semantic size by the 0.5–2.5 scale exactly once. Custom
results are bounded to 2–24 display units; a Focus root keeps at least its
automatic 8.4 size (and root styling). No entry is exactly unchanged. Headings,
blocks, and diagnostics ignore the map. Global label LOD uses that same final
displayed size; thresholds are unchanged. Group color composes independently.
Graphology retains topology-stable size and exact coordinates. The renderer never
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
the distance between unrelated connected Files. Global automatic display sizes
also stay outside layout fingerprints; Focus semantic sizes retain their existing
layout contract. Workers, latest-wins handling, and bounded position caches are
unchanged; no new layout cache or persisted geometry exists.

The automatic layout fingerprint includes schema, algorithm, iterations, stable
node keys, reference endpoints/weights, folder assignment, and the resolved
physics subset. It excludes transported schema-v1 node size, all visual settings,
seed coordinates, labels, search, hover, selection, source text, and normalized
spatial anchors. The worker protocol still carries node size for compatibility;
current ForceAtlas2 does not consume it with `adjustSizes: false`. Surviving
coordinates warm a changed layout; an exact bounded memory-cache hit skips worker
computation and may compose with any current anchor map.

Spatial rules are excluded from the automatic fingerprint. The separate dynamic fingerprint
includes the base fingerprint and coordinates, semantic edges, resolved pull
memberships, targets/strengths, settings, and algorithm version. It excludes
fixed rules, camera, selection, labels, styles, display-only sizes, and sidebar
state.

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
this refresh. All Network's far-scale edge suppression remains unchanged;
Focus keeps references visible at every LOD and changes only detail/width.
This renderer-only refresh does not change canonical/projection data,
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
the first visible draw. A topology or position reconciliation arms its camera
transaction before the first Graphology mutation. The first resulting Sigma
`afterProcess` restores the selected node, or otherwise the Local root, before
the changed graph can draw, so no stale-normalization frame is exposed. If a
layout worker answers before that topology frame completes, coordinate adoption
waits for the anchored topology render before capturing its own anchor; the two
normalization changes cannot collapse into one stale-display-data transaction.

Hierarchy edges are stronger than references and remain visually distinct.
NETWORKPOLISH1 removes Local's far-reference hide rule without changing the
1.25 LOD threshold or 0.02–6 camera bounds. References remain visible without
hover through maximum zoom-out, with existing width factors 1 / 0.84 / 0.45
for near / normal / far. Far hierarchy width stays 0.72; root/label LOD and
hover emphasis remain intact. Native readability is a release-QA gate.
SPACING1B leaves ForceAtlas2 settings, normalization, accepted coordinates,
fingerprints, and caches unchanged, but replaces both Network renderers'
ratio-1 automatic Fit with scope-specific density-aware camera targets. The
Focus policy measures accepted positions
in a fixed 1200×800 Sigma 3.0.3 frame with 24 px padding. It takes the median of
the raw connected-edge, nearest-neighbor/node-diameter, and p90-root-radius
signals, then clamps once to `0.7–1.4`; invalid or degenerate metrics fall back
to ratio 1.

Fresh Local sessions are auto-framed after an exact cache hit or latest worker
result while retaining their transition anchor's screen point. A restored
semantic viewport, explicit center, wheel/pinch, native drag, or zoom button
makes the session camera user-owned, so later layout completion updates only
the stored Fit target. Manual Fit resets x/y/angle, applies that latest target,
and returns ownership to automatic framing. Resize never recomputes or reapplies
the policy. Automatic node sizes are the only radius input: VISUAL1B display
multipliers and Visual Groups cannot change density, camera, layout, or cache.

SPACING1B-QA adds a transient 0–150% camera-policy strength. The effective ratio
is `1 + (densityDecision - 1) * strength / 100`, so 0% reproduces the legacy
ratio-1 Fit and 100% preserves SPACING1B. Values from 101–150% are explicitly
Sandbox-only amplification of the correction away from ratio 1, not production
automatic behavior. Changing strength always previews the new ratio around the
current selected-node/root screen anchor, even when the camera was already
user-owned, and makes the resulting camera user-owned.
Later topology or layout completion therefore cannot override the preview;
Fit recenters with the selected strength and returns to automatic ownership.
The value never enters ForceAtlas2
requests, accepted positions, fingerprints, caches, projection, or persistence.
Temporary SPACING1B native-QA diagnostics publish the latest raw decision ratio,
interpolated effective ratio, actual Sigma camera ratio, and fallback evidence
through a deduplicated session callback. The callback is display-only runtime
state and cannot alter density, camera, topology, layout, cache, or persistence.

All Network uses a separate rootless policy over the confirmed final displayed
positions after automatic ForceAtlas2, optional dynamic Pull, and fixed-folder
composition. Sigma's installed normalization maps those positions into the
same 1200×800 frame before measurement. The primary nearest-neighbor signal
works for zero-edge and multi-component scenes; connected-edge distance is
optional; a p95 robust-radius signal and 95% useful-viewport floor guard
outlying components. Their robust combination is clamped once to `0.7–1.4`.
A balanced deterministic k-d tree avoids the bounded Focus policy's quadratic
nearest-neighbor scan at Global scale. Empty, single-node, invalid, duplicate,
or incomplete geometry falls back explicitly to ratio 1; independent graphs
with two or more valid nodes produce a real decision.

Fresh All Network sessions without a restored semantic viewport are
auto-owned. Confirmed displayed geometry may refresh their camera target, while
wheel/pinch, pan, zoom buttons, centering, arrangement interaction, restored
viewports, and density-slider previews make the camera user-owned. Worker,
query, topology, Pull, and fixed-position adoption then preserve the visual
anchor and camera ratio. Live arrangement preview changes only displayed
positions; confirmation updates the stored density decision without reframing.
All Fit recenters, resets the angle, applies the current effective All ratio,
and returns ownership to automatic. All and Focus have independent transient
0–150% strengths, both defaulting to 100%; neither enters layout input, cache,
fingerprint, presentation override, query, workspace state, or persistence.
Confirmed topology and coordinate changes use Graphology-triggered Sigma
refresh as the single authoritative process request. Their matching
`afterProcess` and `afterRender` callbacks are armed before mutation. Global
query anchoring prefers a surviving selected node, then an explicit
semantic/history anchor, then the nearest viewport-center survivor with stable
key tie-breaking. A fully replaced or empty scene is centered deterministically
without inventing a relationship to a removed node.
Sparse Focus spacing, normalization, and ForceAtlas2 settings
are intentionally unchanged. CONVERGENCE1B replaces the old one-shot budget
with `local-fa2-convergence-v1`: one Graphology graph receives public
ForceAtlas2 calls in 32-iteration batches until three consecutive full batches
have root-aligned normalized all-node p90 at or below `0.00512` and any
degree-0/1 maximum at or below `0.01024`, or the node-class cap is reached.
Caps are 1,000 iterations through 100 nodes, 600 through 500, and 240 above 500. The previous frame's RMS radius about the root, floored at `1e-6`, is the
scale. A 2,000 ms limit is checked only between completed batches; exceeding it
is a schema-v2 `max-wall-time` failure with no accepted positions or cache
write. The clock and observed timing are not geometry identity.

Local has no folder prior or fake edges. Exact cache fingerprints use the
`local-layout-v2` prefix and include the complete deterministic convergence
policy and computed cap alongside the root, stable topology, semantic node/edge
roles, weights, and Local settings. They exclude seed coordinates, timeout,
compute diagnostics, labels, hover, selection, camera, and source text. Exact
hits restore settled coordinates with no worker request. Explicit Rearrange
evicts the exact entry and warm-starts the full lifecycle from current automatic
coordinates; topology updates retain surviving coordinates and seed only new
nodes. Ordinary zoom/pan/hover/selection changes reducer or camera state only;
it never maps, reconciles, or lays out topology.

This convergence is a finite replacement-worker computation that adopts one
final result. It does not stream batches, maintain a persistent simulation, or
claim mathematical equilibrium. PHYSICS1 still owns any future continuous
interactive lifecycle, reheating/cooling, and real temporary-constraint
adapter.

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
type, the source-neutral presentation-overrides and spatial-overrides contracts,
React/React DOM,
Sigma, Graphology, and Graphology ForceAtlas2. ESLint
rejects canonical, source, platform,
application, analytics/performance, React Flow, Dagre, and Node imports. React
Sigma is not used.

```bash
pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma
pnpm --filter @icarus-graph-explorer/web build
```
