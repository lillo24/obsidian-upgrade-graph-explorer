# HIERDISC1-FIX1 — Unified Focus Explorer Tabs + Reliable Hide Relayout + Disclosure-Control Artifact Fix

**Task type:** corrective continuation of PR #127 / Focus Hierarchy sidebar redesign / layout-adoption bug investigation / UI polish

## Goal / success outcome

Continue the still-open HIERDISC1 PR #127 after founder native QA.

The underlying selective Heading Hide/Restore feature is useful and should be preserved, but QA exposed three follow-up requirements:

1. **Hide/Restore does not always appear to produce the expected layout update.**
   - Diagnose whether the problem is:
     - the click/action not firing;
     - projection changing but layout not recomputing;
     - worker/cache/adoption using stale geometry;
     - the graph updating correctly but preserving positions so strongly that it appears stale;
     - or another concrete cause.
   - After every successful Hide/Restore, the graph must immediately reflect the new projected node set and, when topology/module dimensions changed, adopt the corresponding current layout. No stale geometry.

2. **Turn the left Focus Outline into a two-view Focus Explorer.**
   - Add a top segmented/toggle control:
     ```text
     Files | Headings
     ```
   - **Files** brings the useful file-navigation view currently available in Network into Focus + Hierarchy.
   - **Headings** is the existing canonical Heading visibility outline.
   - This should feel like one coherent left-side explorer, not two independent drawers.

3. **Fix the strange translucent square/control artifact that appears on graph cards after a Heading visibility action.**
   - Founder description: after clicking a Heading visibility control, the place where the disclosure number appears on many graph cards becomes covered by a semi-transparent square/container.
   - Diagnose the exact DOM/CSS/state cause before changing it.
   - A strong repo hypothesis is the graph entering `layoutPending`, causing all entity disclosure controls to become disabled through `EntityDisclosureProvider`, while `.entity-disclosure:disabled` changes their presentation. Verify rather than assume.
   - Pending layout must remain safe, but it should not create a distracting fake-looking square over every count/control.

Do not merge until founder graphical QA.

---

# Repository / PR state

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Continue the same PR:

```text
PR #127
branch: codex/focus-outline-heading-visibility
head at prompt-writing time:
a6ed7518a760ad51f87dc37e649d213b3aa7ab8c
base:
cfb4f715ce2d8df6ba083c21ce1d856f22f40ea2
```

PR #127 is open, unmerged, and currently mergeable.

Before editing:

1. read current `AGENTS.md`;
2. fetch current refs;
3. verify PR #127 head/state;
4. inspect whether `main` advanced;
5. integrate latest `main` according to repository workflow if needed;
6. preserve unrelated work/worktrees;
7. update the same PR #127;
8. record exact starting SHAs.

Do not create a competing PR unless continuation is technically impossible.

---

# Preserve HIERDISC1 semantics

Do not regress the already-implemented behavior:

```text
hiddenEntityIds is section-only
Hide Heading → Heading + whole subtree disappears
Collapse Heading → Heading stays, descendants disappear
hidden state survives depth/collapse/reroot/history
Current View persistence
Saved View persistence/migration
Search/Inspector reveal hidden target
subfocus clear + Back restoration
Classic ↔ Modular semantic parity
exact references use established roll-up semantics
schema-v4 migration behavior
```

Do not redesign the disclosure model unless a real bug is found.

---

# PART A — Diagnose "Hide sometimes doesn't update layout"

## First: distinguish semantic update from layout update

Instrument/test this sequence:

```text
Focus Hierarchy
→ visible Heading H
→ Hide H from sidebar
```

Observe separately:

```text
1. graph action fired?
2. hiddenEntityIds changed?
3. projection node set changed?
4. mapped/model node set changed?
5. layout input/cache key/fingerprint changed?
6. worker/layout request issued?
7. new geometry adopted?
8. pending state cleared?
```

Do this for:

```text
Classic Focus Hierarchy
Modular Focus Hierarchy
```

Do not add a forced relayout blindly before proving which layer is stale.

---

# Required layout invariant

For a successful Hide/Restore:

```text
new projection
→ matching renderer/model input
→ matching layout identity
→ latest valid geometry
```

No renderer may display:

```text
new semantic node set
+
old geometry that belongs to a different topology/dimension fingerprint
```

except the explicitly designed last-valid transition window while a replacement is pending.

Once the new result is ready, it must adopt.

---

# Classic-specific audit

Classic currently derives a `localStructuredLayoutFingerprint(...)` from mapped nodes/edges and may reuse its bounded coordinate cache.

Verify:

```text
Hide changes fingerprint whenever the rendered topology/dimensions change
```

and:

```text
cached positions are never accepted for a nonmatching topology/dimension fingerprint
```

Test both Hide and Restore.

If the resulting graph legitimately has identical positions, that is acceptable; the visible node set must still update immediately.

---

# Modular-specific audit

Modular cache identity serializes `FocusSchematicLayoutInput`.

Verify Hide/Restore affects the relevant:

```text
projection
model
nodeDimensions
layoutInput
layoutKey
```

and that:

```text
new key → worker/cache/adoption lifecycle completes
```

No stale last-valid graph should remain indefinitely after a successful result.

Add a regression around a Heading whose removal materially changes the root File module height/width so the geometry difference is unmistakable.

---

# Click-path audit

Founder phrasing was "when I click a header it doesn't always update the layout."

Current Focus Outline only makes the small visibility button actionable; the title/copy itself is not a visibility action.

Make the interaction visually and behaviorally unambiguous.

Preferred:

```text
visibility button
→ Hide/Show only

row/title
→ selection/navigation only if intentionally implemented
```

Do NOT create an ambiguous situation where clicking some parts of the row hides and other visually similar parts silently do nothing without affordance.

If the founder's observed issue turns out to be missed clicks on a small target, enlarge the visibility target/hit area rather than making the entire row accidentally destructive.

Keep the accessible name:

```text
Hide Heading <title>
Show Heading <title>
```

---

# Layout-adoption tests

Add at least:

## L1 — Classic Hide

```text
projection loses Heading
fingerprint changes when geometry-relevant
new layout commits
pending ends
```

## L2 — Classic Restore

Inverse.

## L3 — Modular Hide

```text
layoutKey/input changes
replacement adopts
displayed graph matches new projection
```

## L4 — Modular Restore

Inverse.

## L5 — rapid Hide/Restore/Hide

Latest-wins:

```text
no stale middle result adopted
final graph matches final hidden state
```

## L6 — cache revisit

```text
Hide
Restore
Hide again
```

A validated exact cache hit is allowed, but the visible graph must correspond exactly to the current hidden state.

## L7 — layout failure

Preserve merged FIX6 behavior:

```text
last-valid graph + explicit warning
no blank
```

---

# PART B — Redesign left drawer as Focus Explorer

The existing `FocusOutline` should become one unified Focus + Hierarchy left explorer with two top views:

```text
┌──────────────────────────────┐
│ Focus Explorer          [×]  │
│ [ Files ] [ Headings ]       │
│                              │
│ active tab content           │
└──────────────────────────────┘
```

Naming can be:

```text
Focus Explorer
```

or another concise equivalent.

Avoid two separate left-edge handles/drawers.

---

# Tab semantics

Use a segmented control / accessible tablist:

```text
Files
Headings
```

Requirements:

```text
single selected tab
keyboard operable
clear selected state
does not mutate graph semantics merely by switching tab
no layout/projection work from tab switch
```

The selected tab is **session UI state**, not graph history.

Do not persist it unless existing drawer UI policy clearly does so. Preferred: remember during the current mounted session/reopen only.

---

# PART C — Files tab: bring File navigation from Network into Hierarchy

The founder explicitly wants the File view that currently exists in Network to become available here.

Do NOT mount the whole Network Explorer with Network-only tools.

Reuse/refactor the useful source/file-navigation layer.

---

# Files tab content

Show the **Files in the current Focus projection**, grouped by their source folders, in deterministic source/folder order.

Include:

```text
Focus File
connected/visible neighbor Files
context Files currently part of the Focus projection
```

Do not list:

```text
Heading rows
Block rows
diagnostic target rows
```

in Files tab.

This is intentionally a File-centric view.

---

# Reuse Network Explorer logic where appropriate

Current Network Explorer already has:

```text
canonical source-folder grouping
folder expansion state
accessible tree rows
virtualization conventions
selection/center patterns
Focus badge
```

Extract/share pure file-folder model helpers rather than duplicating folder parsing.

But do not couple Focus Explorer to:

```text
Sigma
Graphology
Network physics
Move File
Arrange Folders
Network size controls
Network query editor
hidden QUERY1 chips
```

Files tab must work in Hierarchy with no Network renderer mounted.

---

# Files tab interaction

Preferred behavior:

### Single click / keyboard Enter

```text
select + center the File in current Focus Hierarchy
```

No reroot.

### Explicit Focus action or double-click

```text
reroot Focus to that File
```

Reuse existing safe File-reroot pipeline from merged FIX6.

Do not invent a new navigation path.

If double-click inside a sidebar tree is ergonomically awkward, an explicit small `Focus` action is acceptable, but keep semantics discoverable.

---

# File row presentation

Keep compact:

```text
File title
source folder/path context
Focus badge on current root
```

Do not bring Network-specific degree/status clutter unless genuinely useful.

Folder rows can collapse/expand as in Network Explorer.

Folder tree state is transient UI state.

---

# File view source-of-truth

Use the current Focus projection/model, not the entire vault.

The Files tab should answer:

```text
"What Files are in this Focus graph?"
```

not:

```text
"Show every File in my vault."
```

Search already handles whole-workspace navigation.

---

# PART D — Headings tab

Retain the current canonical-source Heading outline behavior:

```text
visible
hidden
hidden-by-parent
not-disclosed
```

and:

```text
Hide/Show
Show all
canonical nesting
source order
```

Rename UI copy from standalone "Focus Outline" as needed so it fits the unified explorer.

---

# Headings tab header context

Do not repeat a large second drawer heading.

Recommended:

```text
top-level drawer:
Focus Explorer

tab-specific compact context:
Language.md
3 hidden
Show all
```

Preserve path/title tooltip where useful.

---

# PART E — Drawer availability

Focus Explorer is available when:

```text
Scope = Focus
Layout = Hierarchy
```

Classic and Modular share it.

Network layout continues using Network Explorer.

This creates a coherent product pattern:

```text
Focus + Network
→ Network Explorer

Focus + Hierarchy
→ Focus Explorer
   ├─ Files
   └─ Headings
```

Do not expose both left drawers simultaneously for the same layout.

---

# Responsive / Inspector behavior

Preserve established drawer behavior:

Wide screen:

```text
Focus Explorer + Inspector may coexist
```

Narrow screen:

```text
opening Focus Explorer closes Inspector
opening Inspector closes Focus Explorer
```

Close restores focus predictably.

---

# PART F — Fix the translucent disclosure-control square artifact

## Diagnose exact cause

Founder sees, immediately after a Heading visibility action:

```text
the area around the disclosure count/number on many graph cards
looks like a semi-transparent square/container
```

Do not merely hide it with random CSS.

Inspect runtime DOM/classes during:

```text
normal ready state
Hide click
layout pending
new layout adopted
```

Record which class/attribute causes the change.

---

# Strong hypothesis to test

Current React Flow graph wraps nodes with:

```text
EntityDisclosureProvider
disabled={layoutPending}
```

and disclosure buttons have:

```css
.entity-disclosure:disabled {
  cursor: wait;
  opacity: 0.55;
}
```

If this is the artifact:

- keep disclosure interaction safely disabled while topology is transitioning if necessary;
- change the disabled/pending presentation so controls do not become a conspicuous semi-transparent box;
- consider `aria-disabled`/event guard only if native button `disabled` is not required;
- or keep `disabled` but make pending visual grammar intentional and minimal.

Do not make controls clickable when doing so can issue unsafe overlapping disclosure mutations.

---

# Desired pending presentation

During layout recompute:

```text
graph remains visually stable
disclosure counts/buttons do not acquire a distracting box
```

A subtle global:

```text
Updating layout…
```

status is enough.

If individual controls need a disabled state, use something like:

```text
slight text/icon opacity
no background block
no new border
no fake selection appearance
```

Preserve accessibility.

---

# Focus/selection outline distinction

Also verify the artifact is not actually:

```text
React Flow selected-node ring
focus-visible outline
subfocus context class
```

If it is, fix the actual class composition.

Final report must name the exact cause.

---

# Artifact tests

Add CSS/component regressions for:

```text
ready disclosure
pending disclosure
disabled disclosure
focus-visible disclosure
selected node
subfocus active
```

Ensure these states do not visually masquerade as one another.

---

# PART G — Do not change accepted graph semantics

Preserve:

```text
Collapse vs Hide distinction
Heading/Block subfocus
Ctrl+Z graph history
File reroot
nested Soft hierarchy
Focus-neutral foldering
Folder | Parent label
Current View schema-v4 migration
Saved View migration
```

Do not add another persistence schema unless this corrective task actually changes persisted state. It should not.

---

# PART H — Instrumentation / evidence for "layout updated"

Add focused development evidence/tests rather than product UI.

For each Hide/Restore action, be able to assert:

```text
projection identity/node set
Classic fingerprint or Modular layoutKey
layout request/cache hit
adopted geometry identity
pending→ready completion
```

No need to expose technical IDs to users.

---

# Likely files / areas

Inspect actual branch first.

Probable:

```text
apps/web/src/components/FocusOutline.tsx
apps/web/src/components/FocusOutline.test.tsx
apps/web/src/focus-outline-model.ts
apps/web/src/focus-outline-model.test.ts
apps/web/src/components/GraphExplorer.tsx
apps/web/src/App.css

new/refactored likely:
apps/web/src/components/FocusExplorer.tsx
apps/web/src/components/FocusExplorer.test.tsx
apps/web/src/focus-explorer-files.ts
apps/web/src/focus-explorer-files.test.ts

shared with:
apps/web/src/network-explorer-folders.ts
apps/web/src/network-explorer-model.ts
apps/web/src/components/NetworkExplorer.tsx

Classic layout:
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/local-structured-layout.ts
packages/renderer-reactflow/src/styles.css

Modular:
apps/web/src/components/ModularStructuredGraphView.tsx
apps/web/src/focus-schematic-layout-cache.ts

docs:
apps/web/README.md
apps/web/src/components/README.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
history-implementations/
```

Do not force all these files to change.

---

# Validation scenarios

## Sidebar

```text
Open Focus + Hierarchy
Open Focus Explorer
Files tab visible
switch Headings
switch Files
no projection/layout work merely from tab switch
close/reopen retains sensible session tab
```

## Files tab

```text
folder grouping correct
only Files listed
Focus File marked
single-click selects/centers
reroot uses existing path
Back restores previous Focus
```

## Headings tab

```text
Hide top-level Heading
Restore
nested Heading
hidden-by-parent
Show all
Depth changes
Collapse/expand
Ctrl+Z/Forward
```

## Layout reliability

```text
Hide/Restore in Classic
Hide/Restore in Modular
rapid repeated actions
cache revisit
worker failure
```

## Pending artifact

```text
slow/injected delayed layout
inspect controls while pending
no translucent square artifact
controls safe
```

## Regression

```text
Heading subfocus
Block subfocus
File reroot
Direct/Nested Soft
Inspector coexistence
narrow drawer switching
Saved Views
Current View
```

---

# Automated validation

Follow current `AGENTS.md`.

Expected current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web/src/components
pnpm exec vitest run apps/web/src/focus-outline-model.test.ts
pnpm exec vitest run apps/web/src/network-explorer-model.test.ts
pnpm exec vitest run packages/renderer-reactflow

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Add focused layout/cache tests as required by the diagnosed cause.

---

# Native artifact

Build:

```text
hierdisc1-fix1-focus-explorer-layout-polish-native-candidate.exe
```

Report SHA-256.

Update PR #127.

Run CI.

Do not merge.

---

# Native founder QA request

Ask founder to verify:

### Files / Headings switch

```text
Focus + Hierarchy
→ open left drawer
→ Files | Headings toggle at top
```

Files should feel like the useful File navigator brought over from Network.

### Heading Hide layout

Repeatedly:

```text
Hide
Restore
Hide another Heading
```

Expected:

```text
node set updates immediately
layout always reaches correct current geometry
no stale-looking previous layout
```

### Pending visual artifact

Expected:

```text
no translucent square suddenly covering disclosure counts/buttons
```

### Regression

Smoke-test:

```text
File reroot
Heading subfocus
Ctrl+Z
Nested Soft folders
```

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIERDISC1_FIX1_focus_explorer_layout_polish_codex_prompt.md
```

Record SHA-256.

---

# Hard exit gates

1. same PR #127 continued;
2. latest main integrated if needed;
3. HIERDISC1 Hide/Restore semantics preserved;
4. exact cause of apparent missing layout update identified;
5. successful Hide always changes projected node set correctly;
6. Classic layout identity/adoption correct after Hide;
7. Classic Restore correct;
8. Modular layout identity/adoption correct after Hide;
9. Modular Restore correct;
10. rapid actions latest-wins;
11. no stale geometry after successful adoption;
12. existing last-valid failure behavior preserved;
13. Focus Explorer replaces standalone Focus Outline drawer conceptually;
14. top `Files | Headings` accessible toggle exists;
15. tab switch causes zero semantic projection/layout mutation;
16. Files tab lists current Focus Files only;
17. Files grouped by canonical source folders;
18. no Headings/Blocks/diagnostics in Files tab;
19. current Focus File clearly marked;
20. File select/center works;
21. File reroot reuses existing safe pipeline;
22. Headings tab preserves all visibility states/actions;
23. drawer responsive/focus behavior preserved;
24. exact translucent-square cause identified;
25. pending disclosure controls no longer show artifact;
26. unsafe overlapping disclosure actions still prevented;
27. accessibility preserved;
28. ordinary selected/focus-visible/subfocus styling unchanged;
29. Heading/Block subfocus unchanged;
30. Folder | Parent unchanged;
31. no unnecessary persistence/schema bump;
32. Current View/Saved View behavior unchanged;
33. Classic/Modular semantic parity preserved;
34. focused tests pass;
35. full `pnpm check` passes;
36. desktop check/build passes;
37. `git diff --check` passes;
38. docs updated;
39. prompt archived + SHA-256;
40. optimized EXE + SHA-256;
41. PR #127 CI green;
42. PR remains unmerged;
43. stop.

---

# Final report

Report:

## Branch / commit / PR

## Layout-update diagnosis

State exactly which layer was responsible:

```text
click
projection
cache key/fingerprint
worker request
adoption
or apparent-but-valid stable geometry
```

and the fix.

## Focus Explorer

Explain:

```text
Files tab
Headings tab
shared drawer behavior
what was reused/refactored from Network Explorer
```

## Disclosure-square diagnosis

Name the exact DOM/CSS/state cause and resulting visual fix.

## Performance

Confirm tab switches do not trigger projection/layout work.

## Validation

Exact test/build counts.

## Native artifact

Path + SHA-256.

## Prompt archive

Path + SHA-256.

## Merge status

```text
NOT MERGED — awaiting founder graphical QA
```

Then stop.
