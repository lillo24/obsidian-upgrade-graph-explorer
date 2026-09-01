# PRE-KG14A — Known UI Bugs + Interaction Cleanup

**Task type:** focused bugfix / UX cleanup / release-desktop regression fixes

## Goal

Fix the known user-visible problems found in the release `.exe` **before** running KG14A, so the product-quality audit starts from a baseline without already-known regressions.

This is one focused cleanup PR. Do not begin KG14A in the same task.

Known issues:

```text
1. Search results remain open after navigating to a result.
2. Some Global Sigma labels are visibly clipped/truncated at the canvas boundary.
3. Settings popover can overflow the bottom of the window and needs clearer section grouping.
4. Structure depth presets do not behave like exact presets because old manual disclosure survives.
5. Expand/Collapse chevrons should return to + / −.
```

Expected roadmap behavior after this task:

```text
KG13 — Complete
PRE-KG14A cleanup — Complete
KG14A — Next
```

Do not mark KG14A started.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

Current baseline is `main` after KG13B2B / PR #36.

Important current facts:

- `EntitySearch.tsx` derives result visibility only from whether the query string is non-empty, so selecting a result leaves the suggestions/results visible.
- Global labels use Sigma's adaptive labels plus forced hover/selection labels. The synthetic sample already contains `Case Target.md`, which gives a deterministic reproduction target for the clipping report.
- `GraphSettings.tsx` combines app/source/developer children with Graph Appearance, Global Layout, and Graph Interaction inside one popover with one internal scroll owner.
- `graphStateReducer` currently handles `set-depth` by changing only `defaultDepth`; explicit `expandedEntityIds` / `collapsedEntityIds` survive. This matches the historical "baseline + manual override" model but conflicts with the user-facing expectation of a button literally named **Files only**.
- React Flow entity disclosure currently uses `›` / `⌄` symbols.

Before editing, sync latest `main`, inspect the exact current implementations and tests, and preserve any newer changes.

---

# Scope decision

Handle all five issues in one PR.

They are independent enough to test separately but small enough that splitting them would add overhead without improving architectural safety.

Do not combine this with:

- KG14A audit work;
- GROUP1;
- Saved Views;
- graph analytics;
- renderer redesign;
- source-model changes;
- new dependencies.

---

# 1. Search: separate query text from suggestion visibility

## Current problem

The canonical search currently behaves conceptually like:

```text
query has text
→ results are visible
```

After the user clicks a search result:

```text
navigation succeeds
but query still has text
→ result list stays visible over the graph
```

The desired behavior is:

```text
type "Case"
→ suggestions/results visible

click "Case Target"
→ navigate / reveal / center result
→ search text remains "Case"
→ suggestions/results close

click/focus the search field again
→ suggestions/results reopen for the existing query
```

The text should therefore behave like retained search context, while the result panel has a separate open/closed state.

## Implementation direction

In `EntitySearch.tsx`, introduce a narrow presentation state such as:

```ts
const [resultsOpen, setResultsOpen] = useState(false)
```

Expected interaction:

### Typing

```text
input change
→ update query
→ open results when trimmed query is non-empty
```

### Focusing/clicking the field

```text
non-empty query
→ reopen results
```

### Result selection

```text
close results first / as part of the same action
→ call existing onNavigate(...)
→ keep query text
```

### Escape

```text
close result panel
→ keep query text
→ keep/focus search input as appropriate
```

### Clearing query

```text
empty query
→ close results
```

### Leaving search

If implementing blur/outside-click close, make sure clicking a result is not swallowed by blur ordering. Prefer a container/focus-within or relatedTarget-safe solution rather than arbitrary timeouts.

Do not clear the search query after navigation.

Do not turn canonical Search into QUERY1.

## Accessibility

Add/maintain useful semantics:

```text
aria-expanded
aria-controls
result/status live text where appropriate
```

A full ARIA combobox rewrite is not required unless the current implementation naturally supports it.

Do not leave a visible `N canonical results` panel/status after a result was intentionally dismissed unless that status is still useful outside the suggestion list.

## Tests

Cover:

1. typing opens results;
2. selecting a result calls `onNavigate`;
3. result list closes after selection;
4. query value remains;
5. focusing/clicking input reopens results;
6. Escape closes without clearing;
7. empty query closes;
8. keyboard result activation follows the same behavior.

---

# 2. Global Sigma label clipping — reproduce `Case Target`

## User-visible bug

In the bundled Synthetic Sample, at least one Global file label can render as only the beginning of its rounded/highlight background while the actual text is clipped away.

Known deterministic entity:

```text
Case Target.md
Inspector:
File
Case Target
0 outgoing · 0 backlinks
```

This proves the canonical label exists; this is a rendering/viewport-label problem, not missing entity data.

The visual symptom is approximately:

```text
( rounded label-start [text should start here...]
                      ↑ clipped at canvas edge
```

## Important distinction

Global intentionally uses adaptive label density.

Do **not** "fix" this by forcing every Global node label to render all the time.

Expected policy remains:

```text
far / dense graph
→ some labels intentionally omitted

selected / hovered / otherwise chosen-to-render label
→ label must be fully readable, not visibly clipped into a fragment
```

## Required investigation

First reproduce on current production Global using the bundled Synthetic Sample.

Inspect:

- `Case Target.md` position after Global layout;
- Sigma default label/highlight rendering near canvas boundaries;
- selected/hovered forced-label behavior;
- camera/stage padding;
- label text/background metrics;
- whether the clipping is specifically right-edge, left-edge, top/bottom, or a highlighted-node renderer problem.

Do not guess the root cause from the screenshot description alone.

## Preferred fix direction

Use the narrowest renderer-level fix that guarantees visible forced labels remain inside the Global canvas.

Likely acceptable directions include:

```text
viewport-aware custom node-label / hover-label drawer
→ measure text
→ render to the right when there is room
→ flip left when near right edge
→ clamp vertically/horizontally when necessary
```

or an equally robust Sigma-supported solution.

A large permanent stage padding increase should **not** be the only fix unless measurement proves it solves the problem without wasting meaningful canvas space or failing for long names.

Do not change graph positions just to make labels fit.

Do not alter Local Free labels unless the same underlying bug is proven there; if the shared solution naturally improves both Sigma modes, test both.

## Tests / QA

Add pure tests around any label-placement helper where practical:

```text
normal interior label
near-right-edge label flips/clamps
near-left/top/bottom edge stays within bounds
long label remains finite/safe
```

Production browser/release desktop QA:

- Synthetic Sample → Global;
- locate/select/hover `Case Target`;
- label is readable;
- move/zoom around edges;
- adaptive label culling still works;
- selected/hovered labels remain forced;
- no console/WebGL errors.

---

# 3. Settings popover: viewport-safe + clearer grouping

## Overflow bug

The floating Settings popover can extend slightly below the `.exe` window.

Fix the geometry so the popover always remains within the current visual viewport in:

```text
normal graph mode
maximized graph mode
short desktop window
standard desktop window
high-DPI / scaled display
```

The popover should own a bounded internal scroll region rather than increasing page/body height.

## CSS/layout requirements

After inspecting the current anchor geometry, ensure:

```text
popover outer box stays within ~0.5–1rem viewport inset
heading/tab area remains reachable
content area is the single vertical scroll owner
bottom content is reachable without clipping
no horizontal scrollbar at ordinary widths
```

Use `100dvh` / actual viewport-safe calculations appropriately.

Do not solve by reducing all content/font sizes.

Do not create body scrolling when the graph is maximized.

## Settings grouping

The current popover mixes:

```text
Source
Developer / Diagnostic Evidence
Graph Appearance
Global Layout
Graph Interaction
```

Add a compact segmented/tab control near the top.

Recommended product grouping:

```text
[ Graph ] [ Source & Diagnostics ]
```

### Graph

Contains:

```text
Graph Appearance
Global Layout
Graph Interaction
```

### Source & Diagnostics

Contains:

```text
Source
Open Vault / Open Report / Synthetic Sample / Rescan / Recovery
Developer / Diagnostic Evidence
```

Do **not** literally call the first tab `Sandbox` unless current UX evidence clearly supports that label. Graph appearance/layout/interaction settings also apply to real vaults, so `Graph` is more accurate.

If the user specifically used "sandbox" to mean the Synthetic Sample controls, those remain inside Source & Diagnostics as source choices rather than defining the whole graph-settings category.

## Behavior

- Default tab should be `Graph` unless current source/error context makes another default clearly better.
- Switching tabs is transient UI state; do not persist it.
- Opening/closing Settings should remain lightweight.
- Diagnostic Evidence launcher stays behind the Source & Diagnostics grouping.
- Preserve existing warning/recovery behavior.
- Do not remount/reload the graph when switching Settings tabs.

## Accessibility

Use appropriate tabs/segmented-control semantics:

```text
role=tablist / tab / tabpanel
```

or a simple accessible button group if tabs would be excessive.

Keyboard access required.

## Tests / QA

- Graph tab content correct;
- Source & Diagnostics content correct;
- tab switch doesn't mutate graph state;
- short-height window can reach bottom content;
- internal scroll works;
- maximized mode works;
- no viewport/body overflow regression.

---

# 4. Structure Depth presets should be exact user presets

## Current behavior

`set-depth` currently changes only:

```ts
disclosure.defaultDepth
```

Manual disclosure overrides remain:

```text
expandedEntityIds
collapsedEntityIds
```

Therefore a user can click:

```text
Files only
```

and still see manually expanded sections such as:

```text
Source.md
→ Overview
→ Nested
```

This is internally consistent with the old "automatic baseline + explicit override" architecture, but it conflicts with the current UI wording and the user's expectation.

## New product behavior

Treat the toolbar depth buttons as **fresh structural presets**.

When the user explicitly chooses:

```text
Files only
1 level
2 levels
3 levels
```

reset existing manual disclosure overrides before applying the requested baseline.

Conceptually:

```ts
case 'set-depth':
  return {
    ...state,
    disclosure: {
      ...state.disclosure,
      defaultDepth: action.depth,
      expandedEntityIds: [],
      collapsedEntityIds: [],
    },
  }
```

Use current type/order normalization as appropriate.

Then:

```text
click Files only
→ exact files-only graph

manually expand Source.md afterward
→ headings may appear

click Files only again
→ manual expansion cleared again
```

Likewise changing to `1/2/3 levels` resets old manual expansion/collapse overrides and starts from that clean preset.

Preserve:

- heading limit;
- Blocks preference;
- filters / QUERY1;
- Focus unless current UX intentionally exits it;
- reference status/path filters.

Do not reset unrelated graph state.

## Documentation

Update wording that currently describes depth exclusively as a baseline if necessary.

Make the distinction clear:

```text
Depth button selection
→ resets to that structural preset

manual disclosure afterward
→ customizes the current preset
```

## Tests

Using the Synthetic Sample, explicitly cover:

1. expand `Source.md` → `Overview` / `Nested` become visible;
2. click Files only → no Section nodes remain;
3. manual expansion works afterward;
4. switching 1 → 2 levels resets stale explicit overrides;
5. heading limit remains intact;
6. QUERY1/filter state remains intact;
7. history records the resulting semantic action coherently.

---

# 5. Restore + / − disclosure symbols

## Current behavior

React Flow entity disclosure presentation uses:

```text
collapsed → ›
expanded  → ⌄
```

The requested visual language is:

```text
collapsed / expandable → +
expanded / collapsible → −
```

Use a real minus glyph `−` if it renders consistently; otherwise `-` is acceptable.

## Scope

Update the shared React Flow disclosure affordance so the change applies coherently to:

- general Structure;
- Local Structured.

Keep existing:

- descendant count;
- aria-label wording;
- keyboard behavior;
- disabled behavior while layout is pending;
- event isolation from double-click Focus.

Do not change disclosure semantics.

Do not alter Local Free Inspector disclosure unless it currently uses the same chevron and would otherwise become visibly inconsistent; inspect first.

## Tests

Update exact presentation tests:

```text
expand action → +
collapse action → −
```

Keep ARIA tests intact.

---

# Regression boundaries

These fixes must not regress:

```text
Structure
Global / Regional
Local Free
Local Structured
QUERY1 / Saved Filters
Search navigation semantics
Inspector
Back / Forward
view-state schema v3
Global / Local layout workers
W3
precision touchpad behavior
source/live vault workflow
```

No new external runtime dependency expected.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Reproduce all five reported problems on current build/Synthetic Sample.
3. Fix Search suggestion visibility + tests.
4. Reproduce/fix Global `Case Target` label clipping + tests.
5. Make Settings viewport-safe.
6. Add Graph / Source & Diagnostics grouping.
7. Change structural-depth preset semantics + tests/docs.
8. Restore + / − disclosure visuals.
9. Run focused component/renderer/state tests.
10. Run full checks.
11. Production browser QA.
12. Release Tauri `.exe` QA for all five fixes.
13. Archive this prompt under `history-implementations/`.
14. PR → CI → merge → post-merge CI → cleanup.
15. Stop; KG14A remains next.

---

# Validation

Use current repository equivalents:

```bash
pnpm install --frozen-lockfile

pnpm exec vitest run apps/web
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run packages/view-projection

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

Also perform production browser + release Tauri QA:

```text
Search select → results close → text remains → refocus reopens
Global Synthetic Sample → Case Target label readable
Settings short-window bottom bound + internal scroll
Settings Graph / Source & Diagnostics tabs
Structure expand → Files only hides all sections
1/2/3 depth preset reset behavior
+ / − disclosure in Structure
+ / − disclosure in Local Structured
no console errors/warnings
```

---

# Exit gate

This cleanup is complete only when:

1. Search query text and search-result visibility are separate state.
2. Selecting a Search result closes suggestions.
3. Selecting a Search result keeps query text.
4. Refocusing/reclicking the non-empty input reopens suggestions.
5. Escape closes suggestions without clearing text.
6. Search navigation semantics remain unchanged.
7. `Case Target.md` reproduces the old Global label bug before the fix.
8. The root cause of the Global label clipping is documented in the PR/final report.
9. Rendered/forced Global labels stay fully readable at canvas boundaries.
10. Adaptive Global label culling remains intact.
11. Global graph topology/layout semantics are unchanged by the label fix.
12. Settings popover stays inside the viewport vertically.
13. Settings content remains reachable via internal scrolling.
14. Maximized graph doesn't gain body overflow.
15. Settings has a compact Graph / Source & Diagnostics grouping.
16. Graph Appearance/Layout/Interaction are under Graph.
17. Source + Diagnostic Evidence are under Source & Diagnostics.
18. Settings grouping is keyboard accessible.
19. Settings-tab choice is transient, not persisted.
20. `Files only` produces an exact files-only Structure view immediately after selection.
21. Stale manual expansions are cleared by every explicit depth preset selection.
22. Stale manual collapses are also cleared.
23. Manual disclosure works normally after selecting a preset.
24. Heading limit remains unchanged by depth selection.
25. Blocks preference remains unchanged.
26. QUERY1 / filters remain unchanged.
27. Synthetic `Overview` / `Nested` sections disappear after Files only.
28. Expand affordance uses `+`.
29. Collapse affordance uses `−` or approved `-`.
30. ARIA labels/counts remain correct.
31. Standard Structure remains functional.
32. Local Structured remains functional.
33. Global/Local Free remain functional.
34. QUERY1 and Saved Filters remain functional.
35. browser QA passes.
36. release `.exe` QA passes.
37. full tests pass.
38. desktop release build passes.
39. PR CI passes.
40. post-merge CI passes.
41. branch/worktree cleanup completes.
42. KG14A is not started automatically.

---

# Final report

## 1. Summary

Confirm all five reported issues and their outcome.

## 2. Search behavior

Describe retained query + dismissed/reopened suggestions.

## 3. Global label bug

State exact root cause, `Case Target` reproduction, and fix.

## 4. Settings

Viewport overflow fix and final grouping labels.

## 5. Structure Depth

Explain the semantic change from "baseline plus stale overrides" to "fresh preset, then manual customization".

## 6. Disclosure affordance

Confirm + / − and accessibility behavior.

## 7. Tests / QA

Commands + browser + release `.exe` scenarios.

## 8. Regression evidence

Structure / Global / Local / QUERY1.

## 9. Files changed

Important components/state/renderer/CSS/docs.

## 10. Dependencies

Expected additions: zero.

## 11. Roadmap

Confirm:

```text
KG13 complete
PRE-KG14A cleanup complete
KG14A next
```

Do not implement KG14A automatically.
