# Focus Schematic layout

This package owns the renderer-neutral HIER2 layout input, deterministic
layout plan, common module-box policy, public sibling-order constraints, and
the selected two-stage Dagre implementation. It is deliberately absent from
production imports until HIER3.

`computeFocusSchematicLayout(input)` is the narrow adoption API. The input
contains a HIER1 model, its KG6 projection, one strictly ordered positive
dimension record for every visible entity node, and explicit settings. The
function returns a strictly validated HIER1 layout candidate or throws an
actionable error. `computeFocusSchematicLayoutAttempt` adds benchmark timings,
native-route evidence, and explicit failure status for the development tool.

The frozen comparison profile uses Dagre 3.1.1, LR internal and macro graphs,
24/48 px internal node/rank separation, 36/80 px macro separation, 28 px
horizontal and 24 px vertical module padding, a 34 px diagnostic shelf, and a
16 px hard-gate clearance. Filtered path intermediaries use a 72 × 40 compact
anonymous bridge. These values are behavior and must stay synchronized with
the bakeoff evidence if changed.

## Source map

- `src/types.ts` owns the plain input, plan, attempt, timing, and route types.
- `src/input.ts` validates exact dimension coverage, ordering, geometry, and
  settings.
- `src/plan.ts` resolves HIER1 equal-mutual ambiguity once for every strategy
  and validates the monotonic acyclic backbone.
- `src/source-order.ts` derives public Dagre adjacent-sibling constraints from
  canonical source order.
- `src/settings.ts` owns the frozen spacing, reserve, clearance, and filtered
  placeholder policy.
- `src/two-stage.ts` lays out each File hierarchy and then the shared module
  backbone with fresh stateless Dagre graphs.
- `src/*.test.ts` covers input rejection, planning, deterministic geometry,
  filtered modules, containment, clearance, and the production boundary.

The package depends inward on core, view-projection, focus-schematic, and the
already pinned `@dagrejs/dagre` 3.1.1 only. It must not import React, renderers,
apps, W3, view-state, Tauri, source adapters, or filesystem APIs.

HIER3 production integration must connect cross-file relationships to the
actual visible File, Heading, or Block endpoints carried by the HIER1 model.
Relevant internal entities should face the neighbouring macro rank where
sensible; a multi-hop module may need separate incoming-facing and
outgoing-facing lanes instead of a fixed `File → Heading` orientation. This may
refine Strategy A's per-module internal stage but must retain its selected
two-stage macro architecture. Complete explicit route ownership remains HIER5.
