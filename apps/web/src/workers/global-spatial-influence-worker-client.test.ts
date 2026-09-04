import { describe, expect, it } from 'vitest';

import type { GlobalSpatialInfluenceRequest } from '@icarus-graph-explorer/renderer-sigma/types';

import {
  createGlobalSpatialInfluenceWorkerClient,
  type GlobalSpatialInfluenceWorkerTransport,
} from './global-spatial-influence-worker-client';

function request(): Omit<GlobalSpatialInfluenceRequest, 'requestId'> {
  return {
    schemaVersion: 1,
    algorithm: 'interleaved-centroid',
    algorithmVersion: 1,
    baseLayoutFingerprint: 'base',
    iterations: 1,
    globalLayoutSettings: { folderClustering: false, spacingPreset: 'normal' },
    nodes: [{ key: 'a', x: 0, y: 1, size: 1 }],
    edges: [],
    attractors: [
      {
        ruleFolderKey: 'folder',
        memberNodeKeys: ['a'],
        targetX: 1,
        targetY: 1,
        strength: 50,
      },
    ],
  };
}

function transport(): GlobalSpatialInfluenceWorkerTransport & {
  posted: GlobalSpatialInfluenceRequest[];
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

function result(requestId: number) {
  return {
    schemaVersion: 1,
    kind: 'result',
    requestId,
    algorithm: 'interleaved-centroid',
    computeMs: 1,
    forceAtlasMs: 0.75,
    attractorMs: 0.25,
    positions: [{ key: 'a', x: 1, y: 1 }],
    metrics: {
      meanTargetError: 0,
      maxTargetError: 0,
      meanAffectedDisplacement: 1,
      meanUnaffectedDisplacement: 0,
      meanCrossBoundaryReferenceLength: 0,
      meanReferenceLength: 0,
    },
  } as const;
}

describe('latest spatial-influence worker client', () => {
  it('supersedes old work and adopts only the latest result', async () => {
    const workers: ReturnType<typeof transport>[] = [];
    const service = createGlobalSpatialInfluenceWorkerClient({
      createWorker: () => {
        const worker = transport();
        workers.push(worker);
        return worker;
      },
    });
    const first = service.layout(request());
    const staleHandler = workers[0]!.onmessage;
    const second = service.layout(request());
    await expect(first).rejects.toThrow('superseded');
    expect(workers[0]!.terminated).toBe(true);
    staleHandler?.({ data: result(1) } as MessageEvent<unknown>);
    workers[1]!.onmessage?.({ data: result(2) } as MessageEvent<unknown>);
    await expect(second).resolves.toMatchObject({ requestId: 2 });
  });

  it('fails loudly for malformed responses and disposes active work', async () => {
    const worker = transport();
    const service = createGlobalSpatialInfluenceWorkerClient({
      createWorker: () => worker,
    });
    const pending = service.layout(request());
    worker.onmessage?.({ data: { kind: 'result' } } as MessageEvent<unknown>);
    await expect(pending).rejects.toThrow('malformed response');
    expect(worker.terminated).toBe(true);
  });
});
