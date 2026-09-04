# SPATIAL1B — Arrange Folders: Direct Cluster Dragging + Live Spatial Preview

**Task type:** direct manipulation / Sigma interaction mode / sparse position preview / accessible folder arrangement / persistent normalized anchors

## Goal

Turn the SPATIAL1A normalized-folder-anchor foundation into a production **Arrange folders** workflow for:

```text
Scope = All
Layout = Network
```

The primary interaction:

```text
Enter Arrange folders
        ↓
graph dims slightly
        ↓
hover a File
→ its exact folder cluster is highlighted
        ↓
drag that File
→ every visible File in the same exact folder moves live
→ connected edges follow live
        ↓
release
→ convert the target cluster center to a normalized folder anchor
→ persist before adoption
```

The saved meaning remains:

```text
this folder should be toward this relative region of the automatic graph
```

not:

```text
save these raw node coordinates
```

SPATIAL1B must consume the existing SPATIAL1A registry/session/geometry APIs. It must **not** redesign automatic layout ownership, persistence semantics, or the normalized coordinate model.

Do not begin Saved Views or individual-node movement automatically.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

SPATIAL1A merged through PR #56 at:

```text
c51688284ff69e065b734ddcfe803c8b7944185f
```

SPATIAL1A provides:

- `packages/spatial-overrides`;
- schema-v1 `allNetwork.folderAnchors`;
- exact normalized folder-path keys;
- normalized anchors bounded to `[-2, 2]`;
- logical `+x = right`, `+y = down`;
- automatic-frame calculation;
- target ↔ normalized-anchor conversion;
- rigid folder translation;
- separate automatic versus displayed positions;
- automatic ForceAtlas2 cache/worker purity;
- zero-layout anchor recomposition;
- stable/session-only/corrupt/write-failure persistence;
- production empty-registry integration;
- development harness controls.

ADR 0016 explicitly reserves SPATIAL1B for:

```text
drag + temporary-preview interaction
```

with:

```text
persisted anchors
+
temporary active-folder preview
→ displayed positions
```

The current repository also includes:

- QUERY1 / Saved Filters;
- Visual Groups;
- Network Explorer;
- Hide / Focus / Inspect actions;
- per-File Network size overrides;
- Scope = All / Focus;
- Layout = Network / Hierarchy;
- Global automatic folder clustering;
- latest-result-wins ForceAtlas2 worker;
- current Sigma click/double-click behavior.

---

# Important parallel work: SPACING1A

The user reports an unrelated SPACING1A worktree is still present.

Before editing:

1. inspect whether SPACING1A has merged or opened a PR;
2. do not modify, clean, rebase, or delete its worktree;
3. if it changes All-Network geometry/settings, rebase SPATIAL1B onto the merged result before final QA;
4. rerun anchor-scaling and drag-preview tests after any geometry change;
5. preserve its behavior unless an actual integration defect is found.

Do not merge against a stale automatic-layout implementation.

---

# Required first inspection

Read current versions of at least:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
docs/decisions/0016-normalized-folder-spatial-overrides.md

packages/spatial-overrides/*
packages/renderer-sigma/src/spatial.ts
packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/graph.ts
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/layout-cache.ts
packages/renderer-sigma/src/style.ts

apps/web/src/spatial-overrides/*
apps/web/src/persistence/spatial-overrides.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/NetworkExplorer.tsx
apps/web/src/network-explorer-model.ts
apps/web/src/network-explorer-folders.ts
apps/web/src/network-explorer-context.ts
apps/web/src/graph-workspace-overlays.ts
apps/web/src/App.css

packages/presentation-overrides/*
packages/visual-groups/*
tools/global-renderer-spike/*
```

Verify current Sigma 3.0.3 node-down / mouse-captor / pointer event APIs from the installed package types before choosing event names.

No new drag framework should be needed.

---

# Hard architecture rules

1. **All + Network only.**
2. A drag moves an exact folder cluster, never one File independently.
3. Folder membership never creates graph edges.
4. Pointer movement changes displayed positions only.
5. Pointer movement causes zero KG6 projection work.
6. Pointer movement causes zero Graphology topology reconciliation.
7. Pointer movement causes zero ForceAtlas2 work.
8. Automatic positions/cache remain unchanged.
9. Preview state is transient and never persisted.
10. Pointer release persists normalized intent before durable adoption.
11. Save failure reverts to the last confirmed positions.
12. Focus Network and both Hierarchy layouts remain unchanged.
13. No raw graph/viewport coordinates are saved.
14. No source Markdown is modified.

---

# Product entry point

Add a compact production control:

```text
Arrange folders
```

Only show it in:

```text
All + Network
```

Preferred placement:

- inside the existing All-Network canvas controls near Zoom / Fit; or
- another equally direct graph-canvas affordance that does not require opening Settings.

Do not hide the primary interaction under Advanced settings.

Use a restrained move/cluster icon plus:

```text
aria-label="Arrange folders"
title="Arrange folders"
```

When active:

```text
Arrange folders [active]
```

and expose:

```text
Done
```

or an equivalent clear exit action.

Do not expose an unfinished Arrange control when the renderer/session is unavailable.

---

# Availability

Arrange mode is available when:

- presentation is All + Network;
- the Sigma session is mounted;
- at least one visible canonical document has a valid exact folder key;
- the spatial session is editable in either durable or session-only mode;
- no corrupt/write-blocked registry prevents safe adoption.

If the automatic layout is currently pending, preferred behavior is:

```text
disable Arrange temporarily
→ "Wait for the current Network layout to finish"
```

This avoids starting a drag against an automatic frame that is about to change.

If evidence shows safe arrangement over a settled seed is straightforward, it may be allowed, but late automatic results must never invalidate an active drag silently.

---

# Arrangement visual mode

Entering Arrange should clearly change interaction context.

Use two complementary signals:

## 1. Graph emphasis

- hovered/active folder members stay visually strong;
- unrelated nodes fade;
- internal folder edges may remain strong;
- cross-folder incident edges remain visible enough to preserve context;
- unrelated edges fade more strongly;
- labels for active folder Files remain visible where density permits.

Do not change Visual Group membership or persisted colors.

Arrangement emphasis is a temporary interaction layer composed after ordinary Visual Group / selection styling.

## 2. Subtle spotlight / torch overlay

Implement a lightweight DOM/CSS overlay:

```text
slightly dim canvas
+
soft radial clear/light region around the current pointer
```

Guidelines:

- `pointer-events: none`;
- update CSS custom properties directly or at most once per animation frame;
- do not put pointer coordinates through React state on every movement;
- no WebGL shader or new dependency;
- preserve readable labels;
- respect reduced motion;
- avoid flashing/pulsing animation;
- if the radial effect reduces legibility, reduce its intensity rather than removing folder highlighting.

Keyboard arrangement may omit the pointer spotlight while retaining cluster emphasis.

---

# Exact folder semantics

Dragging any File moves all currently visible canonical documents whose:

```text
folderKey === draggedFile.folderKey
```

This means exact folder membership.

Examples:

```text
Theory/A.md
Theory/B.md
→ same cluster: "Theory"

Theory/Language/C.md
→ different cluster: "Theory/Language"
```

Dragging `Theory` does not recursively move `Theory/Language`.

The root folder key `"."` means Files directly at vault root, not every File in the vault.

Make the active folder label explicit in the UI:

```text
Folder: Theory/Language
```

Display `"."` as:

```text
Root folder
```

Do not expose internal projection IDs.

---

# Folder selection in Arrange mode

Primary pointer path:

```text
hover any document node
→ preview/highlight its exact folder

pointer down + movement on that document
→ start dragging that folder
```

Diagnostic nodes cannot initiate a folder drag.

Do not infer a folder from unresolved diagnostic nodes.

When no folder is active, display compact instruction:

```text
Drag any File to move its folder.
```

Once active:

```text
Moving: Theory/Language
```

---

# Drag mathematics

The cluster must not jump when the user grabs a File away from the folder center.

At drag start capture:

```text
start pointer point in graph space
start displayed folder center
current automatic graph frame
current committed/preview anchor map
```

For each coalesced move:

```text
pointerDelta =
currentPointerGraphPoint - startPointerGraphPoint

desiredFolderCenter =
startDisplayedFolderCenter + pointerDelta
```

Then:

```text
previewAnchor =
normalizedAnchorFromTarget(
  automaticFrame,
  desiredFolderCenter,
  SIGMA_VISUAL_DOWN_GRAPH_Y_SIGN,
)
```

Compose preview positions from:

```text
latest automatic positions
+
persisted anchors
+
active folder preview anchor
```

The active preview wins only for that folder.

Never derive the next preview from the previous displayed positions.

This prevents cumulative drift.

---

# Viewport conversion

Use the live Sigma renderer for:

```text
viewport point → graph point
```

Add the narrowest renderer/session API necessary, conceptually:

```ts
viewportToGraphPoint(point: {
  x: number;
  y: number;
}): SpatialPoint
```

Coordinates should be relative to the Sigma container.

Do not expose the Sigma instance, camera, or Graphology graph to `GraphExplorer`.

Do not save viewport points.

---

# Pointer/captor ownership

Use installed Sigma event/captor APIs.

Required interaction policy while Arrange is active:

## Node drag

```text
drag document node
→ move its folder cluster
→ prevent camera pan for that pointer
```

## Empty-stage drag

Preferred:

```text
drag empty stage
→ ordinary camera pan
```

This keeps the graph navigable during arrangement.

If Sigma makes reliable simultaneous ownership unsafe, the acceptable simpler policy is:

```text
stage drag still pans
node drag exclusively arranges
```

with explicit tests.

## Wheel / precision touchpad

When not actively dragging a cluster:

- preserve existing scroll/pinch behavior;
- preserve pointer-anchored zoom;
- preserve current fine/coarse gains.

During an active node drag, wheel/pinch may be ignored if needed to avoid changing the drag coordinate transform mid-gesture.

Document the choice.

---

# Suppress normal node actions during Arrange

While Arrange mode is active:

```text
single click
→ does not select/reveal a File as a normal graph click

double-click
→ does not enter Focus

confirmed click
→ does not scroll Network Explorer

right-click
→ does not open the normal File action menu unless explicitly supported
```

A click without meaningful drag may activate/highlight the folder, but must not trigger the ordinary click pipeline accidentally.

When Arrange exits, all normal behavior returns.

Preserve the current Sigma 300 ms confirmed-click and double-click cancellation behavior outside Arrange mode.

---

# Drag lifecycle

Use a clear state machine, conceptually:

```text
inactive

armed:
  Arrange mode active
  optional hovered/selected folder

dragging:
  pointer captured
  preview anchor active

committing:
  pointer released
  persistence transaction in progress/synchronous commit boundary

inactive/armed after result
```

Do not spread unrelated booleans through multiple components.

A source-neutral pure reducer/state machine is useful if it makes edge cases deterministic.

---

# Pointer capture and cancellation

Handle:

- pointer up outside the node;
- pointer leaving the canvas;
- `lostpointercapture`;
- window blur;
- document visibility change;
- component unmount;
- source/workspace switch;
- Scope/Layout switch;
- projection change removing the active folder;
- automatic-layout restart;
- Escape.

Policy:

## Escape while dragging

```text
cancel current preview
→ restore committed positions
→ remain in Arrange mode
```

## Escape while Arrange is active but not dragging

```text
exit Arrange mode
```

## Done

```text
exit Arrange mode
```

A canceled drag never mutates persistence.

---

# Live preview performance

Do not run full `applyFolderClusterAnchors(...)` over every visible node on every raw pointer event if the graph is large.

Add a sparse preview path.

At drag start derive:

```text
active folder member node keys
their latest automatic positions
the current target translation
```

At most once per `requestAnimationFrame`:

```text
compute one rigid translation
→ update only active folder members
→ refresh moved nodes and incident edge geometry
```

Requirements:

- one preview update per frame maximum;
- no React render per pointermove;
- no full KG6 projection;
- no automatic layout;
- no automatic layout-cache write;
- no mutation of automatic positions;
- connected edges visibly follow.

After commit/cancel, a full authoritative composition may run once.

---

# Spatial domain helper for sparse preview

Extend `packages/spatial-overrides` only with pure geometry that belongs there.

A useful helper may conceptually return:

```ts
folderTranslationFromAnchor({
  frame,
  automaticCenter,
  anchor,
  visualDownGraphYSign,
})
```

or:

```ts
translateFolderMembers(...)
```

Do not put pointer events or renderer code in the domain package.

Reuse the exact SPATIAL1A math; do not duplicate formulas in React/Sigma code.

---

# Sigma partial-position API

Add a narrow session method, conceptually:

```ts
applyPartialPositions(
  positions: readonly GlobalLayoutPosition[],
): Promise<void> | void
```

It must:

- reject unknown/duplicate keys;
- update only supplied nodes;
- use the Sigma refresh/indexation mode required for position and picking correctness;
- update connected edges visually;
- avoid changing selection/camera;
- be safe during hover/Visual Group/size overrides;
- remain development-testable.

Do not use node reducers to fake coordinates if that produces stale picking/spatial indices.

Benchmark the chosen Sigma refresh path.

---

# Authoritative commit flow

On pointer release:

1. calculate final normalized anchor from the latest pointer target;
2. stop preview input;
3. call the existing `setFolderAnchor(folderKey, anchor)` transaction;
4. if successful:
   - committed registry prop updates;
   - keep the same visible position without flicker;
   - announce `Folder position saved` or session-only equivalent;
5. if failed:
   - restore last confirmed anchor map;
   - revert displayed positions;
   - show the existing actionable persistence error.

Do not optimistically adopt a durable value before storage succeeds.

Session-only mode can adopt in memory according to existing SPATIAL1A semantics.

---

# Avoid commit flicker

A successful drag release must not briefly snap:

```text
preview
→ automatic position
→ committed position
```

Keep the preview visually active until the incoming committed anchor map contains the same value, then clear it.

Use tolerance/structural equality appropriate to normalized anchor values.

Do not keep stale preview after a different registry arrives.

---

# Reset controls

Arrange mode should provide:

```text
Reset folder
Reset all
```

## Reset folder

Available when the active folder has a committed anchor.

Uses existing `resetFolderAnchor(folderKey)`.

Immediate result:

```text
folder returns to automatic position
→ zero ForceAtlas2 layout
```

## Reset all

Use existing `resetAllFolderAnchors()`.

Require a clear accessible confirmation if more than one anchor exists.

Do not use an easy-to-misclick destructive icon without text/confirmation.

`Reset saved view` remains unrelated.

---

# Corrupt/write-failure recovery

Surface existing spatial-session state.

If registry is corrupt:

- Arrange editing disabled;
- show `Reset saved folder positions` recovery;
- use existing `recoverCorruptRegistry`;
- do not overwrite corrupt storage silently.

After write failure:

- last confirmed anchors remain visible;
- editing disabled until existing recovery policy/reopen;
- error clearly states the drag was not saved.

Do not claim success-shaped persistence.

---

# Accessible non-pointer path

Direct drag is visual/pointer interaction. Provide an accessible equivalent.

Preferred reuse of Network Explorer:

## Folder-row action

For a visible exact folder row with at least one direct visible File, expose:

```text
Arrange folder
```

through a visible-on-focus action or accessible context action.

Invoking it:

```text
enters Arrange mode
→ activates that exact folder
→ moves focus to the arrangement control panel
```

Folders with no direct visible documents cannot be arranged under schema v1; explain that rather than recursively moving descendants.

## Arrangement panel

When a folder is active, expose compact DOM controls:

```text
Folder name
Current relative position
Arrow/nudge controls
Reset folder
Done
```

Keyboard behavior:

```text
Arrow keys
→ preview small normalized movement

Shift + Arrow
→ larger movement

Enter / Save
→ commit preview

Escape
→ cancel preview
```

Recommended steps:

```text
normal: 0.02 normalized units
large:  0.10 normalized units
```

Exact values may be tuned.

Do not require a screen-reader user to interact with the WebGL canvas.

---

# Relative position text

Describe anchors without raw graph units.

Examples:

```text
Centered
35% right, 20% down
60% left, 10% up
Beyond the right edge
```

The exact wording may be simpler.

Use normalized percentages for accessibility/status.

Do not expose stored JSON or Sigma Y inversion.

---

# Network Explorer anchored indicator

Add a restrained marker for folder rows with saved anchors.

Requirements:

- visible on anchored exact folder rows;
- accessible text: `Custom folder position`;
- not confused with Visual Groups or Focus;
- no marker on parent folders that only contain anchored descendants;
- no per-File marker duplication.

This gives users a way to find/reset arranged folders later.

Do not expand every folder automatically.

---

# Folder hover from Network Explorer

Optional but valuable:

```text
hover/focus a folder row while Arrange mode is active
→ highlight the corresponding visible cluster on canvas
```

Do not center or select Files automatically.

If this requires broad cross-component churn, keep it as a small optional addition after the core drag path works.

Folder-row `Arrange folder` remains required for accessible entry.

---

# Spotlight implementation detail

A reasonable overlay:

```css
background:
  radial-gradient(
    circle 110px at var(--arrange-x) var(--arrange-y),
    rgba(..., 0) 0,
    rgba(..., 0.08) 90px,
    rgba(..., 0.35) 240px
  );
```

This is illustrative, not a mandated color.

Follow existing palette and reduced-motion conventions.

The overlay should:

- cover only graph canvas;
- not cover toolbar/popovers;
- remain pointer-transparent;
- disappear immediately on exit;
- avoid a large React update stream.

---

# Arrangement style composition

Temporary arrangement styling must compose with:

```text
base node/status style
Visual Group color
per-File size override
hover/selection state
semantic zoom LOD
```

Recommended priority:

```text
size override
→ still controls size

Visual Group
→ still controls base color/accent

Arrange active folder
→ emphasis/opacity/label visibility

unrelated nodes
→ faded, not recolored semantically
```

Do not overwrite group membership or stored presentation overrides.

---

# Automatic-layout changes during Arrange

If automatic topology/settings/layout changes while no drag is active:

- committed normalized anchors remain valid;
- new automatic frame is computed;
- anchors reapply;
- Arrange mode may remain active if the same All-Network session survives.

If a drag is active:

```text
cancel preview
→ restore/recompose committed anchors against latest automatic positions
→ announce "Graph changed; drag canceled"
```

Do not convert an old pointer delta against a new frame.

---

# Query / Hide / live update behavior

Cases:

```text
QUERY1 changes
Hide/Restore changes projection
live vault changes documents
folder path changes
```

Requirements:

- committed anchors remain in registry;
- invisible folder anchors become inactive;
- active drag cancels if membership/frame changes;
- exact folder return reactivates anchor;
- anchored marker reflects exact current registry;
- no registry pruning due filter/query;
- folder rename follows SPATIAL1A exact-path limitation.

If the active folder changes path during live update, do not migrate the anchor automatically.

---

# Folder clustering On/Off

Arrange Folders works regardless of the automatic soft folder-clustering toggle.

Pipeline remains:

```text
automatic reference/folder-prior layout
or
automatic reference-only layout
        ↓
manual normalized folder translation
```

Turning soft folder clustering Off does not remove manual anchors.

Changing folder Strength does not erase anchors.

---

# Camera behavior

Dragging a folder must not:

- fit the graph;
- recenter the camera;
- change semantic viewport persistence directly;
- trigger navigation history.

The user is editing presentation geometry inside the current camera.

Panning/zooming outside an active cluster drag keeps normal semantic viewport behavior.

Spatial edits are not Back/Forward navigation checkpoints.

---

# Selection / Inspector behavior

Entering Arrange mode should preserve existing selection and Inspector state.

Dragging a File should not select a different File merely because the pointer started there.

The active folder is separate from canonical graph selection.

Exiting Arrange returns to ordinary selection behavior.

Do not make folder anchors part of Inspector entity provenance.

A short arrangement status can show the active folder independently.

---

# No generic node movement

Do not implement:

- individual File dragging;
- Heading/Block dragging;
- pinning;
- source write-back;
- user node coordinates;
- physics constraints;
- manual edges.

Node drag in Arrange mode always means:

```text
move exact folder cluster
```

Outside Arrange mode, node drag/pointer behavior remains normal camera/selection behavior.

---

# No post-drop relaxation

After a successful commit:

```text
leave the folder exactly at its normalized target
```

Do not immediately run ForceAtlas2 and pull it away.

A later explicit Re-layout recalculates automatic geometry and reapplies the same normalized anchor.

No collision solver is required.

---

# Performance targets

Test live drag at:

```text
small All Network
medium All Network
safe ~10k-node stress if available
```

Folder sizes:

```text
1 File
10 Files
100 Files
1,000 Files if safe
```

Measure:

- pointer event → preview render;
- high RAF gap during drag;
- sparse position update;
- connected edge refresh;
- commit composition;
- persistence;
- reset;
- zero automatic-layout count.

Targets are evidence, not CI timing gates.

Prefer:

```text
one preview update per animation frame
```

and direct interaction near Class A on ordinary folder sizes.

If very large exact folders cannot stay Class A, report the scale boundary and keep the UI responsive through coalescing.

---

# Operation-count oracle

## Enter Arrange

```text
0 KG6 projections
0 topology reconciliations
0 automatic layouts
```

## Hover folder

```text
style refresh only
```

## Drag preview

```text
0 KG6
0 topology
0 automatic layout
0 automatic cache writes
1 sparse preview apply per animation frame maximum
```

## Commit

```text
1 persistence transaction
1 authoritative display composition/apply
0 automatic layouts
```

## Reset

```text
1 persistence transaction
1 authoritative display composition/apply
0 automatic layouts
```

---

# Tests — interaction state

Cover:

1. enter/exit mode;
2. File hover identifies exact folder;
3. diagnostic hover cannot activate folder;
4. node pointer down starts folder drag;
5. background pointer drag remains camera pan;
6. ordinary click is suppressed in Arrange;
7. confirmed sidebar reveal is suppressed;
8. double-click Focus is suppressed;
9. pointer release commits once;
10. Escape cancels preview;
11. second Escape/idle Escape exits;
12. pointer capture loss cancels;
13. blur/visibility cancel;
14. unmount cancel;
15. Scope/Layout switch cancel;
16. workspace switch cancel;
17. active folder removed cancel.

---

# Tests — drag geometry

Cover:

1. grabbed off-center File causes no cluster jump;
2. pointer delta becomes equal folder-center delta in graph space;
3. zoomed camera conversion remains correct;
4. panned camera conversion remains correct;
5. logical down/right remains visually down/right;
6. anchor clamps at `[-2, 2]`;
7. every folder member receives same translation;
8. internal pairwise distances remain exact;
9. diagnostics remain fixed;
10. repeated preview uses automatic base, not prior preview;
11. cancel restores committed anchor;
12. persisted anchor plus preview uses preview only for active folder;
13. other committed folder anchors remain active.

---

# Tests — sparse renderer preview

Cover:

1. only active folder node keys update;
2. unknown keys fail;
3. connected edges visually refresh;
4. picking follows moved nodes;
5. labels follow moved nodes;
6. camera remains unchanged;
7. selection remains unchanged;
8. Visual Group colors remain;
9. size overrides remain;
10. no topology/index corruption after rapid preview;
11. one scheduled preview per animation frame;
12. final full composition equals sparse preview result.

---

# Tests — persistence/UI

Cover:

1. successful release persists then adopts;
2. durable write failure reverts;
3. session-only release adopts;
4. corrupt registry disables Arrange;
5. corrupt recovery works;
6. reset folder;
7. reset all confirmation;
8. Reset saved view does not affect anchors;
9. anchored folder row indicator;
10. root-folder label;
11. exact nested-folder semantics;
12. parent folder with no direct Files is not recursively arranged;
13. reload restores arranged positions;
14. workspace A/B isolation;
15. query hide/restore reactivation;
16. folder rename limitation remains explicit.

---

# Browser QA

Production browser:

- enter Arrange from All + Network;
- hover cluster highlight;
- spotlight follows pointer;
- drag exact folder;
- edges follow;
- no node selection/reveal/Focus during drag;
- stage pan;
- wheel/pinch outside drag;
- release/save;
- reload persistence;
- Reset folder;
- Reset all confirmation;
- keyboard folder-row entry/nudge/save/cancel;
- root folder;
- nested exact folder;
- query Hide/Restore;
- Visual Group + size override composition;
- folder clustering On/Off;
- corrupt/session-only states;
- short/narrow/maximized window;
- clean console.

---

# Release Tauri QA

Use the current optimized executable.

Validate:

1. open a stable synthetic vault with several folders;
2. enter Arrange;
3. hover/drag folders with physical mouse/touchpad;
4. drag at multiple zoom levels;
5. pan/zoom when not dragging;
6. save and restart/reselect vault;
7. anchors restore;
8. live file create/delete;
9. query/filter hide and restore;
10. folder rename does not migrate anchor;
11. size/Visual Group composition;
12. write-failure/corrupt recovery if practical;
13. no CSP/worker/runtime errors.

Do not mutate the private Icarus vault for destructive QA.

---

# Privacy

Persisted data remains:

```text
workspace ID
exact workspace-relative folder key
normalized x/y
schema metadata
```

No:

- source body;
- absolute path;
- raw viewport coordinates;
- raw graph coordinates;
- node positions;
- telemetry;
- network requests.

Do not commit private folder names, anchor registries, or screenshots.

---

# Dependencies

Expected external runtime additions:

```text
zero
```

Use installed Sigma/pointer APIs and existing internal packages.

Do not add a drag, gesture, geometry, state, or animation library.

---

# ADR

Add the next available concise ADR, recording:

1. Arrange Folders is All-Network-only direct manipulation.
2. dragging any File moves its exact folder cluster.
3. active drag state is transient.
4. live preview uses automatic positions plus one preview anchor.
5. preview updates are sparse and frame-coalesced.
6. ordinary click/Focus actions are suppressed in Arrange mode.
7. pointer release persists normalized anchor before durable adoption.
8. failures revert to confirmed positions.
9. stage pan and precision zoom remain available outside active node drag.
10. the spotlight is presentation-only.
11. keyboard access uses Network Explorer + DOM controls.
12. spatial edits are not navigation history.
13. no individual-node movement/pinning is introduced.

---

# Documentation

Update at least:

```text
packages/spatial-overrides/README.md
packages/renderer-sigma/README.md
apps/web/src/spatial-overrides/README.md
apps/web/src/persistence/README.md
apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Update the development harness to use production drag/preview primitives where practical rather than keeping a separate interaction implementation.

---

# Roadmap

Preserve active KG14 status.

Record:

```text
SPATIAL1 — Complete
SPATIAL1A — normalized anchor foundation complete
SPATIAL1B — Arrange Folders interaction complete
SAVED1 — later
```

Do not start Saved Views.

Do not claim individual-node positioning exists.

---

# Scope

## In scope

- production Arrange Folders control;
- All-Network-only arrangement mode;
- exact folder hover/activation;
- cluster highlighting/fading;
- subtle pointer spotlight;
- direct folder-cluster drag;
- camera/drag ownership;
- rAF-coalesced sparse preview;
- normalized target conversion;
- persistence-before-adoption;
- commit/cancel/reset;
- Network Explorer accessible folder action;
- keyboard nudge path;
- anchored-folder indicator;
- corrupt/session/write-failure states;
- QUERY1/Hide/live-update compatibility;
- size/Visual Group compatibility;
- browser/Tauri/performance QA;
- docs/ADR/roadmap;
- prompt archive;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- individual node movement;
- node pinning;
- Heading/Block movement;
- Focus/Hierarchy overrides;
- recursive parent-folder cluster movement;
- collision avoidance;
- post-drop relaxation;
- persistent raw coordinates;
- folder rename reconciliation;
- multiple spatial profiles;
- Saved Views;
- Adaptive Layout;
- source write-back;
- analytics.

---

# Suggested implementation sequence

1. Check SPACING1A status and sync latest `main`.
2. Inspect installed Sigma interaction APIs.
3. Define pure arrangement state/reducer.
4. Add sparse folder-translation helper in `spatial-overrides`.
5. Add Sigma viewport-to-graph and partial-position APIs.
6. Add arrangement styling state/reducers.
7. Implement rAF-coalesced preview in `GlobalGraphCanvas`.
8. Implement node-drag versus stage-pan ownership.
9. Add application Arrange mode and canvas control.
10. Wire persistence commit/revert/reset.
11. Add spotlight/dim overlay.
12. Add Network Explorer folder action/anchored marker.
13. Add keyboard nudge/Save/Cancel controls.
14. Handle topology/source/layout cancellation.
15. Add operation-count/performance tests.
16. Run full focused tests and builds.
17. Production browser QA.
18. Release Tauri + physical pointer/touchpad QA.
19. Update ADR/docs/roadmap.
20. Archive prompt under `history-implementations/`.
21. PR → CI → merge → post-merge CI → cleanup.
22. Stop before SAVED1 or individual movement.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
folder drag at multiple zoom/pan states
one/10/100/1000-member preview benchmark
zero-layout drag oracle
sparse-preview/full-composition equality oracle
query hide/restore
live update during drag
write-failure revert
workspace restart restore
Visual Group + per-File size composition
browser spotlight/interaction matrix
release Tauri physical mouse/touchpad matrix
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

SPATIAL1B is complete only when:

1. Arrange Folders is visible only in All + Network.
2. Arrange is unavailable when the Sigma session is unusable.
3. corrupt/write-blocked spatial state prevents unsafe editing.
4. session-only arrangement remains possible with clear status.
5. entering Arrange causes zero KG6/topology/layout work.
6. hovered File identifies its exact folder.
7. diagnostic nodes cannot become drag targets.
8. exact-folder semantics are preserved.
9. root folder is clearly labelled.
10. dragging a File moves every visible File in that exact folder.
11. nested subfolder Files are not moved by the parent exact folder.
12. cluster does not jump when grabbed away from its center.
13. pointer movement is converted through the live camera correctly.
14. positive logical X/Y remain visually right/down.
15. preview anchor remains bounded.
16. preview always derives from latest automatic positions.
17. repeated preview produces no cumulative drift.
18. persisted anchors for other folders remain active.
19. active preview overrides only its folder.
20. preview updates are rAF-coalesced.
21. preview updates only active folder nodes.
22. connected edges follow moved nodes.
23. node picking follows moved nodes.
24. labels follow moved nodes.
25. camera remains stable during node drag.
26. stage drag still pans or the documented safe alternative passes QA.
27. precision wheel/pinch behavior remains correct outside active drag.
28. normal click/reveal is suppressed during Arrange.
29. double-click Focus is suppressed during Arrange.
30. ordinary interaction returns after exit.
31. pointer release commits one normalized anchor.
32. durable commit saves before adoption.
33. successful commit has no snap-back flicker.
34. write failure restores confirmed positions.
35. Escape cancels active drag.
36. Escape/Done exits Arrange when idle.
37. pointer-capture loss/blur/unmount cancels safely.
38. topology/layout change cancels active drag safely.
39. query/filter disappearance does not delete persisted anchor.
40. exact folder return reactivates anchor.
41. reset folder causes zero automatic layout.
42. reset all requires clear confirmation.
43. Reset saved view does not clear spatial anchors.
44. spatial edits do not create navigation history checkpoints.
45. Network Explorer exposes an accessible exact-folder arrangement path.
46. keyboard nudge/Save/Cancel works.
47. anchored folder rows have an accessible indicator.
48. spotlight/dimming remains pointer-transparent.
49. spotlight updates do not cause React render per pointer event.
50. reduced motion/contrast behavior is acceptable.
51. Visual Group styling remains intact.
52. per-File size overrides remain intact.
53. folder clustering On/Off remains independent.
54. automatic positions/cache remain uncontaminated.
55. drag causes zero ForceAtlas2 requests.
56. drag causes zero KG6 projections.
57. drag causes zero topology reconciliations.
58. small/medium preview performance is measured.
59. large-folder scale limit is reported honestly.
60. no raw coordinates are persisted.
61. no source/network behavior is added.
62. no external runtime dependency is added.
63. browser production QA passes.
64. release Tauri interaction QA passes.
65. physical mouse/touchpad QA passes.
66. existing tests remain green.
67. docs/ADR/roadmap are reconciled.
68. prompt is archived.
69. PR CI passes.
70. post-merge CI passes.
71. task branch/worktree is removed without touching SPACING1A.
72. SAVED1 and individual movement are not started automatically.

---

# Final report

## 1. Summary

What Arrange Folders now allows.

## 2. Interaction model

Entry, hover, drag, release, cancel, exit.

## 3. Visual mode

Folder emphasis and spotlight behavior.

## 4. Drag geometry

No-jump delta, viewport-to-graph conversion, normalized anchor.

## 5. Preview architecture

Automatic positions + temporary anchor, sparse rAF updates, connected edges.

## 6. Persistence transaction

Durable/session-only/corrupt/write-failure behavior.

## 7. Accessibility

Network Explorer folder action, keyboard nudge, DOM status.

## 8. Reset/recovery

Folder/reset-all and failure paths.

## 9. Compatibility

QUERY1, Hide/Restore, live updates, Visual Groups, per-File size, folder clustering.

## 10. Performance

Folder sizes, preview latency, high RAF gap, zero-layout evidence.

## 11. Tests / browser / Tauri QA

## 12. Privacy

## 13. Dependencies

Expected external additions: zero.

## 14. Files changed

## 15. ADR / roadmap

Confirm:

```text
SPATIAL1 complete
SPATIAL1A complete
SPATIAL1B complete
SAVED1 later
```

## 16. Deviations / warnings

Surface large-folder performance, Sigma refresh limitations, exact-path folder identity, no collision solving, or interaction compromises.

## 17. Future handoff

State what Saved Views or later individual movement can rely on, without implementing them:

- normalized workspace-scoped spatial registry;
- direct drag interaction;
- persistence transaction;
- automatic/display separation;
- sparse preview machinery;
- folder reset/recovery;
- no need to change canonical graph truth.

Do not start SAVED1 automatically.
