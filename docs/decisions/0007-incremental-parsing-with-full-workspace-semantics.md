# ADR 0007: Cache parsed documents while preserving full-workspace semantics

**Status:** Accepted

## Context

Reparsing every Markdown source after each local edit is avoidable, but KG4
reference resolution is a workspace operation. A target added, deleted, moved,
or structurally edited can change references authored in otherwise unchanged
documents. KG9A must also see the complete next snapshot to reconcile identity
conservatively. Treating an incremental file event as a local semantic update
would produce plausible but incorrect canonical truth.

Consumers need a small, serializable update contract, yet the schema-v1
canonical snapshot must remain the correctness source of truth. The product
filesystem watcher and event-coalescing policy do not exist until KG11.

## Decision

KG10 introduces an immutable Obsidian workspace engine that caches KG3 parsed
documents by normalized workspace path. Initialization parses every source.
Each atomic `upsert`/`delete`/`move` batch validates all path interactions
before staging; only upserts parse source text, while deletes and moves reuse
or remove cached parsed IR.

After staging, the engine always runs complete KG4 resolution and complete KG9A
reconciliation. It then derives a versioned, source-neutral delta between the
previous and next stable schema-v1 snapshots. Delta records are matched by
stable ID and retain exact before/after values and array indexes. Applying a
delta validates the expected base and the resulting canonical snapshot and
must reproduce the next snapshot exactly.

Any validation, parse, resolution, identity, or delta failure returns an
explicit failure without a next engine. The caller retains the prior immutable
engine, catalog, snapshot, and revision.

## Consequences

Source parsing cost is file-granular while semantic correctness remains easy to
compare against a full rebuild. Global resolution changes intentionally appear
as updates to stable references from unchanged source files. This requires
reference identity matching to use stable source owner, authored kind, and raw
target rather than current resolution state.

Resolution and reconciliation remain whole-workspace work in KG10; indexed
semantic invalidation is deferred until measurement demonstrates a need and an
equivalent correctness proof. Deltas do not replace canonical validation or
become a renderer contract.

KG11 must translate watcher events into atomic normalized batches. Supplying a
`move`, or coalescing a delete-plus-upsert before either commits, provides the
best rename continuity. The engine and KG9A deliberately do not guess across a
later add by retaining deleted tombstones. Filesystem access, watcher policy,
catalog persistence, worker scheduling, and UI subscriptions remain outside
this decision.
