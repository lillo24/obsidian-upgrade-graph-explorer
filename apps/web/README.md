# Web Structural Graph Explorer

Status: **STABLE — KG8 synthetic and ignored real-report navigation gates pass.**

This package owns the browser SPA, validated KG5 report selection, transient KG6
projection/filter state, graph selection, canonical navigation orchestration,
and provenance-first inspection UI. It accepts one
runtime-validated report selected by the user or the committed neutral sample.
It does not scan folders, upload reports, persist state, modify canonical truth,
or derive renderer semantics.

```text
selected report JSON → runtime validation → canonical inspection/search
                                   └───────→ KG6 projection → KG7 renderer
                                                     ↘ KG8 inspector/navigation
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
    graph-state.ts    Pure disclosure/focus/filter interaction reducer.
    navigation.ts     Shared reveal/filter-widening/navigation planner.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Primary graph workspace and secondary diagnostic panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. The graph workspace
creates one reusable `ProjectionWorkspace` and `InspectionWorkspace` per loaded
snapshot and passes only a `ViewProjection` plus viewport requests to
`@icarus-graph-explorer/renderer-reactflow`. Loading or restoring a report keys
a complete graph-state/selection/search/viewport reset.

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
primary inspector resolves projected selection to canonical descriptors, exact
occurrences, subtree outgoing references/backlinks, ambiguous candidate
mentions, and internal collapsed relationships.

Blocks remain opt-in through the labelled **Blocks** checkbox and still require
explicit expansion of their visible parent, preserving KG6's conservative block
disclosure rule. Open branches retain a collapse control even when all of their
descendants are visible.

Global Find searches the full canonical snapshot, including entities hidden by
disclosure or graph filters. Selecting any search, breadcrumb, source,
backlink, resolved-target, or ambiguity-candidate action uses one navigation
pipeline: exit focus, reveal ancestors through KG6, widen only conflicting
path/entity/text filters with an announcement, reproject, select, and request a
renderer-only center. Graph filters expose derived top-level path scopes,
entity content kinds, and reference statuses. Search is exact/prefix/substring
over names, headings, breadcrumbs, paths, and block line labels; it is not
fuzzy, semantic, or Markdown body search.

Opaque entity IDs use prebuilt maps. Canonical search is deferred and memoized;
search results are capped at 30; provenance groups render 20 rows at a time;
secondary references remain paged in groups of 100. No renderer virtualization
switch or performance budget is introduced before KG12 evidence requires it.

## Scope boundary

The hierarchy tree under “Inspect diagnostic evidence” remains KG5 diagnostic
UI only. Its expanded state is separate from KG6 projection state. Report mode
provides paths, breadcrumbs, raw targets, and exact spans, but no source text,
preview, live filesystem access, open-in-source action, write-back, or
persistence.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build
pnpm dev
```
