import { describe, expect, it, vi } from 'vitest';

import {
  GlobalSpatialPullPreviewController,
  type GlobalSpatialPullPreviewFrameScheduler,
  type GlobalSpatialPullPreviewInput,
} from './spatial-pull-preview';
import type {
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
} from './types';

function previewInput(targetX: number): GlobalSpatialPullPreviewInput {
  const request: Omit<GlobalSpatialInfluenceRequest, 'requestId'> = {
    schemaVersion: 1,
    algorithm: 'interleaved-centroid',
    algorithmVersion: 1,
    baseLayoutFingerprint: 'base',
    iterations: 12,
    nodes: [{ key: 'node', x: 0, y: 0, size: 1 }],
    edges: [],
    attractors: [
      {
        ruleFolderKey: 'folder',
        memberNodeKeys: ['node'],
        targetX,
        targetY: 0,
        strength: 0.7,
      },
    ],
    globalLayoutSettings: {
      folderClustering: false,
      spacingPreset: 'normal',
    },
  };
  return {
    request,
    basePositions: [{ key: 'node', x: 0, y: 0 }],
    input: { nodes: [], edges: [], projectionIssues: [] },
    resolvedRules: {
      pullGroups: [],
      placeGroups: [],
      inactiveRules: [],
      winningRuleByNodeKey: new Map(),
      membershipCountByRuleFolderKey: new Map(),
    },
  };
}

function result(
  request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>,
): GlobalSpatialInfluenceResult {
  return {
    schemaVersion: 1,
    kind: 'result',
    requestId: 1,
    algorithm: request.algorithm,
    computeMs: 2,
    forceAtlasMs: 1,
    attractorMs: 1,
    positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
    metrics: {
      meanTargetError: 0,
      maxTargetError: 0,
      meanAffectedDisplacement: 0,
      meanUnaffectedDisplacement: 0,
      meanCrossBoundaryReferenceLength: 0,
      meanReferenceLength: 0,
    },
  };
}

function controlledFrames(): {
  readonly scheduler: GlobalSpatialPullPreviewFrameScheduler;
  readonly flush: () => void;
} {
  let sequence = 0;
  const frames = new Map<number, FrameRequestCallback>();
  return {
    scheduler: {
      request: (callback) => {
        const handle = ++sequence;
        frames.set(handle, callback);
        return handle;
      },
      cancel: (handle) => {
        frames.delete(handle);
      },
    },
    flush: () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
  };
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

describe('GlobalSpatialPullPreviewController', () => {
  it('coalesces many draft samples at one frame into one newest request', async () => {
    const frames = controlledFrames();
    const count = vi.fn();
    const layout = vi.fn(
      async (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) =>
        result(request),
    );
    const controller = new GlobalSpatialPullPreviewController({
      createService: () => ({ layout, dispose: vi.fn() }),
      frameScheduler: frames.scheduler,
      instrumentation: {
        count,
        measure: (_phase, _operation, run) => run(),
        record: vi.fn(),
      },
      onAdopt: vi.fn(),
      onError: vi.fn(),
    });

    for (let target = 1; target <= 100; target += 1) {
      controller.schedule(previewInput(target));
    }
    expect(layout).not.toHaveBeenCalled();
    frames.flush();
    await settle();

    expect(layout).toHaveBeenCalledTimes(1);
    expect(layout.mock.calls[0]![0].attractors[0]?.targetX).toBe(100);
    expect(
      count.mock.calls.filter(
        ([operation]) => operation === 'spatial-pull-preview-schedules',
      ),
    ).toHaveLength(100);
    expect(
      count.mock.calls.filter(
        ([operation]) => operation === 'spatial-pull-preview-requests',
      ),
    ).toHaveLength(1);
    expect(
      count.mock.calls.filter(
        ([operation]) => operation === 'spatial-pull-preview-adopts',
      ),
    ).toHaveLength(1);
    controller.dispose();
  });

  it('keeps one active and one newest pending request while adopting useful progress', async () => {
    const frames = controlledFrames();
    const pending: Array<{
      readonly request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>;
      readonly resolve: (value: GlobalSpatialInfluenceResult) => void;
    }> = [];
    const layout = vi.fn(
      (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) =>
        new Promise<GlobalSpatialInfluenceResult>((resolve) => {
          pending.push({ request, resolve });
        }),
    );
    const onAdopt = vi.fn();
    const controller = new GlobalSpatialPullPreviewController({
      createService: () => ({ layout, dispose: vi.fn() }),
      frameScheduler: frames.scheduler,
      onAdopt,
      onError: vi.fn(),
    });

    controller.schedule(previewInput(1));
    frames.flush();
    for (let target = 2; target <= 50; target += 1) {
      controller.schedule(previewInput(target));
    }
    frames.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    controller.schedule(previewInput(51));

    pending[0]!.resolve(result(pending[0]!.request));
    await settle();
    expect(onAdopt).toHaveBeenCalledTimes(1);
    expect(onAdopt.mock.calls[0]![0].input.request.attractors[0].targetX).toBe(
      1,
    );
    expect(layout).toHaveBeenCalledTimes(2);
    expect(layout.mock.calls[1]![0].attractors[0]?.targetX).toBe(51);

    pending[1]!.resolve(result(pending[1]!.request));
    await settle();
    expect(onAdopt).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it('disposes active generation work and ignores its stale result after reset', async () => {
    const frames = controlledFrames();
    let resolveRequest:
      ((value: GlobalSpatialInfluenceResult) => void) | undefined;
    let request: Omit<GlobalSpatialInfluenceRequest, 'requestId'> | undefined;
    const dispose = vi.fn();
    const onAdopt = vi.fn();
    const controller = new GlobalSpatialPullPreviewController({
      createService: () => ({
        dispose,
        layout: (next) => {
          request = next;
          return new Promise((resolve) => {
            resolveRequest = resolve;
          });
        },
      }),
      frameScheduler: frames.scheduler,
      onAdopt,
      onError: vi.fn(),
    });
    controller.schedule(previewInput(1));
    frames.flush();
    controller.reset();

    expect(dispose).toHaveBeenCalledTimes(1);
    if (resolveRequest === undefined || request === undefined) {
      throw new Error('Expected active preview work.');
    }
    resolveRequest(result(request));
    await settle();
    expect(onAdopt).not.toHaveBeenCalled();
    controller.dispose();
  });
});
