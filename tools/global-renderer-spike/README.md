# Global Renderer Decision Spike

Status: **DRAFT — KG13A evidence harness; not a product renderer.**

This tool owns the isolated Sigma/Graphology candidate, deterministic synthetic
projections, production browser harness, ForceAtlas2 feasibility worker, and
projection-to-renderer correctness tests used for the KG13A decision. It consumes
plain KG6 `ViewProjection` data and never owns canonical truth, projection policy,
source acquisition, parsing, diagnostics construction, Tauri I/O, React Flow, or
Dagre.

```text
KG6 ViewProjection
  → mapping.ts             stable keys, visual attributes, deterministic seed positions
  → graph.ts               derived Graphology build and in-place reconciliation
  → session.ts             direct Sigma lifecycle, reducers, camera, selection
       └→ layout-worker.ts → ForceAtlas2 worker → derived x/y only
```

## File map

```text
index.html                  Accessible development-harness shell.
vite.config.ts              Production harness build boundary.
src/types.ts                Plain candidate input/output contracts.
src/mapping.ts              Projection-derived nodes/edges and seed positions.
src/graph.ts                Graphology construction, neighbor index, live reconciliation.
src/session.ts              Direct Sigma lifecycle and interaction measurements.
src/precision-wheel-zoom.ts Continuous, reversible precision-touchpad wheel scaling.
src/forceatlas2.worker.ts   Dedicated meaningful-layout computation.
src/layout-worker.ts        Explicit worker request/result and adoption boundary.
src/layout-sync.ts          Node-only reproducible R2 benchmark oracle.
src/fixtures.ts             Private-safe clustered/hub/isolate stress projections.
src/main.ts                 Browser QA controls, DOM search/Inspector fallback, metrics.
src/core.ts                 DOM-free exports for the diagnostic benchmark.
src/index.ts                Full browser-capable candidate exports.
src/mapping.test.ts         Stable-ID, provenance, update, and failure oracles.
src/precision-wheel-zoom.test.ts Wheel-unit, direction, and fine-delta oracles.
src/styles.css              Restrained overview and accessible control layout.
```

The harness deliberately uses direct Sigma rather than React Sigma: the candidate
instance and its high-frequency hover/camera state remain outside React, and
Graphology updates do not recreate the renderer. Labels are culled by Sigma,
edge events default off, selection maps back to projection/canonical IDs, and the
WebGL canvas is not presented as a false accessible graph tree. Search results,
selection details, and the Inspector remain ordinary DOM.

Sigma 3.0.3 normally converts every non-zero wheel event into one animated zoom
step. The harness intercepts that renderer event and applies every delta
directly to camera state; Sigma still coalesces rendering. This removes both the
library's activation throttle and the spike's earlier per-frame delta combining,
so tiny same-direction movements cannot cancel each other. A 0.5-pixel minimum
effective delta makes any non-zero event visible without increasing the normal
zoom scale. The continuous gain is deliberately gentle (`0.0017` per normalized
pixel). An opposite delta inside the same 90 ms input stream is treated as a
Windows touchpad inertia tail; after a quiet gap, even the smallest reversal is
accepted immediately.

ForceAtlas2 receives deterministic non-zero positions derived from stable projected
node IDs. Its coordinates are renderer data only. The spike neither persists them
nor changes KG9 view state. The benchmark may call the synchronous implementation
to isolate R2 wall time; interactive browser/Tauri use always calls the dedicated
worker.

## Commands

```bash
pnpm global-renderer:dev
pnpm global-renderer:build
pnpm benchmark:global-renderer -- --profile smoke
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:global-renderer -- --profile large
pnpm desktop:global-renderer:build
```

The optional 25k/50k mapping/build ceiling requires
`--profile large --include-25k`. Wall-clock results are local evidence, never CI
thresholds. Output is aggregate-only and is not written to disk.

The desktop command uses `apps/desktop/src-tauri/tauri.global-renderer-spike.conf.json`
to package this harness instead of the ordinary web application. That config is a
diagnostic extension only; normal browser and desktop commands remain unchanged.
