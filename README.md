# Obsidian Upgrade Graph Explorer

> An advanced Graph Explorer for Obsidian that separates **what is connected** from **how those connections are organized and presented**.

**Obsidian Upgrade Graph Explorer** is a local-first, read-only desktop explorer for Obsidian / Markdown knowledge bases.

Obsidian's default graph already gives a useful network of links, but most of the organization is expressed through one force-directed spatial layout. That makes physics useful, but also makes it carry too much: global structure, local structure, clusters, hierarchy, and navigation all compete in the same visual system.

This project keeps the source-derived relationships independent from their presentation, then lets the same vault be reorganized through **Focus, hierarchy-aware views, filtering/grouping, folder-aware spatial rules, and different layouts** without changing the underlying links.

The project is still in active development. It is currently a standalone Tauri application rather than an Obsidian plugin, and the product surface is still being refined before a stable end-user release.

## Main idea

The goal is not merely to draw the same graph with different physics. It is to make the graph useful at different scales and for different kinds of organization.

```text
SOURCE TRUTH
files + headings + blocks + exact references
        ↓
SCOPE
All vault ↔ Focused neighborhood
        ↓
ORGANIZATION
filters + visual groups + folder spatial intent
        ↓
PRESENTATION
free network ↔ structured hierarchy
        ↓
INSPECTION
exact relationship provenance
```

This changes the graph in a few important ways:

- **Focus** can isolate one part of the vault instead of requiring the whole network to remain visually relevant at once.
- **Structured / hierarchy views** can open a file into headings, nested headings, and blocks, presenting internal structure more like connected modules than particles in one force simulation.
- **Global network views** remain available when broad topology is the useful question.
- **Filters and Visual Groups** can organize what is visible and how it is classified without rewriting links.
- **Folders can influence space** without pretending that folder membership is a semantic edge.
- **Link provenance stays precise underneath every view**, so collapsing, grouping, or rearranging the graph does not destroy where a relationship came from.

The core model is therefore more precise than a file-only graph:

```text
Document
  └─ Section
      └─ Section
          └─ optional addressable Block

Reference
  ├─ exact source entity + source span
  ├─ raw target
  └─ resolved / unresolved / ambiguous / invalid state
```

A view may collapse all of that back to simple File → File edges, but the underlying model keeps the original provenance.

## Current highlights

### Multi-scale exploration

The application separates different graph questions instead of forcing one renderer to solve everything:

```text
GLOBAL / ALL
whole-vault network

        ↓ focus

LOCAL / FOCUS
bounded neighborhood

        ↓ hierarchy detail

FILE → HEADING → BLOCK
```

Current presentations include:

- **Network** — high-density Sigma / Graphology rendering for broad vault exploration.
- **Hierarchy** — React Flow structural rendering for File / Heading / Block relationships.
- **Focus** — bounded local projections with incoming, outgoing, or bidirectional traversal.
- **Free vs Structured local views** — network-like local geometry or a more schematic hierarchy-oriented presentation.

The Focus Hierarchy redesign is also available as an experimental **Modular Preview**, while the existing Classic hierarchy remains preserved.

### Precise graph provenance

Selecting graph elements can expose:

- file and section breadcrumbs;
- exact source spans;
- outgoing references;
- backlinks;
- aggregated-edge provenance;
- unresolved / ambiguous / invalid targets;
- ambiguity candidates;
- internal collapsed relationships.

The graph is intended to remain an exploration surface over the source, not a replacement for it.

### Progressive disclosure

Large notes do not need to explode into every heading immediately.

The projection layer supports:

- Files only;
- selected heading depth;
- branch expansion / collapse;
- optional blocks;
- endpoint roll-up to the nearest visible ancestor;
- exact provenance underneath aggregated visible edges.

### Search, queries, filters, and visual groups

The explorer supports canonical search plus graph filtering over the projected view.

QUERY1 adds composable graph queries, including exact path / folder exclusions, while Visual Groups can classify visible entities for presentation without changing graph topology.

These systems intentionally remain separate:

```text
references     = source-derived semantic connections
queries        = selection / filtering
visual groups  = presentation rules
folders        = organizational / spatial information
layout         = coordinates
renderer       = drawing + interaction
```

### Folder-aware spatial organization

Network mode supports folder-aware spatial behavior without converting folders into graph edges.

The broader spatial architecture is designed around:

```text
automatic graph placement
+
optional folder-level spatial intent
+
future individual positioning / pinning
```

Folder clustering, directional hierarchy bands, manual movement, and persistent pinning are intentionally developed as separate layers rather than one giant physics/settings system.

### Local-first desktop vault workflow

The Tauri desktop app can open one explicitly selected vault and keep it live:

```text
selected local folder
→ read-only source acquisition
→ parse / resolve / stable identity
→ live filesystem watch
→ transactional incremental update
→ in-place graph refresh
```

The selected vault is never written to by the application.

Current architecture has:

- no backend;
- no account requirement;
- no cloud upload;
- no telemetry pipeline;
- no Markdown write path.

Workspace identity and saved view state stay local to the application.

### Performance is part of the architecture

The project benchmarks graph work independently from rendering and moves measured expensive work off the UI thread.

Current worker boundaries include:

- **W1** — stateful workspace parsing / resolution / diagnostics transactions;
- **W3** — stateless latest-result-wins Dagre layout;
- separate off-main network / schematic layout paths where appropriate.

Projection, inspection, rendering, and canonical source truth remain separate so renderer changes do not require redesigning the data model.

## A rough product picture

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Search / Query        Scope: All | Focus        Network | Hierarchy │
├───────────────┬───────────────────────────────────────┬─────────────┤
│ Explorer      │                                       │ Inspector   │
│               │                                       │             │
│ Folders       │               GRAPH                   │ Selected    │
│ Files         │                                       │ Breadcrumb  │
│ Saved queries │                                       │ Links       │
│               │                                       │ Backlinks   │
│               │                                       │ Provenance  │
├───────────────┴───────────────────────────────────────┴─────────────┤
│ local vault · live · read-only                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The exact UI is still evolving, but the intended direction is a graph-first workspace with compact controls and source-aware inspection rather than a large permanent diagnostics dashboard.

## Project status

The core platform is already substantial:

- hierarchical Markdown / Obsidian parsing;
- conservative whole-workspace reference resolution;
- stable app-owned entity and reference identity;
- renderer-independent projection and focus;
- provenance-first inspection, backlinks, search, and navigation;
- local persisted view state and semantic viewport restoration;
- incremental live-vault updates;
- high-density Global / Regional / Local exploration;
- React Flow structural views and Sigma network views;
- worker-backed performance architecture;
- QUERY1 filtering and Visual Groups;
- ongoing spatial, hierarchy-layout, accessibility, and release-quality work.

The repository is **not yet presenting itself as a finished Obsidian replacement graph**. Several product-level capabilities are still being refined or deliberately deferred, including richer folder layouts, final electronic/direct edge routing, persistent individual pinning, saved views, and additional release hardening.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the actual implementation status rather than assuming every planned feature already exists.

## Run it from source

### Prerequisites

- Node.js **22.13+** — Node.js 24 is used in CI.
- Corepack.
- Tauri platform prerequisites if building the desktop app.

### Install

```bash
corepack enable
pnpm install --frozen-lockfile
```

### Web development

```bash
pnpm dev
```

The browser build starts with a private-safe synthetic sample and can also load compatible local report JSON files.

### Desktop development

```bash
pnpm desktop:check
pnpm desktop:dev
```

In the desktop app, use:

```text
Settings → Source → Open Vault
```

to select a local vault.

A native production build can be created with:

```bash
pnpm desktop:build
```

### Validation

```bash
pnpm check
```

which runs formatting checks, ESLint, workspace typechecks, tests, and the production web build.

Individual commands:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Development-only diagnostics and benchmarks

Generate a private local diagnostic report with:

```bash
pnpm diagnose:vault -- --vault "C:/path/to/vault" \
  --out output/diagnostics/local-report.json
```

Real-vault reports and identity catalogs can contain private paths, headings, targets, spans, and matching observations. Keep them inside ignored output directories and do not commit or share them.

Representative benchmark entry points include:

```bash
pnpm benchmark:pipeline -- --profile medium
pnpm benchmark:performance -- --profile medium \
  --output output/performance/medium.json
pnpm benchmark:workspace-worker -- --profile medium
pnpm benchmark:dagre-worker -- --profile medium
pnpm benchmark:global-renderer
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:focus-schematic-layout -- --profile fixtures
```

Benchmarks are evidence and regression tools, not flaky CI timing gates.

## Architecture at a glance

```text
browser report / Tauri source provider
                ↓
        parser + Obsidian adapter
                ↓
      whole-workspace resolver
                ↓
       stable canonical snapshot
          ↙             ↘
 inspection/search    view projection
                         ↓
                layout / renderer
                         ↓
                        UI
```

The important boundary is that canonical source truth is plain, serializable data. It is not React Flow nodes, Sigma objects, Graphology topology, filesystem handles, or Tauri state.

That separation allows the same source model to support different projections, renderers, workers, and future analysis layers without making any of them authoritative.

## Repository map

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — engineering source of truth and dependency boundaries.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — implemented, active, and deferred milestones.
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — workload profiles, performance budgets, and worker evidence.
- [`docs/PRODUCT_QUALITY_AUDIT.md`](docs/PRODUCT_QUALITY_AUDIT.md) — product-quality and release-readiness audit.
- [`docs/decisions/`](docs/decisions/) — architecture decision records.
- [`AGENTS.md`](AGENTS.md) — compact repository guidance for coding agents.

## Design principles

1. **Precise source truth first.** Collapse information only in derived views.
2. **Local-first and read-only by default.** Vault exploration should not require uploading or rewriting notes.
3. **Different scales deserve different presentations.** Global network exploration and local structural inspection are not the same problem.
4. **Folders are not links.** Spatial grouping must not fabricate semantic relationships.
5. **Derived analytics are not source truth.** Queries, groups, communities, embeddings, and later AI-derived relationships should remain provenance-bearing layers.
6. **Measure before replacing architecture.** Renderer and worker choices are benchmark-driven.
7. **Keep the graph useful, not infinitely configurable.** Prefer strong defaults and a small number of meaningful controls over a graph-toy settings wall.
