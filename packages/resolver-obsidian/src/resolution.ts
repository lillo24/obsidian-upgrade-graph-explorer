import type {
  ParsedInternalTarget,
  ParsedSourceReference,
} from '@icarus-graph-explorer/adapter-obsidian';
import type {
  EntityId,
  ReferenceResolution,
} from '@icarus-graph-explorer/core';

import {
  decodedTargetComponents,
  documentCandidates,
  type DocumentCandidateResult,
} from './paths';
import type { WorkspaceResolutionDiagnosticCode } from './types';
import type {
  BlockRecord,
  DocumentRecord,
  SectionRecord,
  WorkspaceRecords,
} from './workspace';

const FILE_NOT_FOUND = 'No matching Markdown document.';
const FILE_AMBIGUOUS = 'Multiple Markdown documents match this target.';
const HEADING_NOT_FOUND = 'No matching heading in candidate document.';
const HEADING_AMBIGUOUS = 'Multiple sections match this heading target.';
const BLOCK_NOT_FOUND = 'No matching explicit block anchor.';
const BLOCK_AMBIGUOUS = 'Multiple explicit block anchors match this target.';

export interface ResolutionOutcome {
  readonly resolution: ReferenceResolution;
  readonly diagnosticCode?: WorkspaceResolutionDiagnosticCode;
}

interface EntityCandidate {
  readonly id: EntityId;
  readonly path: string;
  readonly offset: number;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedDistinctCandidates(
  candidates: readonly EntityCandidate[],
): readonly EntityId[] {
  return [
    ...new Map(
      [...candidates]
        .sort(
          (left, right) =>
            compareText(left.path, right.path) || left.offset - right.offset,
        )
        .map((candidate) => [candidate.id, candidate]),
    ).values(),
  ].map((candidate) => candidate.id);
}

function classifyCandidates(
  candidates: readonly EntityCandidate[],
  missingReason: string,
  ambiguousReason: string,
): ResolutionOutcome {
  const candidateEntityIds = sortedDistinctCandidates(candidates);
  if (candidateEntityIds.length === 0) {
    return {
      resolution: { status: 'unresolved', reason: missingReason },
      diagnosticCode: 'unresolved-target',
    };
  }
  if (candidateEntityIds.length === 1) {
    const targetEntityId = candidateEntityIds[0];
    if (targetEntityId === undefined) {
      throw new Error('One resolution candidate unexpectedly has no ID.');
    }
    return { resolution: { status: 'resolved', targetEntityId } };
  }
  return {
    resolution: {
      status: 'ambiguous',
      candidateEntityIds,
      reason: ambiguousReason,
    },
    diagnosticCode: 'ambiguous-target',
  };
}

function fileCandidateFailure(
  result: Exclude<DocumentCandidateResult, { readonly ok: true }>,
): ResolutionOutcome {
  return result.kind === 'unsupported'
    ? {
        resolution: { status: 'unresolved', reason: result.reason },
        diagnosticCode: 'unsupported-target',
      }
    : {
        resolution: { status: 'invalid', reason: result.reason },
        diagnosticCode: 'invalid-target',
      };
}

function targetDocuments(
  target: ParsedInternalTarget,
  reference: ParsedSourceReference,
  source: DocumentRecord,
  workspace: WorkspaceRecords,
): DocumentCandidateResult {
  if (target.kind !== 'file' && target.file === undefined) {
    return { ok: true, candidates: [source] };
  }
  const file = target.file;
  if (file === undefined) {
    return { ok: true, candidates: [source] };
  }
  return documentCandidates(file, reference.syntax, source, workspace);
}

function documentEntityCandidates(
  documents: readonly DocumentRecord[],
): readonly EntityCandidate[] {
  return documents.map((document) => ({
    id: document.entity.id,
    path: document.entity.source.path,
    offset: document.range.start,
  }));
}

function matchingSections(
  document: DocumentRecord,
  headings: readonly string[],
): readonly SectionRecord[] {
  if (headings.length === 1) {
    const heading = headings[0];
    return heading === undefined
      ? []
      : (document.sectionsByTitle.get(heading) ?? []);
  }
  return document.sectionsByPath.get(JSON.stringify(headings)) ?? [];
}

function sectionEntityCandidates(
  sections: readonly SectionRecord[],
): readonly EntityCandidate[] {
  return sections.map((section) => ({
    id: section.entity.id,
    path: section.entity.source.path,
    offset: section.range.start,
  }));
}

function blockEntityCandidates(
  blocks: readonly BlockRecord[],
): readonly EntityCandidate[] {
  return blocks.map((block) => ({
    id: block.entity.id,
    path: block.entity.source.path,
    offset: block.range.start,
  }));
}

export function resolveParsedReference(
  reference: ParsedSourceReference,
  source: DocumentRecord,
  workspace: WorkspaceRecords,
): ResolutionOutcome {
  const documentResult = targetDocuments(
    reference.target,
    reference,
    source,
    workspace,
  );
  if (!documentResult.ok) {
    return fileCandidateFailure(documentResult);
  }

  if (reference.target.kind === 'file') {
    return classifyCandidates(
      documentEntityCandidates(documentResult.candidates),
      FILE_NOT_FOUND,
      FILE_AMBIGUOUS,
    );
  }

  if (reference.target.kind === 'heading') {
    const decoded = decodedTargetComponents(reference);
    if (!decoded.ok) {
      return {
        resolution: { status: 'invalid', reason: decoded.reason },
        diagnosticCode: 'invalid-target',
      };
    }
    const headings = decoded.headings ?? reference.target.headings;
    const sections = documentResult.candidates.flatMap((document) =>
      matchingSections(document, headings),
    );
    return classifyCandidates(
      sectionEntityCandidates(sections),
      HEADING_NOT_FOUND,
      HEADING_AMBIGUOUS,
    );
  }

  const blockId = reference.target.blockId;
  const blocks = documentResult.candidates.flatMap(
    (document) => document.blocksById.get(blockId) ?? [],
  );
  return classifyCandidates(
    blockEntityCandidates(blocks),
    BLOCK_NOT_FOUND,
    BLOCK_AMBIGUOUS,
  );
}
