import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

/** Public Dagre ordering constraints for canonical projected hierarchy siblings. */
export function createFocusSchematicSiblingConstraints(
  projection: ViewProjection,
  visibleNodeIds: ReadonlySet<string>,
): { left: string; right: string }[] {
  const sourceLine = new Map(
    projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.sourceStartLine] as const] : [],
    ),
  );
  const childrenByParent = new Map<string, string[]>();
  for (const edge of projection.edges) {
    if (
      edge.kind !== 'hierarchy' ||
      !visibleNodeIds.has(edge.sourceNodeId) ||
      !visibleNodeIds.has(edge.targetNodeId)
    )
      continue;
    const children = childrenByParent.get(edge.sourceNodeId) ?? [];
    children.push(edge.targetNodeId);
    childrenByParent.set(edge.sourceNodeId, children);
  }
  return [...childrenByParent.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([, children]) =>
      children
        .sort(
          (left, right) =>
            (sourceLine.get(left) ?? Number.MAX_SAFE_INTEGER) -
              (sourceLine.get(right) ?? Number.MAX_SAFE_INTEGER) ||
            (left < right ? -1 : left > right ? 1 : 0),
        )
        .slice(1)
        .map((right, index) => ({ left: children[index]!, right })),
    );
}
