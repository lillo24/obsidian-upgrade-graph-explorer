import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderSpatialRule } from '@icarus-graph-explorer/spatial-overrides';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
} from './types';

const noop = () => undefined;
const settings = { folderClustering: false, spacingPreset: 'normal' } as const;

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('production spatial rule adoption', () => {
  it('runs Pull once, reuses it for Place-only edits, and never requests automatic layout for rule edits', async () => {
    const spatialApply = vi.spyOn(
      GlobalRendererSession.prototype,
      'applySpatialPositions',
    );
    const projection = globalTestProjection();
    let rules: readonly FolderSpatialRule[] = [
      {
        folderKey: 'alpha',
        behavior: 'pull',
        scope: { kind: 'exact' },
        anchor: { x: -0.5, y: 0 },
        strength: 70,
      },
    ];
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
        ({
          schemaVersion: 1,
          kind: 'result',
          requestId: layout.mock.calls.length,
          algorithm: 'reference-only',
          computeMs: 0,
          folderPriorMs: 0,
          positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
          metrics: {
            meanWithinFolderDistance: 0,
            meanCrossFolderDistance: 0,
            meanCrossFolderReferenceLength: 0,
            meanDisplacementFromInput: 0,
          },
        }) as GlobalLayoutResult,
    );
    const pull = vi.fn(
      async (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) =>
        ({
          schemaVersion: 1,
          kind: 'result',
          requestId: pull.mock.calls.length,
          algorithm: request.algorithm,
          computeMs: 0,
          forceAtlasMs: 0,
          attractorMs: 0,
          positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
          metrics: {
            meanTargetError: 0,
            maxTargetError: 0,
            meanAffectedDisplacement: 0,
            meanUnaffectedDisplacement: 0,
            meanCrossBoundaryReferenceLength: 0,
            meanReferenceLength: 0,
          },
        }) as GlobalSpatialInfluenceResult,
    );
    const layoutService = { layout, dispose: noop };
    const spatialInfluenceService = { layout: pull, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialRules: rules,
        spatialSourceKey: 'workspace',
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutService,
        spatialInfluenceService,
        onFailure: vi.fn(),
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(spatialApply).toHaveBeenCalledTimes(1);
    let spatialApplyCount = spatialApply.mock.calls.length;

    rules = [
      rules[0]!,
      {
        folderKey: 'beta',
        behavior: 'place',
        scope: { kind: 'exact' },
        anchor: { x: 0.6, y: 0.2 },
      },
    ];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(1);
    expect(spatialApply.mock.calls.length).toBeGreaterThan(spatialApplyCount);
    spatialApplyCount = spatialApply.mock.calls.length;

    rules = [
      { ...rules[0]!, strength: 80 },
      { ...rules[1]!, anchor: { x: 0.8, y: -0.2 } },
    ];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(spatialApply.mock.calls.length).toBeGreaterThan(spatialApplyCount);
    spatialApplyCount = spatialApply.mock.calls.length;

    rules = [rules[1]!];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(spatialApply.mock.calls.length).toBeGreaterThan(spatialApplyCount);
    spatialApplyCount = spatialApply.mock.calls.length;

    rules = [];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(spatialApply.mock.calls.length).toBeGreaterThan(spatialApplyCount);
    harness.destroy();
  });

  it('waits to fit a fresh source until spatial-rule positions are authoritative', async () => {
    const projection = globalTestProjection();
    const fit = vi
      .spyOn(GlobalRendererSession.prototype, 'fit')
      .mockImplementation(noop);
    let pendingRequest:
      Omit<GlobalSpatialInfluenceRequest, 'requestId'> | undefined;
    let resolvePull:
      ((result: GlobalSpatialInfluenceResult) => void) | undefined;
    const spatialInfluenceService = {
      dispose: noop,
      layout: vi.fn(
        (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) =>
          new Promise<GlobalSpatialInfluenceResult>((resolve) => {
            pendingRequest = request;
            resolvePull = resolve;
          }),
      ),
    };
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
        ({
          schemaVersion: 1,
          kind: 'result',
          requestId: 1,
          algorithm: 'reference-only',
          computeMs: 0,
          folderPriorMs: 0,
          positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
          metrics: {
            meanWithinFolderDistance: 0,
            meanCrossFolderDistance: 0,
            meanCrossFolderReferenceLength: 0,
            meanDisplacementFromInput: 0,
          },
        }) as GlobalLayoutResult,
    );
    const layoutService = { layout, dispose: noop };
    const spatialRules: readonly FolderSpatialRule[] = [
      {
        folderKey: 'alpha',
        behavior: 'pull',
        scope: { kind: 'exact' },
        anchor: { x: -0.5, y: 0 },
        strength: 70,
      },
    ];
    const onFailure = vi.fn();
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialRules,
        fitRequestKey: 1,
        layoutRequestKey: 0,
        layoutService,
        spatialInfluenceService,
        onFailure,
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );

    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(spatialInfluenceService.layout).toHaveBeenCalledTimes(1);
    expect(fit).not.toHaveBeenCalled();
    if (pendingRequest === undefined || resolvePull === undefined) {
      throw new Error('Expected a pending Dynamic Pull request.');
    }

    resolvePull({
      schemaVersion: 1,
      kind: 'result',
      requestId: 1,
      algorithm: pendingRequest.algorithm,
      computeMs: 0,
      forceAtlasMs: 0,
      attractorMs: 0,
      positions: pendingRequest.nodes.map(({ key, x, y }) => ({ key, x, y })),
      metrics: {
        meanTargetError: 0,
        maxTargetError: 0,
        meanAffectedDisplacement: 0,
        meanUnaffectedDisplacement: 0,
        meanCrossBoundaryReferenceLength: 0,
        meanReferenceLength: 0,
      },
    });
    await harness.flush();

    expect(fit).toHaveBeenCalledTimes(1);
    expect(layout).toHaveBeenCalledTimes(1);
    harness.destroy();
  });

  it('leaves explicit Fit and Search center requests as camera-owning actions', async () => {
    const projection = globalTestProjection();
    let fitRequestKey = 0;
    let centerRequest:
      | {
          readonly key: number;
          readonly nodeId: string;
          readonly ratio: number;
        }
      | undefined = undefined;
    const fit = vi
      .spyOn(GlobalRendererSession.prototype, 'fit')
      .mockImplementation(noop);
    const center = vi
      .spyOn(GlobalRendererSession.prototype, 'center')
      .mockResolvedValue(undefined);
    const layoutService = {
      dispose: noop,
      layout: vi.fn(
        async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
          ({
            schemaVersion: 1,
            kind: 'result',
            requestId: 1,
            algorithm: 'reference-only',
            computeMs: 0,
            folderPriorMs: 0,
            positions: request.nodes.map(({ key, x, y }) => ({ key, x, y })),
            metrics: {
              meanWithinFolderDistance: 0,
              meanCrossFolderDistance: 0,
              meanCrossFolderReferenceLength: 0,
              meanDisplacementFromInput: 0,
            },
          }) as GlobalLayoutResult,
      ),
    };
    const onFailure = vi.fn();
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        ...(centerRequest === undefined ? {} : { centerRequest }),
        projection,
        settings,
        fitRequestKey,
        layoutRequestKey: 0,
        layoutService,
        onFailure,
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );
    await harness.flush();

    fitRequestKey = 1;
    harness.invalidate();
    await harness.flush();
    expect(fit).toHaveBeenCalledTimes(1);

    centerRequest = { key: 1, nodeId: 'entity:doc-a', ratio: 0.3 };
    harness.invalidate();
    await harness.flush();
    expect(center).toHaveBeenCalledWith(centerRequest);
    harness.destroy();
  });
});
