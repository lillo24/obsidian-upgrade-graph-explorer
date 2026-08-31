/// <reference lib="webworker" />

import { computeGlobalLayout } from '@icarus-graph-explorer/renderer-sigma/layout';
import type {
  GlobalLayoutFailure,
  GlobalLayoutRequest,
  GlobalLayoutWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/types';

interface GlobalLayoutWorkerHost {
  onmessage: ((event: MessageEvent<GlobalLayoutRequest>) => void) | null;
  postMessage(message: GlobalLayoutWorkerResponse): void;
}

const host: GlobalLayoutWorkerHost = self;

host.onmessage = (event) => {
  try {
    host.postMessage(computeGlobalLayout(event.data));
  } catch (error: unknown) {
    const response: GlobalLayoutFailure = {
      schemaVersion: 1,
      kind: 'error',
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    host.postMessage(response);
  }
};

export {};
