import type {
  AddressableEntity,
  DocumentEntity,
  EntityId,
  KnowledgeSnapshot,
  Reference,
  SectionEntity,
} from '@icarus-graph-explorer/core';

import type {
  StableDocumentObservation,
  StableEntityObservation,
  StableIdentityCatalog,
  StableReferenceObservation,
  StableSectionObservation,
} from './types';

export interface SnapshotEvidence {
  readonly entityById: ReadonlyMap<EntityId, AddressableEntity>;
  readonly childrenByParentId: ReadonlyMap<
    EntityId,
    readonly AddressableEntity[]
  >;
  readonly referencesBySourceEntityId: ReadonlyMap<
    EntityId,
    readonly Reference[]
  >;
  readonly documentByEntityId: ReadonlyMap<EntityId, DocumentEntity>;
  readonly documentFingerprintById: ReadonlyMap<EntityId, string>;
  readonly documentSignalCountById: ReadonlyMap<EntityId, number>;
  readonly sectionFingerprintById: ReadonlyMap<EntityId, string>;
  readonly sectionSignalCountById: ReadonlyMap<EntityId, number>;
  readonly siblingOrdinalById: ReadonlyMap<EntityId, number>;
  readonly sameTitleOrdinalById: ReadonlyMap<EntityId, number>;
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing === undefined) map.set(key, [value]);
  else existing.push(value);
}

function startOffset(entity: AddressableEntity): number | null {
  return entity.source.span.start.offset ?? null;
}

function referenceShape(reference: Reference): unknown {
  return [reference.kind, reference.rawTarget, reference.resolution.status];
}

function entityTreeShape(
  entity: AddressableEntity,
  children: ReadonlyMap<EntityId, readonly AddressableEntity[]>,
  references: ReadonlyMap<EntityId, readonly Reference[]>,
): unknown {
  const ownReferences = (references.get(entity.id) ?? []).map(referenceShape);
  const childShapes = (children.get(entity.id) ?? []).map((child) =>
    child.kind === 'section'
      ? [
          'section',
          child.title,
          child.level,
          entityTreeShape(child, children, references),
        ]
      : ['block'],
  );
  return [ownReferences, childShapes];
}

function descendantSignalCount(
  entity: AddressableEntity,
  children: ReadonlyMap<EntityId, readonly AddressableEntity[]>,
  references: ReadonlyMap<EntityId, readonly Reference[]>,
): number {
  const childEntities = children.get(entity.id) ?? [];
  return (
    (references.get(entity.id)?.length ?? 0) +
    childEntities.length +
    childEntities.reduce(
      (total, child) =>
        total + descendantSignalCount(child, children, references),
      0,
    )
  );
}

/** Build all matching evidence once from canonical plain data. */
export function buildSnapshotEvidence(
  snapshot: KnowledgeSnapshot,
): SnapshotEvidence {
  const entityById = new Map(
    snapshot.entities.map((entity) => [entity.id, entity]),
  );
  const children = new Map<EntityId, AddressableEntity[]>();
  const references = new Map<EntityId, Reference[]>();
  for (const entity of snapshot.entities) {
    if (entity.kind !== 'document') append(children, entity.parentId, entity);
  }
  for (const reference of snapshot.references)
    append(references, reference.sourceEntityId, reference);

  const documentByEntityId = new Map<EntityId, DocumentEntity>();
  const requireDocument = (entity: AddressableEntity): DocumentEntity => {
    const cached = documentByEntityId.get(entity.id);
    if (cached !== undefined) return cached;
    let current = entity;
    while (current.kind !== 'document') {
      const parent = entityById.get(current.parentId);
      if (parent === undefined)
        throw new Error(
          `Canonical entity ${JSON.stringify(current.id)} has no parent while building identity evidence.`,
        );
      current = parent;
    }
    documentByEntityId.set(entity.id, current);
    return current;
  };
  for (const entity of snapshot.entities) requireDocument(entity);

  const documentFingerprintById = new Map<EntityId, string>();
  const documentSignalCountById = new Map<EntityId, number>();
  const sectionFingerprintById = new Map<EntityId, string>();
  const sectionSignalCountById = new Map<EntityId, number>();
  const siblingOrdinalById = new Map<EntityId, number>();
  const sameTitleOrdinalById = new Map<EntityId, number>();

  for (const entity of snapshot.entities) {
    if (entity.kind === 'document') {
      documentFingerprintById.set(
        entity.id,
        JSON.stringify(entityTreeShape(entity, children, references)),
      );
      documentSignalCountById.set(
        entity.id,
        descendantSignalCount(entity, children, references),
      );
      continue;
    }
    const siblings = children.get(entity.parentId) ?? [];
    siblingOrdinalById.set(
      entity.id,
      siblings
        .filter((candidate) => candidate.kind === entity.kind)
        .indexOf(entity),
    );
    if (entity.kind === 'section') {
      const sameTitle = siblings.filter(
        (candidate): candidate is SectionEntity =>
          candidate.kind === 'section' &&
          candidate.title === entity.title &&
          candidate.level === entity.level,
      );
      sameTitleOrdinalById.set(entity.id, sameTitle.indexOf(entity));
      sectionFingerprintById.set(
        entity.id,
        JSON.stringify([
          entity.level,
          entityTreeShape(entity, children, references),
        ]),
      );
      sectionSignalCountById.set(
        entity.id,
        descendantSignalCount(entity, children, references),
      );
    }
  }
  return {
    entityById,
    childrenByParentId: children,
    referencesBySourceEntityId: references,
    documentByEntityId,
    documentFingerprintById,
    documentSignalCountById,
    sectionFingerprintById,
    sectionSignalCountById,
    siblingOrdinalById,
    sameTitleOrdinalById,
  };
}

function compareEntities(
  left: StableEntityObservation,
  right: StableEntityObservation,
): number {
  return (
    left.sourcePath.localeCompare(right.sourcePath) ||
    (left.sourceStartOffset ?? -1) - (right.sourceStartOffset ?? -1) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

/** Observe a stable snapshot without retaining Markdown body text or the previous snapshot. */
export function buildStableIdentityCatalog(
  snapshot: KnowledgeSnapshot,
  nextEntitySequence: number,
  nextReferenceSequence: number,
): StableIdentityCatalog {
  const evidence = buildSnapshotEvidence(snapshot);
  const entities = snapshot.entities.map((entity): StableEntityObservation => {
    const common = {
      id: entity.id,
      sourcePath: entity.source.path,
      sourceStartOffset: startOffset(entity),
    };
    if (entity.kind === 'document') {
      return {
        ...common,
        kind: 'document',
        structuralFingerprint:
          evidence.documentFingerprintById.get(entity.id) ?? '[]',
        structuralSignalCount:
          evidence.documentSignalCountById.get(entity.id) ?? 0,
      } satisfies StableDocumentObservation;
    }
    const document = evidence.documentByEntityId.get(entity.id);
    if (document === undefined)
      throw new Error(
        `Cannot observe entity ${JSON.stringify(entity.id)} without its document.`,
      );
    if (entity.kind === 'block') {
      return {
        ...common,
        kind: 'block',
        parentId: entity.parentId,
        documentId: document.id,
        siblingOrdinal: evidence.siblingOrdinalById.get(entity.id) ?? 0,
      };
    }
    return {
      ...common,
      kind: 'section',
      parentId: entity.parentId,
      documentId: document.id,
      title: entity.title,
      level: entity.level,
      siblingOrdinal: evidence.siblingOrdinalById.get(entity.id) ?? 0,
      sameTitleOrdinal: evidence.sameTitleOrdinalById.get(entity.id) ?? 0,
      strongFingerprint: evidence.sectionFingerprintById.get(entity.id) ?? '[]',
      strongSignalCount: evidence.sectionSignalCountById.get(entity.id) ?? 0,
    } satisfies StableSectionObservation;
  });
  const references = snapshot.references.map(
    (reference): StableReferenceObservation => ({
      id: reference.id,
      sourceEntityId: reference.sourceEntityId,
      kind: reference.kind,
      rawTarget: reference.rawTarget,
      sourceStartOffset: reference.sourceSpan.start.offset ?? null,
      resolution: reference.resolution,
    }),
  );
  return {
    schemaVersion: 1,
    workspaceId: snapshot.workspace.id,
    nextEntitySequence,
    nextReferenceSequence,
    entities: entities.sort(compareEntities),
    references: references.sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}
