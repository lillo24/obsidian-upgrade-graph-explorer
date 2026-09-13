import {
  assertPlainData,
  type JsonValue,
} from '@icarus-graph-explorer/ai-review';

import {
  OPENAI_AGENTS_BETA_VERSION,
  OPENAI_AGENTS_DEFAULT_MODEL,
  OPENAI_AGENTS_NATIVE_SCHEMA_VERSION,
  OPENAI_AGENTS_PROVIDER_ID,
  OpenAiAgentsProviderError,
  type NativeAgentEvent,
  type NativeStartSummary,
  type OpenAiAgentsProviderAvailability,
} from './types';

function invalid(message: string): never {
  throw new OpenAiAgentsProviderError('incompatible-native-schema', message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function string(value: unknown, label: string, empty = false): string {
  if (typeof value !== 'string' || (!empty && value.length === 0)) {
    invalid(`${label} must be ${empty ? 'a string' : 'a non-empty string'}.`);
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    invalid(`${label} must be a non-negative safe integer.`);
  }
  return value as number;
}

function schema(value: Record<string, unknown>): void {
  if (value.schemaVersion !== OPENAI_AGENTS_NATIVE_SCHEMA_VERSION) {
    invalid('Native OpenAI Agents schema version is incompatible.');
  }
}

function json(value: unknown, label: string): JsonValue {
  try {
    assertPlainData(value, label);
  } catch (error) {
    invalid(error instanceof Error ? error.message : String(error));
  }
  return value as JsonValue;
}

export function validateAvailability(
  value: unknown,
): OpenAiAgentsProviderAvailability {
  if (!record(value)) invalid('Native provider availability is invalid.');
  if (
    typeof value.supported !== 'boolean' ||
    typeof value.ready !== 'boolean' ||
    value.provider !== OPENAI_AGENTS_PROVIDER_ID ||
    value.betaVersion !== OPENAI_AGENTS_BETA_VERSION
  ) {
    invalid('Native provider availability fields are incompatible.');
  }
  return {
    supported: value.supported,
    ready: value.ready,
    provider: OPENAI_AGENTS_PROVIDER_ID,
    message: string(value.message, 'Availability message'),
    defaultModel: string(
      value.defaultModel ?? OPENAI_AGENTS_DEFAULT_MODEL,
      'Default model',
    ),
    betaVersion: OPENAI_AGENTS_BETA_VERSION,
  };
}

export function validateStartSummary(value: unknown): NativeStartSummary {
  if (!record(value)) invalid('Native start summary is invalid.');
  schema(value);
  if (value.retention !== 'retained') {
    invalid('Native session retention policy is incompatible.');
  }
  return {
    schemaVersion: 1,
    executionId: string(value.executionId, 'Execution ID'),
    sessionId: string(value.sessionId, 'Session ID'),
    ...(value.requestId === undefined
      ? {}
      : { requestId: string(value.requestId, 'Request ID') }),
    recoveryCount: integer(value.recoveryCount, 'Recovery count'),
    retention: 'retained',
  };
}

export function validateNativeEvent(value: unknown): NativeAgentEvent {
  if (!record(value)) invalid('Native OpenAI Agents event is invalid.');
  schema(value);
  const eventId = string(value.eventId, 'Event ID');
  switch (value.type) {
    case 'session-created':
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        sessionId: string(value.sessionId, 'Session ID'),
        model: string(value.model, 'Model'),
        ...(value.requestId === undefined
          ? {}
          : { requestId: string(value.requestId, 'Request ID') }),
      };
    case 'progress':
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        message: string(value.message, 'Progress message'),
      };
    case 'output-text-delta': {
      const base = {
        schemaVersion: 1 as const,
        type: value.type,
        eventId,
        turnId: string(value.turnId, 'Turn ID'),
        itemId: string(value.itemId, 'Item ID'),
        outputIndex: integer(value.outputIndex, 'Output index'),
        contentIndex: integer(value.contentIndex, 'Content index'),
      };
      return {
        ...base,
        type: value.type,
        delta: string(value.delta, 'Output delta', true),
      };
    }
    case 'output-text-done': {
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        turnId: string(value.turnId, 'Turn ID'),
        itemId: string(value.itemId, 'Item ID'),
        outputIndex: integer(value.outputIndex, 'Output index'),
        contentIndex: integer(value.contentIndex, 'Content index'),
        text: string(value.text, 'Completed output text', true),
      };
    }
    case 'recovered-output':
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        turnId: string(value.turnId, 'Turn ID'),
        text: string(value.text, 'Recovered output', true),
      };
    case 'requires-action': {
      if (!Array.isArray(value.actions)) {
        invalid('Required actions must be an array.');
      }
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        actions: value.actions.map((action, index) => {
          if (!record(action) || action.type !== 'function-call') {
            invalid(`Required action ${index} is not a function call.`);
          }
          return {
            type: 'function-call',
            toolCallId: string(action.toolCallId, 'Tool call ID'),
            turnId: string(action.turnId, 'Tool turn ID'),
            name: string(action.name, 'Tool name'),
            arguments: json(action.arguments, 'Tool arguments'),
          };
        }),
      };
    }
    case 'terminal': {
      const status = value.status;
      if (
        status !== 'completed' &&
        status !== 'refused' &&
        status !== 'truncated' &&
        status !== 'failed' &&
        status !== 'cancelled'
      ) {
        invalid('Native terminal status is invalid.');
      }
      let usage;
      if (value.usage !== undefined) {
        if (!record(value.usage)) invalid('Native usage is invalid.');
        usage = {
          ...(value.usage.inputTokens === undefined
            ? {}
            : {
                inputTokens: integer(value.usage.inputTokens, 'Input tokens'),
              }),
          ...(value.usage.outputTokens === undefined
            ? {}
            : {
                outputTokens: integer(
                  value.usage.outputTokens,
                  'Output tokens',
                ),
              }),
          ...(value.usage.totalTokens === undefined
            ? {}
            : {
                totalTokens: integer(value.usage.totalTokens, 'Total tokens'),
              }),
        };
      }
      return {
        schemaVersion: 1,
        type: value.type,
        eventId,
        status,
        ...(value.turnId === undefined
          ? {}
          : { turnId: string(value.turnId, 'Terminal turn ID') }),
        ...(usage === undefined ? {} : { usage }),
        ...(value.error === undefined
          ? {}
          : { error: string(value.error, 'Terminal error') }),
        recoveryCount: integer(value.recoveryCount, 'Recovery count'),
      };
    }
    default:
      return invalid(
        `Unknown native OpenAI Agents event type ${String(value.type)}.`,
      );
  }
}
