# SPACING1B-QA — Settings Sandbox + Density-Framing A/B Control

**Task type:** UI refactor + QA/tuning instrumentation

## Goal / success outcome

Make SPACING1B visually testable before merging PR #60.

Two changes belong in this pass:

1. Reorganize Settings so graph-tuning/experimental controls live under a dedicated `Sandbox` section, while ordinary interaction preferences remain separate.
2. Add a Focus Network density-framing strength control that lets the user directly compare:
   - the old pre-SPACING1B camera behavior;
   - the current SPACING1B automatic density framing.

Success means I can open the exact release `.exe`, use the same Focus graph, switch between legacy and SPACING1B framing, and judge whether the new behavior is genuinely better.

Do not merge PR #60 until I explicitly accept the native graphical QA.

---

## Current evidence

PR #60 is currently a draft:

- PR: #60
- branch: `codex/spacing1b-density-camera`
- current head: `de70713`
- merge gate: native graphical QA before merge.

SPACING1B currently:

- preserves ForceAtlas2 coordinates and graph geometry;
- calculates density from connected-edge distance, nearest-neighbor density, and root radius;
- takes the median of those signals;
- clamps the resulting automatic camera ratio to `0.7–1.4`;
- distinguishes automatic camera ownership from user-owned pan/zoom;
- makes Fit return to the latest automatic density decision.

Relevant implementation already exists around:

- `packages/renderer-sigma/src/local-density.ts`
- `packages/renderer-sigma/src/local-session.ts`
- Local Sigma canvas/session integration
- existing SPACING1A analysis/benchmark tooling.

Current Settings already separates Graph settings from `Source & Diagnostics`, but Graph presently mixes things such as:

- Focus Root appearance;
- All Network layout;
- folder clustering;
- spacing/advanced rendering controls;
- Trackpad Zoom;
- Experimental controls.

The desired distinction is now:

```text
Preferences
Sandbox
Source & Diagnostics
```

---

## Scope / non-scope

### In scope

- Modify the existing PR #60 branch rather than creating a separate feature PR.
- Reorganize the Settings UI into:
  - `Preferences`
  - `Sandbox`
  - `Source & Diagnostics`
- Move Trackpad Zoom into Preferences.
- Move the current graph appearance/layout/experimental tuning controls into Sandbox.
- Add a Focus Network density-framing strength control to Sandbox.
- Add a clearly scoped `Reset Sandbox` action.
- Extend tests for the new Settings organization and density-framing interpolation.
- Preserve the existing SPACING1B algorithm and camera-ownership model.
- Produce a fresh optimized desktop executable for manual QA.

### Non-scope

Do not:

- change ForceAtlas2 coordinates or forces;
- redesign the SPACING1A density formula;
- change graph topology, projection, fingerprints, layout cache semantics, or worker layout;
- change node-size behavior;
- change reference-line LOD behavior;
- add new dependencies;
- redesign Source & Diagnostics;
- start KG14 work or another spacing initiative;
- turn Sandbox into a generic arbitrary physics editor;
- merge PR #60 before explicit user acceptance.

---

## Implementation guidance

### 1. Work on the existing SPACING1B branch

Inspect the current repository/worktree state and AGENTS instructions first.

Continue from:

```text
codex/spacing1b-density-camera
```

and update existing draft PR #60.

Do not disturb unrelated worktrees, branches, modified files, or untracked prompt files.

---

### 2. Reorganize Settings

Replace the current high-level organization:

```text
Graph
Source & Diagnostics
```

with:

```text
Preferences
Sandbox
Source & Diagnostics
```

#### Preferences

For now this contains the ordinary interaction preference:

```text
Trackpad Zoom
├─ Scroll to Zoom
└─ Pinch to Zoom
```

Preserve its current behavior and persistence exactly.

Do not move experimental renderer/layout tuning here merely because it affects the graph.

#### Sandbox

Move the existing graph-tuning controls here, preserving behavior:

```text
Sandbox
├─ Focus Root appearance
├─ All Network Layout
│  ├─ Folder clustering
│  ├─ Folder clustering strength
│  ├─ Spacing
│  └─ Advanced controls
├─ Focus Network Density Framing
└─ Experimental
   └─ Show All Hierarchy
```

The purpose of Sandbox is explicit:

> Controls useful for experimenting with graph presentation and choosing good defaults, not essential ordinary preferences.

Do not change their underlying semantics merely as part of moving them.

#### Source & Diagnostics

Leave its current contents and behavior unchanged.

Preserve keyboard-accessible tab behavior and scrolling.

---

### 3. Add Focus Network density-framing strength

Add a Sandbox control approximately like:

```text
Focus Network Density Framing

Strength
Legacy                          Auto
0% ─────────────────────────── 100%
```

Use a `0–100%` range for this pass.

Interpretation:

```text
0%
= legacy pre-SPACING1B framing

100%
= current SPACING1B density decision
```

For an automatic density decision `D`, calculate the effective camera ratio by interpolating from the old baseline ratio `1`:

```text
effectiveRatio =
1 + (D - 1) * strength
```

where:

```text
strength = sliderPercentage / 100
```

Examples:

```text
D = 0.8

0%   → 1.0
50%  → 0.9
100% → 0.8
```

and symmetrically if the automatic decision is greater than `1`.

This is intentionally a camera-policy interpolation only.

Do not alter the raw density measurements or the existing `0.7–1.4` automatic decision bounds.

---

### 4. Preserve camera ownership semantics

The new control must respect SPACING1B's established distinction:

```text
automatic camera
vs
user-owned camera
```

Expected behavior:

#### Automatic camera

Changing Density Framing strength may immediately apply the corresponding framing.

#### User-owned camera

If the user has manually:

- panned;
- pinched;
- wheel-zoomed;
- used zoom controls;
- restored/navigated to a user-owned viewport;

changing the Sandbox strength must not unexpectedly snap the camera.

The new value should become the policy used the next time automatic framing is requested.

#### Fit

Fit remains the explicit way to return to automatic framing.

Therefore:

```text
Strength = 0%
→ Fit reproduces legacy framing

Strength = 100%
→ Fit uses current SPACING1B framing
```

Fit must remain camera-only and must not request ForceAtlas2 layout.

---

### 5. Do not contaminate layout identity

Changing the density-framing strength must not affect:

- ForceAtlas2 worker requests;
- accepted positions;
- layout fingerprints;
- position caches;
- topology;
- projection;
- node-size computation;
- Visual Groups;
- query state.

Add regression coverage proving this where appropriate.

---

### 6. Persistence

Treat the new density strength primarily as a Sandbox/QA control.

Do not introduce a persistence-schema migration solely for this control unless the current architecture already provides an appropriate low-cost transient setting path.

Preferred initial behavior:

```text
application launch
→ Density Framing = 100%
```

Existing settings moved into Sandbox should retain whatever persistence semantics they already have.

The density algorithm itself remains production code; this control is for comparing/tuning its influence.

---

### 7. Reset Sandbox

Add a clearly labelled:

```text
Reset Sandbox
```

This must reset only controls owned by Sandbox to their product defaults.

It must not reset:

- Trackpad Zoom;
- Source/Vault configuration;
- diagnostics;
- queries;
- Saved Filters;
- viewport/history state unrelated to Sandbox;
- vault data.

Make the reset scope explicit in tests.

---

### 8. Keep the UI restrained

Do not turn Sandbox into a debug dashboard.

The density section should expose the useful experimental control, not all three raw density signals.

If the current computed automatic ratio can be surfaced very cheaply without creating awkward renderer→React coupling, a small readout such as:

```text
Automatic ratio: 0.93
```

is acceptable.

It is optional.

Do not restructure the renderer solely to expose that diagnostic number.

---

## Validation

### Unit / component tests

Add focused tests for:

#### Settings organization

- Preferences / Sandbox / Source & Diagnostics tabs exist.
- Trackpad Zoom appears under Preferences.
- graph layout/appearance controls appear under Sandbox.
- Source & Diagnostics remains intact.
- keyboard tab navigation still works.
- Reset Sandbox has the correct limited scope.

#### Density interpolation

Verify exact behavior:

```text
0%   → ratio 1
100% → raw SPACING1B decision
50%  → exact midpoint
```

Test decisions both below and above `1`.

#### Camera ownership

Verify:

- automatic camera responds to the selected strength;
- user-owned viewport is preserved;
- Fit returns to automatic ownership;
- Fit at 0% reproduces legacy framing;
- Fit at 100% reproduces current SPACING1B framing;
- topology/layout completion does not steal a user-owned camera.

#### Layout invariants

Changing Density Framing strength must create:

```text
0 additional layout requests
```

and must not alter accepted relative geometry.

---

### Existing validation

At minimum run the relevant current SPACING1B checks, including:

```text
pnpm exec vitest run packages/renderer-sigma
pnpm check
pnpm desktop:check
pnpm desktop:build
pnpm analyze:focus-spacing
pnpm benchmark:local-renderer
```

Run any additional focused Settings/UI tests introduced by this change.

Keep existing responsiveness/performance evidence valid; if the UI control introduces measurable new work, report it.

---

## Manual graphical QA

Build a fresh optimized `.exe` and give me its exact path/hash.

Do not merge.

I need to test:

### A. Direct old/new comparison

Using the same sparse Focus Network:

```text
Density = 0%
Fit
→ observe legacy framing

Density = 100%
Fit
→ observe SPACING1B framing
```

The difference should be clear enough to evaluate.

### B. Sparse graph

At 100%, sparse Focus graphs should occupy the viewport more naturally than at 0%.

### C. Dense graph

At 100%, dense Focus graphs must not become excessively compressed or enlarged.

### D. User ownership

```text
pan/zoom manually
→ change depth/query/topology
```

Camera must not snap back.

### E. Fit

Repeated Fit should deterministically return to the same framing for the same graph and Sandbox strength.

### F. Size independence

Changing node Size must still change render size without modifying:

- layout;
- camera;
- density calculation result.

### G. Edge visibility

Reference lines must remain visible at the previously fixed Focus zoom-out ranges.

### H. Settings UX

Verify:

- Preferences contains Trackpad Zoom;
- Sandbox contains graph tuning;
- Source & Diagnostics remains separate;
- no Settings overflow/regression;
- Reset Sandbox is understandable and scoped correctly.

---

## Merge gate

PR #60 must remain draft/unmerged after implementation and automated validation.

Wait for my explicit native QA acceptance.

If I reject the current density behavior, use the Sandbox comparison evidence to decide what should change rather than guessing from screenshots.

If I accept it, then finalize the PR, update relevant documentation if needed, archive this implementation prompt under `history-implementations`, merge, verify post-merge CI, and clean up the task branch/worktree according to the repository workflow.

Suggested archive name:

```text
SPACING1B_QA_settings_sandbox_density_ab_control_codex_prompt.md
```

---

## Final report

Report:

1. Settings structure before/after.
2. Exact density-strength behavior and formula.
3. Whether the new control is transient or persisted, and why.
4. Camera-ownership behavior.
5. Confirmation that ForceAtlas2/layout geometry is unchanged.
6. Files changed.
7. Tests/checks/benchmarks run and their results.
8. Fresh release executable path and SHA-256.
9. Any deviations from this plan.
10. Any remaining concerns.
11. Explicit confirmation that PR #60 is still unmerged and waiting for native QA.
