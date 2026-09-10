# HIER4B validation

Status: **HIER4B-FIX3 IMPLEMENTED — optimized graphical decision pending.**

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

The exact FIX3 prompt is archived at
`history-implementations/HIER4B_FIX3_folder_area_context_labels_codex_prompt.md`.
Its SHA-256 is
`ED4E49B0AC25C252B246623740BF9E86D9D400DCD81C3453C52D88B8AE4956A9`.
