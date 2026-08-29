import { parentPort } from 'node:worker_threads';

import {
  chunkWorkspaceWorkerResponse,
  createWorkspaceWorkerRequestAssembler,
  createWorkspaceWorkerRuntime,
} from '@icarus-graph-explorer/workspace-worker';

const port = parentPort;
if (port === null) {
  throw new Error(
    'The workspace-worker benchmark entry requires a worker thread.',
  );
}

const runtime = createWorkspaceWorkerRuntime();
const requestAssembler = createWorkspaceWorkerRequestAssembler();
port.on('message', async (request: unknown) => {
  const assembly = requestAssembler.accept(request);
  if (assembly.status === 'pending') return;
  const assembledRequest =
    assembly.status === 'complete'
      ? assembly.request
      : {
          protocolVersion: 1,
          requestId: assembly.requestId,
          kind: 'invalid-chunked-request',
        };
  const frames = chunkWorkspaceWorkerResponse(runtime.handle(assembledRequest));
  for (let index = 0; index < frames.length; index += 1) {
    port.postMessage(frames[index]);
    if (index + 1 < frames.length) {
      await new Promise<void>((continueSending) =>
        setTimeout(continueSending, 1),
      );
    }
  }
});
