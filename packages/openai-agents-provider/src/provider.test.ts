import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_REVIEW_LIMITS,
  ReviewEngine,
  createSequentialIdGenerator,
  type AgentRunRequest,
  type ProviderEvent,
} from '@icarus-graph-explorer/ai-review';

import { createOpenAiAgentsProvider } from './provider';
import {
  OPENAI_AGENTS_BETA_VERSION,
  OPENAI_AGENTS_DEFAULT_MODEL,
  OPENAI_AGENTS_PROVIDER_ID,
  type NativeAgentStartInput,
  type OpenAiAgentsNativeBridge,
} from './types';

function request(
  stage: AgentRunRequest['stage'] = 'negative',
): AgentRunRequest {
  return {
    runId: 'run-1',
    stage,
    attemptId: `attempt-${stage}`,
    attemptNumber: 1,
    contextId: `context-${stage}`,
    instructions: 'Review only the synthetic retained material.',
    material: {
      workspaceId: 'workspace-1',
      source: {
        mode: 'supplied-material',
        selectedPaths: ['synthetic.md'],
        materials: [
          {
            id: 'material-1',
            relativePath: 'synthetic.md',
            kind: 'source',
            content: 'Synthetic material.',
            provenance: { kind: 'supplied', label: 'unit test' },
          },
        ],
        completeness: 'complete',
        missingMaterial: [],
        omissions: [],
      },
      additionalRequest: '',
      sharedMaterial: 'Synthetic material.',
      fingerprint: 'synthetic-fingerprint',
    },
    model: {
      provider: OPENAI_AGENTS_PROVIDER_ID,
      model: OPENAI_AGENTS_DEFAULT_MODEL,
    },
    tools: [],
    limits: DEFAULT_REVIEW_LIMITS,
    signal: new AbortController().signal,
  };
}

async function collect(events: AsyncIterable<ProviderEvent>) {
  const collected: ProviderEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function bridge(
  emit: (
    input: NativeAgentStartInput,
    onEvent: (event: unknown) => void,
  ) => void,
): OpenAiAgentsNativeBridge {
  return {
    isSupported: () => true,
    availability: async () => ({
      supported: true,
      ready: true,
      provider: OPENAI_AGENTS_PROVIDER_ID,
      message: 'ready',
      defaultModel: OPENAI_AGENTS_DEFAULT_MODEL,
      betaVersion: OPENAI_AGENTS_BETA_VERSION,
    }),
    start: async (input, onEvent) => {
      emit(input, onEvent);
      return {
        schemaVersion: 1,
        executionId: input.executionId,
        sessionId: 'session-1',
        requestId: 'request-1',
        recoveryCount: 0,
        retention: 'retained',
      };
    },
    submitToolResult: vi.fn(async () => undefined),
    cancel: vi.fn(async () => ({
      schemaVersion: 1 as const,
      requested: true as const,
      remoteRequestAccepted: true,
    })),
  };
}

describe('OpenAI Agents provider', () => {
  it('uses distinct sessions for concurrent branches and a third Integrator requested by REVIEW1', async () => {
    const sessions: Array<{ stage: string; sessionId: string }> = [];
    const native = bridge((input, emit) => {
      const sessionId = `session-${input.stage}`;
      sessions.push({ stage: input.stage, sessionId });
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: `${input.stage}-created`,
        sessionId,
        model: input.model,
      });
      const text =
        input.stage === 'integrator'
          ? JSON.stringify({
              markdown: 'Synthetic integrated review.',
              structured: {
                schemaVersion: 1,
                summary: 'Synthetic summary.',
                issues: [
                  {
                    id: 'issue-1',
                    relation: 'direct-disagreement',
                    negativeReferences: [{ attemptId: 'live-attempt-1' }],
                    positiveReferences: [{ attemptId: 'live-attempt-2' }],
                    integrationMarkdown: 'Synthetic integration.',
                    unresolvedPoints: [],
                    integratorNotes: [],
                  },
                ],
                unresolvedQuestions: [],
              },
            })
          : `Synthetic ${input.stage} analysis.`;
      emit({
        schemaVersion: 1,
        type: 'output-text-done',
        eventId: `${input.stage}-output`,
        turnId: `turn-${input.stage}`,
        itemId: `item-${input.stage}`,
        outputIndex: 0,
        contentIndex: 0,
        text,
      });
      emit({
        schemaVersion: 1,
        type: 'terminal',
        eventId: `${input.stage}-terminal`,
        status: 'completed',
        turnId: `turn-${input.stage}`,
        recoveryCount: 0,
      });
    });
    let executionNumber = 0;
    const provider = createOpenAiAgentsProvider({
      bridge: native,
      executionId: () => `execution-${++executionNumber}`,
    }).provider;
    const source = request().material.source;
    const run = await (
      await new ReviewEngine({
        provider,
        ids: createSequentialIdGenerator('live'),
      }).start({
        workspaceId: 'workspace-1',
        source,
        additionalRequest: 'Synthetic provider workflow.',
        models: {
          analysis: {
            provider: OPENAI_AGENTS_PROVIDER_ID,
            model: OPENAI_AGENTS_DEFAULT_MODEL,
          },
          integrator: {
            provider: OPENAI_AGENTS_PROVIDER_ID,
            model: OPENAI_AGENTS_DEFAULT_MODEL,
          },
          postCheck: {
            provider: OPENAI_AGENTS_PROVIDER_ID,
            model: OPENAI_AGENTS_DEFAULT_MODEL,
          },
        },
      })
    ).completion;
    expect(run.state).toBe('completed');
    expect(sessions.map(({ stage }) => stage)).toEqual([
      'negative',
      'positive',
      'integrator',
    ]);
    expect(new Set(sessions.map(({ sessionId }) => sessionId)).size).toBe(3);
  });

  it('is browser-safe and reports unsupported mode without invoking native code', async () => {
    const native = bridge(() => undefined);
    native.isSupported = () => false;
    const provider = createOpenAiAgentsProvider({ bridge: native });
    await expect(provider.getAvailability()).resolves.toMatchObject({
      supported: false,
      ready: false,
      provider: OPENAI_AGENTS_PROVIDER_ID,
    });
  });

  it('assembles text and retains safe remote identifiers only at terminal', async () => {
    const native = bridge((_input, emit) => {
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-1',
        model: OPENAI_AGENTS_DEFAULT_MODEL,
        requestId: 'request-1',
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-delta',
        eventId: 'e2',
        turnId: 'turn-1',
        itemId: 'item-1',
        outputIndex: 0,
        contentIndex: 0,
        delta: 'Synthetic ',
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-done',
        eventId: 'e3',
        turnId: 'turn-1',
        itemId: 'item-1',
        outputIndex: 0,
        contentIndex: 0,
        text: 'Synthetic analysis.',
      });
      emit({
        schemaVersion: 1,
        type: 'terminal',
        eventId: 'e4',
        status: 'completed',
        turnId: 'turn-1',
        recoveryCount: 0,
      });
    });
    const execution = createOpenAiAgentsProvider({
      bridge: native,
      executionId: () => 'execution-1',
    }).provider.start(request());
    const events = await collect(execution.events);
    expect(events.at(-1)).toMatchObject({
      type: 'terminal',
      rawText: 'Synthetic analysis.',
      adapterMetadata: {
        remoteSessionId: 'session-1',
        remoteRequestId: 'request-1',
        remoteTurnId: 'turn-1',
      },
    });
  });

  it('requests strict structured output and parses only the full envelope', async () => {
    let captured: NativeAgentStartInput | undefined;
    const envelope = JSON.stringify({
      markdown: '# Integration',
      structured: {
        schemaVersion: 1,
        summary: 'Synthetic summary',
        issues: [],
        unresolvedQuestions: [],
      },
    });
    const native = bridge((input, emit) => {
      captured = input;
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-1',
        model: input.model,
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-done',
        eventId: 'e2',
        turnId: 'turn-1',
        itemId: 'item-1',
        outputIndex: 0,
        contentIndex: 0,
        text: envelope,
      });
      emit({
        schemaVersion: 1,
        type: 'terminal',
        eventId: 'e3',
        status: 'completed',
        turnId: 'turn-1',
        recoveryCount: 0,
      });
    });
    const execution = createOpenAiAgentsProvider({
      bridge: native,
      executionId: () => 'execution-1',
    }).provider.start(request('integrator'));
    const events = await collect(execution.events);
    expect(captured?.textSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['markdown', 'structured'],
    });
    expect(events.at(-1)).toMatchObject({
      type: 'terminal',
      rawText: '# Integration',
      structured: { schemaVersion: 1, summary: 'Synthetic summary' },
    });
  });

  it('fails malformed structured output without a prose fallback', async () => {
    const native = bridge((input, emit) => {
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-1',
        model: input.model,
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-done',
        eventId: 'e2',
        turnId: 'turn-1',
        itemId: 'item-1',
        outputIndex: 0,
        contentIndex: 0,
        text: '# Markdown with a {JSON-looking} fragment',
      });
      emit({
        schemaVersion: 1,
        type: 'terminal',
        eventId: 'e3',
        status: 'completed',
        recoveryCount: 0,
      });
    });
    const execution = createOpenAiAgentsProvider({
      bridge: native,
      executionId: () => 'execution-1',
    }).provider.start(request('integrator'));
    expect((await collect(execution.events)).at(-1)).toMatchObject({
      type: 'terminal',
      status: 'failed',
      error: 'OpenAI returned an invalid JSON structured response envelope.',
    });
  });

  it('does not treat stream EOF as success and appends continuation after recovered output', async () => {
    const ended = bridge((input, emit) => {
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-ended',
        model: input.model,
      });
    });
    const endedExecution = createOpenAiAgentsProvider({
      bridge: ended,
      executionId: () => 'execution-ended',
    }).provider.start(request());
    expect((await collect(endedExecution.events)).at(-1)).toMatchObject({
      type: 'terminal',
      status: 'failed',
      error: 'OpenAI session ended without an explicit terminal turn event.',
    });

    const recovered = bridge((input, emit) => {
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-recovered',
        model: input.model,
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-delta',
        eventId: 'e2',
        turnId: 'turn-1',
        itemId: 'item-1',
        outputIndex: 0,
        contentIndex: 0,
        delta: 'discarded partial',
      });
      emit({
        schemaVersion: 1,
        type: 'recovered-output',
        eventId: 'e3',
        turnId: 'turn-1',
        text: 'Recovered',
      });
      emit({
        schemaVersion: 1,
        type: 'output-text-delta',
        eventId: 'e4',
        turnId: 'turn-1',
        itemId: 'item-2',
        outputIndex: 1,
        contentIndex: 0,
        delta: ' continuation',
      });
      emit({
        schemaVersion: 1,
        type: 'terminal',
        eventId: 'e5',
        status: 'completed',
        recoveryCount: 1,
      });
    });
    const recoveredExecution = createOpenAiAgentsProvider({
      bridge: recovered,
      executionId: () => 'execution-recovered',
    }).provider.start(request());
    expect((await collect(recoveredExecution.events)).at(-1)).toMatchObject({
      type: 'terminal',
      rawText: 'Recovered continuation',
    });
  });

  it('correlates declared tool calls and forwards the exact compiler envelope', async () => {
    const native = bridge((_input, emit) => {
      emit({
        schemaVersion: 1,
        type: 'session-created',
        eventId: 'e1',
        sessionId: 'session-1',
        model: OPENAI_AGENTS_DEFAULT_MODEL,
      });
      emit({
        schemaVersion: 1,
        type: 'requires-action',
        eventId: 'e2',
        actions: [
          {
            type: 'function-call',
            toolCallId: 'call-1',
            turnId: 'turn-1',
            name: 'compiler_list_index',
            arguments: { limit: 1 },
          },
        ],
      });
    });
    const configured = request();
    configured.tools = [
      {
        name: 'compiler_list_index',
        description: 'List',
        inputSchema: { type: 'object' },
      },
    ];
    const execution = createOpenAiAgentsProvider({
      bridge: native,
      executionId: () => 'execution-1',
    }).provider.start(configured);
    const iterator = execution.events[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.next();
    const call = await iterator.next();
    expect(call.value).toMatchObject({
      type: 'tool-call',
      toolCallId: 'call-1',
    });
    await execution.submitToolResult({
      toolCallId: 'call-1',
      name: 'compiler_list_index',
      result: {
        protocolVersion: 1,
        snapshotId: 'snapshot-1',
        snapshotRevision: 'revision-1',
        status: 'not-found',
        references: [],
        completeness: 'not-applicable',
        omissions: [],
        freshness: 'retained',
      },
    });
    expect(native.submitToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        name: 'compiler_list_index',
        output: expect.objectContaining({ status: 'not-found' }),
      }),
    );
    await execution.cancel('test cleanup');
  });
});
