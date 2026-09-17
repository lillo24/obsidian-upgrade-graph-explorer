# HIER4B validation

Status: **MERGED HIER4B IMPLEMENTATION — PATCH1 Adaptive Compass compatibility implemented and awaiting graphical approval.**

HIER4B evidence remains synthetic and development-only. Directional Folder
Bands is the unchanged reference and default. Soft Folder Clusters is merged on
`main`; remaining work is tracked as focused graphical-quality patches.

## QA state before PATCH1

Graphical review accepted the nested Soft hierarchy, singleton-chain
compression, File promotion and folder flattening, passive folder labels,
File-only module-boundary suppression, redundant region-wrapper suppression,
folder-area right-click, composed File plus containing-folder menus, and
four-side File ports. Those items are no longer pending.

Adaptive Compass compatibility with Soft Folder Clusters is awaiting review of
PATCH1. `HIER4B-SPACING`, `HIER4B-UNIFIED-REGIONS`, and `MODULAR-CONTEXT1` remain
separate later work.

## Hard regression boundaries

Automated tests verify:

- Directional output remains byte-identical when a request carries nonempty
  Soft File-parent and flattened-layer intent; its cache key erases that intent.
- exact source folder keys and stable File identity remain immutable;
- stale manual intent reconciles without path/rename guesses or cross-workspace
  reuse;
- query-hidden File intent survives until that File becomes visible again;
- Heading disclosure leaves display-tree identity unchanged;
- Secondary connections retain zero geometry influence;
- Soft File/module anchors retain final-geometry left/right/top/bottom ports;
- Direct and Electronic consume identical selected handles;
- the root File stays centered, remains visible in folder membership, is
  excluded from every folder-attraction force group, and all final variable
  module rectangles remain non-overlapping.

## Root-neutral Compass Lab update

The PATCH1 lab now runs against the merged root-neutral Soft solver and includes
SC26–SC28 from the shared fixture catalog. Folder hulls retain the root's
truthful visible exact-folder membership. Attraction centroids use eligible
non-root Files only, and the root module is labeled `DISPLAY MEMBER ·
FORCE-NEUTRAL`. SC26 shows that a root plus one peer cannot create an attraction
group; SC27 shows two peers attracting around their own centroid; SC28 covers
normalized-decay ancestor scopes. These scenarios display strengths 0, 25, 50,
75, and 100 side by side. Soft cache algorithm version 8 separates the combined
root-neutral, spatial-Compass, scope/decay, and fixed structural geometry from
the earlier branches; radial spread remains outside this identity.

## Display-tree cases

`soft-folder-display.test.ts` covers N1–N17: nested parent/child folders,
single-File and repeated promotion, exact restore, one-layer and sibling
flattening, layer restore, one-child-unit compression, deep chains, meaningful
two-unit folders, visibility changes, disclosure invariance, manual/automatic
provenance, workspace isolation, and stale intent. Directional isolation is
covered by the worker/runtime oracle as N18.

The selected compression rule suppresses a non-root folder only when it has
exactly one direct displayed child unit after manual intent. Empty visible
layers are pruned. The transformation repeats to a meaningful branching level
and stores no automatic result.

## Guide and interaction cases

Renderer tests prove bottom-up parent containment, direct File plus child-guide
enclosure, short hierarchy labels, disconnected islands, bounded fixed padding,
determinism, parent/sibling emphasis, compressed ancestry text, pointer-inert
hulls, and removal of the old toolbar. HT1–HT10 cover actual rounded-region
hits, parent/child and depth-3+ priority, parent-only space, disconnected
regions, area/stable tie-breaks, React Flow screen-to-world conversion, node
priority, label targeting, and the Guides-off empty input.

Shared-menu and GraphCanvas tests cover right-click plus Shift+F10/ContextMenu
entry, semantic separators, disabled actions, keyboard traversal, Escape and
outside dismissal. MC1–MC7 prove one composed File menu, separator omission,
folder-only menus, current displayed-parent targeting after promotion and
compression, root behavior, and pointer/keyboard parity. FM1–FM5 preserve
folder pointer/keyboard actions and inert hulls. L1–L8 cover short names, parent
hints, accessible normalized keys, repeated island names, displayed depth
updates, and the bounded `3+` style. Menu and hover state remain absent from
layout policy/cache input.

POLISH1 renderer tests cover File-only root and non-root boundaries, currently
visible Heading and Block structure, collapsed-to-expanded boundary changes,
unchanged worker geometry, retained hidden handles, passive primary-label CSS,
quiet parent hints, matching repeated-region typography, keyboard focusability,
focus-visible styling, and both Shift+F10 and ContextMenu-key entry. The existing
HT, MC, FM, and L suites continue to cover empty guide-area targeting, deepest
nested hits, label right-click, focus restoration, and split-region labels.

FIX4 adds LR1–LR10 renderer cases for one-child-folder suppression, the reported
`Integrating the ideas/Cure Framework` split, two far same-folder singleton
islands, File-plus-child and two-child useful parents, recursive local chains,
mixed visible/suppressed islands, pass-through parent geometry, surviving-child
hit testing, and cold determinism. Every named rendered region records at least
two direct visual units. Suppressed regions never enter the returned guide list,
so renderer labels, hover/context controls, and area hit testing cannot select
them. The existing root-direct-File policy remains covered separately.

## Hierarchy-force bakeoff

The generated benchmark compares:

```text
H0 — nearest displayed folder only
H1 — normalized decaying ancestor weights (selected)
H2 — normalized equal ancestor shares
```

HFA1–HFA7 cover a parent direct File plus nested child, sibling nested folders,
depth three, promoted File, flattened parent with surviving grandchild,
disconnected islands, and topology opposing nesting. Hard gates require no
overlap, deterministic output, exact crossing evidence, bounded fixed schedule,
and maximum total folder weight per File no greater than one. H1 keeps child
coherence stronger while still supplying parent coherence. Strength 0 creates
no folder force.

The current benchmark passed:

- 120 SC1–SC24 strength rows;
- 15 hub stress rows;
- five manual display-intent profiles;
- 21 HFA1–HFA7 policy rows;
- 35 HFA1–HFA7 strength rows;
- three cardinal attachment geometry profiles.
- 32 AC-S1–AC-S8 demand/control rows;
- 40 AC-S1–AC-S8 strength rows;
- eight Adaptive/Vertical macro-perturbation rows.

Decision state remains `REQUIRES_GRAPHICAL_REVIEW`.

## PATCH1 Adaptive Compass consistency

AC-S1–AC-S8 isolate four-cardinal, vertical, horizontal, mixed, neutral,
crossing-guard, semantic no-op, and second-pass adaptation cases. The D0
directional-horizontal classifier can treat an above or below counterpart as a
left/right demand because it only compares module X. S1 and S2 instead classify
the current counterpart rectangle in four deterministic cardinal sectors.

S1 dominant-cardinal count is selected over S2 aggregate vector. AC-S4 places
two diagonally-above authored targets and one right target: S1 selects top,
while S2 selects right. At strength 50 both have zero crossings, but S1 has the
lower primary Manhattan span and bounds area. Reference multiplicity is read
from the endpoint connection's authored reference IDs, so coalescing does not
erase the majority signal.

Across the eight strength-50 patch fixtures, D0, S1, and S2 all retain zero
crossings and zero adjacent-rank inversions. Spatial demand matches improve from
13/21 in D0 to 19/21 in both spatial strategies. S1 then beats S2 on aggregate
primary Manhattan span (`13632.431` vs `13681.537`) and bounds area
(`5084021.965` vs `5157012.856`) with the same 138 Compass assignments and five
pass-to-pass region changes. The two unmatched S1 branches are recorded hard
guard overrides rather than unexplained misses.

The candidate score keeps exact crossings, adjacent-rank inversions, and
internal hierarchy crossings ahead of cardinal-demand matching. AC-S6 records
one crossing-driven demand override: the second pass replaces a fully matched
lateral arrangement with one exact crossing by a partly vertical zero-crossing
arrangement. AC-S8 records three region changes and improves pass-two demand
matches from 4 to 7, crossings from 11 to 0, and primary Manhattan span from
6607.329 to 4519.329. This evidence supports retaining both bounded passes.

AC-S7 produces identical Adaptive and Vertical internal regions, node
rectangles, and module bounds. Its final Soft node/module rectangles and every
File center are also identical, proving that variant/config labels alone do not
perturb the macro layout. AC-S1 supplies the contrasting legitimate case:
regions, node rectangles, and root-module bounds differ, so non-root File-center
movement is expected.

The Directional isolation oracle hashes candidate geometry, attachments,
folder bands, and quality for DB5, DB11, DB12, FB4, DB14, and DB19 against the
merged `bfc4b1c` baseline. All six SHA-256 values remain byte-identical. The
shared Compass engine still owns both policies; no algorithm copy or dependency
was added.

## HIER4B-SPACING-FIX1 candidate

The corrected candidate freezes the evidence-selected moderate structural
policy at 600/88/180/72/104 macro values and 30/60/34/30 internal values. The
solver still uses the fixed `[36, 18]` schedule. Soft spacing is measured only
as a post-layout radial scale: 0 = 1.0×, 50 = 1.7×, and 100 = 2.4×. The direct
71/72/73 regression proves identical module sizes, node-to-module offsets,
angular order, branch/crossing evidence, and base structural result; coordinates
differ only by the expected continuous root-relative scale. The web cache test
observes one structural compute across repeated radial changes.

Nested scope now has normalized 1/3 and 1/4 decay rows. Two-scope weights are
`.75/.25` and `.80/.20`; three-scope weights are approximately
`.6923077/.2307692/.0769231` and `.7619048/.1904762/.0476190`. Direct-only
selects one nearest displayed scope and produces identical cache identity for
stored base 3 or 4. All force evidence excludes the root before active group
assembly while display membership and guides retain it. Direct-guide tests show
that parents with direct Files remain independently targetable and never wrap
child-folder regions; switching modes leaves the display tree and intent byte
identical.

The generated benchmark passes its aggregate hard gate and remains
`REQUIRES_GRAPHICAL_REVIEW`. It covers 135 fixture/spacing rows, 15 hub stress
rows, 21 hierarchy-force rows, 35 hierarchy-strength rows, 28 scope/decay rows,
32 Compass-demand rows, 40 Compass-strength rows, the 3×3 strength/spacing
matrix, secondary and permutation identity, root centering, containment,
determinism, overlap freedom, bounded per-File folder weight, and unchanged
Directional reference hashes. AC-S4 now records its legitimate second-pass
region change in the macro perturbation diagnostic instead of misclassifying
it as a first-pass semantic no-op; production geometry is unchanged.

Native graphical QA remains required before merge.

## HIER4B-SPACING-FIX2 candidate

The native slider appeared inert because radial spread changed candidate and
attachment coordinates while leaving endpoint and folder-band quality derived
from the base geometry. Strict renderer preparation rejected spacing 50 and
100 with `Computed layout is invalid: Endpoint quality does not match computed
geometry.` The component's broad catch then silently returned the unspread
adopted graph. FIX2 recomputes cardinal attachments and only the
geometry-derived quality fields after translation. The structural Soft result,
Adaptive Compass decisions, force relaxation, packing, and cache entry are
reused. A remaining presentation failure now exposes its error while retaining
the validated adopted graph.

Renderer and web presentation regressions execute the complete structural Soft
result → radial transform → strict renderer preparation seam at 0/50/100. They
verify fixed root geometry, increasing non-root radius, changed prepared React
Flow positions, valid edge handles, and one structural compute. Existing
71/72/73 and cache tests retain continuous scale and spread-independent cache
identity.

Direct scope now captures every File's parent after manual promotion and folder
flattening but before automatic singleton compression. D1–D7 cover a deep
singleton chain, distinct parent/child immediate folders, a named singleton
guide, promotion, flattening, genuine root membership, and root-neutral force.
Nested memberships and the final compressed display tree remain unchanged.
Direct guide context actions resolve against the same pre-compression folder
projection.

Guide L1–L5 cover steep diagonal hulls, rounded rectangles, singleton fallback,
permutation determinism, and disconnected regions. Labels use the uppermost
visible horizontal straight segment derived from the rounded path itself.
Folder-strength behavior is unchanged and remains future work for dense graphs.

Final local validation passes 159 layout tests, 127 renderer tests, 171 web
component tests, 10 layout-cache tests, and the complete 270-file/2264-test
`pnpm check` gate. The Soft benchmark passes all hard gates across 135 fixture,
15 stress, 21 hierarchy-force, 35 hierarchy-strength, 32 Compass-demand, and 40
Compass-strength rows. Desktop Rust check/test and the optimized release build
also pass. The QA executable is
`output/hier4b-spacing-fix2-native-candidate.exe`; its SHA-256 is
`893E63D938C79E50C4B883F81E40D06010C3D3998E2DD326E6A4A18F247C5BFC`.

## Commands

```text
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm benchmark:focus-schematic-soft-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile small --macro soft-folder-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile medium --macro soft-folder-clusters
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Privacy and traceability

Tests and benchmark fixtures are synthetic. The renderer consumes visible HIER1
membership only. Persisted records contain stable File IDs and normalized
workspace-relative folder keys, never absolute paths, source contents, hidden
guide membership, geometry, or screenshots.

The exact FIX3 prompt is archived at
`history-implementations/HIER4B_FIX3_folder_area_context_labels_codex_prompt.md`.
Its SHA-256 is
`ED4E49B0AC25C252B246623740BF9E86D9D400DCD81C3453C52D88B8AE4956A9`.

The exact POLISH1 prompt is archived at
`history-implementations/HIER4B_POLISH1_empty_module_boundaries_passive_folder_labels_codex_prompt.md`.
Its SHA-256 is
`98F59BE92FB9CD6CF04057909692D802900AE2350F556751A723AD3436EA7620`.

The exact FIX4 prompt is archived at
`history-implementations/HIER4B_FIX4_post_island_redundant_wrapper_suppression_codex_prompt.md`.
Its SHA-256 is
`1F37791ACB26EB860419F5533299DD9DBAFACF4BF55546451C7F6F0A167EE08A`.

The exact PATCH1 prompt is archived at
`history-implementations/HIER4B_PATCH1_soft_adaptive_compass_consistency_codex_prompt.md`.
Its SHA-256 is
`9C43FC2C51C0F71D9F3E862BB7EF5377868D17202B319010BC3D8E5D684A8458`.

The exact HIER4B-SPACING prompt is archived at
`history-implementations/HIER4B_SPACING_soft_cluster_bakeoff_sandbox_slider_codex_prompt.md`.
Its SHA-256 is
`23845CB4420871AB06AEA263627C79636391EDF7D2EC2410387B2AC86146934C`.

The exact HIER4B-SPACING-FIX2 prompt is archived at
`history-implementations/HIER4B_SPACING_FIX2_spread_adoption_direct_parent_labels_codex_prompt.md`.
Its SHA-256 is
`75B852EA005DB43973247D439B53B8D8B8148CAFACFBEA884E3FCC3304C1D0F5`.
