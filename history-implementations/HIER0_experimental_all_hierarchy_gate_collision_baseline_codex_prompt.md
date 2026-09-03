# HIER0 — Experimental All-Hierarchy Gate + Focus-Hierarchy Collision Baseline

**Task type:** product gating / renderer correctness / collision-proof immediate layout / compact-name disambiguation / prerequisite for Focus Schematic redesign

## Goal

Prepare the current Hierarchy implementation for the later File-module redesign without beginning that redesign yet.

HIER0 has four concrete outcomes:

```text
1. All + Hierarchy
   → hidden by default
   → retained intact behind an Experimental setting

2. Focus + Hierarchy
   → remains a normal supported layout

3. Current Hierarchy rendering
   → no overlapping node rectangles in the immediate seed or adopted layout
   → diagnostics placed with reserved collision-aware space

4. Duplicate File names
   → compact cards show the minimum unique parent-folder context
```

The purpose is to establish a truthful, collision-free baseline before HIER1 defines the new root-centric Focus Schematic model.

Do **not** implement File modules, left/right incoming/outgoing ranks, folder bands, secondary links, or a new layout algorithm in HIER0.

Do **not** delete All + Hierarchy.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
b81cc2cdd93ec7dd314189616efec3717ae81d18
```

This includes:

```text
KG14B1 — exact-path QUERY1 exclusions
KG14B2 — accessible Network Explorer
KG14B3 — Query / Focus / Inspect / Hide integration
NETWORKZOOM1
VISUAL1A
```

Current user-facing model:

```text
Scope
All | Focus

Layout
Network | Hierarchy
```

Current internal mapping:

```text
All + Network
→ rendererMode = global
→ Sigma

All + Hierarchy
→ rendererMode = structure
→ React Flow + Dagre

Focus + Network
→ rendererMode = local
→ localLayoutMode = free
→ Sigma

Focus + Hierarchy
→ rendererMode = local
→ localLayoutMode = structured
→ React Flow + Dagre
```

Current hierarchy density:

```text
All + Hierarchy
→ compact-schematic cards

Focus + Hierarchy
→ extended cards
```

Current Focus projection semantics are already correct and must remain:

```text
document neighborhood fixed first
→ root-scoped structural detail applied second
```

Changing Heading depth must not change which Files belong to Focus.

---

# Concurrent work

At plan-writing time:

```text
PR #51 — VISUAL1B per-File Network size overrides
```

is open as a draft and blocked on separate native Network-layout QA.

It overlaps some application files such as `GraphExplorer.tsx` / `App.css`, but its feature is Network-only.

Rules:

1. Do not modify, reset, delete, merge, or close PR #51 or its worktree.
2. Branch HIER0 from current `main`.
3. Check PR #51 and other open PRs before implementation and before final merge.
4. If relevant work merges first, integrate latest `main` and repeat validation.
5. Preserve presentation-override behavior if it reaches `main`; HIER0 must not change Network sizing semantics.
6. Keep HIER0 changes scoped to Hierarchy gating/correctness.

Preserve unrelated user work, especially current `AGENTS.md` and untracked/worktree state.

---

# Existing technical evidence

## All + Hierarchy is currently a normal primary layout

`ExplorationControls` always exposes:

```text
Layout
Network | Hierarchy
```

for both All and Focus.

The gating must therefore be explicit at the product-control boundary rather than deleting internal `structure` mode.

## Graph preferences

Current preference storage is:

```text
icarus.graph-explorer.preferences.v1
```

and includes:

```text
focusAppearance
globalLayoutSettings
localLayoutMode
trackpadZoomMode
```

It is tolerant of absent/invalid individual fields.

HIER0 may add one optional backward-compatible boolean without changing the storage key.

## Immediate Focus-Hierarchy seed

Current `seedLocalStructuredGraph()` uses fixed center spacing:

```text
RANK_GAP = 210
LANE_GAP = 64
```

But current extended Focus cards are approximately:

```text
File       200 × 80
Heading    184 × 72
Block      152 × 64
Diagnostic 208 × 94
```

A 64-pixel center-to-center lane step can therefore overlap nodes whose heights exceed 64.

## Final diagnostic placement

Dagre currently receives entity nodes only.

Diagnostic nodes are positioned afterward by `positionDiagnostics()` beside their source. Their rectangles are not reserved during Dagre layout and are not collision-checked against entity nodes or previously placed diagnostics beyond a simple source-local stack.

## Duplicate File presentation

The renderer already computes the shortest unique parent suffix for same-named documents.

Example:

```text
folder-a/Note.md
folder-b/Note.md
```

produces presentation context conceptually equivalent to:

```text
Note · folder-a
Note · folder-b
```

However, compact schematic CSS hides `.entity-detail`, making the two File cards visually indistinguishable.

The Synthetic Sample deliberately contains:

```text
folder-a/Note.md
folder-b/Note.md
```

and `Source.md` contains `[[Note]]`, producing an ambiguous reference with two valid candidates.

Do not change that fixture or resolver behavior.

---

# Product decision 1 — hide All + Hierarchy by default

Final normal product surface:

```text
Scope = All
→ Layout = Network

Scope = Focus
→ Layout = Network | Hierarchy
```

All + Hierarchy remains available through:

```text
Settings
└─ Graph
   └─ Experimental
      └─ Show All Hierarchy
```

Default:

```text
Off
```

When enabled:

```text
Scope = All
→ Layout = Network | Hierarchy
```

This is a product-exposure preference, not view-state/canonical truth.

---

# 1. Persisted experimental preference

Add a graph preference with a clear name, conceptually:

```ts
showExperimentalAllHierarchy: boolean
```

Requirements:

```text
default = false
persisted in existing graph-preferences v1 record
old records without field → false
non-boolean stored field → false
storage-key/schema version unchanged
```

Do not add this to:

```text
view-state schema
workspace view
QUERY1
Saved Filters
Visual Groups
canonical snapshot
```

It is a general product preference.

## Saving

Current `GraphExplorer` constructs the complete preference object from several callbacks.

Avoid accidentally dropping the new field when saving another setting.

Preferred narrow refactor:

```text
one helper/controller owns current GraphPreferences
→ individual controls update one field
→ complete record saved consistently
```

Do not turn this into a new state-management system.

Storage failures retain current session behavior and warning quality.

---

# 2. Experimental Settings UI

At the **end** of the Graph settings panel, add a collapsed disclosure:

```text
Experimental
```

Inside:

```text
Show All Hierarchy  [ ]
```

Description:

```text
Exposes the whole-vault Hierarchy layout. Focus Hierarchy remains available normally.
```

A concise warning may state that the whole-vault layout is retained for experimentation and is not the current recommended global view.

Requirements:

- disclosure collapsed by default;
- disclosure open/closed state is transient;
- keyboard accessible;
- `aria-expanded`;
- no new settings tab;
- safe in short-height Settings scroll;
- changing the checkbox persists through existing preference storage;
- enabling it does not automatically change the active layout;
- enabling it does not eagerly run an All-Hierarchy layout.

---

# 3. Exploration Controls behavior

Extend `ExplorationControls` through a narrow explicit prop such as:

```ts
allHierarchyExposed: boolean
```

or equivalent.

## Experimental Off, Network available

When:

```text
scope = all
showExperimentalAllHierarchy = false
All Network available
```

show:

```text
Layout
[ Network ]
```

Do not show a disabled/teasing Hierarchy button.

Keep the Layout group so the current state remains explicit and the toolbar geometry does not become ambiguous.

## Focus

When:

```text
scope = focus
```

always show:

```text
Layout
[ Network ] [ Hierarchy ]
```

regardless of the experimental preference.

## Experimental On

When:

```text
scope = all
showExperimentalAllHierarchy = true
```

show:

```text
Layout
[ Network ] [ Hierarchy ]
```

The All-scope Hierarchy control should have concise accessible experimental context, for example:

```text
aria-label="Hierarchy, experimental in All scope"
title="Experimental whole-vault Hierarchy"
```

Avoid a large permanent warning.

## Network unavailable

If All Network is unavailable for the current session, All + Hierarchy remains an emergency recovery surface even when the preference is Off.

In that case:

```text
Hierarchy becomes available as fallback
Network is disabled/explained
```

Do not silently persist `showExperimentalAllHierarchy = true`.

The experimental setting controls normal exposure; it must not remove an existing recovery path.

---

# 4. Centralize presentation-mode availability

Do not distribute ad hoc checks such as:

```text
if (!showExperimental...) ...
```

through every callback.

Add one small pure application-level availability resolver, conceptually:

```ts
interface ExplorationAvailability {
  readonly showExperimentalAllHierarchy: boolean;
  readonly allNetworkAvailable: boolean;
}

resolveAvailablePresentationMode(
  requestedMode,
  state,
  availability,
): GraphPresentationMode
```

Core rules:

```text
requested local + valid Focus root
→ local

requested local + missing Focus root
→ preferred available All mode

requested structure + Focus absent
→ structure when explicitly exposed
→ structure when All Network unavailable as recovery
→ otherwise global

requested global + All Network available
→ global

requested global + All Network unavailable
→ structure recovery
```

Exact function shape may follow current architecture.

Use the same policy for:

- initial hydration;
- direct Layout changes;
- Back/Forward history;
- returning from Focus;
- exact Search/Inspector navigation;
- live removal of the Focus root;
- renderer-load failure recovery;
- disabling the experimental preference while active.

No inaccessible hidden-mode path should remain.

---

# 5. Initial hydration / reload

Existing stable saved views may say:

```text
presentationMode = structure
focus = undefined
```

When experimental All Hierarchy is Off and Network is available:

```text
hydrate saved state/viewports
→ preserve disclosure and structure viewport metadata
→ start visibly in All Network
```

Do not reject or delete the saved record.

Do not bump view-state schema v3.

The next ordinary persistence update may record the currently visible All Network mode while retaining renderer-specific viewport bookmarks according to existing contracts.

If Network is unavailable, recovery to All Hierarchy remains valid.

Add explicit tests for:

```text
old preferences with no experimental field
saved All Hierarchy + setting Off
saved All Hierarchy + setting On
saved All Network
Focus Hierarchy
Network unavailable fallback
```

---

# 6. Disabling while All + Hierarchy is active

If the user turns Off `Show All Hierarchy` while currently in All + Hierarchy:

```text
Network available
→ transition once to All + Network
→ preserve current graph filters/disclosure
→ preserve All-Hierarchy viewport bookmark
→ use normal semantic File anchor where available
→ announce the transition concisely
```

Do not leave the UI saying:

```text
All + Hierarchy
```

while the Layout button is hidden.

If Network is unavailable:

```text
remain in All Hierarchy as session recovery
→ explain that it remains visible because Network is unavailable
```

Do not create an infinite toggle/fallback loop.

---

# 7. Returning from Focus

Current fallback derives the target All layout from `localLayoutMode`.

That would make:

```text
Focus + Hierarchy
→ All + Hierarchy
```

even when the experiment is hidden.

Change the policy:

## Experimental Off, Network available

```text
Focus + Network
→ prior All checkpoint, preferably All Network
→ otherwise All Network fallback

Focus + Hierarchy
→ prior All checkpoint, preferably All Network
→ otherwise All Network fallback
```

## Experimental On

Preserve the current intended prior-All/history behavior.

If there is no prior All checkpoint:

```text
Focus + Network
→ All Network

Focus + Hierarchy
→ All Hierarchy
```

## Network unavailable

All Hierarchy remains the fallback.

---

# 8. History behavior

Back/Forward must not visibly land on an inaccessible All-Hierarchy checkpoint when the experiment is Off.

Choose a clean deterministic strategy:

```text
skip inaccessible checkpoint
```

or:

```text
normalize it to the equivalent allowed All Network presentation and coalesce duplicate adjacent checkpoints
```

Do not require repeated Back clicks that appear to do nothing.

Preserve:

- checkpoint semantic state;
- query/filter state;
- renderer-specific viewport bookmarks;
- Focus checkpoints;
- future stack correctness.

Test:

```text
All Network
→ enable experiment
→ All Hierarchy
→ Focus Hierarchy
→ disable experiment
→ Back/Forward
```

and:

```text
persisted/history All Hierarchy checkpoint
→ experimental Off
→ no hidden-mode trap
```

The Experimental checkbox itself does not need to become graph navigation history.

---

# 9. Navigation entry-point inventory

Search current production code for every route that can activate internal `structure` mode.

At minimum inspect:

- Layout button;
- hydration;
- history traversal;
- `exitFocusToAll`;
- exact Search navigation;
- breadcrumb navigation;
- Inspector actions such as `Open full hierarchy`;
- live Focus-root removal;
- All-Network load failure;
- Focus-Network load failure;
- direct callbacks in tests.

Document the inventory in code comments/tests or final report.

## Exact Heading/Block navigation while experiment is Off

Current All-Network navigation may open All Hierarchy for a Heading/Block target.

When All Hierarchy is hidden, route exact structural targets through the supported local experience:

```text
All Network
→ Focus + Hierarchy on the containing File
→ reveal/select/center the exact Heading or Block
```

Reuse current Focus entry/navigation planners.

Do not invent a second projection path.

## Explicit “Open full hierarchy”

A user-visible action whose semantics specifically mean whole-vault Hierarchy must be hidden or unavailable when the experiment is Off.

Do not let it bypass the gate.

Focus + Hierarchy remains reachable through the normal Focus/Layout controls.

When the experiment is On, existing All-Hierarchy actions may remain.

## Failure recovery

All-Hierarchy recovery paths remain allowed when Network cannot load.

Use clear fallback copy rather than calling a failed mode successful.

---

# Product decision 2 — collision-free current Hierarchy baseline

Before implementing future File modules, the current renderer must satisfy:

```text
immediate Focus-Hierarchy seed:
zero node-rectangle overlaps

adopted Dagre layout + diagnostics:
zero node-rectangle overlaps

fallback layout:
zero node-rectangle overlaps
```

“Overlap” means positive-area intersection between rendered node rectangles, with a small documented visual clearance where selection/focus outlines require it.

Touching boundaries are not an overlap.

---

# 10. Reproduce and classify the reported Synthetic Sample issue first

Do not assume one cause.

Use the bundled Synthetic Sample, including:

```text
Source.md
folder-a/Note.md
folder-b/Note.md
[[Note]] ambiguity
../Outside invalid target
attachment diagnostics
```

Reproduce in:

```text
All + Hierarchy
→ temporarily enable Experimental setting

Focus + Hierarchy
→ focus Source.md or the relevant candidate File
```

Inspect separately:

1. immediate seed before worker adoption;
2. final Dagre-adopted layout;
3. selected state;
4. ambiguous diagnostic selected state;
5. ordinary unselected state.

Classify every apparent overlap as one of:

```text
A. actual entity rectangle overlap
B. actual diagnostic/entity overlap
C. actual diagnostic/diagnostic overlap
D. selection/focus/group decorative outlines extending over nearby cards
E. one card with layered borders that merely resembles a duplicate node
F. label ambiguity rather than geometry
```

Use layout coordinates/dimensions and browser `getBoundingClientRect()` where needed.

Do not “fix” an outline illusion by randomly increasing Dagre spacing.

Record the actual cause(s) in the final report.

No private-vault data or screenshots should be committed.

---

# 11. Add a shared rectangle-geometry utility

Add a small renderer-owned pure geometry seam, conceptually:

```ts
interface PositionedNodeRectangle {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

findRectangleOverlaps(rectangles, clearance?): readonly OverlapPair[]
```

Requirements:

- deterministic pair ordering;
- finite dimensions/positions required;
- positive-area overlap detection;
- optional non-negative clearance;
- no dependency;
- reusable by seed/final-layout tests and diagnostic placement;
- no source/private labels in errors/metrics.

For large inputs, avoid an unnecessarily pathological implementation.

A simple sorted sweep or bounded spatial index is preferable. Focus graphs are bounded, but do not add an obvious repeated `O(n²)` production scan on every interaction without evidence.

Tests may use exhaustive pair checks as an oracle.

---

# 12. Dimension-aware immediate seed

Replace fixed center-to-center `LANE_GAP = 64` placement.

Preserve the existing coarse depth-assignment behavior in HIER0; do not redesign semantic ranks yet.

For each depth column:

```text
column width
= maximum actual node width in that column

column x
= previous column x
+ previous column width
+ horizontal clear gap
```

Within each column:

```text
total packed height
= sum(actual node heights)
+ vertical clear gap × (count - 1)

place nodes deterministically
using actual rectangle heights
center the packed column around its local origin
```

Root requirements:

```text
root remains normalized at (0, 0)
same input → same seed
all mapped nodes covered exactly once
all coordinates finite
```

The clear gap should account for:

- card borders;
- focus/selection outlines;
- diagnostic status outlines;
- disclosure controls.

Do not use CSS-measured runtime sizes; mapped fixed dimensions are already the layout contract.

Complexity target:

```text
O(nodes + edges + deterministic sorting)
```

No worker is needed for the immediate seed.

---

# 13. Diagnostic placement after Dagre

Current final layout excludes diagnostics from Dagre and places them afterward without global collision reservation.

Keep diagnostics outside the Dagre input in HIER0, but replace placement with a deterministic collision-aware pass.

Requirements:

1. entity rectangles from Dagre become occupied space;
2. diagnostics are processed in deterministic ID/source order;
3. each diagnostic starts near its source;
4. candidate placements are tested against occupied entity and diagnostic rectangles;
5. placement advances through a deterministic local lane/grid until clear;
6. every accepted diagnostic is added to occupied space;
7. no infinite/unbounded search;
8. missing-source diagnostics use a deterministic fallback region;
9. final positions remain finite and complete.

For `local-structured`, prefer keeping diagnostics near the source and generally outward/right under the current visual grammar.

For `structure`, preserve current top-to-bottom character as much as possible.

Do not build the future per-File diagnostic shelf/module system yet.

This is a safe baseline collision pass, not the HIER3 design.

---

# 14. Validate Dagre entity output separately

Dagre should already avoid overlaps among the entity rectangles it receives.

Add an oracle test:

```text
computeDagreLayout(...)
→ apply entity positions
→ no entity/entity overlaps
```

If actual entity overlap is reproduced:

- verify the input dimensions;
- verify coordinates are interpreted as top-left rather than centers;
- verify cache fingerprint dimensions;
- verify the worker result matches current input;
- only then make the smallest spacing/config correction.

Do not change rank semantics, edge weights, or direction merely to conceal a dimension bug.

---

# 15. Fallback grid

Audit `fallbackRendererGraph()` with mixed current dimensions.

Its fixed grid steps must guarantee no overlap for:

```text
extended cards
compact cards
diagnostics
```

If current `280 × 170` spacing already satisfies the maximum fixed dimensions plus clearance, add explicit tests and leave it unchanged.

If not, derive the steps from measured maximum dimensions.

Do not redesign fallback layout aesthetics.

---

# 16. Decorative visual overlap

If the reported “two Note cards overlapping” is partly or entirely caused by layered:

```text
selection
Focus root
Visual Group accent
ambiguous-candidate emphasis
```

then adjust the decoration only after rectangle classification.

Requirements:

- one node must not visually impersonate two stacked nodes;
- Focus root remains obvious;
- selection remains obvious;
- ambiguous candidates remain identifiable;
- Visual Groups remain independent;
- no meaning depends only on color;
- decoration should remain inside reserved clearance where practical.

Do not remove useful states to make the screenshot cleaner.

Add component/browser regression evidence for the exact state combination.

---

# Product decision 3 — compact duplicate File disambiguation

In compact schematic cards:

```text
unique File
→ Note

duplicate filename
→ Note · folder-a
→ Note · folder-b
```

Use the already-computed shortest unique parent suffix.

Do not add a second duplicate-name algorithm.

---

# 17. Compact card rendering

Current `EntityFlowNode.data.detail` already contains the shortest unique parent suffix for duplicate documents.

For:

```text
visualVariant = compact-schematic
entityKind = document
detail != null
```

render a compact inline or tightly integrated disambiguator.

Preferred:

```text
Note · folder-a
```

A two-line compact fallback is acceptable only if measured readability requires it.

Requirements:

- unique documents stay title-only;
- duplicate documents show minimum unique folder context;
- full source path remains in native title/ARIA;
- long suffixes truncate with ellipsis rather than resize layout unpredictably;
- fixed node dimensions remain unchanged in HIER0 unless measured clipping makes a tiny documented adjustment necessary;
- Heading/Block compact detail behavior remains unchanged;
- Focus extended cards remain unchanged.

Use accessible punctuation/copy that screen readers can understand.

Do not change canonical titles or paths.

---

# 18. Synthetic duplicate-name oracle

Use the existing fixture:

```text
folder-a/Note.md
folder-b/Note.md
```

Required visible outputs:

```text
Note · folder-a
Note · folder-b
```

or the exact selected compact equivalent.

Also test:

```text
root/Note.md
folder/Note.md
nested/a/Note.md
nested/b/Note.md
```

to ensure shortest unique suffix behavior remains correct.

Do not display the full path when one parent segment is enough.

---

# 19. Cache and stale-result safety

Seed geometry changes and any final placement changes affect exact coordinates.

Review:

```text
LOCAL_STRUCTURED_LAYOUT_VERSION
localStructuredLayoutFingerprint
LocalStructuredLayoutCache
worker adoption
```

If the cached coordinate meaning changes, bump the private layout version so stale page-lifetime entries cannot be reused.

The fingerprint must continue to include:

```text
node IDs
fixed dimensions
edge IDs/endpoints/kinds
```

Do not persist raw coordinates.

No view-state schema change.

All worker results must remain latest-input-only.

---

# 20. Operation-count expectations

## Experimental checkbox, inactive All Network / Focus

```text
0 projection
0 layout
preference write only
```

## Enable experimental mode

```text
0 projection/layout until user chooses All Hierarchy
```

## Disable while All + Hierarchy active

```text
1 normal switch to All Network
no workspace/KG10 work
```

## Seed

```text
synchronous bounded deterministic preparation
no blank scene
no worker wait
```

## Diagnostic collision placement

```text
runs only when adopting a new Hierarchy layout
not on hover/selection/pan/zoom
```

## Duplicate label rendering

```text
mapping/render only
no projection/layout change
```

Hover, selection, Inspector, pan and zoom must still cause:

```text
0 projection
0 layout
```

---

# 21. Performance checks

Run existing small/medium local-renderer and general renderer benchmarks.

Record separately where practical:

```text
seed construction
Dagre worker compute
diagnostic collision placement
result adoption
```

No new CI timing thresholds.

HIER0 should not materially worsen bounded Focus layout.

Stress-test collision placement with:

```text
one source + many diagnostics
many sources + diagnostics
mixed card sizes
```

The main thread must remain responsive.

---

# 22. Accessibility

## Experimental control

- checkbox has explicit label;
- description clarifies Focus Hierarchy remains normal;
- disclosure has `aria-expanded`;
- Settings focus order remains logical;
- disabling while active announces the resulting layout.

## Layout controls

- hidden All-Hierarchy button is removed from tab order;
- Focus-Hierarchy button remains;
- fallback Hierarchy is exposed accessibly when Network fails;
- All experimental Hierarchy has clear experimental accessible context.

## Duplicate cards

Accessible name must distinguish:

```text
File Note, folder-a/Note.md
File Note, folder-b/Note.md
```

even if visual text truncates.

No new keyboard regression in React Flow.

---

# 23. Tests

## Preferences

Cover:

```text
no stored record
old v1 record without experimental field
field true
field false
invalid field
storage read failure
storage write failure
saving another preference preserves experimental flag
```

## Exploration controls

Cover:

```text
All + experiment Off → Network only
All + experiment On → Network + Hierarchy
Focus + experiment Off → Network + Hierarchy
All Network failure → Hierarchy fallback
accessible names/pressed states
```

## GraphExplorer integration

Cover:

```text
hydrated All Hierarchy + Off → All Network
hydrated All Hierarchy + On → All Hierarchy
disable while active
enable while inactive
return Focus Hierarchy → All Network when Off
return Focus Hierarchy → prior All checkpoint
history Back/Forward skips/normalizes hidden mode
live Focus-root deletion
All Network load failure fallback
Search Heading/Block navigation with experiment Off
explicit full-hierarchy action gated
```

## Seed geometry

Cover:

```text
mixed 80/72/64/94 heights
multiple nodes in one column
multiple columns
root normalized
determinism
finite complete positions
zero overlap with clearance
```

Include a regression that fails under the old 64-pixel center spacing.

## Final geometry

Cover:

```text
Dagre entities alone do not overlap
one source with many diagnostics
diagnostic near neighboring entity
diagnostic/diagnostic collision
missing diagnostic source
determinism
zero overlap after placement
```

## Fallback

Cover all current fixed dimensions and visual variants.

## Presentation

Cover:

```text
unique compact File → no suffix
duplicate compact Files → shortest unique suffix
extended Focus cards unchanged
Heading/Block compact behavior unchanged
ARIA/full path
```

## Synthetic browser regression

Use the existing bundled sample and explicitly verify the two `Note` candidates.

---

# 24. Browser QA

Production browser QA must include:

```text
DEFAULT GATE
launch Synthetic Sample
Scope All shows Network only
Focus shows Network + Hierarchy
Settings → Experimental collapsed at end

EXPERIMENT
enable Show All Hierarchy
Hierarchy button appears in All
open All Hierarchy
disable while active
returns safely to All Network
reload persistence true/false

NAVIGATION
Heading/Block Search from All while Off
Inspector/breadcrumb structural navigation
Focus Hierarchy → Back to All
Back/Forward with prior All-Hierarchy checkpoint

FAILURE
simulate All Network unavailable
All Hierarchy remains recoverable without persisting experiment On

GEOMETRY
Synthetic immediate seed
worker-refined layout
Source / ambiguous Note candidates
diagnostics
selected/Focus/Visual Group state combinations
no rectangle overlap

LABELS
Note · folder-a
Note · folder-b
full accessible/title context

RESPONSIVE
short Settings window
narrow graph
maximized graph
clean console
```

To inspect the immediate seed, use a deterministic delayed/fake worker in tests or an explicit development instrumentation path. Do not rely on visually catching a one-frame transition.

---

# 25. Release Tauri QA

Use the current optimized release executable.

Check:

```text
experimental preference persistence across restart
All + Hierarchy hidden by default in a clean preference profile
Focus + Hierarchy remains available
enable/disable behavior
Synthetic Sample overlap/disambiguation
real pointer/keyboard disclosure
Network touchpad behavior unchanged
VISUAL1A behavior unchanged
live vault update while Focus Hierarchy is open
clean normal runtime console where available
```

Do not use a private vault for destructive tests.

Do not write to Markdown files solely for this gate unless using a disposable synthetic vault.

---

# 26. Documentation

Update current documentation minimally and truthfully, likely:

```text
apps/web/README.md
apps/web/src/components/README.md
packages/renderer-reactflow/README.md
docs/ARCHITECTURE.md
docs/PRODUCT_QUALITY_AUDIT.md
```

Document:

```text
All + Hierarchy
→ retained experimental whole-vault presentation
→ hidden by default
→ emergency fallback when All Network cannot load

Focus + Hierarchy
→ normal supported local structural presentation

HIER0
→ collision-free baseline only
→ not the future File-module redesign
```

Record the actual Synthetic overlap classification and fix.

Do not create a new ADR unless implementation reveals a genuinely durable architectural decision beyond the approved product gate.

Do not restore/recreate or modify `docs/ROADMAP.md` as part of this task.

Archive this exact prompt under:

```text
history-implementations/HIER0_experimental_all_hierarchy_gate_collision_baseline_codex_prompt.md
```

---

# Likely files

Inspect current code first. Likely areas:

```text
apps/web/src/components/ExplorationControls.tsx
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/exploration-model.ts
apps/web/src/preferences/graph-preferences.ts
apps/web/src/App.css

packages/renderer-reactflow/src/local-structured-layout.ts
packages/renderer-reactflow/src/layout.ts
packages/renderer-reactflow/src/mapping.ts
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/styles.css
packages/renderer-reactflow/src/geometry.ts          (possible new)
packages/renderer-reactflow/src/*tests*

apps/web/src/sample-report.json                      (read only; do not alter to hide issue)
```

Do not touch parser/resolver/canonical semantics.

Do not modify Dagre dependency/version.

---

# Explicitly out of scope

Do not implement:

- HIER1 Focus Schematic model;
- File modules;
- incoming Files left / outgoing Files right;
- hop-ranked module columns;
- folder bands or Hierarchy folder clustering;
- secondary-links toggle;
- layout-backbone selection;
- per-File internal Dagre;
- compound Dagre;
- edge waypoints/obstacle routing;
- custom macro layout;
- Evolving Network;
- All-Hierarchy deletion;
- new renderer;
- view-state schema v4;
- source writes;
- KG14B4 or VISUAL1B work.

Do not tune generic Dagre aesthetics beyond a minimal verified collision/dimension correction.

---

# Suggested implementation sequence

1. Sync current `main`; inspect open PRs and user-owned worktrees.
2. Reproduce the Synthetic Sample issue before modifying code.
3. Record whether the overlap is seed, final geometry, diagnostics, or decoration.
4. Add pure experimental-availability policy and tests.
5. Extend graph preferences with the backward-compatible default-Off flag.
6. Add Settings → Experimental disclosure at the end.
7. Gate `ExplorationControls` in All while preserving Focus Hierarchy.
8. Inventory and gate every internal All-Hierarchy entry path.
9. Normalize hydration, history, Focus exit, live recovery and failure fallback.
10. Route exact Heading/Block navigation to Focus Hierarchy when the experiment is Off.
11. Add rectangle geometry/collision utility.
12. Replace fixed seed lane/rank spacing with dimension-aware packing.
13. Add collision-aware final diagnostic placement.
14. Validate fallback-grid clearance.
15. Fix decorative overlap only if reproduction proves it contributes.
16. Render shortest unique folder suffix for compact duplicate File cards.
17. Bump private local-layout cache version if coordinate semantics changed.
18. Run focused tests and geometry oracles.
19. Run small/medium renderer benchmarks.
20. Run production browser QA.
21. Build and run release Tauri QA.
22. Update docs; do not touch ROADMAP.
23. Archive this exact prompt.
24. Integrate latest `main` if concurrent work changed relevant files.
25. PR → CI → merge → post-merge CI → task cleanup.
26. Stop. Do not begin HIER1 automatically.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

Add task-specific deterministic geometry checks rather than claiming visual overlap correctness from screenshots alone.

No new CI timing threshold.

---

# Exit gate

HIER0 is complete only when:

1. All + Hierarchy implementation still exists.
2. All + Hierarchy is hidden by default.
3. Focus + Hierarchy remains normally available.
4. Settings contains a final collapsed Experimental section.
5. Experimental contains `Show All Hierarchy`.
6. the setting defaults Off.
7. the setting persists in existing graph-preferences storage.
8. old preference records load with Off.
9. malformed field values fall back safely.
10. saving other graph preferences preserves the field.
11. no view-state schema change occurs.
12. no graph-preference storage-key bump occurs.
13. enabling reveals All-Hierarchy control without changing layout.
14. enabling causes zero eager All-Hierarchy projection/layout work.
15. disabling while active returns to All Network when available.
16. disabling while inactive causes zero graph work.
17. Network failure still exposes All Hierarchy as recovery.
18. recovery does not persistently enable the experiment.
19. All scope with experiment Off exposes Network only.
20. Focus scope always exposes Network and Hierarchy.
21. hidden All Hierarchy cannot be reached through Layout controls.
22. hidden All Hierarchy cannot be reached accidentally through Search.
23. exact Heading/Block navigation uses Focus Hierarchy when Off.
24. explicit full-hierarchy actions respect the gate.
25. hydration of hidden All Hierarchy normalizes safely.
26. Back/Forward never visibly stalls on hidden checkpoints.
27. Focus Hierarchy returns to prior/available All Network when Off.
28. live Focus-root deletion uses an available safe All mode.
29. all internal `structure` activation paths were inventoried.
30. Synthetic overlap was reproduced and classified before fixing.
31. immediate Focus-Hierarchy seed uses actual node dimensions.
32. seed horizontal spacing cannot overlap adjacent columns.
33. seed vertical spacing cannot overlap mixed-height rows.
34. seed remains deterministic.
35. seed remains complete and finite.
36. root remains normalized at `(0, 0)`.
37. seed overlap oracle reports zero pairs.
38. Dagre entity output overlap oracle reports zero pairs.
39. diagnostic placement collision-checks occupied entities.
40. diagnostic placement collision-checks prior diagnostics.
41. many diagnostics from one source remain collision-free.
42. missing-source diagnostics are deterministic and collision-free.
43. final adopted graph overlap oracle reports zero pairs.
44. fallback layout is proven collision-free for current dimensions.
45. decorative outline overlap is corrected if reproduction identifies it.
46. Focus/selection/group/ambiguity semantics remain visible.
47. duplicate compact File cards show shortest unique folder context.
48. `folder-a/Note.md` and `folder-b/Note.md` are visually distinguishable.
49. unique compact Files remain title-only.
50. extended Focus cards remain unchanged.
51. full paths remain accessible.
52. resolver ambiguity remains unchanged.
53. Synthetic Sample is not altered to remove the test case.
54. local layout cache cannot reuse stale coordinate semantics.
55. hover/selection/pan/zoom still cause zero layout work.
56. no File-module/folder-band redesign begins.
57. no Dagre dependency change occurs.
58. no new external dependency is added.
59. focused renderer tests pass.
60. focused web tests pass.
61. full `pnpm check` passes.
62. desktop check/build pass.
63. renderer benchmarks complete without material unexplained regression.
64. production browser QA passes.
65. release Tauri QA passes.
66. Network touchpad behavior remains unchanged.
67. VISUAL1A remains unchanged.
68. PR #51/concurrent work is not disturbed.
69. current `AGENTS.md` and unrelated user files remain untouched.
70. ROADMAP is not restored/recreated/modified.
71. prompt is archived exactly.
72. PR CI passes.
73. post-merge CI passes.
74. task branch/worktree cleanup completes.
75. HIER1 is not started automatically.

---

# Final report

## 1. Summary

State the final product exposure:

```text
All
→ Network by default
→ Hierarchy only when Experimental is enabled or needed as failure recovery

Focus
→ Network | Hierarchy
```

## 2. Experimental preference

Storage compatibility, default, Settings UI and failure behavior.

## 3. Mode-availability policy

Hydration, controls, Search/navigation, history, Focus exit, live recovery and Network failure.

## 4. Synthetic overlap diagnosis

State exactly which rectangles/decorations overlapped and in which phase:

```text
seed
Dagre-adopted
diagnostic placement
CSS decoration
```

Do not claim causes that were not measured.

## 5. Seed correction

Dimension-aware rank/lane packing and complexity.

## 6. Final diagnostic placement

Collision strategy and determinism.

## 7. Geometry evidence

Overlap pair counts for seed, final and fallback.

## 8. Duplicate File labels

Show:

```text
Note · folder-a
Note · folder-b
```

and explain reuse of shortest unique suffix.

## 9. Cache/performance

Version/fingerprint changes and benchmark evidence.

## 10. Accessibility / responsive QA

## 11. Tests / browser / Tauri QA

## 12. Files changed

## 13. Dependencies

Expected external additions:

```text
zero
```

## 14. Concurrent/user-owned work

Confirm PR #51, AGENTS, unrelated files/worktrees and ROADMAP state were preserved.

## 15. Follow-up

State:

```text
HIER0 complete
HIER1 — Focus Schematic model + quality harness — next
```

Do not implement HIER1 automatically.
