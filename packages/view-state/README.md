# View State

Status: **STABLE — persisted and live-snapshot reconciliation are pure-test-backed.**

This package owns the renderer-independent, versioned saved-view contract and
its reconciliation against a current KG6 `ProjectionWorkspace`. Schema v3
persists structural disclosure, focus, visible graph filters, the current
presentation mode, and separate semantic Structure/Global/Local viewport bookmarks.
It does not access storage, files, reports, React, renderer libraries,
diagnostics, or the KG9A identity catalog.

```text
current KG6 state + presentation bookmarks → deterministic schema-v3 record
schema-v1/v2/v3 record + current workspace → reconciled KG6 state + restore issues
current KG6 state + newer workspace    → reconciled live state + update issues
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
Structure, Global, or Local anchors are dropped without inventing replacements. A workspace-ID
mismatch is rejected. `filters.text`, search, selection, renderer IDs, raw
viewport coordinates, renderer node IDs, layouts, ForceAtlas2 positions,
layout settings, source text, and timestamps are never stored.
An optional active QUERY1 string is stored inside the filters object after
canonicalization. Malformed queries are rejected; older records without the
field remain valid.

Live reconciliation is separate from persisted hydration: it preserves the
current transient text filter and every still-valid disclosure, focus, path,
entity-kind, reference-status, graph-query, and semantic viewport choice. Missing canonical
IDs and stale paths are removed deterministically before projection.

Schema v3 accepts structural `defaultDepth` values 0–3 plus an optional literal
Markdown heading ceiling, `presentationMode: structure | global | local`, a
Structure canonical anchor plus React Flow zoom, a Global canonical anchor plus
Sigma ratio, and a Local canonical anchor plus Free ratio and optional
Structured React Flow zoom. Each Local renderer updates its own scale while
preserving the other. Existing schema-v1
records migrate losslessly to Structure. Schema-v2 records preserve their
explicit Structure/Global renderer mode; an active focus does not guess Local.
Local restoration normalizes focus to a surviving containing document and exits
to Global if that root is lost. `LocalLayoutMode` remains a separate user
preference rather than saved semantic history. Raw coordinates, transition
points, renderer objects, Dagre/ForceAtlas2 positions are never accepted. Future schema versions
fail loudly. New records persist the heading ceiling only when active, and
reset/default state omits it.

The production dependency boundary is core, graph-query, and view-projection only. Browser
`localStorage` is one outer adapter in `apps/web`, not part of this contract.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state
```
