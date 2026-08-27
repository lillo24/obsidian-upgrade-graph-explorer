import {
  validateKnowledgeSnapshot,
  type AddressableEntity,
  type EntityId,
  type KnowledgeSnapshot,
  type Reference,
  type ReferenceId,
} from '@icarus-graph-explorer/core';

export interface SearchRecord {
  readonly entity: AddressableEntity;
  readonly normalizedName: string;
  readonly normalizedPath: string;
  readonly normalizedBreadcrumbParts: readonly string[];
  readonly normalizedBreadcrumb: string;
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

export function compareEntitiesBySource(
  left: AddressableEntity,
  right: AddressableEntity,
): number {
  const leftStart = left.source.span.start;
  const rightStart = right.source.span.start;
  return compareTuple(
    [
      left.source.path,
      leftStart.offset ?? Number.MAX_SAFE_INTEGER,
      leftStart.line,
      leftStart.column,
      left.kind,
      left.id,
    ],
    [
      right.source.path,
      rightStart.offset ?? Number.MAX_SAFE_INTEGER,
      rightStart.line,
      rightStart.column,
      right.kind,
      right.id,
    ],
  );
}

function compareReferences(
  entityById: ReadonlyMap<EntityId, AddressableEntity>,
  left: Reference,
  right: Reference,
): number {
  const leftSource = entityById.get(left.sourceEntityId);
  const rightSource = entityById.get(right.sourceEntityId);
  if (leftSource === undefined || rightSource === undefined) {
    throw new Error('Cannot order references with missing canonical sources.');
  }
  const entityOrder = compareEntitiesBySource(leftSource, rightSource);
  if (entityOrder !== 0) return entityOrder;
  const leftStart = left.sourceSpan.start;
  const rightStart = right.sourceSpan.start;
  return compareTuple(
    [
      leftStart.offset ?? Number.MAX_SAFE_INTEGER,
      leftStart.line,
      leftStart.column,
      left.id,
    ],
    [
      rightStart.offset ?? Number.MAX_SAFE_INTEGER,
      rightStart.line,
      rightStart.column,
      right.id,
    ],
  );
}

function pushIndex<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

/** Validated runtime indexes. Maps are derived and never canonical/persisted. */
export class InspectionWorkspace {
  readonly #snapshot: KnowledgeSnapshot;
  readonly #entities: readonly AddressableEntity[];
  readonly #references: readonly Reference[];
  readonly #entityById: ReadonlyMap<EntityId, AddressableEntity>;
  readonly #referenceById: ReadonlyMap<ReferenceId, Reference>;
  readonly #childrenByParentId: ReadonlyMap<
    EntityId,
    readonly AddressableEntity[]
  >;
  readonly #referencesBySourceEntity: ReadonlyMap<
    EntityId,
    readonly Reference[]
  >;
  readonly #resolvedReferencesByTargetEntity: ReadonlyMap<
    EntityId,
    readonly Reference[]
  >;
  readonly #ambiguousReferencesByCandidateEntity: ReadonlyMap<
    EntityId,
    readonly Reference[]
  >;
  readonly #descendantsByEntityId = new Map<
    EntityId,
    readonly AddressableEntity[]
  >();
  #searchRecords: readonly SearchRecord[] | undefined;

  private constructor(snapshot: KnowledgeSnapshot) {
    this.#snapshot = snapshot;
    this.#entities = [...snapshot.entities].sort(compareEntitiesBySource);
    this.#entityById = new Map(
      this.#entities.map((entity) => [entity.id, entity]),
    );
    this.#references = [...snapshot.references].sort((left, right) =>
      compareReferences(this.#entityById, left, right),
    );
    this.#referenceById = new Map(
      this.#references.map((reference) => [reference.id, reference]),
    );

    const children = new Map<EntityId, AddressableEntity[]>();
    const bySource = new Map<EntityId, Reference[]>();
    const byResolvedTarget = new Map<EntityId, Reference[]>();
    const byAmbiguousCandidate = new Map<EntityId, Reference[]>();
    for (const entity of this.#entities) {
      if (entity.kind !== 'document') {
        pushIndex(children, entity.parentId, entity);
      }
    }
    for (const values of children.values()) {
      values.sort(compareEntitiesBySource);
    }
    for (const reference of this.#references) {
      pushIndex(bySource, reference.sourceEntityId, reference);
      if (reference.resolution.status === 'resolved') {
        pushIndex(
          byResolvedTarget,
          reference.resolution.targetEntityId,
          reference,
        );
      } else if (reference.resolution.status === 'ambiguous') {
        for (const candidateId of new Set(
          reference.resolution.candidateEntityIds,
        )) {
          pushIndex(byAmbiguousCandidate, candidateId, reference);
        }
      }
    }
    this.#childrenByParentId = children;
    this.#referencesBySourceEntity = bySource;
    this.#resolvedReferencesByTargetEntity = byResolvedTarget;
    this.#ambiguousReferencesByCandidateEntity = byAmbiguousCandidate;
  }

  static create(value: KnowledgeSnapshot): InspectionWorkspace {
    const validation = validateKnowledgeSnapshot(value);
    if (!validation.valid) {
      const first = validation.issues[0];
      throw new Error(
        `Cannot create inspection workspace from an invalid canonical snapshot${
          first === undefined ? '.' : `: ${first.path} ${first.message}`
        }`,
      );
    }
    return new InspectionWorkspace(validation.value);
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
      throw new Error(`Inspection workspace is missing entity "${entityId}".`);
    }
    return entity;
  }

  reference(referenceId: ReferenceId): Reference | undefined {
    return this.#referenceById.get(referenceId);
  }

  requireReference(referenceId: ReferenceId): Reference {
    const reference = this.reference(referenceId);
    if (reference === undefined) {
      throw new Error(
        `Inspection workspace is missing reference "${referenceId}".`,
      );
    }
    return reference;
  }

  parent(entityId: EntityId): AddressableEntity | undefined {
    const entity = this.entity(entityId);
    return entity === undefined || entity.kind === 'document'
      ? undefined
      : this.entity(entity.parentId);
  }

  children(entityId: EntityId): readonly AddressableEntity[] {
    return this.#childrenByParentId.get(entityId) ?? [];
  }

  descendants(entityId: EntityId): readonly AddressableEntity[] {
    this.requireEntity(entityId);
    const cached = this.#descendantsByEntityId.get(entityId);
    if (cached !== undefined) return cached;
    const descendants: AddressableEntity[] = [];
    for (const child of this.children(entityId)) {
      descendants.push(child, ...this.descendants(child.id));
    }
    this.#descendantsByEntityId.set(entityId, descendants);
    return descendants;
  }

  referencesFrom(entityId: EntityId): readonly Reference[] {
    return this.#referencesBySourceEntity.get(entityId) ?? [];
  }

  resolvedReferencesTo(entityId: EntityId): readonly Reference[] {
    return this.#resolvedReferencesByTargetEntity.get(entityId) ?? [];
  }

  ambiguousReferencesForCandidate(entityId: EntityId): readonly Reference[] {
    return this.#ambiguousReferencesByCandidateEntity.get(entityId) ?? [];
  }

  /** Internal package surface for precomputed deterministic search records. */
  searchRecords(): readonly SearchRecord[] {
    if (this.#searchRecords === undefined) {
      this.#searchRecords = this.#entities.map((entity) => {
        const parts = this.ancestors(entity.id).map((ancestor) =>
          normalizedEntityLabel(ancestor),
        );
        return {
          entity,
          normalizedName: normalizedEntityLabel(entity),
          normalizedPath: normalize(entity.source.path),
          normalizedBreadcrumbParts: parts,
          normalizedBreadcrumb: parts.join(' / '),
        };
      });
    }
    return this.#searchRecords;
  }

  ancestors(entityId: EntityId): readonly AddressableEntity[] {
    const ancestors: AddressableEntity[] = [];
    let current: AddressableEntity | undefined = this.requireEntity(entityId);
    while (current !== undefined) {
      ancestors.push(current);
      current = this.parent(current.id);
    }
    return ancestors.reverse();
  }
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function basename(path: string): string {
  const name = path.split('/').at(-1) ?? path;
  return name.toLocaleLowerCase('en-US').endsWith('.md')
    ? name.slice(0, -3)
    : name;
}

function normalizedEntityLabel(entity: AddressableEntity): string {
  if (entity.kind === 'document')
    return normalize(basename(entity.source.path));
  if (entity.kind === 'block') {
    return normalize(`Block at line ${entity.source.span.start.line}`);
  }
  const title = entity.title.trim();
  return normalize(
    title.length === 0
      ? `Untitled section at line ${entity.source.span.start.line}`
      : title,
  );
}

export function createInspectionWorkspace(
  snapshot: KnowledgeSnapshot,
): InspectionWorkspace {
  return InspectionWorkspace.create(snapshot);
}
