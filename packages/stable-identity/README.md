# Stable Identity

Status: **STABLE — KG9A reconciliation rules are synthetic-revision tested.**

This source-neutral package turns a complete transient canonical snapshot into
the same schema-v1 snapshot with app-owned stable IDs. It owns the private
catalog contract, strict catalog validation, conservative matching, opaque
sequence allocation, ID remapping, and aggregate reconciliation diagnostics.
It does not read or write files, inspect Markdown or Obsidian syntax, generate
workspace UUIDs, persist explorer state, or depend on rendering/runtime code.

```text
KG4 transient KnowledgeSnapshot + previous private catalog
  → conservative source-neutral reconciliation
  → stable-ID KnowledgeSnapshot + next private catalog
```

## File map

```text
src/
  types.ts          Catalog, observations, result, summary, and diagnostic contracts.
  catalog.ts        Strict deserialized-catalog and relationship validation.
  observations.ts   Canonical hierarchy/reference evidence and next-catalog builder.
  semantic.ts       Identity-free snapshot comparison for semantic invariance.
  reconcile.ts      Staged entity/reference matching, allocation, and ID remapping.
  test-fixture.ts   Neutral canonical revision builder used only by package tests.
  index.test.ts     Continuity, ambiguity, validation, and determinism scenarios.
  index.ts          Intentional public entry points.
```

Production code depends only on `@icarus-graph-explorer/core`. ESLint rejects
source adapters, diagnostics, projections, renderers, UI libraries, platform
APIs, filesystem access, and Node UUID generation at this boundary.

## Matching contract

- Documents first reuse one exact path, then one unique non-empty structural
  fingerprint for a rename or move.
- Sections first reuse exact canonical structure under a matched parent. A
  unique non-empty subtree/reference fingerprint can preserve a heading rename
  or cross-parent move. Weak or duplicate evidence receives a new identity.
- Blocks reuse an exact locator or, when the unmatched sibling counts agree,
  their ordinal under a matched parent. Changed/duplicated groups are not
  guessed.
- References are reconciled after entity remapping by stable source owner,
  authored kind, and raw target. Resolution is deliberately excluded because
  whole-workspace target changes may reclassify an unchanged occurrence. One
  unique occurrence survives an offset shift; duplicates require unchanged
  unique offsets or receive new IDs.

Titles, paths, offsets, and structural fingerprints are matching evidence, not
the stable ID. One old ID can be used at most once. Ambiguity allocates a new ID
and emits an aggregate diagnostic; no fuzzy matching or input-order tie-breaker
is used. Deleted observations are omitted, their allocation counters continue,
and historical resurrection is deliberately unsupported.

## Catalog contract

The schema-version-1 catalog contains only stable IDs, workspace-relative
paths, hierarchy, source offsets, headings, structural fingerprints, raw link
targets, stable resolution data, and allocation counters. It contains no
Markdown body, absolute path, diagnostic report, renderer state, or saved view.
It is private application data even with those exclusions. Filesystem loading,
atomic replacement, reset, and opaque persistent workspace-ID generation belong
to the outer tool or application.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/stable-identity typecheck
pnpm exec vitest run packages/stable-identity
pnpm check
```
