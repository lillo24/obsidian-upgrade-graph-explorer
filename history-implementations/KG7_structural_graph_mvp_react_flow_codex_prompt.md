# KG7 — Structural Graph MVP with React Flow

**Task type:** renderer integration / graph interaction / first structural graph product surface

## Goal

Implement the first actual interactive graph for `icarus-graph-explorer`.

KG7 should consume the renderer-independent `ViewProjection` produced by KG6 and render it as a usable hierarchical/local graph in the React web application.

The central boundary is:

```text
validated diagnostic report
        ↓
KnowledgeSnapshot
        ↓
createProjectionWorkspace()
        ↓
projectView()
        ↓
ViewProjection
        ↓
renderer-specific mapping + layout
        ↓
React Flow
```

KG7 must treat `ViewProjection` as the complete visible relationship model.

The renderer must **not**:

- recalculate reference roll-up;
- inspect canonical references to decide visible endpoints;
- aggregate canonical edges;
- reinterpret unresolved/ambiguous/invalid resolution;
- decide graph filters from raw source truth;
- mutate canonical data.

KG7 owns:

- React Flow integration;
- renderer-specific mapping;
- deterministic initial layout;
- expand/collapse interaction;
- selection;
- structure/focus switching;
- hover-neighborhood emphasis;
- distinct visual grammar for entity/diagnostic nodes and hierarchy/reference edges;
- viewport controls;
- basic responsive/accessibility behavior.

KG7 is an MVP, but it should already be pleasant enough to use on the real Icarus diagnostic report.

Do **not** implement the KG8 provenance inspector/backlink/search product, KG9 persistence, or KG11 live vault access.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG6 was merged through PR #7 at:

`76c1269dced1cae13efe14e55c12b33d0e97ddf5`

PR CI passed.

The only unconfirmed KG6 exit-gate item was post-merge Actions confirmation because GitHub had a critical Actions incident and no check suite was created for the merge SHA.

Before KG7 work begins:

- check current `main`;
- check whether a post-merge workflow/status later appeared for `76c1269...`;
- if GitHub Actions is functioning again, require the normal KG7 PR/post-merge checks;
- do not reinterpret the historical incident as a code failure.

Current KG6 public APIs:

```ts
createProjectionWorkspace(snapshot)
projectView(workspace, state)
projectSnapshot(snapshot, state)
validateViewProjection(workspace, value)
```

Current `ViewProjection` is renderer-independent plain data.

Projected node types:

```ts
type ProjectedNode =
  | ProjectedEntityNode
  | ProjectedReferenceTargetNode;
```

Entity nodes expose:

```text
id
entityId
entityKind: document | section | block
sourcePath
sourceStartLine
title
hasHiddenChildren
hiddenDescendantCount
internalReferenceIds
role: content | context
focusDistance
```

Diagnostic target nodes expose:

```text
status: unresolved | ambiguous | invalid
rawTarget
referenceIds
candidateEntityIds
reasons
```

Projected edges are:

```text
hierarchy
reference
```

Reference edges retain exact:

```text
referenceIds[]
status
```

KG6 already owns:

- disclosure;
- hidden-endpoint roll-up;
- aggregation;
- internal same-node reference provenance;
- focus neighborhood extraction;
- path/text/entity-kind/resolution filters;
- stale view-state issues.

The renderer does not need to rediscover any of this.

---

# Current application boundary

The browser application currently loads one KG5 diagnostic report through:

- the bundled synthetic sample; or
- an explicitly selected local report JSON.

The report embeds the validated canonical snapshot.

KG7 should continue using this workflow.

Do **not** introduce product folder access.

Current source boundary remains:

```text
KG5 browser:
  select one report JSON

KG11:
  product-grade folder access + file watching
```

The real Icarus report remains private/local/ignored.

---

# Current real-vault scale

KG5 real validation produced:

```text
195 Markdown documents
714 sections
1 explicit block
438 references
```

Core graph-interest subset:

```text
105 documents
440 sections
349 references
```

KG6 synthetic medium projection evidence used:

```text
8,500 canonical entities
16,000 references
```

with projection operations below approximately a few hundred milliseconds on the development machine.

These are evidence only.

KG7 should not optimize for millions of simultaneously rendered nodes.

The main scalability strategy remains:

```text
projection
+ progressive disclosure
+ focus mode
+ filtered scope
```

before renderer replacement.

---

# Required first step

Before editing:

1. sync latest `main`;
2. verify worktree is clean;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/ROADMAP.md`;
   - `packages/view-projection/README.md`;
   - `packages/view-projection/src/types.ts`;
   - `apps/web/README.md`;
   - current `apps/web/src/*`;
   - KG5 report loading/validation code;
   - benchmark tooling;
   - current lint/package boundaries;
4. inspect exact current package versions;
5. verify current React Flow documentation/API before pinning dependencies;
6. follow branch/PR/merge/cleanup instructions.

If repository evidence contradicts this prompt, preserve the latest explicit architecture and report the discrepancy.

---

# Renderer choice

Use **React Flow** as the KG7 structural renderer.

The current official package is:

```text
@xyflow/react
```

Do not install the legacy package name merely because older examples use it.

Verify the current stable version at implementation time and pin it according to repository dependency policy.

Current official React Flow documentation confirms:

- React Flow is installed through `@xyflow/react`;
- the main CSS must be imported;
- custom nodes/edges are supported;
- `onlyRenderVisibleElements` exists as an optional optimization;
- nested/subflow nodes use `parentId`;
- React Flow itself does not provide a general automatic layout engine.

Do not introduce Sigma/Pixi/WebGL in KG7.

KG13 remains the benchmark-gated high-density renderer decision.

---

# Layout choice

Use **`@dagrejs/dagre`** as the initial automatic layout engine unless current package/docs inspection exposes a concrete incompatibility.

Why:

- simple and mature;
- deterministic layered layout;
- appropriate for the structural MVP;
- much lighter architectural commitment than ELK;
- layout can remain replaceable later.

Do not add ELK, d3-force, Graphology, or a force-simulation worker in KG7.

## Important React Flow / Dagre caveat

Current React Flow layout documentation notes a Dagre limitation for **subflows** when nodes inside a subflow also connect outside that subflow.

Avoid creating the canonical document hierarchy as React Flow `parentId` nested/group nodes in KG7.

Icarus already has explicit projected hierarchy edges.

Represent:

```text
Document
Section
Block
```

as ordinary React Flow nodes connected by hierarchy edges.

This avoids accidentally turning React Flow containment into source truth.

---

# Layout architecture

Layout must remain renderer-specific and downstream from `ViewProjection`.

Do not put Dagre into `view-projection`.

Prefer a clean layout interface within the renderer boundary.

Conceptually:

```ts
type GraphLayoutMode = 'structure' | 'focus';

layoutProjection({
  projection,
  mode,
  nodeMeasurementsOrPresetSizes,
}): PositionedRendererGraph
```

The layout result may contain React Flow-specific positions because this is an outer renderer boundary.

Do not leak positions back into:

- `KnowledgeSnapshot`;
- `ViewProjection`;
- KG6 state.

KG9 may later persist renderer-independent manual positions through a deliberate design.

---

# Renderer package / code boundary

Inspect the current monorepo before choosing exact location.

Either of these is acceptable:

## Preferred if the boundary stays clean

```text
packages/renderer-reactflow/
```

owning reusable React Flow mapping/layout/components.

Dependency direction:

```text
renderer-reactflow
  → view-projection
  → core
```

and:

```text
apps/web
  → renderer-reactflow
```

## Acceptable simpler alternative

A clearly isolated renderer directory inside the web app:

```text
apps/web/src/graph/
```

if splitting a package would add ceremony without meaningful reuse.

Whichever is chosen:

- React Flow types must not leak into KG6/core;
- layout code must not move inward;
- interaction state remains outer-layer application state;
- future Sigma support must not require changing canonical/projection contracts.

Document the choice.

Do not create a generic “Renderer” interface merely for theoretical future renderers unless actual KG7 code benefits from it.

---

# Skills

Do **not** add a new repository-local React Flow skill by default.

Current official React Flow documentation plus the repository's existing:

- `vercel-react-best-practices`;
- `web-design-guidelines`;
- browser-control/QA capability

are sufficient.

Use official React Flow docs as the source of truth.

If Codex wants to use an already-available temporary React Flow skill for local assistance, that is fine, but do not commit it unless it materially improves the repository and is inspected first.

---

# Product surface after KG7

The current diagnostic explorer should evolve into a graph-first interface while retaining report loading and useful KG5 diagnostics.

Recommended structure:

```text
┌───────────────────────────────────────────────────────────────┐
│ Icarus Graph Explorer   [Structure] [Focus]      [Load report]│
│                         Focus: 1 hop / both      [Fit view]   │
├───────────────────────────────────────────────┬───────────────┤
│                                               │ Lightweight   │
│                                               │ selection /   │
│                  GRAPH                        │ status panel   │
│                                               │               │
│                                               │               │
├───────────────────────────────────────────────┴───────────────┤
│ visible nodes / edges | projection issues | selected node     │
└───────────────────────────────────────────────────────────────┘
```

KG7 is graph-first.

Do not preserve the KG5 diagnostic page layout if it makes the graph feel like a small widget inside a report dashboard.

However:

- report loading remains accessible;
- diagnostics can remain in a secondary/collapsible panel;
- do not throw away KG5 capabilities unnecessarily.

KG8 will add the serious provenance inspector.

---

# Initial graph state

Default to the **documents-only** projection for a newly loaded report.

Reason:

```text
195 real documents
```

is a reasonable initial whole-vault graph, while automatically opening 714+ sections would undermine progressive disclosure.

Do not default to “show everything.”

A clearly labelled optional top-level-section preset may be exposed if it remains understandable.

Recommended initial projection state:

```text
disclosure.defaultDepth = 0
includeBlocks = false
no focus
no filters
```

The graph should fit the current visible projection on first load.

---

# Node visual grammar

Keep the visual grammar small and consistent.

Do not add an appearance editor.

## Document node

Distinct but not huge.

Show:

```text
basename / useful filename
optional compact path context
hidden-descendant count / expand affordance
```

The projected entity node currently provides `sourcePath` but no document title.

Derive a display basename in renderer/UI code.

Do not change schema v1.

## Section node

Show:

```text
section title
optional compact path/document context
expand affordance if hidden children
```

Empty title must have a readable fallback such as:

```text
Untitled section
```

without modifying canonical title.

## Block node

Small and visually subordinate.

There is currently no canonical block label.

Use a neutral display such as:

```text
Block
line N
```

or equivalent.

Do not invent an Obsidian block ID from canonical data.

Blocks are hidden by default by KG6 anyway.

## Diagnostic target node

Projection-only.

Clearly distinguish:

```text
unresolved
ambiguous
invalid
```

Suggested semantics:

```text
unresolved → outlined / ghost
ambiguous  → warning / branching cue
invalid    → error cue
```

Do not rely on color alone.

Include a short status label/icon/text.

Show `rawTarget`.

Do not make diagnostic nodes structurally expandable.

---

# Context vs content nodes

KG6 can retain hierarchy-only nodes with:

```text
role = context
```

especially in focus/filter modes.

Visually distinguish context from primary content subtly.

Do not hide them.

Do not imply context nodes are search/focus matches.

---

# Hidden descendant affordance

`ProjectedEntityNode` already provides:

```text
hasHiddenChildren
hiddenDescendantCount
```

Render an explicit expand/collapse affordance on eligible entity nodes.

Do not require clicking the whole node to expand.

Recommended interaction:

```text
node body click → select
small disclosure button → expand/collapse
```

This prevents selection and disclosure from fighting each other.

The affordance should be keyboard accessible and have an accessible label such as:

```text
Expand 6 hidden sections
Collapse section descendants
```

Do not implement direct H1/H2/H3 depth controls.

---

# Expand / collapse application state

KG7 owns temporary renderer-independent KG6 `ViewProjectionState`.

It should update:

```text
expandedEntityIds
collapsedEntityIds
```

through small pure state helpers.

Do not manipulate React Flow node visibility directly as the source of truth.

Correct flow:

```text
user clicks expand
     ↓
update ViewProjectionState
     ↓
projectView()
     ↓
new ViewProjection
     ↓
layout
     ↓
React Flow nodes/edges
```

Not:

```text
user clicks expand
     ↓
hide/show React Flow children manually
```

The latter would duplicate KG6 semantics.

---

# Collapse semantics in UI

If a visible entity is expanded:

```text
disclosure control should offer collapse
```

Collapsing:

- keeps the entity visible;
- hides descendants through KG6;
- automatically rolls precise reference endpoints through KG6;
- lets aggregated reference edges update.

Do not manually recompute edges in the renderer.

---

# Structure mode

Structure mode is the normal broad graph view.

Recommended layout:

```text
Dagre layered layout
```

Use both:

- hierarchy edges as strong structural constraints;
- reference edges as weaker topology signals where useful.

Do not let reference edges completely destroy structural parent/child readability.

Dagre supports edge weights/minlen; use them deliberately if they help.

A reasonable goal:

```text
hierarchy = strong/short
reference = weaker/longer
```

but inspect actual layout behavior rather than blindly assigning numbers.

The graph is not required to represent canonical file hierarchy as nested boxes.

---

# Focus mode

Focus is a core KG7 scalability interaction.

Workflow:

1. select a visible canonical entity node;
2. choose **Focus**;
3. set KG6 focus state:
   - root entity ID;
   - hops 1–3;
   - incoming/outgoing/both;
   - hierarchy context;
4. reproject;
5. layout the resulting local graph;
6. center/fit around the focus root.

Recommended default:

```text
1 hop
both directions
ancestors
```

Keep controls compact.

Do not expose arbitrary hop values.

## Leaving focus

Provide a clear:

```text
Exit focus
```

action that restores the prior structural disclosure/filter state.

Do not lose the user's expand/collapse state just because focus mode is entered.

---

# Focus layout

Preferred first approach:

```text
Dagre with left-to-right orientation
```

over the focused projected graph, then center the focus root.

Structure mode can use top-to-bottom or another orientation chosen after browser QA.

If a small deterministic custom focus arrangement produces clearly better spatial roles with less complexity, it is acceptable.

Do not add a force-layout dependency merely for focus.

Do not implement graph physics settings.

---

# Selection

Selection is application/UI state, not KG6 projection truth.

Store something like:

```text
selectedProjectionNodeId
selectedProjectionEdgeId
```

or equivalent.

Do not persist it yet.

Node click:

- selects;
- updates lightweight side/status panel;
- highlights direct relevant neighborhood.

Diagnostic target nodes are selectable.

Edge selection is optional in KG7 but useful if inexpensive.

The full “why does this edge exist?” inspector belongs to KG8.

---

# Hover / neighborhood emphasis

Implement a small deterministic renderer-level highlight.

For hovered/selected node emphasize:

- direct projected hierarchy parent/children;
- direct projected incoming reference edges;
- direct projected outgoing reference edges;
- their immediate endpoint nodes.

Dim unrelated graph elements.

Do not perform new N-hop graph traversal on hover.

Focus mode already owns N-hop exploration.

Do not change KG6 projection state on hover.

Use renderer-level visual state only.

---

# Edge visual grammar

## Hierarchy edge

Quiet structural edge.

## Resolved reference edge

Stronger directed edge.

If:

```text
referenceIds.length > 1
```

show a compact aggregation count only when it improves readability.

Do not render one parallel edge per canonical occurrence.

## Unresolved reference edge

Dashed/ghost style to unresolved synthetic target.

## Ambiguous reference edge

Distinct warning style to ambiguous synthetic target.

Do not fan out to candidates.

## Invalid reference edge

Distinct error style.

Do not rely on color alone.

---

# Internal references

KG6 stores collapsed same-node relationship provenance as:

```text
internalReferenceIds
```

There is no edge.

Expose a subtle visual cue when:

```text
internalReferenceIds.length > 0
```

such as a small badge/count on the entity node.

Do not draw self-loops.

KG8 can later inspect those exact references.

---

# Projection issues

KG6 can return non-fatal issues such as stale disclosure IDs or hidden focus roots.

Surface them in a compact status/diagnostic area.

Do not turn them into graph nodes.

A hidden/invalid focus state should show a readable message and allow exiting focus.

Do not crash the renderer.

---

# No source editing / graph editing

The graph is exploratory, not a flowchart editor.

Disable or omit:

- node creation;
- edge creation;
- connection handles as interactive affordances;
- delete-key mutation;
- source editing;
- drag-to-create relationships.

React Flow may need handles internally for edge geometry; they should not look like connection controls.

Use `nodesConnectable={false}` or current equivalent.

---

# Node dragging

Prefer **non-draggable nodes** in KG7.

Reason:

- layout is automatic;
- manual positions are not persisted yet;
- allowing drag that disappears on the next projection change is misleading.

Use pan/zoom for exploration.

KG9 will later decide pins/manual positions and persistence.

Default recommendation:

```text
nodesDraggable = false
```

---

# Viewport behavior

React Flow should own pan/zoom/viewport transform.

Provide compact controls for:

```text
zoom in
zoom out
fit view
```

Fit the graph:

- on first valid report load;
- when entering focus mode;
- when explicitly requested.

Do **not** aggressively auto-fit after every expand/collapse.

Repeated automatic camera movement can make progressive exploration disorienting.

Respect reduced-motion preferences.

Do not add GSAP.

---

# Layout stability

A major UX risk is the whole graph jumping wildly on every small expansion.

Use deterministic:

- node sizes;
- edge weights;
- layout options;
- node ordering.

When possible, preserve the selected node's approximate viewport location across a relayout by comparing old/new flow position and compensating viewport translation.

Implement this only if robust.

Do not build a complex incremental layout engine in KG7.

---

# React Flow node sizing

Use fixed or small bounded size classes for the MVP:

```text
document
section
block
diagnostic
```

Avoid needing DOM measurement before every layout if stable predetermined dimensions work.

Long titles should truncate/wrap within bounded dimensions.

Use accessible full text via tooltip/selection panel.

Do not make graph nodes grow arbitrarily with long Markdown titles.

---

# React Flow performance rules

Follow these rules from the start:

- define `nodeTypes` / `edgeTypes` at module scope or other stable references;
- memoize custom node/edge components where useful;
- do not subscribe every node to the entire node array;
- do not recreate large renderer mappings on unrelated state changes;
- keep custom nodes visually simple;
- projection should prevent unnecessary node count before renderer optimization;
- avoid expensive shadows/filters/animations on every node;
- use stable callbacks;
- derive React Flow elements with `useMemo`.

## `onlyRenderVisibleElements`

React Flow exposes:

```text
onlyRenderVisibleElements
```

which can improve large graph rendering but adds overhead.

Do not assume it must always be true.

Use browser QA with:

- synthetic sample;
- real Icarus report;
- expanded/focus cases.

Choose a default based on evidence and document it.

If evidence is inconclusive, keep the library default and defer deeper renderer benchmarking to KG12.

---

# React Flow accessibility

Do not break React Flow's keyboard support with custom nodes.

Requirements:

- disclosure buttons keyboard accessible;
- focus control keyboard accessible;
- diagnostic status not conveyed only by color;
- selected state visible;
- focus-visible styles;
- toolbar controls have labels;
- graph has an accessible label/description;
- reduced-motion respected;
- report load errors remain accessible.

Do not add hidden interaction only available on hover.

---

# Graph CSS / design

The graph should fit the existing application coherently.

Do not produce generic “React Flow demo” styling.

Keep primary visual distinction semantic:

```text
document
section
block
context
unresolved
ambiguous
invalid
selected
hover-neighborhood
```

Use a small visual system.

No physics panel.

No styling dashboard.

No 3D.

No decorative particle edges.

---

# Lightweight side/status panel

KG8 owns the real inspector.

KG7 should only expose enough state to make interactions understandable.

For selected entity:

```text
type
title/path
hidden descendants
internal reference count
focus distance / context role when applicable
```

For diagnostic target:

```text
status
raw target
candidate count
reason count
```

For selected reference edge:

```text
status
aggregated reference count
```

Do not show source excerpts.

Do not reconstruct backlinks.

Do not fetch files.

---

# Report loading and graph state reset

When loading a different report:

- create new projection workspace;
- reset disclosure to documents-only;
- clear focus;
- clear selection/hover;
- reset renderer layout;
- fit view.

Do not carry entity IDs from the prior report into the new report.

---

# Synthetic sample

Update the committed synthetic report/sample only if needed to exercise KG7 visual states.

The sample should include enough to demonstrate:

- multiple documents;
- nested sections;
- expand/collapse;
- rolled reference aggregation;
- unresolved;
- ambiguous;
- invalid;
- internal collapsed reference if possible.

Do not use real Icarus note names/headings.

Prefer generating the sample through the existing deterministic KG5 pipeline rather than hand-editing JSON.

---

# Real Icarus browser validation

KG7 should be exercised with the ignored local real Icarus report.

Do not commit screenshots containing private filenames/headings.

Validate at least:

1. documents-only graph;
2. expanding representative documents;
3. nested section disclosure;
4. roll-up changes after expansion;
5. focus on document;
6. focus on visible section;
7. 1-hop and 2-hop focus;
8. incoming/outgoing/both;
9. ambiguous diagnostic node;
10. unresolved diagnostic nodes;
11. fit view;
12. pan/zoom;
13. selection;
14. hover neighborhood;
15. narrow desktop window;
16. no console errors.

Report aggregate/behavioral findings, not private note content.

---

# Browser QA

KG7 now has a meaningful interactive UI, so browser QA is required.

Use the existing browser-control capability/skill if available.

Do not automatically add Playwright as a repository dependency.

Browser automation/manual QA should cover the synthetic report and real ignored report.

Default:

```text
no new permanent E2E dependency in KG7
```

because current browser-control QA already exists.

---

# Layout tests

Keep layout/mapping logic testable without mounting React Flow where possible.

Required pure tests should cover:

- every projected node maps exactly once;
- every projected edge maps exactly once;
- deterministic positions for same projection/options;
- hierarchy/reference edge visual type mapping;
- diagnostic status node mapping;
- aggregated count mapping;
- internal-reference badge data;
- structure vs focus orientation;
- layout does not mutate projection;
- collision-safe renderer IDs;
- empty projection;
- single-node projection;
- disconnected graphs;
- cycles in reference edges do not crash layout.

Dagre layout should use projection data, not canonical snapshot.

---

# Interaction tests

Use pure state helpers/components where practical.

Cover:

## Expand

```text
visible entity with hidden children
→ update renderer-independent disclosure
→ projectView produces descendants
```

## Collapse

```text
expanded entity
→ collapse
→ descendants disappear
→ rolled edges change through KG6
```

Test the state transition, not a duplicate roll-up algorithm.

## Focus

```text
selected entity
→ enter focus
→ existing disclosure preserved
→ focus state applied
→ exit focus restores broad structural projection state
```

## Report switch

Projection/selection state resets.

## Diagnostic selection

Selecting synthetic target does not try to expand/focus it as canonical entity.

## Hover

Renderer highlight helper identifies immediate projected neighborhood only.

---

# Node/edge component performance test posture

Include regression coverage for common React Flow mistakes:

- stable `nodeTypes`;
- stable `edgeTypes`;
- no per-render creation of component maps;
- node components receive only data they need;
- no mutation of projection data.

A focused code review against official React Flow performance guidance is part of KG7 completion.

---

# Benchmark integration

Extend existing non-gating evidence with **renderer preparation/layout** timings.

Do not measure DOM frame rate through Node benchmarks.

Add opt-in benchmark phases such as:

```text
React Flow element mapping
Dagre structure layout
Dagre focus layout
```

for small and medium synthetic projections.

Record:

```text
projected nodes
projected edges
layout mode
mapping time
layout time
```

No CI thresholds.

Browser QA should separately note qualitative responsiveness on the real report.

KG12 will define renderer budgets.

---

# Layout input policy

Use projected hierarchy/reference edges deliberately.

## Structure mode

Dagre input may include:

- all hierarchy edges;
- resolved reference edges;
- diagnostic reference edges only if they help placement rather than distort structure.

A safe initial option is to include hierarchy + resolved references for ranking and lay synthetic diagnostic targets near sources after/within Dagre.

Inspect browser results.

Do not let a cloud of unresolved ghost nodes ruin structural layout.

## Focus mode

Use the focused projected graph.

Left-to-right Dagre is recommended.

Focus root should be easy to find.

After layout:

```text
fit/center focus root
```

Do not infer focus relationships from canonical data.

---

# Handles and edge routing

Custom React Flow nodes need stable connection geometry.

Suggested approach:

- structure top-to-bottom:
  - hierarchy source bottom / target top;
- focus left-to-right:
  - source right / target left.

If node components expose four non-interactive handles, renderer edges can select appropriate handle IDs by layout mode.

Hide/de-emphasize handles visually so they do not look like authoring controls.

Do not create editable connection points.

Prefer React Flow built-in edge paths in KG7.

Do not introduce an edge-routing dependency.

---

# Edge labels

Avoid labeling every edge.

Useful label cases only:

- aggregated reference count > 1;
- perhaps diagnostic status where the target node itself is insufficient.

Do not put raw references on edges.

KG8 inspector will expose provenance.

Hierarchy edges should generally have no labels.

---

# React Flow components

Use only useful primitives.

Recommended:

- `<ReactFlow />`;
- compact `<Controls />`;
- `<Background />` if it improves orientation;
- maybe `<Panel />` for graph controls.

Do not add `<MiniMap />` automatically.

A minimap can be reconsidered after browser QA if the documents-only graph is hard to navigate.

Avoid UI clutter.

---

# Structure/focus toolbar

Keep controls compact.

Minimum:

```text
Structure / Focus mode
Focus action for selected entity
Exit focus
Hops: 1 / 2 / 3
Direction: in / out / both
Fit view
optional top-level-section preset
```

Do not show focus controls when not in focus mode if that reduces clutter.

Do not add general filter/search UI beyond what is already necessary in KG7.

KG8 is the primary search/filter-navigation milestone.

---

# KG6 filters in KG7

KG6 already supports filters, but KG7 does not need to expose the full filter UI.

If the existing application can reuse one compact resolution-state control without complexity, that is acceptable.

Do not make filter UI a KG7 completion gate.

The renderer must nevertheless correctly display any projection KG6 produces with filters.

---

# Do not derive new graph semantics in web UI

Web/renderer code may derive:

- display strings;
- layout sizes;
- highlight sets from projected edges;
- React Flow props.

It must not derive:

- source reference ownership;
- nearest visible ancestor;
- ambiguity candidate resolution;
- rolled edge groups;
- focus membership;
- structural filter context.

Those already belong to KG6/KG4.

If renderer code appears to need canonical truth to answer a graph-semantic question, stop and inspect whether KG6 is missing a field rather than bypassing the architecture.

---

# ViewProjection gap policy

KG7 is the first consumer likely to expose missing renderer-facing metadata.

Small renderer-facing gaps can be addressed in KG6 **only if** they are genuinely renderer-independent projection facts.

Potentially valid:

```text
projected structural parent ID
additional diagnostic display metadata derived from canonical truth
```

Not valid KG6 changes:

```text
x/y position
React Flow handle ID
node color
CSS class
Dagre rank
hover state
```

If a major projection semantic gap appears, stop and report rather than quietly growing KG6 around React Flow.

---

# Dependencies

Expected new dependencies:

```text
@xyflow/react
@dagrejs/dagre
```

plus TypeScript types only if current packages require separate types.

Verify:

- current stable versions;
- license;
- ESM/Vite compatibility;
- React 19 compatibility.

React Flow is currently MIT-licensed.

Verify Dagre's license before adding.

Do not upgrade unrelated dependencies.

No Graphology/Sigma/Pixi/ELK/d3-force/GSAP/Zustand dependency in KG7.

---

# State management

Do not install Zustand just because graph state exists.

KG7 state is still manageable as:

```text
loaded report
projection workspace
ViewProjectionState
selection
hover
layout mode
viewport owned by React Flow
```

Use React state/reducer plus memoized derivation unless implementation evidence shows a real problem.

A reducer for projection interaction state is reasonable.

KG9 can reconsider persistence/state infrastructure when requirements are concrete.

---

# React 19 considerations

Follow current React/React Flow guidance.

Avoid obsolete patterns copied from React Flow 10/11 tutorials.

Do not use legacy `reactflow` imports.

Do not use deprecated `parentNode`.

Do not write effects that merely derive data that can be computed with `useMemo`.

Use stable event callbacks.

---

# Error states

Graph UI must handle:

- invalid report;
- empty snapshot;
- empty projection due to focus/filter;
- projection issue;
- layout failure;
- unexpected renderer mapping failure.

Do not silently display a blank canvas.

Provide compact actionable errors.

A layout failure should not corrupt the loaded report.

If reasonable, fall back to a simple deterministic grid for catastrophic layout failure and surface a warning.

---

# Scope

## In scope

- inspect KG6 merged state;
- install React Flow;
- install one lightweight automatic layout dependency;
- renderer-specific mapping boundary;
- structural graph UI;
- documents-only default;
- progressive expand/collapse;
- structure mode;
- focus mode;
- 1–3 hop controls;
- in/out/both direction;
- hierarchy/context rendering;
- resolved/non-resolved visual grammar;
- synthetic ghost/ambiguity/invalid nodes;
- aggregated reference count;
- internal-reference badge;
- node selection;
- optional lightweight edge selection;
- hover immediate-neighborhood emphasis;
- pan/zoom/fit controls;
- deterministic structure/focus layout;
- responsive/accessibility behavior;
- preserve KG5 report loading;
- synthetic sample coverage;
- real ignored Icarus-report browser validation;
- pure renderer/layout tests;
- non-gating renderer-preparation/layout benchmarks;
- docs/roadmap reconciliation;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- provenance/source-span inspector;
- source snippets;
- backlinks panel;
- full search/navigation UI;
- source opening;
- live Obsidian/vault integration;
- Tauri;
- saved views;
- persisted layout;
- stable identities across edits;
- manual node pinning persistence;
- source editing;
- edge creation;
- graph authoring;
- Graphology;
- Sigma;
- Pixi;
- WebGL renderer;
- force simulation;
- ELK;
- analytics;
- PageRank;
- communities;
- semantic similarity;
- typed semantic relationships;
- performance budgets;
- workers;
- 3D;
- large styling/physics settings.

Do not begin KG8 automatically.

---

# Suggested implementation sequence

## 1. Inspect current app/projection

Understand exact KG5 report state and KG6 projection APIs.

## 2. Verify/install renderer dependencies

Use current official React Flow docs.

Pin dependencies.

## 3. Establish renderer boundary

Create isolated React Flow mapping/layout code.

## 4. Define node/edge data types

Keep them renderer-specific and derived only from `ViewProjection`.

## 5. Build deterministic layout

Structure first, then focus.

Test before mounting UI.

## 6. Build custom node components

Entity + diagnostic target variants.

Keep stable/memoized.

## 7. Build edge styles/components

Hierarchy/reference/status distinctions.

Use aggregation count sparingly.

## 8. Integrate graph with report

Load sample/report → workspace → project → layout → renderer.

## 9. Implement disclosure interactions

Expand/collapse through KG6 state.

## 10. Implement selection + hover emphasis

No canonical semantic reconstruction.

## 11. Implement focus

Enter/exit focus, hops, direction, fit root.

## 12. Validate viewport behavior

Initial fit, focus fit, no aggressive expand auto-fit.

## 13. Browser QA synthetic report

All main interactions.

## 14. Browser QA real ignored Icarus report

Check actual usability/scale.

## 15. Extend benchmark harness

Mapping + layout timings.

## 16. React Flow performance/accessibility review

Use official docs + existing skills.

## 17. Documentation consistency pass

Update architecture/roadmap/web/renderer docs.

## 18. PR → CI → merge → post-merge CI → cleanup

Follow `AGENTS.md`.

---

# Required tests / scenarios

## A. Projection-to-renderer mapping

Every projected node/edge maps exactly once.

## B. Entity kinds

Document/section/block mappings are visually/data distinct.

## C. Diagnostic kinds

Unresolved/ambiguous/invalid mappings remain distinct.

## D. Hierarchy vs reference edge

Different renderer types/styles.

## E. Aggregation count

Multiple `referenceIds` remain one rendered edge with count metadata.

## F. Internal references

No self-loop; node shows internal count.

## G. Layout determinism

Same projection/layout mode produces same positions.

## H. Disconnected graph

No crash.

## I. Cyclic reference graph

No crash.

## J. Empty projection

Readable empty state.

## K. Single node

Readable and centered/fit.

## L. Expand

Projection state updates and children appear.

## M. Collapse

Children disappear and KG6 supplies updated rolled edges.

## N. Expand/collapse does not mutate canonical report

Regression assertion.

## O. Focus enter/exit

Broad disclosure state survives focus round-trip.

## P. Focus direction/hops

Controls map exactly to KG6 focus state.

## Q. Diagnostic node cannot be used as focus root

UI guards correctly.

## R. Report reload

Clears graph interaction state.

## S. Hover neighborhood

Only direct projected incident relationships emphasized.

## T. Selection

Selected node remains clear; unrelated elements dim appropriately.

## U. Projection issues

Visible status rather than crash.

## V. Layout failure handling

Synthetic/fault test if practical.

## W. Reduced motion

No mandatory animation dependency.

## X. Responsive layout

Toolbar/canvas remains usable at narrower desktop size.

## Y. NodeTypes/edgeTypes stability

No per-render component-map recreation.

## Z. Renderer boundary

No React Flow/Dagre import leaks into `view-projection` or core.

---

# Browser QA checklist

With synthetic sample:

1. initial graph visible;
2. documents-only default;
3. fit view;
4. pan/zoom;
5. expand document;
6. expand section;
7. collapse;
8. selection;
9. hover emphasis;
10. focus selected entity;
11. 1/2/3 hop switching;
12. incoming/outgoing/both;
13. exit focus;
14. unresolved node visible;
15. ambiguous node visible;
16. invalid node visible;
17. aggregated edge count visible where applicable;
18. report switch/reset;
19. keyboard tab/focus on controls;
20. no console errors.

With real ignored Icarus report:

1. documents-only graph usable;
2. representative expansions usable;
3. one-hop focus readable;
4. two-hop focus not catastrophically cluttered;
5. unresolved/ambiguous targets inspectable/selectable;
6. fit/pan/zoom usable;
7. no private artifact tracked by git;
8. no console errors.

Do not include private screenshots in commits.

---

# Benchmark evidence

Extend existing benchmark command rather than creating a competing harness.

Measure small/medium:

```text
renderer mapping
structure Dagre layout
focus Dagre layout
```

Record node/edge counts.

If layout becomes unexpectedly slow or memory-heavy at medium scale:

- report it;
- simplify the layout input;
- do not jump straight to Sigma/Pixi.

If browser performance is poor on the real report despite projection disclosure:

- capture evidence;
- determine whether cost is layout, mapping, or React rendering;
- surface it for KG12/KG13.

Do not introduce an alternate renderer inside KG7.

---

# Documentation updates

Likely:

```text
README.md
apps/web/README.md
packages/renderer-reactflow/README.md   # if package created
docs/ARCHITECTURE.md
docs/ROADMAP.md
tools/vault-diagnostics/README.md       # benchmark update if needed
eslint.config.*
```

## Architecture should record

```text
ViewProjection
  → React Flow renderer adapter
  → Dagre layout
  → browser graph UI
```

and clarify:

- React Flow is outer-layer rendering;
- Dagre positions are not canonical/view-projection truth;
- `parentId` grouping is not used for source hierarchy in KG7;
- disclosure/focus/filter remain KG6 semantics;
- selection/hover/viewport are transient KG7 application state;
- no source editing.

## Roadmap

Mark KG7 complete after validation.

KG8 becomes next.

Do not prematurely move provenance inspection into KG7 documentation.

---

# Validation commands

Run repository standard checks plus focused renderer/web tests.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter <renderer-package-if-created> typecheck
pnpm exec vitest run <renderer-package-or-graph-area>
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

Run the extended benchmark locally on at least:

```text
small
medium
```

Run browser QA with:

- synthetic sample;
- ignored real Icarus report.

PR CI must pass.

Post-merge main CI must pass if GitHub Actions is operational. If an external incident again prevents check-suite creation, document the external limitation and independent evidence rather than claiming a pass that did not occur.

---

# Exit gate

KG7 is complete only when:

1. React Flow is installed through the current `@xyflow/react` package.
2. Renderer imports remain outside core/view-projection.
3. A deterministic layout strategy exists.
4. Layout positions remain renderer-specific.
5. The app renders `ViewProjection` without recalculating KG6 semantics.
6. Documents-only graph is the default.
7. Entity types have clear visual distinctions.
8. Context/content distinction is visible.
9. Unresolved/ambiguous/invalid targets are distinctly represented.
10. Diagnostic targets remain projection-only.
11. Hierarchy/reference edges are visually distinct.
12. Aggregated edge count/provenance metadata is preserved.
13. Internal collapsed references do not become self-loops.
14. Expand/collapse updates KG6 disclosure state rather than React Flow visibility hacks.
15. Nested progressive disclosure works.
16. Structure mode works on the synthetic and real report.
17. Focus mode works with 1–3 hops.
18. Incoming/outgoing/both focus directions work.
19. Exiting focus preserves broad structural disclosure state.
20. Node selection works.
21. Direct hover-neighborhood emphasis works.
22. Diagnostic nodes are selectable but not focusable as canonical roots.
23. Pan/zoom/fit view work.
24. First load/focus fit behavior is sensible.
25. Expand/collapse does not cause aggressive automatic camera movement.
26. Nodes are non-connectable and graph authoring is unavailable.
27. Node dragging is disabled unless a documented evidence-based exception is made.
28. Layout handles disconnected/cyclic projected graphs.
29. Empty/error/projection-issue states are readable.
30. React Flow component maps are stable and custom components follow performance guidance.
31. Browser accessibility review passes.
32. Synthetic browser QA passes.
33. Real ignored Icarus-report browser QA passes.
34. No private graph screenshot/report/content is committed.
35. Renderer mapping/layout tests pass.
36. Existing KG1–KG6 tests remain green.
37. Renderer mapping/layout benchmark evidence is collected without CI budgets.
38. No Graphology/Sigma/Pixi/ELK/force/state-persistence dependency is introduced.
39. Architecture/roadmap docs are reconciled.
40. PR CI passes.
41. Post-merge main CI passes if GitHub Actions is operational; if an external incident again prevents creation of a check suite, document independent local/PR evidence and the incident rather than fabricating success.
42. Branch cleanup is complete and working tree is clean.

Do not begin KG8.

---

# Final report

Report:

## 1. Summary

What the graph MVP now does.

## 2. Renderer architecture

State exact boundary chosen:

```text
ViewProjection
→ renderer mapping
→ layout
→ React Flow
```

and whether renderer code lives in a package or web-app boundary.

## 3. Dependencies

Exact versions/licenses for:

```text
@xyflow/react
@dagrejs/dagre
```

and any other dependency actually added.

Explain any deviation.

## 4. Layout

Document:

- structure orientation;
- focus orientation;
- edge weighting/input policy;
- synthetic diagnostic target placement;
- layout stability behavior;
- why React Flow `parentId` subflows were or were not used.

## 5. Node visual grammar

Document/section/block/context/diagnostic behavior.

## 6. Edge visual grammar

Hierarchy/resolved/unresolved/ambiguous/invalid/aggregation behavior.

## 7. Disclosure

Explain expand/collapse state flow through KG6.

## 8. Focus

Explain enter/exit, hops, direction, hierarchy context, and viewport behavior.

## 9. Selection / hover

Explain immediate-neighborhood emphasis and what remains KG8.

## 10. React Flow performance posture

State:

- component memoization/stable maps;
- `onlyRenderVisibleElements` decision and evidence;
- real-report qualitative result.

## 11. Browser QA

Synthetic + real ignored report behavior tested.

Do not expose private note details.

## 12. Performance evidence

Small/medium:

```text
projected nodes/edges
renderer mapping time
structure layout time
focus layout time
```

No budget claims.

## 13. Tests / validation

Every command run, focused tests, full `pnpm check`, browser QA, PR CI, post-merge status.

If the historical GitHub Actions incident affected validation, distinguish external infrastructure from code state.

## 14. Files changed

Important renderer/web/docs areas.

## 15. Documentation reconciliation

Any earlier KG7 guidance changed after actual browser/layout evidence.

## 16. Deviations / warnings

Surface:

- layout limitations;
- graph size limitations;
- React Flow performance concerns;
- projection metadata gaps;
- major UX questions.

If any of these should block KG8, say so.

## 17. KG8 handoff

State what the provenance inspector/search/navigation milestone can now rely on:

- stable selected projected node/edge concepts;
- visible aggregated reference edges retaining exact canonical `ReferenceId`s;
- internal reference provenance;
- diagnostic target/candidate metadata;
- renderer-independent disclosure/focus state;
- working graph navigation;
- source text still unavailable in-browser until a later source-provider milestone.

Do not implement KG8 automatically.
