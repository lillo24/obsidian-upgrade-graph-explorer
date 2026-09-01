# ADR 0015: Complete the multi-scale renderer architecture

**Status:** Accepted — KG13 complete.

## Context

KG13B1 established a documents-only Global/Regional network in Sigma, and
KG13B2A added a bounded Local Free presentation in Sigma. The remaining Local
task is hierarchy legibility: a user must be able to inspect the same Local
files, headings, blocks, diagnostics, disclosure, filters, and references as a
compact schematic without returning to the separate whole-workspace Structure
presentation.

The existing KG6 Local projection, schema-v3 semantic viewport, W3 Dagre
worker, Search, Inspector, history, and live-update contracts are already the
authorities. A second Local traversal model, duplicated projection, persistent
coordinates, or another layout engine would split those authorities.

## Decision

The final presentation architecture is:

```text
Global/Regional  → Sigma, documents only
Local            → one bounded projectLocalView projection
  Free           → Sigma + latest-only ForceAtlas2 worker
  Structured     → React Flow + latest-only W3 Dagre worker
Structure        → React Flow + W3, general hierarchy presentation
```

Free and Structured are presentations of the identical memoized Local
`ViewProjection`. `LocalLayoutMode = free | structured` is stored in the
existing graph-preference key, defaults to Free, and is not canonical state or
a graph-history checkpoint. Switching it changes no Local root, focus,
disclosure, query, filter, projection workspace, or Global topology/layout.
Only the active Local component and worker are mounted.

Local Structured is an opt-in `GraphCanvas` visual variant and an explicit
`local-structured` Dagre mode. It retains the mature W3 latest-result-wins
lifecycle instead of copying the canvas or changing the worker protocol.
Its fixed measured boxes are File `156 × 46`, Heading `148 × 42`, Block
`132 × 38`, and diagnostic `148 × 42`. Dagre is left-to-right with 22 node
separation, 58 rank separation, and the existing hierarchy/reference weights.
The marker grammar is File `▰`, Heading `◇`, Block `●`, and diagnostic `○`;
hierarchy edges remain stronger than reference cross-links. Standard Structure
dimensions, classes, routing, and Dagre settings do not change.

An O(nodes + edges), deterministic, complete seed places the Local root at the
origin before W3 returns. W3 output is normalized around that root. Failure
keeps the seed or exact cached positions visible with a nonfatal warning; it
never runs synchronous Dagre or silently changes to Free.

Exact Structured results may use a bounded page-memory cache. Its fingerprint
contains the Local Structured mode/version, stable renderer node IDs and fixed
dimensions, and edge IDs/endpoints/kinds. It excludes labels, paths, source or
query text, selection, hover, Inspector state, and camera. An exact hit is
shown immediately and skips W3. Coordinates never enter canonical data,
history, or persistence.

A narrow runtime API asks either Local renderer for one projected node's
screen point. Free↔Structured switching anchors the selected visible node, or
the root, at that point. The API exposes no renderer instance or graph-space
coordinates and the point is discarded after the receiving mount. Node
selection survives when visible; Structured edge selection is cleared with an
announcement when switching to Free because Sigma Local has no accessible edge
selection surface.

Schema v3 remains current. A Local semantic bookmark stores canonical
`anchorEntityId`, `freeRatio`, and optional `structuredZoom`; observations from
one renderer preserve the other renderer's scale. Raw x/y, screen points,
React Flow/Sigma objects, and layout positions remain forbidden. Back/Forward
restores semantic Local state through the user's current Local layout
preference, not a historical derived layout.

Search, Inspector, QUERY1 filters, disclosure, rerooting, and live source
updates remain shared above both renderers. A changed Local topology receives
an immediate seed and at most one latest W3 result when Structured is active.
Local heading changes perform no Global projection or layout. Standard
Structure remains the separate general hierarchy presentation.

## Consequences

KG13 now supplies file-network overview, regional visual LOD, bounded free-form
context, bounded schematic detail, and the existing general Structure view
without a universal renderer abstraction. Local Structured adds no dependency,
source/network behavior, source write, custom router, physics engine, or
persistent spatial system.

The synthetic Local-medium scene (381 nodes/430 edges) measured a 0.748 ms
compact-mapping median, 0.410 ms seed median, 93.297 ms worker-equivalent Dagre
median, 0.231 ms apply/root-normalization median, and 0.077 ms exact-cache-hit
median on the recorded development machine. These are investigative local
values, not CI timing thresholds. The immediate seed keeps W3 outside the first
usable scene, and the operation oracle records zero Local reprojections,
Global projections/layouts, or workspace transactions for a layout-only
switch.

QUERY1 evolution, GROUP1 visual rules, Saved Views, manual positioning, source
editing, clustering inside Local, alternate routing, and product-polish work
remain separate. KG14 is the next milestone; this ADR does not begin it.
