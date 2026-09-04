# Focus Schematic Dagre bakeoff

This development-only Node tool reproduces the HIER2 comparison without
changing production rendering. It generates synthetic F1–F18, seeded holdout,
scale, stability, dynamic-layout, filtered-policy, source-order, route, and
visual evidence. It also owns the focused HIER3A endpoint/lane benchmark and
graphical review lab.

The accepted outcome is stateless Strategy A. D0 remains the Classic baseline,
B is retained as rejected evidence, and C remains honestly unbuilt because A
did not expose a defect meeting its material-improvement prerequisite.
Historical HIER2 commands import the explicit A0 uniform-layout alias, so the
accepted HIER3A A1 package selection cannot rewrite the original bakeoff.

```bash
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab

pnpm benchmark:focus-schematic-endpoints -- --profile fixtures
pnpm benchmark:focus-schematic-endpoints -- --profile small
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub
pnpm benchmark:focus-schematic-endpoints -- --profile stability
pnpm benchmark:focus-schematic-center-spine
pnpm generate:focus-schematic-endpoint-lab -- --out output/hier3a-endpoint-lab

pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm benchmark:focus-schematic-production-worker -- --profile hub
pnpm benchmark:focus-schematic-production-worker -- --profile supersession
```

Medium and hub attempts run in disposable worker threads with hard timeouts.
Every strategy returns success, unsupported, failure, or timeout; incomplete
results never masquerade as candidates. Output uses synthetic identifiers and
aggregate metrics only.

The HIER3A lab defaults to A0/A1 side-by-side with precise endpoint arrows and
secondary links hidden. Its main controls are Scenario, Revision, View, and
Edges. Module/lane guides, secondary and approximate center links, native
macro route evidence, exact crossing/rank-inversion counts, and other quality
numbers live under Advanced details. Every
scenario explains the authored relationship, expected physical side behavior,
and what to inspect. Endpoint details are available through SVG focus and an
adjacent keyboard-accessible list. Generated output is gitignored.

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
- `src/endpoint-benchmark.ts` compares A0/A1 endpoint quality, determinism,
  exact crossing/rank-order metrics, phase timings, Dagre-call counts, payload
  sizes, and ES1–ES8 stability.
- `src/center-spine-benchmark.ts` reports revision-2 width/height, Dagre calls,
  crossings, inversions, and timing for CS1–CS6 plus 5/20/100-branch stress.
- `src/endpoint-attempt-worker.ts` bounds the 500-module A1 hub attempt.
- `src/endpoint-lab.ts` generates the focused self-contained HIER3A review
  surface with EP1–EP26 and ES1–ES8.
- `src/production-worker-benchmark.ts` measures the production HIER3B protocol
  through real Node worker threads for small, medium, hub, and supersession
  profiles without defining a timing gate.
- `src/production-worker-thread.ts` hosts the production runtime for that
  worker-thread benchmark.
- `src/endpoint-*.test.ts` covers the inherited HIER2 corpus and review-lab
  defaults/accessibility.
- `src/strategies.test.ts` covers D0, compound output, dimensions, source order,
  filtered behavior, and secondary-edge isolation.

Generated output is ignored. The tool may depend on the renderer only through
its explicit tool-only dimension adapter; the reusable layout package cannot.
