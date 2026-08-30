# ADR 0012: Keep W3 stateless and replace active obsolete layout work

**Status:** Accepted

## Context

KG12A measured Dagre as the first derived-renderer cliff: the small fully
expanded scene exceeded one second and blocked the main thread. Layout is pure
derived geometry, unlike W1's ordered cache and durable identity transaction.
Letting obsolete Dagre work finish wastes CPU and delays the geometry the user
actually requested. Folding W3 into W1 would also mix unrelated state,
lifecycles, and failure recovery.

## Decision

W3 is a dedicated stateless worker with a versioned structured-cloneable
plain-data protocol. `packages/dagre-layout` owns all Dagre configuration and
compute. The renderer maps projections on main, excludes diagnostic targets
from Dagre topology, sends entity dimensions and edges to W3, and applies the
returned positions before placing diagnostics deterministically.

The application lazily creates one worker and reuses it while idle. A new
request during active work settles the old request as superseded, terminates
that worker, and starts a replacement. Monotonic request and worker-generation
guards reject late responses. Protocol, computation, construction, clone, and
transport failures are explicit; the renderer adopts a deterministic grid and
never computes Dagre synchronously in production.

The first graph displays an accessible layout-progress state. Later requests
keep the last committed graph interactive while layout is pending. Disclosure
and Fit are temporarily disabled, and center, fit, saved viewport, and
disclosure-anchor effects run only for the generation whose geometry committed.

## Consequences

W1 remains stateful and sequential; W3 remains stateless and latest-result
wins. The main bundle does not contain Dagre, while tests and aggregate-only
benchmarks retain an explicit direct-compute subpath for exact coordinate
oracles. W2 projection and W4 inspection stay on the main thread. Layout wall
time and very large scenes remain KG13 evidence rather than a reason to add a
universal graph abstraction or replace React Flow during KG12.
