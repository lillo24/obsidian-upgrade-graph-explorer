# SPATIAL1A — Normalized Folder Anchors + Persistent Spatial-Override Foundation

**Task type:** source-neutral spatial state / normalized coordinate semantics / workspace-scoped persistence / All-Network layout composition

## Goal

Establish the architecture required for manual folder-cluster positioning without implementing the final drag/spotlight interaction yet.

The first supported override is:

```text
All + Network
folder cluster
→ user-selected normalized target anchor
```

The central model is:

```text
automatic Network layout
+
saved normalized folder anchor
=
displayed folder-cluster placement
```

Do **not** save raw ForceAtlas2 coordinates or fixed pixel/graph-unit offsets.

The saved meaning should be scale-relative:

```text
Folder A should remain toward the bottom-right region
```

rather than:

```text
Folder A must always move exactly +320, +90 graph units
```

SPATIAL1A must implement:

1. a source-neutral `spatial-overrides` domain;
2. deterministic normalized folder-anchor geometry;
3. workspace-scoped persistence and failure handling;
4. All-Network renderer composition after automatic layout;
5. strict separation between automatic positions and displayed overridden positions;
6. tests, benchmark evidence, and a development-only validation harness;
7. the architecture seam for SPATIAL1B's future Arrange Folders interaction.

Do **not** implement the production dragging/spotlight UI in SPATIAL1A.

---

# Milestone split

```text
SPATIAL1A
→ normalized folder-anchor contract
→ persistence/session architecture
→ automatic-layout/display-position separation
→ override composition in All + Network
→ dev/test harness

SPATIAL1B
→ Arrange folders mode
→ cluster selection/highlight
→ pointer drag + live preview
→ spotlight/dim overlay
→ commit/cancel/reset UI
→ release interaction QA

SAVED1
→ later named compositions of query/view/settings/spatial state
```

Do not begin SPATIAL1B automatically.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

At plan-writing time, current `main` is:

```text
b81cc2cdd93ec7dd314189616efec3717ae81d18
```

Current product state includes:

- KG13 multi-scale renderers;
- KG14A audit;
- KG14B1–B3 accessible Network Explorer work;
- QUERY1 / Saved Filters;
- GROUP1 Visual Groups;
- All/Focus × Network/Hierarchy;
- All-Network folder prior and layout settings;
- stable workspace identity;
- workspace-scoped view persistence;
- memory-only Global automatic layout cache.

Current Global Network layout already has:

```text
document folderKey
ForceAtlas2 reference attraction
soft folder prior
automatic position cache
latest-result-wins worker
```

The current layout pipeline is approximately:

```text
projection
→ Global renderer mapping
→ automatic seed / cached automatic positions
→ ForceAtlas2 + folder prior worker
→ apply positions to Sigma
```

SPATIAL1A changes it to:

```text
projection
→ mapping
→ automatic seed / cached automatic positions
→ ForceAtlas2 + folder prior worker
→ AUTOMATIC positions
→ normalized spatial-override composition
→ DISPLAY positions
→ Sigma
```

---

# Hard prerequisite: resolve overlap with PR #51

At plan-writing time PR #51 is open and draft:

```text
VISUAL1B — per-file Network size overrides
```

It modifies:

- `GraphExplorer.tsx`;
- Global/Local Sigma canvases and sessions;
- app persistence/session code;
- renderer styles;
- a new `packages/presentation-overrides`.

Its package documentation explicitly defines Presentation Overrides as:

```text
not a spatial registry
```

and its v1 contract stores per-Entity size scales only.

Therefore:

1. inspect PR #51 status before editing;
2. do not modify, clean, or rebase its worktree/branch;
3. if PR #51 has merged, build SPATIAL1A on the merged architecture;
4. if it is still open, isolated `packages/spatial-overrides` work may proceed;
5. do **not** final-integrate or merge SPATIAL1A against stale renderer/persistence code while PR #51 remains unresolved;
6. after PR #51 resolves, sync/rebase and validate composition with per-file size overrides.

Do not extend `presentation-overrides` into a spatial registry.

Use its session/storage patterns where useful, but keep the domains separate:

```text
presentation-overrides
→ per-entity visual size/style intent

spatial-overrides
→ folder-cluster placement intent
```

---

# Required first inspection

Before editing, inspect current versions of:

```text
AGENTS.md

docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
docs/PRODUCT_QUALITY_AUDIT.md

packages/core/src/model/source.ts

packages/renderer-sigma/src/types.ts
packages/renderer-sigma/src/mapping.ts
packages/renderer-sigma/src/layout.ts
packages/renderer-sigma/src/layout-cache.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx
packages/renderer-sigma/src/graph.ts
packages/renderer-sigma/src/settings.ts

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/preferences/*
apps/web/src/persistence/*
apps/web/src/visual-groups/*
apps/web/src/network-explorer-context.*

packages/view-state
packages/presentation-overrides if PR #51 merged
PR #51 branch/contracts if still open
```

Use latest `main` and merged code as authority.

---

# Core architectural rule

Spatial overrides are:

```text
workspace-scoped
user-authored
derived presentation intent
```

They are **not**:

- canonical knowledge;
- KG6 projection state;
- graph query/filter state;
- Visual Group state;
- Graph Preferences;
- semantic viewport state;
- ForceAtlas2 cache state;
- source Markdown;
- raw renderer coordinates.

The dependency direction must remain:

```text
canonical snapshot
→ projection
→ automatic layout
→ spatial override composition
→ renderer
```

Never:

```text
spatial override
→ canonical graph
```

and never:

```text
displayed overridden positions
→ automatic layout worker input
```

---

# New package: `spatial-overrides`

Create a source-neutral internal package, likely:

```text
packages/spatial-overrides/
@icarus-graph-explorer/spatial-overrides
```

Expected production dependency:

```text
@icarus-graph-explorer/core
```

No dependencies on:

- React;
- Sigma;
- Graphology;
- React Flow;
- view-projection;
- graph-query;
- visual-groups;
- source adapters;
- Tauri;
- filesystem;
- browser storage.

The package owns:

```text
types
validation
deterministic serialization
pure registry mutations
folder-key validation
normalized-anchor geometry
override composition
```

---

# Schema v1

Use a versioned strict registry.

Conceptual contract:

```ts
export const SPATIAL_OVERRIDE_SCHEMA_VERSION = 1 as const;

export interface NormalizedFolderAnchor {
  /**
   * Relative horizontal position in the automatic graph frame.
   * 0 = frame center.
   * -1 = approximate left frame edge.
   * +1 = approximate right frame edge.
   */
  readonly x: number;

  /**
   * Logical visual direction.
   * 0 = frame center.
   * -1 = approximate top frame edge.
   * +1 = approximate bottom frame edge.
   */
  readonly y: number;
}

export interface FolderClusterAnchorEntry {
  readonly folderKey: WorkspaceFolderKey;
  readonly anchor: NormalizedFolderAnchor;
}

export interface SpatialOverrideRegistry {
  readonly schemaVersion: 1;
  readonly workspaceId: WorkspaceId;

  readonly allNetwork: {
    readonly folderAnchors: readonly FolderClusterAnchorEntry[];
  };
}
```

Exact names may differ.

The explicit `allNetwork` nesting is preferred because v1 overrides apply only to:

```text
Scope = All
Layout = Network
```

Do not apply this registry to Focus Network or either Hierarchy view.

---

# Normalized anchor bounds

Use finite bounded coordinates.

Recommended initial bound:

```text
-2.0 ≤ x ≤ +2.0
-2.0 ≤ y ≤ +2.0
```

Interpretation:

```text
inside approximately [-1, +1]
→ target inside the automatic graph frame

outside that range but within ±2
→ intentionally place a cluster beyond the automatic frame edge
```

Do not allow arbitrary huge values.

If implementation evidence justifies a slightly different safe bound, document it and keep the contract explicit.

Reject:

- `NaN`;
- `Infinity`;
- strings;
- missing components;
- unknown fields.

---

# Folder-key contract

Current Global mapping derives exact folder keys from workspace-relative document paths:

```text
File.md
→ "."

Theory/File.md
→ "Theory"

Theory/Language/File.md
→ "Theory/Language"
```

Preserve this exact-folder model.

Create one normalized folder-key validator/contract shared by:

```text
Global folder metadata
spatial-overrides registry
```

Avoid maintaining two drifting validators.

Accept:

```text
"."
or
normalized workspace-relative folder paths
```

Reject:

- leading slash;
- trailing slash;
- backslash;
- drive prefix;
- empty path segments;
- `.` / `..` segments except the root key `"."`;
- absolute paths.

Do not create folder entities in canonical truth.

Do not create fake folder graph nodes or edges.

---

# Folder identity policy v1

Folders do not currently have stable canonical IDs.

SPATIAL1A v1 uses:

```text
exact normalized workspace-relative folder path
```

as identity.

Consequences:

```text
folder renamed
→ new folder key receives no old override

old key
→ remains dormant until explicitly removed or reused
```

Do not silently fuzzy-match folder renames.

Do not pretend path identity is as strong as KG9A EntityId continuity.

Document this limitation.

Future versions may add conservative folder reconciliation or explicit app-owned folder IDs, but not in SPATIAL1A.

---

# Registry operations

Provide pure operations:

```ts
createEmptySpatialOverrideRegistry(workspaceId)

setFolderClusterAnchor(
  registry,
  folderKey,
  anchor,
)

removeFolderClusterAnchor(
  registry,
  folderKey,
)

clearFolderClusterAnchors(registry)

validateSpatialOverrideRegistry(value, expectedWorkspaceId?)

serializeSpatialOverrideRegistry(registry)
```

Requirements:

- deterministic ordering by `folderKey`;
- immutable return values;
- exact workspace check;
- duplicate keys rejected;
- unknown fields rejected;
- JSON round-trip exact;
- `structuredClone()` safe.

Absence means automatic placement.

Do not store an explicit `"auto"` entry.

---

# Automatic graph frame

The anchor must be interpreted relative to the **automatic pre-override graph layout**, not the camera viewport and not previously overridden positions.

Define a deterministic frame:

```ts
interface AutomaticGraphFrame {
  readonly centerX: number;
  readonly centerY: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}
```

Compute it from:

```text
automatic positions of canonical document nodes only
```

Exclude:

- diagnostic/reference-target nodes;
- labels;
- camera position;
- viewport size;
- hover/selection;
- per-file display size overrides;
- already-applied folder translations.

Preferred basic geometry:

```text
minX / maxX / minY / maxY
center = bounding-box midpoint
half extents = half bounding-box size
```

Add deterministic minimum extents for:

- one-node graph;
- zero-width line graph;
- zero-height line graph;
- nearly degenerate positions.

Do not divide by zero.

Do not use the browser viewport as the saved frame.

---

# Logical coordinate orientation

The persisted anchor semantics must be user-intuitive:

```text
+x = right
-x = left
+y = down
-y = up
```

Sigma graph-coordinate Y orientation may not match screen-space Y.

The renderer adapter must verify and centralize that conversion.

Add an end-to-end orientation test proving:

```text
anchor (+0.7, +0.7)
→ cluster is displayed toward bottom-right
```

Do not let the persisted contract depend on undocumented Sigma axis orientation.

---

# Folder automatic center

For each visible exact folder:

```text
automatic folder center
=
mean of its canonical document-node automatic positions
```

Do not include:

- diagnostics;
- headings/blocks;
- hidden non-projected documents;
- labels;
- node visual radius.

All member documents receive the same translation.

This preserves internal folder geometry exactly.

---

# Anchor-to-target conversion

Convert a normalized anchor to an automatic-frame target:

```text
targetX = frame.centerX + anchor.x × frame.halfWidth
targetY = frame.centerY + logicalY(anchor.y) × frame.halfHeight
```

Then:

```text
translation
=
target center - automatic folder center
```

For every visible document in that folder:

```text
displayedPosition
=
automaticPosition
+
translation
```

The same anchor therefore scales with the current graph frame.

Example:

```text
large automatic frame
→ larger absolute translation

smaller automatic frame
→ proportionally smaller translation
```

This is the user's intended behavior.

---

# Normalizing a future drag target

Provide the inverse pure helper required by SPATIAL1B:

```ts
normalizedAnchorFromTarget(
  frame,
  targetPoint,
): NormalizedFolderAnchor
```

Conceptually:

```text
x = (targetX - frame.centerX) / frame.halfWidth
y = logicalVisualY(targetY - frame.centerY) / frame.halfHeight
```

Clamp or reject according to the defined bounds.

SPATIAL1B will later use:

```text
pointer graph target
→ normalized anchor
→ registry commit
```

Do not implement pointer interaction now.

---

# Pure override composition

Provide a pure function conceptually like:

```ts
applyFolderClusterAnchors({
  automaticPositions,
  folderKeyByNodeKey,
  anchors,
}): SpatialCompositionResult
```

Result should include:

```text
displayed positions
automatic frame
active folder summaries
inactive folder keys
applied translations
nonfatal composition issues if needed
```

Do not expose private labels or paths in aggregate instrumentation.

Hard invariants:

1. applying no anchors returns equivalent positions;
2. one folder moves as a rigid translation;
3. internal pairwise distances in that folder remain unchanged;
4. untargeted folders remain unchanged;
5. diagnostics remain unchanged;
6. graph edges/topology remain unchanged;
7. applying twice from the same automatic input gives the same result;
8. override composition never reads current displayed positions.

---

# Multiple folder anchors

Support multiple exact folder anchors.

Each folder translation is independent.

SPATIAL1A does not solve:

- cluster overlap;
- inter-cluster collision;
- edge-length optimization after manual placement;
- post-override physics relaxation.

If the user places two folder targets in the same region, overlap is valid user-authored presentation intent.

Do not silently move them apart.

---

# All + Network only

Apply folder anchors only when:

```text
Scope = All
Layout = Network
```

Do not apply them to:

```text
Focus + Network
All + Hierarchy
Focus + Hierarchy
```

Reason:

- Focus uses a different bounded projection/frame;
- Hierarchy uses Dagre;
- the same normalized global anchor would not mean the same thing in a local subgraph.

Keep the state schema extensible enough for future scoped override classes, but do not implement them now.

---

# Critical automatic-vs-displayed separation

Current `GlobalRendererSession.createLayoutRequest(...)` reads the live Graphology node coordinates as worker warm seeds.

After spatial overrides, those live coordinates may be **displayed overridden positions**.

Feeding them back into ForceAtlas2 would cause:

- override contamination of automatic layout;
- double application;
- cumulative drift;
- cache corruption;
- unstable behavior after repeated relayouts.

Refactor the Global layout owner so it retains:

```text
latest automatic positions
```

separately from:

```text
currently displayed positions
```

Hard rule:

```text
layout worker input
=
automatic positions only
```

Never:

```text
layout worker input
=
displayed overridden positions
```

---

# Automatic position ownership

A strong design is for `GlobalGraphCanvas` to own/ref:

```text
latestAutomaticPositions
```

Lifecycle:

## Initial seed

```text
mapped deterministic automatic seed
→ store as automatic positions
→ apply spatial overrides
→ mount displayed positions
```

## Automatic cache hit

```text
load automatic cached positions
→ store as automatic positions
→ apply latest spatial overrides
→ display
```

## Worker success

```text
worker automatic result
→ store/cache automatic result
→ apply latest spatial overrides
→ display
```

## Override change

```text
automatic positions unchanged
→ recompute displayed positions
→ apply to Sigma
→ 0 layout requests
```

## Explicit Re-layout

```text
invalidate automatic layout cache
→ run automatic worker from automatic warm seed
→ retain spatial registry
→ reapply override to new automatic result
```

---

# Keep the existing automatic layout cache automatic

`GlobalLayoutCache` must continue caching:

```text
automatic ForceAtlas2/folder-prior positions
```

not displayed overridden positions.

Spatial anchors must **not** enter:

```text
globalLayoutFingerprint(...)
```

because they do not change automatic layout computation.

An exact automatic cache hit can be combined with any current spatial registry.

This allows:

```text
same automatic graph
different manual folder anchors
→ no ForceAtlas2 recomputation
```

---

# Refactor request creation safely

Current `GlobalRendererSession.createLayoutRequest(...)` derives warm positions from the session's live graph.

Refactor to prevent displayed positions from leaking into the request.

Possible direction:

```ts
createGlobalLayoutRequestFromAutomaticPositions(
  input,
  settings,
  iterations,
  automaticPositions,
)
```

or equivalent.

The session may remain responsible for rendering and camera interaction.

The canvas/orchestration layer owns automatic layout state.

Do not expose the whole Sigma or Graphology instance.

Keep existing benchmark/test APIs through a clean explicit automatic-position path.

---

# Apply the latest registry after late worker completion

Race:

```text
worker starts automatic layout
→ spatial anchor changes
→ worker finishes
```

The worker result must be combined with the **latest** spatial registry, not the registry captured when the worker started.

Use current refs/state carefully.

Required:

```text
stale automatic layout result policy
→ existing latest-result-wins remains

latest valid automatic result
→ latest spatial registry composition
```

No stale anchor may overwrite a newer one.

---

# Topology/filter changes

When QUERY1 / Hide / path filters alter the current All-Network graph:

```text
new automatic topology/layout
→ compute new automatic frame
→ apply anchors for currently visible folders
```

Folder entries absent from the current projection are inactive, not errors.

Do not prune registry entries based on filtered projection membership.

When a folder becomes visible again:

```text
same exact folder key
→ anchor reactivates
```

This behavior must coexist with KG14B3 Hide/restore chips and Saved Filters.

---

# Layout-setting changes

Changing:

- folder clustering;
- folder strength;
- spacing;
- link influence;
- other automatic layout settings;

may trigger a new automatic layout/frame.

After completion:

```text
same normalized anchors
→ reapply against new frame
```

Do not reinterpret stored anchor as an old absolute translation.

---

# Per-file size override compatibility

If PR #51 merges, verify:

```text
per-file size override
→ display size only
→ no automatic layout request
→ no spatial frame change
→ no folder-anchor recomputation beyond ordinary display refresh
```

Spatial position and visual size remain independent:

```text
presentation-overrides
→ node radius/style

spatial-overrides
→ node position translation
```

Visual Groups remain style-only.

---

# Workspace-scoped persistence

Add a browser/local app persistence adapter:

```text
apps/web/src/persistence/spatial-overrides.ts
```

Suggested key:

```text
icarus-graph-explorer:spatial-overrides:<encoded workspaceId>
```

Do not put anchors into:

- `icarus.graph-explorer.preferences.v1`;
- KG9 view-state schema v3;
- Saved Filters;
- Visual Groups;
- presentation-overrides registry.

---

# Spatial override session

Create a workspace session layer similar in behavior to other workspace-scoped registries.

Conceptual states:

```text
durable
session-only
blocked-corrupt
blocked-write-failure
```

Rules:

## Stable identity

```text
load/save durable workspace registry
```

## Transient/legacy report

```text
session-only
```

## Storage unavailable

```text
session-only with visible status
```

## Corrupt saved value

```text
leave stored value untouched
block edits
expose actionable recovery
```

## Write failure

```text
keep last confirmed registry active
block further writes until reopen/recovery
```

Do not claim successful persistence after a failed write.

---

# Registry adoption transaction

For a user edit in future SPATIAL1B:

```text
current confirmed registry
→ pure candidate mutation
→ validate/serialize
→ persist candidate
→ adopt candidate
```

If save fails:

```text
do not adopt unconfirmed durable candidate
```

Session-only mode may adopt in memory immediately.

SPATIAL1A should implement/test this transaction even though production drag UI comes later.

---

# Reset semantics

Domain/session must support:

```text
Reset folder
→ remove one folder entry

Reset all spatial overrides
→ empty registry
```

SPATIAL1A does not need to expose the final user-facing controls.

Important separation:

```text
Reset saved view
≠ Reset spatial overrides
```

`Reset saved view` must not clear folder anchors.

`Reset graph preferences` must not clear folder anchors.

Future SPATIAL1B will expose explicit spatial reset actions.

---

# Folder disappearance / rename behavior

V1 path-key behavior:

```text
folder absent from current projection
→ entry inactive

folder absent from full workspace
→ entry may remain dormant

folder renamed
→ old path entry does not migrate automatically
→ new path has automatic placement
```

Do not prune based on QUERY1/filter visibility.

Do not implement fuzzy folder rename reconciliation.

Document the dormant/path-reuse limitation:

```text
if a folder path later reappears,
its exact-path override may become active again
```

Future schema may improve this.

---

# Development-only validation harness

Because SPATIAL1A has no final Arrange UI, add a private-safe development harness to prove the behavior.

Prefer extending:

```text
tools/global-renderer-spike
```

or another existing development-only renderer harness.

Allow synthetic controls such as:

```text
folder key
normalized X
normalized Y
Apply
Reset folder
Reset all
```

This is not production product UI.

The harness should show:

- automatic frame;
- automatic folder center;
- target anchor;
- translated displayed cluster;
- no automatic layout request on anchor edit.

Do not expose private vault paths in committed screenshots/output.

---

# Production integration without edit UI

Production All-Network renderer should accept/load the registry now, even though normal users cannot edit it until SPATIAL1B.

With an empty registry:

```text
behavior must be exactly unchanged
```

This allows SPATIAL1B to add interaction without another layout architecture rewrite.

Do not add a hidden keyboard shortcut or unfinished user-facing Arrange button.

---

# Narrow future SPATIAL1B seam

SPATIAL1A should expose the pure/runtime data needed later:

```text
automatic graph frame
folder membership
automatic folder center
normalize target → anchor
apply temporary anchor map → displayed positions
```

Do not implement live drag state yet.

Design so SPATIAL1B can compose:

```text
persisted registry
+
temporary drag preview override
=
current displayed positions
```

with temporary preview winning for the active folder.

This is why override application should accept an explicit anchor map rather than read storage directly.

---

# Future spotlight/torch UI — keep in architecture only

Document the intended next interaction:

```text
Enter Arrange folders
→ graph dims
→ hovered/active folder brightens
→ pointer spotlight follows active area
→ drag folder cluster
→ member nodes move live
→ connected edges follow
→ release commits normalized anchor
→ Escape cancels
```

Do not implement it in SPATIAL1A.

Do not implement generic individual-node dragging first.

---

# Saved Views compatibility

Do not implement Saved Views.

Document the future composition:

```text
Saved View
→ query/filter
→ Scope/Layout
→ hierarchy detail
→ layout settings
→ viewport
→ spatial override profile/reference
```

SPATIAL1A's registry must remain independently serializable so Saved Views can later:

- reference a workspace spatial profile;
- copy a spatial profile;
- override selected folder anchors.

Do not couple current registry to an undefined Saved View schema.

---

# Performance instrumentation

Add narrow aggregate instrumentation if needed:

```text
spatial-frame
spatial-compose
spatial-apply
```

Operation-count expectations:

## Empty registry

```text
same renderer result path
minimal/no measurable overhead
```

## Anchor change

```text
0 KG6 projections
0 Graphology topology reconciliations
0 ForceAtlas2 layout requests
1 display-position composition/apply
```

## Automatic layout completion

```text
1 automatic result
1 spatial composition
1 display apply
```

## Query/topology change

```text
ordinary automatic layout policy
then 1 spatial composition
```

Do not add CI timing thresholds.

---

# Correctness tests — registry

Cover:

1. empty registry;
2. set anchor;
3. replace anchor;
4. remove one;
5. clear all;
6. deterministic sort;
7. duplicate folder key rejection;
8. invalid workspace mismatch;
9. invalid folder key;
10. `NaN` / Infinity;
11. out-of-range coordinates;
12. unknown fields;
13. JSON round-trip;
14. structured clone;
15. immutable operations.

---

# Correctness tests — geometry

Cover:

1. empty automatic graph;
2. single document;
3. degenerate horizontal frame;
4. degenerate vertical frame;
5. rectangular frame;
6. root folder `"."`;
7. nested folder;
8. one target folder;
9. multiple target folders;
10. untargeted folders unchanged;
11. diagnostics excluded from frame;
12. diagnostics not translated;
13. intra-folder relative distances unchanged;
14. pairwise folder shape preserved;
15. target anchor reached within numeric tolerance;
16. inverse target→anchor→target round-trip;
17. anchor `(+,+)` appears bottom-right;
18. changed frame scales absolute translation;
19. repeated composition has no cumulative drift;
20. same automatic input + same registry is deterministic.

---

# Correctness tests — renderer pipeline

Cover:

1. empty registry gives pre-SPATIAL output;
2. automatic cache stores automatic positions;
3. cache never stores displayed overridden positions;
4. worker request uses automatic positions;
5. anchor edit causes zero layout request;
6. anchor edit applies new displayed positions;
7. late worker result uses latest registry;
8. exact automatic cache hit reuses new anchors correctly;
9. explicit Re-layout retains anchors;
10. query/filter removal makes folder inactive;
11. query restore reactivates folder;
12. layout setting change recalculates frame then reapplies;
13. source/workspace switch does not leak anchors;
14. Visual Groups do not affect positions;
15. per-file size override does not affect frame/layout, if PR #51 merged;
16. latest-result-wins worker behavior remains intact.

---

# Persistence tests

Cover:

1. stable workspace durable load/save;
2. transient report session-only;
3. legacy report session-only;
4. missing storage;
5. corrupt JSON;
6. incompatible schema;
7. workspace mismatch;
8. write failure retains last confirmed state;
9. blocked corruption remains untouched;
10. workspace A/B isolation;
11. Synthetic Sample eligibility follows declared stable identity;
12. Reset saved view does not clear spatial registry;
13. graph preferences do not clear registry;
14. presentation-overrides do not clear registry.

---

# Privacy

Folder keys are private workspace metadata.

Requirements:

- local persistence only;
- no network upload;
- no telemetry;
- no benchmark output containing actual folder names;
- no private registry committed;
- no absolute filesystem paths;
- no source body;
- no raw graph topology in committed evidence.

Use generic synthetic folder names.

---

# Dependency expectations

Expected external runtime additions:

```text
zero
```

Add one internal workspace package only.

Do not add:

- state library;
- geometry library;
- persistence library;
- drag library;
- worker library.

---

# ADR

Add a concise decision record using the next available ADR number.

Record:

1. spatial overrides are derived workspace-scoped presentation intent;
2. v1 supports exact-path folder anchors for All + Network only;
3. anchors are normalized target centers relative to the automatic pre-override graph frame;
4. `x` means left/right and `y` means top/bottom in logical visual orientation;
5. automatic and displayed positions are distinct;
6. ForceAtlas2 worker input/cache always uses automatic positions;
7. spatial overrides apply only after automatic layout;
8. no raw coordinates enter KG9 view state or Graph Preferences;
9. folder path identity does not survive rename in v1;
10. persistence is a separate registry;
11. SPATIAL1B will provide drag/preview UI;
12. Saved Views remain later composition work.

---

# Documentation

Update at least:

```text
packages/spatial-overrides/README.md
packages/renderer-sigma/README.md
apps/web/src/persistence/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

If PR #51 merged, update:

```text
packages/presentation-overrides/README.md
```

only enough to reaffirm the domain boundary.

---

# Roadmap policy

Do not overwrite the active KG14 sequence.

Add a parallel/future derived-presentation track:

```text
SPATIAL1 — In progress
SPATIAL1A — normalized folder-anchor foundation complete
SPATIAL1B — Arrange Folders interaction next
SAVED1 — later
```

Keep current KG14 status unchanged.

Do not mark Saved Views started.

---

# Scope

## In scope

- new source-neutral spatial-overrides package;
- normalized folder-anchor schema;
- exact folder-key contract;
- automatic graph-frame calculation;
- logical visual-axis semantics;
- folder-center/translation composition;
- inverse target-to-anchor conversion;
- All-Network-only application;
- automatic/display position separation;
- automatic cache protection;
- worker warm-seed protection;
- workspace-scoped persistence/session;
- reset-domain operations;
- dev-only validation harness;
- PR #51 compatibility;
- tests/benchmarks/docs/ADR/roadmap;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- production Arrange Folders UI;
- pointer dragging;
- spotlight/torch overlay;
- live drag preview;
- individual node movement;
- node pinning;
- Focus spatial overrides;
- Hierarchy spatial overrides;
- cluster collision solver;
- post-override physics relaxation;
- folder rename reconciliation;
- persistent raw positions;
- Saved Views;
- multi-profile spatial presets;
- source editing;
- analytics.

---

# Suggested implementation sequence

1. Check PR #51 status.
2. Sync/rebase to the correct latest `main`.
3. Define folder-key + normalized-anchor types.
4. Implement strict registry validation/serialization/mutations.
5. Implement automatic-frame and anchor geometry.
6. Add domain geometry tests.
7. Refactor Global automatic/display position ownership.
8. Ensure worker request/cache use automatic positions only.
9. Add override composition after automatic layout.
10. Add workspace persistence/session.
11. Wire default-empty production registry.
12. Add dev-only synthetic anchor harness.
13. Add operation-count/performance evidence.
14. Validate PR #51 size-override composition if merged.
15. Run full tests/builds.
16. Production browser smoke.
17. Release Tauri smoke with synthetic pre-seeded registry/harness as appropriate.
18. Update ADR/docs/roadmap.
19. Archive this prompt under `history-implementations/`.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop before SPATIAL1B.

---

# Validation commands

Use current repository equivalents.

Expected:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/spatial-overrides typecheck
pnpm exec vitest run packages/spatial-overrides

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
automatic-vs-displayed drift oracle
anchor scaling across two graph frames
bottom-right logical orientation QA
anchor edit → zero layout request oracle
automatic cache purity oracle
query hide/restore anchor reactivation
settings relayout + anchor reapplication
workspace isolation
PR #51 per-file size composition
production browser synthetic harness
release Tauri synthetic harness
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

SPATIAL1A is complete only when:

1. `packages/spatial-overrides` exists.
2. The package is source-neutral.
3. Registry schema is versioned.
4. Registry is workspace-scoped.
5. Registry contains an explicit All-Network folder-anchor section.
6. Folder keys use normalized exact workspace-relative folder paths.
7. Root folder `"."` is supported.
8. Invalid/absolute folder keys are rejected.
9. Anchor X/Y are finite and bounded.
10. Anchor X means left/right.
11. Anchor Y means top/bottom in logical visual orientation.
12. An end-to-end test proves positive X/Y displays bottom-right.
13. Automatic frame uses document automatic positions only.
14. Diagnostic nodes do not affect the frame.
15. Degenerate graph frames are safe.
16. Folder center uses member document positions.
17. One folder translation preserves internal relative geometry.
18. Untargeted folders remain unchanged.
19. Diagnostics remain untranslated.
20. Multiple anchors compose deterministically.
21. Target→anchor→target round-trip passes.
22. Graph-size changes scale translation proportionally.
23. Repeated composition does not drift.
24. Spatial anchors apply only to All + Network.
25. Focus Network is unchanged.
26. All/Focus Hierarchy are unchanged.
27. Automatic positions are stored separately from displayed positions.
28. ForceAtlas2 requests never use displayed overridden positions.
29. Automatic cache never stores displayed positions.
30. Spatial anchors are excluded from automatic layout fingerprint.
31. Anchor changes cause zero layout requests.
32. Anchor changes cause zero KG6 projections.
33. Anchor changes cause zero topology reconciliations.
34. Latest worker result uses latest anchor registry.
35. Explicit Re-layout retains/reapplies anchors.
36. Query/filter disappearance does not delete an anchor.
37. Exact folder return reactivates its anchor.
38. Layout-setting changes recompute automatic frame then reapply anchor.
39. Visual Groups remain style-only.
40. PR #51 presentation-size overrides remain independent if merged.
41. Spatial registry is not merged into presentation-overrides.
42. Stable workspace persistence works.
43. Transient/legacy reports remain session-only.
44. Corrupt storage remains untouched and blocks edits.
45. Write failure preserves last confirmed registry.
46. Workspace A/B registries remain isolated.
47. Reset saved view does not clear spatial overrides.
48. Graph Preferences do not clear spatial overrides.
49. Pure Reset Folder and Reset All operations exist.
50. V1 folder rename limitation is documented.
51. No folder fuzzy reconciliation is implemented.
52. No raw coordinates enter view-state schema v3.
53. No raw coordinates enter Graph Preferences.
54. No absolute/private paths enter aggregate logs.
55. A development-only synthetic validation harness exists.
56. Production empty-registry behavior is unchanged.
57. No unfinished production drag UI is exposed.
58. SPATIAL1B preview/drag composition remains mechanically possible.
59. No external runtime dependency is added.
60. existing tests remain green.
61. browser smoke passes.
62. desktop check/build pass.
63. release Tauri smoke passes.
64. ADR/docs are reconciled.
65. active KG14 roadmap status remains unchanged.
66. SPATIAL1A is marked complete / SPATIAL1B next.
67. prompt is archived.
68. PR CI passes.
69. post-merge CI passes.
70. task branch/worktree cleanup completes.

Do not begin SPATIAL1B automatically.

---

# Final report

## 1. Summary

State what normalized spatial intent now exists.

## 2. Domain architecture

Show:

```text
automatic layout
→ normalized folder anchors
→ displayed positions
```

## 3. Registry contract

Schema, workspace scope, folder path identity, coordinate bounds.

## 4. Coordinate semantics

Automatic frame, logical axes, normalization/denormalization.

## 5. Automatic vs displayed positions

Explain the anti-drift separation.

## 6. Renderer integration

Cache hits, worker results, settings/filter changes, latest registry.

## 7. Persistence

Stable/session-only/corrupt/write-failure behavior.

## 8. Folder identity limitation

Exact-path semantics and rename behavior.

## 9. Compatibility

QUERY1, Visual Groups, graph preferences, view state, presentation overrides.

## 10. Performance

Composition cost and zero-layout operation evidence.

## 11. Tests / browser / Tauri QA

## 12. Privacy

## 13. Dependencies

Expected external additions: zero.

## 14. Files changed

## 15. ADR / roadmap

Confirm:

```text
KG14 status unchanged
SPATIAL1A complete
SPATIAL1B next
SAVED1 later
```

## 16. Deviations / warnings

Surface frame degeneracy decisions, dormant path reuse, orientation conversion, or cache/refactor risks.

## 17. SPATIAL1B handoff

State that Arrange Folders can rely on:

- validated workspace-scoped folder anchors;
- normalized graph-frame coordinates;
- inverse pointer-target conversion;
- automatic/display position separation;
- cheap override recomposition;
- zero-layout preview capability;
- durable/session-only transaction semantics;
- reset operations;
- exact folder membership;
- no need to redesign ForceAtlas2 or cache ownership.

Do not implement SPATIAL1B automatically.
