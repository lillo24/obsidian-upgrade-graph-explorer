import type { WorkspacePath } from '@icarus-graph-explorer/core';

const ALWAYS_IGNORED_DIRECTORIES = new Set(['node_modules']);

export function compareWorkspaceText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeDiscoveryExclude(value: string): WorkspacePath {
  const normalized = value
    .replaceAll('\\', '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '');
  if (
    normalized.length === 0 ||
    value.startsWith('/') ||
    /^[A-Za-z]:[/\\]/u.test(value) ||
    normalized
      .split('/')
      .some(
        (segment) =>
          segment.length === 0 || segment === '.' || segment === '..',
      )
  ) {
    throw new Error(
      `Exclude ${JSON.stringify(value)} must be a normalized path relative to the vault root.`,
    );
  }
  return normalized;
}

export function isDiscoveryPathExcluded(
  path: WorkspacePath,
  excludes: readonly WorkspacePath[],
): boolean {
  return excludes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function shouldSkipVaultEntry(
  name: string,
  isDirectory: boolean,
): boolean {
  return (
    name.startsWith('.') ||
    (isDirectory && ALWAYS_IGNORED_DIRECTORIES.has(name))
  );
}

export function isMarkdownWorkspacePath(path: WorkspacePath): boolean {
  return path.toLocaleLowerCase('en-US').endsWith('.md');
}

export function workspacePathFromSegments(
  segments: readonly string[],
): WorkspacePath {
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\'),
    )
  ) {
    throw new Error('Vault entry names must be safe path segments.');
  }
  return segments.join('/');
}
