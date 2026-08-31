import type {
  ProjectedEntityNode,
  ProjectedReferenceEdge,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

export function globalTestProjection(): ViewProjection {
  const documents: ProjectedEntityNode[] = [
    ['doc-a', 'alpha/A.md'],
    ['doc-b', 'alpha/B.md'],
    ['doc-c', 'beta/C.md'],
    ['doc-root', 'Root.md'],
  ].map(([entityId, sourcePath]) => ({
    id: `entity:${entityId}`,
    kind: 'entity',
    entityId: entityId!,
    entityKind: 'document',
    sourcePath: sourcePath!,
    sourceStartLine: 1,
    title: null,
    revealableDescendantCount: 2,
    internalReferenceIds: [],
    role: 'content',
    focusDistance: null,
  }));
  const edges: ProjectedReferenceEdge[] = [
    ['edge-ab', 'doc-a', 'doc-b'],
    ['edge-ac', 'doc-a', 'doc-c'],
    ['edge-cr', 'doc-c', 'doc-root'],
  ].map(([id, source, target]) => ({
    id: id!,
    kind: 'reference',
    sourceNodeId: `entity:${source}`,
    targetNodeId: `entity:${target}`,
    status: 'resolved',
    referenceIds: [`reference:${id}`],
  }));
  return { nodes: documents, edges, issues: [] };
}
