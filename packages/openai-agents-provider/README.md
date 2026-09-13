# OpenAI Agents provider

This package adapts the desktop-only OpenAI Agents API transport to REVIEW1's
provider-neutral `AgentProvider`. It owns browser-safe availability detection,
native event validation, bounded event queuing, function-call correlation, and
strict Integrator/post-check envelopes. It never reads or receives an API key.

```text
src/
  types.ts       Narrow native contracts, availability, and stable identifiers.
  schemas.ts     Exact REVIEW1 JSON Schemas wrapped with human-readable Markdown.
  bridge.ts      Browser-safe Tauri invoke/channel boundary.
  validation.ts  Runtime validation for untrusted native responses and events.
  provider.ts    REVIEW1 lifecycle, output assembly, tool mapping, and cancellation.
  index.ts       Intentional public exports.
```

The Rust owner is `apps/desktop/src-tauri/src/openai_agents.rs`. It reads
`OPENAI_API_KEY` only in the desktop process and calls fixed
`https://api.openai.com/v1/agents/...` endpoints with
`OpenAI-Beta: agents=v1`. The webview can supply only an attempt's model,
rendered instructions, declared REVIEW1 compiler functions, structured-output
schema, finite limits, and opaque execution identity. It cannot supply a URL,
header, or credential.

Each REVIEW1 attempt creates a fresh managed session with
`environment: { "type": "none" }`, no hosted tools, and no Agents API
multi-agent delegation. Negative and Positive therefore never share remote
context. Function results are returned to the exact retained session/turn/call
mapping and domain statuses such as `not-found` remain successful serialized
tool output.

Integrator and post-check use the current Agents API
`agent.text.format: { type: "json_schema", schema }` shape. Their response is
an exact `{ markdown, structured }` envelope; the adapter parses the entire
response and REVIEW1 remains the final validator. There is no prose or regex
fallback.

Unexpected stream closure is never success. Native recovery opens a replacement
event stream, retrieves the managed session and saved items/turns, restores
completed output or pending functions, and retries within a finite budget.
Cancellation submits `agent.session.input.cancel`; REVIEW1 records remote
confirmation only after a root `agent.session.turn.cancelled` event.

V1 retains terminal remote sessions for bounded recovery, troubleshooting, and
user-managed deletion. The remote session ID and safe request ID are stored in
adapter metadata. The app does not claim deletion: OpenAI documents that a
successful session DELETE removes it from the public API while physical cleanup
can continue asynchronously.

## Configuration

Set `OPENAI_API_KEY` for the desktop process and restart the app. The key is not
accepted in the React UI, Tauri arguments, history, exports, metadata, or logs.
`gpt-6-astra` is the default model verified in current OpenAI Agents API
examples; there is no silent model fallback.

## Live smoke (opt-in and paid)

The ignored Rust smoke uses tiny synthetic material and creates independent
Negative, Positive, and Integrator sessions. It never opens a vault.

```powershell
$env:OPENAI_API_KEY = '<key>'
pnpm --filter @icarus-graph-explorer/openai-agents-provider example:live
```

This command is intentionally excluded from `pnpm check`.
