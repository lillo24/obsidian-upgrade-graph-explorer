# ADR 0002: Hierarchical, source-neutral document domain

**Status:** Accepted

## Context

File-only graphs lose the section that originated or received a reference. Modeling only Obsidian concepts would couple canonical truth to the first data source, while modeling arbitrary knowledge data would erase useful constraints.

## Decision

Center the canonical domain on `Document → Section → nested Section → optional addressable Block`, with references and source locations between addressable entities. Keep the model independent from Obsidian, React, renderers, runtime graph libraries, and platform APIs. Treat Obsidian syntax and resolution as an adapter.

## Consequences

Collapsed projections may aggregate relationships, but canonical data must retain section-level precision. Plain Markdown and future source adapters can share contracts. KG1 implements this decision in snapshot schema version 1 with opaque IDs, workspace-relative provenance, a single parent relation, and explicit resolved, unresolved, ambiguous, and invalid outcomes.
