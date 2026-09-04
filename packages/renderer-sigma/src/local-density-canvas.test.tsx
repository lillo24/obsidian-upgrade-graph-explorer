import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  ...(await import('./canvas-test-harness')).canvasTestHooks,
}));
vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { CanvasTestHarness } from './canvas-test-harness';
import { resolveLocalDensityFit } from './local-density';
import { LocalGraphCanvas } from './LocalGraphCanvas';
import { LocalLayoutCache } from './local-layout-cache';
import {
  createLocalLayoutRequest,
  localLayoutFingerprint,
} from './local-layout';
import {
  mapProjectionToLocalTopology,
  seedLocalRendererInput,
} from './local-mapping';
import { localTestProjection } from './local-test-fixture';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { LocalRendererInstrumentation } from './local-types';

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

it('installs an exact cache-hit density frame before first render without a worker', async () => {
  const projection = localTestProjection();
  const input = seedLocalRendererInput(
    mapProjectionToLocalTopology(projection, 'root'),
  );
  const request = createLocalLayoutRequest(input, 160);
  const positions = input.nodes.map((node, index) => ({
    key: node.key,
    x: index * 17,
    y: (index % 2) * 13,
  }));
  const expected = resolveLocalDensityFit(input, positions);
  expect(expected.fallback).toBe(false);
  const cache = new LocalLayoutCache();
  cache.set(localLayoutFingerprint(request), positions);
  const layout = vi.fn();
  const layoutService = { layout, dispose: vi.fn() };
  const onFailure = vi.fn();
  const onSelectionChange = vi.fn();
  const onViewportObservation = vi.fn();
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
  let densityFramingStrength = 100;
  const harness = new CanvasTestHarness(() =>
    LocalGraphCanvas({
      densityFramingStrength,
      instrumentation,
      layoutCache: cache,
      layoutRequestKey: 0,
      layoutService,
      onFailure,
      onSelectionChange,
      onViewportObservation,
      projection,
      rootEntityId: 'root',
      selection: null,
      trackpadZoomMode: 'pinch-zoom',
    }),
  );

  await harness.flush();

  expect(layout).not.toHaveBeenCalled();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(expected.ratio);
  expect(counts.get('local-density-evaluations')).toBe(1);
  expect(counts.get('local-layouts')).toBeUndefined();

  densityFramingStrength = 0;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(1);
  expect(layout).not.toHaveBeenCalled();
  expect(counts.get('local-density-evaluations')).toBe(1);
  expect(counts.get('local-layouts')).toBeUndefined();
  harness.destroy();
});
