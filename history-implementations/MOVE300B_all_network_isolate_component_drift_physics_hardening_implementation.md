# MOVE300B — All Network isolate/component drift physics hardening

## Root cause

The retained All simulation advanced every visible node on every hot
`forceAtlas2.assign(1)` call. Long direct File holds therefore gave degree-zero
nodes and disconnected components hundreds or thousands of additional global
repulsion steps even though they had no reference or Pull relationship to the
dragged File. This was a raw FA2 disconnected-component effect amplified by the
unbounded hot lifecycle, not a reset at release.

`pnpm analyze:network-physics-drift` reproduces the defect with a pre-settled
300-node fixture: an 80-node connected core, 190 isolates, and ten disconnected
three-node components. After the same 640-iteration Global settle, the raw
production analogue's unclustered degree-zero p90 radius grew monotonically:

```text
299.427173 → 299.654906 → 302.237808 → 309.595613 → 334.121439
```

The final disconnected-component centroid-drift p90 was `42.252904`, and the
maximum isolate displacement was `35.521921` graph units.

M2 was not the source. Applying the real output-only handoff once changed mean
within-folder distance from `219.543476` to `202.375176`, mean folder-centroid
separation from `50.923787` to `51.027198`, degree-zero p90 radius from
`299.427173` to `277.831443`, and mean reference-edge length from `18.172881`
to `17.444615`. The unbounded hold then expanded both unclustered and clustered
seeds. No diagnostic candidate fed M2 output back into FA2.

## Selected solution

Candidate A1 was selected:

- reference edges are indexed as deterministic undirected components once per
  retained All simulation;
- the constrained File's reference component remains dynamic;
- any positive-strength resolved Pull group containing an active component
  activates every reference component represented in that group, transitively;
- folder membership and the automatic M2 field never create runtime coupling;
- all nodes outside that closure retain their gesture-start transient
  coordinates around each hot public FA2 iteration and at each published
  cooling endpoint;
- stabilized nodes remain in the retained graph, so their repulsion continues
  to affect the active region;
- convergence is evaluated on the active closure, preventing stable unrelated
  nodes from hiding unsettled active motion;
- a later gesture resolves a fresh active closure and captures fresh transient
  stabilization coordinates.

Candidate A2 physical exclusion was unnecessary and would have removed the
repulsive context seen by active nodes. Candidate B centroid stabilization
also stopped centroid drift but performed more bookkeeping while permitting
unrelated internal motion with no measured response benefit. The held-stable
while-pressed state was not adopted, so Network physics remains schema 2 with
the existing sleeping/hot/cooling states. A released degree-zero singleton
without effective Pull sleeps immediately at its exact released coordinate:
the hard constraint is already cleared, and the one-node region has no active
relationship to cool. Pull-bound singletons and all multi-node closures retain
bounded cooling.

The React performance guidance reinforced keeping per-frame membership and
coordinates entirely in retained worker-side structures. No React component,
hook dependency, or render-state path changed.

## Before/after evidence

The corrected production simulation matches A1 on the same stationary hold:

| Scenario | Raw p90 radius end | Production p90 start → end | Unrelated isolate displacement | Component drift p90 | Active nodes |
| --- | ---: | ---: | ---: | ---: | ---: |
| unclustered, no Pull | 334.121439 | 299.475533 → 299.878332 | 0 | 0 | 80 |
| clustered, no Pull | 318.427820 | 277.856331 → 276.839756 | 0 | 0 | 80 |
| clustered, one Pull | 319.680536 | 277.856331 → 280.300443 | 0 | 0 | 80 |
| clustered, cross-component Pull | 318.898592 | 277.856331 → 276.935263 | 0 | 21.461189 intentional coupled-component motion | 83 |

The unclustered connected-core mean motion remained `11.791331` versus
`11.762995` in the raw control, and every held target had zero error. The
separate production 300-node lifecycle probes moved the connected neighbor by
`39.343714` without Pull and `56.904918` with Pull, then slept after 672 and
800 cooling iterations respectively.

All isolate-heavy scenarios slept with no failure and returned zero work on a
later `advance()`. Cooling evidence was:

| Scenario | Cooling iterations | Local cooling time |
| --- | ---: | ---: |
| unclustered, no Pull | 512 | 157.2376 ms |
| clustered, no Pull | 448 | 135.7101 ms |
| clustered, one Pull | 704 | 321.8364 ms |
| clustered, cross-component Pull | 2,976 | 1,285.3607 ms |

An isolated File itself reached the exact target, left the unrelated connected
core unchanged, and slept on release with zero cooling frames. Production
unclustered hot-turn timing was `1.3527/2.445025 ms` p50/p95 for four physical
iterations. These September 14, 2026 timings are local evidence, not CI limits.

Place remains outside the worker seed; the PHYSICS1 analyzer still reports one
fixed translation application and zero target-inversion error. Move remains
session-only and has no cache, persistence, view/history, source, or camera
write surface.

## Boundaries

- All Network Move remains supported through 300 visible simulation nodes;
  301 remains rejected.
- Focus Network Move remains supported through 100 nodes and uses its unchanged
  whole-Focus lifecycle.
- M2 remains a one-time output-only seed transform and never feeds back into
  FA2.
- Folder clustering Strength changes still invalidate transient Move and run
  the normal finite layout reset; that compact-layout reset is expected.
- Density remains camera-only and does not enter physics.
- Worker schema, temporary-constraint schema, Pull resolution, Place
  composition, gesture semantics, cache keys, and persistence are unchanged.

## Validation

- `pnpm install --frozen-lockfile` — passed.
- `pnpm exec vitest run packages/renderer-sigma` — 58 files, 444 tests passed.
- `pnpm exec vitest run apps/web` — 95 files, 710 tests passed.
- `pnpm analyze:network-physics-drift` — passed all raw reproduction,
  A1/B comparison, M2, Pull, isolated-File, stationary-hold, cooling, and
  post-sleep gates.
- `pnpm analyze:physics1` — passed, including 300-node All and All+Pull.
- `pnpm benchmark:file-move` — passed; 10,000 pointer samples still coalesced
  to three commands.
- `pnpm benchmark:global-renderer -- --profile small` — passed.
- `pnpm benchmark:global-renderer -- --profile medium` — passed.
- `pnpm check` — passed: formatting, lint, all workspace typechecks, 261 test
  files / 2,123 tests, and the production web build.
- `pnpm desktop:check` — passed, including 16 Rust tests.
- `pnpm desktop:build` — passed with a fresh optimized executable.
- `git diff --check` — passed.

## Native QA handoff

Fresh executable:

`C:\Users\leona\Documents\GitHub\icarus-graph-explorer-move300a\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe`

- Size: 13,527,552 bytes
- SHA-256: `92DD67DF55E28C6A79A5381EC04F02DD0442E1C6E1B9E37CAF545738BD859659`

Real-vault checklist:

1. Open the real vault in **All + Network**.
2. Confirm the visible simulation node count is at most 300.
3. Drag a connected File for at least 10 seconds.
4. Keep moving it continuously and watch the outer isolated Files.
5. Hold the pointer stationary for about 10 seconds without releasing.
6. Confirm the outer isolate/component radius does not keep inflating.
7. Release and confirm bounded settling.
8. Drag an isolated File itself; it should move while unrelated
   isolates/components remain stable.
9. Repeat with folder clustering enabled.
10. Repeat with an authored Pull rule if available.
11. Change Folder clustering Strength afterward; a normal compact-layout reset
    is expected.
12. Change Density if desired; only camera framing should change.

## Merge state

This hardening remains in existing draft PR #103. It must remain draft and
unmerged until the user completes native real-vault acceptance and explicitly
approves the merge. PR #100 and unrelated worktrees were not modified.
