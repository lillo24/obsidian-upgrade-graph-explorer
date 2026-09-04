# Local Vault Diagnostics

## Focus Schematic benchmark

Run `pnpm benchmark:focus-schematic -- --profile small`, `medium`, or `hub`.
The synthetic benchmark reports median/p95 time separately for document
neighborhood description, detailed projection, prepared and unprepared model
construction, independent validation, summary, serialization, and total. Its
output contains aggregate counts and timings only and is not a CI timing gate.

Status: **STABLE — KG12B adds aggregate W1 and W3 worker responsiveness evidence.**

This development-only workspace package is the Node KG5 filesystem boundary.
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
  benchmark.ts        Opt-in full-pipeline plus incremental timing entry point.
  incremental-benchmark.ts Edit/add/delete/move timings with exact rebuild oracles.
  focus-spacing-fixtures.ts Deterministic sparse, mixed, dense, and disconnected Local scenes.
  focus-spacing-metrics.ts  Graph, screen-space, Sigma-transform, and candidate-density metrics.
  focus-spacing-analysis.ts SPACING1A runner and self-contained visual comparison generator.
  focus-spacing-metrics.test.ts Transform invariance, candidate bounds, and fixture contracts.
  file-move-benchmark.ts MOVE1A inverse/index/coalescing aggregate microbenchmark.
  performance-benchmark.ts Repeated versioned pipeline/projection/renderer/inspection results.
  query-projection-benchmark.ts PERFQ1A projection phases, operations, and repeated-query evidence.
  performance-policy.ts Class budgets plus measured KG12B worker/cache decisions.
  workspace-worker-thread.ts Node host for the production W1 protocol/runtime.
  workspace-worker-responsiveness.ts Direct-versus-worker event-loop evidence.
  dagre-layout-worker-thread.ts Node host for the production W3 protocol/runtime.
  dagre-layout-worker-responsiveness.ts Direct/worker/supersession W3 evidence.
  validate-incremental-real.ts Aggregate-only, in-memory private validation.
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
`tests/fixtures/workspaces/diagnostic-sample/`. It never uses a real vault or
writes a catalog. A deterministic in-memory stable catalog/reconciliation pass
makes the bundled report explicitly persistence-eligible for reproducible
browser reload QA.

Persistent runner reports declare stable identity provenance; non-persistent
runs declare transient provenance. This metadata does not enter the canonical
snapshot and does not expose the private catalog.

## Browser boundary

KG5 loads one generated JSON report selected by the user. It does not give the
browser a directory handle. KG11A now provides product one-shot folder access
through a separate Tauri provider. Watching and live updates remain KG11B.

## Performance harness

```bash
pnpm benchmark:pipeline -- --profile small
pnpm benchmark:pipeline -- --profile medium
pnpm benchmark:pipeline -- --profile large
pnpm benchmark:performance -- --profile small \
  --output output/performance/small.json
pnpm benchmark:query-projection -- --profile small \
  --output output/performance/query-small.json
pnpm benchmark:query-projection -- --profile medium \
  --output output/performance/query-medium.json
pnpm benchmark:workspace-worker -- --profile medium
pnpm benchmark:workspace-worker -- --profile large
pnpm benchmark:dagre-worker -- --profile small
pnpm benchmark:dagre-worker -- --profile medium
pnpm benchmark:global-renderer -- --profile small
pnpm benchmark:global-renderer -- --profile medium
pnpm benchmark:global-renderer -- --profile large
pnpm benchmark:local-renderer -- --profile small
pnpm benchmark:local-renderer -- --profile medium
pnpm benchmark:local-renderer -- --profile stress
pnpm analyze:focus-spacing
pnpm benchmark:file-move
```

Profiles are deterministic and measure parse/adapt, resolution, report
construction, projection-index construction, files-only/one-level/three-level
and expanded projection, a depth-three nontrivial QUERY1 filter, product
Structure one-hop focus,
and resolution filtering. For
files-only structure and one-hop focus it separately measures React Flow
mapping and Dagre layout, then reports layout mode, node/edge counts, and any explicit layout
warning. KG8 additionally measures canonical inspection-index construction, one
global entity query, one document-subtree inspection, and one aggregated-edge
provenance inspection with their result counts. Run small and medium for the
KG8 evidence set. KG9A adds cold stable-ID assignment and warm reconciliation
against a deterministic offset-shift plus inserted-section revision, including
reused/new counts. KG10 adds independent one-file edit, add, delete, and move
scenarios. Each reports changed/reparsed/reused file counts, delta counts,
incremental and full-rebuild timings, and exact snapshot/catalog/delta-apply
oracle results. Timings are local evidence, never CI budgets. Normal tests
execute only a tiny correctness workload.

`benchmark:performance` is the KG12A contract. It covers every stable
projection profile, records canonical and projected counts separately, performs
explicit warm-ups/repeats, emits median/p95/maximum plus raw local samples, and
validates the result before printing or writing. Output paths passed through the
root command resolve from the caller's directory even though pnpm executes in
this package. Use only the ignored `output/performance/` destination. Repeated
Dagre is explicitly omitted above 2,500 projected nodes after the measured
structural cliff; the JSON records the reason instead of a zero-time success.

`benchmark:query-projection` is the PERFQ1A focused contract. It measures
depth-three no-filter, broad/selective QUERY1, path+kind, projected-text
fallback, and invalid-query scenarios. It reports aggregate phase
median/p95/maximum distributions plus deterministic build, preparation,
candidate-path, scan, sort, hierarchy, and validation operation counts. The
same snapshot/disclosure is then exercised through A → B → C → Clear → A.
Scenario IDs deliberately replace query/path text in output, and wall-clock
results remain investigative rather than CI gates.

`benchmark:workspace-worker` runs the same deterministic W1 initialization
directly and through a warm worker thread while a 16 ms event-loop probe stays
active. It reports internal compute, round trip, p95/maximum scheduling gap,
and exact report/catalog equality. Output is aggregate-only and is not a CI
timing gate. The browser production build separately proves the Vite Dedicated
Worker entry; this Node host exists only for repeatable local responsiveness
evidence.

`benchmark:dagre-worker` derives real renderer topology from the deterministic
small fully-expanded or medium bounded projection, compares direct and worker
coordinates exactly, applies the worker result through the production renderer
adapter, and keeps a 16 ms event-loop probe active. Its A → B → C scenario
terminates A and B and accepts only C. Output contains counts and aggregate
timings only—never graph IDs, titles, paths, or topology—and is investigative
rather than a CI timing threshold.

`benchmark:global-renderer` is the KG13A candidate contract. It creates the
existing deterministic workspace, projects the real KG6 documents-only view,
measures plain mapping, Graphology build, and 1%/10% full replacement versus
stable-key reconciliation, and keeps meaningful ForceAtlas2 timing separate
from WebGL rendering. It also measures a clustered private-safe stress projection
and reads aggregate production bundle sizes. Browser/Tauri mount, render,
interaction, and worker responsiveness stay in the dedicated visual harness
because Node has no WebGL surface. Add `--include-25k` only to the large profile
for the optional 25k-node/50k-edge mapping ceiling.

`benchmark:local-renderer` is the KG13B2A/B2B bounded-neighborhood contract. Its
synthetic profiles describe the Local scene itself rather than scaling with a
whole vault: small has one root plus ten neighbor files; medium has 51 files
and several hundred disclosed headings/blocks; stress safely targets roughly
one thousand projected entities. The Free evidence separately measures KG6
Local projection, topology mapping, deterministic seed placement, Graphology
construction, worker-equivalent ForceAtlas2, result apply, one disclosure
reconciliation, and exact memory-cache reuse. The Structured evidence reuses
that same projection and measures compact React Flow mapping, deterministic
schematic seed placement, current-focus versus explicit-local Dagre settings,
worker-equivalent W3 compute, root-normalized apply, exact cache reuse,
Free/Structured seed preparation, and disclosure preparation. Its operation
oracle requires a layout-only toggle to perform zero Local projections, zero
Global projections/layouts, and zero workspace transactions. Both modes verify
root-origin normalization and Global-layout isolation. DOM/WebGL first paint,
worker round trip, refined paint, interaction RAF gaps, transition anchoring,
and precision input remain production browser/Tauri evidence. Output is
aggregate-only and never a CI wall-clock threshold.

`benchmark:visual-groups` records aggregate synthetic GROUP1A compile,
visible-entity assignment, and renderer style-lookup distributions for 300 and
3,000 visible entities with 4 and 8 enabled groups. Projection is explicitly
outside the measured path, operation counts report zero topology/layout work,
and the timings are evidence rather than CI gates.

`analyze:focus-spacing` is the SPACING1A diagnostic-only contract. It runs the
unchanged production Local ForceAtlas2 function over deterministic sparse,
mixed, disconnected, and dense topologies, then applies Sigma 3.0.3's actual
normalization and camera transforms in Node. It writes ignored synthetic JSON
and a self-contained HTML comparison to `output/spacing1a/`. The candidate
ratios are investigative evidence only: this command does not alter production
layout settings, camera behavior, renderer state, fingerprints, or node sizes.

`benchmark:file-move` exercises only MOVE1A-owned pure coordinate inversion,
prebuilt applied-Place indexing/lookup, and frame coalescing for no-Place,
Place, and 20,000-node synthetic cases. It emits aggregate timings and command
counts, never graph IDs or coordinates. It deliberately does not benchmark the
fake constraint consumer as evidence of production cooling or convergence.

An opt-in private check can validate one real workspace using an existing
identity catalog:

```bash
pnpm --filter @icarus-graph-explorer/vault-diagnostics \
  validate:incremental-real -- --vault "C:/path/to/vault" \
  --identity-store "C:/private/path/catalog.identity.json"
```

It appends a harmless comment to one source in memory, compares the incremental
result with a complete rebuild from the same previous catalog, applies the
delta as a second exact oracle, and prints aggregate counts/timings only. It
does not write the source, identity catalog, or a diagnostic report.
