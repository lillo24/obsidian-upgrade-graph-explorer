# GRAPH-EXPLORER STARTUP BASELINE + REAL VAULT PROGRESS UI

**Task type:** regression diagnosis + startup UX instrumentation + narrow native handoff

## Goal

Resolve the current uncertainty around vault startup/background behavior **without carrying forward the stale `e492617...` transport patch by assumption**, and add a useful loading/progress surface for vault opening/rescans.

There are two separate goals:

1. **Re-establish the correct startup baseline from current `main`.**
2. **Add truthful progress UI/instrumentation so a long vault open is observable rather than showing only `Opening Vault…` indefinitely.**

Do not combine this with unrelated graph/layout work.

---

# Current evidence

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

At prompt-writing time, current `main` is:

```text
45eb6a69da585b203605db6523c935ccc35858dc
Merge PR #91
```

Re-check latest `main` before editing.

A previous attempted background-startup fix exists at:

```text
branch: codex/background-startup-loading-fix
commit: e4926178ad292e775c5555b06fb672869aff3d94
```

That patch replaced timer-paced workspace-worker transport yields with `MessageChannel` and changed request chunking from 8 to 32.

However, this branch is **not a clean current-main comparison**.

GitHub comparison evidence showed:

```text
e492617...
vs
45eb6a...
```

is diverged:

```text
merge base: 440383234696db1fbc67507d048aff4a70842a60
e492 branch: 16 commits behind 45eb6a main
```

Therefore the broken EXE built from `e492617...` contains:

```text
old baseline
+ PATCH2
+ transport changes
```

rather than:

```text
current main
+ transport changes
```

The user has also provided strong native evidence:

```text
Draft PR #92 executable
→ opens the same vault correctly
→ continues opening correctly while backgrounded
```

PR #92:

```text
SAVED1B
head: 0279f48bf663b4acf5944aef625e7984aebd691a
base: 45eb6a69da585b203605db6523c935ccc35858dc
```

Its feature diff does **not** modify the workspace-worker startup transport path.

Treat this as evidence that the newer baseline may already have correct background behavior and that `e492617...` must not be treated as an established fix.

---

# Critical rule

Do **not** cherry-pick or reproduce the `e492617...` MessageChannel/chunk-size changes unless current-main evidence demonstrates that they are still needed.

The first native candidate produced by this task should be:

```text
latest main
+
progress/instrumentation UI only
```

with startup transport behavior otherwise unchanged.

This gives the user a clean baseline.

If that build succeeds in foreground/background/minimized native testing:

```text
retire the e492 transport patch
```

rather than merging it.

If it still fails:

```text
use the new progress evidence to locate the stalled phase
STOP and report before redesigning transport
```

unless the root cause is small and directly proven.

---

# Branch/worktree

Create a fresh isolated branch/worktree from latest `main`.

Suggested:

```text
codex/vault-open-progress-baseline
```

Before editing:

1. inspect `AGENTS.md`;
2. fetch/update current `main`;
3. inspect open PRs/worktrees;
4. preserve PR #92 and unrelated work;
5. do not modify or delete the old `codex/background-startup-loading-fix` branch;
6. record exact starting SHA.

No merge until user native QA.

---

# Existing UX problem

Current `App.tsx` reduces initial open state to approximately:

```text
vaultOpening = true

→ WorkspaceNotice:
"Opening Vault… The current workspace remains active."
```

The repository's product-quality audit already identified this as a known UX gap:

```text
Opening/Catching up/Resyncing does not expose:
- phase progress
- file counts
- elapsed time
- meaningful progress affordance
```

The UI should no longer leave the user wondering whether the app is:

```text
working
slow
background-throttled
or deadlocked
```

---

# Desired initial product UX

At minimum, while opening a selected vault, show:

```text
Opening vault
Building workspace… 1,203 Markdown files
[ indeterminate progress bar ]
Elapsed 00:18
```

Phase label should change truthfully as startup moves through the pipeline.

Example:

```text
Opening vault
Reading vault files…
[bar]
Elapsed 00:02

Opening vault
Building workspace… 1,203 Markdown files
[bar]
Elapsed 00:08

Opening vault
Saving workspace identity…
[bar]
Elapsed 00:14

Opening vault
Finalizing workspace…
[bar]
Elapsed 00:15
```

Do not fabricate a percentage such as:

```text
67%
```

unless the underlying stage has real numerator/denominator evidence.

An indeterminate bar is acceptable and preferred over fake completion percentages.

---

# Progress semantics

Introduce a small explicit progress contract for **initial vault opening**.

Conceptually:

```ts
type DesktopVaultOpenStage =
  | 'acquiring-source'
  | 'building-workspace'
  | 'persisting-identity'
  | 'committing-workspace'
  | 'recovering-workspace';
```

Exact names may differ.

A progress event/state may contain:

```ts
interface DesktopVaultOpenProgress {
  readonly stage: DesktopVaultOpenStage;
  readonly message: string;
  readonly markdownFileCount?: number;
  readonly nonMarkdownPathCount?: number;
}
```

Do not make UI code parse human-readable strings to infer the stage.

Use a typed contract.

---

# Current pipeline to instrument

Current `openSelectedDesktopVault(...)` approximately does:

```text
discoverSelectedVault(selection)
+
loadOrPrepareWorkspaceIdentity(selection)
    [parallel]

→ prepareInitialize(...)
→ commitWorkspaceIdentity(...)
→ commitCandidate(...)
→ return OpenedDesktopVault
```

It also has a replacement/recovery path after commit failure.

Publish progress at the actual boundaries.

Suggested mapping:

## P1 — acquiring source

Before:

```text
discoverSelectedVault
+
loadOrPrepareWorkspaceIdentity
```

UI:

```text
Reading vault files…
```

Once inventory is available, subsequent events may include:

```text
markdownFileCount
nonMarkdownPathCount
```

## P2 — building workspace

Immediately before:

```text
processor.prepareInitialize(...)
```

UI:

```text
Building workspace… N Markdown files
```

This is likely the largest stage.

## P3 — persisting identity

Immediately before:

```text
commitWorkspaceIdentity(...)
```

UI:

```text
Saving workspace identity…
```

## P4 — committing

Immediately before:

```text
processor.commitCandidate(...)
```

UI:

```text
Finalizing workspace…
```

## P5 — recovery

If commit recovery runs:

```text
Recovering workspace…
```

Do not silently return to an earlier generic message.

---

# API design

Prefer a narrow optional callback rather than React state leaking into desktop-vault code.

Conceptually:

```ts
openSelectedDesktopVault(
  sourceProvider,
  selection,
  identityOptions,
  services,
  onProgress?,
)
```

or a cleaner options object if current API style favors it.

Likewise thread it through:

```text
openLiveDesktopVault(...)
```

so `App.tsx` can receive startup progress.

Avoid breaking existing tests/callers unnecessarily.

If the existing `DesktopVaultServices` dependency-injection object is the natural place for a callback, that is acceptable **only if** it remains semantically clear that progress is an observer rather than a runtime service dependency.

Do not make progress reporting capable of changing startup correctness.

A throwing progress listener must not corrupt startup. Either:

```text
progress callback is trusted internal UI
```

or safely isolate observer failure.

Use repository conventions.

---

# Important: progress must not control scheduling

Do not use:

```text
await progress callback
setTimeout to advance startup
UI acknowledgement before next phase
```

The vault open must proceed independently of whether React paints.

Progress is observation only.

This matters specifically for background/minimized WebView behavior.

---

# Elapsed time

Add elapsed time to the opening status.

Desired format:

```text
Elapsed 00:07
Elapsed 01:42
```

This timer is **presentation-only**.

It may use a lightweight interval while `vaultOpening` is true.

Requirements:

- it does not control startup;
- background throttling of the display timer cannot stall work;
- clear it on success/failure/cancel;
- no leaked interval after source switch/unmount;
- if WebView timers pause while minimized, elapsed time must recalculate from a monotonic start timestamp when it next renders rather than incrementing an internal counter by `+1`.

Preferred pattern:

```text
openingStartedAt = performance.now()
display tick just causes rerender
displayed elapsed = performance.now() - openingStartedAt
```

So missed timer ticks do not make elapsed time incorrect after foreground restoration.

---

# Loading bar

Add an accessible indeterminate progress bar.

Prefer native semantics / ARIA:

```text
role="progressbar"
aria-label="Opening vault"
```

For an indeterminate progress bar:

```text
do not supply aria-valuenow
```

unless there is actual quantitative progress.

Visual requirements:

- compact;
- readable in normal source-status area;
- does not cover graph;
- works in light/current app appearance;
- animation subtle;
- respects `prefers-reduced-motion`;
- no dependency.

The last valid graph should remain visible, matching current behavior.

---

# Phase text and file counts

Use real data only.

Once `VaultSourceInventory` exists, show:

```text
Building workspace… 1,203 Markdown files
```

If count is not yet known:

```text
Reading vault files…
```

Do not display:

```text
0 / 1203
```

unless actual per-file progress exists.

Do not instrument every Markdown parse solely to create a prettier bar in this task.

The first version can be:

```text
real phase
+ real total file count once known
+ indeterminate bar
+ elapsed time
```

That is enough.

---

# Rescan / live-update progress

Reuse the same visual status component for long live operations where practical.

Existing live controller already exposes phases/messages:

```text
catching-up
updating
resyncing
paused
live
```

When:

```text
catching-up
updating
resyncing
```

show the same indeterminate progress affordance.

For ordinary short updates this may appear briefly.

Do not force a fake percentage.

If `lastUpdate.affectedPathCount` is only available after completion, do not present it as in-progress count.

For `paused`:

```text
show warning/error style, not moving progress
```

For `live`:

```text
no progress bar
```

---

# Source switching / cancellation

Current source-generation guards must remain authoritative.

If user:

```text
starts vault A
→ then selects another source
```

old progress events from vault A must not overwrite current UI state.

Bind progress updates to the same request generation used by startup adoption.

On cancel from native folder picker:

```text
clear opening progress cleanly
```

Do not flash a failure.

---

# Error behavior

If vault open fails:

- remove progress bar;
- preserve current graph;
- keep current explicit error;
- keep the **last stage** in development diagnostics if useful.

User-facing error may remain concise.

Do not expose private absolute vault paths unnecessarily.

---

# Diagnostic evidence

Because the previous background diagnosis was inconclusive, also collect lightweight stage timing evidence.

On successful open, current `OpenedDesktopVault.timings` already records:

```text
sourceAcquisitionMs
workspaceInitializationMs
diagnosticConstructionMs
workerComputeMs
workerRoundTripMs
mainThreadHighGapMs
identityPersistenceMs
```

Keep these.

Add no duplicate timing system unless required.

For failed/stalled manual runs, the progress stage itself should reveal the last reached boundary.

A development-only log/evidence record may include:

```text
open generation
stage
elapsed timestamp
```

but do not dump vault contents or note names.

---

# Background-startup baseline investigation

Before modifying transport, inspect:

```text
e4926178...
PR #92 / 0279f48...
current main
```

Document the exact relationship.

Confirm specifically that PR #92 does not modify the W1 startup transport path.

Then keep current-main transport unchanged for the first candidate.

Do not bring in:

```text
MessageChannel scheduler
8 → 32 request batch change
transport protocol changes
```

for the first build.

---

# Candidate A — required

Produce optimized Windows executable from:

```text
latest main
+
progress UI/instrumentation
```

No `e492` transport code.

Name/copy it clearly, e.g.:

```text
current-main-vault-progress-baseline.exe
```

Report SHA-256.

This is the primary native QA artifact.

---

# Candidate B — only if justified

Do **not** automatically build Candidate B.

Only prepare:

```text
latest main
+ progress UI
+ isolated e492 transport changes
```

if one of these occurs:

1. current main automated evidence reveals a real transport defect; or
2. after Candidate A, user native QA reports background/minimize still fails.

If Candidate B is needed, apply only the actual transport delta, not stale branch history/PATCH2/docs.

Then compare A/B on the same current-main baseline.

---

# Native QA requested from user for Candidate A

Codex cannot substitute browser/jsdom testing for this.

Ask the user to test:

1. foreground vault open;
2. immediate Alt-Tab after selecting vault;
3. immediate minimize after selecting vault;
4. background after ~10 seconds;
5. source switch;
6. Rescan;
7. verify phase text advances;
8. verify bar appears during work and disappears at completion;
9. verify elapsed time is plausible;
10. if any case stalls, report the **last visible phase + elapsed time**.

Example useful report:

```text
FAIL: minimize
stuck at "Building workspace… 1,203 Markdown files"
elapsed 02:14
```

That is now actionable.

---

# User-provided native evidence to record

Record in implementation/validation notes:

```text
PR #92 native executable:
same real vault
background opening passed
```

This is user-provided native evidence, not Codex-executed QA.

Do not claim Codex personally reproduced it.

---

# Tests — startup progress contract

Add tests proving ordered stages for successful startup.

Expected order approximately:

```text
acquiring-source
building-workspace
persisting-identity
committing-workspace
```

Do not make tests overfit exact wording.

Assert typed stage transitions.

---

# Tests — file count truthfulness

After inventory acquisition:

```text
building-workspace event
```

must contain the real:

```text
inventory.markdownDocuments.length
```

No guessed count.

---

# Tests — recovery

If candidate commit fails and replacement recovery runs:

```text
recovering-workspace
```

must be emitted.

Final successful state still completes normally.

---

# Tests — progress observer isolation

Progress observation must not change:

```text
report bytes
identity catalog
candidate commit order
timings semantics
runtime revision
```

Compare startup with and without observer.

---

# Tests — stale generation

Old open attempt progress must not overwrite a newer request in `App`.

Use current source-generation mechanism.

---

# Tests — cancel

Folder-picker cancel:

```text
vaultOpening false
progress cleared
current graph unchanged
no error
```

---

# Tests — failure

Failed startup:

```text
progress cleared
error visible
current graph unchanged
```

---

# Tests — elapsed display

Test formatting independently:

```text
0s     → 00:00
7s     → 00:07
67s    → 01:07
```

Avoid fake timers tied to startup correctness.

---

# Tests — live phase progress

UI behavior:

```text
catching-up → progress visible
updating    → progress visible
resyncing   → progress visible
live        → progress absent
paused      → progress absent / warning state
```

---

# Accessibility

Verify:

- progress status is announced appropriately but not spammed every display tick;
- do not put elapsed-time tick inside an assertive live region;
- meaningful phase changes may use polite status semantics;
- progress bar has an accessible label;
- reduced motion disables/reduces bar animation;
- current source controls retain keyboard behavior.

Avoid announcing:

```text
Elapsed 00:01
Elapsed 00:02
Elapsed 00:03
```

to screen readers.

---

# Likely files

Inspect current repo first.

Probable areas:

```text
apps/web/src/App.tsx
apps/web/src/App.css
apps/web/src/desktop-vault.ts
apps/web/src/desktop-live-vault.ts
apps/web/src/desktop-vault.test.ts
apps/web/src/desktop-live-vault.test.ts
apps/web/src/App.test.tsx or relevant integration tests
apps/web/src/components/WorkspaceNotice.tsx
docs/PRODUCT_QUALITY_AUDIT.md
docs/PERFORMANCE.md
apps/web/README.md
history-implementations/
```

Do not force all files to change.

If `WorkspaceNotice` is the right reusable owner for progress presentation, extend it cleanly rather than embedding a large status widget directly in `App.tsx`.

---

# Product-quality audit

The old audit finding that vault open/rescan lacks meaningful progress can be updated after implementation.

Do not mark the **background startup regression** solved solely because the loading bar exists.

Track separately:

```text
progress UX implemented
background native baseline pending user QA
```

---

# Validation

Follow current `AGENTS.md`.

Expected commands, adjusted to current repository:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web
pnpm exec vitest run packages/workspace-worker

pnpm check

pnpm benchmark:workspace-worker -- --profile medium
pnpm benchmark:workspace-worker -- --profile large

pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current benchmark names if different.

The progress observer must not meaningfully regress worker performance.

Do not add a dependency.

---

# Hard exit gates

The task is ready for user QA only when:

1. started from latest `main`;
2. exact baseline SHA recorded;
3. PR #92 native success recorded as user evidence;
4. stale `e492` divergence documented;
5. no `e492` transport changes included in Candidate A;
6. typed startup progress contract exists;
7. acquiring-source stage exists;
8. building-workspace stage exists;
9. real Markdown file count shown once available;
10. identity-persistence stage exists;
11. final commit/finalization stage exists;
12. recovery stage exists;
13. progress observer cannot control startup scheduling;
14. progress callbacks do not mutate domain results;
15. stale request progress is generation-guarded;
16. cancel clears progress;
17. failure clears progress;
18. old workspace remains visible during open;
19. indeterminate progress bar is accessible;
20. no fake percentage;
21. elapsed time shown;
22. elapsed time derives from monotonic start, not accumulated ticks;
23. elapsed display is not screen-reader spam;
24. reduced-motion behavior exists;
25. catching-up/update/resync use progress affordance where appropriate;
26. live state has no loading bar;
27. paused state is not shown as active progress;
28. source switching regressions pass;
29. Rescan regressions pass;
30. worker/report/catalog exactness unchanged;
31. full tests pass;
32. `pnpm check` passes;
33. desktop check/build passes;
34. optimized Candidate A executable produced;
35. executable SHA-256 reported;
36. user native QA instructions include foreground/background/minimize;
37. user is asked to report last visible phase on failure;
38. no Candidate B unless justified;
39. no PR/merge before native acceptance;
40. prompt archived with SHA-256;
41. stop.

---

# Prompt archive

Archive this exact prompt under:

```text
history-implementations/GRAPH_EXPLORER_CURRENT_MAIN_STARTUP_PROGRESS_BASELINE_CODEX_PROMPT.md
```

Record SHA-256.

---

# Final report format

## Branch / commit

## Starting baseline

Exact `main` SHA.

## Stale e492 comparison

State why it is not a valid current-main A/B.

## PR #92 evidence

Record user-reported native background success and confirm its feature diff does not own W1 startup transport.

## Progress UX

List stages and what the user sees.

## Instrumentation contract

Explain observer-only semantics.

## Transport decision

Explicitly state:

```text
Candidate A uses current-main transport unchanged
```

and whether Candidate B was unnecessary or gated.

## Tests

## Benchmarks

## Desktop build

Exact executable path + SHA-256.

## Native QA request

Ask user to test:

```text
foreground
immediate Alt-Tab
immediate minimize
background after ~10s
source switch
Rescan
```

and report the last visible progress phase if anything stalls.

## PR / merge status

No PR/merge until user approval.

Then stop.
