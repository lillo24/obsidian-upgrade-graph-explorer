import { describe, expect, it } from 'vitest';

import {
  DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
  type DagreLayoutInput,
  type DagreLayoutWorkerRequest,
} from '@icarus-graph-explorer/dagre-layout';

import {
  createDagreLayoutWorkerClient,
  type DagreLayoutWorkerTransport,
} from './dagre-layout-worker-client';

const input: DagreLayoutInput = {
  mode: 'structure',
  nodes: [{ id: 'a', width: 100, height: 60 }],
  edges: [],
};

class FakeWorker implements DagreLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly requests: DagreLayoutWorkerRequest[] = [];
  terminated = false;
  postError: Error | null = null;

  postMessage(message: DagreLayoutWorkerRequest): void {
    if (this.postError !== null) throw this.postError;
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  succeed(index = this.requests.length - 1): void {
    const request = this.requests[index]!;
    this.onmessage?.({
      data: {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'success',
        output: { positions: [{ id: 'a', x: 10, y: 20 }] },
        computeMs: 5,
      },
    } as MessageEvent<unknown>);
  }

  failComputation(): void {
    const request = this.requests.at(-1)!;
    this.onmessage?.({
      data: {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'failure',
        code: 'computation-failed',
        message: 'synthetic computation failure',
        computeMs: 4,
      },
    } as MessageEvent<unknown>);
  }
}

function harness() {
  const workers: FakeWorker[] = [];
  let clock = 0;
  const service = createDagreLayoutWorkerClient({
    createWorker: () => {
      clock += 2;
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    now: () => ++clock,
  });
  return { service, workers };
}

describe('Dagre layout worker client', () => {
  it('correlates a successful response and reuses the idle worker', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    workers[0]!.succeed();
    expect(await first).toMatchObject({
      status: 'success',
      output: { positions: [{ id: 'a', x: 10, y: 20 }] },
      metrics: { workerComputeMs: 5 },
    });

    const second = service.layoutLatest(input);
    workers[0]!.succeed();
    expect((await second).status).toBe('success');
    expect(workers).toHaveLength(1);
    expect(workers[0]!.requests.map(({ requestId }) => requestId)).toEqual([
      1, 2,
    ]);
  });

  it('returns a structured computation failure while keeping the worker warm', async () => {
    const { service, workers } = harness();
    const result = service.layoutLatest(input);
    workers[0]!.failComputation();

    expect(await result).toMatchObject({
      status: 'failure',
      message: 'synthetic computation failure',
    });
    expect(workers[0]!.terminated).toBe(false);
  });

  it('terminates an active worker and settles the old request when superseded', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    const staleHandler = workers[0]!.onmessage;
    const second = service.layoutLatest(input);

    expect(await first).toEqual({ status: 'superseded' });
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    staleHandler?.({
      data: {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'success',
        output: { positions: [{ id: 'a', x: 999, y: 999 }] },
        computeMs: 10,
      },
    } as MessageEvent<unknown>);
    workers[1]!.succeed();
    expect(await second).toMatchObject({
      status: 'success',
      output: { positions: [{ id: 'a', x: 10, y: 20 }] },
    });
  });

  it('ignores a stale response from the same warm worker', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    workers[0]!.succeed();
    await first;
    const second = service.layoutLatest(input);
    workers[0]!.onmessage?.({
      data: {
        protocolVersion: DAGRE_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 1,
        kind: 'failure',
        code: 'computation-failed',
        message: 'stale',
        computeMs: 1,
      },
    } as MessageEvent<unknown>);
    workers[0]!.succeed();

    expect((await second).status).toBe('success');
    expect(workers[0]!.terminated).toBe(false);
  });

  it('fails explicitly and replaces the worker after a malformed response', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    workers[0]!.onmessage?.({
      data: { invalid: true },
    } as MessageEvent<unknown>);
    expect(await first).toMatchObject({ status: 'failure' });
    expect(workers[0]!.terminated).toBe(true);

    const second = service.layoutLatest(input);
    expect(workers).toHaveLength(2);
    workers[1]!.succeed();
    expect((await second).status).toBe('success');
  });

  it('handles error, messageerror, postMessage failure, and cancellation', async () => {
    const errorHarness = harness();
    const errorResult = errorHarness.service.layoutLatest(input);
    errorHarness.workers[0]!.onerror?.({ message: 'boom' } as ErrorEvent);
    expect(await errorResult).toMatchObject({
      status: 'failure',
      message: 'The Dagre worker failed: boom',
    });

    const messageHarness = harness();
    const messageResult = messageHarness.service.layoutLatest(input);
    messageHarness.workers[0]!.onmessageerror?.({} as MessageEvent<unknown>);
    expect(await messageResult).toMatchObject({ status: 'failure' });

    const postHarness = harness();
    postHarness.service.cancelPending();
    const originalCreate = postHarness.workers;
    const service = createDagreLayoutWorkerClient({
      createWorker: () => {
        const worker = new FakeWorker();
        worker.postError = new Error('clone denied');
        originalCreate.push(worker);
        return worker;
      },
    });
    expect(await service.layoutLatest(input)).toMatchObject({
      status: 'failure',
      message: expect.stringContaining('clone denied'),
    });

    const cancelHarness = harness();
    const cancelled = cancelHarness.service.layoutLatest(input);
    cancelHarness.service.cancelPending();
    expect(await cancelled).toEqual({ status: 'superseded' });
    expect(cancelHarness.workers[0]!.terminated).toBe(true);
  });

  it('reports worker construction failure without creating success-shaped output', async () => {
    const service = createDagreLayoutWorkerClient({
      createWorker: () => {
        throw new Error('worker blocked');
      },
    });

    expect(await service.layoutLatest(input)).toMatchObject({
      status: 'failure',
      message: 'The Dagre worker could not start: worker blocked',
      metrics: {
        workerComputeMs: 0,
        workerRoundTripMs: 0,
        workerStartupMs: 0,
      },
    });
  });

  it('settles pending work on disposal and ignores late responses', async () => {
    const { service, workers } = harness();
    const pending = service.layoutLatest(input);
    const staleHandler = workers[0]!.onmessage;
    service.dispose();

    expect(await pending).toEqual({ status: 'superseded' });
    expect(workers[0]!.terminated).toBe(true);
    staleHandler?.({ data: {} } as MessageEvent<unknown>);
    expect(await service.layoutLatest(input)).toMatchObject({
      status: 'failure',
      message: 'The Dagre layout service has been disposed.',
    });
  });
});
