# KG10 — Incremental Workspace Engine + Stable Snapshot Deltas

**Task type:** incremental source processing / canonical delta contract / correctness baseline

## Goal

Implement KG10 for `lillo24/icarus-graph-explorer`.

The runtime should become:

```text
initial Markdown sources
→ parse all once
→ cached ParsedObsidianDocument workspace
→ KG4 full workspace resolution
→ KG9A stable identity
→ stable KnowledgeSnapshot

atomic source change batch
→ reparse only upserted files
→ reuse cached parsed documents
→ KG4 full workspace resolution
→ KG9A reconciliation
→ new stable KnowledgeSnapshot
→ source-neutral KnowledgeSnapshotDelta
```

Return both the complete stable snapshot and an exact serializable delta. Existing KG6/KG8/renderer consumers may continue replacing their full snapshot.

Do **not** implement Tauri, filesystem watching, partial resolver invalidation, workers, source editing, or incremental React updates.

## Current repository evidence

KG9B merged through PR #12 at `72cce84dcca529ae0fd43e2071d848c26ec2eae5`. `ROADMAP.md` marks KG9 complete and KG10 next.

The current full source pipeline reparses every Markdown document before `resolveObsidianWorkspace()`, then runs `reconcileStableIdentity()`. KG9A now supplies the stable canonical entity/reference IDs required for meaningful diffs.

Before editing, sync `main`, verify a clean worktree, and inspect:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- ADR 0006
- `packages/core/src/model/*`
- `packages/adapter-obsidian/src/types.ts`
- `packages/resolver-obsidian/src/*`
- `packages/stable-identity/src/*`
- `tools/vault-diagnostics/src/pipeline.ts`
- `tools/vault-diagnostics/src/benchmark.ts`
- current synthetic fixtures/generators

Follow the repository branch/PR/CI/cleanup workflow.

---

# Critical architecture decision

KG10 is incremental at the **parsing/cache boundary**, but each successful change batch should still run the current **whole-workspace KG4 resolver** and **whole-snapshot KG9A reconciliation**.

A single target-file change can alter references authored in unchanged files:

```text
add Target.md        → unresolved [[Target]] elsewhere becomes resolved
add second Note.md   → resolved [[Note]] elsewhere becomes ambiguous
delete/rename target → inbound refs elsewhere change
rename heading       → cross-file heading refs change
change block anchor  → block refs elsewhere change
```

Therefore “resolve only the changed file” is not a safe baseline.

KG10 should establish:

```text
file-granular reparsing
+ globally correct full resolution
+ stable exact canonical delta
```

If full resolution becomes a bottleneck, KG12 can optimize invalidation after measurement.

---

# Package 1 — `snapshot-delta`

Create a source-neutral package:

```text
packages/snapshot-delta/
@icarus-graph-explorer/snapshot-delta
```

Dependency:

```text
snapshot-delta → core
```

No parser, Obsidian, stable-identity, diagnostics, UI, renderer, filesystem, Tauri, Graphology, or Sigma imports.

It owns a versioned plain-data delta, runtime validation, deterministic stable-ID diffing, and exact delta application.

Recommended contract:

```ts
interface AddedRecord<T> {
  readonly after: T
  readonly afterIndex: number
}

interface RemovedRecord<T> {
  readonly before: T
  readonly beforeIndex: number
}

interface UpdatedRecord<T> {
  readonly before: T
  readonly beforeIndex: number
  readonly after: T
  readonly afterIndex: number
}

interface SnapshotCollectionDelta<T> {
  readonly added: readonly AddedRecord<T>[]
  readonly removed: readonly RemovedRecord<T>[]
  readonly updated: readonly UpdatedRecord<T>[]
}

interface KnowledgeSnapshotDelta {
  readonly schemaVersion: 1
  readonly workspaceId: WorkspaceId
  readonly entities: SnapshotCollectionDelta<AddressableEntity>
  readonly references: SnapshotCollectionDelta<Reference>
}
```

If an equally compact exact-order representation fits the codebase better, use it and document why.

Classification is by stable ID:

```text
only after  → added
only before → removed
same ID + exact record equal → unchanged
same ID + canonical field differs → updated
```

Source-span shifts are updates. Resolution changes such as unresolved → resolved are updates when `ReferenceId` survives.

Expose roughly:

```ts
diffKnowledgeSnapshots(previous, next)
applyKnowledgeSnapshotDelta(previous, delta)
validateKnowledgeSnapshotDelta(value)
```

`applyKnowledgeSnapshotDelta()` must reject wrong workspaces, stale `before` records, ID conflicts, malformed indexes, and invalid resulting snapshots.

Primary invariant:

```text
applyKnowledgeSnapshotDelta(
  old,
  diffKnowledgeSnapshots(old, next)
) === next
```

Aim for exact deterministic JSON equivalence. Identical snapshots produce a valid empty delta.

---

# Package 2 — `workspace-engine-obsidian`

Create:

```text
packages/workspace-engine-obsidian/
@icarus-graph-explorer/workspace-engine-obsidian
```

Expected workspace dependencies:

```text
adapter-obsidian
resolver-obsidian
stable-identity
snapshot-delta
core
```

No filesystem/platform/UI/renderer/Graphology/Sigma imports.

It owns:

- cached `ParsedObsidianDocument` values by `WorkspacePath`;
- atomic in-memory source-change batches;
- file-granular reparsing;
- full KG4 resolution over the cache;
- KG9A reconciliation;
- stable snapshot-delta generation.

KG11 will provide actual filesystem/watch events later.

## Initialization

Likely API:

```ts
initializeObsidianWorkspaceEngine({
  workspaceId,
  documents,       // path + source
  identityCatalog, // optional
})
```

Sequence:

```text
validate input
→ parse all documents once
→ full KG4 resolve
→ KG9A reconcile
→ runtime engine
```

If no catalog is supplied, create one in memory from the supplied workspace ID. Do not generate UUIDs or persist catalogs here.

Runtime state may internally hold Maps and approximately:

```text
workspace ID
parsed-document cache
current stable snapshot
current StableIdentityCatalog
current resolver diagnostics
runtime revision
```

Avoid retaining full raw Markdown source after parsing unless necessary.

## Source changes

Use a small explicit union:

```ts
type WorkspaceSourceChange =
  | { kind: 'upsert'; path: WorkspacePath; source: string }
  | { kind: 'delete'; path: WorkspacePath }
  | { kind: 'move'; fromPath: WorkspacePath; toPath: WorkspacePath }
```

Semantics:

- `upsert`: add or replace; parse that file.
- `delete`: remove existing Markdown; missing path is explicit out-of-sync failure.
- `move`: same source content, path changed; reuse parsed IR and change `structure.path`, then full-resolve. Zero reparses.

For rename + edit use one atomic batch:

```text
delete old/path.md
upsert new/path.md with new source
```

`move` must not force stable identity reuse. KG9A remains authoritative.

## Atomic update

Likely API:

```ts
applyObsidianWorkspaceChanges(engine, changes)
```

Sequence:

```text
validate complete batch
→ stage cache changes
→ parse only upserts
→ full KG4 resolve
→ KG9A reconcile using current catalog
→ diff old stable snapshot → new stable snapshot
→ construct next engine state
→ commit success
```

Any failure leaves the previous cache/snapshot/catalog/revision unchanged.

Reject conflicting batches such as:

```text
upsert A + delete A
two upserts A
move A→B + another op touching A or B
two moves targeting B
```

Equivalent non-conflicting change order must produce identical results.

Expected reparse counts:

```text
delete: 0
move: 0
one upsert: 1
three upserts: 3
```

Expose enough stats to prove this without creating a public parser-injection framework solely for tests.

A success result should expose approximately:

```text
next engine
stable snapshot
KnowledgeSnapshotDelta
next StableIdentityCatalog
resolution diagnostics
identity summary/diagnostics
reparsedPaths / reusedParsedDocumentCount
fromRevision / toRevision
```

Runtime revision is sequencing metadata only, never canonical/persisted source truth.

Failures should be explicit (`input`, `parse`, `resolution`, `identity`, `delta`) and actionable.

---

# Required global semantic cases

The engine must prove that `reparsedPaths` and delta scope are different concepts.

### Add missing target

Initial:

```text
A.md contains [[Target]]
Target.md absent
```

Upsert only `Target.md`.

Expected:

```text
Target.md reparsed
A.md not reparsed
A's existing stable reference: unresolved → resolved
delta includes A's reference update
```

### Create ambiguity

Start with one `Note.md` so `[[Note]]` resolves. Add a second matching `Note.md`.

The source file containing `[[Note]]` is not reparsed, but the reference becomes ambiguous. Deleting one duplicate reverses it.

### Heading change

A contains `[[B#Details]]`; edit only B and rename `# Details`.

A is not reparsed, but the reference updates.

### Block-anchor change

Change/remove only the target block anchor. Inbound block references elsewhere update.

### Delete target

Deleting a target reparses zero unchanged source files but may update inbound references globally.

### Move

Pure move reuses parsed IR, uses the new path for KG4 semantics, and lets KG9A decide stable-ID continuity. Reused stable IDs with changed paths should appear as delta `updated`, not remove+add.

---

# Rename/coalescing rule for KG11

KG9A has no historical tombstone resurrection.

Rename identity continuity is strongest when the future source provider supplies:

```text
one move
```

or one atomic:

```text
delete old
upsert new
```

If deletion commits in one successful batch and addition arrives later, the old identity may already be retired.

Document this explicitly. Do not add tombstone history in KG10.

---

# Full-rebuild correctness oracle

Every important incremental scenario must be compared with a fresh complete rebuild.

Given:

```text
old raw source map
old stable catalog
old stable snapshot
```

Incremental path:

```text
engine + change batch
→ incremental next snapshot/catalog/delta
```

Oracle path:

```text
ALL updated raw sources parsed from scratch
→ KG4 resolve
→ KG9A using the SAME old catalog
→ full next snapshot/catalog
```

Require:

```text
incremental next snapshot == full next snapshot
incremental next catalog == full next catalog
apply(old snapshot, delta) == full next snapshot
```

Use exact deterministic JSON equivalence where possible.

This is the primary KG10 semantic gate.

---

# Full pipeline / benchmarks

Keep `buildReportFromSources()` as the full-rebuild baseline. Do not silently replace it with the incremental engine.

Extend the current benchmark harness with small/medium incremental cases.

Record:

```text
workspace scale
change type
changed path count
reparsed file count
incremental total time
delta added/removed/updated counts
full rebuild comparison where practical
```

One-file edit is mandatory. A few add/delete/move cases are useful.

No timing budgets.

If whole-workspace KG4/KG9A dominates medium incremental time, report that evidence for KG12 rather than implementing partial resolution now.

---

# Real Icarus validation

Use the ignored private Icarus vault only in memory.

Do **not** write test edits to disk.

1. Read the private workspace into memory.
2. Initialize KG10 with the current stable workspace/catalog.
3. Choose one deterministic Markdown source without exposing its name.
4. Make a harmless in-memory body/offset-only edit.
5. Apply one `upsert`.
6. Full-rebuild the same revised in-memory source set using the same previous catalog.
7. Assert exact snapshot/catalog equality.
8. Assert exactly one file reparsed.
9. Discard the edit.

Final report uses aggregate counts/timings only. Do not commit a real delta or engine dump.

---

# Out-of-sync behavior

Fail explicitly for:

```text
delete missing path
move missing source
move into existing target
conflicting batch
```

A future KG11 caller can respond with a full source resync.

KG10 itself does not scan the filesystem.

---

# Downstream scope

Do not make KG6, explorer-inspection, or React Flow consume deltas incrementally in KG10.

The complete stable snapshot remains the current downstream baseline.

Delta is additional capability for later live update orchestration, incremental indexes, worker transfer, and KG12 optimization.

Do not create diagnostic-report JSON patches.

---

# Tests

## Snapshot delta

Cover at least:

1. empty delta;
2. add entity/reference;
3. remove entity/reference;
4. source-span update with same stable ID;
5. stable path move/order change;
6. unresolved → resolved reference;
7. ambiguity candidate change;
8. multiple simultaneous changes reconstruct exact next snapshot;
9. stale-base rejection;
10. wrong-workspace rejection;
11. malformed/duplicate record rejection;
12. JSON round trip;
13. deterministic diff;
14. input immutability.

## Workspace engine

Cover at least:

1. initialization parses all once and returns stable snapshot/catalog;
2. one upsert reparses one file;
3. multi-upsert reparses only those files;
4. delete reparses zero;
5. move reparses zero;
6. missing delete fails atomically;
7. invalid move fails atomically;
8. conflicting batch rejected;
9. equivalent batch order deterministic;
10. add target updates unchanged inbound reference;
11. duplicate basename creates ambiguity without reparsing source;
12. delete duplicate/target updates resolution;
13. heading change updates unchanged inbound reference;
14. block-anchor change updates unchanged inbound reference;
15. offset shift preserves stable IDs according to KG9A and yields updates rather than ID churn;
16. move follows KG9A continuity policy;
17. rename+edit atomic batch follows KG9A policy;
18. weak identity change becomes remove/add when KG9A refuses continuity;
19. incremental snapshot == full rebuild;
20. incremental catalog == full rebuild;
21. old snapshot + delta == full rebuild;
22. delta can contain changes outside reparsed paths;
23. revision advances only on successful commit;
24. failed batch preserves cache/snapshot/catalog/revision.

---

# Non-goals / dependencies

Expected external runtime additions:

```text
zero
```

Do not add:

- Tauri or source-provider platform code;
- filesystem watchers/chokidar;
- browser directory APIs;
- polling/debounce watcher logic;
- content hashes just to detect no-op upserts;
- partial KG4 invalidation;
- incremental identity heuristics;
- historical tombstones;
- incremental KG6/KG8/renderer updates;
- source writes;
- workers;
- Graphology/Sigma;
- graph-diff libraries;
- performance budgets.

The source provider tells KG10 which files changed; KG10 need not own the full raw workspace just to detect changes.

---

# ADR 0007

Add a concise ADR recording:

1. platform/source provider stays outside KG10;
2. parsed documents are cached by normalized path;
3. source changes are atomic/coalesced batches;
4. only upserts reparse;
5. every successful batch still runs whole-workspace KG4 resolution;
6. KG9A remains identity owner;
7. a source-neutral stable-ID snapshot delta is derived afterward;
8. complete stable snapshot remains the correctness baseline;
9. partial resolver invalidation is deferred until measured;
10. rename continuity is strongest with atomic move/coalesced delete+add.

---

# Documentation / roadmap

Likely update:

```text
packages/snapshot-delta/README.md
packages/workspace-engine-obsidian/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/decisions/0007-*.md
tools/vault-diagnostics/README.md
README.md
eslint.config.*
```

Architecture should show:

```text
SourceProvider
→ initial sources / atomic changes
→ workspace-engine-obsidian
    → parsed cache
    → file-granular KG3 reparsing
    → full KG4 resolution
    → KG9A reconciliation
→ stable KnowledgeSnapshot + KnowledgeSnapshotDelta
```

Explicitly document:

```text
incremental source work ≠ local-only semantic effects
```

When complete:

```text
KG10 — Complete
KG11 — Next
```

Do not begin KG11 automatically.

No new repository-local skill is needed; reconsider Tauri-specific guidance in KG11.

---

# Validation

Run focused and repository checks, approximately:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/snapshot-delta typecheck
pnpm exec vitest run packages/snapshot-delta

pnpm --filter @icarus-graph-explorer/workspace-engine-obsidian typecheck
pnpm exec vitest run packages/workspace-engine-obsidian

pnpm --filter @icarus-graph-explorer/resolver-obsidian typecheck
pnpm exec vitest run packages/resolver-obsidian

pnpm --filter @icarus-graph-explorer/stable-identity typecheck
pnpm exec vitest run packages/stable-identity

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

Also run:

```text
small incremental benchmark
medium incremental benchmark
ignored real-vault in-memory one-file validation
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG10 is complete when:

1. source-neutral versioned delta package exists and depends only on core;
2. delta diff/apply is validated, deterministic, JSON-safe;
3. `apply(diff(old,new))` exactly reproduces `new`;
4. source-span/resolution changes remain updates when stable IDs survive;
5. stale-base application fails;
6. in-memory Obsidian engine exists with no platform/UI dependency;
7. initialization parses all once and returns stable snapshot/catalog;
8. runtime caches KG3 parsed docs;
9. only upserted files reparse;
10. delete/move reparse zero;
11. batches are atomic/deterministic and conflicts fail;
12. every successful batch runs current full KG4 resolution;
13. KG9A remains sole identity owner;
14. target/ambiguity/heading/block/deletion cases update unchanged inbound refs correctly;
15. delta may contain changes outside the reparse set;
16. incremental next snapshot/catalog exactly equal fresh full rebuild using the same old catalog;
17. applying produced delta to old snapshot equals that full rebuild;
18. failed batches preserve runtime state;
19. downstream packages may still use full snapshots;
20. current full pipeline remains the oracle;
21. small/medium evidence collected without budgets;
22. ignored real-vault validation passes without disk edits;
23. no private delta/source/engine dump committed;
24. ADR/docs reconciled;
25. KG10 complete / KG11 next;
26. existing tests green;
27. PR/post-merge CI pass and cleanup completes.

---

# Final report

Report:

## 1. Summary
Incremental capability added.

## 2. Architecture
Explain `change batch → parsed cache → reparse changed files → full KG4 → KG9A → stable snapshot + delta`, including why full resolution remains intentional.

## 3. Snapshot-delta contract
Schema, add/remove/update semantics, ordering, validation, exact apply.

## 4. Workspace-engine contract
Initialization, change kinds, atomicity, revisions, failures.

## 5. Reparse evidence
Exact changed/reparsed counts.

## 6. Global semantic invalidation
Cases where one target change updated unchanged source refs.

## 7. Stable identity
Confirm KG9A remained authoritative.

## 8. Correctness oracle
Report:

```text
incremental snapshot == full rebuild
incremental catalog == full rebuild
old + delta == new
```

## 9. Performance evidence
Small/medium operation, reparse counts, total incremental time, delta counts, full-build comparison.

## 10. Real Icarus validation
Aggregate scale, one in-memory changed file, reparse count, oracle equality, timing. No private path/content.

## 11. Dependencies
Expected external additions: zero.

## 12. Tests / validation
Every command actually run, test counts, benchmarks, PR/post-merge CI.

## 13. Privacy
Confirm no real edit/delta/engine dump/catalog/report committed.

## 14. Files changed
Important packages/tooling/docs.

## 15. ADR / roadmap
Confirm `KG10 complete` and `KG11 next`.

## 16. Deviations / warnings
Full resolver cost, rename/coalescing limits, delta-size concerns, inherited KG9A limits, KG11 blockers.

## 17. KG11 handoff
State that KG11 can supply normalized initial sources plus atomic upsert/delete/move batches to this platform-independent engine; only upserts reparse; each batch returns globally correct stable snapshot/catalog/delta; out-of-sync failures can trigger full resync; the UI may initially replace the complete snapshot.

Do not implement KG11 automatically.
