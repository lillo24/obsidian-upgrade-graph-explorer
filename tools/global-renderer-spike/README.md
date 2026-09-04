# Global Renderer Production Harness

Status: **STABLE — KG13A fixtures now exercise KG13B1 production code.**

This development-only browser/Tauri harness retains the deterministic KG13A
profiles, stress controls, DOM search/Inspector surface, and aggregate runtime
measurements. It no longer owns a renderer fork. Mapping, Graphology
reconciliation, direct Sigma lifecycle, semantic zoom, precision input,
settings, cache, and ForceAtlas2/folder-prior computation come from
`@icarus-graph-explorer/renderer-sigma`.

```text
synthetic fixtures.ts
  → production renderer-sigma mapping/session/settings/cache
  → layout-worker.ts → production renderer-sigma worker-safe compute
  → visual-only Sigma scene + DOM controls/evidence
```

## File map

```text
index.html                Accessible diagnostic shell and stress controls.
vite.config.ts            Production harness build boundary.
src/fixtures.ts           Private-safe product/stress KG6 projections.
src/main.ts               Production-session browser QA and aggregate measurements.
src/layout-worker.ts      Harness Worker transport over production layout contracts.
src/forceatlas2.worker.ts Worker entry that calls production layout computation.
src/core.ts               Production core re-export plus synthetic fixtures for Node benchmarks.
src/index.ts              Production browser API re-export plus fixtures.
src/styles.css            Diagnostic-harness presentation only.
```

SPATIAL1 adds development-only folder-key and normalized X/Y controls with
Apply, Reset folder, and Reset all actions. SPATIAL1B also exposes the
production session's exact-folder drag mode through Arrange Folders; it is a
thin synthetic QA trigger, not a duplicate gesture implementation. The evidence panel reports the
automatic frame, automatic folder center, normalized target, displayed rigid
translation, and automatic layout-request count. Anchor edits compose from the
retained automatic positions and therefore leave that request count unchanged.
All fixtures and output use generic synthetic folder keys. Production product
chrome remains in `GlobalGraphCanvas` and Network Explorer.

The harness is intentionally separate from product orchestration. It may expose
edge-event toggles, destroy/recreate, and stress profiles for evidence, but it
must not add alternate graph semantics or duplicate production renderer code.
The WebGL scene remains `aria-hidden`; DOM Search, Inspector, status, and native
controls remain the accessible evidence surface.

No coordinates, topology, queries, paths, workspace names, or source content
are written. Node benchmarks print synthetic aggregate counts, timings, and
folder-prior metrics only. Wall-clock values are investigative local evidence,
never CI thresholds.

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

The optional 25k/50k ceiling requires `--profile large --include-25k`. The
desktop command uses the explicit diagnostic Tauri configuration and does not
replace the ordinary product build.
