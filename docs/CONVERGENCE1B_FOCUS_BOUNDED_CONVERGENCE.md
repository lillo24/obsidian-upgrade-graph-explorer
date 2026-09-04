# CONVERGENCE1B — Focus Network bounded ForceAtlas2 convergence

Status: **IMPLEMENTED — production Local convergence complete; pre-merge validation recorded below.**

## 1. Summary

Focus Network no longer accepts the endpoint of one node-count-selected
ForceAtlas2 call. One latest-result-wins replacement-worker request now reuses
one Graphology graph across public ForceAtlas2 batches until the accepted Local
stability rule or deterministic iteration cap is reached. The immediate
deterministic/current graph remains interactive, and the canvas adopts and
caches exactly one strictly validated final result.

No Global, SPATIAL2, camera-density, Visual Group, per-file Size, ForceAtlas2
setting, or temporary-constraint behavior changed.

## 2. Policy

The versioned identity is `local-fa2-convergence-v1`:

```text
batch                                  32 public ForceAtlas2 iterations
all-node normalized p90 threshold      0.00512
degree-0/1 normalized maximum          0.01024
accepted stable batches                3 consecutive full batches
caps                                   <=100: 1,000; 101-500: 600; >500: 240
production wall-time safety            2,000 ms, checked between batches
```

Final cap batches are 8, 24, and 16 iterations respectively. They update the
last movement diagnostics but cannot complete the full-batch stable sequence.
A cap stop is always labelled `max-iterations`. One validated root-only graph
returns `degenerate`, zero iterations/batches, exact `(0,0)`, and null movement.

## 3. Metrics

Each comparison translates the previous and current frames by their own Focus
root. Per-node endpoint movement is divided by the previous raw frame's RMS
radius around its root with a `1e-6` floor. Rotation and scale are not aligned
away. Metrics report scale plus p50, p90, and maximum for all nodes, degree 0,
degree 1, degree 2+, and combined low degree.

Degree uses an undirected unique-neighbor index computed once from the request;
reciprocal and parallel projected edges do not inflate adjacency. Production
owns the canonical percentile, RMS, degree, root alignment, movement, guard,
and cap functions. CONVERGENCE1A diagnostics import those functions.

## 4. Worker and result contract

Local request/result schema version is 2. The request contains the full
deterministic policy and node-derived cap; the UI supplies neither thresholds
nor an iteration budget. Success carries stop reason, policy version,
iterations, batches, stable count, final movement, compute time, and positions.
The client validates these values against the complete originating request,
including degree-class counts, threshold truth, counter consistency, exact node
set, and exact root origin.

The worker checks time only after a public batch returns. `max-wall-time` is a
structured error with completed iterations/batches and last movement, never a
success containing partial positions. Generic compute failures also remain
explicit. Every request still creates one replaceable worker; supersession
terminates the old worker, stale output cannot adopt, and no batch is streamed.

## 5. Cache and restart behavior

- An exact `local-layout-v2` fingerprint hit restores exact settled positions
  and sends zero worker requests.
- Returning to an older retained fingerprint restores its exact cached result.
- Rearrange deletes/bypasses the exact entry and builds the new request from
  current automatic graph coordinates before running the complete lifecycle.
- Topology changes preserve surviving automatic coordinates through Local
  reconciliation and retain deterministic seeds only for new nodes.
- A worker failure writes no cache value and leaves the displayed coordinates
  unchanged.

The fingerprint includes the schema, full convergence policy and cap, root,
semantic topology/roles/weights, automatic node sizes, and unchanged Local
ForceAtlas2 settings. It excludes warm coordinates, wall-time, compute/result
diagnostics, camera/density, visual styles, per-file display multipliers,
selection, hover, labels, and source text.

## 6. Residual-drift evidence

The regenerated 22-fixture matrix preserves the accepted result:

```text
eligible reference fixtures stable    19 / 19
false early stops                      0
mean iterations                        444.63
hidden-probe p90 median                0.0023978
hidden-probe p90 maximum               0.0047802
low-degree probe-maximum p90           0.00651804
legacy fixed-job A→B median p90        0.08417428
```

A production-to-hidden-32-iteration probe regression directly asserts both
selected guards for a representative Focus fixture. Unrounded production-frame
parity re-observes the three evidence quantiles as `0.000655`, `0.00201`, and
`0.00505`; the accepted `0.000672`, `0.00204`, and `0.00512` decision and v1
policy are intentionally not retuned.

## 7. Performance

The benchmark reports lifecycle evidence rather than a flaky timing gate:

| Profile | Nodes / edges | Stop           | Iterations / batches | Compute ms | Final p90 | Low-degree max |
| ------- | ------------: | -------------- | -------------------: | ---------: | --------: | -------------: |
| smoke   |         4 / 5 | stable         |             416 / 13 |      1.201 |   0.00408 |        0.00486 |
| small   |       13 / 22 | stable         |              224 / 7 |      0.807 |   0.00343 |        0.00534 |
| medium  |      61 / 110 | stable         |              192 / 6 |      3.030 |   0.00240 |        0.00334 |
| stress  |   609 / 1,208 | max-iterations |              240 / 8 |    574.218 |   0.00707 |        0.01893 |

The 609-node case explicitly exercises the `>500` cap and final 16-iteration
batch. It stays below the 2-second starting safety limit but is not falsely
reported stable. Layout still runs wholly off-main in the replacement worker.

## 8. Compatibility

SPACING1B owns automatic/user camera density and remains independent of
accepted coordinates. Visual Groups and per-file Size continue through
style/display-only setters and submit zero layout work. MOVE1A's temporary
constraint port is not consumed or activated. Global base layout, folder prior,
SPATIAL2 dynamic Pull/fixed Place composition, and their fingerprints/caches
are unchanged.

This finite Local job is not PHYSICS1 continuous simulation. It adds no
persistent worker, animation, reheating/cooling controls, File dragging, pinning,
or mathematical-equilibrium claim.

## 9. Tests and QA

Focused automated coverage includes pure metric/policy boundaries; public batch
reuse; stable, cap, partial, degenerate, disconnected, low-degree, rounding,
determinism, timeout, and hidden-probe behavior; strict schema-v2 response
validation; supersession/disposal; cache hit, old-fingerprint restoration,
Rearrange warm start/failure, topology survivor/new-node handling; and existing
visual/group/per-file-size operation oracles.

The diagnostic matrix and smoke/small/medium/stress benchmarks were rerun.
`pnpm check` passed formatting, lint, all recursive typechecks, 1,382 tests in
162 files, and the production web build. `pnpm desktop:check` passed and
`pnpm desktop:build` produced the release executable.

A production-build browser smoke used the bundled sample: Focus Network opened,
explicit Re-layout completed, a hops change and Back/Forward restored their
states, Network → Hierarchy → Network restored Focus Network, controls remained
responsive, and the console had no warnings or errors. Native-window automation
was unavailable, so the release executable was built but not manually operated.
PR CI and post-merge CI are recorded in the final integration update. Wall-clock
measurements remain evidence, never assertions.

## 10. Files and dependencies

The implementation adds `local-convergence.ts` and focused renderer/canvas
tests, versions the Local layout types/compute/worker client, updates the Local
canvas/session, imports production metric primitives into diagnostics, extends
the Local benchmark, updates adjacent architecture/performance/roadmap maps,
and archives the exact task prompt. External dependency additions: **zero**.

## 11. Concurrency and follow-up

At branch creation and the pre-commit integration recheck, PR #60 (SPACING1B)
and PR #67 (SPATIAL2B) were open drafts in separate worktrees. Neither
branch/worktree was edited, reset, or deleted. `main` remained at `e51f52e`, so
no rebase was required. Their state is checked once more immediately before
merge.

Because CONVERGENCE1B is merging first, PR #60 must rebase onto the resulting
`main` and repeat its Local native camera/density acceptance before it merges.

## 12. Follow-up

```text
CONVERGENCE1A  complete
CONVERGENCE1B  complete
CONVERGENCE1C  Global folder-macro convergence next / pending
```

CONVERGENCE1C was not started.
