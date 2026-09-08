# HIER4A Validation

## Gate status

The production integration, automated tests, production-browser review,
optimized desktop check/build, and merge authorization passed on September 8, 2026. The accepted decision is `ADOPT_ADAPTIVE_COMPASS`, with Crossing optimized
as the default. HIER4B, HIER5, and HIER3C have not started.

## Automated coverage

The HIER4A suites cover:

- fresh defaults, persistence, Sandbox reset, obsolete Current/Mosaic migration,
  unknown-value migration, and all four supported policy combinations;
- strict protocol-v3 requests, policy/result agreement, Folder-Bands-On
  enforcement, worker/in-process determinism, and production benchmark transport;
- exact cache separation and restoration for Adaptive Compass/Vertical Spine
  crossed with Crossing optimized/Document order;
- Adaptive Compass on root and non-root expanded modules, whole-branch movement,
  nested structure, mixed endpoint demand, assignment caps, and deterministic
  large-module fallback;
- Directional Folder Band singleton, exact-folder identity, filtered bridge,
  joint endpoint/folder ordering, root balance, topology override, collision,
  containment, signed-rank, and zero-exception cases;
- DB5, DB11, DB12, DB14, DB17, DB19, FB4, and CP3 production regressions; and
- Modular-only settings UI, absence of Current/Mosaic, Classic independence,
  disclosure, and secondary-edge geometry invariance.

The release gates are:

```text
pnpm install --frozen-lockfile
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff
pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm benchmark:focus-schematic-directional-folder-bands
pnpm benchmark:focus-schematic-internal-layout
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Production-browser evidence

The actual web application was exercised through Focus + Hierarchy + Modular
Preview rather than the development lab:

- Classic remained the initial implementation and its disabled Modular policy
  controls showed the canonical defaults.
- Modular opened with Adaptive Compass and Crossing optimized selected.
- Source and Overview disclosure produced a centered File with structural
  Heading branches arranged around it and no overlap.
- Vertical Spine produced distinct valid geometry. Switching back restored all
  14 React Flow node IDs/styles byte-for-byte from the Adaptive Compass cache.
- Document order persisted through reload; restoring Crossing optimized applied
  immediately.
- Collapsing Overview removed Nested and reduced the graph from 14 to 13 nodes;
  expanding restored it to 14.
- Target and Source selection remained functional.
- Secondary On/Off left every node style byte-identical.
- The browser console contained no warnings or errors.

The user reviewed the actual browser graph and then authorized merge on
September 8, 2026.

## Performance evidence

The internal-layout benchmark covered 45 rows. Every hard gate and determinism
check passed. Across the 15 Adaptive Compass rows there were zero exact endpoint
crossings and zero folder exceptions; the restricted assignment cap remained 64
and the fixed large-module relocation limit remained four sweeps.

The Directional Folder Bands benchmark passed all hard gates across 47 On cases
and 1,113 visible Files. The benchmark includes the accepted topology-exception
cases, so aggregate exception counts are evidence rather than hidden fallbacks.

Production worker measurements on the release machine were:

| Profile | Modules | Nodes | Edges | Compute | Worker round trip |
| ------- | ------: | ----: | ----: | ------: | ----------------: |
| small   |       6 |    17 |    16 | 47.8 ms |          278.4 ms |
| medium  |       3 |    14 |    15 | 55.5 ms |          255.2 ms |

These are evidence, not fixed performance thresholds. The worker exposes total,
internal-variant, folder, ordering, assignment, fallback, and serialization
metrics through the existing performance telemetry.

## Desktop evidence

`pnpm desktop:check` passed. `pnpm desktop:build` built the optimized Tauri
application successfully after compiling the production web assets and the
native release target.

## Reproducibility

The exact implementation prompt is archived as
`history-implementations/HIER4A_FINAL_adaptive_compass_production_integration_codex_prompt.md`.
Its SHA-256 is:

```text
228117457460213E73E2E29C763E2F6D0BB5509C50632D96F83F1E1487595250
```

No external dependency was added.
