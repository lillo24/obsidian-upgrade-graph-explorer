# Theme contract

This package owns the source-neutral application theme vocabulary shared by the
web shell and renderer packages.

- `src/index.ts` defines the persisted preference choices, the resolved runtime
  theme, strict preference validation, and system-theme resolution.

Persistence, browser media queries, DOM attributes, and CSS tokens remain owned
by the web application. Renderers depend only on `ResolvedTheme`.
