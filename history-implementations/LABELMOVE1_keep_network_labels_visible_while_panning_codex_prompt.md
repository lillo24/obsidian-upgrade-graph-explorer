# LABELMOVE1 — Keep Network Labels Visible While Panning

**Task type:** small renderer behavior fix / low-risk QA

## Goal

In both All Network and Focus Network, labels currently disappear whenever the camera moves, even when the user is only panning at a constant zoom.

Current Sigma settings on `main` include:

```ts
hideLabelsOnMove: true
```

in both:

```text
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/local-session.ts
```

This is independent from the existing label threshold:

```ts
labelRenderedSizeThreshold
```

Desired behavior:

```text
PAN at same zoom
→ keep currently eligible labels visible

ZOOM
→ continue using the existing label threshold / density rules
→ labels may appear or disappear as zoom changes
```

Do not redesign labels, LOD, or physics.

---

## Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Current `main` at plan-writing time:

```text
2b7872951fe6f739dce76396e949ff9a82acae29
```

Open concurrent PR at plan-writing time:

```text
#88 — Argument Workspace compiler core
```

Use an isolated task branch/worktree and preserve PR #88 and unrelated work.

Re-check latest `main` before implementation/merge.

---

## Implementation

First confirm the current behavior from source and a small browser smoke.

Then change the Network Sigma configuration so camera movement does not globally suppress labels.

Expected primary change:

```ts
hideLabelsOnMove: false
```

for both Global and Local Sigma sessions.

Keep unchanged:

```text
labelRenderedSizeThreshold
labelDensity
labelGridCellSize
Global/Local LOD rules
node/edge layout
camera behavior
Fit / Density
physics / Move
```

Do not introduce a custom pan-only label system unless the simple Sigma setting proves insufficient.

---

## Performance check

The setting exists for performance reasons, so verify instead of assuming.

Test at least:

```text
Synthetic Sample / small graph
medium existing renderer fixture
largest safe existing Network benchmark or browser fixture
```

Check:

```text
pan remains responsive
labels stay visible during pan
zoom still changes label eligibility according to existing threshold
no console warnings/errors
```

If keeping labels visible causes a serious, reproducible performance regression only at very large scales, do not revert globally immediately.

Instead report the evidence and, only if clearly justified, use a simple size-based policy such as:

```text
ordinary graphs → labels stay visible while moving
very large graphs → hideLabelsOnMove may remain enabled
```

Do not invent a threshold without evidence.

---

## Tests

Add focused regressions proving:

```text
Global session → hideLabelsOnMove is false
Local session  → hideLabelsOnMove is false

panning does not change label-threshold settings
zoom/label-threshold behavior remains intact
```

Prefer testing the resolved Sigma settings/session behavior rather than brittle source-string assertions.

---

## Validation

Run current equivalents of:

```bash
pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also perform a production-browser pan/zoom smoke.

No new dependency should be needed.

---

## Exit gate

Complete only when:

1. All Network labels remain visible during ordinary panning.
2. Focus Network labels remain visible during ordinary panning.
3. Existing zoom-based label threshold still works.
4. No layout/camera/physics behavior changes.
5. Small/medium pan performance remains acceptable.
6. Any large-graph tradeoff is measured rather than guessed.
7. Browser console is clean.
8. `pnpm check` passes.
9. PR and post-merge CI pass.
10. The exact prompt is archived under `history-implementations/`.
11. Branch/worktree cleanup completes.
12. No unrelated task is started.

---

## Final report

Report only:

```text
Change:
Performance:
Tests:
Dependencies:
PR / merge:
```

Keep it concise.
