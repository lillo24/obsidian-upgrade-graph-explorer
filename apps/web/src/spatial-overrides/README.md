# Spatial override web integration

This folder owns workspace eligibility and the browser-session transaction for
the source-neutral spatial registry.

- `session.ts` distinguishes durable, session-only, corrupt, and failed-write
  states. Durable candidates are validated and written before adoption.
- `arrangement.ts` owns the All Network rule-editor lifecycle from inactive
  through folder selection, scope choice, target drag, commit, and Pull settle;
  raw pointer gesture state remains renderer-owned.
- `folder-scope-model.ts` builds and freezes the full canonical folder tree from
  snapshot document paths. Visible counts are annotations only, so query-hidden
  and folder-only ancestors remain authorable without becoming canonical nodes.
- `use-spatial-overrides.ts` keys sessions by eligibility/workspace, exposes the
  full schema-v2 rule list plus the compatibility place/exact anchor map, and
  exposes transactional set/remove/clear operations for complete Pull or Place
  rules while retaining the compatibility seam.
- `*.test.ts` proves isolation and failure policy with injected storage doubles.

V1 registries migrate in memory on read; reads never rewrite storage, while the
next confirmed mutation writes v2 through the existing transaction. No function
here dispatches projection, reconciles topology, requests layout, or reads source
content. Reset saved view, Graph Preferences, Visual Groups, Saved Filters, and
presentation-size overrides use different storage keys.

The editor draft is transient React state and never enters browser persistence
or navigation history. Live/query updates cancel unfinished pointer preview but
preserve a draft while its exact normalized root still exists. Exact-path rename
has no reconciliation: the editor closes and reports the missing root while the
old rule stays dormant. Durable mutations are written before adoption;
session-only work uses the same rule operations with an explicit status.
