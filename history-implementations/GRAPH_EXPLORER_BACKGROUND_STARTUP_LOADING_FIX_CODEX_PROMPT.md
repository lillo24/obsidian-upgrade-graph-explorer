# Graph Explorer — Fix vault opening that stalls when the desktop app is backgrounded

## Task type
Bug fix / startup transport / desktop reliability / performance-responsiveness debugging.

## Target context

Reproduce first from the branch/executable that exposed the problem:

- Repository: `lillo24/obsidian-upgrade-graph-explorer`
- Branch: `codex/hier4b-patch2-exclude-root-soft-folder-force`
- Commit: `35e891e5c7218a64cd88d1bbd9acb3b3781bb0aa`
- Platform of interest: Windows Tauri desktop `.exe`

Preserve the HIER4B PATCH2 behavior on that branch.

Before editing, inspect current `main` as well. At prompt-writing time, the failing branch was one commit ahead of its merge base and 10 commits behind current `main`, but its unique commit changed only HIER4B/focus-schematic layout code. The startup worker transport described below appeared unchanged relative to `main`. Re-check this rather than assuming the branch-specific HIER4B patch caused the loading failure.

Do not merge/rebase unrelated `main` work merely to make this task easier unless repository state makes that necessary.

---

## Goal / success outcome

Opening a real Obsidian vault from the Windows desktop application must finish even if the user immediately:

- Alt-Tabs to another application;
- minimizes Graph Explorer;
- leaves Graph Explorer unfocused while the initial vault load is still in progress.

The user should not need to keep Graph Explorer visible for ~10 seconds before switching away.

Success means:

1. foreground vault opening still works;
2. immediate background/minimize after selecting the vault still reaches a fully opened workspace without the user returning focus;
3. returning later shows the loaded vault rather than an indefinitely stuck `Opening` state;
4. foreground responsiveness remains acceptable;
5. worker protocol ordering, cancellation, source switching, stable identity, live watching, and rescan behavior remain correct.

Do not “fix” the symptom by removing chunking and reintroducing multi-second main-thread blocking.

---

## Current evidence

### User-observed reproduction

Observed behavior:

1. launch the Tauri `.exe`;
2. choose/open the vault;
3. if Graph Explorer is immediately minimized or another app receives focus, vault opening can appear to stall indefinitely or become extremely slow;
4. if Graph Explorer is kept foregrounded for roughly 10 seconds first, switching away usually becomes harmless and the vault is loaded on return.

The newer executable built from commit `35e891e...` may exhibit the problem strongly enough that it appears not to load at all.

Treat “not working at all” and “extremely slow while backgrounded” as two possibilities to distinguish with instrumentation.

### Branch comparison already observed

The `35e891e...` commit changes only the HIER4B Soft Folder Cluster patch area, including:

- `packages/focus-schematic-layout/src/soft-clusters.ts`
- related focus-schematic tests/fixtures
- HIER4B documentation/prompt archive
- focus-schematic cache-version evidence

It does not intentionally modify vault selection, initial source discovery, Tauri worker transport, `openLiveDesktopVault`, or the desktop runtime.

Current `main` is ahead by unrelated work such as Named Saved Views, AI review, and Argument Workspace. Re-check the exact relevant files, but do not attribute this startup problem to HIER4B without evidence.

### Probable relevant transport path

Inspect at least:

```text
apps/web/src/App.tsx
apps/web/src/desktop-vault.ts
apps/web/src/desktop-live-vault.ts
apps/web/src/workers/workspace-worker-client.ts
apps/web/src/workers/workspace.worker.ts
packages/workspace-worker/src/transport.ts
packages/workspace-worker/src/*
packages/source-provider-tauri/src/*
apps/desktop/src-tauri/*
docs/PERFORMANCE.md
```

At prompt-writing time, the initial workspace request path had this important behavior:

```text
chunkWorkspaceWorkerRequest(...)
→ postMessage(frame)
→ setTimeout(..., 0)
→ postMessage(next frame)
→ setTimeout(..., 0)
→ ...
```

The worker response side similarly sent response frames with a `setTimeout(..., 0)` yield between frames.

The request chunking defaults were especially aggressive:

```text
request chunk size: 8 values
request chunk threshold: 128 values
```

The response side used much larger chunks.

This design was introduced for a valid reason: large structured-clone transactions and worker results should not monopolize the main event loop. Keep that responsiveness goal.

However, ordinary zero-delay timers are a poor primitive for a critical startup transaction if the WebView throttles timers once the window becomes hidden/minimized. Many small timer-separated frames can turn a short startup transfer into a very long one.

This hypothesis fits the user's timing observation particularly well: once enough startup transport/processing has finished in the first ~10 seconds, backgrounding no longer hurts.

Treat this as the **primary hypothesis to prove or disprove**, not as a fact to hard-code around blindly.

---

## Scope

### In scope

- initial vault-open worker request transport;
- initial worker response transport;
- scheduling/yield primitive used between transport batches/frames;
- bounded batching/chunk sizes if measurements show the current `8`-item request chunks amplify the problem;
- visibility/background instrumentation needed to prove the cause;
- release-build Windows/Tauri validation;
- focused tests around ordering, completeness, cancellation, transport errors, and background-safe progress.

### Non-scope

Do not alter unrelated behavior such as:

- HIER4B Soft Folder Cluster semantics;
- graph layout algorithms;
- saved views;
- AI review;
- Argument Workspace;
- graph interaction behavior;
- live-vault semantics beyond what is required to preserve them;
- stable workspace identity rules;
- privacy guarantees;
- report schema.

Do not move the entire workspace engine to Rust or redesign the desktop architecture unless evidence proves that a small transport/scheduling fix cannot work.

Do not add a generic timeout that merely converts a stalled open into an error. Fix the progress mechanism.

---

## Implementation guidance

### 1. Reproduce and locate the exact stall

Build/run the Windows Tauri app from the failing branch/commit.

Use a sufficiently large vault or the real Icarus vault if available locally.

Compare at least:

```text
A. open vault and leave window foregrounded
B. open vault and immediately Alt-Tab
C. open vault and immediately minimize
D. open vault, wait ~10 seconds, then Alt-Tab/minimize
```

Instrument the critical startup path with **aggregate-only** diagnostics.

Useful events include:

```text
vault selection complete
source discovery complete
worker request frame count
worker request frame N sent
worker request assembly complete
worker compute start / finish
worker response frame count
worker response frame N received
response assembly complete
identity persistence start / finish
openLiveDesktopVault resolved
window visibility/focus/minimized transition
```

Do not log vault paths, note titles, note content, workspace identifiers, snippets, or other private vault data.

The key question is:

```text
When the window becomes backgrounded, which awaited stage stops making progress?
```

If frame progression becomes timer-limited while the underlying worker remains healthy, confirm that explicitly.

### 2. Verify branch parity before blaming PATCH2

Compare the failing commit against its merge base and current `main` for the relevant startup files.

If `workspace-worker-client.ts`, `workspace.worker.ts`, `transport.ts`, `desktop-live-vault.ts`, source-provider code, and Tauri config are equivalent, record that finding and treat the HIER4B patch as unrelated.

If a relevant difference exists, investigate it before implementing the generic timer fix.

### 3. Replace timer-dependent transport yielding

If reproduction confirms the timer-yield hypothesis, replace the critical inter-frame:

```ts
await new Promise(resolve => setTimeout(resolve, 0))
```

with a scheduling primitive that:

- yields enough to keep the UI/event loop responsive;
- continues to make progress when the Tauri/WebView window is unfocused or minimized;
- works in the browser window context where request frames are sent;
- works in the Dedicated Worker context where response frames are sent;
- preserves deterministic frame ordering;
- has a safe fallback for unsupported runtimes.

A `MessageChannel`-backed task yield is a likely candidate, but inspect current WebView2/Tauri/runtime support and choose the smallest reliable implementation. `scheduler.yield()` may also be worth evaluating if runtime support is sufficient. Do not choose a primitive only because it is newer; release-runtime reliability matters more.

Prefer a tiny shared scheduling abstraction rather than duplicated ad-hoc logic if it can be shared cleanly across Window and Worker contexts.

Keep protocol framing unchanged unless a protocol change is genuinely needed.

### 4. Re-evaluate the tiny request chunk size

The request-side default chunk size of `8` can create a large number of scheduling boundaries for a normal vault.

Do not arbitrarily increase it, but benchmark a few bounded values after replacing the yield primitive.

The target tradeoff is:

```text
few enough scheduling boundaries to avoid startup overhead/background amplification
+
small enough batches to avoid visible main-thread structured-clone stalls
```

Possible candidates might be 16/32/64, but derive the choice from measurements rather than this prompt.

It is also acceptable to batch several existing frames per host-task turn while leaving the protocol-level chunk size unchanged if that produces cleaner behavior.

Preserve the existing large-payload safety rationale documented in `docs/PERFORMANCE.md`.

### 5. Preserve cancellation and stale-request safety

The existing source generation / source-switch isolation behavior must remain intact.

Check cases where:

- the user cancels directory selection;
- a second source is opened while the first is still processing;
- the controller is stopped;
- the component unmounts;
- the worker errors mid-request;
- a stale request finishes after a newer source request;
- chunk assembly is incomplete/malformed.

A scheduling refactor must not allow stale frames or callbacks to adopt an old vault.

### 6. Keep the worker responsive and protocol-exact

Do not convert the whole request/response into one huge `postMessage` if that recreates the responsiveness problem that chunking was designed to solve.

Keep or strengthen tests proving:

- frame order;
- request/response completeness;
- exact reconstructed payload;
- malformed/out-of-order rejection;
- no duplicate completion;
- termination behavior;
- exact report/catalog equality versus the existing direct path.

### 7. Distinguish timer throttling from full WebView suspension

After fixing timer-separated transport, rerun immediate-background/minimize release QA.

If the transaction still stops even though no timer-yield dependency remains, investigate a second issue: Windows WebView2/Tauri may be suspending/throttling the renderer/worker more broadly.

Only then consider a narrowly scoped lifecycle safeguard.

A temporary Web Lock held only during the critical vault-open transaction is one possible experiment if supported by the actual WebView runtime, but do **not** add it speculatively. Prove that:

1. the transport scheduler fix alone is insufficient;
2. the lock or alternative lifecycle mechanism changes the failing behavior;
3. it is released on success, failure, cancellation, source switch, and app shutdown;
4. it does not create an unnecessary permanent “keep awake” state.

If a Tauri/native mechanism is better supported, prefer the smallest well-supported solution.

### 8. Do not hide remaining latency

The app may still need several seconds to process a large vault. That is acceptable if it continues progressing reliably in the background.

If useful, improve existing aggregate progress/status instrumentation so a genuine long-running open is distinguishable from a stalled transport, but avoid broad UI redesign.

---

## Validation

### Automated

Run the repository-current equivalents of:

```bash
pnpm check
pnpm --dir apps/web build
git diff --check
```

Also run focused worker/transport tests covering at least:

```text
chunked request ordering/completeness
chunked response ordering/completeness
scheduler/yield behavior
termination during a multi-frame request
transport failure during a multi-frame request
latest-source/stale-request isolation
foreground payload equality before/after the change
```

If there is an existing worker responsiveness benchmark, run it before and after.

Record enough aggregate evidence to show that the fix did not simply move the old multi-second main-thread stall back into the foreground path.

### Release Windows/Tauri QA — required

Build the release desktop executable, not only Vite/browser mode.

Validate with a real or realistically large vault:

1. **Foreground control**
   - Open vault.
   - Leave Graph Explorer foregrounded.
   - Confirm normal completion.

2. **Immediate Alt-Tab**
   - Select the vault.
   - As soon as opening starts, switch to another application.
   - Keep Graph Explorer unfocused long enough that the old failure would have appeared.
   - Confirm the vault finishes without refocusing Graph Explorer.
   - Return and verify it is already loaded.

3. **Immediate minimize**
   - Repeat while minimizing the Graph Explorer window.
   - Confirm completion without restoring the window first.

4. **~10 second control**
   - Open, wait ~10 seconds, then background.
   - Confirm no regression.

5. **Repeated open/source switch**
   - Exercise source switching after a completed load.
   - Confirm stale controllers/workers do not leak into the new source.

6. **Live update regression**
   - Edit/save a Markdown file externally after load.
   - Confirm live updates still work.
   - Run Rescan and confirm recovery behavior.

If exact automatic minimization/background control is awkward, keep those as explicit manual release gates rather than faking them in jsdom.

### Evidence to retain

Keep only privacy-safe aggregate evidence such as:

```text
document/entity/reference counts
frame counts
stage durations
visibility/focus state transitions
completion/failure state
worker round-trip timing
main-thread gap measurements
```

Do not commit private vault topology/content/path data.

---

## Decision rule

The preferred final fix should be the smallest change that passes the real Windows release reproduction.

Expected order of preference:

```text
1. background-safe inter-frame scheduler
2. measured batching/chunk tuning
3. only if still necessary: narrowly scoped WebView lifecycle safeguard
```

Do not jump directly to a large architectural rewrite.

---

## Documentation

Update nearby performance/architecture documentation with:

- the observed background-startup failure mode;
- the actual confirmed cause;
- the new scheduling contract;
- why chunking still exists;
- the release-background QA scenario.

If the initial hypothesis proves wrong, document the actual cause instead of preserving this prompt's explanation as fact.

Archive this implementation prompt under `history-implementations/` using the repository's normal naming convention.

---

## Final report

Report:

```text
branch / final commit
whether 35e891e branch startup code differed materially from main
exact reproduced failure and stage where progress stopped
confirmed root cause
files changed
scheduler/batching strategy chosen and why
request/response chunk settings before vs after
automated tests run + results
release Tauri build result
foreground QA result
immediate Alt-Tab QA result
immediate minimize QA result
live-update/rescan regression result
performance/responsiveness evidence
anything skipped
remaining uncertainty or follow-up work
prompt archive path + SHA-256 if repository convention requires it
```

If immediate background/minimize still stalls after the timer-yield fix, stop and report the evidence before introducing a larger lifecycle/native workaround.
