# KG11B2 — Live Vault Orchestration + KG10 Updates + View-State Preservation

**Task type:** desktop live-source integration / transactional incremental updates / UI state reconciliation / recovery

## Goal

Complete KG11 by applying KG11B1 source-change plans to the retained KG10 engine and updating the existing graph application **in place**.

Target desktop runtime:

```text
selected vault
→ KG11B1 recursive watcher
→ coalesced VaultWatchBatch
→ filesystem re-observation
→ VaultSourceChangePlan
→ KG10 applyObsidianWorkspaceChanges()
→ candidate stable snapshot/catalog/delta
→ build candidate in-memory diagnostic report
→ persist candidate KG9A catalog
→ atomically adopt new runtime/report
→ existing graph updates without remounting
→ KG9 disclosure/filter/focus/viewport preserved
```

When KG11B1 returns:

```text
resync-required
```

or the runtime becomes out of sync, perform a safe complete source rescan/reinitialization while keeping the current visible graph until a valid replacement is ready.

KG11B2 should finish:

```text
KG11 — Tauri local-vault workflow
```

and make KG12 next.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG11B1 merged through PR #18 at:

`a10ceaec9b51dca3477a26fefbb14c8bf820487a`

Current roadmap:

```text
KG11 — In progress
KG11A — Complete
KG11B1 — Complete
KG11B2 — Next
```

KG11B1 now exposes:

```ts
watchSelectedVault()
reconcileSelectedVaultChanges()
VaultWatchBatch
VaultSourceChangePlan
VaultChangeReconciliationResult
```

`VaultSourceChangePlan` contains:

```ts
markdownChanges: readonly VaultSourceChange[]
nextInventory: VaultSourceInventory
nonMarkdownChanged: boolean
affectedPaths: readonly WorkspacePath[]
```

and source changes are:

```ts
upsert(path, source)
delete(path)
move(fromPath, toPath)
```

These are intentionally provider-owned plain types; the web orchestration layer may map them explicitly to KG10 `WorkspaceSourceChange`.

Current KG10 exposes:

```ts
applyObsidianWorkspaceChanges(engine, changes)
```

and returns on success:

```text
next engine
next stable snapshot
KnowledgeSnapshotDelta
next StableIdentityCatalog
resolution diagnostics
identity summary/diagnostics
parse stats
from/to revision
```

Current desktop one-shot runtime already retains:

```ts
DesktopVaultRuntime {
  selection
  inventory
  identitySession
  engine
}
```

Current desktop open builds reports from:

```text
engine.snapshot
engine.resolutionDiagnostics
engine.parsedDocuments()
inventory.nonMarkdownPaths
```

with no second parse pass.

Current `GraphExplorer` is currently keyed from `reportRevision`, so every report replacement remounts it. That is correct for manually loading a new source session but **wrong for live updates**, because it would discard in-memory graph state and rehydrate from storage on every filesystem save.

Current `GraphExplorer` already keeps renderer-independent state internally:

- disclosure;
- heading limit;
- block visibility;
- filters;
- focus;
- semantic viewport bookmark;
- search/selection/inspector state.

KG9B can restore persisted state against a new workspace, but live snapshot evolution needs a new **current-state reconciliation** path rather than remounting/reloading saved state.

---

# Concurrent UI work

A parallel `codex/ux4a-canvas-navigation-visual-ergonomics` worktree may still exist and is based on an older commit.

Do not touch or clean that worktree.

Before finalizing KG11B2:

1. sync/rebase onto the actual latest `main`;
2. preserve any UX changes merged meanwhile;
3. keep live-sync controls/status compact and compatible with the newer workspace UI;
4. do not overwrite graph/Inspector/navigation design for the sake of this milestone.

KG11B2 is source/session behavior, not a UI redesign.

---

# Core architectural rule: candidate first, commit second

A live source update must be transactional at the application boundary.

For a normal Markdown change:

```text
current runtime
  ↓
KG11B1 source plan
  ↓
KG10 candidate next engine/snapshot/catalog
  ↓
candidate diagnostic report
  ↓
persist candidate identity catalog
  ↓
ONLY THEN:
adopt next engine + next inventory + next report
```

If any pre-commit step fails:

```text
current engine remains current
current inventory remains current
current report remains visible
current persisted catalog remains authoritative
```

Do not partially adopt a KG10 candidate and then discover that stable identity persistence failed.

This is especially important because the next browser view state is keyed to those stable IDs.

---

# Why report construction occurs before identity persistence

Use this order:

```text
KG10 candidate
→ build/validate candidate report
→ persist candidate catalog
→ adopt candidate runtime/report
```

Do not persist the catalog before report construction.

If report construction failed after catalog persistence, disk identity state would be ahead of the current UI/runtime.

Candidate report construction is cheap enough and pure enough to perform before the persistence commit.

---

# Normal Markdown live-update flow

For a `planned` KG11B1 result with Markdown changes:

1. map `VaultSourceChange[]` to KG10 `WorkspaceSourceChange[]`;
2. call:
   ```ts
   applyObsidianWorkspaceChanges(current.engine, changes)
   ```
3. if KG10 succeeds, build a **stable** candidate `ObsidianDiagnosticReport` from:
   - `result.snapshot`;
   - `result.resolutionDiagnostics`;
   - `result.engine.parsedDocuments()`;
   - `plan.nextInventory.nonMarkdownPaths`;
4. persist:
   ```ts
   sourceProvider.commitWorkspaceIdentity(
     current.identitySession,
     result.identityCatalog,
   )
   ```
5. only after persistence succeeds:
   - replace current engine with `result.engine`;
   - replace inventory with `plan.nextInventory`;
   - expose the new report to React;
   - retain the same live workspace/session identity;
   - remain in live/watching status.

Do not serialize report JSON to disk.

---

# Non-Markdown-only updates

When:

```text
markdownChanges.length === 0
nonMarkdownChanged === true
```

do not call KG10.

The stable snapshot/catalog are unchanged.

Rebuild the diagnostic report using:

```text
current engine.snapshot
current engine.resolutionDiagnostics
current engine.parsedDocuments()
plan.nextInventory.nonMarkdownPaths
```

This allows attachment compatibility probes to update live.

If report construction succeeds:

```text
adopt nextInventory + report
```

No identity-catalog write is necessary.

If there is no net Markdown or non-Markdown change:

```text
do nothing visible
```

Do not manufacture a graph/report revision from watcher noise.

---

# Live identity-persistence failure policy

KG11A could downgrade an **initial open** to transient when identity persistence failed.

For an **already-stable live session**, use a stricter policy.

If a candidate live update cannot persist its next identity catalog:

```text
do NOT adopt the candidate engine/report/inventory
keep the last committed stable workspace visible
mark live synchronization PAUSED
retain the watcher only as a dirty/change signal
require successful full resync before resuming
```

Why:

- adopting the candidate would make in-memory identity state diverge from durable identity state;
- continuing later updates would widen that divergence;
- silently marking the already-open stable workspace transient would disable KG9 persistence mid-session and make restart behavior unclear.

The user should see a compact actionable state such as:

```text
Live updates paused — local identity could not be saved.
Rescan Vault
```

Do not spam the same error on every subsequent watcher batch.

While paused, watcher batches may simply set:

```text
dirtySincePause = true
```

and return quickly.

Do not attempt incremental KG10 updates until recovery succeeds.

---

# Other fatal live-update failures

Distinguish recoverable source desynchronization from internal/domain failures.

Recommended policy:

## `reconcileSelectedVaultChanges()` → `resync-required`

Automatically attempt full resync.

## KG10 failure at `stage: "input"`

Treat as an out-of-sync engine/source condition and automatically attempt one full resync.

## KG10 failure at parse/resolution/identity/delta

Do not repeatedly retry through incremental updates.

Keep the last committed report, mark live sync paused, and expose:

```text
Rescan Vault
```

Manual full resync may recover source-state problems while still surfacing a real invariant bug if it fails again.

## Diagnostic report construction failure

Pause and preserve current committed state.

## Identity-catalog persistence failure

Pause and preserve current committed state.

Do not hide an internal invariant error behind infinite automatic rescans.

---

# Full resync

Implement one explicit full-resync operation shared by:

- automatic `resync-required` recovery;
- KG10 input/out-of-sync recovery;
- user-triggered `Rescan Vault`;
- recovery from a paused live session.

Full resync sequence:

```text
current stable runtime/catalog
      ↓
sourceProvider.discoverSelectedVault(selection)
      ↓
initializeObsidianWorkspaceEngine({
  workspaceId: current.engine.workspaceId,
  documents: full inventory.markdownDocuments,
  identityCatalog: current.engine.identityCatalog,
})
      ↓
build stable candidate diagnostic report
      ↓
persist next identity catalog
      ↓
adopt next runtime/inventory/report
      ↓
resume live status
```

Use the **current committed engine identity catalog**, not the original immutable `identitySession.catalog`, because the session may already have accepted many live updates.

Do not generate a new workspace ID.

Do not reset KG9 saved view.

Do not use KG9A identity reset as a resync mechanism.

---

# Watcher remains active during resync

Prefer keeping the KG11B1 watcher subscription active while a full resync runs.

KG11B1's burst collector already awaits one async listener flush and queues events arriving during it into the next batch.

This creates a useful sequence:

```text
batch triggers resync
→ full scan runs
→ events during scan remain pending in B1
→ resync commits
→ next queued batch reconciles against the new inventory
```

This is safer than:

```text
stop watcher
→ scan for 25 seconds
→ restart watcher
```

which creates a gap where source changes could be missed.

Manual resync invoked outside a watch callback must share the same serialization mechanism as watcher updates so the two cannot overlap.

---

# Live-session controller

Do not place the complete state machine directly inside `App.tsx`.

Create a plain application orchestration boundary, likely around:

```text
apps/web/src/desktop-live-vault.ts
```

or an equally clear adjacent module.

It may depend on:

```text
source-provider-tauri
workspace-engine-obsidian
diagnostics-obsidian
```

but should not depend on React.

It should own approximately:

```text
current DesktopVaultRuntime
watch subscription
serialized operation queue / mutex
live state
paused/dirty state
lifecycle generation/token
manual resync
stop/dispose
```

Expose callbacks/events to the React app for:

```text
new committed report/runtime
live status change
nonfatal/fatal error
```

Exact API is for Codex to refine.

Do not introduce RxJS, Zustand, or another state framework.

---

# Serialized operations

Although KG11B1 prevents overlapping watcher-listener flushes, KG11B2 introduces other concurrent operations:

- manual Rescan;
- source switching;
- live batch processing;
- initial bootstrap;
- component/app disposal.

The live controller must ensure only one runtime mutation transaction runs at a time.

Use a small promise queue/mutex owned by the controller.

Do not add a concurrency dependency.

A stale async operation must never commit after its live session has been replaced.

---

# Session generation / stale commit protection

When the user switches away from a live vault:

```text
live vault A
→ Sample / JSON report / vault B
```

an already-running A update may still be awaiting I/O.

Use a session generation/token or disposed flag so that:

```text
late A result
≠
mutate current B/Sample UI
```

Stopping the watcher prevents future callbacks but is not sufficient to cancel a listener already in progress.

Before each external commit/callback, verify the session is still current.

---

# Initial-open watcher race

KG11A currently scans first and does not start a watcher until a later step because watching did not yet affect the product.

KG11B2 should close the race between:

```text
initial source discovery
and
watch subscription start
```

Preferred desktop-open flow:

```text
select directory
→ start KG11B1 watcher immediately
→ buffer/coalesce incoming batches
→ run existing one-shot source/identity/KG10 initialization
→ establish live runtime
→ drain/reconcile any buffered startup batches
→ only then consider the live session synchronized
```

If initial open fails or produces a transient identity session:

```text
stop watcher
```

and keep/fallback to KG11A one-shot behavior as appropriate.

A persistence-failed transient initial open should **not** become a live session.

Do not accept a silent change-loss window simply because startup acquisition is slow.

---

# New live-open API

It is acceptable to retain:

```ts
openSelectedDesktopVault()
```

as the tested one-shot building block.

Add an outer live-open flow conceptually like:

```ts
selectAndOpenLiveDesktopVault(...)
```

which:

1. selects;
2. starts/buffers watcher;
3. calls the one-shot open for the selected root;
4. if stable, creates the live controller;
5. drains startup batches;
6. returns the final synchronized report/runtime/controller;
7. if transient/failure, stops the watcher.

Do not duplicate KG11A source acquisition/identity logic.

---

# Source-provider identity session reuse

`commitWorkspaceIdentity()` must support many successful live catalog commits for one active session.

Inspect the KG11A implementation carefully.

For a session whose original association was:

```text
new
or
reset
```

the current provider may rewrite the registry on every later commit because the immutable session still says `association !== "existing"`.

If current code behaves that way, fix it narrowly inside the provider:

```text
first successful registry association commit
→ mark the private provider-side session as registered
→ subsequent live commits write only the catalog
```

Do not mutate the public immutable session solely to encode internal persistence history.

Add tests for repeated catalog commits.

---

# UI source/session model

Keep UI changes small.

A desktop vault source should expose compact states such as:

```text
Opening
Catching up
Live
Updating
Resyncing
Paused / needs rescan
```

Do not display permanent per-update technical timings in the graph workspace unless newer UX already provides a technical/details surface.

Keep a secondary action:

```text
Rescan Vault
```

for every active desktop live session.

This manual rescan is important because the pinned Tauri fs plugin can forward represented rescan flags but native Notify callback errors may be dropped before JavaScript.

Do not pretend the watcher can detect every possible platform failure.

---

# Manual rescan

`Rescan Vault`:

- does **not** reset identity;
- does **not** reset saved view;
- does **not** select the folder again;
- uses the already authorized selected root in the current Tauri process;
- runs the full-resync transaction above;
- resumes a paused session after success.

If rescan fails:

```text
keep previous report
remain paused/error
show actionable error
```

Do not clear the graph.

---

# Source switching

When switching from live vault A:

## Open JSON report / Sample

1. invalidate the current live controller;
2. stop watcher A;
3. then activate the new non-live source.

If unwatch fails, surface a nonfatal warning, but stale session-token checks must prevent any later A callbacks from mutating the new source.

## Open vault B

Do not destroy A before the user even selects a new folder.

Recommended:

```text
A remains current/live
→ select/open B
→ if B fails/cancels, A remains
→ if B succeeds, invalidate/stop A
→ activate B
```

Temporary simultaneous native watchers during B bootstrap are acceptable if lifecycle ownership is clear.

Do not leak one workspace's change callbacks into another.

---

# GraphExplorer must not remount on live report updates

Current `App.tsx` uses a report revision as the `GraphExplorer` React key.

Change source-session semantics.

Use separate concepts:

```text
sourceSessionKey
liveReportVersion
```

or equivalent.

Increment/remount `GraphExplorer` when the user switches source session:

- Sample → report;
- report → vault;
- vault A → vault B;
- reopening/reselecting a vault as a new app source session;
- identity reset producing a new workspace ID.

Do **not** remount it for:

- normal live Markdown updates;
- non-Markdown inventory updates;
- full resync of the same stable live workspace.

This is a hard KG11B2 requirement.

---

# Source-neutral current-view reconciliation

Add a source-neutral helper to `packages/view-state`.

Do not implement live state cleanup as Tauri/React-specific logic.

A useful API is conceptually:

```ts
reconcileCurrentWorkspaceView({
  workspace: newProjectionWorkspace,
  state: currentViewProjectionState,
  viewport: currentViewportBookmark,
}): ReconciledWorkspaceView
```

Return:

```text
sanitized current ViewProjectionState
optional surviving viewport
nonfatal reconciliation issues
```

This is **not** persisted-state hydration.

It operates on the current in-memory view across stable snapshot evolution.

---

# Current-view reconciliation rules

Preserve current state when its stable IDs still exist.

For the next snapshot:

## Disclosure

- keep surviving expanded IDs;
- keep surviving collapsed IDs;
- drop removed IDs;
- collapse still wins a conflict;
- preserve default depth;
- preserve heading limit;
- preserve block toggle.

## Focus

If the stable focus root survives:

```text
preserve focus/hops/direction/context
```

If removed:

```text
clear focus
```

with a nonfatal issue.

Do not choose a similar entity.

## Filters

- entity/status filters remain;
- path prefixes that no longer match any document are removed;
- preserve any genuinely current user-facing text filter if one now exists;
- no fuzzy path migration.

## Semantic viewport

If the anchor entity survives:

```text
preserve anchor + zoom
```

If it no longer exists:

```text
drop bookmark
```

and let the graph fit/fallback.

No raw renderer coordinates.

## Search / inspector / selection

These are not part of the persisted view-state package.

Their live behavior remains web-level.

---

# Refactor existing KG9B restore logic where useful

Do not duplicate stale-ID/path/focus reconciliation.

If clean, factor the existing:

```text
restorePersistedWorkspaceView()
```

to reuse one internal/current-view reconciliation implementation.

Persisted-record validation/versioning remains separate.

Do not change KG9B semantics merely for refactor aesthetics.

Add source-evolution tests directly against the new helper.

---

# GraphExplorer live snapshot behavior

When `snapshot` changes **without a source-session remount**:

1. build the new `ProjectionWorkspace`;
2. reconcile current `viewState`/viewport against it synchronously enough that a stale focus/entity does not cause an error-frame;
3. project the new snapshot using the reconciled state;
4. commit normalized state back into the reducer if necessary;
5. preserve current search query;
6. preserve Inspector open/closed state;
7. preserve selected node/edge if that projected selection still exists;
8. clear selection if its projected node/edge disappeared;
9. update inspector/search indexes from the new snapshot;
10. preserve/maximize canvas mode.

Do not rehydrate from `localStorage` on every live update.

The current in-memory state is authoritative during one live session.

---

# Reducer support

If necessary, add a narrow reducer action such as:

```text
replace/reconcile view state
```

for programmatic source evolution.

Do not bypass the reducer by mutating state objects.

Avoid dispatch loops:

```text
new snapshot
→ reconcile
→ dispatch only if normalized state actually differs
```

Use deterministic equality for the small renderer-independent state rather than broad deep-cloning machinery.

---

# Live viewport behavior

Use the existing semantic viewport design rather than raw React Flow transforms.

After a live snapshot/layout change:

- if the current semantic anchor still projects visibly, preserve context around that entity at the existing zoom using the existing center-request mechanism when necessary;
- if the anchor disappeared or is excluded by the surviving filters/focus, use the current fit/fallback behavior;
- do not widen filters merely to recover the old camera;
- do not re-read persisted viewport from localStorage.

Avoid gratuitous camera jumps for non-layout-relevant updates if the current renderer can determine that cheaply.

Do not turn KG11B2 into PERF1/KG12.

---

# Selection behavior

Canonical entity IDs are stable, but projected edge IDs may change when aggregation changes.

For live updates:

```text
selected projected element still exists
→ preserve selection

selected projected element disappeared
→ clear selection + concise announcement
```

Do not fuzzy-select a replacement edge.

If an entity survives but its visible projection rolls up differently due disclosure/filter changes caused by source evolution, follow the current projection truth.

---

# Search behavior

Keep the user's current search query during ordinary live updates.

Search is transient across sessions/reloads, but it is useful within the active editing session.

The source-neutral inspection workspace should rebuild from the latest snapshot, so result sets update naturally.

Do not clear search on every filesystem save.

---

# Persisted KG9 view during live updates

After current-view reconciliation, normal KG9B autosave may persist the updated renderer-independent state under the same stable workspace ID.

Do not:

- delete and rewrite the saved view as a new workspace;
- rehydrate it over the current in-memory state;
- persist removed stale IDs.

If KG9A refuses identity continuity for an edited entity, only the affected current/persisted view references should disappear.

---

# Diagnostic report rebuilding

For every committed source state that affects Markdown or non-Markdown inventory:

```text
build one new in-memory ObsidianDiagnosticReport
```

using current engine parsed documents.

No second parsing.

No report file write.

The report must remain:

```text
identity.stability = "stable"
```

for successfully committed live sessions.

Compatibility probes remain noncanonical and should reflect the new non-Markdown inventory.

---

# Runtime/report commit callback

A live controller should emit a single committed update object so React does not observe mismatched pieces.

Conceptually:

```ts
interface CommittedDesktopLiveUpdate {
  readonly report: ObsidianDiagnosticReport
  readonly runtime: DesktopVaultRuntime
  readonly reason: 'incremental' | 'resync' | 'non-markdown'
  readonly stats: ...
}
```

Exact shape may differ.

Do not call React once for report and later for inventory/runtime.

---

# Live performance evidence

Collect non-gating timings for at least:

```text
watch reconciliation
KG10 apply
diagnostic report construction
identity persistence
total application-side live update
```

The 250 ms KG11B1 quiet window is batching latency and should be reported separately from processing time.

Use:

- small synthetic vault;
- medium synthetic vault;
- private real Icarus manual full resync.

Do not introduce budgets yet.

KG12 will turn evidence into explicit performance work.

---

# Native end-to-end synthetic QA

Use a temporary synthetic vault through the **actual desktop app**.

Verify end-to-end:

1. open vault;
2. graph enters Live status;
3. edit Markdown → graph/report updates automatically;
4. several rapid writes → one semantic update batch;
5. create Markdown → new document appears;
6. delete Markdown → document disappears;
7. pure rename → stable IDs preserved according to KG9A;
8. rename + edit → correct delete+upsert/KG9A behavior;
9. asset create/delete → compatibility evidence updates;
10. nested folder/file create;
11. directory rename;
12. directory delete;
13. current disclosure survives an unrelated edit;
14. active focus survives when root identity survives;
15. current search query remains;
16. current selected stable node remains when possible;
17. removed selected entity clears safely;
18. semantic viewport context survives a normal edit;
19. `Rescan Vault` leaves the same stable view context;
20. switching to Sample/Report stops old live updates;
21. switching vault A → B isolates sessions.

No console errors/warnings except intentionally tested recoverable live-status messages.

---

# Failure/recovery QA

Use injected services/fakes for deterministic tests.

Cover:

## Planner requests resync

- full discover/reinitialize runs;
- watcher remains subscribed;
- candidate catalog persists;
- current UI replaced only after success.

## KG10 input failure

- one full resync recovery path.

## KG10 non-input failure

- live session pauses;
- last committed report remains.

## Report-build failure

- no catalog write;
- runtime not adopted;
- pause.

## Catalog-write failure

- candidate engine/inventory not adopted;
- stable report remains;
- pause;
- later Rescan can recover.

## Rescan failure

- remains paused;
- prior report remains.

## Event while resync runs

- serialized/queued and reconciled after resync.

## Stale callback after source switch

- cannot mutate current source.

---

# Initial bootstrap race tests

Prove no source changes are silently lost between directory selection and initial live synchronization.

With fakes:

1. watcher starts;
2. one-shot discovery begins;
3. watcher emits change during discovery;
4. one-shot initialization finishes;
5. buffered batch is reconciled/applied;
6. returned/activated live runtime reflects final filesystem state.

Also test:

- startup batch requests resync;
- startup persistence becomes transient → watcher stops and no live controller remains;
- startup failure stops watcher.

---

# Repeated catalog-commit tests

If the source provider is changed to track that a new/reset association was already registered:

- first successful commit writes catalog + registry;
- second/third live commits write catalog only;
- registry remains correct;
- catalog replacement remains atomic;
- failed catalog replacement does not mark a new revision committed.

---

# Real Icarus validation

Do not edit the real Icarus vault merely to prove watcher behavior.

Use the real selected vault for:

1. desktop open as stable live session;
2. manual `Rescan Vault`;
3. confirm unchanged full resync reuses all current stable entity/reference IDs;
4. confirm current KG9 view/disclosure/focus/viewport survives resync;
5. record aggregate discovery/KG10/report/persistence timings;
6. confirm no vault file was written.

Native mutation scenarios belong to the synthetic vault.

If a normal real edit happens naturally during QA, it may be observed, but it is not required and private path/content must not be reported.

---

# Browser-mode regression

Ordinary browser mode still has:

```text
Sample
Open Report
```

and no Tauri watcher.

No live-controller code should execute when not in Tauri runtime.

Dynamic import boundaries should remain intact.

---

# Manual source/reload semantics

If the user chooses Sample or JSON Report:

```text
desktop watcher/session stops
source becomes non-live
```

If the user returns to Open Vault, a new live source session is established.

Do not persist the selected folder handle or auto-open it after application restart.

KG11A's explicit reselection security model remains unchanged.

---

# No source writes

The desktop application still never writes to the selected vault.

Watching, rescanning, parsing, diagnostics, identity persistence, and graph updates are all read-only with respect to Markdown/source assets.

Only app-local registry/catalog state is written.

---

# ADR 0010

Add a concise ADR for the live application commit boundary.

Record:

1. KG11B1 plans feed KG10 only in the application orchestration layer.
2. Candidate KG10 state/report are validated before durable catalog commit.
3. Runtime/report are adopted only after catalog persistence succeeds.
4. Live identity-write/internal failures preserve the last committed state and pause synchronization.
5. `resync-required` and out-of-sync input failures use complete source reinitialization with the current stable catalog.
6. Watcher remains active during resync so later changes queue.
7. The graph updates in place; live reports do not remount/re-hydrate the KG9 workspace view.
8. Current renderer-independent view state is reconciled by stable IDs against new snapshots.
9. Manual `Rescan Vault` exists because native watcher error reporting cannot prove perfect coverage.
10. KG11B2 completes KG11; optimization remains KG12.

---

# Documentation / roadmap

Likely update:

```text
apps/web/README.md
apps/web/src/components/README.md
packages/view-state/README.md
packages/source-provider-tauri/README.md
apps/desktop/README.md
README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/decisions/0010-*.md
```

Potential important implementation areas:

```text
apps/web/src/desktop-vault.ts
apps/web/src/desktop-live-vault.ts       // likely new
apps/web/src/App.tsx
apps/web/src/components/GraphExplorer.tsx
apps/web/src/graph-state.ts
packages/view-state/src/*
packages/source-provider-tauri/src/provider.ts
```

Use latest repo structure rather than forcing these exact paths.

After success:

```text
KG11 — Complete
KG12 — Next
```

Roadmap outcome should accurately say that the desktop app now:

```text
opens
watches
coalesces
incrementally updates
resyncs
preserves graph view state
```

Do not begin KG12 automatically.

---

# Scope

## In scope

- live desktop-session controller;
- watcher startup/lifecycle;
- startup watch buffering;
- KG11B1 plan → KG10 mapping;
- serialized incremental update application;
- non-Markdown-only live report updates;
- transactional candidate report/catalog/runtime commit;
- repeated catalog persistence;
- automatic full resync for explicit source desync;
- manual Rescan Vault;
- pause/recovery policy;
- source-switch lifecycle and stale callback protection;
- source-neutral current-view reconciliation;
- in-place GraphExplorer snapshot evolution;
- preserve KG9 disclosure/filter/focus/viewport;
- sensible search/selection preservation;
- compact live status;
- native synthetic end-to-end QA;
- real Icarus unchanged manual-resync QA;
- ADR/docs/roadmap;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- partial KG4/KG9A invalidation;
- incremental KG6/search indexes from `KnowledgeSnapshotDelta`;
- React Flow node-level delta application;
- workers;
- performance budgets;
- renderer replacement;
- Graphology/Sigma;
- source snippets;
- open/reveal in Obsidian;
- source editing;
- automatic vault reopen;
- background polling safety scans;
- cloud/backend/accounts;
- release/updater/signing.

Do not begin KG12 automatically.

---

# Suggested implementation sequence

1. Sync latest `main`; preserve concurrent UX work.
2. Add/factor source-neutral current-view reconciliation in `view-state`.
3. Make GraphExplorer safe for same-session snapshot evolution.
4. Separate App source-session remount key from live report version.
5. Add plain desktop live-session controller.
6. Close initial watcher-start race with buffered startup events.
7. Implement normal plan → KG10 → report → catalog → commit transaction.
8. Implement non-Markdown-only transaction.
9. Implement automatic/manual full resync.
10. Add pause/recovery and stale-session guards.
11. Ensure repeated catalog commits do not rewrite registry unnecessarily.
12. Integrate compact Live/Updating/Resyncing/Paused UI and Rescan action.
13. Unit/integration tests.
14. Native synthetic end-to-end watcher→graph QA.
15. Real Icarus manual-resync/state-preservation QA.
16. Collect non-gating live latency evidence.
17. ADR/docs; mark KG11 complete and KG12 next.
18. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use current repository equivalents.

Expected focused checks include:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/source-provider-tauri typecheck
pnpm exec vitest run packages/source-provider-tauri

pnpm --filter @icarus-graph-explorer/workspace-engine-obsidian typecheck
pnpm exec vitest run packages/workspace-engine-obsidian

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm desktop:check
pnpm desktop:build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run:

```text
native synthetic live-update matrix
source-switch lifecycle QA
manual/automatic resync QA
private real Icarus manual-resync QA
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG11B2 is complete only when:

1. Stable desktop vaults automatically start a recursive watch session.
2. Initial acquisition cannot silently lose changes before watcher startup.
3. Startup watch batches are buffered/drained or equivalently reconciled safely.
4. Transient/persistence-failed initial opens do not claim active live sync.
5. KG11B1 plans are mapped to KG10 only outside the provider package.
6. One live update transaction runs at a time.
7. Markdown changes call KG10 once per coalesced semantic plan.
8. Non-Markdown-only changes do not call KG10.
9. Candidate report is built before identity persistence.
10. Candidate runtime/report is adopted only after successful stable catalog persistence.
11. Live catalog persistence failure preserves the last committed runtime/report.
12. Such failures pause live synchronization rather than silently diverging.
13. Repeated live catalog commits work correctly for originally new/reset associations.
14. `resync-required` performs full source reinitialization.
15. KG10 input/out-of-sync failure can recover through full resync.
16. Internal/non-input KG10 failure does not enter an automatic retry loop.
17. Manual `Rescan Vault` exists and does not reset identity/view.
18. Watcher remains capable of queuing source changes during resync.
19. Manual resync and watcher updates cannot overlap unsafely.
20. Failed resync preserves the last committed graph.
21. Source switching invalidates stale async callbacks.
22. Sample/JSON mode stops or detaches the prior live session.
23. Failed/cancelled opening of another vault leaves the current live vault intact.
24. GraphExplorer does not remount for ordinary live updates.
25. GraphExplorer does remount/reinitialize for an actual new source session.
26. Current renderer-independent view state is reconciled against new snapshots.
27. Surviving disclosure IDs remain expanded/collapsed.
28. Removed disclosure IDs are dropped.
29. Surviving focus root remains focused.
30. Removed focus root clears safely.
31. Heading limit/block/filter state survives normally.
32. Stale path filters are removed rather than producing an invisible graph.
33. Semantic viewport anchor/zoom survive when the entity survives.
34. Missing/hidden viewport anchor uses a safe fallback.
35. Current search query survives normal live updates.
36. Surviving graph selection remains selected when possible.
37. Removed projected selection clears safely.
38. Inspector/search indexes reflect the latest stable snapshot.
39. KG9 autosave persists only the reconciled current view under the same workspace ID.
40. No localStorage rehydration occurs on every filesystem update.
41. Compatibility probes update for non-Markdown inventory changes.
42. The selected vault remains read-only.
43. Native synthetic end-to-end live QA passes.
44. Private real-vault manual resync reuses stable identities and preserves view state.
45. No private source/report/catalog/runtime dump is committed.
46. No new external runtime/state dependency is added without evidence.
47. Existing KG1–KG11B1 tests remain green.
48. ADR 0010/docs are reconciled.
49. KG11 is marked complete.
50. KG12 is marked next.
51. PR CI passes.
52. Post-merge main CI passes.
53. Branch cleanup/worktree are clean.

Do not begin KG12.

---

# Final report

Report:

## 1. Summary

What live-vault product behavior now exists.

## 2. Live architecture

State:

```text
watch batch
→ source reconciliation
→ KG10
→ candidate report
→ identity persistence
→ committed runtime/report
→ in-place graph update
```

## 3. Live-session lifecycle

Explain watcher startup, buffered bootstrap events, serialization, source switching, stop/dispose, and stale callback protection.

## 4. Transaction/commit policy

Explain candidate ordering and why persistence failure does not adopt the new engine.

## 5. Incremental update behavior

Report Markdown, move, delete, non-Markdown-only, and no-op paths.

## 6. Resync/recovery

Explain automatic resync conditions, manual Rescan Vault, paused state, and watcher behavior during resync.

## 7. View-state reconciliation

Explain how disclosure/focus/filters/viewport survive stable snapshot evolution and what happens to removed identities.

## 8. Search/selection/Inspector behavior

State exactly what remains and what clears across live updates.

## 9. Performance evidence

For synthetic small/medium and real manual resync where measured:

- KG11B1 reconciliation;
- KG10;
- report;
- catalog persistence;
- total processing;
- separate 250 ms watcher batching delay.

No budget claims.

## 10. Real Icarus QA

Aggregate only:

- documents/entities/references;
- resync identity reuse/new counts;
- view-state restoration/preservation;
- timings;
- confirmation no vault write occurred.

No private paths/content.

## 11. Dependencies

List additions. Expected external runtime additions: zero.

## 12. Tests / validation

All commands, native scenarios, PR CI, post-merge CI.

## 13. Privacy/security

Confirm selected-root-only read/watch, no source writes/uploads, no private commit/log leakage.

## 14. Files changed

Important live controller, App/GraphExplorer, view-state, provider, docs areas.

## 15. ADR / roadmap

Confirm:

```text
KG11 complete
KG12 next
```

## 16. Deviations / warnings

Surface:

- Tauri watcher callback-error limitation;
- full-resync cost;
- any UI/layout cost observed during live updates;
- source-switch edge cases;
- anything that should affect KG12.

## 17. KG12 handoff

State what performance/worker hardening can now measure against:

- one-shot startup acquisition;
- 250 ms coalesced live source updates;
- KG10 whole-workspace resolution/reconciliation cost;
- report reconstruction;
- projection/layout/render cost after real live changes;
- full-resync cost;
- stable in-place graph state across updates;
- exact delta already available if KG12 later chooses incremental downstream indexes;
- correctness baselines remain full KG4/KG9A snapshot equality and existing live transaction gates.

Do not implement KG12 automatically.
