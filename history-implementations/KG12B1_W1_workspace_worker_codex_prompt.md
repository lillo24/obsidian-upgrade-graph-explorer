# KG12B1 — W1 Workspace Worker: KG10 + Diagnostics Off the UI Thread

**Task type:** dedicated Web Worker architecture / stateful workspace processing / transactional worker protocol / main-thread responsiveness

## Goal

Implement the W1 decision produced by KG12A:

```text
Tauri source acquisition / KG11B1 planning
            ↓
        main thread
            ↓
serializable worker request
            ↓
      Dedicated Web Worker
        ├─ KG10 workspace engine
        ├─ parsed-document cache
        ├─ KG4 resolution
        ├─ KG9A reconciliation
        └─ diagnostic report construction
            ↓
prepared report + next stable catalog
            ↓
        main thread
        ├─ persist catalog app-locally
        └─ confirm prepared worker state
            ↓
atomic runtime/report adoption
```

The user-visible goal is **responsiveness**, not lower KG10 wall-clock time.

KG12A measured medium/large whole-workspace work at hundreds to thousands of milliseconds. W1 should let graph/UI interactions remain responsive while that work executes.

Do not redesign KG10 semantics, canonical models, source acquisition, projection, React Flow, or Dagre.

W3/Dagre workerization remains a separate follow-up.

---

## Current repository evidence

Repository: `lillo24/icarus-graph-explorer`

KG12A merged through PR #22 at:

`8bda18fe6d8fd3a72dc73a735d1a4960698e2273`

UX4B merged through PR #21 at:

`6cc57a1798b0220247a413f9fc98dfeef4f50dbc`

Current roadmap:

```text
KG12 — In progress
KG12A — Complete
KG12B — worker hardening next
```

KG12A's explicit decision is:

```text
W1 KG10 + diagnostics → worker in KG12B
W2 projection          → remain main-thread
W3 Dagre               → worker in KG12B
W4 inspection/search   → remain main-thread
```

Relevant evidence:

```text
one-file KG10 update
small:   66.5 / 79.1 ms median/p95
medium:  574.9 / 579.5 ms
large:   5,176.1 / 5,428.2 ms

report construction
medium:  346.9 / 484.3 ms
large:   1,132.0 / 1,450.1 ms
```

Class A direct-feedback budget:

```text
median 16 ms
p95    32 ms
```

Class C workspace budget:

```text
median 1,000 ms
p95    2,500 ms
```

Primary KG12B1 success condition:

> W1 work may still take hundreds or thousands of milliseconds, but it must no longer monopolize the UI thread and prevent Class A interactions.

---

## Required first step

Before editing:

1. sync latest `main`;
2. verify clean worktree;
3. inspect:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/PERFORMANCE.md`;
   - `docs/ROADMAP.md`;
   - ADR 0007, 0008, 0010;
   - `packages/workspace-engine-obsidian/src/types.ts`;
   - `packages/workspace-engine-obsidian/src/engine.ts`;
   - `packages/diagnostics-obsidian/src/report.ts`;
   - `packages/diagnostics-obsidian/src/types.ts`;
   - `apps/web/src/desktop-vault.ts`;
   - `apps/web/src/desktop-live-vault.ts`;
   - `apps/web/src/desktop-runtime.ts`;
   - `apps/web/src/App.tsx`;
   - `apps/web/vite.config.ts`;
   - `apps/web/tsconfig.json`;
   - `packages/performance/*`;
4. inspect current installed Vite worker behavior/types;
5. preserve UX4B and KG12A instrumentation;
6. follow normal branch/PR/CI/cleanup flow.

If current code materially differs from this plan, preserve the latest repository architecture and report the discrepancy.

---

# Architecture decision

## Worker owns the engine

`ObsidianWorkspaceEngine` is stateful and method-bearing:

```text
workspaceId
revision
snapshot
identityCatalog
resolutionDiagnostics
parsedDocument(path)
parsedDocuments()
```

The concrete engine owns parsed documents privately.

Do **not** send `ObsidianWorkspaceEngine` between threads.

Web Worker `postMessage()` uses structured clone; function/method-bearing state is not a valid durable worker protocol.

The Dedicated Worker must own:

```text
KG10 engine
parsed-document cache
KG4/KG9A work
candidate engine state
diagnostic construction
```

for the active local-vault session.

Do not make KG10 engine state serializable just to cross the worker boundary.

## Diagnostics move with KG10

The diagnostic report needs:

```text
stable snapshot
resolution diagnostics
parsed documents
non-Markdown paths
```

Because parsed documents remain worker-owned, diagnostic construction should run in the same worker.

Do not send parsed documents back to main merely to rebuild the report.

Worker output should normally be:

```text
ObsidianDiagnosticReport
next StableIdentityCatalog
compact metadata/timings/stats
```

not:

```text
engine
parsed documents
full delta
```

The report already includes the stable snapshot.

---

# Scope split

Implement only W1 in this PR.

After completion:

```text
KG12 — In progress
KG12A — Complete
KG12B1 / W1 — Complete
KG12B2 / W3 Dagre worker — Next
```

Do not workerize Dagre in this plan.

W1 and W3 have different semantics:

```text
W1 = stateful sequential source processing
W3 = stateless derived latest-layout-wins work
```

Do not create one universal worker abstraction for both.

---

# Recommended structure

Prefer approximately:

```text
packages/workspace-worker/
  README.md
  src/
    protocol.ts
    runtime.ts
    validation.ts
    index.ts

apps/web/src/workers/
  workspace.worker.ts
  workspace-worker-client.ts
```

Exact names may change if current repo evidence suggests better placement.

Dependency direction:

```text
workspace-worker
  → workspace-engine-obsidian
  → diagnostics-obsidian
  → existing domain packages

web worker entry/client
  → workspace-worker

desktop orchestration
  → worker client abstraction
```

`packages/workspace-worker` should contain the testable state machine and protocol but **no browser Worker global**.

Forbid imports from:

```text
React
React Flow
Tauri/source-provider-tauri
node:fs
renderer-reactflow
view-projection
explorer-inspection
Graphology/Sigma
```

The app worker entry/client may use browser Worker APIs.

---

# Vite worker creation

Use Vite's current standards-oriented form:

```ts
new Worker(new URL('./workspace.worker.ts', import.meta.url), {
  type: 'module',
})
```

Keep `new URL(...)` directly inside the `new Worker()` expression and keep options static so Vite recognizes the worker.

Do not add a Vite plugin or worker RPC dependency.

Do not inline the worker by default; a separate production worker chunk is appropriate.

Ordinary Sample/Open Report browser use should not instantiate this worker.

Prefer preserving the current desktop-only dynamic import boundary.

---

# Worker protocol

Create a small versioned plain-data protocol.

Conceptually:

```ts
const WORKSPACE_WORKER_PROTOCOL_VERSION = 1
```

Every request/response contains:

```text
protocolVersion
requestId
kind
```

Request IDs and candidate IDs are runtime-only and never enter canonical or persisted state.

## Requests

Use a union roughly equivalent to:

```text
prepare-initialize
prepare-changes
prepare-resync
build-committed-report
commit-candidate
discard-candidate
```

### prepare-initialize

Input:

```text
workspaceId
initial Markdown source documents
previous/new stable identity catalog
nonMarkdownPaths
```

Worker:

```text
initialize KG10
→ build stable diagnostic report
→ hold candidate engine
→ return prepared candidate
```

Do not commit yet.

### prepare-changes

Input:

```text
expected committed revision
WorkspaceSourceChange[]
next nonMarkdownPaths
```

Worker:

```text
apply KG10 to committed engine
→ build stable report
→ hold candidate engine
→ return prepared candidate
```

### prepare-resync

Input:

```text
full current Markdown documents
nonMarkdownPaths
```

Healthy worker uses its currently committed identity catalog.

If replacing a dead worker, main creates a new worker and uses `prepare-initialize` with the last durable catalog.

### build-committed-report

For non-Markdown-only changes:

```text
committed engine + new nonMarkdownPaths
→ report
```

No engine revision change and no identity-catalog write.

### commit-candidate

After main has persisted the returned catalog:

```text
candidateId
→ promote candidate engine to committed
```

### discard-candidate

On persistence/session failure:

```text
candidateId
→ discard pending candidate
```

Only one pending mutation candidate may exist.

---

# Prepared response

Return only what main needs, approximately:

```text
candidateId
workspaceId
fromRevision
toRevision
stable ObsidianDiagnosticReport
next StableIdentityCatalog
identity summary / existing identity counts
parse stats
worker internal timing phases
compact delta counts if useful
```

Do not return by default:

```text
ObsidianWorkspaceEngine
ParsedObsidianDocument[]
full KnowledgeSnapshotDelta
```

A path-dependent move can create a very large delta and no current UI consumer needs it.

Keep KG10 delta computation/correctness internally unchanged.

---

# Structured-clone contract

Requests/responses must be plain structured-cloneable data.

Avoid protocol payloads containing:

```text
functions
DOM objects
Tauri handles
React values
Error instances
method-bearing classes
```

Use explicit serializable failure values:

```ts
{
  kind: 'failure',
  requestId,
  stage,
  code,
  message
}
```

Add representative `structuredClone()` tests for protocol requests/responses.

Do not JSON-stringify large workspace messages just to transfer them; native structured clone is the transport.

---

# Worker state machine

Conceptually:

```text
EMPTY

or

COMMITTED
  engine
  current nonMarkdownPaths

optional PENDING
  candidateId
  candidate engine
  candidate report
  candidate catalog
  candidate metadata
```

Hard invariants:

1. at most one committed engine;
2. at most one pending mutation candidate;
3. second prepare while pending fails;
4. commit/discard requires exact candidate ID;
5. changes require exact expected committed revision;
6. commit advances exactly to prepared revision;
7. discard leaves committed revision unchanged;
8. diagnostic-only report generation does not mutate engine.

---

# Preserve KG11 transaction semantics

Current KG11 is:

```text
candidate KG10 state
→ candidate report
→ persist catalog
→ adopt runtime/report
```

Worker form must become:

```text
main receives KG11B1 plan
→ worker prepareChanges
→ worker returns report + catalog, holds candidate
→ main persists catalog
→ worker commitCandidate
→ main adopts report + inventory + revision
```

The visible report must not change until both:

```text
catalog persistence succeeded
worker commit acknowledged
```

Do not let worker preparation permanently mutate committed state before confirmation.

---

# Persistence failure

If app-local catalog persistence fails:

```text
keep old report/inventory
→ discard candidate
→ keep old worker committed revision
→ pause live sync using existing KG11 policy
```

Do not silently downgrade an already-stable live workspace.

---

# Worker commit failure after persistence

This new failure case needs explicit handling:

```text
worker prepares candidate
→ main persists candidate catalog successfully
→ worker crashes before commit acknowledgement
```

Durable identity is now ahead of the old worker state.

Safe policy:

```text
do not adopt candidate report blindly
mark session paused/recovering
terminate dead worker
full source rescan
create replacement worker using the newly durable catalog
reinitialize from current disk state
validate/persist/commit replacement state
resume only after success
```

Main orchestration must therefore retain the **last durably persisted catalog** separately from worker committed revision.

Add deterministic failure-injection tests for this exact sequence.

---

# Desktop runtime refactor

Current `DesktopVaultRuntime` contains:

```ts
engine: ObsidianWorkspaceEngine
```

That cannot remain the production ownership model.

Refactor toward something like:

```ts
interface DesktopVaultRuntime {
  selection
  inventory
  identitySession
  workspaceId
  revision
  durableIdentityCatalog
  processor: DesktopWorkspaceProcessor
}
```

Exact naming is flexible.

Main code should no longer rely on:

```text
runtime.engine.parsedDocuments()
runtime.engine.identityCatalog
runtime.engine.snapshot
```

The current validated report is the UI's canonical snapshot source.

The worker owns the internal KG10 engine.

---

# Main-thread processor abstraction

Do not let `desktop-vault.ts` / `desktop-live-vault.ts` manipulate raw Worker events.

Expose a narrow async abstraction, conceptually:

```ts
interface DesktopWorkspaceProcessor {
  prepareInitialize(...)
  prepareChanges(...)
  prepareResync(...)
  buildCommittedReport(...)
  commitCandidate(candidateId)
  discardCandidate(candidateId)
  terminate()
}
```

Production implementation uses Dedicated Worker.

Tests can use an in-process/fake transport.

Do not provide a silent synchronous production fallback: if the worker cannot start in desktop local-vault mode, fail explicitly or preserve the prior source rather than reintroducing the exact main-thread problem KG12B1 targets.

---

# Worker client

Main-thread client should own:

```text
Worker instance
monotonic request ID
pending request Promise map
disposed/fatal flag
worker generation
```

Handle:

```text
message
error
messageerror
terminate
```

On fatal transport failure:

```text
reject all pending requests
mark client unusable
ignore later messages
let KG11 recovery create replacement processor
```

Do not auto-create a replacement worker behind an in-flight transaction without orchestration knowing which catalog is durable.

---

# Latest-result-wins clarification

KG12A requested latest-result/stale rejection, but W1 is stateful.

Do **not** drop earlier same-workspace source mutations.

Correct semantics:

```text
same workspace:
  process committed source changes sequentially

new source session / disposed worker:
  terminate old worker
  stale responses cannot adopt

prepared candidate:
  exact candidate + revision required
```

W3 later can use more aggressive latest-layout-wins because layout is pure derived state.

Document this distinction.

---

# Initial Open Vault

Workerize initial KG10 initialization + diagnostic report construction.

Main flow:

```text
source discovery + identity load
→ worker prepareInitialize
→ report + candidate catalog
→ commitWorkspaceIdentity
→ worker commitCandidate
→ return stable opened/live runtime
```

Tauri source acquisition remains on main/app side.

## Initial persistence failure

Preserve KG11A transient one-shot fallback:

1. do not commit candidate;
2. transform only report `identity.stability` from `stable` to `transient` and revalidate;
3. discard/terminate worker;
4. return transient one-shot report;
5. do not start live controller.

Do not reparse or return parsed documents just to build the transient version.

---

# Live Markdown updates

For each serialized KG11B1 Markdown plan:

```text
worker prepareChanges
→ worker KG10 + report
→ main persists catalog
→ worker commitCandidate
→ main atomically adopts report/inventory/revision
```

Preserve all current KG11 behavior:

```text
upsert
create
delete
move
rename+edit
rapid queued batches
```

No source-plan ordering regression.

---

# Non-Markdown-only updates

Current semantic rule remains:

```text
no KG10 update
```

But diagnostics are worker-owned, so use:

```text
worker buildCommittedReport(next nonMarkdownPaths)
```

Then main adopts:

```text
next inventory + next report
```

No catalog write and no engine revision change.

---

# Full resync

Healthy worker:

```text
main full source discovery
→ worker prepareResync(full docs, nonMarkdownPaths)
→ report + candidate catalog
→ persist catalog
→ commit worker candidate
→ adopt
```

Dead/unusable worker:

```text
full source discovery
→ create replacement worker
→ prepareInitialize(
     same workspaceId,
     full docs,
     last durable catalog,
     nonMarkdownPaths
   )
→ persist/confirm
→ replace processor
→ adopt
```

Do not create a new workspace ID.

Do not reset KG9 view state.

---

# Startup watcher race

KG11 currently starts watching before one-shot acquisition.

Preserve:

```text
watch active/buffering
→ source acquisition
→ worker initialize
→ persist/commit
→ drain buffered changes through worker
```

Do not regress to:

```text
long initialize
→ then start watcher
```

---

# Source switching

For:

```text
vault A → vault B
vault A → Sample
vault A → JSON report
```

preserve existing source-session semantics.

Old worker is terminated only when the existing handoff says A is no longer the active source.

Opening B must not destroy A before B succeeds.

Temporary simultaneous workers during B bootstrap are acceptable.

Generation guards must ensure late A worker responses cannot mutate B.

---

# Keep W2/W4 main-thread

Do not workerize:

```text
createProjectionWorkspace
projectView
createInspectionWorkspace
search
inspection
```

KG12A explicitly chose main-thread for W2/W4.

---

# Keep W3 main-thread

After W1 report adoption, current path remains:

```text
report
→ projection
→ renderer mapping
→ Dagre on main thread
→ React Flow
```

Remaining Dagre jank is expected and must stay visible in performance evidence.

Do not begin W3 in this PR.

---

# Source acquisition remains outside worker

KG12A observed a slow full-rescan source-acquisition sample.

Do not move:

```text
Tauri readDir/readFile
watch reconciliation
source-provider scanning
```

into W1.

Those are async platform I/O and a different concern.

Keep status/progress truthful while source acquisition runs.

---

# Performance instrumentation

Preserve KG12A I1–I18 contracts.

Worker responses should provide internal timings so existing labels still have meaning:

```text
workspace-update
report-construction
```

Also collect W1-specific evidence for:

```text
worker compute total
worker request round-trip
main-thread RAF/event-loop responsiveness while worker runs
```

If adding a new performance phase, keep it generic and aggregate-only.

Never record:

```text
source paths
workspace IDs
request IDs
candidate IDs
source text
```

---

# W1 performance target

Do not require computation itself to become faster.

Success means:

```text
medium/large W1 compute runs in worker
while direct UI interaction remains Class A responsive
```

For medium and selected large synthetic workloads:

1. start worker W1 request;
2. run RAF/event-loop responsiveness probe continuously;
3. exercise representative direct interaction if practical;
4. record:
   - worker internal compute;
   - worker round-trip;
   - RAF/high gap;
   - interaction response;
5. compare against direct/main-thread KG12A baseline.

If structured-clone/postMessage payload transfer itself causes a repeatable >32 ms main-thread stall, report it and reduce unnecessary payloads.

Do not invent a new CI millisecond threshold.

---

# Payload minimization

Avoid unnecessary cross-thread copies.

Update request:

```text
changes
next nonMarkdownPaths
expected revision
```

Initialization/resync necessarily sends full Markdown source documents.

Prepared response:

```text
report
catalog
compact metadata/timings
```

Do not send duplicate snapshot outside the report.

Do not send parsed documents or full delta.

Do not preemptively convert source strings into ArrayBuffers unless measurement proves source-string structured cloning is the next actual bottleneck.

---

# Protocol validation

Worker boundary validates protocol/state correctness:

- supported protocol version;
- valid request ID;
- supported kind;
- expected revision;
- pending-candidate conflicts;
- candidate ID on commit/discard;
- initialized/empty state requirements.

Do not duplicate KG10's source/change validation.

KG10 remains authoritative for domain input semantics.

---

# Failure taxonomy

Keep distinguishable categories, e.g.:

```text
protocol
workspace
diagnostics
transport
terminated
internal
```

When KG10 returns a typed failure, preserve its stage/code/message in plain serializable form.

Current recovery semantics remain:

```text
KG10 input/out-of-sync → full resync
KG10 non-input/internal → pause/manual recovery
worker transport/runtime failure → pause + replacement-worker resync
```

Do not flatten everything into one generic worker error.

---

# TypeScript worker environment

Avoid changing all app/domain TypeScript libs to include WebWorker globals.

Keep worker-global typing localized to the worker entry.

The runtime package must not depend on `DedicatedWorkerGlobalScope`.

If needed use a narrow structural host interface in the entry or a worker-specific local type reference.

Do not create broad DOM/WebWorker type conflicts in `apps/web/tsconfig.json`.

---

# Tests — worker runtime

Cover at least:

1. initialize prepare returns valid report/catalog but is not committed;
2. initialize commit;
3. initialize discard;
4. change prepare from committed state;
5. change commit advances once;
6. change discard preserves committed state;
7. second prepare while pending fails;
8. stale expected revision fails;
9. wrong candidate commit/discard fails;
10. non-Markdown report does not change revision;
11. resync uses committed catalog;
12. KG10 input failure serializes correctly;
13. diagnostics failure does not commit candidate;
14. representative request/response passes `structuredClone()`;
15. response contains no engine/functions/parsed docs.

---

# Tests — client/transport

Using a fake Worker transport:

- request IDs resolve the right promise;
- malformed response fails explicitly;
- `error` rejects pending;
- `messageerror` rejects pending;
- terminate rejects pending;
- disposed client ignores late responses;
- no pending-promise leak;
- stale source-session result cannot adopt;
- worker created lazily only for desktop local-vault path.

Do not require native Worker for every unit test.

---

# Tests — desktop open/live orchestration

Adapt existing KG11 tests instead of replacing them.

Cover:

## Initial open

- discovery/identity flow retained;
- worker init awaited;
- catalog persists before commit;
- stable open only after commit ack;
- persistence failure produces validated transient report and no live worker;
- commit failure after persistence has explicit recovery/failure behavior;
- timings/identity counts preserved.

## Live

- upsert/create/delete/move;
- queued batches;
- non-Markdown-only;
- no-op;
- resync-required;
- KG10 input failure → full resync;
- non-input failure → pause;
- catalog persistence failure → discard + pause;
- worker transport failure → pause/recovery;
- worker commit failure after durable write → replacement-worker recovery;
- manual Rescan;
- watch batch during resync;
- source-switch stale response rejection;
- old graph remains visible until successful adoption.

---

# Correctness oracle

Workerization must not change domain output.

For deterministic small/medium cases compare:

```text
direct KG10 + diagnostics
vs
worker prepared report/catalog
```

Require exact equality for:

```text
report.snapshot
identity catalog
resolution diagnostics/probes
source inventory counts
```

for:

```text
initialization
edit
add
delete
move
full resync
non-Markdown-only report
```

Existing KG10 full-rebuild/delta oracles remain unchanged.

---

# Native Tauri QA

Use actual production/release-like Tauri build.

Synthetic scenarios:

1. Open Vault worker initializes.
2. Graph loads normally.
3. Live Markdown update goes through worker.
4. UI remains responsive during medium worker update.
5. Rapid saves remain serialized.
6. Full Rescan uses worker.
7. Persistence failure injection preserves old graph.
8. Worker failure injection exposes recovery.
9. Source switch terminates old worker safely.
10. Sample/JSON mode still works.
11. restart/reselect stable vault still restores identity/view.
12. no Worker/CSP/module-load console errors.

---

# Private real-vault evidence

KG12A could not access the documented private Icarus path.

Do not substitute another private repository.

If a real vault becomes available, collect aggregate-only W1 initialization/rescan evidence.

If unavailable, synthetic medium/large evidence is sufficient and final report must say no real-vault W1 timing was collected.

---

# Worker bundle evidence

Record diagnostically:

```text
worker chunk size
main web chunk change
desktop dynamic chunk change if meaningful
```

Do not make bundle optimization a new project unless workerization creates an actual severe regression.

---

# Dependencies

Expected external runtime additions:

```text
zero
```

Do not add:

```text
Comlink
workerpool
RPC libraries
schema libraries
serialization libraries
```

Use browser Worker + Vite + existing packages.

If an external dependency becomes necessary, stop and justify it before adding.

---

# ADR 0011

Add a concise ADR recording:

1. Dedicated Worker owns KG10 engine + parsed cache.
2. Tauri source acquisition/watch/persistence remain main-thread.
3. Diagnostics move into W1 worker to avoid parsed-document transfer.
4. Protocol is versioned structured-cloneable plain data.
5. Prepare → persist → commit preserves KG11 transaction semantics.
6. Same-workspace mutations remain sequential; stale-session results are rejected.
7. Worker failure recovery uses full resync with last durably persisted catalog.
8. Projection/inspection remain main-thread.
9. Dagre remains main-thread until KG12B2/W3.

---

# Documentation / roadmap

Likely update:

```text
packages/workspace-worker/README.md
apps/web/README.md
apps/web/src/workers/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/decisions/0011-*.md
```

After W1:

```text
KG12 — In progress
KG12A — Complete
KG12B1 / W1 — Complete
KG12B2 / W3 — Next
```

Do not mark KG12 complete.

Do not begin W3 automatically.

---

# Suggested implementation sequence

1. Inspect/refine exact protocol payloads.
2. Add testable worker runtime package.
3. Add tiny Vite worker entry.
4. Add main-thread worker client.
5. Add async processor abstraction to desktop orchestration.
6. Workerize initial open.
7. Workerize live Markdown updates.
8. Workerize non-Markdown diagnostic report path.
9. Workerize full resync/replacement recovery.
10. Add persistence-success/worker-commit-failure recovery.
11. Preserve startup buffering and source switching.
12. Extend performance evidence for worker internal/round-trip/RAF responsiveness.
13. Run direct-vs-worker correctness matrix.
14. Run medium/selected-large responsiveness measurements.
15. Run production Tauri worker QA.
16. Update ADR/docs/roadmap.
17. PR → CI → merge → post-merge CI → cleanup.
18. Stop before W3.

---

# Validation commands

Use current repo equivalents, approximately:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/workspace-worker typecheck
pnpm exec vitest run packages/workspace-worker

pnpm --filter @icarus-graph-explorer/workspace-engine-obsidian typecheck
pnpm exec vitest run packages/workspace-engine-obsidian

pnpm --filter @icarus-graph-explorer/diagnostics-obsidian typecheck
pnpm exec vitest run packages/diagnostics-obsidian

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium
pnpm benchmark:performance -- --profile large

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
direct-vs-worker correctness matrix
medium W1 responsiveness profile
selected-large W1 responsiveness profile
production Tauri Open Vault/live/rescan worker smoke
source-switch and worker-failure QA
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG12B1 is complete only when:

1. Dedicated Worker owns production desktop KG10 engine state.
2. Parsed documents stay in worker.
3. Diagnostic construction runs in W1 worker.
4. Tauri filesystem/watch/persistence remain main-thread.
5. Worker protocol is versioned and structured-cloneable.
6. Protocol does not expose engine/classes/functions.
7. Parsed-document arrays are not returned to main.
8. Full delta is not transferred without a consumer.
9. initial Open Vault KG10/report work uses worker.
10. live Markdown KG10/report work uses worker.
11. Full Rescan KG10/report work uses worker.
12. non-Markdown report uses committed worker state without KG10 mutation.
13. one pending candidate enforced.
14. expected revision enforced.
15. commit/discard candidate IDs enforced.
16. catalog persistence happens before candidate commit/adoption.
17. persistence failure discards candidate and preserves old graph.
18. worker commit failure after durable persistence has safe replacement-worker recovery.
19. main retains last durable catalog for recovery.
20. initial persistence failure still produces transient one-shot fallback.
21. transient open leaves no live worker/watch session.
22. same-workspace changes remain sequential.
23. stale source-session worker results cannot adopt.
24. Worker termination rejects pending work.
25. `error` and `messageerror` are handled.
26. fatal worker failure leaves last committed graph visible.
27. Rescan can recover with replacement worker.
28. startup watcher buffering remains correct.
29. vault A→B handoff remains safe.
30. Sample/JSON mode does not instantiate W1 worker.
31. W2 projection stays main-thread.
32. W4 inspection/search stays main-thread.
33. W3 Dagre stays main-thread.
34. worker report/catalog equals direct pipeline for deterministic tests.
35. KG10 correctness gates remain green.
36. KG12A instrumentation remains functional.
37. worker internal compute and round-trip are separately measured.
38. medium main-thread responsiveness is measured.
39. selected-large main-thread responsiveness is measured.
40. evidence demonstrates meaningful responsiveness improvement versus direct W1.
41. no flaky CI timing threshold is added.
42. Vite worker chunk builds.
43. Tauri release-like worker runs successfully.
44. no worker CSP/module-load errors.
45. no private paths/source/request IDs enter performance output.
46. external runtime dependencies added: zero.
47. existing KG/UX tests remain green.
48. ADR 0011/docs are reconciled.
49. KG12 remains in progress.
50. W1 is marked complete.
51. W3 is marked next.
52. PR CI passes.
53. post-merge main CI passes.
54. worktree/branch cleanup completes.

Do not begin KG12B2/W3.

---

# Final report

## 1. Summary
What W1 work now runs off the UI thread.

## 2. Architecture

```text
main source provider
→ W1 worker prepare
→ KG10 + diagnostics
→ report/catalog
→ main catalog persistence
→ worker commit
→ UI adoption
```

## 3. Worker protocol
Version, requests/responses, candidate/revision semantics, structured-clone contract.

## 4. Worker ownership
Exactly what lives worker-side vs main-side.

## 5. Transaction behavior
Prepare/persist/commit/discard and failure guarantees.

## 6. Initial open
Worker initialization + stable persistence + transient fallback.

## 7. Live updates
Markdown/non-Markdown/resync/sequencing.

## 8. Failure recovery
Transport failure, persistence failure, commit-after-persistence failure, replacement worker.

## 9. Correctness
Direct-vs-worker report/catalog equality.

## 10. Responsiveness evidence
For medium/selected large:

```text
direct baseline
worker internal compute
worker round-trip
main-thread RAF/high gap
Class A interaction behavior
```

Do not claim CPU work became faster if only thread placement improved.

## 11. Live performance
Updated I16/I18 breakdown through graph paint; keep remaining Dagre cost visible.

## 12. Bundle/build evidence
Worker chunk and meaningful chunk-size changes.

## 13. Dependencies
Expected external runtime additions: zero.

## 14. Tests/validation
All commands, worker QA, Tauri QA, PR/post-merge CI.

## 15. Privacy/security
No upload/write/protocol logging/private artifact commit.

## 16. Files changed
Worker/runtime/orchestration/performance/docs.

## 17. ADR/roadmap

```text
KG12 in progress
W1 complete
W3 next
```

## 18. Deviations/warnings
Structured-clone overhead, worker startup, source-acquisition cost, remaining Dagre jank, recovery edge cases.

## 19. W3 handoff
State what W3 can reuse conceptually:

- Vite worker build path proven;
- worker failure/termination conventions;
- performance correlation infrastructure;
- stale source-session protection.

But explicitly state W3 remains a **separate stateless latest-layout-wins worker**, not part of the W1 stateful worker.

Do not implement W3 automatically.
