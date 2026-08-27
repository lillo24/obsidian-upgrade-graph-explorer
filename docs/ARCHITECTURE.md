# Architecture

## Status and purpose

This document is the engineering source of truth for the Markdown Structure Graph Explorer. KG0 established the React/Vite shell and workspace packages, KG1 implemented canonical snapshot schema version 1, KG2 implements generic CommonMark document/section structure parsing, KG3 implements the tested Obsidian frontmatter/link/block syntax adapter, KG4 resolves complete parsed workspaces into validated canonical snapshots, KG5 implements a development-only scanner and validated diagnostic report, KG6 implements renderer-independent view projection, KG7 implements the first structural renderer, and KG8 implements source-neutral inspection/search plus provenance-first navigation. Persistence and product filesystem access remain planned work.

The product will explore the structure of Markdown knowledge workspaces. Unlike a file-only graph, it must retain the hierarchy inside a document and attribute references to the precise section or addressable block where they occur. A renderer may collapse those relationships into file-level edges, but the canonical source-derived data must retain their original precision.

## Stable domain shape

The deliberate general abstraction is a hierarchical document:

```text
Document
  └─ Section
      └─ Section
          └─ optional addressable Block
```

Schema version 1 stores addressable `Document`, `Section`, and `Block` entities in one array. Documents are roots; sections and blocks have one document/section parent. Section titles are content rather than identity, heading levels are 1–6, and skipped nested levels are valid. Opaque non-empty string IDs allow later identity infrastructure without making paths or titles permanent identity.

Every entity retains a normalized workspace-relative source path and a half-open source span. Paths use forward slashes with no leading slash, drive prefix, empty component, `.` component, or `..` traversal. Lines and columns are 1-based. Optional offsets are 0-based JavaScript UTF-16 code-unit indexes and appear on both span endpoints or neither.

References retain their source entity, exact syntax span, raw target, and `link`/`embed` kind separately from a discriminated `resolved`, `unresolved`, `ambiguous`, or `invalid` result. A document may own a preamble reference; sections and blocks may provide more precise ownership. This project is not a universal arbitrary-data graph platform.

Core terminology must remain source-neutral. `Document`, `Section`, `Reference`, `SourceSpan`, and `SourceProvider` are appropriate concepts; types such as `ObsidianFileNode` or `ObsidianWikilinkEdge` are not. Obsidian is an adapter for wikilinks, aliases, embeds, block references, frontmatter conventions, and Obsidian-specific target resolution. Plain Markdown and future adapters must be able to feed the same canonical boundary.

## Dependency direction

Dependencies point from source/platform details and UI toward stable domain contracts, never in the reverse direction. Names will evolve, but this direction is an invariant:

```text
SourceProvider
  → workspace / parser / source adapter / resolver
  → canonical snapshot and deltas
  → derived indexes
  ├─→ explorer inspection/search → UI inspector
  └─→ view projection → renderer → UI graph

ViewStateStore
  → view projection / UI
```

The canonical snapshot is a versioned plain-data envelope containing workspace identity, entity arrays, and reference arrays. Future delta formats must follow the same serializable boundary. Neither may contain React elements, renderer objects, Graphology graphs, Tauri handles, parser ASTs, or source-provider objects. This keeps worker transfer, deterministic tests, caching, and renderer replacement possible.

`packages/core` is currently the innermost workspace boundary. It must not import React, React DOM, React Flow, Sigma, Graphology, Tauri, Obsidian application APIs, or code from `apps/web`. ESLint mechanically rejects those obvious imports. Later packages should be created only when they contain real implementation, with dependency direction enforced at their narrowest stable boundary.

`packages/parser-markdown` depends inward on core's source types. It accepts one
already-normalized workspace path and source string; it does not read files or
assemble canonical entities. ESLint rejects UI, renderer, platform, and
Obsidian imports in this package.

`packages/adapter-obsidian` depends inward on parser-markdown and core. It owns
Obsidian source interpretation but not the Obsidian application runtime,
filesystem access, workspace matching, or canonical assembly. ESLint rejects
UI, renderer, platform, runtime, application, and filesystem imports in its
production source.

`packages/resolver-obsidian` depends inward on adapter-obsidian and core. It
owns Obsidian-specific whole-workspace matching and source-neutral canonical
assembly. It accepts parsed values only; filesystem, Obsidian runtime, UI,
renderer, platform, and graph-index imports are mechanically excluded from its
production source.

`packages/diagnostics-obsidian` depends on the parsed/resolved contracts and
turns successful KG4 output into a deterministic, validated read model. It owns
compatibility probes and readable lookup helpers, not canonical resolution,
filesystem acquisition, UI, graph projection, or rendering. Those exclusions
are mechanically enforced for production source.

`packages/view-projection` depends inward on core only. It validates and indexes
one canonical snapshot, then derives plain visible nodes/edges from structural
disclosure, focus, and filter state. It owns nearest-visible-ancestor endpoint
roll-up, aggregated reference provenance, internal collapsed relationships, and
projection-only diagnostic targets. Source adapters, filesystem/platform APIs,
renderers, layout engines, application code, and graph libraries are
mechanically excluded from its production source.

`packages/explorer-inspection` depends inward on core and view-projection. It
builds canonical hierarchy/reference/search indexes once per snapshot and emits
plain deterministic entity, occurrence, subtree-relationship, projected
selection, and search read models. It never reroutes or aggregates references:
edge explanation resolves the existing KG6 `referenceIds[]` and compares exact
canonical endpoints with visible projected endpoints. React, renderers, source
adapters/diagnostics, filesystem/platform APIs, and graph libraries are
mechanically excluded from production source.

`packages/renderer-reactflow` depends inward on view-projection and adapts one
completed projection to read-only React Flow nodes/edges. It owns collision-safe
renderer IDs, fixed node geometry, deterministic Dagre structure/focus layout,
direct-neighborhood emphasis, semantic visual components, and viewport behavior.
It does not inspect canonical truth, reroute endpoints, aggregate references,
apply focus/filter policy, load reports, read files, or persist state. ESLint
mechanically excludes those inward and sideways dependencies. Its pure
`./prepare` entry lets the diagnostic harness measure mapping/layout without
mounting React.

KG8 adds a keyed projected-node center request to the renderer boundary.
Centering uses prepared renderer coordinates only after the new projection and
layout exist. It remains separate from selection and full-graph fit; no
canonical or inspection truth enters the renderer.

`tools/vault-diagnostics` is the sole KG5 filesystem boundary. It recursively
discovers one explicitly selected vault, reads strict UTF-8 Markdown, inventories
non-Markdown paths without reading their contents, and invokes KG3 → KG4 → the
diagnostics package. The browser receives only a generated report; it never
receives a folder handle. This tool is development infrastructure, not the KG11
product source-provider design.

## Markdown structural parsing

KG2 returns a serializable parser intermediate representation without canonical
IDs. A parsed document contains its full source extent and nested sections. Each
section retains human-readable heading text, Markdown level, the exact heading
syntax span, the full logical section span, and child sections.

Base syntax follows CommonMark through mdast. Only heading nodes directly under
the mdast document root define sections; heading-looking content in fences,
block quotes, HTML, or escaped text does not. ATX and Setext headings share the
same structure rules. Preamble content stays at document level.

The full section starts at its heading and ends before the next root heading
whose level is less than or equal to its own, or at EOF. Parent spans therefore
include and overlap descendant spans. Line endings are not normalized: offsets
index the original JavaScript string in UTF-16 code units, while lines and
columns retain KG1's 1-based semantics.

CommonMark parsing and mdast-to-structure derivation are separate steps. A
dedicated `parser-markdown/mdast` integration subpath lets source adapters reuse
the structure algorithm. The ordinary parser contract and canonical model stay
mdast-free.

## Obsidian syntax adaptation

KG3 parses a supported Obsidian subset into plain, canonical-ID-free adapter
IR. Frontmatter-aware mdast parsing prevents leading YAML from becoming a false
CommonMark Setext section. Valid string-list aliases are retained as document
metadata. Malformed YAML produces a diagnostic while trustworthy structure and
body references remain available.

Wikilinks and embeds preserve their raw target, optional display text, exact
syntax span, and unresolved file/heading/block components. Standard local
Markdown links and images use the same occurrence contract; obvious external
schemes are omitted. The adapter scans only mdast-approved text ranges, so code,
HTML, frontmatter, and Obsidian comments shield false link syntax while nested
Markdown containers remain discoverable.

Explicit Obsidian block IDs retain exact marker spans. KG3 does not guess full
block-content ownership. Duplicate or invalid markers and malformed or
unsupported syntax remain visible through adapter diagnostics. Target matching,
reference source ownership, canonical IDs, resolution states, and snapshot
assembly are deliberately owned by the KG4 workspace resolver rather than the
syntax adapter.

## Workspace resolution and canonical assembly

KG4 sorts parsed documents by normalized path, preserves KG2 section hierarchy,
creates one marker-backed canonical block per valid explicit KG3 anchor, and
creates one canonical reference per parsed source occurrence. Block source
spans represent the exact explicit marker only, not a guessed Markdown block
extent.

Reference source ownership is geometric: the deepest section whose half-open
full span contains the complete reference wins; otherwise the document owns the
reference. Blocks do not own references until a future parser can establish
reliable block content extents.

Default canonical IDs are deterministic transient tuples of workspace, path,
kind, and source offset. They stabilize one snapshot and repeated assembly but
are not durable across source edits or renames. A small provider seam preserves
KG9's ability to add durable identity later.

Wikilinks match exact Markdown basenames and qualified paths, with `.md`
equivalence. Explicit relative paths use the source folder. Folder-qualified
targets prefer exact vault-relative, exact source-relative, then path-suffix
evidence. Markdown links use source-relative path semantics and deliberate
percent decoding. Workspace escape or malformed percent encoding is invalid;
non-Markdown targets are unsupported by the Markdown-only inventory rather than
reported as missing notes.

Heading titles match exactly. Multiple heading components must match a
contiguous structural chain. Heading or block evidence may narrow ambiguous
file candidates only when one complete target remains; otherwise ambiguity is
retained. Undocumented filename tie-breakers, fuzzy matching, case folding, and
array-order selection are forbidden.

YAML aliases are metadata for suggestions, display, search, and unlinked
mentions—not persisted link-destination keys. Obsidian's alias authoring flow
creates a real target plus display text such as `[[Target|Alias]]`; KG4 does not
resolve `[[Alias]]` merely from frontmatter.

Resolver and forwarded adapter diagnostics remain outside schema v1. A valid
snapshot may contain unresolved, ambiguous, and invalid references. Duplicate
document paths, incompatible source geometry, generated ID collisions, or
runtime snapshot-validation failures are fatal and return no partial snapshot.

## Diagnostic report workflow

KG5 adds a versioned plain-data envelope around a validated canonical snapshot:

```text
development filesystem scanner
  → KG3 parsed documents
  → KG4 canonical snapshot + diagnostics
  → compatibility probes + aggregate inventory + optional timings
  → runtime-validated JSON report
  → local browser explorer
```

The report deliberately excludes source text and snippets, but it contains
paths, headings, raw targets, spans, and relationships and must therefore be
treated as private. Real reports are written only to an explicitly requested,
gitignored destination. The committed browser sample is generated from neutral
synthetic fixtures.

Compatibility probes are inspection evidence outside canonical truth. They may
surface a unique case-only file or heading match, or classify unsupported
attachment inventory as present, missing, or ambiguous. They never rewrite a
KG4 resolution, create attachment entities, select fuzzy matches, or create
graph nodes.

Real-vault validation confirmed that the canonical model retains document and
section ancestry plus precise reference endpoints needed for future endpoint
roll-up. Any private regression must be reduced to a neutral synthetic fixture
before entering the repository.

## Source truth and view state

Source-derived knowledge and application-owned visualization state are separate domains.

Canonical source truth includes document structure, references, source spans,
and explicit resolution results. Later source-backed fields may be added only
for concrete requirements. KG6 renderer-independent projection state now covers
structural disclosure, block inclusion, focus root/hops/direction/context, and
path/projected-text/entity-kind/resolution filters. Future application view
state may additionally include selection, pins, manual positions, viewport,
saved views, and renderer preferences. A UI action such as hiding, moving, or
pinning an entity must never mutate source truth. Early releases are read-only
with respect to Markdown.

KG5 search, resolution filters, disclosure state, and pagination are transient
diagnostic UI state. They are not KG6 projection contracts or KG9 persisted view
state. KG8 global search is a separate canonical inspection operation: it finds
entities hidden by disclosure and filters without mutating projection state.
KG8 graph filters remain KG6 state. Explicit navigation exits focus, reveals
the canonical ancestor chain through KG6, widens only filters that exclude the
target, then selects and centers the resulting projected node.

Renderers receive `ViewProjection` plain data formed from canonical source truth
plus renderer-independent state. Structural disclosure happens before each
hidden reference endpoint independently rolls to its nearest visible ancestor.
Equal visible source/target/status relationships aggregate while retaining exact
reference IDs; same-node relationships remain internal node provenance instead
of self-loop edges. Unresolved, ambiguous, and invalid targets are typed
projection-only nodes, never canonical entities. Focus runs over projected
reference edges before filters, and filter removal never causes endpoint
rerouting. React Flow, Sigma, and Graphology must never own persisted or
canonical truth.

## Resolution and diagnostics

Accuracy is more important than plausible guesses. The reference contract explicitly represents `resolved`, `unresolved`, `ambiguous`, and `invalid` outcomes. Ambiguous results retain at least two distinct candidates and never select one silently; optional or required reason strings explain non-resolved states. Runtime validation rejects contradictory fields and missing endpoints. Future adapters and resolvers must preserve these semantics.

## Trust and privacy boundary

The initial product is local-first:

- no required backend or account;
- no cloud upload or remote processing of workspace content;
- no telemetry or analytics;
- no source-file write-back;
- application-owned caches and view state may be stored locally.

Remote capabilities, collaboration, or source editing would require an explicit later trust decision. Private workspace material must not enter repository fixtures or logs. Bugs discovered in the Icarus vault must be reduced to small synthetic examples before they are committed.

The KG5 browser File API reads one user-selected report in memory and performs
no upload. Product-grade folder selection, file watching, and live source access
remain KG11 responsibilities behind a narrow provider boundary.

## UI, renderer, and platform roles

React and Vite implement the SPA shell; they are outer-layer delivery choices, not domain dependencies. React Flow is the implemented first structural renderer because the early product emphasizes interactive, hierarchical views. It receives only KG6 projections and uses deterministic Dagre layout. Sigma is conditional and may be added only when benchmark evidence demonstrates a need for a separate high-density global renderer. Graphology may later provide derived runtime indexes and algorithms, but its data structure is not canonical or persisted.

Tauri is deferred until the local-vault workflow milestone. It may provide desktop filesystem capabilities through a narrow source-provider boundary. Tauri commands, paths, events, and handles must not leak into generic core packages. Browser and future platform providers should remain viable.

React Flow and Dagre are installed only in the KG7 renderer package. Sigma,
Graphology, and Tauri remain uninstalled.

## Performance principles

Performance work begins with boundaries and measurement:

- parse one supplied file deterministically now; add file-granular incremental orchestration in KG10;
- communicate through serializable snapshots and deltas;
- introduce workers only after measured UI-thread cost justifies them;
- project only the graph needed for the active view;
- keep React subscriptions narrow;
- benchmark realistic synthetic and private-local workspaces before selecting a high-density renderer;
- prefer explicit diagnostics over fast but uncertain resolution.

KG5 provides deterministic smoke/small/medium/large pipeline workloads and
coarse real-vault phase timings. KG6 extends the same harness with projection
index construction plus documents-only, top-level, expanded, one-hop focus, and
resolution-filter scenarios and projected counts. KG7 additionally measures
one-to-one React Flow mapping and Dagre structure/focus layout for representative
small and medium projections. KG8 adds inspection-index construction, canonical
search, entity-subtree inspection, and aggregated-edge provenance timings with
result counts. They are investigative evidence only: no CI
timing threshold or high-density renderer conclusion is established before
KG12.

Rust, WASM, universal graph abstractions, and million-node optimization are not foundation requirements.

## Testing philosophy

Vitest is the unit and contract test foundation. KG1 validates canonical snapshots; KG2 combines focused parser cases with a synthetic workspace fixture and JSON round-trip coverage; KG3 adds separate Obsidian frontmatter, link, and block fixtures; KG4 adds independent multi-file resolution fixtures for ownership, ambiguity, hierarchy, blocks, paths, and unsupported attachments; KG5 adds report/probe validation, temporary-directory scanner tests, synthetic workload generation, pure UI transformations, and shell rendering tests. Future domain work should favor deterministic, table-driven tests against small synthetic Markdown fixtures. Adapter tests keep generic Markdown behavior separate from Obsidian-specific behavior. Snapshot/delta and projection tests should assert serializability and preservation of section-level precision.

KG6 adds pure disclosure, endpoint-routing, aggregation, synthetic-target,
focus, filter, determinism, JSON round-trip, immutability, validation, and exact
provenance-coverage tests over neutral canonical data. The KG5 browser workflow
is automation-tested locally without adding a browser-test dependency. A
product end-to-end suite remains a future choice. Real-vault validation stays
local and diagnostic; any committed regression must be synthetic and free of
private theory content.

KG7 adds pure one-to-one renderer mapping, collision-safe identity,
deterministic structure/focus layout, layout-failure, direct-neighborhood
highlight, stable component-map, and interaction-state tests. Synthetic and
gitignored real-report browser checks cover disclosure, selection, focus,
viewport controls, non-resolved states, and responsive layout without adding a
permanent browser-test dependency or committing screenshots.

KG8 adds pure canonical indexing, hierarchy traversal, breadcrumb, exact
occurrence, subtree backlink/outgoing/candidate-mention, internal relationship,
projected edge/node provenance, deterministic search, disclosure reveal,
filter-conflict navigation, and center-request tests. Synthetic and gitignored
real-report browser checks cover hidden-entity search/reveal, inspector
navigation, graph filters, focus exit, bounded lists, accessibility, and narrow
layout without adding a browser-test dependency or private artifacts.

## Changing these decisions

Change an expensive decision through a focused ADR that supplies evidence: a product requirement, compatibility constraint, measurement, or demonstrated failure of the current boundary. Roadmap speculation alone is not evidence. Keep documentation clear about what is implemented now, what is an invariant, and what is only planned.
