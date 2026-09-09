import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { LocalRendererSession } from './local-session';
import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { LocalRendererInput } from './local-types';
import type { GlobalRendererInput } from './types';

type NetworkSession = {
  destroy(): void;
  nodeViewportPoint(
    key: string,
  ): { readonly x: number; readonly y: number } | undefined;
};

function globalInput(span: number): GlobalRendererInput {
  return {
    nodes: ['left', 'right'].map((key, index) => ({
      key,
      attributes: {
        x: index * span,
        y: index * span,
        size: 6,
        color: '#607d8b',
        label: key,
        nodeKind: 'document' as const,
        entityId: key,
        sourcePath: `${key}.md`,
        status: null,
        folderKey: '.',
        revealableDescendantCount: 0,
      },
    })),
    edges: [],
    projectionIssues: [],
  };
}

function localInput(span: number): LocalRendererInput {
  return {
    rootNodeKey: 'left',
    nodes: ['left', 'right'].map((key, index) => ({
      key,
      attributes: {
        x: index * span,
        y: index * span,
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
    edges: [],
    projectionIssues: [],
  };
}

function mount(
  kind: 'global' | 'local',
  span: number,
  onUserCameraIntent: () => void,
): { readonly renderer: SigmaTestRenderer; readonly session: NetworkSession } {
  const container = { setAttribute: vi.fn() } as unknown as HTMLElement;
  const session =
    kind === 'global'
      ? new GlobalRendererSession(container, globalInput(span), {
          settings: { folderClustering: false, spacingPreset: 'normal' },
          trackpadZoomMode: 'pinch-zoom',
          onUserCameraIntent,
        })
      : new LocalRendererSession(container, localInput(span), {
          rootNodeKey: 'left',
          trackpadZoomMode: 'pinch-zoom',
          onUserCameraIntent,
        });
  const renderer = SigmaTestRenderer.instances.at(-1)!;
  renderer.normalizeDisplayCoordinates = true;
  renderer.scheduleRefresh();
  return { renderer, session };
}

function pan(
  renderer: SigmaTestRenderer,
  delta: { readonly x: number; readonly y: number; readonly mode: number },
): void {
  const wheel = renderer.captor.on.mock.calls.find(
    ([event]) => event === 'wheel',
  )?.[1] as ((coordinates: Record<string, unknown>) => void) | undefined;
  expect(wheel).toBeDefined();
  wheel?.({
    x: 400,
    y: 300,
    original: {
      ctrlKey: false,
      deltaMode: delta.mode,
      deltaX: delta.x,
      deltaY: delta.y,
    },
    preventSigmaDefault: vi.fn(),
  });
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

describe.each(['global', 'local'] as const)('%s two-finger pan', (kind) => {
  it.each([1, 10, 100, 1_000])(
    'moves by the same pixels at raw coordinate span %s',
    (span) => {
      const onUserCameraIntent = vi.fn();
      const { renderer, session } = mount(kind, span, onUserCameraIntent);
      renderer.camera.setState({ angle: Math.PI / 5, ratio: 0.72 });
      const before = session.nodeViewportPoint('left')!;

      pan(renderer, { x: 3, y: 5, mode: 0 });

      const after = session.nodeViewportPoint('left')!;
      expect(after.x - before.x).toBeCloseTo(3, 10);
      expect(after.y - before.y).toBeCloseTo(5, 10);
      expect(onUserCameraIntent).toHaveBeenCalledTimes(1);
      session.destroy();
    },
  );

  it('normalizes line-mode movement before applying the rotated camera transform', () => {
    const { renderer, session } = mount(kind, 100, vi.fn());
    renderer.camera.setState({ angle: -Math.PI / 3, ratio: 1.25 });
    const before = session.nodeViewportPoint('right')!;

    pan(renderer, { x: -2, y: 1, mode: 1 });

    const after = session.nodeViewportPoint('right')!;
    expect(after.x - before.x).toBeCloseTo(-32, 10);
    expect(after.y - before.y).toBeCloseTo(16, 10);
    session.destroy();
  });
});
