import { describe, expect, it } from 'vitest';

import type { GlobalLayoutRequest } from '@icarus-graph-explorer/renderer-sigma/types';

import {
  createGlobalLayoutWorkerClient,
  type GlobalLayoutWorkerTransport,
} from './global-layout-worker-client';

function request() {
  return {
    schemaVersion: 1,
    algorithm: 'reference-only',
    iterations: 1,
    settings: { folderClustering: false, spacingPreset: 'normal' },
    nodes: [{ key: 'a', x: 0, y: 0, size: 1 }],
    edges: [],
  } as const satisfies Omit<GlobalLayoutRequest, 'requestId'>;
}

function transport(): GlobalLayoutWorkerTransport & {
  posted: GlobalLayoutRequest[];
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

describe('Global latest-layout worker client', () => {
  it('terminates and rejects superseded work, adopting only the latest result', async () => {
    const workers: ReturnType<typeof transport>[] = [];
    const service = createGlobalLayoutWorkerClient({
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
    const latest = workers[1]!;
    latest.onmessage?.({
      data: {
        schemaVersion: 1,
        kind: 'result',
        requestId: 2,
        algorithm: 'reference-only',
        computeMs: 1,
        folderPriorMs: 0,
        positions: [{ key: 'a', x: 1, y: 2 }],
        metrics: {
          meanWithinFolderDistance: 0,
          meanCrossFolderDistance: 0,
          meanCrossFolderReferenceLength: 0,
          meanDisplacementFromInput: 1,
        },
      },
    } as MessageEvent<unknown>);
    await expect(second).resolves.toMatchObject({ requestId: 2 });
    expect(latest.terminated).toBe(true);
  });

  it('fails loudly for malformed worker output', async () => {
    const worker = transport();
    const service = createGlobalLayoutWorkerClient({
      createWorker: () => worker,
    });
    const pending = service.layout(request());
    worker.onmessage?.({ data: { kind: 'result' } } as MessageEvent<unknown>);
    await expect(pending).rejects.toThrow('malformed response');
  });
});
