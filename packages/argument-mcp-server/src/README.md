# Source map

This folder owns the local read-only MCP adapter for the Argument Library.

- `loader.ts` derives the app-local path, reads strict UTF-8 bytes with a size
  bound, validates schema-v2 data (or a deterministic v1 import) through
  Argument Workspace, and creates a new
  retained `KnowledgeReader` for each call.
- `server.ts` registers the four read-only MCP tools and adapts domain results
  to bounded MCP text and structured content.
- `cli.ts` is the stdio-only process entry point; stdout remains reserved for
  MCP protocol messages.
- `test-fixture.ts` builds synthetic public test data through Argument
  Workspace's public authoring API.
- `loader.test.ts`, `server.test.ts`, and `stdio.test.ts` cover file handling,
  tool/domain parity, and a spawned stdio session.
