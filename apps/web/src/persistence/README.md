# Browser View Persistence

This folder owns the current browser adapter for KG9B's source-neutral saved
view contract.

- `storage.ts` maps encoded stable workspace IDs to small `localStorage`
  records and returns explicit, non-fatal read/write/delete failures.
- `session.ts` applies report identity eligibility and hydrates a reconciled KG6
  state before React autosave may run.
- `saved-filters.ts` owns the separate schema-v1 `{name, query}` registry for a
  stable workspace, including strict validation, deterministic ordering, a
  50-filter limit, and explicit read/write failures.
- `visual-groups.ts` owns the separate schema-v1 ordered Visual Group registry,
  strict canonical QUERY1/palette validation, a 24-group limit, pure priority
  mutations, explicit read/write failures, and a narrow current-workspace clear
  operation used only by the confirmed corrupt-registry recovery flow.
- `*.test.ts` uses injected storage doubles; tests never rely on global browser
  storage.

Malformed or unsupported values are not overwritten or deleted. Transient and
legacy reports never read or write cross-session state. The stored record
contains no report body, source body, identity catalog, absolute path, renderer
layout, raw viewport transform, search, or selection.

The current key is
`icarus-graph-explorer:view-state:<encodeURIComponent(workspaceId)>`; the value,
not the key, carries schema version 1 so future readers can discover older
records. Browser storage access is synchronous during report-scoped hydration,
and writes occur only after discrete graph state changes or user-ended viewport
movement. One read/write failure disables further automatic writes for that
mounted report until an explicit successful reset.

Saved Filters use the separate key
`icarus-graph-explorer:saved-filters:<encodeURIComponent(workspaceId)>` and are
available cross-session only for stable identities with writable browser
storage. They contain only trimmed names and canonical QUERY1 strings—never
simple filters, disclosure, Focus, viewport, selection, source paths, or raw
ASTs. A corrupt registry is left unchanged, and Reset saved view does not
delete it.

Visual Groups use
`icarus-graph-explorer:visual-groups:<encodeURIComponent(workspaceId)>`. Their
exact array order is priority, so serialization preserves it rather than
sorting. Records contain only name, canonical QUERY1 string, fixed palette
token, and enabled state. Corrupt values remain untouched, and no group is
stored in graph-view state, navigation history, projection state, or renderer
layout caches. GROUP1B keeps transient/storage-unavailable sessions editable in
memory. Durable mutations write before adoption; a failed write retains the
last confirmed registry and blocks later writes until the workspace is
reopened. Corrupt data is deleted only after the Groups panel's explicit
two-step reset and no other localStorage key is affected.
