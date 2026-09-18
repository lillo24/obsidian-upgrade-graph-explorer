# HIER4B validation

Status: **HIER4B-SPACING-FIX4 CANDIDATE — mandatory immediate-folder unity in PR #106 awaits native graphical approval.**

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
flattening, layer restore, ancestor-only pass-through compression, deep chains, meaningful
two-unit folders, visibility changes, disclosure invariance, manual/automatic
provenance, workspace isolation, and stale intent. Directional isolation is
covered by the worker/runtime oracle as N18.

The selected compression rule suppresses a non-root folder only when it has no
direct visible Files and exactly one child folder after manual intent. Empty
visible layers are pruned. The transformation repeats through ancestor-only
pass-through chains and stores no automatic result. Any folder with a direct
visible File remains, including a named singleton.

## Guide and interaction cases

Renderer tests prove bottom-up parent containment, direct File plus child-guide
enclosure, short hierarchy labels, ancestor islands, bounded fixed padding,
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

The earlier guide FIX4 adds LR1–LR10 renderer cases for one-child-folder suppression, the reported
`Integrating the ideas/Cure Framework` split, invalid far same-folder singleton
islands, File-plus-child and two-child useful parents, recursive local chains,
mixed visible/suppressed islands, pass-through parent geometry, surviving-child
hit testing, and cold determinism. Any immediate named folder with a direct File
renders, including singletons; one-unit suppression applies only to ancestor
wrappers without direct Files. Suppressed regions never enter the returned guide list,
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
formerly disconnected immediate groups, and topology opposing nesting. Hard gates require no
overlap, deterministic output, exact crossing evidence, bounded fixed schedule,
and maximum total folder weight per File no greater than one. H1 keeps child
coherence stronger while still supplying parent coherence. Strength 0 creates
no attraction force, while mandatory immediate-folder cohesion remains active.

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
flattening but before automatic ancestor pass-through compression. D1–D7 cover a deep
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
component tests, 10 layout-cache tests, and the complete 272-file/2293-test
`pnpm check` gate. The Soft benchmark passes all hard gates across 135 fixture,
15 stress, 21 hierarchy-force, 35 hierarchy-strength, 32 Compass-demand, and 40
Compass-strength rows. Desktop Rust check/test and the optimized release build
also pass. The QA executable is
`output/hier4b-spacing-fix2-native-candidate.exe`; its SHA-256 is
`17C0ECB73361FC46303ABA6BA5CA11B8B80EFD9583BFEE6D1E856067375893FC`.

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

## HIER4B-SPACING-FIX3B candidate

FIX3 demonstrated that applying rigid centroid spread directly to the prior
SC14 structural result was unsafe: the exact fixture produced 11 cross-folder
overlaps over the sampled slider range, including Target5 with Target7 at 25.
FIX3B adds one structural immediate-folder body pass before radial spacing.
Named folders use their exact member rectangle list as a rigid compound;
workspace-root Files are structural singletons; and the Focus-containing body
is fixed. The nearest safe whole-body translation is selected by stable body
order, 72 px rings, and 48 deterministic angular samples. No member moves
inside its body.

The authoritative oracle solves horizontal and vertical affine overlap
intervals for every cross-body rectangle pair, including the 16 px clearance,
and rejects any intersection over scale `[1.0, 2.4]`. It validates both the
default root-singleton partition and the optional Workspace-root aggregate.
The radial postprocess remains a pure group-centroid translation and runs no
collision resolver or discrete packing. SC14 is overlap-free at every integer
slider value and at the exact continuous gate; 71/72/73 changes only the smooth
translation. Before FIX4, SC23 retained its topology-split member vectors
exactly; FIX4 intentionally supersedes that behavior.

The generated bakeoff passes all hard gates. At strength 50, SC14 moves two of
four bodies, with mean translation 72 px, P95/max 144 px, zero safety
violations, and zero exact endpoint crossings before and after packing. Its
bounds area changes from 1,542,357 to 1,763,192 square pixels; connected-pair
mean changes from 702.58 to 762.94; and exact primary endpoint span mean changes
from 522.19 to 596.84. Across 135 fixture/strength rows, mean packing overhead
is about 0.24 ms. The largest absolute bounds change is SC21 strength 0:
4,834,890 to 11,222,802 square pixels (2.32x), paired with 22 fewer exact
crossings. The worst mean connected-pair increase is 206.86 px and the worst
hop-radius error increase is 141.52 px, both explicitly retained for founder
graphical review rather than hidden by thresholds.

`Include workspace root group` defaults Off. Off emits no `.` guide or product
folder label. On uses `Workspace root` and changes only renderer guide/radial
grouping; it is excluded from projection, model, worker request, structural
layout, and cache identity. Saved View application preserves the current
preference because it is not a view-profile field.

Soft structural algorithm/cache version 9 invalidates prior Soft geometry.
The FIX3B candidate used worker protocol 11 and Soft evidence schema 6 for exact group-packing and
pre/final structural-quality evidence. Directional algorithm version 4 and its
reference hashes are unchanged.

Focused validation passes 160 layout tests, 127 renderer tests, 172 web
component tests, and 91 preference/cache tests. The updated benchmark decision
is `REQUIRES_GRAPHICAL_REVIEW` with `hardGatesPass: true`.

The complete repository gate passes 276 test files / 2,335 tests plus
formatting, lint, all workspace typechecks, and the production web build.
Desktop formatting/check, 16 Rust tests, and the optimized release build pass.
The QA executable is
`output/hier4b-spacing-fix3b-structural-group-packing-native-candidate.exe`;
its SHA-256 is
`FDD5114D71ED69DB79E7BFCFD4845B69E29F61A032AD7D607F7535766D3008F9`.

The exact FIX3B prompt is archived at
`history-implementations/HIER4B_SPACING_FIX3B_structural_folder_group_packing_codex_prompt.md`.
Its SHA-256 is
`52EB3A287AAD67912FB2AB997B5569523F35D581FAF38D3A9B2BCF102041741E`.

## HIER4B-SPACING-FIX4 candidate

FIX4 changes the Soft priority order: immediate named-folder identity and unity
now outrank topology splitting, while ancestor folders remain soft. After the
fixed `[36, 18]` relaxation, a deterministic whole-module pass compacts each
post-manual/pre-compression immediate group around its existing centroid. A
Focus-containing group keeps the Focus module fixed. Module dimensions and all
File/Heading/Block offsets remain unchanged. FIX3B then packs those coherent
groups and proves continuous radial safety before the renderer-only spread.

Layout and renderer share the exact 216 px guide-connectivity, 24 px hull
padding, and blocker-swallowing oracle. Named-folder envelopes become padded
structural obstacles, so an unrelated File cannot sit inside a direct-folder
hull. The final structural hard gate is zero immediate-folder split violations.
The renderer rejects a structurally split immediate folder rather than drawing
duplicate same-name regions. Nested mode always renders an immediate folder
that owns a direct File, including a singleton; workspace-root Files remain
ungrouped when the existing option is Off.

SC5 and SC23 now assert unity rather than topology-approved splitting. The
benchmark passes 135 fixture/strength rows, 15 hub stress rows, 21 hierarchy
policy rows, 35 hierarchy-strength rows, 28 scope/decay rows, 32 Compass rows,
and 40 Compass-strength rows with `hardGatesPass: true`. Across fixture rows,
the cohesion stage reduces mean bounds area by about 410,250 square pixels and
mean connected-pair distance by about 32 px. Its worst hop-radius cost is SC5
at strength 0 (+456.25 px); SC5 adds one crossing, while SC23 adds none. The
largest final/pre-cohesion bounds ratio is 1.44x for SC21 at strength 100, so
the bounded packing shows no pathological canvas explosion.

Soft structural algorithm/cache version 10 invalidates prior Soft geometry.
Worker protocol 12 and Soft evidence schema 7 add cohesion movement/radius/
pair-distance metrics plus pre/post-cohesion topology quality. Directional
algorithm version 4, Adaptive Compass assignment/search, the root-neutral force
rule, and secondary zero-influence behavior are unchanged.

The exact FIX4 prompt is archived at
`history-implementations/HIER4B_SPACING_FIX4_immediate_folder_unity_codex_prompt.md`.
Its SHA-256 is
`522CDB10D878622C1EEDC5DA852F32E524BF3C25D5D804C55367EDBC600147E0`.

The complete repository gate passes 280 test files / 2,374 tests plus
formatting, lint, all workspace typechecks, and the production web build.
Desktop formatting/check, 16 Rust tests, and the optimized release build pass.
The QA executable is
`output/hier4b-spacing-fix4-immediate-folder-unity-native-candidate.exe`;
its SHA-256 is
`81848929DD3BADF070C62CEAEF5DB423FC33CD4CBC288C9E7BA6286D3D21B9F8`.
