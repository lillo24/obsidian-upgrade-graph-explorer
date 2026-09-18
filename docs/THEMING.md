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

- surfaces: app, workspace, chrome, toolbar, sidebar, panel, elevated, input,
  subtle, inset, hover, selected, overlay, backdrop, scrim, code, and disabled;
- text: primary, secondary, muted, faint, disabled, inverse, on-dark, accent,
  and link;
- borders and focus: subtle, default, strong, focus, and the high-contrast focus
  ring;
- controls: ordinary, hover, selected, and disabled foreground/background/border
  roles;
- accent, shadows, inset highlight, and tap highlight;
- status: info, success, warning, error, and synthetic/development warning,
  each with semantic foreground, background, and border roles.

THEMESYS3 moves the production DOM shell and feature UI onto those roles.
`App.css`, `workspace.css`, `arguments.css`, and `review.css` do not own theme
selectors or media-query theme decisions; changing the single root marker
updates their inherited variables immediately, including an already-open
dialog. Global focus and disabled-control treatment also consumes the same
roles.

Hard-coded production colors remain only where color itself is canonical data:
the Document/Section/Block badges. The development-only PHYSICS1 Lab retains a
fixed diagnostic node/edge palette. User-selected Visual Group accents,
semantic renderer data colors, Network palettes, and Hierarchy renderer
internals remain outside the DOM-token layer.

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
3. THEMESYS3 moves ordinary application chrome, shared controls, workspace
   surfaces, Arguments, and AI Review onto semantic tokens.
4. THEMESYS4 migrates the separate Hierarchy renderer palette; final
   cross-platform QA closes any remaining renderer-specific boundaries.
