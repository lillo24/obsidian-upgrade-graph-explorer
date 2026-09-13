# Live OpenAI Agents provider

The app connects the existing provider-neutral REVIEW1 workflow to OpenAI with
`@openai/agents`. REVIEW1 still owns Negative and Positive concurrency,
Integrator dependencies, optional post-checks, retries, cancellation, compiler
authorization, and durable run artifacts. One `AgentProvider.start` call maps to
one independent SDK run.

## Ownership and data flow

```text
ReviewWorkspace
  -> OpenAiSessionCredentials (app/WebView memory only)
  -> openai-agents-provider.ts
     -> @openai/agents Runner
        -> OpenAI Responses API over HTTP
```

The default app creates the credential owner, OpenAI provider, Argument compiler
adapter, and `AiReviewController`. Injected controllers remain provider-generic
and do not receive the OpenAI credential UI automatically. A later Tauri or
server transport can replace this adapter behind `AgentProvider` without
changing REVIEW1 or compiler ownership.

## Credential and transport boundary

The user enters a key in a password input. Submission trims it, moves it into a
non-serializable in-memory owner, and immediately clears the DOM input. The
owner exposes only configured state and active-execution count. It has no
storage method and is never passed to review state, history, exports, URLs,
metadata, environment variables, logs, or SDK global defaults. Reloading or
restarting clears it. Clearing or replacing the key cancels executions that
were created from the prior credential.

This local experimental mode deliberately sets `dangerouslyAllowBrowser: true`.
The key is not persisted, but it is present in WebView memory while configured.
Each execution creates an explicit OpenAI client with logging off and client
retries disabled. `OpenAIProvider` is configured for Responses over HTTP with
WebSocket Responses disabled, and `Runner` has tracing explicitly disabled.
No SDK Session, conversation ID, previous response ID, handoff, hosted tool, or
process-wide OpenAI client is used.

Installed runtime versions are pinned in `apps/web/package.json`:

- `@openai/agents` 0.18.0
- `openai` 7.15.0
- `zod` 4.4.3

The workspace override keeps transitive SDK tooling on the same vetted Zod
version, which satisfies the SDK's Zod v4 peer and MCP optional-dependency
ranges without admitting a newer release during frozen-lockfile installation.

The editable default model is `gpt-5.6-sol`. Analysis, Integrator, and
post-check model IDs can differ. The adapter requires provider `openai`, uses
each model ID exactly, maps `temperature` and `maxOutputTokens` to their direct
SDK equivalents, and does not forward app metadata or choose a fallback.

## Prompts, tools, and output

The provider uses a short static system instruction. The exact rendered REVIEW1
prompt—including captured repository material—is supplied as user input so
untrusted source text cannot redefine the provider boundary.

Only tools authorized in `request.tools` are converted to strict SDK function
tools, using their existing JSON schemas. A tool callback emits the SDK call ID
and exact arguments as a REVIEW1 tool-call event, then waits. REVIEW1 dispatches
the request through `CompilerToolDispatcher` and returns the complete
`CompilerResultEnvelope`; the adapter serializes that envelope back into the
same SDK run. Unknown and repeated submissions fail explicitly.

Negative and Positive stream assistant text deltas, but their settled SDK
`finalOutput` is authoritative. Integrator and post-check run without JSON
fragment streaming and use strict Zod v4 transport schemas for
`{ rawMarkdown, structured }`; REVIEW1's provider-neutral validators remain the
final authority.

Each execution has a bounded event queue, monotonic attempt-scoped event IDs,
independent cancellation, and at most one terminal event. Completed usage maps
only normalized input, output, and total token counts when the SDK reports a
request. Failures are classified conservatively as refused, truncated, failed,
or cancelled, with whitelisted actionable messages instead of serialized raw
SDK errors.

## Verification

Automated tests use the SDK's offline `ScriptedModel` and make no network calls.
They cover prompt and model mapping, transport configuration, streaming,
structured output, compiler tool continuation, cancellation, concurrency, and
key-leakage boundaries. A real API smoke is optional and must use an externally
supplied session key that is never written to the repository.

```bash
pnpm exec vitest run apps/web/src/features/ai-review apps/web/src/features/workspace/WorkspaceOverlay.test.tsx packages/ai-review
pnpm check
pnpm desktop:check
```
