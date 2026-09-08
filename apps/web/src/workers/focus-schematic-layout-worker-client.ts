import {
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  validateFocusSchematicLayoutWorkerResponse,
  type FocusSchematicComputedLayout,
  type FocusSchematicEndpointLayoutPhaseTimings,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductLayoutPolicies,
  type FocusSchematicLayoutWorkerRequest,
} from '@icarus-graph-explorer/focus-schematic-layout';

export interface FocusSchematicLayoutWorkerMetrics {
  readonly workerComputeMs: number;
  readonly workerRoundTripMs: number;
  readonly workerStartupMs: number;
  readonly mainThreadHighGapMs?: number;
  readonly timings?: FocusSchematicEndpointLayoutPhaseTimings;
}

export type FocusSchematicLayoutWorkerResult =
  | {
      readonly status: 'success';
      readonly result: FocusSchematicComputedLayout;
      readonly metrics: FocusSchematicLayoutWorkerMetrics;
    }
  | {
      readonly status: 'failure';
      readonly message: string;
      readonly metrics: FocusSchematicLayoutWorkerMetrics;
    }
  | { readonly status: 'superseded' };

export interface FocusSchematicLayoutWorkerService {
  readonly layoutLatest: (
    input: FocusSchematicLayoutInput,
    policies?: FocusSchematicProductLayoutPolicies,
  ) => Promise<FocusSchematicLayoutWorkerResult>;
  readonly cancelPending: () => void;
  readonly dispose: () => void;
}

export interface FocusSchematicLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: FocusSchematicLayoutWorkerRequest): void;
  terminate(): void;
}

export interface FocusSchematicLayoutWorkerClientOptions {
  readonly createWorker: () => FocusSchematicLayoutWorkerTransport;
  readonly now?: () => number;
  readonly measureResponsiveness?: boolean;
}

interface ActiveLayout {
  readonly requestId: number;
  readonly input: FocusSchematicLayoutInput;
  readonly policies: FocusSchematicProductLayoutPolicies;
  readonly startedAt: number;
  readonly workerStartupMs: number;
  readonly finishResponsivenessProbe: () => number | undefined;
  readonly resolve: (result: FocusSchematicLayoutWorkerResult) => void;
}

interface WorkerState {
  readonly generation: number;
  readonly worker: FocusSchematicLayoutWorkerTransport;
}

function metrics(
  workerComputeMs: number,
  workerRoundTripMs: number,
  workerStartupMs: number,
  mainThreadHighGapMs: number | undefined,
  timings?: FocusSchematicEndpointLayoutPhaseTimings,
): FocusSchematicLayoutWorkerMetrics {
  return {
    workerComputeMs,
    workerRoundTripMs,
    workerStartupMs,
    ...(mainThreadHighGapMs === undefined ? {} : { mainThreadHighGapMs }),
    ...(timings === undefined ? {} : { timings }),
  };
}

export function createFocusSchematicLayoutWorkerClient(
  options: FocusSchematicLayoutWorkerClientOptions,
): FocusSchematicLayoutWorkerService {
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
        response = validateFocusSchematicLayoutWorkerResponse(
          event.data,
          request.requestId,
          request.input,
          request.policies,
        );
      } catch (error: unknown) {
        failTransport(
          `The Focus Schematic worker returned a malformed response: ${
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
        response.kind === 'success' ? response.timings : undefined,
      );
      request.resolve(
        response.kind === 'success'
          ? {
              status: 'success',
              result: response.result,
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
        `The Focus Schematic worker failed${
          event.message.length === 0 ? '.' : `: ${event.message}`
        }`,
      );
    };
    worker.onmessageerror = () => {
      if (workerState?.generation !== state.generation) return;
      failTransport(
        'The Focus Schematic worker response could not be deserialized.',
      );
    };
    return { state, startupMs: Math.max(0, now() - startedAt) };
  }

  return {
    layoutLatest(
      input,
      policies = DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
    ) {
      if (disposed) {
        return Promise.resolve({
          status: 'failure',
          message: 'The Focus Schematic layout service has been disposed.',
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
          message: `The Focus Schematic worker could not start: ${
            error instanceof Error ? error.message : String(error)
          }`,
          metrics: metrics(0, 0, 0, undefined),
        });
      }
      const requestId = ++requestSequence;
      const request: FocusSchematicLayoutWorkerRequest = {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId,
        kind: 'layout',
        input,
        policies,
      };
      return new Promise((resolve) => {
        const startedAt = now();
        active = {
          requestId,
          input,
          policies,
          startedAt,
          workerStartupMs: ensured.startupMs,
          finishResponsivenessProbe: createResponsivenessProbe(),
          resolve,
        };
        try {
          ensured.state.worker.postMessage(request);
        } catch (error: unknown) {
          failTransport(
            `The Focus Schematic layout request could not be sent: ${
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

export function createFocusSchematicLayoutWorkerService(): FocusSchematicLayoutWorkerService {
  return createFocusSchematicLayoutWorkerClient({
    createWorker: () =>
      new Worker(
        new URL('./focus-schematic-layout.worker.ts', import.meta.url),
        {
          name: 'icarus-focus-schematic-layout',
          type: 'module',
        },
      ),
    measureResponsiveness:
      typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('performance') === '1' ||
        import.meta.env.VITE_ICARUS_PERFORMANCE === '1'),
  });
}
