# React Flow Structural Renderer

Status: **STABLE — KG7 mapping, layout, and interaction contracts are pure-test-backed.**

This renderer package turns one KG6 `ViewProjection` into a deterministic,
read-only React Flow scene. It owns renderer IDs, fixed node geometry, Dagre
layout, semantic node/edge presentation, direct-neighborhood emphasis, viewport
controls, and accessible disclosure controls. It does not inspect canonical
references, roll endpoints, aggregate links, apply focus/filter policy, read
reports, access files, or persist view state.

```text
ViewProjection + renderer interaction state
  → one-to-one React Flow mapping
  → deterministic Dagre coordinates
  → structural or focus graph canvas
```

## File map

```text
src/
  types.ts               Renderer data, selection, layout, and component contracts.
  ids.ts                 Collision-safe projection-to-renderer tuple IDs.
  mapping.ts             One-to-one semantic React Flow node/edge mapping.
  layout.ts              Fixed-size Dagre layout and explicit grid fallback.
  highlight.ts           Direct incident-node/edge visual emphasis.
  prepare.ts             Pure mapping + layout benchmark/test entry point.
  disclosure-context.tsx Stable entity-disclosure callback boundary.
  nodes.tsx              Memoized entity and diagnostic custom nodes.
  edges.tsx              Memoized hierarchy/reference custom edge.
  component-maps.ts      Module-scope stable React Flow type maps.
  GraphCanvas.tsx        Read-only viewport, selection, hover, and fit behavior.
  styles.css             Node, edge, control, and reduced-motion presentation.
  *.test.ts              Mapping, layout failure, determinism, and highlight tests.
```

## Contract and layout

The mapper creates exactly one renderer node or edge for each projected node or
edge. It uses projection IDs only for semantics; React Flow IDs wrap them in
JSON tuples so node/edge namespaces cannot collide. Diagnostic targets remain
selectable terminals, and aggregated reference counts come directly from KG6
`referenceIds`. Internal collapsed references appear only as entity badges and
never as self-loop edges.

Structure mode uses a top-to-bottom Dagre layout. Focus mode uses left-to-right
layout. Entity nodes participate in Dagre topology; diagnostic targets are
placed deterministically beside their projected source so they do not distort
structural ranks. Every node type has a fixed measured size. A layout exception
becomes an explicit warning plus deterministic grid—not a success-shaped empty
graph.

The graph is deliberately not an authoring surface: nodes cannot be dragged or
connected, edges cannot be reconnected, and Delete is disabled. First render
fits the viewport; application-requested focus changes may fit again, while
ordinary disclosure does not aggressively reset the user's viewport. Motion
durations are zero and CSS honors reduced-motion preferences.

`onlyRenderVisibleElements` is intentionally left at React Flow's default.
KG7's local synthetic and real-report browser runs remained responsive, and the
option itself adds visibility-check overhead. KG12 may revisit this with an
explicit workload budget.

## Dependency boundary

Production code depends only on KG6 view projection, React, React Flow, and
Dagre. ESLint rejects canonical/core, source adapters, diagnostics, application,
filesystem, platform, Sigma, and Graphology imports. The `./prepare` subpath
exposes pure mapping and layout phases separately, so the opt-in benchmark can
measure both without mounting React or opening a browser.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web build
```
