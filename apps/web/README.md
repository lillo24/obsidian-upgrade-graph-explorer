# Web Structural Graph Explorer

Status: **STABLE — KG12A adds optional memory-only correlation without changing normal product behavior.**

This package owns the browser SPA, validated KG5 report selection, Tauri-only
live vault orchestration, KG6 graph interaction state, guarded browser persistence, graph selection, canonical
navigation orchestration, and provenance-first inspection UI. It accepts one
runtime-validated report selected by the user or the committed neutral sample.
It does not implement native I/O, upload reports, modify canonical truth, persist
renderer layouts/raw transforms, or derive renderer semantics.

```text
selected report JSON → runtime validation → canonical inspection/search
                                   └───────→ KG9B saved view → KG6 projection
                                                          → KG7 renderer
                                                     ↘ KG8 inspector/navigation
                                   ↘ secondary KG5 evidence UI

Tauri Open Vault → watcher + buffered one-shot acquisition
                 → serialized source plans → KG10 candidate + report
                 → identity commit → in-place graph/UI update
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
    desktop-vault.ts Lazy KG10 initialization, report construction, and truthful identity commit orchestration.
    desktop-live-vault.ts Serialized watch, candidate commit, pause, and full-resync lifecycle.
    performance.ts    Query-gated browser recorder and local inspection API.
    graph-state.ts    Pure disclosure/focus/filter interaction reducer.
    navigation.ts     Shared reveal/filter-widening/navigation planner.
    persistence/      Stable-report eligibility, hydration, and localStorage adapter.
    report-view.ts    Pure reference/hierarchy presentation transformations.
    sample-report.json Deterministic private-safe report generated from fixtures.
    components/       Primary graph workspace and secondary diagnostic panels.
    App.css           Responsive component layout and accessible interaction states.
    index.css         Document defaults, typography, and overflow protection.
```

The `components/README.md` maps the presentation components. The graph workspace
creates projection/inspection workspaces for each committed snapshot and passes
only a `ViewProjection` plus semantic viewport requests to
`@icarus-graph-explorer/renderer-reactflow`. A real source-session switch keys
a complete transient selection/search reset and workspace-specific hydration;
live revisions reconcile current state and update the mounted explorer in place.

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
rescans. It maps provider plans to KG10, builds a candidate report, persists the
candidate catalog, and only then publishes one matching runtime/report state.
Non-Markdown-only plans rebuild compatibility evidence without KG10; net no-ops
retain the report object. Report, internal, or identity-write failures retain
the last committed state and pause until a successful **Rescan Vault**.

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
usable in memory and never read or write saved state. The schema-v1 saved record
is keyed by encoded stable workspace ID and contains only structural disclosure,
the optional literal heading ceiling, focus, user-facing path/entity/status
filters, and an optional canonical entity plus positive zoom bookmark. Older
schema-v1 records without the optional ceiling restore with no heading limit.

Hydration and source-evolution reconciliation happen synchronously before the
autosave effect. Stale disclosure IDs, focus roots, path scopes, and viewport
anchors are dropped with non-fatal status; collapsed disclosure wins conflicts.
Legacy schema-v1 entity-kind filters are normalized at the web boundary so block
eligibility cannot contradict the single visible **Blocks** choice; the saved
schema version does not change. `disclosure.includeBlocks` remains the user
intent that decides whether blocks may be projected.
Corrupt, inaccessible, or unsupported stored values are not overwritten or
silently deleted. Writes stop after one failure. **Reset saved view** deletes
only that workspace's view, restores documents-only defaults, clears transient
search/selection, and fits the graph. It never resets the KG9A catalog.

Live snapshot reconciliation is not localStorage hydration. It keeps surviving
disclosure, focus, heading/block choices, filters, and semantic viewport by
stable canonical ID, removes only stale IDs/path scopes, and then lets ordinary
autosave persist that current state under the same workspace ID. Search,
Inspector visibility, maximize mode, and surviving selection stay in memory;
selection clears with an announcement only when its projected element vanishes.

The browser key contains no report filename, vault basename, or path. Search,
hover, graph/inspector selection, pagination, renderer graph data, Dagre
coordinates, and raw viewport x/y remain transient. Browser reload restores the
bundled stable sample automatically; a user-selected report file must still be
selected again because KG9B does not persist browser file handles.

KG12A instrumentation requires either `?performance=1` in a browser or an
explicit `VITE_ICARUS_PERFORMANCE=1` diagnostic build for Tauri. It records
named pure, commit, paint, viewport, search, inspection, and live-adoption
phases in memory and exposes a local `window.icarusPerformance` inspection API.
Normal builds/loads do not create a recorder or API. The Vite variable changes
only instrumentation availability and must be set before `desktop:dev` or
`desktop:build`; debug/native timings must be labeled by build mode. Live
controller correlation tokens are monotonic within one controller, survive
only long enough to join I16/I17/I18 processing to the matching paint, and
never enter reports or persistence.

## Graph interaction boundary

The default view is documents-only; top-level sections and explicit per-entity
disclosure remain KG6 state. Selecting an entity enables one-to-three-hop focus
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

**Heading Depth** lives in the toolbar's floating **Filters** panel and remains
separate from Documents/Top-Level structural depth. `#` through `######` are
literal canonical Markdown heading ceilings; **No limit** preserves prior
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
