import { parentPort, workerData } from 'node:worker_threads';

import { handleFocusSchematicLayoutWorkerRequest } from '@icarus-graph-explorer/focus-schematic-layout/worker-runtime';

parentPort?.postMessage(
  handleFocusSchematicLayoutWorkerRequest(workerData, () => performance.now()),
);
