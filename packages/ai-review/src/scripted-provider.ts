import type {
  AgentExecution,
  AgentProvider,
  AgentRunRequest,
  IntegrationResultInput,
  JsonValue,
  PostCheckResultInput,
  ProviderEvent,
  ProviderTerminalStatus,
  ProviderToolResult,
  ProviderUsage,
  ReviewStage,
} from './types';

export class Deferred<T = void> {
  public readonly promise: Promise<T>;
  #resolve!: (value: T | PromiseLike<T>) => void;
  #reject!: (reason?: unknown) => void;

  public constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  public resolve(...args: T extends void ? [] : [value: T]): void {
    this.#resolve(args[0] as T);
  }

  public reject(reason?: unknown): void {
    this.#reject(reason);
  }
}

interface ScriptIdentityOverride {
  runId?: string;
  stage?: ReviewStage;
  attemptId?: string;
}

export type ScriptedStep =
  | {
      type: 'progress';
      message: string;
      eventId?: string;
      identity?: ScriptIdentityOverride;
    }
  | {
      type: 'text';
      text: string;
      eventId?: string;
      identity?: ScriptIdentityOverride;
    }
  | {
      type: 'tool';
      toolCallId: string;
      name: string;
      arguments: JsonValue;
      eventId?: string;
      identity?: ScriptIdentityOverride;
    }
  | {
      type: 'terminal';
      status: ProviderTerminalStatus;
      rawText: string;
      structured?:
        | JsonValue
        | IntegrationResultInput
        | PostCheckResultInput
        | ((
            request: AgentRunRequest,
          ) => JsonValue | IntegrationResultInput | PostCheckResultInput);
      usage?: ProviderUsage;
      error?: string;
      eventId?: string;
      identity?: ScriptIdentityOverride;
    }
  | { type: 'wait'; deferred: Deferred<void> }
  | { type: 'wait-for-cancellation' }
  | { type: 'end-stream' }
  | { type: 'fail-stream'; message: string };

export interface ScriptedContextRecord {
  contextId: string;
  runId: string;
  stage: ReviewStage;
  attemptId: string;
  toolResults: ProviderToolResult[];
  cancellationReasons: string[];
}

export class ScriptedAgentProvider implements AgentProvider {
  public readonly startedRequests: AgentRunRequest[] = [];
  public readonly contexts: ScriptedContextRecord[] = [];
  readonly #scripts: Partial<Record<ReviewStage, ScriptedStep[][]>>;

  public constructor(scripts: Partial<Record<ReviewStage, ScriptedStep[][]>>) {
    this.#scripts = Object.fromEntries(
      Object.entries(scripts).map(([stage, stageScripts]) => [
        stage,
        stageScripts.map((script) => [...script]),
      ]),
    );
  }

  public start(request: AgentRunRequest): AgentExecution {
    this.startedRequests.push(request);
    const context: ScriptedContextRecord = {
      contextId: request.contextId,
      runId: request.runId,
      stage: request.stage,
      attemptId: request.attemptId,
      toolResults: [],
      cancellationReasons: [],
    };
    this.contexts.push(context);
    const stageScripts = this.#scripts[request.stage];
    const script = stageScripts?.shift();
    if (!script) {
      throw new Error(`No scripted provider execution for ${request.stage}.`);
    }
    const toolWaiters = new Map<string, Deferred<ProviderToolResult>>();
    const cancelled = new Deferred<void>();
    let eventCounter = 0;
    const identity = (
      override: ScriptIdentityOverride | undefined,
      eventId: string | undefined,
    ) => ({
      runId: override?.runId ?? request.runId,
      stage: override?.stage ?? request.stage,
      attemptId: override?.attemptId ?? request.attemptId,
      eventId: eventId ?? `script-event-${++eventCounter}`,
    });

    const events = async function* (): AsyncIterable<ProviderEvent> {
      for (const step of script) {
        switch (step.type) {
          case 'wait':
            await step.deferred.promise;
            break;
          case 'wait-for-cancellation':
            await cancelled.promise;
            break;
          case 'end-stream':
            return;
          case 'fail-stream':
            throw new Error(step.message);
          case 'progress':
            yield {
              ...identity(step.identity, step.eventId),
              type: 'progress',
              message: step.message,
            };
            break;
          case 'text':
            yield {
              ...identity(step.identity, step.eventId),
              type: 'text-delta',
              text: step.text,
            };
            break;
          case 'tool': {
            const waiter = new Deferred<ProviderToolResult>();
            toolWaiters.set(step.toolCallId, waiter);
            yield {
              ...identity(step.identity, step.eventId),
              type: 'tool-call',
              toolCallId: step.toolCallId,
              name: step.name,
              arguments: step.arguments,
            };
            await waiter.promise;
            break;
          }
          case 'terminal':
            yield {
              ...identity(step.identity, step.eventId),
              type: 'terminal',
              status: step.status,
              rawText: step.rawText,
              ...(step.structured === undefined
                ? {}
                : {
                    structured: (typeof step.structured === 'function'
                      ? step.structured(request)
                      : step.structured) as JsonValue,
                  }),
              ...(step.usage === undefined ? {} : { usage: step.usage }),
              ...(step.error === undefined ? {} : { error: step.error }),
            };
            return;
        }
      }
      yield {
        ...identity(undefined, undefined),
        type: 'terminal',
        status: 'failed',
        rawText: '',
        error: 'Script ended without a terminal step.',
      };
    };

    return {
      events: events(),
      adapterMetadata: { scripted: true },
      submitToolResult: async (result) => {
        await Promise.resolve();
        context.toolResults.push(result);
        const waiter = toolWaiters.get(result.toolCallId);
        if (!waiter) {
          throw new Error(
            `Scripted provider received an unexpected result for ${result.toolCallId}.`,
          );
        }
        waiter.resolve(result);
      },
      cancel: async (reason) => {
        await Promise.resolve();
        context.cancellationReasons.push(reason);
        cancelled.resolve();
      },
    };
  }
}
