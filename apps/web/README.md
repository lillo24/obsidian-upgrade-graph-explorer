# Web Multi-scale Graph Explorer

Status: **STABLE — Scope × Layout plus an accessible Network Explorer unify visual and DOM exploration over the existing renderers.**

This package owns the browser SPA, validated KG5 report selection, Tauri-only
live vault orchestration, KG6 graph interaction state, guarded browser persistence, graph selection, canonical
navigation orchestration, and provenance-first inspection UI. It accepts one
runtime-validated report selected by the user or the committed neutral sample.
It does not implement native I/O, upload reports, modify canonical truth, persist
renderer layouts/raw transforms, or derive renderer semantics.

```text
selected report JSON → runtime validation → canonical inspection/search
                                   └───────→ KG9B saved view → KG6 projection
                                                          → Structure mapping → W3 Dagre worker
                                                          → Global mapping → Global layout worker
                                                          → Local Free mapping/seed → Local ForceAtlas2 worker
                                                          → Local Structured mapping/seed → W3 Dagre worker
                                                     ↘ KG8 inspector/navigation
                                                     ↘ virtualized Network Explorer
                                   ↘ secondary KG5 evidence UI

Tauri Open Vault → watcher + buffered one-shot acquisition
                 → worker-held KG10/report candidate
                 → identity persist → worker commit → in-place graph/UI update
```

## File map

```text
apps/web/
  index.html          Browser metadata and application mount point.
  package.json        React/Vite and pure diagnostic-report dependencies.
  vite.config.ts      Vite React integration.
  tsconfig.json       Strict browser/JSX compilation settings.
  src/
    main.tsx          Root validation and React startup.
    App.tsx           Browser/desktop source ownership, session state, Settings composition, and evidence state.
    desktop-runtime.ts Lazy official Tauri detection and provider creation.
    desktop-vault.ts Lazy worker initialization and truthful identity/worker commit orchestration.
    desktop-live-vault.ts Serialized watch, worker candidate, pause, replacement, and resync lifecycle.
    workers/          Separate Vite W1, W3, Global, and Local entries/clients.
    performance.ts    Query-gated browser recorder and local inspection API.
    graph-state.ts    Pure disclosure/focus/filter interaction reducer.
    exploration-model.ts Pure Scope/Layout mapping onto schema-v3 internal modes.
    navigation.ts     Shared reveal/filter-widening/navigation planner.
    local-view.ts     Local entry/reroot/minimum-reveal planner over KG6 state.
    visual-groups/    Visible-entity GROUP1A presentation-map derivation; no projection calls.
    spatial-overrides/ Workspace persistence plus All-Network Arrange mode state.
    navigation-history.ts Bounded session history over semantic graph checkpoints.
    graph-history-shortcuts.ts Exact graph-context Back/Forward shortcut policy.
    network-explorer-model.ts Projection-only source ordering, keyboard plans, and virtual ranges.
    network-explorer-folders.ts Canonical source folders, transient depth defaults/overrides, and iterative row flattening.
    network-explorer-context.ts Logical context targets, action eligibility, and menu keyboard planning.
    network-explorer-query-actions.ts Atomic applied/draft QUERY1 exclusion planning and hidden-path labels.
    persistence/      Stable-report eligibility, hydration, and localStorage adapter.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Primary graph workspace and secondary diagnostic panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. The graph workspace
creates projection/inspection workspaces for each committed snapshot and passes
only a `ViewProjection` plus semantic viewport requests to the active renderer.
Structure uses React Flow/W3; Global and Local Free are literal lazy imports of
direct Sigma/Graphology with separate layout protocols and caches. Local
Structured is a separate lazy boundary over the same Local projection and the
existing React Flow/W3 state machine. Only the chosen Local renderer mounts. Each lazy
presentation imports the shared Sigma stylesheet at its own module boundary. A
persisted v3 session may restore directly into Local, so Local must not depend
on a prior Global visit to establish its canvas height or controls. A real
source-session switch keys a complete transient selection/search reset and
workspace-specific hydration;
live revisions reconcile current state and update the mounted explorer in place.
The graph workspace owns one lazily started W3 layout service for the mounted
explorer. New projections supersede active layout jobs by replacing that
worker; an idle worker is reused. A later layout keeps the last committed graph
interactive until the matching geometry arrives, while an initial layout shows
an explicit progress surface.

GROUP1A adds a source-neutral Visual Group package plus app-owned seams, without
adding product controls. `src/visual-groups/presentation.ts` takes an already
available projection/entity subset and canonical lookup, skips diagnostic
targets, evaluates only those canonical `EntityId`s, and returns one resolved
presentation map. It never calls `projectView()`. The renderer props are
optional, so the current product supplies no map and looks unchanged until
GROUP1B adds user-facing configuration.

The separate schema-v1 registry adapter is keyed by encoded stable workspace
ID. It strictly retains ordered priority and stores only name, canonical QUERY1
string, fixed palette token, and enabled boolean. It is not graph-view state,
does not bump schema v3, and is not wired into GraphExplorer, NAV1 history,
DISC1 counts, active QUERY1 filtering, or Saved Filters.

SPATIAL1 wires a separate source-neutral normalized folder-anchor registry and
production Arrange Folders controls into All Network. Its stable-workspace
session uses declared identity provenance and an encoded workspace key;
transient/legacy or storage-unavailable sources stay session-only. The renderer
receives only the resolved exact-folder anchor map. Focus Network, both Hierarchy
presentations, KG6 projection, navigation history, Graph Preferences, saved view
schema v3, and the per-File size registry do not observe it. Automatic layout
positions remain distinct from displayed translated positions, so anchor edits
neither submit layout work nor contaminate the automatic cache. GraphExplorer
owns a transient active/exact-folder reducer and delegates raw pointer state to
the Sigma session. Network Explorer exposes exact folder and root entry points,
saved-position markers, and disabled explanations. The canvas adds the drag,
keyboard nudge, save/cancel, reset, and corrupt-recovery surfaces without adding
folder entities or graph history checkpoints.

Graph history remains a web-layer session concern above KG9 view state.
Each checkpoint contains one immutable KG6 `ViewProjectionState` reference and
separate Structure/Global/Local canonical entity/zoom-ratio bookmarks; it never
contains selection, renderer IDs, transforms, projections, layouts, transition
points, preferences, or shell state. The
current view remains App-owned, while bounded past/future stacks retain at most
100 checkpoints and reconcile an entry only when traversed after a live update.

Vite 8.2 client resolution includes the `browser` condition for Dedicated
Worker builds. A worker-only pre-resolution plugin in `vite.config.ts` routes
the pinned Markdown named-reference decoder to its published worker-safe
implementation instead of the DOM implementation that initializes with
`document.createElement`. The package is already a transitive parser runtime;
its direct development declaration makes that build-time resolution explicit
without adding a new external package. The same plugin rejects emitted worker
chunks containing DOM construction, so this boundary is enforced by every
production build.

## Report loading and privacy

**Settings → Source → Open Report** uses the browser File API for one explicitly
selected JSON file. The report is parsed and validated in browser memory and is
never uploaded. Desktop mode adds local product acquisition without changing browser mode:

```text
KG5   = select one generated report file
KG11A = selected-folder one-shot acquisition
KG11B = coalesced watching, transactional live updates, and resync
```

Malformed schema versions, snapshots, diagnostics, probes, or inventory fields
produce an actionable floating notice while the last valid report remains visible.
In Tauri runtime, **Open Vault** under Settings uses dynamically imported platform code; cancel
is inert, source failures retain the prior report/live session, and successful
opens reset transient search/selection while stable KG9B state hydrates by
workspace. Watching starts before initial discovery, startup batches are
buffered, and only a stable identity-persisted open becomes live.

The plain `desktop-live-vault.ts` controller serializes watch batches and manual
rescans. Its narrow async processor asks the dedicated worker to prepare KG10
plus report state, persists the candidate catalog, commits that exact worker
candidate, and only then publishes one matching runtime/report state.
Non-Markdown-only plans ask the committed worker for compatibility evidence
without advancing revision; net no-ops retain the report object. Persistence
failure discards and pauses. A worker failure after a durable write triggers a
fresh full scan and replacement worker before adoption; other worker/report
failures retain the last graph until a successful **Rescan Vault**.

## Graph-first workspace shell

The normal product shell is the graph workspace: it reaches all viewport edges
without a permanent app header, centered page wrapper, or outer card framing.
Source switching, safe source status, rescan, and exceptional identity recovery
live in **Settings → Source**. Routine healthy status stays there; opening,
catch-up, resync, paused, and failure states use compact floating notices that do
not reduce canvas height.

**Maximize graph**, exposed in the canvas control stack, remains an application
mode, not the browser Fullscreen API. The existing `GraphExplorer` and
`GraphCanvas` instances remain mounted in place while the workspace becomes a
fixed `100dvh` surface. Body scrolling is locked, and **Restore graph** or
`Escape` restores the prior body overflow value. Maximizing is intentionally
transient and never requests `fitView`, so selection, viewport, disclosure,
focus, filters, and saved KG9 view state remain unchanged.

Compact Back/Forward arrows start the normal graph toolbar and stay directly
reachable beside Tools in maximized mode. `Alt+Left`/`Alt+Right` are primary;
guarded `Ctrl+Z`/`Ctrl+Shift+Z` and Meta equivalents apply only in eligible
graph context. Editable controls and the Settings surface retain native text
undo, unavailable directions are not consumed, and application dialogs disable
graph shortcuts.

The Inspector is also transient and closed by default. In normal and maximized
views, the toolbar sidebar icon or compact right-edge handle opens the same
bounded overlay drawer without changing graph-stage width. Its chevron collapse
control is distinct from **Clear selection**. Closing the Inspector unmounts only
its presentation surface and does not clear or change graph selection. Selecting
another graph item while it is closed does not reopen it, and reopening resolves
the current selection. Neither shell preference is part of the persisted-view
schema.

All + Network and Focus + Network also expose a transient **Network Explorer**
from the toolbar or left-edge handle. It is a DOM `tree` over the active
`ViewProjection`, not a second graph: File, Heading, and Block rows are grouped
by their canonical source folders, with diagnostics trailing at root. Only
folders disclose; headings/blocks remain visible below their projected File,
or directly in the real folder if that File is filtered out. Folders at depths
1/2 default open and 3+ closed, excluding root. Path-keyed memory-only overrides
survive ordinary query/live membership changes and drawer remounts, but reset
with the source session. The sidebar no longer reads edges. A fixed-height flattened
model virtualizes the viewport with overscan, while roving focus and
Arrow/Home/End/Enter/Space behavior operate over every logical row, including
offscreen rows. Row selection writes the existing controlled graph selection
and centers the matching Sigma node at the current semantic zoom ratio without
creating graph history, projection, topology, or layout work. Canvas selection
reveals the matching row and its source-folder ancestors without moving DOM
focus; unchanged selection never pulls ordinary scrolling back to the root.

KG14B3 makes this drawer the Network precision control surface. Its Advanced
query editor is the same controlled component used in Hierarchy Filters; Network
Filters duplicates neither query editor nor Saved queries management. Network
Explorer exposes the existing registry behind a compact, viewport-bounded
bookmark beside the Query label and its viewport-bounded panel; Hierarchy
retains management in Filters. Opening
folders, the drawer, or Saved queries never projects or requests layout/workspace
work. `GraphExplorer` owns the
transient draft, so closing the drawer or switching layouts preserves it. A clean
draft follows applied-query/history changes; a dirty draft remains untouched.
Saved Query Apply explicitly adopts that formula through normal history. Compact
Network hides dirty/reset copy but retains errors and Apply/Clear icons;
Hierarchy's Reset draft abandons only the draft. The sole semantic query remains
`ViewProjectionState.filters.query`.

Hidden-file chips derive from QUERY1 global exact-path exclusions, including
manually authored clauses and paths no longer present in the source. Hide and
chip restore use the KG14B1 helpers, preserving the rest of the Boolean query.
Valid dirty drafts receive the same operation independently; invalid drafts or
query-limit failures block both changes atomically. Each successful semantic
change uses the existing set-query history path, with no extra Fit or centering.

Right-click, Shift+F10, the ContextMenu key, or the visible Actions button opens
one shared menu for a graph-node row. Folders have no node actions. Focus reuses existing
All-entry/Local-navigation pipelines; Inspect selects and opens the existing
Inspector without graph history. Hide file applies to the whole canonical source
file, including when invoked on a heading/block; diagnostics, the active Focus
root file, and already-hidden files are ineligible. Menu state is transient,
closes on scrolling/projection invalidation, and restores mounted row focus safely.

The drawer starts closed, persists nothing, overlays rather than resizes the
canvas, and closes when Layout leaves Network. Inspector and Network Explorer
may coexist on wide screens. At the existing 900 px breakpoint, opening either
closes the other; a wide-to-narrow resize retains the most recently opened
drawer. Closing restores the toolbar or edge-handle opener, while a layout
transition never steals focus from the Layout control. The DOM companion stays
usable when a valid Network projection exists even if the visual Sigma mount
reports a failure.

The normal Inspector view is deliberately user-facing: entities show their name,
kind, location, outgoing links, and backlinks; reference edges show the actual
source-to-destination link occurrences; hierarchy edges use containment language;
and unresolved, ambiguous, or invalid links use plain-language problem states.
Canonical/projection IDs, source ranges, resolution metadata, ambiguous candidate
mentions, and links internal to collapsed sections are available only inside the
closed-by-default **Technical details** disclosure. Relationship lists render at
most 20 entries initially and reveal further entries in bounded increments.

Successful persistence and navigation messages remain in visually hidden
`aria-live` regions. Projection, storage, report-loading, and navigation failures
use explicit visible alerts; failure visibility is not inferred from message text.
The secondary KG5 evidence explorer is launched from **Settings → Developer**
and uses a modal, internally scrolling surface. Opening or closing it does not
resize or remount the graph workspace.

## Saved graph view

Cross-session persistence activates only when a report explicitly declares
`identity.stability: "stable"`. Transient and legacy schema-v1 reports remain
usable in memory and never read or write saved state. The schema-v3 saved record
is keyed by encoded stable workspace ID and contains only structural disclosure,
the optional literal heading ceiling, focus, user-facing path/entity/status
filters, explicit presentation mode, and canonical renderer viewport bookmarks.
Internally those bookmarks remain named Structure/Global/Local for schema-v3
compatibility. Schema v1 migrates to Structure; schema v2 preserves its explicit
Structure/Global mode and does not infer Local from an active focus. The Local
bookmark stores an anchor plus Free ratio and optional Structured zoom. The
Free/Structured preference remains in the existing graph-preference key and
does not enter graph history. Raw x/y, transition
screen points, Graphology objects, and worker positions are forbidden.

Hydration and source-evolution reconciliation happen synchronously before the
autosave effect. Stale disclosure IDs, focus roots, path scopes, and viewport
anchors are dropped with non-fatal status; collapsed disclosure wins conflicts.
Legacy schema-v1 entity-kind filters are normalized at the web boundary so block
eligibility cannot contradict the single visible **Blocks** choice; the saved
schema version does not change. `disclosure.includeBlocks` remains the user
intent that decides whether blocks may be projected.
Corrupt, inaccessible, or unsupported stored values are not overwritten or
silently deleted. Writes stop after one failure. **Reset saved view** deletes
only that workspace's view, restores **Files only**, clears transient
search/selection and both navigation-history stacks, and fits the graph. It
never resets the KG9A catalog.

Back/Forward history is never persisted. Meaningful presentation, disclosure,
Focus, filter, and Search/Inspector navigation actions record the current
semantic checkpoint; selection, hover, pan/zoom/Fit frames, Search typing,
overlays, maximize, preferences, and live adoption do not. Entity navigation
updates the canonical bookmark immediately at zoom `1.1`. Traversal converts a
visible canonical anchor to a keyed projection-node center request after the
new projection exists, or Fits when the anchor is missing/hidden. The currently
traversed view continues through normal KG9 autosave. Choosing **All** from
Focus jumps to the latest unfocused All checkpoint—whether Network or
Hierarchy—while retaining skipped Focus disclosure checkpoints for Forward
traversal. If no such checkpoint exists, the fallback keeps the current Layout
and clears Focus conservatively.

Live snapshot reconciliation is not localStorage hydration. It keeps surviving
disclosure, focus, heading/block choices, filters, and semantic viewport by
stable canonical ID, removes only stale IDs/path scopes, and then lets ordinary
autosave persist that current state under the same workspace ID. Search,
Inspector visibility, maximize mode, and surviving selection stay in memory;
selection clears with an announcement only when its projected element vanishes.

QUERY1 adds one optional canonical advanced-query string to that saved
active view. Draft text never projects, enters history, or persists. Saved
Filters are a separate stable-workspace registry containing only `{name,
query}` definitions; applying one changes only the active query, deleting one
does not change graph history, and Reset saved view leaves definitions intact.
All Network applies that same canonical query to its files-only topology, so
document-compatible clauses filter files while Section-only clauses correctly
produce no matches instead of promoting parent files.
Unstable identities still support session-only Advanced query use but disable
cross-session saving with an explanation.

The browser keys contain no report filename, vault basename, or path. Search,
hover, graph/inspector selection, pagination, renderer graph data, Dagre
coordinates, and raw viewport x/y remain transient. Browser reload restores the
bundled stable sample automatically; a user-selected report file must still be
selected again because KG9B does not persist browser file handles.

KG12A instrumentation requires either `?performance=1` in a browser or an
explicit `VITE_ICARUS_PERFORMANCE=1` diagnostic build for Tauri. It records
named pure, commit, paint, viewport, search, inspection, and live-adoption
phases plus worker compute/round-trip/main-thread-gap evidence in memory and
exposes a local `window.icarusPerformance` inspection API.
Normal builds/loads do not create a recorder or API. The Vite variable changes
only instrumentation availability and must be set before `desktop:dev` or
`desktop:build`; debug/native timings must be labeled by build mode. Live
controller correlation tokens are monotonic within one controller, survive
only long enough to join I16/I17/I18 processing to the matching paint, and
never enter reports or persistence.

## Graph interaction boundary

The default All Hierarchy view is **Files only**. Outside Focus, **1 level**, **2
levels**, and **3 levels** automatically expose that many canonical section-tree
generations for every eligible file; explicit per-entity disclosure may continue
beyond that baseline. Inside Focus, the file-level reference neighborhood is
established first and remains stable across depth changes. Automatic depth then
unfolds only the focused file; neighbor files remain collapsed unless the user
explicitly expands them. A new depth preset still clears prior manual disclosure,
and manual collapse retains precedence afterward. All Hierarchy changes remain
ordinary NAV1 semantic actions. Selecting an entity enables one-to-three-hop
focus with incoming/outgoing/both direction. Selection and hover affect
presentation only. Diagnostic targets can be selected but never focused or
expanded. The
primary inspector resolves projected selection to canonical descriptors and
exact occurrences, then keeps that internal model behind a user-facing boundary:
normal relationship summaries count only outgoing links and backlinks, while
candidate mentions and internal collapsed relationships remain technical context.

Hover temporarily emphasizes a node or edge's direct neighborhood and fades
unrelated rendered content only until pointer leave. Click or keyboard selection
keeps the chosen element visibly selected without persistent graph-wide fading.
Focus remains a reduced projection rather than a visual opacity treatment.

The primary controls are **Scope: All / Focus** and **Layout: Network /
Hierarchy**. All Network is the files-only whole-vault Sigma overview; All
Hierarchy is the general React Flow structure. Focus Network and Focus
Hierarchy share one bounded KG6 projection. Double-click and Inspector
**Focus** use the same entry callback from either All layout; single-click
remains selection-only and diagnostic double-click is inert. Entry captures the
focused document's runtime viewport point, normalizes the KG6 root to that
document, and keeps neighboring files collapsed. Network renders a
deterministic Sigma seed and refines it in its latest-only ForceAtlas2 Worker.
All Hierarchy uses compact schematic File/Heading/Block/diagnostic cards over
the existing Structure projection and Dagre mode; Focus Hierarchy uses extended
detailed cards over the same bounded Focus projection and keeps its
`local-structured` seed, root normalization, and W3 Dagre mode. Exact memory-cache
hits skip the active worker. Expand/Collapse is available in both the Hierarchy node and the shared Inspector;
Focus hops/direction and the existing Blocks/filter controls remain shared.
Ordinary Focus Network zoom, pan, hover, selection, and Inspector activity perform no
projection, Graphology reconciliation, or layout. Search targets already in the
scene stay Focus, cross-file targets reroot Focus, and hidden headings reveal
only the required ancestor chain. **Open full hierarchy** explicitly returns to
All Hierarchy; the **All** scope action returns to the actual prior All history
checkpoint. Switching Focus layout preserves the selected visible node (or
root) at a runtime-only screen point and performs no KG6/All Network/workspace
work. Node selection survives; a Hierarchy edge selection is cleared with an
announcement before Network mounts.

Settings expose Folder clustering and a normalized 0–100% Strength directly for
All Network. The slider reuses persisted `folderCohesion`; spacing changes keep
the selected strength, Off retains it, and Advanced is a transient disclosure
rather than a persistence toggle. These controls can be configured from any
view, but Hierarchy projection and W3 layout do not observe them.

Settings use three keyboard-accessible sections: **Preferences** contains the
ordinary Trackpad Zoom choice, **Sandbox** contains graph appearance/layout
experiments, and **Source & Diagnostics** retains source operations and evidence.
Sandbox also provides a transient Focus Network density-framing strength: 0%
reproduces legacy ratio 1, 100% uses the measured SPACING1B ratio, and intermediate
values linearly interpolate the camera target. It defaults to 100% per launch and
is intentionally absent from the v1 preference payload. Reset Sandbox restores
only Focus Root appearance, All Network layout, density strength, and Experimental
exposure; Trackpad Zoom, source configuration, view/history, queries, and vault
data remain unchanged.

**Hierarchy Depth** is hidden in All Network and visible in the other three
combinations. In Focus it applies automatic depth only beneath the root file;
depth 0 has no automatic headings, while depths 1–3 reveal the corresponding
structural generations. Choosing a preset clears manual disclosure overrides.
A compact **Custom** marker reports surviving explicit expand/collapse choices.
Focus depth changes preserve the root's screen point in either renderer without
persisting raw coordinates. Old schema-v3 Local state that encoded automatic
detail as depth 0 plus an expanded root is normalized on restore; other manual
IDs are preserved. Schema v3 did not record whether that root marker was added
automatically or manually, so the compatibility rule deliberately removes only
the depth-0 focused root to keep **Files only** truthful.

**Heading limit** lives in the toolbar's floating **Filters** panel and remains
separate from Hierarchy Depth. `#` through `######` are literal canonical Markdown
heading ceilings; **No limit** preserves prior
disclosure. Explicit expansion cannot bypass the ceiling, and references from
hidden headings retain normal endpoint roll-up and aggregation. Navigation to a
deeper canonical search result minimally widens an active ceiling before
revealing, selecting, and centering the target.

Blocks remain opt-in through the one labelled **Blocks** checkbox under
**Filters → Entity Content** and still require explicit expansion of their
visible parent, preserving KG6's conservative block disclosure rule. Documents
and Sections remain ordinary entity filters. Open branches retain a collapse
control even when all of their descendants are visible.

Global Find searches the full canonical snapshot, including entities hidden by
disclosure or graph filters. Selecting any search, breadcrumb, source,
backlink, resolved-target, or ambiguity-candidate action uses one navigation
pipeline: exit focus, reveal ancestors through KG6, widen only conflicting
path/entity/text filters with an announcement, reproject, select, and request a
renderer-only center. Graph filters expose derived top-level path scopes,
entity content kinds, heading depth, and reference statuses in a controlled
nonmodal panel. In normal mode it overlays the graph; inside maximized Tools it
reflows within that surface's single vertical scroll owner. Search is exact/prefix/substring
over names, headings, breadcrumbs, paths, and block line labels; it is not
fuzzy, semantic, or Markdown body search.

Opaque entity IDs use prebuilt maps. Canonical search is deferred and memoized;
search results are capped at 30; provenance groups render 20 rows at a time;
secondary references remain paged in groups of 100. No renderer virtualization
switch is introduced. KG12A budgets and the KG12B worker decision are documented
in `docs/PERFORMANCE.md`.

## Scope boundary

The hierarchy tree in **Developer → Diagnostic Evidence** remains KG5 diagnostic
UI only. Its expanded state is separate from KG6 projection state. Report mode
provides paths, breadcrumbs, raw targets, and exact spans, but no source text,
preview, live filesystem access, open-in-source action, or write-back. Its own
expanded evidence-tree state remains transient and separate from KG9B.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build
pnpm dev
pnpm desktop:dev
```

## HIER0 availability

All opens in Network by default. All Hierarchy remains intact behind Settings >
Sandbox > Experimental > Show All Hierarchy (Off by default), or as emergency
recovery when All Network is unavailable. Focus always exposes Network and
Hierarchy. The collapsed Experimental disclosure is transient; its checkbox is a
general graph preference in the existing v1 record, separate from schema-v3 views.
Enabling it does not prepare a projection/layout or change the active layout.
Disabling it while All Hierarchy is active performs the normal anchored Network
transition and retains renderer viewport bookmarks. Other graph controls patch
one complete preference record; failed storage writes preserve session behavior.

`exploration-model.ts` owns the pure availability policy. GraphExplorer applies
it to hydration (after saved metadata is restored), Layout, history, Focus exit,
live root removal, reset and renderer recovery. `navigation-history.ts` normalizes
inaccessible checkpoints to available modes and coalesces adjacent equivalent
semantic states created by normalization, retaining renderer bookmarks. Exact
Heading/Block Search, breadcrumbs and Inspector navigation reuse the Local
navigation planner to reveal/select/center the target in Focus Hierarchy when
All Hierarchy is hidden. Explicit full-hierarchy actions respect the same gate.
Focus Network failure offers Focus Hierarchy or Return to All; it does not enable
the experiment. No canonical, QUERY1, Saved Filter, or view schema changes occur.

See [HIER0 validation](../../docs/HIER0_VALIDATION.md) for measurements and gates.
