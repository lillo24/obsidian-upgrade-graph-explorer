# Snapshot Delta

Status: **STABLE — KG10 exact diff/apply invariants are synthetic-test-backed.**

This source-neutral package derives and applies versioned plain-data changes
between two valid schema-v1 `KnowledgeSnapshot` values. Stable IDs classify
records as added, removed, updated, or unchanged; source-span and resolution
changes remain updates when an ID survives.

```text
previous stable snapshot + next stable snapshot
  → deterministic KnowledgeSnapshotDelta
  → exact application to previous
  → next stable snapshot
```

## File map

```text
src/
  types.ts       Versioned entity/reference collection-delta contracts.
  validation.ts  Strict untrusted-data and duplicate/index validation.
  diff.ts        Stable-ID classification and deterministic exact ordering.
  apply.ts       Stale-base checks, conflict checks, reconstruction, core validation.
  index.test.ts  Round-trip, ordering, corruption, and immutability coverage.
  index.ts       Intentional public exports.
```

Production code depends only on `@icarus-graph-explorer/core`. It has no parser,
source adapter, stable-identity catalog, UI, renderer, filesystem, or platform
dependency.

Each changed record carries its exact before/after value and source-array index.
An optional `afterOrder` appears only when a pure reorder of otherwise unchanged
records cannot be reconstructed from changed indexes. This keeps ordinary deltas
small while preserving the invariant:

```text
applyKnowledgeSnapshotDelta(old, diffKnowledgeSnapshots(old, next)) === next
```

Application rejects wrong workspaces, stale before records or indexes, ID
conflicts, malformed ordering, and an invalid resulting canonical snapshot.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/snapshot-delta typecheck
pnpm exec vitest run packages/snapshot-delta
pnpm check
```
