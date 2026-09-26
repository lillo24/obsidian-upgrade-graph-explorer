# Local Argument Library MCP server

This package exposes Graph Explorer's canonical Argument Library to local MCP
clients over stdio.

```text
Graph Explorer UI ─┐
                  ├→ same app-local Argument Library JSON
MCP server ──────┘
```

The server reloads and validates `library-v8.json` for every tool call and never
creates a second database. Canonical reader tools remain separate from Mailbox
list/read tools. Narrow staging tools can create and revision-safely revise
bounded non-canonical Proposals; an explicit-user-only discard tool preserves
history and creates no canonical record. No canonical create, update, delete,
import, resolution, source-version, or vault-edit capability is registered.

The intended AI workflow is: reason independently, cross-check the Compiler,
test the candidate against the prior recorded response, and submit it to the
Mailbox only if it still appears novel or unresolved. Submission does not make
the candidate theory; a human owns every canonical resolution.

## Library location

`ICARUS_ARGUMENT_LIBRARY_PATH` takes precedence. Relative configured paths are
resolved from the server process working directory; an absolute path is safer
for MCP host configuration.

Without that variable, the server mirrors Tauri's app-local-data convention for
the `com.icarus.graph-explorer` application identifier:

- Windows: `%LOCALAPPDATA%\com.icarus.graph-explorer\argument-workspace\library-v8.json`
- macOS: `~/Library/Application Support/com.icarus.graph-explorer/argument-workspace/library-v8.json`
- Linux: `$XDG_DATA_HOME` (or `~/.local/share`) followed by
  `com.icarus.graph-explorer/argument-workspace/library-v8.json`

When the derived v8 path is absent, reads may recover the newest valid adjacent
`library-v7.json` through `library-v1.json` via deterministic in-memory migration. An
explicit `ICARUS_ARGUMENT_LIBRARY_PATH` is authoritative and has no implicit
fallback.

If a safe default cannot be derived, the server returns a setup error asking
for `ICARUS_ARGUMENT_LIBRARY_PATH`. Neither status nor errors disclose the
resolved absolute path. Reads are capped at 64 MiB and tool responses at 1 MiB.

For the current Windows desktop library:

```powershell
$env:ICARUS_ARGUMENT_LIBRARY_PATH = Join-Path $env:LOCALAPPDATA 'com.icarus.graph-explorer\argument-workspace\library-v8.json'
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
- `compiler_list_proposals`: lists or text-filters active To store work by
  default, with an explicit status filter for discarded/stored history.
- `compiler_read_proposal`: reads current content, bounded recoverable prior
  revisions, provenance, outgoing draft links, and incoming draft links.
- `compiler_submit_proposal`: creates one active non-canonical Proposal after
  validating payload bounds, exact consultation descriptor and record
  revisions, review intent, optional exact Argument-part target, Topic, typed
  text/Axiom/Argument dependencies, optional reasoning steps, and separate
  source observations. Referenced Topics, targets, and dependencies must also
  appear in consultation records. Legacy `premiseHints`/`suggestedAxiomIds`
  remain a transitional input and normalize immediately to typed premises.
  Optional `softExplanationMarkdown` is a human-review aid only; it is retained
  in Proposal history and never treated as evidence or canonical content.
  `clientSubmissionId` and exact payload retries are idempotent.
- `compiler_revise_proposal`: replaces one active Proposal draft only when its
  expected Proposal revision and complete consultation snapshot are current;
  it retains the previous draft and reason and may update typed draft links.
- `compiler_discard_proposal`: explicit-user-only removal from active To store
  staging. It retains the Proposal as discarded history and creates no
  canonical Argument or Counter-Argument.

The guide, canonical readers, and Proposal list/read tools are annotated
read-only. Proposal creation is non-destructive and idempotent; revision is a
recoverable non-canonical write; discard is marked destructive to emphasize its
explicit-user-only policy even though history is retained. They are intended after an
AI has done its own reasoning and cross-check against the compiler snapshot;
staging mutation is not a correctness verdict. Proposal IDs remain outside
framework knowledge until a human stores an Argument or Counter-Argument.

Index and bundle results preserve the
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

The current server exposes list/read/create/revise/discard staging tools.
Clients must still discover the actual tool list and must never claim an action
that an older deployed server does not expose.

Bundles preserve registered theory-source references, but MCP1 intentionally
does not expose `compiler_read_source`. The standalone process has no authorized
vault/source binding and never follows record paths into the filesystem.

Creation and revision accept candidate title, optional human-facing Soft Explanation,
review intent, examples, typed premises,
optional simple or stepwise reasoning, conclusion, boundary, separate source
observations, why it is novel/unresolved, optional Topic/precise target, and the
consultation descriptor/records. Text, list lengths, and the whole JSON payload
are bounded. A stale consultation, target, or typed dependency fails without
writing. The server performs one expected-snapshot atomic replacement;
concurrent changes return a conflict rather than silently retargeting. Draft
links pin a target Proposal revision and never become canonical relations. The
server never exposes a tool that resolves Proposals or mutates canonical arrays.

## Build, test, and run

The package uses Node 22 or newer, matching the repository requirement.

```powershell
pnpm --filter @icarus-graph-explorer/argument-mcp-server build
pnpm --filter @icarus-graph-explorer/argument-mcp-server test
pnpm --filter @icarus-graph-explorer/argument-mcp-server start
```

`start` always rebuilds `dist/server.js` before waiting for an MCP client on
stdin, so the repository-supported launch path cannot silently reuse an older
embedded guide or tool schema. Waiting on stdin is normal. Protocol messages
use stdout exclusively; build output and the startup diagnostic go to stderr.

An external service that invokes `node packages/argument-mcp-server/dist/server.js`
directly bypasses that protection. Its launcher must run the package `build`
command before every restart, then reconnect the MCP client so the client
rediscovers the current tool schemas. The spawned stdio tests build and launch
that exact deployment artifact and connect through the repository-supported
`start` command against synthetic libraries.

After building, launch the official MCP Inspector from the repository root.
Inspector 2.6.0 requires Node 22.19 or newer. Inspector gives spawned servers a
restricted environment, so pass the custom library variable explicitly with
`-e`:

```powershell
pnpm dlx @modelcontextprotocol/inspector@2.6.0 node packages/argument-mcp-server/dist/server.js -e "ICARUS_ARGUMENT_LIBRARY_PATH=$env:ICARUS_ARGUMENT_LIBRARY_PATH"
```

In the Inspector, connect and use the Tools tab to call status, list/search, and
bundle reads. For a synthetic fixture, point `ICARUS_ARGUMENT_LIBRARY_PATH` at a
temporary schema-v8 JSON file before starting Inspector. Never commit or paste
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
