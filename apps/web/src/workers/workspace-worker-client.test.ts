import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  chunkWorkspaceWorkerResponse,
  createWorkspaceWorkerRequestAssembler,
  createWorkspaceWorkerRuntime,
  type PrepareInitializeInput,
  type WorkspaceWorkerResponse,
  type WorkspaceWorkerTransportRequest,
  type WorkspaceWorkerTransportScheduler,
} from '@icarus-graph-explorer/workspace-worker';
import { createStableIdentityCatalog } from '@icarus-graph-explorer/stable-identity';

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

class ControlledScheduler implements WorkspaceWorkerTransportScheduler {
  readonly kind = 'message-channel';
  readonly continuations: Array<() => void> = [];
  disposed = false;

  yieldToNextTask(): Promise<void> {
    return new Promise((resolve) => this.continuations.push(resolve));
  }

  releaseNext(): void {
    this.continuations.shift()?.();
  }

  dispose(): void {
    this.disposed = true;
    for (const continuation of this.continuations.splice(0)) continuation();
  }
}

function initializeInput(documentCount: number): PrepareInitializeInput {
  return {
    workspaceId: 'worker-client-test',
    documents: Array.from({ length: documentCount }, (_, index) => ({
      path: `Note-${index}.md`,
      source: `# Note ${index}\n`,
    })),
    identityCatalog: createStableIdentityCatalog('worker-client-test'),
    nonMarkdownPaths: [],
  };
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
  it('sends every request frame in order and reconstructs the exact payload', async () => {
    const worker = new FakeWorker();
    const scheduler = new ControlledScheduler();
    const client = createWorkspaceWorkerClient(
      worker,
      undefined,
      false,
      scheduler,
    );
    const input = initializeInput(130);
    const opening = client.prepareInitialize(input);

    while (worker.requests.at(-1)?.kind !== 'chunked-request-end') {
      expect(scheduler.continuations).toHaveLength(1);
      scheduler.releaseNext();
      await Promise.resolve();
    }

    const assembler = createWorkspaceWorkerRequestAssembler();
    let reconstructed: unknown;
    for (const frame of worker.requests) {
      const result = assembler.accept(structuredClone(frame));
      if (result.status === 'complete') reconstructed = result.request;
    }
    expect(reconstructed).toMatchObject({
      kind: 'prepare-initialize',
      input,
    });

    client.terminate();
    await expect(opening).rejects.toMatchObject({ category: 'terminated' });
  });

  it('assembles an ordered multi-frame response without changing its payload', async () => {
    const worker = new FakeWorker();
    const client = createWorkspaceWorkerClient(worker, () => 100);
    const input = initializeInput(3);
    const opening = client.prepareInitialize(input);
    const sent = worker.requests[0];
    if (sent?.kind !== 'prepare-initialize') {
      throw new Error('Expected an unchunked initialize request.');
    }
    const response = createWorkspaceWorkerRuntime().handle(sent);
    if (response.kind !== 'prepared') {
      throw new Error('Expected the runtime to prepare the request.');
    }

    for (const frame of chunkWorkspaceWorkerResponse(response, {
      chunkSize: 1,
      threshold: 1,
    })) {
      worker.respond(structuredClone(frame));
    }

    const prepared = await opening;
    expect(prepared.report).toEqual(response.prepared.report);
    expect(prepared.nextIdentityCatalog).toEqual(
      response.prepared.nextIdentityCatalog,
    );
    client.terminate();
  });

  it('stops a multi-frame request immediately when terminated', async () => {
    const worker = new FakeWorker();
    const scheduler = new ControlledScheduler();
    const client = createWorkspaceWorkerClient(
      worker,
      undefined,
      false,
      scheduler,
    );
    const opening = client.prepareInitialize(initializeInput(130));
    expect(worker.requests).toHaveLength(1);

    client.terminate();
    await expect(opening).rejects.toMatchObject({
      category: 'terminated',
      code: 'processor-terminated',
    });
    await Promise.resolve();
    expect(worker.requests).toHaveLength(1);
    expect(scheduler.disposed).toBe(true);
  });

  it('fails the transport if a later request frame cannot be posted', async () => {
    const worker = new FakeWorker();
    const scheduler = new ControlledScheduler();
    const originalPostMessage = worker.postMessage.bind(worker);
    worker.postMessage = (message) => {
      if (worker.requests.length === 1) throw new Error('later clone failed');
      originalPostMessage(message);
    };
    const client = createWorkspaceWorkerClient(
      worker,
      undefined,
      false,
      scheduler,
    );
    const opening = client.prepareInitialize(initializeInput(130));

    scheduler.releaseNext();

    await expect(opening).rejects.toMatchObject({
      category: 'transport',
      code: 'post-message-failed',
    });
    expect(worker.requests).toHaveLength(1);
    expect(worker.terminateCalls).toBe(1);
  });

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
