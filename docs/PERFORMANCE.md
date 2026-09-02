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
the ordinary `projectView` path plus product `projectStructureView` for Focus
scenarios, React Flow mapping, Dagre, search, and inspection. It records
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

## PERFQ1A query-projection evidence

PERFQ1A isolates QUERY1 evaluation from the larger query-driven projection
path. On the medium synthetic snapshot (8,500 canonical entities and 16,000
references), the broad QUERY1 evaluator itself measured 1.844 ms median before
the change. That is below the 10 ms evaluator gate, so its parser/evaluator was
left unchanged. The expensive path was derived graph work: the pre-change
instrumented broad query built and filtered a second candidate projection,
scanned 32,000 canonical references, and sorted filtered nodes/edges twice.

The canonical path/kind/QUERY1 candidate route now prepares filters once and
computes DISC1 eligibility directly from visible plus one-action candidate
entities. Its deterministic operation result is one base projection, 16,000
reference scans, one direct candidate plan, zero candidate base builds, zero
hierarchy rebuilds, and zero filter node/edge sorts. Projected-text filtering
retains one explicitly measured legacy candidate fallback because raw
diagnostic targets are projection-only. Reference-status filtering remains
parallel and does not alter candidate entity eligibility.

Exactness is not inferred from timing. A wide direct-versus-legacy candidate
oracle covers structural depths, manual expansion/collapse, Blocks, heading
limits, valid/invalid paths and queries, Boolean QUERY1, kinds, and status
combinations. A separate byte oracle fixes eleven complete projection outputs
from pre-PERFQ1A main, including Focus, projected text, diagnostic provenance,
and invalid inputs. Local and Structure Focus suites remain part of the normal
projection regression run.

Validation also exceeded its evidence gate. Replacing validation-only copied
array sorts/JSON comparisons with equivalent adjacent/element scans reduced the
first sequential medium no-filter validation median from 203.011 to 163.018 ms
and broad-query validation from 180.529 to 155.029 ms. All shape, ordering,
canonical membership, endpoint, provenance, diagnostic, and Focus invariants
still run on every final projection. The reductions are 39.993 and 25.500 ms,
respectively, satisfying the absolute 15 ms gate without changing accepted
output.

Wall-clock values remain noisy local evidence. The untouched general medium
depth-three advanced-query baseline was 878.700 / 1,057.116 ms median/p95. In
the focused instrumented harness, the comparable pre-change run was 497.695 /
503.987 ms; the first sequential post-change run was 413.648 / 429.836 ms. A
later loaded-machine rerun was 612.592 / 701.878 ms while its no-filter control
also moved from 322.279 to 562.103 ms, so deterministic operation deltas—not
that cross-load timing pair—are the regression gate. Small broad-query evidence
remained within Class B at 37.534 / 43.824 ms.

The first post-change repeated sequence remained above the stronger 50 ms
target:

| Transition | Project median / p95 | Base median | Filter median | Direct DISC1 median | Validation median |
| ---------- | -------------------: | ----------: | ------------: | ------------------: | ----------------: |
| A          | 302.564 / 346.728 ms |  125.038 ms |     42.983 ms |            6.693 ms |        120.271 ms |
| B          | 200.787 / 235.804 ms |  162.225 ms |     28.444 ms |            2.283 ms |          0.018 ms |
| C          | 263.846 / 273.987 ms |  123.592 ms |     33.994 ms |            4.256 ms |        105.428 ms |
| Clear      | 269.661 / 316.178 ms |  133.792 ms |      0.016 ms |            0.000 ms |        137.942 ms |
| A          | 415.954 / 550.916 ms |  158.264 ms |     65.827 ms |           10.515 ms |        181.467 ms |

Medium QUERY1 therefore still misses Class B and repeated query changes miss
50 ms. The first structural base accounts for roughly 40–50% of representative
repeated transitions, so the evidence recommends a separate PERFQ1B evaluation
of a prepared structural projection cache. PERFQ1A adds no cache and no W2
worker; W2 remains on the main thread until that algorithmic/cache decision is
tested against merged code. Timing is never a CI gate.

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

## KG13B2A bounded Local Free evidence

Local profiles describe the projected neighborhood itself rather than a large
vault whose focus happens to be small. The small fixture contains one root,
ten neighbor files, root headings, modest resolved references, and diagnostic
targets. Medium contains 51 files plus disclosed hierarchy and blocks for 381
nodes/430 edges. Stress targets roughly one thousand projected entities and is
an explicit safety profile, not the default product target.

Values below are local Windows/Node evidence recorded on 2026-09-01. They are
median/p95 milliseconds and never CI thresholds. ForceAtlas2 is measured with
the same plain request/compute path used inside the dedicated Worker; browser
paint and RAF behavior remain runtime evidence.

| Work                         | Small (25 nodes / 34 edges) | Medium (381 nodes / 430 edges) | Stress (1,101 nodes / 1,175 edges) |
| ---------------------------- | --------------------------: | -----------------------------: | ---------------------------------: |
| Bounded KG6 Local projection |               0.919 / 1.517 |                 3.195 / 10.401 |                      6.745 / 6.745 |
| Local topology mapping       |               0.016 / 0.187 |                  0.632 / 0.747 |                      0.687 / 0.687 |
| Deterministic seed placement |               0.089 / 0.165 |                  0.709 / 1.508 |                      2.295 / 2.295 |
| Graphology construction      |               0.145 / 0.315 |                  0.295 / 0.471 |                      1.067 / 1.067 |
| ForceAtlas2 compute          |               1.085 / 1.278 |                46.801 / 48.619 |                  107.859 / 107.859 |
| Refined-position apply       |               0.012 / 0.023 |                  0.172 / 0.716 |                      0.208 / 0.208 |
| Disclosure reconciliation    |               0.165 / 0.369 |                  0.621 / 1.351 |                      1.208 / 1.208 |
| Exact layout-cache hit       |               0.001 / 0.003 |                  0.034 / 0.163 |                      0.028 / 0.028 |

The seed path—projection, mapping, seed, and graph construction—is comfortably
inside Class B in these bounded profiles and does not wait for ForceAtlas2.
Medium and stress refinement are material enough to remain off-main but not a
reason to precompute. KG13B2A therefore rejects speculative per-file projection/layout
warming: it would add background CPU and invalidation without evidence that the
immediate deterministic scene is late. The only Local cache is the six-entry,
page-memory exact-layout LRU; changed topology warm-seeds surviving coordinates.

Production instrumentation adds `local-projection`, `local-map`, `local-seed`,
`local-sigma-mount`, `local-layout-worker`, `local-layout-apply`,
`local-visual-lod`, `local-hover`, `local-selection`, `local-center`,
`global-to-local-transition`, and `local-to-global-transition`, with matching
aggregate operation counts. It records no entity ID, path, query, source text,
layout coordinate, or transition point.

The Local operation oracle requires zoom, pan, hover, selection, and Inspector
activity to perform zero KG6 projections, zero Graphology topology
reconciliations, and zero layout requests. A disclosure or focus change may run
one Local semantic update/layout while producing zero Global topology/layout
work and leaving the Global exact-layout cache valid. Semantic LOD changes only
Sigma reducers. Both Sigma presentations retain the accepted precision-wheel
gain of `0.0017`.

Production browser QA covered fresh Structure startup, direct persisted-Local
restore, Global → Local entry, exact-cache re-entry, explicit worker
refinement, disclosure, hop/direction changes, same-document navigation,
cross-document rerooting, semantic history, Structure recovery, and both
trackpad modes. It found two ordering/ownership defects before release QA:
Sigma display coordinates had been converted as raw graph coordinates during
the transition, and Local styling depended on a prior Global import. Framed
coordinate conversion now preserves the root viewport point through worker
adoption, and Local imports the shared stylesheet at its own lazy boundary.
Follow-up QA found another one-frame ordering defect: hop changes and
Global↔Local history could expose Sigma's new graph normalization with the old
camera before a post-render anchor or Fit returned it. Exact cached positions
and semantic viewports now warm the first draw, reconciliation restores its
anchor in `afterProcess`, Local hop/direction changes do not auto-fit, and
one-shot transition/Fit intents are cleared after consumption. The repeated
production run kept the graph visible without Fit and emitted no console
warning or error.

Run the aggregate profiles with:

```bash
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium
pnpm benchmark:local-renderer -- --profile stress
```

## KG13B2B Local Structured evidence

Local Structured consumes the exact KG13B2A bounded projection. The benchmark
therefore measures a second presentation of the same 25/34 small, 381/430
medium, and 1,101/1,175 stress scenes rather than creating a separate semantic
workload. Values below are local Windows/Node evidence recorded on 2026-09-01.
They are median/p95 milliseconds and never CI thresholds; stress has one
sample. Browser first/refined paint, W3 round trip, and main-thread gaps remain
runtime evidence rather than invented Node proxies.

| Work                               | Small (25 / 34) | Medium (381 / 430) | Stress (1,101 / 1,175) |
| ---------------------------------- | --------------: | -----------------: | ---------------------: |
| Compact React Flow mapping         |   0.090 / 0.166 |      0.702 / 1.067 |          2.474 / 2.474 |
| Deterministic schematic seed       |   0.020 / 0.050 |      0.397 / 1.381 |          0.997 / 0.997 |
| Existing focus-mode Dagre baseline |   6.871 / 8.203 |    81.574 / 83.399 |      344.228 / 344.228 |
| Explicit Local Structured Dagre    |   7.836 / 9.760 |    90.792 / 91.427 |      372.285 / 372.285 |
| Refined apply + root normalization |   0.026 / 0.060 |      0.225 / 0.418 |          0.985 / 0.985 |
| Exact Structured cache hit         |   0.008 / 0.016 |      0.077 / 0.086 |          0.253 / 0.253 |
| Free → Structured mapping + seed   |   0.103 / 0.131 |      1.289 / 1.327 |          3.374 / 3.374 |
| Structured → Free mapping + seed   |   0.040 / 0.054 |      0.473 / 0.497 |          1.124 / 1.124 |
| Disclosure compact mapping         |   0.080 / 0.086 |      0.730 / 0.749 |          1.844 / 1.844 |
| Disclosure schematic seed          |   0.019 / 0.041 |      0.184 / 0.190 |          0.593 / 0.593 |

The explicit `local-structured` W3 mode is intentionally independent from
general focus layout: left-to-right `network-simplex`, 22-unit node separation,
58-unit rank separation, and 20-unit margins suit the compact schematic nodes.
It costs roughly 11% more than the focus baseline at medium scale and 8% at
stress, which is acceptable because the deterministic seed is immediate and
the full Dagre calculation remains in the existing W3 Worker. The explicit
mode can now be tuned without changing general Structure/Focus geometry.

An exact Structured fingerprint includes mode/version, renderer node IDs and
dimensions, and edge IDs/endpoints/kinds. It excludes selection, hover,
Inspector, camera, source body, and query text. The bounded page-memory cache
skips W3 on an exact hit; otherwise the complete finite O(nodes + edges) seed
is usable while only the latest W3 request refines it. A worker failure retains
the seed/cache instead of invoking synchronous Dagre.

The layout-toggle oracle records zero Local projection calls, zero Global
projection calls, zero Global layout calls, and zero workspace transactions;
a cache miss permits at most one active W3 layout. Disclosure may create one
latest Local Structured layout and continues to require zero Global layout.
The same operation boundary applies to Local heading live updates, preserving
the documents-only Global topology.

Production browser validation covered lazy Free → Structured → Free switching,
compact node and edge grammar, exact edge inspection and its announced
Free-switch clearing policy, node-selection retention, pointer and keyboard
disclosure, Focus and Search rerooting, QUERY1 filter retention, Structure
handoff/history return, Back to Global, reload into saved Local Structured,
zoom/Fit, and Inspector. It found and corrected one integration omission:
Structured double-click Focus initially selected a node without invoking the
existing Local navigation planner. The final build routes that gesture through
the shared planner and reroots while retaining Structured. The repeated matrix
reported no console warnings or errors. Final release desktop QA passed vault
opening, Free/Structured switching, disclosure, Search/Inspector, Back/Forward,
live heading and root-file changes, Rescan, restart restoration, and physical
precision-touchpad input in both layouts without worker/module/CSP errors.

## GROUP1A Visual Group evidence

GROUP1A classification is deliberately downstream from an already completed
projection. Definitions compile once when they change; presentation assignment
is `O(visible entities × enabled groups × bounded QUERY1 AST)` with a
first-match short circuit; renderer updates consume only an `EntityId` map.
There is no durable membership cache. `projectView()` accepts no group input,
so the existing depth-three advanced-query projection workload and its
operation path remain unchanged.

`pnpm benchmark:visual-groups` uses synthetic 300-entity and 3,000-entity
visible sets with 4 and 8 enabled groups. It measures compile, primary-map
assignment, and renderer-style lookup separately, with projection excluded.
The following local Windows/Node values were recorded on 2026-09-01 as
median/p95 milliseconds; they are investigative evidence, not CI thresholds.

| Visible entities / groups |       Compile |   Primary map |  Style update |
| ------------------------: | ------------: | ------------: | ------------: |
|                   300 / 4 | 0.011 / 0.034 | 0.100 / 0.330 | 0.016 / 0.068 |
|                   300 / 8 | 0.024 / 0.080 | 0.066 / 0.154 | 0.004 / 0.005 |
|                 3,000 / 4 | 0.011 / 0.058 | 0.467 / 0.960 | 0.059 / 0.156 |
|                 3,000 / 8 | 0.014 / 0.092 | 1.013 / 1.300 | 0.042 / 0.055 |

Every benchmark case reports `projectView +0`, topology mapping/reconciliation
`+0`, layout requests `+0`, and one style update. Renderer tests enforce the
same boundary directly: React Flow group context is absent from mapping, W3
input, Local Structured fingerprints, and dimensions; Global and Local Sigma
session setters schedule one partial, skip-indexation reducer refresh without
reconciling Graphology or touching a layout service.

GROUP1B preserves that boundary in the product session. The registry array is
the sole compile dependency, the canonical lookup is snapshot-scoped, and the
presentation map depends only on the current completed projection, lookup, and
compiled definitions. Draft typing remains local to the Groups component and
does not compile, persist, project, map, reconcile, center, Fit, or request
layout. A committed mutation changes only the registry/compiled evaluator/map;
all four renderer seams consume the resulting style-map identity using the
existing GROUP1A partial-style paths. The existing `benchmark:visual-groups`
profiles remain the reproducible evidence; GROUP1B adds no new timing threshold
or external dependency.

## PRE-KG14A2 Structure Focus evidence

The performance harness now sends its Focus scenarios through the same
`projectStructureView` entry used by the product. That call contains a bounded
documents-only membership pass plus detailed root-scoped disclosure, but remains
one user-visible projection operation and requests only the matching W3 layout.
It performs zero Global projection/layout, Local layout, or workspace work.

Default small and medium profiles passed on 2026-09-01. The optimized medium
Focus results below are median/p95 milliseconds; they are investigative local
evidence rather than CI thresholds.

| Scenario        | Nodes / edges | Product projection |  Mapping |   Dagre |
| --------------- | ------------: | -----------------: | -------: | ------: |
| One-hop Focus   |       11 / 10 | 132.75 / 145.55 ms |  0.03 ms | 1.66 ms |
| Three-hop Focus | 5,000 / 4,999 | 170.15 / 199.63 ms | 10.37 ms | omitted |

The documents-only pass deliberately skips DISC1 candidate-count work because
membership consumes no disclosure controls. The detailed pass still produces
truthful actionable counts inside the fixed neighborhood. Both medium
projections remain inside the existing Class B 250 ms p95 budget, so no new
projection cache or Worker boundary is justified.

## PRE-KG14A4 hierarchy density and folder strength evidence

PRE-KG14A4 changes card density without changing either hierarchy projection or
Dagre mode. The performance harness now measures All Structure with the compact
schematic dimensions, while the Local Structured harness measures Focus with
extended dimensions. Local Windows/Node medians/p95 values recorded on
2026-09-02 are investigative evidence, not CI thresholds.

| Work                                     |             Small |             Medium |
| ---------------------------------------- | ----------------: | -----------------: |
| All documents-only compact mapping       |     0.992 / 1.067 |    11.509 / 12.938 |
| All documents-only Structure Dagre       |   35.724 / 40.821 | omitted (5k nodes) |
| All fully expanded compact mapping       |     2.269 / 2.876 |    57.529 / 60.997 |
| All fully expanded Structure Dagre       | 523.447 / 566.050 |    omitted (16.5k) |
| Focus extended mapping                   |     0.048 / 0.086 |      0.226 / 0.276 |
| Focus deterministic structured seed      |     0.020 / 0.051 |      0.056 / 0.076 |
| Focus Local Structured worker-equivalent |     5.113 / 7.693 |    23.440 / 27.054 |

Compact All dimensions do not add mapping or layout work; they reduce the
geometry supplied to the existing W3 request. Extended Focus remains comfortably
inside Class B on the current bounded small (13 nodes/22 edges) and medium (61
nodes/110 edges) profiles. The exact Local Structured fingerprint includes the
new dimensions, so old compact-Focus coordinates miss rather than being reused.

The stronger compact/normal/spacious folder-cohesion presets are `0.09` /
`0.08` / `0.07`. With normal `0.08`, the selected chunked prior reduced mean
within-folder distance from 28.421 to 26.137 at small and 117.770 to 108.527 at
medium. Mean cross-folder reference length remained finite and moved from
29.883 to 33.124 and 115.933 to 128.837 respectively: grouping is more visible,
but reference attraction still participates rather than being replaced by
rigid clusters. Tests separately cover finite deterministic 0%/100%, unchanged
semantic edges, custom round-trip, Off retention, and spacing-preserved strength.

The application operation oracle permits one immediate layout request only for
All + Network. All + Hierarchy, Focus + Network, and Focus + Hierarchy defer the
preference with zero KG6 projection and zero active hierarchy W3 work. Rapid
input uses the existing Global worker client, which terminates superseded work
and adopts only the latest response; no timer, backlog, or dependency was added.
