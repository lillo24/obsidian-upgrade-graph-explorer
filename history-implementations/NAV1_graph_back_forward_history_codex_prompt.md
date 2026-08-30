# NAV1 — Renderer-Independent Graph Back / Forward History

**Task type:** graph navigation architecture / transient session history / semantic viewport restoration / keyboard shortcuts / toolbar controls

## Goal

Add browser/editor-style **Back / Forward navigation history** to Icarus Graph Explorer without turning it into generic undo/redo and without storing React Flow state.

NAV1 should let the user move backward and forward through meaningful graph-view changes such as:

- entering, re-targeting, and exiting Focus;
- navigating to an entity from Search or Inspector;
- Documents ↔ Top-Level;
- expanding/collapsing an entity;
- Heading Depth changes;
- Blocks visibility;
- Path Scope;
- Documents / Sections filters;
- Reference Status filters;
- Focus Hops and Direction.

The history should restore the **renderer-independent graph view plus a semantic viewport bookmark** when available.

It should **not** record:

- hover;
- selection-only changes;
- Search typing;
- Inspector open/closed state;
- Filters/Settings/Tools open state;
- maximize/restore;
- continuous pan/zoom frames;
- manual Fit graph;
- Focus appearance preference;
- Trackpad Zoom preference;
- live-source status;
- background/live snapshot reconciliation;
- source loading progress.

Target interaction:

```text
normal mode

←  →   |  Documents  Top-Level   Filters ...             ⚙  [Inspector]
──────────────────────────────────────────────────────────────────────
                                GRAPH
```

In maximized mode, Back / Forward should remain directly reachable without opening Tools:

```text
←  →   Tools   ⚙
──────────────────────────────────────────────────────────────────────
                                GRAPH
```

Primary shortcuts:

```text
Alt+Left   → Back
Alt+Right  → Forward
```

Optional graph-context undo-style aliases:

```text
Ctrl+Z          → Back
Ctrl+Shift+Z    → Forward
```

and the platform-equivalent `Meta+Z` / `Meta+Shift+Z` may be supported where appropriate.

The critical rule:

> Back / Forward is **graph navigation history**, not generic editor undo.

Inside editable controls, normal text-editing undo must always win.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

UX4C merged through PR #26.

At prompt-writing time current `main` is:

```text
596939898c2868df27e982c1f07a21647329db1e
```

Current `GraphExplorer` owns:

```text
ViewProjectionState
selection
semantic viewport bookmark
fit request
center request
navigation announcements/errors
Inspector visibility
graph overlays
graph preferences
```

and currently computes:

```text
projectionWorkspace
activeViewState
projectView(...)
viewportBookmark
```

Current KG9 view persistence stores:

```text
structural disclosure
Focus
visible graph filters
semantic viewport bookmark
```

and explicitly does **not** store:

```text
search
selection
renderer IDs
raw viewport transforms
layouts
timestamps
```

Current semantic viewport type is:

```ts
interface PersistedViewportAnchor {
  anchorEntityId: EntityId;
  zoom: number;
}
```

This is exactly the kind of renderer-independent viewport representation NAV1 should reuse conceptually.

Current live reconciliation already provides:

```ts
reconcileCurrentWorkspaceView(
  workspace,
  state,
  viewport?
)
```

which safely drops:

- missing expanded/collapsed IDs;
- missing Focus roots;
- stale path filters;
- missing viewport anchors.

This is useful for old history entries after a live vault update.

Current `GraphExplorer` direct Focus path is:

```text
GraphCanvas onFocusEntity
→ enterFocus(entityId)
→ dispatch enter-focus
→ preserve selection on focused entity
→ fit request
```

Current entity navigation is:

```text
Search / Inspector
→ planEntityNavigation(...)
→ apply-navigation
→ select projected target
→ keyed center request at zoom 1.1
```

Current renderer owns:

```text
React Flow mapping
selection/hover presentation
Dagre worker layout
raw viewport transform
projection-ID center requests
semantic viewport observation
```

It does **not** own application navigation state.

Current `GraphCanvas` also has asynchronous KG12B2 Dagre-worker layout with latest-wins/superseded behavior. NAV1 must preserve that architecture.

---

# Required first step

Before editing:

1. sync/rebase onto the actual current `main`;
2. inspect whether any KG12/PERF/live-source work landed after this prompt;
3. read:
   - `AGENTS.md`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphFilters.tsx`;
   - `apps/web/src/components/ProvenanceInspector.tsx`;
   - `apps/web/src/graph-state.ts`;
   - `apps/web/src/navigation.ts`;
   - `apps/web/src/persistence/session.ts`;
   - `apps/web/src/persistence/storage.ts`;
   - relevant web tests;
   - `packages/view-state/README.md`;
   - `packages/view-state/src/types.ts`;
   - `packages/view-state/src/restore.ts`;
   - `packages/renderer-reactflow/README.md`;
   - `packages/renderer-reactflow/src/GraphCanvas.tsx`;
   - `packages/renderer-reactflow/src/types.ts`;
   - current App CSS for toolbar/maximized controls;
4. preserve UX4A edge-to-edge behavior;
5. preserve UX4B floating Filters + unified Inspector drawer;
6. preserve UX4C direct Focus + compact node grammar;
7. preserve KG12 instrumentation and worker-latest semantics;
8. follow repository branch/PR/CI/history-prompt conventions.

Do not assume a file/API is unchanged if newer `main` says otherwise.

---

# Core architectural decision

## History sits above KG9 view state, not inside React Flow

The history checkpoint should be renderer-independent.

Conceptually:

```ts
interface GraphHistoryCheckpoint {
  readonly state: ViewProjectionState;
  readonly viewport?: PersistedViewportAnchor;
}
```

Do **not** store:

```text
React Flow node IDs
React Flow edge IDs
x/y transforms
Dagre positions
layout generation
selection
hover
Inspector state
overlay state
focusAppearance
trackpadZoomMode
```

History should be able to survive:

```text
projection re-layout
worker layout
live snapshot changes
responsive resize
normal ↔ maximized mode
```

because it stores only semantic graph state.

---

# Where NAV1 should live

Prefer a small pure web-layer module such as:

```text
apps/web/src/navigation-history.ts
```

with focused tests.

This feature is:

- renderer-independent;
- session-transient;
- application UX policy.

It does **not** need a new workspace package.

Do not put transient history into the persisted `view-state` schema.

Do not create `packages/navigation-history` unless current repository architecture strongly demonstrates a reusable package is needed.

Expected clean ownership:

```text
view-projection
  → defines graph view state

view-state
  → defines persisted semantic view + reconciliation

navigation-history.ts
  → transient Back/Forward stack over semantic view checkpoints

GraphExplorer
  → integrates user actions, current semantic viewport, history controls

renderer-reactflow
  → remains unaware of history
```

---

# History is session-only

Do not persist history to:

```text
localStorage
Tauri app data
vault
report
KG9 saved-view record
```

On app restart or source-session remount:

```text
Back stack = empty
Forward stack = empty
```

The current graph view itself still persists normally through KG9.

---

# Suggested pure history model

A simple model is sufficient:

```ts
interface GraphNavigationHistory {
  readonly past: readonly GraphHistoryCheckpoint[];
  readonly future: readonly GraphHistoryCheckpoint[];
}
```

The current view does not have to be duplicated as a `present` entry because `GraphExplorer` already owns:

```text
activeViewState
viewportBookmark
```

A meaningful new navigation action does:

```text
current semantic checkpoint
→ push to past
→ clear future
→ apply new graph state
```

Back does:

```text
current checkpoint
→ push to future

latest past checkpoint
→ restore
```

Forward does the symmetric operation.

This model has a major advantage:

> Continuous pan/zoom can update the current semantic viewport bookmark without creating history entries; the latest bookmark is captured only when the user next performs a meaningful history action or presses Back/Forward.

---

# History capacity

Use a bounded in-memory history.

Suggested:

```text
GRAPH_NAVIGATION_HISTORY_LIMIT = 100
```

When `past` exceeds the limit, drop the oldest entries.

Do not deep-clone every `ViewProjectionState` if current reducer contracts are immutable.

Do not keep timestamps, screenshots, projections, or layouts in entries.

---

# History equality / no-op policy

Do not create duplicate checkpoints for actions that have no semantic effect.

Examples:

```text
Documents clicked while already Documents
→ no history

set Hops to current Hops
→ no history

same filter value re-applied
→ no history
```

However entity navigation is special: it may change only the semantic viewport even if `ViewProjectionState` remains identical.

Therefore checkpoint equality should compare:

```text
ViewProjectionState
+
semantic viewport
```

not state alone.

Use a deterministic pure comparison. Do not use `JSON.stringify` on arbitrary runtime objects as the main equality architecture.

Zoom comparison may use a tiny tolerance if current observations produce floating-point noise.

---

# New action after Back

Required browser-history behavior:

```text
A → B → C

Back
→ B
Forward contains C

perform new meaningful graph action D
→ B → D
Forward becomes empty
```

Do **not** clear Forward for:

```text
hover
selection
opening Inspector
opening Filters
Search typing
pan/zoom
a no-op button press
```

---

# Which graph actions create checkpoints

Treat these existing actions as history-producing when they actually change the semantic destination:

```text
toggle-entity
set-depth
set-heading-limit
set-include-blocks
enter-focus
exit-focus
set-focus-hops
set-focus-direction
set-path-scope
toggle-entity-kind
toggle-reference-status
apply-navigation
```

Keep the policy exhaustive so future `GraphStateAction` variants require an explicit history decision.

---

# Actions that must NOT create checkpoints

## `replace-state`

This is system/live reconciliation, not user navigation.

Never record it.

## `reset-view`

`Reset saved view` is a persistence/reset command, not Back/Forward navigation.

Required:

```text
Reset saved view
→ reset graph
→ clear Back
→ clear Forward
```

Do not let Back resurrect the pre-reset view.

---

# Search / Inspector entity navigation

`navigateToEntity(...)` is a history action even when it mostly changes viewport.

Before applying a successful navigation plan:

```text
capture current checkpoint
```

Destination:

```text
plan.state
+
target entity semantic viewport at zoom 1.1
```

If destination is semantically identical to the current checkpoint, do not create a duplicate entry.

Otherwise:

```text
push current → past
clear future
apply navigation
center target
```

Search typing itself remains transient and excluded.

Inspector breadcrumb/entity navigation uses the same path.

---

# Selection is not part of history

Do not store `GraphSelection` inside history entries.

Back/Forward should not reconstruct a historical selected edge/node.

Required policy:

```text
restore history checkpoint
→ keep the CURRENT selection only if that same projection element remains valid
→ otherwise clear selection
```

Do not resurrect a historical selection.

If safe preservation is awkward, clearing selection on history traversal is acceptable, but prefer “preserve if still valid”.

---

# Semantic viewport is part of history

Checkpoint viewport should use the existing semantic form:

```text
canonical anchorEntityId
+
zoom
```

Never store raw `x`, `y`, transforms, or React Flow viewport objects.

---

# Viewport updates do not create history

Normal:

```text
pan
zoom
wheel
pinch
Fit graph
```

must not add Back entries.

They only update the current `viewportBookmark`.

Then:

```text
pan somewhere
change Heading Depth
```

the pre-change checkpoint naturally captures where the user had panned.

---

# Programmatic entity centering

Current Search/Inspector navigation centers the target at zoom `1.1`.

Make the semantic viewport bookmark truthful at the same time:

```ts
{
  anchorEntityId: targetEntityId,
  zoom: 1.1
}
```

Do not wait on uncertain programmatic move-end behavior.

This improves current KG9 persistence and immediate Back/Forward behavior.

---

# Fit-producing actions and stale viewport prevention

For actions that deliberately trigger a full fit:

```text
enter/re-target Focus
exit Focus
Focus Hops change
Focus Direction change
```

clear or mark the destination semantic viewport as unknown before requesting Fit.

Then the renderer’s Fit observation establishes the new bookmark.

If the user immediately presses Back before the fit result is observed, a future checkpoint with `viewport = undefined` is safer than a stale previous-view anchor.

---

# Disclosure and viewport

Keep current renderer disclosure anchoring.

NAV1 records the pre-disclosure semantic checkpoint before dispatching toggle.

After layout/anchor restoration, normal viewport observation updates the new current bookmark.

Do not add a second disclosure anchoring mechanism.

---

# Restoring Back / Forward

Conceptually:

```text
1. choose target checkpoint
2. reconcile target against current ProjectionWorkspace
3. move current checkpoint to opposite stack
4. apply reconciled ViewProjectionState
5. request semantic viewport restore
6. announce Back/Forward
```

Use existing:

```ts
reconcileCurrentWorkspaceView(...)
```

for target state + viewport.

---

# Lazy reconciliation of old history entries

Do not eagerly rewrite every history entry on every live source update.

Instead:

```text
past/future entry
→ reconcile when traversed
```

Current view already has live reconciliation.

---

# Live-update examples

## Focus root survives

Stable ID survives → old Focus checkpoint restores.

## Focus root removed

Reconciliation clears Focus but restores remaining disclosure/filter state.

## Viewport anchor removed

Reconciliation drops anchor → target state restores → Fit.

## Stale path scope

Use existing view-state reconciliation. Do not invent replacement folders.

---

# Workspace/source identity changes

History is scoped to one workspace/source session.

If `GraphExplorer` remounts, history naturally resets.

Also add a defensive guard:

```text
workspace ID changed in-place
→ clear past/future
```

Same-workspace live updates do **not** clear history.

---

# Rapid Back / Forward with async Dagre worker

KG12B2 layout is asynchronous and latest-wins.

Required:

```text
Back
Back
Forward
```

in quick succession leaves the graph at the latest requested target.

Do not synchronously wait for layout completion before another history action.

A stale async layout or stale semantic viewport restore must never recenter after a newer traversal.

Use monotonic request keys/generations where needed.

Do not modify the Dagre worker architecture unless a real bug is found.

---

# Restoring semantic viewport after state change

History stores canonical entity anchors, while `GraphCanvas` center requests accept projection node IDs.

Keep that conversion at the application boundary.

Good direction:

```text
Back/Forward target selected
→ set pending semantic history-viewport request

state updates
→ new ViewProjection exists

effect:
  find visible projected entity whose entityId == anchorEntityId

  if found:
    set keyed GraphCenterRequest(projectedNodeId, zoom)

  if not found:
    clear pending semantic anchor
    issue Fit
```

Do not synchronously call `projectView(...)` a second time merely to locate the anchor.

---

# Hidden but still-existing viewport anchors

If the canonical anchor exists but is filtered out in the restored view:

```text
restore target state
→ anchor not found in resulting projection
→ Fit
```

This is not a fatal error.

---

# History toolbar controls

Create compact Back / Forward controls.

Preferred visible form:

```text
←  →
```

Accessible/title text:

```text
Back in graph history (Alt+Left)
Forward in graph history (Alt+Right)
```

Use native `disabled` when unavailable.

Do not add an icon dependency.

---

# Normal-mode placement

Place controls at the start of the graph toolbar, before Structure:

```text
←  →  |  Structure: Documents Top-Level  |  Filters ...
```

A grouped accessible label is enough; no large `History` text label is needed.

---

# Maximized-mode placement

In maximized mode, Back / Forward must remain directly accessible while Tools is closed.

Render the same controls in `graph-floating-controls` alongside Tools/Settings.

Do not render a second duplicate pair inside Tools at the same time.

---

# Keyboard shortcuts — primary

Support:

```text
Alt+Left  → Back
Alt+Right → Forward
```

Only consume the event when:

1. graph workspace owns keyboard context;
2. target is not editable;
3. requested direction is actually available.

If no Back entry exists, do not `preventDefault()` solely to do nothing.

This matters in browser mode because Alt+Left/Right can mean browser history.

---

# Keyboard shortcuts — Ctrl+Z aliases

Support graph-context aliases:

```text
Ctrl+Z
→ Back

Ctrl+Shift+Z
→ Forward
```

Optionally support `Meta+Z` / `Meta+Shift+Z`.

Hard rule:

> Never steal undo/redo from editable content.

Exclude at least:

```text
input
textarea
select
[contenteditable]:not([contenteditable="false"])
```

Do not use `Ctrl+Y` unless current conventions already require it.

---

# Define graph keyboard context narrowly

Avoid a permanent global `window` Ctrl+Z handler.

Prefer a workspace-scoped `onKeyDownCapture` or equivalent.

Graph history context can include:

- canvas;
- non-editable graph toolbar buttons;
- non-editable Focus controls.

Exclude:

- Search text field;
- Settings inputs;
- Source controls;
- Diagnostic Evidence dialog;
- any future editor.

Do not use pointer hover as keyboard ownership.

---

# Shortcut matching must be exact

Examples:

```text
Alt+Left
→ Back

Ctrl+Z
→ Back

Ctrl+Shift+Z
→ Forward

Ctrl+Alt+Z
→ no graph history

repeated keydown
→ preferably ignored
```

Only prevent default when an action is actually consumed.

---

# Escape behavior is unchanged

NAV1 must not interfere with existing overlay/maximized Escape precedence.

---

# Application overlays

When an application modal/dialog is open, graph history keyboard shortcuts are inactive.

History does not close dialogs.

---

# History announcements

Reuse the existing navigation live region.

Examples:

```text
Went back in graph history.
Went forward in graph history.
```

If live-source reconciliation adjusted the target:

```text
Some graph state was adjusted because the source changed.
```

Do not announce internal IDs.

---

# No generic Undo architecture

Do not implement inverse commands.

Back/Forward restores complete semantic checkpoints.

This is more robust when Focus, filters, disclosure, and navigation reveal interact.

---

# Persistence interaction

The currently displayed/restored view continues to autosave through KG9.

Example:

```text
A → B → C
Back → B
close app

restart
→ B restores
```

History stacks themselves are gone after restart.

---

# Persistence write failures

History must still work in memory if local persistence fails.

Do not disable Back/Forward because KG9 save failed.

---

# Reset saved view

`Reset saved view` clears:

```text
past
future
pending history viewport restore
```

and preserves existing reset semantics.

---

# Focus behavior

All UX4C direct Focus interaction remains.

History applies to:

- enter Focus;
- re-target Focus;
- Exit Focus;
- Hops;
- Direction.

Back immediately after Exit must naturally return to the previous Focus.

---

# Filters

These existing user actions produce history:

```text
Path Scope
Documents
Sections
Blocks
Heading Depth
Reference Status
```

Opening/closing Filters does not.

---

# Structure

Documents ↔ Top-Level produces history on actual transition.

Clicking the already-active option is a no-op and preserves Forward history.

---

# Disclosure

Every successful expand/collapse is a checkpoint.

Back/Forward restores full prior disclosure state, not an inverse toggle.

---

# Search behavior

Search query text is transient.

Clicking a result is navigation history.

Back restores graph state/viewport, not historical Search text.

Do not remount Search on Back/Forward.

---

# Inspector behavior

Inspector open/closed state is not history.

Inspector relationship/breadcrumb navigation is history.

Do not force-close Inspector during traversal.

---

# Maximize behavior

Maximize/Restore is not history.

History survives maximize/restore.

---

# Focus appearance / Trackpad Zoom

These preferences are excluded.

Back must not undo them.

---

# Live source changes are not user history

Watcher/adoption changes do not push checkpoints.

Past/future remain for same-workspace live updates and reconcile lazily when traversed.

---

# History and projection failures

If restored state produces existing projection-failure UI:

- do not crash;
- keep history coherent;
- allow opposite-direction traversal.

Do not add duplicate synchronous projection solely for rare preflight.

---

# Suggested pure history API

Illustrative:

```ts
export const GRAPH_NAVIGATION_HISTORY_LIMIT = 100;

export interface GraphHistoryCheckpoint {
  readonly state: ViewProjectionState;
  readonly viewport?: PersistedViewportAnchor;
}

export interface GraphNavigationHistory {
  readonly past: readonly GraphHistoryCheckpoint[];
  readonly future: readonly GraphHistoryCheckpoint[];
}
```

Pure helpers for:

- create empty;
- equality;
- record;
- Back;
- Forward;
- clear.

Keep them immutable and deterministic.

---

# User-action integration helper

Avoid scattering history bookkeeping through every handler.

Prefer one narrow helper in `GraphExplorer`, conceptually:

```ts
commitHistoryGraphAction(action, options?)
```

Responsibilities:

1. compute semantic next state;
2. skip no-op;
3. capture current checkpoint;
4. record current;
5. dispatch/apply next;
6. apply viewport policy;
7. run action-specific side effects.

Do not bury source/navigation logic inside the pure history module.

---

# Keep graph-state reducer pure

Do not add history arrays into `ViewProjectionState` or `graphStateReducer`.

History may use the reducer to predict next state for no-op detection.

---

# Avoid stale `viewState` vs `activeViewState`

History checkpoints must capture `activeViewState`, the reconciled state actually projected.

When computing a user-action next state, use the reconciled semantic state as the base.

A valid approach:

```text
next = graphStateReducer(activeViewState, action)

record activeViewState
dispatch replace-state(next)
```

or an equally safe method.

Do not apply user actions against stale unreconciled state.

---

# No-op detection and entity navigation

Ordinary action:

```text
current state == next state
→ no history
```

Entity navigation:

```text
current state == plan.state
but target semantic viewport differs
→ history still required
```

Compare destination checkpoint, not state alone.

---

# Pending semantic history restore

Use a keyed/generation-based request if needed.

After restored projection is current:

```text
valid visible viewport anchor
→ center

missing/hidden anchor
→ Fit
```

Consume once.

Stale pending requests must not apply after newer traversal.

---

# Selection policy on restore

History does not store selection.

After target projection is available:

```text
if current selection still exists
→ may keep

otherwise
→ clear
```

Do not allow an old hidden selection to reappear later just because a future projection makes it visible again.

---

# History controls component

A small `GraphHistoryControls.tsx` is reasonable.

Props:

```text
canGoBack
canGoForward
onBack
onForward
```

It should not know graph state, viewport, React Flow, or storage.

---

# Shortcut helper

Prefer a pure/testable shortcut classifier.

It should account for:

- key;
- modifiers;
- repeat;
- editable target;
- graph context;
- availability.

Do not hard-code complex keyboard policy inline across components.

---

# Accessibility

History buttons:

```text
aria-label="Back in graph history"
aria-label="Forward in graph history"
```

Native disabled state.

Titles include primary shortcut.

Keyboard aliases are supplemental, not the only discoverability mechanism.

Use existing live region for traversal announcements.

---

# Responsive behavior

Test at:

```text
390
600
768
1000
1440
```

The new arrow group must not reintroduce toolbar overflow.

Maximized floating controls must remain contained.

---

# Browser-specific shortcut QA

When graph Back exists:

```text
Alt+Left
→ graph Back
→ page does not navigate away
```

When graph Back does not exist:

```text
Alt+Left
→ app does not consume solely to do nothing
```

---

# Ctrl+Z text undo QA

Mandatory.

In Search/editable controls:

```text
Ctrl+Z
→ text/control undo semantics
→ graph history unchanged
```

In eligible graph context:

```text
Ctrl+Z
→ graph Back if available
```

---

# Graph navigation sequence QA

Synthetic sequence:

```text
A. Documents
B. Top-Level
C. expand entity
D. Heading Depth ##
E. double-click Focus
F. Hops 2
G. Exit Focus
```

Then:

```text
Back → F
Back → E
Back → D
Forward → E
new Path Scope action → Forward disabled
```

Verify state + viewport.

---

# Search navigation sequence QA

```text
structural graph at viewport X
Search → hidden Section A
→ reveal + center A

Back
→ original view + viewport X

Forward
→ revealed state + semantic center A
```

Search text itself is not history.

---

# Inspector navigation QA

Navigate relationship target / breadcrumb, then Back/Forward.

Inspector state itself remains independent.

---

# Focus sequence QA

Example:

```text
Focus A
Hops 2
Direction Incoming
Focus B
Exit Focus

Back
→ Focus B / Incoming / 2

Back
→ Focus A / Incoming / 2

Back
→ Focus A / Both / 2
```

Confirm checkpoint restoration, not inverse-command behavior.

---

# Pan/zoom exclusion QA

Pan/zoom repeatedly.

History count must not increase.

The latest viewport is captured only when a semantic action or Back/Forward occurs.

---

# Selection exclusion QA

Click nodes/edges repeatedly.

History availability must not change.

---

# Overlay exclusion QA

Open/close:

```text
Filters
Settings
Tools
Inspector
```

No history entries.

Maximize/Restore also excluded.

---

# Preference exclusion QA

Switch Focus appearance and Trackpad Zoom.

No history entries.

---

# Reset QA

Create history, then Reset saved view.

Expected:

```text
Back disabled
Forward disabled
```

---

# Live-update QA

Using a synthetic vault if live desktop flow is available:

1. create history with expansion + Focus;
2. edit unrelated file;
3. history remains;
4. remove entity used by old checkpoint;
5. traverse to it;
6. reconciliation safely drops stale Focus/disclosure;
7. remove viewport anchor;
8. traversal Fits;
9. no internal ID leakage.

---

# Rapid async-layout QA

During noticeable worker layout:

```text
Back
Back
Forward
```

Expected latest target wins and no stale later viewport snap.

---

# Pure history tests

At minimum:

1. empty cannot Back/Forward;
2. record pushes to past;
3. new record clears future;
4. Back moves current → future;
5. Forward symmetric;
6. immutable inputs;
7. 100-entry trim;
8. duplicate/no-op behavior;
9. viewport participates in equality;
10. state comparison includes disclosure/focus/filters/text when present;
11. checkpoint type excludes renderer/selection fields.

---

# Action-policy tests

Exhaustively cover current `GraphStateAction`.

History-producing:

```text
toggle-entity
set-depth
set-heading-limit
set-include-blocks
enter-focus
exit-focus
set-focus-hops
set-focus-direction
set-path-scope
toggle-entity-kind
toggle-reference-status
apply-navigation
```

System/reset:

```text
replace-state → no history
reset-view → clear, not record
```

---

# History restoration tests

Test:

```text
valid state + visible anchor
→ restore + center
```

```text
hidden anchor
→ restore + Fit
```

```text
missing anchor after live update
→ reconcile + Fit
```

```text
missing Focus root
→ reconcile clears Focus
```

```text
stale path scope
→ existing view-state reconciliation
```

---

# Performance posture

Do not:

- serialize whole workspace on every action;
- deep-clone snapshots;
- project solely to create history;
- run Dagre solely to create history;
- reconcile all history entries on live update.

Expected:

```text
record
→ small immutable array/reference operations

Back/Forward
→ one target reconciliation
→ normal projection/layout for restored state
```

Use current KG12 counters to confirm no duplicate projection/layout work.

---

# History memory posture

Keep state references and semantic viewport only.

Do not store:

```text
KnowledgeSnapshot
ProjectionWorkspace
ViewProjection
RendererGraph
source content
```

If memory is unexpectedly high, report it rather than building diff compression.

---

# No new dependencies

Expected external additions: zero.

Do not add undo/router/shortcut/icon/state libraries.

---

# No router/browser-history coupling

Do not use:

```text
window.history
URL routes
React Router history
```

for graph history.

Browser Back-button integration is out of scope.

---

# No canonical/domain changes

Do not change:

```text
core schema
parser
resolver
stable identity
snapshot delta
workspace engine
KG6 projection semantics
KG8 Inspector semantics
KG9 persisted-view schema
KG11 source/watch semantics
Dagre worker protocol
renderer mapping/layout semantics
```

`view-state` should usually remain unchanged.

No persisted schema bump.

---

# Suggested files

Likely areas:

```text
apps/web/src/navigation-history.ts
apps/web/src/navigation-history.test.ts
apps/web/src/components/GraphHistoryControls.tsx
apps/web/src/components/GraphExplorer.tsx
apps/web/src/App.css
apps/web/src/components/*tests*
apps/web/src/navigation.ts
apps/web/src/components/README.md
apps/web/README.md
```

Potential shortcut helper:

```text
apps/web/src/graph-history-shortcuts.ts
apps/web/src/graph-history-shortcuts.test.ts
```

Renderer changes should be unnecessary unless a narrow viewport-observation bug is proven.

---

# Scope

## In scope

- transient renderer-independent history;
- past/future stacks;
- semantic view checkpoints;
- semantic viewport bookmarks;
- 100-entry bound;
- Back/Forward arrows;
- maximized floating arrows;
- Alt shortcuts;
- guarded Ctrl/Meta-Z aliases;
- future clearing after new navigation;
- no-op dedup;
- entity navigation;
- Focus;
- Structure;
- filters;
- disclosure;
- Hops/Direction;
- semantic viewport restoration;
- live reconciliation;
- reset/source boundaries;
- async worker race protection;
- accessibility;
- tests/docs/CI.

## Explicitly out of scope

Do not implement:

- generic app undo/redo;
- text editor undo;
- command inversion;
- browser Back button integration;
- URL history;
- persisted history;
- history dropdown/list;
- named checkpoints;
- selection history;
- Search-query history;
- Inspector history;
- pan/zoom frame history;
- preference history;
- saved query/filter system;
- visual groups;
- clustering;
- layout-spacing controls.

Do not begin QUERY1/GROUP1/LAYOUT1 automatically.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Add pure history model + tests.
3. Add exhaustive action-history policy/no-op comparison.
4. Integrate semantic checkpoint capture in `GraphExplorer`.
5. Route Structure/Filters/Disclosure/Focus actions through history helper.
6. Integrate Search/Inspector navigation as state+viewport history.
7. Update programmatic entity navigation bookmark.
8. Add Back/Forward restore + lazy reconciliation.
9. Add pending semantic viewport restore → center/Fit.
10. Make restore requests latest-wins.
11. Add selection validity policy.
12. Clear history on Reset/workspace change.
13. Add reusable history controls.
14. Place normal + maximized controls without duplication.
15. Add Alt shortcuts.
16. Add guarded Ctrl/Meta-Z aliases.
17. Accessibility/live announcements.
18. Focused tests.
19. Browser interaction QA.
20. Desktop/live synthetic-vault smoke.
21. KG12 counter sanity.
22. Responsive pass.
23. Docs + archived prompt.
24. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run current KG12 checks, `pnpm desktop:check`, browser interactive QA, and synthetic desktop smoke where available.

Responsive widths:

```text
390
600
768
1000
1440
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

NAV1 is complete only when:

1. History is renderer-independent.
2. Checkpoints contain `ViewProjectionState`.
3. Checkpoints contain only semantic canonical viewport anchor + zoom when present.
4. No React Flow IDs/raw transforms/layouts/selection are stored.
5. History is session-only and bounded.
6. Back/Forward operations are immutable and deterministic.
7. New meaningful navigation after Back clears Forward.
8. No-op actions preserve Forward.
9. Pan/zoom/Fit do not create history.
10. Selection/hover do not create history.
11. Search typing does not create history.
12. Inspector/Filters/Settings/Tools open state does not create history.
13. Maximize does not create history.
14. Preferences do not create history.
15. Structure changes create history.
16. Disclosure creates history.
17. Heading Depth/Blocks/Path/Entity/Reference filters create history.
18. Focus enter/re-target/exit/Hops/Direction create history.
19. Search/Inspector entity navigation creates history.
20. Entity navigation updates semantic target bookmark.
21. Back restores previous semantic view.
22. Forward restores next semantic view.
23. Valid semantic viewport restores via center request.
24. Missing/hidden anchor falls back to Fit.
25. History restore does not duplicate `projectView()` solely for anchor lookup.
26. Old history target is reconciled against current live workspace.
27. Missing Focus/disclosure/path/viewport state is safely reconciled.
28. Same-workspace live updates keep history.
29. Live updates themselves do not create history.
30. Workspace/source change clears history.
31. Reset saved view clears history and cannot be Back-undone.
32. Current traversed view still autosaves normally.
33. History works if persistence fails.
34. Normal mode shows compact arrows.
35. Maximized mode exposes arrows without Tools.
36. Arrows are not duplicated in maximized Tools.
37. Disabled states are correct.
38. Responsive widths have no new overflow.
39. Alt+Left/Right work when available in graph context.
40. Unavailable Alt shortcut is not consumed solely to do nothing.
41. Ctrl+Z / Ctrl+Shift+Z work only in eligible graph context.
42. Editable text undo is never stolen.
43. Application modal/dialog disables graph shortcuts.
44. Shortcut repeat policy is deliberate/tested.
45. Traversal announcements use existing live region.
46. Selection is not historically resurrected.
47. Stale selection is cleared when necessary.
48. UX4A/4B/4C behavior remains intact.
49. Rapid navigation with async Dagre worker leaves latest target active.
50. Stale center/Fit requests do not snap after newer traversal.
51. History bookkeeping adds no duplicate projection/layout work.
52. No new external dependency.
53. No persisted-view schema bump.
54. Renderer remains unaware of history.
55. Focused/full tests pass.
56. Web build passes.
57. Desktop check passes.
58. Browser QA passes.
59. Synthetic live-vault QA passes where supported.
60. PR/post-merge CI passes.
61. Branch/worktree cleanup follows repository convention.

---

# Final report

Report:

## 1. Summary

What NAV1 added and merged PR/commit.

## 2. History architecture

Explain past/current/future and checkpoint contents.

## 3. Checkpoint policy

What creates history and what does not.

## 4. Back / Forward controls

Normal/maximized placement and disabled behavior.

## 5. Keyboard shortcuts

Exact shortcuts and editable-control protection.

## 6. Semantic viewport

Capture, entity-navigation bookmark, center restore, Fit fallback.

## 7. Focus / Structure / Filters / Disclosure

Confirm participation.

## 8. Search / Inspector navigation

Confirm graph navigation is historical while transient UI is not.

## 9. Selection policy

Explain non-persistence and stale-selection handling.

## 10. Live-update reconciliation

Explain lazy reconciliation.

## 11. Async layout behavior

Explain latest-wins worker and stale-center prevention.

## 12. Reset/source boundaries

Confirm history clearing.

## 13. Persistence interaction

Current view autosaves; history remains session-only.

## 14. Performance

Limit, memory posture, projection/layout impact.

## 15. Browser QA

Sequences and responsive widths run.

## 16. Desktop/live QA

Synthetic scenarios run.

## 17. Accessibility

Buttons, announcements, keyboard ownership, text undo safety.

## 18. Dependencies

Expected external additions: zero.

## 19. Tests / validation

All commands/test counts/CI.

## 20. Files changed

History/GraphExplorer/CSS/tests/docs.

## 21. Deviations / warnings

Shortcut/browser or viewport caveats.

## 22. Future handoff

Leave clean base for:

```text
QUERY1 — Graph Query Language + Saved Filters
GROUP1 — Visual Groups + Color Rules
LAYOUT1 — Spatial Clustering + Layout Controls
```

Do not implement them automatically.
