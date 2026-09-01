# KG13B2A — Local Focus + Free Multi-Scale Exploration

**Task type:** multi-scale exploration state / bounded local projection / Sigma Local Free renderer / transition anchoring / persistence + history

## Why KG13B2 is split

KG13B1 is complete and establishes the production Global/Regional foundation:

```text
Global files
→ Regional semantic zoom
→ Local seam
```

The remaining Local milestone is broad enough to split cleanly:

```text
KG13B2A
→ Local Focus state
→ bounded KG6 local induced subgraph
→ Local Free Sigma renderer
→ Global → Local anchored transition
→ local search/Inspector/disclosure
→ persistence/history/local viewport
→ performance evidence

KG13B2B
→ Local Structured renderer
→ React Flow/W3 local schematic presentation
→ Local layout = Free | Structured
→ cross-layout viewport/transition parity
→ close KG13
```

Do **not** begin KG13B2B automatically.

The reason for splitting is architectural, not cosmetic:

- B2A defines what “Local” means in projection/state/navigation.
- B2A proves that headings can appear locally without entering Global topology.
- B2A establishes the transition/anchor and local viewport contracts.
- B2B can then add Structured as a second presentation of the **same tested Local projection** rather than designing projection and two renderers simultaneously.

After B2A:

```text
KG13 — In progress
KG13A — Complete
KG13B1 — Complete
KG13B2A — Complete
KG13B2B — Next
```

Do not mark KG13 complete yet.

---

# Goal / success outcome

Implement the first complete Local scale:

```text
GLOBAL
  files + global geometry
       ↓ Focus selected file
LOCAL FREE
  bounded local induced subgraph
  file + heading + optional block entities
  richer network visual grammar
  global File becomes transition anchor
  local ForceAtlas2 refinement runs asynchronously
       ↓ Back
GLOBAL
  previous file/network context restored
```

Local Free must feel like a **zoom into a semantic region**, not a separate full-vault redraw.

Success means:

1. Global topology still contains files only.
2. Entering Local derives a bounded KG6 projection around a stable document root.
3. The root file's headings unfold only inside Local.
4. Unrelated regions are not rendered in Local.
5. Local initially appears immediately from deterministic/anchored seed geometry.
6. Worker refinement does not block interaction.
7. Ordinary Local zoom does not reproject or relayout.
8. Search/Inspector/navigation operate over exact canonical entities.
9. Exiting Local returns to the previous Global semantic context.
10. No whole-vault layout occurs because headings became visible.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG13B1 merged through PR #32 at:

`ac896890e9bcb03dd708f10a5e85ae194174f703`

PR #32 completed:

- lazy direct Sigma/Graphology production Global/Regional renderer;
- documents-only Global projection;
- effective resolved-only default;
- soft folder-aware ForceAtlas2 worker layout;
- serializable Global layout settings;
- memory-only derived position cache;
- far/regional/near visual LOD;
- Search/Inspector/Open in Structure handoff;
- separate Structure/Global semantic viewport persistence/history;
- production browser + release Tauri QA.

The roadmap now states:

```text
KG13 — Global → Regional → Local multi-scale exploration
KG13A + KG13B1 — Complete
KG13B2 — Local Free/Structured next
```

ADR 0013 explicitly requires:

> Local Free/Structured may derive a bounded induced subgraph around stable Global file coordinates. Adding local headings must not mutate Global topology or relayout the whole vault.

`packages/renderer-sigma` is now stable and explicitly leaves Local unimplemented.

Current application state already has:

```text
renderer entry mode:
  structure | global

view-state schema v2:
  Structure semantic viewport
  Global semantic viewport

Global:
  documents-only KG6 derivation
  stable-key Graphology reconciliation
  ForceAtlas2/folder worker
  memory-only positions
```

B2A should extend these seams rather than replacing them.

---

# Concurrent QUERY1 work

The user reports concurrent QUERY1 work remains untouched.

Before editing:

- inspect whether QUERY1 has merged into latest `main`;
- if merged, use current filter/navigation contracts;
- if still on a separate active branch/worktree, **do not modify or clean that worktree**;
- do not invent a competing query/filter language;
- minimize avoidable conflicts in filter/search files;
- final B2A branch must rebase/sync against the actual latest `main` before merge.

QUERY1 remains independent from Local rendering.

---

# Required first inspection

Before implementation inspect at least:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PERFORMANCE.md`
- `docs/ROADMAP.md`
- `docs/GLOBAL_RENDERER_DECISION.md`
- ADR 0013
- `packages/view-projection/README.md`
- `packages/view-projection/src/*` focus/disclosure contracts
- `packages/view-state/README.md`
- `packages/view-state/src/*`
- `packages/renderer-sigma/README.md`
- `packages/renderer-sigma/src/mapping.ts`
- `graph.ts`
- `layout.ts`
- `layout-cache.ts`
- `session.ts`
- `style.ts`
- `GlobalGraphCanvas.tsx`
- `packages/renderer-reactflow/README.md` only to preserve future B2B seam
- `apps/web/src/global-view.ts`
- `apps/web/src/components/GlobalGraphView.tsx`
- `apps/web/src/components/GraphExplorer.tsx`
- navigation/history/persistence/preferences
- existing Focus actions and focus controls
- performance instrumentation

Preserve current KG13B1 operation-count guarantees.

---

# Core Local architecture

Local is a **projection/presentation scale**, not new canonical truth.

```text
KnowledgeSnapshot
      ↓
KG6 ProjectionWorkspace
      ↓
shared ViewProjectionState / focus intent
      ↓
deriveLocalProjectionState(...)
      ↓
bounded ViewProjection
      ↓
Local Free renderer
```

Do not add a second resolver/index of semantic relationships.

Do not copy canonical entities into a Local domain model.

---

# Local root authority

Every Local scene has one stable **root document entity**.

Conceptually:

```ts
interface LocalContext {
  readonly rootDocumentEntityId: EntityId
}
```

Do not duplicate a separate root if existing KG6 `focus.rootEntityId` can remain the semantic authority.

Preferred:

```text
Local root
=
KG6 focus root normalized to containing document
```

Use a separate presentation mode to say that this focused projection is being shown as Local.

No fuzzy root matching.

---

# Entering Local from Global

Primary flow:

```text
Global select File
→ explicit Focus / Open Local action
→ capture Global transition anchor
→ enter KG6 focus rooted at document
→ seed root disclosure
→ derive Local projection
→ switch presentation to Local
```

Do not require a second source/report load.

Do not rebuild Global canonical state.

The existing Global `Focus` behavior should be reconciled with this rule:

> In the multi-scale path, explicit Focus from a Global document enters Local.

Do not leave two competing meanings for the same user-facing Focus action.

If there is a legitimate separate “Global ego graph” interaction, keep it internal/deferred rather than duplicating the primary Focus control.

---

# Local bounded induced subgraph

Reuse KG6 Focus semantics for graph neighborhood:

```text
root document
hops
direction
hierarchy inclusion
```

Do not implement renderer-owned N-hop traversal.

The Local projection should include only:

- root document;
- focused reference-neighborhood documents according to KG6;
- structural descendants that disclosure makes visible;
- explicit projected diagnostic nodes when statuses permit.

Unrelated vault regions are not rendered.

```text
not rendered
≠ deleted
```

Canonical snapshot, projection workspace, caches, stable identity, and Global positions remain intact.

---

# Local root disclosure seed

Entering Local should reveal useful hierarchy immediately without expanding the whole neighborhood.

Default entry behavior:

```text
root document
→ expanded to show its direct/top-level sections

neighbor documents
→ remain collapsed unless already explicitly expanded in the shared disclosure state
```

Do not automatically expand every heading in every neighbor.

Preserve existing explicit user disclosure where safe.

The exact operation should reuse KG6 disclosure IDs rather than create Local-only synthetic headings.

---

# Local hierarchy controls

Reuse existing hierarchy/disclosure concepts where possible.

B2A should not invent an overlapping second “heading depth system.”

Inside Local, provide access to the existing meaningful controls such as:

- expand/collapse selected document/heading;
- structural depth / heading depth if currently appropriate;
- include blocks if already supported;
- Focus hops/direction.

If the existing Structure controls are too card-specific, expose the minimal Local equivalent through the Inspector/toolbar.

Do not create a large control panel.

---

# Presentation state evolution

The current schema-v2 `rendererMode: structure | global` is insufficient to persist an actual Local scale.

B2A should introduce a source-neutral presentation state that can survive B2B.

Preferred conceptual shape:

```ts
type ExplorationPresentationMode =
  | 'structure'
  | 'global'
  | 'local'

type LocalLayoutMode =
  | 'free'
  | 'structured'
```

In B2A:

```text
LocalLayoutMode exists as a stable serializable contract
Free is implemented
Structured is reserved for B2B
```

Do not expose a nonfunctional Structured button yet.

Do not make Local merely an undocumented boolean attached to Global.

---

# Local layout preference

Add a serializable:

```text
Local layout:
  Free
  Structured
```

contract now, because B2B depends on it.

However B2A implements only Free.

Recommended B2A behavior:

- preference default = `free`;
- preference parser accepts only implemented/supported product values according to current UI;
- the type can already include `structured` if it is not surfaced until B2B;
- Saved Views remain future work.

If storing an unavailable `structured` preference would create awkward product behavior, keep the type boundary ready but delay actual persisted Structured selection until B2B.

Use judgment after inspecting the current preferences architecture.

---

# View-state schema v3

B2A is the appropriate point for the next view-state evolution.

Migrate schema v2 deliberately.

A strong conceptual shape:

```ts
interface PersistedWorkspaceViewV3 {
  schemaVersion: 3
  workspaceId: WorkspaceId

  presentationMode:
    | 'structure'
    | 'global'
    | 'local'

  projection: PersistedProjectionState

  viewports?: {
    structure?: {
      anchorEntityId: EntityId
      zoom: number
    }

    global?: {
      anchorEntityId: EntityId
      ratio: number
    }

    local?: {
      anchorEntityId: EntityId
      freeRatio?: number
      structuredZoom?: number
    }
  }
}
```

Exact naming may differ.

`structuredZoom` may remain absent/unwritten until B2B, but reserving the Local viewport contract avoids another unnecessary schema migration immediately afterward.

Do not persist raw Local coordinates.

Do not persist transition screen points.

Do not persist ForceAtlas2 positions.

---

# v2 → v3 migration

Migration must preserve current users.

Required rules:

```text
v2 structure
→ v3 structure
→ preserve Structure viewport

v2 global with no focus
→ v3 global
→ preserve Global viewport

v2 global with active focus
→ evaluate migration conservatively:
   preferred: Local only if this exactly matches the new Local semantic contract
   otherwise preserve Global and require explicit Local entry
```

Do not guess.

Write explicit tests for the chosen rule and document it.

Existing v1 → v2 → v3 migration must remain deterministic.

Unknown future versions remain non-destructively rejected.

---

# Navigation history v3

History must distinguish:

```text
Structure
Global
Local
```

A checkpoint should contain:

```text
presentation mode
ViewProjectionState
renderer-specific semantic viewport
```

Local uses the shared focus state as semantic subgraph context.

Back/Forward must support:

```text
Global
→ Local
→ Global

Global
→ Local
→ Structure
→ Back
→ Local
```

No raw coordinates in history.

Do not store Graphology objects.

---

# Global → Local transition anchor

The transition should visually preserve the selected file's position as much as technically sensible.

Capture a runtime-only transition record when entering Local:

```ts
interface LocalEntryAnchor {
  readonly documentEntityId: EntityId
  readonly viewportPoint?: {
    readonly x: number
    readonly y: number
  }
}
```

Optionally include only other renderer-local facts proven necessary.

Preferred source:

```text
current Global Sigma session
→ selected file graph position
→ graphToViewport
→ viewport point
```

Do not persist this record.

Do not send a full Global position map into React state.

---

# Global renderer API extension

Add the narrowest production API needed to capture Local entry context.

Examples:

```text
selection callback includes viewport point
```

or:

```text
request node viewport position by stable projection key
```

Choose the cleaner current-lifecycle fit.

Avoid exposing the entire Sigma instance to GraphExplorer.

Avoid exporting mutable Graphology.

---

# Local scene anchor

The Local root document is the local origin/anchor.

Conceptually:

```text
root document local position
=
(0, 0)
```

The renderer camera is adjusted so this root appears at the captured Global viewport point when possible.

After worker refinement:

- translate/refine Local positions around the same root origin;
- do not let the root jump arbitrarily across the scene;
- preserve the root's screen-space anchor if practical.

This is presentation geometry only.

---

# Immediate Local seed geometry

Do not show a blank graph while ForceAtlas2 computes.

Local Free must render a cheap deterministic seed immediately.

Seed goals:

```text
root File at origin
direct headings near root
deeper structural descendants progressively outward
neighbor Files around root
diagnostic nodes near their source
```

The exact seed need not be final-quality.

It must be:

- deterministic;
- cheap;
- stable-ID-based;
- bounded;
- visually intelligible enough for immediate selection/pan;
- replaceable by worker-refined positions.

Do not use uncontrolled `Math.random()`.

---

# Use Global geometry where useful

For Local neighbor **documents**, Global geometry may provide useful orientation.

Evaluate a simple optional seed:

```text
neighbor document offset from root
≈ normalized/clamped relative Global document offset
```

Root headings still unfold independently around the root.

If the Global relative offsets are unavailable or pathological, fall back to deterministic local seeds.

Do not make Local correctness depend on Global coordinate availability.

Do not mutate Global cached positions.

---

# Local Free renderer

Extend the production Sigma boundary for a second mapping mode:

```text
Global:
  document entity nodes only

Local Free:
  document
  section
  block
  diagnostic target
```

Do not loosen the Global mapper's documents-only invariant.

Prefer explicit mapping functions/contracts:

```text
mapGlobalProjection(...)
mapLocalFreeProjection(...)
```

or an equally clear discriminated mode.

A section accidentally entering the Global mapper must still fail loudly.

---

# Local Free semantic edges

Local Free may render:

```text
hierarchy edges
reference edges
```

These are distinct real projected relationships.

Do not conflate hierarchy with semantic reference.

No folder-prior synthetic edges are used in Local Free.

Folder clustering is a Global spatial concept; it should not silently influence the local File/Heading scene.

---

# Local Free visual grammar

Implement a richer but still GPU-friendly Local grammar.

Required semantic differentiation:

```text
File
Heading/Section
Block
Unresolved/diagnostic
```

Exact silhouettes are not mandated, but they must be visually distinguishable beyond only labels.

Preferred if current Sigma APIs make it maintainable:

```text
File       → compact rectangle/strong marker
Heading    → diamond or lighter distinct silhouette
Block      → small circle
Diagnostic → open/ghost marker
```

If custom WebGL node programs are disproportionately complex or fragile, use the smallest maintainable combination of:

- shape/program;
- size;
- border/outline;
- marker;
- opacity;

and report the tradeoff.

Do not compromise the future GROUP1 style-resolution seam.

Centralize style resolution.

---

# Local semantic zoom

Local Free may also use visual LOD, but ordinary Local zoom must not relayout.

At minimum:

```text
far-local
→ simplified node glyphs / selected labels

normal-local
→ File + Heading labels
→ clearer hierarchy/reference edge distinction

near-local
→ richer labels/detail
→ Blocks if projected
```

Do not use zoom to add/remove canonical topology automatically.

Actual heading expansion remains an explicit structural/disclosure action.

---

# Local Free layout worker

Do not overload the Global folder-prior contract with Local semantics.

Create a separate Local Free layout service/protocol, while sharing low-level pure ForceAtlas2 helpers if sensible.

Likely:

```text
packages/renderer-sigma
  LocalFreeLayoutService contract
  local plain input/output

apps/web/src/workers/local-free-layout.worker.ts
apps/web/src/workers/local-free-layout-worker-client.ts
```

or equivalent.

Keep it separate from:

- W1 workspace worker;
- W3 Dagre worker;
- Global folder-prior worker.

---

# Local Free layout input

Plain input should include:

```text
root stable key

nodes:
  stable key
  entity kind
  seed x/y
  size

edges:
  source
  target
  kind:
    hierarchy | reference
  weight
```

No source bodies.

No renderer objects.

No folder fake edges.

---

# Local Free force policy

Use the simplest evidence-backed policy.

Suggested:

```text
hierarchy edges
→ shorter / stronger attraction

reference edges
→ ordinary network attraction

root document
→ final layout translated so root remains local origin
```

Do not build a custom physics engine.

Do not attempt Vivado-like routing in Free mode.

That belongs to B2B Structured.

---

# Local latest-result-wins

Layout changes after:

- root/focus changes;
- disclosure changes;
- blocks toggle;
- focus hops/direction changes;
- Local projection topology changes;
- explicit Re-layout.

If superseded:

```text
cancel stale worker
→ latest request only
```

Ordinary zoom, hover, selection, Inspector, pan do **not** trigger layout.

Add operation-count tests.

---

# Local layout cache

Use a bounded memory-only Local Free cache.

Fingerprint includes:

```text
local layout schema/version
root stable ID
projected node kinds/keys/sizes
hierarchy/reference endpoints/weights
relevant Local layout settings
```

Do not include:

- labels;
- hover;
- selection;
- camera;
- Global folder settings;
- raw seed coordinates.

Exact hit skips worker.

Changed projection warm-seeds surviving positions.

No durable Local coordinate persistence.

---

# Local selection / Inspector

Reuse the existing source-neutral selection and `ProvenanceInspector`.

Local node selection supports:

- File;
- Heading;
- Block;
- diagnostic node where appropriate.

Exact canonical details remain in Inspector.

Do not create a Local Inspector.

---

# Local disclosure actions

Sigma nodes do not provide React Flow card buttons.

Add an accessible explicit disclosure action for selected expandable entities.

Preferred surfaces:

- Inspector action;
- compact Local toolbar action;
- optional pointer shortcut only if it does not harm selection/zoom.

Required behavior:

```text
selected collapsed File/Heading
→ Expand

selected expanded File/Heading
→ Collapse
```

Reuse existing graph-state/KG6 disclosure actions.

Do not use double-click as the only path.

Do not put disclosure state inside Graphology.

---

# Local Focus controls

Reuse existing KG6 Focus controls for:

```text
hops
direction
```

Changing them reprojects only the bounded Local graph.

The entire vault remains available in the ProjectionWorkspace.

Do not run a whole-vault renderer layout.

---

# Enter Local action

Provide one explicit user action from Global selection.

Use the existing Focus affordance if practical:

```text
Focus
```

or a clearer:

```text
Open Local
```

Do not expose two separate actions that perform the same transition.

The selected entity must resolve to a document root.

A section/block navigation from another surface should use its containing document as the Local root while preserving the exact selected entity for Inspector/centering if Local projection contains it.

---

# Exit Local

Provide a compact:

```text
Back to Global
```

or equivalent scale-up action.

Exit semantics:

```text
Local presentation
→ restore prior Global semantic viewport
→ center around root document if prior bookmark is unavailable
```

Use history so ordinary Back also behaves correctly.

Decide whether exiting Local clears KG6 focus or restores the exact pre-Local focus checkpoint.

Preferred:

```text
restore the actual Global checkpoint from history
```

rather than hard-coding `focus = undefined`.

This handles future query/filter/focus combinations correctly.

---

# Structure remains separate

B2A does not remove direct Structure.

Structure remains:

- hierarchy authority;
- accessible DOM graph;
- exact fallback when Global/Local WebGL unavailable;
- explicit **Open in Structure** destination.

Do not reinterpret the existing Structure renderer as Local Structured yet.

That is B2B.

---

# Search/navigation in Local

Mode-aware navigation now has three contexts.

## Target visible in current Local projection

```text
stay Local
→ select
→ center
```

## Target not visible but belongs to another document

Preferred:

```text
change Local root/focus to containing document
→ derive new Local projection
→ keep Local
→ select exact target if visible after disclosure/reveal
```

Use existing navigation/reveal logic where possible.

## Explicit Open in Structure

```text
switch Structure
→ reveal exact target
```

Do not force every Heading search from Local to Structure merely because B1 did so from Global. Local is precisely where headings are representable.

---

# Search from Global remains unchanged

Global:

```text
document target
→ stay Global

heading/block target
→ Structure
```

unless the user explicitly chooses to open it as Local through a new Local action.

Do not silently change established B1 navigation behavior without an explicit Local transition.

---

# Global → Local with selected Heading from non-Global surfaces

If a canonical heading/block is the intended Local target:

```text
root = containing document
Local selection = exact heading/block
seed/reveal disclosure ancestors
center exact projected node after Local scene exists
```

This makes future QUERY1/Search-to-Local possible without changing canonical semantics.

---

# Disclosure reveal for exact Local navigation

When navigating to a hidden Local heading/block:

- use stable hierarchy ancestors;
- expand only the minimum required ancestor chain;
- preserve unrelated disclosure;
- derive the new Local projection;
- then center exact node.

Do not set Global disclosure/topology.

---

# WebGL failure in Local

If Sigma Local Free cannot initialize:

```text
Local Free unavailable
→ Structure remains available
→ current canonical selection/focus preserved
```

Do not fall back to a giant Global graph.

Do not silently switch to an unimplemented Structured Local.

Provide an explicit **Open in Structure** recovery.

---

# Accessibility

Local Free is also visual-only.

Requirements:

- Sigma scene `aria-hidden` or equivalent;
- Search and Inspector remain DOM;
- disclosure action available in DOM;
- Focus controls DOM;
- Back to Global / Open in Structure DOM;
- status/layout failures announced;
- focus not trapped;
- reduced-motion honored.

Do not claim Local Free accessibility parity with Structured/Structure.

B2B Structured will provide the richer DOM visual path.

---

# Presentation preference / future B2B seam

Create a stable `LocalLayoutMode` contract now:

```text
free | structured
```

B2A product uses Free.

B2B will add the user-facing switch:

```text
Local layout:
  Free
  Structured
```

Avoid types/UI state that would require replacing Local mode to add Structured.

Do not implement placeholder disabled UI unless it improves discoverability and is clearly labelled unavailable; normally defer the visible toggle until B2B.

---

# Local viewport semantics

Local Free uses:

```text
canonical anchor entity
+
Sigma ratio
```

The preferred anchor is:

1. selected Local entity if canonical/visible;
2. Local root document;
3. nearest canonical entity to camera center.

Persist no raw camera x/y.

Use the schema-v3 Local viewport contract.

---

# Local transition viewport behavior

Entering Local:

```text
captured Global root viewport point
→ first seed render places root at that screen point where possible
→ later worker refinement preserves root anchor
```

If exact point transfer is not possible across responsive/container changes:

```text
center root deterministically
```

Do not fail Local entry.

Exiting returns to the prior Global bookmark/history checkpoint.

---

# Local live-update behavior

While Local is active:

```text
new stable snapshot
→ reconcile focus/root against current workspace
→ if root survives:
     derive new Local projection
     reconcile local Graphology
     preserve surviving positions/selection/camera
     seed additions
     refine if topology changed

→ if root disappears:
     exit Local safely
     announce
     return Global or Structure according to available prior history/session state
```

Do not fuzzy-reassign Local root.

---

# Document move / rename

If KG9A preserves stable root identity:

```text
Local root survives
→ Local remains active
```

Path/folder changes do not matter to Local Free force semantics.

If identity continuity is refused:

```text
Local root is gone
→ no guess
→ exit/recover explicitly
```

---

# Root heading changes

If headings are added/removed:

- root document identity remains;
- Local projection changes;
- surviving heading positions warm;
- new headings seed locally;
- no Global topology/layout change.

This is a critical B2A proof.

Add a test/QA case.

---

# Global layout isolation gate

While Local is active, local hierarchy updates must not mutate/recompute Global layout cache.

Required operation test:

```text
expand Local heading
→ Local projection/layout request
→ 0 Global projection topology changes
→ 0 Global layout worker requests
→ Global exact layout cache still valid
```

This is one of the most important KG13 architecture gates.

---

# Immediate transition performance

Measure:

```text
Focus action
→ Local seed projection ready
→ first Local visual paint
→ worker refined layout
```

Target:

```text
seed/local context should appear within ordinary Class B interaction expectations where feasible
```

Do not wait for ForceAtlas2 before first paint.

Report:

- local projection;
- local mapping;
- seed placement;
- initial Sigma paint;
- worker layout;
- refine apply;
- high RAF gap.

---

# Expected Local workload profiles

Create synthetic Local profiles based on **bounded neighborhood**, not whole vault.

At minimum:

```text
Local-small:
  1 root file
  headings
  ~5–20 neighbor docs
  modest references

Local-medium:
  deeper heading tree
  ~25–75 neighbor docs
  optional blocks
  several hundred projected entities

Local-stress:
  intentionally large focus/hierarchy
  ~1k projected entities if safe
```

Do not make full-vault entity counts the Local target.

---

# Local performance decision: precomputation

Evaluate, but do not automatically implement, speculative precomputation.

Measure normal immediate seed + worker first.

Only if transition remains meaningfully slow should B2A consider:

- precomputing selected document's local projection after selection;
- warming one likely local layout during idle time.

Do not precompute Local layouts for every file.

Do not introduce broad background CPU load.

Report whether precomputation was rejected/deferred/adopted.

---

# Local shape/program performance

If custom Sigma node programs are used, benchmark Local-medium:

- first render;
- pan/zoom;
- hover;
- selection;
- label LOD.

Do not let decorative shape complexity destroy the responsiveness advantage.

Prefer simple glyphs.

---

# Local edges

Visually distinguish:

```text
hierarchy
reference
```

Use restrained styling.

Do not add edge hover/click by default.

Inspector remains the exact provenance path.

No fake folder edges.

---

# No folder clustering inside Local Free

Folder clustering belongs to Global spatial overview.

Do not apply B1 `folderCohesion` to headings/local entities.

Neighbor document placement is governed by Local hierarchy/reference semantics.

Future user-defined GROUP1 also does not imply Local physical clustering automatically.

---

# No Structured implementation in B2A

Do not:

- add React Flow Local Structured mode;
- add schematic routing;
- change W3 local layout;
- add Free/Structured toggle to production;
- close KG13.

B2B owns that work after B2A's local contracts are proven.

---

# No analytics / query work

Still out of scope:

- QUERY1 implementation;
- GROUP1 implementation;
- communities;
- centrality;
- semantic similarity;
- folder group nodes;
- pathfinding;
- source editing;
- manual positions;
- cluster dragging;
- Saved Views.

Keep contracts compatible with those future systems.

---

# Production instrumentation

Add/extend aggregate phases:

```text
local-projection
local-map
local-seed
local-sigma-mount
local-layout-worker
local-layout-apply
local-visual-lod
local-hover
local-selection
local-center
global-to-local-transition
local-to-global-transition
```

Do not log private entity IDs/paths.

Add operation counts:

```text
ordinary Local zoom:
  0 projection
  0 topology reconcile
  0 layout

Local heading disclosure:
  1 Local semantic update/layout as appropriate
  0 Global layout
```

---

# Structure/global regression gates

B2A must not regress B1.

Re-run:

- Structure startup bundle/lazy Global gate;
- Global far/regional/near LOD no-layout oracle;
- Global folder clustering;
- precision touchpad;
- Global Search/Inspector;
- Global cache/layout;
- W1/W3 regression benchmarks.

Local code should remain lazy enough that ordinary Structure startup does not load Sigma Local-specific worker until needed.

Sigma main production chunk may already be loaded by Global; do not duplicate the library for Local.

---

# Worker/code reuse boundaries

Reuse low-level pure utilities where appropriate:

- ForceAtlas2 setup;
- worker failure normalization;
- stable deterministic seed/hash helpers;
- memory LRU primitives;
- style base functions.

Do **not** force Global and Local into one monolithic layout request schema if their semantic edges/settings differ.

Prefer:

```text
shared primitives
+
explicit Global layout contract
+
explicit Local Free layout contract
```

---

# ADR 0014

Add a concise ADR for Local Free.

Record:

1. Local is a bounded projection/presentation scale, not canonical state.
2. KG6 Focus remains semantic neighborhood authority.
3. Local root is a stable document.
4. Global topology remains documents-only.
5. Local headings/blocks exist only in Local projection.
6. Local Free uses Sigma with hierarchy/reference semantics.
7. Local Free has a separate latest-result-wins layout contract from Global folder layout.
8. Global file position/screen context provides the transition anchor; Local coordinates remain derived.
9. first Local paint uses deterministic seed positions before worker refinement.
10. Local updates never require whole-Global relayout.
11. presentation/view-state evolves to represent Local and its semantic viewport.
12. Structure remains separate; Local Structured is deferred to KG13B2B.
13. QUERY1/GROUP1/Saved Views/manual positions remain separate.

---

# Documentation

Update:

```text
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
packages/renderer-sigma/README.md
packages/view-state/README.md
apps/web/components/navigation READMEs as appropriate
tools/global-renderer-spike/README.md
```

Architecture must now show:

```text
GLOBAL / REGIONAL
Sigma file network
       ↓ Focus

LOCAL FREE
Sigma bounded File/Heading/Block subgraph
       ↓ later

LOCAL STRUCTURED
React Flow/W3 — KG13B2B
```

---

# Roadmap

After B2A:

```text
KG13 — In progress
KG13A — Complete
KG13B1 — Complete
KG13B2A — Complete
KG13B2B — Next
```

Do not mark KG14 next.

Do not implement B2B automatically.

---

# Scope

## In scope

- Local presentation state;
- view-state schema v3 + migration;
- Local semantic viewport;
- history across Structure/Global/Local;
- Global explicit Focus → Local transition;
- runtime Global screen-position anchor;
- bounded Local KG6 projection;
- root disclosure seed;
- Local Free Sigma mapping;
- File/Heading/Block visual grammar;
- hierarchy/reference edge distinction;
- Local semantic zoom without relayout;
- separate Local Free ForceAtlas2 worker;
- deterministic initial seed geometry;
- root-origin layout anchoring;
- latest-result cancellation;
- Local memory layout cache;
- local disclosure UI/action;
- Search/Inspector/navigation;
- Back to Global;
- live-update/root-loss behavior;
- performance/operation oracles;
- browser/Tauri/touchpad QA;
- ADR/docs/roadmap;
- PR/CI/cleanup.

## Explicitly out of scope

- Local Structured React Flow implementation;
- user-visible Free/Structured switch;
- schematic/orthogonal layout;
- Global heading topology;
- whole-vault relayout for Local;
- folder clustering in Local;
- QUERY1;
- GROUP1;
- analytics;
- manual positions;
- Saved Views;
- persistent Local coordinates;
- source editing;
- KG14.

---

# Suggested implementation sequence

1. Sync/reconcile latest main and QUERY1 status.
2. Define source-neutral Local presentation contracts.
3. Upgrade/migrate view-state to schema v3.
4. Generalize navigation history to Local.
5. Add `deriveLocalProjectionState`.
6. Add explicit Global Focus/Open Local flow.
7. Extend Global renderer API for transition anchor capture.
8. Add deterministic Local seed placement.
9. Add Local Free projection mapping + style grammar.
10. Add separate Local Free layout contract/worker/client.
11. Add root-origin refinement and latest-result behavior.
12. Add Local memory cache/fingerprint.
13. Add Local semantic zoom operation oracle.
14. Add disclosure actions for selected Local entities.
15. Integrate Search/Inspector/local reroot navigation.
16. Add Back to Global + semantic viewport restoration.
17. Integrate live-update/root-removal behavior.
18. Run Local-small/medium/stress performance profiles.
19. Decide whether idle precomputation is necessary.
20. Run B1/Structure regressions.
21. Production browser QA.
22. Release Tauri + physical touchpad QA.
23. ADR/docs/roadmap.
24. PR → CI → merge → post-merge CI → cleanup.
25. Stop before B2B.

---

# Validation commands

Use current repository equivalents.

Expected:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium

# add Local benchmark according to repo convention
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

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
Global → Local transition benchmark
Local zoom no-layout oracle
Local heading-expand → zero Global layout oracle
Local live heading-add/remove QA
Local root delete/rename QA
Structure/Global regression matrix
browser Local Free interaction matrix
release Tauri Local Free matrix
physical precision-touchpad QA
v1/v2/v3 view migration QA
cross-mode history QA
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG13B2A is complete only when:

1. Local is represented explicitly in presentation/view state.
2. v1/v2 saved views migrate safely to the new schema.
3. Structure saved viewport survives migration.
4. Global saved viewport survives migration.
5. Local has a semantic canonical anchor + Free ratio viewport.
6. raw Local x/y are not persisted.
7. KG6 Focus remains neighborhood authority.
8. Local root normalizes to a stable document.
9. Global explicit Focus/Open Local enters Local.
10. Local projection is bounded.
11. unrelated vault regions are not rendered in Local.
12. Global topology remains documents-only.
13. Local headings never enter Global Graphology.
14. entering Local reveals root top-level headings without expanding every neighbor.
15. existing disclosure semantics remain stable-ID-based.
16. Local Free mapper supports File/Heading/Block/diagnostic nodes.
17. Global mapper still rejects section/block nodes.
18. hierarchy and reference edges remain distinct.
19. Local visual grammar distinguishes File/Heading/Block.
20. style resolution remains future GROUP1-compatible.
21. Local first paint uses deterministic seed geometry.
22. Local does not wait for ForceAtlas2 before first usable visual state.
23. root file acts as Local origin.
24. captured Global viewport point anchors transition where practical.
25. failure to capture exact point falls back safely.
26. worker refinement preserves root anchor.
27. Local Free layout has a separate plain protocol.
28. Local worker is off-main.
29. stale local layout work is canceled.
30. only latest Local layout applies.
31. hierarchy/reference force policy is documented.
32. no folder prior/fake edges are used in Local.
33. Local exact fingerprint cache skips recompute.
34. changed Local projection warm-seeds survivors.
35. cache is bounded and memory-only.
36. ordinary Local zoom causes zero KG6 projection.
37. ordinary Local zoom causes zero Graphology topology reconcile.
38. ordinary Local zoom causes zero layout request.
39. hover/selection/Inspector/pan cause zero layout request.
40. Local disclosure changes only Local projection/layout.
41. expanding Local heading causes zero Global layout request.
42. Global layout cache remains valid after Local heading expansion.
43. selected expandable Local entity has accessible Expand/Collapse action.
44. Local Focus hops/direction use existing KG6 semantics.
45. Local Search visible target stays Local.
46. Local Search to another document can reroot Local safely.
47. exact hidden heading navigation expands minimum ancestor chain.
48. Inspector is shared.
49. Open in Structure remains available.
50. Back to Global restores semantic context.
51. Back/Forward history crosses Global/Local/Structure correctly.
52. root stable rename/move preserves Local where KG9A preserves identity.
53. root identity loss does not fuzzy-reassign Local.
54. root deletion exits/recover safely.
55. heading add/remove updates only Local scene.
56. Local live update preserves surviving positions/selection/camera.
57. Global B1 folder/LOD behavior does not regress.
58. precision gain remains `0.0017`.
59. both Trackpad Zoom modes work in Local.
60. reduced motion is honored.
61. Local WebGL failure preserves Structure recovery.
62. Local remains visual-only with DOM Search/Inspector/disclosure controls.
63. no user-visible Structured toggle is added prematurely.
64. `LocalLayoutMode` seam exists for B2B.
65. no QUERY1 competing implementation is added.
66. concurrent QUERY1 work is untouched unless already merged to main.
67. no GROUP1 implementation is added.
68. no analytics/manual positions/Saved Views are added.
69. immediate transition performance is measured.
70. Local-small/medium benchmark exists.
71. precomputation is adopted only if evidence warrants it.
72. Structure startup does not materially regress.
73. Global production benchmark does not materially regress.
74. browser production QA passes.
75. release Tauri QA passes.
76. physical precision-touchpad QA passes.
77. ADR/docs reconcile Local Free architecture.
78. roadmap marks B2A complete / B2B next.
79. existing tests remain green.
80. PR CI passes.
81. post-merge main CI passes.
82. task branch/worktree cleanup completes.

Do not begin KG13B2B.

---

# Final report

## 1. Summary

What Local Free now provides.

## 2. Multi-scale architecture

Show:

```text
Global / Regional
→ Local Free
→ Local Structured (next)
```

## 3. Local semantic state

Root document, KG6 Focus, bounded projection, disclosure behavior.

## 4. Persistence migration

v3 state, v1/v2 migration, Local viewport.

## 5. Global → Local transition

Anchor capture, immediate seed paint, fallback behavior.

## 6. Local Free renderer

File/Heading/Block grammar, hierarchy/reference semantics, Sigma lifecycle.

## 7. Layout

Worker protocol, force policy, root origin, latest-result handling.

## 8. Cache

Fingerprint, exact hit, warm survivors, bounds.

## 9. Semantic zoom

Proof ordinary Local zoom does not reproject/reconcile/layout.

## 10. Disclosure / Focus

Expand/collapse actions and neighborhood controls.

## 11. Search / Inspector / navigation

Visible target, reroot target, hidden heading reveal, Open in Structure.

## 12. Live updates

Root survival/loss, heading changes, position/selection preservation.

## 13. Global isolation evidence

Show that Local hierarchy operations cause zero Global topology/layout work.

## 14. Performance

For Local-small/medium:

```text
projection
map
seed
first paint
worker layout
refine apply
transition total
RAF gap
```

## 15. Precomputation decision

Adopt/defer/reject and why.

## 16. Precision input

Touchpad behavior and `0.0017` regression evidence.

## 17. Accessibility / failure

## 18. Bundle/dependencies

## 19. Tests / browser / Tauri QA

## 20. Privacy

## 21. Files changed

## 22. ADR / roadmap

Confirm:

```text
KG13 in progress
KG13B2A complete
KG13B2B next
```

## 23. Deviations / warnings

Surface projection limits, custom node-program complexity, Local force/layout shortcomings, transition-anchor compromises, or anything that should change Structured planning.

## 24. KG13B2B handoff

State what Structured can now rely on:

- stable Local presentation/root contract;
- bounded tested Local projection;
- root disclosure semantics;
- transition anchor captured from Global;
- Local semantic viewport/history;
- exact Search/Inspector navigation;
- Global topology/layout isolation;
- Local performance profiles;
- `LocalLayoutMode` contract;
- root-at-local-origin convention.

B2B should add React Flow/W3 as an alternate presentation of **the same Local projection**, not redesign Local semantics.

Do not implement KG13B2B automatically.
