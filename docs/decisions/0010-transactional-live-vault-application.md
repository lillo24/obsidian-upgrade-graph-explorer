# ADR 0010: Commit live vault updates transactionally in the application

**Status:** Accepted

## Context

KG11B1 turns native watch hints into complete source-change plans, while KG10
can apply atomic source changes to an immutable engine. Connecting them directly
inside either package would mix platform acquisition, domain processing,
durable identity, and React lifecycle concerns. A live identity failure could
also leave the visible runtime ahead of its durable catalog.

## Decision

The plain application controller in `apps/web` is the only boundary that maps
KG11B1 plans to KG10. For Markdown changes it creates a candidate KG10 engine,
builds and validates a candidate in-memory report, persists the candidate stable
catalog, and only then publishes the matching runtime/report. Identity-write,
report, or internal domain failures retain the last committed state and pause
synchronization.

Provider `resync-required` results and one KG10 input/out-of-sync failure use a
complete source reinitialization with the current committed workspace ID and
catalog. The watcher stays active and the same promise queue serializes watch
batches with manual **Rescan Vault**, so changes observed during a resync run
after its commit. Manual rescan remains available because the pinned native
watcher does not surface every callback error to JavaScript.

Watching starts before one-shot discovery and buffers startup batches. Source
switches synchronously dispose the prior controller; stale work cannot publish
after disposal. A live report updates the mounted `GraphExplorer` in place
rather than changing its source-session key or rehydrating localStorage. The
source-neutral `view-state` package reconciles current disclosure, focus,
filters, and semantic viewport against each newer snapshot by stable IDs.

## Consequences

The selected vault remains read-only, while app-local catalog persistence is a
hard commit gate for an already-stable session. Full resync may be expensive but
never clears a valid graph while a candidate is being prepared. Live updates
retain current search, Inspector, selection when still projected, and KG9 view
context; missing identities are removed without fuzzy substitution.

KG11B2 completes KG11. Optimization, workers, incremental downstream indexes,
and performance budgets remain KG12 work and are not implied by this decision.
