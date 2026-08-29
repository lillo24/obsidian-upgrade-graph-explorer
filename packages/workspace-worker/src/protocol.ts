import type { WorkspaceId, WorkspacePath } from '@icarus-graph-explorer/core';
import type { ObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import type {
  StableIdentityCatalog,
  StableIdentityReconciliationSummary,
} from '@icarus-graph-explorer/stable-identity';
import type {
  WorkspaceEngineFailureStage,
  WorkspaceSourceChange,
  WorkspaceSourceDocument,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

export const WORKSPACE_WORKER_PROTOCOL_VERSION = 1 as const;

export type WorkspaceWorkerRequestId = string;
export type WorkspaceWorkerCandidateId = string;

interface RequestEnvelope {
  readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
  readonly requestId: WorkspaceWorkerRequestId;
}

export interface PrepareInitializeInput {
  readonly workspaceId: WorkspaceId;
  readonly documents: readonly WorkspaceSourceDocument[];
  readonly identityCatalog: StableIdentityCatalog;
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface PrepareChangesInput {
  readonly expectedRevision: number;
  readonly changes: readonly WorkspaceSourceChange[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface PrepareResyncInput {
  readonly documents: readonly WorkspaceSourceDocument[];
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export interface BuildCommittedReportInput {
  readonly nonMarkdownPaths: readonly WorkspacePath[];
}

export type WorkspaceWorkerRequest =
  | (RequestEnvelope & {
      readonly kind: 'prepare-initialize';
      readonly input: PrepareInitializeInput;
    })
  | (RequestEnvelope & {
      readonly kind: 'prepare-changes';
      readonly input: PrepareChangesInput;
    })
  | (RequestEnvelope & {
      readonly kind: 'prepare-resync';
      readonly input: PrepareResyncInput;
    })
  | (RequestEnvelope & {
      readonly kind: 'build-committed-report';
      readonly input: BuildCommittedReportInput;
    })
  | (RequestEnvelope & {
      readonly kind: 'commit-candidate' | 'discard-candidate';
      readonly candidateId: WorkspaceWorkerCandidateId;
    });

export type WorkspaceWorkerRequestPayload<Request = WorkspaceWorkerRequest> =
  Request extends WorkspaceWorkerRequest
    ? Omit<Request, 'protocolVersion' | 'requestId'>
    : never;

export interface WorkspaceWorkerTimings {
  readonly workspaceUpdateMs: number;
  readonly diagnosticConstructionMs: number;
  readonly workerComputeMs: number;
  /** Added by the main-thread client; absent in the worker's raw response. */
  readonly workerRoundTripMs?: number;
  /** Maximum event-loop scheduling gap observed while awaiting the worker. */
  readonly mainThreadHighGapMs?: number;
}

export interface WorkspaceWorkerParseStats {
  readonly reparsedDocumentCount: number;
  readonly reusedParsedDocumentCount: number;
  readonly totalParsedDocumentCount: number;
}

export interface PreparedWorkspaceResult {
  readonly candidateId: WorkspaceWorkerCandidateId;
  readonly workspaceId: WorkspaceId;
  readonly fromRevision: number | null;
  readonly toRevision: number;
  readonly report: ObsidianDiagnosticReport;
  readonly nextIdentityCatalog: StableIdentityCatalog;
  readonly identitySummary: StableIdentityReconciliationSummary;
  readonly parseStats: WorkspaceWorkerParseStats;
  readonly timings: WorkspaceWorkerTimings;
}

interface ResponseEnvelope {
  readonly protocolVersion: typeof WORKSPACE_WORKER_PROTOCOL_VERSION;
  readonly requestId: WorkspaceWorkerRequestId;
}

export type WorkspaceWorkerFailureCategory =
  | 'protocol'
  | 'workspace'
  | 'diagnostics'
  | 'transport'
  | 'terminated'
  | 'internal';

export type WorkspaceWorkerResponse =
  | (ResponseEnvelope & {
      readonly kind: 'prepared';
      readonly prepared: PreparedWorkspaceResult;
    })
  | (ResponseEnvelope & {
      readonly kind: 'committed-report';
      readonly revision: number;
      readonly report: ObsidianDiagnosticReport;
      readonly timings: WorkspaceWorkerTimings;
    })
  | (ResponseEnvelope & {
      readonly kind: 'candidate-committed' | 'candidate-discarded';
      readonly candidateId: WorkspaceWorkerCandidateId;
      readonly revision: number | null;
    })
  | (ResponseEnvelope & {
      readonly kind: 'failure';
      readonly category: WorkspaceWorkerFailureCategory;
      readonly code: string;
      readonly message: string;
      readonly stage?: WorkspaceEngineFailureStage;
    });

export class WorkspaceProcessorError extends Error {
  readonly category: WorkspaceWorkerFailureCategory;
  readonly code: string;
  readonly stage?: WorkspaceEngineFailureStage;

  constructor(
    failure: Extract<WorkspaceWorkerResponse, { readonly kind: 'failure' }>,
  ) {
    super(failure.message);
    this.name = 'WorkspaceProcessorError';
    this.category = failure.category;
    this.code = failure.code;
    if (failure.stage !== undefined) this.stage = failure.stage;
  }
}

export interface DesktopWorkspaceProcessor {
  prepareInitialize(
    input: PrepareInitializeInput,
  ): Promise<PreparedWorkspaceResult>;
  prepareChanges(input: PrepareChangesInput): Promise<PreparedWorkspaceResult>;
  prepareResync(input: PrepareResyncInput): Promise<PreparedWorkspaceResult>;
  buildCommittedReport(input: BuildCommittedReportInput): Promise<{
    readonly revision: number;
    readonly report: ObsidianDiagnosticReport;
    readonly timings: WorkspaceWorkerTimings;
  }>;
  commitCandidate(candidateId: WorkspaceWorkerCandidateId): Promise<number>;
  discardCandidate(
    candidateId: WorkspaceWorkerCandidateId,
  ): Promise<number | null>;
  terminate(): void;
}

export type DesktopWorkspaceProcessorFactory = () => DesktopWorkspaceProcessor;
