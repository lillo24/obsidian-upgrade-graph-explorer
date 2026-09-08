import { validateGlobalLayoutWorkerResponse } from '@icarus-graph-explorer/renderer-sigma/layout';
import type {
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalLayoutService,
} from '@icarus-graph-explorer/renderer-sigma/types';

export interface GlobalLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: GlobalLayoutRequest): void;
  terminate(): void;
}

export function createGlobalLayoutWorkerClient(options: {
  readonly createWorker: () => GlobalLayoutWorkerTransport;
}): GlobalLayoutService {
  let sequence = 0;
  let active:
    | {
        readonly requestId: number;
        readonly request: GlobalLayoutRequest;
        readonly resolve: (result: GlobalLayoutResult) => void;
        readonly reject: (error: Error) => void;
      }
    | undefined;
  let worker: GlobalLayoutWorkerTransport | undefined;
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
          new Error('The Global layout service is disposed.'),
        );
      }
      if (active !== undefined) {
        rejectActive('The Global layout request was superseded by newer work.');
      }
      const requestId = ++sequence;
      const completeRequest: GlobalLayoutRequest = { ...request, requestId };
      let nextWorker: GlobalLayoutWorkerTransport;
      try {
        nextWorker = options.createWorker();
      } catch (error: unknown) {
        return Promise.reject(
          new Error(
            `The Global layout worker could not start: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
      worker = nextWorker;
      return new Promise((resolve, reject) => {
        active = {
          requestId,
          request: completeRequest,
          resolve,
          reject,
        };
        nextWorker.onmessage = (event) => {
          const current = active;
          if (current === undefined || current.requestId !== requestId) return;
          let response;
          try {
            response = validateGlobalLayoutWorkerResponse(
              event.data,
              current.request,
            );
          } catch (error: unknown) {
            rejectActive(
              `The Global layout worker returned a malformed response: ${error instanceof Error ? error.message : String(error)}`,
            );
            return;
          }
          active = undefined;
          terminate();
          if (response.kind === 'error') {
            reject(
              new Error(
                `The Global layout worker failed (${response.code}): ${response.message}`,
              ),
            );
          } else resolve(response);
        };
        nextWorker.onerror = (event) => {
          rejectActive(
            `The Global layout worker failed${event.message.length === 0 ? '.' : `: ${event.message}`}`,
          );
        };
        nextWorker.onmessageerror = () => {
          rejectActive(
            'The Global layout worker response could not be deserialized.',
          );
        };
        try {
          nextWorker.postMessage(completeRequest);
        } catch (error: unknown) {
          rejectActive(
            `The Global layout request could not be sent: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rejectActive('The Global layout service was disposed.');
    },
  };
}

export function createGlobalLayoutWorkerService(): GlobalLayoutService {
  return createGlobalLayoutWorkerClient({
    createWorker: () =>
      new Worker(new URL('./global-layout.worker.ts', import.meta.url), {
        name: 'icarus-global-layout',
        type: 'module',
      }),
  });
}
