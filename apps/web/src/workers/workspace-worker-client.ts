import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  WorkspaceProcessorError,
  chunkWorkspaceWorkerRequest,
  createWorkspaceWorkerResponseAssembler,
  type BuildCommittedReportInput,
  type DesktopWorkspaceProcessor,
  type PrepareChangesInput,
  type PrepareInitializeInput,
  type PrepareResyncInput,
  type WorkspaceWorkerRequest,
  type WorkspaceWorkerRequestPayload,
  type WorkspaceWorkerResponse,
  type WorkspaceWorkerTransportRequest,
} from '@icarus-graph-explorer/workspace-worker';

export interface WorkspaceWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkspaceWorkerTransportRequest): void;
  terminate(): void;
}

interface PendingRequest {
  readonly startedAt: number;
  readonly finishResponsivenessProbe: () => number | undefined;
  readonly resolve: (response: WorkspaceWorkerResponse) => void;
  readonly reject: (error: WorkspaceProcessorError) => void;
}

function processorError(
  category: 'protocol' | 'transport' | 'terminated',
  code: string,
  message: string,
): WorkspaceProcessorError {
  return new WorkspaceProcessorError({
    protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
    requestId: 'client',
    kind: 'failure',
    category,
    code,
    message,
  });
}

export function createWorkspaceWorkerClient(
  worker: WorkspaceWorkerTransport,
  now: () => number = () => performance.now(),
  measureResponsiveness = false,
): DesktopWorkspaceProcessor {
  let requestSequence = 0;
  let disposed = false;
  const pending = new Map<string, PendingRequest>();
  const responseAssembler = createWorkspaceWorkerResponseAssembler();

  function rejectAll(error: WorkspaceProcessorError): void {
    for (const request of pending.values()) {
      request.finishResponsivenessProbe();
      request.reject(error);
    }
    pending.clear();
  }

  function failTransport(error: WorkspaceProcessorError): void {
    if (disposed) return;
    disposed = true;
    worker.terminate();
    responseAssembler.clear();
    rejectAll(error);
  }

  worker.onmessage = (event) => {
    if (disposed) return;
    const assembly = responseAssembler.accept(event.data);
    if (assembly.status === 'invalid') {
      failTransport(
        processorError('protocol', 'malformed-response', assembly.message),
      );
      return;
    }
    if (assembly.status === 'pending') return;
    const response = assembly.response;
    const request = pending.get(response.requestId);
    if (request === undefined) return;
    pending.delete(response.requestId);
    const mainThreadHighGapMs = request.finishResponsivenessProbe();
    if (response.kind === 'failure') {
      request.reject(new WorkspaceProcessorError(response));
      return;
    }
    const workerRoundTripMs = Number(
      Math.max(0, now() - request.startedAt).toFixed(3),
    );
    if (response.kind === 'prepared') {
      request.resolve({
        ...response,
        prepared: {
          ...response.prepared,
          timings: {
            ...response.prepared.timings,
            workerRoundTripMs,
            ...(mainThreadHighGapMs === undefined
              ? {}
              : { mainThreadHighGapMs }),
          },
        },
      });
      return;
    }
    if (response.kind === 'committed-report') {
      request.resolve({
        ...response,
        timings: {
          ...response.timings,
          workerRoundTripMs,
          ...(mainThreadHighGapMs === undefined ? {} : { mainThreadHighGapMs }),
        },
      });
      return;
    }
    request.resolve(response);
  };
  worker.onerror = (event) => {
    failTransport(
      processorError(
        'transport',
        'worker-error',
        `The workspace worker failed${
          event.message.length === 0 ? '.' : `: ${event.message}`
        }`,
      ),
    );
  };
  worker.onmessageerror = () => {
    failTransport(
      processorError(
        'transport',
        'worker-message-error',
        'The workspace worker response could not be deserialized.',
      ),
    );
  };

  function send(
    request: WorkspaceWorkerRequestPayload,
  ): Promise<WorkspaceWorkerResponse> {
    if (disposed) {
      return Promise.reject(
        processorError(
          'terminated',
          'processor-terminated',
          'The workspace processor has been terminated.',
        ),
      );
    }
    const requestId = `workspace-${++requestSequence}`;
    let maximumGapMs = 0;
    let lastProbeAt = now();
    let probeTimer: ReturnType<typeof setTimeout> | undefined;
    let probeFinished = false;
    const probe = () => {
      const current = now();
      maximumGapMs = Math.max(maximumGapMs, current - lastProbeAt);
      lastProbeAt = current;
      probeTimer = setTimeout(probe, 16);
    };
    if (measureResponsiveness) probeTimer = setTimeout(probe, 16);
    const finishResponsivenessProbe = () => {
      if (probeFinished || !measureResponsiveness) return undefined;
      probeFinished = true;
      if (probeTimer !== undefined) clearTimeout(probeTimer);
      maximumGapMs = Math.max(maximumGapMs, now() - lastProbeAt);
      return Number(maximumGapMs.toFixed(3));
    };
    return new Promise((resolve, reject) => {
      pending.set(requestId, {
        startedAt: now(),
        finishResponsivenessProbe,
        resolve,
        reject,
      });
      const protocolRequest = {
        ...request,
        protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
        requestId,
      } as WorkspaceWorkerRequest;
      void (async () => {
        try {
          const frames = chunkWorkspaceWorkerRequest(protocolRequest);
          for (let index = 0; index < frames.length; index += 1) {
            if (disposed) return;
            worker.postMessage(frames[index]!);
            if (index + 1 < frames.length) {
              await new Promise<void>((continueSending) =>
                setTimeout(continueSending, 0),
              );
            }
          }
        } catch (error: unknown) {
          const transportError = processorError(
            'transport',
            'post-message-failed',
            `The workspace worker request could not be sent: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          failTransport(transportError);
        }
      })();
    });
  }

  return {
    async prepareInitialize(input: PrepareInitializeInput) {
      const response = await send({ kind: 'prepare-initialize', input });
      if (response.kind !== 'prepared')
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a prepared response.',
        );
      return response.prepared;
    },
    async prepareChanges(input: PrepareChangesInput) {
      const response = await send({ kind: 'prepare-changes', input });
      if (response.kind !== 'prepared')
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a prepared response.',
        );
      return response.prepared;
    },
    async prepareResync(input: PrepareResyncInput) {
      const response = await send({ kind: 'prepare-resync', input });
      if (response.kind !== 'prepared')
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a prepared response.',
        );
      return response.prepared;
    },
    async buildCommittedReport(input: BuildCommittedReportInput) {
      const response = await send({ kind: 'build-committed-report', input });
      if (response.kind !== 'committed-report')
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a committed report response.',
        );
      return {
        revision: response.revision,
        report: response.report,
        timings: response.timings,
      };
    },
    async commitCandidate(candidateId) {
      const response = await send({ kind: 'commit-candidate', candidateId });
      if (response.kind !== 'candidate-committed' || response.revision === null)
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a candidate commit acknowledgement.',
        );
      return response.revision;
    },
    async discardCandidate(candidateId) {
      const response = await send({ kind: 'discard-candidate', candidateId });
      if (response.kind !== 'candidate-discarded')
        throw processorError(
          'protocol',
          'unexpected-response',
          'Expected a candidate discard acknowledgement.',
        );
      return response.revision;
    },
    terminate() {
      if (disposed) return;
      disposed = true;
      worker.terminate();
      responseAssembler.clear();
      rejectAll(
        processorError(
          'terminated',
          'processor-terminated',
          'The workspace processor has been terminated.',
        ),
      );
    },
  };
}

export function createDesktopWorkspaceProcessor(): DesktopWorkspaceProcessor {
  const worker = new Worker(new URL('./workspace.worker.ts', import.meta.url), {
    name: 'icarus-workspace',
    type: 'module',
  });
  const measureResponsiveness =
    new URLSearchParams(window.location.search).get('performance') === '1' ||
    import.meta.env.VITE_ICARUS_PERFORMANCE === '1';
  return createWorkspaceWorkerClient(
    worker,
    () => performance.now(),
    measureResponsiveness,
  );
}
