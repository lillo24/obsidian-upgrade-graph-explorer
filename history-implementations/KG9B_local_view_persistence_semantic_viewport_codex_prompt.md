# KG9B — Local View Persistence + Semantic Viewport Restoration

**Task type:** local application-state persistence / restoration / browser storage boundary

## Goal

Complete KG9 by persisting the **actual explorer view state that now exists**, using the stable workspace/entity identity delivered by KG9A.

KG9B should make a persistent report feel like the same workspace when reopened or the page is reloaded:

```text
stable workspace report
      +
saved local view state
      ↓
validate + reconcile with current snapshot
      ↓
restore disclosure / filters / focus
      ↓
KG6 projection
      ↓
restore semantic viewport anchor
      ↓
KG7 React Flow
```

Persist only state that has demonstrated product value:

- structural disclosure;
- document/top-level view depth;
- block inclusion;
- path/entity/status graph filters;
- active focus root + hop/direction settings;
- a **semantic viewport anchor** keyed to a stable canonical entity plus zoom.

Keep transient:

- global search query/results;
- graph node/edge selection;
- provenance-inspector selection;
- hover;
- temporary UI panel disclosure;
- navigation announcements.

Do **not** invent manual node positions, pins, or named saved views merely because older roadmap text mentioned them as possibilities.

KG9B should finish the roadmap's KG9 milestone.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG9A was merged through PR #11 at:

`f66b1189ef636e35c77aed9f696ef470105680ba`

KG9A now implements:

```text
KG4 transient canonical snapshot
→ source-neutral stable reconciliation
→ stable canonical snapshot
→ diagnostics / projection / inspection
```

Persistent diagnostic runs use a private identity catalog and stable opaque workspace/entity/reference IDs.

The roadmap currently states:

```text
KG9 — In progress
KG9A stable identity complete
KG9B view persistence next
```

and explicitly recommends that KG9B may persist:

```text
renderer-independent disclosure
selected view mode
filters
focus
semantically anchored viewport
```

while keeping search, inspector selection, and graph selection transient by default.

Current browser graph state is a plain `ViewProjectionState` reducer containing:

```text
disclosure:
  defaultDepth
  expandedEntityIds
  collapsedEntityIds
  includeBlocks

focus:
  rootEntityId
  hops
  direction
  hierarchyContext

filters:
  pathPrefixes
  text
  entityKinds
  referenceStatuses
```

The currently exposed graph-filter UI uses:

```text
path scope
entity kinds
reference statuses
```

Global canonical search is separate and should remain transient.

Current React Flow renderer already supports keyed node centering:

```ts
interface GraphCenterRequest {
  readonly key: number;
  readonly nodeId: ProjectionNodeId;
  readonly zoom?: number;
}
```

but does not currently report a semantic viewport position back to the web application.

---

# Important safety issue: persistence requires identity provenance

The browser currently sees:

```text
snapshot.workspace.id
```

but that alone does **not** prove the report uses persistent stable identity.

KG9A intentionally preserved non-persistent diagnostic runs where workspace identity can still come from the vault basename.

Therefore KG9B must not blindly persist view state for every report merely because it has a workspace ID.

We need an explicit report/session signal equivalent to:

```text
identity stability = stable | transient/unknown
```

so the browser can safely decide whether view state may be restored across sessions.

Do not infer this from:

- the textual shape/prefix of IDs;
- whether the workspace ID looks like a UUID;
- entity counts;
- filenames;
- catalog paths.

Identity format is opaque.

---

# Diagnostic report identity metadata

Add the narrowest metadata necessary for the browser to know whether a report is persistence-safe.

A reasonable source-specific report field is conceptually:

```ts
interface DiagnosticIdentityMetadata {
  readonly stability: 'stable' | 'transient';
}
```

or:

```text
identityMode
```

Exact naming may follow repository conventions.

The runner knows whether stable reconciliation was active.

## Stable report

A report generated through the persistent KG9A identity catalog path should say:

```text
stable
```

## Non-persistent report

A report generated without persistent stable identity should say:

```text
transient
```

## Existing/legacy report compatibility

Do not abruptly make older KG5/KG8/KG9A report JSON unreadable.

If the report schema needs a version bump, retain a reader/normalization path for the previous schema and treat missing identity metadata as:

```text
transient / persistence disabled
```

If the current report schema conventions permit a backward-compatible optional field instead, that is acceptable.

Choose the cleanest implementation after inspecting the strict validator.

The invariant is:

> Old/unknown reports may still be explored, but cross-session view persistence is disabled unless stable identity provenance is explicit.

Do not put identity-stability metadata into the canonical KG1 `WorkspaceDescriptor`.

This is report/session provenance, not canonical source truth.

---

# Synthetic sample policy

The committed synthetic browser sample should continue to work without a private on-disk identity catalog.

Two acceptable approaches:

1. generate the sample with a deterministic in-memory stable identity setup and mark it stable; or
2. leave it transient and test persistence with dedicated synthetic stable report fixtures.

Prefer option 1 if it stays simple, because it makes browser persistence QA reproducible without private data.

Do not commit a runtime identity catalog merely for the sample.

---

# Architecture boundary

Create a source-neutral persistence-contract package, likely:

```text
packages/view-state/
```

with a package name approximately:

```text
@icarus-graph-explorer/view-state
```

Preferred dependencies:

```text
view-state
  → core
  → view-projection
```

or directly:

```text
view-state → core
view-state → view-projection
```

It must not import:

- React;
- React Flow;
- Dagre;
- renderer-reactflow;
- apps/web;
- diagnostics-obsidian;
- stable-identity;
- filesystem APIs;
- Tauri;
- Graphology;
- Sigma.

The package owns:

- versioned persisted-view contracts;
- runtime validation;
- restoration/reconciliation against the **current** `ProjectionWorkspace`;
- stale-ID cleanup;
- deterministic serialization/plain-data semantics.

It does **not** own:

- `localStorage`;
- browser events;
- report loading;
- viewport measurement;
- renderer coordinates.

Browser storage belongs in the web/application boundary.

---

# Why a source-neutral view-state package is useful

KG11/Tauri may later use a different local storage mechanism.

The durable contract should therefore be:

```text
plain persisted explorer view
```

not:

```text
localStorage blob shaped around React Flow
```

The browser currently implements the first storage adapter.

A later Tauri adapter should be able to reuse the same state schema/restore rules.

---

# Persisted view schema

Define a small versioned plain-data record.

Conceptually:

```ts
interface PersistedWorkspaceView {
  readonly schemaVersion: 1;
  readonly workspaceId: WorkspaceId;

  readonly projection: PersistedProjectionState;

  readonly viewport?: PersistedViewportAnchor;
}
```

Exact naming can differ.

Do not store timestamps unless there is a concrete product requirement.

Do not store renderer node IDs.

---

# Persisted projection state

Persist only user-facing KG6 state that is meaningful across sessions.

Recommended:

```ts
interface PersistedProjectionState {
  readonly disclosure: {
    readonly defaultDepth: 0 | 1;
    readonly expandedEntityIds: readonly EntityId[];
    readonly collapsedEntityIds: readonly EntityId[];
    readonly includeBlocks: boolean;
  };

  readonly focus?: {
    readonly rootEntityId: EntityId;
    readonly hops: 1 | 2 | 3;
    readonly direction: 'incoming' | 'outgoing' | 'both';
    readonly hierarchyContext: 'ancestors' | 'ancestors-and-children';
  };

  readonly filters?: {
    readonly pathPrefixes?: readonly WorkspacePath[];
    readonly entityKinds?: readonly EntityKind[];
    readonly referenceStatuses?: readonly ReferenceResolutionStatus[];
  };
}
```

Use actual current KG6 types rather than duplicating enums incorrectly.

## Projected text filter

The current product does not expose a primary graph projected-text filter; global canonical search is separate.

Do **not** persist a hidden/stale `filters.text` merely because KG6 supports it internally.

If repository inspection shows a real current user-facing text filter, persist it deliberately.

Otherwise strip/ignore it in persisted state.

This avoids reopening a workspace to an invisible graph because of an old internal text filter.

---

# Persisted viewport: semantic anchor, not raw React Flow transform

Do **not** persist raw renderer coordinates such as:

```text
viewport.x
viewport.y
React Flow node x/y
Dagre positions
```

The KG7 layout may change when:

- source structure changes;
- nodes expand/collapse;
- filters change;
- Dagre changes;
- renderer implementation changes.

A raw `(x, y)` transform is brittle.

Persist a semantic bookmark:

```ts
interface PersistedViewportAnchor {
  readonly anchorEntityId: EntityId;
  readonly zoom: number;
}
```

The meaning is:

> When this workspace/view is restored, center the graph on this stable canonical entity at approximately this zoom.

This survives layout recomputation much better.

Do not promise pixel-identical camera restoration.

---

# Capturing the semantic viewport anchor

`renderer-reactflow` should report a renderer observation when a viewport interaction ends.

Add a narrow callback conceptually similar to:

```ts
interface GraphViewportObservation {
  readonly anchorEntityId: EntityId | null;
  readonly zoom: number;
}

onViewportObservation?: (value: GraphViewportObservation) => void;
```

Exact naming can differ.

The renderer may calculate the visible projected **canonical entity node nearest the viewport center**.

Rules:

- choose only projected `kind: 'entity'` nodes;
- never persist a diagnostic synthetic node as viewport anchor;
- return its canonical `entityId`, not `ProjectionNodeId`;
- return current zoom;
- if no canonical entity can be determined, return `anchorEntityId: null`;
- do not expose raw viewport coordinates to the persistence package.

Use current React Flow APIs and actual container dimensions; do not approximate with source order.

The observation is renderer/application telemetry **inside the local UI only**, not analytics and not canonical truth.

---

# Viewport observation frequency

Do not write storage continuously on every pan animation frame.

Capture/update viewport state on an interaction-end event such as React Flow's current:

```text
onMoveEnd
```

or equivalent.

Programmatic:

- fit view;
- search centering;
- focus centering

may also produce a final observation if the library emits it.

That is acceptable.

Avoid high-frequency storage writes.

---

# Restoring viewport

Restoration order matters.

Correct flow:

```text
load report
  ↓
verify stable persistence eligibility
  ↓
load + validate saved view
  ↓
sanitize/reconcile saved projection state against current ProjectionWorkspace
  ↓
project + layout
  ↓
find projected node for saved anchorEntityId
  ↓
if visible: send existing GraphCenterRequest with saved zoom
if not visible/missing: normal Fit View
```

Do not:

```text
fit defaults
→ save defaults
→ later load stored state
```

or the app may overwrite the saved view during hydration.

Do not change filters/disclosure merely to satisfy an old viewport anchor.

Viewport is secondary to the restored view state.

If the anchor is no longer visible under the restored projection:

```text
ignore viewport bookmark
→ Fit View
```

Do not silently widen filters just to restore the camera.

---

# Viewport zoom validation

The source-neutral view-state package should validate:

```text
finite
positive
```

zoom values.

The renderer/web boundary may clamp the restored zoom to the current supported React Flow range.

Do not hard-code React Flow min/max values into the source-neutral package.

---

# Persisted state restoration / sanitization

Stable IDs reduce churn but do not eliminate source evolution.

A saved view may contain IDs that no longer exist.

Restoration must therefore reconcile against the current `ProjectionWorkspace`.

Create a pure function conceptually:

```ts
restorePersistedView(
  workspace,
  persisted,
): RestoredViewResult
```

Return:

```text
valid current ViewProjectionState
optional viewport bookmark
non-fatal restore issues
```

Do not crash because a heading was deleted.

---

# Disclosure reconciliation

For:

```text
expandedEntityIds
collapsedEntityIds
```

drop entity IDs absent from the current workspace.

If one ID appears in both:

```text
collapsed wins
```

or normalize according to current KG6 semantics and emit a non-fatal issue.

Preserve deterministic ordering.

Do not fabricate replacements for identities KG9A intentionally refused to match.

A newly allocated identity is a new entity from the view-store perspective.

---

# Focus reconciliation

If the persisted focus root still exists:

```text
restore focus
```

with validated:

```text
hops
direction
hierarchyContext
```

If the root no longer exists:

```text
drop active focus
preserve disclosure + filters
emit non-fatal restore issue
```

Do not choose a “similar” focus root.

Stable identity ambiguity already made the conservative decision upstream.

---

# Path-filter reconciliation

Path filters are intentionally path-based rather than entity identity.

If a persisted path prefix still matches at least one current document:

```text
keep it
```

If it matches nothing:

```text
drop it
emit non-fatal restore issue
```

This prevents an old renamed-folder filter from reopening to an unexpectedly empty graph.

Do not fuzzy-match renamed directories.

---

# Entity-kind and reference-status filters

Validate against current allowed enum values.

Preserve empty arrays if the current KG6 semantics allow “show no content/reference statuses”.

Do not silently interpret empty as “all” if that differs from current reducer behavior.

Use current KG6 contracts.

---

# Block restoration

If:

```text
includeBlocks = true
```

restore it.

Any stale block expanded/collapsed IDs are handled through normal entity-ID cleanup.

Do not create a special block persistence model.

---

# Restore issues

Use a small plain issue model, e.g.:

```text
unknown-expanded-entity
unknown-collapsed-entity
focus-root-missing
path-filter-no-longer-matches
viewport-anchor-missing
invalid-saved-state
unsupported-saved-state-version
storage-unavailable
```

Not all belong in the pure package; storage issues belong to the web adapter.

Keep the taxonomy small.

The UI should summarize restoration adjustments without making normal source evolution look catastrophic.

Example:

```text
Restored saved view. 2 removed sections were dropped from the saved disclosure.
```

---

# Browser persistence adapter

Implement a small browser-local store in `apps/web`, likely under:

```text
apps/web/src/persistence/
```

or another clear application boundary.

Use:

```text
window.localStorage
```

for KG9B.

Why localStorage is sufficient now:

- persisted state is tiny;
- reads are required at report-load time;
- writes happen only on discrete view changes / viewport end;
- no source content or large cache is stored;
- no database query/index behavior is required.

Do **not** add IndexedDB or a persistence dependency without evidence.

KG11 may later choose a desktop app-local store while reusing the same view-state schema.

---

# Storage key

Key persisted state by stable workspace ID.

Use a collision-safe key approximately:

```text
icarus-graph-explorer:view-state:<encoded workspace ID>
```

Do not include:

- absolute path;
- report filename;
- vault basename;
- user-selected report path.

Do not include the schema version only in the key such that old versions become undiscoverable; the value already has an explicit schema version.

Encoding the workspace ID is fine.

Do not depend on stable ID textual prefixes.

---

# Persistence eligibility

The web app should persist/restore only when the loaded report/session explicitly says:

```text
stable identity
```

For:

```text
transient
legacy unknown
```

the app should:

- remain fully usable;
- keep view state in memory;
- not load cross-session saved view;
- not save cross-session view;
- show a compact explanation when appropriate.

Example:

```text
View persistence is unavailable for this report because it was generated without stable identity.
```

Do not turn this into a blocking warning.

---

# LocalStorage failure behavior

Browser storage may fail because:

- privacy mode;
- disabled storage;
- quota/security errors;
- malformed stored JSON.

The graph must continue working.

On read failure:

```text
use default in-memory view
show non-fatal persistence warning
```

On write failure:

```text
keep current in-memory view
show non-fatal persistence warning
```

Do not repeatedly spam errors on every state change.

Do not silently delete corrupt/incompatible saved state.

Provide an explicit:

```text
Reset saved view
```

action when relevant.

---

# Persisted schema version

Start with:

```text
schemaVersion = 1
```

for view state.

Unknown/newer versions:

```text
do not interpret
do not overwrite automatically
```

Use default in-memory state and surface a non-fatal message.

The explicit reset action may delete it.

A migration framework is unnecessary before version 2 exists.

---

# Save timing

Persist projection state after discrete meaningful changes:

- disclosure expand/collapse;
- default depth;
- blocks toggle;
- focus enter/exit;
- focus hop/direction;
- graph filter changes;
- navigation actions that widen/reveal state.

Viewport bookmark updates on viewport move end.

Do not save:

- hover;
- search typing;
- selection;
- inspector “Show More” state;
- ephemeral error banners.

Because state is small, a sophisticated debounce library is unnecessary.

A tiny coalescing/debounce mechanism is acceptable if it prevents redundant consecutive writes.

Do not let debounced writes survive a report/workspace switch and write the old state into the new workspace key.

---

# Hydration guard

This is a critical correctness requirement.

When a report is loaded:

```text
load persisted state first
→ initialize/reconcile graph state
→ initialize viewport restore intent
→ then allow persistence writes
```

Do not let the initial documents-only default or React Flow initial fit overwrite a valid saved view before restoration completes.

Add explicit hydration/restoration state if needed.

Tests should prove this.

---

# Report switching

When loading Workspace A then Workspace B:

- save A under A's key if eligible;
- reset transient selection/search/inspector state;
- load B's saved view if eligible;
- never apply A IDs/state to B;
- viewport anchor is workspace-scoped;
- switching back to A restores A's state.

Do not use one global “last graph state” key.

---

# Reload behavior

For one stable report/workspace:

1. expand nodes;
2. set a path/status/entity filter;
3. enter or leave focus as desired;
4. pan/zoom;
5. reload the browser;
6. load/restore the same report workflow;
7. saved state should return automatically once the report is loaded.

The current app cannot remember the report file itself across browser reload because the user-selected File object is not persistently accessible.

Do **not** attempt to persist browser file handles in KG9B.

Persistence applies **after the same report is loaded again** or to the bundled stable synthetic sample on reload.

KG11 will remove this report-file friction through product-grade source access.

Document this limitation clearly.

---

# Bundled sample restoration

If the bundled sample is stable/persistence-eligible, browser reload can automatically demonstrate restoration because no file re-selection is needed.

Prefer making this work for QA.

If the sample remains transient by design, dedicated browser tests may use a synthetic stable loaded report fixture instead.

Do not weaken persistence eligibility rules just to simplify QA.

---

# Reset saved view UX

Provide a compact action:

```text
Reset saved view
```

Behavior:

1. delete saved state for current workspace;
2. reset KG6 state to `documentOnlyProjectionState()`;
3. clear focus/filter/disclosure;
4. clear viewport bookmark;
5. clear transient selection/search as appropriate;
6. fit view;
7. announce success accessibly.

Do not delete the KG9A identity catalog.

This resets **view state only**.

Use wording that cannot be confused with resetting stable identity.

---

# “Forget identity” is not KG9B

Do not expose KG9A catalog reset in the browser.

The browser report does not own the identity catalog.

Stable-identity reset remains a diagnostic/source-workflow operation.

---

# Saved views

Do not implement multiple named saved views in KG9B.

The evidence currently supports:

```text
restore my last view for this workspace
```

not:

```text
manage N named view presets
```

The view-state schema may remain extensible, but do not create a view manager, naming UI, duplication, import/export, etc.

If users later need several reusable scopes, that can become a focused follow-up.

---

# Manual positions / pins

Do not implement.

KG7 deliberately uses:

```text
nodesDraggable = false
```

and deterministic Dagre layout.

There is no actual interaction state to persist.

Do not enable dragging merely to justify persistence.

Future pin/manual positioning requires an explicit product design and likely a layout architecture decision.

---

# Search and inspector selection remain transient

Do not persist:

```text
search query
search result panel
selected graph node
selected graph edge
selected inspector occurrence
relationship pagination/show-more state
hovered node
```

Reasons:

- reopening stale selection is usually confusing;
- these are task-local rather than workspace-view configuration;
- stable navigation can reconstruct them when the user acts again.

If browser QA strongly contradicts this, report the evidence rather than silently persisting more state.

---

# Focus persistence

Persist **active focus state** because KG8 handoff identified it as meaningful view configuration and it is keyed by stable entity ID.

If the focus root survives:

```text
restore it
```

If it disappears:

```text
drop focus safely
```

Do not persist a separate historical “last focus root” when the user is currently in structure mode.

---

# Viewport anchor and focus

If active focus is restored and the saved viewport anchor is still a visible canonical entity in the focused projection:

```text
center anchor at saved zoom
```

If not:

```text
use normal focus/root fit behavior
```

Do not widen focus merely for the old viewport.

---

# Viewport anchor after filters

If saved filters hide the viewport anchor:

```text
filters win
```

Ignore the viewport bookmark and fit the restored projection.

Do not clear a user's restored filter just to honor camera state.

---

# Renderer API change

The renderer should gain only the viewport-observation callback needed by the application.

It should **not** gain:

- localStorage awareness;
- workspace ID;
- persisted-view record;
- view-state schema;
- stable-identity package dependency.

Renderer remains:

```text
ViewProjection
→ prepared renderer graph
→ React Flow
```

Viewport observation is outer interaction state.

---

# Renderer viewport tests

Add focused tests/helpers for:

- choosing the nearest canonical entity node to viewport center;
- diagnostic synthetic nodes ignored as anchors;
- empty graph → null anchor;
- zoom reported;
- deterministic tie-breaking;
- no mutation;
- stale/removed nodes safe.

If the center-selection helper depends on DOM geometry, isolate as much pure math as practical.

Browser QA validates actual `onMoveEnd`.

---

# Restore centering using existing GraphCenterRequest

Do not create a second competing viewport-restore mechanism.

After restored projection/layout exists:

1. locate projected entity node whose `entityId === anchorEntityId`;
2. create keyed `GraphCenterRequest`;
3. use saved/clamped zoom.

If no node exists:

```text
fit view
```

This reuses KG8's already-tested targeted centering path.

---

# View-state package API direction

A small public API may look conceptually like:

```ts
validatePersistedWorkspaceView(value)

restorePersistedWorkspaceView({
  workspace,
  persisted,
}): RestoredWorkspaceView
```

with a helper to create the persistable subset from current state:

```ts
createPersistedWorkspaceView({
  workspaceId,
  state,
  viewport,
})
```

Exact naming may differ.

The package should be plain-function oriented.

Do not create a mutable store framework.

---

# Restore result

Conceptually:

```ts
interface RestoredWorkspaceView {
  readonly state: ViewProjectionState;
  readonly viewport?: PersistedViewportAnchor;
  readonly issues: readonly ViewRestoreIssue[];
}
```

`state` must be valid current KG6 state.

Do not return stale IDs and rely on KG6 warnings later when KG9B can clean them proactively.

---

# Current state → persistable state

Normalize before saving:

- deterministic ID order;
- remove duplicate expanded/collapsed IDs;
- apply collapsed-wins convention;
- exclude non-user-facing projected text filter unless now exposed;
- validate all enum/range fields;
- keep only stable canonical entity IDs supplied by state.

Do not store `ProjectionNodeId`.

---

# Stable workspace evolution test

KG9A exists specifically to make this work.

Create an integration scenario:

## Revision 1

Stable snapshot/report contains:

```text
Document A
  Section One
  Section Two
```

Saved view:

- A expanded;
- Section One expanded/focused if desired;
- a filter;
- viewport anchored to Section One.

## Revision 2

Perform a supported normal edit:

- source offsets shift;
- new sibling section inserted;
- stable identity reconciliation preserves A / Section One IDs.

Restore old view against Revision 2.

Expected:

- known disclosures survive;
- focus survives when its ID survives;
- viewport anchor survives;
- new section appears according to normal projection semantics;
- no old transient offset IDs are required.

This is a major KG9 exit test.

---

# Conservative identity-loss test

Create a revision where KG9A intentionally allocates a new ID for a weak/ambiguous rename.

Saved state references the old ID.

Expected:

```text
stale disclosure dropped
focus dropped if affected
viewport anchor ignored if affected
rest of view restored
non-fatal issue surfaced
```

Do not attempt a second layer of fuzzy view-state reconciliation.

KG9A already decided continuity was uncertain.

---

# Privacy

Persisted browser view state is local private application data.

It may contain:

- opaque stable IDs;
- workspace ID;
- path filter prefixes.

It must not contain:

- Markdown source text;
- raw source snippets;
- report JSON;
- identity catalog;
- absolute filesystem paths;
- search history.

No telemetry/upload.

Document how users can clear the saved view.

Do not log the complete persisted record to the console.

---

# Storage size

The persisted view should remain small:

```text
O(number of explicitly expanded/collapsed entities)
```

not:

```text
O(entire snapshot)
```

Do not store all visible node IDs.

Do not store all graph edges.

Do not store cached projection/layout.

---

# Performance

KG9B does not need a major benchmark milestone.

Add non-gating micro evidence only if useful:

```text
view-state validation/restore
serialization
```

on a synthetic state with many expanded IDs.

The important performance test is that restoration does not trigger repeated full saves/reprojects during hydration.

Do not add budgets.

---

# Browser QA — stable synthetic/sample

Required sequence:

1. load a persistence-eligible synthetic report;
2. verify default documents-only state;
3. expand a document and nested section;
4. switch default/top-level view if available;
5. set path scope;
6. change entity/status filters;
7. enter focus;
8. change hops/direction;
9. pan/zoom so a canonical entity is near viewport center;
10. reload/reopen same stable report;
11. verify disclosure/filter/focus restored;
12. verify viewport centers on semantic anchor at similar zoom;
13. verify search query is **not** restored;
14. verify inspector/graph selection is **not** restored;
15. use Reset saved view;
16. verify defaults + fit view;
17. reload again and verify reset persisted.

No console errors/warnings except deliberately tested non-fatal persistence messages.

---

# Browser QA — report switching

Use two stable synthetic workspaces.

1. customize A;
2. load B;
3. customize B differently;
4. load A again;
5. A restores its own state;
6. B state never leaks to A;
7. load B again;
8. B restores its own state.

---

# Browser QA — transient report

Load a transient/legacy report.

Expected:

- graph works normally;
- no previous stable view is applied;
- no cross-session state is saved;
- persistence-unavailable status is understandable;
- no blocking modal/error.

---

# Browser QA — source evolution

Use two synthetic stable reports sharing workspace identity and KG9A-reconciled stable IDs.

Verify:

- supported edit → view survives;
- deleted/new-identity target → stale references dropped gracefully;
- viewport fallback works.

Do not use private Icarus edits for this.

---

# Real Icarus QA

Use the ignored real stable report generated with KG9A identity.

Required local check:

1. customize disclosure/filter/focus;
2. pan/zoom;
3. reload/reselect the same report;
4. verify state restoration;
5. regenerate the private report from the unchanged vault/catalog;
6. load new report;
7. verify view state still applies to stable IDs;
8. no private artifact becomes tracked.

Report aggregate behavior only.

Do not reveal private note names/path filters in the final report.

---

# LocalStorage tests

Browser storage adapter tests should cover:

- save/load by workspace;
- two workspaces isolated;
- clear one workspace;
- malformed JSON;
- unsupported view-state schema;
- storage getter throws;
- storage setter throws;
- old value not silently overwritten on failed validation;
- transient workspace never saved;
- stable workspace saved.

Use an injected Storage-like test double rather than relying on the real browser localStorage in unit tests.

---

# Diagnostic report tests

If identity metadata is added/bumped:

- stable metadata round-trips;
- transient metadata round-trips;
- legacy/missing metadata follows explicit compatibility policy;
- malformed identity metadata rejected;
- persistent runner emits stable;
- non-persistent runner emits transient;
- synthetic sample's declared mode matches its actual ID-generation policy.

Do not let diagnostics metadata affect canonical snapshot validation.

---

# View-state pure tests

At minimum:

## A. Round trip

Persisted schema validates through JSON.

## B. Exact restore

Same workspace/snapshot restores all persisted supported state.

## C. Workspace mismatch

Reject.

## D. Unknown expanded ID

Dropped + issue.

## E. Unknown collapsed ID

Dropped + issue.

## F. Same ID expanded/collapsed

Normalize according to KG6 convention.

## G. Missing focus root

Focus dropped + issue.

## H. Path prefix still valid

Kept.

## I. Path prefix gone

Dropped + issue.

## J. Entity/status filters

Preserved exactly.

## K. Non-user-facing text filter

Not persisted unless current product explicitly exposes it.

## L. Viewport anchor present

Preserved.

## M. Viewport anchor missing

Dropped/issue.

## N. Invalid zoom

Reject or safely drop according to documented validation policy.

## O. Determinism

Same state → same serialized record.

## P. Canonical immutability

No snapshot/projection workspace mutation.

---

# Web integration tests

Cover state orchestration:

- hydrate before autosave;
- initial default does not overwrite stored view;
- report switch rehydrates;
- reset deletes + defaults;
- search/selection not persisted;
- navigation-mutated disclosure/filter is persisted;
- focus settings persisted;
- viewport observation updates saved bookmark;
- stale anchor triggers fit fallback;
- persistence-disabled report never writes;
- one storage failure produces nonfatal app state.

---

# No persistence of renderer graph data

Hard boundary.

Never save:

```text
React Flow Node[]
React Flow Edge[]
Dagre x/y
ProjectionNodeId
ProjectionEdgeId
hover state
prepared renderer graph
```

Persist stable **canonical** entity IDs plus renderer-independent view semantics.

---

# No schema-v1 canonical change

Default:

```text
KnowledgeSnapshot schema version 1 remains unchanged
```

KG9A already made the opaque IDs durable.

Do not add view-state fields to:

```text
WorkspaceDescriptor
DocumentEntity
SectionEntity
BlockEntity
Reference
```

View state belongs outside canonical truth.

---

# No new external dependencies

Expected:

```text
no new external runtime dependency
```

Use:

- current workspace packages;
- browser `localStorage`;
- existing React/React Flow APIs.

Do not add:

- Zustand;
- Redux;
- Dexie;
- idb;
- localForage;
- database packages.

If actual implementation produces clear evidence localStorage is insufficient, stop and report before introducing a storage layer.

---

# State management

Do not install Zustand in KG9B by default.

Current graph state is already a reducer.

Add persistence/hydration orchestration around it.

A small custom hook such as:

```text
usePersistedGraphView
```

is acceptable in the web app if it keeps lifecycle logic isolated.

Do not move browser storage into KG6.

---

# UI

Keep persistence UI minimal.

Suggested additions:

- compact status when a saved view was restored/adjusted;
- `Reset saved view` button when persistence is active;
- optional concise note when the report is transient and cannot persist.

Do not add:

- persistence settings page;
- named view manager;
- import/export;
- sync controls.

---

# Accessibility

Persistence is mostly invisible, so announce meaningful programmatic restoration/reset changes.

Examples:

```text
"Restored saved graph view."
"Restored saved view with 2 stale items removed."
"Saved view reset."
```

Use the existing accessible status/aria-live pattern.

Do not announce every localStorage write.

---

# Documentation

Likely update:

```text
packages/view-state/README.md
packages/diagnostics-obsidian/README.md
packages/renderer-reactflow/README.md
apps/web/README.md
apps/web/src/components/README.md
tools/vault-diagnostics/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
README.md
eslint.config.*
```

Possibly update ADR 0006 only if clarifying how stable identity enables view persistence; do not rewrite its decision.

A new ADR is probably **not** required unless implementation makes a major storage-boundary decision beyond the architecture already planned.

---

# Architecture documentation must record

After KG9B:

```text
stable canonical snapshot
    ↓
ViewStateStore (app-local)
    + current snapshot
    ↓
view-state restore/reconciliation
    ↓
ViewProjectionState
    ↓
KG6 projection
```

and:

```text
semantic viewport bookmark
= stable EntityId + zoom

not:
raw React Flow x/y
```

Also record:

- browser `localStorage` is the current adapter, not the durable domain contract;
- persistence only activates for explicitly stable-identity sessions/reports;
- stale IDs are dropped, never fuzzy-rematched;
- search/selection remain transient;
- saved views/manual positions remain deferred.

---

# Roadmap status

When KG9B passes:

```text
KG9 — Complete
```

with outcome approximately:

```text
stable app-owned identity + local restoration of renderer-independent view state and semantic viewport
```

Then:

```text
KG10 — next
```

Do not start KG10 automatically.

---

# Scope

## In scope

- inspect KG9A current state;
- explicit diagnostic-report identity-stability metadata;
- legacy/transient compatibility;
- source-neutral versioned view-state package;
- runtime persisted-view validation;
- stale-state reconciliation against current ProjectionWorkspace;
- disclosure persistence;
- default depth persistence;
- blocks persistence;
- path/entity/status filter persistence;
- active focus persistence;
- semantic viewport anchor + zoom;
- renderer viewport observation callback;
- reuse existing renderer center request for restore;
- web localStorage adapter;
- stable-workspace keyed storage;
- hydration guard;
- persistence eligibility;
- reset saved view;
- nonfatal storage/restore issues;
- report-switch isolation;
- stable-source-revision tests;
- synthetic browser persistence QA;
- ignored real-report persistence QA;
- architecture/roadmap/docs reconciliation;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- named saved views;
- multiple user presets;
- node dragging;
- pins;
- manual positions;
- raw x/y viewport persistence;
- search persistence;
- selection persistence;
- inspector pagination persistence;
- browser file-handle persistence;
- IndexedDB;
- Tauri;
- source-provider work;
- incremental deltas;
- file watching;
- source editing;
- identity fuzzy matching;
- graph analytics;
- workers;
- performance budgets;
- cloud sync;
- accounts.

Do not begin KG10 automatically.

---

# Suggested implementation sequence

## 1. Inspect current report/graph/renderer contracts

Confirm exact reducer state, report validator, stable-run signaling, and React Flow viewport APIs.

## 2. Decide report identity metadata compatibility

Stable/transient/legacy behavior first.

## 3. Define source-neutral view-state schema

Keep it small.

## 4. Implement runtime validation + normalization

Pure tests.

## 5. Implement restore reconciliation against ProjectionWorkspace

Stale IDs/focus/path filters.

## 6. Add web localStorage adapter

Storage-like injectable tests.

## 7. Add hydration lifecycle

Load before autosave.

## 8. Add renderer semantic viewport observation

Canonical entity anchor + zoom only.

## 9. Restore viewport through existing center request

Fit fallback.

## 10. Persist current graph interactions

Discrete state changes + move end.

## 11. Add reset saved view

Accessible status.

## 12. Add synthetic stable report/revision tests

Supported edit + identity loss.

## 13. Browser QA

Synthetic, report switching, transient, real ignored report.

## 14. Documentation consistency pass

Mark KG9 complete / KG10 next.

## 15. PR → CI → merge → post-merge CI → cleanup

Follow `AGENTS.md`.

---

# Validation commands

Run focused + repository checks.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/diagnostics-obsidian typecheck
pnpm exec vitest run packages/diagnostics-obsidian

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter <vault-diagnostics-package> typecheck
pnpm exec vitest run tools/vault-diagnostics

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run browser QA:

```text
stable synthetic/sample
two-workspace isolation
transient/legacy report
supported stable source revision
identity-loss revision
ignored real stable Icarus report
```

PR CI and post-merge main CI must pass.

---

# Exit gate

KG9B is complete only when:

1. Persistence only activates for explicitly stable-identity report/session data.
2. Legacy/transient reports remain usable without unsafe cross-session restore.
3. A source-neutral versioned view-state package exists.
4. It does not depend on React/renderers/source adapters/storage APIs.
5. Persisted records are runtime validated.
6. Records are keyed by stable workspace ID.
7. Disclosure/default depth persists.
8. Expanded/collapsed IDs persist using stable canonical entity IDs.
9. Blocks inclusion persists.
10. User-facing path/entity/status graph filters persist.
11. Hidden/internal projected text filters are not accidentally persisted.
12. Active focus root/hops/direction/context persist.
13. Missing focus root is dropped safely.
14. Stale disclosure IDs are dropped safely.
15. Invalid old path scopes are dropped safely.
16. View restoration never fuzzy-rematches stale identities.
17. Viewport persistence uses stable canonical entity anchor + zoom.
18. Raw React Flow/Dagre coordinates are not persisted.
19. Diagnostic synthetic nodes are never viewport anchors.
20. Renderer reports semantic viewport observation only at bounded interaction frequency.
21. Existing GraphCenterRequest is reused for viewport restoration.
22. Missing/filtered viewport anchors fall back to Fit View.
23. Viewport restoration never widens filters.
24. Hydration occurs before autosave.
25. Default initial state cannot overwrite a valid saved view during load.
26. LocalStorage failures are nonfatal.
27. Corrupt/unsupported saved state is not silently deleted/overwritten.
28. Reset saved view is explicit and does not reset KG9A identity.
29. Different workspaces have isolated saved state.
30. Switching reports does not leak old IDs/state.
31. Search query/results remain transient.
32. Graph/inspector selection remains transient.
33. Named saved views are not invented.
34. Manual positions/pins are not invented.
35. Supported KG9A source revisions preserve applicable view state.
36. KG9A identity-loss cases drop only affected view references and preserve the rest.
37. Synthetic browser persistence QA passes.
38. Real ignored Icarus persistence QA passes.
39. No private report/catalog/view dump is committed.
40. Existing KG1–KG9A tests remain green.
41. No external persistence/state dependency is added without explicit evidence.
42. Architecture/docs are reconciled.
43. KG9 is marked complete.
44. KG10 is marked next.
45. PR CI passes.
46. Post-merge main CI passes.
47. Branch cleanup is complete and worktree is clean.

Do not begin KG10.

---

# Final report

Report:

## 1. Summary

What view persistence now restores.

## 2. Architecture

State exact boundary:

```text
stable workspace/entity identity
→ versioned view-state contract
→ browser localStorage adapter
→ KG6 state
→ semantic viewport restore
```

## 3. Persistence eligibility

Explain stable/transient/legacy report behavior and any diagnostic-report schema change.

## 4. Persisted schema

List exactly what is persisted and what remains transient.

## 5. Restoration reconciliation

Explain:

- stale expanded/collapsed IDs;
- missing focus root;
- stale path filters;
- block behavior;
- no fuzzy rematching.

## 6. Viewport persistence

Explain:

- how the renderer chooses semantic anchor;
- when observations occur;
- `EntityId + zoom`;
- fit fallback;
- why raw x/y is not persisted.

## 7. Browser storage

Explain:

- localStorage keying;
- error behavior;
- hydration guard;
- save timing;
- report switching;
- reset.

## 8. Source evolution

Report synthetic supported-edit and identity-loss behavior.

## 9. Real Icarus QA

Aggregate only:

- restore success;
- unchanged regenerated report behavior;
- stale item count if any.

Do not reveal private paths/names.

## 10. Dependencies

List any additions.

Expected normally: zero external runtime dependencies.

## 11. Tests / validation

Every command actually run, test counts, build, browser QA, PR CI, post-merge CI.

## 12. Privacy

Confirm browser saved state contains no source body/report/catalog/absolute path and no private artifact was committed.

## 13. Files changed

Important package/web/renderer/diagnostic/docs areas.

## 14. Documentation reconciliation

Confirm:

```text
KG9 complete
KG10 next
```

and the final persisted/non-persisted state policy.

## 15. Deviations / warnings

Surface:

- localStorage limitations;
- browser report re-selection limitation;
- view state intentionally lost when KG9A refuses identity continuity;
- viewport approximation limitations;
- any reason KG10 should be blocked.

## 16. KG10 handoff

State what the incremental workspace engine can now rely on:

- stable workspace/entity/reference identity;
- browser reports with explicit identity provenance;
- app view state keyed to stable canonical IDs;
- stale identities are tolerated safely;
- projection/search/renderer layers consume normal stable schema-v1 snapshots;
- full-snapshot reconciliation remains the correctness baseline that incremental deltas must reproduce;
- view persistence should survive incremental updates as long as stable IDs survive.

Do not implement KG10 automatically.
