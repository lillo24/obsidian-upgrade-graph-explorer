import {
  CompilerAccessError,
  CompilerToolDispatcher,
  compilerToolDefinitionsFor,
  validateCompilerSnapshotDescriptor,
} from './compiler';
import {
  assertSafeMetadata,
  clonePlainData,
  deepFreeze,
  deterministicFingerprint,
  plainDataByteLength,
  utf8Bytes,
} from './plain-data';
import {
  StructuredOutputError,
  structuredCandidate,
  validateIntegrationResult,
  validatePostCheckResult,
} from './results';
import { InMemoryReviewRunRepository } from './repository';
import { prepareReviewInput } from './snapshot';
import {
  renderAnalysisPrompt,
  renderIntegratorPrompt,
  renderPostCheckPrompt,
} from './templates';
import {
  COMPILER_PROTOCOL_VERSION,
  REVIEW_RUN_SCHEMA_VERSION,
  type AgentExecution,
  type AgentProvider,
  type AttemptState,
  type CompilerProvider,
  type CompilerResultEnvelope,
  type CompilerSnapshotSession,
  type CompilerToolName,
  type JsonValue,
  type ModelSettings,
  type ProviderEvent,
  type ProviderTerminalEvent,
  type RenderedPrompt,
  type ReviewArtifact,
  type ReviewAttemptRecord,
  type ReviewClock,
  type ReviewIdGenerator,
  type ReviewRunHandle,
  type ReviewRunRecord,
  type ReviewRunRepository,
  type ReviewStage,
  type StartReviewInput,
} from './types';

const TERMINAL_ATTEMPT_STATES = new Set<AttemptState>([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
  'blocked',
]);

const ALLOWED_TRANSITIONS: Record<AttemptState, AttemptState[]> = {
  queued: ['running', 'blocked', 'cancelled', 'interrupted'],
  running: [
    'waiting-for-tool',
    'completed',
    'failed',
    'cancel-requested',
    'cancelled',
    'interrupted',
  ],
  'waiting-for-tool': [
    'running',
    'failed',
    'cancel-requested',
    'cancelled',
    'interrupted',
  ],
  'cancel-requested': ['cancelled', 'failed', 'interrupted'],
  completed: [],
  failed: [],
  cancelled: [],
  interrupted: [],
  blocked: [],
};

class SystemReviewClock implements ReviewClock {
  public now(): Date {
    return new Date();
  }

  public setTimeout(callback: () => void, delayMs: number): unknown {
    return globalThis.setTimeout(callback, delayMs);
  }

  public clearTimeout(handle: unknown): void {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  }
}

export function createSequentialIdGenerator(
  prefix = 'review',
): ReviewIdGenerator {
  const sequences = new Map<string, number>();
  return {
    next(kind) {
      const sequence = (sequences.get(kind) ?? 0) + 1;
      sequences.set(kind, sequence);
      return `${prefix}-${kind}-${sequence}`;
    },
  };
}

interface ActiveExecution {
  attempt: ReviewAttemptRecord;
  execution: AgentExecution;
  controller: AbortController;
}

interface RunRuntime {
  run: ReviewRunRecord;
  compilerSession?: CompilerSnapshotSession;
  active: Map<string, ActiveExecution>;
}

export interface ReviewEngineDependencies {
  provider: AgentProvider;
  repository?: ReviewRunRepository;
  compilerProvider?: CompilerProvider;
  clock?: ReviewClock;
  ids?: ReviewIdGenerator;
}

function timestamp(clock: ReviewClock): string {
  return clock.now().toISOString();
}

function transition(attempt: ReviewAttemptRecord, next: AttemptState): void {
  if (attempt.state === next) return;
  if (!ALLOWED_TRANSITIONS[attempt.state].includes(next)) {
    throw new Error(
      `Invalid review attempt transition ${attempt.state} -> ${next} for ${attempt.id}.`,
    );
  }
  attempt.state = next;
}

function stageUsesCompiler(run: ReviewRunRecord, stage: ReviewStage): boolean {
  switch (stage) {
    case 'negative':
    case 'positive':
      return run.compilerPolicy.analysis;
    case 'integrator':
      return run.compilerPolicy.integrator;
    case 'post-check':
      return run.compilerPolicy.postCheck;
  }
}

function modelFor(run: ReviewRunRecord, stage: ReviewStage): ModelSettings {
  if (stage === 'negative' || stage === 'positive') return run.models.analysis;
  return stage === 'integrator' ? run.models.integrator : run.models.postCheck;
}

function availableCompilerTools(runtime: RunRuntime, stage: ReviewStage) {
  if (!stageUsesCompiler(runtime.run, stage) || !runtime.compilerSession) {
    return [];
  }
  return compilerToolDefinitionsFor(
    runtime.compilerSession.descriptor.capabilities,
  );
}

function currentAttempt(
  run: ReviewRunRecord,
  stage: ReviewStage,
): ReviewAttemptRecord | undefined {
  const id = run.currentAttemptIds[stage];
  return id ? run.attempts.find((attempt) => attempt.id === id) : undefined;
}

function completedCurrent(
  run: ReviewRunRecord,
  stage: ReviewStage,
): ReviewAttemptRecord | undefined {
  const attempt = currentAttempt(run, stage);
  return attempt?.state === 'completed' ? attempt : undefined;
}

function requiredOutput(attempt: ReviewAttemptRecord): string {
  if (!attempt.output || attempt.state !== 'completed') {
    throw new Error(`Attempt ${attempt.id} has no valid completed output.`);
  }
  return attempt.output.rawMarkdown;
}

function evidenceReferences(attempt: ReviewAttemptRecord): string {
  if (attempt.recordsRetrieved.length === 0) return 'none retrieved';
  return attempt.recordsRetrieved
    .map((reference) => {
      const heading = reference.sourceHeading
        ? `#${reference.sourceHeading}`
        : '';
      return `${reference.canonicalId}@${reference.revision}${heading}`;
    })
    .join(', ');
}

function cloneSessionDescriptor(session: CompilerSnapshotSession) {
  return validateCompilerSnapshotDescriptor(session.descriptor);
}

function compilerError(error: unknown): { code: string; message: string } {
  return {
    code:
      error instanceof CompilerAccessError
        ? error.code
        : 'compiler-snapshot-open-failed',
    message: error instanceof Error ? error.message : String(error),
  };
}

function requestExecutionCancellation(
  execution: AgentExecution,
  reason: string,
): void {
  void execution.cancel(reason).then(
    () => undefined,
    () => undefined,
  );
}

function unavailableToolEnvelope(
  run: ReviewRunRecord,
  code: string,
  message: string,
): CompilerResultEnvelope {
  return {
    protocolVersion: COMPILER_PROTOCOL_VERSION,
    snapshotId: run.compilerBinding.descriptor?.snapshotId ?? 'unavailable',
    snapshotRevision: run.compilerBinding.descriptor?.revision ?? 'unavailable',
    status: 'invalid-request',
    references: [],
    completeness: 'not-applicable',
    omissions: [],
    freshness: 'unavailable',
    error: { code, message },
  };
}

export class ReviewEngine {
  readonly #provider: AgentProvider;
  readonly #repository: ReviewRunRepository;
  readonly #compilerProvider: CompilerProvider | undefined;
  readonly #clock: ReviewClock;
  readonly #ids: ReviewIdGenerator;
  readonly #runtimes = new Map<string, RunRuntime>();

  public constructor(dependencies: ReviewEngineDependencies) {
    this.#provider = dependencies.provider;
    this.#repository =
      dependencies.repository ?? new InMemoryReviewRunRepository();
    this.#compilerProvider = dependencies.compilerProvider;
    this.#clock = dependencies.clock ?? new SystemReviewClock();
    this.#ids = dependencies.ids ?? createSequentialIdGenerator();
  }

  public async start(input: StartReviewInput): Promise<ReviewRunHandle> {
    const prepared = prepareReviewInput(input);
    const compilerRequested =
      prepared.compilerPolicy.analysis ||
      prepared.compilerPolicy.integrator ||
      prepared.compilerPolicy.postCheck;
    let compilerSession: CompilerSnapshotSession | undefined;
    let bindingError: { code: string; message: string } | undefined;
    if (compilerRequested && this.#compilerProvider) {
      try {
        compilerSession = await this.#openCompilerSession(
          prepared.frozenInput.workspaceId,
          prepared.compilerPolicy.requestedSnapshotId,
          prepared.limits.maxExecutionMs,
        );
        cloneSessionDescriptor(compilerSession);
      } catch (error) {
        bindingError = compilerError(error);
      }
    } else if (compilerRequested) {
      bindingError = {
        code: 'compiler-provider-not-configured',
        message:
          'Compiler access was explicitly requested, but no provider was configured.',
      };
    }

    const now = timestamp(this.#clock);
    const negativePrompt = renderAnalysisPrompt({
      stage: 'negative',
      frozenInput: prepared.frozenInput,
      templates: prepared.templates,
      compilerAvailable:
        prepared.compilerPolicy.analysis && compilerSession !== undefined,
    });
    const positivePrompt = renderAnalysisPrompt({
      stage: 'positive',
      frozenInput: prepared.frozenInput,
      templates: prepared.templates,
      compilerAvailable:
        prepared.compilerPolicy.analysis && compilerSession !== undefined,
    });
    this.#validatePrompt(negativePrompt, prepared.limits.maxPromptBytes);
    this.#validatePrompt(positivePrompt, prepared.limits.maxPromptBytes);
    const frozenInput = clonePlainData(prepared.frozenInput);
    if (compilerSession) {
      frozenInput.fingerprint = deterministicFingerprint({
        baseInputFingerprint: frozenInput.fingerprint,
        compilerSnapshot: compilerSession.descriptor,
      });
    }
    const run: ReviewRunRecord = {
      schemaVersion: REVIEW_RUN_SCHEMA_VERSION,
      id: this.#ids.next('run'),
      state: 'queued',
      createdAt: now,
      updatedAt: now,
      frozenInput,
      templates: clonePlainData(prepared.templates),
      renderedPrompts: {
        negative: negativePrompt,
        positive: positivePrompt,
      },
      models: clonePlainData(prepared.models),
      limits: clonePlainData(prepared.limits),
      compilerPolicy: clonePlainData(prepared.compilerPolicy),
      compilerBinding: {
        requested: compilerRequested,
        ...(compilerSession
          ? { descriptor: clonePlainData(compilerSession.descriptor) }
          : {}),
        ...(bindingError ? { error: bindingError } : {}),
      },
      attempts: [],
      currentAttemptIds: {},
      automaticIntegrationPairs: [],
      automaticPostCheckIntegrations: [],
      artifacts: {},
    };
    const runtime: RunRuntime = {
      run,
      ...(compilerSession ? { compilerSession } : {}),
      active: new Map(),
    };
    this.#runtimes.set(run.id, runtime);
    await this.#save(runtime);
    const completion = this.#runInitial(runtime);
    return {
      runId: run.id,
      completion,
      cancel: async (reason = 'Cancelled by caller') =>
        this.cancel(run.id, reason),
    };
  }

  public async get(runId: string): Promise<ReviewRunRecord | undefined> {
    return this.#repository.load(runId);
  }

  public async cancel(
    runId: string,
    reason = 'Cancelled by caller',
  ): Promise<ReviewRunRecord> {
    const runtime = await this.#runtimeFor(runId);
    const at = timestamp(this.#clock);
    runtime.run.cancellation = { requestedAt: at, reason };
    runtime.run.state = 'cancel-requested';
    for (const active of runtime.active.values()) {
      if (TERMINAL_ATTEMPT_STATES.has(active.attempt.state)) continue;
      if (active.attempt.state !== 'cancel-requested') {
        transition(active.attempt, 'cancel-requested');
      }
      active.attempt.cancellation = {
        requestedAt: at,
        reason,
        remoteTerminationConfirmed: false,
      };
      active.controller.abort(reason);
      requestExecutionCancellation(active.execution, reason);
    }
    this.#recomputeRunState(runtime);
    await this.#save(runtime);
    return this.#requiredStoredRun(runId);
  }

  public async retry(
    runId: string,
    stage: ReviewStage,
  ): Promise<ReviewRunRecord> {
    const runtime = await this.#runtimeFor(runId);
    delete runtime.run.cancellation;
    if (stage === 'negative' || stage === 'positive') {
      await this.#invalidateDependents(runtime, stage);
      const prompt = renderAnalysisPrompt({
        stage,
        frozenInput: runtime.run.frozenInput,
        templates: runtime.run.templates,
        compilerAvailable:
          runtime.run.compilerPolicy.analysis &&
          runtime.compilerSession !== undefined,
      });
      runtime.run.renderedPrompts[stage] = prompt;
      await this.#launchStage(runtime, stage, prompt, [], false);
      await this.#continueAfterBranches(runtime);
    } else if (stage === 'integrator') {
      const negative = completedCurrent(runtime.run, 'negative');
      const positive = completedCurrent(runtime.run, 'positive');
      if (!negative || !positive) {
        throw new Error(
          'Integrator retry requires current valid Negative and Positive attempts.',
        );
      }
      await this.#invalidateDependents(runtime, 'integrator');
      await this.#launchIntegration(runtime, negative, positive, false);
    } else {
      const integration = completedCurrent(runtime.run, 'integrator');
      const negative = completedCurrent(runtime.run, 'negative');
      const positive = completedCurrent(runtime.run, 'positive');
      if (!integration || !negative || !positive) {
        throw new Error(
          'Post-check retry requires current valid analyses and integration.',
        );
      }
      await this.#launchPostCheck(
        runtime,
        negative,
        positive,
        integration,
        false,
      );
    }
    this.#recomputeRunState(runtime);
    await this.#save(runtime);
    return this.#requiredStoredRun(runId);
  }

  async #runInitial(runtime: RunRuntime): Promise<ReviewRunRecord> {
    const negativePrompt = runtime.run.renderedPrompts.negative;
    const positivePrompt = runtime.run.renderedPrompts.positive;
    if (!negativePrompt || !positivePrompt) {
      throw new Error('Initial analysis prompts were not rendered.');
    }
    await Promise.all([
      this.#launchStage(runtime, 'negative', negativePrompt, [], true),
      this.#launchStage(runtime, 'positive', positivePrompt, [], true),
    ]);
    await this.#continueAfterBranches(runtime);
    this.#recomputeRunState(runtime);
    await this.#save(runtime);
    return this.#requiredStoredRun(runtime.run.id);
  }

  async #continueAfterBranches(runtime: RunRuntime): Promise<void> {
    if (runtime.run.cancellation) return;
    const negative = completedCurrent(runtime.run, 'negative');
    const positive = completedCurrent(runtime.run, 'positive');
    if (!negative || !positive) {
      await this.#createBlockedAttempt(
        runtime,
        'integrator',
        [
          currentAttempt(runtime.run, 'negative')?.id,
          currentAttempt(runtime.run, 'positive')?.id,
        ].filter((id): id is string => id !== undefined),
        'dependency-not-completed',
        'Integration requires valid completed Negative and Positive attempts.',
      );
      return;
    }
    const pair = `${negative.id}|${positive.id}`;
    if (runtime.run.automaticIntegrationPairs.includes(pair)) return;
    runtime.run.automaticIntegrationPairs.push(pair);
    await this.#launchIntegration(runtime, negative, positive, true);
  }

  async #launchIntegration(
    runtime: RunRuntime,
    negative: ReviewAttemptRecord,
    positive: ReviewAttemptRecord,
    automatic: boolean,
  ): Promise<void> {
    if (runtime.run.cancellation) return;
    const prompt = renderIntegratorPrompt({
      frozenInput: runtime.run.frozenInput,
      templates: runtime.run.templates,
      negativeAttemptId: negative.id,
      negativeOutput: requiredOutput(negative),
      negativeEvidence: evidenceReferences(negative),
      positiveAttemptId: positive.id,
      positiveOutput: requiredOutput(positive),
      positiveEvidence: evidenceReferences(positive),
      compilerAvailable:
        runtime.run.compilerPolicy.integrator &&
        runtime.compilerSession !== undefined,
    });
    runtime.run.renderedPrompts.integrator = prompt;
    await this.#launchStage(
      runtime,
      'integrator',
      prompt,
      [negative.id, positive.id],
      automatic,
    );
    const integration = completedCurrent(runtime.run, 'integrator');
    if (!integration) {
      if (runtime.run.compilerPolicy.postCheck) {
        await this.#createBlockedAttempt(
          runtime,
          'post-check',
          [
            negative.id,
            positive.id,
            currentAttempt(runtime.run, 'integrator')?.id,
          ].filter((id): id is string => id !== undefined),
          'dependency-not-completed',
          'Post-check requires a valid completed integration.',
        );
      }
      return;
    }
    if (!runtime.run.compilerPolicy.postCheck) return;
    if (runtime.run.automaticPostCheckIntegrations.includes(integration.id)) {
      return;
    }
    runtime.run.automaticPostCheckIntegrations.push(integration.id);
    await this.#launchPostCheck(runtime, negative, positive, integration, true);
  }

  async #launchPostCheck(
    runtime: RunRuntime,
    negative: ReviewAttemptRecord,
    positive: ReviewAttemptRecord,
    integration: ReviewAttemptRecord,
    automatic: boolean,
  ): Promise<void> {
    if (runtime.run.cancellation) return;
    const prompt = renderPostCheckPrompt({
      frozenInput: runtime.run.frozenInput,
      templates: runtime.run.templates,
      negativeAttemptId: negative.id,
      negativeOutput: requiredOutput(negative),
      positiveAttemptId: positive.id,
      positiveOutput: requiredOutput(positive),
      integratorAttemptId: integration.id,
      integratorOutput: requiredOutput(integration),
    });
    runtime.run.renderedPrompts['post-check'] = prompt;
    await this.#launchStage(
      runtime,
      'post-check',
      prompt,
      [negative.id, positive.id, integration.id],
      automatic,
    );
  }

  async #launchStage(
    runtime: RunRuntime,
    stage: ReviewStage,
    prompt: RenderedPrompt,
    dependsOn: string[],
    automatic: boolean,
  ): Promise<ReviewAttemptRecord> {
    this.#validatePrompt(prompt, runtime.run.limits.maxPromptBytes);
    const attempt = this.#createAttempt(
      runtime,
      stage,
      prompt,
      dependsOn,
      automatic,
    );
    if (runtime.run.cancellation) {
      transition(attempt, 'cancelled');
      attempt.endedAt = timestamp(this.#clock);
      attempt.error = {
        code: 'run-cancelled',
        message: 'Run cancellation prevented this stage from starting.',
      };
      await this.#save(runtime);
      return attempt;
    }
    if (stageUsesCompiler(runtime.run, stage) && !runtime.compilerSession) {
      transition(attempt, 'blocked');
      attempt.endedAt = timestamp(this.#clock);
      attempt.error = runtime.run.compilerBinding.error ?? {
        code: 'compiler-unavailable',
        message:
          'This stage requires compiler access, but no immutable snapshot is bound.',
      };
      await this.#save(runtime);
      return attempt;
    }

    const controller = new AbortController();
    transition(attempt, 'running');
    attempt.startedAt = timestamp(this.#clock);
    runtime.run.state = 'running';
    let execution: AgentExecution;
    try {
      execution = this.#provider.start({
        runId: runtime.run.id,
        stage,
        attemptId: attempt.id,
        attemptNumber: attempt.number,
        contextId: attempt.contextId,
        instructions: prompt.text,
        material: deepFreeze(clonePlainData(runtime.run.frozenInput)),
        model: deepFreeze(clonePlainData(attempt.model)),
        tools: clonePlainData(availableCompilerTools(runtime, stage)),
        limits: deepFreeze(clonePlainData(runtime.run.limits)),
        signal: controller.signal,
      });
    } catch (error) {
      transition(attempt, 'failed');
      attempt.endedAt = timestamp(this.#clock);
      attempt.error = {
        code: 'provider-start-failed',
        message: error instanceof Error ? error.message : String(error),
      };
      await this.#save(runtime);
      return attempt;
    }
    if (execution.adapterMetadata) {
      try {
        assertSafeMetadata(
          execution.adapterMetadata,
          'Provider adapter metadata',
        );
        attempt.adapterMetadata = clonePlainData(execution.adapterMetadata);
      } catch (error) {
        controller.abort('unsafe-adapter-metadata');
        requestExecutionCancellation(
          execution,
          'Provider adapter metadata was unsafe to persist.',
        );
        transition(attempt, 'failed');
        attempt.endedAt = timestamp(this.#clock);
        attempt.error = {
          code: 'unsafe-adapter-metadata',
          message: error instanceof Error ? error.message : String(error),
        };
        await this.#save(runtime);
        return attempt;
      }
    }
    runtime.active.set(attempt.id, { attempt, execution, controller });
    await this.#save(runtime);
    await this.#consumeExecution(runtime, attempt, execution, controller);
    runtime.active.delete(attempt.id);
    this.#recomputeRunState(runtime);
    await this.#save(runtime);
    return attempt;
  }

  async #consumeExecution(
    runtime: RunRuntime,
    attempt: ReviewAttemptRecord,
    execution: AgentExecution,
    controller: AbortController,
  ): Promise<void> {
    const dispatcher = new CompilerToolDispatcher(
      stageUsesCompiler(runtime.run, attempt.stage)
        ? runtime.compilerSession
        : undefined,
      runtime.run.limits,
      controller.signal,
    );
    const seenEvents = new Set<string>();
    const iterator = execution.events[Symbol.asyncIterator]();
    let timedOut = false;
    let resolveTimeout!: () => void;
    const timeout = new Promise<void>((resolve) => {
      resolveTimeout = resolve;
    });
    const timer = this.#clock.setTimeout(() => {
      timedOut = true;
      controller.abort('execution-time-limit');
      resolveTimeout();
    }, runtime.run.limits.maxExecutionMs);
    const failForTimeout = async (): Promise<void> => {
      controller.abort('execution-time-limit');
      requestExecutionCancellation(
        execution,
        'Configured execution time limit exceeded.',
      );
      if (!TERMINAL_ATTEMPT_STATES.has(attempt.state)) {
        if (attempt.state === 'cancel-requested') {
          transition(attempt, 'cancelled');
          attempt.cancellation = attempt.cancellation ?? {
            requestedAt: timestamp(this.#clock),
            reason: 'Cancellation was not remotely confirmed before timeout.',
            remoteTerminationConfirmed: false,
          };
        } else {
          transition(attempt, 'failed');
        }
      }
      attempt.endedAt = timestamp(this.#clock);
      attempt.error = {
        code:
          attempt.state === 'cancelled'
            ? 'cancellation-confirmation-time-limit'
            : 'execution-time-limit',
        message: `Stage exceeded maxExecutionMs (${runtime.run.limits.maxExecutionMs}).`,
      };
    };
    try {
      while (true) {
        const next = iterator.next();
        const winner = await Promise.race([
          next.then((result) => ({ kind: 'event' as const, result })),
          timeout.then(() => ({ kind: 'timeout' as const })),
        ]);
        if (winner.kind === 'timeout') {
          await failForTimeout();
          return;
        }
        if (winner.result.done) {
          if (!TERMINAL_ATTEMPT_STATES.has(attempt.state)) {
            if (attempt.state === 'cancel-requested') {
              transition(attempt, 'cancelled');
              attempt.endedAt = timestamp(this.#clock);
            } else {
              transition(attempt, 'failed');
              attempt.endedAt = timestamp(this.#clock);
              attempt.error = {
                code: 'provider-stream-ended-without-terminal',
                message:
                  'Provider stream ended without an explicit terminal analytical outcome.',
              };
            }
          }
          return;
        }
        const event = winner.result.value;
        if (
          event.runId !== runtime.run.id ||
          event.stage !== attempt.stage ||
          event.attemptId !== attempt.id
        ) {
          attempt.events.push({
            eventId: event.eventId,
            type: event.type,
            at: timestamp(this.#clock),
            summary:
              'Ignored event with mismatched run/stage/attempt identity.',
          });
          continue;
        }
        const duplicateEvent = seenEvents.has(event.eventId);
        if (!duplicateEvent) {
          seenEvents.add(event.eventId);
          attempt.events.push({
            eventId: event.eventId,
            type: event.type,
            at: timestamp(this.#clock),
            summary: this.#eventSummary(event),
          });
        } else if (event.type !== 'tool-call') {
          continue;
        }
        if (event.type === 'tool-call') {
          const toolWinner = await Promise.race([
            this.#handleToolCall(
              runtime,
              attempt,
              execution,
              dispatcher,
              event,
            ).then(() => 'tool' as const),
            timeout.then(() => 'timeout' as const),
          ]);
          if (toolWinner === 'timeout') {
            await failForTimeout();
            return;
          }
          continue;
        }
        if (event.type === 'terminal') {
          this.#handleTerminal(runtime, attempt, event);
          return;
        }
        await this.#save(runtime);
      }
    } catch (error) {
      if (!TERMINAL_ATTEMPT_STATES.has(attempt.state)) {
        if (attempt.state === 'cancel-requested' || runtime.run.cancellation) {
          transition(attempt, 'cancelled');
          attempt.cancellation = attempt.cancellation ?? {
            requestedAt: timestamp(this.#clock),
            reason: 'Execution ended after cancellation.',
            remoteTerminationConfirmed: false,
          };
        } else {
          transition(attempt, 'failed');
          attempt.error = {
            code: 'provider-stream-failed',
            message: error instanceof Error ? error.message : String(error),
          };
        }
        attempt.endedAt = timestamp(this.#clock);
      }
    } finally {
      this.#clock.clearTimeout(timer);
      if (timedOut) void iterator.return?.();
    }
  }

  async #handleToolCall(
    runtime: RunRuntime,
    attempt: ReviewAttemptRecord,
    execution: AgentExecution,
    dispatcher: CompilerToolDispatcher,
    event: Extract<ProviderEvent, { type: 'tool-call' }>,
  ): Promise<void> {
    if (!stageUsesCompiler(runtime.run, attempt.stage)) {
      const result = unavailableToolEnvelope(
        runtime.run,
        'tool-not-authorized-for-stage',
        `Stage ${attempt.stage} has no compiler permission.`,
      );
      const argumentsArtifact = this.#addArtifact(
        runtime,
        'application/json',
        event.arguments,
      );
      const resultArtifact = this.#addArtifact(
        runtime,
        'application/json',
        result as unknown as JsonValue,
      );
      attempt.toolCalls.push({
        toolCallId: event.toolCallId,
        name: event.name,
        argumentsArtifactId: argumentsArtifact.id,
        resultArtifactId: resultArtifact.id,
        status: result.status,
        canonicalReferences: [],
        duplicateDeliveries: 0,
      });
      await execution.submitToolResult({
        toolCallId: event.toolCallId,
        name: event.name,
        result,
      });
      await this.#save(runtime);
      return;
    }
    if (attempt.state === 'running') transition(attempt, 'waiting-for-tool');
    await this.#save(runtime);
    const dispatched = await dispatcher.dispatch(
      event.toolCallId,
      event.name,
      event.arguments,
    );
    const existing = attempt.toolCalls.find(
      (call) => call.toolCallId === event.toolCallId,
    );
    if (existing && dispatched.duplicate) {
      existing.duplicateDeliveries += 1;
      if (dispatched.result.status === 'invalid-request') {
        existing.status = dispatched.result.status;
      }
    } else {
      const argumentsArtifact = this.#addArtifact(
        runtime,
        'application/json',
        event.arguments,
      );
      const resultArtifact = this.#addArtifact(
        runtime,
        'application/json',
        dispatched.result as unknown as JsonValue,
      );
      attempt.toolCalls.push({
        toolCallId: event.toolCallId,
        name: event.name,
        argumentsArtifactId: argumentsArtifact.id,
        resultArtifactId: resultArtifact.id,
        status: dispatched.result.status,
        canonicalReferences: clonePlainData(dispatched.result.references),
        duplicateDeliveries: dispatched.duplicate ? 1 : 0,
      });
      for (const reference of dispatched.result.references) {
        if (
          !attempt.recordsRetrieved.some(
            (known) =>
              known.canonicalId === reference.canonicalId &&
              known.revision === reference.revision,
          )
        ) {
          attempt.recordsRetrieved.push(clonePlainData(reference));
        }
      }
    }
    await execution.submitToolResult({
      toolCallId: event.toolCallId,
      name: event.name,
      result: dispatched.result,
    });
    if (attempt.state === 'waiting-for-tool') transition(attempt, 'running');
    await this.#save(runtime);
  }

  #handleTerminal(
    runtime: RunRuntime,
    attempt: ReviewAttemptRecord,
    event: ProviderTerminalEvent,
  ): void {
    attempt.terminalStatus = event.status;
    if (event.usage) attempt.usage = clonePlainData(event.usage);
    if (attempt.state === 'cancel-requested' || runtime.run.cancellation) {
      transition(attempt, 'cancelled');
      attempt.endedAt = timestamp(this.#clock);
      attempt.cancellation = attempt.cancellation ?? {
        requestedAt:
          runtime.run.cancellation?.requestedAt ?? timestamp(this.#clock),
        reason: runtime.run.cancellation?.reason ?? 'Attempt was cancelled.',
        remoteTerminationConfirmed: false,
      };
      attempt.cancellation.remoteTerminationConfirmed =
        event.status === 'cancelled';
      return;
    }
    if (utf8Bytes(event.rawText) > runtime.run.limits.maxOutputBytes) {
      transition(attempt, 'failed');
      attempt.endedAt = timestamp(this.#clock);
      attempt.terminalStatus = 'truncated';
      attempt.error = {
        code: 'output-byte-limit',
        message: `Output exceeded maxOutputBytes (${runtime.run.limits.maxOutputBytes}); no content was truncated into a successful result.`,
      };
      return;
    }
    if (event.status !== 'completed') {
      transition(
        attempt,
        event.status === 'cancelled' ? 'cancelled' : 'failed',
      );
      attempt.endedAt = timestamp(this.#clock);
      attempt.output = {
        rawMarkdown: event.rawText,
        structuredStatus: 'not-required',
        validationErrors: [],
      };
      attempt.error = {
        code: `provider-${event.status}`,
        message:
          event.error ??
          `Provider ended the stage with status ${event.status}.`,
      };
      return;
    }
    if (event.rawText.trim().length === 0) {
      transition(attempt, 'failed');
      attempt.endedAt = timestamp(this.#clock);
      attempt.error = {
        code: 'empty-provider-output',
        message: 'A completed provider outcome must include non-empty output.',
      };
      return;
    }
    if (attempt.stage === 'negative' || attempt.stage === 'positive') {
      attempt.output = {
        rawMarkdown: event.rawText,
        structuredStatus: 'not-required',
        validationErrors: [],
      };
      transition(attempt, 'completed');
      attempt.endedAt = timestamp(this.#clock);
      return;
    }
    try {
      const candidate = structuredCandidate(event.structured, event.rawText);
      if (attempt.stage === 'integrator') {
        const negative = runtime.run.attempts.find(
          (dependency) =>
            attempt.dependsOn.includes(dependency.id) &&
            dependency.stage === 'negative',
        );
        const positive = runtime.run.attempts.find(
          (dependency) =>
            attempt.dependsOn.includes(dependency.id) &&
            dependency.stage === 'positive',
        );
        if (!negative || !positive) {
          throw new StructuredOutputError([
            'Integrator attempt dependencies are missing from run history.',
          ]);
        }
        attempt.output = {
          rawMarkdown: event.rawText,
          structured: validateIntegrationResult(candidate, negative, positive),
          structuredStatus: 'valid',
          validationErrors: [],
        };
      } else {
        const dependencies = runtime.run.attempts.filter((dependency) =>
          attempt.dependsOn.includes(dependency.id),
        );
        attempt.output = {
          rawMarkdown: event.rawText,
          structured: validatePostCheckResult(candidate, dependencies),
          structuredStatus: 'valid',
          validationErrors: [],
        };
      }
      transition(attempt, 'completed');
    } catch (error) {
      const errors =
        error instanceof StructuredOutputError
          ? error.errors
          : [error instanceof Error ? error.message : String(error)];
      attempt.output = {
        rawMarkdown: event.rawText,
        structuredStatus: 'invalid',
        validationErrors: errors,
      };
      transition(attempt, 'failed');
      attempt.error = {
        code: 'invalid-structured-output',
        message: errors.join(' '),
      };
    }
    attempt.endedAt = timestamp(this.#clock);
  }

  #createAttempt(
    runtime: RunRuntime,
    stage: ReviewStage,
    prompt: RenderedPrompt,
    dependsOn: string[],
    automatic: boolean,
  ): ReviewAttemptRecord {
    const oldCurrent = currentAttempt(runtime.run, stage);
    if (oldCurrent) oldCurrent.current = false;
    const createdAt = timestamp(this.#clock);
    const toolsAvailable: CompilerToolName[] = availableCompilerTools(
      runtime,
      stage,
    ).map((tool) => tool.name);
    const attempt: ReviewAttemptRecord = {
      id: this.#ids.next('attempt'),
      stage,
      number:
        runtime.run.attempts.filter((candidate) => candidate.stage === stage)
          .length + 1,
      contextId: this.#ids.next('context'),
      state: 'queued',
      createdAt,
      prompt: clonePlainData(prompt),
      model: clonePlainData(modelFor(runtime.run, stage)),
      toolsAvailable,
      recordsRetrieved: [],
      events: [],
      toolCalls: [],
      dependsOn: [...dependsOn],
      automatic,
      current: true,
    };
    runtime.run.attempts.push(attempt);
    runtime.run.currentAttemptIds[stage] = attempt.id;
    return attempt;
  }

  async #createBlockedAttempt(
    runtime: RunRuntime,
    stage: ReviewStage,
    dependsOn: string[],
    code: string,
    message: string,
  ): Promise<void> {
    const current = currentAttempt(runtime.run, stage);
    if (
      current?.state === 'blocked' &&
      current.error?.code === code &&
      current.dependsOn.join('|') === dependsOn.join('|')
    ) {
      return;
    }
    const prompt = this.#blockedPrompt(runtime, stage, dependsOn);
    const attempt = this.#createAttempt(
      runtime,
      stage,
      prompt,
      dependsOn,
      true,
    );
    transition(attempt, 'blocked');
    attempt.endedAt = timestamp(this.#clock);
    attempt.error = { code, message };
    this.#recomputeRunState(runtime);
    await this.#save(runtime);
  }

  #blockedPrompt(
    runtime: RunRuntime,
    stage: ReviewStage,
    dependsOn: string[],
  ): RenderedPrompt {
    if (stage === 'integrator') {
      const negative = runtime.run.attempts.find(
        (attempt) =>
          dependsOn.includes(attempt.id) && attempt.stage === 'negative',
      );
      const positive = runtime.run.attempts.find(
        (attempt) =>
          dependsOn.includes(attempt.id) && attempt.stage === 'positive',
      );
      return renderIntegratorPrompt({
        frozenInput: runtime.run.frozenInput,
        templates: runtime.run.templates,
        negativeAttemptId: negative?.id ?? 'unavailable',
        negativeOutput: negative?.output?.rawMarkdown ?? '[unavailable]',
        negativeEvidence: negative
          ? evidenceReferences(negative)
          : 'unavailable',
        positiveAttemptId: positive?.id ?? 'unavailable',
        positiveOutput: positive?.output?.rawMarkdown ?? '[unavailable]',
        positiveEvidence: positive
          ? evidenceReferences(positive)
          : 'unavailable',
        compilerAvailable: false,
      });
    }
    const negative = runtime.run.attempts.find(
      (attempt) =>
        dependsOn.includes(attempt.id) && attempt.stage === 'negative',
    );
    const positive = runtime.run.attempts.find(
      (attempt) =>
        dependsOn.includes(attempt.id) && attempt.stage === 'positive',
    );
    const integrator = runtime.run.attempts.find(
      (attempt) =>
        dependsOn.includes(attempt.id) && attempt.stage === 'integrator',
    );
    return renderPostCheckPrompt({
      frozenInput: runtime.run.frozenInput,
      templates: runtime.run.templates,
      negativeAttemptId: negative?.id ?? 'unavailable',
      negativeOutput: negative?.output?.rawMarkdown ?? '[unavailable]',
      positiveAttemptId: positive?.id ?? 'unavailable',
      positiveOutput: positive?.output?.rawMarkdown ?? '[unavailable]',
      integratorAttemptId: integrator?.id ?? 'unavailable',
      integratorOutput: integrator?.output?.rawMarkdown ?? '[unavailable]',
    });
  }

  async #invalidateDependents(
    runtime: RunRuntime,
    retriedStage: ReviewStage,
  ): Promise<void> {
    const stages: ReviewStage[] =
      retriedStage === 'integrator'
        ? ['post-check']
        : retriedStage === 'negative' || retriedStage === 'positive'
          ? ['integrator', 'post-check']
          : [];
    for (const stage of stages) {
      const attempt = currentAttempt(runtime.run, stage);
      if (!attempt) continue;
      attempt.current = false;
      delete runtime.run.currentAttemptIds[stage];
      const active = runtime.active.get(attempt.id);
      if (active && !TERMINAL_ATTEMPT_STATES.has(attempt.state)) {
        if (attempt.state !== 'cancel-requested') {
          transition(attempt, 'cancel-requested');
        }
        const at = timestamp(this.#clock);
        attempt.cancellation = {
          requestedAt: at,
          reason: `Superseded by retry of ${retriedStage}.`,
          remoteTerminationConfirmed: false,
        };
        active.controller.abort('superseded');
        requestExecutionCancellation(
          active.execution,
          `Superseded by retry of ${retriedStage}.`,
        );
      }
    }
    const prior = currentAttempt(runtime.run, retriedStage);
    if (prior) {
      prior.current = false;
      delete runtime.run.currentAttemptIds[retriedStage];
    }
    await this.#save(runtime);
  }

  #addArtifact(
    runtime: RunRuntime,
    mediaType: ReviewArtifact['mediaType'],
    content: JsonValue | string,
  ): ReviewArtifact {
    const artifact: ReviewArtifact = {
      id: this.#ids.next('artifact'),
      mediaType,
      byteLength:
        typeof content === 'string'
          ? utf8Bytes(content)
          : plainDataByteLength(content),
      content: clonePlainData(content),
    };
    runtime.run.artifacts[artifact.id] = artifact;
    return artifact;
  }

  #eventSummary(event: ProviderEvent): string {
    switch (event.type) {
      case 'progress':
        return event.message;
      case 'text-delta':
        return `Received ${utf8Bytes(event.text)} output bytes.`;
      case 'tool-call':
        return `Requested tool ${event.name} with call ID ${event.toolCallId}.`;
      case 'terminal':
        return `Provider terminal outcome: ${event.status}.`;
    }
  }

  #validatePrompt(prompt: RenderedPrompt, maxBytes: number): void {
    const bytes = utf8Bytes(prompt.text);
    if (bytes > maxBytes) {
      throw new Error(
        `Rendered prompt ${prompt.templateVersion} exceeds maxPromptBytes (${maxBytes}); no content was truncated.`,
      );
    }
  }

  #recomputeRunState(runtime: RunRuntime): void {
    const run = runtime.run;
    if (run.cancellation) {
      run.state = runtime.active.size > 0 ? 'cancel-requested' : 'cancelled';
      return;
    }
    if ([...runtime.active.values()].some((active) => active.attempt.current)) {
      run.state = 'running';
      return;
    }
    const post = currentAttempt(run, 'post-check');
    const integration = currentAttempt(run, 'integrator');
    const negative = currentAttempt(run, 'negative');
    const positive = currentAttempt(run, 'positive');
    const target = run.compilerPolicy.postCheck ? post : integration;
    if (target?.state === 'completed') {
      run.state = 'completed';
    } else if (target?.state === 'blocked') {
      run.state = 'blocked';
    } else if (
      target &&
      ['failed', 'cancelled', 'interrupted'].includes(target.state)
    ) {
      run.state = target.state === 'interrupted' ? 'interrupted' : 'failed';
    } else if (negative?.state === 'blocked' || positive?.state === 'blocked') {
      run.state = 'blocked';
    } else if (
      negative &&
      positive &&
      [negative.state, positive.state].some((state) =>
        ['failed', 'cancelled', 'interrupted'].includes(state),
      )
    ) {
      run.state =
        negative.state === 'interrupted' || positive.state === 'interrupted'
          ? 'interrupted'
          : 'failed';
    } else {
      run.state = 'running';
    }
  }

  async #save(runtime: RunRuntime): Promise<void> {
    runtime.run.updatedAt = timestamp(this.#clock);
    await this.#repository.save(runtime.run);
  }

  async #requiredStoredRun(runId: string): Promise<ReviewRunRecord> {
    const stored = await this.#repository.load(runId);
    if (!stored)
      throw new Error(`Review run ${runId} was not found after save.`);
    return stored;
  }

  async #runtimeFor(runId: string): Promise<RunRuntime> {
    const existing = this.#runtimes.get(runId);
    if (existing) return existing;
    const stored = await this.#repository.load(runId);
    if (!stored) throw new Error(`Review run ${runId} was not found.`);
    const run = clonePlainData(stored);
    let compilerSession: CompilerSnapshotSession | undefined;
    if (run.compilerBinding.requested && this.#compilerProvider) {
      try {
        const requestedSnapshotId =
          run.compilerBinding.descriptor?.snapshotId ??
          run.compilerPolicy.requestedSnapshotId;
        compilerSession = await this.#openCompilerSession(
          run.frozenInput.workspaceId,
          requestedSnapshotId,
          run.limits.maxExecutionMs,
        );
        const descriptor = cloneSessionDescriptor(compilerSession);
        if (
          run.compilerBinding.descriptor &&
          (descriptor.snapshotId !==
            run.compilerBinding.descriptor.snapshotId ||
            descriptor.revision !== run.compilerBinding.descriptor.revision)
        ) {
          throw new CompilerAccessError(
            'snapshot-mismatch',
            'Reopened compiler snapshot does not match imported run history.',
          );
        }
        run.compilerBinding = { requested: true, descriptor };
      } catch (error) {
        run.compilerBinding = {
          requested: true,
          error: compilerError(error),
        };
      }
    }
    const runtime: RunRuntime = {
      run,
      ...(compilerSession ? { compilerSession } : {}),
      active: new Map(),
    };
    this.#runtimes.set(runId, runtime);
    return runtime;
  }

  async #openCompilerSession(
    workspaceId: string,
    requestedSnapshotId: string | undefined,
    maxExecutionMs: number,
  ): Promise<CompilerSnapshotSession> {
    if (!this.#compilerProvider) {
      throw new CompilerAccessError(
        'compiler-provider-not-configured',
        'No compiler provider is configured.',
      );
    }
    const controller = new AbortController();
    let rejectTimeout!: (reason: CompilerAccessError) => void;
    const timeout = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timer = this.#clock.setTimeout(() => {
      controller.abort('compiler-snapshot-open-time-limit');
      rejectTimeout(
        new CompilerAccessError(
          'compiler-snapshot-open-time-limit',
          `Compiler snapshot opening exceeded maxExecutionMs (${maxExecutionMs}).`,
        ),
      );
    }, maxExecutionMs);
    try {
      return await Promise.race([
        this.#compilerProvider.openSnapshot({
          workspaceId,
          ...(requestedSnapshotId === undefined ? {} : { requestedSnapshotId }),
          signal: controller.signal,
        }),
        timeout,
      ]);
    } finally {
      this.#clock.clearTimeout(timer);
    }
  }
}
