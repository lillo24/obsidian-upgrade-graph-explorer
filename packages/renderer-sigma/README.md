# Sigma Global/Regional Renderer

Status: **STABLE — KG13B1 production contracts are test-backed; Local is not implemented.**

This package owns the lazy, direct Sigma 3 renderer for file-level Global and
Regional exploration. It consumes a completed KG6 `ViewProjection`, derives a
replaceable Graphology graph, runs plain-data ForceAtlas2 plus a soft folder
prior, and keeps camera/hover/selection state inside one imperative renderer
session. It never owns canonical entities, KG6 projection policy, search,
inspection, source acquisition, Tauri, React Flow, Dagre, analytics, or saved
coordinates.

```text
documents-only KG6 projection
  → mapping.ts       stable renderer keys + workspace-relative folder metadata
  → graph.ts         derived Graphology graph + in-place reconciliation
  → session.ts       direct Sigma lifecycle, reducers, camera, precision input
  → layout.ts        serializable request → ForceAtlas2 + optional soft prior
  → application Worker → latest result → memory-only position cache
```

## File map

```text
src/
  types.ts                 Serializable settings, worker, renderer, and viewport contracts.
  settings.ts              Compact/Normal/Spacious presets and bounded Custom validation.
  mapping.ts               KG6-to-Sigma mapping, deterministic seeds, and folder keys.
  graph.ts                 Graphology construction, neighborhood index, and reconciliation.
  interaction-contract.ts  Operation-count oracle for camera/UI versus layout-triggering work.
  layout.ts                Worker-safe ForceAtlas2, folder-prior candidates, metrics, fingerprint.
  layout-cache.ts          Four-entry memory-only LRU of derived positions.
  lifecycle.ts             WebGL construction result and idempotent session lease.
  style.ts                 Far/Regional/Near LOD and built-in GROUP1-compatible style layer.
  precision-wheel-zoom.ts  Accepted 0.0017 gain, 0.5 px floor, and 90 ms reversal guard.
  session.ts               Imperative Sigma lifecycle and high-frequency interaction ownership.
  viewport-request.ts      Layout-commit gate for semantic center and Fit requests.
  GlobalGraphCanvas.tsx    Thin React mount/update boundary and background-layout adoption.
  styles.css               Canvas controls, progress/error surface, and reduced-motion rules.
  core.ts                  DOM-free mapping/layout/settings exports for tests and benchmarks.
  index.ts                 Browser-capable public API.
  *.test.ts                Mapping, layout, cache, LOD, settings, and precision contracts.
```

## Projection and spatial contracts

Global is documents-first. A section or block at this boundary is an error;
headings never enter Global layout. Reference edges remain the only semantic
edges. A document's normalized workspace-relative source path supplies a
layout-only `folderKey`: a root file uses `.`, and `folder/A.md` uses `folder`.
No folder node or folder-derived edge is invented.

Reference attraction and folder tendency are independent. Folder clustering
Off selects the reference-only baseline. On selects the evaluated Option A:
short ForceAtlas2 chunks alternate with a small deterministic folder-prior
adjustment. Compared with the one-shot offset-field Option B, the small
production evidence reduced within-folder distance while keeping cross-folder
reference length materially closer to the reference-only result. The prior is
soft: strong cross-folder references still affect geometry and no rigid boxes
or cluster topology exist.

`GlobalLayoutSettings` is plain JSON-compatible presentation state. Presets
cover ordinary use; Custom exposes only bounded link force, folder cohesion and
spacing, node size, link thickness, and label threshold. Settings are user
preferences, not canonical truth. Manual folder dragging and persistent node,
folder, or ForceAtlas2 coordinates are intentionally absent.

The layout fingerprint includes schema, algorithm, iterations, stable node
keys/sizes, reference endpoints/weights, folder assignment, and validated
settings. It excludes seed coordinates, labels, search, hover, selection, and
source text. Surviving coordinates warm a changed layout; an exact cache hit
skips worker computation. The cache is bounded and memory-only.

## Regional semantic zoom and lifecycle

Sigma camera ratio resolves to `far`, `regional`, or `near`. Camera movement
changes reducer styling and may schedule a Sigma render; it never asks KG6 to
project, rebuilds Graphology topology, or requests layout. Hover and selection
use the same reducer boundary. Style resolution is centralized so a future
GROUP1 layer can contribute color, marker, or label treatment before the final
interaction pass.

Stable projected IDs are Graphology keys. Live/filter changes reconcile nodes
and edges in place, preserve surviving positions and selection, seed additions
deterministically, and leave the current camera intact while a latest-only
worker relaxation runs. Folder moves update `folderKey` without changing the
canonical identity or synthesizing relationships.

An entry/search center or Fit request waits until Sigma has rendered its
matching background-layout coordinates, so seed or stale display coordinates
cannot be centered and then replaced out from under the camera. Once consumed,
that semantic request is not replayed by later live refinements; ordinary user
pan and zoom therefore remain intact.

The WebGL canvas is visual-only and `aria-hidden`. Product search, Inspector,
and Structure remain the accessible semantic surfaces. Sigma construction or
lazy-module failure must be reported to the application, which keeps Structure
usable for the session. Layout failure keeps the last valid positions visible
and reports an explicit error.

## Future Local seam

KG13B2 may use stable Global file coordinates as anchors for a bounded induced
subgraph and add Local Free/Structured presentation. It must not add headings to
Global topology or relayout the whole vault when local detail opens. Future
manual cluster offsets, Saved Views, QUERY1, and GROUP1 remain separate derived
or product layers; none are implemented here.

## Dependency boundary and validation

Production depends only on view-projection, React/React DOM, Sigma, Graphology,
and Graphology ForceAtlas2. ESLint rejects canonical, source, platform,
application, analytics/performance, React Flow, Dagre, and Node imports. React
Sigma is not used.

```bash
pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma
pnpm --filter @icarus-graph-explorer/web build
```
