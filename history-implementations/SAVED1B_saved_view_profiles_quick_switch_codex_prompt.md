# SAVED1B — Saved View Profiles + Quick Switch

**Task type:** product feature / persistence schema migration / multi-state application transaction / UI navigation polish

## Goal / success outcome

Extend the merged SAVED1A Named Saved Views feature so a Saved View can preserve not only the semantic graph context, but also the **graph settings and folder spatial arrangement that belong to that view**.

The intended user model becomes:

```text
Saved View: "Language Focused"
├─ Scope / Layout / Focus
├─ query + filters
├─ hierarchy detail
├─ semantic viewport
├─ graph settings relevant to this presentation
└─ All-Network folder spatial arrangement, when applicable
```

Switching between Saved Views should therefore be able to produce meaningfully different working environments:

```text
"Language Focused"
→ Focus Network
→ larger nodes / stronger reference pull

"Architecture Overview"
→ All Network
→ different spacing
→ different Pull/Place folder arrangement

"Argument Structure"
→ Focus Hierarchy
→ Modular Preview + Soft Folder Clusters
```

Also add a **compact Saved View quick-switch control** in the graph chrome so changing views is a routine navigation action rather than requiring the full management panel.

Do **not** implement the decorative load/retract animation in this task. That will be a separate SAVEDUX1 polish task after the state/profile transaction is proven stable and performant.

---

# No external context

This task should be implementable entirely from the repository.

Do not assume Codex can access any files outside the repository.

---

# Current repository evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At plan-writing time, latest `main` inspected was:

```text
4fff029080f491093bac9425b5aa8e68dc4331a2
```

Recent relevant merges:

```text
PR #84  HIER4B Soft Folder Clusters
PR #85  SAVED1A Named Saved Views
PR #86  NETWORKVIEW1B startup/viewport stability
PR #87  headless AI Review infrastructure
PR #88  Argument Workspace compiler core
```

PR #87/#88 are unrelated infrastructure. Do not touch or reorganize them.

Before editing:

1. inspect `AGENTS.md`;
2. update from current `main`;
3. inspect open PRs/worktrees;
4. do not modify or clean unrelated working trees, `.pnpm-store/`, AI Review, Argument Workspace, or other user work;
5. newer merged code always outranks assumptions in this prompt.

---

# SAVED1A baseline to preserve

SAVED1A is merged and already provides:

```text
workspace-scoped Named Saved Views
Save
Apply
Update
Rename
Delete
corruption recovery
Scope/Layout restore
Focus restore
hierarchy detail/disclosure
query + graph filters
semantic viewport
Current View terminology
normal/maximized responsive Saved Views UI
```

The current registry is strict schema v1:

```ts
SavedViewEntry {
  name
  layout: 'network' | 'hierarchy'
  view: PersistedWorkspaceView // existing schema-v3 KG9 semantic state
}
```

Current application flow:

```text
validate entry
→ restore/reconcile PersistedWorkspaceView
→ normalize presentation availability
→ cancel transient Move
→ refuse dirty Arrange Folders loss
→ replace graph state once
→ set presentation / Focus layout
→ install semantic bookmarks
→ clear selection + Inspector + Back/Forward
→ sync canonical query draft
→ existing final-generation-gated viewport restoration
→ ordinary KG9 autosave becomes Current View
```

Preserve this architecture.

SAVED1A intentionally leaves Graph Preferences, Visual Groups, per-File Size, Saved Query definitions, and spatial overrides independent. SAVED1B changes only the specific profile boundaries described below.

---

# Why SAVED1B is needed

Today these are persistent, but **workspace-current/global**, not per Saved View:

```text
Graph Preferences
folder Pull/Place spatial rules
```

Therefore:

```text
Saved View A
Saved View B
Saved View C
```

all currently reuse whichever graph settings and folder arrangement are active at Apply time.

SAVED1B lets each Saved View carry its own **embedded view profile**.

This is not primarily a "make settings persistent" task.

Those settings already persist.

It is:

```text
make selected settings + spatial intent part of a named Saved View snapshot
```

---

# Major design decision: embed profiles in Saved Views

Do not introduce a separate named "Settings Profiles" or "Spatial Profiles" product in SAVED1B.

Use an embedded profile per Saved View.

Reason:

- the user wants Saved Views to act as complete graph working contexts;
- current profile payloads are small;
- separate named profile registries introduce identity/reference/delete semantics with no current need;
- duplicated small JSON is safer than cross-registry referential integrity.

Conceptually:

```text
Saved View
├─ semantic view snapshot
└─ optional embedded profile snapshot
```

A future milestone can extract reusable named profiles if real product evidence appears.

---

# SAVED1B schema v2

Bump only the **Named Saved Views registry** schema.

Do not change:

```text
PersistedWorkspaceView schema v3
SpatialOverrideRegistry schema v2
Graph Preferences storage schema/key
canonical graph schema
view-state schema
```

Conceptual v2 entry:

```ts
interface SavedViewEntry {
  readonly name: string
  readonly layout: SavedViewLayout
  readonly view: PersistedWorkspaceView
  readonly profile?: SavedViewProfile
}
```

Use a discriminated profile union rather than a bag of unrelated optional fields.

Recommended conceptual shape:

```ts
type SavedViewProfile =
  | {
      readonly kind: 'all-network'
      readonly network: GlobalLayoutSettings
      readonly spatial: SpatialOverrideRegistry
    }
  | {
      readonly kind: 'focus-network'
      readonly network: SavedFocusNetworkSettings
    }
  | {
      readonly kind: 'focus-hierarchy'
      readonly hierarchy: SavedFocusHierarchySettings
    }
  | {
      readonly kind: 'all-hierarchy'
    }
```

Exact names may differ.

The discriminant must agree with:

```text
entry.view.presentationMode
entry.layout
entry.view.projection.focus
```

Reject incoherent combinations.

---

# Migration from SAVED1A schema v1

This is a hard requirement.

Existing user Saved Views must remain usable.

Load schema v1 strictly using its old contract, then migrate **in memory** to schema v2:

```text
v1 entry
→ same name/layout/view
→ profile absent
```

Do not invent a profile from whatever settings happen to be active when the old registry is read.

Do not rewrite storage merely because it was read.

The next explicit Saved View mutation may write normalized schema v2.

Behavior of a migrated profile-less SAVED1A entry:

```text
Apply
→ exact SAVED1A semantics
→ restore semantic graph state
→ leave current graph settings untouched
→ leave current spatial rules untouched
```

Then:

```text
Update
→ captures current SAVED1B profile
```

Newly created Saved Views always include a profile.

If useful, the management UI may quietly indicate that a legacy entry has no profile, but do not clutter normal use.

---

# Profile scope: save only settings that belong to the view

Do not snapshot the entire `GraphPreferences` object.

Current `GraphPreferences` intentionally mixes:

```text
graph presentation/layout settings
machine/interaction preferences
experimental exposure gates
preferred layout state
```

SAVED1B must capture only graph-view-relevant values.

---

# 1. All + Network profile

Capture the complete current:

```ts
GlobalLayoutSettings
```

This intentionally includes:

```text
Reference Pull / link force
Folder clustering on/off
Folder clustering strength
within-folder spacing
Folder separation
spacing preset/custom state
Base node size
Link influence on node size
Link thickness
Label threshold
```

Reuse:

```ts
validateGlobalLayoutSettings(...)
```

Do not invent another validator.

Also capture the entire current workspace:

```ts
SpatialOverrideRegistry
```

for All Network.

That includes current SPATIAL2:

```text
Pull rules
Place rules
exact/subtree/custom scopes
exclusions
strength
normalized anchors
```

Use the existing spatial registry serializer/validator.

Do not flatten spatial semantics into raw positions.

Do not store ForceAtlas2 coordinates.

Do not capture temporary Arrange Folders draft state.

Only committed spatial rules enter a Saved View.

---

# 2. Focus + Network profile

Focus Network exposes only the shared Network controls.

Capture only the settings currently meaningful to Focus Network:

```text
Reference Pull
Base node size
Link thickness
Label threshold
```

Use the existing runtime boundary:

```ts
resolveNetworkSettings(...)
```

as the semantic source.

Conceptual serializable type:

```ts
interface SavedFocusNetworkSettings {
  readonly referencePull: number
  readonly nodeSize: number
  readonly linkThickness: number
  readonly labelThreshold: number
}
```

Do **not** capture hidden All-only values when saving a Focus Network view:

```text
Folder clustering
Folder strength
within-folder spacing
Folder separation
Link influence on node size
All-Network spatial rules
```

Applying a Focus Network profile must merge its four shared settings into the current `GlobalLayoutSettings` while preserving every All-only setting.

If the renderer package lacks a pure helper for this merge, add one in the narrow settings domain rather than duplicating field surgery in React.

The helper must preserve:

```text
folderClustering
folderCohesion
withinFolderSpacing
betweenFolderSpacing
referenceDegreeSizeInfluence
spacing semantics
```

while replacing only the four shared values.

Add exact tests.

---

# 3. Focus + Hierarchy profile

Capture graph-presentation choices relevant to Focus Hierarchy.

At current `main`, likely fields are:

```text
focusAppearance
focusHierarchyImplementation

modularFocusInternalLayout
modularFocusHeadingOrder
modularFocusMacroLayout
modularFocusSoftFolderStrength
modularFolderStripsVisible
modularConnectionStyle
```

These now include HIER4B's Soft Folder Clusters policy/strength.

Reuse the existing predicates/normalizers from:

```text
renderer-reactflow
focus-schematic-layout
graph-preferences
```

Do not duplicate validation logic.

Even when the saved implementation is Classic, retaining the Modular sub-options is acceptable if it keeps the snapshot deterministic and future switching predictable.

Do not capture:

```text
showExperimentalAllHierarchy
trackpadZoomMode
```

`localLayoutMode` is already represented by:

```text
SavedView.layout
```

Do not duplicate it inside the profile.

---

# 4. All + Hierarchy profile

For SAVED1B, All Hierarchy has no additional saved Graph Preferences.

Use:

```ts
{ kind: 'all-hierarchy' }
```

or an equivalent explicit empty profile.

Do not save/enable:

```text
showExperimentalAllHierarchy
```

A Saved View must still respect current availability policy.

If All Hierarchy is unavailable later, reuse SAVED1A's existing fallback behavior.

---

# Explicitly excluded from every profile

Do not snapshot/restore:

```text
trackpadZoomMode
showExperimentalAllHierarchy
Saved Query definitions
Visual Group definitions/enabled state/order/colors
per-File Size overrides
individual File movement/positions
Network Explorer folder disclosure
Search text
selection / Inspector target
open panels
maximized mode
temporary physics state
Arrange Folders draft
AI Review / Argument Workspace state
source/vault settings
identity/catalog state
```

Per-File persistent placement still belongs to future PIN1.

Do not begin PIN1.

---

# Graph Preferences ownership

Graph Preferences currently persist through:

```text
icarus.graph-explorer.preferences.v1
```

and are app-wide rather than Saved-View-scoped.

SAVED1B may update the relevant existing Graph Preference fields when applying a profile, exactly as if the user changed those settings manually.

This is acceptable for this milestone because it preserves the current settings ownership model and makes the applied profile survive app restart.

However:

- modify only fields belonging to the saved profile kind;
- preserve every excluded preference exactly;
- do not change the storage key/schema merely to make SAVED1B work;
- document that Saved Views automate current graph preferences rather than creating a second settings engine.

Do not introduce a shadow "effective settings" registry unless repository evidence shows the current model cannot safely support the transaction.

---

# Spatial profile ownership

Applying an `all-network` Saved View with a profile should replace the workspace's **committed current spatial registry** with the Saved View's captured spatial snapshot.

This is intentional:

```text
View A
→ spatial arrangement A

View B
→ spatial arrangement B
```

When switching from A to B:

```text
current workspace spatial registry
→ B's saved snapshot
```

The Saved View entry itself remains immutable until Update.

Do not mutate the Saved View because the user later edits Arrange Folders.

Update is the only operation that recaptures those changes into the Saved View.

---

# Cross-key profile Apply transaction

SAVED1B Apply can now touch:

```text
Named Saved View read
Graph Preferences write
SpatialOverrideRegistry write (All Network only)
semantic graph state
renderer presentation
viewport restore
```

Treat this as one product transaction.

Do not allow:

```text
preferences changed
but spatial write failed
and UI still claims Saved View applied
```

Before adoption:

1. validate/reconcile the Saved View;
2. derive the target profile changes;
3. verify dirty Arrange Folders policy;
4. cancel temporary File movement through existing lifecycle;
5. prepare previous durable values required for rollback;
6. perform required durable profile writes;
7. if any durable write fails:
   - do not apply semantic Saved View state;
   - do not adopt partial in-memory profile state;
   - make a best-effort rollback of already written profile keys;
   - report the failure clearly;
8. only after successful durable profile writes, batch the in-memory preference/spatial/semantic state adoption.

Use the existing write-before-adopt philosophy.

Do not claim full database-style atomicity that browser storage cannot guarantee, but make a single-process failure leave the previous confirmed state whenever reasonably possible.

Add deterministic failure-injection tests for:

```text
preferences write fails
spatial write fails before preferences
second write fails after first succeeds
rollback write fails
```

If repository evidence supports a safer write ordering, use it and document it.

---

# Apply must be batched to the final state

Do not replay a Saved View as a sequence of UI actions.

Do not do:

```text
set query
wait
set focus
wait
set spacing
wait
set spatial rules
wait
switch layout
```

That would launch unnecessary projections/workers and visible intermediate states.

Instead:

```text
plan final semantic state
plan final profile state
persist required profile keys
→ one React/application adoption transaction
→ effects see the final combined state
```

React state updates from one synchronous Apply operation should be batched.

If current independent sessions require a small orchestration helper, create one.

Hard goal:

```text
no visible intermediate graph
no redundant worker churn
no transient wrong viewport
```

---

# Preserve VISUAL1C layout/presentation semantics

SAVED1B must not regress the separation already established by VISUAL1C.

Examples:

## Apply changes only Base node size

Expected:

```text
0 ForceAtlas2 layouts
Sigma visual refresh only
exact x/y preserved
```

## Apply changes only Link thickness

Expected:

```text
0 layouts
edge presentation refresh only
```

## Apply changes Reference Pull

Expected:

```text
intended layout
```

## Apply changes Folder separation

Expected:

```text
intended All-Network layout
```

## Apply changes spatial Pull/Place rules

Expected:

```text
existing spatial worker/composition path
```

Do not special-case Saved Views to bypass established settings semantics.

Use the same settings update paths/contracts.

---

# Preserve NETWORKVIEW1B final-viewport guarantees

PR #86 hardened Network startup and semantic viewport ownership.

SAVED1B must preserve those guarantees.

When profile application changes geometry:

```text
settings/spatial rules
→ final geometry generation
→ semantic Saved View viewport restore
```

The viewport must not restore against stale/intermediate geometry.

Reuse existing final-generation gating.

Do not issue:

```text
Fit
Center
Saved View semantic restore
```

multiple times.

A Saved View Apply should still result in one authoritative final camera adoption.

Add regression coverage for:

```text
All Network:
profile changes physics + spatial rules + viewport
→ viewport applies only to final accepted geometry
→ no post-reveal camera jump
```

---

# Saved View capture / Update

Extend the existing central:

```ts
captureSavedView(...)
```

rather than building profile data inside UI components.

Capture must take the currently committed state:

```text
semantic graph view
+
presentation/layout
+
current relevant graph preferences
+
committed spatial registry
```

Do not capture dirty Arrange draft.

Do not capture pending worker/camera state.

`Save current view`:

```text
captures semantic + profile snapshot
→ writes Saved Views registry only
```

It does not rewrite Graph Preferences or spatial storage.

`Update`:

```text
recaptures semantic + current profile
→ replaces Saved View entry
→ writes Saved Views registry only
```

Rename/Delete remain profile-transparent.

---

# Exact matching and the quick-switch label

Do **not** add a persisted `activeSavedViewId`/`activeSavedViewName` in SAVED1B.

Derive truth from current state.

Reason:

```text
persisted "active" identity
→ can become stale after user edits query/settings/viewport/spatial rules
```

Instead compute:

```text
current normalized semantic snapshot
+
current applicable profile snapshot
```

and compare it to Saved Views.

If exactly one or more entries match:

```text
choose the first deterministic alphabetical match
```

and the switcher displays that Saved View name.

If no entry matches:

```text
Current View
```

This naturally handles modification:

```text
load "Language Focused"
→ switcher: Language Focused

change query / viewport / settings / spatial rules
→ switcher: Current View

Update "Language Focused"
→ switcher: Language Focused
```

No hidden mutable active-view state is needed.

Legacy migrated profile-less SAVED1A entries compare using their semantic snapshot only, because by definition they do not own profile state.

---

# Matching performance

Do not run graph projection/layout to determine whether a Saved View matches.

Maximum registry size is 50.

Use deterministic small-data fingerprints/serialization.

Likely approach:

```text
memoized current semantic capture
memoized current profile capture(s)
→ compare canonical strings/objects
```

Avoid:

```text
projectView()
worker calls
Graphology reads
renderer reads
DOM reads
```

for matching.

Viewport noise should follow existing semantic bookmark normalization/tolerance where appropriate.

Do not let tiny irrelevant camera rounding make the switcher flicker continuously.

If exact viewport equality proves unstable in real evidence, define a small semantic ratio/zoom tolerance consistent with current history comparisons and document it.

Do not ignore meaningful viewport differences.

---

# Quick Saved View switcher

Add a compact top-right/toolbar Saved View switcher suitable for routine use.

Desired presentation:

```text
┌──────────────────────────┐
│ Language Focused      ▾  │
└──────────────────────────┘
```

or, when unmatched:

```text
┌──────────────────────────┐
│ Current View          ▾  │
└──────────────────────────┘
```

The switcher should list the workspace's Saved Views and apply one directly.

This is separate from the full management operations:

```text
Save
Update
Rename
Delete
Recovery
```

Preserve access to the existing SAVED1A management surface.

Possible implementations:

```text
compact native select + adjacent Manage button
```

or:

```text
accessible custom menu with Saved View names + "Manage Saved Views…"
```

Choose the simpler, more robust option after inspecting the current toolbar/maximized layout.

Do not build an elaborate custom listbox if native controls solve the UX cleanly.

Requirements:

- available in normal graph mode;
- available in maximized graph mode;
- no duplicate IDs;
- usable at 320 px width;
- long names truncate visually but remain accessible;
- keyboard usable;
- switching calls the exact existing Apply transaction;
- selector state updates from derived matching, not stale local selection;
- full SAVED1A manager remains reachable;
- no toolbar overflow regression.

The user's requested direction is a quick dropdown, not another large panel.

---

# Startup behavior

Do **not** automatically re-apply the last Saved View at startup.

Current View already exists specifically to resume where the user stopped.

Example to avoid:

```text
user applies Language Focused
→ then works for 30 minutes and changes query/viewport/settings
→ closes app
→ restart
→ app forcibly reapplies old Language Focused
→ final session state is lost
```

Correct behavior:

```text
startup
→ restore ordinary Current View
→ load persisted Graph Preferences
→ load workspace spatial registry
→ load Named Saved Views
→ derive whether the restored current state exactly matches a Saved View
```

If it matches:

```text
switcher shows "Language Focused"
```

If not:

```text
switcher shows "Current View"
```

No extra layout/apply should happen just to establish the label.

This is also the foundation for SAVEDUX1's later lightweight startup message.

---

# Prepare for SAVEDUX1, but do not animate

The user wants a later very fast lightweight transition approximately like:

```text
"Language Focused"
"View loaded"

jagged ink/glass/venom-like pieces retract toward a center point
+
small cartoony anticipation
+
text quickly exits right
```

SAVED1B must **not implement this animation**.

Reasons:

- state/profile correctness comes first;
- animation must never own Apply timing;
- performance needs separate measurement;
- it should be independently removable.

However, while implementing Apply, keep a clean observable success boundary so SAVEDUX1 can later trigger only after:

```text
Saved View transaction accepted
+
final relevant geometry/viewport settled enough to truthfully say "loaded"
```

Do not add speculative animation state if no natural seam exists.

Document the current best seam in the final report.

---

# Dirty Arrange Folders behavior

Keep SAVED1A's safety rule.

If Arrange Folders contains an uncommitted draft:

```text
switch Saved View
→ must not silently discard draft
```

Use the current guard.

Do not capture draft state into the Saved View.

Do not apply a saved spatial registry underneath an active dirty editor.

---

# Temporary File movement / PHYSICS1

Before switching profiles/views:

```text
active File drag / temporary constraint
→ cancel/release through existing lifecycle
```

Do not persist its coordinates.

Do not let an old cooling result arrive after the Saved View profile and overwrite new geometry.

Use existing invalidation/generation contracts.

Add regression if current coverage does not already prove this cross-feature race.

---

# Spatial-rule reconciliation

A saved All-Network spatial snapshot may later reference folders with no visible/current members.

Preserve the existing SPATIAL2 semantics:

```text
valid dormant rule
→ remains valid
→ inactive if no members
```

Do not delete/fuzzy-retarget saved folder rules during Apply.

Do not rewrite the Saved View after reconciliation.

If a folder path was renamed, existing path-identity limitations remain.

SAVED1B is not a folder-identity redesign.

---

# Saved View management UI

Extend summaries enough to make profile ownership understandable without noise.

Possible compact markers:

```text
All · Network · Profile
Focus · Hierarchy · Profile
All · Network · View only   // migrated SAVED1A entry
```

Do not dump raw setting values unless they meaningfully improve management.

New Save/Update captures profile automatically.

No extra "include settings" checkbox in v1 of this feature unless implementation evidence shows a strong need.

The product should be simple:

```text
Save current view
= save the current working graph context
```

Legacy profile-less entries are the compatibility exception.

---

# Persistence/corruption policy

Preserve SAVED1A's strict behavior.

For Saved Views registry:

- corrupt bytes remain untouched;
- mutations blocked until explicit recovery;
- read migration does not rewrite;
- write-before-adopt;
- failed Saved Views mutation retains confirmed registry.

For profile Apply:

- validate embedded settings/spatial snapshot before touching live state;
- invalid profile means Apply fails safely;
- do not partially apply the semantic portion while ignoring corrupt profile fields.

A profile-less migrated SAVED1A entry remains valid.

---

# Registry/profile validation

Schema-v2 validator must reuse existing domain validators wherever possible.

## All Network

Validate:

```ts
validateGlobalLayoutSettings(...)
validateSpatialOverrideRegistry(..., workspaceId)
```

Spatial registry workspace ID must equal:

```text
SavedViewRegistry.workspaceId
PersistedWorkspaceView.workspaceId
```

## Focus Network

Validate the four shared Network values against existing settings ranges/semantics.

Prefer a reusable renderer-settings validator/helper if one does not exist.

Do not import React/app code into renderer-independent settings validation.

## Focus Hierarchy

Use current enum predicates/normalizers.

Reject unknown fields.

## All Hierarchy

Reject extra profile fields.

Everything remains JSON-safe and deterministic.

---

# Cross-registry independence after SAVED1B

Applying a Saved View may now intentionally change:

```text
relevant Graph Preferences fields
All-Network spatial registry, only for all-network profile
semantic Current View state
```

It must still leave untouched:

```text
Saved Query definitions
Visual Groups
per-File Size overrides
source data
stable identity/catalog
trackpad preference
experimental All-Hierarchy gate
AI/Argument Workspace
```

Add exact storage-key assertions.

---

# Graph history

Keep SAVED1A policy:

```text
Apply Saved View
→ named workspace-context jump
→ clear Back/Forward history
```

Do not try to make Back undo a profile switch.

The existing transient history does not snapshot profile registries/preferences.

Changing that would be another milestone.

---

# Current View after Apply

After successful profile + semantic application:

```text
ordinary KG9 Current View autosave
→ records semantic state/viewport
```

Graph Preferences and spatial registry already persist through their own owners.

Do not extend KG9 Current View schema to duplicate profile data.

This keeps:

```text
Current View
Saved Views
Graph Preferences
SpatialOverrideRegistry
```

as separate persistence owners.

At restart, their already-persisted current values reconstruct the last working state.

---

# Important settings-update behavior

Do not replace entire Graph Preferences blindly.

Use pure profile application helpers.

Conceptually:

```ts
applyAllNetworkSavedProfile(
  currentPreferences,
  profile,
): GraphPreferences

applyFocusNetworkSavedProfile(
  currentPreferences,
  profile,
): GraphPreferences

applyFocusHierarchySavedProfile(
  currentPreferences,
  profile,
): GraphPreferences
```

Every helper must prove excluded fields are unchanged.

Examples:

```text
Focus Network Apply
→ changes shared Network 4
→ does NOT change All folder settings
→ does NOT change link influence
→ does NOT change hierarchy implementation
→ does NOT change trackpad mode

Focus Hierarchy Apply
→ changes hierarchy-presentation subset
→ does NOT change Network settings
→ does NOT change trackpad mode
→ does NOT enable All Hierarchy
```

---

# Operation-count expectations

## Save / Update / Rename / Delete

Must cause:

```text
0 canonical parsing
0 KG10 work
0 projection
0 layout
0 spatial worker
0 camera movement
```

except UI state.

## Apply profile-less migrated SAVED1A entry

Same as current SAVED1A.

## Apply exact same SAVED1B view/profile

Expected:

```text
0 preference writes if already equal
0 spatial writes if already equal
0 projection/layout work if semantic state equal
0 viewport command if already equivalent
```

History/selection reset may retain current SAVED1A semantics.

## Apply visual-only profile difference

Expected:

```text
0 ForceAtlas2
VISUAL1C presentation refresh only
```

## Apply physics difference

Expected:

```text
one intended latest-wins geometry path
```

## Apply spatial difference

Expected:

```text
one intended spatial generation/adoption
```

Do not trigger multiple full layouts because several settings changed together.

---

# Tests — schema/migration

Add focused tests for:

1. strict v2 registry round trip;
2. v1 strict load and in-memory migration;
3. v1 read does not rewrite storage;
4. next explicit mutation writes v2;
5. new Save always includes profile;
6. Update adds profile to migrated entry;
7. Rename preserves profile bytes;
8. Delete removes only target;
9. malformed profile rejected;
10. profile kind/view/layout mismatch rejected;
11. wrong embedded spatial workspace rejected;
12. unknown fields rejected;
13. deterministic ordering/serialization preserved;
14. max count/name rules unchanged.

---

# Tests — profile capture

Test:

## All Network

Captures:

```text
full GlobalLayoutSettings
committed SpatialOverrideRegistry
```

and excludes dirty draft.

## Focus Network

Captures exactly:

```text
referencePull
nodeSize
linkThickness
labelThreshold
```

and no All-only settings/spatial registry.

## Focus Hierarchy

Captures exact hierarchy-presentation subset.

## All Hierarchy

Captures explicit empty/no-op profile.

---

# Tests — profile Apply

Use intentionally different current vs saved values.

## All Network

Prove:

```text
saved GlobalLayoutSettings adopted
saved spatial rules adopted
trackpad unchanged
hierarchy preferences unchanged
per-File size unchanged
Visual Groups unchanged
Saved Queries unchanged
```

## Focus Network

Prove:

```text
shared four adopted
All-only Network settings unchanged
spatial registry unchanged
```

## Focus Hierarchy

Prove:

```text
hierarchy presentation subset adopted
Network settings unchanged
spatial unchanged
```

## All Hierarchy

Prove no profile preference/spatial mutation.

---

# Tests — failed Apply transaction

Inject storage failures.

At minimum:

```text
preferences failure
spatial failure
rollback path
```

Assert:

```text
semantic graph state unchanged
presentation unchanged
selection/history not falsely cleared if Apply failed before adoption
in-memory preferences unchanged
in-memory spatial registry unchanged
best-effort durable rollback attempted
error surfaced
```

Do not let tests only assert UI text; assert storage/state.

---

# Tests — quick switch matching

Test:

```text
current exact semantic + profile match
→ switcher name

change query
→ Current View

restore query
→ name again

change Base node size
→ Current View

Update Saved View
→ name again

change All spatial rule
→ Current View

Update
→ name again
```

For migrated profile-less SAVED1A entry:

```text
semantic exact
→ matches regardless of current profile settings
```

Test duplicate-equivalent saved entries choose deterministic first name.

Test 320 px truncation/accessibility.

---

# Tests — startup

Simulate:

```text
Current View persisted
Graph Preferences persisted
spatial registry persisted
Named Saved Views persisted
```

Case A:

```text
all current state exactly equals Saved View A
→ startup does NOT Apply A
→ zero extra layout/profile writes
→ switcher says A
```

Case B:

```text
Current View modified since A
→ startup restores modified current state
→ no reapply
→ switcher says Current View
```

This is a key regression.

---

# Browser QA

Use the production build.

Create at least:

```text
A — All Network
    custom Reference Pull
    custom spacing
    custom Base node size
    distinct Pull/Place folder rules

B — All Network
    visibly different settings
    visibly different folder arrangement

C — Focus Network
    different shared Network settings

D — Focus Hierarchy
    distinct hierarchy presentation settings
```

Verify:

1. switch A ↔ B repeatedly;
2. settings visibly follow each view;
3. folder arrangement follows A/B;
4. semantic viewport follows;
5. no intermediate layout flash;
6. C changes only shared Focus Network settings;
7. C does not alter A/B All-only folder parameters;
8. D changes hierarchy presentation only;
9. trackpad setting never changes;
10. All-Hierarchy experimental gate never changes;
11. Visual Groups/per-File Size survive all switching;
12. Saved Query definitions survive;
13. editing A settings makes switcher show Current View;
14. Update A restores exact matching label;
15. dirty Arrange draft blocks switch;
16. active File movement does not leak stale physics after switch;
17. reload while current state exactly matches A → A label without reapply;
18. reload after modifying A → Current View and modifications preserved;
19. normal/maximized/320px switcher behavior;
20. clean console.

For All Network A/B, watch closely for:

```text
extra camera Fit
post-layout camera jump
old spatial generation winning late
multiple visible relayouts
```

---

# Native Tauri QA

Fresh optimized executable.

At minimum:

- restart persistence with A/B profiles;
- pointer + keyboard quick switch;
- A/B spatial arrangement switch;
- physical pan/zoom → Update → switch away → switch back;
- Focus Network profile switch;
- Focus Hierarchy profile switch;
- no stale camera jump;
- narrow/maximized Saved View controls if practically testable.

Follow current repository merge gate practice.

If native interaction is not run, report it explicitly; do not claim it passed.

---

# Performance checks

No new heavy benchmark suite is required unless measurements expose a problem.

Add instrumentation/operation-count tests.

For a medium Network fixture, compare:

```text
exact reapply
visual-only profile apply
physics profile apply
spatial profile apply
combined physics + spatial + semantic apply
```

Hard semantic expectations matter more than timing gates:

```text
visual-only → no layout
exact → no graph work
combined → no duplicate workers
```

Do not add a new dependency.

---

# Likely implementation areas

Inspect current code first. Probable relevant areas:

```text
AGENTS.md

apps/web/src/persistence/saved-views.ts
apps/web/src/persistence/saved-views-session.ts
apps/web/src/persistence/spatial-overrides.ts

apps/web/src/saved-view.ts

apps/web/src/components/SavedViews.tsx
apps/web/src/components/SavedViewsPopover.tsx
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/README.md
apps/web/src/App.css

apps/web/src/preferences/graph-preferences.ts

packages/renderer-sigma/src/settings.ts
packages/spatial-overrides/*

docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/PRODUCT_QUALITY_AUDIT.md
apps/web/README.md
apps/web/src/persistence/README.md

history-implementations/
```

Do not force edits in every file.

Do not move unrelated architecture merely because SAVED1B touches several owners.

---

# Roadmap/documentation

After implementation, document:

```text
SAVED1A
→ named semantic bookmarks

SAVED1B
→ embedded layout-appropriate graph settings + All-Network spatial snapshot
→ quick Saved View switching
```

Keep future:

```text
SAVEDUX1
→ lightweight load/switch transition animation

PIN1
→ persistent individual File positions

AUTO1
→ adaptive layout selection
```

If SAVED1B is complete, the earlier generic "settings/spatial profile composition" line can be marked complete.

Do not start SAVEDUX1 automatically.

---

# Implementation workflow

Use a dedicated branch/worktree from latest `main`.

Do not touch unrelated working state.

At completion:

1. archive this exact prompt under `history-implementations/`;
2. add `SAVED1B_implementation_status.md`;
3. open a dedicated PR;
4. include schema migration and failure-transaction evidence;
5. run required graphical/native gate;
6. merge only after the user/normal repository gate accepts it;
7. verify post-merge CI;
8. clean only this task's branch/worktree.

---

# Validation

Follow current `AGENTS.md`.

Expected core commands, adjusted to repository reality:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run packages/spatial-overrides

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

Run narrower focused SAVED1B suites during development.

If current scripts/package names differ, use current repo commands rather than copying stale names blindly.

---

# Exit gate

SAVED1B is complete only when:

1. Saved Views registry has a versioned v2 profile contract.
2. SAVED1A v1 registries load without data loss.
3. v1 read does not rewrite storage.
4. profile-less migrated entries retain SAVED1A semantics.
5. new Save captures profile.
6. Update captures/replaces profile.
7. Rename preserves profile.
8. Delete remains isolated.
9. All Network captures full GlobalLayoutSettings.
10. All Network captures committed spatial registry.
11. Focus Network captures exactly the four shared settings.
12. Focus Network Apply preserves All-only settings.
13. Focus Network Apply preserves spatial rules.
14. Focus Hierarchy captures the intended hierarchy-presentation subset.
15. Focus Hierarchy Apply preserves Network settings.
16. All Hierarchy does not mutate graph profile settings.
17. trackpad preference is never captured/applied.
18. experimental All-Hierarchy gate is never captured/applied.
19. Visual Groups remain independent.
20. per-File Size remains independent.
21. Saved Query definitions remain independent.
22. source/identity/AI/Argument state remains independent.
23. Apply validates whole profile before adoption.
24. multi-key profile Apply uses write-before-adopt and rollback protection.
25. failed profile persistence does not partially apply semantic state.
26. dirty Arrange draft is not discarded.
27. temporary File movement is safely invalidated.
28. profile application is batched to final state.
29. visual-only profile differences cause zero layouts.
30. physics differences cause only intended layout work.
31. spatial differences use existing spatial generation semantics.
32. combined Apply does not launch redundant workers.
33. final semantic viewport waits for final geometry.
34. NETWORKVIEW1B no-jump/startup guarantees remain.
35. exact same view/profile Apply avoids unnecessary graph work.
36. quick switch control exists.
37. it shows matching Saved View name when exact.
38. it shows Current View when unmatched.
39. no persisted stale active-view identity is introduced.
40. startup never blindly reapplies a Saved View.
41. startup exact match is derived without extra layout/write.
42. management CRUD remains accessible.
43. normal/maximized controls work.
44. 320px layout remains usable.
45. keyboard/focus behavior is accessible.
46. long names remain accessible.
47. schema/profile tests pass.
48. failure/rollback tests pass.
49. operation-count regressions pass.
50. full `pnpm check` passes.
51. desktop check/build pass.
52. browser QA passes.
53. native QA passes or skipped risk is explicitly documented.
54. no dependency added unless clearly justified.
55. docs/ADR/roadmap updated.
56. prompt/status archived.
57. PR CI passes.
58. post-merge CI passes.
59. task branch/worktree cleanup completes.
60. SAVEDUX1 animation has not been implemented in this task.

---

# Final report

## 1. Summary

Describe the new user model:

```text
Saved View
= semantic graph context
+ layout-appropriate graph profile
+ All-Network spatial arrangement where applicable
```

## 2. Schema + migration

Report:

- registry v2;
- v1 migration behavior;
- whether read migration rewrites storage;
- profile-less compatibility semantics.

## 3. Profile matrix

Explicit table:

```text
All Network
Focus Network
All Hierarchy
Focus Hierarchy
```

and exactly what each captures/applies.

## 4. Excluded state

Confirm trackpad, experimental gate, Groups, sizes, Saved Queries, source/identity, etc. remain independent.

## 5. Apply transaction

Explain:

- validation;
- persistence ordering;
- rollback behavior;
- React/application batching;
- worker-generation behavior.

## 6. Layout/presentation evidence

Report operation counts for:

```text
exact
visual-only
physics
spatial
combined
```

## 7. Viewport/camera evidence

Confirm final-generation gating and NETWORKVIEW1B stability.

## 8. Quick switch

Explain matching logic, `Current View`, normal/maximized/narrow behavior, and why no active Saved View identity is persisted.

## 9. Startup behavior

Confirm Current View resumes normally and Saved Views are not automatically reapplied.

## 10. Tests / browser / native / CI

## 11. Files changed

## 12. Dependencies

Expected: none.

## 13. Remaining work

```text
SAVEDUX1 — lightweight Saved View loaded/switch transition
PIN1 — persistent individual File placement
AUTO1 — adaptive layout selection
```

Do not start them automatically.
