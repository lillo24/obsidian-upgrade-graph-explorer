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

HIER4A-PATCH2 adds the approved one-level hierarchy mode for Directional
Folder Bands. It derives the deepest meaningful parent containers from exact
canonical folder ancestry after final module dimensions are known. The focused
root folder remains an independent full-path band. A materialized parent is an
atomic top-level ordering unit; its direct Files form an unlabeled internal
unit, and preserved immediate child folders form structurally contained bands.
The bounded parent-local and top-level sweeps may reorder those units for exact
primary topology, but they cannot trade away parent or child containment.
Flat omits the hierarchy plan and preserves the accepted serialized oracle.
Soft Folder Clusters does not call this pass.

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

HIER4B-SPACING-FIX2 retains one Soft structural policy at 600 hop spacing,
88 module clearance, 180 topology distance, 72 packing steps, 104 radial
jitter, 30/60 internal node/rank separation, and 34/30 module padding. The
0–100 Sandbox spacing value is a post-layout radial transform with scale
`1 + 1.4 × value/100`. It translates complete non-root modules and their nodes
around the fixed root, then recomputes cardinal attachments and
geometry-derived quality without changing dimensions, internal offsets,
Adaptive Compass, folder force, or packing. It is excluded from the worker
request and structural cache key.

HIER4B-SPACING-FIX3B adds one deterministic structural packing stage after the
Soft solver and before radial spacing. In Direct mode, each immediate named
folder is an exact rigid compound of its final module rectangles; root-level
Files remain atomic structural bodies. A bounded nearest-ring
search translates whole bodies until an affine interval oracle proves that no
cross-group module pair can violate the 16 px clearance anywhere over the
continuous 1.0x-2.4x spread range. The optional Workspace-root group remains a
renderer-only preference: structural packing also validates the aggregate root
body, so toggling it does not enter worker input or cache identity. No collision
or repacking pass runs after radial spacing.

HIER4B-SPACING-FIX4 inserts mandatory immediate-folder cohesion before that
compound pack. It groups by the post-manual/pre-compression direct parent,
compacts whole modules around their prior centroid, and shares the renderer's
island oracle. Named singleton folders remain in the
display tree. Automatic compression removes only ancestor-only pass-through
folders. Folder strength zero disables extra attraction but still runs this
cohesion stage.

HIER4B-SPACING-FIX5 derives a Focus-neutral grouping projection from the
truthful semantic display tree. It removes Focus, then reruns empty-folder
pruning and pass-through compression for cohesion, compound bodies, hierarchy
packing, radial spacing, guides, and visible-folder evidence. Focus remains a
fixed topology/collision anchor with its source-folder metadata intact. Nested
mode packs the retained logical tree deepest-first: direct Files form one rigid
unit, each packed child subtree forms another, and parent-level packing moves
only whole units. Final compound packing and radial spacing treat each retained
top-level subtree as one body, preserving all descendant containment. Direct
mode keeps the FIX4 immediate-folder bodies. Named-folder coverage and Nested
containment, split, and blocker counts are hard zero gates.

Nested Soft force uses normalized `1 / base ** index` membership with selectable
base 3 (default) or 4. Direct-only selects each File's immediate displayed
parent after manual promotion/flattening and before automatic singleton
compression, then canonicalizes decay out of the cache identity. Both modes
exclude the root File from the grouping projection while retaining truthful
source membership in the semantic tree used by context actions. The fixed
`[36, 18]` schedule and secondary zero-influence rule are unchanged.
Directional physical sides retain HIER4A's signed-rank policy: a counterpart at
a smaller rank attaches left, a counterpart at a larger rank attaches right,
and same-rank secondary display uses `auto`. Soft Folder Clusters instead chooses
each File or module-anchor side independently from the final two endpoint
rectangle centers. The larger absolute delta selects the horizontal or vertical
axis, with horizontal winning an exact 45-degree tie and right winning a
coincident-center fallback. Heading and Block endpoints keep their precise
Compass/lane side. Authored source and target never swap. Secondary connections
retain exact provenance but create no lane demand or coordinate change.

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
- `src/attachments.ts` applies either the preserved Directional attachment
  policy or Soft spatial-cardinal File/module-anchor policy and measures the
  exact attachment segments used by bounded Soft candidate scoring.
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
- `src/directional-folder-hierarchy.ts` derives the experimental one-level
  parent/direct/child plan, applies deterministic local and atomic top-level
  ordering, packs actual-height rectangles, and validates hard containment.
- `src/directional-folder-hierarchy-fixtures.ts` owns ND1–ND15 hierarchy,
  simplification, ordering, root, disclosure, reroot, and invariance evidence.
- `src/endpoint-facing.ts` composes center TB, left RL, and right LR Dagre
  regions, runs the macro and endpoint-order stages, derives exact attachments,
  and evaluates endpoint-side quality.
- `src/endpoint-fixtures.ts` owns the synthetic EP1–EP26, ES1–ES8, and CS1–CS6
  review corpora used by package tests and development tools.
- `src/folder-fixtures.ts` owns the inherited FB1–FB18 and FS1–FS8 evidence plus
  DB1–DB19, VS1–VS7, and CP1–CP5 categorical folder, internal grammar,
  true-block, span, Secondary, and reroot review cases.
- `src/soft-clusters.ts` owns the experimental HIER4B 2D macro
  solver: undirected primary springs, hop-radius preference, normalized-decay
  nested-folder attraction, deterministic seeding, variable-rectangle collision
  packing, and bounded two-round internal-layout evidence. The Modular worker
  calls it only when the persisted Sandbox macro policy selects Soft Folder
  Clusters; Directional Bands remains the default.
- `src/soft-cluster-spacing.ts` owns the fixed structural policy, bounded 0–100
  radial-spread normalization, and continuous 1.0×–2.4× scale mapping.
- `src/soft-group-packing.ts` owns immediate-folder compound bodies, the exact
  Focus anchor, Nested top-level subtree bodies, the exact continuous affine
  overlap oracle, deterministic structural body packing, and packing evidence.
- `src/soft-folder-cohesion.ts` owns deterministic immediate named-folder
  compaction, movement evidence, and the final split hard gate.
- `src/soft-nested-hierarchy-packing.ts` owns deterministic deepest-first
  retained-tree packing, rigid child-subtree translation, Focus-blocker and
  one-region validation, named-folder coverage auditing, and Nested evidence.
- `src/soft-folder-guide-geometry.ts` owns the dependency-free guide-island
  geometry shared by layout validation and React Flow rendering.
- `src/soft-radial-spread.ts` translates complete non-root module geometry
  around the fixed root after structural computation, then refreshes cardinal
  attachments and strict geometry-derived quality.
- `src/soft-folder-display.ts` owns strict sparse File-parent and flattened-layer
  intent, conservative reconciliation, the pure nested displayed tree,
  pre-compression Direct-parent snapshot, ancestor-only pass-through
  compression/provenance, the Focus-neutral grouping projection, action
  mutations, nearest-only scope, and normalized 1/3 or 1/4 ancestor weights. It
  contains no storage, renderer, or source-provider logic.
- `src/soft-cluster-fixtures.ts` owns SC1–SC24 and SC26–SC29 plus SC17–SC19
  stability pairs.
- `src/source-order.ts` derives public Dagre adjacent-sibling constraints from
  canonical source order.
- `src/settings.ts` owns the frozen spacing, reserve, clearance, and filtered
  placeholder policy.
- `src/selected.ts` maps the accepted A1 computed result to the compatible
  selected candidate/attempt API.
- `src/worker-protocol.ts` owns the version-13 exact-shape production messages,
  macro/strength/scope/decay/display-intent policy normalization, cardinal and
  Soft Compass evidence, and originating-input result validation. Version 13
  and Soft evidence schema 8 add Focus-neutral Nested hierarchy/coverage
  evidence and post-Nested quality metrics while radial spread stays outside
  worker input.
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
