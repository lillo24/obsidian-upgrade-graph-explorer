# AI Review Engine

Status: **headless REVIEW1 infrastructure**. This package does not make live model calls and is not a finished AI review UI.

This package owns a fixed Negative + Positive → Integrator workflow with an optional compiler-aware post-check. It freezes supplied review text and configuration, keeps branch executions isolated, validates stage dependencies and structured results, records immutable evidence, and exports Markdown/JSON. It has no React, renderer, DOM, filesystem, platform-storage, compiler-store, or provider-SDK dependency.

## File map

```text
src/
  types.ts              Versioned public run, provider, result, and compiler contracts.
  plain-data.ts         Plain-data cloning/freezing, byte counts, and deterministic fingerprints.
  snapshot.ts           Input validation, finite defaults, frozen material, and fingerprints.
  templates.ts          Versioned one-pass templates and deterministic prompt rendering.
  compiler.ts           Read-only compiler snapshot protocol, tool dispatch, and synthetic providers.
  results.ts            Integrator/post-check structure and contribution-reference validation.
  engine.ts             Fixed orchestration, lifecycle, cancellation, retries, and evidence capture.
  repository.ts         In-memory storage, validated JSON, and interrupted-import handling.
  export.ts             Faithful human-readable Markdown and full-fidelity JSON exports.
  scripted-provider.ts  Deterministic provider with tool, failure, delay, and cancellation scripts.
  engine.test.ts        Workflow, placement, lifecycle, boundary, and export coverage.
  index.ts              Intentional public exports.
examples/
  scripted-review.test.ts  Runnable, visibly synthetic end-to-end example.
```

The application supplies source capture, a live provider adapter, durable storage, and any UI. The compiler supplies its knowledge model/store through the small snapshot session contract; Review stores only what a stage requested and received.

## Public flow

```ts
const engine = new ReviewEngine({
  provider,
  repository,
  compilerProvider, // optional; required when a selected placement is true
});

const handle = await engine.start({
  workspaceId,
  source, // exact supplied source/diff text, provenance, and completeness
  additionalRequest,
  models,
  compiler: { analysis: true, integrator: false, postCheck: true },
});

const run = await handle.completion;
const markdown = exportReviewRunMarkdown(run);
const json = exportReviewRunJson(run);
```

`start` freezes by deep copy before execution. Negative and Positive are started before either is awaited. An Integrator attempt is launched exactly once for a successful current branch-attempt pair. `retry(runId, stage)` preserves history; an upstream retry removes dependent results from the current pointers and signals active stale work. `cancel` records local cancellation separately from provider-confirmed termination.

Provider success requires an explicit `completed` terminal event and non-empty, bounded output. Refused, truncated, failed, cancelled, invalid structured, timed-out, or dependency-blocked attempts cannot satisfy downstream dependencies. Usage is optional; absence remains unavailable rather than becoming zero.

Model and adapter metadata are persisted only as JSON-compatible plain data. Credential-like metadata keys are rejected so generated run metadata does not become a secret-storage channel; source and quoted evidence are retained faithfully as user/provider content.

## Compiler boundary

The engine opens one immutable compiler snapshot and binds it outside model-supplied arguments. A stage receives only these read operations when its placement is enabled:

- `compiler_list_index`
- `compiler_search_index`
- `compiler_read_bundle`
- `compiler_read_source`

The dispatcher validates exact arguments, capabilities, snapshot/revision identity, cancellation, call count, result bytes, and duplicate tool-call IDs. It rejects writes, workspace/path/revision switching, unknown tools, and conflicting reuse. Tool results distinguish successful empty results, missing records, unavailable sources, stale snapshots, unauthorized access, limits, cancellation, and unavailable providers. Complete compiler ownership is documented in [`../../docs/AI_REVIEW_COMPILER_INTEGRATION.md`](../../docs/AI_REVIEW_COMPILER_INTEGRATION.md).

## Finite defaults

Defaults are stored in every run and may be lowered or raised deliberately by the caller:

| Limit                      |         Default |
| -------------------------- | --------------: |
| Frozen input               | 1,048,576 bytes |
| Rendered prompt            | 2,097,152 bytes |
| Output per attempt         |   262,144 bytes |
| Execution per attempt      |      120,000 ms |
| Compiler calls per attempt |              12 |
| Compiler result per call   |   262,144 bytes |

No required content is silently truncated. Incomplete input requires `acceptIncomplete: true`. Captured Git inputs require exact retained source/diff text, base/head/commit IDs, and a count from 1 through 10; this package does not fetch Git.

The fingerprint is deterministic FNV-1a-style identity for inspection/deduplication, not a cryptographic integrity or secrecy guarantee. It includes the frozen configuration and, when opened, the compiler snapshot descriptor. Raw source and exact rendered prompts remain in the run record.

## Local synthetic example

```bash
pnpm --filter @icarus-graph-explorer/ai-review example
```

The command runs entirely locally and prints an export headed `SYNTHETIC REVIEW OUTPUT — NOT AN AI CONCLUSION`. Its source, model output, and compiler records are fixtures, not an assessment of user material.

## Validation

```bash
pnpm --filter @icarus-graph-explorer/ai-review typecheck
pnpm exec vitest run packages/ai-review
pnpm check
```

## Deliberate limitations

- No live Agents API/SDK adapter or credentials.
- No Git/filesystem capture or full-vault extraction.
- In-memory storage only; JSON import cannot reconnect an unfinished remote session and marks it interrupted.
- No compiler implementation, writes, embeddings, MCP server, or knowledge-library prepopulation.
- No overlay, comparison tabs, rendered chat, or live Obsidian synchronization.
- Prompt framing infrastructure tests do not establish model-review quality; that needs later model evaluation.
