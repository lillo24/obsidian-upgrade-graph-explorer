# Explorer Components

These components present the KG8 explainable-navigation workflow around the KG7
graph plus secondary KG5 evidence. They do not load files, validate JSON, alter
canonical truth, or own a platform storage implementation.

- `GraphExplorer.tsx` composes report-scoped projection/inspection workspaces,
  compact structural/focus/workspace controls, controlled Filters and Settings
  overlays, shared canonical navigation, graph selection, the transient unified
  Inspector drawer,
  saved-view hydration/alert/reset orchestration, transient graph Back/Forward
  checkpoints, and semantic renderer viewport requests. Across live snapshots it
  reconciles current KG6 state before
  projection, rebuilds inspection/search indexes, preserves surviving selection
  and semantic viewport context, and safely clears missing selections. It keeps
  the canvas and the single stateful Search instance mounted across shell/live
  changes and does not re-derive graph edges or persist renderer coordinates or
  shell visibility. Maximize/restore is passed to the renderer as a narrow
  callback so the canvas control stack remains the mode trigger. KG13B1 adds
  lazy Structure/Global and KG13B2A adds explicit Local Free, each with separate
  semantic viewports and cross-mode history/context. Local uses the KG6 Focus
  root, captures a transient Global screen anchor, keeps Global topology/cache
  isolated from Local disclosure, and exits explicitly if its stable root is
  lost. Exact in-memory layout coordinates and the saved semantic viewport are
  applied before the first visible mode-switch draw; Local hop/direction changes
  preserve that camera. Transition anchors and Local Fit requests are consumed
  once, preventing remount or Back/Forward from replaying stale camera work.
  Graphology, worker positions, and transition points are never persisted.
  Local Structured remains the next extension. Inactive Focus
  has no toolbar chrome; canonical nodes enter or retarget Focus through the
  renderer's direct pointer/keyboard callback while selection remains intact.
- `GraphHistoryControls.tsx` owns the compact, accessible Back/Forward arrow
  group shared by the normal toolbar and maximized floating controls. It receives
  only availability and callbacks; graph state, semantic viewport, keyboard
  policy, and storage remain outside the component.
- `controlled-selection.ts` prevents equivalent controlled renderer selection
  echoes from creating a React Flow update loop during programmatic handoff.
- `GraphSettings.tsx` presents the shared normal/maximized Settings popover and
  its Graph Appearance, Global Layout, and Graph Interaction sections. Global
  layout controls edit one validated serializable preference rather than
  scattering component-local physics values. It accepts narrow
  App-owned Source/Developer presentation content without importing source
  providers; global focus-root and gesture preference storage ownership remains
  in `../preferences/`.
- `SourceSettingsSection.tsx` presents safe current-source metadata, browser
  report/sample switching, desktop vault/rescan actions, and exceptional local
  identity recovery from callbacks owned by `App.tsx`.
- `DeveloperSettingsSection.tsx` owns the Settings launcher for secondary
  diagnostic evidence.
- `DiagnosticEvidenceDialog.tsx` owns the accessible modal surface while
  `diagnostic-evidence-overlay.ts` owns its scroll lock, Escape handling, and
  focus restoration. `DiagnosticEvidenceContent.tsx` composes the existing KG5
  filter, hierarchy, reference, summary, diagnostic, and probe panels inside it.
- `WorkspaceNotice.tsx` presents transient source progress and actionable
  source failures above the canvas without consuming workspace layout.
- `EntitySearch.tsx` performs bounded deferred search over the full canonical
  inspection index, independently from visible graph filters.
- `GraphFilters.tsx` owns the controlled toolbar trigger and responsive nonmodal
  panel for path, entity content, literal Markdown Heading limit, reference
  status, the local Advanced query draft/apply boundary, and workspace-scoped
  Saved Filters. Structure remains a separate Files only / 1 / 2 / 3 levels control.
  Blocks is
  represented once through disclosure state; `graph-filter-count.ts` derives
  its user-visible active-group badge, while `graph-filters-overlay.ts` gives
  the panel first ownership of Escape and restores trigger focus.
  `graph-workspace-overlays.ts` owns the pure Settings/Filters/Tools exclusivity
  policy without coupling transient chrome to KG6 projection state.
- `maximized-graph-mode.ts` owns the reversible body scroll lock and Escape-key
  exit listener for the transient application maximize mode. The graph shell
  closes a nearer Tools, Settings, or Filters surface before leaving maximized
  mode. Their visibility and Inspector visibility remain session-only state.
- `GlobalGraphView.tsx` is the only lazy production import of the direct Sigma
  canvas. It owns the Worker service and a bounded module-lifetime layout cache
  so Structure startup stays Sigma-free and exact results survive mode switches.
- `LocalGraphView.tsx` owns the separate Local Free worker client and bounded
  page-lifetime layout cache. An exact hit warms the first canvas draw; otherwise
  it mounts deterministic seed geometry immediately, then adopts only the latest
  refinement.
- `use-worker-service-disposal.ts` owns Strict Mode-safe Worker service leases:
  same-tick development probes keep the service, while a real unmount disposes it.
- `ProvenanceInspector.tsx` presents user-facing identity, breadcrumbs,
  outgoing links, backlinks, connection occurrences, structural containment,
  and plain-language link problems in bounded groups. Canonical IDs, exact
  ranges, resolution metadata, ambiguous candidate mentions, and collapsed
  internal occurrences stay in a closed-by-default technical disclosure. It is
  always an overlay drawer, keeps clear-selection separate from collapse, and
  resets bounded content only when the inspected selection changes. A selected
  Global document receives **Open Local** and the exact **Open in Structure**
  handoff. In Local, the selected expandable entity receives one accessible
  Expand/Collapse action while Inspector remains shared rather than duplicated.
- `SummaryPanel.tsx` renders derived canonical/evidence counts.
- `HierarchyPanel.tsx` lazily expands document, section, and block ownership.
- `ReferencesPanel.tsx` pages filtered references and exposes provenance details.
- `EvidencePanel.tsx` keeps diagnostics and non-canonical probes visibly separate.

`App.tsx` owns source/live status, source-session switching, report identity
provenance, maximized shell state, diagnostic-dialog state, and transient
secondary diagnostic filters. Presentation-only Settings sections receive this
state through a narrow composition seam. `desktop-live-vault.ts` owns non-React
serialized live transactions, pause/recovery, and watcher lifecycle.
`graph-state.ts` owns pure KG6 interaction transitions and web-boundary
normalization that keeps legacy entity-kind filters internally eligible for
blocks while `disclosure.includeBlocks` remains the sole visible opt-in.
`global-view.ts` owns the effective documents-only/resolved-only Global KG6
state and exact containing-document mapping without mutating Structure state.
`local-view.ts` owns entry and navigation plans that normalize a document root,
keep visible results Local, reroot cross-document results, and reveal the
minimum hidden ancestor chain.
`navigation-history.ts` owns the bounded, immutable session history over KG6
state plus presentation mode and separate canonical viewport bookmarks, while `graph-history-shortcuts.ts`
owns exact graph-context keyboard classification. `navigation.ts` owns the
verified target-reveal plan, and `report-view.ts` owns secondary evidence
transformations.
`../persistence/` owns the localStorage adapter and pre-autosave hydration; the
source-neutral schema/reconciliation lives in `packages/view-state`.
`../preferences/` separately owns global focus-root/trackpad preferences, the
Free/Structured future seam (Free only today), and their versioned localStorage key.
