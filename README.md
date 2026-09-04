# Icarus Graph Explorer

Icarus Graph Explorer is an early-stage, hierarchical knowledge-graph explorer for Markdown workspaces. Its intended model treats documents, their nested sections, and optional addressable blocks as distinct entities so references can retain their precise source and target locations.

The source-neutral workspace includes `packages/focus-schematic`, which owns
the HIER1 File-module semantic contract and common future-layout quality
harness. `packages/focus-schematic-layout` adds the HIER2 renderer-neutral,
stateless two-stage Dagre architecture behind a narrow API. HIER3 production
integration remains next; neither package is part of the production renderer
graph yet.

KG0 established the repository foundation, KG1 added the versioned canonical model, KG2 added deterministic CommonMark document/section structure parsing, KG3 added tested Obsidian syntax interpretation, KG4 added conservative workspace resolution plus validated canonical snapshot assembly, KG5 added a local diagnostic-report workflow, KG6 added renderer-independent disclosure and focus, KG7 added the projection-driven React Flow structural graph, KG8 added source-neutral provenance inspection, backlinks, canonical search, and targeted graph navigation, KG9 completed private app-owned stable identity plus local renderer-independent view restoration, KG10 added file-granular parsed-document caching with exact stable snapshot deltas, and KG11 completes the Tauri local-vault workflow from secure selection through coalesced live updates, transactional KG10 application, recovery resync, and in-place view preservation. KG12 establishes repeated baselines and Class A/B/C budgets, moves stateful KG10 plus diagnostics into a transactional W1 worker, and moves stateless Dagre layout into a latest-result-wins W3 worker.

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
occurrences, and keeps KG5 evidence in a secondary Developer dialog launched
from Settings.
Reports that explicitly declare stable identity also restore disclosure, focus,
visible graph filters, and a semantic entity-plus-zoom viewport bookmark from
browser-local storage. Search and selection remain transient. Legacy or
transient reports stay fully usable without cross-session persistence.

For the KG11A desktop application:

```bash
pnpm desktop:check
pnpm desktop:dev
pnpm desktop:build
```

The native **Settings → Source → Open Vault** action reads and watches one
explicitly selected folder locally, initializes KG10 in a dedicated worker, and renders committed
updates through the same graph/inspector UI without remounting the current
workspace.
The vault is never modified or uploaded. Native folder authorization lasts for
the process, so the folder must be selected again after restart; app-local
identity and the stable saved graph view are then recovered by exact root match.
Watcher bursts use a 250 ms quiet window and feed serialized, transactional
updates. **Settings → Source → Rescan Vault** performs a complete read-only
recovery using the same stable workspace/catalog and preserves the current
renderer-independent view.

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
pnpm benchmark:performance -- --profile medium \
  --output output/performance/medium.json
pnpm benchmark:workspace-worker -- --profile medium
pnpm benchmark:workspace-worker -- --profile large
pnpm benchmark:dagre-worker -- --profile small
pnpm benchmark:dagre-worker -- --profile medium
pnpm benchmark:focus-schematic-layout -- --profile fixtures
pnpm generate:focus-schematic-layout-lab -- --out output/hier2-layout-lab
```

Its timings cover the source pipeline, cold/warm stable identity,
representative view projections, React
Flow mapping/Dagre layout, canonical inspection indexes, search, subtree
inspection, edge provenance, and incremental edit/add/delete/move scenarios
against exact full-rebuild oracles as local evidence, not CI budgets. The
KG12A command adds repeated statistics, all required projection shapes,
operation counts, explicit unsafe-phase omissions, and a strict aggregate-only
result schema. Raw results stay ignored. See
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) for budgets, worker evidence, and the completed KG12 split.

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

Interactive component regressions use Vitest's `happy-dom` environment with
React DOM; pure model tests keep the default Node environment.

## Repository guidance

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the engineering source of truth for dependency direction and product boundaries.
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) records KG12 workloads, budgets, and W1/W3 worker evidence.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) distinguishes implemented work from deliberately deferred milestones.
- [`docs/decisions/`](docs/decisions/) records costly foundational decisions.
- [`AGENTS.md`](AGENTS.md) is the short entry point for coding agents.
