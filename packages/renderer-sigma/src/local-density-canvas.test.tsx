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
import { localDensityFramingRatio } from './local-density-framing';
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
import { LocalRendererSession } from './local-session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  LocalLayoutRequest,
  LocalLayoutResult,
  LocalRendererInstrumentation,
} from './local-types';

const noop = () => undefined;

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
  const request = createLocalLayoutRequest(input);
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
  const onDensityQaDiagnosticsChange = vi.fn();
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
      onDensityQaDiagnosticsChange,
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
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
    rawDecisionRatio: expected.ratio,
    effectiveRatio: expected.ratio,
    cameraRatio: expected.ratio,
    fallback: false,
  });

  const renderer = SigmaTestRenderer.instances[0]!;
  const rootViewportPoint = () => {
    const node = renderer.getNodeDisplayData(input.rootNodeKey)! as {
      x: number;
      y: number;
    };
    return renderer.framedGraphToViewport(node);
  };
  const anchor = rootViewportPoint();
  densityFramingStrength = 0;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(1);
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
    rawDecisionRatio: expected.ratio,
    effectiveRatio: 1,
    cameraRatio: 1,
    fallback: false,
  });
  expect(rootViewportPoint().x).toBeCloseTo(anchor.x);
  expect(rootViewportPoint().y).toBeCloseTo(anchor.y);
  densityFramingStrength = 100;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBe(expected.ratio);
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
    rawDecisionRatio: expected.ratio,
    effectiveRatio: expected.ratio,
    cameraRatio: expected.ratio,
    fallback: false,
  });
  expect(rootViewportPoint().x).toBeCloseTo(anchor.x);
  expect(rootViewportPoint().y).toBeCloseTo(anchor.y);
  densityFramingStrength = 150;
  harness.invalidate();
  await harness.flush();
  expect(SigmaTestRenderer.instances[0]!.camera.ratio).toBeCloseTo(
    localDensityFramingRatio(expected.ratio, 150),
  );
  expect(rootViewportPoint().x).toBeCloseTo(anchor.x);
  expect(rootViewportPoint().y).toBeCloseTo(anchor.y);
  expect(layout).not.toHaveBeenCalled();
  expect(counts.get('local-density-evaluations')).toBe(1);
  expect(counts.get('local-layouts')).toBeUndefined();
  harness.destroy();
  expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith(undefined);
});

it('cancels a queued automatic Fit when Local wheel navigation is newer', async () => {
  let resolveLayout: ((result: LocalLayoutResult) => void) | undefined;
  let pendingRequest: Omit<LocalLayoutRequest, 'requestId'> | undefined;
  const layout = vi.fn(
    (request: Omit<LocalLayoutRequest, 'requestId'>) =>
      new Promise<LocalLayoutResult>((resolve) => {
        pendingRequest = request;
        resolveLayout = resolve;
      }),
  );
  const fit = vi
    .spyOn(LocalRendererSession.prototype, 'fit')
    .mockImplementation(noop);
  const onFitRequestConsumed = vi.fn();
  const layoutService = { layout, dispose: noop };
  const projection = localTestProjection();
  const harness = new CanvasTestHarness(() =>
    LocalGraphCanvas({
      automaticFitRequestKey: 1,
      fitRequestKey: 1,
      layoutRequestKey: 0,
      layoutService,
      onFailure: vi.fn(),
      onFitRequestConsumed,
      onSelectionChange: noop,
      onViewportObservation: noop,
      projection,
      rootEntityId: 'root',
      selection: null,
      trackpadZoomMode: 'pinch-zoom',
    }),
  );

  await harness.flush();
  const renderer = SigmaTestRenderer.instances[0]!;
  const wheel = renderer.captor.on.mock.calls.find(
    ([event]) => event === 'wheel',
  )?.[1] as ((coordinates: Record<string, unknown>) => void) | undefined;
  wheel?.({
    x: 400,
    y: 300,
    original: {
      ctrlKey: false,
      deltaMode: 0,
      deltaX: 0,
      deltaY: 4,
    },
    preventSigmaDefault: vi.fn(),
  });
  expect(onFitRequestConsumed).toHaveBeenCalledWith(1);
  if (pendingRequest === undefined || resolveLayout === undefined) {
    throw new Error('Expected a pending Local layout request.');
  }
  resolveLayout({
    schemaVersion: 2,
    kind: 'result',
    requestId: 1,
    stopReason: 'stable',
    policyVersion: pendingRequest.policy.version,
    iterationsCompleted: 0,
    batchesCompleted: 0,
    stableBatches: 0,
    finalMovement: null,
    computeMs: 0,
    positions: pendingRequest.nodes.map(({ key, x, y }) => ({ key, x, y })),
  });
  await harness.flush();

  expect(fit).not.toHaveBeenCalled();
  harness.destroy();
});
