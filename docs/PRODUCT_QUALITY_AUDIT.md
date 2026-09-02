# Product quality audit

Status: **CONDITIONAL — the current product is suitable for continued internal
and release-candidate testing, but it is not ready for external distribution.**

KG14A audited the product at merge `cf2cd6ec4c816a85a3cd77e7ed1af05d1b47ee82`
(PR #43), then applied only five narrow fixes required to complete truthful QA.
The canonical model, schema v3, Scope × Layout architecture, and source-neutral
package boundaries remain unchanged.

The strongest parts of the product are transactional live-vault adoption,
explicit failure behavior, renderer-worker isolation, deterministic recovery,
and privacy boundaries. The release gate is held by a major keyboard/screen
reader gap in both Network renderers and by unfinished desktop security and
distribution configuration. Onboarding, query feedback, repeated-reference
inspection, and progress communication are important follow-up polish.

## 1. Current workflow map

Scope controls how much knowledge is included. Layout controls how that
knowledge is presented. Regional is a visual level of detail, not a fifth
mode.

| User choice       | Product meaning                              | Renderer   | Detail behavior                                                                                                    |
| ----------------- | -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| All + Network     | Workspace-wide document network              | Sigma      | Files only; reference status and path/query filters apply; folder clustering changes positions, never edges.       |
| All + Hierarchy   | Workspace-wide structural schematic          | React Flow | Compact cards; Files only/1/2/3 apply across eligible visible files; manual disclosure creates Custom.             |
| Focus + Network   | Bounded neighborhood around one file         | Sigma      | Hops/direction bound the file neighborhood; shared detail state may reveal hierarchy below the focused root.       |
| Focus + Hierarchy | The same bounded neighborhood as a schematic | React Flow | Extended cards; automatic depth applies to the root, while neighbor files expand only through explicit disclosure. |

Search spans canonical entities even when a result is outside the current
projection. Selecting a result reveals or centers it and establishes the file
needed to enter Focus. Back/Forward traverses semantic graph navigation.
Saved view state restores Scope, Layout, disclosure, filters, and semantic
viewports for a stable workspace. Graph preferences, Saved Filters, and Visual
Groups are separate persisted systems.

## 2. Overall readiness

| Area                                        | Readiness                                   | Evidence                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical correctness and source neutrality | Ready                                       | Package contracts, schema-v3 tests, projection/inspection oracles, and source-neutral renderer boundaries.                                                                     |
| All/Focus and Network/Hierarchy workflows   | Ready with polish work                      | Production-browser traversal of all four combinations, Hops/direction, depth 0–3, Custom disclosure, history, and reload.                                                      |
| Live-vault safety                           | Ready                                       | Ordered prepare → persist → commit, latest-result rejection, paused recovery, last-valid-graph preservation, and Rescan tests.                                                 |
| Browser runtime                             | Ready after KG14A fixes                     | Production build exercised without current warnings/errors; the Network refresh crash and missing Focus-root crash found by KG14A are fixed and regression-tested.             |
| Accessibility                               | Not release-ready                           | Hierarchy has a usable DOM path. Both Sigma canvases are deliberately `aria-hidden` and expose no browsable node equivalent.                                                   |
| Desktop security/distribution               | Not release-ready                           | Narrow filesystem capabilities are good, but CSP is disabled, versions remain `0.0.0`, and bundling is inactive.                                                               |
| Performance                                 | Ready for bounded use; feedback gap remains | Worker split and small profiles are healthy. A prior aggregate-only real-vault Rescan took about 9.7 seconds, while the UI exposes phase text rather than meaningful progress. |

No evidence supports replacing either renderer, changing the canonical model,
or adding a general cache in KG14.

## 3. Top findings

### KG14A-01 — topology-changing Network filters could crash the workspace

- **Category:** Reliability
- **Severity / class:** P0 / Must — fixed in KG14A
- **Confidence:** High
- **Workflow:** All + Network → Filters → change reference-status/query result
- **Observed behavior:** Production QA removed and re-added diagnostic nodes
  while a Visual Group style effect was pending. Sigma attempted a partial
  repaint against its previous node index and threw `node ... can't be repaint`,
  unmounting the application.
- **Why it matters:** An ordinary filter action made the critical exploration
  path unusable and discarded the in-memory UI session.
- **Reproduction:** Open All + Network with an enabled Visual Group, then change
  a filter that adds or removes projected nodes before Sigma's topology refresh
  completes.
- **Evidence:** Production-browser console/blank workspace; focused regression
  in `packages/renderer-sigma/src/visual-group-style.test.ts`.
- **Likely implementation area:** Global Sigma session refresh ordering.
- **Suggested direction:** Completed: coalesce style repaint behind the matching
  topology process/render boundary, mirroring the established Local session
  rule.
- **Decision required?:** No.

### KG14A-12 — content filters could remove the active Focus root

- **Category:** Reliability
- **Severity / class:** P0 / Must — fixed in KG14A
- **Confidence:** High
- **Workflow:** Focus + Network → depth 3 → Files only while Documents is
  excluded by the persisted Entity Content filter
- **Observed behavior:** Visible headings retained the Source file as context at
  depth 3. Files only removed those headings, leaving no projected root. The
  Local mapper threw during render, blanked the application, and the saved state
  then made later Focus entry fail because the same canonical target could not
  be projected.
- **Why it matters:** Independently valid Focus, disclosure, and filter state
  combined into an invalid renderer input and an unrecoverable-looking restart.
- **Reproduction:** In the synthetic sample, focus Source in Network, set depth
  3, exclude Documents under Filters, then choose Files only and reload.
- **Evidence:** Production-browser console/blank workspace plus focused
  projection and navigation regressions in `packages/view-projection/src/local.test.ts`
  and `apps/web/src/local-view.test.ts`.
- **Likely implementation area:** Shared focused-detail retention and the lazy
  Focus Network mount boundary.
- **Suggested direction:** Completed: retain the stable root file as structural
  context when later content filters have no visible match, and contain future
  mapper/mount failures inside the graph surface rather than unmounting the app.
- **Decision required?:** No.

### KG14A-13 — All Network dropped applied Advanced queries

- **Category:** Correctness / interaction
- **Severity / class:** P1 / Must — fixed in KG14A
- **Confidence:** High
- **Workflow:** All + Network → Filters → Advanced query → Apply query
- **Observed behavior:** The controlled filter state accepted and persisted a
  valid QUERY1 expression, but the All Network adapter omitted `query` while
  deriving its documents-only state. The badge changed while the graph did not.
  The nonmodal panel also required Close or Escape instead of dismissing when a
  user continued elsewhere in the workspace.
- **Why it matters:** The visible “applied” state contradicted the graph and made
  the primary filtering workflow appear broken.
- **Reproduction:** In the synthetic sample, apply `path:"gg.md"` in All
  Network. Before the fix the five sample files remained; afterward the empty
  match is reported as 0 nodes and 0 edges.
- **Evidence:** Production-browser replay plus regressions in
  `apps/web/src/global-view.test.ts` and
  `apps/web/src/components/graph-filters-overlay.test.ts`.
- **Likely implementation area:** All Network state derivation and the Filters
  nonmodal overlay lifecycle.
- **Suggested direction:** Completed: preserve the canonical query in the
  documents-only derived state and dismiss Filters on outside pointer actions
  without moving focus away from the clicked target. Escape and Close continue
  to restore trigger focus.
- **Decision required?:** No.

### KG14A-14 — empty All Network looked like a blank cached canvas

- **Category:** Feedback / interaction
- **Severity / class:** P1 / Must — fixed in KG14A
- **Confidence:** High
- **Workflow:** All + Network → Filters → apply a query with no matches
- **Observed behavior:** The node and edge count reached zero, but All Network
  still mounted Sigma and showed only “layout restored from the in-memory
  cache.” Hierarchy already presented an explicit no-match state.
- **Why it matters:** Correct filtering looked like a renderer failure, while an
  implementation-detail cache message displaced the recovery guidance.
- **Reproduction:** In the synthetic sample, apply `path:"gg.md"` in All
  Network after a cached layout exists.
- **Evidence:** Manual QA plus renderer regressions in
  `packages/renderer-sigma/src/global-canvas.test.tsx`.
- **Likely implementation area:** The Sigma canvas empty-state and layout-status
  lifecycle.
- **Suggested direction:** Completed: overlay an explicit zero-result state
  while keeping the renderer session stable, tell the user to adjust filters,
  and make exact cache restoration silent.
- **Decision required?:** No.

### KG14A-02 — Network has no equivalent keyboard or screen-reader graph path

- **Category:** Accessibility
- **Severity / class:** P1 / Must
- **Confidence:** High
- **Workflow:** All + Network and Focus + Network without a pointer/visual canvas
- **Observed behavior:** The Sigma container is `aria-hidden="true"`; its nodes
  do not appear in the accessibility tree. Search, Scope/Layout controls, zoom,
  Fit, and Inspector remain accessible, but a user cannot enumerate the visible
  network, discover an unknown node, traverse adjacency, or select a canvas node
  through the DOM.
- **Why it matters:** Search is a useful recovery path only when the user already
  knows what to search for. It is not an equivalent way to explore a network.
- **Reproduction:** Inspect the accessibility tree in either Network layout or
  navigate the page only with the keyboard.
- **Evidence:** Production DOM snapshots contain only Network controls/status;
  `GlobalRendererSession` and `LocalRendererSession` hide their canvas roots.
- **Likely implementation area:** Shared Network accessibility surface around
  the Sigma views and Inspector/navigation actions.
- **Suggested direction:** Add a synchronized, virtualized DOM representation
  of visible nodes and useful adjacency with selection/focus actions. Preserve
  the visual canvas as presentation and keep Search as a complementary path.
- **Decision required?:** Yes; see D-01.

### KG14A-03 — desktop configuration is not an external-release configuration

- **Category:** Security / release engineering
- **Severity / class:** P1 / Must before external distribution
- **Confidence:** High
- **Workflow:** Build and distribute the desktop application
- **Observed behavior:** Tauri uses `csp: null`, every package/application
  version is `0.0.0`, and `bundle.active` is false. The checked build produces a
  runnable release executable but no versioned installer/package.
- **Why it matters:** The current settings are appropriate for development and
  manual release QA, not for establishing a hardened, identifiable,
  distributable desktop release.
- **Reproduction:** Inspect `apps/desktop/src-tauri/tauri.conf.json`, Cargo and
  package manifests; run `pnpm desktop:build`.
- **Evidence:** Current configuration plus successful no-bundle release builds.
- **Likely implementation area:** Tauri security config, release metadata, CI,
  and distribution documentation.
- **Suggested direction:** Define a worker/WebGL-compatible CSP, assign one
  product version source of truth, enable the intended bundle targets, and add
  a packaged-install smoke gate. Treat signing/update/crash-reporting as an
  explicit distribution decision, not implicit scope.
- **Decision required?:** Yes; see D-02.

### KG14A-04 — long source transactions provide status but little progress

- **Category:** Loading / perceived performance
- **Severity / class:** P1 / Should
- **Confidence:** High
- **Workflow:** Open a sizeable vault or perform a full Rescan
- **Observed behavior:** The last valid graph remains visible and the UI reports
  Opening/Catching up/Resyncing. It does not expose file counts, phase progress,
  elapsed time, or an indeterminate-progress affordance beyond text.
- **Why it matters:** Aggregate-only real-vault evidence from KG12A recorded a
  roughly 9.7-second full Rescan, about 9.1 seconds of which was source
  reconciliation. At that duration users can reasonably interpret the app as
  stalled.
- **Reproduction:** Open or Rescan a large local vault and observe the source
  notice while the W1 transaction runs.
- **Evidence:** App source-notice strings, worker transaction boundary, and the
  prior aggregate-only runtime sample. No private names, paths, content, or
  topology are included here.
- **Likely implementation area:** Source provider discovery/reconciliation
  events, W1 request progress, `WorkspaceNotice`, and Source settings.
- **Suggested direction:** Add coarse, serializable phase/count progress without
  changing transactional adoption or exposing private paths.
- **Decision required?:** No.

### KG14A-05 — active source and live state are hidden behind Settings

- **Category:** Onboarding / discoverability
- **Severity / class:** P2 / Should
- **Confidence:** High
- **Workflow:** First launch, after Open Vault/Open Report, or after live watch pauses
- **Observed behavior:** Source & Diagnostics clearly names the current source,
  Ready/Live/Paused state, counts, privacy promise, Rescan, and recovery actions.
  The normal graph shell does not identify the active source. A warning is shown
  for opening/resync/paused/failure, but the steady-state Synthetic Sample or
  live-vault identity is otherwise invisible.
- **Why it matters:** A first-time user may explore the bundled sample believing
  it is their content, or may not know whether a selected vault is live.
- **Reproduction:** Launch the browser or desktop app and do not open Settings.
- **Evidence:** Production first-launch DOM and `SourceSettingsSection`.
- **Likely implementation area:** Graph shell header/status region.
- **Suggested direction:** Add a compact source/status affordance that opens the
  existing Source settings. Avoid showing private absolute paths.
- **Decision required?:** Yes; see D-03.

### KG14A-06 — fitted small All Network scenes can become unlabeled dots

- **Category:** Network comprehension
- **Severity / class:** P2 / Should
- **Confidence:** Medium
- **Workflow:** Synthetic Sample → All + Network → first layout/Fit
- **Observed behavior:** Five document nodes fit in the viewport, but the far
  semantic level hides every label. The graph is spatially present yet cannot
  be interpreted until the user zooms or searches.
- **Why it matters:** The smallest, safest learning dataset should make Network
  easiest to understand, not reduce it to anonymous points.
- **Reproduction:** Use a clean browser origin, switch the sample from All +
  Hierarchy to All + Network, and wait for layout.
- **Evidence:** Production screenshot and the renderer's label threshold/LOD
  settings. Large/dense behavior was not reclassified by this finding.
- **Likely implementation area:** Global label policy and small-scene Fit ratio.
- **Suggested direction:** Guarantee a bounded number of useful labels for small
  scenes or choose a small-scene Fit ratio that remains in labeled LOD.
- **Decision required?:** No.

### KG14A-07 — QUERY1 parse failures are not live-announced

- **Category:** Accessibility / query recovery
- **Severity / class:** P2 / Should
- **Confidence:** High
- **Workflow:** Filters → Advanced query → submit invalid QUERY1
- **Observed behavior:** The draft remains unapplied and a precise character
  error appears visually. The input is invalid/described, but the error
  paragraph is not an alert or live region.
- **Why it matters:** A screen-reader user may receive no feedback after Apply
  and cannot know why the graph did not change.
- **Reproduction:** Apply `path:"notes" AND (` and observe the accessibility tree.
- **Evidence:** Production DOM and `GraphFilters.tsx`.
- **Likely implementation area:** Advanced-query status markup and focus policy.
- **Suggested direction:** Announce the error with a polite/assertive status and
  retain focus in the query input.
- **Decision required?:** No.

### KG14A-08 — Saved Filter deletion is immediate

- **Category:** Recovery / interaction safety
- **Severity / class:** P2 / Should
- **Confidence:** High
- **Workflow:** Filters → Saved Filters → Delete
- **Observed behavior:** Delete removes the workspace-scoped saved query in one
  action. Visual Groups use an inline Confirm delete step, but Saved Filters do
  not offer confirmation or undo.
- **Why it matters:** A reusable local artifact can be lost through a stray
  activation, and the product has no reconstruction history.
- **Reproduction:** Inspect the Saved Filter action handler or activate Delete
  on a disposable synthetic registry.
- **Evidence:** `GraphFilters.tsx`, saved-filter handlers, and the contrasting
  Visual Group confirmation flow.
- **Likely implementation area:** Saved Filters list interaction.
- **Suggested direction:** Reuse the inline confirm/cancel pattern or provide a
  short-lived Undo.
- **Decision required?:** No.

### KG14A-09 — repeated references are visually indistinguishable in Inspector

- **Category:** Inspector / provenance comprehension
- **Severity / class:** P2 / Should
- **Confidence:** High
- **Workflow:** Select a file containing repeated links to the same destination
- **Observed behavior:** The sample Source file reports 31 outgoing references.
  The first 20 Inspector cards repeat the same Target, target path, and
  Source/Overview breadcrumb. Their distinct source lines are visible only by
  opening Technical details.
- **Why it matters:** Exact reference provenance is correct, but normal-mode
  cards look duplicated and make scanning or choosing an occurrence difficult.
- **Reproduction:** Select Source in Focus + Hierarchy and open Inspector.
- **Evidence:** Production DOM plus exact canonical reference/source ranges in
  Technical details.
- **Likely implementation area:** Inspector reference-card summary.
- **Suggested direction:** Show line/range in the normal card or group identical
  source→target pairs with an occurrence count and expandable occurrences.
- **Decision required?:** Yes; see D-04.

### KG14A-10 — Custom depth is truthful but under-explained

- **Category:** Hierarchy comprehension
- **Severity / class:** P2 / Should
- **Confidence:** High
- **Workflow:** Choose Files only, then expand one file/heading manually
- **Observed behavior:** The selector correctly remains on the last automatic
  depth and a Custom badge appears. There is no adjacent explanation that
  manual overrides caused Custom, that selecting a preset clears them, or that
  Focus applies automatic depth to the root only.
- **Why it matters:** The graph is behaving correctly, but the user has to infer
  why the preset and visible detail no longer match exactly.
- **Reproduction:** Files only → Expand Source in either Hierarchy layout.
- **Evidence:** Production DOM, `StructureDepthControl`, graph-state and
  projection tests.
- **Likely implementation area:** Hierarchy Depth control help/status copy.
- **Suggested direction:** Add concise accessible help for Custom and Focus
  root-only depth; do not change disclosure semantics.
- **Decision required?:** No.

### KG14A-11 — one legacy internal term reached the Inspector

- **Category:** Scope × Layout terminology
- **Severity / class:** P3 / Should — fixed in KG14A
- **Confidence:** High
- **Workflow:** Inspect a hierarchy edge
- **Observed behavior:** The edge type was labeled Structure while the product
  control and current documentation say Hierarchy.
- **Why it matters:** It weakens the otherwise consistent Scope/Layout model.
- **Reproduction:** Select a hierarchy edge and open Inspector.
- **Evidence:** Inspector rendering test.
- **Likely implementation area:** `ProvenanceInspector` presentation copy.
- **Suggested direction:** Completed: the label and test now say Hierarchy.
- **Decision required?:** No.

### Needs evidence

- A previously persisted browser view on an older local origin restored two
  focused layouts outside the visible viewport until Fit was used. A clean
  origin and a same-version reload restored useful visible state. This remains
  a migration/long-lived-state probe, not a ranked defect, until a supported
  schema-v3 sequence reproduces it.
- Browser automation could not drive the native file chooser in the selected
  in-app browser. Report parsing/replacement/error behavior is covered by
  deterministic tests, but the release checklist retains a manual valid and
  invalid report-import pass.
- Windows scaling above 100%, true high-DPI multi-monitor transitions, reduced
  motion at OS level, and physical touchpad behavior require release-desktop
  observation. CSS/code paths and prior release evidence are positive but do
  not replace this KG14A manual gate.

## 4. Accessibility

| Surface                       | Result                  | Notes                                                                                                                                             |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page landmarks and bypass     | Pass                    | Skip link, named main, named workspace/search regions, and one page heading.                                                                      |
| Scope/Layout/history/settings | Pass                    | Native buttons/selects, pressed/expanded state, disabled Focus explanation, and visible `:focus-visible`.                                         |
| Search                        | Pass with minor caveat  | Labeled searchbox, result count, semantic buttons, retained query, and Escape closes results while retaining the query.                           |
| QUERY1/Filters                | Partial                 | Native labeled controls and invalid association; parse result needs live announcement (KG14A-07).                                                 |
| Visual Groups                 | Pass                    | Native authoring controls, labels, priority buttons, enabled state, inline delete guard, and non-color group names.                               |
| All/Focus Hierarchy           | Pass                    | Nodes are DOM articles/groups; disclosure is a button with exact reveal/hide count; zoom/Fit/maximize have names.                                 |
| All/Focus Network             | Fail release gate       | Canvas is visual-only; controls/Search/Inspector do not provide equivalent browseable topology (KG14A-02).                                        |
| Inspector                     | Pass with density issue | Named complementary region, focus-on-open Close, breadcrumbs/actions, Technical details disclosure; repeated references need differentiation.     |
| Settings/diagnostics          | Pass                    | Tabs/tabpanels, native controls, short-height internal scrolling, named dialog and Close focus.                                                   |
| Motion/zoom/scaling           | Partial evidence        | Renderer motion checks `prefers-reduced-motion`; CSS includes reduced-motion overrides; browser zoom and OS scaling remain manual release checks. |

Contrast is not the only carrier of entity/reference state: cards use labels,
icons, borders/dashes, and text. Visual Group color is accompanied by its group
name in the authoring and Inspector surfaces. A formal contrast measurement for
every palette/state combination remains appropriate in KG14B.

## 5. Resilience matrix

“Inspected” below means deterministic code/test evidence rather than a browser
fault injected into a production session.

| Failure/state                          | Last valid graph                | Explicit failure                      | Recovery / stale-result policy                               | Evidence                                   |
| -------------------------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Corrupt/unsupported report             | Yes                             | Validation path + actionable location | Current source preserved                                     | App report tests and report validator      |
| Corrupt saved view                     | Default in memory               | Visible alert                         | Stored bytes untouched; explicit Reset saved view            | persistence storage/session tests          |
| Corrupt graph preferences              | Usable defaults                 | Visible warning                       | Session continues; write failures do not masquerade as saved | graph-preferences tests                    |
| Corrupt Saved Filters                  | Graph unaffected                | Visible blocked state                 | Stored bytes untouched; repair outside app                   | saved-filter persistence tests             |
| Corrupt Visual Groups                  | Graph unchanged                 | Visible blocked state                 | Explicit two-step reset clears only group key                | Visual Group session/component tests       |
| Storage read/write/remove failure      | Yes                             | Alert/warning                         | Memory stays usable; failed candidate not adopted            | App, storage, preferences, group tests     |
| WebGL/Sigma mount failure              | Hierarchy path remains          | Named renderer failure                | All Hierarchy/Open full hierarchy fallback                   | Sigma lifecycle and App tests              |
| All Network layout-worker failure      | Seed/current graph remains      | Renderer status                       | Explicit Re-layout can retry; latest request owns adoption   | Global worker/client tests                 |
| Focus Network layout-worker failure    | Deterministic seed remains      | Renderer failure/status               | Structured/All Hierarchy fallback; stale result rejected     | Local worker/client/session tests          |
| W3 Hierarchy failure                   | Deterministic grid/seed remains | Layout warning                        | No synchronous Dagre fallback; newest valid result only      | React Flow layout and W3 client tests      |
| W1 workspace failure                   | Yes                             | Paused/source error                   | Failed candidate discarded; replacement on Rescan            | workspace worker/live-vault tests          |
| Watch resync-required                  | Yes                             | Resyncing status                      | Queued events retained around full replacement               | watch-burst/live-vault tests               |
| Catalog persistence failure            | Yes                             | Live updates paused                   | Prepare discarded before adoption; manual recovery           | live-vault transaction tests               |
| Focused root deleted                   | Yes                             | Focus exits/selection clears          | No fuzzy reassignment                                        | view-state and live reconciliation tests   |
| Permission/read/watch failure          | Current source preserved        | Selected-vault context                | Reselect/Rescan; no empty success report                     | source-provider and App tests              |
| Vault moved/reselected                 | Current source until success    | Open failure is explicit              | Exact root selection creates/reuses scoped identity          | source-provider tests; manual gate pending |
| Source switch while work pending       | New session isolated            | No stale paint adopted                | Correlation/session keys reject old work                     | performance and App session tests          |
| Renderer disposal while worker pending | Yes/next renderer seed          | Request settles/rejects               | Worker termination and stale message rejection               | Global/Local/W3 worker tests               |
| Network topology + style overlap       | Yes after fix                   | Regression would fail test            | Style refresh waits for indexed topology                     | KG14A regression test                      |

The matrix supports a strong reliability assessment: failures are normally
failure-shaped, the last committed graph stays visible, and recovery is
explicit. The outstanding concerns are how clearly progress/recovery is
communicated, not silent data corruption.

## 6. Onboarding and discoverability

- The browser intentionally starts on Synthetic Sample and offers Open Report.
  Desktop additionally offers Open Vault, Open Another Vault, live status,
  Rescan, and identity recovery.
- Source settings explain that sources are read locally and reports are not
  uploaded. Canceling the vault picker is a no-op and retains the current
  source.
- Opening/resync/paused/failure states appear above the graph and retain the
  last workspace.
- The steady active source and live state are visible only after opening
  Settings (KG14A-05). The first-run graph does not explain that its realistic
  unresolved/ambiguous/invalid nodes are sample diagnostics.
- Identity recovery correctly warns that it changes continuity and does not
  reset the saved graph view. This is accurate but also exposes the need for a
  short explanation of the product's separate persistence layers.

## 7. Scope × Layout consistency

All four combinations were traversed from production output. Scope and Layout
remain independent and use only current product terms. Search-selected Source
stayed the focused root while switching Network ↔ Hierarchy. Hops and Direction
changed only the bounded Focus neighborhood. Back/Forward restored disclosure
and Layout without reinterpreting history.

All + Hierarchy uses compact cards and Focus + Hierarchy uses extended cards as
documented; no evidence justifies reopening that decision. The single
Inspector “Structure” leak was corrected by KG14A-11. Internal code and legacy
persistence types may retain `structure`, `global`, or `local` names where they
are not user-facing compatibility contracts.

## 8. Search, QUERY1, Saved Filters, and Filters

Basic Search returns canonical documents/headings/blocks hidden by the current
projection and explains that scope. Selecting Source centered it in All +
Network and enabled Focus. Selection closes the list while retaining the query;
refocus makes results available again; Escape closes the list without erasing
the retained query.

QUERY1 correctly distinguishes draft from applied state. Invalid syntax keeps
the previous graph and gives an exact character error; live announcement is the
remaining accessibility issue (KG14A-07). Valid query, path, entity/heading,
Blocks, heading limit, and reference-status semantics are covered by projection
and query fast-path tests. All + Network truthfully states that it is files-only
and that entity/heading controls remain saved for Hierarchy.

Saved Filters are workspace-scoped and do not silently overwrite corruption.
Their immediate deletion should adopt the existing guarded pattern
(KG14A-08). A concise active-filter summary exists as the Filters badge, but a
user investigating a missing node still has to open the drawer to learn which
group is active.

## 9. Visual Groups

The drawer explains the first-enabled-match priority rule. Create/edit, palette,
enable/disable, ordering, QUERY1 syntax, and Inspector memberships use accessible
native controls. A row's Delete action requires inline confirmation. Corrupt
storage is blocked behind explicit recovery; transient reports get session-only
groups; write failures do not adopt a candidate that only appears durable.

Compilation is downstream from projection. Presentation maps contain Entity IDs
only, and every renderer consumes them as color/style overrides. Groups do not
change projection, topology, layout requests, focus, or persistence schema. The
KG14A crash was an imperative Sigma refresh-order bug, not a violation of these
semantics.

## 10. Inspector

File/Heading/Block and reference/hierarchy/diagnostic inspection are backed by
source-neutral indexes and exact projected identities. Normal information,
location breadcrumbs, outgoing/backlink counts, Focus/Open full hierarchy, and
Visual Group membership precede Technical details. Technical details contain
IDs, roles, exact ranges, resolution metadata, and an explicit report-mode
limitation without exposing Markdown source text.

The sample also revealed the repeated-reference density issue KG14A-09. Exact
occurrences must remain inspectable; the follow-up choice is whether the normal
surface differentiates or groups them.

## 11. Persistence and history

- Back/Forward records semantic graph actions, including depth and manual
  disclosure; no-op actions do not pollute history.
- Stable-workspace saved view restores Scope, Layout, focus, filters,
  disclosure, and renderer-specific semantic viewport anchors under schema v3.
- Graph preferences persist focus appearance, Network layout/strength/spacing,
  trackpad mode, and preferred Focus layout independently from view history.
- Saved Filters and Visual Groups are separate named workspace registries.
- Live updates reconcile by stable identity; stale disclosure/viewports are
  dropped explicitly, and deletion of the focused root exits Focus rather than
  choosing a fuzzy replacement.
- Reset saved view deletes only the view-state key. Identity recovery, Saved
  Filters, Visual Groups, and preferences remain separate.

This implementation is robust but requires product explanation. The current UI
names each system accurately at its point of use; it does not provide one place
that explains what Back, reload, Reset saved view, and recovery each affect.

## 12. Settings

Graph and Source & Diagnostics tabs group responsibilities well. All Network
settings explicitly state their Scope/Layout applicability. Folder clustering
has a direct 0–100 Strength slider, spacing presets, and disclosed Advanced
controls. Focus appearance and both trackpad modes include plain-language
descriptions.

At a 900×400 production-browser viewport, Settings retained its header/tabs and
owned a clear internal vertical scrollbar. At 900×640 the toolbar wrapped
without clipping. At 560 and 320 pixels the controls remained usable in stacked
rows, though those widths are below the desktop window's 900-pixel minimum.

Source & Diagnostics contains the current source, state/counts, local-only
privacy copy, Open Vault/Open Report/sample actions, Rescan, identity recovery,
and developer evidence. Consider gating the Developer section for an external
consumer release, but it is not a privacy defect: it displays local report
evidence already held by the app and performs no upload.

## 13. Release desktop

Positive evidence:

- product name, window title, stable identifier, and product-specific icon are
  present;
- the resizable window has a tested 900×640 minimum and browser zoom hotkeys;
- dynamic Tauri imports keep browser mode working;
- filesystem capabilities are read/watch plus app-local identity state, not a
  broad home-directory grant;
- top-level source failures preserve the current graph and provide recovery;
- prior release QA passed startup, vault selection, live updates, restart,
  renderers, and physical touchpad behavior.

Release gaps are KG14A-03: no CSP, placeholder versioning, and inactive bundling.
Signing, auto-update, and crash reporting are not automatically required for
the local product. They become Must/Should only after the target distribution
channel, update policy, and privacy promise are chosen.

## 14. Privacy and security

- The user selects a vault root. Discovery, reads, metadata, and watch are
  scoped to that root; symlink/escape and invalid targets are rejected.
- Markdown is read/watch-only. The application has no Markdown write command.
- Stable identity/catalog data is stored under Tauri app-local data. Browser
  view/preferences/filters/groups use local browser storage.
- Layout coordinates, source text, private paths, queries, and entity IDs are
  absent from committed benchmark/runtime instrumentation. Performance capture
  is memory-only and opt-in.
- Web Workers receive serializable domain/layout requests and do not require DOM
  access. A worker-bundle guard rejects DOM-dependent imports.
- Diagnostic Evidence is local and report-derived. This audit commits no private
  vault name, path, content, topology, or screenshot.
- No upload, telemetry endpoint, cloud sync, or collaboration surface exists.

An explicit desktop CSP is the remaining material hardening gap. Its validation
must cover module workers, blob/worker sources if needed by the resolved stack,
WebGL, and the Tauri IPC boundary.

## 15. Performance perception

The current architecture follows the KG12 evidence: W1 workspace transactions
and W3 Dagre run off the UI thread; bounded projections, inspection, and
renderer mapping stay on the main thread; Global and Focus Sigma layout use
dedicated latest-only workers. First-use Network code is lazy-loaded.

Production-browser transitions showed explicit Loading All Network/Focus
Network/Focus Hierarchy states, immediate deterministic seeds, and ready
messages. Search, depth, Hops, Direction, history, and layout switching remained
responsive on the synthetic sample. Folder Strength changes do not alter graph
semantics. The production console was clean after KG14A-01.

Current reproducible small profiles remain well inside their intended bounded
paths. The relevant perceived-performance gap is source progress for a
multi-second vault transaction (KG14A-04), not a reason to add a cache or change
renderers. CI must continue validating operations/correctness rather than
wall-clock thresholds.

The KG14A validation run recorded small-profile medians of 28.448 ms for
parse/adapt, 36.990 ms for a one-file workspace update, and 0.080 ms for
canonical search. The 1,300-node depth-three structural profile spent 431.756 ms
in Dagre, confirming the existing W3 worker boundary. Global's 100-document map
and Graphology build medians were 0.401/0.224 ms and its selected folder-prior
layout reported 9.463 ms. Focus projection and Free refinement medians were
0.474/0.628 ms; the 13-node Structured Dagre median was 8.459 ms. These are one
local investigative run, not portable promises or CI thresholds.

## 16. Decision-required items

### D-01 — equivalent access to Network exploration

- **Problem:** The visual Sigma canvas has no browsable keyboard/screen-reader
  graph equivalent.
- **Option A:** A virtualized “Visible nodes” companion with search, selection,
  group/status labels, and expandable incoming/outgoing adjacency.
- **Option B:** A smaller selected-node adjacency navigator plus an explicit
  “Explore Network with Search/Inspector” workflow.
- **Option C:** Force assistive users to switch to Hierarchy.
- **Tradeoff:** A gives the most equivalent exploration but costs more DOM/state
  design. B is smaller but may still underserve discovery. C is not recommended
  because Layout should be a presentation choice, not an accessibility gate.
- **Recommended default:** A, implemented with virtualization and existing
  projection/inspection indexes; no duplicate canonical graph.
- **Evidence that could change it:** Moderated assistive-technology testing may
  show that a focused adjacency navigator provides an equivalent task path.

### D-02 — external distribution target

- **Problem:** Version, CSP, bundle/signing, update, and crash-reporting choices
  depend on how the desktop app will be distributed.
- **Option A:** Local/manual Windows release: versioned installer, CSP, packaged
  smoke, optional signing, no updater/telemetry.
- **Option B:** Public multi-platform release: signed/notarized bundles, update
  policy, privacy-reviewed crash handling, and platform CI.
- **Tradeoff:** B provides broader trust and maintenance but creates substantial
  release operations and privacy responsibilities.
- **Recommended default:** A until a public channel is explicitly chosen.
- **Evidence that could change it:** A committed public/multi-platform launch
  target or enterprise installation requirements.

### D-03 — source/status placement

- **Problem:** The steady active source/live state is hidden in Settings.
- **Option A:** Compact source chip in the workspace toolbar that opens Source
  settings.
- **Option B:** Persistent but dismissible first-run/source-change banner.
- **Tradeoff:** A supports continual orientation with little vertical cost. B
  teaches more but becomes noise and does not solve later status checks.
- **Recommended default:** A, with friendly source name/state and no absolute
  path.
- **Evidence that could change it:** First-use testing may justify a one-time
  teaching banner in addition to the chip.

### D-04 — repeated-reference presentation

- **Problem:** Exact occurrences are correct but normal Inspector cards can look
  identical.
- **Option A:** Add source line/range to every normal card.
- **Option B:** Group identical source-context → destination pairs and expand to
  exact occurrences.
- **Tradeoff:** A is simpler and preserves a flat occurrence list but remains
  long. B scans better but adds disclosure behavior.
- **Recommended default:** B for repeated pairs, with count and accessible
  occurrence disclosure; single references remain unchanged.
- **Evidence that could change it:** Real-vault aggregate counts showing repeated
  pairs are rare would favor A.

## 17. Ranked implementation queue

| Priority | Finding IDs                                      | Theme                               | User impact                                                                                             | Confidence  | Suggested implementation slice                             | Needs user decision? |
| -------- | ------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------- | -------------------- |
| 1        | KG14A-02, KG14A-07, contrast/manual scaling gate | Accessible exploration              | Removes a release-blocking inability to explore Network and closes query feedback gaps                  | High        | KG14B — accessible Network companion and critical feedback | Yes: D-01            |
| 2        | KG14A-03                                         | Desktop hardening                   | Produces an identifiable, CSP-hardened, installable release artifact                                    | High        | KG14C — release configuration and packaged smoke           | Yes: D-02            |
| 3        | KG14A-04, KG14A-05                               | Source confidence and progress      | Users know what is open/live and whether long work is progressing                                       | High        | KG14D — source onboarding/status/progress                  | Yes: D-03 placement  |
| 4        | KG14A-06, KG14A-09, KG14A-10, KG14A-08           | Workflow comprehension and recovery | Improves small Network readability, provenance scanning, depth mental model, and deletion safety        | Medium–High | KG14E — exploration polish                                 | Yes only for D-04    |
| Done     | KG14A-01, KG14A-11, KG14A-12, KG14A-13, KG14A-14 | Audit-enabling fixes                | Prevents critical graph failures, restores query/empty-result feedback, and removes terminology leakage | High        | KG14A                                                      | No                   |

Future Saved Views, manual positions, cluster dragging, multi-focus,
analytics/community detection, semantic similarity, source editing, cloud sync,
and a new renderer are deliberately absent from this issue queue.

## 18. Proposed KG14 completion gate

KG14 is complete when all of the following are true:

1. A fresh desktop user can open/cancel/reselect a vault or report, identify the
   active source and live state, and recover from a failed open without losing
   the current graph.
2. Scope and Layout are understandable as independent choices; All ↔ Focus,
   Network ↔ Hierarchy, explicit/double-click Focus, Back/Forward, root
   continuity, and all depth/disclosure rules pass automated and release QA.
3. Search, QUERY1, Saved Filters, path/entity/reference filters, Blocks, heading
   limit, and Visual Groups are understandable, accessible, persistence-safe,
   and explain why knowledge is hidden.
4. File/Heading/Block, hierarchy/reference edge, unresolved, ambiguous, and
   invalid provenance is inspectable without misleading duplication.
5. Critical workflows are keyboard-operable, screen-reader feedback is timely,
   both Network layouts have an equivalent DOM exploration path, focus
   restoration is predictable, palette/state contrast passes, and reduced
   motion/browser zoom/Windows scaling pass.
6. Corrupt input/state, storage failures, WebGL and all worker failures, watch
   resync, persistence failure, source switching, focused-root deletion, and
   pending disposal preserve the last valid graph, reject stale results, report
   failure, and expose recovery.
7. Large source transactions expose useful private-safe progress while
   renderer transitions remain seeded, stable, and free of unexplained blank
   scenes or jumps.
8. The desktop build has a documented version, explicit CSP, intended bundle
   target, packaged-install smoke, clean normal runtime, scoped capabilities,
   and an explicit signing/update/crash-reporting decision.
9. `pnpm check`, desktop checks/build, small performance/Global/Local profiles,
   browser QA, release Tauri QA, physical touchpad QA, and post-merge CI pass
   without private vault artifacts.

KG14A establishes this queue and gate. It does not implement KG14B or mark KG14
complete.

## KG14A QA record and low-risk fixes

Automated/deterministic coverage inspected corrupt report/state/storage,
transactional live updates, worker failures/supersession, source permissions,
focused-root deletion, and renderer disposal. Production-browser QA covered the
sample; all four Scope/Layout combinations; depth 0–3 and Custom; Search;
invalid QUERY1; reference filters; Visual Groups authoring/guarded deletion;
Inspector; Back/Forward; reload; the Focus Network depth 3 → Files only
transition with Documents excluded; All Network Advanced query empty matches;
explicit All Network no-match recovery; Filters inside/outside pointer behavior;
Settings; 900×640, 900×400, 560×700, and 320×640 layouts; and console
cleanliness. File-chooser, OS reduced-motion, high-DPI, and native-only paths
remain in release manual QA.

Low-risk fixes included in KG14A:

1. Deferred Global Sigma Visual Group repaint until changed topology is indexed,
   with a regression test for add/remove overlap.
2. Renamed the Inspector's user-facing hierarchy-edge type from Structure to
   Hierarchy, with its presentation test updated.
3. Preserved the stable Focus root as context when content filters remove every
   visible match, added exact projection/navigation regressions, and contained
   any future Focus Network mapper failure inside the graph surface.
4. Preserved applied Advanced queries in the All Network state adapter and made
   Filters dismiss on outside pointer actions while retaining Escape/Close focus
   restoration.
5. Replaced the blank zero-node All Network canvas with explicit filter recovery
   guidance and removed its user-facing in-memory-cache implementation detail.
