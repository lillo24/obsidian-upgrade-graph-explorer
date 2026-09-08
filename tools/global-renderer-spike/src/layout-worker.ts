import { validateGlobalLayoutWorkerResponse } from '@icarus-graph-explorer/renderer-sigma/layout';
import type {
  GlobalLayoutRequest,
  GlobalLayoutService,
  GlobalLayoutWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/types';

export function createHarnessGlobalLayoutService(): GlobalLayoutService {
  let requestId = 0;
  let disposed = false;
  return {
    layout(request) {
      if (disposed)
        return Promise.reject(new Error('Layout service disposed.'));
      const id = ++requestId;
      const complete: GlobalLayoutRequest = { ...request, requestId: id };
      const worker = new Worker(
        new URL('./forceatlas2.worker.ts', import.meta.url),
        { type: 'module', name: 'icarus-global-forceatlas2' },
      );
      return new Promise((resolve, reject) => {
        const finish = () => worker.terminate();
        worker.addEventListener('error', (event) => {
          finish();
          reject(new Error(`Global layout worker failed: ${event.message}`));
        });
        worker.addEventListener(
          'message',
          (event: MessageEvent<GlobalLayoutWorkerResponse>) => {
            if (event.data.requestId !== id) return;
            try {
              const response = validateGlobalLayoutWorkerResponse(
                event.data,
                complete,
              );
              finish();
              if (response.kind === 'error') {
                reject(new Error(response.message));
              } else resolve(response);
            } catch (error: unknown) {
              finish();
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
        );
        worker.postMessage(complete);
      });
    },
    dispose() {
      disposed = true;
    },
  };
}
