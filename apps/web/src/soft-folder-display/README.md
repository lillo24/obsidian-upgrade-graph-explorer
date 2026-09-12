# Soft folder display sessions

This folder owns the web application's workspace session and action adapters for
HIER4B's source-neutral nested folder display intent.

- `session.ts` loads one stable-workspace registry and applies durable
  write-before-adopt or visible session-only/error behavior.
- `use-soft-folder-display.ts` reconciles intent against stable canonical File
  identities and exact folder keys, then exposes one commit/reset boundary.
- `context-menu.ts` derives File/folder menu actions and maps each action to one
  pure display-intent change; generic Network actions remain future work.
- Tests cover workspace isolation, schema-1 reset, failed writes, File movement,
  one-level/sibling flattening, restore availability, and root/exact disabled
  states.

This folder reads no source files and writes no Markdown. Persistence encoding
is owned by `../persistence/soft-folder-display.ts`; the pure displayed tree is
owned by the Focus Schematic layout package.
