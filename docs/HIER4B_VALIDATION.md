# HIER4B validation

Status: **HIER4B-FIX2 IMPLEMENTED — optimized graphical decision pending.**

HIER4B evidence remains synthetic and development-only. Directional Folder
Bands is the unchanged reference and default. No HIER4B adoption PR exists.

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
enclosure, hierarchy labels, disconnected islands, bounded fixed padding,
determinism, parent/sibling emphasis, compressed ancestry text, pointer-inert
hulls, and removal of the old toolbar.

Shared-menu and GraphCanvas tests cover right-click plus Shift+F10/ContextMenu
entry, disabled actions, keyboard traversal, Escape and outside dismissal.
Application action tests prove one File update, one folder-layer update,
sibling flatten, restore, root/exact disabled state, and reset availability.
Menu and hover state are absent from layout policy/cache input.

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

Decision state remains `REQUIRES_GRAPHICAL_REVIEW`.

## Commands

```text
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm benchmark:focus-schematic-soft-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
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

The exact FIX2 prompt is archived at
`history-implementations/HIER4B_FIX2_nested_folder_hierarchy_context_menu_codex_prompt.md`.
Its SHA-256 is
`97BA5BB86EDB21F22147AB091E386917117E287ACD496738AFA20BDDF3EA0DCE`.
