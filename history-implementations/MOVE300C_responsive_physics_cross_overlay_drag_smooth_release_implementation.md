# MOVE300C — Responsive physics, cross-overlay drag, and smooth release

## Result

MOVE300C corrects the three failures reported during native QA while preserving
the existing release boundaries: All + Network remains available through 300
visible simulation nodes, and Focus + Network remains available through 100.
The work stays in draft PR #103 and is not approved for merge until the native
checklist below is accepted explicitly.

The implementation is split into the requested reviewable units:

- physical behavior: soft whole-graph stabilization and isolate release;
- pointer ownership: one native pointer across graph-adjacent HTML overlays;
- release presentation: one velocity-preserving continuous follower.

The Vercel React performance guidance influenced the ownership boundary: hot
pointer, worker, and presentation-frame data remains imperative and does not
enter React render state.

## Root causes

The following causes are confirmed from the reviewed code and reproductions:

- MOVE300B restored every node outside a reference/Pull-derived active closure
  after each public ForceAtlas2 call. That stopped ring growth by hard-freezing
  unrelated components, so an isolated File could not yield to repulsion. Its
  degree-zero release shortcut also declared an isolate settled solely because
  it had no reference edge.
- Global and Local sessions treated Sigma `leaveStage` as pointer loss. Sigma's
  compatibility mouse path also uses document bubble listeners, so an HTML
  overlay that stopped propagation could hide movement or release.
- Cooling presentation repeatedly restarted a 120 ms cubic smoothstep from the
  currently displayed coordinates. Each raw cooling target reset its timing and
  velocity, then the final adoption changed phase abruptly.

Raw cooling batches can produce large coordinate gaps and browser scheduling
can coalesce several valid frames; those are confirmed contributors to the
visibility of the old release artifact, but they were not the physical cause of
MOVE300B's hard freeze or ring expansion. No reset, cache restore, repeated M2,
Place recomposition, or camera fit occurs on the release path.

## Bounded physical response

All-mode ForceAtlas2 once again advances all visible nodes. A seed-lifetime,
undirected reference-component index records each component's initial centroid.
After every defined physical integration quantum, a finite translation nudges
the current centroid toward that stable reference. The production gain is
`0.015` per quantum and the translation is capped at `0.015` of the whole
seed's RMS radius per quantum. A singleton therefore has a finite soft tether,
not an exact pin. The reference and cap scale are created with the retained
simulation seed and are not recaptured on a gesture or at release, preventing
repeated-gesture anchor ratcheting.

The constrained File remains exact while held. On release, including a directly
dragged isolate, the hard target is cleared and the File rejoins the same finite
ForceAtlas2, authored-Pull, and soft-centroid system. There is no permanent pin,
target-based anchor, exact undo, or reference-degree sleep shortcut. Convergence
now evaluates every node that can move. Hot one-step Pull integration and
32-iteration no-Pull cooling apply the same per-quantum physical meaning; the
batched no-Pull correction uses compounded gain and a linearly accumulated cap.

The retained MOVE300B analyzer now compares the unbounded baseline, former
hard-node/hard-centroid candidates, and soft gains `0.005`, `0.015`, and `0.04`
from identical accepted snapshots. `0.005` allowed materially more drift;
`0.04` approached the rejected hard behavior. `0.015` preserved observable
response while keeping fixed-reference radial growth below the explicit 5%
bound.

| Scenario | Production normalized p90 radius growth | Paired drag-vs-control isolate max difference | Component drift p90 |
| --- | ---: | ---: | ---: |
| Unclustered, no Pull | 0.008445 | 0.008239 | 3.154407 |
| Clustered, no Pull | 0.011296 | 0.011612 | 4.067098 |
| Clustered, one Pull | 0.011057 | 0.009169 | 4.179430 |
| Clustered, cross-component Pull | 0.010990 | 0.016297 | 8.877414 |

The raw failing baseline still reproduces monotonic p90 ring expansion:
`299.427173 → 299.654906 → 302.237808 → 309.595613 → 334.121439`, or
11.5869%. Production growth is 0.8445%–1.1296% on the same 300-node fixture.
The directly dragged isolate held zero target error and then slept after seven
cooling frames / 224 iterations / 115.7039 ms. Its final target error was
37.924780 versus a 41.620000 initial drag offset, proving that it rejoined the
physical system without an exact teleport back. A later `advance()` returned no
work.

M2 remains one-time, output-only seed shaping. Authored Pull remains part of
each applicable physical step. Place remains a fixed display translation,
applied once to output and inverted once for the pointer target.

## Native pointer ownership

`FileMovePointerOwner` is shared by Global and Local sessions. A primary native
`pointerdown` captured on the stable graph container supplies the actual
pointer ID; the session claims it only after Sigma synchronously identifies a
movable node. The owner prefers native pointer capture and retains document
capture listeners as the deliberate fallback for Sigma 3.0.3 and overlays that
stop propagation.

Movement uses `clientX/clientY` minus the graph container rectangle and is not
clamped at the graph edge. While native ownership is active, duplicate Sigma
compatibility movement and release events are ignored. Pointer-up releases the
constraint exactly once and installs a one-turn capture-phase click suppressor,
which blocks the released overlay control but removes itself after that click
or the zero-delay cleanup turn; the next unrelated click is unaffected.

`leaveStage` now performs only hover/arrangement cleanup and never cancels File
Move. Pointer ID is checked for movement, cancellation, and lost capture.
Pointer cancel, Escape, window blur, visibility loss, invalidation, failure, and
disposal clear the owner and listeners. Keyboard Move continues on its existing
command path.

Tests use real happy-dom elements plus a stop-propagating overlay to cover
out-of-container coordinates, mismatched pointers, release exactly once,
release-click suppression, next-click survival, and pointer-cancel cleanup.

## Continuous release presentation

The browser client now owns one critically damped analytic follower per cooling
interaction. Its angular frequency is `18 s⁻¹`; elapsed input is capped at
100 ms after suspension. A new raw target changes only the target coordinates:
displayed position and velocity are first advanced to that timestamp and then
continue without reset. There is no 120 ms deadline or sequence of easing
phases.

The final raw position is adopted exactly only when both position and velocity
are negligible. The position tolerance is `max(1e-6, scale × 0.00025)` and the
velocity tolerance is the position tolerance times `18 s⁻¹`. Reduced-motion
mode still adopts the validated raw frame directly. Re-grab preserves the
existing exact held-File overlay and bounded handoff for other nodes. Physics
is never seeded from display interpolation.

Deterministic client tests prove identical 300 ms progress (`x=97.109388` for a
0→100 target) at 30, 60, and 120 Hz and under the tested dropped-frame
sequence. The tail increments decrease monotonically after their peak, the
last pre-adoption increment is below `0.002`, retargeting retains nonzero
velocity, and a five-second suspended callback advances by at most the 100 ms
cap without a snap backlog.

An additional local Node probe of the exact follower used a fixed 51-graph-unit
raw offset, graph scale 100, and 60 Hz sampling. Both supported boundary sizes
reached exact presented rest in 34 frames / 566.667 ms after the final raw
target. Follower sampling, including creation of the returned position array,
measured 0.0224/0.2700 ms p50/p95 for 100 nodes and 0.0497/0.3277 ms for 300
nodes. These are synthetic Node measurements, not browser render or native
interaction timings.

## Runtime evidence and limits

The final 300-node drift run measured four-iteration hot-turn p50/p95 values of
4.168850/9.690375 ms (unclustered no Pull), 4.102800/8.602325 ms (clustered no
Pull), 3.024950/5.243175 ms (one Pull), and 3.154850/6.145400 ms
(cross-component Pull). These local Node timings fluctuate and are not gates.

`analyze:physics1` slept at the supported boundaries:

| Probe | Raw release-to-sleep | Cooling iterations | Neighbor response |
| --- | ---: | ---: | ---: |
| Focus 100 | 65.624 ms | 832 | covered by lifecycle fixtures |
| All 100 | 81.922 ms | 1,152 | covered by lifecycle fixtures |
| All 100 + Pull | 136.361 ms | 1,184 | covered by lifecycle fixtures |
| All 300 | 900.943 ms | 2,208 | 36.834241 |
| All 300 + Pull | 1,181.390 ms | 2,432 | 55.746358 |

The analyzer is synchronous Node evidence only: it does not include Worker
transport, browser scheduling, Sigma adoption, or WebGL rendering. Browser and
native neighbor-frame age, end-to-end release-to-presented-rest, and actual
Sigma presentation/adoption cost were not measured in this environment and are
not claimed. The Node follower work above isolates presentation math and array
materialization only. Native visual continuity, pointer ownership, neighbor
freshness, and camera neutrality therefore remain part of the merge gate.

No safety cap or timeout was enlarged. Focus physics, automatic Global layout,
raw/display separation, schemas, command coalescing, generation/gesture
validation, latest-valid neighbor progress, exact held-node overlay, worker
laziness, camera ownership, Density, persistence, source, Saved Views, history,
layout caches, Pull caches, and Place registry remain unchanged. Changing
Folder Clustering Strength still intentionally invalidates transient Move and
runs the normal finite automatic-layout reset.

## Automated validation

- `pnpm install --frozen-lockfile` — passed; lockfile already current.
- `pnpm exec vitest run packages/renderer-sigma` — 59 files / 449 tests passed.
- `pnpm exec vitest run apps/web` — 95 files / 717 tests passed.
- `pnpm analyze:network-physics-drift` — passed the baseline reproduction,
  paired control, soft-gain, fixed-reference, Pull, repeated/reference-lifetime,
  direct-isolate release, convergence, and post-sleep gates.
- `pnpm analyze:physics1` — passed all supported lifecycle and All 300/300+Pull
  probes; larger investigative fixtures retain their existing explicit caps.
- `pnpm benchmark:file-move` — passed; 10,000 raw pointer samples coalesced to
  three commands. No-Place conversion was 0.1299/0.2901 ms p50/p95; Place was
  0.2599/2.6971 ms.
- `pnpm benchmark:global-renderer -- --profile small` — passed.
- `pnpm benchmark:global-renderer -- --profile medium` — passed.
- `pnpm benchmark:local-renderer -- --profile small` — passed.
- `pnpm check` — passed formatting, lint, 35-workspace type checking, 262 test
  files / 2,135 tests, and the production web build.
- `pnpm desktop:check` — passed formatting/check plus 16 Rust tests.
- `pnpm desktop:build` — passed with a fresh optimized executable.
- `git diff --check` — passed.

No unrelated paid or external API tests were run. Generated aggregate analysis
output remains ignored.

## Native QA handoff

Fresh executable:

`C:\Users\leona\Documents\GitHub\icarus-graph-explorer-move300a\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe`

- Size: 13,528,576 bytes
- SHA-256: `AA4CB62C91B5C8EE4B607E95DD2D5A0D20352D7B5E821BE45A502976A94447DC`

Native automation was unavailable, so no native pass is claimed. Supply the
following exact six-item real-vault checklist to the user:

1. All Network on the real vault: drag near an isolated File. It can yield; it is not hard-frozen. Connected neighbors still react.
2. Move continuously for 10–20 seconds, then hold still for about 10 seconds. The outer ring does not keep inflating. Repeat several gestures without a cumulative outward ratchet.
3. Drag an isolated File itself and release. It rejoins bounded physical settling without a forced teleport or an unconditional no-physics shortcut.
4. Drag across Filters, Inspector, sidebar, and toolbar; return to the graph; release over a control. The drag stays attached, releases once, and does not activate the control. The next normal click works.
5. Release a connected File and observe the final movement. No smooth phase followed by an artificial final rush. Repeat a re-grab while it is settling.
6. Repeat relevant tests in Focus, with authored Pull/Place, and with reduced motion. Camera and Density stay unchanged unless explicitly operated. Escape and window blur clean up.

## Merge state

Draft PR #103 remains the review and native-QA artifact. MOVE300B's hard-freeze
and unconditional isolate-sleep decisions are superseded in current docs while
its historical prompt/report remain unchanged. Do not merge, run post-merge
verification, or remove the task worktree until the user reports native results
and explicitly approves the merge.
