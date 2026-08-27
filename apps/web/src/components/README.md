# Explorer Components

These components present the KG8 explainable-navigation workflow around the KG7
graph plus secondary KG5 evidence. They do not load files, validate JSON, alter
canonical truth, or own a platform storage implementation.

- `GraphExplorer.tsx` composes report-scoped projection/inspection workspaces,
  compact disclosure/focus/filter/workspace controls, shared canonical
  navigation, graph selection, transient maximized/Inspector behavior,
  saved-view hydration/alert/reset orchestration, and semantic renderer viewport
  requests. It keeps the canvas mounted across shell changes and does not
  re-derive graph edges or persist renderer coordinates or shell visibility.
- `EntitySearch.tsx` performs bounded deferred search over the full canonical
  inspection index, independently from visible graph filters.
- `GraphFilters.tsx` maps practical path, content-kind, and reference-status
  controls directly to KG6 filter state.
- `maximized-graph-mode.ts` owns the reversible body scroll lock and Escape-key
  exit listener for the transient application maximize mode.
- `ProvenanceInspector.tsx` presents user-facing identity, breadcrumbs,
  outgoing links, backlinks, connection occurrences, structural containment,
  and plain-language link problems in bounded groups. Canonical IDs, exact
  ranges, resolution metadata, ambiguous candidate mentions, and collapsed
  internal occurrences stay in a closed-by-default technical disclosure.
- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns compact report selection, report identity provenance, maximized
shell state, and transient secondary diagnostic filters. `graph-state.ts` owns
pure KG6 interaction transitions, `navigation.ts` owns the verified target-reveal
plan, and `report-view.ts` owns secondary evidence transformations.
`../persistence/` owns the localStorage adapter and pre-autosave hydration; the
source-neutral schema/reconciliation lives in `packages/view-state`.
