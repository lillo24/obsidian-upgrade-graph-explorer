# MOVE300C — Responsive bounded physics, cross-overlay dragging, and continuous release motion

**Task:** Correct three native-QA failures in the existing MOVE300A/B draft. Implement and validate; stop for native user acceptance before merge.

## 1. Task and branch

Continue **PR #103** in `lillo24/obsidian-upgrade-graph-explorer`.

```text
Branch: codex/move300a-all-network-limit
Reviewed head: 9c44060ad9df2cdf031c57141d049ef171d94ed2
Status when this prompt was written: open, draft, unmerged
```

Use the existing task worktree when available. First inspect its status, current remote head, latest main, `AGENTS.md`, and concurrent work. Preserve uncommitted work and unrelated branches; do not reset or overwrite them. If implementation advanced beyond the reviewed head, reconcile this prompt against the actual code rather than reinstating an old version.

The PR description still describes the initial size-limit change and is not a complete description of MOVE300B. Read the code and implementation reports. Update the PR description after this correction.

Keep these availability limits:

```text
All + Network:   up to 300 visible simulation nodes
Focus + Network: up to 100 visible simulation nodes
```

Do not create another scale experiment, lower the limits, or merge automatically. If #103 has already merged by execution time, use a narrowly scoped follow-up branch from current main and retain the same native acceptance gate.

## 2. User intent and the three failures

The user tested their roughly 255-file real vault and found performance satisfactory, but reported:

1. Isolated Files no longer react at all. They should move naturally under nearby physical influence without the disconnected ring expanding indefinitely.
2. A File drag ends when the pointer crosses Filters or other HTML controls. The drag should retain ownership until release or genuine cancellation.
3. Release looks smooth initially, then rushes through the final segment with an abrupt speed change. The desired result is continuous, natural settling—not a sequence of visibly different animation phases.

This prompt supersedes MOVE300B's preference for hard-freezing unrelated components. Preserve its useful diagnostics, not its rejected product behavior.

**The target is bounded responsive motion, retained drag ownership, and continuous displayed velocity.** The task is not complete merely because the ring stops growing, coordinates remain finite, or an easing function is present.

## 3. Verified findings versus remaining hypotheses

The preceding review inspected the files at the head above. Recheck these findings locally, and add reproducing tests before fixes.

### Confirmed in MOVE300B

- `NetworkPhysicsDynamicCouplingIndex` identifies a reference/Pull-connected active closure.
- `reassertStabilizedPositions()` restores every outside node to its gesture-start coordinates. This makes disconnected singleton Files physically immobile in published frames.
- `settlesWithoutCooling()` immediately sleeps on release of a degree-zero singleton without Pull. That is not a force-convergence test: the node still experiences gravity and repulsion in the graph.
- The diagnostic Candidate B uses `recenterComponents()` to restore centroids **exactly**. For a singleton, this also freezes the node. That experiment did not validate a genuinely soft restoring influence.

### Confirmed drag cancellation

Global and Local sessions both call `cancelTemporaryFileMove('pointer-lost')` on Sigma `leaveStage`. Sigma 3.0.3's mouse captor already listens on `document` for movement/release; outside-canvas movement is not inherently unsupported. Fix our cancellation/ownership policy rather than assuming Sigma cannot supply those events.

### Confirmed presentation behavior

`network-physics-worker-client.ts` restarts cubic smoothstep for each adopted cooling target, with distance-derived duration capped at 120 ms. It preserves position but not velocity when retargeting. Repeated restarts can repeatedly sample the slow beginning of the curve; the final uninterrupted interpolation can then accelerate visibly.

There is no verified special “worker slept, force a snap now” branch. Do not invent one as the root cause. A controlled reproduction of the existing formula showed the reported pattern is possible; its frequency and magnitude on the real vault remain to be measured.

### Additional physical transition to inspect

Hot turns use four separate public `assign(1)` calls with corrections between iterations. Cooling without Pull uses one `assign(32)` call, restoring MOVE300B's frozen positions only outside that batch. Those nodes can move internally and affect other nodes before being restored. With Pull, cooling already uses single-iteration calls and interleaved corrections.

Changing public-call boundaries changes solver-state reset frequency. A 32-iteration convergence checkpoint does not require a single 32-iteration public call. Separate integration semantics, measurement checkpoints, and presentation cadence.

The best bounded-motion policy and the exact visible contribution of the solver transition are still design questions. A critically damped follower is a presentation candidate, not an already proven complete fix.

## 4. Read before editing

Read the closest current source maps and relevant portions of:

```text
packages/renderer-sigma/src/physics/{simulation,dynamic-coupling,pull,seed,protocol}.ts
packages/renderer-sigma/src/{session,local-session,file-move}.ts
packages/renderer-sigma/src/{local-convergence,global-convergence,global-folder-macro}.ts
packages/renderer-sigma/src/{GlobalGraphCanvas,LocalGraphCanvas}.tsx
apps/web/src/workers/network-physics-worker-client.ts
apps/web/src/workers/network-physics.worker.ts
related gesture, client, simulation, and presentation tests

tools/vault-diagnostics/src/network-physics-component-drift-analysis.ts
tools/vault-diagnostics/src/physics1-candidate-analysis.ts

docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/decisions/0023-continuous-network-public-forceatlas2-lifecycle.md
docs/decisions/0024-production-network-editing-and-temporary-file-move.md
history-implementations/MOVE300B_*implementation.md
```

Confirm installed Sigma and ForceAtlas2 versions from the lockfile/resolved packages. Do not upgrade them for this task.

## 5. Boundaries that remain authoritative

- Move is temporary physical interaction, not persistent placement. No source, Saved View, history, layout-cache, Pull-cache, or Place-registry writes.
- Keep raw simulation coordinates separate from displayed interpolation. Never seed physics from decorative easing state.
- All targets remain in dynamic coordinates before fixed Place. Apply the winning Place translation exactly once for display and invert it exactly once for the pointer target.
- Automatic M2 folder shaping remains output-only. Do not repeatedly feed shaped output back into ForceAtlas2.
- Keep genuine authored Pull behavior and its membership resolution. Folder membership alone is not a reference edge.
- Physics/presentation frames remain imperative and camera-neutral. Density stays camera-only; no automatic Fit during dragging or settling.
- Changing Folder Clustering Strength may intentionally invalidate temporary positions and restore/recompute the automatic layout. Do not turn that reset into a persistence feature.
- Preserve generation/gesture checks, latest-valid neighbor progress, exact held-node overlay, and bounded command transport added by prior hardening.

Use three reviewable implementation commits within the same task: physical behavior, pointer ownership, and release presentation. Diagnose their interaction together before QA.

## 6. Correction A — Replace hard freezing with bounded physical response

### Required behavior

All visible simulation nodes must remain able to respond to relevant physical influence. Lack of reference links is not proof of physical independence: repulsion still exists.

A connected neighbor should react to a drag. An isolated File near a moving File should be able to yield. Far-away Files need not exhibit artificial minimum motion on every drag, but must not be hard-locked solely because they are disconnected.

The outer ring must not keep inflating merely because the user holds or repeatedly moves a node. Releasing an isolated File must clear the hard pointer constraint and evaluate applicable forces, not classify it as settled solely from reference degree.

### Focused design experiment, not another broad research milestone

Start by evaluating a **genuinely finite soft stabilizing influence** around a stable spatial reference, with ForceAtlas2 and authored Pull still operating. A soft component-centroid restoring term is one candidate. Unlike the existing diagnostic B, it must allow a centroid—and therefore a singleton—to move under opposing forces.

Do not claim a finite restoring gain guarantees a good equilibrium without testing it. Explain the reference frame, units, strength, and application cadence. Apply the policy per defined physical integration quantum, not per render callback or incoming pointer event.

Evaluate only a small parameter range on representative fixtures. Choose the simplest policy that meets both response and boundedness requirements. Alternatives are allowed if they are better supported; do not silently introduce another solver, private FA2 APIs, or a fork.

Make the reference lifetime explicit. Do not continually reset stabilizing anchors to drifting positions, which could ratchet the graph outward across repeated gestures. Conversely, do not teleport a node back to an old layout or impose an exact undo on release. Do not set a released isolate's anchor to its final pointer target merely to fake convergence.

During a direct constraint the held File remains exact. On release it rejoins a well-defined finite-force system without a special permanent pin. Keep session-local reference data out of persistence.

Authored Pull must retain an effective influence; a hidden stabilizer must not overpower all user strengths. If supporting full physical response requires a material redesign of Pull or M2 coordinates, present that specific decision before implementing it.

### Tests that distinguish success from the previous false success

Use the existing 300-node isolate-heavy fixture, but first obtain accepted positions through the relevant production base/Pull paths. Also test folder shaping off. Preserve an identical snapshot for paired runs:

```text
Control: same initial state and compute budget, no displacement of held target
Experiment: move a nearby File toward an isolate/component
```

Compare the two. Nonzero motion from an initially unsettled graph alone does not prove response to the user's drag.

Measure individual displacement and centroid motion in raw graph space. Measure isolate-radius change around a fixed starting center as well as the current center; normalize long-run growth against a fixed initial scale. A moving centroid or expanding normalization radius must not disguise drift.

Required cases:

- connected core plus many isolates and several small disconnected components;
- approaching an isolate and then moving away; directly dragging an isolate and releasing it;
- a target held stationary for 10 seconds, continuous movement for 10–20 seconds, and repeated gestures;
- no Pull, one Pull, and Pull spanning reference-disconnected nodes; nonzero Place;
- cold start from accepted automatic geometry and a second gesture before previous settling ends.

Report response relative to the paired control, ring growth, component drift, and release outcome. Define quantitative acceptance tolerances from before/after evidence, plus native visual acceptance. Reject near-zero “response” that is only floating-point noise, as well as a hidden near-hard pin.

### Cooling and constraint cadence

Remove or replace the unconditional isolate `settlesWithoutCooling()` shortcut. A true degenerate result remains possible only when the applicable physical state justifies it—not simply because no references exist.

Any new stabilizing correction must have consistent physical meaning in hot and cooling phases. Do not restore positions only after a large batch while claiming they remained constrained throughout it. Inspect the hot/cooling public-call boundary mismatch explicitly and use an appropriate shared physical-step primitive where justified.

Keep convergence checks at their documented iteration interval, but evaluate every node that can now move. Do not retain the old active-closure-only stop metric while softly stabilized outside nodes continue moving. Preserve low-degree and raw-drift guards and the full-batch requirement.

No timer-only “freeze after a second” or false sleeping state. A held-stable optimization is optional only after genuine constrained-state stability; it must preserve the active pointer constraint and wake on a new target. It is not a substitute for fixing expansion during continuous input.

Limit physical-policy changes to All unless a shared correctness fix is required. Keep Focus base-layout convergence and ordinary Global layout behavior unchanged. Benchmark any live integration change; do not quietly enlarge safety caps/timeouts to conceal failure.

## 7. Correction B — Retain the drag across overlays

### Fix the exact rule first

During an owned File drag, `leaveStage` must not mean `pointer-lost`. Keep leave-stage hover cleanup separate from gesture cancellation. Genuine Escape, blur, visibility loss, pointer cancellation, invalidation, and disposal must still terminate safely.

Verify the complete movement and release path through overlays. Removing one cancellation handler is insufficient if an overlay stops propagation or release is lost.

### Ownership implementation

Use a small shared All/Focus gesture-ownership mechanism. Prefer native pointer capture on a stable element, or an equivalently robust document-capture listener strategy after inspecting Sigma's event path.

Associate the **actual native pointer ID** with the gesture; do not invent it from a MouseEvent or assume a constant ID. If Sigma's event exposes only a compatibility mouse event, bridge the native pointer stream deliberately. Avoid receiving each movement twice from Pointer Events and compatibility mouse/Sigma events.

Preserve the 3-pixel drag threshold and existing click/double-click arbitration. Only a primed/owned graph interaction may acquire drag-specific behavior; ordinary use of Filters, menus, and other controls must remain unaffected.

Requirements:

- Maintain the same gesture while crossing Filters, Inspector, Network Explorer, toolbar, menus, and their portals within the application window.
- Derive canvas coordinates from client coordinates and the actual graph container rectangle; do not use an overlay's `offsetX/offsetY` or clamp the target to the canvas edge.
- Prevent the active drag's release/click sequence from activating an underlying button, text field, checkbox, or range slider. Do not swallow the next unrelated click after cleanup.
- A release over an overlay ends the constraint exactly once. Leaving the OS window or a genuine focus/capture loss follows safe cancellation; indefinite cross-application tracking is not required.
- Match pointer identity for cancel/lost-capture events. Normal capture release after pointer-up must not send a second conflicting cancellation.
- Remove listeners/capture on all end, failure, unmount, and invalidation paths. No permanent transparent full-page overlay or globally disabled controls.
- Keep keyboard Move on its existing command path. Do not fake pointer capture for keyboard input.

Use a real browser test with actual overlay elements, including one that stops event propagation. Mocked Sigma callbacks alone cannot establish cross-overlay correctness. Verify mouse and touchpad behavior in the release executable with user QA.

## 8. Correction C — Fix release motion without hiding physics defects

### Separate raw motion from presentation

Record synchronized samples at:

```text
pointer release
raw physics positions, iteration counts, lifecycle, and message arrival
presented positions and timestamps
Sigma adoption/render, camera state
```

Use representative connected and isolate cases, with and without Pull. Establish whether the visible rush is present in raw output, introduced by presentation, or both. No private identifiers in committed traces.

### Reproduce the current retargeting defect

Add deterministic presentation tests that feed the actual client/follower:

- targets moving in one direction with decreasing increments, then a fixed final target;
- frequent, sparse, irregular, and coalesced worker arrivals;
- nonzero displayed velocity when the target changes;
- 30/60/120 Hz and dropped-frame schedules.

Show the existing restarted-smoothstep behavior before replacing it. Do not assume “ease-out” fixes it: restarting another easing curve can also break velocity continuity.

### Required presentation contract

```text
new target → retain displayed position and velocity
new drag → held File becomes exact immediately
raw sleep → finish approaching the final raw target smoothly
visually negligible error and velocity → exact final adoption, then stop scheduling
```

A time-based critically damped follower or a velocity-preserving retargetable interpolation is acceptable. Choose one simple, tested implementation. A spring is not automatically overshoot-free with arbitrary inherited velocity; test target reversals and re-grabs.

Requirements:

- Retargeting must not reset displayed velocity to zero. Maintain node-keyed state through valid same-generation targets.
- Use elapsed time with stable integration. Variable frame rate must not change the intended response. Handle a long suspended frame without instability or replaying a backlog; preserve existing blur/invalidation semantics.
- Retain only current presentation state and the newest accepted target, not an unbounded queue of old frames.
- Do not compress a large remaining displacement into an arbitrary final 120-ms deadline. A new boundedness safeguard must not force a visible final rush or snap.
- Snap to exact raw coordinates only below documented visually negligible position **and** velocity thresholds. Relate these to the display scale or a justified equivalent; do not change the camera to satisfy them.
- Do not impose monotonic deceleration on every changing-target scenario: raw physics may legitimately accelerate. The test is absence of a speed discontinuity or artificial terminal burst caused solely by retargeting/finishing policy.
- Keep the held File exact during dragging and preserve responsive neighbor updates. Re-grabbing during catch-up must reject old gesture frames and remain immediate.
- Raw coordinates alone remain authoritative for solver state, future physics seeds, and convergence. Presentation must never falsify raw sleeping/failure evidence.
- Preserve reduced-motion behavior. Report raw sleeping separately from presentation settling; stop all scheduled presentation work when caught up.

Compare original and corrected velocity traces on the same raw recording before evaluating the combined physics change. Use the actual Worker → client → Sigma path for final evidence, not a `Map` construction labeled as adoption.

## 9. Scope control and validation

No new user-facing physics knobs, Pin feature, renderer switch, dependency upgrade, ForceAtlas2 fork, shared-memory redesign, or larger node limit. No density retuning. No unrelated Hierarchy/Saved UX edits.

New live-physics or presentation constants require rationale and focused tests. If serialized fields/states change, version and validate the protocol; do not casually reinterpret an old field. Preserve existing gesture epochs, monotonic sequences, one-in-flight/newest-pending transport, and stale-frame rejection.

Run current equivalents of:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web
pnpm analyze:network-physics-drift
pnpm analyze:physics1
pnpm benchmark:file-move
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:local-renderer -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Do not run unrelated paid/API tests. Keep generated private-safe analysis artifacts ignored. No timing-based CI gates.

At the supported sizes, report hot-step p50/p95, neighbor-frame age, actual presentation/adoption work, release-to-raw-sleep, and release-to-presented-rest. Distinguish Node, browser, and native measurements. Preserve All 300/301 and Focus 100/101 capability tests and worker laziness.

## 10. Native acceptance and merge gate

Build a new optimized executable, report the exact path and SHA-256, and leave #103 draft. Earlier approval of responsiveness is not approval of these corrections.

Supply this native checklist:

1. All Network on the real vault: drag near an isolated File. It can yield; it is not hard-frozen. Connected neighbors still react.
2. Move continuously for 10–20 seconds, then hold still for about 10 seconds. The outer ring does not keep inflating. Repeat several gestures without a cumulative outward ratchet.
3. Drag an isolated File itself and release. It rejoins bounded physical settling without a forced teleport or an unconditional no-physics shortcut.
4. Drag across Filters, Inspector, sidebar, and toolbar; return to the graph; release over a control. The drag stays attached, releases once, and does not activate the control. The next normal click works.
5. Release a connected File and observe the final movement. No smooth phase followed by an artificial final rush. Repeat a re-grab while it is settling.
6. Repeat relevant tests in Focus, with authored Pull/Place, and with reduced motion. Camera and Density stay unchanged unless explicitly operated. Escape and window blur clean up.

Document what was actually tested. If native automation is unavailable, hand off to the user rather than claiming a native pass from a browser/build result. Wait for explicit acceptance before merge, post-merge verification, and cleanup of only this task's worktree.

## 11. Documentation and final handoff

Archive this prompt under `history-implementations/`. Add a concise MOVE300C implementation report and update the nearest current physics/interaction docs. Preserve historical prompts; mark MOVE300B's hard-freeze and isolate-sleep choices as superseded rather than rewriting history.

The report must separate:

- confirmed root causes from inferred contributors;
- the chosen bounded-motion policy, its reference lifetime, and Pull/isolated-release semantics;
- the pointer owner and exact overlay-release safeguards;
- physical integration changes from presentation changes;
- before/after response, radial growth, and velocity evidence, plus runtime limits;
- automated/browser/native checks, unperformed checks, executable identity, and pending merge gate.

If a narrowly tested policy cannot satisfy responsive motion and boundedness without materially changing product semantics, keep the draft and present the concrete unresolved choice. Do not hide it behind more tests, lower limits, a nearly rigid tether, or a prettier animation.

## Source anchors for this task

Repository findings refer to the reviewed head, not a promise that main is unchanged:

- PR: https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/103
- Simulation: https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/9c44060ad9df2cdf031c57141d049ef171d94ed2/packages/renderer-sigma/src/physics/simulation.ts
- Current presentation: https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/9c44060ad9df2cdf031c57141d049ef171d94ed2/apps/web/src/workers/network-physics-worker-client.ts
- Global event handling: https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/9c44060ad9df2cdf031c57141d049ef171d94ed2/packages/renderer-sigma/src/session.ts
- Candidate B experiment: https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/9c44060ad9df2cdf031c57141d049ef171d94ed2/tools/vault-diagnostics/src/network-physics-component-drift-analysis.ts
- Sigma 3.0.3 mouse captor: https://raw.githubusercontent.com/jacomyal/sigma.js/sigma%403.0.3/packages/sigma/src/core/captors/mouse.ts
- Pointer capture/event semantics: https://www.w3.org/TR/pointerevents3/#pointer-capture

The proposed soft stabilization and velocity-preserving follower are implementation candidates derived from the review, not behaviors already supplied or guaranteed by these sources.
