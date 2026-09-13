use futures_util::StreamExt;
use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{ipc::Channel, State};

const SCHEMA_VERSION: u8 = 1;
const API_ROOT: &str = "https://api.openai.com/v1";
const BETA_HEADER: &str = "agents=v1";
const DEFAULT_MODEL: &str = "gpt-6-astra";
const MAX_ACTIVE_EXECUTIONS: usize = 4;
const MAX_MODEL_BYTES: usize = 128;
const MAX_TOOLS: usize = 4;
const MAX_SSE_EVENT_BYTES: usize = 256 * 1024;
const MAX_RECOVERIES: usize = 2;
const ALLOWED_TOOLS: [&str; 4] = [
    "compiler_list_index",
    "compiler_search_index",
    "compiler_read_bundle",
    "compiler_read_source",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiAgentsError {
    code: String,
    message: String,
}

impl OpenAiAgentsError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_owned(),
            message: message.into(),
        }
    }
}

type AgentResult<T> = Result<T, OpenAiAgentsError>;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeLimits {
    max_prompt_bytes: usize,
    max_output_bytes: usize,
    max_execution_ms: u64,
    max_tool_result_bytes: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderToolDefinition {
    name: String,
    description: String,
    input_schema: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeAgentStartInput {
    schema_version: u8,
    execution_id: String,
    run_id: String,
    attempt_id: String,
    stage: String,
    model: String,
    instructions: String,
    tools: Vec<ProviderToolDefinition>,
    #[serde(default)]
    text_schema: Option<Value>,
    limits: NativeLimits,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeToolResultInput {
    schema_version: u8,
    execution_id: String,
    tool_call_id: String,
    name: String,
    output: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeExecutionInput {
    schema_version: u8,
    execution_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Availability {
    supported: bool,
    ready: bool,
    provider: &'static str,
    message: &'static str,
    default_model: &'static str,
    beta_version: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStartSummary {
    schema_version: u8,
    execution_id: String,
    session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<String>,
    recovery_count: usize,
    retention: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancellationResult {
    schema_version: u8,
    requested: bool,
    remote_request_accepted: bool,
}

#[derive(Clone)]
struct PendingCall {
    turn_id: String,
    call_id: String,
    name: String,
    submitted_output: Option<String>,
    submission_in_flight: Option<String>,
}

struct ActiveExecution {
    model: String,
    allowed_tools: HashSet<String>,
    session_id: Mutex<Option<String>>,
    pending_calls: Mutex<HashMap<String, PendingCall>>,
    cancel_requested: AtomicBool,
    cancel_sent: AtomicBool,
    terminal_seen: AtomicBool,
    max_tool_result_bytes: usize,
}

pub struct OpenAiAgentsState {
    api_key: Option<Arc<str>>,
    client: Client,
    active: Mutex<HashMap<String, Arc<ActiveExecution>>>,
}

impl Default for OpenAiAgentsState {
    fn default() -> Self {
        let api_key = std::env::var("OPENAI_API_KEY")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(Arc::<str>::from);
        Self {
            api_key,
            client: Client::builder()
                .user_agent("icarus-graph-explorer/ai-review")
                .build()
                .expect("fixed OpenAI HTTP client configuration must be valid"),
            active: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub fn openai_agents_availability(state: State<'_, OpenAiAgentsState>) -> Availability {
    let ready = state.api_key.is_some();
    Availability {
        supported: true,
        ready,
        provider: "openai-agents",
        message: if ready {
            "OpenAI live review is ready. Selected captured material and prompts will be uploaded when you run it."
        } else {
            "OpenAI live review is unavailable. Set OPENAI_API_KEY for the desktop process and restart the app."
        },
        default_model: DEFAULT_MODEL,
        beta_version: BETA_HEADER,
    }
}

fn validate_schema(version: u8) -> AgentResult<()> {
    if version == SCHEMA_VERSION {
        Ok(())
    } else {
        Err(OpenAiAgentsError::new(
            "incompatible-native-schema",
            "The web and desktop OpenAI Agents schemas are incompatible.",
        ))
    }
}

fn validate_identifier(value: &str, label: &str) -> AgentResult<()> {
    if value.is_empty() || value.len() > 256 || !value.is_ascii() {
        return Err(OpenAiAgentsError::new(
            "invalid-request",
            format!("{label} is invalid."),
        ));
    }
    Ok(())
}

fn validate_start(input: &NativeAgentStartInput) -> AgentResult<()> {
    validate_schema(input.schema_version)?;
    validate_identifier(&input.execution_id, "Execution ID")?;
    validate_identifier(&input.run_id, "Run ID")?;
    validate_identifier(&input.attempt_id, "Attempt ID")?;
    if !matches!(
        input.stage.as_str(),
        "negative" | "positive" | "integrator" | "post-check"
    ) {
        return Err(OpenAiAgentsError::new(
            "invalid-stage",
            "Review stage is invalid.",
        ));
    }
    if input.model.trim().is_empty()
        || input.model.len() > MAX_MODEL_BYTES
        || !input.model.is_ascii()
    {
        return Err(OpenAiAgentsError::new(
            "invalid-model",
            "OpenAI model is invalid.",
        ));
    }
    if input.instructions.as_bytes().len() > input.limits.max_prompt_bytes {
        return Err(OpenAiAgentsError::new(
            "prompt-byte-limit",
            "Rendered review instructions exceed the configured prompt limit.",
        ));
    }
    if input.limits.max_execution_ms == 0
        || input.limits.max_output_bytes == 0
        || input.limits.max_tool_result_bytes == 0
    {
        return Err(OpenAiAgentsError::new(
            "invalid-limits",
            "OpenAI execution limits must be positive.",
        ));
    }
    if input.tools.len() > MAX_TOOLS {
        return Err(OpenAiAgentsError::new(
            "tool-limit",
            "Too many compiler functions were declared.",
        ));
    }
    let allowed = HashSet::from(ALLOWED_TOOLS);
    let mut names = HashSet::new();
    for tool in &input.tools {
        if !allowed.contains(tool.name.as_str()) || !names.insert(tool.name.as_str()) {
            return Err(OpenAiAgentsError::new(
                "unauthorized-tool",
                "Only distinct, declared REVIEW1 compiler functions are allowed.",
            ));
        }
        if !tool.input_schema.is_object() {
            return Err(OpenAiAgentsError::new(
                "invalid-tool-schema",
                "Compiler function input schemas must be JSON objects.",
            ));
        }
    }
    let structured_stage = matches!(input.stage.as_str(), "integrator" | "post-check");
    if structured_stage != input.text_schema.is_some() {
        return Err(OpenAiAgentsError::new(
            "invalid-text-schema",
            "Structured output schema does not match the review stage.",
        ));
    }
    Ok(())
}

fn request_body(input: &NativeAgentStartInput) -> Value {
    let tools = input
        .tools
        .iter()
        .map(|tool| {
            json!({
                "type": "function",
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            })
        })
        .collect::<Vec<_>>();
    let mut agent = Map::new();
    agent.insert("model".to_owned(), json!(input.model));
    agent.insert("tools".to_owned(), Value::Array(tools));
    if let Some(schema) = &input.text_schema {
        agent.insert(
            "text".to_owned(),
            json!({ "format": { "type": "json_schema", "schema": schema } }),
        );
    }
    json!({
        "agent": agent,
        "environment": { "type": "none" },
        "input": input.instructions,
        "stream": true,
    })
}

fn map_status(status: StatusCode) -> OpenAiAgentsError {
    let (code, message) = match status.as_u16() {
        400 => (
            "openai-invalid-request",
            "OpenAI rejected the agent request.",
        ),
        401 => (
            "openai-authentication",
            "OPENAI_API_KEY was rejected by OpenAI.",
        ),
        403 => (
            "openai-permission",
            "The OpenAI account cannot use the requested Agents API resource.",
        ),
        404 => (
            "openai-not-found",
            "The requested OpenAI model or session was not found.",
        ),
        409 => (
            "openai-conflict",
            "OpenAI reported a conflicting session operation.",
        ),
        429 => (
            "openai-rate-limit",
            "OpenAI rate or quota limits prevented this review stage.",
        ),
        500..=599 => ("openai-service", "OpenAI could not complete the request."),
        _ => ("openai-http", "OpenAI returned an unexpected HTTP status."),
    };
    OpenAiAgentsError::new(code, message)
}

fn map_transport(error: reqwest::Error) -> OpenAiAgentsError {
    if error.is_timeout() {
        OpenAiAgentsError::new("openai-timeout", "The OpenAI request timed out.")
    } else {
        OpenAiAgentsError::new(
            "openai-network",
            "The OpenAI request could not be completed.",
        )
    }
}

fn api_request(
    state: &OpenAiAgentsState,
    method: reqwest::Method,
    path: &str,
    timeout: Duration,
) -> AgentResult<reqwest::RequestBuilder> {
    let api_key = state.api_key.as_ref().ok_or_else(|| {
        OpenAiAgentsError::new(
            "missing-openai-api-key",
            "Set OPENAI_API_KEY for the desktop process and restart the app.",
        )
    })?;
    Ok(state
        .client
        .request(method, format!("{API_ROOT}{path}"))
        .bearer_auth(api_key.as_ref())
        .header("OpenAI-Beta", BETA_HEADER)
        .timeout(timeout))
}

async fn checked(response: Result<Response, reqwest::Error>) -> AgentResult<Response> {
    let response = response.map_err(map_transport)?;
    if !response.status().is_success() {
        return Err(map_status(response.status()));
    }
    Ok(response)
}

fn event_id(event: &Value, sequence: usize) -> String {
    event
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| format!("native-event-{sequence}"))
}

fn nested<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter()
        .try_fold(value, |current, key| current.get(*key))
}

fn string_at(value: &Value, paths: &[&[&str]]) -> Option<String> {
    paths
        .iter()
        .find_map(|path| nested(value, path).and_then(Value::as_str))
        .map(str::to_owned)
}

fn send(channel: &Channel<Value>, value: Value) -> AgentResult<()> {
    channel.send(value).map_err(|_| {
        OpenAiAgentsError::new(
            "event-channel-closed",
            "The review event channel closed before the OpenAI stage ended.",
        )
    })
}

fn terminal_status(event_type: &str) -> Option<&'static str> {
    match event_type {
        "agent.session.turn.completed" => Some("completed"),
        "agent.session.turn.refused" => Some("refused"),
        "agent.session.turn.incomplete" | "agent.session.turn.truncated" => Some("truncated"),
        "agent.session.turn.failed" => Some("failed"),
        "agent.session.turn.cancelled" => Some("cancelled"),
        _ => None,
    }
}

fn usage(event: &Value) -> Option<Value> {
    let source = event.get("turn").and_then(|turn| turn.get("usage"))?;
    let mut mapped = Map::new();
    for (remote, local) in [
        ("input_tokens", "inputTokens"),
        ("output_tokens", "outputTokens"),
        ("total_tokens", "totalTokens"),
    ] {
        if let Some(value) = source.get(remote).and_then(Value::as_u64) {
            mapped.insert(local.to_owned(), json!(value));
        }
    }
    (!mapped.is_empty()).then_some(Value::Object(mapped))
}

fn next_sse_frame(buffer: &[u8]) -> Option<usize> {
    let lf = buffer
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|position| position + 2);
    let crlf = buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|position| position + 4);
    match (lf, crlf) {
        (Some(left), Some(right)) => Some(left.min(right)),
        (Some(end), None) | (None, Some(end)) => Some(end),
        (None, None) => None,
    }
}

fn process_event(
    event: &Value,
    active: &Arc<ActiveExecution>,
    channel: &Channel<Value>,
    request_id: Option<&str>,
    recovery_count: usize,
    sequence: usize,
) -> AgentResult<bool> {
    let event_type = event.get("type").and_then(Value::as_str).ok_or_else(|| {
        OpenAiAgentsError::new(
            "malformed-openai-event",
            "OpenAI sent an event without a type.",
        )
    })?;
    let id = event_id(event, sequence);
    match event_type {
        "agent.session.created" => {
            let session_id =
                string_at(event, &[&["session", "id"], &["session_id"]]).ok_or_else(|| {
                    OpenAiAgentsError::new(
                        "malformed-openai-event",
                        "OpenAI session creation omitted its ID.",
                    )
                })?;
            *active.session_id.lock().expect("session lock poisoned") = Some(session_id.clone());
            let mut payload = json!({
                "schemaVersion": SCHEMA_VERSION,
                "type": "session-created",
                "eventId": id,
                "sessionId": session_id,
                "model": active.model,
            });
            if let Some(request_id) = request_id {
                payload["requestId"] = json!(request_id);
            }
            send(channel, payload)?;
        }
        "agent.session.turn.output_text.delta" => {
            let turn_id = string_at(event, &[&["turn_id"]]).ok_or_else(|| {
                OpenAiAgentsError::new("malformed-openai-event", "Output delta omitted turn_id.")
            })?;
            let item_id = string_at(event, &[&["item_id"]]).ok_or_else(|| {
                OpenAiAgentsError::new("malformed-openai-event", "Output delta omitted item_id.")
            })?;
            send(
                channel,
                json!({
                    "schemaVersion": SCHEMA_VERSION,
                    "type": "output-text-delta",
                    "eventId": id,
                    "turnId": turn_id,
                    "itemId": item_id,
                    "outputIndex": event.get("output_index").and_then(Value::as_u64).unwrap_or(0),
                    "contentIndex": event.get("content_index").and_then(Value::as_u64).unwrap_or(0),
                    "delta": event.get("delta").and_then(Value::as_str).unwrap_or(""),
                }),
            )?;
        }
        "agent.session.turn.output_text.done" => {
            let turn_id = string_at(event, &[&["turn_id"]]).ok_or_else(|| {
                OpenAiAgentsError::new(
                    "malformed-openai-event",
                    "Completed output omitted turn_id.",
                )
            })?;
            let item_id = string_at(event, &[&["item_id"]]).ok_or_else(|| {
                OpenAiAgentsError::new(
                    "malformed-openai-event",
                    "Completed output omitted item_id.",
                )
            })?;
            send(
                channel,
                json!({
                    "schemaVersion": SCHEMA_VERSION,
                    "type": "output-text-done",
                    "eventId": id,
                    "turnId": turn_id,
                    "itemId": item_id,
                    "outputIndex": event.get("output_index").and_then(Value::as_u64).unwrap_or(0),
                    "contentIndex": event.get("content_index").and_then(Value::as_u64).unwrap_or(0),
                    "text": event.get("text").and_then(Value::as_str).unwrap_or(""),
                }),
            )?;
        }
        "agent.session.requires_action" => {
            let actions = event
                .get("session")
                .and_then(|session| session.get("required_actions"))
                .or_else(|| event.get("required_actions"))
                .and_then(Value::as_array)
                .ok_or_else(|| {
                    OpenAiAgentsError::new(
                        "malformed-required-action",
                        "OpenAI omitted required function actions.",
                    )
                })?;
            let mut emitted = Vec::with_capacity(actions.len());
            let mut pending = active.pending_calls.lock().expect("pending lock poisoned");
            for action in actions {
                if action.get("type").and_then(Value::as_str) != Some("function_call") {
                    return Err(OpenAiAgentsError::new(
                        "unsupported-required-action",
                        "OpenAI requested an unsupported action type.",
                    ));
                }
                let turn_id = action
                    .get("turn_id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| {
                        OpenAiAgentsError::new(
                            "malformed-required-action",
                            "Function action omitted turn_id.",
                        )
                    })?
                    .to_owned();
                let call_id = action
                    .get("call_id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| {
                        OpenAiAgentsError::new(
                            "malformed-required-action",
                            "Function action omitted call_id.",
                        )
                    })?
                    .to_owned();
                let name = action
                    .get("name")
                    .and_then(Value::as_str)
                    .ok_or_else(|| {
                        OpenAiAgentsError::new(
                            "malformed-required-action",
                            "Function action omitted name.",
                        )
                    })?
                    .to_owned();
                if !active.allowed_tools.contains(&name) {
                    return Err(OpenAiAgentsError::new(
                        "unauthorized-tool",
                        "OpenAI requested an undeclared function.",
                    ));
                }
                let arguments = action
                    .get("arguments")
                    .cloned()
                    .unwrap_or_else(|| json!({}));
                if let Some(existing) = pending.get(&call_id) {
                    if existing.turn_id != turn_id || existing.name != name {
                        return Err(OpenAiAgentsError::new(
                            "conflicting-tool-call",
                            "OpenAI reused a function call ID with different data.",
                        ));
                    }
                    continue;
                }
                pending.insert(
                    call_id.clone(),
                    PendingCall {
                        turn_id: turn_id.clone(),
                        call_id: call_id.clone(),
                        name: name.clone(),
                        submitted_output: None,
                        submission_in_flight: None,
                    },
                );
                emitted.push(json!({
                    "type": "function-call",
                    "toolCallId": call_id,
                    "turnId": turn_id,
                    "name": name,
                    "arguments": arguments,
                }));
            }
            drop(pending);
            if !emitted.is_empty() {
                send(
                    channel,
                    json!({
                        "schemaVersion": SCHEMA_VERSION,
                        "type": "requires-action",
                        "eventId": id,
                        "actions": emitted,
                    }),
                )?;
            }
        }
        _ if terminal_status(event_type).is_some() => {
            let status = terminal_status(event_type).expect("guarded terminal status");
            active.terminal_seen.store(true, Ordering::Release);
            let mut payload = json!({
                "schemaVersion": SCHEMA_VERSION,
                "type": "terminal",
                "eventId": id,
                "status": status,
                "recoveryCount": recovery_count,
            });
            if let Some(turn_id) = string_at(event, &[&["turn", "id"], &["turn_id"]]) {
                payload["turnId"] = json!(turn_id);
            }
            if let Some(usage) = usage(event) {
                payload["usage"] = usage;
            }
            if status == "failed" {
                payload["error"] = json!("OpenAI reported that the agent turn failed.");
            }
            send(channel, payload)?;
            return Ok(true);
        }
        "agent.session.turn.started" => {
            send(
                channel,
                json!({
                    "schemaVersion": SCHEMA_VERSION,
                    "type": "progress",
                    "eventId": id,
                    "message": "OpenAI agent turn started…",
                }),
            )?;
        }
        _ => {}
    }
    Ok(false)
}

async fn consume_sse(
    response: Response,
    active: &Arc<ActiveExecution>,
    channel: &Channel<Value>,
    request_id: Option<&str>,
    recovery_count: usize,
) -> AgentResult<bool> {
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::<u8>::new();
    let mut sequence = 0usize;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(map_transport)?;
        buffer.extend_from_slice(&chunk);
        if buffer.len() > MAX_SSE_EVENT_BYTES * 2 {
            return Err(OpenAiAgentsError::new(
                "sse-buffer-limit",
                "OpenAI event buffering exceeded its safety limit.",
            ));
        }
        while let Some(end) = next_sse_frame(&buffer) {
            let frame = buffer.drain(..end).collect::<Vec<_>>();
            if frame.len() > MAX_SSE_EVENT_BYTES {
                return Err(OpenAiAgentsError::new(
                    "sse-event-limit",
                    "OpenAI sent an oversized event.",
                ));
            }
            let text = std::str::from_utf8(&frame).map_err(|_| {
                OpenAiAgentsError::new("malformed-sse", "OpenAI sent non-UTF-8 event data.")
            })?;
            let data = text
                .lines()
                .filter_map(|line| line.strip_prefix("data:"))
                .map(str::trim_start)
                .collect::<Vec<_>>()
                .join("\n");
            if data.is_empty() || data == "[DONE]" {
                continue;
            }
            let event: Value = serde_json::from_str(&data).map_err(|_| {
                OpenAiAgentsError::new("malformed-sse", "OpenAI sent invalid JSON event data.")
            })?;
            sequence += 1;
            if process_event(
                &event,
                active,
                channel,
                request_id,
                recovery_count,
                sequence,
            )? {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

async fn send_cancel(
    state: &OpenAiAgentsState,
    session_id: &str,
    timeout: Duration,
) -> AgentResult<bool> {
    let response = checked(
        api_request(
            state,
            reqwest::Method::POST,
            &format!("/agents/sessions/{session_id}/events"),
            timeout,
        )?
        .json(&json!({ "type": "agent.session.input.cancel" }))
        .send()
        .await,
    )
    .await?;
    Ok(response.status().is_success())
}

async fn recover_snapshot(
    state: &OpenAiAgentsState,
    session_id: &str,
    active: &Arc<ActiveExecution>,
    channel: &Channel<Value>,
    timeout: Duration,
    recovery_count: usize,
) -> AgentResult<bool> {
    let session = checked(
        api_request(
            state,
            reqwest::Method::GET,
            &format!("/agents/sessions/{session_id}"),
            timeout,
        )?
        .send()
        .await,
    )
    .await?
    .json::<Value>()
    .await
    .map_err(map_transport)?;
    if session
        .get("required_actions")
        .and_then(Value::as_array)
        .is_some_and(|actions| !actions.is_empty())
    {
        process_event(
            &json!({
                "type": "agent.session.requires_action",
                "id": format!("recovery-{recovery_count}-required-actions"),
                "session": session,
            }),
            active,
            channel,
            None,
            recovery_count,
            0,
        )?;
    }
    let turns = checked(
        api_request(
            state,
            reqwest::Method::GET,
            &format!("/agents/sessions/{session_id}/turns?limit=20"),
            timeout,
        )?
        .send()
        .await,
    )
    .await?
    .json::<Value>()
    .await
    .map_err(map_transport)?;
    let items = checked(
        api_request(
            state,
            reqwest::Method::GET,
            &format!("/agents/sessions/{session_id}/items?limit=100"),
            timeout,
        )?
        .send()
        .await,
    )
    .await?
    .json::<Value>()
    .await
    .map_err(map_transport)?;
    let item_data = items
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let output = item_data
        .iter()
        .flat_map(|item| {
            item.get("content")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter(|content| content.get("type").and_then(Value::as_str) == Some("output_text"))
        .filter_map(|content| content.get("text").and_then(Value::as_str))
        .collect::<String>();
    let latest = turns
        .get("data")
        .and_then(Value::as_array)
        .and_then(|data| data.first());
    let turn_id = latest
        .and_then(|turn| turn.get("id"))
        .and_then(Value::as_str)
        .unwrap_or("recovered-turn");
    if !output.is_empty() {
        send(
            channel,
            json!({
                "schemaVersion": SCHEMA_VERSION,
                "type": "recovered-output",
                "eventId": format!("recovery-{recovery_count}-output"),
                "turnId": turn_id,
                "text": output,
            }),
        )?;
    }
    let status = latest
        .and_then(|turn| turn.get("status"))
        .and_then(Value::as_str);
    if matches!(status, Some("completed" | "failed" | "cancelled")) {
        active.terminal_seen.store(true, Ordering::Release);
        send(
            channel,
            json!({
                "schemaVersion": SCHEMA_VERSION,
                "type": "terminal",
                "eventId": format!("recovery-{recovery_count}-terminal"),
                "status": status,
                "turnId": turn_id,
                "recoveryCount": recovery_count,
            }),
        )?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn start_openai_agent(
    input: NativeAgentStartInput,
    on_event: Channel<Value>,
    state: State<'_, OpenAiAgentsState>,
) -> AgentResult<NativeStartSummary> {
    validate_start(&input)?;
    if state.api_key.is_none() {
        return Err(OpenAiAgentsError::new(
            "missing-openai-api-key",
            "Set OPENAI_API_KEY for the desktop process and restart the app.",
        ));
    }
    let active = Arc::new(ActiveExecution {
        model: input.model.clone(),
        allowed_tools: input.tools.iter().map(|tool| tool.name.clone()).collect(),
        session_id: Mutex::new(None),
        pending_calls: Mutex::new(HashMap::new()),
        cancel_requested: AtomicBool::new(false),
        cancel_sent: AtomicBool::new(false),
        terminal_seen: AtomicBool::new(false),
        max_tool_result_bytes: input.limits.max_tool_result_bytes,
    });
    {
        let mut executions = state.active.lock().expect("execution lock poisoned");
        if executions.len() >= MAX_ACTIVE_EXECUTIONS {
            return Err(OpenAiAgentsError::new(
                "execution-limit",
                "Too many OpenAI review stages are active.",
            ));
        }
        if executions
            .insert(input.execution_id.clone(), active.clone())
            .is_some()
        {
            return Err(OpenAiAgentsError::new(
                "duplicate-execution",
                "OpenAI execution ID is already active.",
            ));
        }
    }
    let timeout = Duration::from_millis(input.limits.max_execution_ms);
    let run = async {
        let response = checked(
            api_request(&state, reqwest::Method::POST, "/agents/sessions", timeout)?
                .json(&request_body(&input))
                .send()
                .await,
        )
        .await?;
        let request_id = response.headers().get("x-request-id").and_then(|value| value.to_str().ok()).map(str::to_owned);
        let mut terminal = consume_sse(response, &active, &on_event, request_id.as_deref(), 0).await?;
        let session_id = active.session_id.lock().expect("session lock poisoned").clone().ok_or_else(|| OpenAiAgentsError::new("missing-session-id", "OpenAI did not establish a managed session."))?;
        if active.cancel_requested.load(Ordering::Acquire)
            && !active.terminal_seen.load(Ordering::Acquire)
            && !active.cancel_sent.swap(true, Ordering::AcqRel)
        {
            if let Err(error) = send_cancel(&state, &session_id, timeout).await {
                active.cancel_sent.store(false, Ordering::Release);
                return Err(error);
            }
        }
        let mut recovery_count = 0usize;
        while !terminal && recovery_count < MAX_RECOVERIES {
            recovery_count += 1;
            send(&on_event, json!({
                "schemaVersion": SCHEMA_VERSION,
                "type": "progress",
                "eventId": format!("recovery-{recovery_count}"),
                "message": "OpenAI stream interrupted; recovering the managed session…",
            }))?;
            let replacement = checked(
                api_request(&state, reqwest::Method::GET, &format!("/agents/sessions/{session_id}/events"), timeout)?
                    .send()
                    .await,
            )
            .await?;
            terminal = recover_snapshot(&state, &session_id, &active, &on_event, timeout, recovery_count).await?;
            if !terminal {
                terminal = consume_sse(replacement, &active, &on_event, request_id.as_deref(), recovery_count).await?;
            }
        }
        if !terminal {
            return Err(OpenAiAgentsError::new("unexpected-stream-end", "OpenAI session ended without an explicit terminal turn event after bounded recovery."));
        }
        Ok(NativeStartSummary {
            schema_version: SCHEMA_VERSION,
            execution_id: input.execution_id.clone(),
            session_id,
            request_id,
            recovery_count,
            retention: "retained",
        })
    }
    .await;
    state
        .active
        .lock()
        .expect("execution lock poisoned")
        .remove(&input.execution_id);
    run
}

#[tauri::command]
pub async fn submit_openai_agent_tool_result(
    input: NativeToolResultInput,
    state: State<'_, OpenAiAgentsState>,
) -> AgentResult<()> {
    validate_schema(input.schema_version)?;
    validate_identifier(&input.execution_id, "Execution ID")?;
    validate_identifier(&input.tool_call_id, "Tool call ID")?;
    let active = state
        .active
        .lock()
        .expect("execution lock poisoned")
        .get(&input.execution_id)
        .cloned()
        .ok_or_else(|| {
            OpenAiAgentsError::new("unknown-execution", "OpenAI execution is no longer active.")
        })?;
    let output = serde_json::to_string(&input.output).map_err(|_| {
        OpenAiAgentsError::new(
            "invalid-tool-result",
            "Compiler result is not serializable JSON.",
        )
    })?;
    if output.as_bytes().len() > active.max_tool_result_bytes {
        return Err(OpenAiAgentsError::new(
            "tool-result-byte-limit",
            "Compiler result exceeds its configured byte limit.",
        ));
    }
    let call = {
        let mut pending = active.pending_calls.lock().expect("pending lock poisoned");
        let call = pending.get_mut(&input.tool_call_id).ok_or_else(|| {
            OpenAiAgentsError::new(
                "unknown-tool-call",
                "No pending OpenAI function call matches this result.",
            )
        })?;
        if call.name != input.name {
            return Err(OpenAiAgentsError::new(
                "tool-name-mismatch",
                "Compiler result name does not match the pending OpenAI function call.",
            ));
        }
        if let Some(previous) = &call.submitted_output {
            return if previous == &output {
                Ok(())
            } else {
                Err(OpenAiAgentsError::new(
                    "conflicting-tool-result",
                    "A different result was already submitted for this function call.",
                ))
            };
        }
        if call.submission_in_flight.is_some() {
            return Err(OpenAiAgentsError::new(
                "tool-result-in-flight",
                "This OpenAI function result is already being submitted.",
            ));
        }
        call.submission_in_flight = Some(output.clone());
        call.clone()
    };
    let session_id = active
        .session_id
        .lock()
        .expect("session lock poisoned")
        .clone()
        .ok_or_else(|| {
            OpenAiAgentsError::new(
                "missing-session-id",
                "OpenAI session is not ready for function results.",
            )
        })?;
    let delivery = checked(
        api_request(
            &state,
            reqwest::Method::POST,
            &format!("/agents/sessions/{session_id}/events"),
            Duration::from_secs(30),
        )?
        .header(
            "Idempotency-Key",
            format!("{}:{}", input.execution_id, call.call_id),
        )
        .json(&json!({
            "type": "agent.session.input.tool_result",
            "turn_id": call.turn_id,
            "call_id": call.call_id,
            "success": true,
            "output": output,
        }))
        .send()
        .await,
    )
    .await;
    let mut pending = active.pending_calls.lock().expect("pending lock poisoned");
    let retained = pending.get_mut(&input.tool_call_id).ok_or_else(|| {
        OpenAiAgentsError::new(
            "unknown-tool-call",
            "The pending OpenAI function call disappeared during submission.",
        )
    })?;
    retained.submission_in_flight = None;
    match delivery {
        Ok(response) => {
            drop(response);
            retained.submitted_output = Some(output);
        }
        Err(error) => return Err(error),
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_openai_agent(
    input: NativeExecutionInput,
    state: State<'_, OpenAiAgentsState>,
) -> AgentResult<CancellationResult> {
    validate_schema(input.schema_version)?;
    validate_identifier(&input.execution_id, "Execution ID")?;
    let active = state
        .active
        .lock()
        .expect("execution lock poisoned")
        .get(&input.execution_id)
        .cloned();
    let Some(active) = active else {
        return Ok(CancellationResult {
            schema_version: SCHEMA_VERSION,
            requested: true,
            remote_request_accepted: false,
        });
    };
    active.cancel_requested.store(true, Ordering::Release);
    let session_id = active
        .session_id
        .lock()
        .expect("session lock poisoned")
        .clone();
    let remote_request_accepted = if let Some(session_id) = session_id {
        if active.cancel_sent.swap(true, Ordering::AcqRel) {
            true
        } else {
            match send_cancel(&state, &session_id, Duration::from_secs(30)).await {
                Ok(accepted) => accepted,
                Err(error) => {
                    active.cancel_sent.store(false, Ordering::Release);
                    return Err(error);
                }
            }
        }
    } else {
        false
    };
    Ok(CancellationResult {
        schema_version: SCHEMA_VERSION,
        requested: true,
        remote_request_accepted,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn active(tools: &[&str]) -> Arc<ActiveExecution> {
        Arc::new(ActiveExecution {
            model: DEFAULT_MODEL.to_owned(),
            allowed_tools: tools.iter().map(|name| (*name).to_owned()).collect(),
            session_id: Mutex::new(None),
            pending_calls: Mutex::new(HashMap::new()),
            cancel_requested: AtomicBool::new(false),
            cancel_sent: AtomicBool::new(false),
            terminal_seen: AtomicBool::new(false),
            max_tool_result_bytes: 1024,
        })
    }

    fn capture_channel() -> (Channel<Value>, Arc<Mutex<Vec<Value>>>) {
        let captured = Arc::new(Mutex::new(Vec::new()));
        let retained = captured.clone();
        let channel = Channel::new(move |body| {
            if let tauri::ipc::InvokeResponseBody::Json(text) = body {
                retained
                    .lock()
                    .expect("capture lock poisoned")
                    .push(serde_json::from_str(&text)?);
            }
            Ok(())
        });
        (channel, captured)
    }

    fn input() -> NativeAgentStartInput {
        NativeAgentStartInput {
            schema_version: 1,
            execution_id: "execution-1".to_owned(),
            run_id: "run-1".to_owned(),
            attempt_id: "attempt-1".to_owned(),
            stage: "negative".to_owned(),
            model: DEFAULT_MODEL.to_owned(),
            instructions: "Review synthetic material.".to_owned(),
            tools: vec![],
            text_schema: None,
            limits: NativeLimits {
                max_prompt_bytes: 1024,
                max_output_bytes: 2048,
                max_execution_ms: 10_000,
                max_tool_result_bytes: 1024,
            },
        }
    }

    #[test]
    fn builds_fixed_managed_session_request_without_a_credential() {
        let body = request_body(&input());
        assert_eq!(body["environment"]["type"], "none");
        assert_eq!(body["agent"]["model"], DEFAULT_MODEL);
        assert_eq!(body["stream"], true);
        assert!(body.get("api_key").is_none());
        assert!(body.get("url").is_none());
    }

    #[test]
    fn rejects_unknown_functions_and_stage_schema_mismatch() {
        let mut invalid = input();
        invalid.tools.push(ProviderToolDefinition {
            name: "filesystem_read".to_owned(),
            description: "no".to_owned(),
            input_schema: json!({"type":"object"}),
        });
        assert_eq!(
            validate_start(&invalid).unwrap_err().code,
            "unauthorized-tool"
        );
        let mut structured = input();
        structured.stage = "integrator".to_owned();
        assert_eq!(
            validate_start(&structured).unwrap_err().code,
            "invalid-text-schema"
        );
    }

    #[test]
    fn maps_remote_errors_without_response_bodies_or_secrets() {
        assert_eq!(
            map_status(StatusCode::UNAUTHORIZED).code,
            "openai-authentication"
        );
        assert_eq!(
            map_status(StatusCode::TOO_MANY_REQUESTS).code,
            "openai-rate-limit"
        );
        assert_eq!(map_status(StatusCode::BAD_GATEWAY).code, "openai-service");
        assert!(!map_status(StatusCode::BAD_REQUEST).message.contains("sk-"));
        assert_eq!(
            terminal_status("agent.session.turn.completed"),
            Some("completed")
        );
        assert_eq!(terminal_status("done"), None);
    }

    #[test]
    fn constructs_authorization_only_on_the_fixed_native_request() {
        let state = OpenAiAgentsState {
            api_key: Some(Arc::<str>::from("synthetic-secret")),
            client: Client::new(),
            active: Mutex::new(HashMap::new()),
        };
        let request = api_request(
            &state,
            reqwest::Method::POST,
            "/agents/sessions",
            Duration::from_secs(1),
        )
        .unwrap()
        .build()
        .unwrap();
        assert_eq!(
            request.url().as_str(),
            "https://api.openai.com/v1/agents/sessions"
        );
        assert_eq!(request.headers()["OpenAI-Beta"], BETA_HEADER);
        assert_eq!(
            request.headers()["Authorization"],
            "Bearer synthetic-secret"
        );
        assert!(!request_body(&input())
            .to_string()
            .contains("synthetic-secret"));
    }

    #[test]
    fn omits_absent_optional_event_fields_and_deduplicates_required_actions() {
        let active = active(&["compiler_search_index"]);
        let (channel, captured) = capture_channel();
        process_event(
            &json!({ "type": "agent.session.created", "session": { "id": "session-1" } }),
            &active,
            &channel,
            None,
            0,
            1,
        )
        .unwrap();
        let required = json!({
            "type": "agent.session.requires_action",
            "session": { "required_actions": [{
                "type": "function_call",
                "turn_id": "turn-1",
                "call_id": "call-1",
                "name": "compiler_search_index",
                "arguments": { "query": "synthetic", "limit": 1 }
            }] }
        });
        process_event(&required, &active, &channel, None, 0, 2).unwrap();
        process_event(&required, &active, &channel, None, 0, 3).unwrap();
        process_event(
            &json!({ "type": "agent.session.turn.completed", "turn": { "id": "turn-1" } }),
            &active,
            &channel,
            None,
            0,
            4,
        )
        .unwrap();
        let events = captured.lock().unwrap();
        assert_eq!(events.len(), 3);
        assert!(events[0].get("requestId").is_none());
        assert_eq!(events[1]["actions"].as_array().unwrap().len(), 1);
        assert!(events[2].get("usage").is_none());
        assert!(events[2].get("error").is_none());
        assert!(!events
            .iter()
            .any(|event| event.to_string().contains(":null")));
    }

    #[test]
    fn finds_lf_and_crlf_sse_frames_without_accepting_partial_frames() {
        assert_eq!(next_sse_frame(b"data: {}\n\nrest"), Some(10));
        assert_eq!(next_sse_frame(b"data: {}\r\n\r\nrest"), Some(12));
        assert_eq!(next_sse_frame(b"data: {}\r\n"), None);
    }

    #[tokio::test]
    #[ignore = "paid, opt-in live OpenAI Agents API smoke"]
    async fn live_openai_agents_smoke() {
        eprintln!("LIVE PAID OPENAI AGENTS SMOKE — synthetic material only; no vault access");
        let api_key = std::env::var("OPENAI_API_KEY")
            .expect("set OPENAI_API_KEY explicitly to run the paid live smoke");
        let client = Client::new();
        let mut session_ids = HashSet::new();
        for stage in ["Negative", "Positive", "Integrator"] {
            let response = client
                .post(format!("{API_ROOT}/agents/sessions"))
                .bearer_auth(&api_key)
                .header("OpenAI-Beta", BETA_HEADER)
                .json(&json!({
                    "agent": { "model": DEFAULT_MODEL, "tools": [] },
                    "environment": { "type": "none" },
                    "input": format!("Synthetic {stage} smoke test. Reply with one short sentence and do not use tools."),
                    "stream": false,
                }))
                .send()
                .await
                .expect("live OpenAI request failed");
            assert!(
                response.status().is_success(),
                "live OpenAI session creation returned {}",
                response.status()
            );
            let payload: Value = response.json().await.expect("live response was not JSON");
            let session_id = payload
                .get("id")
                .or_else(|| payload.get("session").and_then(|session| session.get("id")))
                .and_then(Value::as_str)
                .expect("live response omitted session ID");
            assert!(
                session_ids.insert(session_id.to_owned()),
                "each stage must receive a fresh managed session"
            );
            eprintln!("{stage} session: {session_id}");
        }
        assert_eq!(session_ids.len(), 3);
    }
}
