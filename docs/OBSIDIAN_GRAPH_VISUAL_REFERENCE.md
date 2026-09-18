# Obsidian Graph visual reference

This note records the presentation behavior inspected for GRAPHVIS-OBSIDIAN1.
It is a behavioral audit, not copied Obsidian source.

## Source and version

- Obsidian desktop package: **1.11.5** (`extracted/obsidian/package.json`).
- Extraction root inspected:
  `C:\Users\leona\AppData\Local\Temp\icarus-obsidian-extract-1.11.5-20260904-083915`.
- Renderer source: `formatted/app.pretty.js`, especially the node/renderer
  region around lines 110,900–112,150. Stable tokens include `color-fill`,
  `color-text`, `PIXI.TextStyle`, `anchor.set(0.5, 0)`, `getTextStyle`,
  `getSize`, and `testCSS`.
- Default theme source: `extracted/obsidian/app.css`, especially graph color
  mappings near lines 2,274–2,281, light/dark base values near lines
  2,800–2,955, and `.graph-view.color-*` rules near lines 14,729–14,781.
- `formatted/sim.pretty.js` contains graph physics, not label or palette
  ownership.

## Label behavior

Obsidian creates a Pixi text object with horizontal anchor `0.5` and vertical
anchor `0`, so its label is horizontally centered and begins below the node.
The ordinary label position is:

```text
x = node x
y = node y + (node radius + 5) * nodeScale
```

The text style uses normal Pixi weight, centered alignment, the system UI font
stack, word wrapping, and a wrap width of 300 renderer units. Its base font
formula is:

```text
font px = 14 + node radius / 4
```

The node radius is clamped by Obsidian to 8–30 before its display multiplier,
so the formula is no larger than the node diameter at the minimum radius. Node
and text use the same renderer scale, preserving that relationship through
zoom. The highlighted node keeps the same centered/below anchor; it animates
the text farther down toward a target of 15 graph/display units. The recovered
interpolator is `next = old * 0.9 + target * 0.1`; the text y calculation adds
that transient value after the ordinary `(radius + 5) * nodeScale` offset.
Obsidian may also keep highlighted text readable when zoomed out. Icarus adapts
the motion to a bounded few-pixel offset and additionally clamps font pixels to
its actual rendered diameter because Icarus supports nodes smaller than
Obsidian's radius floor.

Obsidian does not draw a label backing rectangle or text shadow. Highlighting
changes the node fill to the accent and draws a focused-color circle. Label
opacity is owned by the renderer's `setScale` path. Stable tokens in
`formatted/app.pretty.js` are `fTextShowMult`, `textAlpha`, `nodeScale`, and
`setScale`. The exact calculation is:

```text
nodeScale = sqrt(1 / rendererScale)
textAlpha = clamp(log2(rendererScale) + 1 - textFadeMultiplier, 0, 1)
```

`textFadeMultiplier` defaults to `1`, so default text alpha is
`clamp(log2(rendererScale), 0, 1)`: zero at renderer scale 1, fully opaque at
scale 2, and continuous between them. The Graph display slider changes the
multiplier from -3 to 3 in 0.1 increments. A non-highlighted label's final alpha
is `textAlpha * fadeAlpha * graphTextColorAlpha`. `fadeAlpha` animates unrelated
nodes toward 0.2 during highlighting. The highlighted node replaces that
intermediate result with 1 before applying the theme color alpha, so it bypasses
both zoom and related-node fading. Text visibility is then culled when final
alpha is not greater than `0.001`, in addition to viewport culling.

The holder scales by `rendererScale`, while node/text children scale by
`sqrt(1 / rendererScale)`. Their effective rendered size therefore grows with
`sqrt(rendererScale)`. The default fade from renderer scale 1 to 2 corresponds
to a rendered node/text size increase from 1 to `sqrt(2)`. Obsidian does not use
Sigma's per-node rendered-size threshold; that part of the Icarus mapping is an
adaptation.

## Default-dark graph palette

The Pixi application uses `backgroundAlpha: 0`; the Graph View therefore shows
the containing view's `--background-primary`. In the default dark theme this
resolves to `--color-base-00`, **`#1e1e1e`**. It is a dark neutral, not pure
black.

| Graph role                    | Variable chain                                                 | Resolved value             |
| ----------------------------- | -------------------------------------------------------------- | -------------------------- |
| Background                    | `--background-primary` → `--color-base-00`                     | `#1e1e1e`                  |
| Label text                    | `--graph-text` → `--text-normal` → `--color-base-100`          | `#dadada`                  |
| Ordinary node                 | `--graph-node` → `--text-muted` → `--color-base-70`            | `#b3b3b3`                  |
| Edge                          | `--graph-line` → `--color-base-35`                             | `#3f3f3f`                  |
| Focused node/ring             | `--graph-node-focused` → `--text-accent` → `--color-accent-1`  | `#a68af9`                  |
| Hover/highlight fill and line | `--interactive-accent` → `--color-accent`                      | `#8a5cf5`                  |
| Unresolved node               | `--graph-node-unresolved` → `--text-faint` → `--color-base-50` | `#666666` at `0.5` opacity |
| Tag node                      | `--graph-node-tag` → `--color-green`                           | `#44cf6e`                  |
| Attachment node               | `--graph-node-attachment` → `--color-yellow`                   | `#e0de71`                  |

The accent values resolve from the default `258 / 88% / 66%` accent HSL and
the dark-theme `--color-accent-1` transform. Unrelated graph elements fade
toward 0.2 alpha while a node is highlighted.

## Default-light graph palette

The transparent Pixi stage exposes `--background-primary`, which resolves to
`--color-base-00`, **`#ffffff`**, under Obsidian 1.11.5's default light theme.
The same graph-role rules used above resolve through the light base scale:

| Graph role                    | Variable chain                                                 | Resolved value             |
| ----------------------------- | -------------------------------------------------------------- | -------------------------- |
| Background                    | `--background-primary` → `--color-base-00`                     | `#ffffff`                  |
| Label text                    | `--graph-text` → `--text-normal` → `--color-base-100`          | `#222222`                  |
| Ordinary node                 | `--graph-node` → `--text-muted` → `--color-base-70`            | `#5c5c5c`                  |
| Edge                          | `--graph-line` → `--color-base-35`                             | `#d4d4d4`                  |
| Focused node/ring             | `--graph-node-focused` → `--text-accent` → `--color-accent`    | `#8a5cf5`                  |
| Hover/highlight fill and line | `--interactive-accent` → `--color-accent-1`                    | `#9873f7`                  |
| Unresolved node               | `--graph-node-unresolved` → `--text-faint` → `--color-base-50` | `#ababab` at `0.5` opacity |
| Tag node                      | `--graph-node-tag` → `--color-green`                           | `#08b94e`                  |
| Attachment node               | `--graph-node-attachment` → `--color-yellow`                   | `#e0ac00`                  |

The two accent hex values are the final sRGB results of the default
`258 / 88% / 66%` HSL and the light-theme `--color-accent-1` transform
(`257 / 88.88% / 70.95%`). These are evidence-backed Obsidian values rather
than inverted dark colors.

Icarus-only light adaptations use `#ababab` for hierarchy edges, the native
light orange/red values `#ec7500` and `#e93147` for ambiguous/invalid
diagnostics, and `#52658a`, `#bdbdbd`, and `#e0e0e0` for shadowed, excluded,
and inactive Arrange scope states. Focus sections/blocks use Obsidian's light
purple `#7852ee` and base-60 `#707070`. These roles have no exact Obsidian
Graph counterpart and are deliberately recorded as adaptations.

## Icarus compatibility decisions

- Icarus retains its existing Sigma label threshold, semantic LOD, and forced
  labels. Ordinary label opacity adapts the recovered Obsidian curve to Sigma's
  rendered-radius domain:

  ```text
  ratio = rendered node radius / current label threshold
  opacity = clamp(2 * log2(ratio), 0, 1)
  ```

  This is zero at the existing threshold and fully opaque at
  `sqrt(2) * threshold`; Sigma still hard-culls ordinary labels below the
  threshold. Because the current threshold is supplied to every draw, changing
  Label Threshold moves the fade window coherently rather than relying on a
  hard-coded default.

- Sigma 3.0.3 passes the camera-scaled screen radius to its label drawer while
  retaining the reducer's final logical presentation radius on the cached draw
  data. Icarus therefore applies the shared Obsidian-style transform as:

  ```text
  render scale = rendered radius / logical radius
  font px = min((14 + logical radius / 4) * render scale,
                rendered radius * 2)
  gap px = 5 * render scale
  ```

  Font/gap scaling and the opacity fade are independent presentation steps.

- Selected, hovered, Focus-root, arrangement-member, always-labelled, and other
  existing `forceLabel` states stay fully opaque. This preserves the product's
  forced-label contract and matches Obsidian's highlighted-label bypass.
- Icarus Visual Group accents remain renderer inputs. Selected, hovered, and
  Focus-root states remain authoritative interaction layers, as in Obsidian.
- Icarus unresolved/ambiguous/invalid and hierarchy/reference distinctions use
  palette-specific variants around the Obsidian bases. These states have no
  exact one-to-one Obsidian representation.
- Exact Obsidian Pixi word wrapping is not available in Sigma's one-line canvas
  label API. Icarus keeps a centered single line, measures the current-font
  width of `Creativity - Initiative - Curiosity.md`, and ellipsizes by Unicode
  code point when a label or the available viewport is wider. Canvas receives
  the resulting text at natural width; no `fillText` compression width is used.
- Outside Arrange Folders, Icarus deliberately does not reproduce Obsidian's
  unrelated-graph fade. Hover retains every unrelated node/edge's ordinary
  style and brightens only directly incident edges. Neutral incident lines use
  the palette's recovered interactive accent. Explicit semantic hues are
  lightened on dark and darkened on light, preserving hue while moving toward
  contrast rather than blindly toward white.
- Icarus adapts Obsidian's label displacement to at most 3 screen pixels or 35%
  of rendered radius, whichever is smaller, over 120 ms with cubic ease-out.
  Leave reverses smoothly. Reduced-motion mode snaps to the final hover state.
  The state is renderer-local and never changes graph coordinates or camera.
