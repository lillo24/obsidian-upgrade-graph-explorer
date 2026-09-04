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
- `presentation-overrides.ts` adapts the source-neutral v1 per-File size
  registry to its own workspace storage key, with explicit failures. Session
  policy is in `../presentation-overrides/session.ts`.
- `spatial-overrides.ts` adapts the source-neutral schema-v2 folder-rule
  registry to a third, independent workspace key. It accepts v1 anchors for
  in-memory migration without writing on read. Session policy, including
  durable write-before-adopt behavior and explicit corrupt-value recovery, is
  in `../spatial-overrides/session.ts`.

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

Network size overrides use
`icarus-graph-explorer:presentation-overrides:<encodeURIComponent(workspaceId)>`.
Only WorkspaceId, EntityId, and a finite multiplier are stored; no path, title,
query, position, or hidden flag. Reset size removes an entry. Stable workspaces save
before adoption; transient and legacy reports keep memory-only sessions. This
uses declared identity provenance, not whether a report is a sample or a vault.
Corrupt data is left untouched and editing blocked with a visible recovery
message; failed writes retain the last confirmed sizes. Reset saved view does
not affect this registry. Missing canonical IDs remain inactive without fuzzy
remapping, and a query-hidden File keeps its entry for when it becomes visible.

All-Network spatial overrides use
`icarus-graph-explorer:spatial-overrides:<encodeURIComponent(workspaceId)>`.
They contain only the workspace ID and normalized folder rules: behavior, exact
or subtree scope, bounded logical X/Y anchor, exclusions, and pull strength.
V1 exact anchors load as v2 place/exact rules; every subsequent write is v2.
Stable identities load and save durably; transient
and legacy reports remain editable only for the current session. Missing or
unreadable storage falls back to a visible session-only state. A corrupt record
remains untouched and blocks edits until the explicit spatial reset deletes
only this key. Durable mutations write before adoption, and a failed write
retains the last confirmed registry. Reset saved view, Graph Preferences,
Visual Groups, Saved Filters, and per-File presentation overrides do not clear
or merge with this registry.

Arrange Folders previews and editor drafts are never written. Pointer release or
**Apply changes** submits one complete schema-v2 Pull or Place rule; behavior,
scope, exclusions, target, and Pull strength cross the storage boundary as one
transaction. The canvas retains a release preview until React renders the
matching confirmed registry and, for Pull, the latest dynamic result adopts or
fails to the visible base-plus-fixed fallback. A failed write restores the last
confirmed displayed composition and moves the session into its existing
blocked-write state. Reset one exact-root rule and the explicitly confirmed
Reset all use the same transaction. Corrupt recovery deletes only this spatial
key and is exposed outside the otherwise-disabled Arrange mode.
