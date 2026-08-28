# View State

Status: **STABLE — UX3 heading preference and KG9B reconciliation are pure-test-backed.**

This package owns the renderer-independent, versioned saved-view contract and
its reconciliation against a current KG6 `ProjectionWorkspace`. It persists
only structural disclosure, focus, visible graph filters, and a semantic
canonical-entity viewport bookmark. It does not access storage, files, reports,
React, React Flow, diagnostics, or the KG9A identity catalog.

```text
current KG6 state + semantic bookmark → deterministic schema-v1 record
schema-v1 record + current workspace  → reconciled KG6 state + restore issues
```

## File map

```text
src/
  types.ts       Persisted schema, validation, restore result, and issue contracts.
  validation.ts  Strict runtime shape, enum, path, and positive-zoom validation.
  restore.ts     Current-workspace reconciliation with collapsed-wins semantics.
  persist.ts     Persistable-subset normalization and deterministic serialization.
  index.ts       Intentional public API.
  index.test.ts  Round-trip, evolution, determinism, and immutability coverage.
```

Unknown entity IDs, removed focus roots, obsolete path scopes, and missing
viewport anchors are dropped without inventing replacements. A workspace-ID
mismatch is rejected. `filters.text`, search, selection, renderer IDs, raw
viewport coordinates, layouts, source text, and timestamps are never stored.

Schema v1 accepts an optional literal Markdown heading ceiling in structural
disclosure. New records persist it when active; older schema-v1 records without
the field remain valid and restore as no limit. Reset/default state omits it.

The production dependency boundary is core plus view-projection only. Browser
`localStorage` is one outer adapter in `apps/web`, not part of this contract.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state
```
