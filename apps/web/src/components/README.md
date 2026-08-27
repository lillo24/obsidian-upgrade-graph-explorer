# Explorer Components

These components present the primary KG7 graph and secondary KG5 evidence. They
do not load files, validate JSON, alter canonical truth, or persist view state.

- `GraphExplorer.tsx` owns the report-scoped projection workspace, disclosure/
  focus controls, graph selection, and compact selection summary. It passes a
  completed KG6 projection to the renderer and does not re-derive graph edges.
- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns report selection, report-reset identity, and transient diagnostic
filters. `graph-state.ts` owns pure KG6 interaction transitions;
`report-view.ts` owns the secondary evidence transformations.
