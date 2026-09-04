import { validateGlobalSpatialInfluenceWorkerResponse } from '@icarus-graph-explorer/renderer-sigma/spatial-influence';
import type {
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
  GlobalSpatialInfluenceService,
} from '@icarus-graph-explorer/renderer-sigma/types';

export interface GlobalSpatialInfluenceWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: GlobalSpatialInfluenceRequest): void;
  terminate(): void;
}

export function createGlobalSpatialInfluenceWorkerClient(options: {
  readonly createWorker: () => GlobalSpatialInfluenceWorkerTransport;
}): GlobalSpatialInfluenceService {
  let sequence = 0;
  let active:
    | {
        readonly requestId: number;
        readonly expectedNodeKeys: readonly string[];
        readonly resolve: (result: GlobalSpatialInfluenceResult) => void;
        readonly reject: (error: Error) => void;
      }
    | undefined;
  let worker: GlobalSpatialInfluenceWorkerTransport | undefined;
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
          new Error('The spatial-influence service is disposed.'),
        );
      }
      if (active !== undefined) {
        rejectActive(
          'The spatial-influence request was superseded by newer work.',
        );
      }
      const requestId = ++sequence;
      const completeRequest: GlobalSpatialInfluenceRequest = {
        ...request,
        requestId,
      };
      let nextWorker: GlobalSpatialInfluenceWorkerTransport;
      try {
        nextWorker = options.createWorker();
      } catch (error: unknown) {
        return Promise.reject(
          new Error(
            `The spatial-influence worker could not start: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
      worker = nextWorker;
      return new Promise((resolve, reject) => {
        active = {
          requestId,
          expectedNodeKeys: request.nodes.map(({ key }) => key),
          resolve,
          reject,
        };
        nextWorker.onmessage = (event) => {
          const current = active;
          if (current === undefined || current.requestId !== requestId) return;
          let response;
          try {
            response = validateGlobalSpatialInfluenceWorkerResponse(
              event.data,
              requestId,
              current.expectedNodeKeys,
            );
          } catch (error: unknown) {
            rejectActive(
              `The spatial-influence worker returned a malformed response: ${error instanceof Error ? error.message : String(error)}`,
            );
            return;
          }
          active = undefined;
          terminate();
          if (response.kind === 'error') {
            reject(
              new Error(
                `The spatial-influence worker failed: ${response.message}`,
              ),
            );
          } else resolve(response);
        };
        nextWorker.onerror = (event) => {
          rejectActive(
            `The spatial-influence worker failed${event.message.length === 0 ? '.' : `: ${event.message}`}`,
          );
        };
        nextWorker.onmessageerror = () => {
          rejectActive(
            'The spatial-influence response could not be deserialized.',
          );
        };
        try {
          nextWorker.postMessage(completeRequest);
        } catch (error: unknown) {
          rejectActive(
            `The spatial-influence request could not be sent: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      rejectActive('The spatial-influence service was disposed.');
    },
  };
}

export function createGlobalSpatialInfluenceWorkerService(): GlobalSpatialInfluenceService {
  return createGlobalSpatialInfluenceWorkerClient({
    createWorker: () =>
      new Worker(
        new URL('./global-spatial-influence.worker.ts', import.meta.url),
        {
          name: 'icarus-global-spatial-influence',
          type: 'module',
        },
      ),
  });
}
