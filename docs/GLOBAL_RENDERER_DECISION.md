# Global renderer decision

Status: **ADOPTED — Global/Regional and bounded Local Free/Structured are
production-validated; KG13 is complete.**

Sections 2–18 retain the KG13A decision evidence. KG13B1's production
follow-through is recorded in Section 20/ADR 0013; KG13B2A Local isolation is
recorded in Section 21/ADR 0014.

## 1. Decision

The evidence supports a narrow final decision:

```text
React Flow + Dagre = Structure
Sigma + Graphology = Global
```

The decision is **ADOPT** for a documents-only Global mode. Structure remains
the sole hierarchical/detail renderer. KG13B1 implements the initial lazy
`Structure | Global` entry point, far/Regional/near style LOD, explicit
per-session WebGL unavailability, and no huge React Flow fallback.

## 2. Product role

The product hypothesis is supported by the clustered stress scene:

- **Structure** answers “what is inside this file and how do exact headings,
  blocks, references, disclosure, focus, and provenance relate?”
- **Global** answers “where are the file-level clusters, hubs, bridges, and
  isolates, and which file should I inspect or open in Structure?”

The ForceAtlas2 scene made twelve deterministic clusters, cross-cluster bridges,
hubs, and deliberately isolated files visible at 1,000 nodes. Reproducing file,
heading, or block cards in WebGL would weaken both modes; the first Global mode
should remain file-oriented.

## 3. Candidate research

Package registry metadata and installed declarations were checked on 2026-08-30.

| Candidate              |           Checked version | License | Result                 |
| ---------------------- | ------------------------: | ------- | ---------------------- |
| Sigma                  |              3.0.3 stable | MIT     | Primary candidate      |
| Graphology             |                    0.26.0 | MIT     | Derived renderer graph |
| React Sigma            |                     5.0.6 | MIT     | Not used               |
| Graphology ForceAtlas2 |                    0.10.1 | MIT     | R2 layout candidate    |
| PixiJS                 |                    8.20.1 | MIT     | No prototype           |
| Cytoscape.js           |                    3.34.2 | MIT     | No prototype           |
| Sigma v4               | 4.0.0 alpha/beta channels | MIT     | Not adopted            |

[Sigma's current documentation](https://www.sigmajs.org/docs/) identifies the
stable line as a WebGL graph renderer for thousands of nodes/edges built on
Graphology and separately calls v4 an alpha. [Sigma graph-data guidance](https://www.sigmajs.org/docs/advanced/data/)
supports reducers for highlight-only presentation without mutating Graphology,
and [its lifecycle guidance](https://www.sigmajs.org/docs/advanced/lifecycle/)
supports scheduled render/refresh and explicit cleanup.

Direct Sigma is the better ownership boundary. [React Sigma documents](https://sim51.github.io/react-sigma/docs/start-introduction/)
that graph/settings prop changes kill and recreate the instance, restoring the
camera afterward. The spike instead keeps one imperative renderer session and
reconciles its Graphology graph by stable key.

PixiJS remains a general 2D engine, so Icarus would own graph picking, camera,
labels, reducers, and lifecycle. Cytoscape was not prototyped because its
[published WebGL preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/)
describes provisional APIs and rendering limitations. Neither justified a second
full prototype after Sigma passed the required surface.

## 4. Candidate architecture

The KG13A evidence originated in `tools/global-renderer-spike`:

```text
ViewProjection
  → plain stable-key mapping
  → derived MultiDirectedGraph
  → direct Sigma session
       ├─ reducers: hover / selection / status
       ├─ DOM search + Inspector callbacks
       └─ ForceAtlas2 request → dedicated worker → derived positions
```

KG13B1 moved this implementation into `packages/renderer-sigma`; the harness
now consumes that production package and keeps only synthetic fixtures,
controls, and aggregate evidence. The production package has
no dependency on core truth, source adapters, parsers, diagnostics construction,
KG10, Tauri APIs, React Flow, or Dagre. Graphology is replaceable renderer state.

Mapping preserves every projected key, aggregated `referenceIds.length`, entity
ID, resolution status, and projection issue. Duplicate keys or missing endpoints
throw actionable errors. Deterministic FNV-derived non-zero positions exist only
as benchmark/layout seeds.

## 5. Renderer-only performance

Production browser values are one local evidence set, not CI thresholds.

| Scene     | First `afterRender` | 1% full replace | 1% reconcile | 30-iteration worker layout | High RAF gap |
| --------- | ------------------: | --------------: | -----------: | -------------------------: | -----------: |
| 1k / 2k   |              6.5 ms |         14.4 ms |       9.7 ms |  637.4 ms (100 iterations) |      17.0 ms |
| 5k / 10k  |             33.5 ms |         70.1 ms |      20.5 ms |                 1,688.6 ms |      17.1 ms |
| 10k / 20k |             97.2 ms |        149.7 ms |      42.1 ms |                 3,417.9 ms |      25.7 ms |
| 25k / 50k |            207.7 ms |        383.0 ms |     104.0 ms |                11,544.4 ms |      54.7 ms |

The 25k case was optional and remained operational, but it exceeds direct-
feedback expectations and is not a first-release promise. Search and Inspector
selection still worked while its layout worker ran.

The product-small interaction sample (309 displayed fixture nodes/1,200 edges)
recorded 55.7 ms constructor/mount, 5.0 ms first render, 4.4/16.8 ms hover
renders, 23.8 ms selected render, 191.0 ms animated search-center, and 183.0 ms
animated camera pan/zoom with a 16.9 ms high RAF gap. Intentional 180 ms camera
animation is included in the center/pan duration.

## 6. Edge and label evidence

At 10k/20k, turning edge events on caused a 104.9 ms processing/render pass;
turning them off took 68.6 ms. Global should therefore leave edge interaction
off by default. Exact edge provenance remains accessible through the selected
file's outgoing/backlink Inspector lists; an explicit later edge-inspection mode
may opt in.

Adaptive labels use Sigma density/grid/size thresholds. They hide while moving,
do not render edge labels, and force only hovered/selected node labels. This
keeps the overview legible without attempting React Flow cards.

## 7. Layout evidence

[Graphology's ForceAtlas2 documentation](https://graphology.github.io/standard-library/layout-forceatlas2.html)
requires initial `x`/`y`, supplies inferred settings, supports Barnes-Hut, and
offers a worker utility. The spike uses deterministic stable-ID seeds, inferred
settings, and Barnes-Hut from 1,000 nodes. The browser/Tauri path uses an explicit
module worker; the Node-only R2 oracle is synchronous solely to isolate layout
wall time.

Actual KG6 product projections produced:

| Profile | Projected nodes / edges | Mapping median | Graphology build median |                            R2 layout |
| ------- | ----------------------: | -------------: | ----------------------: | -----------------------------------: |
| Small   |               600 / 599 |         1.0 ms |                  0.5 ms |            245.5 ms / 100 iterations |
| Medium  |           5,000 / 4,999 |         5.5 ms |                  4.7 ms |           1,370.1 ms / 20 iterations |
| Large   |         24,000 / 23,999 |        77.9 ms |                 62.8 ms | Omitted above the 5k synchronous cap |

Large product projections are dominated by projection-only diagnostic targets
(22,000 of 24,000 nodes), which KG13B must address using existing KG6 resolution
filters rather than a renderer-owned graph policy.

Recompute-per-session is acceptable up to the medium evidence with a visible
progress state. It is not acceptable at the 25k ceiling. KG13B should design a
separate derived layout cache keyed by stable workspace plus projection/layout
fingerprint, retain an in-memory result immediately, and evaluate private local
persistence separately. It must not store raw Sigma camera/coordinates in
canonical truth or KG9 view state.

## 8. Browser and Tauri evidence

Production browser QA passed Chrome/WebGL startup, mapping, mount/afterRender,
pan/zoom, hover, selection, search-center, label toggling, edge-event toggling,
1%/10% updates, destroy/recreate, semantic bookmark capture, and ForceAtlas2
worker execution through 25k/50k. There were no console warnings or errors.

The release Tauri harness builds successfully from the explicit diagnostic
config. The first graphical run passed WebGL, layout-worker, update,
destroy/recreate, search, Inspector, mouse, and keyboard/accessibility checks,
but exposed imprecise delicate touchpad zoom. Sigma 3.0.3 reduces every
non-zero wheel delta to one animated step and suppresses closely spaced steps;
the spike now intercepts that event, applies every bounded delta directly with
a 0.5-pixel visible floor, and rejects immediate direction-flip inertia inside
one 90 ms input stream. Release retesting confirmed the correction and all
graphical gates; the final accepted calibration keeps the same no-dead-zone and
inertia behavior with a gentler `0.0017` continuous gain.

WebGL initialization is a hard gate. Constructor/worker failures show an
explicit error, disable misleading controls, and do not produce a
success-shaped empty graph.

## 9. Accessibility

The WebGL scene is deliberately `aria-hidden` and has no false keyboard graph
tree. Global is a visual overview, never the only representation of knowledge.
The harness proves:

- a skip link bypasses the scene;
- labelled native controls remain keyboard reachable;
- DOM search finds a file by label or stable ID;
- a search result selects and centers the visual node;
- the DOM Inspector exposes type, stable/canonical identity, location, status,
  and an explicit Structure-handoff feasibility action;
- status and async failures use live regions;
- reduced-motion preference removes camera animation duration;
- focus remains in ordinary controls and is never trapped by canvas.

This is not parity with Structure's DOM-backed graph. The accessibility cost is
acceptable only because Structure, search, and Inspector retain all meaningful
information and actions.

## 10. Stable identity and live updates

Graphology keys are exact projection IDs, never indexes, labels, paths, or source
offsets. Tests cover node add/remove, reference-only changes, filtered projection
updates, and position preservation. Selection survives reconciliation when its
stable key remains and clears only when that key disappears.

SPATIAL1A retains this automatic topology/layout contract and adds a post-layout
presentation layer: exact-folder normalized anchors translate displayed
clusters while the worker and memory cache continue to consume and store only
automatic positions. Raw positions still do not persist.

At medium actual-product scale, 10% mutation had a 9.3 ms median versus 13.3 ms
for full rebuild. At large scale, 1% mutation had a 37.5 ms median versus 56.0 ms
full rebuild. Small graphs may rebuild faster, but KG13B should reconcile in
place to preserve the mounted Sigma instance, camera, selection, and layout.

## 11. Viewport feasibility

The spike converts the viewport center to graph coordinates, finds the nearest
visible canonical entity, and emits stable entity ID plus Sigma camera ratio.
This generalizes the current semantic-anchor idea but not its numeric zoom unit.
KG13B should keep renderer-mode-specific zoom/ratio data while sharing the
canonical anchor. Structure ↔ Global handoff can preserve context around the
selected entity. Raw Sigma camera `x`/`y` remain transient.

## 12. Bundle and dependencies

The diagnostic production build emits 256,526 JavaScript bytes across two
chunks: a 178,442-byte main renderer chunk and a 78,084-byte ForceAtlas2 worker,
plus 4,595 CSS bytes. Main JavaScript gzip is 44.5 kB. No general React wrapper
or second renderer framework was added.

Dependencies remain pinned. KG13B1 emits Sigma/Graphology in a literal lazy
Global chunk and ForceAtlas2 in a dedicated Global worker; the Structure startup
chunk does not execute those libraries. The KG13A harness also consumes the
same production package rather than carrying duplicate dependencies.

## 13. Product-value matrix

| Dimension                       | Rating                 | Evidence                                                                  |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------- |
| A. Overview usefulness          | Strong positive        | Cluster/hub/bridge/isolate scene reveals a task Structure does not serve. |
| B. Density advantage            | Strong positive        | 10k/20k first render 97.2 ms; optional 25k/50k remains usable.            |
| C. Interaction fit              | Positive               | Small Class A paths pass; 10k worker high gap 25.7 ms.                    |
| D. Search/Inspector integration | Strong positive        | Stable-ID search, center, DOM Inspector, handoff all demonstrated.        |
| E. Live-update fit              | Positive               | In-place stable-key reconciliation preserves instance/camera/positions.   |
| F. Accessibility cost           | Negative, non-blocking | Canvas is visual-only; DOM search/Inspector and Structure are required.   |
| G. Layout cost/stability        | Negative               | 25k settles in 11.5 s; derived caching/progress are required.             |
| H. Implementation complexity    | Negative               | A second lifecycle, worker, cache, and fallback need ownership.           |
| I. Bundle/dependency cost       | Neutral                | 257 kB diagnostic JS, isolatable behind an on-demand mode.                |
| J. Browser/Tauri reliability    | Positive               | Production browser and release Tauri manual gates pass.                   |

## 14. Structural-mode comparison

React Flow remains superior for hierarchy readability, disclosure, file/heading
cards, exact provenance affordances, and DOM accessibility. W3 already protects
its direct responsiveness while Dagre computes. Sigma is superior for a visual
network overview at several thousand items and should not inherit structural
cards, heading disclosure, or block interactions.

The modes are complementary, not interchangeable.

## 15. Decision gate

| Hard gate                    | State                                               |
| ---------------------------- | --------------------------------------------------- |
| Clear product task           | Pass                                                |
| Density advantage            | Pass                                                |
| Class A interaction          | Pass through target 10k; 25k is an optional ceiling |
| Renderer independence        | Pass                                                |
| Stable identity              | Pass                                                |
| Search/Inspector integration | Pass                                                |
| Accessibility fallback       | Pass                                                |
| Tauri/browser reliability    | Pass                                                |
| Layout feasibility           | Pass with worker/progress/cache constraint          |
| Complexity proportionality   | Pass narrowly for documents-only Global             |

## 16. Files changed

- isolated `tools/global-renderer-spike` candidate and tests;
- aggregate-only `benchmark:global-renderer` command;
- explicit diagnostic Tauri build config/command;
- decision, performance, architecture, roadmap, and folder-map documentation;
- pinned lockfile entries for three MIT candidate packages.

## 17. Tests and validation

Automated checks cover projection mapping, stable identifiers, aggregated
provenance, loud invalid-input failure, deterministic positions, neighborhood
indexing, node add/remove, reference-only/filter updates, and in-place position
retention. Precision-wheel tests cover unit normalization, the visible floor,
gentle gain, same-direction fine input, opposite inertia rejection, and the
quiet-gap reversal path. Smoke/small/medium/large and optional 25k benchmark
paths pass. Repository-wide checks and final release QA pass.

## 18. Privacy

All committed fixtures and reported values are synthetic and aggregate-only.
No report files, paths, workspace IDs/names, queries, source text, screenshots,
catalogs, or graph topology from a private vault are committed. The documented
private Icarus vault was not available, and no substitute private repository was
used.

## 19. Roadmap

`KG13 — Complete`, `KG13A — Complete`, `KG13B1 — Complete`,
`KG13B2A — Complete`, `KG13B2B — Complete`, `KG14 — Next`.
This decision does not begin KG14.

## 20. KG13B1 production follow-through

KG13B1 implements a lazily loaded `Structure | Global` documents/files mode:

- reuse KG6 projection/filter/focus and KG8 Inspector/search/navigation;
- use direct Sigma with one app-owned lifecycle and stable-key reconciliation;
- keep edge events off by default and use selected-node relationship lists;
- provide explicit **Open in Structure** handoff;
- preserve a shared canonical viewport anchor with renderer-specific zoom;
- run ForceAtlas2 outside the UI thread with progress/latest-result adoption;
- use a bounded memory-only derived layout cache separate from KG9 and canonical truth;
- keep unsupported-WebGL failure explicit and Structure fully available;
- do not add headings, blocks, analytics, communities, source editing, manual
  positions, or semantic similarity.

Production also adds an effective resolved-only default, soft path-derived
folder clustering, Compact/Normal/Spacious plus bounded Custom settings,
far/Regional/near style-only semantic zoom, schema-v2 renderer viewports, and
cross-mode Back/Forward. The small A/B comparison selects chunked ForceAtlas2
plus folder-prior adjustment over the one-shot offset field because it improves
within-folder distance while keeping cross-folder references more influential.

KG13B2 may use stable Global file positions as anchors for Local
Free/Structured induced subgraphs. It must keep headings outside Global
topology and avoid whole-vault relayout. QUERY1/GROUP1 remain independent;
separate LAYOUT1 is paused/absorbed. Do not implement KG13B2 in KG13B1.

## 21. KG13B2A Local Free isolation

KG13B2A implements the Free half of that handoff while preserving the Global
decision:

- Global Graphology remains documents-only and keeps its folder-prior cache;
- **Open Local** normalizes the selected entity to a stable document and uses
  existing KG6 Focus/disclosure for a bounded neighborhood;
- Local maps File/Heading/Block/diagnostic roles and distinct hierarchy versus
  reference edges through separate Graphology state;
- a transient stable-node screen-point query anchors the Local root without
  copying or mutating the Global position map;
- deterministic root-relative seed geometry renders before the separate Local
  ForceAtlas2 Worker returns;
- Local disclosure/focus issues zero Global layout requests and does not
  invalidate Global exact fingerprints;
- schema v3 persists only presentation mode and canonical semantic viewport
  anchors/ratios, never either renderer's coordinates;
- shared Search, Inspector, history, live reconciliation, precision input, and
  Structure recovery continue across all three presentations.

Synthetic Local-medium evidence uses 381 nodes/430 edges: projection median is
10.1 ms, mapping/seed together remain below 2 ms median, and roughly 94 ms
ForceAtlas2 refinement remains off-main. This supports immediate seed plus
worker refinement and rejects speculative background precomputation.

## 22. KG13B2B Local Structured completion

KG13B2B implements the Structured half over the exact same memoized Local KG6
projection:

- the Local-only accessible `Free | Structured` control persists a presentation
  preference without adding navigation-history entries or changing schema v3;
- React Flow's existing GraphCanvas owns an opt-in compact schematic visual
  variant rather than a duplicated Local canvas;
- File, Heading, Block, and diagnostic nodes use distinct compact DOM-backed
  markers while hierarchy edges dominate secondary reference edges;
- the existing W3 Worker accepts an explicit `local-structured` Dagre mode,
  leaving general Structure/Focus settings unchanged;
- a complete root-normalized deterministic seed renders before W3, while an
  exact bounded page-memory cache skips W3 for unchanged topology;
- narrow runtime-only node viewport-point APIs preserve the selected node or
  Local root across Free/Structured mounts without persisting coordinates or
  exposing renderer instances;
- Structured writes `structuredZoom` while preserving `freeRatio`; Free does
  the inverse, and both share one canonical semantic viewport anchor;
- node selection survives when representable; Structured edge selection is
  cleared with an announcement when entering Free, where edges are not
  interactive;
- disclosure, Focus/reroot, Search, Inspector, Back/Forward, QUERY1 filters,
  and live adoption retain the KG13B2A semantic owners.

The medium synthetic scene maps and seeds Structured in about 1.1 ms combined;
the independently tuned Dagre mode takes about 91 ms and remains off-main.
Exact cache reuse is about 0.08 ms. The deterministic operation oracle proves
that Free/Structured switching performs zero Local or Global reprojections,
zero Global layouts, and zero workspace transactions. Production browser QA
passes the layout, navigation, Search/Inspector, QUERY1, persistence, history,
disclosure, and console-error matrix after correcting a missing Structured
double-click reroot callback. The final release artifact then passed physical
desktop vault opening, Free/Structured navigation, live heading and root-file
changes, Rescan, restart restoration, and precision-touchpad validation without
worker/module/CSP errors. ADR 0015 records the closed architecture.

## 23. SPATIAL2A soft folder influence follow-through

SPATIAL2A preserves the selected Sigma/Graphology renderer and adds no runtime
dependency. Folder intent migrates to schema-v2 Pull/Place rules with exact or
hierarchical scope. A most-specific resolver assigns every visible document to
at most one rule. The Global position pipeline is now base automatic layout,
then a separate memory-cached soft-attractor worker, then fixed rigid
composition against the base frame.

The selected dynamic candidate alternates ForceAtlas2 chunks with bounded
shared centroid translations. The move-then-relax candidate had materially
larger normalized target error in deterministic synthetic comparison. Continued
ForceAtlas2 produces the required connected-nonmember reaction and avoids a
mere rigid post-layout offset. Strength zero preserves the base layer exactly.
The new worker receives only stable graph geometry, semantic edge weights,
resolved membership, target/strength, settings, iterations, and request ID.

Current Arrange Folders remains the production authoring surface and writes
only `place + exact`; the development harness supplies the full SPATIAL2A
matrix. SPATIAL2B may expose those rule controls after separate product design.
Focus/Hierarchy, QUERY1, GROUP1, presentation sizes, semantic viewport, and the
automatic folder prior retain their existing ownership.
