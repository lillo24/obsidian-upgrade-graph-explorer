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

Obsidian's highlighted label targets 15 graph/display units farther down and
smooths with `next = old * 0.9 + target * 0.1`. Icarus preserves the same anchor
but adapts that motion to a subtle bounded few-pixel ease. Sigma's one-line
canvas API cannot reproduce Pixi word wrapping exactly; Icarus retains a
centered single line and uses measured ellipsis rather than glyph compression.

The GRAPHVIS-OBSIDIAN1B follow-up recovered Obsidian's exact zoom-opacity path:
`textAlpha = clamp(log2(rendererScale) + 1 - textFadeMultiplier, 0, 1)`.
The default multiplier is 1, and highlighted text bypasses that fade. Because
Obsidian's effective rendered node/text size grows with `sqrt(rendererScale)`,
its default scale 1–2 fade maps to a rendered-size window of 1–`sqrt(2)`.

## Icarus implementation

- `network-label.ts` owns one All/Focus canvas drawer and placement policy. It
  centers qualifying labels below rendered nodes. Sigma 3.0.3 supplies the
  camera-scaled radius while reducer data retains the logical presentation
  radius, so the renderer applies
  `min((14 + logicalRadius / 4) * renderedRadius / logicalRadius,
  renderedDiameter)` and scales the five-unit gap by the same ratio.
- The drawer measures the current-font width of
  `Creativity - Initiative - Curiosity.md`, binary-searches the longest Unicode
  code-point prefix that fits with `…`, and calls three-argument `fillText` at
  natural glyph width. Available viewport width can lower the budget further.
- The same module now adapts Obsidian's recovered logarithmic fade to Sigma's
  current hard threshold as
  `clamp(2 * log2(renderedRadius / threshold), 0, 1)`. Ordinary labels are
  transparent at the threshold, reach full opacity at `sqrt(2) * threshold`,
  and remain hard-culled below the threshold by Sigma. The window follows each
  session's live Label Threshold rather than a fixed default.
- Existing forced-label states—including selected, hovered, Focus root,
  arrangement members, and always-labelled small graphs—bypass zoom fading and
  stay fully opaque. Hover retains the same x/font/truncated text and moves y by
  at most 3 screen pixels or 35% of rendered radius over a 120 ms cubic
  ease-out. Reduced motion snaps to the hovered position.
- `GlobalRendererSession` and `LocalRendererSession` install that same label and
  hover drawer. Existing label thresholds, semantic LOD, forced labels, and
  `hideLabelsOnMove: false` remain unchanged.
- `network-theme.ts` owns the evidence-backed dark Graph tokens and shared system
  font. All and Focus canvases identify the `obsidian-dark` theme explicitly.
- Node/edge reducers use the Obsidian base language while preserving Icarus
  unresolved, ambiguous, invalid, hierarchy/reference, scope, Arrange Folders,
  and Visual Group meanings. Explicit Visual Group colors are not mutated.
- Outside Arrange Folders, unrelated nodes and edges retain their exact
  ordinary style during hover. Only directly incident edges brighten; neutral
  graph/hierarchy lines use `#8a5cf5`, while explicit semantic hex colors are
  lightened 28% toward white and retain their hue. Incident width increases by
  30%; the existing far-LOD direct-edge reveal remains intact.
- Dark styling is confined to the Network graph surface, its empty/status states,
  viewport controls, and arrangement indicators. The application shell,
  sidebars, Inspector, and Hierarchy views are outside this change.

## Click and Move arbitration

The double-click regression came from conflating a coordinator's primed
candidate with native drag ownership. Pointer down previously claimed capture
and suppressed Sigma before movement crossed the existing 3 px threshold.
The shared pointer owner now only arms on pointer down. The coordinator's exact
transition to `dragging` invokes `claim()`, starts PHYSICS1, and changes the
cursor from `pointer` to `grabbing`. Below-threshold single and double clicks
remain Sigma-owned, cause no physics begin or movement, and preserve canonical
activation with Sigma's default double-click zoom prevented. A real drag still
captures the pointer, continues across overlays, releases once, and suppresses
its trailing click.

## Regression proof

This change alters renderer constants, reducers, canvas drawers, and graph-local
CSS plus pointer ownership timing only. It changes no graph projection,
topology, position, ForceAtlas2,
continuous physics, spatial influence, camera, cache, or persistence input.
Existing position/camera tests remained green. The Global renderer visual
operation contract reported **0 projection, 0 topology, 0 layout, and 0
coordinate writes**. Hover entry refreshes only the previous/current nodes and
their incident edges; animation frames use Sigma 3.0.3's hover-canvas scheduler.
A focused session regression proves Graphology x/y and camera state are
unchanged. The Local renderer
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
- Renderer-focused tests passed: **62 files / 489 tests**.
- Web tests passed: **95 files / 726 tests**.
- `pnpm benchmark:file-move` passed. Median reducer latency was 0.170 ms
  without placement and 0.103 ms with placement; the large-placement index
  conversion median was 4.460 ms, and 10,000 raw pointer samples were reduced
  to three commands in 9.547 ms.
- `pnpm benchmark:global-renderer -- --profile small` passed; example mapping
  median was 0.283 ms, graph build median was 0.107 ms, and visual label
  threshold median was 0.038 ms. Its visual operation contract recorded zero
  projection, topology mapping, graph reconciliation, layout, and coordinate
  writes, with exactly one Sigma visual refresh.
- `pnpm benchmark:local-renderer -- --profile small` passed; its operation
  oracle recorded zero local/global projection, layout, and workspace
  transactions.
- `pnpm check` passed formatting, lint, all workspace typechecks, **269 files /
  2,244 tests**, and the production web build.
- `pnpm desktop:check` passed, including **16 Rust tests**.
- `pnpm desktop:build` produced a fresh optimized Windows executable.
- `git diff --check` passed.

Production-browser visual QA exercised a persisted Focus Network and the built
production `GlobalRendererSession` harness with 309 nodes and 1,200 edges. A
single click selected without moving, a canonical double-click activated once
without a drag, sub-threshold jitter did not move the node, and a deliberate
drag entered `Settling...`, continued across the top controls, and released
without activating the covered control. In All and Focus, the selected/hovered
node and only its incident edges gained purple emphasis while unrelated neutral
and semantic-colored edges kept their ordinary styling. At fitted, zoomed-in,
and zoomed-out scales, label font size and gap followed the rendered node radius,
the node-diameter cap held, and ordinary labels faded/cut off while forced labels
remained readable. No graph rebuild, layout request, graph-coordinate mutation,
or camera reframe was observed during the hover-only checks. Automated drawer
tests additionally cover exact-reference and Unicode truncation using measured
width, three-argument `fillText` calls with no `maxWidth` compression, fade
composition, 120 ms cubic hover easing, reduced-motion snapping, and invariant
text/position/font values across the hover frames.

The available computer-use surface was browser-only, so the optimized native
window could not be inspected programmatically. Native desktop appearance is
therefore the explicit remaining user-acceptance item, not a claimed automated
pass.

## Native handoff

Fresh executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-graphvis-obsidian1\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
```

Size: **13,547,008 bytes**

SHA-256: `704E42D4C6F2800A1F90C4F880D637621599C8854ACD7072E275A4F97F70B092`

Side-by-side acceptance checklist:

1. Single-click and rapid double-click a movable File; confirm selection and one
   activation with no movement or grabbing cursor.
2. Add tiny pointer jitter below 3 px, then deliberately cross the threshold;
   confirm `pointer` changes to `grabbing` only for the real drag and overlay
   crossing/release remain smooth.
3. At far, normal, and close zoom, confirm label font and gap scale with nodes,
   the 1B fade remains smooth, and text never exceeds node diameter.
4. Compare `Creativity - Initiative - Curiosity.md` with
   `Hippocampus as a reward predictor + Cerebellum.md`; confirm the latter uses
   a clean ellipsis with no horizontal squeezing.
5. Hover nodes in All and Focus; confirm only direct lines brighten, unrelated
   content does not darken, and the label eases down only slightly.
6. Repeat with reduced motion and confirm the label snaps without interpolation.
