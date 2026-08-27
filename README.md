# Icarus Graph Explorer

Icarus Graph Explorer is an early-stage, hierarchical knowledge-graph explorer for Markdown workspaces. Its intended model treats documents, their nested sections, and optional addressable blocks as distinct entities so references can retain their precise source and target locations.

KG0 established the repository foundation, KG1 added the versioned canonical model, KG2 added deterministic CommonMark document/section structure parsing, KG3 added tested Obsidian syntax interpretation, KG4 added conservative workspace resolution plus validated canonical snapshot assembly, KG5 added a local diagnostic-report workflow, KG6 added renderer-independent disclosure and focus, KG7 added the projection-driven React Flow structural graph, KG8 added source-neutral provenance inspection, backlinks, canonical search, and targeted graph navigation, KG9 completed private app-owned stable identity plus local renderer-independent view restoration, and KG10 added file-granular parsed-document caching with exact stable snapshot deltas. Product vault access remains KG11.

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

Vite prints the local development URL. The page starts with a private-safe
synthetic structural graph and can load one locally generated report JSON
through the browser File API. The graph defaults to documents, supports
progressive structural disclosure and local focus, searches the complete
canonical snapshot for hidden entities, explains exact relationship
occurrences, and keeps KG5 evidence in a secondary expandable section.
Reports that explicitly declare stable identity also restore disclosure, focus,
visible graph filters, and a semantic entity-plus-zoom viewport bookmark from
browser-local storage. Search and selection remain transient. Legacy or
transient reports stay fully usable without cross-session persistence.

Generate a private local report with the development-only scanner:

```bash
pnpm diagnose:vault -- --vault "C:/path/to/vault" \
  --out output/diagnostics/local-report.json
```

With `--out`, the runner creates/reuses an adjacent private identity catalog and
embeds stable canonical IDs in the report. Supply `--workspace-id` only when an
explicit persistent workspace ID is required; use `--reset-identity` to discard
continuity explicitly. The recommended output directory is gitignored. A report contains paths,
headings, targets, spans, and relationships even though it excludes full source
text, and the separate catalog contains sensitive matching observations, so do
not commit or share either real-vault artifact.

Run the opt-in deterministic pipeline harness with:

```bash
pnpm benchmark:pipeline -- --profile medium
```

Its timings cover the source pipeline, cold/warm stable identity,
representative view projections, React
Flow mapping/Dagre layout, canonical inspection indexes, search, subtree
inspection, edge provenance, and incremental edit/add/delete/move scenarios
against exact full-rebuild oracles as local evidence, not CI budgets.

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
