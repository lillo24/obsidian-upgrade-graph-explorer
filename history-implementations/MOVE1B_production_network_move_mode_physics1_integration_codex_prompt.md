# MOVE1B — Production Network Move Mode + PHYSICS1 Integration

**Task type:** product integration / direct manipulation / continuous physics activation / accessible Network editing / native interaction QA

## Goal

Turn the dormant MOVE1A + PHYSICS1 foundation into the first production **temporary File Move** feature.

The user-facing behavior is:

```text
Edit Network ✎
→ Move Files
→ drag a File
→ File follows the pointer
→ all current Network nodes continue reacting through physics
→ release
→ temporary constraint is removed
→ simulation cools and sleeps
→ no File position is saved
```

This is **Move**, not **Pin**.

MOVE1B should integrate existing contracts rather than invent another movement or physics system.

Dependencies are complete:

```text
MOVE1A
✅ gesture threshold
✅ coordinate conversion
✅ fixed Place inversion
✅ constraint commands
✅ input arbitration
✅ session seams

PHYSICS1
✅ lazy retained Worker
✅ hard temporary constraints
✅ whole-graph All/Focus reaction
✅ Pull cadence normalization
✅ display-only Place composition
✅ cooling and sleeping
✅ invalidation/failure protocol

MOVE1B
→ production activation and product UX
```

Do not redesign ForceAtlas2, convergence, Pull, Place, or spatial persistence.

Do not implement persistent pinning.

---

# Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

The repository was renamed from `icarus-graph-explorer`; a local checkout directory may still retain the old folder name. Use the actual Git remote and current repository identity rather than assuming a local folder name.

At plan-writing time, current `main` is:

```text
fa46cdbea4cf988623a71b81d44f1e8830f8aa92
```

This includes:

```text
PR #65 — MOVE1A
PR #78 — PHYSICS1
PR #79 — Modular folder strips/direct edges
```

PR #78 merged as:

```text
db2e38f7011fd72032a98caac5a51342123704ba
```

Before implementation:

1. sync the latest `main`;
2. inspect all newer merged/open PRs;
3. use current code over this prompt if contracts evolved;
4. preserve unrelated worktrees, branches, untracked files, and user-owned `AGENTS.md` changes;
5. do not disturb concurrent Hierarchy work.

---

# Existing source-of-truth contracts

## MOVE1A

MOVE1A established:

```text
Move ≠ Pin
```

and:

```text
displayed position P = dynamic position D + applied fixed Place translation T

temporary simulation target C = desired displayed target Ptarget - T
```

It already owns:

- 3 px viewport drag threshold;
- idle / primed / dragging gesture states;
- pointer grab offset;
- session/simulation/coordinate generations;
- monotonic command sequences;
- requestAnimationFrame coalescing;
- trailing-click suppression after a real drag;
- All and Focus session integration seams;
- canonical File-only eligibility;
- Arrange Folders mutual exclusion;
- lifecycle cancellation;
- `TemporaryNodeConstraintPort`.

Do not replace these with new pointer code.

## PHYSICS1

PHYSICS1 established the lifecycle:

```text
sleeping
→ hot-constrained
→ cooling
→ sleeping

or

→ failed
```

It already provides:

```text
NetworkPhysicsServiceFactory
NetworkPhysicsService
createNetworkPhysicsWorkerService(...)
createAllNetworkPhysicsSeed(...)
createFocusNetworkPhysicsSeed(...)
```

The browser client:

- stores the seed without creating a Worker;
- creates the Worker only on the first valid `begin`;
- sends hard constraint begin/update/end commands;
- coalesces worker frames to the latest animation frame;
- rejects stale generations/sequences/frames;
- performs no work while sleeping;
- invalidates/disposes explicitly.

Do not add another worker.

## Dormant canvas wiring

Both lazy production Network views already supply:

```text
physicsServiceFactory={createNetworkPhysicsWorkerService}
```

Both Sigma canvases already expose:

```text
temporaryConstraintActive?: boolean
```

whose default is `false`.

When activated, the canvases already:

- create/initialize the correct All or Focus physics seed;
- pass the real service to `setTemporaryFileMoveContext(...)`;
- apply immediate constrained-node feedback;
- adopt whole-graph PHYSICS1 frames;
- keep camera writes out of frame adoption;
- keep All Place translations outside the worker;
- invalidate on semantic changes.

MOVE1B should mainly activate and expose this existing path.

## Dormant product editing state

`apps/web/src/network-editing.ts` already defines:

```ts
NetworkEditingTool = 'move-file' | 'arrange-folder'

NetworkEditingState =
  | { phase: 'off' }
  | { phase: 'editing'; tool: NetworkEditingTool }
```

and a reducer for:

```text
enter
switch-tool
exit
leave-network
workspace-changed
```

Use it.

Do not create a second editing state machine.

---

# Required first inspection

Read current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/PHYSICS1_CONTINUOUS_SIMULATION.md

docs/decisions/0019-temporary-file-movement-contract.md
docs/decisions/0023-continuous-network-public-forceatlas2-lifecycle.md

apps/web/src/network-editing.ts
apps/web/src/network-editing.test.ts

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/ExplorationControls.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/LocalGraphView.tsx
apps/web/src/spatial-overrides/arrangement.ts

apps/web/src/workers/network-physics-worker-client.ts
apps/web/src/workers/network-physics.worker.ts

packages/renderer-sigma/src/file-move.ts
packages/renderer-sigma/src/temporary-node-constraint.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/physics/*
packages/renderer-sigma/src/styles.css

packages/spatial-overrides/README.md
packages/spatial-overrides/src/geometry.ts
packages/spatial-overrides/src/resolution.ts
```

Also inspect the current production folder editor introduced by SPATIAL2B. Its Pull/Place/scope behavior must remain intact.

---

# Product model

## Primary control

Add a compact pencil control to the graph workspace:

```text
✎ Edit Network
```

It is available only when:

```text
Layout = Network
```

Do not show it as an active feature in Hierarchy.

Use an icon plus accessible label/tooltip. Do not rely on the icon alone.

Recommended accessible name:

```text
Edit Network layout
```

## Editing toolbar

When active, reveal a compact editing toolbar:

```text
Edit Network

[ Move Files ] [ Arrange Folders ] [ Done ]
```

Availability:

```text
All + Network
→ Move Files
→ Arrange Folders

Focus + Network
→ Move Files only
```

`Move Files` is the default tool when editing starts.

Do not expose a tool that cannot operate in the current scope.

A disabled Arrange Folders entry in Focus is acceptable only if it provides a useful reason. Hiding it is also acceptable if that is clearer.

## Semantic distinction

Keep the difference explicit but compact:

```text
Move Files
→ temporary physical movement
→ release lets graph settle
→ not saved

Arrange Folders
→ edits saved Pull/Place folder rules
```

Use tooltip/help text or one concise toolbar description. Do not add a large permanent explanation.

---

# Editing-state integration

Use `reduceNetworkEditing(...)` as the application-level source of truth.

A conceptual state mapping:

```text
editing off
→ temporaryConstraintActive = false
→ folder arrangement inactive

tool = move-file
→ temporaryConstraintActive = true
→ folder arrangement inactive

tool = arrange-folder
→ temporaryConstraintActive = false
→ existing folder arrangement/editor active
```

Never permit both tools to own node input simultaneously.

When `NetworkEditingTransition.clearActiveGesture` is true:

1. end/cancel the active renderer gesture;
2. clear its transient preview;
3. only then adopt the new tool state.

Use existing imperative renderer/session cancellation rather than waiting for a React remount where possible.

---

# Entry behavior

## From All + Network

Pressing the pencil control should enter:

```text
editing / move-file
```

No layout request, projection, history checkpoint, or persistence write should occur merely from entering editing mode.

## From Focus + Network

Pressing the pencil control should also enter:

```text
editing / move-file
```

using the current Focus projection and PHYSICS1 Focus seed.

## From Hierarchy

The editing control is unavailable or hidden.

Switching Network → Hierarchy must:

```text
end active temporary constraint
exit editing
dispose/invalidate PHYSICS1 as current canvas lifecycle requires
leave no stale pressed state
```

Do not carry editing invisibly into Hierarchy.

---

# Scope transitions

## Move Files active

All ↔ Focus while still using Network may preserve the selected editing tool:

```text
All + Network / Move Files
→ Focus + Network / Move Files
```

but the old gesture and old simulation generation must be invalidated before the new scope activates.

No dragged position transfers between scopes.

The new scope starts from its own accepted Network coordinates.

## Arrange Folders active

Arrange Folders is All-only.

If scope changes All → Focus while this tool is active:

```text
cancel unfinished folder gesture/editor safely
exit editing
```

Do not silently reinterpret it as Move Files.

## Workspace/source change

Always:

```text
cancel active gesture
exit editing
clear transient editing status
```

## Maximized mode

Maximize/restore should preserve the active tool when the same Network renderer remains mounted, but must not preserve an active pointer gesture across a remount.

---

# Core Move interaction

In `move-file` tool:

```text
pointer down on canonical File
→ prime existing MOVE1A coordinator

movement < 3 px
→ remains ordinary click-compatible

movement ≥ 3 px
→ begin PHYSICS1 hard constraint
→ File follows pointer exactly
→ whole graph reacts

pointer move
→ MOVE1A rAF-coalesced constraint updates

pointer release
→ flush latest update
→ send end(reason='released')
→ PHYSICS1 cooling
→ eventually sleeping
```

Do not save a coordinate.

Do not create a spatial rule.

Do not mutate view history.

Do not write to any persistence registry.

---

# Eligible nodes

Both Network modes:

```text
File / document
→ movable
```

Not movable:

```text
Heading
Block
diagnostic target
folder strip/background
edge
```

Focus Network keeps non-File nodes in the physics simulation so they can react, but only canonical File nodes can receive the hard constraint.

Modular/Classic Hierarchy remains entirely unrelated.

---

# Pointer behavior

## Cursor

When Move Files is active:

```text
eligible File hover
→ grab cursor

active File drag
→ grabbing cursor
```

Stage remains a normal pan surface.

Do not apply grab cursor to every graph element.

## Immediate feedback

The constrained File must visually follow the pointer immediately using the existing `onConstraint` adoption path, without waiting for a worker frame.

Other nodes react when PHYSICS1 frames arrive.

## Whole-graph reaction

Preserve PHYSICS1's accepted policy:

```text
All
→ whole current All Network graph reacts

Focus
→ whole current Focus Network graph reacts
```

Do not silently switch to neighborhood-only physics for large graphs.

Do not change physics parameters in MOVE1B.

---

# Click, reveal, Focus and context-menu arbitration

Current Network interaction includes:

```text
immediate selection
confirmed single-click Network Explorer reveal
double-click Focus
right-click File actions
stage pan
wheel/pinch
folder editing
```

Preserve MOVE1A policy.

## Below drag threshold

A pointer down/up that never crosses 3 px remains a normal click:

- selection works;
- confirmed sidebar reveal works;
- double-click Focus remains possible;
- right-click actions remain possible.

## After drag threshold

A real File drag must:

- cancel pending confirmed-click reveal;
- suppress trailing click;
- suppress double-click Focus;
- suppress context-menu activation from the same gesture;
- prevent Sigma stage pan from owning the same pointer;
- prevent folder arrangement from starting;
- prevent accidental selection recentering.

## Stage drag

When no eligible File owns the pointer:

```text
stage drag
→ pan normally
```

## Wheel/pinch during drag

Use the established MOVE1A/session policy.

Do not invent simultaneous camera zoom and File dragging unless already supported and tested. It is acceptable to suppress wheel/pinch while a File owns the pointer.

---

# Folder Pull and Place behavior

## Pull

For a File with a winning Pull rule:

```text
during drag
→ hard File constraint wins for that File
→ Pull continues affecting its group and connected nonmembers

release
→ hard constraint removed
→ Pull affects the File again
→ graph cools
```

Do not change Pull strength, cadence normalization, convergence, membership, or scope semantics.

## Place

All PHYSICS1 works in pre-Place dynamic coordinates.

The canvas already:

1. indexes current winning fixed translations;
2. lets MOVE1A subtract the dragged File's applied translation exactly once;
3. sends the dynamic target to PHYSICS1;
4. reapplies the same Place translation to every displayed frame.

Do not move Place into the worker.

Do not invert it twice.

Do not rewrite the folder rule while moving a File.

## Fixed placed folder and temporary File move

Temporary File movement does not mean persistent separation from its placed folder.

During the gesture the File follows the pointer under the accepted MOVE1A/PHYSICS1 composition.

After release, automatic physics and the existing Place layer remain authoritative.

No individual offset is stored.

---

# Integration with Arrange Folders

The existing production folder rule editor is not replaced.

The new Edit Network shell should adopt it as the:

```text
Arrange Folders
```

tool.

Existing entry points from Network Explorer folder rows must continue to work.

If a folder-row action starts editing while editing is off:

```text
enter Edit Network
→ select arrange-folder tool
→ activate the existing folder editor
```

If Move Files is active:

```text
switch to arrange-folder
→ cancel active/pending File gesture
→ invalidate/stop temporary physics
→ activate folder editor
```

If folder editing is active:

```text
switch to move-file
→ cancel dirty transient folder drag safely
```

Do not discard a dirty folder rule draft without the current editor's existing confirmation/guard behavior.

Preserve:

- Pull/Place selection;
- exact/subtree/custom scope;
- exclusions;
- target marker;
- strength;
- write-before-adopt persistence;
- keyboard nudging;
- reset/recovery;
- folder strips;
- most-specific rule semantics.

---

# Physics lifecycle feedback

Expose coarse PHYSICS1 lifecycle state to the editing UI.

Recommended user-visible states:

```text
Ready to move
Moving…
Settling…
Move unavailable
Move failed
```

Mapping:

```text
sleeping
→ Ready to move, or no persistent status

hot-constrained
→ Moving…

cooling
→ Settling…

failed
→ explicit error + recovery action

disposed
→ no editing status
```

Do not update React state for every physics frame.

Only lifecycle transitions belong in React/UI.

Use an `aria-live="polite"` status for Moving/Settling/Settled changes.

A successful sleeping state should disappear after a short announcement or remain as a quiet status; do not permanently occupy significant canvas space.

---

# Availability

The user may activate Move Files while Network layout is still preparing.

Do not allow a silent no-op.

Either:

## Preferred

Keep editing selected but show:

```text
Waiting for Network layout…
```

and make File dragging unavailable until the existing canvas context becomes available.

Then activate automatically when ready.

or:

## Acceptable

Disable Move Files until ready with a clear reason.

Capability reasons already include:

```text
simulation-unavailable
simulation-not-running
unsupported-view
```

Surface a concise product explanation rather than raw internal terms.

---

# Failure handling

PHYSICS1 failures include:

```text
invalid-command
max-iterations
max-wall-time
simulation-error
```

Required product behavior:

- retain the last valid visible graph;
- end any active drag;
- clear grab/grabbing state;
- do not crash or blank Network;
- show a concise error;
- allow the user to retry Move mode or turn editing off;
- do not claim the graph settled after a failure.

A simple recovery may be:

```text
Retry movement
→ reinitialize from current accepted visible positions
```

or:

```text
turn Move Files off and on
```

but provide an explicit usable path.

Do not trigger a full vault rescan for a physics failure.

Do not mutate folder rules.

---

# Cooling behavior

On normal release:

```text
File is no longer constrained
→ graph continues moving
→ cooling criteria decide when to sleep
```

Do not freeze the File where it was released.

Do not restore the pre-drag layout.

Do not persist the final cooled positions.

Do not restart the ordinary finite layout worker at release.

PHYSICS1 owns:

- iteration cadence;
- convergence checks;
- caps;
- wall-time;
- sleeping.

MOVE1B only displays lifecycle and activates the existing adapter.

---

# Beginning another drag while cooling

Allow:

```text
cooling
→ user begins another File drag
→ same current simulation becomes hot-constrained
```

Do not force the user to wait for sleeping.

The new constraint must supersede the cooling lifecycle through the existing PHYSICS1 service, not by creating a second physics Worker.

Only one active File constraint at a time.

---

# Exiting Move mode

## No active gesture, sleeping

Exit immediately.

## Active drag

```text
end/cancel constraint with reason='mode-exit'
→ clear pointer ownership
→ exit
```

## Cooling

Exiting may invalidate/dispose the temporary simulation immediately.

The last adopted frame may remain visible until another accepted layout/view transition replaces it.

Do not claim that exiting rolls back movement.

Do not write the final frame to the ordinary layout cache.

---

# Camera behavior

PHYSICS1 frame adoption is camera-neutral.

Preserve that.

During File movement/cooling:

- no automatic Fit;
- no density reframe;
- no camera centering;
- no semantic viewport rewrite per frame;
- manual pan/zoom ownership stays respected;
- selected/root screen anchoring is not repeatedly reapplied.

Do not modify PR #74's camera-neutral geometry-adoption contract.

Do not modify the density-framing experiments from PR #60 unless current `main` later integrates them and a narrow compatibility fix is necessary.

---

# Spatial/cache ownership

Continuous Move frames are transient runtime physics.

They must not enter:

```text
GlobalLayoutCache
LocalLayoutCache
GlobalSpatialInfluenceCache
SpatialOverrideRegistry
PresentationOverrideRegistry
KG9 view state
navigation history
Saved Queries
Visual Groups
source files
```

Normal browsing still uses the finite accepted layout workers and caches.

When a Network renderer remounts, it may return to the ordinary accepted/cached layout because Move is not Pin.

Document this clearly.

---

# Visual presentation during editing

Use restrained visual feedback.

When Move Files is active:

- eligible Files may receive a subtle move-eligible cursor/outline on hover;
- the actively constrained File should be clearly distinguished;
- unrelated nodes should retain normal Visual Group colors and hover semantics;
- do not fade the entire graph merely because editing is active;
- do not use color alone to communicate active drag.

Folder arrangement keeps its own spotlight/strip semantics.

Do not invent a permanent pin marker.

---

# Keyboard-accessible File movement

The Network graph canvas is visual/aria-hidden, so Move must not be pointer-only.

Add an accessible path through Network Explorer for canonical File rows.

Recommended File action:

```text
Move File
```

Behavior:

1. activates Edit Network → Move Files if needed;
2. selects the logical target without unintended recenter loops;
3. opens a compact keyboard movement controller.

Suggested controller:

```text
Move <File>

Arrow keys       move
Shift + Arrow    larger move
Enter / Space    release and settle
Escape           release/cancel and close
```

Use viewport-relative steps so keyboard movement feels consistent across zoom:

```text
normal step: approximately 8 px
large step: approximately 32 px
```

Exact values may be tuned after QA.

The keyboard path must use the same MOVE1A constraint commands and PHYSICS1 service as pointer dragging.

Do not mutate Sigma coordinates through a separate keyboard-only path.

Important semantic copy:

```text
Release and settle
```

not:

```text
Save position
```

because nothing is persisted.

Escape ends the temporary constraint; it cannot promise to restore every other node's earlier physical coordinates.

If keyboard movement would materially destabilize the current action-menu architecture, implement a dedicated accessible controller in the Network Explorer drawer rather than a canvas-only workaround.

---

# Editing keyboard behavior

The editing toolbar itself must be keyboard accessible.

Recommended:

```text
Enter/Space on pencil
→ enter editing

Tab
→ Move Files / Arrange Folders / Done

Escape while active drag/controller
→ end current gesture, remain in editing

Escape while idle editing
→ exit editing
```

Do not steal Escape from an open File action menu or folder editor before that nested surface handles it.

Use the existing graph-history shortcut exclusion conventions for editable controls.

---

# Network Explorer integration

Keep current virtualization bounded.

Add only the minimum row/action metadata needed.

Requirements:

- `Move File` only for canonical File rows;
- no Move action for Heading/Block/diagnostic/folder rows;
- menu state survives ordinary virtual-row logic safely;
- scrolling away closes or safely relocates the keyboard controller;
- no hidden menu per row;
- current selection/reveal behavior remains edge-triggered;
- action does not create duplicate center requests;
- Hide, Inspect, Focus and Size remain intact.

If the File disappears due to QUERY1/live update while moving:

```text
end constraint
close controller
announce removal
```

Do not fuzzy-remap.

---

# All + Network behavior

Wire:

```text
networkEditing.tool === 'move-file'
→ GlobalGraphView temporaryConstraintActive = true
```

The real `createNetworkPhysicsWorkerService` factory is already supplied by the lazy view.

All seed must remain:

```text
latest dynamic positions
+ resolved Pull attractors
before fixed Place
```

All frame display remains:

```text
physics dynamic frame
+ captured fixed Place translations
```

Test:

- no spatial rules;
- Pull;
- competing Pulls;
- Place;
- Pull parent / Place child;
- Place parent / Pull child;
- hidden/query-filtered nodes;
- isolates;
- cross-folder links.

Do not alter static Pull convergence in this milestone.

---

# Focus + Network behavior

Wire:

```text
networkEditing.tool === 'move-file'
→ LocalGraphView temporaryConstraintActive = true
```

Focus seed remains the latest accepted Local Network positions.

Only documents are movable.

Headings, Blocks and diagnostics remain physically reactive but not constraint eligible.

Test:

- root File drag;
- neighbor File drag;
- depth changes;
- reroot;
- Network ↔ Hierarchy;
- Back/Forward;
- query reroot;
- root deletion.

Do not persist any Focus-specific position profile.

---

# Hierarchy behavior

No Move mode in:

```text
All + Hierarchy
Focus + Hierarchy
Classic
Modular
```

Switching to Hierarchy exits editing and cancels current physics.

Do not add drag/pin behavior to React Flow.

Do not alter Modular folder strips or Direct/Electronic connection rendering from PR #79.

---

# Source/live-update behavior

During a live vault update:

## Unrelated content change preserving topology generation

Follow the current canvas invalidation policy.

Do not try to keep a gesture alive unless existing generation contracts prove it safe.

## Dragged File edited/renamed/moved/deleted

Conservatively:

```text
end active constraint
clear editing gesture
reinitialize capability for the new accepted snapshot
```

If stable identity survives, the user may move it again; do not carry the active pointer gesture across the update.

## Source switch/rescan/replacement vault

Exit editing.

Do not let old worker frames affect the new workspace.

---

# Persistence and history

Editing state is transient.

Do not persist:

```text
Edit Network on/off
selected editing tool
active gesture
physics lifecycle
cooled coordinates
keyboard move target
```

Do not add to:

```text
view-state schema v3
Graph Preferences
Saved Views
SpatialOverrideRegistry
PresentationOverrideRegistry
```

Do not add graph navigation checkpoints for:

- enter/exit editing;
- begin/update/release File movement;
- physics cooling frames.

Back/Forward remains semantic navigation only.

---

# Performance and scale

PHYSICS1 intentionally preserves whole-graph reaction.

Existing evidence shows lower frame cadence at larger sizes.

MOVE1B must measure and report actual production interaction at:

```text
small:  ~100 nodes
medium: ~500 nodes
large:  ~1,000 nodes
stress: ~5,000 nodes
```

Measure:

- first-drag lazy Worker startup;
- pointer-to-immediate File preview;
- worker-frame cadence;
- main-thread frame adoption;
- input responsiveness;
- release-to-sleep duration;
- cancellation latency;
- memory/worker disposal where practical.

Do not silently change semantics based on node count.

Do not introduce neighborhood-only physics.

Do not add a production size cutoff without explicit evidence and user approval.

If native 5,000-node interaction is poor, report it as a scale limitation and keep the PR draft rather than redesigning PHYSICS1 inside MOVE1B.

---

# Operation-count requirements

## Enter editing

```text
0 KG6 projections
0 finite layout requests
0 physics Worker creation
0 persistence writes
```

The PHYSICS service object may exist, but the Worker remains lazy.

## Cross drag threshold

```text
1 begin command
1 lazy Worker creation if not already retained
0 base layout requests
0 static spatial-influence requests
0 history writes
0 persistence writes
```

## Pointer updates

```text
MOVE1A rAF-coalesced updates
no React render per raw pointer event
no new Worker per event
no finite ForceAtlas2 job per event
```

## Worker frames

```text
imperative x/y adoption
camera-neutral
no layout-cache writes
no dynamic-cache writes
no persistence
```

## Release

```text
1 end command
cooling continues in same Worker
no ordinary relayout
no pin/save
```

## Sleeping

```text
0 timers
0 ForceAtlas2 work
Worker may remain retained for another drag
```

---

# Error and stale-work tests

Cover:

- malformed/failed Worker;
- max iterations;
- max wall time;
- stale simulation generation;
- stale gesture sequence;
- stale frame sequence;
- node-set mismatch;
- tool switch during drag;
- scope switch during drag;
- Network → Hierarchy;
- workspace replacement;
- QUERY1 hides dragged File;
- live deletion;
- browser blur;
- visibility hidden;
- pointer loss;
- canvas disposal;
- rapid enter/exit;
- new drag during cooling.

Every case must leave:

```text
no stuck grab cursor
no active stale constraint
no stale frame adoption
no false "settled" success
```

---

# Automated tests

## Product editing state

Test:

- pencil enters Move Files;
- Move Files is default;
- Done exits;
- tool switch uses `clearActiveGesture`;
- All/Focus availability;
- Network→Hierarchy exits;
- workspace change exits;
- All→Focus preserves Move Files only after old gesture invalidation;
- Arrange→Focus exits;
- no persistence/history.

## Canvas activation

Test:

```text
temporaryConstraintActive=false
→ no physics Worker is constructed during normal browsing

temporaryConstraintActive=true
→ capability initializes when accepted layout is ready
```

Worker must still remain lazy until the first `begin`.

## Pointer All

Use the real canvas/session path with a controlled PHYSICS transport:

- below threshold remains click;
- above threshold creates begin;
- File follows pointer immediately;
- neighbor frame changes;
- release sends end;
- cooling frames apply;
- sleeping stops work;
- no camera/cache/persistence changes.

## Pointer Focus

Equivalent coverage for:

- root File;
- neighbor File;
- Heading/Block rejected.

## Pull / Place

Test exact display-to-dynamic target and frame recomposition.

Ensure Pull is still active in worker simulation and Place is never sent into physics.

## Interaction conflicts

Test:

- no trailing sidebar reveal after drag;
- no double-click Focus after drag;
- stage pan remains;
- right-click actions remain below threshold;
- folder tool and File tool exclude each other;
- wheel/pinch policy is consistent.

## Keyboard

Test:

- File action availability;
- arrow/Shift-arrow constraint updates;
- Enter/Space release;
- Escape release;
- virtualized row loss;
- inaccessible node kinds excluded;
- same physics path as pointer.

## Failure

Test visible recovery and last-valid-graph retention.

## Lifecycle

Test:

```text
sleeping → hot → cooling → sleeping
cooling → hot on new drag
dragging → failed
editing exit → disposed/inactive
```

Do not assert internal iteration details outside PHYSICS1's own tests.

---

# Browser QA

Use production browser build with synthetic fixtures.

Required scenarios:

## All, no folder rules

```text
enter Edit Network
drag isolated File
connected nodes react according to physics
release
cool to sleep
```

## All + Pull

Move Pull member and nonmember.

## All + Place

Move a File with applied Place translation and verify no pointer jump/double translation.

## Tool switching

```text
Move Files ↔ Arrange Folders
```

with dirty folder editor safeguards.

## Focus

Move root and neighbor Files.

## Accessibility

Network Explorer keyboard move.

## Interaction

- click;
- confirmed reveal;
- double-click Focus;
- right-click Size/Hide/Inspect;
- stage pan;
- wheel;
- pinch;
- maximize;
- short window.

No console errors/warnings in the normal path.

---

# Native release QA — mandatory merge gate

Build a fresh optimized Windows executable.

Do not merge before explicit user acceptance.

Test with a synthetic vault and a real larger vault where privacy rules permit.

## Pointer behavior

1. Enter Edit Network through pencil control.
2. Slowly drag a File.
3. Drag rapidly.
4. Release and observe cooling.
5. Begin another drag while cooling.
6. Exit editing while cooling.
7. Verify ordinary click/double-click after exit.

## All Network

Test:

- isolate;
- chain;
- hub;
- Pull;
- Place;
- nested Pull/Place rules;
- folder tool switch;
- Hide/show;
- Size override;
- Visual Group.

## Focus Network

Test:

- root;
- neighbor;
- Heading/Block ineligible;
- depth change;
- reroot;
- Back/Forward.

## Input hardware

Test physical:

- mouse;
- precision touchpad two-finger pan;
- pinch zoom;
- wheel;
- drag under different zoom ratios.

## Lifecycle

Confirm:

```text
worker lazy before first drag
Moving status
Settling status
sleeping/no ongoing movement
failure does not blank graph
```

## Live update

Rename/delete a dragged File and verify safe cancellation.

## Scale

Check practical interaction at:

```text
~100
~500
~1,000
and, if available, ~5,000 visible nodes
```

Do not claim unperformed native rows as passed.

---

# UI styling

Use current product styles.

Suggested layout:

```text
graph toolbar
└─ pencil icon button

editing active
└─ compact floating/toolbar strip
   ├─ Move Files
   ├─ Arrange Folders (All only)
   ├─ status: Moving / Settling
   └─ Done
```

Requirements:

- no horizontal overflow;
- works in maximized mode;
- works at short height;
- minimum practical hit targets;
- reduced-motion safe;
- clear pressed/selected state;
- no giant development panel;
- no PHYSICS1 raw diagnostics in normal product UI.

The existing development lab remains development-only.

---

# Architecture changes expected

Likely application areas:

```text
apps/web/src/network-editing.ts
apps/web/src/network-editing.test.ts

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/ExplorationControls.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/LocalGraphView.tsx
apps/web/src/App.css

packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/LocalGraphCanvas.tsx
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/file-move.ts
packages/renderer-sigma/src/styles.css
```

Avoid changes to the physics solver unless a narrow integration defect is proven.

No new external dependency is expected.

---

# Explicit non-scope

Do not implement:

```text
PIN1
persistent individual positions
Pin here / Unpin
saved File coordinates
individual spatial anchors
folder/member pin composition
Saved Views
Adaptive Layout
Hierarchy dragging
React Flow pinning
new collision/no-overlap physics
node-size-aware ForceAtlas2
neighborhood-only simulation
new Pull convergence
new Place semantics
another physics Worker
new simulation engine
ForceAtlas2 fork
source writes
```

Do not use pointer release as implicit save.

---

# Documentation

Update:

```text
apps/web/README.md
apps/web/src/components/README.md
packages/renderer-sigma/README.md
packages/renderer-sigma/src/physics/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/PHYSICS1_CONTINUOUS_SIMULATION.md
docs/ROADMAP.md
```

Add a concise ADR using the next available number if warranted.

Record:

1. production Network editing shell;
2. Move Files temporary semantics;
3. Arrange Folders persistent semantics;
4. All and Focus support;
5. lifecycle feedback;
6. accessible keyboard path;
7. lazy Worker activation;
8. no persistence/history/cache ownership;
9. release/cooling behavior;
10. scale evidence/limitations;
11. PIN1 remains separate.

Archive this prompt under:

```text
history-implementations/
```

Roadmap after acceptance:

```text
MOVE1A   Complete
PHYSICS1 Complete
MOVE1B   Complete
PIN1     Later
```

Do not begin PIN1 automatically.

---

# Suggested implementation sequence

1. Sync current `main` after PR #79.
2. Inspect new/open PRs and current Arrange Folders UI.
3. Add GraphExplorer-owned `NetworkEditingState`.
4. Add pencil/Edit Network control and compact tool strip.
5. Route existing folder entry points through `arrange-folder`.
6. Pass `temporaryConstraintActive` to All and Focus Network.
7. Add coarse capability/lifecycle callbacks.
8. Add Move Files cursor/active styling.
9. Add explicit tool-switch/exit cancellation ordering.
10. Add Network Explorer keyboard Move action/controller.
11. Add failure/retry behavior.
12. Add product state/canvas/session tests.
13. Add All Pull/Place integration tests.
14. Add Focus integration tests.
15. Add operation-count and lazy-worker tests.
16. Run browser QA.
17. Run scale benchmarks.
18. Build optimized desktop executable.
19. Run/hand off mandatory native QA.
20. Keep PR draft until explicit approval.
21. After approval, update from current main and rerun full validation.
22. Merge, verify post-merge CI, and clean only this task's branch/worktree.
23. Stop; do not start PIN1.

---

# Validation commands

Use current commands from `AGENTS.md`.

Expected:

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

Add focused product integration/keyboard tests under the current package/app conventions.

No flaky timing thresholds in CI.

---

# Exit gate

MOVE1B is complete only when:

1. a visible pencil/Edit Network control exists;
2. it is available only in Network layout;
3. Move Files is the default editing tool;
4. All exposes Move Files and Arrange Folders;
5. Focus exposes Move Files;
6. existing Arrange Folders behavior remains intact;
7. folder-row entry activates the shared editing model;
8. Move Files activates existing `temporaryConstraintActive`;
9. normal browsing leaves that capability inactive;
10. entering editing creates no Worker;
11. first real drag lazily creates one PHYSICS1 Worker;
12. one retained service owns hot/cooling/sleeping lifecycle;
13. canonical Files are draggable;
14. Headings are not draggable;
15. Blocks are not draggable;
16. diagnostics are not draggable;
17. below-threshold pointer action remains a click;
18. above-threshold action starts a hard constraint;
19. dragged File follows the pointer immediately;
20. All Network neighbors react;
21. Focus Network neighbors react;
22. release removes the constraint;
23. release starts cooling;
24. cooling ends in sleeping when stable;
25. no position is persisted;
26. no spatial File pin/anchor is created;
27. no layout cache is written from physics frames;
28. no dynamic Pull cache is written from physics frames;
29. no view/history checkpoint is created;
30. camera remains neutral during frame adoption;
31. Pull remains active and cadence-correct;
32. Place remains display-only and is inverted/applied exactly once;
33. tool switch cancels active File gesture;
34. File Move and Arrange Folders never own input together;
35. dirty folder editing retains existing guard behavior;
36. trailing click is suppressed after a drag;
37. double-click Focus is suppressed after a drag;
38. stage pan remains functional;
39. right-click File actions remain functional below threshold;
40. wheel/pinch policy is coherent during drag;
41. new drag while cooling reheats/reconstrains the same simulation;
42. Network→Hierarchy exits editing;
43. workspace/source change exits editing;
44. stale generations/frames cannot apply;
45. live deletion/hide safely ends movement;
46. failure retains the last valid graph;
47. failure has an explicit recovery path;
48. lifecycle feedback is accessible and not frame-driven React churn;
49. Network Explorer provides a keyboard-accessible Move File path;
50. keyboard movement uses the same constraint/physics path;
51. keyboard release means release-and-settle, not save;
52. editing state is not persisted;
53. PHYSICS1 tuning/convergence is unchanged;
54. current finite workers remain ordinary browsing owners;
55. no silent neighborhood-only fallback exists;
56. no new external dependency is added unless justified;
57. focused automated tests pass;
58. full `pnpm check` passes;
59. physics/file-move/renderer benchmarks pass;
60. desktop check/build pass;
61. production browser QA passes;
62. fresh optimized Windows executable is built;
63. native pointer/touchpad QA is explicitly accepted by the user;
64. PR CI passes;
65. post-merge CI passes;
66. task branch/worktree cleanup completes;
67. PIN1 is not started automatically.

---

# Final report

## 1. Summary

State the production Move capability and supported views.

## 2. Product UI

Pencil/Edit Network, Move Files, Arrange Folders, Done.

## 3. Existing-contract integration

Explain how MOVE1A and PHYSICS1 were activated without redesign.

## 4. Runtime behavior

```text
sleeping → hot → cooling → sleeping
```

## 5. Pull / Place

Confirm hard constraint, Pull reaction, and display-only Place.

## 6. Interaction arbitration

Click, reveal, double-click, stage pan, context actions, wheel/pinch.

## 7. Accessibility

Network Explorer keyboard movement and lifecycle announcements.

## 8. Persistence boundaries

Confirm no position/history/cache/source write.

## 9. Failure recovery

Last-valid graph and retry behavior.

## 10. Performance

First-drag startup, frame cadence, adoption, cooling, scale evidence.

## 11. Tests / browser / native QA

Distinguish automated, browser, and user-performed native evidence.

## 12. Files changed

## 13. Dependencies

Expected: zero.

## 14. Deviations / limitations

Especially large-graph frame cadence; do not hide it.

## 15. Roadmap

```text
MOVE1A complete
PHYSICS1 complete
MOVE1B complete
PIN1 later
```

Do not implement PIN1 automatically.
