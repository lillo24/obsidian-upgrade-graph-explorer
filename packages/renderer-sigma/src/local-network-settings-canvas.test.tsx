import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import * as localLayout from './local-layout';
import { LocalLayoutCache } from './local-layout-cache';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import { localTestProjection } from './local-test-fixture';
import {
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  resolveNetworkSettings,
} from './settings';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalRendererInstrumentation,
} from './local-types';
import type { ResolvedNetworkSettings } from './types';

const noop = () => undefined;

function result(
  request: Omit<LocalLayoutRequest, 'requestId'>,
  requestId: number,
): LocalLayoutResult {
  return {
    schemaVersion: 2,
    kind: 'result',
    requestId,
    stopReason: 'stable',
    policyVersion: 'local-fa2-convergence-v1',
    iterationsCompleted: 96,
    batchesCompleted: 3,
    stableBatches: 3,
    finalMovement: null,
    computeMs: 1,
    positions: request.nodes.map(({ key }, index) => ({
      key,
      x: key === request.rootKey ? 0 : index * 11,
      y: key === request.rootKey ? 0 : index * -7,
    })),
  };
}

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps shared visual controls render-only and relayouts only for Reference Pull', async () => {
  const projection = localTestProjection();
  let networkSettings: ResolvedNetworkSettings = resolveNetworkSettings(
    DEFAULT_GLOBAL_LAYOUT_SETTINGS,
  );
  const requests: Omit<LocalLayoutRequest, 'requestId'>[] = [];
  const layout = vi.fn(
    async (request: Omit<LocalLayoutRequest, 'requestId'>) => {
      requests.push(request);
      return result(request, requests.length);
    },
  );
  const counts = new Map<string, number>();
  const instrumentation: LocalRendererInstrumentation = {
    count: (operation, amount = 1) =>
      counts.set(operation, (counts.get(operation) ?? 0) + amount),
    measure: (_phase, operation, run) => {
      if (operation !== undefined) {
        counts.set(operation, (counts.get(operation) ?? 0) + 1);
      }
      return run();
    },
    record: vi.fn(),
  };
  const layoutService = { layout, dispose: noop };
  const layoutCache = new LocalLayoutCache();
  const cacheDelete = vi.spyOn(layoutCache, 'delete');
  const cacheSet = vi.spyOn(layoutCache, 'set');
  const createRequest = vi.spyOn(localLayout, 'createLocalLayoutRequest');
  const createFingerprint = vi.spyOn(localLayout, 'localLayoutFingerprint');
  const presentationOverrides = new Map([['neighbor', { sizeScale: 1.5 }]]);
  const visualGroupStyles: VisualGroupPresentationMap = new Map([
    [
      'neighbor',
      { groupName: 'Shared controls', color: 'teal', accent: '#0f766e' },
    ],
  ]);
  const harness = new CanvasTestHarness(() =>
    LocalGraphCanvas({
      instrumentation,
      layoutCache,
      layoutRequestKey: 0,
      layoutService,
      networkSettings,
      onFailure: noop,
      onSelectionChange: noop,
      onViewportObservation: noop,
      presentationOverrides,
      projection,
      rootEntityId: 'root',
      selection: null,
      trackpadZoomMode: 'pinch-zoom',
      visualGroupStyles,
    }),
  );

  await harness.flush();
  expect(layout).toHaveBeenCalledTimes(1);
  expect(requests[0]!.settings).toMatchObject({
    hierarchyWeight: 6,
    referenceWeight: 1,
  });
  const renderer = SigmaTestRenderer.instances[0]!;
  const rootKey = renderer.graph
    .nodes()
    .find((key) => renderer.graph.getNodeAttribute(key, 'root') === true)!;
  const neighborKey = renderer.graph
    .nodes()
    .find(
      (key) => renderer.graph.getNodeAttribute(key, 'entityId') === 'neighbor',
    )!;
  const edgeKey = renderer.graph.edges()[0]!;
  const rootSize = renderer.displayNodes.get(rootKey)!.size as number;
  const neighborSize = renderer.displayNodes.get(neighborKey)!.size as number;
  expect(neighborSize).toBe(
    (renderer.graph.getNodeAttribute(neighborKey, 'size') as number) * 1.5,
  );
  expect(renderer.displayNodes.get(neighborKey)!.color).toBe('#0f766e');
  const edgeSize = renderer.displayEdges.get(edgeKey)!.size as number;
  const requestCallsBeforeVisuals = createRequest.mock.calls.length;
  const fingerprintCallsBeforeVisuals = createFingerprint.mock.calls.length;
  const cacheWritesBeforeVisuals = cacheSet.mock.calls.length;
  const positionsBefore = renderer.graph.nodes().map((key) => ({
    key,
    x: renderer.graph.getNodeAttribute(key, 'x') as number,
    y: renderer.graph.getNodeAttribute(key, 'y') as number,
  }));

  networkSettings = {
    ...networkSettings,
    nodeSize: networkSettings.nodeSize * 2,
    linkThickness: networkSettings.linkThickness * 2,
    labelThreshold: networkSettings.labelThreshold * 2,
  };
  harness.invalidate();
  await harness.flush();

  expect(layout).toHaveBeenCalledTimes(1);
  expect(counts.get('local-layouts')).toBe(1);
  expect(createRequest).toHaveBeenCalledTimes(requestCallsBeforeVisuals);
  expect(createFingerprint).toHaveBeenCalledTimes(
    fingerprintCallsBeforeVisuals,
  );
  expect(cacheSet).toHaveBeenCalledTimes(cacheWritesBeforeVisuals);
  expect(cacheDelete).not.toHaveBeenCalled();
  expect(renderer.displayNodes.get(rootKey)!.size).toBe(rootSize * 2);
  expect(renderer.displayNodes.get(neighborKey)!.size).toBe(neighborSize * 2);
  expect(renderer.displayNodes.get(neighborKey)!.color).toBe('#0f766e');
  expect(renderer.displayEdges.get(edgeKey)!.size).toBe(edgeSize * 2);
  expect(renderer.setSetting).toHaveBeenCalledWith(
    'labelRenderedSizeThreshold',
    8,
  );
  expect(
    renderer.graph.nodes().map((key) => ({
      key,
      x: renderer.graph.getNodeAttribute(key, 'x') as number,
      y: renderer.graph.getNodeAttribute(key, 'y') as number,
    })),
  ).toEqual(positionsBefore);

  networkSettings = { ...networkSettings, referencePull: 2 };
  harness.invalidate();
  await harness.flush();

  expect(layout).toHaveBeenCalledTimes(2);
  expect(counts.get('local-layouts')).toBe(2);
  expect(requests[1]!.settings).toMatchObject({
    hierarchyWeight: 6,
    referenceWeight: 2,
  });
  harness.destroy();
});
