/// <reference lib="webworker" />

import { computeLocalLayout } from '@icarus-graph-explorer/renderer-sigma/local-layout';
import type {
  LocalLayoutFailure,
  LocalLayoutRequest,
  LocalLayoutWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/types';

interface LocalLayoutWorkerHost {
  onmessage: ((event: MessageEvent<LocalLayoutRequest>) => void) | null;
  postMessage(message: LocalLayoutWorkerResponse): void;
}

const host: LocalLayoutWorkerHost = self;

host.onmessage = (event) => {
  try {
    host.postMessage(computeLocalLayout(event.data));
  } catch (error: unknown) {
    const response: LocalLayoutFailure = {
      schemaVersion: 1,
      kind: 'error',
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    host.postMessage(response);
  }
};

export {};
