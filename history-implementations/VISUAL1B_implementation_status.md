# VISUAL1B implementation report

Status: **Implemented and browser-checked; native QA/merge gate remains open.**

[PR #51](https://github.com/lillo24/icarus-graph-explorer/pull/51) integrates
`main` at `b81cc2c`, including merged KG14B3 PR #52. No competing action menu or
Hide mechanism was introduced. The task checkout remains available for QA.

## Summary and override architecture

Canonical Files now offer **Size** in Network Explorer's existing action menu,
with a controlled Auto/Custom editor and a compact custom multiplier indicator.
Custom scales range from 0.5 to 2.5 in steps of 0.05. Auto removes the entry;
Custom 1.00 is a stored override, even when it looks identical to Auto.

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
the per-file multiplier. Auto preserves the existing mapper path. Headings,
blocks, diagnostic nodes, and Hierarchy sizing remain unchanged.

Final sizes enter the normal mapping/layout fingerprints; no post-mapping
Graphology size mutation or new cache was added. Existing latest-wins worker
handling remains responsible for superseded layout work.

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

## Validation and performance

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

## Remaining manual native QA gate

Use the newly built optimized executable, not an older running app:

1. In All + Network, open File Actions → Size. Drag and keyboard-adjust Custom
   from 0.5 to 2.5, then Auto. Confirm the size/indicator update, editor focus
   stays usable, and opening/editing does not select or center another File.
2. Open the same editor using right-click and Shift+F10. Check Escape, Tab,
   sidebar close/reopen, short/narrow windows, and scrolling away from the row
   without snapping back or leaving a stranded editor.
3. Check the same File in Focus + Network, including the protected root minimum.
   Headings/blocks/diagnostics must not gain Size; Hierarchy must be unchanged.
4. Combine a custom size with a Visual Group and global base-size/link-influence
   controls. Confirm colors and automatic sizing still compose; Auto restores
   automatic size. Pan, mouse wheel, two-finger scroll, and pinch must still work.
5. Hide/unhide the File, apply/clear a saved query, and use Back/Forward. Its
   override must survive. Reset saved view must not erase it.
6. With a stable vault, close/reopen the executable and reload the vault. Check
   persistence and isolation when switching between two workspaces.
7. With live updates, rename/move a sized File while preserving its stable ID;
   size must follow. Remove it while its editor is open; the editor must close
   safely. An unrelated replacement/new identity must not inherit that size.

**Native interaction/live-update QA has not been run or marked passed. Do not
merge until the user confirms this gate.** Then check current main/CI again,
merge through the PR, verify post-merge CI, and remove only this task's checkout
and branch when no further QA is needed.

## Parked future work

SPATIAL1 move mode, individual pinning, folder-cluster offsets, Saved Views,
Adaptive Layout, per-heading sizes, and other overrides remain out of scope.
