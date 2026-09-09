# Soft Folder Cluster scope sessions

This folder owns the application session around renderer-neutral HIER4B sparse
folder-scope rules.

- `session.ts` loads one stable-workspace registry and applies durable
  write-before-adopt or visible session-only/error behavior.
- `use-soft-folder-scope.ts` reconciles rules against the canonical workspace
  document-folder inventory and exposes one-group, group-with-siblings, and
  reset mutations to Modular Preview.
- `session.test.ts` covers workspace isolation, transient memory-only behavior,
  and last-confirmed-state retention after a storage failure.

The folder reads no source files and writes no Markdown. Persistence encoding
is owned by `../persistence/soft-folder-scope.ts`.
