import type {
  GitHistoryReviewSource,
  StartReviewInput,
} from '@icarus-graph-explorer/ai-review';
import type { WorkspaceIdentitySession } from '@icarus-graph-explorer/source-provider-tauri';

export const REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION = 1 as const;

export type ReviewSourceErrorCode =
  | 'unsupported-runtime'
  | 'permission-needed'
  | 'unauthorized'
  | 'git-unavailable'
  | 'not-a-repository'
  | 'no-commits'
  | 'insufficient-history'
  | 'root-range-unsupported'
  | 'missing-object'
  | 'invalid-selection'
  | 'unsupported-file'
  | 'unsupported-path-encoding'
  | 'invalid-utf8'
  | 'size-limit'
  | 'time-limit'
  | 'changed-preparation'
  | 'cancelled'
  | 'git-command-failed'
  | 'native-failure';

export interface ReviewSourceFailure {
  readonly code: ReviewSourceErrorCode;
  readonly message: string;
  readonly availableCount?: number;
}

export class ReviewSourceCaptureError extends Error {
  readonly code: ReviewSourceErrorCode;
  readonly availableCount?: number;

  constructor(failure: ReviewSourceFailure, options?: { cause?: unknown }) {
    super(failure.message, options);
    this.name = 'ReviewSourceCaptureError';
    this.code = failure.code;
    if (failure.availableCount !== undefined) {
      this.availableCount = failure.availableCount;
    }
  }
}

export interface ReviewSourceLimits {
  readonly maxCommits: number;
  readonly maxSelectedFiles: number;
  readonly maxInventoryFiles: number;
  readonly maxPageSize: number;
  readonly maxBlobBytes: number;
  readonly maxPatchBytes: number;
  readonly maxCaptureBytes: number;
  readonly commandTimeoutMs: number;
  readonly operationTimeoutMs: number;
}

export interface ReviewSourceSessionDescriptor {
  readonly schemaVersion: typeof REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly displayName: string;
  readonly worktreeLayout: 'main' | 'linked';
  /** Repository-relative logical prefix; never an absolute machine path. */
  readonly vaultPrefix: string;
  readonly limits: ReviewSourceLimits;
  readonly limitations: readonly string[];
}

export interface GitCommitDescriptor {
  readonly commitId: string;
  readonly parentIds: readonly string[];
  readonly firstParentId: string;
}

export type GitChangeStatus = 'added' | 'modified' | 'deleted' | 'type-changed';

export interface GitPathChange {
  readonly commitId: string;
  readonly parentCommitId: string;
  readonly status: GitChangeStatus;
  readonly oldPath?: string;
  readonly newPath?: string;
}

export type GitFileAvailability =
  | 'available'
  | 'deleted-at-head'
  | 'unsupported-symlink'
  | 'unsupported-submodule'
  | 'excluded';

export interface ReviewSourceFileDescriptor {
  readonly path: string;
  readonly role: 'changed' | 'context';
  readonly eligible: boolean;
  readonly availability: GitFileAvailability;
  readonly byteLength?: number;
  readonly exclusionReason?: string;
  readonly changes: readonly GitPathChange[];
}

export interface ReviewSourcePreparation {
  readonly schemaVersion: typeof REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly preparationId: string;
  readonly requestedCount: number;
  readonly historyPolicy: 'first-parent';
  readonly commitOrder: 'oldest-to-newest';
  readonly baseCommitId: string;
  readonly headCommitId: string;
  readonly commits: readonly GitCommitDescriptor[];
  readonly branchName?: string;
  readonly changedFiles: readonly ReviewSourceFileDescriptor[];
  readonly additionalEligibleFileCount: number;
  readonly excludedPathCount: number;
  readonly exclusionReasons: readonly string[];
  readonly workingTreeWarning?: string;
  readonly limitations: readonly string[];
}

export interface ReviewSourceFilePage {
  readonly schemaVersion: typeof REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly preparationId: string;
  readonly files: readonly ReviewSourceFileDescriptor[];
  readonly nextCursor?: string;
  readonly totalMatching: number;
}

export interface CapturedGitBlob {
  readonly commitId: string;
  readonly objectId: string;
  readonly byteLength: number;
  readonly content: string;
}

export interface CapturedGitFile {
  readonly path: string;
  readonly role: 'changed' | 'context';
  readonly availability: 'available' | 'deleted-at-head';
  readonly headBlob?: CapturedGitBlob;
  readonly changes: readonly GitPathChange[];
}

export interface CapturedGitPatch {
  readonly id: string;
  readonly path: string;
  readonly commitId: string;
  readonly parentCommitId: string;
  readonly status: GitChangeStatus;
  readonly byteLength: number;
  readonly content: string;
}

export interface NativeCaptureManifest {
  readonly schemaVersion: typeof REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION;
  readonly historyPolicy: 'first-parent';
  readonly commitOrder: 'oldest-to-newest';
  readonly baseCommitId: string;
  readonly headCommitId: string;
  readonly commits: readonly GitCommitDescriptor[];
  readonly files: ReadonlyArray<{
    readonly path: string;
    readonly role: 'changed' | 'context';
    readonly availability: 'available' | 'deleted-at-head';
    readonly headBlob?: Omit<CapturedGitBlob, 'content'>;
    readonly changes: readonly GitPathChange[];
  }>;
  readonly capturedByteCount: number;
  readonly limits: ReviewSourceLimits;
}

export interface NativeReviewSourceCapture {
  readonly schemaVersion: typeof REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly preparationId: string;
  readonly requestId: string;
  readonly workspaceId: string;
  readonly selectedPaths: readonly string[];
  readonly headAdvanced: boolean;
  readonly workingTreeWarning?: string;
  readonly completeness: 'complete';
  readonly missingMaterial: readonly string[];
  readonly omissions: readonly string[];
  readonly files: readonly CapturedGitFile[];
  readonly patches: readonly CapturedGitPatch[];
  readonly manifest: NativeCaptureManifest;
}

export interface ReviewSourceCapture {
  readonly native: NativeReviewSourceCapture;
  readonly source: GitHistoryReviewSource;
}

export interface ReviewSourceFileQuery {
  readonly query?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface CaptureOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (
    progress: 'starting' | 'capturing' | 'completed' | 'cancelled',
  ) => void;
}

export interface ReviewSourceSession {
  readonly descriptor: ReviewSourceSessionDescriptor;
  prepareLastCommits(commitCount: number): Promise<ReviewSourcePreparation>;
  listAdditionalFiles(
    preparationId: string,
    query?: ReviewSourceFileQuery,
  ): Promise<ReviewSourceFilePage>;
  capture(
    preparationId: string,
    selectedPaths: readonly string[],
    options?: CaptureOptions,
  ): Promise<ReviewSourceCapture>;
  dispose(): Promise<void>;
}

export interface ReviewSourceProvider {
  isSupported(): boolean;
  openAuthorizedSession(
    workspace: WorkspaceIdentitySession,
  ): Promise<ReviewSourceSession>;
}

export type CapturedReviewInput = Omit<
  StartReviewInput,
  'workspaceId' | 'source'
>;
