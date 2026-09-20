# HIERDISC1 — Focus Hierarchy Outline + Selective Heading Hide/Restore

**Task type:** new Focus Hierarchy disclosure feature / left-sidebar UI / projection-state extension / persistence + history integration

## Goal / success outcome

PR #106 has merged successfully. Start a **new branch / new PR from current `main`**.

Add a lightweight left-side **Focus Outline** for Focus + Hierarchy so the user can selectively hide individual Headings after broadly expanding a File.

The motivating workflow is:

```text
Focus: Language.md
→ expand / "decollapse" the File
→ 5 top-level Headings appear
→ user only wants 3 of them visible
→ open left Focus Outline
→ hide 2 Headings
→ those Heading cards + their structural descendants disappear
→ the other 3 remain
```

This is **not** the same as the current Collapse action.

Current Collapse means:

```text
Heading stays visible
→ descendants hidden
```

New Hide means:

```text
Heading itself disappears
→ its entire structural subtree disappears
```

The user must be able to restore hidden Headings from the sidebar even though they are no longer on the graph.

Success:

```text
broad disclosure controls decide what CAN appear
explicit per-Heading hide decides what SHOULD stay suppressed
```

---

# Repository state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

PR #106 is merged.

Merged main commit observed at prompt-writing time:

```text
cfb4f715ce2d8df6ba083c21ce1d856f22f40ea2
Merge pull request #106 ...
```

Before editing:

1. read current `AGENTS.md`;
2. fetch current `main`;
3. inspect any work merged after `cfb4f715...`;
4. create an isolated branch/worktree from latest `main`;
5. preserve unrelated user state/worktrees;
6. create a new PR;
7. do not modify the merged #106 branch.

Suggested branch concept:

```text
codex/focus-outline-heading-visibility
```

Exact branch name is flexible.

---

# Current repository evidence

## Current disclosure state

`StructuralDisclosureState` currently owns:

```ts
defaultDepth
maxSectionLevel?
expandedEntityIds
collapsedEntityIds
includeBlocks
```

Current meaning:

```text
expandedEntityIds
→ manually reveal children

collapsedEntityIds
→ hide descendants while keeping the owner entity visible
```

There is currently no state that means:

```text
hide this Heading itself + its complete subtree
```

That is the missing semantic.

---

# Current per-node collapse behavior

Visible File/Heading cards already expose `+ / −` disclosure controls.

Current collapse semantics are correct and must remain:

```text
Heading A
├─ Heading A1
└─ Block A2

Collapse A
→ A remains
→ A1 / A2 disappear
```

Do not replace this with the new Hide feature.

The product needs **both**:

```text
Collapse
→ keep Heading, hide descendants

Hide
→ hide Heading + descendants
```

---

# Existing left sidebar architecture

Current **Network Explorer** is a transient left drawer available only in Network layouts.

Useful existing patterns include:

```text
left-edge open handle
drawer close/focus restoration
wide-screen coexistence with Inspector
<=900 px mutually-exclusive drawer behavior
virtualized/tree keyboard patterns
canonical-source orientation
```

Do NOT force Heading visibility into the Network Explorer itself.

Prefer a separate lightweight component such as:

```text
FocusOutline.tsx
```

or equivalent, using the same left-drawer shell/responsive/focus-management conventions where useful.

---

# Product scope

## In scope

- Focus + Hierarchy left sidebar / outline;
- current Focus File's canonical Heading tree;
- show/hide individual Heading subtrees;
- hidden Headings remain visible in the sidebar for restoration;
- graph history / Ctrl+Z integration;
- Current View persistence;
- Saved View compatibility;
- live-snapshot reconciliation;
- Search/Inspector explicit navigation to hidden Headings;
- Classic and Modular Focus Hierarchy projection parity;
- interaction with existing Heading/Block subfocus;
- tests, docs, native QA artifact.

## Non-scope

Do not implement:

```text
hide individual Files
hide individual Blocks independently
batch multi-selection
arbitrary QUERY1 entity-ID grammar
source-file mutation
renaming/deleting Markdown Headings
drag/reorder of Headings
Network-layout Heading visibility UI
new folder-layout behavior
new Soft/Directional algorithms
```

Hiding a Heading naturally hides descendant Blocks because they belong to that subtree, but Blocks do not receive their own independent Hide control in this task.

---

# Core semantic: `hiddenEntityIds`

Prefer extending structural disclosure with an explicit field conceptually like:

```ts
readonly hiddenEntityIds: readonly EntityId[];
```

Naming is flexible (`suppressedEntityIds` is acceptable if repository terminology strongly favors it), but semantics must be precise:

```text
expanded
→ reveal children

collapsed
→ owner remains visible, descendants hidden

hidden
→ owner AND descendants hidden
```

Do not overload `collapsedEntityIds`.

---

# Hidden precedence

Explicit Hide should have the strongest disclosure precedence for that subtree.

Conceptually:

```text
if entity or any structural ancestor is explicitly hidden:
  entity is not projected
```

Then normal:

```text
default depth
expanded
collapsed
heading limit
blocks opt-in
```

apply to non-hidden branches.

A hidden descendant does not hide its parent or siblings.

---

# Example

Canonical source tree:

```text
File
├─ H1
│  ├─ H1.1
│  └─ H1.2
├─ H2
├─ H3
├─ H4
└─ H5
```

After File expansion all 5 appear.

Hide:

```text
H2
H4
```

Graph becomes:

```text
File
├─ H1
├─ H3
└─ H5
```

with H2/H4 subtrees absent.

Focus Outline still shows:

```text
✓ H1
✕ H2
✓ H3
✕ H4
✓ H5
```

so H2/H4 can be restored.

---

# Hidden state should survive broad disclosure changes

This is important to the founder's workflow.

Current `set-depth` clears manual:

```text
expandedEntityIds
collapsedEntityIds
```

That behavior can remain.

But **do not clear explicit hidden Heading IDs merely because depth changes**.

Example:

```text
Depth 1
Hide H2

Depth 0
Depth 1 again

→ H2 remains hidden
```

until explicitly restored or Reset View is used.

Similarly:

```text
collapse root
re-expand root
→ explicitly hidden top-level Headings remain hidden
```

---

# Focus reroot semantics

Hidden IDs are stable canonical identities.

When rerooting Focus:

```text
File A → File B
```

the outline switches to File B.

Hidden Headings from File A may remain in disclosure state and become relevant again if the user later returns to A.

Do not fuzzy-map Headings across unrelated Files.

Existing stable-identity/live reconciliation owns rename/move survival.

---

# Reset semantics

`Reset current view` should clear explicit hidden Heading IDs together with other view state.

If there is a narrower existing disclosure reset action, inspect its intent before deciding whether it should clear Hide selections.

Do not invent a second hidden-state registry.

---

# Projection implementation

Update source-neutral disclosure calculation.

For each canonical structural entity:

```text
document
section
block
```

a hidden Heading should suppress:

```text
the Heading
all nested Headings beneath it
all Blocks beneath it
```

The containing File remains visible.

Sibling Headings remain unaffected.

A document itself should not be accepted in `hiddenEntityIds` from this UI.

Validation should reject or conservatively ignore unsupported hidden kinds according to existing source-neutral validation conventions.

Prefer allowing only:

```text
section EntityIds
```

for this field if that keeps the contract honest.

---

# Reference behavior

Hiding a Heading is a structural disclosure action, not deletion.

Preserve existing projection provenance/roll-up semantics for references whose precise Heading/Block endpoints are no longer visible.

Do not silently destroy canonical relationships merely because their exact endpoint is hidden.

Inspect current projection behavior for collapsed/undisclosed descendants and reuse the same owner/roll-up semantics where applicable.

If current projection intentionally removes such a reference rather than rolling it up, preserve current established semantics and document it; do not redesign reference projection inside this task.

---

# Reveal/navigation behavior

Explicit navigation to a hidden Heading must work.

Examples:

```text
Search result → hidden Heading
Inspector navigation → hidden Heading
history checkpoint → hidden Heading target
```

Preferred behavior:

```text
explicit navigation removes the target Heading
and any hidden structural ancestors from hiddenEntityIds
as needed to reveal the target
```

Then use the existing reveal/center pipeline.

Do not navigate to an invisible target and leave the user confused.

This should be one normal history-producing navigation transition.

---

# Interaction with Heading/Block subfocus

UX1 Heading/Block subfocus is already merged and accepted enough to preserve.

If the currently active subfocus anchor lies inside a Heading subtree that the user hides:

```text
Hide subtree
→ clear subfocus safely
→ graph remains valid
```

The Hide action should produce one coherent graph-history destination.

Back / Ctrl+Z should restore:

```text
Heading visibility
+
prior subfocus
```

when the referenced entities still exist.

Do not create two history steps for one Hide click.

---

# Graph history

Hide/Restore is a meaningful graph-view mutation.

Add a graph action conceptually like:

```text
set-heading-hidden(entityId, hidden)
```

or equivalent.

`graphHistoryActionPolicy`:

```text
record
```

Required:

```text
Hide H2
→ Ctrl+Z / Back
→ H2 restored

Forward / Ctrl+Shift+Z
→ H2 hidden again
```

`sameGraphViewState(...)` must compare the new disclosure field.

Do not add a separate undo stack.

---

# Persistence

This is real view state, not transient UI chrome.

It should participate in:

```text
Current View persistence
Saved Views
history checkpoints
live reconciliation
```

The Focus Outline drawer open/closed state itself remains transient and should NOT be persisted.

---

# Persisted schema migration

Current persisted workspace view schema observed at prompt-writing time:

```text
schema v3
```

Adding hidden Heading IDs likely requires a schema evolution.

Do not break existing users' Current Views or Saved Views.

Implement conservative migration:

```text
old view without hiddenEntityIds
→ hiddenEntityIds = []
```

Inspect existing view-state migration conventions and use them.

Because Saved Views embed `PersistedWorkspaceView`, explicitly test loading existing Saved View registries containing the previous view schema.

Implementation freedom:

```text
bump view schema only
or
bump/migrate Saved View registry too
```

Choose the smallest correct architecture.

Hard requirement:

```text
old valid persisted Current Views and Saved Views still load
with no hidden Headings
```

Do not silently discard them.

---

# Live snapshot reconciliation

When source updates:

```text
surviving hidden Heading EntityId
→ remains hidden

deleted/missing Heading
→ removed from hiddenEntityIds safely
```

Use stable canonical identity only.

No fuzzy title matching.

---

# Focus Outline sidebar

Add a left sidebar available when:

```text
Scope = Focus
Layout = Hierarchy
```

Classic and Modular should share the same sidebar because it edits shared projection state.

Suggested name:

```text
Focus Outline
```

or simply:

```text
Outline
```

Prefer short visible UI copy.

---

# Drawer shell

Reuse the established left-drawer UX conventions from Network Explorer:

```text
left-edge handle
accessible Close button
focus restoration
wide-screen coexistence with Inspector
narrow-screen mutual exclusion with Inspector
no graph remount
```

Do not mount Network-specific query/movement/size controls.

This should be a lightweight hierarchy/source outline.

---

# Outline data source

The sidebar must NOT derive only from currently projected nodes, because hidden Headings would vanish from the sidebar and could not be restored.

Build it from canonical source truth for the **current Focus File**:

```text
Focus root document
→ canonical child Heading tree
→ source order
```

Use stable EntityIds.

Blocks do not need rows in this task.

---

# Outline structure

Display:

```text
Focus File title/path context (non-hideable)
  H1
    H1.1
    H1.2
  H2
  H3
```

Canonical Heading nesting and source order must be preserved.

No folder tree is needed inside Focus Outline.

---

# Row visibility state

Each Heading row should distinguish at least:

```text
currently projected/visible
explicitly hidden
not currently disclosed for another reason
```

"Not currently disclosed" includes cases such as:

```text
depth not expanded enough
parent collapsed
heading level limit
```

Do not mislabel those as explicitly hidden.

---

# Row control

Use a compact accessible visibility toggle.

Possible visual:

```text
eye / eye-off
checkbox
```

Exact icon is Codex's choice after inspecting existing icon grammar.

Accessible names:

```text
Hide Heading <title>
Show Heading <title>
```

The action is subtree-level; tooltip/help can say:

```text
Hides this Heading and its descendants from the graph.
```

---

# Ancestor-hidden rows

If parent Heading H1 is hidden:

```text
H1.1
H1.2
```

are effectively hidden too.

The outline may still list descendants so hierarchy remains understandable.

Preferred presentation:

```text
descendant rows muted
visibility toggle disabled or marked "Hidden by parent"
```

Do not imply that showing H1.1 can override a hidden H1.

The user must restore the hidden ancestor first.

Explicit child hidden state may remain stored independently if it existed before the parent was hidden.

Example:

```text
H1.1 explicitly hidden
then H1 hidden
then H1 restored

→ H1.1 remains explicitly hidden
```

This is predictable.

---

# Optional row navigation

If easy and consistent with existing navigation:

```text
click visible Heading row
→ select/center it
```

But do not let this broaden the task.

The hard requirement is Hide/Restore.

Do not make row click implicitly unhide unless it is intentionally the existing Navigate action.

---

# Show all action

Add a small action for the current Focus File:

```text
Show all
```

It removes explicit hidden Heading IDs under the current Focus document only.

It should be one history action, not N actions.

Do not clear hidden Headings in other Files.

---

# Interaction with current graph Collapse buttons

Keep the `+ / −` card buttons exactly as the descendant-only disclosure control.

Example:

```text
H1 visible
Collapse H1
→ H1 stays; children disappear

Focus Outline Hide H1
→ H1 + children disappear
```

Restoring H1 from Outline should respect its previous collapsed/expanded state.

Do not erase `collapsedEntityIds` simply because H1 was hidden.

---

# Heading Depth / Heading limit

The outline controls explicit Hide only.

Do not replace:

```text
Depth
Heading level limit
Blocks
```

If a Heading exists canonically but is currently outside the automatic depth/level:

```text
row remains available in Outline
status = not currently disclosed
```

Explicit Hide can still be set preemptively.

When the user later expands enough to reveal it, it stays hidden.

---

# Classic / Modular parity

Because visibility belongs in shared projection state:

```text
Classic Focus Hierarchy
Modular Focus Hierarchy
```

must receive the same visible entity set.

No renderer-specific hide logic.

Switching implementation must not restore hidden Headings.

---

# All Hierarchy boundary

The semantic disclosure field is shared ViewProjectionState, so it may naturally affect All Hierarchy too when the same Heading would otherwise be projected.

That is acceptable.

However, the new **Focus Outline UI** is only required in Focus + Hierarchy.

Do not add a second All-Hierarchy outline in this task.

Document this distinction.

---

# Folder/layout compatibility

Heading hiding changes module contents and therefore can legitimately trigger Focus Hierarchy layout recomputation.

Preserve:

```text
FIX5/FIX6 nested folder semantics
Focus-neutral foldering
Soft algorithm v12 behavior
Heading/Block subfocus
Folder | Parent labels
reroot last-valid safety
```

No folder algorithm redesign.

When a File's visible Heading contents shrink:

```text
module bounds/layout may recompute normally
```

No stale geometry.

---

# Suggested implementation areas

Inspect actual current `main`.

Likely:

```text
packages/view-projection/src/types.ts
packages/view-projection/src/disclosure.ts
packages/view-projection/src/reveal.ts
packages/view-projection/src/*.test.ts

packages/view-state/src/types.ts
packages/view-state/src/persist.ts
packages/view-state/src/restore.ts
packages/view-state/src/validation.ts
packages/view-state/src/index.test.ts

apps/web/src/graph-state.ts
apps/web/src/navigation-history.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/persistence/saved-views.ts
apps/web/src/persistence/*.test.ts

new probable:
apps/web/src/focus-outline-model.ts
apps/web/src/focus-outline-model.test.ts
apps/web/src/components/FocusOutline.tsx
apps/web/src/components/FocusOutline.test.tsx

apps/web/src/App.css
apps/web/src/components/README.md
apps/web/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
history-implementations/
```

Reuse existing drawer/focus-management CSS where cleanly possible.

Do not force these exact filenames.

---

# Required tests

## H1 — motivating five-heading case

Canonical File:

```text
H1 H2 H3 H4 H5
```

Expand root.

Hide H2/H4 from Outline.

Assert:

```text
H1/H3/H5 projected
H2/H4 absent
H2/H4 descendants absent
```

## H2 — restore

Restore H2.

H2 returns according to current depth/disclosure.

## H3 — sibling isolation

Hide H2 does not affect H1/H3.

## H4 — nested hide

Hide H1.2:

```text
H1 remains
H1.1 remains
H1.2 subtree disappears
```

## H5 — Collapse vs Hide

Collapse H1:

```text
H1 visible
children absent
```

Hide H1:

```text
H1 absent
children absent
```

## H6 — preserve collapse state across hide

```text
Collapse H1
Hide H1
Restore H1
→ H1 returns still collapsed
```

## H7 — preserve hidden state across depth changes

```text
Depth 1
Hide H2
Depth 0
Depth 1
→ H2 still hidden
```

## H8 — parent-hidden inheritance

Hide H1:

```text
H1.1 row indicates hidden by ancestor
cannot override effective hidden state
```

Restore H1 preserves explicit child-hidden state if any.

## H9 — Back/Forward

```text
Hide H2
Ctrl+Z → shown
Ctrl+Shift+Z → hidden
```

## H10 — Show all

Clears hidden Headings only under current Focus File in one history action.

## H11 — navigation reveal

Search/Inspector Navigate to hidden H2:

```text
H2 explicitly revealed/unhidden as needed
center/select works
```

## H12 — subfocus interaction

Active subfocus inside H2.

Hide H2:

```text
subfocus clears safely
```

Back restores both when valid.

## H13 — reroot

Hide A/H2.

Reroot File B.

Outline displays B headings.

Return to A:

```text
A/H2 still hidden
```

## H14 — live deletion

Hidden Heading deleted from source:

```text
reconciliation drops stale hidden ID
```

## H15 — persistence migration

Existing schema-v3 Current View:

```text
loads successfully
hiddenEntityIds = []
```

## H16 — Saved View migration

Existing Saved View containing prior persisted-view schema loads successfully.

## H17 — save/restore new state

New Saved View preserves explicit hidden Headings.

## H18 — Classic/Modular parity

Both have identical projected Heading set.

## H19 — Focus root safety

Focus File cannot be hidden.

## H20 — Blocks

No independent Block Hide controls.

Blocks under hidden Heading disappear structurally.

## H21 — drawer responsive behavior

Wide:

```text
Focus Outline + Inspector may coexist
```

Narrow:

```text
opening one closes the other according to existing drawer policy
```

Focus restores correctly on close.

---

# History / checkpoint equality

Update all state equality/canonicalization code.

`hiddenEntityIds` must be:

```text
sorted
unique
stable
```

`sameGraphViewState(...)` must compare it.

Avoid duplicate Back steps.

---

# Projection issues / validation

Add precise validation/issues for stale/invalid hidden IDs according to existing disclosure conventions.

Do not expose alarming user-visible errors for IDs that normal live reconciliation can safely drop.

Preserve deterministic ordering.

---

# Performance

Outline construction should be linear in the current Focus File's structural entities.

No layout/network work merely from opening/closing the sidebar.

Hide/Restore legitimately triggers one normal projection + hierarchy layout update.

No new dependency.

---

# UI / accessibility

Required:

```text
left drawer has semantic label
Close button
keyboard reachable visibility toggles
visible focus states
screen-reader names include Heading title
hidden-by-parent state understandable
```

Do not use color alone.

Keep sidebar compact; this is an outline/control surface, not a second Inspector.

---

# Native QA

Build an optimized desktop candidate.

Suggested filename:

```text
hierdisc1-focus-outline-heading-visibility-native-candidate.exe
```

Founder QA:

```text
1. Open real vault.
2. Focus a File with several top-level Headings.
3. Expand File so e.g. 5 Headings appear.
4. Open left Focus Outline.
5. Hide 2 Headings.
6. Confirm those cards/subtrees disappear and siblings remain.
7. Collapse/re-expand root; hidden choices remain.
8. Restore one Heading from sidebar.
9. Ctrl+Z / Ctrl+Shift+Z.
10. Switch Classic ↔ Modular.
11. Test one nested Heading.
12. Smoke-test Heading subfocus + File reroot from merged FIX6.
```

---

# Validation

Follow current `AGENTS.md`.

Expected equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run packages/view-projection
pnpm exec vitest run packages/view-state
pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/navigation-history.test.ts
pnpm exec vitest run apps/web/src/persistence

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Use current package commands if names moved.

---

# Prompt archive

Archive this exact prompt under:

```text
history-implementations/HIERDISC1_focus_outline_selective_heading_visibility_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. new branch/PR from merged current `main`;
2. PR #106 remains untouched/merged;
3. explicit hidden Heading semantic exists;
4. Collapse and Hide remain distinct;
5. hidden Heading itself disappears;
6. entire hidden subtree disappears;
7. siblings unaffected;
8. hidden Heading remains listed in Outline;
9. restore works;
10. parent-hidden effective state is coherent;
11. child explicit hidden state survives parent hide/restore;
12. hidden selections survive Depth changes;
13. hidden selections survive collapse/re-expand;
14. Show all works for current Focus File only;
15. graph history records Hide/Restore;
16. Ctrl+Z/Forward restore correctly;
17. search/Inspector explicit navigation can reveal hidden target;
18. subfocus clears/restores coherently;
19. File reroot updates Outline without losing old File hidden state;
20. stale hidden IDs reconcile safely;
21. Current View persistence works;
22. previous persisted view schema migrates without data loss;
23. Saved View compatibility/migration works;
24. Classic/Modular projections match;
25. root File cannot be hidden;
26. no independent Block hide introduced;
27. left drawer follows established responsive/focus conventions;
28. drawer open/closed state is not persisted;
29. opening drawer causes no projection/layout work;
30. Hide causes one normal projection/layout update;
31. FIX6 reroot safety preserved;
32. Heading/Block subfocus preserved;
33. Soft/Directional folder semantics unchanged;
34. full tests/builds pass;
35. optimized EXE + SHA-256 produced;
36. prompt archived + SHA-256;
37. CI green;
38. do not auto-merge before founder native QA unless current AGENTS explicitly permits and the visual gate has been waived by the founder.

---

# Final report

Report:

## Branch / PR / commits

## State model

Explain:

```text
expanded
collapsed
hidden
```

and their precedence.

## Focus Outline

Explain canonical-source tree, row states, Show/Hide, Show all, responsive drawer behavior.

## Navigation/history

Report Search/Inspector reveal, Back/Forward, Ctrl+Z, subfocus interaction.

## Persistence

Report schema version/migration strategy and Saved View compatibility.

## Projection/reference behavior

Explain what happens to references whose exact endpoints are inside a hidden Heading.

## Validation

Exact test counts/builds.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder native graphical QA
```

Then stop.
