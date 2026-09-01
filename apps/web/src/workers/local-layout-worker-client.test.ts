import { describe, expect, it } from 'vitest';

import type { LocalLayoutRequest } from '@icarus-graph-explorer/renderer-sigma/types';

import {
  createLocalLayoutWorkerClient,
  type LocalLayoutWorkerTransport,
} from './local-layout-worker-client';

function request() {
  return {
    schemaVersion: 1,
    rootKey: 'root',
    iterations: 1,
    settings: { hierarchyWeight: 6, referenceWeight: 1, scalingRatio: 1.35 },
    nodes: [{ key: 'root', kind: 'document', x: 0, y: 0, size: 1 }],
    edges: [],
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

describe('Local latest-layout worker client', () => {
  it('terminates superseded work and applies only the newest result', async () => {
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

    workers[1]?.onmessage?.({
      data: {
        schemaVersion: 1,
        kind: 'result',
        requestId: 2,
        computeMs: 1,
        positions: [{ key: 'root', x: 0, y: 0 }],
      },
    } as MessageEvent<unknown>);
    await expect(second).resolves.toMatchObject({ requestId: 2 });
    expect(workers[1]?.terminated).toBe(true);
  });

  it('fails loudly for malformed worker output', async () => {
    const worker = transport();
    const service = createLocalLayoutWorkerClient({
      createWorker: () => worker,
    });
    const pending = service.layout(request());
    worker.onmessage?.({ data: { kind: 'result' } } as MessageEvent<unknown>);
    await expect(pending).rejects.toThrow('malformed response');
  });
});
