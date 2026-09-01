# KG13B2B — Local Structured Schematic Presentation + KG13 Completion

**Task type:** alternate Local renderer / React Flow schematic visual grammar / shared Local projection / cross-layout transition + persistence / final KG13 integration

## Goal

Complete KG13 by adding **Local Structured** as a second presentation of the already-tested Local projection.

```text
GLOBAL
Sigma
Files / network overview
        ↓ semantic zoom

REGIONAL
Sigma
same geometry / richer visual LOD
        ↓ Focus / Open Local

LOCAL
same bounded KG6 Local projection
        ↓
┌──────────────────────┬─────────────────────────┐
│ Free                 │ Structured              │
│ Sigma                │ React Flow + W3 Dagre   │
│ network layout       │ schematic hierarchy     │
└──────────────────────┴─────────────────────────┘
```

The user-facing Local control becomes:

```text
Local layout:
Free
Structured
```

The two Local layouts must share the exact same `projectLocalView(...)` output, root document, KG6 Focus neighborhood, disclosure state, filters / QUERY1 state, canonical Search and Inspector, selection where representable, Local semantic viewport/history, and live source updates.

They differ only in **presentation and layout**.

If all gates pass:

```text
KG13 — Complete
KG14 — Next
```

Do not begin KG14 automatically.

---

# Why this milestone must not redesign Local

KG13B2A already solved the hard semantic questions:

```text
Local root = stable document
Local neighborhood = KG6 Focus
Local hierarchy = KG6 disclosure
Local projection = bounded document neighborhood + visible hierarchy
Global topology remains documents-only
```

B2B must consume that exact contract.

Do not add another Local traversal algorithm, new focus state, renderer-owned hierarchy, Structured-specific canonical projection, or Structured-specific query system.

The milestone is:

```text
one Local truth
→ two Local presentations
```

not two different Local semantics.

---

# Current repository evidence

Repository: `lillo24/icarus-graph-explorer`

KG13B2A merged through PR #34 at:

`f69abeba57bb4ce2db0d2b10fe14af3c35e83dd9`

PR #34 completed:

- explicit `structure | global | local` presentation state;
- view-state schema v3;
- v1/v2 → v3 migration;
- Local semantic viewport with `freeRatio` and reserved `structuredZoom`;
- bounded `projectLocalView(...)`;
- root-document KG6 Focus authority;
- root top-level disclosure seed;
- Local Free Sigma renderer;
- File / Heading / Block / diagnostic Local node roles;
- hierarchy/reference Local edges;
- deterministic immediate seed;
- separate latest-only Local ForceAtlas2 worker;
- memory-only Local layout cache;
- Global → Local viewport-point anchor;
- Search / Inspector / disclosure / history;
- live-update root survival/loss behavior;
- operation-count isolation from Global layout.

ADR 0014 explicitly states:

```text
LocalLayoutMode = 'free' | 'structured'
```

already exists as the B2B seam, while production currently exposes only Free.

The current preference loader recognizes the type but deliberately falls back to `free` until Structured ships.

The Local viewport already reserves:

```text
anchorEntityId
freeRatio
structuredZoom?
```

Therefore **do not create view-state schema v4** merely to add Structured.

---

# QUERY1 is already merged

QUERY1 merged through PR #33 before KG13B2A.

Current Local projection/filter/navigation already sits on top of the merged query/filter architecture.

B2B must preserve QUERY1 semantics, Saved Filters, current query history/persistence, and avoid a renderer-owned query implementation.

---

# Required first inspection

Before editing:

1. sync latest `main`;
2. verify the task worktree is clean;
3. preserve unrelated untracked implementation-plan files in the primary checkout;
4. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/PERFORMANCE.md`;
   - `docs/ROADMAP.md`;
   - `docs/GLOBAL_RENDERER_DECISION.md`;
   - ADR 0013 and ADR 0014;
   - `packages/view-projection/src/local.ts`;
   - Local projection tests/README;
   - `packages/view-state/src/types.ts` and migration tests;
   - `packages/renderer-sigma/src/LocalGraphCanvas.tsx`;
   - `local-session.ts`, `local-mapping.ts`, `local-style.ts`, `local-layout.ts`;
   - `packages/renderer-reactflow/README.md`;
   - `GraphCanvas.tsx`, `types.ts`, `mapping.ts`, `nodes.tsx`, `edges.tsx`, `layout.ts`;
   - viewport/disclosure-anchor helpers;
   - `packages/dagre-layout/src/types.ts`, `compute.ts`;
   - W3 worker/client;
   - `apps/web/src/components/LocalGraphView.tsx`;
   - `GraphExplorer.tsx`;
   - preferences/history/navigation;
   - Local benchmark tooling;
5. inspect any newer PR/UX work before final integration;
6. preserve current UI behavior unless this milestone explicitly changes Local presentation.

---

# Core product distinction

Keep these distinct:

```text
Structure
= general hierarchical renderer / exact DOM graph

Local Structured
= bounded Local projection shown schematically

Local Free
= same bounded Local projection shown as a force-directed network
```

Local Structured is **not** a rename of Structure.

Structure may show a broader user-selected structural graph.

Local Structured always consumes the bounded Local projection created by KG13B2A.

---

# User-facing Local layout toggle

When `presentationMode === 'local'`, expose a compact:

```text
Local layout
[ Free ] [ Structured ]
```

control.

Requirements:

- accessible;
- keyboard operable;
- clear active state;
- visible only in Local;
- switching layout does **not** change Local root/focus/disclosure/query/filter state;
- switching layout does **not** create a new KG6 projection if projection inputs are unchanged;
- preference persists through existing graph preferences;
- default remains `free`;
- after B2B, stored `structured` is accepted rather than forced back to `free`.

The layout toggle is a presentation preference, not a canonical graph mutation.

Do not turn it into a duplicate Structure/Global/Local presentation mode.

---

# History policy for Free / Structured

Do not clutter graph navigation history with every Local layout preference toggle.

Recommended rule:

```text
presentationMode = local
LocalLayoutMode = user preference
```

History checkpoints continue to store semantic Local state and Local viewport.

The current preferred Local layout decides which renderer presents a restored Local checkpoint.

Future Saved Views may explicitly capture Local layout mode.

Document this policy.

---

# Same Local projection — hard invariant

For any Local state:

```text
projectLocalView(workspace, state)
```

is computed once.

Then:

```text
Local Free mapper
and
Local Structured mapper
```

consume the same `ViewProjection`.

Switching Free ↔ Structured must perform:

```text
0 Local KG6 reprojections
```

unless independent semantic state also changed.

Add an operation-count test.

---

# Local Structured renderer boundary

Add a production React Flow Local Structured boundary without duplicating `GraphCanvas` wholesale.

Preferred architecture:

```text
renderer-reactflow
  existing generic canvas/layout lifecycle
      +
  local-structured presentation variant
```

Potential implementation:

```text
GraphCanvas
  visualVariant:
    standard
    local-structured

  layoutMode:
    structure
    focus
    local-structured
```

or an equivalently clean composition.

Do not copy the entire current `GraphCanvas.tsx` into a second large Local component.

Refactor only the narrow seams required for compact Local Structured node mapping, local layout mode, entry-anchor handling, and memory cache.

Keep standard Structure behavior unchanged.

---

# Explicit Local Structured Dagre mode

Do not silently overload the existing `focus` mode forever.

Preferred:

```ts
DagreLayoutMode =
  | 'structure'
  | 'focus'
  | 'local-structured'
```

because Local Structured should be independently tunable.

Target geometry:

```text
left-to-right schematic hierarchy
hierarchy strongly influences ranks
references remain secondary cross-links
compact node separation
deliberate rank separation
```

Current `focus` mode is a useful baseline. Compare it against a narrow `local-structured` configuration and choose evidence-backed settings.

Do not add another layout engine.

Do not redesign W3.

The same W3 latest-result-wins worker should compute the new Dagre mode.

---

# Dagre protocol/version rule

Extending the mode enum should remain compatible with the existing W3 architecture.

Do not bump protocol versions merely for ceremony.

Bump only if runtime validation/transport compatibility actually requires it.

Add direct worker-vs-sync oracle tests for Local Structured.

---

# Structured visual target

The intended feel is:

```text
Vivado / electronics / schematic
```

rather than large document cards floating in a generic graph.

Conceptual grammar:

```text
File        ▰
Heading     ◇
Block       ●
Diagnostic  ○
```

This is a visual direction, not a requirement to force long labels inside literal tiny shapes.

Prefer a readable schematic treatment such as:

```text
shape/marker + compact label
```

Hard requirements:

- File / Heading / Block visually distinct;
- compact compared with normal Structure cards;
- root File visibly emphasized;
- hierarchy easy to scan;
- reference edges visibly secondary;
- no giant metadata cards;
- exact metadata remains in Inspector.

---

# Local Structured node mapping

Create a separate React Flow mapping variant.

Do not change standard Structure dimensions/markup just to make Local compact.

A likely pattern:

```text
mapProjectionToReactFlow(..., visualVariant)
```

or:

```text
mapProjectionToLocalStructuredReactFlow(...)
```

while sharing title disambiguation, stable renderer IDs, canonical IDs, disclosure counts, ARIA labels, and projection-edge semantics.

Local Structured must accept the same node kinds as Local Free:

```text
document
section
block
diagnostic
```

No folder/group nodes.

---

# Compact node dimensions

Choose measured dimensions appropriate to the schematic grammar.

Goals:

- materially smaller than standard Structure cards;
- readable at default Local zoom;
- enough room for disclosure;
- labels may truncate visually with full title available via title/Inspector.

Do not hardcode sizes before checking actual CSS/rendered labels.

Report final dimensions.

---

# Node markup / accessibility

Local Structured remains DOM-backed.

Keep:

- focusable nodes;
- ARIA labels;
- keyboard selection;
- accessible Expand/Collapse;
- visible focus indicator;
- full title available accessibly.

If using marker + label, keep the marker decorative and the semantic node accessible.

Do not make the geometric marker the only interactive target.

---

# Disclosure in Structured

Reuse `EntityDisclosureProvider` and KG6 disclosure actions.

Compact nodes still need:

```text
Expand
Collapse
```

with pointer and Enter/Space support.

Expanding a Local heading must:

```text
change Local projection
→ request Local Structured W3 layout
→ preserve disclosure anchor
→ 0 Global layout requests
```

Reuse the existing disclosure-anchor mechanism.

---

# Local Structured edges

Use schematic routing.

Existing React Flow `getSmoothStepPath` is a strong starting point.

Hierarchy:

```text
orthogonal / smooth-step
stronger visual weight
small border radius / schematic bends
```

Reference:

```text
lighter / secondary
visually distinct from hierarchy
```

Diagnostic status remains explicit.

Do not add a custom general-purpose edge router.

Do not add edge labels everywhere.

---

# Edge selection

Structured may retain React Flow edge selection and exact provenance inspection.

Policy:

```text
Structured edge selected
→ Inspector can inspect edge

switch Structured → Free
→ clear edge visual selection
→ announce if needed
```

Node selection should survive both directions.

Do not add Sigma edge events for parity.

---

# Local Structured root geometry

After Dagre returns:

```text
translate positions
→ root document becomes local structured origin
```

This is derived geometry only.

Do not persist coordinates.

This supports stable cross-layout anchoring and deterministic cache results.

---

# Free ↔ Structured screen anchor

Switching Local layouts should preserve spatial context.

Anchor priority:

```text
selected visible entity
else
Local root document
```

Before switching, capture that node's runtime viewport point from the active renderer.

Then mount the new renderer so the same semantic node appears near the same screen point.

If capture is unavailable, semantic-center the anchor entity.

Do not block the switch.

Do not persist viewport points.

---

# Narrow viewport-point query APIs

Local Free already owns `LocalRendererSession.nodeViewportPoint(...)`.

Expose the narrowest safe React boundary needed by orchestration.

Likewise, React Flow Local Structured should expose a runtime-only query for one projected node's viewport point.

Do not expose Sigma, Graphology, ReactFlow instances, or all node coordinates.

A narrow conceptual contract is enough:

```ts
type NodeViewportPointQuery =
  (projectionNodeId: ProjectionNodeId) =>
    { x: number; y: number } | undefined
```

---

# Do not add viewport points to persistence

Persistence remains:

```text
Local:
  anchorEntityId
  freeRatio
  structuredZoom
```

No schema v4.

No raw Sigma camera x/y.

No raw React Flow transform.

No Local node positions.

---

# Structured semantic viewport

Use React Flow semantic viewport observation.

Map:

```text
anchorEntityId + zoom
```

into:

```text
PersistedLocalViewport:
  anchorEntityId
  structuredZoom
  preserve freeRatio
```

Free observations update `freeRatio` and preserve `structuredZoom`.

The two renderers intentionally share one semantic anchor entity.

---

# Local layout preference persistence

The graph-preference layer already contains `localLayoutMode`.

B2B should:

- accept `free`;
- accept `structured`;
- persist either;
- keep default `free`;
- remain independent from KG9 identity;
- remain future Saved-View-compatible.

Do not create another storage key if current graph preferences suffice.

---

# Reset behavior

Preserve the distinction:

```text
saved view
vs
graph preferences
```

`Reset saved view` should not silently redefine the user's Local layout preference unless current preference-reset semantics intentionally reset all graph preferences.

Document the final behavior.

---

# Structured exact layout cache

Switching back to Structured should not recompute an identical Local layout unnecessarily.

Add a bounded memory-only Local Structured layout cache keyed by deterministic layout input/fingerprint:

```text
local-structured mode/version
stable renderer node IDs
node dimensions
edge IDs/endpoints/kinds
```

Exclude selection, hover, camera, query text, source body.

Exact hit:

```text
show cached Dagre positions immediately
→ skip W3
```

No persistent positions.

---

# Changed Structured projection

When disclosure/focus changes:

- keep a usable graph visible;
- show deterministic Structured seed for latest topology if no exact cache;
- request only latest W3 layout;
- preserve clicked/anchor node screen position;
- adopt latest result only.

Do not add incremental Dagre.

---

# Immediate Structured seed

Do not show:

```text
blank canvas
→ wait for Dagre
```

when entering Structured without cache.

Add a cheap deterministic schematic seed.

Possible strategy:

```text
root at origin
hierarchy depth → x rank
siblings → deterministic y slots
neighbor documents → secondary lanes
diagnostics → deterministic side lane
```

Requirements:

- O(nodes + edges) or similarly cheap;
- deterministic;
- complete;
- finite;
- intelligible;
- root normalized;
- no whole-vault work.

W3 refines asynchronously.

---

# First-paint rule

Structured:

```text
projection + compact mapping + seed
→ first usable React Flow paint

then
→ W3 refinement
```

Do not wait on W3 before mounting the usable Local scene.

---

# GraphCanvas refactor boundary

Reuse the mature async W3 lifecycle.

Permitted refactors:

- mapper/presentation variant injection;
- optional seed graph;
- optional exact layout cache;
- optional runtime viewport-point query;
- optional layout-output normalization around a node.

Avoid source-specific logic, Local state imports in renderer-reactflow, duplicated layout state machines, or synchronous Dagre.

The renderer may know `local-structured` visual/layout variants but not KG6 Local root logic.

---

# W3 reuse

Architecture:

```text
Local ViewProjection
→ local-structured React Flow mapping
→ local-structured Dagre input
→ W3
→ root-normalized positions
→ React Flow
```

Do not create W4.

---

# Local Structured Dagre tuning evidence

Evaluate:

```text
A. current focus settings
B. explicit local-structured settings
```

Use Local-small/medium cases containing root hierarchy, nested headings, neighbor documents, cross-document references, blocks, and diagnostics.

Choose settings based on hierarchy legibility, crossing/clutter, compactness, root readability, and Dagre wall time.

Record final settings in tests/docs.

---

# Reference semantics remain exact

Structured routing must not alter:

- reference aggregation;
- hierarchy edges;
- statuses;
- provenance IDs;
- Inspector edge data.

No folder edges.

No GROUP1 physical edges.

---

# Local Structured Focus/reroot

Recommended:

```text
document Focus
→ reroot Local to document

heading/block Focus
→ normalize to containing document
→ preserve exact selection if visible
```

Use current Local navigation planners.

Do not add nested focus semantics.

---

# Search in Structured

Use the same Local rules from B2A.

Visible target:

```text
stay Local
→ select/center Structured
```

Another document:

```text
reroot Local
→ reveal minimum hierarchy
→ stay Structured
```

Explicit Open in Structure still enters general Structure.

Do not route heading Search to general Structure merely because Structured also uses React Flow.

---

# Inspector / Back to Global

Reuse `ProvenanceInspector`.

Back to Global remains history-based and restores the actual prior Global checkpoint.

Local layout preference remains whichever the user selected.

Do not change history semantics just because the Local renderer changes.

---

# Free ↔ Structured selection policy

Node selection survives when the node exists in both.

Structured edge selection → Free should clear visible edge selection unless current controlled-selection architecture cleanly supports canonical Inspector-only retention.

Choose one consistent policy and document it.

Free → Structured node selection should anchor the transition.

---

# Switch while worker pending

Cases:

```text
Free worker running → switch Structured
Structured W3 running → switch Free
```

Requirements:

- dispose/cancel obsolete renderer work;
- stale result cannot affect hidden renderer;
- selection/view state remains;
- new renderer uses seed/cache immediately;
- no wait for obsolete worker.

---

# Local live updates in Structured

While Structured:

```text
new snapshot
→ current Local root reconciliation
→ projectLocalView
→ Structured mapping update
→ seed/cache
→ W3 latest layout if topology changed
```

Preserve selection, structured semantic viewport, disclosure anchor, and root anchor.

Root stable rename/move remains Local.

Root identity loss follows B2A recovery.

---

# Heading live update isolation

Critical case:

```text
add/remove/rename root heading
while Local Structured active
```

Expected:

```text
Local projection changes
Local Structured layout changes
Global Graphology topology changes = 0
Global layout requests = 0
```

This closes the design goal that headings never destabilize Global.

---

# Local layout switch isolation

Critical test:

```text
Local Free ↔ Local Structured
```

Expected:

```text
KG6 Local projection calls = 0
Global projection calls = 0
Global layout calls = 0
workspace/KG10 work = 0
```

Only renderer/layout presentation work changes.

---

# QUERY1 / filters

QUERY1/filter state remains unchanged across Free/Structured.

A query change may alter Local projection and trigger only the **active** Local renderer's layout.

Do not run hidden Free and Structured layout workers simultaneously.

---

# Layout-mode controls

When Local active, show `Free | Structured`.

Do not show Global folder-layout settings as if they affect Local.

Structured does not use Global folder cohesion/spacing.

Do not add a large Structured settings panel.

One evidence-backed Structured default is enough for KG13.

---

# Trackpad / reduced motion

Structured uses the existing React Flow trackpad contract:

```text
Scroll to Zoom
Pinch to Zoom
```

Free keeps Sigma's accepted `0.0017` gain.

Preference semantics match even if renderer internals differ.

Physical precision-touchpad QA is required.

Honor reduced motion for centering/transitions.

Do not animate node interpolation between Free and Structured.

---

# Structured failure

If W3 fails:

```text
keep deterministic/cached Structured seed
→ show nonfatal warning
→ Structured remains usable
```

Do not silently switch to Free, run synchronous Dagre, or fall back to whole-vault Structure.

If React Flow Local Structured fails to mount, keep Local semantic state and offer explicit Free / Structure recovery.

Do not erase the stored preference because of one transient failure.

---

# Accessibility

Local Structured is the richer accessible Local presentation.

Validate:

- keyboard-focusable nodes;
- accessible roles/titles;
- hierarchy/reference ARIA labels;
- disclosure keyboard operation;
- selection/Inspector keyboard path;
- layout toggle;
- Back to Global;
- Open in Structure;
- visible focus indication;
- no focus trap.

Do not remove useful DOM semantics for circuit-diagram aesthetics.

---

# Performance profiles

Reuse B2A bounded workloads:

```text
Local-small

Local-medium:
~381 nodes / 430 edges current evidence scale

Local-stress:
~1,101 nodes current evidence scale
```

Measure:

- mapping;
- seed;
- first paint;
- W3 worker compute;
- round trip;
- apply;
- request → refined paint;
- main-thread high gap;
- exact cache hit;
- Free → Structured;
- Structured → Free;
- heading expansion.

No whole-vault Structured benchmark is required.

---

# Product responsiveness target

Direct interaction remains Class A.

Bounded Local structural changes should feel Class B where feasible.

W3 wall time may exceed Class B on stress without freezing the UI, but first seed paint must remain quick.

Do not claim unmeasured budgets.

---

# Cache invalidation

Structured fingerprint changes on:

- node add/remove;
- hierarchy/reference edge change;
- node dimensions/visual variant change;
- Dagre local-structured settings/version change.

Do not invalidate for selection, hover, camera, Inspector, or query text when projection is unchanged.

Priority:

```text
exact cache
→ use immediately / skip W3

else
→ deterministic seed
→ first paint
→ W3 refine
```

---

# Local semantic viewport persistence

No schema bump.

Use v3:

```text
PersistedLocalViewport {
  anchorEntityId
  freeRatio
  structuredZoom?
}
```

After B2B, write/read `structuredZoom`.

A Local checkpoint lacking `structuredZoom` uses deterministic default zoom/fit.

---

# Local layout preference restore

Stable workspace reload with:

```text
presentationMode = local
localLayoutMode = structured
```

should restore the same Local focus/disclosure/query, Structured renderer, Local anchor, and structuredZoom if available.

Do not rewrite preference silently on transient failure.

---

# Navigation history

History preserves semantic Local view, not derived positions.

Back/Forward restored Local checkpoints use the documented current Local layout preference.

Verify cross-mode scenarios including Global → Local Structured → Structure → Back.

---

# Saved Views / GROUP1 future compatibility

Do not implement Saved Views or GROUP1.

Keep `LocalLayoutMode` serializable and styling centralized.

Do not scatter File/Heading/Block styling through GraphExplorer.

---

# No extra spatial systems

Do not add:

- folder clustering in Local Structured;
- manual node dragging;
- pins;
- cluster offsets;
- source write-back;
- new physics;
- ELK;
- Graphviz;
- custom orthogonal router.

Use React Flow + W3/Dagre first.

If Dagre cannot satisfy a hard schematic requirement after testing, stop/report before adding another engine.

---

# Renderer-reactflow regression safety

Standard Structure must remain unchanged.

Add tests confirming standard mapping dimensions, standard CSS classes, structure/focus Dagre settings, and standard edge routing remain unchanged unless a deliberate shared bug fix is required.

Local Structured behavior must be opt-in.

---

# Global / Local Free regression safety

Re-run:

- Global documents-only invariant;
- semantic zoom no-layout oracle;
- folder clustering;
- Global cache;
- Global Search/Inspector;
- Global → Local transition;
- Local Free seed/layout;
- Local Free zoom no-layout oracle;
- Local heading expansion → zero Global layout;
- precision touchpad.

---

# W3 operation oracle

Local Structured:

```text
pan → 0 layouts
zoom → 0 layouts
hover → 0 layouts
selection → 0 layouts
Inspector → 0 layouts

Free → Structured
→ 0 projection
→ at most 1 W3 layout on cache miss

heading disclosure
→ 1 latest W3 layout if topology changes
→ 0 Global layout
```

Add deterministic tests/instrumentation.

---

# Browser QA

Production browser:

- Global → Local;
- Free default;
- switch Structured;
- root remains spatially recognizable;
- switch Free;
- node selection survives;
- edge selection policy;
- expand/collapse File/Heading;
- blocks;
- Focus reroot;
- QUERY1 filter change;
- Search reroot/reveal;
- Back to Global;
- history;
- reload saved Local Structured;
- fit/zoom/pan;
- reduced motion;
- maximize/Inspector/Filters;
- no console errors.

---

# Release Tauri QA

Use actual release artifact.

Validate:

- Open Vault;
- Global → Local;
- Free ↔ Structured;
- physical precision touchpad in both;
- disclosure;
- Search/Inspector;
- live heading add/remove;
- root rename;
- Rescan;
- Back/Forward;
- restart/reselection restores Local Structured preference/viewport;
- no worker/module/CSP errors.

---

# Privacy

No new source/network behavior.

Confirm:

- no upload;
- no source writes;
- W3 receives only derived local topology/dimensions;
- Structured cache is memory-only;
- no private labels/paths in benchmark output;
- no private screenshots/traces committed;
- no coordinates persisted.

Expected external runtime additions: **zero**.

---

# ADR 0015

Add an ADR closing the multi-scale renderer architecture.

Record:

1. Global/Regional uses Sigma documents-only.
2. Local uses one bounded KG6 projection.
3. Local Free uses Sigma ForceAtlas2.
4. Local Structured uses React Flow + W3 Dagre.
5. Free/Structured are presentations of identical Local semantics.
6. `LocalLayoutMode` is presentation preference, not canonical state.
7. Local Structured has independently tunable Dagre mode/visual variant.
8. root/selected screen anchor is runtime-only across Local layout switches.
9. view-state schema v3 stores semantic Local anchor + Free ratio + Structured zoom.
10. no Local coordinates are persisted.
11. exact Structured layouts may use bounded memory cache.
12. Local hierarchy changes do not alter Global topology/layout.
13. standard Structure remains separate general hierarchy presentation.
14. QUERY1/GROUP1/Saved Views/manual positioning remain separate.
15. KG13 multi-scale renderer work is complete.

---

# Documentation

Update at least:

```text
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/GLOBAL_RENDERER_DECISION.md
packages/renderer-reactflow/README.md
packages/renderer-sigma/README.md
packages/view-state/README.md
apps/web README/component README as relevant
local benchmark docs
```

Final architecture:

```text
Global
Sigma / file network

Regional
Sigma / visual LOD

Local
same bounded projection
  ├─ Free       → Sigma
  └─ Structured → React Flow/W3

Structure
React Flow/W3 general hierarchy
```

---

# Roadmap

If all gates pass:

```text
KG13 — Complete
KG14 — Product-quality exploration — Next
```

Do not begin KG14 automatically.

If a major Local Structured blocker appears, keep KG13 in progress and stop/report.

---

# Scope

## In scope

- Local Free/Structured toggle;
- activate persisted `LocalLayoutMode = structured`;
- same Local projection for both;
- Local Structured React Flow variant;
- explicit Local Structured Dagre mode if justified;
- compact schematic node grammar;
- hierarchy/reference routing distinction;
- structured immediate seed;
- W3 refinement;
- root normalization;
- Free↔Structured runtime screen anchor;
- narrow viewport-point query APIs;
- structured semantic viewport;
- exact memory layout cache;
- selection/edge-selection policy;
- disclosure;
- Local reroot/Focus;
- Search/Inspector/history;
- live update;
- accessibility;
- browser/Tauri/touchpad QA;
- performance/regression evidence;
- ADR/docs/roadmap;
- PR/CI/cleanup.

## Explicitly out of scope

- Local semantic redesign;
- new traversal/focus model;
- Global headings;
- new query language;
- GROUP1;
- analytics;
- folder clustering in Local;
- manual positions;
- persistent coordinates;
- Saved Views;
- new layout engine;
- source editing;
- KG14.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Confirm same Local projection can feed React Flow unchanged.
3. Activate `structured` preference loading/persistence.
4. Add Local layout toggle UI.
5. Add local-structured visual variant to renderer-reactflow.
6. Add compact File/Heading/Block/diagnostic grammar.
7. Add local-structured edge grammar.
8. Add/evaluate explicit local-structured Dagre mode.
9. Add deterministic Structured seed.
10. Add bounded Structured cache.
11. Add root-origin normalization.
12. Add narrow viewport-point query contract to both Local renderers.
13. Add Free↔Structured runtime anchor transfer.
14. Wire structured viewport to existing v3 state.
15. Integrate selection/edge-selection policy.
16. Integrate disclosure/Focus/Search/Inspector.
17. Add live-update behavior.
18. Add operation-count isolation tests.
19. Benchmark Local-small/medium/stress.
20. Re-run Structure/Global/Local Free regressions.
21. Production browser QA.
22. Release Tauri + physical touchpad QA.
23. ADR/docs/roadmap.
24. Archive this prompt under `history-implementations/`.
25. PR → CI → merge → post-merge CI → cleanup.
26. Stop before KG14.

---

# Validation commands

Use current repository equivalents.

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/dagre-layout typecheck
pnpm exec vitest run packages/dagre-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:performance -- --profile small

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
Free → Structured transition benchmark
Structured → Free transition benchmark
Structured cache-hit benchmark
Local Structured disclosure benchmark
Local heading-change → zero Global-layout oracle
Free/Structured toggle → zero KG6 reprojection oracle
Local-small/medium/stress visual QA
Structure renderer regression
Global/Regional regression
Local Free regression
browser Local Structured matrix
release Tauri Local Structured matrix
physical precision-touchpad QA
v1/v2/v3 persistence migration QA
Local history QA
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

KG13B2B is complete only when:

1. `LocalLayoutMode` supports Free and Structured in production.
2. default remains Free.
3. Local layout preference persists.
4. toggle appears only in Local and is accessible.
5. Free and Structured consume the exact same `ViewProjection`.
6. toggling layout causes zero KG6 Local reprojections when semantics are unchanged.
7. toggling causes zero Global reprojections/layouts.
8. Structured uses React Flow/W3.
9. standard Structure remains separate.
10. renderer-reactflow does not duplicate GraphCanvas wholesale.
11. standard Structure visual mapping/settings remain unchanged.
12. Local Structured has independently tunable layout behavior.
13. hierarchy visually dominates references.
14. File/Heading/Block/diagnostic are distinct.
15. Structured nodes are materially more compact than standard Structure cards.
16. disclosure remains accessible.
17. hierarchy/reference semantics remain exact.
18. Structured edge selection has a defined Free-switch policy.
19. node selection survives Free↔Structured where visible.
20. Free→Structured and Structured→Free preserve selected/root screen context where possible.
21. transition screen points are never persisted.
22. no renderer instance leaks into application state.
23. Structured root is normalized around Local root.
24. first Structured paint does not wait for W3.
25. deterministic Structured seed is complete/finite.
26. exact Structured cache hit skips W3.
27. cache is bounded/memory-only.
28. W3 latest-result-wins remains.
29. stale Structured result cannot adopt after switching Free.
30. no synchronous Dagre fallback.
31. Structured failure keeps usable seed/cache.
32. pan/zoom/hover/selection/Inspector cause zero layout.
33. disclosure/topology change triggers at most one latest Structured layout.
34. Local disclosure causes zero Global layout.
35. heading live updates cause zero Global topology/layout work.
36. Structure/Global/Local Free regressions remain green.
37. Local reroot uses existing Local/KG6 semantics.
38. Search visible target stays Local.
39. Search reroot preserves Structured preference.
40. Open in Structure remains separate.
41. Back to Global remains history-based.
42. view-state remains schema v3.
43. `structuredZoom` is written/read.
44. `freeRatio` is preserved while Structured active.
45. raw React Flow transforms/positions are not persisted.
46. Reset saved view/prefs behavior is documented.
47. QUERY1/Saved Filters remain intact.
48. no GROUP1/folder clustering/manual positions/Saved Views are added.
49. no new external runtime dependency is added.
50. Local-small/medium benchmark passes.
51. stress evidence is recorded if safe.
52. seed first-paint timing is measured.
53. W3 compute/round-trip/apply timing is measured.
54. Free↔Structured switch timing is measured.
55. main-thread responsiveness remains acceptable.
56. Structure startup/bundle does not materially regress.
57. browser production QA passes.
58. release Tauri QA passes.
59. physical precision-touchpad QA passes.
60. Structured accessibility QA passes.
61. reduced motion is honored.
62. privacy gates pass.
63. ADR 0015 records final architecture.
64. docs reconcile multi-scale completion.
65. KG13 is marked complete if no blocker remains.
66. KG14 is marked next.
67. existing tests remain green.
68. PR CI passes.
69. post-merge CI passes.
70. task branch/worktree cleanup completes.

Do not begin KG14.

---

# Final report

## 1. Summary
State that Local now supports `Free | Structured` over one shared bounded projection.

## 2. Final multi-scale architecture
Show Global / Regional → Local Free / Structured and distinguish general Structure.

## 3. Shared Local semantics
Root, Focus, disclosure, QUERY1 filters, projection identity.

## 4. Local layout preference
UI, persistence, default, history policy.

## 5. Structured renderer
React Flow changes, compact visual variant, accessibility.

## 6. Structured Dagre
Mode/config evidence and direct/W3 correctness.

## 7. Schematic grammar
File/Heading/Block/diagnostic nodes and hierarchy/reference edges.

## 8. Immediate seed + refinement
Seed first paint, W3 refinement, root normalization.

## 9. Free ↔ Structured transition
Runtime viewport-point capture and fallback.

## 10. Viewport persistence
Existing v3 `freeRatio` + `structuredZoom`; no schema bump.

## 11. Cache
Fingerprint, exact hit, memory bound.

## 12. Selection / Inspector
Node parity, Structured edge inspection, Free switch policy.

## 13. Disclosure / Focus / Search
Exact behavior and reroot semantics.

## 14. Live updates
Root/heading/reference changes and Global isolation.

## 15. Operation-count evidence
Especially zero KG6 reprojection on layout toggle and zero Global layout on Local heading changes.

## 16. Performance
Mapping, seed, first paint, W3 compute, round-trip, apply, refined paint, cache hit, switch latency, RAF gap.

## 17. Regression evidence
Structure, Global/Regional, Local Free, QUERY1.

## 18. Accessibility / failure

## 19. Bundle/dependencies
Expected external additions: zero.

## 20. Tests / browser / Tauri QA

## 21. Privacy

## 22. Files changed

## 23. ADR / roadmap
If gates pass: `KG13 complete`, `KG14 next`.

## 24. Deviations / warnings
Surface remaining schematic-routing, scale, transition, or accessibility tradeoffs.

## 25. KG14 handoff
State that product-quality work can rely on stable canonical identity, live vault updates, Structure, Global/Regional, Local Free, Local Structured, shared Search/Inspector/QUERY1, semantic persistence/history, worker-based heavy layouts, and zero whole-vault relayout from local hierarchy.

KG14 should focus on release-quality exploration, discoverability, onboarding, accessibility polish, resilience, visual tuning, and workflow refinement—not another renderer or semantic graph model.

Do not implement KG14 automatically.
