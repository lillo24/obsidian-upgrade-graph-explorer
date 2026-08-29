/// <reference lib="webworker" />

import {
  chunkWorkspaceWorkerResponse,
  createWorkspaceWorkerRequestAssembler,
  createWorkspaceWorkerRuntime,
  type WorkspaceWorkerTransportResponse,
} from '@icarus-graph-explorer/workspace-worker';

interface WorkspaceWorkerHost {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkspaceWorkerTransportResponse): void;
}

const host: WorkspaceWorkerHost = self;
const runtime = createWorkspaceWorkerRuntime();
const requestAssembler = createWorkspaceWorkerRequestAssembler();

host.onmessage = async (event) => {
  const assembly = requestAssembler.accept(event.data);
  if (assembly.status === 'pending') return;
  const request =
    assembly.status === 'complete'
      ? assembly.request
      : {
          protocolVersion: 1,
          requestId: assembly.requestId,
          kind: 'invalid-chunked-request',
        };
  const frames = chunkWorkspaceWorkerResponse(runtime.handle(request));
  for (let index = 0; index < frames.length; index += 1) {
    host.postMessage(frames[index]!);
    if (index + 1 < frames.length) {
      await new Promise<void>((continueSending) =>
        setTimeout(continueSending, 0),
      );
    }
  }
};

export {};
