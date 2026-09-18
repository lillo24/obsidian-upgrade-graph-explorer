# THEMESYS3 — Migrate app shell and feature UI to semantic theme tokens

**Depends on:** THEMESYS1

## Goal

Migrate production DOM UI from scattered hard-coded colors and feature-local `prefers-color-scheme` blocks to the shared semantic theme system.

This task excludes React Flow/Hierarchy renderer internals; those belong to THEMESYS4.

## Current problem

Theme-dependent production colors currently live in:

```text
apps/web/src/index.css
apps/web/src/App.css
apps/web/src/features/workspace/workspace.css
apps/web/src/features/arguments/arguments.css
apps/web/src/features/ai-review/review.css
```

Some features independently react to OS dark mode while the root historically forced `color-scheme: light`.

Target:

```text
one resolved theme
→ one semantic token layer
→ DOM UI consumes it
```

## Migration method

Classify existing colors by semantic role before replacing them.

### Surface roles

```text
app/root
workspace
toolbar
sidebar
panel/card
elevated/dialog
input/control
hover
selected
subtle inset
backdrop/overlay
```

### Text roles

```text
primary
secondary
muted
faint
inverse
accent/link
```

### Borders/focus

```text
subtle
default
strong
focus
```

### Interactive

```text
button
button hover
button active/selected
disabled
```

### Status

```text
info
success
warning
error
synthetic/development warning
```

Preserve status meaning in Light and Dark.

## Source-of-truth rule

After migration, production DOM component CSS should consume THEMESYS1 semantic variables.

Remove independent theme authority such as:

```css
@media (prefers-color-scheme: dark) { ... }
```

where it exists only for theming.

The explicit app-resolved theme is authoritative.

## Audit scope

At minimum inspect/migrate:

```text
apps/web/src/index.css
apps/web/src/App.css

apps/web/src/components/*
  toolbar
  GraphSettings
  GraphFilters
  Network Explorer
  Inspector
  search/results
  Saved Views
  Visual Groups

apps/web/src/features/workspace/workspace.css
apps/web/src/features/arguments/arguments.css
apps/web/src/features/ai-review/review.css
```

Search other production CSS/inline styles too.

Do not migrate:
- user-selected Visual Group colors;
- semantic data colors;
- Network renderer palette (THEMESYS2);
- Hierarchy renderer palette (THEMESYS4).

## Preserve behavior/layout

Do not alter:
- sizing/spacing;
- panel placement;
- toolbar layout;
- focus order;
- keyboard behavior;
- dialog behavior;
- graph state;
- Settings tabs.

This is theme architecture/presentation.

## Theme selector

Use the THEMESYS1 selector. If it was deliberately deferred there, wire it now under ordinary Preferences.

Do not create a second setting.

## Accessibility

For both themes:
- focus indicators visible;
- disabled controls distinguishable;
- pressed/selected states clear;
- warnings/errors readable;
- muted/placeholder text not too faint.

Use contrast checks where appropriate.

## Token hygiene

Local aliases are okay when meaningful:

```css
.component {
  --component-border: var(--theme-border-subtle);
}
```

Avoid aliases that merely rename literals.

## Tests

Prove:
- root theme switch updates app surfaces;
- explicit Light/Dark ignore OS preference;
- System follows OS;
- dialogs/features inherit app theme rather than owning media-query themes;
- selected/hovered/focus states remain clear;
- no persistence/view-state changes.

A source audit script/test may identify remaining suspicious hard-coded UI surface/text colors, but do not prohibit legitimate semantic/data colors.

## QA matrix

Review Light and Dark for:

```text
main workspace chrome
Settings
Filters
Network Explorer
Inspector
Saved Views
Visual Groups
Workspace dialog
Argument Workspace
AI Review
search/results
empty/error/warning states
maximized graph mode
small viewport
```

Switch theme while dialogs are open.

## Documentation

Update:
- `docs/THEMING.md`
- `apps/web/README.md`

Archive prompt/status under `history-implementations/`.

## Validation

```bash
pnpm exec vitest run apps/web
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Exit gate

1. App shell uses semantic tokens.
2. Main components use semantic tokens.
3. Workspace/Arguments/AI Review no longer own independent OS-dark theme authority.
4. Theme selector updates all migrated surfaces immediately.
5. Light and Dark are complete for DOM chrome/features.
6. Status states remain clear.
7. No layout/interaction regressions.
8. No view/persistence schema changes.
9. Remaining hard-coded production colors are justified/documented.
10. Validation passes.

## Final report

Report:
- CSS files migrated;
- token categories used;
- removed media-query owners;
- remaining literals and rationale;
- Light/Dark QA;
- fresh executable path.

