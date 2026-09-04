import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { resolveGlobalDensityFit } from './global-density';
import type { GlobalGraph } from './graph';
import { GlobalRendererSession } from './session';
import { LocalRendererSession } from './local-session';
import {
  captureRawViewportFrame,
  type RawViewportFrame,
} from './raw-viewport-frame';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { GlobalLayoutPosition, GlobalRendererInput } from './types';
import type { LocalLayoutPosition, LocalRendererInput } from './local-types';

const oldPositions = [
  { key: 'left', x: -100, y: 0 },
  { key: 'middle', x: 0, y: 0 },
  { key: 'right', x: 100, y: 0 },
] as const;

function globalInput(
  positions: readonly GlobalLayoutPosition[] = oldPositions,
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
        folderKey: 'root',
        revealableDescendantCount: 0,
      },
    })),
    edges: positions.slice(1).map(({ key }, index) => ({
      key: `edge:${index}`,
      source: positions[index]!.key,
      target: key,
      attributes: {
        size: 1,
        color: '#91aab2',
        edgeKind: 'reference' as const,
        status: 'resolved' as const,
        referenceCount: 1,
      },
    })),
    projectionIssues: [],
  };
}

function localInput(
  positions: readonly LocalLayoutPosition[] = oldPositions,
): LocalRendererInput {
  return {
    rootNodeKey: 'left',
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
        root: key === 'left',
        revealableDescendantCount: 0,
      },
    })),
    edges: positions.slice(1).map(({ key }, index) => ({
      key: `edge:${index}`,
      source: positions[index]!.key,
      target: key,
      attributes: {
        size: 1,
        color: '#91aab2',
        edgeKind: 'reference' as const,
        weight: 1,
        referenceCount: 1,
      },
    })),
    projectionIssues: [],
  };
}

function prepare(renderer: SigmaTestRenderer): void {
  renderer.normalizeDisplayCoordinates = true;
  renderer.scheduleRefresh();
  renderer.eventOrder.length = 0;
  renderer.frameSnapshots.length = 0;
}

function expectPointClose(
  actual: { readonly x: number; readonly y: number } | undefined,
  expected: { readonly x: number; readonly y: number },
): void {
  expect(actual).toBeDefined();
  expect(actual!.x).toBeCloseTo(expected.x, 8);
  expect(actual!.y).toBeCloseTo(expected.y, 8);
}

function pointDistance(
  left: { readonly x: number; readonly y: number },
  right: { readonly x: number; readonly y: number },
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function expectRawFrameClose(
  actual: RawViewportFrame,
  expected: RawViewportFrame,
): void {
  expect(actual.center.x).toBeCloseTo(expected.center.x, 8);
  expect(actual.center.y).toBeCloseTo(expected.center.y, 8);
  expect(actual.graphUnitsPerPixel).toBeCloseTo(expected.graphUnitsPerPixel, 8);
  expect(actual.angle).toBeCloseTo(expected.angle, 8);
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

describe('atomic first-visible Network frames', () => {
  it('captures the former stale raw-frame displacement and the corrected first frame', async () => {
    const changed = oldPositions.map((position, index) => ({
      ...position,
      x: position.x + index * index * 120,
      y: index * 30,
    }));
    const legacy = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const legacyRenderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(legacyRenderer);
    // Control: remove the presented-frame override to reproduce Sigma's former
    // per-process auto-rescaling under unchanged framed camera numbers.
    legacyRenderer.setCustomBBox(null);
    legacy.setControlledSelection('middle');
    legacy.zoomBy(0.82);
    const legacyRawFrame = captureRawViewportFrame(legacyRenderer);
    const oldPoint = legacy.nodeViewportPoint('middle')!;
    legacyRenderer.deferProcess = true;
    legacyRenderer.frameSnapshots.length = 0;
    const legacyGraph = Reflect.get(legacy, 'graph') as GlobalGraph;
    const changedByKey = new Map<string, GlobalLayoutPosition>(
      changed.map((position) => [position.key, position]),
    );
    legacyGraph.updateEachNodeAttributes(
      (key, attributes) => ({ ...attributes, ...changedByKey.get(key)! }),
      { attributes: ['x', 'y'] },
    );
    legacyRenderer.finishProcess();
    const stalePoint =
      legacyRenderer.frameSnapshots[0]!.nodeViewportPoints.get('middle')!;
    const staleError = pointDistance(stalePoint, oldPoint);
    const staleRawFrame = captureRawViewportFrame(legacyRenderer);
    legacy.destroy();

    const atomic = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const atomicRenderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(atomicRenderer);
    atomic.setControlledSelection('middle');
    atomic.zoomBy(0.82);
    const atomicRawFrame = captureRawViewportFrame(atomicRenderer);
    atomicRenderer.deferProcess = true;
    atomicRenderer.frameSnapshots.length = 0;
    const applied = atomic.applyPositions(changed);
    atomicRenderer.finishProcess();
    await applied;
    const correctedRawFrame = captureRawViewportFrame(atomicRenderer);

    expect(staleError).toBeGreaterThan(50);
    expect(
      Math.hypot(
        staleRawFrame.center.x - legacyRawFrame.center.x,
        staleRawFrame.center.y - legacyRawFrame.center.y,
      ),
    ).toBeGreaterThan(50);
    expectRawFrameClose(correctedRawFrame, atomicRawFrame);
    atomic.destroy();
  });

  it('arms Global position repair before Graphology and draws one raw-frame-preserving user frame', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    session.setControlledSelection('middle');
    session.zoomBy(0.82);
    const rawFrame = captureRawViewportFrame(renderer);
    const explicitRefreshes = renderer.scheduleRefresh.mock.calls.length;
    renderer.deferProcess = true;
    renderer.eventOrder.length = 0;
    renderer.frameSnapshots.length = 0;
    const changed = oldPositions.map((position, index) => ({
      ...position,
      x: position.x + index * index * 120,
      y: index * 30,
    }));

    const applied = session.applyPositions(changed);

    expect(renderer.eventOrder.indexOf('arm:afterProcess')).toBeLessThan(
      renderer.eventOrder.indexOf('mutation:eachNodeAttributesUpdated'),
    );
    renderer.finishProcess();
    await applied;
    expect(renderer.frameSnapshots).toHaveLength(1);
    expectRawFrameClose(captureRawViewportFrame(renderer), rawFrame);
    expect(renderer.scheduleRefresh).toHaveBeenCalledTimes(explicitRefreshes);
    session.destroy();
  });

  it('applies the automatic Global density ratio in the first position frame', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    const changed = [
      { key: 'left', x: 0, y: 0 },
      { key: 'middle', x: 1, y: 0 },
      { key: 'right', x: 1_000, y: 0 },
    ];
    renderer.deferProcess = true;

    const applied = session.applyPositions(changed);
    renderer.finishProcess();
    await applied;

    const expected = resolveGlobalDensityFit(globalInput(), changed).ratio;
    expect(renderer.frameSnapshots).toHaveLength(1);
    expect(renderer.frameSnapshots[0]!.camera.ratio).toBe(expected);
    session.destroy();
  });

  it('uses a surviving Global center node when the previous nearest is removed', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    const survivingPoint = session.nodeViewportPoint('left')!;
    renderer.deferProcess = true;
    renderer.synchronousGraphAutoRefresh = true;

    session.update(
      globalInput([
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 1_000, y: 0 },
      ]),
    );

    expect(renderer.eventOrder.indexOf('arm:afterProcess')).toBeLessThan(
      renderer.eventOrder.findIndex((entry) => entry.startsWith('mutation:')),
    );
    renderer.finishProcess();
    expect(renderer.frameSnapshots).toHaveLength(1);
    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get('left'),
      survivingPoint,
    );
    session.destroy();
  });

  it('finishes the anchored Global topology frame before applying an early layout result', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    session.setControlledSelection('right');
    session.zoomBy(0.82);
    const point = session.nodeViewportPoint('right')!;
    renderer.deferProcess = true;
    renderer.frameSnapshots.length = 0;

    session.update(
      globalInput([
        { key: 'middle', x: 0, y: 0 },
        { key: 'right', x: 100, y: 0 },
      ]),
    );
    const applied = session.applyPositions([
      { key: 'middle', x: -400, y: 50 },
      { key: 'right', x: 800, y: -120 },
    ]);

    expect(renderer.eventOrder).not.toContain(
      'mutation:eachNodeAttributesUpdated',
    );
    renderer.finishProcess();
    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get('right'),
      point,
    );
    const topologyFrame = captureRawViewportFrame(renderer);
    await Promise.resolve();
    expect(renderer.eventOrder).toContain('mutation:eachNodeAttributesUpdated');
    renderer.finishProcess();
    await applied;

    expect(renderer.frameSnapshots).toHaveLength(2);
    expectRawFrameClose(captureRawViewportFrame(renderer), topologyFrame);
    session.destroy();
  });

  it('finishes the anchored Focus topology frame before applying an early layout result', async () => {
    const session = new LocalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      localInput(),
      { rootNodeKey: 'left', trackpadZoomMode: 'pinch-zoom' },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    session.setControlledSelection('right');
    session.zoomBy(0.82);
    const point = session.nodeViewportPoint('right')!;
    renderer.deferProcess = true;
    renderer.frameSnapshots.length = 0;

    session.update(
      localInput([
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 100, y: 0 },
      ]),
    );
    const applied = session.applyPositions([
      { key: 'left', x: -400, y: 50 },
      { key: 'right', x: 800, y: -120 },
    ]);

    expect(renderer.eventOrder).not.toContain(
      'mutation:eachNodeAttributesUpdated',
    );
    renderer.finishProcess();
    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get('right'),
      point,
    );
    const topologyFrame = captureRawViewportFrame(renderer);
    await Promise.resolve();
    expect(renderer.eventOrder).toContain('mutation:eachNodeAttributesUpdated');
    renderer.finishProcess();
    await applied;

    expect(renderer.frameSnapshots).toHaveLength(2);
    expectRawFrameClose(captureRawViewportFrame(renderer), topologyFrame);
    session.destroy();
  });

  it.each([
    {
      name: 'selected survivor',
      selected: 'right',
      next: [
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 1_000, y: 0 },
      ],
      expectedAnchor: 'right',
    },
    {
      name: 'removed selection with deterministic surviving fallback',
      selected: 'middle',
      next: [
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 1_000, y: 0 },
      ],
      expectedAnchor: 'left',
    },
    {
      name: 'nearest center survivor',
      selected: undefined,
      next: [
        { key: 'left', x: -1_000, y: 0 },
        { key: 'middle', x: 10, y: 0 },
      ],
      expectedAnchor: 'middle',
    },
  ] as const)('preserves the $name through a Global query', async (fixture) => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    if (fixture.selected !== undefined) {
      session.setControlledSelection(fixture.selected);
    }
    const point = session.nodeViewportPoint(fixture.expectedAnchor)!;
    renderer.deferProcess = true;
    renderer.frameSnapshots.length = 0;

    session.update(globalInput(fixture.next));
    renderer.finishProcess();

    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get(
        fixture.expectedAnchor,
      ),
      point,
    );
    session.destroy();
  });

  it('prefers an explicit semantic/history anchor over the center heuristic', async () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    await session.center({ key: 1, nodeId: 'right', ratio: 0.9 });
    const point = session.nodeViewportPoint('right')!;
    renderer.deferProcess = true;
    renderer.frameSnapshots.length = 0;

    session.update(
      globalInput([
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 1_000, y: 0 },
      ]),
    );
    renderer.finishProcess();

    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get('right'),
      point,
    );
    session.destroy();
  });

  it('centers a genuinely replaced or empty Global scene deterministically', () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      globalInput(),
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
        initialAcceptedPositions: oldPositions,
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    session.zoomBy(0.82);
    const ratio = renderer.camera.ratio;
    renderer.deferProcess = true;
    renderer.synchronousGraphAutoRefresh = true;

    session.update(globalInput([{ key: 'replacement', x: 800, y: -300 }]));
    renderer.finishProcess();
    expect(renderer.camera).toMatchObject({ x: 0.5, y: 0.5, ratio });

    renderer.eventOrder.length = 0;
    renderer.frameSnapshots.length = 0;
    session.update(globalInput([]));
    renderer.finishProcess();
    expect(renderer.camera).toMatchObject({ x: 0.5, y: 0.5, ratio });
    session.destroy();
  });

  it('arms Focus topology and position repair before their Graphology events', async () => {
    const session = new LocalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      localInput(),
      { rootNodeKey: 'left', trackpadZoomMode: 'pinch-zoom' },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    prepare(renderer);
    session.setControlledSelection('middle');
    session.zoomBy(0.82);
    const rootPoint = session.nodeViewportPoint('left')!;
    renderer.deferProcess = true;
    renderer.synchronousGraphAutoRefresh = true;

    session.update(
      localInput([
        { key: 'left', x: -100, y: 0 },
        { key: 'right', x: 1_000, y: 0 },
      ]),
    );
    expect(renderer.eventOrder.indexOf('arm:afterProcess')).toBeLessThan(
      renderer.eventOrder.findIndex((entry) => entry.startsWith('mutation:')),
    );
    renderer.finishProcess();
    expectPointClose(
      renderer.frameSnapshots[0]!.nodeViewportPoints.get('left'),
      rootPoint,
    );

    renderer.deferProcess = false;
    renderer.eventOrder.length = 0;
    renderer.frameSnapshots.length = 0;
    const changed = [
      { key: 'left', x: 0, y: 0 },
      { key: 'right', x: 500, y: 80 },
    ];
    await session.applyPositions(changed);
    expect(renderer.eventOrder.indexOf('arm:afterProcess')).toBeLessThan(
      renderer.eventOrder.indexOf('mutation:eachNodeAttributesUpdated'),
    );
    expect(renderer.frameSnapshots).toHaveLength(1);
    session.destroy();
  });
});
