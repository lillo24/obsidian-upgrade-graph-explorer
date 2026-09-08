# HIER4B validation

Status: **BAKEOFF READY — graphical decision pending.**

The HIER4B evidence is synthetic and development-only. It compares the new
Soft Folder Clusters macro layout with the unchanged production Directional
Folder Bands implementation on the same Focus Schematic inputs.

## Fixture coverage

SC1–SC24 cover a topology-only star, repeated folders, topology/folder conflict
and cooperation, disconnected same-folder modules, singleton and nested exact
folders, root-folder peers, three-hop chains, cycles, 20/50/100-leaf hubs,
parallel-reference saturation, a filtered bridge, 5–8-branch Adaptive Compass,
mixed authored directions, all five strengths, small perturbation, hide and
restore, reroot, Secondary mutation, a large mixed-folder graph, asymmetric
module rectangles, a topology-legitimate folder split, and free 2D placement.

The automated report contains 120 fixed fixture/strength rows, 15 hub stress
rows, five multiplicity rows, Directional Bands reference rows, and SC17–SC19
stability rows. Its hard gates require:

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
pnpm generate:focus-schematic-soft-cluster-lab -- --out output/hier4b-soft-clusters-lab
pnpm check
git diff --check
```

The generated JSON and lab remain ignored local evidence under `output/`. The
benchmark records wall-clock time for diagnosis, but timing is not a CI gate.
Graphical review should prioritize SC3, SC5, SC7, SC9, SC11, SC14, SC15, SC16,
SC17, SC21, SC23, and SC24. SC16 always renders all five strengths side by
side. Folder hulls, centroids, hop guides, module bounds, primary arrows,
internal-layout variants, and Heading-order policies can be toggled.

No adoption ADR is recorded at this stage because the repository uses the ADR
to capture the selected production architecture after graphical approval.
