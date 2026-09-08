# PRE-HIER4B Folder strips and Direct edges

## Status

Complete. This renderer correction makes accepted HIER4A Directional Folder
Bands visible in Modular Focus Hierarchy and changes its default connection
presentation to Direct. It does not begin HIER4B or HIER5, and Classic Focus
Hierarchy remains unchanged.

## Delivered behavior

`computed.folderBandPlan.bands` is the sole strip truth. Each visible plan band
keeps its exact `topY`, `bottomY`, `centerY`, height, root identity, and
singleton status. The renderer derives one modestly padded shared X extent from
the final React Flow rectangles, then draws a pointer-inert world-space strip
behind edges and nodes. Root is shown as `Root folder`; nested labels retain
their normalized workspace-relative folder keys. Filtered folders cannot leak
because the validated plan omits them.

Modular Preview persists `Folder strips` (default On) and `Connection style`
(default Direct) under the existing v1 graph-preferences record. Both settings
are disabled under Classic. Switching strips changes only the overlay. Switching
Direct/Electronic changes only the React Flow path and label anchor: Direct uses
`getStraightPath`; Electronic retains `getSmoothStepPath`. Existing exact
handles, identity, status, marker, reference-count, hover, selection, secondary
visibility, and viewport behavior remain intact.

## Evidence

Focused renderer, preference, settings, and hierarchy-availability validation
passed with 86 tests. Browser QA verified default strips and Direct, both
Sandbox alternatives, and a clean console. The optimized Tauri release
executable built successfully and received native approval.

The complete `pnpm check` gate passed: formatting, lint, every workspace
typecheck, 1,628 tests, and the web production build. `pnpm desktop:check` and
`pnpm desktop:build` also passed. The web build reports its existing
over-500 kB chunk advisory without failing the build.

## Scope boundary

HIER4B remains the next work: Soft Folder Clusters beyond exact categorical
bands. HIER5 still owns advanced Electronic routing, rounded styling, channels,
obstacle avoidance, parallel-edge separation, and distinct hit targets.

## Reproducibility

The exact implementation prompt is archived as
`history-implementations/PRE_HIER4B_folder_strips_direct_edges_codex_prompt.md`.
Its SHA-256 is:

```text
E63FB935BB078589F12FAA80D33CD1FD996997C38FE25F8480836D7D57E8A682
```
