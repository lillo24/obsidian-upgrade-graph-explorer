# PRE-KG14A3 — Exploration Model Cleanup: Scope × Layout + Stable Focus Detail

**Task type:** product-model cleanup / navigation semantics / projection-state isolation / viewport anchoring / pre-KG14A hardening

## Goal

Clean up the user-facing exploration model before KG14A.

The current implementation exposes internal architecture too directly:

```text
View: Structure | Global | Local

and inside Local:
Free | Structured
```

This makes several things appear contradictory:

- `Structure` and `Structured` are different-looking renderers;
- Global and Local Free both look like network graphs;
- double-clicking Global appears to switch to a nearly identical mysterious mode;
- Local can show headings while Structure Depth is hidden;
- a Files-only label can coexist with persisted/manual disclosure;
- changing Focus depth can move the focused File away from the user's screen position.

Replace the exposed model with two understandable dimensions:

```text
SCOPE
All | Focus

LAYOUT
Network | Hierarchy
```

Mapping to existing internals:

```text
All + Network
→ current Global Sigma documents-only view

All + Hierarchy
→ current general Structure React Flow view

Focus + Network
→ current Local Free Sigma bounded view

Focus + Hierarchy
→ current Local Structured React Flow bounded schematic view
```

`Regional` remains only semantic zoom / visual LOD inside Network. It is not a user-selectable mode.

This task should also make Focus hierarchy detail truthful and stable:

```text
Focus + Files only
→ bounded File neighborhood, no automatic headings

Focus + 1 level
→ same File neighborhood
→ first structural generation of Focus root only

Focus + 2 / 3 levels
→ same File neighborhood
→ deeper root hierarchy
```

Changing Focus depth must preserve the focused root's screen position.

Do **not** begin KG14A in this task.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

Current baseline is `main` after:

```text
PR #39 — GROUP1B
merge c54aef9...

PR #40 — PRE-KG14A2 Global activation + stable Structure Focus depth
merge 43ed84943c42be95aef70bd01fbe7c46f9a08638
```

At plan-writing time there is no later merged PR.

Current architecture:

```text
GraphPresentationMode = 'structure' | 'global' | 'local'
LocalLayoutMode       = 'free' | 'structured'
view-state schema     = 3
```

Current `GraphExplorer` exposes:

```text
View: Structure | Global | Local
```

and when Local is active:

```text
Local layout: Free | Structured
```

Current Structure Depth control renders only when the effective renderer is `structure`.

Current true Global remains documents-only through `effectiveGlobalProjectionState(...)` and `mapProjectionToGlobal(...)`.

Current Local entry still derives state by forcing:

```text
defaultDepth = 0
expandedEntityIds += rootDocument
```

which is why Local Free can show the root's `Overview` heading even though there is no visible Structure Depth control.

PRE-KG14A2 added reusable documents-first Focus neighborhood helpers and `projectStructureView(...)`. Reuse those semantics; do not regress them.

GROUP1 presentation is style-only and must remain independent from this work.

---

# Important architectural choice: preserve schema v3 if possible

This task is primarily a **product-facing normalization**, not a canonical/view-state rewrite.

Preferred approach:

```text
keep GraphPresentationMode internally
keep LocalLayoutMode internally
keep persisted view schema v3
```

and derive the new user-facing dimensions from them.

Conceptually:

```ts
type ExplorationScope = 'all' | 'focus'
type ExplorationLayout = 'network' | 'hierarchy'
```

Internal mapping:

```text
scope=all, layout=network
→ rendererMode='global'

scope=all, layout=hierarchy
→ rendererMode='structure'

scope=focus, layout=network
→ rendererMode='local', localLayoutMode='free'

scope=focus, layout=hierarchy
→ rendererMode='local', localLayoutMode='structured'
```

Do not create schema v4 merely to rename/expose these concepts.

If current persistence/history makes a schema change truly necessary, stop and report the exact blocker before doing it.

---

# 1. Replace the exposed View model

Remove the current user-facing:

```text
View: Structure | Global | Local
Local layout: Free | Structured
```

Replace with two compact controls:

```text
Scope
[ All ] [ Focus ]

Layout
[ Network ] [ Hierarchy ]
```

Use existing visual/control-group conventions.

Requirements:

- keyboard accessible;
- clear active state;
- compact enough for normal and maximized graph workspace;
- no large explanatory panel;
- tooltips/help copy may explain the mapping briefly;
- internal type names do not need to be renamed across the whole codebase.

Do not expose the word `Local` as a primary user-facing mode.

Do not expose `Global` as the layout name; it describes scope, not renderer grammar.

Do not expose `Structured`; use the single `Hierarchy` layout concept.

---

# 2. User-facing semantics

The model should be understandable without knowing the architecture:

```text
Scope = how much of the vault is shown
Layout = how that scope is presented
```

## All + Network

Whole-vault / filtered network overview.

- Files only.
- Sigma / GPU network layout.
- folder spatial prior;
- Regional visual LOD through ordinary zoom;
- **Hierarchy depth does not apply here.**

## All + Hierarchy

General Structure view.

- React Flow hierarchy;
- Files + optional headings/blocks;
- Hierarchy depth applies globally.

## Focus + Network

Bounded focused network.

- existing Local Free renderer;
- same file-level Focus neighborhood;
- headings/blocks only according to focused detail/disclosure;
- Hierarchy depth applies to the focused File only.

## Focus + Hierarchy

Bounded focused schematic hierarchy.

- existing Local Structured renderer;
- same exact bounded Local projection as Focus + Network;
- compact schematic visual grammar;
- Hierarchy depth applies to the focused File only.

The focused Hierarchy style may remain visually more compact than All + Hierarchy. That is scale-specific visual grammar, not a separate semantic mode.

Document this explicitly.

---

# 3. Rename Structure Depth to Hierarchy Depth

Rename the user-facing label:

```text
Structure Depth
→ Hierarchy Depth
```

Internal `StructuralDepth` type remains unchanged.

Visibility rule:

```text
All + Network
→ hidden / not applicable

All + Hierarchy
→ visible

Focus + Network
→ visible

Focus + Hierarchy
→ visible
```

This is important: Focus + Network may display hierarchy detail, so the detail control must not disappear merely because Sigma is the renderer.

Do not show a meaningless interactive depth control in All + Network.

A small static hint such as `Files only` is acceptable there only if it improves clarity without clutter; not required.

---

# 4. Focus is the semantic scale-down action

There should be one semantic Focus entry pipeline.

From either All layout:

```text
select File
→ Focus
```

or:

```text
double-click File
→ Focus
```

must use the existing bounded Local entry/history/transition machinery.

Mapping:

```text
All + Network
→ Focus + Network

All + Hierarchy
→ Focus + Hierarchy
```

Therefore:

- Global/Sigma double-click remains a Focus shortcut;
- general Hierarchy/React Flow double-click should also enter the bounded Focus scope rather than keeping a separate hidden "Structure Focus" product mode;
- use the same `planLocalEntry(...)` / history semantics;
- choose `localLayoutMode` from the active All layout before entering Focus.

Do not duplicate Local projection planning.

`projectStructureView(...)` may remain as a source-neutral API/compatibility path, but the normal user-facing Focus flow should converge on the bounded Local scope.

---

# 5. Scope control behavior

## Focus button

When Scope is All:

- if a canonical entity/document is selected, Focus enters that entity's containing document;
- if no focusable entity is selected, disable Focus with a concise accessible explanation such as `Select a file first`;
- heading/block selections may normalize to their containing document while preserving exact selection if the resulting Focus projection can reveal it.

Do not fuzzy-match.

## All button

When Scope is Focus:

- return to the actual prior All history checkpoint if available;
- restore its semantic viewport;
- restore previous All disclosure/query/filter state;
- do not simply mutate `focus = undefined` if history has a richer prior checkpoint.

Fallback if no suitable checkpoint exists:

```text
Focus + Network
→ All + Network

Focus + Hierarchy
→ All + Hierarchy
```

with Focus cleared conservatively.

Rename user-facing `Back to Global` to:

```text
Back to All
```

or remove it if the Scope control makes it redundant while preserving one obvious exit path.

---

# 6. Inspector/navigation copy

Update user-facing actions so they match the new mental model.

Recommended:

```text
Open Local
→ Focus
```

For the existing action that intentionally leaves Focus and reveals exact general Structure context:

```text
Open in Structure
→ Open full hierarchy
```

or another concise copy that makes it clear this means:

```text
Scope = All
Layout = Hierarchy
```

Do not use both `Structure` and `Structured` in user-visible copy.

Update ARIA labels/tooltips/tests/docs consistently.

---

# 7. Remove Local's automatic root-expansion leak

Current `deriveLocalProjectionState(...)` mutates the focused state by:

```text
defaultDepth = 0
expanded root File
```

This couples "enter Focus" to "show top-level headings" and makes a Files-only depth state misleading.

Change the product contract:

```text
Focus entry does NOT automatically expand the root through persisted/manual disclosure.
```

Instead:

- Focus entry preserves/chooses a Hierarchy Depth preset;
- automatic root hierarchy is projection-only;
- `Files only` means no automatic headings;
- `1 level` means focused root's first structural generation;
- `2/3` means deeper root generations;
- neighbor Files remain collapsed automatically;
- explicit manual disclosure remains possible.

Reuse/generalize the root-scoped depth policy already introduced by PRE-KG14A2.

Do not encode automatic Focus hierarchy by adding the root to `expandedEntityIds`.

---

# 8. Focus entry depth policy

Avoid a hidden depth value producing surprising headings after double-clicking the All Network view.

Use this policy:

## Enter Focus from All + Network

```text
Focus starts at Files only (depth 0)
manual disclosure empty
```

because All Network is explicitly Files-only and the user could not see/change hierarchy depth there.

## Enter Focus from All + Hierarchy

```text
Focus inherits the current Hierarchy Depth preset
manual disclosure starts clean
```

The previous All disclosure state is preserved in history and restored when returning to All.

This prevents unrelated manual expansions from leaking into the new Focus scene.

Within Focus, later manual expansions/collapses belong to the focused checkpoint and survive Network ↔ Hierarchy switching.

---

# 9. Exact Focus depth semantics

For Focus root `Associated Value`:

```text
Files only
→ bounded File neighborhood only
```

Then:

```text
1 level
→ SAME File neighborhood
→ add direct/top-level headings of Associated Value only
```

Then:

```text
2 levels
→ SAME File neighborhood
→ add second structural generation under Associated Value
```

Neighbors remain collapsed unless explicitly `+` expanded.

Manual expansion of neighbor File B:

```text
→ reveals B's descendants
→ does not change File-level Focus membership
```

Changing Hierarchy Depth remains a fresh preset and clears current Focus manual expansion/collapse overrides, preserving PRE-KG14A behavior.

---

# 10. Unify Local and Structure Focus detail policy

PRE-KG14A2 added:

```text
projectFocusedDocumentNeighborhood(...)
retainProjectionInsideFocusedDocuments(...)
projectStructureView(...)
```

Local already uses the same file-neighborhood helper but still has a different root-expansion convention.

Refactor narrowly so Focus + Network and Focus + Hierarchy share one source-neutral focused-detail projection contract.

Conceptually:

```text
file-level focused neighborhood
        ↓
root-scoped automatic depth
+ explicit manual disclosure
+ filters / QUERY1
        ↓
exact detailed projection
```

Both Focus renderers consume the same projection.

Do not duplicate the policy in web/renderer code.

Do not change QUERY1 or GROUP1 semantics.

---

# 11. Legacy saved Local-state cleanup

Existing schema-v3 Local saved views may contain the old automatic signature:

```text
presentationMode = local
focus.rootEntityId = File A
expandedEntityIds includes File A
```

because old `deriveLocalProjectionState(...)` automatically inserted the root.

Without cleanup, users may still reopen the app with:

```text
Hierarchy Depth = Files only
but root headings visible
```

Add a conservative compatibility normalization at hydration/session boundary.

Preferred:

- when restoring a legacy Local state from before this change, remove the automatic root expansion that was part of old Local entry semantics;
- preserve other explicit expanded/collapsed IDs where possible;
- do not bump schema v3 only for this cleanup;
- write normalized state on the next ordinary persistence update.

If it is impossible to distinguish old automatic root expansion safely enough, document the ambiguity and choose the smallest user-truthful normalization. Do not silently preserve a known misleading state.

Add migration/compatibility tests.

---

# 12. Truthful depth control with manual overrides

Even after removing the Local leak, legitimate manual disclosure can coexist with a depth preset.

Example:

```text
Hierarchy Depth = Files only
+ user manually expanded File A
```

The control should not imply the graph is purely Files-only.

Add a compact nonintrusive indicator when manual overrides are active, e.g.:

```text
Hierarchy Depth
Files only   Custom
```

or equivalent.

Requirements:

- selected preset value remains 0/1/2/3;
- `Custom` means explicit expanded/collapsed overrides exist;
- choosing a depth preset clears overrides and removes Custom;
- do not create a fifth persisted depth value.

This applies where Hierarchy Depth is visible.

---

# 13. Preserve Focus root screen position across depth changes

PRE-KG14A2 stabilized Focus **membership**, but changing depth still causes a new layout and the root can jump on screen.

Desired behavior:

```text
Associated Value is at screen point P
→ change Files only → 1 level
→ layout recomputes
→ camera compensates
→ Associated Value remains at/near P
```

Do not force Dagre/ForceAtlas2 world coordinates to remain fixed.

Preserve the **screen-space semantic anchor**.

Use the existing narrow transition-anchor APIs already used for:

- Global → Focus;
- Local Free ↔ Structured/Hierarchy;
- React Flow disclosure anchoring.

Before committing a Focus depth action:

1. choose anchor:
   - focused root document first;
   - selected visible entity may be preferred only if current UX clearly supports it;
2. query its active renderer viewport point;
3. commit the semantic depth change;
4. apply the resulting runtime-only transition anchor to the next Focus renderer scene;
5. preserve the anchor again after worker-refined layout where current renderer architecture supports it.

Must work in:

```text
Focus + Network
Focus + Hierarchy
```

Do not persist screen points.

All + Hierarchy may retain current depth-change camera behavior unless a trivial shared fix is clearly safe; this task's required anchor is Focus.

---

# 14. Network/Hierarchy layout switching in Focus

The same Layout control changes only presentation:

```text
Focus + Network ↔ Focus + Hierarchy
```

Expected:

```text
0 KG6 reprojection if semantic state unchanged
same Focus root
same file neighborhood
same hierarchy detail
same query/filter state
same selection where visible
screen anchor preserved
```

Reuse current Free ↔ Structured transition machinery.

User-facing labels are Network / Hierarchy.

Internal `free` / `structured` values may remain.

---

# 15. All layout switching

When Scope = All:

```text
Network ↔ Hierarchy
```

maps to existing Global / Structure presentations.

Preserve current separate semantic viewport bookmarks.

Do not carry Global's files-only projection into All + Hierarchy.

Do not let Hierarchy disclosure mutate true Global topology.

---

# 16. True All + Network invariant

Add a hard regression test:

```text
Scope = All
Layout = Network
→ every entity node is a document
→ no section/block nodes
```

The renderer already rejects non-document Global entity nodes; keep that invariant.

If `Overview` appears while UI says:

```text
All + Network
```

that is a bug, not a supported configuration.

The new UI must make it visually obvious when the user is actually in:

```text
Focus + Network
```

which may legitimately show headings according to Hierarchy Depth.

---

# 17. Regional is not a mode

Remove/avoid copy suggesting Regional is a separate selectable view.

Document:

```text
Network far zoom
→ sparse labels/detail

Network closer zoom
→ Regional visual detail
```

Same topology, positions, scope, and layout.

No new button.

---

# 18. Visual grammar explanation

The `Hierarchy` layout is one conceptual layout with scale-specific visual grammar:

```text
All + Hierarchy
→ general Structure cards

Focus + Hierarchy
→ compact schematic/Vivado-style cards
```

This difference is intentional because Focus has more room to emphasize local hierarchy.

Do not call the second one `Structured` in user-facing UI.

Do not force both to identical CSS solely for naming consistency.

---

# 19. Selection / Inspector behavior

Preserve controlled selection.

Entering Focus:

- selected root remains selected where possible;
- heading/block target may preserve exact selection after reveal;
- Inspector stays open if current behavior allows;
- Visual Group memberships remain identical for the same canonical entity.

Exiting Focus restores the prior All checkpoint and compatible selection policy.

Do not create separate Network/Hierarchy Inspectors.

---

# 20. Search / QUERY1 behavior

Do not change QUERY1 syntax or Saved Filters.

Mode-aware canonical Search should remain semantically correct under the new copy/model.

Recommended behavior:

## All + Network

- document target → stay All + Network;
- heading/block exact target → use existing exact hierarchy navigation behavior unless user explicitly chooses Focus.

## Focus

- target inside current focused projection → stay Focus;
- target in another document → reroot Focus using existing Local navigation planner;
- preserve active Layout.

Update user-facing announcements from `Local`/`Global` terminology to Focus/All where they are exposed.

Internal names may remain.

---

# 21. History / persistence

Preserve existing renderer-specific semantic viewport persistence.

Do not create schema v4 by default.

Required history scenarios:

```text
All Network
→ Focus Network
→ Back
→ All Network

All Hierarchy
→ Focus Hierarchy
→ Back
→ All Hierarchy

Focus Network
→ Hierarchy layout
→ All
→ Back/Forward
```

The new Scope/Layout controls must restore coherently from current schema-v3 checkpoints.

Local layout changes may retain their existing preference/history policy internally; user-facing behavior must remain predictable.

Document the policy if it remains asymmetric internally.

---

# 22. GROUP1 compatibility

GROUP1B is merged.

This task must preserve:

```text
same visual-group registry/session
same QUERY1-backed matching
same canonical EntityId presentation map
same styling across All Network, All Hierarchy, Focus Network, Focus Hierarchy
```

Scope/layout changes may change which entities are visible, but must not alter Visual Group classification.

No GROUP1 data-model changes.

---

# 23. Accessibility

The new controls need explicit semantics.

Suggested:

```text
Scope group
  All
  Focus

Layout group
  Network
  Hierarchy
```

Requirements:

- keyboard operable;
- `aria-pressed` or radio semantics;
- Focus disabled state explained if no focusable selection;
- focused root announced/available as text, ideally:
  `Focused: Associated Value`;
- Network Sigma remains visual-only with DOM Search/Inspector alternatives;
- Hierarchy React Flow retains keyboard node/disclosure semantics;
- no focus loss during scope/layout switch.

---

# 24. Performance / operation oracles

Preserve existing architecture boundaries.

Required operation counts:

## Focus depth change

```text
1 focused semantic projection update
active Focus layout only
0 Global layout requests
0 KG10/workspace work
```

## Focus Network ↔ Hierarchy

```text
0 KG6 reprojections if semantics unchanged
0 Global layout
only active presentation layout work
```

## All Network ↔ Hierarchy

Use existing presentation projections; no workspace rebuild.

## Zoom

```text
Network zoom
→ visual LOD only
→ no projection/layout
```

No new general cache without evidence.

---

# 25. Documentation

Update user/product-facing architecture docs to explain the new orthogonal model.

Likely:

```text
apps/web/README.md
apps/web/src/components/README.md
packages/view-projection/README.md
packages/renderer-sigma/README.md
packages/renderer-reactflow/README.md
docs/ARCHITECTURE.md
docs/GLOBAL_RENDERER_DECISION.md
```

Do not rewrite historical ADRs as though they never used Global/Local terminology.

Add a new concise ADR only if useful, e.g.:

```text
0016 — user-facing exploration scope and layout model
```

It should record:

1. user-facing Scope = All / Focus;
2. user-facing Layout = Network / Hierarchy;
3. internal Global/Local/Structure renderer names remain implementation details;
4. Focus uses one bounded Local projection;
5. Focus hierarchy detail is depth-controlled, not implicit root expansion;
6. Focus depth changes preserve root screen anchor;
7. Regional is visual LOD, not navigation state.

---

# Scope

## In scope

- Scope All/Focus control;
- Layout Network/Hierarchy control;
- hide user-facing Global/Local/Structured mode terminology;
- map controls to existing renderers;
- unified Focus entry from both All layouts;
- Global and Hierarchy double-click → Focus;
- Back to All semantics;
- Hierarchy Depth naming/visibility;
- root-scoped Focus depth in both layouts;
- remove Local automatic root expansion;
- clean Focus-entry manual disclosure;
- legacy Local root-expansion compatibility normalization;
- manual-override Custom indicator;
- Focus root screen anchoring across depth changes;
- Search/Inspector copy updates;
- history/persistence compatibility;
- GROUP1/QUERY1 regression;
- browser/Tauri QA;
- docs/ADR if justified;
- prompt archival;
- PR/CI/cleanup.

## Explicitly out of scope

Do not implement:

- multi-focus;
- new renderer;
- new layout algorithm;
- Global headings;
- Regional mode button;
- QUERY1 changes;
- GROUP1 changes;
- Saved Views;
- manual positions;
- analytics;
- KG14A audit itself.

---

# Suggested implementation sequence

1. Sync latest `main` and verify PR #39/#40 are present.
2. Add pure UI mapping helpers for Scope/Layout ↔ internal modes.
3. Replace current View + Local layout controls with Scope + Layout.
4. Rename Structure Depth → Hierarchy Depth and implement visibility rules.
5. Normalize Focus entry from both All layouts through `planLocalEntry(...)`.
6. Remove automatic root expansion from Local state derivation.
7. Generalize focused root-scoped depth policy so both Focus layouts share it.
8. Clear manual disclosure on fresh Focus entry while preserving prior All checkpoint.
9. Add compatibility normalization for old saved Local root expansion.
10. Add Custom-disclosure indicator.
11. Add Focus-depth screen-anchor capture/restore for Sigma and React Flow.
12. Update Inspector/Search/navigation copy.
13. Add operation-count and projection invariants.
14. Run focused tests.
15. Run full `pnpm check` + desktop build.
16. Production browser QA.
17. Release Tauri `.exe` QA using Synthetic Sample + Associated Value scenario.
18. Archive this prompt under `history-implementations/`.
19. PR → CI → merge → post-merge CI → cleanup.
20. Stop; KG14A remains next.

---

# Validation commands

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/view-projection typecheck
pnpm exec vitest run packages/view-projection

pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm benchmark:performance -- --profile small
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also run:

```text
Scope/Layout mapping oracle
All Network documents-only oracle
All Hierarchy depth 0/1/2/3 QA
All Network → double-click → Focus Network QA
All Hierarchy → double-click → Focus Hierarchy QA
Focus Files-only → 1 level root-anchor QA
Focus Network depth 0/1/2/3 QA
Focus Hierarchy depth 0/1/2/3 QA
manual neighbor expansion QA
legacy saved Local expansion restore QA
Custom disclosure indicator QA
Focus Network ↔ Hierarchy zero-reprojection oracle
Back to All history/viewport QA
QUERY1/Saved Filters regression
GROUP1 visual style regression
production browser matrix
release Tauri matrix
physical touchpad smoke
```

PR CI and post-merge `main` CI must pass.

---

# Exit gate

PRE-KG14A3 is complete only when:

1. user-facing primary controls are Scope and Layout.
2. Scope values are All / Focus.
3. Layout values are Network / Hierarchy.
4. user-facing `Global`, `Local`, `Free`, and `Structured` mode labels are removed from primary exploration controls.
5. internal renderer mode types may remain unchanged.
6. All + Network maps to current Global Sigma renderer.
7. All + Hierarchy maps to current general Structure renderer.
8. Focus + Network maps to current Local Free renderer.
9. Focus + Hierarchy maps to current Local Structured renderer.
10. Regional remains zoom LOD only.
11. double-click in All + Network enters Focus + Network.
12. double-click in All + Hierarchy enters Focus + Hierarchy.
13. both use the existing bounded Focus/Local semantic pipeline.
14. Focus button is disabled/explained without a focusable selection.
15. Back/All restores the prior All history checkpoint.
16. Open Local user-facing copy is replaced by Focus-equivalent copy.
17. Back to Global copy becomes Back to All or is made redundant by Scope control.
18. `Structured` is no longer a user-facing layout name.
19. Structure Depth is renamed Hierarchy Depth.
20. Hierarchy Depth is hidden in All + Network.
21. Hierarchy Depth is visible in All + Hierarchy.
22. Hierarchy Depth is visible in Focus + Network.
23. Hierarchy Depth is visible in Focus + Hierarchy.
24. All + Network contains document entity nodes only.
25. an `Overview` Section cannot appear in All + Network.
26. entering Focus from All + Network starts at Files only.
27. entering Focus from All + Hierarchy inherits current depth.
28. fresh Focus entry does not inherit unrelated manual disclosure overrides.
29. Focus Files-only has no automatic root headings.
30. Focus 1 level shows root first structural generation only.
31. Focus 2/3 expose corresponding root generations.
32. Focus document neighborhood is identical across depth 0/1/2/3 absent intentional filters.
33. neighbor Files remain automatically collapsed.
34. manual neighbor expansion still works.
35. depth preset changes clear manual Focus overrides.
36. Local automatic root expansion is removed from state derivation.
37. old persisted Local automatic root expansion is normalized conservatively.
38. legitimate manual disclosure is indicated as Custom where depth control is visible.
39. selecting a depth preset clears Custom.
40. Focus root screen point is preserved across depth changes in Network.
41. Focus root screen point is preserved across depth changes in Hierarchy.
42. runtime screen points are not persisted.
43. Focus Network ↔ Hierarchy causes zero KG6 reprojection when semantics are unchanged.
44. Focus layout switch preserves root/selection/query/filter state.
45. All layout switching preserves renderer-specific semantic viewports.
46. QUERY1 and Saved Filters remain unchanged.
47. GROUP1 visual classification/styling remains unchanged.
48. Visual Groups remain style-only.
49. Search navigation remains exact.
50. Inspector remains shared.
51. view-state schema remains v3 unless an explicit blocker was reported and approved.
52. no new external runtime dependency is added.
53. Structure/Global/Local renderer performance does not materially regress.
54. browser production QA passes.
55. release Tauri QA passes.
56. physical touchpad smoke passes.
57. docs explain Scope × Layout clearly.
58. prompt is archived.
59. PR CI passes.
60. post-merge CI passes.
61. branch/worktree cleanup completes.
62. KG14A is not started automatically.

---

# Final report

## 1. Summary

State the final user-facing exploration model.

## 2. Scope × Layout mapping

Show:

```text
             Network        Hierarchy
All          Global         Structure
Focus        Local Free     Local Structured
```

with internal names clearly marked as implementation terms only.

## 3. Focus entry/exit

Double-click, Focus control, Back to All, history behavior.

## 4. Hierarchy Depth

Visibility and exact semantics in each Scope/Layout combination.

## 5. Local disclosure cleanup

Explain removal of implicit root expansion and compatibility handling for old saved Local state.

## 6. Camera anchoring

How focused root screen position survives depth relayout.

## 7. Persistence/history

Confirm schema-v3 compatibility and viewport behavior.

## 8. Search / Inspector / QUERY1 / GROUP1

Regression evidence and copy changes.

## 9. Performance / operation counts

Especially Focus depth and Network↔Hierarchy layout switch.

## 10. Tests / browser / Tauri QA

## 11. Files changed

## 12. Dependencies

Expected additions: zero.

## 13. Deviations / warnings

Surface any remaining internal-mode asymmetry, legacy persistence ambiguity, or scope/layout UX compromise that KG14A should audit.

## 14. Roadmap

Confirm:

```text
KG13 complete
PRE-KG14A / PRE-KG14A2 / PRE-KG14A3 cleanup complete
KG14A next
```

Do not implement KG14A automatically.
