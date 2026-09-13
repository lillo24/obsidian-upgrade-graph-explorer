# REVIEW4 live OpenAI Agents provider

REVIEW4 connects the existing REVIEW1 workflow to the public OpenAI Agents API
without moving orchestration or credentials into the webview. Negative and
Positive still start independently, the Integrator starts only after both
succeed, and the optional post-check remains controlled by the REVIEW1 compiler
placement policy.

## Ownership and data flow

```text
ReviewWorkspace / AiReviewController
  -> packages/openai-agents-provider (browser-safe REVIEW1 adapter)
     -> narrow Tauri commands + typed event channel
        -> apps/desktop/src-tauri/src/openai_agents.rs
           -> fixed https://api.openai.com/v1/agents/* endpoints
```

The TypeScript adapter owns explicit model selection, strict structured-output
schemas, native-event validation, ordered output assembly, bounded event
queuing, tool-call correlation, and REVIEW1 event translation. The Rust module
alone reads `OPENAI_API_KEY`, adds `OpenAI-Beta: agents=v1`, performs HTTPS/SSE,
retains remote turn/call mappings, requests cancellation, and attempts bounded
recovery. The bridge accepts no URL, headers, credential, hosted tool, or remote
environment configuration.

Every attempt creates a fresh managed session with `environment.type = none`.
No OpenAI session is reused between Negative, Positive, Integrator, or
post-check. This preserves REVIEW1's application-owned context isolation and
dependency graph instead of delegating the workflow to another agent.

## Upload and credential boundary

Set `OPENAI_API_KEY` in the desktop process environment and restart the app.
There is intentionally no key field in React. The key is never an invoke
argument, provider event, metadata field, history record, export, or log value.
Browser mode stays import-safe and reports that live execution is unavailable.

Starting a run uploads the selected captured material and rendered prompts to
OpenAI; it does not upload the rest of the vault. When compiler placement is
enabled, only an exact serialized result from a declared read-only compiler
function is uploaded, and only after the agent requests that function.

The explicit default is `gpt-6-astra`, matching the current official Agents API
examples and model documentation. One editable model value is applied to every
stage. The adapter rejects empty, mismatched-provider, or unsupported tuning
settings and does not silently fall back to another model.

## Sessions, events, tools, and recovery

The provider uses the official managed-session create shape and treats only a
root turn `completed`, `failed`, `cancelled`, refused, or truncated event as
terminal. SSE EOF, an idle/progress event, malformed JSON, an oversized event,
or an exhausted stream is never success. Relevant text deltas/done events,
usage, safe request/session/turn IDs, and errors are mapped into REVIEW1's
provider-neutral evidence.

Required actions are read from the session's authoritative
`required_actions`. Only the four declared REVIEW1 compiler functions are
accepted. Native state binds the opaque execution ID to the exact managed
session, turn ID, call ID, name, and first submitted result. Identical repeated
results are idempotent; conflicting reuse fails. Domain outcomes such as
`not-found` remain successful JSON tool output rather than transport errors.

Cancellation sends `agent.session.input.cancel`. REVIEW1 marks remote
termination confirmed only when a cancelled root-turn event arrives. An early
request is retained until the session ID exists.

After an unexpected disconnect, native code opens a replacement event stream,
retrieves saved turns/items, restores completed text or terminal state, and
continues streaming. Recovery is limited to two attempts and all buffers,
events, prompts, outputs, tool results, concurrency, and time are bounded.

## Structured output and retention decision

Integrator and post-check configure the Agents API JSON Schema format for an
exact `{ "markdown": string, "structured": object }` envelope with no extra
fields. The adapter parses the entire response as JSON; no prose or regular
expression fallback exists. REVIEW1's existing contribution-reference and
result validators remain final authority after schema decoding.

V1 retains terminal OpenAI sessions. This supports documented stream recovery,
troubleshooting, and user-managed deletion without falsely claiming durable
local capture before a remote delete. Safe remote IDs and the retention label
are stored in adapter metadata; credentials are prohibited there. OpenAI notes
that DELETE removes public API access while physical cleanup may continue
asynchronously. Automatic deletion can be added only with a durable-save
acknowledgement and visible lifecycle policy.

Primary API references: [run managed sessions](https://developers.openai.com/api/docs/guides/agents-api/sessions),
[events and recovery](https://developers.openai.com/api/docs/guides/agents-api/sessions/events),
[custom functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions),
[session management](https://developers.openai.com/api/docs/guides/agents-api/sessions/manage), and
[`gpt-6-astra`](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Verification

The ordinary suite uses synthetic bridges only and performs no network calls.
The ignored paid smoke creates exactly three independent sessions from tiny
synthetic Negative, Positive, and Integrator inputs and never opens a vault.

```powershell
$env:OPENAI_API_KEY = '<key>'
pnpm --filter @icarus-graph-explorer/openai-agents-provider example:live
```

Run the focused local gates with:

```bash
pnpm exec vitest run packages/openai-agents-provider packages/ai-review apps/web/src/features/ai-review apps/web/src/features/workspace/WorkspaceOverlay.test.tsx
pnpm --filter @icarus-graph-explorer/openai-agents-provider typecheck
pnpm desktop:check
```
