import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateDagreLayoutWorkerResponse,
  type DagreLayoutInput,
  type DagreLayoutWorkerRequest,
} from '@icarus-graph-explorer/dagre-layout';
import type {
  GraphLayoutMetrics,
  GraphLayoutResult,
  GraphLayoutService,
} from '@icarus-graph-explorer/renderer-reactflow';

export interface DagreLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: DagreLayoutWorkerRequest): void;
  terminate(): void;
}

export interface DagreLayoutWorkerClientOptions {
  readonly createWorker: () => DagreLayoutWorkerTransport;
  readonly now?: () => number;
  readonly measureResponsiveness?: boolean;
}

interface ActiveLayout {
  readonly requestId: number;
  readonly input: DagreLayoutInput;
  readonly startedAt: number;
  readonly workerStartupMs: number;
  readonly finishResponsivenessProbe: () => number | undefined;
  readonly resolve: (result: GraphLayoutResult) => void;
}

interface WorkerState {
  readonly generation: number;
  readonly worker: DagreLayoutWorkerTransport;
}

function metrics(
  workerComputeMs: number,
  workerRoundTripMs: number,
  workerStartupMs: number,
  mainThreadHighGapMs: number | undefined,
): GraphLayoutMetrics {
  return {
    workerComputeMs,
    workerRoundTripMs,
    workerStartupMs,
    ...(mainThreadHighGapMs === undefined ? {} : { mainThreadHighGapMs }),
  };
}

export function createDagreLayoutWorkerClient(
  options: DagreLayoutWorkerClientOptions,
): GraphLayoutService {
  const now = options.now ?? (() => performance.now());
  let requestSequence = 0;
  let workerGeneration = 0;
  let workerState: WorkerState | null = null;
  let active: ActiveLayout | null = null;
  let disposed = false;

  function finishActiveAsSuperseded(): void {
    const request = active;
    if (request === null) return;
    active = null;
    request.finishResponsivenessProbe();
    request.resolve({ status: 'superseded' });
  }

  function terminateWorker(): void {
    const state = workerState;
    workerState = null;
    if (state === null) return;
    state.worker.onmessage = null;
    state.worker.onerror = null;
    state.worker.onmessageerror = null;
    state.worker.terminate();
  }

  function failTransport(message: string): void {
    const request = active;
    active = null;
    terminateWorker();
    if (request === null) return;
    request.resolve({
      status: 'failure',
      message,
      metrics: metrics(
        0,
        Math.max(0, now() - request.startedAt),
        request.workerStartupMs,
        request.finishResponsivenessProbe(),
      ),
    });
  }

  function ensureWorker(): {
    readonly state: WorkerState;
    readonly startupMs: number;
  } {
    if (workerState !== null) return { state: workerState, startupMs: 0 };
    const startedAt = now();
    const worker = options.createWorker();
    const state = { generation: ++workerGeneration, worker };
    workerState = state;
    worker.onmessage = (event) => {
      if (disposed || workerState?.generation !== state.generation) return;
      const request = active;
      if (request === null) return;
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'requestId' in event.data &&
        event.data.requestId !== request.requestId
      ) {
        return;
      }
      let response;
      try {
        response = validateDagreLayoutWorkerResponse(
          event.data,
          request.requestId,
          request.input,
        );
      } catch (error: unknown) {
        failTransport(
          `The Dagre worker returned a malformed response: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
      active = null;
      const responseMetrics = metrics(
        response.computeMs,
        Math.max(0, now() - request.startedAt),
        request.workerStartupMs,
        request.finishResponsivenessProbe(),
      );
      request.resolve(
        response.kind === 'success'
          ? {
              status: 'success',
              output: response.output,
              metrics: responseMetrics,
            }
          : {
              status: 'failure',
              message: response.message,
              metrics: responseMetrics,
            },
      );
    };
    worker.onerror = (event) => {
      if (workerState?.generation !== state.generation) return;
      failTransport(
        `The Dagre worker failed${
          event.message.length === 0 ? '.' : `: ${event.message}`
        }`,
      );
    };
    worker.onmessageerror = () => {
      if (workerState?.generation !== state.generation) return;
      failTransport('The Dagre worker response could not be deserialized.');
    };
    return { state, startupMs: Math.max(0, now() - startedAt) };
  }

  function createResponsivenessProbe(): () => number | undefined {
    if (options.measureResponsiveness !== true) return () => undefined;
    let finished = false;
    let lastProbeAt = now();
    let maximumGapMs = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const probe = () => {
      const current = now();
      maximumGapMs = Math.max(maximumGapMs, current - lastProbeAt);
      lastProbeAt = current;
      timer = setTimeout(probe, 16);
    };
    timer = setTimeout(probe, 16);
    return () => {
      if (finished) return undefined;
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      maximumGapMs = Math.max(maximumGapMs, now() - lastProbeAt);
      return Number(maximumGapMs.toFixed(3));
    };
  }

  return {
    layoutLatest(input) {
      if (disposed) {
        return Promise.resolve({
          status: 'failure',
          message: 'The Dagre layout service has been disposed.',
          metrics: metrics(0, 0, 0, undefined),
        });
      }
      if (active !== null) {
        finishActiveAsSuperseded();
        terminateWorker();
      }
      let ensured;
      try {
        ensured = ensureWorker();
      } catch (error: unknown) {
        return Promise.resolve({
          status: 'failure',
          message: `The Dagre worker could not start: ${
            error instanceof Error ? error.message : String(error)
          }`,
          metrics: metrics(0, 0, 0, undefined),
        });
      }
      const requestId = ++requestSequence;
      const request: DagreLayoutWorkerRequest = {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId,
        kind: 'layout',
        input,
      };
      return new Promise((resolve) => {
        const startedAt = now();
        active = {
          requestId,
          input,
          startedAt,
          workerStartupMs: ensured.startupMs,
          finishResponsivenessProbe: createResponsivenessProbe(),
          resolve,
        };
        try {
          ensured.state.worker.postMessage(request);
        } catch (error: unknown) {
          failTransport(
            `The Dagre layout request could not be sent: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });
    },
    cancelPending() {
      if (active === null) return;
      finishActiveAsSuperseded();
      terminateWorker();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      finishActiveAsSuperseded();
      terminateWorker();
    },
  };
}

export function createDagreLayoutWorkerService(): GraphLayoutService {
  return createDagreLayoutWorkerClient({
    createWorker: () =>
      new Worker(new URL('./dagre-layout.worker.ts', import.meta.url), {
        name: 'icarus-dagre-layout',
        type: 'module',
      }),
    measureResponsiveness:
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('performance') === '1' ||
        import.meta.env.VITE_ICARUS_PERFORMANCE === '1'),
  });
}
