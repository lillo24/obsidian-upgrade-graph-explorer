import {
  prepareReviewInput,
  utf8Bytes,
  type GitCaptureManifest,
  type GitHistoryReviewSource,
  type ReviewMaterial,
} from '@icarus-graph-explorer/ai-review';

import {
  ReviewSourceCaptureError,
  type CapturedReviewInput,
  type NativeReviewSourceCapture,
} from './types';

function invalid(message: string): never {
  throw new ReviewSourceCaptureError({ code: 'native-failure', message });
}

/** Maps exact native evidence without inventing source text for deleted paths. */
export function mapCaptureToReviewSource(
  capture: NativeReviewSourceCapture,
): GitHistoryReviewSource {
  const commits = capture.manifest.commits;
  const commitIds = commits.map(({ commitId }) => commitId);
  if (
    capture.manifest.baseCommitId.trim() === '' ||
    capture.manifest.headCommitId.trim() === '' ||
    commits.length < 1 ||
    commits.length > 10 ||
    commits.at(-1)?.commitId !== capture.manifest.headCommitId
  ) {
    invalid('Native capture range is inconsistent.');
  }
  const selectedPaths = [...capture.selectedPaths];
  if (
    selectedPaths.length === 0 ||
    new Set(selectedPaths).size !== selectedPaths.length ||
    capture.files.length !== selectedPaths.length ||
    new Set(capture.files.map((file) => file.path)).size !==
      capture.files.length ||
    capture.files.some((file) => !selectedPaths.includes(file.path))
  ) {
    invalid('Native capture selected-path scope is inconsistent.');
  }
  const expectedPatches = capture.files.flatMap((file) =>
    file.changes.map((change) => ({ file, change })),
  );
  const patchKey = (
    path: string,
    commitId: string,
    parentCommitId: string,
    status: string,
  ) => `${path}\0${commitId}\0${parentCommitId}\0${status}`;
  const expectedPatchKeys = expectedPatches.map(({ file, change }) =>
    patchKey(file.path, change.commitId, change.parentCommitId, change.status),
  );
  const actualPatchKeys = capture.patches.map((patch) =>
    patchKey(patch.path, patch.commitId, patch.parentCommitId, patch.status),
  );
  if (
    capture.patches.length !== expectedPatches.length ||
    new Set(expectedPatchKeys).size !== expectedPatchKeys.length ||
    new Set(actualPatchKeys).size !== actualPatchKeys.length ||
    new Set(capture.patches.map((patch) => patch.id)).size !==
      capture.patches.length ||
    capture.files.some(
      (file) =>
        (file.availability === 'available') !== (file.headBlob !== undefined) ||
        (file.role === 'context' && file.changes.length !== 0) ||
        (file.role === 'changed' && file.changes.length === 0),
    ) ||
    actualPatchKeys.some((key) => !expectedPatchKeys.includes(key))
  ) {
    invalid('Native capture patches do not match the selected file changes.');
  }
  const materials: ReviewMaterial[] = capture.files.flatMap((file) => {
    if (
      file.headBlob !== undefined &&
      utf8Bytes(file.headBlob.content) !== file.headBlob.byteLength
    ) {
      invalid(`Native blob byte count for ${file.path} is inconsistent.`);
    }
    const source =
      file.headBlob === undefined
        ? []
        : [
            {
              id: `source:${file.path}`,
              relativePath: file.path,
              kind: 'source' as const,
              content: file.headBlob.content,
              provenance: {
                kind: 'git' as const,
                commitId: file.headBlob.commitId,
                baseCommitId: capture.manifest.baseCommitId,
                headCommitId: capture.manifest.headCommitId,
              },
            },
          ];
    return source;
  });
  const commitOrder = new Map(
    commitIds.map((commitId, index) => [commitId, index] as const),
  );
  const patches = [...capture.patches].sort(
    (left, right) =>
      (commitOrder.get(left.commitId) ?? Number.MAX_SAFE_INTEGER) -
        (commitOrder.get(right.commitId) ?? Number.MAX_SAFE_INTEGER) ||
      left.path.localeCompare(right.path, 'en-US'),
  );
  for (const patch of patches) {
    const commit = commits.find(({ commitId }) => commitId === patch.commitId);
    if (
      patch.content.trim() === '' ||
      utf8Bytes(patch.content) !== patch.byteLength ||
      !selectedPaths.includes(patch.path) ||
      commit?.firstParentId !== patch.parentCommitId
    ) {
      invalid('Native patch provenance is inconsistent with the pinned range.');
    }
    materials.push({
      id: patch.id,
      relativePath: patch.path,
      kind: 'diff',
      content: patch.content,
      provenance: {
        kind: 'git',
        commitId: patch.commitId,
        baseCommitId: capture.manifest.baseCommitId,
        headCommitId: capture.manifest.headCommitId,
      },
    });
  }
  for (const path of selectedPaths) {
    if (!materials.some((material) => material.relativePath === path)) {
      invalid(`Native capture path ${path} has no retained blob or patch.`);
    }
  }
  if (
    materials.reduce(
      (total, material) => total + utf8Bytes(material.content),
      0,
    ) !== capture.manifest.capturedByteCount
  ) {
    invalid('Native capture total byte count is inconsistent.');
  }
  if (
    capture.manifest.files.length !== capture.files.length ||
    capture.manifest.files.some((manifestFile) => {
      const capturedFile = capture.files.find(
        (file) => file.path === manifestFile.path,
      );
      return (
        capturedFile === undefined ||
        capturedFile.role !== manifestFile.role ||
        capturedFile.availability !== manifestFile.availability ||
        capturedFile.headBlob?.commitId !== manifestFile.headBlob?.commitId ||
        capturedFile.headBlob?.objectId !== manifestFile.headBlob?.objectId ||
        capturedFile.headBlob?.byteLength !==
          manifestFile.headBlob?.byteLength ||
        JSON.stringify(capturedFile.changes) !==
          JSON.stringify(manifestFile.changes)
      );
    })
  ) {
    invalid('Native capture manifest file metadata is inconsistent.');
  }
  const manifest: GitCaptureManifest = {
    schemaVersion: 1,
    preparationId: capture.preparationId,
    historyPolicy: 'first-parent',
    commitOrder: 'oldest-to-newest',
    headAdvanced: capture.headAdvanced,
    ...(capture.workingTreeWarning === undefined
      ? {}
      : { workingTreeWarning: capture.workingTreeWarning }),
    baseCommitId: capture.manifest.baseCommitId,
    headCommitId: capture.manifest.headCommitId,
    commits: commits.map((commit) => ({
      commitId: commit.commitId,
      parentIds: [...commit.parentIds],
      firstParentId: commit.firstParentId,
    })),
    files: capture.manifest.files.map((file) => ({
      relativePath: file.path,
      role: file.role,
      availability: file.availability,
      ...(file.headBlob === undefined
        ? {}
        : {
            headBlob: {
              commitId: file.headBlob.commitId,
              objectId: file.headBlob.objectId,
              byteLength: file.headBlob.byteLength,
            },
          }),
      changes: file.changes.map((change) => ({ ...change })),
    })),
    capturedByteCount: capture.manifest.capturedByteCount,
    limits: {
      maxBlobBytes: capture.manifest.limits.maxBlobBytes,
      maxPatchBytes: capture.manifest.limits.maxPatchBytes,
      maxCaptureBytes: capture.manifest.limits.maxCaptureBytes,
    },
  };
  return {
    mode: 'captured-git-history',
    selectedPaths,
    materials,
    completeness: 'complete',
    missingMaterial: [...capture.missingMaterial],
    omissions: [...capture.omissions],
    baseCommitId: capture.manifest.baseCommitId,
    headCommitId: capture.manifest.headCommitId,
    commitIds,
    commitCount: commits.length,
    captureManifest: manifest,
  };
}

export function prepareCapturedReviewInput(
  capture: NativeReviewSourceCapture,
  input: CapturedReviewInput,
): ReturnType<typeof prepareReviewInput> {
  return prepareReviewInput({
    ...input,
    workspaceId: capture.workspaceId,
    source: mapCaptureToReviewSource(capture),
  });
}
