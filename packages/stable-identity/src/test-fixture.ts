import type {
  AddressableEntity,
  EntityId,
  KnowledgeSnapshot,
  Reference,
  ReferenceResolution,
  SourceLocation,
  SourceSpan,
} from '@icarus-graph-explorer/core';

interface SectionSpec {
  readonly key: string;
  readonly title: string;
  readonly level: number;
  readonly offset: number;
  readonly parentKey?: string;
}

interface BlockSpec {
  readonly key: string;
  readonly parentKey: string;
  readonly offset: number;
}

interface ReferenceSpec {
  readonly key: string;
  readonly sourceKey: string;
  readonly rawTarget: string;
  readonly offset: number;
  readonly kind?: 'link' | 'embed';
  readonly targetKey?: string;
  readonly candidateKeys?: readonly string[];
  readonly unresolvedReason?: string;
}

export interface DocumentSpec {
  readonly key: string;
  readonly path: string;
  readonly sections?: readonly SectionSpec[];
  readonly blocks?: readonly BlockSpec[];
  readonly references?: readonly ReferenceSpec[];
}

function span(offset: number, width = 1): SourceSpan {
  return {
    start: { line: offset + 1, column: 1, offset },
    end: { line: offset + 1, column: width + 1, offset: offset + width },
  };
}

function transientId(revision: string, key: string): EntityId {
  return `transient:${JSON.stringify([revision, key])}`;
}

export function buildSnapshot(
  revision: string,
  documents: readonly DocumentSpec[],
  workspaceId = 'workspace-stable-test',
): KnowledgeSnapshot {
  const sortedDocuments = [...documents].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const idByKey = new Map<string, EntityId>();
  const pathByKey = new Map<string, string>();
  for (const document of sortedDocuments) {
    idByKey.set(document.key, transientId(revision, document.key));
    pathByKey.set(document.key, document.path);
    for (const section of document.sections ?? []) {
      idByKey.set(section.key, transientId(revision, section.key));
      pathByKey.set(section.key, document.path);
    }
    for (const block of document.blocks ?? []) {
      idByKey.set(block.key, transientId(revision, block.key));
      pathByKey.set(block.key, document.path);
    }
  }
  const requireId = (key: string): EntityId => {
    const id = idByKey.get(key);
    if (id === undefined)
      throw new Error(`Unknown fixture key ${JSON.stringify(key)}.`);
    return id;
  };
  const source = (path: string, offset: number, width = 1): SourceLocation => ({
    path,
    span: span(offset, width),
  });
  const entities: AddressableEntity[] = [];
  for (const document of sortedDocuments) {
    entities.push({
      id: requireId(document.key),
      kind: 'document',
      source: {
        path: document.path,
        span: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 10_001, column: 1, offset: 10_000 },
        },
      },
    });
  }
  for (const document of sortedDocuments) {
    for (const section of document.sections ?? []) {
      entities.push({
        id: requireId(section.key),
        kind: 'section',
        parentId: requireId(section.parentKey ?? document.key),
        title: section.title,
        level: section.level,
        source: source(document.path, section.offset),
      });
    }
  }
  for (const document of sortedDocuments) {
    for (const block of document.blocks ?? []) {
      entities.push({
        id: requireId(block.key),
        kind: 'block',
        parentId: requireId(block.parentKey),
        source: source(document.path, block.offset),
      });
    }
  }
  const references: Reference[] = [];
  for (const document of sortedDocuments) {
    for (const reference of document.references ?? []) {
      let resolution: ReferenceResolution;
      if (reference.targetKey !== undefined) {
        resolution = {
          status: 'resolved',
          targetEntityId: requireId(reference.targetKey),
        };
      } else if (reference.candidateKeys !== undefined) {
        resolution = {
          status: 'ambiguous',
          candidateEntityIds: reference.candidateKeys.map(requireId),
          reason: 'fixture ambiguity',
        };
      } else {
        resolution = {
          status: 'unresolved',
          ...(reference.unresolvedReason === undefined
            ? {}
            : { reason: reference.unresolvedReason }),
        };
      }
      const sourcePath = pathByKey.get(reference.sourceKey);
      if (sourcePath === undefined) {
        throw new Error(
          `Unknown reference source ${JSON.stringify(reference.sourceKey)}.`,
        );
      }
      references.push({
        id: `transient-reference:${JSON.stringify([revision, reference.key])}`,
        kind: reference.kind ?? 'link',
        sourceEntityId: requireId(reference.sourceKey),
        rawTarget: reference.rawTarget,
        sourceSpan: span(reference.offset, reference.rawTarget.length || 1),
        resolution,
      });
    }
  }
  references.sort(
    (left, right) =>
      (left.sourceSpan.start.offset ?? 0) -
        (right.sourceSpan.start.offset ?? 0) || left.id.localeCompare(right.id),
  );
  return {
    schemaVersion: 1,
    workspace: { id: workspaceId },
    entities,
    references,
  };
}

export function entityId(
  snapshot: KnowledgeSnapshot,
  kind: AddressableEntity['kind'],
  path: string,
  title?: string,
  offset?: number,
): EntityId {
  const entity = snapshot.entities.find(
    (candidate) =>
      candidate.kind === kind &&
      candidate.source.path === path &&
      (title === undefined ||
        (candidate.kind === 'section' && candidate.title === title)) &&
      (offset === undefined || candidate.source.span.start.offset === offset),
  );
  if (entity === undefined) {
    throw new Error(
      `Fixture entity not found: ${JSON.stringify({ kind, path, title, offset })}.`,
    );
  }
  return entity.id;
}
