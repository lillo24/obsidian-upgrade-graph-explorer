import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { GlobalRendererInput } from './types';

const input: GlobalRendererInput = {
  nodes: ['a', 'b', 'c'].map((key, index) => ({
    key,
    attributes: {
      x: index * 10,
      y: index * -4,
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
  edges: [
    {
      key: 'a-b',
      source: 'a',
      target: 'b',
      attributes: {
        size: 1,
        color: '#3f3f3f',
        edgeKind: 'reference',
        status: 'resolved',
        referenceCount: 2,
      },
    },
    {
      key: 'b-c',
      source: 'b',
      target: 'c',
      attributes: {
        size: 1,
        color: '#3f3f3f',
        edgeKind: 'reference',
        status: 'resolved',
        referenceCount: 2,
      },
    },
  ],
  projectionIssues: [],
};

let now = 0;
let frames: FrameRequestCallback[];

beforeEach(() => {
  SigmaTestRenderer.instances = [];
  now = 0;
  frames = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('window', {
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false })),
  });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Network hover renderer integration', () => {
  it('refreshes only hover presentation without changing graph or camera geometry', () => {
    const session = new GlobalRendererSession(
      { setAttribute: vi.fn() } as unknown as HTMLElement,
      input,
      {
        settings: { folderClustering: true, spacingPreset: 'normal' },
        trackpadZoomMode: 'pinch-zoom',
      },
    );
    const renderer = SigmaTestRenderer.instances.at(-1)!;
    renderer.refresh();
    const coordinates = new Map(
      renderer.graph.mapNodes((key, attributes) => [
        key,
        { x: attributes.x, y: attributes.y },
      ]),
    );
    const camera = renderer.camera.getState();
    const ordinaryUnrelatedEdge = renderer.displayEdges.get('b-c');

    renderer.handlers.get('enterNode')?.({ node: 'a' });

    expect(renderer.refresh).toHaveBeenLastCalledWith({
      partialGraph: { nodes: ['a'], edges: ['a-b'] },
      skipIndexation: true,
      schedule: true,
    });
    expect(renderer.displayEdges.get('a-b')?.color).toBe('#8a5cf5');
    expect(renderer.displayEdges.get('b-c')).toEqual(ordinaryUnrelatedEdge);

    now = 60;
    frames.shift()?.(now);
    expect(renderer.scheduleHighlightedNodesRender).toHaveBeenCalledOnce();
    now = 120;
    frames.shift()?.(now);

    expect(
      new Map(
        renderer.graph.mapNodes((key, attributes) => [
          key,
          { x: attributes.x, y: attributes.y },
        ]),
      ),
    ).toEqual(coordinates);
    expect(renderer.camera.getState()).toEqual(camera);

    session.destroy();
  });
});
