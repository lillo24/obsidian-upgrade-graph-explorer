/// <reference lib="webworker" />

import {
  computeGlobalLayout,
  createGlobalLayoutFailure,
} from '@icarus-graph-explorer/renderer-sigma/layout';
import type {
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
    host.postMessage(createGlobalLayoutFailure(event.data, error));
  }
};

export {};
