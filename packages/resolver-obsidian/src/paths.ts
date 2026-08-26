import type {
  ParsedReferenceSyntax,
  ParsedSourceReference,
} from '@icarus-graph-explorer/adapter-obsidian';

import type { DocumentRecord, WorkspaceRecords } from './workspace';

export type DocumentCandidateResult =
  | {
      readonly ok: true;
      readonly candidates: readonly DocumentRecord[];
    }
  | {
      readonly ok: false;
      readonly kind: 'invalid' | 'unsupported';
      readonly reason: string;
    };

const INVALID_PERCENT_REASON =
  'Markdown target contains malformed percent encoding.';
const INVALID_PATH_REASON = 'Target is not a valid workspace-relative path.';
const ESCAPE_REASON = 'Target escapes the workspace root.';
const UNSUPPORTED_REASON =
  'Non-Markdown targets are not represented in schema v1.';

function decodeMarkdownComponent(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch (error: unknown) {
    if (error instanceof URIError) {
      return undefined;
    }
    throw error;
  }
}

export function decodedTargetComponents(reference: ParsedSourceReference):
  | {
      readonly ok: true;
      readonly headings?: readonly string[];
    }
  | { readonly ok: false; readonly reason: string } {
  if (reference.syntax === 'wikilink' || reference.target.kind !== 'heading') {
    return { ok: true };
  }
  const headings: string[] = [];
  for (const heading of reference.target.headings) {
    const decoded = decodeMarkdownComponent(heading);
    if (decoded === undefined) {
      return { ok: false, reason: INVALID_PERCENT_REASON };
    }
    headings.push(decoded);
  }
  return { ok: true, headings };
}

function explicitExtension(path: string): string | undefined {
  const filename = path.slice(path.lastIndexOf('/') + 1);
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1) : undefined;
}

function stripMarkdownExtension(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

function normalizeSegments(
  base: readonly string[],
  target: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false } {
  if (target.length === 0 || target.startsWith('/') || target.includes('\\')) {
    return { ok: false };
  }
  const result = [...base];
  for (const segment of target.split('/')) {
    if (segment.length === 0) {
      return { ok: false };
    }
    if (segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (result.length === 0) {
        return { ok: false };
      }
      result.pop();
    } else {
      result.push(segment);
    }
  }
  return result.length === 0
    ? { ok: false }
    : { ok: true, value: result.join('/') };
}

function sourceFolder(document: DocumentRecord): readonly string[] {
  const segments = document.entity.source.path.split('/');
  return segments.slice(0, -1);
}

function exactDocument(
  stem: string,
  workspace: WorkspaceRecords,
): DocumentRecord | undefined {
  return workspace.documentByPath.get(`${stem}.md`);
}

function unique(records: readonly DocumentRecord[]): readonly DocumentRecord[] {
  return [
    ...new Map(records.map((record) => [record.entity.id, record])).values(),
  ];
}

function wikilinkCandidates(
  rawFile: string,
  source: DocumentRecord,
  workspace: WorkspaceRecords,
): DocumentCandidateResult {
  const extension = explicitExtension(rawFile);
  if (extension !== undefined && extension !== 'md') {
    return { ok: false, kind: 'unsupported', reason: UNSUPPORTED_REASON };
  }
  const stem = stripMarkdownExtension(rawFile);
  const isDotRelative =
    stem === '.' ||
    stem === '..' ||
    stem.startsWith('./') ||
    stem.startsWith('../');

  if (isDotRelative) {
    const normalized = normalizeSegments(sourceFolder(source), stem);
    if (!normalized.ok) {
      return { ok: false, kind: 'invalid', reason: ESCAPE_REASON };
    }
    const candidate = exactDocument(normalized.value, workspace);
    return { ok: true, candidates: candidate === undefined ? [] : [candidate] };
  }

  if (!stem.includes('/')) {
    return {
      ok: true,
      candidates: workspace.documentsByBasename.get(stem) ?? [],
    };
  }

  const rootPath = normalizeSegments([], stem);
  if (!rootPath.ok) {
    return { ok: false, kind: 'invalid', reason: INVALID_PATH_REASON };
  }
  const rootExact = exactDocument(rootPath.value, workspace);
  if (rootExact !== undefined) {
    return { ok: true, candidates: [rootExact] };
  }

  const relativePath = normalizeSegments(sourceFolder(source), stem);
  if (relativePath.ok) {
    const relativeExact = exactDocument(relativePath.value, workspace);
    if (relativeExact !== undefined) {
      return { ok: true, candidates: [relativeExact] };
    }
  }

  return {
    ok: true,
    candidates: unique(workspace.documentsBySuffix.get(rootPath.value) ?? []),
  };
}

function markdownCandidates(
  rawFile: string,
  source: DocumentRecord,
  workspace: WorkspaceRecords,
): DocumentCandidateResult {
  const decoded = decodeMarkdownComponent(rawFile);
  if (decoded === undefined) {
    return { ok: false, kind: 'invalid', reason: INVALID_PERCENT_REASON };
  }
  const extension = explicitExtension(decoded);
  if (extension !== undefined && extension !== 'md') {
    return { ok: false, kind: 'unsupported', reason: UNSUPPORTED_REASON };
  }
  const normalized = normalizeSegments(
    sourceFolder(source),
    stripMarkdownExtension(decoded),
  );
  if (!normalized.ok) {
    const reason = decoded.startsWith('..')
      ? ESCAPE_REASON
      : INVALID_PATH_REASON;
    return { ok: false, kind: 'invalid', reason };
  }
  const candidate = exactDocument(normalized.value, workspace);
  return { ok: true, candidates: candidate === undefined ? [] : [candidate] };
}

export function documentCandidates(
  file: string,
  syntax: ParsedReferenceSyntax,
  source: DocumentRecord,
  workspace: WorkspaceRecords,
): DocumentCandidateResult {
  return syntax === 'wikilink'
    ? wikilinkCandidates(file, source, workspace)
    : markdownCandidates(file, source, workspace);
}
