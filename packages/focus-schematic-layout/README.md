# Focus Schematic layout

This package owns the renderer-neutral HIER2/HIER3A layout input,
deterministic module and endpoint plans, internal File-module lanes, common
module-box policy, public sibling-order constraints, and the two-stage Dagre
implementations. HIER3B exposes the selected A1 computation through a strict,
versioned production worker boundary while keeping the package renderer- and
application-neutral.

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
the HIER4 exact-folder band plan/quality, boundary attachments, and endpoint
quality. Attachments are simple endpoint
suggestions; candidate routes remain empty because channel/obstacle routing is
owned by HIER5. `computeFocusSchematicUniformLayout` keeps A0 available as an
explicit development comparison seam, and historical HIER2 tools call it
directly.

For a File with at least two center structural branches, algorithm revision 2
lays out each top-level branch independently and chooses a deterministic
source-contiguous cut around the central File. This keeps module width equal to
the widest branch rather than the sum of sibling widths. Side regions anchor to
the final center-parent Y positions.

After Dagre establishes exact internal endpoint positions, A1 performs four
fixed endpoint-ordering sweeps. Each signed macro rank uses the median desired
center from precise selected-backbone and Focus-path endpoints in its adjacent
rank, then collision-packs the variable-height module rectangles. A bounded
sibling-branch pass applies the same ordering evidence to disjoint left/right
structural branches when the swap strictly improves exact-endpoint crossings
or vertical alignment. One forward and one backward adjacent-swap pass applies
the same rule inside each above/below center stack without crossing the File.
Markdown source order breaks ties; it does not preserve an avoidable inversion.
Secondary connections never enter either pass.

The HIER4A development seam runs after revision-2 endpoint ordering. It derives
one band for every visible non-filtered exact `folderKey`, including singleton
and root folders, while excluding filtered intermediary identity. Directional
Folder Bands are categorical: Off bypasses the pass and stays byte-identical to
revision 2; On applies the strongest accepted global band order. The
development-only endpoint-order policy compares the accepted A1/document order
with crossing-optimized graph-only sibling display order; neither policy changes
Markdown/source ownership, hierarchy, Inspector order, or navigation semantics.

HIER4A-FIX2 adds three non-persisted internal-layout review variants while
Folder Bands are On. `current` preserves the M0 demand-lane mosaic baseline.
`vertical-spine` keeps the File as the center anchor and moves every whole
top-level branch to one above/below spine, using actual branch heights and a
hard preference for a two-sided split when crossings and inversions tie.
`adaptive-compass` keeps the File fixed at the center while whole branches may
occupy bounded top, bottom, left, or right stacks derived from primary endpoint
demand. Compass evaluates at most 64 complete region assignments per module;
large branch sets use four deterministic local relocation sweeps. Both
candidates run two bounded folder/internal rounds, recompute module and band
dimensions, keep exact entity ownership, and report Manhattan/vertical span,
hierarchy crossings, source-order deviation, dimensions, area, and search
counts. Folder Bands Off ignores the review variant and remains the byte-exact
A1 oracle. No internal-layout choice enters product settings or the worker
selection until graphical approval.

The root folder owns the central band. Every folder candidate receives its own
provisional module placement, legal whole-branch sibling reorder, safe rank
order, and repack for exactly two alternating rounds before crossings and
inversions are judged. Small sets of at most six non-root folders use bounded
side assignment; larger sets retain adjacent folder-order sweeps and contiguous
cuts. Candidate comparison is lexicographic: exact crossings, adjacent-rank
inversions, exception count, one-sided-root penalty, actual packed-height
imbalance, exact primary endpoint vertical span, exception distance, A1
displacement, source-order deviation, then stable ID. Secondary relationships
enter none of these metrics. A less balanced cut survives only with an explicit
post-reorder topology-guard record. Each File is
either fully inside its own interval or linked to an explicit crossing,
rank-inversion, root-anchor, or unsatisfiable-order exception. Four deterministic
forward/backward sweeps refine folder and rank order through adjacent swaps.
Exact selected-backbone and Focus-path crossings/inversions are hard
non-regression gates. Internal node Y may change only through the legal accepted
sibling-branch pass; module X, dimensions, ownership, lanes, and exact endpoint
identity stay fixed. The default remains Off until graphical approval selects
the HIER4A candidate and visual Heading-order policy.

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
- `src/internal-layout-variants.ts` owns the development-only M0/V1/C1 branch
  placement, fixed candidate caps, whole-branch movement, File clearance,
  internal hierarchy-crossing measurement, and transparent quality evidence.
- `src/crossing-minimization.ts` owns the fixed forward/backward macro-rank
  sweeps, variable-height collision packing, reusable legal whole-branch swaps,
  source-order deviation, and exact endpoint crossing/order metrics.
- `src/folder-bands.ts` owns exact-folder inventory, categorical global band
  order, bounded joint candidate refinement, small-set side assignment, exact
  primary span scoring, exact band assignment, explicit topology exceptions,
  quality metrics, and strict geometry validation.
- `src/endpoint-facing.ts` composes center TB, left RL, and right LR Dagre
  regions, runs the macro and endpoint-order stages, derives exact attachments,
  and evaluates endpoint-side quality.
- `src/endpoint-fixtures.ts` owns the synthetic EP1–EP26, ES1–ES8, and CS1–CS6
  review corpora used by package tests and development tools.
- `src/folder-fixtures.ts` owns the inherited FB1–FB18 and FS1–FS8 evidence plus
  DB1–DB19, VS1–VS7, and CP1–CP5 categorical folder, internal grammar,
  true-block, span, Secondary, and reroot review cases.
- `src/source-order.ts` derives public Dagre adjacent-sibling constraints from
  canonical source order.
- `src/settings.ts` owns the frozen spacing, reserve, clearance, and filtered
  placeholder policy.
- `src/selected.ts` maps the accepted A1 computed result to the compatible
  selected candidate/attempt API.
- `src/worker-protocol.ts` owns the version-2 exact-shape production messages
  and originating-input result validation.
- `src/worker-runtime.ts` validates requests, computes A1, records phase
  timings, and returns either a complete validated result or an explicit
  failure.
- `src/two-stage.ts` preserves A0 by laying out each File hierarchy uniformly
  and then running the shared module backbone with fresh stateless Dagre
  graphs.
- `src/*.test.ts` covers input rejection, planning, deterministic geometry,
  exact endpoints, lane propagation, EP1–EP26, ES1–ES8, Markdown integration,
  filtered modules, folder-band invariants, containment, clearance, and the
  production boundary.

The package depends inward on core, view-projection, focus-schematic, and the
already pinned `@dagrejs/dagre` 3.1.1 only. It must not import React, renderers,
apps, W3, view-state, Tauri, source adapters, or filesystem APIs.

The accepted A1 result is the HIER3B worker payload. The web application owns
transport, latest-result-wins behavior, caching, stale-result rejection, and
production fallback; renderer-reactflow owns production mapping. Complete
explicit route ownership remains HIER5.
