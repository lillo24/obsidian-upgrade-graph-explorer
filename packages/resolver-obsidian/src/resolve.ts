import type { ParsedSourceReference } from '@icarus-graph-explorer/adapter-obsidian';
import {
  KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION,
  validateKnowledgeSnapshot,
  type Reference,
  type ReferenceId,
} from '@icarus-graph-explorer/core';

import { transientSnapshotIdProvider } from './ids';
import { validateWorkspaceInput } from './input';
import { resolveParsedReference } from './resolution';
import { offsetRange } from './spans';
import type {
  ResolveObsidianWorkspaceInput,
  SnapshotIdProvider,
  WorkspaceResolutionDiagnostic,
  WorkspaceResolutionResult,
} from './types';
import {
  assembleWorkspaceRecords,
  deepestSectionOwner,
  type DocumentRecord,
  type WorkspaceRecords,
} from './workspace';

function hasFatal(
  diagnostics: readonly WorkspaceResolutionDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.fatal);
}

function referenceId(
  provider: SnapshotIdProvider,
  input: ResolveObsidianWorkspaceInput,
  source: DocumentRecord,
  reference: ParsedSourceReference,
  seen: Set<ReferenceId>,
  diagnostics: WorkspaceResolutionDiagnostic[],
): ReferenceId | undefined {
  const range = offsetRange(reference.sourceSpan);
  if (range === undefined) {
    throw new Error('Validated reference unexpectedly lacks source offsets.');
  }

  let id: unknown;
  try {
    id = provider.referenceId({
      workspaceId: input.workspaceId,
      path: source.entity.source.path,
      sourceOffset: range.start,
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    diagnostics.push({
      code: 'id-provider-failure',
      severity: 'error',
      fatal: true,
      message: `ID provider failed for reference ${JSON.stringify(reference.rawTarget)} in "${source.entity.source.path}": ${detail}`,
      sourcePath: source.entity.source.path,
      sourceSpan: reference.sourceSpan,
    });
    return undefined;
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    diagnostics.push({
      code: 'id-provider-failure',
      severity: 'error',
      fatal: true,
      message: `ID provider returned an empty or non-string reference ID in "${source.entity.source.path}".`,
      sourcePath: source.entity.source.path,
      sourceSpan: reference.sourceSpan,
    });
    return undefined;
  }
  if (seen.has(id)) {
    diagnostics.push({
      code: 'id-collision',
      severity: 'error',
      fatal: true,
      message: `Generated reference ID collision in "${source.entity.source.path}".`,
      sourcePath: source.entity.source.path,
      sourceSpan: reference.sourceSpan,
    });
    return undefined;
  }
  seen.add(id);
  return id;
}

function resolutionDiagnostic(
  code: NonNullable<
    ReturnType<typeof resolveParsedReference>['diagnosticCode']
  >,
  reference: ParsedSourceReference,
  source: DocumentRecord,
  reason: string,
): WorkspaceResolutionDiagnostic {
  return {
    code,
    severity: code === 'invalid-target' ? 'error' : 'warning',
    fatal: false,
    message: `Reference ${JSON.stringify(reference.rawTarget)} in "${source.entity.source.path}": ${reason}`,
    sourcePath: source.entity.source.path,
    sourceSpan: reference.sourceSpan,
  };
}

function assembleReferences(
  input: ResolveObsidianWorkspaceInput,
  workspace: WorkspaceRecords,
  provider: SnapshotIdProvider,
  diagnostics: WorkspaceResolutionDiagnostic[],
): readonly Reference[] | undefined {
  const references: Reference[] = [];
  const referenceIds = new Set<ReferenceId>();

  for (const source of workspace.documents) {
    const sortedReferences = [...source.parsed.references].sort(
      (left, right) =>
        (left.sourceSpan.start.offset ?? 0) -
        (right.sourceSpan.start.offset ?? 0),
    );
    for (const parsed of sortedReferences) {
      const id = referenceId(
        provider,
        input,
        source,
        parsed,
        referenceIds,
        diagnostics,
      );
      if (id === undefined) {
        return undefined;
      }
      const range = offsetRange(parsed.sourceSpan);
      if (range === undefined) {
        throw new Error(
          'Validated reference unexpectedly lacks source offsets.',
        );
      }
      const owner = deepestSectionOwner(source.sectionRoots, range);
      const outcome = resolveParsedReference(parsed, source, workspace);
      references.push({
        id,
        kind: parsed.kind,
        sourceEntityId: owner?.entity.id ?? source.entity.id,
        rawTarget: parsed.rawTarget,
        sourceSpan: parsed.sourceSpan,
        resolution: outcome.resolution,
      });
      if (outcome.diagnosticCode !== undefined) {
        const reason =
          outcome.resolution.status === 'resolved'
            ? 'Unexpected resolved diagnostic.'
            : outcome.resolution.reason;
        diagnostics.push(
          resolutionDiagnostic(
            outcome.diagnosticCode,
            parsed,
            source,
            reason ?? 'Target could not be resolved.',
          ),
        );
      }
    }
  }
  return references;
}

/** Resolve a complete parsed Obsidian workspace into validated schema-v1 truth. */
export function resolveObsidianWorkspace(
  input: ResolveObsidianWorkspaceInput,
): WorkspaceResolutionResult {
  const documents = [...input.documents].sort((left, right) => {
    const leftPath = left.structure.path;
    const rightPath = right.structure.path;
    return leftPath < rightPath ? -1 : leftPath > rightPath ? 1 : 0;
  });
  const diagnostics = [
    ...validateWorkspaceInput(input, documents),
  ] as WorkspaceResolutionDiagnostic[];
  if (hasFatal(diagnostics)) {
    return { ok: false, diagnostics };
  }

  const provider = input.idProvider ?? transientSnapshotIdProvider;
  const workspace = assembleWorkspaceRecords(
    documents,
    input.workspaceId,
    provider,
    diagnostics,
  );
  if (workspace === undefined || hasFatal(diagnostics)) {
    return { ok: false, diagnostics };
  }

  const references = assembleReferences(
    input,
    workspace,
    provider,
    diagnostics,
  );
  if (references === undefined || hasFatal(diagnostics)) {
    return { ok: false, diagnostics };
  }

  const candidate = {
    schemaVersion: KNOWLEDGE_SNAPSHOT_SCHEMA_VERSION,
    workspace: { id: input.workspaceId },
    entities: workspace.entities,
    references,
  };
  const validation = validateKnowledgeSnapshot(candidate);
  if (!validation.valid) {
    diagnostics.push(
      ...validation.issues.map((issue): WorkspaceResolutionDiagnostic => ({
        code: 'canonical-validation',
        severity: 'error',
        fatal: true,
        message: `Canonical snapshot validation failed at ${issue.path}: ${issue.message}`,
        relatedCode: issue.code,
      })),
    );
    return { ok: false, diagnostics };
  }

  return { ok: true, snapshot: validation.value, diagnostics };
}
