import { handleFocusSchematicLayoutWorkerRequest } from '@icarus-graph-explorer/focus-schematic-layout/worker-runtime';

self.onmessage = (event: MessageEvent<unknown>) => {
  self.postMessage(
    handleFocusSchematicLayoutWorkerRequest(event.data, () =>
      performance.now(),
    ),
  );
};
