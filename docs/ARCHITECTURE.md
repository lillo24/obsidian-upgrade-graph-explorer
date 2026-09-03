# Architecture

## Status and purpose

This document is the engineering source of truth for the Markdown Structure Graph Explorer. KG0 established the React/Vite shell and workspace packages, KG1 implemented canonical snapshot schema version 1, KG2 implements generic CommonMark document/section structure parsing, KG3 implements the tested Obsidian frontmatter/link/block syntax adapter, KG4 resolves complete parsed workspaces into validated canonical snapshots, KG5 implements a development-only scanner and validated diagnostic report, KG6 implements renderer-independent view projection, KG7 implements the first structural renderer, KG8 implements source-neutral inspection/search plus provenance-first navigation, KG9 implements app-owned stable canonical identity plus local renderer-independent view restoration, KG10 implements file-granular parsed-document caching plus exact stable snapshot deltas, and KG11 implements Tauri-selected, coalesced live vault acquisition with transactional KG10 application, full resync, and in-place view preservation. KG12 supplies the performance baseline and implements separate stateful W1 workspace and stateless W3 Dagre workers without changing KG11 transaction semantics or renderer-independent contracts. KG13A selected direct Sigma/Graphology for a complementary Global renderer. KG13B1 promotes it into the product as a lazy documents-first Global/Regional mode with off-main layout and soft folder geometry. KG13B2A adds bounded Local Free as an explicit third presentation with KG6 Focus/disclosure authority, deterministic immediate geometry, separate off-main layout, schema-v3 persistence/history, and Global transition anchoring. KG13B2B completes that Local presentation with a reusable React Flow/W3 schematic variant over the same bounded projection. PRE-KG14A4 assigns compact hierarchy cards to All and extended cards to Focus while preserving their separate Structure and Local Structured layout modes. KG14B2 adds a virtualized, accessible Network Explorer over the completed All or Focus Network projection; it is a DOM companion to the visual Sigma canvas, not a renderer replacement or a new topology authority.

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
browser report input / Tauri SourceProvider
  → workspace engine / parser / source adapter / resolver
  → transient canonical snapshot
  → stable-identity reconciliation
  → stable canonical snapshot → source-neutral snapshot delta
  → derived indexes
  ├─→ explorer inspection/search → UI inspector
  └─→ view projection → renderer → UI graph

stable report identity provenance
  → source-neutral saved-view schema/reconciliation
  → platform ViewStateStore (browser localStorage today)
  → view projection / semantic renderer viewport request
```

The canonical snapshot is a versioned plain-data envelope containing workspace identity, entity arrays, and reference arrays. The KG10 delta is likewise versioned, source-neutral, and serializable. Neither may contain React elements, renderer objects, Graphology graphs, Tauri handles, parser ASTs, or source-provider objects. This keeps worker transfer, deterministic tests, caching, and renderer replacement possible.

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

`packages/stable-identity` depends inward on core only. It validates one
versioned private observation catalog, matches one complete canonical snapshot
conservatively against it, allocates opaque IDs, remaps all entity/reference
relationships, proves non-identity semantics are unchanged, and validates the
result as schema version 1. It has no Markdown/Obsidian, diagnostics,
projection, renderer, application, filesystem, platform, or UUID-generation
dependency. Catalog persistence and workspace-UUID creation belong to the
outer application boundary.

`packages/snapshot-delta` depends inward on core only. It validates and derives
one exact plain-data change between two stable schema-v1 snapshots of the same
workspace, then applies it with stale-base, index, identity, and resulting-core
validation. It knows nothing about parsing, Obsidian, identity catalogs,
filesystem acquisition, rendering, or UI state.

`packages/workspace-engine-obsidian` composes adapter-obsidian,
resolver-obsidian, stable-identity, and snapshot-delta. It owns one immutable
in-memory parsed-document cache and atomic source-change batches. It reparses
upserts only, reuses cached IR for deletes and moves, then intentionally runs
complete KG4 resolution and KG9A reconciliation before emitting the next
stable snapshot and exact delta. Filesystem watching, persistence, source
retention after parsing, and application subscriptions remain outside it.

`packages/workspace-worker` owns the versioned plain-data W1 protocol and the
EMPTY/COMMITTED/PENDING transaction state machine. In desktop production its
dedicated worker owns the KG10 engine/cache and diagnostic construction. Large
initialization/resync and prepared-result arrays are split into ordered native
structured-clone frames so one transfer does not monopolize the UI event loop.
The package has no Worker global, Tauri handle, filesystem access, React value,
or synchronous production fallback; the Vite worker entry/client live in the
web application. Because Vite 8 applies browser export conditions to Dedicated
Worker builds, the web build boundary explicitly resolves the Markdown
named-reference decoder's worker-safe entry and rejects emitted worker chunks
that construct DOM values.

`packages/dagre-layout` owns the versioned plain-data W3 protocol, strict
input/output validation, and the only synchronous Dagre compute/configuration
implementation. It is stateless and knows nothing about React, React Flow,
projection, Worker globals, W1, application state, Tauri, or filesystems. Its
root export is Dagre-free; explicit `./compute` and `./worker-runtime` subpaths
are reserved for workers, tests, and benchmarks. The Vite entry and
latest-layout-wins client live in the web application.

`packages/vault-discovery-policy` depends inward on core only and owns the pure
lexical rules shared by the Node KG5 scanner and Tauri KG11A provider: hidden
and `node_modules` skipping, normalized excludes, Markdown classification,
deterministic ordering, and safe workspace-path construction. It performs no
filesystem I/O and knows nothing about either platform runtime.

`packages/source-provider-tauri` is an outer platform adapter. It depends on
core, stable-identity, vault-discovery-policy, and the official Tauri v2 API,
dialog, and filesystem packages. It owns native directory selection, full and
targeted strict-UTF-8 source acquisition, path-only non-Markdown inventory,
recursive watcher acquisition, event coalescing, deterministic source-change
planning, and private application-data registry/catalog persistence. It
deliberately does not own KG10 application, diagnostics, React, projection,
rendering, live subscriptions, or full resync orchestration. An injectable
narrow bridge and scheduler keep all provider tests independent of a native
runtime.

`apps/web/src/desktop-live-vault.ts` is the non-React application orchestration
boundary between that provider and the W1 processor. It owns one live runtime, watcher
subscription, serialized operation queue, buffered bootstrap, paused/dirty
state, candidate report/catalog commit ordering, disposal checks, and full
resync. Main persists the prepared catalog before asking the worker to commit;
a missing acknowledgement triggers fresh-source replacement-worker recovery
from the newly durable catalog. It publishes only matching committed
runtime/report snapshots. React
owns source-session activation and presentation, not the mutation transaction.

`packages/view-projection` depends inward on core only. It validates and indexes
one canonical snapshot, then derives plain visible nodes/edges from structural
disclosure, focus, and filter state. It owns nearest-visible-ancestor endpoint
roll-up, aggregated reference provenance, internal collapsed relationships, and
projection-only diagnostic targets. Source adapters, filesystem/platform APIs,
renderers, layout engines, application code, and graph libraries are
mechanically excluded from its production source.

`packages/view-state` depends inward on core and view-projection only. It owns a
versioned plain-data subset of KG6 disclosure, focus, user-facing filters,
presentation mode, and separate semantic Structure/Global/Local
canonical-entity viewport bookmarks. Schema v3 migrates schema-v1 Structure
and schema-v2 Structure/Global bookmarks losslessly without inferring Local
from Focus. It strictly validates saved data,
reconciles persisted or current in-memory state against a
`ProjectionWorkspace`, drops stale identities/path scopes without fuzzy
replacement, and emits non-fatal issues. Current reconciliation additionally
retains the transient text filter and all semantic viewports during live
evolution. Raw React Flow/Sigma transforms, Graphology/ForceAtlas2 positions,
and layout settings are excluded. React, renderers,
diagnostics, stable-identity catalogs, filesystems, storage APIs, and platform
code are mechanically excluded from production source. Browser localStorage is
an outer adapter, not the durable domain contract.

`packages/graph-query` depends inward on core and owns QUERY1 parsing,
canonical formatting, and canonical-entity evaluation. `packages/visual-groups`
depends only on core plus graph-query. It validates at most 24 ordered
name/query/palette/enabled definitions, compiles QUERY1 expressions once, and
resolves first-match plus all-match results into query-free
`EntityId → {groupName, color, accent}` presentation. It owns no persistence,
projection, renderer, UI, layout, navigation, or membership cache. The web app
owns a separate strict schema-v1 workspace registry and derives maps only for
entity IDs already visible in a completed projection.

`packages/explorer-inspection` depends inward on core and view-projection. It
builds canonical hierarchy/reference/search indexes once per snapshot and emits
plain deterministic entity, occurrence, subtree-relationship, projected
selection, and search read models. It never reroutes or aggregates references:
edge explanation resolves the existing KG6 `referenceIds[]` and compares exact
canonical endpoints with visible projected endpoints. React, renderers, source
adapters/diagnostics, filesystem/platform APIs, and graph libraries are
mechanically excluded from production source.

The web-owned `network-explorer-model.ts` is a narrower projection read model.
It receives one completed Network `ViewProjection`, the snapshot-scoped
inspection lookup, and the already-resolved Visual Group presentation map. It
orders canonical entities by source path/position, then diagnostics, without
reading projected edges. `network-explorer-folders.ts` derives only real source
folders represented by those nodes, with no canonical folder entities or
independent vault enumeration. Hidden canonical
entities, Graphology, Sigma sessions, layout coordinates, and renderer events
are outside this boundary. Iterative folder flattening, virtual ranges, ancestor reveal,
and keyboard transitions are pure derived presentation operations.

`packages/renderer-reactflow` depends inward on view-projection and adapts one
completed projection to read-only React Flow nodes/edges. It owns collision-safe
renderer IDs, fixed node geometry, plain W3 input/result adaptation,
direct-neighborhood emphasis, semantic visual components, viewport behavior,
and an optional GROUP1A presentation context. The group map changes only a
fixed overlay accent; it is excluded from mapping, layout, fingerprints, and
geometry.
It does not inspect canonical truth, reroute endpoints, aggregate references,
apply focus/filter policy, load reports, read files, or persist state. ESLint
mechanically excludes those inward and sideways dependencies. Its pure
Its synchronous `./prepare` entry is limited to the diagnostic harness and
tests; production receives an asynchronous layout service from the web layer.
The canvas preserves the last committed geometry while a later request is
pending and adopts only the latest generation. Failed W3 work uses a
deterministic renderer-side grid, never synchronous Dagre.

`packages/renderer-sigma` depends inward on view-projection plus direct Sigma,
Graphology, ForceAtlas2, and React. It maps a documents-only KG6 projection into
derived stable-key renderer state, derives folder membership from normalized
workspace-relative document paths, reconciles live topology in place, and owns
the imperative Global camera/reducer lifecycle. Folder metadata is a soft
layout prior and never a canonical or projected relationship. A plain-data
latest-result-wins application Worker runs ForceAtlas2 plus the selected
chunked folder prior. Exact derived positions may be reused from a bounded
module-lifetime memory cache; no positions persist. Far/Regional/Near semantic
zoom changes style only. Optional GROUP1A maps enter only node reducers: Global
documents and Local File/Heading/Block nodes may use an accent below LOD and
interaction emphasis, while diagnostics and edges remain unchanged. Session
setters schedule partial, skip-indexation reducer refreshes without topology
reconciliation or layout.
ESLint excludes canonical, source, platform,
application, analytics, React Flow, Dagre, and Node dependencies.

`tools/global-renderer-spike` is now a production renderer harness rather than
an implementation fork. It retains only synthetic KG13A fixtures, browser/Tauri
stress controls, Worker transport, and aggregate evidence while consuming
renderer-sigma mapping, session, semantic zoom, settings, cache, and layout.

KG8 adds a keyed projected-node center request to the renderer boundary.
Centering uses prepared renderer coordinates only after the new projection and
layout exist. It remains separate from selection and full-graph fit; no
canonical or inspection truth enters the renderer.

KG9B adds one interaction-end semantic viewport observation. The renderer uses
the current React Flow transform and actual container dimensions to find the
nearest visible entity node, then reports only its canonical entity ID plus
zoom. Diagnostic nodes never become bookmarks. Raw x/y, renderer node IDs,
Dagre coordinates, and per-frame movement never cross into saved view state.
Restoration reuses the KG8 center request after layout; missing or filtered
anchors use normal fit without widening the restored view.

`tools/vault-diagnostics` is the Node development filesystem boundary. It recursively
discovers one explicitly selected vault, reads strict UTF-8 Markdown, inventories
non-Markdown paths without reading their contents, and invokes KG3 → KG4 →
KG9A stable identity → diagnostics. It also owns the private catalog file
adapter: strict load, explicit reset, vault-local-path rejection, and validated
temporary-sibling replacement after report success. The browser receives only
a generated report; it never receives a catalog or folder handle. This tool
remains development infrastructure and does not share I/O with the KG11A
product provider; only their small pure discovery policy is shared.

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

Default KG4 IDs are deterministic transient tuples of workspace, path, kind,
and source offset. They stabilize one assembly but are intentionally not
durable across source edits or renames. The small provider seam remains useful
for deterministic assembly/tests; KG9A does not overload it with application
identity. Persistent flows reconcile the complete resolved canonical hierarchy
after KG4 instead, where source-neutral parent, target, candidate, and reference
evidence is available.

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

## Stable identity reconciliation

KG9A keeps durable identity outside Markdown and outside Obsidian resolution:

```text
KG4 transient correct KnowledgeSnapshot
  → source-neutral conservative reconciliation
  → stable-ID schema-v1 KnowledgeSnapshot
```

Documents reuse one exact normalized path or, after a rename/move, one unique
non-empty graph-structural fingerprint. Sections reuse exact structure beneath
a matched stable parent; one unique non-empty subtree/reference fingerprint may
also preserve a heading rename or cross-parent move. Blocks use matched-parent
locators or unchanged sibling cardinality/ordinal only. References reconcile
after entities through stable source owner, authored kind, and raw target;
resolution is excluded because a target edit in another file can reclassify an
otherwise unchanged occurrence. Duplicate identical references require
unchanged unique offsets. Matching is staged and
one-to-one. Weak or duplicate evidence receives a new ID; there is no fuzzy,
nearest-candidate, semantic/AI, or array-order tie-breaker.

The catalog is schema-versioned private local plain data. It retains allocation
counters and only the paths, hierarchy, offsets, headings, fingerprints, raw
targets, and stable resolution observations needed for the next complete run.
It contains no source body, absolute filesystem path, report, renderer state,
or view state. Deleted observations are omitted while counters continue; no
historical identity resurrection is attempted. New IDs are opaque sequence
values and never derive from path/title/offset. Persistent workspace identity
comes from an explicit ID or an outer-layer UUID generated once and then reused
from the catalog.

## Incremental workspace processing

KG10 makes parsing incremental without pretending that workspace semantics are
local:

```text
previous engine + atomic normalized source changes
  → validate the complete batch
  → parse only upserts; reuse cached parsed IR for deletes and moves
  → resolve the complete parsed workspace through KG4
  → reconcile the complete snapshot through KG9A
  → diff previous and next stable snapshots
  → next immutable engine + exact schema-v1 delta
```

The engine accepts `upsert`, `delete`, and `move` changes and reports reparsed
paths plus reused parsed-document counts. A move changes the cached root path
without reparsing; KG4 remains responsible for all path-dependent semantics.
Equivalent batches are normalized deterministically. Duplicate path touches,
missing sources, occupied move destinations, parse failures, resolution
failures, identity failures, and delta failures return an explicit failure and
no next engine, snapshot, catalog, or revision.

Every successful batch still performs whole-workspace resolution. Adding a
target can resolve references in unchanged files; deleting it can unresolve
them; changing a heading or block anchor can alter target resolution or
ambiguity globally. KG9A then preserves each unchanged authored reference ID
through those resolution changes. Local-only resolution invalidation would be
incorrect and remains unimplemented until evidence supports a proven index.

The source-neutral delta classifies records by stable ID and carries exact
before/after records and indexes. Source span and resolution changes are
updates, not removal/addition, when identity survives. A narrowly used
`afterOrder` records a pure reorder that changed-record indexes cannot express.
Application validates the base and the resulting core snapshot, so
`apply(old, diff(old, next))` exactly equals `next` or fails loudly.

The engine is deliberately an in-memory domain service, not KG11B's watcher.
Rename continuity is strongest when a provider supplies one `move` or one
atomic coalesced delete-plus-upsert. Committing a deletion before a later add
loses the observation because KG9A has no tombstone resurrection contract.

## Desktop vault acquisition and watch planning

KG11A wraps the existing Vite/React frontend in a minimal Tauri v2 shell:

```text
native Open Vault dialog
  → session-scoped selected root
  → Tauri source provider + private identity session
  → initialize KG10 once
  → engine snapshot/diagnostics/parsed documents
  → in-memory diagnostic report
  → existing graph, inspector, and saved-view path
```

The source provider recursively reads strict-UTF-8 Markdown and inventories
non-Markdown paths without reading their content. It skips hidden entries and
`node_modules`, honors normalized excludes, never follows symlinks, and emits
only normalized workspace-relative paths to processing layers. Absolute roots
remain in the native session and a private version-1 application-data registry.

The registry maps one exact normalized root to an opaque workspace ID; one
validated KG9A catalog lives in the adjacent private identity directory. New
associations write the catalog before the registry, and every replacement uses
a temporary sibling plus rename. Missing, corrupt, unsupported, or mismatched
known identity state fails explicitly until the user confirms a separate
identity reset. Root moves are not guessed or fingerprinted.

The application initializes KG10 once and builds diagnostics from
`engine.parsedDocuments()`, so it does not reparse sources. The initialized
engine, inventory, provider session, and selection remain in memory for KG11B.
The report is marked stable only after private identity persistence succeeds;
a write failure produces an explicit transient-session warning. Opening a
vault resets transient search/selection while the existing KG9B boundary
hydrates state for a known stable workspace.

Tauri dialog-selected filesystem scope expires with the process. KG11A never
grants blanket home/drive scope or silently reopens a previous arbitrary root;
the user reselects it after restart, then exact registry matching reuses stable
identity.

KG11B1 enables the pinned Tauri filesystem watch feature and recursive
`watchImmediate` on that session-scoped root. The bridge reduces native event
facts to package-owned plain data; absolute paths are normalized to safe
workspace-relative paths before public delivery. Access and access-time
metadata activity is discarded to avoid provider reads feeding a watch loop,
as are batches containing only ignored paths. Remaining signals are
deduplicated after a 250 ms quiet period or a 1,000 ms hard limit, with
serialized flushes and explicit disposal.

Events are hints rather than source changes. Each bounded batch re-observes
only affected files or directory subtrees with the KG11A hidden/exclude,
symlink, Markdown, and fatal-UTF-8 policy, then compares the result with the
retained complete inventory. Plans contain deterministic Markdown
upsert/delete/move operations, the complete next inventory, and non-Markdown
change state. Exact source equality must be unique in both inventories before a
move is inferred. Unsafe, root-wide, out-of-root, native rescan, unreadable, or
inconsistent observations request resync. The application layer owns serialized
KG10 application, persistence, UI preservation, and resync execution.

KG11B2 now starts watching before one-shot discovery, buffers startup batches,
and gives one plain controller a promise queue shared by watcher updates and
manual rescan. Markdown plans become KG10 candidates; the controller builds a
stable report, commits the catalog, and only then adopts runtime, inventory,
and report together. Non-Markdown-only plans rebuild compatibility evidence
without KG10, while net no-ops retain the report object. Explicit source desync
and KG10 input failure perform one complete reinitialization using the current
committed catalog. Other failures pause with the last committed graph visible.

## Diagnostic report workflow

KG5 adds a versioned plain-data envelope around a validated canonical snapshot:

```text
development filesystem scanner
  → KG3 parsed documents
  → KG4 transient canonical snapshot + diagnostics
  → optional KG9A stable identity reconciliation
  → compatibility probes + aggregate inventory + optional timings
  → runtime-validated JSON report
  → local browser explorer
```

Compatibility probes and the report are constructed after optional identity
stabilization, so every exposed entity/reference/target/candidate ID is stable
in persistent runs. The catalog stays separate and never enters the report.
The schema-v1 report envelope may declare `identity.stability` as `stable` or
`transient`; the field is provenance for outer persistence eligibility, not
canonical truth. Legacy schema-v1 reports without it remain readable and are
treated as persistence-ineligible. Newly built reports state the provenance
explicitly. The committed sample uses deterministic in-memory stable
reconciliation without writing a catalog.

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
path/projected-text/entity-kind/resolution filters. KG9 persists the user-facing
subset: disclosure, block inclusion, focus, path/entity/status filters, and a
semantic canonical-entity-plus-zoom viewport bookmark. The internal projected
text filter is deliberately excluded because the current UI does not expose it.
Selection, hover, search, inspector pagination, renderer graph data, raw
viewport transforms, manual positions/pins, named saved views, timestamps, and
renderer preferences are not persisted. A UI action such as hiding or focusing
an entity never mutates source truth. Early releases remain read-only with
respect to Markdown.

KG5 search, resolution filters, disclosure state, and pagination are transient
diagnostic UI state. They are not KG6 projection contracts or KG9 persisted view
state. KG8 global search is a separate canonical inspection operation: it finds
entities hidden by disclosure and filters without mutating projection state.
KG8 graph filters remain KG6 state. Explicit navigation exits focus, reveals
the canonical ancestor chain through KG6, widens only filters that exclude the
target, then selects and centers the resulting projected node.

KG9B persistence activates only for reports with explicit stable-identity
provenance. The browser synchronously loads, validates, and reconciles the
workspace-keyed record before autosave is enabled. Stale disclosure IDs, focus
roots, path scopes, and viewport anchors are removed with visible non-fatal
status; collapsed disclosure wins conflicts. Corrupt or unsupported records are
not overwritten or deleted. Reset removes only that workspace view, restores
documents-only defaults, clears transient selection/search, and fits the graph;
it never resets the KG9A identity catalog. A selected report file itself must
still be re-selected after browser reload because file handles are out of scope.

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

KG9A identity catalogs are application-owned private local state. Even without
Markdown body text they may contain paths, headings, fingerprints, and raw
targets, so they must stay in ignored/app-local storage outside the selected
vault and must not be logged or included in browser reports.

KG9B/KG13 browser saved views are also private local application data, but
their scope is intentionally small: stable workspace/entity IDs,
disclosure/focus, workspace-relative path filters, enum filters, presentation
mode, and semantic Structure/Global/Local zoom or ratio. They contain no report,
catalog, source body, absolute path, renderer layout, raw transform, search,
selection, coordinates, transition points, or Local/Global positions. Keys use encoded stable workspace IDs rather than filenames, vault
basenames, or paths. Storage denial/corruption is non-fatal and never becomes a
success-shaped empty value.

Remote capabilities, collaboration, or source editing would require an explicit later trust decision. Private workspace material must not enter repository fixtures or logs. Bugs discovered in the Icarus vault must be reduced to small synthetic examples before they are committed.

The KG5 browser File API reads one user-selected report in memory and performs
no upload. KG11 desktop mode reads and watches one explicitly selected vault
locally through a narrow provider, writes only private app-owned identity state
outside the vault, and keeps reports in memory. Native absolute paths and raw
events do not cross the provider. Live application and resync never write the
selected source tree.

## UI, renderer, and platform roles

React and Vite implement the SPA shell; they are outer-layer delivery choices,
not domain dependencies. React Flow remains the internal Structure renderer
because the product needs interactive hierarchical detail, exact provenance,
and disclosure. It receives only KG6 projections and uses deterministic Dagre
layout. Literal lazy imports load direct Sigma/Graphology only on first All
Network or Focus Network activation (the internal Global and Local modules).
All Network is documents-first and effectively resolved-only unless the user
explicitly chose reference statuses. It shares KG6 filters/focus, KG8
Search/Inspector, and exact canonical context with Hierarchy, but owns only a
visual overview and Regional style LOD. Search documents stay All Network;
section or block results and **Open full hierarchy** return to exact
hierarchical detail. WebGL/startup failure is explicit and leaves All Hierarchy
available without deleting the persisted presentation preference.

Both Network layouts expose the same transient Network Explorer overlay. Its
virtualized DOM `tree` is derived from the active projection even if the Sigma
mount fails, and its rows carry textual kind, source, diagnostic, Focus-distance,
and winning Visual Group context. One roving tab stop navigates the complete
logical row list; offscreen activation scrolls before focus is restored. A row
selection writes the shared `GraphSelection` and sends exactly one Global or
Local semantic center request at the current bookmark ratio. It creates no KG6
action or navigation checkpoint and never asks Sigma to report topology. Canvas
selection opens the matching source-folder ancestors and scrolls its row into
the virtual window without moving DOM focus. That reveal runs once per selection
change; scrolling and virtual-window updates do not reassert an unchanged
selection. The overlay never resizes the graph;
it may coexist with Inspector above 900 px, while the last-opened drawer wins at
the existing narrow breakpoint. Drawer, expansion, active-row, and scroll state
are memory-only and absent from schema v3. NETWORKPOLISH1 gives disclosure only
to folders: depths 1/2 default open, 3+ closed (root excluded); path-keyed overrides
survive ordinary query/live membership changes and sidebar remounts until the
source session ends. Files never disclose. Projected headings/blocks visually
follow their File, or remain under the real folder when File is filtered out;
their keyboard/ARIA parent is the source folder. Diagnostics trail at root.
Folder and Saved queries disclosure performs no projection, workspace, or layout work.

KG14B3 adds QUERY1 and contextual actions to that projection companion. The
single applied formula remains `ViewProjectionState.filters.query`; the shared
controlled editor appears in Network Explorer for Network and Filters for
Hierarchy. Its transient controller stays at GraphExplorer level. Clean drafts
follow external/history updates, dirty drafts survive placement changes, Saved
Filter Apply intentionally adopts its formula, and Reset draft mutates no graph
state. Compact Network omits visible dirty/reset clutter, not the draft controller
or atomic mutation safety. `SavedGraphQueries` shares the existing registry UI
between Hierarchy Filters and Network's local Saved queries popover; Network
Filters duplicates neither query nor Saved queries. Apply still uses semantic
QUERY1/history. There is no new persisted hidden-files array or schema version.

Hidden chips are the KG14B1 global exact-path exclusion list, not source-inventory
state. A pure planner applies add/remove independently to the active query and a
valid dirty draft before either is adopted. Parse/limit failures block both;
each successful semantic mutation uses one normal set-query history checkpoint.
No chip operation centers or fits the returning graph. One contextual menu
accepts only graph-node rows through the current model, uses canonical entity/path
metadata, and is invalidated by virtual scrolling or projection replacement.
Focus calls the existing All entry or Local navigation pipeline. Inspect changes
controlled selection and opens the existing responsive Inspector without layout
or history work. Hide file is unavailable for diagnostics, the focused source
file (including its headings/blocks), and already-excluded paths. Menu open/close
does not project, inspect canonical workspaces, or call Sigma.

Focus is a source-neutral two-pass projection. A documents-only,
prefiltered hop traversal first fixes file membership from the containing
document of the exact Focus root. A second pass applies full filters and precise
endpoint routing while automatic structural depth is scoped only to that root
document. Neighbor files remain manually expandable, and precise heading
endpoints cannot add or remove files from the established neighborhood. Ordinary
All Hierarchy depth remains global.

The user-facing exploration model is the product of two independent choices:
`Scope = All | Focus` and `Layout = Network | Hierarchy`. The existing internal
schema-v3 modes remain implementation details: All Network maps to `global`,
All Hierarchy to `structure`, Focus Network to `local/free`, and Focus Hierarchy
to `local/structured`. This is a UI normalization, not a persisted-contract
rename. Regional remains ordinary visual LOD inside Network rather than a fifth
mode.

Both All layouts enter Focus through one application planner and NAV1 history
path. Focus normalizes the root to a stable document and projects only that
bounded document neighborhood plus root-scoped hierarchy detail and exact
diagnostics. Hierarchy Depth is hidden in All Network, global in All Hierarchy,
and root-scoped in both Focus layouts. A fresh All Network entry starts at depth
0; All Hierarchy entry inherits its current preset. Both clear unrelated manual
disclosure overrides. Network and Hierarchy consume the same memoized Focus
projection, so changing layout does not rerun KG6. Neighbor files remain
collapsed unless manually expanded.

The Focus projection feeds Sigma plus the latest-only ForceAtlas2 Worker for
Network, or extended React Flow cards plus the existing latest-only W3 Dagre
Worker for Hierarchy. All Hierarchy uses the compact schematic card grammar over
its unchanged Structure projection and Dagre mode. Visual density is selected
by one scope-to-variant seam and remains independent from layout mode; measured
dimensions participate in layout/cache fingerprints. Captured screen-space root context anchors entry, layout changes,
and Focus depth changes transiently; semantic centering is the safe fallback.
No screen point is persisted. Scope All returns to the most recent true All
history checkpoint, including its semantic viewport; a no-history fallback
clears Focus and preserves the current layout. Focus headings never enter All
Network topology, mutate its cache, or trigger whole-vault relayout.
QUERY1 filtering and GROUP1 visual classification remain independent systems.
Folder clustering remains an All Network-only spatial prior. Its product
Strength control normalizes the existing persisted `folderCohesion` range to
0–100%; spacing changes preserve that value, and hiding Advanced controls does
not mutate preferences. Hierarchy renderers never observe the setting. The
Global worker terminates superseded requests, so rapid slider input adopts only
the latest valid result without adding a serial queue.
GROUP1A's source-neutral backbone and renderer seams remain unchanged. GROUP1B
adds a web-owned workspace session with durable, session-only, corrupt, and
failed-write states; local create/edit drafts; one write-before-adopt commit;
and explicit two-step corrupt-registry recovery. Definitions compile only when
the registry array changes. A snapshot-scoped canonical lookup and the current
already-completed projection derive one `EntityId` presentation map shared by
All Hierarchy, All Network, Focus Network, and Focus Hierarchy. Group changes therefore
restyle nodes without entering KG6, navigation history, renderer topology,
layout inputs/caches, or semantic viewport state. Selected canonical entities
use the compiled all-match evaluator in Inspector; diagnostics and edges opt
out. Filters and Groups have one transient tool-panel owner while Inspector is
independent.
The separate LAYOUT1 idea is paused/absorbed into this Global → Regional → Local spatial architecture;
manual cluster offsets remain future derived presentation state.

Tauri v2 hosts the existing frontend and provides dialog plus filesystem
read/watch capabilities through a narrow source-provider boundary. Tauri
commands, absolute paths, events, and handles do not leak into generic core
packages or the application-facing watch/change-plan contracts. Browser mode
remains viable without loading the desktop-only provider.

React Flow is installed only in the KG7 renderer package. Dagre is installed
only in the plain W3 compute package and bundled into its dedicated worker,
not the main application chunk. Sigma 3.0.3, Graphology 0.26.0, and ForceAtlas2
0.10.1 are exact production renderer-sigma dependencies emitted only in lazy
Sigma presentation and dedicated Global/Local Free worker chunks. Local
Structured reuses React Flow and W3 and adds no runtime dependency. Structure startup
does not execute them.
Visual Groups add one zero-external-dependency workspace package; renderer
packages import only its resolved presentation type and never QUERY1 rules.
Tauri dependencies are isolated to the desktop shell and
`source-provider-tauri`.

## Performance principles

Performance work begins with boundaries and measurement:

- keep KG10 file-granular parsing behind KG11 acquisition and transactional application of provider change plans;
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
result counts. KG9A adds cold assignment and warm deterministic normal-edit
reconciliation counts/timings for small and medium profiles. KG10 adds
independent edit, add, delete, and move cases with changed/reparsed/reused file
counts, delta counts, incremental timings, full-rebuild timings, and exact
snapshot/catalog/delta-application oracle checks. They are
supplemented by KG11 application timings for source reconciliation, KG10,
report construction, identity persistence, total live processing, and full
resync. The provider's 250 ms quiet window is batching latency and remains
separate. These are investigative evidence only: no CI timing threshold or
high-density renderer conclusion is established before KG12.

KG12A turns those investigative hooks into a versioned aggregate schema with
warm-ups, repeated samples, median/p95/max, canonical/projected counts, explicit
phase omissions, and deterministic I1–I18 operation counts. Instrumentation is
absent by default and memory-only when enabled; live correlation IDs remain
runtime-only. The measured split keeps W2 projection and W4 inspection on the
main thread. KG12B1 implements W1 as a sequential stateful transactional
worker. KG12B2 implements W3 as a separate stateless worker: an active obsolete
job is terminated, idle workers are reused, stale results are rejected, and
only a matching layout may trigger viewport effects. See `docs/PERFORMANCE.md`.

KG13A measures a second renderer against the file-level Global product role,
not against the hierarchical Structure role. Its harness times projection
mapping, Graphology construction, replacement and in-place updates, first
Sigma render, interaction responsiveness, and ForceAtlas2 worker work at the
required stress profiles. Raw timing is evidence rather than a portable CI
threshold. The decision, candidate boundary, rejected alternatives, and
passing browser/release evidence are recorded in
`docs/GLOBAL_RENDERER_DECISION.md`.

KG13B1 production keeps that renderer lazy, defaults its KG6 derivation to
documents/resolved references, moves ForceAtlas2 plus folder prior to a separate
latest-only Worker, and instruments projection, mapping, reconcile, layout,
mount, LOD, hover, selection, and center work. Ordinary camera zoom/pan updates
only the semantic bookmark and style reducer: it performs no KG6 projection,
Graphology topology reconciliation, or layout request. Current positions warm
folder/settings/topology changes; exact fingerprints use a bounded memory
cache. See `docs/PERFORMANCE.md` and ADR 0013.

KG13B2A adds bounded Local-small/medium/stress profiles rather than treating
whole-vault counts as the Local target. Production instrumentation separates
Local projection, mapping, seed, Sigma mount, worker layout, result apply, LOD,
hover, selection, centering, and cross-presentation transitions. The operation
oracle proves ordinary Local zoom/pan/hover/selection performs no projection,
topology reconciliation, or layout; disclosure performs no Global layout.
Medium deterministic seed readiness remains inside Class B while the measured
ForceAtlas2 refinement stays off-main. This evidence rejects speculative
per-file Local precomputation and retains only a bounded memory-only exact
layout cache. See `docs/PERFORMANCE.md` and ADR 0014.

KG13B2B measures a compact Local Structured mapping and O(nodes + edges) seed
against those same bounded projections. At 381 nodes/430 edges, mapping and
seed medians are 0.748 ms and 0.410 ms; worker-equivalent Dagre is 93.297 ms
and remains off-main, apply/root normalization is 0.231 ms, and an exact cache
hit is 0.077 ms. Layout-only switching issues zero KG6/Global/workspace work.
The React Flow variant exposes only a projected-node screen-point query and
retains schema v3 with optional `structuredZoom`. Those figures record the
original compact-Focus assignment; PRE-KG14A4 reuses the same density grammar
for All and gives Focus extended cards without changing either Dagre mode. See
ADR 0015 and the current renderer contract.

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

KG9A adds source-neutral synthetic revisions for unchanged snapshots, offset
shifts, inserted headings, body-stable edits, unique and ambiguous document
renames, strong and weak heading renames/moves, duplicates, deletion, blocks,
unique and duplicate references, resolution remapping, JSON round trips,
semantic invariance, determinism, corruption, workspace mismatch, and private
catalog lifecycle behavior. Real-vault continuity remains an ignored local
aggregate check; no catalog or private observation enters the repository.

KG9B adds strict saved-view round trips, exact restore, workspace mismatch,
stale disclosure/focus/path/viewport reconciliation, collapsed-wins conflicts,
enum/zoom validation, deterministic serialization, canonical immutability,
supported-edit/identity-loss evolution, injected storage failures/isolation,
report provenance compatibility, and semantic viewport geometry tests.
Synthetic reload, transient/report-switch, and gitignored real stable-report
browser checks cover hydration, transient state reset, disclosure/focus,
semantic zoom restoration, and console cleanliness without adding a browser
test dependency or committing private artifacts.

KG10 adds source-neutral delta round trips, stale-base and malformed-delta
rejection, pure reorder reconstruction, immutable engine revisions,
file-granular reparse counts, atomic batch failures, deterministic equivalent
batches, move/rename continuity, offset shifts, and global resolution changes
from added/deleted/renamed targets. Every synthetic update is compared with an
independent full rebuild using the same previous identity catalog. The opt-in
real-vault check performs one in-memory edit, prints aggregates only, writes no
source/catalog/report, and asserts the same exact oracles.

KG11B1 adds fake-bridge and injected-scheduler tests for recursive native watch
mapping, path containment/filtering, quiet and maximum burst behavior,
serialized flushes, cleanup, targeted subtree discovery, net no-op/edit/create/
delete/non-Markdown state, strict UTF-8 failure, explicit resync, unique move
evidence, duplicate ambiguity, and deterministic ordering. Platform-specific
event sequences are checked only with an aggregate temporary synthetic Windows
vault and do not become a stable public contract.

KG11B2 adds native-free live-controller tests for watcher-first bootstrap,
serialized bursts, Markdown/non-Markdown/no-op application, transactional
rollback, pause/recovery, automatic and manual full resync, events during
resync, source disposal, repeated provider catalog commits, and source-neutral
current-view reconciliation. Temporary synthetic desktop mutation and private
real-vault rescan remain aggregate local QA; no private artifact is committed.

KG13B2A adds pure tests for document-root normalization, bounded Local
projection, root-versus-neighbor disclosure, Global heading rejection,
File/Heading/Block/diagnostic mapping, hierarchy/reference separation,
deterministic seed geometry, root-origin refinement, layout fingerprint/cache,
survivor reconciliation, latest worker adoption, Local interaction operation
counts, schema-v1/v2/v3 migration, cross-mode history, same/cross-document
navigation, and minimum hidden-heading reveal. Browser and release Tauri QA
cover the real WebGL/Worker transition, touchpad precision, shared
Search/Inspector, live update/root-loss recovery, and Structure/Global
regressions without committing private screenshots or vault topology.

KG13B2B adds pure tests for opt-in compact mapping, unchanged standard mapping,
explicit Dagre mode/worker equality, complete finite root-normalized seed,
private-safe exact fingerprints, bounded cache eviction, Structured viewport
round trips, preference restore, and Local/Global operation isolation. Browser
and release validation cover the renderer toggle, selection policy, anchored
transition/refinement, disclosure, Search/Inspector, live updates, history,
precision input, and explicit Free/Structure recovery without committing
screenshots or private topology.

GROUP1A adds pure tests for definition/registry validation, canonicalization,
priority and overlap, QUERY1 semantic equivalence, visible-entity-only map
derivation, and identical canonical classification across Structure, Global,
Local Free, and Local Structured. Renderer-local operation oracles require a
style-map update to perform zero projection, topology mapping/reconciliation,
layout requests, or geometry changes while scheduling exactly one style
refresh.

GROUP1B adds injected-storage session tests for stable A → B → A isolation,
transient and storage-unavailable editing, write-before-adopt rollback,
blocked retries, corrupt-value preservation, and key-scoped confirmed reset.
Static product tests cover the enabled badge, ordered rows, editor labels,
multiline QUERY1 feedback, fixed palette, contained Tools presentation, and
Inspector Primary/Also matches. Existing GROUP1A renderer operation oracles
remain the style-only regression gate.

KG14B2 adds projection-model tests for deterministic File/Heading/Block/
Diagnostic presentation and every tree key transition. NETWORKPOLISH1 replaces
adjacency tests with projection-only source folders, depth defaults/overrides,
filtered-file reachability, trailing diagnostics, ancestor reveal, and folder-only
actions. Local edge tests require far references to remain visible through camera
ratio 6 while preserving labels, hierarchy widths, and separate Global behavior.
Stress-scale virtual-range and server-rendered
DOM tests bound mounted rows to viewport plus overscan. App shell tests retain
lazy Sigma loading while proving that only Network layouts expose the closed
drawer controls. Browser and release-desktop QA cover responsive coexistence,
focus restoration, offscreen keyboard traversal, bidirectional selection,
zoom-preserving centering, renderer failure independence, and unchanged
touchpad behavior.

## Changing these decisions

Change an expensive decision through a focused ADR that supplies evidence: a product requirement, compatibility constraint, measurement, or demonstrated failure of the current boundary. Roadmap speculation alone is not evidence. Keep documentation clear about what is implemented now, what is an invariant, and what is only planned.
