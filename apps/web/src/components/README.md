# Explorer Components

These components present the KG8 explainable-navigation workflow around the KG7
graph plus secondary KG5 evidence. They do not load files, validate JSON, alter
canonical truth, or own a platform storage implementation.

- `GraphExplorer.tsx` composes report-scoped projection/inspection workspaces,
  disclosure/focus/filter controls, shared canonical navigation, graph
  selection, saved-view hydration/status/reset orchestration, and semantic
  renderer viewport requests. It does not re-derive graph edges or persist
  renderer coordinates.
- `EntitySearch.tsx` performs bounded deferred search over the full canonical
  inspection index, independently from visible graph filters.
- `GraphFilters.tsx` maps practical path, content-kind, and reference-status
  controls directly to KG6 filter state.
- `ProvenanceInspector.tsx` presents canonical identity, breadcrumbs, exact
  occurrences, subtree relationships, roll-up explanations, diagnostics, and
  bounded relationship groups.
- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns report selection, report identity provenance, and transient
secondary diagnostic filters. `graph-state.ts` owns pure KG6 interaction transitions,
`navigation.ts` owns the verified target-reveal plan, and `report-view.ts` owns
secondary evidence transformations. `../persistence/` owns the localStorage
adapter and pre-autosave hydration; the source-neutral schema/reconciliation
lives in `packages/view-state`.
