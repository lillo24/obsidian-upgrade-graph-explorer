# Sigma Global/Regional and Local Free Renderer

Status: **QA — authoritative All/Focus startup presentation, atomic camera commits, and 0–150% density framing are test-backed.**

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
  temporary-node-constraint.ts  Serializable PHYSICS1 consumer port and strict test fake.
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
  raw-viewport-frame.ts    Raw graph-space center/scale diagnostics and bounded repair primitive.
  network-camera-intent.ts One-shot initial framing versus camera-neutral position-adoption policy.
  network-position-frame.ts Validates the stable presented-position normalization extent.
  NetworkViewportControls.tsx  Shared Sigma icon chrome for Zoom, Fit all, and app-owned maximize/restore.
  precision-wheel-zoom.ts  Zoom curve, two-axis wheel-unit normalization, and Sigma default guard.
  session.ts               Imperative Sigma lifecycle and high-frequency interaction ownership.
  node-click.ts            Shared 300 ms single/double-click arbitration; selection stays immediate.
  viewport-request.ts      Layout-commit gate for semantic center and Fit requests.
  GlobalGraphEmptyState.tsx  Explicit zero-match state shared by Global mount decisions.
  GlobalGraphCanvas.tsx    React mount/update boundary, background layout, and Arrange panel.
  local-types.ts           Local mapper, viewport, interaction, and worker contracts.
  local-mapping.ts         Separate Local topology and deterministic root-relative seed.
  local-graph.ts           Local Graphology construction, reconciliation, and neighborhoods.
  local-style.ts           Far/normal/near Local and GROUP1A styling without topology changes.
  local-network-settings.ts  Shared Network-to-Local physics and display-only adapters.
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
  LocalGraphCanvas.tsx     Internal seed mount, accepted-layout presentation commit, and reveal boundary.
  deterministic.ts        Shared stable hash/unit primitives; no random geometry.
  styles.css               Canvas controls, progress/error surface, and reduced-motion rules.
  core.ts                  DOM-free mapping/layout/settings exports for tests and benchmarks.
  index.ts                 Browser-capable public API.
  canvas-test-harness.ts    Test-only hook/effect driver for the real canvas dependency paths.
  sigma-test-renderer.ts    Test-only reducer cache and process-boundary Sigma double.
  initial-presentation-session.test.ts  Final-frame, containment, and immediate-Fit idempotence oracle.
  size-canvas-regression.test.tsx  Real canvas/session layout-count and exact-coordinate regression.
  network-wheel-pan-session.test.ts  Extent/rotation/delta-mode invariant Network pan regression.
  arrangement-session.test.ts  Exact-folder pointer ownership, sparse refresh, and commit contract.
  file-move-session.test.ts  All/Focus eligibility, arbitration, lifecycle, and fake-port contract.
  arrangement-canvas.test.tsx  Accessible nudge/save and write-failure rollback contract.
  spatial-rule-canvas.test.tsx Pull/Place adoption, cache reuse, and zero-auto-layout regression.
  raw-viewport-frame.test.ts Sigma-transform camera preservation and ownership regression.
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

The initial Network surface is a presentation transaction rather than a first
Sigma paint. Seed/base coordinates may warm the worker and renderer internally,
but Global waits for the current layout plus Pull/Place composition and Local
waits for its accepted layout. The session then replaces any provisional
`customBBox`, applies Fit All when its startup camera intent is still current,
waits for that render, and reveals the surface. Subsequent geometry adoption is
unchanged and camera-neutral. If user input supersedes startup Fit, raw viewport
framing is preserved while the final normalization extent is still installed.
An optional startup trace callback samples the shell rects, Sigma dimensions,
camera, normalization extents, representative raw/screen node positions, and
LOD through 500 ms after reveal. It is absent from ordinary sessions and exists
only to let the web/native QA boundary prove that the one-shot transaction stays
stable after it becomes visible.

Network Fit and density framing are intentionally different camera actions. Fit
rebases the current all-node extent and uses Sigma's ratio `1`; the shared 24 px
stage padding covers the maximum 24 px Network node radius, while labels remain
opportunistic. The density sliders retain their explicit anchor-preserving ratio
preview and may omit peripheral nodes. Parent-issued Center/Fit commands are
consumed once, and Global waits for the exact current layout plus Pull/Place
generation before applying either. A queued fresh-source Fit yields to newer
manual camera ownership. When an initial semantic viewport already applies the
same anchor and ratio as a pending Center request, the canvas consumes that
one-shot request instead of replaying it after reveal. Two-finger pan converts
wheel units to CSS pixels and
uses only framed coordinates, so raw graph scale cannot amplify the gesture.
The All and Focus canvases share renderer-local icon-only Zoom, Fit, and
maximize/restore chrome; maximize state remains owned by the app shell and does
not relayout or fit. Arrange Folders is rendered in a separate tool cluster.

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

`GlobalLayoutSettings` remains the plain JSON-compatible persisted record, but
NETWORKSETTINGS1 resolves a smaller product-level Network subset from it:
Reference Pull, Base node size, Link thickness, and Label threshold. The same
subset reaches All and Focus Network; neither Hierarchy renderer observes it.
Reference Pull adapts to Global `edgeWeightInfluence`, while Local keeps
`edgeWeightInfluence = 1`, keeps hierarchy weight at 6, and changes only its
reference-edge multiplier. Folder clustering, Strength, spacing, folder
separation, and link influence on node size remain All-only. Changing a spacing
preset adopts only its All spatial baseline and preserves folder strength plus
all four shared Network choices. Settings are preferences, not canonical truth.
SPATIAL1 stores only normalized folder target centers; raw node, folder, and
ForceAtlas2 coordinates never persist.

That product split is also the runtime ownership boundary. The resolved physics
subset (`folderClustering`, cohesion, reference pull, and within/between-folder
spacing) owns automatic layout requests, worker settings, and cache identity.
The Global visual subset and the shared Network visual subset own Sigma
reducer/settings refreshes only. Global keeps its degree-size influence; Focus
adapts the shared base size and thickness into display-time scales over its
established semantic sizes and widths, and adapts the threshold so the shared
default reproduces Local's exact threshold of 4. The persisted record, ranges,
and v1 storage contract remain unchanged.

SPATIAL2A evolves the All Network-only position pipeline, and SPATIAL2B exposes
its complete rule model through the production authoring controls:

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

SPATIAL2B turns that mode into one rule editor. An unruled folder opens a
transient Pull/exact/70 draft at its current displayed center; existing rules
load byte-for-byte semantics. Behavior, strength, preset, root-file inclusion,
and exclusions remain draft-only until **Apply changes** or target release.
The editor's bounded DOM tree uses the full canonical folder model supplied by
the app, while Choose-mode graph clicks are a shortcut that toggles a subtree or
the complete direct-root group. Child-rule-owned members receive a distinct
style and hand off to their own editor instead of mutating the parent draft.

Draft scope classification replaces only the same-root confirmed rule and then
reuses deepest-wins resolution. Included, excluded, child-owned, and unrelated
nodes compose after Visual Group color and exact per-File size; internal,
boundary, child-owned, and unrelated edges remain distinguishable. A short
highlight pulse changes no size and is disabled by reduced-motion preference.
The spatial target marker owns explicit pointer capture while dragged. Only that
capture suppresses stage pan; stage drag and wheel/trackpad zoom remain available
otherwise.

Pull pointer and keyboard editing updates only the draft anchor, marker, and
target text. It never calls rigid preview geometry or mutates a graph-node x/y.
Release persists the complete rule, then the existing SPATIAL2A latest
worker/cache path settles authoritative geometry. Place marker drag, or dragging
one effective selected File, retains the sparse rigid preview and exact
post-dynamic composition. A Place-only edit with unchanged Pull resolution uses
zero dynamic workers; no rule edit enters the automatic layout fingerprint.
The SPATIAL2A worker still performs its existing whole-graph ForceAtlas2
refinement, so disconnected geometry movement is layout evidence rather than a
camera fit. SPATIAL2B does not introduce a competing simulation lifecycle;
PHYSICS1 owns runtime reheating, convergence, and reaction policy, including
reactive neighbors around hard Place constraints.

MOVE1A adds a separate temporary File constraint seam to both Network Sigma
sessions, and MOVE1B connects it directly to the real PHYSICS1 service whenever
a supported Network is ready and Arrange Folders does not own input. One
canonical document may own a pointer sequence after the same 3 px threshold; Focus
headings, blocks, and diagnostics remain ineligible. The reducer captures the
pointer-to-node offset and winning fixed Place translation, converts every live
viewport sample through Sigma, and sends the dynamic target through a plain
begin/update/end port. Raw updates coalesce to the latest animation frame;
release flushes the latest update before one end command.

Folder arrangement and File movement are mutually exclusive; no global File
editing mode exists. Below threshold,
selection, confirmed reveal, and document double-click keep their existing
meaning. A real drag suppresses its trailing click/double-click. Escape,
capture/stage loss, blur, visibility loss, topology/layout/scope/spatial or
workspace invalidation, service failure, mode exit, and disposal remove the
temporary constraint. The port carries stable node key, session/simulation
generation, gesture ID, monotonic sequence, simulation-space target, and end
reason only; it owns no alpha/cooling values, Graphology/Sigma instances,
worker handles, source text, or persisted coordinates. The same session exposes
a coarse keyboard controller: it primes a visible File at its current viewport
point, sends 8/32 px nudges through the identical coordinator, and releases into
cooling. The canvases report only capability and lifecycle transitions to React;
whole-graph frames remain imperative and camera-neutral. Raw Worker coordinates
remain the authoritative seed while the browser may present a bounded,
time-based release catch-up; eased coordinates never enter finite-layout,
dynamic-Pull, or physics caches. Physics failure clears the gesture, retains the
last valid graph, and leaves explicit retry to the app.

VISUAL1A's reference-degree boost applies only to All Network. Ordinary document nodes add a bounded
reference-degree boost to the configured base size. At the persisted
`referenceDegreeSizeInfluence` default of `50`, the boost is exactly the prior
`min(4, log2(degree + 1) * 0.48)` curve; `0` removes it; `100` strengthens it
while capping the added size at six units. Projected edge degree continues to
count represented canonical reference occurrences. Diagnostic targets keep
their separate subordinate size formula. Focus Network keeps its
root/entity-kind proportions, but NETWORKSETTINGS1 multiplies those display
radii by the shared Base node size scale.

GLOBALVIS1 makes all four Visual controls render-only. The mounted canvas maps a
topology-stable baseline once per projection. Sigma recomputes automatic node
radius from that topology's weighted degree plus current visual settings, then
applies the VISUAL1B File multiplier and the existing Group/interaction/LOD
layers. Edge reducers likewise recompute displayed thickness from reference
count without changing layout edge weight. Radius refreshes retain Sigma's
indexed processing for labels/programs/picking; thickness and label changes do
not submit ForceAtlas2 or reapply coordinates.

VISUAL1C makes that boundary structural. The finite All layout worker's
schema-v3 request carries only folder clustering, folder cohesion, reference
link force, within-folder spacing, and between-folder spacing. Worker nodes no
longer carry display radius; ForceAtlas2 continues to run with
`adjustSizes: false`. Node size, reference-degree size influence, link
thickness, and label threshold stay in Sigma reducers. Rapid Visual updates are
coalesced into one presentation refresh on the next animation frame without
projection, mapping, reconciliation, worker, cache, coordinate, or camera work.

NETWORKSETTINGS1 extends Base node size, Link thickness, and Label threshold to
Focus without moving those values into Local topology or layout. Base size
scales the automatic root/document/section/block/diagnostic radii before the
existing per-File multiplier; the root floor and Visual Group color then compose
as before. Thickness scales reducer output before existing 1 / 0.84 / 0.45 LOD
factors. Label threshold updates Sigma eligibility only, so Local semantic LOD
may still suppress a label and the shared control cannot reveal it. These three
changes issue zero Global/Local layout requests and do not change fingerprints,
caches, Graphology coordinates, or ForceAtlas2 work.

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

Authoritative spatial-rule adoption (Dynamic Pull, Fixed Placement, dynamic
cache hits, removal, and reset) preserves the raw graph point under the viewport
center, raw graph units per pixel, and camera angle. After the first accepted
presentation, the session keeps Sigma's normalization extent stable while later
coordinates change, so the same framed camera x/y/ratio continues to represent
the same raw viewport without a bounded-ratio repair. Spatial intent is still
determined by the transaction cause, not only by the new registry contents:
removing the final rule remains a spatial adoption even when both `folderRules`
and the compatibility anchor map become empty. The stable preview-cancel
callback cannot retrigger automatic cache adoption when a rule changes, so
Apply, Remove, and Reset each produce one authoritative position application
after the initial layout has settled.

Merged PR #60 / FLICKER1 remains the sole atomic Network graph-mutation
transaction. `applySpatialPositions` uses its shared pre-mutation boundary and
Graphology owns the single resulting process/render; spatial adoption adds no
refresh fallback or nested camera owner. `raw-viewport-frame.ts` remains the
diagnostic/bounded-repair primitive for tests and any topology policy that
cannot retain a meaningful presented extent.

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
cannot be centered and then replaced out from under the camera. Source-load Fit
also waits for the first authoritative spatial-rule composition, including a
Dynamic Pull result or fallback, so the camera encloses the geometry the user
actually sees. Once consumed, that semantic request is not replayed by later
live refinements; ordinary user pan and zoom therefore remain intact.

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

Fresh Local sessions are auto-framed once from an exact cache hit or the first
latest worker result while retaining their transition anchor's screen point. A restored
semantic viewport, explicit center, wheel/pinch, native drag, or zoom button
makes that initial grant ineligible. Every later accepted layout measures and
stores the latest density target but preserves raw center, scale, and angle.
Manual Fit resets x/y/angle and applies that latest target; it does not grant
the next geometry result permission to reframe. Resize never recomputes or reapplies
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

Fresh All Network sessions without a restored semantic viewport receive one
initial automatic-framing grant. That first accepted presentation also fixes
Sigma's presented normalization extent. After that boundary, ordinary worker,
Re-layout, query, Pull, fixed-position, removal, reset, and cache-hit coordinate
adoption measures the latest density evidence while leaving both the extent and
camera x/y/ratio/angle unchanged. Explicit Fit rebases the presented extent to
the latest graph bounds, recenters, resets the angle, and applies the current
effective All ratio, but does not authorize a later geometry result to reframe.
All and Focus have independent transient
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

All Network uses the separate `global-fa2-folder-convergence-v1` schema-v3
policy. `global-convergence.ts` owns centroid-aligned movement, the low-degree
and centroid-drift guards, three-step stability, 32-iteration batches, the
640/120/80 caps, and 5 s safety boundary. `global-folder-macro.ts` owns the
duration-independent `global-folder-fixed-field-v1` output adapter. It applies
one current-prior-equivalent transform to snapshots only and never feeds folder
coordinates back into the reused FA2 graph. `layout.ts` owns strict request,
result, failure, rounding, metric, and `global-layout-v3` fingerprint contracts.

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
