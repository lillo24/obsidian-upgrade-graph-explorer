# CONVERGENCE1A — ForceAtlas2 Batch-Convergence Decision Spike

**Task type:** diagnostic/design spike / layout stability research / no production behavior change

## Goal

Choose an evidence-backed convergence policy for Icarus's ForceAtlas2 layouts before changing production behavior.

The observed problem is:

```text
legitimate layout run
→ graph moves toward a ForceAtlas2 state

same physics is run again from the accepted coordinates
→ graph moves a little more

repeat
→ weakly constrained / isolated nodes may migrate to another graph region
```

Current Icarus layouts stop after a fixed iteration count. The Obsidian simulation extraction shows a different lifecycle: it reheats only for semantic topology/physics changes, cools to a practical stop, then sleeps until another real perturbation.

The chosen Icarus direction is already narrow:

```text
keep ForceAtlas2
keep replacement/latest-wins workers
keep deterministic seeds and warm starts
keep exact-fingerprint caches

investigate bounded batched displacement convergence

no ForceAtlas2 fork
no persistent simulation worker yet
```

CONVERGENCE1A must resolve the remaining engineering questions:

1. How much do separate public `forceAtlas2.assign(...)` batches diverge from one continuous call because internal matrices reset at every call?
2. Which batch size is the best quality/performance compromise?
3. Which translation-normalized displacement metrics reliably mean “practically settled”?
4. How should degree-0 and degree-1 nodes be guarded without allowing one isolate to run the graph forever?
5. How many consecutive stable batches are needed?
6. What hard iteration and wall-time limits are appropriate by workload size?
7. How should Global's existing folder-prior macro-steps participate in convergence?
8. Should Local and Global share one policy implementation or only one lifecycle contract with mode-specific adapters?
9. What exact production changes belong in CONVERGENCE1B, and should Global require a separate CONVERGENCE1C?

Produce a recommendation and implementation-ready handoff. Do **not** enable convergence in production in this task.

---

# Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
16bbd2208593cb320c9ab57affafbf0b7dee0a11
```

This includes:

```text
PR #61 — GLOBALVIS1: visual controls are renderer-only
PR #62 — exact folder QUERY1 / Hide folder
PR #63 — SPATIAL2A hierarchical soft folder attractor foundation
```

Current open concurrent work:

```text
PR #60 — SPACING1B: density-aware Focus camera framing
status: draft / unmerged
```

PR #60 is camera/framing work. It touches Local renderer/session/types, diagnostics, Settings and docs. Preserve its branch/worktree and do not edit it.

Before branching and before merge:

1. inspect latest `main` and all open PRs;
2. if PR #60 merged, update this task onto its merge before final validation;
3. keep its camera-density policy separate from ForceAtlas2 convergence;
4. do not claim convergence fixes screen occupancy or camera framing.

Use an isolated task branch/worktree and preserve unrelated user changes.

---

# External research context

No external file is required to complete this task. The relevant findings from the completed Obsidian extraction are embedded below.

Do not access, copy, or commit extracted Obsidian proprietary source.

Source-derived findings:

```text
Obsidian 1.11.5 graph engine
→ custom long-lived worker
→ embedded WASM primary force simulator
→ inlined D3-force-lineage fallback

stop condition
→ alpha cooling only
→ alpha <= 0.001
→ approximately 300 ticks from alpha 1
→ no displacement / velocity / force-equilibrium test

reheat
→ topology and physics changes raise alpha to at least 0.3
→ visual-only changes do not reheat

while open
→ x/y, vx/vy and fx/fy survive semantic changes
→ closing the view discards them

drag
→ fx/fy pins node
→ alphaTarget 0.3 while held
→ whole graph responds
→ release unpins and cools to zero target

sparse/dense physics
→ no explicit total-node-count scaling of force strengths/distances
→ only new-node seed envelope grows roughly with sqrt(new-node count)
```

Important interpretation:

```text
Obsidian stability while unchanged
≠ proof of zero-force equilibrium

it is:
semantic restart gating
+
finite cooling
+
sleep after practical stop
```

The extraction recommends ForceAtlas2 batched displacement convergence, not alpha imitation, persistent workers, or a fork.

---

# Current Icarus layout evidence

## Focus / Local Free

Current production path:

```text
ViewProjection
→ Local topology
→ deterministic seed / live matching coordinates
→ one worker request
→ one public forceAtlas2.assign call
→ fixed iteration budget
→ translate root to (0,0)
→ return one final result
```

Current size-based iteration budget:

```text
<= 100 nodes  → 160 iterations
<= 500 nodes  → 100 iterations
> 500 nodes   → 60 iterations
```

Current ForceAtlas2 settings include:

```text
hierarchyWeight = 6
referenceWeight = 1
scalingRatio = 1.35
edgeWeightInfluence = 1
strongGravityMode = true
gravity = 0.08
Barnes-Hut at >= 600 nodes
```

## All / Global base automatic layout

Current base layout uses finite worker requests and one of:

```text
reference-only
chunked-prior
offset-field
```

Current size-based iteration budget:

```text
<= 1,000 nodes → 100 iterations
<= 5,000 nodes → 30 iterations
> 5,000 nodes  → 20 iterations
```

`chunked-prior` already divides the iteration budget into up to five public ForceAtlas2 calls and applies the folder prior between them.

Therefore Global already contains batch boundaries that reset ForceAtlas2's private matrices.

## Public ForceAtlas2 batch caveat

Installed:

```text
graphology-layout-forceatlas2 0.10.1
```

Static dependency inspection found that every public `assign` call reconstructs its node/edge matrices from graph coordinates and resets internal values such as:

```text
dx/dy
old dx/dy
convergence state
```

Therefore:

```text
one call × 160 iterations
```

is not guaranteed to equal:

```text
8 calls × 20 iterations
```

although both warm-start coordinates.

This difference must be measured rather than hidden.

## Current cache / warm-start behavior

Icarus already has useful properties that must be preserved:

```text
same fingerprint + cache hit
→ exact cached positions
→ no worker

physics/topology cache miss
→ warm-start surviving/current automatic positions

new nodes
→ deterministic seeds

visual-only changes
→ no layout after GLOBALVIS1
```

Global base automatic positions, SPATIAL2A dynamic pull positions, and downstream fixed folder placement have strict separate ownership.

---

# SPATIAL2A compatibility boundary

Current `main` includes a second All Network spatial pass:

```text
base automatic Global layout
→ optional dynamic Pull refinement worker
→ fixed Place translation
→ displayed Sigma positions
```

SPATIAL2A's dynamic Pull worker also alternates ForceAtlas2 chunks with bounded group-centroid translation.

CONVERGENCE1A's primary production target is:

```text
Focus Local layout
+
base Global automatic layout
```

Do not change SPATIAL2A behavior in this spike.

However, the report must determine:

1. whether a future shared convergence metrics module could safely serve SPATIAL2A;
2. whether base convergence changes any input/fingerprint assumption used by the dynamic pass;
3. whether dynamic positions must remain excluded from future base-layout warm starts and cache values — expected answer: yes;
4. whether SPATIAL2A should later receive a separate convergence task.

Do not fold base and dynamic workers into one simulation.

---

# Required output

Create:

```text
docs/CONVERGENCE1A_FORCEATLAS2_BATCH_SPIKE.md
```

Add a deterministic diagnostic command, likely:

```text
pnpm analyze:forceatlas2-convergence
```

Exact naming is flexible.

Generate local-only machine-readable and visual evidence under an ignored path such as:

```text
output/convergence1a/
```

Suggested outputs:

```text
convergence-results.json
convergence-comparison.html
```

Do not commit large generated output or private data.

---

# Phase 1 — Reproduce the reported drift

Build deterministic fixtures that make repeated finite-job drift measurable.

At minimum include:

## Focus fixtures

Reuse the established SPACING1A topology family where practical:

```text
2-node reference
3-node chain
3-node star
5-node chain
5-node star
5-node mixed + isolate
8-node weak / isolate-heavy
10-node mixed
20-node mixed
50-node mixed
two clusters + bridge
long chain
hierarchy-heavy
reference-heavy
```

## Global fixtures

Cover:

```text
small connected graph
small graph with isolates
medium mixed graph
folder clustering off / reference-only
folder clustering on / chunked-prior
multiple folders with cross-folder references
weakly connected folder clusters
```

Use current production seeds, node kinds, reference weights, folder keys and physics settings.

For each fixture:

```text
run current production budget once → A
run same physics again from A      → B
run again from B                   → C
```

Record normalized movement:

```text
A → B
B → C
```

Confirm whether weakly constrained nodes dominate the residual motion.

This establishes the current failure baseline.

---

# Phase 2 — One-shot versus public batching

For the same starting graph and total iteration budget, compare:

```text
one-shot N

N/20 batches × 20
N/32 batches × 32
N/40 batches × 40
```

Use totals that divide cleanly or account for the final remainder deterministically.

Test at least:

```text
100
160
320
640
```

and up to the current safe maximum of 1,000 where workload size permits.

Compare two batch execution forms:

```text
A. reuse one Graphology graph across public assign calls
B. rebuild Graphology from the prior batch's coordinates
```

Expected: both reset ForceAtlas2 private matrices; reusing Graphology may still avoid topology rebuild overhead.

Measure:

```text
endpoint geometry divergence from one-shot
per-batch displacement decay
runtime overhead
final residual movement under one additional probe batch
```

Do not treat one-shot high-iteration output as a mathematical truth. Use it as a long-run reference only.

---

# Phase 3 — Shared displacement metrics

Implement diagnostic-only pure metric helpers.

Match nodes by stable layout key and validate all coordinates.

## Focus alignment

Before comparing frames:

```text
translate each frame so root = (0,0)
```

Do not align rotation or scale.

## Global alignment

Record both:

```text
centroid-aligned shape displacement
raw centroid drift
```

Do not let rigid translation masquerade as shape instability, but do not silently ignore centroid drift either.

## Scale normalization

Normalize movement by deterministic graph scale, likely:

```text
RMS radius with a nonzero floor
```

Evaluate robust alternatives only if evidence shows RMS radius is unstable.

## Required distributions

Record:

```text
p50 movement
p90 movement
maximum movement
```

Also record degree classes separately:

```text
degree 0
degree 1
degree >= 2
```

At minimum include:

```text
low-degree p90
low-degree maximum
```

Do not let all-node p90 hide movement from a small isolate population.

---

# Phase 4 — Endpoint movement versus movement per iteration

A 40-iteration batch naturally has more opportunity to move than a 20-iteration batch.

Evaluate whether stopping should use:

```text
endpoint normalized displacement per batch

or

an iteration-normalized movement estimate

or

a batch-size-specific threshold
```

Do not assume linear movement per iteration.

Select the metric that remains interpretable and stable across candidate batch sizes.

---

# Phase 5 — Candidate stopping policies

Evaluate a bounded grid rather than guessing one policy.

## Batch sizes

At minimum:

```text
20
32
40
```

A smaller diagnostic batch may be included if useful, but avoid an enormous search grid.

## Consecutive stability

Evaluate:

```text
K = 2
K = 3
K = 4
```

## Thresholds

Choose candidate normalized p90 thresholds from the observed movement curves.

Do not bury arbitrary constants before collecting evidence.

The candidate rule should likely have this shape:

```text
general normalized p90 <= threshold
AND
centroid/root guard satisfied
AND
low-degree guard satisfied or explicitly bounded
for K consecutive completed batches
```

Do not use maximum displacement as the only stop criterion.

Do not allow one isolate to cause unbounded work.

## Hard limits

Every candidate requires:

```text
maximum total iterations
maximum wall time
```

Evaluate hard-limit families relative to current budgets and graph sizes.

A result must always expose why it stopped:

```text
stable
max-iterations
max-wall-time
degenerate
```

---

# Phase 6 — Probe-after-stop oracle

For every candidate that declares stability:

```text
run one additional hidden diagnostic batch
```

Measure how much the graph would move.

This directly tests the user's complaint:

> If I relayout again with the same forces, does the graph still visibly change?

A useful policy should make post-stop movement negligible on ordinary fixtures.

Do not include the probe batch in the candidate's accepted output.

---

# Phase 7 — Isolated-node policy

Compare at least these approaches:

```text
A. all-node p90 only
B. all-node p90 + low-degree p90 guard
C. all-node p90 + bounded low-degree maximum guard
```

Assess:

```text
false early stop
unnecessary extra work
one-isolate starvation
visible isolate migration after stop
```

The expected direction is a separate low-degree diagnostic/guard plus a hard cap, not a new physical force.

Do not add isolate tethers, angular slots, or force tuning in this task.

If convergence alone cannot make isolates stable enough, recommend a separate future isolate-placement design rather than contaminating all graph physics.

---

# Phase 8 — Global folder-prior macro-step decision

This is the most important mode-specific question.

Current `chunked-prior` semantics already alternate:

```text
ForceAtlas2 chunk
→ folder prior
→ ForceAtlas2 chunk
→ folder prior
...
```

Simply adding more convergence batches also applies the prior more times and can change product semantics.

Evaluate a small number of principled Global candidates:

## G1 — complete current algorithm as one macro-run

```text
current fixed Global pass
→ measure
→ optionally repeat whole pass
```

Risk: repeats all folder-prior applications and may over-accumulate spatial bias.

## G2 — convergence macro-batches with normalized prior application

```text
FA2 batch
→ appropriately normalized folder-prior step
→ measure complete macro-step
```

Risk: changes the current prior algorithm and requires clear gain normalization.

## G3 — current prior schedule followed by pure FA2 settling tail

```text
run current folder-prior schedule once
→ run pure ForceAtlas2 batches until stable
```

Risk: the pure tail may partially undo desired folder structure.

## G4 — mode split

```text
implement convergence for Focus first
retain current Global lifecycle temporarily
→ separate Global convergence task after more design
```

Do not force one answer.

Use current folder-quality metrics and visual comparison to determine whether Global can safely share CONVERGENCE1B or should become CONVERGENCE1C.

For Global measurement, evaluate displacement only after a complete chosen macro-step, not halfway through folder-prior behavior.

---

# Phase 9 — Cache and restart semantics

The spike must define the intended future contract.

Evaluate and recommend behavior for:

## Same topology + same physics, no explicit action

Expected:

```text
no layout request
exact positions preserved
```

## Return to a previous physics fingerprint

Expected when cache still contains it:

```text
restore exact settled cached coordinates
```

rather than reconverge from the current different-physics state.

## Explicit Rearrange / relayout

Current explicit relayout bypasses/deletes the cached result.

Decide whether future explicit relayout should:

```text
A. reconverge from current automatic positions
B. restart from deterministic seeds
C. offer separate actions later
```

Do not implement product UI here.

## Topology change

Expected:

```text
retain surviving automatic positions
seed only new nodes deterministically
converge from there
```

Keep SPATIAL2A dynamic and fixed displayed positions excluded from base warm starts.

---

# Phase 10 — Fingerprint / worker-result contract

Because convergence policy changes accepted coordinates, a future production fingerprint must include a versioned convergence policy identity.

The spike should recommend the exact future inputs, likely:

```text
algorithm version
batch size
stability threshold(s)
consecutive-stable count
hard iteration cap
any result-affecting macro-step policy
```

Wall-time budget may need special treatment because machine speed should not make cached geometry semantically unpredictable. Evaluate whether:

```text
wall time is safety-only
iteration cap is deterministic output boundary
```

This is likely preferable.

Recommend future result metadata, for example:

```text
stopReason
iterationsCompleted
batchesCompleted
stableBatches
final normalized p50/p90/max
lowDegree movement
centroid drift where relevant
computeMs
```

Do not change production worker protocol in CONVERGENCE1A.

---

# Phase 11 — Quality and performance comparison

For each serious candidate record:

```text
total iterations
total batches
wall time
batch-overhead percentage
stop reason
post-stop probe movement
final movement relative to long-run reference
edge-length distribution
node overlap / gross layout defects
Global folder-quality metrics where applicable
```

Use repeated deterministic runs where practical.

No CI timing thresholds.

For large profiles, omit unsafe exhaustive combinations explicitly rather than running uncontrolled multi-minute matrices.

The report must distinguish:

```text
quality decision
performance evidence
hard safety boundary
```

---

# Phase 12 — Visual comparison

Produce a deterministic local HTML/SVG comparison for representative cases.

At minimum show:

```text
current fixed-budget result
recommended candidate result
long-run one-shot reference
post-stop probe displacement
```

Include:

```text
small connected Focus
Focus isolate-heavy
Focus long chain
Global reference-only
Global folder-prior
```

For post-stop movement, use subtle displacement arrows or before/after overlays.

The artifact must:

- be self-contained;
- use synthetic/private-safe labels;
- make weak-node migration visible;
- avoid large committed binaries;
- document the exact command/path to open.

If two policies remain close, ask the user only for a concrete visual preference after presenting the evidence.

---

# Phase 13 — Compare with Obsidian at the correct level

The report should state clearly:

```text
Obsidian alpha cooling
→ fixed temperature schedule
→ no displacement test

Icarus candidate convergence
→ measures visible coordinate change
→ adaptive work
→ hard deterministic cap
```

Do not copy:

```text
alpha = 0.3
alphaMin = 0.001
300 ticks
60 Hz publishing
persistent velocities
```

unless a value independently proves useful for Icarus.

The target is equivalent product behavior:

```text
wake only on meaningful change
warm-start spatial context
settle enough
then remain still
```

---

# Decision requirements

End with one clear recommendation.

At minimum decide:

1. batch size;
2. displacement metric;
3. alignment/normalization method;
4. low-degree guard;
5. stable consecutive-batch count;
6. hard deterministic iteration cap policy;
7. wall-time safety policy;
8. Local implementation contract;
9. Global implementation contract or reason to split it;
10. cache-return behavior;
11. explicit-relayout behavior;
12. future result/fingerprint versioning;
13. whether SPATIAL2A dynamic pull needs later convergence work;
14. whether persistent workers are justified — expected only if evidence changes materially;
15. whether any ForceAtlas2 fork is justified — expected answer: no.

If the evidence cannot support exact numeric thresholds, do not pretend otherwise. Produce the smallest additional test needed or narrow the next task to a controlled production experiment.

---

# No production behavior change

CONVERGENCE1A may add:

```text
diagnostic fixture builders
diagnostic displacement metrics
analysis CLI
ignored JSON/HTML output
tests for diagnostic helpers
tracked decision report
prompt archive
```

It must not change:

```text
computeLocalLayout production behavior
computeGlobalLayout production behavior
worker request/response schemas
layout fingerprints
layout caches
iteration budgets
ForceAtlas2 settings
SPATIAL2A dynamic Pull
SPATIAL1/2 fixed/dynamic position ownership
Sigma camera or SPACING1B
renderer UI
```

If a reusable production-quality metric module is obvious, keep it diagnostic-only for now unless moving it into `renderer-sigma` is essential to test the exact production coordinate conventions. Explain any such narrow export.

---

# Likely implementation areas

Inspect current code before editing. Probable additions:

```text
tools/vault-diagnostics/src/forceatlas2-convergence-analysis.ts
tools/vault-diagnostics/src/convergence-fixtures.ts
tools/vault-diagnostics/src/convergence-metrics.ts
tools/vault-diagnostics/src/convergence-candidates.ts
focused tests beside those files

tools/vault-diagnostics/package.json
package.json

docs/CONVERGENCE1A_FORCEATLAS2_BATCH_SPIKE.md
history-implementations/CONVERGENCE1A_..._codex_prompt.md
```

Likely read-only production references:

```text
packages/renderer-sigma/src/local-layout.ts
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/spatial-influence.ts
LocalGraphCanvas.tsx
GlobalGraphCanvas.tsx
local/global worker clients
layout caches/fingerprints
SPACING1A fixtures/metrics
SPATIAL2A ADR and benchmark
```

Prefer new files over editing PR #60 overlap areas such as `LocalGraphCanvas.tsx`, `local-session.ts`, or existing focus-spacing implementation files.

---

# Scope

## In scope

- reproduce repeated finite-job drift;
- inspect and empirically test public ForceAtlas2 batch-reset behavior;
- compare one-shot versus 20/32/40 batching;
- root-aligned Focus displacement metrics;
- centroid-aligned Global shape movement + centroid drift;
- RMS/robust scale normalization;
- p50/p90/max movement;
- degree-0/1 guards;
- consecutive stable-batch policies;
- hard iteration and wall-time policies;
- post-stop probe batch;
- Global folder-prior macro-step options;
- cache/restart policy decision;
- fingerprint/result handoff;
- SPATIAL2A compatibility assessment;
- deterministic visual artifact;
- production implementation split recommendation;
- tests, docs, prompt archival, PR/CI/cleanup.

## Explicitly out of scope

- enabling convergence in production;
- changing existing iteration budgets;
- changing ForceAtlas2 settings;
- persistent worker protocol;
- node dragging;
- isolated-node tether/force;
- ForceAtlas2 fork;
- switching force libraries;
- SPACING1B camera behavior;
- Global/Focus visual controls;
- SPATIAL2A Pull behavior;
- folder Arrange/Place behavior;
- user-facing settings;
- Saved Views;
- unrelated KG14/HIER work.

---

# Suggested implementation sequence

1. Sync latest `main` and inspect open PRs/worktrees.
2. Read `AGENTS.md`, renderer-sigma architecture, SPACING1A report, SPATIAL2A ADR and current benchmark tooling.
3. Reproduce current A→B→C repeated-layout drift with deterministic fixtures.
4. Add pure frame-alignment and normalized displacement metrics.
5. Verify metric invariants and degenerate cases.
6. Compare one-shot against repeated public assign batches on the same graph and rebuilt graphs.
7. Capture per-batch movement curves for 20/32/40 iterations.
8. Evaluate p90 + low-degree guards and K=2/3/4.
9. Add hard-cap and post-stop probe evaluation.
10. Evaluate Global reference-only and folder-prior macro-step options.
11. Check SPATIAL2A compatibility without changing it.
12. Measure quality/performance on safe small/medium profiles.
13. Generate deterministic JSON + HTML/SVG evidence.
14. Write the tracked decision report and exact production handoff.
15. Run full relevant validation.
16. Archive this exact prompt.
17. PR → CI → integrate latest `main` if needed → merge → post-merge CI → cleanup.
18. Stop before production convergence implementation.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/vault-diagnostics typecheck
pnpm exec vitest run tools/vault-diagnostics

pnpm analyze:forceatlas2-convergence

pnpm benchmark:local-renderer -- --profile smoke
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm check
git diff --check
```

If no production desktop/runtime code changes, `pnpm desktop:build` is not inherently required. Follow the repository's current AGENTS/CI policy if it requires it.

No timing gate in CI.

---

# Exit gate

CONVERGENCE1A is complete only when:

1. current fixed-budget drift is reproduced deterministically;
2. connected and isolated-node movement are reported separately;
3. Local root alignment is implemented correctly;
4. Global centroid-aligned shape movement is implemented correctly;
5. Global raw centroid drift is separately reported;
6. graph-scale normalization is documented and tested;
7. p50/p90/max are reported;
8. degree-0/1 metrics are reported;
9. one-shot and public batched ForceAtlas2 are compared;
10. same-Graphology and rebuilt-Graphology batching are compared;
11. 20/32/40 batch sizes are evaluated;
12. current 60/100/160-style budgets are represented where relevant;
13. larger safe budgets up to 1,000 are examined where practical;
14. batch-reset divergence is quantified;
15. per-batch movement decay curves exist;
16. endpoint versus iteration-normalized movement is assessed;
17. K=2/3/4 stable-batch requirements are compared;
18. candidate thresholds come from evidence rather than arbitrary selection;
19. every policy has deterministic hard iteration limits;
20. every policy has a wall-time safety analysis;
21. every declared stable result receives a non-adopted probe batch;
22. post-stop residual drift is quantified;
23. isolate starvation versus early-stop tradeoff is assessed;
24. no new isolate force/tether is added;
25. Focus fixture family covers sparse/dense/chain/star/isolate/cluster cases;
26. Global reference-only is covered;
27. Global folder-prior behavior is covered;
28. folder-prior repeated-application risk is explicitly resolved;
29. Global is either given a precise production policy or explicitly split to a later task;
30. SPATIAL2A dynamic worker remains unchanged;
31. base/dynamic/fixed position ownership remains explicit;
32. cache-hit same-fingerprint semantics are preserved in the recommendation;
33. returning to an old cached physics fingerprint is addressed;
34. explicit relayout semantics are addressed;
35. topology warm-start semantics are addressed;
36. future fingerprint policy version inputs are specified;
37. future result diagnostics/stop reason are specified;
38. deterministic visual comparison exists;
39. exact command/path to open the artifact is reported;
40. no private vault data is committed;
41. no extracted Obsidian source is accessed/committed;
42. Obsidian cooling is compared without copying alpha numerically;
43. a single evidence-backed recommendation is made;
44. persistent worker decision is explicit;
45. ForceAtlas2 fork decision is explicit;
46. report specifies whether next work is one CONVERGENCE1B or Local/Global B/C split;
47. no production layout behavior changes;
48. no worker schema/fingerprint/cache production change occurs;
49. PR #60 is preserved and integrated only if it merged into `main`;
50. focused tests pass;
51. `pnpm check` passes;
52. analysis commands complete;
53. PR CI passes;
54. post-merge CI passes;
55. unrelated user files/worktrees remain untouched;
56. task branch/worktree cleanup completes;
57. prompt is archived;
58. production convergence is not started automatically.

---

# Final report

Report concisely:

## 1. Result

```text
Recommended batch size:
Recommended movement metric:
Recommended threshold:
Stable batches required:
Low-degree guard:
Hard iteration cap:
Wall-time policy:
```

## 2. Why repeated relayout drift occurs

Show current baseline evidence.

## 3. Public batching result

One-shot versus 20/32/40 batching and the practical effect of matrix resets.

## 4. Local recommendation

Exact production contract.

## 5. Global recommendation

Exact macro-step contract or reason to split Global into CONVERGENCE1C.

## 6. Cache/restart semantics

Same fingerprint, old-setting return, topology changes, explicit relayout.

## 7. SPATIAL2A compatibility

Base → dynamic → fixed ownership and any future follow-up.

## 8. Quality/performance evidence

## 9. Visual artifact

Exact local path/command.

## 10. Tests / files / dependencies

Expected external dependency additions: zero.

## 11. Next implementation plan

State one of:

```text
CONVERGENCE1B — implement shared Local + Global bounded convergence
```

or:

```text
CONVERGENCE1B — implement Local bounded convergence
CONVERGENCE1C — implement Global macro-step convergence
```

Do not start either automatically.
