# Explorer Components

These components present the KG8 explainable-navigation workflow around the KG7
graph plus secondary KG5 evidence. They do not load files, validate JSON, alter
canonical truth, or own a platform storage implementation.

- `GraphExplorer.tsx` composes report-scoped projection/inspection workspaces,
  compact structural/focus/workspace controls, controlled Filters and Settings
  overlays, shared canonical navigation, graph selection, the transient unified
  Inspector drawer, and the transient Network Explorer drawer,
  saved-view hydration/alert/reset orchestration, transient graph Back/Forward
  checkpoints, and semantic renderer viewport requests. Across live snapshots it
  reconciles current KG6 state before
  projection, rebuilds inspection/search indexes, preserves surviving selection
  and semantic viewport context, and safely clears missing selections. It keeps
  the canvas and the single stateful Search instance mounted across shell/live
  changes and does not re-derive graph edges or persist renderer coordinates or
  shell visibility. Maximize/restore is passed to the renderer as a narrow
  callback so the canvas control stack remains the mode trigger. KG13B1 adds
  internal Structure/Global/Local renderers through the user-facing Scope ×
  Layout model, each with separate
  semantic viewports and cross-mode history/context. Local uses the KG6 Focus
  root, captures a transient Global screen anchor, keeps Global topology/cache
  isolated from Local disclosure, and exits explicitly if its stable root is
  lost. Exact in-memory layout coordinates and saved semantic viewports remain
  available for within-session mode/history restoration. The app marks each
  fresh source-session mount as `initialViewport="fit"`, so startup, report
  upload, vault open, and sample restoration issue one Fit after authoritative
  layout and spatial-rule adoption instead of reopening onto a stale camera.
  Live revisions do not remount the source session and therefore do not refit.
  Local hop/direction changes preserve that camera. Transition anchors and Local
  Fit requests are consumed once, preventing remount or Back/Forward from
  replaying stale camera work.
  Graphology, worker positions, and transition points are never persisted.
  SPATIAL1 also owns the independent workspace spatial-override session and
  passes its resolved map only to All Network. SPATIAL2B expands the web-owned
  Arrange lifecycle and write-before-adopt callbacks to complete Pull/Place
  rules. It derives one full canonical folder tree from snapshot document paths,
  separately annotates current query visibility, and passes that tree to the
  editor without adding folder entities to KG6. Per-pointer gesture state remains
  inside Sigma.
  GLOBALVIS1 compares the canonical resolved physics subset before incrementing
  the explicit All Network layout generation. Visual-only preference edits are
  still saved immediately but reach only Sigma's presentation refresh path;
  true reference/folder/spacing changes retain the latest-wins worker path.
  NETWORKSETTINGS1 resolves one narrow Network preference object and passes it
  to Focus Network. Its Reference Pull primitive alone enters Local layout
  identity; its three visual values reach only the Local session's reducers and
  Sigma label threshold. All-only folder controls never reach Local physics.
  Network Explorer consumes the same already-completed All/Focus Network
  projection and resolved Visual Group presentation map as the canvas. Its
  selection callback updates the single controlled graph selection and issues a
  renderer-specific semantic center request at the current zoom ratio; it never
  records history, changes projection, or reads Sigma/Graphology state. On wide
  screens both side drawers may coexist; at the existing 900 px breakpoint the
  most recently opened drawer owns the overlay and the other closes without
  stealing focus.
  In All Network it exposes `Arrange folder` for canonical folders including
  container-only folders, a root-folder fallback, and exact-root badges that
  summarize Pull/Place, scope, and strength. Exact-root rules can be edited or
  removed without changing child rules. These controls focus the canvas rule
  editor but do not change graph selection, projection, topology, navigation
  history, or automatic layout.
  `ExplorationControls.tsx` presents accessible All/Focus and Network/Hierarchy
  choices derived from schema-v3 state. Both Focus layouts share the same
  memoized projection. The selected visible node, or root fallback, crosses the
  renderer boundary only as a transient viewport point. Layout switching is not
  history and never starts hidden workers or Global/projection work. Inactive Focus
  has no toolbar chrome; canonical nodes enter or retarget Focus through the
  renderer's direct pointer/keyboard callback while selection remains intact.
- `GraphHistoryControls.tsx` owns the compact, accessible Back/Forward arrow
  group shared by the normal toolbar and maximized floating controls. It receives
  only availability and callbacks; graph state, semantic viewport, keyboard
  policy, and storage remain outside the component.
- `ExplorationControls.tsx` owns the accessible Scope and Layout button groups,
  focused-root text, and explained disabled Focus state. `../exploration-model.ts`
  owns the pure four-way mapping to existing internal modes plus the hierarchy
  density decision: All uses `compact-schematic`, Focus uses `extended`.
- `StructureDepthControl.tsx` owns the labeled Hierarchy depth select and
  compact Custom override indicator, and
  `structure-depth-selection.ts` maps its four options onto the existing
  structural-depth action. Choosing a depth is a fresh preset: it clears
  per-entity expand/collapse exceptions while preserving the independent
  Heading limit, Blocks option, Focus, and graph filters.
- `NodeSizeControl.tsx` is the controlled multiplier slider for Network File
  actions. It always displays a value (1.00× without an entry), and Reset removes
  the entry. There is no sizing-mode selector. It emits one multiplier/reset
  callback per input event;
  eligibility, validation, storage, and renderer mapping remain outside. It
  occupies the editor screen of the shared Network Explorer action portal.
- `controlled-selection.ts` prevents equivalent controlled renderer selection
  echoes from creating a React Flow update loop during programmatic handoff.
- `GraphSettings.tsx` presents the viewport-bounded shared normal/maximized
  Settings popover. Its transient keyboard-accessible tabs separate ordinary
  Preferences, the graph-presentation Sandbox, and App-owned Source & Diagnostics
  controls while keeping all panels mounted. `graph-settings-tabs.ts` owns the
  wrapping three-tab keyboard transition. One visible Network section owns the
  shared Reference Pull, Base node size, Link thickness, and Label threshold for
  All + Network and Focus + Network. The All Network section retains Folder
  clustering, normalized Strength, Spacing, Folder separation, and the persisted
  0–100 link-influence setting. Its Advanced disclosure is transient. All four
  controls still edit one validated serializable preference rather than adding
  component-local or per-renderer state; global focus-root and gesture preference
  storage remains in `../preferences/`.
  Separate All and Focus density sliders are page-lifetime live A/B camera
  controls: changing either preserves that renderer's semantic screen anchor
  and previews the new ratio without Fit, layout, or Pull work, even from a
  user-owned viewport. Their 0–150% labels distinguish Legacy (0), Auto (100),
  and Sandbox-only Stronger amplification (101–150); both still default to 100.
  All-only physics/visual controls remain grouped and
  explicitly scoped. Reset Sandbox deliberately excludes Trackpad Zoom, source
  settings, spatial folder intent, and saved view state. Temporary SPACING1B QA
  readouts mirror the mounted renderer sessions' ratios and fallback evidence;
  they are not product state and clear when their Network renderer unmounts.
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
  `entity-search-disclosure.ts` keeps its query and result disclosure separate:
  navigation and Escape close results without erasing the query, while focus or
  a click can reopen them.
- `GraphFilters.tsx` owns the controlled toolbar trigger and responsive nonmodal
  panel for path, entity content, literal Markdown Heading limit, reference
  status, the shared Advanced query editor for Hierarchy, and workspace-scoped
  Saved queries. In Network it points to the drawer's query and Saved queries
  bookmark control instead of rendering duplicates. Hierarchy depth remains a
  separate four-option select.
  Blocks is
  represented once through disclosure state; `graph-filter-count.ts` derives
  its user-visible active-group badge, while `graph-filters-overlay.ts` gives
  the panel first ownership of Escape, restores trigger focus for keyboard
  dismissal, and closes on an outside pointer action without stealing the new
  target's focus. All Network preserves the same applied Advanced query while
  deriving its documents-only projection.
  `graph-workspace-overlays.ts` owns the pure Settings/Filters/Tools exclusivity
  policy without coupling transient chrome to KG6 projection state.
- `VisualGroups.tsx` owns the controlled Groups trigger, enabled-count badge,
  bounded normal/maximized panel, local create/edit drafts, fixed-palette
  selector, immediate enable/priority mutations, confirmed delete, active-query
  copy, and two-step corrupt-registry recovery UI. `GraphExplorer.tsx` retains
  the single write-before-adopt session commit and memoized compile/lookup/map
  boundaries; `visual-group-editor.ts` owns submit-time trim, name bounds, and
  positioned QUERY1 canonicalization. Filters and Groups share one active
  tool-panel owner; the side drawers remain independent on wide screens and
  mutually exclusive only at the narrow workspace breakpoint.
- `maximized-graph-mode.ts` owns the reversible body scroll lock and Escape-key
  exit listener for the transient application maximize mode. The graph shell
  closes a nearer Tools, Settings, or Filters surface before leaving maximized
  mode. Their visibility plus Inspector and Network Explorer visibility remain
  session-only state.
- `GlobalGraphView.tsx` is the only lazy production import of the direct Sigma
  canvas. It owns the Worker service and a bounded module-lifetime layout cache
  so Structure startup stays Sigma-free and exact results survive mode switches.
  The canvas keeps its renderer session mounted when filters produce zero nodes
  and overlays an explicit graph-empty recovery state, avoiding WebGL context
  churn when results return. Exact in-memory cache restoration is intentionally
  silent; only pending layout work and failures need persistent canvas feedback.
  Its narrow document-activation callback sends Global double-click through the
  same `GraphExplorer` Focus/history/transition-anchor path as Inspector;
  Sigma default double-click zoom is already consumed inside the renderer.
- `LocalGraphView.tsx` owns the separate Local Free worker client and bounded
  page-lifetime layout cache. An exact hit warms the first canvas draw; otherwise
  it mounts deterministic seed geometry immediately, then adopts only the latest
  refinement. Its mount boundary reports an invalid renderer input without
  unmounting the application shell.
- `LocalStructuredGraphView.tsx` owns the lazy React Flow Local schematic,
  caller-owned W3 service, bounded exact memory cache, semantic Structured zoom
  adapter, and explicit mount-failure boundary. It reuses `GraphCanvas` rather
  than duplicating its latest-layout lifecycle.
- `use-worker-service-disposal.ts` owns Strict Mode-safe Worker service leases:
  same-tick development probes keep the service, while a real unmount disposes it.
- `NetworkExplorer.tsx` owns the accessible, projection-scoped `tree` surface
  for both Sigma layouts. Fixed-height row virtualization keeps only the
  viewport plus overscan mounted while roving focus operates over the complete
  logical folder/node list. Only folders disclose; File/Heading/Block/Diagnostic
  rows synchronize controlled canvas selection and expose the single node-action
  menu through right-click, Shift+F10, ContextMenu, or the visible Actions button.
  Arrow keys navigate folders/rows; Enter/Space toggles folders or selects nodes.
  External selection reveal is edge-triggered, so ordinary scrolling and row
  virtualization never pull the drawer back to an unchanged selected root.
  Newly selected external nodes reveal their source-folder ancestors without
  moving DOM focus. Folder overrides live at GraphExplorer level, keyed by path,
  and survive query/live membership changes and drawer remounts until the source
  session ends. `../network-explorer-model.ts` owns deterministic source ordering,
  virtual ranges, and keyboard plans; `../network-explorer-folders.ts` builds only
  current-projection source folders and flattens visible rows iteratively.
  Depths 1/2 default open, 3+ closed; root is not counted. Projected headings/blocks
  visually nest below their File without File disclosure; if File is filtered
  out, they remain under the real folder. Their ARIA parent is always that folder.
  Visual indent is capped at 12 levels to retain usable labels on deep paths;
  logical ARIA depth is exact. Diagnostics trail at root, never grouped by target.
  Neither module reads edges or reconstructs hidden canonical topology.
  The SPATIAL2B rule badges and actions are exact-root annotations supplied by
  `GraphExplorer`; inherited parent rules are not presented as owned by a child.
  The canvas editor's separate full-workspace DOM scope tree supplies accessible
  parity for Custom inclusion/exclusion, while graph clicks are only a shortcut.
  Graph selection highlights immediately but defers that automatic reveal;
  confirmed canvas single-clicks carry a fresh, projection-scoped transient request
  through `GraphExplorer.tsx`, even for the same selected node. Those requests align
  the row top with the viewport, clamped at the list end, and mount virtual rows
  without taking keyboard focus. Keyboard and other selection reveals retain
  minimum scrolling. Requests are not persisted or replayed when reopening a drawer.
  Visible rows show only the title and an optional Focus badge; path/context
  remains in accessible names and node tooltips, without a secondary text line.
  Every projected node exposes one shared Actions surface for Focus, Inspect,
  and supported Hide behavior. Canonical Files add Size and show their custom
  multiplier when set. Button, right-click, and keyboard invocation share one
  logical action target. Opening Size or changing its value never selects or
  centers the node.
- `GraphQueryEditor.tsx` is the controlled QUERY1 presentation reused in Network
  Explorer and Hierarchy Filters. `use-graph-query-draft.ts` lives at GraphExplorer
  level and preserves transient drafts across placement/unmounts. It commits only
  through the existing set-query callback; `../network-explorer-query-actions.ts`
  validates atomic applied/draft exclusion mutations and derives chip labels.
  The compact Network placement omits explanatory headings/help and uses labelled
  Apply/Clear icons beside the unchanged-height textarea and keeps validation
  errors, but omits dirty/reset clutter. Hierarchy retains its explanatory editor
  and Reset draft. Atomic applied/draft Hide/restore behavior is unchanged.
- `SavedGraphQueries.tsx` shares the existing registry-backed management UI
  between Hierarchy Filters and `SavedQueriesPopover.tsx` in Network Explorer.
  The latter owns only local open/position state: a viewport-bounded nonmodal
  portal, initial input focus, Escape/Close trigger restoration, and outside
  dismissal without stealing focus. Opening it never changes graph state.
- `NetworkExplorerHiddenItems.tsx` presents exact-path File exclusions and
  exact-folder subtree exclusions as separately labelled recovery-chip rows below
  the Network query. `../network-explorer-chip-layout.ts`
  fits measured chip widths plus a more disclosure; expansion wraps all chips
  inside the existing height-bounded controls area. Overflow chips remain
  measurable but are invisible, untabbable, and excluded from the accessible
  tree. This disclosure is local presentation state, not another hidden-file list
  or query source of truth; restoring one identity never removes the other type.
- `NetworkExplorerMenu.tsx` renders one accessible portal for the current logical
  row target, switching from its action menu to a multiplier/Reset Size editor for
  canonical Files without introducing a second menu. It owns enabled-item
  keyboard focus, viewport bounds, and outside dismissal;
  NetworkExplorer invalidates it on scroll/projection changes and safely restores
  virtual row focus. `../network-explorer-context.ts` owns target normalization,
  Focus/Hide/Size eligibility and keyboard transitions. Scrolling closes the
  editor and focuses the drawer close button without revealing the selected row;
  value changes leave input focus intact. Application callbacks reuse
  existing Focus, Inspector and QUERY1 paths, never renderer topology or hiding.
  Query and Hidden controls share a height-bounded scroll area so short windows
  retain an independently scrollable virtual list.
- `ProvenanceInspector.tsx` presents user-facing identity, breadcrumbs,
  outgoing links, backlinks, connection occurrences, structural containment,
  and plain-language link problems in bounded groups. Canonical IDs, exact
  ranges, resolution metadata, ambiguous candidate mentions, and collapsed
  internal occurrences stay in a closed-by-default technical disclosure. It is
  always an overlay drawer, keeps clear-selection separate from collapse, and
  resets bounded content only when the inspected selection changes. A selected
  an All-scope entity receives **Focus** and the exact **Open full hierarchy**
  handoff. In Local, the selected expandable entity receives one accessible
  Expand/Collapse action while Inspector remains shared rather than duplicated.
  Selected canonical entities also show their ordered enabled Visual Group
  matches as Primary and optional Also matches; diagnostic nodes and edges omit
  the section.
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
state, passes canonical QUERY1 intent into that files-only topology, and maps
containing documents exactly without mutating Structure state.
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
`../preferences/` separately owns global focus-root/trackpad preferences and
the persisted Local Free/Structured presentation preference in its existing
versioned localStorage key.

HIER0: `ExplorationControls` receives explicit All-Hierarchy exposure and retains
Network-failure recovery; Focus always has both layouts. `GraphSettings` appends a
collapsed, keyboard-accessible Experimental disclosure in Sandbox.
`GraphExplorer` owns the complete preference record and applies the pure
availability policy at every activation boundary, including exact navigation,
history, live reconciliation, reset, and renderer failures. Both normal and
maximized Settings instances receive the same preference callbacks.

HIER3B: `ModularStructuredGraphView.tsx` is the lazy Focus + Hierarchy preview
boundary. It builds HIER1 only while mounted, derives renderer dimensions,
checks the bounded page cache, requests the dedicated A1 worker, validates and
maps one complete graph, and exposes explicit pending/cache/ready/warning/fatal
states. A replacement keeps the last valid graph after filtering identities no
longer in the current projection. A fatal first result asks GraphExplorer for a
session-only Classic fallback without changing the persisted preview choice.
`GraphExplorer.tsx` owns the presentation switch and semantic transition anchor;
switching implementations creates no navigation-history entry.

HIER4B-LIVE keeps Directional Bands as that preview's default and adds Soft
Folder Clusters as a Sandbox-only macro policy. `GraphSettings.tsx` exposes the
conditional 0–100 Folder strength slider alongside the existing Compass/Spine
and Crossing/Document controls. `ModularStructuredGraphView.tsx` sends the
normalized policy to the dedicated worker and keys the bounded cache by only
geometry-relevant values. Disclosure, reroot, filtering, exact hover, Secondary
presentation, and camera behavior continue through the existing projection and
React Flow seams.

HIER4B-FIX2 keeps exact folders as source truth while `GraphExplorer.tsx`
derives stable File identity/folder pairs from the canonical snapshot and owns
the workspace-keyed sparse display-intent session. `ModularStructuredGraphView.tsx`
builds the shared nested display tree, sends intent only for Soft requests, and
owns one File/folder context-menu target. Directional requests erase display
intent and retain their exact cache identity. Soft File and module-anchor
handles still come from final endpoint geometry; Heading and Block attachment
semantics remain exact.

The persisted Folder guides toggle is resolved after a current worker result is
adopted. Directional mode supplies the existing band strips; Soft mode supplies
renderer-only nested cluster regions from final module rectangles and visible
display-tree membership. Only the small Soft guide label accepts pointer or
keyboard context requests; large guide regions remain inert. File cards and
guide labels share Network's bounded context-menu portal. Menu/hover state and
guide visibility remain absent from every model, worker, effect, and cache
dependency that can request or change layout.
