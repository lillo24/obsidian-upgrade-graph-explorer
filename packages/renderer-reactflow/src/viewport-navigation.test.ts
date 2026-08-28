import { describe, expect, it } from 'vitest';

import { mapProjectionToReactFlow } from './mapping';
import { rendererTestProjection } from './test-fixture';
import type { RendererGraph } from './types';
import {
  captureDisclosureAnchor,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_ZOOM_SENSITIVITY,
  normalizedWheelZoomDelta,
  wheelActionForMode,
  viewportAfterWheelZoom,
  viewportForDisclosureAnchor,
} from './viewport-navigation';

function graphAt(documentX: number, documentY: number): RendererGraph {
  const mapped = mapProjectionToReactFlow(
    rendererTestProjection(),
    'structure',
    new Set(),
  );
  return {
    ...mapped,
    layoutWarning: null,
    nodes: mapped.nodes.map((node) =>
      node.type === 'entity' && node.data.entityId === 'document-a'
        ? { ...node, position: { x: documentX, y: documentY } }
        : node,
    ),
  };
}

describe('viewport navigation', () => {
  it('routes wheel input according to the explicit trackpad preference', () => {
    expect(wheelActionForMode('scroll-zoom', false)).toBe('zoom');
    expect(wheelActionForMode('scroll-zoom', true)).toBe('zoom');
    expect(wheelActionForMode('pinch-zoom', false)).toBe('pan');
    expect(wheelActionForMode('pinch-zoom', true)).toBe('zoom');
  });

  it('uses the documented strong D3-compatible wheel normalization', () => {
    expect(GRAPH_ZOOM_SENSITIVITY).toBe(1.8);
    expect(
      normalizedWheelZoomDelta({ deltaY: 100, deltaMode: 0, ctrlKey: false }),
    ).toBeCloseTo(-0.36);
    expect(
      normalizedWheelZoomDelta({ deltaY: 2, deltaMode: 1, ctrlKey: true }),
    ).toBeCloseTo(-1.8);
  });

  it('keeps the graph-space focal point beneath the pointer stable', () => {
    const before = { x: -120, y: 45, zoom: 0.75 };
    const pointer = { x: 310, y: 170 };
    const graphPoint = {
      x: (pointer.x - before.x) / before.zoom,
      y: (pointer.y - before.y) / before.zoom,
    };
    const after = viewportAfterWheelZoom(before, {
      deltaY: -80,
      deltaMode: 0,
      ctrlKey: false,
      pointer,
    });

    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect(graphPoint.x * after.zoom + after.x).toBeCloseTo(pointer.x);
    expect(graphPoint.y * after.zoom + after.y).toBeCloseTo(pointer.y);
  });

  it('clamps zoom to the shared renderer bounds', () => {
    expect(
      viewportAfterWheelZoom(
        { x: 0, y: 0, zoom: GRAPH_MAX_ZOOM },
        {
          deltaY: -10_000,
          deltaMode: 0,
          ctrlKey: true,
          pointer: { x: 0, y: 0 },
        },
      ).zoom,
    ).toBe(GRAPH_MAX_ZOOM);
    expect(
      viewportAfterWheelZoom(
        { x: 0, y: 0, zoom: GRAPH_MIN_ZOOM },
        {
          deltaY: 10_000,
          deltaMode: 0,
          ctrlKey: true,
          pointer: { x: 0, y: 0 },
        },
      ).zoom,
    ).toBe(GRAPH_MIN_ZOOM);
  });

  it('preserves the disclosed node screen point and exact zoom after layout', () => {
    const viewport = { x: 40, y: -30, zoom: 1.25 };
    const anchor = captureDisclosureAnchor(
      graphAt(10, 20),
      'document-a',
      viewport,
    );
    expect(anchor).not.toBeNull();

    const restored = viewportForDisclosureAnchor(graphAt(310, 180), anchor!);
    expect(restored?.zoom).toBe(viewport.zoom);
    expect(restored).toEqual({ x: -335, y: -230, zoom: 1.25 });
  });

  it('fails safely when the disclosure entity is unavailable', () => {
    expect(
      captureDisclosureAnchor(graphAt(0, 0), 'missing', {
        x: 0,
        y: 0,
        zoom: 1,
      }),
    ).toBeNull();
    expect(
      viewportForDisclosureAnchor(
        { nodes: [], edges: [], layoutWarning: null },
        {
          projectionNodeId: 'missing',
          entityId: 'missing',
          screenPoint: { x: 0, y: 0 },
          zoom: 1,
        },
      ),
    ).toBeNull();
  });
});
