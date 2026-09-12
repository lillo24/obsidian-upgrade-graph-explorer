# MOVE1B QA correction — Direct Network Dragging + Smooth Release

**Task type:** native-QA correction / product interaction simplification / release continuity / worker-to-render scheduling.

**Repository:** `lillo24/obsidian-upgrade-graph-explorer`  
**Target:** existing draft PR #80, `codex/move1b-production-network-move`.  
**Verified planning baseline:** `742acf56b37f29cf43b07ab2d3771cce21a4e572`.

Continue the existing task branch/worktree. Keep PR #80 draft and unmerged until the user accepts a freshly built Windows executable. Do not start PIN1.

## 1. Requested outcome

Native QA approves the behavior **while the File is being dragged**. Preserve that behavior. Correct these two problems:

1. File movement should be an ordinary Network interaction, without an Edit Network / Move Files prerequisite.
2. Releasing a dragged File should show continuous settling, not an abrupt jump to a substantially different layout.

Desired interaction:

```text
click a File                  → select / ordinary confirmed-click behavior
double-click a File           → Focus
press and drag past threshold → temporary physical movement
release                      → remove constraint → visibly settle → sleep
```

The change is not persistent positioning. No coordinates, pins, spatial rules, history checkpoints, or source edits are saved by File movement.

**Arrange Folders remains an explicit tool**, because it edits saved Pull/Place rules. Its existing editor and safeguards must remain available.

## 2. Current evidence and baseline safety

The user originally tested `22884c4`. PR #80 has since advanced to `742acf5`. Work from the latest actual PR head, not the older executable or old prompt. Reproduce the release issue on that head before claiming a complete root cause.

The latest branch contains important follow-up fixes that must not be reverted:

- Network physics protocol schema 2, with interaction revision, gesture/File identity, command sequence, and frame sequence.
- Validation both when a frame arrives and when its animation-frame callback adopts it.
- Adoption of lagging **same-gesture neighbor progress**, with the dragged File overlaid at the newest target. This avoids starving visible neighbor updates during rapid pointer motion.
- Bounded pointer-update transport: one update in flight plus one newest pending update; final pending target is flushed before `end`.
- Focus raw-root-drift protection and full-batch-only convergence streak accounting.
- Explicit automatic-M2 output-shaping handoff: activation is jump-free, but the automatic field may relax during temporary physics. No per-tick feedback of shaped output.
- A current product boundary of **100 visible simulation nodes**; larger graphs fail closed before continuous Worker construction.

These are existing branch decisions, not new requirements invented by this correction. Preserve the current support limit and make its unavailability explanation reachable after removing the Edit toolbar. Do not expand or further reduce the limit in this task. Report it in the handoff; do not imply direct dragging works at every scale. [E1, E5]

### Confirmed release-path facts

At the verified baseline:

| Layer | Observed behavior |
|---|---|
| `ContinuousNetworkSimulation.advance()` while hot | Four public one-iteration assignments, with target reassertion, followed by a published frame. |
| `advanceCooling()` | Advances to a convergence batch endpoint, ordinarily 32 iterations, before publishing. |
| `handle(end)` | Clears the temporary constraint and enters cooling; it does not restore cached positions or reset coordinates. |
| Worker scheduling | Hot turns wait 16 ms; cooling turns are scheduled with a zero-delay timer. |
| Browser client | Keeps the newest valid received frame for its next `requestAnimationFrame` adoption. |

Sources: [E2–E4].

**Inference to test:** release can increase both work per visible update and computation speed relative to display. Intermediate states can be superseded before paint, making an otherwise valid solve look like a jump. A large first physical step, pending-target handoff, or presentation reapplication could also contribute. Do not treat the scheduling explanation as an already reproduced diagnosis of the user's exact case.

## 3. Read before editing

Inspect `AGENTS.md`, current open work, and these source areas:

```text
apps/web/src/network-editing.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/NetworkEditingControls.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/network-explorer-context.ts
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/LocalGraphView.tsx
apps/web/src/workers/network-physics-worker-client.ts
apps/web/src/workers/network-physics.worker.ts

packages/renderer-sigma/src/file-move.ts
packages/renderer-sigma/src/temporary-node-constraint.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/physics/protocol.ts
packages/renderer-sigma/src/physics/simulation.ts
packages/renderer-sigma/src/physics/pull.ts
packages/renderer-sigma/src/network-camera-intent.ts
packages/renderer-sigma/src/network-position-frame.ts

apps/web/src/spatial-overrides/arrangement.ts
packages/spatial-overrides/src/geometry.ts
packages/spatial-overrides/src/resolution.ts

docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/decisions/0019-temporary-file-movement-contract.md
docs/decisions/0023-continuous-network-public-forceatlas2-lifecycle.md
docs/decisions/0024-production-network-editing-and-temporary-file-move.md
```

Use current equivalents if paths have moved. Inspect the installed ForceAtlas2 public assignment implementation/documentation only as needed to evaluate call-boundary changes. No proprietary Obsidian code is needed for this correction.

## 4. Correction A — Make File dragging available directly

### Remove the prerequisite, not the working gesture machinery

Remove the visible pencil/Edit Network entry and the Move Files / Done shell **for temporary File movement**. Do not replace it with another always-visible mode selector or an Advanced setting that users must enable first.

In a supported, ready All or Focus Network view, the existing MOVE1A gesture should be armed by default. Continue using its:

- 3 px viewport threshold and pointer grab offset;
- imperative coordinator and animation-frame coalescing;
- same begin/update/end command port;
- click/double-click arbitration and lifecycle cancellation;
- real PHYSICS1 adapter.

Do not duplicate the coordinator or implement ordinary dragging as a second simulation path.

Conceptually:

```text
Network ready + supported + no competing input owner
→ temporary dragging is available

threshold-crossing drag
→ begin temporary constraint

pointer release
→ end constraint only
→ retained simulation continues cooling
```

### Separate availability from activity

Do **not** secretly enter the old Edit state on pointerdown and exit it on pointerup. In existing canvas wiring, deactivating the capability can invalidate the physics service. That would cancel cooling rather than allow it to continue.

Keep distinct:

```text
capability availability   — whether a new drag may start
gesture state            — idle / primed / dragging / keyboard movement
simulation lifecycle     — sleeping / hot-constrained / cooling / failed
folder editing ownership — explicit competing tool
```

`temporaryConstraintActive` may remain as an internal compatibility prop or receive a clearer name. Its production meaning must no longer be “the user selected Move Files.” Do not change its value in response to every hot/cooling/sleeping notification.

Arming the capability may prepare a seed, but must create **no continuous Worker and no continuous simulation work**. Mere hover, selection, double-click, or below-threshold motion must also create no Worker. Ordinary initial finite-layout work remains legitimate and separate.

The first real pointer drag or keyboard movement starts the lazy Worker. Subsequent drags, including during cooling, reuse valid retained state.

### UI cleanup and recovery

Remove dead Edit/Move mode state and callbacks only where no longer needed. The current folder editor can retain its own state machine; do not rebuild it for architectural tidiness.

Keep these functions reachable outside the removed toolbar:

- explicit Arrange Folders entry in All Network;
- keyboard Move File action/controller in Network Explorer;
- failure message and Retry Move recovery;
- concise availability explanations, including layout preparation and the current node-count limit;
- a quiet Settling indicator or live-region announcement, without a permanent “editing active” banner.

No idle “Settled — ready to move” panel needs to occupy canvas space. A suitable File tooltip may say “Drag to move.” Do not label moved Files as pinned, customized, or saved.

### Preserve ordinary interaction

Below threshold, retain selection, confirmed single-click sidebar reveal, and double-click Focus. A completed real drag must suppress only its trailing click/Focus activation, not swallow the next unrelated click indefinitely.

Keep stage pan and wheel/pinch working outside an owned File gesture. While a File owns the pointer, preserve the established camera-input suppression policy. An invalid or unsupported File drag must not leave the camera or pointer stuck.

Only canonical Files are draggable. Focus Headings, Blocks, diagnostics, edges, and Hierarchy nodes retain their existing behavior. Their participation in Focus physics does not make them draggable.

## 5. Folder editing, keyboard movement, and lifecycle

### Arrange Folders remains explicit

Retain its current entry points and Pull/Place/custom-scope editor. When it takes ownership:

```text
end any active File gesture
→ stop/invalidate temporary File simulation ownership safely
→ suspend default File dragging
→ run existing folder editing behavior
```

Do not let cooling frames overwrite a rigid folder preview or a target-marker interaction. Apply/Cancel/Done returns to ordinary Network dragging after the authoritative spatial frame is ready.

Preserve dirty-draft safeguards, write-before-adopt, exclusions, deepest-rule precedence, keyboard folder controls, and recovery. File dragging must never create or edit a folder rule.

### Keyboard movement remains first-class

The existing Network Explorer Move File action should start its current keyboard controller directly, not turn an invisible global Edit mode on. Keep viewport-relative nudges, release-and-settle, Escape, focus restoration, and virtualization safety.

Pointer and keyboard movement must use the same physics and release-continuity path. Do not put arrow-key handlers on the whole application or hijack ordinary tree navigation.

### Cancellation and rearming

On source/scope/topology/layout/spatial-rule invalidation, end the active gesture before adopting the new semantic generation. Hierarchy and unmounted views must accept no late Network frames. Once a new supported Network view is ready, ordinary dragging is available again without another user activation.

Escape during an active movement ends its constraint; Escape when idle must not consume normal menu/sidebar behavior. There is no global File-editing mode to exit. Cancellation is not a promise to restore the graph's earlier physical state.

Blur, visibility loss, pointer cancellation/loss, or disposal must release pointer ownership and prevent a hot simulation from running indefinitely in the background. Preserve explicit failure/retry rather than repeatedly auto-restarting a failing simulation.

## 6. Correction B — Diagnose the release handoff

Use deterministic synthetic fixtures and the **real browser Worker/client/canvas path**. A direct Node solver test alone cannot prove visible continuity.

At minimum reproduce in All and Focus with a short chain, a hub, and an isolated File; also include All with Pull and Place. Start with a graph below the existing support limit.

For one scripted drag and release, capture an ignored diagnostic timeline:

```text
last desired pointer target, including grab offset
last immediate displayed target
last raw worker frame before release
final pending target sent to the worker
worker receipt/acknowledgment of final target and end
worker positions immediately after handle(end), before advance
first and subsequent cooling computation endpoints
frames published / received / superseded / adopted
positions actually presented after Sigma processing
camera transform and presentation extent
```

Record relative monotonic timestamps, interaction revision, gesture identity, sequence, iteration count, and aggregate displacement. If comparing timestamps across threads, explicitly align clocks or measure same-thread intervals; do not subtract unrelated clock origins.

Distinguish three possible jumps:

1. **State handoff:** the released File starts from a stale target or an older layout is adopted.
2. **Physical advancement:** one integration call causes a large displacement.
3. **Presentation sampling:** many valid intermediate updates finish before any are shown.

Also verify release does not cause a canvas remount, seed reinitialization, finite-layout/cache restoration, automatic-M2 reapplication, Place recomposition with a different translation, or camera/density reframe.

The immediate physical `end` transition should preserve the current worker positions. That does not imply the worker's last raw frame and the browser's newest displayed target are identical when transport is lagging. Test that lag explicitly instead of asserting a misleading equality.

Keep an initial regression that fails on the current branch. State the confirmed contributor(s), and leave unsupported explanations labeled as hypotheses.

## 7. Smooth-settling implementation requirements

Treat these as separate concerns:

```text
physical integration sequence
worker scheduling / publication
renderer presentation timing
convergence checkpoint evaluation
```

The 32-iteration **measurement interval** is not a requirement to show only 32-iteration endpoints. Conversely, publishing more messages does not guarantee that more frames are painted.

### Preserve a correct physical release

Flush the latest pending target before `end`, respecting current bounded transport and ordering. Release the constraint promptly and only once. Do not hold the File fixed for a decorative grace period, restore its start position, or run a fresh layout job.

Retain all schema-2 validation and same-gesture neighbor-progress behavior. Never restore the older equality-only filter that starved neighbor frames during fast dragging.

### Choose the smallest evidence-backed continuity correction

First repair an actual state/camera/sequence reset if one is found. Then evaluate worker pacing and visible-frame scheduling. Do not assume “set every loop to 16 ms” or “replace 32 with 4” is sufficient.

A bounded, time-based **presentation interpolator** may be appropriate if correct raw physics advances faster than it can be displayed. It is permitted, but must not disguise invalid geometry, replay an obsolete final layout, or change the physics result.

A valid presentation layer must:

- start from the last actually displayed frame, including the exact dragged-File preview;
- target only valid frames from the current semantic generation and interaction;
- carry continuous displayed positions forward when a newer target arrives;
- keep at most bounded current/target state, not an accumulating animation queue;
- use elapsed time rather than a fixed fraction per display frame;
- remain interruptible immediately by a new drag, cancellation, failure, or semantic change;
- bring the display to the exact final accepted coordinates without a large terminal snap;
- stop its animation frames once caught up; remain idle while physics and presentation are sleeping;
- avoid prolonging every release by an arbitrary minimum animation duration.

Do not add a general animation library. Preserve the exact, responsive hot-drag path the user approved. Never interpolate the actively held File away from its newest pointer target.

If controlled compute/publication pacing alone gives the required result, prefer that over unnecessary presentation machinery. Either solution needs real paint evidence.

### Do not equate different ForceAtlas2 call boundaries

The current no-Pull cooling path calls public `assign(iterations)` for a batch. The Pull path uses repeated single-iteration assignments with a Pull correction after each iteration. The installed public API can rebuild internal adaptive state between calls. Therefore replacing one `assign(32)` with repeated `assign(1)` is not automatically a presentation-only change. [E2, E5]

If physical subdivision is needed, compare its trajectories, convergence outcomes, release duration, and failure behavior with the existing implementation. Do not silently retune the physics or substitute a custom solver. A proven small integration correction is allowed; a broader engine redesign is not this task.

### Convergence and safety remain authoritative

Evaluate stability from **raw physical positions**, never eased/displayed motion. Retain complete canonical 32-iteration checkpoints, consecutive-stable-check semantics, Focus root-drift/low-degree guards, and explicit iteration/wall failures unless a narrowly justified change is separately documented.

If stepping is subdivided, accumulate physical work across publications to the full checkpoint. Four displayed frames are not four stable convergence batches. Partial cap tails cannot count as a full stable checkpoint.

Pacing consumes elapsed time. Measure it against the current two-/five-second boundaries; do not subtract pacing time, weaken thresholds, raise caps, or relabel failures as sleeping simply to make tests pass. Preserve successful supported-scale settling where practical; report a genuine budget conflict explicitly.

If physics sleeps before a short presentation catch-up completes, keep raw lifecycle and presentation status distinct. Do not keep the physics Worker hot just to animate; do not announce visual settlement while the graph is still visibly traveling.

### Re-grabbing during settlement

A new drag must immediately take authority at the File's current visible location. Invalidate the old interaction's queued presentation/frame adoption and retain schema-2 identity checks.

Test that re-grabbing while display trails raw physics does not snap the File or teleport the other visible nodes to an ahead-of-display snapshot. Do not feed interpolated whole-graph coordinates into the solver or caches to conceal this mismatch. Use a deliberate interaction/presentation handoff around the new hard target.

## 8. Boundaries that must remain intact

| Area | Required behavior |
|---|---|
| Hot dragging | Same hard pointer target, responsive local preview, whole current graph reaction. |
| Pull | Existing production algorithm, memberships and strength semantics; no standalone convergence redesign. |
| Place | Captured display-only translation is subtracted/applied once; no per-frame centroid inverse redesign. |
| Automatic M2 field | Preserve current seeded-output-relaxation handoff; do not reapply shaping on release to “fix” appearance. |
| Camera | No automatic Fit, recenter, density framing, or extent renormalization during movement/settling. |
| Visibility | QUERY1 remains the owner; hiding/removing an active File cancels safely. |
| Styling | File size and Visual Groups remain display-only and cause no physics restart. |
| Storage | No File-coordinate/pin/spatial/view/history/source persistence; folder editor still persists its own explicit changes. |
| Caches | No raw or interpolated Move frames written into finite-layout or dynamic-Pull caches. |
| Scope | All and Focus Network only; Classic/Modular Hierarchy unchanged. |
| Scale | Retain existing 100-visible-simulation-node gate with a reachable reason and no silent local-neighborhood fallback. |

A supported whole-graph simulation may move distant nodes after release; the goal is continuity, not zero displacement or monotonically decreasing movement of every individual node.

## 9. Regression tests

Add focused tests through the actual product/canvas/client paths, reusing current fakes and fake clocks where appropriate.

### Direct interaction and ownership

- No Edit activation is required in supported All/Focus Network.
- Mount, arming, hover, click, double-click, and sub-threshold movement construct zero continuous Workers.
- Threshold crossing creates one lazy Worker and one begin; multiple gestures reuse valid state.
- Real drag suppresses its trailing click without swallowing a later deliberate click.
- Stage pan, context actions and pinch/wheel recover after release/cancellation.
- Arrange Folders suspends File dragging, preserves dirty drafts, and restores default availability on exit.
- Keyboard Move File needs no hidden mode toggle; nudges and release use the shared pipeline.
- Layout preparation, worker failure and graph-too-large have reachable explanations/recovery after toolbar removal.
- Size/group/UI changes do not reinitialize a running service or terminate cooling.
- Network→Hierarchy, source replacement, semantic changes and disposal reject stale work.

### Release handoff and presentation

- The final pending pointer target reaches physics before end, including a pointer faster than the worker.
- `handle(end)` does not reset physical positions.
- No finite layout, cache lookup/reapplication, remount, M2 restoration, Place translation change or camera write is triggered solely by release.
- Instrumented first release frame, first physical cooling step, first adopted frame and first displayed frame expose where displacement occurs.
- A fast worker producing several cooling results before a display callback does not recreate a large visible snap on the test fixture.
- The first visible post-release position continues from the last displayed drag target.
- Settling reaches the exact accepted final coordinates; no terminal snap or permanent presentation offset.
- New drag during cooling/catch-up cannot adopt the previous gesture's pending frames.
- Simulated 60 Hz and 120 Hz presentation schedules give comparable time-based behavior, not a doubled animation speed.
- Sleep and completed catch-up leave no scheduled work; blur/disposal clears all pending presentation callbacks.
- Reduced-motion behavior is deliberate and tested; decorative easing is reduced without compromising physical correctness or stale-frame handling.

### Existing hardening

Keep tests for schema-2 identities, sequence validation at receipt/adoption, lagging-neighbor frames, latest pointer overlay, bounded update queue, full-batch convergence, raw-root drift and explicit time/cap failure.

Use strict equality/tolerances for hard coordinate and ordering invariants. Measure visible continuity on deterministic fixtures in screen pixels at a fixed camera, and document a justified diagnostic target rather than inventing a universal “maximum movement per frame” guarantee. Do not make hardware timing a flaky CI gate.

## 10. Browser and native acceptance

### Browser evidence

Compare the latest pre-correction baseline with the corrected branch using a production build and real Worker/Sigma path. Test small fixtures and the supported 100-node boundary in both All and Focus, including Pull and Place.

Report separately:

```text
last-drag → immediate-release coordinate difference
first raw cooling-step displacement
first visible cooling-frame displacement
raw frame publication count vs adopted/displayed count
worker compute time vs release wall time
maximum/percentile visible frame gap and displacement
release → raw sleeping time
release → visually settled time, if different
```

Use a consistent browser/viewport/camera. Frame adoption is not automatically a browser paint; describe how after-render/screen evidence was obtained. Do not call a Node microbenchmark displayed-frame or native interaction evidence.

### Fresh Windows executable

Build the optimized executable and provide its exact path, commit, SHA-256 and checklist. Do not reuse the older binary hash.

Required user checks:

1. Open All Network and drag a File directly, without enabling Edit.
2. Confirm the excellent held-drag behavior remains unchanged: exact pointer following and reacting neighbors.
3. Release after slow and rapid movement; watch the last pointer location transition into visible settling without a jump.
4. Repeat in Focus, including root and neighbor Files; click/double-click still behave normally.
5. Re-grab while settling; release again; verify no stale snap.
6. Test stage pan, mouse wheel, physical touchpad/pinch, right-click Size/Hide, and keyboard Move File.
7. Test Pull and Place plus entry/exit of Arrange Folders; no competing gesture owner or rule mutation from File dragging.
8. Try Escape, blur, source/scope/layout changes and a live hide/delete; no stuck pointer, hot worker, or blank graph.
9. Confirm idle/sleeping stops work and movement is not persisted across reload.
10. Confirm the existing unsupported-size case explains why movement is unavailable rather than appearing broken.

Keep native acceptance pending until the user explicitly approves these corrections. Their approval of the held-drag behavior is not approval to merge the entire PR.

## 11. Work sequence and validation

Keep two focused commits in the same draft PR where practical:

```text
A — default direct File dragging; keep explicit folder editing/recovery
B — evidenced release continuity correction and regressions
```

Reproduce and collect the release trace before changing its numerical/presentation path. Preserve the working hot-drag behavior throughout. No additional prerequisite milestone is needed.

Run current `AGENTS.md` requirements, focused suites, and the existing commands:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web
pnpm analyze:physics1
pnpm benchmark:file-move
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Renderer benchmarks may legitimately exercise larger noninteractive graphs; do not misreport that as approval to remove the current Move support gate.

Update relevant application/renderer READMEs, PHYSICS1 documentation, performance evidence, and the draft PR's editing ADR to describe direct dragging, explicit folder editing, the actual settling correction, and current limitations. Archive this exact prompt under `history-implementations/` and record the correction outcome in a concise implementation/QA report. Preserve historical prompt archives rather than editing them to hide prior decisions.

No new dependency is expected. No new persistence schema. If a worker protocol change is necessary, explicitly version and validate it; do not break schema-2 identity guarantees.

## 12. Final handoff

Report:

- current branch/commit and that PR #80 is still draft;
- direct-drag UI change and where Arrange Folders / keyboard movement / Retry remain available;
- confirmed release root cause, distinguishing measured findings from inference;
- selected scheduling/presentation correction and whether solver call boundaries changed;
- before/after physical and displayed continuity evidence;
- preservation of newest-pointer/lagging-neighbor behavior and sequence guards;
- settling duration, cap outcomes and the current 100-node product limitation;
- tests, browser evidence, new executable path/hash and native checklist;
- any unperformed checks or remaining issue.

Do not mark native QA passed, merge, delete the worktree, or start PIN1 automatically.

## Evidence index

The references below anchor planning claims to the inspected PR head. Re-check the latest branch before implementation.

- **E1 — PR metadata and hardening summary:** [PR #80](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/80), inspected at head `742acf56b37f29cf43b07ab2d3771cce21a4e572`.
- **E2 — Physical release and computation:** [`physics/simulation.ts`](https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/742acf56b37f29cf43b07ab2d3771cce21a4e572/packages/renderer-sigma/src/physics/simulation.ts): `handle`, `advance`, `advanceCooling`, `nextNetworkPhysicsStableBatchCount`, support-limit constant.
- **E3 — Scheduling discontinuity:** [`network-physics.worker.ts`](https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/742acf56b37f29cf43b07ab2d3771cce21a4e572/apps/web/src/workers/network-physics.worker.ts): `HOT_TURN_INTERVAL_MS`, `schedule`, `step`.
- **E4 — Transport and presentation boundary:** [`network-physics-worker-client.ts`](https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/742acf56b37f29cf43b07ab2d3771cce21a4e572/apps/web/src/workers/network-physics-worker-client.ts): `frameMatchesCurrentInteraction`, `frameWithLatestConstraintTarget`, `adoptLatestFrame`, `acknowledgeAndFlush`, `send`.
- **E5 — Accepted lifecycle, composition, evidence limits:** [`PHYSICS1_CONTINUOUS_SIMULATION.md`](https://github.com/lillo24/obsidian-upgrade-graph-explorer/blob/742acf56b37f29cf43b07ab2d3771cce21a4e572/docs/PHYSICS1_CONTINUOUS_SIMULATION.md).

These references support the starting architecture, not a claim that this prompt's corrections have already been implemented or tested.
