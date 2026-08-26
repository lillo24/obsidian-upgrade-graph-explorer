# Web Diagnostic Explorer

Status: **STABLE — KG5 report inspection workflow is synthetic- and real-report browser-tested.**

This package owns the browser SPA and its transient diagnostic-explorer UI. It
accepts one runtime-validated KG5 JSON report selected by the user or the
committed neutral sample. It does not scan folders, upload reports, persist
state, modify canonical truth, or implement graph projections/rendering.

```text
selected report JSON → runtime validation → pure lookups/filters → React UI
```

## File map

```text
apps/web/
  index.html          Browser metadata and application mount point.
  package.json        React/Vite and pure diagnostic-report dependencies.
  vite.config.ts      Vite React integration.
  tsconfig.json       Strict browser/JSX compilation settings.
  src/
    main.tsx          Root validation and React startup.
    App.tsx           Report selection, validation errors, and transient filters.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Summary, hierarchy, reference, diagnostic, and probe panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. Pure transformations
are unit-tested separately from the server-rendered application shell.

## Report loading and privacy

“Load Diagnostic Report” uses the browser File API for one explicitly selected
JSON file. The report is parsed and validated in browser memory and is never
uploaded. This is intentionally different from product-grade live vault access:

```text
KG5  = select one generated report file
KG11 = product folder access and watching
```

Malformed schema versions, snapshots, diagnostics, probes, or inventory fields
produce an actionable inline error while the last valid report remains visible.

## Performance posture

Opaque entity IDs use prebuilt maps, expensive search is deferred and memoized,
hierarchy descendants mount only when expanded, and references are paged in
groups of 100. Long rows use `content-visibility`. No virtualization dependency
or performance budget is introduced before KG12 evidence requires it.

## Scope boundary

The hierarchy tree is diagnostic disclosure UI only. Its expanded state is not
KG6 projection state or KG9 persistence. No graph renderer, ghost node, edge
roll-up, layout, source preview, or live filesystem access exists here.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build
pnpm dev
```
