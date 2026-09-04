# CONVERGENCE1A — ForceAtlas2 batch-convergence decision spike

Status: **COMPLETE — Local production follow-through is implemented by CONVERGENCE1B; Global macro convergence remains separate.**

CONVERGENCE1A is synthetic diagnostic evidence only. It changes no production
layout behavior, worker protocol, fingerprint, cache, iteration budget,
ForceAtlas2 setting, SPATIAL2A dynamic Pull behavior, Sigma camera, or UI.

## 1. Result

| Decision                | Recommendation                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Batch size              | **32 public ForceAtlas2 iterations**                                                                                                                                                  |
| Movement metric         | Endpoint displacement after each completed batch; p50/p90/maximum reported, **p90 used for stopping**                                                                                 |
| Alignment               | Focus: translate both frames so the root is `(0,0)`; Global: centroid-align shape and report raw centroid drift separately                                                            |
| Scale                   | Previous accepted frame's RMS radius about the alignment origin (Focus root / Global centroid), with a `1e-6` floor                                                                   |
| General threshold       | **normalized p90 ≤ `0.00512`** (0.512% of prior-frame RMS radius)                                                                                                                     |
| Low-degree guard        | Degree-0/1 maximum ≤ **`0.01024`** (2 × general threshold); report degree 0, degree 1, and combined low-degree distributions                                                          |
| Translation guard       | Focus root normalization must remain exact; Global normalized centroid drift must also be ≤ `0.00512`                                                                                 |
| Stable batches          | **3 consecutive completed batches**                                                                                                                                                   |
| Focus deterministic cap | ≤100 nodes: **1,000**; 101–500: **600**; >500: **240** total iterations                                                                                                               |
| Global diagnostic cap   | ≤1,000 nodes: **640**; 1,001–5,000: **120**; >5,000: **80**; finalize in CONVERGENCE1C                                                                                                |
| Wall time               | Safety-only, excluded from geometry identity: start production validation at 2 s Local and 5 s Global; timeout is an explicit non-cacheable failure, never an accepted partial layout |
| Production split        | **CONVERGENCE1B: Local bounded convergence. CONVERGENCE1C: Global macro-step convergence.**                                                                                           |

The threshold is not a guessed round number. The diagnostic evaluated the
p25/p50/p75 of endpoint p90 movement observed at or beyond each fixture's
current budget and before its hard cap. Those candidates were `0.000672`,
`0.00204`, and `0.00512`. The highest candidate was the smallest tested value
that settled every pure-FA2 fixture within the tested caps while every hidden
probe remained below the general threshold.

The recommended Local rule is therefore:

```text
after each 32-iteration public ForceAtlas2 batch:
  root-align previous and current frames
  scale movement by previous-frame RMS radius, floor 1e-6

stable batch when:
  all-node normalized p90 <= 0.00512
  degree-0/1 normalized maximum <= 0.01024
  root normalization is valid and exact

accept when:
  3 consecutive batches are stable
  OR the deterministic size-class iteration cap is reached
```

`maximum` is deliberately not the general stop metric. It appears only as a
bounded low-degree guard, and the hard cap prevents one isolate from running
forever.

## 2. Why repeated relayout drift occurs

The analyzer ran the current production budget once (`A`), rebuilt the normal
request from the accepted coordinates and ran it again (`B`), then repeated it
once more (`C`) for all 22 fixtures.

Across the matrix, median normalized all-node p90 movement was `0.0842` for
`A → B`; the 90th percentile of per-fixture low-degree maximum movement was
`0.2669`. Low-degree p90 exceeded all-node p90 in 11 of 22 fixtures, confirming
that an all-node percentile alone can hide a small weak population.

Representative `A → B` all-node p90 movement was:

| Fixture                          | Normalized p90 |
| -------------------------------- | -------------: |
| Focus 50-node mixed              |        `0.399` |
| Focus long chain                 |        `0.357` |
| Focus root weak + four isolates  |        `0.226` |
| Focus five-node mixed + isolate  |        `0.171` |
| Global 120-node mixed + isolates |        `0.209` |
| Global small graph + isolates    |        `0.074` |

`B → C` also remained nonzero; its median all-node p90 was about `0.031`.
This reproduces the reported failure: a legitimate completed job is not a
practical stopping oracle, so a second identical public job can visibly advance
the layout.

The cause is lifecycle, not cache nondeterminism. Exact-fingerprint cache hits
already preserve exact positions and perform no worker request. Drift appears
when a fresh public ForceAtlas2 job is intentionally run from accepted
coordinates. ForceAtlas2 0.10.1 reconstructs private node/edge matrices for
every public `assign` call, including `dx/dy`, old displacement, and internal
convergence values; coordinates warm-start, solver history does not.

## 3. Public batching result

The diagnostic compared one-shot totals with public 20/32/40 batches over 234
safe representative cases. Totals include 60, 100, 160, 320, 640, and 1,000
where workload size permits.

| Public batch | Median endpoint p90 divergence from one-shot | p90 divergence |   Maximum |
| -----------: | -------------------------------------------: | -------------: | --------: |
|           20 |                                    `0.00597` |      `0.02781` | `0.03420` |
|           32 |                                    `0.00308` |      `0.01347` | `0.02361` |
|           40 |                                    `0.00259` |      `0.01008` | `0.01874` |

One-shot output is only a long-run comparison, not mathematical truth. The
table proves the practical reset effect: smaller public batches deviate more
from a same-total one-shot call because the private matrices restart more
often.

Reusing one Graphology graph and rebuilding it from the previous coordinates
produced bit-exact endpoints in the sampled 320-total/32-batch Focus and Global
cases. This confirms that the Graphology object does not retain hidden
ForceAtlas2 solver state between public calls. Reuse should still be selected:
it avoids deterministic topology allocation on every batch. Local timings are
small and noisy, but across the matrix rebuilt batches had 59% median measured
overhead versus 13% for reused batches; timings are evidence, never gates.

### Batch-size choice

Under the selected threshold, K=3, and low-degree guard:

|  Batch | Stable fixtures | Mean iterations | Hidden probe median p90 | Long-run-reference median p90 |
| -----: | --------------: | --------------: | ----------------------: | ----------------------------: |
|     20 |           19/19 |         `320.0` |               `0.00276` |                     `0.02752` |
| **32** |       **19/19** |     **`444.6`** |           **`0.00240`** |                 **`0.01491`** |
|     40 |           16/19 |         `511.6` |               `0.00255` |                     `0.01072` |

Batch 20 is cheaper but accumulates substantially more reset divergence from
the long-run reference. Batch 40 does not settle three fixtures before the
same caps. Batch 32 is the best measured quality/performance compromise.

At equivalent current-budget checkpoints, dividing endpoint movement by batch
iterations reduced the median cross-batch coefficient of variation from
`0.277` to `0.050`. That makes the per-iteration estimate useful for diagnosis,
but movement is not assumed linear. The product question is the visible jump
caused by one more completed job, so production should use endpoint movement
with the fixed, versioned 32-iteration batch. Changing the batch size requires
new evidence and a new policy identity rather than dividing the threshold.

## 4. Stopping-policy evidence

The candidate grid contains 81 policies: 3 batch sizes × 3 evidence-derived
thresholds × K=2/3/4 × 3 low-degree policies. Every declared stable result was
followed by one additional unaccepted public probe batch.

For batch 32 and threshold `0.00512`:

| Policy                          |    Stable | Mean iterations | Probe median p90 | Low-degree probe-max p90 |
| ------------------------------- | --------: | --------------: | ---------------: | -----------------------: |
| K=2, all p90 only               |     19/19 |         `404.2` |        `0.00333` |                `0.00768` |
| K=2, bounded low-degree max     |     19/19 |         `412.6` |        `0.00283` |                `0.00732` |
| **K=3, bounded low-degree max** | **19/19** |     **`444.6`** |    **`0.00240`** |            **`0.00652`** |
| K=3, low-degree p90             |     19/19 |         `448.0` |        `0.00256` |                `0.00678` |
| K=4, bounded low-degree max     |     19/19 |         `476.6` |        `0.00206` |                `0.00589` |

K=3 buys a meaningful probe reduction over K=2. K=4 adds another full batch
on average for a smaller gain. The bounded low-degree maximum adds only 8.4
iterations on average over all-node p90 and reduces weak-node residuals without
the unnecessary work of making a low-degree p90 use the general threshold.

The selected candidate settled all 19 Focus/reference-only fixtures, produced
zero false early stops, and had hidden-probe all-node p90 median `0.00240` and
maximum `0.00478`. Its 90th percentile of per-fixture low-degree probe maximum
was `0.00652`, below the `0.01024` guard. The 50-node mixed Focus fixture needed
960 iterations, the long chain 864, and the 120-node Global mixed fixture 608;
those measurements justify the tested 1,000/640 small-workload caps.

Every run reports one of `stable`, `max-iterations`, `max-wall-time`, or
`degenerate`. `stable`, `max-iterations`, and a validated trivial degenerate
case may return accepted deterministic positions. `max-wall-time` is different:
it is a safety abort, must not cache partial geometry, and must leave the caller
on its previous accepted automatic positions (or initial deterministic seeds)
with an explicit error state.

## 5. Local production contract — CONVERGENCE1B

CONVERGENCE1B should make one Local worker request own the complete bounded
lifecycle:

1. Build one Graphology graph from the request's deterministic/warm coordinates.
2. Reuse that graph across public 32-iteration `assign` calls.
3. Snapshot root-normalized positions only after a completed batch.
4. Measure the shared diagnostic definitions above; never rotate or rescale a
   frame for comparison.
5. Accept after K=3 stable batches or the deterministic size-class iteration
   cap. Do not accept a wall-time abort.
6. Root-normalize and round once at the same final production boundary used
   today. Intermediate metric snapshots must not become cache values.
7. Keep latest-result-wins replacement workers, deterministic seeds, warm
   starts, and exact-fingerprint cache behavior unchanged.
8. Add result metadata and tests, but no user-facing setting.

The implementation should share a pure lifecycle/metric contract, not a single
Local/Global physics function. Local owns hierarchy/reference weight
adaptation and root alignment. Global owns centroid drift and, later, complete
folder-prior macro-steps.

## 6. Global production contract — split to CONVERGENCE1C

Reference-only Global fixtures can use the same metric lifecycle: all four
reference-only cases settled under the selected candidate. The product's
Global mode cannot adopt that path independently, however, because enabling
folder clustering selects `chunked-prior`, whose current semantic unit is:

```text
ForceAtlas2 chunk → folder prior, repeated five times
```

The three complete-macro comparisons show why a generic outer loop is unsafe:

| Fixture                           | G1 repeat-whole-run movement p90 | G3 pure-tail movement p90 |
| --------------------------------- | -------------------------------: | ------------------------: |
| Folder-on baseline                |                          `0.145` |                   `0.158` |
| Multiple folders/cross references |                          `0.061` |                   `0.059` |
| Weak folder clusters              |                          `0.094` |                   `0.077` |

G1 repeats every prior application, so the amount of folder bias becomes a
function of convergence duration. G3 avoids that accumulation but consistently
weakens folder cohesion: normalized mean within-folder distance changed from
`0.298 → 0.330`, `0.274 → 0.298`, and `0.229 → 0.247`; folder-centroid
separation also declined slightly. G2 would require a newly normalized prior
gain and is therefore a product-algorithm change, not a safe lifecycle wrapper.

Choose G4 now: retain the current Global lifecycle in CONVERGENCE1B and make
CONVERGENCE1C decide one complete, duration-independent folder macro-step.
CONVERGENCE1C may share metrics, result metadata, caps, and stop reasons with
Local, but must test prior quality after complete macro-steps only. It must
version the macro policy in the Global fingerprint.

## 7. Cache and restart semantics

- **Same topology + same physics, no explicit action:** make no request and
  preserve exact accepted positions.
- **Return to an old cached physics fingerprint:** restore that fingerprint's
  exact settled coordinates. Do not reconverge from the current different-
  physics layout.
- **Explicit Rearrange:** preserve current behavior and mental-map continuity:
  bypass/delete the exact cache entry and reconverge from current **automatic**
  positions. A separate reset-from-deterministic-seeds action can be designed
  later if users need it; do not silently combine the two meanings.
- **Topology change:** retain surviving automatic positions, deterministically
  seed only new nodes, then converge.
- **Global position ownership:** base automatic positions remain the only base
  warm-start/cache source. SPATIAL2A dynamic and fixed displayed positions stay
  excluded.

## 8. Fingerprint and result handoff

A future Local fingerprint needs a versioned policy identity, for example
`local-fa2-convergence-v1`, and must include every result-affecting field:

```text
ForceAtlas2/layout algorithm version
batch size = 32
general p90 threshold = 0.00512
low-degree class = degree 0 or 1
low-degree maximum multiplier = 2
consecutive stable batches = 3
deterministic iteration cap / size class
root alignment version
RMS normalization version and 1e-6 floor
```

Global must additionally include the complete macro-step policy/version.
Wall-time limits, timing observations, and non-result diagnostic verbosity are
excluded: machine speed must not create distinct cache identity or silently
select different accepted geometry.

The future success result should add:

```text
stopReason
iterationsCompleted
batchesCompleted
stableBatches
final normalized p50/p90/maximum
degree-0, degree-1, and combined low-degree movement
raw + normalized centroid drift for Global
computeMs
```

A wall-time abort should carry the same lifecycle diagnostics in an explicit
failure response, without cacheable positions.

## 9. SPATIAL2A compatibility

The pure stable-key metrics can safely serve a later SPATIAL2A diagnostic, but
base and dynamic workers must not be folded into one simulation. A base-policy
version changes base coordinates and the base fingerprint; SPATIAL2A already
includes both in its dynamic fingerprint, so its cache invalidation assumption
remains correct.

Ownership stays:

```text
settled base automatic Global positions
→ optional separately fingerprinted dynamic Pull positions
→ fixed Place display translation
```

Dynamic and fixed positions remain excluded from base warm starts and cache
values. SPATIAL2A alternates its own FA2 chunks with bounded centroid pulls, so
it needs a separate convergence task after CONVERGENCE1C rather than inheriting
Local numeric thresholds without evidence.

## 10. Quality and performance evidence

- All three deterministic repeat checks returned bit-exact coordinates.
- Reused versus rebuilt Graphology batching returned bit-exact endpoints in
  the sampled Local and Global cases.
- Across 234 batching comparisons, no output coordinate was non-finite and no
  near-coincident pair crossed the diagnostic gross-overlap threshold.
- The selected candidate's median displacement from the 1,000-iteration
  one-shot reference was `0.01491` p90, maximum `0.02732`. This residual is
  expected from public matrix resets and is not treated as failure.
- The selected candidate averaged 444.6 iterations. On this machine the
  largest complete selected-candidate compute sample was under 50 ms; these
  small synthetic timings do not justify a CI gate or extrapolation to large
  browser workloads.
- The exhaustive total/batch grid is restricted to three small representative
  fixtures. Broader fixtures use current/160/320 totals; unsafe large exhaustive
  matrices are explicitly omitted from the JSON.

The quality decision is the 32/K=3/guarded endpoint policy. The performance
evidence supports graph reuse and size-class caps. Wall time is only the hard
safety boundary.

## 11. Visual and machine-readable artifacts

Run:

```bash
pnpm analyze:forceatlas2-convergence
```

Then open:

```text
output/convergence1a/convergence-comparison.html
```

The self-contained HTML/SVG shows current fixed-budget output, the selected
diagnostic candidate, a 1,000-iteration one-shot comparison, and hidden probe
arrows for small connected Focus, isolate-heavy Focus, long-chain Focus, and
Global reference-only. Its folder-prior row shows current G1/G3 alternatives
and clearly labels G3 as examined but not adopted. Labels and geometry are
synthetic and private-safe.

Machine-readable evidence is written to:

```text
output/convergence1a/convergence-results.json
```

Both artifacts are ignored. No private vault data or extracted Obsidian source
is read or committed.

## 12. Obsidian comparison at the correct level

Obsidian's observed alpha cooling is a fixed temperature schedule with no
displacement test. The Icarus recommendation measures visible coordinate
change, adapts work to the graph, and retains a deterministic cap. It does not
copy alpha values, tick counts, publishing cadence, velocities, or a persistent
worker.

The equivalent product behavior is lifecycle-level:

```text
wake only on meaningful topology/physics change
warm-start spatial context
settle enough within hard bounds
sleep and preserve exact positions while unchanged
```

A persistent worker is not justified: public batches settle the tested Local
fixtures, replacement/latest-wins remains simpler, and exact caches already
provide sleep semantics. A ForceAtlas2 fork is also not justified: no tested
result requires access to private matrices strongly enough to own a fork.

## 13. Files, dependencies, and validation

The spike adds diagnostic fixtures, metrics, public-batch/candidate runners,
focused tests, this report, a prompt archive, one command, and ignored output.
It introduces no new third-party version: the diagnostics package declares
direct use of the repository's already pinned `graphology@0.26.0` and
`graphology-layout-forceatlas2@0.10.1`.

Validated on the task branch:

```text
pnpm install --frozen-lockfile                                      PASS
pnpm --filter @icarus-graph-explorer/vault-diagnostics typecheck  PASS
pnpm exec vitest run tools/vault-diagnostics                      PASS
pnpm analyze:forceatlas2-convergence                              PASS
pnpm benchmark:local-renderer -- --profile smoke                  PASS
pnpm benchmark:local-renderer -- --profile small                  PASS
pnpm benchmark:local-renderer -- --profile medium                 PASS
pnpm benchmark:global-renderer -- --profile small                 PASS
pnpm benchmark:global-renderer -- --profile medium                PASS
pnpm check                                                         PASS
git diff --check                                                   PASS
```

The full check passed 160 files / 1,356 tests plus the production web build.
Wall-clock evidence is never a CI assertion.

## 14. Next implementation plans

```text
CONVERGENCE1B — implement Local bounded convergence
CONVERGENCE1C — design and implement Global macro-step convergence
```

CONVERGENCE1B is complete. Do not start CONVERGENCE1C automatically. SPATIAL2A
convergence remains a later, separate task after the base Global macro
lifecycle is stable.

## 15. CONVERGENCE1B production validation

The production implementation keeps the accepted policy unchanged and moves
the canonical Local percentile, root RMS, unique-neighbor degree, movement,
stability, and cap definitions into `renderer-sigma`. The diagnostic imports
those primitives. The schema-v2 request embeds the complete deterministic
policy and the `local-layout-v2` fingerprint includes it; timeout and observed
compute evidence remain excluded.

The regenerated matrix preserves the decision outcome: 19/19 eligible
fixtures stabilize, zero false early stops, mean iterations are `444.63`, the
hidden-probe p90 median/maximum remain `0.0023978` / `0.0047802`, and the
low-degree probe-maximum p90 remains `0.00651804`. Measuring unrounded
intermediate production frames re-observes the evidence quantiles as
`0.000655`, `0.00201`, and `0.00505`; this implementation-validation detail does
not retune the archived evidence or `local-fa2-convergence-v1` threshold of
`0.00512`.

Synthetic production benchmarks report stable stops for 4, 13, and 61 nodes at
416, 224, and 192 iterations. A 609-node / 1,208-edge profile exercises the
`>500` cap and finishes 240 iterations in eight batches (including the final
16-iteration batch) in about 574 ms on the validation machine. Its final p90
`0.00707` and low-degree maximum `0.01893` are explicitly labelled
`max-iterations`, not converged. No external dependency was added and Global,
SPATIAL2, camera-density, visual-style, and temporary-constraint behavior remain
outside this implementation.
