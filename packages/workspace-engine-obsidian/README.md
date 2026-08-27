# Obsidian Workspace Engine

Status: **STABLE — KG10 cache, atomicity, and full-rebuild oracle tests pass.**

This platform-independent in-memory engine owns cached KG3
`ParsedObsidianDocument` values and applies atomic normalized source-change
batches. It does not read files, watch directories, retain raw Markdown after
parsing, update UI consumers, or persist catalogs.

```text
initial sources / atomic changes
  → parsed-document cache by WorkspacePath
  → reparse upserts only
  → complete KG4 workspace resolution
  → complete KG9A reconciliation
  → stable snapshot + exact source-neutral delta
```

## File map

```text
src/
  types.ts       Source changes, engine/result, revision, stats, and failure contracts.
  engine.ts      Initialization, batch validation/staging, full resolve/reconcile, delta.
  index.test.ts  Reparse, global resolution, atomicity, identity, and oracle scenarios.
  index.ts       Intentional public exports.
```

Initialization parses every supplied source once. Subsequent `upsert` operations
parse only their file; `delete` and pure `move` parse zero files. A move clones
the cached parsed IR with a new normalized structure path, then KG4 and KG9A
remain authoritative about semantics and continuity.

Every batch is validated completely before staging. Duplicate touches, missing
deletes/moves, and occupied move targets fail as actionable out-of-sync results.
Parse, resolution, identity, or delta failure returns no next engine, so the
caller retains the unchanged prior cache, snapshot, catalog, and revision.

Full resolution is intentional: adding, deleting, moving, or changing a target
can update references authored in unchanged cached documents. Incremental source
work therefore does not imply local-only semantic effects.

Rename continuity is strongest when KG11 eventually supplies one `move` or one
coalesced atomic delete-plus-upsert. Once deletion commits separately, KG9A has
no tombstone resurrection history.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/workspace-engine-obsidian typecheck
pnpm exec vitest run packages/workspace-engine-obsidian
pnpm check
```
