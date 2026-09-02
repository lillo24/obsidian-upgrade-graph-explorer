# Canonical Model

Status: **STABLE — schema version 1 is runtime-validated and fixture-backed.**

This folder owns the plain-data contract shared by future parsers, adapters,
resolvers, projections, and workers. It contains no parser, source-provider,
renderer, platform, or UI behavior.

## File map

```text
model/
  ids.ts          Opaque workspace, entity, and reference ID aliases.
  source.ts       Workspace path and half-open source-position semantics.
  entities.ts     Document/section/block hierarchy contracts.
  references.ts   Reference provenance and resolution discriminated union.
  snapshot.ts     Versioned workspace snapshot envelope.
  validation.ts   Pure validation of JSON-derived snapshots and invariants.
```

`snapshot.ts` composes the other data contracts. `validation.ts` is the only
runtime interpretation layer: it accepts `unknown`, rejects malformed or
contradictory shapes, checks cross-record invariants, and returns a typed copy
only when every issue is resolved.

## Canonical conventions

- IDs are opaque, non-empty strings. Titles and paths are never identity.
- Workspace paths are normalized, root-relative, forward-slash paths;
  `isNormalizedWorkspacePath` is the shared lexical check for that contract.
- Lines/columns are 1-based; offsets are 0-based UTF-16 code-unit indexes.
- Spans are start-inclusive/end-exclusive; both points carry offsets or neither
  does.
- A document has no parent. A section or block has exactly one document/section
  parent. Nested section levels increase but may skip levels.
- References keep source ownership/span separately from resolution.
- Snapshot arrays are canonical; maps, indexes, view state, and graph-library
  objects are derived elsewhere.

Tests live beside the behavior they exercise. Reusable committed examples live
under `tests/fixtures/`; test-only builders are not exported from core.
