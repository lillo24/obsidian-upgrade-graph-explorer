import { validateLocalLayoutWorkerResponse } from '@icarus-graph-explorer/renderer-sigma/local-layout';
import type {
  LocalLayoutFailure,
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalLayoutService,
} from '@icarus-graph-explorer/renderer-sigma/types';

export class LocalLayoutWorkerFailureError extends Error {
  readonly code: LocalLayoutFailure['code'];
  readonly iterationsCompleted: number;
  readonly batchesCompleted: number;
  readonly finalMovement: LocalLayoutFailure['finalMovement'];

  constructor(failure: LocalLayoutFailure) {
    super(`The Local layout worker failed: ${failure.message}`);
    this.name = 'LocalLayoutWorkerFailureError';
    this.code = failure.code;
    this.iterationsCompleted = failure.iterationsCompleted;
    this.batchesCompleted = failure.batchesCompleted;
    this.finalMovement = failure.finalMovement;
  }
}

export interface LocalLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: LocalLayoutRequest): void;
  terminate(): void;
}

export function createLocalLayoutWorkerClient(options: {
  readonly createWorker: () => LocalLayoutWorkerTransport;
}): LocalLayoutService {
  let sequence = 0;
  let active:
    | {
        readonly requestId: number;
        readonly request: LocalLayoutRequest;
        readonly resolve: (result: LocalLayoutResult) => void;
        readonly reject: (error: Error) => void;
      }
    | undefined;
  let worker: LocalLayoutWorkerTransport | undefined;
  let disposed = false;

  function terminate(): void {
    if (worker === undefined) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    worker = undefined;
  }

  function rejectActive(message: string): void {
    const current = active;
    active = undefined;
    terminate();
    current?.reject(new Error(message));
  }

  return {
    layout(request) {
      if (disposed) {
        return Promise.reject(
          new Error('The Local layout service is disposed.'),
        );
      }
      if (active !== undefined) {
        rejectActive('The Local layout request was superseded by newer work.');
      }
      const requestId = ++sequence;
      const complete: LocalLayoutRequest = { ...request, requestId };
      let nextWorker: LocalLayoutWorkerTransport;
      try {
        nextWorker = options.createWorker();
      } catch (error: unknown) {
        return Promise.reject(
          new Error(
            `The Local layout worker could not start: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
      }
      worker = nextWorker;
      return new Promise((resolve, reject) => {
        active = {
          requestId,
          request: complete,
          resolve,
          reject,
        };
        nextWorker.onmessage = (event) => {
          const current = active;
          if (current === undefined || current.requestId !== requestId) return;
          let response;
          try {
            response = validateLocalLayoutWorkerResponse(
              event.data,
              current.request,
            );
          } catch (error: unknown) {
            rejectActive(
              `The Local layout worker returned a malformed response: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return;
          }
          active = undefined;
          terminate();
          if (response.kind === 'error') {
            reject(new LocalLayoutWorkerFailureError(response));
          } else resolve(response);
        };
        nextWorker.onerror = (event) => {
          rejectActive(
            `The Local layout worker failed${
              event.message.length === 0 ? '.' : `: ${event.message}`
            }`,
          );
        };
        nextWorker.onmessageerror = () => {
          rejectActive(
            'The Local layout worker response could not be deserialized.',
          );
        };
        try {
          nextWorker.postMessage(complete);
        } catch (error: unknown) {
          rejectActive(
            `The Local layout request could not be sent: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rejectActive('The Local layout service was disposed.');
    },
  };
}

export function createLocalLayoutWorkerService(): LocalLayoutService {
  return createLocalLayoutWorkerClient({
    createWorker: () =>
      new Worker(new URL('./local-layout.worker.ts', import.meta.url), {
        name: 'icarus-local-layout',
        type: 'module',
      }),
  });
}
