# POST-SAVED1B1 implementation report

Status: **implemented and locally/browser validated; native acceptance and
merge remain gated.**

Implementation branch: `codex/post-saved1b-native-filter-fix`

[Draft PR #96](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/96)
is the isolated integration vehicle.

The branch was created from the then-latest `origin/main` commit
`c4d237c6abd72bfd37138cd297bea52ea1d7f76c` and was updated to the newer
`dbc898e` main tip before opening the PR. The integration PR is intentionally
kept in draft until the native checklist below is accepted.

## Regression classification

This is a **pre-existing renderer bug discovered during SAVED1B native QA**, not
a regression introduced by PR #92.

The production browser build was tested at both revisions with the same
Synthetic Sample workflow:

```text
All + Network -> Filters -> Unresolved ON
```

- Latest main (`c4d237c6abd72bfd37138cd297bea52ea1d7f76c`) blanked the React
  application.
- The pre-SAVED1B baseline
  (`45eb6a69da585b203605db6523c935ccc35858dc`) blanked identically.
- Both revisions produced the exact exception
  `Base and dynamic spatial layers need the same node keys.`

The baseline was built in a temporary isolated worktree, which was removed
after the comparison. The primary checkout and its pre-existing `.pnpm-store/`
were not modified.

## Root cause

The live filter commit succeeds and persists. The failure occurs afterward in
All Network's passive physics initialization effect:

```text
applyResolvedFolderPlacements
  packages/spatial-overrides/src/geometry.ts:365
composeGlobalFolderSpatialRules
  packages/renderer-sigma/src/spatial.ts:59
GlobalGraphCanvas passive effect
  packages/renderer-sigma/src/GlobalGraphCanvas.tsx:2198 (pre-fix source)
```

A status filter changes the projected topology. The layout-generation layout
effect immediately marks the authoritative `layoutPending.current` ref, but
the mirrored `layoutPendingState` update is asynchronous. During that handoff,
the renderer can already have reconciled automatic positions to the new node
set while `latestDynamicPositions` still contains a raw physics frame for the
previous node set. The passive physics effect guarded only on the lagging state
mirror, composed the adjacent generations, and synchronously threw. React then
removed the uncaught `GlobalGraphCanvas` tree, producing the white screen.

A WebView refresh cold-starts with one settled topology, so the persisted
filter reappears without passing through this race.

## Fix

Physics initialization now also gates on the authoritative
`layoutPending.current` ref. That ref is deliberately established in a layout
effect before ordinary effects run, so physics cannot compose or initialize
until one coordinate generation owns both layers.

The fix does not catch or weaken the spatial key-set invariant. Mismatched
layers remain a strict programming error outside the transition gate. It adds
no projection, mapping, layout, serialization, or graph-wide work.

The renderer regression injects an old-topology raw physics frame, changes to a
smaller topology whose layout stays pending, and exercises the real
`GlobalGraphCanvas` effect ordering. It failed before the guard on the same
exception and passes after the guard, with no extra physics initialization.

## Saved View matcher safety

Derived quick-switch labeling now uses a dedicated best-effort
`matchingCurrentSavedViewName` boundary:

- zero Saved Views return immediately without capturing or serializing current
  state;
- a transient state that strict capture cannot persist resolves to no match
  (`Current View`) instead of throwing during render;
- Save and Update still call strict `captureSavedView` and retain all existing
  query, schema, profile, spatial, and workspace validation.

The unit regression proves the strict capture path still rejects an invalid
query while render-time matching returns no match.

## Filter matrix and cold parity

GraphExplorer product integration coverage now verifies:

- All + Network live transitions for explicit `unresolved`, `ambiguous`,
  `invalid`, and `resolved` status sets;
- `unresolved + ambiguous + invalid` together;
- removal and restoration of each status;
- selection reconciliation when a selected node disappears;
- Back history remains available;
- the Fit request key does not change;
- each status action performs exactly one Global projection;
- a valid zero-node/zero-edge All Network projection keeps the app shell and
  quick switch mounted;
- Focus Network and Focus Hierarchy status changes remain safe;
- Unresolved on/off with zero Saved Views, matching and nonmatching schema-v2
  views, and a migrated profile-less schema-v1 view;
- live Unresolved and cold hydration converge to the same node/edge IDs.

## UI placement

There is now one shared search-control region with this DOM and visual order:

```text
[ Saved View select ][ Manage ][ Search label + field ]
```

The duplicate normal-toolbar and maximized-floating switchers were removed.
The one remaining select/Manage surface immediately precedes `EntitySearch`,
both in normal mode and inside the existing maximized Tools surface. Native
select/button behavior, labels, focus, and manager focus restoration remain
unchanged.

The grid constrains the Saved View column, lets Search own the remaining width,
and uses a 2:3 split below 560 pixels. Long names retain the native select's
ellipsis and cannot expand the column or push Search off-screen.

Automated structural tests cover one select, one Manage button, DOM order,
normal mode, maximized mode, 320-pixel width, and direct keyboard focus.

Production-browser graphical QA confirmed normal, maximized, 320-pixel, and a
valid 60-character Saved View name. The Saved View remained truncated in its
column while Search remained visible. Manage remained accessible.

## Production-browser QA

QA used the minified production build and the real Sigma/worker renderer.

- Unresolved OFF: shell remained visible and the graph changed from 11 nodes / 7
  edges to 5 nodes / 1 edge.
- Unresolved ON: shell remained visible and recovered to 11 nodes / 7 edges.
- Ambiguous ON: 12 nodes / 8 edges, shell visible.
- Invalid ON: 13 nodes / 9 edges, shell visible.
- Resolved OFF with all three diagnostic statuses: 13 nodes / 8 edges, shell
  visible.
- All statuses OFF produced a valid 5-node / 0-edge graph rather than a white
  screen.
- The browser console contained zero error entries after the matrix.

## Performance

- The matcher skips strict capture entirely for an empty registry.
- Every tested reference-status action records one, not two, Global projection
  operations.
- No automatic Fit is added.
- The small Global benchmark retained its visual-only contract: zero
  projection, topology mapping, reconciliation, layout, and coordinate writes;
  one Sigma visual refresh.
- The small Local benchmark retained zero extra projection/layout/workspace
  transactions for its layout-toggle oracle.

## Validation

- `pnpm install --frozen-lockfile`: passed; no dependency or lockfile change.
- Pre-fix focused renderer regression: failed on the reproduced production
  exception.
- Post-fix focused renderer and GraphExplorer regressions: passed.
- `pnpm exec vitest run apps/web`: **88 files / 653 tests passed**.
- `pnpm exec vitest run packages/view-projection`: **9 files / 157 tests
  passed**.
- `pnpm exec vitest run packages/view-state`: **1 file / 48 tests passed**.
- `pnpm exec vitest run packages/renderer-sigma`: **57 files / 416 tests
  passed**.
- `pnpm check`: formatting, lint, all workspace typechecks, **253 files / 2,025
  tests**, and production web build passed.
- `pnpm desktop:check`: Rust formatting/check and **16 tests** passed.
- `pnpm desktop:build`: optimized Windows no-bundle build passed.
- `pnpm benchmark:global-renderer -- --profile small`: passed.
- `pnpm benchmark:local-renderer -- --profile small`: passed.
- `git diff --check`: passed.

## Fresh native executable and acceptance gate

```text
C:\Users\leona\Documents\GitHub\icarus-graph-explorer-post-saved1b1\apps\desktop\src-tauri\target\release\icarus-graph-explorer-desktop.exe
SHA-256: 863F76DED3250D74B0C03F96A10C2849AD7B8973585D8C00E175D50229D376D6
Size: 13,188,096 bytes
Built UTC: 2026-09-13T09:02:01.1132757Z
```

Native computer control is disabled in this environment, so native pointer,
keyboard, and WebView acceptance is not claimed. The draft PR must remain
unmerged until the user reports this short checklist:

1. Open the same vault.
2. Filters -> Unresolved ON; the UI remains visible.
3. Unresolved OFF; the graph recovers without WebView Refresh.
4. Toggle Ambiguous and Invalid quickly; no blank screen.
5. Confirm the Saved View dropdown is top-left immediately left of Search.
6. Switch Saved View A -> B -> A.

## Files changed

Renderer correctness:

- `packages/renderer-sigma/src/GlobalGraphCanvas.tsx`
- `packages/renderer-sigma/src/spatial-rule-canvas.test.tsx`

Saved View render safety:

- `apps/web/src/saved-view.ts`
- `apps/web/src/saved-view.test.ts`

Placement and product integration:

- `apps/web/src/components/GraphExplorer.tsx`
- `apps/web/src/App.css`
- `apps/web/src/components/saved-views-integration.test.tsx`

Traceability:

- `history-implementations/POST_SAVED1B1_native_filter_blank_screen_and_switcher_placement_codex_prompt.md`
- `history-implementations/POST_SAVED1B1_implementation_status.md`

## Dependencies

None added, removed, or updated.

## Remaining separate work

- SAVEDUX1 lightweight Saved View transition animation.
- Automatic last-vault reopening.
- PIN1.
- AUTO1.

These were not started.
