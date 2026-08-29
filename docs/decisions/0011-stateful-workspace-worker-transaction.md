# ADR 0011: Keep W1 stateful and transactionally committed in a dedicated worker

**Status:** Accepted

## Context

KG12A measured whole-workspace KG10 and diagnostic construction at multi-second
large-workload cost. Running that stateful work on the UI thread violates the
intent of direct-interaction budgets. A naive latest-result-wins worker would,
however, break KG11's ordered cache, revision, and durable-identity transaction.
Large structured-clone messages can also create their own main-thread stalls.

## Decision

A dedicated W1 worker owns the KG10 engine, parsed-document cache, complete KG4
resolution, KG9A reconciliation, delta computation, and diagnostic report
construction. Its protocol is versioned structured-cloneable plain data. The
worker has one committed state and at most one pending candidate; same-workspace
requests remain sequential and revision-checked.

Main retains Tauri source acquisition/watching and private catalog persistence.
It prepares a worker candidate, durably persists the returned catalog, commits
that exact candidate, and only then adopts its report. Persistence failure
discards the candidate. A missing commit acknowledgement after persistence
terminates the worker and reinitializes a replacement from a fresh source scan
and the newly durable catalog before adoption.

Initialization/resync sources and large report/catalog arrays are transported
as small ordered structured-clone frames with event-loop yields. This is a
transport detail: the public request/result remains one validated transaction,
and no parsed IR, engine object, full delta, source path, or runtime correlation
identifier enters performance output.

## Consequences

Browser Sample/Open Report paths create no worker. Desktop runtimes no longer
expose the engine; the validated report supplies UI canonical truth. Worker
errors are distinguishable as protocol, workspace, diagnostics, transport,
terminated, or internal failures. W2 projection and W4 inspection remain on
the main thread under existing memoization.

W3 Dagre is not part of this stateful worker. KG12B2 must use a separate
stateless, derived, latest-layout-wins worker with stale-result rejection.
