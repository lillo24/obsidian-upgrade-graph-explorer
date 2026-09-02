# KG11B1 — Tauri Watch Acquisition + Deterministic Vault Change Planning

**Task type:** native filesystem-watch boundary / event normalization / coalescing / source-state reconciliation

## Why KG11B is split again

KG11A established secure one-shot desktop acquisition. The remaining live-update work still contains two distinct risk areas:

```text
KG11B1
Tauri watcher
→ raw event normalization
→ burst coalescing
→ reconcile actual filesystem state
→ deterministic source-change plan

KG11B2
source-change plan
→ serialized KG10 updates
→ catalog/report commit
→ live UI update
→ KG9 view preservation
→ full resync/recovery
```

Do not combine these in one PR.

Cross-platform filesystem events are unreliable enough that the watcher/change-planning boundary should be proven independently before the application starts mutating the live graph from them.

After KG11B1:

```text
KG11 — In progress
KG11A — Complete
KG11B1 — Complete
KG11B2 — Next
```

Do not begin KG11B2 automatically.

---

# Goal

Extend the existing Tauri source-provider boundary so the desktop app can safely observe a selected vault and convert noisy platform filesystem events into **deterministic, read-only source change plans**.

Target boundary:

```text
Tauri fs watchImmediate
      ↓
narrow native watch bridge
      ↓
normalized selected-root watch signals
      ↓
short burst coalescing
      ↓
re-observe actual filesystem state
      ↓
compare against previous VaultSourceInventory
      ↓
VaultSourceChangePlan
```

KG11B1 must **not** apply the plan to KG10 or the UI yet.

The source change plan should be platform-neutral plain data that KG11B2 can later map directly to KG10 `upsert` / `delete` / `move` operations.

The governing principle is:

> Watcher events are hints that something changed. The current selected filesystem state is the source of truth.

Do not trust an OS event kind strongly enough to mutate canonical state without re-observing the affected path(s).

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG11A merged through PR #16 at:

`29045854f41773243163faf4ce8bc379818529d6`

Current roadmap:

```text
KG11 — In progress
KG11A one-shot desktop acquisition — complete
KG11B live watching — next
```

Current Tauri source provider owns:

```text
selectVaultDirectory()
discoverSelectedVault()
loadOrPrepareWorkspaceIdentity()
commitWorkspaceIdentity()
```

and its injectable native bridge owns:

```text
dialog
readDir
readFile
lstat
app-local persistence
path operations
```

Current `DesktopVaultRuntime` already retains:

```text
selection
VaultSourceInventory
WorkspaceIdentitySession
ObsidianWorkspaceEngine
```

so KG11B2 will have both the original source inventory and the KG10 engine available.

Current `VaultSourceInventory` contains complete in-memory Markdown source strings plus non-Markdown workspace-relative paths. This is sufficient for conservative source-state comparison without changing KG10's rule that the engine itself does not retain raw source.

Current Tauri capability has no watch permissions yet.

Current Rust dependency:

```toml
tauri-plugin-fs = "=2.5.1"
```

without the `watch` feature.

---

# External context

KG11B1 relies on the current official Tauri v2 filesystem-watch contract.

At planning time the official docs state:

- `@tauri-apps/plugin-fs` provides `watch` and `watchImmediate`;
- directory watching is non-recursive by default;
- recursive watching requires `{ recursive: true }`;
- Rust `tauri-plugin-fs` requires the `watch` feature;
- filesystem commands require both command permission and allowed path scope;
- `fs:allow-watch` / `fs:allow-unwatch` are current permissions.

Official reference:

https://v2.tauri.app/plugin/file-system/

Codex should inspect the **installed/current package TypeScript definitions** before implementing event translation. Do not hard-code event-shape assumptions from this prompt.

If internet access is unavailable, the installed package/type definitions are sufficient. If neither official docs nor installed definitions resolve an event-shape ambiguity, stop and report it instead of guessing.

---

# Required first step

Before editing:

1. sync latest `main`;
2. verify the worktree is clean;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - ADR 0007 and ADR 0008;
   - `packages/source-provider-tauri/README.md`;
   - all `packages/source-provider-tauri/src/*`;
   - `packages/vault-discovery-policy/*`;
   - `tools/vault-diagnostics/src/discovery.ts`;
   - `packages/workspace-engine-obsidian/src/types.ts`;
   - `apps/web/src/desktop-vault.ts`;
   - `apps/desktop/src-tauri/Cargo.toml`;
   - `apps/desktop/src-tauri/capabilities/main.json`;
4. inspect the actual installed `@tauri-apps/plugin-fs` watch/watchImmediate types;
5. preserve any concurrently merged UX changes;
6. follow normal branch/PR/CI/cleanup workflow.

Do not change graph/Inspector UI in this milestone.

---

# Tauri watch choice

Prefer:

```text
watchImmediate
```

over Tauri's already-debounced `watch`.

Reason:

KG11B1 needs one explicit application-owned coalescing policy that can be unit-tested and tuned from actual event evidence.

Use:

```text
recursive: true
```

on the selected root.

Do not process events one-by-one into future KG10 updates.

Do not use both Tauri debounce and a second opaque application debounce unless actual native evidence shows a benefit.

---

# Tauri feature/capability changes

Update the existing Rust dependency rather than adding another watcher package.

Expected direction:

```toml
tauri-plugin-fs = {
  version = "=<current pinned version>",
  features = ["watch"]
}
```

Keep the existing version pin unless compatibility requires an explicitly reviewed update.

Add the smallest required capability permissions, expected approximately:

```text
fs:allow-watch
fs:allow-unwatch
```

The already dialog-scoped selected directory remains the path authorization.

Do **not** add:

```text
$HOME/**
drive-root scope
static arbitrary-vault scope
```

Do not add `chokidar`, `notify` directly, or a separate fs-watch plugin.

---

# Extend the injectable native bridge

Extend `TauriNativeBridge` with one narrow watch method.

Conceptually:

```ts
watchDirectory(
  path: string,
  listener: (event: NativeWatchEvent) => void,
  options: { recursive: boolean },
): Promise<StopWatching>
```

Use the actual official return type/cleanup behavior internally.

`NativeWatchEvent` should be an internal package-owned representation of the Tauri event facts needed by the normalizer.

Do not leak Tauri package event types through the public source-provider contract.

Unit tests continue using a fake bridge.

Stopping a watcher must be:

- idempotent or safely guarded;
- tested;
- unable to continue calling application listeners after disposal.

---

# Public watch contract

Extend the source provider with an intentional watch API.

A useful direction is conceptually:

```ts
watchSelectedVault(
  selection: VaultSelection,
  listener: (signal: VaultWatchSignal) => void,
  options?: VaultWatchOptions,
): Promise<VaultWatchSubscription>
```

Exact shape may differ.

The public normalized signal should be plain data and contain no Tauri-specific types.

Possible shape:

```ts
interface VaultWatchSignal {
  readonly paths: readonly WorkspacePath[];
  readonly category:
    | 'content-change'
    | 'create'
    | 'remove'
    | 'rename'
    | 'other';
  readonly requiresResync?: boolean;
}
```

Do not overfit the enum to this example. Map from the **actual installed Tauri event types**.

Important:

- all paths must be normalized workspace-relative paths under the selected root;
- absolute native paths must not escape the platform package;
- out-of-root/malformed events become explicit unsafe/resync signals;
- one raw event may contain multiple paths;
- signal ordering must be deterministic where ordering is not semantically meaningful.

---

# Watch event semantics are not canonical truth

Do not assume:

```text
event says remove → delete canonical document
event says create → add canonical document
event says rename → always KG10 move
```

Editors and OS watchers may produce:

- several modify events for one save;
- temp-file create/write/rename patterns;
- delete+create for replacement;
- rename with one or two paths;
- parent-directory events;
- duplicate events;
- event sequences that differ by OS.

KG11B1 must convert event bursts into an **observed net filesystem state** before generating a source plan.

---

# Burst coalescing

Create a small deterministic burst collector.

It may live in `source-provider-tauri` because it is part of converting platform watcher noise into source-provider events.

Requirements:

- collect event paths for a short quiet period;
- merge duplicates;
- preserve explicit “resync required” flags;
- never run multiple flushes concurrently;
- allow events arriving during/after one flush to form the next batch;
- cleanup cancels pending timers and callbacks;
- unit tests use an injected scheduler/clock rather than real delays.

Do not introduce a debounce dependency.

Initial timing may be in the approximate:

```text
200–300 ms quiet window
```

range, but use native synthetic QA to choose the actual default.

A bounded maximum wait is reasonable if continuous events would otherwise starve flushing.

Timing is batching policy, not source semantics.

---

# Source reconciliation API

After a coalesced watch burst, re-observe the filesystem and compare it with the previous `VaultSourceInventory`.

Expose a pure-ish/provider method conceptually:

```ts
reconcileSelectedVaultChanges({
  selection,
  previousInventory,
  watchBatch,
}): Promise<VaultSourceReconciliationResult>
```

This must remain independent of KG10.

The result should contain plain source changes and the complete next inventory.

A strong shape is approximately:

```ts
type VaultMarkdownSourceChange =
  | { kind: 'upsert'; path: WorkspacePath; source: string }
  | { kind: 'delete'; path: WorkspacePath }
  | {
      kind: 'move';
      fromPath: WorkspacePath;
      toPath: WorkspacePath;
    };

interface VaultSourceChangePlan {
  readonly markdownChanges: readonly VaultMarkdownSourceChange[];
  readonly nextInventory: VaultSourceInventory;
  readonly nonMarkdownChanged: boolean;
  readonly affectedPaths: readonly WorkspacePath[];
}

type VaultSourceReconciliationResult =
  | { status: 'planned'; plan: VaultSourceChangePlan }
  | { status: 'resync-required'; reason: string };
```

Exact naming may differ.

Do not import `workspace-engine-obsidian` merely to reuse its change type.

KG11B2 can perform the trivial mapping later.

---

# Re-observe, do not infer from event label

For each affected path/prefix, use the current filesystem to determine what now exists.

The reconciliation layer should understand:

```text
existing Markdown file
existing non-Markdown file
existing directory/subtree
missing path
ignored/hidden path
unsafe/unrepresentable path
```

Use the same discovery policy as KG11A.

Read Markdown bytes only when needed and decode with fatal UTF-8 exactly as one-shot discovery does.

Do not read non-Markdown binary contents.

---

# Targeted subtree reconciliation

Avoid turning every directory event into an immediate 25-second full-vault rescan.

When a changed path currently exists as a directory:

- recursively discover only that subtree using the same KG11A discovery rules;
- compare it with previous inventory entries under that prefix;
- derive the net file-level state.

When a changed path is now missing but previous inventory contains descendants beneath that prefix:

- treat it as a removed subtree and derive the corresponding net removals.

This should make folder create/delete/rename patterns manageable without scanning the entire vault.

If the event cannot be safely bounded to one or more paths/subtrees:

```text
return resync-required
```

Do not guess.

---

# Full resync triggers

The planner should explicitly request full resync for cases such as:

- watcher overflow/rescan signal if represented by the installed API;
- event with no safe path information;
- out-of-root path;
- path normalization contradiction;
- filesystem observation inconsistency;
- unsupported event semantics that cannot be reduced to bounded affected paths.

Do **not** perform the whole-vault resync in KG11B1.

KG11B2 will own resync orchestration.

---

# Net-state comparison

For each source path, compare:

```text
previous inventory state
vs
current observed state
```

Examples:

```text
Markdown existed + same Markdown source
→ no change

Markdown existed + source changed
→ upsert

Markdown absent + Markdown exists
→ upsert

Markdown existed + now missing/non-Markdown
→ delete

non-Markdown set changed
→ update next inventory / nonMarkdownChanged
```

A watch burst with no net state change should produce:

```text
markdownChanges = []
nonMarkdownChanged = false
```

Do not manufacture updates from noisy watcher activity.

---

# Conservative move inference

KG10 supports `move`, but KG11B1 must not trust platform rename labels blindly.

A move may be emitted only when source continuity is strongly proven.

Recommended safe rule:

```text
one previous deleted Markdown path
+
one newly added Markdown path
+
exact source text equality
+
the content match is unique on both sides
→ move
```

A trustworthy two-path native rename signal may be used as additional evidence, but **not** instead of verifying source equality.

If:

- content changed;
- duplicate identical source files make pairing ambiguous;
- rename path evidence is incomplete;

then emit one atomic future plan containing:

```text
delete old
upsert new
```

rather than guessing a move.

This still lets KG9A reconcile identity conservatively in KG11B2.

Do not use fuzzy content matching or hashes as identity evidence.

---

# Duplicate identical files

If several removed/added Markdown sources have identical exact content:

```text
do not pair them arbitrarily
```

Leave them as delete/upsert operations.

Determinism is more important than maximizing zero-reparse moves.

---

# Directory rename

A folder rename may appear as a directory event or many file events.

After targeted old/new subtree reconciliation:

- unique exact-content file pairs may become `move`;
- ambiguous files remain delete+upsert;
- the entire result is one source change plan.

Do not require one raw OS rename event per file.

---

# Event/path filtering

Hidden paths and always-ignored directories remain outside the product source inventory.

Events solely inside ignored content should have no source effect.

Be careful with parent-directory events:

- do not automatically ignore a parent event if it is the only evidence of a bounded subtree change;
- do not automatically rescan the whole vault for every harmless directory metadata event.

Use actual native synthetic evidence to tune this.

Document the final policy.

---

# Determinism

Given:

```text
same previous inventory
same final filesystem state
same equivalent watch-event burst
```

the produced plan must be identical regardless of duplicate/raw event ordering where ordering is irrelevant.

Sort:

- affected paths;
- Markdown changes;
- next inventory

according to existing workspace path ordering.

Do not rely on Set/Map insertion order as semantics.

---

# Privacy

Raw absolute watcher paths are platform-private.

They must not be:

- logged in normal output;
- returned from public source-provider watch signals;
- added to reports;
- committed in fixtures.

Synthetic tests may use fake absolute roots.

Native QA may log only normalized synthetic workspace-relative paths or event categories.

No real Icarus paths/content should appear in committed tests or final report.

---

# No application live update yet

KG11B1 must **not**:

- call `applyObsidianWorkspaceChanges`;
- mutate `DesktopVaultRuntime.engine`;
- rebuild live diagnostic reports;
- persist updated identity catalogs after file events;
- update React state;
- change `GraphExplorer`;
- implement resync UI.

This keeps the platform event boundary independently reviewable.

---

# Native synthetic watcher QA

This is required because watcher behavior differs by OS.

Use a small temporary synthetic vault, not the real Icarus vault.

On the development Windows machine, observe at least:

1. direct content edit;
2. several quick writes to one Markdown file;
3. create Markdown;
4. delete Markdown;
5. rename Markdown without content change;
6. rename + content edit;
7. create/delete non-Markdown asset;
8. create nested directory + Markdown;
9. rename directory;
10. delete directory subtree;
11. hidden-file activity;
12. `node_modules` activity.

Record **aggregate/event-category behavior only** in the final report.

Tune the coalescing/reconciliation policy from this evidence.

Do not make native raw event exact sequences part of the stable public contract.

---

# Unit tests

## Watch bridge

- start recursive watcher;
- official options mapped correctly;
- callback normalization;
- multiple paths;
- stop/unwatch called;
- stop prevents later callback delivery;
- watch start failure propagates.

## Path normalization

- selected-root absolute event → WorkspacePath;
- outside-root rejected/resync;
- malformed path;
- deterministic ordering.

## Burst collector

- duplicate events coalesce;
- rapid events become one batch;
- quiet period flush;
- maximum-wait behavior if implemented;
- event during flush becomes next batch;
- disposal cancels pending work;
- resync flag survives coalescing;
- deterministic event-order independence.

## Reconciliation

- no-op modify;
- Markdown source update;
- Markdown create;
- Markdown delete;
- non-Markdown create/delete;
- Markdown ↔ non-Markdown extension/state transition;
- hidden/ignored changes;
- existing directory targeted subtree;
- deleted directory prefix;
- invalid UTF-8 changed Markdown fails safely;
- unreadable changed path fails safely or requests resync according to documented policy;
- unknown/overflow event requests resync.

## Move inference

- unique exact-content rename → move;
- rename + edit → delete + upsert;
- duplicate exact contents → no arbitrary move;
- multiple independent unique moves;
- directory rename with mixed unique/ambiguous files.

## Determinism

Equivalent raw event ordering + same final state → identical plan.

---

# Tauri compile / CI

Update Rust `tauri-plugin-fs` feature flags and capabilities.

Run:

```text
cargo fmt --check
cargo check
pnpm desktop:check
pnpm desktop:build
```

Existing desktop CI should continue to compile the watch-enabled plugin.

No new CI watcher integration test is required because CI filesystem event behavior is platform-dependent and low-value.

Native watcher semantics are validated locally against the synthetic vault.

---

# ADR 0009

Add a concise ADR for the watch boundary.

Record:

1. Tauri fs `watchImmediate` is the raw acquisition mechanism.
2. Application-owned coalescing is used rather than treating events individually.
3. Watcher events are hints; re-observed filesystem state determines source changes.
4. Absolute paths stay inside the Tauri provider.
5. Targeted subtree reconciliation is preferred over routine full-vault rescans.
6. Unbounded/unsafe event conditions request full resync.
7. `move` is emitted only with conservative continuity evidence; otherwise delete+upsert.
8. KG10 application and UI live updates are deferred to KG11B2.

Do not turn the ADR into a watcher API tutorial.

---

# Documentation / roadmap

Likely update:

```text
packages/source-provider-tauri/README.md
apps/desktop/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/decisions/0009-*.md
apps/desktop/src-tauri/Cargo.toml
apps/desktop/src-tauri/Cargo.lock
apps/desktop/src-tauri/capabilities/main.json
```

Potential shared discovery-policy documentation only if changed.

After completion:

```text
KG11 — In progress
KG11A — Complete
KG11B1 — Complete: watch acquisition/coalescing/change planning
KG11B2 — Next: live KG10 application/resync/UI preservation
```

Do not mark KG11 complete.

---

# Scope

## In scope

- current Tauri watch API/type verification;
- enable fs watch feature;
- minimal watch/unwatch permissions;
- injectable native watcher bridge;
- normalized selected-root watch signals;
- short deterministic event burst coalescing;
- re-observation of actual filesystem state;
- targeted file/subtree discovery;
- deterministic inventory reconciliation;
- Markdown upsert/delete/move source plans;
- conservative move inference;
- non-Markdown inventory updates;
- explicit resync-required output;
- native synthetic watcher QA;
- unit tests;
- ADR/docs/roadmap;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- KG10 live application;
- React live updates;
- catalog persistence after watcher events;
- GraphExplorer reconciliation;
- full-resync execution;
- live-sync UI;
- automatic retry;
- source snippets/open-in-source;
- source editing;
- partial KG4 invalidation;
- workers;
- KG12 optimizations.

Do not begin KG11B2 automatically.

---

# Suggested implementation sequence

1. Inspect current watch API/types.
2. Enable Tauri watch feature + capabilities.
3. Extend fake/native bridge.
4. Add public normalized watch contract.
5. Implement path normalization/security checks.
6. Implement deterministic burst collector.
7. Implement affected-path/subtree observation.
8. Implement previous-vs-current inventory diff.
9. Add conservative move inference.
10. Add resync-required cases.
11. Unit-test using fake bridge/scheduler.
12. Run native Windows synthetic watcher matrix.
13. Adjust policy from observed evidence.
14. Add ADR/docs/roadmap.
15. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands, approximately:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/source-provider-tauri typecheck
pnpm exec vitest run packages/source-provider-tauri

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
native desktop watcher smoke
synthetic watcher event matrix
```

Do not claim native scenarios not actually run.

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG11B1 is complete only when:

1. Tauri fs watch feature is enabled.
2. Watch/unwatch capabilities remain selected-root scoped.
3. No new watcher package is added.
4. Native watcher is hidden behind the existing injectable platform bridge.
5. Source-provider public watch types contain no Tauri event types.
6. Absolute native event paths never escape the platform boundary.
7. Recursive selected-root watching works.
8. Watch cleanup is reliable.
9. Raw event bursts are coalesced deterministically.
10. Coalescing is unit-tested with an injected clock/scheduler.
11. Watch events are not treated as source truth.
12. Current filesystem state is re-observed before planning changes.
13. Discovery policy remains consistent with KG11A.
14. Hidden/node_modules/excluded content remains excluded.
15. Strict UTF-8 remains enforced.
16. Non-Markdown binary content is not read.
17. Targeted directory/subtree reconciliation works.
18. No-op event bursts yield no source changes.
19. Markdown edits yield upserts.
20. Markdown creates/deletes are correct.
21. Non-Markdown inventory updates are correct.
22. Unique exact-content rename can yield move.
23. Rename + edit yields atomic delete+upsert.
24. Duplicate identical content is never arbitrarily paired.
25. Unsafe/unbounded watcher conditions return resync-required.
26. Equivalent event ordering yields identical plan.
27. Native Windows synthetic watcher QA passes.
28. KG10/UI are untouched by watcher events in this milestone.
29. No private real-vault paths/content are committed.
30. ADR/docs are reconciled.
31. KG11 remains in progress.
32. KG11B1 is complete.
33. KG11B2 is next.
34. Existing KG1–KG11A tests remain green.
35. PR/post-merge CI pass.
36. Branch cleanup/worktree are clean.

Do not begin KG11B2.

---

# Final report

Report:

## 1. Summary

What watch/change-planning capability now exists.

## 2. Tauri watch contract

Exact API used, feature flag, recursive behavior, cleanup semantics, and permissions.

## 3. Source-provider boundary

Public normalized signals/change-plan APIs and proof that Tauri types/absolute paths do not leak.

## 4. Coalescing policy

Actual quiet/max timing chosen and why.

## 5. Filesystem reconciliation

How events are converted into observed net source state, including targeted subtrees.

## 6. Move policy

Exact conditions for `move` versus delete+upsert.

## 7. Resync conditions

Cases deliberately deferred to full resync in KG11B2.

## 8. Native watcher evidence

Aggregate synthetic Windows behavior for edit/create/delete/file rename/folder rename/etc. Do not dump raw platform sequences unless useful and synthetic.

## 9. Dependencies

List version/feature changes. Expected new top-level package count: zero.

## 10. Tests / validation

All commands and native scenarios actually run.

## 11. Security/privacy

Selected-root scope, no blanket permissions, no absolute-path/public leakage, no private vault fixture.

## 12. Files changed

Important provider/Tauri/docs areas.

## 13. ADR / roadmap

Confirm:

```text
KG11B1 complete
KG11B2 next
KG11 still in progress
```

## 14. Deviations / warnings

Surface OS-specific event limitations, event classes that force resync, batching tradeoffs, or anything that should block live application.

## 15. KG11B2 handoff

State exactly what live orchestration can rely on:

- recursive selected-root watch subscription;
- deterministic coalesced watch batches;
- current filesystem re-observation;
- complete `VaultSourceChangePlan`;
- updated full `VaultSourceInventory`;
- conservative move evidence;
- explicit `resync-required` result;
- no need for KG11B2 to understand raw Tauri events.

Do not implement KG11B2 automatically.
