import { parentPort } from 'node:worker_threads';

import { handleDagreLayoutWorkerRequest } from '@icarus-graph-explorer/dagre-layout/worker-runtime';

const port = parentPort;
if (port === null) {
  throw new Error('The Dagre benchmark entry requires a worker thread.');
}

port.on('message', (request: unknown) => {
  port.postMessage(
    handleDagreLayoutWorkerRequest(request, () => performance.now()),
  );
});
