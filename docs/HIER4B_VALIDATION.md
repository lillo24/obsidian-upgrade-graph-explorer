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
- the root File stays centered and all final variable module rectangles remain
  non-overlapping.

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
