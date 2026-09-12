# SAVED1A implementation report

Status: **implemented and locally validated; PR/native acceptance pending.**

Implementation branch: `codex/saved1a-named-saved-views`

## Summary

SAVED1A adds durable workspace-scoped **Saved Views** as explicit named semantic
bookmarks. It leaves KG9's one automatic **Current View** resume record intact
and keeps Saved Queries, Graph Preferences, Visual Groups, per-File Size, and
folder spatial rules independent.

The feature is implemented in an isolated worktree created from the latest
`main` after confirming PR #84 was merged and its `validate`/`desktop` checks
passed. No unrelated original-worktree state was modified.

## Saved View schema

- Registry schema: `1`.
- Storage key:
  `icarus-graph-explorer:saved-views:<encodeURIComponent(workspaceId)>`.
- Entry: `{ name, layout, view }`, where `layout` is `network | hierarchy` and
  `view` is an existing strict schema-v3 `PersistedWorkspaceView`.
- Names are trimmed, 1–64 characters, and case-insensitively unique.
- Registries contain at most 50 deterministically sorted entries.
- Validation rejects unknown fields, non-JSON-safe/plain values, wrong schema or
  workspace, malformed embedded view state, noncanonical query/list ordering,
  duplicate names, invalid layout, and inconsistent Scope/Layout presentation.
- Corrupt/unsupported bytes are never partially accepted, overwritten, or
  silently deleted.
- Stable writable workspaces use durable write-before-adopt mutations. Transient,
  legacy, and storage-unavailable sessions explain why Save/Update/Rename/Delete
  are disabled. Failed writes retain the last confirmed in-memory registry.

## Captured state

Each entry captures only the normalized renderer-independent graph contract:

- All/Focus and explicit Network/Hierarchy;
- hierarchy default depth, Heading limit, Blocks, and manual expanded/collapsed
  entity IDs;
- Focus root, hops, direction, and hierarchy-context policy;
- path/entity/reference-status filters and the canonical applied QUERY1 string;
- semantic Structure/Global/Local entity-plus-zoom/ratio viewport bookmarks.

## Deliberately excluded state

Snapshots contain no raw Sigma/React Flow camera transform, Graphology/Dagre/
ForceAtlas2/worker coordinate, manual File position, selection, Search text,
query draft, Back/Forward stacks, active overlays/drawers/maximize state, source
content, Graph Preferences, Visual Group definitions, Saved Query definitions,
per-File Size entries, or folder spatial rules.

Save writes only the Named Saved Views registry. Update is the only operation
that replaces a stored semantic snapshot; ordinary graph navigation never
auto-mutates an entry.

## Scope/Layout restore

One shared planning function validates the entry, reconciles the embedded
schema-v3 view against the current `ProjectionWorkspace`, and then applies the
existing exploration-availability normalization. All Network, All Hierarchy,
Focus Network, and Focus Hierarchy are covered. A Focus Saved View derives its
live Free/Structured renderer from `SavedView.layout`, never from a later
preference value.

Graph Preferences own the live Focus layout, so applying a Focus entry may
persist only the narrow `localLayoutMode` field. Every unrelated preference
remains unchanged. An unavailable experimental All Hierarchy falls back through
the existing product policy with a concise nonfatal announcement; the feature
flag is not changed.

## View reconciliation

Application uses the existing KG9 restore/reconciliation contract. Stable IDs
survive File path/name movement. Missing disclosure entities and viewport
anchors are dropped with issues; a missing viewport anchor reaches the existing
semantic Fit path. A deleted Focus root exits Focus conservatively and never
fuzzy-retargets. Reconciliation operates on a restored copy and never rewrites
the stored entry unless the user explicitly chooses Update.

## History policy

Apply is a named workspace-context jump. It cancels an active temporary File
move, refuses to discard a dirty Arrange Folders draft, exits editing, replaces
graph state once, changes presentation/layout, installs semantic bookmarks,
clears graph selection and the Inspector, adopts the canonical query into the
query editor, and clears both Back/Forward stacks to establish a new baseline.
It reuses the existing final-generation-gated semantic viewport request. An
exact-equivalent application skips needless projection/layout and viewport work
while retaining the explicit history/selection reset.

Ordinary KG9 autosave persists the reconciled applied result as Current View;
the Named Saved Views registry is not rewritten during Apply.

## Current View terminology

User-facing controls, alerts, tests, and active documentation now use **Reset
current view** for KG9 automatic resume state. That reset deletes only the
workspace's `view-state` key and explicitly leaves Named Saved Views unchanged.
The separate two-step **Reset Saved Views registry** corrupt-data recovery
deletes only the Named Saved Views key.

## UI/accessibility

- One bookmark trigger appears after Scope/Layout in normal mode and after
  Back/Forward in maximized mode; the inactive copy is not rendered, preventing
  duplicate IDs.
- The portal is nonmodal, viewport-bounded, internally scrollable, and reflows
  entry actions at narrow widths.
- Initial focus enters the Name field. Escape and the close button restore the
  trigger; outside pointer dismissal preserves the new target's focus.
- Save, Apply, Update, Rename, and two-step Delete controls are keyboard
  reachable. Inline validation uses an alert. Successful Apply closes the
  popover.
- A production-browser pass found that the initial portal layer was behind the
  fixed maximized workspace. The popover now has a documented layer between the
  maximized workspace and skip link, and the corrected build was retested.

## Cross-registry safety

Unit and integration tests prove Current View reset and Saved Views recovery
touch only their own keys. Apply leaves the Saved Views bytes unchanged and
does not mutate Saved Queries, Visual Groups, spatial overrides, presentation
overrides, source data, or unrelated Graph Preferences. Current live registries
continue to feed the applied projection/renderers.

## Performance/operation counts

Save is covered with runtime operation counters: zero additional Global/Local
projection or layout work and exactly one write to the Named Saved Views key.
Rename/Delete are pure small-registry mutations. Apply performs one state
replacement rather than replaying individual graph actions. Exact semantic
reapplication produces zero additional projection/layout work and no viewport
center request.

## Validation

- `pnpm install --frozen-lockfile`: passed; no dependency or lockfile change.
- Focused SAVED1A suite: **5 files / 33 tests passed**.
- `pnpm exec vitest run packages/view-state`: **48 tests passed**.
- `pnpm exec vitest run apps/web`: **73 files / 567 tests passed**.
- `pnpm check`: formatting, lint, all workspace typechecks, **226 files / 1,860
  tests**, and production web build passed.
- `pnpm desktop:check`: Rust formatting and debug check passed.
- `pnpm desktop:build`: optimized Windows no-bundle build passed.
- Optimized executable startup smoke: remained alive for five seconds without
  early exit, then the exact smoke process was stopped.

Production-browser QA used the real minified build and Synthetic Sample. It
saved and reloaded three entries (All Network, Focus Network, Focus Hierarchy),
applied each from unrelated state, restored Focus depth/hops/direction/query,
cleared selection/history, kept Saved Filters/Visual Groups visible, and
confirmed ordinary Current View resume after reload. Rename and Update worked;
Delete exposed its explicit confirmation without deleting the QA registry. List
summaries expose the canonical query rather than an opaque internal record. The
popover restored keyboard focus, rendered as one trigger in normal/maximized
mode, reflowed with an internal scrollbar at 320×640, and remained visible over
the maximized canvas after the stacking fix. The browser console had no warnings
or errors.

Fresh optimized native product interaction remains an explicit merge gate. The
release executable exists and passed startup smoke, but restart persistence,
physical keyboard/pointer interaction, and physical pan/zoom → Save → Apply
accuracy still require accepted native QA under the repository policy.

## Files changed

- Saved Views registry/session: `apps/web/src/persistence/saved-views*.ts`.
- Capture/apply composition: `apps/web/src/saved-view.ts`.
- Product UI: `apps/web/src/components/SavedViews.tsx` and
  `SavedViewsPopover.tsx`.
- Orchestration/styles: `GraphExplorer.tsx`, `App.css`, and current-view wording.
- Regression coverage: focused persistence/composition/component/integration
  tests plus the App terminology assertion.
- Documentation: root/web/component/persistence maps, Architecture, Roadmap,
  Product Quality Audit, validation wording, and ADR 0025.
- Traceability: this report and the normalized-content-identical supplied prompt
  archive.

## Dependencies

No dependency was added or removed.

## Remaining work

- Explicit optimized native product QA acceptance before merge.
- PR CI and post-merge CI after that acceptance.
- Worktree and branch cleanup after merge.
- SAVED1B settings/spatial profile composition, PIN1 persistent individual File
  placement, and AUTO1 adaptive layout selection remain separate future work and
  were not started.
