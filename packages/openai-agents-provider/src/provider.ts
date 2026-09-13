import {
  assertPlainData,
  utf8Bytes,
  type AgentExecution,
  type AgentProvider,
  type AgentRunRequest,
  type JsonValue,
  type ProviderEvent,
  type ProviderTerminalEvent,
  type ProviderToolResult,
} from '@icarus-graph-explorer/ai-review';

import { createTauriOpenAiAgentsBridge } from './bridge';
import { structuredTextSchema } from './schemas';
import {
  OPENAI_AGENTS_BETA_VERSION,
  OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
  OPENAI_AGENTS_PROVIDER_ID,
  OpenAiAgentsProviderError,
  createOpenAiReviewModels,
  type NativeAgentEvent,
  type OpenAiAgentsNativeBridge,
  type OpenAiAgentsProviderBootstrap,
} from './types';
import {
  validateAvailability,
  validateNativeEvent,
  validateStartSummary,
} from './validation';

const MAX_QUEUED_EVENTS = 4_096;

class EventQueue implements AsyncIterable<ProviderEvent> {
  readonly #values: ProviderEvent[] = [];
  readonly #waiters: Array<{
    resolve: (value: IteratorResult<ProviderEvent>) => void;
    reject: (reason: unknown) => void;
  }> = [];
  #closed = false;
  #error: unknown;

  push(value: ProviderEvent): void {
    if (this.#closed) return;
    const waiter = this.#waiters.shift();
    if (waiter !== undefined) {
      waiter.resolve({ value, done: false });
      return;
    }
    const previous = this.#values.at(-1);
    if (
      value.type === 'text-delta' &&
      previous?.type === 'text-delta' &&
      utf8Bytes(previous.text) + utf8Bytes(value.text) <= 8_192
    ) {
      this.#values[this.#values.length - 1] = {
        ...previous,
        eventId: value.eventId,
        text: previous.text + value.text,
      };
      return;
    }
    if (this.#values.length >= MAX_QUEUED_EVENTS) {
      this.fail(
        new OpenAiAgentsProviderError(
          'event-queue-limit',
          `OpenAI provider event queue exceeded ${MAX_QUEUED_EVENTS} entries.`,
        ),
      );
      return;
    }
    this.#values.push(value);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#waiters
      .splice(0)
      .forEach(({ resolve }) => resolve({ value: undefined, done: true }));
  }

  fail(error: unknown): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#error = error;
    this.#waiters.splice(0).forEach(({ reject }) => reject(error));
  }

  [Symbol.asyncIterator](): AsyncIterator<ProviderEvent> {
    return {
      next: () => {
        const value = this.#values.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.#error !== undefined) return Promise.reject(this.#error);
        if (this.#closed)
          return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve, reject) => {
          this.#waiters.push({ resolve, reject });
        });
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}

function partKey(event: {
  readonly outputIndex: number;
  readonly contentIndex: number;
}): string {
  return `${event.outputIndex}:${event.contentIndex}`;
}

function parseEnvelope(raw: string): {
  markdown: string;
  structured: JsonValue;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    assertPlainData(parsed, 'OpenAI structured response envelope');
  } catch (error) {
    throw new OpenAiAgentsProviderError(
      'malformed-structured-envelope',
      'OpenAI returned an invalid JSON structured response envelope.',
      { cause: error },
    );
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof (parsed as Record<string, unknown>).markdown !== 'string' ||
    !('structured' in parsed)
  ) {
    throw new OpenAiAgentsProviderError(
      'malformed-structured-envelope',
      'OpenAI structured response must contain Markdown and structured fields.',
    );
  }
  return {
    markdown: (parsed as Record<string, unknown>).markdown as string,
    structured: (parsed as Record<string, unknown>).structured as JsonValue,
  };
}

function validateModel(request: AgentRunRequest): void {
  if (request.model.provider !== OPENAI_AGENTS_PROVIDER_ID) {
    throw new OpenAiAgentsProviderError(
      'provider-mismatch',
      `Expected provider ${OPENAI_AGENTS_PROVIDER_ID}, received ${request.model.provider || 'an empty provider'}.`,
    );
  }
  if (request.model.model.trim().length === 0) {
    throw new OpenAiAgentsProviderError(
      'model-required',
      'Choose an OpenAI model before starting live review.',
    );
  }
  if (
    request.model.temperature !== undefined ||
    request.model.maxOutputTokens !== undefined ||
    (request.model.metadata !== undefined &&
      Object.keys(request.model.metadata).length > 0)
  ) {
    throw new OpenAiAgentsProviderError(
      'unsupported-model-settings',
      'REVIEW4 supports only the explicit OpenAI model field; remove unsupported tuning settings.',
    );
  }
}

function execution(
  bridge: OpenAiAgentsNativeBridge,
  request: AgentRunRequest,
  executionId: string,
): AgentExecution {
  validateModel(request);
  const queue = new EventQueue();
  const parts = new Map<
    string,
    {
      readonly outputIndex: number;
      readonly contentIndex: number;
      text: string;
    }
  >();
  const allowedTools = new Map(request.tools.map((tool) => [tool.name, tool]));
  const pendingTools = new Map<
    string,
    { readonly name: string; readonly signature: string }
  >();
  let sessionId: string | undefined;
  let requestId: string | undefined;
  let terminalSeen = false;
  let recoveredOutput: string | undefined;

  const output = (): string =>
    (recoveredOutput ?? '') +
    [...parts.values()]
      .sort(
        (left, right) =>
          left.outputIndex - right.outputIndex ||
          left.contentIndex - right.contentIndex,
      )
      .map(({ text }) => text)
      .join('');

  const ensureOutputBound = (): void => {
    if (utf8Bytes(output()) > request.limits.maxOutputBytes) {
      throw new OpenAiAgentsProviderError(
        'output-byte-limit',
        `OpenAI output exceeded maxOutputBytes (${request.limits.maxOutputBytes}).`,
      );
    }
  };

  const base = (event: NativeAgentEvent) => ({
    runId: request.runId,
    stage: request.stage,
    attemptId: request.attemptId,
    eventId: event.eventId,
  });

  const terminal = (event: Extract<NativeAgentEvent, { type: 'terminal' }>) => {
    const raw = output();
    let rawText = raw;
    let structured: JsonValue | undefined;
    if (
      event.status === 'completed' &&
      (request.stage === 'integrator' || request.stage === 'post-check')
    ) {
      const envelope = parseEnvelope(raw);
      rawText = envelope.markdown;
      structured = envelope.structured;
    }
    const providerEvent: ProviderTerminalEvent = {
      ...base(event),
      type: 'terminal',
      status: event.status,
      rawText,
      ...(structured === undefined ? {} : { structured }),
      ...(event.usage === undefined ? {} : { usage: event.usage }),
      ...(event.error === undefined ? {} : { error: event.error }),
      adapterMetadata: {
        provider: OPENAI_AGENTS_PROVIDER_ID,
        betaVersion: OPENAI_AGENTS_BETA_VERSION,
        model: request.model.model,
        ...(sessionId === undefined ? {} : { remoteSessionId: sessionId }),
        ...(event.turnId === undefined ? {} : { remoteTurnId: event.turnId }),
        ...(requestId === undefined ? {} : { remoteRequestId: requestId }),
        recoveryCount: event.recoveryCount,
        retentionPolicy: 'retained-for-recovery-and-user-managed-deletion',
      },
    };
    terminalSeen = true;
    queue.push(providerEvent);
    queue.close();
  };

  const failWithTerminal = (error: unknown, eventId: string): void => {
    if (terminalSeen) return;
    if (sessionId === undefined) {
      queue.fail(error);
      return;
    }
    terminal({
      schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
      type: 'terminal',
      eventId,
      status: 'failed',
      error:
        error instanceof Error
          ? error.message
          : 'OpenAI provider failed without a safe error message.',
      recoveryCount: 0,
    });
  };

  const onEvent = (rawEvent: unknown): void => {
    if (terminalSeen) return;
    try {
      const event = validateNativeEvent(rawEvent);
      switch (event.type) {
        case 'session-created':
          sessionId = event.sessionId;
          requestId = event.requestId;
          queue.push({
            ...base(event),
            type: 'progress',
            message: 'Agent running…',
          });
          return;
        case 'progress':
          queue.push({
            ...base(event),
            type: 'progress',
            message: event.message,
          });
          return;
        case 'output-text-delta': {
          const key = partKey(event);
          const part = parts.get(key) ?? {
            outputIndex: event.outputIndex,
            contentIndex: event.contentIndex,
            text: '',
          };
          part.text += event.delta;
          parts.set(key, part);
          ensureOutputBound();
          queue.push({ ...base(event), type: 'text-delta', text: event.delta });
          return;
        }
        case 'output-text-done':
          parts.set(partKey(event), {
            outputIndex: event.outputIndex,
            contentIndex: event.contentIndex,
            text: event.text,
          });
          ensureOutputBound();
          return;
        case 'recovered-output':
          recoveredOutput = event.text;
          parts.clear();
          ensureOutputBound();
          queue.push({
            ...base(event),
            type: 'progress',
            message:
              'Recovered saved OpenAI session output after a stream interruption.',
          });
          return;
        case 'requires-action':
          for (const action of event.actions) {
            const allowed = allowedTools.get(
              action.name as Parameters<typeof allowedTools.get>[0],
            );
            if (allowed === undefined) {
              throw new OpenAiAgentsProviderError(
                'unauthorized-tool-call',
                `OpenAI requested undeclared function ${action.name}.`,
              );
            }
            const known = pendingTools.get(action.toolCallId);
            const signature = JSON.stringify({
              name: action.name,
              arguments: action.arguments,
            });
            if (known !== undefined) {
              if (known.signature !== signature) {
                throw new OpenAiAgentsProviderError(
                  'conflicting-tool-call',
                  `OpenAI reused tool call ${action.toolCallId} with different input.`,
                );
              }
              continue;
            }
            pendingTools.set(action.toolCallId, {
              name: action.name,
              signature,
            });
            queue.push({
              ...base(event),
              eventId: `${event.eventId}:${action.toolCallId}`,
              type: 'tool-call',
              toolCallId: action.toolCallId,
              name: action.name,
              arguments: action.arguments,
            });
          }
          return;
        case 'terminal':
          terminal(event);
      }
    } catch (error) {
      failWithTerminal(error, `${executionId}:adapter-failure`);
      void bridge.cancel({
        schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
        executionId,
      });
    }
  };

  queue.push({
    runId: request.runId,
    stage: request.stage,
    attemptId: request.attemptId,
    eventId: `${executionId}:connecting`,
    type: 'progress',
    message: 'Connecting to OpenAI…',
  });

  const textSchema = structuredTextSchema(request.stage);
  void bridge
    .start(
      {
        schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
        executionId,
        runId: request.runId,
        attemptId: request.attemptId,
        stage: request.stage,
        model: request.model.model,
        instructions: request.instructions,
        tools: request.tools,
        ...(textSchema === undefined ? {} : { textSchema }),
        limits: {
          maxPromptBytes: request.limits.maxPromptBytes,
          maxOutputBytes: request.limits.maxOutputBytes,
          maxExecutionMs: request.limits.maxExecutionMs,
          maxToolResultBytes: request.limits.maxToolResultBytes,
        },
      },
      onEvent,
    )
    .then((summary) => {
      const validated = validateStartSummary(summary);
      if (validated.executionId !== executionId) {
        throw new OpenAiAgentsProviderError(
          'execution-mismatch',
          'Native OpenAI Agents command completed for a different execution.',
        );
      }
      if (!terminalSeen) {
        throw new OpenAiAgentsProviderError(
          'unexpected-stream-end',
          'OpenAI session ended without an explicit terminal turn event.',
        );
      }
    })
    .catch((error: unknown) =>
      failWithTerminal(error, `${executionId}:native-failure`),
    );

  const abort = () => {
    void bridge.cancel({
      schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
      executionId,
    });
  };
  request.signal.addEventListener('abort', abort, { once: true });

  return {
    events: queue,
    async submitToolResult(result: ProviderToolResult) {
      const pending = pendingTools.get(result.toolCallId);
      if (pending === undefined || pending.name !== result.name) {
        throw new OpenAiAgentsProviderError(
          'unknown-tool-result',
          `No pending OpenAI function call matches ${result.toolCallId}.`,
        );
      }
      await bridge.submitToolResult({
        schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
        executionId,
        toolCallId: result.toolCallId,
        name: result.name,
        output: result.result as unknown as JsonValue,
      });
    },
    async cancel() {
      await bridge.cancel({
        schemaVersion: OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
        executionId,
      });
    },
    adapterMetadata: {
      provider: OPENAI_AGENTS_PROVIDER_ID,
      betaVersion: OPENAI_AGENTS_BETA_VERSION,
      model: request.model.model,
      retentionPolicy: 'retained-for-recovery-and-user-managed-deletion',
    },
  };
}

export interface CreateOpenAiAgentsProviderOptions {
  readonly bridge?: OpenAiAgentsNativeBridge;
  readonly executionId?: () => string;
}

function secureExecutionId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new OpenAiAgentsProviderError(
      'unsupported-runtime',
      'Secure OpenAI execution identity generation is unavailable.',
    );
  }
  return globalThis.crypto.randomUUID();
}

export function createOpenAiAgentsProvider(
  options: CreateOpenAiAgentsProviderOptions = {},
): OpenAiAgentsProviderBootstrap {
  const bridge = options.bridge ?? createTauriOpenAiAgentsBridge();
  const executionId = options.executionId ?? secureExecutionId;
  const provider: AgentProvider = {
    start: (request) => execution(bridge, request, executionId()),
  };
  return {
    provider,
    defaultModels: createOpenAiReviewModels(),
    async getAvailability() {
      if (!bridge.isSupported()) {
        return {
          supported: false,
          ready: false,
          provider: OPENAI_AGENTS_PROVIDER_ID,
          message:
            'OpenAI live review is available only in the desktop app. Browser mode can prepare and read reviews without a credential.',
          defaultModel: createOpenAiReviewModels().analysis.model,
          betaVersion: OPENAI_AGENTS_BETA_VERSION,
        };
      }
      return validateAvailability(await bridge.availability());
    },
  };
}
