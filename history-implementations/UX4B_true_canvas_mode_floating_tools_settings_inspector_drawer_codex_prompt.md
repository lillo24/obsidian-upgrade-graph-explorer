# UX4B — True Canvas Mode + Floating Tools + Inspector Drawer + Input Settings

## Task type

Graph workspace shell / maximized-canvas UX / lightweight application preferences.

This is **UX4B**. It builds directly on UX4A and must not include broad performance work.

## Starting point

Use the latest `main` of `lillo24/icarus-graph-explorer`.

At the time this prompt was prepared, `main` is:

`9d9f41ea7845627e587fb5f68bbd00e65ebc08b6`

This includes UX1–UX4A plus the current desktop/local-vault work already merged before UX4A.

UX4B changes the meaning/presentation of the existing maximized mode:

> Maximized mode must become a **true canvas-only workspace**.

The graph itself should own essentially the entire app content area, with controls floating above it only when needed.

---

# User goals

## Canvas mode

Current maximized mode still contains Search, toolbar and Filters as permanent rows. Replace that with:

```text
┌─────────────────────────────────────────────────────┐
│ [Tools] [⚙]                                        │
│                                                     │
│                                                     │
│                    GRAPH CANVAS                     │
│                                                     │
│                                               [›]   │ ← Inspector handle
│                                                     │
│ +                                                   │
│ −                                                   │
│ Fit                                                 │
│ Restore                                             │
└─────────────────────────────────────────────────────┘
```

No permanent Search row. No permanent Structure/Heading/Focus toolbar. No permanent Filters row. No Inspector column reducing canvas width.

## New Settings requirement

Add the first real **Settings** control.

Immediate setting: **Trackpad zoom behavior**.

Two modes:

### 1. Scroll to zoom

Current UX4A behavior:

```text
two-finger swipe up/down → zoom
mouse wheel → zoom
physical pinch → zoom
```

### 2. Pinch to zoom

More conventional touchpad behavior:

```text
fingers apart/together → zoom
two-finger scroll → pan canvas
mouse wheel → pan canvas
```

On Chromium/WebView2, precision-touchpad pinch is normally surfaced to web content as a ctrl-modified wheel gesture. Use that event distinction rather than OS/device sniffing.

The setting must work in both browser and Windows Tauri.

---

# Product rules

## Normal workspace

Normal/non-maximized mode can remain broadly similar to today:

```text
Search
Toolbar
Filters
Graph + optional Inspector column
```

Add a compact Settings button, but do not redesign ordinary mode again.

## Canvas mode

Canvas mode must prioritize:

1. graph;
2. bottom-left viewport controls;
3. small floating Tools/Settings controls;
4. optional right overlay Inspector drawer.

Nothing else should permanently consume graph layout space.

---

# Part A — True canvas-only maximized mode

## 1. Canvas owns the flow layout

Current `graph-workspace--maximized` fills the viewport but Search, `.graph-toolbar`, and `GraphFilters` still occupy flex rows.

Change this so that in maximized mode:

- graph stage fills the entire workspace;
- Search/toolbar/filters consume **zero layout height**;
- graph canvas is not pushed down by controls;
- viewport dimensions are effectively the full app content surface.

Do not use the browser Fullscreen API. This remains application-level canvas mode.

## 2. Reuse existing capability/state

Do not duplicate graph logic.

Existing controls already own correct behavior:

- `EntitySearch`;
- structural depth;
- Blocks;
- Heading limit;
- Focus;
- Filters;
- Reset saved view;
- counts.

Prefer repositioning/composing those same capabilities in a floating surface. If a component needs a compact/overlay variant, add a small presentation prop/class rather than forking its logic.

Avoid mounting two independently stateful Search implementations if that would make query/reset/navigation diverge.

---

# Part B — Floating Tools surface

## 3. Collapsed Tools control

In maximized mode show a small floating control near top-left:

```text
[☰ Tools]
```

Requirements:

- always reachable;
- overlays canvas instead of consuming layout space;
- minimum ~44px interactive target where practical;
- clear tooltip/aria label;
- does not overlap bottom-left React Flow controls.

Default on entering canvas mode: **Tools closed**.

## 4. Tools opens a floating panel

Conceptually:

```text
┌────────────────────────────────────┐
│ Tools                         [×]   │
│                                    │
│ Search                             │
│ [________________________]         │
│                                    │
│ Structure                          │
│ Documents  Top-Level  Blocks       │
│ Headings [# / ## / ...]            │
│                                    │
│ Focus                              │
│ Focus Selected / hops / direction  │
│                                    │
│ ▸ Filters                          │
│                                    │
│ 154 nodes · 220 edges              │
│ Reset saved view                   │
└────────────────────────────────────┘
```

Requirements:

- panel overlays graph;
- canvas size does not change;
- bounded width and height;
- panel body scrolls internally;
- no page-level scrolling;
- search results remain inside/attached to panel rather than pushing graph;
- Filters remain collapsible.

Suggested desktop width:

`min(42rem, calc(100vw - 2rem))`

At ~390px, use nearly full available width with safe insets and internal scrolling.

## 5. Tools state is transient

Do not add Tools-open state to per-vault KG9 persistence.

On enter maximize: closed.
On restore: close it.
Do not persist across reloads.

---

# Part C — Settings + app preferences

## 6. Settings button

Add a conventional gear icon button accessible in:

- normal workspace;
- maximized canvas mode.

Normal mode: compactly in workspace controls.

Maximized mode:

```text
[Tools] [⚙]
```

Settings must remain accessible even when Tools is collapsed.

Use inline SVG; no icon dependency.

## 7. Settings popover

Initial Settings surface should remain intentionally small:

```text
┌───────────────────────────────┐
│ Settings                 [×]  │
│                               │
│ Trackpad zoom                  │
│                               │
│ ● Scroll to zoom              │
│   Swipe/scroll to zoom.       │
│                               │
│ ○ Pinch to zoom               │
│   Pinch to zoom; scroll pans. │
└───────────────────────────────┘
```

Do not invent unrelated settings.

## 8. Preference contract

Define a small explicit type, e.g.:

```ts
export type TrackpadZoomMode =
  | 'scroll-zoom'
  | 'pinch-zoom';
```

Default:

`'scroll-zoom'`

This preserves UX4A behavior for existing users. Switching should take effect immediately.

---

# Part D — Exact gesture semantics

## 9. Scroll-to-zoom mode

Mode: `scroll-zoom`.

Preserve UX4A exactly:

- custom non-passive wheel handler owns ordinary wheel/two-finger scroll;
- wheel delta zooms;
- ctrl-modified precision-touchpad pinch zooms;
- focal point remains fixed;
- `GRAPH_ZOOM_SENSITIVITY = 1.8`;
- no browser page zoom;
- semantic viewport observation remains debounced.

## 10. Pinch-to-zoom mode

Mode: `pinch-zoom`.

### ctrl-modified pinch signal

If `event.ctrlKey === true`, use the existing UX4A focal zoom math.

Keep:

- sensitivity `1.8`;
- focal-point preservation;
- min/max zoom;
- `preventDefault()` to block page zoom;
- viewport persistence debounce.

### ordinary wheel/two-finger scroll

If `event.ctrlKey === false`, do **not** zoom.

Instead:

```text
deltaX / deltaY → pan canvas
```

Prefer React Flow's public pan-on-scroll behavior if it cleanly supports this:

```tsx
panOnScroll={trackpadZoomMode === 'pinch-zoom'}
zoomOnScroll={false}
```

while the custom wheel handler intercepts only ctrl-modified zoom gestures in `pinch-zoom` mode.

If React Flow built-in panning conflicts with the existing listener, resolve event ownership cleanly. Do not implement simultaneous pan paths.

Mouse wheel in `pinch-zoom` mode should pan rather than zoom.

## 11. Preserve touch/pointer pinch

Keep React Flow `zoomOnPinch` enabled for true touch/pointer pinch behavior.

Do not disable touchscreen pinch.

## 12. No device sniffing

Do not branch on OS, browser, touchpad model, or Tauri user-agent.

The explicit setting controls behavior.

---

# Part E — Preference persistence

## 13. Global app preference, not vault state

Trackpad zoom mode is not a property of a vault.

Do not put it in:

- `ViewProjectionState`;
- KG9 persisted workspace view;
- canonical snapshot;
- report JSON.

Create a lightweight app preference layer in `apps/web`, e.g.:

```text
apps/web/src/preferences/
  graph-preferences.ts
  graph-preferences.test.ts
```

## 14. Persist locally

Suggested storage key:

`icarus.graph-explorer.preferences.v1`

Payload:

```json
{
  "trackpadZoomMode": "scroll-zoom"
}
```

Validate defensively.

Absent/malformed/invalid values fall back to defaults without throwing.

## 15. Storage failure

If local storage is unavailable or write fails:

- setting still changes in memory for current session;
- show a small warning inside Settings:

```text
Could not save this setting; it will reset when the app closes.
```

Do not create a giant graph alert.

## 16. Browser + Tauri persistence QA

Browser:

- choose Pinch to zoom;
- reload;
- preference restores.

Tauri:

- choose Pinch to zoom;
- close/reopen desktop app;
- preference restores if WebView local storage persists normally.

If Tauri persistence fails, investigate first and add the smallest app-local fallback only if needed. Do not create a broad desktop settings backend without evidence.

---

# Part F — Maximized Inspector as overlay drawer

## 17. Normal mode remains split-pane

Outside maximized mode, retain:

```text
[ graph ][ Inspector ]
```

when Inspector is open.

## 18. Maximized mode uses overlay drawer

When maximized, opening Inspector must **not** change graph-stage grid columns or canvas width.

Drawer overlays the right side of the graph.

Requirements:

- graph keeps same dimensions;
- no fit/recenter/re-layout when drawer opens/closes;
- selection remains;
- drawer content is existing UX2 `ProvenanceInspector`;
- Inspector scrolling remains independent.

Suggested width:

`clamp(20rem, 28vw, 30rem)`

At narrow width, use up to roughly `min(92vw, 30rem)`.

## 19. Right-edge Inspector handle

When maximized and Inspector is closed, show a small right-edge handle/tab:

```text
[‹]
```

or `Inspector`.

Requirements:

- unobtrusive right-edge placement;
- accessible label `Open Inspector`;
- opening does not require Tools;
- when drawer opens, hide/replace handle;
- existing Inspector close action can remain.

Do not implement drag-resizing yet.

## 20. Preserve Inspector selection semantics

- selecting while closed does not auto-open;
- opening shows current selection;
- closing does not clear selection.

---

# Part G — Errors/diagnostics in canvas mode

## 21. Errors must float

In maximized mode, actionable persistence/navigation errors should become compact floating alerts/toasts rather than rows that reduce graph height.

Projection failure remains a clear full-surface failure because the graph cannot render.

Normal success announcements remain visually hidden aria-live content.

## 22. Projection issues

Projection issues `<details>` must not consume canvas-mode layout.

Expose them inside Tools as an Advanced/Issues disclosure, or equivalent compact access.

Do not delete diagnostic access.

---

# Part H — Keep UX4A bottom-left controls

## 23. Permanent canvas controls

Keep visible in maximized canvas mode:

```text
+
−
Fit graph
Restore graph
```

These directly manipulate the canvas and should not move into Tools.

Escape still exits maximized mode.

## 24. Overlay collision policy

Suggested zones:

```text
top-left:
  [Tools] [Settings]

top-center:
  transient errors

right edge:
  Inspector handle/drawer

bottom-left:
  viewport controls
```

Preferred simple rule:

```text
opening Tools closes Settings
opening Settings closes Tools
```

Inspector remains independent.

---

# Part I — Maximize state behavior

## 25. Entering maximize

On enter:

- canvas expands to full workspace;
- Tools closed;
- Settings closed;
- Inspector retains open/closed transient state, but if open becomes overlay drawer;
- graph selection preserved;
- Focus preserved;
- disclosure/filters/search state preserved;
- viewport preserved as closely as possible.

Do not call Fit View.

## 26. Leaving maximize

On restore/Escape:

- return normal workspace layout;
- close Tools/Settings;
- Inspector returns to split-pane behavior if open;
- selection preserved;
- graph view state preserved;
- viewport not unnecessarily reset.

Do not Fit View.

## 27. Escape behavior

Preserve:

```text
Escape while maximized → exit maximized mode
```

Do not require multiple Escape presses because a popover is open.

Tools/Settings have visible close controls.

---

# Architecture boundaries

## Expected web changes

Likely:

```text
apps/web/src/components/GraphExplorer.tsx
apps/web/src/components/EntitySearch.tsx
apps/web/src/components/GraphFilters.tsx
apps/web/src/App.css
apps/web/src/preferences/*
apps/web tests
```

Small new components are encouraged if they reduce `GraphExplorer.tsx` complexity, e.g.:

```text
GraphToolsPanel.tsx
GraphSettingsPopover.tsx
GraphInspectorDrawerHandle.tsx
```

## Expected renderer changes

Trackpad mode must reach renderer:

```text
packages/renderer-reactflow/src/types.ts
packages/renderer-reactflow/src/GraphCanvas.tsx
viewport-navigation tests
renderer interaction tests
```

Use a narrow prop such as `trackpadZoomMode`.

Renderer must not read localStorage.

## Avoid

Do not modify unless necessary:

```text
packages/core
parser-markdown
adapter-obsidian
resolver
view-projection semantics
per-vault view-state schema
stable identity
diagnostic report schema
incremental pipeline
Tauri Rust shell
source-provider/security scope
```

---

# Tauri/security boundary

UX4A already added a narrowly scoped Windows app-local compatibility fallback.

Do not broaden it.

UX4B should not need new filesystem permissions or Rust plugins.

If preference persistence truly requires a desktop fallback, prefer existing app-local storage capability and document why.

---

# Performance boundary

UX4B is not PERF1/KG12.

Do not replace Dagre, add workers, virtualize graph, switch renderer, or add broad caches.

Avoid obvious regressions:

- Tools/Settings open/close = shell state only;
- maximized Inspector drawer = no projection/layout;
- changing trackpad mode = input behavior only;
- wheel/pinch/pan = viewport-only;
- no reprojection because an overlay opened.

---

# Explicitly out of scope

Do not implement:

- broad Preferences system;
- theme selector;
- layout-engine settings;
- zoom sensitivity slider;
- keybinding customization;
- Inspector resize drag handle;
- detachable windows;
- OS/browser Fullscreen API;
- minimap;
- node dragging/pinning;
- performance architecture;
- source preview;
- Open in Obsidian;
- Markdown editing.

---

# Suggested implementation sequence

1. Sync latest `main`.
2. Read current GraphExplorer, App.css, EntitySearch, GraphFilters, maximize helper/tests, Inspector, GraphCanvas, UX4A viewport navigation, and storage helpers.
3. Run baseline `pnpm check` and `pnpm desktop:check`.
4. Add small validated app-preference helper.
5. Add `TrackpadZoomMode` state + persistence tests.
6. Pass preference into GraphCanvas.
7. Split UX4A wheel behavior by mode.
8. Verify two-finger pan vs ctrl-pinch event ownership.
9. Add Settings popover and normal-mode gear.
10. Restructure maximized layout so canvas alone owns flow space.
11. Add floating Tools trigger/panel.
12. Reuse Search/Structure/Focus/Filters inside panel.
13. Make projection issues available inside overlay UI.
14. Convert maximized Inspector to overlay drawer.
15. Add right-edge Inspector handle.
16. Make canvas-mode errors float.
17. Verify UX4A bottom-left controls remain accessible.
18. Browser QA.
19. Windows Tauri QA with both trackpad modes.
20. Responsive ~390px QA.
21. Rebase/sync latest `main`.
22. Full validation.
23. Open PR and merge after CI.
24. Clean branch/worktree per project convention.

---

# Required automated tests

## Preferences

Test:

- absent storage → `scroll-zoom`;
- valid `scroll-zoom` restores;
- valid `pinch-zoom` restores;
- malformed JSON falls back;
- invalid enum falls back;
- setting writes expected v1 payload;
- write failure leaves in-memory preference usable.

Do not use KG9 workspace-view serializer.

## Trackpad behavior

### Scroll-to-zoom

- non-ctrl wheel uses focal zoom;
- ctrl wheel uses focal zoom;
- pan-on-scroll not simultaneously active;
- page zoom prevented;
- sensitivity/focal behavior remains UX4A.

### Pinch-to-zoom

- ctrl wheel uses focal zoom;
- non-ctrl wheel does not call custom zoom;
- React Flow pan-on-scroll enabled for ordinary wheel/two-finger scroll;
- no duplicate zoom + pan;
- pointer/touch pinch remains enabled.

Prefer a pure ownership helper if useful, e.g.:

```ts
wheelActionForMode(mode, event) // zoom | pan | ignore
```

## Canvas layout

When `maximized=true`:

- graph canvas remains mounted;
- Search/toolbar/filters do not consume flow layout;
- Tools button visible;
- Settings button visible;
- Tools defaults closed;
- opening Tools exposes Search/Structure/Focus/Filters;
- graph projection unchanged;
- GraphCanvas not remounted just because Tools toggled.

Avoid brittle exact-pixel tests.

## Tools

Verify open/close, exclusive Settings behavior, Search navigation, structural controls, Heading limit, Focus, Filters, Reset view, counts.

## Settings

Verify gear open/close, preference change immediate, persistence, normal-mode access, maximized access, persistence warning on write failure.

## Inspector drawer

Maximized:

- closed Inspector does not alter graph-stage columns;
- edge handle visible;
- handle opens Inspector;
- drawer overlays;
- opening does not clear selection;
- selection while closed does not auto-open;
- reopening shows current selection;
- closing does not clear selection.

Normal: existing split pane remains.

## Maximize regression

- selection preserved;
- Focus preserved;
- disclosure/filter state preserved;
- no Fit View;
- Escape exits;
- Tools/Settings close on exit;
- Inspector returns to normal layout if open.

---

# Browser QA

Use synthetic report and real/local vault when available.

## Canvas mode

1. Navigate/zoom to recognizable location.
2. Maximize.
3. Confirm graph fills essentially entire content surface.
4. Confirm Search/toolbar/filters consume no rows.
5. Confirm viewport did not Fit/reset.
6. Open Tools.
7. Use Search.
8. Change Heading limit.
9. Use Focus.
10. Open Filters.
11. Close Tools.
12. Confirm full canvas returns.

## Inspector

1. Select node with Inspector closed.
2. Maximize.
3. Open right-edge Inspector handle.
4. Confirm drawer overlays graph.
5. Confirm graph does not resize/recenter.
6. Close drawer.
7. Confirm selection remains.

## Settings — Scroll to zoom

1. Choose Scroll to zoom.
2. Two-finger vertical swipe.
3. Confirm graph zooms.
4. Confirm focal stability.
5. Reload and confirm setting restores.

## Settings — Pinch to zoom

1. Choose Pinch to zoom.
2. Move two fingers vertically/horizontally together.
3. Confirm canvas pans rather than zooms.
4. Move two fingers apart/together.
5. Confirm canvas zooms.
6. Confirm focal stability.
7. Confirm page itself does not zoom.
8. Reload and confirm setting restores.

## Controls

Bottom-left +, −, Fit and Restore remain reachable with overlays open where physically possible.

No console warnings/errors.

---

# Windows Tauri QA

Run:

```bash
pnpm desktop:dev
```

Open a real local vault.

## Scroll to zoom

- two-finger swipe up/down zooms;
- physical pinch zooms;
- no whole-WebView page zoom.

## Pinch to zoom

- ordinary two-finger swipe pans;
- horizontal/diagonal two-finger scroll pans correctly;
- fingers apart/together zoom;
- no whole-app page zoom;
- focal point stable.

Close/reopen app and confirm preference restores.

Also verify local-vault opening/watch/incremental behavior currently present remains unchanged and no security-scope regression occurs.

---

# Responsive QA

At approximately `390 × 844`:

- Tools and Settings reachable;
- Tools panel fits and scrolls internally;
- no page-level horizontal overflow;
- Settings popover fits;
- Inspector drawer becomes sensible near-full-width overlay;
- bottom-left controls reachable;
- right-edge Inspector handle reachable.

---

# Accessibility

- Tools button uses `aria-expanded`;
- Tools panel has clear accessible name;
- Settings button uses `aria-expanded`;
- preference inputs have real labels;
- Inspector handle says `Open Inspector`;
- drawer close control accessible;
- floating surfaces keyboard reachable;
- focus-visible states retained;
- no icon/color-only status;
- no keyboard trap in non-modal panels;
- Escape exits maximized mode as specified.

Do not incorrectly mark simple popovers as modal dialogs.

---

# Validation

Run:

```bash
pnpm check
pnpm desktop:check
git diff --check
```

If available:

```bash
pnpm desktop:build
```

CI must pass.

No new runtime dependency is expected.

---

# Documentation

Keep updates concise.

Document:

- maximized mode is canvas-only;
- Tools/Settings are floating overlays;
- maximized Inspector is an overlay drawer;
- global/local `trackpadZoomMode` preference;
- Scroll to zoom vs Pinch to zoom semantics;
- preference is distinct from per-vault graph view state.

If project convention still archives implementation prompts under `history-implementations/`, add:

`UX4B_true_canvas_mode_floating_tools_settings_inspector_drawer_codex_prompt.md`

Do not mark PERF1/KG12 complete.

---

# Exit gate

## True canvas mode

- [ ] Maximized graph stage occupies essentially the entire app content surface.
- [ ] Search consumes zero permanent layout height.
- [ ] Toolbar consumes zero permanent layout height.
- [ ] Filters consume zero permanent layout height.
- [ ] Entering canvas mode does not Fit View.
- [ ] Selection, Focus, disclosure/filter state are preserved.
- [ ] Escape/Restore return normal mode.
- [ ] Tools/Settings close on restore.

## Floating Tools

- [ ] Tools always reachable in maximized mode.
- [ ] Defaults closed.
- [ ] Opens as overlay without resizing canvas.
- [ ] Search, structural depth, Heading limit, Focus, Filters, Reset saved view, counts all work.
- [ ] Search results remain overlay-contained.
- [ ] Narrow viewport internal scrolling works.

## Settings

- [ ] Gear exists in normal mode and canvas mode.
- [ ] Same Settings implementation used in both.
- [ ] `scroll-zoom` option exists.
- [ ] `pinch-zoom` option exists.
- [ ] Default is `scroll-zoom`.
- [ ] Change applies immediately.
- [ ] Preference persists locally.
- [ ] Malformed storage falls back safely.
- [ ] Storage failure leaves session setting usable.
- [ ] Preference is not stored per vault.

## Scroll-to-zoom

- [ ] Two-finger vertical scroll zooms.
- [ ] Mouse wheel zooms.
- [ ] Precision-touchpad pinch zooms.
- [ ] Sensitivity remains 1.8.
- [ ] Focal point preserved.
- [ ] Page itself does not zoom.

## Pinch-to-zoom

- [ ] Ordinary non-ctrl two-finger scroll pans.
- [ ] Horizontal/diagonal trackpad scroll can pan.
- [ ] Mouse wheel pans.
- [ ] Precision-touchpad fingers-apart/together zooms.
- [ ] Focal point preserved.
- [ ] No simultaneous pan+zoom.
- [ ] Page itself does not zoom.
- [ ] React Flow pointer/touch pinch remains enabled.

## Inspector drawer

- [ ] Normal mode still uses split pane.
- [ ] Maximized mode uses overlay drawer.
- [ ] Drawer does not shrink canvas.
- [ ] Opening drawer does not Fit/recenter.
- [ ] Right-edge handle opens drawer.
- [ ] Selection survives close.
- [ ] Selection while closed does not auto-open.
- [ ] Reopen shows current selection.
- [ ] Inspector scrolling works.

## Status/diagnostics

- [ ] Maximized errors do not consume layout rows.
- [ ] Actionable errors remain visible.
- [ ] Projection issues remain accessible.
- [ ] Success announcements remain accessible but non-permanent.

## Regressions/boundaries

- [ ] UX4A anchored disclosure unchanged.
- [ ] UX4A File/Heading visuals unchanged.
- [ ] UX3 hover/selection/Focus unchanged.
- [ ] UX2 Inspector content unchanged.
- [ ] local-vault/open/watch behavior unchanged.
- [ ] no graph schema/parser/resolver changes.
- [ ] no broadened filesystem permissions.
- [ ] no performance architecture added.
- [ ] no unnecessary dependency.
- [ ] browser QA passes.
- [ ] Windows Tauri QA passes.
- [ ] ~390px QA passes.
- [ ] no new console warnings/errors.
- [ ] `pnpm check` passes.
- [ ] `pnpm desktop:check` passes.
- [ ] `git diff --check` passes.
- [ ] branch synchronized with latest `main` before merge.

---

# Final implementation report

When complete, return:

1. Summary
2. PR + merge commit
3. Files changed
4. Canvas-only maximized behavior
5. Floating Tools behavior
6. Settings UI
7. Preference storage model
8. Scroll-to-zoom behavior
9. Pinch-to-zoom behavior
10. Browser gesture QA
11. Tauri precision-touchpad QA
12. Inspector drawer behavior
13. Error/projection-issue behavior
14. Responsive behavior
15. Accessibility
16. Tests
17. Browser QA
18. Tauri QA
19. Dependencies
20. Any Tauri-specific preference fallback
21. Conflicts/rebase notes
22. Deviations from plan
23. PERF1/KG12 handoff

Do **not** begin PERF1/KG12 automatically.
