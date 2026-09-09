# VISUAL1C — Separate Network Layout Physics from Presentation Controls

**Task type:** renderer architecture cleanup / bug fix / performance refactor / settings-semantics correction

## Goal / success outcome

Separate **All + Network layout geometry** from **All + Network visual presentation**.

Today, several settings that only change appearance can still invalidate the Global layout and cause another ForceAtlas2 run.

The corrected product contract should be:

```text
LAYOUT / GEOMETRY
- Reference pull
- Folder clustering On/Off
- Folder clustering strength
- spacing / within-folder spacing
- folder separation / between-folder spacing

→ may request ForceAtlas2 / folder-prior layout
→ may change coordinates
→ may change layout fingerprint/cache
```

```text
PRESENTATION
- Base node size
- Link influence on node size
- Link thickness
- Label threshold

→ Sigma presentation refresh only
→ 0 ForceAtlas2 requests
→ 0 coordinate changes
→ 0 layout-cache invalidation
```

The recently corrected VISUAL1B per-File Size behavior is the architectural reference:

```text
automatic/layout node information
        ↓
Sigma presentation
        ↓
optional per-File multiplier
```

VISUAL1C should generalize that separation to the **global visual controls**, without undoing the current individual-size fix.

Success is recognizable when:

```text
Base node size slider moves
→ nodes change radius
→ graph stays exactly where it is

Link influence slider moves
→ degree-driven visual prominence changes
→ graph stays exactly where it is

Link thickness slider moves
→ edges change thickness
→ graph stays exactly where it is

Label threshold moves
→ label visibility changes
→ graph stays exactly where it is
```

while:

```text
Reference pull / folder spatial settings
→ still trigger the intended layout work
```

Do not implement local collision avoidance or SPATIAL1 in this task.

---

# Current evidence

Inspect the actual current branch/main before changing code. Newer merged/concurrent work outranks this prompt.

At plan-writing time, the relevant implementation shows:

## 1. Broad app-level relayout trigger

`GraphExplorer.tsx` currently has a generic Global-settings update path conceptually equivalent to:

```ts
setGlobalLayoutSettings(settings)

if (All + Network is active) {
  setGlobalLayoutRequestKey(current => current + 1)
}
```

This does not distinguish:

```text
Reference pull
```

from:

```text
Label threshold
```

even though only the former changes layout physics.

## 2. Visual settings are mixed into Global mapping

`packages/renderer-sigma/src/mapping.ts` currently resolves the complete `GlobalLayoutSettings` and uses visual fields directly while creating `GlobalRendererInput`.

Examples:

```text
nodeSize
referenceDegreeSizeInfluence
→ mapped node attributes.size

linkThickness
→ mapped edge attributes.size
```

So purely visual changes can rebuild mapped graph attributes before layout is even considered.

## 3. Global layout request/fingerprint receives too much state

`createGlobalLayoutRequest(...)` currently copies node `attributes.size`.

`globalLayoutFingerprint(...)` currently fingerprints:

```text
the full validated GlobalLayoutSettings
+
node.size
+
folderKey
+
topology/edge weights
```

This means visual fields can invalidate the layout cache even when the worker physics does not use them.

## 4. ForceAtlas2 currently does not use rendered node radius as collision physics

The current Global ForceAtlas2 call uses spatial values such as:

```text
linkForce
withinFolderSpacing / scalingRatio
folder prior settings
```

and does not enable:

```text
adjustSizes: true
```

Therefore:

```text
Base node size
Link influence on node size
```

are not currently meaningful ForceAtlas2 collision inputs.

Do not change this by enabling `adjustSizes`.

The product decision is that these controls remain visual-only.

## 5. Link thickness is not a layout force

Current mapped edge `size` is visual.

The Global layout request derives ForceAtlas2 edge weight from:

```text
referenceCount
```

not rendered link thickness.

So changing `Link thickness` should not rerun layout.

## 6. Label threshold already has a presentation-oriented seam

The Sigma session already updates:

```text
labelRenderedSizeThreshold
```

and refreshes the renderer.

The outer app still needs to stop treating the same setting change as a reason to request layout.

## 7. VISUAL1B already created a good render-only size path

The current per-File size implementation now:

- keeps Graphology/layout automatic size separate;
- applies `sizeScale` inside Sigma node style/reducer logic;
- refreshes affected nodes with correct indexation;
- does not submit ForceAtlas2;
- preserves coordinates;
- handles topology/style-refresh races.

Reuse/generalize this architecture where appropriate.

Do not regress it.

---

# Scope / non-scope

## In scope

- explicitly separate Global spatial/layout settings from visual settings;
- prevent visual settings from invalidating Global layout;
- make Base node size render-only;
- make Link influence on node size render-only;
- make Link thickness render-only;
- keep Label threshold render-only end-to-end;
- preserve the exact current visual formulas/semantics where possible;
- preserve per-File VISUAL1B Size composition;
- preserve folder clustering and real spatial controls;
- preserve current graph-preferences persistence format if practical;
- add operation-count and coordinate-stability regression tests;
- audit features that consume node/edge display size so they remain correct;
- update docs and implementation history;
- browser/release QA.

## Explicitly out of scope

Do not implement:

```text
adjustSizes: true
node collision physics
local overlap resolution
no-overlap plugin
SPATIAL1
Move mode
pinning
folder-cluster offsets
Adaptive Layout
Saved Views
Hierarchy size controls
Focus Network global-appearance redesign
new QUERY1 semantics
Visual Groups redesign
```

Do not solve visual-node overlap by putting display radius back into ForceAtlas2.

Overlap resolution, if desired, is a separate future feature.

---

# Architectural target

Keep three concepts distinct:

```text
TOPOLOGY
- which nodes/edges exist
- reference counts / graph structure
- folder membership
- canonical IDs

LAYOUT
- x/y geometry
- reference attraction
- folder spatial prior
- layout cache/fingerprint

PRESENTATION
- rendered node radius
- degree-to-radius visual influence
- per-File size multiplier
- edge thickness
- label visibility
- Visual Group styling
- hover/selection styling
```

A visual setting change must not leak backward into Layout.

---

# 1. Keep persisted settings compatible, derive narrower internal views

Do not redesign user preferences merely for conceptual purity.

Current persistence may continue to store one:

```ts
GlobalLayoutSettings
```

object under the existing graph-preferences record.

Internally, derive two explicit semantic subsets.

Conceptually:

```ts
interface ResolvedGlobalSpatialSettings {
  folderClustering: boolean
  linkForce: number
  folderCohesion: number
  withinFolderSpacing: number
  betweenFolderSpacing: number
}

interface ResolvedGlobalVisualSettings {
  nodeSize: number
  referenceDegreeSizeInfluence: number
  linkThickness: number
  labelThreshold: number
}
```

Exact names/types can follow repository conventions.

The important point is:

```text
persisted compatibility object
        ↓
derive spatial subset
derive visual subset
```

rather than:

```text
everything in persisted settings
→ layout fingerprint
```

No view-state schema change.

Avoid bumping the graph-preferences storage version unless current code proves a real migration requirement.

---

# 2. Define an explicit spatial signature/equality contract

Create one pure function that answers:

```text
Did anything that actually affects Global coordinates change?
```

Conceptually:

```ts
resolveGlobalSpatialSettings(settings)

globalSpatialSettingsEqual(previous, next)
```

or:

```ts
globalSpatialSettingsFingerprint(settings)
```

It must include only real spatial inputs.

At minimum:

```text
folderClustering
linkForce
folderCohesion
withinFolderSpacing
betweenFolderSpacing
```

Do not include:

```text
nodeSize
referenceDegreeSizeInfluence
linkThickness
labelThreshold
```

UI concepts such as `spacingPreset` should affect layout only insofar as they resolve to different spatial values.

If two persisted settings objects resolve to identical spatial physics, they should not require a new layout solely because their UI representation differs.

---

# 3. Fix GraphExplorer's broad relayout trigger

Update the Global-settings change path.

Desired:

```text
receive next GlobalLayoutSettings
        ↓
always update/persist preference state
        ↓
compare previous spatial subset vs next spatial subset
        ↓
spatial changed?
    yes → request Global relayout if active/appropriate
    no  → do not increment Global layout request key
```

A visual-only settings change must produce:

```text
0 globalLayoutRequestKey increments
0 layout-worker submissions
```

Preserve any explicit user action whose purpose is:

```text
Relayout
Reset layout
```

if such actions intentionally force a new solve.

Do not make request-key semantics depend on which slider component fired the change.

The spatial-vs-visual distinction belongs in domain/helper logic, not UI event-name conditionals.

---

# 4. Remove visual fields from the Global worker/layout contract

Inspect `GlobalLayoutRequest`, its validator, worker runtime, and tests.

Preferred correction:

```text
Global layout worker receives only information required to calculate coordinates.
```

If proven unused by the worker physics, remove node display `size` from the layout request entirely.

At minimum, it must no longer affect:

```text
layout computation
layout validation semantics
layout fingerprint
layout cache identity
```

Likewise, the worker layout settings should be spatial-only rather than the entire visual settings object.

If changing the internal worker request shape warrants bumping an internal layout schema version, do so.

This is not persisted user data, so do not confuse an internal worker-protocol version with KG/view-state migration.

Hard regression:

```text
same topology + same spatial settings + different visual settings
→ identical layout request/fingerprint
```

---

# 5. Keep topology-derived degree information, move final automatic radius to presentation

Do not naively move the entire degree scan into Sigma's reducer.

Current mapping already traverses projected reference edges to derive reference degree.

Keep that topology work out of the hot visual path.

Prefer precomputing a topology-only metric such as:

```text
referenceDegree
```

or, even better if it preserves exact current behavior:

```text
referenceDegreeSizeBasis
```

where the expensive/compressed part can be calculated once per topology.

Example conceptual split:

```text
MAPPING / TOPOLOGY

degree
→ log/compressed degree basis
→ store basis on node attributes
```

then:

```text
PRESENTATION

display automatic size
=
baseNodeSize
+
scale(degreeBasis, linkInfluence)
```

then VISUAL1B:

```text
final displayed size
=
automatic displayed size
× optional per-File multiplier
→ clamp
```

The exact current degree-size curve should remain visually compatible.

Do not change the meaning of the 0–100 Link influence control while doing this refactor.

---

# 6. Diagnostic-node size must remain coherent

Current Global diagnostic/reference-target nodes scale from Base node size.

Do not accidentally make:

```text
Base node size
```

affect Files but stop affecting diagnostic nodes.

Preserve the existing relative diagnostic sizing rule unless evidence supports a deliberate product change.

For example, if current semantics are roughly:

```text
diagnostic size = base node size × 0.62
```

keep that relationship in the presentation layer.

Diagnostics must remain visually subordinate and bounded.

---

# 7. Move Link thickness to the edge presentation reducer

Current edge mapping computes rendered thickness using:

```text
global linkThickness
× function(referenceCount)
```

Then the style layer applies another LOD multiplier.

Preserve this composition, but move the user-controlled visual thickness out of topology/layout mapping.

Preferred:

```text
TOPOLOGY
edge.referenceCount
edge.status
edge semantic color/base identity

PRESENTATION
referenceCount
× global Link thickness
× current LOD multiplier
= displayed edge width
```

Do not change ForceAtlas2 edge weight:

```text
layout edge weight
= semantic/reference count behavior
```

Changing Link thickness must cause:

```text
0 layout requests
0 coordinate changes
```

---

# 8. Preserve Label threshold semantics using the effective displayed node size

Current label visibility depends partly on node size and LOD.

After the refactor, ensure labels use the **actual final displayed size**, including:

```text
global Base node size
global Link influence
per-File VISUAL1B multiplier
```

where current product behavior expects size-based label visibility.

Do not accidentally compare the threshold against a stale layout/base radius.

Preserve:

```text
hover/selected force-label behavior
small-graph always-show-label behavior
LOD rules
Sigma labelRenderedSizeThreshold behavior
```

Audit whether both:

```text
custom reducer label suppression
Sigma's labelRenderedSizeThreshold
```

are intentionally needed.

Do not create contradictory double thresholds.

---

# 9. Introduce a Global visual-settings session update path

Generalize the existing render-only VISUAL1B/session architecture.

Conceptually:

```ts
session.setVisualSettings(resolvedVisualSettings)
```

or equivalent.

It should update:

```text
Base node size
Link influence
Link thickness
Label threshold
```

without layout.

The session should compare previous/next visual settings and determine what needs refreshing.

Examples:

## Label threshold only

```text
update Sigma label setting
refresh label/render state
no graph-wide size indexation if unnecessary
```

## Base size / Link influence

```text
all visible node radii may change
→ refresh/re-index relevant node display data
→ no layout
```

## Link thickness

```text
all visible edge widths may change
→ refresh relevant edge display/index data if required
→ no layout
```

Do not copy `skipIndexation: true` blindly.

Node radius and possibly edge width can affect picking/index data.

Use Sigma 3.0.3's narrowest correct refresh path.

---

# 10. Coalesce rapid global visual-slider updates

Unlike per-File Size, a global visual slider can affect thousands of visible nodes.

Do not re-index the entire graph synchronously for every raw pointer event if it causes unnecessary work.

Preferred pattern:

```text
slider state/value updates immediately
        ↓
latest visual settings stored
        ↓
coalesce renderer visual refresh to next animation frame
        ↓
one latest all-node/edge refresh
```

This is visual coalescing, not a debounce that delays the UI value.

Hard requirement:

```text
no ForceAtlas2
```

Do not add a generic debounce dependency.

Measure before adding complexity; if current Sigma refresh is already sufficiently cheap, keep implementation simpler.

---

# 11. No performance tax when sliders are untouched

The architecture should not introduce an ongoing background task merely because visual size is now resolved later.

Do not:

```text
recompute degree by scanning edges every frame
```

Do not:

```text
run timers/watchers continuously
```

Do not:

```text
rebuild graph topology on every render
```

A normal Sigma reducer may perform a few cheap arithmetic operations and lookups while Sigma processes/renders a node.

That is acceptable.

Prefer precomputed topology-only size basis so the presentation step is approximately:

```text
base
+ cheap influence scaling
× optional sparse per-File multiplier
```

No meaningful idle-session performance penalty should appear.

Add benchmark/operation evidence rather than assuming.

---

# 12. Preserve VISUAL1B individual Size composition

Current intended order:

```text
global automatic displayed size
        ↓
optional per-File multiplier
        ↓
final bounded display size
```

Do not accidentally change it to:

```text
base × multiplier + degree boost
```

unless current implementation already defines that and product evidence explicitly supports it.

The global Link influence remains automatic.

The individual File slider remains a relative multiplier.

Reset continues to remove the stored per-File override.

Per-File size must remain render-only and sparse.

---

# 13. Preserve Focus Network behavior

The controls in this task are **All + Network Global settings**.

Do not suddenly apply:

```text
Global Base node size
Global Link influence
Global Link thickness
Global label threshold
```

to Focus + Network unless current product architecture explicitly already does so.

VISUAL1B individual per-File Size continues to work in Focus + Network.

Do not modify Focus semantic File/Heading/Block sizing merely to make the implementation more uniform.

---

# 14. Visual Groups composition

Visual Groups already affect presentation styling.

Ensure:

```text
Visual Group accent
+
global visual sizing
+
per-File size override
+
hover/selection
```

compose correctly.

A global node-size refresh must not:

- discard group colors;
- reset selection;
- reset hover;
- rebuild group membership;
- cause projection work.

If Visual Group and size updates arrive around the same topology refresh, reuse/generalize the existing pending-style-refresh safety path.

---

# 15. Hover / selection / hit testing

Audit carefully.

After changing Base size or Link influence:

```text
drawn radius
=
clickable/hoverable/picking radius
```

must remain coherent.

The per-File Size correction already discovered that radius refresh cannot use color-only indexation shortcuts.

Apply the same correctness to global radius updates.

Selection/hover style refreshes should remain cheap:

```text
skipIndexation: true
```

where they do not change radius.

But a pending indexed radius refresh must not be accidentally lost because a later hover-only refresh happens.

Add a deterministic race/regression test if current harness permits.

---

# 16. Link picking / edge events

Changing Link thickness may affect edge picking if edge events are enabled.

Inspect Sigma behavior.

Do not assume edge width is purely visual from the renderer's indexing perspective.

The hard semantic rule remains:

```text
it can require Sigma re-index/process work
it cannot require ForceAtlas2 coordinate work
```

Preserve current edge-event behavior.

---

# 17. QUERY1 Hide / live topology updates

Audit:

```text
File hidden by QUERY1
File later revealed
live vault adds/removes File
live vault changes references
```

A newly visible/added node must immediately use the **current visual settings**.

A node removed during a pending visual refresh must not cause stale-repaint errors.

Current topology/style race protection from VISUAL1B/KG14 should remain intact.

Do not let a visual refresh produce:

```text
"node ... can't be repaint"
```

or stale Sigma index crashes.

---

# 18. Graph mapping/reconciliation should not happen for visual-only settings

After the refactor, changing only:

```text
Base node size
Link influence
Link thickness
Label threshold
```

should ideally cause:

```text
0 KG6 projections
0 Global mapping/topology rebuilds
0 Graphology reconciliations
0 ForceAtlas2 requests
0 coordinate writes
```

Only renderer presentation/index refresh should occur.

If one narrow mapping layer still runs for implementation reasons, justify it with measurement—but do not permit layout work.

The preferred invariant is full separation.

---

# 19. Layout fingerprint must remain sensitive to genuine geometry inputs

Do not overcorrect by making the layout cache blind to real spatial changes.

These should still invalidate/recompute layout as appropriate:

```text
Reference pull
Folder clustering On/Off
Folder clustering strength / cohesion
within-folder spacing
folder separation / between-folder spacing
topology/reference-weight changes
```

Add exact positive tests:

```text
change Reference pull
→ fingerprint changes

change Folder separation
→ fingerprint changes
```

alongside negative visual tests.

---

# 20. Explicit coordinate-stability regression tests

Use a small deterministic graph.

Capture coordinates after layout.

Then change each visual setting individually:

```text
Base node size
Link influence
Link thickness
Label threshold
```

Assert for every visible node:

```text
x before === x after
y before === y after
```

Also assert:

```text
layout-service call count unchanged
global-layout instrumentation count unchanged
```

For size-related visual changes, verify the rendered/style size did change.

For link thickness, verify rendered/style edge width changed.

For label threshold, verify label visibility behavior changed.

---

# 21. Rapid-slider regression

Apply sequences such as:

```text
Base size:
4.0 → 4.5 → 5.0 → 6.0 → 7.0

Link influence:
0 → 25 → 50 → 75 → 100

Link thickness:
0.3 → 0.6 → 1.0 → 1.5

Label threshold:
4 → 6 → 8 → 10
```

Hard invariant:

```text
0 layout requests across the entire visual sequence
coordinates unchanged
latest visual state wins
```

This is the global equivalent of the VISUAL1B per-File flicker regression.

---

# 22. Initial mount / cached layout behavior

Audit cold and warm entry into All + Network.

The current visual settings must be applied correctly on the first visible frame.

A cached layout created with the same topology/spatial settings should be reusable even when visual settings later differ.

Example:

```text
layout cached
Base node size = 4.5

user later changes Base node size = 7.0

→ reuse same cached x/y
→ render nodes at 7.0-based visual size
```

Do not create one layout-cache entry per visual configuration.

---

# 23. Persistence and spacing-preset behavior

Keep existing persisted user behavior.

Current spacing-preset logic intentionally preserves visual choices when changing:

```text
Compact / Normal / Spacious
```

Do not regress that.

Example:

```text
Link influence = 90%
Base size = 6.5

change spacing Normal → Spacious

→ spatial values change as intended
→ one layout may occur
→ Base size stays 6.5
→ Link influence stays 90%
```

The spatial change can trigger layout.

The preserved visual values should simply be applied to the resulting coordinates.

---

# 24. Settings UI

No large UI redesign is required.

The current conceptual grouping is useful:

```text
LAYOUT
Reference pull
Folder separation
...

VISUAL
Base node size
Link influence on node size
Link thickness
Label threshold
```

Preserve it.

The architecture should now finally match that UI grouping.

If helper copy is useful, keep it minimal.

Do not expose implementation terms such as:

```text
ForceAtlas2 fingerprint
Sigma reducer
indexation
```

to users.

---

# 25. Benchmark / performance evidence

Add or extend instrumentation so the final report can demonstrate:

## Visual-only changes

```text
projection count: unchanged
mapping/topology count: unchanged
layout requests: 0
Graphology coordinates: unchanged
Sigma visual refresh: yes
```

## Real layout changes

```text
Reference pull / folder spatial change
→ exactly expected layout request
```

For a medium/large synthetic graph, record:

- Base-size visual update cost;
- Link-influence visual update cost;
- Link-thickness visual update cost;
- Label-threshold update cost;
- highest main-thread/rAF gap if current performance harness supports it.

Do not create CI timing gates.

The expected outcome is that visual changes are substantially cheaper than ForceAtlas2.

---

# 26. Audit other size/thickness consumers before finalizing

Search the repository for consumers of:

```text
attributes.size
nodeSize
referenceDegreeSizeInfluence
linkThickness
labelThreshold
GlobalLayoutSettings
ResolvedGlobalLayoutSettings
```

Explicitly inspect whether the refactor affects:

- labels / semantic zoom;
- hover;
- selection;
- hit testing;
- edge picking;
- Visual Groups;
- diagnostics;
- Search centering;
- camera fit;
- Network Explorer;
- live updates;
- report loading;
- benchmarks;
- cache warmup;
- renderer measurements;
- screenshots/tests.

Do not assume renderer size is only used for drawing.

If another feature genuinely depends on **display size**, route it to the effective visual size.

If another feature genuinely depends on **layout geometry**, do not accidentally substitute the visual value.

Document any discovered dependency.

---

# Validation

Follow current `AGENTS.md`.

Expected focused/full commands, adjusted to the current repo:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

git diff --check
```

Add focused operation-count tests for:

```text
Base node size
Link influence
Link thickness
Label threshold
Reference pull
Folder separation
```

Browser QA:

```text
Synthetic Sample
→ All + Network
→ note current coordinates
→ adjust each VISUAL slider continuously
→ confirm absolutely no node motion

→ adjust Reference pull
→ confirm intended relayout

→ adjust Folder separation
→ confirm intended relayout

→ test Visual Groups
→ test per-File Size
→ test Hide/unhide
→ test Search/selection/hover
→ test reload
```

Release Tauri QA should follow the repository's current normal gate.

---

# Exit gate

VISUAL1C is complete only when:

1. persisted graph-preference compatibility is preserved;
2. explicit spatial and visual setting subsets exist internally;
3. app-level layout triggering compares spatial semantics rather than “any settings change”;
4. Base node size causes zero ForceAtlas2 requests;
5. Link influence causes zero ForceAtlas2 requests;
6. Link thickness causes zero ForceAtlas2 requests;
7. Label threshold causes zero ForceAtlas2 requests;
8. visual changes cause zero layout-cache invalidation;
9. visual changes preserve every node x/y coordinate exactly;
10. Reference pull still causes intended relayout;
11. folder clustering On/Off still causes intended spatial behavior;
12. folder strength still causes intended spatial behavior;
13. folder separation still causes intended relayout;
14. spacing presets still cause intended spatial changes;
15. Global layout worker contract contains only actual coordinate/layout inputs where practical;
16. visual node size is no longer a layout fingerprint dependency;
17. topology-derived degree work is not rescanned every render;
18. Link influence preserves the existing product curve/meaning;
19. diagnostic size still follows Base node size appropriately;
20. link thickness preserves reference-count scaling and LOD scaling;
21. labels use effective final displayed size where appropriate;
22. per-File VISUAL1B multiplier still composes correctly;
23. per-File size remains render-only;
24. Visual Group styling still composes;
25. hover/selection remain correct;
26. node hit testing matches rendered radius;
27. edge picking remains correct after Link thickness changes;
28. QUERY1 Hide remains unchanged;
29. live add/remove/reference updates remain safe;
30. no stale partial-refresh crash is introduced;
31. visual-only changes ideally cause zero Graphology reconciliation;
32. visual-only slider updates are responsive on medium/large synthetic graphs;
33. no continuous idle recomputation is introduced;
34. cached layouts are reusable across visual-setting changes;
35. spacing-preset changes preserve visual settings as before;
36. view-state schema remains unchanged;
37. no new external dependency is added unless explicitly justified;
38. focused tests pass;
39. full `pnpm check` passes;
40. desktop check/build pass;
41. relevant benchmarks pass;
42. production-browser QA passes;
43. release Tauri QA passes if required;
44. docs are updated;
45. prompt/status is archived under `history-implementations/`;
46. PR CI passes;
47. post-merge CI passes;
48. task branch/worktree cleanup completes.

---

# Final report

Report:

## 1. Summary

Confirm the final separation:

```text
spatial settings → layout
visual settings  → Sigma presentation
```

## 2. Root cause

Explain how the old full-settings dependency caused visual controls to invalidate Global layout.

## 3. Internal contracts

Describe the persisted compatibility object and the derived:

```text
spatial settings
visual settings
```

## 4. Layout fingerprint / worker protocol

State exactly which fields now determine coordinates/cache identity.

## 5. Node sizing

Explain:

```text
topology degree basis
+ global visual size rules
× individual VISUAL1B multiplier
```

and confirm no repeated degree scan in the render hot path.

## 6. Edge thickness / labels

Explain their final presentation-only ownership.

## 7. Other-feature audit

Report findings for:

- hit testing;
- labels;
- Visual Groups;
- hover/selection;
- diagnostics;
- Hide/query;
- live updates;
- cache/warm start;
- camera/Search;
- any other size consumer found.

## 8. Operation-count evidence

For each slider:

```text
Base node size
Link influence
Link thickness
Label threshold
Reference pull
Folder separation
```

report whether a layout request occurred.

Expected:

```text
visual four → 0
spatial controls → intended layout
```

## 9. Performance

Report visual-refresh cost and relevant main-thread evidence.

## 10. Tests / browser / Tauri QA

## 11. Files changed

## 12. Dependencies

Expected additions: zero.

## 13. Remaining future work

Keep separate:

```text
local overlap resolution for very large visual nodes
SPATIAL1
Adaptive Layout
Saved Views
```

Do not implement them automatically.
