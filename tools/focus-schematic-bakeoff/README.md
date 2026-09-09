# Focus Schematic Dagre bakeoff

This development-only Node tool reproduces the HIER2 comparison without
changing production rendering. It generates synthetic F1–F18, seeded holdout,
scale, stability, dynamic-layout, filtered-policy, source-order, route, and
visual evidence. It also owns the focused HIER3A endpoint/lane benchmark and
graphical review lab.
It also owns the HIER4A categorical Directional Folder Bands benchmark and
graphical review lab. HIER4A-FIX1 compares document-order and
crossing-optimized graph-only Heading order, candidate-specific two-round joint
refinement, true post-reorder topology blocks, packed-height root balance, and
exact primary endpoint span. The rejected 0–100 directional-pull prototype
remains historical evidence only. HIER4A stays a development decision until
graphical approval selects categorical On and its Heading-order policy, or
retains pure A1.

HIER4A-FIX2 extends that same unmerged decision with an internal File-module
bakeoff: M0 Current, V1 Strict Vertical Spine, and C1 Adaptive Compass. The lab
defaults to V1 versus C1 side by side and keeps Folder Bands plus Heading-order
controls. Its evidence includes primary Manhattan/vertical span, internal
hierarchy crossings, File-relative branch regions, module width/height/area,
bounded candidate counts, and runtime. DB12 is neutral internal-layout pressure;
DB19 is the replacement true-blocked oracle after V1/C1 optimization. Metrics
remain evidence only until the user explicitly selects one grammar.

HIER4B adds a separate Soft Folder Clusters benchmark and graphical lab. It
compares the unchanged Directional Bands production reference with the
development-only 2D solver at strengths 0/25/50/75/100. HIER4B-FIX2 adds
HFA1-HFA7 nested-hierarchy cases, five sparse display-intent profiles, and the
H0 nearest/H1 normalized-decay/H2 normalized-equal force-policy bakeoff. H1 is
the selected internal policy because it preserves both child and parent
coherence while keeping each File's total folder-force weight at or below one.
The lab defaults to Soft / 50 / Adaptive Compass / Crossing optimized; SC16
renders all strengths side by side. HIER4B remains under graphical evaluation.

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
pnpm benchmark:focus-schematic-production-worker -- --profile medium --macro soft-folder-clusters --strength 50

pnpm benchmark:focus-schematic-directional-folder-bands -- --profile all --out output/hier4a-directional-folder-bands-benchmark.json
pnpm benchmark:focus-schematic-internal-layout -- --out output/hier4a-fix2-internal-layout-benchmark.json
pnpm generate:focus-schematic-folder-lab -- --out output/hier4a-fix2-internal-layout-lab

pnpm benchmark:focus-schematic-soft-clusters
pnpm generate:focus-schematic-soft-cluster-lab -- --out output/hier4b-soft-clusters-lab
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
- `src/production-worker-benchmark.ts` measures the production HIER3B/HIER4B
  protocol through real Node worker threads for small, medium, hub, and
  supersession profiles under either macro policy without defining a timing
  gate.
- `src/production-worker-thread.ts` hosts the production runtime for that
  worker-thread benchmark.
- `src/folder-benchmark.ts` compares categorical Off/On across FB1–FB18,
  DB1–DB19, document/crossing-order policy cases, 20/100 Heading stress,
  generated scale cases, FS1–FS8, height-weighted root balance, primary endpoint
  span, bounded candidate accounting, post-reorder topology overrides, hard
  gates, stability, runtime, and frozen revision-2 candidate hashes.
- `src/folder-lab.ts` generates the focused self-contained HIER4A review
  surface with exact interval guides, hierarchy/endpoint links, Off/On,
  Heading-order, M0/V1/C1 controls, side-by-side internal-layout comparisons,
  transparent quality metrics, and visible post-reorder override proofs.
- `src/internal-layout-benchmark.ts` reports the M0/V1/C1 trade-off table,
  bounded search counts, determinism, hard gates, DB12 reinterpretation, DB19
  proof, CP4 width pressure, and the fair CP5 Compass improvement case.
- `src/soft-cluster-benchmark.ts` measures SC1–SC24 across all strengths,
  Directional Bands references, stability pairs, multiplicity saturation,
  20/50/100-module hubs, five manual display-intent profiles, HFA1–HFA7 across
  H0/H1/H2 and all five strengths, operation counts, runtime, and hard
  invariants including the normalized per-File hierarchy-force budget.
- `src/soft-cluster-lab.ts` generates the self-contained HIER4B comparison with
  primary arrows, exact-folder hulls/centroids, hop guides, module bounds,
  internal-layout and Heading-order controls, and SC16's five-way view.
- `src/folder-lab.test.ts` verifies the required graphical-review cases,
  accessibility labels, and offline output.
- `src/endpoint-*.test.ts` covers the inherited HIER2 corpus and review-lab
  defaults/accessibility.
- `src/strategies.test.ts` covers D0, compound output, dimensions, source order,
  filtered behavior, and secondary-edge isolation.

Generated output is ignored. The tool may depend on the renderer only through
its explicit tool-only dimension adapter; the reusable layout package cannot.
