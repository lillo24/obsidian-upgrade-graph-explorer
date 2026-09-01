# Visual Group Web Integration

Status: **STABLE — GROUP1B workspace session and presentation adapter.**

This folder owns the web-only boundary between the source-neutral Visual Group
package, browser persistence, current KG6 projection, and renderer-safe styles.

- `session.ts` loads one workspace registry, distinguishes durable,
  session-only, corrupt, and failed-write modes, and enforces write-before-adopt
  commits plus explicit corrupt-registry recovery.
- `presentation.ts` derives an `EntityId` presentation map only for canonical
  entities already present in the current projection.
- `*.test.ts` proves session failure policy, projection isolation, and identical
  cross-renderer styling without relying on global browser storage.

Registries never enter graph-view persistence, canonical snapshots, KG6 state,
navigation history, renderer topology, layout fingerprints, or vault files.
