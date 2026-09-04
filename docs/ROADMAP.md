# Roadmap

The roadmap is a sequencing map, not a claim that future features exist. Each milestone begins only after its dependency/gate is satisfied.

| Milestone                                                    | Outcome                                                                                                                                        | Dependency or gate                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KG0 — Repository + architecture foundation**               | Reproducible pnpm workspace, minimal React/Vite shell, generic core boundary, checks, CI, and repository-owned guidance.                       | **Complete** — KG0 validation gate passed.                                                                                                         |
| **KG1 — Canonical domain model + fixture infrastructure**    | Serializable domain contracts and synthetic fixture conventions for hierarchical documents, references, spans, and explicit resolution states. | **Complete** — schema version 1 and its runtime validation gate passed.                                                                            |
| **KG2 — Base Markdown structural parser**                    | Parse files and heading hierarchies with source locations using generic Markdown behavior.                                                     | **Complete** — CommonMark parser IR and structural validation gate passed.                                                                         |
| **KG3 — Obsidian syntax adapter**                            | Interpret wikilinks, embeds, aliases, heading targets, block references, and relevant frontmatter outside generic core.                        | **Complete** — tested source-adapter IR and diagnostic gate passed.                                                                                |
| **KG4 — Workspace resolver + canonical snapshot**            | Resolve workspace references into explicit states and produce serializable snapshots.                                                          | **Complete** — conservative resolution and canonical-validation gate passed.                                                                       |
| **KG5 — Diagnostic explorer + real-vault validation**        | Validated private-report workflow, canonical hierarchy/reference inspection, compatibility probes, and non-gating pipeline evidence.           | **Complete** — synthetic and real-vault validation gates passed without committing private content.                                                |
| **KG6 — View-projection architecture**                       | Renderer-independent granularity, collapse/endpoint roll-up, aggregated provenance, focus-neighborhood, and supported filter contracts.        | **Complete** — projection, provenance, validation, and benchmark gates passed.                                                                     |
| **KG7 — Structural graph MVP**                               | Projection-driven hierarchical graph with focused scalability interactions and distinct non-resolved states.                                   | **Complete** — renderer mapping, layout, interaction, and browser-validation gates passed.                                                         |
| **KG8 — Inspector, backlinks, search + navigation**          | Provenance-first inspection, incoming/outgoing references, ambiguity candidates, and search/navigation over projected data.                    | **Complete** — source-neutral inspection, navigation, and browser-validation gates passed.                                                         |
| **KG9 — Persistence + stable identity**                      | Local persistence for renderer-independent application view state and identities robust across normal edits.                                   | **Complete** — KG9A identity and KG9B view/semantic-viewport restoration gates passed.                                                             |
| **KG10 — Incremental workspace engine**                      | File-granular reparsing and exact stable snapshot deltas while preserving whole-workspace semantics.                                           | **Complete** — cache, delta, global invalidation, identity, oracle, and real-vault gates passed.                                                   |
| **KG11 — Tauri local-vault workflow**                        | Desktop folder access and watching through a narrow source-provider adapter.                                                                   | **Complete** — secure selection, coalesced plans, transactional live application, resync, and view preservation pass.                              |
| **KG12 — Performance + worker hardening**                    | Explicit workload budgets, measurement-led worker split, and projection/focus/collapse optimization.                                           | **Complete** — budgets plus separate stateful W1 and stateless latest-result-wins W3 workers passed automated and release QA gates.                |
| **KG13 — Global → Regional → Local multi-scale exploration** | Add a complementary high-density Global renderer, visual Regional LOD, then bounded Local Free/Structured detail without replacing Structure.  | **Complete** — Global/Regional plus one bounded Local projection with Free and Structured presentations passed automated, browser, and release QA. |
| **KG14 — Product-quality exploration**                       | Accessibility, resilience, onboarding, polished exploration workflows, and release-quality hardening.                                          | **In progress** — KG14A audit complete; KG14B accessible Network exploration and critical feedback is Next.                                        |

Future package names, state libraries, and implementation details are intentionally unspecified until their milestone supplies concrete requirements.

## Parallel derived-presentation track

### HIER — Focus Schematic redesign

| Milestone | Outcome                                                                                                                                                                                                                         | Status                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **HIER0** | Experimental All-Hierarchy gate and collision-safe geometry baseline.                                                                                                                                                           | **Complete.**                                      |
| **HIER1** | Source-neutral File-module semantic model and shared layout-quality harness.                                                                                                                                                    | **Complete.**                                      |
| **HIER2** | Dagre/custom prototype bake-off through the HIER1 candidate contract.                                                                                                                                                           | **Complete — stateless two-stage Dagre selected.** |
| **HIER3** | Integrate modular Focus Hierarchy, connect actual cross-file File/Heading/Block endpoints, refine endpoint-facing internal lanes for two-sided and multi-hop modules, and preserve Classic Focus Hierarchy behind Experimental. | **Next.**                                          |

This track composes with the active KG14 sequence; it does not replace or
reorder KG14.

| Milestone                                           | Outcome                                                                                                                                                          | Status                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **SPATIAL1**                                        | Durable, normalized workspace spatial intent layered after automatic layout.                                                                                     | **Complete** — foundation and direct exact-folder arrangement passed. |
| **SPATIAL1A — Normalized folder-anchor foundation** | Source-neutral exact-folder registry, automatic/display position separation, stable-workspace persistence, renderer composition, tests, and development harness. | **Complete.**                                                         |
| **SPATIAL1B — Arrange Folders interaction**         | Spotlight/torch mode, temporary drag preview, commit/cancel, and accessible production controls over the SPATIAL1A seam.                                         | **Complete.**                                                         |
| **SPATIAL2 — Folder spatial behavior**              | Hierarchical folder scope plus fixed placement and dynamic soft-attractor behavior in All Network.                                                               | **In progress.**                                                      |
| **SPATIAL2A — Scope/attractor foundation**          | Schema-v2 migration, most-specific membership, three position layers, separate worker/cache, bake-off, harness, and aggregate evidence.                          | **Complete.**                                                         |
| **SPATIAL2B — Product rule editor**                 | Production behavior/scope/exclusion/strength controls over the SPATIAL2A contracts.                                                                              | **Next for SPATIAL2; not started.**                                   |
| **SAVED1 — Saved Views**                            | Later composition of query, Scope/Layout, hierarchy detail, settings, viewport, and spatial profile/reference.                                                   | **Later** — no schema is defined.                                     |

## Accepted future interaction guidance

KG6 defines projection granularity for documents-only, selected/top-level
sections, and expanded selected hierarchies. It distinguishes visible from
collapsed structural entities; rolls hidden reference sources and targets to
their nearest visible ancestors; lets one projected edge retain multiple
underlying reference IDs; defines a selected-root, small N-hop focus projection
with a hierarchy inclusion policy; and supports path, projected title/text,
entity-kind, and resolution-state filters. General tag/property filtering is
deferred until the canonical/adapter model supports it.

KG7 should keep primary controls small and emphasize expand/collapse, projected
link roll-up, select, focus mode, hover-neighborhood emphasis, structural and
local/focus layout, and distinct unresolved/ambiguous/invalid treatment. Any
ghost representation is a projection/UI marker, never canonical source truth.

KG8 exposes exact path/span provenance, section breadcrumbs, subtree
incoming/outgoing references, aggregated-edge explanations, ambiguity
candidates, canonical search, KG6-backed filters, and targeted reveal/center
navigation. Rich live snippets or open-in-source behavior still depends on KG11
source access; pathfinding is not a gate for the core inspector.

KG9 provides private app-owned workspace/entity/reference identity across
supported normal edits through conservative post-resolution reconciliation,
plus versioned renderer-independent persistence for disclosure, focus,
user-facing filters, and a semantic entity-plus-zoom viewport bookmark. The
browser localStorage adapter activates only for explicitly stable reports.
Search, inspector selection, and graph selection remain transient. Manual
positions/pins and named saved views have no supported interaction or evidence
to implement. KG10 now reparses changed files only while retaining complete
resolution and reconciliation, then emits exact source-neutral deltas. KG11A
now provides Tauri-selected, one-shot product-local acquisition plus app-local
workspace/catalog identity behind that engine. KG11B1 now adds recursive
selected-root watching, deterministic event coalescing, targeted filesystem
re-observation, conservative move evidence, and complete source-change plans.
KG11B2 now serializes plan application through KG10, persists candidate
identity/report state before adoption, preserves the live view, and executes
full resync for out-of-sync conditions.

KG12A now establishes versioned aggregate measurement contracts, deterministic
smoke/small/medium/large profiles, I1–I18 operation-count oracles, Class A/B/C
budgets, and the measured renderer scale cliff. Its decision is narrow: KG12B
should move whole-workspace KG10/diagnostic transactions and large Dagre layout
off the main thread, while projection and inspection remain on the main thread
and existing caches remain unchanged. KG12B1 implements W1 with ordered
prepare → persist → commit transactions, replacement-worker recovery, and
chunked structured-clone transport. KG12B2 implements W3 as a separate
stateless latest-layout-wins worker with active supersession and stale-result
rejection. Automated responsiveness, browser, and release desktop gates passed;
KG12 is complete. KG13A separated the Global product question from the remaining
Dagre structural-scale cliff and selected direct Sigma/Graphology while React
Flow remains Structure. KG13B1 now provides the lazy production documents-only
Global renderer, Regional visual LOD, off-main reference/folder layout,
serializable settings, memory-only derived positions, shared Search/Inspector,
and separate semantic viewport/history persistence. Headings remain outside
Global topology. KG13B2A now adds explicit Local presentation state, a bounded
document-root KG6 projection, immediate deterministic Sigma geometry, separate
latest-only hierarchy/reference ForceAtlas2, shared Search/Inspector/history,
Global screen-context anchoring, and schema-v3 semantic Local viewport
persistence. Local disclosure never mutates Global topology or layout cache.
KG13B2B completes the renderer architecture with React Flow/W3 Local
Structured as an alternate presentation of this same tested projection,
without redesigning Local semantics or replacing the existing Structure
renderer. Free/Structured switching is preference-only, preserves semantic
history and viewport state, and does not reproject Local or relayout Global.
Immediate deterministic schematic geometry, latest-only W3 refinement, and a
bounded exact memory cache passed automated, production-browser, release-vault,
live-update, accessibility, and physical precision-touchpad gates. KG13 is
complete. KG14A now records the current workflow map, release-readiness audit,
resilience matrix, decision points, ranked implementation queue, and KG14
completion gate in `PRODUCT_QUALITY_AUDIT.md`. The audit found strong runtime
and data resilience but a release-blocking lack of an equivalent DOM exploration
path for both Network layouts. KG14B is therefore Next: accessible Network
exploration plus critical query/feedback accessibility. Desktop CSP,
versioning, and packaging follow as a separate evidence-backed hardening slice.

QUERY1 saved queries/filters and GROUP1 visual rule groups remain independent
product systems. GROUP1A's source-neutral rule compiler, fixed palette,
workspace registry logic, visible-entity presentation derivation, and
style-only seams across Structure, Global, Local Free, and Local Structured are
complete. GROUP1B now adds workspace-scoped durable/session-only product
sessions, creation, editing, ordering, enabling, fixed-palette configuration,
corrupt-storage recovery, and selected-entity Inspector matches. It adds no
default groups and leaves projection, topology, navigation, viewport, and
layout semantics unchanged. The
separate LAYOUT1 idea remains paused/absorbed into KG13's Global → Regional →
Local spatial architecture. SPATIAL1's normalized exact-folder foundation and
Arrange Folders interaction are complete. SPATIAL2A's schema, hierarchy,
soft-attractor worker/cache, and development evidence are complete; SPATIAL2B
is the next product-authoring step. Named Saved Views remain later derived
presentation work.

Post-MVP analytics—typed conceptual relations, pathfinding variants,
centrality, betweenness, communities, connected components, co-citation,
semantic similarity, and timeline overlays—remain derived data. Future semantic
relations should use a provenance-bearing derived or author-annotation layer
instead of overloading canonical syntactic references.
