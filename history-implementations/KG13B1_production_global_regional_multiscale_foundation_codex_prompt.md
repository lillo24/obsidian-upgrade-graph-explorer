# KG13B1 — Production Global + Regional Multi-Scale Foundation

**Task type:** production Sigma integration / semantic zoom / soft folder spatial prior / layout controls / cross-renderer persistence foundation

## Why the previous KG13B plan is superseded

Additional product design changes KG13B materially.

The target is no longer only:

```text
Structure = React Flow
Global = Sigma
```

The intended architecture is multi-scale:

```text
GLOBAL
↓ zoom / select
REGIONAL
↓ Focus / inspect
LOCAL
```

and Local will later support:

```text
Free | Structured
```

The previous KG13B plan correctly promoted Sigma into production, but it would harden a binary Structure/Global product boundary before establishing:

- semantic zoom that changes visual detail without relayout;
- soft folder clustering as a layout-only prior;
- layout settings/presets;
- a clean separation between global file geometry and later local heading geometry;
- future Local Free/Structured architecture;
- future cluster offsets / Saved Views;
- QUERY1 / GROUP1 separation.

Therefore split the remaining KG13 work:

```text
KG13B1
→ production Global renderer
→ Regional semantic-zoom visual LOD
→ soft folder spatial-prior architecture
→ basic layout controls/presets
→ stable Global persistence/history/live update foundation

KG13B2
→ Local / Focus multi-scale integration
→ Local layout = Free | Structured
→ headings unfold around File anchor
→ local induced-subgraph layout
→ unrelated regions may be omitted from current render
→ fast Global → Local transition without whole-vault relayout
```

Do **not** begin KG13B2 automatically.

After KG13B1:

```text
KG13 — In progress
KG13A — Complete
KG13B1 — Complete
KG13B2 — Next
```

Do not mark KG13 complete yet.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG13A merged through PR #30 at:

`b161b35c739310051444c04e51439a396ab72d61`

The repository decision currently says:

```text
React Flow + Dagre = Structure
Sigma + Graphology = Global
```

and explicitly adopts a documents-only Global mode while retaining Structure as the hierarchical/detail renderer.

That remains valid as the **first scale** of the new architecture.

KG13B1 must preserve the accepted KG13A evidence:

- direct Sigma v3;
- Graphology derived renderer state;
- documents-first Global;
- stable-key reconciliation;
- ForceAtlas2 worker;
- accessible DOM Search/Inspector fallback;
- explicit WebGL failure;
- edge events off by default;
- accepted precision-touchpad calibration;
- no canonical/schema changes merely for rendering.

The additional design context refines the long-term presentation architecture rather than invalidating the KG13A adoption decision.

---

# Current KG13A performance evidence

Keep these evidence targets visible:

```text
1k / 2k:
  first render ~6.5 ms
  layout worker ~637 ms
  high RAF gap ~17 ms

5k / 10k:
  first render ~33.5 ms
  layout worker ~1.69 s
  high RAF gap ~17 ms

10k / 20k:
  first render ~97 ms
  layout worker ~3.42 s
  high RAF gap ~25.7 ms

25k / 50k:
  optional ceiling only
  first render ~208 ms
  layout worker ~11.5 s
  high RAF gap ~54.7 ms
```

Product projections:

```text
small  → 600 / 599
medium → 5,000 / 4,999
large  → 24,000 / 23,999
```

Large was heavily affected by unresolved/diagnostic nodes.

The first production target remains roughly the through-10k evidence, not the optional 25k ceiling.

---

# Required first inspection

Before editing:

1. sync latest `main`;
2. verify clean task worktree;
3. inspect:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/PERFORMANCE.md`;
   - `docs/ROADMAP.md`;
   - `docs/GLOBAL_RENDERER_DECISION.md`;
   - ADR 0011 / 0012;
   - `tools/global-renderer-spike/*`;
   - `packages/view-projection/*`;
   - `packages/view-state/*`;
   - `packages/renderer-reactflow/*`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - graph filters/preferences/navigation/history/persistence;
   - current source-neutral path/entity lookup facilities;
4. inspect any active PR/worktree touching GraphExplorer;
5. preserve later merged UX behavior;
6. follow repository PR/CI/cleanup rules.

If latest `main` conflicts materially with this plan, report it instead of forcing stale assumptions.

---

# Multi-scale product architecture

The implementation must preserve this target:

```text
GLOBAL
  files/documents
  minimal GPU nodes
  simple reference edges
  network geometry
  soft folder spatial prior

        ↓ ordinary zoom, without topology/layout recomputation

REGIONAL
  same underlying positions
  progressive labels
  more visual differentiation
  more relationship detail

        ↓ Focus / local inspection

LOCAL
  Free
  OR
  Structured
```

KG13B1 implements **Global + Regional** and the architectural seams required by Local.

KG13B2 implements Local.

Do not fake Local in B1 by overloading Global with headings.

---

# Separation of concerns — hard rule

Keep these independent:

```text
REFERENCES
semantic graph

QUERY1
future selection/filter language

GROUP1
future visual classification/rules

FOLDERS
soft spatial prior

LAYOUT
positions

RENDERER
drawing/interactions
```

Specifically:

```text
same folder
≠ semantic/reference edge
```

and:

```text
same future visual group
≠ physical clustering
```

unless a future explicit layout rule requests it.

Do not create synthetic Graphology edges merely to implement folder attraction.

Do not implement QUERY1 or GROUP1 in KG13B1.

---

# QUERY1 / GROUP1 / LAYOUT1 relationship

Document:

```text
QUERY1 — remains separate future query/filter language
GROUP1 — remains separate future visual style/group rule system
LAYOUT1 — pause as a separate milestone because its folder-spacing responsibilities now live in KG13
```

KG13B1 owns the **layout-side architecture** formerly implied by LAYOUT1.

Do not add a query parser.

Do not add user-defined visual groups.

Do not hard-code styling in a way that makes GROUP1 impossible later.

---

# 1. Promote Sigma spike into production

Create:

```text
packages/renderer-sigma/
@icarus-graph-explorer/renderer-sigma
```

Use direct Sigma v3, not React Sigma.

Expected dependencies:

```text
view-projection
react
sigma
graphology
```

No React Flow, Dagre, Tauri, KG10, parser/resolver, or analytics dependencies.

Extract proven spike logic rather than duplicating it.

After extraction, the spike harness should consume production code where practical.

---

# 2. Global remains documents/files first

Production Global default projection remains documents-only.

Effective Global disclosure:

```text
depth = documents only
no headings
no blocks
```

Do not destroy Structure disclosure state.

Headings must not enter the Global layout simply because a file is later focused.

This is crucial for KG13B2:

```text
Global File coordinate
→ future local anchor
→ headings unfold locally around it
```

rather than:

```text
expand heading
→ entire Global graph relayout
```

---

# 3. Global effective resolution default

Preserve explicit user reference-status filters.

If the user has not explicitly chosen statuses, Global should effectively default to:

```text
resolved only
```

to avoid the diagnostic-target explosion found in KG13A.

This is an effective Global default, not a destructive rewrite of Structure state.

If the user explicitly includes unresolved/ambiguous/invalid states, show them with distinct renderer styling.

---

# 4. Folder metadata is layout metadata, not graph topology

Derive a normalized folder key for each document from its workspace-relative source path.

Do this outside canonical graph truth.

A useful application-side input is conceptually:

```ts
interface GlobalSpatialMetadata {
  readonly folderKeyByProjectionNodeId: ReadonlyMap<
    ProjectionNodeId,
    string
  >
}
```

Exact type may differ.

Renderer/layout may consume folder membership.

KG6 projection does not gain folder edges.

Graphology edge count/reference semantics must be identical whether folder clustering is On or Off.

Add a test explicitly proving:

```text
folder clustering toggle
→ positions may change
→ Graphology semantic edges do not
```

---

# 5. Soft folder clustering

Global geometry should combine two independent influences:

```text
reference/link attraction
+
soft folder spatial prior
```

Desired behavior:

```text
same folder
→ mild preference to remain closer

different folders
→ mild preference for cluster separation

strong cross-folder references
→ can pull files/clusters together
```

Folder boundaries are soft.

Do not use rigid folder boxes as the layout model.

Do not make folder membership dominate actual references.

---

# 6. Folder-prior algorithm — evaluate before committing

`graphology-layout-forceatlas2` does not by itself encode Icarus folder cohesion semantics.

Do not simulate folders using fake reference edges.

Implement one narrow layout-prior abstraction and compare the two simplest viable approaches before finalizing production behavior:

## Option A — chunked ForceAtlas2 + folder-prior adjustment

In the layout worker:

```text
run bounded FA2 chunk
→ compute folder centroids
→ apply small folder cohesion/separation displacement
→ next FA2 chunk
```

This keeps semantic edges untouched and lets real references continuously compete with folder priors.

## Option B — ForceAtlas2 base layout + soft folder offset field

```text
run ordinary FA2
→ calculate gentle cluster offset/centroid transforms
→ preserve node-relative/link geometry as much as possible
```

Evaluate:

- visual network fidelity;
- cluster legibility;
- cross-folder bridges;
- performance;
- stability across live updates;
- ease of future cluster manual offsets.

Choose the technically stronger option from evidence.

Do not build a custom full force engine if these approaches are sufficient.

Report the choice.

---

# 7. Layout worker contract must remain extensible

Global layout worker input should carry plain derived metadata:

```text
node stable key
x/y seed
size
optional folderKey

semantic reference edges

GlobalLayoutSettings
```

No fake folder edge objects.

The algorithm implementation owns folder-prior math.

Future Local B2 may extend a separate local-layout contract rather than abusing this global worker.

---

# 8. Serializable `GlobalLayoutSettings`

Create a source-neutral plain settings contract.

Conceptually:

```ts
interface GlobalLayoutSettings {
  folderClustering: boolean

  spacingPreset: 'compact' | 'normal' | 'spacious'

  custom?: {
    linkForce: number
    linkDistance: number

    folderCohesion: number
    withinFolderSpacing: number
    betweenFolderSpacing: number

    nodeSize: number
    linkThickness: number
    labelThreshold: number
  }
}
```

Exact names/ranges should follow the chosen layout/render algorithm.

Important:

- do not expose every ForceAtlas2 physics parameter;
- defaults/presets must cover normal use;
- advanced controls expose only meaningful product parameters;
- layout settings are distinct from filters and future visual groups.

---

# 9. Initial user-facing spatial controls

Global Tools/Settings should expose approximately:

```text
Folder clustering: On / Off

Spacing:
Compact
Normal
Spacious

Custom controls: Off / On
```

When Custom is On, expose the useful subset from the validated settings contract.

Do not create a wall of sliders.

Use existing graph Settings/Tools patterns.

Do not expose folder cluster dragging yet.

---

# 10. Settings persistence

Because these are actual user controls in B1, persist them through the existing graph-preference mechanism, not canonical/KG9 identity state.

Keep `GlobalLayoutSettings` as a serializable standalone value so future Saved Views can later store/override the same contract.

Do not implement Saved Views now.

Do not make future Saved Views impossible by scattering settings through component-local booleans.

---

# 11. Future Saved View compatibility

Architecture should allow a future Saved View to contain:

```text
query/filter
Global/Local
Local Free/Structured
GlobalLayoutSettings
future cluster offsets
viewport
Focus
```

Do not implement this persistence.

The important gate is:

```text
layout/settings contracts remain renderer-independent serializable values
```

rather than inaccessible imperative Sigma state.

---

# 12. Future manual folder-cluster positioning

Do **not** implement draggable folder clusters now.

But preserve this future position composition:

```text
automatic layout position
+
future folder-cluster user offset
+
future optional per-node offset
=
displayed position
```

Keep layout-result application as a distinct stage so a future cluster offset layer can be added after automatic positions.

Do not bake automatic ForceAtlas2 coordinates directly into immutable renderer truth.

Document this seam.

---

# 13. Regional semantic zoom

Ordinary zoom should normally **not** recompute:

- KG6 projection;
- Graphology topology;
- ForceAtlas2;
- folder layout.

Instead derive a visual detail level from Sigma camera ratio.

Conceptually:

```text
far
→ minimal nodes
→ sparse labels
→ simplest edges

regional
→ more labels
→ stronger file/status differentiation
→ modestly richer edges

near-global
→ richer node silhouettes/details
→ more labels
→ still same underlying coordinates/topology
```

Do not include headings in B1.

---

# 14. Semantic zoom implementation

Create a pure visual-LOD resolver.

Conceptually:

```ts
type GlobalVisualLod = 'far' | 'regional' | 'near'

resolveGlobalVisualLod(cameraRatio): GlobalVisualLod
```

and a style resolver:

```text
projection node/edge
+ LOD
+ hover/selection/status
+ current layout settings
→ Sigma render attributes
```

Use Sigma reducers/settings for high-frequency visual changes.

Do not rebuild Graphology solely because camera zoom crosses a visual threshold.

---

# 15. Regional visual grammar

Keep first-release grammar restrained.

At minimum:

```text
File        → standard document node
Unresolved  → ghost/open node
Ambiguous   → distinct status
Invalid     → distinct status

far:
  mostly points / very limited labels

regional:
  file labels progressively visible
  selected/hovered forced label
  clearer status silhouette/marker

near:
  stronger document/status differentiation
  richer link visibility if useful
```

Do not invent Heading/Block shapes in B1.

Those belong to Local B2.

---

# 16. GROUP1 compatibility in visual styling

Centralize built-in style resolution.

Do not hard-code colors/shapes across event handlers/components.

A future GROUP1 rule layer should be able to contribute:

```text
color
marker
label treatment
```

without rewriting the Sigma session.

KG13B1 does not implement rule parsing or user-defined groups.

The built-in resolver remains the only active layer for now.

---

# 17. Zoom operation oracle

Add deterministic instrumentation/tests:

```text
ordinary camera zoom
→ visual LOD/reducer updates
→ 0 KG6 reprojections
→ 0 Graphology topology rebuilds
→ 0 layout worker requests
```

Zoom may schedule a Sigma refresh.

This is a hard multi-scale architecture gate.

---

# 18. Layout-trigger oracle

Layout should mainly happen after semantic/layout changes:

```text
Global projection topology changes
Focus/filter changes graph membership
folder-clustering setting changes
spacing/force setting changes
source live update changes topology
explicit Re-layout
```

It should **not** happen after:

```text
ordinary zoom
hover
selection
Inspector open
pan
mode-independent UI overlays
```

Add operation-count tests.

---

# 19. Global renderer lifecycle

Promote stable-key in-place Graphology reconciliation.

On live/filter updates:

- preserve surviving node positions;
- preserve selection;
- update edges in place;
- deterministic seed for additions;
- cancel stale layout;
- run background relaxation only if layout-relevant facts changed.

Do not recreate Sigma on normal updates.

---

# 20. Global layout fingerprint

Fingerprint must include only layout-relevant derived data:

```text
layout schema/version
semantic node keys/sizes
semantic edge endpoints/weights
folderKey assignment
GlobalLayoutSettings
layout algorithm/settings version
```

Do not include:

- labels if layout-independent;
- Search;
- hover;
- selection;
- raw source text.

Ordering must not matter.

---

# 21. Bounded in-memory layout cache

Implement memory-only caching.

Exact fingerprint hit:

```text
apply cached positions
→ skip ForceAtlas2
```

Changed fingerprint:

```text
reuse latest positions for surviving stable keys
→ seed additions
→ background relaxation
```

Bound cache to the active/recent workspace.

No durable coordinate cache in B1.

No manual node positions.

---

# 22. Precision input

Preserve accepted Global zoom calibration:

```text
continuous gain = 0.0017
```

Preserve:

- tiny movement responsiveness;
- 0.5-pixel effective visible floor;
- opposite inertia-tail suppression;
- reversal after quiet gap.

Honor existing:

```text
Scroll to Zoom
Pinch to Zoom
```

preference in Global.

Do not add Global-specific trackpad settings.

---

# 23. Direct Sigma production package

Create:

```text
packages/renderer-sigma
```

Use direct Sigma, not React Sigma.

Keep package independent of:

- React Flow;
- Dagre;
- KG10;
- Tauri;
- parser/resolver;
- future QUERY1/GROUP1 implementations.

The web layer owns renderer selection/orchestration.

---

# 24. Lazy production loading

Structure startup must not eagerly load:

```text
Sigma
Graphology
ForceAtlas2
```

Load Global runtime on first Global activation.

Worker loads only when layout is needed.

Prove with production bundle/chunk evidence.

---

# 25. Production mode switch for B1

A compact:

```text
Structure | Global
```

control is acceptable for this milestone as the current user-facing entry point.

However document clearly:

> This is an initial renderer/presentation entry point, not the final statement that the product has only two scales.

KG13B2 will introduce Local Free/Structured semantics.

Do not design persistence/history APIs so they can only ever represent a permanently binary architecture.

---

# 26. Global view-state persistence

Persist the current Global/Structure renderer entry point and separate semantic viewports.

A schema-v2 shape may still use:

```text
rendererMode: structure | global
```

for B1.

But keep the contract extensible so B2 can add:

```text
localLayout: free | structured
```

without replacing canonical viewport semantics.

Persist:

```text
Structure anchor + zoom
Global anchor + Sigma ratio
```

Never persist raw Sigma x/y.

Never persist ForceAtlas2 positions in KG9.

Migrate v1 Structure view safely.

---

# 27. Cross-mode semantic context

Structure → Global:

1. selected entity's containing document;
2. Structure semantic anchor's containing document;
3. saved Global anchor;
4. fit.

Global → Structure:

1. selected document;
2. Global semantic anchor;
3. saved Structure anchor;
4. fit.

No fuzzy matching.

---

# 28. Search and Inspector

Keep canonical Search and existing Inspector.

Document result in Global:

```text
stay Global
→ select/center file
```

Section/block result:

```text
switch Structure
→ reveal exact entity
```

Add:

```text
Open in Structure
```

for selected Global documents.

Do not add Global heading visibility.

---

# 29. Navigation history

Generalize checkpoints so Back/Forward can cross Structure/Global.

Persist history checkpoint data:

```text
renderer entry mode
ViewProjectionState
renderer-specific semantic viewport
```

No raw renderer positions.

B2 will later extend this to Local layout choice.

Design history types to allow that extension without renderer-specific hacks.

---

# 30. Accessibility

Global remains visual overview only.

Search / Inspector / Structure remain accessible DOM paths.

Requirements:

- Global canvas does not pretend to be an accessible graph tree;
- mode control keyboard accessible;
- selected details/actions DOM;
- status/errors live regions;
- reduced motion disables camera animation;
- focus not trapped.

---

# 31. WebGL failure

If Sigma/WebGL fails:

```text
Global unavailable
→ Structure remains usable
```

Do not render a huge React Flow Global fallback.

Saved Global preference may fall back for the current session without deleting persistent preference.

---

# 32. Live source updates

While Global:

```text
new snapshot
→ new effective docs-only Global projection
→ Graphology reconcile
→ preserve stable positions/selection/camera
→ stale layout canceled
→ seed additions
→ background layout if layout-relevant
```

Do not rehydrate persisted viewport over current live camera.

Noncanonical report changes should not cause unnecessary graph/layout work.

---

# 33. Folder changes during live updates

If a document moves folders while stable identity survives:

```text
semantic node ID survives
folderKey changes
→ layout fingerprint changes
→ preserve current position immediately
→ background folder-prior relaxation
```

Do not remove/add the node solely because folder changed.

If path/identity changes according to KG9A, follow stable identity truth.

---

# 34. Folder clustering visual QA

Use synthetic graphs that explicitly include:

- strong within-folder links;
- weak within-folder links;
- strong cross-folder bridges;
- folders with no internal links;
- isolated files;
- one large folder + many small folders.

Verify:

```text
Folder clustering OFF
→ ordinary reference-driven layout

Folder clustering ON
→ folder tendency visible
→ cross-folder semantic bridges still visible
→ no rigid disconnected folder boxes
```

Do not use only an easy synthetic case where folders already match link communities.

---

# 35. Soft-prior quantitative evidence

Add development-only aggregate metrics such as:

```text
mean within-folder distance
mean cross-folder distance
cross-folder reference edge length
position displacement from reference-only baseline
```

This helps prevent a folder prior that overwhelms semantic links.

Do not turn these metrics into canonical data.

---

# 36. Basic layout controls QA

Presets should produce visibly different but stable outcomes:

```text
Compact
Normal
Spacious
```

Custom controls stay in bounded safe ranges.

Invalid/NaN settings fail safely.

Changing settings triggers one latest layout, not obsolete queued layouts.

---

# 37. Future Local seam — required documentation

KG13B1 must explicitly document the next composition:

```text
Global Sigma session
  documents/files + global coordinates
        ↓ selected/focused File anchor

Local Free
  future local Sigma projection/layout
  richer File/Heading/Block grammar

Local Structured
  React Flow/W3 local induced subgraph
  hierarchy around File anchor
```

Do not implement it now.

Critical future rule:

```text
visible headings
→ local layout only
→ no whole Global graph topology/layout recomputation
```

---

# 38. Future Local position anchoring

Document future transformation:

```text
global File position
→ local scene origin/anchor
→ local positions relative to anchor
```

Structured Local may hide unrelated Global regions during current rendering:

```text
not rendered ≠ removed from canonical/projection caches
```

No implementation required in B1.

---

# 39. Future Local performance constraints

KG13B2 must be able to use:

- local induced-subgraph layout;
- global File coordinate as anchor;
- reused stable positions;
- local layout cache;
- immediate cheap placement;
- refined async worker layout.

B1 must not require whole-vault relayout to change visual scale.

Add this to architecture docs.

---

# 40. Manual cluster offsets — future seam only

Do not implement cluster dragging.

Document future position composition:

```text
automatic cluster placement
+
saved folder-cluster offset
=
displayed cluster placement
```

Internal folder layout may later change without losing the user-chosen cluster area.

Do not persist pairwise folder distances.

Do not persist every file position.

---

# 41. Saved Views — future seam only

Do not implement Saved Views.

Keep contracts compatible with future storage of:

```text
query/filter
Global/Local
Local Free/Structured
GlobalLayoutSettings
folder-cluster offsets
viewport
Focus
```

Do not conflate this with current graph preferences.

---

# 42. No QUERY1 implementation

Do not implement Obsidian graph-query syntax now.

Future QUERY1 may produce KG6 filters/subgraphs.

KG13B1 consumes current filters only.

Do not create a renderer-owned query language.

---

# 43. No GROUP1 implementation

Do not implement visual-group rule parsing.

Keep style derivation centralized so future GROUP1 can contribute color/marker/label rules.

Do not let future GROUP1 imply physical clustering automatically.

---

# 44. Pause separate LAYOUT1

If LAYOUT1 exists in planning docs, mark it paused/absorbed into KG13 spatial architecture rather than implementing it independently.

Explain the overlap:

- folder clustering;
- spacing;
- layout forces;
- cluster placement.

Preserve history rather than silently deleting prior planning.

---

# 45. Production performance instrumentation

Retain/add aggregate phases:

```text
global-projection
global-map
graphology-reconcile
global-layout-worker
folder-prior
layout-apply
sigma-mount/render
semantic-zoom-style
global-hover
global-selection
global-center
```

No private IDs/paths.

Measure ordinary zoom and assert no layout.

---

# 46. Production performance gates

Run integrated production code at:

```text
small product Global
medium ~5k
10k/20k stress
optional 25k ceiling if safe
```

Measure:

- first lazy load;
- Sigma mount/render;
- reference-only layout;
- folder-clustering layout;
- semantic-zoom style change;
- cache hit;
- folder/settings warm-seed layout;
- 1% live reconcile;
- hover/select;
- search center;
- RAF gap.

No CI timing thresholds.

---

# 47. Structure regression

Verify:

- W3 behavior unchanged;
- hover/select operation oracles unchanged;
- Structure startup does not eagerly load Sigma/FA2;
- Structure disclosure/persistence unchanged;
- W1/W3 unaffected.

---

# 48. Spike harness

Refactor the KG13A spike harness to consume production:

- mapping;
- Sigma session;
- semantic zoom;
- folder-prior layout;
- layout settings;
- cache.

Keep synthetic fixtures/stress controls.

Do not maintain a fork.

---

# 49. ADR 0013

Add a concise ADR recording:

1. Structure = React Flow/W3.
2. Global/Regional = lazy direct Sigma/Graphology.
3. Global defaults documents-only.
4. KG6 remains semantic projection authority.
5. Graphology remains derived renderer state.
6. semantic zoom changes visual LOD without topology/layout work.
7. folders are layout-only soft priors, never semantic edges.
8. reference attraction and folder prior remain independent forces.
9. ForceAtlas2/folder layout runs off-main.
10. Global layout settings are serializable and future Saved-View compatible.
11. layout cache is derived and memory-only.
12. future Local Free/Structured uses global File positions as anchors and must not relayout the whole Global graph for headings.
13. QUERY1/GROUP1 remain independent future systems.
14. separate LAYOUT1 is paused/absorbed into KG13 spatial architecture.
15. manual folder-cluster offsets remain future derived presentation state.

---

# Documentation

Update at least:

```text
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
packages/renderer-sigma/README.md
packages/view-state/README.md
graph preferences/settings README as relevant
tools/global-renderer-spike/README.md
```

Add a clear multi-scale architecture section:

```text
Global
→ Regional semantic zoom
→ Local Free / Structured (KG13B2)
```

---

# View-state migration

If renderer-mode persistence requires schema v2 in B1:

- migrate v1 Structure viewport losslessly;
- persist Structure/Global semantic viewports separately;
- keep schema extensible for a later `localLayout` field;
- do not persist layout coordinates/settings inside semantic viewport.

Layout settings belong to graph preferences in B1.

Do not introduce unnecessary schema v3 before B2.

---

# Browser QA

Production browser:

- Structure startup chunk check;
- first Global lazy activation;
- Global renderer;
- folder clustering Off/On;
- Compact/Normal/Spacious;
- Custom safe settings;
- ordinary zoom far↔regional↔near with **no relayout**;
- pan;
- touchpad/mouse;
- hover/select;
- Search/Inspector/Open in Structure;
- history/persistence;
- live update;
- WebGL failure;
- no console errors.

---

# Tauri release QA

Actual release desktop:

- Open Vault;
- Global lazy load;
- WebGL;
- folder clustering;
- semantic zoom;
- ForceAtlas2/folder worker;
- physical precision touchpad;
- live source update;
- Rescan;
- mode switch;
- Search/Inspector;
- restart/reselection persistence;
- no CSP/module worker errors.

---

# Privacy

Confirm:

- no upload;
- no source writes;
- folder key is workspace-relative derived metadata;
- layout worker gets derived node/folder/topology data only;
- no private folder names/paths in aggregate logs;
- layout cache memory-only;
- no private graph data committed.

Synthetic fixtures may use generic folder names.

---

# Dependencies

Expected production dependencies remain:

```text
sigma 3.0.3
graphology 0.26.0
graphology-layout-forceatlas2 0.10.1
```

No React Sigma.

No new physics/layout framework unless both folder-prior approaches fail. If they fail, stop and report before adding a new dependency.

---

# Tests

## Production Sigma
- projection mapping;
- stable-key reconciliation;
- selection survival;
- visual reducer/LOD;
- precision wheel;
- lifecycle;
- WebGL failure.

## Global projection
- documents-only;
- Structure disclosure preserved;
- resolved-only effective default;
- explicit filters preserved;
- section focus → containing document;
- no headings/blocks.

## Folder metadata
- path → folder key normalization;
- root document;
- nested folder;
- rename/move folder key change;
- no folder-derived semantic edges.

## Folder prior
- Off = reference-only baseline;
- On changes positions, not edges;
- strong cross-folder links remain influential;
- deterministic result;
- settings validation;
- latest-result cancellation.

## Semantic zoom
- LOD thresholds;
- zoom causes no projection;
- zoom causes no topology reconcile;
- zoom causes no layout;
- hover/selection still no layout.

## Layout settings
- presets;
- custom bounded values;
- serialization;
- preference restore;
- one latest layout per change.

## Cache/fingerprint
- folder/settings included;
- visual-only facts excluded;
- exact hit;
- warm seed;
- bounded eviction.

## Persistence/history
- v1 migration if schema changes;
- Structure/Global viewport;
- mode switch;
- Back/Forward;
- future-compatible type boundaries.

---

# Suggested implementation sequence

1. Sync latest main / preserve concurrent UX.
2. Extract production Sigma from spike.
3. Make spike consume production code.
4. Add documents-only Global derivation.
5. Add folder metadata derivation.
6. Define `GlobalLayoutSettings`.
7. Implement reference-only production layout baseline.
8. Evaluate folder-prior Option A vs B.
9. Choose/implement one soft-prior algorithm.
10. Add presets/custom settings UI.
11. Add semantic-zoom visual LOD with no-layout oracle.
12. Add bounded memory cache/fingerprint.
13. Add lazy Structure/Global entry point.
14. Add Search/Inspector/Open in Structure.
15. Add mode viewport/history persistence as needed.
16. Integrate live Graphology reconcile/folder changes.
17. Add multi-scale/future Local seams to architecture/docs.
18. Run unit/integration tests.
19. Run Global production benchmarks with clustering Off/On.
20. Run Structure regression.
21. Production browser QA.
22. Release Tauri + physical touchpad QA.
23. ADR/docs/roadmap.
24. PR → CI → merge → post-merge CI → cleanup.
25. Stop before KG13B2.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium

pnpm desktop:check
pnpm desktop:build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Also run:

```text
folder-prior A/B comparison
semantic-zoom operation oracle
Global clustering Off/On benchmark
Structure-only bundle regression
browser Global matrix
release Tauri Global matrix
physical precision-touchpad QA
live folder-move/update QA
```

PR CI and post-merge main CI must pass.

---

# Exit gate

KG13B1 is complete only when:

1. production direct Sigma renderer exists;
2. spike consumes production implementation;
3. Global default is documents-only;
4. KG6 remains semantic authority;
5. Graphology remains derived;
6. Structure remains hierarchy authority;
7. Sigma is lazy;
8. ForceAtlas2/folder layout is off-main;
9. folder membership is derived from document path;
10. folder metadata never creates semantic edges;
11. reference attraction remains independent from folder prior;
12. soft folder clustering On/Off exists;
13. folder-prior alternatives were compared;
14. selected algorithm is documented with evidence;
15. cross-folder semantic links remain influential;
16. clustering stays soft rather than rigid boxes;
17. Compact/Normal/Spacious exist;
18. Custom controls are bounded/useful;
19. layout settings are serializable;
20. settings are future Saved-View compatible;
21. settings are not canonical truth;
22. manual cluster dragging is not implemented;
23. future cluster-offset composition remains possible;
24. semantic zoom has far/regional/near visual LOD;
25. ordinary zoom causes no KG6 reprojection;
26. ordinary zoom causes no Graphology topology rebuild;
27. ordinary zoom causes no layout request;
28. hover/selection/Inspector/pan cause no layout;
29. semantic/layout changes request only latest layout;
30. documents remain main Global layout units;
31. headings do not enter Global layout;
32. Global File positions can serve as Local anchors later;
33. architecture explicitly supports Local Free/Structured next;
34. local induced-subgraph layout can be added without whole-Global relayout;
35. default Global status is resolved-only absent explicit filter;
36. explicit filters remain KG6-owned;
37. Global selection feeds existing Inspector;
38. document Search centers Global;
39. heading/block Search hands off Structure;
40. Open in Structure works;
41. persistence/history remain extensible for B2;
42. raw Sigma coordinates are not persisted;
43. ForceAtlas2 positions are memory-only;
44. fingerprint includes folder/settings;
45. exact cache hit avoids layout;
46. changed folder/settings preserve current positions while refining;
47. precision gain remains `0.0017`;
48. tiny touchpad movement remains responsive;
49. inertia-tail suppression remains;
50. both Trackpad modes work;
51. WebGL failure leaves Structure usable;
52. Global remains visual-only for accessibility;
53. QUERY1 is not implemented;
54. GROUP1 is not implemented;
55. style resolution is centralized for future GROUP1;
56. LAYOUT1 is documented as paused/absorbed;
57. no analytics;
58. no persistent cluster/node coordinates;
59. no source editing/writing;
60. production benchmarks remain within KG13A evidence envelope;
61. Structure startup/performance does not materially regress;
62. browser QA passes;
63. release Tauri QA passes;
64. physical touchpad QA passes;
65. docs/ADR/roadmap reconcile multi-scale target;
66. roadmap marks KG13 in progress / B1 complete / B2 next;
67. existing tests remain green;
68. PR CI passes;
69. post-merge CI passes;
70. cleanup completes.

Do not begin KG13B2.

---

# Final report

## 1. Summary
What production Global/Regional capability now exists.

## 2. Multi-scale architecture
`Global → Regional semantic zoom → Local Free/Structured (next)`.

## 3. Production renderer
Sigma extraction/lifecycle and spike reuse.

## 4. Global projection
Documents-only, resolved-only default, shared KG6 filters/focus.

## 5. Folder spatial prior
References + independent soft folder prior, with no fake edges.

## 6. Folder-prior evidence
Option A/B comparison and chosen algorithm.

## 7. Layout controls
Presets/custom values and serialization.

## 8. Regional semantic zoom
Visual LOD and proof zoom does not relayout/reproject.

## 9. Worker/cache
Latest-result behavior, fingerprint, exact cache, warm positions.

## 10. Search / Inspector / Structure handoff

## 11. Persistence/history
Current Global entry mode/viewport and B2 extension seam.

## 12. Future Local seam
How File anchors, local induced subgraphs, Free/Structured, and hidden unrelated regions can be added without Global relayout.

## 13. QUERY1 / GROUP1 / LAYOUT1
Confirm separation.

## 14. Precision input
`0.0017`, tiny movements, inertia behavior, both preference modes.

## 15. Performance
Reference-only versus folder-clustered layout, semantic-zoom cost, cache hit, reconcile, RAF gap.

## 16. Bundle/dependencies

## 17. Accessibility / failure

## 18. Tests / browser / Tauri QA

## 19. Privacy

## 20. Files changed

## 21. ADR / roadmap
Confirm `KG13 in progress`, `KG13B1 complete`, `KG13B2 next`.

## 22. Deviations / warnings
Folder-prior tradeoffs, multi-second layout, >10k limits, control complexity, anything affecting B2.

## 23. KG13B2 handoff
State that Local can rely on stable Global File coordinates, semantic zoom with no relayout, serializable settings, folder-aware global geometry, memory-cached positions, shared KG6/Search/Inspector truth, intact Structure renderer, and headings remaining outside Global topology.

Do not implement KG13B2 automatically.
