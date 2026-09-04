# CONVERGENCE1B — Production Focus Network Bounded ForceAtlas2 Convergence

**Task type:** production layout-lifecycle implementation / worker protocol hardening / stability fix

## Goal

Replace Focus + Network's fixed one-shot ForceAtlas2 budget with the bounded convergence policy selected by CONVERGENCE1A.

Current behavior:

```text
warm/deterministic positions
→ one ForceAtlas2 call for a fixed node-count budget
→ accept wherever that budget ends
```

Target behavior:

```text
warm/deterministic positions
→ reuse one Graphology graph
→ run public ForceAtlas2 in 32-iteration batches
→ measure root-aligned normalized movement after each completed batch
→ accept after 3 consecutive stable batches
   OR after the deterministic iteration cap
→ return one final result to the existing latest-wins worker client
```

The product outcome is:

```text
true Focus topology/layout change
→ settle substantially further before adoption
→ one later identical relayout causes negligible residual movement

no semantic change
→ no worker request
→ exact positions remain still
```

This task is **Local / Focus Network only**.

Do not change All + Network base layout, SPATIAL2 dynamic Pull, ForceAtlas2 settings, camera density, or introduce a persistent simulation worker.

---

# Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
e51f52ed11ae8b3a5ff233e4e50a3c1eb268f60c
```

That is merged PR #66:

```text
CONVERGENCE1A — ForceAtlas2 batch-convergence decision spike
```

Relevant current tracks:

```text
CONVERGENCE1A  complete
CONVERGENCE1B  this task — Local bounded convergence
CONVERGENCE1C  later — Global folder-macro convergence
```

Open concurrent work at plan-writing time:

```text
PR #60 — SPACING1B density-aware Network camera framing
PR #67 — SPATIAL2B dynamic Pull hierarchical rule editor
```

PR #60 overlaps Local renderer/session/types and must be preserved carefully. PR #67 is predominantly All Network spatial UI/worker work.

Before branching and again before final merge:

1. inspect latest `main` and open PRs;
2. use an isolated task worktree;
3. do not edit/reset/delete either concurrent branch/worktree;
4. if PR #60 merges, update CONVERGENCE1B onto its merge and preserve its density/camera ownership exactly;
5. if PR #60 remains unmerged and CONVERGENCE1B is merged first, clearly state that PR #60 must rebase and repeat its Local native QA;
6. avoid unrelated HIER3, SPATIAL2B, MOVE1B, PHYSICS1, and KG14 work.

No external context is required. The accepted decision is tracked in:

```text
docs/CONVERGENCE1A_FORCEATLAS2_BATCH_SPIKE.md
```

---

# Accepted convergence policy

Implement this policy exactly unless current repository evidence reveals a correctness conflict. Do not retune it during implementation.

```text
Algorithm identity:
  local-fa2-convergence-v1

Batch size:
  32 ForceAtlas2 iterations

Stable batch:
  root-aligned all-node normalized p90 <= 0.00512
  AND
  if any degree-0/1 nodes exist:
    normalized low-degree maximum <= 0.01024

Acceptance:
  3 consecutive stable completed batches
  OR deterministic iteration cap reached

Iteration caps:
  <= 100 nodes    → 1,000
  101–500 nodes   → 600
  > 500 nodes     → 240

Scale:
  previous completed frame's RMS radius around the Focus root
  floor = 1e-6

Wall-time safety:
  production starting limit = 2,000 ms
  checked between completed batches
  safety-only; excluded from layout identity
  timeout = explicit non-cacheable failure
```

CONVERGENCE1A evidence:

```text
19/19 reference fixtures stabilized
0 false early stops
hidden-probe median p90 = 0.00240
hidden-probe maximum p90 = 0.00478
current fixed-job median drift = 0.0842
```

---

# 1. Production convergence module

Move or independently reimplement the accepted diagnostic definitions in a production-owned, renderer-neutral-enough module inside `packages/renderer-sigma`.

Likely shape:

```text
local-convergence.ts
```

Exact names are flexible.

It should own:

```text
policy constants and version
node-count → deterministic cap
root-aligned frame normalization
RMS scale with 1e-6 floor
undirected unique-neighbor degree index
p50 / p90 / maximum movement distributions
all / degree-0 / degree-1 / degree-2+ / low-degree metrics
stable-batch decision
lifecycle counters / stop reason
```

Do not import production behavior from `tools/vault-diagnostics`.

The diagnostic tool may later import the production module or compare against it to prevent drift, but production must not depend on tools.

Prefer one canonical implementation after this task rather than two silently diverging formulas. A narrow relocation/refactor from diagnostic helpers is acceptable if package boundaries remain correct.

---

# 2. Exact movement semantics

Given previous and current raw ForceAtlas2 frames:

```text
previous root position = Rp
current root position  = Rc
```

For each node:

```text
previousRelative = previousNode - Rp
currentRelative  = currentNode - Rc
movement = distance(previousRelative, currentRelative) / previousRmsRadius
```

Where:

```text
previousRmsRadius = max(
  1e-6,
  sqrt(mean(distance(previousNode, Rp)^2))
)
```

Hard requirements:

- same stable node keys in both frames;
- no rotation alignment;
- no scale alignment;
- no centroid alignment for Local;
- root translation is removed only for comparison;
- root itself must normalize exactly to `(0,0)` at final output;
- invalid/non-finite/missing/duplicate coordinates fail loudly.

Percentile behavior must match CONVERGENCE1A's selected diagnostic definition.

---

# 3. Degree semantics

Degree is used only for the low-degree convergence guard.

Build an undirected unique-neighbor index from Local layout edges:

```text
A → B
B → A
multiple projected edges A → B
```

must not inflate the number of unique adjacent nodes beyond one neighbor.

Classify:

```text
degree 0
degree 1
degree >= 2
```

The selected guard is:

```text
if lowDegree.count == 0
→ guard passes

otherwise
→ lowDegree.maximum <= 0.01024
```

Do not modify ForceAtlas2 edge weights or add a physical isolate force.

---

# 4. Batched ForceAtlas2 execution

Refactor `computeLocalLayout(...)` so one request:

1. validates input;
2. builds **one** Graphology graph;
3. computes the degree index once;
4. snapshots the initial root-aligned frame;
5. repeatedly calls public `forceAtlas2.assign(graph, { iterations: batchIterations, ...existing settings })`;
6. snapshots and measures after each completed batch;
7. tracks consecutive stable batches;
8. stops according to the selected lifecycle;
9. root-normalizes and rounds only once at the final production boundary.

Do not rebuild Graphology between batches.

Preserve current ForceAtlas2 settings exactly:

```text
hierarchy/reference weighted edges
Barnes-Hut threshold
edgeWeightInfluence
scalingRatio
strongGravityMode
gravity
```

Do not use package-private ForceAtlas2 matrix APIs.

The accepted public-batch reset behavior is part of `local-fa2-convergence-v1`.

---

# 5. Final partial batch at deterministic cap

The selected caps are not all multiples of 32.

Use:

```text
batchIterations = min(32, cap - iterationsCompleted)
```

for the final partial batch.

A partial cap-ending batch may update final movement diagnostics, but it must not be treated as evidence equivalent to a full 32-iteration stable batch unless the accepted CONVERGENCE1A implementation already did so.

Inspect the diagnostic candidate runner and preserve its exact selected semantics. Add a focused test for caps:

```text
1,000 → final 8-iteration batch if required
600   → final 24-iteration batch if required
240   → final 16-iteration batch if required
```

Stop reason at cap is:

```text
max-iterations
```

whether or not the final partial batch individually satisfies the thresholds before three accepted stable batches were accumulated.

---

# 6. Degenerate Local graphs

For a validated single-node Local graph:

```text
root only
→ 0 ForceAtlas2 iterations
→ position exactly (0,0)
→ stopReason = degenerate
→ batchesCompleted = 0
→ stableBatches = 0
```

Local request validation should still require the root to exist.

Zero-node Local requests remain invalid unless current canonical Local invariants explicitly allow them. Do not manufacture a result without a root.

Two-node and zero-edge/multi-component graphs must use the ordinary convergence lifecycle safely.

---

# 7. Wall-time failure semantics

The 2-second limit is a **safety abort**, not a geometry selector.

Implementation requirements:

```text
check elapsed time only between completed batches
never interrupt ForceAtlas2 mid-call
```

If elapsed time exceeds the limit before a stable/cap result is accepted:

```text
return/throw explicit max-wall-time failure
no positions are accepted
no cache write
last valid displayed Local positions remain
initial deterministic/warm geometry remains if no prior accepted result exists
```

Do not return a successful partial layout.

Do not include wall-time value or timing result in layout fingerprint/cache identity.

Make the clock and timeout injectable for deterministic unit tests while production uses `performance.now()` and 2,000 ms.

A timeout failure should expose enough structured information for tests/logging, preferably:

```text
failure code/reason = max-wall-time
iterationsCompleted
batchesCompleted
last completed movement diagnostics where available
```

Do not expose raw source/private data.

---

# 8. Result and failure contracts

Extend the Local worker contract to carry convergence evidence.

A successful result should include equivalents of:

```ts
stopReason: 'stable' | 'max-iterations' | 'degenerate'
policyVersion: 'local-fa2-convergence-v1'
iterationsCompleted: number
batchesCompleted: number
stableBatches: number
finalMovement: LocalConvergenceMovement | null
computeMs: number
positions: ...
```

`finalMovement` should include at least:

```text
scale
all p50 / p90 / maximum
degree0 distribution
degree1 distribution
degree2Plus distribution
lowDegree distribution
```

Keep values plain JSON/structured-clone safe.

For `stable`:

```text
stableBatches >= 3
final all p90 <= 0.00512
low-degree maximum guard passes
```

For `max-iterations`:

```text
iterationsCompleted == deterministic cap
```

For `degenerate`:

```text
one expected node
0 iterations
0 batches
null/explicit-zero movement per chosen strict contract
```

The client validator should validate against the originating request/policy, not only `requestId` and a loose node-key list, if needed for strong consistency.

Malformed stop metadata must reject the worker result and preserve current graph state.

A schema bump is likely warranted because the worker result/request semantics change. Inspect repository conventions and choose the smallest explicit versioning change; do not silently keep `schemaVersion: 1` while changing its contract incompatibly.

---

# 9. Request and policy ownership

Remove the old product meaning:

```text
LocalGraphCanvas chooses one fixed iteration count
```

Centralize convergence policy in renderer-sigma.

Preferred request semantics:

```text
createLocalLayoutRequest(input)
→ includes a versioned deterministic convergence policy
→ maxIterations derived from node count
```

The UI should not choose thresholds or batch size.

There is no user-facing convergence setting.

The wall-time limit may remain worker/runtime configuration rather than a fingerprinted request field because timeout never produces accepted geometry.

---

# 10. Fingerprint and cache versioning

The Local layout fingerprint must change for this production algorithm.

Include every result-affecting convergence field, directly or through one explicit algorithm version:

```text
local-fa2-convergence-v1
batch size 32
p90 threshold 0.00512
low-degree threshold 0.01024
stable batches 3
node-count cap / computed maxIterations
root-alignment version
RMS scale version and 1e-6 floor
current ForceAtlas2 settings/topology/node-kind/size inputs already owned by layout
```

Exclude:

```text
wall-clock timeout
computeMs
stop diagnostics
camera/density settings
visual styles
per-file display multipliers
selection/hover
```

Use a new fingerprint prefix/version so old fixed-budget memory-cache entries cannot masquerade as settled convergence results.

No durable migration is required because Local layout cache is memory-only.

---

# 11. Cache and restart behavior

Preserve these semantics:

## Same fingerprint, ordinary revisit

```text
exact cache hit
→ apply exact settled positions
→ 0 worker requests
```

## Return to an older still-cached fingerprint

```text
restore its exact settled coordinates
```

Do not warm-start and reconverge when the exact cache entry exists.

## Explicit relayout/rearrange

Preserve current meaning:

```text
bypass/delete exact cache entry
→ start from current automatic Local coordinates
→ run full convergence lifecycle
```

Do not reset to deterministic seed unless a separate future action is designed.

## Topology/depth/hops/query change

```text
matching nodes retain current positions through existing Local session/request path
new nodes use deterministic seed
→ converge candidate
```

Do not feed camera coordinates or display-only size overrides into the base layout.

---

# 12. Latest-result-wins worker behavior

Keep the current replacement-worker contract:

```text
one active Local request
new request supersedes old
old worker terminates
stale result cannot adopt
```

Do not create a persistent simulation worker.

The complete convergence lifecycle runs inside one replacement worker request and sends one success/failure response.

Do not stream every batch to the UI.

The graph should continue showing its immediate seed/last valid layout while convergence runs off-main.

---

# 13. Local canvas adoption

`LocalGraphCanvas` should continue to:

```text
show immediate deterministic/current geometry
show nonblocking refining status
adopt only one validated final result
write cache only after successful result
preserve previous geometry on failure
```

Update it only as needed for the new request/result semantics.

Do not make it render intermediate batches.

Do not automatically Fit merely because convergence took more batches.

Preserve current:

```text
selection
transition anchoring
semantic viewport
history
Focus root
layout status/error behavior
```

If PR #60 is merged, preserve its automatic/user-owned density-camera behavior exactly. Convergence determines accepted coordinates; SPACING1B determines camera framing over those coordinates.

---

# 14. Interaction with MOVE1A / future PHYSICS1

Current main includes MOVE1A temporary File movement foundations and future temporary-constraint ports, but no production physical simulation adapter.

CONVERGENCE1B must not:

```text
activate File dragging
consume temporary constraints inside base convergence
add reheating/cooling UI
add persistent pinning
```

Document that CONVERGENCE1B settles finite Local layout jobs. A later PHYSICS1/MOVE1B task may build a different interactive lifecycle on top of approved constraint seams.

Do not claim this task delivers continuous simulation.

---

# 15. Global and SPATIAL2 boundaries

Do not change:

```text
computeGlobalLayout
Global base iteration budgets
Global layout fingerprints/caches
SPATIAL2A dynamic Pull worker
SPATIAL2B product editor
fixed Place composition
```

CONVERGENCE1C owns Global macro-step design because repeated folder-prior application changes product semantics.

Production shared code may expose generic movement primitives usable later, but do not route Global through the Local convergence loop.

---

# 16. Diagnostic parity

Prevent the accepted CONVERGENCE1A oracle from drifting away from production.

Preferred options:

```text
A. move shared pure Local metrics/policy into renderer-sigma and have diagnostics import them
or
B. retain diagnostic implementation but add strict parity tests against production exports
```

Choose the cleaner package boundary.

After implementation, rerun:

```text
pnpm analyze:forceatlas2-convergence
```

The selected fixture outcomes should remain consistent. Update the report only for production validation evidence, not to retune the policy.

---

# 17. Required tests

## Pure policy/metrics

Cover:

```text
root translation invariance
rotation not ignored
scale change remains visible
RMS floor
percentile interpolation
key mismatch / duplicate / non-finite rejection
unique-neighbor degree counting
degree 0/1/2+ distributions
no-low-degree guard
threshold boundary equality
K=3 consecutive stability
stable counter resets after one unstable batch
cap selection 100/101/500/501
final partial batches 8/24/16
```

## Compute lifecycle

Cover:

```text
single-node degenerate
small graph stable before cap
fixture that reaches cap
low-degree guard delays early acceptance
one Graphology graph reused across batches
32-iteration public calls
final output root exactly (0,0)
round only final output
all positions finite and complete
same run deterministic within current tolerance
```

## Timeout

Inject clock/time behavior:

```text
timeout between batches
explicit max-wall-time failure
partial positions not returned/cached
previous Local view preserved
```

## Worker validation/client

Cover:

```text
valid stable result
valid max-iterations result
valid degenerate result
invalid policy version
inconsistent iteration/batch counters
false stable thresholds
missing movement fields
malformed node set
structured timeout failure
supersession and disposal
```

## Canvas/cache integration

Cover:

```text
initial cache miss → one worker → one adoption
cache hit → zero worker
return to old fingerprint → exact cached layout
explicit relayout → bypass cache and converge
worker timeout → no cache write, old positions remain
topology change → surviving warm positions + deterministic new seed
visual/group/per-file-size/camera changes → zero layout
```

## Residual-drift regression

For representative Focus fixtures:

```text
run production convergence → A
run one hidden 32-iteration probe from A → B
measure root-aligned movement
```

Require:

```text
all p90 <= 0.00512 for stable-stop results
low-degree maximum <= 0.01024 where applicable
```

For cap-stop cases, report/assert the expected weaker contract rather than falsely labeling them stable.

---

# 18. Performance and responsiveness

Update Local renderer benchmarks to report:

```text
stop reason
iterations completed
batches completed
stable batches
computeMs
final p90
low-degree maximum
```

Run at least:

```text
smoke
small
medium
```

Add a safe >500-node convergence profile if existing medium does not cover that cap class.

Expected tradeoff:

```text
more total worker computation than old fixed budgets
but off-main and substantially lower residual drift
```

Do not introduce a flaky timing gate.

Check that the main thread remains responsive while the replacement worker runs.

If the 2-second production timeout fails ordinary supported workloads, do not silently raise it. Report the evidence and stop for a design decision unless a tiny evidence-backed adjustment is clearly within the accepted policy's “starting limit” wording.

---

# 19. Manual/browser/native QA

This is mainly a worker/layout task, but production behavior should be checked.

Recommended scenarios:

```text
Focus + Network on small connected graph
Focus + Network with isolates / weak nodes
Focus depth/hops changes
query/filter changes
Back/Forward
Free ↔ Structured ↔ Free
live vault update while Focus is open
per-file Size and Visual Groups
```

Verify:

```text
immediate graph remains responsive
refined graph adopts once
no repeated visible relaxation after adoption
selection/root/camera do not jump unexpectedly
no stale worker result
no console errors
```

If PR #60 is merged, repeat its density/native camera acceptance on the converged layout.

No need to invent a user-visible “Converged” badge.

---

# Likely implementation areas

Inspect current code before editing. Probable areas:

```text
packages/renderer-sigma/src/local-convergence.ts            (new, likely)
packages/renderer-sigma/src/local-convergence.test.ts
packages/renderer-sigma/src/local-layout.ts
packages/renderer-sigma/src/local-layout tests
packages/renderer-sigma/src/local-types.ts
packages/renderer-sigma/src/core.ts
packages/renderer-sigma/README.md

apps/web/src/workers/local-layout.worker.ts
apps/web/src/workers/local-layout-worker-client.ts
worker/client tests
apps/web/src/components/LocalGraphCanvas.tsx or current path
canvas/cache/status tests

tools/vault-diagnostics convergence analyzer parity
local-renderer benchmark

docs/CONVERGENCE1A_FORCEATLAS2_BATCH_SPIKE.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
history-implementations/<this exact prompt>
```

Adapt paths to current main, especially if PR #60 merged.

Do not change package boundaries merely to match these suggested filenames.

---

# Scope

## In scope

- production Local bounded convergence policy;
- production root-aligned displacement metrics;
- one Graphology graph reused across 32-iteration calls;
- p90 + bounded low-degree maximum stopping;
- 3 consecutive stable batches;
- deterministic node-count caps;
- final partial batch behavior;
- 2-second between-batch wall-time failure;
- structured success/failure metadata;
- worker schema/version validation;
- Local fingerprint policy version;
- Local cache/restart behavior;
- latest-wins preservation;
- diagnostic parity;
- benchmark/report updates;
- browser/desktop validation;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

- Global convergence;
- Global folder-prior redesign;
- SPATIAL2 dynamic Pull convergence;
- persistent workers;
- continuous animated simulation;
- ForceAtlas2 fork/private APIs;
- new force library;
- ForceAtlas2 parameter changes;
- isolate tethers/placement rules;
- camera density changes;
- SPACING1B retuning;
- File drag/temporary constraints;
- user-facing convergence controls;
- Saved Views;
- unrelated HIER/KG14/SPATIAL work.

---

# Suggested implementation sequence

1. Sync current `main`; inspect PR #60/#67 status and current worktrees.
2. Read AGENTS, CONVERGENCE1A report, Local layout/client/cache architecture.
3. Establish shared production metric/policy module and parity with diagnostics.
4. Version the Local request/result/fingerprint contract.
5. Refactor Local compute into one-graph 32-iteration convergence batches.
6. Implement stable/cap/degenerate stop reasons.
7. Implement injectable between-batch 2-second timeout as failure.
8. Strengthen result/failure validation and worker client checks.
9. Update LocalGraphCanvas request/adoption/cache integration.
10. Preserve latest-wins and exact cache restoration.
11. Add pure, compute, worker, timeout, cache and residual-drift tests.
12. Update diagnostics and benchmark reporting without retuning policy.
13. Run full automated validation.
14. Integrate newest `main`; resolve PR #60 compatibility if it merged.
15. Run production browser and release desktop QA where required.
16. Update architecture/performance/roadmap docs and archive this exact prompt.
17. PR → CI → merge → post-merge CI → cleanup.
18. Stop. Do not start CONVERGENCE1C automatically.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web/src/workers apps/web/src/components

pnpm analyze:forceatlas2-convergence

pnpm benchmark:local-renderer -- --profile smoke
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Run current repository privacy/dependency scans if AGENTS requires them.

No CI timing threshold.

---

# Exit gate

CONVERGENCE1B is complete only when:

1. Focus Local layout no longer uses one fixed ForceAtlas2 call as its only stop rule.
2. policy identity is `local-fa2-convergence-v1` or an equivalently explicit version.
3. batch size is 32.
4. all-node normalized p90 threshold is 0.00512.
5. degree-0/1 normalized maximum threshold is 0.01024.
6. 3 consecutive full stable batches are required.
7. caps are 1,000 / 600 / 240 by node class.
8. final partial cap batches are deterministic.
9. previous-frame RMS radius with 1e-6 floor is used.
10. Local movement comparison root-aligns both frames.
11. no rotation or scale alignment hides movement.
12. unique-neighbor degree semantics are correct.
13. one Graphology graph is reused across public assign calls.
14. ForceAtlas2 settings and weighted-edge semantics are unchanged.
15. single-node Local is degenerate with root at zero.
16. stable results satisfy both selected guards.
17. max-iteration results are labelled honestly.
18. wall-time abort is an explicit failure.
19. timeout partial positions are never accepted or cached.
20. timeout is excluded from geometry fingerprint.
21. result metadata is strictly validated.
22. malformed worker metadata cannot adopt.
23. request/result schema change is explicitly versioned.
24. Local fingerprint includes convergence policy identity and cap.
25. old fixed-budget cache identity cannot collide.
26. same fingerprint cache hit makes zero worker calls.
27. returning to a cached prior fingerprint restores exact coordinates.
28. explicit relayout bypasses cache and warm-starts current automatic coordinates.
29. topology changes preserve surviving coordinates and deterministic new seeds.
30. latest-result-wins worker replacement remains intact.
31. no intermediate batch is rendered.
32. final root position is exactly `(0,0)`.
33. rounding occurs only at the final result boundary.
34. visual/group/per-file-size/camera changes still cause zero layout.
35. residual hidden-probe regression passes for stable fixtures.
36. cap-stop fixtures are not falsely asserted as converged.
37. diagnostic and production metric/policy definitions cannot silently diverge.
38. benchmark output includes convergence evidence.
39. main-thread responsiveness remains acceptable.
40. PR #60 density/camera semantics are preserved if merged.
41. PR #60 branch/worktree remains untouched if still open.
42. PR #67/SPATIAL2 work remains untouched.
43. MOVE1A/PHYSICS1 constraints are not activated.
44. Global layout behavior is unchanged.
45. SPATIAL2A dynamic worker is unchanged.
46. no persistent worker is added.
47. no ForceAtlas2 fork/private API is used.
48. no external dependency is added.
49. focused tests pass.
50. `pnpm check` passes.
51. desktop check/build pass.
52. browser/release QA is reported honestly.
53. PR CI passes.
54. post-merge CI passes.
55. unrelated user changes/worktrees are preserved.
56. prompt is archived exactly.
57. task branch/worktree cleanup completes.
58. CONVERGENCE1C is not started automatically.

---

# Documentation / roadmap

Update the nearest current documents to state:

```text
CONVERGENCE1A — complete
CONVERGENCE1B — Local production bounded convergence complete
CONVERGENCE1C — Global macro-step convergence next/pending
```

Document the distinction:

```text
Focus layout convergence
= finite replacement-worker computation until practical positional stability

PHYSICS1 continuous simulation
= separate future interactive lifecycle
```

Do not claim mathematical equilibrium.

Do not rewrite historical implementation prompts or the Obsidian extraction.

---

# Final implementation report

Report:

## 1. Summary

What changed in Focus layout behavior.

## 2. Policy

```text
batch
thresholds
stable batches
caps
timeout
```

## 3. Metrics

Root alignment, RMS normalization, p90 and low-degree guard.

## 4. Worker/result contract

Schema/version, metadata, timeout failure and latest-wins behavior.

## 5. Cache/restart behavior

Cache hits, old fingerprint restoration, explicit relayout, topology warm starts.

## 6. Residual-drift evidence

Before/after and hidden-probe results.

## 7. Performance

Iterations/batches/stop reasons and worker timing by profile.

## 8. Compatibility

SPACING1B, Visual Groups, per-file Size, MOVE1A, Global/SPATIAL2.

## 9. Tests / browser / desktop QA

State what was and was not manually validated.

## 10. Files changed / dependencies

Expected external additions: zero.

## 11. Concurrency

State PR #60 and #67 status/integration.

## 12. Follow-up

```text
CONVERGENCE1B complete
CONVERGENCE1C — Global folder-macro convergence — next
```

Do not implement CONVERGENCE1C automatically.
