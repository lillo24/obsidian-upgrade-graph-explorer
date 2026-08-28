# Explorer Components

These components present the KG8 explainable-navigation workflow around the KG7
graph plus secondary KG5 evidence. They do not load files, validate JSON, alter
canonical truth, or own a platform storage implementation.

- `GraphExplorer.tsx` composes report-scoped projection/inspection workspaces,
  compact structural/heading/focus/filter/workspace controls, shared canonical
  navigation, graph selection, transient maximized overlays/Inspector drawer,
  saved-view hydration/alert/reset orchestration, and semantic renderer viewport
  requests. Across live snapshots it reconciles current KG6 state before
  projection, rebuilds inspection/search indexes, preserves surviving selection
  and semantic viewport context, and safely clears missing selections. It keeps
  the canvas and the single stateful Search instance mounted across shell/live
  changes and does not re-derive graph edges or persist renderer coordinates or
  shell visibility. Maximize/restore is passed to the renderer as a narrow
  callback so the canvas control stack remains the mode trigger.
- `GraphSettings.tsx` presents the shared normal/maximized trackpad gesture
  setting as an accessible controlled popover; global storage ownership remains
  in `../preferences/`.
- `EntitySearch.tsx` performs bounded deferred search over the full canonical
  inspection index, independently from visible graph filters.
- `GraphFilters.tsx` maps practical path, content-kind, and reference-status
  controls directly to KG6 filter state.
- `maximized-graph-mode.ts` owns the reversible body scroll lock and Escape-key
  exit listener for the transient application maximize mode. Maximized Tools,
  Settings, and Inspector visibility remains session-only shell state.
- `ProvenanceInspector.tsx` presents user-facing identity, breadcrumbs,
  outgoing links, backlinks, connection occurrences, structural containment,
  and plain-language link problems in bounded groups. Canonical IDs, exact
  ranges, resolution metadata, ambiguous candidate mentions, and collapsed
  internal occurrences stay in a closed-by-default technical disclosure.
- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns compact source/live status, source-session switching, report
identity provenance, maximized shell state, and transient secondary diagnostic
filters. `desktop-live-vault.ts` owns non-React serialized live transactions,
pause/recovery, and watcher lifecycle. `graph-state.ts` owns
pure KG6 interaction transitions, `navigation.ts` owns the verified target-reveal
plan, and `report-view.ts` owns secondary evidence transformations.
`../persistence/` owns the localStorage adapter and pre-autosave hydration; the
source-neutral schema/reconciliation lives in `packages/view-state`.
`../preferences/` separately owns the global trackpad preference and its
versioned localStorage key.
