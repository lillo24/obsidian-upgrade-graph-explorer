# KG13A — High-Density Global Graph Renderer Decision Spike

**Task type:** renderer evaluation / product-mode design / benchmark-gated technology decision

## Why KG13 is split

KG13 is explicitly a **decision / renderer** milestone, not a mandate to add another renderer.

Split it into:

```text
KG13A
→ define the actual high-density/global-view product use case
→ prototype the strongest candidate renderer in isolation
→ benchmark rendering, interaction, layout, accessibility, bundle, and Tauri behavior
→ decide whether a second renderer adds enough product value

KG13B
→ only if KG13A passes the adoption gate:
   integrate a separate Global graph mode into the product
```

Do not begin KG13B automatically.

If KG13A concludes that a second renderer is not justified, KG13 may finish with a documented **no-adoption** decision and KG14 becomes next.

---

# External context

This plan relies on current external library evidence in addition to the repository.

At prompt-writing time:

```text
sigma                    3.0.3 stable, MIT
graphology               0.26.0, MIT
@react-sigma/core        5.0.6, MIT
graphology-layout-forceatlas2 0.10.1, MIT
```

Current Sigma documentation states that stable Sigma v3 is a WebGL graph renderer intended for thousands of nodes/edges and is built on Graphology. Sigma v4 exists only as an alpha line.

Official references:

- https://www.sigmajs.org/docs/
- https://www.sigmajs.org/docs/advanced/data/
- https://www.sigmajs.org/docs/advanced/events/
- https://github.com/jacomyal/sigma.js
- https://graphology.github.io/
- https://graphology.github.io/standard-library/layout-forceatlas2.html
- https://sim51.github.io/react-sigma/

Alternative-renderer context:

- PixiJS v8 is a general GPU 2D renderer, not a graph renderer.
- Cytoscape.js currently still documents its WebGL mode as experimental/provisional.
- Sigma v4 is alpha.

Codex must verify the current compatible versions/licences/docs before adding anything.

If Codex has no web access, use package metadata/current installed npm information where possible. If the stability/license/API status cannot be verified, stop and report rather than guessing.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

KG12B2 merged through PR #27 at:

`6ca58c44bce28cd0e03439e4eb1f6cffca7e7767`

Current roadmap:

```text
KG12 — Complete
KG13 — Global graph decision / renderer — Next
```

The repository explicitly states:

> KG13 must treat the remaining Dagre wall-time/structural-scale cliff separately from main-thread responsiveness and must not replace the structural renderer without product evidence.

Current structural renderer:

```text
KG6 ViewProjection
→ React Flow mapping
→ W3 Dagre worker
→ React Flow structural graph
```

It is now responsive while Dagre runs, but layout completion remains expensive at larger structural projections.

KG12 evidence:

```text
small fully expanded:
  projected 1,700 nodes / 2,000 edges
  W3 topology 900 / 1,200
  Dagre ~1.6 s

medium bounded:
  projected 6,640 / 7,182
  W3 topology 1,598 / 2,140
  Dagre ~3.8 s
```

W3 reduced main-thread layout gaps to roughly the Class A boundary, but it did not remove the wall-time cliff.

Current product budgets:

```text
Class A direct feedback:
  median 16 ms
  p95 32 ms

Class B derived view:
  median 100 ms
  p95 250 ms

Class C workspace transaction:
  median 1,000 ms
  p95 2,500 ms
```

The current React Flow structural renderer remains the authoritative hierarchical renderer. KG13 must not replace it merely because a WebGL option exists.

---

# Required first inspection

Before editing:

1. sync latest `main`;
2. verify clean worktree;
3. read:
   - `AGENTS.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/PERFORMANCE.md`;
   - `docs/ROADMAP.md`;
   - ADR 0011 and ADR 0012;
   - `packages/view-projection/README.md`;
   - `packages/renderer-reactflow/README.md`;
   - `packages/renderer-reactflow/src/types.ts`;
   - `packages/explorer-inspection/README.md`;
   - current web GraphExplorer / graph-state / navigation code;
   - current performance benchmark tooling;
4. inspect current package versions/licenses from official/current package metadata;
5. inspect any currently open UX PRs touching graph mode/navigation;
6. preserve final merged UX behavior;
7. follow repository branch/PR/merge/cleanup rules.

If the latest repository now contains a global-mode design that materially conflicts with this prompt, preserve the repository evidence and report the discrepancy.

---

# Product question before technology question

KG13A must answer:

> What useful task would a separate global renderer perform that the structural React Flow renderer should not perform?

Do not benchmark a WebGL library merely because it can draw more nodes.

The proposed product hypothesis to test is:

```text
Structural mode
  → hierarchical local understanding
  → files + expanded headings/blocks
  → precise provenance / disclosure / focus

Global mode
  → high-density network overview
  → primarily files/documents
  → see clusters, hubs, isolated areas, cross-folder relationships
  → fast pan/zoom/search/select/focus at thousands of visible items
  → selecting something can hand off to Structural mode for exact hierarchy
```

KG13A must validate or reject this framing.

Do not design Global mode as a second copy of every Structural feature.

---

# Initial Global-mode scope for the spike

The primary product candidate should use:

```text
KG6 documents-only projection
```

or the current closest equivalent.

This gives:

- stable projected file/document entities;
- rolled-up/aggregated references;
- current resolution-state semantics;
- existing focus/filter policy where applicable;
- renderer independence.

Do not bypass KG6 and build a second canonical graph policy in Graphology.

Graphology, if used, is a **derived renderer index only**.

No canonical schema changes.

---

# Optional stress scopes

For renderer capacity evidence, also test:

```text
top-level-section projection
bounded expanded projection
synthetic high-density projection
```

But the initial product Global mode should remain **file-oriented** unless KG13A provides strong evidence that heading-level global rendering is useful rather than cluttered.

Do not make 80,000 visible nodes a product requirement merely because the synthetic large profile contains that many canonical entities.

---

# Candidate shortlist

KG13A should not build three full renderer prototypes.

Use a reasoned shortlist.

## Candidate A — Sigma v3 + Graphology

Primary spike candidate.

Reasons:

- stable v3 line;
- WebGL;
- purpose-built graph renderer;
- intended for thousands of nodes/edges;
- typed node/edge/stage events;
- camera API;
- node/edge reducers for dynamic highlighting;
- Graphology data model;
- MIT;
- current ecosystem already includes worker-capable graph layouts.

Evaluate this candidate concretely.

## Candidate B — PixiJS

Do **not** prototype by default.

Pixi is a high-performance WebGL/WebGPU 2D engine with interaction support, but Icarus would need to implement graph-specific:

- graph data/index lifecycle;
- edge rendering;
- labels;
- picking semantics;
- camera/navigation;
- graph hover-neighborhood behavior;
- likely layout integration.

Treat this as a lower-level fallback only if Sigma fails a hard requirement that Pixi can plausibly solve.

## Candidate C — Cytoscape.js WebGL

Do **not** choose as the primary spike while its WebGL renderer/API remains documented as experimental/provisional.

It may be mentioned in the final comparison.

Only prototype it if current docs show the WebGL path has become stable and materially better aligned than Sigma.

## Sigma v4

Do not use alpha v4 as the production candidate.

KG13A targets the stable Sigma v3 line unless current official status has changed.

---

# Direct Sigma versus React Sigma wrapper

Prefer evaluating **direct Sigma v3**, not `@react-sigma/core`, as the baseline.

Reason:

The Icarus app already owns explicit renderer/session lifecycle and live snapshot updates.

React Sigma documentation notes that changing graph/settings props can recreate the Sigma instance. Direct ownership gives finer control over:

- Graphology updates;
- camera state;
- live projection replacement;
- event registration;
- performance instrumentation;
- teardown.

This is not a permanent rejection of React Sigma; it is the lower-risk spike boundary.

Do not add both wrappers and direct Sigma unless evidence requires it.

---

# Dependency policy

During the spike, expected candidate dependencies are approximately:

```text
sigma
graphology
```

Potential layout-spike dependency:

```text
graphology-layout-forceatlas2
```

Do not add `@react-sigma/core` by default.

Do not add Pixi/Cytoscape unless a documented fallback gate is reached.

If the final decision is **reject Sigma/no second renderer**, remove unused candidate runtime dependencies before the final merge unless the benchmark harness is deliberately retained as development-only evidence and its cost is justified.

---

# Spike architecture

Create a separate candidate boundary, not production renderer integration.

A likely structure:

```text
packages/renderer-sigma-spike/
```

or:

```text
tools/global-renderer-spike/
```

Use whichever keeps experimental code clearly outside stable renderer contracts.

It may depend on:

```text
view-projection
sigma
graphology
performance tooling
```

It must not depend on:

- canonical source adapters;
- Tauri filesystem APIs;
- KG10;
- diagnostics source parsing;
- React Flow;
- W3 Dagre worker;
- Graphology as canonical truth.

The spike consumes an already-produced `ViewProjection`.

---

# Global graph semantics

The spike should preserve the semantics that matter at overview scale:

- one visual node per global projected node;
- aggregated projected references remain aggregated;
- selected node can map back to exact projection/canonical entity;
- hover can emphasize direct neighborhood;
- resolved/unresolved/ambiguous/invalid states remain visually distinguishable;
- filters/focus remain KG6/application-owned;
- search navigation can center a node;
- clicking a document can feed existing Inspector/navigation;
- no source truth is created in renderer state.

Do not attempt Structural-mode heading disclosure inside Sigma in KG13A.

---

# Relationship to Structure mode

The target product design to evaluate is:

```text
Global
  select File A
      ↓
Inspector / search still works

optional future action:
  Open in Structure
      ↓
switch renderer mode
→ reveal File A / selected heading in React Flow
```

KG13A may prototype the handoff concept in a development harness, but should not build final product navigation unless needed to evaluate feasibility.

Do not replace current file/heading cards with Sigma circles in Structural mode.

---

# Visual grammar for the spike

Use a restrained overview grammar.

At minimum:

```text
documents → normal global nodes
diagnostic/unresolved targets → visibly different ghost/status nodes
reference edge weight/count → modest visual weight/opacity
selected → explicit persistent marker
hovered neighborhood → emphasized
unrelated → reduced opacity only during hover
```

Labels should not all render simultaneously at high density.

Use Sigma's label behavior/reducers/settings appropriately.

Do not try to reproduce React Flow cards in WebGL.

---

# Interaction parity gate

The Sigma spike must prove:

## Pan / zoom

- smooth and precise;
- usable with mouse and precision touchpad;
- no conflict with current page/canvas gesture ownership;
- acceptable Tauri behavior.

## Hover

- node hover;
- direct-neighborhood emphasis;
- unrelated fade;
- no full graph rebuild where Sigma reducers can handle it.

## Selection

- click node;
- persistent selected state;
- selection maps back to current projection entity.

## Search / center

Given a projected node ID:

```text
center/zoom to it
```

without rebuilding the graph.

## Focus / filter

These may continue to be implemented by creating a new KG6 projection and updating the derived Graphology graph.

Do not invent renderer-owned focus policy.

## Edge events

Sigma supports edge events, but they can carry a performance cost and are disabled by default.

Benchmark:

```text
edge interaction disabled
vs
edge click/hover enabled
```

Do not require edge hover if it materially harms global-mode performance.

Exact edge provenance can remain accessible through selected-node outgoing/backlink lists if needed.

---

# Accessibility gate

This is a major decision cost.

React Flow structural nodes are DOM-backed and naturally easier to expose to assistive technology than a WebGL graph.

A Global renderer may be adopted only if the app retains an accessible non-canvas path for the same meaningful information.

Evaluate:

- keyboard search → select/center;
- Inspector remains DOM/accessibility-first;
- selected node details remain readable without interpreting WebGL visually;
- a screen-reader user can navigate/search files and relationships through existing UI even if the global canvas itself is primarily visual;
- focus is not trapped in canvas;
- controls have names/status.

Do not claim accessibility parity that Sigma does not provide.

The likely product rule is:

> Global graph is a visual overview, never the sole accessible representation of knowledge.

Document whether this is acceptable for Icarus.

---

# Renderer benchmark must isolate layout

Sigma requires node positions.

Do not conflate:

```text
WebGL rendering performance
with
network layout performance
```

Run two separate evaluations.

## R1 — renderer-only benchmark

Use deterministic precomputed positions.

This measures:

- graph mapping/build;
- Sigma mount;
- first render;
- pan/zoom;
- hover;
- select;
- camera center;
- graph updates;
- labels;
- edge-event overhead.

Use a deterministic position generator in the benchmark only.

The positions do not need to be aesthetically meaningful.

## R2 — meaningful global-layout feasibility

Evaluate one realistic force-directed strategy separately.

Primary candidate:

```text
ForceAtlas2
```

using the current Graphology ecosystem.

The purpose is to determine whether a meaningful file-level overview can reach a usable stable layout at the target graph sizes without blocking direct interaction.

Do not let poor layout wall time incorrectly look like poor Sigma rendering.

---

# ForceAtlas2 spike

If current package verification remains healthy, evaluate:

```text
graphology-layout-forceatlas2
```

on document-only global projections.

It already supports a worker-based mode and Barnes-Hut optimization.

The spike should compare a small set of evidence-backed settings only.

A reasonable starting point:

```text
deterministic initial x/y
barnesHutOptimize: true for larger graphs
inferred/default settings
one modest alternative only if needed
```

Do not turn KG13A into layout-tuning research.

Measure:

- time until first useful layout;
- time until chosen settled/fixed iteration state;
- main-thread responsiveness;
- visual stability;
- live graph update behavior;
- worker/bundle behavior in Tauri.

If ForceAtlas2 proves unsuitable, report that separately from Sigma rendering.

---

# Deterministic initial positions

Do not use uncontrolled `Math.random()` if layout comparison needs repeatability.

Use a deterministic seed/hash from stable projected node IDs for initial positions, or another reproducible layout initializer.

This is benchmark/layout seed state only.

Do not persist it as canonical truth.

---

# Layout persistence question

KG13A must explicitly evaluate, not prematurely implement:

```text
Should global layout coordinates be cached across sessions?
```

Possible future options:

1. recompute per session;
2. keep in-memory only;
3. persist a derived local layout cache keyed to stable workspace + graph revision/fingerprint.

Do **not** add persisted layout coordinates to KG9 view state during the spike.

Manual node positions/pins remain out of scope.

The final decision should say whether recomputation cost is acceptable or whether KG13B needs a separate derived layout cache.

---

# Live snapshot update question

A second renderer must survive KG11 live updates.

Evaluate at least:

```text
one node added
one node removed
reference-only update
filter/focus projection update
```

Do not recreate the entire Sigma instance if Graphology can be updated safely.

Measure:

```text
full graph replacement
vs
incremental Graphology mutation
```

Only implement the smaller path necessary for the spike.

The final report should recommend the KG13B lifecycle.

---

# Stable IDs

Graphology/Sigma node keys should derive from stable projection IDs / stable canonical entity IDs where semantically appropriate.

Do not use:

- array indexes;
- display labels;
- current source offsets.

The renderer must survive ordinary KG9A continuity exactly like React Flow.

Graphology keys remain derived renderer identifiers, not canonical IDs.

---

# Camera / semantic viewport feasibility

Evaluate whether the Global renderer can support a renderer-independent semantic bookmark.

Current React Flow persistence uses:

```text
stable entity anchor + zoom
```

Sigma has its own camera coordinate/ratio model.

Prototype a semantic equivalent:

```text
nearest visible canonical entity to camera center
+
renderer-specific normalized zoom/ratio
```

Do not change KG9 schema in KG13A.

The final report should state:

- whether the existing viewport concept can generalize;
- whether KG13B needs a renderer-mode-specific viewport record;
- whether switching Structure ↔ Global can preserve semantic context around the selected entity.

No raw Sigma camera x/y should become canonical truth.

---

# Product scale targets

Use several scales rather than one headline number.

## Product file-level scale

Use document-only projections from existing synthetic:

```text
small
medium
large
```

Report actual projected nodes/edges after KG6 roll-up.

## Renderer stress scale

Use deterministic projection-derived or generated graphs approximately around:

```text
1k nodes / 2k edges
5k nodes / 10k edges
10k nodes / 20k edges
25k nodes / 50k edges if safe
```

Do not force the largest case if the test environment becomes unsafe.

## Existing structural comparison

Keep React Flow/W3 evidence for:

```text
~1,700 / 2,000
~6,640 / 7,182 bounded
```

Do not compare unlike layout workloads as if the numbers are directly equivalent.

---

# Performance measurements

For R1 renderer-only:

```text
plain input → Graphology build
Sigma instance mount
first render / afterRender
camera pan/zoom RAF gap
hover latency
selection latency
search center latency
1% graph update
10% graph update
edge-events-off
edge-events-on
destroy/recreate
```

Report:

- projected nodes/edges;
- labels shown;
- build mode;
- median/high values;
- main-thread RAF gap;
- approximate memory evidence if safely available;
- bundle chunk size.

Do not add flaky CI timing thresholds.

---

# Comparison against current renderer

The question is not:

```text
Is Sigma faster than Dagre?
```

Dagre is a layout algorithm and Sigma is a renderer.

Compare product responsibilities correctly:

## Structural React Flow mode

Measure/reference:

- hierarchy readability;
- expansion/disclosure;
- exact heading card affordances;
- DOM accessibility;
- wall-time at scale;
- pan/zoom direct responsiveness after W3.

## Global Sigma candidate

Measure:

- high-density render/pan/zoom;
- node selection/hover;
- network overview readability;
- cluster/hub perception;
- labels;
- layout settling cost;
- accessibility tradeoff;
- update lifecycle.

The decision is whether the two modes are **complementary**.

Do not frame them as mutually exclusive unless evidence says so.

---

# Product-value evaluation

Use a simple explicit decision matrix.

Rate:

```text
A. overview usefulness
B. density advantage
C. interaction fit
D. search/Inspector integration
E. live-update fit
F. accessibility cost
G. layout cost/stability
H. implementation complexity
I. bundle/dependency cost
J. Tauri/browser reliability
```

Use:

```text
Strong positive
Positive
Neutral
Negative
Blocking
```

or a similarly explicit scale.

The final renderer decision must cite measured/product evidence for each important item.

---

# Adoption gate

Recommend a separate Global renderer only if all hard gates pass:

1. **Clear product task**
   - users gain a useful overview capability not already served well by Structure/Focus.

2. **Density advantage**
   - meaningful improvement at several-thousand-node/edge scale, not just a microbenchmark win.

3. **Class A interaction**
   - pan/zoom/hover/select remain acceptably responsive at target global scale.

4. **Renderer independence**
   - consumes KG6-derived data without canonical/source changes.

5. **Stable identity**
   - live updates preserve selection/entity mapping using existing stable IDs.

6. **Search/Inspector integration**
   - existing application navigation can select/center/inspect global nodes.

7. **Accessibility fallback**
   - all meaningful data remains reachable through accessible DOM controls/search/Inspector.

8. **Tauri/browser reliability**
   - WebGL/Sigma works in production browser and release Tauri/WebView.

9. **Layout feasibility**
   - a meaningful global layout can be produced with acceptable UX even if computation runs in a worker.

10. **Complexity proportionality**
    - maintaining a second renderer is justified by product value.

If one of 4, 5, 7, or 8 is blocking:

```text
do not adopt
```

Do not rationalize around architectural/privacy/accessibility failures because the GPU benchmark is attractive.

---

# Decision outcomes

KG13A must end in one of three explicit states.

## ADOPT

Evidence supports:

```text
React Flow = Structural
Sigma = Global
```

Then:

```text
KG13 — In progress
KG13A — Complete
KG13B — Next: integrate Global mode
```

## DEFER

Sigma is viable but current Icarus scale/product workflow does not justify the complexity yet.

Then:

```text
KG13 — Complete: defer separate renderer
KG14 — Next
```

Keep the decision and benchmark evidence; do not leave dormant product dependencies unless deliberately development-only.

## REJECT

Candidate fails a hard product/technical gate.

Then:

```text
KG13 — Complete: retain React Flow structural renderer only
KG14 — Next
```

Record what future evidence would justify reopening the decision.

---

# If ADOPT: constrain the KG13B recommendation

KG13B should initially integrate:

```text
Global mode = documents/files overview
```

not arbitrary hierarchy.

Likely product behavior:

```text
Structure | Global
```

Global:

- document-level nodes;
- rolled-up aggregated references;
- filters/focus from existing app;
- hover/select;
- search center;
- Inspector;
- an explicit `Open in Structure` handoff.

Do not implement heading disclosure, block nodes, source editing, analytics, communities, or semantic similarity as part of the first Global mode.

Those are separate future features.

---

# Edge inspection decision

Global mode does not necessarily need full edge-hover parity.

Evaluate:

```text
edge events off
edge click only
edge hover + click
```

Sigma documents edge interaction as optional and potentially more expensive.

If edge events materially reduce high-density responsiveness:

```text
keep them off by default
```

and use selected-node links/backlinks or an explicit later edge-inspection mode.

Do not sacrifice density advantage merely to duplicate every Structural interaction.

---

# Label policy

Measure label density/cost.

Candidate policy:

```text
labels for selected/hovered nodes
+
zoom-dependent/default Sigma label culling
+
no all-label mode at high density
```

Search/Inspector provides exact naming.

---

# GPU / unsupported environment behavior

Test WebGL availability/failure.

Potential product fallback if adopted:

```text
Global unavailable on this device
→ keep Structure mode available
→ explain briefly
```

Do not emulate Global with a huge React Flow fallback.

---

# Tauri / browser validation

Production/release Tauri:

- Sigma/WebGL initialization;
- pan/zoom;
- precision touchpad;
- hover/select;
- search center;
- teardown;
- no CSP/module errors.

Production browser:

- current Chromium;
- resize/device pixel ratio;
- WebGL context create/destroy;
- no console errors.

One non-Chromium smoke is useful if practical but not required.

---

# Accessibility QA

At minimum prove:

- keyboard reaches Global controls;
- search selection can center without mouse-only interaction;
- Inspector receives selected-node information;
- focus is not trapped in canvas;
- unsupported status is announced;
- canvas is not falsely presented as a complete accessible document tree.

---

# Performance benchmark harness

Add a dedicated candidate command such as:

```text
pnpm benchmark:global-renderer
```

Output:

```text
candidate/version
profile
nodes/edges
layout mode
labels
edge events
mount
render
interaction
update
main-thread gap
bundle/build mode
```

No private paths, names, source text, workspace IDs, queries.

CI may validate smoke/schema/mapping correctness, not machine timing.

---

# Real Icarus evidence

If the private Icarus vault is available:

- use aggregate-only document/reference counts;
- generate Global documents-only projection;
- inspect whether overview reveals useful structure;
- measure renderer/layout;
- do not report names/paths/content.

If unavailable, do not substitute another private repository.

---

# No analytics in KG13A

Do not add:

- communities/Louvain;
- centrality;
- PageRank;
- semantic similarity;
- pathfinding;
- folder clustering;
- temporal overlays.

The question is whether the renderer/view adds value using current knowledge semantics.

---

# No production Global mode in KG13A

Do not add the permanent Structure/Global switch yet.

A development-only spike route/harness is acceptable.

Production integration is KG13B only after user review.

---

# Documentation

Add/update:

```text
docs/GLOBAL_RENDERER_DECISION.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/ARCHITECTURE.md
```

Potential spike README under `tools/` or experimental package.

Do not create a stable production renderer-sigma package unless adoption is decided.

---

# Scope

## In scope

- current candidate version/license verification;
- explicit Global-mode product hypothesis;
- stable Sigma v3 spike;
- KG6 → derived Graphology mapping;
- deterministic renderer-only positions;
- render/interaction benchmark;
- hover/select/search-center;
- edge-event comparison;
- labels;
- live update lifecycle;
- semantic viewport feasibility;
- ForceAtlas2 feasibility separately;
- accessibility;
- production browser/Tauri QA;
- bundle/dependency evidence;
- ADOPT/DEFER/REJECT decision;
- docs/roadmap/decision record;
- PR/CI/merge/cleanup.

## Out of scope

Do not implement:

- production Global mode;
- Structure/Global switch;
- React Flow replacement;
- Sigma v4 alpha;
- Pixi custom graph renderer;
- experimental Cytoscape WebGL unless Sigma has a hard blocker and current Cytoscape status changed;
- graph analytics;
- global hierarchy disclosure;
- source editing;
- manual positions;
- persisted layout cache;
- KG14 work.

Do not begin KG13B automatically.

---

# Suggested implementation sequence

1. Verify latest main and candidate versions/licenses.
2. Re-read KG12 limits.
3. Write explicit Global-vs-Structural product hypothesis.
4. Define plain projection-derived candidate input.
5. Add direct Sigma/Graphology development spike.
6. Add deterministic renderer-only positions.
7. Implement hover/select/search-center/status grammar.
8. Benchmark mount/pan/zoom/hover/select/update.
9. Benchmark edge events off/on.
10. Run browser/Tauri production smoke.
11. Evaluate accessibility.
12. Add ForceAtlas2 layout feasibility experiment separately.
13. Evaluate incremental Graphology updates.
14. Evaluate semantic camera bookmark.
15. Compare product value against Structural mode.
16. Complete decision matrix.
17. Decide ADOPT / DEFER / REJECT.
18. Remove unused candidate deps if not adopted.
19. Update docs/performance/roadmap.
20. PR → CI → merge → post-merge CI → cleanup.
21. Stop for user review.

---

# Validation

Use current repo equivalents:

```bash
pnpm install --frozen-lockfile

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium

pnpm benchmark:global-renderer -- --profile smoke
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:global-renderer -- --profile large  # only safe cases

pnpm --filter <global-renderer-spike> typecheck
pnpm exec vitest run <global-renderer-spike-tests>

pnpm --filter @icarus-graph-explorer/web build
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

Also run production browser Sigma QA, release Tauri Sigma QA, precision-touchpad QA, edge-event comparison, ForceAtlas2 feasibility, and accessibility/search/Inspector handoff QA.

---

# Exit gate

KG13A is complete only when:

1. Global-mode product task is explicit.
2. Structural mode remains hierarchical authority.
3. stable Sigma v3 version/license is verified.
4. v4 alpha is not adopted accidentally.
5. candidate consumes KG6-derived data.
6. Graphology remains derived renderer state.
7. no canonical changes required.
8. documents-only Global projection is benchmarked.
9. higher-density stress is benchmarked.
10. rendering is separated from layout.
11. deterministic renderer positions exist.
12. Sigma mount/first render measured.
13. pan/zoom measured.
14. hover measured.
15. selection measured.
16. search-center demonstrated.
17. live update behavior measured.
18. edge-events off/on compared.
19. label strategy evaluated.
20. WebGL works in browser/Tauri.
21. failure behavior understood.
22. accessibility limitations documented.
23. DOM search/Inspector fallback is viable.
24. meaningful force-directed layout path evaluated separately.
25. layout persistence question answered for KG13B.
26. stable IDs survive mapping/live updates.
27. semantic viewport feasibility evaluated.
28. bundle/dependency cost recorded.
29. alternatives compared without unnecessary prototypes.
30. product-value matrix completed.
31. result explicitly ADOPT/DEFER/REJECT.
32. ADOPT recommendation is documents-only first.
33. DEFER/REJECT leaves no unjustified production dependencies.
34. no production mode switch added.
35. no analytics added.
36. existing tests stay green.
37. browser QA passes.
38. release Tauri QA passes.
39. no private evidence committed.
40. docs/roadmap reconciled.
41. PR/post-merge CI pass.
42. cleanup completes.

Do not begin KG13B.

---

# Final report

## 1. Decision

State `ADOPT`, `DEFER`, or `REJECT` and why.

## 2. Product role

What Global does differently from Structural.

## 3. Candidate research

Verified Sigma/Graphology/React Sigma/ForceAtlas2/Pixi/Cytoscape status.

## 4. Candidate architecture

```text
KG6 ViewProjection
→ plain global input
→ Graphology
→ Sigma WebGL
```

## 5. Renderer-only performance

For each scale:

```text
nodes/edges
mount
first render
pan/zoom gap
hover
selection
search center
update
```

## 6. Edge/label evidence

## 7. Layout evidence

ForceAtlas2 separately from renderer.

## 8. Browser/Tauri evidence

## 9. Accessibility

## 10. Stable identity/live updates

## 11. Viewport feasibility

## 12. Bundle/dependencies

## 13. Product-value matrix

## 14. Structural-mode comparison

Explain complementarity or redundancy.

## 15. Decision gate

Pass/fail all hard gates.

## 16. Files changed

Spike/benchmark/docs only.

## 17. Tests/validation

All commands actually run.

## 18. Privacy

No private source/path/query/trace.

## 19. Roadmap

If ADOPT:

```text
KG13 — In progress
KG13A — Complete
KG13B — Next
```

If DEFER/REJECT:

```text
KG13 — Complete
KG14 — Next
```

## 20. KG13B recommendation — only if ADOPT

Recommend only:

```text
Global documents-only mode
+ Structure/Global switch
+ hover/select
+ search center
+ Inspector
+ existing KG6 filters/focus
+ Open in Structure handoff
```

State whether KG13B needs direct Sigma/React Sigma, ForceAtlas2 worker, derived layout cache, and a renderer-specific semantic viewport extension.

Do not implement KG13B automatically.
