# Architecture

## Status and purpose

This document is the engineering source of truth for the Markdown Structure Graph Explorer. KG0 implements only a React/Vite shell and a framework-independent workspace package; parsing, source adapters, resolution, graph projections, renderers, persistence, and local filesystem access remain planned work.

The product will explore the structure of Markdown knowledge workspaces. Unlike a file-only graph, it must retain the hierarchy inside a document and attribute references to the precise section or addressable block where they occur. A renderer may collapse those relationships into file-level edges, but the canonical source-derived data must retain their original precision.

## Stable domain shape

The deliberate general abstraction is a hierarchical document:

```text
Document
  └─ Section
      └─ Section
          └─ optional addressable Block
```

References connect addressable entities and retain source locations. This project is not a universal arbitrary-data graph platform. KG1 will define the exact serializable contracts for documents, sections, optional blocks, references, spans, identities, and diagnostics.

Core terminology must remain source-neutral. `Document`, `Section`, `Reference`, `SourceSpan`, and `SourceProvider` are appropriate concepts; types such as `ObsidianFileNode` or `ObsidianWikilinkEdge` are not. Obsidian is an adapter for wikilinks, aliases, embeds, block references, frontmatter conventions, and Obsidian-specific target resolution. Plain Markdown and future adapters must be able to feed the same canonical boundary.

## Dependency direction

Dependencies point from source/platform details and UI toward stable domain contracts, never in the reverse direction. Names will evolve, but this direction is an invariant:

```text
SourceProvider
  → workspace / parser / source adapter / resolver
  → canonical snapshot and deltas
  → derived indexes
  → view projection
  → renderer
  → UI

ViewStateStore
  → view projection / UI
```

The canonical snapshot and delta formats must be plain, serializable data. They must not contain React elements, renderer objects, Graphology graphs, Tauri handles, or source-provider objects. This keeps worker transfer, deterministic tests, caching, and renderer replacement possible.

`packages/core` is currently the innermost workspace boundary. It must not import React, React DOM, React Flow, Sigma, Graphology, Tauri, Obsidian application APIs, or code from `apps/web`. ESLint mechanically rejects those obvious imports. Later packages should be created only when they contain real implementation, with dependency direction enforced at their narrowest stable boundary.

## Source truth and view state

Source-derived knowledge and application-owned visualization state are separate domains.

Source truth will include document structure, source-backed metadata, references, source spans, and resolution results. View state will include hidden/collapsed state, selection, pins, manual positions, filters, viewport, saved views, and renderer preferences. A UI action such as hiding, moving, or pinning an entity must never mutate source truth. Early releases are read-only with respect to Markdown.

Renderers receive projections formed from canonical source truth plus view state. A file-level projection may aggregate several section-level references; it must not replace or degrade the canonical relationships. React Flow, Sigma, and Graphology must never own persisted or canonical truth.

## Resolution and diagnostics

Accuracy is more important than plausible guesses. Resolver contracts must explicitly represent at least `resolved`, `unresolved`, `ambiguous`, and `invalid` outcomes and retain useful diagnostics/source spans. An adapter or resolver must not silently choose an arbitrary candidate. Synthetic tests should make uncertain behavior visible and reproducible.

## Trust and privacy boundary

The initial product is local-first:

- no required backend or account;
- no cloud upload or remote processing of workspace content;
- no telemetry or analytics;
- no source-file write-back;
- application-owned caches and view state may be stored locally.

Remote capabilities, collaboration, or source editing would require an explicit later trust decision. Private workspace material must not enter repository fixtures or logs. Bugs discovered in the Icarus vault must be reduced to small synthetic examples before they are committed.

## UI, renderer, and platform roles

React and Vite implement the SPA shell; they are outer-layer delivery choices, not domain dependencies. React Flow is the planned first structural renderer because the early product emphasizes interactive, hierarchical views. Sigma is conditional and may be added only when benchmark evidence demonstrates a need for a separate high-density global renderer. Graphology may later provide derived runtime indexes and algorithms, but its data structure is not canonical or persisted.

Tauri is deferred until the local-vault workflow milestone. It may provide desktop filesystem capabilities through a narrow source-provider boundary. Tauri commands, paths, events, and handles must not leak into generic core packages. Browser and future platform providers should remain viable.

None of React Flow, Sigma, Graphology, or Tauri is installed in KG0.

## Performance principles

Performance work begins with boundaries and measurement:

- parse incrementally at file granularity when parsing exists;
- communicate through serializable snapshots and deltas;
- introduce workers only after measured UI-thread cost justifies them;
- project only the graph needed for the active view;
- keep React subscriptions narrow;
- benchmark realistic synthetic and private-local workspaces before selecting a high-density renderer;
- prefer explicit diagnostics over fast but uncertain resolution.

Rust, WASM, universal graph abstractions, and million-node optimization are not foundation requirements.

## Testing philosophy

Vitest is the unit and contract test foundation. Domain work should favor deterministic, table-driven tests against small synthetic Markdown fixtures. Adapter tests must separate generic Markdown behavior from Obsidian-specific behavior. Snapshot/delta and projection tests should assert serializability and preservation of section-level precision.

Playwright may be introduced when end-to-end UI flows exist; it is intentionally absent in KG0. Real-vault validation remains local and diagnostic. Any regression committed to the repository must be synthetic and free of private theory content.

## Changing these decisions

Change an expensive decision through a focused ADR that supplies evidence: a product requirement, compatibility constraint, measurement, or demonstrated failure of the current boundary. Roadmap speculation alone is not evidence. Keep documentation clear about what is implemented now, what is an invariant, and what is only planned.
