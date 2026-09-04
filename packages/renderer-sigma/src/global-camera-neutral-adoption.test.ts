import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { captureRawViewportFrame } from './raw-viewport-frame';
import { resolveGlobalDensityFit } from './global-density';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  GlobalDensityQaDiagnostics,
  GlobalLayoutPosition,
  GlobalRendererInput,
  GlobalRendererInstrumentation,
} from './types';

const initialPositions: readonly GlobalLayoutPosition[] = [
  { key: 'left', x: -120, y: 0 },
  { key: 'middle', x: 0, y: 12 },
  { key: 'right', x: 110, y: -8 },
  { key: 'isolate', x: 15, y: 135 },
];

function positionsForStep(step: number): readonly GlobalLayoutPosition[] {
  return [
    { key: 'left', x: -120 - step * 3, y: step * 2 },
    { key: 'middle', x: step * 4, y: 12 - step },
    { key: 'right', x: 110 + step * step * 22, y: -8 - step * 5 },
    { key: 'isolate', x: 15 - step * 6, y: 135 + step * step * 18 },
  ];
}

function input(
  positions: readonly GlobalLayoutPosition[] = initialPositions,
): GlobalRendererInput {
  return {
    nodes: positions.map(({ key, x, y }) => ({
      key,
      attributes: {
        x,
        y,
        size: 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        folderKey: key === 'isolate' ? 'beta' : 'alpha',
        revealableDescendantCount: 0,
      },
    })),
    edges: [
      {
        key: 'left-middle',
        source: 'left',
        target: 'middle',
        attributes: {
          size: 1,
          color: '#91aab2',
          edgeKind: 'reference' as const,
          status: 'resolved' as const,
          referenceCount: 1,
        },
      },
      {
        key: 'middle-right',
        source: 'middle',
        target: 'right',
        attributes: {
          size: 1,
          color: '#91aab2',
          edgeKind: 'reference' as const,
          status: 'resolved' as const,
          referenceCount: 1,
        },
      },
    ],
    projectionIssues: [],
  };
}

function independentInput(
  positions: readonly GlobalLayoutPosition[],
): GlobalRendererInput {
  return {
    nodes: positions.map(({ key, x, y }) => ({
      key,
      attributes: {
        x,
        y,
        size: 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        folderKey: null,
        revealableDescendantCount: 0,
      },
    })),
    edges: [],
    projectionIssues: [],
  };
}

function ring(count: number): readonly GlobalLayoutPosition[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      key: `node-${index}`,
      x: Math.cos(angle) * 100,
      y: Math.sin(angle) * 100,
    };
  });
}

function bounds(positions: readonly GlobalLayoutPosition[]) {
  return {
    minX: Math.min(...positions.map(({ x }) => x)),
    maxX: Math.max(...positions.map(({ x }) => x)),
    minY: Math.min(...positions.map(({ y }) => y)),
    maxY: Math.max(...positions.map(({ y }) => y)),
  };
}

function meanDisplacement(
  before: readonly GlobalLayoutPosition[],
  after: readonly GlobalLayoutPosition[],
): number {
  const beforeByKey = new Map(
    before.map((position) => [position.key, position]),
  );
  return (
    after.reduce((sum, position) => {
      const previous = beforeByKey.get(position.key)!;
      return sum + Math.hypot(position.x - previous.x, position.y - previous.y);
    }, 0) / after.length
  );
}

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false })),
  });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      callback(0);
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('All Network camera-neutral authoritative adoption', () => {
  it('measures repeated Re-layout geometry without granting it camera authority', async () => {
    const diagnostics: GlobalDensityQaDiagnostics[] = [];
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
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: initialPositions,
        instrumentation,
        onDensityQaDiagnosticsChange: (value) => diagnostics.push(value),
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    renderer.normalizeDisplayCoordinates = true;
    renderer.scheduleRefresh();
    const automaticFraming = vi.spyOn(
      session as unknown as { applyAutomaticDensityFraming(): void },
      'applyAutomaticDensityFraming',
    );
    const cameraBefore = renderer.camera.getState();
    const rawFrameBefore = captureRawViewportFrame(renderer);
    const cameraWritesBefore = renderer.camera.setState.mock.calls.length;
    const framesBefore = renderer.frameSnapshots.length;
    const evidence: {
      step: number;
      cameraOwnership: unknown;
      camera: ReturnType<typeof renderer.camera.getState>;
      effectiveDensityRatio: number;
      rawDensityRatio: number;
      bounds: ReturnType<typeof bounds>;
      rawCenter: { x: number; y: number };
      graphUnitsPer100px: number;
      meanGeometryDisplacement: number;
    }[] = [];
    let previous = initialPositions;

    for (let step = 1; step <= 5; step += 1) {
      const positions = positionsForStep(step);
      await session.applyPositions(positions);
      const density = diagnostics.at(-1)!;
      const rawFrame = captureRawViewportFrame(renderer);
      evidence.push({
        step,
        cameraOwnership: Reflect.get(session, 'cameraOwnership'),
        camera: renderer.camera.getState(),
        effectiveDensityRatio: density.effectiveRatio,
        rawDensityRatio: density.rawDecisionRatio,
        bounds: bounds(positions),
        rawCenter: rawFrame.center,
        graphUnitsPer100px: rawFrame.graphUnitsPerPixel * 100,
        meanGeometryDisplacement: meanDisplacement(previous, positions),
      });
      previous = positions;
    }

    expect(counts.get('global-density-evaluations')).toBe(6);
    expect(
      evidence.every(({ rawDensityRatio }) => rawDensityRatio === 1.4),
    ).toBe(true);
    expect(evidence.every(({ camera }) => camera.ratio < 6)).toBe(true);
    expect(
      evidence.every(({ cameraOwnership }) => cameraOwnership === 'auto'),
    ).toBe(true);
    expect(evidence.every(({ camera }) => camera.ratio < 6)).toBe(true);
    expect(evidence.every(({ camera }) => camera.x === cameraBefore.x)).toBe(
      true,
    );
    expect(evidence.every(({ camera }) => camera.y === cameraBefore.y)).toBe(
      true,
    );
    expect(
      evidence.every(({ camera }) => camera.ratio === cameraBefore.ratio),
    ).toBe(true);
    expect(
      evidence.every(({ camera }) => camera.angle === cameraBefore.angle),
    ).toBe(true);
    expect(
      evidence.every(
        ({ rawCenter }) =>
          Math.abs(rawCenter.x - rawFrameBefore.center.x) < 1e-6 &&
          Math.abs(rawCenter.y - rawFrameBefore.center.y) < 1e-6,
      ),
    ).toBe(true);
    expect(
      evidence.every(
        ({ graphUnitsPer100px }) =>
          Math.abs(
            graphUnitsPer100px - rawFrameBefore.graphUnitsPerPixel * 100,
          ) < 1e-6,
      ),
    ).toBe(true);
    expect(automaticFraming).not.toHaveBeenCalled();
    expect(renderer.camera.setState).toHaveBeenCalledTimes(cameraWritesBefore);
    expect(renderer.camera.animate).not.toHaveBeenCalled();
    expect(renderer.frameSnapshots).toHaveLength(framesBefore + 5);
    expect(counts.get('global-centers')).toBeUndefined();
    session.destroy();
  });

  it('keeps the presented normalization frame when new geometry would require a clamped repair', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: initialPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    renderer.normalizeDisplayCoordinates = true;
    renderer.scheduleRefresh();
    const cameraBefore = renderer.camera.getState();
    const rawFrameBefore = captureRawViewportFrame(renderer);
    const cameraWritesBefore = renderer.camera.setState.mock.calls.length;
    const collapsed = initialPositions.map((position) => ({
      ...position,
      x: position.x * 0.001,
      y: position.y * 0.001,
    }));

    await session.applyPositions(collapsed);

    const rawFrameAfter = captureRawViewportFrame(renderer);
    expect(renderer.camera.getState()).toEqual(cameraBefore);
    expect(renderer.camera.ratio).toBeLessThan(6);
    expect(renderer.camera.setState).toHaveBeenCalledTimes(cameraWritesBefore);
    expect(rawFrameAfter.center.x).toBeCloseTo(rawFrameBefore.center.x, 8);
    expect(rawFrameAfter.center.y).toBeCloseTo(rawFrameBefore.center.y, 8);
    expect(rawFrameAfter.graphUnitsPerPixel).toBeCloseTo(
      rawFrameBefore.graphUnitsPerPixel,
      8,
    );
    session.destroy();
  });

  it('updates density evidence without applying the old automatic-camera path', async () => {
    const sparse = ring(20);
    const dense = [
      ...Array.from({ length: 19 }, (_, index) => ({
        key: `node-${index}`,
        x: (index % 5) * 0.1,
        y: Math.floor(index / 5) * 0.1,
      })),
      { key: 'node-19', x: 100, y: 100 },
    ];
    const graphInput = independentInput(sparse);
    const sparseDecision = resolveGlobalDensityFit(graphInput, sparse);
    const denseDecision = resolveGlobalDensityFit(graphInput, dense);
    expect(denseDecision.ratio).not.toBe(sparseDecision.ratio);

    const diagnostics: GlobalDensityQaDiagnostics[] = [];
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      graphInput,
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: sparse,
        onDensityQaDiagnosticsChange: (value) => diagnostics.push(value),
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    const cameraBefore = renderer.camera.getState();

    await session.applyPositions(dense);

    expect(diagnostics.at(-1)?.rawDecisionRatio).toBe(denseDecision.ratio);
    expect(renderer.camera.getState()).toEqual(cameraBefore);
    session.destroy();

    // This invokes the real session methods in the order used by the old
    // conflated policy and proves why a density change previously reframed.
    const legacy = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      graphInput,
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: sparse,
      },
    );
    const legacyRenderer = SigmaTestRenderer.instances.at(-1)!;
    const legacyPolicy = legacy as unknown as {
      measureDensity(positions: readonly GlobalLayoutPosition[]): void;
      applyAutomaticDensityFraming(): void;
    };
    legacyPolicy.measureDensity(dense);
    legacyPolicy.applyAutomaticDensityFraming();
    expect(legacyRenderer.camera.ratio).toBe(denseDecision.ratio);
    expect(legacyRenderer.camera.ratio).not.toBe(cameraBefore.ratio);
    legacy.destroy();
  });
});
