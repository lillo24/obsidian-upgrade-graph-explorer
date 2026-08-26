import type { ParsedObsidianDocument } from '@icarus-graph-explorer/adapter-obsidian';
import type { SourceSpan, WorkspacePath } from '@icarus-graph-explorer/core';

import { contains, offsetRange, type OffsetRange } from './spans';
import type {
  ResolveObsidianWorkspaceInput,
  WorkspaceResolutionDiagnostic,
} from './types';

type ParsedSection = ParsedObsidianDocument['structure']['sections'][number];

function fatal(
  diagnostics: WorkspaceResolutionDiagnostic[],
  message: string,
  sourcePath?: WorkspacePath,
  sourceSpan?: SourceSpan,
): void {
  diagnostics.push({
    code: 'invalid-source-structure',
    severity: 'error',
    fatal: true,
    message,
    ...(sourcePath === undefined ? {} : { sourcePath }),
    ...(sourceSpan === undefined ? {} : { sourceSpan }),
  });
}

function isNormalizedWorkspacePath(path: string): boolean {
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    /^[A-Za-z]:\//u.test(path)
  ) {
    return false;
  }
  return path
    .split('/')
    .every(
      (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
    );
}

function validateRange(
  span: SourceSpan,
  owner: OffsetRange | undefined,
  diagnostics: WorkspaceResolutionDiagnostic[],
  path: WorkspacePath,
  context: string,
): OffsetRange | undefined {
  const range = offsetRange(span);
  if (range === undefined || (owner !== undefined && !contains(owner, range))) {
    fatal(
      diagnostics,
      `${context} in "${path}" must have valid UTF-16 offsets inside its owning source range.`,
      path,
      span,
    );
    return undefined;
  }
  return range;
}

function validateSections(
  sections: readonly ParsedSection[],
  owner: OffsetRange,
  parentLevel: number,
  diagnostics: WorkspaceResolutionDiagnostic[],
  path: WorkspacePath,
): void {
  let previousEnd = owner.start;

  for (const section of sections) {
    const range = validateRange(
      section.span,
      owner,
      diagnostics,
      path,
      `Section ${JSON.stringify(section.title)}`,
    );
    const headingRange = validateRange(
      section.headingSpan,
      range,
      diagnostics,
      path,
      `Heading ${JSON.stringify(section.title)}`,
    );

    if (
      range !== undefined &&
      (range.start < previousEnd || section.level <= parentLevel)
    ) {
      fatal(
        diagnostics,
        `Section ${JSON.stringify(section.title)} in "${path}" is out of source order or violates its heading hierarchy.`,
        path,
        section.span,
      );
    }
    if (
      range !== undefined &&
      headingRange !== undefined &&
      headingRange.start !== range.start
    ) {
      fatal(
        diagnostics,
        `Section ${JSON.stringify(section.title)} in "${path}" must start at its heading.`,
        path,
        section.span,
      );
    }

    if (range !== undefined) {
      validateSections(
        section.children,
        range,
        section.level,
        diagnostics,
        path,
      );
      previousEnd = range.end;
    }
  }
}

function forwardAdapterDiagnostics(
  documents: readonly ParsedObsidianDocument[],
  diagnostics: WorkspaceResolutionDiagnostic[],
): void {
  for (const document of documents) {
    for (const adapterDiagnostic of document.diagnostics) {
      diagnostics.push({
        code: 'adapter-diagnostic',
        severity: adapterDiagnostic.severity,
        fatal: false,
        message: `Adapter diagnostic for "${document.structure.path}": ${adapterDiagnostic.message}`,
        sourcePath: document.structure.path,
        ...(adapterDiagnostic.sourceSpan === undefined
          ? {}
          : { sourceSpan: adapterDiagnostic.sourceSpan }),
        relatedCode: adapterDiagnostic.code,
      });
    }
  }
}

export function validateWorkspaceInput(
  input: ResolveObsidianWorkspaceInput,
  documents: readonly ParsedObsidianDocument[],
): readonly WorkspaceResolutionDiagnostic[] {
  const diagnostics: WorkspaceResolutionDiagnostic[] = [];
  forwardAdapterDiagnostics(documents, diagnostics);

  if (input.workspaceId.trim().length === 0) {
    diagnostics.push({
      code: 'invalid-workspace-id',
      severity: 'error',
      fatal: true,
      message: 'Workspace ID must be a non-empty string.',
    });
  }

  const paths = new Set<WorkspacePath>();
  for (const document of documents) {
    const path = document.structure.path;
    if (!isNormalizedWorkspacePath(path)) {
      diagnostics.push({
        code: 'invalid-document-path',
        severity: 'error',
        fatal: true,
        message: `Document path "${path}" must be normalized and workspace-relative.`,
        sourcePath: path,
      });
    }
    if (paths.has(path)) {
      diagnostics.push({
        code: 'duplicate-document-path',
        severity: 'error',
        fatal: true,
        message: `Parsed document path "${path}" occurs more than once.`,
        sourcePath: path,
      });
    }
    paths.add(path);

    const documentRange = validateRange(
      document.structure.span,
      undefined,
      diagnostics,
      path,
      'Document span',
    );
    if (documentRange === undefined) {
      continue;
    }

    validateSections(
      document.structure.sections,
      documentRange,
      0,
      diagnostics,
      path,
    );

    for (const reference of document.references) {
      validateRange(
        reference.sourceSpan,
        documentRange,
        diagnostics,
        path,
        `Reference ${JSON.stringify(reference.rawTarget)}`,
      );
    }
    for (const anchor of document.blockAnchors) {
      validateRange(
        anchor.markerSpan,
        documentRange,
        diagnostics,
        path,
        `Block anchor "^${anchor.blockId}"`,
      );
      if (!/^[A-Za-z0-9-]+$/u.test(anchor.blockId)) {
        fatal(
          diagnostics,
          `Block anchor "^${anchor.blockId}" in "${path}" is not valid adapter IR.`,
          path,
          anchor.markerSpan,
        );
      }
    }
  }

  return diagnostics;
}
