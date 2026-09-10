# HIER4B-POLISH1 — Hide Empty Module Boundaries + Make Folder Labels Visually Passive

**Task type:** Narrow visual-semantic cleanup on the current unmerged HIER4B branch.

## Goal

Continue:

```text
branch: codex/hier4b-soft-folder-clusters
baseline: 013e618f43d4649c5abb59f90c8738dcf01b2d2b
```

Implement **only these two corrections**:

1. Hide the faint File-module boundary when the module currently contains only the File and no visible Heading/Block descendants.
2. Make Soft folder labels look like plain labels rather than pill-buttons, while preserving keyboard accessibility and the existing context-menu behavior.

Do not change Soft clustering, island splitting, spacing, folder-force logic, nested hierarchy semantics, context-menu actions, routing, or adoption status.

No PR or merge. Commit and push to the same branch, validate, and stop.

---

# A. Hide empty File-module boundaries

The existing modular renderer still draws a faint gray rounded module boundary around every File module. That boundary is useful only when it visually groups:

```text
File
+ visible Heading(s)
+ visible Block(s)
```

When no structural descendants are visible, the extra gray border communicates nothing.

Required behavior:

```text
File only
→ module boundary invisible

File + ≥1 visible Heading or Block
→ module boundary visible
```

Apply this to root and non-root Files.

The Focus/root File already has its own File styling; do not keep an empty module boundary just to mark the root.

## Presentation-only invariant

Do **not** remove the module from layout or semantic structures if it is structurally required.

Boundary visibility must not affect:

- module dimensions;
- node positions;
- Adaptive Compass;
- Soft macro layout;
- folder-guide geometry;
- exact endpoint attachment;
- worker request/result;
- layout/cache identity.

Prefer an explicit typed renderer presentation flag such as:

```ts
hasVisibleStructuralDescendants
```

or:

```ts
showVisualBoundary
```

rather than guessing from geometry/CSS.

The criterion is only currently visible structural descendants:

```text
visible Heading count + visible Block count
```

Do not use:

- revealable-but-collapsed descendants;
- total authored Heading count;
- reference count;
- direct-File ring;
- external connections.

Expand/collapse behavior:

```text
collapsed File only
→ no boundary

expand Heading(s)
→ boundary appears

collapse all structural descendants
→ boundary disappears again
```

The boundary must remain pointer-inert whether visible or hidden.

---

# B. Make Soft folder labels visually passive

The current primary Soft folder label remains a keyboard-focusable control styled like a button/pill:

```text
white background
dashed border
rounded pill
shadow
pointer cursor
```

This is now misleading because folder management is available by right-clicking the folder region itself.

Required normal appearance:

```text
plain folder text
transparent background
no persistent border
no pill
no box shadow
no button-like pointer cursor
```

Preserve:

- short folder name;
- optional quiet parent hint;
- exact normalized path in title/ARIA/dev metadata;
- right-click on folder label;
- right-click on empty folder guide region;
- deepest-folder area hit testing;
- Shift+F10 / ContextMenu key on focused folder label;
- focus restoration.

## Accessibility

The label must remain keyboard-focusable.

It may remain a `<button>` internally if that is the cleanest accessible primitive, but it must not *look* like a normal button in its default state.

Use:

```text
normal
→ plain label

hover
→ subtle text emphasis only

focus-visible
→ clear accessibility outline/underline/focus ring
```

A temporary visible focus indicator is correct. A permanent pill is not.

Do not add a left-click action if none exists.

## Multiple rendered regions

Do not change island behavior in this task.

If one logical folder currently has multiple rendered regions:

- the primary interactive label should use the new passive style;
- repeated non-interactive labels should visually match it as closely as practical;
- do not leave one bright pill while other labels are plain.

---

# Explicit non-scope

Do not touch:

```text
splitIntoIslands
GUIDE_ISLAND_GAP
same-folder disconnected-region policy
Soft spacing
hierarchical attraction
singleton compression
File/folder promotion semantics
context-menu contents
HIER4B-SPACING
MODULAR-CONTEXT1
HIER5
HIER3C
```

This should be safe to run in parallel while Soft clustering is redesigned separately.

---

# Tests

Add focused regression coverage.

## Module boundary

1. File-only module → boundary hidden.
2. File + visible Heading → boundary visible.
3. File + visible Block → boundary visible.
4. Authored/revealable but collapsed Heading → boundary hidden.
5. Expand → hidden to visible.
6. Collapse all → visible to hidden.
7. Root File-only module → hidden.
8. Geometry/layout output identical when only boundary visibility changes.

## Folder label

9. Primary Soft folder label has no persistent pill background/border/shadow.
10. Label remains keyboard-focusable.
11. Focus-visible state remains clear.
12. Shift+F10 / ContextMenu key still opens folder menu.
13. Right-click label still opens the same folder menu.
14. Empty folder-area right-click still works.
15. Deepest nested folder targeting is unchanged.
16. Parent hint remains subtle.
17. Repeated/non-primary labels do not conflict visually with the primary label.

---

# Regression checks

Re-run relevant existing tests for:

- nested guides;
- singleton compression;
- File promotion;
- folder flattening;
- folder-area context hit testing;
- File + containing-folder composed menu;
- folder-only menu;
- parent/sibling hover;
- four-side File ports;
- Direct/Electronic parity;
- Directional Bands isolation;
- Heading disclosure;
- latest-result-wins.

No Soft clustering or benchmark redesign is required, but current hard gates must still pass.

---

# Browser QA

In:

```text
Modular Preview → Soft Folder Clusters
```

verify:

1. File with no visible Headings/Blocks has no faint gray module box.
2. Expand a Heading → module boundary appears around File + structure.
3. Collapse all → boundary disappears.
4. Root File follows same rule.
5. Folder names look like plain labels, not pills.
6. Keyboard focus still produces a clear focus indication.
7. Shift+F10 still opens the folder menu.
8. Right-click folder whitespace still works.
9. Normal pan/click/edge behavior remains unchanged.

---

# Validation

Use repository-current equivalents:

```bash
pnpm install --frozen-lockfile

pnpm --filter @icarus-graph-explorer/renderer-reactflow typecheck
pnpm exec vitest run packages/renderer-reactflow

pnpm --filter @icarus-graph-explorer/web typecheck
pnpm exec vitest run apps/web

pnpm check
pnpm desktop:check
pnpm desktop:build

git diff --check
```

No new dependency.

---

# Hard exit gates

1. Empty File-module boundary hidden.
2. Boundary visible when Heading/Block structure is visible.
3. Expand/collapse updates correctly.
4. Root follows same rule.
5. Suppression is presentation-only.
6. Layout/cache/worker behavior unchanged.
7. Folder labels no longer look like buttons in normal state.
8. Keyboard focus remains visible.
9. Shift+F10 / Menu key works.
10. Folder-label right-click works.
11. Empty-area folder right-click works.
12. Deepest-folder hit testing unchanged.
13. No context-menu action changes.
14. No island/splitting changes.
15. No Soft spacing/force/layout changes.
16. Directional Bands unchanged.
17. No new dependency.
18. Full checks pass.
19. Desktop build passes.
20. Commit pushed to same HIER4B branch.
21. No PR or merge.
22. Prompt archived with SHA-256.
23. Stop.

---

# Prompt archive

Archive this exact prompt as:

```text
history-implementations/HIER4B_POLISH1_empty_module_boundaries_passive_folder_labels_codex_prompt.md
```

Record SHA-256.

---

# Final report

Return:

## Branch / commit
## Empty module-boundary behavior
## Passive folder-label behavior
## Accessibility/context-menu regression
## Tests / validation
## Desktop build path
## Prompt archive SHA

Then stop.

Do not start any Soft clustering redesign.
