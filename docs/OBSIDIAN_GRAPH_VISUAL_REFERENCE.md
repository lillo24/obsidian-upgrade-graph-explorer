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
opacity follows graph zoom/text fade, becomes fully opaque for the highlighted
node, and otherwise participates in the renderer's related-node fade. The
renderer culls offscreen nodes/text and uses the 300-unit word-wrap width.

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
  labels; only the geometry and drawing of an already-qualified label change.
- Icarus Visual Group accents remain renderer inputs. Selected, hovered, and
  Focus-root states remain authoritative interaction layers, as in Obsidian.
- Icarus unresolved/ambiguous/invalid and hierarchy/reference distinctions use
  dark-safe variants around the Obsidian base palette. These states have no
  exact one-to-one Obsidian representation.
- Exact Obsidian Pixi word wrapping is not available in Sigma's one-line canvas
  label API. Icarus keeps a centered one-line label capped to the same 300 px
  width and the viewport rather than moving it to a side.
