# Tauri Source Provider

Status: **STABLE — KG11B1 acquisition, watch planning, identity, and fake-bridge tests pass.**

This outer platform package owns native folder selection, read-only vault
discovery, recursive watch acquisition, deterministic source-change planning,
and private app-local workspace identity persistence. It does not own React,
KG10 application, diagnostics, projections, renderers, or live UI state.

```text
src/
  bridge.ts       Narrow injectable dialog/fs/watch/path/app-data bridge and Tauri implementation.
  selection.ts    Absolute selected-root normalization and safe display basename.
  discovery.ts    Full or bounded-subtree strict-UTF-8 acquisition using shared KG5 policy.
  reconciliation.ts  Observed inventory diff and conservative source-change planning.
  registry.ts     Versioned registry/catalog validation and temporary-sibling writes.
  provider.ts     Public discovery/watch/reconciliation/identity orchestration.
  runtime.ts      Official Tauri runtime detection.
  types.ts        Selection, inventory, watch, plan, registry, session, and recovery contracts.
  watch.ts        Selected-root watch lifecycle and native-signal normalization pipeline.
  watch-burst.ts  Injected-scheduler quiet/max burst coalescing with serialized flushes.
  watch-paths.ts  Absolute native path containment and workspace-relative filtering.
  index.ts        Intentional public exports.
  *.test.ts       Native-free bridge, watch, planner, discovery, and persistence coverage.
```

The existing one-shot public flow remains deliberately small:

```text
selectVaultDirectory()
  → discoverSelectedVault(selection)
  → loadOrPrepareWorkspaceIdentity(selection)
  → application initializes KG10 and validates the report
  → commitWorkspaceIdentity(session, nextCatalog)
```

KG11B1 adds a separate read-only planning loop for KG11B2 to orchestrate:

```text
watchSelectedVault(selection, listener)
  → reconcileSelectedVaultChanges(selection, previousInventory, watchBatch)
  → return a plan and complete replacement inventory
```

Discovery skips hidden entries and `node_modules`, honors normalized optional
excludes, never follows symlinks, decodes Markdown bytes with fatal UTF-8,
sorts workspace-relative paths deterministically, and inventories only paths
for non-Markdown files. The pure lexical rules are shared with the Node KG5
scanner through `vault-discovery-policy`; Node and Tauri I/O remain separate.

## Watch and planning policy

The native bridge uses recursive Tauri `watchImmediate`; it never exports a
Tauri event type or absolute event path. Access and access-time metadata events
are ignored because provider re-reads can otherwise feed a watch loop;
ignored-only batches are discarded. Other safe event paths are normalized,
filtered with the discovery rules, deduplicated, and delivered after a 250 ms
quiet period or a 1,000 ms maximum wait. Both timings can be overridden, and
unit tests use an injected scheduler.

Events are hints. Reconciliation re-reads only affected files or bounded
directory subtrees, compares the observed net state with the previous complete
inventory, and returns Markdown `upsert`/`delete`/`move` plain data plus the
complete next inventory. Non-Markdown content is never read. A move requires
exact source equality that is unique in both full inventories; ambiguous or
edited renames remain delete plus upsert. Unsafe/out-of-root/root-wide,
overflow/rescan, unreadable, or inconsistent observations explicitly return
`resync-required`; this package does not execute that resync.

The installed Tauri filesystem plugin forwards Notify events and represented
`rescan` flags, but its 2.5.1 Rust callback does not forward Notify errors to
JavaScript. KG11B2 must therefore treat the subscription as best-effort and
retain an explicit user/full-resync recovery path.

## Private identity state

The version-1 registry is stored under Tauri application-local data and maps
an exact normalized absolute root to an opaque workspace ID. One validated
KG9A catalog is stored in `identity/<encoded-workspace-id>.json`. Only the
private registry may contain the absolute root. Catalogs, canonical snapshots,
diagnostic reports, and saved views may not.

Catalog and registry updates use validated temporary siblings followed by
rename replacement. A new association commits its catalog before its registry
entry, so interruption can leave an unreferenced catalog but never a registry
entry pointing to a catalog that was not written. Invalid, missing, corrupt, or
mismatched known state fails explicitly and offers a confirmed reset path; it
is never silently recreated.

Matching is exact after lexical/platform normalization. Moving or renaming a
vault root creates a new association in KG11A. The app cannot automatically
reopen a prior root because native dialog scope lasts only for the process.

KG11B1 stops at source planning. Applying changes to KG10, committing the next
identity/report state, preserving the live KG9 view, and executing full resync
remain KG11B2 responsibilities.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/source-provider-tauri typecheck
pnpm exec vitest run packages/source-provider-tauri
```
