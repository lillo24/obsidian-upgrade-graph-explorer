import { Channel, invoke, isTauri } from '@tauri-apps/api/core';

import {
  OPENAI_AGENTS_BETA_VERSION,
  OPENAI_AGENTS_DEFAULT_MODEL,
  OPENAI_AGENTS_PROVIDER_ID,
  OpenAiAgentsProviderError,
  type NativeCancellationResult,
  type NativeExecutionInput,
  type NativeStartSummary,
  type NativeToolResultInput,
  type OpenAiAgentsNativeBridge,
  type OpenAiAgentsProviderAvailability,
} from './types';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nativeFailure(error: unknown): OpenAiAgentsProviderError {
  if (
    record(error) &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  ) {
    return new OpenAiAgentsProviderError(error.code, error.message, {
      cause: error,
    });
  }
  return new OpenAiAgentsProviderError(
    'native-failure',
    'The desktop OpenAI Agents command failed without a valid safe error envelope.',
    { cause: error },
  );
}

async function call<T>(
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error: unknown) {
    throw nativeFailure(error);
  }
}

const BROWSER_AVAILABILITY: OpenAiAgentsProviderAvailability = {
  supported: false,
  ready: false,
  provider: OPENAI_AGENTS_PROVIDER_ID,
  message:
    'OpenAI live review is available only in the desktop app. Browser mode can prepare and read reviews without a credential.',
  defaultModel: OPENAI_AGENTS_DEFAULT_MODEL,
  betaVersion: OPENAI_AGENTS_BETA_VERSION,
};

/** Narrow invoke/channel bridge. It exposes no credential or arbitrary URL. */
export function createTauriOpenAiAgentsBridge(): OpenAiAgentsNativeBridge {
  return {
    isSupported: isTauri,
    availability: () =>
      isTauri()
        ? call('openai_agents_availability', {})
        : Promise.resolve(BROWSER_AVAILABILITY),
    start: (input, onEvent) => {
      if (!isTauri()) {
        return Promise.reject(
          new OpenAiAgentsProviderError(
            'unsupported-runtime',
            BROWSER_AVAILABILITY.message,
          ),
        );
      }
      const onEventChannel = new Channel<unknown>();
      onEventChannel.onmessage = onEvent;
      return call<NativeStartSummary>('start_openai_agent', {
        input,
        onEvent: onEventChannel,
      });
    },
    submitToolResult: (input: NativeToolResultInput) =>
      call<void>('submit_openai_agent_tool_result', { input }),
    cancel: (input: NativeExecutionInput) =>
      call<NativeCancellationResult>('cancel_openai_agent', { input }),
  };
}
