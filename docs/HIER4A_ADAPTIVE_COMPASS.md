# HIER4A Adaptive Compass production integration

## Status

Complete. `ADOPT_ADAPTIVE_COMPASS` is the selected internal grammar for
Modular Focus Hierarchy. Crossing optimized is the default visual Heading-order
policy. Vertical Spine and Document order remain persisted Sandbox alternatives.
Classic Focus Hierarchy remains the product default until HIER3C.

## Production path

The real Focus + Hierarchy + Modular Preview path is:

```text
Focus projection and HIER1 semantic model
  → renderer-owned fixed dimensions
  → exact cache or dedicated layout worker
  → Directional Folder Bands
  → Adaptive Compass for every expanded visible File module
  → crossing-optimized sibling/branch display order
  → final module bounds, node rectangles, and exact attachments
  → modular React Flow mapper and shared GraphCanvas
```

The worker owns all geometry. React consumes the validated result without a
second layout pass. Current/Mosaic remains development evidence and is not a
product setting.

## Settings and compatibility

Sandbox exposes four Modular-only choices:

- Internal layout: Adaptive Compass or Vertical Spine.
- Heading order: Crossing optimized or Document order.
- Folder strips: On or Off; On is the default.
- Connection style: Direct or Electronic; Direct is the default.

Fresh and upgraded preferences default to Adaptive Compass plus Crossing
optimized under the existing graph-preferences v1 storage key. The normalizer
migrates an obsolete Current/Mosaic value and any unknown internal-layout value
to Adaptive Compass; an unknown Heading-order value becomes Crossing optimized.
Changing the internal-layout or Heading-order choice recomputes immediately.
Folder strips and connection style persist across reloads but are renderer-only:
they do not change the model, worker request, computed layout, cache key, or
viewport. Classic ignores all four values.

## Worker and cache contract

Worker protocol version 3 requires the two typed product policies and rejects
missing, unknown, development-only, or Folder-Bands-Off requests. The selected
layout algorithm revision is 3. The exact 24-entry page cache includes the
algorithm revision and both policy values, so all four supported combinations
have independent identities. Hits are validated against the requested policies
before adoption. Existing latest-result-wins, cancellation, stale-generation,
last-valid-result, and session-only Classic fallback behavior remains active.

## Adaptive Compass

Each visible expanded File owns a local Adaptive Compass search over whole
top-level structural branches. A branch retains its authored descendants,
ownership, levels, spans, and canonical source order. Ordinary modules evaluate
at most 64 complete restricted assignments. Larger modules use deterministic
demand initialization plus four bounded relocation/swap sweeps. Two fixed joint
folder/internal refinement rounds update endpoint demand and final dimensions;
there is no cross-module Cartesian product or convergence loop.

Candidate comparison remains lexicographic. Exact endpoint crossings and
adjacent-rank inversions outrank hierarchy crossings, vertical balance,
connection span, source-order deviation, and compactness. Crossing optimized may
change only legal visual sibling/branch order. Document order preserves the
canonical visual order without mutating source-derived data.

## Directional Folder Bands

Directional Folder Bands are always On for Modular production geometry. Every
visible non-filtered exact folder, including a singleton, receives a band.
Filtered bridges remain outside band ownership. The root File stays at `(0, 0)`;
packed-height balancing selects above/below folder partitions only after
crossing and inversion guards. Final band heights use the selected Compass module
dimensions, and accepted topology exceptions remain explicit in layout evidence.

## Interaction and deferred work

Disclosure, reroot, query hide/restore, selection, Inspector, direct-File rings,
module-aware File hover, exact Heading/Block hover, camera behavior, and the
shared React Flow surface keep their existing contracts. Secondary relationships,
hover, and Visual Groups have zero influence on geometry.

PRE-HIER4B renders every visible `folderBandPlan.bands` record as a quiet,
non-interactive, world-coordinate strip behind edges and nodes. Its shared X
extent comes only from final renderer rectangles; its exact Y interval, visible
folder identity, root treatment, singleton presence, and filtered privacy come
from the validated plan. Modular Direct uses one `getStraightPath` segment
between the existing exact handles. Electronic retains the prior SmoothStep
appearance. Both are a narrow renderer seam, so HIER5 still owns orthogonal
routing, rounded styling, channels, obstacle avoidance, and hit-target work.
HIER4B still owns Soft Folder Clusters, and HIER3C still owns the later
product-default flip.
