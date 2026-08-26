import type {
  ParsedObsidianDocument,
  ParsedReferenceSyntax,
  ParsedSourceReference,
} from '@icarus-graph-explorer/adapter-obsidian';
import type {
  DocumentEntity,
  KnowledgeSnapshot,
  Reference,
  SectionEntity,
  WorkspacePath,
} from '@icarus-graph-explorer/core';

import type { CompatibilityProbe } from './types';

interface ReferenceOccurrence {
  readonly canonical: Reference;
  readonly parsed: ParsedSourceReference;
  readonly sourcePath: WorkspacePath;
}

interface DocumentIndex {
  readonly documents: readonly DocumentEntity[];
  readonly byPath: ReadonlyMap<string, readonly DocumentEntity[]>;
  readonly byFoldedPath: ReadonlyMap<string, readonly DocumentEntity[]>;
  readonly byBasename: ReadonlyMap<string, readonly DocumentEntity[]>;
  readonly byFoldedBasename: ReadonlyMap<string, readonly DocumentEntity[]>;
  readonly bySuffix: ReadonlyMap<string, readonly DocumentEntity[]>;
  readonly byFoldedSuffix: ReadonlyMap<string, readonly DocumentEntity[]>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function documentStem(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function extension(path: string): string | undefined {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1) : undefined;
}

function sourceFolder(path: string): readonly string[] {
  return path.split('/').slice(0, -1);
}

function normalizeSegments(
  base: readonly string[],
  target: string,
): string | undefined {
  if (target.length === 0 || target.startsWith('/') || target.includes('\\')) {
    return undefined;
  }
  const result = [...base];
  for (const segment of target.split('/')) {
    if (segment.length === 0) return undefined;
    if (segment === '.') continue;
    if (segment === '..') {
      if (result.length === 0) return undefined;
      result.pop();
    } else {
      result.push(segment);
    }
  }
  return result.length === 0 ? undefined : result.join('/');
}

function decodeMarkdown(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch (error: unknown) {
    if (error instanceof URIError) return undefined;
    throw error;
  }
}

function comparable(value: string, ignoreCase: boolean): string {
  return ignoreCase ? value.toLocaleLowerCase('en-US') : value;
}

function appendIndex(
  index: Map<string, DocumentEntity[]>,
  key: string,
  document: DocumentEntity,
): void {
  const existing = index.get(key);
  if (existing === undefined) index.set(key, [document]);
  else existing.push(document);
}

function buildDocumentIndex(
  documents: readonly DocumentEntity[],
): DocumentIndex {
  const byPath = new Map<string, DocumentEntity[]>();
  const byFoldedPath = new Map<string, DocumentEntity[]>();
  const byBasename = new Map<string, DocumentEntity[]>();
  const byFoldedBasename = new Map<string, DocumentEntity[]>();
  const bySuffix = new Map<string, DocumentEntity[]>();
  const byFoldedSuffix = new Map<string, DocumentEntity[]>();
  for (const document of documents) {
    const path = document.source.path;
    const stem = documentStem(path);
    const name = basename(stem);
    appendIndex(byPath, path, document);
    appendIndex(byFoldedPath, comparable(path, true), document);
    appendIndex(byBasename, name, document);
    appendIndex(byFoldedBasename, comparable(name, true), document);
    const segments = stem.split('/');
    for (let index = 0; index < segments.length; index += 1) {
      const suffix = segments.slice(index).join('/');
      appendIndex(bySuffix, suffix, document);
      appendIndex(byFoldedSuffix, comparable(suffix, true), document);
    }
  }
  return {
    documents,
    byPath,
    byFoldedPath,
    byBasename,
    byFoldedBasename,
    bySuffix,
    byFoldedSuffix,
  };
}

function exactDocuments(
  index: DocumentIndex,
  stem: string,
  ignoreCase: boolean,
): readonly DocumentEntity[] {
  const expected = `${stem}.md`;
  return (
    (ignoreCase
      ? index.byFoldedPath.get(comparable(expected, true))
      : index.byPath.get(expected)) ?? []
  );
}

function uniqueDocuments(
  documents: readonly DocumentEntity[],
): readonly DocumentEntity[] {
  return [
    ...new Map(documents.map((document) => [document.id, document])).values(),
  ].sort((left, right) => compareText(left.source.path, right.source.path));
}

function documentCandidates(
  rawFile: string,
  syntax: ParsedReferenceSyntax,
  sourcePath: WorkspacePath,
  index: DocumentIndex,
  ignoreCase: boolean,
): readonly DocumentEntity[] {
  const decoded = syntax === 'markdown' ? decodeMarkdown(rawFile) : rawFile;
  if (decoded === undefined) return [];
  const targetExtension = extension(decoded);
  if (targetExtension !== undefined && targetExtension !== 'md') return [];
  const stem = decoded.endsWith('.md') ? decoded.slice(0, -3) : decoded;

  if (syntax === 'markdown') {
    const normalized = normalizeSegments(sourceFolder(sourcePath), stem);
    return normalized === undefined
      ? []
      : exactDocuments(index, normalized, ignoreCase);
  }

  const dotRelative =
    stem === '.' ||
    stem === '..' ||
    stem.startsWith('./') ||
    stem.startsWith('../');
  if (dotRelative) {
    const normalized = normalizeSegments(sourceFolder(sourcePath), stem);
    return normalized === undefined
      ? []
      : exactDocuments(index, normalized, ignoreCase);
  }

  if (!stem.includes('/')) {
    const expected = comparable(stem, ignoreCase);
    return uniqueDocuments(
      (ignoreCase
        ? index.byFoldedBasename.get(expected)
        : index.byBasename.get(expected)) ?? [],
    );
  }

  const root = normalizeSegments([], stem);
  if (root === undefined) return [];
  const rootExact = exactDocuments(index, root, ignoreCase);
  if (rootExact.length > 0) return uniqueDocuments(rootExact);

  const relative = normalizeSegments(sourceFolder(sourcePath), stem);
  if (relative !== undefined) {
    const relativeExact = exactDocuments(index, relative, ignoreCase);
    if (relativeExact.length > 0) return uniqueDocuments(relativeExact);
  }

  return uniqueDocuments(
    (ignoreCase
      ? index.byFoldedSuffix.get(comparable(root, true))
      : index.bySuffix.get(root)) ?? [],
  );
}

function occurrenceKey(
  path: WorkspacePath,
  reference: Pick<
    ParsedSourceReference | Reference,
    'rawTarget' | 'sourceSpan'
  >,
): string {
  const start = reference.sourceSpan.start;
  return JSON.stringify([
    path,
    start.offset ?? null,
    start.line,
    start.column,
    reference.rawTarget,
  ]);
}

function occurrences(
  snapshot: KnowledgeSnapshot,
  documents: readonly ParsedObsidianDocument[],
): readonly ReferenceOccurrence[] {
  const entityById = new Map(
    snapshot.entities.map((entity) => [entity.id, entity]),
  );
  const parsedByOccurrence = new Map<string, ParsedSourceReference>();
  for (const document of documents) {
    for (const reference of document.references) {
      parsedByOccurrence.set(
        occurrenceKey(document.structure.path, reference),
        reference,
      );
    }
  }

  const result: ReferenceOccurrence[] = [];
  for (const canonical of snapshot.references) {
    const owner = entityById.get(canonical.sourceEntityId);
    if (owner === undefined) continue;
    const parsed = parsedByOccurrence.get(
      occurrenceKey(owner.source.path, canonical),
    );
    if (parsed !== undefined) {
      result.push({ canonical, parsed, sourcePath: owner.source.path });
    }
  }
  return result;
}

function headingChains(
  snapshot: KnowledgeSnapshot,
): ReadonlyMap<string, readonly string[]> {
  const sectionById = new Map(
    snapshot.entities
      .filter((entity): entity is SectionEntity => entity.kind === 'section')
      .map((section) => [section.id, section]),
  );
  const chains = new Map<string, readonly string[]>();
  for (const section of sectionById.values()) {
    const titles = [section.title];
    let parent = sectionById.get(section.parentId);
    while (parent !== undefined) {
      titles.unshift(parent.title);
      parent = sectionById.get(parent.parentId);
    }
    chains.set(section.id, titles);
  }
  return chains;
}

function caseOnlyHeadingProbe(
  occurrence: ReferenceOccurrence,
  snapshot: KnowledgeSnapshot,
  index: DocumentIndex,
  chains: ReadonlyMap<string, readonly string[]>,
): CompatibilityProbe | undefined {
  const target = occurrence.parsed.target;
  if (
    occurrence.canonical.resolution.status !== 'unresolved' ||
    target.kind !== 'heading'
  ) {
    return undefined;
  }
  const candidateDocuments =
    target.file === undefined
      ? index.documents.filter(
          ({ source }) => source.path === occurrence.sourcePath,
        )
      : documentCandidates(
          target.file,
          occurrence.parsed.syntax,
          occurrence.sourcePath,
          index,
          false,
        );
  if (candidateDocuments.length === 0) return undefined;

  const headings =
    occurrence.parsed.syntax === 'markdown'
      ? target.headings.map(decodeMarkdown)
      : [...target.headings];
  if (headings.some((heading) => heading === undefined)) return undefined;
  const expected = (headings as readonly string[]).map((heading) =>
    comparable(heading, true),
  );
  const paths = new Set(candidateDocuments.map(({ source }) => source.path));
  const matches = snapshot.entities
    .filter(
      (entity): entity is SectionEntity =>
        entity.kind === 'section' && paths.has(entity.source.path),
    )
    .filter((section) => {
      const chain = chains.get(section.id) ?? [];
      const suffix = chain
        .slice(-expected.length)
        .map((title) => comparable(title, true));
      return (
        suffix.length === expected.length &&
        suffix.every((title, index) => title === expected[index])
      );
    });
  if (matches.length !== 1) return undefined;
  const match = matches[0];
  return match === undefined
    ? undefined
    : {
        code: 'case-only-heading-match',
        referenceId: occurrence.canonical.id,
        message: 'Exactly one heading matches when letter case is ignored.',
        candidateEntityIds: [match.id],
      };
}

function caseOnlyFileProbe(
  occurrence: ReferenceOccurrence,
  index: DocumentIndex,
): CompatibilityProbe | undefined {
  const target = occurrence.parsed.target;
  if (
    occurrence.canonical.resolution.status !== 'unresolved' ||
    target.file === undefined ||
    (extension(target.file) !== undefined && extension(target.file) !== 'md')
  ) {
    return undefined;
  }
  const exact = documentCandidates(
    target.file,
    occurrence.parsed.syntax,
    occurrence.sourcePath,
    index,
    false,
  );
  if (exact.length > 0) return undefined;
  const insensitive = documentCandidates(
    target.file,
    occurrence.parsed.syntax,
    occurrence.sourcePath,
    index,
    true,
  );
  const match = insensitive.length === 1 ? insensitive[0] : undefined;
  return match === undefined
    ? undefined
    : {
        code: 'case-only-file-match',
        referenceId: occurrence.canonical.id,
        message:
          'Exactly one Markdown document matches when letter case is ignored.',
        candidateEntityIds: [match.id],
      };
}

function resourceCandidates(
  rawFile: string,
  syntax: ParsedReferenceSyntax,
  sourcePath: WorkspacePath,
  resources: readonly WorkspacePath[],
): readonly WorkspacePath[] {
  const decoded = syntax === 'markdown' ? decodeMarkdown(rawFile) : rawFile;
  if (
    decoded === undefined ||
    extension(decoded) === undefined ||
    extension(decoded) === 'md'
  ) {
    return [];
  }
  const sorted = [...resources].sort(compareText);
  if (syntax === 'markdown') {
    const relative = normalizeSegments(sourceFolder(sourcePath), decoded);
    return relative === undefined
      ? []
      : sorted.filter((path) => path === relative);
  }

  const dotRelative = decoded.startsWith('./') || decoded.startsWith('../');
  if (dotRelative) {
    const relative = normalizeSegments(sourceFolder(sourcePath), decoded);
    return relative === undefined
      ? []
      : sorted.filter((path) => path === relative);
  }
  if (!decoded.includes('/')) {
    return sorted.filter((path) => basename(path) === decoded);
  }
  const root = normalizeSegments([], decoded);
  if (root === undefined) return [];
  const rootExact = sorted.filter((path) => path === root);
  if (rootExact.length > 0) return rootExact;
  const relative = normalizeSegments(sourceFolder(sourcePath), decoded);
  if (relative !== undefined) {
    const relativeExact = sorted.filter((path) => path === relative);
    if (relativeExact.length > 0) return relativeExact;
  }
  return sorted.filter((path) => path === root || path.endsWith(`/${root}`));
}

function attachmentProbe(
  occurrence: ReferenceOccurrence,
  resources: readonly WorkspacePath[],
): CompatibilityProbe | undefined {
  const target = occurrence.parsed.target;
  if (
    occurrence.canonical.resolution.status !== 'unresolved' ||
    target.file === undefined ||
    extension(target.file) === undefined ||
    extension(target.file) === 'md'
  ) {
    return undefined;
  }
  const candidates = resourceCandidates(
    target.file,
    occurrence.parsed.syntax,
    occurrence.sourcePath,
    resources,
  );
  if (candidates.length === 1) {
    return {
      code: 'attachment-present-unmodeled',
      referenceId: occurrence.canonical.id,
      message:
        'A matching non-Markdown resource exists but is not canonical schema-v1 truth.',
      candidatePaths: candidates,
    };
  }
  if (candidates.length > 1) {
    return {
      code: 'attachment-match-ambiguous',
      referenceId: occurrence.canonical.id,
      message: 'Multiple non-Markdown resources match this unsupported target.',
      candidatePaths: candidates,
    };
  }
  return {
    code: 'attachment-not-found',
    referenceId: occurrence.canonical.id,
    message:
      'No matching non-Markdown resource was found in the diagnostic inventory.',
  };
}

export function buildCompatibilityProbes(
  snapshot: KnowledgeSnapshot,
  parsedDocuments: readonly ParsedObsidianDocument[],
  nonMarkdownPaths: readonly WorkspacePath[],
): readonly CompatibilityProbe[] {
  const documents = snapshot.entities.filter(
    (entity): entity is DocumentEntity => entity.kind === 'document',
  );
  const documentIndex = buildDocumentIndex(documents);
  const chains = headingChains(snapshot);
  const probes = occurrences(snapshot, parsedDocuments).flatMap((occurrence) =>
    [
      caseOnlyFileProbe(occurrence, documentIndex),
      caseOnlyHeadingProbe(occurrence, snapshot, documentIndex, chains),
      attachmentProbe(occurrence, nonMarkdownPaths),
    ].filter((probe): probe is CompatibilityProbe => probe !== undefined),
  );
  return probes.sort(
    (left, right) =>
      compareText(left.referenceId, right.referenceId) ||
      compareText(left.code, right.code),
  );
}
