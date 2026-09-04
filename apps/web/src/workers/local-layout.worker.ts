/// <reference lib="webworker" />

import {
  computeLocalLayout,
  createLocalLayoutFailure,
} from '@icarus-graph-explorer/renderer-sigma/local-layout';
import type {
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
    host.postMessage(createLocalLayoutFailure(event.data, error));
  }
};

export {};
