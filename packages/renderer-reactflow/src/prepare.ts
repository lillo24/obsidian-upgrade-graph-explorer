import { layoutRendererGraph } from './layout-sync';
import { mapProjectionToReactFlow } from './mapping';
import type { PrepareRendererGraphOptions, RendererGraph } from './types';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

export function prepareRendererGraph(
  projection: ViewProjection,
  options: PrepareRendererGraphOptions,
): RendererGraph {
  const map = () =>
    mapProjectionToReactFlow(
      projection,
      options.layoutMode,
      new Set(options.expandedEntityIds ?? []),
    );
  const mapped =
    options.performance === undefined
      ? map()
      : options.performance.measure(
          'renderer-mapping',
          'renderer-mappings',
          map,
        );
  const layout = () =>
    layoutRendererGraph(
      mapped.nodes,
      mapped.edges,
      options.layoutMode,
      options.layoutEngine,
    );
  return options.performance === undefined
    ? layout()
    : options.performance.measure('dagre-layout', 'layouts', layout);
}

export { layoutRendererGraph, mapProjectionToReactFlow };
export {
  applyRendererLayoutPositions,
  createRendererLayoutInput,
  fallbackRendererGraph,
} from './layout';

export type {
  GraphLayoutMode,
  LayoutEngine,
  PrepareRendererGraphOptions,
  RendererGraph,
} from './types';
