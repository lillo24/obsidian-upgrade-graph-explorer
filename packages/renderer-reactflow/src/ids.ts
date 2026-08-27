export function rendererNodeId(projectionNodeId: string): string {
  return JSON.stringify(['reactflow-node', projectionNodeId]);
}

export function rendererEdgeId(projectionEdgeId: string): string {
  return JSON.stringify(['reactflow-edge', projectionEdgeId]);
}
