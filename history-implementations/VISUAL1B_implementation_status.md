# VISUAL1B implementation report

Status: **Correction accepted and merge explicitly approved by the user on
2026-09-03 ("Good. Now merge"). The linked PR records merge and CI outcomes.**

[PR #51](https://github.com/lillo24/icarus-graph-explorer/pull/51) integrates
`main` at `495a7a1`, including merged KG14B3 PR #52 and navigation PR #53. The
merge preserves both Size context validation and confirmed-click sidebar reveal,
plus both Local presentation overrides and activation callbacks. No competing
action menu or Hide mechanism was introduced. The isolated checkout is removed
after merge and successful post-merge CI.

Final integration with PR #53 passed frozen-lockfile installation, full
`pnpm check` (**1,018 tests across 117 files**), and `pnpm desktop:check`.
The navigation test fixtures now include the required Size props and canonical
File IDs. A combined regression verifies that changing/resetting size never
replays a confirmed sidebar reveal or selects a File. Conflict resolution
preserves independent presentation and click/reveal responsibilities, following
the React performance guidance; no new production behavior was introduced.

## QA correction — render-only Size ownership

Native QA found that a tiny Size change moved unrelated nodes and changed
Source-to-Target distance. The cause was the override entering mapped size,
then the KG13 fingerprint, then a fresh worker relaxation warmed from live
coordinates on every changed value. Installed ForceAtlas2 0.10.1 defaults to
`adjustSizes: false`; neither layout enables it. The multiplier was invalidating
layout, not intentionally participating in size-aware collision physics.

All/Focus now retain automatic size in mapper/topology/seed/request/fingerprint
inputs. Independent canvas effects and initial session options deliver sparse
overrides to Sigma node reducers only. Final display size preserves bounds,
Focus root emphasis, group color, and Global displayed-size label LOD. No
layout/worker/cache/physics code or settings changed, and the simplified slider,
registry/persistence schema, identity handling, Hide/query/history, and v3 saved
views remain unchanged.

Affected File reducers refresh through a topology-owned EntityId-to-node-key
index. Sigma 3.0.3's indexed refresh (`skipIndexation: false`) is required for
size-dependent label/program/picking data. It does not run graph layout or
mutate Graphology coordinates. The Sigma process can scan its graph; only the
application's override diff/reducer targets are sparse. Color-only refreshes
keep the existing fast path. Pending topology gates/coalesces group and size
updates, filtering removed keys before any partial repaint.

### Regression evidence

The new test executes the real All/Focus canvas functions, memo/effect
dependencies, sessions, Graphology graph, mappers, and request/fingerprint/cache
paths, with a deterministic hook driver, Sigma double, and controlled layout
service. It is not a WebGL/native interaction test.

Fixture: isolated `Note.md`, plus `Source.md → Target.md`. After one initial
layout, the sequence `1.00, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30` previously
submitted **6 additional requests in each mode** (total calls
`1, 2, 3, 4, 5, 6, 7`; 1.00 reused cache). The same sequence now submits
**0 additional requests** (all totals `1`). The passing test additionally
covers 2.50, Reset, and a saved initial multiplier.

Every node's exact x/y tuple and Source-to-Target distance remain identical,
while Note's displayed radius changes proportionally. Mapping, seeding,
reconciliation, request-template/fingerprint computation, and cache writes
remain unchanged. No selection or camera change occurs after initial layout.
A genuine subsequent topology edit still submits a new layout. Session tests
cover initial stored size, sparse changes, group composition, same-value no-op,
Reset, hover/click callback continuity, pending-topology coalescing, removed keys,
and hide/unhide with the latest stored multiplier. Radius picking is additionally
checked in production-browser smoke. Native acceptance is user-reported, not an
agent-performed native interaction/live-update test.

### Current validation

- Frozen-lockfile install passed.
- Renderer tests: **122 passed across 19 files**.
- Web tests: **312 passed across 47 files**.
- Full `pnpm check` passed: formatting, lint, all workspace typechecks,
  **991 tests across 115 files**, and production web build. The existing large
  bundle-size warning remains; no new runtime warning is claimed away.
- `pnpm desktop:check` and `pnpm desktop:build` passed. The fresh optimized
  executable is in this task checkout at
  `apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`.
- Both requested small renderer benchmarks passed. All 100-node mapping median
  was 0.296 ms; Focus 13-node topology mapping median was 0.017 ms. These are
  local automatic-path evidence, not end-to-end slider timing or CI thresholds.
- Production-browser smoke passed on the three-File filtered Synthetic Sample:
  small steps through 1.30, maximum/minimum, rapid drags, Reset, unchanged
  connected-node centers, and visible resized-radius picking. Focus Target
  resizing kept its and Source's centers fixed, enlarged-edge clicking selected
  Target, and Hide/unhide retained 2.50 without a stale-node failure. No console
  errors/warnings were logged. Temporary size overrides/query were restored.
- The user accepted the correction and explicitly approved merge. The agent
  did not perform native interaction/live-update QA and does not independently
  certify each checklist item. Latest integrated PR/post-merge CI is tracked
  on GitHub.
- The React performance skill informed the separation of presentation effects
  from layout dependencies. No dependency was added.

## Earlier QA correction — Size UI only

The follow-up correction removes Auto/Custom modes and long visible explanatory
copy. Size is now one always-visible 0.50–2.50× slider, current value, and Reset.
No entry displays 1.00×; moving the slider emits the multiplier immediately;
Reset emits `undefined`, removing the entry and restoring the displayed 1.00×.
The native range is named File size and describes its value as “times calculated
Network size.” A short screen-reader explanation and persistence/error status
remain available. Entry focuses the slider; Escape/focus restoration stays in
the existing shared menu. Row tooltips/accessibility no longer say Custom.

The UI correction's 30 focused tests and web typecheck passed. Full `pnpm check`
also passed formatting, lint, workspace typechecks, 979 tests across 113 files,
and the production web build. Browser checks
passed for initial 1.00×, keyboard arrows/Home/End, Reset by keyboard and pointer,
Escape row-focus restoration, unchanged selection, and reading the saved value
after reload. The compact editor was visually checked; no console errors or
warnings were logged. Unsupported-kind eligibility remains covered by the
existing context/row tests. This is **not** a graph movement/flicker QA pass.

No changes or investigation were made to the override package, persistence,
eligibility, QUERY1, virtualization, Visual Groups, view-state, renderer formula,
layout inputs/fingerprints, ForceAtlas2, workers, or caches. The new prompt is
archived alongside the original. All work remains in PR #51.

## Summary and override architecture

Canonical Files now offer **Size** in Network Explorer's existing action menu,
with a controlled multiplier slider, Reset, and a compact multiplier indicator
when an entry exists. Scales range from 0.5 to 2.5 in steps of 0.05. Reset removes
the entry and displays 1.00×; moving the slider to 1.00× stores that multiplier
without presenting a different sizing mode.

`packages/presentation-overrides` owns a source-neutral, strictly validated v1
WorkspaceId/EntityId registry, deterministic serialization, pure mutations, and
sparse canonical-Document reconciliation. Sizes do not enter canonical truth,
KG6 projection state, saved views, saved filters, history, graph preferences,
Visual Groups, or renderer coordinates.

## Size composition

```text
All:   clamp(VISUAL1A automatic size × per-file scale, 2, 24)
Focus: clamp(existing File/root base × per-file scale, root minimum or 2, 24)
```

The Focus root retains its existing minimum emphasis of 8.4. Automatic All
sizing still composes base node size and link-degree influence before applying
the per-file multiplier. No override preserves the existing mapper path. Headings,
blocks, diagnostic nodes, and Hierarchy sizing remain unchanged.

Final sizes now exist only in Sigma reducer output. Automatic sizes enter the
normal mapping/layout fingerprints, and neither Graphology size/positions nor
layout caches change when a per-File multiplier changes. Existing latest-wins
worker handling remains responsible for legitimate layout work.

## Network Explorer actions and visibility

The visible File Actions button, right-click, and keyboard context invocation
share KG14B3's logical target and single portal. Size replaces the menu content
with an editor; Escape restores row focus. Opening/editing Size does not select
or center a node. Values come from the workspace registry, not per-row state.

Projection/target changes safely close the editor. Scrolling closes it and uses
the drawer close button as a stable focus fallback without snapping back to the
selected row. Only visible/overscan rows render buttons and size indicators;
there are no hidden per-row menus. Unsupported node kinds do not offer Size.

KG14B3 was merged before final UI integration. Hide/unhide therefore reuses its
unchanged exact-path QUERY1 actions and restore chips. There is no second hidden
registry, and hidden Files retain their custom size.

## Persistence and compatibility

Stable identities save in a separate workspace-scoped registry before adoption.
Transient/legacy reports remain session-only. Eligibility follows declared
identity provenance, not source type; the bundled stable Synthetic Sample can
save. Storage read failures are visibly session-only. Corrupt values remain
untouched and edits are blocked; failed saves retain confirmed values.

Surviving EntityIds retain overrides across renames/moves. Missing IDs remain
inactive without path/title fallback or fuzzy remapping. Reset saved view does
not clear overrides. QUERY1, Saved Filters, Visual Groups, navigation history,
global preferences, and view-state schema v3 remain separate and unchanged.
Visual Group colors compose independently with custom size.

## Original integration validation and performance

- Frozen-lockfile install and full `pnpm check` passed: formatting, lint,
  workspace typechecks, **966 tests across 112 files**, and production web build.
- `pnpm desktop:check` and `pnpm desktop:build` passed; the latter produced the
  optimized Windows executable under `apps/desktop/src-tauri/target/release/`.
- Small Global/Local renderer benchmarks passed. Local evidence, not thresholds:
  100-node All mapping median 0.294 ms; 13-node Focus topology median 0.014 ms.
  These use the existing Auto path, not end-to-end slider timing. A separate
  10,000-entity operation-count test verifies sparse override reconciliation.
- Registry, session, identity, mapper, editor, menu-target, bounded-row, query
  Hide/unhide, saved-filter, reset, and history compatibility tests are included.
- React performance guidance informed event-driven changes, reuse of the
  canonical entity index, and stable focus dependencies during slider updates.
- CI is tracked on PR #51; its latest integration head must be green before
  merge. Native QA below, post-merge CI, and cleanup are still separate gates.

Browser checks on Synthetic Sample passed for smaller/larger/Auto, slider
keyboard input, Escape and Tab cycling, button/right-click/Shift+F10 equivalence,
selection isolation, sidebar reopen, All/Focus reuse, Hierarchy eligibility,
reload, Reset saved view, Hide/unhide, group-color composition, and global base
size/link-influence composition. The editor stayed within a 480 × 720 viewport;
scrolling closed it without selection snapback. No runtime errors were logged.
A React Flow development attribution-visibility warning appeared during the
Hierarchy/reset transition; a warning-free console is **not** claimed. Temporary
browser QA group/size edits were removed and global settings restored afterward.

## Files and dependencies

- `packages/presentation-overrides/`: contract, validation, serialization,
  mutation/reconciliation, tests, and navigation map.
- `packages/renderer-sigma/`: All/Focus size composition, mapper/canvas plumbing,
  tests, and documentation.
- `apps/web/src/presentation-overrides/` and
  `apps/web/src/persistence/presentation-overrides.*`: workspace sessions,
  storage adapter, sparse hook, and compatibility tests.
- `apps/web/src/components/`: GraphExplorer wiring, shared Network Explorer
  menu/editor, File action/indicator UI, and tests; `App.css` owns their styling.
- `apps/web/src/network-explorer-context.*`: canonical File eligibility and
  shared logical context lifecycle; closest source maps/architecture docs updated.
- Workspace manifests/lockfile: one internal package, **zero external dependencies**.
- Archived prompt and this report. `AGENTS.md` has only repository-formatter
  whitespace changes required after the latest main commit; instruction text is
  unchanged.

## Native QA checklist supplied to the user

Use the newly built optimized executable, not an older running app:

1. In All + Network, open File Actions → Size. Drag and keyboard-adjust the
   multiplier from 0.5 to 2.5, then Reset. Confirm the size/indicator update, editor focus
   stays usable, and opening/editing does not select or center another File.
2. Open the same editor using right-click and Shift+F10. Check Escape, Tab,
   sidebar close/reopen, short/narrow windows, and scrolling away from the row
   without snapping back or leaving a stranded editor.
3. Check the same File in Focus + Network, including the protected root minimum.
   Headings/blocks/diagnostics must not gain Size; Hierarchy must be unchanged.
4. Combine a custom size with a Visual Group and global base-size/link-influence
   controls. Confirm colors and automatic sizing still compose; Reset restores
   automatic size. Pan, mouse wheel, two-finger scroll, and pinch must still work.
5. Hide/unhide the File, apply/clear a saved query, and use Back/Forward. Its
   override must survive. Reset saved view must not erase it.
6. With a stable vault, close/reopen the executable and reload the vault. Check
   persistence and isolation when switching between two workspaces.
7. With live updates, rename/move a sized File while preserving its stable ID;
   size must follow. Remove it while its editor is open; the editor must close
   safely. An unrelated replacement/new identity must not inherit that size.

First repeat the reported flicker case: in All + Network, wait for layout to
settle with `Note.md` isolated and `Source.md → Target.md` connected. Slowly move
Note from 1.00 to 1.30, drag rapidly across the full range, then Reset. Only Note's
radius may change; all node centers and Source-to-Target distance must stay fixed.
Repeat in Focus + Network. Hover and click the resized visible node to verify
label/picking behavior, and combine resizing with Hide/unhide and query changes.

The user replied **"Good. Now merge"** after receiving the correction and this
checklist. That approval releases the native merge gate; it does not convert
unperformed agent-native checks into passing results. Merge through the PR only
after current-main integration and green CI, verify post-merge CI, then remove
only this task's checkout and branch when no further QA is needed.

## Parked future work

SPATIAL1 move mode, individual pinning, folder-cluster offsets, Saved Views,
Adaptive Layout, per-heading sizes, and other overrides remain out of scope.
