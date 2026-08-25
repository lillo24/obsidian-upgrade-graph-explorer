# Icarus Graph Explorer

Icarus Graph Explorer is an early-stage, hierarchical knowledge-graph explorer for Markdown workspaces. Its intended model treats documents, their nested sections, and optional addressable blocks as distinct entities so references can retain their precise source and target locations.

KG0 established the repository foundation. KG1 adds a versioned, runtime-validated canonical model and synthetic fixture conventions. Markdown parsing, Obsidian syntax interpretation, workspace resolution, vault access, and graph rendering are not implemented yet.

The application is local-first and read-only with respect to Markdown. The initial architecture has no backend, account, cloud upload, telemetry, or source-file write path.

## Prerequisites

- Node.js 22.13 or newer (Node.js 24 is used in CI)
- Corepack, included with supported Node.js distributions

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
```

The package-manager version is pinned in `package.json`, so Corepack selects the repository's expected pnpm release.

## Development

```bash
pnpm dev
```

Vite prints the local development URL. The current page is deliberately a model-readiness status screen, not a working graph explorer.

## Validation

```bash
pnpm check
```

The individual commands are:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Repository guidance

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the engineering source of truth for dependency direction and product boundaries.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) distinguishes implemented work from deliberately deferred milestones.
- [`docs/decisions/`](docs/decisions/) records costly foundational decisions.
- [`AGENTS.md`](AGENTS.md) is the short entry point for coding agents.
