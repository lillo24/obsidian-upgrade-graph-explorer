import { describe, expect, it } from 'vitest';

import {
  ENDPOINT_FIXTURES,
  FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  type FocusSchematicLayoutInput,
  type FocusSchematicLayoutWorkerRequest,
} from '@icarus-graph-explorer/focus-schematic-layout';

import {
  createFocusSchematicLayoutWorkerClient,
  type FocusSchematicLayoutWorkerTransport,
} from './focus-schematic-layout-worker-client';

const fixture = buildEndpointFixture(ENDPOINT_FIXTURES[0]!);
const visible = new Set(
  fixture.model.modules.flatMap(
    ({ visibleEntityNodeIds }) => visibleEntityNodeIds,
  ),
);
const input: FocusSchematicLayoutInput = {
  model: fixture.model,
  projection: fixture.projection,
  nodeDimensions: fixture.projection.nodes
    .filter((node) => node.kind === 'entity' && visible.has(node.id))
    .map((node) => ({
      projectionNodeId: node.id,
      ...(node.kind !== 'entity' || node.entityKind === 'document'
        ? { width: 200, height: 80 }
        : node.entityKind === 'section'
          ? { width: 184, height: 72 }
          : { width: 152, height: 64 }),
    })),
  settings: FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
};

class FakeWorker implements FocusSchematicLayoutWorkerTransport {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly requests: FocusSchematicLayoutWorkerRequest[] = [];
  terminated = false;
  postError?: Error;

  postMessage(message: FocusSchematicLayoutWorkerRequest): void {
    if (this.postError !== undefined) throw this.postError;
    this.requests.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  fail(message = 'synthetic computation failure'): void {
    const request = this.requests.at(-1)!;
    this.onmessage?.({
      data: {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'failure',
        code: 'computation-failed',
        message,
        computeMs: 4,
      },
    } as MessageEvent<unknown>);
  }

  succeed(): void {
    const request = this.requests.at(-1)!;
    const attempt = computeFocusSchematicComputedLayoutAttempt(request.input);
    if (attempt.status !== 'success') throw new Error(attempt.reason);
    this.onmessage?.({
      data: {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: request.requestId,
        kind: 'success',
        result: attempt.result,
        timings: attempt.timings,
        computeMs: 5,
      },
    } as MessageEvent<unknown>);
  }
}

function harness() {
  const workers: FakeWorker[] = [];
  let clock = 0;
  const service = createFocusSchematicLayoutWorkerClient({
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

describe('Focus Schematic worker client', () => {
  it('correlates success and reuses an idle worker', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    workers[0]!.succeed();
    expect(await first).toMatchObject({
      status: 'success',
      metrics: { workerComputeMs: 5 },
    });
    const second = service.layoutLatest(input);
    workers[0]!.succeed();
    expect((await second).status).toBe('success');
    expect(workers[0]!.requests.map(({ requestId }) => requestId)).toEqual([
      1, 2,
    ]);
  });

  it('supersedes, cancels, and disposes pending generations', async () => {
    const { service, workers } = harness();
    const first = service.layoutLatest(input);
    const second = service.layoutLatest(input);
    expect(await first).toEqual({ status: 'superseded' });
    expect(workers[0]!.terminated).toBe(true);
    service.cancelPending();
    expect(await second).toEqual({ status: 'superseded' });
    expect(workers[1]!.terminated).toBe(true);

    const third = service.layoutLatest(input);
    service.dispose();
    expect(await third).toEqual({ status: 'superseded' });
    expect(await service.layoutLatest(input)).toMatchObject({
      status: 'failure',
    });
  });

  it('adopts only the last request in a rapid four-request burst', async () => {
    const { service, workers } = harness();
    const requests = [
      service.layoutLatest(input),
      service.layoutLatest(input),
      service.layoutLatest(input),
      service.layoutLatest(input),
    ];
    expect(await Promise.all(requests.slice(0, 3))).toEqual([
      { status: 'superseded' },
      { status: 'superseded' },
      { status: 'superseded' },
    ]);
    expect(workers.slice(0, 3).every(({ terminated }) => terminated)).toBe(
      true,
    );
    workers[3]!.succeed();
    expect(await requests[3]).toMatchObject({ status: 'success' });
    expect(workers[3]!.terminated).toBe(false);
  });

  it('ignores a stale response before adopting the current request', async () => {
    const { service, workers } = harness();
    const pending = service.layoutLatest(input);
    workers[0]!.onmessage?.({
      data: {
        protocolVersion: FOCUS_SCHEMATIC_LAYOUT_WORKER_PROTOCOL_VERSION,
        requestId: 99,
        kind: 'failure',
        code: 'computation-failed',
        message: 'stale',
        computeMs: 1,
      },
    } as MessageEvent<unknown>);
    workers[0]!.succeed();
    expect(await pending).toMatchObject({ status: 'success' });
  });

  it('handles computation, malformed-response, transport, and startup failures', async () => {
    const computation = harness();
    const failed = computation.service.layoutLatest(input);
    computation.workers[0]!.fail();
    expect(await failed).toMatchObject({
      status: 'failure',
      message: 'synthetic computation failure',
    });

    const malformed = harness();
    const malformedResult = malformed.service.layoutLatest(input);
    malformed.workers[0]!.onmessage?.({
      data: { invalid: true },
    } as MessageEvent);
    expect(await malformedResult).toMatchObject({ status: 'failure' });
    expect(malformed.workers[0]!.terminated).toBe(true);

    const transport = harness();
    const transportResult = transport.service.layoutLatest(input);
    transport.workers[0]!.onmessageerror?.({} as MessageEvent);
    expect(await transportResult).toMatchObject({ status: 'failure' });

    const workerError = harness();
    const workerErrorResult = workerError.service.layoutLatest(input);
    workerError.workers[0]!.onerror?.({
      message: 'synthetic crash',
    } as ErrorEvent);
    expect(await workerErrorResult).toMatchObject({
      status: 'failure',
      message: expect.stringContaining('synthetic crash'),
    });

    const throwingWorker = new FakeWorker();
    throwingWorker.postError = new Error('clone blocked');
    const postService = createFocusSchematicLayoutWorkerClient({
      createWorker: () => throwingWorker,
    });
    expect(await postService.layoutLatest(input)).toMatchObject({
      status: 'failure',
      message: expect.stringContaining('clone blocked'),
    });

    const startup = createFocusSchematicLayoutWorkerClient({
      createWorker: () => {
        throw new Error('blocked');
      },
    });
    expect(await startup.layoutLatest(input)).toMatchObject({
      status: 'failure',
      message: expect.stringContaining('blocked'),
    });
  });

  it('reports the optional main-thread responsiveness probe', async () => {
    const workers: FakeWorker[] = [];
    let clock = 0;
    const service = createFocusSchematicLayoutWorkerClient({
      createWorker: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
      now: () => ++clock,
      measureResponsiveness: true,
    });
    const pending = service.layoutLatest(input);
    workers[0]!.succeed();
    expect(await pending).toMatchObject({
      status: 'success',
      metrics: { mainThreadHighGapMs: expect.any(Number) },
    });
  });
});
