# UX4A — Workspace Chrome Cleanup + Edge-to-Edge Graph Canvas

**Task type:** product UI architecture / workspace chrome cleanup / source-settings relocation / developer-evidence relocation

## Goal

Make the graph workspace the dominant surface of Icarus Graph Explorer.

The current application still spends permanent screen space on:

- the visible `Icarus Graph Explorer` page title;
- source buttons (`Open Vault`, `Open Report`, `Sample`, `Rescan Vault`);
- current source/status text;
- outer `diagnostic-shell` padding;
- a rounded/bordered/shadowed graph container;
- the permanent below-graph `Inspect diagnostic evidence` block.

UX4A should remove that application-style framing and turn the main product into an **edge-to-edge graph workspace**.

Target normal desktop layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ graph toolbar / workspace controls                            ⚙ ... │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│                              GRAPH                                   │
│                                                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Source switching and developer diagnostics remain available, but they should no longer consume permanent canvas space.

This milestone is deliberately limited to **workspace chrome**.

Do **not** yet implement:

- heading-depth relocation into Filters;
- Inspector sidebar redesign;
- removal of `Focus Selected`;
- double-click Focus;
- focus-root visual variants;
- node visual simplification;
- graph history Back/Forward.

Those belong to UX4B / UX4C / NAV1.

---

# Current repository evidence

Repository:

`lillo24/icarus-graph-explorer`

Before editing, inspect the latest actual branch/`main`.

At planning time, current `apps/web/src/App.tsx` still renders:

```text
<header className="app-bar">
  Icarus Graph Explorer
  Open Vault
  Open Report
  Sample
  Rescan Vault
  report/source status
  identity-recovery actions
</header>

<main className="diagnostic-shell">
  <GraphExplorer ... />

  <details className="diagnostic-evidence">
    <summary>Inspect diagnostic evidence</summary>
    ...
  </details>
</main>
```

Current CSS still gives the normal graph workspace:

```text
diagnostic-shell:
  centered width
  outer padding

graph-workspace:
  border
  border-radius
  box-shadow
  max-height
```

while `graph-workspace--maximized` removes those decorations.

Current `GraphSettings` is already opened from the graph toolbar and currently contains graph interaction settings such as Trackpad Zoom.

Current desktop/live-vault behavior is integrated into `App.tsx`; source actions are not simple static buttons:

- `Open Vault` may initialize/replace a live Tauri source session.
- `Rescan Vault` depends on live-session state.
- source errors preserve the previous valid workspace.
- local identity recovery/reset may appear.
- stable/transient identity state affects KG9B persistence.
- `Sample` / JSON report switching stops active live sessions.

UX4A must preserve all of that behavior while relocating its UI.

Do not simplify source-session logic merely because the top header is removed.

---

# Required first step

Before editing:

1. sync/rebase onto the latest intended base branch;
2. verify worktree cleanliness except for explicitly concurrent work;
3. read:
   - `AGENTS.md`;
   - `apps/web/src/App.tsx`;
   - `apps/web/src/App.css`;
   - `apps/web/src/components/GraphExplorer.tsx`;
   - `apps/web/src/components/GraphSettings.tsx`;
   - `apps/web/src/components/README.md`;
   - `apps/web/README.md`;
   - current desktop/live-vault orchestration files;
   - current browser persistence/source-session tests;
4. inspect any UX work merged after this prompt was written;
5. preserve current KG11 live-vault behavior;
6. follow repository branch/PR/CI/cleanup conventions.

If newer UI work has already solved part of UX4A, integrate with it instead of reintroducing old structures.

---

# Core design decision

## The graph workspace is the application surface

Normal mode should no longer look like:

```text
window
  ↓
application header
  ↓
page padding
  ↓
rounded graph card
```

It should look like:

```text
window
  ↓
graph workspace
```

The desktop window itself already identifies the application.

Therefore remove the visible in-page:

```text
Icarus Graph Explorer
```

heading.

Do not replace it with another large logo/title.

Accessible application/page labeling still needs to remain valid through:

- the desktop/window title;
- document `<title>`;
- ARIA labels/landmarks where needed;
- visually-hidden labels if necessary.

Do not keep a visually large page title merely for semantic HTML.

---

# Edge-to-edge normal workspace

The ordinary graph workspace should occupy the available application viewport.

Remove the unnecessary outer visual frame:

```text
diagnostic-shell outer padding
graph-workspace outer border
graph-workspace outer radius
graph-workspace outer drop shadow
normal-mode max-height card behavior
```

Preferred normal result:

```text
.app-shell
  width: 100%
  height/min-height: 100dvh

.diagnostic-shell / main
  width: 100%
  height: 100dvh
  margin: 0
  padding: 0

.graph-workspace
  width: 100%
  height: 100dvh
  max-height: none
  border: 0
  border-radius: 0
  box-shadow: none
```

Use actual component structure rather than blindly copying these declarations.

Respect:

- safe-area insets where relevant;
- responsive/mobile behavior;
- overflow ownership;
- current graph toolbar/search/filter heights.

There should be no useless strip of body background around the workspace.

---

# Maximize/full-canvas mode

Do **not** remove the existing maximize/full-canvas feature in UX4A.

Even if normal mode becomes much closer visually to maximized mode, maximize may still alter:

- tools/search/filter visibility;
- overlay behavior;
- Escape handling;
- body overflow;
- future sidebar behavior.

Preserve its semantics.

However, outer chrome should no longer make normal mode feel like a smaller “card” and maximized mode like a completely different application.

Normal and maximized modes should share the same edge-to-edge outer visual grammar.

Do not redesign maximized tool controls here; UX4B will harmonize workspace/sidebar controls.

---

# Remove the permanent application header

The current `.app-bar` should no longer occupy layout space.

Do not merely set:

```css
.app-bar { height: 1px; overflow: hidden; }
```

Refactor ownership cleanly.

The header currently contains multiple classes of functionality:

```text
application title
source actions
live source status
error/recovery state
```

Relocate each deliberately.

---

# Move source controls into Settings

Move the normal source actions into the existing Settings experience under a clear section such as:

```text
Settings

Source
  Current source: <safe display name>

  Open Vault
  Open Report
  Use Sample

  Rescan Vault       // only when applicable

  status / persistence state
  recovery actions   // only when applicable

Graph interaction
  Trackpad zoom
  ...
```

Exact wording may evolve with current UI, but the conceptual grouping should be obvious.

Do not leave duplicated source buttons in the old header after relocation.

---

# Source-control ownership

Source behavior belongs to `App`, not to graph/domain packages.

Do not make `GraphSettings` import:

```text
source-provider-tauri
workspace-engine-obsidian
diagnostics-obsidian source orchestration
```

solely to render buttons.

Use a web-layer composition seam.

A clean direction is:

```text
App owns source actions/state
        ↓
renders SourceSettings content
        ↓
GraphExplorer / GraphSettings provides a UI slot
```

For example, `GraphSettings` may accept a React child/section supplied by `App`, or an equally narrow web-only composition API.

The exact implementation may differ, but preserve:

```text
App = source/session behavior owner
GraphExplorer = graph/workspace behavior owner
GraphSettings = presentation/composition
```

Do not pass Tauri provider objects into `GraphSettings`.

Do not duplicate `openVault`, `loadReport`, `restoreSample`, `rescanVault`, or identity-reset logic.

---

# Recommended Settings composition

Refactor the existing Settings popover toward sections rather than a single Trackpad fieldset.

A good product structure after UX4A is:

```text
Settings
├─ Source
│  ├─ current source
│  ├─ Open Vault
│  ├─ Open Report
│  ├─ Sample
│  ├─ Rescan Vault when live
│  └─ source/identity recovery status
│
├─ Graph Interaction
│  └─ Trackpad zoom
│
└─ Developer
   └─ Diagnostic evidence
```

Do not add future settings from UX4B/UX4C yet.

This section structure is intentionally extensible because later plans will add more graph-style/settings controls.

---

# Open Report inside Settings

The current hidden `<input type="file">` remains a valid browser mechanism.

Move its visible trigger into `Settings → Source`.

Requirements:

- keyboard accessible;
- correct label/input association;
- file chooser still works in browser and Tauri frontend;
- input value resets after selection exactly as current logic requires;
- a failed report load preserves the current workspace;
- opening a report stops/detaches the previous live vault exactly as current code does.

Do not try to replace browser report selection with a Tauri native file dialog in UX4A.

---

# Open Vault inside Settings

In Tauri runtime, `Settings → Source` should contain:

```text
Open Vault
```

and preserve the current desktop behavior.

When a vault is already loaded, this is source switching, not an “import”.

Keep:

- opening/pending disabled state;
- cancel-is-inert behavior;
- last-valid-source preservation on failure;
- stable/transient identity semantics;
- live watcher/session lifecycle.

Do not expose full absolute vault paths.

Show only current safe display name.

---

# Sample inside Settings

Use clearer wording than a generic button if useful:

```text
Use Synthetic Sample
```

or:

```text
Load Sample
```

The current sample remains a legitimate development/demo source.

Do not show redundant:

```text
Sample
Synthetic Sample
```

as two adjacent pieces of permanent chrome.

The Settings source section can show:

```text
Current source: Synthetic Sample
```

when active.

---

# Rescan Vault inside Settings

When a live Tauri vault is active, expose:

```text
Rescan Vault
```

inside `Settings → Source`.

Do not keep it as permanent top-level application chrome.

Preserve:

- disabled state while a scan/resync is already in progress;
- KG11 live-session behavior;
- no identity reset;
- no saved-view reset.

If later UI work has introduced a compact live-status surface elsewhere, integrate rather than duplicate it.

---

# Identity recovery

Current App may surface actions such as:

```text
Reset local identity registry
Reset local identity for this vault
```

These are exceptional recovery actions.

They should no longer appear as permanent header chrome.

Place them in:

```text
Settings → Source → Recovery
```

and/or expose them when the relevant error occurs.

Keep confirmation behavior.

Make the distinction explicit between:

```text
Reset saved view
Reset local identity
```

Do not make identity reset visually equivalent to ordinary source switching.

---

# Source status

Do not consume a permanent full-width row for healthy routine status such as:

```text
Live · MyVault · 277 Markdown · 4,402 entities
```

Healthy source details should be available in `Settings → Source`.

For example:

```text
Current source
MyVault

Status
Live

277 Markdown · 4,402 entities
```

or a similarly compact presentation.

Do not expose full private absolute path.

---

# Important/transient status outside Settings

The user still needs immediate feedback for states such as:

```text
Opening Vault…
Catching up…
Resyncing…
Paused
failed source load
identity/catalog write failure
```

Do not hide actionable failures only inside a closed Settings menu.

Replace the layout-consuming header rows with a compact non-layout-blocking notice mechanism.

A good direction:

```text
graph workspace
  └─ small floating/status notice below toolbar or in a corner
```

Requirements:

- does not permanently reduce canvas height;
- `role="alert"` for errors where appropriate;
- `aria-live="polite"` for progress/status where appropriate;
- readable over graph/tool backgrounds;
- does not obscure key controls;
- clears/changes with existing source state;
- actionable paused/recovery states may include a concise action or direct the user to Settings.

Do not build a general toast framework or add a dependency.

A small workspace-specific notice component is enough.

---

# Avoid status spam

Do not flash a user-facing notice for every successful live filesystem update.

Healthy steady state:

```text
Live
```

may remain discoverable in Settings or a subtle existing source indicator.

Use prominent transient notices for:

- opening;
- catching up if meaningfully long;
- resync;
- paused;
- errors/recovery.

Do not turn normal autosave/watch activity into distracting UI.

---

# Move diagnostic evidence out of main document flow

The current:

```text
<details className="diagnostic-evidence">
  <summary>Inspect diagnostic evidence</summary>
  ...
</details>
```

should disappear from below the graph.

The functionality must remain.

Move its entry point to:

```text
Settings → Developer → Diagnostic evidence
```

This is a development/debugging facility, not a primary graph workflow.

Do not delete:

- summary evidence;
- raw/reference evidence;
- hierarchy diagnostic evidence;
- compatibility probes;
- existing diagnostic search/filter functionality.

---

# Diagnostic evidence presentation

Do **not** force the complete KG5 diagnostic UI into the narrow ~22rem Settings popover.

Instead:

```text
Settings → Developer
  [Open Diagnostic Evidence]
```

opens a secondary overlay/dialog/panel that can use substantial viewport space.

A good direction:

```text
┌──────────────────────────────────────────────────┐
│ Diagnostic Evidence                        Close │
├──────────────────────────────────────────────────┤
│ existing KG5 evidence/filter UI                  │
│                                                  │
│ scrollable                                       │
└──────────────────────────────────────────────────┘
```

Requirements:

- no permanent canvas layout space;
- keyboard accessible;
- focus management;
- Escape close unless it conflicts with current maximized-mode semantics;
- scroll inside the evidence surface;
- preserve existing evidence search/filter behavior;
- closing returns focus sensibly;
- ordinary graph remains behind/under the overlay;
- do not expose private information beyond what the existing local diagnostic UI already intentionally shows.

Use current web UI patterns. No modal/dialog dependency.

---

# Diagnostic evidence ownership

The diagnostic data/search/filter state currently lives in `App`.

It may remain there.

A clean refactor may extract something like:

```text
DiagnosticEvidencePanel
```

from the large App JSX, but do not move diagnostic semantics into `GraphExplorer`.

The graph should only need a Settings developer action or injected Settings content.

Keep:

```text
diagnostic report/evidence owner = App/web report layer
graph owner = GraphExplorer
```

---

# Remove obsolete development copy

Inspect permanent text around the graph and source surfaces.

Remove or relocate explanatory text that was useful during KG5–KG9 development but no longer helps normal use.

Examples include copy that explains implementation architecture rather than user action.

Do **not** remove:

- necessary accessible labels;
- error explanations;
- meaningful filter/help text that prevents misunderstanding.

This is not a blanket “delete all helper text” instruction.

Apply the criterion:

> Does a normal user need to read this repeatedly while exploring their graph?

If not, move it into Settings/Developer/technical details or remove it.

---

# Main-content landmark

Keep an accessible main landmark even though outer padding/card styling disappears.

For example:

```html
<main id="main-content" className="workspace-main">
  ...
</main>
```

is still appropriate.

The skip link should continue targeting a meaningful focus/landmark destination.

If the old visible `<h1>` is removed, verify accessibility with the current interface guidelines.

Do not break heading hierarchy merely to remove visual chrome.

A visually hidden application label is acceptable if needed.

---

# Body/root sizing

Inspect global styles as well as `App.css`.

Ensure:

```text
html
body
#root
app shell
main workspace
```

permit a true 100%-viewport graph without accidental margins or double scrollbars.

Avoid:

```text
body scroll + graph internal scroll
```

unless the diagnostic overlay intentionally scrolls.

Normal graph workspace should own its internal panels/canvas overflow.

---

# Responsive behavior

At narrow widths such as 390px:

- no outer page padding waste;
- no horizontal page overflow;
- graph toolbar/search/filter surfaces remain usable according to current behavior;
- Settings remains reachable;
- Source actions inside Settings remain touch-sized;
- diagnostic overlay fits viewport and scrolls internally;
- floating status does not cover the entire toolbar/canvas.

Do not redesign all narrow-layout graph controls; that belongs to the relevant UX plan if current controls still need work.

---

# Tauri window behavior

Verify the actual desktop build.

The in-page title removal is specifically sensible because the native desktop window already has a title.

Do not alter Tauri window title/configuration in UX4A unless it is currently wrong.

Do not implement custom title bars/window chrome.

---

# Browser behavior

Browser mode must remain fully usable even without the in-page `Icarus Graph Explorer` heading.

Keep:

```text
document title
Sample
Open Report
Settings
```

reachable.

`Open Vault` remains Tauri-only.

Do not render a broken/empty Source section in ordinary browser mode; simply omit unavailable native actions.

---

# Settings opening/closing

Preserve the current Settings trigger.

UX4A does not yet redesign the Settings icon or side-panel grammar.

Requirements:

- Settings trigger remains reachable in normal/maximized modes;
- only one current overlay should own focus if the app already enforces overlay exclusivity;
- opening Diagnostic Evidence may close Settings first;
- Escape/focus behavior remains deterministic;
- no nested inaccessible popover/modal trap.

UX4B may later refine toolbar/sidebar interaction.

---

# What NOT to change in UX4A

Hard scope boundary.

Do not yet:

## Toolbar/filter semantics

- move Heading Depth into Filters;
- merge duplicate Blocks controls;
- redesign filter groups;
- remove `Focus Selected`;
- add Back/Forward.

## Inspector

- replace Inspector text button with sidebar icon;
- redesign collapse handle;
- modify Inspector content.

## Node content / graph styling

- remove FILE/SECTION labels;
- remove focus-distance labels;
- remove node paths;
- change document/section/block shapes;
- add focus-root visual variants.

## Graph semantics

- change KG6 projection;
- change focus semantics;
- change search semantics;
- change layout engine;
- change Dagre spacing;
- add clustering/grouping.

Those have their own implementation plans.

---

# No architecture/domain changes

UX4A should not modify:

```text
core
parser
resolver
stable-identity
workspace-engine
snapshot-delta
view-projection semantics
explorer-inspection semantics
renderer layout
Tauri source-provider semantics
```

except for compile-safe UI composition types where necessary.

No ADR should be needed unless implementation uncovers a real product architecture decision beyond this plan.

---

# No new dependencies

Expected external additions:

```text
zero
```

Do not add:

- modal libraries;
- toast libraries;
- state-management libraries;
- icon libraries;
- CSS frameworks.

Use current React/CSS/SVG patterns.

---

# Suggested component refactor

Use current repository patterns rather than forcing exact names.

A sensible result may include:

```text
App.tsx
  source/session state + diagnostic evidence state
  ↓
GraphExplorer
  graph workspace
  ↓
GraphSettings
  Graph settings sections + injected app settings content

new/extracted:
  SourceSettingsSection.tsx
  DiagnosticEvidencePanel.tsx
  WorkspaceNotice.tsx
```

These names are illustrative.

Avoid one giant `GraphSettings` file with every App source handler hard-coded inside it.

Avoid moving the entire `App.tsx` source state into `GraphExplorer`.

---

# Source Settings interface

Prefer a narrow web-layer interface/React composition seam.

For example, `GraphExplorer` may receive:

```ts
settingsContent?: ReactNode
```

or a semantically named equivalent.

Then App owns:

```tsx
<SourceSettingsSection ... />
<DeveloperSettingsSection
  onOpenDiagnosticEvidence={...}
/>
```

and GraphSettings renders those alongside graph interaction settings.

An equally clean typed composition is acceptable.

The important rule is ownership, not the exact prop.

---

# Settings source-state requirements

The Source section should correctly reflect:

## Synthetic sample

```text
Current source: Synthetic Sample
Open Report
Open Vault (desktop only)
```

Do not need a “Load Sample” button when Sample is already current unless product consistency favors keeping all source switch actions.

## JSON report

```text
Current source: <report filename>
Use Sample
Open Report
Open Vault (desktop only)
```

## Stable live desktop vault

```text
Current source: <safe vault display name>
Status: Live / Updating / Resyncing / Paused
Rescan Vault
Open another Vault
Open Report
Use Sample
```

## Opening state

Disable actions that would create conflicting source transitions according to current App semantics.

## Identity recovery

Expose relevant recovery action separately and clearly.

---

# Source switching must remain transactional

UX4A is visual relocation only.

Re-test that:

```text
current live vault
→ Open Report
→ report fails
```

does not accidentally destroy the current workspace.

Likewise:

```text
current report
→ Open Vault
→ user cancels
```

must preserve current state.

Do not change source-request generation/stale-callback guards unless a relocation test reveals a bug.

---

# Tests — App/source settings

Update/add tests for:

1. visible page title is gone;
2. source actions are no longer in permanent app header;
3. Settings contains source section;
4. browser mode omits Open Vault;
5. Tauri mode exposes Open Vault;
6. Open Report still invokes file input/load path;
7. Sample switching works;
8. live vault exposes Rescan Vault inside Settings;
9. source name/status appears inside Settings;
10. identity recovery action appears only when relevant;
11. failed/cancelled source changes preserve current report;
12. source actions remain disabled correctly while opening/resyncing;
13. healthy routine status no longer consumes a full-width application row;
14. important error remains immediately perceivable outside closed Settings;
15. Settings source content does not leak absolute vault paths.

---

# Tests — diagnostic evidence

Cover:

1. `Inspect diagnostic evidence` no longer appears below the graph;
2. Settings → Developer contains Diagnostic Evidence entry;
3. opening it renders existing evidence UI;
4. existing diagnostic search works;
5. existing status filtering works;
6. hierarchy/reference/evidence panels still render;
7. close returns to graph;
8. keyboard close/focus behavior;
9. evidence overlay does not resize graph workspace;
10. opening evidence does not alter graph state.

---

# Tests — edge-to-edge layout

Pure DOM/component tests can assert class/structure ownership, but browser QA is essential.

Verify:

- no `app-bar` layout row;
- no outer diagnostic-shell padding;
- no rounded outer graph card;
- graph workspace reaches viewport edges;
- normal mode has no page-level horizontal scrollbar;
- normal graph fills available viewport height;
- maximized mode still functions;
- returning from maximized does not restore old card framing;
- source/diagnostic overlays do not change graph dimensions.

Do not overfit unit tests to exact pixel values.

---

# Browser QA — ordinary browser

Using bundled sample:

1. open ordinary `pnpm dev`;
2. confirm no visible duplicate application title;
3. confirm graph begins at window edges;
4. confirm no outer padded card/frame;
5. open Settings;
6. confirm Source section;
7. load a JSON report from Settings;
8. switch back to Sample;
9. open Developer → Diagnostic Evidence;
10. use evidence search/filter;
11. close evidence;
12. maximize/unmaximize graph;
13. verify no layout jumps/outer whitespace regression;
14. verify keyboard Settings/evidence behavior;
15. inspect 390px layout;
16. no console errors/warnings.

---

# Native Tauri QA

Using the existing desktop app:

1. launch desktop app;
2. confirm native window title is sufficient and no duplicate in-page title appears;
3. open Settings → Source;
4. Open Vault from Settings;
5. select synthetic disposable vault;
6. confirm healthy live source details are available in Settings;
7. verify transient opening/resync status is visible without permanently shrinking graph;
8. use Rescan Vault from Settings;
9. switch to Sample from Settings;
10. Open Vault again if useful;
11. verify live session/source-switch behavior is unchanged;
12. verify no absolute local path is shown;
13. verify diagnostic evidence overlay works;
14. no console/native errors.

Do not use the private Icarus vault unless needed for final regression; synthetic desktop QA is sufficient for the visual change.

---

# Accessibility QA

Use current web-interface guidance.

Verify:

- meaningful main landmark;
- skip link still works;
- Settings trigger has accessible name/state;
- Source section controls have clear labels;
- hidden file input is correctly associated;
- Diagnostic Evidence launcher is a button, not an ambiguous text link;
- evidence overlay has a heading/label;
- focus moves into overlay sensibly;
- focus returns on close;
- Escape behavior is predictable;
- floating alerts use correct live-region role;
- no important state is conveyed only visually;
- minimum touch targets remain reasonable.

Do not retain an otherwise useless visible H1 solely to satisfy heading semantics if an accessible alternative is cleaner.

---

# CSS cleanup

Remove obsolete styles rather than leaving dead rules for:

```text
.app-bar
report-actions in header layout
old header-only status rows
old normal graph card framing
below-page diagnostic evidence spacing
```

Preserve/reuse class names only when still meaningful.

Run a dead-class/search pass after refactor.

Do not rewrite all App CSS.

---

# Performance

UX4A should be neutral or slightly beneficial.

Do not add:

- expensive resize observers;
- layout measurement loops;
- animation frameworks.

Opening Settings/Diagnostic Evidence should not recompute graph projection/layout merely because UI chrome changed.

If component composition accidentally changes props causing KG6/Dagre recomputation, fix the memo/prop boundary.

No performance milestone/budget here.

---

# Documentation

Update only UI/product docs that describe the old chrome.

Likely:

```text
apps/web/README.md
apps/web/src/components/README.md
README.md
```

If the repository records implementation prompt history, archive the final UX4A prompt consistently with existing convention.

Do not alter KG roadmap architecture milestones merely for a visual cleanup unless there is already a UX section tracking this work.

Do not create an ADR by default.

---

# Scope

## In scope

- remove visible page title;
- remove permanent app header layout;
- edge-to-edge main workspace;
- remove outer graph card framing/padding;
- preserve maximize behavior;
- move Open Vault/Open Report/Sample into Settings → Source;
- move Rescan Vault/source status/recovery into Settings;
- compact transient/error notice outside Settings when immediate attention is needed;
- move diagnostic evidence behind Settings → Developer;
- dedicated diagnostic evidence overlay/panel;
- remove obsolete development chrome/copy;
- responsive/accessibility cleanup;
- browser/Tauri regression tests;
- docs;
- PR/CI/merge/cleanup.

## Explicitly out of scope

- Heading Depth → Filters;
- Blocks-control merge;
- Inspector sidebar redesign;
- Focus Selected removal;
- double-click Focus;
- focus appearance;
- node-content simplification;
- Back/Forward history;
- graph query language;
- saved filters;
- visual groups;
- layout spacing;
- clustering;
- performance architecture;
- domain/Tauri source semantics.

Do not begin UX4B automatically.

---

# Suggested implementation sequence

1. Sync latest source branch and inspect concurrent UI/live-vault work.
2. Extract App source controls into a clean Settings-composable section.
3. Add a generic Settings composition seam without moving source ownership.
4. Move Source controls/status/recovery into Settings.
5. Add compact workspace notice for immediate status/errors.
6. Extract existing KG5 evidence JSX into a reusable diagnostic evidence component if useful.
7. Add Settings → Developer entry and diagnostic overlay.
8. Remove old `<header className="app-bar">` and below-graph evidence block.
9. Convert main/graph shell to edge-to-edge viewport ownership.
10. Remove dead CSS.
11. Unit/integration tests.
12. Browser sample/report QA.
13. Native Tauri source-switch/rescan QA.
14. Responsive/accessibility review.
15. Rebase against latest `main` if concurrent UX/live work moved.
16. Docs.
17. PR → CI → merge → post-merge CI → cleanup.

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

Because source controls include Tauri behavior, also run:

```text
pnpm desktop:check
desktop native smoke
```

if the current branch/build environment supports them.

Browser QA:

```text
sample
JSON report
390 px viewport
maximize/unmaximize
Settings source controls
Developer diagnostic overlay
```

Desktop QA:

```text
Open Vault from Settings
Rescan Vault from Settings
switch to Sample/report
error/cancel preservation
```

PR CI and post-merge `main` CI should pass.

---

# Exit gate

UX4A is complete only when:

1. The visible in-page `Icarus Graph Explorer` title is removed.
2. The application no longer has a permanent source/action header consuming graph height.
3. The main workspace reaches the viewport edges in normal mode.
4. The old centered/max-width padded main-content card layout is removed.
5. The normal graph workspace has no unnecessary outer border/radius/shadow.
6. Normal/maximized mode share consistent outer visual grammar.
7. Maximize/full-canvas functionality still works.
8. Open Vault lives under Settings → Source in Tauri mode.
9. Open Report lives under Settings → Source.
10. Sample/source switching lives under Settings → Source.
11. Rescan Vault is available there for live sessions.
12. Current safe source name/state is available there.
13. Identity recovery remains accessible but secondary.
14. Source actions preserve all current transactional/live-session semantics.
15. Healthy routine source status no longer consumes a permanent full-width row.
16. Important opening/resync/paused/error state remains immediately perceivable.
17. Immediate notices do not permanently shrink the graph.
18. No absolute vault path is exposed.
19. `Inspect diagnostic evidence` no longer appears below the graph.
20. Developer/Diagnostic Evidence is reachable through Settings.
21. Existing KG5 diagnostic functionality is preserved.
22. Diagnostic Evidence opens in a non-layout-consuming overlay/panel.
23. Diagnostic overlay has correct keyboard/focus behavior.
24. Opening/closing Settings or diagnostics does not change graph projection state.
25. Opening/closing Settings or diagnostics does not trigger unnecessary graph layout recomputation.
26. Browser Sample/Open Report mode remains functional.
27. Desktop Open Vault/live/Rescan behavior remains functional.
28. Failed/cancelled source changes preserve the current workspace.
29. Skip-link/main landmark semantics remain valid.
30. Narrow/mobile layout has no new page-level overflow.
31. No unnecessary new dependency is added.
32. Dead old header/card/evidence CSS is removed.
33. Existing graph/filter/focus/Inspector semantics are unchanged.
34. Existing KG/domain/live-source tests remain green.
35. Browser QA passes without console errors.
36. Native desktop smoke passes if run in the current environment.
37. Docs reflect the new workspace chrome.
38. PR CI passes.
39. Post-merge `main` CI passes.
40. Branch/worktree cleanup follows repository convention.

Do not begin UX4B.

---

# Final report

Report:

## 1. Summary

What changed in the workspace chrome.

## 2. Workspace layout

Explain the new edge-to-edge normal graph structure and what outer framing was removed.

## 3. Settings/source controls

Explain where:

- Open Vault;
- Open Report;
- Sample;
- Rescan Vault;
- source status;
- identity recovery

now live.

Confirm App remains the source/session behavior owner.

## 4. Status/error behavior

Explain what remains immediately visible versus tucked into Settings.

## 5. Diagnostic evidence

Explain how KG5 diagnostic evidence remains available under Developer without consuming normal canvas space.

## 6. Maximize behavior

Confirm maximize/full-canvas still works and how it now differs from normal edge-to-edge mode.

## 7. Browser QA

Sample/report, narrow viewport, Settings, diagnostic overlay, maximize.

## 8. Desktop QA

Open Vault, live state, Rescan, source switching, cancellation/error preservation.

## 9. Accessibility

Main landmark, settings controls, file input, diagnostic overlay focus, live regions.

## 10. Dependencies

Expected external additions: zero.

## 11. Tests / validation

Every command/browser/native scenario actually run.

## 12. Files changed

Important App/Settings/evidence/CSS/docs areas.

## 13. Deviations / warnings

Any UX conflict caused by newer merged work, residual maximize differences, or source-status compromise.

## 14. UX4B handoff

State that UX4B can now work from a clean edge-to-edge graph workspace and focus specifically on:

- toolbar/filter organization;
- Heading Depth relocation;
- duplicate Blocks-control rationalization;
- Inspector right-sidebar grammar;
- removal of obsolete helper copy inside graph controls.

Do not implement UX4B automatically.
