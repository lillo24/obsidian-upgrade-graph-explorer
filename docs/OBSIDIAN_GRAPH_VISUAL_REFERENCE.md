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
the text farther down by up to 15 graph/display units and may keep highlighted
text readable when zoomed out. Icarus intentionally does not add that vertical
jump and additionally clamps font pixels to its actual rendered diameter,
because Icarus supports nodes smaller than Obsidian's radius floor.

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

- Selected, hovered, Focus-root, arrangement-member, always-labelled, and other
  existing `forceLabel` states stay fully opaque. This preserves the product's
  forced-label contract and matches Obsidian's highlighted-label bypass.
- Icarus Visual Group accents remain renderer inputs. Selected, hovered, and
  Focus-root states remain authoritative interaction layers, as in Obsidian.
- Icarus unresolved/ambiguous/invalid and hierarchy/reference distinctions use
  dark-safe variants around the Obsidian base palette. These states have no
  exact one-to-one Obsidian representation.
- Exact Obsidian Pixi word wrapping is not available in Sigma's one-line canvas
  label API. Icarus keeps a centered one-line label capped to the same 300 px
  width and the viewport rather than moving it to a side.
