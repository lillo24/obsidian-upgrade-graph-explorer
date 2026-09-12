import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { LocalRendererSession } from './local-session';
import { networkPositionExtent } from './network-position-frame';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { LocalLayoutPosition, LocalRendererInput } from './local-types';
import type { GlobalLayoutPosition, GlobalRendererInput } from './types';

const basePositions: readonly GlobalLayoutPosition[] = [
  { key: 'left', x: -10, y: 0 },
  { key: 'middle', x: 0, y: 4 },
  { key: 'right', x: 12, y: -3 },
];

function globalInput(
  positions: readonly GlobalLayoutPosition[] = basePositions,
): GlobalRendererInput {
  return {
    nodes: positions.map(({ key, x, y }) => ({
      key,
      attributes: {
        x,
        y,
        size: key === 'right' ? 24 : 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        folderKey: 'fixture',
        revealableDescendantCount: 0,
      },
    })),
    edges: [],
    projectionIssues: [],
  };
}

function localInput(
  positions: readonly LocalLayoutPosition[],
): LocalRendererInput {
  return {
    rootNodeKey: 'left',
    nodes: positions.map(({ key, x, y }) => ({
      key,
      attributes: {
        x,
        y,
        size: key === 'right' ? 24 : 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        root: key === 'left',
        revealableDescendantCount: 0,
      },
    })),
    edges: [],
    projectionIssues: [],
  };
}

function expectFitAllIsIdempotent(
  renderer: SigmaTestRenderer,
  fit: () => void,
  positions: readonly GlobalLayoutPosition[],
): void {
  const before = {
    bbox: renderer.getCustomBBox(),
    camera: renderer.camera.getState(),
    points: positions.map(({ key, x, y }) => ({
      key,
      point: renderer.graphToViewport({ x, y }),
      radius: Number(renderer.getNodeDisplayData(key)?.size),
    })),
  };

  fit();

  expect(renderer.getCustomBBox()).toEqual(before.bbox);
  expect(renderer.camera.getState()).toEqual(before.camera);
  for (const { key, point, radius } of before.points) {
    const after = renderer.graphToViewport(
      positions.find((position) => position.key === key)!,
    );
    expect(after.x).toBeCloseTo(point.x, 8);
    expect(after.y).toBeCloseTo(point.y, 8);
    expect(Number(renderer.getNodeDisplayData(key)?.size)).toBe(radius);
    expect(point.x - radius).toBeGreaterThanOrEqual(24);
    expect(point.x + radius).toBeLessThanOrEqual(776);
    expect(point.y - radius).toBeGreaterThanOrEqual(0);
    expect(point.y + radius).toBeLessThanOrEqual(600);
  }
}

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: true })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authoritative initial Network presentation', () => {
  it.each([
    ['no spatial rules', basePositions],
    [
      'Pull',
      [
        { key: 'left', x: -20, y: 5 },
        { key: 'middle', x: 6, y: 12 },
        { key: 'right', x: 38, y: -8 },
      ],
    ],
    [
      'Place',
      [
        { key: 'left', x: -40, y: -30 },
        { key: 'middle', x: 15, y: 8 },
        { key: 'right', x: 150, y: 75 },
      ],
    ],
    [
      'Pull plus Place with an outlier',
      [
        { key: 'left', x: -900, y: -10 },
        { key: 'middle', x: 25, y: 30 },
        { key: 'right', x: 1_600, y: 110 },
      ],
    ],
  ] as const)(
    'makes final Global %s geometry authoritative before reveal',
    async (_label, finalPositions) => {
      const session = new GlobalRendererSession(
        { setAttribute: vi.fn() } as unknown as HTMLElement,
        globalInput(),
        {
          settings: { folderClustering: true, spacingPreset: 'normal' },
          trackpadZoomMode: 'pinch-zoom',
        },
      );
      const renderer = SigmaTestRenderer.instances.at(-1)!;
      renderer.normalizeDisplayCoordinates = true;

      await session.applyPositions(basePositions);
      const provisionalBBox = renderer.getCustomBBox();
      await session.applySpatialPositions(finalPositions);
      expect(renderer.getCustomBBox()).toEqual(provisionalBBox);

      await session.commitInitialPresentation(finalPositions, true);

      expect(renderer.getCustomBBox()).toEqual(
        networkPositionExtent(finalPositions),
      );
      expect(renderer.camera.getState()).toEqual({
        x: 0.5,
        y: 0.5,
        ratio: 1,
        angle: 0,
      });
      expectFitAllIsIdempotent(renderer, () => session.fit(), finalPositions);
      session.destroy();
    },
  );

  it('makes the accepted Focus layout authoritative and keeps Fit idempotent', async () => {
    const finalPositions: readonly LocalLayoutPosition[] = [
      { key: 'left', x: -18, y: -240 },
      { key: 'middle', x: 3, y: 0 },
      { key: 'right', x: 24, y: 460 },
    ];
    const session = new LocalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      localInput(basePositions),
      { rootNodeKey: 'left', trackpadZoomMode: 'pinch-zoom' },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    renderer.normalizeDisplayCoordinates = true;

    await session.applyPositions(finalPositions);
    await session.commitInitialPresentation(finalPositions, true);

    expect(renderer.getCustomBBox()).toEqual(
      networkPositionExtent(finalPositions),
    );
    expectFitAllIsIdempotent(renderer, () => session.fit(), finalPositions);
    session.destroy();
  });

  it('preserves a superseding raw camera viewport while correcting the frame', async () => {
    const finalPositions = [
      { key: 'left', x: -100, y: -20 },
      { key: 'middle', x: 30, y: 40 },
      { key: 'right', x: 700, y: 90 },
    ] as const;
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    renderer.normalizeDisplayCoordinates = true;
    await session.applyPositions(basePositions);
    await session.applySpatialPositions(finalPositions);
    renderer.camera.setState({ x: 0.68, y: 0.41, ratio: 1.7, angle: 0.2 });
    const center = renderer.viewportToGraph({ x: 400, y: 300 });

    await session.commitInitialPresentation(finalPositions, false);

    const restoredCenter = renderer.viewportToGraph({ x: 400, y: 300 });
    expect(restoredCenter.x).toBeCloseTo(center.x, 8);
    expect(restoredCenter.y).toBeCloseTo(center.y, 8);
    expect(renderer.camera.angle).toBeCloseTo(0.2, 8);
    session.destroy();
  });

  it('traces the one authoritative startup frame and no hidden second Fit', async () => {
    const startupTrace = vi.fn();
    const session = new GlobalRendererSession(
      {
        closest: vi.fn(() => undefined),
        getBoundingClientRect: vi.fn(() => ({
          x: 0,
          y: 0,
          width: 800,
          height: 600,
        })),
        setAttribute: vi.fn(),
      } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        startupTrace,
        trackpadZoomMode: 'pinch-zoom',
      },
    );

    await session.commitInitialPresentation(basePositions, true);

    expect(startupTrace.mock.calls.map(([entry]) => entry.reason)).toEqual([
      'session-created',
      'initial-presentation-begin',
      'custom-bbox-write',
      'camera-write:initial-fit',
      'sigma-before-render',
      'sigma-after-render',
    ]);
    expect(startupTrace.mock.calls.at(-1)?.[0]).toMatchObject({
      camera: { x: 0.5, y: 0.5, ratio: 1, angle: 0 },
      customBBox: networkPositionExtent(basePositions),
      rendererDimensions: { width: 800, height: 600 },
      nodes: expect.arrayContaining([
        expect.objectContaining({
          key: 'left',
          raw: { x: -10, y: 0 },
        }),
      ]),
    });
    session.destroy();
  });
});
