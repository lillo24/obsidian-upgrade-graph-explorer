import type {
  ParsedObsidianBlockAnchor,
  ParsedObsidianDocument,
} from '@icarus-graph-explorer/adapter-obsidian';
import type {
  AddressableEntity,
  BlockEntity,
  DocumentEntity,
  EntityId,
  SectionEntity,
  SourceSpan,
  WorkspaceId,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

import { contains, offsetRange, type OffsetRange } from './spans';
import type {
  SnapshotIdProvider,
  WorkspaceResolutionDiagnostic,
} from './types';

type ParsedSection = ParsedObsidianDocument['structure']['sections'][number];

export interface SectionRecord {
  readonly parsed: ParsedSection;
  readonly entity: SectionEntity;
  readonly range: OffsetRange;
  readonly titleChain: readonly string[];
  readonly children: readonly SectionRecord[];
}

export interface BlockRecord {
  readonly parsed: ParsedObsidianBlockAnchor;
  readonly entity: BlockEntity;
  readonly range: OffsetRange;
}

export interface DocumentRecord {
  readonly parsed: ParsedObsidianDocument;
  readonly entity: DocumentEntity;
  readonly range: OffsetRange;
  readonly sectionRoots: readonly SectionRecord[];
  readonly sections: readonly SectionRecord[];
  readonly sectionsByTitle: ReadonlyMap<string, readonly SectionRecord[]>;
  readonly sectionsByPath: ReadonlyMap<string, readonly SectionRecord[]>;
  readonly blocks: readonly BlockRecord[];
  readonly blocksById: ReadonlyMap<string, readonly BlockRecord[]>;
}

export interface WorkspaceRecords {
  readonly documents: readonly DocumentRecord[];
  readonly entities: readonly AddressableEntity[];
  readonly documentByPath: ReadonlyMap<WorkspacePath, DocumentRecord>;
  readonly documentsByBasename: ReadonlyMap<string, readonly DocumentRecord[]>;
  readonly documentsBySuffix: ReadonlyMap<string, readonly DocumentRecord[]>;
}

function knownRange(span: SourceSpan): OffsetRange {
  const range = offsetRange(span);
  if (range === undefined) {
    throw new Error('Validated source span unexpectedly lacks offsets.');
  }
  return range;
}

function appendIndexValue<K, V>(index: Map<K, V[]>, key: K, value: V): void {
  const existing = index.get(key);
  if (existing === undefined) {
    index.set(key, [value]);
  } else {
    existing.push(value);
  }
}

function invokeId(
  create: () => string,
  entityIds: Set<EntityId>,
  diagnostics: WorkspaceResolutionDiagnostic[],
  context: string,
  path: WorkspacePath,
  span: SourceSpan,
): EntityId | undefined {
  let id: unknown;
  try {
    id = create();
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    diagnostics.push({
      code: 'id-provider-failure',
      severity: 'error',
      fatal: true,
      message: `ID provider failed for ${context} in "${path}": ${detail}`,
      sourcePath: path,
      sourceSpan: span,
    });
    return undefined;
  }

  if (typeof id !== 'string' || id.trim().length === 0) {
    diagnostics.push({
      code: 'id-provider-failure',
      severity: 'error',
      fatal: true,
      message: `ID provider returned an empty or non-string ID for ${context} in "${path}".`,
      sourcePath: path,
      sourceSpan: span,
    });
    return undefined;
  }
  if (entityIds.has(id)) {
    diagnostics.push({
      code: 'id-collision',
      severity: 'error',
      fatal: true,
      message: `Generated entity ID collision for ${context} in "${path}".`,
      sourcePath: path,
      sourceSpan: span,
    });
    return undefined;
  }
  entityIds.add(id);
  return id;
}

function buildSections(
  sections: readonly ParsedSection[],
  parentId: EntityId,
  titlePrefix: readonly string[],
  workspaceId: WorkspaceId,
  path: WorkspacePath,
  provider: SnapshotIdProvider,
  entityIds: Set<EntityId>,
  diagnostics: WorkspaceResolutionDiagnostic[],
  flat: SectionRecord[],
): readonly SectionRecord[] | undefined {
  const records: SectionRecord[] = [];

  for (const section of sections) {
    const headingOffset = knownRange(section.headingSpan).start;
    const id = invokeId(
      () => provider.sectionId({ workspaceId, path, headingOffset }),
      entityIds,
      diagnostics,
      `section ${JSON.stringify(section.title)}`,
      path,
      section.span,
    );
    if (id === undefined) {
      return undefined;
    }

    const entity: SectionEntity = {
      id,
      kind: 'section',
      parentId,
      title: section.title,
      level: section.level,
      source: { path, span: section.span },
    };
    const titleChain = [...titlePrefix, section.title];
    const recordDraft: {
      parsed: ParsedSection;
      entity: SectionEntity;
      range: OffsetRange;
      titleChain: readonly string[];
      children: readonly SectionRecord[];
    } = {
      parsed: section,
      entity,
      range: knownRange(section.span),
      titleChain,
      children: [],
    };
    flat.push(recordDraft);
    const children = buildSections(
      section.children,
      id,
      titleChain,
      workspaceId,
      path,
      provider,
      entityIds,
      diagnostics,
      flat,
    );
    if (children === undefined) {
      return undefined;
    }
    recordDraft.children = children;
    records.push(recordDraft);
  }

  return records;
}

export function deepestSectionOwner(
  roots: readonly SectionRecord[],
  target: OffsetRange,
): SectionRecord | undefined {
  for (const section of roots) {
    if (!contains(section.range, target)) {
      continue;
    }
    return deepestSectionOwner(section.children, target) ?? section;
  }
  return undefined;
}

function headingPathKeys(titleChain: readonly string[]): readonly string[] {
  const keys: string[] = [];
  for (let start = 0; start < titleChain.length; start += 1) {
    keys.push(JSON.stringify(titleChain.slice(start)));
  }
  return keys;
}

function documentStem(path: WorkspacePath): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function basename(stem: string): string {
  return stem.slice(stem.lastIndexOf('/') + 1);
}

function suffixes(stem: string): readonly string[] {
  const segments = stem.split('/');
  return segments.map((_segment, index) => segments.slice(index).join('/'));
}

export function assembleWorkspaceRecords(
  documents: readonly ParsedObsidianDocument[],
  workspaceId: WorkspaceId,
  provider: SnapshotIdProvider,
  diagnostics: WorkspaceResolutionDiagnostic[],
): WorkspaceRecords | undefined {
  const entityIds = new Set<EntityId>();
  const documentRecords: DocumentRecord[] = [];
  const documentEntities: DocumentEntity[] = [];
  const sectionEntities: SectionEntity[] = [];
  const blockEntities: BlockEntity[] = [];

  for (const parsed of documents) {
    const path = parsed.structure.path;
    const documentId = invokeId(
      () => provider.documentId({ workspaceId, path }),
      entityIds,
      diagnostics,
      'document',
      path,
      parsed.structure.span,
    );
    if (documentId === undefined) {
      return undefined;
    }
    const entity: DocumentEntity = {
      id: documentId,
      kind: 'document',
      source: { path, span: parsed.structure.span },
    };
    const sections: SectionRecord[] = [];
    const sectionRoots = buildSections(
      parsed.structure.sections,
      documentId,
      [],
      workspaceId,
      path,
      provider,
      entityIds,
      diagnostics,
      sections,
    );
    if (sectionRoots === undefined) {
      return undefined;
    }

    const sectionsByTitle = new Map<string, SectionRecord[]>();
    const sectionsByPath = new Map<string, SectionRecord[]>();
    for (const section of sections) {
      appendIndexValue(sectionsByTitle, section.entity.title, section);
      for (const key of headingPathKeys(section.titleChain)) {
        appendIndexValue(sectionsByPath, key, section);
      }
    }

    const blocks: BlockRecord[] = [];
    const blocksById = new Map<string, BlockRecord[]>();
    const sortedAnchors = [...parsed.blockAnchors].sort(
      (left, right) =>
        knownRange(left.markerSpan).start - knownRange(right.markerSpan).start,
    );
    for (const anchor of sortedAnchors) {
      const range = knownRange(anchor.markerSpan);
      const blockId = invokeId(
        () =>
          provider.blockId({
            workspaceId,
            path,
            markerOffset: range.start,
            blockId: anchor.blockId,
          }),
        entityIds,
        diagnostics,
        `block anchor "^${anchor.blockId}"`,
        path,
        anchor.markerSpan,
      );
      if (blockId === undefined) {
        return undefined;
      }
      const parent = deepestSectionOwner(sectionRoots, range);
      const blockEntity: BlockEntity = {
        id: blockId,
        kind: 'block',
        parentId: parent?.entity.id ?? documentId,
        source: { path, span: anchor.markerSpan },
      };
      const blockRecord = { parsed: anchor, entity: blockEntity, range };
      blocks.push(blockRecord);
      appendIndexValue(blocksById, anchor.blockId, blockRecord);
    }

    documentEntities.push(entity);
    sectionEntities.push(...sections.map((section) => section.entity));
    blockEntities.push(...blocks.map((block) => block.entity));
    documentRecords.push({
      parsed,
      entity,
      range: knownRange(parsed.structure.span),
      sectionRoots,
      sections,
      sectionsByTitle,
      sectionsByPath,
      blocks,
      blocksById,
    });
  }

  const documentByPath = new Map<WorkspacePath, DocumentRecord>();
  const documentsByBasename = new Map<string, DocumentRecord[]>();
  const documentsBySuffix = new Map<string, DocumentRecord[]>();
  for (const document of documentRecords) {
    const path = document.entity.source.path;
    const stem = documentStem(path);
    documentByPath.set(path, document);
    appendIndexValue(documentsByBasename, basename(stem), document);
    for (const suffix of suffixes(stem)) {
      appendIndexValue(documentsBySuffix, suffix, document);
    }
  }

  return {
    documents: documentRecords,
    entities: [...documentEntities, ...sectionEntities, ...blockEntities],
    documentByPath,
    documentsByBasename,
    documentsBySuffix,
  };
}
