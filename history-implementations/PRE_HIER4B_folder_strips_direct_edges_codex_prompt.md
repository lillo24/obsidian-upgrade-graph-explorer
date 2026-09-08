# PRE-HIER4B — Restore Visible Folder Strips + Direct Connection Style in Modular Focus Hierarchy

**Task type:** UI/renderer correction / Sandbox preference wiring / regression fix before HIER4B

## Goal

Correct two product requirements that were accidentally dropped during HIER4A final production integration.

The actual Modular Focus Hierarchy now has the correct HIER4A geometry:

```text
Directional Folder Bands
+ Adaptive Compass
+ Crossing optimized
```

but two intended **presentation controls** are missing:

1. **Folder strips/guidelines are not rendered in the actual graph.**
2. **Straight direct/diagonal reference lines are not the default, and there is no Sandbox option to switch between Direct and the current Electronic/Vivado-style path.**

Fix both before starting HIER4B.

This task must **not redesign HIER4A layout**.

The layout already computes exact folder-band geometry. Use it.

This task must **not implement HIER5 routing**.

The current Electronic path can remain the existing SmoothStep implementation as a preserved Sandbox alternative. HIER5 will later improve Electronic routing, channels, obstacle avoidance, and Rounded styling.

---

# Current repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

HIER4A merged through:

```text
PR #77
merge commit 70eb9f0c7cbc5cee483c90b0108e3ba9f040b404
```

Current accepted HIER4A:

```text
Directional exact-folder bands
Adaptive Compass default
Crossing optimized default

Sandbox:
Vertical Spine
Document order
```

HIER4B has not started.

Before editing:

1. sync latest `main`;
2. inspect open PRs/worktrees;
3. use a dedicated branch/worktree;
4. preserve unrelated local files such as the pre-existing `.pnpm-store/`;
5. do not disturb unrelated parallel work;
6. do not start HIER4B.

---

# Why this correction is needed

The final HIER4A production prompt incorrectly said that production did not need to render the folder-guide rectangles.

That was contrary to the intended product design.

The user wants the **folder-band structure to be visible**, not merely used invisibly by the layout.

Similarly, the renderer still uses the current SmoothStep/electronic-looking path for edges. The user had intended:

```text
Direct straight connection
→ default

Electronic/Vivado-style
→ optional Sandbox alternative
```

The task is therefore a presentation correction over already accepted semantic/layout truth.

---

# Final product behavior

For:

```text
Focus
+
Hierarchy
+
Modular Preview
```

the default should become:

```text
Internal layout:
Adaptive Compass

Heading order:
Crossing optimized

Folder strips:
On

Connection style:
Direct
```

Sandbox alternatives:

```text
Internal layout:
Vertical Spine

Heading order:
Document order

Folder strips:
Off

Connection style:
Electronic
```

Do not expose Current/Mosaic.

Do not alter Classic.

---

# PART A — Visible exact-folder strips

## A1. Use HIER4A folder-band truth

Do not infer folder strips from rendered File positions.

The computed Modular layout already contains:

```ts
computed.folderBandPlan.bands
```

and each band has exact geometry including:

```text
folderKey
topY
bottomY
centerY
height
root
moduleIds
singleton
```

Use this existing renderer-neutral truth.

Do not:

- recalculate folders from paths;
- estimate band bounds from modules;
- query the filesystem;
- create fake graph nodes or fake graph edges.

---

# A2. Product visual meaning

A visible folder strip means:

> These Files belong to this exact folder's HIER4A horizontal band.

The strip should match the actual band interval used by layout.

If:

```text
band.topY = A
band.bottomY = B
```

the visible strip must correspond to that same Y interval after normal renderer/view transforms.

Do not draw decorative guides that disagree with the layout.

---

# A3. Default visual style

Use the HIER4A lab as the visual reference, but adapt it for normal product use.

Desired visual grammar:

```text
subtle horizontal strip
light / low-contrast background tint OR mostly transparent fill
thin dashed/dotted boundary
small folder label near upper-left edge
```

The root folder may have a slightly distinct existing Focus accent, but do not make it visually dominant enough to compete with the focused File.

Prefer:

```text
quiet spatial scaffolding
```

not:

```text
large colored panels
```

The graph nodes/edges remain primary.

---

# A4. Labels

Show the exact visible folder label.

Examples:

```text
root/
science/
science/neuro/
```

Use the existing normalized folder identity/display helper where available.

Do not expose hidden filtered-module folder identity.

The layout contract already deliberately excludes filtered modules from visible folder-band membership; preserve that privacy boundary.

For workspace root, use the current sensible root-folder display convention rather than inventing an absolute filesystem path.

Never render private absolute paths.

---

# A5. Singleton folders are still visible

HIER4A intentionally gives singleton visible folders real bands.

Therefore:

```text
one visible File in folder
→ strip still visible
```

Do not suppress singleton strips.

This would reintroduce the exact FB9/FB16 confusion HIER4A fixed.

---

# A6. Root strip

The root folder strip must be visible too.

The focused File remains the semantic center.

Do not use strip rendering to move or resize the root File.

---

# A7. Strip width

The layout gives Y bounds but not necessarily a final product X extent.

The strip should visually cover the useful horizontal graph region.

Choose a deterministic renderer-only X policy after inspecting the real graph architecture.

Preferred behavior:

```text
for each visible band:
    span from a shared left graph extent
    to a shared right graph extent
```

where the shared extent includes the currently rendered Modular graph plus modest horizontal padding.

This makes the band read as a horizontal folder lane.

Do not calculate a separate different horizontal width for every folder based only on its own members; that would make them look like disconnected cluster boxes rather than shared horizontal strips.

The strips should reinforce:

```text
same Y band across signed-rank columns
```

---

# A8. Strip width must not affect layout

The strip is renderer-only.

It must not change:

```text
module dimensions
node dimensions
Dagre
Adaptive Compass
folder-band plan
worker input
worker output
layout cache
camera fitting geometry unless explicitly intended
```

Prefer excluding strips from React Flow node bounds / fitView calculations.

They are background presentation, not graph topology.

---

# A9. Correct coordinate space

Render strips in graph/world coordinates so they:

```text
pan with graph
zoom with graph
stay aligned with modules
```

Do not render fixed screen-space bars that detach during pan/zoom.

At the same time, labels should remain readable enough under ordinary zoom.

If label LOD is necessary, keep it simple and renderer-only.

Do not build another semantic-zoom system.

---

# A10. Layering

Desired stacking:

```text
background/grid
↓
folder strips
↓
edges
↓
nodes
↓
selection/hover/UI overlays
```

Folder strips must never cover:

- edges;
- nodes;
- hover;
- direct File ring;
- diagnostics;
- edge hit targets.

Use:

```text
pointer-events: none
```

for strip visuals.

---

# A11. No interaction yet

Do not make strips draggable, selectable, collapsible, or clickable in this task.

Future folder interactions may use them later.

For now:

```text
visual only
```

No new folder selection semantics.

---

# A12. Folder strip preference

Add a persisted Sandbox / Experimental control:

```text
Folder strips

On
Off
```

Default:

```text
On
```

This applies only to:

```text
Modular Focus Hierarchy
```

Classic remains unchanged.

Turning strips Off must hide only the renderer overlay.

Hard:

```text
Folder strips On ↔ Off
→ zero projection
→ zero HIER1 model
→ zero worker
→ zero layout
→ zero cache invalidation
```

This is presentation-only.

---

# PART B — Direct vs Electronic connection style

## B1. Product decision

Add a persisted Sandbox / Experimental control:

```text
Connection style

Direct
Electronic
```

Default:

```text
Direct
```

Alternative:

```text
Electronic
```

This applies to the actual Modular Focus Hierarchy graph.

Do not alter Classic or unrelated Network/Structure renderers unless the existing architecture can safely share a generic style setting without changing their defaults.

Preferred scope for this task:

```text
Modular Focus Hierarchy only
```

---

# B2. Direct means a truly straight connector

Direct style should connect the final exact source endpoint to final exact target endpoint with one straight segment:

```text
source ●────────╲
                 ╲
                  ● target
```

No intermediate orthogonal bend.

No SmoothStep.

No fake waypoint.

Use the renderer library's standard straight path helper if available, e.g. the current `@xyflow/react` equivalent of:

```ts
getStraightPath(...)
```

rather than hand-building SVG path math unnecessarily.

Preserve:

```text
marker direction
edge label anchor
status styles
hover
selection
reference count
diagnostic marker
```

---

# B3. Electronic preserves the current path

Electronic should preserve the current production behavior as closely as possible.

At current main, the shared React Flow edge component uses:

```ts
getSmoothStepPath(...)
```

with a small border radius for compact schematic edges.

Use that as the initial:

```text
Electronic
```

Sandbox implementation.

Do not try to make it final HIER5-quality orthogonal routing here.

HIER5 will later own:

```text
Electronic square-corner routing
Electronic Rounded styling
route channels
obstacle avoidance
parallel/overlapping edge separation
distinct hit targets
```

This task only exposes/preserves the current electronic-like visual path.

---

# B4. Direct is default

Fresh users / missing preferences:

```text
Connection style = Direct
```

Existing users upgrading from HIER4A should also normalize to:

```text
Direct
```

unless a valid explicitly persisted future preference exists.

No migration dialog.

---

# B5. Connection style is renderer-only

Switching:

```text
Direct ↔ Electronic
```

must cause:

```text
0 projection
0 HIER1 model
0 modular worker
0 Adaptive Compass
0 folder layout
0 layout cache invalidation
```

Only edge path generation/rendering changes.

The exact endpoints remain identical.

This is crucial.

Do not put route style into the HIER4A worker cache key.

HIER5 may later introduce actual route geometry that requires a different architecture; not now.

---

# B6. Keep exact endpoint semantics

Both styles connect the same:

```text
File
Heading
Block
fallback/module anchor
```

endpoints.

Changing connection style must not change:

```text
ReferenceId provenance
ProjectionEdgeId
source/target semantics
edge status
selected backbone/focus-path/secondary role
```

Only the SVG path changes.

---

# B7. Shared GraphEdge component caution

The current shared renderer edge component uses `getSmoothStepPath(...)`.

Do not globally change it to straight paths, because that could alter Classic and other React Flow presentations.

Instead introduce a narrow route-style input.

Reasonable architectures include:

```text
GraphEdgeData.routeStyle
```

or:

```text
GraphCanvas edgePathStyle prop/context
```

provided the style is set only for Modular Focus Hierarchy.

Prefer one typed renderer-level contract rather than checking application mode from inside `edges.tsx`.

Example conceptually:

```ts
type GraphEdgePathStyle = 'direct' | 'electronic';
```

Default for existing callers should preserve current behavior unless they explicitly opt into Direct.

Then Modular Focus passes:

```text
direct by default
electronic when Sandbox preference says so
```

Classic callers remain unchanged.

---

# B8. Edge label positioning

Direct style must place:

```text
×N aggregated count
?
!
≋
```

labels sensibly.

Use label coordinates returned by the path helper.

Do not leave labels positioned according to old SmoothStep geometry while the visible edge is straight.

---

# B9. Hit targets

Preserve existing edge hover/selection behavior.

Direct lines must remain practically hoverable.

If current CSS already uses a wider invisible interaction stroke, preserve it.

Do not solve the HIER5 overlapping-edge problem here.

Hard distinction:

```text
one straight path being thin
→ renderer interaction issue worth preserving existing hit width

multiple semantic edges occupying the exact same straight segment
→ HIER5 routing/channel problem
```

Do not broaden scope.

---

# B10. Secondary links

Direct/Electronic applies consistently to currently displayed:

```text
primary
secondary
diagnostic/fallback
```

graph edges unless a status currently has a special renderer path requirement.

Secondary toggle remains zero-layout.

Changing Secondary visibility and Connection Style may repaint edges only.

---

# PART C — Sandbox UI

## C1. Existing Modular controls

The Sandbox currently has:

```text
Focus Hierarchy implementation
Classic / Modular Preview

Internal layout
Adaptive Compass / Vertical Spine

Heading order
Crossing optimized / Document order
```

Extend the Modular section with:

```text
Folder strips
On / Off

Connection style
Direct / Electronic
```

Defaults:

```text
Folder strips: On
Connection style: Direct
```

---

# C2. Suggested descriptions

Folder strips:

```text
Shows the exact folder bands used by Directional Folder Bands.
```

Direct:

```text
Connects exact endpoints with straight lines.
```

Electronic:

```text
Uses the current schematic-style stepped connectors.
```

Keep text concise.

---

# C3. Disable outside Modular Preview

Prefer the same UI policy already used by the existing Modular controls:

```text
when Classic selected
→ Modular-specific controls disabled
```

Do not create a new settings architecture.

---

# C4. Persistence

Persist:

```text
modularFolderStripsVisible
modularConnectionStyle
```

or repository-conventional equivalent.

Use typed preferences.

Do not scatter raw strings.

Defaults must live in one canonical place.

---

# C5. Migration

Missing values:

```text
Folder strips → On
Connection style → Direct
```

Unknown/corrupt values:

```text
normalize to defaults
```

Do not affect existing:

```text
Adaptive Compass
Heading order
Classic/Modular implementation
```

preferences.

---

# PART D — Folder-strip renderer architecture

## D1. Prefer a dedicated background presentation layer

The folder strips are not graph nodes.

Preferred conceptual implementation:

```text
Modular computed folderBandPlan
        ↓
renderer mapping
        ↓
FolderBandOverlay / FolderStripLayer
        ↓
world-coordinate non-interactive rectangles
```

Do not insert them into canonical projection.

Do not give them fake `ProjectionNodeId`s.

Do not make React Flow think they are layout nodes merely to get coordinate transforms.

Use the cleanest available world-coordinate overlay mechanism after inspecting the renderer.

---

# D2. Exact folder geometry source

For each:

```ts
FocusSchematicFolderBand
```

use:

```text
topY
bottomY
height
folderKey
root
singleton
```

as authoritative Y geometry.

Derive only renderer X extent/presentation.

---

# D3. Graph extent

Compute shared strip X bounds from final rendered graph geometry, e.g.:

```text
min module/node X
max module/node X
+ fixed modest padding
```

Do this as cheap renderer preparation.

No worker round-trip.

No layout cache.

If there is an existing computed renderer graph bounds helper, reuse it.

---

# D4. Camera fitting

Strips should not cause:

```text
fit graph
```

to zoom much farther out simply because they add background width/padding.

The semantic graph remains the nodes/modules.

Preserve current fit behavior.

---

# D5. Zoom behavior

At extreme zoom-out, strip labels may be hidden if needed to avoid clutter.

Do not hide the strip geometry too early.

The strips are intended to communicate folder organization.

Any LOD threshold should be tested in Focus graphs around normal fit-to-view zoom.

---

# PART E — Renderer route style architecture

## E1. Keep style local to Modular Focus

The current `GraphEdge` is shared.

Introduce the route-style seam without changing existing default callers.

Conceptually:

```ts
export type GraphEdgePathStyle =
  | 'electronic'
  | 'direct';
```

Existing non-Modular data:

```text
style absent
→ preserve current SmoothStep behavior
```

Modular mapping:

```text
Direct preference
→ routeStyle = direct

Electronic preference
→ routeStyle = electronic
```

This minimizes regressions.

---

# E2. No worker/cache ownership

Do not add connection style to:

```text
FocusSchematicProductLayoutPolicies
worker request
folderBandPlan
layout algorithm version
exact layout cache
```

It is not layout truth.

Likewise Folder Strips On/Off must not enter those systems.

These are renderer preferences.

---

# E3. Same final attachment coordinates

Add a structural test showing:

```text
Direct
Electronic
```

use identical source/target endpoint coordinates for the same graph.

Only path `d` differs.

---

# PART F — Tests

## F1. Preferences defaults

Fresh settings:

```text
Folder strips = On
Connection style = Direct
```

---

# F2. Preference persistence

Set:

```text
Folder strips = Off
Connection style = Electronic
```

reload.

Expected same.

Reset/corrupt.

Expected defaults.

---

# F3. Classic isolation

Change both Modular preferences while Classic is active.

Hard:

```text
Classic graph geometry/path behavior unchanged
```

---

# F4. Folder overlay exactness

Synthetic HIER4A fixture with:

```text
root/
science/
language/
singleton/
```

For every band:

```text
rendered top/bottom
=
computed folderBandPlan top/bottom
```

within only any intentional renderer transform convention.

All visible exact folders represented.

Filtered hidden folder absent.

---

# F5. Singleton strip

One visible File in exact folder.

Expected:

```text
strip exists
label exists
```

---

# F6. Strip toggle zero-work

Instrumentation:

```text
On → Off → On
```

Expected:

```text
projection = 0
model = 0
worker = 0
layout = 0
cache mutation = 0
```

Only render work.

---

# F7. Direct route

Known endpoints:

```text
source (x1,y1)
target (x2,y2)
```

Direct path is a single straight connector.

No SmoothStep bend.

---

# F8. Electronic route

Same endpoints.

Expected current SmoothStep behavior remains.

---

# F9. Route toggle zero-work

Instrumentation:

```text
Direct → Electronic → Direct
```

Expected:

```text
projection = 0
model = 0
worker = 0
layout = 0
cache mutation = 0
```

---

# F10. Exact edge identity

Across route toggle:

```text
same edge ID
same source
same target
same reference IDs
same status
same role
```

Only route path changes.

---

# F11. Edge labels

Test:

```text
×3
?
!
≋
```

in Direct and Electronic.

Labels remain associated with correct edge.

---

# F12. Hover/selection

Direct:

- hover works;
- click/selection works where supported;
- File aggregate hover unaffected;
- Heading exact hover unaffected.

Electronic same.

---

# F13. Secondary

Secondary visibility:

```text
Off/On
```

with both route styles.

No layout.

---

# F14. Camera

Toggle:

```text
Folder strips
Connection style
```

Camera/viewport should not jump.

No fit reset.

---

# PART G — Real-app QA

Use:

```text
Focus
→ Hierarchy
→ Modular Preview
```

with actual production renderer.

Default must visibly show:

```text
Adaptive Compass
Crossing optimized
Folder strips visible
Direct straight lines
```

This is the primary graphical acceptance gate.

---

# G1. Folder strip QA

Check:

- root strip visible;
- multiple exact folder strips visible;
- singleton strip visible;
- labels correct;
- strips pan/zoom with graph;
- strips align with Files;
- strips do not cover nodes/edges;
- strips do not affect fit;
- filtered hidden folder does not leak.

---

# G2. Direct edge QA

Check:

- clearly straight diagonal/vertical/horizontal lines;
- exact endpoints;
- arrows/markers correct;
- aggregated edge counts correct;
- diagnostic markers correct;
- hover practical;
- no accidental SmoothStep bend.

---

# G3. Electronic alternative QA

Sandbox:

```text
Connection style → Electronic
```

Expected:

```text
current Vivado/electronic-like SmoothStep appearance returns
```

Switch back:

```text
Direct
```

Expected original Direct geometry deterministically.

---

# G4. Folder strip alternative QA

Sandbox:

```text
Folder strips → Off
```

Expected:

```text
same nodes
same edges
same positions
same viewport
strips disappear only
```

Restore On.

---

# G5. Existing HIER4A controls

Retest:

```text
Adaptive Compass ↔ Vertical Spine
Crossing optimized ↔ Document order
```

Folder strips remain aligned after geometry changes.

Connection style remains whichever preference is selected.

---

# G6. Expanded modules

Expand Headings in several Files.

Folder strips must remain correct after module dimensions/folder-band geometry recompute.

Direct lines must follow updated exact endpoints.

---

# G7. Reroot

Change Focus.

Expected:

- new root folder strip becomes central;
- strips recompute from new folderBandPlan;
- Direct lines follow new geometry;
- preferences persist;
- viewport semantics remain current behavior.

---

# G8. Query hide/restore

Hide File/path.

Expected:

- relevant folder strip may shrink/disappear according to HIER4A truth;
- no stale overlay;
- restore deterministic.

---

# PART H — Optimized desktop gate

After browser QA, build fresh optimized desktop executable.

Require explicit user approval before merge.

User checks actual vault:

```text
1. Folder strips visible by default.
2. Folder labels make sense.
3. Direct lines are default.
4. Direct lines look like the earlier lab straight-edge presentation.
5. Electronic Sandbox switch restores current schematic connectors.
6. Folder strips Off hides only strips.
7. Adaptive Compass remains correct.
8. Crossing optimized remains default.
9. Hover/ring/Secondary remain correct.
10. Classic unaffected.
```

Do not merge before approval.

---

# PART I — HIER5 boundary

This task deliberately does **not** finish routing.

After this correction:

```text
Direct
→ simple straight exact-endpoint path
→ usable default now

Electronic
→ current SmoothStep preview
→ Sandbox alternative now
```

HIER5 later becomes:

```text
Direct
→ retained

Electronic
→ true orthogonal H/V route
→ square-corner option

Electronic Rounded
→ same route topology with rounded corners

+
route channels
obstacle avoidance
parallel edge separation
distinct hit targets
```

Do not pull these into PRE-HIER4B.

---

# PART J — HIER4B boundary

Do not start:

```text
Soft Folder Clusters
```

This task only fixes presentation of the accepted Directional Folder Bands.

HIER4B remains next after this correction is merged.

---

# Likely relevant areas

Inspect current main first.

Probable settings:

```text
apps/web/src/components/GraphSettings.tsx
apps/web/src/components/GraphExplorer.tsx
apps/web/src/preferences/graph-preferences.ts
apps/web/src/preferences/sandbox-settings.ts
```

Probable Modular view:

```text
apps/web/src/components/ModularStructuredGraphView.tsx
```

Probable React Flow renderer:

```text
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/edges.tsx
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/focus-schematic/*
```

Existing authoritative band geometry:

```text
packages/focus-schematic-layout/src/types.ts
→ FocusSchematicFolderBandPlan
→ FocusSchematicFolderBand
```

Do not mechanically create new files.

A focused component like:

```text
FolderBandOverlay.tsx
```

is sensible only if it produces a cleaner boundary.

---

# Suggested implementation order

## Phase 1 — confirm baseline

1. Sync `main`.
2. Confirm PR #77/HIER4A state.
3. Reproduce actual `.exe`:
   - folder strips absent;
   - SmoothStep/electronic path default.
4. Add failing preference/renderer tests.

## Phase 2 — preferences

5. Add typed `Folder strips` preference.
6. Default On.
7. Add typed `Connection style`.
8. Default Direct.
9. Add persistence/normalization.
10. Add Sandbox controls.
11. Keep Classic isolated.

## Phase 3 — folder overlay

12. Consume `computed.folderBandPlan.bands`.
13. Derive shared renderer X extent.
14. Render non-interactive world-coordinate strips behind edges.
15. Render folder labels.
16. Support singleton/root.
17. Protect filtered privacy.
18. Add On/Off presentation toggle.
19. Ensure zero layout work.

## Phase 4 — edge style

20. Add narrow typed renderer route-style seam.
21. Implement Direct with straight path helper.
22. Preserve current SmoothStep as Electronic.
23. Wire only Modular preference.
24. Preserve edge labels/markers/status/hover.
25. Ensure zero layout/cache work.

## Phase 5 — regression

26. HIER4A folder fixtures.
27. route tests.
28. preference tests.
29. Classic isolation.
30. Secondary.
31. hover/ring.
32. camera.
33. reroot.
34. query hide/restore.
35. disclosure.

## Phase 6 — QA

36. Browser actual Modular graph.
37. Ask user for graphical approval.
38. STOP.
39. Build optimized desktop.
40. Ask user for native approval.
41. STOP.

## Phase 7 — merge

42. Update docs/roadmap.
43. Archive exact prompt + SHA-256.
44. `pnpm check`.
45. desktop check/build.
46. PR/CI.
47. Merge after approval.
48. Post-merge CI.
49. Clean only this worktree.
50. Stop.

Do not start HIER4B automatically.

---

# Validation

Use current repository equivalents.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm exec vitest run packages/focus-schematic-layout

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Re-run relevant:

```text
HIER4A production tests
HIER3B-FIX1 hover/ring tests
renderer interaction tests
sandbox preference tests
```

No new dependency expected.

---

# Hard exit gates

This correction is complete only when:

1. actual Modular Focus Hierarchy renders visible folder strips.
2. folder strips are On by default.
3. every visible exact folder band is represented.
4. singleton folders are represented.
5. root folder is represented.
6. filtered hidden folder identity is not exposed.
7. strip Y geometry comes from `folderBandPlan`.
8. strip labels contain no absolute filesystem paths.
9. strips share a coherent horizontal graph extent.
10. strips pan/zoom with graph.
11. strips sit behind edges/nodes.
12. strips are non-interactive.
13. strips do not alter fit/layout geometry.
14. strips Off hides only strips.
15. strip toggle causes zero projection/model/worker/layout/cache mutation.
16. Connection style exists in Sandbox.
17. Direct is the default.
18. Direct is a true single straight connector.
19. Electronic preserves current SmoothStep behavior.
20. route style applies to Modular Focus Hierarchy.
21. Classic path behavior is unchanged.
22. unrelated React Flow renderers are unchanged.
23. Direct/Electronic use the same exact endpoints.
24. Direct/Electronic preserve edge IDs/provenance/status/roles.
25. marker direction is correct.
26. aggregated count label is correct.
27. diagnostic markers are correct.
28. edge hover remains practical.
29. route toggle causes zero projection/model/worker/layout/cache mutation.
30. route toggle does not reset viewport.
31. Secondary toggle remains zero-layout.
32. File aggregate hover remains correct.
33. Heading/Block exact hover remains correct.
34. direct File ring remains correct.
35. Adaptive Compass remains default.
36. Vertical Spine remains Sandbox option.
37. Crossing optimized remains default.
38. Document order remains Sandbox option.
39. HIER4A layout quality is unchanged by route/strip presentation toggles.
40. disclosure keeps strips/endpoints synchronized.
41. reroot keeps strips/endpoints synchronized.
42. query hide/restore keeps strips synchronized.
43. preference persistence passes.
44. corrupt/missing preferences normalize to On + Direct.
45. no new layout-worker protocol bump merely for these renderer preferences.
46. no layout algorithm version bump merely for renderer path/strip visibility.
47. no HIER5 route-channel work is implemented.
48. no HIER4B Soft Folder Cluster work is implemented.
49. browser actual-app QA passes.
50. user graphical approval passes.
51. optimized desktop QA passes.
52. user native approval passes.
53. no new external dependency.
54. full checks pass.
55. PR CI passes.
56. post-merge CI passes.
57. task worktree is cleaned.
58. stop.

---

# Documentation

Update existing documentation to correct the HIER4A presentation record.

State clearly:

```text
Directional Folder Bands
→ geometry + visible folder strips by default

Adaptive Compass
→ default internal layout

Crossing optimized
→ default Heading order

Direct
→ default connection presentation

Sandbox:
Vertical Spine
Document order
Folder strips Off
Electronic connection presentation
```

Do not rewrite older historical prompt archives.

Add a new correction note/validation doc only if repository documentation convention benefits from it.

Archive exact prompt:

```text
history-implementations/PRE_HIER4B_folder_strips_direct_edges_codex_prompt.md
```

Report SHA-256.

Roadmap after merge:

```text
HIER4A — Complete
PRE-HIER4B presentation correction — Complete
HIER4B — Next
HIER5 — After HIER4B
HIER3C — After HIER5
```

---

# Final report

## Summary

State:

```text
PRE-HIER4B presentation correction complete
```

## Folder strips

- geometry source;
- visual layering;
- default/persistence;
- singleton/root/privacy behavior.

## Connection style

- Direct default;
- Electronic Sandbox;
- exact-endpoint identity;
- zero-layout switching.

## Settings

List all Modular Sandbox controls and defaults.

## Compatibility

Adaptive Compass, Vertical Spine, Crossing optimized, Document order, Classic, hover/ring, Secondary.

## Performance

Confirm strip/route toggles trigger renderer-only work.

## Browser QA

## Optimized desktop QA

## Files changed

## Dependencies

Expected:

```text
0
```

## Tests / CI / merge

## Prompt archive SHA

## Next

```text
HIER4B — Soft Folder Clusters
```

Do not start it automatically.
