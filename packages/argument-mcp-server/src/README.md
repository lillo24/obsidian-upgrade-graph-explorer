# Source map

This folder owns the local MCP adapter for canonical Argument Library reads and
non-canonical Proposal staging.

- `loader.ts` derives the app-local path, reads strict UTF-8 bytes with a size
  bound, validates schema-v8 data (or deterministic v1/v2/v3/v4/v5/v6/v7 imports) through
  Argument Workspace, creates a retained `KnowledgeReader` for each read call,
  and exposes expected-snapshot atomic persistence to the Proposal-only
  service.
- `server.ts` registers canonical and Proposal-staging reads plus bounded
  create/revise/discard Proposal tools, including revision history, draft links,
  review intent, typed dependencies, source provenance, and an optional
  non-canonical human-review Markdown explanation. It does not expose canonical
  authoring or Proposal resolution.
- `usage-guide.ts` imports the canonical Compiler cross-check guide as bundled
  text so the deployed server has no documentation-file runtime dependency.
- `raw-imports.d.ts` declares that build-time raw Markdown import for
  TypeScript.
- `cli.ts` is the stdio-only process entry point; stdout remains reserved for
  MCP protocol messages.
- `test-fixture.ts` builds synthetic public test data through Argument
  Workspace's public authoring API.
- `loader.test.ts`, `server.test.ts`, and `stdio.test.ts` cover file handling,
  tool/domain parity, guide invariants, and a spawned bundled stdio session.
