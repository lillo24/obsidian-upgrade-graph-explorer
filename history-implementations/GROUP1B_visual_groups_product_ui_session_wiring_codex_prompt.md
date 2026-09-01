# GROUP1B — Visual Groups Product UI + Session Wiring

**Task type:** product UI / workspace-session persistence / GROUP1A wiring / cross-renderer presentation / Inspector integration / responsive + accessibility QA

## Goal

Complete the user-facing Visual Groups product on top of the already-merged GROUP1A backbone.

GROUP1A already established:

```text
QUERY1 canonical rule
        ↓
Visual Group definition
        ↓
compiled canonical entity matching
        ↓
EntityId → VisualGroupNodePresentation
        ↓
Structure / Global / Local Free / Local Structured
```

GROUP1B must add the missing product layer:

```text
workspace registry session
        ↓
Groups UI
        ↓
create / edit / reorder / enable / color
        ↓
compile definitions
        ↓
derive current EntityId presentation map
        ↓
pass map to every current renderer
        ↓
show selected-entity memberships in Inspector
```

Do **not** redesign GROUP1A semantics.

Do **not** add layout clustering.

Do **not** add a second query language.

---

# Current repository grounding

Repository:

`lillo24/icarus-graph-explorer`

Current `main` at prompt-writing time:

```text
6dc4236f8358706c45035e6ba0ccc5a1e95c328f
```

This is the GROUP1A merge commit from PR #37.

Current roadmap state:

```text
KG13 — complete
KG14 — next

QUERY1 — complete
GROUP1A — complete
GROUP1B — pending
```

KG13 now includes:

```text
Structure
Global / Regional
Local Free
Local Structured
```

GROUP1A already connects all four presentations to one Visual Group classification contract.

GROUP1B should therefore be primarily a **web product/session milestone**, not another renderer-architecture milestone.

---

# Existing GROUP1A contracts — do not duplicate

The source-neutral package already exists:

```text
@icarus-graph-explorer/visual-groups
```

It exports:

```text
compileVisualGroups()
assignPrimaryVisualGroupPresentations()
matchingVisualGroupsForEntity()
resolvePrimaryVisualGroup()
validateAndCanonicalizeVisualGroupDefinitions()

VISUAL_GROUP_PALETTE
visualGroupPaletteEntry()

MAX_VISUAL_GROUPS
MAX_VISUAL_GROUP_NAME_LENGTH
```

The durable definition is already fixed:

```ts
interface VisualGroupDefinition {
  readonly name: string;
  readonly query: string;
  readonly color: VisualGroupColor;
  readonly enabled: boolean;
}
```

The palette is already fixed to eight stable tokens.

The renderer-safe presentation is already fixed conceptually as:

```text
{ groupName, color, accent }
```

Do not create another type with different semantics.

---

# Existing persistence backbone — use it

GROUP1A already added:

```text
apps/web/src/persistence/visual-groups.ts
```

with:

```text
VisualGroupRegistry
schemaVersion 1

createEmptyVisualGroupRegistry()
loadVisualGroupRegistry()
saveVisualGroupRegistry()

addVisualGroup()
updateVisualGroup()
deleteVisualGroup()
moveVisualGroupUp()
moveVisualGroupDown()
setVisualGroupEnabled()
```

It already enforces:

- workspace-scoped storage;
- canonical QUERY1 rules;
- case-insensitive unique names;
- exact priority order;
- fixed palette tokens;
- explicit corruption/write failures;
- deterministic serialization.

GROUP1B must consume these functions rather than reimplementing registry logic in React components.

---

# Existing presentation derivation — use it

GROUP1A already added:

```text
apps/web/src/visual-groups/presentation.ts
```

including:

```text
visualGroupEntityIdsForProjection()
deriveVisualGroupPresentationMap()
deriveProjectionVisualGroupPresentationMap()
```

This deliberately operates **after** projection and never calls `projectView()`.

Use this path.

Do not calculate group membership inside KG6.

---

# Existing renderer seams — use them

GROUP1A already added style-only Visual Group seams for:

```text
Structure React Flow
Global Sigma
Local Free Sigma
Local Structured React Flow
```

The operation oracle is already proven:

```text
GROUP1 style update
→ projection +0
→ topology/layout +0
→ style update +1
```

GROUP1B must wire maps into those seams.

Do not redesign renderer mapping or layout fingerprints.

---

# Core semantic rule

Visual Groups classify; they do not filter.

Example:

```text
Active QUERY1 filter:
  path:"Research"

Visual Group:
  title:"Draft"
```

QUERY1 decides which entities appear.

GROUP1 colors the visible entities that also match the group.

Never make enabling/disabling a group change graph visibility.

---

# Priority rule

Registry order is priority:

```text
first enabled matching group wins primary visual accent
```

GROUP1B UI must make this understandable.

Do not blend overlapping colors.

Do not invent specificity ranking.

---

# No layout semantics

A Visual Group must not:

- move nodes;
- cluster nodes;
- add synthetic edges;
- add ForceAtlas attraction;
- alter Dagre rank;
- alter Global folder prior;
- alter Local layout;
- create a group hull/region in GROUP1B.

Current KG13 spatial architecture remains authoritative.

---

# Required first step

Before editing:

1. sync/fetch actual latest `main`;
2. confirm the GROUP1B worktree is clean;
3. inspect all commits after `6dc4236f8358706c45035e6ba0ccc5a1e95c328f`;
4. read:
   - `AGENTS.md`;
   - `docs/ROADMAP.md`;
   - `docs/ARCHITECTURE.md`;
   - `docs/PERFORMANCE.md`;
   - `packages/visual-groups/README.md`;
   - `packages/visual-groups/src/index.ts`;
   - `packages/visual-groups/src/types.ts`;
   - `packages/visual-groups/src/palette.ts`;
   - `packages/visual-groups/src/compile.ts`;
   - `apps/web/src/persistence/visual-groups.ts`;
   - `apps/web/src/visual-groups/presentation.ts`;
   - `apps/web/src/persistence/saved-filters.ts`;
   - `apps/web/src/persistence/session.ts`;
   - `apps/web/src/persistence/storage.ts`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphFilters.tsx`;
   - `apps/web/src/components/graph-workspace-overlays.ts`;
   - `apps/web/src/components/ProvenanceInspector.tsx`;
   - `apps/web/src/components/GraphSettings.tsx`;
   - `apps/web/src/components/GlobalGraphView.tsx`;
   - `apps/web/src/components/LocalGraphView.tsx`;
   - Local Structured wrapper/current files;
   - React Flow Visual Group seam/tests;
   - Sigma Global/Local Visual Group seam/tests;
   - GROUP1A benchmark;
5. preserve the latest KG13/KG14-related changes;
6. if `main` moved, adapt rather than restoring stale UI code.

---

# Part 1 — Add a Visual Group session to GraphExplorer

GraphExplorer should own the current workspace's Visual Group product session, analogous in responsibility to current Saved Filters ownership but using the already-built Visual Group registry.

Conceptual state:

```ts
interface VisualGroupSession {
  readonly registry: VisualGroupRegistry;
  readonly persistenceMode:
    | 'durable'
    | 'session-only'
    | 'blocked-corrupt'
    | 'blocked-write-failure';
  readonly status: string;
  readonly error?: string;
}
```

Exact shape can differ.

The important distinctions must remain explicit.

---

# Workspace identity policy

For an explicitly stable workspace with accessible storage:

```text
load workspace VisualGroupRegistry
→ durable edits
```

For unstable/transient identity:

```text
start empty in-memory registry
→ Visual Groups work for this session
→ no cross-session durability
```

For storage unavailable:

```text
start empty in-memory registry
→ session-only edits work
```

Do not disable the entire feature just because persistence is unavailable.

---

# Corrupt stored registry

GROUP1A correctly refuses silent overwrite.

GROUP1B should make this recoverable in product UI.

On corrupt/incompatible durable registry:

```text
graph still works
Groups panel explains saved Visual Groups could not be loaded
durable writes are blocked
```

Add an explicit recovery action:

```text
Reset saved Visual Groups
```

This must:

1. require an explicit second confirmation in the Groups panel;
2. delete only the current workspace's Visual Group storage key;
3. create an empty in-memory registry;
4. restore durable writes if storage succeeds;
5. not reset graph view, Saved Filters, identity catalog, layout preferences, or vault data.

Add a narrow `clearVisualGroupRegistry()` storage function if needed.

Never silently clear corrupt data.

---

# Write failure

If a durable mutation fails to write:

- keep the last confirmed registry active;
- do not claim the mutation succeeded;
- show an actionable error;
- stop further durable mutations for the session unless the user reloads/reopens;
- graph remains usable.

Do not partially apply a color/edit in memory and pretend it is durable.

Session-only mode is different: mutations are intentionally in memory and should succeed without storage.

---

# Part 2 — Compile groups once per registry change

From the active registry:

```text
registry.groups
→ compileVisualGroups()
```

Use memoization keyed only to the definition array/registry change.

Do not compile on:

```text
hover
selection
pan
zoom
Inspector open
renderer mode switch
viewport change
```

unless the registry itself changed.

Unexpected compile failure must not crash the graph; show an error and fall back to an empty presentation map.

---

# Part 3 — Canonical entity lookup

Create/reuse one snapshot-scoped map:

```text
EntityId → AddressableEntity
```

Do not reconstruct it for every group edit if the canonical snapshot is unchanged.

The map should update when a new snapshot is adopted.

Do not persist it.

---

# Part 4 — Derive current presentation map after projection

For the current effective projection:

```text
ViewProjection
+ canonical entity lookup
+ compiled groups
→ VisualGroupPresentationMap
```

Use the GROUP1A helper.

Important:

```text
group registry is NOT a dependency of projectView()
```

The dependency direction must be:

```text
projectView(...)
        ↓
projection
        ↓
deriveProjectionVisualGroupPresentationMap(...)
```

never:

```text
groups
→ projectView(...)
```

Evaluate only canonical entities represented in the current projection.

---

# Part 5 — Pass the same map to every renderer

Wire the derived map into the existing GROUP1A seams:

```text
GraphCanvas
GlobalGraphView
LocalGraphView
LocalStructuredGraphView
```

Use the exact current prop names/contracts from latest main.

Do not add renderer-specific group definitions.

All renderers receive resolved presentation only.

---

# Cross-mode invariant

For the same canonical entity:

```text
Structure
Global
Local Free
Local Structured
```

must show the same primary group classification/token whenever that entity is present.

---

# Part 6 — Style-only update invariant

Changing:

```text
name
rule
color
enabled
priority
```

may recompute:

```text
compiled groups
presentation map
renderer styles
```

It must not trigger:

```text
projectView
DISC1 candidate projection
renderer topology remap
Graphology reconciliation
Dagre/W3
Global layout
Local layout
Fit
Center
camera reset
```

This is a hard exit criterion.

---

# Part 7 — Groups product control

Add a compact:

```text
Groups
```

control adjacent to `Filters` in the graph toolbar/tools area.

The control should include a small badge:

```text
count of enabled groups
```

Do not count disabled groups.

Do not count matched entities.

Do not add this count to the Filters badge.

Create a dedicated component, preferably:

```text
apps/web/src/components/VisualGroups.tsx
```

and an isolated stylesheet if consistent with repository conventions.

Keep GROUP1B UI logic out of `GraphExplorer.tsx` as much as practical.

---

# Part 8 — Overlay ownership

Current overlay state has Settings/Tools plus Filters ownership.

Extend this cleanly so Filters and Groups are mutually exclusive.

Preferred model:

```ts
activeToolPanel: 'filters' | 'groups' | null
```

or an equivalent single-owner representation.

Avoid independent booleans that permit impossible states.

Required behavior:

```text
open Filters
→ Groups closes

open Groups
→ Filters closes

open Settings
→ Filters/Groups close according to existing Settings ownership

Inspector
→ remains independent
```

Normal mode: Groups opens as a bounded floating overlay.

Maximized mode: Groups is available inside the existing Tools surface and shares the current contained-scroll model.

Escape closes the nearest active layer before leaving maximize.

---

# Part 9 — Groups panel

Keep it compact.

Suggested hierarchy:

```text
Visual Groups

First matching enabled group supplies the node color.

[+ New group]

1  ● Language                    [Enabled]
   path:"Language"
   [Edit] [↑] [↓]

2  ● Research                    [Enabled]
   path:"Research" OR ...
   [Edit] [↑] [↓]

3  ● Draft                       [Disabled]
   title:"Draft"
   [Edit] [↑] [↓]
```

Do not expose internal IDs or AST.

Priority is list order.

No numeric priority text field.

No drag-and-drop library.

---

# Part 10 — Create group

`New group` opens an inline editor inside the Groups panel.

Fields:

```text
Name
Rule
Color
Enabled
```

Defaults:

```text
Name: empty
Rule: empty
Color: one stable existing palette token
Enabled: true
```

Use a multiline Rule textarea.

Help text should say it uses the same syntax as Advanced query and mention `AND`, `OR`, `NOT`, `path`, `title`, `text`, `kind`, and `level`.

Do not duplicate full QUERY1 docs.

---

# Query validation

Use QUERY1 parser for positioned user feedback.

On Save:

1. trim inputs;
2. parse query;
3. if invalid, show the first positioned error and do not mutate;
4. if valid, use the canonical string;
5. call `addVisualGroup()` with the canonical definition;
6. commit through the centralized session mutation path.

Do not parse per rendered entity.

---

# Name validation

Use GROUP1A limits and registry validation.

Show concise messages for:

```text
empty
too long
duplicate
```

Do not create slightly different web-only validation semantics.

---

# Part 11 — Edit existing group

Flow:

```text
Edit
→ local draft
→ Save / Cancel
```

Draft contains:

```text
name
canonical query
color
enabled
```

No auto-save while typing.

No graph style update while typing.

Save calls `updateVisualGroup()` and session commit.

Cancel changes nothing.

Only one group editor may be active at a time.

---

# Part 12 — Delete

Use compact inline two-step confirmation:

```text
Delete
→ Confirm delete / Cancel
```

No modal needed.

Deleting changes only registry/presentation.

It does not create graph history or alter active filters.

---

# Part 13 — Enable / disable

Expose a native labelled checkbox/switch-like control:

```text
Enabled
```

Toggling is an immediate committed mutation through `setVisualGroupEnabled()`.

On durable write failure, UI must remain at the last confirmed state.

No projection/layout.

---

# Part 14 — Reorder priority

Provide:

```text
Move up
Move down
```

with disabled boundary controls.

Use `moveVisualGroupUp()` / `moveVisualGroupDown()`.

Reordering is immediate after successful mutation.

No drag-only ordering.

No graph-node movement.

---

# Part 15 — Palette selector

Use `VISUAL_GROUP_PALETTE`.

Do not duplicate hex values in UI code.

Each choice must show:

```text
swatch
human-readable text label
```

A select or compact radio/swatches grid is acceptable.

No arbitrary CSS input.

No custom hex input.

---

# Part 16 — Use active query convenience

If there is a currently active QUERY1 advanced query:

```text
state.filters?.query
```

show:

```text
Use active query
```

inside New/Edit.

It copies the canonical active query into the local Rule draft.

It is not a durable reference.

Later active-query changes must not modify the group.

Saved Filters remain separate.

---

# Part 17 — Centralize mutation commits

Create one session mutation helper.

Conceptually:

```ts
commitVisualGroupMutation(candidateRegistry)
```

Durable mode:

```text
candidate
→ write
→ adopt only if write succeeds
```

Session-only mode:

```text
candidate
→ adopt immediately in memory
```

Blocked corruption/write-failure mode:

```text
reject mutation
→ clear message
```

Do not scatter persistence branching through row components.

---

# Part 18 — Status messaging

Groups panel should distinguish:

```text
Saved for this workspace
Session only — workspace identity is not stable
Session only — storage unavailable
Saved Visual Groups could not be loaded
Saving disabled after a storage error
```

Keep healthy status inside the panel.

Routine success should use current visually hidden persistence announcements rather than visible toast spam.

---

# Part 19 — Workspace switching / live updates

Workspace identity change:

```text
load new registry
compile new definitions
derive new map
```

Do not leak prior workspace groups.

Test:

```text
A → B → A
```

Same-workspace Markdown/live update:

```text
keep registry
keep compiled definitions
refresh canonical lookup for new snapshot
rederive map for current projection
```

No durable membership cache or migration.

---

# Part 20 — Renderer-mode switching

Switching:

```text
Structure → Global → Local Free → Local Structured
```

must not recompile groups unless registry changed.

Presentation map may rederive because current projected EntityIds differ.

---

# Part 21 — Inspector integration

Use `matchingVisualGroupsForEntity()` for the currently selected canonical entity only.

Add a compact section such as:

```text
Visual Groups

Primary
● Language

Also matches
● Research
● Draft
```

If no enabled match, prefer omitting the section.

If one match, show only that match.

Do not show group memberships for diagnostic nodes or edges.

Do not expose query AST/internal IDs.

Group names are textual; color is supplementary.

---

# Part 22 — Structure / Global / Local wiring

Structure:

```text
pass presentation map to GraphCanvas
```

Local Structured:

```text
pass the same map through existing React Flow GROUP1A seam
```

Global:

```text
pass same map to GlobalGraphView
```

Local Free:

```text
pass same map to LocalGraphView
```

A group mutation must retain:

```text
camera
viewport
selection
positions
layout caches
transition anchors
```

---

# Part 23 — Filters / Focus / DISC1 / NAV1 isolation

Visual Group operations do not alter:

```text
Structure depth
Heading limit
Blocks
expanded/collapsed IDs
Focus root
Hops
Direction
DISC1 counts
QUERY1 active filter
Saved Filters
```

Do not add group operations to `GraphStateAction`.

Do not add them to NAV1 checkpoints/history policy.

Back/Forward uses current Visual Groups.

`Reset saved view` does not delete Visual Groups.

---

# Part 24 — No default groups

Do not seed any groups.

First-run state:

```text
0 groups
current graph appearance unchanged
```

Suggested empty state:

```text
No Visual Groups yet.
Groups color matching files, sections, and blocks without filtering them.

[New group]
```

---

# Part 25 — Responsive + accessibility

Test:

```text
390
600
768
1000
1440
```

Requirements:

- no horizontal overflow;
- long names contained;
- long canonical queries wrap;
- editor textarea fits;
- actions wrap;
- palette remains usable;
- normal panel overlays graph rather than resizing;
- maximized Tools has one scroll owner;
- Inspector can remain open independently.

Keyboard accessibility:

```text
Groups trigger
New
Name
Rule
palette
Enabled
Save
Cancel
Edit
Delete confirmation
Move up/down
corrupt-registry reset
```

Rule textarea retains native Ctrl/Meta+Z; graph history shortcuts must not steal it.

Focus management:
- closing panel restores Groups trigger;
- New/Edit focuses first field;
- Save/Cancel returns focus to row when practical;
- Delete recovers focus to neighbor/New button.

Rule errors use `aria-invalid` + `aria-describedby`.

Do not announce errors on every keystroke.

---

# Part 26 — UI performance

Draft typing remains component-local.

Typing must not:

```text
compile active registry
derive map
restyle graph
persist
project
layout
```

Only successful Save mutates the registry.

Immediate actions like toggle/reorder/delete may compile+derive; GROUP1A benchmarks show this is cheap.

Do not add debouncing without evidence.

---

# Part 27 — Operation-count regressions

For a committed group mutation while projection is unchanged:

```text
projectView                    +0
React Flow mapping             +0
Dagre/W3 layout                +0
Global Graphology reconcile    +0
Global layout                  +0
Local Free layout              +0
Local Structured W3 layout     +0
style update                   expected
```

Use the existing GROUP1A performance/test seams.

Do not fold the separate QUERY1 ~650 ms projection optimization into GROUP1B.

---

# Part 28 — Browser QA

Create synthetic groups:

```text
Language
path:"Language"
violet

Research
path:"Research" OR title:"Experiment"
green

Draft
title:"Draft"
orange
```

Verify:

- creation;
- canonicalized rule;
- palette;
- priority;
- overlap;
- enable/disable;
- editing;
- deletion;
- active-query copy;
- Inspector memberships.

Overlap test:

```text
one entity matches Language + Draft
Language first → Language color
move Draft above → Draft color
```

No graph movement/layout/camera change.

---

# Part 29 — Cross-renderer QA

For one matching entity:

1. Structure;
2. Global;
3. Local Free;
4. Local Structured.

Verify same primary group identity/color token.

While each mode is visible, mutate group color/priority/enabled state and verify style-only update.

---

# Part 30 — Desktop/live/storage QA

Using a disposable synthetic vault:

1. create durable groups;
2. restart/reopen same stable workspace;
3. verify exact order/colors/enabled state;
4. edit Markdown path/title into a match;
5. verify live restyle;
6. edit out of match;
7. verify style removal/fallthrough;
8. switch workspaces and back;
9. verify isolation/restoration;
10. verify no group file written to vault.

Session-only QA:
- unstable source works in-memory;
- no false persistence success;
- reload loses session-only groups as expected.

Corrupt storage QA:
- graph still loads;
- panel reports issue;
- corrupt value preserved;
- explicit reset works after confirmation;
- only Visual Group key cleared.

Write-failure QA:
- failed candidate not adopted;
- previous styles remain;
- error visible;
- durable writes blocked;
- unrelated storage untouched.

---

# Part 31 — Documentation

Update as appropriate:

```text
packages/visual-groups/README.md
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/PERFORMANCE.md
```

After merge:

```text
GROUP1A backbone complete
GROUP1B product UI complete
GROUP1 complete
```

KG13 remains complete.

KG14 remains the next major KG milestone.

Do not start KG14 automatically.

---

# No new external dependencies

Expected:

```text
0
```

Do not add drag/drop, color-picker, form, state, query, modal, or icon libraries.

---

# Scope

## In scope

- Visual Group session wiring;
- durable/session-only modes;
- corrupt-registry recovery;
- compilation memoization;
- current-projection presentation-map derivation;
- wiring all current renderers;
- Groups trigger/panel;
- empty state;
- New/Edit/Save/Cancel;
- Delete confirmation;
- enable/disable;
- Move Up/Down;
- palette selection;
- Use active query copy;
- enabled badge;
- Inspector memberships;
- persistence announcements/errors;
- responsive/accessibility QA;
- operation-count regressions;
- browser/release desktop QA;
- docs.

## Out of scope

Do not implement:

- group-based filtering action;
- group clustering/layout;
- hulls/background regions;
- group-aware edges;
- arbitrary CSS/custom hex;
- blended membership colors;
- nested groups;
- query autocomplete/highlighting;
- Saved Filter references;
- export/import/share;
- cloud sync;
- vault Markdown persistence;
- per-group layout settings;
- QUERY1 language changes;
- QUERY1 projection optimization;
- KG14.

---

# Likely files

Use latest main.

Likely changes:

```text
apps/web/src/components/VisualGroups.tsx
apps/web/src/components/VisualGroups.test.tsx
apps/web/src/components/VisualGroups.css

apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/graph-workspace-overlays.ts
apps/web/src/components/graph-workspace-overlays.test.ts
apps/web/src/components/ProvenanceInspector.tsx
apps/web/src/components/ProvenanceInspector.test.tsx

apps/web/src/persistence/visual-groups.ts
apps/web/src/persistence/visual-groups.test.ts

apps/web/src/visual-groups/presentation.ts
apps/web/src/visual-groups/presentation.test.ts

apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/PERFORMANCE.md
packages/visual-groups/README.md
```

Renderer packages should require only narrow wrapper/prop wiring because GROUP1A seams already exist.

---

# Suggested implementation sequence

1. Sync latest main.
2. Inspect GROUP1A + KG13-complete UI.
3. Add `clearVisualGroupRegistry()` for explicit recovery.
4. Add Visual Group session model.
5. Add snapshot-scoped entity lookup memo.
6. Add compiled-group memo.
7. Add current-projection presentation-map memo.
8. Wire map through Structure/Global/Local Free/Local Structured.
9. Prove zero projection/layout regression.
10. Refactor overlay ownership for Filters vs Groups.
11. Build `VisualGroups` panel.
12. Add empty state/New editor.
13. Add Edit/Save/Cancel.
14. Add palette from package.
15. Add enabled toggle.
16. Add reorder.
17. Add Delete confirmation.
18. Add Use active query copy.
19. Add session status/error/recovery.
20. Add badge.
21. Add Inspector memberships.
22. Add focus/accessibility behavior.
23. Add responsive CSS.
24. Unit/component tests.
25. Browser QA.
26. Performance/operation QA.
27. Desktop/live/storage QA.
28. Docs.
29. Full validation.
30. Archive prompt.
31. PR → CI → merge → post-merge CI → cleanup.
32. Do not start KG14 automatically.

---

# Validation

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/visual-groups typecheck
pnpm exec vitest run packages/visual-groups

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
pnpm desktop:check
git diff --check
```

Run current GROUP1A, QUERY1, Global, Local, Dagre-worker, and workspace-worker diagnostics where relevant.

Browser widths:

```text
390
600
768
1000
1440
```

Run release/native QA according to latest repository policy.

PR CI and post-merge `main` CI must pass.

---

# Exit gate

GROUP1B is complete only when:

1. Latest main is inspected before implementation.
2. GROUP1A semantics are reused unchanged.
3. No second query parser is added.
4. No external dependency is added.
5. Visual Group session is workspace-scoped.
6. Stable workspace loads durable registry.
7. Unstable workspace supports session-only groups.
8. Unavailable storage supports session-only groups.
9. Corrupt registry does not break graph load.
10. Corrupt registry is not silently overwritten.
11. Explicit reset recovery exists.
12. Recovery clears only current Visual Group key.
13. Write failure does not adopt candidate.
14. Write failure is surfaced.
15. Registry remains outside graph-view persistence.
16. Registry remains separate from Saved Filters.
17. Groups compile once per registry change.
18. Rules do not parse per entity.
19. Canonical lookup is snapshot-scoped.
20. Presentation derives after projection.
21. `projectView()` has no group dependency.
22. Current projection bounds group evaluation.
23. Map reaches Structure.
24. Map reaches Global.
25. Map reaches Local Free.
26. Map reaches Local Structured.
27. Same entity resolves same primary group across modes.
28. Diagnostic nodes remain ungrouped.
29. Edges remain ungrouped.
30. Group changes do not alter topology.
31. Group changes do not request Structure layout.
32. Group changes do not request Global layout.
33. Group changes do not request Local Free layout.
34. Group changes do not request Local Structured W3 layout.
35. Group changes do not change positions.
36. Group changes do not Fit/center.
37. Group changes do not move semantic viewport.
38. Group changes do not alter selection.
39. Groups trigger exists in normal mode.
40. Groups trigger exists in maximized Tools.
41. Enabled badge is correct.
42. Filters badge is unchanged.
43. Filters and Groups are mutually exclusive.
44. Inspector remains independent.
45. Panel overlays canvas in normal mode.
46. Panel does not resize graph.
47. Maximized panel uses contained Tools scroll.
48. Empty state works.
49. New editor works.
50. Only one editor is active.
51. Name field is labelled.
52. Rule field is labelled and multiline.
53. Rule help references QUERY1.
54. Invalid query shows positioned error.
55. Invalid query does not mutate.
56. Duplicate-name error is clear.
57. Name bounds reuse GROUP1A constants.
58. Save canonicalizes query.
59. Cancel leaves registry unchanged.
60. Edit works.
61. Draft typing does not restyle graph.
62. Delete requires inline confirmation.
63. Enable/disable works.
64. Failed durable toggle rolls back/stays confirmed.
65. Move Up/Down work.
66. Boundary controls are disabled.
67. Reorder changes overlap priority.
68. Reorder does not move graph nodes.
69. Palette UI uses `VISUAL_GROUP_PALETTE`.
70. Hex values are not duplicated in web logic.
71. Palette choices have text labels.
72. No arbitrary CSS/custom hex input.
73. Use active query copies only.
74. Later filter changes do not mutate group.
75. Saved Filters are unaffected.
76. Groups do not filter graph.
77. No group-as-filter action exists.
78. Structure depth unaffected.
79. Heading limit unaffected.
80. Blocks unaffected.
81. Disclosure unaffected.
82. Focus/Hops/Direction unaffected.
83. DISC1 counts unchanged.
84. Group edits create no NAV1 checkpoint.
85. Back/Forward keeps current groups applied.
86. Reset saved view does not delete groups.
87. Same-workspace live updates preserve registry.
88. Live canonical changes update matching style.
89. Workspace registries remain isolated.
90. A→B→A restoration works.
91. Inspector shows memberships for entity selection.
92. Inspector marks primary.
93. Inspector all-match order follows priority.
94. Inspector omits groups for diagnostics/edges.
95. Group identity has textual representation.
96. Groups trigger/editor controls are keyboard accessible.
97. Rule textarea retains native undo.
98. NAV1 shortcuts do not steal editor undo.
99. Panel close restores trigger focus.
100. Editor focus is deterministic.
101. Delete focus recovery is deterministic.
102. 390px passes.
103. 600px passes.
104. 768px passes.
105. 1000px passes.
106. 1440px passes.
107. No horizontal overflow.
108. Long names/queries are contained.
109. Maximized Tools keeps one scroll owner.
110. Routine success uses non-disruptive announcements.
111. Error states remain visible/actionable.
112. No groups are seeded.
113. Default graph appearance remains unchanged.
114. Draft typing performs no graph work.
115. Committed mutation performs zero projection.
116. Committed mutation performs zero topology reconciliation.
117. Committed mutation performs zero layout.
118. Known QUERY1 projection cliff stays out of scope.
119. No group clustering/edges are added.
120. No LAYOUT1 revival.
121. No canonical/parser/adapter/resolver changes.
122. Visual Group registry remains schema v1 unless real incompatibility is demonstrated.
123. Graph-view schema is not bumped by GROUP1B.
124. Web/component tests pass.
125. Visual-groups tests pass.
126. React Flow tests pass.
127. Sigma tests pass.
128. Full `pnpm check` passes.
129. Production build passes.
130. Desktop check passes.
131. Browser QA passes.
132. Release/live persistence QA passes.
133. PR CI passes.
134. Post-merge main CI passes.
135. Prompt is archived.
136. Worktree/branch is cleaned after merge.
137. GROUP1 is documented complete after merge.
138. KG14 is not started automatically.

---

# Final report

Report:

## 1. Summary
PR, implementation commit, merge commit, post-merge CI.

## 2. Starting/final main
Starting SHA and any rebase onto newer main.

## 3. Session architecture
Durable/session-only/corrupt/write-failure behavior.

## 4. Compilation / presentation derivation
Registry → compiled groups → current EntityId map, downstream of projection.

## 5. Cross-renderer wiring
Structure, Global, Local Free, Local Structured.

## 6. Groups UI
Trigger, badge, overlay/Tools containment, empty state.

## 7. Create / edit
Fields, QUERY1 validation/canonicalization, Save/Cancel.

## 8. Priority
Move Up/Down and overlap behavior.

## 9. Enable / delete / palette
Mutation semantics and persistence behavior.

## 10. Active query convenience
Copy-only behavior.

## 11. Corrupt-storage recovery
Exact flow and storage scope.

## 12. Inspector
Primary/all matches and textual accessibility.

## 13. Semantic isolation
Filters, Focus, DISC1, NAV1, Reset saved view.

## 14. Viewport / layout
Zero Fit/center/layout movement on group changes.

## 15. Live/workspace switching
Persistence and match recomputation.

## 16. Accessibility
Keyboard, labels, focus, undo, color-independent text.

## 17. Responsive QA
Widths tested and overflow results.

## 18. Performance
Compile timing, presentation-map timing, operation counts, proof projection/topology/layout remain +0.

## 19. Dependencies / schemas
External deps, Visual Group registry schema, graph-view schema.

## 20. Tests / validation
Commands, counts, browser/release QA, CI.

## 21. Files changed
Important session/UI/persistence/Inspector/docs files.

## 22. Deviations / warnings
Any UX/storage/main-branch adaptation.

## 23. Handoff

```text
GROUP1A backbone
+
GROUP1B product UI
=
GROUP1 complete
```

Visual Groups remain a visual classification layer converged across all KG13 renderers.

Do not automatically implement KG14.
