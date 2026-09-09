import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { FolderClusterAnchorMap } from '@icarus-graph-explorer/spatial-overrides';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

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
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import { mapProjectionToGlobal } from './mapping';
import { composeGlobalSpatialOverrides } from './spatial';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutPosition,
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalLayoutSettings,
  GlobalRendererInstrumentation,
} from './types';

const noop = () => undefined;
const settings = { folderClustering: false, spacingPreset: 'normal' } as const;

function automaticPositions(scale: number): readonly GlobalLayoutPosition[] {
  return [
    { key: 'entity:doc-a', x: -10 * scale, y: 0 },
    { key: 'entity:doc-b', x: -8 * scale, y: 2 * scale },
    { key: 'entity:doc-c', x: 8 * scale, y: -2 * scale },
    { key: 'entity:doc-root', x: 10 * scale, y: 0 },
  ];
}

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
  let frame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(performance.now()));
    return ++frame;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('All Network automatic/displayed position separation', () => {
  it('recomposes anchor edits without layout/topology work and keeps cache/seeds automatic', async () => {
    const projection = globalTestProjection();
    const input = mapProjectionToGlobal(projection, settings);
    let anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.7, y: 0.7 }],
    ]);
    const renderOnly = {
      presentationOverrides: undefined as
        EntityPresentationOverrideMap | undefined,
      visualGroupStyles: undefined as VisualGroupPresentationMap | undefined,
    };
    let currentSettings: GlobalLayoutSettings = settings;
    let layoutRequestKey = 0;
    const counts = new Map<string, number>();
    const instrumentation = {
      count: (operation: string) =>
        counts.set(operation, (counts.get(operation) ?? 0) + 1),
      measure: <T,>(
        _phase: string,
        operation: string | undefined,
        run: () => T,
      ): T => {
        if (operation !== undefined) {
          counts.set(operation, (counts.get(operation) ?? 0) + 1);
        }
        return run();
      },
      record: noop,
    } as GlobalRendererInstrumentation;
    const requests: Omit<GlobalLayoutRequest, 'requestId'>[] = [];
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) => {
        requests.push(request);
        return {
          schemaVersion: 3,
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
          positions: automaticPositions(layout.mock.calls.length),
          metrics: {
            meanWithinFolderDistance: 0,
            meanCrossFolderDistance: 0,
            meanCrossFolderReferenceLength: 0,
            meanDisplacementFromInput: 0,
          },
        } as GlobalLayoutResult;
      },
    );
    const cache = new GlobalLayoutCache();
    const layoutService = { layout, dispose: noop };
    const cacheSet = vi.spyOn(cache, 'set');
    const onFailure = vi.fn();
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings: currentSettings,
        spatialOverrides: anchors,
        ...(renderOnly.presentationOverrides === undefined
          ? {}
          : { presentationOverrides: renderOnly.presentationOverrides }),
        ...(renderOnly.visualGroupStyles === undefined
          ? {}
          : { visualGroupStyles: renderOnly.visualGroupStyles }),
        fitRequestKey: 0,
        layoutRequestKey,
        layoutService,
        layoutCache: cache,
        instrumentation,
        onFailure,
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );

    await harness.flush();
    expect(onFailure).not.toHaveBeenCalled();
    expect(layout).toHaveBeenCalledTimes(1);
    const renderer = SigmaTestRenderer.instances[0]!;
    const firstAutomatic = automaticPositions(1);
    const firstDisplayed = composeGlobalSpatialOverrides(
      firstAutomatic,
      input,
      anchors,
    ).displayedPositions;
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(firstDisplayed),
    );
    expect(cacheSet).toHaveBeenLastCalledWith(
      expect.any(String),
      firstAutomatic,
    );

    const beforeAnchorEdit = new Map(counts);
    anchors = new Map([['alpha', { x: -0.7, y: -0.7 }]]);
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(counts.get('global-mappings')).toBe(
      beforeAnchorEdit.get('global-mappings'),
    );
    expect(counts.get('graphology-reconciliations')).toBe(
      beforeAnchorEdit.get('graphology-reconciliations'),
    );
    expect(counts.get('global-layouts')).toBe(
      beforeAnchorEdit.get('global-layouts'),
    );
    expect(counts.get('spatial-compositions')).toBe(
      (beforeAnchorEdit.get('spatial-compositions') ?? 0) + 1,
    );
    expect(counts.get('spatial-applies')).toBe(
      (beforeAnchorEdit.get('spatial-applies') ?? 0) + 1,
    );
    const secondDisplayed = composeGlobalSpatialOverrides(
      firstAutomatic,
      input,
      anchors,
    ).displayedPositions;
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(secondDisplayed),
    );

    const beforeSizeEdit = graphPositions(renderer);
    renderOnly.visualGroupStyles = new Map([
      ['doc-a', { groupName: 'Synthetic', color: 'teal', accent: '#0f766e' }],
    ]) as VisualGroupPresentationMap;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(graphPositions(renderer)).toEqual(beforeSizeEdit);

    renderOnly.presentationOverrides = new Map([['doc-c', { sizeScale: 2 }]]);
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(graphPositions(renderer)).toEqual(beforeSizeEdit);

    layoutRequestKey += 1;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    const secondRequest = requests[1]!;
    expect(
      sortedPositions(
        secondRequest.nodes.map(({ key, x, y }) => ({ key, x, y })),
      ),
    ).toEqual(sortedPositions(firstAutomatic));
    const secondAutomatic = automaticPositions(2);
    expect(cacheSet).toHaveBeenLastCalledWith(
      expect.any(String),
      secondAutomatic,
    );
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(secondAutomatic, input, anchors)
          .displayedPositions,
      ),
    );

    currentSettings = { folderClustering: false, spacingPreset: 'spacious' };
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(3);
    const thirdAutomatic = automaticPositions(3);
    const updatedInput = mapProjectionToGlobal(projection, currentSettings);
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(thirdAutomatic, updatedInput, anchors)
          .displayedPositions,
      ),
    );

    const beforeReset = new Map(counts);
    anchors = new Map();
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(3);
    expect(counts.get('spatial-compositions')).toBe(
      (beforeReset.get('spatial-compositions') ?? 0) + 1,
    );
    expect(counts.get('spatial-applies')).toBe(
      (beforeReset.get('spatial-applies') ?? 0) + 1,
    );
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(thirdAutomatic),
    );
    harness.destroy();
  });

  it('combines a late automatic worker result with the latest anchor map', async () => {
    const projection = globalTestProjection();
    const input = mapProjectionToGlobal(projection, settings);
    let anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.8, y: 0.8 }],
    ]);
    let resolveLayout!: (result: GlobalLayoutResult) => void;
    const layout = vi.fn(
      () =>
        new Promise<GlobalLayoutResult>((resolve) => {
          resolveLayout = resolve;
        }),
    );
    const layoutService = { layout, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialOverrides: anchors,
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutService,
        onFailure: vi.fn(),
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );
    await harness.flush();
    anchors = new Map([['alpha', { x: -0.6, y: -0.4 }]]);
    harness.invalidate();
    await harness.flush();
    const automatic = automaticPositions(1);
    resolveLayout({
      schemaVersion: 3,
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
      positions: automatic,
      metrics: {
        meanWithinFolderDistance: 0,
        meanCrossFolderDistance: 0,
        meanCrossFolderReferenceLength: 0,
        meanDisplacementFromInput: 0,
      },
    });
    await harness.flush();
    const renderer = SigmaTestRenderer.instances[0]!;
    expect(sortedPositions(graphPositions(renderer))).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(automatic, input, anchors)
          .displayedPositions,
      ),
    );
    harness.destroy();
  });

  it('uses an automatic cache hit with new anchors without a worker request', async () => {
    const projection = globalTestProjection();
    const input = mapProjectionToGlobal(projection, settings);
    const cachedAutomatic = automaticPositions(1);
    const cache = new GlobalLayoutCache();
    cache.set(
      globalLayoutFingerprint(createGlobalLayoutRequest(input, settings, 100)),
      cachedAutomatic,
    );
    let anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.2, y: 0.2 }],
    ]);
    const layout = vi.fn();
    const layoutService = { layout, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialOverrides: anchors,
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutService,
        layoutCache: cache,
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
    anchors = new Map([['alpha', { x: 0.9, y: -0.8 }]]);
    harness.invalidate();
    await harness.flush();
    expect(layout).not.toHaveBeenCalled();
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(cachedAutomatic, input, anchors)
          .displayedPositions,
      ),
    );
    harness.destroy();
  });

  it('keeps a query-hidden folder dormant and reactivates it on exact return', async () => {
    const fullProjection = globalTestProjection();
    let projection = fullProjection;
    const anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.75, y: 0.5 }],
    ]);
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
        ({
          schemaVersion: 3,
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
    const layoutService = { layout, dispose: noop };
    const cache = new GlobalLayoutCache();
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialOverrides: anchors,
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutService,
        layoutCache: cache,
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

    const visibleNodeIds = new Set(['entity:doc-c', 'entity:doc-root']);
    projection = {
      ...fullProjection,
      nodes: fullProjection.nodes.filter((node) => visibleNodeIds.has(node.id)),
      edges: fullProjection.edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.sourceNodeId) &&
          visibleNodeIds.has(edge.targetNodeId),
      ),
    };
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    expect(
      graphPositions(SigmaTestRenderer.instances[0]!).some(({ key }) =>
        key.includes('doc-a'),
      ),
    ).toBe(false);
    expect(anchors.has('alpha')).toBe(true);

    projection = fullProjection;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    const fullInput = mapProjectionToGlobal(fullProjection, settings);
    const firstResult = (await layout.mock.results[0]!
      .value) as GlobalLayoutResult;
    const expectedAutomatic = firstResult.positions;
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(expectedAutomatic, fullInput, anchors)
          .displayedPositions,
      ),
    );
    harness.destroy();
  });

  it('recomposes surviving anchored nodes before a changed-topology worker completes', async () => {
    const fullProjection = globalTestProjection();
    let projection = fullProjection;
    const anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.8, y: 0.6 }],
    ]);
    let requestCount = 0;
    const firstAutomatic = automaticPositions(1);
    const layout = vi.fn((): Promise<GlobalLayoutResult> => {
      requestCount += 1;
      if (requestCount > 1) return new Promise<GlobalLayoutResult>(() => {});
      return Promise.resolve({
        schemaVersion: 3,
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
        positions: firstAutomatic,
        metrics: {
          meanWithinFolderDistance: 0,
          meanCrossFolderDistance: 0,
          meanCrossFolderReferenceLength: 0,
          meanDisplacementFromInput: 0,
        },
      });
    });
    const layoutService = { layout, dispose: noop };
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings,
        spatialOverrides: anchors,
        fitRequestKey: 0,
        layoutRequestKey: 0,
        layoutService,
        onFailure: vi.fn(),
        onNodeActivate: noop,
        onSelectionChange: noop,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );
    await harness.flush();

    const visibleNodeIds = new Set(['entity:doc-a', 'entity:doc-b']);
    projection = {
      ...fullProjection,
      nodes: fullProjection.nodes.filter((node) => visibleNodeIds.has(node.id)),
      edges: fullProjection.edges.filter(
        (edge) =>
          visibleNodeIds.has(edge.sourceNodeId) &&
          visibleNodeIds.has(edge.targetNodeId),
      ),
    };
    harness.invalidate();
    await harness.flush();

    const partialInput = mapProjectionToGlobal(projection, settings);
    const partialAutomatic = firstAutomatic.filter(({ key }) =>
      visibleNodeIds.has(key),
    );
    expect(layout).toHaveBeenCalledTimes(2);
    expect(
      sortedPositions(graphPositions(SigmaTestRenderer.instances[0]!)),
    ).toEqual(
      sortedPositions(
        composeGlobalSpatialOverrides(partialAutomatic, partialInput, anchors)
          .displayedPositions,
      ),
    );
    harness.destroy();
  });
});
