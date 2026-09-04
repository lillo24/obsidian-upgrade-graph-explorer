# HIER3B — Production Modular Focus-Hierarchy Worker + React Flow Preview

**Task type:** production integration / dedicated layout worker / React Flow modular renderer / experimental product preview / cache + failure hardening / native QA gate

## Goal

Take the HIER3A-selected **A1 endpoint-facing Focus Schematic layout** and make the real web/Tauri application capable of rendering it.

HIER3B is primarily integration:

```text
current Focus projection
        ↓
HIER1 Focus Schematic model
        ↓
HIER3A renderer-neutral layout input
        ↓
dedicated latest-result-wins worker
        ↓
validated A1 computed layout
        ↓
React Flow modular mapping
        ↓
actual application interactions
```

The new modular renderer must initially remain an **experimental preview**.

Default product behavior after HIER3B:

```text
Focus + Hierarchy
→ current HIER0/D0 Classic renderer
```

Optional experimental behavior:

```text
Settings
→ Sandbox
→ Experimental
→ Focus Hierarchy implementation
   Classic
   Modular preview
```

When `Modular preview` is selected:

```text
Focus + Hierarchy
→ new HIER3A A1 modular renderer
```

HIER3B must **not** yet make A1 the default.

That default flip, the final user-facing naming, and moving Classic behind `Show Classic Focus Hierarchy` belong to HIER3C.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
c6ce59194a2d0737d5aead0c75b865ba81201282
```

This is newer than the HIER3A merge because SPATIAL2B merged afterward.

Relevant baseline:

```text
HIER0
→ current Focus Hierarchy production path
→ collision-safe seed / W3 adoption / diagnostics / fallback
→ All + Hierarchy experimental gate

HIER1
→ renderer-neutral Focus Schematic model
→ exact File/Heading/Block endpoint groups

HIER2
→ ADOPT_TWO_STAGE_DAGRE
→ stateless
→ compact filtered bridge
→ complete routing deferred to HIER5

HIER3A
→ ADOPT_ENDPOINT_FACING_SPLIT_LANES
→ A1 selected in non-production package
→ exact endpoint/fallback plan
→ left/center/right lane plan
→ endpoint-aware crossing/order refinement
→ exact boundary attachments
→ A0 preserved explicitly
→ production still unchanged

SPATIAL2B
→ merged after HIER3A
→ dynamic Pull hierarchical scope editor for Network
```

HIER3A merged through:

```text
PR #70
PR #71 validation evidence
```

Accepted HIER3A documentation:

```text
docs/HIER3A_ENDPOINT_LANES.md
docs/HIER3A_VALIDATION.md
docs/decisions/0019-focus-schematic-precise-endpoints-and-internal-lanes.md
packages/focus-schematic-layout/README.md
```

Current HIER3A selected API:

```ts
computeFocusSchematicLayout(input)
```

returns A1 geometry.

The richer intended production payload is:

```ts
computeFocusSchematicComputedLayout(input)
```

which returns:

```text
candidate
modulePlan
endpointPlan
internalLanePlan
attachments
endpoint quality
```

The richer attempt API additionally exposes phase timings.

Current HIER3A medium evidence remains comfortably inside the approximate Class-B layout target; the 500-module stress case is slower and explicitly motivates worker transport.

---

# Current repository state / concurrent work

At plan-writing time:

```text
PR #60 is merged
PR #67 is merged
no open PR is visible
```

Do not assume that remains true when implementation begins.

Before editing:

1. sync latest `main`;
2. inspect open PRs and registered worktrees;
3. create an isolated HIER3B branch/worktree;
4. preserve unrelated user modifications/untracked files;
5. do not rewrite `AGENTS.md` instruction text;
6. if another branch merges during HIER3B, integrate latest `main` before final QA.

HIER3B touches production app/renderer code, so rebase conflicts must be reconciled carefully rather than taking the task branch wholesale.

---

# Accepted decisions that HIER3B must not reopen

Do not reopen:

```text
HIER2 macro strategy
→ stateless two-stage Dagre

HIER3A internal strategy
→ A1 endpoint-facing split lanes
→ endpoint-aware four-sweep ordering

filtered intermediary
→ compact anonymous bridge

secondary relationships
→ zero influence on geometry

explicit complete routing
→ HIER5

folder-band semantic refinement
→ HIER4

current Classic Focus Hierarchy
→ preserved independently
```

Do not:

- rerun A/B/C as if HIER2 were undecided;
- make A0 a product option;
- use compound Dagre;
- enable Dagre dynamic state;
- upgrade/fork/patch Dagre;
- implement an obstacle router;
- overwrite Classic in place.

---

# Product sequencing

The target sequence is:

```text
HIER3A
A1 selected outside production
        ↓
HIER3B
A1 available in real app as Experimental modular preview
Classic remains default
        ↓
HIER3C
A1 becomes normal Focus Hierarchy
Classic preserved behind Experimental
        ↓
HIER4
folder-band / vertical semantic refinement
        ↓
HIER5
explicit connection routing
```

HIER3B stops before HIER3C.

---

# 1. Product preference — preview implementation selection

Extend existing graph preferences under the same storage key:

```text
icarus.graph-explorer.preferences.v1
```

Add a backward-compatible field, conceptually:

```ts
type FocusHierarchyImplementation =
  | 'classic'
  | 'modular-preview';

interface GraphPreferences {
  ...
  readonly focusHierarchyImplementation: FocusHierarchyImplementation;
}
```

Default:

```text
classic
```

Requirements:

- absent field → `classic`;
- malformed field → `classic`;
- existing v1 preference records remain valid;
- no storage-key bump;
- no KG9 view-state schema change;
- saving unrelated graph preferences preserves this field;
- storage failure preserves session behavior and uses current warning path.

This is a product/sandbox preference, not canonical state or saved graph view state.

---

# 2. Settings UI

Use the existing:

```text
Settings
→ Sandbox
→ Experimental
```

disclosure.

Add:

```text
Focus Hierarchy implementation

(•) Classic
( ) Modular preview
```

Copy should be concise:

## Classic

```text
Current Focus Hierarchy renderer.
```

## Modular preview

```text
New File-module layout with exact File/Heading/Block endpoints.
Experimental until HIER3C.
```

Keep the existing:

```text
Show All Hierarchy
```

checkbox separately.

Do not conflate:

```text
Show All Hierarchy
```

with:

```text
Focus Hierarchy implementation
```

They solve different product questions.

---

# 3. Sandbox reset

Update:

```text
resetGraphSandbox(...)
```

so Reset Sandbox restores:

```text
focusHierarchyImplementation = classic
```

while preserving the same unrelated ordinary/view-state boundaries as today.

Do not reset:

```text
saved view
query
workspace identity
source
```

---

# 4. No graph-history checkpoint for implementation switching

Switching:

```text
Classic ↔ Modular preview
```

is a rendering preference over the same Focus semantic view.

It must not:

- change Focus root;
- change Focus hops/direction;
- change Hierarchy depth;
- create graph navigation history;
- mutate query/filter state;
- change selection unless the selected projection entity/edge cannot be represented.

Back/Forward semantics remain unchanged.

The preference may persist separately in graph preferences.

---

# 5. Preserve the semantic viewport when switching implementations

Classic and Modular render the same Focus semantic projection.

When switching:

```text
Classic → Modular
Modular → Classic
```

capture a semantic transition anchor before unmount:

Preferred anchor priority:

1. selected visible entity;
2. focused root File;
3. current semantic viewport anchor;
4. deterministic root fallback.

Preserve:

```text
screen point
structured zoom
```

through the existing `GraphTransitionAnchor` concept.

Do not persist raw coordinates.

Use the existing structured semantic viewport bookmark:

```text
anchorEntityId
structuredZoom
```

for both implementations.

No new viewport schema.

---

# 6. Dedicated modular layout worker

Do **not** overload or mutate the existing W3 Dagre worker used by Classic.

Classic currently owns:

```text
apps/web/src/workers/dagre-layout-worker-client.ts
apps/web/src/workers/dagre-layout.worker.ts
@icarus-graph-explorer/dagre-layout
```

Keep it unchanged except for a truly generic test helper if unavoidable.

Add a separate modular worker path.

Preferred files:

```text
apps/web/src/workers/focus-schematic-layout-worker-client.ts
apps/web/src/workers/focus-schematic-layout.worker.ts
```

Protocol/runtime may live in:

```text
@icarus-graph-explorer/focus-schematic-layout/worker-runtime
```

or a tiny dedicated workspace package if that is demonstrably cleaner.

Prefer consistency with the existing W3 protocol structure over adding a generalized worker framework.

Do not refactor W3 merely to deduplicate code in this milestone.

---

# 7. Worker protocol

Add a versioned structured-cloneable protocol.

Conceptually:

```ts
export const FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION = 1;

type Request = {
  protocolVersion: 1;
  requestId: number;
  kind: 'layout';
  input: FocusSchematicLayoutInput;
};

type Response =
  | {
      protocolVersion: 1;
      requestId: number;
      kind: 'success';
      result: FocusSchematicComputedLayout;
      timings: FocusSchematicEndpointLayoutPhaseTimings;
      computeMs: number;
    }
  | {
      protocolVersion: 1;
      requestId: number;
      kind: 'failure';
      message: string;
      computeMs: number;
    };
```

Exact fields may follow existing protocol conventions.

Hard requirements:

- exact shape validation;
- request protocol version validation;
- `requestId` monotonic on the client;
- input validated before compute;
- worker output validated against the request input/model before success;
- malformed response treated as transport failure;
- no source text/private absolute path added;
- no success-shaped partial result.

Use:

```ts
computeFocusSchematicComputedLayoutAttempt(...)
```

inside the worker so production can preserve phase timing evidence.

---

# 8. Latest-result-wins behavior

Match the proven W3 behavior:

```text
request A running
→ request B arrives
→ A resolves superseded
→ A worker generation terminated/invalidated
→ only B may adopt
```

Requirements:

- one active request per modular renderer instance;
- no stale result adoption;
- component unmount cancels pending work;
- switching to Classic cancels modular work;
- workspace switch cancels modular work;
- Focus exit cancels modular work;
- repeated identical cache hit should not create worker work;
- transport failure disposes current worker;
- next request may create a fresh worker.

Do not allow worker response ordering to define product state.

---

# 9. Worker metrics

Mirror W3 runtime evidence but use separate metric names.

Record:

```text
focus-schematic-worker-compute
focus-schematic-worker-round-trip
focus-schematic-worker-startup
focus-schematic-main-thread-gap
focus-schematic-request-adoption
```

Also retain HIER3A phase timings where useful:

```text
model planning
endpoint planning
internal layout
macro layout
crossing ordering
attachments
validation
serialization
```

No private content in instrumentation.

No timings in persistent view state.

No CI timing threshold.

---

# 10. Modular component remains lazy

Create:

```text
apps/web/src/components/ModularStructuredGraphView.tsx
```

or a comparably explicit name.

It must be dynamically imported only when:

```text
Scope = Focus
Layout = Hierarchy
focusHierarchyImplementation = modular-preview
```

Classic component remains:

```text
LocalStructuredGraphView
```

The normal app bundle must not eagerly import:

```text
focus-schematic
focus-schematic-layout
modular renderer mapping
modular worker
```

because Classic remains default.

Verify production chunks.

The modular worker should be a separate worker chunk.

---

# 11. Modular component inputs

The modular component needs enough source-neutral state to build HIER1/HIER3 input without recreating the whole application.

Preferred props extend the existing Structured interface with:

```text
ProjectionWorkspace
current reconciled ViewProjectionState
current Local ViewProjection
```

plus current common callbacks:

```text
rootEntityId
selection
Hierarchy disclosure callback
Focus callback
viewport callbacks
center/fit requests
trackpad mode
focus appearance
visual groups
performance instrumentation
```

Do not pass:

```text
Tauri source provider
filesystem paths
desktop session
workspace engine
```

The modular renderer operates on the already validated in-memory snapshot/projection world.

---

# 12. Build the HIER1 model on the main thread only when preview is active

Inside the lazy modular component:

```text
ProjectionWorkspace
+ active ViewProjectionState
+ existing Local ViewProjection
→ createFocusSchematicModel(...)
```

Use `useMemo` with narrow dependencies.

Instrument:

```text
focus-schematic-model
```

Do not rebuild due:

```text
hover
selection
viewport movement
Inspector open/close
module-outline visibility
secondary-edge visibility
Visual Group style changes
```

It may rebuild due:

```text
projection membership
Hierarchy depth/disclosure
Focus direction/hops/root
query/filter result
live snapshot change
```

---

# 13. Avoid avoidable neighborhood duplication if evidence shows it matters

HIER1 can accept a prepared:

```text
FocusedDocumentNeighborhoodDescription
```

Do not immediately redesign KG6.

First measure real/synthetic production preparation:

```text
local projection
neighborhood description
model construction
```

If duplicate neighborhood work creates a material main-thread gap, add a narrow source-neutral API that returns:

```text
local projection
+
the already-used document neighborhood description
```

from one KG6 traversal.

Any such API must prove exact equivalence with current:

```text
projectLocalView(...)
describeFocusedDocumentNeighborhood(...)
```

Do not introduce a second Focus BFS.

If the duplicated work remains trivial on ordinary Focus graphs, leave KG6 alone.

---

# 14. Production dimension adapter

HIER3A consumes explicit node dimensions.

Production must obtain them from the same React Flow visual grammar that will be rendered.

Current extended Focus cards are:

```text
File     200 × 80
Heading  184 × 72
Block    152 × 64
```

Do not duplicate these numbers in the app.

Add a narrow renderer adapter/subpath that derives:

```ts
readonly FocusSchematicNodeDimension[]
```

from the active projection using the existing exported renderer dimensions.

Preferred ownership:

```text
@icarus-graph-explorer/renderer-reactflow/focus-schematic
```

or another lazy-only subpath.

The default renderer index should not eagerly re-export the modular adapter if doing so pulls the modular dependency graph into the Classic bundle.

Test that:

```text
actual rendered node dimensions
=
worker input node dimensions
```

---

# 15. Frozen selected layout settings

Production modular preview uses the exact accepted HIER2/HIER3A settings:

```ts
FOCUS_SCHEMATIC_LAYOUT_SETTINGS
```

including:

```text
compact filtered bridge
28px horizontal module padding
24px vertical module padding
34px diagnostic reserve
24/48 internal separation
36/80 macro separation
network-simplex
16px hard clearance
```

Do not expose these as user settings in HIER3B.

Do not retune them from production screenshots.

Any necessary change would reopen validation evidence and requires a separate explicit decision.

---

# 16. Exact memory cache

Add a bounded page-lifetime cache for successful modular computed layouts.

Cache value:

```text
FocusSchematicComputedLayout
```

not only React Flow positions.

Cache key must include the exact geometry/semantic input:

```text
layout algorithm version
HIER1 model
active Local projection
node dimensions
frozen layout settings
```

Must exclude non-layout state:

```text
hover
selection
Inspector
viewport
Visual Group styles
secondary-edge visibility
```

Recommended:

- canonical input serialization;
- bounded LRU / insertion-order eviction;
- exact serialized key or collision-verified fingerprint;
- no unverified hash-only cache hit.

Do not persist layout coordinates to KG9.

Do not store cache in localStorage.

---

# 17. Cache validation

On cache hit:

1. verify the key matches exact current input;
2. validate cached `FocusSchematicComputedLayout`;
3. validate candidate against current HIER1 model;
4. reject malformed/stale entry as miss;
5. never crash the view due a corrupt memory entry.

Record:

```text
cache hit
cache miss
cache invalidation
approximate cached bytes
```

only in runtime instrumentation.

---

# 18. Separate modular renderer mapping subpath

Add a lazy renderer mapping boundary, preferably:

```text
@icarus-graph-explorer/renderer-reactflow/focus-schematic
```

Production default renderer code should not import `focus-schematic-layout`.

The modular mapping consumes:

```text
ViewProjection
FocusSchematicModel
FocusSchematicComputedLayout
rootEntityId
visual variant
```

and produces a renderer graph / prepared React Flow data.

Use existing entity/diagnostic card components where possible.

Do not create a second visual design system for File/Heading/Block cards.

---

# 19. Reuse current entity card data

For every visible projection entity:

1. use the existing mapping logic to derive:
   - title;
   - source path;
   - line;
   - role;
   - disclosure counts;
   - internal reference count;
   - root flag;
   - Visual Group-compatible entity identity;
2. replace its position with A1 candidate geometry;
3. ensure fixed dimensions equal HIER3 input dimensions.

Do not duplicate title/path/disclosure logic in a modular mapper.

A narrow reusable entity-node mapping helper may be extracted from current `mapProjectionToReactFlow`.

Regression-test Classic output byte/shape equality after refactor.

---

# 20. Symmetric React Flow handles

Current entity cards expose only a subset of source/target handles sufficient for Classic:

```text
target-top
source-bottom
target-left
source-right
```

Modular exact endpoints may require:

```text
source-left
source-right
source-top
source-bottom

target-left
target-right
target-top
target-bottom
```

Add the complete symmetric hidden handle set to entity and diagnostic-compatible cards where necessary.

Requirements:

- handles remain visually unobtrusive;
- Classic edge mappings retain their exact current handle IDs;
- adding handles causes no Classic geometry/layout change;
- no user drag-connect authoring is enabled;
- keyboard/ARIA node behavior unchanged.

---

# 21. Internal hierarchy edge mapping

Use:

```text
computedLayout.internalLanePlan.hierarchyAttachments
```

to select appropriate React Flow source/target handles.

Hierarchy semantics remain:

```text
parent → child containment
```

regardless of internal optimization edge reversal used by A1.

Do not reverse the real hierarchy edge.

Visual grammar:

```text
quiet containment
no strong arrow semantics
```

Use current hierarchy-edge styling unless a tiny handle-compatible adjustment is needed.

---

# 22. Precise cross-file reference mapping

For every:

```text
computedLayout.endpointPlan.connections
```

with:

```text
kind = precise
```

render the cross-file edge using its actual:

```text
source projection node
target projection node
authored direction
attachment sides
ReferenceIds
relationship role
```

Map:

```text
source side left  → source-left
source side right → source-right

target side left  → target-left
target side right → target-right
```

If computed attachment side is top/bottom for same-rank display, use the corresponding complete handle set.

Do not replace exact Heading/Block endpoints with File/module centers.

---

# 23. Preserve existing edge selection for precise edges

A precise endpoint connection carries:

```text
projectedEdgeId
```

Use that exact projection edge as the Inspector/selection identity.

Therefore:

```text
click exact modular reference
→ GraphSelection(kind=edge, existing projectionEdgeId)
→ existing Inspector provenance
```

must continue working.

No new Inspector concept is required for precise edges.

Aggregated `ReferenceIds` remain available through the existing projection/inspection path.

---

# 24. Fallback relationship edges

Some HIER1 relationship provenance has:

```text
projectedEdgeId = null
```

because a filtered intermediary or rolled-up context has no exact visible edge.

Render these truthfully as:

```text
fallback schematic relationship
```

using module/document fallback attachments from the endpoint plan.

Do not fabricate a `ProjectionEdgeId`.

HIER3B minimum behavior:

- visible;
- accessible label;
- authored direction;
- reference count/provenance count in edge data;
- visibly distinct from a precise reference;
- not selectable as if it were an ordinary projection edge.

Preferred click behavior for preview:

```text
select the nearest visible owning entity/module
+
announce that this is a filtered/fallback relationship
```

or leave the edge non-selectable with a clear tooltip/ARIA description.

Do not broaden `GraphSelection`/Inspector solely to support fallback edges unless a clean source-neutral inspection seam already exists.

Record this as a deliberate preview limitation for HIER3C if not fully inspectable.

---

# 25. Same-File internal references

HIER1 keeps same-module references separately.

Render visible same-module endpoint groups between their actual visible nodes.

They:

- do not enter macro layout;
- do not create self-loop module relationships;
- preserve existing projection edge selection where a visible projected edge exists;
- use simple direct React Flow routing for now.

Collapsed internal references continue using the existing node badge:

```text
↺ N
```

Do not manufacture self-loop arrows for collapsed internal provenance.

---

# 26. Secondary relationship display

HIER1/HIER3A explicitly classifies:

```text
selected-backbone
other Focus-path
secondary
```

The accepted target is a clean Focus explanation with optional additional context.

In Modular Preview:

```text
selected-backbone / Focus-path references
→ shown by default

secondary references
→ hidden by default
```

Add one **modular-preview-only transient** control:

```text
Secondary links [Off | On]
```

Requirements:

- default Off;
- not persisted in view-state in HIER3B;
- switching it performs:
  - zero projection;
  - zero HIER1 model rebuild;
  - zero worker layout;
  - zero cache invalidation;
- it only changes rendered edge set;
- coordinates remain byte-identical.

Place the control in a compact modular-preview status/controls area, not in the primary Scope/Layout control.

HIER3C may later decide whether/how to persist it.

---

# 27. Reference visual roles

Use a restrained distinction:

```text
selected backbone
→ normal/strong resolved reference

other Focus path
→ normal resolved reference, slightly quieter if helpful

secondary
→ quieter/dashed/contextual treatment

fallback
→ distinct dashed/ghost treatment
```

Do not hard-code color semantics that conflict with future Visual Groups.

Resolution status remains canonical/projection truth.

Do not use color alone.

---

# 28. Full routing remains out of scope

React Flow may initially render modular references as:

```text
straight
or current simple/smooth connector
```

between the exact selected handles.

Do not implement:

```text
Electronic orthogonal routing
rounded Electronic routing
obstacle avoidance
lane channels
waypoints
edge bundling
route persistence
```

Those remain HIER5.

HIER3B should make it obvious in docs that:

```text
endpoint = solved
final route = not solved
```

Avoid calling preview connectors “final routes.”

---

# 29. Module-bound visualization

A core purpose of the new layout is to show that:

```text
File + visible Headings/Blocks
```

form one coherent module.

Render HIER3 candidate module rectangles as a quiet non-interactive background.

Preferred visual:

```text
subtle dashed/low-contrast module outline
```

Requirements:

- not a canonical graph node;
- not selectable;
- not draggable;
- does not create hierarchy edges;
- does not affect React Flow layout;
- sits behind entity cards and edges;
- root module may use a slightly stronger but still quiet boundary;
- Visual Group colors remain on entity cards, not module ownership.

Prefer a viewport-space overlay/portal or another non-topological layer.

Do not use React Flow `parentId` solely to draw module boxes.

---

# 30. Filtered compact bridge

HIER2 selected an anonymous:

```text
72 × 40
```

filtered path bridge.

Production modular preview must render it.

It is:

```text
projection/layout-only
not canonical
not a File entity
not a query leak
```

Requirements:

- no hidden File title/path;
- simple accessible label such as:
  `Filtered path intermediary`;
- dashed/ghost appearance;
- source/target relationship handles available;
- not focusable as a canonical File;
- not passed to Inspector as a real entity;
- supports multiple relationships;
- lives at its candidate module rectangle.

Do not expose the filtered source name in DOM title/ARIA.

---

# 31. Diagnostics — preserve exact projection diagnostics

Do not silently omit diagnostics in Modular Preview.

The A1 candidate reserves diagnostic space but does not position full production diagnostic cards.

HIER3B should preserve current exact diagnostic projection identities and selection.

Preferred implementation:

1. position all A1 entity nodes;
2. treat all A1 module rectangles as occupied geometry;
3. reuse/generalize the HIER0 collision-safe diagnostic placement algorithm;
4. place each current diagnostic node near its owning/source module;
5. test against:
   - entity rectangles;
   - module rectangles where appropriate;
   - already placed diagnostics;
6. keep current diagnostic card visual grammar and projection IDs;
7. render current diagnostic edges from exact source nodes.

Do not invent one aggregated diagnostic summary that loses individual selection.

Do not mutate A1 module coordinates to make diagnostics fit.

If exact full-card placement cannot remain collision-free without large drift, fail the modular attempt for that input and fall back to Classic rather than hiding evidence.

---

# 32. Modular mapping hard gate

Before adopting the prepared React Flow graph, validate:

```text
every visible projection entity represented once
every candidate entity position represented once
no duplicate React Flow node IDs
precise endpoint handles exist
precise projected edge IDs map correctly
fallback edges are explicitly synthetic
filtered bridges are explicitly synthetic
diagnostic projection IDs remain exact
all coordinates finite
module/entity/diagnostic collision policy passes
root entity exists
```

No partial success-shaped graph.

---

# 33. Prepared renderer surface instead of copying GraphCanvas

Do not duplicate the entire `GraphCanvas` interaction/camera implementation.

Preferred refactor:

```text
Classic GraphCanvas
→ owns old mapping + W3 layout lifecycle
→ delegates final interactive graph to shared PreparedGraphSurface

ModularStructuredGraphView
→ owns HIER1 model + modular worker/cache + modular mapping
→ delegates final interactive graph to same PreparedGraphSurface
```

The shared surface should own only behavior that is truly layout-independent:

```text
ReactFlow instance
node/edge render
hover emphasis
selection
disclosure buttons
double-click Focus
pan/zoom
fit
center requests
semantic viewport observation
transition-anchor API
keyboard/pointer synchronization
maximized controls
Visual Group presentation
```

Classic-specific layout lifecycle stays in Classic `GraphCanvas`.

Modular-specific worker/cache lifecycle stays in Modular view.

Do not force one generic “layout engine” abstraction if it obscures the very different payloads.

---

# 34. Classic refactor regression

Any extraction from `GraphCanvas` is accepted only if Classic remains behaviorally identical.

Required regression:

```text
same projection
same Classic mapping
same Dagre input
same W3 request
same adopted positions
same edge handles
same selection behavior
same disclosure
same viewport/fit/center
same fallback
```

Do not combine the Classic and Modular workers.

Do not change HIER0 cache fingerprint semantics while extracting the shared surface.

---

# 35. Modular layout lifecycle

The Modular component should have explicit states:

```text
idle
preparing-model
cache-hit
worker-pending
ready
warning-with-last-valid
fatal-no-valid-result
```

Do not model these as vague booleans.

At minimum track:

```text
current input fingerprint
request generation
last valid computed layout
last valid renderer graph
pending state
warning/failure
```

---

# 36. No stale candidate adoption

A worker result may adopt only when all are still current:

```text
workspace
Focus root
Focus direction/hops
active projection
Hierarchy disclosure/depth
query/filter result
node dimensions
layout settings
algorithm version
component generation
```

Use exact request/fingerprint identity.

Do not compare only request order.

---

# 37. Behavior while new modular layout is pending

## Existing valid modular graph

When a new layout request starts and the previous graph is still semantically safe:

```text
keep the previous graph visible
show a subtle Updating indicator
adopt latest valid result atomically
```

## Previous graph contains removed/stale projection entities

Do not keep visibly deleted entities indefinitely.

Preferred:

```text
clear stale prepared graph
show bounded “Updating hierarchy…” state
```

or render only the intersection safely.

Do not fake a success with stale nodes.

## First ever Modular Preview entry

A short explicit:

```text
Preparing modular hierarchy…
```

state is acceptable in HIER3B.

Do not run Classic W3 invisibly solely to provide a loading animation.

HIER3C may later add prewarming/seed work if evidence says it is necessary.

---

# 38. Atomic modular adoption

When a valid worker result arrives:

1. validate computed layout;
2. map to React Flow;
3. validate prepared renderer graph;
4. capture/use pending semantic transition anchor;
5. commit one prepared graph;
6. restore the semantic screen point;
7. announce readiness only after commit.

Avoid:

```text
old module positions
→ new node positions with old camera
→ camera repair
```

as separate visible frames.

Reuse the same camera-atomic principles already established elsewhere in the project.

---

# 39. Worker failure behavior

Differentiate:

## Request superseded

```text
silent
```

## Compute/validation failure with previous valid modular graph

```text
keep previous valid graph
show nonfatal warning
allow retry on next semantic input or explicit retry
```

## Worker transport/startup failure with no valid modular graph

```text
report modular preview unavailable
automatically render Classic Focus Hierarchy for this session
keep saved preview preference unchanged
```

## Mapping/render validation failure with no valid modular graph

Same:

```text
fallback to Classic
```

Do not automatically persist `classic` merely because one preview attempt failed.

---

# 40. Session fallback state

GraphExplorer should distinguish:

```text
preference = modular-preview
effective implementation = classic-fallback
```

Expose this truthfully in Settings/status:

```text
Modular preview failed; Classic is active for this session.
```

Provide:

```text
Retry modular preview
```

or allow toggling Classic → Modular again.

Do not loop continuously on an identical failing fingerprint.

A new materially different input may retry once according to a documented policy.

---

# 41. Switching Classic ↔ Modular

When the implementation preference changes:

- cancel active worker from the old implementation;
- preserve selection if its projection node/edge still exists;
- preserve Focus;
- preserve hierarchy disclosure;
- preserve filters;
- preserve semantic viewport anchor/zoom;
- do not fit aggressively unless anchor is unavailable;
- no navigation-history entry;
- no source/workspace work.

Switching should not trigger KG10 or report reconstruction.

---

# 42. Live vault update behavior

The desktop live pipeline already changes:

```text
snapshot
→ projection workspace
→ Focus projection
```

Modular Preview must follow the same in-place app update.

On live source change:

```text
new local projection
→ new HIER1 model/input
→ latest-only modular worker
→ exact cache miss/hit
→ atomic modular adoption
```

Preserve surviving:

```text
Focus root
Hierarchy disclosure
selection
Inspector
query
semantic viewport
```

according to existing app reconciliation.

Removed selection clears through existing behavior.

No modular layout state enters KG10 or identity catalogs.

---

# 43. Query / filters

Modular Preview consumes the already-filtered Local projection/HIER1 model.

It must not:

- implement a separate QUERY1 path;
- ignore exact-path exclusions;
- ignore folder exclusions;
- bypass entity/status filters;
- expose filtered File names through compact bridges.

Filtered intermediaries remain anonymous.

Search remains canonical/global as today.

Navigation to a result still reveals/reprojects through KG6, then modular layout recomputes.

---

# 44. Inspector parity

Node selection:

```text
File / Heading / Block
→ exact existing projection node selection
→ existing Inspector
```

Precise edge selection:

```text
exact projectedEdgeId
→ existing Inspector provenance
```

Diagnostic selection:

```text
exact diagnostic projectionNodeId
→ existing Inspector
```

Fallback synthetic relationship:

```text
explicitly limited preview behavior
```

Do not degrade precise node/edge Inspector behavior merely because fallback edges are synthetic.

---

# 45. Visual Groups

Visual Groups remain style-only.

Entity cards in Modular Preview use the same:

```text
VisualGroupPresentationMap
```

and same current node accent semantics.

Visual Group changes must cause:

```text
0 HIER1 model build
0 worker layout
0 cache invalidation
```

Module boxes and filtered bridges must not become members of user Visual Groups.

---

# 46. Focus appearance

Current:

```text
Outline
Inverted
Minimal
```

Focus-root appearance must work on the actual root File card in Modular Preview.

Changing Focus appearance must cause:

```text
0 model rebuild
0 layout
```

Do not style the entire root module as if it were a second semantic root unless the visual design explicitly uses a subtle module outline.

---

# 47. Hierarchy disclosure

Current `+ / −` controls remain on exact File/Heading/Block cards.

Clicking disclosure:

```text
KG6 projection change
→ new HIER1 model
→ modular cache/worker
→ root/selected semantic anchor preserved
```

Do not use React Flow hidden flags as a substitute.

Do not mutate Global/Focus Network topology.

---

# 48. Structure Depth

Current root-scoped Hierarchy Depth remains unchanged.

Changing:

```text
Files only
Depth 1
Depth 2
Depth 3
```

must:

- produce the same Local projection as Classic;
- rebuild modular model/layout;
- keep root screen point stable;
- preserve other app state.

No separate Modular depth model.

---

# 49. Focus rerooting

Double-click/focus behavior remains:

```text
entity
→ existing Focus navigation/reprojection
```

Modular Preview does not implement its own traversal.

On reroot:

```text
new semantic root
→ new local projection
→ new schematic model
→ new modular layout
```

Use existing Focus history/viewport policy.

---

# 50. Fit / center / viewport

Reuse current structured semantics:

```text
Fit
center Search result
Inspector navigation
breadcrumb navigation
history restore
semantic viewport persistence
```

The renderer must center by exact projection node geometry.

Module boxes are not semantic center targets.

Filtered bridge is not a canonical center target.

---

# 51. Accessibility

Modular Preview must preserve existing accessible card semantics.

Requirements:

- File/Heading/Block card labels unchanged;
- disclosure button labels unchanged;
- exact reference edge ARIA labels preserve source/target/provenance count;
- fallback edge label explicitly says filtered/fallback;
- filtered bridge says `Filtered path intermediary`;
- module outline is `aria-hidden`;
- implementation radio controls labelled;
- preview/fallback status announced politely;
- keyboard selection remains synchronized;
- no duplicate tab stop from non-interactive module decoration.

Do not rely on edge color alone.

---

# 52. Module bounds rendering

Module bounds are a visualization of layout ownership, not graph semantics.

Default preview visual:

```text
quiet dashed/low-contrast rectangle
```

Do not label every box with the File name if the File card already identifies it, unless graphical QA shows the module ownership is unclear.

Avoid duplicating the same title visually.

For a filtered bridge, the small bridge itself is enough; do not also draw a huge empty box.

---

# 53. Optional module-bounds debug control

For QA, it is acceptable to expose:

```text
Show module bounds
```

inside the Experimental modular-preview section.

Prefer:

```text
default On during HIER3B preview
```

if the visual grouping is useful, or keep it a development-only flag if it clutters the product.

Do not persist it in view-state.

The user graphical gate decides whether module boundaries should remain visible in HIER3C.

---

# 54. Modular status indicator

When Modular Preview is active, show a compact nonintrusive status:

```text
Modular preview
```

Optionally include:

```text
Updating…
Classic fallback
```

Do not fill the canvas with technical terminology such as:

```text
HIER3A
A1
worker request
network-simplex
```

Technical metrics remain diagnostics/instrumentation.

---

# 55. Performance operation contracts

## Hover

```text
0 projection
0 HIER1 model
0 worker
0 layout
```

## Selection

```text
0 projection
0 HIER1 model
0 worker
0 layout
```

## Pan / zoom

```text
0 projection
0 HIER1 model
0 worker
0 layout
```

## Inspector open/close

```text
0 layout
```

## Visual Group style change

```text
0 layout
```

## Secondary links toggle

```text
0 projection
0 model
0 worker
0 layout
render edges only
```

## Focus appearance

```text
0 layout
```

## Hierarchy depth / disclosure

```text
1 Local projection
1 HIER1 model
cache hit OR 1 latest modular worker job
```

## Query/filter semantic change

Same.

## Live snapshot change affecting Focus

Same.

## Implementation switch

```text
Classic → Modular:
no projection if Local projection unchanged
build model + cache/worker

Modular → Classic:
no modular worker
Classic existing W3 lifecycle
```

---

# 56. Main-thread budget evidence

Instrument separately:

```text
Focus Schematic model construction
dimension adapter
cache-key serialization
worker request preparation
worker response adoption
React Flow modular mapping
```

For ordinary Focus interactions, watch the existing direct-feedback budget:

```text
Class A p95 ~32 ms
```

The whole layout may be Class B because it is off-thread.

If model/input preparation alone creates large main-thread stalls on ordinary medium Focus, address that before adoption.

Do not move unrelated KG6 logic to a worker preemptively.

---

# 57. Worker responsiveness benchmark

Add a HIER3B-specific benchmark using the actual browser worker/client path.

Profiles:

```text
small
medium
hub/stress
rapid supersession burst
```

Record:

```text
worker compute
round trip
startup
main-thread high gap
serialized input/output bytes
cache behavior
superseded requests
```

A large stress result may exceed 250 ms wall time; the UI thread must remain responsive.

No CI timing threshold.

---

# 58. Rapid-disclosure supersession test

Simulate:

```text
Depth 0
→ Depth 1
→ Depth 2
→ Depth 3
```

faster than the worker completes.

Required:

- intermediate requests superseded;
- only final Depth 3 candidate adopted;
- no stale flash;
- no worker leak;
- transition anchor remains valid;
- result matches direct final computation exactly.

---

# 59. Cache performance test

Test:

```text
Focus A, Depth 2
→ Modular result

switch Classic
→ switch Modular again without semantic change
```

Expected:

```text
exact cache hit
0 worker compute
same candidate geometry
semantic viewport restored
```

Then modify one layout-relevant input:

```text
Depth change
query change
Focus reroot
```

Expected cache miss.

Change:

```text
selection
hover
Visual Group
secondary toggle
```

Expected same cache key.

---

# 60. Renderer graph oracle

For representative fixtures compare production modular mapping against HIER3A computed result.

Assert:

```text
entity node positions exactly match candidate
entity node dimensions exactly match input
module rectangles exactly match candidate
precise edge endpoints match endpoint plan
handle side matches attachment plan
hierarchy handle side matches lane plan
filtered bridge geometry matches selected module rectangle
secondary visibility does not alter geometry
```

Use numeric or exact structural equality, not screenshots only.

---

# 61. Classic parity regression

Before and after HIER3B:

```text
same Classic Local projection
→ same mapProjectionToReactFlow result
→ same W3 Dagre input
→ same cached/fallback semantics
```

Run current HIER0/HIER3A Classic regression suites.

Do not allow the shared-surface refactor to alter Classic visual behavior incidentally.

---

# 62. Synthetic production integration fixture

Add a production-level React/browser fixture containing:

```text
incoming File
focused File
outgoing File
Heading → Heading precise reference
File → Heading
Heading → File
multi-hop intermediary
Block endpoint
filtered bridge
diagnostic
secondary edge
```

Verify:

- exact cards appear;
- correct side handles;
- selection;
- Inspector;
- disclosure;
- secondary toggle;
- module outline;
- fallback bridge;
- diagnostic selection;
- Focus reroot.

Use synthetic names only.

---

# 63. Real private-vault validation

Optional but strongly useful before HIER3C.

If the ignored real vault is available, report aggregate-only:

```text
Focus root cases tested
modules
visible entities
relationships
precise/fallback connection counts
worker timings
cache timings
rendered node/edge counts
```

Do not commit:

```text
File names
Heading names
paths
screenshots
raw topology
search queries
```

No real note content is required.

---

# 64. Browser QA

Production browser QA with Modular Preview enabled must cover:

```text
enter Focus
switch Network ↔ Hierarchy
Classic ↔ Modular preview
Depth 0/1/2/3
+ / − disclosure
incoming/outgoing/both Focus
1/2/3 hops
reroot
selection
hover
Inspector
Search navigation
breadcrumb navigation
query/filter
Visual Groups
secondary links Off/On
Fit
pan/zoom
maximize
narrow viewport
Settings
live-like snapshot replacement harness
```

No console errors/warnings attributable to HIER3B.

---

# 65. Release Tauri graphical gate

HIER3B changes production code, even though Classic remains default.

Build a fresh optimized executable and require user QA before final merge.

User should inspect at minimum:

## Classic

```text
Classic still looks and behaves exactly as before.
```

## Modular preview

Representative cases:

```text
simple one-hop
two-sided root
multi-hop intermediary
Heading→Heading
Block endpoint
large fan
filtered bridge
diagnostic
```

Check:

- exact endpoints;
- root centering;
- module grouping;
- no overlap;
- no stale layout flash;
- disclosure;
- reroot;
- camera preservation;
- secondary toggle;
- Inspector;
- touchpad/pan/zoom;
- live update if practical.

## Switching

```text
Classic ↔ Modular
```

should preserve context rather than jump arbitrarily.

Do not record manual pass before user confirms it.

---

# 66. Failure QA

Inject deterministic failures:

```text
worker startup
malformed response
worker compute failure
computed-layout validation failure
renderer mapping validation failure
stale response
cache corruption
```

Expected:

- previous valid modular graph retained when safe;
- otherwise Classic fallback;
- no app-shell crash;
- no silent blank graph;
- no persistent preference rewrite;
- actionable status;
- retry works.

---

# 67. Build / chunk QA

Record:

```text
main web chunk
Classic W3 worker chunk
Modular preview lazy component chunk
Modular schematic worker chunk
```

Goal:

- modular code remains lazy;
- main bundle does not absorb Dagre/focus-schematic-layout twice unnecessarily;
- Classic default startup is not materially penalized.

Do not optimize chunk size blindly if separation is already clean.

---

# 68. No new dependencies

Expected external additions:

```text
zero
```

Reuse:

```text
React
React Flow
existing focus-schematic packages
existing Dagre
existing performance utilities
```

Do not add:

```text
ELK
d3-dag
web-worker helper libraries
state libraries
routing libraries
```

---

# 69. HIER5 note — routing styles

HIER3B must preserve a clean seam for the later user-facing route styles:

```text
Direct

Electronic
→ horizontal/vertical orthogonal routing

Electronic — Rounded
→ same orthogonal route geometry with rounded corners
```

Do not implement them now.

The modular mapper should therefore consume:

```text
exact source/target attachment semantics
```

without baking one final edge-path algorithm into the model.

HIER5 can replace the edge-path renderer while preserving node/module geometry.

---

# 70. HIER4 note — folder bands

HIER3B may render existing module positions and existing folder metadata.

Do not introduce Hierarchy folder clustering/bands in this milestone.

HIER4 will decide:

```text
root folder central band
same-folder adjacency
soft vertical grouping
folder-strength behavior
```

Avoid architecture that makes module positions impossible to post-process later.

---

# 71. HIER3C handoff

HIER3B should leave product state ready for:

```text
modular = default Focus Hierarchy
classic = preserved optional fallback
```

But do not perform that flip.

HIER3C will own:

```text
new default
migration behavior
final product naming
Settings → Experimental → Show Classic Focus Hierarchy
removal/replacement of the temporary Modular Preview radio
final fallback semantics
final product QA
```

Keep HIER3B preview preference simple enough to migrate cleanly.

---

# 72. Documentation

Add:

```text
docs/HIER3B_MODULAR_PRODUCTION_PREVIEW.md
docs/HIER3B_VALIDATION.md
```

Update:

```text
packages/focus-schematic-layout/README.md
packages/renderer-reactflow/README.md
apps/web/src/components/README.md
apps/web/src/preferences/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
```

Add an ADR only if HIER3B introduces a durable worker/renderer boundary not already implied by ADR 0019.

Likely ADR:

```text
0020-production-modular-focus-hierarchy-worker-preview.md
```

Record:

- separate modular worker;
- Classic W3 unchanged;
- lazy preview integration;
- cache ownership;
- prepared renderer boundary;
- exact endpoint mapping;
- fallback behavior;
- no route ownership yet.

Do not rewrite ADR 0018/0019.

Archive this exact prompt under:

```text
history-implementations/HIER3B_production_modular_worker_reactflow_preview_codex_prompt.md
```

---

# 73. Roadmap update

After successful merge:

```text
HIER0 — Complete
HIER1 — Complete
HIER2 — Complete
HIER3A — Complete: A1 endpoint-facing selected
HIER3B — Complete: modular production preview
HIER3C — Next: modular default + Classic Experimental preservation
HIER4 — Later
HIER5 — Later
```

If HIER3B integration exposes an unresolved production blocker:

```text
HIER3B — In progress / blocked
```

Do not mark HIER3C next until the release graphical gate passes.

---

# 74. Likely implementation areas

Inspect latest `main` first.

Likely:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GraphSettings.tsx
apps/web/src/components/LocalStructuredGraphView.tsx
apps/web/src/components/ModularStructuredGraphView.tsx       new
apps/web/src/components/use-worker-service-disposal.ts

apps/web/src/preferences/graph-preferences.ts
apps/web/src/preferences/sandbox-settings.ts

apps/web/src/workers/focus-schematic-layout-worker-client.ts  new
apps/web/src/workers/focus-schematic-layout.worker.ts         new

packages/focus-schematic-layout/src/worker-protocol.ts         likely new
packages/focus-schematic-layout/src/worker-runtime.ts          likely new
packages/focus-schematic-layout/package.json exports

packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/mapping.ts
packages/renderer-reactflow/src/prepared-graph-surface.tsx     likely new
packages/renderer-reactflow/src/focus-schematic/*              likely new
packages/renderer-reactflow/package.json exports

apps/web/src/components/hierarchy-availability.test.tsx
apps/web/src/workers/*tests*
packages/renderer-reactflow/src/*tests*
packages/focus-schematic-layout/src/*tests*

tools/vault-diagnostics/src/*focus-schematic-production-benchmark*
```

Do not mechanically create every suggested file. Follow current package organization.

---

# 75. Implementation sequence

## Phase 1 — baseline + preview state

1. Sync latest `main`.
2. Inspect open PRs/worktrees.
3. Run focused Classic/HIER3A baselines.
4. Add `focusHierarchyImplementation` preference.
5. Add backward-compatible storage tests.
6. Add Experimental Settings controls.
7. Add Sandbox reset behavior.
8. Add Classic↔Modular semantic transition-anchor plan.
9. Keep Classic default.

## Phase 2 — worker protocol

10. Add versioned modular worker request/response contract.
11. Add strict protocol validators.
12. Add source-neutral worker runtime.
13. Add browser worker entry.
14. Add latest-result-wins client.
15. Add supersession/cancel/dispose tests.
16. Add malformed/transport failure tests.
17. Add worker instrumentation.

## Phase 3 — model/input/cache

18. Add lazy ModularStructuredGraphView.
19. Pass ProjectionWorkspace/state/projection narrowly.
20. Build/instrument HIER1 model only when modular active.
21. Add production node-dimension adapter.
22. Use exact frozen layout settings.
23. Add deterministic exact input serialization/fingerprint.
24. Add bounded page-lifetime computed-layout cache.
25. Validate cache hits.

## Phase 4 — renderer preparation

26. Extract a shared prepared React Flow surface if needed.
27. Prove Classic parity after extraction.
28. Add symmetric source/target handles.
29. Add modular entity mapping from current card data.
30. Apply A1 candidate positions.
31. Add module-bound overlay.
32. Add filtered bridge node.
33. Map hierarchy attachments.
34. Map precise cross-file endpoint edges.
35. Map same-file internal visible references.
36. Add fallback edges truthfully.
37. Place exact diagnostic nodes collision-safely.
38. Validate prepared graph before adoption.

## Phase 5 — modular lifecycle

39. Add explicit modular lifecycle state.
40. Wire worker/cache adoption.
41. Add atomic viewport-anchor adoption.
42. Add first-load pending state.
43. Add previous-valid retention.
44. Add Classic session fallback.
45. Add retry.
46. Cancel on Focus exit/workspace switch/Classic switch.
47. Add secondary-links transient toggle.
48. Prove zero layout work for secondary toggle.

## Phase 6 — app integration

49. Dynamically load modular component only when selected.
50. Preserve Focus/selection/Inspector/query/history.
51. Preserve structured semantic viewport persistence.
52. Integrate Search/center/navigation requests.
53. Integrate live snapshot updates.
54. Integrate Visual Groups style-only behavior.
55. Integrate Focus appearance.
56. Integrate Hierarchy depth/disclosure/reroot.

## Phase 7 — performance / failure / QA

57. Add modular worker responsiveness benchmark.
58. Add rapid supersession benchmark.
59. Add cache hit/miss benchmark.
60. Add renderer graph oracle.
61. Add injected failure matrix.
62. Record chunks.
63. Run production browser QA.
64. Build fresh release executable.
65. Ask user for graphical/native QA.
66. Wait for user approval.

## Phase 8 — finalize

67. Fix only evidence-backed integration defects.
68. Re-run full validation.
69. Integrate latest `main` if necessary.
70. Update docs/ADR/roadmap.
71. Archive exact prompt.
72. PR → CI.
73. Merge after user authorization.
74. Verify post-merge CI.
75. Remove only HIER3B branch/worktree.
76. Stop. Do not start HIER3C automatically.

---

# 76. Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:focus-schematic-endpoints -- --profile small
pnpm benchmark:focus-schematic-endpoints -- --profile medium
pnpm benchmark:focus-schematic-endpoints -- --profile hub

pnpm benchmark:focus-schematic-production-worker -- --profile small
pnpm benchmark:focus-schematic-production-worker -- --profile medium
pnpm benchmark:focus-schematic-production-worker -- --profile hub
pnpm benchmark:focus-schematic-production-worker -- --profile supersession

pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

If scripts differ, create current equivalents and document them.

No new timing CI gate.

---

# 77. Required automated scenarios

## Preferences

```text
legacy graph preference record
→ Classic

classic save/load

modular-preview save/load

malformed value
→ Classic

unrelated preference write preserves implementation

Reset Sandbox
→ Classic
```

## Worker

```text
successful request
failure request
malformed request
malformed response
request A superseded by B
cancel
dispose
worker error
messageerror
startup throw
same request cold determinism
```

## Cache

```text
exact hit
Depth change miss
query/filter miss
Focus reroot miss
visual style unchanged hit
selection unchanged hit
secondary toggle unchanged hit
invalid cache entry → miss
bounded eviction
```

## Renderer mapping

```text
File exact position
Heading exact position
Block exact position
root
left/right handles
top/bottom auto handle
hierarchy attachment
Heading→Heading
Heading→File
File→Heading
Block endpoint
internal same-file reference
filtered bridge
fallback edge
diagnostic
module outline
```

## Interaction

```text
node click
edge click precise
double-click Focus
+ / − disclosure
keyboard selection
hover
Inspector
Fit
center
viewport observation
transition anchor
```

## App integration

```text
Classic default
enable Modular Preview
switch Classic→Modular
switch Modular→Classic
Focus Network→Hierarchy with modular selected
Focus exit
Back/Forward
Search
query
Visual Groups
live snapshot
workspace switch
```

## Failure

```text
no valid modular graph + worker failure → Classic
valid modular graph + next failure → retain valid
retry
preference remains modular
no loop
```

---

# 78. Product graphical-review checklist

The user should not need technical test-case names.

Provide a review list such as:

### Simple relationship

```text
Focus File Heading → another File Heading
```

Check exact endpoints and module grouping.

### Incoming + outgoing

Check:

```text
incoming modules left
Focus center
outgoing modules right
```

### Multi-hop

Check middle File:

```text
target Heading on left side
source Heading on right side
```

### Blocks

Check exact Block endpoint.

### Filtered query

Check anonymous bridge reveals no hidden File name.

### Diagnostics

Check unresolved/ambiguous/invalid nodes remain visible and selectable.

### Disclosure

Expand/collapse without root camera jump.

### Switching

Classic ↔ Modular preserves screen context.

### Secondary links

Off → clean Focus paths.
On → extra context appears without any node movement.

### Touchpad

Pan/zoom remains current behavior.

---

# 79. Exit gate

HIER3B is complete only when:

1. latest `main` is used.
2. unrelated worktrees/user changes are preserved.
3. Classic is still the default.
4. graph preference v1 gains a backward-compatible implementation field.
5. old preferences load as Classic.
6. Reset Sandbox restores Classic.
7. Experimental Settings exposes Classic/Modular Preview.
8. `Show All Hierarchy` remains separate.
9. implementation switching creates no graph-history checkpoint.
10. semantic viewport is preserved across implementation switch.
11. Focus state is preserved.
12. query/filter state is preserved.
13. selection is preserved when representable.
14. dedicated modular worker exists.
15. Classic W3 remains independently unchanged.
16. modular protocol is versioned.
17. request input is strictly validated.
18. response is strictly validated.
19. latest-result-wins works.
20. cancellation works.
21. disposal works.
22. stale responses cannot adopt.
23. worker transport failure is safe.
24. worker chunk is lazy.
25. modular component is lazy.
26. HIER1 model builds only when modular active.
27. model build has narrow dependencies.
28. model build is instrumented.
29. production dimensions derive from renderer truth.
30. frozen HIER3A settings are used.
31. exact page-lifetime cache exists.
32. cache key includes all layout-relevant state.
33. cache excludes selection/hover/viewport/styles.
34. cache hits validate.
35. invalid cache is a miss.
36. raw coordinates are not persisted.
37. shared React Flow surface prevents interaction duplication.
38. Classic parity passes after any refactor.
39. entity cards reuse current data/visual grammar.
40. symmetric source/target handles exist.
41. Classic handle mapping remains unchanged.
42. hierarchy edges use HIER3A attachment semantics.
43. precise cross-file edges use exact File/Heading/Block endpoints.
44. authored source→target direction is preserved.
45. precise projected edge selection opens existing Inspector.
46. fallback edges never fabricate projection IDs.
47. fallback edges are visibly/accessibly distinct.
48. same-file precise references remain supported.
49. collapsed internal references remain badges, not self-loops.
50. secondary links are hidden by default.
51. secondary toggle performs zero layout work.
52. module bounds are non-topological.
53. module bounds do not alter graph semantics.
54. filtered bridge is anonymous.
55. filtered bridge leaks no hidden path/title.
56. filtered bridge is not canonical/selectable as File.
57. diagnostics are not omitted.
58. diagnostic projection IDs remain exact.
59. diagnostics remain collision-safe.
60. prepared renderer graph validates before adoption.
61. no success-shaped partial graph exists.
62. explicit modular lifecycle states exist.
63. previous valid graph survives safe transient failure.
64. first-load failure falls back to Classic.
65. preview preference is not rewritten on failure.
66. retry works.
67. live updates re-layout modular view correctly.
68. surviving Focus/disclosure/viewport state remains.
69. Search navigation works.
70. breadcrumb/Inspector navigation works.
71. Visual Groups remain style-only.
72. Focus appearance causes zero layout work.
73. Hierarchy Depth works.
74. +/− disclosure works.
75. reroot works.
76. Fit/center works.
77. accessibility parity is maintained.
78. module/bridge accessibility is truthful.
79. main-thread preparation is measured.
80. worker responsiveness is measured.
81. supersession benchmark passes.
82. cache benchmark passes.
83. worker/main bundle chunks are recorded.
84. no new external dependency is added.
85. HIER4 folder bands are not implemented.
86. HIER5 routing is not implemented.
87. Direct/Electronic/Rounded route architecture remains possible.
88. view-state schema is unchanged.
89. persistence schema is unchanged except additive graph preference field.
90. synthetic production integration fixture passes.
91. production browser QA passes.
92. release desktop build passes.
93. user release graphical QA passes.
94. injected failure QA passes.
95. focused tests pass.
96. full `pnpm check` passes.
97. desktop check/build pass.
98. HIER3B docs exist.
99. ADR 0020 exists if warranted.
100. roadmap marks HIER3C next only after all gates.
101. exact prompt is archived.
102. PR CI passes.
103. post-merge CI passes.
104. task branch/worktree cleanup completes.
105. HIER3C is not started automatically.

---

# 80. Final report

## 1. Summary

State that A1 is now available in the real app as Modular Preview while Classic remains default.

## 2. Product exposure

Preference, Settings, reset and switching behavior.

## 3. Worker architecture

Protocol, latest-only lifecycle, client/worker ownership and failure recovery.

## 4. Main-thread preparation

HIER1 model and dimension preparation evidence.

## 5. Cache

Key, bound, validation, hit/miss evidence.

## 6. Renderer mapping

Module bounds, entity cards, filtered bridge, diagnostics.

## 7. Exact endpoints

File/Heading/Block connections, handles, provenance and Inspector behavior.

## 8. Secondary relationships

Default visibility and zero-layout toggle.

## 9. Camera / history / persistence

Classic↔Modular, disclosure, reroot and live updates.

## 10. Failure behavior

Previous-valid retention, Classic fallback and retry.

## 11. Performance

Worker compute/round-trip/main-thread gap, mapping and cache.

## 12. Bundle evidence

Main/lazy/worker chunks.

## 13. Tests / browser / Tauri QA

Separate automated evidence from user-confirmed release QA.

## 14. Classic preservation

Confirm current HIER0/D0 behavior remains independently testable and default.

## 15. Routing boundary

Confirm exact endpoints are production-ready but complete Direct/Electronic/Rounded routing remains HIER5.

## 16. Folder boundary

Confirm HIER4 is not implemented.

## 17. Files changed

Important areas only.

## 18. Dependencies

Expected external additions:

```text
zero
```

## 19. Documentation / ADR / prompt

## 20. Deviations / preview limitations

Especially any fallback-edge Inspector limitation or diagnostic placement compromise.

## 21. Follow-up

State:

```text
HIER3B complete
HIER3C — modular default + Classic behind Experimental — next
```

Do not implement HIER3C automatically.
