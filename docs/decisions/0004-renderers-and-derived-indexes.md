# ADR 0004: Projected renderers and derived graph indexes

**Status:** Accepted

## Context

Early structural exploration and a future dense global overview may have different renderer needs. Persisting a renderer or graph-library object as truth would make the domain difficult to test, transfer to workers, or display elsewhere.

## Decision

Keep canonical snapshots library-independent and serializable. Renderers consume derived view projections. Plan React Flow as the first structural renderer. Introduce Sigma only if KG12/KG13 benchmarks demonstrate a separate high-density renderer is needed. Graphology may later support derived runtime indexes and algorithms but never canonical or persisted truth.

## Consequences

KG0 through KG2 install none of these libraries. Projection code must preserve canonical precision even when aggregating nodes or edges. Renderer selection remains replaceable and measurable rather than becoming a domain constraint.
