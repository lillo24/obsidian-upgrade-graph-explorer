# View State

Status: **STABLE — persisted and live-snapshot reconciliation are pure-test-backed.**

This package owns the renderer-independent, versioned saved-view contract and
its reconciliation against a current KG6 `ProjectionWorkspace`. It persists
only structural disclosure, focus, visible graph filters, and a semantic
canonical-entity viewport bookmark. It does not access storage, files, reports,
React, React Flow, diagnostics, or the KG9A identity catalog.

```text
current KG6 state + semantic bookmark → deterministic schema-v1 record
schema-v1 record + current workspace  → reconciled KG6 state + restore issues
current KG6 state + newer workspace   → reconciled live state + update issues
```

## File map

```text
src/
  types.ts       Persisted schema, validation, restore result, and issue contracts.
  validation.ts  Strict runtime shape, enum, path, and positive-zoom validation.
  restore.ts     Persisted hydration and source-neutral live reconciliation.
  persist.ts     Persistable-subset normalization and deterministic serialization.
  index.ts       Intentional public API.
  index.test.ts  Round-trip, evolution, determinism, and immutability coverage.
```

Unknown entity IDs, removed focus roots, obsolete path scopes, and missing
viewport anchors are dropped without inventing replacements. A workspace-ID
mismatch is rejected. `filters.text`, search, selection, renderer IDs, raw
viewport coordinates, layouts, source text, and timestamps are never stored.

Live reconciliation is separate from persisted hydration: it preserves the
current transient text filter and every still-valid disclosure, focus, path,
entity-kind, reference-status, and semantic viewport choice. Missing canonical
IDs and stale paths are removed deterministically before projection.

Schema v1 accepts structural `defaultDepth` values 0–3 plus an optional literal
Markdown heading ceiling. Existing schema-v1 records using depth 0/1 or omitting
the heading field remain valid; depth 2/3 round-trip without migration or a
schema bump. New records persist the ceiling only when active, and reset/default
state omits it.

The production dependency boundary is core plus view-projection only. Browser
`localStorage` is one outer adapter in `apps/web`, not part of this contract.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state
```
