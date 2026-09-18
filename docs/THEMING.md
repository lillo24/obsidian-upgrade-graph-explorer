# Application theming

## Ownership

The source-neutral contract lives in `packages/theme`: a `ThemePreference` is
`system | light | dark`, while a `ResolvedTheme` is only `light | dark`.

`apps/web/src/preferences/appearance-preferences.ts` is the only persistence
boundary. It uses the versioned key `icarus.graph-explorer.appearance.v1` with
the strict payload `{ "version": 1, "preference": ... }`. Missing, corrupt,
future, or unreadable data falls back to System without making the session
unusable. A failed write still applies the requested theme in memory and
surfaces a session-only warning.

`apps/web/src/theme/runtime.ts` is the only runtime owner. It resolves System
against `(prefers-color-scheme: dark)`, listens for OS changes only in System
mode, and applies `data-theme="light|dark"` plus the matching `color-scheme` to
the document root. React reads this owner through `ThemeProvider`.

Theme is a user-level application preference. It is deliberately absent from
Graph Preferences, Current View/workspace state, navigation history, and Named
Saved Views.

## Startup

`apps/web/index.html` contains a small blocking bootstrap before the application
module. It validates the same version-1 appearance record, resolves System, and
sets the root marker before application CSS can paint. The runtime immediately
revalidates and takes ownership during application startup; the bootstrap does
not subscribe, persist, or remain active.

## Semantic tokens

`apps/web/src/theme/tokens.css` defines roles, not component colors:

- surfaces: app, chrome, panel, elevated, input, hover, selected, overlay;
- text: primary, secondary, muted, inverse;
- borders: subtle, default, strong, focus;
- accent: primary, hover, soft;
- status: info, success, warning, and error, each with foreground, background,
  and border roles.

THEMESYS1 migrates only the root background/foreground, a generic focus ring,
and the Theme selector as smoke cases. Existing component palettes remain until
their planned migrations.

## Renderer boundary

Every production renderer receives `ResolvedTheme` through a typed `theme`
prop. Renderers may use that ID to select a palette, but they must never resolve
theme from `localStorage`, `matchMedia`, `document.dataset`, or computed CSS.

All Network and Focus Network map that resolved ID through
`networkThemeFor(theme)`. Their imperative sessions keep the selected
`NetworkTheme` in memory and update Sigma's label/default colors plus the node
and edge reducers in place. The matching `data-network-theme` marker themes
only the canvas-owned HTML controls and Arrange Folders surfaces. Renderer CSS
does not use `prefers-color-scheme`.

A Network theme change is presentation-only: the mounted session, Graphology
instance, positions, normalization extent, camera, layout services, PHYSICS1,
spatial influence, caches, and persistence remain untouched. One Sigma refresh
reruns the color reducers with indexation skipped. Label sizing, opacity,
truncation, and hover-motion functions are shared unchanged between palettes.

## Migration sequence

1. THEMESYS1 establishes ownership, persistence, startup behavior, semantic
   tokens, Settings, and renderer seams.
2. THEMESYS2 maps All/Focus Network palettes and graph-local controls to the
   explicit resolved theme.
3. Later migrations move ordinary application chrome, shared controls,
   workspace surfaces, and feature-specific palettes onto semantic tokens.
4. Final contrast and cross-platform QA closes any remaining hard-coded color
   boundaries.
