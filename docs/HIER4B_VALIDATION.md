# HIER4B validation

Status: **HIER4B-FIX1 IMPLEMENTED — optimized real-vault graphical decision pending.**

The HIER4B evidence is synthetic and development-only. It compares the new
Soft Folder Clusters macro layout with the unchanged production Directional
Folder Bands implementation on the same Focus Schematic inputs.

The real Modular worker now also dispatches both macro families. A committed
source-neutral fixture covers a Focus File with five Heading branches, repeated
and singleton exact folders, incoming and outgoing references, Secondary
context, and a direct File reference. Worker validation covers all eight
macro/internal/Heading-order combinations plus Soft strengths 0, 50, and 100.
Directional results are compared byte-for-byte with the unchanged HIER4A call,
including requests that carry nonempty Soft scope state.
Cache tests prove Soft 25 and Soft 75 are distinct, that returning to 25 restores
the exact 25 geometry, and that stored Soft strength or scope does not change the
Directional key. Canonically equivalent Soft scope arrays share a key.
Browser-client tests terminate obsolete generations across
0→25→50→75→100 and Directional→Soft→Directional bursts.

Preferences remain in the existing v1 record. Tests cover the Directional/50/
Adaptive/Crossing defaults, Soft/75/Spine/Document round-trip, Sandbox reset,
numeric clamping, and invalid-value fallback. Real-vault timing and interaction
evidence is aggregate and local only.

Renderer validation derives Soft Folder guides after final layout at strengths
0, 25, 50, 75, and 100. It covers singleton, two-File capsule, three-File hull,
root-folder, filtered-module exclusion, deterministic input permutation, and
same-folder regions split by an intervening different folder. Every strength
case snapshots node positions before guide derivation and reruns the bounded
solver to prove identical convergence and geometry.

HIER4B-FIX1 adds strict sparse-scope helper tests for exact default, one-child
promotion, explicit sibling promotion, mixed granularity, repeated promotion,
merged-guide reset, and stale-key reconciliation. Persistence tests cover stable
A→B→A workspace isolation, reload, transient/legacy memory-only state,
corruption preservation, and last-confirmed-state retention after write failure.
Guide tests cover merged effective identity and keyboard-accessible promotion and
reset while the SVG hull remains hidden from accessibility and pointer input.

Cardinal attachment tests cover left/right/top/bottom use by one File, independent
target mirroring, 45-degree and coincident-center ties, recomputation after a
geometry move, preserved Heading semantics, the Directional default oracle, and
the exact cardinal crossing objective used by bounded candidate scoring. The
production renderer test proves Direct and Electronic reuse identical Soft
handles, and existing Secondary geometry tests continue to pass.

## Fixture coverage

SC1–SC24 cover a topology-only star, repeated folders, topology/folder conflict
and cooperation, disconnected same-folder modules, singleton and nested exact
folders, root-folder peers, three-hop chains, cycles, 20/50/100-leaf hubs,
parallel-reference saturation, a filtered bridge, 5–8-branch Adaptive Compass,
mixed authored directions, all five strengths, small perturbation, hide and
restore, reroot, Secondary mutation, a large mixed-folder graph, asymmetric
module rectangles, a topology-legitimate folder split, and free 2D placement.

The automated report retains 120 fixed fixture/strength rows, 15 hub stress
rows, five multiplicity rows, Directional Bands reference rows, and SC17–SC19
stability rows. HIER4B-FIX1 adds five deterministic scope profiles and three
cardinal geometry profiles without multiplying the solver candidate space. Its
hard gates require:

- exact root File anchoring;
- zero module overlap and valid node containment;
- byte-identical repeated cold runs;
- byte-identical geometry after input-order permutation;
- byte-identical strength-zero geometry after folder-key mutation;
- byte-identical geometry after removing Secondary-only references;
- fixed `36 + 18` relaxation accounting;
- zero declared Secondary geometry influence.

The multiplicity fixture verifies that 20 and 100 parallel references produce
identical geometry after the spring cap. Singleton folders produce identical
geometry at strengths 0 and 100. Across repeated-folder cases in the recorded
run, mean RMS folder radius decreased from about 326 px at strength 0 to 260 px
at 50 and 230 px at 100, showing progressive rather than categorical cohesion.

SC17's recorded strength-50 perturbation kept the median shared and unaffected
module displacement at 0 px; p95/max displacement was about 67 px for the one
affected shared module. SC18 and SC19 retain explicit hide and reroot evidence;
rerooting intentionally moves the coordinate frame because the new Focus File
must become `(0, 0)`.

## Recorded commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout
pnpm --filter @icarus-graph-explorer/focus-schematic-bakeoff typecheck
pnpm exec vitest run tools/focus-schematic-bakeoff
pnpm benchmark:focus-schematic-soft-clusters
pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm generate:focus-schematic-soft-cluster-lab -- --out output/hier4b-soft-clusters-lab
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

The generated JSON and lab remain ignored local evidence under `output/`. The
benchmark records wall-clock time for diagnosis, but timing is not a CI gate.
Graphical review should prioritize SC3, SC5, SC7, SC9, SC11, SC14, SC15, SC16,
SC17, SC21, SC23, and SC24. SC16 always renders all five strengths side by
side. Folder hulls, centroids, hop guides, module bounds, primary arrows,
internal-layout variants, and Heading-order policies can be toggled.

## HIER4B-FIX1 recorded result

On September 9, 2026, `pnpm check` passed 212 test files and 1,719 tests, all
workspace typechecks, lint, formatting, and the production web build. The Soft
benchmark passed all hard gates with 120 fixture rows, 15 stress rows, five
scope profiles, and three cardinal geometry profiles. Directional and Soft
small/medium worker profiles completed. `pnpm desktop:check` and
`pnpm desktop:build` both passed, and the optimized application launched.

Local browser smoke QA opened Modular Preview, switched Soft strength, exposed
and keyboard-dismissed the guide toolbar, and returned to Directional strips.
Final real-vault graphical approval is still required; HIER4B remains under
evaluation and no adoption ADR or PR exists.

The exact HIER4B-FIX1 prompt is archived at
`history-implementations/HIER4B_FIX1_per_folder_scope_cardinal_file_ports_codex_prompt.md`.
Its SHA-256 is:

```text
5BBD71E14BCE2D617547467C7310F68913B279336EA775E85DB1B9AD606F906B
```

No adoption ADR is recorded at this stage because the repository uses the ADR
to capture the selected production architecture after graphical approval.
