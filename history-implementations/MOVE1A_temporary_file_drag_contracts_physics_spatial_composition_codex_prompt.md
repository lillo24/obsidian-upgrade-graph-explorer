# MOVE1A — Temporary File Drag Contracts + Physics/Spatial Composition Foundation

**Task type:** interaction foundation / pure gesture state machine / coordinate-space contract / simulation adapter seam / parallel implementation

## Goal

Build the architecture needed for **temporary Obsidian-style File movement** without yet shipping the production pencil/Edit mode or implementing the cooling simulation itself.

The intended eventual behavior is:

```text
pointer down on File
→ prime a move gesture

pointer movement crosses threshold
→ temporarily constrain that File under the pointer
→ reheat the existing physical simulation
→ other unpinned nodes continue reacting

pointer release
→ clear the temporary constraint
→ File returns to automatic physics
→ simulation cools to a practical rest
→ nothing is persisted
```

MOVE1A must define and test:

- what Move means;
- gesture phases;
- high-frequency pointer command flow;
- simulation-service boundary;
- coordinate conversion;
- interaction ownership;
- All/Focus differences;
- composition with current folder Pull/Place rules;
- cancellation and lifecycle safety.

MOVE1A must **not** implement the physical cooling/convergence engine. That work is proceeding in parallel under PHYSICS1.

MOVE1A must **not** implement persistent pinning.

The production pencil/Edit UI and real simulation wiring remain MOVE1B after the PHYSICS1 contract is stable.

---

# Terminology — hard product distinction

Do not conflate these concepts.

## Move

```text
drag File
→ temporary physical constraint
→ release constraint on pointer-up
→ simulation resumes/cools
→ no saved position
```

## Pin — later

```text
place File
→ keep it fixed after release
→ persist user intent
→ explicit Unpin / Reset
```

## Folder Place — already implemented

```text
move folder cluster
→ persist normalized rigid translation
→ no physics during preview
```

## Folder Pull — current SPATIAL2 system

```text
folder rule softly influences dynamic positions
→ physics/layout-derived
→ not a rigid displayed translation
```

This task is **MOVE1A**, not a pinning foundation.

Do not introduce:

```text
individual pin registry
individual saved x/y
Pin here
Unpin
Reset pin
```

---

# Current repository baseline

Repository:

```text
lillo24/icarus-graph-explorer
```

At plan-writing time current `main` is:

```text
16bbd2208593cb320c9ab57affafbf0b7dee0a11
```

which includes:

```text
PR #59 — SPATIAL1B direct exact-folder arrangement
PR #63 — SPATIAL2A hierarchical Pull/Place folder rules
```

Current spatial pipeline:

```text
base automatic positions
        ↓
dynamic soft-Pull positions
        ↓
fixed Place composition
        ↓
displayed Sigma positions
```

Current spatial schema is **v2**:

```text
folderRules:
- behavior: pull | place
- scope: exact | subtree
- most-specific winning rule per File
- subtree exclusions
- normalized anchor
- strength for Pull
```

Current production folder arrangement:

```text
All + Network only
→ exact folder spotlight
→ 3 px drag threshold
→ rAF-coalesced sparse rigid preview
→ Save/Cancel
→ normalized persisted Place rule
→ zero automatic layout requests during pointer movement
```

Current Sigma sessions already arbitrate:

```text
selection
confirmed single click
node double-click Focus
stage pan
precision wheel/pinch
right-click actions
folder arrangement drag
```

MOVE1A must fit this architecture rather than building a second unrelated pointer system.

Before implementation, inspect current `main`; newer merged work overrides this snapshot.

---

# Parallel work — hard coordination rules

## PHYSICS1

A separate chat/task is auditing or implementing a cooling/convergence simulation lifecycle inspired by the extracted Obsidian behavior.

PHYSICS1 owns:

```text
simulation persistence/lifetime
cooling/convergence
reheating
worker scheduling
physical force evaluation
temporary fixed-node execution
stop/settled criteria
```

MOVE1A owns:

```text
Edit/Move intent contract
pointer gesture state
node eligibility
coordinate conversion
constraint commands
interaction conflicts
lifecycle invalidation
folder spatial composition
```

Do not add:

```text
alpha
alphaTarget
alphaDecay
batch-size convergence
ForceAtlas2 iteration policy
```

to MOVE1A contracts.

Those are simulation implementation details.

Before coding and before final integration:

1. inspect current branches/PRs for PHYSICS1, COOLING, CONVERGENCE or equivalent;
2. if a stable simulation interaction port has already merged, reuse it;
3. if PHYSICS1 is still separate, keep MOVE1A's port abstract and fake-backed;
4. do not copy/overwrite the PHYSICS1 branch or worktree;
5. do not enable incomplete production movement merely to demonstrate the contract.

## SPACING1B / Focus camera

At plan-writing time PR #60 is draft and may change Focus Network automatic framing, Fit and user-owned camera behavior.

Before touching Focus Network interaction code:

- check PR #60 status;
- if merged, rebase/sync and preserve its camera-ownership contract;
- if still open, do not edit or clean its worktree;
- MOVE1A pointer targets must use the live renderer's viewport-to-graph conversion, not persisted semantic viewport approximations;
- dragging must not trigger automatic Fit/framing.

## SPATIAL2B

SPATIAL2B may add production authoring for Pull/Place scope, exclusions and strength.

MOVE1A must remain compatible with the current schema-v2 rule model, but must not add or redesign that UI.

A spatial-rule change while a File drag is active must invalidate/end the gesture rather than silently rebase against changed geometry.

---

# Required first inspection

Read current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
current spatial ADRs

packages/spatial-overrides/README.md
packages/spatial-overrides/src/types.ts
packages/spatial-overrides/src/resolution.ts
packages/spatial-overrides/src/geometry.ts
packages/spatial-overrides/src/preview.ts
packages/spatial-overrides/src/registry.ts

packages/renderer-sigma/README.md
packages/renderer-sigma/src/arrangement.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/local-types.ts
packages/renderer-sigma/src/node-click.ts
packages/renderer-sigma/src/precision-wheel-zoom.ts

apps/web/src/spatial-overrides/arrangement.ts
apps/web/src/spatial-overrides/session.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/NetworkExplorer.tsx
```

Also inspect:

```text
PR #59 implementation/report
PR #63 implementation/report
open PHYSICS1 work
open PR #60
```

---

# Obsidian behavior used as the reference

The local extraction of Obsidian 1.11.5 established:

```text
pointerdown
→ select node

pointermove
→ write temporary fx/fy
→ reheat simulation to alpha/alphaTarget 0.3
→ all current nodes and links continue simulating

pointerup
→ clear fx/fy
→ alphaTarget becomes 0
→ node returns immediately to automatic simulation
→ whole system cools
```

Obsidian does not persist the dragged position after closing the view.

MOVE1A should capture the **behavioral contract**, not Obsidian's proprietary implementation or literal alpha API.

Clean-room target:

```text
begin temporary constraint
update temporary target
release temporary constraint
simulation implementation decides how to reheat/cool
```

---

# Position-layer contract

This is the most important architectural requirement.

Current All Network coordinates have three layers:

```text
B = base automatic position
D = dynamic position after Pull behavior / physical simulation
T = fixed Place translation from the winning Place group
P = displayed position
```

Therefore:

```text
P = D + T
```

Temporary physical movement belongs in the **dynamic/simulation coordinate layer**, immediately before fixed Place composition.

Given a pointer target in displayed graph coordinates:

```text
C = temporary simulation constraint target

C = pointerDisplayedGraphPoint − T
```

Rendering then applies the Place translation once:

```text
C + T = pointerDisplayedGraphPoint
```

Do not:

- send the displayed point directly when a Place translation is active;
- subtract a Pull target;
- subtract folder translation twice;
- write the pointer position into base automatic cache coordinates;
- feed displayed positions back into upstream layout state.

---

# Pull versus Place during File movement

## Pull

Pull is part of the dynamic/physics stage.

```text
Pull influence
→ remains active while the simulation reacts
```

MOVE1A does not invert or remove Pull.

The PHYSICS1 adapter must eventually decide how current Pull behavior participates in the continuous/cooling simulation.

MOVE1A only targets the simulation-space coordinate.

## Place

Place is a rigid post-physics translation.

```text
winning Place translation
→ subtract once from pointer target before issuing temporary constraint
→ add once for display
```

The Place rule may be:

```text
exact folder
parent subtree
root subtree
```

Do not infer translation from the File's exact folder anchor alone.

Use the actual resolved/applied winning Place group produced by current spatial composition.

The deepest matching rule already wins; no parent/child translation may be applied twice.

---

# Required coordinate helper

Add a pure source-neutral helper at the appropriate spatial-geometry boundary.

Conceptually:

```ts
interface NodeDisplayedTranslation {
  readonly nodeKey: string
  readonly translation: SpatialPoint
}

function simulationTargetFromDisplayedPoint(...): SpatialPoint
```

or an equivalent API.

It should support:

```text
no Place translation
→ identity

one winning Place translation
→ subtract exactly once
```

Prefer deriving a deterministic:

```text
nodeKey → applied fixed translation
```

index from `SpatialCompositionResult.activeFolders` or the equivalent current composition output.

Do not put renderer/Sigma types into `packages/spatial-overrides`.

Naming should reflect the current layers, e.g.:

```text
displayed → dynamic/simulation
```

not the obsolete folder-only v1 model.

---

# Coordinate examples — tests required

## No Place rule

```text
dynamic position = (4, 5)
fixed translation = (0, 0)
displayed pointer target = (8, 9)

simulation target = (8, 9)
```

## Exact Place rule

```text
fixed translation = (+10, -2)
displayed pointer target = (20, 10)

simulation target = (10, 12)

simulation target + translation
= (20, 10)
```

## Parent subtree Place rule

A File under:

```text
Theory/Language
```

may be translated by a winning Place rule rooted at:

```text
Theory
```

The inverse must use that actual applied translation.

## Child rule wins

If both:

```text
Theory subtree Place
Theory/Language exact/pull/place
```

match, use only the most-specific winning behavior for the File.

## Pull wins

If the File's winning rule is Pull:

```text
fixed translation = 0
```

Do not subtract its pull anchor.

## Excluded subtree

A File under an excluded subtree receives no parent Place translation unless another deeper rule wins.

## Root folder

`.` must behave through the same segment-safe rule resolution.

---

# Temporary constraint service boundary

Define a renderer-independent consumer port that PHYSICS1 can implement later.

Conceptual contract:

```ts
interface TemporaryNodeConstraintPort {
  begin(command: BeginTemporaryNodeConstraint): void
  update(command: UpdateTemporaryNodeConstraint): void
  end(command: EndTemporaryNodeConstraint): void
}
```

Exact naming is flexible.

Commands should be plain/serializable and include enough information for stale-work rejection:

```text
simulation/session generation
active gesture ID
monotonic update sequence
node renderer key
simulation-space target x/y
end reason
```

Possible end reasons:

```text
released
cancelled
pointer-lost
mode-exit
topology-changed
spatial-rules-changed
layout-changed
scope-changed
disposed
error
```

Do not include:

```text
alpha values
cooling thresholds
worker instance
Graphology object
Sigma object
canonical source text
persisted coordinates
```

---

# Port semantics

## Begin

```text
first movement beyond threshold
→ begin one temporary constraint
```

A simple click must not reheat/start simulation.

## Update

```text
pointer movement
→ latest target for active gesture
```

High-frequency input should be rAF-coalesced before crossing the service boundary.

The port/adapter may drop superseded move samples.

Do not create one independent layout job per pointer event.

## End — released

```text
pointer release
→ clear temporary constraint
→ physics remains responsible for cooling/settling
→ no persistence
```

## End — cancelled/invalidated

Cancellation also guarantees the constraint is cleared.

Important:

```text
cancel does NOT promise to restore all pre-drag simulation coordinates
```

Once other nodes have reacted, a full rollback would require a separate simulation snapshot/undo feature.

Document this honestly.

The graph simply continues/cools from its current physical state.

## Idempotence

Ending or disposing the same gesture twice must be safe.

Only one active File constraint is supported initially.

---

# Gesture state machine

Add a pure gesture reducer, likely in `renderer-sigma`, separate from worker/runtime implementation.

Suggested phases:

```text
idle
primed
dragging
ending / ended only if asynchronous acknowledgement requires it
```

Suggested events:

```text
prime
move
release
cancel
invalidate
dispose
```

State captured at prime should include:

```text
gesture ID
node key
canonical EntityId if available
start viewport point
start displayed graph point
captured fixed translation
simulation/source generation
```

Use a small viewport drag threshold.

The existing folder drag threshold is 3 px; reuse a shared constant only if semantics remain clear.

Do not begin the temporary physical constraint until the threshold is crossed.

---

# High-frequency update ownership

Use the existing renderer-imperative pattern:

```text
pointer event
→ session-owned gesture state
→ requestAnimationFrame coalescing
→ latest simulation target command
```

Do not route every pointer event through React state.

Do not create one promise or React render per move sample.

React/application state may observe coarse phases:

```text
idle
moving
cooling / unavailable later if PHYSICS1 exposes it
```

but not raw pointer coordinates.

---

# Interaction ownership

The current Global session already has one direct-manipulation owner: Arrange Folders.

Introduce or document one exclusive interaction owner:

```text
normal
folder-arrangement
file-move
```

Folder arrangement and File movement must never own the same pointer sequence.

If one mode becomes active while the other has a primed/dragging gesture:

```text
clear/end current gesture first
→ then switch owner
```

Do not support simultaneous folder preview + File physics drag.

That removes ambiguity around which offset/coordinate frame owns the pointer.

---

# Normal input behavior while Move is enabled

The future product mode will be explicit Editing/Move mode, but MOVE1A should define its event policy now.

## Simple click under threshold

```text
no physical constraint
→ preserve ordinary File selection/reveal behavior
```

## Drag past threshold

```text
cancel pending confirmed single-click reveal
suppress double-click Focus
suppress Sigma default node drag/camera behavior
start temporary constraint
```

The dragged File should become the selected File when movement actually begins, unless current interaction evidence strongly supports preserving another selection.

Do not issue a center request.

## Stage drag

```text
pointer starts on stage
→ normal camera pan
```

Edit mode must not disable stage navigation.

## Wheel / pinch during active node drag

Use the same conservative policy as current folder arrangement:

```text
active node drag
→ suppress wheel/pinch conflict
```

When merely in Edit mode but not dragging, normal camera input remains available.

## Right click

When no drag is active, existing File actions remain available.

During an active drag, suppress conflicting context activation.

## Double click

While File Move tool owns node input, double-click must not enter Focus accidentally.

When Edit mode is inactive, current double-click Focus behavior remains unchanged.

---

# Selection/click arbitration tests

Add deterministic coverage proving:

```text
click < threshold
→ selection/reveal remains
→ zero constraint commands

drag > threshold
→ selection once
→ confirmed-click reveal cancelled
→ zero Focus activation
→ one begin command

double-click while normal
→ existing Focus

double-click while Move tool active
→ no Focus
```

Preserve the current 300 ms single/double-click arbitration outside Move.

---

# All + Network support

MOVE1A should define the complete All Network contract.

Eligibility:

```text
canonical File/document node only
```

Not eligible:

```text
diagnostic target
edge
folder pseudo-entry
Heading/Block — absent from All Network anyway
```

The gesture must target the current dynamic/simulation space after accounting for winning fixed Place translation.

Current folder Pull rules remain dynamic influence.

No registry write occurs.

No layout cache is modified by MOVE1A itself.

---

# Focus + Network support

Define the same temporary movement contract for Focus Network.

Current Focus Network has no SPATIAL1/2 folder Place composition.

Therefore:

```text
displayed graph target
=
simulation target
```

through an identity spatial adapter.

Eligible nodes for the initial product:

```text
File/document nodes
```

Do not make Headings, Blocks or diagnostics draggable in MOVE1.

Reason:

- the requested interaction is moving Files;
- heading/block geometry is local structural detail;
- making them physical drag targets requires a separate hierarchy-semantics decision.

Preserve Focus-root identity and current camera framing.

---

# Camera-coordinate contract

Pointer conversion must use current renderer APIs:

```text
viewport point
→ live Sigma viewportToGraph
→ displayed graph point
→ inverse fixed Place translation
→ simulation-space target
```

Do not use:

```text
persisted semantic viewport
cached camera matrix
CSS pixel assumptions
raw screen coordinates as graph coordinates
```

The camera may be zoomed/panned.

The same visual pointer location must map correctly at every camera ratio.

The File should not jump when drag starts.

---

# No-jump drag start

At threshold crossing, calculate the target from the current pointer and captured spatial context.

The displayed File center should remain continuous.

Do not snap the File center to a stale automatic position or to the pointer without preserving the pointer-to-node offset if the user grabbed it away from its center.

Capture either:

```text
pointer-to-node displayed offset
```

or an equivalent no-jump geometry.

Then:

```text
desired displayed node center
= current pointer − captured grab offset
```

Convert that displayed center to simulation space.

Add tests at non-unit camera zoom and non-zero folder Place translation.

---

# Spatial-rule revision safety

The drag coordinate context is captured from a specific spatial composition.

If any of these change while dragging:

```text
projection/topology
base layout generation
dynamic Pull result
Place rules or winning membership
folder arrangement preview
Scope/Layout
source workspace
```

then the old inverse transform may be invalid.

Default behavior:

```text
end/clear temporary constraint
cancel active gesture
announce/recover safely
```

Do not silently keep sending targets using stale translation data.

A future advanced implementation may rebase, but not MOVE1A.

Use generation/fingerprint tokens rather than deep object identity where possible.

---

# Folder Arrange coexistence

Current Arrange Folders remains unchanged in MOVE1A.

Folder behavior:

```text
rigid preview
zero physics
persist Place on Save/release transaction
```

File Move behavior:

```text
temporary physical constraint
other nodes may react through PHYSICS1
release back to automatic
zero persistence
```

Do not fold both into one production UI yet.

MOVE1A may define a future application-level model such as:

```ts
type NetworkEditingTool = 'move-file' | 'arrange-folder'
```

but current Arrange Folders controls must not regress.

The production pencil/Edit toolbar belongs to MOVE1B.

---

# Current soft-Pull worker interaction

The current SPATIAL2A architecture has a separate latest-wins soft-attractor worker/cache.

MOVE1A must not decide prematurely whether PHYSICS1:

```text
A. absorbs Pull rules into one persistent simulation
B. retains a distinct dynamic stage
C. adapts the existing soft-attractor worker
```

Instead define the invariant:

```text
temporary File constraint targets the live dynamic coordinate stage
before fixed Place translations
```

PHYSICS1/MOVE1B must provide the concrete adapter.

Do not submit the current finite soft-attractor job for every pointer movement.

---

# Constraint-capability gating

The production Move tool must eventually be enabled only when the active Network simulation supports temporary constraints.

MOVE1A should define capability reporting, conceptually:

```ts
interface TemporaryConstraintCapability {
  readonly available: boolean
  readonly unavailableReason?: string
}
```

Do not expose a production pencil that appears functional while using a no-op service.

In MOVE1A:

```text
real production service absent
→ no production Move control
```

A development/test harness may inject a fake service.

---

# Application editing-state seam

Define a small pure state contract for the eventual pencil toolbar.

Conceptually:

```text
Editing off
Editing on:
  Move Files
  Arrange Folders
```

Do not rewrite the existing production Folder Arrangement UI in this foundation unless a narrow compatibility adapter is clearly safer.

The state contract should establish:

- one active editing tool;
- switching tools clears active gesture ownership;
- leaving Network clears editing mode;
- changing workspace clears editing mode;
- no persistence of the editing mode itself;
- no NAV/history checkpoint for entering/exiting editing.

The visible pencil icon is MOVE1B.

---

# Development/test harness

Add a private-safe development harness or focused test adapter capable of recording:

```text
begin constraint
update targets
end reason
```

The fake service may directly display the dragged node or provide deterministic mock reactions for testing, but must not be used as production physics.

Required harness evidence:

```text
All Network with no Place
All Network with exact Place
All Network with parent subtree Place
All Network with Pull
Focus Network identity transform
```

Do not claim Obsidian-like physical behavior from the fake.

---

# Lifecycle and failure rules

An active temporary constraint must be cleared on:

```text
pointer release
Escape
pointer capture loss
window blur
document visibility loss
renderer/session disposal
workspace/source change
Scope/Layout change
projection/topology change
spatial-rule generation change
simulation service failure
```

Clearing must be best-effort and idempotent.

A service failure should:

- stop the gesture;
- restore ordinary input ownership;
- surface a non-success-shaped error;
- not persist anything;
- not leave the File fixed invisibly.

No retry loop in MOVE1A.

---

# Persistence and privacy

Temporary movement stores nothing.

Do not modify:

```text
SpatialOverrideRegistry schema v2
presentation-overrides registry
view-state schema v3
Saved Filters
Visual Groups
stable identity catalog
```

No localStorage entry.

No app-local Tauri state.

No Markdown write.

No network access.

No absolute paths in commands or instrumentation.

Allowed temporary command data:

```text
opaque renderer/node key
session/gesture generation
finite graph-space target
end reason
```

---

# Instrumentation

Add aggregate operation counts suitable for MOVE1B/PHYSICS1 validation, e.g.:

```text
file-move-primes
file-move-begins
file-move-target-updates
file-move-ends
file-move-invalidations
```

Do not log:

```text
File path
File title
EntityId
raw pointer trace
full coordinates in production logs
```

MOVE1A should also prove:

```text
pointer move commands
→ zero KG6 projection work
→ zero React state updates per raw sample
→ zero persistence
```

Do not assert zero simulation work; reacting physics is the point of MOVE1B.

---

# Tests — spatial geometry

Add focused pure tests covering:

1. identity conversion without Place;
2. exact Place inverse translation;
3. parent subtree Place inverse translation;
4. deepest child rule wins;
5. Pull is not inverted;
6. excluded subtree receives no parent translation;
7. root `.` Place;
8. forward composition after inverse equals pointer target;
9. non-zero visual Y sign behavior;
10. finite validation;
11. missing node translation defaults safely only when genuinely unplaced;
12. duplicate/ambiguous applied translation is rejected rather than guessed.

---

# Tests — gesture reducer

Cover:

1. pointer down enters primed;
2. under-threshold move stays primed;
3. threshold crossing begins drag exactly once;
4. subsequent moves update target;
5. release before threshold produces no constraint;
6. release after drag ends constraint exactly once;
7. Escape before threshold is inert cleanup;
8. Escape after drag clears constraint;
9. cancel does not claim coordinate rollback;
10. stale gesture ID ignored/rejected;
11. stale update sequence ignored/rejected;
12. second node cannot start while one gesture is active;
13. dispose is idempotent;
14. invalid coordinates fail loudly and clear ownership.

---

# Tests — no-jump/camera conversion

Cover:

```text
camera panned
camera zoomed
pointer grabs node off-center
fixed Place translation active
```

Assert the first constrained displayed center matches the pre-threshold visual trajectory without a snap.

---

# Tests — command ordering/coalescing

Using a fake port:

```text
prime
many pointer samples in one frame
release
```

must produce:

```text
begin once
latest update per animation frame
end once
```

No update after end.

No command from a superseded gesture.

---

# Tests — interaction arbitration

Global:

- ordinary selection/reveal unchanged when Move unavailable/inactive;
- click under threshold selects/reveals normally;
- actual drag cancels confirmed reveal;
- actual drag suppresses Focus activation;
- stage pan remains available;
- wheel/pinch blocked only during active drag;
- right-click actions remain available when idle;
- Folder Arrange and File Move are mutually exclusive;
- current folder arrangement tests remain green.

Focus:

- same click/drag distinction;
- Focus reroot/double-click unchanged outside Move;
- no automatic Fit/framing triggered;
- PR #60 camera ownership preserved if merged.

---

# Tests — invalidation

An active gesture must end/clear after:

- topology revision;
- Hide/query removes File;
- live update deletes File;
- source switch;
- Scope change;
- Layout change;
- Place/Pull rule update;
- folder arrangement activation;
- renderer disposal;
- fake service error.

No stale target may reach the next simulation/session generation.

---

# Performance evidence

Benchmark the MOVE1A-owned path only:

```text
pointer sample
→ coordinate transform
→ gesture reduction
→ rAF coalescing
→ fake-port update
```

Profiles:

```text
one File, no Place
one File under Place
large graph with translation index already built
```

Requirements:

- O(1) target conversion after context/index creation;
- no per-sample scan of all nodes/folder rules;
- no React render per sample;
- no persistence per sample;
- no new external dependency.

Do not benchmark fake physics as production evidence.

---

# Architecture documentation

Add or update documentation to establish the parallel tracks:

```text
PHYSICS1
→ simulation lifecycle/cooling/reheating

MOVE1A
→ gesture + coordinate + constraint contract

MOVE1B
→ production pencil/Edit integration

PIN1
→ later persistent individual placement
```

Add a concise ADR if the repository's current decision style warrants it.

Record:

1. Move is temporary; Pin is persistent and deferred.
2. temporary constraints live in dynamic simulation coordinates.
3. fixed Place translation is inverted once for pointer targets.
4. Pull remains a dynamic simulation influence.
5. folder arrangement and File movement are mutually exclusive tools.
6. pointer updates are rAF-coalesced and renderer-owned.
7. cooling/reheating details remain PHYSICS1-owned.
8. MOVE1A adds no production pencil control.
9. no spatial schema/persistence change occurs.

Roadmap suggestion:

```text
MOVE1 — Temporary physical File movement
MOVE1A — gesture/coordinate/constraint foundation: complete
MOVE1B — production Edit mode + PHYSICS1 integration: next after PHYSICS1
PIN1 — persistent individual placement: later
```

Do not reuse `SPATIAL2A`; that milestone name already belongs to folder soft-attractor work.

---

# Scope

## In scope

- Move-versus-Pin semantic contract;
- temporary File constraint port;
- serializable command types;
- gesture reducer;
- drag threshold;
- rAF command coalescing;
- live viewport-to-graph conversion;
- pointer-to-node grab offset;
- displayed-to-dynamic inverse Place transform;
- schema-v2 Pull/Place compatibility;
- All + Network adapter contract;
- Focus + Network identity spatial adapter;
- interaction ownership/arbitration;
- lifecycle invalidation;
- fake service/harness;
- deterministic tests;
- aggregate instrumentation;
- docs/ADR/roadmap;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- cooling/convergence physics;
- alpha/alphaTarget API;
- persistent simulation worker;
- production pencil/Edit control;
- production File movement;
- persistent pinning;
- individual spatial registry;
- File position persistence;
- Undo movement;
- folder-rule editor changes;
- folder drag redesign;
- moving Headings/Blocks;
- Hierarchy dragging;
- collision/no-overlap solver;
- Saved Views;
- Adaptive Layout.

---

# Suggested implementation sequence

1. Sync current `main` and inspect open PHYSICS1, PR #60 and SPATIAL2B work.
2. Write architecture tests for the current base → dynamic → fixed → displayed pipeline.
3. Add node-key-to-fixed-translation derivation and displayed→simulation inverse helper.
4. Add Pull/Place/subtree/exclusion coordinate tests.
5. Define temporary constraint capability and command port.
6. Add pure File gesture reducer and drag threshold.
7. Add pointer-grab/no-jump geometry.
8. Add rAF latest-target coalescer.
9. Add exclusive interaction-owner contract with Folder Arrange compatibility.
10. Add optional/fake-backed Global Sigma session seam.
11. Add optional/fake-backed Focus Sigma session seam.
12. Add lifecycle invalidation and idempotent clear behavior.
13. Add test/development harness; keep production capability disabled.
14. Add instrumentation and microbenchmark.
15. Run focused spatial/renderer/web tests.
16. Run full checks/builds/benchmarks.
17. Rebase onto latest `main`; resolve PHYSICS1/camera/spatial overlap semantically.
18. Archive prompt under `history-implementations/`.
19. PR → CI → merge → post-merge CI → cleanup.
20. Stop. Do not begin MOVE1B or PIN1 automatically.

---

# Validation commands

Use current repository equivalents from `AGENTS.md`.

Expected baseline:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

Add a focused MOVE1A benchmark command following current tool conventions if useful.

No timing threshold in CI.

Because no production Move UI is enabled, native interaction QA is not a MOVE1A merge gate. A development harness smoke check is sufficient.

---

# Exit gate

MOVE1A is complete only when:

1. Move and Pin are explicitly distinct.
2. Move creates no persistent position.
3. spatial schema remains v2.
4. view-state remains v3.
5. temporary constraint commands contain no physics-engine cooling parameters.
6. command contract is plain/serializable.
7. one active File constraint is supported.
8. command generations/sequences reject stale updates.
9. end/clear is idempotent.
10. release clears the constraint and promises no persistence.
11. cancel clears the constraint without falsely promising full coordinate rollback.
12. gesture does not begin below threshold.
13. threshold crossing begins once.
14. pointer updates are rAF-coalesced.
15. no raw pointer stream enters React state.
16. no-jump grab offset is preserved.
17. live viewport-to-graph conversion works at zoom/pan.
18. no-Place coordinate conversion is identity.
19. exact Place translation is subtracted once.
20. subtree Place translation is subtracted once.
21. deepest winning rule is respected.
22. Pull target is not subtracted.
23. excluded subtree behavior is correct.
24. root `.` behavior is correct.
25. inverse then forward composition reaches the displayed pointer target.
26. conversion is O(1) after index/context creation.
27. All Network accepts canonical File nodes only.
28. Focus Network accepts File nodes only.
29. Headings, Blocks and diagnostics are ineligible.
30. Folder Arrange and File Move cannot own one gesture simultaneously.
31. current folder arrangement behavior/tests do not regress.
32. click under threshold preserves normal selection/reveal.
33. real drag cancels confirmed-click reveal.
34. real drag suppresses double-click Focus.
35. stage pan remains available when no node drag is active.
36. wheel/pinch conflict is suppressed only during active drag.
37. right-click actions remain available when idle.
38. topology/source/scope/layout/spatial changes clear the active constraint.
39. renderer disposal clears the active constraint.
40. service failure clears interaction ownership and fails visibly.
41. no File position is written to localStorage/Tauri/Markdown.
42. no layout-cache position is overwritten by MOVE1A.
43. no current finite ForceAtlas2 job is submitted per pointer move.
44. no alpha/cooling implementation is added.
45. fake harness proves command order and coordinate transforms.
46. production Move control remains unavailable/absent.
47. current All/Focus Network behavior is unchanged when no move service is supplied.
48. PR #60 camera behavior is preserved if merged.
49. current SPATIAL2 Pull/Place behavior is preserved.
50. QUERY1 Hide, Visual Groups, VISUAL1B Size and Network Explorer do not regress.
51. no external runtime dependency is added.
52. focused tests pass.
53. full `pnpm check` passes.
54. desktop check/build pass.
55. relevant benchmarks pass.
56. docs/ADR explain the contract.
57. roadmap names MOVE1A/MOVE1B without colliding with SPATIAL2.
58. prompt is archived.
59. PR CI passes.
60. post-merge CI passes.
61. task branch/worktree cleanup completes.
62. MOVE1B and PIN1 are not started automatically.

---

# Final report

## 1. Summary

What MOVE1A establishes and what remains intentionally unavailable.

## 2. Current spatial architecture

Show:

```text
base automatic
→ dynamic Pull/simulation
→ fixed Place
→ displayed
```

## 3. Coordinate contract

Explain:

```text
simulation target
= displayed pointer target − winning fixed Place translation
```

with exact/subtree/Pull examples.

## 4. Gesture state machine

Prime, threshold, drag, release, invalidation.

## 5. Simulation port

Commands, generations, sequencing, idempotent end, and absence of alpha/worker details.

## 6. Interaction arbitration

Selection, reveal, Focus, stage pan, wheel, right click, Folder Arrange.

## 7. All versus Focus

All uses inverse fixed composition; Focus uses identity spatial conversion.

## 8. PHYSICS1 compatibility

State whether an existing physics contract was reused or a fake/abstract port remains.

## 9. SPATIAL2 compatibility

Pull/Place/subtree/exclusion behavior and folder preview invalidation.

## 10. Performance

rAF coalescing and O(1) coordinate conversion evidence.

## 11. Tests / checks / harness

## 12. Files changed

## 13. Dependencies / privacy

Expected external additions: zero; persistence changes: zero.

## 14. MOVE1B handoff

MOVE1B can rely on:

- temporary constraint command contract;
- no-jump gesture geometry;
- All fixed-Place inverse transform;
- Focus identity transform;
- interaction ownership;
- lifecycle invalidation;
- fake-backed renderer seams;
- PHYSICS1 capability boundary.

MOVE1B should add the visible pencil/Edit mode and bind these contracts to the completed cooling simulation.

## 15. PIN1 boundary

Confirm persistent individual positions remain a separate future feature.

Do not implement MOVE1B or PIN1 automatically.
