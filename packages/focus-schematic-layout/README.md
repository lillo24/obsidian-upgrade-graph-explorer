# Focus Schematic layout

This package owns the renderer-neutral HIER2/HIER3A layout input,
deterministic module and endpoint plans, internal File-module lanes, common
module-box policy, public sibling-order constraints, and the two-stage Dagre
implementations. It remains absent from production imports until HIER3B.

`computeFocusSchematicLayout(input)` selects the accepted HIER3A A1 layout. The input
contains a HIER1 model, its KG6 projection, one strictly ordered positive
dimension record for every visible entity node, and explicit settings. The
function returns a strictly validated HIER1 layout candidate or throws an
actionable error. `computeFocusSchematicLayoutAttempt` retains the established
candidate/plan attempt shape with A1 geometry, benchmark timings, native-route
evidence, and explicit failure status.

`computeFocusSchematicComputedLayout(input)` is the explicit HIER3A A1
candidate. It returns a strictly validated plain-data result containing the
unchanged HIER2 module plan, exact visible endpoint/fallback connections,
per-node demands, the left/center/right lane plan, endpoint-facing geometry,
boundary attachments, and endpoint quality. Attachments are simple endpoint
suggestions; candidate routes remain empty because channel/obstacle routing is
owned by HIER5. `computeFocusSchematicUniformLayout` keeps A0 available as an
explicit development comparison seam, and historical HIER2 tools call it
directly.

After Dagre establishes exact internal endpoint positions, A1 performs four
fixed endpoint-ordering sweeps. Each signed macro rank uses the median desired
center from precise selected-backbone and Focus-path endpoints in its adjacent
rank, then collision-packs the variable-height module rectangles. A bounded
sibling-branch pass applies the same ordering evidence to disjoint left/right
structural branches when the swap strictly improves exact-endpoint crossings
or vertical alignment. Markdown source order breaks ties; it does not preserve
an avoidable inversion. Secondary connections never enter either pass.

Physical sides derive only from relative signed module ranks: a counterpart
at a smaller rank attaches left, a counterpart at a larger rank attaches
right, and same-rank secondary display uses `auto`. Authored source and target
never swap. Secondary connections retain exact provenance but create no lane
demand or coordinate change. A document stays central even when it exposes
attachments; left-only and right-only subtrees use their respective lanes,
mixed ancestors stay central, and neutral descendants inherit a side only
when their parent already owns that side. One dual-demand entity remains one
central node with two attachments.

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
- `src/endpoint-plan.ts` maps every visible endpoint group once, accounts for
  fallback provenance, classifies presentation roles, derives physical sides,
  and collects direct node demands.
- `src/lane-plan.ts` validates each module hierarchy forest, propagates subtree
  demand, assigns internal lanes, and suggests quiet hierarchy attachments.
- `src/crossing-minimization.ts` owns the fixed forward/backward macro-rank
  sweeps, variable-height collision packing, sibling-branch swaps, and exact
  endpoint crossing/order metrics.
- `src/endpoint-facing.ts` composes center TB, left RL, and right LR Dagre
  regions, runs the macro and endpoint-order stages, derives exact attachments,
  and evaluates endpoint-side quality.
- `src/endpoint-fixtures.ts` owns the synthetic EP1–EP26 and ES1–ES8 review
  corpus used by package tests and the development lab.
- `src/source-order.ts` derives public Dagre adjacent-sibling constraints from
  canonical source order.
- `src/settings.ts` owns the frozen spacing, reserve, clearance, and filtered
  placeholder policy.
- `src/selected.ts` maps the accepted A1 computed result to the compatible
  selected candidate/attempt API.
- `src/two-stage.ts` preserves A0 by laying out each File hierarchy uniformly
  and then running the shared module backbone with fresh stateless Dagre
  graphs.
- `src/*.test.ts` covers input rejection, planning, deterministic geometry,
  exact endpoints, lane propagation, EP1–EP26, ES1–ES8, Markdown integration,
  filtered modules, containment, clearance, and the production boundary.

The package depends inward on core, view-projection, focus-schematic, and the
already pinned `@dagrejs/dagre` 3.1.1 only. It must not import React, renderers,
apps, W3, view-state, Tauri, source adapters, or filesystem APIs.

The accepted A1 result is the intended HIER3B worker payload. HIER3B owns
transport, latest-result-wins behavior, caching, stale-result rejection,
renderer mapping, and production fallback. Complete explicit route ownership
remains HIER5.
