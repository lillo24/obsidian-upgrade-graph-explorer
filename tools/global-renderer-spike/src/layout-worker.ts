import type { GlobalGraph } from './graph';
import type {
  ForceAtlas2WorkerRequest,
  ForceAtlas2WorkerResponse,
} from './forceatlas2-protocol';

export interface ForceAtlas2WorkerResult {
  readonly computeMs: number;
  readonly roundTripMs: number;
}

let nextRequestId = 1;

export function runForceAtlas2Worker(
  graph: GlobalGraph,
  iterations: number,
): Promise<ForceAtlas2WorkerResult> {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('ForceAtlas2 iterations must be a positive integer.');
  }
  const worker = new Worker(
    new URL('./forceatlas2.worker.ts', import.meta.url),
    {
      type: 'module',
      name: 'icarus-global-forceatlas2',
    },
  );
  const requestId = nextRequestId;
  nextRequestId += 1;
  const request: ForceAtlas2WorkerRequest = {
    kind: 'layout',
    requestId,
    iterations,
    nodes: graph.mapNodes((key, attributes) => ({
      key,
      x: attributes.x,
      y: attributes.y,
      size: attributes.size,
    })),
    edges: graph.mapEdges((key, attributes, source, target) => ({
      key,
      source,
      target,
      weight: Math.max(1, attributes.referenceCount),
    })),
  };
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const finish = () => worker.terminate();
    worker.addEventListener('error', (event) => {
      finish();
      reject(new Error(`ForceAtlas2 worker failed: ${event.message}`));
    });
    worker.addEventListener(
      'message',
      (event: MessageEvent<ForceAtlas2WorkerResponse>) => {
        const response = event.data;
        if (response.requestId !== requestId) return;
        finish();
        if (response.kind === 'error') {
          reject(new Error(`ForceAtlas2 worker failed: ${response.message}`));
          return;
        }
        const positions = new Map(
          response.positions.map((position) => [position.key, position]),
        );
        graph.updateEachNodeAttributes(
          (key, attributes) => {
            const position = positions.get(key);
            if (position === undefined) {
              throw new Error(`ForceAtlas2 result omitted node ${key}.`);
            }
            return { ...attributes, x: position.x, y: position.y };
          },
          { attributes: ['x', 'y'] },
        );
        resolve({
          computeMs: response.computeMs,
          roundTripMs: Number((performance.now() - start).toFixed(3)),
        });
      },
    );
    worker.postMessage(request);
  });
}
