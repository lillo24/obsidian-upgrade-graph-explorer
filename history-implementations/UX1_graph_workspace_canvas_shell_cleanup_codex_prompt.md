# UX1 — Graph Workspace / Canvas Mode + Shell Cleanup

## Goal

Turn the current diagnostic-looking page into a **graph-first workspace**.

The first real-vault test showed four immediate problems:

1. Graph cannot occupy the whole useful screen.
2. Inspector permanently consumes width.
3. Large titles/descriptions/status messages waste graph space.
4. Development/diagnostic information is being displayed as normal product UI.

This task fixes those problems **without changing graph semantics**.

## Important parallel-work constraint

Develop this from the latest `main`.

At the time of this prompt, `main` is:

```text
72cce84dcca529ae0fd43e2071d848c26ec2eae5
```

which contains merged KG9B.

This branch may be developed while KG10 is happening elsewhere.

Therefore:

* stay primarily inside `apps/web`;
* don't modify parsing, resolution, identity, projection or persistence contracts;
* don't begin KG10 work;
* don't refactor unrelated APIs;
* before the PR is merged, rebase onto latest `main`;
* if KG10 also changed a web file, reconcile the changes deliberately.

No new skill or dependency should be necessary.

---

# 1. Maximized Graph Mode

Add a compact button such as:

**Maximize Graph**

It should make the **Graph Explorer workspace itself fill essentially the whole browser viewport**.

Do **not** use the browser Fullscreen API. This should be an application UI mode.

Conceptually:

```text
Normal
┌────────────────────────────────────────────┐
│ compact app bar                            │
├────────────────────────────────────────────┤
│ graph                                      │
│                                            │
├────────────────────────────────────────────┤
│ optional diagnostics                       │
└────────────────────────────────────────────┘


Maximized
┌────────────────────────────────────────────┐
│ graph controls                    Exit ⛶   │
├────────────────────────────────────────────┤
│                                            │
│                                            │
│                GRAPH                       │
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

Requirements:

* workspace fills `100dvh` / viewport;
* hide all surrounding page chrome while maximized;
* graph takes all remaining height after its compact controls;
* prevent the page behind it from scrolling;
* restore scrolling after exit;
* visible Exit button;
* `Escape` exits;
* accessible toggle state (`aria-pressed` or equivalent).

### Critical

**Do not remount `GraphCanvas` when maximizing.**

Maximize/minimize must preserve:

* zoom/pan;
* selected node/edge;
* Focus mode;
* expanded sections;
* filters;
* KG9 persisted graph state.

Do not automatically `fitView()` just because the container changed size unless actual testing proves it is needed.

---

# 2. Collapsible Inspector

The current layout permanently allocates roughly `22–28rem` to the Inspector.

Add an **Inspector** toggle.

### Default

Inspector should start **closed**.

When closed:

```text
┌─────────────────────────────────────┐
│                GRAPH                │
└─────────────────────────────────────┘
```

When open:

```text
┌───────────────────────┬─────────────┐
│ GRAPH                 │ INSPECTOR   │
│                       │             │
└───────────────────────┴─────────────┘
```

Requirements:

* closing it must remove its column entirely;
* canvas gets that width back immediately;
* selected node/edge remains selected;
* selecting another item while Inspector is closed must **not automatically reopen it**;
* reopening Inspector shows the current selection;
* Inspector state is transient UI state.

Do **not** add Inspector visibility to the KG9 persisted-view schema.

On narrow screens, don't permanently compress the graph to an absurd width. Prefer an overlay/drawer or usable stacked behavior.

Test around `390px`.

### Do not clean Inspector content yet

IDs, source spans, etc. remain for now.

That is **UX2**.

---

# 3. Remove the giant diagnostic/product chrome

The current `App.tsx` still contains a large product hero:

* `Local-first · Read-only`
* huge `Icarus Graph Explorer`
* explanatory paragraph
* large report-loader block
* privacy paragraph

and the graph itself adds:

* `KG9 · Durable Local View`
* `Knowledge Graph`
* node/edge status
* persistence status paragraph
* navigation status paragraph

plus a KG milestone footer.

This made sense as a development explorer. It should no longer be the default product interface.

### Replace the top area with a compact app bar

Something approximately like:

```text
Icarus Graph Explorer     Open Report   Sample     icarus-report.json
```

Exact styling is flexible.

Keep:

* load report;
* restore synthetic sample;
* current report filename;
* report-load errors.

Move/hide:

* large title;
* explanatory descriptions;
* permanent privacy paragraph;
* development labels.

The privacy fact can remain somewhere subtle/help-like, but shouldn't consume permanent vertical space.

### Graph heading

Remove:

```text
KG9 · Durable Local View
Knowledge Graph
```

Node/edge counts can remain as a small compact indicator.

### Footer

Remove the permanent text describing KG9/KG11.

Repository milestone information belongs in documentation, not product chrome.

---

# 4. Remove permanent status chatter

Current GraphExplorer visibly renders messages such as:

* saved graph state restored;
* entered/exited Focus;
* search navigation succeeded;
* saved view reset.

Those messages are useful for accessibility/debugging, but not as permanent UI rows. The current implementation explicitly maintains `persistenceStatus` and `navigationStatus`, so this can be cleaned without touching the graph model.

### Normal successful actions

Keep them in `aria-live` for accessibility, but make them visually hidden or transient.

### Real problems

Keep visible compact alerts for:

* projection failure;
* report validation/load failure;
* persistence/storage failure;
* another condition requiring user attention.

Prefer an explicit warning/error state rather than checking whether a string happens to contain `"failed"`.

---

# 5. Compact the existing graph controls

Do **not change their behavior yet**.

Still retain:

* Search;
* Documents / Top-Level structure controls;
* Blocks;
* Focus;
* Focus hops/direction;
* Filters;
* Reset saved view;
* node/edge count;
* new Inspector toggle;
* new Maximize toggle.

But the interface should prioritize:

```text
Canvas
↓
Controls
↓
Everything else only when requested
```

Search currently has its own substantial explanatory area. It can become much more compact while idle.

Search results can expand when the user actually searches.

Filters already use a collapsible `<details>`-style design, which is directionally correct.

---

# 6. Keep Diagnostic Evidence, but demote it

Do not delete the existing KG5 diagnostic explorer.

Keep:

**Inspect diagnostic evidence**

collapsed by default below the main graph in normal mode.

In maximized graph mode, it must consume **zero space**.

Do not redesign:

* SummaryPanel;
* HierarchyPanel;
* ReferencesPanel;
* EvidencePanel.

This is still valuable developer/debug information; it just isn't the main application.

---

# Layout direction

Current graph stage uses a fixed-ish layout with:

```css
min-height: 38rem;
grid-template-columns: minmax(0, 1fr) minmax(22rem, 28rem);
```

which contributes directly to the current workspace problem.

Refactor toward a flexible viewport-driven structure.

Likely:

```text
graph-workspace
├── compact controls       height = content
└── graph-stage            flex = remaining space
    ├── canvas
    └── optional inspector
```

Pay attention to:

```css
min-height: 0;
min-width: 0;
height: 100%;
```

where nested grid/flex containers require them.

The React Flow container must always have a measurable height.

---

# Prefer touching

```text
apps/web/src/App.tsx
apps/web/src/App.css
apps/web/src/components/GraphExplorer.tsx
```

Potentially small web-only helpers/tests.

Read before modifying:

```text
ProvenanceInspector.tsx
EntitySearch.tsx
GraphFilters.tsx
GraphCanvas.tsx
```

but avoid changing renderer behavior unless required for resizing.

---

# Do NOT touch

Unless an unavoidable bug is discovered:

```text
packages/core
packages/view-projection
packages/view-state
packages/stable-identity
packages/explorer-inspection
parser/resolver packages
diagnostic schema
canonical model
```

No graph semantics should change.

---

# Explicitly out of scope

Do **not** sneak the other feedback into this PR.

### UX2 later

Inspector cleanup:

* hide IDs;
* simplify backlinks;
* simplify connection explanation;
* Technical Details disclosure.

### UX3 later

Interaction changes:

```text
Hover → fade unrelated nodes
Click → selection only, no persistent fade
Focus → actual graph isolation
```

and better structural-depth controls.

### PERF1 / KG12 later

* Dagre optimization;
* workers;
* layout caching;
* renderer optimization.

Also out:

* Tauri;
* direct vault watching;
* source previews;
* open in Obsidian;
* new renderer;
* pins/manual positions.

---

# Tests

At minimum test these.

### Maximize

* button enters maximized mode;
* Escape exits;
* exit button exits;
* body scrolling restored after exit;
* graph state isn't cleared;
* selection isn't cleared.

### Inspector

* closed by default;
* opens;
* closes;
* selection survives closing;
* selecting something else doesn't force it open;
* reopening shows current selection.

### Status

* ordinary navigation/persistence status doesn't permanently occupy visible space;
* actual warning/error remains visible.

### Report loading

* JSON report loading still works;
* synthetic sample still works;
* current report name still appears.

Avoid brittle exact-pixel tests.

---

# Browser QA

Use both synthetic and ignored real Icarus reports.

Desktop workflow:

```text
load report
→ maximize
→ zoom/pan
→ expand sections
→ Focus
→ search
→ filters
→ select node
→ open Inspector
→ close Inspector
→ select another node
→ reopen Inspector
→ Escape
```

Ensure nothing unexpectedly resets.

Also test around `390px`.

Specifically verify:

* no horizontal page overflow;
* Inspector doesn't destroy graph width;
* maximize button remains reachable;
* Exit remains reachable.

### KG9 regression

With a stable real report:

1. modify disclosure/filter/focus/viewport;
2. reload;
3. confirm KG9 restoration still works.

Maximized/Inspector-open shell state does **not** need to persist.

---

# Validation

Run:

```bash
pnpm check
git diff --check
```

No new package dependency expected.

No performance budget for this UX pass, but don't introduce resize loops or repeated graph layout work.

---

# Exit gate

Do not call UX1 complete until:

* [ ] graph has a viewport-filling maximized mode;
* [ ] Escape exits it;
* [ ] maximize doesn't reset graph viewport/state;
* [ ] Inspector is collapsible;
* [ ] Inspector defaults closed;
* [ ] closed Inspector returns its width to canvas;
* [ ] selection survives Inspector close;
* [ ] selection doesn't force Inspector open;
* [ ] giant hero UI is removed;
* [ ] report loading remains easy;
* [ ] report filename remains visible;
* [ ] KG development labels disappear from normal UI;
* [ ] permanent milestone footer disappears;
* [ ] success/status chatter doesn't take permanent rows;
* [ ] actual failures remain visible;
* [ ] diagnostic evidence remains available but collapsed;
* [ ] diagnostics disappear from maximized mode;
* [ ] Search semantics unchanged;
* [ ] Focus semantics unchanged;
* [ ] filtering semantics unchanged;
* [ ] KG9 persistence unchanged;
* [ ] no core/schema changes;
* [ ] no unnecessary dependency;
* [ ] desktop QA passes;
* [ ] 390px QA passes;
* [ ] `pnpm check` passes;
* [ ] `git diff --check` passes;
* [ ] branch is rebased with latest `main`.

## Final Codex report

Return:

1. Summary
2. PR + merge commit
3. Files changed
4. Maximized-mode behavior
5. Inspector-collapse behavior
6. UI/chrome removed
7. Status/error behavior
8. Responsive behavior
9. Diagnostics still available
10. Tests
11. Browser QA
12. Dependencies
13. Merge/rebase conflicts with parallel KG work
14. Deviations
15. UX2 handoff

**Do not begin UX2 automatically.**