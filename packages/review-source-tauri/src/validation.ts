import {
  REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION,
  ReviewSourceCaptureError,
  type GitCommitDescriptor,
  type GitPathChange,
  type CapturedGitBlob,
  type CapturedGitFile,
  type CapturedGitPatch,
  type NativeCaptureManifest,
  type NativeReviewSourceCapture,
  type ReviewSourceFileDescriptor,
  type ReviewSourceFilePage,
  type ReviewSourcePreparation,
  type ReviewSourceSessionDescriptor,
} from './types';

function invalid(message: string): never {
  throw new ReviewSourceCaptureError({ code: 'native-failure', message });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function string(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    invalid(`Native ${label} is invalid.`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    invalid(`Native ${label} is invalid.`);
  }
  return value as number;
}

function relativePath(value: unknown, label: string): string {
  const path = string(value, label);
  if (
    path.startsWith('/') ||
    path.startsWith('\\') ||
    path.includes('\\') ||
    /^[A-Za-z]:/u.test(path) ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    invalid(`Native ${label} escaped the authorized vault.`);
  }
  return path;
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) invalid(`Native ${label} is invalid.`);
  return value.map((item, index) => string(item, `${label}[${index}]`));
}

function commit(value: unknown): GitCommitDescriptor {
  if (!record(value)) invalid('Native commit descriptor is invalid.');
  const parentIds = strings(value.parentIds, 'commit parent IDs');
  const firstParentId = string(value.firstParentId, 'first parent ID');
  if (parentIds[0] !== firstParentId) {
    invalid('Native first-parent identity does not match the parent list.');
  }
  return {
    commitId: string(value.commitId, 'commit ID'),
    parentIds,
    firstParentId,
  };
}

function change(value: unknown): GitPathChange {
  if (!record(value)) invalid('Native path change is invalid.');
  const status = value.status;
  if (
    status !== 'added' &&
    status !== 'modified' &&
    status !== 'deleted' &&
    status !== 'type-changed'
  ) {
    invalid('Native path change status is invalid.');
  }
  return {
    commitId: string(value.commitId, 'change commit ID'),
    parentCommitId: string(value.parentCommitId, 'change parent ID'),
    status,
    ...(value.oldPath === undefined
      ? {}
      : { oldPath: relativePath(value.oldPath, 'old path') }),
    ...(value.newPath === undefined
      ? {}
      : { newPath: relativePath(value.newPath, 'new path') }),
  };
}

function file(value: unknown): ReviewSourceFileDescriptor {
  if (!record(value)) invalid('Native file descriptor is invalid.');
  const role = value.role;
  if (role !== 'changed' && role !== 'context') {
    invalid('Native file role is invalid.');
  }
  const availability = value.availability;
  if (
    availability !== 'available' &&
    availability !== 'deleted-at-head' &&
    availability !== 'unsupported-symlink' &&
    availability !== 'unsupported-submodule' &&
    availability !== 'excluded'
  ) {
    invalid('Native file availability is invalid.');
  }
  if (typeof value.eligible !== 'boolean' || !Array.isArray(value.changes)) {
    invalid('Native file eligibility/change list is invalid.');
  }
  return {
    path: relativePath(value.path, 'file path'),
    role,
    eligible: value.eligible,
    availability,
    ...(value.byteLength === undefined
      ? {}
      : { byteLength: integer(value.byteLength, 'file byte length') }),
    ...(value.exclusionReason === undefined
      ? {}
      : { exclusionReason: string(value.exclusionReason, 'exclusion reason') }),
    changes: value.changes.map(change),
  };
}

function schema(value: Record<string, unknown>, label: string): void {
  if (value.schemaVersion !== REVIEW_SOURCE_CAPTURE_SCHEMA_VERSION) {
    invalid(`Native ${label} schema version is unsupported.`);
  }
}

function limits(value: unknown) {
  if (!record(value)) invalid('Native review-source limits are invalid.');
  return {
    maxCommits: integer(value.maxCommits, 'max commits', 1),
    maxSelectedFiles: integer(value.maxSelectedFiles, 'max selected files', 1),
    maxInventoryFiles: integer(
      value.maxInventoryFiles,
      'max inventory files',
      1,
    ),
    maxPageSize: integer(value.maxPageSize, 'max page size', 1),
    maxBlobBytes: integer(value.maxBlobBytes, 'max blob bytes', 1),
    maxPatchBytes: integer(value.maxPatchBytes, 'max patch bytes', 1),
    maxCaptureBytes: integer(value.maxCaptureBytes, 'max capture bytes', 1),
    commandTimeoutMs: integer(value.commandTimeoutMs, 'command timeout', 1),
    operationTimeoutMs: integer(
      value.operationTimeoutMs,
      'operation timeout',
      1,
    ),
  };
}

export function validateSessionDescriptor(
  value: unknown,
): ReviewSourceSessionDescriptor {
  if (
    !record(value) ||
    !record(value.limits) ||
    !Array.isArray(value.limitations)
  ) {
    invalid('Native source-session descriptor is invalid.');
  }
  schema(value, 'session');
  if (value.worktreeLayout !== 'main' && value.worktreeLayout !== 'linked') {
    invalid('Native worktree layout is invalid.');
  }
  return {
    schemaVersion: 1,
    sessionId: string(value.sessionId, 'session ID'),
    workspaceId: string(value.workspaceId, 'workspace ID'),
    displayName: string(value.displayName, 'display name'),
    worktreeLayout: value.worktreeLayout,
    vaultPrefix: string(value.vaultPrefix, 'vault prefix', true),
    limits: limits(value.limits),
    limitations: value.limitations.map((item) =>
      string(item, 'session limitation'),
    ),
  };
}

export function validatePreparation(value: unknown): ReviewSourcePreparation {
  if (
    !record(value) ||
    !Array.isArray(value.commits) ||
    !Array.isArray(value.changedFiles) ||
    !Array.isArray(value.exclusionReasons) ||
    !Array.isArray(value.limitations)
  ) {
    invalid('Native history preparation is invalid.');
  }
  schema(value, 'preparation');
  if (
    value.historyPolicy !== 'first-parent' ||
    value.commitOrder !== 'oldest-to-newest'
  ) {
    invalid('Native history policy/order is invalid.');
  }
  const commits = value.commits.map(commit);
  const requestedCount = integer(value.requestedCount, 'requested count', 1);
  if (commits.length !== requestedCount) {
    invalid('Native history count does not match its commit list.');
  }
  return {
    schemaVersion: 1,
    sessionId: string(value.sessionId, 'session ID'),
    preparationId: string(value.preparationId, 'preparation ID'),
    requestedCount,
    historyPolicy: 'first-parent',
    commitOrder: 'oldest-to-newest',
    baseCommitId: string(value.baseCommitId, 'base commit ID'),
    headCommitId: string(value.headCommitId, 'head commit ID'),
    commits,
    ...(value.branchName === undefined
      ? {}
      : { branchName: string(value.branchName, 'branch name') }),
    changedFiles: value.changedFiles.map(file),
    additionalEligibleFileCount: integer(
      value.additionalEligibleFileCount,
      'additional eligible count',
    ),
    excludedPathCount: integer(value.excludedPathCount, 'excluded path count'),
    exclusionReasons: value.exclusionReasons.map((item) =>
      string(item, 'exclusion reason'),
    ),
    ...(value.workingTreeWarning === undefined
      ? {}
      : {
          workingTreeWarning: string(
            value.workingTreeWarning,
            'working-tree warning',
          ),
        }),
    limitations: value.limitations.map((item) =>
      string(item, 'preparation limitation'),
    ),
  };
}

export function validateFilePage(value: unknown): ReviewSourceFilePage {
  if (!record(value) || !Array.isArray(value.files)) {
    invalid('Native file page is invalid.');
  }
  schema(value, 'file page');
  return {
    schemaVersion: 1,
    sessionId: string(value.sessionId, 'session ID'),
    preparationId: string(value.preparationId, 'preparation ID'),
    files: value.files.map(file),
    ...(value.nextCursor === undefined
      ? {}
      : { nextCursor: string(value.nextCursor, 'next cursor') }),
    totalMatching: integer(value.totalMatching, 'total matching files'),
  };
}

export function validateCapture(value: unknown): NativeReviewSourceCapture {
  if (
    !record(value) ||
    !Array.isArray(value.selectedPaths) ||
    !Array.isArray(value.missingMaterial) ||
    !Array.isArray(value.omissions) ||
    !Array.isArray(value.files) ||
    !Array.isArray(value.patches) ||
    !record(value.manifest)
  ) {
    invalid('Native capture is invalid.');
  }
  schema(value, 'capture');
  schema(value.manifest, 'capture manifest');
  if (
    value.completeness !== 'complete' ||
    typeof value.headAdvanced !== 'boolean'
  ) {
    invalid('Native capture completeness/freshness is invalid.');
  }
  const capturedBlob = (candidate: unknown): CapturedGitBlob => {
    if (!record(candidate)) invalid('Native captured blob is invalid.');
    return {
      commitId: string(candidate.commitId, 'blob commit ID'),
      objectId: string(candidate.objectId, 'blob object ID'),
      byteLength: integer(candidate.byteLength, 'blob byte length'),
      content: string(candidate.content, 'blob content', true),
    };
  };
  const capturedFile = (candidate: unknown): CapturedGitFile => {
    if (!record(candidate) || !Array.isArray(candidate.changes)) {
      invalid('Native captured file is invalid.');
    }
    if (candidate.role !== 'changed' && candidate.role !== 'context') {
      invalid('Native captured file role is invalid.');
    }
    if (
      candidate.availability !== 'available' &&
      candidate.availability !== 'deleted-at-head'
    ) {
      invalid('Native captured file availability is invalid.');
    }
    return {
      path: relativePath(candidate.path, 'captured file path'),
      role: candidate.role,
      availability: candidate.availability,
      ...(candidate.headBlob === undefined
        ? {}
        : { headBlob: capturedBlob(candidate.headBlob) }),
      changes: candidate.changes.map(change),
    };
  };
  const patch = (candidate: unknown): CapturedGitPatch => {
    if (!record(candidate)) invalid('Native captured patch is invalid.');
    const status = candidate.status;
    if (
      status !== 'added' &&
      status !== 'modified' &&
      status !== 'deleted' &&
      status !== 'type-changed'
    ) {
      invalid('Native captured patch status is invalid.');
    }
    return {
      id: string(candidate.id, 'patch ID'),
      path: relativePath(candidate.path, 'patch path'),
      commitId: string(candidate.commitId, 'patch commit ID'),
      parentCommitId: string(candidate.parentCommitId, 'patch parent ID'),
      status,
      byteLength: integer(candidate.byteLength, 'patch byte length'),
      content: string(candidate.content, 'patch content'),
    };
  };
  const nativeManifest = value.manifest;
  if (
    nativeManifest.historyPolicy !== 'first-parent' ||
    nativeManifest.commitOrder !== 'oldest-to-newest' ||
    !Array.isArray(nativeManifest.commits) ||
    !Array.isArray(nativeManifest.files)
  ) {
    invalid('Native capture manifest policy/collections are invalid.');
  }
  const manifestFiles: NativeCaptureManifest['files'] =
    nativeManifest.files.map(
      (candidate): NativeCaptureManifest['files'][number] => {
        if (!record(candidate) || !Array.isArray(candidate.changes)) {
          invalid('Native manifest file is invalid.');
        }
        const role = candidate.role;
        if (role !== 'changed' && role !== 'context') {
          invalid('Native manifest file role is invalid.');
        }
        const availability = candidate.availability;
        if (
          availability !== 'available' &&
          availability !== 'deleted-at-head'
        ) {
          invalid('Native manifest file availability is invalid.');
        }
        let headBlob: Omit<CapturedGitBlob, 'content'> | undefined;
        if (candidate.headBlob !== undefined) {
          if (!record(candidate.headBlob)) {
            invalid('Native manifest blob is invalid.');
          }
          headBlob = {
            commitId: string(
              candidate.headBlob.commitId,
              'manifest blob commit ID',
            ),
            objectId: string(
              candidate.headBlob.objectId,
              'manifest blob object ID',
            ),
            byteLength: integer(
              candidate.headBlob.byteLength,
              'manifest blob byte length',
            ),
          };
        }
        return {
          path: relativePath(candidate.path, 'manifest file path'),
          role,
          availability,
          ...(headBlob === undefined ? {} : { headBlob }),
          changes: candidate.changes.map(change),
        };
      },
    );
  return {
    schemaVersion: 1,
    sessionId: string(value.sessionId, 'session ID'),
    preparationId: string(value.preparationId, 'preparation ID'),
    requestId: string(value.requestId, 'request ID'),
    workspaceId: string(value.workspaceId, 'workspace ID'),
    selectedPaths: value.selectedPaths.map((path, index) =>
      relativePath(path, `selected path ${index}`),
    ),
    headAdvanced: value.headAdvanced,
    ...(value.workingTreeWarning === undefined
      ? {}
      : {
          workingTreeWarning: string(
            value.workingTreeWarning,
            'working-tree warning',
          ),
        }),
    completeness: 'complete',
    missingMaterial: strings(value.missingMaterial, 'missing material'),
    omissions: strings(value.omissions, 'omissions'),
    files: value.files.map(capturedFile),
    patches: value.patches.map(patch),
    manifest: {
      schemaVersion: 1,
      historyPolicy: 'first-parent',
      commitOrder: 'oldest-to-newest',
      baseCommitId: string(nativeManifest.baseCommitId, 'base commit ID'),
      headCommitId: string(nativeManifest.headCommitId, 'head commit ID'),
      commits: nativeManifest.commits.map(commit),
      files: manifestFiles,
      capturedByteCount: integer(
        nativeManifest.capturedByteCount,
        'captured byte count',
      ),
      limits: limits(nativeManifest.limits),
    },
  };
}
