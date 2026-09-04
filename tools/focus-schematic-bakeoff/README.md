# Focus Schematic Dagre bakeoff

This development-only Node tool reproduces the HIER2 comparison without
changing production rendering. It generates synthetic F1–F18, seeded holdout,
scale, stability, dynamic-layout, filtered-policy, source-order, route, and
visual evidence.

The accepted outcome is stateless Strategy A. D0 remains the Classic baseline,
B is retained as rejected evidence, and C remains honestly unbuilt because A
did not expose a defect meeting its material-improvement prerequisite.

```bash
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab
```

Medium and hub attempts run in disposable worker threads with hard timeouts.
Every strategy returns success, unsupported, failure, or timeout; incomplete
results never masquerade as candidates. Output uses synthetic identifiers and
aggregate metrics only.

## Source map

- `src/fixtures.ts` owns F1–F18, 24 seeded holdouts, scale profiles, and S1–S10.
- `src/dimensions.ts` is the tool-only adapter to the current extended Focus
  renderer dimensions and fails if its recorded 200×80, 184×72, 152×64
  baseline becomes stale.
- `src/strategies.ts` owns D0 Classic measurement, the rejected public compound
  Dagre prototype, common attempt scoring, and hard gates.
- `src/attempt-worker.ts` isolates potentially heavy strategy runs.
- `src/dynamic.ts` measures retained-graph `useDynamic` behavior separately
  from the cold stateless comparison.
- `src/benchmark.ts` runs bounded calibration and the named evidence profiles.
- `src/lab.ts` generates the self-contained HTML/SVG comparison lab.
- `src/strategies.test.ts` covers D0, compound output, dimensions, source order,
  filtered behavior, and secondary-edge isolation.

Generated output is ignored. The tool may depend on the renderer only through
its explicit tool-only dimension adapter; the reusable layout package cannot.
