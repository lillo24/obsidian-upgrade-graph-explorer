import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  type WorkspaceWorkerResponse,
  type WorkspaceWorkerTransportRequest,
} from '@icarus-graph-explorer/workspace-worker';

import {
  createWorkspaceWorkerClient,
  type WorkspaceWorkerTransport,
} from './workspace-worker-client';

class FakeWorker implements WorkspaceWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly requests: WorkspaceWorkerTransportRequest[] = [];
  terminateCalls = 0;

  postMessage(message: WorkspaceWorkerTransportRequest): void {
    this.requests.push(message);
  }

  terminate(): void {
    this.terminateCalls += 1;
  }

  respond(response: WorkspaceWorkerResponse | unknown): void {
    this.onmessage?.({ data: response } as MessageEvent<unknown>);
  }
}

function acknowledgement(
  request: WorkspaceWorkerTransportRequest,
  kind: 'candidate-committed' | 'candidate-discarded',
  revision: number | null,
): WorkspaceWorkerResponse {
  if (
    request.kind !== 'commit-candidate' &&
    request.kind !== 'discard-candidate'
  ) {
    throw new Error('Expected candidate request.');
  }
  return {
    protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
    requestId: request.requestId,
    kind,
    candidateId: request.candidateId,
    revision,
  };
}

describe('workspace worker client transport', () => {
  it('correlates out-of-order request IDs to the correct promise', async () => {
    const worker = new FakeWorker();
    const client = createWorkspaceWorkerClient(worker);
    const first = client.discardCandidate('candidate-a');
    const second = client.discardCandidate('candidate-b');
    const [firstRequest, secondRequest] = worker.requests;
    if (firstRequest === undefined || secondRequest === undefined)
      throw new Error('Expected two requests.');

    worker.respond(acknowledgement(secondRequest, 'candidate-discarded', 7));
    worker.respond(acknowledgement(firstRequest, 'candidate-discarded', 6));

    await expect(first).resolves.toBe(6);
    await expect(second).resolves.toBe(7);
    expect(firstRequest.requestId).not.toBe(secondRequest.requestId);
  });

  it('fails explicitly on a malformed response and rejects every pending request', async () => {
    const worker = new FakeWorker();
    const client = createWorkspaceWorkerClient(worker);
    const first = client.discardCandidate('candidate-a');
    const second = client.discardCandidate('candidate-b');

    worker.respond({ kind: 'not-a-protocol-response' });

    await expect(first).rejects.toMatchObject({
      category: 'protocol',
      code: 'malformed-response',
    });
    await expect(second).rejects.toMatchObject({
      category: 'protocol',
      code: 'malformed-response',
    });
    expect(worker.terminateCalls).toBe(1);
  });

  it('rejects pending requests on worker error and messageerror', async () => {
    const errorWorker = new FakeWorker();
    const errorClient = createWorkspaceWorkerClient(errorWorker);
    const failed = errorClient.discardCandidate('candidate-a');
    errorWorker.onerror?.({ message: 'worker boom' } as ErrorEvent);
    await expect(failed).rejects.toMatchObject({
      category: 'transport',
      code: 'worker-error',
    });

    const messageWorker = new FakeWorker();
    const messageClient = createWorkspaceWorkerClient(messageWorker);
    const malformed = messageClient.discardCandidate('candidate-b');
    messageWorker.onmessageerror?.({ data: undefined } as MessageEvent);
    await expect(malformed).rejects.toMatchObject({
      category: 'transport',
      code: 'worker-message-error',
    });
  });

  it('terminate rejects all pending work and ignores late responses', async () => {
    const worker = new FakeWorker();
    const client = createWorkspaceWorkerClient(worker);
    const pending = client.discardCandidate('candidate-a');
    const request = worker.requests[0];
    if (request === undefined) throw new Error('Expected one request.');

    client.terminate();
    await expect(pending).rejects.toMatchObject({
      category: 'terminated',
      code: 'processor-terminated',
    });
    worker.respond(acknowledgement(request, 'candidate-discarded', 0));
    await expect(client.discardCandidate('candidate-b')).rejects.toMatchObject({
      category: 'terminated',
    });
    expect(worker.terminateCalls).toBe(1);
  });

  it('turns synchronous postMessage failure into a fatal transport error', async () => {
    const worker = new FakeWorker();
    worker.postMessage = () => {
      throw new Error('clone failed');
    };
    const client = createWorkspaceWorkerClient(worker);

    await expect(client.discardCandidate('candidate-a')).rejects.toMatchObject({
      category: 'transport',
      code: 'post-message-failed',
    });
    expect(worker.terminateCalls).toBe(1);
  });
});
