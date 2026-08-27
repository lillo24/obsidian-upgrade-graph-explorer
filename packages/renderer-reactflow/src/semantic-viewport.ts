import type { GraphViewportObservation, RendererGraph } from './types';

export interface RendererViewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface ViewportContainerSize {
  readonly width: number;
  readonly height: number;
}

/** Convert a renderer transform into a stable canonical-entity bookmark. */
export function observeSemanticViewport(
  graph: RendererGraph,
  viewport: RendererViewport,
  container: ViewportContainerSize,
): GraphViewportObservation {
  if (
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0 ||
    !Number.isFinite(container.width) ||
    !Number.isFinite(container.height) ||
    container.width <= 0 ||
    container.height <= 0
  ) {
    return { anchorEntityId: null, zoom: viewport.zoom };
  }
  const center = {
    x: (container.width / 2 - viewport.x) / viewport.zoom,
    y: (container.height / 2 - viewport.y) / viewport.zoom,
  };
  const candidates = graph.nodes
    .filter((node) => node.type === 'entity')
    .map((node) => {
      const width = node.width ?? node.measured?.width ?? 0;
      const height = node.height ?? node.measured?.height ?? 0;
      const x = node.position.x + width / 2;
      const y = node.position.y + height / 2;
      return {
        node,
        distance: (x - center.x) ** 2 + (y - center.y) ** 2,
      };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.node.id.localeCompare(right.node.id),
    );
  return {
    anchorEntityId: candidates[0]?.node.data.entityId ?? null,
    zoom: viewport.zoom,
  };
}
