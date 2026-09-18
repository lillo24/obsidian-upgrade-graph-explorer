import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sigma', async () => ({
  default: (await import('./sigma-test-renderer')).SigmaTestRenderer,
}));

import { GlobalRendererSession } from './session';
import { SigmaTestRenderer } from './sigma-test-renderer';
import type { GlobalRendererInput } from './types';

const input: GlobalRendererInput = {
  nodes: ['a', 'b', 'c', 'd'].map((key, index) => ({
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
      key: 'a-d',
      source: 'a',
      target: 'd',
      attributes: {
        size: 1,
        color: '#e9973f',
        edgeKind: 'reference',
        status: 'ambiguous',
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
    {
      key: 'c-d',
      source: 'c',
      target: 'd',
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
  it('animates only incident presentation without changing graph or camera geometry', () => {
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
    const ordinaryIncidentEdge = renderer.displayEdges.get('a-b')!;
    const ordinarySemanticEdge = renderer.displayEdges.get('a-d')!;
    const ordinaryIncomingEdge = renderer.displayEdges.get('b-c')!;
    const ordinaryIncidentSize = Number(ordinaryIncidentEdge.size);
    const ordinarySemanticSize = Number(ordinarySemanticEdge.size);
    const ordinaryIncomingSize = Number(ordinaryIncomingEdge.size);
    const ordinaryUnrelatedEdge = renderer.displayEdges.get('c-d');
    const ordinaryUnrelatedNode = renderer.displayNodes.get('c');

    renderer.handlers.get('enterNode')?.({ node: 'a' });

    expect(renderer.refresh).toHaveBeenLastCalledWith({
      partialGraph: { nodes: ['a'], edges: ['a-b', 'a-d'] },
      skipIndexation: true,
      schedule: true,
    });
    expect(renderer.displayEdges.get('a-b')?.color).toBe('#3f3f3f');
    expect(renderer.displayEdges.get('a-b')?.size).toBe(ordinaryIncidentSize);
    expect(renderer.displayEdges.get('c-d')).toEqual(ordinaryUnrelatedEdge);
    expect(renderer.displayNodes.get('c')).toEqual(ordinaryUnrelatedNode);

    now = 110;
    frames.shift()?.(now);
    const midpointEdge = renderer.displayEdges.get('a-b')!;
    expect(midpointEdge.color).not.toBe('#3f3f3f');
    expect(midpointEdge.color).not.toBe('#8a5cf5');
    expect(Number(midpointEdge.size)).toBeGreaterThan(ordinaryIncidentSize);
    expect(Number(midpointEdge.size)).toBeLessThan(ordinaryIncidentSize * 1.3);
    expect(renderer.displayEdges.get('a-d')?.color).not.toBe('#8a5cf5');
    expect(renderer.displayEdges.get('c-d')).toEqual(ordinaryUnrelatedEdge);
    expect(renderer.displayNodes.get('c')).toEqual(ordinaryUnrelatedNode);

    now = 220;
    frames.shift()?.(now);
    expect(renderer.displayEdges.get('a-b')?.color).toBe('#8a5cf5');
    expect(renderer.displayEdges.get('a-b')?.size).toBeCloseTo(
      ordinaryIncidentSize * 1.3,
    );
    expect(renderer.displayEdges.get('a-d')?.color).toBe('#efb475');
    expect(frames).toHaveLength(0);

    renderer.handlers.get('enterNode')?.({ node: 'b' });
    now = 330;
    frames.shift()?.(now);
    expect(renderer.displayEdges.get('a-d')?.color).not.toBe('#efb475');
    expect(renderer.displayEdges.get('a-d')?.color).not.toBe('#e9973f');
    expect(renderer.displayEdges.get('b-c')?.color).not.toBe('#3f3f3f');
    expect(renderer.displayEdges.get('c-d')).toEqual(ordinaryUnrelatedEdge);
    now = 440;
    frames.shift()?.(now);
    expect(renderer.displayEdges.get('a-d')).toMatchObject({
      color: '#e9973f',
      zIndex: 0,
    });
    expect(renderer.displayEdges.get('a-d')?.size).toBe(ordinarySemanticSize);
    expect(renderer.displayEdges.get('b-c')?.color).toBe('#8a5cf5');
    expect(renderer.displayEdges.get('b-c')?.size).toBeCloseTo(
      ordinaryIncomingSize * 1.3,
    );
    expect(renderer.displayEdges.get('b-c')?.zIndex).toBe(1);
    expect(frames).toHaveLength(0);

    expect(
      new Map(
        renderer.graph.mapNodes((key, attributes) => [
          key,
          { x: attributes.x, y: attributes.y },
        ]),
      ),
    ).toEqual(coordinates);
    expect(renderer.camera.getState()).toEqual(camera);
    expect(renderer.camera.setState).not.toHaveBeenCalled();

    session.destroy();
  });
});
