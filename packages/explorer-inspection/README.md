# Explorer Inspection

Status: **STABLE — contract tests and synthetic/real-report browser consumers pass.**

This source-neutral package derives searchable entity descriptors and exact
relationship provenance from canonical truth plus the current KG6 projection.
It owns inspection indexes and plain read models, not projection semantics,
rendering, source loading, or application state.

```text
KnowledgeSnapshot + ViewProjection
  → InspectionWorkspace runtime indexes
  → entity/search/projected-selection read models
  → web provenance inspector
```

Its only dependencies are `@icarus-graph-explorer/core` and
`@icarus-graph-explorer/view-projection`. Production imports from React,
renderers, source-specific packages, filesystem/platform APIs, Graphology, and
Sigma are rejected by ESLint.

## File map

```text
src/
  types.ts                  Serializable public inspection contracts.
  workspace.ts              Validated canonical hierarchy/reference indexes.
  descriptors.ts            Breadcrumb, entity, occurrence, and span formatting.
  entity-inspection.ts      Subtree outgoing/backlink/candidate semantics.
  projection-inspection.ts  Visible node/edge and roll-up explanations.
  search.ts                 Deterministic bounded canonical entity search.
  index.ts                  Intentional public surface.
  test-fixture.ts           Neutral hierarchy/reference fixture.
  *.test.ts                 Index, provenance, search, and JSON contracts.
```

`InspectionWorkspace` builds maps and normalized search records once for one
validated snapshot. Maps remain runtime-only and are not exposed as canonical
or persisted data. All values returned to the UI are deterministic plain data.

## Semantics

Entity inspection uses subtree scope: a document represents its whole file and
a section represents itself plus nested descendants. Outgoing references retain
their exact authored source; backlinks include only resolved occurrences whose
exact targets are in the subtree. Ambiguous candidate mentions remain a separate
group and never become backlinks or chosen resolutions.

Projected edge inspection resolves the existing `referenceIds[]`; it never
reroutes or re-aggregates references. Comparing exact canonical endpoints with
visible projected endpoints explains source/target roll-up. Hierarchy edges
describe containment without fabricating reference provenance. Diagnostic nodes
and edges retain raw targets, reasons, exact occurrences, and candidates.

Search covers canonical document basenames/paths, section titles/breadcrumbs,
and neutral block path/line labels. It is deterministic case-insensitive exact,
prefix, and substring matching—not Markdown body, fuzzy, or semantic search.
The default result limit is 30.

Source Markdown text is unavailable in report mode. Inspection exposes only
canonical paths, spans, breadcrumbs, raw reference targets, and resolution data.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/explorer-inspection typecheck
pnpm exec vitest run packages/explorer-inspection
```
