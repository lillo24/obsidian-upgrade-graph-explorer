# Network presentation session

- `session.ts` owns workspace eligibility, loading, and confirmed mutations.
  Stable workspaces save to the separate v1 presentation-overrides registry;
  transient/legacy reports remain session-only. Eligibility follows the report's
  declared identity provenance, so the bundled stable Synthetic Sample can save.
  A read failure is explicitly
  session-only. Corrupt data is left untouched and editing blocked; a failed
  write keeps the last confirmed sizes active and blocks further writes until
  reopening. Reset current view never clears these entries.
- The source-neutral registry/validation/reconciliation is in
  `packages/presentation-overrides`; `../persistence/presentation-overrides.ts`
  is the local-storage adapter, without graph or UI logic.
- `use-presentation-overrides.ts` retains keyed workspace sessions across
  same-page switching, resolves a sparse canonical-Document-only map, and
  exposes event-driven mutations. It reuses the snapshot's existing entity
  index and never updates KG6 projection state or graph navigation history.
- `session.test.ts` checks persistence isolation, failures, and reset separation.
- `query-compatibility.test.ts` checks All/Focus Hide/unhide, query history, and
  saved-filter isolation without pruning an invisible File's size entry.

There is no path/title fallback. Missing canonical IDs are inactive, not deleted.
Query hiding and scope switching have no persistence side effects.
