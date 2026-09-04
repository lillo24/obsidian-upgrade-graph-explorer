# ADR 0020: Production modular Focus Hierarchy worker preview

## Status

Accepted. Product merge remains gated on optimized desktop graphical approval.

## Context

ADR 0019 selected the renderer-neutral A1 endpoint-facing layout and preserved
the richer computed payload for production integration. Classic Focus Hierarchy
already owns a stable React Flow interaction surface and a separate W3 Dagre
worker. Replacing that path in place would couple preview risk to the default,
duplicate interaction behavior, or pull modular dependencies into Classic
startup.

## Decision

1. Keep Classic and its W3 worker unchanged and default.
2. Expose Modular Preview through an additive global graph preference and a
   lazy Focus + Hierarchy component.
3. Run A1 in a separate versioned, strict, latest-result-wins worker. Validate
   input before compute and the complete result against its originating input.
4. Build HIER1 on the main thread only while the lazy preview is mounted. Derive
   worker dimensions from the renderer’s fixed card grammar.
5. Cache complete successful computed layouts in a bounded, exact,
   page-lifetime cache. Validate every hit and persist no coordinates.
6. Add a prepared-graph seam to the existing `GraphCanvas`, so both renderers
   share selection, hover, disclosure, keyboard, viewport, fit/center,
   transition-anchor, and accessibility behavior. Supplying a prepared graph
   bypasses Classic mapping and W3 work.
7. Keep modular mapping in a renderer subpath. Reuse Classic card data, apply A1
   geometry, add non-topological module backgrounds/filtered bridges, and map
   precise/fallback/diagnostic edges truthfully.
8. Retain a previous valid graph on transient failure. If none exists, fall back
   to Classic for the session without rewriting the preview preference.
9. Treat secondary relationships as transient edge presentation with zero
   influence on model, cache, worker, or node positions.
10. Preserve exact attachment semantics but leave final route ownership to
    HIER5 and folder-band positioning to HIER4.

## Consequences

The preview adds no external dependency and no KG9/persistence schema. The
default bundle keeps modular code behind a dynamic import and a separate worker
chunk. Renderer node/edge types now include truthful synthetic module/bridge
nodes and nullable fallback edge provenance, while Classic mapping output
retains its existing data and handle values.

The prepared-graph seam is durable for source-neutral validated renderer data,
but it does not let the app bypass interaction or camera contracts. HIER3C can
flip the product default without replacing the worker, cache, mapper, or shared
surface. Fallback connections remain visible but cannot open full projected-edge
Inspector provenance because none exists.

## Rejected alternatives

- Mutate W3 to carry the modular protocol: rejected because the payload,
  validation, ownership, and failure policy differ.
- Compute A1 synchronously in React: rejected because medium/hub evidence
  motivates isolated compute and latest-result-wins cancellation.
- Duplicate GraphCanvas for Modular: rejected because it would fork interaction,
  accessibility, and viewport behavior.
- Persist computed coordinates: rejected because they are derived geometry and
  the existing semantic bookmark already owns restoration.
- Make Modular the default in HIER3B: rejected because that decision belongs to
  HIER3C after native preview approval.
