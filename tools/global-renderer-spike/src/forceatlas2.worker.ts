/// <reference lib="webworker" />

import {
  computeGlobalLayout,
  createGlobalLayoutFailure,
} from '@icarus-graph-explorer/renderer-sigma/layout';
import type { GlobalLayoutRequest } from '@icarus-graph-explorer/renderer-sigma/types';

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener(
  'message',
  (event: MessageEvent<GlobalLayoutRequest>) => {
    try {
      workerScope.postMessage(computeGlobalLayout(event.data));
    } catch (error: unknown) {
      workerScope.postMessage(createGlobalLayoutFailure(event.data, error));
    }
  },
);
