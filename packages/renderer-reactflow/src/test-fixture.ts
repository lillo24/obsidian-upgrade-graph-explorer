import type { ViewProjection } from '@icarus-graph-explorer/view-projection';

export function rendererTestProjection(): ViewProjection {
  return {
    nodes: [
      {
        id: 'projection-document',
        kind: 'entity',
        entityId: 'document-a',
        entityKind: 'document',
        sourcePath: 'Folder/Alpha.md',
        sourceStartLine: 1,
        title: null,
        revealableDescendantCount: 2,
        internalReferenceIds: ['reference-internal-a', 'reference-internal-b'],
        role: 'content',
        focusDistance: 0,
      },
      {
        id: 'projection-section',
        kind: 'entity',
        entityId: 'section-a',
        entityKind: 'section',
        sourcePath: 'Folder/Alpha.md',
        sourceStartLine: 4,
        title: 'Overview',
        revealableDescendantCount: 0,
        internalReferenceIds: [],
        role: 'content',
        focusDistance: 1,
      },
      {
        id: 'projection-diagnostic',
        kind: 'reference-target',
        status: 'ambiguous',
        rawTarget: 'Shared note',
        referenceIds: ['reference-a', 'reference-b'],
        candidateEntityIds: ['candidate-a', 'candidate-b'],
        reasons: ['multiple matches'],
      },
    ],
    edges: [
      {
        id: 'projection-hierarchy-edge',
        kind: 'hierarchy',
        sourceNodeId: 'projection-document',
        targetNodeId: 'projection-section',
      },
      {
        id: 'projection-reference-edge',
        kind: 'reference',
        sourceNodeId: 'projection-section',
        targetNodeId: 'projection-diagnostic',
        status: 'ambiguous',
        referenceIds: ['reference-a', 'reference-b'],
      },
    ],
    issues: [],
  };
}
