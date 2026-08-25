# Core Foundation

Status: **DRAFT — package boundary only; KG1 domain contracts are undefined.**

This package is the innermost, framework-independent workspace boundary. KG0
uses it only to prove package direction and consumption from the web app. KG1
will design the serializable hierarchical-document domain and its fixture
contracts.

## Current boundary

Core may own generic, serializable knowledge contracts. It must not know about
React, React Flow, Sigma, Graphology runtime objects, Tauri, Obsidian application
APIs, or the web package.

ESLint's `no-restricted-imports` configuration mechanically rejects those
obvious dependency violations. Architectural rationale and the full dependency
direction live in `../../docs/ARCHITECTURE.md`.

## File map

```text
packages/core/
  package.json       Source export, package identity, and typecheck command.
  tsconfig.json      Strict framework-independent TypeScript configuration.
  src/
    index.ts         Temporary immutable KG0 product metadata export.
    index.test.ts    Contract proving the export is stable and immutable.
```

The source export is intentional for this private workspace package: Vite
consumes it through `@icarus-graph-explorer/core`, while both packages remain
independently typechecked. `foundationIdentity` is scaffolding, not the
canonical knowledge model.

## Local validation

Run focused or repository-wide checks from the repository root:

```bash
pnpm --filter @icarus-graph-explorer/core typecheck
pnpm exec vitest run packages/core/src/index.test.ts
pnpm check
```

## KG1 boundary

KG1 should introduce explicit, serializable contracts for documents, nested
sections, optional addressable blocks, references, source spans, identities,
and resolution outcomes. It must use synthetic fixtures and must not pull
Markdown parsing, Obsidian syntax, renderer ownership, or platform APIs into
core prematurely.
