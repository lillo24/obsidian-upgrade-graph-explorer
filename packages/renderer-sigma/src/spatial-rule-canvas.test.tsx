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
import { GlobalLayoutCache } from './layout-cache';
import {
  createGlobalLayoutRequest,
  globalLayoutPositionsFromInput,
  globalLayoutFingerprint,
} from './layout';
import { mapProjectionToGlobal } from './mapping';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import {
  composeGlobalFolderSpatialRules,
  resolveGlobalFolderSpatialRules,
} from './spatial';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalSpatialInfluenceRequest,
  GlobalSpatialInfluenceResult,
} from './types';

const noop = () => undefined;
const settings = { folderClustering: false, spacingPreset: 'normal' } as const;

function graphPositions(renderer: SigmaTestRenderer) {
  return renderer.graph.nodes().map((key) => ({
    key,
    x: renderer.graph.getNodeAttribute(key, 'x') as number,
    y: renderer.graph.getNodeAttribute(key, 'y') as number,
  }));
}

function sortedPositions(positions: readonly GlobalLayoutPosition[]) {
  return [...positions].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

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
  it.each(['place', 'pull'] as const)(
    'removes the only %s rule with one raw-frame position transaction',
    async (behavior) => {
      const projection = globalTestProjection();
      let rules: readonly FolderSpatialRule[] = [
        {
          folderKey: 'alpha',
          behavior,
          scope: { kind: 'exact' },
          anchor: { x: 0.65, y: -0.3 },
          ...(behavior === 'pull' ? { strength: 70 } : {}),
        },
      ];
      const layout = vi.fn(
        async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
          ({
            schemaVersion: 2,
            kind: 'result',
            requestId: 1,
            algorithm: 'reference-only',
            policyVersion: request.policy.version,
            macroVersion: request.macro.version,
            stopReason: 'max-iterations',
            iterationsCompleted: request.policy.maxIterations,
            macroStepsCompleted: Math.ceil(request.policy.maxIterations / 32),
            stableMacroSteps: 0,
            finalMacroStepIterations: 32,
            finalMovement: null,
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
            requestId: 1,
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
      const spatialApply = vi.spyOn(
        GlobalRendererSession.prototype,
        'applySpatialPositions',
      );
      const plainApply = vi.spyOn(
        GlobalRendererSession.prototype,
        'applyPositions',
      );
      const fit = vi
        .spyOn(GlobalRendererSession.prototype, 'fit')
        .mockImplementation(noop);
      const center = vi
        .spyOn(GlobalRendererSession.prototype, 'center')
        .mockResolvedValue(undefined);
      const harness = new CanvasTestHarness(() =>
        GlobalGraphCanvas({
          projection,
          settings,
          spatialRules: rules,
          spatialSourceKey: `remove-only-${behavior}`,
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
      const spatialBefore = spatialApply.mock.calls.length;
      const plainBefore = plainApply.mock.calls.length;
      const automaticPositions = layout.mock.calls[0]![0].nodes.map(
        ({ key, x, y }) => ({ key, x, y }),
      );

      rules = [];
      harness.invalidate();
      await harness.flush();

      expect(plainApply).toHaveBeenCalledTimes(plainBefore);
      expect(spatialApply).toHaveBeenCalledTimes(spatialBefore + 1);
      expect(
        sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
      ).toEqual(sortedPositions(automaticPositions));
      expect(fit).not.toHaveBeenCalled();
      expect(center).not.toHaveBeenCalled();
      harness.destroy();
    },
  );

  it('runs Pull once, reuses Place-only edits, and emits no automatic layout/Fit/center request', async () => {
    const fit = vi
      .spyOn(GlobalRendererSession.prototype, 'fit')
      .mockImplementation(noop);
    const center = vi
      .spyOn(GlobalRendererSession.prototype, 'center')
      .mockResolvedValue(undefined);
    const spatialApply = vi.spyOn(
      GlobalRendererSession.prototype,
      'applySpatialPositions',
    );
    const plainApply = vi.spyOn(
      GlobalRendererSession.prototype,
      'applyPositions',
    );
    const positionApplicationCount = () =>
      spatialApply.mock.calls.length + plainApply.mock.calls.length;
    const projection = globalTestProjection();
    const initialPullRule: FolderSpatialRule = {
      folderKey: 'alpha',
      behavior: 'pull',
      scope: { kind: 'exact' },
      anchor: { x: -0.5, y: 0 },
      strength: 70,
    };
    let rules: readonly FolderSpatialRule[] = [initialPullRule];
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
        ({
          schemaVersion: 2,
          kind: 'result',
          requestId: layout.mock.calls.length,
          algorithm: 'reference-only',
          policyVersion: request.policy.version,
          macroVersion: request.macro.version,
          stopReason: 'max-iterations',
          iterationsCompleted: request.policy.maxIterations,
          macroStepsCompleted: Math.ceil(request.policy.maxIterations / 32),
          stableMacroSteps: 0,
          finalMacroStepIterations: 32,
          finalMovement: null,
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
    expect(spatialApply).toHaveBeenCalledTimes(2);
    expect(plainApply).not.toHaveBeenCalled();
    let applicationCount = positionApplicationCount();
    const plainApplyCount = plainApply.mock.calls.length;

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
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    applicationCount = positionApplicationCount();

    rules = [
      { ...rules[0]!, strength: 80 },
      { ...rules[1]!, anchor: { x: 0.8, y: -0.2 } },
    ];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    applicationCount = positionApplicationCount();

    const survivingPlaceRule = rules[1]!;
    rules = [rules[1]!];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    applicationCount = positionApplicationCount();
    const automaticPositions = layout.mock.calls[0]![0].nodes.map(
      ({ key, x, y }) => ({ key, x, y }),
    );
    const input = mapProjectionToGlobal(projection, settings);
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(
      sortedPositions(
        composeGlobalFolderSpatialRules(
          automaticPositions,
          automaticPositions,
          input,
          resolveGlobalFolderSpatialRules(input, [survivingPlaceRule]),
        ).displayedPositions,
      ),
    );

    rules = [];
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(sortedPositions(automaticPositions));

    applicationCount = positionApplicationCount();
    rules = [{ ...initialPullRule, anchor: { x: 0.35, y: -0.25 } }];
    harness.invalidate();
    await harness.flush();
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);

    applicationCount = positionApplicationCount();
    rules = [];
    harness.invalidate();
    await harness.flush();
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(sortedPositions(automaticPositions));

    applicationCount = positionApplicationCount();
    rules = [initialPullRule, survivingPlaceRule];
    harness.invalidate();
    await harness.flush();
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);

    applicationCount = positionApplicationCount();
    rules = [];
    harness.invalidate();
    await harness.flush();
    expect(positionApplicationCount()).toBe(applicationCount + 1);
    expect(plainApply).toHaveBeenCalledTimes(plainApplyCount);
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(sortedPositions(automaticPositions));
    expect(fit).not.toHaveBeenCalled();
    expect(center).not.toHaveBeenCalled();
    harness.destroy();
  });

  it('uses raw-frame spatial adoption for a Pull cache hit with no plain position frame', async () => {
    const projection = globalTestProjection();
    const input = mapProjectionToGlobal(projection, settings);
    const cached = globalLayoutPositionsFromInput(input);
    const cache = new GlobalLayoutCache();
    cache.set(
      globalLayoutFingerprint(createGlobalLayoutRequest(input, settings, 100)),
      cached,
    );
    const layout = vi.fn();
    const pull = vi.fn(
      async (request: Omit<GlobalSpatialInfluenceRequest, 'requestId'>) =>
        ({
          schemaVersion: 1,
          kind: 'result',
          requestId: 1,
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
    const spatialApply = vi.spyOn(
      GlobalRendererSession.prototype,
      'applySpatialPositions',
    );
    const plainApply = vi.spyOn(
      GlobalRendererSession.prototype,
      'applyPositions',
    );
    const fit = vi
      .spyOn(GlobalRendererSession.prototype, 'fit')
      .mockImplementation(noop);
    const center = vi
      .spyOn(GlobalRendererSession.prototype, 'center')
      .mockResolvedValue(undefined);
    const spatialRules: readonly FolderSpatialRule[] = [
      {
        folderKey: 'alpha',
        behavior: 'pull',
        scope: { kind: 'exact' },
        anchor: { x: 0.5, y: 0.25 },
        strength: 70,
      },
    ];
    const layoutService = { layout, dispose: noop };
    const spatialInfluenceService = { layout: pull, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialRules,
        spatialSourceKey: 'cache-hit-workspace',
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutCache: cache,
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
    expect(layout).not.toHaveBeenCalled();
    expect(pull).toHaveBeenCalledTimes(1);
    // Cache adoption, Pull settlement, and the layout-commit re-evaluation are
    // distinct existing transactions; all must use the raw-frame path.
    expect(spatialApply).toHaveBeenCalledTimes(3);
    expect(plainApply).not.toHaveBeenCalled();
    expect(fit).not.toHaveBeenCalled();
    expect(center).not.toHaveBeenCalled();
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
          schemaVersion: 2,
          kind: 'result',
          requestId: 1,
          algorithm: 'reference-only',
          policyVersion: 'global-fa2-folder-convergence-v1',
          macroVersion: 'global-folder-none-v1',
          stopReason: 'max-iterations',
          iterationsCompleted: 640,
          macroStepsCompleted: 20,
          stableMacroSteps: 0,
          finalMacroStepIterations: 32,
          finalMovement: null,
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
            schemaVersion: 2,
            kind: 'result',
            requestId: 1,
            algorithm: 'reference-only',
            policyVersion: request.policy.version,
            macroVersion: request.macro.version,
            stopReason: 'max-iterations',
            iterationsCompleted: request.policy.maxIterations,
            macroStepsCompleted: Math.ceil(request.policy.maxIterations / 32),
            stableMacroSteps: 0,
            finalMacroStepIterations: 32,
            finalMovement: null,
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
