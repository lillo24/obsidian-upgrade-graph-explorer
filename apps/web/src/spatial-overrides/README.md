# Spatial override web integration

This folder owns workspace eligibility and the browser-session transaction for
the source-neutral spatial registry.

- `session.ts` distinguishes durable, session-only, corrupt, and failed-write
  states. Durable candidates are validated and written before adoption.
- `arrangement.ts` owns the small All Network Arrange mode state machine; raw
  pointer gesture state remains renderer-owned.
- `use-spatial-overrides.ts` keys sessions by eligibility/workspace, exposes the
  full schema-v2 rule list plus the compatibility place/exact anchor map, and
  retains the narrow set/reset/corrupt-recovery seam used by SPATIAL1B.
- `*.test.ts` proves isolation and failure policy with injected storage doubles.

V1 registries migrate in memory on read; reads never rewrite storage, while the
next confirmed mutation writes v2 through the existing transaction. No function
here dispatches projection, reconciles topology, requests layout, or reads source
content. Reset saved view, Graph Preferences, Visual Groups, Saved Filters, and
presentation-size overrides use different storage keys.
