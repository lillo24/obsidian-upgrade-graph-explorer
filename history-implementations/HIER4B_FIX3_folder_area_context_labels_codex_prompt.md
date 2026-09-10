# HIER4B-FIX3 — Folder-Area Context Menus + File/Folder Menu Composition + Nested Guide Label Cleanup

**Task type:** HIER4B interaction correction / UI cleanup / graphical QA

## Goal

Continue the existing **unmerged** HIER4B branch:

```text
codex/hier4b-soft-folder-clusters
```

from the current nested-hierarchy implementation:

```text
9cd8e7dfa7497ac041c4cf0d2b08938d1a01a78f
feat: add nested soft folder hierarchy
```

Do not create a PR or merge.

Fix only the remaining interaction/presentation issues discovered in live QA.

### Fix now

1. Right-click **empty space inside a Soft folder guide** must open that folder's menu, not only right-clicking the folder label.
2. For nested guides, empty-space right-click must target the **deepest visible folder region under the pointer**.
3. Right-clicking a **File** must open one composed menu:
   ```text
   File actions
   ━━━━━━━━━━━━━━━  stronger divider
   actions for the File's currently displayed containing folder
   ```
   No text section headings.
4. Right-clicking a **folder region** shows folder actions only.
5. Folder guide labels should show the **short folder name**, optionally with a quiet short parent hint, not the whole path.
6. Remove visible `Island X of Y`.
7. Use **display nesting depth** as presentation metadata/style instead. If a secondary metadata slot is useful during Experimental QA, `Nested 2` is acceptable; do not clutter labels with path + parent + depth + island.
8. Preserve all accepted HIER4B-FIX2 semantics.

### Record for later, do not implement

```text
HIER4B-SPACING
→ spread Files/modules more and use available canvas better

MODULAR-CONTEXT1
→ later add Network-style Focus / Inspect / Hide File / Hide Folder / etc.
```

---

# Preserve existing behavior

Do not redesign:

- nested displayed folder hierarchy;
- per-File promotion;
- folder flattening;
- sibling flattening;
- restore paths;
- automatic singleton-chain compression;
- H1 normalized decaying ancestor attraction;
- parent/sibling hover context;
- four-side Soft File ports;
- Direct/Electronic handle parity;
- Directional Bands exact HIER4A behavior;
- latest-result-wins;
- workspace-scoped persistence;
- privacy rules.

---

# A. Folder-area right-click

## A1. Desired interaction

```text
Right-click File
→ File logical target wins

Right-click folder label
→ that folder wins

Right-click empty point inside folder guide
→ deepest containing folder wins

Right-click outside all folder guides
→ no Soft folder menu
```

## A2. Do NOT make the whole hull pointer-active

Do not solve this with:

```css
pointer-events: auto
```

on large folder fills.

The guide interior must remain non-blocking for normal:

- File clicks;
- pan;
- edge hover;
- disclosure;
- selection;
- drag.

Preferred architecture:

```text
ordinary events
→ guide fill remains pointer-inert

contextmenu on graph/background
→ convert pointer to graph/world coordinates
→ geometrically hit-test current rendered folder regions
```

## A3. Use rendered guide geometry

Hit-test against the actual visible Soft guide regions/islands.

Do not infer target from:

- nearest File;
- path prefixes;
- canonical folder alone;
- loose bounding boxes that include empty concavities.

If a logical folder has several islands, any island targets the same logical folder.

## A4. Deepest folder rule

For graph point `P`:

1. collect visible guide regions containing `P`;
2. select greatest **display nesting depth**;
3. if still tied, select smallest containing region area;
4. stable ID tie-break.

Example:

```text
Folder1
└─ Folder2
```

Inside Folder2:

```text
Folder2
```

Inside Folder1 but outside Folder2:

```text
Folder1
```

Support depth 3+.

## A5. Coordinate conversion

Use the renderer's existing client/screen → React Flow/world conversion.

Must remain correct after:

- pan;
- zoom;
- fit;
- reroot transition.

Do not duplicate transform math unnecessarily.

## A6. Pure helper

Prefer a pure/testable helper similar to:

```ts
hitTestSoftFolderGuideRegion(guides, worldPoint)
```

Inputs should expose enough geometry for:

```text
logical folder key
region/island ID
display depth
shape
area
```

---

# B. File context menu composition

## B1. One menu

Right-clicking a File in:

```text
Modular Preview + Soft Folder Clusters
```

must produce one menu.

Top:

```text
File-level display actions
```

for example current equivalents of:

```text
Move up to Parent/
Restore exact folder placement
```

Then, if the File has a displayed containing folder with valid folder actions:

```text
strong divider
```

Then:

```text
actions for currently displayed containing folder
```

for example current equivalents of:

```text
Flatten into Parent/
Flatten this + sibling folders into Parent/
Restore relevant folder layer
Reset Soft folder display
```

Use only valid actions.

## B2. No text headings

Do not render:

```text
File actions
Folder actions
```

as labels.

Use only the stronger divider.

## B3. Displayed folder, not exact source folder

The lower section must target the File's **currently displayed containing folder**.

This matters after:

- File promotion;
- manual flattening;
- automatic singleton compression.

Do not silently target a hidden exact source folder.

## B4. No displayed folder

If File is directly at display root and no valid folder target exists:

```text
File actions only
```

No empty divider.

## B5. Semantic separator

If `GraphContextMenu` currently accepts only actions, minimally extend the menu model to support a real separator, e.g. conceptually:

```ts
type GraphContextMenuItem =
  | Action
  | { kind: 'separator'; emphasis: 'strong' };
```

Do not fake a divider using a disabled action containing dashes.

---

# C. Folder context menu

Right-clicking a folder guide region or folder label:

```text
folder actions only
```

Do not prepend File actions.

Pointer and keyboard invocation on the folder label must produce the same folder menu.

Future `Hide` may exist for both Files and folders, but that is explicitly deferred.

---

# D. Keyboard and focus

Preserve shared Network-style menu behavior.

File:

```text
right-click
Shift+F10
ContextMenu/Menu key
→ same composed File + displayed-folder menu
```

Folder label:

```text
right-click
Shift+F10
ContextMenu/Menu key
→ same folder-only menu
```

Empty folder space has no keyboard focus target; the folder label remains the accessible keyboard entry.

Preserve:

- viewport-bounded menu;
- outside dismissal;
- Escape;
- focus restoration.

For empty-space pointer menus, do not invent focus on an invisible hull.

---

# E. Folder label cleanup

## E1. Primary visible label

Use only the final folder segment.

Example:

```text
Pattern Theory/Models/
```

visible primary label:

```text
Models
```

not the whole path.

## E2. Optional parent hint

If useful:

```text
Models
Pattern Theory
```

where parent is smaller/quieter.

Do not show full path.

If root/no useful parent:

```text
omit parent hint
```

## E3. Exact path remains accessible

Keep normalized workspace-relative full folder key in:

- title/tooltip;
- ARIA label;
- context menu target naming;
- dev diagnostics.

Never show absolute filesystem paths.

---

# F. Remove Island X/Y

Normal product labels must not contain:

```text
Island 1 of 2
Island 2 of 2
```

Disconnected islands may repeat the same folder short name.

Island number/count can remain internal dev evidence only.

---

# G. Nesting depth presentation

Add explicit **display hierarchy depth** metadata after promotion/flatten/compression.

Example convention:

```text
top-level rendered folder = depth 1
child = depth 2
grandchild = depth 3
```

Zero-based is also acceptable; pick one and document it.

Use depth for:

- CSS/data attribute;
- subtle border/fill differences;
- optional bounded padding treatment.

Example:

```html
data-folder-depth="3"
```

Depth must reflect the **displayed hierarchy**, not canonical source depth.

Cap styling after a reasonable level such as `3+`.

### Visible depth text

Preferred default:

```text
FolderName
optional ParentName
```

and depth conveyed visually.

If current Experimental label needs secondary metadata and no parent hint is shown, a concise:

```text
Nested 3
```

is acceptable.

Hard:

```text
no Island X/Y
```

Do not show all metadata simultaneously.

---

# H. Hover behavior

Preserve existing FIX2:

```text
hover/focus child folder
→ child emphasized
→ parent emphasized/revealed
→ siblings emphasized
→ compressed ancestry understandable
```

The new folder-area context hit testing must **not** make the full hull an ordinary hover interceptor.

Hover remains zero-layout.

---

# I. Folder Guides Off

When Folder Guides are Off:

```text
empty-space folder hit testing
→ disabled
```

because no guide regions are displayed.

File right-click should still include containing-folder actions because the Soft display hierarchy still exists.

---

# J. Directional isolation

All new behavior is Soft-only.

Directional Bands:

- keep exact horizontal strips;
- keep exact folder labels/behavior unless a truly shared helper changes only presentation safely;
- no new empty-strip right-click in this task;
- no Soft display intent effect;
- byte-identical HIER4A layout oracle must pass.

---

# K. Zero-layout interaction rules

These cause **zero worker/layout/cache work**:

- opening/closing context menu;
- folder-area hit testing;
- folder hover;
- menu separator rendering;
- label shortening;
- island-text removal.

Executing an existing display action such as:

```text
Move File up
Flatten folder
Restore
```

still legitimately triggers Soft relayout.

Do not add menu/hover state to layout cache identity.

---

# L. Tests — folder hit testing

Add focused tests:

```text
HT1 one folder: inside → hit, outside → null
HT2 nested parent/child: child area → child
HT3 parent-only area → parent
HT4 depth 3+
HT5 disconnected islands → same logical folder
HT6 same-depth overlap → smaller area then stable tie-break
HT7 pan/zoom coordinate conversion
HT8 File target beats folder-area hit
HT9 folder label targets exact folder
HT10 Folder Guides Off → no empty-area hit
```

Use actual region geometry shape where possible, not only rectangle bounds.

---

# M. Tests — File menu composition

```text
MC1 File actions + folder actions
    → strong separator between

MC2 File actions only
    → no separator

MC3 folder actions only
    → no leading separator

MC4 promoted File
    → folder section targets displayed parent

MC5 singleton-compressed File
    → folder section targets displayed parent

MC6 root/no displayed parent
    → no folder section

MC7 Shift+F10 menu equals pointer menu
```

Assert there are no visible text group headings.

---

# N. Tests — folder menu

```text
FM1 folder empty-area right-click → folder actions only
FM2 folder label right-click → same logical actions
FM3 keyboard folder menu → same actions
FM4 existing flatten/sibling/restore semantics unchanged
FM5 guide hull ordinary pointer behavior remains non-blocking
```

---

# O. Tests — labels and nesting

```text
L1 Pattern Theory/Models/ → visible "Models"
L2 optional parent hint → "Pattern Theory"
L3 full normalized path remains in accessibility/title
L4 product text contains no "Island"
L5 two islands repeat same short folder label
L6 depth updates after manual flatten
L7 depth updates after singleton compression
L8 depth style caps at configured 3+ level
```

---

# P. Existing regression suite

Re-run all current HIER4B/HIER4A gates for:

- nested display hierarchy;
- File promotion;
- folder flattening;
- sibling flattening;
- restore;
- singleton compression;
- H1 attraction;
- strengths 0/25/50/75/100;
- parent/sibling hover;
- four-side File ports;
- Direct/Electronic handle parity;
- Secondary;
- reroot;
- File hide/restore;
- Heading disclosure;
- latest-result-wins;
- Directional byte identity.

Do not change spacing in this task.

---

# Q. Browser QA

Verify actual app:

```text
Modular Preview
→ Soft Folder Clusters
→ Folder Guides On
```

Check:

1. right-click blank interior of a parent guide → parent menu;
2. right-click blank interior of nested child guide → child menu;
3. right-click File → File actions, stronger divider, displayed-folder actions;
4. right-click folder → folder actions only;
5. no text action-group headings;
6. pan/zoom and repeat;
7. normal clicks/pan inside guide still work;
8. folder names are short;
9. optional parent is short;
10. no `Island X of Y`;
11. nesting remains visually obvious;
12. keyboard File/folder menus still work.

---

# R. Optimized desktop QA

After all automated/browser checks:

```text
pnpm desktop:check
pnpm desktop:build
```

Launch fresh optimized executable.

Ask user specifically to evaluate:

```text
A. empty folder whitespace right-click
B. deepest nested target
C. File menu top + strong divider + folder bottom
D. folder menu only
E. short labels / optional parent
F. no Island text
G. nesting depth readability
H. no normal interaction blocking
```

Do not merge before approval.

---

# S. Explicit later tasks

Update HIER4B development notes with:

## HIER4B-SPACING — later

```text
Use more available canvas.
Spread Files/modules more.
Reduce cramped interiors.
Evaluate after folder semantics are frozen.
```

Do not implement now.

## MODULAR-CONTEXT1 — later

Extend the same menus with:

```text
File:
Focus
Inspect
Hide File
...

strong divider

Containing folder:
Hide Folder
folder display controls
...

Folder region:
folder actions only
including Hide Folder later
```

Do not implement now.

---

# Likely implementation areas

Inspect current branch rather than assuming filenames.

Likely seams include:

```text
apps/web/src/components/ModularStructuredGraphView.tsx
FocusSchematicFolderClusterGuides
soft-folder-display/context-menu
GraphCanvas
GraphContextMenu
renderer-reactflow context menu item types
nested guide region geometry helpers
```

Prefer pure helpers for:

```text
world-space folder-region hit testing
File+folder menu composition
short folder label derivation
display-depth presentation
```

Do not move this logic into `GraphExplorer` unless it already owns the relevant state cleanly.

---

# Suggested implementation order

1. Inspect current `9cd8e7d...`.
2. Add failing empty-guide context hit test.
3. Add world-space region hit-test helper.
4. Wire background `contextmenu` with correct event priority.
5. Add composed File + folder menu with strong separator.
6. Keep folder menu folder-only.
7. Shorten labels.
8. remove visible Island wording.
9. add display-depth metadata/style.
10. run focused tests.
11. run full HIER4B regressions.
12. run `pnpm check`.
13. run desktop check/build.
14. launch optimized `.exe`.
15. report exact path + concise QA checklist.
16. STOP.

No PR, merge, spacing redesign, or MODULAR-CONTEXT1 implementation.

---

# Validation commands

Use repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm --filter @icarus-graph-explorer/focus-schematic-layout typecheck
pnpm exec vitest run packages/focus-schematic-layout

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No new dependency expected.

---

# Hard exit gates

FIX3 is ready for user QA only when:

1. current HIER4B branch preserved;
2. no PR;
3. no merge;
4. folder-label right-click still works;
5. empty guide-area right-click works;
6. guide fill remains ordinary-pointer inert;
7. File target beats folder target;
8. child guide beats parent guide;
9. parent-only area targets parent;
10. depth 3+ works;
11. islands hit correctly;
12. same-depth overlap deterministic;
13. pan/zoom conversion correct;
14. Guides Off disables empty-area folder hit;
15. File menu is one composed menu;
16. File actions above;
17. folder actions below;
18. strong divider only when needed;
19. no textual section heading;
20. lower section targets displayed containing folder;
21. auto-compressed File uses displayed parent;
22. root case has no empty divider;
23. folder menu is folder-only;
24. pointer/keyboard File menu parity;
25. pointer/keyboard folder-label parity;
26. Escape/outside dismissal preserved;
27. focus restoration preserved;
28. visible folder label is short basename;
29. optional parent hint is short only;
30. full path absent from visible label;
31. full normalized key remains accessible;
32. no absolute path exposed;
33. no visible `Island X of Y`;
34. depth metadata exists;
35. depth is displayed-hierarchy depth;
36. depth updates after flatten/compression;
37. depth styling bounded;
38. parent/sibling hover preserved;
39. hover/menu open = zero layout;
40. display actions still relayout correctly;
41. nested hierarchy unchanged;
42. singleton compression unchanged;
43. H1 attraction unchanged;
44. four-side Soft ports unchanged;
45. Direct/Electronic parity unchanged;
46. Secondary unchanged;
47. Directional output byte-identical;
48. reroot passes;
49. hide/restore passes;
50. Heading disclosure passes;
51. latest-result-wins passes;
52. no new dependency;
53. full `pnpm check` passes;
54. desktop check/build passes;
55. optimized desktop launches;
56. privacy preserved;
57. HIER4B-SPACING recorded only;
58. MODULAR-CONTEXT1 recorded only;
59. prompt archived with SHA-256;
60. stop for graphical QA.

---

# Documentation

Update development/validation docs only.

Archive this exact prompt as:

```text
history-implementations/HIER4B_FIX3_folder_area_context_labels_codex_prompt.md
```

Record SHA-256.

Do not mark HIER4B complete.

---

# Final report format

## Branch / commit

## Folder-area hit testing

## File menu composition

## Folder-only menu

## Labels

## Nesting-depth presentation

## Regression status

## Tests

## Privacy

## Optimized desktop path

## User QA checklist

## Later
- HIER4B-SPACING
- MODULAR-CONTEXT1

Then stop.

No PR or merge.
