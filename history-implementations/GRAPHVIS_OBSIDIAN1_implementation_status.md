# GRAPHVIS-OBSIDIAN1 implementation report

Status: **implemented and validated; ready for native user QA.** The integration
PR is intentionally unmerged until the requested subjective appearance review.

## Obsidian evidence

The reference audit used the extracted Obsidian **1.11.5** package at
`C:\Users\leona\AppData\Local\Temp\icarus-obsidian-extract-1.11.5-20260904-083915`.
The inspected resources were `formatted/app.pretty.js`, `formatted/sim.pretty.js`,
`extracted/obsidian/app.css`, and `extracted/obsidian/package.json`. Stable source
tokens, formulas, CSS-variable chains, and remaining uncertainties are recorded
in `docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md`.

Obsidian anchors labels at `(0.5, 0)`, positions ordinary text at the node center
plus `(radius + 5) * nodeScale` vertically, and uses the system UI font stack at
`14 + radius / 4` pixels. Its default dark Graph surface resolves to `#1e1e1e`,
with labels `#dadada`, ordinary nodes `#b3b3b3`, edges `#3f3f3f`, focused
nodes/rings `#a68af9`, and hover/highlight fill `#8a5cf5`. Unresolved nodes use
`#666666` at 0.5 opacity; tag and attachment colors resolve to `#44cf6e` and
`#e0de71`. Highlighting uses an accent node/ring without a white text box.

Obsidian's highlighted label can move slightly farther down. Icarus deliberately
keeps the same anchor in ordinary, hover, and selected states so interaction does
not cause a label jump. Sigma's one-line canvas API also cannot reproduce Pixi
word wrapping exactly; Icarus retains a centered single line capped to the same
300-pixel width.

## Icarus implementation

- `network-label.ts` owns one All/Focus canvas drawer and placement policy. It
  centers qualifying labels below rendered nodes, preserves the five-pixel gap,
  and uses `min(14 + renderedRadius / 4, renderedDiameter)` so Icarus's smaller
  nodes still satisfy the required font-size invariant.
- `GlobalRendererSession` and `LocalRendererSession` install that same label and
  hover drawer. Existing label thresholds, semantic LOD, forced labels, and
  `hideLabelsOnMove: false` remain unchanged.
- `network-theme.ts` owns the evidence-backed dark Graph tokens and shared system
  font. All and Focus canvases identify the `obsidian-dark` theme explicitly.
- Node/edge reducers use the Obsidian base language while preserving Icarus
  unresolved, ambiguous, invalid, hierarchy/reference, scope, Arrange Folders,
  and Visual Group meanings. Explicit Visual Group colors are not mutated.
- Dark styling is confined to the Network graph surface, its empty/status states,
  viewport controls, and arrangement indicators. The application shell,
  sidebars, Inspector, and Hierarchy views are outside this change.

## Regression proof

This change alters renderer constants, reducers, canvas drawers, and graph-local
CSS only. It changes no graph projection, topology, position, ForceAtlas2,
continuous physics, spatial influence, camera, cache, or persistence input.
Existing position/camera tests remained green. The Global renderer visual
operation contract reported **0 projection, 0 topology, 0 layout, and 0
coordinate writes**, with exactly one Sigma visual refresh. The Local renderer
benchmark's layout-toggle oracle reported **0 unintended global layouts**, and
its coordinate-sensitive cases passed.

| Subsystem | Change caused by this task |
| --- | --- |
| Layout requests | 0 |
| PHYSICS1 jobs | 0 |
| Spatial-influence jobs | 0 |
| Coordinate applications | 0 |
| Camera reframes/policy | 0 |
| Cache identity/invalidations | 0 |
| Persistence writes/schema | 0 |

## Validation

- `pnpm install --frozen-lockfile` passed.
- Renderer-focused tests passed: **61 files / 466 tests**.
- Web tests passed: **95 files / 725 tests**.
- `pnpm benchmark:global-renderer -- --profile small` passed; example mapping
  median was 0.323 ms and graph build median was 0.154 ms.
- `pnpm benchmark:local-renderer -- --profile small` passed.
- `pnpm check` passed formatting, lint, all workspace typechecks, **268 files /
  2,213 tests**, and the production web build.
- `pnpm desktop:check` passed, including **16 Rust tests**.
- `pnpm desktop:build` produced a fresh optimized Windows executable.
- `git diff --check` passed.

Production-browser visual QA used persisted representative All and Focus Network
views from the built web bundle. Both canvases computed the exact `#1e1e1e`
surface. At fitted, zoomed-in, and zoomed-out scales, visible labels remained
centered below their nodes; small labels did not dominate their nodes; selected
All and Focus nodes gained accent rings without changing the text anchor or
adding a white callout; muted edges and ordinary/Visual Group/root colors remained
legible. Automated drawer tests additionally cover hover anchor equality, long
labels, small/large/enlarged nodes, and all viewport edges.

The available computer-use surface was browser-only, so the optimized native
window could not be inspected programmatically. Native desktop appearance is
therefore the explicit remaining user-acceptance item, not a claimed automated
pass.

## Native handoff

Fresh executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-graphvis-obsidian1\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
```

Size: **13,542,400 bytes**  
SHA-256: `BA90B832930F979E4DC70F5C398CD28034093094282F5CE3C0B3FA56FBAC50C7`

Side-by-side acceptance checklist:

1. Compare ordinary, small, and high-degree File nodes in Obsidian dark Graph,
   Icarus All Network, and Icarus Focus Network.
2. At far, normal, and close zoom, confirm labels stay centered underneath and
   never visually exceed node diameter.
3. Hover and select nodes; confirm the label does not jump and no white callout
   appears.
4. Confirm muted edges, ordinary nodes, focused/root accents, diagnostics, and
   Visual Group colors remain distinguishable.
5. Exercise Move and Arrange Folders and inspect labels near every canvas edge.

