# UX4B — Toolbar / Floating Filters + Unified Inspector Sidebar

**Task type:** graph workspace interaction chrome / responsive containment / filter organization / sidebar grammar

## Goal

Clean up the graph-control layer now that UX4A has made the workspace edge-to-edge.

UX4B should solve four related problems:

1. **Graph Filters currently consume layout space** and push the graph canvas downward when expanded.
2. **Expanded Graph Filters can force horizontal overflow**, especially inside Full/Maximized → Tools.
3. **Heading Depth and Blocks are split across confusing controls** instead of living with the other visibility/filter controls.
4. **Inspector behaves differently in normal vs maximized mode** and is exposed as a generic text button rather than a proper right-sidebar control.

Target product grammar:

```text
Search
────────────────────────────────────────────────────────────────────
Structure:  Documents | Top-Level     Filters [N]

                                       counts  Reset  ⚙  [sidebar icon]
────────────────────────────────────────────────────────────────────
                              GRAPH

Filters open:
      ┌────────────────────────────────────────────────────────┐
      │ Path Scope        Entity Content                       │
      │ Heading Depth     Reference Status                     │
      └────────────────────────────────────────────────────────┘
      overlays the graph / floating tools surface

Inspector closed:
                                                     [ ‹ ]

Inspector open:
                            GRAPH     │ ‹ │ Inspector drawer
```

The exact visual arrangement may adapt to the latest merged UI, but the semantics above should hold.

UX4B is **not** the Focus/node-style/history milestone.

Do not yet:

- remove `Focus Selected`;
- add double-click Focus;
- add focused-root visual variants;
- simplify node labels/path/focus-distance;
- add Back/Forward graph history;
- add query language/saved filters;
- add visual groups/clustering/layout spacing.

Those remain UX4C / NAV1 / future QUERY/GROUP/LAYOUT work.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

UX4A merged through PR #23 as:

`bb20973`

At planning time, current `GraphExplorer.tsx` still has:

```text
EntitySearch

graph-toolbar
  Structure
    Documents
    Top-Level
    Blocks
    Headings / No limit
  Focus controls
  Workspace controls
    counts
    Reset saved view
    Settings
    Inspector

GraphFilters <details>
  Path Scope
  Entity Content
    Documents
    Sections
    Blocks
  Reference Status
  helper paragraph
```

Current `GraphFilters` is a normal-flow `<details>` element.

Therefore:

```text
expand Graph Filters
→ graph stage receives less vertical space
```

Current filter CSS uses:

```css
grid-template-columns:
  minmax(11rem, 0.8fr)
  minmax(14rem, 1fr)
  minmax(18rem, 1.3fr);
```

That minimum intrinsic width can exceed the available Full/Tools surface.

The user reproduced a concrete regression:

```text
Maximized
→ open Tools
→ Graph Filters collapsed
   no horizontal scrollbar

→ expand Graph Filters
   horizontal scrollbar appears
   right-side controls overflow their container
```

This is a real containment bug.

Current Inspector behavior also differs by mode:

```text
normal:
  graph-stage--inspector-open
  → second grid column
  → graph canvas width shrinks

maximized:
  graph-stage--inspector-drawer-open
  → absolute right drawer
  → graph canvas remains full-size
```

When maximized and closed, there is already a right-edge Inspector handle.

Normal mode instead exposes a toolbar text button:

```text
Inspector
```

UX4B should unify these interaction patterns.

---

# Required first step

Before editing:

1. sync/rebase onto the latest intended base;
2. inspect whether KG11B2 or other UX work has merged after UX4A;
3. preserve any newer live-update/current-view behavior;
4. read:
   - `AGENTS.md`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphFilters.tsx`;
   - `apps/web/src/components/GraphSettings.tsx`;
   - `apps/web/src/components/ProvenanceInspector.tsx`;
   - `apps/web/src/graph-state.ts`;
   - `apps/web/src/App.css`;
   - relevant GraphExplorer/filters/Inspector tests;
   - `packages/view-state` persistence/restore behavior;
   - `packages/view-projection` filter/disclosure contracts;
5. inspect the current maximized Tools layout at:
   - 390 px;
   - ~600 px;
   - ~768 px;
   - ~1000 px;
   - wide desktop;
6. follow repository PR/CI/cleanup conventions.

If newer merged work already changed one of these surfaces, preserve the newer architecture and apply the UX intent rather than restoring stale markup.

---

# UX principle

Temporary controls should not permanently consume graph space.

Use this distinction:

```text
persistent graph content
→ owns layout space

temporary controls
→ float/overlay

persistent Inspector sidebar
→ drawer/overlay, explicitly opened
```

Consequences:

- opening Filters must not push the graph downward;
- opening Inspector must not shrink the graph horizontally;
- opening/closing either surface must not itself require graph projection/layout recomputation;
- only an actual filter/disclosure value change may legitimately change projection/layout.

This is a hard UX4B invariant.

---

# Part 1 — Toolbar organization

The top graph controls should have clearer ownership.

Keep the current major groups conceptually:

```text
Structure
Focus
Workspace
```

but remove visibility controls that belong in Filters.

## Structure remains

Keep:

```text
Documents
Top-Level
```

These represent the coarse structural disclosure preset:

```text
Documents
→ defaultDepth 0

Top-Level
→ defaultDepth 1
```

Do not reinterpret them as heading levels.

Do not remove either control.

## Remove from Structure

Move out:

```text
Blocks
Headings / No limit
```

Those are visibility constraints/options and belong in the Filters panel.

## Focus controls

Leave current Focus semantics alone in UX4B.

That means, for now:

```text
Focus Selected
Exit Focus
Hops
Direction
```

remain functionally unchanged.

UX4C will replace the focus-entry interaction.

Do not sneak double-click Focus into this PR.

## Workspace controls

Keep:

```text
node/edge counts
Reset saved view
Settings
Inspector toggle
```

but replace the Inspector **text** button with the sidebar grammar defined below.

---

# Part 2 — Filters trigger in the toolbar

The current full-width:

```text
Graph Filters
[All / N active]
```

row should no longer occupy normal document flow.

Replace it with a compact toolbar trigger such as:

```text
Filters
```

plus an active-state/count affordance when useful.

Examples:

```text
Filters
Filters · 2
Filters [2]
```

Choose the current visual grammar that fits the toolbar.

Requirements:

- clear accessible name;
- `aria-expanded`;
- `aria-controls`;
- active count remains discoverable;
- trigger is touch-sized;
- opening it does not change graph-stage dimensions.

Do not use a permanent full-width `<summary>` row.

---

# Part 3 — Graph Filters becomes a floating surface

## Normal mode

In ordinary edge-to-edge mode:

```text
Filters trigger
→ floating panel/popover
→ panel overlays graph workspace
```

The panel must not participate in the flex column height that determines `graph-stage`.

Opening/closing it must leave:

```text
graph canvas width
graph canvas height
```

unchanged.

## Maximized / Full mode

The existing Tools surface is already a floating overlay.

Therefore the filter UI may either:

1. open as a nested/floating panel inside the Tools surface; or
2. expand/reveal inside the already-floating Tools surface.

Either is acceptable **provided**:

```text
graph canvas dimensions remain unchanged
no horizontal overflow occurs
Tools width never expands
filter content reflows within the available width
```

Do not add another full-screen modal merely for Filters.

The same `GraphFilters` semantics/component should serve both contexts even if presentation CSS differs.

---

# Floating Filters positioning

Use a robust local overlay strategy.

Do not introduce a popover library.

The final implementation should satisfy:

```text
normal:
  panel visually anchored to Filters control / graph toolbar

maximized:
  panel contained by the floating Tools experience

narrow:
  panel may become a wider sheet-like overlay
  but still stays inside viewport
```

If CSS-only relative/absolute positioning is sufficient, prefer it.

Do not add continuous `getBoundingClientRect()` measurement or resize listeners unless the current layout genuinely requires them.

Do not use experimental browser anchor-positioning APIs as a hard dependency.

---

# Floating Filters close behavior

Provide normal transient-panel behavior:

- Filters trigger toggles it.
- Escape closes it.
- clicking outside may close it if consistent with current Settings behavior;
- opening Settings should close Filters where the current overlay grammar expects exclusivity;
- source/application dialogs should close graph overlays as current logic already does;
- changing a filter should **not** automatically close the panel.

Do not trap keyboard focus like a modal.

This is a nonmodal controls panel.

---

# Part 4 — Horizontal containment invariant

The concrete fullscreen bug must be fixed, but also add a general containment rule so the next panel cannot recreate it.

For important graph chrome boundaries, ensure:

```text
min-width: 0
max-width: 100%
box-sizing: border-box
```

where appropriate.

The graph workspace must never become wider because one child has large intrinsic content.

Hard invariant:

> No toolbar, Tools, Filters, Settings, or Inspector child may increase the graph workspace's minimum width or create page-level horizontal scrolling.

Do not solve this by hiding arbitrary overflow while leaving inaccessible controls off-screen.

The content itself must reflow.

---

# Filter-panel responsive layout

Remove the fixed three-column minimum-width combination that caused overflow.

Use a responsive layout that can naturally reflow.

A good direction:

```text
wide:
  Path Scope | Entity Content | Heading Depth | Reference Status

medium:
  Path Scope | Heading Depth
  Entity Content | Reference Status

narrow:
  Path Scope
  Entity Content
  Heading Depth
  Reference Status
```

The exact breakpoints may use:

- CSS Grid `auto-fit` / `minmax`;
- intentional media/container queries already supported by the codebase;
- a small number of explicit breakpoints.

Avoid a layout whose minimum widths sum to more than its container.

Controls must:

- shrink to available width;
- wrap labels/checks naturally;
- never overflow right edge;
- use vertical scrolling if the panel becomes too tall;
- never require horizontal scrolling in ordinary supported widths.

---

# Known responsive regression to encode

Add browser QA specifically for the user-reported case:

```text
Maximized
→ Tools open
→ Filters closed
  no horizontal scroll

→ Filters open
  STILL no horizontal scroll
  all Reference Status options stay inside container
```

Test around:

```text
390 px
600 px
768 px
1000 px
wide desktop
```

Do both:

```text
normal mode
maximized mode
```

The failure should not return merely because filter groups or labels change later.

---

# Part 5 — Move Heading Depth into Filters

Current toolbar control:

```text
Headings
[No limit]
```

belongs in Filters.

Use a clearer label:

```text
Heading Depth
```

Options remain:

```text
No limit
#
##
###
####
#####
######
```

Continue mapping to:

```text
ViewProjectionState.disclosure.maxSectionLevel
```

Do not change KG6 semantics.

Do not confuse:

```text
Top-Level
```

with:

```text
Heading Depth #
```

They remain different concepts:

```text
Top-Level
→ structural direct children

Heading Depth
→ Markdown heading-level ceiling
```

The UI may expose a compact tooltip/accessible description if necessary, but do not keep a large permanent explanatory paragraph.

---

# Heading-depth active state

The filter summary/count should treat a non-default heading ceiling as an active visibility constraint.

For example:

```text
No limit
→ not active

##
→ active
```

Do not count the default `No limit` state.

Persisted KG9 view semantics must remain unchanged; the control is only moving UI location.

---

# Part 6 — Rationalize duplicate Blocks controls

Current UI exposes Blocks twice:

```text
Structure → Blocks
```

and:

```text
Graph Filters
→ Entity Content
   → Blocks
```

These currently correspond to different internal concepts:

```text
disclosure.includeBlocks
filters.entityKinds includes/excludes block
```

That distinction is implementation-driven and confusing to users.

UX4B should expose **one user-facing Blocks control**.

Preferred location:

```text
Filters → Entity Content → Blocks
```

alongside:

```text
Documents
Sections
Blocks
```

Remove the toolbar Blocks checkbox.

---

# Single Blocks semantic behavior

The one visible Blocks checkbox must truthfully control whether block entities are eligible to appear.

Internally, preserve the KG6 distinction if needed, but do not allow an invisible stale entity-kind filter to contradict the visible Blocks checkbox.

A clean web-layer invariant is:

```text
disclosure.includeBlocks
= user-facing Blocks opt-in

filters.entityKinds
= Documents / Sections filtering
  with block internally normalized so it cannot secretly override includeBlocks
```

For example, if internal `entityKinds` remains the KG6 representation, a valid implementation can ensure block is always internally included in that filter dimension while `includeBlocks` is the sole block visibility switch.

The exact reducer representation is for Codex to refine after inspecting current contracts.

Do **not** change the core/KG6 entity-kind model solely for this UI cleanup.

---

# Existing saved-view compatibility for Blocks

This requires care.

Old persisted views may contain combinations such as:

```text
includeBlocks = true
entityKinds excludes block
```

or:

```text
includeBlocks = false
entityKinds includes/excludes block
```

After UX4B there must not be a hidden legacy block filter that the user can no longer control.

Choose the smallest compatibility normalization that guarantees:

```text
visible Blocks checkbox
→ actual block visibility intent
```

Possible implementation locations:

- graph-state/view-state normalization at the web boundary;
- a narrow compatibility helper when hydrating/reconciling current view state.

Do not bump the saved-view schema merely because the UI moved unless the serialized semantics genuinely become incompatible.

Document and test the chosen normalization.

---

# Documents / Sections Entity Content behavior

Keep user-facing checkboxes for:

```text
Documents
Sections
Blocks
```

Documents and Sections continue to map to the existing entity-kind filter semantics.

Blocks uses the unified behavior above.

Preserve existing KG6 behavior where structural ancestors may remain as context even if their entity kind is filtered.

Do not change projection semantics to make the checkbox wording more literal.

---

# Filter active-count semantics

Update the active count so it matches the new user-facing controls.

At minimum consider:

```text
Path Scope != All Paths
Entity Content differs from normal all-content choices
Heading Depth != No limit
Reference Status differs from all
Blocks enabled if Blocks is still treated as an opt-in visibility constraint
```

Choose one deterministic definition and test it.

Avoid counting hidden internal normalization details.

The badge represents **user-visible active constraints/options**, not the number of internal object properties.

---

# Remove obsolete Graph Filters helper copy

Current panel ends with:

```text
Entity filters select content matches.
Structural ancestors may remain as context.
Search remains global.
```

This is too implementation-explanatory for a persistent control surface.

Remove the permanent paragraph unless user QA proves one sentence is essential.

If one concept needs clarification, prefer:

- concise field-specific title/tooltip;
- accessible description;
- Developer/technical docs.

Do not keep the entire paragraph simply because it existed before UX4A.

Search remains global; its behavior does not change.

---

# Part 7 — Inspector becomes a real right sidebar/drawer

Current normal mode:

```text
Inspector open
→ graph-stage becomes two grid columns
→ graph canvas shrinks
```

Current maximized mode:

```text
Inspector open
→ absolute right drawer
→ graph remains full-size
```

Unify them.

Preferred UX4B behavior in **both** normal and maximized modes:

```text
Inspector
→ right-side overlay drawer
→ graph canvas dimensions do not change
```

Remove the normal-mode:

```text
graph-stage--inspector-open
grid-template-columns: ... 22–28rem
```

behavior.

Use one drawer model.

---

# Inspector drawer sizing

A good baseline remains close to the current maximized rule:

```text
width: min(28rem, calc(100vw - safe handle margin))
```

Requirements:

- no horizontal page overflow;
- internal Inspector content scrolls vertically;
- narrow windows still leave a clear close/open affordance;
- drawer overlays graph rather than changing its grid width;
- border/shadow may visually separate drawer from graph.

Do not change Inspector information architecture in UX4B.

---

# Inspector toolbar control

Remove the generic text button:

```text
Inspector
```

from workspace controls.

Replace it with a compact right-sidebar icon similar to the visual grammar used by editors such as VS Code.

Do not add an icon package.

Use a small local SVG.

Requirements:

- accessible label:
  - `Open Inspector`
  - `Close Inspector`
- `aria-pressed` or appropriate expanded state;
- tooltip/title may say Inspector;
- touch-sized target;
- visible selected/open state.

The icon should communicate:

```text
toggle right sidebar
```

rather than a generic information/action button.

---

# Right-edge Inspector handle

The existing maximized-only edge handle should become available in both normal and maximized modes.

When Inspector is closed:

```text
right edge
[ ‹ ]
```

opens it.

The visible handle does **not** need:

```text
Open Inspector
```

written beside the chevron.

Keep that text in:

```text
aria-label
title
```

only.

The handle should be visually compact.

---

# Inspector close affordance

When the drawer is open, give it a matching collapse affordance.

A good grammar:

```text
graph │ › │ Inspector
```

or an equivalent sidebar icon/chevron.

The existing:

```text
Close Inspector
```

text button should not be necessary as the primary close control.

Keep:

```text
Clear selection
```

as a distinct action when a selection exists.

Do not overload the chevron with selection clearing.

---

# Inspector open state with no selection

Opening Inspector while nothing is selected remains valid.

It may show the current:

```text
Select a file, section, or connection.
```

empty state.

Do not automatically close Inspector just because selection becomes null.

This is a panel visibility choice independent from graph selection.

---

# Inspector selection behavior

Do not alter existing KG11/live-update semantics:

```text
selected projected element survives
→ selection survives

selected element disappears
→ selection clears safely
```

Inspector should remain open when a live update clears the removed selection, unless current product behavior clearly dictates otherwise.

Do not remount/reinitialize GraphExplorer solely because drawer state changed.

---

# Inspector drawer and graph layout

Hard invariant:

```text
open Inspector
→ graph-stage dimensions unchanged

close Inspector
→ graph-stage dimensions unchanged
```

Do not call Fit View merely because the drawer opened.

Do not trigger projection recomputation solely from panel visibility.

The drawer may visually cover some graph content; that is the intentional overlay model.

Users can pan the graph if desired.

NAV1/future viewport ergonomics can later add richer behavior.

---

# Part 8 — Settings / Filters / Inspector overlay coordination

UX4A already has Settings as a popover and diagnostic evidence as a higher-level dialog.

UX4B should make graph overlays predictable.

Suggested rules:

```text
Settings open
→ Filters closes

Filters open
→ Settings closes

Inspector
→ may remain open independently

Diagnostic evidence / application modal
→ graph toolbar overlays close according to current App behavior
```

Maximized Tools is itself a container, so adapt these rules rather than creating impossible mutually-exclusive states.

Do not let Escape unexpectedly:

```text
close Filters
AND exit maximized mode
```

in one key press.

Consume the nearest active overlay first where appropriate.

Preserve current UX4A deterministic Escape behavior.

---

# Part 9 — Full/Maximized Tools containment

The Full → Tools surface must remain a bounded floating panel.

Hard CSS/runtime invariants:

```text
width <= available viewport
max-width <= available viewport
min-width: 0
overflow-x: hidden / no horizontal scrollbar
children wrap/reflow
```

Do not merely increase the Tools width until the current filters fit.

Do not make the Tools panel wider than the viewport.

If vertical content exceeds available height:

```text
vertical scroll
```

is acceptable.

Horizontal scroll for these controls is not.

---

# Full Tools body behavior

Current maximized `graph-tools-panel__body` is vertically scrollable.

Preserve a usable vertical scroll path for:

- search results;
- toolbar controls;
- filter content;
- projection issues when present.

When Filters opens inside Full Tools, ensure its responsive layout does not create nested horizontal scrolling.

Avoid unnecessary nested vertical scroll containers when one can own scrolling cleanly.

---

# Part 10 — General containment hardening

The specific Graph Filters grid caused the observed bug, but the underlying layout should be defensive.

Audit key boundaries:

```text
graph-workspace
graph-tools-surface
graph-tools-panel__body
entity-search
graph-toolbar
control-group
GraphFilters panel/body
Inspector drawer
Settings popover
```

Apply `min-width: 0` and shrink/wrap rules where semantically correct.

Do not use:

```css
overflow-x: hidden;
```

as the only fix if controls still extend beyond the clipping edge.

The exit gate is **accessible containment**, not merely absence of scrollbar pixels.

---

# Part 11 — Responsive toolbar behavior

The toolbar itself must not become a new overflow source after controls move.

Allow groups to:

- wrap;
- reorganize;
- remain touch-sized.

At narrower widths:

```text
Structure
Filters
Focus
Workspace controls
```

may occupy multiple rows if necessary.

That is preferable to horizontal page scrolling.

Do not turn the entire toolbar into a horizontal scroller.

Do not redesign it into a mobile bottom bar in UX4B.

---

# Part 12 — Search remains unchanged

`EntitySearch` remains outside the scope of the filter relocation.

Do not:

- move Search into Filters;
- make search query part of Graph Filters;
- make search local to current filters;
- clear search when Filters opens.

Search remains global according to KG8 semantics.

Only fix containment if current filter/toolbar work reveals a shared responsive issue.

---

# Part 13 — Focus remains unchanged

Do not alter:

```text
Focus Selected
Exit Focus
Hops
Direction
```

semantics in UX4B.

It is acceptable for the toolbar to reflow them responsively.

Do not yet:

- double-click to focus;
- remove Focus Selected;
- style focused root;
- alter focus distance appearance.

UX4C owns those changes.

---

# No domain architecture changes

Do not modify semantics in:

```text
core
parser
resolver
stable-identity
workspace-engine
snapshot-delta
explorer-inspection
renderer layout
KG10 incremental model
KG11 source/watch model
```

Expected package-semantic changes should be limited to:

```text
web graph state/UI normalization
possibly view-state compatibility normalization for old block filter state
```

Do not alter KG6 projection rules unless a genuine bug is proven.

---

# No new dependencies

Expected external additions:

```text
zero
```

Do not add:

- popover libraries;
- sidebar libraries;
- icon libraries;
- state-management libraries;
- CSS frameworks.

Use current React/CSS/SVG patterns.

---

# Suggested component/API changes

Use latest repository structure rather than forcing these names.

Likely areas:

```text
GraphExplorer.tsx
GraphFilters.tsx
ProvenanceInspector.tsx
graph-state.ts
App.css
GraphExplorer/filter/Inspector tests
possibly packages/view-state normalization tests
```

A reasonable GraphFilters API may become controlled, e.g.:

```ts
<GraphFilters
  open={...}
  onOpenChange={...}
  ...
/>
```

or split:

```text
GraphFiltersTrigger
GraphFiltersPanel
```

if that produces cleaner normal/maximized presentation.

Do not create a generic design-system popover abstraction unless multiple current components genuinely need it.

---

# Tests — Graph Filters semantics

Cover at least:

1. Filters trigger opens/closes panel.
2. Active count is correct.
3. Path Scope still maps correctly.
4. Documents checkbox still maps correctly.
5. Sections checkbox still maps correctly.
6. one user-facing Blocks checkbox controls actual block visibility intent.
7. no duplicate Blocks control remains.
8. enabling Blocks cannot be silently defeated by a hidden legacy block entity filter.
9. old saved-view block combinations normalize to controllable UI state.
10. Heading Depth moved into Filters.
11. `No limit` maps to null/undefined current semantics.
12. `#` through `######` map correctly.
13. heading limit participates in active-count behavior.
14. Reference Status filters unchanged.
15. Search remains global/independent.
16. persistent helper paragraph removed or intentionally reduced.

---

# Tests — Filters layout / overlay

Cover structural behavior where unit tests are useful:

1. expanded Filters is no longer a normal-flow height row beneath toolbar.
2. opening Filters does not change graph-stage component tree/layout ownership.
3. Settings/Filters overlay coordination works.
4. Escape closes Filters before exiting maximized mode.
5. application overlays close Filters according to current GraphExplorer rules.
6. changing a filter keeps panel open unless explicitly designed otherwise.
7. opening/closing Filters does not dispatch graph-state actions.

Do not write brittle pixel assertions in unit tests.

---

# Tests — Inspector

Cover:

1. toolbar no longer contains Inspector text button.
2. sidebar icon toggles Inspector.
3. right-edge handle exists when closed in normal mode.
4. right-edge handle exists when closed in maximized mode.
5. visible handle contains no unnecessary text label.
6. handle remains accessibly named.
7. Inspector opens as drawer/overlay in normal mode.
8. Inspector opens as drawer/overlay in maximized mode.
9. normal mode no longer adds second grid column.
10. close/collapse control works in both modes.
11. Clear selection remains independent.
12. Inspector can stay open with empty selection.
13. live-removed selection clears while drawer remains valid.
14. toggling Inspector does not reset view/search/focus.
15. opening/closing Inspector does not issue Fit View merely because drawer visibility changed.

---

# Browser QA — normal mode

Using the synthetic sample:

1. open browser at wide desktop.
2. confirm toolbar contains Documents / Top-Level.
3. confirm Blocks and Heading Depth are no longer in Structure.
4. open Filters.
5. confirm panel overlays graph instead of pushing canvas down.
6. compare graph-stage height before/after opening Filters.
7. change Heading Depth.
8. change Path Scope.
9. toggle Documents/Sections/Blocks.
10. confirm actual projection changes only after values change.
11. close Filters and confirm canvas does not jump.
12. toggle Inspector from sidebar icon.
13. toggle Inspector from right-edge handle.
14. confirm graph width does not shrink.
15. close drawer.
16. verify no horizontal page scroll.

Repeat around:

```text
390 px
600 px
768 px
1000 px
wide desktop
```

---

# Browser QA — Maximized / Full mode

This is mandatory because it contains the user-reported regression.

For each useful width, especially the width that previously failed:

1. maximize graph;
2. open Tools;
3. verify no horizontal scrollbar;
4. open Filters;
5. verify STILL no horizontal scrollbar;
6. verify Path Scope fits;
7. verify Entity Content fits/wraps;
8. verify Heading Depth fits;
9. verify all Reference Status controls remain inside the container;
10. vertically scroll Tools if necessary;
11. close/open Filters several times;
12. Inspector right-edge handle works;
13. Inspector drawer opens without moving graph;
14. Settings remains usable;
15. Escape closes the nearest overlay without unexpectedly exiting Full mode;
16. no console errors/warnings.

Capture the previous screenshot scenario as a regression reference if repository practice allows synthetic screenshots, but do not commit unnecessary binary artifacts.

---

# Desktop QA

Run the same important layout flows in the Tauri window:

- normal Filters overlay;
- maximized Tools + Filters;
- Inspector drawer normal/full;
- Settings/source controls still work after toolbar changes;
- live vault state is not affected by opening/closing UI surfaces.

No source semantics should change.

A synthetic/sample workspace is sufficient unless current desktop source state is needed to verify persisted Block/Heading controls.

---

# Accessibility

Review against current web-interface guidance.

Verify:

## Filters

- trigger has accessible name;
- `aria-expanded`;
- panel has a programmatic label;
- keyboard can reach every filter;
- Escape closes;
- focus is not trapped;
- active count is not the only way state is communicated;
- checkboxes/select labels are clear.

## Inspector

- sidebar toolbar icon is accessibly named;
- right-edge chevron handle is accessibly named despite no visible label;
- open/closed state communicated;
- drawer is an `aside`/landmark as appropriate;
- close affordance is keyboard accessible;
- focus does not get lost when opening/closing;
- Clear selection remains understandable.

Do not rely only on icon shape/color for meaning.

---

# CSS cleanup

Remove obsolete rules after refactor, especially:

```text
graph-filters normal-flow border row
fixed three-column min-width filter grid
graph-stage--inspector-open second-column layout
maximized-only inspector-handle visibility assumptions
toolbar Blocks-specific styling if unused
heading-limit toolbar-specific styling if obsolete
```

Do not leave dead CSS “for later”.

Audit responsive selectors so old rules do not override the new overlay/drawer behavior.

---

# Performance posture

UX4B should reduce accidental layout work.

Measure/instrument only enough to verify:

```text
open Filters
→ no projectView call caused solely by opening

close Filters
→ no projectView call caused solely by closing

open Inspector
→ no projectView call caused solely by opening

close Inspector
→ no projectView call caused solely by closing
```

Actual filter value changes are expected to reproject.

Do not begin PERF1/KG12 optimization.

Do not add performance budgets.

---

# Documentation

Update only relevant UI docs, likely:

```text
apps/web/README.md
apps/web/src/components/README.md
```

Record:

- Filters is now a floating panel;
- Heading Depth lives in Filters;
- Blocks has one user-facing control;
- Inspector is a consistent right drawer.

If the repository archives implementation prompts, archive this prompt under the existing convention.

No ADR is expected.

---

# Scope

## In scope

- toolbar organization;
- Filters toolbar trigger;
- floating Graph Filters in normal mode;
- contained responsive Filters in maximized Tools;
- horizontal-overflow regression fix;
- general graph-chrome containment hardening;
- Heading Depth relocation;
- single user-facing Blocks control;
- legacy block-state compatibility normalization;
- removal of obsolete Graph Filters helper copy;
- Inspector toolbar sidebar icon;
- Inspector right-edge chevron opener in normal + maximized modes;
- unified overlay drawer behavior;
- Inspector collapse affordance;
- responsive/browser/desktop QA;
- accessibility;
- CSS cleanup;
- docs;
- PR/CI/merge/cleanup.

## Explicitly out of scope

Do not implement:

- Focus Selected removal;
- double-click Focus;
- focused-root appearance;
- node label simplification;
- node focus-distance simplification;
- folder-path removal from nodes;
- Back/Forward history;
- saved queries/filters;
- graph color groups;
- cluster layouts;
- spacing controls;
- KG12/PERF1 optimizations.

Do not begin UX4C automatically.

---

# Suggested implementation sequence

1. Sync latest `main` / correct UX branch.
2. Reproduce normal and maximized Graph Filters overflow locally.
3. Define single user-facing Blocks state mapping + legacy normalization tests first.
4. Move Heading Depth and Blocks into GraphFilters.
5. Replace `<details>` normal-flow presentation with controlled Filters trigger/panel.
6. Make normal Filters overlay without graph-stage resize.
7. Make maximized Tools Filters responsive/contained.
8. Harden width/min-width/wrapping boundaries.
9. Replace Inspector text button with sidebar icon.
10. Unify normal/max Inspector into overlay drawer.
11. Add right-edge chevron open/collapse grammar.
12. Remove obsolete second-column/filters-row CSS.
13. Unit/integration tests.
14. Browser responsive QA including exact old Full/Filters failure.
15. Desktop smoke.
16. Accessibility/interface-guideline pass.
17. Docs.
18. PR → CI → merge → post-merge CI → cleanup.

---

# Validation commands

Use repository-equivalent commands.

At minimum:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web
pnpm --filter @icarus-graph-explorer/web build

pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
git diff --check
```

If `view-state` compatibility normalization changes:

```bash
pnpm --filter @icarus-graph-explorer/view-state typecheck
pnpm exec vitest run packages/view-state
```

Also run current desktop checks/smoke if available:

```text
pnpm desktop:check
normal desktop UI smoke
maximized desktop UI smoke
```

Browser QA widths:

```text
390
600
768
1000
wide desktop
```

in both:

```text
normal
maximized
```

PR CI and post-merge `main` CI should pass.

---

# Exit gate

UX4B is complete only when:

1. Graph Filters no longer occupies an expandable full-width normal-flow row.
2. Normal-mode Filters opens as a floating/overlay control surface.
3. Opening/closing Filters does not change graph canvas dimensions.
4. Opening/closing Filters does not itself dispatch graph-state changes.
5. Opening/closing Filters does not cause projection/layout recomputation solely because of visibility.
6. Full/Maximized Tools no longer gains horizontal scrolling when Filters opens.
7. Filter controls never overflow their container at supported widths.
8. Reference Status wraps/reflows correctly.
9. Path Scope remains usable at narrow widths.
10. Filter panel uses vertical rather than horizontal scrolling when space is constrained.
11. General graph chrome cannot increase workspace minimum width.
12. Documents / Top-Level remain Structure controls.
13. Heading Depth is removed from Structure.
14. Heading Depth exists inside Filters.
15. `No limit` / `#`–`######` semantics remain unchanged.
16. Heading Depth participates correctly in active-state/count behavior.
17. Toolbar Blocks checkbox is removed.
18. Only one user-facing Blocks control remains.
19. That Blocks control truthfully controls actual block visibility eligibility.
20. Hidden old `entityKinds` block state cannot contradict the visible Blocks control.
21. Old saved views with duplicate block-state combinations normalize safely.
22. Documents/Sections entity filters remain correct.
23. Reference Status filters remain correct.
24. Search remains global and unchanged.
25. Obsolete Graph Filters helper copy is removed/reduced.
26. Inspector text button is removed.
27. Toolbar uses a compact right-sidebar icon for Inspector.
28. Closed Inspector has a compact right-edge chevron handle in normal mode.
29. Closed Inspector has the same grammar in maximized mode.
30. The visible handle does not need a text label but remains accessibly named.
31. Inspector opens as an overlay drawer in normal mode.
32. Inspector opens as an overlay drawer in maximized mode.
33. Opening/closing Inspector does not change graph-stage dimensions.
34. Opening/closing Inspector does not trigger Fit View merely because of drawer visibility.
35. Inspector close/collapse affordance is consistent.
36. Clear selection remains a separate action.
37. Inspector can remain open with no selection.
38. Existing live-selection reconciliation remains correct.
39. Settings/Filters/Escape interactions remain deterministic.
40. Maximized Escape does not exit Full mode while a nearer graph overlay should close first.
41. 390/600/768/1000/wide responsive QA has no page/panel horizontal overflow.
42. The exact user-reported Full → Tools → Graph Filters regression is fixed.
43. UX4A edge-to-edge/source/settings behavior remains intact.
44. Focus semantics remain unchanged.
45. Node visuals/content remain unchanged.
46. No new external dependency is added.
47. Existing domain/live-source tests remain green.
48. Browser QA passes without console errors.
49. Desktop smoke passes where run.
50. Docs reflect the new Filters/Inspector grammar.
51. PR CI passes.
52. Post-merge `main` CI passes.
53. Branch/worktree cleanup follows repository convention.

Do not begin UX4C.

---

# Final report

Report:

## 1. Summary

What changed in toolbar, Filters, and Inspector.

## 2. Toolbar organization

State exactly what remains in Structure and what moved to Filters.

## 3. Graph Filters presentation

Explain:

- normal floating behavior;
- maximized Tools behavior;
- open/close semantics;
- why opening no longer resizes the graph.

## 4. Responsive containment

Explain the original fixed-min-width failure and the new responsive strategy.

Report QA at the tested widths.

## 5. Heading Depth

Confirm current semantics were preserved and only UI ownership changed.

## 6. Blocks rationalization

Explain:

- previous duplicate controls;
- new single user-facing control;
- internal KG6 mapping;
- old saved-view compatibility normalization.

## 7. Inspector sidebar

Explain:

- toolbar sidebar icon;
- edge chevron;
- normal/max unified drawer;
- no graph-width shrink;
- close/clear-selection distinction.

## 8. Overlay/Escape behavior

Settings, Filters, Tools, Inspector, maximized mode.

## 9. Performance behavior

Confirm overlay visibility alone does not reproject/relayout; actual filter changes still can.

## 10. Responsive/browser QA

Include the exact Full → Tools → Filters regression result.

## 11. Desktop QA

What was actually run.

## 12. Accessibility

Filter trigger/panel, sidebar icon/handle, keyboard/Escape.

## 13. Dependencies

Expected external additions: zero.

## 14. Tests / validation

All commands and counts actually run.

## 15. Files changed

Important GraphExplorer/GraphFilters/Inspector/state/CSS/tests/docs areas.

## 16. Deviations / warnings

Any remaining toolbar pressure, browser-specific overlay issue, old saved-state edge case, or issue to carry into UX4C.

## 17. UX4C handoff

State that UX4C can now focus only on:

- removing `Focus Selected`;
- double-click-to-Focus;
- focused-root visual variants;
- document/section/block node visual grammar;
- removing permanent FILE/SECTION labels where visual grammar suffices;
- removing visible Focus distance text;
- removing permanent full paths except collision disambiguation;
- reducing expansion chrome.

Do not implement UX4C automatically.
