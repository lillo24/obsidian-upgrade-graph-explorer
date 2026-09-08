# ADR 0022: Adaptive Compass with Directional Folder Bands

## Status

Accepted on September 8, 2026.

## Context

ADR 0020 placed the renderer-neutral A1 layout behind a dedicated production
worker while Classic Focus Hierarchy remained the default. HIER3B-FIX1 improved
the vertical center spine and module hover, but HIER4A evidence showed that exact
folder bands and real cross-module endpoint demand require joint control of
module internals, visual sibling order, and folder placement.

The development bakeoff retained Current/Mosaic, Vertical Spine, Adaptive
Compass, Document order, and Crossing optimized long enough to compare them.
Graphical review selected Adaptive Compass plus endpoint-aware ordering and later
confirmed packed root-band balancing. The final browser review approved the same
geometry in the actual Modular graph.

## Decision

1. Use Adaptive Compass as the default internal grammar for every expanded
   visible File module in Modular Focus Hierarchy.
2. Use Crossing optimized as its default visual Heading-order policy. Preserve
   canonical Markdown/source order and allow only legal visual branch reordering.
3. Retain Vertical Spine and Document order as persisted Sandbox alternatives.
   Keep Current/Mosaic development-only and migrate obsolete persisted values to
   Adaptive Compass.
4. Enable categorical Directional Folder Bands for every production Modular
   request. Preserve singleton bands, exact folder identities, filtered-bridge
   exclusion, signed-rank semantics, and packed root-centered balance.
5. Preserve the bounded two-round joint folder/internal refinement. Limit
   ordinary per-module Compass search to 64 complete restricted assignments and
   use deterministic bounded relocation/swap sweeps for larger modules. Never
   form a global product of module assignments.
6. Compare valid candidates lexicographically. Exact endpoint crossings and
   adjacent-rank inversions outrank balance, span, displacement, and compactness.
7. Require both product policies in strict worker protocol version 3. Identify
   the selected combined geometry as algorithm revision 3 and include both
   policies in the exact cache key and result validation.
8. Keep the worker as the sole owner of layout. React Flow renders final
   rectangles, bounds, and attachments without Compass-specific positioning.
9. Keep Secondary relationships, hover, and Visual Groups geometry-neutral.
10. Keep Classic Focus Hierarchy as the product default. Defer route ownership
    to HIER5, Soft Folder Clusters to HIER4B, and the default flip to HIER3C.

## Consequences

The real Modular preview now uses the selected HIER4A geometry rather than a lab
prototype. Its four supported policy combinations have distinct exact cache
identities, switch immediately, and persist under the existing preferences key.
Worker timing evidence distinguishes internal-variant and folder-ordering work,
and explicit fallback counters make bounded large-module behavior observable.

The layout can change visual Heading order and increase graph extent to preserve
crossing, inversion, containment, and exact-band priorities. It does not mutate
source order, ownership, navigation, Inspector provenance, or canonical entity
identity. No external dependency or persisted coordinate schema is introduced.

## Rejected alternatives

- Current/Mosaic as a product choice: rejected because it is retained only as
  development comparison evidence.
- Vertical Spine as the default: rejected by the graphical bakeoff; it remains a
  valid Sandbox preference.
- Document order as the default: rejected where legal visual reordering removes
  exact endpoint crossings; it remains available to users who prefer source
  order.
- A weighted scalar objective: rejected because compactness or displacement must
  never buy an additional exact crossing.
- A global optimizer or force simulation: rejected because the selected bounded,
  deterministic local search and joint refinement satisfy the required geometry.
- Renderer-side Compass or a second React layout pass: rejected because it would
  split geometry ownership and invalidate exact worker/cache results.
