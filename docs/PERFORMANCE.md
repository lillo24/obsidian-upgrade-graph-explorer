# Performance baseline and KG12B decision

Status: **STABLE — KG12 baselines plus W1/W3 worker implementation and evidence are complete.**

KG12A measured the final UX4B application without changing its product
behavior. KG12B implements the resulting narrow split: whole-workspace
transactions run in stateful W1, Dagre runs in stateless latest-result-wins W3,
projection and inspection stay on the main thread, and no new general-purpose
cache is added.

Wall-clock results are investigative local evidence. CI validates schemas,
operation paths, correctness, builds, and tests, but does not fail on timing.

## Workloads and count boundaries

The synthetic profiles are deterministic and preserve the distinction between
canonical knowledge size and the active projected renderer size.

| Profile | Documents | Sections | Blocks | Canonical entities | References |
| ------- | --------: | -------: | -----: | -----------------: | ---------: |
| smoke   |         4 |        8 |      8 |                 20 |         24 |
| small   |       100 |      400 |    400 |                900 |      1,200 |
| medium  |       500 |    4,000 |  4,000 |              8,500 |     16,000 |
| large   |     2,000 |   20,000 | 20,000 |             42,000 |     80,000 |

Each run covers files/documents only, one structural section level, three
structural section levels, bounded custom expansion, one-hop and three-hop
focus, resolution-state filtering, heading-level filtering, combined
path/entity filtering, a depth-three nontrivial QUERY1 filter, and a fully
expanded stress view. The query scenario parses once per projection and then
performs bounded short-circuit evaluation in O(visible entities × AST nodes);
it does not parse per entity or trigger layout per clause.
The stress projections contain 1,700/2,000 nodes/edges at small,
16,500/20,000 at medium, and 82,000/100,000 at large.

## Method

`pnpm benchmark:performance` performs explicit warm-ups followed by repeated
samples. Defaults are 2+7 for smoke/small, 1+5 for medium, and 1+3 for large;
the recorded KG12A evidence used 2+7 small, 1+3 medium, and 1+3 large. Reports
retain raw values plus median, nearest-rank p95, and maximum. Raw JSON belongs
under ignored `output/performance/` and is not committed.

The harness separately times parse/adapt, resolution, stable identity, report
construction, KG10 updates, projection/inspection workspace construction,
`projectView`, React Flow mapping, Dagre, search, and inspection. It records
operation counts as well as duration. A phase that is intentionally unsafe to
repeat is listed in `omittedPhases`; omission never looks like a zero-time
success.

The small fully expanded result establishes the renderer cliff before 2,500
projected nodes. Repeated Dagre is therefore omitted above 2,500 nodes while
projection and mapping continue to be measured. This protects a local run from
an unbounded 16,500- or 82,000-node main-thread layout without hiding the
omission.

Recorded environment on 2026-08-29: Windows `10.0.26200` x64, Intel Core Ultra
7 258V, Node `v24.13.0`, pnpm `11.19.0`, commit `6cc57a1798b0` before KG12A.
Environment metadata excludes hostnames, usernames, workspace IDs/names,
paths, queries, source text, and live correlation tokens.

## KG12B1 W1 responsiveness evidence

`pnpm benchmark:workspace-worker -- --profile medium` and `--profile large`
compare the same deterministic initialization through direct main-thread W1
and a warm Node worker-thread host around the production protocol/runtime.
They run a 16 ms event-loop probe throughout, verify exact report/catalog
equality, and print aggregate-only JSON. The worker-thread host is local
transport evidence; the Vite production build separately proves the browser
Dedicated Worker bundle and desktop-only lazy boundary.

Recorded on the KG12A machine on 2026-08-29:

| Profile | Mode   |  Compute / round trip | Event-loop p95 / max | High-gap reduction |
| ------- | ------ | --------------------: | -------------------: | -----------------: |
| Medium  | Direct |            1,653.7 ms | 1,669.3 / 1,669.3 ms |                  — |
| Medium  | Worker |  1,747.9 / 2,619.3 ms |       37.2 / 43.7 ms |              38.2× |
| Large   | Direct |            7,166.6 ms | 7,167.1 / 7,167.1 ms |                  — |
| Large   | Worker | 7,466.7 / 11,728.9 ms |       34.0 / 72.6 ms |              98.8× |

The worker does not promise lower wall-clock time. Native structured clone plus
deliberate message yielding increases round trip, while main-thread blockage
falls by one to two orders of magnitude. The local Node p95 remains slightly
above the 32 ms Class A reference, so release-like Tauri UI QA remains the
authoritative interaction check rather than turning this machine-specific
number into a CI gate.

Release-build Tauri QA passed on 2026-08-29. Initial open, external Markdown
updates, rapid saves, source rescan, source-switch isolation, synthetic/report
modes, restart identity/view restoration, and worker loading/structured-clone
console checks all behaved as expected. This records only the aggregate result;
no private vault identifiers, paths, content, queries, or screenshots are
retained.

Initialization/resync documents and large prepared report/catalog arrays are
split into bounded ordered structured-clone frames. Each frame retains protocol
version/request correlation, the receiving side validates order/completeness,
and both sides yield between frames. No JSON serialization, parsed documents,
engine object, full delta, source path, or identifier enters the result.

## KG12B2 W3 responsiveness evidence

`pnpm benchmark:dagre-worker -- --profile small` and `--profile medium` derive
production renderer topology from deterministic projections. Small is fully
expanded; medium uses a bounded 64-entity expansion. The harness compares the
same Dagre compute directly and through a warm Node worker, verifies exact
position equality, applies those positions through the production renderer
adapter, and probes the main event loop every 16 ms. Results are single-run
local evidence, not portable promises or CI thresholds.

Sequential runs on the KG12A machine on 2026-08-29 produced:

| Profile               |                Small |       Medium bounded |
| --------------------- | -------------------: | -------------------: |
| Projected nodes/edges |        1,700 / 2,000 |        6,640 / 7,182 |
| W3 nodes/edges        |          900 / 1,200 |        1,598 / 2,140 |
| Direct compute        |           1,644.8 ms |           4,271.9 ms |
| Worker compute        |           1,629.8 ms |           3,782.1 ms |
| Worker round trip     |           1,635.8 ms |           3,790.4 ms |
| Result apply          |               4.8 ms |              17.9 ms |
| Request → adoption    |           1,640.7 ms |           3,808.3 ms |
| Direct max/p95 gap    | 1,645.1 / 1,645.1 ms | 4,282.9 / 4,282.9 ms |
| Worker max/p95 gap    |       32.2 / 31.7 ms |       32.6 / 32.0 ms |
| High-gap reduction    |                51.1× |               131.2× |

The result separates two facts. Dagre wall time still exceeds the Class B
budget and remains structural-scale evidence for KG13. Moving it to W3 removes
the multi-second UI-thread stall: measured worker p95 gaps stayed at about the
32 ms Class A reference. Result application remains on main. An initial medium
sample exposed a 248.5 ms diagnostic-placement scan; indexing the first
incoming edge per diagnostic reduced the final sample to 17.9 ms while the
direct-versus-worker complete `RendererGraph` oracle stayed exact.

The A → B → C run terminates A and B after bounded 16 ms stale-CPU windows and
adopts only C. Worker-constructor restart measurements were 0.9–1.3 ms in the
sequential runs; C completed in 1,920.1 ms small and 4,267.3 ms medium rather
than waiting for A+B+C. Small supersession max/p95 gaps were 32.3/31.8 ms;
medium was 55.3/32.3 ms. The medium maximum is above the Class A p95 reference,
but no timing value is a CI gate and native interaction QA remains
authoritative.

The production Vite build emits a dedicated 49.88 kB W3 worker chunk. Dagre
algorithm markers occur only in that chunk. The main application chunk is
539.11 kB (161.41 kB gzip), down from the KG12B1 575.59 kB (174.57 kB gzip)
baseline because the synchronous algorithm is no longer included there. The
existing Vite large-chunk warning remains; KG12B2 does not treat that as a
reason to begin KG13 or add another cache or renderer.

Release QA exposed a separate W1 packaging defect: Vite selected a DOM-based
conditional export in the Markdown parser dependency graph, so the Dedicated
Worker evaluated `document.createElement` during initialization. The
worker-only resolver now selects the decoder's published worker-safe table and
the build rejects emitted workers containing DOM construction. That table
increases the W1 chunk from 243.01 kB to 271.64 kB; the W3 and main chunk sizes
above are unchanged. This is a correctness cost in the existing parser
dependency, not a new external package or W1/W3 coupling.

## Baseline findings

Values below are median / p95 in milliseconds. They are representative local
evidence, not portable promises.

| Work                         |             Small |                 Medium |                  Large |
| ---------------------------- | ----------------: | ---------------------: | ---------------------: |
| Parse/adapt                  |       49.9 / 70.1 |          502.7 / 570.9 |      2,497.5 / 3,083.2 |
| Resolve                      |       13.2 / 15.2 |          178.5 / 179.5 |      1,036.3 / 1,171.8 |
| Stable identity              |       36.0 / 45.4 |          393.0 / 433.0 |      2,684.1 / 3,570.3 |
| Report construction          |       15.3 / 20.4 |          346.9 / 484.3 |      1,132.0 / 1,450.1 |
| One-file KG10 update         |       66.5 / 79.1 |          574.9 / 579.5 |      5,176.1 / 5,428.2 |
| Projection workspace         |         5.8 / 7.0 |            41.9 / 44.8 |          390.2 / 400.2 |
| Documents-only `projectView` |       11.4 / 12.8 |            79.9 / 80.4 |          775.9 / 861.7 |
| Fully expanded `projectView` |       20.1 / 24.0 |          194.2 / 234.6 |      1,673.8 / 1,763.7 |
| Fully expanded mapping       |        8.0 / 13.3 |            55.4 / 58.0 |          521.6 / 636.1 |
| Documents-only Dagre         |       63.7 / 73.2 |  omitted (5,000 nodes) | omitted (24,000 nodes) |
| Fully expanded Dagre         | 1,234.4 / 1,368.3 | omitted (16,500 nodes) | omitted (82,000 nodes) |
| Inspection workspace         |        5.4 / 10.3 |            47.4 / 49.0 |          391.3 / 396.5 |
| Canonical search             |         0.2 / 0.3 |              2.0 / 2.8 |              8.1 / 9.0 |
| Entity subtree inspection    |         1.5 / 1.9 |            14.4 / 25.6 |          149.7 / 159.8 |
| Aggregated edge inspection   |         0.2 / 1.5 |              0.1 / 0.2 |              0.3 / 0.3 |

The important comparison is not “large is slow.” Whole-workspace W1 cost is
already multi-second before rendering, while bounded W2 focus and W4 selected
inspection remain materially smaller. W3 Dagre crosses the Class B boundary at
the small fully expanded scene and is the first structural-renderer cliff.

## Budgets

| Class | Boundary                                                  |   Median |      p95 |
| ----- | --------------------------------------------------------- | -------: | -------: |
| A     | Direct feedback: hover, selection, UI drawers, pan, zoom  |    16 ms |    32 ms |
| B     | Derived view: projection, layout, search, inspection      |   100 ms |   250 ms |
| C     | Workspace transaction: open, Markdown update, full rescan | 1,000 ms | 2,500 ms |

Class A interactions must normally perform no projection, renderer mapping, or
layout. Class B permits bounded derived work. Class C may expose progress and
exceed one frame, but transactional adoption must keep the last valid graph
visible. These are product decision budgets and benchmark annotations, not CI
wall-clock thresholds.

## Product interaction operation oracle

`packages/performance/src/interaction-contract.ts` covers I1–I18 exactly.

| Interactions             | Expected expensive path                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| I1                       | snapshot-scoped workspaces → projection → mapping → layout → highlight    |
| I2–I7                    | projection → mapping → layout → highlight; no workspace-index rebuild     |
| I8 hover                 | highlight only; no projection/mapping/layout                              |
| I9 select                | highlight + inspection; no projection/mapping/layout                      |
| I10 canonical search     | search only; no projection/mapping/layout                                 |
| I11 search/navigation    | projection/mapping/layout only when reveal changes the view               |
| I12 Inspector            | drawer state only; no projection/mapping/layout                           |
| I13 maximize, I14 resize | no derived rebuild                                                        |
| I15 pan/zoom             | semantic viewport observation only                                        |
| I16 Markdown, I18 rescan | transactional adoption then snapshot workspaces/projection/mapping/layout |
| I17 non-Markdown         | report adoption only; no canonical projection/mapping/layout              |

Pure renderer tests additionally prove that repeated hover/selection increments
highlight counts while mapping and layout stay at one prepared-graph run.

## Runtime and live correlation

Normal browser/Tauri use has no recorder and exposes no performance API. Add
`?performance=1` in a browser, or set `VITE_ICARUS_PERFORMANCE=1` before an
explicit diagnostic Tauri build, to opt in for one page lifetime. The build
variable changes only instrumentation availability; record whether the native
run is development or production. The local-only API is:

```text
window.icarusPerformance.interactions
window.icarusPerformance.begin("I2-expand")
window.icarusPerformance.finish()
window.icarusPerformance.snapshot()
window.icarusPerformance.reset()
```

Begin immediately before one production interaction, call `finish()` only when
an external resize/native automation needs an explicit next-paint mark, then
read the aggregate snapshot. The recorder measures GraphExplorer/GraphCanvas
commit-to-next-paint and phase/counter paths in memory. It does not use
localStorage, write files, upload telemetry, or retain private arguments.

KG11 live updates add a monotonically increasing controller-local correlation
token. The application begins I16/I17/I18, records source, worker-internal W1,
worker round-trip, main-thread high gap, identity persistence, total, and
existing UI-derived timings, adopts the report, and carries the token through
the matching graph commit and paint. The token is runtime-only and absent from
the machine-readable result schema.

The production build was checked both with and without the query flag. The
instrumented sample changed structural depth and maximized/restored normally;
the default URL reported instrumentation disabled and both paths had no console
warnings.

KG12B2 release QA passed the W3 interaction matrix and the rebuilt native
Open Vault path. A first release run exposed the DOM-based named-reference
decoder in W1; after the worker-only resolution fix, the release selected and
adopted a local Markdown workspace, rendered its graph, changed structural
depth, and expanded/collapsed nodes without a worker error. This verifies the
actual Tauri artifact and Vite worker chunks in addition to unit, benchmark,
browser, and Rust build evidence.

Manual Tauri development QA also passed the complete graph-control and
synthetic live-change checklist. One user-reported I18 Full Rescan sample
produced the following aggregate timings; the 250 ms watcher quiet window does
not apply to this explicit rescan:

| I18 development phase          |     Median |   p95/high |
| ------------------------------ | ---------: | ---------: |
| Source reconciliation          | 9,134.5 ms | 9,134.5 ms |
| KG10 workspace update          |   482.4 ms |   482.4 ms |
| Report construction            |     6.9 ms |     6.9 ms |
| Identity persistence           |    81.5 ms |    81.5 ms |
| Live transaction total         | 9,705.7 ms | 9,705.7 ms |
| Projection workspace           |     2.1 ms |     2.6 ms |
| `projectView`                  |     5.1 ms |     5.3 ms |
| Renderer mapping               |     2.3 ms |     2.4 ms |
| Dagre layout                   |   178.4 ms |   185.5 ms |
| Correlation start → next paint | 1,121.2 ms | 2,048.0 ms |

This is one development-mode observation, not a repeated production statistic.
React development behavior produced two workspace/projection/layout passes and
multiple commits, so its operation counts are not compared with the production
one-operation oracle. The total misses the Class C threshold because source
reconciliation dominates; KG10, report construction, persistence, projection,
and mapping together are much smaller. The UI remained responsive throughout.
The console contained the expected React development advisory and an unrelated
missing-favicon request, with no reported application failure.

## Bottleneck ranking

| Priority | Finding                                                                                                                                                                                                               | Consequence                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0       | None observed on the ordinary interaction surface.                                                                                                                                                                    | Direct manipulation and the complete manual UI matrix remained usable.                                                   |
| P1       | Dagre crosses the Class B p95 at the small top-level/bounded scenes; medium whole-workspace transactions block for hundreds of milliseconds; the observed explicit rescan spent 9.1 seconds in source reconciliation. | Addressed by separate W1/W3 workers; wall time remains explicit while last-valid state or progress stays visible.        |
| P2       | Fully expanded and large canonical stress profiles grow to multi-second projection/layout/workspace costs.                                                                                                            | Keep disclosure bounded and carry the quantified cliff into KG13; do not promise fully expanded large-vault interaction. |
| P3       | Search, aggregate edge inspection, highlighting, and renderer mapping at ordinary projected sizes are measurable but not dominant.                                                                                    | Retain instrumentation and existing memoization; add no optimization complexity now.                                     |

## Worker decision for KG12B

| Workload              | Decision           | Reason                                                                                                               |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| W1 KG10 + diagnostics | Complete in KG12B1 | Stateful sequential worker preserves the KG10 cache and KG11 prepare/persist/commit transaction.                     |
| W2 projection         | Keep main-thread   | Bounded/focus projections are smaller; existing memoization prevents unrelated interaction runs.                     |
| W3 Dagre              | Complete in KG12B2 | Stateless replacement-worker supersession prevents obsolete layouts from serially delaying the current projection.   |
| W4 inspection         | Keep main-thread   | Snapshot index is memoized and selected/search operations are bounded; retain instrumentation for large-tail review. |

KG12B1 uses versioned serializable requests/results, revision and candidate
guards, explicit worker errors, and exact direct-pipeline correctness oracles.
W1 cannot drop same-workspace results because its cache and durable catalog are
stateful. KG12B2 W3 instead uses latest-result-wins adoption, active worker
replacement, and stale layout rejection. The two workers remain independent;
no universal graph abstraction or KG13 renderer replacement is introduced.

## Cache decision

| Candidate                                       | Decision                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| KG10 parsed-document cache                      | Retain                                         |
| Snapshot-scoped projection/inspection `useMemo` | Retain                                         |
| Renderer mapping/layout `useMemo`               | Retain                                         |
| General `projectView` result cache              | Do not add without new evidence                |
| Cross-snapshot inspection/search cache          | Do not add; invalidation cost is not justified |

The React performance guidance reinforced the current narrow-subscription and
memoized-derived-data shape. KG12A adds measurement hooks without changing the
dynamic desktop imports or introducing re-rendering state in the recorder.

## Private real-vault evidence

Real-vault output must remain aggregate-only and ignored. The documented local
Icarus path was not present during this KG12A run, so no private baseline is
claimed and no substitute repository was used. When it is available, run the
existing aggregate-only KG10 validation plus the production browser/Tauri
runtime recorder; never commit a report, catalog, path, workspace name/ID,
source-derived query, heading, or screenshot. Synthetic small/medium/large
evidence remains the reproducible worker-decision basis.

## KG13A global renderer evidence

KG13A isolates WebGL rendering from network layout. The Node harness measures
real KG6 documents-only mapping and Graphology construction; the production
browser harness measures Sigma mount/render/interaction and the module-worker
ForceAtlas2 path. Values below are one local Windows/Chrome evidence set, not CI
thresholds.

| R1/R2 scene                | First render | 1% reconcile |             Worker layout | High RAF gap |
| -------------------------- | -----------: | -----------: | ------------------------: | -----------: |
| 1k nodes / 2k edges        |       6.5 ms |       9.7 ms | 637.4 ms / 100 iterations |      17.0 ms |
| 5k / 10k                   |      33.5 ms |      20.5 ms |           1,688.6 ms / 30 |      17.1 ms |
| 10k / 20k                  |      97.2 ms |      42.1 ms |           3,417.9 ms / 30 |      25.7 ms |
| 25k / 50k optional ceiling |     207.7 ms |     104.0 ms |          11,544.4 ms / 30 |      54.7 ms |

At 10k/20k, enabling edge interaction took a 104.9 ms process/render pass and
disabling it took 68.6 ms. Global edge events therefore remain off by default.
At product-small interaction scale, hover renders took 4.4/16.8 ms, selected
render 23.8 ms, animated search-center 191.0 ms, and animated pan/zoom 183.0 ms
with a 16.9 ms high RAF gap.

The actual KG6 documents-only profiles contain 600/599, 5,000/4,999, and
24,000/23,999 projected nodes/edges at small, medium, and large. Mapping medians
were 1.0, 5.5, and 77.9 ms; Graphology construction medians were 0.5, 4.7, and
62.8 ms. Synchronous R2 evidence is capped at 5,000 nodes: 100 small iterations
took 245.5 ms and 20 medium Barnes-Hut iterations took 1,370.1 ms. Interactive
work always uses the dedicated worker.

The optional 25k/50k ceiling proves rendering capacity, not a product promise.
Its 11.5-second layout rejects unconditional per-session recomputation at that
scale. An adopted KG13B must keep worker progress explicit and design a derived
layout cache outside canonical truth and KG9 state. The production candidate
bundle contains 256,526 JavaScript bytes across the 178,442-byte main chunk and
78,084-byte worker, plus 4,595 CSS bytes. The ordinary product bundle has no
Sigma dependency or chunk in KG13A.

The full candidate architecture, accessibility cost, product-value matrix, and
passing release Tauri gate are recorded in `docs/GLOBAL_RENDERER_DECISION.md`.

## KG13B1 production Global/Regional evidence

KG13B1 measures the extracted production implementation, not a fork of the
KG13A spike. The effective product projection is documents-only and
resolved-only unless reference-status filters were explicitly selected. The
stress rows retain the 1k/2k, 5k/10k, and 10k/20k renderer-input envelope.
Values below are local Windows/Node evidence recorded on 2026-08-31 and are not
CI timing thresholds.

| Profile | Product nodes/edges | Map median/p95 | Graphology build median/p95 | 1% reconcile median/p95 | Stress nodes/edges | Stress map median/p95 |
| ------- | ------------------: | -------------: | --------------------------: | ----------------------: | -----------------: | --------------------: |
| Small   |              100/99 | 0.217/0.299 ms |              0.102/0.121 ms |          0.067/0.139 ms |        1,000/2,000 |        1.209/1.963 ms |
| Medium  |             500/499 | 0.745/1.562 ms |              0.208/0.437 ms |          0.239/1.050 ms |       5,000/10,000 |        8.589/9.495 ms |
| Large   |         2,000/1,999 | 4.984/8.101 ms |              1.738/2.319 ms |          1.657/2.015 ms |      10,000/20,000 |      27.778/31.453 ms |

The production bundle keeps Sigma/Graphology in the first-use Global chunk and
ForceAtlas2 in its Worker. The extracted harness emitted 283,101 JavaScript
bytes across two JavaScript chunks plus 4,595 CSS bytes. The ordinary web build
emitted a 191.52 kB lazy Global chunk and an 85.07 kB Global Worker; inspection
of the initial Structure chunk found no Sigma, Graphology, or ForceAtlas2
module. These are uncompressed artifact sizes.

### Folder-prior comparison

The comparison holds semantic nodes/edges and iteration count constant. Option
A alternates short ForceAtlas2 chunks with bounded folder adjustments. Option B
applies one offset field after the reference layout.

| Product scale | Reference-only layout | Option A layout | Option B layout | Reference / A / B within-folder distance | Reference / A / B cross-reference length |
| ------------- | --------------------: | --------------: | --------------: | ---------------------------------------: | ---------------------------------------: |
| 100 nodes     |               14.8 ms |          5.6 ms |          4.5 ms |                    28.42 / 27.16 / 28.42 |                    29.88 / 30.80 / 38.01 |
| 500 nodes     |               96.0 ms |         80.0 ms |         77.6 ms |                 117.77 / 112.69 / 117.77 |                 115.93 / 118.05 / 176.30 |
| 2,000 nodes   |              201.4 ms |        177.6 ms |        157.8 ms |                 256.93 / 248.91 / 256.93 |                 278.84 / 270.53 / 244.56 |

Option A is selected for product behavior. It consistently improves
within-folder cohesion while retaining continuously competing reference
forces; Option B does not improve within-folder cohesion and showed much larger
cross-reference distortion at the 100/500-node evidence points. Folder
clustering changes positions only—Graphology semantic edge counts remain
identical.

An exact memory-cache lookup measured 0–0.002 ms. Changed settings or one
folder assignment reused all surviving coordinates as warm seeds before
background relaxation; mean displacement after a one-folder move was 1.13,
1.02, and 26.24 units at 100, 500, and 2,000 nodes respectively. The cache is
bounded, page-memory-only, and never stores canonical or source data.

The deterministic Global interaction oracle requires ordinary zoom, pan,
hover, selection, and Inspector changes to perform zero KG6 projections, zero
Graphology reconciliation, and zero layout requests. Zoom may update reducer
styling when its camera ratio crosses far/regional/near thresholds. Projection,
folder assignment, settings, source topology, and explicit Re-layout are the
only current layout triggers; the latest-only Worker terminates obsolete work.

Production browser and release Tauri validation passed Global lazy activation,
WebGL rendering, clustering Off/On, presets/Custom, far↔Regional↔near zoom,
mouse and physical precision-touchpad input, Search/Inspector/Structure
handoff, history/restart persistence, live folder/source updates, Rescan, and
worker/CSP boundaries. Release QA found one camera-ordering defect: an entry
anchor could be applied to seed positions before the background coordinates
rendered, allowing the graph to move out of view at commit. Center/Fit requests
now wait for Sigma's matching `afterRender`; both first-worker and exact-cache
Structure→Global transitions passed the repeated release check without manual
Fit.
