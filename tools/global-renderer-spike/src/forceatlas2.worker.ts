/// <reference lib="webworker" />

import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import type {
  ForceAtlas2WorkerRequest,
  ForceAtlas2WorkerResponse,
} from './forceatlas2-protocol';

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener(
  'message',
  (event: MessageEvent<ForceAtlas2WorkerRequest>) => {
    const request = event.data;
    if (request.kind !== 'layout') return;
    try {
      const graph = new MultiDirectedGraph<
        { x: number; y: number; size: number },
        { weight: number }
      >();
      for (const node of request.nodes) {
        graph.addNode(node.key, { x: node.x, y: node.y, size: node.size });
      }
      for (const edge of request.edges) {
        graph.addDirectedEdgeWithKey(edge.key, edge.source, edge.target, {
          weight: edge.weight,
        });
      }
      const start = performance.now();
      forceAtlas2.assign(graph, {
        iterations: request.iterations,
        getEdgeWeight: 'weight',
        settings: {
          ...forceAtlas2.inferSettings(graph),
          barnesHutOptimize: graph.order >= 1_000,
        },
      });
      const response: ForceAtlas2WorkerResponse = {
        kind: 'result',
        requestId: request.requestId,
        computeMs: Number((performance.now() - start).toFixed(3)),
        positions: graph.mapNodes((key, attributes) => ({
          key,
          x: attributes.x,
          y: attributes.y,
        })),
      };
      workerScope.postMessage(response);
    } catch (error: unknown) {
      const response: ForceAtlas2WorkerResponse = {
        kind: 'error',
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
      };
      workerScope.postMessage(response);
    }
  },
);
