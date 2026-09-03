# VISUAL1A — Advanced Network Visual Controls + Link-Driven Node Sizing

**Task type:** feature / UI settings cleanup / renderer presentation control / persistence-compatible refinement

## Goal / success outcome

Turn the existing All + Network “Advanced controls” into a clearer advanced customization area and add direct control over how much reference connectivity increases document-node size.

The important new user-facing behavior is:

```text
Link influence on node size
None ─────────────── Strong
```

The user should be able to choose between:

```text
0
→ all ordinary document nodes use approximately the configured base size

default
→ preserve approximately today's existing connectivity-based size behavior

100
→ highly connected documents become more visually prominent than today,
   while remaining bounded so hubs cannot dominate the graph
```

Keep the existing logarithmic/compressed idea rather than scaling linearly with raw reference count.

This slice should also organize the already-existing advanced controls coherently instead of adding another overlapping settings system.

---

## Current evidence

Start by inspecting current `main`; do not assume the implementation-plan snapshot is newer than the repository.

At the time this prompt was prepared, relevant areas included:

- `apps/web/src/components/GraphSettings.tsx`
- `packages/renderer-sigma/src/settings.ts`
- `packages/renderer-sigma/src/types.ts`
- `packages/renderer-sigma/src/mapping.ts`
- `apps/web/src/preferences/graph-preferences.ts`
- `packages/renderer-sigma/src/session.ts`
- renderer/settings tests and preference tests
- `packages/renderer-sigma/README.md`
- `apps/web/src/preferences/README.md`

Current behavior worth preserving:

### Existing advanced controls

The Graph Settings panel already contains an `Advanced controls` disclosure under All Network Layout.

It currently contains controls equivalent to:

```text
Reference pull
Folder separation
Node size
Link thickness
Label threshold
```

Do not add a second competing advanced-settings architecture.

### Current document sizing

All + Network currently computes document size from:

```text
base node size
+
bounded logarithmic function of visible reference degree
```

Reference degree counts the underlying canonical occurrences represented by projected reference edges.

The connectivity component is currently hard-coded rather than user-controlled.

Diagnostic/reference-target nodes use separate sizing behavior and should remain visually subordinate.

### Existing persistence

`GlobalLayoutSettings` is persisted through the graph-preferences system rather than KG9 view-state.

The storage contract is still graph-preferences v1.

Be careful: the current custom-settings validator expects every known custom field. Naively adding another required custom property could make previously saved custom settings fail validation and silently fall back to defaults.

Existing saved preferences must remain usable.

### Concurrent work

This work is intended to run in parallel with ongoing KG work.

Use an isolated branch/worktree based on current `main`.

Do not modify or clean another checkout, another task branch, unrelated untracked implementation prompts, or concurrent KG work.

Before eventual merge, update from the then-current `main` and resolve any overlap semantically rather than blindly taking either side.

---

## Scope

### 1. Add connectivity-size strength

Add a persisted Network presentation setting representing how strongly reference connectivity affects ordinary document-node size.

Prefer a semantically clear internal name such as:

```text
referenceDegreeSizeInfluence
```

or another name justified by the actual metric.

User-facing label should be clearer than the implementation term:

```text
Link influence on node size
```

or:

```text
Connectivity size influence
```

The UI should expose it as a simple 0–100 slider.

Expected semantics:

```text
0%
→ no reference-degree size boost

middle/default
→ approximately current behavior

100%
→ stronger, still bounded degree effect
```

The exact internal numeric range does not have to be 0–100. The product-facing control can map onto a normalized internal value.

### 2. Preserve compressed scaling

Do not make node size proportional directly to raw degree.

A document with 100 references must not become ten times the size of one with 10.

Retain a bounded logarithmic/square-root-like relationship.

Conceptually:

```text
displaySize
=
baseSize
+
compressed(referenceDegree) × influence
```

but choose the exact formula after inspecting the current implementation and renderer behavior.

Requirements:

- monotonic with degree when influence > 0;
- influence 0 removes the connectivity contribution;
- bounded at large degree;
- current/default visual behavior remains approximately unchanged;
- maximum influence is visibly stronger but still usable.

Add focused tests around this behavior rather than relying only on screenshots.

### 3. Reorganize Advanced controls

Reuse the current disclosure.

Inside it, make the conceptual distinction between spatial/layout controls and visual controls clearer.

A reasonable result is:

```text
Advanced controls

Layout
  Reference pull
  Folder separation

Visual
  Base node size
  Link influence on node size
  Link thickness
  Label threshold
```

Exact markup can vary if repository conventions suggest a better implementation.

Do not reintroduce Folder cohesion here.

The existing direct control:

```text
Folder clustering strength
```

should remain the single normal product-facing control for folder cohesion.

Avoid exposing low-level physics parameters merely because they exist internally.

### 4. Preserve spacing independence where sensible

Inspect current `withGlobalSpacingPreset()` behavior carefully.

The conceptual model should remain:

```text
Spacing preset
→ spatial baseline

Folder clustering strength
→ independent spatial preference

Advanced visual choices
→ presentation choices
```

Changing Compact / Normal / Spacious should not unexpectedly destroy a user-customized connectivity-size influence.

Prefer preserving the new connectivity influence across spacing changes.

Also evaluate whether the existing advanced visual values:

```text
base node size
link thickness
label threshold
```

should remain stable once explicitly customized rather than being unintentionally reset by a spacing change.

Do not perform a large settings-schema redesign only for elegance. If the current representation cannot distinguish explicit customization cleanly without substantial churn, keep this slice narrow and document the remaining behavior.

### 5. Backward-compatible persistence

Existing graph-preferences v1 records must continue loading.

In particular, a stored custom `GlobalLayoutSettings` object created before this feature will not contain the new connectivity-size field.

Do not respond by discarding the entire previous custom object.

Normalize/migrate legacy custom values by supplying the appropriate default for the new field.

Test at minimum:

```text
old preset-only settings
old custom settings
new settings
malformed settings
round-trip serialization
```

Do not bump KG9 view-state schema for this feature.

Only change graph-preference versioning if repository inspection shows a real compatibility reason.

### 6. Apply only where semantics are established

The primary target is:

```text
Scope = All
Layout = Network
```

That is the renderer where connectivity-dependent document sizing already exists.

Do not modify Hierarchy sizing in this slice.

Do not automatically extend the setting to Focus + Network if doing so requires inventing a new cross-renderer presentation contract.

Inspect Focus + Network first.

If its current node-sizing semantics differ — e.g. root/entity-kind sizing — preserve them and report that VISUAL1A intentionally affects All + Network only.

If there is already a clean shared Network appearance contract that makes reuse trivial and semantically correct, it is acceptable to share the control, but justify that decision explicitly.

---

## Non-scope

Do not implement any of the following here:

```text
per-node custom size
per-node hide/show overrides
visible-node sidebar
right-click node management
manual node dragging/pinning
Move mode
folder-cluster manual offsets
individual persisted positions
Saved Views
adaptive automatic renderer/layout switching
Hierarchy degree-based sizing
Visual Groups redesign
QUERY1 changes
canonical graph changes
new graph metrics/centrality algorithms
```

Those are separate later slices.

In particular, do not create the future generic:

```text
Position / Size / Visibility
```

per-entity override system yet.

VISUAL1A should leave a clean path for that future work without prematurely designing its storage format.

---

## Implementation guidance

1. Inspect current `main`, current graph-preference tests, Sigma mapping, layout fingerprints, and settings update behavior.

2. Establish the exact current connectivity-sizing formula with a regression test before changing it.

3. Add the new normalized influence setting with a default corresponding approximately to current behavior.

4. Make legacy persisted custom settings normalize to that default instead of failing.

5. Update the document mapping so connectivity sizing is:
   - deterministic;
   - bounded;
   - logarithmically/compressively scaled;
   - controlled by the new influence.

6. Reorganize the Advanced controls into understandable Layout / Visual groupings without creating duplicate controls.

7. Preserve Folder clustering strength as its current independent 0–100 product control.

8. Check whether changing visual-only settings currently causes unnecessary projection or worker layout work.

   Do not introduce a broad renderer refactor merely to optimize this.

   However, if a purely visual control can safely update Sigma styling without a new layout request using existing boundaries, prefer that behavior.

   Node size may legitimately require layout work if size participates in spacing/collision/layout semantics.

9. Preserve existing accessibility:
   - labels for range controls;
   - keyboard operation;
   - useful `output` values;
   - sensible `aria-valuetext` for percentages where appropriate.

10. Update relevant renderer/preferences documentation so the ownership is clear:

```text
canonical truth
≠
graph preferences
≠
per-workspace view state
```

No new dependency should be necessary.

---

## Validation

Add focused deterministic tests for the new behavior.

At minimum verify:

### Sizing

- Influence 0 produces no degree-derived increase for ordinary document nodes.
- Increasing degree never makes a node smaller.
- Default influence reproduces approximately the old sizing function.
- Strong influence is larger than default for connected nodes.
- Very high degree remains bounded.
- Degree-zero documents remain at base size.
- Diagnostic nodes retain their intended separate sizing behavior.
- Aggregated reference occurrence counts continue contributing consistently with existing semantics.

### Settings

- Range validation rejects invalid influence values.
- Legacy custom settings without the new field load successfully.
- Existing custom values survive legacy normalization.
- Current/new settings round-trip.
- Folder strength remains independent.
- Spacing changes preserve the new connectivity influence.
- Malformed preference behavior remains fail-safe.

### Interaction / performance invariants

Check whether:

```text
hover
selection
pan/zoom
Inspector
```

still do not cause projection/layout work.

Changing the new sizing setting may legitimately remap and/or relayout depending on the chosen contract, but the operation should be intentional and covered by existing instrumentation where applicable.

Run the repository-required checks from `AGENTS.md`, plus relevant focused tests.

At minimum, assuming commands remain current:

```text
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Also run browser QA covering:

```text
Synthetic Sample
→ All + Network
→ Settings
→ Advanced controls
→ influence 0
→ default
→ 100
→ change base size
→ change link thickness
→ change label threshold
→ switch spacing preset
→ close/reopen Settings
→ reload
```

Confirm:

- graph updates correctly;
- no console errors/warnings;
- previous settings persist;
- the panel remains within the viewport;
- no accidental changes to Hierarchy;
- no accidental changes to QUERY1/Visual Groups/Focus history.

Run release Tauri QA if the normal project workflow requires it.

Do not merge until the required graphical QA has passed.

---

## Parallel-work / merge discipline

Because KG work may touch nearby application/settings files:

- keep this branch focused;
- do not merge unrelated main changes into feature commits;
- before opening/finalizing the PR, rebase or update onto current `main`;
- rerun focused tests after conflict resolution;
- rerun the full required checks;
- explicitly report any semantic conflict with concurrent KG work.

Do not overwrite the user's other checkout or working tree.

---

## Final report

Report:

1. final branch and PR;
2. exact setting name and persisted representation;
3. chosen connectivity-size formula and why;
4. what 0/default/100 mean;
5. whether the control affects only All + Network or also Focus + Network, and why;
6. how legacy graph preferences were preserved;
7. whether spacing changes preserve custom visual settings;
8. whether visual-setting changes trigger layout and why;
9. files changed;
10. tests/checks/benchmarks/QA run;
11. anything skipped;
12. dependencies added, if any;
13. privacy/security implications, if any;
14. remaining follow-up work.

Explicitly leave these for later:

```text
VISUAL1B / node presentation overrides
- individual size
- visibility override
- future left-side node list integration

SPATIAL1 / manual placement
- Move mode
- individual pinning
- folder-cluster offsets
- persistence/reset semantics
```

Do not implement those automatically.
