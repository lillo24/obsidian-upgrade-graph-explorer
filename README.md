# Obsidian Upgrade Graph Explorer

> A local-first graph explorer for Obsidian vaults that adds **Focus, structured File/Heading/Block views, folder-aware spatial organization, and precise link provenance** on top of the ordinary network graph.

Obsidian's graph is useful because it lets the links themselves create a spatial map. But that same strength is also a limit: once the vault gets large, a force-directed network has to express everything at once — importance, clusters, local neighborhoods, hierarchy, folders, and navigation.

**Obsidian Upgrade Graph Explorer** keeps the links as the source of truth, but stops asking one physics layout to do every job.

The same vault can be explored as a broad network, narrowed into a focused neighborhood, unfolded into the internal structure of notes, or reorganized spatially using folders — without turning those organizational choices into fake links.

The project is in active development and currently runs as a standalone Tauri desktop app rather than an Obsidian plugin.

## What changes compared with a normal graph

### Focus becomes a first-class way to explore

Instead of always working inside the whole vault, you can pick a File and make its neighborhood the graph you are working with.

```text
whole vault
    ↓
select a File
    ↓
Focus
    ↓
1 / 2 / 3 hops
incoming / outgoing / both
```

The important part is that Focus is not a separate disposable view. The same focused neighborhood can then be shown as a network or as a structured hierarchy, while navigation, inspection, and saved view state continue to refer to the same underlying entities.

This makes the graph useful for questions like:

- What is directly feeding into this idea?
- What does this note influence?
- What is two steps away without keeping the rest of the vault on screen?
- What happens if I expand the internal structure of only this local region?

### A File can unfold into its real internal structure

A normal graph usually treats a note as one node.

Here a note can progressively unfold:

```text
Language.md
├─ Meaning
├─ Grammar
│  ├─ Syntax
│  └─ Morphology
└─ Pragmatics
```

Links can then attach to the File, a specific Heading, or an addressable Block instead of being forced to look like generic File → File relationships.

That allows a local graph to become much more schematic:

```text
File
 ├─ Heading
 │   ├─ Heading
 │   └─ Block
 └─ Heading

             ─────→ another File / Heading / Block
```

You can keep the compact File-only view when that is enough, then expand structure only where it becomes useful.

### Folders can influence space without becoming links

Folder membership is organizational information, not semantic topology.

The explorer keeps that distinction explicit:

```text
references
→ determine what is connected

folders
→ can influence where connected things are placed
```

In Network views, folders can act as a soft spatial tendency.

In the experimental structured Focus work, folders are being developed as stronger spatial bands / regions while the actual incoming and outgoing reference structure stays intact.

So a folder can help the eye read the graph without inventing relationships such as:

```text
same folder = connected
```

### One set of links can have different useful layouts

The project deliberately does not assume that one renderer or one geometry is best at every scale.

Current direction:

```text
ALL
↓
Network
high-density whole-vault topology

        ↓ Focus

FOCUS
├─ Network
│  freer local relationship view
│
└─ Hierarchy
   File / Heading / Block schematic view
```

The Network view is useful when the topology itself should shape the space.

The Hierarchy view is useful when the internal organization of notes matters more than preserving one large force simulation.

The newer **Modular Focus Hierarchy** is currently available as an experimental preview while the previous Classic hierarchy remains preserved.

### Collapsing the graph does not throw away where links came from

A compact view may show:

```text
File A ─────→ File B
```

while the source actually contains several more precise relationships:

```text
File A
└─ Heading X ─────→ Heading Y

File A
└─ Heading Z ─────→ File B
```

The explorer can roll those relationships up for readability while retaining the authored occurrences underneath.

That means expanding a note can recover the more precise endpoints instead of creating a new interpretation of the graph from scratch.

The Inspector can also trace visible relationships back to their source location, resolution state, backlinks, ambiguity candidates, and aggregated occurrences.

## A typical exploration

A useful way to understand the intended workflow is:

```text
Open vault
   ↓
see the whole network
   ↓
find an interesting File
   ↓
enter Focus
   ↓
choose incoming / outgoing / both
   ↓
switch to Hierarchy
   ↓
expand the File's Headings
   ↓
see which parts of the note connect to which surrounding Files
   ↓
let folder organization help separate the surrounding space
   ↓
inspect a connection when you need its exact source
```

The graph can stay simple until you ask for more structure.

## Supporting tools

The explorer also includes the kinds of controls expected from a serious graph workspace:

- search;
- graph queries and exclusions;
- filters;
- visual groups;
- folder/file side exploration;
- backlinks and outgoing links;
- navigation history;
- persisted view state;
- live vault updates.

These are useful, but they are not the main reason the project exists. The core direction is **better ways to organize and move through the same link structure** rather than adding more decoration to a force graph.

## Local-first and read-only

The desktop app opens a vault you explicitly select and keeps it live as files change.

```text
local vault
→ read
→ parse / resolve links
→ keep stable graph identity
→ watch for changes
→ update the current graph in place
```

The vault itself is not modified.

Current architecture has:

- no backend requirement;
- no account requirement;
- no cloud upload;
- no telemetry pipeline;
- no Markdown write path.

Workspace identity and saved graph state stay local to the application.

## Current status

The project already has working foundations for:

- Obsidian / Markdown parsing;
- File, Heading, nested Heading, and Block entities;
- exact and aggregated link provenance;
- stable identity across normal vault edits;
- whole-vault and Focus projections;
- Network and Hierarchy presentations;
- progressive structural expansion;
- canonical search and navigation;
- backlinks and provenance inspection;
- live filesystem updates;
- local saved view state;
- worker-backed expensive layout / workspace processing;
- QUERY1 filtering and Visual Groups;
- folder-aware Network placement;
- experimental Modular Focus Hierarchy and directional folder-layout work.

Still being refined or intentionally deferred:

- final Modular Focus Hierarchy geometry;
- non-directional soft folder clusters for Hierarchy;
- final Direct / Electronic / Electronic-Rounded edge routing;
- stronger saved-view workflows;
- persistent manual positioning / pinning;
- release hardening and packaging.

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the implementation-level status.

## Run it from source

### Prerequisites

- Node.js **22.13+**
- Corepack
- Tauri platform prerequisites for the desktop build

### Install

```bash
corepack enable
pnpm install --frozen-lockfile
```

### Web development

```bash
pnpm dev
```

The browser build starts with a synthetic sample and can load compatible local report JSON files.

### Desktop development

```bash
pnpm desktop:check
pnpm desktop:dev
```

Then use:

```text
Settings → Source → Open Vault
```

A production desktop build can be created with:

```bash
pnpm desktop:build
```

### Validation

```bash
pnpm check
```

This runs formatting checks, linting, workspace typechecks, tests, and the production web build.

## For contributors

The implementation is intentionally split so that source truth, projection, layout, and rendering do not become the same thing.

That separation is what allows the same vault relationships to support:

```text
whole-vault Network
focused Network
structured Hierarchy
folder-aware placement
collapsed or expanded structure
precise provenance
```

without one presentation becoming authoritative.

The technical details live in:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture and dependency boundaries.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — active and deferred implementation tracks.
- [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) — performance evidence and worker boundaries.
- [`docs/PRODUCT_QUALITY_AUDIT.md`](docs/PRODUCT_QUALITY_AUDIT.md) — release/product-quality audit.
- [`docs/decisions/`](docs/decisions/) — architecture decision records.
- [`AGENTS.md`](AGENTS.md) — repository instructions for coding agents.

## Design principles

1. **Links remain semantic truth.** Layout, folders, groups, and queries may organize them, but should not fabricate relationships.
2. **Structure should appear on demand.** A vault can stay File-level until Heading/Block detail becomes useful.
3. **Global and local exploration are different problems.** The product should not force one geometry to solve both.
4. **Organization should survive presentation changes.** Focus, provenance, and source identity should not disappear when switching layouts.
5. **Local-first and read-only by default.** Exploring a vault should not require uploading or rewriting it.
6. **Measure before replacing architecture.** Expensive graph work and renderer choices are benchmarked rather than guessed.
7. **Prefer a few meaningful controls over a graph-toy settings wall.**
