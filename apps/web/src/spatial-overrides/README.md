# Spatial override web integration

This folder owns workspace eligibility and the browser-session transaction for
the source-neutral spatial registry.

- `session.ts` distinguishes durable, session-only, corrupt, and failed-write
  states. Durable candidates are validated and written before adoption.
- `arrangement.ts` owns the small All Network Arrange mode state machine; raw
  pointer gesture state remains renderer-owned.
- `use-spatial-overrides.ts` keys sessions by eligibility/workspace, resolves the
  All Network anchor map, and exposes the narrow set/reset/corrupt-recovery seam
  for SPATIAL1B.
- `*.test.ts` proves isolation and failure policy with injected storage doubles.

No function dispatches projection, reconciles topology, requests layout, or
reads source content. Reset saved view, Graph Preferences, Visual Groups, Saved
Filters, and presentation-size overrides use different storage keys.
