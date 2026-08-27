# Web Structural Graph Explorer

Status: **STABLE — KG7 graph workflow is synthetic- and real-report browser-tested.**

This package owns the browser SPA, validated KG5 report selection, transient KG6
projection state, and lightweight graph selection summary. It accepts one
runtime-validated report selected by the user or the committed neutral sample.
It does not scan folders, upload reports, persist state, modify canonical truth,
or derive renderer semantics.

```text
selected report JSON → runtime validation → KG6 projection → KG7 renderer
                                           ↘ secondary KG5 evidence UI
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
    App.tsx           Report selection, reset boundary, and secondary evidence UI.
    graph-state.ts    Pure disclosure/focus interaction reducer.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Primary graph workspace and secondary diagnostic panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. The graph workspace
creates one reusable `ProjectionWorkspace` per loaded report and passes only a
`ViewProjection` to `@icarus-graph-explorer/renderer-reactflow`. Loading or
restoring a report keys a complete graph-state/selection/viewport reset.

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

## Graph interaction boundary

The default view is documents-only; top-level sections and explicit per-entity
disclosure remain KG6 state. Selecting an entity enables one-to-three-hop focus
with incoming/outgoing/both direction. Selection and hover affect presentation
only. Diagnostic targets can be selected but never focused or expanded. The
selection summary intentionally stops short of KG8's provenance inspector.

Blocks remain opt-in through the labelled **Blocks** checkbox and still require
explicit expansion of their visible parent, preserving KG6's conservative block
disclosure rule. Open branches retain a collapse control even when all of their
descendants are visible.

Opaque entity IDs use prebuilt maps, expensive secondary-evidence search is
deferred and memoized, hierarchy descendants mount only when expanded, and
references are paged in groups of 100. No renderer virtualization switch or
performance budget is introduced before KG12 evidence requires it.

## Scope boundary

The hierarchy tree under “Inspect diagnostic evidence” remains KG5 diagnostic
UI only. Its expanded state is separate from KG6 projection state. No source
preview, live filesystem access, write-back, persistence, or KG8 inspector is
implemented.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build
pnpm dev
```
