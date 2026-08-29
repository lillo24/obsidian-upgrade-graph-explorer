# Performance contracts

**STABLE** — schema version 1 is the machine-readable boundary for KG12 measurements.

This package owns source-neutral performance vocabulary, repeated-sample
statistics, runtime-only instrumentation, and strict result validation. It has
no React, renderer, filesystem, or platform dependency.

- `src/types.ts` defines workload classes, interaction IDs, phases, operation
  counters, budgets, decision records, and the versioned result schema.
- `src/statistics.ts` calculates deterministic median and p95 summaries after
  explicit warm-up runs.
- `src/interaction-contract.ts` defines the expected and forbidden production
  operation path for every I1–I18 product interaction.
- `src/recorder.ts` provides an optional in-memory phase/counter recorder. A
  caller must opt in; measurements are never persisted by this package.
- `src/validation.ts` fails closed on malformed or privacy-unsafe result data.
- `src/*.test.ts` protects statistics, schema, privacy, and recorder behavior.

Node, browser, and Tauri owners supply clocks and environment metadata at their
own boundaries. Paths, source text, workspace names/IDs, hostnames, usernames,
queries, and correlation IDs are deliberately absent from persisted results.
