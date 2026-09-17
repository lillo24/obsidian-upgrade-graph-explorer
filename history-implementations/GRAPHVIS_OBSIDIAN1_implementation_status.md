# GRAPHVIS-OBSIDIAN1 implementation report

Status: **implemented and validated; ready for native user QA.** The integration
[PR #110](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/110)
is intentionally unmerged until the requested subjective appearance review.

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

The GRAPHVIS-OBSIDIAN1B follow-up recovered Obsidian's exact zoom-opacity path:
`textAlpha = clamp(log2(rendererScale) + 1 - textFadeMultiplier, 0, 1)`.
The default multiplier is 1, and highlighted text bypasses that fade. Because
Obsidian's effective rendered node/text size grows with `sqrt(rendererScale)`,
its default scale 1–2 fade maps to a rendered-size window of 1–`sqrt(2)`.

## Icarus implementation

- `network-label.ts` owns one All/Focus canvas drawer and placement policy. It
  centers qualifying labels below rendered nodes, preserves the five-pixel gap,
  and uses `min(14 + renderedRadius / 4, renderedDiameter)` so Icarus's smaller
  nodes still satisfy the required font-size invariant.
- The same module now adapts Obsidian's recovered logarithmic fade to Sigma's
  current hard threshold as
  `clamp(2 * log2(renderedRadius / threshold), 0, 1)`. Ordinary labels are
  transparent at the threshold, reach full opacity at `sqrt(2) * threshold`,
  and remain hard-culled below the threshold by Sigma. The window follows each
  session's live Label Threshold rather than a fixed default.
- Existing forced-label states—including selected, hovered, Focus root,
  arrangement members, and always-labelled small graphs—bypass zoom fading and
  stay fully opaque. Hover uses the same geometry and font as ordinary drawing.
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
- Renderer-focused tests passed: **61 files / 474 tests**.
- Web tests passed: **95 files / 726 tests**.
- `pnpm benchmark:global-renderer -- --profile small` passed; example mapping
  median was 0.262 ms, graph build median was 0.111 ms, and visual label
  threshold median was 0.039 ms. Its visual operation contract recorded zero
  projection, topology mapping, graph reconciliation, layout, and coordinate
  writes, with exactly one Sigma visual refresh.
- `pnpm benchmark:local-renderer -- --profile small` passed.
- `pnpm check` passed formatting, lint, all workspace typechecks, **268 files /
  2,229 tests**, and the production web build.
- `pnpm desktop:check` passed, including **16 Rust tests**.
- `pnpm desktop:build` produced a fresh optimized Windows executable.
- `git diff --check` passed.

Production-browser visual QA used persisted representative All and Focus Network
views from the built web bundle. Both canvases computed the exact `#1e1e1e`
surface. At fitted, zoomed-in, and zoomed-out scales, visible labels remained
centered below their nodes; small labels did not dominate their nodes; selected
All and Focus nodes gained accent rings without changing the text anchor or
adding a white callout; muted edges and ordinary/Visual Group/root colors remained
legible. In the Focus view, an ordinary label progressed from readable, through
faint and nearly transparent states, to clean culling over small wheel steps,
while the forced root and selected labels stayed fully readable. The persisted
All fixture contains only five nodes and therefore intentionally activates the
existing always-label-small-graph policy; ordinary All fading was instead
exercised with 309 nodes and 1,200 edges through the built production
`GlobalRendererSession` harness, where labels likewise appeared and disappeared
continuously as zoom crossed the live threshold. No label jump, flicker, hue
change, layout request, or camera reframe was observed. Automated drawer tests
additionally cover hover anchor equality, fade endpoints and midpoint, a moving
threshold, forced-label bypass, long labels, small/large/enlarged nodes, and all
viewport edges.

The available computer-use surface was browser-only, so the optimized native
window could not be inspected programmatically. Native desktop appearance is
therefore the explicit remaining user-acceptance item, not a claimed automated
pass.

## Native handoff

Fresh executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-graphvis-obsidian1\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
```

Size: **13,545,472 bytes**

SHA-256: `1F9CCAB695C86A41A0FC1D8F3F50644BA60312238BB505B90B8821C57A8A04AE`

Side-by-side acceptance checklist:

1. Compare ordinary, small, and high-degree File nodes in Obsidian dark Graph,
   Icarus All Network, and Icarus Focus Network.
2. Starting at normal zoom, zoom out slowly and confirm ordinary labels fade
   smoothly before disappearing instead of popping off abruptly.
3. At far, normal, and close zoom, confirm labels stay centered underneath and
   never visually exceed node diameter.
4. Hover and select nodes; confirm their forced labels remain fully readable,
   the label does not jump, and no white callout
   appears.
5. Confirm muted edges, ordinary nodes, focused/root accents, diagnostics, and
   Visual Group colors remain distinguishable.
6. Exercise Move and Arrange Folders and inspect labels near every canvas edge.
