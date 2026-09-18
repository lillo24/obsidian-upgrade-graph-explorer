# THEMESYS4 — Hierarchy/React Flow theming + final cross-app theme audit

**Depends on:** THEMESYS1, THEMESYS2, THEMESYS3

## Goal

Finish theme architecture by making React Flow/Hierarchy fully theme-aware and then audit production code for theme drift.

Final flow:

```text
ThemePreference
→ ResolvedTheme
→ app semantic tokens
→ Network theme adapter
→ Hierarchy theme adapter
```

Both themes must be first-class across:
- All Network;
- Focus Network;
- All Hierarchy;
- Focus Hierarchy;
- app chrome/features.

## Current Hierarchy issue

`packages/renderer-reactflow/src/styles.css` currently contains a large light-specific palette:
- light canvas gradients;
- white node cards;
- fixed folder-guide colors;
- fixed borders/focus outlines;
- fixed control/context surfaces.

It is not driven by the app theme.

## Phase 1 — Hierarchy theme contract

Define renderer-specific semantic roles for:

```text
canvas background
document node
section node
block node
diagnostic node
node text
muted text
node border
selected/highlighted
reference edge
hierarchy edge
secondary edge
folder guide fill/stroke/text
root/focus state
viewport controls
context/tooltip surface
focus outline
```

Resolve from shared `ResolvedTheme`.

No independent `prefers-color-scheme`.

## Phase 2 — Migrate React Flow renderer

Audit:

```text
packages/renderer-reactflow/src/styles.css
packages/renderer-reactflow/src/nodes.tsx
packages/renderer-reactflow/src/GraphCanvas.tsx
packages/renderer-reactflow/src/focus-schematic/*
```

and related presentation helpers/tests.

Preserve:
- node-kind grammar;
- Visual Groups;
- Focus appearance settings;
- edge semantics;
- folder guides;
- selection/highlight;
- reduced motion.

Do not change geometry/layout/routing.

## Phase 3 — Style-only theme switching

Switching theme while Hierarchy is mounted must not cause:

```text
layout worker request
layout fingerprint change
coordinate change
viewport reset
navigation change
Saved View mutation
cache miss caused only by theme
```

Theme must be excluded from layout/cache identity.

## Phase 4 — Cross-renderer semantic consistency

Review concepts across Network and Hierarchy:

```text
selected/focused
hover highlight
muted/secondary
warning/error diagnostic
Visual Group accent
```

They should feel related, not necessarily identical.

Do not flatten Hierarchy's richer node-kind grammar.

## Phase 5 — Production theme audit

Search:

```text
apps/web/src
packages/renderer-sigma/src
packages/renderer-reactflow/src
```

Classify remaining theme-related hard-coded colors:

```text
A. should become theme token
B. legitimate semantic/data color
C. development/lab-only
D. third-party/default
E. intentionally fixed branding/accent
```

Migrate A. Document non-obvious B–E.

Tools/labs need not be fully migrated unless user-facing production surfaces.

## Phase 6 — Regression guard

Add a lightweight maintainability guard to detect suspicious new hard-coded UI surface/text colors outside theme boundaries.

Prefer a simple repository script/test unless compatible lint tooling already exists.

Allow:
- theme definition files;
- Visual Group palette;
- diagnostic/data semantic colors;
- test fixtures;
- labs.

Do not impose a naive “no hex literals anywhere” rule.

## Final QA matrix

Test both themes across:

```text
All Network
Focus Network
All Hierarchy
Focus Hierarchy
Settings
Filters
Network Explorer
Inspector
Workspace
Argument Workspace
AI Review
maximized
small viewport
```

Live-switch:

```text
Light → Dark → Light
Dark → System
System while OS preference changes
```

Check:
- no startup/switch flash;
- no stale canvas palette;
- no dark canvas/light controls mismatch;
- no remount/layout jump;
- readable folder guides;
- readable diagnostics/status.

## Final architecture documentation

Finalize `docs/THEMING.md` with ownership:

```text
apps/web
  preference + resolved theme

shared theme layer
  theme IDs/core app tokens

renderer-sigma
  Network theme adapter

renderer-reactflow
  Hierarchy theme adapter
```

Rules:
- renderer never reads localStorage;
- renderer never owns system theme resolution;
- theme never enters layout fingerprint/cache identity;
- user/data colors are distinct from theme colors;
- new UI surfaces use semantic tokens;
- no independent feature-level OS-theme owner.

Archive prompt/status under `history-implementations/`.

## Validation

```bash
pnpm exec vitest run packages/renderer-reactflow
pnpm exec vitest run packages/renderer-sigma
pnpm exec vitest run apps/web
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile small
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Exit gate

1. Hierarchy fully supports Light/Dark.
2. Shared resolved theme drives Hierarchy.
3. Theme excluded from layout/cache identity.
4. All four Scope×Layout modes switch live.
5. App chrome/renderers remain coherent.
6. No independent feature media-query theme owners remain.
7. Remaining hard-coded production colors are classified/justified.
8. Lightweight regression guard exists.
9. `docs/THEMING.md` describes final ownership/rules.
10. Full validation/QA passes.

## Final report

Report:
- Hierarchy theme adapter;
- migrated files;
- proof theme excluded from layout/cache;
- audit counts A/B/C/D/E;
- guardrail;
- full Light/Dark QA matrix;
- fresh executable path.
