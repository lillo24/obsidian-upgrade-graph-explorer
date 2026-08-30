import type { GraphCenterRequest, RendererGraph } from './types';

export interface GraphCenterInstruction {
  readonly x: number;
  readonly y: number;
  readonly zoom?: number;
}

export interface ResolvedGraphCenterRequest {
  readonly handledKey: number;
  readonly instruction: GraphCenterInstruction | null;
}

/**
 * A current semantic center request supersedes an older Fit token. Consuming
 * that token prevents a late async layout commit from fitting after centering.
 */
export function shouldApplyGraphFitRequest(
  previousFitKey: number,
  fitRequestKey: number,
  centerRequest: GraphCenterRequest | undefined,
): boolean {
  return centerRequest === undefined && previousFitKey !== fitRequestKey;
}

/** Pure request consumption keeps stale/repeated viewport behavior testable. */
export function resolveGraphCenterRequest(
  graph: RendererGraph,
  request: GraphCenterRequest | undefined,
  previousKey: number | null,
): ResolvedGraphCenterRequest | null {
  if (request === undefined || request.key === previousKey) return null;
  const node = graph.nodes.find(
    (candidate) => candidate.data.projectionNodeId === request.nodeId,
  );
  if (node === undefined) {
    return { handledKey: request.key, instruction: null };
  }
  const width = node.width ?? node.measured?.width ?? 0;
  const height = node.height ?? node.measured?.height ?? 0;
  return {
    handledKey: request.key,
    instruction: {
      x: node.position.x + width / 2,
      y: node.position.y + height / 2,
      ...(request.zoom === undefined ? {} : { zoom: request.zoom }),
    },
  };
}
