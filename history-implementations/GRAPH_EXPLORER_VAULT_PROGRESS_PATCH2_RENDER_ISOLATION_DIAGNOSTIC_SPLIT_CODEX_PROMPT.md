# GRAPH-EXPLORER VAULT PROGRESS PATCH2 — Isolate Elapsed Rendering + Split Source/Identity Diagnostics

**Task type:** focused regression fix + startup instrumentation refinement + native QA handoff

## Goal

Fix the regression introduced by the new vault-opening progress UI while preserving the useful loading/progress UX.

Current regressed candidate:

```text
branch: codex/vault-open-progress-baseline
commit: 95b6596a1fc62be21cd2e4392cf883a015ffc329
```

The same real vault opened correctly, including while backgrounded, in the user's PR #92 executable.

This patch should:

1. remove the once-per-second top-level `App` rerender caused by elapsed-time updates;
2. keep elapsed time and the indeterminate loading bar;
3. split the current ambiguous `Reading vault files…` stage so we can distinguish native vault discovery from workspace identity preparation;
4. keep current startup transport completely unchanged;
5. build a fresh optimized Windows executable for native testing;
6. stop before PR/merge.

---

# Repository / baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Start from:

```text
95b6596a1fc62be21cd2e4392cf883a015ffc329
```

Prefer a new isolated child branch/worktree, e.g.:

```text
codex/vault-open-progress-render-fix
```

Do not modify/delete:

```text
codex/vault-open-progress-baseline
codex/background-startup-loading-fix
PR #92 branch/worktree
```

Before editing:

1. inspect `AGENTS.md`;
2. fetch current refs;
3. confirm `95b6596...` is the exact parent;
4. inspect unrelated worktrees/PRs;
5. preserve all unrelated user state.

No PR/merge until user native QA.

---

# Strong current evidence

Working PR #92 executable:

```text
PR #92 head:
0279f48bf663b4acf5944aef625e7984aebd691a
```

Progress Candidate A baseline:

```text
d8b86b81c2ef41864d19c9d30a6131ae92b9e1e4
```

Repository comparison shows:

```text
0279f48... → d8b86b...
```

contains only documentation/status changes in:

```text
history-implementations/SAVED1B_implementation_status.md
```

No runtime application code changed.

So for startup/runtime purposes:

```text
PR #92 working runtime baseline
≈
Candidate A pre-progress runtime baseline
```

The regression appeared only after:

```text
95b6596...
feat(web): show truthful vault startup progress
```

Treat the progress patch itself as the primary suspect, but do not claim exact causality before native confirmation.

---

# Critical diagnostic fact from the screenshot

The app stalls at:

```text
Reading vault files…
```

That stage is emitted before this completes:

```ts
await Promise.all([
  sourceProvider.discoverSelectedVault(selection),
  sourceProvider.loadOrPrepareWorkspaceIdentity(selection, identityOptions),
])
```

Therefore the stall is **before**:

```text
prepareInitialize(...)
workspace worker computation
worker transport
identity persistence
candidate commit
```

Hard non-scope:

```text
workspace-worker transport
request chunk size
MessageChannel scheduler
W1 framing/protocol
```

Do not touch those in this patch.

---

# Primary regression hypothesis

The progress patch added a top-level timer pattern equivalent to:

```ts
setInterval(
  () => setVaultOpeningClock(performance.now()),
  1000,
)
```

while the old graph remains mounted.

That means:

```text
every second
→ App rerenders
→ large existing graph subtree may rerender/reconcile
```

For a large workspace this may create severe main-thread pressure.

This hypothesis must be structurally eliminated.

---

# A. Move elapsed ticking out of App

Remove top-level continuously changing elapsed-clock state.

`App` may own only a stable:

```ts
vaultOpeningStartedAt
```

that changes on open start/end.

Pass it to the notice.

Preferred structure:

```text
App
├─ startup stage state          changes only on meaningful phase transitions
└─ GraphExplorer               unaffected by elapsed ticks

WorkspaceNotice
└─ local 1-second clock        only tiny notice subtree rerenders
```

Inside `WorkspaceNotice` or a tiny child:

```text
local timer
displayed elapsed = performance.now() - startedAt
```

Requirements:

- monotonic time;
- clear interval on unmount/end;
- missed background ticks do not undercount;
- no screen-reader announcement every second;
- elapsed still visually updates.

---

# A2. Preserve the loading bar

Keep:

```text
Opening vault
phase text
indeterminate progress bar
Elapsed MM:SS
```

Preserve accessibility:

```text
role="progressbar"
no fake aria-valuenow
prefers-reduced-motion
```

No dependency.

---

# A3. Render-isolation regression test

Hard gate.

Mock `GraphExplorer` with a render counter.

Test:

```text
1. mount App
2. start vault open
3. settle into one startup phase
4. advance fake timers several seconds
5. elapsed text changes
6. GraphExplorer render count does NOT increase because of timer ticks
```

Meaningful stage transitions may rerender App; elapsed ticks alone must not.

Do not satisfy this by freezing elapsed.

---

# B. Split ambiguous source acquisition

Current stage:

```text
acquiring-source
→ "Reading vault files…"
```

actually covers two parallel operations:

```ts
discoverSelectedVault(selection)
loadOrPrepareWorkspaceIdentity(selection, identityOptions)
```

Keep them parallel.

Do not serialize them.

Add typed acquisition sub-status, conceptually:

```ts
interface DesktopVaultOpenAcquisitionProgress {
  readonly sourceDiscovery: 'pending' | 'complete'
  readonly identityPreparation: 'pending' | 'complete'
  readonly markdownFileCount?: number
  readonly nonMarkdownPathCount?: number
}
```

Thread this through `DesktopVaultOpenProgress` or an equivalent clean type.

Do not parse strings to infer state.

---

# B2. Publish completion of each parallel operation

Initial:

```text
sourceDiscovery: pending
identityPreparation: pending
```

If source discovery finishes first:

```text
sourceDiscovery: complete
identityPreparation: pending
markdownFileCount: REAL COUNT
```

If identity preparation finishes first:

```text
sourceDiscovery: pending
identityPreparation: complete
```

When both finish:

```text
building-workspace
```

Progress callbacks remain synchronous, non-awaited observers.

---

# B3. User-facing messages

Recommended mapping:

Both pending:

```text
Preparing vault source…
```

Source done, identity pending:

```text
Loading workspace identity…
```

Identity done, source pending:

```text
Reading vault files…
```

Both done:

```text
Building workspace… 1,203 Markdown files
```

Keep the UI compact.

The typed state must preserve both statuses even if the UI shows one concise line.

---

# B4. Aggregate diagnostics

Record only aggregate completion order/timing, for example:

```text
source discovery completed first
identity preparation completed 142 ms later
```

Do not log private file paths, note names, Markdown content, or full vault inventories.

---

# C. Start elapsed timing after folder selection

Inspect current flow.

If elapsed time starts before:

```ts
selectVaultDirectory()
```

then user time in the native picker is incorrectly counted.

Prefer:

```text
folder picker pending
→ duplicate-open guard active
→ no vault elapsed clock yet

selection returned
→ begin actual vault-opening elapsed timer
```

If necessary separate:

```ts
vaultSelectionPending
vaultOpening
```

Preserve protection against duplicate folder pickers/open requests.

For reset-local-identity, start timing immediately before actual open work.

This is secondary; keep it narrow.

---

# D. Preserve request-generation guards

Old/superseded progress callbacks must not update current UI.

Test late completion from an old request for both:

```text
source discovery
identity preparation
```

Use existing generation semantics.

---

# E. Transport hard isolation

Do not modify:

```text
apps/web/src/workers/workspace-worker-client.ts
apps/web/src/workers/workspace.worker.ts
packages/workspace-worker transport framing
request chunk size
response chunk size
MessageChannel/timer scheduling
```

This failure is currently pre-worker.

---

# F. Compare exact runtime delta

Before editing, document:

```text
0279f48... working PR92 head
d8b86b... Candidate A baseline
95b6596... regressed progress candidate
```

Confirm:

```text
0279f48 → d8b86b
= no runtime startup-code changes
```

Then classify runtime changes from:

```text
d8b86b → 95b6596
```

into:

```text
observer-only instrumentation
React rendering
CSS-only
startup API instrumentation
```

Final report should state what PATCH2 changed.

---

# G. Required acquisition tests

## G1 — source finishes first

Use controlled promises.

Assert:

```text
sourceDiscovery = complete
identityPreparation = pending
real Markdown count available
```

Then resolve identity and assert transition to `building-workspace`.

## G2 — identity finishes first

Assert:

```text
identityPreparation = complete
sourceDiscovery = pending
```

Then resolve source and assert `building-workspace` with real count.

## G3 — concurrency

Prove both operations started before either resolves.

## G4 — source failure

Open fails safely, progress clears, current workspace remains.

## G5 — identity failure

Same safe behavior; recovery metadata remains correct where applicable.

---

# H. Required timer tests

## H1 — no graph rerender

Elapsed ticks must not increment mocked `GraphExplorer` render count.

## H2 — formatting

```text
0s  → 00:00
7s  → 00:07
67s → 01:07
```

## H3 — missed ticks

Simulate:

```text
start t=0
no timer delivery for 60s
next tick t=60s
```

Expected:

```text
01:00
```

not `00:01`.

## H4 — cleanup

No timer remains after:

```text
success
failure
cancel
unmount
source switch
```

---

# I. Preserve existing progress behavior

Do not regress:

```text
Building workspace + real Markdown count
Saving workspace identity
Finalizing workspace
Recovering workspace
catching-up progress bar
updating progress bar
resyncing progress bar
no progress in Live
no active progress in Paused
last committed graph remains visible
no fake percentage
reduced-motion behavior
```

---

# J. Native candidate

Build a fresh optimized Windows executable.

Suggested copy name:

```text
vault-progress-render-isolation-candidate.exe
```

Report SHA-256.

No PR yet.

---

# K. Native QA handoff

Ask user to test the same real vault.

First:

```text
foreground open
```

If it stalls, report exact last visible message, now distinguishing:

```text
Preparing vault source…
Loading workspace identity…
Reading vault files…
Building workspace… N Markdown files
```

Then test:

```text
immediate Alt-Tab
immediate minimize
background after ~10s
source switch
Rescan
```

Also ask whether:

```text
elapsed time stays plausible
notice remains responsive
old graph stays visible/usable
```

---

# L. Decision after QA

If PATCH2 works:

```text
progress UI architecture was the regression
```

with the top-level timer-driven rerender as the leading cause.

Document as user-native evidence; do not overstate causality beyond evidence.

If PATCH2 still stalls before `building-workspace`:

Use the new typed acquisition status to identify exactly:

```text
source discovery pending
or
identity preparation pending
```

STOP there.

Do not start modifying worker transport.

If it reaches `building-workspace` and then stalls, report that separately.

---

# Likely files

Inspect current code first. Likely:

```text
apps/web/src/App.tsx
apps/web/src/App.vault-progress.test.tsx
apps/web/src/components/WorkspaceNotice.tsx
apps/web/src/App.css
apps/web/src/desktop-vault.ts
apps/web/src/desktop-vault.test.ts
apps/web/src/vault-open-progress.ts
apps/web/src/vault-open-progress.test.tsx
docs/PERFORMANCE.md
docs/PRODUCT_QUALITY_AUDIT.md
history-implementations/
```

Do not edit unrelated graph code.

---

# Validation

Follow current `AGENTS.md`.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No worker benchmark rerun is required unless worker code changes, which this patch should avoid.

No new dependency.

---

# Hard exit gates

1. starts from `95b6596...` or documented equivalent;
2. PR #92 runtime-equivalence evidence recorded;
3. screenshot stall classified as pre-worker;
4. top-level once-per-second App clock removed;
5. App/GraphExplorer no longer rerender from elapsed ticks;
6. elapsed still updates;
7. elapsed owned by small notice subtree;
8. monotonic-time-derived elapsed;
9. missed ticks do not undercount;
10. timer cleanup passes;
11. progress bar remains;
12. reduced-motion remains;
13. acquisition operations remain concurrent;
14. source-discovery completion separately observable;
15. identity-preparation completion separately observable;
16. both completion orders tested;
17. real Markdown count only after source discovery;
18. `building-workspace` only after both are ready;
19. stale progress generation guard remains;
20. cancel behavior remains correct;
21. failure preserves current workspace;
22. recovery semantics unchanged;
23. W1 transport files untouched;
24. request chunk size untouched;
25. MessageChannel experiment untouched;
26. GraphExplorer timer-isolation regression test passes;
27. full web tests pass;
28. `pnpm check` passes;
29. desktop check/build passes;
30. optimized candidate produced;
31. EXE SHA-256 reported;
32. no private vault content committed;
33. prompt archived + SHA-256;
34. no PR/merge;
35. user native QA requested;
36. stop.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/GRAPH_EXPLORER_VAULT_PROGRESS_PATCH2_RENDER_ISOLATION_DIAGNOSTIC_SPLIT_CODEX_PROMPT.md
```

Record SHA-256.

---

# Final report

## Branch / commit

## Parent commit

Must identify `95b6596...` or explain equivalent.

## Regression diagnosis

Separate proven facts from hypothesis.

## Render isolation

Explain where elapsed ticking now lives and show render-count evidence.

## Source acquisition diagnostics

Show typed sub-status contract and both completion-order tests.

## Startup transport

Confirm unchanged.

## Tests

## Desktop build

Exact EXE path + SHA-256.

## Native QA request

Ask user to report exact last visible phase if it stalls.

## PR / merge

No PR/merge yet.

Then stop.
