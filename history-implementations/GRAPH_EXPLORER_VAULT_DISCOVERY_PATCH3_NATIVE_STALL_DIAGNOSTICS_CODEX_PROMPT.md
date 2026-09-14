# GRAPH-EXPLORER VAULT DISCOVERY PATCH3 — Locate the Exact Native Filesystem Stall

**Task type:** native-source diagnosis + bounded watchdog instrumentation + optimized QA artifact

## Goal

The vault still does not open.

PATCH2 has now isolated the failure to one boundary:

```text
workspace identity preparation  → COMPLETE
native source discovery         → PENDING indefinitely
worker                           → NOT STARTED
```

The current code waits forever inside:

```ts
discoverSelectedVault(...)
```

The next task is to determine **which exact native filesystem operation is not completing** and distinguish:

```text
A. one native call is genuinely hanging
B. discovery is making progress but is pathologically slow
C. traversal is running away through an unexpected directory/cycle
```

Do not touch worker transport, layout, Saved Views, or unrelated graph code.

The desired outcome is an optimized Windows executable that can tell us, during the real-vault test:

```text
directories scanned
entries examined
Markdown files read
current native operation
current workspace-relative path
time spent in the current operation
```

and that converts a truly hung individual native filesystem operation into a **clear bounded diagnostic failure** instead of waiting forever.

Do not create a PR or merge before the user's native result.

---

# Starting point

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue from the current PATCH2 branch:

```text
branch: codex/vault-open-progress-render-fix
commit: 2bf373ffddbae44f69f3cf766d2fc8a228fa3e91
```

Create a focused child branch/worktree, suggested:

```text
codex/vault-discovery-stall-diagnostics
```

Before editing:

1. inspect `AGENTS.md`;
2. fetch current refs;
3. verify `2bf373f...` is the parent;
4. preserve all unrelated worktrees/branches;
5. do not modify/delete the older startup experiments;
6. record the exact parent SHA.

---

# Proven facts

## 1. The stall is pre-worker

PATCH2 reports:

```text
identity preparation: complete
native source discovery: pending
```

`openSelectedDesktopVault(...)` cannot proceed to:

```text
building-workspace
prepareInitialize
W1 worker transport
identity persistence
candidate commit
```

until `discoverSelectedVault(...)` resolves.

Therefore W1 / MessageChannel / chunking are not relevant to this failure.

## 2. The UI thread remains alive

During the stall the elapsed timer continues updating, so this does not look like a synchronous JS CPU freeze. The app is alive and awaiting asynchronous work.

## 3. Current discovery is serial

Current:

```text
packages/source-provider-tauri/src/discovery.ts
```

recursively traverses directories and awaits native bridge operations serially.

Relevant awaits include:

```text
inspectPath(...)      // lstat
readDirectory(...)    // readDir
joinPath(...)
readFileBytes(...)    // readFile for Markdown
```

Each Markdown file is read before traversal continues.

## 4. Working and failing builds share the same discovery implementation

The earlier user-tested PR #92 executable successfully opened the same vault, including in the background.

The relevant `discovery.ts` implementation is unchanged between that runtime baseline and the current PATCH2 line.

Therefore do not claim:

```text
"discovery.ts changed and broke"
```

Possible explanations still include:

```text
native/plugin call hangs nondeterministically
filesystem/cloud-placeholder state
unexpected directory/reparse-point behavior
timing-sensitive native issue
very slow serial traversal
```

The next build must provide evidence.

---

# A. Add a source-discovery progress contract

Do this in the source-provider layer, not as ad-hoc React strings.

Conceptually:

```ts
type VaultDiscoveryNativeOperation =
  | 'inspect-root'
  | 'read-directory'
  | 'join-path'
  | 'read-markdown';

interface VaultDiscoveryProgress {
  readonly directoriesRead: number;
  readonly entriesExamined: number;
  readonly markdownFilesRead: number;
  readonly nonMarkdownFilesSeen: number;
  readonly bytesRead?: number;

  readonly currentOperation?: VaultDiscoveryNativeOperation;
  readonly currentWorkspacePath?: WorkspacePath;
  readonly currentOperationStartedAt?: number;
}
```

Exact naming may differ.

Do not expose absolute native paths through the product progress contract.

Use workspace-relative paths for diagnostics. The root can be represented by `.` or an explicit root marker.

---

# B. Instrument every awaited native operation in discovery

At minimum instrument:

```text
inspectPath
readDirectory
joinPath
readFileBytes
```

For each operation:

```text
1. record operation type
2. record workspace-relative target
3. record monotonic start
4. await native call
5. record completion duration
6. update counters
```

Do not alter traversal semantics.

---

# C. Avoid progress-induced rendering regressions

Do NOT send one App/GraphExplorer state update for every file.

Use either:

```text
source-provider detailed progress
→ isolated progress store/subscriber
→ only WorkspaceNotice rerenders
```

or a bounded/coalesced observer.

Hard requirement:

```text
thousands of filesystem operations
must not rerender GraphExplorer thousands of times
```

Preserve PATCH2 render isolation.

---

# D. Ordinary progress UI

During discovery, show useful aggregate information such as:

```text
Reading vault files…
Directories 83 · Entries 1,426 · Markdown 612
```

Optionally:

```text
Current: reading Markdown file
```

Do not show a constantly changing full path in normal polished UI if noisy.

The full workspace-relative path may appear in technical/slow-operation detail.

No absolute path.

---

# E. Slow-operation diagnostic

When a single native filesystem operation takes unusually long, expose it explicitly.

Example:

```text
Still waiting for a Markdown file read…
Current item: Notes/Example.md
```

or:

```text
Still waiting for a directory read…
Current item: Attachments
```

Suggested warning threshold:

```text
2–5 seconds
```

Keep it configurable/testable.

This warning is not the hard timeout.

---

# F. Hard watchdog for one native operation

Add a generous per-operation watchdog so one native bridge Promise cannot keep vault opening pending forever.

Preferred helper shape:

```ts
awaitNativeDiscoveryOperation({
  kind,
  workspacePath,
  timeoutMs,
  task: () => bridge.readFileBytes(...)
})
```

Use the same helper for all instrumented native operations where reasonable.

Suggested hard timeout:

```text
30–60 seconds per single native operation
```

Keep it injectable in tests.

Do not use an aggressive timeout that breaks legitimately slow storage unnecessarily.

---

# G. Timeout semantics

JavaScript cannot necessarily cancel an already-issued Tauri filesystem Promise.

Therefore, on watchdog expiry:

```text
race rejects active discovery attempt
→ current workspace remains loaded
→ opening state exits
→ clear diagnostic identifies operation + workspace-relative path
```

Do not pretend the underlying native request was canceled.

Late completion from the abandoned Promise must not:

```text
adopt a workspace
change current progress
overwrite a newer source request
```

Existing generation guards remain authoritative.

---

# H. Diagnostic error

Example:

```text
Vault discovery stalled for 60 s while reading Markdown:
Notes/Example.md
```

or:

```text
Vault discovery stalled for 60 s while reading directory:
Attachments
```

Keep:

```text
The current workspace remains loaded.
```

Do not persist/commit the private path.

Do not show an absolute path.

---

# I. Distinguish hard hang from slow progress

The instrumentation must let us tell:

## Case A — hard hang

```text
Directories: 83
Entries: 1,426
Markdown: 612

current operation:
read-markdown Notes/Foo.md

same values for 60 s
→ watchdog fires
```

## Case B — serial performance problem

```text
Markdown:
612
630
649
668
...
```

Counts keep increasing and no single call times out.

If Case B occurs, do not redesign traversal here. Record throughput and stop for a follow-up comparison of serial traversal vs bounded concurrency/native batch discovery.

---

# J. Detect obvious runaway traversal

Track:

```text
current recursion depth
maximum recursion depth
directories read
entries examined
```

Do not impose an arbitrary shallow depth limit by default.

Do not silently skip directories.

If evidence shows a pathological depth/runaway traversal, report it.

---

# K. Symlink / junction / reparse-point investigation

Current code skips `entry.isSymlink`.

On Windows, inspect whether Tauri/plugin-fs behavior for junctions/reparse points is reliably represented by `isSymlink`.

Do not redesign based on speculation.

Required:

1. inspect current API/plugin behavior and tests;
2. preserve current symlink skipping;
3. add a synthetic regression for recursive symlink entries;
4. if junctions remain an uncertainty, document that as a remaining native risk.

Do not add expensive `lstat` for every directory unless evidence justifies it.

---

# L. Preserve discovery semantics

Do not change these rules merely for diagnosis:

```text
skip hidden entries
skip node_modules directories
skip explicit excludes
skip symlinks
read Markdown as fatal UTF-8
collect non-Markdown paths
sort deterministically
```

Healthy discovery output must remain exact.

---

# M. Tests — watchdog

Use controlled unresolved Promises.

## M1 — hung root inspect

`inspectPath` never resolves.

Expected diagnostic identifies:

```text
inspect-root
root marker
```

## M2 — hung directory read

`readDirectory` never resolves.

Expected relative directory path.

## M3 — hung joinPath

If `joinPath` remains awaited, timeout identifies it.

## M4 — hung Markdown read

`readFileBytes` never resolves.

Expected relative Markdown path.

## M5 — late resolution

Resolve original native Promise after timeout.

Assert:

```text
no inventory adoption
no stale progress adoption
no unhandled rejection
```

---

# N. Tests — exact healthy output

With no hung operations:

```text
instrumented discovery output
=
pre-instrumentation discovery output
```

for:

```text
Markdown documents
sources
non-Markdown paths
sorting
excludes
symlink skipping
```

---

# O. Tests — counters

Synthetic tree:

```text
root
├─ A/
│  ├─ one.md
│  └─ two.png
└─ three.md
```

Assert deterministic final counters.

Do not overfit every intermediate callback if coalescing is implementation-specific.

---

# P. No-observer compatibility

Calling `discoverSelectedVault(...)` without a progress observer must remain supported.

No UI dependency may leak into `source-provider-tauri`.

---

# Q. Observer failure

If the repository's progress observers are fail-isolated, a throwing discovery progress listener must not alter healthy discovery output.

Use existing observer policy consistently.

---

# R. App integration

Thread discovery progress through:

```text
TauriSourceProvider
→ desktop-vault
→ isolated progress presentation
```

Preserve PATCH2's distinction:

```text
identity complete
source discovery pending
```

The notice should become more informative without changing startup correctness.

---

# S. No fake percentage

We still do not know the total number of files before traversal.

Use:

```text
completed counts + indeterminate bar
```

Do not invent a percentage.

---

# T. Optional current-operation elapsed

The notice already has total vault-open elapsed.

For a slow current operation, also expose:

```text
Waiting on current operation: 12 s
```

if cleanly possible using the already-isolated notice clock.

Do not add another App-level interval.

---

# U. Compare working PR #92 again

Before finalizing the diagnostic candidate, compare relevant discovery and Tauri bridge files between:

```text
working PR #92 head
current PATCH3 parent
```

State whether they differ.

If they are identical, say so explicitly.

---

# V. Native executable

Build a fresh optimized Windows executable.

Suggested copy name:

```text
vault-discovery-stall-diagnostic.exe
```

Report SHA-256.

No PR.

---

# W. Native QA request

Ask the user to open the same vault.

Useful result formats:

### Result 1

```text
COMPLETED
Directories: ...
Entries: ...
Markdown: ...
```

### Result 2

```text
TIMEOUT
operation: read-markdown
path: <workspace-relative path>
```

### Result 3

```text
TIMEOUT
operation: read-directory
path: <workspace-relative path>
```

### Result 4

```text
NO SINGLE TIMEOUT
counts continue increasing very slowly
```

If a timeout occurs, ask for:

```text
operation type
workspace-relative path
directories
entries
Markdown files read
```

---

# X. Decision gate

## If one native operation times out

STOP.

Do not silently skip the file/directory.

Report exact operation/path and investigate that boundary next.

## If counts continuously increase but opening takes minutes

STOP and report throughput.

Next task should compare:

```text
serial JS↔Tauri traversal
bounded concurrency
one native batch discovery command
```

Do not implement that redesign here.

## If PATCH3 unexpectedly fixes the issue

Record it but do not assume instrumentation was causal.

Repeat foreground/background tests before drawing conclusions.

---

# Likely files

Inspect repo first. Probable areas:

```text
packages/source-provider-tauri/src/types.ts
packages/source-provider-tauri/src/discovery.ts
packages/source-provider-tauri/src/provider.ts
packages/source-provider-tauri/src/index.ts
packages/source-provider-tauri/src/index.test.ts
packages/source-provider-tauri/src/reconciliation.ts   // only if shared API needs it

apps/web/src/desktop-vault.ts
apps/web/src/vault-open-progress.ts
apps/web/src/components/WorkspaceNotice.tsx
apps/web/src/App.tsx
focused tests

docs/PERFORMANCE.md
docs/PRODUCT_QUALITY_AUDIT.md
packages/source-provider-tauri/README.md
history-implementations/
```

Do not force every file to change.

---

# Performance constraint

Instrumentation must not turn healthy discovery into thousands of React updates.

Measure a synthetic large tree before/after if an existing harness makes this easy.

No new dependency.

---

# Privacy

Use synthetic fixtures only.

Do not commit:

```text
real vault paths
real note names
real source content
private-vault screenshots
```

The user may report a relative path in chat for debugging; do not add it to committed evidence without permission.

---

# Validation

Follow `AGENTS.md`.

Expected repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/source-provider-tauri
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No worker-transport benchmark is required because worker transport must remain untouched.

---

# Hard exit gates

1. starts from `2bf373f...` or documented equivalent;
2. inner discovery progress contract exists;
3. directories-read count exists;
4. entries-examined count exists;
5. Markdown-read count exists;
6. non-Markdown count exists;
7. current native operation kind is known;
8. current workspace-relative target is known;
9. absolute private path is not required in UI;
10. per-operation monotonic timing exists;
11. progress is isolated/coalesced away from GraphExplorer;
12. no per-file App-wide rerender storm;
13. slow-operation warning exists;
14. generous hard per-operation watchdog exists;
15. watchdog timeout is injectable/testable;
16. root-inspect hang test passes;
17. directory-read hang test passes;
18. Markdown-read hang test passes;
19. join-path hang is handled/tested if applicable;
20. late native resolution after timeout cannot adopt state;
21. healthy discovery output remains exact;
22. excludes unchanged;
23. symlink behavior unchanged;
24. UTF-8 policy unchanged;
25. deterministic sorting unchanged;
26. no fake percentage;
27. PATCH2 identity/source distinction preserved;
28. current-operation diagnostics integrate with loading notice;
29. W1 transport untouched;
30. MessageChannel experiment untouched;
31. request chunk size untouched;
32. no discovery-concurrency redesign yet;
33. no silent file/folder skipping;
34. full focused tests pass;
35. `pnpm check` passes;
36. desktop check/build passes;
37. optimized diagnostic EXE produced;
38. EXE SHA-256 reported;
39. prompt archived with SHA-256;
40. no private vault content committed;
41. no PR/merge;
42. user asked for operation/path/counters if timeout occurs;
43. stop.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/GRAPH_EXPLORER_VAULT_DISCOVERY_PATCH3_NATIVE_STALL_DIAGNOSTICS_CODEX_PROMPT.md
```

Record SHA-256.

---

# Final report format

## Branch / commit

## Parent SHA

## Proven stall boundary

## Discovery instrumentation

Counters and operation types added.

## Watchdog

Warning threshold, hard timeout, and semantics.

## Healthy-output oracle

Confirm discovery results unchanged.

## Render isolation

Explain how detailed progress avoids graph rerender storms.

## Working PR #92 comparison

State whether discovery/bridge code differs.

## Tests

## Desktop build

Exact EXE path + SHA-256.

## Native QA request

Ask for:

```text
operation type
workspace-relative path
directories
entries
Markdown files read
```

if it times out.

## PR / merge

No PR/merge yet.

Then stop.
