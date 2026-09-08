# PHYSICS1 — Continuous Network Simulation Lifecycle + Real Temporary Constraint Adapter

**Task type:** simulation architecture / worker lifecycle / real physics adapter / production foundation with an evidence gate

## Goal

Implement the missing physical-simulation layer required by MOVE1B.

The intended eventual interaction is:

```text
pointer down on File
→ MOVE1A primes gesture

pointer crosses 3 px threshold
→ begin temporary simulation-space constraint
→ continuous simulation wakes
→ constrained File follows pointer
→ all other simulated nodes keep reacting

pointer moves
→ latest target updates constraint
→ simulation stays hot

pointer release
→ clear temporary constraint
→ File returns to automatic physics
→ whole graph continues settling
→ simulation reaches practical stability and sleeps
→ nothing is persisted
```

PHYSICS1 owns:

```text
simulation lifetime
worker/state ownership
wake / reheat semantics
physical stepping
active temporary constraint execution
other-node reaction
cooling / convergence
sleep / settled semantics
frame publication
simulation generations
```

MOVE1A already owns:

```text
pointer gesture
3 px threshold
rAF-coalesced target commands
File eligibility
interaction arbitration
Place-coordinate inversion
generation/gesture/sequence command contract
cancellation reasons
```

MOVE1B remains the later product task that adds the visible Edit/Move control and binds the completed PHYSICS1 capability into the normal app interaction surface.

Do **not** implement PIN1 or persistent positions.

---

# Success outcome

PHYSICS1 is successful when a real, non-fake implementation of `TemporaryNodeConstraintPort` can be driven in both Network simulations and demonstrates:

```text
begin
→ target node is physically constrained
→ neighbors react through the same graph physics

update
→ target follows latest simulation-space point
→ stale updates cannot win

end(released)
→ constraint disappears
→ graph keeps physically settling
→ practical convergence is detected
→ worker sleeps

no semantic change while asleep
→ zero simulation work
```

The adapter must remain dormant when Move is not active. Normal All/Focus layout, cache, camera, density, Pull/Place authoring and persistence must retain their current behavior.

---

# Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` at plan-writing time:

```text
70eb9f0c7cbc5cee483c90b0108e3ba9f040b404
```

This includes, among other work:

```text
MOVE1A               complete
SPATIAL2B             merged
CONVERGENCE1A/B/C     complete
FLICKER1/camera-neutral adoption merged
NETWORKSETTINGS1      merged
HIER4A                merged
```

At plan-writing time there are no open PRs in this repository. Re-check before branching and before merge because HIER work may continue in parallel.

Use an isolated branch/worktree per `AGENTS.md`. Preserve unrelated worktrees, `.pnpm-store/`, user files, and any concurrent task.

---

# Current evidence and accepted contracts

## MOVE1A contract

The accepted ADR defines Move as one **temporary physical constraint**. Release or cancellation clears it; no spatial registry, layout cache, source, view state or history entry is written.

Current command seam:

```ts
TemporaryNodeConstraintPort {
  begin(command)
  update(command)
  end(command)
}
```

Commands are plain/serializable and include:

```text
schema version
sessionGeneration
simulationGeneration
gestureId
monotonic sequence
nodeKey
simulation-space target for begin/update
explicit end reason
```

MOVE1A already validates/coalesces pointer input and exposes the same optional fake-backed seam in All and Focus Sigma sessions.

The real PHYSICS1 implementation must satisfy this existing contract rather than redesigning pointer interaction.

## Coordinate composition

All Network currently composes:

```text
B = settled base automatic position
D = dynamic position, including SPATIAL2 Pull
T = winning fixed Place translation
P = displayed position

P = D + T
```

MOVE1A already converts pointer targets correctly:

```text
constraint target C = displayed pointer target - T
```

Therefore PHYSICS1 receives **dynamic/simulation-space coordinates**. It must not know about or invert Place itself.

Pull remains part of the dynamic physics stage and must remain active during All simulation.

Focus has no SPATIAL2 Pull/Place layer; its Network positions are directly the simulation layer.

## Existing bounded convergence

Focus base layout:

```text
local-fa2-convergence-v1
32-iteration FA2 batches
p90 <= 0.00512
low-degree max <= 0.01024
3 stable full batches
```

Global base layout:

```text
global-fa2-folder-convergence-v1
32-iteration FA2 batches
p90 <= 0.00512
low-degree max <= 0.01024
centroid drift <= 0.00512
3 stable full macro-steps
M2 output-only folder field
```

These are **finite replacement-worker layout policies**. PHYSICS1 is a different continuous interactive lifecycle. Reuse their tested movement metrics and thresholds where appropriate, but do not silently reinterpret fixed 32-iteration thresholds for a different micro-step size.

## Global M2 folder field

CONVERGENCE1C selected M2:

```text
working Graphology graph = pure FA2 state
completed output snapshot = one fixed output-only folder transform
output does not feed back into the working FA2 graph
```

PHYSICS1 must not accidentally turn M2 back into a duration-accumulating prior.

The continuous Move simulation begins from the **current dynamic layer** already produced by:

```text
settled base M2 output
→ optional SPATIAL2 dynamic Pull
```

and remains transient. It must not rewrite the settled base cache.

## SPATIAL2 Pull

Current dynamic Pull is a separate ForceAtlas2-based stage with soft folder attractors. It intentionally allows connected nonmembers to react.

During an All Move:

```text
Pull influence stays active
```

Do not remove the Pull rule, subtract its anchor, rigidly freeze the pulled group, or convert Pull into Place.

How the existing discrete Pull step maps into the continuous PHYSICS1 simulation is an explicit design question in this task and must be tested rather than guessed.

## Obsidian reference behavior

The clean-room behavioral reference from Obsidian 1.11.5 is:

```text
live simulation state stays in worker while view is open
node drag sets temporary fixed coordinates
whole graph keeps simulating
movement reheats simulation
drag release removes fixed coordinates
simulation cools until a practical stop
sleeping graph does no work until a semantic/interaction wake event
```

Do not copy Obsidian source, WASM, alpha constants or message protocol. Reproduce the product behavior with Icarus's architecture.

---

# Architecture sanity-check

Before editing, inspect current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/decisions/0019-temporary-file-movement-contract.md
docs/CONVERGENCE1B_FOCUS_BOUNDED_CONVERGENCE.md
docs/CONVERGENCE1C_GLOBAL_FOLDER_MACRO_CONVERGENCE.md

packages/renderer-sigma/src/temporary-node-constraint.ts
packages/renderer-sigma/src/file-move.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/local-convergence.ts
packages/renderer-sigma/src/global-convergence.ts
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/local-layout.ts
packages/renderer-sigma/src/spatial-influence.ts
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/local-types.ts

apps/web/src/workers/*layout*
apps/web/src/workers/*spatial*
```

Also inspect the **actually installed** `graphology-layout-forceatlas2@0.10.1` package source/exports in the resolved pnpm dependency tree. Do not rely on memory about its public APIs.

---

# Mandatory architecture gate — before production integration

There are two unresolved implementation questions that materially affect correctness:

1. How can the installed ForceAtlas2 implementation execute a temporary hard node constraint while letting all other nodes react?
2. How should current SPATIAL2 Pull participate in an indefinitely wakeable simulation without making its effective strength depend accidentally on render/tick frequency?

Resolve these with a bounded development bake-off before installing the production adapter.

If no supported approach passes cleanly, **stop and report** rather than using package-private internals, forking ForceAtlas2, adding another force engine, or shipping a fake physical interaction.

---

# Candidate A — supported incremental/public ForceAtlas2 API

First inspect whether `graphology-layout-forceatlas2@0.10.1` exposes a supported worker/supervisor/incremental interface usable for this lifecycle.

Evaluate it only if it is actually public in the installed version.

Required capabilities:

```text
retain graph state while session is alive
step/restart without rebuilding application topology
apply/update one temporary fixed target
remove it on release
allow all other nodes to react
sleep without CPU work
```

If the API cannot model a fixed node without private hooks or synthetic graph artifacts, record that and reject it.

Do not use undocumented package-private matrix/iterate imports merely because they exist in `node_modules`.

---

# Candidate B — public `assign` micro-steps on one persistent Graphology graph

Evaluate a clean wrapper using only supported public `forceAtlas2.assign(...)` calls while retaining one Graphology graph in a PHYSICS1 worker.

Candidate micro-step sizes:

```text
1 iteration
2 iterations
4 iterations
8 iterations
```

For an active constraint:

```text
set constrained node to current target
→ run micro-step
→ reassert constrained node target
→ publish snapshot
```

If necessary, reassert before every single public iteration rather than every multi-iteration call.

The public call resets ForceAtlas2's private adaptive matrix each call; this is known. Measure the consequence rather than pretending it retains hidden solver velocity.

The constrained node must be physically present at the target seen by the force computation often enough for neighbors to react meaningfully.

---

# Candidate C — alternate/private implementation

A ForceAtlas2 fork, package-private matrix API, custom force solver, or second engine is **not** an ordinary candidate.

Consider it only if A and B fail a hard product requirement.

If that happens, stop and report:

```text
what public approaches failed
why
what private/alternate option would solve
maintenance/dependency cost
whether behavior would differ from settled FA2 layouts
```

Do not cross this boundary without user approval.

---

# Bake-off evidence

Create deterministic development fixtures for both Focus and All.

At minimum:

```text
small connected chain/star
weakly connected File
one isolate
multiple isolates
medium mixed graph
All graph with no Pull
All graph with one Pull group
All graph with competing Pull groups / cross-folder references
All graph with fixed Place composition above simulation
```

For each viable candidate measure:

```text
constrained-node target error
neighbor response magnitude/direction
frame-to-frame smoothness
post-release residual movement
settling iterations/time
CPU/worker time
message/frame cadence
same-input determinism within existing tolerance
```

Run safe scale cases around:

```text
100
500
1,000
5,000 nodes
```

No timing gate in CI.

---

# Hard pin behavior

During active drag, the constrained File should visually remain under the pointer.

The physics worker must still receive the same hard target so other nodes react physically.

A renderer-side **temporary visual override of the constrained node only** is acceptable to hide one-frame worker latency, matching the clean behavioral pattern from Obsidian, provided:

```text
worker constraint is real
other nodes come from worker simulation
visual override disappears immediately on end
no coordinate is persisted
no base/dynamic cache is written
```

Do not implement a fake drag where Sigma alone moves the node and neighbors stay static.

---

# Simulation lifecycle contract

Implement one explicit lifecycle, likely equivalent to:

```text
unavailable
sleeping
hot-constrained
cooling
failed
disposed
```

Exact names are flexible.

## Sleeping

```text
no timer / no simulation stepping
latest transient simulation positions retained in memory
```

No semantic or visual event should cause work unless it genuinely changes the simulation inputs or starts a temporary constraint.

## Begin constraint

Validate:

```text
schema
session generation
simulation generation
sequence == 0
node exists and is a canonical File
finite target
no other active constraint
```

Then:

```text
install hard constraint
wake simulation
enter hot-constrained
```

## Update constraint

Accept only matching generation/gesture/node and strictly increasing sequence.

```text
replace target with latest target
keep simulation hot
```

Stale updates must not win.

## End released

```text
clear hard constraint
retain current positions
enter cooling
continue physical stepping
stop only at practical stability / deterministic safety cap
```

No rollback to pre-drag coordinates.

## End cancellation/invalidation

The constraint must always clear.

Different end reasons may have different lifecycle consequences:

```text
released / cancelled / pointer-lost / mode-exit
→ usually clear and cool from current physical state

workspace/scope/layout/topology/spatial-rule generation invalidation
→ clear and dispose/reseed stale simulation rather than continue against obsolete inputs

disposed
→ terminate immediately
error
→ clear + explicit failure
```

Choose the conservative mapping and test it.

---

# Simulation ownership and generations

The simulation state is **transient per live Network session**, not a cache/persistence layer.

It should own, while valid:

```text
stable node keys
working x/y
current topology/edge weights
mode-specific physics settings
current Pull attractors for All
active constraint if any
lifecycle state
last published frame
simulation generation
```

It must not own:

```text
source Markdown
workspace persistence
layout cache entries
Place registry
camera
query state
React state
```

A generation change invalidates stale commands/results.

No frame from an old simulation generation may adopt after newer topology/physics/spatial inputs win.

---

# When the continuous worker should exist

Prefer **lazy** runtime ownership:

```text
normal browsing / no Move
→ existing finite layout workers remain authoritative
→ PHYSICS1 does zero stepping

first real temporary constraint
→ seed/wake transient simulation from current authoritative dynamic positions
```

After cooling reaches sleep, keeping the worker object alive is acceptable if it consumes no simulation CPU and meaningfully preserves transient state. Recreating it later is also acceptable if exact transient-state behavior remains correct.

Do not replace existing finite layout workers with permanently running workers for ordinary browsing.

---

# Initial seed by view

## Focus Network

Seed PHYSICS1 from the current accepted Local Network positions after normal Local convergence.

No layout cache mutation.

## All Network

Seed from the current **dynamic layer before fixed Place composition**:

```text
settled Global base
→ current SPATIAL2 Pull result if effective
```

Do not seed from displayed `+ Place` coordinates.

Do not feed transient simulation frames back into base automatic cache or dynamic Pull cache.

---

# All + Pull continuous semantics

Pull is the main mode-specific design requirement.

The continuous All simulation must preserve the conceptual meaning:

```text
reference forces
+
soft Pull attractors
+
optional temporary hard File constraint
```

Use the current Pull targets/memberships/strengths produced by SPATIAL2 rule resolution.

Do not recompute rule resolution inside the worker from paths or query state; pass only resolved source-neutral inputs.

The existing static Pull algorithm applies bounded centroid corrections around ForceAtlas2 chunks. For PHYSICS1, derive a simulation step that has **stable strength relative to physical step size**.

Required bake-off:

```text
vary physics micro-step size / frame cadence
→ same Pull strength should not become dramatically stronger merely because updates publish more frequently
```

If needed, normalize Pull gain to a defined simulation quantum rather than reusing `0.55 × strength` once per arbitrary frame.

Document the mapping explicitly.

This task may refactor shared pure attractor math out of `spatial-influence.ts`, but must not change saved Pull semantics or SPATIAL2B authoring behavior silently.

If matching current Pull behavior and continuous-step stability require a material product-semantic change, stop for user review.

---

# Cooling / practical stability

PHYSICS1 should not imitate Obsidian alpha numerically.

Use displacement-based practical stability.

## Focus

Prefer the existing Local convergence definitions:

```text
root-translation alignment
previous-root RMS normalization
all-node p90
low-degree maximum guard
```

## All

Prefer the existing Global movement language on the **dynamic simulation frame**:

```text
centroid-aligned shape movement
raw/normalized centroid drift
all-node p90
low-degree maximum guard
```

Because interactive micro-steps may not be 32 iterations, do not blindly apply the 32-iteration thresholds to each hot frame.

Recommended lifecycle split to test:

```text
HOT:
  small micro-steps optimized for responsive reaction
  no convergence stop while constraint remains active

COOLING after end:
  canonical 32-iteration cooling batches where feasible
  use proven p90 / low-degree / centroid guards
  require 3 consecutive stable full cooling batches
```

This reuses evidence-backed stop thresholds without pretending they are micro-step invariant.

For All with active Pull, the cooling macro must include the same continuous Pull force/correction used during hot simulation.

Define deterministic hard iteration/work caps and a wall-time safety abort. Start from existing Local/Global caps where they make sense, but report evidence if dynamic Pull requires a distinct bounded policy.

A safety abort must be explicit; do not return a success-shaped “settled” state.

---

# Frame transport and rendering

PHYSICS1 is a continuous worker, but React must not render per physics tick.

Preferred flow:

```text
worker computes physical micro-steps
→ publishes serializable latest position frame + lifecycle evidence
→ renderer/session adopts at most latest frame per requestAnimationFrame
→ Sigma graph coordinates update imperatively
```

Dropping superseded intermediate frames is expected.

Do not create one Promise/React state update per simulation tick.

Do not stream private source data.

Frame payload should contain stable node key + finite x/y plus minimal generation/lifecycle metadata.

---

# Camera / FLICKER1 compatibility

Continuous geometry frames must be **camera-neutral**.

Merged FLICKER1/camera-neutral work remains authoritative:

```text
physics frame adoption
→ changes graph positions only
→ no automatic Fit
→ no camera x/y/ratio write
→ no density slider write
→ current raw viewport/semantic point stays visually stable except for actual node movement
```

The constrained node can move under the pointer; that is geometry, not a camera action.

Fit, Density, navigation and user pan/zoom retain explicit camera ownership.

Do not let every worker frame trigger density reframing.

---

# Cache and persistence rules

Temporary physics is session state only.

During/after Move:

```text
no Local layout cache write
no Global base cache write
no SPATIAL2 dynamic cache write
no Place registry write
no view-state/history write
no source write
```

While the same valid Network session remains alive, a sleeping PHYSICS1 state may remain the displayed transient dynamic state.

Closing/remounting/reloading the view may return to the normal cached layout; that is correct because Move is not Pin.

On a true topology/physics/spatial-rule change, invalidate the transient simulation and let the normal authoritative finite layout pipeline recompute/warm-start according to its existing contract.

Do not teach ordinary exact-fingerprint caches about drag outcomes.

---

# Capability contract

PHYSICS1 must turn MOVE1A's fake capability into a real one without exposing product Move yet.

Provide a concrete adapter/API that can supply:

```text
capability: available | unavailable(reason)
TemporaryNodeConstraintPort
sessionGeneration
simulationGeneration
coordinateGeneration / compatible ownership
```

Expected unavailable reasons remain explicit:

```text
simulation-unavailable
simulation-not-running
unsupported-view
```

If additional internal failure states are needed, do not casually expand the MOVE1A public contract unless necessary; prefer an adapter-level error surface.

---

# Product/UI boundary

PHYSICS1 does **not** add the visible Edit/Move mode.

Normal production UI should behave exactly as before.

For runtime validation, use one of:

```text
existing development harness/tool
synthetic browser harness
explicit development-only/test-only control
```

Do not leave an unexplained user-facing debug button in the app.

MOVE1B will later:

```text
expose Edit/Move
activate the real context
bind pointer gestures to PHYSICS1
show coarse moving/cooling/unavailable state if useful
```

---

# Development harness

Add a self-contained private-safe simulation lab able to drive the real worker/adapter without MOVE1B UI.

It should support:

```text
Focus fixture
All fixture
Pull on/off
Place translation on/off
target drag path
release
cancel
semantic invalidation
```

Visualize or record:

```text
constraint target
actual constrained-node position
neighbor positions
lifecycle: hot / cooling / sleeping
iterations / steps
frame count
settling metrics
```

Generate no private vault data.

An ignored JSON/HTML evidence artifact is useful if it materially improves candidate comparison.

---

# Worker protocol

Use an explicit versioned protocol.

Likely message families:

```text
initialize / seed
begin constraint
update constraint
end constraint
invalidate / dispose
```

Worker-to-main:

```text
ready/capability
frame
sleep/settled
failure
```

Exact shape is flexible.

Hard requirements:

```text
strict schema validation
session/simulation generation validation
monotonic constraint sequence
stable node-set validation
finite coordinates
stale message rejection
idempotent cleanup
explicit failure
```

Do not send Graphology/Sigma objects across the boundary.

---

# Tests — architecture candidate gate

Before selecting candidate A/B, test:

```text
hard target stays exact after each published frame
connected neighbor reacts toward/away as expected
isolate does not corrupt lifecycle
release removes target
cooling reaches sleep
sleep produces zero additional simulation steps
new update wakes again
stale generation ignored/rejected
```

Compare micro-step candidates at the same physical scenario and report why one is selected.

No hidden preference for smallest or largest batch.

---

# Tests — real adapter

After a candidate passes and production foundation is implemented, cover at least:

## Constraint protocol

```text
begin sequence 0 only
one active constraint
latest update wins
stale update fails
wrong generation fails
wrong node fails
end idempotence
all end reasons clear constraint
```

## Lifecycle

```text
lazy seed
sleeping → hot
hot remains running while constrained
release → cooling
cooling → sleeping
sleeping zero work
wake after second gesture
dispose terminal
failure explicit
```

## Focus

```text
root/session coordinates remain valid
other nodes react
Focus root can be moved if it is an eligible File
Headings/Blocks/diagnostics unsupported
post-release convergence metric works
```

## All

```text
seed from dynamic pre-Place positions
Pull off
Pull on
strong Pull
cross-folder reference reaction
Place target inversion remains exact
fixed Place adds once for display
base/dynamic/fixed caches remain untouched
```

## Invalidation

```text
topology change
physics setting change
scope/layout change
spatial-rule change
workspace change
renderer disposal
```

No stale worker frame may adopt afterward.

## Camera

```text
continuous frames perform zero camera writes
manual pan/zoom remains owned
Fit remains explicit
Density remains explicit
```

---

# Performance / responsiveness

Measure at least:

```text
100 nodes
500 nodes
1,000 nodes
5,000 nodes
```

for viable candidates.

Record:

```text
physics iterations/second
worker step ms
published frames/second
main-thread frame-adoption ms
message bytes/rate
constraint target error
cooling time
```

Do not add a flaky CI timing threshold.

Interactive goals should be treated as evidence, not arbitrary gates. If 5,000-node whole-graph reaction is clearly impractical, report the measured boundary and consider a lower publish cadence before changing physics scope.

Do not silently switch large graphs to a local-neighborhood simulation; that changes product semantics and requires a user decision.

---

# Likely implementation areas

Inspect current main before editing. Probable areas include:

```text
packages/renderer-sigma/src/physics/                 (new module/folder likely)
  README.md if folder has multiple cooperating files
  protocol.ts
  lifecycle.ts
  forceatlas-adapter.ts
  pull-step.ts or shared attractor adapter
  metrics.ts

packages/renderer-sigma/src/temporary-node-constraint.ts
packages/renderer-sigma/src/file-move.ts              (prefer minimal/no semantic changes)
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/spatial-influence.ts      (pure extraction only if useful)
packages/renderer-sigma/src/core.ts

apps/web/src/workers/network-physics.worker.ts         (or mode-specific equivalents)
apps/web/src/workers/network-physics-worker-client.ts

GlobalGraphCanvas / LocalGraphCanvas only as needed for dormant adapter/lifecycle wiring

tools/global-renderer-spike or a new private-safe simulation harness
tools/vault-diagnostics benchmark integration

docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
new ADR for selected simulation architecture
history-implementations/<this exact prompt>
```

Do not create a new folder merely because suggested above; follow current ownership patterns after inspection.

---

# Scope

## In scope

- inspect installed FA2 public incremental capabilities;
- compare supported continuous-step candidates;
- choose evidence-backed hard-constraint execution;
- persistent/lazy per-view simulation state;
- wake/reheat/cooling/sleep lifecycle;
- real `TemporaryNodeConstraintPort` adapter;
- All and Focus simulation support;
- whole-graph neighbor reaction;
- All Pull participation;
- fixed Place composition compatibility;
- generation/stale-work safety;
- worker frame streaming/coalescing;
- convergence/sleep metrics;
- camera-neutral frame adoption;
- no-cache/no-persistence transient state;
- development harness;
- tests/benchmarks/docs/ADR;
- PR/CI/merge/cleanup if candidate gate passes.

## Explicitly out of scope

- visible Edit/Move product UI;
- changing MOVE1A pointer semantics;
- Pin / persistent File placement;
- source editing;
- new saved coordinate schema;
- changing Global M2 base convergence;
- changing Local base convergence;
- redesigning SPATIAL2B authoring;
- dynamic Pull convergence as a separate static-worker feature;
- camera/density redesign;
- ForceAtlas2 fork/private API without user approval;
- different force engine without user approval;
- unrelated HIER/KG14 work.

---

# Suggested implementation sequence

1. Sync latest `main`; inspect worktrees/open PRs and `AGENTS.md`.
2. Read MOVE1A ADR/implementation and current convergence/spatial/camera architecture.
3. Inspect resolved `graphology-layout-forceatlas2@0.10.1` public APIs/source.
4. Build deterministic simulation candidate harness.
5. Compare supported incremental API if present versus persistent-Graphology public `assign` micro-steps.
6. Evaluate hard pin, neighbor reaction, release/cooling, smoothness and scale performance.
7. Derive/test continuous SPATIAL2 Pull step semantics.
8. Apply architecture gate.
9. **If no candidate cleanly passes: stop and report; do not implement private/fork/alternate engine.**
10. If one candidate passes, define versioned PHYSICS1 protocol/lifecycle.
11. Implement real worker/service and temporary constraint adapter.
12. Add All/Focus dormant integration and development harness; keep product Move disabled.
13. Add lifecycle, protocol, invalidation, Pull, Place, camera and cache regressions.
14. Run focused and full validation/benchmarks.
15. Browser/release QA through the development harness.
16. Update architecture/performance/roadmap + ADR and archive exact prompt.
17. PR → CI → merge → post-merge CI → cleanup.
18. Stop. Do not start MOVE1B automatically.

---

# Validation commands

Use current repository equivalents; adapt if package scripts evolved:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web/src/workers apps/web/src/components

pnpm benchmark:file-move
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

# add a task-specific simulation benchmark/analyzer
pnpm analyze:physics1
# or equivalent current script

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

No CI timing threshold.

---

# Exit gate

PHYSICS1 is complete only when:

1. installed FA2 public APIs were inspected before architecture selection;
2. public candidate approaches were compared with deterministic evidence;
3. no package-private/fork/alternate-engine implementation was chosen without user approval;
4. one selected simulation architecture is documented in an ADR;
5. real `TemporaryNodeConstraintPort` implementation exists;
6. normal product UI still has no Move mode;
7. simulation is lazy/dormant when unused;
8. sleeping simulation consumes no physics-step loop;
9. begin wakes simulation;
10. update replaces the latest hard target safely;
11. release removes the constraint;
12. other nodes physically react while constrained;
13. constrained node is visually exact at the current target;
14. visual exactness is not a fake Sigma-only drag;
15. cooling continues after release;
16. cooling reaches a measured practical stop;
17. practical stop criteria are mode-correct and documented;
18. deterministic safety caps/failures exist;
19. failure is explicit, not success-shaped;
20. worker protocol is versioned/strictly validated;
21. session/simulation generations prevent stale adoption;
22. sequence ordering prevents stale pointer targets;
23. constraint cleanup is idempotent;
24. topology/physics/spatial invalidation clears stale constraints;
25. Focus seeds from accepted Local dynamic positions;
26. All seeds from current dynamic pre-Place positions;
27. Pull remains active during All physical simulation;
28. Pull strength is not an accidental function of publish/frame frequency;
29. fixed Place is neither inverted twice nor fed into simulation state;
30. base automatic cache is never mutated by Move;
31. SPATIAL2 dynamic cache is never mutated by Move;
32. no persistence/view history/source writes occur;
33. closing/remounting may forget transient Move state;
34. continuous frames do not trigger automatic Fit;
35. continuous frames do not write camera state;
36. density remains explicitly controlled and camera-only;
37. worker frames are coalesced for rendering rather than routed through React per tick;
38. intermediate stale frames can be dropped safely;
39. All and Focus fixtures pass;
40. isolate/weak-node fixtures pass;
41. Pull + cross-folder reference fixtures pass;
42. Place-composed target fixture passes;
43. candidate/production performance is measured at 100/500/1,000/5,000 nodes;
44. no silent large-graph scope reduction is introduced;
45. no new external dependency is added unless clearly justified and approved by architecture gate;
46. closest docs/comments explain non-obvious lifecycle constants;
47. MOVE1A contracts remain source of truth for gesture/coordinate semantics;
48. focused tests pass;
49. `pnpm check` passes;
50. desktop check/build pass;
51. browser/release harness QA is reported honestly;
52. PR CI passes;
53. post-merge CI passes;
54. exact prompt is archived;
55. unrelated worktrees/files are preserved;
56. task branch/worktree cleanup completes;
57. MOVE1B is not started automatically.

---

# Final report

Report concisely:

## 1. Architecture decision

```text
Selected ForceAtlas2 execution model:
Rejected alternatives:
Why:
```

## 2. Lifecycle

```text
seed
sleep
wake/reheat
constrain/update
release
cool
settle
invalidate/dispose
```

## 3. Constraint behavior

Target accuracy, whole-graph reaction and frame cadence.

## 4. Pull / Place composition

How All keeps Pull active and applies Place only after simulation.

## 5. Cooling policy

Metrics, batch/micro-step behavior, caps and failure handling.

## 6. Worker/protocol/generation safety

## 7. Camera/cache/persistence guarantees

## 8. Performance

100 / 500 / 1,000 / 5,000-node evidence.

## 9. Tests / browser / desktop QA

State any unavailable physical-device validation honestly.

## 10. Files / dependencies

Expected external additions: zero unless the architecture gate explicitly justified one.

## 11. Follow-up

If PHYSICS1 is complete:

```text
MOVE1B — production Edit/Move mode — next
```

Do not start MOVE1B automatically.
