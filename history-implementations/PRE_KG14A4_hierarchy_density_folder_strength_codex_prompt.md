# PRE-KG14A4 — Hierarchy Density Inversion + Network Folder-Clustering Strength

**Task type:** hierarchy visual-density cleanup / graph-settings simplification / Global Network spatial tuning / pre-KG14A polish

## Goal

Make the new `Scope × Layout` model visually coherent and make folder clustering directly adjustable without exposing physics details by default.

Implement two product changes:

```text
1. Hierarchy visual density

All + Hierarchy
→ COMPACT schematic hierarchy

Focus + Hierarchy
→ EXTENDED / detailed hierarchy


2. All + Network folder clustering

Folder clustering
[ On ]
Strength  Weak ─────●──── Strong
```

Folder clustering remains a **Network spatial prior only**.

Do not apply ForceAtlas2/folder forces to Hierarchy in this milestone.

Do not begin KG14A automatically.

---

## Current repository evidence

Repository: `lillo24/icarus-graph-explorer`

Current `main` includes PRE-KG14A3 / PR #41 at:

`2c04488152b12226ee74b1237b3e5e036aa596cd`

PR #41 established:

```text
Scope:  All | Focus
Layout: Network | Hierarchy
```

Internal mapping:

```text
All + Network
→ Global Sigma

All + Hierarchy
→ general Structure React Flow

Focus + Network
→ bounded Local Free Sigma

Focus + Hierarchy
→ bounded Local Structured React Flow
```

View-state remains schema v3. QUERY1 and GROUP1 are merged and must remain unchanged.

Current React Flow visual variants are:

```ts
GraphVisualVariant =
  | 'standard'
  | 'local-structured'
```

Current dimensions:

```text
standard / extended
File     200 × 80
Heading  184 × 72
Block    152 × 64

local-structured / compact
File     156 × 46
Heading  148 × 42
Block    132 × 38
```

The compact variant also owns the schematic marker grammar:

```text
File        ▰
Heading     ◇
Block       ●
Diagnostic  ○
```

Current assignment is:

```text
All + Hierarchy
→ standard / extended

Focus + Hierarchy
→ local-structured / compact
```

Under the new Scope × Layout model this is backwards from the desired density rule:

```text
All
→ potentially many nodes
→ compact representation

Focus
→ bounded smaller neighborhood
→ room for richer cards/details
```

Current `GlobalLayoutSettings` already contains `folderClustering`, `spacingPreset`, and optional custom layout settings. The existing custom contract already contains `folderCohesion` with range `0 → 0.18`.

Current preset cohesion values are weak:

```text
compact  0.055
normal   0.045
spacious 0.035
```

The Settings UI exposes `Folder tendency` only after enabling `Custom controls`.

Reuse the existing setting contract rather than introducing a second competing folder-strength field unless current implementation evidence proves that impossible.

---

# Part A — hierarchy density inversion

## Product rule

Final assignment:

```text
Scope   Layout      Visual density

All     Hierarchy   Compact schematic
Focus   Hierarchy   Extended / detailed
```

This is a **visual grammar** decision only.

Do not change:

- All vs Focus projection semantics;
- bounded Focus membership;
- Hierarchy Depth behavior;
- QUERY1;
- Visual Groups;
- W3 latest-result-wins architecture;
- history/persistence;
- Scope × Layout mapping.

---

## Decouple visual variant from old Local naming

The visual name `local-structured` becomes misleading once compact schematic nodes are used in All.

Refactor the **visual variant** to a scope-neutral name.

Preferred conceptual API:

```ts
export type GraphVisualVariant =
  | 'extended'
  | 'compact-schematic'
```

Exact names may follow repo style.

Rename related presentation-only symbols where practical:

```text
LOCAL_STRUCTURED_ENTITY_NODE_DIMENSIONS
→ COMPACT_HIERARCHY_ENTITY_NODE_DIMENSIONS

LOCAL_STRUCTURED_DIAGNOSTIC_NODE_DIMENSIONS
→ COMPACT_HIERARCHY_DIAGNOSTIC_NODE_DIMENSIONS

graph-node--local-structured
→ graph-node--compact-schematic

entity-card--local-structured
→ entity-card--compact-schematic

local-structured-marker
→ compact-hierarchy-marker
```

Do **not** rename the Dagre/layout mode `local-structured` merely because the visual variant changes.

Keep:

```text
visualVariant
= card density / marker grammar

layoutMode
= Dagre behavior / scope-specific geometry
```

as separate concepts.

---

## Keep existing layout algorithms by scope

Do not swap Dagre modes with card styles.

### All + Hierarchy

```text
projection:
current All Structure projection

visual variant:
compact-schematic

Dagre mode:
current structure mode
```

### Focus + Hierarchy

```text
projection:
current bounded Focus projection

visual variant:
extended

Dagre mode:
current local-structured mode
```

Why:

- the requested change is about density and visual grammar;
- All still needs general Structure layout semantics;
- Focus still needs the bounded local schematic layout semantics;
- changing visual grammar and layout algorithm simultaneously would make QA ambiguous.

If larger Focus cards expose spacing problems in `local-structured` Dagre, tune only the narrow spacing values after measurement.

Do not add another layout engine.

---

## All + Hierarchy compact requirements

Use compact File / Heading / Block boxes plus schematic markers over the existing All Structure projection.

Preserve:

- File / Heading / Block distinction;
- `+` / `−` disclosure;
- Visual Group accents;
- focus/context role classes;
- duplicate-title disambiguation;
- full ARIA labels;
- full title through title/Inspector if visually truncated;
- hierarchy/reference edge semantics;
- keyboard behavior.

Compactness should materially reduce canvas footprint on medium/large All hierarchy views.

---

## Focus + Hierarchy extended requirements

Use the existing extended/detailed card treatment over the same bounded Focus projection.

Preserve:

- current `local-structured` Dagre mode;
- Focus root emphasis;
- `+` / `−` disclosure;
- root screen-position anchoring;
- semantic viewport/history;
- Visual Groups;
- QUERY1/filter state;
- same bounded projection as Focus + Network.

Do not embed Inspector-level technical detail into every card. "Extended" means the existing normal React Flow information density.

---

## Centralize scope → hierarchy density

Do not scatter:

```text
scope === all ? compact : extended
```

through components.

Create one pure decision seam, conceptually:

```ts
hierarchyVisualVariantForScope(
  scope: ExplorationScope,
): GraphVisualVariant
```

Current mapping:

```text
all   → compact-schematic
focus → extended
```

Do not add a Compact/Extended user preference yet.

Do not persist visual density.

This seam should make a future preference easy if the user later changes their mind.

---

## Layout cache / fingerprint correctness

Node dimensions change by scope, so make sure existing derived layout/cache fingerprints remain truthful.

Expected:

```text
All + Hierarchy compact dimensions
→ All W3/layout input reflects compact sizes

Focus + Hierarchy extended dimensions
→ Focus structured cache fingerprint reflects extended sizes
```

Do not reuse stale coordinates created for the old visual dimensions.

Bump only derived cache/layout versioning if needed.

No view-state schema change.

---

# Part B — folder clustering stays Network-only

Do **not** add folder clustering to Hierarchy in this task.

Hierarchy geometry is governed primarily by:

```text
parent/child rank
reference routing
Dagre geometry
```

The Network folder prior is a ForceAtlas2-derived spatial mechanism and should not be applied blindly to Hierarchy.

Product rule:

```text
Folder clustering
→ All + Network only
```

Hierarchy should not move when Folder clustering changes.

Make that clear in Settings so the current behavior does not look broken.

Add copy such as:

```text
Applies to Scope = All, Layout = Network.
```

If current view is not All + Network, optionally show:

```text
These changes appear when you return to All + Network.
```

Do not disable the controls merely because the current view is Hierarchy; allow configuring ahead.

---

# Expose a simple Folder clustering Strength slider

When Folder clustering is enabled, show directly:

```text
Folder clustering
[✓]

Strength
Weak ─────────●──────── Strong
```

Do not require Advanced/Custom controls.

Use a product-friendly normalized scale:

```text
0–100%
```

Do not expose raw `0.045`-style physics numbers in the main UI.

Internally map to the existing:

```text
folderCohesion: 0 → 0.18
```

Add pure helpers, conceptually:

```ts
folderClusteringStrength(settings): number // 0..100

withFolderClusteringStrength(
  settings,
  percent,
): GlobalLayoutSettings
```

Use deterministic rounding.

---

## Reuse existing GlobalLayoutSettings persistence

Prefer keeping current graph-preference storage compatible.

Changing Strength should:

1. resolve the current preset/custom values;
2. materialize `custom` from the current preset if necessary;
3. change only `folderCohesion`;
4. preserve all unrelated effective settings.

Do not add a second persisted `folderStrength` that can disagree with `folderCohesion`.

Do not bump view-state schema or graph-preference storage version solely for this.

Existing custom values must still load.

---

## Decouple Advanced controls visibility from persisted custom state

Current UI uses:

```text
custom !== undefined
```

both as persisted custom-layout state and as whether advanced controls are visible.

That becomes wrong once the simple Strength slider can create `custom`.

Refactor:

```text
Advanced controls visibility
→ transient component/UI state

GlobalLayoutSettings.custom
→ persisted effective custom values
```

Recommended UI:

```text
Folder clustering [on/off]
Strength slider
Spacing preset

Advanced controls ▸
```

`Advanced controls` is a disclosure/button, not an enable/disable checkbox.

Opening/closing it must not modify persisted settings.

Do not duplicate Folder strength inside Advanced controls.

Remove the current advanced `Folder tendency` slider because the simple Strength control now owns that parameter.

Advanced may continue to expose:

```text
Reference pull
Folder separation
Node size
Link thickness
Label threshold
```

and other already-supported useful parameters.

---

## Strength survives spacing changes

Folder clustering strength is conceptually independent from:

```text
Compact / Normal / Spacious
```

Required:

```text
Strength = 70%
Spacing Normal → Spacious
→ Strength remains 70%
```

When changing spacing, rebuild the preset baseline as needed while preserving current `folderCohesion`.

Add tests.

---

## Make default clustering more visible

The current Normal cohesion `0.045` is reported as too weak.

Increase default/preset cohesion modestly.

Target starting point:

```text
Normal ≈ 0.075–0.085
```

Reasonable first candidate:

```text
compact  0.09
normal   0.08
spacious 0.07
```

but use existing synthetic folder-prior visual/aggregate evidence before finalizing.

Hard requirement:

```text
folder grouping is clearly noticeable

BUT

strong cross-folder references can still pull nodes/clusters together
```

Do not create rigid boxes.

Do not create fake semantic edges.

Document final values.

---

## Folder-prior correctness

Tests must prove:

1. changing Strength changes positions, not graph edges;
2. Strength 0 is finite/stable and removes cohesion contribution;
3. Strength 100 is finite/stable;
4. strong cross-folder reference edges remain influential;
5. changing Strength triggers only latest valid All Network layout work;
6. stale layouts are rejected/cancelled;
7. Strength changes cause zero KG6 projection changes;
8. Strength changes cause zero Hierarchy W3 layout work;
9. spacing changes preserve Strength;
10. existing custom settings round-trip;
11. folder clustering Off retains Strength for later re-enable.

---

## Rapid slider movement

A range slider may emit many changes.

Do not let this create an obsolete serial layout backlog.

Use current latest-result-wins behavior.

If needed, coalesce/debounce at the **application layout-request boundary** while keeping the slider thumb visually immediate:

```text
slider UI updates immediately
→ only latest useful layout request survives
```

No new debounce dependency.

---

# Hierarchy-folder regression

Add explicit tests:

```text
All + Hierarchy active
→ change Folder Strength
→ 0 Hierarchy projection changes
→ 0 W3 layout requests

Focus + Hierarchy active
→ change Folder Strength
→ 0 Focus hierarchy layout requests
```

The preference may update for later All + Network use, but the current Hierarchy scene stays unchanged.

---

# Optional future seam — no implementation

If future Hierarchy folder organization is explored, it should probably be:

```text
soft sibling/lane ordering preference
```

rather than:

```text
ForceAtlas2 folder forces
fake folder edges
```

Document this only if useful.

No placeholder control required.

---

# QUERY1 / GROUP1 compatibility

Preserve:

```text
QUERY1 projection/filter semantics
Saved Filters
GROUP1 matching
Visual Group colors/accent
Inspector memberships
```

Compact/extended hierarchy cards must consume the same `VisualGroupPresentationMap`.

Folder Strength is layout-only and must not affect QUERY1/GROUP1.

---

# Accessibility

## All compact hierarchy

Keep:

- keyboard-focusable cards;
- full ARIA labels;
- visible focus;
- accessible `+` / `−`;
- full title accessible even when visually truncated.

## Folder strength

Use label:

```text
Folder clustering strength
```

Expose value through `aria-valuetext`, e.g.:

```text
45 percent
```

Disable slider while Folder clustering is Off while retaining stored value.

Advanced disclosure must be keyboard operable with `aria-expanded`.

---

# Performance gates

No new dependency expected.

Measure:

## All + Hierarchy

- compact mapping;
- Dagre input/layout;
- first paint;
- compare against current extended baseline.

Compact dimensions must not materially regress layout performance.

## Focus + Hierarchy

- extended mapping;
- Local-medium W3;
- seed/refined paint;
- root anchor stability.

## Folder slider

- rapid drag;
- worker cancellation/latest-only behavior;
- no UI freeze.

No CI timing thresholds.

---

# Scope

## In scope

- All + Hierarchy compact visual grammar;
- Focus + Hierarchy extended visual grammar;
- scope-neutral visual-variant naming;
- centralized scope→density mapping;
- retain current Dagre modes;
- cache/fingerprint correctness after dimension swap;
- direct Folder clustering Strength slider;
- normalized product UI;
- stronger default clustering;
- spacing changes preserve Strength;
- Advanced controls as transient disclosure;
- remove duplicate advanced Folder tendency;
- Network-only explanatory copy/tests;
- tests/benchmarks/browser/Tauri QA;
- docs;
- prompt archival;
- PR/CI/cleanup.

## Out of scope

Do not implement:

- folder clustering in Hierarchy;
- new hierarchy layout engine;
- Compact/Extended user preference;
- manual positions;
- folder-cluster dragging;
- GROUP1 changes;
- QUERY1 changes;
- Saved Views;
- analytics;
- KG14A itself.

---

# Suggested implementation sequence

1. Sync latest `main` after PR #41.
2. Verify no newer PR changes hierarchy/settings contracts.
3. Refactor visual variant naming away from `local-structured`.
4. Centralize Scope → hierarchy density mapping.
5. Apply compact variant to All + Hierarchy.
6. Apply extended variant to Focus + Hierarchy.
7. Reconcile cache/fingerprint/versioning with new dimensions.
8. Run focused hierarchy tests/benchmarks.
9. Add product-facing Folder Strength conversion helpers.
10. Surface Strength slider.
11. Refactor Advanced controls into transient disclosure.
12. Preserve Strength across spacing changes.
13. Tune stronger default cohesion using existing folder-prior evidence.
14. Add Network-only copy and operation tests.
15. Run focused tests.
16. Run full `pnpm check`, desktop check/build, benchmarks.
17. Production browser QA.
18. Release Tauri `.exe` QA + physical touchpad smoke.
19. Archive prompt under `history-implementations/`.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop; KG14A remains next.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
All Hierarchy compact visual QA
Focus Hierarchy extended visual QA
Hierarchy depth 0/1/2/3 regression
Focus root-anchor regression
QUERY1 + Visual Groups hierarchy QA
Folder Strength 0/25/50/75/100 QA
spacing-change preserves Strength QA
Folder clustering Off/On QA
Hierarchy unaffected by Folder Strength oracle
rapid slider latest-layout-wins QA
production browser matrix
release Tauri matrix
physical touchpad smoke
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

PRE-KG14A4 is complete only when:

1. All + Hierarchy uses compact schematic visual grammar.
2. Focus + Hierarchy uses extended/detailed visual grammar.
3. All + Hierarchy still uses the All Structure projection.
4. Focus + Hierarchy still uses the bounded Focus projection.
5. All + Hierarchy keeps Structure Dagre mode.
6. Focus + Hierarchy keeps local-structured Dagre mode unless narrow spacing evidence justifies a small adjustment.
7. visual density and layout mode are separate APIs.
8. reusable compact visual variant no longer uses misleading Local-specific naming.
9. compact dimensions are scope-neutral in code/docs.
10. compact markers work in All.
11. Focus extended cards keep root emphasis.
12. `+` / `−` disclosure works in both.
13. Visual Group styling works in both.
14. QUERY1/filter semantics remain unchanged.
15. node dimensions correctly affect layout/cache fingerprints.
16. stale pre-swap cached layouts are not reused incorrectly.
17. no Compact/Extended user preference is added.
18. Folder clustering remains All + Network only.
19. Settings state that clearly.
20. Folder Strength is visible without Advanced controls.
21. Strength uses friendly normalized UI.
22. Strength maps to existing `folderCohesion`.
23. no duplicate persisted strength field is introduced.
24. existing custom settings still load.
25. changing Strength preserves unrelated effective settings.
26. spacing preset changes preserve Strength.
27. Advanced visibility is transient UI state.
28. hiding Advanced does not discard custom values.
29. Advanced no longer duplicates Folder tendency.
30. default clustering is visibly stronger than old Normal `0.045`.
31. final presets remain within validated ranges.
32. strong cross-folder references remain influential.
33. no fake folder edges are added.
34. Strength causes zero KG6 projection changes.
35. Strength causes zero Hierarchy W3 work.
36. rapid slider movement does not build an obsolete serial layout queue.
37. Strength 0 and 100 remain stable.
38. clustering Off retains stored Strength.
39. graph-preference storage remains compatible.
40. view-state remains schema v3.
41. no new external dependency is added.
42. All Hierarchy performance does not materially regress.
43. Focus Hierarchy Local-medium remains usable with extended cards.
44. browser QA passes.
45. release Tauri QA passes.
46. physical touchpad smoke passes.
47. docs explain All compact / Focus extended rationale.
48. prompt is archived.
49. PR CI passes.
50. post-merge CI passes.
51. task branch/worktree cleanup completes.
52. KG14A is not started automatically.

---

# Final report

## 1. Summary
Final hierarchy-density assignment and folder-strength UX.

## 2. Hierarchy visual variants
Scope-neutral compact/extended refactor.

## 3. Scope assignment

```text
All + Hierarchy   → Compact
Focus + Hierarchy → Extended
```

## 4. Layout modes
Confirm only visual density changed; existing Structure/local-structured Dagre semantics remain.

## 5. Folder clustering
Confirm it remains All + Network only and why.

## 6. Strength slider
Product scale, internal cohesion mapping, persistence.

## 7. Default tuning
Old vs new preset values and visual/metric justification.

## 8. Advanced settings
Transient Advanced disclosure and persistent custom values.

## 9. Performance
All Hierarchy, Focus Hierarchy, rapid Strength drag.

## 10. QUERY1 / GROUP1 regression

## 11. Tests / browser / Tauri QA

## 12. Files changed

## 13. Dependencies
Expected additions: zero.

## 14. Future Hierarchy folder seam
If documented, ordering/lane preference rather than ForceAtlas2/fake edges.

## 15. Roadmap

Confirm:

```text
KG13 complete
PRE-KG14A cleanup sequence complete through PRE-KG14A4
KG14A next
```

Do not implement KG14A automatically.
