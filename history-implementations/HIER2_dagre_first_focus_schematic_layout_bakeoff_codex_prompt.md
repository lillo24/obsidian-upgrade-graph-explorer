# HIER2 — Dagre-First Focus Schematic Layout Bake-Off

**Task type:** development-only layout research / reproducible prototype comparison / visual lab / performance evidence / architecture decision

## Goal

Use the HIER1 semantic model and quality harness to determine the cleanest layout strategy for the future production **Focus + Hierarchy** schematic.

The accepted product target is:

```text
incoming hop 3   incoming hop 2   incoming hop 1      FOCUS
      ←                 ←                 ←              0
                                                           →
                                                outgoing hop 1
                                                           →
                                                outgoing hop 2
                                                           →
                                                outgoing hop 3
```

More precisely:

```text
horizontal direction
→ authored reference flow relative to Focus

left
→ Files whose directed paths flow toward the focused File

center
→ focused File module

right
→ Files reached by directed paths from the focused File

horizontal distance
→ reference-hop distance

inside each File module
→ visible File / Heading / Block hierarchy

vertical arrangement
→ clear reference paths first
→ Heading endpoint alignment
→ collision avoidance
→ source-folder coherence as a soft preference
```

HIER2 must test how far the existing pinned Dagre library can take us before considering a custom macro-layout algorithm.

It must produce:

1. reproducible Dagre-based layout prototypes;
2. a development-only visual comparison lab;
3. objective HIER1 quality/performance/stability evidence;
4. a user-reviewed strategy decision;
5. a precise HIER3 handoff.

HIER2 must **not** replace the production renderer.

Production Focus Hierarchy remains on the HIER0 path until HIER3:

```text
current Focus projection
→ flat React Flow mapping
→ current stateless W3 Dagre worker
→ HIER0 collision-safe adoption
```

## Mandatory preservation of the current Focus Hierarchy

The current Focus Hierarchy is **not disposable**.

The user likes its present visual effect and wants it retained as a usable legacy/classic presentation even after a future modular Focus Schematic becomes the normal Hierarchy layout.

HIER2 must therefore treat the current implementation as:

```text
Classic Focus Hierarchy
```

and preserve a reproducible behavioral/visual baseline for it.

HIER2 must **not** hide or relocate it yet, because it remains the only production Focus-Hierarchy implementation during this research milestone.

Before HIER3 is allowed to replace the default Hierarchy layout, HIER3 must:

```text
1. preserve the current flat React Flow + Dagre path as a distinct strategy;
2. keep its current visual grammar and interaction behavior;
3. make the new modular schematic the normal Focus-Hierarchy option;
4. hide Classic Focus Hierarchy by default;
5. expose it through Settings → Graph → Experimental;
6. reveal a Focus layout choice such as “Hierarchy (Classic)” only when enabled;
7. retain tests so the classic path cannot silently rot.
```

The existing setting:

```text
Show All Hierarchy
```

and the future setting:

```text
Show Classic Focus Hierarchy
```

are separate concepts:

```text
Show All Hierarchy
→ exposes the current whole-vault Hierarchy scope

Show Classic Focus Hierarchy
→ exposes the preserved old Focus-Hierarchy layout after the new modular layout exists
```

“Preserve a copy” means preserve the user-visible layout/style/behavior behind a separately selectable code path. It does **not** require wasteful duplication of shared React Flow controls, selection, Inspector, or disclosure code when those can remain safely shared.

However, HIER3 must not overwrite the old layout algorithm in place and then call it preserved.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at plan-writing time:

```text
cbe04b8a77c9b76969806fd7443c7e040153c526
```

Merged baseline:

```text
HIER0
→ All + Hierarchy hidden by default
→ Focus + Hierarchy normally available
→ collision-safe seed/adoption/fallback
→ duplicate compact File names disambiguated

HIER1
→ @icarus-graph-explorer/focus-schematic
→ deterministic File modules
→ directional path semantics
→ parent/backbone candidates
→ diagnostics and filtered intermediates
→ strict layout-candidate validator
→ shared quality/stability evaluators

SPATIAL1A
→ normalized source-folder anchor foundation for All Network
→ separate from automatic Focus Schematic folder semantics
```

HIER1 merged through:

```text
PR #58
cbe04b8a77c9b76969806fd7443c7e040153c526
```

At plan-writing time, there are no open pull requests. Check again before branching and before merge.

Current validation baseline:

```text
140 test files
1,216 tests
desktop check/build
small/medium/hub Focus Schematic benchmarks
```

HIER1 hub evidence:

```text
1,000 modules
4,000 entities
4,238 references
1,240 relationships
48.099 / 52.260 ms prepared model construction
```

Use:

```text
docs/HIER0_VALIDATION.md
docs/HIER1_VALIDATION.md
docs/decisions/0017-focus-schematic-semantic-model-before-layout.md
```

as the implemented source of truth.

---

# User-owned / concurrent work

Before editing:

1. sync current `main`;
2. inspect open PRs and registered worktrees;
3. create an isolated HIER2 branch/worktree;
4. preserve unrelated user changes and untracked files;
5. preserve SPATIAL1 work;
6. integrate latest `main` before final validation if another task merges.

Do not rewrite `AGENTS.md` instruction text.

`docs/ROADMAP.md` currently exists and may be updated normally.

---

# Existing HIER1 contracts

The Focus Schematic model already contains:

```text
modules
folders
cross-module relationships
visible endpoint groups
internal references
diagnostics
incoming/outgoing distances
allowed/preferred sides
rank magnitude
Focus-path roles
secondary relationships
parent candidates
filtered intermediates
```

The candidate contract already requires:

```text
module rectangles
visible-node rectangles
optional relationship routes
root module ID
```

The shared evaluator already reports:

```text
coverage
finite geometry
module overlap
node overlap
node containment
root offset
left/right violations
rank violations
bounds / empty area / aspect ratio
folder coherence
route-aware or approximate crossings
edge-node intersections
Heading alignment proxy
layout stability
```

Use these contracts.

Do not create a competing semantic model or a second quality system.

If HIER2 exposes a genuine HIER1 harness defect, fix it narrowly with a regression test and document the correction. Do not redesign schema v1 for convenience.

---

# Dagre baseline and constraints

The repository pins:

```text
@dagrejs/dagre 3.1.1
```

The installed version exposes:

```text
compound graphs
setParent(...)
per-cluster rankdir/ranksep/nodesep/align
rankers:
  network-simplex
  tight-tree
  longest-path

layout options:
  useDynamic
  corePath
  ordering constraints

edge output points
```

The existing production wrapper supports only:

```text
flat nodes
flat hierarchy/reference edges
one global layout mode
node positions only
```

It currently discards Dagre edge points.

## Source-of-truth rule

Before implementing prototypes, inspect:

```text
node_modules/@dagrejs/dagre
its bundled TypeScript declarations
official v3.1.1 source/tag
current repository wrapper
```

The installed v3.1.1 package outranks old memory, master-branch behavior, or assumptions.

Do not upgrade Dagre in HIER2.

Do not fork, patch, monkey-patch, or copy Dagre internals.

Use public APIs only.

A strategy that requires private fields, source modification, or fragile synthetic hacks should be scored as architecturally weak or rejected.

---

# Decision outcomes

HIER2 must end with exactly one explicit result:

```text
ADOPT_TWO_STAGE_DAGRE

ADOPT_COMPOUND_DAGRE

ADOPT_TWO_STAGE_DAGRE_WITH_BOUNDED_SEMANTIC_POSTPASS

NO_DAGRE_STRATEGY_PASSES
```

If one strategy is adopted:

```text
HIER3
→ production modular Focus layout integration
→ new modular Hierarchy becomes the normal Focus-Hierarchy layout
→ current HIER0 layout is preserved as Classic Focus Hierarchy
→ Classic is hidden by default behind Settings → Graph → Experimental
```

If no strategy passes:

```text
HIER2B
→ bounded custom macro-layout investigation
```

Do not begin HIER2B or HIER3 automatically.

Do not force a winner merely because a milestone name says “bake-off.”

---

# Core comparison principle

All strategies must consume the same:

```text
FocusSchematicModel
visible-node dimensions
module padding
filtered-module policy
resolved equal-mutual layout plan
selected macro backbone
quality evaluator
fixture corpus
performance profiles
```

Differences must come from the layout strategy, not hidden changes in semantic input.

Do not let every strategy choose its own side policy, filtered treatment, node sizes, or edge set. That would make the comparison meaningless.

---

# 1. Add a development-only bake-off package/tool boundary

Preferred structure:

```text
packages/focus-schematic-layout
```

for reusable renderer-independent input/planning contracts and, after the decision, the selected strategy only;

plus:

```text
tools/focus-schematic-bakeoff
```

or an equivalent clearly development-only area for:

```text
current-flat baseline adapter
rejected/experimental strategy implementations
configuration calibration
visual-lab generation
benchmark orchestration
decision reports
```

A single development-only package is also acceptable if it keeps the production boundary clear.

## Runtime dependency direction

Common/selected layout code may depend on:

```text
core
view-projection
focus-schematic
@dagrejs/dagre 3.1.1
```

or on the existing `dagre-layout` package where its public API is sufficient.

It must not depend on:

```text
React
React DOM
React Flow
Sigma
Graphology
Tauri
filesystem source providers
Obsidian adapter/runtime
web app state
SPATIAL1 registries
presentation overrides
```

The visual-lab/tool layer may use Node APIs and existing development dependencies.

External package additions:

```text
zero
```

Adding a direct manifest reference to the already pinned Dagre 3.1.1 is acceptable; adding another layout library is not.

---

# 2. Production isolation

HIER2 is not a production feature.

The current Focus Hierarchy remains the normal production layout throughout HIER2. Do not move it behind Experimental yet.

HIER2 should nevertheless capture enough reproducible D0 evidence and compatibility expectations that HIER3 can preserve it as `Classic Focus Hierarchy` before changing the default.

Do not import the bake-off or selected strategy from:

```text
GraphExplorer
LocalStructuredGraphView
renderer-reactflow production mapping
W3 production worker
desktop app
view-state
```

Add/retain a production-boundary scan proving this.

The ordinary web production bundle should not include HIER2 strategy code.

The current `.exe` must behave identically.

---

# 3. Layout input with explicit dimensions

The HIER1 semantic model intentionally contains no renderer dimensions.

Define a renderer-neutral input, conceptually:

```ts
interface FocusSchematicLayoutInput {
  readonly model: FocusSchematicModel;
  readonly projection: ViewProjection;

  readonly nodeDimensions: readonly {
    readonly projectionNodeId: ProjectionNodeId;
    readonly width: number;
    readonly height: number;
  }[];

  readonly settings: FocusSchematicPrototypeSettings;
}
```

Strictly validate:

- one dimension record for every visible entity node;
- no dimensions for unknown nodes;
- finite positive sizes;
- module/node ownership consistent with HIER1;
- deterministic ordering;
- no labels or source text required by the layout backend.

## Production-realistic dimension adapter

The bake-off tool should derive dimensions from the current **extended Focus Hierarchy** mapping rather than quietly inventing different cards.

Current extended dimensions are approximately:

```text
File     200 × 80
Heading  184 × 72
Block    152 × 64
```

Use the current renderer exports/mapping through a **tool/test-only adapter**.

The reusable layout package should receive explicit dimensions and remain independent of `renderer-reactflow`.

Add a regression so future renderer dimension changes cannot silently make the bake-off evidence stale.

---

# 4. Common module-box policy

All strategies need the same module box rules.

For a visible module:

```text
module bounds
=
bounding box of internal visible entity nodes
+
fixed module padding
+
optional diagnostic reserve
```

Use one frozen padding profile during comparison.

Suggested starting shape, subject to calibration:

```text
left/right padding: 24–32 px
top/bottom padding: 20–28 px
internal hierarchy gap: current card-outline clearance or more
macro module gap: at least HIER0's 16 px outline clearance plus breathing room
```

Do not tune padding per fixture.

## Module border

The module rectangle is a layout boundary.

It need not imply that production will draw a literal box.

The visual lab should show it as a subtle dashed outline so layout behavior is inspectable.

---

# 5. Diagnostics during HIER2

HIER1 layout candidates currently cover:

```text
modules
visible entity nodes
relationship routes
```

not individual diagnostic rectangles.

Do not change the candidate schema merely to broaden HIER2.

To avoid underestimating module size, use a common diagnostic-reserve policy:

```text
module has N diagnostics
→ reserve a bounded local shelf/strip in module dimensions
```

The visual lab may show:

```text
“N diagnostics”
```

or simple synthetic markers inside that reserved area.

Do not claim production diagnostic routing/placement is solved.

Exact diagnostic-card placement remains HIER3 integration work and must still reuse HIER0 collision guarantees.

---

# 6. Filtered-intermediate policy gate

A module may belong to the fixed Focus neighborhood while having:

```text
presentation = filtered
visibleEntityNodeIds = []
```

The HIER1 candidate still requires positive module geometry.

Before the main strategy comparison, evaluate two common policies on F14 and related holdout cases:

## Policy F-A — compact anonymous bridge

```text
small dashed layout module
no private File title
accessible/dev label: “Filtered path intermediary”
participates in rank/backbone
```

## Policy F-B — File-sized context placeholder

```text
normal File-card-sized ghost module
no source title by default
participates in rank/backbone
```

Do not compare a policy that simply deletes the module; that would discard the reason a farther File exists.

Decision criteria:

```text
path comprehensibility
space cost
crossings
query/filter truthfulness
future accessibility
implementation clarity
```

Freeze one filtered-module policy before comparing A/B/C across the full holdout corpus.

If the visual difference requires user judgment, include both in the lab and get approval.

Do not implement filtered modules in production.

---

# 7. Shared equal-mutual side resolver

HIER1 deliberately leaves equal-mutual modules eligible for both sides.

Create one deterministic layout-planning stage shared by every prototype.

Conceptual output:

```ts
interface FocusSchematicLayoutPlan {
  readonly modules: readonly {
    readonly moduleId: EntityId;
    readonly side: 'center' | 'left' | 'right';
    readonly signedRank: -3 | -2 | -1 | 0 | 1 | 2 | 3;
    readonly parentModuleId: EntityId | null;
    readonly parentRelationshipId: string | null;
  }[];
}
```

For non-mutual modules:

- use the HIER1 preferred side/rank;
- use HIER1's selected parent candidate.

For equal-mutual modules, compare both sides using a documented lexicographic policy:

```text
1. valid candidate availability;
2. stronger best parent candidate:
   endpoint specificity
   reference count
   same-folder preference;
3. lower estimated height load in that signed rank;
4. better folder continuity with already assigned modules;
5. deterministic side-balance tie-break;
6. stable EntityId tie-break only after all semantic costs tie.
```

Requirements:

- process equal-mutual modules in deterministic order;
- one chosen side and one parent after planning;
- parent rank is exactly one step nearer the root;
- no cycle;
- no title/path-string heuristic except stable final tie-breaking where necessary;
- all strategies use the same plan;
- the plan itself is JSON-serializable and validated;
- record how many modules required the final arbitrary tie-break.

Do not mutate the HIER1 semantic model to pretend equal mutual was never ambiguous.

---

# 8. Shared macro backbone

After layout planning, create one backbone edge per non-root module:

## Left/incoming

```text
child module → parent nearer root
```

## Right/outgoing

```text
parent nearer root → child module
```

Use the selected HIER1 parent relationship.

Properties:

```text
one parent per non-root module
distance decreases by exactly one toward root
acyclic by construction
root has no parent
authored direction remains truthful
```

All strategies use this same backbone for positioning.

Other Focus-path relationships remain semantic/visible evidence but do not receive equal positioning authority.

Secondary relationships never affect layout in HIER2.

This isolates:

```text
layout backbone
→ position

all Focus-path relationships
→ later visible explanation

secondary relationships
→ optional later context
```

---

# 9. Strategy D0 — current flat Dagre baseline and Classic-preservation baseline

Build a development-only adapter representing the current production approach:

```text
all visible File/Heading/Block nodes
+
all current detailed hierarchy/reference edges
→ one flat local-structured Dagre graph
```

Then derive module rectangles from the resulting node positions.

Purpose:

- quantify the current baseline;
- show interleaved File structures;
- compare crossings/area/stability;
- confirm HIER0 collision safety does not imply semantic module quality.

D0 is not a candidate for adoption as the **new default modular layout**.

It is, however, the preservation baseline for the future:

```text
Classic Focus Hierarchy
```

Record the current path's important behavior so HIER3 can prove that its experimental Classic option remains faithful:

```text
flat entity-level Dagre input
current extended File/Heading/Block cards
current hierarchy/reference edge visual grammar
HIER0 collision-safe seed, diagnostic placement and fallback
current disclosure controls
selection, keyboard navigation and Inspector behavior
root anchoring and viewport restoration
current stateless W3/cache/failure behavior
```

Prefer behavioral and geometry/component regression tests over brittle screenshot-pixel goldens.

HIER3 may share generic renderer infrastructure, but it must retain a distinct classic layout strategy rather than route the Classic option through the new modular algorithm.

For models containing filtered modules that the current production layout cannot represent faithfully:

```text
status = unsupported
```

Do not manufacture misleading offscreen nodes solely to satisfy validation.

The bake-off result format must support:

```text
success
unsupported
failure
timeout
```

---

# 10. Strategy A — two-stage Dagre

This is the recommended Dagre-first baseline.

## A1. Internal File-module layout

For each visible/context module independently:

```text
nodes
→ that module's visible File / Heading / Block nodes

edges
→ that module's hierarchy edges only
```

Do not include:

```text
cross-file references
internal semantic references
secondary links
diagnostics as graph edges
```

Use:

```text
rankdir = LR
```

so the File root sits left of its visible Heading generations.

Requirements:

- document node remains the internal root where present;
- sections/blocks remain inside the module;
- actual node dimensions;
- zero node overlap;
- deterministic insertion order;
- source-order sibling preservation where Dagre's public ordering constraints support it cleanly;
- no undocumented rank/order mutation after layout;
- filtered modules use the selected shared placeholder policy;
- module dimensions are computed from local node bounds + common padding/reserve.

## A2. Macro module layout

Create one Dagre node per module using computed variable dimensions.

Add only the shared macro backbone.

Use:

```text
rankdir = LR
```

The incoming backbone naturally flows:

```text
left modules → root
```

and the outgoing backbone:

```text
root → right modules
```

Requirements:

- root normalized to center `(0, 0)`;
- authored direction preserved;
- all modules covered;
- no module overlap;
- no side/rank violations;
- local node positions translated into world coordinates;
- no reference edge is allowed to distort internal File structure.

## A3. Route evidence

Capture native Dagre macro edge points for selected backbone edges as **separate exploratory evidence**.

Do not use incomplete native-route coverage to make route-aware metrics look artificially good.

The primary A candidate should either:

```text
routes = []
```

and use the HIER1 approximate-crossing metric,

or provide equal full route coverage under a shared router used by all strategies.

Use one fair rule across A/B/C.

---

# 11. Strategy B — compound Dagre 3.1.1

Test whether Dagre's compound/per-cluster support can solve the model elegantly in one layout graph.

Construct:

```text
compound Graph
├─ cluster node per File module
│  └─ visible File / Heading / Block child nodes
└─ selected cross-cluster backbone edges
```

Use public:

```text
Graph({ compound: true, multigraph: true })
setParent(...)
layout(...)
```

Per-cluster settings may use:

```text
rankdir = LR
ranksep
nodesep
align
```

Global graph:

```text
rankdir = LR
```

## Cross-cluster edge endpoints

For each selected backbone relationship:

1. prefer the best precise visible endpoint group;
2. otherwise use the document node;
3. for a filtered module with no visible node, use one clearly named internal synthetic anchor child.

Synthetic anchors:

- stay internal to the prototype;
- never appear as candidate visible nodes;
- must be deterministic;
- must not leak into semantic IDs;
- must not grow into a general hidden-node workaround system.

## Output

Derive:

```text
cluster/module rectangles
child node rectangles
root normalization
native edge points where available
```

## Failure policy

Compound Dagre is rejected or penalized if it requires:

- accessing private Dagre transient fields;
- patching cluster internals;
- manually repairing omitted child positions;
- repeated cluster overlap;
- order-dependent crashes;
- non-deterministic cold output;
- special cases keyed to fixtures;
- copying Dagre source.

Record exceptions and unsupported cases; do not hide them behind the HIER0 fallback.

---

# 12. Strategy C — conditional bounded semantic post-pass

Do not implement Strategy C automatically before A and B are measured.

Build it only when the best pure Dagre result has specific, measurable weaknesses that a **small bounded post-pass** can address, such as:

```text
Dagre respects modules but:
- columns are not semantically exact;
- Heading-to-neighbor alignment is poor;
- folder coherence is weak;
- module Y order causes avoidable crossings;
- minor post-layout packing is needed.
```

Do not use C to conceal fundamental Dagre failure.

C starts from the stronger viable pure-Dagre strategy, preferably A unless B clearly wins.

Allowed post-pass responsibilities:

## Exact signed-rank columns

Compute width-aware column centers:

```text
root rank 0 centered at x = 0

rank +1
= root half-width
+ gap
+ rank-1 half-width

rank +2
= previous rank half-width
+ gap
+ next rank half-width
...

mirror for negative ranks
```

This guarantees semantic left/right/hop columns.

## Preferred vertical positions

Use a weighted desired Y from:

```text
precise Heading/Block endpoint alignment        strong
selected parent module alignment                strong
Dagre macro Y                                   medium
same-folder neighborhood/band preference        soft
previous-layout Y, only in stability experiment soft
```

## Fixed-sweep packing

Within each signed rank:

1. sort by desired Y;
2. pack variable-height module rectangles with clearance;
3. sweep outward from root;
4. sweep back toward root;
5. repeat a small fixed number of times;
6. stop deterministically.

Constraints:

```text
root fixed
signed rank fixed
no overlap
no random search
no simulated annealing
no physics
no iterative convergence without a hard bound
```

This is not a custom general graph-layout engine.

Document strategy-specific code size/complexity.

If C grows into reimplementation of Dagre ranking/crossing/coordinates, stop and report `NO_DAGRE_STRATEGY_PASSES`.

---

# 13. Dagre configuration discipline

Do not tune arbitrary constants against every fixture.

## Calibration set

Use HIER1 semantic fixtures:

```text
F1–F10
```

for bounded configuration selection.

## Holdout set

Use:

```text
F11–F18
+
deterministically generated graph corpus
```

only after configuration is frozen.

## Bounded configuration grid

Each strategy may test a small named grid across public Dagre options:

```text
ranker:
  network-simplex
  tight-tree
  longest-path

nodesep / ranksep:
  compact
  normal

align:
  only documented values that materially apply

source-order constraints:
  Off / On when public API support is verified
```

Keep the search bounded—prefer fewer than roughly 12 meaningful configurations per strategy.

Do not auto-optimize hundreds of parameter combinations.

Do not select a different configuration per fixture.

Commit named frozen configurations and report why one was selected.

---

# 14. Source-order experiment inside modules

Markdown sibling order has semantic/readability value.

Compare:

```text
Dagre default ordering
vs
public ordering constraints preserving canonical sibling order
```

Requirements:

- only use documented/public `constraints` or `customOrder`;
- verify behavior against installed 3.1.1;
- no private `rank` / `order` mutation;
- preserving sibling order must not introduce overlap;
- record crossing/area effects.

Select one internal-order policy shared by A/B/C before holdout.

If Dagre constraints are unreliable, keep deterministic input order and report the limitation for HIER3 rather than hacking internals.

---

# 15. Dagre dynamic-layout experiment

Dagre 3.1.1 exposes:

```text
useDynamic
corePath
```

and retains prior state per input graph instance.

Current production W3 is stateless and constructs fresh layout inputs.

Treat dynamic mode as a separate architecture experiment, not a hidden default.

## Cold baseline

For all primary A/B/C comparison runs:

```text
fresh graph
useDynamic = false
```

This gives deterministic stateless evidence.

## Dynamic experiment

After identifying the best one or two cold strategies:

1. retain the same Dagre graph instance across controlled revisions;
2. run with `useDynamic = true`;
3. test `corePath` only after verifying installed semantics;
4. compare stability metrics;
5. measure memory and mutation complexity;
6. verify stale/removed nodes are not retained;
7. verify repeatability for an identical revision sequence.

Record:

```text
stability benefit
runtime effect
history dependence
worker-state requirement
recovery/reset behavior
```

Do not change the production W3 worker in HIER2.

A dynamic result cannot be selected without explicitly stating that HIER3 would need:

```text
stateful layout-worker ownership
or
serializable previous-order state
```

Prefer the stateless strategy when dynamic benefit is small.

---

# 16. Routing experiment

HIER1 leaves explicit routing as a HIER2 decision.

Do not build a full obstacle router here.

Evaluate:

## Native macro Dagre points

For A:

```text
selected backbone module-edge points
```

For B:

```text
compound cross-cluster edge points
```

Measure:

```text
route coverage
focus-path crossings
edge-node intersections
route determinism
route stability
ability to map points to semantic relationship IDs
```

## Fairness rule

Do not compare:

```text
A with 10% route coverage
to
B with 100% route coverage
```

as if crossing counts were equivalent.

Primary strategy comparison should use:

```text
HIER1 approximate module-center crossings
```

unless every strategy supplies the same complete relationship route set.

## Decision options

HIER2 should conclude one of:

```text
USE_DAGRE_BACKBONE_POINTS_IN_HIER3

USE_SHARED_SIMPLE_MODULE_BOUNDARY_ROUTING_IN_HIER3

DEFER_EXPLICIT_ROUTING_TO_HIER5
```

If native points are incomplete or intersect modules, prefer deferral over forcing them into production.

Secondary relationships are not layout edges. Native Dagre cannot be assumed to route them.

---

# 17. Filtered-module visual decision

The visual lab must show the two filtered policies on:

```text
F14
at least one multi-hop generated graph
```

Evaluate:

```text
Can the user tell a path continues through filtered context?
Does the placeholder undermine the meaning of the active query?
Does it consume disproportionate space?
Can it have an accessible explanation later?
```

Final HIER2 decision:

```text
FILTERED_COMPACT_BRIDGE
or
FILTERED_CONTEXT_CARD
or
UNRESOLVED — blocks HIER3
```

Do not expose private filtered File names in an anonymous bridge preview.

---

# 18. Strategy result contract

Create a deterministic plain result wrapper around the HIER1 candidate:

```ts
type FocusSchematicBakeoffAttempt =
  | {
      status: 'success';
      strategyId: string;
      configId: string;
      candidate: FocusSchematicLayoutCandidate;
      quality: FocusSchematicLayoutQuality;
      timings: ...;
      routeCoverage: ...;
      warnings: readonly string[];
    }
  | {
      status: 'unsupported' | 'failure' | 'timeout';
      strategyId: string;
      configId: string;
      reason: string;
      timings: ...;
    };
```

Requirements:

- candidate is independently validated before quality evaluation;
- no success-shaped incomplete candidate;
- failures/timeouts are evidence, not benchmark-process crashes;
- deterministic serialized ordering;
- no raw private data in aggregate report output;
- strategy/config IDs are stable and descriptive.

---

# 19. Hard correctness gates

A strategy/config is eligible only when it passes every required holdout scenario with:

```text
candidate validation success
missingModuleIds = []
missingVisibleNodeIds = []
unexpectedModuleIds = []
unexpectedNodeIds = []
nonFiniteGeometryCount = 0

moduleOverlapPairs = []
nodeOverlapPairs = []
nodeOutsideModuleIds = []

leftSideViolationModuleIds = []
rightSideViolationModuleIds = []
rankOrderViolationModuleIds = []

root center approximately (0, 0)
all planned modules represented
all internal visible nodes represented
deterministic cold output
```

Use a nonzero layout clearance consistent with HIER0 card outlines.

Equal-mutual modules are judged against their HIER2 resolved plan, not the unresolved HIER1 allowed-side list alone. Add a plan-aware gate if the existing evaluator cannot express that.

One fixture-specific failure makes the configuration ineligible unless the fixture itself violates a documented supported precondition.

Do not average hard failures away.

---

# 20. Soft comparison metrics

For eligible configurations, report raw and normalized metrics.

Priority order:

## A. Focus-path readability

```text
approximate crossing count
route-aware crossing count when complete
edge-node intersections
Heading/Block alignment mean and p95
```

## B. Stability

```text
root displacement
root-relative median/p95 shared-module displacement
unaffected-module displacement
```

## C. Compactness

```text
bounds width/height/area
empty-area ratio
aspect ratio
```

## D. Folder coherence

```text
same-folder adjacency ratio
mean same-folder vertical distance
root-folder center offset
rank-aware folder coherence if added
```

## E. Performance

```text
internal layouts
macro layout
post-pass
validation/quality
serialization
total
```

## F. Maintainability

```text
strategy-specific code size
number of synthetic layout-only nodes
public API surface
stateful vs stateless
Dagre public-API reliance
special-case count
worker compatibility
failure recovery complexity
```

Do not collapse all of this into one opaque score.

Use a decision matrix and Pareto reasoning.

---

# 21. Material-improvement rule for Strategy C

C is justified only if it materially improves the best pure Dagre strategy on holdout.

A reasonable evidence threshold:

```text
clear reduction in crossings and/or alignment error
and/or elimination of semantic rank drift
and/or meaningful folder-coherence improvement
```

without:

```text
new hard failures
substantial stability regression
substantial area inflation
substantial runtime regression
large fragile code surface
```

Report per-fixture wins/losses, not only aggregate average.

Do not mechanically enforce one arbitrary percentage if the visual evidence contradicts it, but state what counted as material and why.

---

# 22. Stability revision corpus

For each viable cold strategy, compare controlled before/after layouts.

At minimum:

## S1 — root depth

```text
Files only
→ depth 1
→ depth 2
→ depth 3
```

## S2 — neighbor disclosure

```text
collapsed neighboring File
→ expanded Headings/Blocks
→ collapsed
```

## S3 — add/remove one same-rank File

Unrelated modules should not completely reshuffle.

## S4 — secondary edge only

Because secondary links do not affect layout:

```text
positions should remain byte-identical
```

## S5 — filtered intermediary

Visible/filter state changes while the fixed document neighborhood remains.

## S6 — equal-mutual module added

Measure side/load effects.

## S7 — source edit with stable IDs

Heading text/offset change that preserves identity.

## S8 — folder move

Folder key changes while IDs survive.

## S9 — reference direction change

Side/rank is allowed to change; unrelated modules should remain reasonably stable.

## S10 — diagnostic-only change

If diagnostics are only reserved by count, record the intended movement boundary.

Use:

```text
compareFocusSchematicLayouts(...)
```

and explicit unaffected-module sets.

---

# 23. Deterministic generated holdout corpus

In addition to F1–F18, generate a private-safe seeded corpus.

Suggested:

```text
20–40 small/medium models
fixed RNG seeds
1–3 hops
incoming/outgoing/both
cycles
equal/unequal mutuals
multiple folders
Heading endpoints
filtered intermediates
secondary edges
```

Requirements:

- deterministic;
- valid HIER1 models;
- not used for parameter tuning;
- no private names;
- failures reproducible by seed;
- report worst-case seeds.

Do not use random tests whose seed is lost on failure.

---

# 24. Current-flat baseline comparison

For supported fixtures, include D0 in the same visual and metric report.

Do not require D0 to pass module hard gates.

Report expected weaknesses honestly:

```text
interleaved module bounds
semantic side/rank drift
poorer Heading alignment
larger instability
```

Do not modify D0 to make it look worse.

The purpose is to show whether the modular strategies produce a real improvement over current production, not only which new strategy wins.

---

# 25. Performance harness

Add root commands such as:

```bash
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability
```

Exact naming may follow current diagnostics conventions.

## Phases

Measure separately:

```text
semantic model already prepared
dimension-input construction
equal-mutual/backbone planning
internal File layouts
macro layout
semantic post-pass
candidate validation
quality evaluation
serialization
total
```

## Repetitions

Suggested:

```text
fixtures / small: 7 measured samples
medium: 3
hub: 1–3 depending safety
```

Warm up explicitly.

## Timeouts

Compound or pathological layouts must not hang the task.

Run heavy strategy/profile attempts in:

```text
worker thread
or
child process
```

with a hard timeout and cleanup.

A timeout should produce:

```text
status = timeout
```

and allow the remaining bake-off to finish.

Do not place wall-clock thresholds in ordinary unit tests.

---

# 26. Performance interpretation

Use current product budgets as guidance, not CI gates.

Preferred layout-only evidence:

```text
ordinary/small Focus
→ Class B target
→ p95 around or below 250 ms

medium hub-like Focus
→ should remain tractable off-main-thread

1,000-module pathological hub
→ evidence/stress
→ not an ordinary product promise
```

Also report:

```text
main-thread work that HIER3 would retain
worker structured-clone size
candidate output size
peak memory where practical
```

A strategy that is visually strongest but requires seconds for ordinary small Focus is not adoptable.

A strategy that is slightly slower but remains well inside the worker budget may still win on readability.

---

# 27. Visual comparison lab

Create a development-only self-contained visual lab.

Preferred command:

```bash
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab
```

Output:

```text
output/hier2-layout-lab/index.html
```

The output directory must remain gitignored.

A static generated HTML/SVG lab is preferred over adding another production app.

No new dependency is required.

## Lab features

Allow choosing:

```text
fixture
revision
strategy
configuration
filtered-module policy
routes / approximate edges
module bounds on/off
folder indicators on/off
secondary links on/off for display only
```

Display side-by-side where practical:

```text
D0 current flat
A two-stage
B compound
C conditional post-pass
```

Each panel should show:

```text
focused root
left/right/rank guides
module bounds
File/Heading/Block rectangles
folder identity using synthetic fixture labels
filtered placeholder
Focus-path relationships
secondary relationships with distinct style
selected backbone
warnings / unsupported / timeout
key metrics
```

This is a technical layout lab, not final product styling.

Use simple SVG:

- no React Flow requirement;
- no Sigma;
- no network access;
- no private data;
- works from a local static server;
- deterministic generated geometry.

---

# 28. Visual QA gate

After automated evidence and a preliminary recommendation:

1. generate the lab;
2. open the representative synthetic fixtures;
3. inspect it in a production browser;
4. give the user the command/path and concise recommended strategy;
5. wait for user graphical review before final adoption/merge.

Required user-review fixtures:

```text
F4 mixed two-sided
F5 multi-hop
F7 equal mutual
F9 Heading-specific references
F11 folders
F13 diagnostics/reserve
F14 filtered intermediary
hub/fan sample
at least two stability before/after pairs
```

User review should assess:

```text
Does left/center/right read naturally?
Do File modules feel coherent?
Do Headings explain connections?
Are folders helpful rather than dominant?
Does a filtered bridge make sense?
Does expansion feel stable?
Is the graph too wide/tall?
```

Do not claim production UI approval. The lab is only choosing a layout strategy.

---

# 29. Routing visual evidence

The lab should distinguish:

```text
approximate center-to-center edge
native Dagre route
selected backbone
other Focus-path edge
secondary edge
```

Never label an approximate route as final routing.

If native route coverage is partial, show coverage clearly.

Do not let secondary-edge display change any module/node coordinates.

---

# 30. Decision protocol

After frozen holdout, performance, stability, and user visual review, create:

```text
docs/HIER2_LAYOUT_BAKEOFF.md
```

Required sections:

1. question and accepted spatial semantics;
2. exact baseline/version;
3. common layout plan and filtered policy;
4. D0 current baseline;
5. Strategy A;
6. Strategy B;
7. conditional Strategy C;
8. Dagre configuration calibration;
9. cold determinism;
10. dynamic-layout experiment;
11. routing experiment;
12. fixture hard-gate table;
13. generated-corpus table;
14. visual-review findings;
15. performance table;
16. stability table;
17. maintainability/worker table;
18. decision;
19. rejected alternatives;
20. HIER3 or HIER2B handoff.

Do not cherry-pick only favorable fixtures.

Include failures and timeouts.

---

# 31. Selection preference

When evidence is otherwise close, prefer:

```text
stateless
simpler
public Dagre API only
fewer synthetic helper nodes
clearer failure behavior
easier worker serialization
easier deterministic testing
```

Expected prior—not a forced outcome:

```text
two-stage Dagre
```

is likely easier to control than compound Dagre because internal File hierarchy and macro File placement have different priorities.

The bake-off must still test B honestly.

C should win only if its bounded post-pass gives a visible/metric improvement worth its complexity.

---

# 32. No-adoption threshold

Return:

```text
NO_DAGRE_STRATEGY_PASSES
```

when all Dagre-first strategies require one or more of:

```text
private Dagre internals
fixture-specific hacks
persistent hard-gate failures
uncontrollable cluster overlap
unacceptable ordinary latency
unacceptable visual instability
a post-pass that effectively rewrites the layout engine
```

If that happens, do not implement a custom macro placer in HIER2.

The next user-reviewed plan becomes:

```text
HIER2B — fixed-rank bounded custom macro placer
```

Internal File trees may still retain Dagre.

---

# 33. Selected implementation retention

If A, B, or C is adopted:

- retain one clean selected strategy implementation behind a narrow package API;
- keep it absent from production imports during HIER2;
- retain shared input/planning validation;
- move rejected experimental strategies to the development-only bake-off tool or delete them after preserving reproducible evidence;
- do not export three permanent **new** production strategies;
- keep the lab capable of reproducing the recorded comparison where practical.

Separately, preserve the current production D0 path as the future:

```text
Classic Focus Hierarchy
```

D0 is not one of the competing new strategies and must not be deleted merely because A/B/C wins.

The HIER3 handoff must require two distinct production layout strategies:

```text
modular
→ selected HIER2 strategy
→ normal Focus-Hierarchy layout

classic
→ preserved current HIER0 flat Dagre strategy
→ hidden by default
→ enabled through Settings → Graph → Experimental
```

Shared renderer/UI code may be factored, but strategy-specific mapping/layout/fingerprint/fallback behavior must remain independently testable.

Preferred selected API:

```ts
computeFocusSchematicLayout(
  input,
): FocusSchematicLayoutCandidate
```

If dynamic state is selected, use a distinct explicit session API rather than hiding state in a pure-looking function.

HIER3 should not need to scrape the benchmark tool to adopt the winner.

---

# 34. Worker-architecture handoff

The decision document must state whether the selected strategy is:

```text
stateless
or
stateful/dynamic
```

and the recommended HIER3 worker boundary:

```text
model + dimensions + layout settings
→ layout worker
→ validated candidate
```

Estimate:

```text
input size
output size
structured-clone cost
cancellation behavior
latest-result-wins compatibility
cache key
failure fallback
```

Do not change W3 in HIER2.

---

# 35. HIER1 harness corrections

Only change HIER1 contracts when prototype use proves a concrete problem.

Potential legitimate additions:

```text
plan-aware equal-mutual side/rank evaluator
route-coverage metadata in the bake-off wrapper
rank-aware folder metric
faster overlap oracle preserving exact results
```

Avoid changing:

```text
semantic model meaning
module membership
reference provenance
distance equations
candidate schema
```

without strong evidence.

Any correction requires:

- regression test;
- compatibility explanation;
- HIER1 validation note update;
- no production import.

---

# 36. HIER0 and production regression

HIER2 must leave current product behavior untouched:

```text
All + Hierarchy remains experimental
Focus + Hierarchy uses current HIER0 renderer
current Focus Hierarchy is not deleted, rewritten in place, or hidden yet
D0/Classic preservation baseline is documented and reproducible
HIER0 collision guarantees remain
Network behavior remains
Network Explorer remains
QUERY1 remains
Visual Groups remain
SPATIAL1A remains
presentation overrides remain
view-state schemas remain
```

Run current browser smoke:

```text
Synthetic Sample
All Network
Focus Network
Focus Hierarchy
Hierarchy depth
Search/Inspector
```

No visual change is expected.

Native graphical QA is not required for a non-production tool, but desktop check and release build must pass.

---

# 37. Privacy

Committed fixtures/lab source must be synthetic.

Generated lab output is ignored.

Optional private-vault evidence:

- aggregate metrics only;
- no paths, titles, folders, raw targets, topology, screenshots, candidate JSON, or SVG committed;
- local generated private lab must stay ignored and be deleted or retained only at the user's direction.

Do not upload anything.

---

# 38. Documentation / ADR

Add:

```text
docs/HIER2_LAYOUT_BAKEOFF.md
docs/HIER2_VALIDATION.md
```

Add one decision ADR after user review, likely:

```text
docs/decisions/0018-focus-schematic-layout-strategy.md
```

ADR must record:

```text
selected outcome
why
Dagre version
stateless/dynamic decision
filtered intermediary decision
equal-mutual resolver
routing decision
rejected strategies
mandatory preservation of the current layout as Classic Focus Hierarchy
future Experimental setting/access path for Classic
remaining HIER3 work
```

Do not claim production adoption.

Update:

```text
packages/focus-schematic/README.md
selected layout package README
tools/vault-diagnostics/README.md or bake-off tool README
docs/ARCHITECTURE.md
docs/ROADMAP.md
root/package maps
```

Archive this exact prompt under:

```text
history-implementations/HIER2_dagre_first_focus_schematic_layout_bakeoff_codex_prompt.md
```

---

# 39. Roadmap update

After accepted decision and merge:

## If a Dagre strategy is selected

```text
HIER0 — Complete
HIER1 — Complete
HIER2 — Complete: <selected strategy>
HIER3 — integrate modular Focus Hierarchy while preserving Classic behind Experimental — Next
```

## If none passes

```text
HIER0 — Complete
HIER1 — Complete
HIER2 — Complete: no Dagre strategy adopted
HIER2B — bounded custom macro-layout investigation — Next
```

Do not mark HIER3 complete.

Do not reorder KG14 or SPATIAL1.

---

# Suggested implementation sequence

## Phase 1 — inspect and establish common input

1. Sync latest `main`.
2. Inspect open PRs/worktrees.
3. Re-read HIER0/HIER1 implementation and validation.
4. Inspect installed Dagre 3.1.1 source/types.
5. Add development-only layout input/dimension contracts.
6. Add strict input validation.
7. Add shared module padding/diagnostic reserve.
8. Add shared equal-mutual layout planning.
9. Add shared selected backbone.
10. Evaluate and freeze filtered-module policy.

## Phase 2 — current baseline and pure Dagre

11. Implement D0 current flat adapter.
12. Implement Strategy A internal module Dagre.
13. Implement Strategy A macro Dagre.
14. Validate/measure A.
15. Implement Strategy B compound graph using public APIs.
16. Validate/measure B.
17. Run calibration configurations.
18. Freeze A/B configs before holdout.

## Phase 3 — conditional refinement

19. Run F1–F18 + generated holdout for A/B.
20. Inspect hard failures and visual weaknesses.
21. Implement C only if bounded post-processing is justified.
22. Freeze C config.
23. Re-run full holdout without further tuning.
24. Test source-order constraints.
25. Test cold determinism and permutations.

## Phase 4 — stability, dynamic and routing

26. Run S1–S10 stability corpus.
27. Test Dagre dynamic mode on top viable strategies only.
28. Record stateless/stateful architecture implications.
29. Evaluate native Dagre routing coverage/quality.
30. Decide route policy without building a full custom router.

## Phase 5 — performance and visual lab

31. Add isolated timeout-safe benchmark runner.
32. Run fixtures/small/medium/hub.
33. Generate self-contained visual lab.
34. Browser-QA lab controls and output.
35. Produce preliminary decision matrix.
36. Present lab and recommendation to user.
37. Wait for user graphical review.

## Phase 6 — decision and cleanup

38. Apply only evidence-backed final naming/config cleanup.
39. Retain selected strategy through a narrow non-production API.
40. Keep rejected code development-only or remove it while preserving evidence.
41. Write HIER2 bake-off/validation docs.
42. Add ADR 0018.
43. Update architecture/roadmap/maps.
44. Archive this prompt exactly.
45. Run full validation.
46. Integrate latest `main` if needed.
47. PR → CI → merge after user acceptance.
48. Verify post-merge CI.
49. Remove only HIER2 branch/worktree.
50. Stop.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/focus-schematic typecheck
pnpm exec vitest run packages/focus-schematic

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm benchmark:focus-schematic -- --profile small
pnpm benchmark:focus-schematic -- --profile medium
pnpm benchmark:focus-schematic -- --profile hub

pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm benchmark:focus-schematic-layout -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile hub
pnpm benchmark:focus-schematic-layout -- --profile stability

pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab

pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:performance -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Adapt package names only if final organization differs.

No new CI timing threshold.

Heavy hub runs need not execute in ordinary CI; add a fast deterministic smoke there.

---

# Required automated scenarios

## Shared planning

```text
non-mutual side/rank unchanged from HIER1
equal-mutual stronger left candidate
equal-mutual stronger right candidate
equal candidate → rank-load balance
final exact tie deterministic
one parent per non-root module
parent one rank nearer root
acyclic backbone
input permutation invariance
```

## Filtered policy

```text
filtered intermediary retained
no private title needed
positive module geometry
path/backbone continuous
visual policy distinguishable in lab
```

## Strategy A

```text
one-node module
nested Heading tree
Block
many siblings
multi-module incoming
multi-module outgoing
two-sided
multi-hop
equal mutual
filtered intermediary
node containment
module containment
zero overlap
```

## Strategy B

Same semantic scenarios, plus:

```text
compound parent ownership
nested cluster direction
cross-cluster precise edge
filtered synthetic anchor
cluster bounds completeness
no private/transient Dagre field dependence
```

## Strategy C if built

```text
exact signed columns
root fixed
Heading alignment improves
folder coherence improves
packing remains collision-free
fixed iteration count
input permutation invariance
```

## Dynamic

```text
same graph unchanged
depth expansion
neighbor expansion
add/remove module
secondary-only change
stale node removal
reset/fresh-session equivalence
```

## Routes

```text
relationship ID mapping
coverage
finite points
determinism
module intersection
crossing counts
partial coverage not compared unfairly
```

## Quality

```text
all HIER1 hard gates
plan-aware mutual side
clearance
holdout corpus
worst-case seed reproduction
```

---

# Exit gate

HIER2 is complete only when:

1. current main/HIER1 baseline is verified.
2. installed Dagre 3.1.1 is inspected directly.
3. Dagre is not upgraded.
4. no new external layout library is added.
5. no Dagre fork/patch/private-internal dependency is introduced.
6. one common validated layout input exists.
7. current Focus card dimensions feed the bake-off explicitly.
8. one common module padding policy exists.
9. diagnostics are accounted through a common reserve without false production claims.
10. filtered-intermediate policies are compared.
11. one filtered policy is selected or explicitly blocks HIER3.
12. equal-mutual planning is deterministic.
13. equal-mutual uncertainty remains separate from HIER1 semantics.
14. every planned non-root module receives one parent.
15. the shared macro backbone is acyclic and distance-monotonic.
16. secondary relationships do not affect layout.
17. D0 current flat baseline is measured honestly.
18. Strategy A is implemented.
19. A lays out internal modules from hierarchy only.
20. A lays out modules from the shared backbone only.
21. Strategy B is implemented through public compound APIs.
22. B uses per-cluster direction only where supported.
23. B failures/unsupported cases are reported, not patched invisibly.
24. A/B use the same semantic plan and dimensions.
25. configuration search is bounded.
26. calibration and holdout are separated.
27. frozen configs do not vary by fixture.
28. Strategy C is built only when evidence justifies it.
29. C remains a bounded post-pass, not a general layout rewrite.
30. all candidate successes pass strict HIER1 validation.
31. hard failures are never averaged away.
32. module overlap is zero for eligible strategies.
33. node overlap is zero for eligible strategies.
34. node containment passes.
35. side/rank semantics pass.
36. root is normalized.
37. cold output is deterministic.
38. projection/model input permutations do not alter cold output.
39. F1–F18 are evaluated.
40. deterministic generated holdout corpus is evaluated.
41. worst-case seeds are recorded.
42. S1–S10 stability corpus is evaluated.
43. dynamic Dagre is tested only on top viable strategies.
44. dynamic state requirements are documented.
45. production W3 is not changed.
46. native Dagre route coverage is measured.
47. routing decision is explicit.
48. incomplete route coverage is not scored as complete.
49. small performance profile completes.
50. medium performance profile completes.
51. hub profile completes or records safe timeout.
52. heavy attempts cannot hang the entire command.
53. phase timings are separate.
54. memory/serialization evidence is reported where practical.
55. a self-contained visual lab is generated.
56. generated lab output is gitignored.
57. lab uses synthetic data only.
58. lab displays D0/A/B/C status truthfully.
59. lab shows modules/nodes/sides/ranks/folders/filtered state.
60. user reviews representative visual fixtures.
61. user review is recorded accurately.
62. one strategy decision outcome is explicit.
63. the decision uses raw metrics and tradeoffs, not an opaque score.
64. maintainability/worker compatibility is considered.
65. selected strategy is retained behind a narrow non-production API.
66. rejected new strategies are not exported as permanent product choices.
67. D0 is retained as the explicit Classic Focus Hierarchy preservation baseline.
68. the HIER3 handoff forbids replacing the current layout algorithm in place.
69. the HIER3 handoff requires a separate `Classic Focus Hierarchy` strategy.
70. the HIER3 handoff requires Classic to be hidden by default after modular adoption.
71. the HIER3 handoff requires Settings → Graph → Experimental access for Classic.
72. the future Classic option must remain testable rather than dead code.
73. no production renderer imports the selected/prototype package during HIER2.
74. production Focus Hierarchy remains unchanged during HIER2.
75. HIER0 collision guarantees remain green.
76. All + Hierarchy remains experimental.
77. Network behavior remains unchanged.
78. SPATIAL1 remains unchanged.
79. QUERY1/Saved Filters/Visual Groups remain unchanged.
80. view-state/persistence schemas remain unchanged.
81. committed evidence contains no private vault information.
82. HIER2 bake-off document exists.
83. HIER2 validation document exists.
84. ADR 0018 records the accepted/no-adoption decision and Classic-preservation requirement.
85. roadmap names the correct next step.
86. exact prompt is archived.
87. focused tests pass.
88. full `pnpm check` passes.
89. desktop check/build pass.
90. browser lab QA passes.
91. ordinary product browser smoke passes.
92. PR CI passes.
93. post-merge CI passes.
94. unrelated user work remains untouched.
95. HIER2 task branch/worktree cleanup completes.
96. HIER3/HIER2B is not started automatically.

---

# Final report

## 1. Summary

State the selected outcome:

```text
ADOPT_TWO_STAGE_DAGRE
ADOPT_COMPOUND_DAGRE
ADOPT_TWO_STAGE_DAGRE_WITH_BOUNDED_SEMANTIC_POSTPASS
NO_DAGRE_STRATEGY_PASSES
```

## 2. Baseline

Current flat production behavior and Dagre 3.1.1 evidence.

## 3. Shared layout plan

Equal mutual, filtered policy, dimensions and backbone.

## 4. Strategy D0

Metrics and limitations.

## 5. Strategy A

Architecture, configuration, quality, stability and runtime.

## 6. Strategy B

Compound behavior, configuration, quality, failures and runtime.

## 7. Strategy C

Whether it was justified, bounded behavior, improvement and complexity.

## 8. Calibration and holdout

Frozen configs and anti-overfitting evidence.

## 9. Quality comparison

Hard gates and raw soft metrics.

## 10. Stability

S1–S10 results.

## 11. Dagre dynamic mode

Benefit, cost and worker-state implication.

## 12. Routing decision

Native points, coverage/intersections and HIER3/HIER5 recommendation.

## 13. Visual review

Fixtures inspected and user feedback.

## 14. Performance

Phase timings, timeout behavior, memory/serialization evidence.

## 15. Architecture / maintainability

Public API reliance, code complexity, stateless/stateful compatibility.

## 16. Selected implementation boundary

What code remains reusable and what remains development-only.

## 17. Classic Focus Hierarchy preservation

Confirm that:

```text
the current HIER0 layout remains intact during HIER2
D0 is recorded as the Classic preservation baseline
HIER3 must introduce the modular layout through a separate strategy
Classic must later be hidden by default behind Settings → Graph → Experimental
```

Explain which visual/interaction/layout behaviors are covered by preservation regressions.

## 18. Production compatibility

Confirm current app/renderer behavior did not change.

## 19. Privacy

Aggregate/synthetic evidence only.

## 20. Tests / builds / CI

## 21. Files changed

## 22. Dependencies

Expected new external packages:

```text
zero
```

## 23. ADR / roadmap

## 24. Follow-up

Either:

```text
HIER2 complete
HIER3 — integrate modular Focus Hierarchy and preserve Classic Focus Hierarchy behind Experimental — next
```

or:

```text
HIER2 complete with no Dagre adoption
HIER2B — bounded custom macro-layout investigation — next
```

Do not implement the next step automatically.
