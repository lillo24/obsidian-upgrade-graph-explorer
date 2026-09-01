# GROUP1A — Visual Group Backbone + Cross-Renderer Style Contract

**Task type:** source-neutral visual classification / QUERY1 reuse / renderer-independent presentation contract / renderer style seams / persistence backbone / performance evidence

## Goal

Build the **logic and rendering backbone** for Visual Groups now, while KG13's presentation architecture is still evolving.

Do **not** build the user-facing Groups editor/panel yet.

The milestone should establish one convergent contract:

```text
QUERY1 canonical rule
        ↓
Visual Group definition
        ↓
canonical entity matching
        ↓
EntityId → primary visual style
        ↓
┌────────────────────────────────────────────┐
│ Structure                                  │
│ Global / Regional                          │
│ Local Free                                 │
│ Local Structured — when/if present on main │
└────────────────────────────────────────────┘
```

The purpose is to make later GROUP1B UI a thin configuration layer over a tested, stable backbone rather than designing group semantics around a UI while KG13 is still changing.

---

# Product sequencing

Split the former GROUP1 milestone into:

```text
GROUP1A
→ logic/backbone
→ renderer-independent classification
→ cross-renderer style contract
→ persistence model
→ no product editor UI

GROUP1B
→ user-facing Groups controls/editor
→ create/edit/delete/reorder/toggle
→ palette selection UI
→ Inspector presentation
→ responsive overlay integration
```

Do not start GROUP1B automatically.

---

# Critical concurrency / worktree instruction

This work is intentionally developed in a **separate worktree** while KG13 and performance work may continue.

At prompt-writing time current `main` is:

```text
f1c8127782c50660416f2fdf3d50574925a0706c
```

This includes:

```text
QUERY1
KG13B1 Global / Regional
KG13B2A Local Free
UI refactor #35
```

Current roadmap direction still has:

```text
KG13B2B Local Structured
```

as the next KG13 presentation step.

Therefore:

1. create a dedicated GROUP1A branch/worktree from the actual latest `main`;
2. do not modify/reset/clean another worktree;
3. keep GROUP1A changes modular;
4. expect KG13B2B and/or projection-performance work to land concurrently;
5. before the final PR, fetch/rebase onto the then-current `main`;
6. if KG13B2B landed, adapt GROUP1A to its final Local Structured renderer seam;
7. if it did not land, leave one explicit style contract that B2B can consume later;
8. never resolve conflicts by replacing newer whole renderer/GraphExplorer files with stale branch copies.

Prefer new modules and narrow optional props/methods.

---

# Architectural intent

The word **independent** means semantic separation, not product separation.

GROUP1A must converge directly into KG13.

Keep these concepts separate:

```text
REFERENCES
= semantic graph truth

QUERY1
= selection/filter language

GROUP1
= visual classification/rules

FOLDERS
= soft spatial prior

LAYOUT
= positions

RENDERER
= drawing/interactions
```

But the output of GROUP1 must feed every KG renderer.

Specifically:

```text
same visual group
≠ physical cluster
```

unless a future explicit layout feature says otherwise.

Do not create synthetic edges or group-force attraction.

---

# Current repository evidence to preserve

Current Global Sigma code deliberately exposes a future GROUP1 seam before final interaction styling.

The current Global node style path already distinguishes:

```text
base attributes
LOD
hover
selection
hover-neighborhood deemphasis
```

Current Local Free has a parallel style resolver.

Current Structure React Flow already owns:

```text
Document / Section / Block grammar
Focus appearance
selection ring
hover/deemphasis
```

GROUP1A should contribute a visual accent **before final interaction emphasis**, not replace those systems.

---

# QUERY1 handoff

QUERY1 already provides:

```text
@icarus-graph-explorer/graph-query

parseGraphQuery()
formatGraphQuery()
matchesGraphQuery()

typed GraphQueryExpression
canonical query strings
bounded grammar
positioned issues
```

Reuse this exactly.

Do not:

- add a Visual Group query parser;
- fork grammar;
- add implicit AND;
- add group-only predicates;
- copy the evaluator.

Visual Groups are query consumers.

---

# Performance constraint carried from QUERY1

QUERY1 exposed an investigative medium projection cliff around:

```text
projectView ≈ 650.9 ms
```

for a medium Structure-3 advanced-query scenario.

GROUP1A must not add group work to `projectView()`.

Hard invariant:

```text
change group definitions
change group priority
change group enabled state
change group color

→ no projectView()
→ no DISC1 candidate projection
→ no structural disclosure recomputation
→ no renderer topology remap merely for color
→ no layout request
```

GROUP1A is presentation/configuration state.

Do not attempt to solve the QUERY1 projection cliff in this branch.

---

# 1 — New source-neutral package

Create:

```text
packages/visual-groups/
@icarus-graph-explorer/visual-groups
```

Preferred dependencies:

```text
@icarus-graph-explorer/core
@icarus-graph-explorer/graph-query
```

External dependencies:

```text
0
```

The package must not depend on:

```text
view-projection
view-state
React
React Flow
Sigma
Graphology
web storage
Tauri
Obsidian
parser/resolver
layout workers
```

## Package responsibilities

The package owns:

```text
VisualGroupDefinition
VisualGroupColor
palette metadata
definition validation/canonicalization
compiled group rules
primary-match resolution
all-match resolution
EntityId → presentation assignment helpers
```

It does not own:

```text
storage
GraphExplorer
UI
renderer-specific CSS
layout
projection
navigation
```

---

# 2 — Visual Group definition

Use a compact serializable contract such as:

```ts
export interface VisualGroupDefinition {
  readonly name: string;
  readonly query: string;
  readonly color: VisualGroupColor;
  readonly enabled: boolean;
}
```

Exact naming may differ.

Do not store:

```text
AST
EntityId lists
Projection node IDs
renderer node IDs
coordinates
layout state
matched membership caches
Saved Filter name references
```

The durable rule is the canonical QUERY1 query string.

---

# 3 — Fixed palette

Use stable named tokens.

Suggested shape:

```ts
export type VisualGroupColor =
  | 'teal'
  | 'blue'
  | 'violet'
  | 'magenta'
  | 'red'
  | 'orange'
  | 'amber'
  | 'green';
```

Exact set may change modestly after visual testing.

Export deterministic palette metadata:

```ts
interface VisualGroupPaletteEntry {
  readonly token: VisualGroupColor;
  readonly label: string;
  readonly accent: string;
}
```

Persist only the token.

Never persist arbitrary CSS.

Never accept arbitrary CSS snippets.

Never derive CSS class names from group names.

---

# 4 — Priority semantics

Array order is priority.

Rule:

```text
first enabled matching group wins
```

Example:

```text
1 Research
2 Language
3 Draft
```

If an entity matches Research and Draft:

```text
primary = Research
```

Do not:

- blend colors;
- sort by name;
- choose longest query;
- choose "most specific";
- choose nondeterministically.

Priority must be explicit and deterministic.

---

# 5 — All matches for later inspection

Rendering needs one primary style.

Later Inspector/UI may need all memberships.

Provide separate APIs:

```ts
primaryVisualGroupForEntity(...)
matchingVisualGroupsForEntity(...)
```

or equivalent.

`matchingVisualGroupsForEntity()` returns enabled matches in priority order.

Do not eagerly compute all memberships for all entities solely for future Inspector UI.

---

# 6 — Compilation

Compile/parse group rules once when definitions change.

Conceptually:

```ts
compileVisualGroups(definitions)
```

returns a validated internal structure containing parsed QUERY1 expressions.

Do not parse queries inside the per-entity loop.

Wrong:

```text
entity loop
  group loop
    parse query
```

Correct:

```text
definitions change
→ parse once

entities change
→ evaluate prepared ASTs
```

## Invalid definitions

Public package APIs must handle malformed external input deterministically.

Preferred split:

```text
validate/canonicalize definitions
→ returns result

compile
→ only accepted validated definitions
```

Do not let one malformed group crash a renderer.

Normal persistence/test paths should reject invalid definitions before activation.

---

# 7 — Matching API

Use canonical `AddressableEntity`.

Example:

```ts
resolvePrimaryVisualGroup(
  entity: AddressableEntity,
  compiled: CompiledVisualGroups
): VisualGroupMatch | undefined
```

The matching implementation must call QUERY1 evaluation.

Do not reproduce field matching logic.

## Runtime presentation output

Provide a renderer-safe presentation shape.

Example:

```ts
export interface VisualGroupNodePresentation {
  readonly groupName: string;
  readonly color: VisualGroupColor;
  readonly accent: string;
}
```

Renderers should consume only this resolved presentation.

They must not receive:

```text
GraphQueryExpression
VisualGroupDefinition[]
parser
Saved Filters
registry storage
```

---

# 8 — Canonical EntityId is the join key

The same canonical entity can appear in:

```text
Structure
Global
Local Free
Local Structured
```

Therefore renderer presentation maps must be keyed by:

```text
EntityId
```

not:

```text
ProjectionNodeId
React Flow node id
Sigma key
source path
```

Preferred runtime shape:

```ts
ReadonlyMap<EntityId, VisualGroupNodePresentation>
```

Projection/renderers already know the canonical entity ID for entity nodes.

Diagnostic nodes have no group membership.

---

# 9 — App-side derivation helper

Create a small application helper outside renderers that derives the primary presentation map for a set of canonical entities.

Possible location:

```text
apps/web/src/visual-groups/presentation.ts
```

Input should be something like:

```text
compiled groups
canonical entity lookup
current visible/projected entity IDs
```

Output:

```text
EntityId → primary presentation
```

This helper must not call `projectView()`.

It consumes an already available snapshot/workspace/projection result.

## Evaluate only relevant entities

For renderer presentation, evaluate only entity IDs relevant to the current displayed projection/mode.

Do not scan 40k canonical entities merely to color a 300-node Local view.

Possible flow:

```text
ViewProjection
→ collect entity IDs
→ canonical lookup
→ GROUP1 match
→ presentation map
```

This is outside projection semantics.

---

# 10 — Do not modify ViewProjectionState

Do not add GROUP1 to:

```text
ViewProjectionState
ViewProjectionFilters
StructuralDisclosureState
FocusProjectionState
ProjectedEntityNode
KnowledgeSnapshot
canonical schema
```

Preferred architecture:

```text
ViewProjection
+
VisualGroupPresentationMap
→ renderer
```

not:

```text
Visual Groups
→ projectView()
```

---

# 11 — No graph-view persistence schema bump

Visual Groups are not navigation state.

Do not put them in:

```text
PersistedWorkspaceView
NAV1 checkpoints
semantic viewport
Focus state
filter state
```

GROUP1A should not bump the persisted graph-view schema.

---

# 12 — Persistence backbone

Implement the separate persistence **logic**, but no UI.

Suggested web module:

```text
apps/web/src/persistence/visual-groups.ts
```

Contract:

```ts
interface VisualGroupRegistry {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly groups: readonly VisualGroupDefinition[];
}
```

Suggested key:

```text
icarus-graph-explorer:visual-groups:<encoded workspace id>
```

Do not use:

```text
vault path
vault basename
report filename
view-state storage key
saved-filter storage key
```

## Persistence rationale

Even without UI, defining the durable contract now prevents GROUP1B from inventing storage semantics later.

GROUP1B should be able to consume this module directly.

---

# 13 — Registry validation

Recommended bounds:

```text
max groups: 24
name length: 1–64 trimmed characters
query limits: QUERY1 limits
```

Validate:

- schemaVersion;
- workspaceId;
- array shape;
- unique case-insensitive names;
- query valid/canonical;
- supported palette token;
- enabled boolean;
- bounded count;
- exact serializable fields.

Order must be preserved exactly because order is priority.

Do not alphabetically sort groups.

## Registry mutations

Implement pure operations:

```text
add
update
delete
move up
move down
set enabled
```

These are logic APIs for GROUP1B.

No UI is created in GROUP1A.

## Storage errors

Match the safety posture of Saved Filters:

- corrupt data is reported;
- corrupt stored value is not silently overwritten;
- write errors are explicit;
- serialization is deterministic.

Do not integrate recovery UI.

## Stable workspace policy

Persistence module should be compatible with stable workspace IDs.

Do not wire new product controls into `GraphExplorer` just to exercise storage.

GROUP1B will own the product session wiring.

Unit tests should prove workspace-key isolation.

---

# 14 — Structure React Flow style seam

Add an optional renderer presentation input.

Preferred:

```ts
GraphCanvasProps {
  ...
  visualGroupStyles?: ReadonlyMap<EntityId, VisualGroupNodePresentation>
}
```

Exact name may differ.

Default:

```text
undefined / empty
→ current renderer visuals exactly unchanged
```

This is important: GROUP1A must not change default product appearance.

## React Flow node delivery

Avoid injecting group presentation into topology mapping if that would cause layout/mapping invalidation.

Preferred:

```text
GraphCanvas prop
→ renderer presentation context / lookup
→ EntityNode reads by entityId
```

The layout graph remains identical.

Do not add group color to layout input/fingerprint.

## React Flow visual treatment

Implement a minimal, future-proof accent treatment only for tests/seam validation.

Preferred:

```text
narrow right-side accent strip
```

or equivalent fixed overlay.

Requirements:

- no node dimension change;
- no layout change;
- Document top edge remains;
- Section left edge remains;
- Block dashed grammar remains;
- selection ring remains;
- Focus appearance remains;
- context styling remains legible.

With no style map, appearance must be byte-for-byte/DOM-class-equivalent where practical.

## React Flow interaction precedence

Order:

```text
kind grammar
→ group accent
→ Focus / hover / selection final state
```

Visual Group styling must not override selection/Focus semantics.

## React Flow zero-work oracle

Changing only the Visual Group map must cause:

```text
projectView              +0
projection mapping       +0
Dagre/W3 layout          +0
node geometry changes    0
```

A node style/render update is expected.

Add tests/instrumentation evidence.

---

# 15 — Global Sigma convergence seam

Current Global Sigma explicitly anticipated GROUP1.

Extend the session/style contract to accept the resolved presentation map.

Preferred:

```ts
GlobalRendererSession
  setVisualGroupStyles(styles)
```

or equivalent.

The session should retain the map and use it inside `nodeReducer`.

## Global style order

Conceptually:

```text
base Global document attributes
→ Visual Group base accent
→ LOD visibility
→ hover / selection / deemphasis
```

Do not let group color override selected/hover color.

## Global diagnostics

Global diagnostic/reference-target nodes keep existing status colors.

Do not group-style them.

## Global topology/layout hard invariants

Updating visual group styles must not:

```text
reconcile Graphology topology
change node x/y
change node size
change folder key
change reference degree
change layout fingerprint
request Global ForceAtlas/folder layout
```

Only schedule a style render/refresh.

## Global operation oracle

For a group-map update:

```text
projectView               +0
global mapping            +0
Graphology reconciliation +0
Global layout             +0
style update              +1 expected
```

Add direct session tests.

---

# 16 — Local Free Sigma convergence seam

Local Free contains:

```text
Document
Section
Block
diagnostic target
```

Pass the same canonical EntityId presentation map into the Local renderer.

Do not create a Local-specific group language.

## Local base color behavior

For matched canonical entity nodes:

```text
group accent may replace base entity fill
```

Unmatched entities retain current kind color.

Diagnostic nodes retain status color.

Edges remain unchanged.

## Local final state precedence

Existing:

```text
root
LOD
hover
selection
deemphasis
```

remains authoritative.

Group is a base presentation layer.

## Local no-layout oracle

Updating groups must cause:

```text
Local projection        +0
Local topology mapping  +0
Local worker layout     +0
positions               unchanged
style render            expected
```

If Local session currently lacks a style-only update method, add one.

Do not route group map changes through layout request keys/fingerprints.

---

# 17 — Local Structured concurrency

At prompt-writing time KG13B2B may not yet be merged.

Before final PR:

```text
rebase latest main
```

If Local Structured exists:

- inspect its real renderer architecture;
- feed it the same `EntityId → VisualGroupNodePresentation` map;
- if it reuses React Flow `GraphCanvas`, use the existing GROUP1A React Flow seam;
- do not add a separate query/matching path;
- prove style-only changes do not trigger W3 layout.

If Local Structured is not on main:

- document the exact renderer prop/context it should consume later;
- do not depend on an unmerged branch.

---

# 18 — Cross-renderer classification oracle

For the same canonical entity and same compiled groups:

```text
Structure
Global
Local Free
Local Structured (if present)
```

must resolve:

```text
same primary group name
same color token
same accent value
```

Renderer treatment may differ:

```text
React Flow → accent strip
Sigma → node fill
```

Classification may not differ.

---

# 19 — No UI in GROUP1A

Explicitly do not implement:

```text
Groups toolbar button
Groups overlay
Groups editor
Add/Edit/Delete controls
palette picker UI
Move Up/Down UI
Enabled toggle UI
Inspector Visual Groups section
responsive Groups panel
Use active query button
user-facing group badge
```

Do not alter Filters UI.

Do not alter Settings UI.

Do not add temporary hidden/experimental product controls.

GROUP1B owns all of this.

## Why no UI now

KG13 presentation is still converging around:

```text
Global
Regional
Local Free
Local Structured
```

The current goal is to establish:

```text
one stable classification backbone
+
one stable renderer style seam
```

before designing the product editor.

This reduces UI churn and merge conflicts.

---

# 20 — No NAV1 integration

Group definitions are presentation configuration, not graph navigation.

Do not touch:

```text
GraphStateAction
graphHistoryActionPolicy
GraphHistoryCheckpoint
sameGraphViewState
```

GROUP1A has no user operations anyway.

Future GROUP1B edits should also remain outside NAV1.

---

# 21 — No DISC1 integration

Visual Groups do not alter visibility.

Therefore no GROUP1 code should be called from:

```text
project.ts
disclosure.ts
DISC1 candidate counts
```

Regression:

```text
same ViewProjectionState
same snapshot
same revealableDescendantCount
whether groups exist or not
```

---

# 22 — No QUERY1 active-filter coupling

Group rule evaluation reuses QUERY1 syntax/evaluator.

It does not read:

```text
state.filters.query
```

unless a future GROUP1B UI explicitly copies it into a new group definition.

Active filtering and group classification remain independent.

---

# 23 — No Saved Filter coupling

Visual groups do not reference Saved Filter names or IDs.

The GROUP1A registry is separate from:

```text
SavedGraphFilterRegistry
```

GROUP1B may later offer:

```text
copy Saved Filter query into draft
```

but this is not part of GROUP1A.

---

# 24 — No layout semantics

Do not:

- cluster group members;
- move group members;
- add group force attraction;
- create group nodes;
- create group edges;
- alter Dagre ranks;
- alter Global folder prior;
- alter Local force weights.

Current KG13 spatial architecture owns layout.

---

# 25 — No edge styling

GROUP1A styles canonical entity nodes only.

Do not recolor:

```text
reference edges
hierarchy edges
aggregated edges
diagnostic edges
```

based on group membership.

Existing semantic/status edge cues remain.

---

# 26 — Live update behavior

No durable membership cache.

When a source update changes an entity path/title:

```text
canonical entity changes
→ next presentation-map derivation evaluates current entity
→ group match may change
```

Group definitions themselves are unchanged.

Do not store match lists that require complex invalidation.

---

# 27 — Workspace switching

Registry logic must be workspace-ID scoped.

The runtime presentation map belongs to the current workspace/session.

Do not leak:

```text
EntityId → group style
```

maps between workspaces.

No GraphExplorer product wiring is required in GROUP1A, but pure tests/helpers should make the lifecycle obvious.

---

# 28 — Package tests

Test:

## Definition validation

- valid canonical query;
- invalid query;
- noncanonical query policy;
- valid palette;
- invalid palette;
- enabled boolean;
- trimmed name.

## Compilation

- parse once per compile call;
- disabled groups excluded from active evaluator path;
- deterministic result.

## Priority

```text
A and B match
A first
→ A primary
```

Then reverse order:

```text
→ B primary
```

## All matches

Returns all enabled matches in priority order.

## QUERY1 semantic reuse

For canonical Document/Section/Block fixtures:

```text
direct matchesGraphQuery
==
Visual Group compiled match
```

Do not duplicate predicate semantics.

---

# 29 — Presentation-map tests

Create neutral canonical fixture and projection/entity-ID subset.

Verify:

- only requested/current entity IDs evaluated;
- matching entity receives primary presentation;
- unmatched omitted;
- diagnostics omitted;
- map keyed by canonical EntityId;
- same group result independent from renderer mode.

---

# 30 — Persistence tests

Implement pure tests for:

1. empty storage;
2. valid registry load;
3. round trip;
4. workspace ID isolation;
5. exact order preservation;
6. schema mismatch;
7. corrupt JSON;
8. duplicate names;
9. invalid query;
10. noncanonical query;
11. invalid palette;
12. max group count;
13. add;
14. update;
15. delete;
16. move up;
17. move down;
18. enable/disable;
19. write error;
20. deterministic serialization.

No UI tests required.

---

# 31 — React Flow tests

Inject a non-empty group map directly into `GraphCanvas`/node presentation harness.

Verify:

```text
same projection
same mapped RendererGraph
same positions
different group map
```

results only in style difference.

Check:

- Document grammar retained;
- Section grammar retained;
- Block grammar retained;
- diagnostic card unchanged;
- Focus appearance retained;
- selection ring retained;
- hover fade retained.

## React Flow operation-count test

If current performance instrumentation can observe it:

```text
initial render
→ mapping/layout once

update group map only
→ mapping/layout counts unchanged
```

If current instrumentation cannot observe exactly, add the smallest renderer-local test seam.

Do not redesign performance framework.

---

# 32 — Global Sigma tests

Test the actual session/style layer.

Inject:

```text
EntityId → VisualGroupNodePresentation
```

Verify:

- matching document uses group base accent;
- unmatched document retains existing base;
- diagnostic node unchanged;
- hover wins;
- selection wins;
- unrelated hover deemphasis still works;
- LOD labels unchanged;
- positions identical before/after;
- graph order/size identical;
- no layout request;
- no topology reconciliation.

---

# 33 — Local Free tests

Inject the same group presentation.

Verify:

- Document group accent;
- Section group accent;
- Block group accent;
- unmatched kind colors unchanged;
- diagnostic colors unchanged;
- hierarchy/reference edge style unchanged;
- root style remains;
- hover/selection remains;
- positions identical;
- local layout request count unchanged.

---

# 34 — Local Structured tests if present

If latest main includes B2B:

- same canonical group classification;
- React Flow style seam reused if applicable;
- no query duplication;
- no W3 layout on group map change;
- no node geometry change.

---

# 35 — Performance benchmark

Add a focused GROUP1A benchmark/harness.

At minimum:

```text
small visible entity set
medium visible entity set
4 groups
8 groups
```

Measure separately:

```text
compile definitions
derive primary presentation map
renderer style update
```

Do not include projection inside group assignment timing.

## Performance expectations

GROUP1A matching complexity:

```text
O(visible entities × enabled groups × bounded query AST)
```

with:

- bounded group count;
- bounded QUERY1 AST;
- first-match short circuit;
- no parsing per entity.

The benchmark should report actual numbers, not invent new CI timing gates unless latest performance policy requires them.

## Protect QUERY1 cliff

Explicitly prove:

```text
projectView()
```

does not receive Visual Group definitions as input.

Therefore the known advanced-query projection benchmark should have:

```text
same operation path
same projection code
```

with GROUP1A installed.

Do not run group classification from KG6.

---

# 36 — Existing renderer operation boundaries

Preserve:

```text
Global style update
≠ Global layout

Local style update
≠ Local layout

React Flow presentation update
≠ Dagre layout
```

If any current renderer architecture makes this impossible, fix the narrow style-update seam rather than routing through expensive topology work.

This is one of GROUP1A's main deliverables.

---

# 37 — Documentation

Create:

```text
packages/visual-groups/README.md
```

Document:

- why GROUP1A exists;
- semantic separation from QUERY1/filtering;
- convergence with KG13 renderers;
- definition contract;
- palette;
- priority;
- compilation;
- primary vs all-match APIs;
- EntityId presentation map;
- no layout semantics;
- no projection semantics;
- GROUP1B UI handoff.

## Architecture documentation

Update, as appropriate:

```text
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/PERFORMANCE.md
packages/renderer-reactflow/README.md
packages/renderer-sigma/README.md
apps/web/README.md
```

Do not claim GROUP1 full product UI is complete.

Use wording like:

```text
GROUP1A backbone complete
GROUP1B user-facing configuration pending
```

only after merge.

## Roadmap semantics

Do not resurrect standalone LAYOUT1.

Keep the existing KG13 spatial direction.

Visual Groups remain:

```text
visual classification
```

not:

```text
layout clusters
```

---

# 38 — No external dependencies

Expected:

```text
0 new external dependencies
```

A workspace package is fine.

Do not add:

```text
color library
parser generator
query library
state manager
drag/drop
UI framework
icon library
```

---

# 39 — No source/canonical changes

Do not modify semantics of:

```text
core entity schema
Markdown parser
Obsidian adapter
resolver
stable identity
KG10 incremental engine
Tauri source provider
reference resolution
```

Visual groups are derived presentation configuration.

---

# 40 — No user-visible product changes by default

With no Visual Group map supplied, every renderer must look and behave exactly as before.

GROUP1A is allowed to add style capabilities but should not expose seeded/default groups in normal product use.

Do not automatically create groups for:

```text
folders
entity kinds
reference statuses
```

No default visual classification.

---

# 41 — Worktree conflict minimization

Because this branch runs concurrently:

Prefer adding:

```text
packages/visual-groups/*
apps/web/src/persistence/visual-groups.ts
apps/web/src/visual-groups/*
renderer-local style context modules
```

over large GraphExplorer rewrites.

Avoid GraphExplorer changes entirely unless required for a compile-time renderer prop seam.

Where possible:

```text
optional renderer prop defaults empty
```

so current application callers need no semantic change.

---

# Required first inspection

Before editing, inspect latest:

```text
AGENTS.md

docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/GLOBAL_RENDERER_DECISION.md
docs/decisions/0013*
docs/decisions/0014*

packages/graph-query/*
packages/view-projection/*
packages/view-state/*

packages/renderer-reactflow/*
packages/renderer-sigma/*

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/GlobalGraphView.tsx
apps/web/src/components/LocalGraphView.tsx
apps/web/src/persistence/saved-filters.ts
apps/web/src/persistence/storage.ts
apps/web/src/global-view.ts
apps/web/src/local-view.ts

current renderer/performance tests
current active branches/worktrees if locally visible
```

Also inspect changes since:

```text
f1c8127782c50660416f2fdf3d50574925a0706c
```

if `main` advanced.

Adapt to latest main.

---

# Likely files

Use actual current repository structure.

Likely new:

```text
packages/visual-groups/
  package.json
  tsconfig.json
  README.md
  src/
    types.ts
    palette.ts
    validation.ts
    compile.ts
    match.ts
    index.ts
    *.test.ts

apps/web/src/persistence/visual-groups.ts
apps/web/src/persistence/visual-groups.test.ts

apps/web/src/visual-groups/presentation.ts
apps/web/src/visual-groups/presentation.test.ts
```

Likely React Flow:

```text
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/styles.css
possibly visual-group-context.tsx
tests
```

Likely Sigma:

```text
packages/renderer-sigma/src/style.ts
packages/renderer-sigma/src/session.ts
packages/renderer-sigma/src/GlobalGraphCanvas.tsx

packages/renderer-sigma/src/local-style.ts
packages/renderer-sigma/src/local-session.ts
packages/renderer-sigma/src/LocalGraphCanvas.tsx

tests
```

If Local Structured lands, include its actual renderer files narrowly.

---

# Suggested implementation order

1. Create dedicated GROUP1A worktree/branch from latest main.
2. Inspect concurrent work and latest architecture.
3. Create `visual-groups` package.
4. Define palette and `VisualGroupDefinition`.
5. Implement validation/canonicalization.
6. Implement compile/match priority APIs.
7. Add pure package tests.
8. Implement persistence registry logic.
9. Add persistence tests.
10. Implement app-side EntityId presentation-map helper.
11. Add presentation-map tests.
12. Add React Flow optional style-map seam.
13. Prove zero mapping/layout for style-only update.
14. Add Global Sigma style-only seam.
15. Prove zero Graphology/layout for style-only update.
16. Add Local Free style-only seam.
17. Prove zero Local layout for style-only update.
18. Add cross-renderer consistency tests.
19. Add GROUP1A benchmark.
20. Update docs.
21. Rebase onto latest main.
22. If KG13B2B landed, integrate same seam into Local Structured.
23. Run full validation.
24. Archive this prompt.
25. PR → CI → merge → post-merge CI → cleanup.
26. Do not start GROUP1B automatically.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/visual-groups typecheck
pnpm exec vitest run packages/visual-groups

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm desktop:check
git diff --check
```

Run current relevant:

```text
Global renderer benchmark
Local renderer benchmark
Dagre worker benchmark
workspace worker benchmark
QUERY1 projection benchmark
GROUP1A match/style benchmark
```

according to latest main conventions.

Run PR CI and post-merge `main` CI.

---

# Exit gate

GROUP1A is complete only when:

1. `@icarus-graph-explorer/visual-groups` exists.
2. It is source-neutral.
3. It reuses `graph-query`.
4. No duplicate query parser exists.
5. No external dependency is added.
6. `VisualGroupDefinition` has name/query/color/enabled.
7. Query is canonical QUERY1 syntax.
8. Palette uses stable named tokens.
9. Arbitrary CSS is impossible through the durable contract.
10. Priority is array order.
11. First enabled match wins.
12. Disabled groups do not match.
13. All enabled matches can be returned in priority order.
14. Group rules parse once per compile/definition change.
15. Queries are not parsed per entity.
16. Matching uses canonical `AddressableEntity`.
17. Presentation is keyed by canonical `EntityId`.
18. Renderer presentation map is runtime-only.
19. Matched EntityId lists are not persisted.
20. Group definitions do not enter `KnowledgeSnapshot`.
21. Group definitions do not enter `ViewProjectionState`.
22. Group definitions do not enter `ViewProjectionFilters`.
23. GROUP1A does not touch DISC1 candidate computation.
24. GROUP1A does not alter Focus semantics.
25. GROUP1A does not alter Structure depth.
26. GROUP1A does not alter Heading limit.
27. GROUP1A does not alter Blocks semantics.
28. GROUP1A does not alter reference resolution.
29. GROUP1A does not add group edges.
30. GROUP1A does not add layout forces.
31. GROUP1A does not revive LAYOUT1.
32. Separate Visual Group registry schema exists.
33. Registry is workspace-ID scoped.
34. Registry key contains no filesystem path.
35. Registry preserves priority order.
36. Registry validates duplicate names.
37. Registry validates query canonicality.
38. Registry validates palette tokens.
39. Registry validates enabled boolean.
40. Registry count is bounded.
41. Persistence serialization is deterministic.
42. Corrupt storage is not silently overwritten.
43. Write failures are explicit.
44. Pure add mutation works.
45. Pure update mutation works.
46. Pure delete mutation works.
47. Pure move-up/down works.
48. Pure enabled mutation works.
49. No Groups UI is added.
50. No Groups toolbar trigger is added.
51. No Groups overlay is added.
52. No group editor is added.
53. No palette picker UI is added.
54. No Inspector group section is added.
55. No active-query copy UI is added.
56. `GraphExplorer` is not substantially rewritten.
57. Empty/default style map preserves current visual output.
58. React Flow accepts resolved group presentation.
59. React Flow does not parse group queries.
60. React Flow node geometry is unchanged.
61. React Flow kind grammar remains.
62. React Flow selection remains authoritative.
63. React Flow Focus appearance remains authoritative.
64. React Flow hover/deemphasis remains.
65. React Flow style-map update does not call `projectView()`.
66. React Flow style-map update does not remap topology.
67. React Flow style-map update does not request W3/Dagre layout.
68. Global Sigma accepts resolved group presentation.
69. Global Sigma does not parse group queries.
70. Global document base accent can come from group presentation.
71. Global diagnostics retain status colors.
72. Global hover remains authoritative.
73. Global selection remains authoritative.
74. Global LOD logic remains.
75. Global group update does not reconcile topology.
76. Global group update does not request layout.
77. Global positions are unchanged by group update.
78. Global layout fingerprint excludes group styling.
79. Local Free accepts resolved group presentation.
80. Local Free does not parse group queries.
81. Local Document can receive group accent.
82. Local Section can receive group accent.
83. Local Block can receive group accent.
84. Local diagnostics retain status colors.
85. Local edges remain unchanged.
86. Local root state remains authoritative.
87. Local hover remains authoritative.
88. Local selection remains authoritative.
89. Local LOD remains authoritative.
90. Local group update does not reproject.
91. Local group update does not remap topology unnecessarily.
92. Local group update does not request local layout.
93. Local positions remain unchanged by group update.
94. Same canonical entity resolves same primary group across renderers.
95. If Local Structured exists at final rebase, it uses the same classification/style contract.
96. If Local Structured does not exist, GROUP1A documents the seam it should use.
97. Group classification is independent from active QUERY1 filtering.
98. Saved Filters are not referenced by durable Visual Groups.
99. Group definitions create no NAV1 state.
100. Group styling causes no semantic viewport movement.
101. Same projection has identical DISC1 counts with/without group definitions.
102. Same projection output is independent of group registry.
103. GROUP1A matching benchmark exists.
104. Benchmark covers multiple groups.
105. Benchmark separates compile from match.
106. Benchmark separates projection from group matching.
107. GROUP1A does not add group work to `projectView()`.
108. Known QUERY1 projection cliff is not "fixed" by coupling groups into projection.
109. Renderer style-update operation oracle is tested.
110. Core/parser/adapter/resolver remain unchanged.
111. Stable identity semantics remain unchanged.
112. Global/Local topology semantics remain unchanged.
113. Default product has no seeded groups.
114. Default product appearance remains unchanged.
115. Full visual-groups package tests pass.
116. React Flow tests pass.
117. Sigma Global tests pass.
118. Sigma Local tests pass.
119. Web persistence/helper tests pass.
120. Full `pnpm check` passes.
121. Production web build passes.
122. `pnpm desktop:check` passes.
123. Relevant performance benchmarks pass/report.
124. PR CI passes.
125. Post-merge main CI passes.
126. Prompt archived under repository convention.
127. Dedicated worktree/branch cleaned after merge.
128. Concurrent unrelated work remains untouched.
129. GROUP1B is not started.

---

# Final completion report

Report:

## 1. Summary

PR, implementation commit, merge commit, CI.

## 2. Starting/rebased main

Starting SHA and final rebase SHA. Note concurrent KG13/performance work that landed.

## 3. Architecture

Explain:

```text
QUERY1
→ visual-groups
→ EntityId presentation map
→ Structure / Global / Local
```

## 4. Visual Group contract

Fields, palette, limits.

## 5. Priority / overlap

First-match semantics and all-match API.

## 6. QUERY1 reuse

Confirm no grammar/evaluator duplication.

## 7. Persistence backbone

Registry schema, key, order, validation, error behavior.

## 8. App presentation-map derivation

How visible canonical entity IDs become a style map without projection changes.

## 9. Structure seam

Exact React Flow integration and why layout is unaffected.

## 10. Global seam

Exact Sigma style integration and zero topology/layout evidence.

## 11. Local Free seam

Exact Sigma style integration and zero worker-layout evidence.

## 12. Local Structured

If present, integration; otherwise future handoff contract.

## 13. Semantic isolation

Confirm no DISC1/STRUCT1/Focus/filter/reference changes.

## 14. NAV1 / viewport

Confirm no integration and no movement.

## 15. Performance

Report:

- group compile time;
- primary assignment time;
- 4/8-group benchmarks;
- renderer style update timings;
- operation counts;
- proof `projectView()` does not consume groups.

## 16. Default-product behavior

Confirm no user-facing Groups UI and no changed appearance without a supplied style map.

## 17. Dependencies / schemas

External deps, workspace package, Visual Group registry schema, graph-view schema unchanged.

## 18. Tests / validation

Commands/test counts/benchmarks/CI.

## 19. Files changed

Important backbone/persistence/renderer/test/docs files.

## 20. Deviations / warnings

Any concurrency adaptation or renderer limitation.

## 21. GROUP1B handoff

GROUP1B should be able to add only:

```text
Groups product controls
editor form
palette selection
enable/reorder/delete
workspace registry session wiring
Inspector textual membership presentation
responsive overlay
```

without redesigning:

```text
query semantics
priority
palette storage
matching
EntityId presentation map
renderer style seams
```

Do not implement GROUP1B automatically.
