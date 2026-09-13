# POST-SAVED1B1 — Fix native filter white-screen + move Saved View switcher beside Search

**Task type:** post-merge native QA bugfix / regression diagnosis / UI placement correction

## Goal

Fix two issues discovered immediately after SAVED1B was merged.

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current merged SAVED1B:

```text
PR #92
merge commit d8b86b81c2ef41864d19c9d30a6131ae92b9e1e4
```

Create a **new isolated branch/worktree from latest `main`**.

Do not amend/reopen the merged SAVED1B branch.

Do not touch unrelated worktrees, `.pnpm-store/`, AI Review, Argument Workspace, or unrelated local state.

---

# User-observed native QA issues

## Issue A — Saved View quick switch is in the wrong place

The user explicitly wants the Saved View quick switch:

```text
TOP-LEFT
immediately to the LEFT of the Search field
```

The currently merged SAVED1B implementation places the quick-switch/Manage surface in the graph toolbar instead.

This is not the requested product placement.

### Required correction

Move the routine Saved View quick-switch control so the visual order is approximately:

```text
[ Saved View ▼ ] [ Search________________________ ]
```

at the existing top-left Search location.

Important:

- inspect the actual current shell/EntitySearch layout first;
- do not create a second duplicate Saved View switcher;
- preserve access to **Manage Saved Views**;
- Manage may sit adjacent to the dropdown if that is the cleanest design;
- the dropdown itself must be immediately left of Search as requested;
- preserve normal and maximized graph modes;
- preserve 320 px responsive behavior;
- preserve keyboard/focus/accessibility behavior;
- long Saved View names must not push Search off-screen;
- do not move Search to satisfy this if a smaller structural change works;
- do not add a new permanent toolbar row unless current layout genuinely requires it.

The user's requested spatial relationship is the acceptance criterion, not the previous SAVED1B prompt's generic "top-right/toolbar" suggestion.

---

# Issue B — checking Filters → Unresolved blanks the whole `.exe`

Native reproduction reported by the user:

```text
1. launch optimized .exe
2. manually open/select vault
3. open Filters
4. check "Unresolved"
5. entire application content becomes blank/white
```

Then:

```text
right-click native WebView
→ Refresh
→ application UI returns
→ Unresolved filter is already applied
```

The right-click **Refresh** is WebView/Tauri browser chrome behavior, not app UI.

This is a release-blocking bug.

Do not merge this bugfix PR until it is understood and fixed.

---

# Diagnostic implication

The refresh behavior is strong evidence that at least part of the filter mutation/persistence succeeds:

```text
live Unresolved toggle
→ state changes
→ live application/render path fails
→ WebView refresh
→ same persisted/current filter cold-starts successfully
```

Therefore investigate the **live transition** and any render/effect code triggered by that transition.

Do not assume the persisted filter is corrupt.

---

# Important SAVED1B suspicion, but not a conclusion

PR #92 did **not** redesign the reference-status filter itself, but it did substantially change `GraphExplorer.tsx`.

In particular, SAVED1B added derived Saved View matching approximately like:

```text
current graph state changes
→ capture current Saved View snapshot/profile
→ compare with Named Saved Views
→ derive quick-switch label
```

That runs during normal state changes, including filter edits.

A render-time exception from this secondary matching path could white-screen React even though the underlying filter state was successfully persisted.

This is a **hypothesis only**.

Prove the root cause.

Do not patch around SAVED1B merely because it is nearby.

---

# First task: classify the regression

Before editing production behavior, reproduce against two revisions.

## A. Current main

```text
d8b86b81... or newer latest main
```

Reproduce:

```text
All + Network
→ Filters
→ Unresolved ON
```

Also test OFF again if the UI survives.

## B. Pre-SAVED1B baseline

Use a temporary isolated checkout/worktree at the parent/base immediately before PR #92, around:

```text
45eb6a69da585b203605db6523c935ccc35858dc
```

Run the same workflow.

Do not modify the user's primary checkout.

Classify:

```text
only current main fails
→ SAVED1B regression

both fail
→ pre-existing bug discovered during SAVED1B native QA
```

Regardless of classification, fix on latest `main`.

Record the evidence in the implementation report.

---

# Reproduce in browser and native paths

Try to reproduce in the production browser build first because it provides easier error inspection.

Test:

```text
Synthetic Sample
real/safe fixture with unresolved references
opened desktop vault if practical
```

If browser reproduction exists:

- capture the exact uncaught exception / stack;
- identify the first application-owned frame;
- write a failing regression before the fix where practical.

If the bug is native-only:

- use the narrowest Tauri/debug/logging mechanism available;
- a temporary debug build or temporary `window.onerror` / `unhandledrejection` instrumentation is acceptable for diagnosis;
- remove temporary instrumentation before final commit unless the repository genuinely benefits from a production-safe error surface.

Do not leave verbose private-data logging.

Do not log vault file content or private paths unnecessarily.

---

# Inspect these areas

At minimum inspect current versions of:

```text
AGENTS.md

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/components/SavedViewsPopover.tsx
apps/web/src/components/EntitySearch.tsx
apps/web/src/App.css

apps/web/src/saved-view.ts
apps/web/src/global-view.ts
apps/web/src/graph-state.ts
apps/web/src/exploration-model.ts

apps/web/src/persistence/*
apps/web/src/preferences/*
apps/web/src/spatial-overrides/*

packages/view-projection/*
packages/view-state/*
packages/renderer-sigma/*
```

Also inspect SAVED1B's focused/integration tests and the merged implementation report.

Do not force changes in all of these files.

---

# Specific live-transition paths to audit

## 1. Derived Saved View matching

Current SAVED1B matching must be **non-fatal decoration**.

A quick-switch label must never be allowed to crash the graph workspace.

Audit:

```text
matchingSavedViewName(...)
captureSavedView(...)
captureSavedViewProfile(...)
sameSavedViewSnapshot(...)
profile fingerprinting
spatial serialization
```

especially when called during React render / `useMemo`.

Potential transient states to test:

```text
referenceStatuses changes
projection becomes empty
projection changes shape
All ↔ Focus reconciliation
renderer mode and focus state update in adjacent renders
viewport bookmark is temporarily absent
live vault reconciliation
spatial session changes
preferences change
```

### Architectural invariant

If the current graph state is temporarily not capturable as a strict durable Saved View snapshot:

```text
derived quick-switch label
→ "Current View" / no match
```

not:

```text
throw
→ entire React tree disappears
```

Do not weaken persistence validation just to make render-time matching work.

If necessary, split:

```text
strict capture for Save/Update
```

from:

```text
non-throwing best-effort current-state matcher
```

or add a proven safe precondition.

Do not wrap the entire application in a broad catch that hides the real bug.

---

## 2. Global reference-status transition

Audit current Global semantics.

Global has a conservative resolved default when `referenceStatuses` is absent, while an explicit filter may contain:

```text
resolved
unresolved
ambiguous
invalid
```

Test explicit:

```text
['unresolved']
['ambiguous']
['invalid']
['resolved']
['unresolved', 'ambiguous', 'invalid']
```

The graph may legitimately have zero visible nodes/edges.

That must produce the existing empty/recovery presentation, not a blank app.

---

## 3. Projection / renderer empty-state behavior

Verify that toggling Unresolved can safely transition:

```text
non-empty Global projection
→ empty projection
```

and:

```text
empty
→ non-empty
```

without:

- unmounting the whole app;
- WebGL/Sigma stale-node crashes;
- stale partial refreshes;
- stale Saved View matching;
- stale viewport requests;
- stale selection errors.

Use current existing "keep Sigma mounted through zero nodes" architecture if still applicable.

---

## 4. Selection / viewport / history

If the selected node disappears because the new filter excludes it:

```text
selection should clear/reconcile through existing behavior
```

not throw.

Back/Forward and Current View persistence should remain valid.

No forced Fit should occur unless current product semantics require it.

---

# Required regression matrix

Add automated regression coverage at the GraphExplorer/product integration level, not only reducer-level tests.

At minimum:

## All + Network

Starting from a visible graph:

```text
toggle Unresolved ON
→ app remains mounted
→ filter state applied
→ renderer shows valid graph or valid empty state
→ quick switch remains usable
→ no uncaught exception

toggle Unresolved OFF
→ app remains mounted
→ graph recovers
```

Repeat for:

```text
Ambiguous
Invalid
Resolved
```

and at least one multi-status combination.

## Saved View conditions

Repeat the Unresolved transition with:

```text
0 Named Saved Views
1 SAVED1B v2 Saved View that currently matches
1 SAVED1B v2 Saved View that does not match
legacy migrated profile-less v1 Saved View if cheap
```

This determines whether matching/profile code participates.

## Scope/layout

At least verify:

```text
All + Network
Focus + Network
Focus + Hierarchy or All + Hierarchy where applicable
```

The user's bug was native All/Network-like behavior, so All + Network is the hard gate.

---

# Cold-start parity regression

The user's evidence says:

```text
after native Refresh
→ same Unresolved state cold-starts successfully
```

Add a regression that compares:

```text
live toggle to Unresolved
```

with:

```text
mount/hydrate directly with Unresolved already active
```

Both must converge to valid UI.

This is valuable even if root cause is SAVED1B.

---

# Saved View placement tests

Update component/integration tests to assert product placement, not only existence.

The quick switch should be in the same top-left search-control region and precede Search in DOM/visual structure.

Test:

```text
Saved View switcher
→ immediately before Search control in the intended control row/group
```

Also verify:

```text
one switcher only
one Manage control only
normal mode
maximized mode
320px viewport
keyboard access
```

Do not use fragile pixel-perfect assertions if a structural/DOM contract is enough.

Use browser graphical QA for visual confirmation.

---

# Native acceptance checklist

After the fix, build a fresh optimized executable.

User-visible acceptance should be short and explicit.

## Filter regression

```text
1. Open same vault.
2. Filters → Unresolved ON.
3. UI must remain visible.
4. Turn Unresolved OFF.
5. Repeat Ambiguous and Invalid quickly.
6. No blank screen.
```

## Saved View placement

```text
Saved View dropdown is top-left,
immediately left of Search.
```

## Saved View smoke

```text
switch Saved View A → B → A
→ still works
```

No need to repeat the entire SAVED1B matrix unless code changes profile transactions.

If native control remains unavailable to Codex:

- produce the fresh optimized `.exe`;
- report its exact path/hash;
- keep the PR draft until the user reports the checklist result.

---

# Do not scope-creep

Do not implement in this task:

```text
SAVEDUX1 animation
automatic last-vault reopening
PIN1
AUTO1
new filter semantics
new query language
new Saved View schema
new error-reporting platform
```

The "remember last vault and reopen automatically" feature is separate.

The Tauri right-click Refresh menu itself is not the bug.

---

# Performance

The fix must not make every filter change materially heavier.

In particular:

- do not add graph-wide work merely to compute the quick-switch label;
- do not run projection/layout twice;
- do not serialize/revalidate large state repeatedly if a cheaper safe fingerprint exists;
- preserve SAVED1B's exact-reapply and VISUAL1C operation-count guarantees.

If current render-time Saved View matching is the root cause or is unnecessarily expensive, refactor it toward a pure non-throwing memoized fingerprint boundary.

Measure/record operation counts if that path changes.

---

# Failure-surface robustness

Even after fixing the root cause, assess whether this class of render failure currently produces an unexplained white screen.

Do not automatically build a large error-recovery system.

If one small existing-boundary improvement can preserve the shell and show an actionable error without masking defects, it may be proposed/implemented if clearly justified.

The root cause fix is mandatory; an error boundary is not a substitute.

---

# Validation

Follow current `AGENTS.md`.

Expected core validation, adjusted to current repository commands:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web
pnpm exec vitest run packages/view-projection
pnpm exec vitest run packages/view-state
pnpm exec vitest run packages/renderer-sigma

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

Run the focused new regression suite repeatedly during development.

Use the production/minified browser build for final browser QA.

---

# Branch / PR workflow

Create a new task branch/worktree from latest `main`, e.g.:

```text
codex/post-saved1b-native-filter-fix
```

Do not modify merged PR #92.

At completion:

1. archive this prompt under `history-implementations/`;
2. add a concise implementation-status report;
3. open a new PR;
4. include regression classification:
   - introduced by SAVED1B, or
   - pre-existing;
5. include exact root cause and stack/error evidence;
6. include placement correction screenshots/description;
7. include automated/browser validation;
8. leave native acceptance truthful;
9. merge only after required acceptance;
10. verify post-merge CI;
11. clean only this task's branch/worktree.

---

# Exit gate

This task is complete only when:

1. Current `main` reproduction is documented.
2. Pre-SAVED1B baseline comparison is documented.
3. Root cause is identified, not guessed.
4. Filters → Unresolved no longer blanks the app.
5. Unresolved OFF recovers normally without WebView Refresh.
6. Ambiguous toggle is safe.
7. Invalid toggle is safe.
8. Resolved toggle is safe.
9. multi-status combination is safe.
10. live toggle and cold hydration behave consistently.
11. zero-result projection is a valid UI state.
12. quick-switch matching cannot crash the graph workspace.
13. strict Saved View Save/Update validation remains strict.
14. Saved View/profile persistence semantics remain unchanged.
15. Current View persistence remains unchanged.
16. selection disappearance is handled safely.
17. history remains valid.
18. viewport/camera behavior does not regress.
19. Sigma/React Flow do not receive stale fatal updates.
20. Saved View quick switch is top-left.
21. quick switch is immediately left of Search.
22. only one quick switch is rendered.
23. Manage Saved Views remains accessible.
24. normal mode placement passes.
25. maximized mode placement passes.
26. 320px responsive placement passes.
27. keyboard/focus accessibility passes.
28. long names do not break Search layout.
29. no SAVEDUX1 animation is added.
30. no automatic-vault reopening is added.
31. focused tests pass.
32. full `pnpm check` passes.
33. desktop check/build pass.
34. relevant benchmarks pass.
35. production-browser QA passes.
36. fresh optimized native executable is produced.
37. native Unresolved-toggle acceptance passes or remains explicitly gated.
38. prompt/status archived.
39. PR CI passes.
40. post-merge CI passes after acceptance.
41. task worktree/branch cleanup completes.

---

# Final report

Report:

## Root cause
Exact exception/failure mechanism and first relevant stack frame.

## Regression classification
Did it exist at the pre-SAVED1B baseline?

## Fix
What changed and why it is the narrow correct fix.

## Saved View matcher safety
Explain how transient filter/projection states are now safe.

## Filter matrix
Report Unresolved/Ambiguous/Invalid/Resolved/multi-status results.

## Cold vs live transition
Confirm both paths.

## UI placement
Confirm dropdown is immediately left of Search in normal/maximized/narrow modes.

## Performance
Operation counts / any matcher refactor impact.

## Tests
Focused + full suite + browser + desktop.

## Native QA
Exact executable and user acceptance state.

## Files changed
Grouped by purpose.

## Dependencies
Expected: none.

## Remaining separate work

```text
SAVEDUX1 — lightweight Saved View transition animation
automatic last-vault reopen
PIN1
AUTO1
```

Do not start them automatically.
