# SAVED1A — Named Saved Views for Daily Graph Work

**Task type:** product feature / workspace-scoped persistence / navigation-state composition / UI integration

## Goal / success outcome

Implement the first production-ready **Named Saved Views** feature.

The application is now close enough to daily use that users should be able to preserve a useful graph context, give it a name, and return to it later without rebuilding the view manually.

A Saved View should behave like a durable named bookmark for the current graph exploration state:

```text
"Associated Value — Focus Network"
"Language — Deep Hierarchy"
"All — unresolved references"
```

The core v1 experience:

```text
configure graph
→ Save current view
→ give it a name
→ continue working elsewhere
→ open Saved Views
→ Apply
→ Scope/Layout + graph state + semantic viewport are restored
```

A Saved View must survive app restart for a stable workspace.

It must remain renderer-independent and must never persist raw React Flow, Sigma, Graphology, ForceAtlas2, Dagre, worker, or screen coordinates.

---

# Important product decision: split SAVED1 into two stages

Implement **SAVED1A now as the usable named-view feature**.

Do **not** try to bundle every other persisted registry into the same snapshot.

SAVED1A captures:

```text
Scope
Layout
Focus root / hops / direction
active query + existing projection filters
Hierarchy depth / Heading limit / Blocks
manual hierarchy expand/collapse disclosure
semantic renderer viewport bookmarks
```

SAVED1A does **not** capture or overwrite:

```text
Graph Preferences
Reference Pull / node-size / link-thickness settings
Trackpad preference
experimental feature flags
Visual Groups
Saved Query definitions
per-File Size overrides
folder spatial Pull/Place rules
individual File placement
Network Explorer folder disclosure
Inspector/Search selection
open panels/drawers
temporary Move/physics state
```

This boundary is deliberate.

Several of those systems are independent durable workspace/user registries. In particular:

- Graph Preferences currently mix graph appearance, renderer choices, gesture preference, and experimental exposure.
- SPATIAL2 is one mutable workspace spatial-intent registry; there is not yet a named spatial-profile abstraction.
- Visual Groups and per-File Size are independently durable presentation intent.
- applying a Saved View should not silently overwrite those registries.

Trying to snapshot and restore them now would turn a simple navigation bookmark into a multi-registry destructive transaction without defined undo/profile semantics.

Create/document a later milestone:

```text
SAVED1B — View Profiles / settings + spatial-profile composition
```

Only SAVED1B should decide whether Saved Views can reference named settings/spatial profiles.

Do not implement SAVED1B automatically.

---

# Current repository evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At plan-writing time, `main` is around:

```text
ce757bb622e60702b32819113ef1d92c222e07a1
```

and PR #84 (`HIER4B` Soft Folder Clusters preview) is open.

Before editing:

1. inspect current `main`;
2. inspect PR #84 status;
3. do not modify, clean, merge, rebase, or delete PR #84's branch/worktree;
4. if PR #84 merges first, rebase SAVED1A and rerun validation;
5. current repository state always outranks this prompt.

SAVED1A intentionally does not snapshot Modular/experimental Graph Preferences, which should reduce overlap with HIER4B.

---

# Existing architecture to reuse

## KG9 current-workspace persistence already exists

`packages/view-state` owns schema-v3 renderer-independent persistence.

Current `PersistedWorkspaceView` already contains:

```text
workspaceId
presentationMode
projection:
  disclosure
  focus
  filters/query
semantic viewports:
  structure
  global
  local
```

`createPersistedWorkspaceView(...)`:

- canonicalizes the active graph query;
- sorts/normalizes disclosure/filter state;
- validates stable entity references;
- stores semantic entity-plus-zoom/ratio viewport bookmarks;
- never stores raw renderer coordinates.

`restorePersistedWorkspaceView(...)` / reconciliation already handles stale state conservatively:

- missing expanded/collapsed entities;
- missing Focus root;
- stale path filters;
- missing viewport anchor;
- supported presentation fallback.

Reuse these contracts instead of inventing a second view-state model.

## Scope × Layout product model already exists

User-facing state is:

```text
Scope:  All | Focus
Layout: Network | Hierarchy
```

Internal presentation state is still approximately:

```text
All + Network       → global
All + Hierarchy     → structure
Focus + Network     → local + free
Focus + Hierarchy   → local + structured
```

The current persisted KG9 view stores `presentationMode`, while Focus `LocalLayoutMode` remains a separate preference.

Named Saved Views must preserve the user-facing Layout explicitly, including Focus Network vs Focus Hierarchy.

Do not make a Focus Saved View depend on whatever `localLayoutMode` happens to be active later.

## Existing graph history is transient navigation history

Back/Forward checkpoints currently store:

```text
presentationMode
ViewProjectionState
semantic renderer viewports
```

They do not own all Graph Preferences and are intentionally page-lifetime.

Saved View application should therefore be treated as a **named workspace jump**, not another ordinary Back/Forward step.

See the explicit history policy below.

## Existing Saved Queries are a useful persistence/UI pattern

`apps/web/src/persistence/saved-filters.ts` already demonstrates:

- workspace-scoped storage;
- strict schema validation;
- deterministic ordering;
- bounded names/counts;
- corrupt-value preservation;
- write-before-adopt mutation;
- stable-workspace persistence policy.

Reuse the pattern where it fits, but do not combine Saved Queries and Saved Views into one registry.

---

# Terminology cleanup — required

The application currently uses the phrase:

```text
Reset saved view
```

for KG9's single automatically persisted current workspace state.

Once Named Saved Views exist, that wording becomes ambiguous.

Change user-facing terminology:

```text
Reset saved view
→ Reset current view
```

or another equally clear product phrase approved by existing UI conventions.

Meaning remains unchanged:

```text
Reset current view
→ clears only the KG9 current-workspace view state
→ restores the existing default graph view
```

It must **not** delete Named Saved Views.

Do not mechanically rename internal functions such as `clearWorkspaceView` unless doing so improves code clarity without needless churn.

Update docs/help/tests/user-facing messages consistently.

---

# Saved View schema

Create a strict workspace-scoped registry.

It may live in an app-level persistence module similar to Saved Filters, or in a small source-neutral package if repository inspection shows that is cleaner.

Do not create a dependency-heavy package merely for symmetry.

Conceptual v1 contract:

```ts
export const SAVED_VIEW_REGISTRY_SCHEMA_VERSION = 1 as const;

export type SavedViewLayout = 'network' | 'hierarchy';

export interface SavedViewEntry {
  readonly name: string;

  /**
   * Existing normalized KG9 renderer-independent snapshot.
   * workspaceId must equal the registry workspaceId.
   */
  readonly view: PersistedWorkspaceView;

  /**
   * Required because presentationMode='local' alone does not distinguish
   * Focus Network from Focus Hierarchy.
   *
   * For All views this can either be normalized to the corresponding value
   * or omitted if the schema discriminates by presentation mode.
   */
  readonly layout: SavedViewLayout;
}

export interface SavedViewRegistry {
  readonly schemaVersion: 1;
  readonly workspaceId: WorkspaceId;
  readonly views: readonly SavedViewEntry[];
}
```

Exact names can differ.

Prefer semantic `network | hierarchy` over persisting internal implementation names such as:

```text
free
structured
global
local
```

unless using the existing types materially reduces duplication.

The saved data should remain understandable at the product layer.

---

# Registry invariants

Recommended initial limits:

```text
max Saved Views per workspace: 50
name length: 1–64 trimmed characters
```

Use existing product precedent unless repository evidence justifies another bound.

Names:

- required;
- trimmed;
- case-insensitively unique;
- deterministic sorting by folded name, then exact name;
- no hidden duplicate IDs created by case changes.

A separate opaque SavedViewId is optional.

Do not add one unless it provides a real current need.

No other system references Saved Views yet, so name identity is acceptable for v1 and matches Saved Queries.

Strict validation:

- plain objects only;
- exact known fields;
- correct schema version;
- non-empty matching workspace ID;
- bounded list length;
- unique names;
- each embedded `PersistedWorkspaceView` must pass existing view-state validation;
- embedded `view.workspaceId` must equal registry workspace ID;
- layout value valid;
- Focus/All layout/presentation combinations internally coherent;
- deterministic ordering required;
- structured-clone/JSON safe.

Do not accept malformed data partially.

Do not silently rewrite a corrupt registry.

---

# Persistence policy

Use one workspace-scoped storage key, conceptually:

```text
icarus-graph-explorer:saved-views:<workspaceId>
```

Stable workspace:

```text
load/save Named Saved Views durably
```

Unstable/transient report:

```text
do not pretend persistence is durable
```

Follow the repository's current Saved Filters / Visual Groups policy after inspection.

A reasonable SAVED1A product behavior is:

- registry can exist in memory for the session;
- durable Save/Update/Rename/Delete controls are disabled or explicitly marked session-only if workspace identity is not stable.

Do not claim persistence when identity is not stable.

Storage read error:

- app still works;
- Saved Views surface explains the problem;
- current graph is unaffected.

Corrupt registry:

- leave stored bytes unchanged;
- do not overwrite on ordinary edits;
- block mutations until an explicit Saved-Views-only reset/recovery action if product precedent supports it.

A Saved Views recovery action must not clear:

- current KG9 view;
- Saved Queries;
- Visual Groups;
- spatial rules;
- per-File Size;
- Graph Preferences;
- identity state.

---

# Capture semantics

Create one pure/central capture function.

Conceptually:

```ts
captureSavedView({
  name,
  workspace,
  graphState,
  presentationMode,
  explorationLayout,
  rendererViewports,
})
```

It should use:

```ts
createPersistedWorkspaceView(...)
```

rather than duplicating the KG9 normalization rules.

Capture the **applied** current graph state.

Do not capture:

- dirty query draft text;
- search text;
- selected node;
- Inspector target;
- Network Explorer row state;
- temporary camera transition points;
- pending worker positions.

The active canonical query is already part of `ViewProjectionState.filters.query`.

Saved Query definitions remain independent.

---

# What exactly a Saved View restores

Applying one Saved View should restore the saved:

## Exploration semantics

```text
All / Focus
Network / Hierarchy
```

For Focus:

```text
root EntityId
hops
direction
hierarchy-context policy already represented in Focus state
```

## Hierarchy detail

Existing disclosure state:

```text
default depth
Heading limit
Blocks
manual expanded EntityIds
manual collapsed EntityIds
```

Use current reconciliation behavior if those entities changed/disappeared.

## Filters/query

Existing persisted projection filters, especially:

```text
active QUERY1 query
path scopes
entity kinds
reference statuses
```

Do not resolve a Saved Query by name.

The Saved View owns the captured canonical query string so deleting/renaming a Saved Query does not break the view.

## Semantic viewport bookmarks

Use the existing semantic viewport model.

Do not save:

```text
raw Sigma camera x/y
React Flow transform
worker coordinates
ForceAtlas2 positions
Dagre positions
screen pixels
```

Restore through existing viewport request/generation gating so the viewport is applied only when the corresponding final geometry is ready.

NETWORKVIEW1's latest final-spatial-generation protections must remain intact.

---

# Focus Layout restoration

This is one of the most important SAVED1A additions.

Example:

```text
Saved View:
  Scope = Focus
  Layout = Hierarchy
```

Later the user's current Focus default is Network.

Applying the Saved View must still enter:

```text
Focus + Hierarchy
```

Likewise a Focus Network Saved View must not open in Hierarchy because the global preference changed.

Implement one explicit semantic conversion:

```text
SavedView.layout
+
saved/current presentation scope
→ actual renderer presentation state
```

Do not duplicate this logic across UI callbacks.

The application may update the live `localLayoutMode` state as part of applying the Saved View because Layout is part of the Saved View contract.

Whether that also becomes the user's subsequently persisted Focus default should be decided explicitly in code/docs.

Preferred behavior for v1:

```text
applying Saved View updates the live/current layout and the ordinary persisted
current view, but does not redefine unrelated user preferences
```

If the current architecture cannot set Focus layout without writing Graph Preferences, isolate the narrow update and document it.

Do not save/restore the rest of Graph Preferences.

---

# Experimental/unavailable layout behavior

Do not let Saved Views bypass product availability gates.

Potential case:

```text
Saved View = All + Hierarchy
later:
Show Experimental All Hierarchy = off
```

Do not silently enable the experimental preference.

Use existing exploration-availability normalization.

Preferred behavior:

```text
apply saved semantic state
→ normalize to the nearest currently supported presentation
→ surface a concise nonfatal message that the requested layout is unavailable
```

If repository behavior strongly favors refusing Apply instead, that is acceptable if clearly surfaced and tested.

Do not crash or mutate feature flags.

Renderer failure fallback should similarly reuse current availability logic.

---

# Apply transaction

Applying a Saved View changes several pieces of in-memory graph state together.

Make it one orchestrated action from the user's perspective.

Recommended order:

1. validate/reconcile saved snapshot against the **current** ProjectionWorkspace;
2. resolve currently available Scope/Layout;
3. cancel/close transient graph actions that cannot safely survive the jump;
4. replace graph projection state;
5. set presentation/layout mode;
6. adopt reconciled semantic viewport bookmarks;
7. issue the active renderer's semantic restore request only after its normal readiness/final-generation gate;
8. synchronize the query draft to the newly applied canonical query;
9. persist the resulting ordinary KG9 current view through the existing path.

Do not expose intermediate half-applied frames if avoidable.

Do not perform a new canonical workspace parse/resolution.

Do not touch source content.

---

# Transient editing safety

Before applying a Saved View, handle current editing owners deliberately.

## Arrange Folders

If there is a dirty uncommitted SPATIAL2 draft:

```text
do not silently discard it
```

Use the existing dirty-draft protection.

Either:

- disable Apply Saved View with a concise explanation until the user Applies/Cancels the spatial draft; or
- invoke the existing confirmed cancellation behavior.

Do not create a new competing dirty-state system.

## Temporary File Move / PHYSICS1

If a direct File move is actively held/settling:

```text
cancel/release through the existing lifecycle before changing projection
```

Do not persist transient physical coordinates.

## Other overlays

Saved Views popover itself closes after successful Apply.

Other shell state is transient and is not part of the Saved View.

---

# Graph selection / Inspector / Search

Saved Views do not persist selection.

On Apply:

```text
clear controlled graph selection
```

so an old selected File/Heading does not falsely appear to belong to the Saved View.

The Inspector should therefore clear naturally through existing selection ownership.

Do not clear the user's source workspace or canonical search index.

Search input text may remain session-local if current product behavior prefers it, but it must not be persisted into the Saved View.

No automatic node selection should occur merely because a viewport anchor is restored.

---

# Graph Back/Forward history policy

Do not partially mix Named Saved Views with the existing navigation stack.

Existing Back/Forward does not represent all of the semantic Layout changes required by a Saved View, and SAVED1A should not expand transient history into a persistence-profile system.

Therefore:

```text
Apply Saved View
→ clear graph Back/Forward history
```

and establish the applied Saved View as the new navigation baseline.

This is analogous to a deliberate workspace-context jump, not clicking a graph neighbor.

Document this behavior.

Do not append 10 individual history entries while replaying depth/query/focus actions.

Use one state replacement.

Future work can reconsider full Saved-View-aware history if there is user evidence for it.

---

# Live-vault reconciliation

Saved Views must survive normal workspace evolution as well as KG9 can.

Examples:

## File renamed/moved but stable EntityId survives

```text
Focus Saved View
→ still restores that File
```

## Expanded Heading disappeared

```text
drop stale expansion
→ report nonfatal restore issue
```

## Focus root deleted

```text
do not fuzzy-pick another File
→ existing conservative restore exits/falls back from Focus
→ surface issue
```

## Viewport anchor deleted

```text
fallback to Fit through current semantics
```

## Path query no longer matches

Use existing view-state issue handling.

Do not rewrite the stored Saved View automatically after reconciliation.

A Saved View is an immutable user snapshot until the user explicitly chooses:

```text
Update
```

This is important.

---

# Saved View mutations

Implement:

```text
Save current view
Apply
Update
Rename
Delete
```

## Save

- validates trimmed unique name;
- captures current normalized snapshot;
- writes registry before adopting UI state.

## Update

Explicitly replaces that Saved View's snapshot with the current normalized state.

Do not silently auto-update a Saved View while the user navigates.

The whole value of Saved Views is that they remain stable bookmarks.

## Rename

- preserve snapshot exactly;
- enforce name bounds/uniqueness;
- deterministic sort.

## Delete

- remove only that Named Saved View;
- confirmation recommended;
- does not alter current graph state.

All mutations must be write-before-adopt for durable storage, following current repository transaction patterns.

If durable save fails:

```text
keep the previously confirmed registry active
show error
do not pretend mutation succeeded
```

---

# Active / modified indication

Keep v1 simple but useful.

If practical, derive whether the current normalized graph snapshot exactly matches a Saved View.

Potential UI:

```text
Language Overview        Current
Associated Value Focus
Error Audit
```

After the user changes query/depth/camera:

```text
Language Overview
```

(no longer exact).

Do not create hidden mutable "active view state" that auto-tracks edits.

The source of truth is snapshot equality.

If exact equality would be expensive or fragile because of viewport observation timing, omit the active marker in SAVED1A rather than inventing inaccurate state.

This is polish, not a release gate.

---

# Product UI

Add a first-class **Saved Views** control to the graph workspace chrome.

This is daily navigation, not an Advanced/Sandbox setting.

Recommended placement:

```text
Back / Forward
Scope / Layout
Saved Views
Filters / Groups / Settings
```

Follow current responsive/maximized toolbar conventions.

A bookmark-style icon plus accessible name is appropriate.

Do not overload the Saved Queries UI.

## Popover/panel behavior

Use existing bounded nonmodal overlay patterns.

Requirements:

- works in normal and maximized graph modes;
- viewport-bounded;
- keyboard accessible;
- Escape closes and restores trigger focus;
- outside pointer dismissal does not steal the clicked target's focus;
- no toolbar overflow regression;
- narrow viewport usable;
- no hidden per-row portals.

Suggested content:

```text
Saved Views

Name
[________________]
[Save current view]

Language Overview
All · Hierarchy
[Apply] [Update] [Rename] [Delete]

Associated Value
Focus · Network
[Apply] [Update] [Rename] [Delete]
```

Concise optional summary can include:

```text
All/Focus · Network/Hierarchy
query present
Focus root title if currently resolvable
```

Do not dump raw JSON, EntityIds, or internal renderer names.

No thumbnails in SAVED1A.

No drag-to-reorder; deterministic alphabetical order is sufficient.

---

# Naming conflict with Saved Queries

Keep concepts explicit:

```text
Saved Views
→ complete named graph context

Saved Queries
→ reusable QUERY1 definitions only
```

Applying a Saved Query continues to change only the active query.

Applying a Saved View can restore a query among the rest of the graph state.

Deleting one must never delete the other.

Do not rename Saved Queries to filters unless separately justified.

---

# What SAVED1A explicitly does NOT save

Add regression tests proving these systems remain independent.

## Graph Preferences

Do not snapshot/restore:

```text
Reference Pull
Base node size
Link influence
Link thickness
Label threshold
Folder clustering/spacing
Trackpad Zoom
Focus appearance
Modular preview policies
experimental gates
```

A Saved View applied after those preferences change uses the user's **current** preferences.

## Spatial Overrides

Do not snapshot/restore:

```text
Pull rules
Place rules
folder anchors
scope/exclusion/strength
```

A Saved View uses the currently active workspace spatial rules.

This is what SAVED1B's future spatial-profile/reference work can address.

## Presentation Overrides

Per-File Size remains workspace-global durable presentation intent.

## Visual Groups

Saved View does not change group definitions, priority, enable state, or colors.

## Saved Query registry

Definitions stay untouched.

## Current shell state

Do not persist:

```text
Network Explorer open
Inspector open
Settings open
Filters open
Groups open
Saved Views popover open
maximized state
```

---

# Current automatic KG9 view persistence

Do not replace the existing "resume where I left off" behavior.

There are now two different concepts:

```text
CURRENT VIEW
automatic KG9 workspace resume state
one per workspace
updated as user works

NAMED SAVED VIEWS
explicit immutable bookmarks
many per workspace
changed only by Save/Update/Rename/Delete
```

Keep them separate in storage and code.

Applying a Named Saved View should naturally make the KG9 Current View become that applied state through the existing current-view persistence flow.

On next app launch:

```text
resume last current view
```

not:

```text
automatically reopen last named Saved View by identity
```

No new "activeSavedViewId" persistence in v1.

---

# Reset behavior matrix

After this feature the product must be unambiguous.

## Reset current view

Resets only:

```text
KG9 current workspace view
```

Does not delete:

```text
Named Saved Views
Saved Queries
Visual Groups
Graph Preferences
Spatial rules
per-File Size
identity state
```

## Reset Saved Views registry / corruption recovery

If implemented, resets only:

```text
Named Saved Views for this workspace
```

Does not change current graph state.

## Delete Saved View

Deletes only one named entry.

Add cross-registry tests.

---

# Suggested implementation areas

Likely areas to inspect/edit:

```text
AGENTS.md

packages/view-state/*
packages/view-projection/* only if a genuinely reusable helper is missing

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/README.md
apps/web/src/components/
  new SavedViews control/popover/panel

apps/web/src/persistence/storage.ts
apps/web/src/persistence/session.ts
apps/web/src/persistence/
  new saved-views.ts (likely)

apps/web/src/navigation-history.ts
apps/web/src/exploration-model.ts
apps/web/src/graph-state.ts
apps/web/src/preferences/graph-preferences.ts
apps/web/src/use-graph-query-draft.ts or current path

docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/PRODUCT_QUALITY_AUDIT.md if relevant
apps/web/README.md

history-implementations/
```

Do not force edits in every file listed.

Inspect current architecture first and choose the narrowest correct implementation.

---

# Tests

## Registry

Test:

1. empty registry;
2. deterministic serialization;
3. alphabetical sorting;
4. case-insensitive duplicate names rejected;
5. name bounds;
6. max-entry bound;
7. wrong workspace rejected;
8. malformed entry rejected;
9. embedded view-state validation reused;
10. invalid layout rejected;
11. corrupt JSON load does not mutate storage;
12. failed write does not adopt mutation.

## Capture

Test saved snapshots for:

```text
All + Network
All + Hierarchy if currently available
Focus + Network
Focus + Hierarchy
```

Capture:

- active query;
- depth;
- Heading limit;
- Blocks;
- expanded/collapsed state;
- Focus root/hops/direction;
- semantic viewports.

Prove transient selection/query draft/panel state absent.

## Apply

For each supported Scope/Layout:

```text
start from unrelated view
→ Apply Saved View
→ final graph state equals reconciled saved snapshot
→ correct renderer presentation active
→ semantic viewport restored
→ selection cleared
→ history cleared
```

## Focus Layout

Critical:

```text
save Focus + Network
change current Focus layout to Hierarchy
apply saved view
→ Focus + Network
```

and the reverse.

## Missing entities

- renamed stable File still restores;
- deleted Focus root degrades conservatively;
- missing viewport anchor fits;
- missing disclosure entities dropped;
- stored view remains unchanged after degraded apply.

## Independence

Applying/updating/deleting Saved Views must not mutate:

- Saved Queries registry;
- Visual Groups registry;
- spatial-overrides registry;
- presentation-overrides registry;
- Graph Preferences other than any narrowly unavoidable live Focus layout field;
- source data.

## Current-view naming/reset

Prove:

```text
Reset current view
→ named Saved Views remain
```

and user-facing old "Reset saved view" wording no longer appears where ambiguous.

## Query draft

Apply a Saved View with query `A`.

Start from:

```text
applied query B
dirty draft C
```

After Apply:

```text
applied query = A
draft UI = A
no stale dirty warning for C
```

## Editing arbitration

- dirty Arrange Folders draft cannot be silently lost;
- active direct File move cancels safely before apply;
- applying view during worker/layout pending follows latest-generation viewport gate.

## UI/accessibility

- trigger accessible in normal and maximized modes;
- keyboard open/close;
- initial focus sensible;
- Escape restores trigger focus;
- outside click behavior;
- list controls reachable by keyboard;
- rename validation announced;
- delete confirmation;
- narrow viewport no clipping/overflow;
- no duplicate IDs between normal/maximized surfaces.

---

# Performance / operation-count expectations

Saved Views are small registries.

No heavy benchmark milestone is required, but add operation-count evidence where useful.

Saving/Renaming/Deleting a Saved View must cause:

```text
0 canonical parsing
0 workspace resolution
0 projection recomputation unless current graph state actually changes
0 graph layout
0 camera movement
```

Applying a Saved View may legitimately trigger:

- projection change;
- renderer switch;
- Network/Dagre layout required by that restored view;
- semantic viewport restore.

It must not replay each stored field as separate expensive actions.

Use one normalized state replacement/application path.

Applying an exact-equivalent Saved View should avoid needless work where current architecture makes that straightforward.

---

# Browser / native QA

Use current production build.

Create at least these Named Saved Views on Synthetic Sample or another safe fixture:

```text
1. All Network + query
2. Focus Network with custom hops
3. Focus Hierarchy with non-default depth/Blocks
```

Then verify:

1. Save all three.
2. Navigate/change query/layout/camera heavily.
3. Apply each and verify correct state.
4. Pan/zoom immediately before Save and verify viewport restore.
5. Change global visual/layout preferences; apply an older Saved View and verify those preferences do **not** revert.
6. Change spatial folder rules; apply Saved View and verify spatial rules do **not** revert.
7. Set a per-File Size and Visual Group; apply Saved View and verify both remain.
8. Delete a Saved Query used at capture time; Saved View still restores its captured canonical query.
9. Rename/move focused File through live vault update; Saved View follows stable identity.
10. Delete focus root; applying view degrades safely with clear feedback.
11. Reset Current View; Named Saved Views remain.
12. Reload app; Named Saved Views remain for stable workspace.
13. Switch workspace; registries stay isolated.
14. Normal/maximized/narrow UI passes.
15. No console errors/warnings attributable to SAVED1A.

Native Tauri release QA should at minimum cover:

- Saved Views persistence after restart;
- keyboard/pointer popover interaction;
- apply across Network/Hierarchy;
- Focus restore;
- physical pan/zoom → Save → Apply viewport accuracy.

Do not merge until required native/product QA is explicitly accepted according to current repository practice.

---

# Roadmap / docs update

Update the roadmap from one vague future item to:

```text
SAVED1 — Named Saved Views
  SAVED1A — Named semantic graph bookmarks
  SAVED1B — settings/spatial profile composition
```

After implementation/merge:

```text
SAVED1A Complete
SAVED1B Later
```

Document the key boundary:

```text
Saved View = explicit named graph context
Current View = automatic resume state
Saved Query = reusable query only
```

Document why settings/spatial profiles remain separate.

Do not mark full SAVED1 complete if SAVED1B remains intentionally deferred.

---

# PR / implementation workflow

Use an isolated task branch/worktree.

Do not disturb unrelated local changes, `.pnpm-store/`, or other active worktrees.

At completion:

1. archive this prompt under `history-implementations/`;
2. add a concise `SAVED1A_implementation_status.md`;
3. create/update the PR with exact behavior and validation evidence;
4. keep the PR gated according to current graphical/native QA policy;
5. after explicit approval, merge through the PR;
6. verify post-merge CI;
7. clean only SAVED1A's branch/worktree.

Do not automatically begin SAVED1B.

---

# Validation

Inspect `AGENTS.md` first and follow current commands.

Expected core validation, adjusted to current repository reality:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/view-state
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Run focused suites for:

```text
saved-views registry
GraphExplorer apply/capture
navigation-history clear policy
query draft synchronization
current-view reset independence
cross-registry independence
live reconciliation
normal/maximized popover accessibility
```

Run production-browser QA and fresh optimized desktop QA.

No external dependency should be necessary.

---

# Exit gate

SAVED1A is complete only when:

1. Named Saved Views are workspace scoped.
2. Stable workspaces persist them across restart.
3. Schema is strict/versioned/deterministic.
4. Save current view works.
5. Apply works.
6. Update works.
7. Rename works.
8. Delete works.
9. Names are bounded and case-insensitively unique.
10. All + Network restores correctly.
11. All + Hierarchy restores correctly when available.
12. Focus + Network restores correctly.
13. Focus + Hierarchy restores correctly.
14. Focus Network/Hierarchy does not depend on the later current layout preference.
15. Focus root/hops/direction restore.
16. Query and existing graph filters restore.
17. Hierarchy depth/Heading limit/Blocks restore.
18. Manual disclosure restores.
19. Semantic viewport bookmarks restore.
20. No raw renderer/worker coordinates are stored.
21. Missing entities use existing conservative reconciliation.
22. Missing viewport anchor falls back safely.
23. Deleted Focus root never fuzzy-retargets.
24. Stored Saved View is not auto-rewritten after degraded restore.
25. Applying a view clears stale graph selection.
26. Applying a view clears Back/Forward history as one named workspace jump.
27. Query draft synchronizes to applied query.
28. Dirty Arrange Folders state is not silently discarded.
29. transient File Move/physics state cancels safely.
30. Graph Preferences remain independent.
31. Spatial Pull/Place rules remain independent.
32. per-File Size remains independent.
33. Visual Groups remain independent.
34. Saved Query definitions remain independent.
35. Saved Views do not persist shell panels/drawers/maximized state.
36. existing automatic KG9 Current View persistence remains.
37. applying a Named Saved View naturally updates the ordinary Current View afterward.
38. user-facing `Reset saved view` ambiguity is removed.
39. Reset Current View does not delete Named Saved Views.
40. corrupt Saved Views storage does not break the graph or get silently overwritten.
41. storage failures do not falsely adopt mutations.
42. workspace switching isolates registries.
43. live rename/move stable identity behavior works.
44. UI works in normal/maximized/narrow modes.
45. keyboard/focus behavior is accessible.
46. no toolbar overflow regression.
47. no unnecessary canonical/workspace computation is introduced.
48. focused tests pass.
49. full `pnpm check` passes.
50. desktop check/build pass.
51. browser QA passes.
52. optimized native QA passes or remains explicitly gated.
53. docs/roadmap accurately distinguish SAVED1A from SAVED1B.
54. prompt/status archived.
55. PR CI passes.
56. post-merge CI passes.
57. task worktree/branch cleanup completes.

---

# Final report

Report:

## Summary
What the user can now do.

## Saved View schema
Registry shape, limits, storage key, validation and stable-workspace policy.

## Captured state
Exact list of what a Saved View contains.

## Deliberately excluded state
Graph Preferences, spatial rules, Groups, per-File Size, Saved Query definitions, shell state.

## Scope/Layout restore
Especially Focus Network vs Focus Hierarchy.

## View reconciliation
Rename/move/deletion and viewport fallback behavior.

## History policy
Confirm Apply clears Back/Forward and why.

## Current View terminology
Confirm `Reset current view` behavior and Named Saved Views independence.

## UI/accessibility
Trigger, popover, Save/Apply/Update/Rename/Delete, normal/maximized/narrow behavior.

## Cross-registry safety
Evidence that unrelated durable systems remain untouched.

## Performance/operation counts
Confirm mutations do no graph work and Apply uses one state replacement rather than replaying many actions.

## Validation
Focused tests, full checks, browser QA, desktop/native QA, CI.

## Files changed
List by area.

## Dependencies
Expected: none.

## Remaining work
Explicitly:

```text
SAVED1B — settings/spatial profile composition
PIN1 — persistent individual File placement
AUTO1 — adaptive automatic layout selection
```

Do not start those automatically.
