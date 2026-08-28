import type { RendererViewport } from './semantic-viewport';
import type { RendererGraph } from './types';

export const GRAPH_MIN_ZOOM = 0.08;
export const GRAPH_MAX_ZOOM = 2;
export const GRAPH_ZOOM_SENSITIVITY = 1.8;
export const GRAPH_VIEWPORT_OBSERVATION_DELAY_MS = 120;

export interface WheelZoomInput {
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly pointer: {
    readonly x: number;
    readonly y: number;
  };
}

export interface DisclosureAnchor {
  readonly projectionNodeId: string;
  readonly entityId: string;
  readonly screenPoint: {
    readonly x: number;
    readonly y: number;
  };
  readonly zoom: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function entityNodeCenter(
  graph: RendererGraph,
  predicate: (node: RendererGraph['nodes'][number]) => boolean,
): { readonly x: number; readonly y: number } | null {
  const node = graph.nodes.find(
    (candidate) => candidate.type === 'entity' && predicate(candidate),
  );
  if (node === undefined) return null;
  const width = node.width ?? node.measured?.width;
  const height = node.height ?? node.measured?.height;
  if (
    width === undefined ||
    height === undefined ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return null;
  }
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
}

/** D3-compatible wheel normalization with stronger product-level sensitivity. */
export function normalizedWheelZoomDelta(
  input: Pick<WheelZoomInput, 'ctrlKey' | 'deltaMode' | 'deltaY'>,
): number {
  const modeFactor = input.deltaMode === 1 ? 0.05 : input.deltaMode ? 1 : 0.002;
  return (
    -input.deltaY *
    modeFactor *
    (input.ctrlKey ? 10 : 1) *
    GRAPH_ZOOM_SENSITIVITY
  );
}

/** Zoom while keeping the graph-space point beneath the pointer stationary. */
export function viewportAfterWheelZoom(
  viewport: RendererViewport,
  input: WheelZoomInput,
): RendererViewport {
  if (
    !Number.isFinite(viewport.x) ||
    !Number.isFinite(viewport.y) ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0 ||
    !Number.isFinite(input.pointer.x) ||
    !Number.isFinite(input.pointer.y)
  ) {
    return viewport;
  }
  const nextZoom = clamp(
    viewport.zoom * 2 ** normalizedWheelZoomDelta(input),
    GRAPH_MIN_ZOOM,
    GRAPH_MAX_ZOOM,
  );
  const graphPoint = {
    x: (input.pointer.x - viewport.x) / viewport.zoom,
    y: (input.pointer.y - viewport.y) / viewport.zoom,
  };
  return {
    x: input.pointer.x - graphPoint.x * nextZoom,
    y: input.pointer.y - graphPoint.y * nextZoom,
    zoom: nextZoom,
  };
}

/** Capture the current screen position of the entity being disclosed. */
export function captureDisclosureAnchor(
  graph: RendererGraph,
  entityId: string,
  viewport: RendererViewport,
): DisclosureAnchor | null {
  if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) return null;
  const node = graph.nodes.find(
    (candidate) =>
      candidate.type === 'entity' && candidate.data.entityId === entityId,
  );
  if (node === undefined) return null;
  const center = entityNodeCenter(
    graph,
    (candidate) => candidate.id === node.id,
  );
  if (center === null) return null;
  return {
    projectionNodeId: node.data.projectionNodeId,
    entityId,
    screenPoint: {
      x: center.x * viewport.zoom + viewport.x,
      y: center.y * viewport.zoom + viewport.y,
    },
    zoom: viewport.zoom,
  };
}

/** Restore a disclosure anchor after projection and layout have recomputed. */
export function viewportForDisclosureAnchor(
  graph: RendererGraph,
  anchor: DisclosureAnchor,
): RendererViewport | null {
  const center = entityNodeCenter(
    graph,
    (candidate) =>
      (candidate.type === 'entity' &&
        candidate.data.projectionNodeId === anchor.projectionNodeId) ||
      (candidate.type === 'entity' &&
        candidate.data.entityId === anchor.entityId),
  );
  if (center === null || !Number.isFinite(anchor.zoom) || anchor.zoom <= 0) {
    return null;
  }
  return {
    x: anchor.screenPoint.x - center.x * anchor.zoom,
    y: anchor.screenPoint.y - center.y * anchor.zoom,
    zoom: anchor.zoom,
  };
}
