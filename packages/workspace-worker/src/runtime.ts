import { buildObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
  type ObsidianWorkspaceEngine,
  type WorkspaceEngineParseStats,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  type PreparedWorkspaceResult,
  type WorkspaceWorkerCandidateId,
  type WorkspaceWorkerParseStats,
  type WorkspaceWorkerRequest,
  type WorkspaceWorkerResponse,
  type WorkspaceWorkerTimings,
} from './protocol';
import { isWorkspaceWorkerRequest } from './validation';

interface CommittedState {
  readonly engine: ObsidianWorkspaceEngine;
  readonly revision: number;
  readonly nonMarkdownPaths: readonly string[];
}

interface PendingState {
  readonly candidateId: WorkspaceWorkerCandidateId;
  readonly engine: ObsidianWorkspaceEngine;
  readonly revision: number;
  readonly nonMarkdownPaths: readonly string[];
}

export interface WorkspaceWorkerRuntimeDependencies {
  readonly now: () => number;
  readonly nextCandidateId: () => string;
  readonly initializeEngine: typeof initializeObsidianWorkspaceEngine;
  readonly applyChanges: typeof applyObsidianWorkspaceChanges;
  readonly buildReport: typeof buildObsidianDiagnosticReport;
}

const DEFAULT_DEPENDENCIES: WorkspaceWorkerRuntimeDependencies = {
  now: () => performance.now(),
  nextCandidateId: (() => {
    let sequence = 0;
    return () => `candidate-${++sequence}`;
  })(),
  initializeEngine: initializeObsidianWorkspaceEngine,
  applyChanges: applyObsidianWorkspaceChanges,
  buildReport: buildObsidianDiagnosticReport,
};

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function parseStats(
  stats: WorkspaceEngineParseStats,
): WorkspaceWorkerParseStats {
  return {
    reparsedDocumentCount: stats.reparsedPaths.length,
    reusedParsedDocumentCount: stats.reusedParsedDocumentCount,
    totalParsedDocumentCount: stats.totalParsedDocumentCount,
  };
}

export interface WorkspaceWorkerRuntime {
  handle(value: unknown): WorkspaceWorkerResponse;
}

export function createWorkspaceWorkerRuntime(
  dependencies: WorkspaceWorkerRuntimeDependencies = DEFAULT_DEPENDENCIES,
): WorkspaceWorkerRuntime {
  let committed: CommittedState | undefined;
  let pending: PendingState | undefined;

  function failure(
    requestId: string,
    category: Extract<WorkspaceWorkerResponse, { kind: 'failure' }>['category'],
    code: string,
    message: string,
    stage?: Extract<WorkspaceWorkerResponse, { kind: 'failure' }>['stage'],
  ): WorkspaceWorkerResponse {
    return {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId,
      kind: 'failure',
      category,
      code,
      message,
      ...(stage === undefined ? {} : { stage }),
    };
  }

  function stateFailure(requestId: string, code: string, message: string) {
    return failure(requestId, 'protocol', code, message);
  }

  function preparedResponse(input: {
    readonly request: WorkspaceWorkerRequest;
    readonly engine: ObsidianWorkspaceEngine;
    readonly fromRevision: number | null;
    readonly toRevision: number;
    readonly nonMarkdownPaths: readonly string[];
    readonly identitySummary: PreparedWorkspaceResult['identitySummary'];
    readonly stats: WorkspaceEngineParseStats;
    readonly workspaceUpdateMs: number;
    readonly computeStart: number;
  }): WorkspaceWorkerResponse {
    const diagnosticStart = dependencies.now();
    let report: PreparedWorkspaceResult['report'];
    try {
      report = dependencies.buildReport({
        snapshot: input.engine.snapshot,
        diagnostics: input.engine.resolutionDiagnostics,
        documents: input.engine.parsedDocuments(),
        nonMarkdownPaths: input.nonMarkdownPaths,
        identity: { stability: 'stable' },
      });
    } catch (error: unknown) {
      return failure(
        input.request.requestId,
        'diagnostics',
        'diagnostic-construction-failed',
        `Diagnostic report construction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const diagnosticConstructionMs = rounded(
      dependencies.now() - diagnosticStart,
    );
    const candidateId = dependencies.nextCandidateId();
    const timings: WorkspaceWorkerTimings = {
      workspaceUpdateMs: input.workspaceUpdateMs,
      diagnosticConstructionMs,
      workerComputeMs: rounded(dependencies.now() - input.computeStart),
    };
    pending = {
      candidateId,
      engine: input.engine,
      revision: input.toRevision,
      nonMarkdownPaths: input.nonMarkdownPaths,
    };
    return {
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: input.request.requestId,
      kind: 'prepared',
      prepared: {
        candidateId,
        workspaceId: input.engine.workspaceId,
        fromRevision: input.fromRevision,
        toRevision: input.toRevision,
        report,
        nextIdentityCatalog: input.engine.identityCatalog,
        identitySummary: input.identitySummary,
        parseStats: parseStats(input.stats),
        timings,
      },
    };
  }

  function handleValid(
    request: WorkspaceWorkerRequest,
  ): WorkspaceWorkerResponse {
    if (request.kind.startsWith('prepare-') && pending !== undefined) {
      return stateFailure(
        request.requestId,
        'candidate-pending',
        `Candidate ${pending.candidateId} must be committed or discarded before another prepare.`,
      );
    }
    switch (request.kind) {
      case 'prepare-initialize': {
        if (committed !== undefined) {
          return stateFailure(
            request.requestId,
            'already-initialized',
            'prepare-initialize requires an empty worker.',
          );
        }
        const computeStart = dependencies.now();
        const workspaceStart = dependencies.now();
        const initialized = dependencies.initializeEngine({
          workspaceId: request.input.workspaceId,
          documents: request.input.documents,
          identityCatalog: request.input.identityCatalog,
        });
        const workspaceUpdateMs = rounded(dependencies.now() - workspaceStart);
        if (!initialized.ok) {
          return failure(
            request.requestId,
            'workspace',
            initialized.failure.code,
            initialized.failure.message,
            initialized.failure.stage,
          );
        }
        return preparedResponse({
          request,
          engine: initialized.engine,
          fromRevision: null,
          toRevision: 0,
          nonMarkdownPaths: request.input.nonMarkdownPaths,
          identitySummary: initialized.identitySummary,
          stats: initialized.stats,
          workspaceUpdateMs,
          computeStart,
        });
      }
      case 'prepare-changes': {
        if (committed === undefined) {
          return stateFailure(
            request.requestId,
            'not-initialized',
            'prepare-changes requires a committed workspace.',
          );
        }
        if (request.input.expectedRevision !== committed.revision) {
          return stateFailure(
            request.requestId,
            'stale-revision',
            `Expected committed revision ${committed.revision}, received ${request.input.expectedRevision}.`,
          );
        }
        const computeStart = dependencies.now();
        const workspaceStart = dependencies.now();
        const applied = dependencies.applyChanges(
          committed.engine,
          request.input.changes,
        );
        const workspaceUpdateMs = rounded(dependencies.now() - workspaceStart);
        if (!applied.ok) {
          return failure(
            request.requestId,
            'workspace',
            applied.failure.code,
            applied.failure.message,
            applied.failure.stage,
          );
        }
        return preparedResponse({
          request,
          engine: applied.engine,
          fromRevision: committed.revision,
          toRevision: committed.revision + 1,
          nonMarkdownPaths: request.input.nonMarkdownPaths,
          identitySummary: applied.identitySummary,
          stats: applied.stats,
          workspaceUpdateMs,
          computeStart,
        });
      }
      case 'prepare-resync': {
        if (committed === undefined) {
          return stateFailure(
            request.requestId,
            'not-initialized',
            'prepare-resync requires a committed workspace.',
          );
        }
        const computeStart = dependencies.now();
        const workspaceStart = dependencies.now();
        const initialized = dependencies.initializeEngine({
          workspaceId: committed.engine.workspaceId,
          documents: request.input.documents,
          identityCatalog: committed.engine.identityCatalog,
        });
        const workspaceUpdateMs = rounded(dependencies.now() - workspaceStart);
        if (!initialized.ok) {
          return failure(
            request.requestId,
            'workspace',
            initialized.failure.code,
            initialized.failure.message,
            initialized.failure.stage,
          );
        }
        return preparedResponse({
          request,
          engine: initialized.engine,
          fromRevision: committed.revision,
          toRevision: committed.revision + 1,
          nonMarkdownPaths: request.input.nonMarkdownPaths,
          identitySummary: initialized.identitySummary,
          stats: initialized.stats,
          workspaceUpdateMs,
          computeStart,
        });
      }
      case 'build-committed-report': {
        if (committed === undefined) {
          return stateFailure(
            request.requestId,
            'not-initialized',
            'build-committed-report requires a committed workspace.',
          );
        }
        const computeStart = dependencies.now();
        const diagnosticStart = dependencies.now();
        try {
          const report = dependencies.buildReport({
            snapshot: committed.engine.snapshot,
            diagnostics: committed.engine.resolutionDiagnostics,
            documents: committed.engine.parsedDocuments(),
            nonMarkdownPaths: request.input.nonMarkdownPaths,
            identity: { stability: 'stable' },
          });
          const diagnosticConstructionMs = rounded(
            dependencies.now() - diagnosticStart,
          );
          return {
            protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
            requestId: request.requestId,
            kind: 'committed-report',
            revision: committed.revision,
            report,
            timings: {
              workspaceUpdateMs: 0,
              diagnosticConstructionMs,
              workerComputeMs: rounded(dependencies.now() - computeStart),
            },
          };
        } catch (error: unknown) {
          return failure(
            request.requestId,
            'diagnostics',
            'diagnostic-construction-failed',
            `Diagnostic report construction failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      case 'commit-candidate':
      case 'discard-candidate': {
        if (
          pending === undefined ||
          pending.candidateId !== request.candidateId
        ) {
          return stateFailure(
            request.requestId,
            'candidate-mismatch',
            `Candidate ${request.candidateId} is not the pending candidate.`,
          );
        }
        const candidate = pending;
        pending = undefined;
        if (request.kind === 'commit-candidate') {
          committed = {
            engine: candidate.engine,
            revision: candidate.revision,
            nonMarkdownPaths: candidate.nonMarkdownPaths,
          };
        }
        return {
          protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
          requestId: request.requestId,
          kind:
            request.kind === 'commit-candidate'
              ? 'candidate-committed'
              : 'candidate-discarded',
          candidateId: candidate.candidateId,
          revision: committed?.revision ?? null,
        };
      }
    }
  }

  return {
    handle(value) {
      if (!isWorkspaceWorkerRequest(value)) {
        const requestId =
          typeof value === 'object' &&
          value !== null &&
          'requestId' in value &&
          typeof value.requestId === 'string'
            ? value.requestId
            : 'invalid-request';
        return failure(
          requestId,
          'protocol',
          'invalid-request',
          'Workspace worker request is malformed or uses an unsupported protocol version.',
        );
      }
      try {
        return handleValid(value);
      } catch (error: unknown) {
        return failure(
          value.requestId,
          'internal',
          'unexpected-runtime-failure',
          `Workspace worker runtime failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };
}
