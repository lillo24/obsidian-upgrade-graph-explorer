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
semantic renderer data colors, and renderer palette definitions remain outside
the DOM-token layer.

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

All Hierarchy and Focus Hierarchy map the same resolved ID through
`hierarchyThemeFor(theme)`. `hierarchy-theme.ts` owns the renderer-specific
canvas, File/Heading/Block/diagnostic card, edge, folder-guide, module, control,
context, status, selection, and focus roles. `GraphCanvas` applies the matching
CSS custom-property map to its existing root and forwards the ID to React Flow's
public `colorMode` seam. The stylesheet consumes only those roles; it has no
hard-coded palette or OS-theme query.

A Hierarchy theme change is also presentation-only. `theme` is absent from
projection mapping, prepared-graph identity, Dagre input, Local Structured
fingerprints/cache keys, coordinates, transition anchors, viewport state,
selection, navigation, and persistence. A mounted switch updates the existing
canvas element and CSS variables without a layout request or viewport reset.

## Enforcement and literal-color audit

`production-theme-audit.test.ts` scans production sources under `apps/web/src`,
`packages/renderer-sigma/src`, and `packages/renderer-reactflow/src`. New color
literals must live in one of the declared app/renderer theme boundaries or be
added as a reviewed exact exception. It also enforces that only the app runtime
owns `prefers-color-scheme` and only `tokens.css` owns the root theme selector.

The current non-boundary exceptions are six canonical entity-kind badge colors
in `App.css` and fifteen colors in the isolated PHYSICS1 development lab in
`index.css`. Visual Group palette values are persisted data accents. Renderer
theme files are semantic palette definitions. Tests and fixtures are excluded;
there are no remaining unclassified production surface/text literals, fixed
brand colors, or third-party defaults copied into product source.

New application UI uses app semantic tokens. New renderer visuals extend their
renderer adapter instead of importing app CSS or resolving System locally.

## Migration sequence

1. THEMESYS1 establishes ownership, persistence, startup behavior, semantic
   tokens, Settings, and renderer seams.
2. THEMESYS2 maps All/Focus Network palettes and graph-local controls to the
   explicit resolved theme.
3. THEMESYS3 moves ordinary application chrome, shared controls, workspace
   surfaces, Arguments, and AI Review onto semantic tokens.
4. THEMESYS4 migrates the Hierarchy renderer palette and adds the final
   cross-app audit guard. The sequence is complete.
