# Obsidian Diagnostics

Status: **STABLE — KG5 report schema and compatibility probes are synthetic-fixture-backed.**

This pure package converts successful KG4 output into a deterministic,
runtime-validated diagnostic report for local inspection. It owns Obsidian
compatibility evidence and read-model labels, not filesystem access, React,
canonical resolution policy, or graph projections.

```text
adapter/resolver values → diagnostics-obsidian → serialized report → UI
```

## File map

```text
src/
  types.ts        Versioned report, probe, inventory, timing, and generator contracts.
  validation.ts   Strict report-envelope and embedded-snapshot runtime validation.
  probes.ts       Case-only and non-Markdown inventory compatibility clues.
  report.ts       Deterministic report construction and diagnostic ordering.
  lookups.ts      Opaque-ID labels, hierarchy indexes, and derived summary counts.
  synthetic.ts    Configurable deterministic Markdown workload generator.
  index.ts        Intentional public surface.
  index.test.ts   Report, validation, probes, labels, privacy, and generator tests.
```

## Report boundary

Schema version 1 stores the validated `KnowledgeSnapshot`, resolver/forwarded
adapter diagnostics, non-canonical compatibility probes, aggregate source
inventory, and optional coarse timings. It never stores source text or snippets.

`validateObsidianDiagnosticReport()` rejects unsupported versions, malformed
records, invalid embedded snapshots, dangling probe references/candidates, and
inventory counts that contradict canonical documents.

## Compatibility probes

Probes answer whether one deliberately limited alternate rule supplies useful
evidence. They never mutate canonical resolutions:

- unique case-insensitive file or heading matches;
- an unsupported attachment that is present but unmodeled;
- unsupported attachment targets with no inventory match;
- ambiguous attachment inventory matches.

Candidate IDs and paths are inspection evidence only. No fuzzy matching,
nearest-file selection, attachment entities, or graph ghost nodes are created.

## Privacy

Reports contain filenames, headings, targets, spans, and relationships, so real
reports remain private local artifacts. Only the neutral synthetic sample is
committed. The package is filesystem-free and cannot acquire vault contents.

## Local validation

```bash
pnpm --filter @icarus-graph-explorer/diagnostics-obsidian typecheck
pnpm exec vitest run packages/diagnostics-obsidian
```
