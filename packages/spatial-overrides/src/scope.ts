import { isNormalizedWorkspaceFolderKey } from './folder-key';
import type { FolderSpatialScope, WorkspaceFolderKey } from './types';

function assertFolderKey(folderKey: string, label: string): void {
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error(`${label} must be a normalized workspace folder key.`);
  }
}

export function folderDepth(folderKey: WorkspaceFolderKey): number {
  assertFolderKey(folderKey, 'Folder');
  return folderKey === '.' ? 0 : folderKey.split('/').length;
}

export function isFolderDescendantOf(
  candidate: WorkspaceFolderKey,
  root: WorkspaceFolderKey,
): boolean {
  assertFolderKey(candidate, 'Candidate folder');
  assertFolderKey(root, 'Root folder');
  return root === '.' ? candidate !== '.' : candidate.startsWith(`${root}/`);
}

export function normalizeExcludedSubtrees(
  root: WorkspaceFolderKey,
  excluded: readonly WorkspaceFolderKey[],
): readonly WorkspaceFolderKey[] {
  assertFolderKey(root, 'Scope root');
  const normalized = [...excluded].sort((left, right) =>
    left.localeCompare(right),
  );
  const seen = new Set<string>();
  for (const folderKey of normalized) {
    assertFolderKey(folderKey, 'Excluded subtree');
    if (!isFolderDescendantOf(folderKey, root)) {
      throw new Error(
        `Excluded subtree ${JSON.stringify(folderKey)} must be a strict descendant of ${JSON.stringify(root)}.`,
      );
    }
    if (seen.has(folderKey)) {
      throw new Error(
        `Duplicate excluded subtree ${JSON.stringify(folderKey)}.`,
      );
    }
    const redundant = [...seen].find(
      (ancestor) =>
        ancestor === folderKey || isFolderDescendantOf(folderKey, ancestor),
    );
    if (redundant !== undefined) {
      throw new Error(
        `Excluded subtree ${JSON.stringify(folderKey)} is redundant below ${JSON.stringify(redundant)}.`,
      );
    }
    seen.add(folderKey);
  }
  return Object.freeze(normalized);
}

export function folderScopeIncludesFolder(
  scopeRoot: WorkspaceFolderKey,
  scope: FolderSpatialScope,
  candidateFolder: WorkspaceFolderKey,
): boolean {
  assertFolderKey(scopeRoot, 'Scope root');
  assertFolderKey(candidateFolder, 'Candidate folder');
  if (scope.kind === 'exact') return candidateFolder === scopeRoot;
  const excluded = normalizeExcludedSubtrees(scopeRoot, scope.excludedSubtrees);
  if (candidateFolder === scopeRoot) return scope.includeRootFiles;
  if (!isFolderDescendantOf(candidateFolder, scopeRoot)) return false;
  return !excluded.some(
    (folderKey) =>
      candidateFolder === folderKey ||
      isFolderDescendantOf(candidateFolder, folderKey),
  );
}
