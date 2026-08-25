# Web Application

Status: **DRAFT — KG0 foundation shell; product workflows are not implemented.**

This package owns the browser SPA, its Vite delivery configuration, and the
React presentation boundary. It proves that the web application can consume
the framework-independent core workspace package through a normal pnpm
workspace dependency.

## Current boundary

The current screen identifies the product and reports that the repository
foundation is ready. It deliberately does not claim that parsing, vault access,
reference resolution, or graph rendering exists.

Dependency direction is one way:

```text
apps/web -> @icarus-graph-explorer/core
```

The web package may translate canonical data and view state into UI later.
`packages/core` must never import this package or React-specific types.

## File map

```text
apps/web/
  index.html          Browser document shell and page metadata.
  package.json        Runtime dependencies and package-local commands.
  tsconfig.json       DOM, React JSX, Vite, and Node tool typing.
  vite.config.ts      Vite's React integration.
  src/
    main.tsx          Validates the root element and mounts the React app.
    App.tsx           Accessible KG0 foundation status screen.
    App.test.tsx      Server-rendered smoke contract for current copy/scope.
    App.css           Status-screen layout and component styling.
    index.css         Document-level defaults and box sizing.
```

`main.tsx` owns browser startup. `App.tsx` owns only the current presentation;
it reads temporary product metadata from core. The test renders `App` without a
browser so the KG0 contract remains fast and deterministic.

## Local validation

Run the repository commands from the repository root:

```bash
pnpm dev
pnpm test
pnpm build
pnpm check
```

## Deferred

Graph controls, application state, source selection, parsing, rendering, and
platform integration belong to later roadmap milestones. Their future mention
does not authorize adding dependencies or placeholder abstractions here.
