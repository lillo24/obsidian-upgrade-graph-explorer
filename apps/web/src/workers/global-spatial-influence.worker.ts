/// <reference lib="webworker" />

import { computeGlobalSpatialInfluence } from '@icarus-graph-explorer/renderer-sigma/spatial-influence';
import type {
  GlobalSpatialInfluenceFailure,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceWorkerResponse,
} from '@icarus-graph-explorer/renderer-sigma/types';

interface GlobalSpatialInfluenceWorkerHost {
  onmessage:
    ((event: MessageEvent<GlobalSpatialInfluenceRequest>) => void) | null;
  postMessage(message: GlobalSpatialInfluenceWorkerResponse): void;
}

const host: GlobalSpatialInfluenceWorkerHost = self;

host.onmessage = (event) => {
  try {
    host.postMessage(computeGlobalSpatialInfluence(event.data));
  } catch (error: unknown) {
    const response: GlobalSpatialInfluenceFailure = {
      schemaVersion: 1,
      kind: 'error',
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : String(error),
    };
    host.postMessage(response);
  }
};

export {};
