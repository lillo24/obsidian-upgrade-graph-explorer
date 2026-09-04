import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import { resolveGlobalDensityFit } from './global-density';
import { globalDensityFramingRatio } from './global-density-framing';
import { GlobalGraphCanvas } from './GlobalGraphCanvas';
import { GlobalLayoutCache } from './layout-cache';
import { createGlobalLayoutRequest, globalLayoutFingerprint } from './layout';
import { mapProjectionToGlobalTopology } from './mapping';
import { SigmaTestRenderer } from './sigma-test-renderer';
import { globalTestProjection } from './test-fixture';
import type { GlobalRendererInstrumentation } from './types';

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

it('previews cached All density without ForceAtlas2 or spatial Pull work', async () => {
  const projection = globalTestProjection();
  const settings = { folderClustering: true, spacingPreset: 'normal' } as const;
  const input = mapProjectionToGlobalTopology(projection);
  const request = createGlobalLayoutRequest(input, settings, 100);
  const positions = input.nodes.map((node, index) => ({
    key: node.key,
    x: Math.cos(index) * 100,
    y: Math.sin(index) * 100,
  }));
  const expected = resolveGlobalDensityFit(input, positions);
  expect(expected.fallback).toBe(false);
  const cache = new GlobalLayoutCache();
  cache.set(globalLayoutFingerprint(request), positions);
  const layout = vi.fn();
  const spatialLayout = vi.fn();
  const layoutService = { layout, dispose: vi.fn() };
  const spatialInfluenceService = {
    layout: spatialLayout,
    dispose: vi.fn(),
  };
  const onFailure = vi.fn();
  const onNodeActivate = vi.fn();
  const onSelectionChange = vi.fn();
  const onViewportObservation = vi.fn();
  const counts = new Map<string, number>();
  const instrumentation: GlobalRendererInstrumentation = {
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
  const onDensityQaDiagnosticsChange = vi.fn();
  let densityFramingStrength = 100;
  const harness = new CanvasTestHarness(() =>
    GlobalGraphCanvas({
      densityFramingStrength,
      fitRequestKey: 0,
      instrumentation,
      layoutCache: cache,
      layoutRequestKey: 0,
      layoutService,
      spatialInfluenceService,
      onDensityQaDiagnosticsChange,
      onFailure,
      onNodeActivate,
      onSelectionChange,
      onViewportObservation,
      projection,
      selection: null,
      settings,
      trackpadZoomMode: 'pinch-zoom',
    }),
  );

  await harness.flush();

  expect(layout).not.toHaveBeenCalled();
  expect(spatialLayout).not.toHaveBeenCalled();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(expected.ratio);
  const densityEvaluations = counts.get('global-density-evaluations');
  expect(densityEvaluations).toBeGreaterThan(0);
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
    rawDecisionRatio: expected.ratio,
    effectiveRatio: expected.ratio,
    cameraRatio: expected.ratio,
    fallback: false,
    nodeCount: input.nodes.length,
    edgeCount: input.edges.length,
    isolatedNodeCount: 0,
  });

  densityFramingStrength = 0;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(1);
  densityFramingStrength = 100;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(expected.ratio);
  densityFramingStrength = 150;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBeCloseTo(
    globalDensityFramingRatio(expected.ratio, 150),
  );
  expect(counts.get('global-density-evaluations')).toBe(densityEvaluations);
  expect(counts.get('global-layouts')).toBeUndefined();
  expect(counts.get('spatial-pull-requests')).toBeUndefined();
  expect(layout).not.toHaveBeenCalled();
  expect(spatialLayout).not.toHaveBeenCalled();
  harness.destroy();
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith(undefined);
});
