# THEMESYS1 — Application theme foundation, runtime resolution, and semantic tokens

**Task type:** architecture foundation / appearance preferences / no broad visual redesign

## Goal

Create a robust application-wide theming foundation before migrating individual surfaces.

The product must have one explicit theme model:

```text
ThemePreference = system | light | dark
ResolvedTheme   = light | dark
```

with one authoritative runtime owner that:
- loads/persists the preference;
- resolves `system` against `prefers-color-scheme`;
- reacts to OS changes only while preference = `system`;
- applies the resolved theme at one root boundary;
- exposes it to renderers without renderers reading storage/DOM/media queries.

Do not attempt to recolor every component in this task.

## Repository baseline

Repository:

```text
lillo24/obsidian-upgrade-graph-explorer
```

Observed `main`:

```text
d86337c77b02710eccb6fc5bad45844aeb9994cc
```

Current theme ownership is fragmented:
- `apps/web/src/index.css` hard-codes `color-scheme: light`;
- `apps/web/src/App.css` contains many hard-coded light colors;
- `workspace.css`, `arguments.css`, and `review.css` contain independent dark `prefers-color-scheme` overrides;
- Network has its own hard-coded Obsidian dark palette;
- there is no repository-wide explicit theme preference / root theme attribute.

## Architecture requirements

### Theme types

Create a source-neutral contract equivalent to:

```ts
type ThemePreference = 'system' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';
```

Theme is app-wide. Do not store it in Saved Views or workspace state.

### Semantic application tokens

Define roles rather than component colors.

At minimum:

```text
surface:
  app
  chrome
  panel
  elevated
  input
  hover
  selected
  overlay

text:
  primary
  secondary
  muted
  inverse

border:
  subtle
  default
  strong
  focus

accent:
  primary
  hover
  soft

status:
  info
  success
  warning
  error
```

Status roles should support foreground/background/border.

Avoid component-specific token names such as `argumentsSidebarBlue`.

### Runtime root

Apply one authoritative resolved theme to a stable root, e.g.:

```html
<html data-theme="dark">
```

or an equivalent app root.

Set `color-scheme` from resolved theme rather than leaving it permanently light.

### Persistence

Prefer a dedicated app/appearance preference boundary, not `graph-preferences.ts`, because graph preferences already own graph-specific appearance/interaction.

Use existing defensive localStorage patterns:
- versioned key/schema;
- strict validation;
- corrupt data fallback;
- storage unavailable fallback;
- session remains usable after write failure.

Default preference should be `system` unless current repository policy says otherwise.

### No-flash startup

Inspect Vite/desktop bootstrap and avoid obvious light→dark startup flash.

Do not create two competing theme owners.

### Settings

Add a small Theme selector under ordinary Preferences:

```text
System
Light
Dark
```

Immediate update, keyboard accessible, persisted.

Do not redesign Settings.

### Renderer boundary

Renderers must not use these as theme authority:

```text
localStorage
matchMedia
document.dataset
getComputedStyle
```

The app passes resolved theme / theme ID through an explicit seam.

Do not migrate renderer colors yet; just create the seam.

## Suggested organization

Inspect repository boundaries first.

A likely clean shape is:

```text
packages/theme/                  optional shared theme types/core tokens
apps/web/src/theme/              runtime resolver/provider
apps/web/src/preferences/        appearance preference persistence
```

Do not create a new package if an existing shared package is a clearly better fit.

## Minimal visual migration

Migrate only enough root/shared styling to prove the architecture:
- root app background;
- root foreground;
- generic focus surface;
- one shared control smoke case.

Do not mass-migrate `App.css` or feature CSS here.

## Tests

Cover:
- preference validation;
- corrupt/unavailable storage;
- system resolution;
- OS change in System mode;
- OS change ignored in explicit Light/Dark;
- root theme marker updates;
- correct `color-scheme`;
- theme absent from Saved Views/workspace state;
- renderer seam receives resolved theme.

## Documentation

Add:

```text
docs/THEMING.md
```

Document ownership, preference vs resolved theme, semantic token categories, renderer boundary, and migration sequence.

Archive this prompt in `history-implementations/`.

## Validation

Run current equivalents of:

```bash
pnpm check
pnpm desktop:check
pnpm desktop:build
git diff --check
```

## Exit gate

1. One theme preference owner.
2. `system | light | dark` persisted/validated.
3. One resolved `light | dark` runtime source of truth.
4. Correct OS-change behavior.
5. No obvious startup theme flash.
6. Correct root theme marker and `color-scheme`.
7. Settings Theme selector exists.
8. Renderers do not resolve theme independently.
9. Theme is absent from Saved Views/workspace state.
10. Semantic contract is documented.
11. Only minimal smoke surfaces migrated.
12. Full validation passes.

## Final report

Report:
- theme files/packages;
- persistence key/schema;
- runtime/root mechanism;
- no-flash strategy;
- Settings integration;
- renderer seam;
- work intentionally deferred to THEMESYS2–4.
