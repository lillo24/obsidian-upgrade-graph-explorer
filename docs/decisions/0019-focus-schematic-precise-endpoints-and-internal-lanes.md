# ADR 0019: Adopt precise endpoints and endpoint-facing internal lanes

## Status

Accepted.

## Context

ADR 0018 selected stateless two-stage Dagre as the Focus Schematic macro-layout
architecture. Its A0 internal stage uniformly laid every File hierarchy LR.
HIER1 already preserved the actual visible File, Heading, or Block endpoints of
cross-file references, but A0 geometry did not consistently face those
endpoints toward neighbouring ranks. It also produced avoidable vertical edge
inversions once exact endpoint positions were displayed.

## Decision

Adopt A1, `ADOPT_ENDPOINT_FACING_SPLIT_LANES`, as the selected non-production
Focus Schematic layout.

1. HIER1 visible endpoint groups remain the authored source/target truth.
   Precise connections retain projected-edge, canonical-entity, owning-module,
   ReferenceId, and role provenance. Deterministic fallbacks remain explicit.
2. Physical attachment side derives from relative signed module rank. Authored
   direction never changes to fit the layout.
3. Visible File modules use left, center, and right internal lanes. Center is
   TB; left and right subtrees use RL and LR respectively through fresh public
   Dagre 3.1.1 graphs.
4. Mixed ancestors and dual endpoints remain one center node. Real entities are
   never duplicated to satisfy two demands.
5. Secondary links retain display provenance but do not influence demand,
   lanes, ordering, packing, or any geometry.
6. Four deterministic endpoint-aware macro-rank sweeps use median exact
   endpoint preferences and collision-pack variable-height rectangles. An
   analogous bounded pass may swap disjoint sibling branches. Markdown source
   order is a soft tie-break.
7. Strategy A's macro ranks, parent backbone, filtered bridge, spacing, and root
   normalization remain unchanged.
8. Exact boundary attachments are endpoint geometry. Full obstacle/channel
   routing remains HIER5.
9. Production rendering remains unchanged until HIER3B. The current HIER0/D0
   implementation remains Classic Focus Hierarchy and must be preserved through
   later modular integration.

`computeFocusSchematicLayout` selects A1 while returning only the compatible
layout candidate. The richer computed result is the future HIER3B worker
payload. A0 remains available through explicit uniform-layout exports and is
used directly by the historical HIER2 bakeoff.

## Evidence

A1 passed EP1–EP26, ES1–ES8, HIER2 F1–F18, 24 generated holdouts, Markdown
integration, deterministic permutation/cold-run checks, scale profiles through
500 modules, and every geometry hard gate. EP12 exact crossings/inversions fell
from 3/3 to 0/0; deliberate module and sibling regressions EP25/EP26 each fell
from 1/1 to 0/0. Secondary-only geometry stayed byte-identical.

Two graphical reviews accepted the result. The first found A1 clearly better
than A0 and kept the orientation decision closed while requesting endpoint-aware
ordering. The final review confirmed that EP12, EP25, and EP26 were resolved and
approved A1 with the bounded ordering pass.

## Consequences

The layout package now owns exact endpoint, lane, attachment, crossing metric,
and ordering policy as strict renderer-neutral plain data. HIER3B can move this
payload behind a dedicated latest-result-wins worker without re-deriving
semantics in React or a renderer. The bounded ordering work adds measurable but
acceptable cost and no new dependency.

Production UI, renderer mapping, W3, view-state, persistence, and settings are
unchanged in HIER3A. HIER3B remains the next milestone and is not started by
this decision.

## Rejected alternatives

- Keep A0 selected: rejected because graphical review found the precise
  endpoint-facing lanes materially clearer.
- Preserve source order as a hard geometric constraint: rejected because it
  retains obvious crossing inversions such as EP12, EP25, and EP26.
- Let secondary links optimize geometry: rejected because display-only context
  must not destabilize the selected/Focus path.
- Add obstacle routing now: rejected because endpoint ordering is a rectangle
  positioning concern and complete route ownership remains HIER5.
- Replace Strategy A's macro architecture: rejected because HIER3A refines the
  accepted HIER2 architecture rather than reopening A versus B.
