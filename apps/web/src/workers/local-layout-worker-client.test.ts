import { describe, expect, it } from 'vitest';

import { createLocalConvergencePolicy } from '@icarus-graph-explorer/renderer-sigma/local-convergence';
import type {
  LocalConvergenceDistribution,
  LocalConvergenceMovement,
  LocalLayoutRequest,
} from '@icarus-graph-explorer/renderer-sigma/types';

import {
  createLocalLayoutWorkerClient,
  LocalLayoutWorkerFailureError,
  type LocalLayoutWorkerTransport,
} from './local-layout-worker-client';

const emptyDistribution: LocalConvergenceDistribution = {
  count: 0,
  p50: null,
  p90: null,
  maximum: null,
};
const stableMovement: LocalConvergenceMovement = {
  scale: 1,
  all: { count: 2, p50: 0, p90: 0, maximum: 0 },
  degree0: emptyDistribution,
  degree1: { count: 2, p50: 0, p90: 0, maximum: 0 },
  degree2Plus: emptyDistribution,
  lowDegree: { count: 2, p50: 0, p90: 0, maximum: 0 },
};

function request(nodeCount = 2) {
  return {
    schemaVersion: 2,
    rootKey: 'root',
    policy: createLocalConvergencePolicy(nodeCount),
    settings: { hierarchyWeight: 6, referenceWeight: 1, scalingRatio: 1.35 },
    nodes:
      nodeCount === 1
        ? [{ key: 'root', kind: 'document', x: 0, y: 0, size: 1 }]
        : [
            { key: 'root', kind: 'document', x: 0, y: 0, size: 1 },
            { key: 'leaf', kind: 'document', x: 1, y: 0, size: 1 },
          ],
    edges:
      nodeCount === 1
        ? []
        : [
            {
              key: 'edge',
              source: 'root',
              target: 'leaf',
              kind: 'reference',
              weight: 1,
            },
          ],
  } as const satisfies Omit<LocalLayoutRequest, 'requestId'>;
}

function transport(): LocalLayoutWorkerTransport & {
  posted: LocalLayoutRequest[];
  terminated: boolean;
} {
  return {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    posted: [],
    terminated: false,
    postMessage(message) {
      this.posted.push(message);
    },
    terminate() {
      this.terminated = true;
    },
  };
}

function stableResult(requestId = 1) {
  return {
    schemaVersion: 2,
    kind: 'result',
    requestId,
    stopReason: 'stable',
    policyVersion: 'local-fa2-convergence-v1',
    iterationsCompleted: 96,
    batchesCompleted: 3,
    stableBatches: 3,
    finalMovement: stableMovement,
    computeMs: 1,
    positions: [
      { key: 'root', x: 0, y: 0 },
      { key: 'leaf', x: 1, y: 0 },
    ],
  } as const;
}

describe('Local latest-layout worker client', () => {
  it('terminates superseded work and applies only the newest stable result', async () => {
    const workers: ReturnType<typeof transport>[] = [];
    const service = createLocalLayoutWorkerClient({
      createWorker: () => {
        const worker = transport();
        workers.push(worker);
        return worker;
      },
    });
    const first = service.layout(request());
    const second = service.layout(request());
    await expect(first).rejects.toThrow('superseded');
    expect(workers[0]?.terminated).toBe(true);
    workers[1]?.onmessage?.({ data: stableResult(2) } as MessageEvent<unknown>);
    await expect(second).resolves.toMatchObject({
      requestId: 2,
      stopReason: 'stable',
    });
    expect(workers[1]?.terminated).toBe(true);
  });

  it('accepts max-iterations and degenerate result contracts', async () => {
    const cappedWorker = transport();
    const cappedService = createLocalLayoutWorkerClient({
      createWorker: () => cappedWorker,
    });
    const capped = cappedService.layout(request());
    cappedWorker.onmessage?.({
      data: {
        ...stableResult(),
        stopReason: 'max-iterations',
        iterationsCompleted: 1_000,
        batchesCompleted: 32,
        stableBatches: 0,
      },
    } as MessageEvent<unknown>);
    await expect(capped).resolves.toMatchObject({
      stopReason: 'max-iterations',
    });

    const singleWorker = transport();
    const singleService = createLocalLayoutWorkerClient({
      createWorker: () => singleWorker,
    });
    const single = singleService.layout(request(1));
    singleWorker.onmessage?.({
      data: {
        schemaVersion: 2,
        kind: 'result',
        requestId: 1,
        stopReason: 'degenerate',
        policyVersion: 'local-fa2-convergence-v1',
        iterationsCompleted: 0,
        batchesCompleted: 0,
        stableBatches: 0,
        finalMovement: null,
        computeMs: 0,
        positions: [{ key: 'root', x: 0, y: 0 }],
      },
    } as MessageEvent<unknown>);
    await expect(single).resolves.toMatchObject({ stopReason: 'degenerate' });
  });

  it('rejects policy, lifecycle, threshold, movement, and node-set corruption', async () => {
    const corruptions = [
      { ...stableResult(), policyVersion: 'wrong' },
      { ...stableResult(), iterationsCompleted: 95 },
      {
        ...stableResult(),
        finalMovement: {
          ...stableMovement,
          all: { ...stableMovement.all, p90: 1, maximum: 1 },
        },
      },
      { ...stableResult(), finalMovement: null },
      { ...stableResult(), positions: [{ key: 'root', x: 0, y: 0 }] },
    ];
    for (const corruption of corruptions) {
      const worker = transport();
      const service = createLocalLayoutWorkerClient({
        createWorker: () => worker,
      });
      const pending = service.layout(request());
      worker.onmessage?.({ data: corruption } as MessageEvent<unknown>);
      await expect(pending).rejects.toThrow('malformed response');
    }
  });

  it('surfaces a structured max-wall-time failure without positions', async () => {
    const worker = transport();
    const service = createLocalLayoutWorkerClient({
      createWorker: () => worker,
    });
    const pending = service.layout(request());
    worker.onmessage?.({
      data: {
        schemaVersion: 2,
        kind: 'error',
        requestId: 1,
        code: 'max-wall-time',
        policyVersion: 'local-fa2-convergence-v1',
        iterationsCompleted: 32,
        batchesCompleted: 1,
        finalMovement: stableMovement,
        computeMs: 2_001,
        message: 'safety limit reached',
      },
    } as MessageEvent<unknown>);
    const error = await pending.catch((value: unknown) => value);
    expect(error).toBeInstanceOf(LocalLayoutWorkerFailureError);
    expect(error).toMatchObject({
      code: 'max-wall-time',
      iterationsCompleted: 32,
      batchesCompleted: 1,
    });
  });

  it('terminates and rejects active work on disposal', async () => {
    const worker = transport();
    const service = createLocalLayoutWorkerClient({
      createWorker: () => worker,
    });
    const pending = service.layout(request());
    service.dispose();
    expect(worker.terminated).toBe(true);
    await expect(pending).rejects.toThrow('disposed');
    await expect(service.layout(request())).rejects.toThrow('disposed');
  });
});
