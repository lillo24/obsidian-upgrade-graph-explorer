# SAVED1B implementation report

Status: **implemented and validated locally and in a production browser; the
draft PR is open and native acceptance is pending.**

Implementation branch: `codex/saved1b-profiles-quick-switch`

[Draft PR #92](https://github.com/lillo24/obsidian-upgrade-graph-explorer/pull/92)
is the isolated integration vehicle and remains deliberately unmerged pending
the native acceptance gate.

## Summary

SAVED1B extends workspace-scoped Saved Views with presentation-specific setting
profiles and a compact quick switch. The selected label is derived from the
current semantic view and owned profile values; there is no persisted active
Saved View identity and startup never reapplies a Saved View.

The work is isolated from the original checkout and preserves SAVED1A entries,
Current View resume state, unrelated Graph Preferences, Saved Queries, Visual
Groups, per-File Size, and unrelated spatial registries.

## Registry and migration

- The Saved Views registry schema is now `2`.
- Strict schema-v1 registries migrate in memory with `profile` absent. Loading a
  v1 registry performs no storage write; the next explicit Save, Update, Rename,
  or Delete writes canonical schema-v2 bytes.
- Newly saved or updated entries always contain a profile coherent with the
  entry's Scope/Layout pair.
- Validation remains fail-loud and exact: malformed fields, mismatched profile
  kinds, noncanonical entries, and spatial state for another workspace are
  rejected rather than partially accepted.
- Rename changes only the name; Delete changes only the registry. Deterministic
  ordering and canonical serialization are retained.

## Profile ownership matrix

- **All Network:** complete validated Global renderer settings plus the current
  workspace's folder spatial registry.
- **Focus Network:** only Reference pull, Node size, Link thickness, and Label
  threshold.
- **Focus Hierarchy:** only the documented hierarchy presentation subset.
- **All Hierarchy:** an explicit no-op profile.
- Migrated SAVED1A entries with no profile remain semantic bookmarks until the
  user explicitly updates them.

Profiles deliberately exclude Saved Queries, Visual Groups, per-File Size,
source content, query draft, Search text, selection, Back/Forward history,
Current View identity, raw camera transforms, transient worker coordinates,
manual File positions, and settings owned by a different presentation.

## Apply transaction and failure policy

Profile application validates and canonicalizes every affected value before its
first durable write. All Network writes the spatial registry first and Graph
Preferences second, then adopts in-memory state. On failure it rolls back only
successfully written keys in reverse order using their exact previous raw
values. Rollback failure is surfaced explicitly.

An apply with an exactly matching profile performs zero persistence writes.
Durable spatial state is required before applying an All Network spatial
profile. A failed transaction retains semantic state, presentation, history,
selection, Graph Preferences, and the in-memory spatial registry.

Temporary File movement is canceled before persistence. A dirty Arrange
Folders draft blocks Apply so uncommitted work is never discarded.

## Rendering and viewport policy

- Visual-only Global setting changes refresh the renderer without projection,
  topology mapping, reconciliation, layout, spatial writes, or camera work.
- Global physics differences issue exactly one global layout request, including
  when combined with a spatial-profile change.
- The existing final-generation viewport gate is used only when semantic state
  or geometry-affecting profile values differ.
- Exact semantic/profile application skips projection, layout, and camera work.

No SAVEDUX1 animation or transition system was introduced.

## Quick switch and accessibility

- One native Saved Views select and adjacent **Manage** button appear in normal
  and maximized modes; inactive duplicate controls are not rendered.
- The selected value is a case-insensitive deterministic match of semantic view
  plus all owned profile values, otherwise **Current View**.
- Long names visually truncate while their full accessible name remains
  available. Controls wrap cleanly at a 320-pixel viewport.
- The existing manager remains the owner of Save, Update, Rename, and Delete.
  Its summaries distinguish **Profile** from migrated **View only** entries.
- Escape closes the manager and restores focus to Manage.
- Reload derives the matching label after Current View restoration without an
  Apply action, persistence write, or apply announcement.

## Validation

- `pnpm install --frozen-lockfile`: passed; no dependency or lockfile change.
- Focused SAVED1B suites: passed.
- `pnpm exec vitest run apps/web`: **76 files / 605 tests passed**.
- `pnpm exec vitest run packages/renderer-sigma`: **57 files / 414 tests
  passed**.
- `pnpm exec vitest run packages/spatial`: **7 files / 67 tests passed**.
- `pnpm lint`: passed.
- `pnpm check`: formatting, lint, all workspace typechecks, **244 files / 1,983
  tests**, and the production web build passed after rebasing onto the latest
  `main`.
- `pnpm benchmark:global-renderer -- --profile small`: passed; the visual-only
  contract recorded zero projection/topology/reconciliation/layout/coordinate
  writes and one Sigma visual refresh.
- `pnpm benchmark:local-renderer -- --profile small`: passed; exact cache-hit
  and layout-toggle contracts recorded zero unnecessary projection/layout or
  workspace transactions.
- `pnpm desktop:check`: Rust formatting and debug check passed.
- `pnpm desktop:build`: optimized Windows no-bundle build passed. The executable
  is `apps/desktop/src-tauri/target/release/icarus-graph-explorer-desktop.exe`.
- `git diff --check`: passed before this report was added and is rerun during
  final inspection.

Production-browser QA used the minified build on a clean origin. It created a
long-name Saved View, observed Current View after changing an owned setting,
updated the entry, applied it from the quick switch, and verified the setting
was restored. Normal, maximized, 320×640, manager reflow, accessible full-name,
Escape/focus restoration, and reload-derived matching all passed. The clean
browser console had no warnings or errors.

Native desktop UI interaction could not be executed because native computer
control is disabled in this environment. Desktop compile/package validation
passed, but physical keyboard/pointer interaction and restart persistence remain
the explicit user acceptance gate before merge.

## Dependencies

No dependency was added, removed, or updated.

## Traceability

The supplied prompt is archived verbatim at
`history-implementations/SAVED1B_saved_view_profiles_quick_switch_codex_prompt.md`.
Its SHA-256 matches the source attachment:
`018408785C16F8C0620818B415FE0205BAFD095C3478ECC2D0FBA92B8BD761D8`.

## Remaining work

- Open the isolated draft PR and let required CI complete.
- Record user/native acceptance, then mark the PR ready and merge only after the
  requested gate.
- Run post-merge CI and remove the isolated worktree/branch when no follow-up QA
  needs it.
- SAVEDUX1 transitions, PIN1 persistent File placement, and AUTO1 adaptive
  layout selection remain separate work.
