# THEMESYS2 — Dual Light/Dark Network theme, including recent label/hover work

**Depends on:** THEMESYS1

## Goal

Convert All + Network and Focus + Network from dark-only styling into a real dual-theme renderer driven by the resolved app theme.

Both themes must support all current Network behavior:
- background;
- node/edge/label colors;
- selected/hovered/focused states;
- diagnostics;
- Visual Groups;
- Arrange Folders;
- viewport controls;
- label fade;
- size/truncation;
- hover label motion;
- incident-edge color + width animation.

Light must be designed, not just dark colors on white.

## Current evidence

Current production code has:

```ts
OBSIDIAN_DARK_NETWORK_THEME
NETWORK_GRAPH_THEME_ID = 'obsidian-dark'
```

in `packages/renderer-sigma/src/network-theme.ts`.

Network CSS also owns unconditional dark variables in `packages/renderer-sigma/src/styles.css`.

There is no production light Network palette.

## Phase 1 — Resolve real Obsidian 1.11.5 default-light Graph values

Use the same extracted Obsidian source/theme evidence used for the dark palette.

Resolve final light values for:
- graph background;
- label text;
- ordinary node;
- edge;
- focused node/ring;
- highlight/accent;
- unresolved node;
- tag;
- attachment.

Follow CSS variable chains to final values. Do not guess.

Update `docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md` with a Light section.

For Icarus-only states, derive light-safe variants and label them as adaptations.

## Phase 2 — Generic Network theme contract

Replace dark-specific imports with a generic contract, conceptually:

```ts
interface NetworkTheme {
  id: 'obsidian-light' | 'obsidian-dark';
  background: string;
  label: string;
  node: string;
  edge: string;
  hierarchyEdge: string;
  focusedNode: string;
  highlight: string;
  ...
}
```

Expose something equivalent to:

```ts
networkThemeFor('light')
networkThemeFor('dark')
```

Dark output should remain visually equivalent to current approved dark behavior.

## Phase 3 — Explicit theme injection

All/Focus sessions receive resolved theme through THEMESYS1.

Theme switching must be presentation-only and preferably in-place.

Theme change must produce:

```text
0 layout jobs
0 PHYSICS1 restarts
0 coordinate changes
0 camera resets
0 spatial influence jobs
0 cache invalidations
0 persistence writes
```

Only style refresh/redraw.

## Phase 4 — Make recent visuals theme-aware

### Labels
Use theme label color while preserving:
- opacity fade;
- forced-label opacity;
- size curve;
- truncation;
- hover motion.

### Incident-edge hover
Make base→highlight interpolation theme-aware.

Do not use a dark-only “lighten toward white” rule in light mode if it reduces contrast.

Preserve semantic edge hues.

### Visual Groups
Persisted group accents remain unchanged.
Validate contrast on both backgrounds.
Renderer-only halo/ring treatment is acceptable if needed.

### Diagnostics
Unresolved/ambiguous/invalid must remain distinguishable in both themes.

### Arrange Folders
Theme:
- target marker;
- spotlight;
- scope states;
- graph-local arrangement controls/panels.

### Network viewport controls
Theme background/border/text/hover/focus.

## CSS rules

Do not use independent `prefers-color-scheme` in renderer CSS.

Use the app-selected resolved theme / explicit theme marker.

## Tests

Cover:
- exact light/dark palettes;
- dark→light→dark switching;
- position/camera invariance;
- label size/fade logic unchanged except color;
- hover progress identical in both themes;
- incident-edge target appropriate per theme;
- diagnostics;
- Visual Groups;
- Arrange Folders;
- no remount if current architecture can update in place.

## Graphical QA

Review:

```text
All Network — Light
All Network — Dark
Focus Network — Light
Focus Network — Dark
```

with:
- normal zoom;
- fade threshold;
- hover;
- selection;
- Visual Groups;
- diagnostics;
- Arrange Folders;
- Move;
- controls.

## Documentation

Update:
- `docs/THEMING.md`
- `docs/OBSIDIAN_GRAPH_VISUAL_REFERENCE.md`
- `packages/renderer-sigma/README.md`

Archive prompt/status under `history-implementations/`.

## Validation

```bash
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Exit gate

1. Obsidian light evidence recorded.
2. Generic Network theme contract exists.
3. Dark stays compatible.
4. Light covers every Network state.
5. Current label/hover animations work in both themes.
6. Theme switching is style-only.
7. Renderers do not read storage/media query/DOM as authority.
8. No layout/physics/camera/persistence change.
9. All/Focus share theme ownership.
10. Full QA/build passes.

## Final report

Report:
- resolved light palette;
- generic theme API;
- dark compatibility;
- light adaptations;
- theme-switch refresh path;
- no-layout/physics proof;
- fresh executable path.
