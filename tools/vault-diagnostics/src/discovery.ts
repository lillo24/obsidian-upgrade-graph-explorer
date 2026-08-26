import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { WorkspacePath } from '@icarus-graph-explorer/core';

import type { VaultDiscovery } from './types';

const ALWAYS_IGNORED_DIRECTORIES = new Set(['node_modules']);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function workspacePath(value: string): WorkspacePath {
  return value.split(sep).join('/');
}

function normalizeExclude(value: string): WorkspacePath {
  const normalized = value
    .replaceAll('\\', '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '');
  if (
    normalized.length === 0 ||
    isAbsolute(value) ||
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

function isExcluded(
  path: WorkspacePath,
  excludes: readonly WorkspacePath[],
): boolean {
  return excludes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isHidden(name: string): boolean {
  return name.startsWith('.');
}

/** Discover and read a complete UTF-8 Markdown inventory without following symlinks. */
export async function discoverVault(
  vaultPath: string,
  configuredExcludes: readonly string[],
): Promise<VaultDiscovery> {
  const root = resolve(vaultPath);
  let rootStats;
  try {
    rootStats = await stat(root);
  } catch (error: unknown) {
    throw new Error(
      `Vault root does not exist or cannot be inspected: ${root}`,
      {
        cause: error,
      },
    );
  }
  if (!rootStats.isDirectory()) {
    throw new Error(`Vault root is not a directory: ${root}`);
  }
  const canonicalRoot = await realpath(root);
  const excludes = configuredExcludes.map(normalizeExclude);
  const markdownDocuments: Array<{ path: WorkspacePath; source: string }> = [];
  const nonMarkdownPaths: WorkspacePath[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error: unknown) {
      throw new Error(`Cannot read vault directory: ${directory}`, {
        cause: error,
      });
    }
    entries.sort((left, right) => compareText(left.name, right.name));

    for (const entry of entries) {
      if (isHidden(entry.name)) continue;
      const absolutePath = resolve(directory, entry.name);
      const path = workspacePath(relative(canonicalRoot, absolutePath));
      if (
        path.startsWith('../') ||
        path === '..' ||
        isExcluded(path, excludes)
      ) {
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!ALWAYS_IGNORED_DIRECTORIES.has(entry.name))
          await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (path.toLocaleLowerCase('en-US').endsWith('.md')) {
        let bytes;
        try {
          bytes = await readFile(absolutePath);
        } catch (error: unknown) {
          throw new Error(`Cannot read Markdown source: ${path}`, {
            cause: error,
          });
        }
        let source: string;
        try {
          source = UTF8_DECODER.decode(bytes);
        } catch (error: unknown) {
          throw new Error(`Markdown source is not valid UTF-8: ${path}`, {
            cause: error,
          });
        }
        markdownDocuments.push({ path, source });
      } else {
        nonMarkdownPaths.push(path);
      }
    }
  }

  await walk(canonicalRoot);
  return {
    markdownDocuments: markdownDocuments.sort((left, right) =>
      compareText(left.path, right.path),
    ),
    nonMarkdownPaths: nonMarkdownPaths.sort(compareText),
  };
}
