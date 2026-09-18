# GRAPHVIS-OBSIDIAN1 implementation report

Status: **GRAPHVIS-OBSIDIAN1 merged; GRAPHVIS2 implemented and ready for native
user QA.** The original integration landed in
[PR #110](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/110).

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
  radius. GRAPHVIS2 keeps that scale relationship while applying the selected
  middle presentation curve:
  `min((14 + logicalRadius / 4) * renderScale * 0.9,
  renderedDiameter * clamp(0.54 + logicalRadius * 0.015, 0.56, 0.69))`.
  The 4.5-unit logical gap scales by the same `renderScale`.
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
  at most 3.75 screen pixels or 55% of rendered radius over a 220 ms cubic
  ease-out. Reduced motion snaps to the hovered position.
- `GlobalRendererSession` and `LocalRendererSession` install that same label and
  hover drawer. Existing label thresholds, semantic LOD, forced labels, and
  `hideLabelsOnMove: false` remain unchanged.
- `network-hover.ts` owns one renderer-local transition progress shared by label
  offset and edge presentation. Enter, leave, and direct A-to-B switches retain
  their sampled progress; the frame loop sleeps when no transition is moving.
- `network-theme.ts` owns the evidence-backed dark Graph tokens and shared system
  font. All and Focus canvases identify the `obsidian-dark` theme explicitly.
- Node/edge reducers use the Obsidian base language while preserving Icarus
  unresolved, ambiguous, invalid, hierarchy/reference, scope, Arrange Folders,
  and Visual Group meanings. Explicit Visual Group colors are not mutated.
- Outside Arrange Folders, unrelated nodes and edges retain their exact
  ordinary style during hover. Only directly incident edges brighten; neutral
  graph/hierarchy lines use `#8a5cf5`, while explicit semantic hex colors are
  lightened 28% toward white and retain their hue. GRAPHVIS2 interpolates from
  each base color to that target and from ordinary width to 1.3× using the same
  transition progress; the existing far-LOD direct-edge reveal remains intact.
- Dark styling is confined to the Network graph surface, its empty/status states,
  viewport controls, and arrangement indicators. The application shell,
  sidebars, Inspector, and Hierarchy views are outside this change.

## GRAPHVIS2 visual refinement

The deterministic bakeoff compared three continuous font-to-diameter ceilings:
conservative A (about 55% small / 63% root), middle B (about 59% small / 67%
root), and larger C (about 63% small / 71% root). Production Focus and the
309-node All harness selected B: A made small labels marginal, while C stayed
too close to the text-heavy merged baseline. At representative logical radii,
the selected curve yields about 59% for Blocks, 60% for diagnostics, 61% for
Sections, 64% for ordinary Files, 67% for the Focus root, and 69% for a
high-degree File. The Obsidian-derived term becomes the limiter for the largest
possible hubs, so they receive a modest global reduction instead of an
aggressive cap.

Hover timing compared 2.5, 3.5, and 4.5 px ordinary-scale targets. The selected
3.75 px maximum with a 55%-of-radius bound gives ordinary Files roughly 3.5 px
of motion while keeping small nodes restrained. A single 220 ms cubic ease-out
now drives label y, incident-edge color, and incident-edge width in both
directions. No Obsidian-style opaque overlay was added, and Arrange Folders
keeps its stronger existing edge-style ownership.

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
their incident edges. Every transition frame uses the same partial-refresh path
for just those nodes and edges; unrelated reducer values remain byte-for-byte
equivalent, and the frame loop stops after settlement. A focused session
regression proves Graphology x/y and camera state are unchanged, including zero
camera `setState` calls. The Local renderer
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
- Renderer-focused tests passed: **62 files / 495 tests**.
- Web tests passed: **95 files / 728 tests**.
- `pnpm benchmark:global-renderer -- --profile small` passed; example mapping
  median was 0.208 ms, graph build median was 0.107 ms, and visual label
  threshold median was 0.039 ms. Its visual operation contract recorded zero
  projection, topology mapping, graph reconciliation, layout, and coordinate
  writes, with exactly one Sigma visual refresh.
- `pnpm benchmark:local-renderer -- --profile small` passed; projection median
  was 0.419 ms, topology mapping median was 0.019 ms, and graph build median was
  0.039 ms. Its operation oracle recorded zero local/global projection, layout,
  and workspace transactions during the layout toggle.
- `pnpm check` passed formatting, lint, all workspace typechecks, **270 files /
  2,259 tests**, and the production web build.
- `pnpm desktop:check` passed, including **16 Rust tests**.
- `pnpm desktop:build` produced a fresh optimized Windows executable.
- `git diff --check` passed.

Production-browser visual QA exercised a persisted Focus Network (8 nodes / 7
edges), the persisted All Network (11 nodes / 7 edges), and the built production
`GlobalRendererSession` harness with 309 nodes and 1,200 edges. At fitted,
zoomed-in, close, zoomed-out, and near-fade scales, label size and gap followed
the rendered radius; the selected middle curve kept small labels restrained and
larger labels readable while ordinary labels faded and forced labels stayed
visible. In All and Focus, the selected/hovered node and only its incident edges
gained emphasis with no dimming overlay; unrelated neutral and semantic-colored
edges kept their ordinary styling. The harness recorded no graph rebuild while
app and harness consoles remained free of warnings and errors.

Automated tests cover transition endpoints and midpoints, enter/leave, direct
A-to-B switches, semantic-color interpolation, width growth, the 220 ms cubic
ease, reduced-motion snapping, and loop settlement. Integration assertions
prove partial refreshes contain only the active nodes and their incident edges;
unrelated reducer values, Graphology x/y, and camera state remain unchanged.
Drawer tests retain exact-reference and Unicode truncation using measured width,
three-argument `fillText` calls with no `maxWidth` compression, fade composition,
and invariant x/font/text values across hover frames.

The available computer-use surface was browser-only, so the optimized native
window could not be inspected programmatically. Native desktop appearance is
therefore the explicit remaining user-acceptance item, not a claimed automated
pass.

## Native handoff

Fresh executable:

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-graphvis2\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
```

Size: **13,548,544 bytes**

SHA-256: `FE78DB2D1D82BA09AF90E962D6EC0E17206FE5638FC816115E6B3CDE2D64814F`

Side-by-side acceptance checklist:

1. Are small-node labels now restrained enough?
2. Are large-node labels still readable without dominating?
3. Does the connector plus label hover transition feel smooth and elegant rather
   than snappy?
5. Hover nodes in All and Focus; confirm only direct lines brighten, unrelated
   content does not darken, and the label eases down only slightly.
6. Repeat with reduced motion and confirm the label snaps without interpolation.
