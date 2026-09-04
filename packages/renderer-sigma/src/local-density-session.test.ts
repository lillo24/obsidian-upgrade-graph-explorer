import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { resolveLocalDensityFit } from './local-density';
import { localDensityFramingRatio } from './local-density-framing';
import { LocalRendererSession } from './local-session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  LocalLayoutPosition,
  LocalRendererInput,
  LocalRendererInstrumentation,
} from './local-types';

const sparsePositions: readonly LocalLayoutPosition[] = [
  { key: 'root', x: 0, y: 0 },
  { key: 'near', x: 1, y: 0 },
  { key: 'isolate', x: 1_000, y: 0 },
];

const compactPositions: readonly LocalLayoutPosition[] = [
  { key: 'root', x: 0, y: 0 },
  { key: 'near', x: 999, y: 0 },
  { key: 'isolate', x: 1_000, y: 0 },
];

function rendererInput(
  positions: readonly LocalLayoutPosition[] = sparsePositions,
): LocalRendererInput {
  const byKey = new Map(positions.map((position) => [position.key, position]));
  return {
    rootNodeKey: 'root',
    nodes: ['root', 'near', 'isolate'].map((key) => ({
      key,
      attributes: {
        x: byKey.get(key)!.x,
        y: byKey.get(key)!.y,
        size: 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        root: key === 'root',
        revealableDescendantCount: 0,
      },
    })),
    edges: [
      {
        key: 'root-near',
        source: 'root',
        target: 'near',
        attributes: {
          size: 1,
          color: '#91aab2',
          edgeKind: 'reference',
          weight: 1,
          referenceCount: 1,
        },
      },
    ],
    projectionIssues: [],
  };
}

function mount(
  options: Partial<ConstructorParameters<typeof LocalRendererSession>[2]> = {},
  input = rendererInput(),
) {
  const session = new LocalRendererSession(
    { setAttribute: vi.fn() } as unknown as HTMLElement,
    input,
    {
      rootNodeKey: input.rootNodeKey,
      trackpadZoomMode: 'pinch-zoom',
      ...options,
    },
  );
  return { session, renderer: SigmaTestRenderer.instances.at(-1)! };
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

describe('Focus density camera ownership', () => {
  it('adopts the production ratio for fresh and exact cache-hit layouts', async () => {
    const input = rendererInput();
    const expected = resolveLocalDensityFit(input, sparsePositions).ratio;
    const fresh = mount({}, input);

    await fresh.session.applyPositions(sparsePositions);

    expect(fresh.renderer.camera.ratio).toBe(expected);
    expect(expected).toBe(0.7);
    fresh.session.destroy();

    const cached = mount({ initialAcceptedPositions: sparsePositions }, input);
    expect(cached.renderer.camera.ratio).toBe(expected);
    cached.session.destroy();
  });

  it('interpolates automatic framing below and above ratio 1', async () => {
    const sparseInput = rendererInput();
    const sparseDecision = resolveLocalDensityFit(
      sparseInput,
      sparsePositions,
    ).ratio;
    const sparse = mount({ densityFramingStrength: 50 }, sparseInput);
    await sparse.session.applyPositions(sparsePositions);
    expect(sparse.renderer.camera.ratio).toBe(
      localDensityFramingRatio(sparseDecision, 50),
    );
    sparse.session.destroy();

    const compactInput = rendererInput(compactPositions);
    const compactDecision = resolveLocalDensityFit(
      compactInput,
      compactPositions,
    ).ratio;
    expect(compactDecision).toBeGreaterThan(1);
    const compact = mount({ densityFramingStrength: 50 }, compactInput);
    await compact.session.applyPositions(compactPositions);
    expect(compact.renderer.camera.ratio).toBe(
      localDensityFramingRatio(compactDecision, 50),
    );
    compact.session.destroy();
  });

  it('previews strength immediately without measuring or laying out', async () => {
    const counts = new Map<string, number>();
    const onDensityQaDiagnosticsChange = vi.fn();
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
    const input = rendererInput(compactPositions);
    const decision = resolveLocalDensityFit(input, compactPositions).ratio;
    const { session, renderer } = mount(
      {
        densityFramingStrength: 0,
        instrumentation,
        onDensityQaDiagnosticsChange,
      },
      input,
    );
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: 1,
      effectiveRatio: 1,
      cameraRatio: 1,
      fallback: true,
      fallbackReason: 'No accepted Local layout has been measured yet.',
    });
    await session.applyPositions(compactPositions);
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: decision,
      effectiveRatio: 1,
      cameraRatio: 1,
      fallback: false,
    });
    counts.clear();
    const anchor = session.nodeViewportPoint('root')!;

    session.updateDensityFramingStrength(50);
    expect(renderer.camera.ratio).toBe(localDensityFramingRatio(decision, 50));
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: decision,
      effectiveRatio: localDensityFramingRatio(decision, 50),
      cameraRatio: localDensityFramingRatio(decision, 50),
      fallback: false,
    });
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);
    session.updateDensityFramingStrength(100);
    expect(renderer.camera.ratio).toBe(decision);
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: decision,
      effectiveRatio: decision,
      cameraRatio: decision,
      fallback: false,
    });
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);
    const cameraUpdated = renderer.camera.on.mock.calls.find(
      ([event]) => event === 'updated',
    )?.[1] as (() => void) | undefined;
    expect(cameraUpdated).toBeDefined();
    renderer.camera.setState({ ratio: 0.93 });
    cameraUpdated?.();
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: decision,
      effectiveRatio: decision,
      cameraRatio: 0.93,
      fallback: false,
    });
    expect(counts.get('local-density-evaluations')).toBeUndefined();
    expect(counts.get('local-layouts')).toBeUndefined();
    session.destroy();
  });

  it('preserves a fresh transition point while adopting automatic density', async () => {
    const point = { x: 240, y: 180 };
    const input = rendererInput();
    const expected = resolveLocalDensityFit(input, compactPositions).ratio;
    const { session, renderer } = mount(
      { initialViewportNodeKey: 'root', initialViewportPoint: point },
      input,
    );

    expect(session.nodeViewportPoint('root')).toEqual(point);
    await session.applyPositions(compactPositions);

    expect(renderer.camera.ratio).toBe(expected);
    expect(session.nodeViewportPoint('root')).toEqual(point);
    session.destroy();
  });

  it('keeps restored and explicit semantic cameras authoritative', async () => {
    const input = rendererInput();
    const restored = mount(
      { initialViewport: { anchorEntityId: 'root', freeRatio: 0.44 } },
      input,
    );
    expect(restored.renderer.camera.ratio).toBe(0.44);
    await restored.session.applyPositions(compactPositions);
    expect(restored.renderer.camera.ratio).toBe(0.44);
    restored.session.destroy();

    const centered = mount({}, input);
    await centered.session.center({ key: 1, nodeId: 'near', freeRatio: 0.36 });
    await centered.session.applyPositions(compactPositions);
    expect(centered.renderer.camera.ratio).toBe(0.36);
    centered.session.destroy();
  });

  it('does not overwrite zoom, wheel, or drag intent when layout completes', async () => {
    const zoomed = mount();
    zoomed.session.zoomBy(0.82);
    await zoomed.session.applyPositions(compactPositions);
    expect(zoomed.renderer.camera.ratio).toBe(0.82);
    zoomed.session.destroy();

    const wheeled = mount();
    const wheel = wheeled.renderer.captor.on.mock.calls.find(
      ([event]) => event === 'wheel',
    )?.[1] as ((coordinates: object) => void) | undefined;
    expect(wheel).toBeDefined();
    wheel?.({
      x: 600,
      y: 400,
      original: {
        ctrlKey: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 4,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      },
      preventSigmaDefault: vi.fn(),
    });
    const wheelRatio = wheeled.renderer.camera.ratio;
    await wheeled.session.applyPositions(compactPositions);
    expect(wheeled.renderer.camera.ratio).toBe(wheelRatio);
    wheeled.session.destroy();

    const dragged = mount();
    const drag = dragged.renderer.captor.on.mock.calls.find(
      ([event]) => event === 'mousemovebody',
    )?.[1] as ((coordinates: object) => void) | undefined;
    dragged.renderer.captor.isMouseDown = true;
    drag?.({});
    dragged.renderer.camera.setState({ x: 0.72, ratio: 0.91 });
    await dragged.session.applyPositions(compactPositions);
    expect(dragged.renderer.camera.ratio).toBe(0.91);
    dragged.session.destroy();
  });

  it('live-previews a user-owned camera and keeps later layouts from stealing it', async () => {
    const input = rendererInput();
    const topologyInput: LocalRendererInput = {
      ...input,
      edges: [
        ...input.edges,
        {
          key: 'near-isolate',
          source: 'near',
          target: 'isolate',
          attributes: {
            size: 1,
            color: '#91aab2',
            edgeKind: 'reference',
            weight: 1,
            referenceCount: 1,
          },
        },
      ],
    };
    const sparseRatio = resolveLocalDensityFit(input, sparsePositions).ratio;
    const compactRatio = resolveLocalDensityFit(
      topologyInput,
      compactPositions,
    ).ratio;
    const { session, renderer } = mount({}, input);
    await session.applyPositions(sparsePositions);
    session.zoomBy(0.82);
    const anchor = session.nodeViewportPoint('root')!;

    session.updateDensityFramingStrength(0);
    expect(renderer.camera.ratio).toBe(1);
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);

    session.updateDensityFramingStrength(100);
    expect(renderer.camera.ratio).toBe(sparseRatio);
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);

    session.update(topologyInput);
    expect(renderer.camera.ratio).toBe(sparseRatio);
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);

    await session.applyPositions(compactPositions);
    expect(renderer.camera.ratio).toBe(sparseRatio);
    expect(session.nodeViewportPoint('root')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('root')!.y).toBeCloseTo(anchor.y);

    session.fit();
    expect(renderer.camera).toMatchObject({
      x: 0.5,
      y: 0.5,
      angle: 0,
      ratio: compactRatio,
    });
    expect(renderer.camera.animatedReset).not.toHaveBeenCalled();
    session.destroy();
  });

  it('evaluates density once per accepted layout without layout operations', async () => {
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
    const { session } = mount({ instrumentation });

    await session.applyPositions(sparsePositions);
    await session.applyPositions(compactPositions);

    expect(counts.get('local-density-evaluations')).toBe(2);
    expect(counts.get('local-layouts')).toBeUndefined();
    session.destroy();
  });
});
