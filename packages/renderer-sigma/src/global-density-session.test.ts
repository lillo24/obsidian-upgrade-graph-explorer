import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { resolveGlobalDensityFit } from './global-density';
import { globalDensityFramingRatio } from './global-density-framing';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type {
  GlobalLayoutPosition,
  GlobalRendererInput,
  GlobalRendererInstrumentation,
} from './types';

const basePositions: readonly GlobalLayoutPosition[] = [
  { key: 'left', x: -100, y: 0 },
  { key: 'middle', x: 0, y: 8 },
  { key: 'right', x: 100, y: 0 },
  { key: 'isolate', x: 0, y: 100 },
];

function rendererInput(
  positions: readonly GlobalLayoutPosition[] = basePositions,
): GlobalRendererInput {
  const byKey = new Map(positions.map((position) => [position.key, position]));
  return {
    nodes: positions.map(({ key }) => ({
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
    ],
    projectionIssues: [],
  };
}

function mount(
  options: Partial<ConstructorParameters<typeof GlobalRendererSession>[2]> = {},
  input = rendererInput(),
) {
  const session = new GlobalRendererSession(
    { setAttribute: vi.fn() } as unknown as HTMLElement,
    input,
    {
      settings: { folderClustering: true, spacingPreset: 'normal' },
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

describe('All Network density camera ownership', () => {
  it('adopts confirmed geometry, previews 0/50/100/125/150 live, and emits diagnostics', () => {
    const onDensityQaDiagnosticsChange = vi.fn();
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
    const input = rendererInput();
    const decision = resolveGlobalDensityFit(input, basePositions);
    const { session, renderer } = mount(
      {
        densityFramingStrength: 100,
        initialAcceptedPositions: basePositions,
        instrumentation,
        onDensityQaDiagnosticsChange,
      },
      input,
    );

    expect(decision.fallback).toBe(false);
    expect(renderer.camera.ratio).toBe(decision.ratio);
    expect(onDensityQaDiagnosticsChange).toHaveBeenLastCalledWith({
      rawDecisionRatio: decision.ratio,
      effectiveRatio: decision.ratio,
      cameraRatio: decision.ratio,
      fallback: false,
      nodeCount: 4,
      edgeCount: 1,
      isolatedNodeCount: 2,
    });
    const anchor = session.nodeViewportPoint('left')!;
    session.setControlledSelection('left');
    session.updateDensityFramingStrength(0);
    expect(renderer.camera.ratio).toBe(1);
    expect(session.nodeViewportPoint('left')!.x).toBeCloseTo(anchor.x);
    expect(session.nodeViewportPoint('left')!.y).toBeCloseTo(anchor.y);
    session.updateDensityFramingStrength(50);
    expect(renderer.camera.ratio).toBeCloseTo(
      globalDensityFramingRatio(decision.ratio, 50),
    );
    session.updateDensityFramingStrength(100);
    expect(renderer.camera.ratio).toBe(decision.ratio);
    session.updateDensityFramingStrength(125);
    expect(renderer.camera.ratio).toBeCloseTo(
      globalDensityFramingRatio(decision.ratio, 125),
    );
    session.updateDensityFramingStrength(150);
    expect(renderer.camera.ratio).toBeCloseTo(
      globalDensityFramingRatio(decision.ratio, 150),
    );
    expect(counts.get('global-density-evaluations')).toBe(1);
    expect(counts.get('global-layouts')).toBeUndefined();
    expect(counts.get('spatial-pull-requests')).toBeUndefined();
    session.destroy();
  });

  it('preserves a user-owned camera through confirmed geometry and lets Fit reclaim it', async () => {
    const input = rendererInput();
    const { session, renderer } = mount(
      { initialAcceptedPositions: basePositions },
      input,
    );
    session.setControlledSelection('middle');
    const anchor = session.nodeViewportPoint('middle')!;
    session.zoomBy(0.82);
    const userRatio = renderer.camera.ratio;
    const changed = [
      ...basePositions.map((position, index) => ({
        ...position,
        x: position.x + index * index * 7,
        y: position.y - index * 5,
      })),
      { key: 'added', x: -75, y: 80 },
    ];
    const changedInput = rendererInput(changed);

    session.update(changedInput);
    await session.applyPositions(changed);

    expect(renderer.camera.ratio).toBe(userRatio);
    // The Sigma test double omits production normalization precision; the
    // semantic anchor remains within one synthetic viewport pixel.
    expect(
      Math.abs(session.nodeViewportPoint('middle')!.x - anchor.x),
    ).toBeLessThan(2);
    expect(
      Math.abs(session.nodeViewportPoint('middle')!.y - anchor.y),
    ).toBeLessThan(2);
    const changedDecision = resolveGlobalDensityFit(changedInput, changed);
    session.fit();
    expect(renderer.camera).toMatchObject({
      x: 0.5,
      y: 0.5,
      angle: 0,
      ratio: changedDecision.ratio,
    });
    session.updateDensityFramingStrength(0);
    session.fit();
    expect(renderer.camera.ratio).toBe(1);
    session.destroy();
  });

  it('preserves a restored semantic viewport instead of applying density on mount', () => {
    const { session, renderer } = mount({
      densityFramingStrength: 100,
      initialAcceptedPositions: basePositions,
      initialViewport: { anchorEntityId: 'middle', ratio: 0.63 },
    });

    expect(renderer.camera.ratio).toBe(0.63);
    session.destroy();
  });

  it('does not measure or reframe live arrangement preview frames', async () => {
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
    const input = rendererInput();
    const { session, renderer } = mount(
      { initialAcceptedPositions: basePositions, instrumentation },
      input,
    );
    session.setFolderArrangementContext({
      active: true,
      activeFolderKey: 'alpha',
      anchors: new Map(),
      automaticPositions: basePositions,
      input,
    });
    const ratio = renderer.camera.ratio;

    session.previewFolderAnchor('alpha', { x: 0.4, y: -0.2 });

    expect(counts.get('global-density-evaluations')).toBe(1);
    expect(renderer.camera.ratio).toBe(ratio);
    const confirmed = basePositions.map((position) =>
      position.key === 'isolate'
        ? position
        : { ...position, x: position.x + 40 },
    );
    await session.applyPositions(confirmed);
    expect(counts.get('global-density-evaluations')).toBe(2);
    expect(renderer.camera.ratio).toBe(ratio);
    session.destroy();
  });
});
