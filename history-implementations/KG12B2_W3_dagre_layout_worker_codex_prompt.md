# KG12B2 — W3 Dagre Layout Worker

**Task type:** stateless layout worker / latest-result-wins rendering / responsiveness hardening

## Goal

Implement the W3 decision from KG12A:

```text
ViewProjection
→ main-thread renderer mapping
→ plain Dagre layout input
→ dedicated Web Worker
→ positions
→ renderer assembly
→ React Flow
```

The goal is not to make Dagre intrinsically faster. The goal is to keep direct UI interaction responsive while expensive layout runs, and to ensure obsolete layouts never replace newer graph states.

W3 must remain separate from the stateful W1 workspace worker. If all gates pass, KG12 is complete and KG13 becomes next.

## Current evidence

Repository: `lillo24/icarus-graph-explorer`.

KG12B1 merged through PR #24 at `3b633694a9387e67ae12ab8a1d940dd875744c98`.

Current roadmap:

```text
KG12 — In progress
KG12A — Complete
KG12B1 / W1 workspace worker — Complete
KG12B2 / W3 Dagre worker — Next
```

KG12A measured the small fully expanded renderer at about:

```text
1,700 nodes / 2,000 edges
Dagre median 1,234.4 ms
p95 1,368.3 ms
```

Budgets:

```text
Class A direct feedback: median 16 ms / p95 32 ms
Class B structural work: median 100 ms / p95 250 ms
```

The current renderer synchronously performs:

```text
mapProjectionToReactFlow()
→ layoutRendererGraph()
→ applyRendererInteractionState()
→ React Flow
```

`GraphCanvas` currently runs the full prepare step inside `useMemo()`.

Do not change the layout rules merely because execution moves off-thread.

## Concurrent UX prerequisite

At plan-writing time PR #25 (`UX4B: floating filters and unified inspector drawer`) is open and modifies `GraphExplorer.tsx`.

Before final W3 integration:

1. verify PR #25 or its replacement is merged/stable;
2. if it is still changing the graph shell, do not integrate against stale `main`;
3. isolated worker/layout package work may proceed if useful;
4. rebase/sync final W3 work onto latest `main`;
5. preserve the final UX behavior exactly.

Do not clean or modify the concurrent UX branch/worktree.

## Required first inspection

Read:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PERFORMANCE.md`
- `docs/ROADMAP.md`
- ADR 0011
- latest UX PR status
- `packages/renderer-reactflow/README.md`
- `packages/renderer-reactflow/src/types.ts`
- `mapping.ts`
- `layout.ts`
- `prepare.ts`
- `GraphCanvas.tsx`
- viewport/center helpers
- `packages/performance/*`
- W1 worker client/entry conventions
- `apps/web/src/components/GraphExplorer.tsx`
- `apps/web/src/workers/*`

Follow the normal PR/CI/cleanup workflow.

---

# Core rule: W3 is stateless

W3 receives one plain layout input and returns one plain layout result.

It owns no:

- canonical snapshot;
- ViewProjection;
- KG10 state;
- stable identity;
- React state;
- viewport;
- selection;
- persisted state.

Each request is independently computable.

W1 and W3 must stay separate because their semantics differ:

```text
W1: stateful + sequential + transactional prepare/commit
W3: stateless + supersedable + latest-result-wins
```

Do not create a universal worker abstraction.

---

# Latest-layout-wins

Example:

```text
expand A → request 41 begins
filter changes before 41 finishes → request 42
```

Request 41 must never replace request 42.

Two guarantees are required:

1. stale-result rejection;
2. stale-computation cancellation.

Ignoring stale result 41 is insufficient if a single worker then computes old layouts sequentially before reaching 42.

Because synchronous Dagre cannot be interrupted from the same worker event loop, preferred behavior is:

```text
new request arrives while Dagre is running
→ terminate current W3 worker
→ create replacement worker
→ send only latest request
```

When idle, keep/reuse the warm worker.

Measure restart overhead.

---

# Plain Dagre package

Create a source-neutral package, preferably:

```text
packages/dagre-layout/
@icarus-graph-explorer/dagre-layout
```

It owns:

- plain serializable layout input/output;
- the existing Dagre configuration;
- synchronous `computeDagreLayout()` for worker/runtime tests and benchmark oracle.

Dependency:

```text
dagre-layout → @dagrejs/dagre
```

It must not import React, React Flow, view-projection, renderer-reactflow, browser Worker globals, Tauri, filesystem APIs, W1, Graphology, or Sigma.

Move Dagre algorithm ownership here rather than duplicating configuration.

Current settings must remain equivalent:

```text
structure → TB
focus     → LR
ranker    → network-simplex
current nodesep/ranksep/margins
hierarchy minlen/weight
reference minlen/weight
```

---

# Plain input/output

The current renderer already has the right conceptual input:

```ts
interface LayoutInputNode {
  id: string
  width: number
  height: number
}

interface LayoutInputEdge {
  id: string
  source: string
  target: string
  kind: 'hierarchy' | 'reference'
}

interface DagreLayoutInput {
  mode: 'structure' | 'focus'
  nodes: readonly LayoutInputNode[]
  edges: readonly LayoutInputEdge[]
}
```

Input must include entity topology only. Diagnostic target nodes remain outside Dagre.

Worker output should be plain arrays, not Map/React Flow values:

```ts
interface DagreLayoutPosition {
  id: string
  x: number
  y: number
}

interface DagreLayoutOutput {
  positions: readonly DagreLayoutPosition[]
}
```

Validate unique IDs, expected node coverage, deterministic ordering, and finite coordinates.

---

# Split renderer preparation

Refactor current layout into three phases:

```text
A. projection → semantic React Flow mapping
B. mapped entity topology → plain Dagre input
C. plain positions → complete RendererGraph
```

Useful functions may resemble:

```ts
createRendererLayoutInput(...)
applyRendererLayoutPositions(...)
fallbackRendererGraph(...)
```

Keep exact diagnostic-node placement behavior on the renderer/main side after entity positions return.

Keep a synchronous `layoutRendererGraph()` / `prepareRendererGraph()` path for pure benchmarks and correctness tests, but production `GraphCanvas` must stop invoking expensive synchronous Dagre.

A worker failure must never trigger synchronous main-thread Dagre fallback.

---

# Grid fallback

Preserve existing deterministic grid fallback semantics.

If the latest Dagre computation or worker transport fails:

```text
latest mapped graph
→ deterministic grid positions
→ accessible layout warning
```

The graph remains usable.

A worker crash may be recovered on the next layout request by creating a fresh worker.

Only the latest request may produce visible success or visible fallback. A stale request's failure must be ignored.

---

# W3 protocol

Use a tiny versioned protocol:

```ts
protocolVersion
requestId
kind: 'layout'
input
```

Success:

```text
requestId
layout positions
worker compute duration
```

Failure:

```text
requestId
code
message
compute duration
```

No candidate/commit state is needed.

No Tauri types, React Flow objects, ViewProjection, or request IDs enter persistent/performance artifacts.

Use structured-cloneable plain data.

---

# Worker entry/client

Likely:

```text
apps/web/src/workers/dagre-layout.worker.ts
apps/web/src/workers/dagre-layout-worker-client.ts
```

Use Vite's proven pattern:

```ts
new Worker(new URL('./dagre-layout.worker.ts', import.meta.url), {
  type: 'module',
})
```

The worker entry should only:

```text
validate request
→ computeDagreLayout()
→ post success/failure
```

The client owns:

- current worker instance;
- monotonic request ID;
- latest generation;
- one active request;
- supersede termination/replacement;
- `error`;
- `messageerror`;
- disposal;
- stale response rejection.

Do not add Comlink or another RPC dependency.

---

# Renderer service boundary

`renderer-reactflow` must not import `apps/web`.

Give `GraphCanvas` a narrow async layout service contract, conceptually:

```ts
interface GraphLayoutService {
  layoutLatest(input): Promise<
    | { status: 'success'; output; computeMs }
    | { status: 'failure'; message; computeMs }
    | { status: 'superseded' }
  >
  dispose(): void
}
```

The web/GraphExplorer layer creates the W3 worker client and passes it down.

Tests can use fake/in-process services.

Production browser and Tauri graph rendering should use W3. Do not make it desktop-only.

If Worker construction fails, use grid fallback + warning, not synchronous Dagre.

---

# Async GraphCanvas

Replace synchronous full prepare with:

```text
projection
→ synchronous mapping/useMemo
→ layout input/useMemo
→ async worker request
→ committed RendererGraph state
→ interaction highlighting
```

Maintain:

```text
latest request generation
last committed renderer graph
layout pending state
```

Only the latest current result may commit.

## First layout

If no committed graph exists:

```text
show compact accessible "Laying out graph…" state
```

Do not mount a zero-position React Flow scene and then jump.

## Later layout

Keep the last committed graph visible while the latest structural graph is being laid out.

Optionally show a subtle `aria-busy` / “Updating layout…” status if it is perceptible.

Do not clear/flicker the canvas.

---

# Safety while old graph is displayed

The visible committed graph may temporarily represent the previous structural state.

Hover, selection, pan/zoom may remain active.

Structural node toggling must not trust stale node `isExpanded` data and mutate the wrong reducer state.

Preferred:

```text
derive current open/closed disclosure from current application state
```

Simpler safe fallback:

```text
temporarily disable node disclosure toggles while a layout is pending
```

If disabled, keep pan/zoom/selection/Inspector responsive and expose `aria-busy`.

External toolbar structural changes may still supersede the current request.

---

# Center / fit / viewport semantics

Current center/fit behavior must be adapted to asynchronous layout.

## Center request

A center request for the new projection must not be consumed against the old committed graph.

Wait until the matching current layout commits, then resolve it.

## Fit request

Structural fit requests should likewise target the new committed graph.

Manual Fit while no structural layout is pending can still apply immediately.

## Initial saved viewport

Do not consume saved semantic-center state before the first worker layout exists.

Prefer mounting React Flow only after initial RendererGraph is ready.

## Semantic viewport

Observe/persist viewport against the committed graph only.

No request IDs or pending positions enter KG9 view state.

---

# Disclosure anchor

Current behavior captures an expanded/collapsed entity's screen-space anchor and restores it after layout.

Attach that anchor to the exact next layout generation.

When that matching layout commits:

```text
restore anchor
```

If the request is superseded:

```text
discard stale anchor
```

Do not apply an anchor from one structural state to an unrelated later layout.

Add tests for this.

---

# Hover / selection

Keep:

```text
committed RendererGraph
→ applyRendererInteractionState()
→ React Flow
```

Do not send hover or selection to the worker.

KG12A operation oracle must remain:

```text
hover → highlight only
selection → highlight + inspection
```

No layout request.

After new layout commit, surviving selection remains; removed selection follows existing GraphExplorer cleanup.

---

# Worker failure semantics

Distinguish:

## Dagre computation failure

Worker returns structured failure.

Latest mapped graph uses grid fallback. Worker may remain reusable.

## Worker transport failure

`error`, `messageerror`, malformed response:

```text
latest graph → grid fallback
terminate bad worker
next layout creates a fresh worker
```

No synchronous Dagre.

A stale failure does nothing visible.

---

# Correctness oracle

For deterministic structure/focus inputs compare:

```text
direct synchronous Dagre output
==
worker Dagre output
```

Then compare complete renderer output:

```text
direct layoutRendererGraph(mapped)
==
applyRendererLayoutPositions(mapped, workerPositions)
```

Include diagnostic placement.

Cover:

- structure;
- focus;
- hierarchy/reference weighting;
- diagnostic nodes;
- empty/small graphs;
- deterministic ordering.

Workerization must not alter coordinates or current geometry.

---

# Performance instrumentation

Preserve the existing `dagre-layout` phase and add worker-specific aggregate phases only if useful, e.g.:

```text
dagre-worker-compute
dagre-worker-round-trip
dagre-result-apply
dagre-main-thread-gap
```

Measure:

- direct Dagre;
- worker internal compute;
- round-trip;
- worker startup/restart;
- result application;
- request→adoption;
- RAF/event-loop high gap.

The main success target is responsiveness while 1,700-node layout runs.

Do not claim algorithm wall time is improved unless measured.

The layout may still exceed Class B wall time; that becomes KG13 evidence.

---

# Supersession benchmark

Run an expensive:

```text
A → B → C
```

test.

Expected:

```text
A terminated
B terminated if still running
C only adopted
```

Measure:

- worker recreation overhead;
- stale CPU time before termination;
- C request→result;
- main-thread gap.

The product must not wait sequentially for A+B+C.

---

# Mapping/result-apply scope

KG12A classified ordinary renderer mapping as P3.

Keep mapping main-thread.

Do not send ViewProjection to W3.

Measure result application separately. If applying positions itself creates a significant Class A main-thread stall, report it and only make a minimal evidence-backed optimization if clearly warranted.

Do not invent partial-position reuse or a new node store preemptively.

---

# No caches / algorithm redesign

Do not add:

- general layout cache;
- incremental Dagre;
- unaffected-subgraph reuse;
- manual positions/pins;
- animated layout;
- different Dagre ranker;
- alternate layout engine;
- Graphology;
- Sigma/Pixi/WebGL.

W3 is execution placement + supersession.

KG13 owns any high-density renderer decision.

---

# Browser/Tauri build behavior

W3 is used by both ordinary browser graph mode and Tauri graph mode.

The worker should be created lazily when a graph needs layout.

Record:

```text
W3 worker chunk size
main graph bundle change
whether Dagre is accidentally duplicated in the main production path
```

The synchronous benchmark subpath may still exist in source, but normal production GraphCanvas should not eagerly bundle/execute Dagre on main solely because benchmark exports exist.

Use subpath/lazy boundaries if needed.

---

# Tests

## Dagre package

- exact deterministic structure coordinates;
- exact focus coordinates;
- hierarchy/reference weights;
- dimensions;
- empty graph;
- output validation;
- finite coordinates;
- structuredClone input/output;
- no React/React Flow dependency.

## Renderer split

- entity-only layout input;
- diagnostic exclusion;
- topology edge filtering;
- positions applied exactly;
- diagnostic placement unchanged;
- grid fallback unchanged;
- synchronous direct path equivalent;
- hover/selection create no layout requests.

## Worker client

- success/failure;
- malformed response;
- error/messageerror;
- dispose;
- idle worker reuse;
- active request supersession terminates/replaces worker;
- stale success ignored;
- stale failure ignored;
- superseded promise settles;
- request generations monotonic.

## GraphCanvas

- first pending state;
- old graph remains during later layout;
- only newest result commits;
- structural controls safe while pending;
- hover/selection while pending;
- center waits for current layout;
- fit waits where required;
- saved initial center not consumed early;
- disclosure anchor matching/superseded behavior;
- viewport uses committed graph;
- worker failure grid fallback;
- unmount cleanup.

---

# Live W1 → W3 path

Verify:

```text
live source edit
→ W1 worker report
→ main projection
→ W3 layout
→ React paint
```

A W3 result from a pre-update projection must never overwrite a post-update graph.

W1 and W3 worker lifetimes remain independent.

Preserve performance correlation through final paint.

---

# Native/browser QA

Production browser:

- initial sample;
- documents/top-level;
- expand/collapse;
- Focus;
- filters;
- search navigation;
- hover/selection while pending;
- maximize/restore;
- pan/zoom;
- Inspector/Tools/Filters;
- no worker/CSP errors.

Production Tauri:

- Open Vault;
- live W1 → W3 update;
- Rescan;
- rapid structural changes;
- source switch;
- restart/reselect;
- precision touchpad unchanged;
- no worker module errors.

---

# Dependencies

Expected external runtime additions: zero.

`@dagrejs/dagre` already exists; move its ownership to the plain package.

No worker/RPC/cache/layout dependency should be added.

---

# ADR 0012

Record:

1. Dagre executes in a dedicated W3 worker.
2. W3 is stateless/latest-result-wins.
3. obsolete in-flight work is canceled through worker termination/replacement.
4. mapping/highlighting remain main-thread.
5. diagnostic placement stays renderer-side.
6. failure uses deterministic grid, never synchronous Dagre.
7. Dagre geometry/config remains unchanged.
8. W1/W3 stay separate because semantics differ.
9. W3 improves responsiveness, not algorithmic complexity.
10. resulting renderer scale evidence feeds KG13.

---

# Documentation / roadmap

Likely update:

```text
packages/dagre-layout/README.md
packages/renderer-reactflow/README.md
apps/web/src/workers/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/PERFORMANCE.md
docs/ROADMAP.md
docs/decisions/0012-*.md
```

If all gates pass and no new P0/P1 main-thread bottleneck appears:

```text
KG12 — Complete
KG13 — Next
```

If W3 reveals a new serious main-thread bottleneck that still breaks direct responsiveness, do not mark KG12 complete; stop and report the evidence for a minimal additional KG12 step.

Do not implement KG13 automatically.

---

# Suggested implementation sequence

1. Reconcile/merge latest PR #25 graph UX.
2. Extract plain Dagre algorithm/config without geometry changes.
3. Refactor renderer into map → layout-input → apply-positions.
4. Preserve direct sync benchmark path.
5. Implement W3 worker entry/client.
6. Implement true active supersession with worker replacement.
7. Add async layout service to renderer.
8. Refactor GraphCanvas pending/committed state.
9. Make node disclosure safe while old graph is visible.
10. Defer center/fit/disclosure anchor to matching layout.
11. Add grid fallback.
12. Add direct-vs-worker coordinate oracle.
13. Extend instrumentation.
14. Run small stress + medium bounded worker benchmarks.
15. Run A→B→C supersession benchmark.
16. Run production browser QA.
17. Run production Tauri/trackpad/live QA.
18. Update ADR/performance/roadmap.
19. PR → CI → merge → post-merge CI → cleanup.
20. Stop before KG13.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/dagre-layout typecheck
pnpm exec vitest run packages/dagre-layout

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:performance -- --profile medium

# new W3 worker benchmark per repository convention

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
direct-vs-worker coordinate oracle
small stress responsiveness
medium bounded responsiveness
A→B→C supersession
production browser interaction QA
production Tauri live/trackpad/source-switch QA
```

PR CI and post-merge main CI must pass.

---

# Exit gate

KG12B2 is complete only when:

1. Dagre config/algorithm has one plain source of truth.
2. Production GraphCanvas no longer runs Dagre synchronously.
3. Mapping remains main-thread.
4. Projection/inspection remain main-thread.
5. Diagnostics remain outside Dagre topology.
6. Dedicated W3 worker executes layout.
7. Protocol is versioned/plain/cloneable.
8. Output is plain positions.
9. idle worker is reused.
10. active obsolete layout is terminated/replaced.
11. stale success cannot commit.
12. stale failure cannot fallback visibly.
13. only latest layout updates renderer.
14. worker disposal/error/messageerror are safe.
15. worker failure uses grid fallback, not synchronous Dagre.
16. initial layout has accessible pending state.
17. later pending layout keeps last graph visible.
18. stale disclosure state cannot corrupt current graph state.
19. external structural controls can supersede pending work.
20. hover/selection/Inspector/maximize/resize/pan/zoom do not create layouts.
21. center/fit use current committed layout.
22. saved initial center is not consumed early.
23. disclosure anchor applies only to matching generation.
24. semantic viewport uses committed graph.
25. direct and worker coordinates are identical in tested cases.
26. diagnostic placement matches pre-W3.
27. W1 behavior remains unchanged.
28. live W1 → W3 → paint is correct.
29. main-thread responsiveness during small stress is measured.
30. medium bounded responsiveness is measured.
31. worker compute/round-trip/result-apply are separated.
32. A→B→C adopts only C without sequential obsolete waits.
33. no flaky CI timing threshold is added.
34. browser and Tauri production workers load successfully.
35. touchpad behavior is unchanged.
36. no worker CSP/module errors.
37. no external runtime dependency added.
38. performance output contains no private/request/topology identifiers.
39. `docs/PERFORMANCE.md` separates layout wall-time from main-thread responsiveness limits.
40. ADR/docs are reconciled.
41. if no new blocking P0/P1 remains, KG12 is complete and KG13 next.
42. existing tests stay green.
43. PR/post-merge CI pass.
44. cleanup is complete.

Do not begin KG13.

---

# Final report

## 1. Summary
What W3 now runs off-main.

## 2. Renderer architecture
`projection → mapping → W3 input → worker Dagre → positions → diagnostics → highlight → React Flow`.

## 3. Geometry/config
Where Dagre config lives and pre/post equivalence.

## 4. Worker protocol/lifecycle
Version, request/result, warm reuse, termination.

## 5. Latest-layout-wins
Stale rejection and active cancellation.

## 6. Pending renderer UX
Initial/pending behavior and structural safety.

## 7. Viewport/navigation
Center, fit, disclosure anchor, semantic viewport.

## 8. Failure behavior
Compute/transport failures and grid fallback.

## 9. Correctness
Direct vs worker coordinate/RendererGraph equality.

## 10. Performance
Small stress + medium bounded: direct compute, worker compute, round-trip, result apply, main-thread gap, request→adoption.

## 11. Supersession
A→B→C evidence.

## 12. Live W1→W3
One live update/rescan through paint.

## 13. Structural renderer limit
Separate wall-clock cliff from responsiveness cliff for KG13.

## 14. Bundle evidence
Worker/main chunk changes and Dagre duplication.

## 15. Dependencies
Expected external additions: zero.

## 16. Tests/CI
All validation actually run.

## 17. Privacy
No private source/path/protocol data.

## 18. Files changed
Important Dagre/renderer/worker/performance/docs areas.

## 19. Roadmap
If gates pass: `KG12 complete`, `KG13 next`.

## 20. Deviations/warnings
Worker startup/restart, result-apply cost, remaining Class-B wall-time, pending-old-graph UX, any new P0/P1.

## 21. KG13 handoff
State that W1/W3 heavy work no longer blocks main-thread interaction; current React Flow interaction cost and Dagre wall-time cliff are separately measured; KG13 should decide whether a separate global/high-density renderer adds product value rather than replace the structural renderer merely because WebGL exists.

Do not implement KG13 automatically.
