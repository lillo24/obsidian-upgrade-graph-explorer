import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type EntityId,
  type KnowledgeSnapshot,
  type Reference,
  type ReferenceId,
} from '@icarus-graph-explorer/core';

function sourceOrder(entity: AddressableEntity): readonly (string | number)[] {
  const start = entity.source.span.start;
  return [
    entity.source.path,
    start.offset ?? Number.MAX_SAFE_INTEGER,
    start.line,
    start.column,
    entity.kind === 'document' ? 0 : entity.kind === 'section' ? 1 : 2,
    entity.id,
  ];
}

function compareTuple(
  left: readonly (string | number)[],
  right: readonly (string | number)[],
): number {
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === b) continue;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : 1;
  }
  return 0;
}

function compareEntities(
  left: AddressableEntity,
  right: AddressableEntity,
): number {
  return compareTuple(sourceOrder(left), sourceOrder(right));
}

/** Validated runtime indexes derived from, but never stored in, canonical truth. */
export class ProjectionWorkspace {
  readonly #snapshot: KnowledgeSnapshot;
  readonly #entities: readonly AddressableEntity[];
  readonly #references: readonly Reference[];
  readonly #entityById: ReadonlyMap<EntityId, AddressableEntity>;
  readonly #referenceById: ReadonlyMap<ReferenceId, Reference>;
  readonly #childrenByParentId: ReadonlyMap<
    EntityId,
    readonly AddressableEntity[]
  >;
  readonly #descendantsByEntityId = new Map<
    EntityId,
    readonly AddressableEntity[]
  >();

  private constructor(snapshot: KnowledgeSnapshot) {
    this.#snapshot = snapshot;
    this.#entities = [...snapshot.entities].sort(compareEntities);
    this.#entityById = new Map(
      this.#entities.map((entity) => [entity.id, entity]),
    );
    this.#references = [...snapshot.references].sort((left, right) => {
      const sourceComparison = compareEntities(
        this.requireEntity(left.sourceEntityId),
        this.requireEntity(right.sourceEntityId),
      );
      if (sourceComparison !== 0) return sourceComparison;
      const leftOffset =
        left.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER;
      const rightOffset =
        right.sourceSpan.start.offset ?? Number.MAX_SAFE_INTEGER;
      return leftOffset - rightOffset || left.id.localeCompare(right.id);
    });
    this.#referenceById = new Map(
      this.#references.map((reference) => [reference.id, reference]),
    );

    const children = new Map<EntityId, AddressableEntity[]>();
    for (const entity of this.#entities) {
      if (entity.kind === 'document') continue;
      const siblings = children.get(entity.parentId) ?? [];
      siblings.push(entity);
      children.set(entity.parentId, siblings);
    }
    for (const siblings of children.values()) siblings.sort(compareEntities);
    this.#childrenByParentId = children;
  }

  static create(value: KnowledgeSnapshot): ProjectionWorkspace {
    const validation = validateKnowledgeSnapshot(value);
    if (!validation.valid) {
      const first = validation.issues[0];
      throw new Error(
        `Cannot create projection workspace from an invalid canonical snapshot${
          first === undefined ? '.' : `: ${first.path} ${first.message}`
        }`,
      );
    }
    return new ProjectionWorkspace(validation.value);
  }

  snapshot(): KnowledgeSnapshot {
    return this.#snapshot;
  }

  entities(): readonly AddressableEntity[] {
    return this.#entities;
  }

  references(): readonly Reference[] {
    return this.#references;
  }

  entity(entityId: EntityId): AddressableEntity | undefined {
    return this.#entityById.get(entityId);
  }

  requireEntity(entityId: EntityId): AddressableEntity {
    const entity = this.entity(entityId);
    if (entity === undefined) {
      throw new Error(`Projection workspace is missing entity "${entityId}".`);
    }
    return entity;
  }

  reference(referenceId: ReferenceId): Reference | undefined {
    return this.#referenceById.get(referenceId);
  }

  children(entityId: EntityId): readonly AddressableEntity[] {
    return this.#childrenByParentId.get(entityId) ?? [];
  }

  parent(entityId: EntityId): AddressableEntity | undefined {
    const entity = this.entity(entityId);
    return entity === undefined || entity.kind === 'document'
      ? undefined
      : this.entity(entity.parentId);
  }

  descendants(entityId: EntityId): readonly AddressableEntity[] {
    const cached = this.#descendantsByEntityId.get(entityId);
    if (cached !== undefined) return cached;

    const descendants: AddressableEntity[] = [];
    for (const child of this.children(entityId)) {
      descendants.push(child, ...this.descendants(child.id));
    }
    this.#descendantsByEntityId.set(entityId, descendants);
    return descendants;
  }
}

export function createProjectionWorkspace(
  snapshot: KnowledgeSnapshot,
): ProjectionWorkspace {
  return ProjectionWorkspace.create(snapshot);
}
