import { layoutRendererGraph } from './layout';
import { mapProjectionToReactFlow } from './mapping';
import type { PrepareRendererGraphOptions, RendererGraph } from './types';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

export function prepareRendererGraph(
  projection: ViewProjection,
  options: PrepareRendererGraphOptions,
): RendererGraph {
  const mapped = mapProjectionToReactFlow(
    projection,
    options.layoutMode,
    new Set(options.expandedEntityIds ?? []),
  );
  return layoutRendererGraph(
    mapped.nodes,
    mapped.edges,
    options.layoutMode,
    options.layoutEngine,
  );
}

export { layoutRendererGraph, mapProjectionToReactFlow };

export type {
  GraphLayoutMode,
  LayoutEngine,
  PrepareRendererGraphOptions,
  RendererGraph,
} from './types';
