# Local Argument Library MCP server

This package exposes Graph Explorer's canonical Argument Library to local MCP
clients over stdio.

```text
Graph Explorer UI ─┐
                  ├→ same app-local Argument Library JSON
MCP server ──────┘
```

The server is read-only. It reloads and validates `library-v4.json` for every
tool call, creates a retained `KnowledgeReader` for that call, and never creates
a second database. No save, create, update, delete, import, source-version, or
vault-edit capability is registered.

## Library location

`ICARUS_ARGUMENT_LIBRARY_PATH` takes precedence. Relative configured paths are
resolved from the server process working directory; an absolute path is safer
for MCP host configuration.

Without that variable, the server mirrors Tauri's app-local-data convention for
the `com.icarus.graph-explorer` application identifier:

- Windows: `%LOCALAPPDATA%\com.icarus.graph-explorer\argument-workspace\library-v4.json`
- macOS: `~/Library/Application Support/com.icarus.graph-explorer/argument-workspace/library-v4.json`
- Linux: `$XDG_DATA_HOME` (or `~/.local/share`) followed by
  `com.icarus.graph-explorer/argument-workspace/library-v4.json`

If a safe default cannot be derived, the server returns a setup error asking
for `ICARUS_ARGUMENT_LIBRARY_PATH`. Neither status nor errors disclose the
resolved absolute path. Reads are capped at 64 MiB and tool responses at 1 MiB.

For the current Windows desktop library:

```powershell
$env:ICARUS_ARGUMENT_LIBRARY_PATH = Join-Path $env:LOCALAPPDATA 'com.icarus.graph-explorer\argument-workspace\library-v4.json'
```

## Tools

- `compiler_usage_guide`: the post-generation retrieval and cross-check
  protocol for an AI using the Compiler.
- `compiler_status`: availability, portable snapshot descriptor, reader
  contract version, and record counts.
- `compiler_list_index`: bounded index paging with `limit`, `cursor`, and
  `includeArchived`.
- `compiler_search_index`: deterministic domain search with required `query`
  plus the same bounded paging/archive options.
- `compiler_read_bundle`: bounded structured context selected by `id`, optional
  `kind`, `maxRecords`, and `maxDepth`.

Every tool is annotated read-only. Index and bundle results preserve the
Argument Workspace result, snapshot, provenance, completeness, omissions, and
consultation receipt rather than flattening them into a new summary schema.
Search before guessing IDs; when an objection exists, read its bundle before
repeating it. Stored records are framework knowledge and may be challenged;
retrieval is not external proof.

Detailed AI usage guidance has one canonical source in
[`docs/ARGUMENT_COMPILER_AI_USAGE.md`](../../docs/ARGUMENT_COMPILER_AI_USAGE.md).
The build embeds that Markdown in `dist/server.js`, and
`compiler_usage_guide` returns it without reading the runtime filesystem or
loading the Argument Library. Its protocol is intended only after independent
candidate reasoning exists: the Compiler is a cross-check and accumulated
reasoning context, not external proof or a generator for the first pass.

A minimal client/project instruction can therefore remain small:

> After independent candidate reasoning, call `compiler_usage_guide` when
> beginning the Icarus Argument Compiler cross-check.

The current server has no Mailbox/proposal-submission tool. The guide is
future-compatible: it permits submission only when the connected tool list
actually exposes that capability, and otherwise requires the AI to present the
surviving proposal without claiming it was submitted.

Bundles preserve registered theory-source references, but MCP1 intentionally
does not expose `compiler_read_source`. The standalone process has no authorized
vault/source binding and never follows record paths into the filesystem.

## Build, test, and run

The package uses Node 22 or newer, matching the repository requirement.

```powershell
pnpm --filter @icarus-graph-explorer/argument-mcp-server build
pnpm --filter @icarus-graph-explorer/argument-mcp-server test
pnpm --filter @icarus-graph-explorer/argument-mcp-server start
```

`start` waits for an MCP client on stdin; that is normal. Protocol messages use
stdout exclusively. The single startup diagnostic goes to stderr.

After building, launch the official MCP Inspector from the repository root.
Inspector 2.6.0 requires Node 22.19 or newer. Inspector gives spawned servers a
restricted environment, so pass the custom library variable explicitly with
`-e`:

```powershell
pnpm dlx @modelcontextprotocol/inspector@2.6.0 node packages/argument-mcp-server/dist/server.js -e "ICARUS_ARGUMENT_LIBRARY_PATH=$env:ICARUS_ARGUMENT_LIBRARY_PATH"
```

In the Inspector, connect and use the Tools tab to call status, list/search, and
bundle reads. For a synthetic fixture, point `ICARUS_ARGUMENT_LIBRARY_PATH` at a
temporary schema-v4 JSON file before starting Inspector. Never commit or paste
the private real library into tests or logs.

For a headless connection check, the same Inspector package also has a CLI
mode:

```powershell
pnpm dlx @modelcontextprotocol/inspector@2.6.0 --cli node packages/argument-mcp-server/dist/server.js -e "ICARUS_ARGUMENT_LIBRARY_PATH=$env:ICARUS_ARGUMENT_LIBRARY_PATH" --method tools/list
pnpm dlx @modelcontextprotocol/inspector@2.6.0 --cli node packages/argument-mcp-server/dist/server.js -e "ICARUS_ARGUMENT_LIBRARY_PATH=$env:ICARUS_ARGUMENT_LIBRARY_PATH" --method tools/call --tool-name compiler_status --tool-args-json '{}'
```

OpenAI Secure MCP Tunnel and ChatGPT MCP configuration are deliberately deferred
to the next step; this package exposes only a local stdio process. After
upgrading or restarting this server, refresh/reconnect the client so it
rediscovers `compiler_usage_guide`; tool descriptions improve discoverability
but cannot guarantee that a model will invoke or obey the guide.
