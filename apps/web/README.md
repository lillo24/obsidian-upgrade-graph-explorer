# Web Multi-scale Graph Explorer

Status: **STABLE — KG13B2A adds bounded Local Free without replacing Structure or Global.**

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
                                                          → Local mapping/seed → Local layout worker
                                                     ↘ KG8 inspector/navigation
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
    navigation.ts     Shared reveal/filter-widening/navigation planner.
    local-view.ts     Local entry/reroot/minimum-reveal planner over KG6 state.
    navigation-history.ts Bounded session history over semantic graph checkpoints.
    graph-history-shortcuts.ts Exact graph-context Back/Forward shortcut policy.
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
direct Sigma/Graphology with separate layout protocols and caches. Each lazy
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
filters, explicit presentation mode, and canonical Structure/Global/Local
semantic viewport bookmarks. Schema v1 migrates to Structure; schema v2
preserves its explicit Structure/Global mode and does not infer Local from an
active focus. Local stores anchor plus Free ratio only. Raw x/y, transition
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
traversed view continues through normal KG9 autosave. **Back to Global** jumps
to the actual prior Global checkpoint while retaining skipped Local disclosure
checkpoints for Forward traversal.

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

The default Structure view is **Files only**. **1 level**, **2 levels**, and
**3 levels** automatically expose that many canonical section-tree generations;
explicit per-entity disclosure may continue beyond that baseline. Structure
changes remain ordinary NAV1 semantic actions. Selecting an entity enables one-to-three-hop focus
with incoming/outgoing/both direction. Selection and hover affect presentation
only. Diagnostic targets can be selected but never focused or expanded. The
primary inspector resolves projected selection to canonical descriptors and
exact occurrences, then keeps that internal model behind a user-facing boundary:
normal relationship summaries count only outgoing links and backlinks, while
candidate mentions and internal collapsed relationships remain technical context.

Hover temporarily emphasizes a node or edge's direct neighborhood and fades
unrelated rendered content only until pointer leave. Click or keyboard selection
keeps the chosen element visibly selected without persistent graph-wide fading.
Focus remains a reduced projection rather than a visual opacity treatment.

Global **Open Local** is the single scale-down action. It captures only the
selected file's runtime viewport point, normalizes the KG6 Focus root to that
document, reveals its direct headings, and keeps neighboring files collapsed.
Local renders a deterministic seed immediately and refines it in a separate
latest-only Worker. Expand/Collapse is available in the shared Inspector;
Focus hops/direction and the existing Blocks/filter controls remain shared.
Ordinary Local zoom, pan, hover, selection, and Inspector activity perform no
projection, Graphology reconciliation, or layout. Search targets already in the
scene stay Local, cross-file targets reroot Local, and hidden headings reveal
only the required ancestor chain. **Open in Structure** and **Back to Global**
are explicit recovery/scale-up paths. Local Structured is not exposed yet.

**Heading limit** lives in the toolbar's floating **Filters** panel and remains
separate from Structure. `#` through `######` are literal canonical Markdown
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
