/// <reference lib="webworker" />

import { computeGlobalLayout } from '@icarus-graph-explorer/renderer-sigma/layout';
import type {
  GlobalLayoutFailure,
  GlobalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/types';

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener(
  'message',
  (event: MessageEvent<GlobalLayoutRequest>) => {
    try {
      workerScope.postMessage(computeGlobalLayout(event.data));
    } catch (error: unknown) {
      const response: GlobalLayoutFailure = {
        schemaVersion: 1,
        kind: 'error',
        requestId: event.data.requestId,
        message: error instanceof Error ? error.message : String(error),
      };
      workerScope.postMessage(response);
    }
  },
);
