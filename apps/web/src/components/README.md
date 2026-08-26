# Diagnostic Explorer Components

These presentation-only components inspect a validated KG5 report. They do not
load files, validate JSON, alter canonical truth, or establish future graph view
state.

- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns report selection and transient filters. `report-view.ts` owns the
pure view transformations supplied to these components.
