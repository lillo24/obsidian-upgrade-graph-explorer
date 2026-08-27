# Web Structural Graph Explorer

Status: **STABLE — KG9B synthetic and ignored real-report persistence gates pass.**

This package owns the browser SPA, validated KG5 report selection, KG6 graph
interaction state, guarded browser persistence, graph selection, canonical
navigation orchestration, and provenance-first inspection UI. It accepts one
runtime-validated report selected by the user or the committed neutral sample.
It does not scan folders, upload reports, modify canonical truth, persist
renderer layouts/raw transforms, or derive renderer semantics.

```text
selected report JSON → runtime validation → canonical inspection/search
                                   └───────→ KG9B saved view → KG6 projection
                                                          → KG7 renderer
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
    persistence/      Stable-report eligibility, hydration, and localStorage adapter.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Primary graph workspace and secondary diagnostic panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. The graph workspace
creates one reusable `ProjectionWorkspace` and `InspectionWorkspace` per loaded
snapshot and passes only a `ViewProjection` plus semantic viewport requests to
`@icarus-graph-explorer/renderer-reactflow`. Loading or restoring a report keys
a complete transient selection/search reset and workspace-specific hydration.

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

## Saved graph view

Cross-session persistence activates only when a report explicitly declares
`identity.stability: "stable"`. Transient and legacy schema-v1 reports remain
usable in memory and never read or write saved state. The schema-v1 saved record
is keyed by encoded stable workspace ID and contains only structural disclosure,
focus, user-facing path/entity/status filters, and an optional canonical entity
plus positive zoom bookmark.

Hydration and source-evolution reconciliation happen synchronously before the
autosave effect. Stale disclosure IDs, focus roots, path scopes, and viewport
anchors are dropped with non-fatal status; collapsed disclosure wins conflicts.
Corrupt, inaccessible, or unsupported stored values are not overwritten or
silently deleted. Writes stop after one failure. **Reset saved view** deletes
only that workspace's view, restores documents-only defaults, clears transient
search/selection, and fits the graph. It never resets the KG9A catalog.

The browser key contains no report filename, vault basename, or path. Search,
hover, graph/inspector selection, pagination, renderer graph data, Dagre
coordinates, and raw viewport x/y remain transient. Browser reload restores the
bundled stable sample automatically; a user-selected report file must still be
selected again because KG9B does not persist browser file handles.

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
preview, live filesystem access, open-in-source action, or write-back. Its own
expanded evidence-tree state remains transient and separate from KG9B.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build
pnpm dev
```
