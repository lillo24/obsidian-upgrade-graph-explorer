import {
  parseObsidianDocument,
  type ParsedObsidianDocument,
} from '@icarus-graph-explorer/adapter-obsidian';
import type { WorkspacePath } from '@icarus-graph-explorer/core';
import { resolveObsidianWorkspace } from '@icarus-graph-explorer/resolver-obsidian';
import { diffKnowledgeSnapshots } from '@icarus-graph-explorer/snapshot-delta';
import {
  createStableIdentityCatalog,
  reconcileStableIdentity,
  type StableIdentityCatalog,
  type StableIdentityReconciliationResult,
} from '@icarus-graph-explorer/stable-identity';

import type {
  ApplyObsidianWorkspaceChangesResult,
  InitializeObsidianWorkspaceEngineInput,
  InitializeObsidianWorkspaceEngineResult,
  ObsidianWorkspaceEngine,
  WorkspaceEngineFailure,
  WorkspaceSourceChange,
  WorkspaceSourceDocument,
} from './types';

type PlainRecord = Record<string, unknown>;

class EngineState implements ObsidianWorkspaceEngine {
  readonly workspaceId: string;
  readonly revision: number;
  readonly snapshot;
  readonly identityCatalog;
  readonly resolutionDiagnostics;
  readonly #documents: ReadonlyMap<WorkspacePath, ParsedObsidianDocument>;

  constructor({
    workspaceId,
    revision,
    documents,
    stable,
    resolutionDiagnostics,
  }: {
    readonly workspaceId: string;
    readonly revision: number;
    readonly documents: ReadonlyMap<WorkspacePath, ParsedObsidianDocument>;
    readonly stable: StableIdentityReconciliationResult;
    readonly resolutionDiagnostics: ReturnType<
      typeof resolveObsidianWorkspace
    >['diagnostics'];
  }) {
    this.workspaceId = workspaceId;
    this.revision = revision;
    this.snapshot = stable.snapshot;
    this.identityCatalog = stable.catalog;
    this.resolutionDiagnostics = resolutionDiagnostics;
    this.#documents = documents;
  }

  get parsedDocumentCount(): number {
    return this.#documents.size;
  }

  parsedDocument(path: WorkspacePath): ParsedObsidianDocument | undefined {
    return this.#documents.get(path);
  }

  parsedDocuments(): readonly ParsedObsidianDocument[] {
    return [...this.#documents.values()].sort((left, right) =>
      left.structure.path.localeCompare(right.structure.path),
    );
  }
}

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !/^[A-Za-z]:\//u.test(path) &&
    path
      .split('/')
      .every(
        (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
      )
  );
}

function failure(
  stage: WorkspaceEngineFailure['stage'],
  code: string,
  message: string,
  path?: WorkspacePath,
): WorkspaceEngineFailure {
  return { stage, code, message, ...(path === undefined ? {} : { path }) };
}

function unexpectedError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceDocumentFailure(
  value: unknown,
  index: number,
): WorkspaceEngineFailure | undefined {
  if (!isRecord(value)) {
    return failure(
      'input',
      'invalid-source-document',
      `Initial document at index ${index} must be an object.`,
    );
  }
  const unexpected = Object.keys(value).find(
    (key) => key !== 'path' && key !== 'source',
  );
  if (unexpected !== undefined) {
    return failure(
      'input',
      'invalid-source-document',
      `Initial document at index ${index} has unexpected field ${JSON.stringify(unexpected)}.`,
    );
  }
  if (typeof value.path !== 'string' || !normalizedPath(value.path)) {
    return failure(
      'input',
      'invalid-source-path',
      `Initial document at index ${index} must use a normalized workspace-relative path.`,
      typeof value.path === 'string' ? value.path : undefined,
    );
  }
  if (typeof value.source !== 'string') {
    return failure(
      'input',
      'invalid-source-content',
      `Initial document ${JSON.stringify(value.path)} must contain string source.`,
      value.path,
    );
  }
  return undefined;
}

function parseDocuments(documents: readonly WorkspaceSourceDocument[]):
  | {
      readonly ok: true;
      readonly documents: ReadonlyMap<WorkspacePath, ParsedObsidianDocument>;
    }
  | { readonly ok: false; readonly failure: WorkspaceEngineFailure } {
  const parsed = new Map<WorkspacePath, ParsedObsidianDocument>();
  for (const document of [...documents].sort((left, right) =>
    left.path.localeCompare(right.path),
  )) {
    try {
      parsed.set(document.path, parseObsidianDocument(document));
    } catch (error: unknown) {
      return {
        ok: false,
        failure: failure(
          'parse',
          'document-parse-failed',
          `Could not parse ${JSON.stringify(document.path)}: ${unexpectedError(error)}`,
          document.path,
        ),
      };
    }
  }
  return { ok: true, documents: parsed };
}

function resolveAndStabilize(
  workspaceId: string,
  documents: ReadonlyMap<WorkspacePath, ParsedObsidianDocument>,
  previousCatalog: StableIdentityCatalog,
):
  | {
      readonly ok: true;
      readonly stable: StableIdentityReconciliationResult;
      readonly diagnostics: ReturnType<
        typeof resolveObsidianWorkspace
      >['diagnostics'];
    }
  | { readonly ok: false; readonly failure: WorkspaceEngineFailure } {
  const resolution = resolveObsidianWorkspace({
    workspaceId,
    documents: [...documents.values()],
  });
  if (!resolution.ok) {
    const first = resolution.diagnostics.find(({ fatal }) => fatal);
    return {
      ok: false,
      failure: failure(
        'resolution',
        first?.code ?? 'workspace-resolution-failed',
        `Whole-workspace resolution failed${first === undefined ? '.' : `: ${first.message}`}`,
        first?.sourcePath,
      ),
    };
  }
  try {
    return {
      ok: true,
      stable: reconcileStableIdentity({
        snapshot: resolution.snapshot,
        previousCatalog,
      }),
      diagnostics: resolution.diagnostics,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      failure: failure(
        'identity',
        'stable-identity-reconciliation-failed',
        `Stable identity reconciliation failed: ${unexpectedError(error)}`,
      ),
    };
  }
}

export function initializeObsidianWorkspaceEngine(
  input: InitializeObsidianWorkspaceEngineInput,
): InitializeObsidianWorkspaceEngineResult {
  if (
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.trim() === ''
  ) {
    return {
      ok: false,
      failure: failure(
        'input',
        'invalid-workspace-id',
        'Workspace ID must be a non-empty string.',
      ),
    };
  }
  if (!Array.isArray(input.documents)) {
    return {
      ok: false,
      failure: failure(
        'input',
        'invalid-source-documents',
        'Initial documents must be an array.',
      ),
    };
  }
  const paths = new Set<WorkspacePath>();
  for (const [index, document] of input.documents.entries()) {
    const invalid = sourceDocumentFailure(document, index);
    if (invalid !== undefined) return { ok: false, failure: invalid };
    if (paths.has(document.path)) {
      return {
        ok: false,
        failure: failure(
          'input',
          'duplicate-source-path',
          `Initial document path ${JSON.stringify(document.path)} is duplicated.`,
          document.path,
        ),
      };
    }
    paths.add(document.path);
  }
  const parsed = parseDocuments(input.documents);
  if (!parsed.ok) return parsed;
  let catalog: StableIdentityCatalog;
  try {
    catalog =
      input.identityCatalog ?? createStableIdentityCatalog(input.workspaceId);
  } catch (error: unknown) {
    return {
      ok: false,
      failure: failure(
        'identity',
        'identity-catalog-initialization-failed',
        `Could not initialize stable identity: ${unexpectedError(error)}`,
      ),
    };
  }
  const built = resolveAndStabilize(
    input.workspaceId,
    parsed.documents,
    catalog,
  );
  if (!built.ok) return built;
  const engine = new EngineState({
    workspaceId: input.workspaceId,
    revision: 0,
    documents: parsed.documents,
    stable: built.stable,
    resolutionDiagnostics: built.diagnostics,
  });
  const reparsedPaths = [...paths].sort();
  return {
    ok: true,
    engine,
    snapshot: engine.snapshot,
    identityCatalog: engine.identityCatalog,
    resolutionDiagnostics: engine.resolutionDiagnostics,
    identitySummary: built.stable.summary,
    identityDiagnostics: built.stable.diagnostics,
    stats: {
      reparsedPaths,
      reusedParsedDocumentCount: 0,
      totalParsedDocumentCount: engine.parsedDocumentCount,
    },
  };
}

interface ValidatedChanges {
  readonly upserts: readonly Extract<
    WorkspaceSourceChange,
    { readonly kind: 'upsert' }
  >[];
  readonly deletes: readonly Extract<
    WorkspaceSourceChange,
    { readonly kind: 'delete' }
  >[];
  readonly moves: readonly Extract<
    WorkspaceSourceChange,
    { readonly kind: 'move' }
  >[];
}

function validateChanges(
  engine: ObsidianWorkspaceEngine,
  changes: readonly WorkspaceSourceChange[],
):
  | { readonly ok: true; readonly changes: ValidatedChanges }
  | { readonly ok: false; readonly failure: WorkspaceEngineFailure } {
  if (!Array.isArray(changes) || changes.length === 0) {
    return {
      ok: false,
      failure: failure(
        'input',
        'empty-change-batch',
        'A workspace change batch must contain at least one operation.',
      ),
    };
  }
  const upserts: ValidatedChanges['upserts'][number][] = [];
  const deletes: ValidatedChanges['deletes'][number][] = [];
  const moves: ValidatedChanges['moves'][number][] = [];
  const touched = new Map<WorkspacePath, number>();
  const touch = (
    path: WorkspacePath,
    index: number,
  ): WorkspaceEngineFailure | undefined => {
    const previous = touched.get(path);
    if (previous !== undefined) {
      return failure(
        'input',
        'conflicting-change-batch',
        `Change operations at indexes ${previous} and ${index} both touch ${JSON.stringify(path)}.`,
        path,
      );
    }
    touched.set(path, index);
    return undefined;
  };
  for (const [index, change] of changes.entries()) {
    if (!isRecord(change)) {
      return {
        ok: false,
        failure: failure(
          'input',
          'invalid-source-change',
          `Change at index ${index} must be an object.`,
        ),
      };
    }
    if (change.kind === 'upsert') {
      if (
        Object.keys(change).some(
          (key) => key !== 'kind' && key !== 'path' && key !== 'source',
        ) ||
        typeof change.path !== 'string' ||
        !normalizedPath(change.path) ||
        typeof change.source !== 'string'
      ) {
        return {
          ok: false,
          failure: failure(
            'input',
            'invalid-upsert',
            `Upsert at index ${index} requires normalized path and string source only.`,
            typeof change.path === 'string' ? change.path : undefined,
          ),
        };
      }
      const conflict = touch(change.path, index);
      if (conflict !== undefined) return { ok: false, failure: conflict };
      upserts.push({
        kind: 'upsert',
        path: change.path,
        source: change.source,
      });
      continue;
    }
    if (change.kind === 'delete') {
      if (
        Object.keys(change).some((key) => key !== 'kind' && key !== 'path') ||
        typeof change.path !== 'string' ||
        !normalizedPath(change.path)
      ) {
        return {
          ok: false,
          failure: failure(
            'input',
            'invalid-delete',
            `Delete at index ${index} requires one normalized path.`,
            typeof change.path === 'string' ? change.path : undefined,
          ),
        };
      }
      const conflict = touch(change.path, index);
      if (conflict !== undefined) return { ok: false, failure: conflict };
      deletes.push({ kind: 'delete', path: change.path });
      continue;
    }
    if (change.kind === 'move') {
      if (
        Object.keys(change).some(
          (key) => key !== 'kind' && key !== 'fromPath' && key !== 'toPath',
        ) ||
        typeof change.fromPath !== 'string' ||
        !normalizedPath(change.fromPath) ||
        typeof change.toPath !== 'string' ||
        !normalizedPath(change.toPath) ||
        change.fromPath === change.toPath
      ) {
        return {
          ok: false,
          failure: failure(
            'input',
            'invalid-move',
            `Move at index ${index} requires distinct normalized source and target paths.`,
            typeof change.fromPath === 'string' ? change.fromPath : undefined,
          ),
        };
      }
      const sourceConflict = touch(change.fromPath, index);
      if (sourceConflict !== undefined)
        return { ok: false, failure: sourceConflict };
      const targetConflict = touch(change.toPath, index);
      if (targetConflict !== undefined)
        return { ok: false, failure: targetConflict };
      moves.push({
        kind: 'move',
        fromPath: change.fromPath,
        toPath: change.toPath,
      });
      continue;
    }
    return {
      ok: false,
      failure: failure(
        'input',
        'invalid-source-change',
        `Change at index ${index} has an unsupported kind.`,
      ),
    };
  }
  for (const { path } of deletes) {
    if (engine.parsedDocument(path) === undefined) {
      return {
        ok: false,
        failure: failure(
          'input',
          'delete-missing-path',
          `Cannot delete missing workspace document ${JSON.stringify(path)}. Request a full source resync.`,
          path,
        ),
      };
    }
  }
  for (const { fromPath, toPath } of moves) {
    if (engine.parsedDocument(fromPath) === undefined) {
      return {
        ok: false,
        failure: failure(
          'input',
          'move-missing-source',
          `Cannot move missing workspace document ${JSON.stringify(fromPath)}. Request a full source resync.`,
          fromPath,
        ),
      };
    }
    if (engine.parsedDocument(toPath) !== undefined) {
      return {
        ok: false,
        failure: failure(
          'input',
          'move-target-exists',
          `Cannot move into existing workspace document ${JSON.stringify(toPath)}. Request a full source resync.`,
          toPath,
        ),
      };
    }
  }
  const byPath = <
    T extends { readonly path?: string; readonly fromPath?: string },
  >(
    left: T,
    right: T,
  ): number =>
    (left.path ?? left.fromPath ?? '').localeCompare(
      right.path ?? right.fromPath ?? '',
    );
  return {
    ok: true,
    changes: {
      upserts: upserts.sort(byPath),
      deletes: deletes.sort(byPath),
      moves: moves.sort(byPath),
    },
  };
}

function movedDocument(
  document: ParsedObsidianDocument,
  toPath: WorkspacePath,
): ParsedObsidianDocument {
  return {
    ...document,
    structure: { ...document.structure, path: toPath },
  };
}

export function applyObsidianWorkspaceChanges(
  engine: ObsidianWorkspaceEngine,
  changesValue: readonly WorkspaceSourceChange[],
): ApplyObsidianWorkspaceChangesResult {
  const validation = validateChanges(engine, changesValue);
  if (!validation.ok) return validation;
  const { deletes, moves, upserts } = validation.changes;
  const parsedUpserts = parseDocuments(upserts);
  if (!parsedUpserts.ok) return parsedUpserts;

  const staged = new Map(
    engine
      .parsedDocuments()
      .map((document) => [document.structure.path, document]),
  );
  for (const { path } of deletes) staged.delete(path);
  for (const { fromPath } of moves) staged.delete(fromPath);
  for (const { fromPath, toPath } of moves) {
    const source = engine.parsedDocument(fromPath);
    if (source === undefined) {
      throw new Error('Validated move source unexpectedly disappeared.');
    }
    staged.set(toPath, movedDocument(source, toPath));
  }
  for (const [path, parsed] of parsedUpserts.documents)
    staged.set(path, parsed);

  const built = resolveAndStabilize(
    engine.workspaceId,
    staged,
    engine.identityCatalog,
  );
  if (!built.ok) return built;
  let delta;
  try {
    delta = diffKnowledgeSnapshots(engine.snapshot, built.stable.snapshot);
  } catch (error: unknown) {
    return {
      ok: false,
      failure: failure(
        'delta',
        'snapshot-delta-failed',
        `Stable snapshot delta construction failed: ${unexpectedError(error)}`,
      ),
    };
  }
  const fromRevision = engine.revision;
  const toRevision = fromRevision + 1;
  const nextEngine = new EngineState({
    workspaceId: engine.workspaceId,
    revision: toRevision,
    documents: staged,
    stable: built.stable,
    resolutionDiagnostics: built.diagnostics,
  });
  const reparsedPaths = upserts.map(({ path }) => path);
  return {
    ok: true,
    engine: nextEngine,
    snapshot: nextEngine.snapshot,
    delta,
    identityCatalog: nextEngine.identityCatalog,
    resolutionDiagnostics: nextEngine.resolutionDiagnostics,
    identitySummary: built.stable.summary,
    identityDiagnostics: built.stable.diagnostics,
    stats: {
      reparsedPaths,
      reusedParsedDocumentCount:
        nextEngine.parsedDocumentCount - reparsedPaths.length,
      totalParsedDocumentCount: nextEngine.parsedDocumentCount,
    },
    fromRevision,
    toRevision,
  };
}
