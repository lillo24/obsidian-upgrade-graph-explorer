/// <reference lib="webworker" />

import { handleDagreLayoutWorkerRequest } from '@icarus-graph-explorer/dagre-layout/worker-runtime';

interface DagreLayoutWorkerHost {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
}

const host: DagreLayoutWorkerHost = self;

host.onmessage = (event) => {
  host.postMessage(
    handleDagreLayoutWorkerRequest(event.data, () => performance.now()),
  );
};

export {};
