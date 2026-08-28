# Tauri Source Provider

Status: **STABLE — KG11A acquisition, identity, recovery, and fake-bridge tests pass.**

This outer platform package owns native folder selection, one-shot read-only
vault discovery, and private app-local workspace identity persistence. It does
not own React, KG10 processing, diagnostics, projections, renderers, or live
filesystem watching.

```text
src/
  bridge.ts       Narrow injectable dialog/fs/path/app-data bridge and Tauri implementation.
  selection.ts    Absolute selected-root normalization and safe display basename.
  discovery.ts    Recursive strict-UTF-8 acquisition using shared KG5 policy.
  registry.ts     Versioned registry/catalog validation and temporary-sibling writes.
  provider.ts     New/existing/reset identity-session orchestration.
  runtime.ts      Official Tauri runtime detection.
  types.ts        Selection, inventory, registry, session, and recovery contracts.
  index.ts        Intentional public exports.
  index.test.ts   Native-free fake-bridge discovery and persistence coverage.
```

The public flow is deliberately small:

```text
selectVaultDirectory()
  → discoverSelectedVault(selection)
  → loadOrPrepareWorkspaceIdentity(selection)
  → application initializes KG10 and validates the report
  → commitWorkspaceIdentity(session, nextCatalog)
```

Discovery skips hidden entries and `node_modules`, honors normalized optional
excludes, never follows symlinks, decodes Markdown bytes with fatal UTF-8,
sorts workspace-relative paths deterministically, and inventories only paths
for non-Markdown files. The pure lexical rules are shared with the Node KG5
scanner through `vault-discovery-policy`; Node and Tauri I/O remain separate.

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

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/source-provider-tauri typecheck
pnpm exec vitest run packages/source-provider-tauri
```
