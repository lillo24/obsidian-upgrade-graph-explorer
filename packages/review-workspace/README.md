# Review workspace state

This headless package owns the application envelopes around REVIEW1 runs and
model-optional prepared captures. It does not own React, native capture,
filesystem access, graph state, or model execution.

```text
src/
  types.ts       Versioned preparation, history, summary, and store contracts.
  validation.ts  Deep envelope validation, bounded serialization, and summaries.
  memory-store.ts  Explicit session-only store used by browsers and tests.
  run-repository.ts  Serialized ReviewRunRepository adapter over history storage.
  ids.ts         Injectable UUID-backed IDs for durable records and engine objects.
  index.ts       Intentional public exports.
```

Prepared records retain exact captured source and resolved templates without
inventing model settings or completed attempts. Run records remain canonical
`ReviewRunRecord` values inside a small application envelope for UI metadata.
The outer desktop adapter stores these envelopes under app-local review data.

Finite limits are 5 MiB per imported/stored record and 500 summary entries.
Stores do not silently prune records. Browser storage is deliberately in-memory
and session-only; a desktop storage failure is surfaced and never falls back.
