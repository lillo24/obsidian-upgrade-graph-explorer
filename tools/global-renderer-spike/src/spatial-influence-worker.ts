import { validateGlobalSpatialInfluenceWorkerResponse } from '@icarus-graph-explorer/renderer-sigma/spatial-influence';
import type {
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceService,
  GlobalSpatialInfluenceWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/types';

export function createHarnessSpatialInfluenceService(): GlobalSpatialInfluenceService {
  let requestId = 0;
  let active: Worker | undefined;
  let disposed = false;
  return {
    layout(request) {
      if (disposed)
        return Promise.reject(new Error('Spatial influence service disposed.'));
      active?.terminate();
      const id = ++requestId;
      const complete: GlobalSpatialInfluenceRequest = {
        ...request,
        requestId: id,
      };
      const worker = new Worker(
        new URL('./spatial-influence.worker.ts', import.meta.url),
        {
          type: 'module',
          name: 'icarus-spike-spatial-influence',
        },
      );
      active = worker;
      return new Promise((resolve, reject) => {
        const finish = () => {
          worker.terminate();
          if (active === worker) active = undefined;
        };
        worker.addEventListener('error', (event) => {
          finish();
          reject(
            new Error(`Spatial influence worker failed: ${event.message}`),
          );
        });
        worker.addEventListener(
          'message',
          (event: MessageEvent<GlobalSpatialInfluenceWorkerResponse>) => {
            if (event.data.requestId !== id || active !== worker) return;
            try {
              const response = validateGlobalSpatialInfluenceWorkerResponse(
                event.data,
                id,
                request.nodes.map(({ key }) => key),
              );
              finish();
              if (response.kind === 'error')
                reject(new Error(response.message));
              else resolve(response);
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
      active?.terminate();
      active = undefined;
    },
  };
}
