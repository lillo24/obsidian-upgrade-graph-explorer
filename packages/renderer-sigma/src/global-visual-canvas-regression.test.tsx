import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityPresentationOverrideMap } from '@icarus-graph-explorer/presentation-overrides';
import type { FolderClusterAnchorMap } from '@icarus-graph-explorer/spatial-overrides';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';
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
import {
  automaticGlobalEdgeSize,
  automaticGlobalNodeSize,
  mapProjectionToGlobalTopology,
} from './mapping';
import { createGlobalReferenceDegreeIndex } from './graph';
import { customGlobalLayoutSettings } from './settings';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';
import type {
  GlobalLayoutRequest,
  GlobalLayoutResult,
  GlobalLayoutSettings,
  GlobalRendererInstrumentation,
} from './types';

const noop = () => undefined;

function settings(
  custom: Partial<ReturnType<typeof customGlobalLayoutSettings>> = {},
): GlobalLayoutSettings {
  return {
    folderClustering: false,
    spacingPreset: 'normal',
    custom: { ...customGlobalLayoutSettings('normal'), ...custom },
  };
}

function coordinates(renderer: SigmaTestRenderer) {
  return renderer.graph.nodes().map((key) => ({
    key,
    x: renderer.graph.getNodeAttribute(key, 'x'),
    y: renderer.graph.getNodeAttribute(key, 'y'),
  }));
}

function layoutResult(
  request: Omit<GlobalLayoutRequest, 'requestId'>,
  sequence: number,
): GlobalLayoutResult {
  return {
    schemaVersion: 1,
    kind: 'result',
    requestId: sequence,
    algorithm: request.algorithm,
    computeMs: 0,
    folderPriorMs: 0,
    positions: request.nodes.map((node, index) => ({
      key: node.key,
      x: sequence * 10 + index * 2,
      y: sequence * -5 + index,
    })),
    metrics: {
      meanWithinFolderDistance: 0,
      meanCrossFolderDistance: 0,
      meanCrossFolderReferenceLength: 0,
      meanDisplacementFromInput: 0,
    },
  };
}

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
  });
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    visibilityState: 'visible',
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('All Network global visual settings ownership', () => {
  it('keeps rapid visual sequences out of layout, coordinates, camera, selection, and folder arrangement', async () => {
    const projection = globalTestProjection();
    const anchors: FolderClusterAnchorMap = new Map([
      ['alpha', { x: 0.65, y: -0.4 }],
    ]);
    const presentationOverrides: EntityPresentationOverrideMap = new Map([
      ['doc-a', { sizeScale: 1.5 }],
    ]);
    const visualGroupStyles: VisualGroupPresentationMap = new Map([
      ['doc-a', { groupName: 'Group', color: 'teal', accent: '#0f766e' }],
    ]);
    let currentSettings = settings();
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
    const layout = vi.fn(
      async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
        layoutResult(request, layout.mock.calls.length),
    );
    const cache = new GlobalLayoutCache();
    const cacheSet = vi.spyOn(cache, 'set');
    const onSelectionChange = vi.fn();
    const onActiveChange = vi.fn();
    const onActiveFolderChange = vi.fn();
    const onAvailabilityChange = vi.fn();
    const layoutService = { layout, dispose: noop };
    const folderArrangement = {
      active: true,
      activeFolderKey: 'alpha',
      anchorCount: 1,
      editable: true,
      focusRequestKey: 0,
      persistenceStatus: 'Saved',
      onActiveChange,
      onActiveFolderChange,
      onAnnouncement: noop,
      onAvailabilityChange,
      onCommitAnchor: () => undefined,
      onResetAll: () => undefined,
      onResetFolder: () => undefined,
    } as const;
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings: currentSettings,
        spatialOverrides: anchors,
        presentationOverrides,
        visualGroupStyles,
        folderArrangement,
        fitRequestKey: 0,
        layoutRequestKey,
        layoutService,
        layoutCache: cache,
        instrumentation,
        onFailure: vi.fn(),
        onNodeActivate: noop,
        onSelectionChange,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );

    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    const renderer = SigmaTestRenderer.instances[0]!;
    const positionsBefore = coordinates(renderer);
    const cameraBefore = renderer.camera.getState();
    const graphSizesBefore = renderer.graph
      .nodes()
      .map((key) => renderer.graph.getNodeAttribute(key, 'size'));
    const graphEdgeSizesBefore = renderer.graph
      .edges()
      .map((key) => renderer.graph.getEdgeAttribute(key, 'size'));
    const countBefore = new Map(counts);
    const cacheWritesBefore = cacheSet.mock.calls.length;
    const topologyInput = mapProjectionToGlobalTopology(projection);
    const degrees = createGlobalReferenceDegreeIndex(topologyInput);

    for (const nodeSize of [4, 4.25, 4.5, 5, 6, 7, 8, 9]) {
      currentSettings = settings({
        ...currentSettings.custom,
        nodeSize,
      });
      harness.invalidate();
      await harness.flush();
      expect(layout).toHaveBeenCalledTimes(1);
      expect(coordinates(renderer)).toEqual(positionsBefore);
    }
    const automaticSize = automaticGlobalNodeSize(
      'document',
      degrees.get('entity:doc-a') ?? 0,
      currentSettings.custom!,
    );
    expect(renderer.displayNodes.get('entity:doc-a')).toMatchObject({
      color: '#0f766e',
      size: automaticSize * 1.5,
    });

    for (const referenceDegreeSizeInfluence of [0, 10, 25, 50, 75, 100]) {
      currentSettings = settings({
        ...currentSettings.custom,
        referenceDegreeSizeInfluence,
      });
      harness.invalidate();
      await harness.flush();
      expect(layout).toHaveBeenCalledTimes(1);
      expect(coordinates(renderer)).toEqual(positionsBefore);
    }

    const edgeKey = renderer.graph.edges()[0]!;
    const displayedEdgeBefore = renderer.displayEdges.get(edgeKey)
      ?.size as number;
    const thicknessBefore = currentSettings.custom!.linkThickness;
    for (const linkThickness of [0.2, 0.5, 0.7, 1, 1.5, 2, 2.5]) {
      currentSettings = settings({
        ...currentSettings.custom,
        linkThickness,
      });
      harness.invalidate();
      await harness.flush();
      expect(layout).toHaveBeenCalledTimes(1);
      expect(coordinates(renderer)).toEqual(positionsBefore);
    }
    expect(renderer.displayEdges.get(edgeKey)?.size).toBeCloseTo(
      displayedEdgeBefore *
        (currentSettings.custom!.linkThickness / thicknessBefore),
    );
    expect(
      automaticGlobalEdgeSize(
        renderer.graph.getEdgeAttribute(edgeKey, 'referenceCount') as number,
        currentSettings.custom!,
      ),
    ).toBeGreaterThan(0);

    for (const labelThreshold of [2, 4, 7, 10, 13, 16]) {
      currentSettings = settings({
        ...currentSettings.custom,
        labelThreshold,
      });
      harness.invalidate();
      await harness.flush();
      expect(layout).toHaveBeenCalledTimes(1);
      expect(coordinates(renderer)).toEqual(positionsBefore);
    }
    expect(renderer.setSetting).toHaveBeenLastCalledWith(
      'labelRenderedSizeThreshold',
      16,
    );

    expect(counts.get('global-mappings')).toBe(
      countBefore.get('global-mappings'),
    );
    expect(counts.get('graphology-reconciliations')).toBe(
      countBefore.get('graphology-reconciliations'),
    );
    expect(counts.get('global-layouts')).toBe(
      countBefore.get('global-layouts'),
    );
    expect(cacheSet).toHaveBeenCalledTimes(cacheWritesBefore);
    expect(
      renderer.graph
        .nodes()
        .map((key) => renderer.graph.getNodeAttribute(key, 'size')),
    ).toEqual(graphSizesBefore);
    expect(
      renderer.graph
        .edges()
        .map((key) => renderer.graph.getEdgeAttribute(key, 'size')),
    ).toEqual(graphEdgeSizesBefore);
    expect(renderer.camera.getState()).toEqual(cameraBefore);
    expect(renderer.camera.setState).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onActiveChange).not.toHaveBeenCalled();
    expect(onActiveFolderChange).not.toHaveBeenCalled();
    expect(
      renderer.refresh.mock.calls.some(
        ([options]) => options?.skipIndexation === false,
      ),
    ).toBe(true);
    expect(
      renderer.refresh.mock.calls.some(
        ([options]) => (options?.partialGraph?.edges?.length ?? 0) > 0,
      ),
    ).toBe(true);

    currentSettings = settings({
      ...currentSettings.custom,
      linkForce: 1.2,
    });
    layoutRequestKey += 1;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);

    currentSettings = settings({
      ...currentSettings.custom,
      betweenFolderSpacing: 5,
    });
    layoutRequestKey += 1;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(3);
    harness.destroy();
  });

  it('updates appearance after layout failure without using a visual change as retry', async () => {
    let currentSettings = settings();
    let layoutRequestKey = 0;
    const layout = vi.fn(async () => {
      throw new Error('worker unavailable');
    });
    const projection = globalTestProjection();
    const layoutService = { layout, dispose: noop };
    const onFailure = vi.fn();
    const onSelectionChange = vi.fn();
    const harness = new CanvasTestHarness(() =>
      GlobalGraphCanvas({
        projection,
        settings: currentSettings,
        fitRequestKey: 0,
        layoutRequestKey,
        layoutService,
        onFailure,
        onNodeActivate: noop,
        onSelectionChange,
        onViewportObservation: noop,
        selection: null,
        trackpadZoomMode: 'pinch-zoom',
      }),
    );
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    const renderer = SigmaTestRenderer.instances[0]!;
    const before = coordinates(renderer);
    const displayedBefore = renderer.displayNodes.get('entity:doc-a')?.size;

    currentSettings = settings({ nodeSize: 8 });
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(1);
    expect(coordinates(renderer)).toEqual(before);
    expect(renderer.displayNodes.get('entity:doc-a')?.size).not.toBe(
      displayedBefore,
    );

    currentSettings = settings({ nodeSize: 8, linkForce: 1.2 });
    layoutRequestKey += 1;
    harness.invalidate();
    await harness.flush();
    expect(layout).toHaveBeenCalledTimes(2);
    harness.destroy();
  });

  it.each([0, 1, 3, 250])(
    'keeps visual refresh safe for a %i-node graph',
    async (nodeCount) => {
      const source = globalTestProjection().nodes.find(
        (node) => node.kind === 'entity',
      )!;
      const projection: ViewProjection = {
        nodes: Array.from({ length: nodeCount }, (_, index) => ({
          ...source,
          id: `entity:generated-${index}`,
          entityId: `generated-${index}`,
          sourcePath: `folder-${index % 5}/Generated-${index}.md`,
          title: `Generated ${index}`,
        })),
        edges: [],
        issues: [],
      };
      let currentSettings = settings();
      const layout = vi.fn(
        async (request: Omit<GlobalLayoutRequest, 'requestId'>) =>
          layoutResult(request, 1),
      );
      const layoutService = { layout, dispose: noop };
      const harness = new CanvasTestHarness(() =>
        GlobalGraphCanvas({
          projection,
          settings: currentSettings,
          fitRequestKey: 0,
          layoutRequestKey: 0,
          layoutService,
          onFailure: vi.fn(),
          onNodeActivate: noop,
          onSelectionChange: vi.fn(),
          onViewportObservation: noop,
          selection: null,
          trackpadZoomMode: 'pinch-zoom',
        }),
      );
      await harness.flush();
      const calls = layout.mock.calls.length;
      const renderer = SigmaTestRenderer.instances.at(-1)!;
      const before = coordinates(renderer);
      currentSettings = settings({
        nodeSize: 7,
        referenceDegreeSizeInfluence: 100,
        linkThickness: 2,
        labelThreshold: 12,
      });
      harness.invalidate();
      await harness.flush();
      expect(layout).toHaveBeenCalledTimes(calls);
      expect(coordinates(renderer)).toEqual(before);
      harness.destroy();
    },
  );
});
