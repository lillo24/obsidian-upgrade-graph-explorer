# Application theme runtime

This folder owns the single browser runtime that resolves and applies the app
theme.

- `runtime.ts` loads the appearance preference, resolves System, subscribes to
  OS changes only in System mode, persists user changes, and updates the root
  `data-theme` marker plus `color-scheme`.
- `theme-provider.tsx`, `theme-context.ts`, and `ThemeApplication.tsx` expose
  the runtime snapshot and setter to React without giving components direct
  access to storage, the DOM, or media queries.
- `tokens.css` defines application-wide semantic surface, text, border, focus,
  control, shadow, and status roles for both resolved themes. DOM feature CSS
  consumes these roles rather than owning theme selectors.
- `runtime.test.ts` verifies resolution, OS-change behavior, root application,
  and write-failure behavior. `theme-css-contract.test.ts` audits component CSS
  ownership, intentional literal-color exceptions, and key WCAG contrast pairs.
- `test-controller.ts` is the fixed light test seam for component tests that do
  not mount the browser runtime.

The small blocking script in `apps/web/index.html` mirrors the version-1
preference validation only to seed the same root marker before styles paint.
`ThemeRuntime` takes ownership as soon as the application module starts.
