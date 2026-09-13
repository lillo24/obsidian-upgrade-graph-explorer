import type {
  AgentProvider,
  JsonValue,
  ProviderToolDefinition,
  ProviderUsage,
  ReviewModelConfiguration,
  ReviewResourceLimits,
  ReviewStage,
} from '@icarus-graph-explorer/ai-review';

export const OPENAI_AGENTS_PROVIDER_ID = 'openai-agents' as const;
export const OPENAI_AGENTS_DEFAULT_MODEL = 'gpt-6-astra' as const;
export const OPENAI_AGENTS_BETA_VERSION = 'agents=v1' as const;
export const OPENAI_AGENTS_NATIVE_SCHEMA_VERSION = 1 as const;

export interface OpenAiAgentsProviderAvailability {
  readonly supported: boolean;
  readonly ready: boolean;
  readonly provider: typeof OPENAI_AGENTS_PROVIDER_ID;
  readonly message: string;
  readonly defaultModel: string;
  readonly betaVersion: typeof OPENAI_AGENTS_BETA_VERSION;
}

export interface OpenAiAgentsProviderBootstrap {
  readonly provider: AgentProvider;
  readonly defaultModels: ReviewModelConfiguration;
  getAvailability(): Promise<OpenAiAgentsProviderAvailability>;
}

export type NativeTerminalStatus =
  'completed' | 'refused' | 'truncated' | 'failed' | 'cancelled';

export interface NativeAgentStartInput {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly executionId: string;
  readonly runId: string;
  readonly attemptId: string;
  readonly stage: ReviewStage;
  readonly model: string;
  readonly instructions: string;
  readonly tools: readonly ProviderToolDefinition[];
  readonly textSchema?: JsonValue;
  readonly limits: Pick<
    ReviewResourceLimits,
    | 'maxPromptBytes'
    | 'maxOutputBytes'
    | 'maxExecutionMs'
    | 'maxToolResultBytes'
  >;
}

export interface NativeToolResultInput {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly executionId: string;
  readonly toolCallId: string;
  readonly name: string;
  readonly output: JsonValue;
}

export interface NativeExecutionInput {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly executionId: string;
}

interface NativeEventBase {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly eventId: string;
}

export interface NativeSessionCreatedEvent extends NativeEventBase {
  readonly type: 'session-created';
  readonly sessionId: string;
  readonly model: string;
  readonly requestId?: string;
}

export interface NativeProgressEvent extends NativeEventBase {
  readonly type: 'progress';
  readonly message: string;
}

export interface NativeOutputTextDeltaEvent extends NativeEventBase {
  readonly type: 'output-text-delta';
  readonly turnId: string;
  readonly itemId: string;
  readonly outputIndex: number;
  readonly contentIndex: number;
  readonly delta: string;
}

export interface NativeOutputTextDoneEvent extends NativeEventBase {
  readonly type: 'output-text-done';
  readonly turnId: string;
  readonly itemId: string;
  readonly outputIndex: number;
  readonly contentIndex: number;
  readonly text: string;
}

export interface NativeRecoveredOutputEvent extends NativeEventBase {
  readonly type: 'recovered-output';
  readonly turnId: string;
  readonly text: string;
}

export interface NativeRequiredAction {
  readonly type: 'function-call';
  readonly toolCallId: string;
  readonly turnId: string;
  readonly name: string;
  readonly arguments: JsonValue;
}

export interface NativeRequiresActionEvent extends NativeEventBase {
  readonly type: 'requires-action';
  readonly actions: readonly NativeRequiredAction[];
}

export interface NativeTerminalEvent extends NativeEventBase {
  readonly type: 'terminal';
  readonly status: NativeTerminalStatus;
  readonly turnId?: string;
  readonly usage?: ProviderUsage;
  readonly error?: string;
  readonly recoveryCount: number;
}

export type NativeAgentEvent =
  | NativeSessionCreatedEvent
  | NativeProgressEvent
  | NativeOutputTextDeltaEvent
  | NativeOutputTextDoneEvent
  | NativeRecoveredOutputEvent
  | NativeRequiresActionEvent
  | NativeTerminalEvent;

export interface NativeStartSummary {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly executionId: string;
  readonly sessionId: string;
  readonly requestId?: string;
  readonly recoveryCount: number;
  readonly retention: 'retained';
}

export interface NativeCancellationResult {
  readonly schemaVersion: typeof OPENAI_AGENTS_NATIVE_SCHEMA_VERSION;
  readonly requested: true;
  readonly remoteRequestAccepted: boolean;
}

export interface OpenAiAgentsNativeBridge {
  isSupported(): boolean;
  availability(): Promise<OpenAiAgentsProviderAvailability>;
  start(
    input: NativeAgentStartInput,
    onEvent: (event: unknown) => void,
  ): Promise<NativeStartSummary>;
  submitToolResult(input: NativeToolResultInput): Promise<void>;
  cancel(input: NativeExecutionInput): Promise<NativeCancellationResult>;
}

export class OpenAiAgentsProviderError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'OpenAiAgentsProviderError';
  }
}

export function createOpenAiReviewModels(
  model = OPENAI_AGENTS_DEFAULT_MODEL,
): ReviewModelConfiguration {
  return {
    analysis: { provider: OPENAI_AGENTS_PROVIDER_ID, model },
    integrator: { provider: OPENAI_AGENTS_PROVIDER_ID, model },
    postCheck: { provider: OPENAI_AGENTS_PROVIDER_ID, model },
  };
}
