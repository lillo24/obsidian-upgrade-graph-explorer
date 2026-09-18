# THEMESYS2 implementation report

Status: **implemented and validated.** Network is now an explicit two-theme
surface. All Network and Focus Network consume the same resolved application
theme, while the previously approved dark presentation remains the compatibility
baseline.

## Obsidian light evidence

The light palette was resolved from the extracted Obsidian **1.11.5** package at
`C:\Users\leona\AppData\Local\Temp\icarus-obsidian-extract-1.11.5-20260904-083915`.
The inspected source of truth was `extracted/obsidian/app.css`; the complete
CSS-variable chains and Icarus adaptations are recorded in
`docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md`.

| Role | Obsidian light / Icarus value |
| --- | --- |
| Graph background | `#ffffff` |
| Ordinary edge | `#d4d4d4` |
| Hierarchy edge adaptation | `#ababab` |
| Label | `#222222` |
| Ordinary node | `#5c5c5c` |
| Unresolved base / rendered | `#ababab` / `rgba(171, 171, 171, 0.5)` |
| Focused node/ring | `#8a5cf5` |
| Hover/highlight | `#9873f7` |
| Tag / attachment | `#08b94e` / `#e0ac00` |
| Ambiguous / invalid | `#ec7500` / `#e93147` |
| Section / block adaptations | `#7852ee` / `#707070` |

The dark palette remains byte-for-byte compatible with the approved
GRAPHVIS-OBSIDIAN1/2 values. Persisted Visual Group colors remain exact in both
themes.

## Generic renderer contract

`packages/renderer-sigma/src/network-theme.ts` owns the generic `NetworkTheme`
contract, `OBSIDIAN_LIGHT_NETWORK_THEME`, `OBSIDIAN_DARK_NETWORK_THEME`, and the
`networkThemeFor(resolvedTheme)` selector. Renderer consumers receive the
already-resolved application theme explicitly; they do not read storage, media
queries, or DOM state as an alternate authority.

Both session types accept the resolved theme at construction and expose
`setTheme`. All and Focus canvases preserve the current session while forwarding
theme changes to that method. A change updates Sigma color settings and performs
one style-only refresh with indexation skipped. It does not recreate Graphology,
restart ForceAtlas2, request spatial influence, write coordinates, reset the
camera, invalidate topology/layout caches, or persist graph state.

Theme-aware reducers cover ordinary and semantic nodes, hierarchy/reference and
diagnostic edges, labels, incident-edge hover interpolation, unresolved and
diagnostic states, Visual Groups, Arrange Folders, empty/status states, and the
Network viewport controls. Neutral incident edges move toward the current
theme's highlight; semantic hues brighten on dark and darken on light so their
hue and contrast remain legible. Existing label sizing, zoom fade, forced-label
rules, truncation, and hover motion are unchanged except for their theme color.

## Regression proof

Automated dark→light→dark tests retain the same renderer session and
Graphology object. They assert exact node coordinates, camera state, non-color
presentation fields, hover progress, label size/fade behavior, layout counters,
and graph mutation counts across the switch. The benchmark visual operation
contract reports **0 projection requests, 0 topology mappings, 0 Graphology
reconciliations, 0 layout requests, and 0 coordinate writes**, with exactly one
Sigma visual refresh.

| Subsystem | Change caused by a theme switch |
| --- | --- |
| Renderer/session remounts | 0 |
| Layout or PHYSICS1 jobs | 0 |
| Spatial-influence jobs | 0 |
| Coordinate applications | 0 |
| Camera mutations | 0 |
| Topology/cache identity changes | 0 |
| Persistence writes/schema changes | 0 |

## Graphical QA

Live production-browser QA exercised All Network and Focus Network in light and
dark modes, normal zoom, Fit, selection, Visual Groups, and Arrange Folders.
Light mode retained readable dark labels, restrained neutral edges, distinct
diagnostics, purple focus/selection emphasis, and exact group accents. Dark mode
retained the approved baseline. Arrange spotlight, target, panel, scope, and
viewport-control treatments remained legible in each theme. Automated coverage
additionally exercises hover progress, fade thresholds, diagnostic states, Move
invariance, and exact camera/position preservation.

## Validation

- Renderer tests passed: **64 files / 506 tests**.
- Web tests passed: **98 files / 751 tests**.
- Both requested small renderer benchmarks passed, including the style-only
  operation contract.
- `pnpm check` passed formatting, lint, workspace typechecks, **277 files /
  2,320 tests**, and the production web build.
- `pnpm desktop:check` passed, including **16 Rust tests**.
- `pnpm desktop:build` produced a fresh optimized Windows executable.
- `git diff --check` passed.

## Native handoff

Fresh executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
```

Size: **13,558,784 bytes**

SHA-256: `D0387467DA5931DE772296251875B8647DA370117D728E660C9F36F73721AC86`
