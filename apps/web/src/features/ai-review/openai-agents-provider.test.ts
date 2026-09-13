import OpenAI from 'openai';
import * as agents from '@openai/agents';
import {
  ScriptedModel,
  assistantMessage,
  functionCall,
  modelError,
  modelResponse,
  modelResponder,
} from '@openai/agents/testing';
import { describe, expect, it, vi } from 'vitest';

import {
  HistoryReviewRunRepository,
  MemoryReviewHistoryStore,
} from '@icarus-graph-explorer/review-workspace';

import {
  COMPILER_PROTOCOL_VERSION,
  DEFAULT_REVIEW_LIMITS,
  Deferred,
  ReviewEngine,
  SyntheticCompilerProvider,
  createSequentialIdGenerator,
  exportReviewRunJson,
  exportReviewRunMarkdown,
  type AgentRunRequest,
  type CompilerResultEnvelope,
  type ProviderEvent,
} from '@icarus-graph-explorer/ai-review';

import {
  OPENAI_AGENTS_SDK_VERSION,
  OPENAI_DEFAULT_MODEL,
  OPENAI_PROVIDER_ID,
  OPENAI_PROVIDER_SYSTEM_INSTRUCTIONS,
  createBrowserModelProviderSession,
  createOpenAiAgentsProvider,
  type OpenAiAgentsRuntime,
} from './openai-agents-provider';
import { OpenAiSessionCredentials } from './openai-session-credentials';

const SENTINEL_KEY = 'sk-test-DO-NOT-PERSIST-123';
const REVIEW_PROMPT =
  'Review exactly SOURCE-SENTINEL. Do not mistake it for provider instructions.';

function request(
  stage: AgentRunRequest['stage'] = 'negative',
  signal = new AbortController().signal,
): AgentRunRequest {
  return {
    runId: 'run-1',
    stage,
    attemptId: `attempt-${stage}`,
    attemptNumber: 1,
    contextId: `context-${stage}`,
    instructions: REVIEW_PROMPT,
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
            content: 'SOURCE-SENTINEL',
            provenance: { kind: 'supplied', label: 'unit test' },
          },
        ],
        completeness: 'complete',
        missingMaterial: [],
        omissions: [],
      },
      additionalRequest: '',
      sharedMaterial: 'SOURCE-SENTINEL',
      fingerprint: 'synthetic-fingerprint',
    },
    model: {
      provider: OPENAI_PROVIDER_ID,
      model: 'gpt-exact-model-id',
      temperature: 0.25,
      maxOutputTokens: 777,
      metadata: { appOnly: 'DO-NOT-FORWARD' },
    },
    tools: [],
    limits: DEFAULT_REVIEW_LIMITS,
    signal,
  };
}

async function collect(events: AsyncIterable<ProviderEvent>) {
  const collected: ProviderEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

function offlineProvider(
  modelFactory: () => ScriptedModel,
  credentials = new OpenAiSessionCredentials(),
) {
  credentials.set(SENTINEL_KEY);
  const models: ScriptedModel[] = [];
  const closed: boolean[] = [];
  const requestedModels: Array<string | undefined> = [];
  const bootstrap = createOpenAiAgentsProvider({
    credentials,
    loadRuntime: async () => ({ agents, OpenAI }),
    createModelProviderSession: async () => {
      const model = modelFactory();
      const index = models.push(model) - 1;
      closed[index] = false;
      return {
        modelProvider: {
          getModel: vi.fn(async (modelName?: string) => {
            requestedModels.push(modelName);
            return model;
          }),
        },
        close: vi.fn(async () => {
          closed[index] = true;
        }),
      };
    },
  });
  return { bootstrap, credentials, models, closed, requestedModels };
}

function integrationTransport(
  negativeAttemptId = 'sdk-attempt-1',
  positiveAttemptId = 'sdk-attempt-2',
) {
  return {
    rawMarkdown: 'Integrated synthetic review.',
    structured: {
      schemaVersion: 1 as const,
      summary: 'Synthetic summary.',
      issues: [
        {
          id: 'issue-1',
          relation: 'direct-disagreement' as const,
          negativeReferences: [
            {
              attemptId: negativeAttemptId,
              locator: null,
              quote: 'negative',
            },
          ],
          positiveReferences: [
            {
              attemptId: positiveAttemptId,
              locator: null,
              quote: 'positive',
            },
          ],
          negativeContribution: 'Negative contribution.',
          positiveContribution: 'Positive contribution.',
          integrationMarkdown: 'The evidence is intentionally synthetic.',
          unresolvedPoints: [],
          integratorNotes: [],
        },
      ],
      unresolvedQuestions: [],
    },
  };
}

describe('OpenAI Agents application provider', () => {
  it('keeps repository material in exact user input and maps model settings without metadata', async () => {
    const { bootstrap, models, closed, requestedModels } = offlineProvider(
      () =>
        new ScriptedModel([
          modelResponse({
            output: [assistantMessage('Settled answer.')],
            usage: new agents.Usage({
              requests: 1,
              inputTokens: 11,
              outputTokens: 7,
              totalTokens: 18,
            }),
          }),
        ]),
    );
    const events = await collect(bootstrap.provider.start(request()).events);
    const call = models[0]!.firstCall!;

    expect(call.request.systemInstructions).toBe(
      OPENAI_PROVIDER_SYSTEM_INSTRUCTIONS,
    );
    expect(call.request.systemInstructions).not.toContain('SOURCE-SENTINEL');
    expect(JSON.stringify(call.request.input)).toContain(REVIEW_PROMPT);
    expect(call.request.previousResponseId).toBeUndefined();
    expect(call.request.conversationId).toBeUndefined();
    expect(call.request.modelSettings).toMatchObject({
      temperature: 0.25,
      maxTokens: 777,
    });
    expect(call.request.modelSettings.providerData).toBeUndefined();
    expect(call.request.tracing).toBe(false);
    expect(requestedModels).toEqual(['gpt-exact-model-id']);
    expect(events.map(({ eventId }) => eventId)).toEqual(
      events.map(
        (_event, index) => `attempt-negative:openai:${String(index + 1)}`,
      ),
    );
    expect(events.some(({ type }) => type === 'text-delta')).toBe(true);
    expect(events.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'completed',
      rawText: 'Settled answer.',
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
      adapterMetadata: {
        adapter: 'openai-agents-js',
        sdkVersion: OPENAI_AGENTS_SDK_VERSION,
        transport: 'responses-http',
        tracing: false,
        model: 'gpt-exact-model-id',
        credentialMode: 'session-memory',
      },
    });
    expect(closed).toEqual([true]);
  });

  it('uses the exact model ID and creates an independent SDK context per execution', async () => {
    const { bootstrap, models } = offlineProvider(
      () => new ScriptedModel([[assistantMessage('Independent answer.')]]),
    );
    const first = collect(bootstrap.provider.start(request('negative')).events);
    const second = collect(
      bootstrap.provider.start(request('positive')).events,
    );
    await Promise.all([first, second]);

    expect(models).toHaveLength(2);
    expect(models[0]).not.toBe(models[1]);
    expect(models.every((model) => model.calls.length === 1)).toBe(true);
  });

  it('bridges an SDK function call through REVIEW1 and resumes the same run with the full envelope', async () => {
    const toolResult: CompilerResultEnvelope = {
      protocolVersion: COMPILER_PROTOCOL_VERSION,
      snapshotId: 'snapshot-1',
      snapshotRevision: 'revision-1',
      status: 'not-found',
      references: [],
      completeness: 'complete',
      omissions: ['Synthetic record absent.'],
      freshness: 'retained',
      error: { code: 'not-found', message: 'No synthetic record matched.' },
    };
    const { bootstrap, models } = offlineProvider(
      () =>
        new ScriptedModel([
          [
            functionCall(
              'compiler_search_index',
              { query: 'synthetic', limit: 1 },
              { callId: 'sdk-call-7' },
            ),
          ],
          modelResponder((call) => {
            expect(Array.isArray(call.request.input)).toBe(true);
            const output = Array.isArray(call.request.input)
              ? call.request.input.find(
                  (item) =>
                    item.type === 'function_call_result' &&
                    item.callId === 'sdk-call-7',
                )
              : undefined;
            expect(output?.type).toBe('function_call_result');
            expect(
              output?.type === 'function_call_result'
                ? JSON.parse(
                    typeof output.output === 'string'
                      ? output.output
                      : !Array.isArray(output.output) &&
                          output.output.type === 'text'
                        ? output.output.text
                        : '',
                  )
                : undefined,
            ).toEqual(toolResult);
            return [assistantMessage('Used the explicit not-found result.')];
          }),
        ]),
    );
    const toolRequest = request();
    toolRequest.tools = [
      {
        name: 'compiler_search_index',
        description: 'Search the synthetic compiler index.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'integer' },
          },
          required: ['query', 'limit'],
          additionalProperties: false,
        },
      },
    ];
    const execution = bootstrap.provider.start(toolRequest);
    const iterator = execution.events[Symbol.asyncIterator]();
    let toolEvent: Extract<ProviderEvent, { type: 'tool-call' }> | undefined;
    while (toolEvent === undefined) {
      const next = await iterator.next();
      if (next.done) throw new Error('Tool event was not emitted.');
      if (next.value.type === 'tool-call') toolEvent = next.value;
    }
    expect(toolEvent).toMatchObject({
      toolCallId: 'sdk-call-7',
      name: 'compiler_search_index',
      arguments: { query: 'synthetic', limit: 1 },
    });
    await execution.submitToolResult({
      toolCallId: 'sdk-call-7',
      name: 'compiler_search_index',
      result: toolResult,
    });
    await expect(
      execution.submitToolResult({
        toolCallId: 'sdk-call-7',
        name: 'compiler_search_index',
        result: toolResult,
      }),
    ).rejects.toThrow('No pending OpenAI function call');
    const remaining: ProviderEvent[] = [];
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      remaining.push(next.value);
    }
    expect(remaining.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'completed',
      rawText: 'Used the explicit not-found result.',
    });
    expect(models[0]!.calls).toHaveLength(2);
  });

  it('maps strict Integrator and post-check output without streaming JSON fragments', async () => {
    const postCheck = {
      rawMarkdown: 'Post-check synthetic review.',
      structured: {
        schemaVersion: 1 as const,
        summary: 'Post-check summary.',
        findings: [
          {
            id: 'finding-1',
            kind: 'open-question' as const,
            markdown: 'Synthetic finding.',
            references: [
              {
                attemptId: 'attempt-integrator',
                locator: null,
                quote: null,
              },
            ],
          },
        ],
        revisedSynthesis: null,
      },
    };
    const responses = [integrationTransport(), postCheck];
    const { bootstrap } = offlineProvider(
      () =>
        new ScriptedModel([
          [assistantMessage(JSON.stringify(responses.shift()))],
        ]),
    );
    const [integratorEvents, postCheckEvents] = await Promise.all([
      collect(bootstrap.provider.start(request('integrator')).events),
      collect(bootstrap.provider.start(request('post-check')).events),
    ]);

    expect(integratorEvents.some(({ type }) => type === 'text-delta')).toBe(
      false,
    );
    expect(integratorEvents.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'completed',
      rawText: 'Integrated synthetic review.',
      structured: {
        issues: [
          {
            negativeReferences: [
              { attemptId: 'sdk-attempt-1', quote: 'negative' },
            ],
          },
        ],
      },
    });
    expect(postCheckEvents.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'completed',
      rawText: 'Post-check synthetic review.',
    });
    expect(
      (postCheckEvents.at(-1) as Extract<ProviderEvent, { type: 'terminal' }>)
        .structured,
    ).not.toHaveProperty('revisedSynthesis');
  });

  it('cancels only the targeted concurrent execution', async () => {
    const started = new Deferred<void>();
    let executionNumber = 0;
    const { bootstrap, credentials } = offlineProvider(() => {
      executionNumber += 1;
      return executionNumber === 1
        ? new ScriptedModel([
            modelResponder(
              (call) =>
                new Promise((_resolve, reject) => {
                  started.resolve();
                  call.request.signal?.addEventListener(
                    'abort',
                    () => reject(new DOMException('aborted', 'AbortError')),
                    { once: true },
                  );
                }),
            ),
          ])
        : new ScriptedModel([[assistantMessage('Second branch completed.')]]);
    });
    const execution = bootstrap.provider.start(request('negative'));
    const events = collect(execution.events);
    const otherEvents = collect(
      bootstrap.provider.start(request('positive')).events,
    );
    await started.promise;
    await execution.cancel(`Cancelled ${SENTINEL_KEY} by provider test`);

    expect((await events).at(-1)).toMatchObject({
      type: 'terminal',
      status: 'cancelled',
      error: 'Cancelled [redacted] by provider test',
    });
    expect(JSON.stringify(await events)).not.toContain(SENTINEL_KEY);
    expect((await otherEvents).at(-1)).toMatchObject({
      type: 'terminal',
      status: 'completed',
      rawText: 'Second branch completed.',
    });
    expect(credentials.snapshot().activeExecutionCount).toBe(0);
  });

  it('clearing the session credential aborts its active SDK execution', async () => {
    const started = new Deferred<void>();
    const { bootstrap, credentials } = offlineProvider(
      () =>
        new ScriptedModel([
          modelResponder(
            (call) =>
              new Promise((_resolve, reject) => {
                started.resolve();
                call.request.signal?.addEventListener(
                  'abort',
                  () => reject(new DOMException('aborted', 'AbortError')),
                  { once: true },
                );
              }),
          ),
        ]),
    );
    const events = collect(bootstrap.provider.start(request()).events);
    await started.promise;
    credentials.clear();

    expect((await events).at(-1)).toMatchObject({
      type: 'terminal',
      status: 'cancelled',
      error: 'OpenAI session API key was cleared.',
    });
    await vi.waitFor(() =>
      expect(credentials.snapshot().activeExecutionCount).toBe(0),
    );
  });

  it('fails safely for provider/auth/schema errors without leaking the key', async () => {
    const authError = Object.assign(
      new Error(`Authorization failed for ${SENTINEL_KEY}`),
      { status: 401 },
    );
    const { bootstrap } = offlineProvider(
      () => new ScriptedModel([modelError(authError)]),
    );
    const authEvents = await collect(
      bootstrap.provider.start(request()).events,
    );
    expect(authEvents.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'failed',
      error: 'OpenAI rejected the session API key or its permissions.',
    });
    expect(JSON.stringify(authEvents)).not.toContain(SENTINEL_KEY);

    const malformed = offlineProvider(
      () =>
        new ScriptedModel([
          [assistantMessage(JSON.stringify({ rawMarkdown: 'Only prose.' }))],
        ]),
    );
    const malformedEvents = await collect(
      malformed.bootstrap.provider.start(request('integrator')).events,
    );
    expect(malformedEvents.at(-1)).toMatchObject({
      type: 'terminal',
      status: 'failed',
    });

    const truncated = offlineProvider(
      () =>
        new ScriptedModel([
          modelError(
            Object.assign(new Error('max output tokens reached'), {
              code: 'max_output_tokens',
            }),
          ),
        ]),
    );
    expect(
      (await collect(truncated.bootstrap.provider.start(request()).events)).at(
        -1,
      ),
    ).toMatchObject({ type: 'terminal', status: 'truncated' });

    const missing = offlineProvider(
      () => new ScriptedModel([[assistantMessage('')]]),
    );
    expect(
      (await collect(missing.bootstrap.provider.start(request()).events)).at(
        -1,
      ),
    ).toMatchObject({ type: 'terminal', status: 'failed' });

    const noKey = new OpenAiSessionCredentials();
    const unavailable = createOpenAiAgentsProvider({ credentials: noKey });
    await expect(unavailable.getAvailability()).resolves.toMatchObject({
      supported: true,
      ready: false,
      provider: OPENAI_PROVIDER_ID,
    });
    expect(() => unavailable.provider.start(request())).toThrow(
      'Enter an OpenAI API key',
    );
    expect(() =>
      bootstrap.provider.start({
        ...request(),
        model: { provider: 'not-openai', model: OPENAI_DEFAULT_MODEL },
      }),
    ).toThrow('Expected provider openai');
  });

  it('configures the explicit browser client for Responses HTTP with logging and retries off', async () => {
    const clientOptions: unknown[] = [];
    const providerOptions: unknown[] = [];
    const close = vi.fn(async () => undefined);
    class FakeOpenAI {
      public constructor(options: unknown) {
        clientOptions.push(options);
      }
    }
    class FakeProvider {
      public constructor(options: unknown) {
        providerOptions.push(options);
      }

      public async getModel(): Promise<never> {
        throw new Error('Not used by this configuration test.');
      }

      public close = close;
    }
    const runtime = {
      OpenAI: FakeOpenAI,
      agents: { OpenAIProvider: FakeProvider },
    } as unknown as OpenAiAgentsRuntime;
    const session = await createBrowserModelProviderSession(
      SENTINEL_KEY,
      runtime,
    );

    expect(clientOptions).toEqual([
      {
        apiKey: SENTINEL_KEY,
        dangerouslyAllowBrowser: true,
        logLevel: 'off',
        maxRetries: 0,
      },
    ]);
    expect(providerOptions).toEqual([
      {
        openAIClient: expect.any(FakeOpenAI),
        useResponses: true,
        useResponsesWebSocket: false,
      },
    ]);
    await session.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('completes the REVIEW1 branch/tool/Integrator loop offline and keeps the key out of artifacts', async () => {
    const historyStore = new MemoryReviewHistoryStore();
    const runRepository = new HistoryReviewRunRepository(historyStore, () => ({
      title: 'Synthetic SDK run',
      workspaceLabel: 'Synthetic workspace',
    }));
    const compiler = new SyntheticCompilerProvider({
      descriptor: {
        snapshotId: 'snapshot-1',
        revision: 'revision-1',
        capabilities: ['search-index'],
      },
      entries: [
        {
          id: 'counterargument:synthetic',
          kind: 'counter-argument',
          title: 'Synthetic record',
          summary: 'Compiler bridge evidence.',
        },
      ],
      bundles: [],
      sources: [],
    });
    const { bootstrap, models } = offlineProvider(() => {
      let analysisTurn = 0;
      return new ScriptedModel([
        modelResponder((call) => {
          if (call.request.outputType !== 'text') {
            return [assistantMessage(JSON.stringify(integrationTransport()))];
          }
          analysisTurn += 1;
          if (analysisTurn === 1) {
            return [
              functionCall(
                'compiler_search_index',
                { query: 'Synthetic', limit: 10 },
                { callId: 'call-sdk-analysis' },
              ),
            ];
          }
          expect(JSON.stringify(call.request.input)).toContain(
            'counterargument:synthetic',
          );
          return [assistantMessage('Compiler-aware analysis.')];
        }),
        modelResponder((call) => {
          if (call.request.outputType !== 'text') {
            return [assistantMessage(JSON.stringify(integrationTransport()))];
          }
          expect(JSON.stringify(call.request.input)).toContain(
            'counterargument:synthetic',
          );
          return [assistantMessage('Compiler-aware analysis.')];
        }),
      ]);
    });
    const run = await (
      await new ReviewEngine({
        provider: bootstrap.provider,
        compilerProvider: compiler,
        repository: runRepository,
        ids: createSequentialIdGenerator('sdk'),
      }).start({
        workspaceId: 'workspace-1',
        source: request().material.source,
        additionalRequest: 'Use the synthetic compiler.',
        models: bootstrap.defaultModels,
        compiler: { analysis: true, integrator: false, postCheck: false },
      })
    ).completion;

    expect(run.state).toBe('completed');
    expect(
      run.attempts.filter(({ stage }) => stage !== 'integrator'),
    ).toHaveLength(2);
    expect(
      run.attempts
        .filter(({ stage }) => stage !== 'integrator')
        .every(({ toolCalls }) => toolCalls.length === 1),
    ).toBe(true);
    expect(models).toHaveLength(3);
    expect(exportReviewRunJson(run)).not.toContain(SENTINEL_KEY);
    expect(exportReviewRunMarkdown(run)).not.toContain(SENTINEL_KEY);
    expect(JSON.stringify(run)).not.toContain(SENTINEL_KEY);
    expect(JSON.stringify(await historyStore.load(run.id))).not.toContain(
      SENTINEL_KEY,
    );
  });
});
