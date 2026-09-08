# CONVERGENCE1C — Global Duration-Independent Folder-Macro Convergence

**Task type:** Global layout design + production integration, with a mandatory evidence gate before behavior change

## Goal

Complete the ForceAtlas2 convergence track for **All + Network** without making folder-clustering strength depend on how long convergence happens to run.

Current Global base behavior:

```text
reference-only
→ pure ForceAtlas2

folder clustering on
→ current chunked-prior
→ ForceAtlas2 chunk
→ folder prior
→ repeat
```

Naively repeating the whole folder-prior algorithm until movement is small is unsafe because extra convergence work applies the folder prior extra times. Then the same user settings can produce stronger clustering merely because a graph took longer to settle.

CONVERGENCE1C must define one **duration-independent Global macro-step** whose folder influence has a fixed semantic meaning, then use bounded convergence around that macro-step.

If one candidate clearly passes the design/quality gate, implement it in production in this same task. If no candidate passes, or two candidates imply materially different product behavior, stop after the evidence report and ask the user instead of forcing an implementation.

---

## Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

Current `main` at plan-writing time:

```text
b4ea17e4d04b1860a177045201e8bf42eb06f4db
```

Relevant merged work:

```text
CONVERGENCE1A — batch/convergence decision spike complete
CONVERGENCE1B — Focus production bounded convergence complete
PR #60 / FLICKER1 — merged; atomic Network camera transactions + density 150
SPATIAL2A — dynamic Pull foundation complete
MOVE1A — temporary File movement foundation complete
```

Open concurrent work:

```text
PR #67 — SPATIAL2B dynamic Pull hierarchical rule editor
status: draft / unmerged
```

PR #67 touches GlobalGraphCanvas, renderer session/types, spatial rules, Network Explorer and docs. Preserve its worktree/branch exactly.

Before branching and before merge:

1. inspect latest `main` and all open PRs;
2. use an isolated task worktree;
3. do not modify/reset/delete PR #67 work;
4. if #67 merges during this task, update onto its merge and rerun Global spatial QA;
5. if CONVERGENCE1C merges first, state that #67 must rebase and repeat its Global spatial QA;
6. preserve merged FLICKER1 camera-atomic behavior exactly.

No external context is required.

---

## Existing decisions that are not being reopened

### Focus convergence

CONVERGENCE1B remains unchanged:

```text
32-iteration public ForceAtlas2 batches
all-node normalized p90 <= 0.00512
low-degree normalized maximum <= 0.01024
3 consecutive stable full batches
size-class deterministic caps
2 s wall-time safety failure
schema-v2 Local worker contract
```

Do not retune Local.

### Camera / density

Merged FLICKER1 owns:

```text
camera-atomic topology/position commits
semantic anchor preservation
All/Focus density framing
density strength 0–150%
user-owned camera protection
```

This task changes Global automatic geometry only. Density remains camera-only and outside ForceAtlas2, cache/fingerprint, Pull, and persistence.

### Position ownership

Keep the strict pipeline:

```text
base automatic Global positions
→ optional SPATIAL2 dynamic Pull positions
→ fixed Place composition
→ Sigma displayed positions
```

Only the **base automatic Global** layer is in scope. Dynamic/fixed positions must never become base seeds or base cache values.

---

## CONVERGENCE1A evidence to preserve

CONVERGENCE1A established:

```text
pure reference-only Global
→ bounded displacement convergence is viable

repeat whole chunked-prior
→ repeats prior applications
→ effective folder bias grows with duration

current prior schedule + pure FA2 settling tail
→ folder cohesion weakens

therefore
→ Global needs a dedicated macro-step design
```

It also selected the Global movement language:

```text
centroid-align shape movement
+ separately measure/guard raw centroid drift
+ normalize by previous-frame RMS radius
+ p90 as primary movement signal
+ low-degree guard
```

Starting thresholds:

```text
shape p90 <= 0.00512
low-degree max <= 0.01024
normalized centroid drift <= 0.00512
3 consecutive stable full macro-steps
```

Diagnostic Global caps from CONVERGENCE1A:

```text
<= 1,000 nodes      → 640 FA2 iterations
1,001–5,000 nodes   → 120
> 5,000 nodes       → 80
```

These are starting evidence; finalize only after selecting the macro algorithm.

---

## Current Global algorithm

`computeGlobalLayout(...)` currently supports:

```text
reference-only
chunked-prior
offset-field
```

Production folder clustering uses `chunked-prior`, splitting the fixed request budget into up to five chunks:

```text
FA2 chunk
→ applyChunkedFolderPrior
→ repeat
```

The prior depends on:

```text
folderCohesion
withinFolderSpacing
betweenFolderSpacing
graph RMS scale
folder centroids
deterministic folder direction
```

The user's current clustering/spacing settings must retain understandable, stable semantics after convergence is introduced.

---

# Hard invariant

```text
folder effect at fixed settings/topology
must not grow merely because convergence executes more macro-steps
```

Equivalently:

```text
number of convergence checks
!= hidden multiplier on folder-clustering strength
```

This is the primary gate.

---

# Phase 1 — Describe current macro semantics

Before production changes, derive a compact operational/mathematical description of current `chunked-prior`:

```text
radial contraction around folder centroid
folder-direction translation
scale dependence
interaction with FA2 between prior applications
```

Quantify how current five applications compose. Determine whether the current fixed result can be approximated as one total prior transform or a stable target field.

Do not modify production yet.

---

# Phase 2 — Global fixture matrix

Reuse CONVERGENCE1A fixtures and add folder-specific cases:

```text
reference-only connected
reference-only with isolates
reference-only medium mixed
folder-on baseline
2 folders weak cross-links
2 folders strong cross-links
3+ folders mixed connectivity
large folder + small folders
folder with isolates
root-level files
all files in one folder
low/high folder cohesion
compact / normal / spacious
low/high reference pull
```

Use deterministic synthetic/private-safe data.

Test base Global independently from SPATIAL2 dynamic Pull.

---

# Phase 3 — Macro candidates

Evaluate a small deliberate family.

## M0 — current fixed baseline

Current fixed-budget `chunked-prior`. This is the semantic/visual reference, not a convergence candidate.

## M1 — fixed total-prior budget distributed across convergence

Define one total folder-prior influence for the entire request and distribute it across however many macro-steps run so cumulative influence is approximately invariant to macro-step count.

Do not simply divide a nonlinear transform by step count without proving composition.

## M2 — target-field bounded correction

Interpret folder clustering as a soft target field:

```text
FA2 batch
→ derive desired folder-relative target from current settings
→ move each folder/group a bounded fraction toward that target
```

The target must remain stable as convergence duration increases. This must remain soft, not become fixed placement.

## M3 — frozen semantic target + coupled settle

Compute one stable prior target from the initial/base semantic frame, then apply bounded attraction toward that fixed target during convergence.

The target/gain must be duration-independent.

## M4 — simpler replacement prior, only if necessary

If current `chunked-prior` cannot be made convergence-safe cleanly, evaluate a simpler duration-independent folder prior. This is allowed only if:

```text
user-facing semantics remain understandable
quality is equal/better
architecture is simpler or at least not worse
```

If M4 materially changes product appearance/meaning, stop and ask the user before production integration.

---

# Phase 4 — Global convergence metrics

Use production-quality Global movement primitives.

For each before/after macro frame:

```text
centroid-align for shape movement
scale by previous-frame RMS radius
```

Report:

```text
all p50 / p90 / maximum
degree 0
degree 1
degree >=2
low-degree combined
raw centroid drift
normalized centroid drift
```

Start with CONVERGENCE1A thresholds:

```text
shape p90 <= 0.00512
low-degree max <= 0.01024
normalized centroid drift <= 0.00512
K = 3
```

Any Global-specific change requires tracked evidence and a distinct policy version.

---

# Phase 5 — Define one complete semantic macro-step

Measure convergence only after a complete macro-step, never halfway through folder-prior behavior.

Preferred shape, if evidence supports it:

```text
32 FA2 iterations
→ one duration-independent folder correction
→ snapshot
→ movement measurement
```

Exact internals can differ, but one macro-step must have fixed semantics independent of how many later steps run.

Define final partial-cap behavior explicitly.

---

# Phase 6 — Duration-independence oracle

Mandatory.

For each folder fixture, force selected candidates through differing macro-step counts such as:

```text
3
5
8
12
```

while holding topology/settings fixed.

Measure:

```text
normalized mean within-folder distance
normalized folder-centroid separation
cross-folder reference length
folder-direction displacement
```

A candidate fails if more macro-steps systematically strengthen clustering/separation after graph movement is otherwise stable.

Use tight evidence-backed tolerances rather than vague visual judgment alone.

---

# Phase 7 — Preserve graph semantics

Folder clustering must remain a soft spatial prior:

```text
strong cross-folder references can resist/pull clusters
folder metadata creates no semantic graph edges
isolates remain governed by graph forces + soft prior
```

Do not make folders rigid components.
Do not turn base clustering into SPATIAL2 Place.

---

# Phase 8 — Reference-only Global convergence

When folder clustering is effectively off:

```text
Global should use pure bounded FA2 convergence
```

Prefer the same lifecycle engine with a no-prior macro adapter.

Reference-only should use:

```text
32-iteration batches
centroid-aligned shape p90
low-degree guard
centroid-drift guard
K=3
deterministic caps
wall-time safety failure
```

---

# Phase 9 — Candidate decision gate

Before production behavior changes, produce comparison evidence and choose one candidate.

A candidate passes only if it satisfies all of:

```text
A. duration independence
B. convergence stability
C. folder-quality preservation
D. reference/topology quality
E. practical performance
F. deterministic/reproducible behavior within existing tolerance
G. simple explainable semantics
```

If exactly one candidate clearly passes, continue with production integration.

If none pass, or two candidates imply materially different product behavior, **stop and report the decision**. Do not implement a compromise silently.

---

# Phase 10 — Production policy identity

If the gate passes, define an explicit version, e.g.:

```text
global-fa2-folder-convergence-v1
```

Fingerprint identity must include every result-affecting field:

```text
Global algorithm version
macro-step version
FA2 batch size
movement thresholds
stable-step count
size-class cap
folder-prior composition/version
folderClustering
folderCohesion
withinFolderSpacing
betweenFolderSpacing
linkForce
topology / reference weights / folder keys
```

Exclude:

```text
wall-time limit
camera/density
selection/hover
visual node size
link thickness
label threshold
SPATIAL2 dynamic/fixed rules
```

Use a new fingerprint prefix/version so old fixed-budget cache entries cannot collide.

---

# Phase 11 — Worker contract

After candidate acceptance, version the Global worker request/result explicitly, following useful CONVERGENCE1B patterns but keeping Global-specific semantics.

Success metadata should include equivalents of:

```text
policyVersion
macroVersion
stopReason: stable | max-iterations | degenerate
iterationsCompleted
macroStepsCompleted
stableSteps
final movement metrics
raw + normalized centroid drift
computeMs
folderPriorMs
folder-quality aggregate metrics
positions
```

Wall-time safety:

```text
starting production limit = 5,000 ms
check only between complete macro-steps
max-wall-time = explicit failure
partial geometry is non-cacheable and never adopted
```

Wall time remains excluded from geometry identity.

---

# Phase 12 — Deterministic caps

Start from:

```text
<= 1,000 nodes      → 640 total FA2 iterations
1,001–5,000 nodes   → 120
> 5,000 nodes       → 80
```

Finalize with macro-step benchmarks.

Do not silently increase caps because a candidate cannot stabilize. Ordinary supported graphs repeatedly hitting cap with poor residual movement is evidence against the candidate.

---

# Phase 13 — Cache / restart semantics

Preserve:

## Same fingerprint

```text
exact cache hit
→ apply exact converged base positions
→ zero worker
```

## Return to previous cached physics fingerprint

```text
restore exact cached converged base coordinates
```

## Explicit Re-layout

```text
bypass/delete exact cache
→ warm-start current BASE AUTOMATIC coordinates
→ converge
```

Never warm-start base from dynamic Pull or fixed Place positions.

## Topology change

```text
retain surviving base automatic positions
seed new nodes deterministically
→ converge
```

---

# Phase 14 — SPATIAL2 compatibility

Pipeline remains:

```text
settled base automatic Global
→ optional SPATIAL2 dynamic Pull
→ fixed Place
```

The SPATIAL2 dynamic fingerprint already includes base fingerprint/coordinates. Verify the new base policy invalidates dynamic cache correctly.

Do not merge the base and dynamic workers.
Do not alter SPATIAL2A's dynamic algorithm here.

If PR #67 merges during the task, rerun its Dynamic Pull / Fixed Place / hierarchical scope / drag QA over converged base positions.

Document whether SPATIAL2 dynamic Pull deserves a later separate convergence task.

---

# Phase 15 — FLICKER1 / density compatibility

Merged FLICKER1 requires camera-atomic topology and position changes.

Global convergence must adopt only one final result through the existing transaction seam:

```text
one final worker result
→ one atomic position commit
→ semantic anchor restored in first visible changed frame
→ density decision updated from confirmed displayed positions per current contract
```

Do not render intermediate macro-steps.
Do not steal user-owned camera state.
Do not modify density formulas/settings.

---

# Phase 16 — Diagnostic artifacts

Produce deterministic local evidence, likely:

```text
output/convergence1c/global-macro-results.json
output/convergence1c/global-macro-comparison.html
```

Show:

```text
M0 current baseline
selected candidate(s)
reference-only convergence
weak/strong folder cases
forced short/long macro duration
```

Use overlays/centroid markers so hidden duration dependence is visible.

No private vault data. Do not commit large generated outputs.

---

# Phase 17 — Production implementation shape

If the gate passes, prefer a clean split such as:

```text
global-convergence.ts
→ Global movement/stopping policy

global-folder-macro.ts
→ selected duration-independent folder macro-step

layout.ts
→ validation + graph build + convergence loop + result
```

Exact filenames are flexible.

Reuse Local production primitives only where genuinely generic:

```text
percentile
distribution
RMS helpers
unique-neighbor degree
stable counter patterns
```

Keep Local root alignment and Global centroid alignment separate.

---

# Required tests

## Macro semantics

Cover:

```text
forced 3/5/8/12-step duration independence
folder influence does not accumulate with step count
zero cohesion behaves as reference-only
folderClustering=false bypasses macro prior
compact/normal/spacious retain intended differences
strong cross-folder references can resist prior
one-folder graph
root-folder files
multi-folder deterministic direction
```

## Global convergence metrics

Cover centroid translation removal, centroid drift guard, rotation/scale visibility, RMS floor, p90, low-degree guard, K=3 reset behavior.

## Compute lifecycle

Cover:

```text
reference-only stable
folder-on stable
cap stop
single-node degenerate
isolates
final partial macro-step
wall-time failure
one Graphology graph reused across FA2 batches where valid
```

## Worker validation

Strict schema/policy/macro metadata, node-set, counters, stop reason, malformed response, timeout, supersession, disposal.

## Cache / canvas

Cover:

```text
cache hit zero worker
old fingerprint exact restore
explicit relayout bypass
base-only warm start
dynamic/fixed coordinates excluded
one final atomic adoption
semantic camera anchor unchanged
visual controls zero-layout
density controls zero-layout
```

## SPATIAL2 compatibility

At minimum:

```text
new base fingerprint invalidates dynamic cache
dynamic Pull starts from converged base
fixed Place composes afterward
dynamic/fixed never write base cache
```

---

# Performance

Run Global benchmarks at least around:

```text
100 nodes
500 nodes
1,000 nodes
5,000 nodes
```

and any existing safe >5,000 stress profile.

Report:

```text
stop reason
FA2 iterations
macro steps
stable steps
compute ms
folder prior ms
final p90
low-degree max
centroid drift
```

No flaky timing gates.

If 5,000-node convergence becomes too slow, report the scale boundary honestly rather than hiding it.

---

# Likely implementation areas

Inspect current code first. Probable areas:

```text
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/core.ts
packages/renderer-sigma/src/global-convergence.ts
packages/renderer-sigma/src/global-folder-macro.ts
related tests / layout-cache / fingerprint tests
GlobalGraphCanvas atomic-adoption tests

apps/web/src/workers/global-layout.worker.ts
apps/web/src/workers/global-layout-worker-client.ts
worker tests

tools/vault-diagnostics convergence1c analysis
tools/vault-diagnostics global-renderer benchmark
package scripts

docs/CONVERGENCE1C_GLOBAL_FOLDER_MACRO_CONVERGENCE.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
history-implementations/<this exact prompt>
```

Avoid PR #67 UI files unless #67 has merged into main.

---

# Scope

## In scope

- duration-independent Global folder macro design;
- candidate evidence gate;
- production base Global bounded convergence if gate passes;
- reference-only Global convergence;
- centroid/shape + low-degree + centroid-drift metrics;
- deterministic caps;
- 5 s wall-time failure;
- Global worker/fingerprint/cache versioning;
- FLICKER1 atomic adoption compatibility;
- SPATIAL2 base/dynamic/fixed compatibility;
- benchmark/report/docs;
- prompt archive;
- PR/CI/cleanup.

## Out of scope

- changing Local convergence;
- SPATIAL2 dynamic Pull convergence;
- SPATIAL2B UI design unless already merged and compatibility-only;
- persistent simulation workers;
- continuous animation;
- ForceAtlas2 fork/private API;
- new force library;
- camera density retuning;
- per-file Size/visual settings;
- fixed Place semantics;
- MOVE1/PHYSICS1;
- unrelated HIER/KG14 work.

---

# Suggested implementation sequence

1. Sync latest main; inspect PR #67 and worktrees.
2. Read AGENTS, CONVERGENCE1A/B docs, Global layout, SPATIAL2 ADRs, FLICKER1 camera transaction code.
3. Build diagnostic Global macro candidate harness around current production formulas.
4. Quantify M0 and its duration dependence.
5. Implement diagnostic M1/M2/M3; M4 only if necessary.
6. Run duration-independence + quality + convergence + performance comparison.
7. Generate JSON/HTML evidence.
8. Apply candidate decision gate.
9. If no clear winner, stop and report.
10. If clear winner, implement production Global convergence/worker/fingerprint contracts.
11. Add cache, timeout, atomic-camera, density, SPATIAL2 and residual-drift regressions.
12. Run full validation and production browser/release QA.
13. Integrate latest main / PR #67 if needed and rerun affected QA.
14. Update docs/roadmap and archive the exact prompt.
15. PR → CI → merge → post-merge CI → cleanup.
16. Stop; do not start SPATIAL2 dynamic convergence or PHYSICS1 automatically.

---

# Validation commands

Use current equivalents:

```bash
pnpm install --frozen-lockfile
pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web/src/workers apps/web/src/components

# exact new command flexible
pnpm analyze:global-convergence
pnpm analyze:forceatlas2-convergence
pnpm analyze:network-spacing

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

No CI timing threshold.

---

# Exit gate

CONVERGENCE1C is complete only when:

1. current chunked-prior semantics are documented;
2. naive repeated-prior duration dependence is reproduced;
3. M1/M2/M3 are evaluated or explicitly rejected with evidence;
4. weak/strong cross-folder links are covered;
5. multiple folder counts/sizes are covered;
6. compact/normal/spacious are covered;
7. low/high cohesion is covered;
8. forced differing macro-step counts are compared;
9. folder-quality metrics are reported;
10. graph/reference quality is reported;
11. Global centroid-aligned movement is correct;
12. raw centroid drift is separately guarded;
13. low-degree movement is visible;
14. exactly one candidate passes or the task stops for user choice;
15. no production behavior changes before that gate;
16. selected macro semantics are duration-independent and versioned;
17. reference-only Global receives bounded convergence if production proceeds;
18. folder-on Global receives bounded macro convergence if production proceeds;
19. one Graphology graph is reused across FA2 batches where valid;
20. thresholds/stable count are evidence-backed;
21. deterministic caps and partial-step behavior are explicit;
22. 5 s wall-time abort is non-cacheable failure;
23. partial timeout geometry never adopts;
24. Global worker schema/result validation is strict/versioned;
25. fingerprint version changes;
26. old fixed-budget cache cannot collide;
27. same fingerprint cache hit is zero-worker;
28. previous cached fingerprint restores exact base coordinates;
29. explicit relayout warm-starts current base automatic coordinates;
30. topology change preserves surviving base positions;
31. dynamic/fixed positions never seed base convergence;
32. dynamic cache invalidation tracks new base fingerprint/coordinates;
33. one final adoption only;
34. FLICKER1 camera transaction remains atomic;
35. first visible changed frame preserves semantic anchor;
36. density remains camera-only;
37. visual-only controls remain zero-layout;
38. Local convergence remains unchanged;
39. SPATIAL2 dynamic algorithm remains unchanged;
40. no persistent worker;
41. no ForceAtlas2 fork/private API;
42. no external dependency;
43. deterministic HTML/JSON evidence exists;
44. no private vault data is committed;
45. benchmarks report macro/convergence evidence;
46. PR #67 is preserved or cleanly integrated if merged;
47. focused tests pass;
48. `pnpm check` passes;
49. desktop check/build pass;
50. browser/release QA is reported honestly;
51. PR CI passes;
52. post-merge CI passes;
53. docs/roadmap updated;
54. exact prompt archived;
55. unrelated worktrees/user changes preserved;
56. task worktree/branch cleaned up.

---

# Final report

## 1. Macro decision

```text
Selected candidate:
Why:
Duration-independence evidence:
```

## 2. Production policy

```text
policy version
FA2 batch / macro step
thresholds
stable steps
caps
timeout
```

## 3. Folder semantics

Explain how cohesion/separation/spacing remain duration-independent.

## 4. Convergence evidence

Residual movement and hidden-probe evidence.

## 5. Worker/cache/fingerprint

Schema, stop reasons, failures, cache restoration and relayout behavior.

## 6. SPATIAL2 compatibility

Base → dynamic → fixed ownership and PR #67 status.

## 7. FLICKER1 / density compatibility

Atomic adoption and camera ownership evidence.

## 8. Performance

By size/profile.

## 9. Tests / graphical QA

## 10. Files / dependencies

Expected external additions: zero.

## 11. Follow-up

State whether the base Global convergence track is complete and whether SPATIAL2 dynamic Pull deserves a later separate convergence task.

Do not start another implementation task automatically.
