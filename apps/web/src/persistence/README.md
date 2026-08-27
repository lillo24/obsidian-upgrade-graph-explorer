# Browser View Persistence

This folder owns the current browser adapter for KG9B's source-neutral saved
view contract.

- `storage.ts` maps encoded stable workspace IDs to small `localStorage`
  records and returns explicit, non-fatal read/write/delete failures.
- `session.ts` applies report identity eligibility and hydrates a reconciled KG6
  state before React autosave may run.
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
