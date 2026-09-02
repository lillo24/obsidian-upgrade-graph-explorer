# KG12A — Performance Baseline, Budgets + Optimization Decision

**Task type:** performance instrumentation / workload definition / evidence gate

## Why KG12 is split

KG12 must remain measurement-led:

```text
KG12A
→ finalize workloads
→ instrument pure + browser + live phases
→ collect repeatable baselines
→ define explicit budgets
→ rank bottlenecks
→ decide worker/caching/incrementality strategy

KG12B
→ implement only the optimizations justified by KG12A
→ remeasure against the same workloads/budgets
```

Do not begin KG12B automatically.

## Hard prerequisite: UX4B must be merged first

At plan-writing time PR #21 (`UX4B: add true canvas workspace mode`) is still open. It changes floating Tools/Settings, Inspector drawer behavior, canvas layout, gesture preferences, and responsive interaction.

Those directly affect the interactions KG12 must profile. Therefore:

1. verify PR #21 or its replacement is merged;
2. verify required physical precision-touchpad/manual QA is resolved or explicitly accepted;
3. sync to latest `main`;
4. if UX4B is still materially changing graph interaction/layout, **STOP and report KG12A blocked**.

Do not collect the final performance baseline against the pre-UX4B UI.

## Current evidence

Repository: `lillo24/icarus-graph-explorer`.

KG11 is complete through PR #20. Current live architecture is:

```text
watch reconciliation
→ KG10
→ diagnostic report
→ identity persistence
→ report adoption
→ projection
→ renderer mapping
→ Dagre
→ React Flow
```

The KG11 controller already records:

```text
sourceReconciliationMs
workspaceUpdateMs
diagnosticConstructionMs
identityPersistenceMs
totalMs
```

but does not yet correlate that through React graph commit/paint.

The existing benchmark already measures parse/adapt, KG4 resolution, identity, KG10 edit/add/delete/move, report construction, projection, inspection/search, React Flow mapping, and Dagre layout.

Existing deterministic profiles include:

```text
small: 100 docs
medium: 500 docs / ~8,500 entities / ~16,000 refs
large: 2,000 docs / stress scale
```

Historical evidence suggests layout can dominate large structural transitions, while live KG10/report work can also consume hundreds of milliseconds. Re-measure after UX4B; historical numbers are not budgets.

Before editing inspect:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- ADR 0007–0010
- PR #21/current UX state
- `tools/vault-diagnostics/src/benchmark*.ts`
- `tools/vault-diagnostics/src/incremental-benchmark.ts`
- `apps/web/src/desktop-live-vault.ts`
- `apps/web/src/components/GraphExplorer.tsx`
- `apps/web/src/graph-state.ts`
- `packages/view-projection/src/*`
- `packages/explorer-inspection/src/*`
- `packages/renderer-reactflow/src/GraphCanvas.tsx`
- `packages/renderer-reactflow/src/prepare.ts`
- `packages/renderer-reactflow/src/layout.ts`
- `packages/renderer-reactflow/src/highlight.ts`

Use current React Flow docs only where necessary to understand instrumentation/performance knobs. Do not enable a knob merely because it exists.


## KG12A outcome

KG12A should produce:

1. stable workload/profile definitions;
2. repeatable pure-computation measurements;
3. repeatable production-like browser interaction measurements;
4. end-to-end live-vault measurements;
5. explicit performance budgets;
6. a P0–P3 bottleneck ranking;
7. worker decision matrix;
8. caching/incrementality decision matrix;
9. exact KG12B recommendation.

No major optimization implementation yet.

Add a performance source of truth, preferably:

```text
docs/PERFORMANCE.md
```

Raw machine traces/results should remain ignored under something like `output/performance/`.

## Workload model

Always distinguish:

```text
canonical workspace scale
from
visible projected graph scale
```

Every renderer/browser result should include:

```text
documents/entities/references
projected nodes/edges
layout mode
scenario
build mode
```

Retain current smoke/small/medium/large synthetic profiles unless a compatible refinement is clearly needed.

Use:

- smoke: correctness/instrumentation only;
- small: fast development;
- medium: main deterministic performance profile;
- large: stress evidence, not routine CI.

Do not imply users should fully expand large vaults.

## Projection/view scenarios

Measure at least:

```text
documents-only
top-level/main sections
bounded custom expansion
1-hop focus
representative deeper focus
resolution filter
heading-level filter
path/entity filters
fully expanded stress projection
```

Report node/edge count for every scenario.

The fully expanded case exists to reveal algorithmic cliffs, not to define ordinary product expectations.


## Product interaction matrix

After UX4B, establish stable browser/Tauri scenarios:

### I1 Initial graph preparation
Validated report/snapshot → first usable graph paint. Source acquisition separate.

### I2 Expand one document/section
Measure action → state → projection → mapping → layout → React commit → next paint.

### I3 Collapse one branch

### I4 Change structural depth/main-section mode

### I5 Apply/remove representative graph filters

### I6 Enter Focus

### I7 Exit Focus

### I8 Hover node/edge
Must be measured separately; it should not invoke projection/layout.

### I9 Select node/edge
Include Inspector update. Verify whether layout occurs unexpectedly.

### I10 Canonical search
Representative hit + no-match query.

### I11 Search/backlink navigation
Reveal + center.

### I12 Inspector open/close

### I13 Maximize/restore true canvas

### I14 Resize / responsive transition

### I15 Pan/zoom/pinch event responsiveness

### I16 One live Markdown update
Report 250 ms watcher quiet window separately from:
source reconciliation → KG10 → report → persistence → graph paint.

### I17 Non-Markdown-only live update

### I18 Full Rescan Vault

Do not proliferate scenarios without evidence.

## Instrumentation architecture

Prefer built-in APIs and optional hooks:

```text
performance.now
performance.mark / measure
requestAnimationFrame
React Profiler where useful
```

Only use Long Tasks / `PerformanceObserver` if support is verified and useful.

Instrumentation must be disabled by default and low/no-overhead in normal product use. A dev flag, query flag, or optional callback is acceptable.

Do not put timing data into canonical snapshots, stable identity catalogs, or persisted KG9 view state.

Measure explicit phases where practical:

```text
projection workspace construction
inspection workspace construction
projectView
renderer mapping
Dagre layout
interaction highlighting
GraphExplorer commit
GraphCanvas commit
next paint
viewport center/restore
search/inspection
live report adoption
```

Use React Profiler or a narrow equivalent to determine rerender frequency/cost for hover, selection, pan/zoom, Inspector changes, and live updates.

Do not optimize those rerenders in KG12A.


## Architectural operation-count guards

Add deterministic instrumentation/tests for expectations that should not depend on machine speed.

Normally these interactions should **not** trigger KG6 reprojection or Dagre layout:

```text
hover
selection
Inspector open/close
pan/zoom
```

Structural interactions may legitimately do so:

```text
expand/collapse
focus
structural filters
```

Where reliable, CI may assert operation counts rather than wall-clock milliseconds.

## End-to-end live correlation

Extend performance evidence so one KG11 committed live update can be followed through:

```text
controller total
→ App report adoption
→ GraphExplorer processing
→ projection
→ mapping/layout
→ React commit
→ next paint
```

Use a runtime-only correlation key. Do not persist it or alter KG11 transaction semantics.

The worker question is about main-thread responsiveness, not only wall time. Measure enough to identify UI blocking, e.g. RAF gaps/event-loop responsiveness/commit-to-paint. Avoid fake precision.

## Repetition/statistics

For deterministic pure computations:

- warm up;
- run multiple iterations;
- report sample count;
- report median;
- report high percentile or representative worst value.

Large stress runs may use fewer iterations if explicitly documented.

Manual native/browser measurements should be clearly labeled and repeated where practical. No statistics dependency is required.

Record environment metadata sufficient for later comparison:

```text
git commit
Node/pnpm
OS/platform
CPU model where available
browser/Tauri/WebView where available
production/dev build
profile/scenario
canonical/projected counts
```

Do not include private vault paths or unnecessary user-identifying system information.

Browser interaction baselines should be primarily from production-like builds; development React performance is not directly comparable.


## Explicit performance budgets

KG12A must define concrete budgets **after** measuring the final UX4B interaction surface.

Use at least three classes:

### Class A — direct feedback
Hover, selection, Tools/Settings, Inspector drawer, pan/zoom handling.

Expected to feel effectively immediate.

### Class B — structural transition
Expand/collapse, filters, Focus, reveal/navigation.

May perform projection/layout, but must remain comfortably interactive for the supported ordinary projection scale.

### Class C — background/live source work
Live Markdown updates, full resync, initial source acquisition.

May take longer, but should not freeze direct graph interaction for long periods.

`docs/PERFORMANCE.md` must state actual millisecond target/escalation thresholds and **which workload/projected scale they apply to**.

Do not choose artificially loose budgets merely because current code is slow.

Do not require fully expanded stress graphs to satisfy the ordinary structural budget.

### CI policy

Do not add flaky hard millisecond gates on GitHub shared runners in KG12A.

CI should enforce deterministic contracts:

```text
harness builds
scenario/result schema
operation counts
no layout on hover/selection
algorithmic correctness/boundedness where practical
```

Machine-specific timing budgets stay documented/local for now.


## Baseline result contract

Create one small machine-readable result format for KG12A/B comparisons. Conceptually:

```ts
interface PerformanceSample {
  scenario: string
  profile: string
  phase: string
  sampleCount: number
  medianMs: number
  highMs: number
  canonicalCounts?: ...
  projectionCounts?: ...
  environment?: ...
}
```

Exact shape may differ.

Commit the schema/tests, not private machine traces.

## Real Icarus baseline

Use the private selected Icarus vault only for aggregate evidence.

Measure read-only/normal workflows such as:

```text
desktop initial open
documents-only/main-section graph prep
representative expansion
focus enter/exit
search
selection/Inspector
maximize/restore
manual Rescan
```

For live-edit latency prefer a disposable synthetic vault. A natural real edit may be observed but is not required.

Final report includes only aggregate counts/timings, never note names/paths/search terms.

## Synthetic native live baseline

Use a disposable vault for repeatable:

```text
single Markdown edit
rapid save burst
create/delete/rename
non-Markdown asset update
```

Separate:

```text
250 ms watcher batching
provider reconciliation
KG10
report
identity persistence
graph update to next paint
```

This becomes the KG12B before/after live workload.


## Worker decision matrix

Evaluate candidate boundaries separately. **Do not implement them in KG12A.**

### W1 — KG10 + diagnostics worker
Measure main-thread blocking, KG10/report time, message sizes, and ownership complexity. `ObsidianWorkspaceEngine` is method-bearing/non-cloneable today, so a worker would likely own engine state behind a message protocol.

### W2 — projection worker
Measure `projectView` time/frequency and snapshot/state transfer cost.

### W3 — Dagre layout worker
Measure layout dominance, frequency, graph transfer cost, and interaction with viewport/layout reuse.

### W4 — inspection/search worker
Consider only if evidence justifies it.

For each output:

```text
main-thread time saved
serialization/transfer cost
state ownership complexity
frequency
correctness risk
decision: adopt in KG12B / defer / reject
```

## Caching/incrementality decision matrix

Measure before deciding on:

```text
layout cache/reuse
projection cache/reuse
incremental projection from KnowledgeSnapshotDelta
incremental inspection indexes
incremental renderer mapping
partial KG4 invalidation
React Flow onlyRenderVisibleElements
React memo/highlight representation changes
```

Existing deltas do not automatically justify downstream incremental complexity.

## Dagre evidence

Current layout rebuilds a Dagre graph using `network-simplex`.

Measure layout time versus node/edge count for:

```text
structure
focus
same-topology repeat
small disclosure delta
filter/focus topology changes
```

KG12A should decide whether KG12B should prioritize:

```text
avoid unnecessary layout
exact-topology layout reuse
position reuse
different layout configuration
workerized layout
```

Do not change ranker/algorithm yet.

## React Flow evidence

Historically `onlyRenderVisibleElements` remained disabled.

Do not enable it automatically. If practical, test it as an isolated reversible experiment and report whether it helps mount/pan/zoom/interaction at relevant scales.

Measure hover/selection scaling separately because they can be expensive even without layout.

Also record bundle/chunk evidence enough to explain the current Vite warning, but do not prioritize bundle reduction unless it correlates with real startup/evaluation cost.


## Bottleneck classification

Classify significant findings:

```text
P0 — ordinary interaction badly violates budget / visible freeze
P1 — ordinary interaction misses target noticeably
P2 — stress-scale degradation bounded by product interaction design
P3 — measurable but not currently user-relevant
```

KG12B should focus on P0/P1.

P2 informs KG13.

Do not spend complexity on P3.

## Structural renderer limit / KG13 input

Quantify approximately:

```text
at what projected node/edge scale does current React Flow + Dagre
stop meeting the ordinary Class B structural-transition budget?
```

Keep a fully expanded stress scenario to expose cliffs.

Do not replace React Flow or add Sigma/Pixi/WebGL in KG12A.

## KG12A non-goals

Do not implement:

- workers/RPC;
- partial KG4 invalidation;
- incremental KG6/search consumers;
- major layout caching;
- alternate layout engine;
- renderer replacement;
- Graphology/Sigma/Pixi;
- broad domain-model changes.

If instrumentation reveals a correctness bug, fix only if small and clearly separate; otherwise stop/report.

The final report should decide whether KG12B is one prompt or several. Do not predeclare subplans unless evidence supports them.


## Tests / QA

Add deterministic tests for instrumentation semantics:

- stable scenario labels;
- phase/correlation correctness;
- source-switch correlation isolation;
- instrumentation disabled by default;
- repeated sample aggregation;
- no unexpected layout on hover/selection;
- output schema validation;
- no private path/content in results.

Browser QA after UX4B should cover instrumentation without behavior regressions:

```text
documents-only
main sections
expand/collapse
focus
hover
selection
search
Inspector drawer
Tools/Settings
maximize
resize
wheel/pinch settings
live synthetic edit
manual rescan
```

Use the physical precision touchpad only for UX correctness; hardware gesture latency is not the application's computational timing.

Expected external runtime dependencies: **zero**. Do not add profiler/benchmark/stats/worker libraries unless built-ins are demonstrably insufficient.

A new ADR is probably unnecessary because KG12A gathers evidence. Durable worker/layout architecture belongs in the later implementation ADR if adopted.


## Roadmap

After KG12A:

```text
KG12 — In progress
KG12A — Complete: baseline + budgets + optimization/worker decision
KG12B — Pending user review / next
```

Do not mark KG12 complete or KG13 next.

## Suggested implementation sequence

1. Verify UX4B merged/stable; stop if not.
2. Sync latest `main`.
3. Define workload/scenario/result contracts.
4. Extend Node benchmark repetition/result output.
5. Add optional browser/Tauri performance collector.
6. Instrument projection/mapping/layout/React commit/paint.
7. Correlate KG11 live update → graph paint.
8. Add operation-count invariants.
9. Run small/medium/large synthetic baselines.
10. Run production browser interaction matrix.
11. Run disposable native live-vault matrix.
12. Run aggregate-only private Icarus baseline.
13. Rank dominant costs.
14. Define explicit budgets.
15. Complete worker/caching decision matrices.
16. Recommend exact KG12B scope(s).
17. Update `docs/PERFORMANCE.md` + roadmap.
18. PR → CI → merge → post-merge CI → cleanup.
19. Stop for user review.

## Validation

Use current repo equivalents, including:

```bash
pnpm install --frozen-lockfile

pnpm benchmark:pipeline -- --profile small
pnpm benchmark:pipeline -- --profile medium
pnpm benchmark:pipeline -- --profile large

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

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

Also run the new production browser performance matrix, synthetic native live baseline, and private aggregate-only baseline.

Do not put expensive large browser stress runs into routine CI.


## Exit gate

KG12A is complete only when:

1. final UX4B canvas interaction is merged before baseline collection;
2. workload profiles and product scenarios are documented;
3. canonical/projected scale are reported separately;
4. repeated pure benchmark statistics exist;
5. production/dev measurements are clearly separated;
6. projection, mapping, Dagre, interaction highlighting, React commit, and next-paint phases are measurable;
7. search/inspection/navigation are measured;
8. KG11 live processing is correlated through graph paint;
9. 250 ms watcher batching is separated from processing;
10. operation-count evidence verifies whether hover/selection trigger layout;
11. instrumentation is disabled by default and not persisted;
12. small/medium/selected large baseline exists;
13. disposable native live baseline exists;
14. aggregate-only real Icarus baseline exists;
15. explicit workload-specific budgets exist;
16. budgets distinguish direct/structural/live classes;
17. no flaky CI millisecond gates are introduced;
18. findings are ranked P0–P3;
19. W1/W2/W3 are explicitly evaluated;
20. W4 is only adopted if evidence supports it;
21. layout reuse is evaluated;
22. downstream delta incrementality is evaluated rather than assumed;
23. React Flow visibility/interaction options are evaluated rather than blindly enabled;
24. structural-renderer scale limit is quantified for KG13;
25. no major optimization is implemented prematurely;
26. `docs/PERFORMANCE.md` is updated;
27. roadmap marks KG12 in progress / KG12A complete;
28. final report recommends exact KG12B scope(s);
29. existing tests remain green;
30. PR/post-merge CI pass;
31. branch/worktree cleanup completes.

Do not begin KG12B.


## Final report

Report:

### 1. Summary
What was measured and what is now known.

### 2. Final UI/workload baseline
Exact UX commit used and why results are comparable.

### 3. Workload profiles
Canonical counts + projected graph scenarios.

### 4. Product budgets
Direct/structural/live targets with workload applicability.

### 5. Pure pipeline baseline
Small/medium/large medians/high values and sample counts for parse, resolution, identity, KG10, report, projection, search/inspection, mapping, layout.

### 6. Browser interaction baseline
For final I1–I15 equivalents: total action→paint, projection/layout/React contribution, projected size, budget pass/miss.

### 7. Live update baseline
Separate 250 ms coalescing from provider, KG10, report, persistence, graph processing, commit/paint.

### 8. Real Icarus evidence
Aggregate counts/timings only.

### 9. Bottleneck ranking
P0–P3 table.

### 10. Worker decision
W1/W2/W3/W4: adopt/defer/reject and evidence.

### 11. Caching/incrementality decision
Layout reuse, projection reuse, delta consumers, visibility rendering, partial KG4, etc.

### 12. Structural-renderer limit
Projected node/edge region where React Flow+Dagre stops meeting ordinary structural budget.

### 13. Dependencies
Expected external runtime additions: zero.

### 14. Tests/validation
All benchmark/browser/native/CI commands actually run.

### 15. Privacy
Confirm no private traces/source/path data committed.

### 16. Files changed
Benchmark/instrumentation/docs areas.

### 17. Roadmap
`KG12 in progress`, `KG12A complete`.

### 18. KG12B recommendation
Recommend the **smallest evidence-backed next implementation scope**.

For each proposed KG12B sub-plan state:

```text
problem
measured evidence
target budget
likely boundaries/files
what not to redesign
validation workload
```

If workers are not justified, say so explicitly.

Do not implement KG12B automatically.
