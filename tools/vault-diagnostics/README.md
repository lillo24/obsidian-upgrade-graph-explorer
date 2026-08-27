# Local Vault Diagnostics

Status: **STABLE — KG5 acquisition and KG9A private identity lifecycle are temp-directory tested and real-vault validated.**

This development-only workspace package is the sole KG5 filesystem boundary.
It recursively acquires one explicitly selected local vault, then calls KG3,
KG4, optional source-neutral stable reconciliation, and the pure diagnostics
package. It owns the current Node filesystem adapter for private identity
catalogs. It is not product vault access and does not introduce a reusable
source-provider abstraction.

The CLI uses pinned development runner `tsx@4.23.12`. Its maintained `esbuild`
binary installer is the only dependency build script allowlisted in
`pnpm-workspace.yaml` using pnpm 11's `allowBuilds`. The sample generator reuses
the repository's pinned `prettier@3.9.6` so generated JSON passes the standard
format gate. Application code does not depend on these development tools at
runtime.

## File map

```text
src/
  arguments.ts        Small fail-loud CLI parser.
  discovery.ts        Symlink-safe discovery, strict UTF-8 reads, and inventory.
  pipeline.ts         Timed parse → resolve → stabilize → report orchestration.
  identity-store.ts   Strict private load/create/reset and atomic catalog replacement.
  output.ts           Explicit JSON report writing.
  cli.ts              Aggregate-only command output and exit behavior.
  benchmark-config.ts Deterministic smoke/small/medium/large workload profiles.
  benchmark.ts        Opt-in pipeline/projection/renderer/inspection timing.
  generate-sample.ts  Regenerates the committed neutral browser sample.
  index.test.ts       Temporary-directory scanner and failure contracts.
```

## Vault command

```bash
pnpm diagnose:vault -- --vault "C:/path/to/vault" \
  --out output/diagnostics/local-report.json \
  --exclude "path/to/non-vault-area" \
  --verbose
```

`--vault` is required and `--exclude` is repeatable. With `--out`, the tool
defaults `--identity-store` to an adjacent `*.identity.json` file. A new store
uses explicit `--workspace-id` when supplied; otherwise the CLI generates one
opaque UUID once. Existing stores always reuse their workspace ID and reject a
conflicting explicit ID. A run without `--out` or `--identity-store` remains
transient and keeps the root-basename default.

`--reset-identity` requires persistent output/state and clearly discards
continuity before creating a new catalog. Invalid JSON, unsupported schemas,
broken relationships, and workspace mismatches fail explicitly instead of
resetting. Identity stores inside the selected vault are rejected, including
through an existing symlink ancestor. Relative arguments resolve from the
repository root even though pnpm runs the filtered package from its own folder.
Console output is aggregate unless `--verbose` adds coarse timings and identity
reuse/allocation counts; it does not print catalog titles or paths.

All hidden directories/files and `node_modules/` are ignored. Configured
workspace-relative prefixes are excluded. Symlinks are never followed. Every
included Markdown file must be readable, valid UTF-8; otherwise the command
fails and writes no success report. The runner reads no binary resource content:
non-Markdown paths exist only for compatibility probes.

The recommended `output/diagnostics/` destination is narrowly gitignored.
Reports remain private because they contain paths, headings, targets, spans,
and relationships even though they contain no full source text or snippets.
Catalogs are separate private files with similarly sensitive observations and
must not be committed or shared. After successful report construction and any
requested report write, the next validated catalog is written to a temporary
sibling, closed, and renamed over the old catalog.

## Synthetic browser sample

```bash
pnpm --filter @icarus-graph-explorer/vault-diagnostics generate:sample
```

This deterministically rebuilds the committed, formatted report from
`tests/fixtures/workspaces/diagnostic-sample/`. It never uses a real vault.
It intentionally retains deterministic transient fixture IDs and does not
create or require a persistent catalog.

## Browser boundary

KG5 loads one generated JSON report selected by the user. It does not give the
browser a directory handle. Product-grade folder access and watching remain KG11.

## Performance harness

```bash
pnpm benchmark:pipeline -- --profile small
pnpm benchmark:pipeline -- --profile medium
pnpm benchmark:pipeline -- --profile large
```

Profiles are deterministic and measure parse/adapt, resolution, report
construction, projection-index construction, documents-only/top-level/expanded
projection, one-hop focus, and resolution filtering. For documents-only
structure and one-hop focus it separately measures React Flow mapping and Dagre
layout, then reports layout mode, node/edge counts, and any explicit layout
warning. KG8 additionally measures canonical inspection-index construction, one
global entity query, one document-subtree inspection, and one aggregated-edge
provenance inspection with their result counts. Run small and medium for the
KG8 evidence set. KG9A adds cold stable-ID assignment and warm reconciliation
against a deterministic offset-shift plus inserted-section revision, including
reused/new counts. Timings are local evidence, never CI budgets. Normal tests
execute only a tiny correctness workload.
