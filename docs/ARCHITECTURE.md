# Architecture

## Status and purpose

This document is the engineering source of truth for the Markdown Structure Graph Explorer. KG0 established the React/Vite shell and framework-independent workspace package. KG1 implements canonical snapshot schema version 1 and fixture conventions; parsing, source adapters, workspace resolution, graph projections, renderers, persistence, and local filesystem access remain planned work.

The product will explore the structure of Markdown knowledge workspaces. Unlike a file-only graph, it must retain the hierarchy inside a document and attribute references to the precise section or addressable block where they occur. A renderer may collapse those relationships into file-level edges, but the canonical source-derived data must retain their original precision.

## Stable domain shape

The deliberate general abstraction is a hierarchical document:

```text
Document
  └─ Section
      └─ Section
          └─ optional addressable Block
```

Schema version 1 stores addressable `Document`, `Section`, and `Block` entities in one array. Documents are roots; sections and blocks have one document/section parent. Section titles are content rather than identity, heading levels are 1–6, and skipped nested levels are valid. Opaque non-empty string IDs allow later identity infrastructure without making paths or titles permanent identity.

Every entity retains a normalized workspace-relative source path and a half-open source span. Paths use forward slashes with no leading slash, drive prefix, empty component, `.` component, or `..` traversal. Lines and columns are 1-based. Optional offsets are 0-based JavaScript UTF-16 code-unit indexes and appear on both span endpoints or neither.

References retain their source entity, exact syntax span, raw target, and `link`/`embed` kind separately from a discriminated `resolved`, `unresolved`, `ambiguous`, or `invalid` result. A document may own a preamble reference; sections and blocks may provide more precise ownership. This project is not a universal arbitrary-data graph platform.

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

The canonical snapshot is a versioned plain-data envelope containing workspace identity, entity arrays, and reference arrays. Future delta formats must follow the same serializable boundary. Neither may contain React elements, renderer objects, Graphology graphs, Tauri handles, parser ASTs, or source-provider objects. This keeps worker transfer, deterministic tests, caching, and renderer replacement possible.

`packages/core` is currently the innermost workspace boundary. It must not import React, React DOM, React Flow, Sigma, Graphology, Tauri, Obsidian application APIs, or code from `apps/web`. ESLint mechanically rejects those obvious imports. Later packages should be created only when they contain real implementation, with dependency direction enforced at their narrowest stable boundary.

## Source truth and view state

Source-derived knowledge and application-owned visualization state are separate domains.

Canonical source truth now includes document structure, references, source spans, and explicit resolution results. Later source-backed fields may be added only for concrete requirements. View state will include hidden/collapsed state, selection, pins, manual positions, filters, viewport, saved views, and renderer preferences. A UI action such as hiding, moving, or pinning an entity must never mutate source truth. Early releases are read-only with respect to Markdown.

Renderers receive projections formed from canonical source truth plus view state. A file-level projection may aggregate several section-level references; it must not replace or degrade the canonical relationships. React Flow, Sigma, and Graphology must never own persisted or canonical truth.

## Resolution and diagnostics

Accuracy is more important than plausible guesses. The reference contract explicitly represents `resolved`, `unresolved`, `ambiguous`, and `invalid` outcomes. Ambiguous results retain at least two distinct candidates and never select one silently; optional or required reason strings explain non-resolved states. Runtime validation rejects contradictory fields and missing endpoints. Future adapters and resolvers must preserve these semantics.

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

None of React Flow, Sigma, Graphology, or Tauri is installed through KG1.

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

Vitest is the unit and contract test foundation. KG1 validates one representative synthetic JSON snapshot and uses focused test builders for malformed variants, including a stringify/parse/validate round trip. Future domain work should favor deterministic, table-driven tests against small synthetic Markdown fixtures. Adapter tests must separate generic Markdown behavior from Obsidian-specific behavior. Snapshot/delta and projection tests should assert serializability and preservation of section-level precision.

Playwright may be introduced when end-to-end UI flows exist; it remains intentionally absent through KG1. Real-vault validation remains local and diagnostic. Any regression committed to the repository must be synthetic and free of private theory content.

## Changing these decisions

Change an expensive decision through a focused ADR that supplies evidence: a product requirement, compatibility constraint, measurement, or demonstrated failure of the current boundary. Roadmap speculation alone is not evidence. Keep documentation clear about what is implemented now, what is an invariant, and what is only planned.
