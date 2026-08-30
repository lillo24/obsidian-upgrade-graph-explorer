import forceAtlas2 from 'graphology-layout-forceatlas2';

import type { GlobalGraph } from './graph';

/** Node-only R2 oracle. Interactive browser/Tauri use must call the worker path. */
export function runForceAtlas2Synchronous(
  graph: GlobalGraph,
  iterations: number,
): void {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('ForceAtlas2 iterations must be a positive integer.');
  }
  forceAtlas2.assign(graph, {
    iterations,
    getEdgeWeight: (_edge, attributes) =>
      Math.max(1, attributes.referenceCount),
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: graph.order >= 1_000,
    },
  });
}
