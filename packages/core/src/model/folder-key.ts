import { isNormalizedWorkspacePath } from './source';

/** Exact normalized workspace-relative folder path, or `.` for the root. */
export type WorkspaceFolderKey = string;

export function isNormalizedWorkspaceFolderKey(
  value: unknown,
): value is WorkspaceFolderKey {
  return (
    typeof value === 'string' &&
    (value === '.' || isNormalizedWorkspacePath(value))
  );
}

/** Derives exact folder identity without creating canonical folder entities. */
export function workspaceFolderKeyFromPath(
  sourcePath: string,
): WorkspaceFolderKey {
  if (!isNormalizedWorkspacePath(sourcePath)) {
    throw new Error(
      `Cannot derive a folder key from invalid workspace path ${JSON.stringify(sourcePath)}.`,
    );
  }
  const separator = sourcePath.lastIndexOf('/');
  const folderKey = separator === -1 ? '.' : sourcePath.slice(0, separator);
  if (!isNormalizedWorkspaceFolderKey(folderKey)) {
    throw new Error(
      `Derived invalid workspace folder key ${JSON.stringify(folderKey)}.`,
    );
  }
  return folderKey;
}
