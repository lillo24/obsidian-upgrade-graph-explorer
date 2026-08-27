import type {
  KnowledgeSnapshot,
  ReferenceResolution,
} from '@icarus-graph-explorer/core';

function semanticResolution(
  resolution: ReferenceResolution,
  entityIndex: ReadonlyMap<string, number>,
): unknown {
  switch (resolution.status) {
    case 'resolved':
      return {
        status: resolution.status,
        target: entityIndex.get(resolution.targetEntityId),
      };
    case 'ambiguous':
      return {
        status: resolution.status,
        candidates: resolution.candidateEntityIds.map((id) =>
          entityIndex.get(id),
        ),
        ...(resolution.reason === undefined
          ? {}
          : { reason: resolution.reason }),
      };
    case 'unresolved':
      return resolution.reason === undefined
        ? { status: resolution.status }
        : { status: resolution.status, reason: resolution.reason };
    case 'invalid':
      return { status: resolution.status, reason: resolution.reason };
  }
}

/** Identity-free canonical shape used to prove reconciliation changed no source meaning. */
export function identityFreeSnapshot(snapshot: KnowledgeSnapshot): unknown {
  const entityIndex = new Map(
    snapshot.entities.map((entity, index) => [entity.id, index]),
  );
  return {
    schemaVersion: snapshot.schemaVersion,
    workspace: snapshot.workspace,
    entities: snapshot.entities.map((entity) =>
      entity.kind === 'document'
        ? { kind: entity.kind, source: entity.source }
        : entity.kind === 'section'
          ? {
              kind: entity.kind,
              parent: entityIndex.get(entity.parentId),
              title: entity.title,
              level: entity.level,
              source: entity.source,
            }
          : {
              kind: entity.kind,
              parent: entityIndex.get(entity.parentId),
              source: entity.source,
            },
    ),
    references: snapshot.references.map((reference) => ({
      kind: reference.kind,
      source: entityIndex.get(reference.sourceEntityId),
      rawTarget: reference.rawTarget,
      sourceSpan: reference.sourceSpan,
      resolution: semanticResolution(reference.resolution, entityIndex),
    })),
  };
}

export function assertIdentityOnlyRemap(
  transientSnapshot: KnowledgeSnapshot,
  stableSnapshot: KnowledgeSnapshot,
): void {
  if (
    JSON.stringify(identityFreeSnapshot(transientSnapshot)) !==
    JSON.stringify(identityFreeSnapshot(stableSnapshot))
  ) {
    throw new Error(
      'Stable identity reconciliation changed canonical meaning instead of only opaque IDs.',
    );
  }
}
