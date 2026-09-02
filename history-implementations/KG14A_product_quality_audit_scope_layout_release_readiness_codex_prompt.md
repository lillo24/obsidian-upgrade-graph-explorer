# KG14A — Product-Quality Audit + Release-Readiness Triage

**Task type:** audit / evidence collection / usability-accessibility-resilience review / next-slice planning

## Goal

KG13 and the PRE-KG14 cleanup sequence are complete. KG14A should audit the **actual current product** and produce an evidence-backed implementation queue.

Create:

`docs/PRODUCT_QUALITY_AUDIT.md`

Do not implement the next KG14 slice automatically.

## Current baseline

Repository: `lillo24/icarus-graph-explorer`

Latest verified merge:

- PR #43 — PRE-KG14A4
- merge `cf2cd6ec4c816a85a3cd77e7ed1af05d1b47ee82`
- 719 tests, builds, desktop checks, six benchmark profiles, browser QA, release Tauri QA, physical touchpad QA
- no dependency changes
- schema v3 preserved

Current product model:

```text
Scope:  All | Focus
Layout: Network | Hierarchy
```

Internal renderer mapping:

```text
All + Network    → Global Sigma
All + Hierarchy  → Structure React Flow
Focus + Network  → bounded Local Free Sigma
Focus + Hierarchy→ bounded Local Structured React Flow
```

Audit using **All / Focus / Network / Hierarchy**, not old internal Global/Local/Structure naming.

Current hierarchy density:

```text
All + Hierarchy   → compact schematic cards
Focus + Hierarchy → extended cards
```

Current Hierarchy Depth:

```text
Files only | 1 | 2 | 3
```

- All + Hierarchy: depth applies across eligible visible documents.
- Focus: automatic depth applies only to the focused root; neighbor files stay collapsed unless explicitly expanded.

Current folder clustering:

- applies only to All + Network;
- direct 0–100 Strength control;
- remains a layout-only folder prior;
- does not affect Hierarchy.

QUERY1, Saved Filters, Visual Groups, Inspector, history and schema-v3 persistence are current production features and must be audited.

## Required first inspection

Inspect current `main`, at minimum:

- `AGENTS.md`
- root/app READMEs
- `docs/ARCHITECTURE.md`
- `docs/PERFORMANCE.md`
- `docs/ROADMAP.md`
- current KG13 / Scope×Layout ADRs
- `GraphExplorer.tsx`
- `GraphSettings.tsx`
- `GraphFilters.tsx`
- `EntitySearch.tsx`
- `ProvenanceInspector.tsx`
- `VisualGroups.tsx`
- Hierarchy Depth controls
- navigation/history/persistence/preferences
- live-vault/source orchestration
- `packages/view-projection`
- `packages/view-state`
- `packages/renderer-reactflow`
- `packages/renderer-sigma`
- `packages/graph-query`
- `packages/visual-groups`
- `packages/explorer-inspection`
- `packages/performance`

Current code outranks old implementation prompts.

## Audit method

Use two passes.

### Pass 1 — user experience

Evaluate as a user who does not know Sigma, React Flow, KG6, W1/W3, Global/Local internals.

Ask:

- What do I think this control does?
- Can I predict the result?
- Do I know whether I am in All or Focus?
- Do I understand Network vs Hierarchy?
- Can I recover?
- Do I understand why something disappeared or moved?

### Pass 2 — technical product quality

Audit:

- accessibility;
- persistence/history;
- live updates;
- worker/runtime failures;
- loading/progress;
- privacy/security;
- perceived performance;
- release Tauri behavior.

## Finding format

Every meaningful finding should include:

```text
ID
Category
Severity
Confidence
Workflow
Observed behavior
Why it matters
Reproduction
Evidence
Likely implementation area
Suggested direction
Decision required?
```

Severity:

```text
P0 — release blocker / data loss / unusable critical path
P1 — major usability/accessibility/reliability problem
P2 — meaningful friction/polish issue
P3 — optional improvement
```

Also classify: `Must`, `Should`, or `Later`.

Unsupported possibilities belong under **Needs evidence**, not the ranked issue list.

## Do not treat future features as defects

Do not classify these as release problems unless a current workflow genuinely depends on them:

- Saved Views
- manual node positions
- folder-cluster dragging
- multi-focus
- analytics/centrality/community detection
- semantic similarity
- new query language
- new renderer/layout engine
- source editing
- cloud sync/collaboration

## Audit areas

### 1. First launch / source onboarding

Audit browser + Tauri:

- first launch;
- Synthetic Sample;
- Open Vault;
- Open Report;
- cancel picker;
- source status;
- live-watch status;
- Rescan;
- recovery/reset identity;
- read-only expectations.

Determine whether a first-time user can tell which source is active and whether it is live.

### 2. Scope × Layout comprehension

Audit all four combinations:

```text
All + Network
All + Hierarchy
Focus + Network
Focus + Hierarchy
```

Check:

- Scope = amount of graph;
- Layout = presentation;
- explicit Focus;
- double-click Focus;
- Back to All;
- Network ↔ Hierarchy while Focused;
- selected root continuity;
- internal terminology leakage.

### 3. Network

All + Network:

- initial layout;
- folder clustering On/Off;
- Strength 0/25/50/75/100;
- spacing presets;
- Advanced controls;
- labels;
- hover/selection;
- Search centering;
- Visual Groups;
- dense graph;
- WebGL failure.

Focus + Network:

- entry;
- Hierarchy Depth;
- root continuity;
- disclosure;
- reroot;
- Network↔Hierarchy;
- live updates.

Regional remains visual LOD, not a mode.

### 4. Hierarchy

All + Hierarchy:

- compact schematic readability;
- Files only / 1 / 2 / 3;
- disclosure;
- Heading limit;
- Blocks;
- query/filter readability;
- edge readability;
- Visual Groups.

Focus + Hierarchy:

- extended cards;
- root clarity;
- depth 0/1/2/3;
- neighbor disclosure;
- root screen-anchor stability;
- reroot;
- edge inspection;
- Inspector.

Do not reopen compact-vs-extended design unless evidence shows a real usability problem.

### 5. Hierarchy Depth truthfulness

Verify:

- selected preset matches graph behavior;
- manual +/- produces understandable Custom state;
- preset selection clears manual overrides;
- Focus auto-depth affects root only;
- neighbors expand manually only;
- Focus Network/Hierarchy share the same detail state;
- reload/persistence remains coherent.

### 6. Search / QUERY1 / Filters

Basic Search:

- result disclosure;
- selection closes results;
- retained query;
- refocus reopen;
- Escape;
- keyboard.

QUERY1:

- valid/invalid draft/apply;
- Saved Filters;
- history;
- Focus reroot;
- reload;
- live update.

Filters:

- path;
- entity kind;
- reference status;
- Heading limit;
- Blocks;
- Reset.

Key question: can the user understand why a node disappeared?

### 7. Visual Groups

Audit:

- create/edit;
- priority/order;
- enable/disable;
- palette;
- QUERY1-backed membership;
- corrupt storage;
- session-only behavior;
- Inspector memberships;
- styling in all four Scope/Layout combinations.

Confirm groups remain style/classification, never graph topology/layout semantics.

### 8. Inspector / provenance

Audit File, Heading, Block, hierarchy/reference edge, unresolved, ambiguous, invalid.

Check:

- normal info before Technical details;
- outgoing/backlinks;
- breadcrumbs;
- Focus;
- Open full hierarchy;
- edge inspection;
- Visual Group memberships.

### 9. History / persistence

Audit:

- Back/Forward;
- All↔Focus;
- Network↔Hierarchy;
- Hierarchy Depth;
- manual disclosure;
- query/filter;
- viewport;
- folder Strength;
- Visual Groups;
- reload/restart;
- Reset saved view.

Clarify the mental model between navigation, saved view, preferences, Saved Filters and Visual Groups.

### 10. Settings

Audit:

- Graph vs Source & Diagnostics;
- short-height scrolling;
- folder Strength;
- spacing;
- Advanced controls;
- Network-only applicability copy;
- Focus appearance;
- trackpad mode;
- source/recovery actions.

### 11. Accessibility

Keyboard critical path:

- source controls
- Scope/Layout
- Search
- Filters/QUERY1
- Visual Groups
- Hierarchy nodes
- +/-
- Inspector
- Back/Forward
- Focus/All
- Settings

Also inspect:

- focus order/restoration;
- screen-reader/ARIA structure;
- Sigma visual-only fallback paths;
- contrast/non-color semantics;
- Visual Groups;
- reduced motion;
- browser zoom / Windows scaling where practical.

### 12. Window/responsive desktop behavior

Test short/narrow/medium/maximized/high-DPI windows with Inspector, Filters, Groups, Settings, long names/queries.

Check clipping, scroll ownership and control crowding.

### 13. Loading / progress

Audit:

- vault open;
- W1;
- lazy Network renderer;
- All Network layout;
- Focus Network layout;
- W3 Hierarchy;
- Focus depth relayout;
- folder Strength drag;
- live update;
- Rescan.

Look for blank graph, stale status, late feedback, unnecessary flicker/jumps.

### 14. Resilience matrix

Test or deterministically inspect:

```text
corrupt/unsupported report
corrupt saved view
corrupt graph preferences
corrupt Saved Filters
corrupt Visual Groups
storage read/write failure

WebGL unavailable
Sigma mount failure
All Network worker failure
Focus Network worker failure
W3 failure
W1 failure

watch resync-required
catalog persistence failure
focused root deleted
permission/read failure
vault moved/reselected
source switch while pending
renderer disposal while worker pending
```

For each: does the last valid graph remain, is failure explicit, can the user recover, are stale results rejected?

### 15. Privacy / security

Re-check:

- selected-root filesystem scope;
- read/watch-only Markdown;
- Tauri capabilities;
- app-local identity/catalog;
- browser storage;
- workers;
- performance instrumentation;
- developer diagnostics.

No accidental upload, Markdown write, broad filesystem permission, private path telemetry, layout-coordinate persistence, or private screenshots in repo.

### 16. Runtime cleanliness

Normal browser/release Tauri workflows:

- no unexpected console errors;
- no unhandled rejections;
- no React warnings;
- no repeated worker/CSP/module errors.

### 17. Release desktop quality

Inspect:

- product name/icons/version;
- window title/minimum size;
- startup;
- top-level failure handling;
- release-only behavior;
- developer surfaces;
- capability scope;
- restart recovery.

Classify signing/auto-update/crash reporting/distribution as now-vs-future. Do not implement automatically.

### 18. Perceived performance

Use existing instrumentation for:

- first vault open;
- All Network first layout;
- All→Focus;
- Network↔Hierarchy;
- Hierarchy Depth;
- Search;
- QUERY1;
- Visual Group style update;
- folder Strength drag;
- Rescan.

Focus on missing feedback/freezes/jumps, not only benchmark totals.

## Real-vault policy

If the private Icarus vault is available, use it only for aggregate/manual QA.

Do not commit names, paths, note content, topology, or screenshots. Use synthetic vaults for destructive tests.

## Decision-required findings

Separate design choices from engineering defects.

For each decision provide:

```text
Problem
Option A
Option B
Option C only if useful
Tradeoff
Recommended default
Evidence that could change it
```

Examples only if evidence supports them: onboarding depth, compact/extended preference, advanced settings visibility, terminology.

## Low-risk fixes during KG14A

Default: audit first.

Only fix during KG14A if the issue is:

- obvious;
- low ambiguity;
- narrow;
- necessary for truthful QA;
- not a broad product redesign.

List every such fix.

## Required audit artifact

`docs/PRODUCT_QUALITY_AUDIT.md` should contain:

1. Current workflow map
2. Overall readiness
3. Top findings
4. Accessibility
5. Resilience matrix
6. Onboarding/discoverability
7. Scope×Layout consistency
8. Search/QUERY1/Filters
9. Visual Groups
10. Inspector
11. Persistence/history
12. Settings
13. Release desktop
14. Privacy/security
15. Performance perception
16. Decision-required items
17. Ranked implementation queue
18. Proposed KG14 completion gate

Keep it practical and implementation-oriented.

## Prioritization

End with:

```text
Priority
Finding IDs
Theme
User impact
Confidence
Suggested implementation slice
Needs user decision?
```

Then propose evidence-based KG14 slices. Possible shape:

```text
KG14B — blockers / accessibility / resilience
KG14C — onboarding / workflow / visual polish
KG14D — release hardening
```

Do not force this split if findings suggest another structure.

## KG14 completion definition

Propose a practical gate around:

```text
open a vault safely
understand Scope × Layout
navigate All ↔ Focus
use Network/Hierarchy predictably
control hierarchy detail
search/filter/query
use Visual Groups
inspect provenance
survive live edits/failures
restore useful state
operate through accessible DOM/keyboard paths
remain responsive
ship a clean release build
```

## Required QA

Browser:

- Synthetic Sample
- report import
- all four Scope/Layout combinations
- Hierarchy Depth
- Search / QUERY1 / Saved Filters / Filters
- Visual Groups
- Inspector
- history/persistence
- Settings
- corrupt state
- WebGL/worker failure
- resizing
- keyboard/reduced motion
- console

Release Tauri:

- Open Vault / cancel picker
- live update / Rescan
- all four Scope/Layout combinations
- Focus / Back to All
- Search/query/filter/groups
- Inspector
- restart
- root/source changes
- folder Strength
- physical touchpad
- runtime errors

## Validation

Use current repo equivalents:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm desktop:check
pnpm desktop:build
pnpm benchmark:performance -- --profile small
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small
git diff --check
```

No new CI timing thresholds.

## Documentation / roadmap

Add:

`docs/PRODUCT_QUALITY_AUDIT.md`

After audit acceptance:

```text
KG14 — In progress
KG14A — Product-quality audit complete
<evidence-backed next slice> — Next
```

Do not mark KG14 complete.

Archive this prompt under `history-implementations/`.

## Exit gate

KG14A is complete only when:

1. PR #43/current main is verified baseline.
2. Current Scope×Layout workflow map exists.
3. Browser and Tauri onboarding audited.
4. All Network audited.
5. All Hierarchy audited.
6. Focus Network audited.
7. Focus Hierarchy audited.
8. Hierarchy density and Depth audited.
9. Folder clustering/Strength audited.
10. Search, QUERY1, Saved Filters and Filters audited.
11. Visual Groups audited.
12. Inspector audited.
13. Back/Forward and All/Focus history audited.
14. persistence/restart/Reset saved view audited.
15. live update and Rescan audited.
16. keyboard/focus/accessibility audited.
17. contrast, reduced motion and scaling checked.
18. loading/progress checked.
19. corrupt report/state/storage failures checked.
20. WebGL, Network-worker, Focus-worker, W3 and W1 failures checked or deterministically inspected.
21. focused-root deletion and source-switch pending cases checked.
22. normal runtime console is clean.
23. Tauri release configuration audited.
24. privacy/security rechecked.
25. perceived performance assessed.
26. findings distinguish evidence from speculation.
27. prioritized findings have severity/confidence.
28. decision-required items are separate.
29. missing future features are not mislabeled as defects.
30. low-risk audit fixes, if any, are listed.
31. no broad KG14B work is included.
32. no private vault content/path is committed.
33. `docs/PRODUCT_QUALITY_AUDIT.md` exists.
34. ranked implementation queue exists.
35. evidence-backed KG14 split exists.
36. KG14 completion definition exists.
37. tests/builds/browser/release QA pass.
38. PR CI and post-merge CI pass.
39. task branch/worktree cleanup completes.
40. roadmap marks KG14 in progress and names the next slice.
41. next slice is not implemented automatically.

## Final report

Report:

1. Overall readiness classification
2. Current workflow
3. Top findings
4. Accessibility
5. Resilience
6. Onboarding/discoverability
7. Scope×Layout consistency
8. Search/QUERY1/Filters/Visual Groups
9. Inspector
10. Persistence/history
11. Settings
12. Release desktop quality
13. Privacy/security
14. Perceived performance
15. Decision-required items
16. Ranked issue table
17. Low-risk fixes
18. Tests/QA
19. Files changed
20. KG14 implementation split
21. KG14 completion definition
22. Roadmap

Do not implement the next slice automatically.
