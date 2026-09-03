# VISUAL1B — Per-Node Network Size Overrides + Network Explorer Action Seam

**Task type:** per-entity presentation preference / Network Explorer action integration / renderer composition / workspace-scoped persistence

## Goal / success outcome

Build the first **per-node presentation override** on top of the newly merged Network Explorer.

The concrete user-facing feature is:

```text
Network Explorer
→ right-click / Node actions on a File
→ Size
→ Auto | custom size
```

A custom size must persist for that File and compose with the global Network appearance rules from VISUAL1A.

Conceptually:

```text
global automatic node size
=
base node size
+
bounded connectivity-size influence

then

displayed node size
=
automatic node size
× optional per-file size override
```

The user can therefore keep the global visual rules while making a specific File more or less prominent.

This slice should also establish a clean **Network Explorer node-action seam** that later actions such as Hide can reuse.

Do **not** implement manual positions/pinning in this task.

Do **not** create a second Hide system that conflicts with QUERY1 exact-path exclusions.

---

# Current repository baseline

Repository:

`lillo24/icarus-graph-explorer`

At plan-writing time the relevant merged baseline includes:

```text
PR #49 — VISUAL1A
→ global link-driven Network node sizing
→ Advanced visual controls

PR #50 — KG14B2 Network Explorer
→ projection-scoped accessible virtualized sidebar
→ synchronized selection/centering
→ All + Network and Focus + Network
```

PR #50 merged as:

```text
d7107e5d312a5997b4e152b9d2de351afac9bfe8
```

Before implementation, inspect current `main`; newer merged work takes precedence over this prompt.

---

# Important existing architecture

## VISUAL1A

All + Network already has global visual controls including:

```text
Base node size
Link influence on node size
Link thickness
Label threshold
```

Ordinary document sizing is already:

```text
base size
+
bounded compressed/logarithmic reference-degree boost
```

Do not replace that system.

Per-node size is an **override layered after the automatic size**, not a second global sizing formula.

## Network Explorer

PR #50 added a virtualized accessible DOM tree for Network views.

It is projection-scoped and contains:

```text
File
Heading
Block
Diagnostic
```

plus currently projected adjacency.

Selection is synchronized:

```text
sidebar row
↔ graph selection
↔ center request
```

Do not make the sidebar read Sigma/Graphology state directly.

## QUERY1 Hide groundwork

KG14B1 already added exact-path QUERY1 exclusions specifically for the future:

```text
Hide File
```

workflow.

The existing intended hide semantics are:

```text
current applied query
AND NOT path="Exact/File.md"
```

Do not add a separate persisted:

```text
hidden: true
```

per-node presentation registry in VISUAL1B.

That would create two incompatible meanings of “Hide.”

Visibility remains owned by QUERY1/KG14B work.

VISUAL1B owns **Size override** and a reusable node-action seam.

---

# Parallel KG14 work — hard merge rule

PR #50 explicitly deferred:

```text
Hide / context-menu integration
```

to later KG14B work.

Therefore before editing:

1. inspect current `main`;
2. inspect open/recent PRs for KG14B3 or later Network Explorer action work;
3. if a later KG PR has already added a row action/context menu:
   - reuse it;
   - do not create another menu;
4. if such a PR is open but not merged:
   - do not touch/delete its branch/worktree;
   - implement the size-override domain/renderer pieces in isolation;
   - rebase/update onto the merged action UI before final integration if practical;
5. if no action UI exists yet:
   - add the smallest generic **Node actions** surface that future Hide/Inspect actions can extend;
   - do not implement a parallel one-off Size-only interaction that future KG work must replace.

Before final merge, update onto the then-current `main` and resolve semantic overlap intentionally.

---

# Product scope

VISUAL1B applies to:

```text
Layout = Network
```

and initially to canonical:

```text
File / Document entities
```

in both:

```text
All + Network
Focus + Network
```

Do not add per-heading or per-block custom sizing in this slice.

Reason:

- the user specifically wants per-file customization;
- Files are stable across All and Focus;
- Local headings/blocks use different semantic sizing and can be evaluated later;
- this keeps the first override contract narrow.

Diagnostic nodes have no canonical EntityId and must not receive persistent overrides.

---

# 1. Add a source-neutral per-node presentation override contract

Create a small source-neutral contract for per-entity presentation preferences.

A likely package/name is:

```text
packages/presentation-overrides
```

or another repository-consistent boundary after inspection.

Conceptually:

```ts
interface EntityPresentationOverride {
  readonly entityId: EntityId
  readonly sizeScale?: number
}

interface PresentationOverrideRegistry {
  readonly schemaVersion: 1
  readonly workspaceId: WorkspaceId
  readonly entities: readonly EntityPresentationOverride[]
}
```

Exact storage shape can differ.

Hard rules:

```text
canonical data
≠ presentation override

KG9 view state
≠ presentation override

global graph preferences
≠ workspace-specific entity override
```

Per-node size must not enter:

- canonical snapshot;
- Markdown;
- KG6 projection truth;
- stable-identity catalog;
- graph-preferences global settings;
- Saved Filters;
- Visual Groups.

---

# 2. Workspace-scoped persistence

A File-specific size is meaningful only inside its workspace.

Persist overrides by stable:

```text
WorkspaceId + EntityId
```

not by:

- source path;
- title;
- ProjectionNodeId;
- renderer node key;
- index.

Use stable canonical entity identity.

Preferred behavior:

## Stable workspace

```text
size override
→ durable local persistence
→ survives reload/restart
→ survives supported normal file rename/move when EntityId survives
```

## Transient source/report

```text
size override
→ session-only
→ no false durability claim
```

Reuse the established workspace-session/persistence patterns from Visual Groups, Saved Filters, or view state where structurally appropriate.

Do not force this into the global `icarus.graph-explorer.preferences.v1` record because those preferences are not workspace/entity-specific.

---

# 3. Registry validation

Runtime-validate the registry.

At minimum:

- exact schema version;
- matching workspace ID;
- unique EntityId entries;
- finite sizeScale;
- bounded sizeScale;
- no unknown fields if repository conventions use strict validation;
- deterministic serialization/order;
- JSON round-trip.

Recommended product scale:

```text
0.5× → 2.5×
```

or another measured safe range.

Choose the final bounds after renderer QA.

Requirements:

- small enough not to disappear;
- large enough to make deliberate prominence useful;
- capped so one File cannot dominate the entire Network.

Do not support arbitrary unbounded pixel sizes.

---

# 4. Size semantics — multiplier over Auto

Store a **multiplier**, not an absolute renderer size.

Conceptually:

```text
Auto
→ no override

Custom
→ autoSize × sizeScale
```

Why:

- global Base node size still works;
- global Link influence still works;
- future automatic visual tuning remains composable;
- the same File override can sensibly work in All + Network and Focus + Network.

Do not store the final Sigma size.

Do not copy the current reference degree into the registry.

---

# 5. Composition order

For All + Network:

```text
global base size
+ compressed reference-degree boost controlled by VISUAL1A
        ↓
automatic document size
        ↓
per-file sizeScale
        ↓
final bounded renderer size
```

For Focus + Network:

```text
existing Local semantic/kind/root size
        ↓
per-file sizeScale for File nodes only
        ↓
final bounded renderer size
```

Do not remove Focus-root emphasis.

If a Focus root has special size behavior, the custom scale should compose with it while preserving an evidence-backed minimum prominence.

Headings and Blocks remain unchanged.

---

# 6. Renderer-independent lookup

Renderer mapping should receive a source-neutral lookup such as:

```ts
ReadonlyMap<EntityId, EntityPresentationOverride>
```

or an equivalent immutable accessor.

Do not make Sigma read localStorage.

Do not make the registry depend on Sigma.

Do not make `ViewProjection` own presentation overrides.

Application orchestration resolves the current workspace registry and supplies the effective override map to Network renderer mapping.

---

# 7. Global Sigma integration

Extend `mapProjectionToGlobal(...)` or the smallest current mapping boundary to accept per-entity size overrides.

Required behavior:

```text
document entity
→ calculate automatic size
→ apply optional stable EntityId multiplier
→ clamp final display/layout size

diagnostic node
→ existing behavior unchanged
```

The final size participates in the normal Global layout input if node size currently affects layout geometry.

Do not manipulate Graphology nodes later through ad hoc DOM/Sigma calls if the mapping contract is the source of truth.

---

# 8. Focus Network integration

Inspect current Local Free mapping first.

Apply size overrides only to:

```text
entityKind = document
```

including the Focus root document.

Do not apply the File override to:

- Section;
- Block;
- diagnostic target.

Preserve existing File/Heading/Block differentiation.

If Local Free mapping currently has separate root sizing, compose predictably and test it.

---

# 9. Network Explorer needs canonical EntityId

The current `NetworkExplorerNode` is keyed by ProjectionNodeId and exposes presentation labels/kind/adjacency.

Add the minimum metadata needed for actions:

```ts
entityId?: EntityId
```

for canonical entity nodes.

Diagnostic rows have no entityId.

Do not make React code reverse-resolve IDs from labels/paths.

Do not change row identity away from ProjectionNodeId; the EntityId is for persistent actions only.

---

# 10. Node actions interaction

Use one shared action surface for pointer and keyboard users.

Required access paths:

```text
right-click File row
→ Node actions menu

keyboard / visible actions button
→ same Node actions menu
```

Right-click alone is not sufficient.

Preferred row affordance:

```text
⋯
```

or another compact action button that becomes visible on hover/focus/selection without making every row noisy.

Accessible label:

```text
Actions for <File name>
```

The context-menu event and action button should open the same menu/state/model.

Do not create two separate implementations.

---

# 11. Size action UX

For a File row, expose:

```text
Size
  Auto
  Custom…
```

or a compact inline equivalent.

Preferred custom UI:

```text
Size
0.5× ───────●──────── 2.5×
             1.35×

Reset to Auto
```

Exact ranges depend on measured safe bounds.

Requirements:

- immediate visual preview/update;
- accessible range label/value;
- Escape/cancel closes safely;
- Reset removes the registry entry/sizeScale rather than storing `1`;
- existing custom size is visible when reopening;
- custom state has a subtle row indicator, e.g. `Size 1.4×`, when useful.

Do not expose raw Sigma pixels.

---

# 12. No separate Hide implementation

If KG14B3 Hide UI is already merged by integration time:

```text
Node actions
├─ Size…
└─ Hide
```

should share the same menu naturally.

VISUAL1B must not alter Hide semantics.

If Hide is not yet merged:

- leave a clean action-registration/composition seam;
- do not implement a separate hidden registry;
- do not duplicate QUERY1 exact-path exclusion logic.

The final report must state which situation applied.

---

# 13. Hidden-node recovery compatibility

If KG14B3 has merged by the time this task integrates, verify that:

- hiding a File does not delete its size override;
- unhiding the File restores its prior size override;
- exact-path query changes do not mutate presentation override storage.

Preferred composition:

```text
query determines visibility
presentation registry determines size when visible
```

Do not couple the two.

---

# 14. Stale entities / live updates

When a stable File is renamed/moved and keeps EntityId:

```text
size override survives
```

When an EntityId disappears permanently:

- it no longer affects any renderer;
- do not fuzzy-remap by path/title;
- stale override data may be pruned during deterministic registry reconciliation if repository persistence patterns support that safely.

If an entity later appears with a new EntityId, it starts at Auto.

No identity resurrection guesses.

---

# 15. Reset semantics

Provide per-file:

```text
Reset size to Auto
```

Do not add a global “Reset all presentation overrides” control unless it is trivial and clearly useful.

If a global reset is added, it must be explicit and scoped to the current workspace.

`Reset saved view` must **not** erase per-file size overrides.

They are presentation preferences, not semantic view-state.

Graph global preference reset also should not accidentally clear workspace-specific overrides unless there is an explicit product-level “reset all custom presentation” action.

Document this separation.

---

# 16. Visual Groups interaction

Visual Groups control:

```text
color / accent / marker presentation
```

VISUAL1B controls:

```text
per-file size multiplier
```

They compose.

A File in a Visual Group with a custom size should retain both.

Do not use Visual Group priority to decide size override.

Do not add size to GROUP1 in this slice.

---

# 17. QUERY1 interaction

QUERY1 controls projection membership.

Size overrides do not change:

- query matching;
- query text;
- Saved Filters;
- exact-path exclusions;
- Focus membership.

A query that hides/excludes a File simply means its size override is inactive until the File is visible again.

Do not force a projection update merely because registry storage changes, beyond the normal renderer input remap necessary to display the new size.

---

# 18. Network Explorer virtualization

Do not break KG14B2 virtualization.

The action menu must work when rows are virtualized and unmount/remount during scroll.

Rules:

- menu state is keyed by stable action target, not DOM node lifetime;
- if the target leaves the current projection while menu is open, close safely;
- if the row scrolls outside the virtual window, do not retain a broken focus trap;
- menu positioning may anchor to the pointer or action button, but must recover if that element unmounts;
- DOM row count remains bounded.

Do not disable virtualization to simplify actions.

---

# 19. Selection synchronization

Opening the node menu should not unexpectedly change graph selection unless the current interaction convention requires it.

Preferred:

```text
right-click File row
→ select that File if not already selected
→ open menu
```

or:

```text
open menu without selection mutation
```

Choose one consistent policy after inspecting existing desktop/UI conventions.

Whichever is chosen:

- document it;
- keep keyboard and pointer paths consistent;
- avoid duplicate center requests;
- do not cause scroll snap in the Network Explorer.

KG14B2 specifically fixed external-selection reveal to be edge-triggered; preserve that behavior.

---

# 20. Performance

Per-node overrides should be sparse.

Do not create an O(all canonical entities) expensive recomputation on every slider tick if avoidable.

A simple immutable map lookup per projected entity is acceptable.

Changing size can legitimately trigger renderer remap/layout because node dimensions influence Network layout.

Required:

```text
slider UI remains responsive
stale layout requests are superseded
no serial backlog
```

Reuse current latest-result-wins layout workers.

Do not add a general new cache.

---

# 21. Persistence implementation guidance

Prefer a workspace-scoped session abstraction mirroring existing product systems.

A reasonable ownership split:

```text
source-neutral registry validation / reconciliation
→ package

browser/Tauri local persistence adapter/session
→ app layer
```

If existing Visual Groups session infrastructure can be generalized narrowly without coupling the domains, reuse the pattern rather than copy-pasting a second large session architecture.

Do not make presentation overrides depend on QUERY1, Visual Groups, or renderers.

---

# 22. Privacy / security

Overrides may contain only:

```text
workspace ID
opaque EntityId
size multiplier
```

Do not persist:

- absolute vault path;
- note title;
- note text;
- source snippets;
- graph coordinates.

No network access.

No Markdown writes.

---

# Non-scope

Do not implement:

```text
manual node drag
pin/unpin
Move mode
individual x/y positions
folder-cluster offsets
per-heading custom size
per-block custom size
per-edge custom overrides
Saved Views
adaptive layout
custom colors outside Visual Groups
custom label text
canonical metadata edits
```

Do not implement a second visibility system.

---

# Future architecture seam

Keep this future family explicit:

```text
Presentation Overrides
├─ Size            ← VISUAL1B
├─ Visibility      ← QUERY1/KG14B Hide semantics
└─ Position        ← future SPATIAL1
   ├─ individual pin
   └─ folder-cluster offset
```

The important principle:

```text
visibility
≠ size
≠ position
```

They may later be presented together in the UI, but their underlying semantics/storage do not need to be the same.

---

# Tests

## Registry

Cover:

- empty registry;
- one File override;
- multiple overrides;
- duplicate EntityId rejection;
- invalid scale;
- lower/upper bounds;
- deterministic ordering;
- JSON round-trip;
- workspace mismatch;
- stale EntityId reconciliation;
- session-only transient workspace behavior;
- stable workspace persistence.

## Renderer mapping

All + Network:

- Auto preserves VISUAL1A automatic size;
- 1× equals automatic size;
- <1× makes File smaller;
- >1× makes File larger;
- final size remains bounded;
- degree influence still composes;
- diagnostic unaffected.

Focus + Network:

- File override applies;
- Focus-root emphasis remains;
- Heading unaffected;
- Block unaffected;
- diagnostic unaffected.

## Network Explorer

- File row exposes actions;
- Heading/Block/Diagnostic do not expose unsupported size action;
- right-click and keyboard/action-button paths reach same menu;
- current override is represented;
- reset removes override;
- virtualized target removal closes menu safely;
- accessibility labels/roles are correct;
- selection/reveal does not regress.

## Persistence

- reload restores File size;
- stable rename/move preserves override by EntityId;
- lost identity does not fuzzy-remap;
- Reset saved view leaves size override intact;
- graph global settings continue loading;
- corrupt registry fails safely and visibly/session-only according to chosen session pattern.

## Compatibility

- QUERY1 unchanged;
- Saved Filters unchanged;
- Visual Groups unchanged;
- Hide exact-path operations unchanged;
- history unchanged;
- view-state schema remains v3.

---

# QA

Browser QA:

```text
Synthetic Sample
→ All + Network
→ open Network Explorer
→ File actions
→ Size custom
→ make File smaller/larger
→ reset Auto
→ close/reopen sidebar
→ switch Focus + Network
→ verify same File override
→ switch Hierarchy
→ confirm Hierarchy unaffected
→ return Network
→ reload
```

Also test:

- Visual Group + size override;
- query/filter hide/show if Hide UI exists;
- virtualized scrolling;
- keyboard-only action access;
- right-click;
- Settings VISUAL1A global node-size/link-influence controls together with per-file override;
- no console errors/warnings.

Release Tauri QA should follow the repository's normal gate if required.

---

# Parallel-work discipline

Before branching and again before final merge:

1. inspect current `main`;
2. inspect open KG14B PRs that touch:
   - `NetworkExplorer.tsx`;
   - `GraphExplorer.tsx`;
   - QUERY1 Hide/context menu;
3. do not modify/delete another worktree;
4. keep domain/renderer implementation isolated where possible;
5. integrate the final node-action UI only against the newest action-menu contract;
6. re-run focused + full validation after rebasing.

If concurrent KG14B3 creates an incompatible context-menu contract, stop and reconcile semantically rather than shipping two menus.

---

# Suggested implementation sequence

1. Sync latest main after PR #50.
2. Inspect KG14B3/open Network Explorer action work.
3. Define source-neutral workspace-scoped size override registry.
4. Add validation/serialization/session tests.
5. Add stable workspace persistence + transient session behavior.
6. Add EntityId to Network Explorer entity rows.
7. Extend All Network mapping with File override multiplier.
8. Extend Focus Network File mapping.
9. Verify Visual Groups/QUERY1 composition.
10. Reuse or add generic Network Explorer node-action surface.
11. Add Size UI + Reset Auto.
12. Add virtualization/focus safety.
13. Add stale/live-update reconciliation.
14. Run focused tests.
15. Run `pnpm check`, desktop checks/build, relevant Network benchmarks.
16. Browser QA.
17. Release Tauri QA if required.
18. Archive prompt under `history-implementations/`.
19. PR → CI → merge → post-merge CI → cleanup.
20. Stop; do not start SPATIAL1 automatically.

---

# Validation commands

Use current repo equivalents from `AGENTS.md`.

Expected core validation:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-sigma typecheck
pnpm exec vitest run packages/renderer-sigma

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small

git diff --check
```

Add focused validation for the new registry package/session according to its final name.

No timing thresholds in CI.

---

# Exit gate

VISUAL1B is complete only when:

1. per-file custom Network size exists;
2. override is keyed by stable EntityId;
3. override is workspace-scoped;
4. stable workspace overrides persist;
5. transient workspace overrides remain session-only;
6. no source path/title is used as identity;
7. Auto means no stored size override;
8. custom size composes with VISUAL1A automatic sizing;
9. All + Network uses the override;
10. Focus + Network Files use the override;
11. Focus-root emphasis remains intact;
12. Headings are unaffected;
13. Blocks are unaffected;
14. diagnostics are unaffected;
15. final renderer size is bounded;
16. Visual Group styling still composes;
17. QUERY1 semantics are unchanged;
18. Hide uses no new parallel visibility registry;
19. if KG14B Hide UI exists, hide/unhide preserves the size override;
20. Network Explorer exposes File actions;
21. right-click and accessible keyboard/button actions share one implementation;
22. unsupported node kinds do not expose Size;
23. virtualized rows remain bounded;
24. scrolling/unmounting an action target is safe;
25. custom size can be reset to Auto;
26. current override is visible in the action UI;
27. reload restores stable overrides;
28. stable rename/move preserves override if EntityId survives;
29. lost identity is not fuzzy-remapped;
30. Reset saved view does not erase size overrides;
31. graph global preferences remain separate;
32. view-state remains schema v3;
33. no canonical/KG6 schema changes are introduced;
34. no manual positions/pins are implemented;
35. no new external dependency is added unless explicitly justified;
36. browser QA passes;
37. release desktop QA passes if required;
38. full tests/builds pass;
39. PR CI passes;
40. post-merge CI passes;
41. task branch/worktree cleanup completes.

---

# Final report

Report:

## 1. Summary

What per-file sizing now does.

## 2. Override architecture

Workspace/EntityId registry and separation from graph preferences/view state.

## 3. Size composition

Show:

```text
global automatic size
× per-file scale
= final Network size
```

and Focus-specific behavior.

## 4. Network Explorer actions

Right-click + accessible action path and KG14B3 integration status.

## 5. Visibility separation

Confirm Hide remains QUERY1-owned and no second hidden registry was introduced.

## 6. Persistence

Stable versus transient workspace behavior and rename/move continuity.

## 7. Compatibility

QUERY1, Saved Filters, Visual Groups, history, view-state.

## 8. Performance

Mapping/layout behavior and slider responsiveness.

## 9. Tests / browser / Tauri QA

## 10. Files changed

## 11. Dependencies

Expected additions: zero.

## 12. Remaining future work

Keep parked:

```text
SPATIAL1
- Move mode
- individual pinning
- folder-cluster offsets

Later
- Saved Views
- Adaptive Layout
```

Do not implement those automatically.
