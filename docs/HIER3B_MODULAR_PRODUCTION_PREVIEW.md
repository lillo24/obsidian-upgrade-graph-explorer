# HIER3B Modular Production Preview

## Status

Complete. Automated, production-browser, optimized desktop, and user graphical
validation pass. Classic Focus Hierarchy remains the default. HIER3C is next
and has not started.

## Product exposure

`Settings → Sandbox → Experimental → Focus Hierarchy implementation` selects
either **Classic** or **Modular preview**. The setting is an additive field in
`icarus.graph-explorer.preferences.v1`; missing and malformed values resolve to
Classic. Reset Sandbox restores Classic. `Show All Hierarchy` remains a
separate exposure control.

Switching implementations changes presentation only. It creates no graph
history checkpoint and keeps the Focus root, direction, hops, hierarchy depth,
query, filters, disclosure, and representable selection. The mounted renderer
captures the selected visible entity or root with `GraphTransitionAnchor`, and
the replacement waits for that exact rendered card before applying its
structured zoom and screen point. Initial React Flow fitting remains suppressed
for that mount after the one-shot anchor is consumed. No raw positions enter
view state or storage.

## Production path

```text
ProjectionWorkspace + ViewProjectionState + Local ViewProjection
  → HIER1 Focus Schematic model (main thread, only while preview is mounted)
  → renderer-owned File/Heading/Block dimensions
  → frozen HIER3A A1 input
  → exact page-lifetime computed-layout cache, or dedicated worker
  → validated FocusSchematicComputedLayout
  → validated modular React Flow graph
  → shared GraphCanvas interaction and camera surface
```

`ModularStructuredGraphView` is dynamically imported only for Focus +
Hierarchy + Modular preview. The worker client and modular renderer subpath are
reachable only from that lazy component. The Classic component, W3 worker,
mapping, handle IDs, deterministic seed, and fallback behavior remain
independent.

## Worker and cache

The modular worker uses protocol version 1 and strict request/response shapes.
It validates input before computation and validates the complete A1 result
against the originating input before returning or adopting it. A newer request
settles the previous promise as superseded and terminates its worker generation.
Unmount, Focus exit, workspace change, and switching to Classic cancel pending
work. Startup, clone, worker, message, malformed response, and computed-output
failures are explicit.

The cache stores at most 24 successful computed layouts for the page lifetime.
Its exact serialized key includes the protocol/algorithm version, HIER1 model,
Local projection, renderer-derived dimensions, and frozen settings. It excludes
selection, hover, viewport, Visual Group styles, Focus appearance, Inspector,
and secondary visibility. Every hit is validated; a corrupt entry is deleted
and treated as a miss. Coordinates are never persisted.

## Renderer mapping

The modular subpath first reuses `mapProjectionToReactFlow` for titles, paths,
line context, roles, disclosure counts, internal-reference badges, diagnostics,
root identity, and Visual Group entity identity. It then applies exact A1 entity
positions and fixed renderer dimensions.

- Quiet module rectangles are nonselectable, noncanonical background nodes.
- Filtered modules use an anonymous 72×40 bridge labelled “Filtered File
  bridge”; no hidden title or path is shown.
- Hierarchy edges use HIER3A hierarchy attachments and retain parent→child
  semantics.
- Precise references retain authored direction, exact File/Heading/Block
  projection endpoints, projected edge identity, and Inspector selection.
- Fallback edges carry `projectionEdgeId: null`, are visibly dashed and
  nonselectable, and never fabricate Inspector provenance.
- Same-file visible references use their exact projected endpoints. Collapsed
  occurrences stay card badges.
- Secondary relationships are off by default. Toggling them remaps edges only;
  the model, worker, cache key, computed layout, and node coordinates do not
  change.
- Diagnostic nodes retain exact projection identity and use a deterministic
  collision search outside module rectangles. Failure to place one safely
  fails adoption instead of producing a partial graph.

Entity and diagnostic cards expose symmetric hidden source/target handles on
all four sides. Existing Classic edges retain their original handle IDs.

## Lifecycle and failure behavior

The preview represents `idle`, `preparing-model`, `cache-hit`,
`worker-pending`, `ready`, `warning-with-last-valid`, and
`fatal-no-valid-result` explicitly. While a replacement layout is pending, the
last safe graph remains visible after removing entities/modules absent from the
current projection, and interactions are disabled with a truthful updating
status. Adoption validates computed geometry, maps and validates a whole
renderer graph, then commits it atomically.

A transient failure retains the previous valid modular graph and exposes Retry.
Without a valid graph, GraphExplorer falls back to Classic for the session,
keeps the Modular Preview preference, reports the reason, and exposes a retry.
There is no automatic retry loop and no blank success-shaped graph.

## Deferred ownership

HIER3B uses React Flow’s current connector rendering over exact attachment
semantics. Direct/Electronic/Electronic Rounded route ownership remains HIER5.
Folder bands and folder-position post-processing remain HIER4. HIER3C alone may
make Modular the normal Focus Hierarchy and move Classic behind Experimental.
