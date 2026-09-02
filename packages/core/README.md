# Core Domain

Status: **STABLE — canonical snapshot schema version 1 is fixture-backed.**

This package is the innermost, framework-independent workspace boundary. It
owns the ordinary-data contracts for source-backed document structure and
references, plus runtime validation for data crossing a JSON or worker
boundary.

## Current boundary

Core owns generic, serializable knowledge contracts. It must not know about
React, React Flow, Sigma, Graphology runtime objects, Tauri, Obsidian
application APIs, parser libraries, or the web package.

ESLint's `no-restricted-imports` configuration mechanically rejects those
obvious dependency violations. Architectural rationale and the full dependency
direction live in `../../docs/ARCHITECTURE.md`.

## File map

```text
packages/core/
  package.json          Source export, package identity, and typecheck command.
  tsconfig.json         Strict framework-independent TypeScript configuration.
  src/
    index.ts            Intentional public model and validation exports.
    index.test.ts       Public API and JSON round-trip contract.
    model/
      README.md         Detailed file map and canonical conventions.
      ids.ts            Opaque serializable identity aliases.
      source.ts         Workspace path, point, and span contracts.
      entities.ts       Document/section/block hierarchy union.
      references.ts     Provenance and resolution-state union.
      snapshot.ts       Versioned canonical snapshot envelope.
      validation.ts     Exact-shape and cross-record validation.
      validation.test.ts Focused valid and invalid snapshot cases.
```

The source export is intentional for this private workspace package: Vite
consumes it through `@icarus-graph-explorer/core`, while both packages remain
independently typechecked. Test-only builders stay private; consumers receive
only canonical types, the schema version, structured validation results, the
shared lexical `isNormalizedWorkspacePath` predicate, and
`validateKnowledgeSnapshot`.

## Runtime boundary

The validator accepts `unknown`, rejects unexpected or contradictory fields,
and returns a typed snapshot only after structural and relational checks pass.
It checks normalized source paths, point/span bounds, identity uniqueness,
parent kinds and cycles, heading levels, source-path coherence, reference
endpoints, and ambiguous candidate sets.

Canonical snapshots remain arrays and plain objects. Runtime indexes, parser
ASTs, source-provider handles, view state, and graph-library objects are not
part of schema version 1.

## Local validation

Run focused or repository-wide checks from the repository root:

```bash
pnpm --filter @icarus-graph-explorer/core typecheck
pnpm exec vitest run packages/core/src
pnpm check
```

## Deferred

KG2 may target these contracts with a generic Markdown structural parser.
Obsidian syntax, target-resolution policy, stable identity generation,
incremental deltas, projections, persistence, and platform access remain later
milestones.
